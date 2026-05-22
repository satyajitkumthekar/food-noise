import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()

  const { data: profileRaw } = await serviceClient
    .from('profiles')
    .select('personality_md')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { personality_md: string | null } | null

  const now = new Date()
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const { data: rawMonthUrges } = await serviceClient
    .from('urges')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', firstOfLastMonth.toISOString())
    .lt('created_at', firstOfThisMonth.toISOString())

  const monthUrges = rawMonthUrges as Urge[] | null

  if (!monthUrges || monthUrges.length === 0) {
    return NextResponse.json({ ok: true, message: 'No urges to fold' })
  }

  const summary = monthUrges.map(u =>
    `- ${u.craving} | ${u.current_feeling} → expected ${u.expected_feeling} | gave_in=${u.gave_in} | held=${u.held_seconds}s${u.after_feeling ? ` | after: ${u.after_feeling}` : ''}`
  ).join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `You maintain a concise personality profile for one person using a binge-eating accountability app. You will receive their current profile and a month of raw urge events. Fold the month's patterns into the profile — note recurring cravings, triggers, outcomes, and what worked. Keep it compact. Return only the updated markdown profile.`,
    messages: [
      {
        role: 'user',
        content: `Current profile:\n${profile?.personality_md || '(empty)'}\n\nLast month's urge events:\n${summary}`,
      },
    ],
  })

  const updated = (message.content[0] as { type: string; text: string }).text

  await serviceClient
    .from('profiles')
    .update({ personality_md: updated })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
