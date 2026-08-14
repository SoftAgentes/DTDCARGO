\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0369 (SDD-0258, migración por lote del legado).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende:
--   1. ⭐ ARRANCA EN SIMULACRO — la llamada por defecto no escribe nada,
--   2. ⭐ incluye las minúsculas (`DTD-j029`): un patrón `[A-Z]` las deja fuera
--      en silencio, y son 13 fichas reales,
--   3. sólo admin puede correr un lote,
--   4. NO toca a los clientes de aliado — renumerarlos los sacaría de su insignia,
--   5. delega en rename_client_markbox: cada uno deja historial y reserva su
--      código viejo,
--   6. respeta el tamaño del lote y sabe cuántos faltan,
--   7. los códigos que emite no chocan entre sí ni con los ya retirados.

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
\ir ../migrations/0369_rename_legacy_markboxes.sql

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

insert into public.clients (id, tenant_id, markbox, aliado_id) values
  -- Legado en MAYÚSCULA (el caso obvio).
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-A101', null),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-J044', null),
  -- ⭐ Legado en MINÚSCULA: 13 fichas reales así en prod. Un patrón `[A-Z]` las
  -- deja fuera y nadie se entera.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-j029', null),
  -- Serie limpia: no se toca, y marca el punto de partida del correlativo.
  ('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058', null);

-- Un cliente de aliado, que NO entra al lote.
insert into public.aliados (id, tenant_id, prefix)
values ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000d7d1', 'DC');
insert into public.clients (id, tenant_id, markbox, aliado_id)
values ('00000000-0000-0000-0000-00000000c005', '00000000-0000-0000-0000-00000000d7d1',
        'DC-0001', '00000000-0000-0000-0000-00000000a111');

insert into public.invoices (tenant_id, client_markbox)
values ('00000000-0000-0000-0000-00000000d7d1', 'DTD-A101');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. ⭐ ARRANCA EN SIMULACRO: la llamada por defecto NO escribe.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert (r->>'simulacro')::boolean, 'el default tiene que ser simulacro';
  assert (r->>'renombrados')::int = 0, 'un simulacro no puede renombrar nada';
  assert (r->>'en_este_lote')::int = 3, format('esperaba listar 3, listó %s', r->>'en_este_lote');
end $$;

do $$ begin
  assert (select markbox from public.clients where id='00000000-0000-0000-0000-00000000c001') = 'DTD-A101',
    'el simulacro TOCÓ datos';
  assert (select count(*) from public.client_markbox_history) = 0, 'el simulacro escribió historial';
end $$;

-- 2. ⭐ Las minúsculas entran al mapeo. Sin esto, 13 fichas se quedan atrás.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert r->>'mapeo' like '%DTD-j029%',
    'la ficha en minúscula quedó fuera del lote — un patrón [A-Z] la deja pasar';
end $$;

-- 3. El cliente de aliado NO aparece en el mapeo.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes();
  assert r->>'mapeo' not like '%DC-0001%',
    'metió a un cliente de aliado en el lote: renumerarlo lo saca de su insignia';
end $$;

-- 4. Tamaño de lote: se respeta, y el resto queda pendiente.
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(p_batch => 2);
  assert (r->>'en_este_lote')::int = 2, 'no respetó el tamaño del lote';
  begin
    perform public.rename_legacy_markboxes(p_batch => 0);
    raise exception 'CONTRATO ROTO: aceptó un lote de 0';
  exception when others then
    if sqlstate <> '22023' then raise; end if;
  end;
end $$;

-- ── EL LOTE DE VERDAD ────────────────────────────────────────────────────────
do $$
declare r jsonb;
begin
  r := public.rename_legacy_markboxes(p_batch => 50, p_dry_run => false);
  assert (r->>'renombrados')::int = 3, format('esperaba renombrar 3, hizo %s', r->>'renombrados');
  assert (r->>'pendientes_despues')::int = 0, 'quedaron fichas del legado sin migrar';
end $$;

-- 5. Delegó de verdad: hay historial, y el código viejo sigue resolviendo.
do $$ begin
  assert (select count(*) from public.client_markbox_history) = 3,
    'no dejó historial — señal de que hizo un UPDATE en vez de delegar';
  assert (select client_id from public.resolve_markbox(
            '00000000-0000-0000-0000-00000000d7d1', 'DTD-A101'))
         = '00000000-0000-0000-0000-00000000c001',
    'el código viejo dejó de resolver: una caja rotulada con él llegaría huérfana';
  -- Y las copias se movieron (la factura iba con DTD-A101).
  assert (select count(*) from public.invoices where client_markbox = 'DTD-A101') = 0,
    'la factura se quedó con el código viejo';
end $$;

-- 6. Los códigos emitidos arrancan DESPUÉS del máximo y no chocan.
do $$
declare v_nuevos text[];
begin
  select array_agg(markbox order by markbox) into v_nuevos
    from public.clients
   where markbox ~ '^DTD-\d+$' and id <> '00000000-0000-0000-0000-00000000c004';
  assert v_nuevos = array['DTD-9059','DTD-9060','DTD-9061'],
    format('esperaba 9059..9061 (después del máximo 9058), dio %s', v_nuevos::text);
end $$;

-- Y el correlativo normal sigue el hilo, sin reemitir ninguno de los retirados.
do $$ begin
  assert public.next_markbox('00000000-0000-0000-0000-00000000d7d1') = 'DTD-9062',
    'el correlativo no siguió después del lote';
end $$;

-- 7. Sólo admin.
update public.user_tenants set role = 'commercial'
 where user_id = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    perform public.rename_legacy_markboxes(p_batch => 1, p_dry_run => false);
    raise exception 'CONTRATO ROTO: un rol no-admin pudo correr un lote';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
