'use client'
import { useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'

interface Props {
  team: any
  onUpdated: () => void
}

const CAMPOS = [
  { key: 'entrenador_principal', label: 'Entrenador principal', icon: '👤' },
  { key: 'segundo_entrenador',   label: '2º Entrenador',        icon: '👤' },
  { key: 'delegado',             label: 'Delegado',             icon: '📋' },
  { key: 'liga',                 label: 'Liga',                 icon: '🏆' },
]

export default function CabeceraTecnicos({ team, onUpdated }: Props) {
  const session = getSession()
  const canEdit = session?.role === 'admin' || session?.role === 'coordinator'
  const [editing, setEditing] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  // Estado local para mostrar valores actualizados inmediatamente
  const [localVals, setLocalVals] = useState<Record<string,string>>({})

  function getVal(key: string) {
    return localVals[key] !== undefined ? localVals[key] : (team[key] || '')
  }

  async function save(key: string) {
    setSaving(true)
    const { error } = await supabase.from('teams').update({ [key]: val }).eq('id', team.id)
    setSaving(false)
    if (!error) {
      setLocalVals(prev => ({ ...prev, [key]: val }))
      setEditing(null)
      onUpdated()
    } else {
      console.error('Error guardando:', error)
      alert('Error al guardar: ' + error.message)
    }
  }

  return (
    <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      {CAMPOS.map(({ key, label, icon }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{icon} {label}</span>
          {editing === key ? (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(key); if (e.key === 'Escape') setEditing(null) }}
                style={{ flex: 1, fontSize: 13, padding: '2px 6px', background: 'var(--surface2)',
                  border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}
                autoFocus
              />
              <button onClick={() => save(key)} disabled={saving}
                style={{ fontSize: 12, padding: '2px 8px', background: 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                {saving ? '...' : '✓'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{ fontSize: 12, padding: '2px 8px', background: 'var(--surface2)',
                  color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          ) : (
            <span
              onClick={() => { if (canEdit) { setEditing(key); setVal(getVal(key)) } }}
              style={{ fontSize: 13, color: getVal(key) ? 'var(--text)' : 'var(--text-muted)',
                cursor: canEdit ? 'pointer' : 'default',
                fontStyle: getVal(key) ? 'normal' : 'italic' }}
            >
              {getVal(key) || (canEdit ? 'Pulsa para añadir...' : '—')}
              {canEdit && getVal(key) && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-muted)' }}>✎</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
