import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Recordatorio de entrenos SIN INSTALACIÓN (events.sin_instalacion = true)
// Se ejecuta a diario (vercel.json). Avisa 7 días y 2 días antes a:
//   - entrenador(es) del equipo afectado (user_teams + rol coach)
//   - coordinadores
//   - admin(s)
// Cada destinatario recibe UN mensaje en Mensajería (remitente: el admin) + notificación push.
// Pruebas: ?hoy=YYYY-MM-DD simula la fecha; ?dry=1 devuelve lo que enviaría sin enviar nada.

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function hoyMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
}

function sumarDias(fecha: string, n: number): string {
  const d = new Date(fecha + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function fechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  const [y, m, dd] = fecha.split('-')
  return `${DIAS[d.getUTCDay()]} ${dd}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dry = url.searchParams.get('dry') === '1'
    const hoy = url.searchParams.get('hoy') || hoyMadrid()
    const objetivos: Record<string, number> = { [sumarDias(hoy, 7)]: 7, [sumarDias(hoy, 2)]: 2 }

    const { data: eventos, error } = await supabase
      .from('events')
      .select('id, team_id, date, time, location, notes, teams(name)')
      .eq('sin_instalacion', true)
      .in('date', Object.keys(objetivos))
      .order('date').order('time')
    if (error) throw error
    if (!eventos?.length) return NextResponse.json({ ok: true, hoy, eventos: 0, sent: 0 })

    // Destinatarios fijos: admins + coordinadores activos
    const { data: staff } = await supabase
      .from('app_users').select('id, name, username, role')
      .in('role', ['admin', 'coordinator']).eq('active', true)

    // Entrenadores de los equipos afectados
    const teamIds = Array.from(new Set(eventos.map((e: any) => e.team_id).filter(Boolean)))
    const { data: links } = await supabase
      .from('user_teams').select('team_id, app_users!inner(id, name, role, active)')
      .in('team_id', teamIds)
    const coachesPorEquipo: Record<string, any[]> = {}
    ;(links || []).forEach((l: any) => {
      const u = l.app_users
      if (u && u.role === 'coach' && u.active) (coachesPorEquipo[l.team_id] ||= []).push(u)
    })

    // Remitente de los mensajes: el admin (nano si existe)
    const admins = (staff || []).filter((u: any) => u.role === 'admin')
    const remitente = admins.find((u: any) => u.username === 'nano') || admins[0] || null

    // Agrupar eventos por destinatario
    const porUsuario: Record<string, { user: any, eventos: any[] }> = {}
    const add = (u: any, ev: any) => {
      const k = u.id
      porUsuario[k] ||= { user: u, eventos: [] }
      if (!porUsuario[k].eventos.find(x => x.id === ev.id)) porUsuario[k].eventos.push(ev)
    }
    for (const ev of eventos as any[]) {
      ;(staff || []).forEach((u: any) => add(u, ev))
      ;(coachesPorEquipo[ev.team_id] || []).forEach((u: any) => add(u, ev))
    }

    // Construir texto
    const textos: { user: any, body: string }[] = []
    for (const { user, eventos: evs } of Object.values(porUsuario)) {
      const lineas: string[] = []
      for (const fecha of Object.keys(objetivos)) {
        const delDia = evs.filter(e => e.date === fecha)
        if (!delDia.length) continue
        const n = objetivos[fecha]
        lineas.push(`📅 ${fechaLarga(fecha)} (dentro de ${n} días):`)
        delDia.forEach(e => {
          const h = (e.time || '').slice(0, 5)
          const motivo = (e.notes || '').includes('DIE') ? 'Poliesportiu cerrado por actividad de la DIE' : 'reserva previa de Federación'
          lineas.push(`• ${e.teams?.name || 'Equipo'} ${h} — ${e.location || ''} (${motivo})`)
        })
      }
      const body = `⚠️ RECORDATORIO: SIN INSTALACIÓN\n${lineas.join('\n')}\nNo se podrá entrenar en ese campo. Organizad alternativa o avisad a las familias.`
      textos.push({ user, body })
    }

    if (dry) return NextResponse.json({ ok: true, dry: true, hoy, objetivos, mensajes: textos.map(t => ({ para: t.user.name, rol: t.user.role, body: t.body })) })

    // Mensajería (no se envía a uno mismo) + push
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    let webpush: any = null
    if (vapidPublic && vapidPrivate && vapidPrivate.length >= 10) {
      webpush = (await import('web-push')).default
      webpush.setVapidDetails('mailto:info@sancayetano.com', vapidPublic, vapidPrivate)
    }

    let mensajes = 0, pushes = 0
    for (const { user, body } of textos) {
      if (remitente && remitente.id !== user.id) {
        const { error: mErr } = await supabase.from('messages').insert({
          from_user_id: remitente.id, to_user_id: user.id,
          subject: 'Sin instalación', body,
        })
        if (!mErr) mensajes++
        else console.error('msg error', user.id, mErr.message)
      }
      if (!webpush) continue
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user.id)
      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
            JSON.stringify({ title: '⚠️ Sin instalación', body: body.split('\n').slice(1).join(' '), url: '/agenda' })
          )
          pushes++
        } catch (e: any) {
          if (e?.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          console.error('push error', sub.id, e?.message)
        }
      }
    }

    return NextResponse.json({ ok: true, hoy, eventos: eventos.length, destinatarios: textos.length, mensajes, pushes })
  } catch (err: any) {
    console.error('recordatorio-sin-instalacion error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
