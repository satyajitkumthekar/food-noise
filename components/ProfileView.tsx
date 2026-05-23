'use client'

import { useEffect, useState } from 'react'
import type { GoalMode, LimitsInputs } from '@/lib/database.types'
import LimitsFlow from './LimitsFlow'

type Props = {
  name: string | null
  personalityMd: string | null
  kcalTarget: number | null
  proteinTarget: number | null
  limitsInputs: LimitsInputs | null
  goalMode: GoalMode | null
  insightMd: string | null
  insightUpdatedAt: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function ProfileView({
  name, personalityMd,
  kcalTarget, proteinTarget,
  limitsInputs, goalMode,
  insightMd, insightUpdatedAt,
}: Props) {
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [kcalT, setKcalT] = useState(kcalTarget)
  const [proteinT, setProteinT] = useState(proteinTarget)
  const [goalM, setGoalM] = useState(goalMode)
  const [insight, setInsight] = useState(insightMd)
  const [insightAt, setInsightAt] = useState(insightUpdatedAt)
  const [insightLoading, setInsightLoading] = useState(false)
  const [rateLimitedMsg, setRateLimitedMsg] = useState<string | null>(null)

  // If no insight yet but we have a personality profile, generate one on first visit.
  // The server still rate-limits, but the first-ever generation will go through.
  useEffect(() => {
    if (!insight && personalityMd) {
      refreshInsight()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function formatRetryAfter(ms: number): string {
    const hours = Math.ceil(ms / (60 * 60 * 1000))
    if (hours <= 1) return 'in about an hour'
    return `in about ${hours} hours`
  }

  async function refreshInsight() {
    if (insightLoading) return
    setRateLimitedMsg(null)
    setInsightLoading(true)
    try {
      const res = await fetch('/api/insight', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setInsight(data.insight_md ?? null)
        setInsightAt(new Date().toISOString())
      } else if (res.status === 429) {
        // Server says we hit the 1/day cap. Keep existing insight visible.
        if (data.insight_md) setInsight(data.insight_md)
        if (data.insight_updated_at) setInsightAt(data.insight_updated_at)
        const when = typeof data.retryAfterMs === 'number' ? formatRetryAfter(data.retryAfterMs) : 'tomorrow'
        setRateLimitedMsg(`Already refreshed today. You can refresh again ${when}.`)
      }
    } catch (e) {
      console.error('refreshInsight error', e)
    } finally {
      setInsightLoading(false)
    }
  }

  function handleLimitsComplete(newKcal: number, newProtein: number) {
    setKcalT(newKcal)
    setProteinT(newProtein)
    // goal_mode is picked inside LimitsFlow; we don't have it here, but the
    // next page navigation will refresh it from the server. For now, optimistically
    // unset so the chip reflects the new state until reload.
    setGoalM(null)
    setLimitsOpen(false)
  }

  const goalLabel = goalM === 'lose_weight'
    ? 'Lose weight · −350 kcal'
    : goalM === 'craving_control'
      ? 'Craving control · maintenance'
      : null

  return (
    <div style={{ padding: '32px 20px 40px', minHeight: '100dvh', background: 'var(--bg)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>You</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', marginBottom: 24 }}>
        {name ?? 'Profile'}
      </h1>

      {/* === YOUR NUMBERS === */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your numbers</p>
          {goalLabel && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid rgba(62,207,207,0.25)' }}>
              {goalLabel}
            </span>
          )}
        </div>

        {kcalT != null ? (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, padding: '18px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Calories</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)' }}>{kcalT}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>kcal / day</p>
            </div>
            <div style={{ flex: 1, padding: '18px 16px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Protein</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)' }}>{proteinT}g</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>/ day</p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            No daily limits set yet. Tap recalculate to set them up.
          </p>
        )}

        <button onClick={() => setLimitsOpen(true)}
          style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'var(--card2)', color: 'var(--fg)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          {kcalT != null ? 'Recalculate my limits' : 'Set my limits'}
        </button>
      </section>

      {/* === YOUR INSIGHT === */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>How you&apos;re progressing</p>
          <button onClick={refreshInsight} disabled={insightLoading}
            style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--muted)', cursor: insightLoading ? 'wait' : 'pointer', padding: 0 }}>
            {insightLoading ? 'updating…' : `↻ ${timeAgo(insightAt)}`}
          </button>
        </div>

        {rateLimitedMsg && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, marginTop: -4 }}>
            {rateLimitedMsg}
          </p>
        )}

        <div style={{ padding: '20px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
          {insightLoading && !insight && (
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>Sitting with what you&apos;ve shared. One moment.</p>
          )}
          {!insightLoading && !insight && !personalityMd && (
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>Finish your intro and this becomes your space.</p>
          )}
          {!insightLoading && !insight && personalityMd && (
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>Sit with a few cravings and a real picture of how you&apos;re progressing will show up here.</p>
          )}
          {insight && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {insight.split(/\n\n+/).map((para, i) => (
                <p key={i} style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.7, margin: 0 }}>
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {limitsOpen && (
        <LimitsFlow
          initial={limitsInputs}
          onComplete={handleLimitsComplete}
          onClose={() => setLimitsOpen(false)}
        />
      )}
    </div>
  )
}
