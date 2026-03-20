'use client'
import { useState, useEffect } from 'react'
import { getSession } from '@/lib/supabase'
import { canView, canEdit, type Module, type UserPermOverride } from '@/lib/permissions'

export function usePermissions() {
  const session = getSession()
  const [overrides, setOverrides] = useState<UserPermOverride[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!session?.id) { setLoaded(true); return }
    fetch('/api/permissions?userId=' + session.id)
      .then(r => r.json())
      .then(d => { setOverrides(d.overrides || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [session?.id])

  const role = session?.role || ''

  return {
    loaded,
    role,
    overrides,
    canView: (module: Module) => canView(role, module, overrides),
    canEdit: (module: Module) => canEdit(role, module, overrides),
    session,
  }
}