import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return Buffer.from(bits).toString('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword } = await req.json()
    if (!userId || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Contraseña mínimo 6 caracteres' }, { status: 400 })
    }

    // Generar salt único
    const salt = crypto.randomUUID()
    const hash = await hashPassword(newPassword, salt)
    const password_hash = salt + ':' + hash

    await supabase.from('app_users').update({
      password_hash,
      must_change_password: false,
      temp_password: null,  // eliminar contraseña temporal
    }).eq('id', userId)

    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Solo admin puede resetear contraseña de otro usuario
export async function PUT(req: NextRequest) {
  try {
    const { adminId, targetUserId, tempPassword } = await req.json()

    // Verificar que quien resetea es admin
    const { data: admin } = await supabase.from('app_users').select('role').eq('id', adminId).single()
    if (admin?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede resetear contraseñas' }, { status: 403 })
    }

    await supabase.from('app_users').update({
      temp_password: tempPassword,
      password_hash: null,
      must_change_password: true,
    }).eq('id', targetUserId)

    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}