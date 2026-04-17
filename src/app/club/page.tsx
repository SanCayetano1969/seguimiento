'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, clearSession, scoreColor, type Announcement } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { format, parseISO, startOfWeek, addDays, addWeeks, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

type TeamOverview = {
  team_id: string; team_name: string; category: string; modalidad: string
  total_players: number; total_evaluations: number
  avg_fisica: number; avg_tecnica: number; avg_tactica: number; avg_psico: number; avg_global: number
}

function teamColor(name: string) {
  const n = (name||'').toLowerCase()
  if (n.includes('infantil a')) return '#3b82f6'
  if (n.includes('infantil b')) return '#22c55e'
  if (n.includes('infantil c')) return '#a855f7'
  if (n.includes('cadete a'))   return '#f97316'
  if (n.includes('cadete b'))   return '#ec4899'
  if (n.includes('juvenil'))    return '#eab308'
  if (n.includes('lev'))        return '#06b6d4'
  if (n.includes('amateur'))    return '#ef4444'
  return '#5bb8e8'
}

export default function ClubPage() {
  const router = useRouter()
  const session = getSession()

  const [teams, setTeams]       = useState<TeamOverview[]>([])
  const [events, setEvents]     = useState<any[]>([])
  const [announcements, setAnn] = useState<Announcement[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [unread, setUnread]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [pendingAlarmas, setPendingAlarmas] = useState<{team_id:string, team_name:string, faltaConvoc:boolean, faltaStats:boolean}[]>([])
  const [tab, setTab]           = useState<'overview'|'agenda'|'anuncios'|'informes'>('overview')
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportMsg, setReportMsg] = useState('')
  const [lastAnn, setLastAnn] = useState<any>(null)
  const [weekMatches, setWeekMatches] = useState<any[]>([])
  const [matchMode, setMatchMode] = useState<'results'|'upcoming'>('upcoming')
  const [reportVersion, setReportVersion] = useState(0)
  const [annForm, setAnnForm]   = useState({ title: '', content: '', pinned: false })

  useEffect(() => {
    if (!session) { router.push('/'); return }
    if (!['admin', 'coordinator'].includes(session.role)) { router.push('/dashboard'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const today = new Date()
    const end = addWeeks(today, 5)

    const [
      { data: tData },
      { data: evData },
      { data: annData },
      { data: reqData },
      { count: unreadCount },
    ] = await Promise.all([
      supabase.from('club_overview').select('*').order('team_name', { ascending: true }),
      supabase.from('events').select('*, teams(name,category)')
        .gte('date', format(today, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .order('date').order('time'),
      supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('event_requests_view').select('*')
        .eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('to_user_id', session!.id).eq('read', false),
    ])


    const ORDER = ["Alevin","Alevin","Infantil","Cadete","Juvenil","Amateur"]
    const sorted = (tData || []).sort((a,b) => {
      const cats = ["Alevin","Infantil","Cadete","Juvenil","Amateur"]
      return cats.indexOf(a.category) - cats.indexOf(b.category) || a.team_name.localeCompare(b.team_name)
    })
    // ── Alarmas pendientes (a partir del miércoles) ──────────────
    const hoy = new Date()
    const diaSemana = hoy.getDay() // 0=dom,1=lun,...,6=sab
    if (diaSemana >= 3) { // miércoles o posterior
      // Calcular sábado y domingo del fin de semana pasado
      const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1
      const lunesPasado = new Date(hoy); lunesPasado.setDate(hoy.getDate() - diasHastaLunes - 7)
      const sabPasado = new Date(lunesPasado); sabPasado.setDate(lunesPasado.getDate() + 5)
      const domPasado = new Date(lunesPasado); domPasado.setDate(lunesPasado.getDate() + 6)
      const sabStr = sabPasado.toISOString().split('T')[0]
      const domStr = domPasado.toISOString().split('T')[0]

      // Partidos del fin de semana pasado
      const { data: matchesFds } = await supabase
        .from('matches')
        .select('id, team_id, fecha')
        .gte('fecha', sabStr)
        .lte('fecha', domStr)

      if (matchesFds?.length) {
        const matchIds = matchesFds.map((m: any) => m.id)
        const teamIds = [...new Set(matchesFds.map((m: any) => m.team_id))]

        // Convocatorias registradas para esos partidos
        const { data: convocsRegistradas } = await supabase
          .from('convocatorias')
          .select('team_id, jornada_id')
          .in('team_id', teamIds)
          .gte('fecha', sabStr)
          .lte('fecha', domStr)

        // Estadísticas de equipo registradas para esos partidos
        const { data: statsRegistradas } = await supabase
          .from('match_stats_team')
          .select('match_id, team_id')
          .in('match_id', matchIds)

        const convocTeams = new Set((convocsRegistradas || []).map((c: any) => c.team_id))
        const statsMatchIds = new Set((statsRegistradas || []).map((s: any) => s.match_id))

        const alarmas: {team_id:string, team_name:string, faltaConvoc:boolean, faltaStats:boolean}[] = []
        for (const match of matchesFds) {
          const teamInfo = (tData || []).find((t: any) => t.team_id === match.team_id)
          if (!teamInfo) continue
          const faltaConvoc = !convocTeams.has(match.team_id)
          const faltaStats = !statsMatchIds.has(match.id)
          if (faltaConvoc || faltaStats) {
            alarmas.push({ team_id: match.team_id, team_name: teamInfo.team_name, faltaConvoc, faltaStats })
          }
        }
        setPendingAlarmas(alarmas)
      } else {
        setPendingAlarmas([])
      }
    } else {
      setPendingAlarmas([])
    }

    setTeams(sorted)
    setEvents(evData || [])
    setAnn(annData || [])
    setRequests(reqData || [])
    setUnread(unreadCount || 0)

    // Último anuncio para portada
    const { data: topAnn } = await supabase.from('announcements')
      .select('id, title, content, created_at')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }).limit(1)
    if (topAnn?.[0]) setLastAnn(topAnn[0])

    // Partidos fin de semana
    const hoy = new Date()
    const dow = hoy.getDay()
    const wMode = (dow >= 1 && dow <= 3) ? 'results' : 'upcoming'
    setMatchMode(wMode)
    const d2l = dow === 0 ? 6 : dow - 1
    let sabW: Date, domW: Date
    if (wMode === 'results') {
      const lp = new Date(hoy); lp.setDate(hoy.getDate() - d2l - 7)
      sabW = new Date(lp); sabW.setDate(lp.getDate() + 5)
      domW = new Date(lp); domW.setDate(lp.getDate() + 6)
    } else {
      const le = new Date(hoy); le.setDate(hoy.getDate() - d2l)
      sabW = new Date(le); sabW.setDate(le.getDate() + 5)
      domW = new Date(le); domW.setDate(le.getDate() + 6)
    }
    const { data: wMatches } = await supabase.from('matches')
      .select('id, team_id, jornada, fecha, rival, local, resultado_propio, resultado_rival, teams(name)')
      .gte('fecha', sabW.toISOString().split('T')[0])
      .lte('fecha', domW.toISOString().split('T')[0])
      .order('fecha')
    if (wMatches?.length) {
      if (wMode === 'upcoming' && wMatches.length > 0) {
        const mIds = wMatches.map((m: any) => m.id)
        const { data: convocs } = await supabase.from('convocatorias')
          .select('match_id, hora').in('match_id', mIds)
        const cMap: Record<string, any> = {}
        ;(convocs || []).forEach((c: any) => { cMap[c.match_id] = c })
        setWeekMatches(wMatches.map((m: any) => ({ ...m, convoc: cMap[m.id] || null })))
      } else {
        setWeekMatches(wMatches)
      }
    }

    setLoading(false)
  }

  async function postAnnouncement() {
    if (!annForm.title.trim() || !annForm.content.trim()) return
    await supabase.from('announcements').insert({
      title: annForm.title, content: annForm.content,
      pinned: annForm.pinned, author_id: session!.id, author_name: session!.name
    })
    // Notificar a todos los usuarios
    fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '📢 Tablón: ' + annForm.title,
        body: annForm.content.substring(0, 80),
        url: '/club',
        excludeUserId: session!.id
      })
    }).catch(() => {})
    setShowAnnModal(false)
    setAnnForm({ title: '', content: '', pinned: false })
    loadData()
  }

  async function resolveRequest(reqId: string, response: string) {
    await supabase.from('event_requests').update({
      status: 'resolved', response, resolved_by: session!.id, resolved_at: new Date().toISOString()
    }).eq('id', reqId)
    loadData()
  }

  if (!session) return null

  const avgGlobal = teams.length > 0
    ? (teams.reduce((s, t) => s + (t.avg_global || 0), 0) / teams.length).toFixed(1)
    : '—'

  const radarData = [
    { area: 'Física',    value: +(teams.reduce((s,t) => s+(t.avg_fisica||0), 0)/Math.max(teams.length,1)).toFixed(1) },
    { area: 'Técnica',   value: +(teams.reduce((s,t) => s+(t.avg_tecnica||0), 0)/Math.max(teams.length,1)).toFixed(1) },
    { area: 'Táctica',   value: +(teams.reduce((s,t) => s+(t.avg_tactica||0), 0)/Math.max(teams.length,1)).toFixed(1) },
    { area: 'Psicológ.', value: +(teams.reduce((s,t) => s+(t.avg_psico||0), 0)/Math.max(teams.length,1)).toFixed(1) },
  ]

  async function generateReport() {
    setGeneratingReport(true)
    setReportMsg('')
    const now = new Date()
    const mes = now.getMonth() + 1
    const anno = now.getFullYear()
    try {
      const res = await fetch('/api/cron/informe-mensual?manual=1&mes=' + mes + '&anno=' + anno)
      const data = await res.json()
      if (data.ok) {
        setReportMsg('Informe de ' + ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes-1] + ' generado correctamente')
        // Forzar recarga del useEffect
        setReportVersion(v => v + 1)
      } else {
        setReportMsg('Error generando el informe')
      }
    } catch(e) {
      setReportMsg('Error de conexión')
    }
    setGeneratingReport(false)
  }

  useEffect(() => {
    if (tab !== 'informes') return
    setLoadingReports(true)
    supabase.from('monthly_reports').select('id,mes,anyo,team_id,created_at,contenido')
      .order('anyo', { ascending: false })
      .order('mes', { ascending: false })
      .then(({ data }) => { setReports(data || []); setLoadingReports(false) })
  }, [tab, reportVersion])

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/escudo.jpeg" alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }} className="font-display">CD SAN CAYETANO</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Panel de coordinación</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {requests.length > 0 && (
            <span className="badge" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
              {requests.length} solicitud{requests.length > 1 ? 'es' : ''}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { clearSession(); localStorage.removeItem('sc_access_code'); router.push('/') }}>Salir</button>
          {session?.role === 'admin' && (
            <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }} onClick={() => router.push('/admin/usuarios')}>
              ⚙️ Usuarios
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '12px 16px 0', gap: 8 }}>
        {(['overview','agenda','anuncios','informes'] as const).map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Resumen' : t === 'agenda' ? '📅 Agenda' : t === 'anuncios' ? '📢 Tablón' : '📋 Informes'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <>
          {/* ─── OVERVIEW ─── */}
          {tab === 'overview' && (
            <>
              {/* Anuncio + Fin de semana */}
              {(lastAnn || weekMatches.length > 0) && (
                <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'12px 16px 0' }}>
                  {lastAnn && (
                    <div style={{ background:'var(--surface)', borderRadius:12, padding:'12px 14px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--gold)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>📢 Tablón</div>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:2 }}>{lastAnn.title}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{lastAnn.content}</div>
                    </div>
                  )}
                  {weekMatches.length > 0 && (
                    <div style={{ background:'var(--surface)', borderRadius:12, padding:'12px 14px', border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                        {matchMode === 'results' ? '⚽ Resultados del fin de semana' : '📅 Partidos este fin de semana'}
                      </div>
                      {weekMatches.map((m: any) => (
                        <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:6, marginBottom:6, borderBottom:'1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{(m.teams as any)?.name || '—'}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                              {m.local ? 'vs ' + m.rival : m.rival + ' (fuera)'}
                              {matchMode === 'upcoming' && m.convoc?.hora ? ' · ' + m.convoc.hora : ''}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            {matchMode === 'results'
                              ? (m.resultado_propio !== null
                                  ? <span style={{ fontWeight:800, fontSize:14, color: m.resultado_propio > m.resultado_rival ? 'var(--green)' : m.resultado_propio < m.resultado_rival ? 'var(--red)' : 'var(--text-muted)' }}>{m.resultado_propio}–{m.resultado_rival}</span>
                                  : <span style={{ fontSize:11, color:'var(--text-muted)' }}>Sin resultado</span>)
                              : <span style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(m.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}</span>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 16px 0' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{teams.length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Equipos</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(+avgGlobal) }}>{avgGlobal}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Media global</div>
                </div>
              </div>

              {/* Radar club */}
              {radarData.some(d => d.value > 0) && (
                <div className="card" style={{ margin: '12px 16px' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Perfil global del club</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="area" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tabla equipos */}
              <div className="section-title">Equipos</div>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* ── Alarmas pendientes fin de semana ── */}
                {pendingAlarmas.length > 0 && (
                  <div style={{ marginBottom: 16, background: 'rgba(255,160,0,0.08)', border: '1px solid var(--orange)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--orange)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚠️ Pendiente del fin de semana anterior
                    </div>
                    {pendingAlarmas.map(a => (
                      <div key={a.team_id} style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{a.team_name}:</span>
                        {a.faltaConvoc && <span style={{ color: 'var(--orange)' }}>sin convocatoria</span>}
                        {a.faltaConvoc && a.faltaStats && <span style={{ color: 'var(--text-muted)' }}>·</span>}
                        {a.faltaStats && <span style={{ color: 'var(--orange)' }}>sin estadísticas</span>}
                      </div>
                    ))}
                  </div>
                )}

                {teams.map((t, i) => (
                  <button
                    key={t.team_id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onClick={() => router.push(`/equipo?team=${t.team_id}`)}
                  >
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: teamColor(t.team_name), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.team_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.total_players} jugadores · {t.total_evaluations} evaluaciones
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: scoreColor(t.avg_global) }}>{t.avg_global?.toFixed(1) || '—'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>media</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Solicitudes pendientes */}
              {requests.length > 0 && (
                <>
                  <div className="section-title">⚠️ Solicitudes de cambio pendientes</div>
                  <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {requests.map((r: any) => (
                      <RequestCard key={r.id} req={r} onResolve={resolveRequest} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── AGENDA ─── */}
          {tab === 'agenda' && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn btn-gold btn-sm" onClick={() => router.push('/agenda')}>
                  + Gestionar agenda
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.slice(0, 15).map((ev: any, evIdx: number) => (
                  <div key={ev.id}>
                    {(evIdx === 0 || events[evIdx-1]?.date !== ev.date) && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', padding: evIdx===0 ? '0 0 6px' : '12px 0 6px', borderTop: evIdx>0 ? '1px solid var(--border)' : 'none' }}>
                        {new Date(ev.date+'T12:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}
                      </div>
                    )}
                    <div className="card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', borderLeft: '3px solid '+teamColor(ev.teams?.name||''), paddingLeft: 10 }}>
                    <span className={`badge event-${ev.type}`}>{ev.type === 'partido' ? '⚽' : ev.type === 'entrenamiento' ? '🏃' : '🏆'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {format(parseISO(ev.date), 'EEEE d MMM', { locale: es })}
                        {ev.time ? ` · ${ev.time.slice(0,5)}h` : ''}
                        {ev.teams ? ` · ${ev.teams.name}` : ' · Club'}
                      </div>
                    </div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <div className="empty-state"><div className="icon">📅</div><div>Sin eventos próximos</div></div>}
              </div>
            </div>
          )}

          {/* ─── TABLÓN ─── */}
          {tab === 'anuncios' && (
            <div style={{ padding: '16px' }}>
              {(['admin','coordinator','secretario','ejecutivo'].includes(session?.role||'') ) && (
              <button className="btn btn-gold btn-full" style={{ marginBottom: 16 }} onClick={() => setShowAnnModal(true)}>
                + Nuevo anuncio
              </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {announcements.map(a => (
                  <div key={a.id} className="card" style={a.pinned ? { borderColor: 'var(--gold)' } : {}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.pinned ? '📌 ' : ''}{a.title}</div>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        await supabase.from('announcements').delete().eq('id', a.id)
                        loadData()
                      }}>✕</button>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.content}</p>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      {a.author_name} · {format(parseISO(a.created_at), "d MMM HH:mm", { locale: es })}
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && <div className="empty-state"><div className="icon">📢</div><div>Sin anuncios</div></div>}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nuevo anuncio */}
      {showAnnModal && (
        <div className="modal-overlay" onClick={() => setShowAnnModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Nuevo anuncio</h3>
            <label className="label">Título</label>
            <input className="input" style={{ marginBottom: 12 }} value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} placeholder="Título del anuncio" />
            <label className="label">Contenido</label>
            <textarea className="input" rows={4} style={{ marginBottom: 12 }} value={annForm.content}
              onChange={e => setAnnForm(f => ({ ...f, content: e.target.value }))} placeholder="Escribe el anuncio..." />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={annForm.pinned} onChange={e => setAnnForm(f => ({ ...f, pinned: e.target.checked }))} />
              📌 Fijar en lo alto
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowAnnModal(false)}>Cancelar</button>
              <button className="btn btn-gold btn-full" onClick={postAnnouncement}>Publicar</button>
            </div>
          </div>
        </div>
      )}


      {/* TAB INFORMES */}
      {tab === 'informes' && (
        <div style={{ padding: '0 4px' }}>
          {/* Botón generar informe manual */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Los informes se generan automáticamente el día 1 de cada mes.
            </div>
            <button
              onClick={generateReport}
              disabled={generatingReport}
              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: generatingReport ? 'not-allowed' : 'pointer', opacity: generatingReport ? 0.7 : 1, whiteSpace: 'nowrap' }}
            >
              {generatingReport ? '⏳ Generando...' : '🔄 Generar informe ahora'}
            </button>
          </div>
          {reportMsg && (
            <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, background: reportMsg.includes('Error') ? '#fee2e2' : '#dcfce7', color: reportMsg.includes('Error') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600 }}>
              {reportMsg}
            </div>
          )}
          {loadingReports ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando informes...</div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay informes generados todavía.</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Los informes se generan automáticamente el día 1 de cada mes.</div>
            </div>
          ) : (() => {
            // Agrupar por mes/año
            const grupos: Record<string, any[]> = {}
            reports.forEach((r: any) => {
              const key = r.mes + '-' + r.anyo
              if (!grupos[key]) grupos[key] = []
              grupos[key].push(r)
            })
            return (
              <div>
                {Object.entries(grupos).map(([key, items]) => {
                  const [mesStr, annoStr] = key.split('-')
                  const mes = parseInt(mesStr)
                  const anno = parseInt(annoStr)
                  const mesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes-1]
                  return (
                    <div key={key} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                        📅 {mesNombre} {anno}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(items as any[]).sort((a: any, b: any) => (a.contenido?.team_name || '').localeCompare(b.contenido?.team_name || '')).map((r: any) => (
                          <div key={r.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
                                {r.contenido?.team_name || 'Equipo'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                PJ: {r.contenido?.temporada?.pj ?? '—'} &nbsp;
                                • {r.contenido?.partidos_mes?.length ?? 0} partidos en {mesNombre}
                              </div>
                            </div>
                            <a
                              href={'/api/generate-pdf?id=' + r.id}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}
                            >
                              📄 Ver informe
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

            <BottomNav role={session.role} unreadMessages={unread} pendingRequests={requests.length} />
    </div>
  )
}

function RequestCard({ req, onResolve }: { req: any; onResolve: (id: string, response: string) => void }) {
  const [response, setResponse] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <div className="card" style={{ borderColor: 'var(--orange-dim)', borderWidth: 1.5 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{req.event_title || req.events?.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {req.requester_name || req.app_users?.name} · {req.event_date || req.events?.date}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, background: 'var(--surface2)', padding: 8, borderRadius: 8 }}>{req.message}</p>
      {!open ? (
        <button className="btn btn-gold btn-sm" onClick={() => setOpen(true)}>Responder</button>
      ) : (
        <>
          <textarea className="input" rows={2} placeholder="Respuesta al entrenador..." value={response}
            onChange={e => setResponse(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-gold btn-sm" onClick={() => onResolve(req.id, response)}>Resolver</button>
          </div>
        </>
      )}
    </div>
  )
}
