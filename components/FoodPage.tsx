'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FoodLog, Urge } from '@/lib/database.types'
import FoodCheckIn from './FoodCheckIn'

type PendingGiveIn = Pick<Urge, 'id' | 'craving' | 'current_feeling' | 'expected_feeling' | 'created_at'>

type Props = {
  initialLogs: FoodLog[]
  pendingGiveIns: PendingGiveIn[]
  userId: string
}

function matchesCraving(foodName: string, craving: string): boolean {
  const food = foodName.toLowerCase().trim()
  const crav = craving.toLowerCase().trim()
  if (food.includes(crav) || crav.includes(food)) return true
  if (crav.split(/[/,]/).some(p => food.includes(p.trim()))) return true
  const aliases: Record<string, string[]> = {
    sweets: ['candy', 'sweet', 'gummy', 'sugar', 'cookie', 'brownie', 'cake', 'doughnut', 'donut'],
    chips: ['crisp', 'chip', 'fries', 'nacho', 'popcorn'],
    crisps: ['crisp', 'chip'],
    'fast food': ['burger', 'mcdonald', 'kfc', 'subway', 'wendy', 'taco', 'burrito'],
    bread: ['bread', 'toast', 'bagel', 'roll', 'bun', 'pasta', 'noodle', 'rice', 'roti', 'naan'],
    carbs: ['bread', 'pasta', 'rice', 'noodle', 'potato', 'roti'],
    chocolate: ['chocolate', 'cocoa', 'nutella', 'kitkat', 'snickers'],
    'ice cream': ['ice cream', 'icecream', 'gelato', 'sorbet'],
    pizza: ['pizza', 'slice'],
    leftovers: ['leftover', 'yesterday', 'reheated'],
  }
  for (const [key, words] of Object.entries(aliases)) {
    if (crav.includes(key) || key.includes(crav)) {
      if (words.some(w => food.includes(w))) return true
    }
  }
  return false
}

const inputStyle: React.CSSProperties = {
  background: 'var(--card2)',
  border: '1px solid var(--border2)',
  color: 'var(--fg)',
  caretColor: 'var(--accent)',
  WebkitAppearance: 'none',
  fontSize: 16,
  outline: 'none',
}

export default function FoodPage({ initialLogs, pendingGiveIns, userId }: Props) {
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCheckIn, setActiveCheckIn] = useState<PendingGiveIn | null>(null)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const totalKcal = logs.reduce((a, l) => a + (l.kcal ?? 0), 0)
  const totalProtein = logs.reduce((a, l) => a + (l.protein ?? 0), 0)

  const unresolvedGiveIns = pendingGiveIns.filter(g => !resolvedIds.has(g.id))

  function findMatchingGiveIn(foodName: string): PendingGiveIn | null {
    return unresolvedGiveIns.find(g => g.craving && matchesCraving(foodName, g.craving)) ?? null
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    setLoading(true)

    const res = await fetch('/api/estimate-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food: input }),
    })
    const { kcal, protein } = await res.json()
    const matched = findMatchingGiveIn(input)

    const { data, error } = await supabase.from('food_logs').insert({
      user_id: userId,
      name: input,
      kcal: kcal != null ? Math.round(kcal) : null,
      protein: protein != null ? Math.round(protein) : null,
      linked_urge_id: matched?.id ?? null,
    }).select().single()

    if (!error && data) {
      setLogs(prev => [...prev, data as FoodLog])
      if (matched) setActiveCheckIn(matched)
    }
    setInput('')
    setLoading(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('food_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  function handleCheckInResolved(id: string) {
    // Called when user completes the flow (saved) — removes from banner
    setResolvedIds(prev => new Set([...prev, id]))
    setActiveCheckIn(null)
  }

  function handleCheckInDismiss() {
    // Called when user taps Dismiss — closes sheet but banner stays
    setActiveCheckIn(null)
  }

  return (
    <div style={{ padding: '32px 20px 40px', minHeight: '100dvh', background: 'var(--bg)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Daily log</p>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>Food</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>Just a log. No rules, no judgement.</p>

      {/* Pending loop banner — always visible until resolved, tap to open sheet */}
      {unresolvedGiveIns.length > 0 && (
        <button
          onClick={() => setActiveCheckIn(unresolvedGiveIns[0])}
          style={{ width: '100%', borderRadius: 14, padding: '14px 16px', background: 'var(--accent-dim)', border: '1px solid rgba(62,207,207,0.25)', marginBottom: 20, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-text)', marginBottom: 4 }}>Loop pending</p>
            <p style={{ fontSize: 14, color: 'var(--fg)' }}>
              You craved <strong>{unresolvedGiveIns[0].craving}</strong> — did you have it?
            </p>
          </div>
          <span style={{ fontSize: 18, color: 'var(--accent-text)', flexShrink: 0 }}>›</span>
        </button>
      )}

      {/* Input */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="What did you eat?"
          style={{ ...inputStyle, flex: 1, padding: '14px 16px', borderRadius: 12, boxSizing: 'border-box' }}
        />
        <button type="submit" disabled={loading || !input.trim()}
          style={{ padding: '14px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14, background: 'var(--accent)', color: '#000', border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.4 : 1, whiteSpace: 'nowrap' }}>
          {loading ? '…' : 'Add'}
        </button>
      </form>

      {/* Log card */}
      <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 52px 64px 32px', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Food</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>kcal</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>protein</span>
          <span />
        </div>

        {logs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
            <span style={{ fontSize: 22, color: 'var(--muted)' }}>⊘</span>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Nothing logged yet</p>
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <div key={log.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 52px 64px 32px', gap: 8,
                padding: '13px 16px', alignItems: 'center',
                borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 14, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.name}</span>
                <span style={{ fontSize: 14, color: 'var(--fg2)', textAlign: 'right' }}>{log.kcal ?? '—'}</span>
                <span style={{ fontSize: 14, color: 'var(--fg2)', textAlign: 'right' }}>{log.protein != null ? `${log.protein}g` : '—'}</span>
                <button onClick={() => handleDelete(log.id)} disabled={deletingId === log.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 0, lineHeight: 1, opacity: deletingId === log.id ? 0.3 : 0.6 }}>
                  ×
                </button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 64px 32px', gap: 8, padding: '13px 16px', background: 'var(--card2)', borderTop: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>Total</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', textAlign: 'right' }}>{totalKcal}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', textAlign: 'right' }}>{totalProtein}g</span>
              <span />
            </div>
          </>
        )}
      </div>

      {activeCheckIn && (
        <FoodCheckIn
          giveIn={activeCheckIn}
          onDone={() => handleCheckInResolved(activeCheckIn.id)}
          onDismiss={handleCheckInDismiss}
        />
      )}
    </div>
  )
}
