'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Crave', icon: '◎' },
  { href: '/food', label: 'Food', icon: '⊞' },
  { href: '/profile', label: 'You', icon: '◐' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  // Prefetch the other tabs on mount. Next does this automatically on desktop
  // (viewport hover), but on mobile the tap is the first signal — by then the
  // navigation has already started. Prefetching at mount makes tab switches
  // feel instant.
  useEffect(() => {
    for (const tab of tabs) {
      if (tab.href !== pathname) router.prefetch(tab.href)
    }
  }, [pathname, router])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex items-center justify-around px-4 py-3 pb-safe"
      style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
    >
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link key={tab.href} href={tab.href} prefetch className="flex flex-col items-center gap-1 flex-1 py-1">
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
