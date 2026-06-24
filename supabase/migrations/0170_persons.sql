-- ─────────────────────────────────────────────────────────────
-- SDD-0106 (Fase 1): tabla `persons` — identidad por cédula.
--
-- Ancla estable de la persona a través de servicios (carga, academia, …). La
-- cédula/RIF normalizada es única por tenant (espejo del índice de 0095 sobre
-- clients.rif). `clients` pasará a ser el "perfil de carga" de una persona
-- (gana person_id en 0172) y el Shipping Mark se vuelve opcional (0173).
--
-- Aditiva. Backfill: 1 persona por cliente vivo (legacy_client_id = clients.id
-- para trazar el link en 0172). clients.rif ya es único por tenant (0095) → sin
-- colisión; clientes sin rif → persona con cédula null.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.persons (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  national_id      text,                                  -- cédula/RIF (V-/E-/J-/G-/P-); nullable
  doc_kind         text check (doc_kind in ('persona', 'empresa')),
  name             text not null,
  email            text,
  phone            text,
  legacy_client_id uuid,                                  -- auditoría del backfill (link a clients en 0172)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

comment on table public.persons is
  'SDD-0106: identidad de la persona, anclada por cédula/RIF (national_id) única por tenant. clients = perfil de carga (person_id). RLS por tenant. Soft delete.';
comment on column public.persons.national_id is
  'Cédula/RIF normalizable. Único por tenant vía índice parcial normalizado (espejo de clients_tenant_doc_unique, 0095). nullable: una persona puede no tener documento aún.';
comment on column public.persons.legacy_client_id is
  'Auditoría del backfill inicial: el clients.id del que se derivó esta persona. Lo usa 0172 para linkear clients.person_id.';

-- Único parcial normalizado por tenant (mismo criterio que clients_tenant_doc_unique, 0095).
create unique index persons_tenant_doc_unique
  on public.persons (tenant_id, upper(regexp_replace(national_id, '[^A-Za-z0-9]', '', 'g')))
  where national_id is not null and btrim(national_id) <> '' and deleted_at is null;

-- Listado por nombre / lookup por documento.
create index persons_tenant_name_idx
  on public.persons (tenant_id, name) where deleted_at is null;

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF).
grant select, insert, update, delete on public.persons to authenticated;

-- RLS por tenant (mismo patrón que clients, 0006).
alter table public.persons enable row level security;

create policy "persons by tenant"
  on public.persons for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at (reusa función existente).
create trigger persons_touch
  before update on public.persons
  for each row execute function public.touch_updated_at();

-- ── Backfill: 1 persona por cliente vivo ──────────────────────
-- Copia identidad (cédula, nombre, doc_kind, contacto) y guarda legacy_client_id
-- para que 0172 setee clients.person_id. clients.rif único por tenant (0095) →
-- las cédulas no colisionan en el índice único de persons. Idempotente: si ya
-- existe una persona para ese clients.id, no la duplica.
insert into public.persons
  (tenant_id, national_id, doc_kind, name, email, phone, legacy_client_id, created_at)
select
  c.tenant_id, c.rif, c.doc_kind, c.name, c.email, c.phone, c.id, c.created_at
from public.clients c
where c.deleted_at is null
  and not exists (
    select 1 from public.persons p where p.legacy_client_id = c.id
  );
