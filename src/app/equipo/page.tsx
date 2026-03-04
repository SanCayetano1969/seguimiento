'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Player = { id: string; name: string; dorsal: number; position: string }
type Jornada = { id: string; number: number; date: string | null; type: string | null }
type EvalRow = Record<string, number | string | null>

const FISICA_FIELDS = ['velocidad','resistencia','fuerza','coordinacion','agilidad','reaccion']
const TEC_FIELDS    = ['tec1','tec2','tec3','tec4','tec5','tec6']
const TAC_FIELDS    = ['tac1','tac2','tac3','tac4']
const PSICO_FIELDS  = ['actitud','concentracion','confianza','trabajo_equipo','gestion_error','competitividad','fairplay']

const FIELD_LABELS: Record<string,string> = {
  velocidad:'Velocidad', resistencia:'Resistencia', fuerza:'Fuerza/Potencia',
  coordinacion:'Coordinación', agilidad:'Agilidad', reaccion:'Reacción',
  tec1:'Técnica 1', tec2:'Técnica 2', tec3:'Técnica 3', tec4:'Técnica 4', tec5:'Técnica 5', tec6:'Técnica 6',
  tac1:'Táctica 1', tac2:'Táctica 2', tac3:'Táctica 3', tac4:'Táctica 4',
  actitud:'Actitud/Esfuerzo', concentracion:'Concentración', confianza:'Confianza',
  trabajo_equipo:'Trabajo en equipo', gestion_error:'Gestión del error',
  competitividad:'Competitividad', fairplay:'Respeto/Fair play',
}

function avg(vals: (number | null | undefined)[]) {
  const v = vals.filter((x): x is number => x !== null && x !== undefined && !isNaN(Number(x))).map(Number)
  return v.length ? Math.round(v.reduce((a,b) => a+b, 0) / v.length * 10) / 10 : null
}

function scoreColor(v: number | null) {
  if (!v) return 'var(--text-muted)'
  if (v >= 8) return 'var(--green)'
  if (v >= 6) return 'var(--gold)'
  if (v >= 4) return 'var(--orange)'
  return 'var(--red)'
}

export default function EquipoPage() {
  const router = useRouter()
  const [teamId, setTeamId]     = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [players, setPlayers]   = useState<Player[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [activeJornada, setActiveJornada] = useState<Jornada | null>(null)
  const [evals, setEvals]       = useState<Record<string, EvalRow>>({})
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState<'jornada' | 'plantilla' | 'resumen'>('jornada')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer]   = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    const tid  = sessionStorage.getItem('team_id')
    const tname= sessionStorage.getItem('team_name')
    if (role !== 'coach' || !tid) { router.push('/'); return }
    setTeamId(tid)
    setTeamName(tname || '')
    loadData(tid)
  }, [router])

  const loadData = useCallback(async (tid: string) => {
    const [{ data: pData }, { data: jData }] = await Promise.all([
      supabase.from('players').select('id,name,dorsal,position').eq('team_id', tid).eq('active', true).order('dorsal'),
      supabase.from('jornadas').select('*').eq('team_id', tid).order('number'),
    ])
    setPlayers(pData || [])
    setJornadas(jData || [])
    if (jData && jData.length > 0) {
      const last = jData[jData.length - 1]
      setActiveJornada(last)
      loadEvals(last.id, pData || [])
    }
  }, [])

  const loadEvals = useCallback(async (jornadaId: string, pList: Player[]) => {
    const { data } = await supabase.from('evaluations').select('*').eq('jornada_id', jornadaId)
    const map: Record<string, EvalRow> = {}
    pList.forEach(p => { map[p.id] = { player_id: p.id } })
    ;(data || []).forEach(e => { map[e.player_id] = e })
    setEvals(map)
  }, [])

  async function createJornada() {
    if (!teamId) return
    const num = jornadas.length + 1
    const { data, error } = await supabase
      .from('jornadas').insert({ team_id: teamId, number: num, type: 'Liga' }).select().single()
    if (!error && data) {
      const updated = [...jornadas, data]
      setJornadas(updated)
      setActiveJornada(data)
      loadEvals(data.id, players)
    }
  }

  function handleEvalChange(playerId: string, field: string, value: string) {
    const num = value === '' ? null : Math.min(10, Math.max(0, parseFloat(value)))
    setEvals(prev => ({ ...prev, [playerId]: { ...prev[playerId], [field]: num } }))
  }

  async function saveEvals() {
    if (!activeJornada || !teamId) return
    setSaving(true)
    const rows = players.map(p => {
      const e = evals[p.id] || {}
      return {
        jornada_id: activeJornada.id,
        player_id: p.id,
        team_id: teamId,
        ...Object.fromEntries(
          [...FISICA_FIELDS, ...TEC_FIELDS, ...TAC_FIELDS, ...PSICO_FIELDS, 'minutos', 'notas']
            .map(f => [f, e[f] ?? null])
        )
      }
    })
    await supabase.from('evaluations').upsert(rows, { onConflict: 'jornada_id,player_id' })
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  async function addPlayer() {
    if (!teamId || !newPlayerName.trim()) return
    setAddingPlayer(true)
    const dorsal = players.length + 1
    const { data } = await supabase.from('players')
      .insert({ team_id: teamId, name: newPlayerName.trim(), dorsal, position: 'Por asignar' })
      .select().single()
    if (data) setPlayers(p => [...p, data])
    setNewPlayerName('')
    setAddingPlayer(false)
  }

  async function updatePosition(playerId: string, position: string) {
    await supabase.from('players').update({ position }).eq('id', playerId)
    setPlayers(p => p.map(pl => pl.id === playerId ? { ...pl, position } : pl))
  }

  if (!teamId) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Cargando...</div>

  const allFields = [...FISICA_FIELDS, ...TEC_FIELDS, ...TAC_FIELDS, ...PSICO_FIELDS]

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={s.badge}><img src="/escudo.jpeg" alt="Escudo" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} /></div>
          <div>
            <div className="font-display" style={{ fontSize: 22 }}>{teamName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 3 }}>PANEL ENTRENADOR</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && <div style={s.savedBadge}>✓ Guardado</div>}
          <div style={s.statPill}>{players.length} jugadores</div>
          <div style={s.statPill}>J{jornadas.length}</div>
          <button style={s.btnLogout} onClick={() => { sessionStorage.clear(); router.push('/') }}>Salir</button>
        </div>
      </header>

      <main style={s.main}>
        {/* Tabs */}
        <div style={s.tabs}>
          {(['jornada','plantilla','resumen'] as const).map(t => (
            <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
              {{ jornada: '📝 Jornada', plantilla: '👥 Plantilla', resumen: '📊 Resumen' }[t]}
            </button>
          ))}
        </div>

        {/* ---- TAB: JORNADA ---- */}
        {tab === 'jornada' && (
          <div>
            {/* Jornada selector */}
            <div style={s.jornadaBar}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {jornadas.map(j => (
                  <button
                    key={j.id}
                    style={{ ...s.jornadaChip, ...(activeJornada?.id === j.id ? s.jornadaChipActive : {}) }}
                    onClick={() => { setActiveJornada(j); loadEvals(j.id, players) }}
                  >
                    J{j.number}
                  </button>
                ))}
              </div>
              <button style={s.btnNew} onClick={createJornada}>+ Nueva Jornada</button>
            </div>

            {!activeJornada ? (
              <div style={s.empty}>
                <div style={{ fontSize: 48 }}>📋</div>
                <div>Crea la primera jornada para empezar a registrar evaluaciones</div>
              </div>
            ) : players.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: 48 }}>👥</div>
                <div>Añade jugadores en la pestaña Plantilla primero</div>
              </div>
            ) : (
              <>
                <div style={s.jornadaTitle}>
                  Jornada {activeJornada.number}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    — Introduce las notas del 1 al 10 por cada criterio
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={s.evalTable}>
                    <thead>
                      <tr>
                        <th style={s.th}>Jugador</th>
                        <th style={{ ...s.th, background: 'rgba(79,195,247,0.08)', borderLeft: '2px solid rgba(79,195,247,0.2)' }} colSpan={6}>💪 Física</th>
                        <th style={{ ...s.th, background: 'rgba(91,184,232,0.08)', borderLeft: '2px solid rgba(91,184,232,0.2)' }} colSpan={6}>⚽ Técnica</th>
                        <th style={{ ...s.th, background: 'rgba(56,161,105,0.08)', borderLeft: '2px solid rgba(56,161,105,0.2)' }} colSpan={4}>🧠 Táctica</th>
                        <th style={{ ...s.th, background: 'rgba(183,148,244,0.08)', borderLeft: '2px solid rgba(183,148,244,0.2)' }} colSpan={7}>🧘 Psicológica</th>
                        <th style={s.th}>Min.</th>
                        <th style={s.th}>Media</th>
                      </tr>
                      <tr>
                        <th style={s.th2}></th>
                        {FISICA_FIELDS.map(f => <th key={f} style={{ ...s.th2, background: 'rgba(79,195,247,0.04)' }} title={FIELD_LABELS[f]}>{FIELD_LABELS[f].substring(0,3)}</th>)}
                        {TEC_FIELDS.map(f => <th key={f} style={{ ...s.th2, background: 'rgba(91,184,232,0.04)' }} title={FIELD_LABELS[f]}>{f.toUpperCase()}</th>)}
                        {TAC_FIELDS.map(f => <th key={f} style={{ ...s.th2, background: 'rgba(56,161,105,0.04)' }} title={FIELD_LABELS[f]}>{f.toUpperCase()}</th>)}
                        {PSICO_FIELDS.map(f => <th key={f} style={{ ...s.th2, background: 'rgba(183,148,244,0.04)' }} title={FIELD_LABELS[f]}>{FIELD_LABELS[f].substring(0,3)}</th>)}
                        <th style={s.th2}></th>
                        <th style={s.th2}>⭐</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(p => {
                        const e = evals[p.id] || {}
                        const mf = avg(FISICA_FIELDS.map(f => e[f] as number | null))
                        const mt = avg(TEC_FIELDS.map(f => e[f] as number | null))
                        const mta = avg(TAC_FIELDS.map(f => e[f] as number | null))
                        const mp = avg(PSICO_FIELDS.map(f => e[f] as number | null))
                        const mg = avg([mf, mt, mta, mp])
                        return (
                          <tr key={p.id} style={s.evalRow}>
                            <td style={s.playerCell}>
                              <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{p.dorsal}</span>
                            </td>
                            {allFields.map(f => (
                              <td key={f} style={s.evalCell}>
                                <input
                                  type="number"
                                  min="0" max="10" step="0.5"
                                  value={(e[f] as number) ?? ''}
                                  onChange={ev => handleEvalChange(p.id, f, ev.target.value)}
                                  style={s.evalInput}
                                />
                              </td>
                            ))}
                            <td style={s.evalCell}>
                              <input
                                type="number" min="0" max="90"
                                value={(e.minutos as number) ?? ''}
                                onChange={ev => handleEvalChange(p.id, 'minutos', ev.target.value)}
                                style={{ ...s.evalInput, width: 44 }}
                              />
                            </td>
                            <td style={{ ...s.evalCell, fontFamily: "'Bebas Neue'", fontSize: 18, color: scoreColor(mg), textAlign: 'center', minWidth: 40 }}>
                              {mg ?? '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <button style={s.btnSave} onClick={saveEvals} disabled={saving}>
                  {saving ? 'Guardando...' : '💾 GUARDAR JORNADA'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ---- TAB: PLANTILLA ---- */}
        {tab === 'plantilla' && (
          <div>
            <div style={s.sectionLabel}>Jugadores registrados</div>
            <div style={s.playerList}>
              {players.map(p => (
                <div key={p.id} style={s.playerRow}>
                  <div style={s.dorsalBadge}>#{p.dorsal}</div>
                  <div style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                  <select
                    value={p.position}
                    onChange={e => updatePosition(p.id, e.target.value)}
                    style={s.posSelect}
                  >
                    {['Por asignar','Portero','Defensa Central','Lateral Derecho','Lateral Izquierdo',
                      'Mediocentro Defensivo','Mediocentro','Mediocentro Ofensivo',
                      'Extremo Derecho','Extremo Izquierdo','Delantero Centro','Segundo Delantero']
                      .map(pos => <option key={pos}>{pos}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={s.addPlayerRow}>
              <input
                placeholder="Nombre completo del jugador"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                style={s.addInput}
              />
              <button style={s.btnAdd} onClick={addPlayer} disabled={!newPlayerName.trim() || addingPlayer}>
                + Añadir jugador
              </button>
            </div>
          </div>
        )}

        {/* ---- TAB: RESUMEN ---- */}
        {tab === 'resumen' && (
          <div>
            <div style={s.sectionLabel}>Resumen de temporada</div>
            <div style={s.resumeGrid}>
              {players.map(p => {
                // Aggregate across all jornadas for this player
                const allEvals = Object.values(evals).filter(e => e.player_id === p.id)
                const mf = avg(allEvals.map(e => e.media_fisica as number | null))
                const mt = avg(allEvals.map(e => e.media_tecnica as number | null))
                const mta = avg(allEvals.map(e => e.media_tactica as number | null))
                const mp = avg(allEvals.map(e => e.media_psico as number | null))
                const mg = avg([mf, mt, mta, mp])
                return (
                  <div key={p.id} style={s.resumeCard}>
                    <div style={s.resumeHeader}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                      <span style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: scoreColor(mg) }}>{mg ?? '—'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{p.position}</div>
                    {[['💪', mf, 'var(--accent)'], ['⚽', mt, 'var(--gold)'], ['🧠', mta, 'var(--green)'], ['🧘', mp, '#b794f4']].map(([icon, val, color]) => (
                      <div key={icon as string} style={s.resumeBar}>
                        <span style={{ width: 18, fontSize: 12 }}>{icon as string}</span>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${(val as number || 0) * 10}%`, background: color as string }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono'", fontSize: 12, color: color as string, minWidth: 28 }}>{val ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', background: 'rgba(7,14,28,0.9)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100,
  },
  badge: {
    width: 44, height: 44, background: 'var(--navy)', border: '2px solid var(--gold)',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
  },
  statPill: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'var(--text-muted)',
  },
  savedBadge: {
    background: 'var(--green-dim)', border: '1px solid var(--green)',
    borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'var(--green)',
  },
  btnLogout: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)',
  },
  main: { flex: 1, padding: '28px 32px', maxWidth: 1600, margin: '0 auto', width: '100%' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', borderRadius: 12, padding: 4, width: 'fit-content' },
  tab: {
    background: 'transparent', border: 'none', borderRadius: 9, padding: '8px 20px',
    fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, transition: 'all 0.15s',
  },
  tabActive: { background: 'var(--surface2)', color: 'var(--text)' },
  jornadaBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 20, flexWrap: 'wrap',
  },
  jornadaChip: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '6px 14px', fontSize: 13, color: 'var(--text-muted)',
    fontFamily: "'DM Mono', monospace",
  },
  jornadaChipActive: { background: 'var(--navy)', borderColor: 'var(--gold)', color: 'var(--gold)' },
  btnNew: {
    background: 'var(--navy)', border: '1px solid var(--border-gold)', borderRadius: 8,
    padding: '7px 18px', fontSize: 13, color: 'var(--gold)', fontWeight: 500,
  },
  jornadaTitle: {
    fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 2, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  evalTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    padding: '8px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  th2: {
    padding: '5px 4px', fontSize: 9, color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)', textAlign: 'center',
  },
  evalRow: { borderBottom: '1px solid var(--border)' },
  playerCell: {
    padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2,
    minWidth: 130, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1,
  },
  evalCell: { padding: '6px 4px', textAlign: 'center' },
  evalInput: {
    width: 38, padding: '4px 2px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 5, fontSize: 12,
    color: 'var(--text)', textAlign: 'center', outline: 'none',
  },
  btnSave: {
    marginTop: 20, background: 'linear-gradient(135deg, var(--gold), #3a9fd4)',
    color: 'var(--navy-dark)', border: 'none', borderRadius: 10,
    padding: '12px 32px', fontFamily: "'Bebas Neue'", fontSize: 16, letterSpacing: 2,
  },
  sectionLabel: {
    fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-muted)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
  },
  playerList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px',
  },
  dorsalBadge: {
    width: 32, height: 32, background: 'var(--navy)', border: '1px solid var(--border-gold)',
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: 'var(--gold)', fontFamily: "'DM Mono'", flexShrink: 0,
  },
  posSelect: {
    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '5px 10px', fontSize: 12, color: 'var(--text)', outline: 'none',
  },
  addPlayerRow: { display: 'flex', gap: 10, marginTop: 8 },
  addInput: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none',
  },
  btnAdd: {
    background: 'var(--navy)', border: '1px solid var(--border-gold)',
    borderRadius: 8, padding: '10px 20px', fontSize: 13, color: 'var(--gold)', fontWeight: 500,
  },
  resumeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  resumeCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 },
  resumeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  resumeBar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  barTrack: { flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, transition: 'width 0.6s ease' },
  empty: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', fontSize: 14 },
}
