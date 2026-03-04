import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CD San Cayetano — Cantera',
  description: 'Sistema de seguimiento de jugadores',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
