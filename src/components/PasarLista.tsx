'use client'
// Pasar lista de un entreno: plantilla del equipo con todos «presentes» por defecto;
// el entrenador solo toca a los que faltan. Guarda en asistencia_entrenos (una fila por jugador).
import { useEffect, useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'
import { ESTADOS_ASISTENCIA, type EstadoAsistencia } from '@/lib/asistencia'

type Fila = { estado: EstadoAsistencia; motivo: string }

function ordenarPorDorsal(ps: any[]) {
  return [...ps].sort((a, b) => {
    const da = a.dorsal ?? null, db = b.dorsal ?? null
    if (da != null && db != null) return da - db
    if (da != null) return -1
    if (db != null) return 1
    return (a.name || '').localeCompare(b.name || '', 'es')
  })
}

export default function PasarLista({ event, onClose, onSaved }: { event: any; onClose: () => void; onSaved?: () => void }) {
  const session = getSession()
  const [jugadores, setJugadores] = useState<any[]>([])
  const [filas, setFilas] = useState<Record<string, Fila>>({})
  const [yaPasada, setYaPasada] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [{ data: pl }, { data: ex }] = await Promise.all([
        supabase.from('players').select('id, name, dorsal, position, team_id, active').eq('team_id', event.team_id).eq('active', true),
        supabase.from('asistencia_entrenos').select('*').eq('event_id', event.id),
      ])
      let lista = pl || []
      // Jugadores que ya tienen asistencia en este entreno aunque ya no estén en la plantilla activa
      const faltan = (ex || []).map((r: any) => r.player_id).filter((id: string) => !lista.some((p: any) => p.id === id))
      if (faltan.length) {
        const { data: extra } = await supabase.from('players').select('id, name, dorsal, position, team_id, active').in('id', faltan)
        lista = [...lista, ...(extra || [])]
      }
      const f: Record<string, Fila> = {}
      lista.forEach((p: any) => { f[p.id] = { estado: 'presente', motivo: '' } })
      ;(ex || []).forEach((r: any) => { f[r.player_id] = { estado: r.estado, motivo: r.motivo || '' } })
      if (!vivo) return
      setJugadores(ordenarPorDorsal(lista))
      setFilas(f)
      setYaPasada((ex || []).length > 0)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [event.id])

  function setEstado(pid: string, estado: EstadoAsistencia) {
    setFilas(f => ({ ...f, [pid]: { estado, motivo: estado === 'presente' ? '' : (f[pid]?.motivo || '') } }))
  }

  async function guardar() {
    if (!session) return
    setGuardando(true); setError('')
    const ahora = new Date().toISOString()
    const payload = jugadores.map((p: any) => ({
      event_id: event.id,
      player_id: p.id,
      team_id: event.team_id,
      estado: filas[p.id]?.estado || 'presente',
      motivo: (filas[p.id]?.estado !== 'presente' && filas[p.id]?.motivo?.trim()) || null,
      created_by: session.id,
      updated_at: ahora,
    }))
    const { error: err } = await supabase.from('asistencia_entrenos').upsert(payload, { onConflict: 'event_id,player_id' })
    setGuardando(false)
    if (err) { setError('No se pudo guardar: ' + err.message); return }
    onSaved?.()
    onClose()
  }

  const cuenta = (v: EstadoAsistencia) => jugadores.filter((p: any) => filas[p.id]?.estado === v).length
  const fechaTxt = event.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <h3 style={{ fontWeight: 700, marginBottom: 2 }}>📋 Pasar lista</h3>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'capitalize' as const }}>
          {event.teams?.name ? event.teams.name + ' · ' : ''}{fechaTxt}{event.time ? ' · ' + String(event.time).slice(0, 5) + 'h' : ''}
        </div>

        {cargando ? (
          <div className="empty-state"><div className="loader animate-spin" /></div>
        ) : jugadores.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Este equipo no tiene jugadores activos.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 10 }}>
              {ESTADOS_ASISTENCIA.map(e => <span key={e.v}>{e.icon} <b>{cuenta(e.v)}</b></span>)}
              {yaPasada && <span style={{ color: '#68D391', marginLeft: 'auto' }}>✓ Lista ya pasada (puedes corregirla)</span>}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }}
              onClick={() => setFilas(f => { const n = { ...f }; jugadores.forEach((p: any) => { n[p.id] = { estado: 'presente', motivo: '' } }); return n })}>
              ✅ Todos presentes
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {jugadores.map((p: any) => {
                const f = filas[p.id] || { estado: 'presente', motivo: '' }
                return (
                  <div key={p.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 10px',
                    borderLeft: '3px solid ' + (ESTADOS_ASISTENCIA.find(e => e.v === f.estado)?.color || 'transparent') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: 'var(--gold)', minWidth: 26, textAlign: 'right' as const, fontSize: 13 }}>{p.dorsal ?? '·'}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}{p.team_id !== event.team_id || p.active === false ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> (ya no está en la plantilla)</span> : null}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {ESTADOS_ASISTENCIA.map(e => (
                          <button key={e.v} title={e.label} onClick={() => setEstado(p.id, e.v)}
                            style={{ width: 34, height: 32, borderRadius: 8, fontSize: 15, cursor: 'pointer',
                              border: '1px solid ' + (f.estado === e.v ? e.color : 'var(--border)'),
                              background: f.estado === e.v ? e.color + '33' : 'var(--surface)',
                              opacity: f.estado === e.v ? 1 : 0.55 }}>{e.icon}</button>
                        ))}
                      </div>
                    </div>
                    {f.estado !== 'presente' && (
                      <input className="input" style={{ marginTop: 6, fontSize: 12, height: 32 }} placeholder="Motivo (opcional)"
                        value={f.motivo} onChange={e => { const v = e.target.value; setFilas(fs => ({ ...fs, [p.id]: { ...fs[p.id], motivo: v } })) }} />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {error && <div style={{ color: '#FC8181', fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost btn-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold btn-full" onClick={guardar} disabled={guardando || cargando || jugadores.length === 0}>
            {guardando ? 'Guardando...' : (yaPasada ? 'Actualizar lista' : 'Guardar lista')}
          </button>
        </div>
      </div>
    </div>
  )
}
