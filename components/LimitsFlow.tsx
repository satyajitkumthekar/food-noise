'use client'

import { useState } from 'react'
import type { ActivityLevel, GoalMode, LimitsInputs } from '@/lib/database.types'

type Props = {
  initial?: LimitsInputs | null
  onComplete: (kcal_target: number, protein_target: number) => void
  onClose: () => void
}

type Step = 'gender' | 'age' | 'height' | 'weight' | 'activity' | 'goal' | 'result'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sitting', label: 'Mostly sitting', desc: 'Desk job. Maybe a short walk here and there, but most of the day is sitting. No real workouts.' },
  { value: 'moderate', label: 'Moderately active', desc: '8,000+ steps daily, OR 3–4 hard training sessions a week. You sweat regularly.' },
  { value: 'very', label: 'Very active', desc: '10,000+ steps daily AND 5 or more workouts a week, or a physically demanding job (trades, hospitality on your feet all day).' },
]

const GOAL_OPTIONS: { value: GoalMode; label: string; desc: string }[] = [
  { value: 'craving_control', label: 'Craving control', desc: 'Learning to pause. Eating won\'t change much, but your relationship to it will.' },
  { value: 'lose_weight', label: 'Lose weight', desc: 'Eating a bit less than you burn, on average. A modest 350 kcal deficit — sustainable, not punishing.' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border2)',
  color: 'var(--fg)',
  caretColor: 'var(--accent)',
  fontSize: 18,
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

export default function LimitsFlow({ initial, onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>('gender')
  const [gender, setGender] = useState<'male' | 'female' | ''>(initial?.gender ?? '')
  const [age, setAge] = useState(initial?.age?.toString() ?? '')
  const [heightCm, setHeightCm] = useState(initial?.height_cm?.toString() ?? '')
  const [weightKg, setWeightKg] = useState(initial?.weight_kg?.toString() ?? '')
  const [activity, setActivity] = useState<ActivityLevel | ''>(initial?.activity ?? '')
  const [goalMode, setGoalMode] = useState<GoalMode | ''>(initial?.goal_mode ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ kcal: number; protein: number; goalMode: GoalMode } | null>(null)

  function pickGender(g: 'male' | 'female') {
    setGender(g)
    setTimeout(() => setStep('age'), 150)
  }

  async function submit(chosenGoal: GoalMode) {
    setError('')
    const ageN = parseInt(age, 10)
    const hN = parseFloat(heightCm)
    const wN = parseFloat(weightKg)
    if (!gender || !ageN || !hN || !wN || !activity || !chosenGoal) {
      setError('Something is missing')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/calculate-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender, age: ageN, height_cm: hN, weight_kg: wN, activity, goal_mode: chosenGoal,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not calculate')
        setSaving(false)
        return
      }
      setResult({ kcal: data.kcal_target, protein: data.protein_target, goalMode: chosenGoal })
      setStep('result')
    } catch (e) {
      console.error('calculate-limits error', e)
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function pickGoal(g: GoalMode) {
    setGoalMode(g)
    submit(g)
  }

  function finish() {
    if (result) onComplete(result.kcal, result.protein)
  }

  const stepNum: Record<Step, number> = { gender: 1, age: 2, height: 3, weight: 4, activity: 5, goal: 6, result: 7 }
  const totalSteps = 6

  return (
    <div style={{ position: 'fixed', inset: 0, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.7)', zIndex: 60 }}>
      <div className="animate-fade-in" style={{ borderRadius: '24px 24px 0 0', padding: '12px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92dvh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border2)', margin: '4px auto 8px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Daily limits {step !== 'result' && `· ${stepNum[step]} of ${totalSteps}`}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {step === 'gender' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Are you male or female?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>BMR math differs slightly. Pick what fits.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => pickGender('male')}
                style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: 'none', ...(gender === 'male' ? chipActive : chipInactive) }}>
                Male
              </button>
              <button onClick={() => pickGender('female')}
                style={{ flex: 1, padding: '16px', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: 'none', ...(gender === 'female' ? chipActive : chipInactive) }}>
                Female
              </button>
            </div>
          </>
        )}

        {step === 'age' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>How old are you?</h3>
            <input type="number" inputMode="numeric" value={age} onChange={e => setAge(e.target.value)}
              placeholder="Age"
              autoFocus
              style={{ ...inputStyle, width: '100%', padding: '16px 18px', borderRadius: 14, boxSizing: 'border-box' }} />
            <button onClick={() => age && parseInt(age, 10) > 0 ? setStep('height') : null} disabled={!age}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: age ? 'pointer' : 'not-allowed', opacity: age ? 1 : 0.4 }}>
              Next
            </button>
          </>
        )}

        {step === 'height' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Your height?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>In centimetres.</p>
            <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)}
              placeholder="e.g. 175"
              autoFocus
              style={{ ...inputStyle, width: '100%', padding: '16px 18px', borderRadius: 14, boxSizing: 'border-box' }} />
            <button onClick={() => heightCm && parseFloat(heightCm) > 0 ? setStep('weight') : null} disabled={!heightCm}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: heightCm ? 'pointer' : 'not-allowed', opacity: heightCm ? 1 : 0.4 }}>
              Next
            </button>
          </>
        )}

        {step === 'weight' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Your weight?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>In kilograms. Today&apos;s number — no need to be precise.</p>
            <input type="number" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)}
              placeholder="e.g. 72"
              autoFocus
              style={{ ...inputStyle, width: '100%', padding: '16px 18px', borderRadius: 14, boxSizing: 'border-box' }} />
            <button onClick={() => weightKg && parseFloat(weightKg) > 0 ? setStep('activity') : null} disabled={!weightKg}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: weightKg ? 'pointer' : 'not-allowed', opacity: weightKg ? 1 : 0.4 }}>
              Next
            </button>
          </>
        )}

        {step === 'activity' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>How active are you, honestly?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Most people pick higher than the truth. Pick the one that actually describes most weeks.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACTIVITY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setActivity(opt.value)}
                  style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', border: 'none',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    ...(activity === opt.value ? chipActive : chipInactive),
                  }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
            <button onClick={() => activity ? setStep('goal') : null} disabled={!activity}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: activity ? 'pointer' : 'not-allowed', opacity: activity ? 1 : 0.4 }}>
              Next
            </button>
          </>
        )}

        {step === 'goal' && (
          <>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>What are you here for?</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Pick one. You can change it later from your profile.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GOAL_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => pickGoal(opt.value)} disabled={saving}
                  style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: saving ? 'wait' : 'pointer', border: 'none',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    opacity: saving && goalMode !== opt.value ? 0.4 : 1,
                    ...(goalMode === opt.value ? chipActive : chipInactive),
                  }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
            {saving && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Calculating…</p>}
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 8 }}>◎</div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>Here are your limits.</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>You can recalculate anytime from your profile.</p>
              <div style={{ marginTop: 12, display: 'inline-block', padding: '6px 12px', borderRadius: 999, background: 'var(--accent-dim)', border: '1px solid rgba(62,207,207,0.25)', fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', letterSpacing: '0.04em' }}>
                {result.goalMode === 'lose_weight' ? 'Lose weight · −350 kcal deficit' : 'Craving control · maintenance'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, padding: '20px 16px', borderRadius: 14, background: 'var(--card2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Calories</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)' }}>{result.kcal}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>kcal / day</p>
              </div>
              <div style={{ flex: 1, padding: '20px 16px', borderRadius: 14, background: 'var(--card2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Protein</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)' }}>{result.protein}g</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>/ day</p>
              </div>
            </div>
            <button onClick={finish}
              style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 600, fontSize: 15, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
              Looks good
            </button>
          </>
        )}
      </div>
    </div>
  )
}
