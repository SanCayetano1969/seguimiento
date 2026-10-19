'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, setSession, clearSession } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

// Roles cuya sesión depende de los equipos asignados en user_teams
const ROLES_CON_EQUIPOS = ['coach', 'psychologist']

function mismosIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

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

        // Equipos asignados: se releen de user_teams para que la sesión
        // guardada en el móvil no se quede con una lista vieja o vacía
        let teamIds: string[] = session.team_ids || []
        let equiposCambiados = false
        if (ROLES_CON_EQUIPOS.includes(user.role)) {
          const { data: ut, error: utError } = await supabase
            .from('user_teams')
            .select('team_id')
            .eq('user_id', user.id)
          if (!utError && ut) {
            const nuevos = ut.map((r: any) => r.team_id)
            if (!mismosIds(nuevos, teamIds)) {
              teamIds = nuevos
              equiposCambiados = true
            }
          }
        }

        // Si el rol, el nombre o los equipos cambiaron, actualizar la sesion local
        if (user.role !== session.role || user.name !== session.name || equiposCambiados) {
          const updated = { ...session, role: user.role, name: user.name, avatar_url: user.avatar_url, team_ids: teamIds }
          setSession(updated, teamIds)
          // Recargar la pagina para aplicar los cambios
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
