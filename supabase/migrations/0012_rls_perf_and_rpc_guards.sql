-- ─────────────────────────────────────────────────────────────
-- DTD-ERPv1-DIA3 audit fixes (docs/audits/2026-05-24-postgres-rls-audit.md
--   + extras del Supabase advisor oficial)
--   FINDING-001 (CRITICAL) — RPCs de correlativo validan tenant del caller
--   FINDING-002 (HIGH)     — RLS policies usan (select get_user_tenant_id())
--   FINDING-003 (HIGH)     — get_user_tenant_id() usa (select auth.uid())
--   ADVISOR-A  (HIGH)      — 5 trigger funcs sin set search_path
--   ADVISOR-B  (HIGH)      — REVOKE EXECUTE de 2 trigger funcs security definer
--                            expuestas innecesariamente como RPC
--
-- Drop-in. Solo reemplaza definiciones de funciones y policies. NO toca data.
-- Reversible — las definiciones originales están en 0001/0002/0003/0005/0006/
-- 0007/0008/0010/0011/0017 y pueden recrearse desde ahí si hace falta.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. get_user_tenant_id() con SELECT wrap interno (FINDING-003) ───
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = (select auth.uid())
  limit 1;
$$;

comment on function public.get_user_tenant_id is
  'Helper para RLS policies. Devuelve el tenant_id del usuario autenticado. (select auth.uid()) wrap garantiza caching por query.';

-- ─── 2. Guard genérico para RPCs (FINDING-001) ───
-- NULL-safe: caller_tenant null bloquea (clave: NULL <> X = NULL, no TRUE).
create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_tenant uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;
  if v_caller_tenant is null then
    raise exception 'Authenticated tenant required for this operation' using errcode = '42501';
  end if;
  if p_tenant_id <> v_caller_tenant then
    raise exception 'Tenant mismatch: caller does not belong to tenant %', p_tenant_id
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_tenant_match is
  'Guard NULL-safe para security definer RPCs. Lanza 42501 si tenant pasado != tenant del caller (o cualquiera es NULL).';

revoke execute on function public.assert_tenant_match(uuid) from public, anon;
grant execute on function public.assert_tenant_match(uuid) to authenticated;

-- ─── 3. RPCs de correlativo con guard (FINDING-001) ───

-- next_markbox (originally in 0006)
create or replace function public.next_markbox(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.clients
  where tenant_id = p_tenant_id;
  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-' || v_padded;
end;
$$;

-- next_quote_code (originally in 0007)
create or replace function public.next_quote_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(quote_code, '^Q-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_code like 'Q-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'Q-' || v_year || '-' || v_padded;
end;
$$;

-- next_receipt_code (originally in 0008)
create or replace function public.next_receipt_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(receipt_code, '^WR-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id
    and receipt_code like 'WR-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'WR-' || v_year || '-' || v_padded;
end;
$$;

-- next_orphan_code (originally in 0008)
create or replace function public.next_orphan_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.warehouse_receipts_cn
  where tenant_id = p_tenant_id
    and receipt_code like 'SIN-CODIGO-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'SIN-CODIGO-' || v_padded;
end;
$$;

-- next_dua_code (originally in 0010)
create or replace function public.next_dua_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(dua_code, '^DUA-VE-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.customs_filings
  where tenant_id = p_tenant_id
    and dua_code like 'DUA-VE-' || v_year || '-%';
  v_padded := lpad(v_max::text, 6, '0');
  return 'DUA-VE-' || v_year || '-' || v_padded;
end;
$$;

-- next_route_code (originally in 0011)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(route_code, '^R-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.tms_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'R-' || v_year || '-' || v_padded;
end;
$$;

-- next_incident_code (originally in 0011)
create or replace function public.next_incident_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(incident_code, '^I-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.tms_incidents
  where tenant_id = p_tenant_id
    and incident_code like 'I-' || v_year || '-%';
  v_padded := lpad(v_max::text, 4, '0');
  return 'I-' || v_year || '-' || v_padded;
end;
$$;

-- ─── 4. RLS policies con SELECT wrap (FINDING-002) ───
-- Reescribimos las 16 policies del Studio con (select public.get_user_tenant_id())

-- shipments + shipment_events (originally in 0002)
drop policy if exists "shipments by tenant" on public.shipments;
create policy "shipments by tenant"
  on public.shipments for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "shipment_events by tenant" on public.shipment_events;
create policy "shipment_events by tenant"
  on public.shipment_events for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- rates (originally in 0005)
drop policy if exists "rates by tenant" on public.rates;
create policy "rates by tenant"
  on public.rates for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- clients (originally in 0006)
drop policy if exists "clients by tenant" on public.clients;
create policy "clients by tenant"
  on public.clients for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- quotes (originally in 0007)
drop policy if exists "quotes by tenant" on public.quotes;
create policy "quotes by tenant"
  on public.quotes for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- warehouse_receipts_cn + items + events (originally in 0008)
drop policy if exists "warehouse_receipts_cn by tenant" on public.warehouse_receipts_cn;
create policy "warehouse_receipts_cn by tenant"
  on public.warehouse_receipts_cn for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "warehouse_receipt_items by tenant" on public.warehouse_receipt_items;
create policy "warehouse_receipt_items by tenant"
  on public.warehouse_receipt_items for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "warehouse_receipt_events by tenant" on public.warehouse_receipt_events;
create policy "warehouse_receipt_events by tenant"
  on public.warehouse_receipt_events for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

-- customs_filings + documents (originally in 0010)
drop policy if exists "customs_filings by tenant" on public.customs_filings;
create policy "customs_filings by tenant"
  on public.customs_filings for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "customs_documents by tenant" on public.customs_documents;
create policy "customs_documents by tenant"
  on public.customs_documents for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tms_drivers + trucks + routes + incidents (originally in 0011)
drop policy if exists "tms_drivers by tenant" on public.tms_drivers;
create policy "tms_drivers by tenant"
  on public.tms_drivers for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "tms_trucks by tenant" on public.tms_trucks;
create policy "tms_trucks by tenant"
  on public.tms_trucks for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "tms_routes by tenant" on public.tms_routes;
create policy "tms_routes by tenant"
  on public.tms_routes for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "tms_incidents by tenant" on public.tms_incidents;
create policy "tms_incidents by tenant"
  on public.tms_incidents for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

-- tenants + user_tenants (originally in 0001 — usan auth.uid() directo, no get_user_tenant_id)
drop policy if exists "users see their tenant" on public.tenants;
create policy "users see their tenant"
  on public.tenants for select to authenticated
  using (id = (select public.get_user_tenant_id()));

drop policy if exists "users see their own user_tenants" on public.user_tenants;
create policy "users see their own user_tenants"
  on public.user_tenants for select to authenticated
  using (user_id = (select auth.uid()));

-- ─── 5. Trigger functions: agregar set search_path (ADVISOR-A) ───
-- touch_updated_at (originally in 0002)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

-- set_arrived_destination_at (originally in 0002)
create or replace function public.set_arrived_destination_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'arrived_destination'
     and (old.status is null or old.status <> 'arrived_destination')
     and new.arrived_destination_at is null then
    new.arrived_destination_at = now();
  end if;
  return new;
end;
$$;

-- set_delivered_at (originally in 0009)
create or replace function public.set_delivered_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and (old.status is null or old.status <> 'delivered')
     and new.delivered_at is null then
    new.delivered_at = now();
  end if;
  return new;
end;
$$;

-- seed_customs_documents (originally in 0010)
create or replace function public.seed_customs_documents()
returns trigger
language plpgsql
set search_path = public
as $$
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
end;
$$;

-- tms_route_status_timestamps (originally in 0011)
create or replace function public.tms_route_status_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'en_ruta' and (old.status is null or old.status <> 'en_ruta')
     and new.started_at is null then
    new.started_at = now();
  end if;
  if new.status = 'completado' and (old.status is null or old.status <> 'completado')
     and new.completed_at is null then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

-- ─── 6. REVOKE EXECUTE en trigger funcs security definer (ADVISOR-B) ───
-- Estos son trigger functions, NO deberian ser callable como RPC. Postgres
-- las invoca internamente con privilegios del owner; nadie externo deberia
-- llamarlas. Revoke desde public/anon/authenticated cierra el endpoint /rpc/.
revoke execute on function public.cascade_soft_delete_events() from public, anon, authenticated;
revoke execute on function public.create_initial_shipment_event() from public, anon, authenticated;

-- ─── 7. REVOKE anon en RPCs sensibles (cierra anon advisor warnings) ───
-- Los authenticated mantienen grant explicito, pero PUBLIC/anon no necesitan acceso.
revoke execute on function public.get_user_tenant_id() from public, anon;
revoke execute on function public.next_markbox(uuid) from public, anon;
revoke execute on function public.next_quote_code(uuid) from public, anon;
revoke execute on function public.next_receipt_code(uuid) from public, anon;
revoke execute on function public.next_orphan_code(uuid) from public, anon;
revoke execute on function public.next_dua_code(uuid) from public, anon;
revoke execute on function public.next_route_code(uuid) from public, anon;
revoke execute on function public.next_incident_code(uuid) from public, anon;

-- Re-grant a authenticated (por si algun revoke from public lo afecto)
grant execute on function public.get_user_tenant_id() to authenticated;
grant execute on function public.next_markbox(uuid) to authenticated;
grant execute on function public.next_quote_code(uuid) to authenticated;
grant execute on function public.next_receipt_code(uuid) to authenticated;
grant execute on function public.next_orphan_code(uuid) to authenticated;
grant execute on function public.next_dua_code(uuid) to authenticated;
grant execute on function public.next_route_code(uuid) to authenticated;
grant execute on function public.next_incident_code(uuid) to authenticated;
