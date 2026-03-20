'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, roleBadge } from '@/lib/supabase'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coordinator', label: 'Coordinador' },
  { value: 'coach', label: 'Entrenador' },
  { value: 'scout', label: 'Ojeador' },
  { value: 'psychologist', label: 'Psicólogo' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
]

export default function AdminUsuariosPage() {
  const router = useRouter()
  const session = getSession()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', role: 'coach', tempPassword: '' })
  const [saving, setSaving] = useState(false)
  const [resetUserId, setResetUserId] = useState<string|null>(null)
  const [resetPass, setResetPass] = useState('')
  const [resetting, setResetting] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingRoleId, setEditingRoleId] = useState<string|null>(null)

  useEffect(() => {
    if (!session || session.role !== 'admin') { router.push('/club'); return }
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  async function createUser() {
    if (!newForm.name.trim() || !newForm.tempPassword.trim()) { setMsg('Nombre y contraseña temporal son obligatorios'); return }
    setSaving(true)
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, adminId: session!.id }) })
    const data = await res.json()
    if (data.ok) { setMsg('Usuario creado'); setNewForm({ name: '', role: 'coach', tempPassword: '' }); setShowNew(false); loadUsers() }
    else setMsg(data.error || 'Error al crear usuario')
    setSaving(false)
  }

  async function resetPassword() {
    if (!resetPass.trim() || resetPass.length < 4) { setMsg('Mínimo 4 caracteres'); return }
    setResetting(true)
    const res = await fetch('/api/auth/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: session!.id, targetUserId: resetUserId, tempPassword: resetPass }) })
    const data = await res.json()
    if (data.ok) { setMsg('Contraseña reseteada. El usuario deberá cambiarla en su próximo acceso.'); setResetUserId(null); setResetPass(''); loadUsers() }
    else setMsg(data.error || 'Error al resetear')
    setResetting(false)
  }

  async function changeRole(userId: string, newRole: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole, adminId: session!.id })
    })
    setEditingRoleId(null)
    setMsg('Rol actualizado')
    loadUsers()
  }

  async function toggleActive(userId: string, active: boolean) {
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, active: !active, adminId: session!.id }) })
    loadUsers()
  }

  const card: React.CSSProperties = { background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const }
  const btnP: React.CSSProperties = { background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }
  const btnD: React.CSSProperties = { background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }
  const btnG: React.CSSProperties = { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12 }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push('/club')} style={{ ...btnG, padding: '6px 10px' }}>←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>👥 Gestión de Usuarios</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{users.length} usuarios registrados</div>
        </div>
        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <button onClick={() => router.push('/admin/permisos')} style={{ ...btnG }}>
            🛡️ Permisos
          </button>
          <button onClick={() => setShowNew(true)} style={btnP}>+ Nuevo</button>
        </div>
      </div>
      {msg && (
        <div style={{ background: msg.includes('Error') || msg.includes('obligatorio') ? '#fee2e2' : '#d1fae5',
          color: msg.includes('Error') || msg.includes('obligatorio') ? '#dc2626' : '#065f46',
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}
          onClick={() => setMsg('')}>{msg}</div>
      )}
      {showNew && (
        <div style={{ ...card, border: '1px solid var(--accent)', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Nuevo usuario</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>NOMBRE</label>
              <input style={inp} placeholder="Nombre completo" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ROL</label>
              <select style={inp} value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            <div><label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CONTRASEÑA TEMPORAL</label>
              <input style={inp} placeholder="Ej: Borja2526" value={newForm.tempPassword} onChange={e => setNewForm(f => ({ ...f, tempPassword: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>El usuario deberá cambiarla en su primera entrada</div></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={btnG}>Cancelar</button>
              <button onClick={createUser} disabled={saving} style={btnP}>{saving ? 'Creando...' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Cargando...</div> : (
        users.map(u => {
          const badge = roleBadge(u.role)
          const isResetting = resetUserId === u.id
          const needsChange = u.must_change_password || !u.password_hash
          return (
            <div key={u.id} style={{ ...card, opacity: u.active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: (badge?.color || '#888') + '33',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: badge?.color || '#888', flexShrink: 0 }}>
                  {u.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{u.name}</span>
                    {!u.active && <span style={{ fontSize: 10, background: '#6b7280', color: 'white', borderRadius: 4, padding: '1px 5px' }}>INACTIVO</span>}
                    {needsChange && <span style={{ fontSize: 10, background: '#f59e0b', color: 'white', borderRadius: 4, padding: '1px 5px' }}>⏳ TEMPORAL</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</div>
                </div>
                {editingRoleId === u.id ? (
                  <select
                    value={u.role}
                    autoFocus
                    onChange={e => changeRole(u.id, e.target.value)}
                    onBlur={() => setEditingRoleId(null)}
                    style={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--surface2)', color: 'var(--text)', padding: '3px 6px' }}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                ) : (
                  <span
                    onClick={() => setEditingRoleId(u.id)}
                    title="Pulsa para cambiar rol"
                    style={{ fontSize: 10, fontWeight: 700, background: (badge?.color || '#888') + '22', color: badge?.color || '#888', borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap' as const, cursor: 'pointer' }}>
                    {badge?.label?.toUpperCase() || u.role.toUpperCase()} ✎
                  </span>
                )}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setResetUserId(isResetting ? null : u.id); setResetPass('') }} style={btnG}>🔑</button>
                  <button onClick={() => toggleActive(u.id, u.active)} style={u.active ? btnD : { ...btnG, background: '#059669', color: 'white', border: 'none' }}>
                    {u.active ? '🚫' : '✅'}</button>
                  <button onClick={() => router.push('/admin/usuarios/'+u.id+'/permisos')}
                    style={{ ...btnG, padding: '6px 8px', fontSize: 11 }} title="Gestionar permisos">
                    🛡️
                  </button>
                </div>
              </div>
              {isResetting && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inp, flex: 1 }} placeholder="Nueva contraseña temporal" value={resetPass} onChange={e => setResetPass(e.target.value)} />
                  <button onClick={resetPassword} disabled={resetting} style={btnP}>{resetting ? '...' : 'Resetear'}</button>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}