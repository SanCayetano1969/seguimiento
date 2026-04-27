'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, type Event, type Team } from '@/lib/supabase'
import { canEdit as getCanEdit } from '@/lib/permissions'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, addDays, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const EVENT_ICONS: Record<string, string> = { partido: '⚽', entrenamiento: '🏃', torneo: '🏆', otro: '📌' }
const EVENT_TYPES = ['partido', 'entrenamiento', 'torneo', 'otro'] as const
const WEEKDAYS = ['L','M','X','J','V','S','D']

// ── Instalaciones disponibles ────────────────────────────────────────────
const INSTALACIONES = [
  'SanCa Norte 1','SanCa Norte 2','SanCa Sur 1','SanCa Sur 2',
  'Son Moix Norte 1','Son Moix Norte 2','Son Moix Sur 1','Son Moix Sur 2',
  'San Fernando Norte 1','San Fernando Norte 2','San Fernando Sur 1','San Fernando Sur 2',
  'Otro'
]

// Disponibilidad: {dia:[{desde,hasta,zonas}]} — dia 1=Lun..5=Vie
const DISPONIBILIDAD: Record<string, Record<number, {desde:string, hasta:string, zonas:string[]}[]>> = {
  'SanCa': {
    1:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    2:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    3:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    4:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    5:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
  'Son Moix': {
    1:[{desde:'20:30',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    2:[{desde:'19:30',hasta:'20:30',zonas:['Norte 1','Norte 2']}],
    3:[{desde:'20:00',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    4:[{desde:'19:30',hasta:'20:30',zonas:['Norte 1','Norte 2']}],
    5:[{desde:'20:00',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
  'San Fernando': {
    1:[{desde:'20:30',hasta:'21:30',zonas:['Norte 1','Norte 2']}],
    2:[],
    3:[{desde:'17:30',hasta:'19:00',zonas:['Norte 1','Norte 2']}],
    4:[],
    5:[{desde:'19:00',hasta:'20:00',zonas:['Norte 1','Norte 2']},{desde:'20:00',hasta:'21:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
}

function validarInstalacion(instalacion: string, fecha: string, hora: string): string | null {
  if (!instalacion || instalacion === 'Otro' || !fecha || !hora) return null
  const d = new Date(fecha + 'T12:00:00')
  const dow = d.getDay() // 0=dom
  if (dow === 0 || dow === 6) return null // fines de semana sin restricción aquí
  let instalKey = ''
  if (instalacion.startsWith('SanCa')) instalKey = 'SanCa'
  else if (instalacion.startsWith('Son Moix')) instalKey = 'Son Moix'
  else if (instalacion.startsWith('San Fernando')) instalKey = 'San Fernando'
  else return null
  const slots = DISPONIBILIDAD[instalKey]?.[dow] || []
  if (slots.length === 0) return `${instalKey} no disponible ese día`
  const zona = instalacion.replace(instalKey + ' ', '')
  const [hh, mm] = hora.split(':').map(Number)
  const minutos = hh * 60 + mm
  for (const slot of slots) {
    const [dh, dm] = slot.desde.split(':').map(Number)
    const [fh, fm] = slot.hasta.split(':').map(Number)
    if (minutos >= dh*60+dm && minutos < fh*60+fm) {
      if (!slot.zonas.includes(zona)) return `${zona} no disponible en ese horario (solo ${slot.zonas.join(', ')})`
      return null
    }
  }
  return `${instalKey} no disponible a las ${hora}`
}

export default function AgendaPage() {
  function teamColor(t?: string): string {
    const n = (t||'').toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    if (n.includes('infantil a')) return '#3b82f6'
    if (n.includes('infantil b')) return '#22c55e'
    if (n.includes('infantil c')) return '#a855f7'
    if (n.includes('cadete a'))   return '#f97316'
    if (n.includes('cadete b'))   return '#ec4899'
    if (n.includes('juvenil'))    return '#eab308'
    if (n.includes('alevin'))     return '#06b6d4'
    if (n.includes('amateur'))    return '#ef4444'
    return '#888'
  }

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
  const [markingEvent, setMarkingEvent] = useState<string|null>(null)

  async function toggleSinInstalacion(ev: any) {
    setMarkingEvent(ev.id)
    const nuevo = !ev.sin_instalacion
    await supabase.from('events').update({
      sin_instalacion: nuevo,
      sin_instalacion_at: nuevo ? new Date().toISOString() : null
    }).eq('id', ev.id)
    if (nuevo) {
      await fetch('/api/sin-instalacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: ev.id, teamId: ev.team_id, title: ev.title, date: ev.date, location: ev.location })
      })
    }
    setMarkingEvent(null)
    loadData()
  }

  const canEdit = getCanEdit(session?.role || '', 'agenda')

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadData()
  }, [month])

  async function loadData() {
    setLoading(true)
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end   = format(endOfMonth(month), 'yyyy-MM-dd')
    const [{ data: evData }, { data: teamsData }] = await Promise.all([
      supabase.from('events').select('*, teams(name,category), sin_instalacion, sin_instalacion_at')
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

    // Verificar si la instalación ya está ocupada por otro equipo
    if (form.type === 'entrenamiento' && form.location && form.location !== 'Otro' && form.time) {
      const { data: ocupado } = await supabase.from('events')
        .select('id,team_id,teams(name)')
        .eq('type','entrenamiento')
        .eq('date', form.date)
        .eq('time', form.time.length === 5 ? form.time+':00' : form.time)
        .eq('location', form.location)
        .neq('team_id', form.team_id || '')
        .limit(1)
      if (ocupado && ocupado.length > 0) {
        const equipo = (ocupado[0] as any).teams?.name || 'otro equipo'
        alert('⚠️ Instalación ocupada\n\n' + form.location + ' ya está asignada a ' + equipo + ' a esa hora.\n\nPara cambios en la organización de entrenos, ponte en contacto con el coordinador.')
        return
      }
    }

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
      sin_instalacion: false,
      sin_instalacion_at: null,
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
    <>
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
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
                  <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: teamColor(events.filter((e:any)=>isSameDay(parseISO(e.date),day))[0]?.teams?.name) }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayEvents.map(ev => (
              <div key={ev.id} className="card" style={{ display:'flex', gap:10, alignItems:'flex-start', borderLeft:'4px solid '+teamColor(ev.teams?.name), paddingLeft:12 }}>
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
                  {(ev as any).sin_instalacion && (
                    <div style={{ marginTop: 4, padding: '4px 8px', background: '#ef4444', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'white',
                      animation: 'pulse 1.5s infinite', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠️ SIN INSTALACIÓN — actividad no puede realizarse
                    </div>
                  )}
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
                  {(session?.role === 'admin' || session?.role === 'secretario') && (
                    <button
                      onClick={() => toggleSinInstalacion(ev)}
                      disabled={markingEvent === ev.id}
                      style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 700,
                        background: (ev as any).sin_instalacion ? '#ef4444' : '#f59e0b',
                        color: 'white', opacity: markingEvent === ev.id ? 0.6 : 1 }}>
                      {(ev as any).sin_instalacion ? '✅ Restaurar' : '⚠️ Sin instalación'}
                    </button>
                  )}
                  </div>
                )}
              </div>
            ))}
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

            <label className="label">Instalación</label>
            <select className="input" style={{ marginBottom: form.location === 'Otro' ? 4 : 12 }}
              value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
              <option value="">-- Selecciona instalación --</option>
              <optgroup label="San Ca">
                <option value="SanCa Norte 1">SanCa Norte 1</option>
                <option value="SanCa Norte 2">SanCa Norte 2</option>
                <option value="SanCa Sur 1">SanCa Sur 1</option>
                <option value="SanCa Sur 2">SanCa Sur 2</option>
              </optgroup>
              <optgroup label="Son Moix">
                <option value="Son Moix Norte 1">Son Moix Norte 1</option>
                <option value="Son Moix Norte 2">Son Moix Norte 2</option>
                <option value="Son Moix Sur 1">Son Moix Sur 1</option>
                <option value="Son Moix Sur 2">Son Moix Sur 2</option>
              </optgroup>
              <optgroup label="San Fernando">
                <option value="San Fernando Norte 1">San Fernando Norte 1</option>
                <option value="San Fernando Norte 2">San Fernando Norte 2</option>
                <option value="San Fernando Sur 1">San Fernando Sur 1</option>
                <option value="San Fernando Sur 2">San Fernando Sur 2</option>
              </optgroup>
              <option value="Otro">Otro (especificar)</option>
            </select>
            {form.location === 'Otro' && (
              <input className="input" style={{ marginBottom: 12 }} placeholder="Indica el lugar..."
                value={form.locationOtro || ''} onChange={e => setForm(f => ({ ...f, locationOtro: e.target.value }))} />
            )}
            {form.location && form.location !== 'Otro' && form.date && form.time && (() => {
              const err = validarInstalacion(form.location, form.date, form.time)
              return err ? <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>⚠️ {err}</div> : null
            })()}

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
    </>
  )
}
