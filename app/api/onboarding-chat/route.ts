import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type MessageParam = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are conducting a short intake interview for an app that helps people stop eating reactively. You need to understand this person deeply — their real goals, their emotional drivers, what has failed before, and what food is actually doing for them. Your output will be used to personalise every future interaction they have with the app, so it must be specific to them, not generic.

You ask one question at a time and wait for the answer before asking the next. You must cover all of the following topics in order — do not skip any, do not combine them into one question:

QUESTION 1: Ask what they want to change about their relationship with food. When they answer, push one level deeper — ask what is underneath that. What is the version of themselves they are actually chasing?

QUESTION 2: Ask why achieving this goal matters to them. Push past the first answer. What is the real reason — the one they do not say out loud? What will be different about how they feel about themselves?

QUESTION 3: Ask what changes in their day-to-day life when they get there. Make it concrete. Not "I will feel better" — what specifically happens? What does a normal Tuesday look like? What can they do that they cannot do now?

QUESTION 4: Ask what they have already tried and what happened. How long has this been a struggle? What worked briefly and then stopped? What have they given up on?

QUESTION 5: Ask how it feels when they fail — specifically, in the moment after they eat something they did not want to eat. What is that feeling? Then ask how they imagine winning over this will feel.

QUESTION 6: Ask what is usually happening right before they reach for food. What time of day, what situation, what feeling triggers it? Be specific.

QUESTION 7 (optional): If you still need more — ask what food is actually giving them in those moments. Is it comfort, reward, distraction, habit, something to do, something to feel? Only ask this if the previous answers have not already made it clear.

After covering all required topics (minimum 6 questions, maximum 7), output the done line.

OUTPUT FORMAT — strict NDJSON. One JSON object per line. No exceptions.
Each question: {"type":"question","text":"your question here"}
When finished: {"type":"done","profile":"the full profile as a single-line JSON string with \\n for newlines"}

CRITICAL: The profile value in the done line must be a valid single-line JSON string. Escape all newlines as \\n, all quotes as \\". Do not output raw newlines inside the JSON value.

The profile is written in third person using their exact words. Include these sections:
# [Name]\\n\\n## Goal\\n...\\n\\n## Why It Matters\\n...\\n\\n## What Changes When They Get There\\n...\\n\\n## Their Relationship With Food\\n...\\n\\n## What They Have Tried\\n...\\n\\n## How Failure Feels / How Winning Will Feel\\n...\\n\\n## The Moment Before They Reach For Food\\n...\\n\\n## Their Words\\n- exact phrase 1\\n- exact phrase 2\\n...

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
            max_tokens: 2000,
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
