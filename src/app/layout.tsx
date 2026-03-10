'use client'
import type { Metadata } from 'next'
import './globals.css'
import PushSubscriber from '@/components/PushSubscriber'
import { getSession } from '@/lib/supabase'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = getSession()
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#070e1c" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <title>CD San Cayetano</title>
      </head>
      <body>
        {children}
        {session?.id && <PushSubscriber userId={session.id} />}
      </body>
    </html>
  )
}
