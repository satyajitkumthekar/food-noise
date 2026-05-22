import { createClient } from '@/lib/supabase/server'
import RecordView from '@/components/RecordView'
import { Urge } from '@/lib/database.types'

export default async function RecordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: raw } = await supabase
    .from('urges')
    .select('*')
    .eq('user_id', user!.id)
    .not('gave_in', 'is', null)
    .order('created_at', { ascending: true })

  return <RecordView urges={(raw ?? []) as Urge[]} />
}
