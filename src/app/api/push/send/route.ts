import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!
const VAPID_SUBJECT = process.env.VAPID_SUBJECT!

function base64urlToUint8Array(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function importPrivateKey(base64url: string) {
  const keyData = base64urlToUint8Array(base64url)
  return crypto.subtle.importKey('pkcs8', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function makeVapidToken(audience: string) {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT }
  const toB64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const unsigned = `${toB64(header)}.${toB64(payload)}`
  const key = await importPrivateKey(VAPID_PRIVATE)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${unsigned}.${sigB64}`
}

export async function POST(req: NextRequest) {
  const { userIds, title, body, url } = await req.json()

  let query = supabase.from('push_subscriptions').select('*')
  if (userIds && userIds.length > 0) query = query.in('user_id', userIds)
  const { data: subs } = await query
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const row of subs) {
    const sub = JSON.parse(row.subscription)
    const endpoint = sub.endpoint
    const origin = new URL(endpoint).origin
    const token = await makeVapidToken(origin)
    const authHeader = `vapid t=${token},k=${VAPID_PUBLIC}`

    const payload = JSON.stringify({ title, body, url: url || '/' })
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'TTL': '86400',
        },
        body: payload,
      })
      if (res.ok || res.status === 201) sent++
      else if (res.status === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
      }
    } catch {}
  }
  return NextResponse.json({ sent })
}
