'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getSession, canEditEval, canSeePrivateNotes, canSeePsychNotes, scoreColor, type Player, type Team, type Jornada, type Evaluation, type PlayerMeeting, type PlayerPsych } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Criteria labels for F11
const CRITERIA = {
  fisica:   ['Velocidad','Resistencia','Fuerza','Coordinación','Agilidad','Reacción'],
  tecnica:  ['Control','Pase','Regate','Disparo','Cabeza','1vs1'],
  tactica:  ['Posicionamiento','Presión','Transición','Juego colectivo'],
  psico:    ['Actitud','Concentración','Confianza','Trabajo en equipo','Gest. del error','Competitividad','Fair Play'],
}

function EquipoContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const session = getSession()
  const teamId  = params.get('team')

  const [team, setTeam]         = useState<Team | null>(null)
  const [players, setPlayers]   = useState<Player[]>([])
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [selected, setSelected] = useState<Player | null>(null)
  const [evals, setEvals]       = useState<Evaluation[]>([])
  const [meetings, setMeetings] = useState<PlayerMeeting[]>([])
  const [psychs, setPsychs]     = useState<PlayerPsych[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'stats'|'eval'|'reuniones'|'psico'>('stats')
  const [evalForm, setEvalForm] = useState<Record<string, any>>({})
  const [selectedJornada, setJornada] = useState<string>('')
  const [saving, setSaving]     = useState(false)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ name: '', dorsal: '', position: '', birth_year: '' })
  const [savingPlayer, setSavingPlayer] = useState(false)
  const canEdit = canEditEval(session?.role || 'coach')
  const canMeetings = canSeePrivateNotes(session?.role || 'coach')
  const canPsych = canSeePsychNotes(session?.role || 'coach')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    const id = teamId || session.team_ids?.[0]
    if (!id) { router.push('/dashboard'); return }
    loadTeamData(id)
  }, [teamId])

  async function saveNewPlayer() {
    if (!newPlayer.name.trim() || !team) return
    setSavingPlayer(true)
    const res = await supabase.from('players').insert({
      name: newPlayer.name.trim(),
      dorsal: newPlayer.dorsal ? parseInt(newPlayer.dorsal) : null,
      position: newPlayer.position || null,
      birth_year: newPlayer.birth_year ? parseInt(newPlayer.birth_year) : null,
      team_id: team.id
    })
    if (!res.error) {
      setShowAddPlayer(false)
      setNewPlayer({ name: '', dorsal: '', position: '', birth_year: '' })
      loadTeamData(team.id)
    }
    setSavingPlayer(false)
  }

  async function loadTeamData(id: string) {
    setLoading(true)
    const [{ data: t }, { data: pl }, { data: j }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('team_id', id).order('dorsal'),
      supabase.from('jornadas').select('*').eq('team_id', id).order('number'),
    ])
    setTeam(t)
    setPlayers(pl || [])
    setJornadas(j || [])
    if (j && j.length > 0) setJornada(j[j.length - 1].id)
    setLoading(false)
  }

  async function openPlayer(p: Player) {
    setSelected(p)
    setTab('stats')
    const { data } = await supabase.from('evaluations').select('*').eq('player_id', p.id).order('jornada_id')
    setEvals(data || [])
    if (canMeetings) {
      const { data: m } = await supabase.from('player_meetings').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
      setMeetings(m || [])
    }
    if (canPsych) {
      const { data: ps } = await supabase.from('player_psych').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
      setPsychs(ps || [])
    }
  }

  async function saveEval() {
    if (!selected || !selectedJornada || !session) return
    setSaving(true)
    const jornadaObj = jornadas.find(j => j.id === selectedJornada)
    const payload = {
      jornada_id: selectedJornada, player_id: selected.id, team_id: team!.id,
      evaluator_id: session.id, ...evalForm
    }
    await supabase.from('evaluations').upsert(payload, { onConflict: 'jornada_id,player_id' })
    setSaving(false)
    const { data } = await supabase.from('evaluations').select('*').eq('player_id', selected.id).order('jornada_id')
    setEvals(data || [])
    setTab('stats')
  }

  async function addMeeting(role: 'coach' | 'psychologist') {
    if (!noteText.trim() || !selected || !session) return
    setAddingNote(true)
    const table = role === 'psychologist' ? 'player_psych' : 'player_meetings'
    const payload: any = {
      player_id: selected.id, author_id: session.id,
      author_name: session.name, content: noteText.trim(),
    }
    if (role === 'coach') payload.author_role = session.role
    await supabase.from(table).insert(payload)
    setNoteText('')
    setAddingNote(false)
    if (role === 'psychologist') {
      const { data } = await supabase.from('player_psych').select('*').eq('player_id', selected.id).order('created_at', { ascending: false })
      setPsychs(data || [])
    } else {
      const { data } = await supabase.from('player_meetings').select('*').eq('player_id', selected.id).order('created_at', { ascending: false })
      setMeetings(data || [])
    }
  }

  if (!session) return null

  // ── Player detail ──
  if (selected) {
    const avgData = [
      { area: 'Física',   value: +(evals.reduce((s,e) => s+(e.media_fisica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Técnica',  value: +(evals.reduce((s,e) => s+(e.media_tecnica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Táctica',  value: +(evals.reduce((s,e) => s+(e.media_tactica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Psicológ.',value: +(evals.reduce((s,e) => s+(e.media_psico||0), 0)/Math.max(evals.length,1)).toFixed(1) },
    ]
    const evoData = evals.map((e, i) => ({
      j: `J${i+1}`,
      Física: e.media_fisica, Técnica: e.media_tecnica, Táctica: e.media_tactica, Psico: e.media_psico
    }))
    const currentEval = evalForm

    return (
      <div className="page-content">
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              #{selected.dorsal} · {selected.position}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="scroll-row" style={{ padding: '10px 16px 0' }}>
          {[
            { key: 'stats', label: '📊 Stats' },
            ...(canEdit ? [{ key: 'eval', label: '✏️ Evaluar' }] : []),
            ...(canMeetings ? [{ key: 'reuniones', label: '💬 Reuniones' }] : []),
            ...(canPsych ? [{ key: 'psico', label: '🧠 Psicólogo' }] : []),
          ].map(t => (
            <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setTab(t.key as any)}>{t.label}</button>
          ))}
        </div>

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div style={{ padding: '16px' }}>
            {evals.length === 0 ? (
              <div className="empty-state"><div className="icon">📊</div><div>Sin evaluaciones todavía</div></div>
            ) : (
              <>
                {/* Radar */}
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Perfil del jugador</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={avgData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="area" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {/* Score summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  {avgData.map(d => (
                    <div key={d.area} className="card-sm" style={{ textAlign: 'center', padding: '10px 4px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(d.value) }}>{d.value || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.area}</div>
                    </div>
                  ))}
                </div>
                {/* Evolution */}
                {evals.length > 1 && (
                  <div className="card">
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Evolución</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={evoData}>
                        <XAxis dataKey="j" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <Tooltip contentStyle={{ background: 'var(--surface2)', border: 'none', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="Física" stroke="#5bb8e8" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="Técnica" stroke="#68D391" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="Táctica" stroke="#F6AD55" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="Psico" stroke="#B794F4" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── EVALUAR ── */}
        {tab === 'eval' && canEdit && (
          <div style={{ padding: '16px' }}>
            <label className="label">Jornada</label>
            <select className="input" style={{ marginBottom: 16 }} value={selectedJornada}
              onChange={e => setJornada(e.target.value)}>
              {jornadas.map(j => <option key={j.id} value={j.id}>J{j.number} {j.date ? `· ${j.date}` : ''} · {j.type}</option>)}
            </select>

            {(['fisica','tecnica','tactica','psico'] as const).map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, textTransform: 'capitalize', color: 'var(--gold)' }}>
                  {cat === 'fisica' ? 'Física' : cat === 'tecnica' ? 'Técnica' : cat === 'tactica' ? 'Táctica' : 'Psicológica'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {CRITERIA[cat].map((label, i) => {
                    const key = cat === 'fisica' ? ['velocidad','resistencia','fuerza','coordinacion','agilidad','reaccion'][i]
                      : cat === 'tecnica' ? `tec${i+1}`
                      : cat === 'tactica' ? `tac${i+1}`
                      : ['actitud','concentracion','confianza','trabajo_equipo','gestion_error','competitividad','fairplay'][i]
                    return (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                        <input type="number" min={1} max={10} step={0.5} className="score-input"
                          placeholder="—"
                          value={evalForm[key] ?? ''}
                          onChange={e => setEvalForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label className="label">Minutos</label>
                <input type="number" className="input" placeholder="90" value={evalForm.minutos ?? ''}
                  onChange={e => setEvalForm(f => ({ ...f, minutos: e.target.value ? +e.target.value : null }))} />
              </div>
            </div>

            <label className="label">Notas</label>
            <textarea className="input" rows={2} style={{ marginBottom: 16 }} value={evalForm.notas ?? ''}
              onChange={e => setEvalForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones de la evaluación..." />

            <button className="btn btn-gold btn-full" onClick={saveEval} disabled={saving}>
              {saving ? 'Guardando...' : '💾 Guardar evaluación'}
            </button>
          </div>
        )}

        {/* ── REUNIONES ── */}
        {tab === 'reuniones' && canMeetings && (
          <div style={{ padding: '16px' }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <label className="label">Nueva entrada</label>
              <textarea className="input" rows={3} placeholder="Resumen de la reunión, observaciones..." value={noteText}
                onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn btn-gold btn-full btn-sm" onClick={() => addMeeting('coach')} disabled={addingNote || !noteText.trim()}>
                + Añadir
              </button>
            </div>
            <NotesList notes={meetings} sessionId={session.id} />
          </div>
        )}

        {/* ── PSICÓLOGO ── */}
        {tab === 'psico' && canPsych && (
          <div style={{ padding: '16px' }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <label className="label">Nueva sesión</label>
              <textarea className="input" rows={3} placeholder="Observaciones de la sesión..." value={noteText}
                onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn btn-gold btn-full btn-sm" onClick={() => addMeeting('psychologist')} disabled={addingNote || !noteText.trim()}>
                + Añadir
              </button>
            </div>
            <NotesList notes={psychs} sessionId={session.id} />
          </div>
        )}

        <BottomNav role={session.role} />
      </div>
    )
  }

  // ── Players list ──
  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{team?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{team?.modalidad} · {players.length} jugadores</div>
        </div>
        {canEdit && <button className="btn btn-gold btn-sm" onClick={() => setShowAddPlayer(true)}>+ Jugador</button>}
      </div>

      {showAddPlayer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '20px 20px 0 0', padding: 24, paddingBottom: 90 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: 'var(--text)' }}>Nuevo jugador</div>
            <label className="label">Nombre *</label>
            <input className="input" placeholder="Nombre completo" value={newPlayer.name}
              onChange={e => setNewPlayer(p => ({...p, name: e.target.value}))} style={{ marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Dorsal</label>
                <input className="input" type="number" placeholder="10" value={newPlayer.dorsal}
                  onChange={e => setNewPlayer(p => ({...p, dorsal: e.target.value}))} />
              </div>
              <div>
                <label className="label">Año nac.</label>
                <input className="input" type="number" placeholder="2012" value={newPlayer.birth_year}
                  onChange={e => setNewPlayer(p => ({...p, birth_year: e.target.value}))} />
              </div>
            </div>
            <label className="label">Posición</label>
            <select className="input" value={newPlayer.position}
              onChange={e => setNewPlayer(p => ({...p, position: e.target.value}))} style={{ marginBottom: 20 }}>
              <option value="">Seleccionar...</option>
              <option>Portero</option>
              <option>Defensa Central</option>
              <option>Lateral Derecho</option>
              <option>Lateral Izquierdo</option>
              <option>Mediocentro Defensivo</option>
              <option>Mediocentro</option>
              <option>Mediocentro Ofensivo</option>
              <option>Extremo Derecho</option>
              <option>Extremo Izquierdo</option>
              <option>Delantero Centro</option>
              <option>Segunda Punta</option>
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddPlayer(false)}>Cancelar</button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={saveNewPlayer} disabled={savingPlayer}>
                {savingPlayer ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <div style={{ padding: '12px 0' }}>
          {players.map(p => (
            <button key={p.id} onClick={() => openPlayer(p)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: 'var(--gold)', flexShrink: 0 }}>
                {p.dorsal || '—'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.position}</div>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          ))}
          {players.length === 0 && <div className="empty-state"><div className="icon">👤</div><div>Sin jugadores en el equipo</div></div>}
        </div>
      )}

      <BottomNav role={session.role} />
    </div>
  )
}

function NotesList({ notes, sessionId }: { notes: (PlayerMeeting | PlayerPsych)[]; sessionId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {notes.map(n => (
        <div key={n.id} className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: 'var(--surface3)', color: 'var(--gold)' }}>
              {n.author_name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.author_name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {format(parseISO(n.created_at), "d MMM yyyy · HH:mm", { locale: es })}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{n.content}</p>
        </div>
      ))}
      {notes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Sin entradas todavía</div>}
    </div>
  )
}

export default function EquipoPage() {
  return (
    <Suspense fallback={<div className="empty-state"><div className="loader animate-spin" /></div>}>
      <EquipoContent />
    </Suspense>
  )
}
