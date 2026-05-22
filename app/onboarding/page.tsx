'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const steps = [
  {
    field: 'name',
    question: "What should I call you?",
    hint: "First name is fine.",
    placeholder: "Your name",
  },
  {
    field: 'goal',
    question: "What is your goal?",
    hint: "In your own words.",
    placeholder: "e.g. Stop binge eating and feel in control around food",
    multiline: true,
  },
  {
    field: 'why_it_matters',
    question: "Why does it matter to you?",
    hint: "The real reason — not the one you tell other people.",
    placeholder: "e.g. I'm tired of feeling ashamed. I want to like myself again.",
    multiline: true,
  },
  {
    field: 'what_changes',
    question: "What changes when you get there?",
    hint: "Paint the picture. What does life look like?",
    placeholder: "e.g. I wake up without dread. I can eat with my family and feel normal.",
    multiline: true,
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState({ name: '', goal: '', why_it_matters: '', what_changes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const current = steps[step]
  const value = values[current.field as keyof typeof values]
  const isLast = step === steps.length - 1

  function handleChange(v: string) {
    setValues(prev => ({ ...prev, [current.field]: v }))
  }

  async function handleNext() {
    if (!value.trim()) return
    if (!isLast) { setStep(s => s + 1); return }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }

    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: user.id,
      name: values.name,
      goal: values.goal,
      why_it_matters: values.why_it_matters,
      what_changes: values.what_changes,
    })
    if (upsertErr) { setError(upsertErr.message); setLoading(false); return }

    await fetch('/api/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: true, ...values }),
    })

    router.push('/')
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-dvh px-6 py-10" style={{ background: 'var(--bg)' }}>
      {/* Progress */}
      <div className="flex gap-1.5 mb-12">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= step ? 'var(--accent)' : 'var(--border2)' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center animate-fade-in" key={step}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--muted)' }}>
          {current.hint}
        </p>
        <h2 className="text-2xl font-semibold mb-6 leading-snug" style={{ color: 'var(--fg)' }}>
          {current.question}
        </h2>

        {current.multiline ? (
          <textarea
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder={current.placeholder}
            rows={4}
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, resize: 'none',
              background: 'var(--card2)', border: '1px solid var(--border2)',
              color: 'var(--fg)', caretColor: 'var(--accent)',
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
            } as React.CSSProperties}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder={current.placeholder}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12,
              background: 'var(--card2)', border: '1px solid var(--border2)',
              color: 'var(--fg)', caretColor: 'var(--accent)',
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
            } as React.CSSProperties}
          />
        )}

        {/* Descriptive hint */}
        <p className="text-xs mt-3 px-1" style={{ color: 'var(--muted)' }}>
          ✦ The more specific you are, the stronger your mirror becomes.
        </p>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <button
        onClick={handleNext}
        disabled={!value.trim() || loading}
        className="w-full py-4 rounded-2xl font-semibold text-sm mt-8 transition-opacity"
        style={{ background: 'var(--accent)', color: '#000', opacity: !value.trim() || loading ? 0.35 : 1 }}
      >
        {loading ? 'Setting up...' : isLast ? 'Begin' : 'Continue'}
      </button>
    </div>
  )
}
