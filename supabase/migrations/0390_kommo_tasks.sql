-- SDD-0288 · Espejo de las tareas de Kommo — el semáforo de "sin atender".
--
-- El rojo de una tarjeta en Kommo NO significa "el cliente escribió": significa
-- **tarea vencida**. Lo que hace que se encienda al escribir el cliente es una
-- acción configurada en los 4 agentes de IA el 2026-08-11 (`Agregar tarea ·
-- Fecha límite: Ahora`), que crea la tarea ya vencida.
--
-- El ERP no espejaba tareas, así que no podía pintar ese estado: su único rojo
-- mide ANTIGÜEDAD (días desde `kommo_updated_at`), que es otra cosa — un lead
-- que el asesor tocó hace un rato se ve "fresco" aunque el cliente lleve tres
-- días esperando respuesta.
--
-- Esta tabla cierra ese hueco espejando `GET /api/v4/tasks`. La forma de la
-- entidad ya la conocíamos por el camino de IDA: el ERP crea tareas desde
-- SDD-0256 Fase 5 (`lib/studio/kommo-writeback.ts` → `buildTaskPayload`), con
-- `entity_id` / `entity_type` / `complete_till`. Esto es el mismo objeto,
-- leído.
--
-- ⚠️ `complete_till` viaja en epoch de SEGUNDOS en la API de Kommo. El camino
-- de ida ya lleva ese aviso porque confundirlo con milisegundos pone el
-- vencimiento en el año 57.000 y la tarea NUNCA se ve vencida — falla en la
-- dirección que no se ve. Acá la columna es `timestamptz` y la conversión vive
-- en el sync (`epochToIso`), con su test de dígitos.
--
-- ⚠️ El conjunto de tareas ABIERTAS es una COLA que drena: cuando alguien
-- completa una, deja de estar abierta y tiene que desaparecer del espejo, o el
-- rojo se queda encendido para siempre. Por eso el sync hace marca de agua +
-- delete de lo que no volvió a ver, igual que `kommo_unsorted` (0343) — y
-- SÓLO si la lectura fue completa.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.tenants') is null then
    raise exception '0390 requiere public.tenants';
  end if;
  if to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0390 requiere get_user_tenant_id() para la RLS del espejo';
  end if;
end;
$preflight$;

create table if not exists public.kommo_tasks (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  id                  bigint not null,
  entity_id           bigint,
  entity_type         text,
  responsible_user_id bigint,
  text                text,
  task_type_id        bigint,
  complete_till       timestamptz,
  is_completed        boolean not null default false,
  kommo_created_at    timestamptz,
  kommo_updated_at    timestamptz,
  synced_at           timestamptz not null default now(),
  primary key (tenant_id, id)
);

comment on table public.kommo_tasks is
  'SDD-0288: espejo de GET /api/v4/tasks. Es el semaforo real del equipo: una '
  'tarea abierta y vencida sobre un lead = ese cliente escribio y nadie le '
  'contesto. COLA que drena: el sync borra lo que Kommo ya no devuelve.';

comment on column public.kommo_tasks.complete_till is
  'SDD-0288: vencimiento. En la API de Kommo viaja en epoch de SEGUNDOS; la '
  'conversion a ISO vive en el sync. Milisegundos = ano 57.000 = nunca vence.';

comment on column public.kommo_tasks.entity_type is
  'SDD-0288: a que cuelga la tarea (leads | contacts | ...). El semaforo del '
  'Tablero SOLO mira las de leads; las demas se espejan igual para no inventar '
  'un filtro del lado del servidor de Kommo que nadie midio.';

-- La ÚNICA pregunta que se le hace a esta tabla: "¿qué leads tienen tarea
-- abierta y vencida?". El índice parcial la responde sin escanear las
-- completadas, que son la mayoría con el tiempo.
create index if not exists kommo_tasks_pendientes_idx
  on public.kommo_tasks (tenant_id, entity_type, entity_id, complete_till)
  where is_completed = false;

-- ── Permisos ────────────────────────────────────────────────────────────────
grant select on public.kommo_tasks to authenticated;
grant all    on public.kommo_tasks to service_role;

-- ── RLS (patrón del resto del espejo, migración 0082) ───────────────────────
alter table public.kommo_tasks enable row level security;

-- authenticated: SOLO su tenant, read-only. Sin policies de INSERT/UPDATE/DELETE.
drop policy if exists "kommo_tasks tenant read" on public.kommo_tasks;
create policy "kommo_tasks tenant read"
  on public.kommo_tasks for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- service_role: ALL (defense-in-depth, patrón 0033). NO es el USING(true)
-- prohibido — ese sería para anon/authenticated.
drop policy if exists "kommo_tasks service all" on public.kommo_tasks;
create policy "kommo_tasks service all"
  on public.kommo_tasks for all to service_role
  using (true) with check (true);
