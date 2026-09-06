'use client'
// Selector de jugadores de otros equipos del club (misma categoria o inferior).
// Se usa tanto en Convocatorias como en la pantalla de Partido en directo.
import { useState } from 'react'
import { buscaTexto, equiposDelPool, type JugadorInvitado } from '@/lib/categorias'

interface Props {
  pool: JugadorInvitado[] | null      // candidatos ya cargados (null = aun cargando)
  loading: boolean
  excluir: string[]                   // ids ya convocados
  onPick: (p: JugadorInvitado) => void
  onClose: () => void
}

export default function PickerJugadores({ pool, loading, excluir, onPick, onClose }: Props) {
  const [buscar, setBuscar] = useState('')
  const [equipoSel, setEquipoSel] = useState<string>('')   // '' = todos

  const disponibles = (pool || []).filter(p => !excluir.includes(p.id))
  const equipos = equiposDelPool(disponibles)

  const q = buscaTexto(buscar)
  const filtrados = disponibles
    .filter(p => !equipoSel || p.team_id === equipoSel)
    .filter(p => !q || buscaTexto(p.name).includes(q) || buscaTexto(p.team_name).includes(q))

  // Agrupado por equipo, respetando el orden del pool (misma categoria primero)
  const grupos: { id: string; name: string; jugadores: JugadorInvitado[] }[] = []
  filtrados.forEach(p => {
    const g = grupos.find(x => x.id === p.team_id)
    if (g) g.jugadores.push(p)
    else grupos.push({ id: p.team_id, name: p.team_name, jugadores: [p] })
  })

  const chip = (activo: boolean) => ({
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
    border: '1px solid ' + (activo ? 'var(--gold)' : 'var(--border)'),
    background: activo ? 'var(--gold)' : 'var(--surface2)',
    color: activo ? '#0d1f3c' : 'var(--text-muted)',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,9,15,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 400 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, maxWidth: 480, width: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 18 }}>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Jugador de otro equipo</div>
          <button onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 19, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Equipos de tu misma categoría o inferior. Los de tu categoría salen primero.
        </div>

        {/* Filtro por equipo */}
        {equipos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
            <div style={chip(!equipoSel)} onClick={() => setEquipoSel('')}>Todos</div>
            {equipos.map(t => (
              <div key={t.id} style={chip(equipoSel === t.id)} onClick={() => setEquipoSel(equipoSel === t.id ? '' : t.id)}>
                {t.name} <span style={{ opacity: .7 }}>{t.n}</span>
              </div>
            ))}
          </div>
        )}

        <input className="input" placeholder="Buscar por nombre..." value={buscar}
          onChange={e => setBuscar(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 80 }}>
          {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Cargando jugadores…</div>}
          {!loading && !filtrados.length && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
              No hay jugadores disponibles con ese criterio.
            </div>
          )}
          {grupos.map(g => (
            <div key={g.id}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '10px 2px 6px' }}>
                {g.name} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>· {g.jugadores.length}</span>
              </div>
              {g.jugadores.map(p => (
                <div key={p.id} onClick={() => onPick(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)', marginBottom: 6, cursor: 'pointer' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 13, flexShrink: 0 }}>{p.dorsal ?? '·'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    {p.position && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.position}</div>}
                  </div>
                  <div style={{ marginLeft: 'auto', color: 'var(--gold)', fontWeight: 900, fontSize: 20 }}>+</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
