'use client'

import { Urge } from '@/lib/database.types'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

export default function RecordView({ urges }: { urges: Urge[] }) {
  const total = urges.length
  const held = urges.filter(u => !u.gave_in).length
  const successRate = total > 0 ? Math.round((held / total) * 100) : 0
  const avgHeld = total > 0
    ? Math.round(urges.reduce((a, u) => a + (u.held_seconds ?? 0), 0) / total)
    : 0

  const strengthData = urges.map((u, i) => ({ i: i + 1, strength: u.strength_before ?? 0 }))
  const barData = urges.slice(-20).map((u, i) => ({ i: i + 1, seconds: u.held_seconds ?? 0, gaveIn: u.gave_in }))

  const tooltipStyle = {
    contentStyle: { background: 'var(--card2)', border: '1px solid var(--border2)', borderRadius: 10, fontSize: 12 },
    labelStyle: { color: 'var(--muted)', fontSize: 10 },
    itemStyle: { color: 'var(--fg2)' },
    cursor: { fill: 'rgba(62,207,207,0.05)' },
  }

  return (
    <div className="px-5 py-8 min-h-dvh" style={{ background: 'var(--bg)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>Your history</p>
      <h1 className="text-2xl font-bold mb-8" style={{ color: 'var(--fg)' }}>Record</h1>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="text-3xl" style={{ color: 'var(--muted)' }}>◎</div>
          <p className="text-base font-medium" style={{ color: 'var(--fg)' }}>No urges yet</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Your record builds as you use the app.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {[
              { label: 'Success rate', value: `${successRate}%` },
              { label: 'Held firm', value: `${held} / ${total}` },
              { label: 'Avg time held', value: `${avgHeld}s` },
              { label: 'Total reps', value: `${total}` },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Strength over time */}
          {strengthData.length > 1 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Urge strength over time</p>
              <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={strengthData}>
                    <XAxis dataKey="i" hide />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${v}/10`, 'Strength']} />
                    <Line type="monotone" dataKey="strength" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Time held per urge */}
          {barData.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Time held per urge (last 20)</p>
              <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={barData} barSize={10}>
                    <XAxis dataKey="i" hide />
                    <YAxis hide />
                    <Tooltip
                      {...tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any, _: any, props: any) => [`${v}s — ${props.payload.gaveIn ? 'gave in' : 'held firm'}`, '']}
                    />
                    <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.gaveIn ? 'var(--muted)' : 'var(--accent)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-end">
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)', display: 'inline-block' }} /> Held firm
                  </span>
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--muted)', display: 'inline-block' }} /> Gave in
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
