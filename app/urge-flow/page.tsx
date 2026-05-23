import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/cached'
import UrgeFlow from '@/components/UrgeFlow'

export default async function UrgeFlowPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('personality_md')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { personality_md: string | null } | null
  if (!profile?.personality_md) redirect('/onboarding')

  return (
    <UrgeFlow
      personalityMd={profile.personality_md}
      userId={user.id}
    />
  )
}
