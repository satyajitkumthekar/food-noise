import { createClient } from '@/lib/supabase/server'
import FoodPage from '@/components/FoodPage'
import { FoodLog, LimitsInputs, Urge } from '@/lib/database.types'
import { buildFrequentFoods } from '@/lib/frequent-foods'

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

  // Last 7 days of logs — used to compute frequent foods (quick-add chips).
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { data: rawWeekLogs } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', user!.id)
    .gte('created_at', weekAgo.toISOString())
    .order('created_at', { ascending: false })

  const frequentFoods = buildFrequentFoods((rawWeekLogs ?? []) as FoodLog[])

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const { data: rawGiveIns } = await supabase
    .from('urges')
    .select('id, craving, current_feeling, expected_feeling, created_at')
    .eq('user_id', user!.id)
    .eq('gave_in', true)
    .is('after_feeling', null)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('kcal_target, protein_target, limits_inputs')
    .eq('id', user!.id)
    .single()

  const profile = profileRaw as {
    kcal_target: number | null
    protein_target: number | null
    limits_inputs: LimitsInputs | null
  } | null

  return (
    <FoodPage
      initialLogs={(rawLogs ?? []) as FoodLog[]}
      pendingGiveIns={(rawGiveIns ?? []) as PendingGiveIn[]}
      userId={user!.id}
      kcalTarget={profile?.kcal_target ?? null}
      proteinTarget={profile?.protein_target ?? null}
      limitsInputs={profile?.limits_inputs ?? null}
      frequentFoods={frequentFoods}
    />
  )
}
