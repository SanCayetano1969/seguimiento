'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { canEdit as getCanEdit } from '@/lib/permissions'
import ExportMenu from '@/components/ExportMenu'

const TEMPORADA = '2025-26'
const COBRADORES = ['Borja', 'Victor', 'Rosa', 'Margot']
const ROLES_PERMITIDOS = ['admin', 'coordinator', 'secretario', 'ejecutivo']

export default function TesoreriaPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const canEditTeso = getCanEdit(session?.role || '', 'tesoreria')
  const [tab, setTab] = useState<'fichas'|'patrocinadores'|'torneos'>('fichas')
  const [teams, setTeams] = useState<any[]>([])
  const [teamFees, setTeamFees] = useState<Record<string,number>>({})
  const [players, setPlayers] = useState<Record<string,any[]>>({})
  const [plans, setPlans] = useState<Record<string,any>>({})
  const [payments, setPayments] = useState<Record<string,any[]>>({})
  const [loading, setLoading] = useState(true)
  const [sponsors, setSponsors] = useState<any[]>([])
  const [sponsorPayments, setSponsorPayments] = useState<Record<string,any[]>>({})
  const [selectedSponsor, setSelectedSponsor] = useState<any>(null)
  const [showNewSponsor, setShowNewSponsor] = useState(false)
  const [newSponsor, setNewSponsor] = useState({ nombre: '', cantidad_comprometida: '', notas: '' })
  const [savingNewSponsor, setSavingNewSponsor] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [editingFee, setEditingFee] = useState<string|null>(null)
  const [feeInput, setFeeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tournaments, setTournaments] = useState<any[]>([])
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [tournamentTeams, setTournamentTeams] = useState<Record<string,string[]>>({})
  const [tournamentPlayers, setTournamentPlayers] = useState<Record<string,any[]>>({})
  const [tournamentPayments, setTournamentPayments] = useState<Record<string,any[]>>({})
  const [showNewTournament, setShowNewTournament] = useState(false)
  const [newTournament, setNewTournament] = useState({ nombre:'', coste_inscripcion:'', coste_traslados:'', coste_estancia:'', coste_viaje_acomp:'', coste_estancia_acomp:'', costes_extras:'', notas:'' })
  const [newTournamentTeams, setNewTournamentTeams] = useState<string[]>([])
  const [savingTournament, setSavingTournament] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (!ROLES_PERMITIDOS.includes(s.role)) { router.push('/dashboard'); return }
    setSession(s)
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: teamsData }, { data: feesData }, { data: playersData }, { data: plansData }, { data: paymentsData }, { data: sponsorsData }, { data: spPaymentsData }, { data: tournamentsData }, { data: tTeamsData }, { data: tPlayersData }, { data: tPaymentsData }] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('team_fees').select('*').eq('temporada', TEMPORADA),
      supabase.from('players').select('*').eq('active', true).order('dorsal'),
      supabase.from('player_fee_plans').select('*').eq('temporada', TEMPORADA),
      supabase.from('player_fee_payments').select('*').eq('temporada', TEMPORADA),
      supabase.from('sponsors').select('*').eq('temporada', TEMPORADA).order('nombre'),
      supabase.from('sponsor_payments').select('*').eq('temporada', TEMPORADA),
      supabase.from('tournaments').select('*').eq('temporada', TEMPORADA).order('created_at', { ascending: false }),
      supabase.from('tournament_teams').select('*'),
      supabase.from('tournament_players').select('*'),
      supabase.from('tournament_payments').select('*'),
    ])
    setTeams(teamsData || [])
    const feesMap: Record<string,number> = {}
    ;(feesData || []).forEach((f: any) => { feesMap[f.team_id] = f.importe })
    setTeamFees(feesMap)
    const playersMap: Record<string,any[]> = {}
    ;(playersData || []).forEach((p: any) => {
      if (!playersMap[p.team_id]) playersMap[p.team_id] = []
      playersMap[p.team_id].push(p)
    })
    setPlayers(playersMap)
    const plansMap: Record<string,any> = {}
    ;(plansData || []).forEach((p: any) => { plansMap[p.player_id] = p })
    setPlans(plansMap)
    const paymentsMap: Record<string,any[]> = {}
    ;(paymentsData || []).forEach((p: any) => {
      if (!paymentsMap[p.player_id]) paymentsMap[p.player_id] = []
      paymentsMap[p.player_id].push(p)
    })
    setPayments(paymentsMap)
    setSponsors(sponsorsData || [])
    setTournaments(tournamentsData || [])
    const ttMap: Record<string,string[]> = {}
    ;(tTeamsData || []).forEach((tt: any) => {
      if (!ttMap[tt.tournament_id]) ttMap[tt.tournament_id] = []
      ttMap[tt.tournament_id].push(tt.team_id)
    })
    setTournamentTeams(ttMap)
    const tpMap: Record<string,any[]> = {}
    ;(tPlayersData || []).forEach((tp: any) => {
      if (!tpMap[tp.tournament_id]) tpMap[tp.tournament_id] = []
      tpMap[tp.tournament_id].push(tp)
    })
    setTournamentPlayers(tpMap)
    const tpaMap: Record<string,any[]> = {}
    ;(tPaymentsData || []).forEach((p: any) => {
      const key = p.tournament_id + '_' + p.player_id
      if (!tpaMap[key]) tpaMap[key] = []
      tpaMap[key].push(p)
    })
    setTournamentPayments(tpaMap)
    const spMap: Record<string,any[]> = {}
    ;(spPaymentsData || []).forEach((p: any) => {
      if (!spMap[p.sponsor_id]) spMap[p.sponsor_id] = []
      spMap[p.sponsor_id].push(p)
    })
    setSponsorPayments(spMap)
    setLoading(false)
  }

  function getPlayerStatus(player: any, teamId: string) {
    const fee = plans[player.id]?.importe_personalizado ?? teamFees[teamId]
    if (!fee) return 'sin_cuota'
    const paid = (payments[player.id] || []).reduce((sum: number, p: any) => sum + (p.cantidad || 0), 0)
    if (paid >= fee) return 'pagado'
    if (paid > 0) return 'parcial'
    return 'pendiente'
  }

  function getPlayerPaid(playerId: string) {
    return (payments[playerId] || []).reduce((sum: number, p: any) => sum + (p.cantidad || 0), 0)
  }

  async function saveFee(teamId: string) {
    const importe = parseFloat(feeInput)
    if (isNaN(importe) || importe <= 0) return
    setSaving(true)
    await supabase.from('team_fees').upsert({ team_id: teamId, temporada: TEMPORADA, importe }, { onConflict: 'team_id,temporada' })
    setTeamFees(f => ({ ...f, [teamId]: importe }))
    setEditingFee(null)
    setSaving(false)
  }

  function toggleTeam(teamId: string) {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  async function createTournament() {
    if (!newTournament.nombre) return
    if (newTournamentTeams.length === 0) return
    setSavingTournament(true)
    const { data: t } = await supabase.from('tournaments').insert({
      nombre: newTournament.nombre,
      temporada: TEMPORADA,
      coste_inscripcion: parseFloat(newTournament.coste_inscripcion) || 0,
      coste_traslados: parseFloat(newTournament.coste_traslados) || 0,
      coste_estancia: parseFloat(newTournament.coste_estancia) || 0,
      coste_viaje_acomp: parseFloat(newTournament.coste_viaje_acomp) || 0,
      coste_estancia_acomp: parseFloat(newTournament.coste_estancia_acomp) || 0,
      costes_extras: parseFloat(newTournament.costes_extras) || 0,
      notas: newTournament.notas || null,
    }).select().single()
    if (t) {
      await supabase.from('tournament_teams').insert(
        newTournamentTeams.map(tid => ({ tournament_id: t.id, team_id: tid }))
      )
    }
    setNewTournament({ nombre:'', coste_inscripcion:'', coste_traslados:'', coste_estancia:'', coste_viaje_acomp:'', coste_estancia_acomp:'', costes_extras:'', notas:'' })
    setNewTournamentTeams([])
    setShowNewTournament(false)
    setSavingTournament(false)
    loadData()
  }

  function toggleTournamentTeam(teamId: string) {
    setNewTournamentTeams(prev =>
      prev.includes(teamId) ? prev.filter(t => t !== teamId) : prev.length < 5 ? [...prev, teamId] : prev
    )
  }

  async function addSponsor() {
    if (!newSponsor.nombre || !newSponsor.cantidad_comprometida) return
    setSavingNewSponsor(true)
    await supabase.from('sponsors').insert({
      nombre: newSponsor.nombre,
      cantidad_comprometida: parseFloat(newSponsor.cantidad_comprometida),
      notas: newSponsor.notas || null,
      temporada: TEMPORADA,
    })
    setNewSponsor({ nombre: '', cantidad_comprometida: '', notas: '' })
    setShowNewSponsor(false)
    setSavingNewSponsor(false)
    loadData()
  }

  function getSponsorStatus(sponsor: any) {
    const paid = (sponsorPayments[sponsor.id] || []).reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
    if (paid >= sponsor.cantidad_comprometida) return 'pagado'
    if (paid > 0) return 'parcial'
    return 'pendiente'
  }

  function getSponsorPaid(sponsorId: string) {
    return (sponsorPayments[sponsorId] || []).reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
  }

  if (!session) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', paddingBottom: 80 }}>
      <div style={{ background: 'var(--surface)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Tesorería</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Temporada {TEMPORADA}</div>
        </div>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>Volver</button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {(['fichas','patrocinadores','torneos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              background: tab === t ? 'var(--accent)' : 'var(--surface2)', color: tab === t ? 'white' : 'var(--text-muted)' }}>
            {t === 'fichas' ? '💳 Fichas' : t === 'patrocinadores' ? '🤝 Patrocinadores' : '🏆 Torneos'}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>}

        {/* TAB FICHAS */}
        {!loading && tab === 'fichas' && !selectedPlayer && (
          <div>
            {(() => {
              const totalCuotas = teams.reduce((sum, team) => {
                const teamPlayers = players[team.id] || []
                return sum + teamPlayers.reduce((s, p) => {
                  const cuota = plans[p.id]?.importe_personalizado ?? teamFees[team.id] ?? 0
                  return s + cuota
                }, 0)
              }, 0)
              const totalCobrado = teams.reduce((sum, team) => {
                const teamPlayers = players[team.id] || []
                return sum + teamPlayers.reduce((s, p) => s + getPlayerPaid(p.id), 0)
              }, 0)
              const totalPendiente = totalCuotas - totalCobrado
              return totalCuotas > 0 ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Total a cobrar', val: totalCuotas, color: 'var(--text)' },
                    { label: 'Cobrado', val: totalCobrado, color: '#22c55e' },
                    { label: 'Pendiente', val: totalPendiente, color: totalPendiente > 0 ? '#ef4444' : '#22c55e' },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.val.toFixed(0)}€</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              ) : null
            })()}
            {teams.map(team => {
              const fee = teamFees[team.id]
              const teamPlayers = players[team.id] || []
              const isExpanded = expandedTeams.has(team.id)
              const paid = teamPlayers.filter(p => getPlayerStatus(p, team.id) === 'pagado').length
              const partial = teamPlayers.filter(p => getPlayerStatus(p, team.id) === 'parcial').length
              const pending = teamPlayers.filter(p => getPlayerStatus(p, team.id) === 'pendiente').length

              return (
                <div key={team.id} style={{ marginBottom: 10, background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {/* Header equipo */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={() => toggleTeam(team.id)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{team.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        {fee ? <span>Cuota: <b style={{ color: 'var(--accent)' }}>{fee}€</b></span> : <span style={{ color: '#f59e0b' }}>Sin cuota definida</span>}
                        <span>• {teamPlayers.length} jugadores</span>
                        {teamPlayers.length > 0 && <span style={{ color: '#22c55e' }}>✅ {paid}</span>}
                        {partial > 0 && <span style={{ color: '#f59e0b' }}>⚠️ {partial}</span>}
                        {pending > 0 && <span style={{ color: '#ef4444' }}>❌ {pending}</span>}
                      </div>
                    </div>
                    {(() => {
                      const totalEquipo = teamPlayers.reduce((s, p) => s + (plans[p.id]?.importe_personalizado ?? fee ?? 0), 0)
                      const cobradoEquipo = teamPlayers.reduce((s, p) => s + getPlayerPaid(p.id), 0)
                      const pendienteEquipo = totalEquipo - cobradoEquipo
                      return totalEquipo > 0 ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total: <b style={{ color: 'var(--text)' }}>{totalEquipo.toFixed(0)}€</b></span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• Cobrado: <b style={{ color: '#22c55e' }}>{cobradoEquipo.toFixed(0)}€</b></span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• Pendiente: <b style={{ color: pendienteEquipo > 0 ? '#ef4444' : '#22c55e' }}>{pendienteEquipo.toFixed(0)}€</b></span>
                        </div>
                      ) : null
                    })()}
                    <div onClick={e => e.stopPropagation()}>
                      <ExportMenu
                        config={{
                          title: team.name + ' — Fichas',
                          filename: 'fichas_' + team.name.replace(/\s+/g,'_'),
                          subtitle: 'Temporada ' + TEMPORADA,
                          columns: [
                            { header: 'Dorsal', key: 'dorsal' },
                            { header: 'Nombre', key: 'nombre' },
                            { header: 'Estado', key: 'estado' },
                            { header: 'Pagado (€)', key: 'pagado' },
                            { header: 'Cuota (€)', key: 'cuota' },
                            { header: 'Pendiente (€)', key: 'pendiente' },
                          ],
                          rows: (players[team.id] || []).map(p => {
                            const paid = getPlayerPaid(p.id)
                            const q = plans[p.id]?.importe_personalizado ?? teamFees[team.id] ?? 0
                            const st = getPlayerStatus(p, team.id)
                            return {
                              dorsal: p.dorsal || '',
                              nombre: p.name,
                              estado: st === 'pagado' ? 'Pagado' : st === 'parcial' ? 'Parcial' : 'Pendiente',
                              pagado: paid,
                              cuota: q,
                              pendiente: Math.max(0, q - paid),
                            }
                          }),
                          extraColumns: [
                            { header: 'Num. pagos', key: 'nPagos' },
                            { header: 'Metodo', key: 'metodo' },
                            { header: 'Cobrador', key: 'cobrador' },
                          ],
                          extraRows: (players[team.id] || []).map(p => {
                            const paid = getPlayerPaid(p.id)
                            const q = plans[p.id]?.importe_personalizado ?? teamFees[team.id] ?? 0
                            const pags = payments[p.id] || []
                            const st = getPlayerStatus(p, team.id)
                            return {
                              dorsal: p.dorsal || '',
                              nombre: p.name,
                              estado: st === 'pagado' ? 'Pagado' : st === 'parcial' ? 'Parcial' : 'Pendiente',
                              pagado: paid,
                              cuota: q,
                              pendiente: Math.max(0, q - paid),
                              nPagos: pags.length,
                              metodo: pags.map((pp:any) => pp.metodo).join(', '),
                              cobrador: pags.map((pp:any) => pp.cobrador || '').filter(Boolean).join(', '),
                            }
                          }),
                        }}
                        hasExtra={true}
                        extraLabel="Con detalle de pagos"
                      />
                    </div>
                    {canEditTeso && (
                      <button onClick={e => { e.stopPropagation(); setEditingFee(team.id); setFeeInput(fee?.toString() || '') }}
                        style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                        {fee ? 'Editar cuota' : 'Fijar cuota'}
                      </button>
                    )}
                    <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Editor cuota */}
                  {editingFee === team.id && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" value={feeInput} onChange={e => setFeeInput(e.target.value)}
                        placeholder="Importe €" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                      <button onClick={() => saveFee(team.id)} disabled={saving}
                        style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        Guardar
                      </button>
                      <button onClick={() => setEditingFee(null)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Lista jugadores */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {teamPlayers.length === 0 && (
                        <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Sin jugadores</div>
                      )}
                      {teamPlayers.map(player => {
                        const status = getPlayerStatus(player, team.id)
                        const paid = getPlayerPaid(player.id)
                        const cuota = plans[player.id]?.importe_personalizado ?? teamFees[team.id]
                        const isCustom = plans[player.id]?.importe_personalizado != null
                        return (
                          <div key={player.id} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => { setSelectedPlayer(player); setSelectedTeam(team) }}>
                            <span style={{ fontSize: 18 }}>
                              {status === 'pagado' ? '✅' : status === 'parcial' ? '⚠️' : status === 'pendiente' ? '❌' : '➖'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                                {player.dorsal ? '#' + player.dorsal + ' ' : ''}{player.name}
                              </span>
                              {isCustom && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6, background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>cuota personalizada</span>}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                              <span style={{ color: status === 'pagado' ? '#22c55e' : status === 'parcial' ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                                {paid}€
                              </span>
                              {cuota && <span> / {cuota}€</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* PANEL JUGADOR */}
        {!loading && tab === 'fichas' && selectedPlayer && (
          <PlayerPanel
            player={selectedPlayer}
            team={selectedTeam}
            temporada={TEMPORADA}
            session={session}
            teamFee={teamFees[selectedTeam?.id]}
            plan={plans[selectedPlayer.id]}
            payments={payments[selectedPlayer.id] || []}
            onBack={() => { setSelectedPlayer(null); loadData() }}
          />
        )}

        {/* PATROCINADORES */}
        {!loading && tab === 'patrocinadores' && !selectedSponsor && (
          <div>
            {/* Botón añadir */}
            <button onClick={() => setShowNewSponsor(true)}
              style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              + Añadir patrocinador
            </button>

            {/* Formulario nuevo patrocinador */}
            {showNewSponsor && (
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid var(--accent)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>Nuevo patrocinador</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={newSponsor.nombre} onChange={e => setNewSponsor(s => ({ ...s, nombre: e.target.value }))}
                    placeholder="Nombre del patrocinador *"
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                  <input type="number" value={newSponsor.cantidad_comprometida} onChange={e => setNewSponsor(s => ({ ...s, cantidad_comprometida: e.target.value }))}
                    placeholder="Cantidad comprometida (€) *"
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                  <input value={newSponsor.notas} onChange={e => setNewSponsor(s => ({ ...s, notas: e.target.value }))}
                    placeholder="Notas (opcional)"
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addSponsor} disabled={savingNewSponsor}
                      style={{ flex: 1, padding: '9px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {savingNewSponsor ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => { setShowNewSponsor(false); setNewSponsor({ nombre: '', cantidad_comprometida: '', notas: '' }) }}
                      style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista patrocinadores */}
            {sponsors.length > 0 && (() => {
              const totalComprometido = sponsors.reduce((s, sp) => s + (sp.cantidad_comprometida || 0), 0)
              const totalCobrado = sponsors.reduce((s, sp) => s + getSponsorPaid(sp.id), 0)
              const totalPendiente = totalComprometido - totalCobrado
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Total comprometido', val: totalComprometido, color: 'var(--text)' },
                    { label: 'Cobrado', val: totalCobrado, color: '#22c55e' },
                    { label: 'Pendiente', val: totalPendiente, color: totalPendiente > 0 ? '#ef4444' : '#22c55e' },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.val.toFixed(0)}€</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {sponsors.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                <ExportMenu
                  config={{
                    title: 'Patrocinadores',
                    filename: 'patrocinadores_' + TEMPORADA,
                    subtitle: 'Temporada ' + TEMPORADA,
                    columns: [
                      { header: 'Nombre', key: 'nombre' },
                      { header: 'Comprometido (€)', key: 'comprometido' },
                      { header: 'Cobrado (€)', key: 'cobrado' },
                      { header: 'Pendiente (€)', key: 'pendiente' },
                      { header: 'Estado', key: 'estado' },
                      { header: 'Notas', key: 'notas' },
                    ],
                    rows: sponsors.map(sp => {
                      const paid = getSponsorPaid(sp.id)
                      const st = getSponsorStatus(sp)
                      return {
                        nombre: sp.nombre,
                        comprometido: sp.cantidad_comprometida,
                        cobrado: paid,
                        pendiente: Math.max(0, sp.cantidad_comprometida - paid),
                        estado: st === 'pagado' ? 'Pagado' : st === 'parcial' ? 'Parcial' : 'Pendiente',
                        notas: sp.notas || '',
                      }
                    }),
                    extraColumns: [
                      { header: 'Num. pagos', key: 'nPagos' },
                      { header: 'Metodos', key: 'metodos' },
                      { header: 'Cobradores', key: 'cobradores' },
                    ],
                    extraRows: sponsors.map(sp => {
                      const paid = getSponsorPaid(sp.id)
                      const st = getSponsorStatus(sp)
                      const pags = sponsorPayments[sp.id] || []
                      return {
                        nombre: sp.nombre,
                        comprometido: sp.cantidad_comprometida,
                        cobrado: paid,
                        pendiente: Math.max(0, sp.cantidad_comprometida - paid),
                        estado: st === 'pagado' ? 'Pagado' : st === 'parcial' ? 'Parcial' : 'Pendiente',
                        notas: sp.notas || '',
                        nPagos: pags.length,
                        metodos: pags.map((p:any) => p.metodo).join(', '),
                        cobradores: pags.map((p:any) => p.cobrador || '').filter(Boolean).join(', '),
                      }
                    }),
                  }}
                  hasExtra={true}
                  extraLabel="Con detalle de pagos"
                />
              </div>
            )}
            {sponsors.length === 0 && !showNewSponsor && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay patrocinadores añadidos todavía</div>
              </div>
            )}
            {sponsors.map(sp => {
              const status = getSponsorStatus(sp)
              const paid = getSponsorPaid(sp.id)
              return (
                <div key={sp.id} style={{ background: 'var(--surface)', borderRadius: 12, marginBottom: 10, border: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => setSelectedSponsor(sp)}>
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>
                      {status === 'pagado' ? '✅' : status === 'parcial' ? '⚠️' : '❌'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{sp.nombre}</div>
                      {sp.notas && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sp.notas}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: status === 'pagado' ? '#22c55e' : status === 'parcial' ? '#f59e0b' : '#ef4444' }}>
                        {paid}€
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {sp.cantidad_comprometida}€</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PANEL PATROCINADOR */}
        {!loading && tab === 'patrocinadores' && selectedSponsor && (
          <SponsorPanel
            sponsor={selectedSponsor}
            temporada={TEMPORADA}
            payments={sponsorPayments[selectedSponsor.id] || []}
            session={session}
            onBack={() => { setSelectedSponsor(null); loadData() }}
          />
        )}

        {/* TORNEOS - LISTA */}
        {!loading && tab === 'torneos' && !selectedTournament && (
          <div>
            <button onClick={() => setShowNewTournament(true)}
              style={{ width:'100%', padding:'12px', background:'var(--accent)', color:'white', border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:14 }}>
              + Crear torneo
            </button>

            {/* Formulario nuevo torneo */}
            {showNewTournament && (
              <div style={{ background:'var(--surface)', borderRadius:12, padding:'14px 16px', marginBottom:14, border:'1px solid var(--accent)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:12 }}>Nuevo torneo</div>
                <input value={newTournament.nombre} onChange={e => setNewTournament(t => ({...t, nombre: e.target.value}))}
                  placeholder="Nombre del torneo *"
                  style={{ width:'100%', marginBottom:8, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }} />

                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>Equipos participantes (máx. 5)</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                  {teams.map(t => (
                    <button key={t.id} onClick={() => toggleTournamentTeam(t.id)}
                      style={{ padding:'5px 10px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                        background: newTournamentTeams.includes(t.id) ? 'var(--accent)' : 'var(--surface2)',
                        color: newTournamentTeams.includes(t.id) ? 'white' : 'var(--text-muted)',
                        opacity: !newTournamentTeams.includes(t.id) && newTournamentTeams.length >= 5 ? 0.4 : 1 }}>
                      {t.name}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>Costes por jugador (€)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {[
                    { field:'coste_inscripcion', label:'Inscripción' },
                    { field:'coste_traslados', label:'Traslados' },
                    { field:'coste_estancia', label:'Estancia' },
                    { field:'coste_viaje_acomp', label:'Viaje acomp.' },
                    { field:'coste_estancia_acomp', label:'Estancia acomp.' },
                    { field:'costes_extras', label:'Extras' },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{label}</div>
                      <input type="number" value={(newTournament as any)[field]}
                        onChange={e => setNewTournament(t => ({...t, [field]: e.target.value}))}
                        placeholder="0"
                        style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
                    </div>
                  ))}
                </div>

                <input value={newTournament.notas} onChange={e => setNewTournament(t => ({...t, notas: e.target.value}))}
                  placeholder="Notas (opcional)"
                  style={{ width:'100%', marginBottom:10, padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:13, boxSizing:'border-box' }} />

                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={createTournament} disabled={savingTournament || !newTournament.nombre || newTournamentTeams.length === 0}
                    style={{ flex:1, padding:'9px', background:'var(--accent)', color:'white', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer', opacity: (!newTournament.nombre || newTournamentTeams.length === 0) ? 0.5 : 1 }}>
                    {savingTournament ? 'Creando...' : 'Crear torneo'}
                  </button>
                  <button onClick={() => { setShowNewTournament(false); setNewTournamentTeams([]) }}
                    style={{ padding:'9px 16px', background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {tournaments.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                <ExportMenu
                  config={{
                    title: 'Torneos',
                    filename: 'torneos_' + TEMPORADA,
                    subtitle: 'Temporada ' + TEMPORADA,
                    columns: [
                      { header: 'Torneo', key: 'nombre' },
                      { header: 'Equipos', key: 'equipos' },
                      { header: 'Jugadores', key: 'nJugadores' },
                      { header: 'Coste/jugador (€)', key: 'costePorJugador' },
                      { header: 'A cobrar (€)', key: 'aCobrar' },
                      { header: 'Cobrado (€)', key: 'cobrado' },
                      { header: 'Pendiente (€)', key: 'pendiente' },
                    ],
                    rows: tournaments.map(t => {
                      const tteams = (tournamentTeams[t.id] || []).map((tid:string) => teams.find((te:any) => te.id === tid)?.name).filter(Boolean)
                      const tplayers = tournamentPlayers[t.id] || []
                      const totalCostes = ['coste_inscripcion','coste_traslados','coste_estancia','coste_viaje_acomp','coste_estancia_acomp','costes_extras'].reduce((s:number,c:string) => s+(t[c]||0), 0)
                      const cobrado = tplayers.reduce((s:number,tp:any) => s + (tournamentPayments[t.id+'_'+tp.player_id]||[]).reduce((ss:number,p:any) => ss+(p.cantidad||0), 0), 0)
                      return {
                        nombre: t.nombre,
                        equipos: tteams.join(', '),
                        nJugadores: tplayers.length,
                        costePorJugador: totalCostes,
                        aCobrar: totalCostes * tplayers.length,
                        cobrado,
                        pendiente: Math.max(0, totalCostes * tplayers.length - cobrado),
                      }
                    }),
                    extraColumns: [
                      { header: 'Inscripcion (€)', key: 'inscripcion' },
                      { header: 'Traslados (€)', key: 'traslados' },
                      { header: 'Estancia (€)', key: 'estancia' },
                      { header: 'Viaje acomp (€)', key: 'viajeAcomp' },
                      { header: 'Estancia acomp (€)', key: 'estanciaAcomp' },
                      { header: 'Extras (€)', key: 'extras' },
                    ],
                    extraRows: tournaments.map(t => {
                      const tteams = (tournamentTeams[t.id] || []).map((tid:string) => teams.find((te:any) => te.id === tid)?.name).filter(Boolean)
                      const tplayers = tournamentPlayers[t.id] || []
                      const totalCostes = ['coste_inscripcion','coste_traslados','coste_estancia','coste_viaje_acomp','coste_estancia_acomp','costes_extras'].reduce((s:number,c:string) => s+(t[c]||0), 0)
                      const cobrado = tplayers.reduce((s:number,tp:any) => s + (tournamentPayments[t.id+'_'+tp.player_id]||[]).reduce((ss:number,p:any) => ss+(p.cantidad||0), 0), 0)
                      return {
                        nombre: t.nombre,
                        equipos: tteams.join(', '),
                        nJugadores: tplayers.length,
                        costePorJugador: totalCostes,
                        aCobrar: totalCostes * tplayers.length,
                        cobrado,
                        pendiente: Math.max(0, totalCostes * tplayers.length - cobrado),
                        inscripcion: t.coste_inscripcion || 0,
                        traslados: t.coste_traslados || 0,
                        estancia: t.coste_estancia || 0,
                        viajeAcomp: t.coste_viaje_acomp || 0,
                        estanciaAcomp: t.coste_estancia_acomp || 0,
                        extras: t.costes_extras || 0,
                      }
                    }),
                  }}
                  hasExtra={true}
                  extraLabel="Con desglose de costes"
                />
              </div>
            )}
            {tournaments.length === 0 && !showNewTournament && (
              <div style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
                <div style={{ color:'var(--text-muted)', fontSize:14 }}>No hay torneos creados todavía</div>
              </div>
            )}

            {tournaments.map(t => {
              const tteams = (tournamentTeams[t.id] || []).map(tid => teams.find(te => te.id === tid)?.name).filter(Boolean)
              const tplayers = tournamentPlayers[t.id] || []
              const totalPagado = tplayers.reduce((sum: number, tp: any) => {
                const key = t.id + '_' + tp.player_id
                return sum + (tournamentPayments[key] || []).reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
              }, 0)
              const totalCostes = (t.coste_inscripcion + t.coste_traslados + t.coste_estancia + t.coste_viaje_acomp + t.coste_estancia_acomp + t.costes_extras)
              return (
                <div key={t.id} style={{ background:'var(--surface)', borderRadius:12, marginBottom:10, border:'1px solid var(--border)', cursor:'pointer' }}
                  onClick={() => setSelectedTournament(t)}>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>🏆 {t.nombre}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
                      {tteams.join(' • ')}
                    </div>
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11 }}>
                      <span style={{ color:'var(--text-muted)' }}>{tplayers.length} jugadores</span>
                      <span style={{ color:'var(--accent)' }}>💰 A cobrar: {(totalCostes * tplayers.length).toFixed(0)}€</span>
                      <span style={{ color:'#22c55e' }}>Cobrado: {totalPagado}€</span>
                      <span style={{ color:'#ef4444' }}>Pendiente: {Math.max(0, totalCostes * tplayers.length - totalPagado).toFixed(0)}€</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TORNEOS - DETALLE */}
        {!loading && tab === 'torneos' && selectedTournament && (
          <TournamentDetail
            tournament={selectedTournament}
            teams={teams}
            allPlayers={players}
            tournamentTeamIds={tournamentTeams[selectedTournament.id] || []}
            tournamentPlayers={tournamentPlayers[selectedTournament.id] || []}
            tournamentPayments={tournamentPayments}
            session={session}
            onBack={() => { setSelectedTournament(null); loadData() }}
          />
        )}
      </div>

      <BottomNav role={session.role} unreadMessages={0} />
    </div>
  )
}

// ===================== PANEL JUGADOR =====================
function PlayerPanel({ player, team, temporada, session, teamFee, plan, payments, onBack }: any) {
  const [numParcelas, setNumParcelas] = useState<number>(plan?.num_parcelas || 1)
  const [customFee, setCustomFee] = useState<string>(plan?.importe_personalizado?.toString() || '')
  const [notaCuota, setNotaCuota] = useState<string>(plan?.nota_cuota || '')
  const [editingCustomFee, setEditingCustomFee] = useState(false)
  const [formData, setFormData] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewingPdf, setViewingPdf] = useState<string|null>(null)
  const fileRefs = useRef<Record<number, HTMLInputElement|null>>({})

  const cuota = plan?.importe_personalizado ?? teamFee
  const totalPagado = payments.reduce((s: number, p: any) => s + (p.cantidad || 0), 0)

  useEffect(() => {
    // Inicializar formulario con pagos existentes o vacíos
    const arr = []
    for (let i = 1; i <= numParcelas; i++) {
      const existing = payments.find((p: any) => p.numero === i)
      arr.push({
        numero: i,
        fecha: existing?.fecha || '',
        cantidad: existing?.cantidad?.toString() || '',
        metodo: existing?.metodo || 'transferencia',
        cobrador: existing?.cobrador || 'Borja',
        justificante_url: existing?.justificante_url || '',
        id: existing?.id || null,
      })
    }
    setFormData(arr)
  }, [numParcelas])

  function updateField(idx: number, key: string, val: string) {
    setFormData(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p))
  }

  async function uploadJustificante(idx: number, file: File) {
    const path = `${player.id}/parcela_${idx+1}_${Date.now()}.pdf`
    const { data, error } = await supabase.storage.from('justificantes').upload(path, file, { upsert: true })
    if (error) { setMsg('Error subiendo PDF'); return }
    const { data: urlData } = supabase.storage.from('justificantes').getPublicUrl(path)
    updateField(idx, 'justificante_url', urlData.publicUrl)
    setMsg('PDF subido correctamente')
    setTimeout(() => setMsg(''), 2000)
  }

  async function saveAll() {
    setSaving(true)
    setMsg('')
    try {
      // Upsert plan
      const planPayload: any = {
        player_id: player.id,
        team_id: team.id,
        temporada,
        num_parcelas: numParcelas,
      }
      if (canEditTeso && customFee) {
        planPayload.importe_personalizado = parseFloat(customFee)
        planPayload.nota_cuota = notaCuota
      }
      const { data: planData, error: planErr } = await supabase
        .from('player_fee_plans')
        .upsert(planPayload, { onConflict: 'player_id,temporada' })
        .select().single()

      if (planErr) throw planErr

      const planId = planData?.id || plan?.id

      // Guardar cada parcela
      for (const row of formData) {
        if (!row.fecha && !row.cantidad) continue
        const payload: any = {
          plan_id: planId,
          player_id: player.id,
          team_id: team.id,
          temporada,
          numero: row.numero,
          fecha: row.fecha || null,
          cantidad: row.cantidad ? parseFloat(row.cantidad) : null,
          metodo: row.metodo,
          cobrador: row.metodo === 'metalico' ? row.cobrador : null,
          justificante_url: row.metodo === 'transferencia' ? row.justificante_url : null,
        }
        if (row.id) {
          await supabase.from('player_fee_payments').update(payload).eq('id', row.id)
        } else {
          await supabase.from('player_fee_payments').insert(payload)
        }
      }
      setMsg('✅ Guardado correctamente')
      setTimeout(() => { setMsg(''); onBack() }, 1200)
    } catch(e: any) {
      setMsg('Error: ' + e.message)
    }
    setSaving(false)
  }

  async function getSignedUrl(url: string) {
    // Extraer el path del bucket de la URL pública
    const path = url.split('/justificantes/')[1]
    if (!path) { setViewingPdf(url); return }
    const { data } = await supabase.storage.from('justificantes').createSignedUrl(path, 3600)
    setViewingPdf(data?.signedUrl || url)
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
        ← Volver
      </button>

      {/* Cabecera jugador */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>
          {player.dorsal ? '#' + player.dorsal + ' ' : ''}{player.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{team?.name} • {temporada}</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{totalPagado}€</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pagado</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{cuota ? cuota + '€' : '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cuota</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: cuota && totalPagado >= cuota ? '#22c55e' : totalPagado > 0 ? '#f59e0b' : '#ef4444' }}>
              {cuota && totalPagado >= cuota ? '✅' : totalPagado > 0 ? '⚠️' : '❌'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Estado</div>
          </div>
        </div>
      </div>

      {/* Cuota personalizada (solo admin) */}
      {canEditTeso && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingCustomFee ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Cuota personalizada</span>
            <button onClick={() => setEditingCustomFee(!editingCustomFee)}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
              {plan?.importe_personalizado ? 'Editar' : 'Personalizar'}
            </button>
          </div>
          {plan?.importe_personalizado && !editingCustomFee && (
            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
              {plan.importe_personalizado}€ {plan.nota_cuota ? '— ' + plan.nota_cuota : ''}
            </div>
          )}
          {editingCustomFee && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="number" value={customFee} onChange={e => setCustomFee(e.target.value)}
                placeholder="Importe personalizado €"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
              <input type="text" value={notaCuota} onChange={e => setNotaCuota(e.target.value)}
                placeholder="Motivo (beca, media temporada...)"
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
            </div>
          )}
        </div>
      )}

      {/* Selector parcelas */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Número de parcelas</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setNumParcelas(n)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                background: numParcelas === n ? 'var(--accent)' : 'var(--surface2)',
                color: numParcelas === n ? 'white' : 'var(--text-muted)' }}>
              {n === 6 ? '+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario de pagos */}
      {formData.map((row, idx) => (
        <div key={idx} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Parcela {row.numero}
            {row.id && <span style={{ color: '#22c55e', marginLeft: 8 }}>✅ Registrada</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Fecha</div>
              <input type="date" value={row.fecha} onChange={e => updateField(idx, 'fecha', e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Cantidad (€)</div>
              <input type="number" value={row.cantidad} onChange={e => updateField(idx, 'cantidad', e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => updateField(idx, 'metodo', 'transferencia')}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                background: row.metodo === 'transferencia' ? '#3b82f6' : 'var(--surface2)',
                color: row.metodo === 'transferencia' ? 'white' : 'var(--text-muted)' }}>
              🏦 Transferencia
            </button>
            <button onClick={() => updateField(idx, 'metodo', 'metalico')}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                background: row.metodo === 'metalico' ? '#22c55e' : 'var(--surface2)',
                color: row.metodo === 'metalico' ? 'white' : 'var(--text-muted)' }}>
              💵 Metálico
            </button>
          </div>
          {row.metodo === 'transferencia' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Justificante PDF</div>
              {row.justificante_url ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => getSignedUrl(row.justificante_url)}
                    style={{ flex: 1, padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    📄 Ver justificante
                  </button>
                  <button onClick={() => { fileRefs.current[idx]?.click() }}
                    style={{ padding: '6px 10px', background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRefs.current[idx]?.click()}
                  style={{ width: '100%', padding: '8px', background: 'var(--surface2)', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', boxSizing: 'border-box' }}>
                  + Subir PDF justificante
                </button>
              )}
              <input ref={el => fileRefs.current[idx] = el} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) uploadJustificante(idx, e.target.files[0]) }} />
            </div>
          )}
          {row.metodo === 'metalico' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cobrado por</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Borja','Victor','Rosa','Margot'].map(c => (
                  <button key={c} onClick={() => updateField(idx, 'cobrador', c)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                      background: row.cobrador === c ? '#22c55e' : 'var(--surface2)',
                      color: row.cobrador === c ? 'white' : 'var(--text-muted)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Histórico de pagos */}
      {payments.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Histórico de pagos
          </div>
          {[...payments].sort((a, b) => a.numero - b.numero).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 24 }}>#{p.numero}</span>
              <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{p.fecha || '—'}</span>
              <span style={{ fontWeight: 700, color: '#22c55e', minWidth: 60 }}>{p.cantidad}€</span>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                {p.metodo === 'transferencia' ? '🏦 Transf.' : '💵 ' + (p.cobrador || '')}
              </span>
              {p.justificante_url && (
                <button onClick={() => getSignedUrl(p.justificante_url)}
                  style={{ padding: '3px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  PDF
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: msg.includes('Error') ? '#fee2e2' : '#dcfce7', color: msg.includes('Error') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {msg}
        </div>
      )}

      <button onClick={saveAll} disabled={saving}
        style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Guardando...' : 'Guardar pagos'}
      </button>

      {/* Modal PDF */}
      {viewingPdf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
            <button onClick={() => setViewingPdf(null)}
              style={{ background: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
          <iframe src={viewingPdf} style={{ flex: 1, border: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ===================== PANEL PATROCINADOR =====================
function SponsorPanel({ sponsor, temporada, payments, session, onBack }: any) {
  const [numParcelas, setNumParcelas] = useState<number>(payments.length || 1)
  const [formData, setFormData] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewingPdf, setViewingPdf] = useState<string|null>(null)
  const [editingCantidad, setEditingCantidad] = useState(false)
  const [nuevaCantidad, setNuevaCantidad] = useState(sponsor.cantidad_comprometida?.toString() || '')
  const [savingCantidad, setSavingCantidad] = useState(false)
  const fileRefs = useRef<Record<number, HTMLInputElement|null>>({})

  const totalPagado = payments.reduce((s: number, p: any) => s + (p.cantidad || 0), 0)

  useEffect(() => {
    const arr = []
    for (let i = 1; i <= numParcelas; i++) {
      const existing = payments.find((p: any) => p.numero === i)
      arr.push({
        numero: i,
        fecha: existing?.fecha || '',
        cantidad: existing?.cantidad?.toString() || '',
        metodo: existing?.metodo || 'transferencia',
        cobrador: existing?.cobrador || 'Borja',
        justificante_url: existing?.justificante_url || '',
        id: existing?.id || null,
      })
    }
    setFormData(arr)
  }, [numParcelas])

  function updateField(idx: number, key: string, val: string) {
    setFormData(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p))
  }

  async function uploadJustificante(idx: number, file: File) {
    const path = `sponsors/${sponsor.id}/parcela_${idx+1}_${Date.now()}.pdf`
    await supabase.storage.from('justificantes').upload(path, file, { upsert: true })
    const { data: urlData } = supabase.storage.from('justificantes').getPublicUrl(path)
    updateField(idx, 'justificante_url', urlData.publicUrl)
    setMsg('PDF subido')
    setTimeout(() => setMsg(''), 2000)
  }

  async function saveAll() {
    setSaving(true)
    setMsg('')
    try {
      for (const row of formData) {
        if (!row.fecha && !row.cantidad) continue
        const payload: any = {
          sponsor_id: sponsor.id,
          temporada,
          numero: row.numero,
          fecha: row.fecha || null,
          cantidad: row.cantidad ? parseFloat(row.cantidad) : null,
          metodo: row.metodo,
          cobrador: row.metodo === 'metalico' ? row.cobrador : null,
          justificante_url: row.metodo === 'transferencia' ? row.justificante_url : null,
        }
        if (row.id) {
          await supabase.from('sponsor_payments').update(payload).eq('id', row.id)
        } else {
          await supabase.from('sponsor_payments').insert(payload)
        }
      }
      setMsg('✅ Guardado correctamente')
      setTimeout(() => { setMsg(''); onBack() }, 1200)
    } catch(e: any) {
      setMsg('Error: ' + e.message)
    }
    setSaving(false)
  }

  async function saveCantidad() {
    const val = parseFloat(nuevaCantidad)
    if (isNaN(val) || val <= 0) return
    setSavingCantidad(true)
    await supabase.from('sponsors').update({ cantidad_comprometida: val }).eq('id', sponsor.id)
    sponsor.cantidad_comprometida = val
    setEditingCantidad(false)
    setSavingCantidad(false)
  }

  async function getSignedUrl(url: string) {
    const path = url.split('/justificantes/')[1]
    if (!path) { setViewingPdf(url); return }
    const { data } = await supabase.storage.from('justificantes').createSignedUrl(path, 3600)
    setViewingPdf(data?.signedUrl || url)
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
        ← Volver
      </button>

      {/* Cabecera patrocinador */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{sponsor.nombre}</div>
        {sponsor.notas && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{sponsor.notas}</div>}
        {/* Editar cantidad comprometida - solo admin */}
        {session?.role === 'admin' && !editingCantidad && (
          <button onClick={() => setEditingCantidad(true)}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', marginBottom: 10 }}>
            ✏️ Editar cantidad comprometida
          </button>
        )}
        {session?.role === 'admin' && editingCantidad && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <input type="number" value={nuevaCantidad} onChange={e => setNuevaCantidad(e.target.value)}
              placeholder="Nueva cantidad €"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }} />
            <button onClick={saveCantidad} disabled={savingCantidad}
              style={{ padding: '6px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {savingCantidad ? '...' : 'Guardar'}
            </button>
            <button onClick={() => setEditingCantidad(false)}
              style={{ padding: '6px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{totalPagado}€</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pagado</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{sponsor.cantidad_comprometida}€</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Comprometido</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: totalPagado >= sponsor.cantidad_comprometida ? '#22c55e' : totalPagado > 0 ? '#f59e0b' : '#ef4444' }}>
              {totalPagado >= sponsor.cantidad_comprometida ? '✅' : totalPagado > 0 ? '⚠️' : '❌'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Estado</div>
          </div>
        </div>
      </div>

      {/* Selector parcelas */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Número de pagos</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setNumParcelas(n)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                background: numParcelas === n ? 'var(--accent)' : 'var(--surface2)',
                color: numParcelas === n ? 'white' : 'var(--text-muted)' }}>
              {n === 6 ? '+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario pagos */}
      {formData.map((row, idx) => (
        <div key={idx} style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Pago {row.numero} {row.id && <span style={{ color: '#22c55e' }}>✅ Registrado</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Fecha</div>
              <input type="date" value={row.fecha} onChange={e => updateField(idx, 'fecha', e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Cantidad (€)</div>
              <input type="number" value={row.cantidad} onChange={e => updateField(idx, 'cantidad', e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['transferencia','metalico'].map(m => (
              <button key={m} onClick={() => updateField(idx, 'metodo', m)}
                style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  background: row.metodo === m ? (m === 'transferencia' ? '#3b82f6' : '#22c55e') : 'var(--surface2)',
                  color: row.metodo === m ? 'white' : 'var(--text-muted)' }}>
                {m === 'transferencia' ? '🏦 Transferencia' : '💵 Metálico'}
              </button>
            ))}
          </div>
          {row.metodo === 'transferencia' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Justificante PDF</div>
              {row.justificante_url ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => getSignedUrl(row.justificante_url)}
                    style={{ flex: 1, padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    📄 Ver justificante
                  </button>
                  <button onClick={() => fileRefs.current[idx]?.click()}
                    style={{ padding: '6px 10px', background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRefs.current[idx]?.click()}
                  style={{ width: '100%', padding: '8px', background: 'var(--surface2)', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', boxSizing: 'border-box' }}>
                  + Subir PDF justificante
                </button>
              )}
              <input ref={el => fileRefs.current[idx] = el} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) uploadJustificante(idx, e.target.files[0]) }} />
            </div>
          )}
          {row.metodo === 'metalico' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cobrado por</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Borja','Victor','Rosa','Margot'].map(c => (
                  <button key={c} onClick={() => updateField(idx, 'cobrador', c)}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                      background: row.cobrador === c ? '#22c55e' : 'var(--surface2)',
                      color: row.cobrador === c ? 'white' : 'var(--text-muted)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Histórico */}
      {payments.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Histórico de pagos
          </div>
          {[...payments].sort((a, b) => a.numero - b.numero).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 24 }}>#{p.numero}</span>
              <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{p.fecha || '—'}</span>
              <span style={{ fontWeight: 700, color: '#22c55e', minWidth: 60 }}>{p.cantidad}€</span>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                {p.metodo === 'transferencia' ? '🏦 Transf.' : '💵 ' + (p.cobrador || '')}
              </span>
              {p.justificante_url && (
                <button onClick={() => getSignedUrl(p.justificante_url)}
                  style={{ padding: '3px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  PDF
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: msg.includes('Error') ? '#fee2e2' : '#dcfce7', color: msg.includes('Error') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {msg}
        </div>
      )}

      <button onClick={saveAll} disabled={saving}
        style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Guardando...' : 'Guardar pagos'}
      </button>

      {viewingPdf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
            <button onClick={() => setViewingPdf(null)}
              style={{ background: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
          <iframe src={viewingPdf} style={{ flex: 1, border: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ===================== TORNEO DETALLE =====================
const CONCEPTOS = [
  {key:'inscripcion',label:'Inscripción',icon:'🏷️',campo:'coste_inscripcion'},
  {key:'traslados',label:'Traslados',icon:'🚌',campo:'coste_traslados'},
  {key:'estancia',label:'Estancia',icon:'🏨',campo:'coste_estancia'},
  {key:'viaje_acomp',label:'Viaje acomp.',icon:'✈️',campo:'coste_viaje_acomp'},
  {key:'estancia_acomp',label:'Estancia acomp.',icon:'🛏️',campo:'coste_estancia_acomp'},
  {key:'extras',label:'Extras',icon:'➕',campo:'costes_extras'},
]

function TournamentDetail({ tournament, teams, allPlayers, tournamentTeamIds, tournamentPlayers: initPlayers, tournamentPayments, session, onBack }: any) {
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [selectedTeamForPlayer, setSelectedTeamForPlayer] = useState<any>(null)
  const [localPlayers, setLocalPlayers] = useState<any[]>(initPlayers)
  const [savingPlayer, setSavingPlayer] = useState<string|null>(null)
  const [editingCostes, setEditingCostes] = useState(false)
  const [costesForm, setCostesForm] = useState({
    coste_inscripcion: tournament.coste_inscripcion?.toString() || '0',
    coste_traslados: tournament.coste_traslados?.toString() || '0',
    coste_estancia: tournament.coste_estancia?.toString() || '0',
    coste_viaje_acomp: tournament.coste_viaje_acomp?.toString() || '0',
    coste_estancia_acomp: tournament.coste_estancia_acomp?.toString() || '0',
    costes_extras: tournament.costes_extras?.toString() || '0',
  })
  const [savingCostes, setSavingCostes] = useState(false)
  const [localTournament, setLocalTournament] = useState(tournament)

  const participatingTeams = teams.filter((t: any) => tournamentTeamIds.includes(t.id))
  const totalCostes = CONCEPTOS.reduce((s: number, c: any) => s + (localTournament[c.campo] || 0), 0)

  async function saveCostes() {
    setSavingCostes(true)
    const payload = {
      coste_inscripcion: parseFloat(costesForm.coste_inscripcion) || 0,
      coste_traslados: parseFloat(costesForm.coste_traslados) || 0,
      coste_estancia: parseFloat(costesForm.coste_estancia) || 0,
      coste_viaje_acomp: parseFloat(costesForm.coste_viaje_acomp) || 0,
      coste_estancia_acomp: parseFloat(costesForm.coste_estancia_acomp) || 0,
      costes_extras: parseFloat(costesForm.costes_extras) || 0,
    }
    await supabase.from('tournaments').update(payload).eq('id', tournament.id)
    setLocalTournament((t: any) => ({ ...t, ...payload }))
    setEditingCostes(false)
    setSavingCostes(false)
  }

  async function togglePlayer(player: any, teamId: string) {
    const existing = localPlayers.find((p: any) => p.player_id === player.id)
    setSavingPlayer(player.id)
    if (existing) {
      await supabase.from('tournament_players').delete().eq('id', existing.id)
      setLocalPlayers(prev => prev.filter((p: any) => p.player_id !== player.id))
    } else {
      const { data } = await supabase.from('tournament_players').insert({
        tournament_id: tournament.id, team_id: teamId, player_id: player.id,
        num_acomp_viaje: 0, num_acomp_estancia: 0
      }).select().single()
      if (data) setLocalPlayers(prev => [...prev, data])
    }
    setSavingPlayer(null)
  }

  async function updateAcomp(playerId: string, field: string, val: number) {
    await supabase.from('tournament_players').update({ [field]: val }).eq('tournament_id', tournament.id).eq('player_id', playerId)
    setLocalPlayers(prev => prev.map((p: any) => p.player_id === playerId ? { ...p, [field]: val } : p))
  }

  if (selectedPlayer) {
    return (
      <TournamentPlayerPanel
        tournament={tournament}
        player={selectedPlayer}
        team={selectedTeamForPlayer}
        playerEntry={localPlayers.find((p: any) => p.player_id === selectedPlayer.id)}
        payments={tournamentPayments[tournament.id + '_' + selectedPlayer.id] || []}
        onBack={() => { setSelectedPlayer(null); setSelectedTeamForPlayer(null) }}
      />
    )
  }

  return (
    <div>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:14 }}>
        ← Volver
      </button>

      {/* Cabecera torneo */}
      <div style={{ background:'var(--surface)', borderRadius:12, padding:'14px 16px', marginBottom:14, border:'1px solid var(--border)' }}>
        <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:6 }}>🏆 {tournament.nombre}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>{participatingTeams.map((t: any) => t.name).join(' • ')}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {CONCEPTOS.filter((c: any) => localTournament[c.campo] > 0).map((c: any) => (
            <div key={c.key} style={{ textAlign:'center', padding:'6px 4px', background:'var(--surface2)', borderRadius:8 }}>
              <div style={{ fontSize:14 }}>{c.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>{localTournament[c.campo]}€</div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, fontSize:12, color:'var(--text-muted)', textAlign:'right' }}>
          Total por jugador: <b style={{ color:'var(--accent)', fontSize:14 }}>{totalCostes}€</b>
        </div>
        {/* Botón editar costes */}
        {session?.role === 'admin' && !editingCostes && (
          <button onClick={() => setEditingCostes(true)}
            style={{ fontSize:11, color:'var(--accent)', background:'none', border:'1px solid var(--accent)', borderRadius:6, padding:'3px 10px', cursor:'pointer', marginTop:8 }}>
            ✏️ Editar costes
          </button>
        )}

        {/* Formulario edición costes */}
        {editingCostes && (
          <div style={{ marginTop:10, padding:'12px', background:'var(--surface2)', borderRadius:10, border:'1px solid var(--accent)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>Editar costes por jugador</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              {[
                { field:'coste_inscripcion', label:'Inscripción', icon:'🏷️' },
                { field:'coste_traslados', label:'Traslados', icon:'🚌' },
                { field:'coste_estancia', label:'Estancia', icon:'🏨' },
                { field:'coste_viaje_acomp', label:'Viaje acomp.', icon:'✈️' },
                { field:'coste_estancia_acomp', label:'Estancia acomp.', icon:'🛏️' },
                { field:'costes_extras', label:'Extras', icon:'➕' },
              ].map(({ field, label, icon }) => (
                <div key={field}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{icon} {label}</div>
                  <input type="number" value={(costesForm as any)[field]}
                    onChange={e => setCostesForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={saveCostes} disabled={savingCostes}
                style={{ flex:1, padding:'8px', background:'var(--accent)', color:'white', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {savingCostes ? 'Guardando...' : 'Guardar costes'}
              </button>
              <button onClick={() => setEditingCostes(false)}
                style={{ padding:'8px 14px', background:'none', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-muted)', fontSize:13, cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Totales globales */}
        <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <div style={{ flex:1, textAlign:'center', padding:'8px', background:'var(--surface2)', borderRadius:8 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--accent)' }}>{(totalCostes * localPlayers.length).toFixed(0)}€</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>A cobrar</div>
          </div>
          <div style={{ flex:1, textAlign:'center', padding:'8px', background:'var(--surface2)', borderRadius:8 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#22c55e' }}>
              {localPlayers.reduce((s: number, tp: any) => s + (tournamentPayments[tournament.id+'_'+tp.player_id]||[]).reduce((ss: number, p: any) => ss + (p.cantidad||0), 0), 0).toFixed(0)}€
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Cobrado</div>
          </div>
          <div style={{ flex:1, textAlign:'center', padding:'8px', background:'var(--surface2)', borderRadius:8 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#ef4444' }}>
              {Math.max(0, totalCostes * localPlayers.length - localPlayers.reduce((s: number, tp: any) => s + (tournamentPayments[tournament.id+'_'+tp.player_id]||[]).reduce((ss: number, p: any) => ss + (p.cantidad||0), 0), 0)).toFixed(0)}€
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Pendiente</div>
          </div>
        </div>
        {/* Botón eliminar torneo - solo admin */}
        {session?.role === 'admin' && (
          <button onClick={async () => {
            if (!confirm('¿Eliminar el torneo ' + tournament.nombre + '? Se eliminarán todos los datos asociados.')) return
            await supabase.from('tournaments').delete().eq('id', tournament.id)
            onBack()
          }}
            style={{ width:'100%', marginTop:10, padding:'8px', background:'none', border:'1px solid #ef4444', borderRadius:8, color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            🗑️ Eliminar torneo
          </button>
        )}
      </div>

      {/* Por equipo */}
      {participatingTeams.map((team: any) => {
        const teamPlayers = allPlayers[team.id] || []
        return (
          <div key={team.id} style={{ background:'var(--surface)', borderRadius:12, marginBottom:12, border:'1px solid var(--border)', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', background:'var(--surface2)', fontWeight:700, fontSize:13, color:'var(--text)' }}>
              {team.name}
            </div>
            {teamPlayers.map((player: any) => {
              const enrolled = localPlayers.find((p: any) => p.player_id === player.id)
              const paid = (tournamentPayments[tournament.id + '_' + player.id] || []).reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
              return (
                <div key={player.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    {/* Checkbox selección */}
                    <button onClick={() => togglePlayer(player, team.id)} disabled={savingPlayer === player.id}
                      style={{ width:28, height:28, borderRadius:6, border:'2px solid', borderColor: enrolled ? 'var(--accent)' : 'var(--border)',
                        background: enrolled ? 'var(--accent)' : 'transparent', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
                        flexShrink:0, opacity: savingPlayer === player.id ? 0.5 : 1 }}>
                      {enrolled ? '✓' : ''}
                    </button>
                    <div style={{ flex:1, cursor: enrolled ? 'pointer' : 'default' }}
                      onClick={() => { if(enrolled) { setSelectedPlayer(player); setSelectedTeamForPlayer(team) } }}>
                      <span style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>
                        {player.dorsal ? '#'+player.dorsal+' ' : ''}{player.name}
                      </span>
                    </div>
                    {enrolled && (
                      <span style={{ fontSize:12, fontWeight:700, color: paid >= totalCostes ? '#22c55e' : paid > 0 ? '#f59e0b' : '#ef4444' }}>
                        {paid}€
                      </span>
                    )}
                    {enrolled && (
                      <>
                        <button onClick={() => { setSelectedPlayer(player); setSelectedTeamForPlayer(team) }}
                          style={{ fontSize:11, padding:'3px 8px', background:'var(--accent)', color:'white', border:'none', borderRadius:6, cursor:'pointer' }}>
                          Pagos
                        </button>
                        <button onClick={e => { e.stopPropagation(); togglePlayer(player, team.id) }}
                          title="Quitar del torneo"
                          style={{ fontSize:11, padding:'3px 7px', background:'none', border:'1px solid #ef4444', color:'#ef4444', borderRadius:6, cursor:'pointer', fontWeight:700 }}>
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                  {/* Acompañantes */}
                  {enrolled && (
                    <div style={{ padding:'0 14px 10px 52px', display:'flex', gap:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                        <span style={{ color:'var(--text-muted)' }}>✈️ Acomp. viajan:</span>
                        <button onClick={() => updateAcomp(player.id, 'num_acomp_viaje', Math.max(0,(enrolled.num_acomp_viaje||0)-1))}
                          style={{ width:22, height:22, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>-</button>
                        <span style={{ fontWeight:700, minWidth:16, textAlign:'center' }}>{enrolled.num_acomp_viaje || 0}</span>
                        <button onClick={() => updateAcomp(player.id, 'num_acomp_viaje', (enrolled.num_acomp_viaje||0)+1)}
                          style={{ width:22, height:22, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>+</button>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                        <span style={{ color:'var(--text-muted)' }}>🏨 Estancia:</span>
                        <button onClick={() => updateAcomp(player.id, 'num_acomp_estancia', Math.max(0,(enrolled.num_acomp_estancia||0)-1))}
                          style={{ width:22, height:22, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>-</button>
                        <span style={{ fontWeight:700, minWidth:16, textAlign:'center' }}>{enrolled.num_acomp_estancia || 0}</span>
                        <button onClick={() => updateAcomp(player.id, 'num_acomp_estancia', (enrolled.num_acomp_estancia||0)+1)}
                          style={{ width:22, height:22, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface2)', cursor:'pointer', fontSize:12, fontWeight:700 }}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ===================== TORNEOS - PAGOS JUGADOR =====================
function TournamentPlayerPanel({ tournament, player, team, playerEntry, payments, onBack }: any) {
  const [activeConcepto, setActiveConcepto] = useState('inscripcion')
  const [formData, setFormData] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [viewingPdf, setViewingPdf] = useState<string|null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement|null>>({})

  const conceptoPayments = (concepto: string) => payments.filter((p: any) => p.concepto === concepto)
  const totalPagadoConcepto = (concepto: string) => conceptoPayments(concepto).reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
  const totalPagado = payments.reduce((s: number, p: any) => s + (p.cantidad || 0), 0)
  const totalCostes = CONCEPTOS.reduce((s: number, c: any) => s + (tournament[c.campo] || 0), 0)

  useEffect(() => {
    const pags = conceptoPayments(activeConcepto)
    const arr = pags.length > 0 ? pags.map((p: any) => ({
      numero: p.numero, fecha: p.fecha || '', cantidad: p.cantidad?.toString() || '',
      metodo: p.metodo || 'transferencia', cobrador: p.cobrador || 'Borja',
      justificante_url: p.justificante_url || '', id: p.id
    })) : [{ numero:1, fecha:'', cantidad:'', metodo:'transferencia', cobrador:'Borja', justificante_url:'', id:null }]
    setFormData(arr)
  }, [activeConcepto, payments.length])

  function updateField(idx: number, key: string, val: string) {
    setFormData(prev => prev.map((p, i) => i === idx ? {...p, [key]: val} : p))
  }

  function addPago() {
    setFormData(prev => [...prev, { numero: prev.length+1, fecha:'', cantidad:'', metodo:'transferencia', cobrador:'Borja', justificante_url:'', id:null }])
  }

  async function uploadJustificante(key: string, file: File) {
    const path = `torneos/${tournament.id}/${player.id}/${key}_${Date.now()}.pdf`
    await supabase.storage.from('justificantes').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('justificantes').getPublicUrl(path)
    const [idx] = key.split('_')
    updateField(parseInt(idx), 'justificante_url', data.publicUrl)
  }

  async function saveConcepto() {
    setSaving(true); setMsg('')
    try {
      for (const row of formData) {
        if (!row.fecha && !row.cantidad) continue
        const payload: any = {
          tournament_id: tournament.id, player_id: player.id, team_id: team.id,
          concepto: activeConcepto, numero: row.numero,
          fecha: row.fecha || null, cantidad: row.cantidad ? parseFloat(row.cantidad) : null,
          metodo: row.metodo,
          cobrador: row.metodo === 'metalico' ? row.cobrador : null,
          justificante_url: row.metodo === 'transferencia' ? row.justificante_url : null,
        }
        if (row.id) await supabase.from('tournament_payments').update(payload).eq('id', row.id)
        else await supabase.from('tournament_payments').insert(payload)
      }
      setMsg('✅ Guardado')
      setTimeout(() => setMsg(''), 2000)
    } catch(e: any) { setMsg('Error: '+e.message) }
    setSaving(false)
  }

  async function getSignedUrl(url: string) {
    const path = url.split('/justificantes/')[1]
    if (!path) { setViewingPdf(url); return }
    const { data } = await supabase.storage.from('justificantes').createSignedUrl(path, 3600)
    setViewingPdf(data?.signedUrl || url)
  }

  return (
    <div>
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--accent)', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:14 }}>
        ← Volver
      </button>

      {/* Cabecera jugador */}
      <div style={{ background:'var(--surface)', borderRadius:12, padding:'14px 16px', marginBottom:14, border:'1px solid var(--border)' }}>
        <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:2 }}>
          {player.dorsal ? '#'+player.dorsal+' ' : ''}{player.name}
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
          {team.name} • {tournament.nombre}
          {playerEntry && (
            <span style={{ marginLeft:8 }}>
              ✈️ {playerEntry.num_acomp_viaje || 0} acomp. viaje • 🏨 {playerEntry.num_acomp_estancia || 0} acomp. estancia
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--accent)' }}>{totalPagado}€</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Pagado</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{totalCostes}€</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Total</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18 }}>{totalPagado >= totalCostes ? '✅' : totalPagado > 0 ? '⚠️' : '❌'}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Estado</div>
          </div>
        </div>
      </div>

      {/* Selector concepto */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
        {CONCEPTOS.filter((c: any) => tournament[c.campo] > 0).map((c: any) => {
          const paid = totalPagadoConcepto(c.key)
          const total = tournament[c.campo]
          const st = paid >= total ? '#22c55e' : paid > 0 ? '#f59e0b' : 'var(--text-muted)'
          return (
            <button key={c.key} onClick={() => setActiveConcepto(c.key)}
              style={{ flex:'1 1 calc(33% - 4px)', padding:'8px 4px', borderRadius:8, border:'2px solid',
                borderColor: activeConcepto === c.key ? 'var(--accent)' : 'transparent',
                background: activeConcepto === c.key ? 'var(--surface)' : 'var(--surface2)',
                cursor:'pointer', textAlign:'center' }}>
              <div style={{ fontSize:14 }}>{c.icon}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginTop:2 }}>{c.label}</div>
              <div style={{ fontSize:11, fontWeight:700, color:st }}>{paid}/{total}€</div>
            </button>
          )
        })}
      </div>

      {/* Formulario de pagos del concepto activo */}
      <div style={{ background:'var(--surface)', borderRadius:12, padding:'12px 16px', marginBottom:10, border:'1px solid var(--border)' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>
          {CONCEPTOS.find((c: any) => c.key === activeConcepto)?.icon} {CONCEPTOS.find((c: any) => c.key === activeConcepto)?.label} — {tournament[CONCEPTOS.find((c: any) => c.key === activeConcepto)?.campo as string] || 0}€
        </div>
        {formData.map((row, idx) => (
          <div key={idx} style={{ marginBottom:12, paddingBottom:12, borderBottom: idx < formData.length-1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginBottom:6 }}>Pago {row.numero} {row.id && '✅'}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Fecha</div>
                <input type="date" value={row.fecha} onChange={e => updateField(idx,'fecha',e.target.value)}
                  style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Cantidad (€)</div>
                <input type="number" value={row.cantidad} onChange={e => updateField(idx,'cantidad',e.target.value)}
                  placeholder="0.00"
                  style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              {['transferencia','metalico'].map(m => (
                <button key={m} onClick={() => updateField(idx,'metodo',m)}
                  style={{ flex:1, padding:'7px 4px', borderRadius:8, border:'none', fontWeight:600, fontSize:12, cursor:'pointer',
                    background: row.metodo === m ? (m==='transferencia' ? '#3b82f6' : '#22c55e') : 'var(--surface2)',
                    color: row.metodo === m ? 'white' : 'var(--text-muted)' }}>
                  {m === 'transferencia' ? '🏦 Transferencia' : '💵 Metálico'}
                </button>
              ))}
            </div>
            {row.metodo === 'transferencia' && (
              <div>
                {row.justificante_url ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => getSignedUrl(row.justificante_url)}
                      style={{ flex:1, padding:'6px', background:'#3b82f6', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      📄 Ver PDF
                    </button>
                    <button onClick={() => fileRefs.current[idx+'_'+activeConcepto]?.click()}
                      style={{ padding:'6px 10px', background:'var(--surface2)', color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRefs.current[idx+'_'+activeConcepto]?.click()}
                    style={{ width:'100%', padding:'8px', background:'var(--surface2)', color:'var(--text-muted)', border:'2px dashed var(--border)', borderRadius:8, fontSize:12, cursor:'pointer', boxSizing:'border-box' }}>
                    + Subir PDF
                  </button>
                )}
                <input ref={el => fileRefs.current[idx+'_'+activeConcepto] = el} type="file" accept=".pdf" style={{ display:'none' }}
                  onChange={e => { if(e.target.files?.[0]) uploadJustificante(idx+'_'+activeConcepto, e.target.files[0]) }} />
              </div>
            )}
            {row.metodo === 'metalico' && (
              <div style={{ display:'flex', gap:6 }}>
                {['Borja','Victor','Rosa','Margot'].map(c => (
                  <button key={c} onClick={() => updateField(idx,'cobrador',c)}
                    style={{ flex:1, padding:'6px 4px', borderRadius:8, border:'none', fontWeight:600, fontSize:12, cursor:'pointer',
                      background: row.cobrador === c ? '#22c55e' : 'var(--surface2)',
                      color: row.cobrador === c ? 'white' : 'var(--text-muted)' }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button onClick={addPago}
          style={{ width:'100%', padding:'7px', background:'none', border:'1px dashed var(--border)', borderRadius:8, color:'var(--text-muted)', fontSize:12, cursor:'pointer', marginTop:4 }}>
          + Añadir pago
        </button>
      </div>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:8, background: msg.includes('Error') ? '#fee2e2' : '#dcfce7', color: msg.includes('Error') ? '#dc2626' : '#16a34a', fontSize:13, fontWeight:600, marginBottom:12 }}>
          {msg}
        </div>
      )}

      <button onClick={saveConcepto} disabled={saving}
        style={{ width:'100%', padding:'14px', background:'var(--accent)', color:'white', border:'none', borderRadius:12, fontSize:15, fontWeight:800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Guardando...' : 'Guardar pagos'}
      </button>

      {viewingPdf && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', padding:12 }}>
            <button onClick={() => setViewingPdf(null)} style={{ background:'white', border:'none', borderRadius:8, padding:'6px 14px', fontWeight:700, cursor:'pointer' }}>Cerrar</button>
          </div>
          <iframe src={viewingPdf} style={{ flex:1, border:'none' }} />
        </div>
      )}
    </div>
  )
}