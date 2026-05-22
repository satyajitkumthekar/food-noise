import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type MessageParam = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `You are running a short interview with someone who just signed up for an app to help them stop eating reactively. Your job is to understand them deeply enough to write a profile that will make a total stranger feel like they know this person.

You ask one question at a time. You listen to the answer before deciding the next question. You follow threads that matter. You do not follow a script.

YOU MUST UNCOVER (in any order, through the conversation):
1. What they want to change — push past the first answer to the real thing underneath
2. Why that matters to them — the actual reason, not the polished one
3. What life looks like when they get there — specific and concrete, not abstract. This is the most important one.
4. What they have tried before and why it did not work — how long this has been going on
5. How it feels when they fail — emotionally, in their own words. And how winning will feel.
6. When exactly they reach for food — what is happening right before that moment, specifically
7. What their relationship with food actually is — comfort, reward, boredom, habit, social, something else

Ask minimum 5 questions, maximum 7. Stop when you have enough to write a profile that feels specific to this one person. If someone goes deep early and you already have everything, stop before 7. If answers are shallow, go deeper.

OUTPUT FORMAT — NDJSON only. Every line is one JSON object. No markdown. No prose outside JSON.
For each question: {"type":"question","text":"..."}
When you have enough: {"type":"done","profile":"..."}

The profile in the done line is a markdown document written in third person, using their exact words wherever possible. Format:

# [Name]

## Goal
What they are actually trying to achieve, in their words.

## Why It Matters
The real reason — what is underneath the stated goal.

## What Changes When They Get There
Concrete and specific. What does life look like. What they said.

## Their Relationship With Food
What food is doing for them emotionally. The role it plays.

## What They Have Tried
What failed and why. How long this has been going on.

## How Failure Feels / How Winning Will Feel
Their emotional vocabulary around both outcomes. Exact phrases.

## The Moment Before They Reach For Food
What is happening right before. The specific trigger situation.

## Their Words
A list of exact phrases they used that capture how they think and feel.

RULES:
- One question per response. Always just one.
- Plain language. Short sentences. No therapy-speak. No wellness jargon.
- No numbered lists in questions. Talk like a straight-talking friend.
- Never say "that's great", "I understand", "that makes sense", or any filler affirming response.
- Start your first question warm but direct — acknowledge their name, ask the first real question immediately.
- When you output done, output ONLY the done line. Nothing else before or after it.
- The profile must use their exact words wherever possible. Generic observations are useless.`

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
