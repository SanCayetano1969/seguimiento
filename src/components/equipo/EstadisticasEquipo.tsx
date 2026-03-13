'use client'
import { useState, useEffect } from 'react'
import { supabase, getSession } from '@/lib/supabase'

interface Props { team: any; matches: any[] }

const PERIODOS_F8_INF = ['1º cuarto','2º cuarto','3º cuarto','4º cuarto']
const PERIODOS_RESTO  = ['0-15','15-30','30-45','45-60','60-75','75-90']
const ZONAS_REMATE    = ['Extremo','Frontal área','Dentro área']
const TIPO_REMATE     = ['Cabeza','Pie D','Pie I']
const TOQUES          = ['1 toque','2 toques','+2 toques']
const ZONAS_INICIO    = ['Carril ext der','Carril int der','Pasillo central','Carril int izq','Carril ext izq']
const TIPO_JUGADA     = ['Combinativa','Juego directo','Contraataque','ABP']
const TIPO_ABP        = ['Corner','Falta lateral','Falta frontal','Saque de banda','Penalti']

function isF8oInfantil(team: any) {
  const n = (team?.name||'').toLowerCase()
  return n.includes('infantil') || n.includes('alevin') || team?.format === 'F8'
}

function emptyGol() {
  return { periodo:'', zona_remate:'', tipo_remate:'', toques:'', zona_inicio:'', tipo_jugada:'', tipo_abp:'' }
}

function GolDetalle({ goles, onChange, periodos }: { goles: any[], onChange: (g: any[]) => void, periodos: string[] }) {
  function update(i: number, key: string, v: string) {
    const next = goles.map((g, idx) => idx === i ? { ...g, [key]: v } : g)
    onChange(next)
  }
  return (
    <div style={{ marginTop: 8 }}>
      {goles.map((g, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Gol {i + 1}</span>
            <button onClick={() => onChange(goles.filter((_,idx) => idx !== i))}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>x</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { key: 'periodo',     label: 'Periodo',       opts: periodos },
              { key: 'zona_remate', label: 'Zona remate',   opts: ZONAS_REMATE },
              { key: 'tipo_remate', label: 'Tipo remate',   opts: TIPO_REMATE },
              { key: 'toques',      label: 'N toques',      opts: TOQUES },
              { key: 'zona_inicio', label: 'Zona inicio',   opts: ZONAS_INICIO },
              { key: 'tipo_jugada', label: 'Tipo jugada',   opts: TIPO_JUGADA },
            ].map(({ key, label, opts }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <select className='input' style={{ fontSize: 11, height: 28, padding: '0 6px' }}
                  value={g[key]} onChange={e => update(i, key, e.target.value)}>
                  <option value=''>-</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {g.tipo_jugada === 'ABP' && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Tipo ABP</div>
                <select className='input' style={{ fontSize: 11, height: 28, padding: '0 6px' }}
                  value={g.tipo_abp} onChange={e => update(i, 'tipo_abp', e.target.value)}>
                  <option value=''>-</option>
                  {TIPO_ABP.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...goles, emptyGol()])}
        style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)',
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%', marginTop: 2 }}>
        + Detalle gol
      </button>
    </div>
  )
}

export default function EstadisticasEquipo({ team, matches }: Props) {
  const session = getSession()
  const canEdit = session?.role === 'admin' || session?.role === 'coordinator' || session?.role === 'coach'
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<Record<string, any>>({})
  const [forms, setForms] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const periodos = isF8oInfantil(team) ? PERIODOS_F8_INF : PERIODOS_RESTO
  const partidos = matches.filter(m => m.resultado_propio !== null)

  useEffect(() => {
    if (!open || partidos.length === 0) return
    const ids = partidos.map(m => m.id)
    supabase.from('match_stats_team').select('*').in('match_id', ids)
      .then(({ data }) => {
        const map: Record<string, any> = {}
        data?.forEach(d => { map[d.match_id] = d })
        setStats(map)
        const initForms: Record<string, any> = {}
        partidos.forEach(m => {
          const s = map[m.id]
          initForms[m.id] = {
            goles_marcados:    s?.goles_marcados ?? (m.resultado_propio ?? 0),
            goles_encajados:   s?.goles_encajados ?? (m.resultado_rival ?? 0),
            amarillas:         s?.tarjetas_amarillas ?? 0,
            rojas:             s?.tarjetas_rojas ?? 0,
            detalle_marcados:  s?.goles_marcados_detalle ?? [],
            detalle_encajados: s?.goles_encajados_detalle ?? [],
          }
        })
        setForms(initForms)
      })
  }, [open])

  function updateForm(matchId: string, key: string, val: any) {
    setForms(f => ({ ...f, [matchId]: { ...f[matchId], [key]: val } }))
  }

  async function saveMatch(matchId: string) {
    setSaving(matchId)
    const f = forms[matchId]
    const payload = {
      match_id: matchId, team_id: team.id,
      goles_marcados: f.goles_marcados, goles_encajados: f.goles_encajados,
      tarjetas_amarillas: f.amarillas, tarjetas_rojas: f.rojas,
      goles_marcados_detalle: f.detalle_marcados,
      goles_encajados_detalle: f.detalle_encajados,
      updated_at: new Date().toISOString(),
    }
    const existing = stats[matchId]
    if (existing) {
      await supabase.from('match_stats_team').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('match_stats_team').insert(payload)
    }
    setStats(s => ({ ...s, [matchId]: { ...s[matchId], ...payload } }))
    setSaving(null)
  }

  const totales = partidos.reduce((acc, m) => {
    const s = stats[m.id]
    return {
      gf: acc.gf + (s?.goles_marcados ?? m.resultado_propio ?? 0),
      gc: acc.gc + (s?.goles_encajados ?? m.resultado_rival ?? 0),
      am: acc.am + (s?.tarjetas_amarillas ?? 0),
      ro: acc.ro + (s?.tarjetas_rojas ?? 0),
    }
  }, { gf: 0, gc: 0, am: 0, ro: 0 })

  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>Estadisticas equipo</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? 'cerrar' : 'ver todo'}</span>
        </div>
        {!open && partidos.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            <span style={{ fontSize: 12 }}>GF <strong style={{ color: '#22c55e' }}>{totales.gf}</strong></span>
            <span style={{ fontSize: 12 }}>GC <strong style={{ color: '#ef4444' }}>{totales.gc}</strong></span>
            <span style={{ fontSize: 12 }}>Amarillas <strong>{totales.am}</strong></span>
            <span style={{ fontSize: 12 }}>Rojas <strong>{totales.ro}</strong></span>
          </div>
        )}
      </button>
      {open && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {partidos.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Sin partidos con resultado</div>
          )}
          {partidos.map(m => {
            const f = forms[m.id] || {}
            const rival = m.local ? 'San Cayetano vs ' + m.rival : m.rival + ' vs San Cayetano'
            return (
              <div key={m.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>J{m.jornada} - {rival}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{m.resultado_propio}-{m.resultado_rival}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    { key: 'goles_marcados',  label: 'GF', color: '#22c55e' },
                    { key: 'goles_encajados', label: 'GC', color: '#ef4444' },
                    { key: 'amarillas',       label: 'Amarillas', color: '#eab308' },
                    { key: 'rojas',           label: 'Rojas', color: '#ef4444' },
                  ].map(({ key, label, color }) => (
                    <div key={key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <button onClick={() => updateForm(m.id, key, Math.max(0, (f[key]||0) - 1))}
                          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)',
                            background: 'var(--surface2)', cursor: 'pointer', color: 'var(--text)', fontWeight: 700 }}>-</button>
                        <span style={{ fontWeight: 800, fontSize: 15, color, minWidth: 18, textAlign: 'center' }}>{f[key] ?? 0}</span>
                        <button onClick={() => updateForm(m.id, key, (f[key]||0) + 1)}
                          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)',
                            background: 'var(--surface2)', cursor: 'pointer', color: 'var(--text)', fontWeight: 700 }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <>
                    <details style={{ marginBottom: 6 }}>
                      <summary style={{ fontSize: 12, color: 'var(--gold)', cursor: 'pointer' }}>Detalle goles marcados ({(f.detalle_marcados||[]).length})</summary>
                      <GolDetalle goles={f.detalle_marcados || []} periodos={periodos} onChange={g => updateForm(m.id, 'detalle_marcados', g)} />
                    </details>
                    <details style={{ marginBottom: 10 }}>
                      <summary style={{ fontSize: 12, color: 'var(--gold)', cursor: 'pointer' }}>Detalle goles encajados ({(f.detalle_encajados||[]).length})</summary>
                      <GolDetalle goles={f.detalle_encajados || []} periodos={periodos} onChange={g => updateForm(m.id, 'detalle_encajados', g)} />
                    </details>
                  </>
                )}
                <button className='btn btn-gold' style={{ width: '100%', height: 32, fontSize: 12 }}
                  onClick={() => saveMatch(m.id)} disabled={saving === m.id}>
                  {saving === m.id ? 'Guardando...' : 'Guardar jornada'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}