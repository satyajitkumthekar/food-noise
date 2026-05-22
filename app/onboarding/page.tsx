'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import OnboardingChat from '@/components/OnboardingChat'

export default function OnboardingPage() {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '48px 24px 32px', background: 'var(--bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 12 }}>◎</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Urge</h1>
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
