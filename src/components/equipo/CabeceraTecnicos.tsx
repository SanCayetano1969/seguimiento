'use client'
import { useState, useRef } from 'react'
import { supabase, getSession } from '@/lib/supabase'

interface Props {
  team: any
  onUpdated: () => void
}

const CAMPOS = [
  { key: 'entrenador_principal', label: 'Entrenador principal', icon: '\u{1F464}' },
  { key: 'segundo_entrenador',   label: '2\u00BA Entrenador',  icon: '\u{1F464}' },
  { key: 'delegado',             label: 'Delegado',             icon: '\u{1F4CB}' },
  { key: 'liga',                 label: 'Liga',                 icon: '\u{1F3C6}' },
]

export default function CabeceraTecnicos({ team, onUpdated }: Props) {
  const session = getSession()
  const canEdit = session?.role === 'admin' || session?.role === 'coordinator'
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localVals, setLocalVals] = useState<Record<string,string>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  function getVal(key: string) {
    return localVals[key] !== undefined ? localVals[key] : (team[key] || '')
  }

  function startEdit(key: string) {
    setEditing(key)
    // El input tomará el valor via defaultValue
  }

  async function save(key: string) {
    const currentVal = inputRef.current?.value ?? ''
    setSaving(true)
    const { error } = await supabase.from('teams').update({ [key]: currentVal }).eq('id', team.id)
    setSaving(false)
    if (!error) {
      setLocalVals(prev => ({ ...prev, [key]: currentVal }))
      setEditing(null)
      onUpdated()
    } else {
      alert('Error al guardar: ' + error.message)
    }
  }

  return (
    <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--border)' }}>
      {CAMPOS.map(({ key, label, icon }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{icon} {label}</span>
          {editing === key ? (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input
                ref={inputRef}
                defaultValue={getVal(key)}
                onKeyDown={e => {
                  if (e.key === 'Enter') save(key)
                  if (e.key === 'Escape') setEditing(null)
                }}
                style={{ flex: 1, fontSize: 13, padding: '3px 8px', background: 'var(--surface2)',
                  border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)' }}
                autoFocus
              />
              <button
                onClick={() => save(key)}
                disabled={saving}
                style={{ fontSize: 12, padding: '3px 10px', background: 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                {saving ? '...' : '\u2713'}
              </button>
              <button
                onClick={() => setEditing(null)}
                style={{ fontSize: 12, padding: '3px 8px', background: 'var(--surface2)',
                  color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                \u2715
              </button>
            </div>
          ) : (
            <span
              onClick={() => { if (canEdit) startEdit(key) }}
              style={{ fontSize: 13, color: getVal(key) ? 'var(--text)' : 'var(--text-muted)',
                cursor: canEdit ? 'pointer' : 'default',
                fontStyle: getVal(key) ? 'normal' : 'italic',
                display: 'flex', alignItems: 'center', gap: 4 }}>
              {getVal(key) || (canEdit ? 'Pulsa para a\u00F1adir...' : '\u2014')}
              {canEdit && getVal(key) && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>\u270E</span>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
