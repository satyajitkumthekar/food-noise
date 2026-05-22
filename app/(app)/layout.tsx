import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('personality_md')
    .eq('id', user.id)
    .single()

  const profile = profileData as { personality_md: string | null } | null
  if (!profile?.personality_md) redirect('/onboarding')

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--background)' }}>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
