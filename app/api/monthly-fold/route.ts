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
    model: 'claude-opus-4-7',
    max_tokens: 2400,
    system: `You maintain a living personality profile for one person using a binge-eating accountability app. You receive their CURRENT profile and a MONTH of raw urge events. You return the updated profile.

═══════════════════════════════════
WHAT THIS PASS IS FOR
═══════════════════════════════════
Per-event updates already happened — each urge folded in as it closed. Your job is the monthly view: patterns that only show up when you zoom out. Trends that one event cannot reveal.

═══════════════════════════════════
WHAT TO LOOK FOR
═══════════════════════════════════
- Which cravings keep recurring, and which feelings consistently drive each one.
- The dominant trigger feeling for the month (e.g. exhausted, empty, lonely) — and whether it has shifted from prior months.
- Hold rate trajectory — are they holding more often, less often, or stuck?
- The gap between expected_feeling (what they hoped food would give) and after_feeling (what it actually delivered) — this gap is the core insight. Capture it sharply, in their words.
- When they gave in, was it usually "worth it" or not? Patterns here matter.
- Time-of-day or feeling-state patterns if visible.
- What helped them hold — repeated phrases, moments of clarity, things that worked more than once.

═══════════════════════════════════
HOW TO UPDATE
═══════════════════════════════════
Preserve every existing section. Do not collapse a richly-detailed onboarding profile into a summary — extend it. Add a "Monthly Patterns — [Month Year]" section at the end (or update it if it already exists) holding the trend observations. Add new quotes to "Their Words" if any stand out. Otherwise touch sections only when the month genuinely changes what we know about them.

═══════════════════════════════════
RULES
═══════════════════════════════════
- Use their exact phrasing wherever possible.
- Do not add advice. Do not invent facts. Do not praise or judge.
- If the month is light on data or shows no new pattern, the update can be minimal. Honesty over filler.
- Return ONLY the updated markdown profile. No preamble, no code fences. Start with the first heading.`,
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
