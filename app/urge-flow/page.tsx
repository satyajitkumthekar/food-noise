import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UrgeFlow from '@/components/UrgeFlow'

type ProfileRow = {
  goal: string | null
  why_it_matters: string | null
  what_changes: string | null
  personality_md: string | null
}

export default async function UrgeFlowPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('goal, why_it_matters, what_changes, personality_md')
    .eq('id', user!.id)
    .single()

  const profile = profileRaw as ProfileRow | null

  if (!profile?.goal) redirect('/onboarding')

  return (
    <UrgeFlow
      profile={profile!}
      userId={user!.id}
    />
  )
}
