'use client'
import { useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'

interface Props {
  team: any
  onUpdated: () => void
}

const CAMPOS = [
  { key: 'entrenador_principal', label: 'Entrenador principal', icon: '👤' },
  { key: 'segundo_entrenador',   label: '2º Entrenador',   icon: '👤' },
  { key: 'delegado',             label: 'Delegado',             icon: '🗂️' },
  { key: 'liga',                 label: 'Liga',                 icon: '🏆' },
]

export default function CabeceraTecnicos({ team, onUpdated }: Props) {
  const session = getSession()
  const canEdit = session?.role === 'admin' || session?.role === 'coordinator'
  const [editing, setEditing] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(key: string) {
    setSaving(true)
    await supabase.from('teams').update({ [key]: val }).eq('id', team.id)
    setSaving(false)
    setEditing(null)
    onUpdated()
  }

  return (
    <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      {CAMPOS.map(({ key, label, icon }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{icon} {label}</span>
          {editing === key ? (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input
                className="input"
                style={{ flex: 1, height: 28, fontSize: 12, padding: '0 8px' }}
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save(key)}
                autoFocus
              />
              <button className="btn btn-gold" style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                onClick={() => save(key)} disabled={saving}>
                {saving ? '...' : 'OK'}
              </button>
              <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px' }}
                onClick={() => setEditing(null)}>✕</button>
            </div>
          ) : (
            <span
              style={{ fontSize: 13, color: team[key] ? 'var(--text)' : 'var(--text-muted)', flex: 1,
                cursor: canEdit ? 'pointer' : 'default',
                fontStyle: team[key] ? 'normal' : 'italic' }}
              onClick={() => { if (canEdit) { setEditing(key); setVal(team[key] || '') } }}
            >
              {team[key] || (canEdit ? 'Pulsa para añadir...' : '—')}
              {canEdit && team[key] && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>✏️</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
