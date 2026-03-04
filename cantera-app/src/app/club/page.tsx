'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

type TeamOverview = {
  team_id: string; team_name: string; category: string; coach_name: string
  total_players: number; total_evaluations: number
  avg_fisica: number; avg_tecnica: number; avg_tactica: number; avg_psico: number; avg_global: number
}
type Talent = {
  player_id: string; player_name: string; dorsal: number; position: string
  team_name: string; category: string
  avg_fisica: number; avg_tecnica: number; avg_tactica: number; avg_psico: number; avg_global: number
}
type EvoPoint = { jornada: number; [team: string]: number }

function sc(v: number | null) {
  if (!v) return 'var(--text-muted)'
  if (v >= 8) return 'var(--green)'
  if (v >= 6) return 'var(--gold)'
  if (v >= 4) return 'var(--orange)'
  return 'var(--red)'
}

const TEAM_COLORS = ['#F0B429','#4FC3F7','#68D391','#FC8181','#B794F4','#FBD38D','#81E6D9','#F6AD55','#63B3ED','#F687B3','#68D391','#FEB2B2']

export default function ClubPage() {
  const router = useRouter()
  const [teams, setTeams]       = useState<TeamOverview[]>([])
  const [talents, setTalents]   = useState<Talent[]>([])
  const [evoData, setEvoData]   = useState<EvoPoint[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    const role = sessionStorage.getItem('role')
    if (role !== 'admin') { router.push('/'); return }
    loadAll()
  }, [router])

  async function loadAll() {
    setLoading(true)
    const [{ data: tData }, { data: talData }, { data: evoRaw }] = await Promise.all([
      supabase.from('club_overview').select('*').order('avg_global', { ascending: false }),
      supabase.from('talent_radar').select('*'),
      supabase.from('evaluations')
        .select('team_id, jornada_id, media_fisica, media_tecnica, media_tactica, media_psico, jornadas(number, team_id, teams(name))')
        .order('jornada_id'),
    ])
    setTeams(tData || [])
    setTalents(talData || [])

    // Build evolution data
    if (evoRaw) {
      const byJornada: Record<number, Record<string, number[]>> = {}
      evoRaw.forEach((e: any) => {
        const j = e.jornadas?.number
        const tName = e.jornadas?.teams?.name
        if (!j || !tName) return
        if (!byJornada[j]) byJornada[j] = {}
        if (!byJornada[j][tName]) byJornada[j][tName] = []
        const mg = [e.media_fisica, e.media_tecnica, e.media_tactica, e.media_psico].filter(Boolean)
        if (mg.length) byJornada[j][tName].push(mg.reduce((a,b) => a+b,0) / mg.length)
      })
      const points: EvoPoint[] = Object.entries(byJornada)
        .sort(([a],[b]) => Number(a)-Number(b))
        .map(([j, teams]) => ({
          jornada: Number(j),
          ...Object.fromEntries(Object.entries(teams).map(([t, vals]) => [t, Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10]))
        }))
      setEvoData(points)
    }
    setLoading(false)
  }

  const globalAvg = (key: keyof TeamOverview) => {
    const vals = teams.map(t => t[key] as number).filter(v => v > 0)
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : 0
  }

  const categories = ['all', ...Array.from(new Set(teams.map(t => t.category)))]
  const filteredTalents = activeFilter === 'all' ? talents : talents.filter(t => t.category === activeFilter)
  const radarData = [
    { area: '💪 Física',     val: globalAvg('avg_fisica')  },
    { area: '⚽ Técnica',    val: globalAvg('avg_tecnica') },
    { area: '🧠 Táctica',   val: globalAvg('avg_tactica') },
    { area: '🧘 Psicológica',val: globalAvg('avg_psico')  },
  ]

  const teamNames = Array.from(new Set(evoData.flatMap(d => Object.keys(d).filter(k => k !== 'jornada'))))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>⚽</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando datos del club...</div>
    </div>
  )

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={s.badge}>⚽</div>
          <div>
            <div className="font-display" style={{ fontSize: 24 }}>CD San Cayetano</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 4 }}>DASHBOARD COORDINADOR · 2025/26</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            { label: 'Equipos', val: teams.length },
            { label: 'Jugadores', val: teams.reduce((s,t) => s + t.total_players, 0) },
            { label: 'Media club', val: globalAvg('avg_global') },
            { label: 'Talentos', val: talents.length },
          ].map(k => (
            <div key={k.label} style={s.kpiPill}>
              <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, color: 'var(--gold)' }}>{k.val}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</span>
            </div>
          ))}
          <button style={s.btnLogout} onClick={() => { sessionStorage.clear(); router.push('/') }}>Salir</button>
        </div>
      </header>

      <main style={s.main}>

        {/* Row 1: Teams table + Radar */}
        <div style={s.row2}>
          <div style={s.card}>
            <div style={s.cardTitle}>Rendimiento por Equipo <span style={s.tag}>ÚLTIMA EVALUACIÓN</span></div>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Equipo','Jugadores','💪','⚽','🧠','🧘','⭐ Media'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.team_id} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 600 }}>
                      <span style={{ color: TEAM_COLORS[i % TEAM_COLORS.length], marginRight: 6 }}>●</span>
                      {t.team_name}
                    </td>
                    <td style={{ ...s.td, fontFamily: "'DM Mono'", fontSize: 12, textAlign: 'center' }}>{t.total_players}</td>
                    {[t.avg_fisica, t.avg_tecnica, t.avg_tactica, t.avg_psico].map((v, vi) => (
                      <td key={vi} style={{ ...s.td, textAlign: 'center' }}>
                        <div style={s.scoreWrap}>
                          <div style={s.scoreBar}><div style={{ ...s.scoreBarFill, width: `${(v||0)*10}%`, background: sc(v) }} /></div>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 11, color: sc(v), minWidth: 26 }}>{v || '—'}</span>
                        </div>
                      </td>
                    ))}
                    <td style={{ ...s.td, fontFamily: "'Bebas Neue'", fontSize: 22, color: sc(t.avg_global), textAlign: 'center' }}>
                      {t.avg_global || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teams.length === 0 && <div style={s.empty}>Sin datos aún. Los entrenadores deben registrar jornadas.</div>}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Perfil de la Cantera <span style={s.tag}>RADAR</span></div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0,10]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickCount={6} />
                <Radar dataKey="val" stroke="#F0B429" fill="#F0B429" fillOpacity={0.15} strokeWidth={2} dot={{ fill: '#F0B429', r: 4 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2: Evolution chart */}
        <div style={s.card}>
          <div style={s.cardTitle}>Evolución Global por Jornadas <span style={s.tag}>TODOS LOS EQUIPOS</span></div>
          {evoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evoData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="jornada" tickFormatter={v => `J${v}`} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[4, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={v => `Jornada ${v}`}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
                {teamNames.map((t, i) => (
                  <Line key={t} type="monotone" dataKey={t} stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={s.empty}>Los datos de evolución aparecerán cuando los entrenadores registren varias jornadas.</div>
          )}
        </div>

        {/* Row 3: Talent radar */}
        <div style={s.card}>
          <div style={s.cardTitle}>
            Radar de Talentos
            <span style={s.tag}>MEDIA ≥ 7.0</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {categories.map(c => (
              <button key={c} style={{ ...s.filterTab, ...(activeFilter === c ? s.filterTabActive : {}) }}
                onClick={() => setActiveFilter(c)}>
                {c === 'all' ? '🌟 Todos' : c}
              </button>
            ))}
          </div>
          {filteredTalents.length === 0 ? (
            <div style={s.empty}>
              {talents.length === 0
                ? 'Aún no hay jugadores con suficientes evaluaciones registradas.'
                : 'No hay talentos en esta categoría todavía.'}
            </div>
          ) : (
            <div style={s.talentGrid}>
              {filteredTalents.map((t, i) => (
                <div key={t.player_id} style={s.talentCard}>
                  <div style={s.talentTop}>
                    <span style={{ ...s.rank, color: i === 0 ? 'var(--gold)' : i === 1 ? '#a0aec0' : i === 2 ? '#c05621' : 'var(--text-muted)' }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.player_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.team_name} · {t.position}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: sc(t.avg_global), lineHeight: 1 }}>{t.avg_global}</div>
                      {t.avg_global >= 8 && <div style={s.talentBadge}>✦ TOP</div>}
                    </div>
                  </div>
                  <div style={s.talentBars}>
                    {[['💪', t.avg_fisica, '#4FC3F7'], ['⚽', t.avg_tecnica, 'var(--gold)'], ['🧠', t.avg_tactica, 'var(--green)'], ['🧘', t.avg_psico, '#b794f4']].map(([icon, val, color]) => (
                      <div key={icon as string} style={s.miniBar}>
                        <span style={{ fontSize: 10 }}>{icon as string}</span>
                        <div style={{ flex: 1, height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(val as number||0)*10}%`, background: color as string, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "'DM Mono'", color: color as string, minWidth: 22 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', background: 'rgba(7,14,28,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100,
  },
  badge: {
    width: 44, height: 44, background: 'var(--navy)', border: '2px solid var(--gold)',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
  },
  kpiPill: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '6px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
  },
  btnLogout: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)',
  },
  main: { padding: '28px 32px', maxWidth: 1600, margin: '0 auto' },
  row2: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
    padding: '22px 24px', marginBottom: 16,
  },
  cardTitle: {
    fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2, marginBottom: 18,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  tag: {
    fontFamily: "'DM Mono'", fontSize: 10, background: 'var(--surface3)',
    padding: '3px 8px', borderRadius: 4, color: 'var(--text-muted)', letterSpacing: 1,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left',
  },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.15s' },
  td: { padding: '10px 10px', fontSize: 13 },
  scoreWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  scoreBar: { flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.6s' },
  filterTab: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 20,
    padding: '5px 14px', fontSize: 12, color: 'var(--text-muted)', transition: 'all 0.15s',
  },
  filterTabActive: { background: 'var(--navy)', borderColor: 'var(--navy-light)', color: 'var(--text)' },
  talentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 },
  talentCard: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 16px', transition: 'border-color 0.2s',
  },
  talentTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  rank: { fontFamily: "'Bebas Neue'", fontSize: 24, minWidth: 24, textAlign: 'center' },
  talentBadge: {
    background: 'rgba(240,180,41,0.15)', border: '1px solid rgba(240,180,41,0.3)',
    color: 'var(--gold)', fontSize: 9, letterSpacing: 1.5, padding: '2px 6px',
    borderRadius: 4, fontWeight: 600, textAlign: 'center', marginTop: 2,
  },
  talentBars: { display: 'flex', flexDirection: 'column', gap: 5 },
  miniBar: { display: 'flex', alignItems: 'center', gap: 6 },
  empty: { textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 },
}
