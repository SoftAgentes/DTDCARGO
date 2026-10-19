-- SDD-0558 · Esquema mínimo para probar 0492 (public.client_outstanding).
--
-- NO es un contrato: lo incluyen con \ir el contrato
-- `0492_client_outstanding.test.sql` y, desde PGlite, la prueba de paridad y
-- la anti-deriva de `lib/studio/__tests__/client-outstanding.migration.test.ts`.
-- Por eso no empieza ni termina transacción: la abre quien lo incluye.
--
-- Cascarones con las columnas y tipos que el preflight de 0492 exige, los
-- enums reales de 0077 y 0195, y los cuerpos EXACTOS de los helpers que 0492
-- reutiliza: get_user_tenant_id (0453), current_studio_role (0200),
-- document_entity_module_contract y document_entity_authorized (0444). El
-- preflight los compara por md5, así que una copia que se aparte del árbol
-- hace fallar el contrato antes de la primera aserción.
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.clients') is not null then
    raise exception 'TEST 0492: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
-- auth.uid() y auth.role() leen los claims de la solicitud, como en Supabase.
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')
$$;

-- Columnas de 0001/0019/0200, con el CHECK de rol de producción.
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id),
  constraint user_tenants_role_check check (role in ('admin', 'commercial', 'operations', 'accounting',
    'warehouse', 'support', 'marketing'))
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);

-- El cuerpo exacto de 0453: la ÚNICA membresía activa.
create function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1]
  from public.user_tenants as ut
  where ut.user_id = (select auth.uid())
    and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
-- El cuerpo exacto de 0200.
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;

-- Overrides de 0357, con sus invariantes.
create table public.studio_role_module_overrides (
  tenant_id uuid not null references public.tenants(id),
  role text not null,
  module_id text not null,
  can_view boolean not null,
  can_edit boolean not null,
  constraint studio_role_module_overrides_pkey primary key (tenant_id, role, module_id),
  constraint studio_role_module_overrides_edit_implies_view check (((not can_edit) or can_view)),
  constraint studio_role_module_overrides_role_check check ((role = any (array['commercial'::text,
    'operations'::text, 'accounting'::text, 'warehouse'::text, 'support'::text, 'marketing'::text])))
);

-- Los dos cuerpos exactos de 0444 (líneas 72-95 y 102-160).
create or replace function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql
immutable
security invoker
set search_path = ''
as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[]),
    ('bitacora_task', 'bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('none', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('', 'documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_entity_type, ''))
  )
$$;
revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

create or replace function public.document_entity_authorized(
  p_entity_type text,
  p_tenant_id uuid,
  p_access text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) as entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) as access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) as role
    from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id
      and ut.disabled_at is null
    limit 1
  ), decision as (
    select
      n.entity_type,
      n.access,
      m.role,
      c.module_id,
      c.default_roles,
      o.can_view,
      o.can_edit
    from normalized n
    cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c
      on true
    left join public.studio_role_module_overrides o
      on o.tenant_id = p_tenant_id
     and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
     and o.module_id = c.module_id
  )
  select coalesce((
    select case
      when d.access not in ('view', 'edit') then false
      when d.entity_type in (
        'invoice',
        'supplier_bill',
        'supplier_payment',
        'journal_entry'
      ) then d.role in ('accounting', 'admin')
      when d.module_id is not null and d.role = 'admin' then true
      when d.module_id is not null and d.access = 'view' then
        coalesce(d.can_view, d.role = any(d.default_roles))
      when d.module_id is not null and d.access = 'edit' then
        d.role <> 'support'
        and coalesce(d.can_edit, d.role = any(d.default_roles))
      else false
    end
    from decision d
  ), false)
$$;
revoke all on function public.document_entity_authorized(text,uuid,text)
  from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text)
  to authenticated, service_role;

-- clients (0001, 0341), su historial (0367) y facturas (0077), con los tipos
-- reales. Cobros (0079, 0122) y reportes de pago (0195): solo lo que 0492 lee.
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, deleted_at timestamptz,
  merged_into_client_id uuid references public.clients(id) on delete set null
);
alter table public.clients enable row level security;
create table public.client_markbox_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  markbox text not null, retired_at timestamptz not null default now()
);
alter table public.client_markbox_history enable row level security;
create type public.invoice_status as enum ('borrador', 'emitida', 'parcial', 'pagada', 'vencida', 'anulada');
create type public.invoice_currency as enum ('USD', 'VES', 'USDT', 'CNY');
create table public.invoices (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  invoice_code text not null, client_markbox text not null,
  currency public.invoice_currency not null default 'USD',
  total_amount numeric(14,2) not null, paid_amount numeric(14,2) not null default 0,
  status public.invoice_status not null default 'borrador',
  issued_at date, due_date date, last_payment_at timestamptz, deleted_at timestamptz
);
alter table public.invoices enable row level security;
create table public.payment_receipts (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  invoice_id uuid references public.invoices(id), amount numeric(14,2) not null,
  received_at date not null, deleted_at timestamptz
);
alter table public.payment_receipts enable row level security;
create type public.payment_report_status as enum ('reportado', 'confirmado', 'rechazado');
create table public.payment_reports (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  invoice_id uuid not null references public.invoices(id), amount numeric(14,2) not null,
  paid_at date not null, status public.payment_report_status not null default 'reportado',
  deleted_at timestamptz
);
alter table public.payment_reports enable row level security;
