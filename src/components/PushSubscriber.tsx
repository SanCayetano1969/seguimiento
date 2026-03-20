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
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return typeof window !== 'undefined' && ('standalone' in window.navigator) && (window.navigator as any).standalone === true
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
    return 'error:' + e.message
  }
}

export default function PushSubscriber({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string>('idle')
  const [iosNotInstalled, setIosNotInstalled] = useState(false)
  // Solo descarte por sesion (sessionStorage), NO localStorage
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('no-support'); return
    }

    // Ya descartado esta sesion
    if (sessionStorage.getItem('push_dismissed')) { setDismissed(true); return }

    // iOS sin instalar como PWA
    if (isIOS() && !isInStandaloneMode()) { setIosNotInstalled(true); return }

    // Si ya tiene permiso concedido, suscribir automaticamente
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      doSubscribe(userId).then(r => { if (r === 'ok') setStatus('granted') })
      return
    }
    // Si denegado, no mostrar
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setStatus('denied'); return
    }
  }, [userId])

  function dismiss() {
    sessionStorage.setItem('push_dismissed', '1')
    setDismissed(true)
  }

  async function handleActivate() {
    setStatus('checking')
    const result = await doSubscribe(userId)
    if (result === 'ok') setStatus('granted')
    else if (result === 'denied') setStatus('denied')
    else if (result === 'ios-not-installed') { setIosNotInstalled(true); setStatus('idle') }
    else setStatus('idle')
  }

  if (dismissed || status === 'granted' || status === 'no-support' || status === 'denied') return null

  // Banner iOS no instalada
  if (iosNotInstalled) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', border: '2px solid #3b82f6',
        borderRadius: 12, padding: '14px 16px',
        boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
        fontFamily: 'Arial, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>📱</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 6 }}>
              Activa las notificaciones en iPhone
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 }}>
              <b style={{ color: 'white' }}>1.</b> Pulsa <b style={{ color: 'white' }}>Compartir</b> 🔗 en Safari<br/>
              <b style={{ color: 'white' }}>2.</b> Toca <b style={{ color: '#93c5fd' }}>“Añadir a pantalla de inicio”</b><br/>
              <b style={{ color: 'white' }}>3.</b> Abre la app desde el icono<br/>
              <b style={{ color: 'white' }}>4.</b> Acepta las notificaciones cuando aparezca el aviso
            </div>
          </div>
          <button onClick={dismiss}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
            ×
          </button>
        </div>
      </div>
    )
  }

  // Banner activar notificaciones
  if (status === 'idle') {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', border: '2px solid #3b82f6',
        borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
        fontFamily: 'Arial, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Activa las notificaciones</div>
            <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>
              Recibe avisos de mensajes, tablón y alarmas
            </div>
          </div>
          <button onClick={handleActivate}
            style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            Activar
          </button>
          <button onClick={dismiss}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer', borderRadius: 6, padding: '2px 8px' }}>
            ×
          </button>
        </div>
      </div>
    )
  }

  if (status === 'checking') {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 998,
        background: '#1e3a5f', borderRadius: 12, padding: '12px 16px',
        fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#93c5fd',
        textAlign: 'center' as const, border: '2px solid #3b82f6'
      }}>
        Activando notificaciones...
      </div>
    )
  }

  return null
}