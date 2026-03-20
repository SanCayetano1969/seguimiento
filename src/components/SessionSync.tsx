'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, setSession, clearSession } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

export default function SessionSync() {
  const router = useRouter()

  useEffect(() => {
    async function syncSession() {
      const session = getSession()
      if (!session?.id) return

      try {
        const { data: user, error } = await supabase
          .from('app_users')
          .select('id, name, username, role, active, avatar_url')
          .eq('id', session.id)
          .single()

        if (error || !user) return

        // Si el usuario fue desactivado, cerrar sesion
        if (!user.active) {
          clearSession()
          router.push('/')
          return
        }

        // Si el rol cambio, actualizar la sesion local
        if (user.role !== session.role || user.name !== session.name) {
          const updated = { ...session, role: user.role, name: user.name, avatar_url: user.avatar_url }
          setSession(updated, session.team_ids || [])
          // Recargar la pagina para aplicar el nuevo rol
          window.location.reload()
        }
      } catch(e) {
        // Silencioso si falla
      }
    }

    // Sincronizar al entrar
    syncSession()

    // Y cada 60 segundos
    const interval = setInterval(syncSession, 60000)
    return () => clearInterval(interval)
  }, [])

  return null
}