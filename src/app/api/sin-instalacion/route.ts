import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  'mailto:info@sancayetano.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  const { eventId, teamId, title, date, location } = await req.json()

  // Obtener usuarios a notificar:
  // 1. Entrenadores del equipo afectado
  // 2. Todos los coordinadores
  const { data: users } = await supabase
    .from('app_users')
    .select('id, role, name')
    .or(`role.eq.coordinator,role.eq.admin`)

  const { data: teamUsers } = await supabase
    .from('app_users')
    .select('id, role, name')
    .eq('role', 'coach')

  // Obtener el equipo para filtrar entrenador
  const { data: team } = await supabase
    .from('teams')
    .select('name, coach_id, second_coach_id')
    .eq('id', teamId)
    .single()

  // IDs a notificar: coordinadores + admins + entrenadores del equipo
  const notifyIds = new Set<string>()
  ;(users || []).forEach((u: any) => notifyIds.add(u.id))
  if (team?.coach_id) notifyIds.add(team.coach_id)
  if (team?.second_coach_id) notifyIds.add(team.second_coach_id)

  if (notifyIds.size === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Obtener push subscriptions de esos usuarios
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', Array.from(notifyIds))

  const teamName = team?.name || 'equipo'
  const msg = {
    title: '⚠️ Sin instalación',
    body: `${teamName} — ${title} (${date}) no puede realizarse por falta de instalaciones`,
  }

  let sent = 0
  for (const sub of (subs || [])) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        JSON.stringify(msg)
      )
      sent++
    } catch (e) {
      console.error('Push error:', e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}