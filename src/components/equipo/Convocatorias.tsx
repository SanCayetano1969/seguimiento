'use client'
import { useState, useEffect } from 'react'
import { supabase, getSession } from '@/lib/supabase'
import { cargarJugadoresOtrosEquipos, buscaTexto, TIPOS_PARTIDO_LBL, type JugadorInvitado } from '@/lib/categorias'
import jsPDF from 'jspdf'

interface Props { team: any; players: any[]; matches: any[] }

const MOTIVOS = ['Lesión','Enfermedad','Viaje','Ausencia entrenos','Sanción','Castigo','Decisión Técnica']
const EQUIPACIONES = ['Azul','Roja']

function formatFecha(str: string) {
  if (!str) return ''
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Convocatorias({ team, players, matches }: Props) {
  const session = getSession()
  const isCoach = session?.role === 'coach' || session?.role === 'admin' || session?.role === 'coordinator'
  const [open, setOpen] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    jornada_id: '', hora: '', lugar: '', equipacion: 'Azul', texto: '',
    jugadores: {} as Record<string, { estado: string; motivo: string; nota: string }>
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState<string|null>(null)   // pendiente de confirmar sustitución
  const [editingId, setEditingId] = useState<string|null>(null)             // convocatoria que se está editando

  // --- jugadores de otros equipos (misma categoría o inferior) ---
  const [teamNames, setTeamNames] = useState<Record<string, string>>({})
  const [invitados, setInvitados] = useState<JugadorInvitado[]>([])          // añadidos a ESTA convocatoria
  const [pool, setPool] = useState<JugadorInvitado[] | null>(null)           // candidatos (carga perezosa)
  const [showPicker, setShowPicker] = useState(false)
  const [loadingPool, setLoadingPool] = useState(false)
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    supabase.from('teams').select('id, name').then(({ data }) => {
      const m: Record<string, string> = {}
      ;(data || []).forEach((t: any) => { m[t.id] = t.name })
      setTeamNames(m)
    })
  }, [])

  useEffect(() => {
    supabase.from('convocatorias')
      .select('*, convocatoria_jugadores(*, players(name,dorsal,team_id))')
      .eq('team_id', team.id).order('created_at', { ascending: false })
      .then(({ data }) => setHistorial(data || []))
  }, [team.id, saving])

  /* ---------- Datos del partido asociado a una convocatoria ---------- */
  function datosPartido(conv: any) {
    const m = matches.find((x: any) => x.id === conv.jornada_id)
    const tipo = (m?.tipo || 'liga')
    const jornada = m?.jornada ?? conv.jornada_numero ?? null
    const rival = m?.rival || conv.rival || ''
    const fecha = m?.fecha || conv.fecha || ''
    const local = m ? (m.local !== false) : null
    const esLiga = tipo === 'liga'
    const cabecera = [
      TIPOS_PARTIDO_LBL[tipo] || 'PARTIDO',
      esLiga && jornada ? 'JORNADA ' + jornada : '',
      local === null ? '' : (local ? 'LOCAL' : 'VISITANTE'),
    ].filter(Boolean).join('   ·   ')
    const enfrentamiento = rival
      ? (local === false ? rival + '   vs   CD San Cayetano' : 'CD San Cayetano   vs   ' + rival)
      : ''
    // Etiqueta corta para el listado en pantalla
    const corta = [
      esLiga && jornada ? 'J' + jornada : (TIPOS_PARTIDO_LBL[tipo] || 'PARTIDO'),
      rival ? (local === false ? '@ ' + rival : 'vs ' + rival) : '',
    ].filter(Boolean).join(' · ')
    return { tipo, jornada, rival, fecha, local, esLiga, cabecera, enfrentamiento, corta }
  }

  /* ---------- Invitados ---------- */
  const esInvitado = (playerId: string) => !players.some(p => p.id === playerId)
  const nombreEquipoDe = (pl: any) => (pl?.team_id && pl.team_id !== team.id) ? (teamNames[pl.team_id] || 'Otro equipo') : ''

  async function abrirPicker() {
    setShowPicker(true)
    setBuscar('')
    if (pool === null) {
      setLoadingPool(true)
      const lista = await cargarJugadoresOtrosEquipos(team)
      setPool(lista)
      setLoadingPool(false)
    }
  }

  function addInvitado(p: JugadorInvitado) {
    setInvitados(list => list.some(x => x.id === p.id) ? list : [...list, p])
    setForm(f => ({ ...f, jugadores: { ...f.jugadores, [p.id]: { estado: 'convocado', motivo: '', nota: '' } } }))
    setShowPicker(false)
  }

  function quitarInvitado(id: string) {
    setInvitados(list => list.filter(x => x.id !== id))
    setForm(f => {
      const j = { ...f.jugadores }
      delete j[id]
      return { ...f, jugadores: j }
    })
  }

  function initForm() {
    const init: Record<string, any> = {}
    players.forEach(p => { init[p.id] = { estado: 'convocado', motivo: '', nota: '' } })
    setForm({ jornada_id: '', hora: '', lugar: '', equipacion: 'Azul', texto: '', jugadores: init })
    setInvitados([])
    setConfirmReplace(null)
    setEditingId(null)
    setShowForm(true)
  }

  async function checkAndGuardar() {
    if (!form.jornada_id) return
    setSaving(true)
    const { data: existing } = await supabase
      .from('convocatorias')
      .select('id, jornada_numero')
      .eq('team_id', team.id)
      .eq('jornada_id', form.jornada_id)
      .maybeSingle()
    setSaving(false)
    // Si ya hay otra convocatoria para ese partido (distinta de la que se edita), pedir confirmación
    if (existing && existing.id !== editingId) {
      setShowForm(false)
      setConfirmReplace(existing.id)
      return
    }
    await guardar()
  }

  async function guardar() {
    setSaving(true)
    const aBorrar = confirmReplace || editingId
    if (aBorrar) {
      await supabase.from('convocatorias').delete().eq('id', aBorrar)
      setConfirmReplace(null)
      setEditingId(null)
    }
    const selectedMatch = matches.find((m: any) => m.id === form.jornada_id)
    const { data: conv } = await supabase.from('convocatorias').insert({
      team_id: team.id,
      jornada_id: form.jornada_id || null,
      jornada_numero: selectedMatch?.jornada || null,
      rival: selectedMatch?.rival || null,
      fecha: selectedMatch?.fecha || null,
      hora: form.hora,
      lugar: form.lugar,
      equipacion: form.equipacion,
      texto: form.texto || null,
      creado_por: session?.id,
    }).select().single()
    if (conv) {
      const rows = Object.entries(form.jugadores).map(([pid, v]: any) => ({
        convocatoria_id: conv.id,
        player_id: pid,
        estado: v.estado,
        motivo_no_disponible: v.estado !== 'convocado' ? v.motivo : null,
        nota_castigo: v.motivo === 'Castigo' ? v.nota : null,
      }))
      await supabase.from('convocatoria_jugadores').insert(rows)
    }
    setSaving(false)
    setShowForm(false)
  }

  function editarConvocatoria(c: any) {
    const jugadoresMap: Record<string, {estado: string, motivo: string, nota: string}> = {}
    const inv: JugadorInvitado[] = []
    ;(c.convocatoria_jugadores || []).forEach((j: any) => {
      jugadoresMap[j.player_id] = {
        estado: j.estado || 'convocado',
        motivo: j.motivo_no_disponible || '',
        nota: j.nota_castigo || ''
      }
      // jugador que no pertenece a la plantilla de este equipo → invitado
      const pl = j.players
      if (pl && esInvitado(j.player_id)) {
        inv.push({
          id: j.player_id, name: pl.name, dorsal: pl.dorsal ?? null, position: null,
          team_id: pl.team_id, team_name: teamNames[pl.team_id] || 'Otro equipo',
        })
      }
    })
    setForm({
      jornada_id: c.jornada_id || '',
      hora: c.hora || '',
      lugar: c.lugar || '',
      equipacion: c.equipacion || 'Azul',
      texto: c.texto || '',
      jugadores: jugadoresMap
    })
    setInvitados(inv)
    setConfirmReplace(null)
    setEditingId(c.id)
    setShowForm(true)
  }

  async function generarPDF(conv: any) {
    setGenerating(true)
    const dp = datosPartido(conv)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = doc.internal.pageSize.getWidth()
    // Cabecera
    try {
      const img = await fetch('/escudo.jpeg').then(r => r.blob()).then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b) }))
      doc.addImage(img, 'JPEG', 14, 10, 20, 20)
    } catch {}
    doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text('CONVOCATORIA', pw/2, 18, { align: 'center' })
    doc.setFontSize(12); doc.setFont('helvetica','normal')
    doc.text(team.name || '', pw/2, 25, { align: 'center' })

    // ── Bloque del partido ──────────────────────────────────────
    let hy = 32
    if (dp.cabecera) {
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(15,40,69)
      doc.text(dp.cabecera, pw/2, hy, { align: 'center' })
      hy += 6
    }
    if (dp.enfrentamiento) {
      doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text(dp.enfrentamiento, pw/2, hy, { align: 'center' })
      hy += 6
    }
    if (dp.fecha) {
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(90,90,90)
      doc.text(formatFecha(dp.fecha), pw/2, hy, { align: 'center' })
      hy += 5
    }
    doc.setTextColor(0,0,0)
    const lineY = hy + 2
    doc.line(14, lineY, pw - 14, lineY)
    let y = lineY + 8

    doc.setFontSize(11); doc.setFont('helvetica','normal')
    if (conv.hora) { doc.text('Hora: ' + conv.hora, 14, y); y += 7 }
    if (conv.lugar) { doc.text('Lugar: ' + conv.lugar, 14, y); y += 7 }
    if (conv.equipacion) { doc.text('Equipación: ' + conv.equipacion, 14, y); y += 7 }
    y += 4
    if (conv.texto) {
      doc.setFont('helvetica','normal')
      doc.setFontSize(11)
      doc.setTextColor(60,60,60)
      const lines = doc.splitTextToSize(conv.texto, 182)
      lines.forEach((line: string) => { doc.text(line, 14, y); y += 6 })
      doc.setTextColor(0,0,0)
      y += 4
    }
    doc.setFont('helvetica','bold')
    doc.text('JUGADORES CONVOCADOS', 14, y); y += 7
    doc.setFont('helvetica','normal')
    const convocados = (conv.convocatoria_jugadores || []).filter((j: any) => j.estado === 'convocado')
    convocados.forEach((j: any, i: number) => {
      const p = j.players
      const otro = nombreEquipoDe(p)
      if (y > 272) { doc.addPage(); y = 20 }
      const base = (i+1) + '. ' + (p?.dorsal ? '#' + p.dorsal + '  ' : '') + (p?.name || '')
      doc.text(base, 14, y)
      if (otro) {
        const w = doc.getTextWidth(base)
        doc.setFontSize(9); doc.setTextColor(120,120,120)
        doc.text('(' + otro + ')', 14 + w + 3, y)
        doc.setFontSize(11); doc.setTextColor(0,0,0)
      }
      y += 6
    })
    y += 6
    doc.line(14, y, pw - 14, y); y += 8
    // ── No disponibles ──────────────────────────────────────────
    const noDisponibles = (conv.convocatoria_jugadores || []).filter((j: any) => j.estado !== 'convocado')
    if (noDisponibles.length > 0) {
      y += 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('No disponibles', 14, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      noDisponibles.forEach((j: any) => {
        const p = j.players
        const otro = nombreEquipoDe(p)
        const nombre = (p?.dorsal ? '#' + p.dorsal + '  ' : '') + (p?.name || '') + (otro ? ' (' + otro + ')' : '')
        const motivo = j.motivo_no_disponible || 'No disponible'
        const nota = j.nota_castigo ? ' (' + j.nota_castigo + ')' : ''
        const linea = nombre + '  —  ' + motivo + nota
        if (y > 272) { doc.addPage(); y = 20 }
        doc.text(linea, 14, y)
        y += 6
      })
    }

    y += 10
    if (y > 272) { doc.addPage(); y = 20 }
    doc.setFontSize(10)
    doc.text('Firmado por: ' + (team.entrenador_principal || 'El Entrenador Principal'), 14, y)
    const sufijo = dp.esLiga && dp.jornada ? 'j' + dp.jornada : (dp.tipo || 'partido')
    doc.save('convocatoria_' + sufijo + '_' + (team.name || '').replace(/ /g,'_') + '.pdf')
    setGenerating(false)
  }

  const visible = open ? historial : historial.slice(0, 2)

  // Lista completa del formulario: plantilla propia + invitados
  const filaJugadores: any[] = [...players, ...invitados]
  const poolFiltrado = (pool || [])
    .filter(p => !form.jugadores[p.id])
    .filter(p => {
      const q = buscaTexto(buscar)
      if (q.length < 1) return true
      return buscaTexto(p.name).includes(q) || buscaTexto(p.team_name).includes(q)
    })

  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 16px', background: 'var(--surface)', border: 'none',
          cursor: 'pointer', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>Convocatorias</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? 'cerrar' : 'ver todo'}</span>
        </div>
      </button>
      {!open && (
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {historial.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin convocatorias</span>
                : historial.slice(0, 2).map(c => (
                    <span key={c.id} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 4, padding: '2px 8px' }}>
                      {datosPartido(c).corta}
                    </span>
                  ))
              }
              {historial.length > 2 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{historial.length - 2} más</span>
              )}
            </div>
        )}

      {open && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px' }}>
          {isCoach && (
            <button className='btn btn-gold' style={{ width: '100%', marginBottom: 12, fontSize: 13 }}
              onClick={initForm}>+ Nueva convocatoria</button>
          )}
          {historial.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Sin convocatorias todavia</div>}
          {visible.map(conv => {
            const dp = datosPartido(conv)
            const nInv = (conv.convocatoria_jugadores || []).filter((j: any) => j.estado === 'convocado' && nombreEquipoDe(j.players)).length
            return (
            <div key={conv.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{dp.corta || 'Sin partido'}</span>
                  {!dp.esLiga && dp.rival && (
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.3px', padding: '1px 6px', borderRadius: 5, background: 'var(--surface3)', color: 'var(--gold)', marginLeft: 6 }}>
                      {TIPOS_PARTIDO_LBL[dp.tipo] || 'PARTIDO'}
                    </span>
                  )}
                  {dp.fecha && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{formatFecha(dp.fecha)}</span>}
                </div>
                <button className='btn btn-sm btn-ghost' style={{ fontSize: 11 }}
                  onClick={() => generarPDF(conv)} disabled={generating}>PDF</button>
                <button className='btn btn-sm btn-ghost' style={{ fontSize: 11, marginLeft: 4 }}
                  onClick={() => editarConvocatoria(conv)}>✏️</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {conv.hora && <span>{conv.hora}h </span>}
                {conv.lugar && <span>· {conv.lugar} </span>}
                {conv.equipacion && <span>· Eq. {conv.equipacion}</span>}
              </div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <span style={{ color: '#22c55e' }}>{(conv.convocatoria_jugadores||[]).filter((j:any)=>j.estado==='convocado').length} convocados</span>
                {(conv.convocatoria_jugadores||[]).filter((j:any)=>j.estado!=='convocado').length > 0 && (
                  <span style={{ color: '#ef4444', marginLeft: 8 }}>
                    {(conv.convocatoria_jugadores||[]).filter((j:any)=>j.estado!=='convocado').length} no disponibles
                  </span>
                )}
                {nInv > 0 && (
                  <span style={{ color: 'var(--gold)', marginLeft: 8 }}>{nInv} de otros equipos</span>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* MODAL FORM NUEVA CONVOCATORIA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Nueva convocatoria</div>

            <label className='label'>Partido</label>
            <select className='input' style={{ marginBottom: 12 }} value={form.jornada_id}
              onChange={e => setForm(f => ({ ...f, jornada_id: e.target.value }))}>
              <option value=''>Sin partido</option>
              {matches.filter((m: any) => m.resultado_propio == null).map(m => {
                const esL = (m.tipo || 'liga') === 'liga'
                const et = esL ? ('J' + (m.jornada ?? '')) : (TIPOS_PARTIDO_LBL[m.tipo] || 'PARTIDO')
                return (
                  <option key={m.id} value={m.id}>
                    {et} · {m.local === false ? '@ ' : 'vs '}{m.rival || ''}{m.fecha ? ' (' + m.fecha + ')' : ''}
                  </option>
                )
              })}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className='label'>Hora</label>
                <input className='input' type='time' value={form.hora}
                  onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
              </div>
              <div>
                <label className='label'>Equipación</label>
                <select className='input' value={form.equipacion}
                  onChange={e => setForm(f => ({ ...f, equipacion: e.target.value }))}>
                  {EQUIPACIONES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
            </div>
            <label className='label'>Lugar</label>
            <input className='input' style={{ marginBottom: 16 }} placeholder='Campo, ciudad...' value={form.lugar}
              onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} />

            <textarea
              placeholder="Texto para el PDF (opcional)"
              value={form.texto}
              onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
              rows={3}
              style={{ width: '100%', marginBottom: 12, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Jugadores</div>
              <button className='btn btn-sm btn-ghost' style={{ marginLeft: 'auto', fontSize: 12 }}
                onClick={abrirPicker}>+ Jugador de otro equipo</button>
            </div>

            {filaJugadores.map(p => {
              const jug = form.jugadores[p.id] || { estado: 'convocado', motivo: '', nota: '' }
              const invitado = !!p.team_name
              return (
                <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8,
                  border: invitado ? '1px solid var(--gold)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: jug.estado !== 'convocado' ? 8 : 0 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                      {p.dorsal ? '#' + p.dorsal + ' ' : ''}{p.name}
                      {invitado && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gold)', background: 'var(--surface3)', borderRadius: 5, padding: '1px 6px', marginLeft: 6 }}>
                          {p.team_name}
                        </span>
                      )}
                    </span>
                    {invitado && (
                      <button onClick={() => quitarInvitado(p.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                        title='Quitar de la convocatoria'>✕</button>
                    )}
                    <select style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6,
                      background: jug.estado === 'convocado' ? '#14532d' : '#7f1d1d',
                      color: 'white', border: 'none', cursor: 'pointer' }}
                      value={jug.estado}
                      onChange={e => setForm(f => ({ ...f, jugadores: { ...f.jugadores, [p.id]: { ...jug, estado: e.target.value } } }))}>
                      <option value='convocado'>Convocado</option>
                      <option value='no_disponible'>No disponible</option>
                    </select>
                  </div>
                  {jug.estado === 'no_disponible' && (
                    <div>
                      <select className='input' style={{ fontSize: 12, height: 30, marginBottom: 4 }}
                        value={jug.motivo}
                        onChange={e => setForm(f => ({ ...f, jugadores: { ...f.jugadores, [p.id]: { ...jug, motivo: e.target.value } } }))}>
                        <option value=''>Motivo...</option>
                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {jug.motivo === 'Castigo' && (
                        <input className='input' style={{ fontSize: 12, height: 30 }}
                          placeholder='Explicar motivo del castigo...'
                          value={jug.nota}
                          onChange={e => setForm(f => ({ ...f, jugadores: { ...f.jugadores, [p.id]: { ...jug, nota: e.target.value } } }))} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className='btn btn-ghost' style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancelar</button>
              <button className='btn btn-gold' style={{ flex: 1 }} onClick={checkAndGuardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar convocatoria'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: elegir jugador de otro equipo */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowPicker(false)}>
          <div style={{ width: '100%', maxWidth: 460, maxHeight: '82vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Jugador de otro equipo</div>
              <button onClick={() => setShowPicker(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Solo equipos de la misma categoría o inferior.
            </div>
            <input className='input' placeholder='Buscar por nombre o equipo...' value={buscar}
              onChange={e => setBuscar(e.target.value)} style={{ marginBottom: 12 }} />
            {loadingPool && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Cargando jugadores…</div>}
            {!loadingPool && poolFiltrado.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                No hay jugadores disponibles con ese criterio.
              </div>
            )}
            {poolFiltrado.slice(0, 60).map(p => (
              <div key={p.id} onClick={() => addInvitado(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--surface2)', marginBottom: 6, cursor: 'pointer' }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--gold)', fontSize: 12 }}>{p.dorsal ?? '·'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.team_name}{p.position ? ' · ' + p.position : ''}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--gold)', fontWeight: 800, fontSize: 18 }}>+</div>
              </div>
            ))}
            {poolFiltrado.length > 60 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
                Afina la búsqueda: hay {poolFiltrado.length} coincidencias.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmación reemplazar convocatoria */}
      {confirmReplace && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px'
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 14,
            padding: '28px 24px', maxWidth: 340, width: '100%',
            border: '1px solid var(--border)', textAlign: 'center' as const
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Convocatoria ya existe
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Ya existe una convocatoria para este partido. ¿Deseas reemplazarla?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className='btn btn-ghost'
                style={{ flex: 1 }}
                onClick={() => { setConfirmReplace(null); setShowForm(true) }}>
                Cancelar
              </button>
              <button
                className='btn btn-gold'
                style={{ flex: 1 }}
                disabled={saving}
                onClick={guardar}>
                {saving ? 'Reemplazando...' : 'Reemplazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
