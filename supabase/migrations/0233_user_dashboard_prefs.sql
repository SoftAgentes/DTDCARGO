-- ─────────────────────────────────────────────────────────────
-- SDD-0114 · Dashboard configurable — persistencia por usuario (2026-07-14)
--
-- Cada usuario arma su propio dashboard (qué KPIs ve, en qué orden, qué widgets,
-- con qué período del gráfico). Esa config viaja entre dispositivos porque vive
-- en la DB, no en localStorage (el LS queda solo como cache optimista en el
-- cliente). Una fila por (tenant, usuario).
--
-- El `config` es jsonb libre: la forma se valida en la Server Action con
-- `validateDashboardConfigInput()` (convención del Studio: validar en la action,
-- defender lo mínimo en DB). La defensa-en-DB acá se reduce a:
--   · unique(tenant_id, user_id) — una config por usuario/tenant.
--   · RLS por DUEÑO + tenant — el usuario solo lee/escribe SU fila.
--
-- NO es tabla polimórfica → no requiere helper *_in_tenant() ni trigger
-- same-tenant. Sin DDL destructivo.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.user_dashboard_prefs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on table public.user_dashboard_prefs is
  'SDD-0114: preferencias del dashboard configurable POR USUARIO (una fila por tenant+user). config jsonb = { kpis:[], widgets:[], chartPeriod }. La forma se valida en la Server Action, no en DB. RLS por dueño+tenant.';
comment on column public.user_dashboard_prefs.config is
  'Forma { kpis: string[], widgets: string[], chartPeriod: "1M"|"3M"|"1A"|"YTD" }. Validada en validateDashboardConfigInput(); ids fuera del catálogo se descartan al leer.';

-- Índice para el lookup por dueño (el path caliente: getDashboardConfig).
create index if not exists user_dashboard_prefs_owner_idx
  on public.user_dashboard_prefs (tenant_id, user_id);

-- Toca updated_at en cada UPDATE (función compartida del Studio).
drop trigger if exists user_dashboard_prefs_touch on public.user_dashboard_prefs;
create trigger user_dashboard_prefs_touch
  before update on public.user_dashboard_prefs
  for each row execute function public.touch_updated_at();

-- GRANT base JUNTO a la RLS (auto-expose OFF). Sin DELETE por RLS de dueño: el
-- "Restaurar defaults" borra la fila del propio usuario (permitido por la policy).
grant select, insert, update, delete on public.user_dashboard_prefs to authenticated;
grant all on public.user_dashboard_prefs to service_role;

alter table public.user_dashboard_prefs enable row level security;

-- RLS por DUEÑO + TENANT: el usuario solo ve/escribe SU fila dentro de un tenant
-- al que pertenece. Cubre select/insert/update/delete con una sola policy `for all`.
-- No usamos maybeSingle ingenuo: el filtro es user_id = auth.uid() Y el tenant
-- está en los tenants del usuario (patrón user_tenants del Studio).
create policy user_dashboard_prefs_owner
  on public.user_dashboard_prefs
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and tenant_id in (
      select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and tenant_id in (
      select ut.tenant_id from public.user_tenants ut where ut.user_id = auth.uid()
    )
  );
