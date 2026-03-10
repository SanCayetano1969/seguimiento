import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function sendPush(endpoint: string, p256dh: string, auth: string, payload: string) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY!
  const vapidSubject = process.env.VAPID_SUBJECT!

  // Import keys
  const privateKeyData = urlBase64ToUint8Array(vapidPrivate.replace('MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg','').split('oRA')[0])
  
  const publicKey = await crypto.subtle.importKey(
    'raw', urlBase64ToUint8Array(vapidPublic),
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  )

  // Build VAPID JWT
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const claims = btoa(JSON.stringify({ aud: audience, exp, sub: vapidSubject })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const sigInput = `${header}.${claims}`

  // Parse VAPID private key (PKCS8)
  const pkcs8 = vapidPrivate
  let keyData: Uint8Array
  try {
    const b64 = pkcs8.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')
    keyData = urlBase64ToUint8Array(b64)
  } catch {
    keyData = urlBase64ToUint8Array(vapidPrivate)
  }

  const sigKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  ).catch(() => crypto.subtle.importKey(
    'raw', urlBase64ToUint8Array(vapidPrivate),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  ))

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    sigKey,
    new TextEncoder().encode(sigInput)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const jwt = `${sigInput}.${sigB64}`

  const vapidAuth = `vapid t=${jwt},k=${vapidPublic}`

  // Encrypt payload (simplified - send unencrypted for now to test)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapidAuth,
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: new TextEncoder().encode(payload)
  })

  return res.status
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, url } = await req.json()
    const payload = JSON.stringify({ title, body, url })

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!subs?.length) return NextResponse.json({ sent: 0, message: 'No subscriptions' })

    const results = await Promise.allSettled(
      subs.map(s => sendPush(s.endpoint, s.p256dh, s.auth, payload))
    )

    return NextResponse.json({ sent: results.filter(r => r.status === 'fulfilled').length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
