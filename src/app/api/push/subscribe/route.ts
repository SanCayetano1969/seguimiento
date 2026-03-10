import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json()
    const { endpoint, keys } = subscription
    const { p256dh, auth } = keys

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
