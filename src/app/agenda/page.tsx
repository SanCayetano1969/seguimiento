'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, canEditAgenda, type Event, type Team } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns'
import { es } from 'date-fns/locale'

const EVENT_ICONS: Record<string, string> = { partido: '⚽', entrenamiento: '🏃', torneo: '🏆', otro: '📌' }
const EVENT_TYPES = ['partido', 'entrenamiento', 'torneo', 'otro'] as const

export default function AgendaPage() {
  const router = useRouter()
  const session = getSession()

  const [events, setEvents]   = useState<Event[]>([])
  const [teams, setTeams]     = useState<Team[]>([])
  const [month, setMonth]     = useState(new Date())
  const [selectedDay, setDay] = useState<Date | null>(new Date())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState<Partial<Event & { time_str: string }>>({})
  const [saving, setSaving]   = useState(false)
  const canEdit = canEditAgenda(session?.role || 'coach')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [month])

  async function loadData() {
    setLoading(true)
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end   = format(endOfMonth(month), 'yyyy-MM-dd')

    const [{ data: evData }, { data: teamsData }] = await Promise.all([
      supabase.from('events').select('*, teams(name,category)')
        .gte('date', start).lte('date', end)
        .order('date').order('time'),
      supabase.from('teams').select('*').order('name'),
    ])
    setEvents(evData || [])
    setTeams(teamsData || [])
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.title || !form.date || !form.type) return
    setSaving(true)
    const payload = {
      title: form.title, date: form.date, type: form.type,
      team_id: form.team_id || null, time: form.time_str || null,
      location: form.location || null, notes: form.notes || null,
      created_by: session!.id, updated_by: session!.id,
    }
    if (form.id) {
      await supabase.from('events').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id)
    } else {
      await supabase.from('events').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setForm({})
    loadData()
  }

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    loadData()
  }

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const dayEvents = selectedDay ? events.filter(e => isSameDay(parseISO(e.date), selectedDay)) : []
  // Fill start of week
  const startPad = (startOfMonth(month).getDay() + 6) % 7

  if (!session) return null

  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>📅 Agenda</div>
        {canEdit && (
          <button className="btn btn-gold btn-sm" onClick={() => {
            setForm({ date: selectedDay ? format(selectedDay, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'), type: 'entrenamiento' })
            setShowForm(true)
          }}>+ Evento</button>
        )}
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => subMonths(m, 1))}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>
          {format(month, 'MMMM yyyy', { locale: es })}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => addMonths(m, 1))}>›</button>
      </div>

      {/* Calendar grid */}
      <div style={{ padding: '0 16px' }}>
        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: startPad }, (_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const hasEvents = events.some(e => isSameDay(parseISO(e.date), day))
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const today = isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setDay(day)}
                style={{
                  aspectRatio: '1', borderRadius: 8, border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: isSelected ? 'var(--gold)' : today ? 'var(--surface3)' : 'transparent',
                  color: isSelected ? 'var(--navy-dark)' : today ? 'var(--text)' : !isSameMonth(day, month) ? 'var(--text-muted)' : 'var(--text)',
                  fontWeight: today || isSelected ? 700 : 400,
                  fontSize: 13, position: 'relative',
                }}
              >
                {format(day, 'd')}
                {hasEvents && !isSelected && (
                  <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="divider" />

      {/* Selected day events */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, textTransform: 'capitalize' }}>
          {selectedDay ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona un día'}
        </div>
        {loading ? (
          <div className="empty-state"><div className="loader animate-spin" /></div>
        ) : dayEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="icon">📅</div>
            <div style={{ fontSize: 13 }}>Sin eventos este día</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayEvents.map(ev => (
              <div key={ev.id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24 }}>{EVENT_ICONS[ev.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {ev.time ? ev.time.slice(0, 5) + 'h' : ''}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </div>
                  {(ev as any).teams && (
                    <span className="badge" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', marginTop: 4, fontSize: 11 }}>
                      {(ev as any).teams.name}
                    </span>
                  )}
                  {!ev.team_id && (
                    <span className="badge" style={{ background: 'var(--surface3)', color: 'var(--text-muted)', marginTop: 4, fontSize: 11 }}>
                      Todo el club
                    </span>
                  )}
                  {ev.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{ev.notes}</p>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => { setForm({ ...ev, time_str: ev.time || '' }); setShowForm(true) }}>✏️</button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => deleteEvent(ev.id)}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{form.id ? 'Editar evento' : 'Nuevo evento'}</h3>

            <label className="label">Tipo</label>
            <div className="scroll-row" style={{ marginBottom: 12 }}>
              {EVENT_TYPES.map(t => (
                <button key={t} className={`btn btn-sm ${form.type === t ? 'btn-gold' : 'btn-ghost'}`}
                  onClick={() => setForm(f => ({ ...f, type: t }))}>
                  {EVENT_ICONS[t]} {t}
                </button>
              ))}
            </div>

            <label className="label">Título</label>
            <input className="input" style={{ marginBottom: 12 }} value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nombre del evento" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" value={form.date || ''}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Hora</label>
                <input type="time" className="input" value={form.time_str || ''}
                  onChange={e => setForm(f => ({ ...f, time_str: e.target.value }))} />
              </div>
            </div>

            <label className="label">Equipo (vacío = todo el club)</label>
            <select className="input" style={{ marginBottom: 12 }} value={form.team_id || ''}
              onChange={e => setForm(f => ({ ...f, team_id: e.target.value || undefined }))}>
              <option value="">Todo el club</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <label className="label">Lugar</label>
            <input className="input" style={{ marginBottom: 12 }} value={form.location || ''}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Campo, instalación..." />

            <label className="label">Notas</label>
            <textarea className="input" rows={2} style={{ marginBottom: 16 }} value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones..." />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-gold btn-full" onClick={saveEvent} disabled={saving}>
                {saving ? '...' : form.id ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role={session.role} />
    </div>
  )
}
