'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, canEditLibrary, type TrainingFile } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const CATEGORIES = ['Físico', 'Técnico', 'Táctico', 'Porteros', 'Psicológico', 'Otros']

export default function BibliotecaPage() {
  const router  = useRouter()
  const session = getSession()
  const canEdit = canEditLibrary(session?.role || 'coach')

  const [files, setFiles]         = useState<TrainingFile[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ title: '', category: 'Técnico', description: '' })
  const [fileInput, setFileInput] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadFiles()
  }, [])

  async function loadFiles() {
    setLoading(true)
    const { data } = await supabase
      .from('training_files')
      .select('*, app_users(name)')
      .order('category')
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  async function uploadFile() {
    if (!fileInput || !form.title || !session) return
    setUploading(true)

    const ext = fileInput.name.split('.').pop()
    const fileName = `${Date.now()}-${fileInput.name.replace(/\s+/g, '_')}`

    const { data: uploaded, error } = await supabase.storage
      .from('training-files')
      .upload(fileName, fileInput, { contentType: fileInput.type })

    if (error) {
      alert('Error al subir el archivo: ' + error.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('training-files').getPublicUrl(fileName)

    await supabase.from('training_files').insert({
      title: form.title,
      category: form.category,
      description: form.description || null,
      file_url: urlData.publicUrl,
      file_name: fileInput.name,
      uploaded_by: session.id,
    })

    setUploading(false)
    setShowForm(false)
    setForm({ title: '', category: 'Técnico', description: '' })
    setFileInput(null)
    loadFiles()
  }

  async function deleteFile(file: TrainingFile) {
    const fileName = file.file_url.split('/').pop()
    if (fileName) await supabase.storage.from('training-files').remove([fileName])
    await supabase.from('training_files').delete().eq('id', file.id)
    loadFiles()
  }

  const filtered = filterCat ? files.filter(f => f.category === filterCat) : files
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catFiles = filtered.filter(f => f.category === cat)
    if (catFiles.length > 0) acc[cat] = catFiles
    return acc
  }, {} as Record<string, TrainingFile[]>)

  if (!session) return null

  return (
    <div className="page-content">
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>📚 Biblioteca</div>
        {canEdit && (
          <button className="btn btn-gold btn-sm" onClick={() => setShowForm(true)}>+ Subir PDF</button>
        )}
      </div>

      {/* Category filter */}
      <div className="scroll-row" style={{ padding: '12px 16px 0' }}>
        <button className={`btn btn-sm ${!filterCat ? 'btn-gold' : 'btn-ghost'}`}
          onClick={() => setFilterCat(null)}>Todos</button>
        {CATEGORIES.map(c => (
          <button key={c} className={`btn btn-sm ${filterCat === c ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setFilterCat(c)}>{c}</button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div className="empty-state"><div className="loader animate-spin" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="empty-state">
            <div className="icon">📚</div>
            <div>Sin archivos en la biblioteca</div>
            {canEdit && <div style={{ fontSize: 12 }}>Sube el primer PDF con el botón de arriba</div>}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catFiles]) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                {cat} <span style={{ fontWeight: 400, opacity: 0.6 }}>({catFiles.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catFiles.map(f => (
                  <div key={f.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{f.title}</div>
                      {f.description && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{f.description}</p>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {(f as any).app_users?.name} · {format(parseISO(f.created_at), "d MMM yyyy", { locale: es })}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <a
                          href={f.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          📥 Ver PDF
                        </a>
                        {canEdit && (
                          <button className="btn btn-danger btn-sm" onClick={() => deleteFile(f)}>🗑️ Borrar</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Subir archivo</h3>

            <label className="label">Título *</label>
            <input className="input" style={{ marginBottom: 12 }} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nombre del ejercicio/sesión" />

            <label className="label">Categoría</label>
            <select className="input" style={{ marginBottom: 12 }} value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label className="label">Descripción (opcional)</label>
            <textarea className="input" rows={2} style={{ marginBottom: 12 }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción..." />

            <label className="label">Archivo PDF *</label>
            <input
              type="file"
              accept=".pdf"
              onChange={e => setFileInput(e.target.files?.[0] || null)}
              style={{ marginBottom: 16, color: 'var(--text)', fontSize: 13, width: '100%' }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-gold btn-full" onClick={uploadFile}
                disabled={uploading || !form.title || !fileInput}>
                {uploading ? 'Subiendo...' : '⬆️ Subir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role={session.role} />
    </div>
  )
}
