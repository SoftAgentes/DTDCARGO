-- ─────────────────────────────────────────────────────────────
-- SDD-0043 (Alcance A) — Kommo CRM · espejo read-only
-- 7 tablas nuevas + RLS por tenant_id. tenants NO se recrea (existe en 0001).
-- Token del CRM vive en Vault; se lee en runtime con kommo_get_token() (solo service_role).
-- service_role: grant + policy "all" (patrón 0033 → no repite el bug de pnpm seed).
-- RLS enabled, NO forzada. authenticated = SELECT tenant-scoped. Escritura = service_role.
-- ─────────────────────────────────────────────────────────────

create extension if not exists supabase_vault;   -- idempotente (ya usada en 0017)

-- 1) Conexión tenant ↔ cuenta Kommo (1 cuenta por tenant en Alcance A)
create table public.kommo_connections (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  subdomain         text not null,                 -- 'dtdcargo' → dtdcargo.kommo.com
  domain            text not null default 'kommo.com',
  account_id        bigint,                         -- se llena en el 1er sync
  vault_secret_name text not null unique,           -- nombre del secreto en Vault (NO el token)
  status            text not null default 'active' check (status in ('active','disabled','error')),
  last_sync_at      timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id)
);
comment on table public.kommo_connections is
  'SDD-0043: vincula tenant con cuenta Kommo. El token NO vive aquí: vault_secret_name apunta a Vault.';

-- 2) Embudos
create table public.kommo_pipelines (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id        bigint not null,                        -- id de Kommo
  name      text,
  sort      int,
  is_main   boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
comment on table public.kommo_pipelines is 'SDD-0043: espejo de embudos de Kommo.';

-- 3) Etapas
create table public.kommo_statuses (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  id          bigint not null,
  pipeline_id bigint not null,
  name        text,
  sort        int,
  color       text,
  type        int,                                  -- tipo Kommo (won=142 / lost=143 son ids fijos)
  synced_at   timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index kommo_statuses_pipeline_idx on public.kommo_statuses (tenant_id, pipeline_id);
comment on table public.kommo_statuses is 'SDD-0043: espejo de etapas de Kommo.';

-- 4) Definiciones de custom fields (para interpretar los custom_fields de leads/contacts)
create table public.kommo_custom_fields (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  id          bigint not null,
  entity_type text not null,                        -- 'leads' | 'contacts'
  name        text,
  type        text,                                 -- text|numeric|select|multiselect|date|...
  code        text,                                 -- PHONE/EMAIL/... cuando aplica
  enums       jsonb,                                -- opciones id→value (select/multiselect)
  synced_at   timestamptz not null default now(),
  primary key (tenant_id, entity_type, id)
);
comment on table public.kommo_custom_fields is 'SDD-0043: definición de campos personalizados de Kommo.';

-- 5) Contactos
create table public.kommo_contacts (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  id                  bigint not null,
  name                text,
  responsible_user_id bigint,
  kommo_created_at    timestamptz,
  kommo_updated_at    timestamptz,
  custom_fields       jsonb not null default '[]'::jsonb,   -- custom_fields_values crudo (tel/email con code)
  synced_at           timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index kommo_contacts_updated_idx on public.kommo_contacts (tenant_id, kommo_updated_at desc);
comment on table public.kommo_contacts is 'SDD-0043: espejo de contactos de Kommo. Tel/email en custom_fields (code PHONE/EMAIL).';

-- 6) Leads
create table public.kommo_leads (
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  id                  bigint not null,
  name                text,
  status_id           bigint,
  pipeline_id         bigint,
  price               numeric,
  responsible_user_id bigint,
  kommo_created_at    timestamptz,
  kommo_updated_at    timestamptz,
  closed_at           timestamptz,
  custom_fields       jsonb not null default '[]'::jsonb,   -- custom_fields_values crudo
  synced_at           timestamptz not null default now(),
  primary key (tenant_id, id)
);
create index kommo_leads_status_idx   on public.kommo_leads (tenant_id, status_id);
create index kommo_leads_pipeline_idx on public.kommo_leads (tenant_id, pipeline_id);
create index kommo_leads_updated_idx  on public.kommo_leads (tenant_id, kommo_updated_at desc);
comment on table public.kommo_leads is 'SDD-0043: espejo de leads de Kommo. M3 idempotencia: UPSERT compara kommo_updated_at.';

-- 7) Bitácora de cada corrida de sync
create table public.sync_logs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  connection_id    uuid references public.kommo_connections(id) on delete set null,
  entity           text not null,                   -- pipelines|statuses|custom_fields|contacts|leads|__run__
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  records_fetched  int not null default 0,
  records_upserted int not null default 0,
  status           text not null default 'running' check (status in ('running','ok','error')),
  error_detail     text
);
create index sync_logs_tenant_idx on public.sync_logs (tenant_id, started_at desc);
comment on table public.sync_logs is 'SDD-0043: registro de corridas de kommo-sync (conteos + estado).';

-- ── Helper: lee el token desde Vault. SOLO service_role. ──
create or replace function public.kommo_get_token(p_connection_id uuid)
returns text
language sql
stable
security definer
set search_path = ''                                -- hardened: todo cualificado
as $$
  select ds.decrypted_secret
  from public.kommo_connections c
  join vault.decrypted_secrets ds on ds.name = c.vault_secret_name
  where c.id = p_connection_id
  limit 1
$$;
comment on function public.kommo_get_token(uuid) is
  'SDD-0043: devuelve el long-lived token de Kommo desde Vault. Ejecutable solo por service_role.';

-- ── GRANTS · authenticated necesita SELECT explícito (auto-expose OFF). service_role: ALL. ──
grant select on public.kommo_connections   to authenticated;
grant select on public.kommo_pipelines      to authenticated;
grant select on public.kommo_statuses       to authenticated;
grant select on public.kommo_custom_fields  to authenticated;
grant select on public.kommo_contacts       to authenticated;
grant select on public.kommo_leads          to authenticated;
grant select on public.sync_logs            to authenticated;

grant all on public.kommo_connections   to service_role;
grant all on public.kommo_pipelines      to service_role;
grant all on public.kommo_statuses       to service_role;
grant all on public.kommo_custom_fields  to service_role;
grant all on public.kommo_contacts       to service_role;
grant all on public.kommo_leads          to service_role;
grant all on public.sync_logs            to service_role;

-- token fn: lockdown a service_role
revoke execute on function public.kommo_get_token(uuid) from public, anon, authenticated;
grant  execute on function public.kommo_get_token(uuid) to service_role;

-- ── RLS · enabled (NO forzada) ──
alter table public.kommo_connections  enable row level security;
alter table public.kommo_pipelines     enable row level security;
alter table public.kommo_statuses      enable row level security;
alter table public.kommo_custom_fields enable row level security;
alter table public.kommo_contacts      enable row level security;
alter table public.kommo_leads         enable row level security;
alter table public.sync_logs           enable row level security;

-- authenticated: ve SOLO su tenant (read-only). Sin policies de INSERT/UPDATE/DELETE.
create policy "kommo_connections tenant read"  on public.kommo_connections  for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_pipelines tenant read"     on public.kommo_pipelines     for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_statuses tenant read"      on public.kommo_statuses      for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_custom_fields tenant read" on public.kommo_custom_fields for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_contacts tenant read"      on public.kommo_contacts      for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "kommo_leads tenant read"         on public.kommo_leads         for select to authenticated using (tenant_id = public.get_user_tenant_id());
create policy "sync_logs tenant read"           on public.sync_logs           for select to authenticated using (tenant_id = public.get_user_tenant_id());

-- service_role: ALL (defense-in-depth, patrón 0033). NO es el USING(true) prohibido (ese sería anon/authenticated).
create policy "kommo_connections service all"  on public.kommo_connections  for all to service_role using (true) with check (true);
create policy "kommo_pipelines service all"     on public.kommo_pipelines     for all to service_role using (true) with check (true);
create policy "kommo_statuses service all"      on public.kommo_statuses      for all to service_role using (true) with check (true);
create policy "kommo_custom_fields service all" on public.kommo_custom_fields for all to service_role using (true) with check (true);
create policy "kommo_contacts service all"      on public.kommo_contacts      for all to service_role using (true) with check (true);
create policy "kommo_leads service all"         on public.kommo_leads         for all to service_role using (true) with check (true);
create policy "sync_logs service all"           on public.sync_logs           for all to service_role using (true) with check (true);
