'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Crave', icon: '◎' },
  { href: '/food', label: 'Food', icon: '⊞' },
  { href: '/profile', label: 'You', icon: '◐' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex items-center justify-around px-4 py-3 pb-safe"
      style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
    >
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 flex-1 py-1">
            <span className="text-xl" style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}>
              {tab.icon}
            </span>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
            >
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
