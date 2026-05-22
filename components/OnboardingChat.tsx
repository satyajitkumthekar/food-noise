'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type MessageParam = { role: 'user' | 'assistant'; content: string }

function Typewriter({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
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
      if (!done) { setDone(true); onDoneRef.current?.() }
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

type Props = { name: string; userId: string }

export default function OnboardingChat({ name, userId }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [typingDone, setTypingDone] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [questionCount, setQuestionCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const claudeMessagesRef = useRef<MessageParam[]>([])
  const rawAssistantRef = useRef('')
  const router = useRouter()
  const supabase = createClient()

  async function fetchNextQuestion(messages: MessageParam[]) {
    setLoading(true)
    setTypingDone(false)
    setError('')
    rawAssistantRef.current = ''

    try {
      const res = await fetch('/api/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, name }),
      })

      if (!res.ok || !res.body) { setError('Something went wrong. Tap to try again.'); setLoading(false); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let lineBuffer = ''
      let finishedWithDone = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        lineBuffer += chunk
        rawAssistantRef.current += chunk
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop()!
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.type === 'question') {
              setCurrentQuestion(parsed.text)
              setQuestionCount(c => c + 1)
            } else if (parsed.type === 'error') {
              setError(parsed.message)
            } else if (parsed.type === 'done' && parsed.profile) {
              finishedWithDone = true
              await saveAndFinish(parsed.profile)
            }
          } catch { /* incomplete line */ }
        }
      }

      // Check remaining buffer for done line (in case it wasn't newline-terminated)
      if (!finishedWithDone && lineBuffer.trim()) {
        try {
          const parsed = JSON.parse(lineBuffer.trim())
          if (parsed.type === 'done' && parsed.profile) {
            finishedWithDone = true
            await saveAndFinish(parsed.profile)
          }
        } catch { /* not valid JSON */ }
      }

      if (!finishedWithDone) {
        claudeMessagesRef.current = [...claudeMessagesRef.current, { role: 'assistant', content: rawAssistantRef.current.trim() }]
      }
    } catch (e) {
      console.error('onboarding-chat error', e)
      setError('Something went wrong. Tap to try again.')
    } finally {
      setLoading(false)
    }
  }

  async function saveAndFinish(personalityMd: string) {
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name,
      personality_md: personalityMd,
    })
    if (error) {
      console.error('profile save error', error)
      setError('Could not save your profile. Please try again.')
      setSaving(false)
      return
    }
    router.push('/')
  }

  useEffect(() => {
    const opening: MessageParam = {
      role: 'user',
      content: `Hi, my name is ${name}. I want to work on my relationship with food.`,
    }
    claudeMessagesRef.current = [opening]
    fetchNextQuestion([opening])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!inputValue.trim() || loading || saving) return
    const answer = inputValue.trim()
    setInputValue('')
    setCurrentQuestion('')

    const userTurn: MessageParam = { role: 'user', content: answer }
    const newMessages = [...claudeMessagesRef.current, userTurn]
    claudeMessagesRef.current = newMessages
    fetchNextQuestion(newMessages)
  }

  if (saving) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)', gap: 16 }}>
        <div style={{ fontSize: 28, color: 'var(--accent)' }}>◎</div>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Building your profile...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '48px 24px 32px', background: 'var(--bg)' }}>
      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--muted)' }}>
          {questionCount > 0 ? `${questionCount} of 7` : ''}
        </span>
      </div>

      {/* Question */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {loading && !currentQuestion ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: 18, animation: 'pulse-ring 1.5s ease-in-out infinite' }}>▌</span>
          </div>
        ) : (
          <h2 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.5, color: 'var(--fg)', margin: 0, marginBottom: 40 }}>
            <Typewriter text={currentQuestion} speed={16} onDone={() => setTypingDone(true)} />
          </h2>
        )}

        {/* Input — appears after typing done */}
        {typingDone && (
          <div className="animate-fade-in">
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Type your answer..."
              rows={4}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12, resize: 'none',
                background: 'var(--card2)', border: '1px solid var(--border2)',
                color: 'var(--fg)', caretColor: 'var(--accent)',
                fontSize: 16, outline: 'none', boxSizing: 'border-box',
                lineHeight: 1.6,
              } as React.CSSProperties}
            />
            {error && (
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Continue button */}
      {typingDone && (
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || loading}
          className="animate-fade-in"
          style={{
            width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600,
            fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none',
            cursor: !inputValue.trim() || loading ? 'default' : 'pointer',
            opacity: !inputValue.trim() || loading ? 0.35 : 1,
            transition: 'opacity 0.2s', marginTop: 16,
          }}>
          Continue
        </button>
      )}
    </div>
  )
}
