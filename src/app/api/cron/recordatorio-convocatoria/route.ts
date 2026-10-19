import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Recordatorio de CONVOCATORIA — solo los viernes (vercel.json).
// Avisa SOLO a los entrenadores cuyo equipo tiene partido este fin de semana
// (viernes a lunes) y todavía NO tiene convocatoria registrada para ese partido
// (convocatorias.jornada_id = matches.id).
// Cada entrenador recibe UN mensaje en Mensajería (remitente: el admin) + push.
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
function fechaCorta(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  const [, m, dd] = fecha.split('-')
  return `${DIAS[d.getUTCDay()]} ${dd}/${m}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dry = url.searchParams.get('dry') === '1'
    const hoy = url.searchParams.get('hoy') || hoyMadrid()
    const desde = hoy
    const hasta = sumarDias(hoy, 3)   // viernes → lunes

    // Entrenadores activos y sus equipos
    const { data: links, error: lErr } = await supabase
      .from('user_teams').select('team_id, app_users!inner(id, name, role, active)')
    if (lErr) throw lErr
    const coachesPorEquipo: Record<string, any[]> = {}
    ;(links || []).forEach((l: any) => {
      const u = l.app_users
      if (u && u.role === 'coach' && u.active) (coachesPorEquipo[l.team_id] ||= []).push(u)
    })
    const teamIds = Object.keys(coachesPorEquipo)
    if (!teamIds.length) return NextResponse.json({ ok: true, hoy, sent: 0, note: 'sin entrenadores' })

    // Partidos del fin de semana
    const { data: partidos, error: pErr } = await supabase
      .from('matches').select('id, team_id, fecha, rival, local, tipo, jornada, teams(name)')
      .in('team_id', teamIds).gte('fecha', desde).lte('fecha', hasta).order('fecha')
    if (pErr) throw pErr
    if (!partidos?.length) return NextResponse.json({ ok: true, hoy, desde, hasta, partidos: 0, sent: 0 })

    // Convocatorias ya registradas para esos partidos
    const { data: convs, error: cErr } = await supabase
      .from('convocatorias').select('jornada_id').in('jornada_id', partidos.map((p: any) => p.id))
    if (cErr) throw cErr
    const conConv = new Set((convs || []).map((c: any) => c.jornada_id))
    const pendientes = partidos.filter((p: any) => !conConv.has(p.id))

    // Agrupar por entrenador
    const porUsuario: Record<string, { user: any, partidos: any[] }> = {}
    for (const p of pendientes as any[]) {
      for (const u of coachesPorEquipo[p.team_id] || []) {
        porUsuario[u.id] ||= { user: u, partidos: [] }
        porUsuario[u.id].partidos.push(p)
      }
    }

    const textos = Object.values(porUsuario).map(({ user, partidos: ps }) => {
      const lineas = ps.map(p => `• ${p.teams?.name || 'Equipo'} — ${fechaCorta(p.fecha)} ${p.local ? 'vs' : '@'} ${p.rival || 'rival'}`)
      const body = `📄 CONVOCATORIA PENDIENTE\n${lineas.join('\n')}\nRecuerda registrar la convocatoria en la app (pantalla del equipo → Convocatorias).`
      return { user, body }
    })

    if (dry) return NextResponse.json({
      ok: true, dry: true, hoy, desde, hasta,
      partidos: partidos.length, con_convocatoria: partidos.length - pendientes.length,
      mensajes: textos.map(t => ({ para: t.user.name, body: t.body })),
    })

    return NextResponse.json(await enviar(textos, 'Convocatoria pendiente', '📄 Convocatoria pendiente', { hoy, partidos: partidos.length, pendientes: pendientes.length }))
  } catch (err: any) {
    console.error('recordatorio-convocatoria error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

async function enviar(textos: { user: any, body: string }[], subject: string, pushTitle: string, extra: any) {
  // Remitente: el admin (nano si existe)
  const { data: admins } = await supabase.from('app_users').select('id, username').eq('role', 'admin').eq('active', true)
  const remitente = (admins || []).find((u: any) => u.username === 'nano') || (admins || [])[0] || null

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
      const { error } = await supabase.from('messages').insert({ from_user_id: remitente.id, to_user_id: user.id, subject, body })
      if (!error) mensajes++
      else console.error('msg error', user.id, error.message)
    }
    if (!webpush) continue
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', user.id)
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          JSON.stringify({ title: pushTitle, body: body.split('\n').slice(1).join(' '), url: '/mensajeria' })
        )
        pushes++
      } catch (e: any) {
        if (e?.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        console.error('push error', sub.id, e?.message)
      }
    }
  }
  return { ok: true, ...extra, destinatarios: textos.length, mensajes, pushes }
}
