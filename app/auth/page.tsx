'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl mb-4" style={{ color: 'var(--accent)' }}>◎</div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>Crave</h1>
          <p className="mt-2 text-xs tracking-widest uppercase font-medium" style={{ color: 'var(--muted)' }}>Your accountability mirror</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--card2)',
              border: '1px solid var(--border2)',
              color: 'var(--fg)',
              caretColor: 'var(--accent)',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--card2)',
              border: '1px solid var(--border2)',
              color: 'var(--fg)',
              caretColor: 'var(--accent)',
            }}
          />
          {error && <p className="text-sm text-red-400 px-1">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-sm mt-1 transition-opacity"
            style={{ background: 'var(--accent)', color: '#000', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--muted)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="underline"
            style={{ color: 'var(--accent-text)' }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
