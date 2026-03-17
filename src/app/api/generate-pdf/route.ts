import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const reportId = searchParams.get('id')
  if (!reportId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: report } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const c = report.contenido
  const mesNombre = MESES[(c.mes || 1) - 1]

  // Generar HTML del informe para PDF
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; padding: 20px; }
  .header { background: #003087; color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.8; }
  .section { margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .section-title { background: #003087; color: white; padding: 8px 14px; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .section-body { padding: 12px 14px; }
  .stats-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .stat-box { text-align: center; min-width: 50px; }
  .stat-box .val { font-size: 22px; font-weight: 800; color: #003087; }
  .stat-box .lbl { font-size: 10px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f0f4ff; color: #003087; font-weight: 700; padding: 6px 8px; text-align: left; border-bottom: 2px solid #003087; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .partido-row { margin-bottom: 10px; padding: 10px; background: #f8f9ff; border-radius: 6px; border-left: 4px solid #003087; }
  .partido-titulo { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .partido-stats { display: flex; gap: 12px; font-size: 11px; color: #444; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 700; }
  .badge-conv { background: #dcfce7; color: #16a34a; }
  .badge-nodisp { background: #fee2e2; color: #dc2626; }
  .badge-noconv { background: #f3f4f6; color: #666; }
  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>CD San Cayetano</h1>
      <p>Informe Mensual — ${c.team_name} | ${mesNombre} ${c.anno}</p>
    </div>
  </div>

  <!-- TEMPORADA -->
  <div class="section">
    <div class="section-title">Resultados Temporada Completa</div>
    <div class="section-body">
      <div class="stats-row">
        ${[
          { val: c.temporada?.pj || 0, lbl: 'Partidos' },
          { val: c.temporada?.pg || 0, lbl: 'Victorias' },
          { val: c.temporada?.pe || 0, lbl: 'Empates' },
          { val: c.temporada?.pp || 0, lbl: 'Derrotas' },
          { val: c.temporada?.gf || 0, lbl: 'Goles F.' },
          { val: c.temporada?.gc || 0, lbl: 'Goles C.' },
        ].map(s => `<div class="stat-box"><div class="val">${s.val}</div><div class="lbl">${s.lbl}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- PARTIDOS DEL MES -->
  <div class="section">
    <div class="section-title">Partidos de ${mesNombre} ${c.anno}</div>
    <div class="section-body">
      ${c.partidos_mes?.length === 0
        ? '<p style="color:#999;font-style:italic">Sin partidos este mes</p>'
        : (c.partidos_mes || []).map((m: any) => {
            const rival = m.local ? `San Cayetano vs ${m.rival}` : `${m.rival} vs San Cayetano`
            const res = m.resultado_propio !== null ? `${m.resultado_propio}-${m.resultado_rival}` : 'Sin resultado'
            const s = m.stats
            return `<div class="partido-row">
              <div class="partido-titulo">J${m.jornada} — ${rival} <span style="color:#C8102E;font-weight:800">${res}</span> ${m.fecha ? '<span style="color:#666;font-size:11px">(' + m.fecha + ')</span>' : ''}</div>
              ${s ? `<div class="partido-stats">
                <span>GF: <b>${s.goles_marcados ?? 0}</b></span>
                <span>GC: <b>${s.goles_encajados ?? 0}</b></span>
                <span>🟨 <b>${s.tarjetas_amarillas ?? 0}</b></span>
                <span>🟥 <b>${s.tarjetas_rojas ?? 0}</b></span>
              </div>` : '<span style="color:#999;font-size:11px">Sin estadísticas de equipo</span>'}
            </div>`
          }).join('')
      }
    </div>
  </div>

  <!-- JUGADORES -->
  <div class="section">
    <div class="section-title">Jugadores — Estadísticas y Convocatorias</div>
    <div class="section-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Pos.</th>
            <th colspan="5" style="text-align:center;background:#e8f0ff">Temporada</th>
            <th colspan="5" style="text-align:center;background:#fff3cd">Mes</th>
            <th>Convocatorias ${mesNombre}</th>
          </tr>
          <tr>
            <th></th><th></th><th></th>
            <th style="background:#e8f0ff">PJ</th>
            <th style="background:#e8f0ff">MIN</th>
            <th style="background:#e8f0ff">GOL</th>
            <th style="background:#e8f0ff">ASI</th>
            <th style="background:#e8f0ff">🟨🟥</th>
            <th style="background:#fff3cd">PJ</th>
            <th style="background:#fff3cd">MIN</th>
            <th style="background:#fff3cd">GOL</th>
            <th style="background:#fff3cd">ASI</th>
            <th style="background:#fff3cd">🟨🟥</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${(c.jugadores || []).map((j: any) => {
            const t = j.temporada || {}
            const m2 = j.mes || {}
            const convs = (j.convocatorias_mes || []).map((cv: any) => {
              if (cv.estado === 'convocado') return `<span class="badge badge-conv">J${cv.jornada} ✓</span>`
              if (cv.estado === 'no_disponible') {
                const motivo = cv.nota_castigo ? `castigo: ${cv.nota_castigo}` : (cv.motivo || 'N/D')
                return `<span class="badge badge-nodisp" title="${motivo}">J${cv.jornada} ✗ (${motivo})</span>`
              }
              return `<span class="badge badge-noconv">J${cv.jornada} —</span>`
            }).join(' ')
            return `<tr>
              <td><b style="color:#003087">#${j.dorsal || '—'}</b></td>
              <td><b>${j.nombre}</b></td>
              <td style="color:#666">${j.posicion || '—'}</td>
              <td style="background:#e8f0ff">${t.pj || 0}</td>
              <td style="background:#e8f0ff">${t.minutos || 0}'</td>
              <td style="background:#e8f0ff">${t.goles || 0}</td>
              <td style="background:#e8f0ff">${t.asistencias || 0}</td>
              <td style="background:#e8f0ff">${t.amarillas || 0}/${t.rojas || 0}</td>
              <td style="background:#fff3cd">${m2.pj || 0}</td>
              <td style="background:#fff3cd">${m2.minutos || 0}'</td>
              <td style="background:#fff3cd">${m2.goles || 0}</td>
              <td style="background:#fff3cd">${m2.asistencias || 0}</td>
              <td style="background:#fff3cd">${m2.amarillas || 0}/${m2.rojas || 0}</td>
              <td>${convs || '<span style="color:#ccc">—</span>'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">Generado automáticamente por CD San Cayetano App · ${new Date().toLocaleDateString('es-ES')}</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    }
  })
}
