'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, setSession } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)

  // Cambio de contraseña
  const [mustChange, setMustChange] = useState(false)
  const [pendingUser, setPendingUser] = useState<any>(null)
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [changingPass, setChangingPass] = useState(false)
  const [changeError, setChangeError] = useState('')

  useEffect(() => {
    // Intentar auto-login si hay sesión guardada
    const saved = localStorage.getItem('sc_session')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        if (s?.id && s?.role) {
          setSession(s, s.team_ids || [])
          redirectUser(s.role)
          return
        }
      } catch {}
    }
    setLoading(false)
  }, [])

  function redirectUser(role: string) {
    if (role === 'coordinator' || role === 'admin' || role === 'secretario' || role === 'ejecutivo') {
      router.push('/club')
    } else if (role === 'coach' || role === 'psychologist') {
      router.push('/dashboard')
    } else if (role === 'scout') {
      router.push('/ojeador')
    } else {
      router.push('/dashboard')
    }
  }

  async function doLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Introduce usuario y contraseña')
      return
    }
    setLoggingIn(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        setLoggingIn(false)
        return
      }

      const user = data.user

      // Si debe cambiar la contraseña
      if (user.must_change_password) {
        setPendingUser(user)
        setMustChange(true)
        setLoggingIn(false)
        return
      }

      await completeLogin(user)
    } catch(e) {
      setError('Error de conexión')
      setLoggingIn(false)
    }
  }

  async function completeLogin(user: any) {
    let team_ids: string[] = []
    if (user.role === 'coach') {
      const { data: ut } = await supabase.from('user_teams').select('team_id').eq('user_id', user.id)
      team_ids = (ut || []).map((r: any) => r.team_id)
    }

    const sessionData = { ...user, team_ids }
    setSession(sessionData, team_ids)
    localStorage.setItem('sc_session', JSON.stringify(sessionData))
    // Limpiar el access_code antiguo
    localStorage.removeItem('sc_access_code')

    window.dispatchEvent(new Event('sc_login'))
    redirectUser(user.role)
  }

  async function handleChangePassword() {
    setChangeError('')
    if (newPass.length < 6) { setChangeError('Mínimo 6 caracteres'); return }
    if (newPass !== newPass2) { setChangeError('Las contraseñas no coinciden'); return }

    setChangingPass(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUser.id, newPassword: newPass })
      })
      if (!res.ok) {
        const d = await res.json()
        setChangeError(d.error || 'Error al cambiar contraseña')
        setChangingPass(false)
        return
      }
      // Login completado
      await completeLogin(pendingUser)
    } catch(e) {
      setChangeError('Error de conexión')
      setChangingPass(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando...</div>
      </div>
    )
  }

  // PANTALLA CAMBIO DE CONTRASEÑA
  if (mustChange && pendingUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/escudo.jpeg" alt="CD San Cayetano" style={{ width: 70, height: 70, borderRadius: '50%', marginBottom: 12 }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Hola, {pendingUser.name}</div>
            <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
              🔒 Crea tu contraseña personal
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              Es tu primera entrada. Por seguridad debes<br/>establecer una contraseña propia.
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '24px 20px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                NUEVA CONTRASEÑA
              </label>
              <input
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                CONFIRMAR CONTRASEÑA
              </label>
              <input
                type="password"
                value={newPass2}
                onChange={e => setNewPass2(e.target.value)}
                placeholder="Repite la contraseña"
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {changeError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
                {changeError}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={changingPass}
              style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: changingPass ? 'not-allowed' : 'pointer', opacity: changingPass ? 0.7 : 1 }}
            >
              {changingPass ? 'Guardando...' : 'Guardar y entrar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PANTALLA LOGIN NORMAL
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/escudo.jpeg" alt="CD San Cayetano" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} />
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>CD San Cayetano</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Sistema de Gestión de Cantera</div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '24px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              USUARIO
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              autoComplete="username"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              CONTRASEÑA
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && doLogin()}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            onClick={doLogin}
            disabled={loggingIn}
            style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: loggingIn ? 'not-allowed' : 'pointer', opacity: loggingIn ? 0.7 : 1 }}
          >
            {loggingIn ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          ¿Problemas para acceder? Contacta con el administrador.
        </div>
      </div>
    </div>
  )
}