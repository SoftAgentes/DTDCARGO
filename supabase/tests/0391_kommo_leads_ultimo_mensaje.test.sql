\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0391 (SDD-0288 rebanada 1).
--
-- Carga la migración REAL con `\i`: un contrato que reimplementa el DDL deja de
-- medir el archivo que se aplica a producción.
--
-- Lo que se prueba no es "las columnas existen" —eso lo diría cualquier typo—
-- sino las dos propiedades de las que depende que el semáforo no mienta:
-- que el update sea MONÓTONO y que sea UPDATE y no upsert.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

-- ── Fixture mínimo: lo que la 0391 exige que exista ─────────────────────────
create table public.tenants (id uuid primary key);
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');

create table public.kommo_leads (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  id               bigint not null,
  name             text,
  kommo_updated_at timestamptz,
  primary key (tenant_id, id)
);
grant select on public.kommo_leads to authenticated;
grant all    on public.kommo_leads to service_role;

-- ── DDL bajo prueba: el archivo real ────────────────────────────────────────
\i /sb/migrations/0391_kommo_leads_ultimo_mensaje.sql

insert into public.kommo_leads (tenant_id, id, name) values
  ('11111111-1111-1111-1111-111111111111', 900001, 'Lead con chat');

-- ── 1. Un mensaje entrante estampa last_inbound_at ──────────────────────────
do $entrante$
declare ok boolean;
begin
  select public.kommo_touch_lead_message(
    '11111111-1111-1111-1111-111111111111', 900001,
    '2026-08-25T10:00:00Z'::timestamptz, true, 'waba') into ok;

  if ok is not true then
    raise exception 'TEST 0391: la RPC no encontro el lead espejado';
  end if;

  if not exists (
    select 1 from public.kommo_leads
     where id = 900001
       and last_inbound_at = '2026-08-25T10:00:00Z'::timestamptz
       and last_outbound_at is null
       and last_message_origin = 'waba'
  ) then
    raise exception 'TEST 0391: el entrante no quedo estampado como se esperaba';
  end if;
end;
$entrante$;

-- ── 2. MUTACIÓN · un webhook ATRASADO no pisa hacia atrás ───────────────────
-- El caso real: Kommo reintenta, o dos eventos llegan desordenados. Sin
-- `greatest()` el lead se veria "contestado" cuando no lo esta.
do $monotono$
declare quedo timestamptz;
begin
  perform public.kommo_touch_lead_message(
    '11111111-1111-1111-1111-111111111111', 900001,
    '2026-08-25T08:00:00Z'::timestamptz, true, 'waba');   -- DOS HORAS ANTES

  select last_inbound_at into quedo from public.kommo_leads where id = 900001;

  if quedo <> '2026-08-25T10:00:00Z'::timestamptz then
    raise exception
      'TEST 0391: un evento atrasado PISO la fecha buena (quedo %)', quedo;
  end if;
end;
$monotono$;

-- ── 3. El saliente va a su propia columna y no toca la del entrante ─────────
do $saliente$
begin
  perform public.kommo_touch_lead_message(
    '11111111-1111-1111-1111-111111111111', 900001,
    '2026-08-25T11:00:00Z'::timestamptz, false, 'waba');

  if not exists (
    select 1 from public.kommo_leads
     where id = 900001
       and last_inbound_at  = '2026-08-25T10:00:00Z'::timestamptz
       and last_outbound_at = '2026-08-25T11:00:00Z'::timestamptz
  ) then
    raise exception 'TEST 0391: el saliente contamino la columna del entrante';
  end if;
end;
$saliente$;

-- ── 4. MUTACIÓN · un mensaje de un lead SIN ESPEJAR no fabrica una fila ─────
-- Los leads de la bandeja `unsorted` no existen en kommo_leads hasta que
-- alguien los acepta. Un upsert crearia un lead fantasma con dos fechas y
-- ningun nombre, y el Tablero lo pintaria como real.
do $sin_espejar$
declare
  ok     boolean;
  cuantos int;
begin
  select public.kommo_touch_lead_message(
    '11111111-1111-1111-1111-111111111111', 777777,
    '2026-08-25T12:00:00Z'::timestamptz, true, 'waba') into ok;

  if ok is not null then
    raise exception 'TEST 0391: la RPC devolvio % para un lead inexistente, esperaba null', ok;
  end if;

  select count(*) into cuantos from public.kommo_leads where id = 777777;
  if cuantos <> 0 then
    raise exception 'TEST 0391: se FABRICO una fila fantasma para un lead sin espejar';
  end if;
end;
$sin_espejar$;

-- ── 5. MUTACIÓN · la RPC no la puede ejecutar cualquiera ────────────────────
-- Es SECURITY DEFINER y escribe el espejo: si `authenticated` pudiera correrla,
-- cualquiera con sesion apagaria (o encenderia) alertas ajenas.
do $permisos$
begin
  if has_function_privilege('authenticated',
       'public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text)', 'EXECUTE') then
    raise exception 'TEST 0391: authenticated PUEDE ejecutar la RPC del espejo';
  end if;
  if has_function_privilege('anon',
       'public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text)', 'EXECUTE') then
    raise exception 'TEST 0391: anon PUEDE ejecutar la RPC del espejo';
  end if;
  if not has_function_privilege('service_role',
       'public.kommo_touch_lead_message(uuid, bigint, timestamptz, boolean, text)', 'EXECUTE') then
    raise exception 'TEST 0391: service_role NO puede ejecutar la RPC — el webhook quedaria inerte';
  end if;
end;
$permisos$;

-- ── 6. La función va sellada (search_path vacío) ────────────────────────────
do $hardening$
declare cfg text[];
begin
  select p.proconfig into cfg
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'kommo_touch_lead_message';

  -- Postgres guarda el valor VACIO como `search_path=""` (con comillas), no
  -- como `search_path=`. Comparar contra la forma pelada da un falso rojo — que
  -- es como se descubrio esto. Se acepta cualquiera de las dos formas del vacio
  -- y se RECHAZA cualquier search_path con contenido.
  if cfg is null or not exists (
    select 1 from unnest(cfg) as c
     where c ~ '^search_path=("")?$'
  ) then
    raise exception 'TEST 0391: la funcion SECURITY DEFINER no tiene search_path sellado (cfg=%)', cfg;
  end if;
end;
$hardening$;

-- ── 7. El índice parcial existe y lleva su predicado ────────────────────────
do $indice$
declare def text;
begin
  select indexdef into def from pg_indexes
   where schemaname = 'public' and indexname = 'kommo_leads_sin_responder_idx';

  if def is null then
    raise exception 'TEST 0391: falta el indice kommo_leads_sin_responder_idx';
  end if;
  if def not like '%last_inbound_at IS NOT NULL%' then
    raise exception 'TEST 0391: el indice no es PARCIAL sobre los que escribieron (def=%)', def;
  end if;
end;
$indice$;

rollback;
