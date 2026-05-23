import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/cached'
import FoodPage from '@/components/FoodPage'
import { FoodLog, LimitsInputs, Urge } from '@/lib/database.types'
import { buildFrequentFoods } from '@/lib/frequent-foods'

type PendingGiveIn = Pick<Urge, 'id' | 'craving' | 'current_feeling' | 'expected_feeling' | 'created_at'>

type ProfileSlice = {
  kcal_target: number | null
  protein_target: number | null
  limits_inputs: LimitsInputs | null
}

export default async function FoodRoute() {
  const user = await requireUser()
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Fire all four queries in parallel. Previously these were sequential and
  // added up to the page's perceived latency.
  const [logsRes, weekLogsRes, giveInsRes, profileRes] = await Promise.all([
    supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', todayIso)
      .order('created_at', { ascending: true }),
    supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', weekAgoIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('urges')
      .select('id, craving, current_feeling, expected_feeling, created_at')
      .eq('user_id', user.id)
      .eq('gave_in', true)
      .is('after_feeling', null)
      .gte('created_at', yesterdayIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('kcal_target, protein_target, limits_inputs')
      .eq('id', user.id)
      .single(),
  ])

  const frequentFoods = buildFrequentFoods((weekLogsRes.data ?? []) as FoodLog[])
  const profile = (profileRes.data as ProfileSlice | null) ?? null

  return (
    <FoodPage
      initialLogs={(logsRes.data ?? []) as FoodLog[]}
      pendingGiveIns={(giveInsRes.data ?? []) as PendingGiveIn[]}
      userId={user.id}
      kcalTarget={profile?.kcal_target ?? null}
      proteinTarget={profile?.protein_target ?? null}
      limitsInputs={profile?.limits_inputs ?? null}
      frequentFoods={frequentFoods}
    />
  )
}
