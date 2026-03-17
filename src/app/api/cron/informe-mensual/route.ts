import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const authHeader = req.headers.get('authorization')
  const isManual = searchParams.get('manual') === '1'
  if (!isManual && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Si se pasan parámetros, usar esos (permite generar informe del mes actual)
  const mesParam = searchParams.get('mes')
  const annoParam = searchParams.get('anno')
  const mes = mesParam ? parseInt(mesParam) : (now.getMonth() === 0 ? 12 : now.getMonth())
  const anno = annoParam ? parseInt(annoParam) : (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())
  const primerDiaMes = new Date(anno, mes - 1, 1).toISOString()
  const ultimoDiaMes = new Date(anno, mes, 0, 23, 59, 59).toISOString()

  // Obtener todos los equipos
  const { data: teams } = await supabase.from('teams').select('*').order('name')
  if (!teams?.length) return NextResponse.json({ ok: true, msg: 'No teams' })

  const informes = []

  for (const team of teams) {
    // 1. Todos los partidos de la temporada con resultado
    const { data: allMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', team.id)
      .not('resultado_propio', 'is', null)
      .order('fecha', { ascending: true })

    const temporada = (allMatches || []).reduce((acc: any, m: any) => {
      acc.pj++
      const gf = m.resultado_propio ?? 0
      const gc = m.resultado_rival ?? 0
      acc.gf += gf
      acc.gc += gc
      if (gf > gc) acc.pg++
      else if (gf === gc) acc.pe++
      else acc.pp++
      return acc
    }, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 })

    // 2. Partidos del mes con stats de equipo
    const { data: matchesMes } = await supabase
      .from('matches')
      .select('*')
      .eq('team_id', team.id)
      .gte('fecha', primerDiaMes.split('T')[0])
      .lte('fecha', ultimoDiaMes.split('T')[0])
      .order('fecha', { ascending: true })

    const matchIdsMes = (matchesMes || []).map((m: any) => m.id)

    const { data: statsMes } = matchIdsMes.length > 0
      ? await supabase.from('match_stats_team').select('*').in('match_id', matchIdsMes)
      : { data: [] }

    const partidosMes = (matchesMes || []).map((m: any) => ({
      ...m,
      stats: (statsMes || []).find((s: any) => s.match_id === m.id) || null
    }))

    // 3. Jugadores del equipo
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .order('dorsal', { ascending: true })

    const playerIds = (players || []).map((p: any) => p.id)

    // Stats de toda la temporada por jugador
    const { data: allPlayerStats } = playerIds.length > 0
      ? await supabase.from('player_match_stats').select('*').in('player_id', playerIds)
      : { data: [] }

    // Stats del mes por jugador
    const { data: monthPlayerStats } = playerIds.length > 0 && matchIdsMes.length > 0
      ? await supabase.from('player_match_stats').select('*').in('player_id', playerIds).in('match_id', matchIdsMes)
      : { data: [] }

    // Convocatorias del mes
    const { data: convocatoriasMes } = await supabase
      .from('convocatorias')
      .select('*, convocatoria_jugadores(player_id, estado, motivo_no_disponible, nota_castigo)')
      .eq('team_id', team.id)
      .gte('created_at', primerDiaMes)
      .lte('created_at', ultimoDiaMes)

    const jugadores = (players || []).map((p: any) => {
      const statsTemporada = (allPlayerStats || [])
        .filter((s: any) => s.player_id === p.id)
        .reduce((acc: any, s: any) => ({
          pj: acc.pj + 1,
          minutos: acc.minutos + (s.minutos || 0),
          goles: acc.goles + (s.goles || 0),
          asistencias: acc.asistencias + (s.asistencias || 0),
          amarillas: acc.amarillas + (s.amarillas || 0),
          rojas: acc.rojas + (s.rojas || 0),
        }), { pj: 0, minutos: 0, goles: 0, asistencias: 0, amarillas: 0, rojas: 0 })

      const statsMesJugador = (monthPlayerStats || [])
        .filter((s: any) => s.player_id === p.id)
        .reduce((acc: any, s: any) => ({
          pj: acc.pj + 1,
          minutos: acc.minutos + (s.minutos || 0),
          goles: acc.goles + (s.goles || 0),
          asistencias: acc.asistencias + (s.asistencias || 0),
          amarillas: acc.amarillas + (s.amarillas || 0),
          rojas: acc.rojas + (s.rojas || 0),
        }), { pj: 0, minutos: 0, goles: 0, asistencias: 0, amarillas: 0, rojas: 0 })

      // Convocatorias del mes para este jugador
      const convocatoriasJugador = (convocatoriasMes || []).map((c: any) => {
        const cj = (c.convocatoria_jugadores || []).find((x: any) => x.player_id === p.id)
        const match = matchesMes?.find((m: any) =>
          m.jornada === c.jornada_numero || m.rival === c.rival
        )
        return {
          jornada: c.jornada_numero,
          rival: c.rival,
          fecha: c.fecha,
          estado: cj?.estado || 'no_convocado',
          motivo: cj?.motivo_no_disponible || null,
          nota_castigo: cj?.nota_castigo || null,
        }
      })

      return {
        id: p.id,
        dorsal: p.dorsal,
        nombre: p.name,
        posicion: p.posicion,
        temporada: statsTemporada,
        mes: statsMesJugador,
        convocatorias_mes: convocatoriasJugador,
      }
    })

    const informe = {
      team_id: team.id,
      team_name: team.name,
      mes,
      anno,
      temporada,
      partidos_mes: partidosMes,
      jugadores,
    }

    // Guardar en Supabase
    await supabase.from('monthly_reports').upsert({
      mes,
      anyo: anno,
      team_id: team.id,
      contenido: informe,
    }, { onConflict: 'mes,año,team_id' })

    informes.push({ team: team.name, pj_mes: partidosMes.length })
  }

  // Enviar push a coordinadores
  const { data: coordinators } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')

  const { data: coordUsers } = await supabase
    .from('users')
    .select('id')
    .in('role', ['coordinator', 'admin'])

  const coordIds = new Set((coordUsers || []).map((u: any) => u.id))
  const coordSubs = (coordinators || []).filter((s: any) => coordIds.has(s.user_id))

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  for (const sub of coordSubs) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.subscription,
          title: 'Informe mensual disponible',
          body: `Informe de ${MESES[mes-1]} ${anno} generado para todos los equipos`,
          url: '/club?tab=informes'
        })
      })
    } catch (e) { /* silenciar errores de push */ }
  }

  return NextResponse.json({ ok: true, mes, anno, equipos: informes })
}
