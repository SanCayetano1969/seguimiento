import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/permissions?userId=xxx  — obtener overrides de un usuario
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ overrides: [] })
  const { data } = await supabase
    .from('user_permissions')
    .select('module, can_view, can_edit')
    .eq('user_id', userId)
  return NextResponse.json({ overrides: data || [] })
}

// POST /api/permissions — guardar override (admin only)
export async function POST(req: NextRequest) {
  try {
    const { adminId, userId, module, can_view, can_edit } = await req.json()
    const { data: admin } = await supabase.from('app_users').select('role').eq('id', adminId).single()
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const { error } = await supabase
      .from('user_permissions')
      .upsert({ user_id: userId, module, can_view, can_edit }, { onConflict: 'user_id,module' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/permissions — eliminar override (volver a permisos de rol)
export async function DELETE(req: NextRequest) {
  try {
    const { adminId, userId, module } = await req.json()
    const { data: admin } = await supabase.from('app_users').select('role').eq('id', adminId).single()
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    await supabase.from('user_permissions').delete().eq('user_id', userId).eq('module', module)
    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}