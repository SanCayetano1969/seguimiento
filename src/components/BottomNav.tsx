'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Role } from '@/lib/supabase'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

type Props = {
  role: Role
  unreadMessages?: number
  pendingRequests?: number
}

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconBook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  </svg>
)
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)

export default function BottomNav({ role, unreadMessages = 0, pendingRequests = 0 }: Props) {
  const router = useRouter()
  const path = usePathname()
  const [notifStatus, setNotifStatus] = useState<'default'|'granted'|'denied'|'no-support'>('default')

  useEffect(() => {
    if (!('Notification' in window)) { setNotifStatus('no-support'); return }
    setNotifStatus(Notification.permission as any)
  }, [])

  async function activarNotificaciones() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const userId = localStorage.getItem('sc_user_id')
    if (!userId) return
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const perm = await Notification.requestPermission()
    setNotifStatus(perm as any)
    if (perm !== 'granted') return
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId })
    })
  }

  // Dashboard home — depends on role
  const homeRoute = (role === 'admin' || role === 'coordinator') ? '/club' : '/dashboard'

  const items = [
    { icon: <IconHome />,     label: 'Inicio',     route: homeRoute,      show: true },
    { icon: <IconCalendar />, label: 'Agenda',     route: '/agenda',      show: true, badge: pendingRequests },
    { icon: <IconChat />,     label: 'Mensajes',   route: '/mensajeria',  show: true, badge: unreadMessages },
    { icon: <IconSearch />,   label: 'Ojeador',    route: '/ojeador',     show: true },
    { icon: <IconBook />,     label: 'Biblioteca', route: '/biblioteca',  show: true },
  ]

  return (
    <nav className="bottom-nav">
      {items.filter(i => i.show).map(item => (
        <button
          key={item.route}
          className={`nav-item ${path.startsWith(item.route) ? 'active' : ''}`}
          onClick={() => router.push(item.route)}
        >
          {item.icon}
          <span>{item.label}</span>
          {(item.badge ?? 0) > 0 && (
            <span className="nav-badge">{item.badge! > 9 ? '9+' : item.badge}</span>
          )}
        </button>
      ))}
      {notifStatus !== 'granted' && (
        <button className="nav-item" onClick={activarNotificaciones} style={{ color: '#f6ad55' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            <line x1="12" y1="2" x2="12" y2="1"/>
          </svg>
          <span>🔔 {notifStatus}</span>
        </button>
      )}
    </nav>
  )
}
