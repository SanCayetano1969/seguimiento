'use client'
import { useState, useEffect } from 'react'
import { supabase, getSession } from '@/lib/supabase'
import jsPDF from 'jspdf'

interface Props { team: any; players: any[]; matches: any[] }

const MOTIVOS = ['Lesión','Enfermedad','Viaje','Ausencia entrenos','Castigo','Decisión Técnica']
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

  useEffect(() => {
    supabase.from('convocatorias')
      .select('*, convocatoria_jugadores(*, players(name,dorsal))')
      .eq('team_id', team.id).order('created_at', { ascending: false })
      .then(({ data }) => setHistorial(data || []))
  }, [team.id, saving])

  function initForm() {
    const init: Record<string, any> = {}
    players.forEach(p => { init[p.id] = { estado: 'convocado', motivo: '', nota: '' } })
    setForm(f => ({ ...f, jugadores: init }))
    setShowForm(true)
  }

  async function guardar() {
    setSaving(true)
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

  async function generarPDF(conv: any) {
    setGenerating(true)
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
    const jornada = conv.jornada_numero ? { numero: conv.jornada_numero, rival: conv.rival, fecha: conv.fecha } : null
    if (jornada) {
      doc.setFontSize(11)
      doc.text('Jornada ' + jornada.numero + ' - ' + (jornada.rival || '') + '  |  ' + formatFecha(jornada.fecha), pw/2, 32, { align: 'center' })
    }
    doc.line(14, 36, pw - 14, 36)
    let y = 44
    doc.setFontSize(11)
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
      y += 4
    }
    doc.setFont('helvetica','bold')
    doc.text('JUGADORES CONVOCADOS', 14, y); y += 7
    doc.setFont('helvetica','normal')
    const convocados = (conv.convocatoria_jugadores || []).filter((j: any) => j.estado === 'convocado')
    convocados.forEach((j: any, i: number) => {
      const p = j.players
      doc.text((i+1) + '. ' + (p?.dorsal ? '#' + p.dorsal + '  ' : '') + (p?.name || ''), 14, y)
      y += 6
    })
    y += 6
    doc.line(14, y, pw - 14, y); y += 8
    doc.setFontSize(10)
    doc.text('Firmado por: ' + (team.entrenador_principal || 'El Entrenador Principal'), 14, y)
    doc.save('convocatoria_j' + (conv.jornada_numero || '') + '_' + (team.name || '').replace(/ /g,'_') + '.pdf')
    setGenerating(false)
  }

  const visible = open ? historial : historial.slice(0, 2)

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
                      J{c.jornada_numero} {c.rival ? '· ' + c.rival : ''}
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
          {visible.map(conv => (
            <div key={conv.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {conv.jornada_numero ? 'J' + conv.jornada_numero + ' - ' + (conv.rival || '') : 'Sin jornada'}
                  </span>
                  {conv.fecha && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{formatFecha(conv.fecha)}</span>}
                </div>
                <button className='btn btn-sm btn-ghost' style={{ fontSize: 11 }}
                  onClick={() => generarPDF(conv)} disabled={generating}>PDF</button>
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
              </div>
            </div>
          ))}
          {historial.length > 2 && (
            <button style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: '4px 0' }}
              onClick={() => {}}>
              {open ? '' : 'Ver ' + (historial.length - 2) + ' mas'}
            </button>
          )}
        </div>
      )}

      {/* MODAL FORM NUEVA CONVOCATORIA */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Nueva convocatoria</div>

            <label className='label'>Jornada</label>
            <select className='input' style={{ marginBottom: 12 }} value={form.jornada_id}
              onChange={e => setForm(f => ({ ...f, jornada_id: e.target.value }))}>
              <option value=''>Sin jornada</option>
              {matches.filter((m: any) => m.resultado_propio == null).map(m => (
                <option key={m.id} value={m.id}>J{m.jornada} - {m.rival || ''} {m.fecha ? '(' + m.fecha + ')' : ''}</option>
              ))}
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

            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Jugadores</div>
            {players.map(p => {
              const jug = form.jugadores[p.id] || { estado: 'convocado', motivo: '', nota: '' }
              return (
                <div key={p.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: jug.estado !== 'convocado' ? 8 : 0 }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                      {p.dorsal ? '#' + p.dorsal + ' ' : ''}{p.name}
                    </span>
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
              <button className='btn btn-gold' style={{ flex: 1 }} onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar convocatoria'}
              </button>
            </div>
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
              Ya existe una convocatoria para esta jornada. ¿Deseas reemplazarla?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className='btn btn-ghost'
                style={{ flex: 1 }}
                onClick={() => setConfirmReplace(null)}>
                Cancelar
              </button>
              <button
                className='btn btn-gold'
                style={{ flex: 1 }}
                disabled={saving}
                onClick={() => guardar(true)}>
                {saving ? 'Reemplazando...' : 'Reemplazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}