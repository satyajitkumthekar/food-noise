import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/cached'
import ProfileView from '@/components/ProfileView'
import type { GoalMode, LimitsInputs } from '@/lib/database.types'

type ProfileRow = {
  name: string | null
  personality_md: string | null
  kcal_target: number | null
  protein_target: number | null
  limits_inputs: LimitsInputs | null
  goal_mode: GoalMode | null
  insight_md: string | null
  insight_updated_at: string | null
}

export default async function ProfileRoute() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('name, personality_md, kcal_target, protein_target, limits_inputs, goal_mode, insight_md, insight_updated_at')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as ProfileRow | null

  return (
    <ProfileView
      name={profile?.name ?? null}
      personalityMd={profile?.personality_md ?? null}
      kcalTarget={profile?.kcal_target ?? null}
      proteinTarget={profile?.protein_target ?? null}
      limitsInputs={profile?.limits_inputs ?? null}
      goalMode={profile?.goal_mode ?? null}
      insightMd={profile?.insight_md ?? null}
      insightUpdatedAt={profile?.insight_updated_at ?? null}
    />
  )
}
