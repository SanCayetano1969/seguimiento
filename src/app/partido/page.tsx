'use client'
// Partido en directo — seguimiento en vivo (minutos automáticos, eventos, cambios)
import { useEffect, useState, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, getSession, canEditEval, type Player, type Team } from '@/lib/supabase'

/* ---------- Definición de métricas (columnas reales de player_match_stats) ---------- */
const STAT_DEFS: { k: string; lb: string; icon: string }[] = [
  { k: 'goles', lb: 'Goles', icon: '⚽' },
  { k: 'asistencias', lb: 'Asist.', icon: '🅰️' },
  { k: 'amarillas', lb: 'Amarillas', icon: '🟨' },
  { k: 'rojas', lb: 'Rojas', icon: '🟥' },
  { k: 'paradas', lb: 'Paradas', icon: '🧤' },
  { k: 'tiros', lb: 'Tiros', icon: '🎯' },
  { k: 'tiros_puerta', lb: 'Tiros a puerta', icon: '🥅' },
  { k: 'recuperaciones', lb: 'Recuperac.', icon: '🔵' },
  { k: 'intercepciones', lb: 'Intercep.', icon: '✋' },
  { k: 'entradas', lb: 'Entradas', icon: '🦵' },
  { k: 'pases_completos', lb: 'Pases OK', icon: '✅' },
  { k: 'pases_fallados', lb: 'Pases mal', icon: '❌' },
  { k: 'faltas_cometidas', lb: 'Faltas com.', icon: '⚠️' },
  { k: 'faltas_recibidas', lb: 'Faltas rec.', icon: '🩹' },
]
const blankStats = () => { const o: any = {}; STAT_DEFS.forEach(s => o[s.k] = 0); return o }
const isGK = (p: any) => (p?.position || '').toLowerCase().includes('portero')

type LiveP = { onField: boolean; titular: boolean; seconds: number; quarters: number[]; stats: any }
type LiveState = {
  matchId: string
  players: Record<string, LiveP>
  elapsed: number
  period: number
  periods: number
  minper: number
  scP: number
  scR: number
  events: { min: number; pid: string; txt: string }[]
}

function PartidoInner() {
  const router = useRouter()
  const params = useSearchParams()
  const teamId = params.get('team') || ''

  const [session, setSession] = useState<any>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [phase, setPhase] = useState<'match' | 'lineup' | 'live' | 'summary'>('match')

  // --- creación/selección de partido ---
  const [matchId, setMatchId] = useState<string>('')
  const [newMatch, setNewMatch] = useState({ rival: '', jornada: '', fecha: '', local: true })
  const [creating, setCreating] = useState(false)

  // --- configuración ---
  const mod11 = (team?.modalidad || '').includes('11')
  const onFieldNeed = mod11 ? 11 : 8
  const [periods, setPeriods] = useState(2)
  const [minper, setMinper] = useState(25)

  // --- alineación ---
  const [squad, setSquad] = useState<Player[]>([])          // convocados / plantel del partido
  const [luState, setLuState] = useState<Record<string, 'field' | 'bench'>>({})

  // --- estado del partido en vivo ---
  const [live, setLive] = useState<LiveState | null>(null)
  const [running, setRunning] = useState(false)
  const timerRef = useRef<any>(null)

  // --- modales ---
  const [detailId, setDetailId] = useState<string | null>(null)
  const [subOut, setSubOut] = useState<string | null>(null)   // sale del campo → elegir quien entra
  const [subIn, setSubInId] = useState<string | null>(null)   // entra del banquillo → elegir quien sale
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [resumeAvail, setResumeAvail] = useState<LiveState | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (!canEditEval(s.role)) { router.push('/dashboard'); return }
    if (!teamId) { router.push('/dashboard'); return }
    setSession(s)
    ;(async () => {
      const [{ data: t }, { data: pl }, { data: ms }] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase.from('players').select('*').eq('team_id', teamId).eq('active', true).order('dorsal'),
        supabase.from('matches').select('*').eq('team_id', teamId).order('fecha', { ascending: false }),
      ])
      setTeam(t as any)
      setAllPlayers((pl || []) as any)
      setMatches(ms || [])
      // ¿hay un partido en curso guardado?
      const mParam = params.get('match')
      if (mParam) { startFromMatch(mParam, (pl || []) as any) }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  /* ---------- Reloj ---------- */
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setLive(prev => {
          if (!prev) return prev
          const players = { ...prev.players }
          for (const id in players) {
            if (players[id].onField) {
              const q = players[id].quarters.includes(prev.period) ? players[id].quarters : [...players[id].quarters, prev.period]
              players[id] = { ...players[id], seconds: players[id].seconds + 1, quarters: q }
            }
          }
          return { ...prev, elapsed: prev.elapsed + 1, players }
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  /* ---------- Persistencia local (resume) ---------- */
  useEffect(() => {
    if (live && phase === 'live') {
      try { localStorage.setItem('sc_live_' + live.matchId, JSON.stringify(live)) } catch {}
    }
  }, [live, phase])

  /* ---------- Selección/creación de partido ---------- */
  async function loadConvocados(mid: string, plList: Player[]): Promise<Player[]> {
    // busca convocatoria asociada a ese partido (jornada_id = match.id)
    const { data: conv } = await supabase
      .from('convocatorias')
      .select('id, convocatoria_jugadores(player_id, estado)')
      .eq('team_id', teamId).eq('jornada_id', mid)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (conv && (conv as any).convocatoria_jugadores?.length) {
      const ids = new Set((conv as any).convocatoria_jugadores.filter((j: any) => j.estado === 'convocado').map((j: any) => j.player_id))
      const conv2 = plList.filter(p => ids.has(p.id))
      if (conv2.length) return conv2
    }
    return plList
  }

  function initLineup(list: Player[]) {
    // portero(s) y resto por dorsal; primeros onFieldNeed al campo
    const gks = list.filter(isGK)
    const rest = list.filter(p => !isGK(p))
    const ordered = [...gks, ...rest]
    const st: Record<string, 'field' | 'bench'> = {}
    ordered.forEach((p, i) => { st[p.id] = i < onFieldNeed ? 'field' : 'bench' })
    setLuState(st)
    setSquad(list)
  }

  async function pickMatch(mid: string) {
    setMatchId(mid)
    // ¿hay estado guardado a medias?
    let saved: LiveState | null = null
    try { const raw = localStorage.getItem('sc_live_' + mid); if (raw) saved = JSON.parse(raw) } catch {}
    if (saved) { setResumeAvail(saved); return }
    const conv = await loadConvocados(mid, allPlayers)
    initLineup(conv)
    setPhase('lineup')
  }

  async function startFromMatch(mid: string, plList: Player[]) {
    setMatchId(mid)
    let saved: LiveState | null = null
    try { const raw = localStorage.getItem('sc_live_' + mid); if (raw) saved = JSON.parse(raw) } catch {}
    if (saved) { setResumeAvail(saved); return }
    const conv = await loadConvocados(mid, plList)
    initLineup(conv)
    setPhase('lineup')
  }

  async function createMatch() {
    if (!newMatch.rival.trim()) { showToast('Pon el rival'); return }
    setCreating(true)
    const { data, error } = await supabase.from('matches').insert({
      team_id: teamId,
      rival: newMatch.rival.trim(),
      jornada: newMatch.jornada ? parseInt(newMatch.jornada) : null,
      fecha: newMatch.fecha || null,
      local: newMatch.local,
    }).select().single()
    setCreating(false)
    if (error || !data) { showToast('No se pudo crear el partido'); return }
    setMatches(m => [data, ...m])
    await pickMatch(data.id)
  }

  function resumeMatch() {
    if (!resumeAvail) return
    // reconstruir el plantel (squad) a partir de los jugadores guardados
    const ids = new Set(Object.keys(resumeAvail.players))
    const sq = allPlayers.filter(p => ids.has(p.id))
    const gks = sq.filter(isGK); const rest = sq.filter(p => !isGK(p))
    setSquad([...gks, ...rest])
    setLive(resumeAvail)
    setPeriods(resumeAvail.periods)
    setMinper(resumeAvail.minper)
    setResumeAvail(null)
    setPhase('live')
  }
  function discardResume() {
    if (resumeAvail) { try { localStorage.removeItem('sc_live_' + resumeAvail.matchId) } catch {} }
    const r = resumeAvail
    setResumeAvail(null)
    if (r) { loadConvocados(r.matchId, allPlayers).then(conv => { initLineup(conv); setPhase('lineup') }) }
  }

  /* ---------- Alineación ---------- */
  const fieldCount = Object.values(luState).filter(v => v === 'field').length
  function toggleLu(id: string) {
    setLuState(st => {
      if (st[id] === 'field') return { ...st, [id]: 'bench' }
      if (Object.values(st).filter(v => v === 'field').length >= onFieldNeed) { showToast('Ya tienes ' + onFieldNeed + ' en el campo'); return st }
      return { ...st, [id]: 'field' }
    })
  }

  function beginMatch() {
    if (fieldCount !== onFieldNeed) { showToast('Pon exactamente ' + onFieldNeed + ' jugadores en el campo'); return }
    const players: Record<string, LiveP> = {}
    squad.forEach(p => {
      const onField = luState[p.id] === 'field'
      players[p.id] = { onField, titular: onField, seconds: 0, quarters: [], stats: blankStats() }
    })
    setLive({ matchId, players, elapsed: 0, period: 1, periods, minper, scP: 0, scR: 0, events: [] })
    setPhase('live')
  }

  /* ---------- Acciones en vivo ---------- */
  const pById = useCallback((id: string) => squad.find(p => p.id === id) || allPlayers.find(p => p.id === id), [squad, allPlayers])

  function bump(pid: string, k: string, d: number) {
    setLive(prev => {
      if (!prev) return prev
      const lp = prev.players[pid]; if (!lp) return prev
      const nv = Math.max(0, (lp.stats[k] || 0) + d)
      const changed = nv - (lp.stats[k] || 0)
      const players = { ...prev.players, [pid]: { ...lp, stats: { ...lp.stats, [k]: nv } } }
      let events = prev.events
      let scP = prev.scP
      if (changed > 0) {
        const def = STAT_DEFS.find(s => s.k === k)!
        const nm = pById(pid)?.name || ''
        events = [{ min: Math.floor(prev.elapsed / 60), pid, txt: `${def.icon} ${def.lb.replace('.', '')} · ${nm}` }, ...prev.events]
        if (k === 'goles') scP = prev.scP + 1
      }
      return { ...prev, players, events, scP }
    })
  }
  function score(side: 'propio' | 'rival', d: number) {
    setLive(prev => prev ? (side === 'propio' ? { ...prev, scP: Math.max(0, prev.scP + d) } : { ...prev, scR: Math.max(0, prev.scR + d) }) : prev)
  }
  function toggleClock() { setRunning(r => !r) }
  function nextPeriod() {
    setLive(prev => {
      if (!prev) return prev
      if (prev.period >= prev.periods) { showToast('Último periodo'); return prev }
      return { ...prev, period: prev.period + 1 }
    })
    setRunning(false)
    showToast('Fin de periodo · descanso')
  }
  function doSub(outId: string, inId: string) {
    setLive(prev => {
      if (!prev) return prev
      const players = { ...prev.players }
      players[outId] = { ...players[outId], onField: false }
      players[inId] = { ...players[inId], onField: true }
      const nmIn = pById(inId)?.name || '', nmOut = pById(outId)?.name || ''
      const events = [{ min: Math.floor(prev.elapsed / 60), pid: inId, txt: `🔄 Cambio · ${nmIn} por ${nmOut}` }, ...prev.events]
      return { ...prev, players, events }
    })
    setSubOut(null); setSubInId(null)
  }
  function undoEvent(idx: number) {
    setLive(prev => prev ? { ...prev, events: prev.events.filter((_, i) => i !== idx) } : prev)
  }

  /* ---------- Guardar ---------- */
  async function saveMatch() {
    if (!live || !session) return
    setSaving(true)
    await supabase.from('matches').update({ resultado_propio: live.scP, resultado_rival: live.scR }).eq('id', live.matchId)
    const { data: existing } = await supabase.from('player_match_stats').select('id, player_id').eq('match_id', live.matchId)
    const exMap: Record<string, string> = {}; (existing || []).forEach((r: any) => exMap[r.player_id] = r.id)
    for (const pid in live.players) {
      const lp = live.players[pid]
      const p = pById(pid)
      const payload: any = {
        match_id: live.matchId, player_id: pid, team_id: teamId, created_by: session.id,
        titular: lp.titular, minutos: Math.floor(lp.seconds / 60),
        cuartos_jugados: lp.quarters,
      }
      STAT_DEFS.forEach(s => payload[s.k] = lp.stats[s.k] || 0)
      if (exMap[pid]) await supabase.from('player_match_stats').update(payload).eq('id', exMap[pid])
      else await supabase.from('player_match_stats').insert(payload)
    }
    try { localStorage.removeItem('sc_live_' + live.matchId) } catch {}
    setSaving(false)
    showToast('✅ Partido guardado')
    setTimeout(() => router.push('/equipo?team=' + teamId), 900)
  }

  /* ================= RENDER ================= */
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando…</div>

  const mm = (s: number) => String(Math.floor(s / 60)).padStart(2, '0')
  const ss = (s: number) => String(s % 60).padStart(2, '0')
  const minLbl = (sec: number) => Math.floor(sec / 60) + "'"
  const periodName = (per: number, tot: number) => {
    const names = tot === 2 ? ['1ª parte', '2ª parte'] : ['1er cuarto', '2º cuarto', '3er cuarto', '4º cuarto']
    return names[Math.min(per - 1, names.length - 1)]
  }

  /* ---- RESUME banner ---- */
  if (resumeAvail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⏱</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Partido en curso</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18 }}>
            Hay un partido a medias guardado en este dispositivo ({mm(resumeAvail.elapsed)}:{ss(resumeAvail.elapsed)}, {resumeAvail.scP}-{resumeAvail.scR}). ¿Continuar donde lo dejaste?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={discardResume}>Empezar de nuevo</button>
            <button className="btn btn-gold" style={{ flex: 1 }} onClick={resumeMatch}>Continuar</button>
          </div>
        </div>
      </div>
    )
  }

  /* ---- FASE 1: elegir/crear partido ---- */
  if (phase === 'match') {
    const upcoming = matches.filter(m => m.resultado_propio == null)
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
        <TopBar team={team} onExit={() => router.push('/equipo?team=' + teamId)} />
        <h2 style={{ fontSize: 20, margin: '4px 0 2px' }}>Partido en directo</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 18px' }}>Elige un partido pendiente o crea uno nuevo.</p>

        {upcoming.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>Partidos pendientes</div>
            {upcoming.map(m => (
              <div key={m.id} onClick={() => pickMatch(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 10, background: 'var(--surface2)', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700 }}>{m.local ? 'vs' : '@'} {m.rival || '—'}</div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{m.jornada ? 'J' + m.jornada : ''} {m.fecha || ''}</div>
                <span style={{ color: 'var(--gold)' }}>▶</span>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>Nuevo partido</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <input className="input" placeholder="Rival" value={newMatch.rival} onChange={e => setNewMatch(v => ({ ...v, rival: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
            <input className="input" type="number" placeholder="Jornada" value={newMatch.jornada} onChange={e => setNewMatch(v => ({ ...v, jornada: e.target.value }))} style={{ width: 110 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <input className="input" type="date" value={newMatch.fecha} onChange={e => setNewMatch(v => ({ ...v, fecha: e.target.value }))} style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={'btn btn-sm ' + (newMatch.local ? 'btn-gold' : 'btn-ghost')} onClick={() => setNewMatch(v => ({ ...v, local: true }))}>Local</button>
              <button className={'btn btn-sm ' + (!newMatch.local ? 'btn-gold' : 'btn-ghost')} onClick={() => setNewMatch(v => ({ ...v, local: false }))}>Visitante</button>
            </div>
          </div>
          <button className="btn btn-gold" style={{ width: '100%' }} onClick={createMatch} disabled={creating}>{creating ? 'Creando…' : 'Crear y continuar'}</button>
        </div>
      </div>
    )
  }

  /* ---- FASE 2: formato + alineación ---- */
  if (phase === 'lineup') {
    const m = matches.find(x => x.id === matchId)
    const fieldPlayers = squad.filter(p => luState[p.id] === 'field')
    const benchPlayers = squad.filter(p => luState[p.id] === 'bench')
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 20 }}>
        <TopBar team={team} onExit={() => setPhase('match')} exitLabel="◀ Partido" />
        <h2 style={{ fontSize: 20, margin: '4px 0 2px' }}>{m ? (m.local ? 'vs ' : '@ ') + (m.rival || '') : 'Alineación'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>{team?.modalidad} · {onFieldNeed} en el campo</p>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 12 }}>Formato</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Periodos</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={'btn btn-sm ' + (periods === 2 ? 'btn-gold' : 'btn-ghost')} onClick={() => setPeriods(2)}>2 partes</button>
                <button className={'btn btn-sm ' + (periods === 4 ? 'btn-gold' : 'btn-ghost')} onClick={() => setPeriods(4)}>4 cuartos</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Minutos por periodo</div>
              <input className="input" type="number" value={minper} onChange={e => setMinper(parseInt(e.target.value) || 0)} style={{ width: 90 }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)', marginBottom: 4 }}>Alineación</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Toca para mover entre campo y banquillo.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>En el campo ({fieldCount}/{onFieldNeed})</div>
              {fieldPlayers.map(p => <LuItem key={p.id} p={p} side="field" onClick={() => toggleLu(p.id)} />)}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Banquillo</div>
              {benchPlayers.map(p => <LuItem key={p.id} p={p} side="bench" onClick={() => toggleLu(p.id)} />)}
              {!benchPlayers.length && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>—</div>}
            </div>
          </div>
        </div>

        <button className="btn btn-gold" style={{ width: '100%', height: 54, fontSize: 17, marginTop: 14 }} onClick={beginMatch}>▶ Comenzar partido</button>
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  /* ---- FASE 3: EN DIRECTO ---- */
  if (phase === 'live' && live) {
    const m = matches.find(x => x.id === matchId)
    const fieldPlayers = squad.filter(p => live.players[p.id]?.onField)
    const benchPlayers = squad.filter(p => live.players[p.id] && !live.players[p.id].onField)
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800 }}>{team?.name}<div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{m ? (m.local ? 'vs ' : '@ ') + (m.rival || '') : ''}</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 'auto' }}>
            {/* marcador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '6px 12px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>SC</span>
              <Stepper2 onPlus={() => score('propio', 1)} onMinus={() => score('propio', -1)} />
              <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--gold)' }}>{live.scP}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>-</span>
              <span style={{ fontSize: 26, fontWeight: 900 }}>{live.scR}</span>
              <Stepper2 onPlus={() => score('rival', 1)} onMinus={() => score('rival', -1)} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m?.rival || 'Rival'}</span>
            </div>
            {/* reloj */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '6px 14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 28, fontWeight: 900, letterSpacing: 1 }}>{mm(live.elapsed)}:{ss(live.elapsed)}</div>
                <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{periodName(live.period, live.periods)}</div>
              </div>
              <button className="btn" style={{ width: 46, height: 46, fontSize: 20, background: running ? 'var(--orange)' : 'var(--green)', color: '#fff' }} onClick={toggleClock}>{running ? '⏸' : '▶'}</button>
              <button className="btn btn-ghost" style={{ width: 46, height: 46, fontSize: 18 }} onClick={nextPeriod} title="Fin de periodo">⏭</button>
            </div>
            <button className="btn btn-gold" style={{ height: 46, padding: '0 16px', fontWeight: 800 }} onClick={() => { setRunning(false); setPhase('summary') }}>Finalizar</button>
          </div>
        </div>

        {/* cuerpo */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', margin: '4px 2px 10px' }}>En el campo</div>
            {fieldPlayers.map(p => (
              <PlayerRow key={p.id} p={p} lp={live.players[p.id]} minLbl={minLbl}
                onQuick={(k) => bump(p.id, k, 1)} onGoal={() => { bump(p.id, 'goles', 1) }}
                onDetail={() => setDetailId(p.id)} onSub={() => setSubOut(p.id)} />
            ))}
          </div>
          <div style={{ width: 300, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', margin: '4px 2px 10px' }}>Banquillo</div>
            {benchPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 11, marginBottom: 6, background: 'var(--surface2)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 13 }}>{p.dorsal ?? '·'}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}{isGK(p) ? ' 🧤' : ''}{live.players[p.id].seconds ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {minLbl(live.players[p.id].seconds)}</span> : ''}</div>
                <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'var(--green)', color: '#fff', fontWeight: 700 }} onClick={() => setSubInId(p.id)}>Entrar ▶</button>
              </div>
            ))}
            {!benchPlayers.length && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>Sin suplentes</div>}

            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', margin: '18px 2px 10px' }}>Sucesos</div>
            {!live.events.length && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>Aún sin sucesos</div>}
            {live.events.slice(0, 40).map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '6px 8px', borderRadius: 9, background: 'var(--surface2)', marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gold)', fontWeight: 800, minWidth: 30 }}>{e.min}'</span>
                <span>{e.txt}</span>
                <button onClick={() => undoEvent(i)} style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13, padding: '2px 6px', borderRadius: 6, background: 'var(--surface3)', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* modal detalle */}
        {detailId && live.players[detailId] && (
          <Overlay onClose={() => setDetailId(null)}>
            <DetailModal p={pById(detailId)} lp={live.players[detailId]} minLbl={minLbl}
              onBump={(k, d) => bump(detailId, k, d)} onGoalPlus={() => {}} onClose={() => setDetailId(null)}
              onSub={() => { setDetailId(null); setSubOut(detailId) }} />
          </Overlay>
        )}
        {/* modal cambio: sale del campo */}
        {subOut && (
          <Overlay onClose={() => setSubOut(null)}>
            <SubModal title={`Cambio · sale ${pById(subOut)?.name || ''}`} subtitle="Entra…"
              list={benchPlayers} labelBtn="Entrar" onPick={(inId) => doSub(subOut, inId)} onClose={() => setSubOut(null)} />
          </Overlay>
        )}
        {/* modal cambio: entra del banquillo */}
        {subIn && (
          <Overlay onClose={() => setSubInId(null)}>
            <SubModal title={`Entra ${pById(subIn)?.name || ''} · ¿por quién?`} subtitle="Sale…"
              list={fieldPlayers} labelBtn="Sale" danger minutesOf={(id) => minLbl(live.players[id].seconds)}
              onPick={(outId) => doSub(outId, subIn)} onClose={() => setSubInId(null)} />
          </Overlay>
        )}
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  /* ---- FASE 4: RESUMEN ---- */
  if (phase === 'summary' && live) {
    const m = matches.find(x => x.id === matchId)
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
        <h2 style={{ fontSize: 20, margin: '4px 0 2px' }}>Resumen del partido</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
          {team?.name} {live.scP} - {live.scR} {m?.rival || ''} · {m?.jornada ? 'Jornada ' + m.jornada : ''}
        </p>
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              {['#', 'Jugador', 'Min', ...STAT_DEFS.map(s => s.icon)].map((c, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 11 }}>{c}</th>
              ))}
            </tr></thead>
            <tbody>
              {squad.map(p => {
                const lp = live.players[p.id]; if (!lp) return null
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--gold)', fontWeight: 800 }}>{p.dorsal ?? '·'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.name}{isGK(p) ? ' 🧤' : ''}</td>
                    <td style={{ padding: '8px 10px' }}>{Math.floor(lp.seconds / 60)}'</td>
                    {STAT_DEFS.map(s => { const v = lp.stats[s.k]; return <td key={s.k} style={{ padding: '8px 10px', color: v ? 'var(--text)' : 'var(--text-muted)', fontWeight: v ? 700 : 400 }}>{v || '·'}</td> })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1, height: 52 }} onClick={() => setPhase('live')}>◀ Volver</button>
          <button className="btn btn-gold" style={{ flex: 1, height: 52, fontWeight: 800 }} onClick={saveMatch} disabled={saving}>{saving ? 'Guardando…' : '💾 Guardar partido'}</button>
        </div>
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  return null
}

/* ================= Subcomponentes ================= */
function TopBar({ team, onExit, exitLabel = '◀ Salir' }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <button className="btn btn-ghost btn-sm" onClick={onExit}>{exitLabel}</button>
      <div style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--text-muted)', fontSize: 13 }}>{team?.name}</div>
    </div>
  )
}
function LuItem({ p, side, onClick }: any) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 9px', marginBottom: 6, cursor: 'pointer' }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 12 }}>{p.dorsal ?? '·'}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}{isGK(p) ? ' 🧤' : ''}</div>
      <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 16 }}>{side === 'field' ? '→' : '←'}</div>
    </div>
  )
}
function Stepper2({ onPlus, onMinus }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <button onClick={onPlus} style={{ width: 26, height: 20, borderRadius: 6, background: 'var(--surface3)', color: 'var(--text)', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', lineHeight: 1 }}>+</button>
      <button onClick={onMinus} style={{ width: 26, height: 20, borderRadius: 6, background: 'var(--surface3)', color: 'var(--text)', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', lineHeight: 1 }}>−</button>
    </div>
  )
}
function PlayerRow({ p, lp, minLbl, onQuick, onGoal, onDetail, onSub }: any) {
  const gk = isGK(p)
  const quick = gk
    ? [{ k: 'paradas', ic: '🧤', lb: 'PARADA' }, { k: 'goles', ic: '⚽', lb: 'GOL', goal: true }, { k: 'amarillas', ic: '🟨', lb: 'TARJ.' }]
    : [{ k: 'goles', ic: '⚽', lb: 'GOL', goal: true }, { k: 'asistencias', ic: '🅰️', lb: 'ASIST' }, { k: 'amarillas', ic: '🟨', lb: 'TARJ.' }]
  const qbtn = { height: 42, minWidth: 46, padding: '0 8px', borderRadius: 11, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 17, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 1, position: 'relative' as const, color: 'var(--text)', cursor: 'pointer' }
  const lbl = { fontSize: 8, color: 'var(--text-muted)', fontWeight: 700 as const, letterSpacing: '.3px' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: gk ? 'linear-gradient(90deg,rgba(91,184,232,.09),var(--surface))' : 'var(--surface)', border: '1px solid ' + (gk ? 'rgba(91,184,232,.45)' : 'var(--border)'), borderRadius: 14, padding: '8px 10px', marginBottom: 9 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 16, flexShrink: 0 }}>{p.dorsal ?? '·'}</div>
      <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={onDetail}>
        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{gk ? ' 🧤' : ''}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text)', fontWeight: 600 }}>{minLbl(lp.seconds)}</span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'var(--surface3)' }}>{p.position || '—'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {quick.map(q => (
          <button key={q.k} style={qbtn} onClick={() => { onQuick(q.k); if (q.goal) onGoal() }}>
            <span>{q.ic}</span><span style={lbl}>{q.lb}</span>
            {lp.stats[q.k] ? <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--gold)', color: 'var(--navy-dark, #0d1f3c)', fontSize: 10, fontWeight: 900, borderRadius: '50%', minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{lp.stats[q.k]}</span> : null}
          </button>
        ))}
        <button style={qbtn} onClick={onSub}><span>🔄</span><span style={lbl}>CAMBIO</span></button>
        <button style={{ ...qbtn, background: 'var(--surface3)' }} onClick={onDetail}><span>⋯</span><span style={lbl}>DETALLE</span></button>
      </div>
    </div>
  )
}
function Overlay({ children, onClose }: any) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(4,9,15,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>{children}</div>
    </div>
  )
}
function DetailModal({ p, lp, minLbl, onBump, onClose, onSub }: any) {
  if (!p) return null
  const gk = isGK(p)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 19 }}>{p.dorsal ?? '·'}</div>
        <div><h2 style={{ margin: 0, fontSize: 20 }}>{p.name}{gk ? ' 🧤' : ''}</h2><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.position || '—'} · {minLbl(lp.seconds)} jugados</div></div>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', width: 40, height: 40, fontSize: 20 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {STAT_DEFS.filter(s => s.k !== 'paradas' || gk).map(s => (
          <div key={s.k} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8, minHeight: 26, display: 'flex', alignItems: 'center', gap: 6 }}>{s.icon} {s.lb}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost" style={{ width: 44, height: 44, fontSize: 22, fontWeight: 800 }} onClick={() => onBump(s.k, -1)}>−</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{lp.stats[s.k]}</div>
              <button className="btn btn-gold" style={{ width: 44, height: 44, fontSize: 22, fontWeight: 800 }} onClick={() => onBump(s.k, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <button className="btn" style={{ flex: 1, background: 'var(--navy-light, #2a5298)', color: '#fff', fontWeight: 800, height: 52 }} onClick={onSub}>🔄 Hacer cambio</button>
        <button className="btn btn-gold" style={{ flex: 1, fontWeight: 800, height: 52 }} onClick={onClose}>Hecho</button>
      </div>
    </>
  )
}
function SubModal({ title, subtitle, list, labelBtn, danger, minutesOf, onPick, onClose }: any) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', width: 40, height: 40, fontSize: 20 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>{subtitle}</div>
      {!list.length && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay jugadores disponibles</div>}
      {list.map((p: any) => (
        <div key={p.id} onClick={() => onPick(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 11, marginBottom: 6, background: 'var(--surface2)', cursor: 'pointer' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 13 }}>{p.dorsal ?? '·'}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}{isGK(p) ? ' 🧤' : ''}{minutesOf ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {minutesOf(p.id)}</span> : ''}</div>
          <div className="btn btn-sm" style={{ marginLeft: 'auto', pointerEvents: 'none', background: danger ? 'var(--red)' : 'var(--green)', color: '#fff', fontWeight: 800 }}>{labelBtn}</div>
        </div>
      ))}
    </>
  )
}
function Toast({ msg }: { msg: string }) {
  return <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface3)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: 12, fontSize: 14, zIndex: 300, boxShadow: '0 8px 30px rgba(0,0,0,.5)' }}>{msg}</div>
}

export default function PartidoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando…</div>}>
      <PartidoInner />
    </Suspense>
  )
}
