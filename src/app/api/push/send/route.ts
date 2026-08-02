import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Envia una notificacion push a TODAS las suscripciones (difusion general).
// Usa la libreria web-push (VAPID + cifrado aes128gcm correctos).
export async function POST(req: NextRequest) {
  try {
    const { title, body, url } = await req.json()

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate || vapidPrivate.length < 10) {
      return NextResponse.json({ ok: true, sent: 0, note: 'vapid_not_configured' })
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!subs?.length) return NextResponse.json({ ok: true, sent: 0, message: 'No subscriptions' })

    const webpush = await import('web-push')
    webpush.default.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:info@sancayetano.com',
      vapidPublic,
      vapidPrivate
    )

    const payload = JSON.stringify({
      title: title || 'CD San Cayetano',
      body: body || 'Nueva notificación',
      url: url || '/',
    })

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          payload
        )
        sent++
      } catch (e: any) {
        // Suscripcion caducada o no encontrada -> eliminar
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        console.error('push/send error:', e?.message)
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    console.error('push/send exception:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
