import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NUTRITION_SYSTEM_PROMPT, fetchRecentLogs, formatHistoryBlock } from '@/lib/nutrition-prompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { food } = await req.json()
  if (!food || typeof food !== 'string') {
    return NextResponse.json({ name: null, kcal: null, protein: null })
  }

  const recent = await fetchRecentLogs(user.id)
  const historyBlock = formatHistoryBlock(recent)

  const userMessage = `${historyBlock}

NEW ENTRY TO ESTIMATE:
"${food}"

Estimate calories and protein for this new entry, using the history above to stay consistent when the item matches something they have logged before. Use a typical serving size if no quantity is given.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 300,
      system: NUTRITION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = (message.content[0] as { type: string; text: string }).text
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0]) as { name?: string | null; kcal: number | null; protein: number | null }
      return NextResponse.json({
        name: parsed.name ?? food,
        kcal: parsed.kcal != null ? Math.round(parsed.kcal) : null,
        protein: parsed.protein != null ? Math.round(parsed.protein) : null,
      })
    }
  } catch (e) {
    console.error('estimate-food error', e)
  }

  return NextResponse.json({ name: food, kcal: null, protein: null })
}
