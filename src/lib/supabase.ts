import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Team = {
  id: string
  name: string
  category: string
  season: string
  coach_name: string
  password_hash: string
  created_at: string
}

export type Player = {
  id: string
  team_id: string
  name: string
  dorsal: number
  position: string
  foot: string
  created_at: string
}

export type Jornada = {
  id: string
  team_id: string
  number: number
  date: string | null
  type: string | null
  created_at: string
}

export type Evaluation = {
  id: string
  jornada_id: string
  player_id: string
  team_id: string
  // Física
  velocidad: number | null
  resistencia: number | null
  fuerza: number | null
  coordinacion: number | null
  agilidad: number | null
  reaccion: number | null
  // Técnica
  tec1: number | null; tec2: number | null; tec3: number | null
  tec4: number | null; tec5: number | null; tec6: number | null
  // Táctica
  tac1: number | null; tac2: number | null; tac3: number | null; tac4: number | null
  // Psicológica
  actitud: number | null
  concentracion: number | null
  confianza: number | null
  trabajo_equipo: number | null
  gestion_error: number | null
  competitividad: number | null
  fairplay: number | null
  // Computed
  media_fisica: number | null
  media_tecnica: number | null
  media_tactica: number | null
  media_psico: number | null
  media_global: number | null
  minutos: number | null
  notas: string | null
}
