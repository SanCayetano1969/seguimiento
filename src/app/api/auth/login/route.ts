import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Hash PBKDF2 - mismo algoritmo que change-password
// Salt es texto plano (UUID), se pasa como string a PBKDF2
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
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
    }

    const { data: user } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('active', true)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    let authenticated = false

    // Caso 1: tiene password_hash con formato salt:hash (PBKDF2)
    if (user.password_hash) {
      const colonIdx = user.password_hash.indexOf(':')
      if (colonIdx > -1) {
        const salt = user.password_hash.substring(0, colonIdx)
        const storedHash = user.password_hash.substring(colonIdx + 1)
        const computed = await hashPassword(password, salt)
        authenticated = computed === storedHash
      }
    }

    // Caso 2: contraseña temporal (texto plano)
    if (!authenticated && user.temp_password) {
      authenticated = password === user.temp_password
    }

    if (!authenticated) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        avatar_url: user.avatar_url,
        must_change_password: !!(user.must_change_password || !user.password_hash),
      }
    })
  } catch(e: any) {
    console.error('login error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}