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
}

/**
 * Carga los jugadores activos de los equipos permitidos (misma categoria o inferior).
 * Devuelve la lista lista para el buscador, con el nombre del equipo de origen.
 */
export async function cargarJugadoresOtrosEquipos(team: any): Promise<JugadorInvitado[]> {
  const { data: teams } = await supabase.from('teams').select('id, name, category')
  const permitidos = equiposPermitidos(team, teams || [])
  if (!permitidos.length) return []
  const nombrePorId: Record<string, string> = {}
  permitidos.forEach(t => { nombrePorId[t.id] = t.name })
  const { data: pls } = await supabase
    .from('players')
    .select('id, name, dorsal, position, team_id')
    .in('team_id', permitidos.map(t => t.id))
    .eq('active', true)
  return (pls || [])
    .map(p => ({ ...p, team_name: nombrePorId[p.team_id] || '' } as JugadorInvitado))
    .sort((a, b) =>
      (a.team_name || '').localeCompare(b.team_name || '') ||
      (a.name || '').localeCompare(b.name || '')
    )
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
