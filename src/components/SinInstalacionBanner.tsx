'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase, getSession } from '@/lib/supabase'

// El cartel solo sale en las pantallas de inicio y en la agenda (no al entrar en jugadores, evaluaciones…)
const RUTAS_CON_CARTEL = ['/dashboard', '/club', '/agenda']
// Al cerrarlo se recuerdan los avisos vistos: no vuelve a salir hasta que haya uno nuevo
const CLAVE_CERRADOS = 'sc_sininst_cerrados'

// Coordinadores y admin: a 2 días o menos, si sigue sin resolver, el cartel es FIJO
// (sale en todas las pantallas y no se puede cerrar). Se resuelve en Agenda con «✅ Restaurar».
const ROLES_FIJO = ['admin', 'coordinator']
const DIAS_FIJO = 2

function fechaMadrid(offsetDias = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + offsetDias * 86400000))
}

function leerCerrados(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAVE_CERRADOS) || '[]') } catch { return [] }
}

export default function SinInstalacionBanner() {
  const [eventos, setEventos] = useState<any[]>([])
  const [cerrados, setCerrados] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [rol, setRol] = useState<string>('')
  const pathname = usePathname()

  useEffect(() => {
    const session = getSession()
    if (!session) { setLoaded(true); return }
    const rolesQueVen = ['admin', 'coordinator', 'coach', 'secretario']
    if (!rolesQueVen.includes(session.role)) { setLoaded(true); return }

    setCerrados(leerCerrados())
    setRol(session.role)

    async function check() {
      const hoy = fechaMadrid()
      // Solo los próximos 7 días (si no, el cartel saldría todo el año con las reservas ya conocidas)
      const en7 = fechaMadrid(7)
      let query = supabase
        .from('events')
        .select('id, title, date, time, location, team_id, teams(name)')
        .eq('sin_instalacion', true)
        .gte('date', hoy)
        .lte('date', en7)
        .order('date', { ascending: true })

      // Los entrenadores solo ven los avisos de sus equipos
      if (session?.role === 'coach') {
        const ids: string[] = (session as any).team_ids || []
        if (!ids.length) { setEventos([]); setLoaded(true); return }
        query = query.in('team_id', ids)
      }

      const { data } = await query
      setEventos(data || [])
      setLoaded(true)
    }

    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  const limiteFijo = fechaMadrid(DIAS_FIJO)
  const urgentes = ROLES_FIJO.includes(rol) ? eventos.filter(e => e.date <= limiteFijo) : []
  const fijo = urgentes.length > 0
  const enRuta = RUTAS_CON_CARTEL.some(r => pathname === r || pathname?.startsWith(r + '/'))
  // Si hay urgentes: se muestran esos, en todas las pantallas y sin poder cerrar.
  // Si no: los avisos no cerrados, solo en Inicio y Agenda.
  const pendientes = fijo ? urgentes : eventos.filter(e => !cerrados.includes(e.id))

  function cerrar() {
    // se guardan solo los avisos que siguen vigentes, para que la lista no crezca sin fin
    const nuevos = Array.from(new Set([...cerrados.filter(id => eventos.some(e => e.id === id)), ...eventos.map(e => e.id)]))
    try { localStorage.setItem(CLAVE_CERRADOS, JSON.stringify(nuevos)) } catch {}
    setCerrados(nuevos)
  }

  if (!loaded || pendientes.length === 0 || (!fijo && !enRuta)) return null

  return (
    <>
      <style>{`
        @keyframes bannerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .sin-inst-banner {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 9999;
          background: #dc2626;
          color: white;
          font-family: Arial, sans-serif;
          animation: bannerPulse 2s ease-in-out infinite;
          box-shadow: 0 3px 16px rgba(220,38,38,0.6);
        }
        .sin-inst-inner {
          max-width: 640px;
          margin: 0 auto;
          padding: 8px 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .sin-inst-icon {
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .sin-inst-content { flex: 1; min-width: 0; }
        .sin-inst-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          opacity: 0.9;
          margin-bottom: 3px;
        }
        .sin-inst-event {
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.5;
        }
        .sin-inst-more {
          font-size: 11px;
          opacity: 0.75;
          margin-top: 1px;
        }
        .sin-inst-close {
          background: rgba(255,255,255,0.25);
          border: none;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .sin-inst-close:hover { background: rgba(255,255,255,0.4); }
        .sin-inst-spacer { height: 60px; }
      `}</style>
      <div className="sin-inst-spacer" />
      <div className="sin-inst-banner">
        <div className="sin-inst-inner">
          <span className="sin-inst-icon">⚠️</span>
          <div className="sin-inst-content">
            <div className="sin-inst-title">
              {fijo ? '🔴 Sin resolver · ' : ''}
              {pendientes.length === 1
                ? 'Actividad sin instalación disponible'
                : pendientes.length + ' actividades sin instalación disponible'}
            </div>
            {pendientes.slice(0, 2).map(ev => (
              <div key={ev.id} className="sin-inst-event">
                {(ev as any).teams?.name ? '● ' + (ev as any).teams.name + ' — ' : '● '}
                {ev.title}
                {' · '}
                {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-ES', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })}
                {ev.time ? ' ' + ev.time.slice(0, 5) + 'h' : ''}
              </div>
            ))}
            {pendientes.length > 2 && (
              <div className="sin-inst-more">+ {pendientes.length - 2} más...</div>
            )}
            {fijo && (
              <a href="/agenda" className="sin-inst-more" style={{ color: 'white', textDecoration: 'underline', display: 'inline-block', marginTop: 2 }}>
                Resolver en Agenda («✅ Restaurar») →
              </a>
            )}
          </div>
          {!fijo && (
            <button className="sin-inst-close" onClick={cerrar} title="Cerrar (no volverá a salir hasta que haya un aviso nuevo)">
              ×
            </button>
          )}
        </div>
      </div>
    </>
  )
}
