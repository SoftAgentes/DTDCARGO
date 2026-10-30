-- 0508 · SDD-0585 (E2, paso 2.7) · Bajas de agentes de Chatwoot y purga por plazo.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--    Va después de la 0504.
--
-- Plazos: propuesta del Director del 2026-10-30, sin objeción de Sam (no es un
-- OK nominal; ver SDD-0585 §2.7).
--
-- 1. `chatwoot_agent_bajas`: una fila por agente dado de baja, con la fecha. La
--    baja borra el vínculo (0503) y la Platform API no lista usuarios, así que
--    sin esta fila nadie sabría a quién borrar a los 12 meses. Solo el id de
--    Chatwoot y la fecha: ni correo ni nombre. Un alta nueva del mismo usuario
--    borra la fila. Solo service_role.
-- 2. `chatwoot_bajas_vencidas()`: las bajas de más de 12 meses. El cron borra
--    ese usuario de Chatwoot (`DELETE platform/api/v1/users/{id}`) y después la
--    fila, con sus candados en TypeScript.
-- 3. `chatwoot_purgar_bandeja()`: borra los eventos del webhook «procesado» y
--    «descartado» de más de 90 días, y las conversaciones sin actividad en 12
--    meses. Si una conversación vuelve a moverse, el webhook la crea de nuevo.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.chatwoot_webhook_events') is null
     or pg_catalog.to_regclass('public.chatwoot_conversations') is null then
    raise exception '0508 requiere tenants y las tablas de la 0504';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_agent_bajas') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_purgar_bandeja()') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_bajas_vencidas()') is not null then
    raise exception '0508: las bajas de Chatwoot ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Bajas ────────────────────────────────────────────────────────────────
create table public.chatwoot_agent_bajas (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  chatwoot_user_id bigint not null check (chatwoot_user_id > 0),
  baja_at          timestamptz not null default now(),
  primary key (tenant_id, chatwoot_user_id)
);

comment on table public.chatwoot_agent_bajas is
  'SDD-0585 2.7: agentes de Chatwoot dados de baja y cuándo. A los 12 meses el cron borra el usuario de Chatwoot. Sin datos personales. Solo service_role.';

alter table public.chatwoot_agent_bajas enable row level security;
create policy chatwoot_agent_bajas_service_role_all on public.chatwoot_agent_bajas
  for all to service_role using (true) with check (true);
revoke all on public.chatwoot_agent_bajas from public, anon, authenticated;
grant all on public.chatwoot_agent_bajas to service_role;

-- ─── 2. Bajas vencidas ───────────────────────────────────────────────────────
create function public.chatwoot_bajas_vencidas()
returns table (tenant_id uuid, chatwoot_user_id bigint)
language sql stable security definer set search_path = '' as $fn$
  select b.tenant_id, b.chatwoot_user_id
  from public.chatwoot_agent_bajas b
  where b.baja_at < pg_catalog.now() - interval '12 months'
  order by b.baja_at
  limit 50;
$fn$;

comment on function public.chatwoot_bajas_vencidas() is
  'SDD-0585 2.7: hasta 50 bajas de más de 12 meses, las más viejas primero. Solo service_role.';

revoke all on function public.chatwoot_bajas_vencidas() from public;
revoke all on function public.chatwoot_bajas_vencidas() from anon, authenticated;
grant execute on function public.chatwoot_bajas_vencidas() to service_role;

-- ─── 3. Purga por plazo ──────────────────────────────────────────────────────
create function public.chatwoot_purgar_bandeja()
returns table (eventos integer, conversaciones integer)
language plpgsql security definer set search_path = '' as $fn$
declare
  v_eventos integer;
  v_conversaciones integer;
begin
  delete from public.chatwoot_webhook_events e
  where e.status in ('procesado', 'descartado')
    and e.received_at < pg_catalog.now() - interval '90 days';
  get diagnostics v_eventos = row_count;

  delete from public.chatwoot_conversations c
  where coalesce(c.last_activity_at, c.updated_at) < pg_catalog.now() - interval '12 months';
  get diagnostics v_conversaciones = row_count;

  return query select v_eventos, v_conversaciones;
end;
$fn$;

comment on function public.chatwoot_purgar_bandeja() is
  'SDD-0585 2.7: borra eventos procesado/descartado de más de 90 días y conversaciones sin actividad en 12 meses. Devuelve cuántos. Solo service_role.';

revoke all on function public.chatwoot_purgar_bandeja() from public;
revoke all on function public.chatwoot_purgar_bandeja() from anon, authenticated;
grant execute on function public.chatwoot_purgar_bandeja() to service_role;
