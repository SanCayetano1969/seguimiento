'use client'

import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getSession, canEditEval, canSeePrivateNotes, canSeePsychNotes, scoreColor, type Player, type Team, type Jornada, type Evaluation, type PlayerMeeting, type PlayerPsych } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts'
import { format, parseISO, startOfWeek, subWeeks, addDays } from 'date-fns'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { es } from 'date-fns/locale'
import CabeceraTecnicos from '@/components/equipo/CabeceraTecnicos'
import PlantillaDropdown from '@/components/equipo/PlantillaDropdown'
import EstadisticasEquipo from '@/components/equipo/EstadisticasEquipo'
import Convocatorias from '@/components/equipo/Convocatorias'

const CRITERIA = {
  fisica: ['Velocidad','Resistencia','Fuerza','Coordinacion','Agilidad','Reaccion'],
  tecnica: ['Control','Pase','Regate','Disparo','Cabeza','1vs1'],
  psico: ['Actitud','Concentracion','Confianza','Trabajo en equipo','Gest. del error','Competitividad','Fair Play'],
}
const TACTICA_POR_POSICION: Record<string, {key:string,label:string,desc:string}[]> = {
  'Portero': [{key:'tac1',label:'Participacion en salida',desc:'Ofrece apoyo a los centrales'},{key:'tac2',label:'Eleccion juego corto/largo',desc:'Decide con criterio si jugar corto o largo'},{key:'tac3',label:'Colocacion para reiniciar',desc:'Se posiciona correctamente para reiniciar el ataque'},{key:'tac4',label:'Colocacion defensiva',desc:'Se adelanta o retrocede segun la linea defensiva'},{key:'tac5',label:'Comunicacion y organizacion',desc:'Dirige y organiza a la defensa'},{key:'tac6',label:'Gestion de centros',desc:'Sale con decision a interceptar centros laterales'}],
  'Defensa Central': [{key:'tac1',label:'Salida de balon',desc:'Conduce o pasa con seguridad'},{key:'tac2',label:'Superioridad en primera linea',desc:'Genera superioridad numerica'},{key:'tac3',label:'Cambio de orientacion',desc:'Cambia el juego al lado contrario'},{key:'tac4',label:'Control de profundidad',desc:'Gestiona la linea defensiva'},{key:'tac5',label:'Juego aereo defensivo',desc:'Gana duelos aereos defensivos'},{key:'tac6',label:'Coordinacion de linea',desc:'Coordina la linea defensiva'}],
  'Lateral Derecho': [{key:'tac1',label:'Amplitud y carril exterior',desc:'Ocupa el carril exterior'},{key:'tac2',label:'Timing de incorporacion',desc:'Se incorpora al ataque en el momento adecuado'},{key:'tac3',label:'Apoyo al extremo',desc:'Apoya al extremo'},{key:'tac4',label:'Control del extremo rival',desc:'Se orienta correctamente'},{key:'tac5',label:'Defensa de centros',desc:'Se anticipa y defiende centros'},{key:'tac6',label:'Basculacion defensiva',desc:'Bascula con la linea defensiva'}],
  'Lateral Izquierdo': [{key:'tac1',label:'Amplitud y carril exterior',desc:'Ocupa el carril exterior'},{key:'tac2',label:'Timing de incorporacion',desc:'Se incorpora al ataque en el momento adecuado'},{key:'tac3',label:'Apoyo al extremo',desc:'Apoya al extremo'},{key:'tac4',label:'Control del extremo rival',desc:'Se orienta correctamente'},{key:'tac5',label:'Defensa de centros',desc:'Se anticipa y defiende centros'},{key:'tac6',label:'Basculacion defensiva',desc:'Bascula con la linea defensiva'}],
  'Mediocentro Defensivo': [{key:'tac1',label:'Linea de pase en salida',desc:'Se ofrece como apoyo en la salida'},{key:'tac2',label:'Cambio de orientacion',desc:'Cambia el ritmo y orientacion'},{key:'tac3',label:'Apoyo entre lineas',desc:'Conecta defensa con ofensiva'},{key:'tac4',label:'Proteccion del espacio',desc:'Protege el espacio ante los centrales'},{key:'tac5',label:'Equilibrio tras perdida',desc:'Recupera posicion rapido'},{key:'tac6',label:'Intercepcion interior',desc:'Intercepta pases interiores'}],
  'Mediocentro': [{key:'tac1',label:'Ocupacion de espacios intermedios',desc:'Aparece entre las lineas rivales'},{key:'tac2',label:'Llegada al area',desc:'Se incorpora desde segunda linea'},{key:'tac3',label:'Apoyo entre lineas',desc:'Da continuidad al juego'},{key:'tac4',label:'Presion al poseedor',desc:'Presiona con intensidad'},{key:'tac5',label:'Ayuda defensiva en banda',desc:'Ayuda al lateral'},{key:'tac6',label:'Repliegue y equilibrio',desc:'Se repliega rapido en transicion'}],
  'Mediocentro Ofensivo': [{key:'tac1',label:'Ocupacion entre lineas',desc:'Se situa entre mediocampo y defensa rival'},{key:'tac2',label:'Conexion mediocampo-delanteros',desc:'Facilita la progresion'},{key:'tac3',label:'Llegada al area',desc:'Aparece en zonas de remate'},{key:'tac4',label:'Presion sobre el pivote rival',desc:'Activa presion sobre MC defensivo rival'},{key:'tac5',label:'Cierre de lineas interiores',desc:'Evita que el rival progrese por dentro'},{key:'tac6',label:'Repliegue a bloque medio',desc:'Se coloca en segunda linea defensiva'}],
  'Extremo Derecho': [{key:'tac1',label:'Fijar lateral y dar amplitud',desc:'Fija al lateral rival'},{key:'tac2',label:'Ataque al espacio a la espalda',desc:'Ataca el espacio detras del lateral'},{key:'tac3',label:'Duelos 1v1',desc:'Gana duelos individuales'},{key:'tac4',label:'Centros y pases atras',desc:'Genera peligro con centros'},{key:'tac5',label:'Presion al lateral rival',desc:'Presiona la salida de balon'},{key:'tac6',label:'Repliegue y cierre interior',desc:'Se repliega por su banda'}],
  'Extremo Izquierdo': [{key:'tac1',label:'Fijar lateral y dar amplitud',desc:'Fija al lateral rival'},{key:'tac2',label:'Ataque al espacio a la espalda',desc:'Ataca el espacio detras del lateral'},{key:'tac3',label:'Duelos 1v1',desc:'Gana duelos individuales'},{key:'tac4',label:'Centros y pases atras',desc:'Genera peligro con centros'},{key:'tac5',label:'Presion al lateral rival',desc:'Presiona la salida de balon'},{key:'tac6',label:'Repliegue y cierre interior',desc:'Se repliega por su banda'}],
  'Delantero Centro': [{key:'tac1',label:'Movimientos de ruptura',desc:'Desmarques a la espalda'},{key:'tac2',label:'Capacidad goleadora',desc:'Finaliza las ocasiones'},{key:'tac3',label:'Desmarques de apoyo',desc:'Se ofrece como apoyo'},{key:'tac4',label:'Primera presion',desc:'Inicia la presion'},{key:'tac5',label:'Orientacion hacia banda',desc:'Dirige su presion hacia banda'},{key:'tac6',label:'Bloqueo de pases al pivote',desc:'Bloquea lineas de pase al MC defensivo'}],
  'Segunda Punta': [{key:'tac1',label:'Movimientos de ruptura',desc:'Desmarques a la espalda'},{key:'tac2',label:'Capacidad goleadora',desc:'Finaliza las ocasiones'},{key:'tac3',label:'Desmarques de apoyo',desc:'Se ofrece como apoyo'},{key:'tac4',label:'Primera presion',desc:'Inicia la presion'},{key:'tac5',label:'Orientacion hacia banda',desc:'Dirige su presion hacia banda'},{key:'tac6',label:'Bloqueo de pases al pivote',desc:'Bloquea lineas de pase al MC defensivo'}],
}
const TACTICA_GENERICA = [{key:'tac1',label:'Posicionamiento',desc:'Ocupa correctamente los espacios'},{key:'tac2',label:'Presion',desc:'Presiona al poseedor con intensidad'},{key:'tac3',label:'Transicion',desc:'Reacciona rapido al cambio de fase'},{key:'tac4',label:'Juego colectivo',desc:'Contribuye al juego colectivo'}]

function getTacticaCriteria(position: string | null | undefined) {
  if (!position) return TACTICA_GENERICA
  return TACTICA_POR_POSICION[position] || TACTICA_GENERICA
}

function avgEval(ev: any) {
  const f = ev.media_fisica || 0
  const te = ev.media_tecnica || 0
  const ta = ev.media_tactica || 0
  const p = ev.media_psico || 0
  const count = [f,te,ta,p].filter(x => x > 0).length
  return count > 0 ? +((f+te+ta+p)/count).toFixed(1) : 0
}

function MiniRadar({ data }: { data: {area:string,value:number}[] }) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <RadarChart data={data} margin={{top:5,right:5,bottom:5,left:5}}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="area" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
        <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function EvalSummaryCard({ ev, jornadas, onClick }: { ev: any, jornadas: any[], onClick?: () => void }) {
  const j = jornadas.find(x => x.id === ev.jornada_id)
  const avg = avgEval(ev)
  const radarData = [
    { area: 'Fisica', value: ev.media_fisica || 0 },
    { area: 'Tecnica', value: ev.media_tecnica || 0 },
    { area: 'Tactica', value: ev.media_tactica || 0 },
    { area: 'Psico', value: ev.media_psico || 0 },
  ]
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{j ? `J${j.number} · ${j.type}` : 'Evaluacion'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {ev.created_at ? format(parseISO(ev.created_at), "d MMM yyyy", { locale: es }) : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(avg) }}>{avg || '—'}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>media</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 8 }}>
        {[
          { label: 'Fisica', val: ev.media_fisica },
          { label: 'Tecnica', val: ev.media_tecnica },
          { label: 'Tactica', val: ev.media_tactica },
          { label: 'Psico', val: ev.media_psico },
        ].map(d => (
          <div key={d.label} style={{ textAlign: 'center', background: 'var(--surface2)', borderRadius: 6, padding: '6px 2px' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor(d.val || 0) }}>{d.val?.toFixed(1) || '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.label}</div>
          </div>
        ))}
      </div>
      {onClick && (
        <button className="btn btn-ghost btn-sm btn-full" onClick={onClick} style={{ fontSize: 12 }}>
          Ver detalle →
        </button>
      )}
    </div>
  )
}

function EvalDetail({ ev, jornadas, position, onBack }: { ev: any, jornadas: any[], position: string|null, onBack: () => void }) {
  const j = jornadas.find(x => x.id === ev.jornada_id)
  const avg = avgEval(ev)
  const tacticaCriteria = getTacticaCriteria(position)

  const fisicaData = [
    { area: 'Velocidad', value: ev.velocidad || 0 },
    { area: 'Resistencia', value: ev.resistencia || 0 },
    { area: 'Fuerza', value: ev.fuerza || 0 },
    { area: 'Coordinacion', value: ev.coordinacion || 0 },
    { area: 'Agilidad', value: ev.agilidad || 0 },
    { area: 'Reaccion', value: ev.reaccion || 0 },
  ]
  const tecnicaData = [
    { area: 'Control', value: ev.tec1 || 0 },
    { area: 'Pase', value: ev.tec2 || 0 },
    { area: 'Regate', value: ev.tec3 || 0 },
    { area: 'Disparo', value: ev.tec4 || 0 },
    { area: 'Cabeza', value: ev.tec5 || 0 },
    { area: '1vs1', value: ev.tec6 || 0 },
  ]
  const tacticaData = tacticaCriteria.map(c => ({ area: c.label.split(' ')[0], value: ev[c.key] || 0 }))
  const psicoData = [
    { area: 'Actitud', value: ev.actitud || 0 },
    { area: 'Concentracion', value: ev.concentracion || 0 },
    { area: 'Confianza', value: ev.confianza || 0 },
    { area: 'Trabajo eq.', value: ev.trabajo_equipo || 0 },
    { area: 'Gest. error', value: ev.gestion_error || 0 },
    { area: 'Competit.', value: ev.competitividad || 0 },
  ]

  return (
    <div style={{ padding: '16px' }}>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>‹ Volver</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{j ? `J${j.number} · ${j.type}` : 'Evaluacion'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ev.created_at ? format(parseISO(ev.created_at), "d MMMM yyyy", { locale: es }) : ''}
          </div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor(avg) }}>{avg || '—'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: 'Fisica', val: ev.media_fisica, data: fisicaData },
          { label: 'Tecnica', val: ev.media_tecnica, data: tecnicaData },
          { label: 'Tactica', val: ev.media_tactica, data: tacticaData },
          { label: 'Psicologica', val: ev.media_psico, data: psicoData },
        ].map(d => (
          <div key={d.label} className="card" style={{ padding: '10px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{d.label.toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor(d.val || 0) }}>{d.val?.toFixed(1) || '—'}</div>
            </div>
            <MiniRadar data={d.data} />
          </div>
        ))}
      </div>

      {ev.notas && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>NOTAS</div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{ev.notas}</p>
        </div>
      )}
      {ev.minutos && (
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>MINUTOS JUGADOS</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{ev.minutos}'</div>
        </div>
      )}
    </div>
  )
}

function getWeekOptions() {
  const options = []
  const today = new Date()
  for (let i = 0; i < 4; i++) {
    const monday = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 })
    const sunday = addDays(monday, 6)
    options.push({
      label: `Semana del ${format(monday, 'd MMM', { locale: es })} al ${format(sunday, 'd MMM', { locale: es })}`,
      date: format(monday, 'yyyy-MM-dd'),
    })
  }
  return options
}

async function getOrCreateJornada(teamId: string, weekDate: string): Promise<string> {
  // Buscar jornada existente para esa semana
  const { data: existing } = await supabase
    .from('jornadas')
    .select('id')
    .eq('team_id', teamId)
    .eq('date', weekDate)
    .single()
  if (existing) return existing.id

  // Obtener numero siguiente
  const { data: all } = await supabase
    .from('jornadas')
    .select('number')
    .eq('team_id', teamId)
    .order('number', { ascending: false })
    .limit(1)
  const nextNumber = all && all.length > 0 ? (all[0].number + 1) : 1

  const { data: created } = await supabase
    .from('jornadas')
    .insert({ team_id: teamId, date: weekDate, number: nextNumber, type: 'semanal' })
    .select('id')
    .single()
  return created!.id
}

function EquipoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const session = getSession()
  const teamId = params.get('team')
  const fileRef = useRef<HTMLInputElement>(null)

  const [team, setTeam] = useState<any>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const periodoMinutos = useMemo(() => {
    const nm = (team?.name || '').toLowerCase()
    if (nm.includes('prebenjam')) return [10,20,30,40]
    if (nm.includes('benjam')) return [12,24,36,48]
    if (nm.includes('alev')) return [15,30,45,60]
    if (nm.includes('infant')) return [18,36,54,72]
    return [] as number[]
  }, [team?.name])
  const [players, setPlayers] = useState<any[]>([])
  const [jornadas, setJornadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [evals, setEvals] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [psychs, setPsychs] = useState<any[]>([])
  const [psychSessions, setPsychSessions] = useState<any[]>([])
  const [addingSession, setAddingSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stats')
  const [evalForm, setEvalForm] = useState<any>({})
  const [selectedJornada, setJornada] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(getWeekOptions()[0].date)
  const [saving, setSaving] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editingField, setEditingField] = useState<string|null>(null)
  const [editValue, setEditValue] = useState('')
  const [newPlayer, setNewPlayer] = useState({ name: '', dorsal: '', position: '', birth_year: '', foot: '' })
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [evalDetail, setEvalDetail] = useState<any>(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [playerReports, setPlayerReports] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [teamMatches, setTeamMatches] = useState<any[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [editingResult, setEditingResult] = useState<any>(null)
  const [resultForm, setResultForm] = useState<{propio:string,rival:string}>({propio:'',rival:''})
  const [matchStats, setMatchStats] = useState<any[]>([])
  const [selectedMatch, setSelectedMatch] = useState<string>('')
  const [matchForm, setMatchForm] = useState<any>({})
  const [savingMatch, setSavingMatch] = useState(false)
  const [pdfComment, setPdfComment] = useState('')
  const [pdfObjectives, setPdfObjectives] = useState('')
  const [pdfSelectedEvals, setPdfSelectedEvals] = useState<string[]>([])

  const canEdit = canEditEval(session?.role || 'coach')
  const canMeetings = canSeePrivateNotes(session?.role || 'coach')
  const canPsych = canSeePsychNotes(session?.role || 'coach')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    const id = teamId || session.team_ids?.[0]
    if (!id) { router.push('/dashboard'); return }
    loadTeamData(id)
  }, [teamId])

  async function loadTeamData(id: string) {
    setLoading(true)
    supabase.from('matches').select('*').eq('team_id', id).order('jornada', { ascending: true }).then(({ data }) => { setTeamMatches(data || []); setMatches(data || []) })
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
    // Abrir jugador si viene en la URL
    const playerParam = params.get('player')
    if (playerParam && pl) {
      const found = pl.find((p: any) => p.id === playerParam)
      if (found) openPlayer(found)
    }
  }

  async function saveNewPlayer() {
    if (!newPlayer.name.trim() || !team) return
    setSavingPlayer(true)
    await supabase.from('players').insert({
      name: newPlayer.name.trim(),
      dorsal: newPlayer.dorsal ? parseInt(newPlayer.dorsal) : null,
      position: newPlayer.position || null,
      birth_year: newPlayer.birth_year ? parseInt(newPlayer.birth_year) : null,
      foot: newPlayer.foot || null,
      team_id: team.id
    })
    setShowAddPlayer(false)
    setNewPlayer({ name: '', dorsal: '', position: '', birth_year: '', foot: '' })
    loadTeamData(team.id)
    setSavingPlayer(false)
  }

  async function deletePlayer(p: any) {
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

  async function uploadPhoto(file: File) {
    if (!selected || !file) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${selected.id}.${ext}`
    const { error } = await supabase.storage.from('player-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl(path)
      const photoUrl = urlData.publicUrl + '?t=' + Date.now()
      await supabase.from('players').update({ photo_url: photoUrl }).eq('id', selected.id)
      setSelected((p: any) => ({ ...p, photo_url: photoUrl }))
      setPlayers(ps => ps.map(p => p.id === selected.id ? { ...p, photo_url: photoUrl } : p))
    }
    setUploadingPhoto(false)
  }

  async function openPlayer(p: any) {
    setSelected(p)
    setTab('ficha')
    setEvalDetail(null)
    const { data } = await supabase.from('evaluations').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
    setEvals(data || [])
    if (canMeetings) {
      const { data: m } = await supabase.from('player_meetings').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
      setMeetings(m || [])
    }
    if (canPsych) {
      const { data: ps } = await supabase.from('player_psych').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
      setPsychs(ps || [])
      const { data: pss } = await supabase.from('psych_sessions').select('*').eq('player_id', p.id).order('session_date', { ascending: false })
      setPsychSessions(pss || [])
    }
    const { data: rpData } = await supabase.from('player_reports').select('*').eq('player_id', p.id).order('created_at', { ascending: false })
    setPlayerReports(rpData || [])
    const { data: mData } = await supabase.from('matches').select('*').eq('team_id', p.team_id).order('fecha', { ascending: false })
    setMatches(mData || [])
    const { data: msData } = await supabase.from('player_match_stats').select('*').eq('player_id', p.id)
    setMatchStats(msData || [])
  }


  async function saveResult() {
    if (!editingResult) return
    await supabase.from('matches').update({
      resultado_propio: parseInt(resultForm.propio) || 0,
      resultado_rival: parseInt(resultForm.rival) || 0
    }).eq('id', editingResult.id)
    setTeamMatches(ms => ms.map((m: any) => m.id === editingResult.id
      ? { ...m, resultado_propio: parseInt(resultForm.propio)||0, resultado_rival: parseInt(resultForm.rival)||0 }
      : m))
    setEditingResult(null)
  }

  async function deleteMatchStat(statId: string) {
    if (!confirm('¿Eliminar las estadísticas de este partido?')) return
    await supabase.from('player_match_stats').delete().eq('id', statId)
    const { data: msData } = await supabase.from('player_match_stats').select('*').eq('player_id', selected!.id)
    setMatchStats(msData || [])
    setSelectedMatch('')
    setMatchForm({})
  }

  async function saveMatchStat() {
    if (!selected || !selectedMatch || !session) return
    setSavingMatch(true)
    const existing = matchStats.find((s: any) => s.match_id === selectedMatch)
    const payload = {
      match_id: selectedMatch,
      player_id: selected.id,
      team_id: selected.team_id,
      created_by: session.id,
      titular: matchForm.titular || false,
      minutos: parseInt(matchForm.minutos) || 0,
      goles: parseInt(matchForm.goles) || 0,
      asistencias: parseInt(matchForm.asistencias) || 0,
      tiros: parseInt(matchForm.tiros) || 0,
      tiros_puerta: parseInt(matchForm.tiros_puerta) || 0,
      recuperaciones: parseInt(matchForm.recuperaciones) || 0,
      intercepciones: parseInt(matchForm.intercepciones) || 0,
      entradas: parseInt(matchForm.entradas) || 0,
      pases_completos: parseInt(matchForm.pases_completos) || 0,
      pases_fallados: parseInt(matchForm.pases_fallados) || 0,
      faltas_cometidas: parseInt(matchForm.faltas_cometidas) || 0,
      faltas_recibidas: parseInt(matchForm.faltas_recibidas) || 0,
      amarillas: parseInt(matchForm.amarillas) || 0,
      rojas: parseInt(matchForm.rojas) || 0,
      cuartos_jugados: matchForm.cuartos || [],
    }
    if (existing) {
      await supabase.from('player_match_stats').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('player_match_stats').insert(payload)
    }
    const { data: msData } = await supabase.from('player_match_stats').select('*').eq('player_id', selected.id)
    setMatchStats(msData || [])
    setSavingMatch(false)
  }

  async function saveEval() {
    if (!selected || !session) return
    setSaving(true)
    const jornadaId = await getOrCreateJornada(team.id, selectedWeek)
    const payload = { jornada_id: jornadaId, player_id: selected.id, team_id: team.id, evaluator_id: session.id, ...evalForm }
    await supabase.from('evaluations').upsert(payload, { onConflict: 'jornada_id,player_id' })
    setSaving(false)
    const { data } = await supabase.from('evaluations').select('*').eq('player_id', selected.id).order('created_at', { ascending: false })
    setEvals(data || [])
    setTab('stats')
  }

  async function addPsychSession() {
    if (!selected || !session) return
    setAddingSession(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('psych_sessions').insert({
      player_id: selected.id,
      session_date: today,
      created_by: session.id
    })
    const { data: pss } = await supabase.from('psych_sessions').select('*').eq('player_id', selected.id).order('session_date', { ascending: false })
    setPsychSessions(pss || [])
    setAddingSession(false)
  }

    async function addMeeting(role: 'coach' | 'psychologist') {
    if (!noteText.trim() || !selected || !session) return
    setAddingNote(true)
    const table = role === 'psychologist' ? 'player_psych' : 'player_meetings'
    const payload: any = { player_id: selected.id, author_id: session.id, author_name: session.name, content: noteText.trim() }
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


  async function generatePDF() {
    if (!selected) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210, mg = 14; let y = 0
    doc.setFillColor(10,20,40); doc.rect(0,0,pw,38,'F')
    try {
      const ib = await fetch(window.location.origin+'/escudo.jpeg').then(r=>r.blob())
      await new Promise<void>(res=>{const rd=new FileReader();rd.onload=()=>{doc.addImage(rd.result as string,'JPEG',mg,6,22,22);res()};rd.readAsDataURL(ib)})
    } catch {}
    doc.setTextColor(212,175,55);doc.setFontSize(14);doc.setFont('helvetica','bold')
    doc.text('CD SAN CAYETANO',mg+26,16)
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180)
    doc.text('Informe de jugador',mg+26,22)
    doc.text(format(new Date(),"d 'de' MMMM yyyy",{locale:es}),mg+26,28)
    doc.setTextColor(212,175,55);doc.setFontSize(10);doc.setFont('helvetica','bold')
    doc.text(team?.name||'',pw-mg,20,{align:'right'})
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(180,180,180)
    doc.text(team?.modalidad||'',pw-mg,27,{align:'right'})
    y=46; let fotoOk=false
    if(selected.photo_url){
      try{
        const b2=await fetch(selected.photo_url).then(r=>r.blob())
        await new Promise<void>(res=>{const rd2=new FileReader();rd2.onload=()=>{doc.addImage(rd2.result as string,'JPEG',mg,y,28,34,undefined,'FAST');fotoOk=true;res()};rd2.readAsDataURL(b2)})
      }catch{}
    }
    doc.setFillColor(20,32,56);doc.roundedRect(mg,y,pw-mg*2,36,3,3,'F')
    if(fotoOk){doc.setFillColor(10,20,40);doc.roundedRect(mg,y,30,36,3,3,'F')}
    const dx=fotoOk?mg+32:mg+3
    doc.setTextColor(212,175,55);doc.setFontSize(14);doc.setFont('helvetica','bold')
    doc.text(selected.name,dx,y+10)
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(200,200,200)
    doc.text('Dorsal: #'+(selected.dorsal||'-')+'   Posicion: '+(selected.position||'-'),dx,y+18)
    doc.text('Ano nac.: '+(selected.birth_year||'-')+'   Pie: '+(selected.foot||'-'),dx,y+25)
    y+=44
    const evSel=evals.filter((e:any)=>pdfSelectedEvals.includes(e.id))
    function rgb(v:number):[number,number,number]{const r=Math.min(Math.max(v,0),10)/10;return[Math.round(220*(1-r)),Math.round(180*r),40]}
    if(evSel.length>0){
      doc.setTextColor(212,175,55);doc.setFontSize(11);doc.setFont('helvetica','bold')
      doc.text('Evaluaciones',mg,y);y+=6
      const rows=evSel.map((e:any)=>{
        const jj=jornadas.find((x:any)=>x.id===e.jornada_id)
        return[jj?'S'+jj.number:'-',e.created_at?format(parseISO(e.created_at),'d MMM yy',{locale:es}):'-',
          e.media_fisica?.toFixed(1)||'-',e.media_tecnica?.toFixed(1)||'-',
          e.media_tactica?.toFixed(1)||'-',e.media_psico?.toFixed(1)||'-',avgEval(e).toFixed(1)]
      })
      const aF=evSel.reduce((s:number,e:any)=>s+(e.media_fisica||0),0)/evSel.length
      const aTe=evSel.reduce((s:number,e:any)=>s+(e.media_tecnica||0),0)/evSel.length
      const aTa=evSel.reduce((s:number,e:any)=>s+(e.media_tactica||0),0)/evSel.length
      const aPs=evSel.reduce((s:number,e:any)=>s+(e.media_psico||0),0)/evSel.length
      const aTot=(aF+aTe+aTa+aPs)/4
      ;(doc as any).autoTable({
        startY:y,head:[['Sem','Fecha','Fisica','Tecnica','Tactica','Psico','Media']],body:rows,
        foot:[['Media','',aF.toFixed(1),aTe.toFixed(1),aTa.toFixed(1),aPs.toFixed(1),aTot.toFixed(1)]],
        styles:{fontSize:8,cellPadding:2,textColor:[220,220,220],fillColor:[20,32,56],lineColor:[40,60,90],lineWidth:0.3},
        headStyles:{fillColor:[10,20,40],textColor:[212,175,55],fontStyle:'bold'},
        footStyles:{fillColor:[10,20,40],textColor:[212,175,55],fontStyle:'bold'},
        columnStyles:{0:{cellWidth:12},1:{cellWidth:22},2:{cellWidth:20},3:{cellWidth:20},4:{cellWidth:20},5:{cellWidth:20},6:{cellWidth:20}},
        didParseCell:(data:any)=>{
          if((data.section==='body'||data.section==='foot')&&data.column.index>=2){
            const v=parseFloat(data.cell.raw)
            if(Number.isFinite(v)){const[r,g,b]=rgb(v);data.cell.styles.textColor=[r,g,b];data.cell.styles.fontStyle='bold'}
          }
        },
        margin:{left:mg,right:mg}
      })
      y=(doc as any).lastAutoTable.finalY+8
      if(y<215){
        doc.setTextColor(212,175,55);doc.setFontSize(10);doc.setFont('helvetica','bold')
        doc.text('Perfil medio',mg,y);y+=4
        const cx=mg+28,cy=y+26,rv=22
        const vals=[aF,aTe,aTa,aPs]
        const angs=vals.map((_:number,i:number)=>(i*Math.PI*2/4)-Math.PI/2)
        for(let ring=1;ring<=4;ring++){
          const rr=rv*ring/4;doc.setDrawColor(40,60,100);doc.setLineWidth(0.2)
          const pts=angs.map((a:number)=>[cx+rr*Math.cos(a),cy+rr*Math.sin(a)])
          for(let i=0;i<pts.length;i++){const nx=pts[(i+1)%pts.length];doc.line(pts[i][0],pts[i][1],nx[0],nx[1])}
        }
        angs.forEach((a:number)=>{doc.setDrawColor(60,80,120);doc.line(cx,cy,cx+rv*Math.cos(a),cy+rv*Math.sin(a))})
        const vpts=angs.map((a:number,i:number)=>{const rr2=rv*(vals[i]/10);return[cx+rr2*Math.cos(a),cy+rr2*Math.sin(a)]})
        doc.setDrawColor(212,175,55);doc.setLineWidth(1)
        for(let i=0;i<vpts.length;i++){const nx=vpts[(i+1)%vpts.length];doc.line(vpts[i][0],vpts[i][1],nx[0],nx[1])}
        const labels=['Fisica','Tecnica','Tactica','Psico']
        doc.setFontSize(7);doc.setFont('helvetica','bold')
        labels.forEach((lb:string,i:number)=>{
          const lx=cx+(rv+7)*Math.cos(angs[i]),ly=cy+(rv+7)*Math.sin(angs[i])
          const[r,g,b]=rgb(vals[i]);doc.setTextColor(r,g,b)
          doc.text(lb+' '+vals[i].toFixed(1),lx,ly,{align:'center'})
        })
        y+=58
      }
    }
    if(pdfComment.trim()){
      doc.setFillColor(240,240,248);doc.roundedRect(mg,y,pw-mg*2,6,2,2,'F')
      doc.setTextColor(10,20,40);doc.setFontSize(9);doc.setFont('helvetica','bold')
      doc.text('Comentario del entrenador',mg+3,y+5);y+=8
      doc.setTextColor(30,30,50);doc.setFont('helvetica','normal');doc.setFontSize(8)
      const l1=doc.splitTextToSize(pdfComment,pw-mg*2-4)
      doc.text(l1,mg+3,y);y+=l1.length*4.5+8
    }
    if(pdfObjectives.trim()){
      doc.setFillColor(240,240,248);doc.roundedRect(mg,y,pw-mg*2,6,2,2,'F')
      doc.setTextColor(10,20,40);doc.setFontSize(9);doc.setFont('helvetica','bold')
      doc.text('Objetivos',mg+3,y+5);y+=8
      doc.setTextColor(30,30,50);doc.setFont('helvetica','normal');doc.setFontSize(8)
      const l2=doc.splitTextToSize(pdfObjectives,pw-mg*2-4)
      doc.text(l2,mg+3,y)
    }
    doc.setFillColor(10,20,40);doc.rect(0,285,pw,12,'F')
    doc.setTextColor(100,100,100);doc.setFontSize(7);doc.setFont('helvetica','normal')
    doc.text('CD San Cayetano - Documento confidencial',mg,292)
    doc.text(format(new Date(),'dd/MM/yyyy HH:mm'),pw-mg,292,{align:'right'})
    // Guardar referencia del informe en Supabase
    const pdfBlob = doc.output('blob')
    const fileName = 'report_' + selected.id + '_' + Date.now() + '.pdf'
    const { data: uploadData } = await supabase.storage.from('player-photos').upload('reports/' + fileName, pdfBlob, { contentType: 'application/pdf', upsert: false })
    const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl('reports/' + fileName)
    await supabase.from('player_reports').insert({
      player_id: selected.id,
      team_id: selected.team_id,
      created_by: session.id,
      created_by_name: session.name,
      comment: pdfComment,
      objectives: pdfObjectives,
      eval_ids: pdfSelectedEvals,
      pdf_url: urlData?.publicUrl || null
    })
    doc.save('informe_'+selected.name.replace(/\s+/g,'_')+'.pdf')
    setShowPdfModal(false);setPdfComment('');setPdfObjectives('')
  }
  if (!session) return null

  if (selected) {
    const tacticaCriteria = getTacticaCriteria(selected.position)
    const lastEval = evals[0]
    const avgData = [
      { area: 'Fisica', value: +(evals.reduce((s,e) => s+(e.media_fisica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Tecnica', value: +(evals.reduce((s,e) => s+(e.media_tecnica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Tactica', value: +(evals.reduce((s,e) => s+(e.media_tactica||0), 0)/Math.max(evals.length,1)).toFixed(1) },
      { area: 'Psicolog.', value: +(evals.reduce((s,e) => s+(e.media_psico||0), 0)/Math.max(evals.length,1)).toFixed(1) },
    ]
    const evoData = [...evals].reverse().map((e, i) => ({ j: `J${i+1}`, Fisica: e.media_fisica, Tecnica: e.media_tecnica, Tactica: e.media_tactica, Psico: e.media_psico }))
    const scores = [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10]

    const tabs = [
      { key: 'ficha', label: 'Ficha' },
      ...(canEdit ? [{ key: 'eval', label: 'Evaluar' }] : []),
      { key: 'evaluaciones', label: 'Evaluaciones' },
      { key: 'partidos', label: 'Estadísticas' },
      { key: 'informes', label: 'Informes' },
      ...(canMeetings ? [{ key: 'reuniones', label: 'Reuniones' }] : []),
      ...(canPsych ? [{ key: 'psico', label: 'Psicologo' }] : []),
    ]

    return (
      <div className="page-content">
        {/* Header */}
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>‹</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Foto */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface3)', border: '2px solid var(--border-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => canEdit && fileRef.current?.click()}
              >
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    {canEdit ? (
                      <>
                        <div style={{ fontSize: 16 }}>📷</div>
                        <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Subir</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 20 }}>👤</div>
                    )}
                  </div>
                )}
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    <div className="loader animate-spin" style={{ width: 16, height: 16 }} />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                #{selected.dorsal} · {selected.position || '—'}
                {selected.foot && <span> · {selected.foot}</span>}
                {selected.birth_year && <span> · {selected.birth_year}</span>}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 13 }} onClick={() => { setPdfSelectedEvals(evals.map(e=>e.id)); setShowPdfModal(true) }}>📄</button>
          {canEdit && <button className="btn btn-ghost btn-sm" style={{ color:'#FC8181' }} onClick={() => deletePlayer(selected)}>🗑</button>}
        </div>

        {/* Tabs */}
        <div className="scroll-row" style={{ padding: '10px 16px 0' }}>
          {tabs.map(t => (
            <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-gold' : 'btn-ghost'}`} onClick={() => { setTab(t.key); setEvalDetail(null) }}>{t.label}</button>
          ))}
        </div>

        {/* STATS */}
        {tab === 'ficha' && (
          <div style={{ padding: '16px' }}>
            {/* Foto en ficha */}
            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface3)', border: '3px solid var(--border-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onClick={() => fileRef.current?.click()}
                  >
                    {selected.photo_url ? (
                      <img src={selected.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28 }}>📷</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Subir foto</div>
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        <div className="loader animate-spin" style={{ width: 20, height: 20 }} />
                      </div>
                    )}
                  </div>
                  {selected.photo_url && (
                    <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Toca para cambiar</div>
                  )}
                </div>
              </div>
            )}
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>POSICION</div>
                {editingField === 'position' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input" style={{ flex: 1 }} value={editValue} onChange={e => setEditValue(e.target.value)}>
                      <option value="">Sin posicion</option>
                      {['Portero','Defensa Central','Lateral Derecho','Lateral Izquierdo','Mediocentro Defensivo','Mediocentro','Mediocentro Ofensivo','Extremo Derecho','Extremo Izquierdo','Delantero Centro','Segunda Punta'].map(p => <option key={p}>{p}</option>)}
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
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PIE DOMINANTE</div>
                {editingField === 'foot' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="input" style={{ flex: 1 }} value={editValue} onChange={e => setEditValue(e.target.value)}>
                      <option value="">—</option>
                      <option>Derecho</option><option>Izquierdo</option><option>Ambidiestro</option>
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

            {/* Resumen ultima evaluacion */}
            {lastEval && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Ultima evaluacion</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'Fisica', val: lastEval.media_fisica },
                    { label: 'Tecnica', val: lastEval.media_tecnica },
                    { label: 'Tactica', val: lastEval.media_tactica },
                    { label: 'Psico', val: lastEval.media_psico },
                  ].map(d => (
                    <div key={d.label} className="card-sm" style={{ textAlign: 'center', padding: '10px 4px' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(d.val || 0) }}>{d.val?.toFixed(1) || '—'}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {lastEval.created_at ? format(parseISO(lastEval.created_at), "d MMM yyyy", { locale: es }) : ''}
                  </span>
                  <span style={{ marginLeft: 12, fontSize: 20, fontWeight: 800, color: scoreColor(avgEval(lastEval)) }}>{avgEval(lastEval)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>media</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Fisica', val: lastEval.media_fisica, data: [{area:'Velocidad',value:lastEval.velocidad||0},{area:'Resistencia',value:lastEval.resistencia||0},{area:'Fuerza',value:lastEval.fuerza||0},{area:'Coordinacion',value:lastEval.coordinacion||0},{area:'Agilidad',value:lastEval.agilidad||0},{area:'Reaccion',value:lastEval.reaccion||0}] },
                    { label: 'Tecnica', val: lastEval.media_tecnica, data: [{area:'Control',value:lastEval.tec1||0},{area:'Pase',value:lastEval.tec2||0},{area:'Regate',value:lastEval.tec3||0},{area:'Disparo',value:lastEval.tec4||0},{area:'Cabeza',value:lastEval.tec5||0},{area:'1vs1',value:lastEval.tec6||0}] },
                    { label: 'Tactica', val: lastEval.media_tactica, data: getTacticaCriteria(selected.position).map(c=>({area:c.label.split(' ')[0],value:lastEval[c.key]||0})) },
                    { label: 'Psicologica', val: lastEval.media_psico, data: [{area:'Actitud',value:lastEval.actitud||0},{area:'Concentracion',value:lastEval.concentracion||0},{area:'Confianza',value:lastEval.confianza||0},{area:'Trabajo eq.',value:lastEval.trabajo_equipo||0},{area:'Gest.error',value:lastEval.gestion_error||0},{area:'Competit.',value:lastEval.competitividad||0}] },
                  ].map(d => (
                    <div key={d.label} className="card" style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{d.label.toUpperCase()}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: scoreColor(d.val||0) }}>{d.val?.toFixed(1)||'—'}</div>
                      </div>
                      <MiniRadar data={d.data} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOTALES TEMPORADA */}
            {matchStats.length > 0 && (() => {
              const tot = matchStats.reduce((acc: any, s: any) => ({
                minutos: acc.minutos + (s.minutos || 0),
                goles: acc.goles + (s.goles || 0),
                asistencias: acc.asistencias + (s.asistencias || 0),
                amarillas: acc.amarillas + (s.amarillas || 0),
                rojas: acc.rojas + (s.rojas || 0),
                partidos: acc.partidos + 1,
              }), { minutos: 0, goles: 0, asistencias: 0, amarillas: 0, rojas: 0, partidos: 0 })
              return (
                <div style={{ margin: '16px 0', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Estadísticas temporada</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Partidos', val: tot.partidos, icon: '⚽' },
                      { label: 'Minutos', val: tot.minutos, icon: '⏱' },
                      { label: 'Goles', val: tot.goles, icon: '⚽' },
                      { label: 'Asist.', val: tot.asistencias, icon: '🌟' },
                      { label: 'Amarillas', val: tot.amarillas, icon: '🟨' },
                      { label: 'Rojas', val: tot.rojas, icon: '🟥' },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {canMeetings && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--gold)' }}>Historial reuniones</div>
                <NotesList notes={meetings} sessionId={session.id} />
              </div>
            )}
            {canPsych && (
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Sesiones psicólogo</div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: 12 }}
                  disabled={addingSession}
                  onClick={addPsychSession}>
                  {addingSession ? 'Registrando...' : '+ Registrar sesión hoy'}
                </button>
                {psychSessions.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin sesiones registradas</div>
                  : <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                      {psychSessions.map((s: any) => (
                        <div key={s.id} style={{ fontSize: 13, color: 'var(--text)', padding: '4px 8px', background: 'var(--surface2)', borderRadius: 6 }}>
                          {new Date(s.session_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}
          </div>
        )}

        {/* EVALUAR */}
        {tab === 'eval' && canEdit && (
          <div style={{ padding: '16px' }}>
            <label className="label">Semana</label>
            <select className="input" style={{ marginBottom: 16 }} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
              {getWeekOptions().map(w => <option key={w.date} value={w.date}>{w.label}</option>)}
            </select>
            {/* Fisica */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Fisica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.fisica.map((label, i) => {
                  const key = ['velocidad','resistencia','fuerza','coordinacion','agilidad','reaccion'][i]
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
                        <option value="">—</option>
                        {scores.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Tecnica */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Tecnica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.tecnica.map((label, i) => {
                  const key = `tec${i+1}`
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
                        <option value="">—</option>
                        {scores.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Tactica */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--gold)' }}>Tactica</div>
              {selected.position && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>Criterios para: {selected.position}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tacticaCriteria.map(item => (
                  <div key={item.key} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>{item.desc}</div>
                    <select className="score-input" value={evalForm[item.key] ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, [item.key]: e.target.value ? +e.target.value : null }))}>
                      <option value="">—</option>
                      {scores.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            {/* Psicologica */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Psicologica</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CRITERIA.psico.map((label, i) => {
                  const key = ['actitud','concentracion','confianza','trabajo_equipo','gestion_error','competitividad','fairplay'][i]
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <select className="score-input" value={evalForm[key] ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, [key]: e.target.value ? +e.target.value : null }))}>
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
                <input type="number" className="input" placeholder="90" value={evalForm.minutos ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, minutos: e.target.value ? +e.target.value : null }))} />
              </div>
            </div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} style={{ marginBottom: 16 }} value={evalForm.notas ?? ''} onChange={e => setEvalForm((f:any) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones..." />
            <button className="btn btn-gold btn-full" onClick={saveEval} disabled={saving}>{saving ? 'Guardando...' : 'Guardar evaluacion'}</button>
          </div>
        )}

        {/* EVALUACIONES */}
        {tab === 'evaluaciones' && (
          <div style={{ padding: '16px' }}>
            {evalDetail ? (
              <EvalDetail ev={evalDetail} jornadas={jornadas} position={selected.position} onBack={() => setEvalDetail(null)} />
            ) : evals.length === 0 ? (
              <div className="empty-state"><div className="icon">📋</div><div>Sin evaluaciones todavia</div></div>
            ) : (
              evals.map(ev => (
                <EvalSummaryCard key={ev.id} ev={ev} jornadas={jornadas} onClick={() => setEvalDetail(ev)} />
              ))
            )}
          </div>
        )}

        {/* REUNIONES */}

        {tab === 'partidos' && (
          <div style={{ padding: '0 4px' }}>

            {/* TOTALES ACUMULADOS */}
            {matchStats.length > 0 && (() => {
              const tot = matchStats.reduce((acc: any, s: any) => ({
                partidos: acc.partidos + 1,
                minutos: acc.minutos + (s.minutos || 0),
                goles: acc.goles + (s.goles || 0),
                asistencias: acc.asistencias + (s.asistencias || 0),
                amarillas: acc.amarillas + (s.amarillas || 0),
                rojas: acc.rojas + (s.rojas || 0),
                tiros: acc.tiros + (s.tiros || 0),
                tiros_puerta: acc.tiros_puerta + (s.tiros_puerta || 0),
                recuperaciones: acc.recuperaciones + (s.recuperaciones || 0),
                intercepciones: acc.intercepciones + (s.intercepciones || 0),
                entradas: acc.entradas + (s.entradas || 0),
                pases_completos: acc.pases_completos + (s.pases_completos || 0),
                pases_fallados: acc.pases_fallados + (s.pases_fallados || 0),
                faltas_cometidas: acc.faltas_cometidas + (s.faltas_cometidas || 0),
                faltas_recibidas: acc.faltas_recibidas + (s.faltas_recibidas || 0),
              }), { partidos:0,minutos:0,goles:0,asistencias:0,amarillas:0,rojas:0,tiros:0,tiros_puerta:0,recuperaciones:0,intercepciones:0,entradas:0,pases_completos:0,pases_fallados:0,faltas_cometidas:0,faltas_recibidas:0 })
              return (
                <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Totales temporada</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[
                      { label: 'PJ', val: tot.partidos },
                      { label: 'MIN', val: tot.minutos },
                      { label: 'GOL', val: tot.goles },
                      { label: 'ASI', val: tot.asistencias },
                      { label: '🟨', val: tot.amarillas },
                      { label: '🟥', val: tot.rojas },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: 'center', minWidth: 44, padding: '6px 8px', background: 'var(--surface)', borderRadius: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Tiros', val: tot.tiros },
                      { label: 'A puerta', val: tot.tiros_puerta },
                      { label: 'Recup.', val: tot.recuperaciones },
                      { label: 'Intcep.', val: tot.intercepciones },
                      { label: 'Entradas', val: tot.entradas },
                      { label: 'Pases OK', val: tot.pases_completos },
                      { label: 'Pases fail', val: tot.pases_fallados },
                      { label: 'F.Com.', val: tot.faltas_cometidas },
                      { label: 'F.Rec.', val: tot.faltas_recibidas },
                    ].filter(i => i.val > 0).map(item => (
                      <div key={item.label} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 6, padding: '3px 8px' }}>
                        <b style={{ color: 'var(--text)' }}>{item.val}</b> {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* FORMULARIO NUEVO PARTIDO */}
            {matches.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚽</div>
                Sin partidos en el calendario
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>Registrar partido</div>
                <select className="input" style={{ marginBottom: 16 }}
                  value={selectedMatch}
                  onChange={e => {
                    setSelectedMatch(e.target.value)
                    const existing = matchStats.find((s: any) => s.match_id === e.target.value)
                    if (existing) {
                      setMatchForm({
                        titular: existing.titular,
                        minutos: existing.minutos,
                        goles: existing.goles,
                        asistencias: existing.asistencias,
                        tiros: existing.tiros,
                        tiros_puerta: existing.tiros_puerta,
                        recuperaciones: existing.recuperaciones,
                        intercepciones: existing.intercepciones,
                        entradas: existing.entradas,
                        pases_completos: existing.pases_completos,
                        pases_fallados: existing.pases_fallados,
                        faltas_cometidas: existing.faltas_cometidas,
                        faltas_recibidas: existing.faltas_recibidas,
                        amarillas: existing.amarillas,
                        rojas: existing.rojas,
                        cuartos: existing.cuartos_jugados || [],
                      })
                    } else {
                      setMatchForm({ titular: true, minutos: 0, goles: 0, asistencias: 0, tiros: 0, tiros_puerta: 0, recuperaciones: 0, intercepciones: 0, entradas: 0, pases_completos: 0, pases_fallados: 0, faltas_cometidas: 0, faltas_recibidas: 0, amarillas: 0, rojas: 0, cuartos: [] })
                    }
                  }}
                >
                  <option value="">-- Seleccionar partido --</option>
                  {matches.map((m: any) => (
                    <option key={m.id} value={m.id}>J{m.jornada} - {m.local ? 'San Cayetano vs ' + m.rival : m.rival + ' vs San Cayetano'} {m.fecha ? '(' + m.fecha + ')' : ''}</option>
                  ))}
                </select>

                {selectedMatch && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                    {/* TITULAR */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13 }}>
                      <input type="checkbox" checked={matchForm.titular} onChange={e => setMatchForm((f: any) => ({ ...f, titular: e.target.checked }))} />
                      Titular
                    </label>

                    {/* MINUTOS */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Minutos jugados</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                        {periodoMinutos.map((p: number) => (
                          <button key={p}
                            className={'btn btn-sm '+(matchForm.minutos === p ? 'btn-gold' : 'btn-ghost')}
                            onClick={() => setMatchForm((f: any) => ({ ...f, minutos: p }))}>
                            {p}'
                          </button>
                        ))}
                        <input
                          type="number" min={0} max={120}
                          value={matchForm.minutos ?? ''}
                          onChange={e => setMatchForm((f: any) => ({ ...f, minutos: e.target.value === '' ? 0 : parseInt(e.target.value)||0 }))}
                          style={{ width: periodoMinutos.length > 0 ? 64 : 100, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, textAlign: 'center' as const }}
                          placeholder="min"
                        />
                      </div>
                    </div>
                    {/* OBLIGATORIOS */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Obligatorios</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      {[
                        { key: 'goles', label: 'Goles' },
                        { key: 'asistencias', label: 'Asistencias' },
                        { key: 'amarillas', label: 'Amarillas' },
                        { key: 'rojas', label: 'Rojas' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setMatchForm((f: any) => ({ ...f, [key]: Math.max(0, (f[key]||0) - 1) }))}>-</button>
                            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{matchForm[key] || 0}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => setMatchForm((f: any) => ({ ...f, [key]: (f[key]||0) + 1 }))}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* OPTATIVOS */}
                    <details style={{ marginBottom: 16 }}>
                      <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', marginBottom: 10 }}>Más estadísticas (opcionales)</summary>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                        {[
                          { key: 'tiros', label: 'Tiros' },
                          { key: 'tiros_puerta', label: 'A puerta' },
                          { key: 'recuperaciones', label: 'Recuperaciones' },
                          { key: 'intercepciones', label: 'Intercepciones' },
                          { key: 'entradas', label: 'Entradas' },
                          { key: 'pases_completos', label: 'Pases completados' },
                          { key: 'pases_fallados', label: 'Pases fallados' },
                          { key: 'faltas_cometidas', label: 'Faltas cometidas' },
                          { key: 'faltas_recibidas', label: 'Faltas recibidas' },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setMatchForm((f: any) => ({ ...f, [key]: Math.max(0, (f[key]||0) - 1) }))}>-</button>
                              <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{matchForm[key] || 0}</span>
                              <button className="btn btn-ghost btn-sm" onClick={() => setMatchForm((f: any) => ({ ...f, [key]: (f[key]||0) + 1 }))}>+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>

                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveMatchStat} disabled={savingMatch}>
                      {savingMatch ? 'Guardando...' : (matchStats.find((s: any) => s.match_id === selectedMatch) ? 'Actualizar partido' : 'Guardar partido')}
                    </button>
                  </div>
                )}

                {/* HISTORICO */}
                {matchStats.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Histórico partidos</div>
                    {[...matchStats].sort((a: any, b: any) => {
                      const ma = matches.find((m: any) => m.id === a.match_id)
                      const mb = matches.find((m: any) => m.id === b.match_id)
                      return (ma?.jornada || 0) - (mb?.jornada || 0)
                    }).map((s: any) => {
                      const m = matches.find((mm: any) => mm.id === s.match_id)
                      if (!m) return null
                      const rival = m.local ? 'vs ' + m.rival : m.rival + ' vs SC'
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6, fontSize: 13, flexWrap: 'wrap' }}
                          onClick={() => setSelectedMatch(s.match_id)}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 28 }}>J{m.jornada}</span>
                          <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 80 }}>{rival}</span>
                          <span style={{ color: 'var(--text)' }}><b>{s.minutos}'</b></span>
                          <button
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                            onClick={e => { e.stopPropagation(); deleteMatchStat(s.id) }}
                            title="Eliminar estadísticas">
                            🗑️
                          </button>
                          {s.goles > 0 && <span style={{ color: '#22c55e' }}>⚽ {s.goles}</span>}
                          {s.asistencias > 0 && <span style={{ color: '#3b82f6' }}>🌟 {s.asistencias}</span>}
                          {s.amarillas > 0 && <span>🟨</span>}
                          {s.rojas > 0 && <span>🟥</span>}
                          {!s.titular && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 4, padding: '2px 6px' }}>suplente</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

                {tab === 'informes' && (
          <div style={{ padding: '0 4px' }}>
            {playerReports.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                Sin informes generados
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {playerReports.map((rp: any) => (
                  <div key={rp.id} style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
                          {rp.created_at ? format(parseISO(rp.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es }) : '-'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Generado por {rp.created_by_name || 'desconocido'}
                        </div>
                      </div>
                      {rp.pdf_url && (
                        <a href={rp.pdf_url} target="_blank" rel="noreferrer"
                          style={{ background: 'var(--gold)', color: '#0a1428', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                          ⬇ PDF
                        </a>
                      )}
                    </div>
                    {rp.comment && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        <span style={{ fontWeight: 600 }}>Obs: </span>{rp.comment}
                      </div>
                    )}
                    {rp.objectives && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span style={{ fontWeight: 600 }}>Obj: </span>{rp.objectives}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {rp.eval_ids?.length || 0} eval{rp.eval_ids?.length !== 1 ? 's' : ''} incluida{rp.eval_ids?.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reuniones' && canMeetings && (
          <div style={{ padding: '16px' }}>
            <div className="card-sm" style={{ marginBottom: 12 }}>
              <label className="label">Nueva entrada</label>
              <textarea className="input" rows={3} placeholder="Resumen de la reunion..." value={noteText} onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="btn btn-gold btn-full btn-sm" onClick={() => addMeeting('coach')} disabled={addingNote || !noteText.trim()}>+ Añadir</button>
            </div>
            <NotesList notes={meetings} sessionId={session.id} />
          </div>
        )}

        {/* PSICO */}
        {tab === 'psico' && canPsych && (
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Registro de sesiones con el psicólogo. Solo se guarda la fecha por protección de datos.
            </div>
            <button
              className="btn btn-gold btn-sm"
              style={{ marginBottom: 16 }}
              disabled={addingSession}
              onClick={addPsychSession}>
              {addingSession ? 'Registrando...' : '+ Registrar sesión hoy'}
            </button>
            {psychSessions.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin sesiones registradas</div>
              : <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  {psychSessions.map((s: any) => (
                    <div key={s.id} style={{ fontSize: 13, color: 'var(--text)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🗓️</span>
                      {new Date(s.session_date).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  ))}
                </div>
            }
          </div>
        )}


        {showPdfModal && (
          <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Exportar informe PDF</h3>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--gold)' }}>Evaluaciones a incluir</div>
              {evals.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Sin evaluaciones disponibles</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 160, overflowY: 'auto' }}>
                  {evals.map(ev => {
                    const jj = jornadas.find((x: any) => x.id === ev.jornada_id)
                    const avg = avgEval(ev)
                    const checked = pdfSelectedEvals.includes(ev.id)
                    return (
                      <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => setPdfSelectedEvals(s => checked ? s.filter(x=>x!==ev.id) : [...s, ev.id])} />
                        <div style={{ flex: 1, fontSize: 13 }}>{jj ? 'S'+jj.number : '-'} · {ev.created_at ? format(parseISO(ev.created_at), 'd MMM yyyy', { locale: es }) : ''}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: scoreColor(avg) }}>{avg}</div>
                      </label>
                    )
                  })}
                </div>
              )}
              <label className="label">Comentario del entrenador</label>
              <textarea className="input" rows={3} placeholder="Observaciones generales sobre el jugador..." value={pdfComment} onChange={e => setPdfComment(e.target.value)} style={{ marginBottom: 12 }} />
              <label className="label">Objetivos</label>
              <textarea className="input" rows={3} placeholder="Objetivos para el jugador..." value={pdfObjectives} onChange={e => setPdfObjectives(e.target.value)} style={{ marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-full" onClick={() => setShowPdfModal(false)}>Cancelar</button>
                <button className="btn btn-gold btn-full" onClick={generatePDF}>Generar PDF</button>
              </div>
            </div>
          </div>
        )}
        <BottomNav role={session.role} />
      </div>
    )
  }

  // Lista de jugadores del equipo
  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{team?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{team?.modalidad} · {players.length} jugadores</div>
        </div>
        {canEdit && <button className="btn btn-gold btn-sm" onClick={() => setShowAddPlayer(true)}>+ Jugador</button>}
      </div>

      {showAddPlayer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', width: '100%', borderRadius: '20px 20px 0 0', padding: 24, paddingBottom: 90 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Nuevo jugador</div>
            <label className="label">Nombre *</label>
            <input className="input" placeholder="Nombre completo" value={newPlayer.name} onChange={e => setNewPlayer(p => ({...p, name: e.target.value}))} style={{ marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label className="label">Dorsal</label><input className="input" type="number" placeholder="10" value={newPlayer.dorsal} onChange={e => setNewPlayer(p => ({...p, dorsal: e.target.value}))} /></div>
              <div><label className="label">Año nac.</label><input className="input" type="number" placeholder="2012" value={newPlayer.birth_year} onChange={e => setNewPlayer(p => ({...p, birth_year: e.target.value}))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="label">Posicion</label>
                <select className="input" value={newPlayer.position} onChange={e => setNewPlayer(p => ({...p, position: e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {['Portero','Defensa Central','Lateral Derecho','Lateral Izquierdo','Mediocentro Defensivo','Mediocentro','Mediocentro Ofensivo','Extremo Derecho','Extremo Izquierdo','Delantero Centro','Segunda Punta'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Pie dominante</label>
                <select className="input" value={newPlayer.foot || ''} onChange={e => setNewPlayer(p => ({...p, foot: e.target.value}))}>
                  <option value="">—</option><option>Derecho</option><option>Izquierdo</option><option>Ambidiestro</option>
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

      {/* CUERPO TECNICO */}
      {team && <CabeceraTecnicos team={team} onUpdated={() => loadTeamData(id)} />}

      {/* CALENDARIO */}
      <div style={{ marginBottom: 4 }}>
        <button onClick={() => setShowCalendar((v: boolean) => !v)}
          style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
          {/* Fila título siempre visible */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: showCalendar ? 0 : 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>📅 Calendario</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{showCalendar ? '▲ cerrar' : '▼ ver todo'}</span>
          </div>
          {/* Resumen solo cuando está cerrado */}
          {!showCalendar && teamMatches.length > 0 && (() => {
            let pg=0,pp=0,pe=0,gf=0,gc=0
            teamMatches.forEach((m: any) => {
              if (m.resultado_propio == null) return
              gf += m.resultado_propio; gc += m.resultado_rival
              if (m.resultado_propio > m.resultado_rival) pg++
              else if (m.resultado_propio < m.resultado_rival) pp++
              else pe++
            })
            const pts = pg*3+pe
            const jugados = teamMatches.filter((m: any) => m.resultado_propio != null)
            const ultimo = jugados[jugados.length - 1]
            const proximo = teamMatches.find((m: any) => m.resultado_propio == null)
            return (
              <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
                {/* Clasificación mini */}
                <div style={{ display:'flex', gap:6, alignItems:'center', background:'var(--surface2)', borderRadius:8, padding:'6px 10px', flex:1 }}>
                  {[['PJ',pg+pp+pe],['PG',pg],['PE',pe],['PP',pp]].map(([k,v]: any) => (
                    <div key={k} style={{ textAlign:'center', minWidth:24 }}>
                      <div style={{ fontWeight:800, fontSize:13, color:'var(--text)' }}>{v}</div>
                      <div style={{ fontSize:9, color:'var(--text-muted)' }}>{k}</div>
                    </div>
                  ))}
                  <div style={{ width:1, background:'var(--border)', alignSelf:'stretch', margin:'0 2px' }} />
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontWeight:900, fontSize:16, color:'var(--gold)' }}>{pts}</div>
                    <div style={{ fontSize:9, color:'var(--text-muted)' }}>PTS</div>
                  </div>
                </div>
                {/* Último resultado */}
                {ultimo && (
                  <div style={{ background:'var(--surface2)', borderRadius:8, padding:'6px 10px', minWidth:80, textAlign:'center',
                    borderLeft:'3px solid '+(ultimo.resultado_propio>ultimo.resultado_rival?'#22c55e':ultimo.resultado_propio<ultimo.resultado_rival?'#ef4444':'#f59e0b') }}>
                    <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>Último · J{ultimo.jornada}</div>
                    <div style={{ fontWeight:900, fontSize:15, color: ultimo.resultado_propio>ultimo.resultado_rival?'#22c55e':ultimo.resultado_propio<ultimo.resultado_rival?'#ef4444':'#f59e0b' }}>
                      {ultimo.resultado_propio}–{ultimo.resultado_rival}
                    </div>
                    <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:1 }}>{ultimo.local?'🏠':'✈️'} {ultimo.rival.split(' ')[0]}</div>
                  </div>
                )}
                {/* Próximo partido */}
                {proximo && (
                  <div style={{ background:'var(--surface2)', borderRadius:8, padding:'6px 10px', minWidth:80, textAlign:'center', borderLeft:'3px solid var(--border)' }}>
                    <div style={{ fontSize:9, color:'var(--text-muted)', marginBottom:2 }}>Próximo · J{proximo.jornada}</div>
                    <div style={{ fontWeight:700, fontSize:11, color:'var(--text)' }}>{proximo.local?'🏠':'✈️'} {proximo.rival.split(' ')[0]}</div>
                    {proximo.fecha && <div style={{ fontSize:9, color:'var(--gold)', marginTop:2 }}>{new Date(proximo.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                  </div>
                )}
              </div>
            )
          })()}
        </button>
        {showCalendar && (
          <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
            {(() => {
              let pg=0,pp=0,pe=0,gf=0,gc=0
              teamMatches.forEach((m: any) => {
                if (m.resultado_propio == null) return
                gf += m.resultado_propio; gc += m.resultado_rival
                if (m.resultado_propio > m.resultado_rival) pg++
                else if (m.resultado_propio < m.resultado_rival) pp++
                else pe++
              })
              const pts = pg*3+pe, pj = pg+pp+pe
              return pj > 0 ? (
                <div style={{ display:'flex', gap:8, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:'10px 14px', justifyContent:'space-around' }}>
                  {[['PJ',pj],['PG',pg],['PE',pe],['PP',pp],['GF',gf],['GC',gc],['DG',gf-gc],['PTS',pts]].map(([k,v]: any) => (
                    <div key={k} style={{ textAlign:'center' }}>
                      <div style={{ fontWeight:800, fontSize:k==='PTS'?22:17, color:k==='PTS'?'var(--gold)':'var(--text)' }}>{v}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)' }}>{k}</div>
                    </div>
                  ))}
                </div>
              ) : null
            })()}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {teamMatches.map((m: any) => {
                const jugado = m.resultado_propio != null
                const ganado = jugado && m.resultado_propio > m.resultado_rival
                const perdido = jugado && m.resultado_propio < m.resultado_rival
                return (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--surface2)', borderRadius:8, borderLeft:'3px solid '+(jugado?(ganado?'#22c55e':perdido?'#ef4444':'#f59e0b'):'var(--border)') }}>
                    <div style={{ minWidth:24, fontWeight:700, fontSize:11, color:'var(--text-muted)' }}>J{m.jornada}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{m.local?'🏠':'✈️'} {m.rival}</div>
                      {m.fecha && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{new Date(m.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                    </div>
                    {jugado ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ fontWeight:800, fontSize:16, color:ganado?'#22c55e':perdido?'#ef4444':'#f59e0b' }}>{m.resultado_propio}–{m.resultado_rival}</div>
                        <button onClick={() => { setEditingResult(m); setResultForm({propio:String(m.resultado_propio),rival:String(m.resultado_rival)}) }}
                          style={{ background:'none',border:'none',cursor:'pointer',fontSize:14,color:'var(--text-muted)',padding:2 }}>✏️</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingResult(m); setResultForm({propio:'',rival:''}) }}
                        style={{ fontSize:11, padding:'4px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-muted)', cursor:'pointer' }}>
                        + Resultado
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {editingResult && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={() => setEditingResult(null)}>
          <div className="card" style={{ width:'100%',maxWidth:320 }} onClick={(e: any) => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Resultado</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>J{editingResult.jornada} · {editingResult.rival}</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ flex:1 }}>
                <div className="label">San Cayetano</div>
                <input className="input" type="number" min="0" max="20" value={resultForm.propio} onChange={(e: any) => setResultForm((p: any) => ({...p,propio:e.target.value}))} />
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text-muted)', marginTop:16 }}>–</div>
              <div style={{ flex:1 }}>
                <div className="label">{editingResult.rival}</div>
                <input className="input" type="number" min="0" max="20" value={resultForm.rival} onChange={(e: any) => setResultForm((p: any) => ({...p,rival:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setEditingResult(null)}>Cancelar</button>
              <button className="btn btn-gold" style={{ flex:1 }} onClick={saveResult}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {/* PLANTILLA */}
      {team && <PlantillaDropdown
              players={players}
              teamId={team.id}
              teamName={team?.name || ''}
              playerStats={Object.fromEntries(players.map(p => {
                const pStats = matchStats.filter((m: any) => m.player_id === p.id)
                return [p.id, {
                  pj: pStats.length,
                  min: pStats.reduce((s: number, m: any) => s + (m.minutos_jugados || 0), 0),
                  gol: pStats.reduce((s: number, m: any) => s + (m.goles || 0), 0),
                  asi: pStats.reduce((s: number, m: any) => s + (m.asistencias || 0), 0),
                  amarillas: pStats.reduce((s: number, m: any) => s + (m.tarjetas_amarillas || 0), 0),
                  rojas: pStats.reduce((s: number, m: any) => s + (m.tarjetas_rojas || 0), 0),
                }]
              }))}
            />}

      {/* ESTADISTICAS EQUIPO */}
      {team && <EstadisticasEquipo team={team} matches={matches} />}

      {/* CONVOCATORIAS */}
      {team && <Convocatorias team={team} players={players} matches={matches} />}
      <BottomNav role={session.role} />
    </div>
  )
}

function NotesList({ notes, sessionId }: { notes: any[], sessionId: string }) {
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
      {notes.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Sin entradas todavia</div>}
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
