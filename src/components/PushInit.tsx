'use client'
import { useEffect, useState } from 'react'
import PushSubscriber from './PushSubscriber'

export default function PushInit() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sc_user')
    if (stored) {
      try {
        const user = JSON.parse(stored)
        if (user?.id) setUserId(user.id)
      } catch {}
    }
    // Escuchar cambios de sesión (login/logout)
    const handler = () => {
      const s = localStorage.getItem('sc_user')
      if (s) {
        try { setUserId(JSON.parse(s)?.id || null) } catch { setUserId(null) }
      } else {
        setUserId(null)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  if (!userId) return null
  return <PushSubscriber userId={userId} />
}
