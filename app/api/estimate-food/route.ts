import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const { food } = await req.json()
  if (!food) return NextResponse.json({ kcal: null, protein: null })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Estimate the kcal and protein (in grams) for this food: "${food}". Reply with only a JSON object in this exact format: {"kcal": number, "protein": number}. Use typical serving sizes if no quantity is specified.`,
        },
      ],
    })

    const text = (message.content[0] as { type: string; text: string }).text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return NextResponse.json({
        kcal: parsed.kcal != null ? Math.round(parsed.kcal) : null,
        protein: parsed.protein != null ? Math.round(parsed.protein) : null,
      })
    }
  } catch (e) {
    console.error('estimate-food error', e)
  }

  return NextResponse.json({ kcal: null, protein: null })
}
