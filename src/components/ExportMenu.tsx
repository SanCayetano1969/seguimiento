'use client'
import { useState } from 'react'

// ─── TIPOS ───────────────────────────────────────────────────────────
export interface ExportColumn {
  header: string
  key: string
}

export interface ExportConfig {
  title: string
  filename: string
  columns: ExportColumn[]
  rows: Record<string, any>[]
  subtitle?: string
  extraColumns?: ExportColumn[]  // columnas adicionales (con estadisticas)
  extraRows?: Record<string, any>[]  // filas con datos extra
}

// ─── EXPORTAR A EXCEL ─────────────────────────────────────────────────
async function exportToExcel(config: ExportConfig, withExtra: boolean) {
  const XLSX = await import('xlsx')
  const cols = withExtra && config.extraColumns
    ? [...config.columns, ...config.extraColumns]
    : config.columns
  const rows = withExtra && config.extraRows ? config.extraRows : config.rows

  const data = [
    cols.map(c => c.header),
    ...rows.map(r => cols.map(c => r[c.key] ?? ''))
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  // Estilo cabecera (ancho columnas)
  ws['!cols'] = cols.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, config.title.substring(0, 31))
  XLSX.writeFile(wb, config.filename + (withExtra ? '_con_stats' : '') + '.xlsx')
}

// ─── EXPORTAR A PDF ────────────────────────────────────────────────────
async function exportToPDF(config: ExportConfig, withExtra: boolean) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const cols = withExtra && config.extraColumns
    ? [...config.columns, ...config.extraColumns]
    : config.columns
  const rows = withExtra && config.extraRows ? config.extraRows : config.rows

  const orientation = cols.length > 8 ? 'landscape' : 'portrait'
  const doc = new (jsPDF as any)({ orientation, unit: 'mm', format: 'a4' })

  // Cabecera
  doc.setFillColor(0, 48, 135)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CD San Cayetano', 10, 9)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(config.title, 10, 16)

  // Subtitulo
  if (config.subtitle) {
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.text(config.subtitle, 10, 26)
  }

  // Tabla
  autoTable(doc, {
    startY: config.subtitle ? 30 : 24,
    head: [cols.map(c => c.header)],
    body: rows.map(r => cols.map(c => String(r[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 48, 135], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [235, 243, 251] },
    margin: { left: 10, right: 10 },
  })

  // Pie
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      'CD San Cayetano · seguimiento-bice.vercel.app · ' + new Date().toLocaleDateString('es-ES'),
      10,
      doc.internal.pageSize.getHeight() - 5
    )
    doc.text(
      'Pag. ' + i + ' / ' + pageCount,
      doc.internal.pageSize.getWidth() - 25,
      doc.internal.pageSize.getHeight() - 5
    )
  }

  doc.save(config.filename + (withExtra ? '_con_stats' : '') + '.pdf')
}

// ─── COMPONENTE ────────────────────────────────────────────────────────
interface ExportMenuProps {
  config: ExportConfig
  hasExtra?: boolean  // true si tiene opcion "con estadisticas"
  extraLabel?: string  // etiqueta del extra (default: "Con estadísticas")
  size?: 'sm' | 'md'
}

export default function ExportMenu({ config, hasExtra = false, extraLabel = 'Con estadísticas', size = 'sm' }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle(format: 'excel' | 'pdf', withExtra: boolean) {
    setLoading(true)
    setOpen(false)
    try {
      if (format === 'excel') await exportToExcel(config, withExtra)
      else await exportToPDF(config, withExtra)
    } catch(e) {
      console.error('Export error:', e)
      alert('Error al exportar. Inténtalo de nuevo.')
    }
    setLoading(false)
  }

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: size === 'sm' ? '4px 10px' : '7px 14px',
    background: 'var(--surface2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 8,
    fontSize: size === 'sm' ? 11 : 13, fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button style={btnStyle} onClick={() => !loading && setOpen(o => !o)}>
        {loading ? '⏳' : '↓'} Exportar
      </button>

      {open && (
        <>
          {/* Overlay para cerrar */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 6, zIndex: 1000, minWidth: 190,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {/* SIN estadísticas */}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Sin estadísticas
            </div>
            <button onClick={() => handle('excel', false)} style={menuItemStyle}>📊 Excel (.xlsx)</button>
            <button onClick={() => handle('pdf', false)} style={menuItemStyle}>📄 PDF</button>

            {/* CON estadísticas */}
            {hasExtra && (
              <>
                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {extraLabel}
                </div>
                <button onClick={() => handle('excel', true)} style={menuItemStyle}>📊 Excel (.xlsx)</button>
                <button onClick={() => handle('pdf', true)} style={menuItemStyle}>📄 PDF</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '6px 12px', background: 'none', border: 'none',
  color: 'var(--text)', fontSize: 13, cursor: 'pointer',
  borderRadius: 6,
}