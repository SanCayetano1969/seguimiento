'use client'
import { useState, useEffect } from 'react'
import { canView, canEdit, type Module, type UserPermOverride } from '@/lib/permissions'

export function usePermissions() {
  const [role, setRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [overrides, setOverrides] = useState<UserPermOverride[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Solo en el cliente - localStorage disponible
    try {
      const raw = localStorage.getItem('sc_session') || sessionStorage.getItem('sc_user')
      if (!raw) { setLoaded(true); return }
      const session = JSON.parse(raw)
      if (!session?.id || !session?.role) { setLoaded(true); return }
      setRole(session.role)
      setUserId(session.id)
      // Cargar overrides
      fetch('/api/permissions?userId=' + session.id)
        .then(r => r.json())
        .then(d => { setOverrides(d.overrides || []); setLoaded(true) })
        .catch(() => setLoaded(true))
    } catch {
      setLoaded(true)
    }
  }, [])

  return {
    loaded,
    role,
    userId,
    overrides,
    canView: (module: Module) => canView(role, module, overrides),
    canEdit: (module: Module) => canEdit(role, module, overrides),
  }
}