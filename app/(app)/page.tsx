import { createClient } from '@/lib/supabase/server'
import UrgeHome from '@/components/UrgeHome'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('urges')
    .select('gave_in')
    .eq('user_id', user!.id)
    .not('gave_in', 'is', null)
    .order('created_at', { ascending: false })
    .limit(22)

  const urges = (data ?? []) as { gave_in: boolean | null }[]
  const total = urges.length
  const held = urges.filter(u => !u.gave_in).length

  return <UrgeHome held={held} total={total} />
}
