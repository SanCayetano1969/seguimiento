'use client'
// Asistencia a entrenos de un jugador (ficha): % de temporada y del mes + faltas con motivo.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resumenAsistencia, estadoInfo, colorPct, hoyMadrid } from '@/lib/asistencia'

export default function AsistenciaJugador({ playerId }: { playerId: string }) {
  const [filas, setFilas] = useState<any[] | null>(null)

  useEffect(() => {
    let vivo = true
    setFilas(null)
    supabase.from('asistencia_entrenos')
      .select('*, events(date, time, sin_instalacion, team_id, teams(name))')
      .eq('player_id', playerId)
      .then(({ data }) => {
        if (!vivo) return
        const ord = (data || []).sort((a: any, b: any) => (b.events?.date || '').localeCompare(a.events?.date || ''))
        setFilas(ord)
      })
    return () => { vivo = false }
  }, [playerId])

  if (filas === null || filas.length === 0) return null
  const mes = hoyMadrid().slice(0, 7)
  const tot = resumenAsistencia(filas)
  const delMes = resumenAsistencia(filas.filter((f: any) => (f.events?.date || '').startsWith(mes)))
  const ausencias = filas.filter((f: any) => f.estado !== 'presente' && !f.events?.sin_instalacion)

  const Caja = ({ titulo, r }: { titulo: string, r: any }) => (
    <div style={{ flex: 1, textAlign: 'center' as const, background: 'var(--surface)', borderRadius: 8, padding: '8px 6px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: colorPct(r.pct) }}>{r.pct == null ? '—' : r.pct + '%'}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{titulo} · {r.presentes}/{r.sesiones - r.justificadas - r.lesionado}</div>
    </div>
  )

  return (
    <div style={{ margin: '16px 0', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Asistencia a entrenos</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Caja titulo="Temporada" r={tot} />
        <Caja titulo="Este mes" r={delMes} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
        <span>{tot.sesiones} entrenos con lista</span>
        <span>❌ {tot.faltas}</span><span>🩹 {tot.lesionado}</span><span>📝 {tot.justificadas}</span>
      </div>
      {ausencias.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: 'var(--gold)', cursor: 'pointer' }}>Ausencias ({ausencias.length})</summary>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 6 }}>
            {ausencias.map((f: any) => {
              const e = estadoInfo(f.estado)
              const d = f.events?.date ? new Date(f.events.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
              return (
                <div key={f.id} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{e.icon}</span><span style={{ minWidth: 92 }}>{d}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{e.label}{f.motivo ? ' — ' + f.motivo : ''}</span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
