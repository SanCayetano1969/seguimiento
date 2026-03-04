-- ============================================================
-- CD SAN CAYETANO — CANTERA APP
-- Ejecuta este SQL en Supabase > SQL Editor
-- ============================================================

-- EQUIPOS
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  season text not null default '2025/26',
  coach_name text,
  access_code text not null unique,  -- código simple para entrar (ej: "infantilb2025")
  created_at timestamptz default now()
);

-- JUGADORES
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  dorsal integer,
  position text default 'Por asignar',
  foot text default 'Derecho',
  active boolean default true,
  created_at timestamptz default now()
);

-- JORNADAS
create table if not exists jornadas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  number integer not null,
  date date,
  type text default 'Liga',
  created_at timestamptz default now(),
  unique(team_id, number)
);

-- EVALUACIONES (una por jugador por jornada)
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references jornadas(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  -- Física
  velocidad numeric(4,1), resistencia numeric(4,1), fuerza numeric(4,1),
  coordinacion numeric(4,1), agilidad numeric(4,1), reaccion numeric(4,1),
  -- Técnica
  tec1 numeric(4,1), tec2 numeric(4,1), tec3 numeric(4,1),
  tec4 numeric(4,1), tec5 numeric(4,1), tec6 numeric(4,1),
  -- Táctica
  tac1 numeric(4,1), tac2 numeric(4,1), tac3 numeric(4,1), tac4 numeric(4,1),
  -- Psicológica
  actitud numeric(4,1), concentracion numeric(4,1), confianza numeric(4,1),
  trabajo_equipo numeric(4,1), gestion_error numeric(4,1),
  competitividad numeric(4,1), fairplay numeric(4,1),
  -- Medias calculadas automáticamente
  media_fisica numeric(4,2) generated always as (
    round(((coalesce(velocidad,0)+coalesce(resistencia,0)+coalesce(fuerza,0)+coalesce(coordinacion,0)+coalesce(agilidad,0)+coalesce(reaccion,0)) /
    nullif(
      (case when velocidad is not null then 1 else 0 end +
       case when resistencia is not null then 1 else 0 end +
       case when fuerza is not null then 1 else 0 end +
       case when coordinacion is not null then 1 else 0 end +
       case when agilidad is not null then 1 else 0 end +
       case when reaccion is not null then 1 else 0 end), 0
    ))::numeric, 2)
  ) stored,
  media_tecnica numeric(4,2) generated always as (
    round(((coalesce(tec1,0)+coalesce(tec2,0)+coalesce(tec3,0)+coalesce(tec4,0)+coalesce(tec5,0)+coalesce(tec6,0)) /
    nullif(
      (case when tec1 is not null then 1 else 0 end + case when tec2 is not null then 1 else 0 end +
       case when tec3 is not null then 1 else 0 end + case when tec4 is not null then 1 else 0 end +
       case when tec5 is not null then 1 else 0 end + case when tec6 is not null then 1 else 0 end), 0
    ))::numeric, 2)
  ) stored,
  media_tactica numeric(4,2) generated always as (
    round(((coalesce(tac1,0)+coalesce(tac2,0)+coalesce(tac3,0)+coalesce(tac4,0)) /
    nullif(
      (case when tac1 is not null then 1 else 0 end + case when tac2 is not null then 1 else 0 end +
       case when tac3 is not null then 1 else 0 end + case when tac4 is not null then 1 else 0 end), 0
    ))::numeric, 2)
  ) stored,
  media_psico numeric(4,2) generated always as (
    round(((coalesce(actitud,0)+coalesce(concentracion,0)+coalesce(confianza,0)+coalesce(trabajo_equipo,0)+coalesce(gestion_error,0)+coalesce(competitividad,0)+coalesce(fairplay,0)) /
    nullif(
      (case when actitud is not null then 1 else 0 end + case when concentracion is not null then 1 else 0 end +
       case when confianza is not null then 1 else 0 end + case when trabajo_equipo is not null then 1 else 0 end +
       case when gestion_error is not null then 1 else 0 end + case when competitividad is not null then 1 else 0 end +
       case when fairplay is not null then 1 else 0 end), 0
    ))::numeric, 2)
  ) stored,
  minutos integer,
  notas text,
  created_at timestamptz default now(),
  unique(jornada_id, player_id)
);

-- Vista global del club (útil para el dashboard)
create or replace view club_overview as
select
  t.id as team_id,
  t.name as team_name,
  t.category,
  t.coach_name,
  count(distinct p.id) as total_players,
  count(distinct e.id) as total_evaluations,
  round(avg(e.media_fisica)::numeric, 2) as avg_fisica,
  round(avg(e.media_tecnica)::numeric, 2) as avg_tecnica,
  round(avg(e.media_tactica)::numeric, 2) as avg_tactica,
  round(avg(e.media_psico)::numeric, 2) as avg_psico,
  round(avg((e.media_fisica + e.media_tecnica + e.media_tactica + e.media_psico) / 4)::numeric, 2) as avg_global
from teams t
left join players p on p.team_id = t.id and p.active = true
left join evaluations e on e.team_id = t.id
group by t.id, t.name, t.category, t.coach_name;

-- Vista de talentos (jugadores con media >= 7)
create or replace view talent_radar as
select
  p.id as player_id,
  p.name as player_name,
  p.dorsal,
  p.position,
  t.name as team_name,
  t.category,
  round(avg(e.media_fisica)::numeric, 2) as avg_fisica,
  round(avg(e.media_tecnica)::numeric, 2) as avg_tecnica,
  round(avg(e.media_tactica)::numeric, 2) as avg_tactica,
  round(avg(e.media_psico)::numeric, 2) as avg_psico,
  round(avg((e.media_fisica + e.media_tecnica + e.media_tactica + e.media_psico) / 4)::numeric, 2) as avg_global
from players p
join teams t on t.id = p.team_id
join evaluations e on e.player_id = p.id
where p.active = true
group by p.id, p.name, p.dorsal, p.position, t.name, t.category
having round(avg((e.media_fisica + e.media_tecnica + e.media_tactica + e.media_psico) / 4)::numeric, 2) >= 7
order by avg_global desc;

-- Row Level Security (los entrenadores solo ven su equipo)
alter table teams enable row level security;
alter table players enable row level security;
alter table jornadas enable row level security;
alter table evaluations enable row level security;

-- Política pública de lectura para el dashboard de club (read-only)
create policy "Public read teams" on teams for select using (true);
create policy "Public read players" on players for select using (true);
create policy "Public read jornadas" on jornadas for select using (true);
create policy "Public read evaluations" on evaluations for select using (true);

-- Escritura solo con service_role (desde API routes de Next.js)
create policy "Service insert teams" on teams for insert with check (true);
create policy "Service insert players" on players for insert with check (true);
create policy "Service update players" on players for update using (true);
create policy "Service insert jornadas" on jornadas for insert with check (true);
create policy "Service upsert evaluations" on evaluations for insert with check (true);
create policy "Service update evaluations" on evaluations for update using (true);

-- Datos de ejemplo — Equipo Infantil B
insert into teams (name, category, coach_name, access_code) values
  ('Infantil B', 'Infantil', 'Entrenador Infantil B', 'infantilb2526'),
  ('Infantil A', 'Infantil', 'Entrenador Infantil A', 'infantila2526'),
  ('Cadete A',   'Cadete',   'Entrenador Cadete A',   'cadetea2526'),
  ('Alevín A',   'Alevín',   'Entrenador Alevín A',   'alevina2526')
on conflict do nothing;
