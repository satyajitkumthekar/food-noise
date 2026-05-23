import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getOnboardingGate } from '@/lib/supabase/cached'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { hasProfile } = await getOnboardingGate()
  if (!hasProfile) redirect('/onboarding')

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--background)' }}>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
