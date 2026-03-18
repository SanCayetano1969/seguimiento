import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { eventId, teamId, title, date, location } = await req.json()

    // Obtener equipo
    const { data: team } = await supabase
      .from('teams')
      .select('name, coach_id, second_coach_id')
      .eq('id', teamId)
      .single()

    // IDs a notificar: coordinadores + admins + entrenadores del equipo
    const { data: coordsAdmins } = await supabase
      .from('app_users')
      .select('id')
      .in('role', ['coordinator', 'admin'])

    const notifyIds = new Set<string>()
    ;(coordsAdmins || []).forEach((u: any) => notifyIds.add(u.id))
    if (team?.coach_id) notifyIds.add(team.coach_id)
    if (team?.second_coach_id) notifyIds.add(team.second_coach_id)

    if (notifyIds.size === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // Obtener push subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', Array.from(notifyIds))

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    // Solo intentar enviar push si las variables VAPID están configuradas
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY

    if (!vapidPublic || !vapidPrivate || vapidPrivate.length < 10) {
      console.warn('VAPID keys not configured, skipping push notifications')
      return NextResponse.json({ ok: true, sent: 0, note: 'vapid_not_configured' })
    }

    // Importar webpush solo cuando las variables están disponibles
    const webpush = await import('web-push')
    webpush.default.setVapidDetails(
      'mailto:info@sancayetano.com',
      vapidPublic,
      vapidPrivate
    )

    const teamName = team?.name || 'Equipo'
    const msg = JSON.stringify({
      title: '⚠️ Sin instalación',
      body: `${teamName} — ${title} (${date || ''}) no puede realizarse por falta de instalaciones`,
    })

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          msg
        )
        sent++
      } catch (e: any) {
        console.error('Push error for sub', sub.id, e?.message)
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    console.error('sin-instalacion route error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}