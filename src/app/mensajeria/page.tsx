'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, roleBadge, type Message, type AppUser } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, isToday, isYesterday, isSameDay, isSameYear, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'

// Separador de día dentro de la conversación: «Hoy», «Ayer», «lunes 19 oct», «19 oct 2025»
function etiquetaDia(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return 'Hoy'
  if (isYesterday(d)) return 'Ayer'
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEEE d MMM", { locale: es })
  return isSameYear(d, new Date()) ? format(d, "d MMM", { locale: es }) : format(d, "d MMM yyyy", { locale: es })
}

// Fecha corta en el listado: «14:05» hoy, «Ayer 14:05», «lun 14:05» esta semana, «19/10 14:05» antes
function fechaListado(iso: string) {
  const d = parseISO(iso)
  const h = format(d, 'HH:mm')
  if (isToday(d)) return h
  if (isYesterday(d)) return 'Ayer ' + h
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, 'EEE', { locale: es }) + ' ' + h
  return format(d, isSameYear(d, new Date()) ? 'dd/MM' : 'dd/MM/yy') + ' ' + h
}

export default function MensajeriaPage() {
  const router = useRouter()
  const session = getSession()

  const [users, setUsers]       = useState<AppUser[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [thread, setThread]     = useState<Message[]>([])
  const [body, setBody]         = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<AppUser | null>(null)
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadInbox()

    // Realtime subscription
    const channel = supabase.channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadInbox()
        if (selectedRef.current) loadThread(selectedRef.current.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (selected) loadThread(selected.id)
  }, [selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  async function loadInbox() {
    if (!session) return
    setLoading(true)

    // All users except self
    const { data: usersData } = await supabase
      .from('app_users')
      .select('*')
      .eq('active', true)
      .neq('id', session.id)
      .order('name')

    // My messages (sent + received)
    const { data: msgsData } = await supabase
      .from('messages')
      .select('*, from_user:app_users!messages_from_user_id_fkey(name,avatar_url,role), to_user:app_users!messages_to_user_id_fkey(name,avatar_url)')
      .or(`from_user_id.eq.${session.id},to_user_id.eq.${session.id}`)
      .order('created_at', { ascending: false })

    setUsers(usersData || [])
    setMessages(msgsData || [])
    setLoading(false)
  }

  async function loadThread(userId: string) {
    if (!session) return
    const { data } = await supabase
      .from('messages')
      .select('*, from_user:app_users!messages_from_user_id_fkey(name,avatar_url,role)')
      .or(`and(from_user_id.eq.${session.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${session.id})`)
      .order('created_at')
    setThread(data || [])

    // Mark as read
    await supabase.from('messages')
      .update({ read: true })
      .eq('from_user_id', userId)
      .eq('to_user_id', session.id)
      .eq('read', false)
    // y quitar el contador en la lista sin esperar a recargar
    setMessages(ms => ms.map(m => (m.from_user_id === userId && m.to_user_id === session.id) ? { ...m, read: true } : m))
  }

  function volverALista() {
    setSelected(null)
    loadInbox()
  }

  async function sendMessage() {
    if (!body.trim() || !selected || !session) return
    setSending(true)
    await supabase.from('messages').insert({
      from_user_id: session.id,
      to_user_id: selected.id,
      body: body.trim(),
    })
    // Enviar notificacion push al destinatario
    fetch('/api/push/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toUserId: selected.id,
        fromName: session.name || 'Mensaje nuevo',
        body: body.trim().substring(0, 80)
      })
    }).catch(() => {}) // silencioso si falla
    setBody('')
    setSending(false)
    loadThread(selected.id)
  }

  // Get unread count per user
  function unreadFrom(userId: string) {
    return messages.filter(m => m.from_user_id === userId && m.to_user_id === session?.id && !m.read).length
  }

  // Last message per user
  function lastMsg(userId: string) {
    return messages.find(m => m.from_user_id === userId || m.to_user_id === userId)
  }

  if (!session) return null

  // Conversation view
  if (selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <div className="page-header">
          <button className="btn btn-ghost btn-sm" onClick={volverALista}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span className="badge" style={{ background: roleBadge(selected.role).color + '22', color: roleBadge(selected.role).color, fontSize: 10 }}>
                {roleBadge(selected.role).label}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {thread.map((m, i) => {
            const mine = m.from_user_id === session.id
            const nuevoDia = i === 0 || !isSameDay(parseISO(thread[i - 1].created_at), parseISO(m.created_at))
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {nuevoDia && (
                <div style={{ alignSelf: 'center', margin: '8px 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 99, padding: '3px 12px', textTransform: 'capitalize' }}>
                  {etiquetaDia(m.created_at)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: mine ? 'var(--navy-light)' : 'var(--surface2)',
                  fontSize: 14, lineHeight: 1.5,
                }}>
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
                  <div style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                    {format(parseISO(m.created_at), "HH:mm", { locale: es })}
                  </div>
                </div>
              </div>
              </div>
            )
          })}
          {thread.length === 0 && (
            <div className="empty-state"><div className="icon">💬</div><div style={{ fontSize: 13 }}>Inicia la conversación</div></div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px', paddingBottom: 'calc(12px + var(--safe-bottom))',
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8,
        }}>
          <input
            className="input"
            placeholder="Escribe un mensaje..."
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-gold" onClick={sendMessage} disabled={sending || !body.trim()}
            style={{ padding: '10px 14px', flexShrink: 0 }}>
            {sending ? '...' : '→'}
          </button>
        </div>
      </div>
    )
  }

  // Inbox list: primero las conversaciones con mensajes sin leer, luego las recientes, luego el resto (A-Z)
  const filas = users.map(u => ({ u, unread: unreadFrom(u.id), last: lastMsg(u.id) }))
  const t = (f: any) => f.last ? parseISO(f.last.created_at).getTime() : 0
  const sinLeer = filas.filter(f => f.unread > 0).sort((a, b) => t(b) - t(a))
  const recientes = filas.filter(f => f.unread === 0 && f.last).sort((a, b) => t(b) - t(a))
  const resto = filas.filter(f => !f.last)
  const totalSinLeer = sinLeer.reduce((n, f) => n + f.unread, 0)
  const secciones = [
    { titulo: 'Sin leer', lista: sinLeer },
    { titulo: 'Conversaciones', lista: recientes },
    { titulo: 'Otros usuarios', lista: resto },
  ].filter(sc => sc.lista.length > 0)

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ fontWeight: 700, fontSize: 16 }}>💬 Mensajería</div>
        {totalSinLeer > 0 && (
          <span style={{ marginLeft: 'auto', background: 'var(--gold)', color: 'var(--navy-dark)', borderRadius: 99, fontSize: 12, fontWeight: 800, padding: '2px 10px' }}>
            {totalSinLeer} sin leer
          </span>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {secciones.map(sc => (
            <div key={sc.titulo}>
            <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: sc.titulo === 'Sin leer' ? 'var(--gold)' : 'var(--text-muted)' }}>
              {sc.titulo}
            </div>
          {sc.lista.map(({ u, unread, last }) => {
            const rb = roleBadge(u.role)
            const previa = last ? ((last.from_user_id === session.id ? 'Tú: ' : '') + (last.body || '').replace(/\s+/g, ' ')) : ''
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px 12px 13px', cursor: 'pointer', textAlign: 'left',
                  background: unread > 0 ? 'rgba(212,175,55,0.10)' : 'none',
                  border: 'none', borderLeft: '3px solid ' + (unread > 0 ? 'var(--gold)' : 'transparent'),
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Avatar */}
                <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: rb.color + '33', color: rb.color, flexShrink: 0 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: unread > 0 ? 700 : 500, fontSize: 14, color: 'var(--text)' }}>{u.name}</span>
                    {last && <span style={{ fontSize: 11, flexShrink: 0, marginLeft: 8, color: unread > 0 ? 'var(--gold)' : 'var(--text-muted)', fontWeight: unread > 0 ? 700 : 400 }}>
                      {fechaListado(last.created_at)}
                    </span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 8 }}>
                    <span style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: unread > 0 ? 'var(--text)' : 'var(--text-muted)', fontWeight: unread > 0 ? 600 : 400 }}>
                      {previa || <span className="badge" style={{ background: rb.color + '22', color: rb.color, fontSize: 10 }}>{rb.label}</span>}
                    </span>
                    {unread > 0 && (
                      <span style={{ background: 'var(--gold)', color: 'var(--navy-dark)', borderRadius: '99px', fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
            </div>
          ))}
          {users.length === 0 && <div className="empty-state"><div className="icon">👤</div><div>No hay otros usuarios</div></div>}
        </div>
      )}

      <BottomNav role={session.role} />
    </div>
  )
}
