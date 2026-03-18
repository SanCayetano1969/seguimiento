'use client'
import { useEffect, useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function SinInstalacionBanner() {
  const [eventos, setEventos] = useState<any[]>([])
  const [visible, setVisible] = useState(true)
  const pathname = usePathname()

  // No mostrar en login
  if (pathname === '/') return null

  useEffect(() => {
    const session = getSession()
    if (!session) return
    // Solo para entrenadores, coordinadores y admin
    const rolesQueVen = ['admin','coordinator','coach','secretario']
    if (!rolesQueVen.includes(session.role)) return

    async function check() {
      const hoy = new Date().toISOString().split('T')[0]
      // Eventos marcados sin instalacion a partir de hoy
      let query = supabase
        .from('events')
        .select('id, title, date, time, location, team_id, teams(name)')
        .eq('sin_instalacion', true)
        .gte('date', hoy)
        .order('date', { ascending: true })

      // Si es entrenador, filtrar solo su equipo
      if (session.role === 'coach' && session.team_id) {
        query = query.eq('team_id', session.team_id)
      }

      const { data } = await query
      setEventos(data || [])
    }

    check()
    // Refrescar cada 60 segundos
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [pathname])

  if (eventos.length === 0 || !visible) return null

  return (
    <>
      <style>{`
        @keyframes bannerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .sin-inst-banner {
          animation: bannerPulse 2s ease-in-out infinite;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: #dc2626;
          color: white;
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 2px 12px rgba(220,38,38,0.5);
        }
        .sin-inst-inner {
          max-width: 600px;
          margin: 0 auto;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sin-inst-icon {
          font-size: 18px;
          flex-shrink: 0;
          animation: bannerPulse 1s ease-in-out infinite;
        }
        .sin-inst-content {
          flex: 1;
          min-width: 0;
        }
        .sin-inst-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.9;
          margin-bottom: 2px;
        }
        .sin-inst-events {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sin-inst-event {
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sin-inst-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .sin-inst-close:hover {
          background: rgba(255,255,255,0.3);
        }
        /* Empujar el contenido de la pagina hacia abajo */
        .sin-inst-spacer {
          height: 56px;
        }
      `}</style>

      <div className="sin-inst-spacer" />
      <div className="sin-inst-banner">
        <div className="sin-inst-inner">
          <span className="sin-inst-icon">⚠️</span>
          <div className="sin-inst-content">
            <div className="sin-inst-title">
              {eventos.length === 1 ? '1 actividad sin instalación' : eventos.length + ' actividades sin instalación'}
            </div>
            <div className="sin-inst-events">
              {eventos.slice(0, 3).map(ev => (
                <div key={ev.id} className="sin-inst-event">
                  {(ev as any).teams?.name ? (ev as any).teams.name + ' — ' : ''}
                  {ev.title} · {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {ev.time ? ' ' + ev.time.slice(0,5) + 'h' : ''}
                </div>
              ))}
              {eventos.length > 3 && (
                <div className="sin-inst-event" style={{ opacity: 0.8 }}>
                  + {eventos.length - 3} más...
                </div>
              )}
            </div>
          </div>
          <button className="sin-inst-close" onClick={() => setVisible(false)} title="Cerrar aviso temporalmente">
            ×
          </button>
        </div>
      </div>
    </>
  )
}