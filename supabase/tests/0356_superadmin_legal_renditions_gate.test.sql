\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0356. Fixtures ficticios y rollback: no toca prod.
--
-- UN CAMBIO DE PERMISOS SE PRUEBA POR LOS DOS LADOS. Lo que defiende:
--   1. un admin NO-plataforma NO puede insertar/actualizar/borrar legal_docs
--   2. un admin SÍ-plataforma SÍ puede
--   3. un admin NO-plataforma NO puede emitir/anular renditions
--   4. un admin SÍ-plataforma SÍ puede
--   5. un admin NO-plataforma NO puede insertar rendition_receipts
--   6. un admin SÍ-plataforma SÍ puede
--   7. lectura (select) sigue abierta a cualquier autenticado del tenant — cero
--      regresión, esto sólo sube el candado de ESCRITURA

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id),
  constraint user_tenants_user_id_profile_fkey
    foreign key (user_id) references public.user_profiles(user_id)
);
-- Real desde 0001_init_tenancy.sql: las policies de legal_docs/renditions/
-- rendition_receipts leen user_tenants DIRECTO en su EXISTS (no a través de
-- get_user_tenant_id(), que sí es security definer) — sin este GRANT,
-- `authenticated` no puede ni evaluar la condición ("permission denied").
grant select on public.user_tenants to authenticated;

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  notes text
);
create function public.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- ── legal_docs, tal como la dejó 0102 (columnas + policies VIEJAS) ─────────
create table public.legal_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  name text not null,
  version text not null,
  effective_date date not null,
  status text not null default 'vigente'
);
alter table public.legal_docs enable row level security;
grant select, insert, update, delete on public.legal_docs to authenticated;
grant all on public.legal_docs to service_role;
create policy "legal_docs read by tenant" on public.legal_docs for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "legal_docs write by admin" on public.legal_docs for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  );
create policy "legal_docs update by admin" on public.legal_docs for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  ) with check (tenant_id = public.get_user_tenant_id());
create policy "legal_docs delete by admin" on public.legal_docs for delete to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  );
create policy "legal_docs service_role all" on public.legal_docs for all to service_role using (true) with check (true);

-- ── renditions + rendition_receipts, tal como las dejó 0123 ────────────────
create table public.payment_receipts (id uuid primary key default gen_random_uuid());
grant all on public.payment_receipts to service_role;

create table public.renditions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rendition_code text not null,
  period_from date not null,
  period_to date not null,
  status text not null default 'emitida'
);
alter table public.renditions enable row level security;
grant select, insert, update on public.renditions to authenticated;
grant all on public.renditions to service_role;
create policy "renditions read by tenant" on public.renditions for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "renditions insert by admin" on public.renditions for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  );
create policy "renditions update by admin" on public.renditions for update to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  ) with check (tenant_id = public.get_user_tenant_id());
create policy "renditions service_role all" on public.renditions for all to service_role using (true) with check (true);

create table public.rendition_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rendition_id uuid not null references public.renditions(id) on delete cascade,
  receipt_id uuid not null references public.payment_receipts(id)
);
alter table public.rendition_receipts enable row level security;
grant select, insert on public.rendition_receipts to authenticated;
grant all on public.rendition_receipts to service_role;
create policy "rendition_receipts read by tenant" on public.rendition_receipts for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "rendition_receipts insert by admin" on public.rendition_receipts for insert to authenticated
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (select 1 from public.user_tenants ut where ut.user_id = auth.uid()
      and ut.tenant_id = public.get_user_tenant_id() and ut.role = 'admin' and ut.disabled_at is null)
  );
create policy "rendition_receipts service_role all" on public.rendition_receipts for all to service_role using (true) with check (true);

-- ── Fixture ─────────────────────────────────────────────────────────────
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','sam@ejemplo.test'),   -- admin + PLATAFORMA
  ('a0000000-0000-0000-0000-000000000002','jose@ejemplo.test');  -- admin normal
insert into public.user_profiles (user_id) values
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','admin');
insert into public.platform_admins (user_id) values ('a0000000-0000-0000-0000-000000000001');

\ir ../migrations/0356_superadmin_legal_renditions_gate.sql

-- ── Policies viejas se fueron, nuevas están ────────────────────────────────
do $t0$
begin
  if exists (select 1 from pg_policies where schemaname='public' and policyname='legal_docs write by admin') then
    raise exception 'La policy vieja de legal_docs sigue viva';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and policyname='legal_docs write by platform admin') then
    raise exception 'No quedó la policy nueva de legal_docs';
  end if;
end;
$t0$;

set local role authenticated;

-- ── 1 + 2. legal_docs ───────────────────────────────────────────────────────
do $t1$
declare n int;
begin
  -- Jose (admin normal) intenta publicar un doc legal → 0 filas
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  begin
    insert into public.legal_docs (tenant_id, key, name, version, effective_date)
    values ('11111111-1111-1111-1111-111111111111','tyc','Términos','v1.0', current_date);
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.legal_docs where key='tyc') then
    raise exception 'HUECO: un admin normal publicó un documento legal';
  end if;

  -- Sam (plataforma) sí puede
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  insert into public.legal_docs (tenant_id, key, name, version, effective_date)
  values ('11111111-1111-1111-1111-111111111111','tyc','Términos','v1.0', current_date);
  if not exists (select 1 from public.legal_docs where key='tyc') then
    raise exception 'El superadmin no pudo publicar un documento legal';
  end if;

  -- update y delete: Jose no puede, Sam sí
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  update public.legal_docs set status='archivada' where key='tyc';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'HUECO: un admin normal archivó un documento legal'; end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  update public.legal_docs set status='archivada' where key='tyc';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El superadmin no pudo archivar un documento legal'; end if;

  -- lectura: sigue abierta a Jose (cero regresión)
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  if not exists (select 1 from public.legal_docs where key='tyc') then
    raise exception 'Regresión: un admin normal ya no puede LEER legal_docs';
  end if;
end;
$t1$;

-- ── 3 + 4. renditions ───────────────────────────────────────────────────────
do $t2$
declare n int;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  begin
    insert into public.renditions (tenant_id, rendition_code, period_from, period_to)
    values ('11111111-1111-1111-1111-111111111111','RND-2026-0001','2026-08-01','2026-08-15');
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.renditions where rendition_code='RND-2026-0001') then
    raise exception 'HUECO: un admin normal emitió una rendición';
  end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  insert into public.renditions (tenant_id, rendition_code, period_from, period_to)
  values ('11111111-1111-1111-1111-111111111111','RND-2026-0001','2026-08-01','2026-08-15');
  if not exists (select 1 from public.renditions where rendition_code='RND-2026-0001') then
    raise exception 'El superadmin no pudo emitir una rendición';
  end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  update public.renditions set status='anulada' where rendition_code='RND-2026-0001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'HUECO: un admin normal anuló una rendición'; end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  update public.renditions set status='anulada' where rendition_code='RND-2026-0001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El superadmin no pudo anular una rendición'; end if;
end;
$t2$;

-- ── 5 + 6. rendition_receipts ────────────────────────────────────────────────
do $t3$
declare v_rendition uuid; v_receipt uuid;
begin
  select id into v_rendition from public.renditions where rendition_code='RND-2026-0001';

  set local role service_role;
  insert into public.payment_receipts default values returning id into v_receipt;
  reset role;
  set local role authenticated;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', true);
  begin
    insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id)
    values ('11111111-1111-1111-1111-111111111111', v_rendition, v_receipt);
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.rendition_receipts where receipt_id = v_receipt) then
    raise exception 'HUECO: un admin normal adjuntó un soporte de rendición';
  end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', true);
  insert into public.rendition_receipts (tenant_id, rendition_id, receipt_id)
  values ('11111111-1111-1111-1111-111111111111', v_rendition, v_receipt);
  if not exists (select 1 from public.rendition_receipts where receipt_id = v_receipt) then
    raise exception 'El superadmin no pudo adjuntar un soporte de rendición';
  end if;
end;
$t3$;

reset role;

rollback;
