// Cálculos comunes de estadísticas de partido (player_match_stats).
// Lo usan la ficha del jugador, «Estadísticas equipo», la exportación de la plantilla
// y el informe mensual, para que todos cuenten igual.

// Métricas numéricas de player_match_stats que se suman.
export const STAT_KEYS = [
  'minutos', 'goles', 'asistencias', 'tiros', 'tiros_puerta', 'recuperaciones', 'intercepciones',
  'entradas', 'pases_completos', 'pases_fallados', 'faltas_cometidas', 'faltas_recibidas',
  'amarillas', 'rojas', 'paradas',
] as const

export type StatKey = typeof STAT_KEYS[number]
export type Totales = Record<StatKey, number> & { pj: number }

// ¿Cuenta como partido jugado? Titular, o con minutos, o con algún periodo jugado.
// Un suplente que no llega a salir NO cuenta (decisión del club, 26/10/2026).
export function jugoPartido(s: any): boolean {
  return !!s && (!!s.titular || (s.minutos || 0) > 0 || (Array.isArray(s.cuartos_jugados) && s.cuartos_jugados.length > 0))
}

export function totalesVacios(): Totales {
  const t: any = { pj: 0 }
  STAT_KEYS.forEach(k => { t[k] = 0 })
  return t
}

// Suma una lista de filas de player_match_stats
export function sumarStats(filas: any[]): Totales {
  const t = totalesVacios()
  ;(filas || []).forEach(s => {
    if (jugoPartido(s)) t.pj++
    STAT_KEYS.forEach(k => { t[k] += Number(s?.[k]) || 0 })
  })
  return t
}

// Totales por jugador: player_id → Totales
export function totalesPorJugador(filas: any[]): Record<string, Totales> {
  const grupos: Record<string, any[]> = {}
  ;(filas || []).forEach(s => { (grupos[s.player_id] = grupos[s.player_id] || []).push(s) })
  const out: Record<string, Totales> = {}
  Object.keys(grupos).forEach(pid => { out[pid] = sumarStats(grupos[pid]) })
  return out
}

export function esPortero(p: any): boolean {
  return /port|gk|keeper/i.test(p?.position || '')
}
