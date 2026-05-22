-- ============================================================
-- Sueldo Choferes — Schema Supabase
-- ============================================================
-- Pasos para usar:
--   1. Ir a Supabase Dashboard > SQL Editor y pegar este archivo.
--   2. Crear los usuarios desde Authentication > Users > Add user:
--        nacho   / nacho
--        damian  / 2026
--   3. Anotar los UUIDs generados y usarlos en el INSERT de abajo.
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: choferes
-- ------------------------------------------------------------
create table public.choferes (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  nombre        text        not null,
  telefono      text,
  observaciones text,
  created_at    timestamptz default now() not null
);

-- ------------------------------------------------------------
-- Tabla: viajes
-- ------------------------------------------------------------
create table public.viajes (
  id            uuid        default gen_random_uuid() primary key,
  chofer_id     uuid        references public.choferes(id) on delete cascade not null,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  fecha         date        not null,
  importe       numeric(12,2) not null default 0,
  pagado        boolean     not null default false,
  observaciones text,
  created_at    timestamptz default now() not null
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index on public.choferes (user_id);
create index on public.viajes   (chofer_id);
create index on public.viajes   (user_id);
create index on public.viajes   (pagado);
create index on public.viajes   (fecha desc);

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- Cada usuario solo ve y modifica sus propios datos.
-- ------------------------------------------------------------
alter table public.choferes enable row level security;
alter table public.viajes   enable row level security;

-- Choferes
create policy "choferes_select" on public.choferes
  for select using (user_id = auth.uid());

create policy "choferes_insert" on public.choferes
  for insert with check (user_id = auth.uid());

create policy "choferes_update" on public.choferes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "choferes_delete" on public.choferes
  for delete using (user_id = auth.uid());

-- Viajes
create policy "viajes_select" on public.viajes
  for select using (user_id = auth.uid());

create policy "viajes_insert" on public.viajes
  for insert with check (user_id = auth.uid());

create policy "viajes_update" on public.viajes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "viajes_delete" on public.viajes
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Vistas de resumen (opcionales, útiles para reportes)
-- ------------------------------------------------------------

-- Resumen por chofer: total adeudado, viajes pendientes, viajes pagados
create or replace view public.resumen_choferes as
select
  c.id,
  c.user_id,
  c.nombre,
  c.telefono,
  coalesce(sum(v.importe) filter (where not v.pagado), 0)  as total_adeudado,
  count(v.id)  filter (where not v.pagado)                 as viajes_pendientes,
  count(v.id)  filter (where v.pagado)                     as viajes_pagados
from public.choferes c
left join public.viajes v on v.chofer_id = c.id
group by c.id, c.user_id, c.nombre, c.telefono;

-- Resumen global por usuario
create or replace view public.resumen_usuario as
select
  user_id,
  coalesce(sum(importe) filter (where not pagado), 0)  as total_adeudado,
  count(*) filter (where not pagado)                    as viajes_pendientes,
  count(*) filter (where pagado)                        as viajes_pagados
from public.viajes
group by user_id;

-- ============================================================
-- Variables de entorno necesarias en el front (cuando migren):
-- ============================================================
-- SUPABASE_URL  = https://xxxxx.supabase.co
-- SUPABASE_ANON = eyJhbGciOiJIUzI1NiIsInR5cCI6...
-- ============================================================
