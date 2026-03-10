'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getSession, canEditEval, canSeePrivateNotes, canSeePsychNotes, scoreColor, type Player, type Team, type Jornada, type Evaluation, type PlayerMeeting, type PlayerPsych } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const CRITERIA = {
  fisica:   ['Velocidad','Resistencia','Fuerza','Coordinación','Agilidad','Reacción'],
  tecnica:  ['Control','Pase','Regate','Disparo','Cabeza','1vs1'],
  psico:    ['Actitud','Concentración','Confianza','Trabajo en equipo','Gest. del error','Competitividad','Fair Play'],
}

const TACTICA_POR_POSICION = {
  'Portero': [
    { key: 'tac1', label: 'Participación en salida', desc: 'Ofrece apoyo a los centrales y se convierte en línea de pase para iniciar el juego desde atrás' },
    { key: 'tac2', label: 'Elección juego corto/largo', desc: 'Decide con criterio si jugar corto o largo según la presión rival' },
    { key: 'tac3', label: 'Colocación para reiniciar', desc: 'Se posiciona correctamente para reiniciar el ataque tras recuperar el balón' },
    { key: 'tac4', label: 'Colocación defensiva', desc: 'Se adelanta o retrocede según la línea defensiva para cubrir el espacio a la espalda' },
    { key: 'tac5', label: 'Comunicación y organización', desc: 'Dirige y organiza a la defensa con voz y gestos' },
    { key: 'tac6', label: 'Gestión de centros', desc: 'Sale con decisión a interceptar centros laterales y balones a la espalda' },
  ],
  'Defensa Central': [
    { key: 'tac1', label: 'Salida de balón', desc: 'Conduce o pasa con seguridad para iniciar el juego desde la defensa' },
    { key: 'tac2', label: 'Superioridad en primera línea', desc: 'Genera superioridad numérica o posicional al progresar con balón' },
    { key: 'tac3', label: 'Cambio de orientación', desc: 'Cambia el juego al lado contrario para progresar y encontrar espacios' },
    { key: 'tac4', label: 'Control de profundidad', desc: 'Gestiona la línea defensiva controlando los espacios a su espalda' },
    { key: 'tac5', label: 'Juego aéreo defensivo', desc: 'Gana duelos aéreos defensivos con anticipación y contundencia' },
    { key: 'tac6', label: 'Coordinación de línea', desc: 'Coordina la línea defensiva activando el fuera de juego en el momento adecuado' },
  ],
  'Lateral Derecho': [
    { key: 'tac1', label: 'Amplitud y carril exterior', desc: 'Ocupa el carril exterior para dar anchura al equipo en ataque' },
    { key: 'tac2', label: 'Timing de incorporación', desc: 'Se incorpora al ataque en el momento adecuado sin descuidar su posición' },
    { key: 'tac3', label: 'Apoyo al extremo', desc: 'Apoya al extremo por dentro o por fuera según el contexto del juego' },
    { key: 'tac4', label: 'Control del extremo rival', desc: 'Se orienta correctamente y mantiene la distancia adecuada frente al extremo rival' },
    { key: 'tac5', label: 'Defensa de centros', desc: 'Se anticipa y defiende con eficacia los centros laterales del rival' },
    { key: 'tac6', label: 'Basculación defensiva', desc: 'Bascula con la línea defensiva cerrando los pases interiores' },
  ],
  'Lateral Izquierdo': [
    { key: 'tac1', label: 'Amplitud y carril exterior', desc: 'Ocupa el carril exterior para dar anchura al equipo en ataque' },
    { key: 'tac2', label: 'Timing de incorporación', desc: 'Se incorpora al ataque en el momento adecuado sin descuidar su posición' },
    { key: 'tac3', label: 'Apoyo al extremo', desc: 'Apoya al extremo por dentro o por fuera según el contexto del juego' },
    { key: 'tac4', label: 'Control del extremo rival', desc: 'Se orienta correctamente y mantiene la distancia adecuada frente al extremo rival' },
    { key: 'tac5', label: 'Defensa de centros', desc: 'Se anticipa y defiende con eficacia los centros laterales del rival' },
    { key: 'tac6', label: 'Basculación defensiva', desc: 'Bascula con la línea defensiva cerrando los pases interiores' },
  ],
  'Mediocentro Defensivo': [
    { key: 'tac1', label: 'Línea de pase en salida', desc: 'Se ofrece constantemente como apoyo en la salida de balón' },
    { key: 'tac2', label: 'Cambio de orientación', desc: 'Cambia el ritmo y la orientación del juego con pases precisos' },
    { key: 'tac3', label: 'Apoyo entre líneas', desc: 'Conecta la línea defensiva con la ofensiva dando continuidad al juego' },
    { key: 'tac4', label: 'Protección del espacio', desc: 'Protege el espacio delante de los centrales cortando líneas de pase' },
    { key: 'tac5', label: 'Equilibrio tras pérdida', desc: 'Recupera su posición de equilibrio rápidamente tras perder el balón' },
    { key: 'tac6', label: 'Intercepción interior', desc: 'Intercepta pases interiores del rival leyendo el juego con anticipación' },
  ],
  'Mediocentro': [
    { key: 'tac1', label: 'Ocupación de espacios intermedios', desc: 'Aparece entre las líneas rivales para recibir y progresar' },
    { key: 'tac2', label: 'Llegada al área', desc: 'Se incorpora desde segunda línea para llegar con peligro al área rival' },
    { key: 'tac3', label: 'Apoyo entre líneas', desc: 'Da continuidad al juego apoyando al portador entre las líneas rivales' },
    { key: 'tac4', label: 'Presión al poseedor', desc: 'Presiona con intensidad al poseedor en mediocampo cortando opciones de pase' },
    { key: 'tac5', label: 'Ayuda defensiva en banda', desc: 'Ayuda al lateral cuando el rival ataca por su banda' },
    { key: 'tac6', label: 'Repliegue y equilibrio', desc: 'Se repliega rápido en transición aportando equilibrio defensivo' },
  ],
  'Mediocentro Ofensivo': [
    { key: 'tac1', label: 'Ocupación entre líneas', desc: 'Se sitúa entre el mediocampo y la defensa rival como opción de pase' },
    { key: 'tac2', label: 'Conexión mediocampo-delanteros', desc: 'Facilita la progresión del equipo con apoyos y últimos pases' },
    { key: 'tac3', label: 'Llegada al área', desc: 'Aparece en zonas de remate tras la progresión del ataque' },
    { key: 'tac4', label: 'Presión sobre el pivote rival', desc: 'Activa o lidera la presión sobre el mediocentro defensivo rival' },
    { key: 'tac5', label: 'Cierre de líneas interiores', desc: 'Orienta su presión para evitar que el rival progrese por dentro' },
    { key: 'tac6', label: 'Repliegue a bloque medio', desc: 'Se coloca en segunda línea defensiva cuando el equipo se reorganiza' },
  ],
  'Extremo Derecho': [
    { key: 'tac1', label: 'Fijar lateral y dar amplitud', desc: 'Fija al lateral rival en su posición generando amplitud en el ataque' },
    { key: 'tac2', label: 'Ataque al espacio a la espalda', desc: 'Ataca el espacio detrás del lateral rival en el momento oportuno' },
    { key: 'tac3', label: 'Duelos 1v1', desc: 'Gana duelos individuales frente al rival con habilidad y decisión' },
    { key: 'tac4', label: 'Centros y pases atrás', desc: 'Genera peligro con centros o pases atrás desde posición de banda' },
    { key: 'tac5', label: 'Presión al lateral rival', desc: 'Presiona la salida de balón del lateral rival por su banda' },
    { key: 'tac6', label: 'Repliegue y cierre interior', desc: 'Se repliega por su banda y cierra la línea de pase hacia dentro' },
  ],
  'Extremo Izquierdo': [
    { key: 'tac1', label: 'Fijar lateral y dar amplitud', desc: 'Fija al lateral rival en su posición generando amplitud en el ataque' },
    { key: 'tac2', label: 'Ataque al espacio a la espalda', desc: 'Ataca el espacio detrás del lateral rival en el momento oportuno' },
    { key: 'tac3', label: 'Duelos 1v1', desc: 'Gana duelos individuales frente al rival con habilidad y decisión' },
    { key: 'tac4', label: 'Centros y pases atrás', desc: 'Genera peligro con centros o pases atrás desde posición de banda' },
    { key: 'tac5', label: 'Presión al lateral rival', desc: 'Presiona la salida de balón del lateral rival por su banda' },
    { key: 'tac6', label: 'Repliegue y cierre interior', desc: 'Se repliega por su banda y cierra la línea de pase hacia dentro' },
  ],
  'Delantero Centro': [
    { key: 'tac1', label: 'Movimientos de ruptura', desc: 'Realiza desmarques a la espalda de la defensa para recibir en profundidad' },
    { key: 'tac2', label: 'Capacidad goleadora', desc: 'Finaliza las ocasiones con eficacia dentro del área' },
    { key: 'tac3', label: 'Desmarques de apoyo', desc: 'Se ofrece como apoyo para ayudar al equipo a progresar' },
    { key: 'tac4', label: 'Primera presión', desc: 'Inicia la presión sobre los defensas rivales en la salida de balón' },
    { key: 'tac5', label: 'Orientación hacia banda', desc: 'Dirige su presión para obligar al rival a jugar hacia la banda' },
    { key: 'tac6', label: 'Bloqueo de pases al pivote', desc: 'Bloquea las líneas de pase hacia el mediocentro defensivo rival' },
  ],
  'Segunda Punta': [
    { key: 'tac1', label: 'Movimientos de ruptura', desc: 'Realiza desmarques a la espalda de la defensa para recibir en profundidad' },
    { key: 'tac2', label: 'Capacidad goleadora', desc: 'Finaliza las ocasiones con eficacia dentro del área' },
    { key: 'tac3', label: 'Desmarques de apoyo', desc: 'Se ofrece como apoyo para ayudar al equipo a progresar' },
    { key: 'tac4', label: 'Primera presión', desc: 'Inicia la presión sobre los defensas rivales en la salida de balón' },
    { key: 'tac5', label: 'Orientación hacia banda', desc: 'Dirige su presión para obligar al rival a jugar hacia la banda' },
    { key: 'tac6', label: 'Bloqueo de pases al pivote', desc: 'Bloquea las líneas de pase hacia el mediocentro defensivo rival' },
  ],
}

const TACTICA_GENERICA = [
  { key: 'tac1', label: 'Posicionamiento', desc: 'Ocupa correctamente los espacios según el momento del juego' },
  { key: 'tac2', label: 'Presión', desc: 'Presiona al poseedor con intensidad y criterio' },
  { key: 'tac3', label: 'Transición', desc: 'Reacciona rápido al cambio de fase ataque-defensa' },
  { key: 'tac4', label: 'Juego colectivo', desc: 'Contribuye al juego colectivo del equipo' },
]

function getTacticaCriteria(position: string | null | undefined) {
  if (!position) return TACTICA_GENERICA
  return (TACTICA_POR_POSICION as Record<string, typeof TACTICA_GENERICA>)[position ?? ""] || TACTICA_GENERICA
}

function EquipoContent() {
  const router  = useRouter()
  const params  = useSearchParams()
  const session = getSession()
  const teamId  = params.get('team')

  const [team, setTeam]         = useState<any>(null)
  const [players, setPlayers]   = useState<any[]>([])
  const [jornadas, setJornadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [evals, setEvals]       = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [psychs, setPsychs]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('stats')
  const [evalForm, setEvalForm] = useState({})
  const [selectedJornada, setJornada] = useState('')
  const [saving, setSaving]     = useState(false)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editingField, setEditingField] = useState<string|null>(null)
  const [editValue, setEditValue] = useState('')
  const [newPlayer, setNewPlayer] = useState({ name: '', dorsal: '', position: '', birth_year: '', foot: '' })
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
      foot: newPlayer.foot || null,
      team_id: team.id
    })
    if (!res.error) {
      setShowAddPlayer(false)
      setNewPlayer({ name: '', dorsal: '', position: '', birth_year: '', foot: '' })
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

  async function deletePlayer(p: Player) {
    await supabase.from('players').delete().eq('id', p.id)
    setSelected(null)
    if (team) loadTeamData(team.id)
  }

  async function savePlayerField(field: string, value: string) {
    if (!selected) return
    await supabase.from('players').update({ [field]: value || null }).eq('id', selected.id)
    setSelected((p: any) => ({ ...p, [field]: value || null }))
    setPlayers(ps => ps.map(p => p.id === selected.id ? { ...p, [field]: value || null } : p))
    setEditingField(null)
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
    const payload = {
      jornada_id: selectedJornada, player_id: selected.id, team_id: team.id,
      evaluator_id: session.id, ...evalForm
    }
    await supabase.from('evaluations').upsert(payload, { onConflict: 'jornada_id,player_id' })
    setSaving(false)
    const { data } = await supabase.from('evaluations').select('*').eq('player_id', selected.id).order('jornada_id')
    setEvals(data || [])
    setTab('stats')
  }

  async function addMeeting(role: "coach" | "psychologist") {
    if (!noteText.trim() || !selected || !session) return
    setAddingNote(true)
    const table = role === 'psychologist' ? 'player_psych' : 'player_meetings'
    const payload = {
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

  if (selected) {
    const tacticaCriteria = getTacticaCriteria(selected.position)
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
    const scores = [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10]

    return (
      <div className="page-content">
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              #{selected.dorsal} · {selected.position || '—'}
              {selected.foot && <span> · 🦶 {selected.foot}</span>}
              {selected.birth_year && <span> · {selected.birth_year}</span>}
            </div>
          </div>
          {canEdit && <button className='btn btn-ghost btn-sm' style={{color:'#FC8181'}} onClick={() => deletePlayer(selected)}>🗑</button>}
        </div>

        <div className="scroll-row" style={{ padding: '10px 16px 0' }}>
          {[
            { key: 'stats', label: '📊 Stats' },
            { key: 'ficha', label: '👤 Ficha' },
            ...(canEdit ? [{ key: 'eval', label: '✏️ Evaluar' }] : []),
            ...(canMeetings ? [{ key: 'reuniones', label: '💬 Reuniones' }] : []),
            ...(canPsych ? [{ key: 'psico', label: '🧠 Psicólogo' }] : []),
          ].map(t => (
            <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'stats' && (
          <div style={{ padding: '16px' }}>
            {evals.length === 0 ? (
              <div className="empty-state"><div className="icon">📊</div><div>Sin evaluaciones todavía</div></div>
            ) : (
              <>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  {avgData.map(d => (
                    <div key={d.area} className="card-sm" style={{ textAlign: 'center', padding: '10px 4px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(d.value) }}>{d.value || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.area}</div>
                    </div>
                  ))}
                </div>
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

        {tab === 'ficha' && (
          <div style={{ padding: '16px' }}>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--gold)' }}>Datos del jugador</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>NOMBRE</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>DORSAL</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>#{selected.dorsal || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>AÑO NAC.</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{selected.birth_year || '—'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>POSICIÓN</div>
                {editingField === 'position' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input" style={{ flex: 1 }} value={editValue} onChange={e => setEditValue(e.target.value)}>
                      <option value="">Sin posición</option>
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
                    <button className="btn btn-gold btn-sm" onClick={() => savePlayerField('position', editValue)}>✓</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.position || '—'}</span>
                    {canEdit && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setEditingField('position'); setEditValue(selected.position || '') }}>Editar</button>}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PIE DOMINANTE</div>
                {editingField === 'foot' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input" style={{ flex: 1 }} value={editValue} onChange={e => setEditValue(e.target.value)}>
                      <option value="">—</option>
                      <option>Derecho</option>
                      <option>Izquierdo</option>
                      <option>Ambidiestro</option>
                    </select>
                    <button className="btn btn-gold btn-sm" onClick={() => savePlayerField('foot', editValue)}>✓</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>🦶 {selected.foot || '—'}</span>
                    {canEdit && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setEditingField('foot'); setEditValue(selected.foot || '') }}>Editar</button>}
                  </div>
                )}
              </div>
            </div>

            {canMeetings && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--gold)' }}>💬 Historial reuniones</div>
                <NotesList notes={meetings} sessionId={session.id} />
              </div>
            )}

            {canPsych && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--gold)' }}>🧠 Historial psicólogo</div>
                <NotesList notes={psychs} sessionId={session.id} />
              </div>
            )}
          </div>
        )}

        {tab === 'eval' && canEdit && (
          <div style={{ padding: '16px' }}>
            <label className="label">Jornada</label>
            <select className="input" style={{ marginBottom: 16 }} value={selectedJornada} onChange={e => setJornada(e.target.value)}>
              {jornadas.map(j => <option key={j.id} value={j.id}>J{j.number} {j.date ? `· ${j.date}` : ''} · {j.type}</option>)}
            </select>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Física</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.fisica.map((label, i) => {
                  const key = ['velocidad','resistencia','fuerza','coordinacion','agilidad','reaccion'][i]
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
                        <option value="">—</option>
                        {scores.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Técnica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.tecnica.map((label, i) => {
                  const key = `tec${i+1}`
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
                        <option value="">—</option>
                        {scores.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--gold)' }}>Táctica</div>
              {selected.position && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>Criterios para: {selected.position}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tacticaCriteria.map(item => (
                  <div key={item.key} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{item.desc}</div>
                    <select className="score-input" value={evalForm[item.key] ?? ''} onChange={e => setEvalForm(f => ({ ...f, [item.key]: e.target.value ? +e.target.value : null }))}>
                      <option value="">—</option>
                      {scores.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Psicológica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.psico.map((label, i) => {
                  const key = ['actitud','concentracion','confianza','trabajo_equipo','gestion_error','competitividad','fairplay'][i]
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm(f => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
                        <option value="">—</option>
                        {scores.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label className="label">Minutos</label>
                <input type="number" className="input" placeholder="90" value={evalForm.minutos ?? ''} onChange={e => setEvalForm(f => ({ ...f, minutos: e.target.value ? +e.target.value : null }))} />
              </div>
            </div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} style={{ marginBottom: 16 }} value={evalForm.notas ?? ''} onChange={e => setEvalForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones de la evaluación..." />
            <button className="btn btn-gold btn-full" onClick={saveEval} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar evaluación'}</button>
          </div>
        )}

        {tab === 'reuniones' && canMeetings && (
          <div style={{ padding: '16px' }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <label className="label">Nueva entrada</label>
              <textarea className="input" rows={3} placeholder="Resumen de la reunión..." value={noteText} onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn btn-gold btn-full btn-sm" onClick={() => addMeeting('coach')} disabled={addingNote || !noteText.trim()}>+ Añadir</button>
            </div>
            <NotesList notes={meetings} sessionId={session.id} />
          </div>
        )}

        {tab === 'psico' && canPsych && (
          <div style={{ padding: '16px' }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <label className="label">Nueva sesión</label>
              <textarea className="input" rows={3} placeholder="Observaciones de la sesión..." value={noteText} onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn btn-gold btn-full btn-sm" onClick={() => addMeeting('psychologist')} disabled={addingNote || !noteText.trim()}>+ Añadir</button>
            </div>
            <NotesList notes={psychs} sessionId={session.id} />
          </div>
        )}
        <BottomNav role={session.role} />
      </div>
    )
  }

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
            <input className="input" placeholder="Nombre completo" value={newPlayer.name} onChange={e => setNewPlayer(p => ({...p, name: e.target.value}))} style={{ marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Dorsal</label>
                <input className="input" type="number" placeholder="10" value={newPlayer.dorsal} onChange={e => setNewPlayer(p => ({...p, dorsal: e.target.value}))} />
              </div>
              <div>
                <label className="label">Año nac.</label>
                <input className="input" type="number" placeholder="2012" value={newPlayer.birth_year} onChange={e => setNewPlayer(p => ({...p, birth_year: e.target.value}))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="label">Posición</label>
                <select className="input" value={newPlayer.position} onChange={e => setNewPlayer(p => ({...p, position: e.target.value}))}>
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
              </div>
              <div>
                <label className="label">Pie dominante</label>
                <select className="input" value={newPlayer.foot || ''} onChange={e => setNewPlayer(p => ({...p, foot: e.target.value}))}>
                  <option value="">—</option>
                  <option>Derecho</option>
                  <option>Izquierdo</option>
                  <option>Ambidiestro</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddPlayer(false)}>Cancelar</button>
              <button className="btn btn-gold" style={{ flex: 1 }} onClick={saveNewPlayer} disabled={savingPlayer}>{savingPlayer ? 'Guardando...' : 'Guardar'}</button>
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
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.name}</div>
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

function NotesList({ notes, sessionId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {notes.map(n => (
        <div key={n.id} className="card-sm">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: 'var(--surface3)', color: 'var(--gold)' }}>{n.author_name.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.author_name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{format(parseISO(n.created_at), "d MMM yyyy · HH:mm", { locale: es })}</div>
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
