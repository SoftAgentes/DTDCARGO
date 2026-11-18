-- 0507 · SDD-0588 (E3 de SDD-0582, pasos 3.2 y 3.3) · Versiones de Chatwoot.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--
-- 1. `public.chatwoot_version_checks`: cada revisión del vigilante (cron diario o
--    «Revisar ahora»): versión instalada, la publicada más nueva y los releases
--    pendientes con sus notas. La escribe solo service_role; la lee el admin del
--    tenant. Sin UPDATE ni DELETE para authenticated.
-- 2. `public.chatwoot_update_requests`: cada «Pedir actualización» de la pantalla
--    Actualizaciones. Es un registro, no un despliegue: la subida sigue el runbook
--    chatwoot-versiones y el OK nominal de Sam. Un pedido por versión destino y
--    tenant. Lo crea y lo lee el admin del tenant, con requested_by = auth.uid().
--
-- Datos personales: solo el uuid de quien pide. Las notas de los releases son
-- públicas y se guardan sin menciones a personas (lib/studio/chatwoot/versiones.ts).
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regclass('public.tenants') is null then
    raise exception '0507 requiere get_user_tenant_id(), is_tenant_admin(), auth.uid() y tenants';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_version_checks') is not null
     or pg_catalog.to_regclass('public.chatwoot_update_requests') is not null then
    raise exception '0507: las tablas de versiones de Chatwoot ya existen; no se reaplica';
  end if;
end;
$preflight$;

-- ─── 1. Revisiones del vigilante ─────────────────────────────────────────────
create table public.chatwoot_version_checks (
  id                bigint generated always as identity primary key,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  checked_at        timestamptz not null default now(),
  status            text not null check (status in ('al_dia', 'hay_nueva', 'error')),
  installed_version text check (installed_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  latest_version    text check (latest_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  releases          jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(releases) = 'array' and pg_catalog.pg_column_size(releases) <= 262144),
  truncated         boolean not null default false,
  error_code        text check (error_code in (
                      'instalada_no_responde', 'instalada_formato', 'releases_no_responde', 'releases_formato')),
  check ((status = 'error') = (error_code is not null)),
  check (status <> 'hay_nueva' or (installed_version is not null and latest_version is not null))
);

create index chatwoot_version_checks_tenant_reciente
  on public.chatwoot_version_checks (tenant_id, checked_at desc);

comment on table public.chatwoot_version_checks is
  'SDD-0588 (3.2): revisiones del vigilante de versiones de Chatwoot. GET /api de chat.dtdcargo.com contra los releases públicos de chatwoot/chatwoot. Solo service_role escribe; el admin del tenant lee. Sin datos personales: las notas se guardan sin menciones a personas.';

alter table public.chatwoot_version_checks enable row level security;

create policy chatwoot_version_checks_select_admin on public.chatwoot_version_checks
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
  );

create policy chatwoot_version_checks_service_role_all on public.chatwoot_version_checks
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_version_checks from public, anon, authenticated;
grant select on public.chatwoot_version_checks to authenticated;
grant all on public.chatwoot_version_checks to service_role;

-- ─── 2. Pedidos de actualización ─────────────────────────────────────────────
create table public.chatwoot_update_requests (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  from_version text not null check (from_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  to_version   text not null check (to_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  check_id     bigint references public.chatwoot_version_checks(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (from_version <> to_version),
  unique (tenant_id, to_version)
);

comment on table public.chatwoot_update_requests is
  'SDD-0588 (3.3): «Pedir actualización» de Studio › Administración › Actualizaciones. Registro, no despliegue: la subida sigue docs/runbooks/chatwoot-versiones.md con el OK nominal de Sam. Un pedido por versión destino y tenant; sin UPDATE ni DELETE.';

alter table public.chatwoot_update_requests enable row level security;

create policy chatwoot_update_requests_select_admin on public.chatwoot_update_requests
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
  );

create policy chatwoot_update_requests_insert_admin on public.chatwoot_update_requests
  for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
    and requested_by = (select auth.uid())
    -- La revisión citada tiene que ser visible para quien pide: la RLS de
    -- chatwoot_version_checks ya la acota al admin de su tenant.
    and (check_id is null or exists (
      select 1 from public.chatwoot_version_checks c where c.id = check_id
    ))
  );

create policy chatwoot_update_requests_service_role_all on public.chatwoot_update_requests
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_update_requests from public, anon, authenticated;
grant select, insert on public.chatwoot_update_requests to authenticated;
grant all on public.chatwoot_update_requests to service_role;
