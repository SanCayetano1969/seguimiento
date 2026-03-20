'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, roleBadge } from '@/lib/supabase'

const MODULOS = [
  { key: 'club', label: 'Panel Club / Tablón' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'mensajes', label: 'Mensajería' },
  { key: 'dashboard', label: 'Dashboard equipo' },
  { key: 'equipo', label: 'Ficha equipo / jugadores' },
  { key: 'ojeador', label: 'Ojeador / Scouting' },
  { key: 'biblioteca', label: 'Biblioteca' },
  { key: 'tesoreria', label: 'Tesorería' },
  { key: 'informes', label: 'Informes mensuales' },
  { key: 'admin', label: 'Panel Admin (usuarios)' },
]

const DEFAULT_PERMISOS: Record<string, string[]> = {
  admin:       ['club','agenda','mensajes','dashboard','equipo','ojeador','biblioteca','tesoreria','informes','admin'],
  coordinator: ['club','agenda','mensajes','dashboard','equipo','ojeador','biblioteca','tesoreria','informes'],
  secretario:  ['club','agenda','mensajes','tesoreria'],
  ejecutivo:   ['club','mensajes','tesoreria'],
  coach:       ['agenda','mensajes','dashboard','equipo','biblioteca'],
  psychologist:['mensajes','dashboard','biblioteca'],
  scout:       ['ojeador','mensajes','biblioteca'],
}

const ROLES_LABEL: Record<string, string> = {
  admin: 'Administrador', coordinator: 'Coordinador', secretario: 'Secretario',
  ejecutivo: 'Ejecutivo', coach: 'Entrenador', psychologist: 'Psicólogo', scout: 'Ojeador'
}

const STORAGE_KEY = 'sc_role_permisos'

function loadPermisos(): Record<string, string[]> {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return { ...DEFAULT_PERMISOS, ...JSON.parse(saved) } } catch {}
  return { ...DEFAULT_PERMISOS }
}
function savePermisos(p: Record<string, string[]>) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) }

export default function AdminPermisosPage() {
  const router = useRouter()
  const session = getSession()
  const [permisos, setPermisos] = useState<Record<string, string[]>>(DEFAULT_PERMISOS)
  const [selectedRole, setSelectedRole] = useState('coordinator')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session || session.role !== 'admin') { router.push('/club'); return }
    setPermisos(loadPermisos())
  }, [])

  function toggle(modulo: string) {
    setPermisos(prev => {
      const current = prev[selectedRole] || []
      const updated = current.includes(modulo) ? current.filter(m => m !== modulo) : [...current, modulo]
      return { ...prev, [selectedRole]: updated }
    })
    setSaved(false)
  }

  function handleSave() { savePermisos(permisos); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  function handleReset() { setPermisos({ ...DEFAULT_PERMISOS }); savePermisos({ ...DEFAULT_PERMISOS }); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const roleKeys = Object.keys(DEFAULT_PERMISOS)
  const badge = roleBadge(selectedRole)
  const currentPerms = permisos[selectedRole] || []
  const btnG: React.CSSProperties = { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }
  const btnP: React.CSSProperties = { background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/usuarios')} style={{ ...btnG, padding: '6px 10px' }}>←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Permisos por Rol</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Define qué módulos puede ver cada rol</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
        {roleKeys.map(r => {
          const b = roleBadge(r)
          const isSel = selectedRole === r
          return (
            <button key={r} onClick={() => setSelectedRole(r)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: isSel ? '2px solid '+(b?.color||'#888') : '1px solid var(--border)',
              background: isSel ? (b?.color||'#888')+'22' : 'var(--surface)',
              color: isSel ? (b?.color||'#888') : 'var(--text-muted)',
            }}>
              {ROLES_LABEL[r]}
            </button>
          )
        })}
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: badge?.color || '#888' }}>{ROLES_LABEL[selectedRole]}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— {currentPerms.length} módulos activos</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {MODULOS.map(mod => {
            const isOn = currentPerms.includes(mod.key)
            const disabled = mod.key === 'admin' && selectedRole !== 'admin'
            return (
              <div key={mod.key} onClick={() => !disabled && toggle(mod.key)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                background: isOn ? (badge?.color||'#3b82f6')+'15' : 'var(--surface2)',
                border: '1px solid '+(isOn ? (badge?.color||'#3b82f6')+'44' : 'var(--border)'),
                opacity: disabled ? 0.4 : 1,
              }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: isOn ? (badge?.color||'#3b82f6') : '#4b5563', position: 'relative' as const }}>
                  <div style={{ position: 'absolute' as const, top: 2, left: isOn ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{mod.label}</span>
                {disabled && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>solo admin</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
        Los permisos se guardan en este dispositivo y se aplican al navegar por la app.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        <button onClick={handleReset} style={{ ...btnG, fontSize: 13 }}>Restaurar predeterminados</button>
        <button onClick={handleSave} style={{ ...btnP, background: saved ? '#059669' : 'var(--accent)' }}>
          {saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}