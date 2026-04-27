'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

type Team = { id: string; name: string; category: string }
type Slot = { desde: string; hasta: string; zonas: string[] }

const DISPONIBILIDAD: Record<string, Record<number, Slot[]>> = {
  'SanCa': {
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

function toMin(t: string) { const [h,m]=t.split(':').map(Number); return h*60+m }

function getZonas(campo: string, dow: number, hora: string): string[] {
  const slots = DISPONIBILIDAD[campo]?.[dow] || []
  const min = toMin(hora)
  for (const s of slots) { if (min>=toMin(s.desde) && min<toMin(s.hasta)) return s.zonas }
  return []
}

function teamColor(name: string): string {
  const n=(name||'').toLowerCase()
  if(n.includes('prebenjam')) return n.includes(' b')?'#fb923c':'#f97316'
  if(n.includes('benjam')){if(n.includes(' d'))return'#86efac';if(n.includes(' c'))return'#4ade80';if(n.includes(' b'))return'#22c55e';return'#16a34a'}
  if(n.includes('alev')){if(n.includes(' f'))return'#7dd3fc';if(n.includes(' e'))return'#38bdf8';if(n.includes(' d'))return'#0ea5e9';if(n.includes(' c'))return'#0284c7';if(n.includes(' b'))return'#0369a1';return'#1e3a8a'}
  if(n.includes('infantil')){if(n.includes(' c'))return'#c084fc';if(n.includes(' b'))return'#a855f7';return'#7c3aed'}
  if(n.includes('cadete'))return n.includes(' b')?'#f87171':'#dc2626'
  if(n.includes('juvenil'))return'#f59e0b'
  return'#64748b'
}

const FRANJAS: string[] = []
for(let h=17;h<22;h++){FRANJAS.push(h+':00');FRANJAS.push(h+':30')}
FRANJAS.push('22:00')
const DIAS = ['Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes']
const CAMPOS = ['SanCa','Son Moix','San Fernando']

export default function OrganizacionEntrenosPage() {
  const router = useRouter()
  const session = getSession()
  const [teams, setTeams] = useState<Team[]>([])
  const [diaIdx, setDiaIdx] = useState(0)
  const [hora, setHora] = useState('18:00')
  const [asig, setAsig] = useState<Record<string,string|null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const dow = diaIdx + 1

  useEffect(()=>{
    if(!session||!['admin','coordinator'].includes(session.role)){router.push('/dashboard');return}
    loadTeams()
  },[])

  async function loadTeams(){
    const {data}=await supabase.from('teams').select('id,name,category').order('category').order('name')
    setTeams(data||[])
    setLoading(false)
  }

  useEffect(()=>{ if(!loading) loadSlot(dow,hora) },[dow,hora,loading])

  async function loadSlot(d:number,h:string){
    const {data}=await supabase.from('field_assignments').select('*').eq('dia',d).eq('hora',h)
    const map:Record<string,string|null>={}
    if(data) data.forEach((a:any)=>{map[a.campo+'|'+a.zona]=a.team_id})
    setAsig(map)
  }

  async function handleAsignar(clave:string, teamId:string|null){
    const [campo,zona]=clave.split('|')
    setAsig(prev=>({...prev,[clave]:teamId}))
    setSaving(true)
    await supabase.from('field_assignments').upsert({dia:dow,hora,campo,zona,team_id:teamId},{onConflict:'dia,hora,campo,zona'})
    setSaving(false)
  }

  const equiposAsignados = Object.entries(asig)
    .filter(([,tid])=>tid)
    .map(([clave,tid])=>({clave,team:teams.find(t=>t.id===tid)}))

  if(loading) return <div style={{padding:24,textAlign:'center' as const}}>Cargando...</div>

  return (
    <div className="page-content" style={{paddingBottom:80}}>
      <div className="page-header" style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px'}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>router.push('/club')}>‹</button>
        <div>
          <div style={{fontWeight:700,fontSize:16}}>Organización de Entrenos</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Asignación de campos por franja horaria</div>
        </div>
        {saving&&<span style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)'}}>Guardando...</span>}
      </div>

      <div style={{padding:'0 12px 16px'}}>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Día</div>
            <select className="input" value={diaIdx} onChange={e=>setDiaIdx(+e.target.value)}>
              {DIAS.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Franja</div>
            <select className="input" value={hora} onChange={e=>setHora(e.target.value)}>
              {FRANJAS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Tres campos */}
        <div style={{display:'flex',gap:6,marginBottom:14,alignItems:'flex-start'}}>
          {CAMPOS.map(campo=>{
            const zonas=getZonas(campo,dow,hora)
            const disponible=zonas.length>0
            return (
              <div key={campo} style={{flex:1,border:'2px solid '+(disponible?'var(--accent)':'var(--border)'),borderRadius:10,overflow:'hidden',opacity:disponible?1:0.4}}>
                <div style={{background:disponible?'var(--accent)':'var(--surface)',padding:'7px 10px',fontWeight:700,fontSize:12,color:disponible?'white':'var(--text-muted)',textAlign:'center' as const}}>
                  {campo}
                  {!disponible&&<div style={{fontSize:10,fontWeight:400}}>No disponible</div>}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:6,background:'var(--bg)'}}>
                  {disponible?zonas.map(zona=>{
                    const clave=campo+'|'+zona
                    const tid=asig[clave]||null
                    const team=teams.find(t=>t.id===tid)
                    return (
                      <div key={zona} style={{border:'1px solid '+(team?teamColor(team.name):'var(--border)'),borderRadius:6,padding:'4px 6px',background:team?teamColor(team.name)+'22':'var(--surface)'}}>
                        <div style={{fontSize:9,color:'var(--text-muted)',marginBottom:3}}>{zona}</div>
                        <select style={{width:'100%',fontSize:10,padding:'2px 3px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:3,color:'var(--text)'}}
                          value={tid||''} onChange={e=>handleAsignar(clave,e.target.value||null)}>
                          <option value="">—</option>
                          {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {team&&<div style={{marginTop:2,fontSize:9,fontWeight:700,color:teamColor(team.name)}}>● {team.name}</div>}
                      </div>
                    )
                  }):(
                    <div style={{gridColumn:'1/-1',textAlign:'center' as const,padding:12,fontSize:11,color:'var(--text-muted)'}}>Sin disponibilidad</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Lista equipos asignados */}
        {equiposAsignados.length>0?(
          <div style={{background:'var(--surface)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--border)'}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:8}}>
              Equipos en {DIAS[diaIdx]} {hora}
            </div>
            {[...new Map(equiposAsignados.filter(e=>e.team).map(e=>[e.team!.id,e.team!])).values()].map(t=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:teamColor(t.name)}}/>
                  <span style={{fontSize:12}}>{t.name}</span>
                </div>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>30 min</span>
              </div>
            ))}
          </div>
        ):(
          <div style={{textAlign:'center' as const,padding:20,color:'var(--text-muted)',fontSize:12}}>
            No hay equipos asignados en esta franja
          </div>
        )}
      </div>

      <BottomNav role={session?.role||'coordinator'}/>
    </div>
  )
}