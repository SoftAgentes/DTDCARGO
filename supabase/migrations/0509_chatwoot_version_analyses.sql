-- 0509 · SDD-0588 (E3 de SDD-0582, paso 3.4) · Análisis de versiones de Chatwoot.
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam para este archivo y el runbook aplicar-migraciones-prod.
--    Depende de la 0507 (chatwoot_version_checks).
--
-- `public.chatwoot_version_analyses`: cada «Analizar con IA» de la pantalla
-- Actualizaciones. Guarda el informe (riesgo por pieza propia de DTD y la
-- recomendación «seguro / revisar / no actualizar») de un salto de versión. Sirve
-- de caché por par de versiones y de cuenta para el tope de análisis por día.
-- Es un informe, no un despliegue: la subida sigue el runbook chatwoot-versiones y
-- el OK nominal de Sam.
--
-- La escribe solo service_role (la acción de Studio, después del gate de admin);
-- la lee el admin del tenant. Sin UPDATE ni DELETE para authenticated.
--
-- Datos personales: solo el uuid de quien pidió el análisis. Al motor solo le
-- llega código (lib/studio/chatwoot/analisis.ts); el informe habla de código.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regclass('public.tenants') is null
     or pg_catalog.to_regclass('public.chatwoot_version_checks') is null then
    raise exception '0509 requiere get_user_tenant_id(), is_tenant_admin(), tenants y la 0507 (chatwoot_version_checks)';
  end if;
  if pg_catalog.to_regclass('public.chatwoot_version_analyses') is not null then
    raise exception '0509: chatwoot_version_analyses ya existe; no se reaplica';
  end if;
end;
$preflight$;

create table public.chatwoot_version_analyses (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  from_version     text not null check (from_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  to_version       text not null check (to_version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$'),
  check_id         bigint references public.chatwoot_version_checks(id) on delete set null,
  requested_by     uuid references auth.users(id) on delete set null,
  engine           text not null check (engine in ('glm', 'sin_ia')),
  model            text check (model ~ '^[A-Za-z0-9._-]{1,64}$'),
  recommendation   text not null check (recommendation in ('seguro', 'revisar', 'no_actualizar')),
  report           jsonb not null
                   check (jsonb_typeof(report) = 'object' and pg_catalog.pg_column_size(report) <= 65536),
  package_files    integer not null check (package_files between 0 and 1000),
  package_chars    integer not null check (package_chars between 0 and 1000000),
  truncated        boolean not null default false,
  -- Por qué el informe salió sin IA: motor apagado, caído, lento o con respuesta
  -- inválida, o el diff de GitHub no se pudo leer.
  fallback_reason  text check (fallback_reason in (
                     'motor_apagado', 'motor_no_responde', 'motor_formato', 'diff_no_responde', 'diff_formato')),
  created_at       timestamptz not null default now(),
  check (from_version <> to_version),
  check ((engine = 'glm') = (model is not null)),
  check ((engine = 'sin_ia') = (fallback_reason is not null)),
  -- Sin IA el informe nunca dice «no actualizar»: solo compara qué archivos cambian.
  check (engine = 'glm' or recommendation <> 'no_actualizar')
);

create index chatwoot_version_analyses_tenant_reciente
  on public.chatwoot_version_analyses (tenant_id, created_at desc);
create index chatwoot_version_analyses_tenant_salto
  on public.chatwoot_version_analyses (tenant_id, from_version, to_version, created_at desc);

comment on table public.chatwoot_version_analyses is
  'SDD-0588 (3.4): informes de «Analizar con IA» en Studio › Administración › Actualizaciones. Riesgo por pieza propia de DTD y recomendación de un salto de versión de Chatwoot. Al motor solo le llega código (diff público de Chatwoot y la superficie de DTD); nunca datos, .env ni secretos. No despliega nada. Solo service_role escribe; el admin del tenant lee.';

alter table public.chatwoot_version_analyses enable row level security;

create policy chatwoot_version_analyses_select_admin on public.chatwoot_version_analyses
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.is_tenant_admin())
  );

create policy chatwoot_version_analyses_service_role_all on public.chatwoot_version_analyses
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_version_analyses from public, anon, authenticated;
grant select on public.chatwoot_version_analyses to authenticated;
grant all on public.chatwoot_version_analyses to service_role;
