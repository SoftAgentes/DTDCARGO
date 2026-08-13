\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0367 (SDD-0258, historial de Shipping Mark).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que rompe en silencio:
--   1. ⭐ el código retirado SIGUE RESOLVIENDO — la caja rotulada con el viejo
--      no llega huérfana,
--   2. ⭐ el código retirado NUNCA se reemite — sin esto el contador retrocede y
--      el próximo cliente hereda la historia visible del anterior (fuga de datos
--      entre clientes, no un enlace roto),
--   3. el renombrado MUEVE las copias — si no, el portal del cliente se vacía
--      sin dar un solo error,
--   4. un código retirado no se puede reclamar,
--   5. el renombrado respeta la cadena del aliado — cierra el hueco de la migr
--      0362, cuyo guard sólo validaba el formato en INSERT,
--   6. sin permiso no se puede renombrar (ni sondear qué ids existen),
--   7. `legal_acceptances` NO se toca y se reporta como cabo suelto.
--
-- ⚠️ SOBRE EL ESCENARIO DEL PUNTO 2. El cliente que se renombra es EL DEL NÚMERO
-- MÁS ALTO, y se renombra SALIENDO de la familia DTD-NNNN. Si se renombrara a un
-- número mayor (9058 → 9100) el test pasaría igual con el arreglo roto, porque
-- el máximo subiría solo. Un escenario que no discrimina deja el verde sin
-- significado.

begin;

-- ── Fixture mínimo ───────────────────────────────────────────────────────────
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

-- Las 27 tablas restantes que copian el código. Stub mínimo: tenant + columna.
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

-- ── La migración real ────────────────────────────────────────────────────────
\ir ../migrations/0367_client_markbox_historial.sql

-- Permisos de fixture, para poder montar el escenario y verificarlo desde el rol
-- authenticated. ⚠️ `client_markbox_history` queda con SELECT y nada más: el
-- último contrato comprueba que escribirlo a mano sigue negado, y si le diera
-- INSERT acá ese contrato pasaría a ser decorado.
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
insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1'::uuid);
insert into public.user_tenants (user_id, tenant_id, role)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000d7d1', 'admin');

-- DTD-9058 es EL MÁXIMO de la familia de la casa. Ver la nota del encabezado.
insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9058'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DTD-9012');

insert into public.invoices (tenant_id, client_markbox)
values ('00000000-0000-0000-0000-00000000d7d1', 'DTD-9058');
insert into public.legal_acceptances (tenant_id, client_markbox)
values ('00000000-0000-0000-0000-00000000d7d1', 'DTD-9058');
insert into public.dispatch_orders (id, tenant_id)
values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d7d1');
insert into public.dispatch_order_packages (od_id, markbox)
values ('00000000-0000-0000-0000-00000000d001', 'DTD-9058');
insert into public.dispatch_rules (tenant_id, vip_markboxes)
values ('00000000-0000-0000-0000-00000000d7d1', array['DTD-9058']);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- Antes de nada: DTD-9058 es el máximo, así que el siguiente sería DTD-9059.
do $$ begin
  assert (select public.next_markbox('00000000-0000-0000-0000-00000000d7d1')) = 'DTD-9059',
    'precondición rota: DTD-9058 debería ser el máximo';
end $$;

-- ── EL RENOMBRADO ────────────────────────────────────────────────────────────
-- Sale de la familia DTD-NNNN a propósito (ver nota del encabezado).
do $$
declare r jsonb;
begin
  r := public.rename_client_markbox(
        '00000000-0000-0000-0000-00000000c001', 'leg-0001', 'código legacy de vendedor');

  assert r->>'old_markbox' = 'DTD-9058', 'no reportó el código viejo';
  assert r->>'new_markbox' = 'LEG-0001', 'no normalizó a mayúsculas';

  -- 7. legal_acceptances NO se toca, y lo dice.
  assert (r->'needs_review'->>'legal_acceptances_bajo_codigo_viejo')::int = 1,
    'debía reportar la aceptación legal que quedó bajo el código viejo';
end $$;

-- 1. ⭐ El código retirado SIGUE RESOLVIENDO, y avisa que redirigió.
do $$
declare v_id uuid; v_canon text; v_redir boolean;
begin
  select client_id, canonical_markbox, was_redirected into v_id, v_canon, v_redir
    from public.resolve_markbox('00000000-0000-0000-0000-00000000d7d1', 'DTD-9058');
  assert v_id = '00000000-0000-0000-0000-00000000c001', 'el código retirado no resolvió a su dueño';
  assert v_canon = 'LEG-0001', 'no devolvió el código canónico actual';
  assert v_redir, 'debía marcar was_redirected';
end $$;

-- Y sigue funcionando en minúsculas y con espacios, como antes.
do $$ begin
  assert (select count(*) from public.resolve_markbox(
    '00000000-0000-0000-0000-00000000d7d1', '  dtd-9058 ')) = 1,
    'resolve_markbox dejó de ser tolerante a mayúsculas/espacios';
end $$;

-- 2. ⭐ El código retirado NUNCA se reemite.
do $$
declare v_next text;
begin
  v_next := public.next_markbox('00000000-0000-0000-0000-00000000d7d1');
  assert v_next <> 'DTD-9058',
    format('REEMITIÓ el código retirado: %s. El próximo cliente heredaría la historia del anterior.', v_next);
  assert v_next = 'DTD-9059', format('esperaba DTD-9059, dio %s', v_next);
end $$;

-- 3. El renombrado movió las copias, incluidas la que no tiene tenant_id propio
--    y los dos arrays.
do $$ begin
  assert (select count(*) from public.invoices where client_markbox = 'LEG-0001') = 1,
    'la factura quedó apuntando al código viejo — el portal del cliente se vacía';
  assert (select count(*) from public.dispatch_order_packages where markbox = 'LEG-0001') = 1,
    'dispatch_order_packages no se movió (es la única sin tenant_id propio)';
  assert (select count(*) from public.dispatch_rules
           where 'LEG-0001' = any(vip_markboxes)) = 1,
    'el array de VIP no se movió — el cliente deja de ser VIP en silencio';
  -- Y la aceptación legal se quedó donde estaba, a propósito.
  assert (select count(*) from public.legal_acceptances where client_markbox = 'DTD-9058') = 1,
    'reescribió el expediente sellado: eso invalida el hash';
end $$;

-- 4. Un código retirado no se puede reclamar.
do $$ begin
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c002', 'DTD-9058');
    raise exception 'CONTRATO ROTO: dejó reclamar un código retirado';
  exception when unique_violation then null;
  end;
end $$;

-- Ni uno que ya sea de otro cliente vivo.
do $$ begin
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c002', 'LEG-0001');
    raise exception 'CONTRATO ROTO: dejó tomar el código de otro cliente';
  exception when unique_violation then null;
  end;
end $$;

-- 5. El renombrado respeta la cadena del aliado (hueco de la migr 0362, que
--    sólo validaba el formato en INSERT).
insert into public.aliados (id, tenant_id, prefix)
values ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000d7d1', 'DC');
update public.clients set aliado_id = '00000000-0000-0000-0000-00000000a111'
 where id = '00000000-0000-0000-0000-00000000c002';

do $$ begin
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c002', 'XX-0001');
    raise exception 'CONTRATO ROTO: un cliente de DC aceptó un código que no es de su cadena';
  exception when check_violation then null;
  end;
end $$;

-- Y al revés: un cliente SIN aliado no puede usar la insignia de uno.
do $$
declare v_id uuid;
begin
  insert into public.clients (tenant_id, markbox)
  values ('00000000-0000-0000-0000-00000000d7d1', 'DTD-9013') returning id into v_id;
  begin
    perform public.rename_client_markbox(v_id, 'DC-0777');
    raise exception 'CONTRATO ROTO: un cliente sin aliado tomó la insignia de DC';
  exception when check_violation then null;
  end;
end $$;

-- El de DC sí puede tomar su propio código de cadena.
do $$ begin
  perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c002', 'DC-0001');
  assert (select markbox from public.clients where id = '00000000-0000-0000-0000-00000000c002') = 'DC-0001',
    'un cliente de DC no pudo tomar el código de su propia cadena';
end $$;

-- 6. Sin permiso no se puede renombrar.
update public.user_tenants set role = 'support'
 where user_id = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    perform public.rename_client_markbox('00000000-0000-0000-0000-00000000c001', 'OTRO-0001');
    raise exception 'CONTRATO ROTO: un rol sin permiso pudo renombrar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Y la escritura directa en el historial está negada (no hay política de INSERT).
do $$ begin
  begin
    insert into public.client_markbox_history (tenant_id, client_id, markbox)
    values ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'HACK-1');
    raise exception 'CONTRATO ROTO: se pudo escribir el historial a mano';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
