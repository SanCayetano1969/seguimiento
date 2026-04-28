'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, clearSession } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

type Slot = { desde: string; hasta: string; zonas: string[] }
const DISP: Record<string, Record<number, Slot[]>> = {
  SanCa: {
    1:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    2:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    3:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    4:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    5:[{desde:'17:00',hasta:'22:00',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
  'Son Moix': {
    1:[{desde:'20:30',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    2:[{desde:'19:30',hasta:'20:30',zonas:['Norte 1','Norte 2']}],
    3:[{desde:'20:00',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
    4:[{desde:'19:30',hasta:'20:30',zonas:['Norte 1','Norte 2']}],
    5:[{desde:'20:00',hasta:'22:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
  'San Fernando': {
    1:[{desde:'20:30',hasta:'21:30',zonas:['Norte 1','Norte 2']}],
    2:[],
    3:[{desde:'17:30',hasta:'19:00',zonas:['Norte 1','Norte 2']}],
    4:[],
    5:[{desde:'19:00',hasta:'20:00',zonas:['Norte 1','Norte 2']},{desde:'20:00',hasta:'21:30',zonas:['Norte 1','Norte 2','Sur 1','Sur 2']}],
  },
}

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes']
const FRANJAS: string[] = []
for (let h = 17; h < 22; h++) {
  FRANJAS.push(String(h).padStart(2,'0')+':00')
  FRANJAS.push(String(h).padStart(2,'0')+':30')
}
FRANJAS.push('22:00')

function toMin(t: string) { const [h,m]=t.split(':').map(Number); return h*60+m }

function getZonas(recinto: string, dow: number, franja: string): string[] {
  const slots = DISP[recinto]?.[dow+1] || []
  const min = toMin(franja)
  for (const s of slots) {
    if (min >= toMin(s.desde) && min < toMin(s.hasta)) return s.zonas
  }
  return []
}

function tColor(name: string) {
  const n = (name||'').toLowerCase()
  if (n.includes('prebenjam')) return n.includes(' b') ? '#fb923c' : '#f97316'
  if (n.includes('benjam')) {
    if (n.includes(' d')) return '#86efac'
    if (n.includes(' c')) return '#4ade80'
    if (n.includes(' b')) return '#22c55e'
    return '#16a34a'
  }
  if (n.includes('alev')) {
    if (n.includes(' f')) return '#7dd3fc'
    if (n.includes(' e')) return '#38bdf8'
    if (n.includes(' d')) return '#0ea5e9'
    if (n.includes(' c')) return '#0284c7'
    if (n.includes(' b')) return '#0369a1'
    return '#075985'
  }
  if (n.includes('infantil')) { if (n.includes(' c')) return '#c084fc'; if (n.includes(' b')) return '#a855f7'; return '#9333ea' }
  if (n.includes('cadete')) return n.includes(' b') ? '#f87171' : '#ef4444'
  if (n.includes('juvenil')) return '#facc15'
  if (n.includes('amateur')) return '#a3a3a3'
    if (n.includes('femenino')) return '#d946ef'
  return '#64748b'
}

function getLunes() {
  const hoy = new Date()
  const dow = hoy.getDay()
  const d = new Date(hoy)
  d.setDate(hoy.getDate() + (dow === 0 ? -6 : 1 - dow))
  return d
}

function fechaDia(dowIdx: number) {
  const l = getLunes()
  l.setDate(l.getDate() + dowIdx)
  return l.toISOString().split('T')[0]
}

const RECINTOS = ['SanCa','Son Moix','San Fernando']

export default function OrganizacionEntrenosPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [dowIdx, setDowIdx] = useState(0)
  const [franja, setFranja] = useState('18:00')
  // asignaciones[dowIdx][recinto][zona] = teamId
  const [asig, setAsig] = useState<Record<number, Record<string, Record<string, string>>>>({})
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/'); return }
    if (!['admin','coordinator'].includes(s.role)) { router.replace('/dashboard'); return }
    setSession(s)
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data: t } = await supabase.from('teams').select('id,name,category').order('category').order('name')
    setTeams(t || [])
    // Cargar entrenos de la semana actual
    const lunes = getLunes()
    const viernes = new Date(lunes); viernes.setDate(lunes.getDate()+4)
    const { data: ev } = await supabase.from('events')
      .select('id,team_id,date,time,location,type')
      .eq('type','entrenamiento')
      .gte('date', lunes.toISOString().split('T')[0])
      .lte('date', viernes.toISOString().split('T')[0])
    setEvents(ev || [])
    setLoading(false)
  }

  function setAsigVal(dow: number, recinto: string, zona: string, teamId: string) {
    setAsig(prev => ({
      ...prev,
      [dow]: { ...(prev[dow]||{}), [recinto]: { ...(prev[dow]?.[recinto]||{}), [zona]: teamId } }
    }))
  }

  // Calcular minutos de entreno por equipo (1 franja = 30 min)
  function minsDia(teamId: string, dow: number) {
    const fecha = fechaDia(dow)
    // De events ya guardados
    const fromEvents = events.filter(e => e.team_id === teamId && e.date === fecha).length * 30
    // De asignaciones nuevas (contamos si aparece en alguna franja de ese día)
    const dayAsig = asig[dow] || {}
    let fromAsig = 0
    for (const recinto of RECINTOS) {
      for (const zona of Object.keys(dayAsig[recinto]||{})) {
        if (dayAsig[recinto][zona] === teamId) fromAsig += 30
      }
    }
    return fromEvents + fromAsig
  }

  function minsSem(teamId: string) {
    return [0,1,2,3,4].reduce((acc, d) => acc + minsDia(teamId, d), 0)
  }

  async function guardar() {
    setSaving(true)
    // Para cada día y asignación crear eventos en Supabase
    const lunes = getLunes()
    const toCreate: any[] = []
    for (let d = 0; d < 5; d++) {
      const fecha = fechaDia(d)
      const dayAsig = asig[d] || {}
      for (const recinto of RECINTOS) {
        const zonas = dayAsig[recinto] || {}
        for (const [zona, teamId] of Object.entries(zonas)) {
          if (!teamId) continue
          // Buscar si ya existe ese entreno para no duplicar
          const existe = events.find(e => e.team_id === teamId && e.date === fecha && e.location === `${recinto} ${zona}`)
          if (!existe) {
            toCreate.push({
              team_id: teamId,
              type: 'entrenamiento',
              title: 'Entreno',
              date: fecha,
              time: franja + ':00',
              location: `${recinto} ${zona}`,
              created_by: session.id,
              updated_by: session.id,
            })
          }
        }
      }
    }
    if (toCreate.length > 0) {
      await supabase.from('events').insert(toCreate)
    }
    setSaving(false)
    setShowConfirm(false)
    router.back()
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><div className="spinner"/></div>

  const zonasDisp = {
    SanCa: getZonas('SanCa', dowIdx, franja),
    'Son Moix': getZonas('Son Moix', dowIdx, franja),
    'San Fernando': getZonas('San Fernando', dowIdx, franja),
  }

  return (
    <div className="page-content">
      {/* Modal confirmación guardar */}
      {showConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 20px'}}>
          <div style={{background:'var(--surface)',borderRadius:14,padding:'28px 24px',maxWidth:320,width:'100%',border:'1px solid var(--border)',textAlign:'center'}}>
            <div style={{fontSize:24,marginBottom:8}}>🏟️</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>¿Todo correcto?</div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Se programarán los entrenos en la agenda según la organización establecida.</div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={() => setShowConfirm(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-gold" style={{flex:1}} onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirm(true)}>‹ Salir</button>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontWeight:700,fontSize:15}}>Organización Entrenos</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Semana del {getLunes().toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => setShowConfirm(true)}>Guardar</button>
      </div>

      {/* Selector día */}
      <div style={{display:'flex',gap:4,marginBottom:12,overflowX:'auto'}}>
        {DIAS.map((d,i) => (
          <button key={d} onClick={() => setDowIdx(i)}
            className={'btn btn-sm '+(dowIdx===i ? 'btn-gold' : 'btn-ghost')}
            style={{flexShrink:0,fontSize:12,padding:'6px 10px'}}>
            {d.substring(0,3)}
          </button>
        ))}
      </div>

      {/* Selector franja */}
      <div style={{marginBottom:14}}>
        <select className="input" value={franja} onChange={e => setFranja(e.target.value)}>
          {FRANJAS.slice(0,-1).map((f,i) => (
            <option key={f} value={f}>{f} – {FRANJAS[i+1]}</option>
          ))}
        </select>
      </div>

      {/* Rectángulos recintos */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:18}}>
        {RECINTOS.map(recinto => {
          const zonas = zonasDisp[recinto as keyof typeof zonasDisp]
          const disp = zonas.length > 0
          return (
            <div key={recinto} style={{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{background: disp ? 'var(--accent)' : 'var(--surface-2)',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,fontSize:13,color: disp ? 'white' : 'var(--text-muted)'}}>🏟️ {recinto}</span>
                {!disp && <span style={{fontSize:11,color:'var(--text-muted)'}}>No disponible</span>}
              </div>
              {disp ? (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border)'}}>
                  {zonas.map(zona => {
                    const teamId = asig[dowIdx]?.[recinto]?.[zona] || ''
                    const team = teams.find(t => t.id === teamId)
                    return (
                      <div key={zona} style={{background:'var(--surface)',padding:'8px'}}>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:5,fontWeight:600}}>{zona}</div>
                        <select
                          style={{width:'100%',fontSize:12,padding:'4px 6px',borderRadius:6,
                            border:'2px solid '+(team ? tColor(team.name) : 'var(--border)'),
                            background: team ? tColor(team.name)+'22' : 'var(--surface)',
                            color:'var(--text)'}}
                          value={teamId}
                          onChange={e => setAsigVal(dowIdx, recinto, zona, e.target.value)}>
                          <option value="">— Libre —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {team && <div style={{marginTop:4,height:3,borderRadius:2,background:tColor(team.name)}}/>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{padding:'14px 12px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                  Sin franja disponible este día
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lista equipos con minutos día y semana */}
      <div style={{marginBottom:80}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>
          Minutos de entreno
        </div>
        <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 52px 52px',background:'var(--surface-2)',padding:'6px 10px'}}>
            <span style={{fontSize:11,fontWeight:600,color:'var(--text-muted)'}}>Equipo</span>
            <span style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textAlign:'center'}}>{DIAS[dowIdx].substring(0,3)}</span>
            <span style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textAlign:'center'}}>Sem</span>
          </div>
          {teams.map((t,i) => {
            const md = minsDia(t.id, dowIdx)
            const ms = minsSem(t.id)
            return (
              <div key={t.id} style={{display:'grid',gridTemplateColumns:'1fr 52px 52px',
                padding:'7px 10px',borderTop:'1px solid var(--border)',
                background: i%2===0 ? 'var(--surface)' : 'transparent'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:tColor(t.name),flexShrink:0}}/>
                  <span style={{fontSize:12}}>{t.name}</span>
                </div>
                <span style={{fontSize:12,textAlign:'center',color: md>0 ? 'var(--green)' : 'var(--text-muted)',fontWeight: md>0 ? 600 : 400}}>
                  {md > 0 ? md+"'" : '—'}
                </span>
                <span style={{fontSize:12,textAlign:'center',color: ms>0 ? 'var(--text)' : 'var(--text-muted)',fontWeight: ms>0 ? 600 : 400}}>
                  {ms > 0 ? ms+"'" : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNav role={session?.role} />
    </div>
  )
}