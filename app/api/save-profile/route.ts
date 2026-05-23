import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, personality_md } = await req.json()

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient.from('profiles').upsert({
    id: user.id,
    name,
    personality_md,
  })

  if (error) {
    console.error('save-profile error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
