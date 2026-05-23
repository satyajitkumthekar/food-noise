import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './server'

// React's `cache()` dedupes calls within a single request, so the layout and
// the page can both call these helpers without triggering multiple Supabase
// round-trips. This is the cheapest, biggest perf win in the app.

export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Returns the user, redirecting to /auth if unauthenticated.
// Use in any page or layout that needs an authenticated session.
export const requireUser = cache(async () => {
  const user = await getCachedUser()
  if (!user) redirect('/auth')
  return user
})

type OnboardingGate = {
  userId: string
  hasProfile: boolean
}

// Cheap onboarding gate: selects a 1-byte indicator instead of the whole
// personality_md blob. Cached per request.
export const getOnboardingGate = cache(async (): Promise<OnboardingGate> => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .not('personality_md', 'is', null)
    .maybeSingle()

  return {
    userId: user.id,
    hasProfile: !!data,
  }
})
