-- Contrato de 0337 · siembra de feature flags por tenant (SDD-0240).
--
-- El test de TypeScript compara CATÁLOGOS (texto de la migración vs código).
-- No puede probar lo único que importa de verdad: que al crear un tenant las
-- filas APARECEN. Eso se prueba corriendo el SQL.
--
-- Los tres casos son las tres formas en que esto se rompió:
--   1. tenant nuevo → nace con el juego completo (§1.3 de la spec)
--   2. re-siembra → NO pisa el valor que el admin ya eligió
--   3. marketing_news → está en el catálogo (§1.1: sin fila, el toggle
--      levanta invalid_state para siempre)

\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create table public.tenants(id uuid primary key, name text);
create table public.feature_flags(
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  enabled     boolean not null,
  description text,
  updated_at  timestamptz not null default now(),
  unique (tenant_id, key)
);

-- Un tenant que ya existía antes de la migración, con un flag YA TOCADO por
-- el admin: `whatsapp` apagado a mano (el catálogo lo trae en true).
insert into public.tenants(id, name) values
  ('11111111-1111-1111-1111-111111111111', 'DTD (preexistente)');
insert into public.feature_flags(tenant_id, key, enabled, description) values
  ('11111111-1111-1111-1111-111111111111', 'whatsapp', false, 'apagado a mano');

\ir ../migrations/0337_feature_flags_seed_and_trigger.sql

-- ─── Caso 1 · el tenant preexistente quedó completo ───────────
do $$
declare
  v_catalogo int;
  v_filas    int;
begin
  select count(*) into v_catalogo from public.feature_flag_catalog();
  select count(*) into v_filas from public.feature_flags
   where tenant_id = '11111111-1111-1111-1111-111111111111';
  if v_filas <> v_catalogo then
    raise exception 'seed incompleto en tenant preexistente: % filas vs % del catálogo',
      v_filas, v_catalogo;
  end if;
end $$;

-- ─── Caso 2 · la siembra NO pisa lo que el admin eligió ───────
do $$
declare v_enabled boolean;
begin
  select enabled into v_enabled from public.feature_flags
   where tenant_id = '11111111-1111-1111-1111-111111111111' and key = 'whatsapp';
  if v_enabled is not false then
    raise exception 'la siembra pisó un valor elegido por el admin (whatsapp quedó %)', v_enabled;
  end if;
end $$;

-- ─── Caso 3 · marketing_news existe (el bug de §1.1) ──────────
do $$ begin
  if not exists(
    select 1 from public.feature_flags
     where tenant_id = '11111111-1111-1111-1111-111111111111' and key = 'marketing_news'
  ) then
    raise exception 'marketing_news no se sembró: el toggle seguiría levantando invalid_state';
  end if;
end $$;

-- ─── Caso 4 · TENANT NUEVO: el trigger hace su trabajo ────────
-- Es el caso del aliado white-label. Antes de 0337 nacía con cero filas.
insert into public.tenants(id, name) values
  ('22222222-2222-2222-2222-222222222222', 'Aliado white-label');

do $$
declare
  v_catalogo int;
  v_filas    int;
begin
  select count(*) into v_catalogo from public.feature_flag_catalog();
  select count(*) into v_filas from public.feature_flags
   where tenant_id = '22222222-2222-2222-2222-222222222222';
  if v_filas <> v_catalogo then
    raise exception 'tenant NUEVO nació con % filas, esperaba % · el trigger no corrió',
      v_filas, v_catalogo;
  end if;
end $$;

-- Y con los defaults del catálogo, no con cualquier cosa.
do $$
declare v_mal text;
begin
  select string_agg(f.key || ': ' || f.enabled || ' (catálogo ' || c.enabled || ')', ' · ')
    into v_mal
  from public.feature_flags f
  join public.feature_flag_catalog() c on c.key = f.key
  where f.tenant_id = '22222222-2222-2222-2222-222222222222'
    and f.enabled is distinct from c.enabled;
  if v_mal is not null then
    raise exception 'tenant nuevo sembrado con defaults equivocados: %', v_mal;
  end if;
end $$;

-- ─── Caso 5 · la siembra es idempotente ───────────────────────
-- Correr la migración dos veces no debe duplicar ni fallar.
insert into public.feature_flags (tenant_id, key, enabled, description)
select t.id, c.key, c.enabled, c.description
from public.tenants t
cross join public.feature_flag_catalog() c
on conflict (tenant_id, key) do nothing;

do $$
declare v_dups int;
begin
  select count(*) into v_dups from (
    select tenant_id, key from public.feature_flags
    group by tenant_id, key having count(*) > 1
  ) d;
  if v_dups > 0 then
    raise exception 'la re-siembra duplicó % pares (tenant, key)', v_dups;
  end if;
end $$;

rollback;
