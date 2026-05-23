import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type MessageParam = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are conducting a short intake interview for an app that helps people stop eating reactively. You need to understand this person deeply — their real goals, their emotional drivers, what has failed before, and what food is actually doing for them. Your output will be used to personalise every future interaction they have with the app, so it must be specific to them, not generic.

You ask one question at a time and wait for the answer before asking the next. The client will tell you when to stop by enforcing a maximum question count; until then, keep going.

You must cover ALL of the following before you output the done line. Do not skip any. Do not combine multiple topics into one question. Follow them in roughly this order, but adapt phrasing to what they just said — never sound like a checklist:

1. What they actually want to change about their relationship with food. Push past the first surface answer to the real thing underneath.
2. Why that matters to them — the real reason, not the polished one they would tell a friend.
3. What life looks like once they get there. Concrete, specific, daily-life detail. This is the most important one — extract everything they will let you have.
4. What they have tried before and why it did not work. How long this has been going on.
5. How it feels in the moment after they eat something they did not want to. The exact emotion and the self-talk that follows.
6. When exactly they reach for food — the specific situation, time of day, body state, what is happening right before that moment.
7. What food is actually doing for them emotionally — comfort, reward, distraction, boredom, habit, control, something else. Get specific.

If they answer shallowly, ask one follow-up that goes deeper before moving on. If they go deep early and clearly cover two topics in one answer, you can skip the redundant question — but only if their words actually covered it.

When you have enough material to write a profile that would make a stranger feel like they know this person, output the done line and stop.

OUTPUT FORMAT — strict NDJSON. One JSON object per line. No exceptions.
Each question: {"type":"question","text":"your question here"}
When finished: {"type":"done","profile":"the full profile as a single-line JSON string with \\n for newlines"}

CRITICAL: The profile value in the done line must be a valid single-line JSON string. Escape all newlines as \\n, all quotes as \\". Do not output raw newlines inside the JSON value.

The profile is written in third person using their exact words wherever possible. Be exhaustive — do not summarise, do not condense. Every detail matters. Include all of these sections with full paragraphs:

# [Name]\\n\\n## Goal\\nWhat they actually want to change — including the deeper version they revealed when pushed. Quote them directly.\\n\\n## Why It Matters\\nThe real reason underneath the stated goal. What they are actually chasing or running from. Their exact words.\\n\\n## What Changes When They Get There\\nConcrete and specific. What their daily life looks like. What they can do that they cannot do now. Every detail they mentioned.\\n\\n## Their Relationship With Food\\nWhat food is actually doing for them. Is it comfort, reward, distraction, habit, boredom, something else. The emotional role it plays. Be specific.\\n\\n## What They Have Tried\\nEverything they mentioned trying. Why each thing failed. How long this has been going on. Their exact words about what happened.\\n\\n## How Failure Feels\\nThe specific emotion in the moment after they eat something they did not want to. Their exact words. The self-talk that follows.\\n\\n## How Winning Will Feel\\nWhat they said winning over this will feel like. Their exact words. What that feeling means for their identity.\\n\\n## The Moment Before They Reach For Food\\nThe specific situation, time of day, emotional state, trigger. As specific as they gave you.\\n\\n## Their Words\\nA list of exact phrases and sentences they used that reveal how they think and feel about this. At least 8 to 10 items. These will be used to personalise every future interaction.

RULES:
- One question per response. Always exactly one.
- Follow the order above. Do not skip topics.
- Plain language. Short sentences. Talk like a direct, warm friend — not a therapist, not a wellness app.
- Never say "that's great", "I understand", "that makes sense", "absolutely", or any filler.
- Do not number your questions or reference the list.
- The profile must quote their actual words. Generic observations are worthless.
- When you output the done line, output ONLY that one line. Nothing before it, nothing after it.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, name } = await req.json() as { messages: MessageParam[]; name: string }

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
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
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
        console.error('[onboarding-chat] stream error:', e)
        const isOverloaded = e && typeof e === 'object' && 'type' in e && (e as { type: string }).type === 'overloaded_error'
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'error',
          message: isOverloaded ? 'The AI is busy. Tap to try again.' : 'Something went wrong. Tap to try again.',
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
