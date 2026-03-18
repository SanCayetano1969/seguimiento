'use client'
import { useEffect, useState } from 'react'
import { supabase, getSession } from '@/lib/supabase'

export default function SinInstalacionBanner() {
  const [eventos, setEventos] = useState<any[]>([])
  const [visible, setVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { setLoaded(true); return }
    const rolesQueVen = ['admin', 'coordinator', 'coach', 'secretario']
    if (!rolesQueVen.includes(session.role)) { setLoaded(true); return }

    async function check() {
      const hoy = new Date().toISOString().split('T')[0]
      let query = supabase
        .from('events')
        .select('id, title, date, time, location, team_id, teams(name)')
        .eq('sin_instalacion', true)
        .gte('date', hoy)
        .order('date', { ascending: true })

      if (session.role === 'coach' && (session as any).team_id) {
        query = query.eq('team_id', (session as any).team_id)
      }

      const { data } = await query
      setEventos(data || [])
      setLoaded(true)
    }

    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  // Reset visible cuando llegan nuevos eventos
  useEffect(() => {
    if (eventos.length > 0) setVisible(true)
  }, [eventos.length])

  if (!loaded || eventos.length === 0 || !visible) return null

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
              {eventos.length === 1
                ? 'Actividad sin instalación disponible'
                : eventos.length + ' actividades sin instalación disponible'}
            </div>
            {eventos.slice(0, 2).map(ev => (
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
            {eventos.length > 2 && (
              <div className="sin-inst-more">+ {eventos.length - 2} más...</div>
            )}
          </div>
          <button className="sin-inst-close" onClick={() => setVisible(false)}>
            ×
          </button>
        </div>
      </div>
    </>
  )
}