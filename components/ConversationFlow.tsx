'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type HistoryEntry = { beat: number; userChoice: string }
type MessageParam = { role: 'user' | 'assistant'; content: string }

type MessageTurn = { type: 'message'; state: number; text: string; typingDone: boolean }
type OptionsTurn = { type: 'options'; state: number; items: string[]; chosen: string | null }
type ResolveTurn = { type: 'resolve'; outcome: 'win' | 'continue_to_eat' | 'hold_10'; message: string; summary: string }
type ErrorTurn = { type: 'error'; message: string }
type Turn = MessageTurn | OptionsTurn | ResolveTurn | ErrorTurn

type Props = {
  craving: string
  expectedFeeling: string
  currentFeeling: string
  heldSeconds: number
  onWin: (history: HistoryEntry[], summary: string) => void
  onGiveIn: (history: HistoryEntry[], summary: string) => void
  onHold10: (history: HistoryEntry[], summary: string) => void
}

const chipInactive: React.CSSProperties = {
  background: 'var(--card2)',
  color: 'var(--fg)',
  border: '1px solid var(--border2)',
}
const chipActive: React.CSSProperties = {
  background: 'var(--accent-dim)',
  color: 'var(--accent-text)',
  border: '1px solid rgba(62,207,207,0.4)',
}

function Typewriter({ text, speed = 14, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idx = useRef(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    idx.current = 0
  }, [text])

  useEffect(() => {
    if (!text) { if (!done) { setDone(true); onDoneRef.current?.() } return }
    if (idx.current >= text.length) {
      if (!done) {
        setDone(true)
        onDoneRef.current?.()
      }
      return
    }
    const t = setTimeout(() => {
      setDisplayed(text.slice(0, idx.current + 1))
      idx.current++
    }, speed)
    return () => clearTimeout(t)
  }, [displayed, text, speed, done])

  return (
    <span>
      {displayed}
      {!done && <span style={{ color: 'var(--accent)', fontWeight: 300 }}>▌</span>}
    </span>
  )
}


export default function ConversationFlow({ craving, expectedFeeling, currentFeeling, heldSeconds, onWin, onGiveIn, onHold10 }: Props) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [streaming, setStreaming] = useState(false)
  const fetchingRef = useRef(false)
  const beatRef = useRef(0)
  const stateRef = useRef(1)
  const currentStateRef = useRef(1)
  const lastChoiceRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const resolvedRef = useRef(false)
  const claudeMessagesRef = useRef<MessageParam[]>([])

  const fetchNextTurn = useCallback(async (messages: MessageParam[], _currentHistory: HistoryEntry[]) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setStreaming(true)

    try {
      const res = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ craving, expectedFeeling, currentFeeling, messages }),
      })
      if (!res.ok || !res.body) {
        console.error('converse API error', res.status)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ''
      let rawAssistantOutput = ''
      let hadError = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        lineBuffer += chunk
        rawAssistantOutput += chunk
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()!
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.type === 'message') {
              if (parsed.state) currentStateRef.current = parsed.state
              setTurns(prev => [...prev, { type: 'message', state: parsed.state ?? currentStateRef.current, text: parsed.text, typingDone: false }])
            } else if (parsed.type === 'options') {
              if (parsed.state) currentStateRef.current = parsed.state
              setTurns(prev => [...prev, { type: 'options', state: parsed.state ?? currentStateRef.current, items: parsed.items, chosen: null }])
            } else if (parsed.type === 'resolve') {
              setTurns(prev => [...prev, { type: 'resolve', outcome: parsed.outcome, message: parsed.message, summary: parsed.summary ?? '' }])
            } else if (parsed.type === 'error') {
              hadError = true
              setTurns(prev => [...prev, { type: 'error', message: parsed.message }])
            }
          } catch {
            // incomplete line, ignore
          }
        }
      }

      if (!hadError && rawAssistantOutput.trim()) {
        claudeMessagesRef.current = [...claudeMessagesRef.current, { role: 'assistant', content: rawAssistantOutput.trim() }]
      }
    } catch (e) {
      console.error('converse error', e)
    } finally {
      fetchingRef.current = false
      setStreaming(false)
    }
  }, [craving, expectedFeeling, currentFeeling])

  function buildUserMessage(state: number, choice?: string): string {
    switch (state) {
      case 1:
        return `[State 1 of 5 — GROUND] The person is sitting with a pull toward "${craving}". Right now they feel "${currentFeeling}". They expected it would make them feel "${expectedFeeling}". Output one grounding message (2-4 sentences) that surfaces what is underneath that feeling and connects to their goal. Then output 4 options representing the automatic permission-giving inner voice specific to this craving and feeling. Both the message and options in this single response.`
      case 2:
        return `[State 2 of 5 — AUTOMATIC VOICE] They just read the grounding message. Output 4 options representing the automatic permission-giving inner voice right now — the thoughts that justify, minimise, make resistance feel pointless. Specific to "${craving}" while feeling "${currentFeeling}". First-person inner voice, uncomfortably familiar. Preceded by a single short message (1-2 sentences) acknowledging where they are.`
      case 3:
        return `[State 3 of 5 — QUESTION THE VOICE] They chose: "${choice}". Output a message (2-4 sentences) responding directly to that exact thought — is it really them or a script? Curious, not confrontational. Then output 4 options representing honest responses to that question.`
      case 4:
        return `[State 4 of 5 — MIRROR] They chose: "${choice}". Output a message (2-4 sentences) reflecting their own history back — last time they gave in, last time they held. Use the mirror data from your system prompt. Ask which feeling they want in an hour. Then output 4 options representing honest reactions.`
      case 5:
        return `[State 5 of 5 — CONSCIOUS CHOICE] They chose: "${choice}". Output a short message (2 sentences maximum) naming the shift that happened in this conversation. A recognition, not a summary. Then output exactly 4 options: hold / have it consciously / don't feel like it anymore / hold 10 more minutes. Then immediately the resolve line.`
      default:
        return `[State ${state}] They chose: "${choice}". Continue.`
    }
  }

  // Start on mount
  useEffect(() => {
    stateRef.current = 1
    const opening: MessageParam = {
      role: 'user',
      content: buildUserMessage(1),
    }
    claudeMessagesRef.current = [opening]
    fetchNextTurn([opening], [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom only if near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [turns])

  function handleEnd() {
    const resolve = turns.find(t => t.type === 'resolve') as ResolveTurn | undefined
    if (!resolve) return
    if (resolve.outcome === 'win') onWin(history, resolve.summary)
    else if (resolve.outcome === 'hold_10') onHold10(history, resolve.summary)
    else onGiveIn(history, resolve.summary)
  }

  function markMessageDone(index: number) {
    setTurns(prev => prev.map((t, i) =>
      i === index && t.type === 'message' ? { ...t, typingDone: true } : t
    ))
  }

  function handleChoice(item: string, optionState: number) {
    const optionsTurn = turns.reduceRight<OptionsTurn | null>((found, t) => {
      if (found) return found
      if (t.type === 'options' && t.chosen === null) return t
      return null
    }, null)
    if (!optionsTurn) return

    beatRef.current += 1
    const entry: HistoryEntry = { beat: beatRef.current, userChoice: item }
    const newHistory = [...history, entry]

    setTurns(prev => prev.map(t => t === optionsTurn ? { ...t, chosen: item } : t))
    setHistory(newHistory)

    if (optionState === 5) return

    lastChoiceRef.current = item
    const nextState = optionState + 1
    stateRef.current = nextState

    const userTurn: MessageParam = {
      role: 'user',
      content: buildUserMessage(nextState, item),
    }
    claudeMessagesRef.current = [...claudeMessagesRef.current, userTurn]
    fetchNextTurn(claudeMessagesRef.current, newHistory)
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 340, height: 340,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'var(--accent)',
        animation: 'breathe 6s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: 8, paddingBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
          {heldSeconds}s
        </span>
      </div>

      <div ref={scrollRef} style={{
        position: 'relative', zIndex: 1,
        flex: 1, overflowY: 'auto', padding: '0 20px',
        display: 'flex', flexDirection: 'column', gap: 20,
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      }}>
        {turns.map((turn, i) => {
          if (turn.type === 'message') {
            return (
              <div key={i} className="animate-fade-in" style={{ maxWidth: '92%' }}>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--fg)', margin: 0 }}>
                  <Typewriter text={turn.text ?? ''} speed={11} onDone={() => markMessageDone(i)} />
                </p>
              </div>
            )
          }

          if (turn.type === 'options') {
            const isDone = turn.chosen !== null
            const isActive = !isDone && turns.slice(i + 1).every(t => t.type !== 'options' || t.chosen !== null)
            let precedingDone = true
            for (let j = i - 1; j >= 0; j--) {
              if (turns[j].type === 'message') { precedingDone = (turns[j] as MessageTurn).typingDone; break }
            }
            if (isActive && !precedingDone) return null

            return (
              <div key={i} className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {turn.items.map((item, j) => (
                  <button key={j}
                    onClick={() => isActive && !isDone ? handleChoice(item, turn.state) : undefined}
                    style={{
                      padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                      cursor: isActive && !isDone ? 'pointer' : 'default',
                      border: 'none',
                      opacity: isDone && turn.chosen !== item ? 0.35 : 1,
                      transition: 'opacity 0.2s',
                      ...(turn.chosen === item ? chipActive : chipInactive),
                    }}>
                    {item}
                  </button>
                ))}
              </div>
            )
          }

          if (turn.type === 'resolve') {
            const state5OptionsTurn = turns.slice(0, i).findLast(t => t.type === 'options' && t.state === 5) as OptionsTurn | undefined
            if (!state5OptionsTurn || state5OptionsTurn.chosen === null) return null
            const isWin = turn.outcome === 'win' || turn.outcome === 'hold_10'
            return (
              <div key={i} className="animate-fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 28, color: isWin ? 'var(--accent)' : 'var(--muted)', marginBottom: 12 }}>
                  {turn.outcome === 'win' ? '✦' : turn.outcome === 'hold_10' ? '◎' : '○'}
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--fg)', margin: 0, marginBottom: 24 }}>
                  <Typewriter text={turn.message ?? ''} speed={11} />
                </p>
                <button onClick={handleEnd} style={{
                  padding: '12px 28px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                  background: isWin ? 'var(--accent)' : 'var(--card2)',
                  color: isWin ? 'var(--bg)' : 'var(--fg)',
                  border: 'none', cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}>
                  Done
                </button>
              </div>
            )
          }

          if (turn.type === 'error') {
            return (
              <div key={i} className="animate-fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{turn.message}</p>
                <button onClick={() => {
                  setTurns(prev => prev.filter((_, idx) => idx !== i))
                  fetchNextTurn(claudeMessagesRef.current, history)
                }} style={{
                  padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                  background: 'var(--card2)', color: 'var(--fg)', border: '1px solid var(--border2)', cursor: 'pointer'
                }}>Try again</button>
              </div>
            )
          }

          return null
        })}

        {streaming && turns.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>Present</span>
            <span style={{ color: 'var(--accent)', fontSize: 18, animation: 'pulse-ring 1.5s ease-in-out infinite' }}>▌</span>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 40 }} />
      </div>
    </div>
  )
}
