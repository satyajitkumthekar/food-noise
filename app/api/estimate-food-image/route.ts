import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NUTRITION_SYSTEM_PROMPT, fetchRecentLogs, formatHistoryBlock } from '@/lib/nutrition-prompt'

// IMPORTANT: Image bytes are forwarded to Claude in a single API call and
// never persisted — not to disk, not to Supabase storage, not to logs.
// They exist only in request memory for the duration of the Anthropic call.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const ALLOWED_MEDIA: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
}

const MAX_BASE64_BYTES = 8 * 1024 * 1024

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { dataUrl?: string; description?: string }
  const dataUrl = body.dataUrl
  const description = (body.description ?? '').trim()

  if (!dataUrl || typeof dataUrl !== 'string') {
    return NextResponse.json({ error: 'No image' }, { status: 400 })
  }
  if (!description) {
    return NextResponse.json({ error: 'Description required with photo' }, { status: 400 })
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  }
  const rawMedia = match[1].toLowerCase()
  const base64 = match[2]
  const mediaType = ALLOWED_MEDIA[rawMedia]
  if (!mediaType) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }
  if (base64.length > MAX_BASE64_BYTES) {
    return NextResponse.json({ error: 'Image too large' }, { status: 413 })
  }

  const recent = await fetchRecentLogs(user.id)
  const historyBlock = formatHistoryBlock(recent)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 400,
      system: NUTRITION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `${historyBlock}

USER'S DESCRIPTION OF THIS MEAL: "${description}"

Use the photo and the user's description together. The description is authoritative for what they ate; the photo helps with portion sizes, hidden ingredients (visible oil, garnishes), and sanity-checking. If the description and photo match something in their history, stay consistent with those numbers. If the image is unreadable, fall back to the description alone.

Estimate kcal and protein for the serving shown.`,
            },
          ],
        },
      ],
    })

    const text = (message.content[0] as { type: string; text: string }).text
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0]) as { name: string | null; kcal: number | null; protein: number | null }
      return NextResponse.json({
        name: parsed.name ?? description,
        kcal: parsed.kcal != null ? Math.round(parsed.kcal) : null,
        protein: parsed.protein != null ? Math.round(parsed.protein) : null,
      })
    }
  } catch (e) {
    console.error('estimate-food-image error', e)
  }

  return NextResponse.json({ name: description, kcal: null, protein: null })
}
