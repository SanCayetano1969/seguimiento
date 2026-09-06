// Utilidades compartidas para convocar jugadores de otros equipos del club.
// Regla acordada: un equipo puede convocar jugadores de equipos de SU MISMA
// categoria o de categorias INFERIORES (nunca de una superior).

import { supabase } from '@/lib/supabase'

// Orden de categorias, de menor a mayor edad.
const ORDEN_CATEGORIAS: string[] = [
  'prebenjamin',
  'benjamin',
  'alevin',
  'infantil',
  'cadete',
  'juvenil',
  'amateur',
]

function norm(s: string | null | undefined) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Rango de una categoria. Si no se reconoce, devuelve 0 (se trata como la mas baja). */
export function rangoCategoria(team: any): number {
  const c = norm(team?.category)
  let i = ORDEN_CATEGORIAS.indexOf(c)
  if (i >= 0) return i + 1
  // Respaldo: intentar deducirla del nombre del equipo (p.ej. "Alevin C")
  const n = norm(team?.name)
  i = ORDEN_CATEGORIAS.findIndex(cat => n.includes(cat))
  return i >= 0 ? i + 1 : 0
}

/** Equipos de los que ESE equipo puede convocar jugadores (misma categoria o inferior, sin el propio). */
export function equiposPermitidos(team: any, todos: any[]): any[] {
  const r = rangoCategoria(team)
  return (todos || [])
    .filter(t => t.id !== team?.id)
    .filter(t => rangoCategoria(t) <= r)
    .sort((a, b) => rangoCategoria(b) - rangoCategoria(a) || (a.name || '').localeCompare(b.name || ''))
}

export type JugadorInvitado = {
  id: string
  name: string
  dorsal: number | null
  position: string | null
  team_id: string
  team_name: string
  team_category: string
  rango: number
}

/**
 * Carga los jugadores activos de los equipos permitidos (misma categoria o inferior).
 * IMPORTANTE: ordenados por CERCANIA de categoria (primero la misma categoria, luego
 * las inferiores). Si se ordenase alfabeticamente, los equipos de la misma categoria
 * quedarian al final de la lista y practicamente ocultos.
 */
export async function cargarJugadoresOtrosEquipos(team: any): Promise<JugadorInvitado[]> {
  const { data: teams } = await supabase.from('teams').select('id, name, category')
  const permitidos = equiposPermitidos(team, teams || [])
  if (!permitidos.length) return []
  const infoPorId: Record<string, { name: string; category: string; rango: number }> = {}
  permitidos.forEach(t => {
    infoPorId[t.id] = { name: t.name, category: t.category || '', rango: rangoCategoria(t) }
  })
  const { data: pls } = await supabase
    .from('players')
    .select('id, name, dorsal, position, team_id')
    .in('team_id', permitidos.map(t => t.id))
    .eq('active', true)
  return (pls || [])
    .map(p => {
      const info = infoPorId[p.team_id] || { name: '', category: '', rango: 0 }
      return { ...p, team_name: info.name, team_category: info.category, rango: info.rango } as JugadorInvitado
    })
    .sort((a, b) =>
      (b.rango - a.rango) ||
      (a.team_name || '').localeCompare(b.team_name || '') ||
      (a.name || '').localeCompare(b.name || '')
    )
}

/** Equipos presentes en un pool de jugadores, en el mismo orden (mas cercano primero). */
export function equiposDelPool(pool: JugadorInvitado[] | null) {
  const out: { id: string; name: string; category: string; rango: number; n: number }[] = []
  ;(pool || []).forEach(p => {
    const ex = out.find(t => t.id === p.team_id)
    if (ex) ex.n++
    else out.push({ id: p.team_id, name: p.team_name, category: p.team_category, rango: p.rango, n: 1 })
  })
  return out
}

/** Normaliza texto para buscar sin tildes ni mayusculas. */
export function buscaTexto(s: string | null | undefined) {
  return norm(s)
}

/** Descripcion corta del partido para cabeceras: "LIGA · JORNADA 5 · LOCAL". */
export const TIPOS_PARTIDO_LBL: Record<string, string> = {
  liga: 'LIGA',
  amistoso: 'AMISTOSO',
  copa: 'COPA / FEDERACION',
  torneo: 'TORNEO',
  otro: 'PARTIDO',
}
