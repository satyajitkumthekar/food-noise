'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import OnboardingChat from '@/components/OnboardingChat'

type Step = 'intro' | 'name'

const INTRO_CARDS: { icon: string; title: string; body: string }[] = [
  {
    icon: '◎',
    title: 'When a craving hits, open this',
    body: "Tap \"I have a craving.\" Talk it through with the app before you eat. The point isn't to stop you — it's to make sure whatever happens next is a conscious choice, not a reflex.",
  },
  {
    icon: '⊞',
    title: 'Log what you eat',
    body: "Every meal gets logged here, with calories and protein counted for you. You can't improve what you can't see, and just watching the numbers honestly builds awareness on its own. A photo with a quick description, or one sentence — whatever's easiest, but log it every time.",
  },
  {
    icon: '◐',
    title: 'Be honest with it',
    body: 'There are no streaks to protect and no scores to chase. The mirror reflects what you give it. The more truth you bring — about what you ate, what you felt, what actually happened — the more useful this becomes for you.',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('intro')
  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleStart() {
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }
    setUserId(user.id)
    setStarted(true)
    setLoading(false)
  }

  if (started && userId) {
    return <OnboardingChat name={name.trim()} userId={userId} />
  }

  if (step === 'intro') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '48px 24px 32px', background: 'var(--bg)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 12 }}>◎</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Crave</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.05em' }}>Your accountability mirror</p>
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14, textAlign: 'center' }}>
            A few things before we start
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {INTRO_CARDS.map(card => (
              <div key={card.title}
                style={{ padding: '16px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, color: 'var(--accent)', lineHeight: 1 }}>{card.icon}</span>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>{card.title}</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.65, margin: 0 }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, padding: '0 4px 20px', textAlign: 'center' }}>
            Take your time on the next few questions — the more detailed your answers, the better this works for you. Spend ten honest minutes here. It&apos;s for you.
          </p>
        </div>

        <button
          onClick={() => setStep('name')}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600,
            fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none',
            cursor: 'pointer',
          }}>
          Got it
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '48px 24px 32px', background: 'var(--bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 12 }}>◎</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Crave</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, letterSpacing: '0.05em' }}>Your accountability mirror</p>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>What should I call you?</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>First name is fine.</p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'var(--card2)', border: '1px solid var(--border2)',
            color: 'var(--fg)', caretColor: 'var(--accent)',
            fontSize: 16, outline: 'none', boxSizing: 'border-box',
          } as React.CSSProperties}
        />
        {error && <p style={{ fontSize: 13, color: '#f87171', marginTop: 8 }}>{error}</p>}
      </div>

      <button
        onClick={handleStart}
        disabled={!name.trim() || loading}
        style={{
          width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600,
          fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none',
          cursor: !name.trim() || loading ? 'default' : 'pointer',
          opacity: !name.trim() || loading ? 0.35 : 1,
          transition: 'opacity 0.2s',
        }}>
        {loading ? '...' : 'Begin'}
      </button>
    </div>
  )
}
