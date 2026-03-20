import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json()
    if (!subscription || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { endpoint, keys } = subscription
    const { p256dh, auth } = keys

    // 1. Borrar cualquier suscripcion existente con ese endpoint (otro usuario en mismo dispositivo)
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).neq('user_id', userId)

    // 2. Borrar suscripcion anterior del mismo usuario (si cambia de dispositivo)
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).neq('endpoint', endpoint)

    // 3. Insertar la nueva (o actualizar si ya existe exactamente igual)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, endpoint, p256dh, auth },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('push subscribe error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('push subscribe exception:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}