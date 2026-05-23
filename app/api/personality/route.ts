import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type ProfileRow = {
  personality_md: string | null
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
    .select('personality_md, name')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as ProfileRow | null

  let eventDescription = ''

  if (body.urgeId) {
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
    model: 'claude-opus-4-7',
    max_tokens: 2400,
    system: `You maintain a living psychological profile for one person using a binge-eating accountability app. You receive their CURRENT profile and ONE new event. You return the updated profile.

═══════════════════════════════════
HOW TO UPDATE
═══════════════════════════════════
The current profile was written carefully — probably during onboarding, in rich, structured form with the person's exact words. Your job is to EXTEND it with what the new event reveals, not to summarise it. Never shorten a section that is already detailed unless the new event directly contradicts what was there. Length is not the enemy — vagueness is.

Preserve the existing structure (the markdown headings). If the profile already has sections like Goal / Why It Matters / What Changes / Relationship With Food / What They Have Tried / How Failure Feels / How Winning Will Feel / The Moment Before They Reach For Food / Their Words — keep all of them. Add new sections only if the new event surfaces something the existing structure cannot hold.

═══════════════════════════════════
WHAT TO FOLD IN FROM THE NEW EVENT
═══════════════════════════════════
- New cravings or triggers that appeared, and the specific feeling that drove them.
- The gap between what they hoped food would give them and what it actually delivered — in their own words from the after_feeling field.
- Inner voice patterns from the conversation_log — the exact phrases and rationalisations that came up in their head this time. Add these to the "Their Words" section verbatim where possible.
- What helped them hold, if they held. Specific feelings, moments, or shifts that worked. Add to a "What Has Worked" section if one does not exist.
- Whether the pattern is shifting — are they holding more, naming feelings more clearly, catching themselves earlier? Note it factually, not as praise.
- If they gave in and said it was not worth it: capture that mismatch plainly. This is gold for the mirror agent next time.

═══════════════════════════════════
RULES
═══════════════════════════════════
- Use their exact words wherever possible. Quote them. Generic observations are worthless.
- Do not add advice. Do not invent facts. Do not interpret beyond what the data shows.
- Never collapse rich detail into a summary. If a section was three paragraphs of specific quotes before, it should still be three paragraphs (plus whatever the new event adds).
- If the new event is small or repeats a known pattern, the update may be tiny — one new quote in "Their Words", one line noting the repetition. That is fine.
- Return ONLY the updated markdown profile. No preamble, no commentary, no code fences. Start with the first heading.`,
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
