'use client'

type Props = {
  kcal: number
  kcalTarget: number | null
  protein: number
  proteinTarget: number | null
}

function Ring({
  label, value, target, unit, decimals = 0,
}: {
  label: string
  value: number
  target: number | null
  unit: string
  decimals?: number
}) {
  const size = 130
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const ratio = target && target > 0 ? Math.min(value / target, 1) : 0
  const dash = circumference * ratio
  const remaining = target != null ? target - value : null

  // Color shift: under target = accent, over = warning
  const over = target != null && value > target
  const color = over ? 'var(--danger)' : 'var(--accent)'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </p>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="var(--border)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>
            {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}{unit === 'g' ? 'g' : ''}
          </span>
          {target != null && remaining != null && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {remaining >= 0 ? `${Math.round(remaining)}${unit} left` : `${Math.abs(Math.round(remaining))}${unit} over`}
            </span>
          )}
          {target == null && (
            <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>no target</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Rings({ kcal, kcalTarget, protein, proteinTarget }: Props) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '20px 16px', borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' }}>
      <Ring label="Cal" value={kcal} target={kcalTarget} unit=" kcal" />
      <Ring label="Pro" value={protein} target={proteinTarget} unit="g" />
    </div>
  )
}
