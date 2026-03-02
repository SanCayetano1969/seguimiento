'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const trimmed = code.trim().toLowerCase()

    // Admin / coordinador
    if (trimmed === (process.env.NEXT_PUBLIC_ADMIN_CODE || 'sancayetano2526')) {
      sessionStorage.setItem('role', 'admin')
      router.push('/club')
      return
    }

    // Entrenador — busca el equipo por access_code
    const { data, error: err } = await supabase
      .from('teams')
      .select('id, name, category')
      .eq('access_code', trimmed)
      .single()

    if (err || !data) {
      setError('Código incorrecto. Comprueba con el coordinador.')
      setLoading(false)
      return
    }

    sessionStorage.setItem('role', 'coach')
    sessionStorage.setItem('team_id', data.id)
    sessionStorage.setItem('team_name', data.name)
    router.push('/equipo')
  }

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />

      <div style={styles.card} className="animate-fade-up">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.badge}>⚽</div>
          <div>
            <div className="font-display" style={{ fontSize: 32, letterSpacing: 3 }}>
              CD San Cayetano
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 4, textTransform: 'uppercase', marginTop: 2 }}>
              Sistema de Cantera
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        <p style={styles.subtitle}>
          Introduce tu código de acceso para continuar.
        </p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔑</span>
            <input
              type="text"
              placeholder="Código de equipo o coordinador"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={styles.input}
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <button type="submit" disabled={!code || loading} style={styles.btn}>
            {loading ? 'Verificando...' : 'ENTRAR'}
          </button>
        </form>

        <div style={styles.hint}>
          <div style={styles.hintRow}>
            <span style={styles.pill}>👔 Entrenadores</span>
            usa el código de tu equipo
          </div>
          <div style={styles.hintRow}>
            <span style={styles.pill}>🏆 Coordinador</span>
            accede al dashboard del club
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        Temporada 2025/26 · CD San Cayetano
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    background: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(13,43,94,0.5) 0%, transparent 70%)',
  },
  grid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '60px 60px',
    maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderTop: '2px solid var(--gold)',
    borderRadius: 20,
    padding: '48px 44px',
    width: '100%',
    maxWidth: 440,
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  badge: {
    width: 56,
    height: 56,
    background: 'var(--navy)',
    border: '2px solid var(--gold)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 24,
    lineHeight: 1.6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 16,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '13px 16px 13px 42px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    background: 'rgba(229,62,62,0.1)',
    border: '1px solid rgba(229,62,62,0.3)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#fc8181',
  },
  btn: {
    background: 'linear-gradient(135deg, var(--gold) 0%, #d4960f 100%)',
    color: 'var(--navy-dark)',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: 3,
    transition: 'all 0.2s',
    marginTop: 4,
  },
  hint: {
    marginTop: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  hintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  pill: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 11,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  footer: {
    marginTop: 32,
    fontSize: 12,
    color: 'var(--text-muted)',
    position: 'relative',
    zIndex: 1,
    letterSpacing: 1,
  },
}
