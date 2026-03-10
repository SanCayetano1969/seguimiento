'use client'
import { useEffect, useState } from 'react'
import PushSubscriber from './PushSubscriber'

export default function PushInit() {
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const read = () => {
      setUserId(localStorage.getItem('sc_user_id') || '')
    }
    read()
    // Escuchar login en la misma pestaña via custom event
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
