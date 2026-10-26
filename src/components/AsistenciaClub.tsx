'use client'
// /club: asistencia a entrenos por equipo (vista v_asistencia_equipos) y entrenos sin lista en los últimos 7 días.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { colorPct } from '@/lib/asistencia'

export default function AsistenciaClub() {
  const router = useRouter()
  const [filas, setFilas] = useState<any[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.from('v_asistencia_equipos').select('*').order('team_name').then(({ data }) => setFilas(data || []))
  }, [])

  if (!filas) return null
  const conEntrenos = filas.filter((f: any) => Number(f.entrenos) > 0)
  if (!conEntrenos.length) return null

  const pct = (f: any) => {
    const base = Number(f.presentes) + Number(f.faltas)
    return base > 0 ? Math.round(Number(f.presentes) / base * 100) : null
  }
  const tot = conEntrenos.reduce((a: any, f: any) => ({
    presentes: a.presentes + Number(f.presentes), faltas: a.faltas + Number(f.faltas),
    entrenos: a.entrenos + Number(f.entrenos), con_lista: a.con_lista + Number(f.con_lista), sin7: a.sin7 + Number(f.sin_lista_7d),
  }), { presentes: 0, faltas: 0, entrenos: 0, con_lista: 0, sin7: 0 })
  const pctClub = pct(tot)
  const th = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 as const, padding: '4px 3px', textAlign: 'center' as const }
  const td = { fontSize: 12, padding: '5px 3px', textAlign: 'center' as const, borderTop: '1px solid var(--border)' }

  return (
    <>
      <div className="section-title">Asistencia a entrenos</div>
      <div style={{ padding: '0 16px', marginBottom: 8 }}>
        <div className="card" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' as const, fontSize: 13 }}>
            <span>Club <b style={{ color: colorPct(pctClub) }}>{pctClub == null ? '—' : pctClub + '%'}</b></span>
            <span>Con lista <b>{tot.con_lista}/{tot.entrenos}</b></span>
            {tot.sin7 > 0 && <span style={{ color: '#F6AD55' }}>⚠️ {tot.sin7} sin lista (7 días)</span>}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{open ? 'cerrar' : 'por equipo'}</span>
          </div>
          {open && (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginTop: 8 }} onClick={e => e.stopPropagation()}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' as const }}>Equipo</th><th style={th}>%</th><th style={th}>Con lista</th><th style={th}>Sin lista 7 d</th>
              </tr></thead>
              <tbody>
                {conEntrenos.map((f: any) => {
                  const p = pct(f)
                  return (
                    <tr key={f.team_id} style={{ cursor: 'pointer' }} onClick={() => router.push('/equipo?team=' + f.team_id)}>
                      <td style={{ ...td, textAlign: 'left' as const, fontWeight: 600 }}>{f.team_name}</td>
                      <td style={{ ...td, fontWeight: 800, color: colorPct(p) }}>{p == null ? '—' : p + '%'}</td>
                      <td style={td}>{f.con_lista}/{f.entrenos}</td>
                      <td style={{ ...td, color: Number(f.sin_lista_7d) > 0 ? '#F6AD55' : 'var(--text-muted)' }}>{f.sin_lista_7d}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>% = presentes / (presentes + faltas). Lesionados y justificadas no cuentan.</div>
      </div>
    </>
  )
}
