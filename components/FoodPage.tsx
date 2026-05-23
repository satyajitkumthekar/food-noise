'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FoodLog, LimitsInputs, Urge } from '@/lib/database.types'
import type { FrequentFood } from '@/lib/frequent-foods'
import FoodCheckIn from './FoodCheckIn'
import LimitsFlow from './LimitsFlow'
import Rings from './Rings'

type PendingGiveIn = Pick<Urge, 'id' | 'craving' | 'current_feeling' | 'expected_feeling' | 'created_at'>

type Props = {
  initialLogs: FoodLog[]
  pendingGiveIns: PendingGiveIn[]
  userId: string
  kcalTarget: number | null
  proteinTarget: number | null
  limitsInputs: LimitsInputs | null
  frequentFoods: FrequentFood[]
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

export default function FoodPage({ initialLogs, pendingGiveIns, userId, kcalTarget, proteinTarget, limitsInputs, frequentFoods }: Props) {
  const [logs, setLogs] = useState<FoodLog[]>(initialLogs)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCheckIn, setActiveCheckIn] = useState<PendingGiveIn | null>(null)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [kcalT, setKcalT] = useState<number | null>(kcalTarget)
  const [proteinT, setProteinT] = useState<number | null>(proteinTarget)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // First-run: if no targets, auto-open the LimitsFlow.
  useEffect(() => {
    if (kcalT == null) setLimitsOpen(true)
  }, [kcalT])

  function handleLimitsComplete(newKcal: number, newProtein: number) {
    setKcalT(newKcal)
    setProteinT(newProtein)
    setLimitsOpen(false)
  }

  const totalKcal = logs.reduce((a, l) => a + (l.kcal ?? 0), 0)
  const totalProtein = logs.reduce((a, l) => a + (l.protein ?? 0), 0)

  const unresolvedGiveIns = pendingGiveIns.filter(g => !resolvedIds.has(g.id))

  function findMatchingGiveIn(foodName: string): PendingGiveIn | null {
    return unresolvedGiveIns.find(g => g.craving && matchesCraving(foodName, g.craving)) ?? null
  }

  const [quickAddingKey, setQuickAddingKey] = useState<string | null>(null)

  async function handleQuickAdd(food: FrequentFood) {
    if (quickAddingKey) return
    setQuickAddingKey(food.name)
    try {
      await logFood(food.name, food.kcal, food.protein)
    } finally {
      setQuickAddingKey(null)
    }
  }

  async function logFood(name: string, kcal: number | null, protein: number | null) {
    const matched = findMatchingGiveIn(name)
    const { data, error } = await supabase.from('food_logs').insert({
      user_id: userId,
      name,
      kcal: kcal != null ? Math.round(kcal) : null,
      protein: protein != null ? Math.round(protein) : null,
      linked_urge_id: matched?.id ?? null,
    }).select().single()
    if (!error && data) {
      setLogs(prev => [...prev, data as FoodLog])
      if (matched) setActiveCheckIn(matched)
    }
  }

  // Stage the image in memory only. Nothing leaves the browser until the
  // user types a description and hits send.
  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (imageBusy || loading) return

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      setPendingImage(dataUrl)
    } catch (err) {
      console.error('image read error', err)
    }
  }

  function clearPendingImage() {
    setPendingImage(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const description = input.trim()
    if (!description || loading || imageBusy) return

    // If there's a pending image, send both. Otherwise text-only path.
    if (pendingImage) {
      setImageBusy(true)
      try {
        const res = await fetch('/api/estimate-food-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: pendingImage, description }),
        })
        const { name, kcal, protein } = await res.json() as {
          name: string | null; kcal: number | null; protein: number | null
        }
        await logFood(name ?? description, kcal, protein)
        setInput('')
        setPendingImage(null)
      } catch (err) {
        console.error('image flow error', err)
      } finally {
        setImageBusy(false)
      }
      return
    }

    setLoading(true)
    const res = await fetch('/api/estimate-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food: description }),
    })
    const { kcal, protein } = await res.json()
    await logFood(description, kcal, protein)
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

      {/* Today's log card — list comes first now, matching the reference UI */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Today&apos;s log</p>
      <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 16 }}>
        {logs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 10 }}>
            <span style={{ fontSize: 24, color: 'var(--muted)', opacity: 0.7 }}>◌</span>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing logged yet</p>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 52px 64px 32px', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Food</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>kcal</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right' }}>protein</span>
              <span />
            </div>
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
          </>
        )}
      </div>

      {/* Input — text field with inline image + send buttons */}
      <form onSubmit={handleAdd} style={{ marginBottom: 20 }}>
        {pendingImage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 8, borderRadius: 14, background: 'var(--card2)', border: '1px solid var(--border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="Food preview"
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>Photo attached</p>
              <p style={{ fontSize: 10, color: 'var(--muted)' }}>
                {input.trim() ? 'Hit send to log it.' : 'Add a quick description, then send.'}
              </p>
            </div>
            <button type="button" onClick={clearPendingImage}
              disabled={imageBusy}
              aria-label="Remove photo"
              style={{ width: 28, height: 28, borderRadius: 999, background: 'transparent', border: 'none', color: 'var(--muted)', cursor: imageBusy ? 'not-allowed' : 'pointer', fontSize: 16, lineHeight: 1, opacity: imageBusy ? 0.4 : 1 }}>
              ×
            </button>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder={imageBusy ? 'Reading your photo…' : pendingImage ? 'Describe what you ate' : 'What did you eat?'}
            disabled={imageBusy}
            style={{ ...inputStyle, width: '100%', padding: '16px 92px 16px 18px', borderRadius: 999, boxSizing: 'border-box', opacity: imageBusy ? 0.6 : 1 }}
          />
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={loading || imageBusy || !!pendingImage}
              aria-label="Add a photo"
              title={pendingImage ? 'Photo already attached.' : "Photo is read once and never stored."}
              style={{ width: 36, height: 36, borderRadius: 999, background: 'transparent', border: 'none', cursor: loading || imageBusy || pendingImage ? 'not-allowed' : 'pointer', color: 'var(--fg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loading || imageBusy || pendingImage ? 0.3 : 0.8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10.5" r="1.5" />
                <path d="M21 16l-5-5L5 21" />
              </svg>
            </button>
            <button type="submit" disabled={loading || imageBusy || !input.trim()}
              aria-label="Send"
              style={{ width: 36, height: 36, borderRadius: 999, background: input.trim() && !loading && !imageBusy ? 'var(--accent)' : 'transparent', color: input.trim() && !loading && !imageBusy ? '#000' : 'var(--muted)', border: 'none', cursor: loading || imageBusy || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l14-7-5 14-3-6-6-1z" />
              </svg>
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImagePick}
          style={{ display: 'none' }}
        />
      </form>

      {/* Quick add — frequent foods from the last 7 days */}
      {frequentFoods.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Quick add</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginLeft: -20, paddingLeft: 20, marginRight: -20, paddingRight: 20, scrollbarWidth: 'none' }}>
            {frequentFoods.map(f => {
              const busy = quickAddingKey === f.name
              return (
                <button key={f.name} onClick={() => handleQuickAdd(f)} disabled={busy || loading || imageBusy}
                  style={{
                    flexShrink: 0,
                    minWidth: 150,
                    maxWidth: 220,
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                    cursor: busy || loading || imageBusy ? 'wait' : 'pointer',
                    opacity: busy || loading || imageBusy ? 0.5 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {f.kcal != null ? `${f.kcal} kcal` : '—'}{f.protein != null ? ` · ${f.protein}g` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rings — daily progress vs target */}
      <div style={{ marginBottom: 16 }}>
        <Rings kcal={totalKcal} kcalTarget={kcalT} protein={totalProtein} proteinTarget={proteinT} />
      </div>

      {activeCheckIn && (
        <FoodCheckIn
          giveIn={activeCheckIn}
          onDone={() => handleCheckInResolved(activeCheckIn.id)}
          onDismiss={handleCheckInDismiss}
        />
      )}

      {limitsOpen && (
        <LimitsFlow
          initial={limitsInputs}
          onComplete={handleLimitsComplete}
          onClose={() => {
            // Don't allow dismissing on first-run when no target exists yet.
            if (kcalT != null) setLimitsOpen(false)
          }}
        />
      )}
    </div>
  )
}
