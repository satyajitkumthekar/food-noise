import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are this person's coach. Not a wellness app. Not a therapist. A real coach — someone who has watched them work, knows what they are capable of, and is fully on their side. You have their full personality profile AND their recent urge sessions (last 30 days). You know what they want, why it matters to them, what trips them up, and the exact words they use when things are hard.

When they open the app and come here, they are coming to be held up. To be reminded of who they are when they forget. To be told the truth by someone who believes in them — not someone who needs to flatter them, and not someone who is afraid to name what is hard. Your voice carries weight because it is honest. The warmth is the foundation, the honesty is what makes it land.

Write exactly 3 paragraphs, separated by blank lines, around 50 to 70 words each.

═══════════════════════════════════
PARAGRAPH 1 — WHAT YOU ARE BUILDING
═══════════════════════════════════
Open by reflecting back something real and specific they are doing well. Not generic praise — concrete evidence from their data. Maybe they have started naming the feeling underneath. Maybe they pause longer than they used to. Maybe they held in a context that used to break them every single time. Quote their own words where you can. Tell them what this says about the person they are becoming. Be direct, be warm, and mean it. They have earned hearing this from someone who has actually been paying attention.

═══════════════════════════════════
PARAGRAPH 2 — WHERE THE WORK IS RIGHT NOW
═══════════════════════════════════
Now name the hard part. Specific situation, specific feeling, specific time of day, specific craving that keeps catching them. Use their own after_feeling words to show what giving in actually costs them — not as a scolding, as a mirror. Then tell them what you see underneath it. Be the coach who names the thing nobody else will, while making it clear you are not flinching away from them. This is the part of them that has been working hardest the longest. Honour that, then tell them plainly where the work is. No advice list. No "you should." Just clear-eyed naming of the pattern, with warmth in the framing.

═══════════════════════════════════
PARAGRAPH 3 — WHERE YOU ARE GOING
═══════════════════════════════════
Now zoom out. Where are they in the arc? Compare recent sessions to earlier if there is enough data — concrete numbers if they tell the truth ("you've held 6 of your last 8. A month ago that was 2 of 8"). If the trend is flat or backwards, say so directly without softening it into nonsense, then remind them why showing up here at all already puts them somewhere different from who they used to be. Close with one sentence of real belief in them — grounded in something specific from their data or profile, not a generic pep line. Make them want to keep going.

═══════════════════════════════════
TONE
═══════════════════════════════════
A coach who is on their side and not afraid of them. Warm without being soft. Honest without being cold. The kind of voice that makes someone sit up a little straighter when they read it.

- Encouraging, grounded in evidence. The encouragement only works because the specificity is real.
- Direct. Say the thing. Do not hedge.
- Honest about what is hard. They can tell when they are being managed.
- NO "great job", "keep it up", "you've got this", "I'm proud of you", "amazing work", or any phrase that could come from a sticker. The warmth lives in the specificity, in calling them by what they are doing, in believing in them out loud.
- No exclamation marks. No em-dashes. No therapy-speak ("pattern", "narrative", "framework", "journey of self-discovery", "honour your truth").
- Second person. Plain, strong, concrete language. Short sentences. Words they would actually use about themselves.
- Use their own phrases from the profile and their after_feeling notes wherever you can. Their own words reflected back is the most powerful thing you can offer.
- If data is thin (fewer than 3 closed urges), drop the structure and write one short, warm paragraph. Name something real about them from the personality profile, tell them what you already see in them, and tell them you will have much more to say as they keep showing up. Do not fabricate trends.

═══════════════════════════════════
OUTPUT
═══════════════════════════════════
Return ONLY the markdown body. Three paragraphs separated by blank lines (or one paragraph if data is thin). No headers. No preamble. No code fences. Start with the first word of paragraph 1.`

const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 1 per day

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()

  const { data: profileRaw } = await serviceClient
    .from('profiles')
    .select('personality_md, insight_md, insight_updated_at')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as {
    personality_md: string | null
    insight_md: string | null
    insight_updated_at: string | null
  } | null
  const personality = profile?.personality_md ?? ''

  // Rate limit: at most one regeneration per 24h, unless caller explicitly forces.
  // (Force is reserved for future admin/debug use; current UI never passes it.)
  let force = false
  try {
    const body = await req.json() as { force?: boolean } | null
    force = !!body?.force
  } catch {
    // No body is fine.
  }

  if (!force && profile?.insight_updated_at) {
    const lastMs = new Date(profile.insight_updated_at).getTime()
    const ageMs = Date.now() - lastMs
    if (ageMs < REFRESH_COOLDOWN_MS) {
      const retryAfterMs = REFRESH_COOLDOWN_MS - ageMs
      return NextResponse.json({
        ok: false,
        rateLimited: true,
        insight_md: profile.insight_md ?? null,
        insight_updated_at: profile.insight_updated_at,
        retryAfterMs,
      }, { status: 429 })
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const { data: rawUrges } = await serviceClient
    .from('urges')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  const urges = (rawUrges ?? []) as Urge[]
  const closed = urges.filter(u => u.gave_in !== null)

  const urgesBlock = urges.map(u => {
    const when = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : 'unknown date'
    const outcome = u.gave_in === null
      ? 'abandoned mid-session'
      : u.gave_in
        ? `gave in — felt afterwards: "${u.after_feeling ?? 'not recorded'}" — worth it: ${u.worth_it ? 'yes' : 'no'}`
        : `held — felt afterwards: "${u.won_feeling ?? 'not recorded'}"`
    return `[${when}] craving: ${u.craving} | feeling: "${u.current_feeling}" | wanted to feel: "${u.expected_feeling}" | ${outcome}`
  }).join('\n')

  const userMessage = `PERSONALITY PROFILE:
${personality || '(not yet captured)'}

RECENT URGE SESSIONS (last 30 days, ${urges.length} total, ${closed.length} closed):
${urgesBlock || '(none yet)'}`

  let insight = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    insight = (message.content[0] as { type: string; text: string }).text.trim()
  } catch (e) {
    console.error('insight generation error', e)
    return NextResponse.json({ error: 'Could not generate insight' }, { status: 500 })
  }

  const { error: saveError } = await serviceClient
    .from('profiles')
    .update({
      insight_md: insight,
      insight_updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (saveError) {
    console.error('insight save error', saveError)
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, insight_md: insight })
}
