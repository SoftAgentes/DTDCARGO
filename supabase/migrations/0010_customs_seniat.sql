-- ─────────────────────────────────────────────────────────────
-- SDD-0018: Aduana SENIAT — workflow aduanal VE
-- 3 tablas (agents catálogo, filings 1:1 shipment, documents N por filing)
-- 2 enums (status + doc_type) + función next_dua_code + trigger auto-insert docs
-- Seed 4 agentes reales del JSX de referencia
-- ─────────────────────────────────────────────────────────────

-- Estados del trámite SENIAT
create type customs_status as enum (
  'en_revision',
  'observacion',
  'liberacion',
  'pagado',
  'liberado'
);

-- Tipos de documento del checklist (7 docs)
create type customs_doc_type as enum (
  'commercial',
  'packing',
  'bl',
  'cert_origin',
  'sanitary',
  'dua',
  'payment'
);

-- ─────────────────────────────────────────────────────────────
-- Catálogo de agentes aduanales (global, sin tenant)
-- ─────────────────────────────────────────────────────────────
create table public.customs_agents (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,            -- 'a-001' del JSX, legible
  name            text not null,
  rif             text,
  port_code       text,                            -- 'PBL', 'LGU', 'MAR', 'PFI'
  contact_name    text,
  phone           text,
  email           text,
  rating          numeric(2,1),                    -- 0.0 a 5.0
  shipments_count int not null default 0,          -- denorm, futura
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);

comment on table public.customs_agents is
  'Catálogo global de agentes aduanales venezolanos. Sin tenant_id - son entidades del mundo real compartidas.';

create index customs_agents_port_active_idx
  on public.customs_agents (port_code) where active = true;

-- ─────────────────────────────────────────────────────────────
-- Trámites aduanales (1 por shipment, RLS por tenant)
-- ─────────────────────────────────────────────────────────────
create table public.customs_filings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  dua_code        text not null,                              -- 'DUA-VE-2026-088421'
  port_code       text not null,                              -- snapshot
  agent_id        uuid references public.customs_agents(id) on delete set null,
  status          customs_status not null default 'en_revision',
  hs_codes        text[] not null default '{}',
  total_duty      numeric(12,2) not null default 0,
  igtf            numeric(12,2) not null default 0,
  iva             numeric(12,2) not null default 0,
  agent_fee       numeric(12,2) not null default 0,
  observations    text,
  alert           text,                                       -- nullable, si null no hay alerta
  arrived_at      date not null default current_date,
  cleared_at      date,                                       -- se setea al liberar
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, shipment_id),                            -- 1 filing por shipment
  unique (tenant_id, dua_code)
);

comment on table public.customs_filings is
  'Trámite aduanal SENIAT. 1:1 con shipment. Soft delete via deleted_at. RLS por tenant.';

create index customs_filings_tenant_status_idx
  on public.customs_filings (tenant_id, status) where deleted_at is null;

create index customs_filings_tenant_port_idx
  on public.customs_filings (tenant_id, port_code) where deleted_at is null;

create index customs_filings_tenant_agent_idx
  on public.customs_filings (tenant_id, agent_id) where deleted_at is null;

create index customs_filings_tenant_arrived_idx
  on public.customs_filings (tenant_id, arrived_at desc) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Documentos del checklist (N por filing)
-- ─────────────────────────────────────────────────────────────
create table public.customs_documents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  filing_id       uuid not null references public.customs_filings(id) on delete cascade,
  doc_type        customs_doc_type not null,
  uploaded        boolean not null default false,
  uploaded_at     timestamptz,
  uploaded_by     uuid references auth.users(id),
  file_url        text,                                       -- nullable hasta SDD Storage
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (filing_id, doc_type)
);

comment on table public.customs_documents is
  'Documentos del checklist aduanal (7 tipos predefinidos). Auto-insertados al crear filing via trigger. V1 sin file_url (placeholder hasta Storage SDD).';

create index customs_documents_filing_idx
  on public.customs_documents (filing_id, doc_type);

-- ─────────────────────────────────────────────────────────────
-- Función next_dua_code: DUA-VE-YYYY-NNNNNN (6 dígitos para rango)
-- ─────────────────────────────────────────────────────────────
create or replace function public.next_dua_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(dua_code, '^DUA-VE-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.customs_filings
  where tenant_id = p_tenant_id
    and dua_code like 'DUA-VE-' || v_year || '-%';

  v_padded := lpad(v_max::text, 6, '0');
  return 'DUA-VE-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_dua_code is
  'Genera el próximo dua_code DUA-VE-YYYY-NNNNNN para el tenant del año actual.';

-- ─────────────────────────────────────────────────────────────
-- Trigger: auto-insert los 7 docs del checklist al crear filing
-- ─────────────────────────────────────────────────────────────
create or replace function public.seed_customs_documents()
returns trigger language plpgsql as $$
begin
  insert into public.customs_documents (tenant_id, filing_id, doc_type)
  values
    (new.tenant_id, new.id, 'commercial'),
    (new.tenant_id, new.id, 'packing'),
    (new.tenant_id, new.id, 'bl'),
    (new.tenant_id, new.id, 'cert_origin'),
    (new.tenant_id, new.id, 'sanitary'),
    (new.tenant_id, new.id, 'dua'),
    (new.tenant_id, new.id, 'payment');
  return new;
end; $$;

create trigger customs_filings_seed_docs
  after insert on public.customs_filings
  for each row execute function public.seed_customs_documents();

-- ─────────────────────────────────────────────────────────────
-- GRANTS
-- ─────────────────────────────────────────────────────────────
grant select on public.customs_agents to authenticated;
grant select, insert, update, delete on public.customs_filings to authenticated;
grant select, insert, update, delete on public.customs_documents to authenticated;
grant execute on function public.next_dua_code(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.customs_agents enable row level security;
alter table public.customs_filings enable row level security;
alter table public.customs_documents enable row level security;

-- Agents: catálogo abierto a todos los autenticados
create policy "customs_agents select to all authenticated"
  on public.customs_agents for select
  to authenticated
  using (active = true);

-- Filings: por tenant
create policy "customs_filings by tenant"
  on public.customs_filings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Documents: por tenant
create policy "customs_documents by tenant"
  on public.customs_documents for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

-- ─────────────────────────────────────────────────────────────
-- Triggers updated_at (reusan touch_updated_at de SDD-0005)
-- ─────────────────────────────────────────────────────────────
create trigger customs_filings_touch
  before update on public.customs_filings
  for each row execute function public.touch_updated_at();

create trigger customs_documents_touch
  before update on public.customs_documents
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Seed: 4 agentes aduanales del JSX de referencia
-- ─────────────────────────────────────────────────────────────
insert into public.customs_agents
  (code, name, rif, port_code, contact_name, phone, rating, shipments_count)
values
  ('a-001', 'Aduanas Carabobo CA',  'J-31002284-5', 'PBL', 'Felipe Briceño', '+58 412 552 8841', 4.8, 84),
  ('a-002', 'Logística Aduanal VE', 'J-30884512-7', 'LGU', 'Romina Salas',   '+58 414 220 1188', 4.6, 62),
  ('a-003', 'Zulia Aduanas SA',     'J-30551423-2', 'MAR', 'Yoel Castillo',  '+58 416 778 4477', 4.7, 38),
  ('a-004', 'Falcón Customs',       'J-31884201-9', 'PFI', 'Diana Méndez',   '+58 424 999 2200', 4.9, 24)
on conflict (code) do nothing;
