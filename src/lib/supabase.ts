import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── TIPOS ───────────────────────────────────────────────────

export type Role = 'admin' | 'coordinator' | 'secretary' | 'psychologist' | 'coach' | 'scout'

export type AppUser = {
  id: string
  name: string
  role: Role
  access_code: string
  avatar_url: string | null
  active: boolean
  created_at: string
}

export type Team = {
  id: string
  name: string
  category: string
  modalidad: 'F11' | 'F8'
  season: string
  active: boolean
}

export type Player = {
  id: string
  team_id: string
  name: string
  dorsal: number | null
  position: string
  foot: string
  birth_year: number | null
  active: boolean
}

export type Jornada = {
  id: string
  team_id: string
  number: number
  date: string | null
  type: string | null
}

export type Evaluation = {
  id: string
  jornada_id: string
  player_id: string
  team_id: string
  evaluator_id: string | null
  velocidad: number | null; resistencia: number | null; fuerza: number | null
  coordinacion: number | null; agilidad: number | null; reaccion: number | null
  tec1: number | null; tec2: number | null; tec3: number | null
  tec4: number | null; tec5: number | null; tec6: number | null
  tac1: number | null; tac2: number | null; tac3: number | null; tac4: number | null
  actitud: number | null; concentracion: number | null; confianza: number | null
  trabajo_equipo: number | null; gestion_error: number | null
  competitividad: number | null; fairplay: number | null
  media_fisica: number | null; media_tecnica: number | null
  media_tactica: number | null; media_psico: number | null
  minutos: number | null; notas: string | null
}

export type Event = {
  id: string
  team_id: string | null
  type: 'partido' | 'entrenamiento' | 'torneo' | 'otro'
  title: string
  date: string
  time: string | null
  location: string | null
  notes: string | null
  created_by: string | null
  teams?: { name: string; category: string } | null
}

export type EventRequest = {
  id: string
  event_id: string
  requester_id: string
  message: string
  status: 'pending' | 'resolved' | 'rejected'
  response: string | null
  created_at: string
  app_users?: { name: string; avatar_url: string | null }
  events?: Event
}

export type Announcement = {
  id: string
  title: string
  content: string
  author_id: string | null
  author_name: string
  pinned: boolean
  created_at: string
}

export type Message = {
  id: string
  from_user_id: string | null
  to_user_id: string | null
  subject: string | null
  body: string
  read: boolean
  created_at: string
  from_user?: { name: string; avatar_url: string | null; role: string }
  to_user?: { name: string; avatar_url: string | null }
}

export type PlayerMeeting = {
  id: string
  player_id: string
  author_id: string | null
  author_name: string
  author_role: string
  author_avatar: string | null
  content: string
  created_at: string
}

export type PlayerPsych = {
  id: string
  player_id: string
  author_id: string | null
  author_name: string
  author_avatar: string | null
  content: string
  created_at: string
}

export type ScoutPlayer = {
  id: string
  name: string
  birth_year: number
  current_club: string | null
  position1: string | null
  position2: string | null
  position3: string | null
  contact_phone: string | null
  contact_type: 'padre' | 'madre' | 'club' | 'otro' | null
  created_by: string | null
  created_at: string
}

export type ScoutNote = {
  id: string
  scout_player_id: string
  author_id: string | null
  author_name: string
  author_avatar: string | null
  content: string
  edited_at: string | null
  created_at: string
}

export type TrainingFile = {
  id: string
  title: string
  category: string
  description: string | null
  file_url: string
  file_name: string
  uploaded_by: string | null
  created_at: string
  app_users?: { name: string }
}

// ─── HELPERS DE SESIÓN ───────────────────────────────────────

export function getSession() {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem('sc_user')
  if (!raw) return null
  try { return JSON.parse(raw) as AppUser & { team_ids?: string[] } }
  catch { return null }
}

export function setSession(user: AppUser, team_ids?: string[]) {
  sessionStorage.setItem('sc_user', JSON.stringify({ ...user, team_ids }))
}

export function clearSession() {
  sessionStorage.removeItem('sc_user')
}

// ─── PERMISOS ────────────────────────────────────────────────

export function canEditAgenda(role: Role) {
  return ['admin', 'coordinator', 'secretary'].includes(role)
}

export function canEditEval(role: Role) {
  return ['admin', 'coordinator', 'coach', 'psychologist'].includes(role)
}

export function canEditLibrary(role: Role) {
  return ['admin', 'coordinator'].includes(role)
}

export function canSeePrivateNotes(role: Role) {
  return ['admin', 'coordinator', 'psychologist', 'coach'].includes(role)
}

export function canSeePsychNotes(role: Role) {
  return ['admin', 'coordinator', 'psychologist', 'coach'].includes(role)
}

export function hasFullAccess(role: Role) {
  return ['admin', 'coordinator'].includes(role)
}

// ─── COLORES DE SCORE ────────────────────────────────────────

export function scoreColor(v: number | null) {
  if (!v) return 'var(--text-muted)'
  if (v >= 8) return 'var(--green)'
  if (v >= 6) return 'var(--gold)'
  if (v >= 4) return 'var(--orange)'
  return 'var(--red)'
}

export function roleBadge(role: Role) {
  const map: Record<Role, { label: string; color: string }> = {
    admin:         { label: 'Admin',        color: '#9b59b6' },
    coordinator:   { label: 'Coordinador',  color: '#5bb8e8' },
    secretary:     { label: 'Secretario',   color: '#38A169' },
    secretario:    { label: 'Secretario',   color: '#38A169' },
    ejecutivo:     { label: 'Ejecutivo',    color: '#D97706' },
    psychologist:  { label: 'Psicólogo',    color: '#DD6B20' },
    coach:         { label: 'Entrenador',   color: '#F6AD55' },
    scout:         { label: 'Ojeador',      color: '#68D391' },
  }
  return map[role] ?? { label: role || 'Usuario', color: '#718096' }
}
