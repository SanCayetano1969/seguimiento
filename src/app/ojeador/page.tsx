'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, hasFullAccess, type ScoutPlayer, type ScoutNote } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const POSITIONS = ['Portero','Defensa Central','Lateral Derecho','Lateral Izquierdo','Pivote','Interior','Extremo Derecho','Extremo Izquierdo','Mediapunta','Delantero Centro','Segundo Delantero']
const CONTACT_TYPES = ['padre','madre','club','otro'] as const

export default function OjeadorPage() {
  const router  = useRouter()
  const session = getSession()

  const [players, setPlayers] = useState<ScoutPlayer[]>([])
  const [selected, setSelected] = useState<ScoutPlayer | null>(null)
  const [notes, setNotes]     = useState<ScoutNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState<Partial<ScoutPlayer>>({})
  const [noteText, setNoteText] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [filterYear, setFilterYear] = useState<number | null>(null)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadPlayers()
  }, [])

  async function loadPlayers() {
    setLoading(true)
    const { data } = await supabase.from('scout_players').select('*').order('birth_year', { ascending: false }).order('name')
    setPlayers(data || [])
    setLoading(false)
  }

  async function loadNotes(playerId: string) {
    const { data } = await supabase.from('scout_notes').select('*').eq('scout_player_id', playerId).order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function openPlayer(p: ScoutPlayer) {
    setSelected(p)
    loadNotes(p.id)
  }

  async function savePlayer() {
    if (!form.name || !form.birth_year) return
    const payload = { ...form, created_by: session!.id }
    if (form.id) {
      await supabase.from('scout_players').update(payload).eq('id', form.id)
    } else {
      await supabase.from('scout_players').insert(payload)
    }
    setShowForm(false)
    setForm({})
    loadPlayers()
  }

  async function addNote() {
    if (!noteText.trim() || !selected || !session) return
    setAddingNote(true)
    await supabase.from('scout_notes').insert({
      scout_player_id: selected.id,
      author_id: session.id,
      author_name: session.name,
      author_avatar: session.avatar_url,
      content: noteText.trim(),
    })
    setNoteText('')
    setAddingNote(false)
    loadNotes(selected.id)
  }

  async function deleteNote(id: string) {
    await supabase.from('scout_notes').delete().eq('id', id)
    if (selected) loadNotes(selected.id)
  }

  // Years available
  const years = [...new Set(players.map(p => p.birth_year))].sort((a, b) => b - a)
  const filtered = filterYear ? players.filter(p => p.birth_year === filterYear) : players

  if (!session) return null

  // ── Player detail ──
  if (selected) {
    return (
      <div className="page-content">
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.birth_year} · {selected.current_club || 'Sin club'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setForm(selected); setShowForm(true) }}>✏️</button>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Data card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="label">Año nacimiento</div>
                <div style={{ fontWeight: 600 }}>{selected.birth_year}</div>
              </div>
              <div>
                <div className="label">Club actual</div>
                <div style={{ fontWeight: 600 }}>{selected.current_club || '—'}</div>
              </div>
              <div>
                <div className="label">Posición 1</div>
                <div style={{ fontWeight: 600 }}>{selected.position1 || '—'}</div>
              </div>
              <div>
                <div className="label">Posición 2</div>
                <div style={{ fontWeight: 600 }}>{selected.position2 || '—'}</div>
              </div>
              {selected.position3 && (
                <div>
                  <div className="label">Posición 3</div>
                  <div style={{ fontWeight: 600 }}>{selected.position3}</div>
                </div>
              )}
              <div>
                <div className="label">Contacto</div>
                <div style={{ fontWeight: 600 }}>{selected.contact_phone || '—'}</div>
              </div>
              <div>
                <div className="label">Tipo contacto</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selected.contact_type || '—'}</div>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Observaciones</div>

          {/* Add note */}
          <div className="card-sm" style={{ marginBottom: 12 }}>
            <textarea className="input" rows={3} placeholder="Añadir observación..." value={noteText}
              onChange={e => setNoteText(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn btn-gold btn-full btn-sm" onClick={addNote} disabled={addingNote || !noteText.trim()}>
              {addingNote ? '...' : '+ Añadir observación'}
            </button>
          </div>

          {/* Notes list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} className="card-sm">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: 'var(--surface3)', color: 'var(--gold)' }}>
                    {n.author_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.author_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {format(parseISO(n.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    </div>
                  </div>
                  {n.author_id === session.id && (
                    <button className="btn btn-danger btn-sm" style={{ padding: '3px 7px', fontSize: 11 }}
                      onClick={() => deleteNote(n.id)}>✕</button>
                  )}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{n.content}</p>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Sin observaciones todavía</div>
            )}
          </div>
        </div>

        {/* Edit form */}
        {showForm && <ScoutPlayerForm form={form} setForm={setForm} onSave={savePlayer} onClose={() => setShowForm(false)} />}

        <BottomNav role={session.role} />
      </div>
    )
  }

  // ── Players list ──
  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>🔍 Ojeador</div>
        <button className="btn btn-gold btn-sm" onClick={() => { setForm({}); setShowForm(true) }}>+ Jugador</button>
      </div>

      {/* Year filter */}
      <div className="scroll-row" style={{ padding: '12px 16px 0' }}>
        <button className={`btn btn-sm ${!filterYear ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setFilterYear(null)}>Todos</button>
        {years.map(y => (
          <button key={y} className={`btn btn-sm ${filterYear === y ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setFilterYear(y)}>{y}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <div style={{ padding: '16px' }}>
          {/* Group by year */}
          {years.filter(y => !filterYear || y === filterYear).map(year => {
            const yearPlayers = filtered.filter(p => p.birth_year === year)
            if (yearPlayers.length === 0) return null
            return (
              <div key={year} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Año {year}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {yearPlayers.map(p => (
                    <button key={p.id} className="card"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                      onClick={() => openPlayer(p)}>
                      <div className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: 'var(--surface3)', color: 'var(--gold)' }}>
                        {p.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {p.position1 || 'Sin posición'} · {p.current_club || 'Sin club'}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="empty-state"><div className="icon">🔍</div><div>Sin jugadores ojeados</div></div>
          )}
        </div>
      )}

      {showForm && <ScoutPlayerForm form={form} setForm={setForm} onSave={savePlayer} onClose={() => setShowForm(false)} />}
      <BottomNav role={session.role} />
    </div>
  )
}

// ── Scout player form ──
function ScoutPlayerForm({ form, setForm, onSave, onClose }: {
  form: Partial<ScoutPlayer>
  setForm: (f: Partial<ScoutPlayer>) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{form.id ? 'Editar jugador' : 'Nuevo jugador'}</h3>

        <label className="label">Nombre completo *</label>
        <input className="input" style={{ marginBottom: 12 }} value={form.name || ''}
          onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre y apellidos" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="label">Año nacimiento *</label>
            <input type="number" className="input" value={form.birth_year || ''}
              onChange={e => setForm({ ...form, birth_year: +e.target.value })} placeholder="2010" />
          </div>
          <div>
            <label className="label">Club actual</label>
            <input className="input" value={form.current_club || ''}
              onChange={e => setForm({ ...form, current_club: e.target.value })} placeholder="Nombre del club" />
          </div>
        </div>

        <label className="label">Posición principal</label>
        <select className="input" style={{ marginBottom: 12 }} value={form.position1 || ''}
          onChange={e => setForm({ ...form, position1: e.target.value })}>
          <option value="">Seleccionar...</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label className="label">Posición 2</label>
            <select className="input" value={form.position2 || ''}
              onChange={e => setForm({ ...form, position2: e.target.value })}>
              <option value="">—</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Posición 3</label>
            <select className="input" value={form.position3 || ''}
              onChange={e => setForm({ ...form, position3: e.target.value })}>
              <option value="">—</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label className="label">Teléfono contacto</label>
            <input type="tel" className="input" value={form.contact_phone || ''}
              onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="600 000 000" />
          </div>
          <div>
            <label className="label">Tipo contacto</label>
            <select className="input" value={form.contact_type || ''}
              onChange={e => setForm({ ...form, contact_type: e.target.value as any })}>
              <option value="">—</option>
              {CONTACT_TYPES.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-full" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold btn-full" onClick={onSave} disabled={!form.name || !form.birth_year}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
