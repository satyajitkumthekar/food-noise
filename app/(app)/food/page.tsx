import { createClient } from '@/lib/supabase/server'
import FoodPage from '@/components/FoodPage'
import { FoodLog, Urge } from '@/lib/database.types'

type PendingGiveIn = Pick<Urge, 'id' | 'craving' | 'current_feeling' | 'expected_feeling' | 'created_at'>

export default async function FoodRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: rawLogs } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', user!.id)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: true })

  // Show all give-ins from last 24h that haven't been resolved (no after_feeling)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const { data: rawGiveIns } = await supabase
    .from('urges')
    .select('id, craving, current_feeling, expected_feeling, created_at')
    .eq('user_id', user!.id)
    .eq('gave_in', true)
    .is('after_feeling', null)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })

  return (
    <FoodPage
      initialLogs={(rawLogs ?? []) as FoodLog[]}
      pendingGiveIns={(rawGiveIns ?? []) as PendingGiveIn[]}
      userId={user!.id}
    />
  )
}
