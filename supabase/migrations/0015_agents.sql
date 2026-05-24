-- ─────────────────────────────────────────────────────────────
-- SDD-0020 Fase 1: Schema base de Agentes y Skills
-- (Renumerada de 0012 → 0015 porque 0012-0014 fueron usadas en
--  audit fixes pre-Sprint 4. Spec original en docs/specs/0020.)
--
-- Contenido:
--   - 5 enums (agent_status, agent_run_trigger, agent_run_status,
--     agent_approval_status, agent_model)
--   - 5 tablas (skills, agents, agent_tool_grants, agent_runs,
--     agent_approvals)
--   - 2 RPCs (next_agent_slug, update_agent_spend)
--   - RLS por tenant en agents/grants/runs/approvals
--   - Seed inicial: 1 skill placeholder "Tracking Concierge"
--     (system_prompt + schemas se completan en Fase 2 desde TS)
-- ─────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────
create type agent_status as enum ('off', 'paused', 'active');

create type agent_run_trigger as enum ('manual', 'cron', 'webhook', 'event');

create type agent_run_status as enum (
  'running', 'ok', 'error', 'timeout', 'needs_approval'
);

create type agent_approval_status as enum (
  'pending', 'approved', 'rejected', 'expired'
);

create type agent_model as enum (
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001'
);

-- ─── Tabla: skills (catálogo global, sin tenant_id) ──────────
create table public.skills (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  description         text not null,
  category            text not null,
  icon                text,
  default_model       agent_model not null,
  default_trigger     agent_run_trigger not null default 'manual',
  tools_required      text[] not null default '{}',
  input_schema        jsonb not null default '{}'::jsonb,
  output_schema       jsonb not null default '{}'::jsonb,
  system_prompt       text not null,
  cost_estimate_usd   numeric(10,4) not null default 0,
  version             text not null default '1.0.0',
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.skills is
  'Catálogo global de skills built-in (sin tenant_id). V1: pobladas via seed desde lib/studio/agents/skills/. Marketplace = backlog.';

create index skills_active_category_idx
  on public.skills (category, slug) where active = true;

-- ─── Tabla: agents (instancias instaladas, RLS por tenant) ──
create table public.agents (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  skill_id              uuid not null references public.skills(id) on delete restrict,
  slug                  text not null,                                -- AGT-NNNN
  name                  text not null,
  status                agent_status not null default 'off',
  config                jsonb not null default '{}'::jsonb,
  model                 agent_model not null,
  trigger_config        jsonb not null default '{}'::jsonb,
  budget_usd_monthly    numeric(10,2) not null default 50,
  spend_usd_mtd         numeric(10,4) not null default 0,
  last_run_at           timestamptz,
  last_spend_reset_at   timestamptz not null default now(),           -- workaround pre-pg_cron
  created_by            uuid references auth.users(id) on delete set null,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, slug)
);

comment on table public.agents is
  'Instancias de skills instaladas por tenant. status off/paused/active. budget_usd_monthly enforced via update_agent_spend RPC.';

create index agents_tenant_status_idx
  on public.agents (tenant_id, status) where deleted_at is null;
create index agents_skill_id_fk_idx
  on public.agents (skill_id) where deleted_at is null;
create index agents_created_by_fk_idx
  on public.agents (created_by) where deleted_at is null and created_by is not null;

-- ─── Tabla: agent_tool_grants ───────────────────────────────
create table public.agent_tool_grants (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  tool_key      text not null,
  scope         jsonb not null default '{}'::jsonb,
  granted_by    uuid references auth.users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  unique (agent_id, tool_key)
);

comment on table public.agent_tool_grants is
  'Tools que un agent tiene permiso de ejecutar. V1 auto-grant todas las tools_required al instalar. scope JSONB para granularidad futura (SDD-0021).';

create index agent_tool_grants_agent_id_fk_idx
  on public.agent_tool_grants (agent_id);
create index agent_tool_grants_granted_by_fk_idx
  on public.agent_tool_grants (granted_by) where granted_by is not null;

-- ─── Tabla: agent_runs (append-only) ────────────────────────
create table public.agent_runs (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.agents(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,   -- denorm para RLS rápido
  trigger           agent_run_trigger not null,
  trigger_source    text,
  idempotency_key   text,
  input             jsonb not null default '{}'::jsonb,
  output            jsonb,
  status            agent_run_status not null default 'running',
  tool_calls        jsonb not null default '[]'::jsonb,
  latency_ms        int,
  tokens_in         int,
  tokens_out        int,
  cost_usd          numeric(10,4),
  error             text,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);

comment on table public.agent_runs is
  'Audit append-only de cada ejecución de agent. idempotency_key UNIQUE per agent_id para deduplicar webhooks/cron reintentos.';

-- UNIQUE parcial: solo cuando idempotency_key no es null
create unique index agent_runs_idempotency_uidx
  on public.agent_runs (agent_id, idempotency_key)
  where idempotency_key is not null;

create index agent_runs_tenant_status_started_idx
  on public.agent_runs (tenant_id, status, started_at desc);
create index agent_runs_agent_started_idx
  on public.agent_runs (agent_id, started_at desc);

-- ─── Tabla: agent_approvals (estructura V1, UI en SDD-0021) ─
create table public.agent_approvals (
  id                  uuid primary key default gen_random_uuid(),
  agent_run_id        uuid not null references public.agent_runs(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,   -- denorm
  requested_action    text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              agent_approval_status not null default 'pending',
  approver_id         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

comment on table public.agent_approvals is
  'Aprobaciones human-in-the-loop. Estructura creada V1 (SDD-0020), UI funcional en SDD-0021.';

create index agent_approvals_tenant_status_idx
  on public.agent_approvals (tenant_id, status, created_at desc);
create index agent_approvals_run_idx
  on public.agent_approvals (agent_run_id);
create index agent_approvals_approver_idx
  on public.agent_approvals (approver_id) where approver_id is not null;

-- ─── Trigger: touch updated_at (reusa func existente) ───────
create trigger skills_touch
  before update on public.skills
  for each row execute function public.touch_updated_at();

create trigger agents_touch
  before update on public.agents
  for each row execute function public.touch_updated_at();

-- ─── RPC: next_agent_slug → AGT-NNNN ───────────────────────
create or replace function public.next_agent_slug(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(slug, '^AGT-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.agents
  where tenant_id = p_tenant_id;
  v_padded := lpad(v_max::text, 4, '0');
  return 'AGT-' || v_padded;
end;
$$;

comment on function public.next_agent_slug is
  'Genera el próximo slug AGT-NNNN para el tenant. Usa assert_tenant_match (DTD-ERPv1-DIA3 audit pattern).';

-- ─── RPC: update_agent_spend (auto-pause si excede budget) ──
create or replace function public.update_agent_spend(
  p_agent_id uuid,
  p_cost_usd numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent record;
  v_now timestamptz := now();
  v_should_pause boolean := false;
  v_caller_tenant uuid := public.get_user_tenant_id();
begin
  -- Lock + fetch (FOR UPDATE evita race en runs concurrentes del mismo agent)
  select id, tenant_id, status, budget_usd_monthly, spend_usd_mtd, last_spend_reset_at
  into v_agent
  from public.agents
  where id = p_agent_id
  for update;

  if v_agent.id is null then
    raise exception 'Agent not found: %', p_agent_id using errcode = 'P0002';
  end if;

  -- Tenant check (service_role bypasea cuando v_caller_tenant es null
  -- — necesario para que el orchestrator pueda llamar desde cron/webhook
  -- sin sesión de usuario; intencional, ver SDD §4.4)
  if v_caller_tenant is not null and v_caller_tenant <> v_agent.tenant_id then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;

  -- Workaround pre-pg_cron: reset spend si cambió el mes desde last_reset
  if date_trunc('month', v_now) > date_trunc('month', v_agent.last_spend_reset_at) then
    update public.agents
    set spend_usd_mtd = p_cost_usd,
        last_spend_reset_at = v_now,
        last_run_at = v_now
    where id = p_agent_id;
    return false;  -- no excede (acabamos de resetear)
  end if;

  -- Sumar el costo del run actual
  update public.agents
  set spend_usd_mtd = v_agent.spend_usd_mtd + p_cost_usd,
      last_run_at = v_now
  where id = p_agent_id;

  -- Chequear si excede → auto-pause
  if (v_agent.spend_usd_mtd + p_cost_usd) > v_agent.budget_usd_monthly then
    update public.agents
    set status = 'paused'
    where id = p_agent_id and status = 'active';
    v_should_pause := true;
  end if;

  return v_should_pause;
end;
$$;

comment on function public.update_agent_spend is
  'Suma cost_usd al spend_usd_mtd con FOR UPDATE lock. Auto-pause si excede budget. Reset mensual workaround pre-pg_cron (SDD-0021 migra a pg_cron real). Returns true si pauseó.';

-- ─── GRANTS ─────────────────────────────────────────────────
grant select on public.skills to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select, insert, update, delete on public.agent_tool_grants to authenticated;
grant select on public.agent_runs to authenticated;
-- INSERT/UPDATE en agent_runs solo via service_role desde orchestrator (audit)
grant select on public.agent_approvals to authenticated;
-- INSERT/UPDATE en agent_approvals via service_role o aprobador (SDD-0021)

grant execute on function public.next_agent_slug(uuid) to authenticated;
grant execute on function public.update_agent_spend(uuid, numeric) to authenticated;
revoke execute on function public.next_agent_slug(uuid) from public, anon;
revoke execute on function public.update_agent_spend(uuid, numeric) from public, anon;

-- ─── RLS ────────────────────────────────────────────────────
alter table public.skills enable row level security;
alter table public.agents enable row level security;
alter table public.agent_tool_grants enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_approvals enable row level security;

-- skills: catálogo global, todos los authenticated ven activos
create policy "skills select to all authenticated"
  on public.skills for select to authenticated
  using (active = true);

-- agents: por tenant (pattern DIA3 audit con SELECT wrap)
create policy "agents by tenant"
  on public.agents for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- agent_tool_grants: por tenant via agent
create policy "agent_tool_grants by tenant"
  on public.agent_tool_grants for all to authenticated
  using (
    exists (
      select 1 from public.agents a
      where a.id = agent_tool_grants.agent_id
        and a.tenant_id = (select public.get_user_tenant_id())
        and a.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.agents a
      where a.id = agent_tool_grants.agent_id
        and a.tenant_id = (select public.get_user_tenant_id())
    )
  );

-- agent_runs: SELECT por tenant (denorm tenant_id permite filter directo y rápido)
create policy "agent_runs select by tenant"
  on public.agent_runs for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- agent_approvals: SELECT por tenant
create policy "agent_approvals select by tenant"
  on public.agent_approvals for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- ─── Seed: skill placeholder Tracking Concierge ──────────────
-- Los schemas + system_prompt definitivos vienen de
-- lib/studio/agents/skills/tracking-concierge.ts en Fase 2 via UPSERT
-- desde scripts/seed.ts. Este seed inicial garantiza que la skill
-- existe en DB desde Fase 1 para tests + UI.
insert into public.skills (
  slug, name, description, category, icon,
  default_model, default_trigger, tools_required,
  input_schema, output_schema, system_prompt,
  cost_estimate_usd, version, active
)
values (
  'tracking-concierge',
  'Tracking Concierge',
  'Responde consultas de estado de carga en español-VE. Read-only: consulta shipments por código o cliente, devuelve resumen + timeline + última posición conocida.',
  'tracking',
  'mapPin',
  'claude-sonnet-4-6'::agent_model,
  'manual'::agent_run_trigger,
  array['get_shipment', 'get_shipment_timeline', 'search_shipments_by_customer', 'get_customer']::text[],
  '{"type":"object","properties":{"query":{"type":"string","description":"Pregunta del cliente"},"customer_markbox":{"type":"string","description":"MARKBOX opcional si conocemos el cliente"}},"required":["query"]}'::jsonb,
  '{"type":"object","properties":{"message":{"type":"string","description":"Respuesta natural"},"shipment_code":{"type":"string"},"citations":{"type":"array","items":{"type":"string"}}},"required":["message","citations"]}'::jsonb,
  '[FASE 1 placeholder — el prompt real se sembrará desde TS en Fase 2]',
  0.015,
  '0.1.0',
  true
)
on conflict (slug) do nothing;
