'use client'
import { useState, useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(b64: string) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function isIOS() {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isPWA() {
  return typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

async function subscribePush(userId: string): Promise<'ok'|'denied'|'no-support'|'error'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'no-support'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    // Obtener o crear suscripcion
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      })
    }
    // Guardar en BD siempre (renovar por si cambio de dispositivo)
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId })
    })
    const data = await res.json()
    return data.ok ? 'ok' : 'error'
  } catch(e: any) {
    console.error('Push error:', e?.message)
    return 'error'
  }
}

export default function PushSubscriber({ userId }: { userId: string }) {
  const [state, setState] = useState<'idle'|'ok'|'denied'|'checking'|'no-support'|'ios-no-pwa'>('idle')

  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('no-support'); return
    }
    // iOS sin instalar como PWA
    if (isIOS() && !isPWA()) { setState('ios-no-pwa'); return }

    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default'

    if (perm === 'granted') {
      // Auto-suscribir silenciosamente en cada carga
      subscribePush(userId).then(r => setState(r === 'ok' ? 'ok' : 'idle'))
    } else if (perm === 'denied') {
      setState('denied')
    } else {
      // default: mostrar banner
      setState('idle')
    }
  }, [userId])

  // Banner iOS sin PWA
  if (state === 'ios-no-pwa') {
    return (
      <div style={{ position:'fixed', bottom:80, left:12, right:12, zIndex:9990,
        background:'#1e3a5f', border:'2px solid #3b82f6', borderRadius:12,
        padding:'14px 16px', boxShadow:'0 4px 24px rgba(59,130,246,0.4)',
        fontFamily:'Arial,sans-serif' }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:22, flexShrink:0 }}>📱</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'white', marginBottom:6 }}>
              Añade la app a tu iPhone
            </div>
            <div style={{ fontSize:12, color:'#cbd5e1', lineHeight:1.8 }}>
              Para recibir notificaciones:<br/>
              <b style={{ color:'white' }}>1.</b> Pulsa <b style={{ color:'white' }}>Compartir</b> en Safari 🔗<br/>
              <b style={{ color:'white' }}>2.</b> Toca <b style={{ color:'#93c5fd' }}>“Añadir a inicio”</b><br/>
              <b style={{ color:'white' }}>3.</b> Abre desde el icono y acepta
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Banner solicitar permiso
  if (state === 'idle') {
    return (
      <div style={{ position:'fixed', bottom:80, left:12, right:12, zIndex:9990,
        background:'#1e3a5f', border:'2px solid #3b82f6', borderRadius:12,
        padding:'12px 14px', boxShadow:'0 4px 24px rgba(59,130,246,0.4)',
        fontFamily:'Arial,sans-serif' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🔔</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'white' }}>Activa las notificaciones</div>
            <div style={{ fontSize:11, color:'#93c5fd', marginTop:2 }}>
              Mensajes, tablón, alarmas y más
            </div>
          </div>
          <button
            onClick={async () => { setState('checking'); const r = await subscribePush(userId); setState(r === 'ok' ? 'ok' : r) }}
            style={{ background:'#3b82f6', color:'white', border:'none', borderRadius:8,
              padding:'8px 14px', fontSize:13, fontWeight:800, cursor:'pointer',
              whiteSpace:'nowrap' as const, flexShrink:0 }}>
            Activar
          </button>
        </div>
      </div>
    )
  }

  if (state === 'checking') {
    return (
      <div style={{ position:'fixed', bottom:80, left:12, right:12, zIndex:9990,
        background:'#1e3a5f', border:'2px solid #3b82f6', borderRadius:12,
        padding:'12px 16px', fontFamily:'Arial,sans-serif',
        fontSize:13, color:'#93c5fd', textAlign:'center' as const }}>
        Activando...
      </div>
    )
  }

  return null
}