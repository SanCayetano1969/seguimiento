'use client'
import { useEffect, useState } from 'react'
import PushSubscriber from './PushSubscriber'

export default function PushInit() {
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const read = () => {
      // Leer de sc_session (nuevo login) o sc_user_id (legacy)
      try {
        const session = localStorage.getItem('sc_session')
        if (session) {
          const parsed = JSON.parse(session)
          if (parsed?.id) { setUserId(parsed.id); return }
        }
      } catch {}
      // Fallback al campo antiguo
      setUserId(localStorage.getItem('sc_user_id') || '')
    }
    read()
    window.addEventListener('sc_login', read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener('sc_login', read)
      window.removeEventListener('storage', read)
    }
  }, [])

  if (!userId) return null
  return <PushSubscriber userId={userId} />
}