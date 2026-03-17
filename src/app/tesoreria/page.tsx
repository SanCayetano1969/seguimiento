'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

const TEMPORADA = '2025-26'
const COBRADORES = ['Borja', 'Victor', 'Rosa', 'Margot']
const ROLES_PERMITIDOS = ['admin', 'coordinator', 'secretario', 'ejecutivo']

export default function TesoreriaPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [tab, setTab] = useState<'fichas'|'patrocinadores'|'torneos'>('fichas')
  const [teams, setTeams] = useState<any[]>([])
  const [teamFees, setTeamFees] = useState<Record<string,number>>({})
  const [players, setPlayers] = useState<Record<string,any[]>>({})
  const [plans, setPlans] = useState<Record<string,any>>({})
  const [payments, setPayments] = useState<Record<string,any[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [editingFee, setEditingFee] = useState<string|null>(null)
  const [feeInput, setFeeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const s = getSession()
    if (!s) { router.push('/'); return }
    if (!ROLES_PERMITIDOS.includes(s.role)) { router.push('/dashboard'); return }
    setSession(s)
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: teamsData }, { data: feesData }, { data: playersData }, { data: plansData }, { data: paymentsData }] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('team_fees').select('*').eq('temporada', TEMPORADA),
      supabase.from('players').select('*').eq('active', true).order('dorsal'),
      supabase.from('player_fee_plans').select('*').eq('temporada', TEMPORADA),
      supabase.from('player_fee_payments').select('*').eq('temporada', TEMPORADA),
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
                    {session.role === 'admin' && (
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
        {!loading && tab === 'patrocinadores' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Módulo de patrocinadores próximamente</div>
          </div>
        )}

        {/* TORNEOS */}
        {!loading && tab === 'torneos' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Módulo de torneos próximamente</div>
          </div>
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
      if (session.role === 'admin' && customFee) {
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
      {session.role === 'admin' && (
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