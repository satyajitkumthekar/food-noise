import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type ProfileRow = {
  personality_md: string | null
  goal: string | null
  why_it_matters: string | null
  what_changes: string | null
  name: string | null
}

export async function POST(req: Request) {
  const body = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()

  const { data: profileRaw } = await serviceClient
    .from('profiles')
    .select('personality_md, goal, why_it_matters, what_changes, name')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as ProfileRow | null

  let eventDescription = ''

  if (body.seed) {
    eventDescription = `New user onboarding:
Name: ${body.name}
Goal: ${body.goal}
Why it matters: ${body.why_it_matters}
What changes: ${body.what_changes}`
  } else if (body.urgeId) {
    const { data: urgeRaw } = await serviceClient
      .from('urges')
      .select('*')
      .eq('id', body.urgeId)
      .single()

    const urge = urgeRaw as Urge | null

    if (urge) {
      const conversationLog = (urge as Urge & { conversation_log?: { beat: number; userChoice: string }[] | null }).conversation_log
      const voiceTranscript = conversationLog && conversationLog.length > 0
        ? conversationLog.map(e => `  Beat ${e.beat}: "${e.userChoice}"`).join('\n')
        : null

      eventDescription = `Urge session:
Craving: ${urge.craving}
Expected feeling (what they hoped food would give): ${urge.expected_feeling}
Current feeling (what was actually going on): ${urge.current_feeling}
Held for: ${urge.held_seconds}s
Outcome: ${urge.gave_in ? 'Gave in' : 'Held'}
${urge.won_feeling ? `How they felt after holding: ${urge.won_feeling}` : ''}
${urge.after_feeling ? `How they felt after eating: ${urge.after_feeling}` : ''}
${urge.worth_it != null ? `Was it worth it: ${urge.worth_it ? 'Yes' : 'No'}` : ''}
${voiceTranscript ? `Inner voice transcript (what they said their voice was telling them):\n${voiceTranscript}` : ''}`
    }
  }

  if (!eventDescription) {
    return NextResponse.json({ ok: true })
  }

  const currentProfile = profile?.personality_md || ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `You maintain a living psychological profile for one person using a binge-eating accountability app. You receive their current profile and one new event. Rewrite the profile to fold in the new event — keep it short, plain, and specific to this person.

Track and update:
- Their stated goal and why it matters to them (in their words)
- Their recurring cravings and what feelings trigger each one
- The gap: what they hoped food would give them vs what it actually delivered (their own words)
- Their inner voice patterns — the specific phrases and rationalizations that come up (from conversation_log)
- What helped them hold — specific feelings, strategies, or moments that worked
- Their characteristic phrasing and emotional vocabulary
- Patterns over time: are they improving, regressing, stuck on a specific craving?

Do not add advice. Do not invent facts. Only reflect what the data shows. Be specific — generic observations are useless. Return only the updated markdown profile.`,
    messages: [
      {
        role: 'user',
        content: `Current profile:\n${currentProfile || '(empty — this is the first entry)'}\n\nNew event:\n${eventDescription}`,
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
