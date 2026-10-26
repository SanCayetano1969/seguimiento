// Asistencia a entrenos (tabla asistencia_entrenos). Reglas acordadas con el club el 26/10/2026:
// - 4 estados: presente, falta, lesionado, justificada.
// - % de asistencia = presentes / (sesiones − justificadas − lesionado).
// - Pasan lista: el entrenador de ese equipo, coordinadores y admin. Solo entrenos de hoy o pasados, sin límite para corregir.
// - Los entrenos marcados «sin instalación» no cuentan.

export type EstadoAsistencia = 'presente' | 'falta' | 'lesionado' | 'justificada'

export const ESTADOS_ASISTENCIA: { v: EstadoAsistencia; icon: string; label: string; color: string }[] = [
  { v: 'presente',    icon: '✅', label: 'Presente',    color: '#22c55e' },
  { v: 'falta',       icon: '❌', label: 'Falta',       color: '#ef4444' },
  { v: 'lesionado',   icon: '🩹', label: 'Lesionado',   color: '#f59e0b' },
  { v: 'justificada', icon: '📝', label: 'Justificada', color: '#3b82f6' },
]
export const estadoInfo = (v: string) => ESTADOS_ASISTENCIA.find(e => e.v === v) || ESTADOS_ASISTENCIA[0]

// Fecha de hoy en Madrid (YYYY-MM-DD)
export function hoyMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function esEntrenoConLista(ev: any): boolean {
  return !!ev && ev.type === 'entrenamiento' && !!ev.team_id && !ev.sin_instalacion
}

export function puedePasarLista(session: any, ev: any): boolean {
  if (!session || !esEntrenoConLista(ev)) return false
  if ((ev.date || '') > hoyMadrid()) return false
  if (['admin', 'coordinator'].includes(session.role)) return true
  return session.role === 'coach' && (session.team_ids || []).includes(ev.team_id)
}

export type ResumenAsistencia = {
  sesiones: number; presentes: number; faltas: number; lesionado: number; justificadas: number
  pct: number | null   // null si no hay sesiones que cuenten
}

// Filas de asistencia_entrenos (con events(sin_instalacion) si se ha pedido el join).
export function resumenAsistencia(filas: any[]): ResumenAsistencia {
  const r: ResumenAsistencia = { sesiones: 0, presentes: 0, faltas: 0, lesionado: 0, justificadas: 0, pct: null }
  ;(filas || []).forEach(f => {
    if (f?.events?.sin_instalacion) return
    r.sesiones++
    if (f.estado === 'presente') r.presentes++
    else if (f.estado === 'falta') r.faltas++
    else if (f.estado === 'lesionado') r.lesionado++
    else if (f.estado === 'justificada') r.justificadas++
  })
  const base = r.sesiones - r.justificadas - r.lesionado
  r.pct = base > 0 ? Math.round((r.presentes / base) * 100) : null
  return r
}

export function resumenPorJugador(filas: any[]): Record<string, ResumenAsistencia> {
  const g: Record<string, any[]> = {}
  ;(filas || []).forEach(f => { (g[f.player_id] = g[f.player_id] || []).push(f) })
  const out: Record<string, ResumenAsistencia> = {}
  Object.keys(g).forEach(pid => { out[pid] = resumenAsistencia(g[pid]) })
  return out
}

export function colorPct(pct: number | null): string {
  if (pct == null) return 'var(--text-muted)'
  if (pct >= 85) return '#22c55e'
  if (pct >= 70) return '#eab308'
  return '#ef4444'
}

// Supabase devuelve como máximo 1000 filas por consulta: esto trae todas, por bloques.
// Uso: await traerTodas((d, h) => supabase.from('x').select('*').eq(...).range(d, h))
export async function traerTodas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: any[] | null }>): Promise<any[]> {
  const out: any[] = []
  for (let i = 0; i < 100000; i += 1000) {
    const { data } = await consulta(i, i + 999)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}
