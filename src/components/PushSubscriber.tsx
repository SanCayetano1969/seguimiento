'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function doSubscribe(userId: string): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'no-support'
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
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
  return 'ok'
}

export default function PushSubscriber({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle'|'granted'|'denied'|'no-support'>('idle')

  useEffect(() => {
    if (!userId) return
    if (!('Notification' in window)) { setStatus('no-support'); return }
    if (Notification.permission === 'granted') {
      doSubscribe(userId).then(() => setStatus('granted'))
    } else if (Notification.permission === 'denied') {
      setStatus('denied')
    }
    // Si es 'default', esperamos gesto del usuario
  }, [userId])

  if (!userId) return null
  if (status === 'granted' || status === 'no-support') return null
  if (Notification.permission === 'granted') return null

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: '#1a2740', border: '1px solid #2a3f5f', borderRadius: '12px',
      padding: '12px 20px', zIndex: 9999, display: 'flex', alignItems: 'center',
      gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '320px', width: '90%'
    }}>
      <span style={{ fontSize: '22px' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Activar notificaciones</div>
        <div style={{ color: '#8a9bb5', fontSize: '11px' }}>Recibe avisos de la app</div>
      </div>
      <button
        onClick={async () => {
          const result = await doSubscribe(userId)
          setStatus(result as any)
        }}
        style={{
          background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
        }}
      >
        Activar
      </button>
      <button
        onClick={() => setStatus('denied')}
        style={{ background: 'transparent', border: 'none', color: '#8a9bb5', cursor: 'pointer', fontSize: '18px', padding: '0' }}
      >×</button>
    </div>
  )
}
