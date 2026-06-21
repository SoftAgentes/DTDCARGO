-- ─────────────────────────────────────────────────────────────
-- SDD-0101 · Naviera Tier 1 · Slice B.2: cache de tracking SeaRates + cuota
--
-- El Container Tracking API de SeaRates es de pago y la cuenta tiene un tope DURO
-- de 100 llamadas/mes (compartido con el cron de fletes, SDD-0092). Por eso NO se
-- llama en cada vista: el operador dispara un refresh MANUAL, se cachea el snapshot
-- y todas las vistas (ERP + portal) lo leen del cache. Un contador mensual + el
-- `remaining` que SeaRates reporta en cada respuesta gobiernan la cuota.
--
-- Dos tablas nuevas, RLS por tenant (heredan el criterio de SDD-0047):
--   · tracking_snapshots   · 1 fila por (tenant, número trackeado); el refresh upserta.
--   · searates_tracking_usage · contador mensual + último `remaining` visto.
--
-- SIN funciones nuevas → sin revoke/security-definer. El portal lee el snapshot del
-- envío PROPIO con el admin client (mismo patrón que getShipmentNaviera, Slice A);
-- el ERP lo lee por RLS (miembro del tenant). Aditiva, sin DDL destructivo.
--
-- NO aplicar a prod (lo hace coordinación / Sam).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. tracking_snapshots · cache del tracking por número      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Las fechas de SeaRates vienen "YYYY-MM-DD HH:mm:ss" SIN zona → se guardan como
-- text (lossless; la UI las formatea) en vez de asumir UTC. `raw` guarda la
-- respuesta cruda para auditar (igual que ocean_rates, migr 0146).
create table if not exists public.tracking_snapshots (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  consolidation_id uuid references public.consolidations(id) on delete set null,
  number          text not null,                       -- nº de contenedor/BL trackeado (normalizado)
  number_type     text,                                -- CT | BL | BK
  sealine         text,                                -- SCAC
  sealine_name    text,
  status          text,                                -- estado SeaRates (IN_TRANSIT, DELIVERED, …)
  vessel          text,
  pol_date        text,                                -- salida del POL (string SeaRates)
  pol_actual      boolean,
  pod_eta         text,                                -- arribo al POD (string SeaRates)
  pod_actual      boolean,
  last_lat        numeric(9,5),
  last_lng        numeric(9,5),
  milestones      jsonb not null default '[]'::jsonb,  -- hitos normalizados
  raw             jsonb,                               -- respuesta cruda (auditoría)
  fetch_status    text not null default 'ok',          -- ok | error
  error_code      text,
  api_remaining   integer,                             -- último remaining reportado por SeaRates
  fetched_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, number)
);

comment on table public.tracking_snapshots is
  'SDD-0101: cache del Container Tracking API de SeaRates. 1 fila por (tenant, número); el refresh manual upserta. Las vistas leen de acá (no se llama al API por pageview). RLS por tenant_id.';

create index if not exists tracking_snapshots_tenant_consol_idx
  on public.tracking_snapshots (tenant_id, consolidation_id)
  where consolidation_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. searates_tracking_usage · contador mensual de cuota     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- period = 'YYYY-MM'. `last_remaining` = lo último que SeaRates dijo que queda en
-- el plan (api_calls.remaining). El guard de la action usa ambos: tope local +
-- reserva sobre el remaining (para no ahogar al cron de fletes).
create table if not exists public.searates_tracking_usage (
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  period          text not null,                       -- 'YYYY-MM'
  calls           integer not null default 0,
  last_remaining  integer,
  updated_at      timestamptz not null default now(),
  primary key (tenant_id, period)
);

comment on table public.searates_tracking_usage is
  'SDD-0101: cuota mensual de llamadas al tracking de SeaRates por tenant. calls = gastadas este mes; last_remaining = último remaining del plan reportado por SeaRates. RLS por tenant_id.';

-- ── Grants explícitos (auto-expose OFF, como el resto del repo) ──
grant select, insert, update, delete on public.tracking_snapshots to authenticated;
grant select, insert, update, delete on public.searates_tracking_usage to authenticated;
grant all on public.tracking_snapshots to service_role;
grant all on public.searates_tracking_usage to service_role;

-- ── RLS por tenant (mismo criterio que SDD-0047 / clientes) ──
alter table public.tracking_snapshots enable row level security;
alter table public.searates_tracking_usage enable row level security;

create policy "tracking_snapshots by tenant"
  on public.tracking_snapshots for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "tracking_snapshots service_role all"
  on public.tracking_snapshots for all
  to service_role using (true) with check (true);

create policy "searates_tracking_usage by tenant"
  on public.searates_tracking_usage for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "searates_tracking_usage service_role all"
  on public.searates_tracking_usage for all
  to service_role using (true) with check (true);

-- ── Trigger updated_at (reusa la función existente) ──
create trigger tracking_snapshots_touch
  before update on public.tracking_snapshots
  for each row execute function public.touch_updated_at();
