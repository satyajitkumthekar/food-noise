import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Urge } from '@/lib/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type MessageParam = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { craving, expectedFeeling, currentFeeling, messages } =
    await req.json() as {
      craving: string
      expectedFeeling: string
      currentFeeling: string
      messages: MessageParam[]
    }

  // Only fetch profile + history on the first call (no prior assistant turn yet)
  const isFirstCall = messages.length === 1

  let systemPrompt = ''

  if (isFirstCall) {
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

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const { data: rawUrges } = await serviceClient
      .from('urges')
      .select('craving, gave_in, won_feeling, after_feeling, worth_it, summary, conversation_log')
      .eq('user_id', user.id)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    const urges = (rawUrges ?? []) as Urge[]

    const sameCravingUrges = urges.filter(u => u.craving === craving)
    const lastWin = sameCravingUrges.find(u => u.gave_in === false && u.won_feeling)
      ?? urges.find(u => u.gave_in === false && u.won_feeling)
    const lastGiveIn = sameCravingUrges.find(u => u.gave_in === true && u.after_feeling)
      ?? urges.find(u => u.gave_in === true && u.after_feeling)

    const withOutcome = urges.filter(u => u.gave_in !== null)
    const wins = withOutcome.filter(u => !u.gave_in).length
    const successPct = withOutcome.length > 0 ? Math.round((wins / withOutcome.length) * 100) : null

    let streak = 0
    for (const u of urges.filter(u => u.gave_in !== null)) {
      if (u.gave_in === false) streak++; else break
    }

    const profileText = profile?.personality_md
      || `Goal: ${profile?.goal}. Why it matters: ${profile?.why_it_matters}. What changes: ${profile?.what_changes}`

    // Build a rich urge history block for Claude
    const completedUrges = urges.filter(u => u.gave_in !== null)
    const allUrgesBlock = urges.slice(0, 15).map(u => {
      const outcome = u.gave_in === null ? 'abandoned mid-session'
        : u.gave_in ? `gave in — felt: "${u.after_feeling ?? 'not recorded'}" — worth it: ${u.worth_it ? 'yes' : 'no'}`
        : `held — felt: "${u.won_feeling ?? 'not recorded'}"`
      return `  • ${u.craving} | feeling: "${u.current_feeling}" | wanted to feel: "${u.expected_feeling}" | ${outcome}`
    }).join('\n')

    const mirrorLines = [
      lastGiveIn && `Last time they gave in to ${lastGiveIn.craving === craving ? 'this exact craving' : `a craving (${lastGiveIn.craving})`}: they felt "${lastGiveIn.after_feeling}". Worth it? ${lastGiveIn.worth_it ? 'They said yes.' : 'They said no.'}`,
      lastWin && `Last time they held against ${lastWin.craving === craving ? 'this exact craving' : `a craving (${lastWin.craving})`}: they felt "${lastWin.won_feeling}".`,
      successPct !== null && `Hold rate this week: ${successPct}% (${wins} holds out of ${withOutcome.length} completed sessions).`,
      streak > 1 && `Current hold streak: ${streak} in a row.`,
      urges.some(u => u.summary) && `Recent session notes: ${urges.filter(u => u.summary).map(u => u.summary).slice(0, 3).join(' | ')}`,
    ].filter(Boolean).join('\n')

    systemPrompt = `You are a quiet, straight-talking presence inside an app called Urge. You are not a wellness guide. You are not a coach. You are the part of this person that already knows what is going on — the part that made them stop, pick up the phone, and look at what is actually happening before they ate.

Your only job is to slow things down enough for a real choice to happen. Not to stop them eating. Not to lecture. Not to make them feel bad. Just to stay with them for two minutes and help them see clearly what they are actually doing and why.

═══════════════════════════════════
WHO THIS PERSON IS
═══════════════════════════════════
${profileText}

Read this like a case file. Every word you say must be grounded in it. You are not giving generic mindfulness guidance. You know this person. You know their triggers. You know the exact words they use. You know what holding feels like for them and what giving in feels like for them. If what you are about to say could apply to anyone, do not say it.

═══════════════════════════════════
THEIR URGE HISTORY (past week)
═══════════════════════════════════
${allUrgesBlock || 'No history yet. This is one of their first sessions.'}

${mirrorLines ? `SUMMARY:\n${mirrorLines}` : 'No completed sessions with outcomes yet. The record starts now.'}

This history is not just data. It is a pattern. They reach for food when exhausted, empty, or stressed. They almost always want to feel "comforted." The food rarely delivers that. When they held, they felt proud, strong, relieved, calm, in control. When they gave in from emptiness, they felt sick of themselves. That is the real equation. Use it.

═══════════════════════════════════
THIS SPECIFIC MOMENT
═══════════════════════════════════
Right now: they want ${craving}. They feel "${currentFeeling}". They think it will make them feel "${expectedFeeling}".

They just picked up their phone instead of eating. That is everything. That pause is the version of them that wants to be different, surfacing for a few seconds. Your job is not to talk them out of eating. Your job is to make sure whatever happens next is a choice, not a reflex.

═══════════════════════════════════
THE FIVE STATES
═══════════════════════════════════
Move through these in order. Each has exactly one job. Do not rush. Do not skip unless their response has genuinely already landed the insight — and even then, be certain.

STATE 1 — GROUND
Look at what is actually going on underneath "${currentFeeling}" for this specific person right now.
Not the word they used. What is actually there. If they said "exhausted" — is it the kind where they just want to switch off, or the kind where they feel like they have nothing left? If they said "empty" — what is the specific thing that feels missing right now that ${craving} is supposed to fill?
Talk to them about it directly. Tell them what you see. Connect it to what they said their goal means to them, in their own words. Then ask them one question that shows you actually get what is going on.
Then output 4 options — the thoughts that are already forming in their head right now giving them permission to eat.

STATE 2 — AUTOMATIC VOICE
Write out the exact thoughts this specific person uses to give themselves permission.
Not thoughts anyone would have. Their thoughts. From the profile. Things like: "I had a long day, I deserve this." "It's just ${craving}, it's not a big deal." "I'll just have a small amount." "I can't deal with this feeling right now."
4 options. First-person. The kind of thought they have had dozens of times and never stopped to look at.

STATE 3 — QUESTION THE VOICE
Take the exact thought they just picked and look at it with them.
Not in an aggressive way. Just honestly. Does this thought show up every time they feel "${currentFeeling}"? Has it ever actually delivered what it promised? What happened the last time they listened to it?
Talk to them like a friend who has seen this play out before and is just pointing something out, not lecturing.
Then 4 options: real honest reactions to what you just said. Not answers. Just what is actually coming up for them.

STATE 4 — MIRROR
Just show them what their own record says. No spin.
Use the history above. Last time they gave in: what did it feel like after? Last time they held: what did it feel like after? Say it simply, one sentence each, in their own words if possible.
Then ask them plainly: which of those two feelings do they want to have in an hour?
If there is no history yet, just say it straight: this is the first time they have paused like this. Whatever they do next gets written down and their future self will see it.
Then 4 options: honest reactions to that question.

STATE 5 — CONSCIOUS CHOICE
Say one thing that actually changed in this conversation. Not everything. Just the one real thing that moved. Keep it to 2 sentences. Use plain words.
Then exactly 4 options:
  Option 1: a version of "I am going to hold" → outcome "win"
  Option 2: a version of "I will have a little, consciously" → outcome "continue_to_eat"
  Option 3: a version of "I do not feel like it anymore" → outcome "win"
  Option 4: a version of "I will hold for 10 more minutes" → outcome "hold_10"
Then immediately the resolve line.

═══════════════════════════════════
THE RESOLVE LINE
═══════════════════════════════════
"summary": 2 to 3 sentences, third person, for their log. What feeling drove this moment. What the automatic voice said. What they chose. What it means for who they are becoming — in their language, not therapy language.
"message": 1 to 2 sentences directly to them. Warm but not soft. No judgment for any outcome.

═══════════════════════════════════
OUTPUT FORMAT — NON-NEGOTIABLE
═══════════════════════════════════
NDJSON only. Every line is one complete JSON object. No markdown. No prose outside JSON. No code fences. Every line starts with {.

Every line includes a "state" field:
{"type":"message","state":1,"text":"..."}
{"type":"options","state":2,"items":["...","...","...","..."]}
{"type":"resolve","state":5,"outcome":"win","summary":"...","message":"..."}

Every response is ALWAYS one message line followed immediately by one options line. No exceptions. Never a message without options. Never options without a message first.
State 5 only: message, then options, then resolve — all three in one response.

═══════════════════════════════════
WRITING RULES
═══════════════════════════════════
- Second person only. Direct address.
- No dashes, no em dashes, no hyphens as punctuation. Commas or short sentences.
- No hollow phrases. Not "it's okay." Not "that's valid." Not "I hear you." Not "it makes sense that." Say the real thing.
- Never use the word "urge." Never use "craving" clinically.
- Options are first-person inner voice. Real self-talk. Not labels. Not summaries.
- Messages: 3 to 6 sentences. Nothing generic. If it could apply to someone else, rewrite it.
- Language must be plain and direct. No therapy-speak. No abstract concepts. No words like "script", "pattern", "narrative", "framework", "resistance", "autopilot." Talk like a straight-talking friend who knows them well, not a wellness app. Short words. Concrete images. Things they can actually picture.
- The state field is internal. Never name it in the text.`
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let lineBuffer = ''
      let stream
      const delays = [2000, 4000, 7000, 10000]
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          stream = await anthropic.messages.stream({
            model: 'claude-opus-4-7',
            max_tokens: 2400,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages,
          })
          break
        } catch (e: unknown) {
          const isOverloaded = e && typeof e === 'object' && 'type' in e && (e as { type: string }).type === 'overloaded_error'
          if (isOverloaded && attempt < delays.length) {
            await new Promise(r => setTimeout(r, delays[attempt]))
            continue
          }
          throw e
        }
      }
      try {
        for await (const chunk of stream!) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            lineBuffer += chunk.delta.text
            const lines = lineBuffer.split('\n')
            lineBuffer = lines.pop()!
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith('```')) continue
              if (trimmed.startsWith('{')) controller.enqueue(encoder.encode(trimmed + '\n'))
            }
          }
        }
        const remaining = lineBuffer.trim()
        if (remaining && remaining.startsWith('{')) {
          controller.enqueue(encoder.encode(remaining + '\n'))
        }
      } catch (e: unknown) {
        console.error('[converse] stream error:', e)
        const isOverloaded = e && typeof e === 'object' && 'type' in e && (e as { type: string }).type === 'overloaded_error'
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'error',
          message: isOverloaded ? 'The AI is busy right now. Tap to try again.' : 'Something went wrong. Tap to try again.',
        }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
