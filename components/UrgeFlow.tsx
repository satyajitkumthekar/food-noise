'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ConversationFlow from './ConversationFlow'

type Profile = {
  goal: string | null
  why_it_matters: string | null
  what_changes: string | null
  personality_md: string | null
}

type Props = {
  profile: Profile
  userId: string
}

type FlowStep = 'craving' | 'expected_feeling' | 'current_feeling' | 'conversing' | 'win' | 'give_in' | 'hold_10'

type HistoryEntry = { beat: number; userChoice: string }

const CRAVING_OPTIONS = [
  'Sweets', 'Chips / crisps', 'Fast food', 'Bread / carbs',
  'Chocolate', 'Ice cream', 'Pizza', 'Leftovers',
]
const EXPECTED_FEELINGS = ['Relieved', 'Comforted', 'Happy', 'Calm', 'Numb', 'Distracted']
const CURRENT_FEELINGS = ['Stressed', 'Anxious', 'Lonely', 'Bored', 'Sad', 'Angry', 'Exhausted', 'Empty']
const WON_FEELINGS = ['I beat it', 'In control', 'Proud', 'Relieved', 'Calm', 'Strong', 'Clear-headed']

const chipActive: React.CSSProperties = { background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid rgba(62,207,207,0.4)' }
const chipInactive: React.CSSProperties = { background: 'var(--card)', color: 'var(--fg2)', border: '1px solid var(--border)' }

const inputStyle: React.CSSProperties = {
  background: 'var(--card2)',
  border: '1px solid var(--border2)',
  color: 'var(--fg)',
  caretColor: 'var(--accent)',
  WebkitAppearance: 'none',
  fontSize: 16,
  outline: 'none',
}

function DescriptiveHint() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid rgba(62,207,207,0.2)' }}>
      ✦ More detail = stronger mirror
    </span>
  )
}

export default function UrgeFlow({ profile, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FlowStep>('craving')
  const [craving, setCraving] = useState('')
  const [customCraving, setCustomCraving] = useState('')
  const [expectedFeeling, setExpectedFeeling] = useState('')
  const [currentFeeling, setCurrentFeeling] = useState('')
  const [currentFeelingWhy, setCurrentFeelingWhy] = useState('')
  const [wonFeeling, setWonFeeling] = useState('')
  const [customWonFeeling, setCustomWonFeeling] = useState('')
  const [heldSeconds, setHeldSeconds] = useState(0)
  const [urgeId, setUrgeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sitInterval = useRef<ReturnType<typeof setInterval>>(null)

  const finalCraving = craving === '__custom__' ? customCraving : craving
  const finalWonFeeling = wonFeeling === '__custom__' ? customWonFeeling : wonFeeling

  // Timer runs during conversing step
  useEffect(() => {
    if (step !== 'conversing') return
    sitInterval.current = setInterval(() => setHeldSeconds(s => s + 1), 1000)
    return () => { if (sitInterval.current) clearInterval(sitInterval.current) }
  }, [step])

  function selectCraving(opt: string) {
    setCraving(opt)
    setCustomCraving('')
    setTimeout(() => setStep('expected_feeling'), 120)
  }

  function selectExpectedFeeling(f: string) {
    setExpectedFeeling(f)
    setTimeout(() => setStep('current_feeling'), 120)
  }

  function selectCurrentFeeling(f: string) {
    setCurrentFeeling(f)
  }

  async function startSit() {
    setSaving(true)
    const combined = currentFeelingWhy ? `${currentFeeling} — ${currentFeelingWhy}` : currentFeeling
    const { data, error } = await supabase.from('urges').insert({
      user_id: userId,
      craving: finalCraving,
      expected_feeling: expectedFeeling,
      current_feeling: combined,
    }).select('id').single()
    if (!error && data) setUrgeId((data as { id: string }).id)
    setSaving(false)
    setStep('conversing')
  }

  async function handleConversationWin(history: HistoryEntry[], summary: string) {
    if (!urgeId) return
    await supabase.from('urges').update({
      gave_in: false,
      held_seconds: heldSeconds,
      conversation_log: history,
      summary,
    }).eq('id', urgeId)
    setStep('win')
  }

  async function handleConversationGiveIn(history: HistoryEntry[], summary: string) {
    if (!urgeId) return
    await supabase.from('urges').update({
      gave_in: true,
      held_seconds: heldSeconds,
      conversation_log: history,
      summary,
    }).eq('id', urgeId)
    setStep('give_in')
  }

  async function handleConversationHold10(history: HistoryEntry[], summary: string) {
    if (!urgeId) return
    // Pessimistic assumption — mark as gave_in so the food log banner appears.
    // The banner has "Actually I didn't have it" to flip this retroactively.
    await supabase.from('urges').update({
      gave_in: true,
      held_seconds: heldSeconds,
      conversation_log: history,
      summary,
    }).eq('id', urgeId)
    setStep('hold_10')
  }

  async function handleWin(feeling: string) {
    if (!urgeId) return
    setSaving(true)
    setWonFeeling(feeling)
    await supabase.from('urges').update({
      won_feeling: feeling,
      completed_at: new Date().toISOString(),
    }).eq('id', urgeId)
    // Urge loop is now complete — update personality
    fetch('/api/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urgeId }),
    })
    setSaving(false)
  }

  async function handleWinCustom() {
    if (!customWonFeeling.trim() || !urgeId) return
    await handleWin(customWonFeeling.trim())
  }

  const stepLabels: Partial<Record<FlowStep, string>> = {
    craving: '1 of 3',
    expected_feeling: '2 of 3',
    current_feeling: '3 of 3',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, maxWidth: 480, margin: '0 auto',
      display: 'flex', flexDirection: 'column', background: 'var(--bg)',
      overflowY: step === 'conversing' ? 'hidden' : 'auto',
      WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 20px 12px', flexShrink: 0 }}>
        <button onClick={() => router.push('/')}
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ✕ Exit
        </button>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {stepLabels[step] ?? ''}
        </div>
      </div>

      <div style={{ flex: 1, padding: step === 'conversing' ? '0' : '0 20px 40px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* CRAVING */}
        {step === 'craving' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', marginTop: 8, marginBottom: 4 }}>What do you feel like having?</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Tap to select — or describe it yourself below.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CRAVING_OPTIONS.map(opt => (
                <button key={opt} onClick={() => selectCraving(opt)}
                  style={{ padding: '9px 15px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', ...(craving === opt ? chipActive : chipInactive) }}>
                  {opt}
                </button>
              ))}
            </div>
            <input type="text" value={customCraving}
              onChange={e => { setCustomCraving(e.target.value); setCraving('__custom__') }}
              placeholder="Something else? Type it here…"
              style={{ ...inputStyle, width: '100%', padding: '14px 16px', borderRadius: 12, marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ marginBottom: 20 }}><DescriptiveHint /></div>
            <div style={{ flex: 1 }} />
            {craving === '__custom__' && customCraving.trim() && (
              <button onClick={() => setStep('expected_feeling')}
                style={{ width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                Next
              </button>
            )}
          </div>
        )}

        {/* EXPECTED FEELING */}
        {step === 'expected_feeling' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', marginTop: 8, marginBottom: 4 }}>How will eating this make you feel?</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>The feeling you&apos;re reaching for.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EXPECTED_FEELINGS.map(f => (
                <button key={f} onClick={() => selectExpectedFeeling(f)}
                  style={{ padding: '9px 15px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', ...(expectedFeeling === f ? chipActive : chipInactive) }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CURRENT FEELING */}
        {step === 'current_feeling' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg)', marginTop: 8, marginBottom: 4 }}>How are you feeling right now?</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>What&apos;s underneath.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CURRENT_FEELINGS.map(f => (
                <button key={f} onClick={() => selectCurrentFeeling(f)}
                  style={{ padding: '9px 15px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', ...(currentFeeling === f ? chipActive : chipInactive) }}>
                  {f}
                </button>
              ))}
            </div>
            {currentFeeling && (
              <div className="animate-fade-fast" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>What&apos;s making you feel this way?</p>
                <textarea value={currentFeelingWhy} onChange={e => setCurrentFeelingWhy(e.target.value)}
                  placeholder="Be specific — this becomes your mirror next time…"
                  rows={3} autoFocus
                  style={{ ...inputStyle, width: '100%', padding: '14px 16px', borderRadius: 12, resize: 'none', boxSizing: 'border-box' }} />
                <DescriptiveHint />
              </div>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={startSit} disabled={!currentFeeling || saving}
              style={{ width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: currentFeeling && !saving ? 'pointer' : 'not-allowed', opacity: currentFeeling && !saving ? 1 : 0.35 }}>
              {saving ? 'Starting…' : 'Sit with it'}
            </button>
          </div>
        )}

        {/* CONVERSING — full dynamic dialogue */}
        {step === 'conversing' && (
          <ConversationFlow
            craving={finalCraving}
            expectedFeeling={expectedFeeling}
            currentFeeling={currentFeeling}
            heldSeconds={heldSeconds}
            onWin={handleConversationWin}
            onGiveIn={handleConversationGiveIn}
            onHold10={handleConversationHold10}
          />
        )}

        {/* WIN — pick feeling */}
        {step === 'win' && !wonFeeling && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 16 }}>✦</div>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>You held, and it passed.</h2>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>That&apos;s the rep.</p>
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>How do you feel?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {WON_FEELINGS.map(f => (
                <button key={f} onClick={() => handleWin(f)} disabled={saving}
                  style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', ...chipInactive }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={customWonFeeling} onChange={e => setCustomWonFeeling(e.target.value)}
                placeholder="Something else…"
                onKeyDown={e => e.key === 'Enter' && handleWinCustom()}
                style={{ ...inputStyle, flex: 1, padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box' }} />
              {customWonFeeling.trim() && (
                <button onClick={handleWinCustom} disabled={saving}
                  style={{ padding: '12px 18px', borderRadius: 12, fontWeight: 600, fontSize: 14, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                  Done
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'win' && wonFeeling && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20, padding: '0 0 40px' }}>
            <div style={{ fontSize: 40, color: 'var(--accent)' }}>✦</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--success)' }}>Rep done.</h2>
            <p style={{ fontSize: 15, color: 'var(--fg2)' }}>{finalWonFeeling}.</p>
            <button onClick={() => router.push('/')}
              style={{ width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600, fontSize: 15, background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', cursor: 'pointer', marginTop: 16 }}>
              Back home
            </button>
          </div>
        )}

        {/* GIVE IN */}
        {step === 'give_in' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20, padding: '0 0 40px' }}>
            <div style={{ fontSize: 28, color: 'var(--muted)' }}>○</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Noted. No judgement.</h2>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--fg2)' }}>
              When you eat it, log it in the Food tab.<br />That&apos;s where you&apos;ll close the loop.
            </p>
            <button onClick={() => router.push('/')}
              style={{ width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600, fontSize: 15, background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', cursor: 'pointer', marginTop: 16 }}>
              Back home
            </button>
          </div>
        )}

        {/* HOLD 10 */}
        {step === 'hold_10' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20, padding: '0 0 40px' }}>
            <div style={{ fontSize: 28, color: 'var(--accent)' }}>◎</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>10 more minutes.</h2>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--fg2)' }}>
              If you end up having it, log it in the Food tab.<br />
              If you don&apos;t, mark it there too. Either way, the loop closes.
            </p>
            <button onClick={() => router.push('/')}
              style={{ width: '100%', padding: '16px', borderRadius: 16, fontWeight: 600, fontSize: 15, background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)', cursor: 'pointer', marginTop: 16 }}>
              Back home
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
