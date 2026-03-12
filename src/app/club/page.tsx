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

export default function ClubPage() {
  function teamColor(name) {
    if (!name) return 'var(--gold)'
    const n = name.toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    if (n.includes('infantil a')) return '#3b82f6'
    if (n.includes('infantil b')) return '#22c55e'
    if (n.includes('infantil c')) return '#a855f7'
    if (n.includes('cadete a'))   return '#f97316'
    if (n.includes('cadete b'))   return '#ec4899'
    if (n.includes('juvenil'))    return '#eab308'
    if (n.includes('alevin'))     return '#06b6d4'
    if (n.includes('amateur'))    return '#ef4444'
    return '#5bb8e8'
  }

  const router = useRouter()
  const session = getSession()

  const [teams, setTeams]       = useState<TeamOverview[]>([])
  const [events, setEvents]     = useState<any[]>([])
  const [announcements, setAnn] = useState<Announcement[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [unread, setUnread]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'overview'|'agenda'|'anuncios'>('overview')
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [lastEvalDays, setLastEvalDays] = useState<Record<string, number>>({})
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

    // Última jornada con fecha por equipo
    const { data: jornadasData } = await supabase
      .from('jornadas')
      .select('team_id, date')
      .not('date', 'is', null)
      .order('date', { ascending: false })

    const daysMap: Record<string, number> = {}
    if (jornadasData) {
      const seen = new Set<string>()
      const now = new Date()
      for (const j of jornadasData) {
        if (!seen.has(j.team_id)) {
          seen.add(j.team_id)
          const diff = Math.floor((now.getTime() - new Date(j.date).getTime()) / (1000 * 60 * 60 * 24))
          daysMap[j.team_id] = diff
        }
      }
    }
    setLastEvalDays(daysMap)

    const ORDER = ["Alevin","Alevin","Infantil","Cadete","Juvenil","Amateur"]
    const sorted = (tData || []).sort((a,b) => {
      const cats = ["Alevin","Infantil","Cadete","Juvenil","Amateur"]
      return cats.indexOf(a.category) - cats.indexOf(b.category) || a.team_name.localeCompare(b.team_name)
    })
    setTeams(sorted)
    setEvents(evData || [])
    setAnn(annData || [])
    setRequests(reqData || [])
    setUnread(unreadCount || 0)
    setLoading(false)
  }

  async function postAnnouncement() {
    if (!annForm.title.trim() || !annForm.content.trim()) return
    await supabase.from('announcements').insert({
      title: annForm.title, content: annForm.content,
      pinned: annForm.pinned, author_id: session!.id, author_name: session!.name
    })
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
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '12px 16px 0', gap: 8 }}>
        {(['overview','agenda','anuncios'] as const).map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📊 Resumen' : t === 'agenda' ? '📅 Agenda' : '📢 Tablón'}
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
                {teams.map((t, i) => (
                  <button
                    key={t.team_id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onClick={() => router.push(`/equipo?team=${t.team_id}`)}
                  >
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: teamColor(t.name), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.team_name}
                        {(lastEvalDays[t.team_id] === undefined || lastEvalDays[t.team_id] > 15) && (
                          <span title="Sin evaluaciones en los últimos 15 días" style={{ fontSize: 13, lineHeight: 1 }}>⚠️</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.total_players} jugadores · {t.total_evaluations} evaluaciones
                        {lastEvalDays[t.team_id] !== undefined && lastEvalDays[t.team_id] <= 15
                          ? <span style={{ color: 'var(--green)', marginLeft: 4 }}>· hace {lastEvalDays[t.team_id]}d</span>
                          : lastEvalDays[t.team_id] !== undefined
                            ? <span style={{ color: 'var(--orange)', marginLeft: 4 }}>· hace {lastEvalDays[t.team_id]}d</span>
                            : <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>· sin evaluar</span>
                        }
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
                  <div key={ev.id + '_wrap'}>
                    {(evIdx === 0 || upcomingEvents[evIdx-1]?.date !== ev.date) && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: evIdx === 0 ? '0 0 4px' : '10px 0 4px', borderTop: evIdx > 0 ? '1px solid var(--border)' : 'none' }}>
                        {ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
                      </div>
                    )}
                    <div className="card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', borderLeft: '3px solid ' + teamColor(ev.teams?.name), paddingLeft: 10 }}>
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
                ))}
                {events.length === 0 && <div className="empty-state"><div className="icon">📅</div><div>Sin eventos próximos</div></div>}
              </div>
            </div>
          )}

          {/* ─── TABLÓN ─── */}
          {tab === 'anuncios' && (
            <div style={{ padding: '16px' }}>
              <button className="btn btn-gold btn-full" style={{ marginBottom: 16 }} onClick={() => setShowAnnModal(true)}>
                + Nuevo anuncio
              </button>
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
