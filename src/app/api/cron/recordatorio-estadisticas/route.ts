import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Obtener todos los entrenadores activos
    const { data: coaches } = await supabase
      .from('app_users')
      .select('id')
      .eq('role', 'coach')
      .eq('active', true)

    if (!coaches?.length) return NextResponse.json({ ok: true, sent: 0 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seguimiento-bice.vercel.app'
    let sent = 0

    for (const coach of coaches) {
      try {
        const res = await fetch(`${baseUrl}/api/push/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toUserId: coach.id,
            fromName: 'CD San Cayetano',
            body: '⚽ ¡Recuerda registrar el resultado y las estadísticas del partido de este fin de semana!'
          })
        })
        if (res.ok) sent++
      } catch (e) {
        console.error('push error coach', coach.id, e)
      }
    }

    return NextResponse.json({ ok: true, sent, total: coaches.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
