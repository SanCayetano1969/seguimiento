'use client'
import { useEffect, useState } from 'react'
import PushSubscriber from './PushSubscriber'

export default function PushInit() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const read = () => {
      const id = localStorage.getItem('sc_user_id')
      setUserId(id || null)
    }
    read()
    window.addEventListener('storage', read)
    // También polling por si el login es en la misma pestaña
    const interval = setInterval(read, 2000)
    return () => { window.removeEventListener('storage', read); clearInterval(interval) }
  }, [])

  if (!userId) return null
  return <PushSubscriber userId={userId} />
}
