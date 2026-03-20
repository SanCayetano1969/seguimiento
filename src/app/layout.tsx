import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import SinInstalacionBanner from '@/components/SinInstalacionBanner'
import PushInit from '@/components/PushInit'
import SessionSync from '@/components/SessionSync'


export const metadata: Metadata = {
  title: 'CD San Cayetano',
  description: 'Sistema de Cantera — Club Deportivo San Cayetano',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'San Cayetano',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#070e1c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Suspense fallback={null}>
          <SinInstalacionBanner />
        </Suspense>
        <PushInit />
        <SessionSync />
        {children}

      </body>
    </html>
  )
}
