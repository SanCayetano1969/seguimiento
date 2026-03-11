'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, setSession } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('sc_access_code')
    if (saved) { doLogin(saved) } else { setLoading(false) }
  }, [])

  async function doLogin(trimmed: string) {
    const { data: user, error: err } = await supabase
      .from('app_users').select('*')
      .eq('access_code', trimmed).eq('active', true).single()

    if (err || !user) {
      localStorage.removeItem('sc_access_code')
      setError('Codigo incorrecto. Consulta con el coordinador.')
      setLoading(false)
      return
    }

    let team_ids: string[] = []
    if (user.role === 'coach') {
      const { data: ut } = await supabase.from('user_teams').select('team_id').eq('user_id', user.id)
      team_ids = (ut || []).map((r: any) => r.team_id)
    }

    setSession(user, team_ids)
    localStorage.setItem('sc_access_code', trimmed)
    if (user?.id) localStorage.setItem('sc_user_id', user.id)

    if (['admin', 'coordinator'].includes(user.role)) { router.push('/club') }
    else { router.push('/dashboard') }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const trimmed = code.trim().toLowerCase()
    if (!trimmed) { setError('Introduce tu codigo de acceso'); setLoading(false); return }
    await doLogin(trimmed)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="loader animate-spin" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.bg} />
      <div style={s.card} className="animate-fade-up">
        <div style={s.logoRow}>
          <div style={s.logoBadge}>
            <img src="/escudo.jpeg" alt="Escudo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 28, letterSpacing: 3, color: 'var(--text)' }}>CD San Cayetano</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 3, textTransform: 'uppercase' }}>Sistema de Cantera</div>
          </div>
        </div>
        <div style={s.divider} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
          Introduce tu codigo de acceso para continuar
        </p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <span style={s.icon}>&#128273;</span>
            <input className="input" type="text" placeholder="Codigo de acceso" value={code}
              onChange={e => setCode(e.target.value)}
              style={{ paddingLeft: 40, fontSize: 16 }}
              autoFocus autoComplete="off" autoCapitalize="none" />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <button className="btn btn-gold btn-full" type="submit" disabled={loading}
            style={{ marginTop: 4, padding: '14px', fontSize: 15, fontWeight: 700 }}>
            {loading ? <span className="loader animate-spin" style={{ width: 18, height: 18 }} /> : 'Entrar'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
          v2.0 - Temporada 2024/25
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', position: 'relative', overflow: 'hidden' },
  bg: { position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,107,0.5) 0%, transparent 70%)', pointerEvents: 'none' },
  card: { position: 'relative', zIndex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '32px 24px', width: '100%', maxWidth: 380, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  logoBadge: { width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--border-gold)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)' },
  divider: { height: 1, background: 'var(--border)', marginBottom: 20 },
  icon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, zIndex: 1 },
  errorBox: { background: 'var(--red-dim)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: '10px 12px', color: 'var(--red)', fontSize: 13 },
}
