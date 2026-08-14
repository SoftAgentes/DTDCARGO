\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0372 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Cierra el tercer choque, el que no revienta nunca hasta el dia que pasa: una
-- insignia NUEVA que pisa un codigo de cliente que YA existe. Los otros dos
-- (insignia vs insignia, cliente vs cliente) ya estaban tapados por indices.

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
\ir ../migrations/0372_insignia_no_choca_con_codigos.sql

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

-- ── Datos ────────────────────────────────────────────────────────────────────
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.user_tenants (user_id, tenant_id, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'admin');

insert into public.clients (id, tenant_id, markbox) values
  -- Un cliente que ya lleva algo con forma de insignia + guion.
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'RA-0007'),
  -- Un cliente que lleva dos letras peladas.
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'ZZ'),
  -- La futura aliada, con codigo normal de la casa.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058'),
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9012');

-- Un codigo jubilado: sigue reservado, asi que su prefijo tampoco se puede tomar.
insert into public.client_markbox_history (tenant_id, client_id, markbox)
values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c004', 'QQ-0001');

-- ⭐ 1. La insignia que pisa el codigo de un cliente vivo: RECHAZADA.
do $$ begin
  begin
    insert into public.aliados (tenant_id, client_id, prefix)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003', 'RA');
    raise exception 'CONTRATO ROTO: creo la insignia RA con un cliente RA-0007 ya existente';
  exception when unique_violation then null;
  end;
end $$;

-- 2. La que pisa un codigo pelado de otro cliente: RECHAZADA.
do $$ begin
  begin
    insert into public.aliados (tenant_id, client_id, prefix)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003', 'ZZ');
    raise exception 'CONTRATO ROTO: creo la insignia ZZ con un cliente ZZ ya existente';
  exception when unique_violation then null;
  end;
end $$;

-- ⭐ 3. La que pisa un codigo JUBILADO: tambien rechazada. Un codigo retirado
--    sigue resolviendo, asi que tomar su prefijo reabre la ambiguedad.
do $$ begin
  begin
    insert into public.aliados (tenant_id, client_id, prefix)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c003', 'QQ');
    raise exception 'CONTRATO ROTO: creo la insignia QQ pisando un codigo jubilado QQ-0001';
  exception when unique_violation then null;
  end;
end $$;

-- 4. Una insignia libre SI se puede crear.
do $$ begin
  insert into public.aliados (id, tenant_id, client_id, prefix)
  values ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000d7d1',
          '00000000-0000-0000-0000-00000000c003', 'XY');
  assert (select count(*) from public.aliados where prefix='XY') = 1,
    'no dejo crear una insignia que no pisa nada';
end $$;

-- 5. ⭐ Renombrar la insignia CON clientes colgando: prohibido.
insert into public.clients (id, tenant_id, markbox, aliado_id)
values ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000d7d1',
        'XY-0001', '00000000-0000-0000-0000-00000000a111');
do $$ begin
  begin
    update public.aliados set prefix = 'XW' where id = '00000000-0000-0000-0000-00000000a111';
    raise exception 'CONTRATO ROTO: renombro la insignia dejando a sus clientes con la cadena vieja';
  exception when check_violation then null;
  end;
end $$;

-- 6. ⭐ EL CASO DE LOS DATOS VIVOS. En prod `DC` y `AG` llevan su insignia como
--    Shipping Mark de su propia ficha (migr 0371). Este trigger dispara al
--    tocarlas: si la exclusion del propio fallara, esas dos aliadas dejarian de
--    poder guardarse. Sin este caso, romper la exclusion pasa desapercibido.
insert into public.clients (id, tenant_id, markbox)
values ('00000000-0000-0000-0000-00000000c006', '00000000-0000-0000-0000-00000000d7d1', 'DC');
do $$ begin
  insert into public.aliados (id, tenant_id, client_id, prefix)
  values ('00000000-0000-0000-0000-00000000a222', '00000000-0000-0000-0000-00000000d7d1',
          '00000000-0000-0000-0000-00000000c006', 'DC');
  assert (select count(*) from public.aliados where prefix='DC') = 1,
    'rechazo una aliada cuya propia ficha lleva su insignia — eso invalida DC y AG en prod';
end $$;

rollback;
