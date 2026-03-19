import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { title, body, url = '/', excludeUserId } = await req.json()

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate || vapidPrivate.length < 10) {
      return NextResponse.json({ ok: true, sent: 0, note: 'vapid_not_configured' })
    }

    // Obtener todas las suscripciones excepto el autor
    let query = supabase.from('push_subscriptions').select('*')
    if (excludeUserId) query = query.neq('user_id', excludeUserId)
    const { data: subs } = await query

    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

    const webpush = await import('web-push')
    webpush.default.setVapidDetails('mailto:info@sancayetano.com', vapidPublic, vapidPrivate)

    const msg = JSON.stringify({ title, body, url })

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          msg
        )
        sent++
      } catch(e: any) {
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
    return NextResponse.json({ ok: true, sent })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}