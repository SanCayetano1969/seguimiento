'use client'
import { useState } from 'react'
import ExportMenu from '@/components/ExportMenu'

interface Props {
  players: any[]
  teamId: string
  teamName?: string
  playerStats?: Record<string, any>   // player_id → { pj, min, gol, asi, amarillas, rojas, paradas } en los partidos del equipo
  invitados?: any[]                     // jugadores de otros equipos con estadísticas en partidos de este equipo (campo _equipo)
}

export default function PlantillaDropdown({ players, teamId, teamName = 'Equipo', playerStats = {}, invitados = [] }: Props) {
  const [open, setOpen] = useState(false)

  function goToPlayer(playerId: string) {
    window.location.href = '/equipo?team=' + teamId + '&player=' + playerId
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>
            Plantilla ({players.length} jugadores)
          </span>
          <div onClick={e => e.stopPropagation()}>
            <ExportMenu
              config={{
                title: teamName + ' — Plantilla',
                filename: 'plantilla_' + teamName.replace(/\s+/g,'_'),
                columns: [
                  { header: 'Dorsal', key: 'dorsal' },
                  { header: 'Nombre', key: 'nombre' },
                  { header: 'Posicion', key: 'posicion' },
                  { header: 'Pie', key: 'pie' },
                  { header: 'Año nacimiento', key: 'anyo' },
                ],
                rows: players.map(pl => ({
                  dorsal: pl.dorsal || '',
                  nombre: pl.name,
                  posicion: pl.position || '',
                  pie: pl.foot || '',
                  anyo: pl.birth_year || '',
                })),
                extraColumns: [
                  { header: 'PJ', key: 'pj' },
                  { header: 'MIN', key: 'min' },
                  { header: 'GOL', key: 'gol' },
                  { header: 'ASI', key: 'asi' },
                  { header: 'Amarillas', key: 'amarillas' },
                  { header: 'Rojas', key: 'rojas' },
                  { header: 'Paradas', key: 'paradas' },
                ],
                extraRows: [...players, ...invitados.filter(g => !players.some(p => p.id === g.id))].map(pl => {
                  const st = playerStats[pl.id] || {}
                  return {
                    dorsal: pl.dorsal || '',
                    nombre: pl.name + (pl._equipo ? ' (invitado · ' + pl._equipo + ')' : ''),
                    posicion: pl.position || '',
                    pie: pl.foot || '',
                    anyo: pl.birth_year || '',
                    pj: st.pj || 0,
                    min: st.min || 0,
                    gol: st.gol || 0,
                    asi: st.asi || 0,
                    amarillas: st.amarillas || 0,
                    rojas: st.rojas || 0,
                    paradas: st.paradas || 0,
                  }
                }),
              }}
              hasExtra={true}
              extraLabel="Con estadísticas"
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {open ? 'cerrar' : 'ver todo'}
          </span>
        </div>
        {!open && (
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {players.slice(0, 3).map(p => (
              <span key={p.id} style={{ fontSize: 11, color: 'var(--text-muted)',
                background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px' }}>
                #{p.dorsal} {p.name}
              </span>
            ))}
            {players.length > 3 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{players.length - 3} mas</span>
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
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                  minWidth: 28, textAlign: 'right' }}>#{p.dorsal}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {p.position || 'Sin posicion'}{p.birth_year ? ' · ' + p.birth_year : ''}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--accent)' }}>&rsaquo;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
