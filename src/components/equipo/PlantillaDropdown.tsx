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

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>
            👥 Plantilla <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>({players.length} jugadores)</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲ cerrar' : '▼ ver todo'}</span>
        </div>
        {!open && players.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {players.slice(0, 3).map(p => (
              <span key={p.id} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)',
                borderRadius: 4, padding: '2px 6px' }}>
                {p.dorsal ? '#' + p.dorsal + ' ' : ''}{p.name.split(' ')[0]}
              </span>
            ))}
            {players.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{players.length - 3} más</span>}
          </div>
        )}
      </button>

      {open && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {players.map((p, i) => (
            <div
              key={p.id}
              onClick={() => router.push('/equipo?team=' + teamId + '&player=' + p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                borderBottom: i < players.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--surface3)', flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                {p.photo_url
                  ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (p.dorsal || '?')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {p.position || 'Sin posición'}{p.birth_year ? ' · ' + p.birth_year : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
