import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { toUserId, fromName, body } = await req.json()
    if (!toUserId) return NextResponse.json({ ok: false, error: 'toUserId required' }, { status: 400 })

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate || vapidPrivate.length < 10) {
      return NextResponse.json({ ok: true, sent: 0, note: 'vapid_not_configured' })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', toUserId)

    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

    const webpush = await import('web-push')
    webpush.default.setVapidDetails('mailto:info@sancayetano.com', vapidPublic, vapidPrivate)

    const msg = JSON.stringify({
      title: '💬 ' + (fromName || 'Mensaje nuevo'),
      body: body || 'Tienes un mensaje nuevo',
      url: '/mensajeria'
    })

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          msg
        )
        sent++
      } catch(e: any) {
        // Suscripcion expirada — eliminar
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        console.error('Push error:', e?.message)
      }
    }
    return NextResponse.json({ ok: true, sent })
  } catch(e: any) {
    console.error('push/message error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}