'use client'

import { useRouter } from 'next/navigation'

export default function UrgeHome({ held, total }: { held: number; total: number }) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-72px)] px-6 text-center" style={{ background: 'var(--bg)' }}>
      {total > 0 && (
        <div
          className="mb-10 px-5 py-3 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>Your record</p>
          <p className="text-sm" style={{ color: 'var(--fg2)' }}>
            Beaten <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{held}</span> of your last <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{total}</span> urges
          </p>
        </div>
      )}

      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: 220, height: 220,
            background: 'var(--accent-dim)',
            animation: 'pulse-ring 3s ease-in-out infinite',
          }}
        />
        <button
          onClick={() => router.push('/urge-flow')}
          className="relative w-48 h-48 rounded-full flex flex-col items-center justify-center gap-1 font-semibold text-base transition-transform active:scale-95"
          style={{
            background: 'var(--card2)',
            border: '2px solid var(--accent)',
            color: 'var(--accent-text)',
            boxShadow: '0 0 40px rgba(62,207,207,0.15)',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 28 }}>◎</span>
          <span>I have an urge</span>
        </button>
      </div>

      {total === 0 && (
        <p className="text-xs mt-10 tracking-wide" style={{ color: 'var(--muted)' }}>
          Tap when the feeling hits. This is where it starts.
        </p>
      )}
    </div>
  )
}
