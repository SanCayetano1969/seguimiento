'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, roleBadge, type Message, type AppUser } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

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

  useEffect(() => {
    if (!session) { router.push('/'); return }
    loadInbox()

    // Realtime subscription
    const channel = supabase.channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadInbox()
        if (selected) loadThread(selected.id)
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
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>‹</button>
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
          {thread.map(m => {
            const mine = m.from_user_id === session.id
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: mine ? 'var(--navy-light)' : 'var(--surface2)',
                  fontSize: 14, lineHeight: 1.5,
                }}>
                  <p>{m.body}</p>
                  <div style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.5)' : 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                    {format(parseISO(m.created_at), "HH:mm", { locale: es })}
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

  // Inbox list
  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ fontWeight: 700, fontSize: 16 }}>💬 Mensajería</div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="loader animate-spin" /></div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {users.map(u => {
            const unread = unreadFrom(u.id)
            const last = lastMsg(u.id)
            const rb = roleBadge(u.role)
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)', textAlign: 'left',
                }}
              >
                {/* Avatar */}
                <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: rb.color + '33', color: rb.color, flexShrink: 0 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: unread > 0 ? 700 : 500, fontSize: 14, color: 'var(--text)' }}>{u.name}</span>
                    {last && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {format(parseISO(last.created_at), "HH:mm")}
                    </span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <span className="badge" style={{ background: rb.color + '22', color: rb.color, fontSize: 10 }}>{rb.label}</span>
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
          {users.length === 0 && <div className="empty-state"><div className="icon">👤</div><div>No hay otros usuarios</div></div>}
        </div>
      )}

      <BottomNav role={session.role} />
    </div>
  )
}
