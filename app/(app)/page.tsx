import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/cached'
import UrgeHome from '@/components/UrgeHome'

export default async function HomePage() {
  // Layout already gated and cached the user — this is a free hit.
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('urges')
    .select('gave_in')
    .eq('user_id', user.id)
    .not('gave_in', 'is', null)
    .order('created_at', { ascending: false })
    .limit(22)

  const urges = (data ?? []) as { gave_in: boolean | null }[]
  const total = urges.length
  const held = urges.filter(u => !u.gave_in).length

  return <UrgeHome held={held} total={total} />
}
