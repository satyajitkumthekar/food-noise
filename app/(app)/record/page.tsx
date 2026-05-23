import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/cached'
import RecordView from '@/components/RecordView'
import { Urge } from '@/lib/database.types'

export default async function RecordPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('urges')
    .select('*')
    .eq('user_id', user.id)
    .not('gave_in', 'is', null)
    .order('created_at', { ascending: true })

  return <RecordView urges={(raw ?? []) as Urge[]} />
}
