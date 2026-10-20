\set ON_ERROR_STOP on
-- SDD-0567 · Fixture de scripts/qa/radiografia-referidos.sql, para PGlite.
-- Base sintética y desechable; nunca una base alojada. El esquema es el del
-- contrato supabase/tests/0494_credito_referido_candado.test.sql (migraciones
-- REALES de facturas, contabilidad y referidos, y la 0494). Después siembra,
-- sin disparadores ni FK (session_replication_role = replica), estados que el
-- guardián de la 0494 ya no permite: así se prueba que la radiografía los ve.
-- La siembra la elige la prueba: pg_temp.sembrar_limpio() o pg_temp.sembrar_sucio().
do $fixture_guard$
begin
  if to_regclass('public.invoices') is not null or to_regclass('public.tenants') is not null
     or to_regclass('public.referrals') is not null then
    raise exception 'radiografia-referidos: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema auth to authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique not null, display_name text not null);
create table public.user_tenants (
  user_id uuid not null references auth.users(id), tenant_id uuid not null references public.tenants(id),
  role text not null, disabled_at timestamptz, primary key (user_id, tenant_id)
);
alter table public.user_tenants enable row level security;
grant select on public.user_tenants to authenticated;
create policy "users see their own user_tenants" on public.user_tenants
  for select to authenticated using (user_id = (select auth.uid()) and disabled_at is null);
-- El cuerpo de get_user_tenant_id es el de 0453, que el preflight exige por md5.
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select (pg_catalog.array_agg(ut.tenant_id))[1] from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null
  having pg_catalog.count(*) = 1;
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- Los overrides de rol por módulo (lib/studio/rbac.ts), que lee fidelizacion_edicion_autorizada.
create table public.studio_role_module_overrides (
  tenant_id uuid not null references public.tenants(id), role text not null,
  module_id text not null, can_edit boolean, primary key (tenant_id, role, module_id)
);
create table public.shipments (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  shipment_service text, deleted_at timestamptz
);
create table public.clients (
  id uuid primary key, tenant_id uuid not null references public.tenants(id),
  markbox text not null, name text, deleted_at timestamptz
);
create table public.fiscal_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade
);
create table public.entity_audit_log (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  entity_type text not null, entity_id uuid not null, actor_type text not null,
  actor_id uuid, event_type text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint entity_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint entity_audit_log_actor_type_check check (actor_type in ('user', 'operario', 'system'))
);
alter table public.entity_audit_log enable row level security;
create policy entity_audit_log_tenant_select on public.entity_audit_log for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy entity_audit_log_service_role_all on public.entity_audit_log for all to service_role
  using (true) with check (true);
grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;
create publication supabase_realtime;
alter publication supabase_realtime add table public.entity_audit_log;

\ir ../../supabase/migrations/0077_invoices.sql
\ir ../../supabase/migrations/0078_contabilidad.sql
\ir ../../supabase/migrations/0098_fidelizacion_referidos.sql
\ir ../../supabase/migrations/0197_referral_auto_accredit.sql
\ir ../../supabase/migrations/0237_referral_credit_apply.sql
\ir ../../supabase/migrations/0238_referrals_accredited_at.sql
\ir ../../supabase/migrations/0250_referral_settings.sql
\ir ../../supabase/migrations/0407_invoices_write_rbac.sql
\ir ../../supabase/migrations/0471_credito_referido_atomico.sql
\ir ../../supabase/migrations/0494_credito_referido_candado.sql

set session_replication_role = replica;

create function pg_temp.u(p text) returns uuid language sql immutable as $$ select md5(p)::uuid $$;

-- Inserta una fila con los valores dados y rellena las columnas NOT NULL sin
-- default con un valor del tipo. Solo inserta las columnas que nombra.
create function pg_temp.fila(p_tabla regclass, p_valores jsonb) returns void language plpgsql as $$
declare
  v_col record;
  v_json jsonb := p_valores;
  v_cols text;
begin
  for v_col in
    select a.attname, a.atttypid, t.typtype, t.typcategory
    from pg_attribute a join pg_type t on t.oid = a.atttypid
    where a.attrelid = p_tabla and a.attnum > 0 and not a.attisdropped and a.attnotnull
      and not a.atthasdef and a.attidentity = '' and a.attgenerated = ''
  loop
    if not v_json ? v_col.attname then
      v_json := v_json || jsonb_build_object(v_col.attname,
        case
          when v_col.typtype = 'e' then to_jsonb((select e.enumlabel from pg_enum e
            where e.enumtypid = v_col.atttypid order by e.enumsortorder limit 1))
          when v_col.atttypid = 'uuid'::regtype then to_jsonb(gen_random_uuid())
          when v_col.typcategory = 'N' then to_jsonb(0)
          when v_col.typcategory = 'B' then to_jsonb(false)
          when v_col.atttypid = 'date'::regtype then to_jsonb(current_date)
          when v_col.typcategory = 'D' then to_jsonb(now())
          when v_col.atttypid in ('jsonb'::regtype, 'json'::regtype) then '{}'::jsonb
          when v_col.typcategory = 'A' then '[]'::jsonb
          else to_jsonb('f-' || substr(md5(random()::text), 1, 10))
        end);
    end if;
  end loop;
  select string_agg(quote_ident(k), ', ') into v_cols from jsonb_object_keys(v_json) k;
  execute format('insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1)',
    p_tabla, v_cols, v_cols, p_tabla) using v_json;
end;
$$;

-- Un tenant, el referidor y cinco clientes referidos.
select pg_temp.fila('public.tenants', jsonb_build_object('id', pg_temp.u('t1')));
select pg_temp.fila('public.clients', jsonb_build_object('id', pg_temp.u('c' || n), 'tenant_id', pg_temp.u('t1'),
  'markbox', 'DTD-900' || n))
from generate_series(0, 6) n;

-- Ventas: c1 emitida, c2 pagada, c5 solo anulada; c3 y c4 sin factura. La
-- factura del referidor (c0), donde se aplican los créditos.
select pg_temp.fila('public.invoices', jsonb_build_object('id', pg_temp.u('i' || x.k), 'tenant_id', pg_temp.u('t1'),
  'client_markbox', x.markbox, 'status', x.estado))
from (values ('1', 'DTD-9001', 'emitida'), ('2', 'DTD-9002', 'pagada'), ('5', 'DTD-9005', 'anulada'), ('6', 'DTD-9006', 'emitida'),
             ('ref', 'DTD-9000', 'emitida')) x(k, markbox, estado);

-- Un referido: estado, cliente referido, monto y columnas de aplicación.
create function pg_temp.referido(p_k text, p_estado text, p_cliente text, p_monto numeric,
                                 p_aplicado_en text default null) returns void language plpgsql as $$
begin
  perform pg_temp.fila('public.referrals', jsonb_build_object(
    'id', pg_temp.u('r' || p_k), 'tenant_id', pg_temp.u('t1'), 'referral_code', 'REF-2026-' || p_k,
    'referrer_client_id', pg_temp.u('c0'), 'referrer_markbox', 'DTD-9000', 'referred_name', 'Fixture ' || p_k,
    'referred_client_id', pg_temp.u(p_cliente), 'status', p_estado, 'reward_usd', p_monto,
    'accredited_at', case when p_estado in ('acreditado', 'aplicado') then now() end,
    'applied_invoice_id', case when p_aplicado_en is not null then pg_temp.u('i' || p_aplicado_en) end,
    'applied_at', case when p_aplicado_en is not null then now() end));
end;
$$;

-- Un asiento de crédito de referido.
create function pg_temp.asiento(p_k text, p_referido text, p_factura text, p_estado text) returns void
language plpgsql as $$
begin
  perform pg_temp.fila('public.journal_entries', jsonb_build_object(
    'id', pg_temp.u('e' || p_k), 'tenant_id', pg_temp.u('t1'),
    'entry_date', current_date, 'status', p_estado, 'source', 'referral_credit',
    'referral_id', pg_temp.u('r' || p_referido), 'invoice_id', pg_temp.u('i' || p_factura)));
end;
$$;

-- Limpio: cada referido es coherente. La radiografía da solo las filas R0.
create function pg_temp.sembrar_limpio() returns void language plpgsql as $sembrar$
begin
  perform pg_temp.referido('1', 'registrado', 'c3', 0);
  perform pg_temp.referido('2', 'acreditado', 'c1', 80);
  perform pg_temp.referido('3', 'aplicado', 'c2', 80, 'ref');
  perform pg_temp.asiento('1', '3', 'ref', 'asentado');
end;
$sembrar$;

-- Sucio: enciende R1 (sin venta, dos veces), R2, R3c, R4, R4d y R5.
create function pg_temp.sembrar_sucio() returns void language plpgsql as $sembrar$
begin
  perform pg_temp.referido('4', 'acreditado', 'c4', 80);
  perform pg_temp.referido('5', 'aplicado', 'c1', 80, 'ref');
  perform pg_temp.asiento('2', '5', 'ref', 'anulado');
  perform pg_temp.asiento('3', '5', 'ref', 'asentado');
  perform pg_temp.referido('6', 'aplicado', 'c2', 80, 'ref');
  perform pg_temp.asiento('4', '6', 'ref', 'asentado');
  -- c6 y no c1: desde la 0494 hay un solo referido vivo por cliente.
  perform pg_temp.referido('7', 'acreditado', 'c6', 80, 'ref');
  perform pg_temp.asiento('5', '7', 'ref', 'asentado');
  perform pg_temp.referido('8', 'acreditado', 'c5', 80);
end;
$sembrar$;
