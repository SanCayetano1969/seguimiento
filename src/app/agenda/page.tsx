'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, canEditAgenda, type Event, type Team } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, addDays, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const EVENT_ICONS: Record<string, string> = { partido: '⚽', entrenamiento: '🏃', torneo: '🏆', otro: '📌' }
function teamColor(name?: string): string {
  if (!name) return 'var(--gold)'
  const n = (name).toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
  if (n.includes('infantil a')) return '#3b82f6'
  if (n.includes('infantil b')) return '#22c55e'
  if (n.includes('infantil c')) return '#a855f7'
  if (n.includes('cadete a'))   return '#f97316'
  if (n.includes('cadete b'))   return '#ec4899'
  if (n.includes('juvenil'))    return '#eab308'
  if (n.includes('alevin'))     return '#06b6d4'
  if (n.includes('amateur'))    return '#ef4444'
  return 'var(--gold)'
}
const EVENT_TYPES = ['partido', 'entrenamiento', 'torneo', 'otro'] as const
const WEEKDAYS = ['L','M','X','J','V','S','D']

export default function AgendaPage() {
  const router = useRouter()
  const session = getSession()

  const [events, setEvents]   = useState<Event[]>([])
  const [teams, setTeams]     = useState<Team[]>([])
  const [month, setMonth]     = useState(new Date())
  const [selectedDay, setDay] = useState<Date | null>(new Date())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState<Partial<Event & { time_str: string, recurrence: string, recurrence_end: string, recurrence_days: number[] }>>({})
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

    const recurrence = form.recurrence || 'none'
    const groupId = recurrence !== 'none' ? crypto.randomUUID() : null

    // Generar fechas si es periodico
    const dates: string[] = []
    if (recurrence !== 'none' && form.recurrence_end && form.recurrence_days && form.recurrence_days.length > 0) {
      let cur = new Date(form.date + 'T12:00:00')
      const endDate = new Date(form.recurrence_end + 'T12:00:00')
      const step = recurrence === 'biweekly' ? 14 : 7
      while (cur <= endDate) {
        // getDay: 0=Dom,1=Lun...6=Sab -> convertir a L=0,M=1...D=6
        const dow = (cur.getDay() + 6) % 7
        if (form.recurrence_days.includes(dow)) {
          dates.push(format(cur, 'yyyy-MM-dd'))
        }
        cur = addDays(cur, 1)
      }
    } else {
      dates.push(form.date)
    }

    const basePayload = {
      title: form.title, type: form.type,
      team_id: form.team_id || null, time: form.time_str || null,
      location: form.location || null, notes: form.notes || null,
      created_by: session!.id, updated_by: session!.id,
      recurrence: recurrence !== 'none' ? recurrence : null,
      recurrence_end: form.recurrence_end || null,
      recurrence_group_id: groupId,
    }

    if (form.id) {
      // Editar solo este evento
      await supabase.from('events').update({ ...basePayload, date: form.date, updated_at: new Date().toISOString() }).eq('id', form.id)
    } else {
      // Insertar todas las ocurrencias
      const rows = dates.map(d => ({ ...basePayload, date: d }))
      await supabase.from('events').insert(rows)
    }

    setSaving(false)
    setShowForm(false)
    setForm({})
    loadData()
  }

  async function deleteEvent(id: string, groupId?: string | null) {
    if (groupId) {
      const choice = window.confirm('Eliminar solo este evento o todos los de la serie?\n\nAceptar = solo este\nCancelar = toda la serie')
      if (choice) {
        await supabase.from('events').delete().eq('id', id)
      } else {
        await supabase.from('events').delete().eq('recurrence_group_id', groupId)
      }
    } else {
      await supabase.from('events').delete().eq('id', id)
    }
    loadData()
  }

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const dayEvents = selectedDay ? events.filter(e => isSameDay(parseISO(e.date), selectedDay)) : []
  const startPad = (startOfMonth(month).getDay() + 6) % 7

  const toggleDay = (d: number) => {
    const cur = form.recurrence_days || []
    setForm(f => ({ ...f, recurrence_days: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] }))
  }

  if (!session) return null

  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>📅 Agenda</div>
        {canEdit && (
          <button className="btn btn-gold btn-sm" onClick={() => {
            setForm({ date: selectedDay ? format(selectedDay, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'), type: 'entrenamiento', recurrence: 'none', recurrence_days: [] })
            setShowForm(true)
          }}>+ Evento</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => subMonths(m, 1))}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>
          {format(month, 'MMMM yyyy', { locale: es })}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m => addMonths(m, 1))}>›</button>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {Array.from({ length: startPad }, (_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const hasEvents = events.some(e => isSameDay(parseISO(e.date), day))
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const today = isToday(day)
            return (
              <button key={day.toISOString()} onClick={() => setDay(day)} style={{
                aspectRatio: '1', borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--gold)' : today ? 'var(--surface3)' : 'transparent',
                color: isSelected ? 'var(--navy-dark)' : today ? 'var(--text)' : !isSameMonth(day, month) ? 'var(--text-muted)' : 'var(--text)',
                fontWeight: today || isSelected ? 700 : 400, fontSize: 13, position: 'relative',
              }}>
                {format(day, 'd')}
                {hasEvents && !isSelected && (
                  <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: events.filter((e:any)=>isSameDay(parseISO(e.date),day))[0]?.team_name ? teamColor(events.filter((e:any)=>isSameDay(parseISO(e.date),day))[0].team_name) : 'var(--gold)' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="divider" />

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, textTransform: 'capitalize' }}>
          {selectedDay ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona un dia'}
        </div>
        {loading ? (
          <div className="empty-state"><div className="loader animate-spin" /></div>
        ) : dayEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="icon">📅</div>
            <div style={{ fontSize: 13 }}>Sin eventos este dia</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {(() => {
              let _lastDate = ''
              return dayEvents.map((ev: any, _idx: number) => {
                const _d = ev.date ? ev.date.substring(0,10) : ''
                const _showH = _d !== _lastDate; _lastDate = _d
                return (<div key={ev.id + '_wrap'}>
                  {_showH && <div style={{ padding:'8px 2px 4px', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase', borderTop: _idx > 0 ? '1px solid var(--border)' : 'none', marginTop: _idx > 0 ? 10 : 0 }}>
                    {ev.date ? new Date(ev.date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}) : ''}
                  </div>}
                  <div className="card" style={{ display:'flex', gap:10, alignItems:'flex-start', borderLeft:'4px solid '+teamColor(ev.team_name), paddingLeft:12, marginBottom:6 }}>
              <div key={ev.id} className="card" style={{ display:'flex', gap:10, alignItems:'flex-start', borderLeft:'4px solid '+teamColor(ev.team_name), paddingLeft:12 }}>
                <span style={{ fontSize: 24 }}>{EVENT_ICONS[ev.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {ev.title}
                    {(ev as any).recurrence && (ev as any).recurrence !== 'none' && (
                      <span style={{ fontSize: 10, background: 'var(--surface3)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: 4 }}>🔁</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {ev.time ? ev.time.slice(0, 5) + 'h' : ''}
                    {ev.location ? ' · ' + ev.location : ''}
                  </div>
                  {(ev as any).teams && (
                    <span className="badge" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', marginTop: 4, fontSize: 11 }}>{(ev as any).teams.name}</span>
                  )}
                  {!ev.team_id && (
                    <span className="badge" style={{ background: 'var(--surface3)', color: 'var(--text-muted)', marginTop: 4, fontSize: 11 }}>Todo el club</span>
                  )}
                  {ev.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{ev.notes}</p>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => { setForm({ ...ev, time_str: ev.time || '', recurrence: (ev as any).recurrence || 'none', recurrence_days: [] }); setShowForm(true) }}>✏️</button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => deleteEvent(ev.id, (ev as any).recurrence_group_id)}>✕</button>
                  </div>
                )}
              </div>
                  </div>
                </div>)
              })
            })()}
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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

            <label className="label">Titulo</label>
            <input className="input" style={{ marginBottom: 12 }} value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nombre del evento" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="label">Fecha inicio</label>
                <input type="date" className="input" value={form.date || ''}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Hora</label>
                <input type="time" className="input" value={form.time_str || ''}
                  onChange={e => setForm(f => ({ ...f, time_str: e.target.value }))} />
              </div>
            </div>

            <label className="label">Equipo (vacio = todo el club)</label>
            <select className="input" style={{ marginBottom: 12 }} value={form.team_id || ''}
              onChange={e => setForm(f => ({ ...f, team_id: e.target.value || undefined }))}>
              <option value="">Todo el club</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <label className="label">Lugar</label>
            <input className="input" style={{ marginBottom: 12 }} value={form.location || ''}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Campo, instalacion..." />

            <label className="label">Notas</label>
            <textarea className="input" rows={2} style={{ marginBottom: 12 }} value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones..." />

            {/* REPETICION - solo si no es edicion */}
            {!form.id ? (
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px', marginBottom: 16, border: '1px solid var(--border)' }}>
                <label className="label" style={{ marginBottom: 8 }}>🔁 Repeticion</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { val: 'none', label: 'No repetir' },
                    { val: 'weekly', label: 'Semanal' },
                    { val: 'biweekly', label: 'Quincenal' },
                  ].map(opt => (
                    <button key={opt.val}
                      className={`btn btn-sm ${(form.recurrence || 'none') === opt.val ? 'btn-gold' : 'btn-ghost'}`}
                      onClick={() => setForm(f => ({ ...f, recurrence: opt.val }))}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {(form.recurrence === 'weekly' || form.recurrence === 'biweekly') && (
                  <>
                    <label className="label" style={{ marginBottom: 6 }}>Dias de la semana</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {WEEKDAYS.map((d, i) => (
                        <button key={i}
                          onClick={() => toggleDay(i)}
                          style={{
                            width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            background: (form.recurrence_days || []).includes(i) ? 'var(--gold)' : 'var(--surface3)',
                            color: (form.recurrence_days || []).includes(i) ? 'var(--navy-dark)' : 'var(--text-muted)',
                          }}>
                          {d}
                        </button>
                      ))}
                    </div>

                    <label className="label">Repetir hasta</label>
                    <input type="date" className="input"
                      value={form.recurrence_end || ''}
                      onChange={e => setForm(f => ({ ...f, recurrence_end: e.target.value }))} />
                  </>
                )}
              </div>
            ) : null}

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
