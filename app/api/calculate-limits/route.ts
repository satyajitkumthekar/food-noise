import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ActivityLevel, GoalMode, LimitsInputs } from '@/lib/database.types'

// Pulled below textbook values. Most people drastically overestimate their
// activity, and overshooting kcal silently undoes the work.
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sitting: 1.20,
  moderate: 1.40,
  very: 1.55,
}

// Modest deficit. ~0.3 kg/week. Sustainable; doesn't trigger rebound eating.
const WEIGHT_LOSS_DEFICIT = 350

function mifflinStJeor(gender: 'male' | 'female', age: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<LimitsInputs>
  const { gender, age, height_cm, weight_kg, activity, goal_mode } = body

  if (!gender || !age || !height_cm || !weight_kg || !activity || !goal_mode) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!(gender === 'male' || gender === 'female')) {
    return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })
  }
  if (!(activity in ACTIVITY_MULTIPLIER)) {
    return NextResponse.json({ error: 'Invalid activity' }, { status: 400 })
  }
  if (!(goal_mode === 'craving_control' || goal_mode === 'lose_weight')) {
    return NextResponse.json({ error: 'Invalid goal_mode' }, { status: 400 })
  }
  if (age < 10 || age > 100 || height_cm < 100 || height_cm > 250 || weight_kg < 30 || weight_kg > 300) {
    return NextResponse.json({ error: 'Out of range' }, { status: 400 })
  }

  const bmr = mifflinStJeor(gender, age, height_cm, weight_kg)
  const maintenance = Math.round(bmr * ACTIVITY_MULTIPLIER[activity])
  const kcal_target = goal_mode === 'lose_weight' ? maintenance - WEIGHT_LOSS_DEFICIT : maintenance
  const protein_target = Math.round(weight_kg * 1.8)

  const inputs: LimitsInputs = { gender, age, height_cm, weight_kg, activity, goal_mode }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient.from('profiles').update({
    kcal_target,
    protein_target,
    weight_kg,
    limits_inputs: inputs,
    goal_mode,
  }).eq('id', user.id)

  if (error) {
    console.error('calculate-limits save error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    kcal_target,
    protein_target,
    bmr: Math.round(bmr),
    maintenance,
    goal_mode,
  })
}
