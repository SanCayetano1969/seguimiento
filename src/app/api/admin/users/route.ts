import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - listar usuarios
export async function GET() {
  const { data: users } = await supabase
    .from('app_users')
    .select('id, name, username, role, active, must_change_password, password_hash, created_at')
    .order('name')
  return NextResponse.json({ users: users || [] })
}

// POST - crear usuario
export async function POST(req: NextRequest) {
  try {
    const { adminId, name, role, tempPassword } = await req.json()
    const { data: admin } = await supabase.from('app_users').select('role').eq('id', adminId).single()
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Solo el administrador puede crear usuarios' }, { status: 403 })

    const username = name.toLowerCase().replace(/\s+/g, '')
    const { data: existing } = await supabase.from('app_users').select('id').eq('username', username).single()
    if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese nombre' }, { status: 400 })

    const { error } = await supabase.from('app_users').insert({
      name, username, role, active: true,
      temp_password: tempPassword,
      must_change_password: true,
      access_code: tempPassword,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH - activar/desactivar usuario
export async function PATCH(req: NextRequest) {
  try {
    const { adminId, userId, active } = await req.json()
    const { data: admin } = await supabase.from('app_users').select('role').eq('id', adminId).single()
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    await supabase.from('app_users').update({ active }).eq('id', userId)
    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}