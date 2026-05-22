'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  giveIn: {
    id: string
    craving: string | null
    current_feeling: string | null
    expected_feeling: string | null
  }
  onDone: () => void
  onDismiss: () => void
}

type Step = 'confirm' | 'didnt_have_it' | 'worth_it' | 'after_feeling' | 'done'

const WORTH_IT_OPTIONS = ['Not really', 'Kind of', 'Yeah, worth it']
const DIDNT_HAVE_FEELINGS = ['Proud', 'Relieved', 'In control', 'Calm', 'Strong', 'Surprised']

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border2)',
  color: 'var(--fg)',
  caretColor: 'var(--accent)',
  fontSize: 16,
  WebkitAppearance: 'none',
  outline: 'none',
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

export default function FoodCheckIn({ giveIn, onDone, onDismiss }: Props) {
  const [step, setStep] = useState<Step>('confirm')
  const [worthIt, setWorthIt] = useState('')
  const [afterFeeling, setAfterFeeling] = useState('')
  const [didntHaveFeeling, setDidntHaveFeeling] = useState('')
  const [customFeeling, setCustomFeeling] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // They actually DID have it — save after_feeling + worth_it
  async function handleSaveGaveIn() {
    if (!afterFeeling.trim()) return
    setSaving(true)
    await supabase.from('urges').update({
      worth_it: worthIt === 'Yeah, worth it',
      after_feeling: afterFeeling.trim(),
    }).eq('id', giveIn.id)
    await fetch('/api/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgeId: giveIn.id }),
    })
    setSaving(false)
    setStep('done')
  }

  // They actually didn't have it — flip gave_in to false, save won_feeling
  async function handleSaveDidntHaveIt() {
    const feeling = customFeeling.trim() || didntHaveFeeling
    if (!feeling) return
    setSaving(true)
    await supabase.from('urges').update({
      gave_in: false,
      won_feeling: feeling,
      held_seconds: null,
    }).eq('id', giveIn.id)
    await fetch('/api/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgeId: giveIn.id }),
    })
    setSaving(false)
    setStep('done')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.7)', zIndex: 50 }}>
      <div className="animate-fade-in" style={{ borderRadius: '24px 24px 0 0', padding: '12px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border2)', margin: '4px auto 8px' }} />

        {/* CONFIRM — did you have it? */}
        {step === 'confirm' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Loop check-in</p>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.4 }}>
              You had a craving for <span style={{ color: 'var(--accent-text)' }}>{giveIn.craving}</span>. Did you end up having it?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setStep('worth_it')}
                style={{ width: '100%', padding: '14px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                Yes, I had it
              </button>
              <button onClick={() => setStep('didnt_have_it')}
                style={{ width: '100%', padding: '14px', borderRadius: 14, fontWeight: 500, fontSize: 14, background: 'transparent', color: 'var(--fg2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Actually, I didn&apos;t have it
              </button>
              <button onClick={onDismiss}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', padding: '8px 0' }}>
                Remind me later
              </button>
            </div>
          </>
        )}

        {/* DIDN'T HAVE IT — flip to a win, capture feeling */}
        {step === 'didnt_have_it' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>That&apos;s a win</p>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>How did it feel to hold?</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {DIDNT_HAVE_FEELINGS.map(f => (
                <button key={f} onClick={() => { setDidntHaveFeeling(f); setCustomFeeling('') }}
                  style={{ padding: '9px 15px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', ...(didntHaveFeeling === f && !customFeeling ? chipActive : chipInactive) }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={customFeeling}
                onChange={e => { setCustomFeeling(e.target.value); setDidntHaveFeeling('') }}
                placeholder="Something else…"
                style={{ ...inputStyle, flex: 1, padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={handleSaveDidntHaveIt} disabled={saving || (!didntHaveFeeling && !customFeeling.trim())}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--success)', color: '#000', border: 'none', cursor: 'pointer', opacity: saving || (!didntHaveFeeling && !customFeeling.trim()) ? 0.4 : 1 }}>
              {saving ? 'Saving…' : 'Save this win ✓'}
            </button>
          </>
        )}

        {/* WORTH IT */}
        {step === 'worth_it' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Honest check</p>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Was it worth it?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {WORTH_IT_OPTIONS.map(opt => (
                <button key={opt} onClick={() => { setWorthIt(opt); setStep('after_feeling') }}
                  style={{ width: '100%', padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', ...chipInactive }}>
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}

        {/* AFTER FEELING */}
        {step === 'after_feeling' && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your mirror</p>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>How do you feel now that you&apos;ve had it?</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Be honest. This is what you&apos;ll see next time this craving hits.</p>
            <textarea
              value={afterFeeling} onChange={e => setAfterFeeling(e.target.value)}
              placeholder="How do you actually feel right now?"
              rows={3} autoFocus
              style={{ ...inputStyle, width: '100%', padding: '14px 16px', borderRadius: 12, resize: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={handleSaveGaveIn} disabled={!afterFeeling.trim() || saving}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', opacity: !afterFeeling.trim() || saving ? 0.4 : 1 }}>
              {saving ? 'Saving…' : 'Done'}
            </button>
          </>
        )}

        {/* DONE */}
        {step === 'done' && (
          <>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 12 }}>✦</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>Logged. That took honesty.</h3>
              <p style={{ fontSize: 13, color: 'var(--fg2)' }}>Your words will be here for you next time this craving comes.</p>
            </div>
            <button onClick={onDone}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--card2)', color: 'var(--fg)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}
