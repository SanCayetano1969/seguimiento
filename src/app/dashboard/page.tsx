'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, clearSession, roleBadge, type Event, type Announcement, type Team } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, startOfWeek, addDays, addWeeks, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const EVENT_ICONS: Record<string, string> = {
  partido: '⚽', entrenamiento: '🏃', torneo: '🏆', otro: '📌'
}

export default function DashboardPage() {
  const router = useRouter()
  const session = getSession()

  const [teams, setTeams]         = useState<Team[]>([])
  const [events, setEvents]       = useState<Event[]>([])
  const [announcements, setAnn]   = useState<Announcement[]>([])
  const [unread, setUnread]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [selectedTeam, setSelected] = useState<string>('all')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    if (['admin', 'coordinator'].includes(session.role)) { router.push('/club'); return }
    loadData()
  }, [])

  const loadData = useCallback(async () => {
    if (!session) return
    setLoading(true)

    const teamIds = session.team_ids || []

    // Cargar equipos del usuario
    if (teamIds.length > 0) {
      const { data } = await supabase.from('teams').select('*').in('id', teamIds)
      setTeams(data || [])
    }

    // Agenda: próximas 5 semanas
    const today = new Date()
    const end = addWeeks(today, 5)
    let evQuery = supabase.from('events')
      .select('*, teams(name,category)')
      .gte('date', format(today, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .order('date').order('time')

    // Filtrar por equipos del usuario (+ eventos globales team_id=null)
    if (teamIds.length > 0) {
      evQuery = evQuery.or(`team_id.in.(${teamIds.join(',')}),team_id.is.null`)
    }
    const { data: evData } = await evQuery
    setEvents(evData || [])

    // Anuncios
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    setAnn(annData || [])

    // Mensajes no leídos
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', session.id)
      .eq('read', false)
    setUnread(count || 0)

    setLoading(false)
  }, [session])

  function logout() {
    clearSession()
    localStorage.removeItem('sc_access_code')
    router.push('/')
  }

  // Agrupar eventos por semana
  const weeks: { label: string; days: { date: Date; events: Event[] }[] }[] = []
  const today = new Date()
  for (let w = 0; w < 5; w++) {
    const weekStart = startOfWeek(addWeeks(today, w), { weekStartsOn: 1 })
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const dayEvents = events.filter(e => isSameDay(parseISO(e.date), date))
      return { date, events: dayEvents }
    }).filter(d => d.events.length > 0 || w === 0)

    const label = w === 0 ? 'Esta semana'
      : w === 1 ? 'Próxima semana'
      : `Semana del ${format(weekStart, 'd MMM', { locale: es })}`

    weeks.push({ label, days })
  }

  if (!session) return null

  const rb = roleBadge(session.role)

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/escudo.jpeg" alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1 }}>Hola, {session.name.split(' ')[0]}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="badge" style={{ background: rb.color + '22', color: rb.color, fontSize: 10 }}>{rb.label}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Salir</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <>
          {/* Selector de equipo (si tiene varios) */}
          {teams.length > 1 && (
            <div style={{ padding: '12px 16px 0' }}>
              <div className="scroll-row">
                <button
                  className={`btn btn-sm ${selectedTeam === 'all' ? 'btn-gold' : 'btn-ghost'}`}
                  onClick={() => setSelected('all')}
                >Todos</button>
                {teams.map(t => (
                  <button
                    key={t.id}
                    className={`btn btn-sm ${selectedTeam === t.id ? 'btn-gold' : 'btn-ghost'}`}
                    onClick={() => setSelected(t.id)}
                  >{t.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Tablón de anuncios */}
          {announcements.length > 0 && (
            <>
              <div className="section-title">📢 Tablón de novedades</div>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {announcements.map(a => (
                  <div key={a.id} className="card-sm" style={a.pinned ? { borderColor: 'var(--gold)', borderWidth: 1.5 } : {}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {a.pinned && <span style={{ fontSize: 12 }}>📌</span>}
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.content}</p>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      {a.author_name} · {format(parseISO(a.created_at), "d MMM 'a las' HH:mm", { locale: es })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Agenda 5 semanas */}
          <div className="section-title">📅 Agenda</div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {weeks.map((week, wi) => (
              <div key={wi}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {week.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {week.days.map((day, di) => (
                    <div key={di}>
                      {day.events.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginLeft: 2 }}>
                          {format(day.date, 'EEEE d MMM', { locale: es })}
                        </div>
                      )}
                      {day.events
                        .filter(e => selectedTeam === 'all' || e.team_id === selectedTeam || !e.team_id)
                        .map(ev => (
                          <EventCard key={ev.id} event={ev} userId={session.id} onRequestSent={loadData} />
                        ))}
                    </div>
                  ))}
                  {week.days.every(d => d.events.filter(e => selectedTeam === 'all' || e.team_id === selectedTeam || !e.team_id).length === 0) && wi === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Sin eventos esta semana</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Acceso rápido a equipos */}
          {teams.length > 0 && (
            <>
              <div className="section-title">⚽ Mis equipos</div>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teams.map(t => (
                  <button
                    key={t.id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onClick={() => router.push(`/equipo?team=${t.id}`)}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.category} · {t.modalidad}</div>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <BottomNav role={session.role} unreadMessages={unread} />
    </div>
  )
}

// ── Tarjeta de evento con botón de solicitar cambio ──────────
function EventCard({ event, userId, onRequestSent }: { event: Event; userId: string; onRequestSent: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  async function sendRequest() {
    if (!msg.trim()) return
    setSending(true)
    await supabase.from('event_requests').insert({
      event_id: event.id, requester_id: userId, message: msg.trim()
    })
    setSending(false)
    setShowModal(false)
    setMsg('')
    onRequestSent()
  }

  const typeClass = `event-${event.type}`

  return (
    <>
      <div className="card-sm" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
        <span className={`badge ${typeClass}`} style={{ fontSize: 18, padding: '2px 6px', marginTop: 2 }}>
          {EVENT_ICONS[event.type]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{event.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {event.time ? event.time.slice(0, 5) + 'h' : ''}{event.location ? ` · ${event.location}` : ''}
          </div>
          {(event as any).teams && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(event as any).teams.name}</div>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '4px 8px', flexShrink: 0 }}
          onClick={() => setShowModal(true)}
        >⚠️ Cambio</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Solicitar modificación</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {event.title} · {event.date}
            </p>
            <label className="label">Motivo y posible solución</label>
            <textarea
              className="input"
              placeholder="Explica el motivo y sugiere una alternativa..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={4}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-gold btn-full" onClick={sendRequest} disabled={sending || !msg.trim()}>
                {sending ? '...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
