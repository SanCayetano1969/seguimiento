'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return ('standalone' in window.navigator) && (window.navigator as any).standalone === true
}

async function doSubscribe(userId: string): Promise<string> {
  if (!('serviceWorker' in navigator)) return 'no-sw'
  if (!('PushManager' in window)) return 'no-push'
  if (isIOS() && !isInStandaloneMode()) return 'ios-not-installed'

  try {
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
  } catch(e: any) {
    console.error('Push subscribe error:', e)
    return 'error:' + e.message
  }
}

export default function PushSubscriber({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string>('idle')
  const [iosNotInstalled, setIosNotInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!userId || dismissed) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('no-support'); return
    }
    if (isIOS() && !isInStandaloneMode()) {
      setIosNotInstalled(true); return
    }
    // Auto-suscribir si ya tiene permiso concedido
    if (Notification.permission === 'granted') {
      doSubscribe(userId).then(r => setStatus(r === 'ok' ? 'granted' : 'error'))
    }
  }, [userId])

  async function handleActivate() {
    setStatus('checking')
    const result = await doSubscribe(userId)
    if (result === 'ok') setStatus('granted')
    else if (result === 'denied') setStatus('denied')
    else if (result === 'ios-not-installed') setIosNotInstalled(true)
    else setStatus(result)
  }

  if (dismissed || status === 'granted' || status === 'no-support') return null

  // iOS no instalada: instrucciones de instalacion
  if (iosNotInstalled) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', border: '1px solid #3b82f6',
        borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'Arial, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>📱</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>
              Activa las notificaciones en iPhone
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
              1. Pulsa <b style={{ color: 'white' }}>Compartir</b> 🔗 en Safari<br/>
              2. Toca <b style={{ color: 'white' }}>&quot;Añadir a pantalla de inicio&quot;</b><br/>
              3. Abre la app desde el icono y acepta notificaciones
            </div>
          </div>
          <button onClick={() => { setIosNotInstalled(false); setDismissed(true) }}
            style={{ background: 'none', border: 'none', color: '#93c5fd', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
            ×
          </button>
        </div>
      </div>
    )
  }

  // Mostrar boton activar si permiso no concedido aun
  if (status === 'idle' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', border: '1px solid #3b82f6',
        borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'Arial, sans-serif',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        <div style={{ flex: 1, fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
          Activa las notificaciones para recibir avisos importantes
        </div>
        <button onClick={handleActivate}
          style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
          Activar
        </button>
        <button onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', padding: '0 2px' }}>
          ×
        </button>
      </div>
    )
  }

  if (status === 'checking') {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', borderRadius: 12, padding: '10px 14px',
        fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#93c5fd', textAlign: 'center' as const
      }}>
        Activando notificaciones...
      </div>
    )
  }

  return null
}