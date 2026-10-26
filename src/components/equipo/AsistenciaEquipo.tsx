'use client'
// Asistencia a entrenos del equipo: entrenos sin lista (con botón para pasarla), últimos entrenos
// y % por jugador (de menor a mayor). Reglas en src/lib/asistencia.ts.
import { useEffect, useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'
import PasarLista from '@/components/PasarLista'
import { resumenAsistencia, resumenPorJugador, puedePasarLista, colorPct, hoyMadrid, traerTodas } from '@/lib/asistencia'

export default function AsistenciaEquipo({ team, players }: { team: any; players: any[] }) {
  const session = getSession()
  const [open, setOpen] = useState(false)
  const [entrenos, setEntrenos] = useState<any[]>([])
  const [filas, setFilas] = useState<any[]>([])
  const [listaEvent, setListaEvent] = useState<any>(null)
  const [verTodos, setVerTodos] = useState(false)

  async function cargar() {
    const hoy = hoyMadrid()
    const [ev, as] = await Promise.all([
      traerTodas((d, h) => supabase.from('events').select('id, date, time, title, type, team_id, sin_instalacion, location, teams(name)')
        .eq('team_id', team.id).eq('type', 'entrenamiento').lte('date', hoy)
        .order('date', { ascending: false }).order('time', { ascending: false }).range(d, h)),
      traerTodas((d, h) => supabase.from('asistencia_entrenos').select('*, events(date, sin_instalacion)').eq('team_id', team.id).order('id').range(d, h)),
    ])
    setEntrenos(ev || [])
    setFilas(as || [])
  }
  useEffect(() => { cargar() }, [team.id])

  const porEvento: Record<string, any[]> = {}
  filas.forEach((f: any) => { (porEvento[f.event_id] = porEvento[f.event_id] || []).push(f) })
  const validos = entrenos.filter((e: any) => !e.sin_instalacion)
  const sinLista = validos.filter((e: any) => !porEvento[e.id])
  const conLista = validos.length - sinLista.length
  const equipo = resumenAsistencia(filas)
  const porJugador = resumenPorJugador(filas)
  const nombres: Record<string, any> = {}
  players.forEach((p: any) => { nombres[p.id] = p })
  const filasJugador = Object.entries(porJugador)
    .map(([pid, r]) => ({ pid, r, p: nombres[pid] }))
    .sort((a, b) => (a.r.pct ?? 101) - (b.r.pct ?? 101) || (a.p?.dorsal ?? 999) - (b.p?.dorsal ?? 999))
  const fecha = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const puede = (e: any) => puedePasarLista(session, { ...e, type: 'entrenamiento' })
  const ultimos = verTodos ? validos : validos.slice(0, 8)

  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>Asistencia entrenos</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? 'cerrar' : 'ver todo'}</span>
        </div>
        {!open && validos.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, flexWrap: 'wrap' as const }}>
            <span>Asistencia <strong style={{ color: colorPct(equipo.pct) }}>{equipo.pct == null ? '—' : equipo.pct + '%'}</strong></span>
            <span>Con lista <strong>{conLista}/{validos.length}</strong></span>
            {sinLista.length > 0 && <span style={{ color: '#F6AD55' }}>⚠️ {sinLista.length} sin lista</span>}
          </div>
        )}
      </button>

      {open && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 14px' }}>
          {validos.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' as const, padding: 12 }}>Aún no ha habido entrenos</div>}

          {/* Últimos entrenos */}
          {validos.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' as const, letterSpacing: 1, margin: '4px 0 8px' }}>Entrenos</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, marginBottom: 6 }}>
                {ultimos.map((e: any) => {
                  const fs = porEvento[e.id]
                  const pres = fs ? fs.filter((f: any) => f.estado === 'presente').length : 0
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--surface2)', borderRadius: 8, padding: '6px 10px' }}>
                      <span style={{ minWidth: 96, textTransform: 'capitalize' as const }}>{fecha(e.date)}{e.time ? ' ' + String(e.time).slice(0, 5) : ''}</span>
                      {fs
                        ? <span style={{ color: 'var(--text-muted)', flex: 1 }}>✅ {pres}/{fs.length}</span>
                        : <span style={{ color: '#F6AD55', flex: 1 }}>sin lista</span>}
                      {puede(e) && (
                        <button className={'btn btn-sm ' + (fs ? 'btn-ghost' : 'btn-gold')} style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setListaEvent(e)}>{fs ? 'Corregir' : '📋 Pasar lista'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {validos.length > 8 && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, marginBottom: 10 }} onClick={() => setVerTodos(v => !v)}>
                  {verTodos ? 'Ver menos' : 'Ver los ' + validos.length + ' entrenos'}
                </button>
              )}
            </>
          )}

          {/* Por jugador */}
          {filasJugador.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' as const, letterSpacing: 1, margin: '10px 0 6px' }}>
                Por jugador (temporada) · equipo {equipo.pct == null ? '—' : equipo.pct + '%'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead><tr>
                  {['Jugador', '%', '✅', '❌', '🩹', '📝'].map((h, i) => (
                    <th key={h} style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, padding: '4px 3px', textAlign: i === 0 ? 'left' as const : 'center' as const }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filasJugador.map(({ pid, r, p }) => (
                    <tr key={pid}>
                      <td style={{ fontSize: 12, padding: '4px 3px', borderTop: '1px solid var(--border)' }}>
                        {p?.dorsal != null && <b style={{ color: 'var(--accent)' }}>#{p.dorsal} </b>}{p?.name || '(ya no está en la plantilla)'}
                      </td>
                      <td style={{ fontSize: 12, padding: '4px 3px', textAlign: 'center' as const, borderTop: '1px solid var(--border)', fontWeight: 800, color: colorPct(r.pct) }}>{r.pct == null ? '—' : r.pct + '%'}</td>
                      {[r.presentes, r.faltas, r.lesionado, r.justificadas].map((v, i) => (
                        <td key={i} style={{ fontSize: 12, padding: '4px 3px', textAlign: 'center' as const, borderTop: '1px solid var(--border)' }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                % = presentes / (entrenos con lista − lesionado − justificadas). No cuentan los entrenos sin instalación.
              </div>
            </>
          )}
        </div>
      )}

      {listaEvent && <PasarLista event={listaEvent} onClose={() => setListaEvent(null)} onSaved={cargar} />}
    </div>
  )
}
