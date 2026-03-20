'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, roleBadge } from '@/lib/supabase'
import { ROLE_PERMISSIONS, MODULE_LABELS, canView, canEdit, type Module, type UserPermOverride } from '@/lib/permissions'

const MODULES: Module[] = ['club','agenda','tablon','equipo','mensajeria','ojeador','biblioteca','tesoreria','informes','admin']

export default function AdminPermisosPage({ params }: { params: { userId: string } }) {
  const router = useRouter()
  const session = getSession()
  const [user, setUser] = useState<any>(null)
  const [overrides, setOverrides] = useState<Record<string, {can_view:boolean, can_edit:boolean}>>({})
  const [defaults, setDefaults] = useState<Record<string, {can_view:boolean, can_edit:boolean}>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string|null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!session || session.role !== 'admin') { router.push('/club'); return }
    loadUser()
  }, [])

  async function loadUser() {
    setLoading(true)
    const [uRes, pRes] = await Promise.all([
      fetch('/api/admin/users').then(r=>r.json()),
      fetch('/api/permissions?userId='+params.userId).then(r=>r.json()),
    ])
    const u = (uRes.users||[]).find((u:any) => u.id === params.userId)
    if (!u) { router.push('/admin/usuarios'); return }
    setUser(u)

    // Calcular permisos base del rol
    const base: Record<string, {can_view:boolean, can_edit:boolean}> = {}
    MODULES.forEach(m => {
      base[m] = { can_view: canView(u.role, m), can_edit: canEdit(u.role, m) }
    })
    setDefaults(base)

    // Cargar overrides existentes
    const ovMap: Record<string, {can_view:boolean, can_edit:boolean}> = {}
    ;(pRes.overrides||[]).forEach((o:UserPermOverride) => {
      ovMap[o.module] = { can_view: o.can_view, can_edit: o.can_edit }
    })
    setOverrides(ovMap)
    setLoading(false)
  }

  function getEffective(module: Module) {
    return overrides[module] ?? defaults[module] ?? { can_view: false, can_edit: false }
  }

  function hasOverride(module: Module) {
    return module in overrides
  }

  async function toggle(module: Module, field: 'can_view'|'can_edit') {
    setSaving(module+'.'+field)
    const current = getEffective(module)
    let newVal = { ...current, [field]: !current[field] }
    // Si desactivamos ver, también desactivar editar
    if (field === 'can_view' && !newVal.can_view) newVal.can_edit = false
    // Si activamos editar, también activar ver
    if (field === 'can_edit' && newVal.can_edit) newVal.can_view = true

    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: session!.id, userId: params.userId, module, ...newVal })
    })
    if (res.ok) {
      setOverrides(prev => ({ ...prev, [module]: newVal }))
      setMsg('Guardado')
      setTimeout(() => setMsg(''), 2000)
    }
    setSaving(null)
  }

  async function resetModule(module: Module) {
    setSaving(module+'.reset')
    await fetch('/api/permissions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: session!.id, userId: params.userId, module })
    })
    setOverrides(prev => { const n = {...prev}; delete n[module]; return n })
    setMsg('Restaurado a permisos del rol')
    setTimeout(() => setMsg(''), 2000)
    setSaving(null)
  }

  const badge = user ? roleBadge(user.role) : null
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const }
  const btnG: React.CSSProperties = { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 100px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/admin/usuarios')} style={{ ...btnG, padding: '6px 10px' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Permisos de {user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Rol base:
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: (badge?.color||'#888')+'22', color: badge?.color||'#888', borderRadius: 4, padding: '2px 7px' }}>
              {badge?.label?.toUpperCase() || user?.role}
            </span>
          </div>
        </div>
        {msg && <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600 }}>{msg}</span>}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Los permisos marcados con <span style={{ color: '#f59e0b', fontWeight: 700 }}>*</span> son personalizados para este usuario.
        Los demás son los permisos por defecto del rol.
      </div>

      {MODULES.map(mod => {
        const eff = getEffective(mod)
        const def = defaults[mod]
        const isOverridden = hasOverride(mod)
        const isSaving = saving?.startsWith(mod)

        return (
          <div key={mod} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
            border: isOverridden ? '1px solid #f59e0b44' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {MODULE_LABELS[mod]}
                  {isOverridden && <span style={{ color: '#f59e0b', marginLeft: 4 }}>*</span>}
                </span>
              </div>

              {/* Toggle Ver */}
              <button
                onClick={() => toggle(mod, 'can_view')}
                disabled={!!isSaving}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: eff.can_view ? '#E1F5EE' : '#F1EFE8',
                  color: eff.can_view ? '#0F6E56' : '#888',
                  opacity: isSaving ? 0.6 : 1 }}>
                {eff.can_view ? '✓ Ver' : '✕ Ver'}
              </button>

              {/* Toggle Editar */}
              <button
                onClick={() => toggle(mod, 'can_edit')}
                disabled={!!isSaving || !eff.can_view}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: eff.can_edit ? '#E6F1FB' : '#F1EFE8',
                  color: eff.can_edit ? '#185FA5' : '#888',
                  opacity: (isSaving || !eff.can_view) ? 0.4 : 1 }}>
                {eff.can_edit ? '✓ Editar' : '✕ Editar'}
              </button>

              {/* Reset a rol */}
              {isOverridden && (
                <button
                  onClick={() => resetModule(mod)}
                  disabled={!!isSaving}
                  title="Restaurar permisos del rol"
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #f59e0b44',
                    background: 'none', color: '#f59e0b', cursor: 'pointer', opacity: isSaving ? 0.4 : 1 }}>
                  ↺
                </button>
              )}
            </div>

            {/* Mostrar diferencia con el defecto */}
            {isOverridden && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Por defecto del rol: {def?.can_view ? 'Ve' : 'No ve'} · {def?.can_edit ? 'Edita' : 'No edita'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}