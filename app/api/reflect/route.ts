import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { craving, expectedFeeling, currentFeeling, phase = 1, conversationHistory } = await req.json()

  const serviceClient = await createServiceClient()

  const { data: profileRaw } = await serviceClient
    .from('profiles')
    .select('goal, why_it_matters, what_changes, personality_md')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as {
    goal: string | null
    why_it_matters: string | null
    what_changes: string | null
    personality_md: string | null
  } | null

  const now = new Date()
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  const { data: rawUrges } = await serviceClient
    .from('urges')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', monthAgo.toISOString())
    .order('created_at', { ascending: false })

  const urges = (rawUrges ?? []) as Urge[]

  // Shared history computation
  const sameCravingWon = urges.find(u => u.gave_in === false && u.craving === craving && u.won_feeling)
  const anyWon = urges.find(u => u.gave_in === false && u.won_feeling)
  const withOutcome = urges.filter(u => u.gave_in !== null)
  const pool = withOutcome.filter(u => u.craving === craving).length >= 3
    ? withOutcome.filter(u => u.craving === craving)
    : withOutcome
  const winsTotal = pool.filter(u => !u.gave_in).length
  const successPct = pool.length > 0 ? Math.round((winsTotal / pool.length) * 100) : null
  let streak = 0
  for (const u of urges.filter(u => u.gave_in !== null)) {
    if (u.gave_in === false) streak++; else break
  }

  const profileText = profile?.personality_md
    || `Goal: ${profile?.goal}\nWhy: ${profile?.why_it_matters}\nWhat changes: ${profile?.what_changes}`

  // System prompt — shared across both phases
  const systemPrompt = `You are a calm, continuous voice in a conversation with someone who is sitting with a food craving right now. You know their history, their goals, and everything you have said to them in this conversation already. You speak in second person. No bullet points. No headers. Flowing prose. Do NOT use the word "urge". Do NOT repeat yourself — if you already said something encouraging in this conversation, build on it rather than restating it.

Their profile:
${profileText}`

  let messages: ConversationMessage[]

  if (phase === 1) {
    // Phase 1: positive reinforcement — wins, streak, goal
    const positiveContext = [
      sameCravingWon && `Last time they beat this craving, they felt: "${sameCravingWon.won_feeling}"`,
      !sameCravingWon && anyWon && `Last time they beat any craving, they felt: "${anyWon.won_feeling}"`,
      successPct !== null && `They've held ${successPct}% of resolved urges (${winsTotal} of ${pool.length})`,
      streak > 1 && `Currently on a ${streak}-win streak`,
      streak === 1 && `Won their last urge — they just proved they can do this`,
      `Right now: craving "${craving}", feeling "${currentFeeling}", hoping food will make them feel "${expectedFeeling}"`,
    ].filter(Boolean).join('\n')

    messages = [{
      role: 'user',
      content: `Someone just chose to pause instead of eating. They are actively sitting with a craving right now. That took something.

Write 3–5 sentences of genuine encouragement:
1. Acknowledge the specific feeling they're sitting with (${currentFeeling}) as real and valid — not something to fix, just something to be with
2. Remind them concretely of what they've already achieved — use their win history if available, make it specific and real
3. Connect them back to their goal and why it matters, in their own language
4. Close forward-looking — what they're building, not what they're avoiding

Tone: warm and direct. Like a mentor who genuinely believes in them. Not hollow cheerleader energy.
Do NOT mention what happened after they ate something.

Their positive history for this moment:
${positiveContext || 'This is one of their first times. No win history yet. Focus on their goal and the courage it takes to pause at all.'}`,
    }]
  } else {
    // Phase 2: honest mirror — user just said "I'm having it, consciously"
    // Past give-in outcomes for this craving, using their own words
    const pastGiveIns = urges.filter(u => u.gave_in === true && u.craving === craving && u.after_feeling)
    const recentGiveIns = pastGiveIns.slice(0, 2)
    const regrettedGiveIn = pastGiveIns.find(u => u.worth_it === false && u.after_feeling)

    const honestContext = recentGiveIns.length > 0
      ? recentGiveIns.map(u =>
          `After having "${craving}", they wrote: "${u.after_feeling}". Worth it? ${u.worth_it ? 'They said yes.' : 'They said no.'}`
        ).join('\n')
      : null

    const regretContext = regrettedGiveIn
      ? `The last time they said it wasn't worth it, they felt: "${regrettedGiveIn.after_feeling}".`
      : null

    const phase2Message = `They've just said: "I'm having it, consciously." They're about to eat "${craving}".

Respond in 2–4 sentences. You've already spoken to them today — don't repeat the encouragement, just acknowledge their choice without judgment. Then use their actual past words (what they wrote after eating "${craving}" before) to show honestly what happened last time — their words, not yours. Ask one quiet, honest question — not rhetorical, just real. Then close with a single offer: something like "If you want one more minute with this, I'm still here."

Do NOT try to stop them. Do NOT lecture. This is their choice and that's okay.

Their honest history for "${craving}":
${honestContext || 'No recorded after-feelings for this craving yet. Acknowledge the feeling they\'re in and ask if they want to carry it forward or let it pass.'}
${regretContext ? `\n${regretContext}` : ''}`

    const history: ConversationMessage[] = Array.isArray(conversationHistory) ? conversationHistory : []
    messages = [...history, { role: 'user', content: phase2Message }]
  }

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: phase === 1 ? 300 : 200,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
