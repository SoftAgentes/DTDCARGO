\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0371 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- LA REGLA: `XX-NNNN` es de los CLIENTES del aliado XX; `XX` pelada es del
-- aliado XX y de nadie mas. Antes de esta migracion la base dejaba pasar `XX`
-- pelada en CUALQUIER ficha, por un hueco: el guard solo miraba `^XX-`.
--
-- Los cinco casos que fijan el limite. El 1 y el 4 son los que discriminan:
-- sin el 1 se puede volver a prohibir todo (y las fichas DC y AG de prod
-- quedarian invalidas); sin el 4 se puede permitir todo y volvemos al hueco.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_t uuid := public.get_user_tenant_id();
begin
  if v_t is null then raise exception 'Authenticated tenant required' using errcode = '42501'; end if;
  if v_t <> p_tenant_id then raise exception 'Tenant mismatch' using errcode = '42501'; end if;
end; $$;

create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_studio_role(p_roles text[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_role text := public.current_studio_role();
begin
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción' using errcode = '42501';
  end if;
end; $$;

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text, deleted_at timestamptz,
  merged_into_client_id uuid references public.clients(id),
  aliado_id uuid, kommo_lead_id bigint
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);

create table public.aliados (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid, parent_aliado_id uuid,
  prefix text not null, status text not null default 'activo', deleted_at timestamptz
);
create function public.aliado_prefix_chain(p_aliado_id uuid) returns text
language sql stable set search_path = public as $$
  select upper(a.prefix) from public.aliados a where a.id = p_aliado_id;
$$;

create table public.dispatch_orders (id uuid primary key, tenant_id uuid not null);
create table public.dispatch_order_packages (od_id uuid not null, markbox text not null);
create table public.dispatch_rules (
  tenant_id uuid not null,
  vip_markboxes text[] not null default '{}',
  whitelist_markboxes text[] not null default '{}'
);

do $stubs$
declare t text;
begin
  foreach t in array array[
    'invoices','prealertas','shipments','payment_reports','payment_receipts',
    'prealerta_service_requests','prealerta_documents','shipment_documents',
    'client_delivery_addresses','client_claims','client_claim_evidence',
    'client_notification_schedule','quotes','sales_orders','purchase_orders',
    'consolidation_items','packing_list_submissions','suppliers_cn','supplier_claims',
    'supplier_order_signals','warehouse_receipts_cn','academy_enrollments',
    'academy_lesson_progress','academy_diplomas','club_members','legal_acceptances'
  ] loop
    execute format('create table public.%I (tenant_id uuid not null, client_markbox text)', t);
  end loop;
  foreach t in array array['warehouse_boxes','warehouse_receipt_ve_boxes','qr_print_orders'] loop
    execute format('create table public.%I (tenant_id uuid not null, markbox text)', t);
  end loop;
end;
$stubs$;

create table public.referrals (tenant_id uuid not null, referrer_markbox text);

\ir ../migrations/0367_client_markbox_historial.sql
\ir ../migrations/0371_insignia_pelada_del_aliado.sql

do $grants$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select on public.%I to authenticated', t);
    if t <> 'client_markbox_history' then
      execute format('grant insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end;
$grants$;

-- ── Datos: dos aliadas con ficha, y un cliente cualquiera ────────────────────
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.user_tenants (user_id, tenant_id, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'admin');

insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DC'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'AG'),
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058');

-- ⚠️ `RA` existe como insignia pero NINGUNA ficha la lleva como codigo. Hace
-- falta para probar la regla de insignia SIN que salte antes el candado de
-- unicidad: con `AG` (que si es el codigo de la ficha c002) el rename rebotaba
-- por 23505 y el test no medía lo que decía medir.
insert into public.clients (id, tenant_id, markbox)
values ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9012');

insert into public.aliados (id, tenant_id, client_id, prefix) values
  ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c001', 'DC'),
  ('00000000-0000-0000-0000-00000000a222', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c002', 'AG'),
  ('00000000-0000-0000-0000-00000000a333', '00000000-0000-0000-0000-00000000d7d1',
   '00000000-0000-0000-0000-00000000c004', 'RA');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- ── La regla, medida directo sobre la funcion ────────────────────────────────
do $$
declare t uuid := '00000000-0000-0000-0000-00000000d7d1';
        dc uuid := '00000000-0000-0000-0000-00000000c001';
        otro uuid := '00000000-0000-0000-0000-00000000c003';
begin
  -- 1. ⭐ `DC` en la ficha de Dynasty Cargo: VALIDO. Es su insignia.
  assert public.markbox_choca_con_insignia(t, 'DC', dc) is null,
    'rechazo la insignia propia del aliado — eso invalidaria las fichas DC y AG de prod';

  -- 2. `DC` en la ficha de otro: prohibido, lo suplantaria.
  assert public.markbox_choca_con_insignia(t, 'DC', otro) = 'DC',
    'dejo que otro cliente tomara la insignia de un aliado';

  -- 3. `AG` en la ficha de Dynasty Cargo: prohibido, es de otra.
  assert public.markbox_choca_con_insignia(t, 'AG', dc) = 'AG',
    'dejo que un aliado tomara la insignia de OTRO aliado';

  -- 4. ⭐ `DC-0001` ni siquiera en su propia ficha: esa forma es de sus CLIENTES.
  assert public.markbox_choca_con_insignia(t, 'DC-0001', dc) = 'DC',
    'dejo que el aliado tomara la forma que le corresponde a sus clientes';

  -- 5. `DC-0777` en un cliente cualquiera: prohibido (ya lo estaba).
  assert public.markbox_choca_con_insignia(t, 'DC-0777', otro) = 'DC',
    'dejo pasar la forma de cliente de aliado en una ficha sin aliado';

  -- Y lo normal sigue pasando.
  assert public.markbox_choca_con_insignia(t, 'DTD-9099', otro) is null,
    'rechazo un codigo normal de la casa';
  -- Sin distinguir mayusculas, como el resto del modulo.
  assert public.markbox_choca_con_insignia(t, 'dc', otro) = 'DC',
    'la comparacion distingue mayusculas y no deberia';
end $$;

-- ── Y por el camino real: rename_client_markbox ──────────────────────────────
do $$ begin
  begin
    -- `RA` no es el codigo de ninguna ficha, asi que si esto pasa es por la
    -- regla de insignia y no por el candado de unicidad.
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c003', 'RA');
    raise exception 'CONTRATO ROTO: un cliente cualquiera tomo la insignia de un aliado';
  exception when check_violation then null;
  end;
end $$;

do $$ begin
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c001', 'DC-0001');
    raise exception 'CONTRATO ROTO: el aliado tomo la forma de sus propios clientes';
  exception when check_violation then null;
  end;
end $$;

-- El aliado SI puede cambiar a un codigo normal de la casa.
do $$ begin
  perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c001', 'DTD-9070');
  assert (select markbox from public.clients where id='00000000-0000-0000-0000-00000000c001') = 'DTD-9070',
    'un aliado no pudo salir de su insignia hacia la serie de la casa';
  -- Y su insignia vieja quedo jubilada y reservada.
  assert (select count(*) from public.client_markbox_history where markbox = 'DC') = 1,
    'no jubilo la insignia vieja';
end $$;

rollback;
