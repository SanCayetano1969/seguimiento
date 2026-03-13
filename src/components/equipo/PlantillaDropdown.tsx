'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  players: any[]
  teamId: string
}

export default function PlantillaDropdown({ players, teamId }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const visible = open ? players : players.slice(0, 3)

  function goToPlayer(playerId: string) {
    router.push(`/equipo?team=${teamId}&player=${playerId}`)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            👥 Plantilla ({players.length} jugadores)
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {open ? '▲ cerrar' : '▼ ver todo'}
          </span>
        </div>
        {!open && (
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {players.slice(0, 3).map(p => (
              <span key={p.id} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)',
                borderRadius: 4, padding: '2px 6px' }}>
                #{p.dorsal} {p.name}
              </span>
            ))}
            {players.length > 3 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{players.length - 3} más</span>
            )}
          </div>
        )}
      </button>

      {open && (
        <div>
          {players.map(p => (
            <div
              key={p.id}
              onClick={() => goToPlayer(p.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', background: 'var(--surface)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  minWidth: 24, textAlign: 'right' }}>#{p.dorsal}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.position || 'Sin posición'}{p.birth_year ? ' · ' + p.birth_year : ''}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
