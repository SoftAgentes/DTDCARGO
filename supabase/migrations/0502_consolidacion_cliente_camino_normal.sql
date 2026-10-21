-- SDD-0578 · Envíos por cliente — camino normal prospectivo.
-- Reserva coordinada por Director el 2026-10-21; fuente de activación:
-- 042-activacion-worker-0578-director.md
-- SHA256 1939a04752338b66bc5187961f8a1a216093dc6101fdb28771bec2efae607be4.
--
-- BORRADOR EN AUTORÍA P1, NO VALIDADO; NO APLICAR.
-- El fusible explícito impide ejecutar este cuerpo incompleto durante autoría.
-- Se redacta en el worktree/owner exclusivo SDD-0578 y conservará:
-- cohorte prospectiva LCL/DDP OFF; legacy y 0496 inmutables por alcance;
-- formación/extensión/sello/estiba/plan/estados y reserva mínima de códigos;
-- RLS/ACL, contexto privado y auditoría atómica; sin backfill ni finanzas 4.3.
--
-- PENDIENTE DE APLICAR: declarar espera por basename exacto en
-- supabase/migrations-baseline.json; aplicación productiva requiere OK nominal
-- de Sam y docs/runbooks/aplicar-migraciones-prod.md, en una autorización aparte.
-- 0495 no se repite y 0496/0502 no se aplican por este encargo local.
-- Instalación/DB/tests/verify esperan turno explícito; no hay resultados aquí.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $authoring_fuse$ begin
  raise exception '0502: borrador SDD-0578 en autoría; NO EJECUTAR';
end $authoring_fuse$;

do $preflight$
declare v_name text;
begin
  foreach v_name in array array[
    'public.shipments', 'public.shipment_events', 'public.consolidations',
    'public.consolidation_items', 'public.consolidation_plans', 'public.warehouse_receipts_cn',
    'public.warehouse_boxes', 'public.consolidation_box_positions', 'public.shipment_rate_snapshots',
    'public.user_tenants', 'public.studio_role_module_overrides', 'public.clients',
    'public.client_users', 'public.dispatch_city_catalog', 'public.expense_alerts'
  ] loop
    if pg_catalog.to_regclass(v_name) is null then
      raise exception '0502: prerrequisito ausente: %', v_name;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null
     or pg_catalog.to_regprocedure('public.naviera_avance_module_authorized(uuid,text)') is null
     or pg_catalog.to_regprocedure('public.congelar_tarifa_recepcion(uuid,text,uuid,uuid,numeric,numeric,public.shipment_service,integer,text,boolean)') is null then
    raise exception '0502 requiere AUD-01, 0477 y el contrato 0496';
  end if;
  if pg_catalog.to_regnamespace('dtd_client_normal') is not null then
    raise exception '0502: el protocolo ya existe; no reejecutar ni sobrescribir';
  end if;
end $preflight$;

-- No API role can enrol a tenant or forge a transaction context. No seed/ON row.
create schema dtd_client_normal authorization postgres;
revoke all on schema dtd_client_normal from public, anon, authenticated, service_role;

create table dtd_client_normal.scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses_cn(id) on delete restrict,
  enabled boolean not null default false,
  starts_at timestamptz,
  protocol_version integer not null default 1 check (protocol_version = 1),
  check (not enabled or starts_at is not null), unique (tenant_id, warehouse_id)
);
comment on table dtd_client_normal.scopes is
  'SDD-0578: altas prospectivas OFF. Activación nominal futura, nunca browser/API. Desactivar no desmarca recepciones o grupos.';

create table dtd_client_normal.receipts (
  receipt_id uuid primary key references public.warehouse_receipts_cn(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  scope_id uuid not null references dtd_client_normal.scopes(id) on delete restrict,
  enrolled_at timestamptz not null default clock_timestamp()
);
create table dtd_client_normal.containers (
  container_id uuid primary key references public.consolidations(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  scope_id uuid not null references dtd_client_normal.scopes(id) on delete restrict,
  revision bigint not null default 0 check (revision >= 0),
  enrolled_at timestamptz not null default clock_timestamp(),
  seal_id uuid, sealed_at timestamptz, seal jsonb,
  check ((seal_id is null and sealed_at is null and seal is null)
      or (seal_id is not null and sealed_at is not null and seal is not null))
);
alter table public.shipments add column client_id uuid references public.clients(id) on delete restrict;
comment on column public.shipments.client_id is
  'SDD-0578: identidad del cliente del envío prospectivo. Nullable en legacy; no backfill. No autoriza consulta por Shipping Mark ajeno.';
create index shipments_client_normal_client_idx on public.shipments(tenant_id, client_id) where client_id is not null;

create table dtd_client_normal.groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  container_id uuid not null references dtd_client_normal.containers(container_id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  shipment_id uuid not null unique references public.shipments(id) on delete restrict,
  item_id uuid not null unique references public.consolidation_items(id) on delete restrict,
  client_markbox text not null,
  service public.shipment_service not null check (service::text in ('consolidado_lcl', 'puerta_a_puerta_DDP')),
  destination_id uuid not null references public.dispatch_city_catalog(id) on delete restrict,
  destination text not null,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null,
  unique (tenant_id, container_id, client_id)
);
create table dtd_client_normal.members (
  receipt_id uuid primary key references dtd_client_normal.receipts(receipt_id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  group_id uuid not null references dtd_client_normal.groups(id) on delete restrict,
  cbm numeric(10,3) not null check (cbm > 0),
  weight_kg numeric(10,2) not null check (weight_kg >= 0),
  boxes integer not null check (boxes > 0),
  group_revision bigint not null check (group_revision >= 1),
  source_version text not null,
  added_at timestamptz not null,
  added_by uuid not null references auth.users(id) on delete restrict
);
create index client_normal_members_group_idx on dtd_client_normal.members(group_id, receipt_id);
create table dtd_client_normal.member_boxes (
  box_id uuid primary key references public.warehouse_boxes(id) on delete restrict,
  receipt_id uuid not null references dtd_client_normal.members(receipt_id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  fixed_data jsonb not null
);
create index client_normal_boxes_receipt_idx on dtd_client_normal.member_boxes(receipt_id, box_id);
create table dtd_client_normal.intentions (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  reference uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null, intent jsonb not null, intent_hash text not null, result jsonb not null,
  occurred_at timestamptz not null,
  primary key (tenant_id, reference)
);
comment on table dtd_client_normal.intentions is
  'Atestación P4: intención estructurada y huella de servidor. Replay histórico sin mutación, evento, fecha o aviso nuevos. No contiene nombre/dirección/evidencia POD.';
create table dtd_client_normal.contexts (
  transaction_id bigint not null, backend_pid integer not null, operation text not null,
  actor_id uuid, operario_id uuid, container_id uuid, occurred_at timestamptz not null default clock_timestamp(),
  shipment_ids uuid[] not null default '{}', receipt_ids uuid[] not null default '{}', box_ids uuid[] not null default '{}',
  primary key (transaction_id, backend_pid, operation)
);
comment on table dtd_client_normal.contexts is
  'Contexto interno del writer validado. Sin grants API, no GUC como autoridad. Se elimina al retornar; rollback atómico elimina la fila.';
create table dtd_client_normal.intakes (
  transaction_id bigint not null, backend_pid integer not null,
  tenant_id uuid not null, warehouse_id uuid not null,
  actor_id uuid, operario_id uuid,
  primary key(transaction_id, backend_pid),
  check ((actor_id is null) <> (operario_id is null))
);
comment on table dtd_client_normal.intakes is
  'Nacimiento por writer validado, no selección de protocolo por caller. Sólo durante esta transacción. Permite adoptar cajas de 0449 tras insertar su cabecera nueva.';

-- A mutex is NOT a reservation: these rows claim no code and preserve all
-- legacy duplicate/format rules outside codes actually reserved by the cohort.
-- UPSERT writes the mutex, so REPEATABLE READ either sees the current winner
-- or raises 40001; an advisory lock + stale snapshot SELECT would not suffice.
create table dtd_client_normal.code_mutex (code text primary key, touched bigint not null default 0);
create table dtd_client_normal.code_reservations (
  code text primary key check (code = upper(btrim(code)) and code ~ '^S-[0-9]{4}-[0-9]{4,10}$'),
  shipment_id uuid not null unique references public.shipments(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  reserved_at timestamptz not null
);
comment on table dtd_client_normal.code_reservations is
  'Sólo códigos NUEVOS de cohorte. Nunca libera/retargetea ni reserva/backfill códigos legacy. Lector 0326 sin tenant requiere este gate global.';
create table dtd_client_normal.plan_inputs (
  plan_id uuid primary key references public.consolidation_plans(id) on delete restrict,
  container_id uuid not null references dtd_client_normal.containers(container_id) on delete restrict,
  manifest_revision bigint not null, manifest_hash text not null, group_revisions jsonb not null, input_hash text not null
);
create table dtd_client_normal.function_contracts (
  signature text primary key, private_name text not null unique, body_md5 text not null,
  owner_oid oid not null, acl pg_catalog.aclitem[], argument_names text[], argument_types oidvector,
  result_type oid not null, returns_set boolean not null, default_count smallint not null
);
do $private_tables$
declare v_table text;
begin
  for v_table in select tablename from pg_catalog.pg_tables where schemaname = 'dtd_client_normal' loop
    execute pg_catalog.format('alter table dtd_client_normal.%I enable row level security', v_table);
    execute pg_catalog.format('revoke all on table dtd_client_normal.%I from public, anon, authenticated, service_role', v_table);
  end loop;
end $private_tables$;

create function dtd_client_normal.fail(p_code text) returns void
language plpgsql set search_path = '' as $fn$
begin raise exception '%', p_code using errcode = 'P0001', hint = 'dtd-client-normal'; end $fn$;
create function dtd_client_normal.content_hash(p_text text) returns text
language sql immutable set search_path = '' as $fn$
  select encode(sha256(convert_to(coalesce(p_text,''),'UTF8')),'hex')
$fn$;

-- Parity with rbac.ts/rbac-guard.ts: active tenant, admin, support-read-only,
-- effective overrides/defaults, geographic scope. No new generic capability.
create function dtd_client_normal.module_allowed(p_tenant uuid, p_module text, p_edit boolean)
returns boolean language sql stable security definer set search_path = '' as $fn$
  with member as (
    select lower(btrim(ut.role)) as role, ut.warehouse_scope from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = p_tenant and ut.disabled_at is null
      and p_tenant = (select public.get_user_tenant_id())
  ), contract(module_id, roles, side) as (values
    ('cn', array['operations','warehouse','support']::text[], 'cn'),
    ('naviera', array['operations','accounting']::text[], null),
    ('tracking', array['commercial','operations','accounting','warehouse','support']::text[], null),
    ('ve', array['operations','warehouse','support']::text[], 've')
  )
  select coalesce((select case when m.role = 'admin' then true
    when p_edit and m.role = 'support' then false
    when c.side is not null and coalesce(m.warehouse_scope, 'all') in ('cn','ve') and m.warehouse_scope <> c.side then false
    else coalesce(case when p_edit then o.can_edit else o.can_view end, m.role = any(c.roles)) end
    from member m join contract c on c.module_id = p_module
    left join public.studio_role_module_overrides o on o.tenant_id = p_tenant
      and lower(btrim(o.role)) = m.role and o.module_id = c.module_id), false)
$fn$;
create function dtd_client_normal.can_form(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $fn$
  select dtd_client_normal.module_allowed(p_tenant,'cn',true)
     and dtd_client_normal.module_allowed(p_tenant,'naviera',true)
     and dtd_client_normal.module_allowed(p_tenant,'tracking',true)
$fn$;
create function dtd_client_normal.can_see_names(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $fn$
  select coalesce((select not (coalesce(ut.region,'') = 'cn' and ut.role <> 'admin') from public.user_tenants ut
    where ut.tenant_id = p_tenant and ut.user_id = (select auth.uid()) and ut.disabled_at is null), false)
$fn$;
create function dtd_client_normal.authorized_context(p_operation text, p_container uuid default null,
  p_shipment uuid default null, p_receipt uuid default null) returns boolean
language sql stable security definer set search_path = '' as $fn$
  select exists(select 1 from dtd_client_normal.contexts c
    where c.transaction_id = pg_catalog.txid_current() and c.backend_pid = pg_catalog.pg_backend_pid()
      and c.operation = p_operation and (p_container is null or c.container_id = p_container)
      and (p_shipment is null or p_shipment = any(c.shipment_ids))
      and (p_receipt is null or p_receipt = any(c.receipt_ids)))
$fn$;
create function dtd_client_normal.strict_client(p_tenant uuid, p_mark text) returns uuid
language sql stable security definer set search_path = '' as $fn$
  select (array_agg(c.id))[1] from public.clients c where c.tenant_id = p_tenant and c.deleted_at is null
    and upper(btrim(c.markbox)) = upper(btrim(coalesce(p_mark,''))) having count(*) = 1
$fn$;
create function dtd_client_normal.receipt_version(p_receipt uuid) returns text
language sql stable security definer set search_path = '' as $fn$
  select md5(jsonb_build_object('id',r.id,'tenant',r.tenant_id,'warehouse',r.warehouse_id,'mark',r.client_markbox,
    'client',dtd_client_normal.strict_client(r.tenant_id,r.client_markbox),'orphan',r.is_orphan,
    'cbm',r.total_cbm,'weight',r.total_weight_kg,'boxes',r.boxes,'destination',r.destination_city,
    'status',r.status,'shipment',r.shipment_id,'deleted',r.deleted_at,
    'boxesData',coalesce((select jsonb_agg(jsonb_build_array(b.id,b.receipt_id,b.tenant_id,b.code,b.seq,b.status,b.cbm,b.weight_kg) order by b.id)
      from public.warehouse_boxes b where b.receipt_id = r.id),'[]'::jsonb),
    'liveSnapshot',(select s.id from public.shipment_rate_snapshots s where s.receipt_id=r.id and s.superseded_at is null)
  )::text) from public.warehouse_receipts_cn r where r.id = p_receipt
$fn$;

create function dtd_client_normal.enrol_receipt() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_scope uuid; v_now timestamptz := clock_timestamp(); v_intake dtd_client_normal.intakes;
begin
  select s.id into v_scope from dtd_client_normal.scopes s where s.tenant_id = new.tenant_id
    and s.warehouse_id = new.warehouse_id and s.enabled and s.starts_at <= v_now;
  if v_scope is not null then
    if new.shipment_id is not null or new.status::text <> 'pendiente_consolidacion' then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
    select * into v_intake from dtd_client_normal.intakes where transaction_id=txid_current()
      and backend_pid=pg_backend_pid() and tenant_id=new.tenant_id and warehouse_id=new.warehouse_id;
    if not found or new.created_by_operario_id is distinct from v_intake.operario_id then
      -- An old/direct caller cannot persist a half-created cohort receipt.
      -- OFF->ON between preview and INSERT aborts that INSERT, not a later DELETE.
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
    insert into dtd_client_normal.receipts(receipt_id,tenant_id,scope_id,enrolled_at) values(new.id,new.tenant_id,v_scope,v_now);
    insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,operario_id,receipt_ids)
      values(txid_current(),pg_backend_pid(),'intake',v_intake.actor_id,v_intake.operario_id,array[new.id])
      on conflict(transaction_id,backend_pid,operation) do update
        set receipt_ids=dtd_client_normal.contexts.receipt_ids||excluded.receipt_ids;
  end if;
  return new;
end $fn$;
create trigger zz_client_normal_enrol_receipt after insert on public.warehouse_receipts_cn
for each row execute function dtd_client_normal.enrol_receipt();

-- Every live legacy code writer participates BEFORE a reservation exists.
-- Own multi-code operations acquire sorted keys first. Arbitrary legacy bulk
-- DML can get 40P01/40001: retry the entire transaction, never a partial subset.
create function dtd_client_normal.guard_code() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_code text; v_reserved uuid;
begin
  if new.deleted_at is not null then return new; end if;
  v_code := upper(new.code); -- exact live matching semantics of 0326
  insert into dtd_client_normal.code_mutex(code,touched) values(v_code,1)
    on conflict(code) do update set touched = dtd_client_normal.code_mutex.touched + 1;
  select r.shipment_id into v_reserved from dtd_client_normal.code_reservations r where r.code = v_code;
  if v_reserved is not null and v_reserved <> new.id then perform dtd_client_normal.fail('NORMAL_CODE_UNAVAILABLE'); end if;
  return new;
end $fn$;
create trigger aa_client_normal_code before insert or update of code, deleted_at, tenant_id on public.shipments
for each row execute function dtd_client_normal.guard_code();

create function dtd_client_normal.guard_receipt() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_id uuid := old.id; v_member boolean;
  v_non_membership_fields text[] := array['notes','updated_at','payment_status','invoice_verified_at','invoice_verified_by'];
begin
  if not exists(select 1 from dtd_client_normal.receipts r where r.receipt_id=v_id) then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  if tg_op = 'DELETE' then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id or new.warehouse_id is distinct from old.warehouse_id then
    perform dtd_client_normal.fail('NORMAL_GOVERNED');
  end if;
  select exists(select 1 from dtd_client_normal.members m where m.receipt_id=v_id) into v_member;
  if v_member then
    if not dtd_client_normal.authorized_context('membership',null,null,v_id)
       and (to_jsonb(new) - v_non_membership_fields) is distinct from (to_jsonb(old) - v_non_membership_fields) then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
    -- Keep the existing CN payment/verification actions, which work in any
    -- receipt state. They do not call the legacy consolidation invoice hook.
    if (new.payment_status is distinct from old.payment_status or new.invoice_verified_at is distinct from old.invoice_verified_at
      or new.invoice_verified_by is distinct from old.invoice_verified_by)
      and not dtd_client_normal.module_allowed(old.tenant_id,'cn',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  elsif new.shipment_id is not null or new.status is distinct from old.status then perform dtd_client_normal.fail('NORMAL_GOVERNED');
  elsif not dtd_client_normal.authorized_context('intake',null,null,v_id)
    and not dtd_client_normal.authorized_context('receipt_edit',null,null,v_id) then
    if not dtd_client_normal.module_allowed(old.tenant_id,'cn',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    -- The row UPDATE already owns the receipt lock. Its AFTER sync/identity
    -- triggers run inside this narrow source context, before zz cleanup.
    insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,receipt_ids)
      values(txid_current(),pg_backend_pid(),'receipt_edit',auth.uid(),array[v_id])
      on conflict(transaction_id,backend_pid,operation) do update set receipt_ids=excluded.receipt_ids;
  end if;
  return new;
end $fn$;
create trigger aa_client_normal_receipt before update or delete on public.warehouse_receipts_cn
for each row execute function dtd_client_normal.guard_receipt();
create function dtd_client_normal.guard_member_box() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_old uuid; v_new uuid; v_id uuid;
begin
  if tg_op <> 'INSERT' then v_old := old.receipt_id; end if;
  if tg_op <> 'DELETE' then v_new := new.receipt_id; end if;
  for v_id in select distinct x from unnest(array[v_old,v_new]) x where x is not null order by x loop
    perform 1 from public.warehouse_receipts_cn where id=v_id for update;
    if not found and tg_op<>'DELETE' and v_id is not distinct from v_new then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  end loop;
  if exists(select 1 from dtd_client_normal.members m where m.receipt_id in (v_old,v_new)) then
    if tg_op <> 'UPDATE' or to_jsonb(new) is distinct from to_jsonb(old) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  end if;
  if v_old is not null and v_new is not null and v_old<>v_new
    and exists(select 1 from dtd_client_normal.receipts r where r.receipt_id in(v_old,v_new)) then
    perform dtd_client_normal.fail('NORMAL_GOVERNED');
  end if;
  for v_id in select r.receipt_id from dtd_client_normal.receipts r where r.receipt_id in(v_old,v_new) order by r.receipt_id loop
    -- No late box lock can manufacture authority. Legitimate editors acquire
    -- the parent receipt first; direct INSERT/retarget/delete cannot race form.
    if not dtd_client_normal.authorized_context('receipt_edit',null,null,v_id)
      and not dtd_client_normal.authorized_context('intake',null,null,v_id) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_member_box before insert or update or delete on public.warehouse_boxes
for each row execute function dtd_client_normal.guard_member_box();

create function dtd_client_normal.finish_receipt_edit() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid()
    and operation='receipt_edit' and new.id=any(receipt_ids);
  return new;
end $fn$;
create trigger zz_client_normal_finish_receipt_edit after update on public.warehouse_receipts_cn
for each row execute function dtd_client_normal.finish_receipt_edit();

create function dtd_client_normal.check_receipt_roster() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_ids uuid[]; v_id uuid; v_receipt public.warehouse_receipts_cn;
begin
  if tg_table_name='warehouse_receipts_cn' then v_ids:=array[new.id];
  elsif tg_op='INSERT' then v_ids:=array[new.receipt_id];
  elsif tg_op='DELETE' then v_ids:=array[old.receipt_id];
  else v_ids:=array[old.receipt_id,new.receipt_id]; end if;
  for v_id in select r.receipt_id from dtd_client_normal.receipts r where r.receipt_id=any(v_ids) loop
    select * into strict v_receipt from public.warehouse_receipts_cn where id=v_id;
    if v_receipt.deleted_at is not null or v_receipt.boxes is distinct from
      (select count(*)::integer from public.warehouse_boxes b where b.receipt_id=v_id and b.deleted_at is null)
      or exists(select 1 from public.warehouse_boxes b where b.receipt_id=v_id and b.deleted_at is null
        and (b.tenant_id<>v_receipt.tenant_id or b.status<>'recibida')) then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  end loop;
  return null;
end $fn$;

-- Checked source bodies are moved, not reimplemented or left as API escapes.
-- 0045 + 0449 keep their numbering, physical selection, items, and events.
-- 0072 also includes the qualified enum casts of 0296. ACL is restored from
-- the actual checked function contract, including the 0288 repair history.
create function dtd_client_normal.move_original(p_signature text,p_private_name text,p_expected_md5 text) returns void
language plpgsql set search_path = '' as $fn$
declare v_proc pg_catalog.pg_proc; v_body_md5 text;
begin
  select * into v_proc from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure(p_signature);
  if not found or not v_proc.prosecdef or pg_catalog.pg_get_userbyid(v_proc.proowner)<>'postgres'
    or pg_catalog.has_function_privilege('anon',v_proc.oid,'EXECUTE') then raise exception '0502: contrato de función inesperado: %',p_signature; end if;
  v_body_md5:=md5(replace(v_proc.prosrc,E'\r\n',E'\n'));
  if v_body_md5<>p_expected_md5 then raise exception '0502: cuerpo base distinto: %',p_signature; end if;
  insert into dtd_client_normal.function_contracts(signature,private_name,body_md5,owner_oid,acl,argument_names,argument_types,result_type,returns_set,default_count)
    values(p_signature,p_private_name,v_body_md5,v_proc.proowner,v_proc.proacl,v_proc.proargnames,v_proc.proargtypes,v_proc.prorettype,v_proc.proretset,v_proc.pronargdefaults);
  execute pg_catalog.format('alter function %s rename to %I',v_proc.oid::pg_catalog.regprocedure,p_private_name);
  execute pg_catalog.format('alter function public.%I(%s) set schema dtd_client_normal',p_private_name,pg_catalog.oidvectortypes(v_proc.proargtypes));
  execute pg_catalog.format('revoke all on function dtd_client_normal.%I(%s) from public,anon,authenticated,service_role',p_private_name,pg_catalog.oidvectortypes(v_proc.proargtypes));
end $fn$;
select dtd_client_normal.move_original('public.create_receipt_as_operario(uuid,uuid,boolean,text,text,text,text,text,text,integer,numeric,numeric,date,text,jsonb,boolean,text,text)',
  'legacy_create_receipt_as_operario','f9e61f3ae50fca3f4752d61fb1d20f86');
select dtd_client_normal.move_original('public.receive_prealerta_boxes_as_operario(uuid,text,text[])',
  'legacy_receive_prealerta_boxes_as_operario','bf85211ecef554d573b9670d6011af37');
select dtd_client_normal.move_original('public.operario_action(uuid,text,jsonb)',
  'legacy_operario_action','b0839c00d60dbeecf7e98c4c281f9fdc');

create function public.create_receipt_as_operario(
  p_operario_id uuid,p_warehouse_id uuid,p_is_orphan boolean,p_client_markbox text,p_client_name text,
  p_orphan_marks text,p_orphan_brought_by text,p_supplier_name text,p_supplier_translated text,p_boxes integer,
  p_total_cbm numeric,p_total_weight_kg numeric,p_received_at date,p_notes text,p_items jsonb,p_incident boolean,
  p_incident_note text,p_destination_city text default null
) returns table(receipt_id uuid,receipt_code text)
language plpgsql security definer set search_path = '' as $fn$
declare v_op public.operario_pins; v_enrol boolean;
begin
  select * into v_op from public.operario_pins where id=p_operario_id;
  select exists(select 1 from dtd_client_normal.scopes where tenant_id=v_op.tenant_id and warehouse_id=p_warehouse_id
    and enabled and starts_at<=clock_timestamp()) into v_enrol;
  if v_enrol then
    if not coalesce(v_op.active,false) or v_op.region<>'cn' then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    insert into dtd_client_normal.intakes(transaction_id,backend_pid,tenant_id,warehouse_id,operario_id)
      values(txid_current(),pg_backend_pid(),v_op.tenant_id,p_warehouse_id,p_operario_id);
  end if;
  return query select * from dtd_client_normal.legacy_create_receipt_as_operario(p_operario_id,p_warehouse_id,p_is_orphan,p_client_markbox,p_client_name,
    p_orphan_marks,p_orphan_brought_by,p_supplier_name,p_supplier_translated,p_boxes,p_total_cbm,p_total_weight_kg,p_received_at,p_notes,p_items,p_incident,p_incident_note,p_destination_city);
  if v_enrol then
    delete from dtd_client_normal.intakes where transaction_id=txid_current() and backend_pid=pg_backend_pid();
    delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='intake';
  end if;
end $fn$;
create function public.receive_prealerta_boxes_as_operario(p_operario_id uuid,p_code text,p_box_codes text[]) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_op public.operario_pins; v_enrol boolean; v_result jsonb;
begin
  select * into v_op from public.operario_pins where id=p_operario_id;
  select exists(select 1 from dtd_client_normal.scopes where tenant_id=v_op.tenant_id and warehouse_id=v_op.warehouse_id
    and enabled and starts_at<=clock_timestamp()) into v_enrol;
  if v_enrol then
    if not coalesce(v_op.active,false) or v_op.region<>'cn' or v_op.warehouse_id is null then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    insert into dtd_client_normal.intakes(transaction_id,backend_pid,tenant_id,warehouse_id,operario_id)
      values(txid_current(),pg_backend_pid(),v_op.tenant_id,v_op.warehouse_id,p_operario_id);
  end if;
  v_result:=dtd_client_normal.legacy_receive_prealerta_boxes_as_operario(p_operario_id,p_code,p_box_codes);
  if v_enrol then
    delete from dtd_client_normal.intakes where transaction_id=txid_current() and backend_pid=pg_backend_pid();
    delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='intake';
  end if;
  return v_result;
end $fn$;
create function public.operario_action(p_operario_id uuid,p_action_type text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_op public.operario_pins; v_receipt public.warehouse_receipts_cn; v_id uuid; v_result jsonb; v_cohort boolean:=false;
begin
  if p_action_type='edit_receipt' then
    v_id:=(p_payload->>'receipt_id')::uuid;
    v_cohort:=exists(select 1 from dtd_client_normal.receipts where receipt_id=v_id);
    if v_cohort then
      select * into v_op from public.operario_pins where id=p_operario_id;
      -- Parent receipt lock BEFORE the original sync/identity box writers.
      select * into v_receipt from public.warehouse_receipts_cn where id=v_id for update;
      if not coalesce(v_op.active,false) or v_op.region<>'cn' or v_op.tenant_id is distinct from v_receipt.tenant_id
        or v_receipt.deleted_at is not null or v_receipt.status::text<>'pendiente_consolidacion'
        or (v_receipt.created_by_operario_id is distinct from p_operario_id and not coalesce('supervisor'=any(v_op.roles),false))
        or exists(select 1 from dtd_client_normal.members where receipt_id=v_id) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
      insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,operario_id,receipt_ids)
        values(txid_current(),pg_backend_pid(),'receipt_edit',p_operario_id,array[v_id]);
    end if;
  end if;
  -- Every other branch and every legacy receipt keeps the checked original.
  v_result:=dtd_client_normal.legacy_operario_action(p_operario_id,p_action_type,p_payload);
  if v_cohort then delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='receipt_edit'; end if;
  return v_result;
end $fn$;
create constraint trigger client_normal_receipt_roster after insert or update on public.warehouse_receipts_cn
deferrable initially deferred for each row execute function dtd_client_normal.check_receipt_roster();
create constraint trigger client_normal_box_roster after insert or update or delete on public.warehouse_boxes
deferrable initially deferred for each row execute function dtd_client_normal.check_receipt_roster();

-- Conditional transport only: OFF returns without writes, preserving the legacy
-- action below it. A missing RPC is an unavailable prerequisite, never OFF.
create function public.client_consolidation_intake(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_warehouse uuid;
  v_receipt public.warehouse_receipts_cn; v_item jsonb; v_position integer:=0; v_now timestamptz;
begin
  if v_actor is null or not dtd_client_normal.module_allowed(v_tenant,'cn',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if jsonb_typeof(p_input) is distinct from 'object' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  v_warehouse:=(p_input->>'warehouse_id')::uuid;
  perform 1 from dtd_client_normal.scopes where tenant_id=v_tenant and warehouse_id=v_warehouse for share;
  if not exists(select 1 from dtd_client_normal.scopes where tenant_id=v_tenant and warehouse_id=v_warehouse
    and enabled and starts_at<=clock_timestamp()) then return jsonb_build_object('availability','off'); end if;
  if not exists(select 1 from public.warehouses_cn where id=v_warehouse and active)
    or coalesce((p_input->>'boxes')::integer,-1) not between 0 and 99999
    or coalesce((p_input->>'is_orphan')::boolean,false)=false
       and (nullif(btrim(p_input->>'client_markbox'),'') is null or nullif(btrim(p_input->>'supplier_name'),'') is null)
    or jsonb_typeof(p_input->'items') is distinct from 'array' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if jsonb_array_length(p_input->'items') not between 1 and 10
    or exists(select 1 from jsonb_array_elements(p_input->'items') i where jsonb_typeof(i)<>'object' or nullif(btrim(i->>'description'),'') is null)
    or (p_input->>'received_at') is null or (p_input->>'received_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  insert into dtd_client_normal.intakes(transaction_id,backend_pid,tenant_id,warehouse_id,actor_id)
    values(txid_current(),pg_backend_pid(),v_tenant,v_warehouse,v_actor);
  v_now:=clock_timestamp();
  -- No receipt_code and no numbering RPC: 0469 remains its sole allocator.
  insert into public.warehouse_receipts_cn(tenant_id,warehouse_id,client_markbox,client_name,is_orphan,
    orphan_marks,orphan_brought_by,orphan_suspected_client,supplier_name,supplier_name_translated,
    boxes,total_cbm,total_weight_kg,received_at,notes,status,created_at,updated_at)
    values(v_tenant,v_warehouse,case when (p_input->>'is_orphan')::boolean then null else p_input->>'client_markbox' end,
      case when (p_input->>'is_orphan')::boolean then null else p_input->>'client_name' end,(p_input->>'is_orphan')::boolean,
      p_input->>'orphan_marks',p_input->>'orphan_brought_by',p_input->>'orphan_suspected_client',p_input->>'supplier_name',p_input->>'supplier_name_translated',
      (p_input->>'boxes')::integer,(p_input->>'total_cbm')::numeric,(p_input->>'total_weight_kg')::numeric,
      (p_input->>'received_at')::date,p_input->>'notes','pendiente_consolidacion',v_now,v_now) returning * into v_receipt;
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    insert into public.warehouse_receipt_items(tenant_id,receipt_id,description,description_translated,hs_code,quantity,unit_value_usd,notes,position)
      values(v_tenant,v_receipt.id,btrim(v_item->>'description'),v_item->>'description_translated',v_item->>'hs_code',
        (v_item->>'quantity')::integer,(v_item->>'unit_value_usd')::numeric,v_item->>'notes',v_position);
    v_position:=v_position+1;
  end loop;
  insert into public.warehouse_receipt_events(tenant_id,receipt_id,event_type,description,occurred_at,created_by)
    values(v_tenant,v_receipt.id,'received','Recepción '||v_receipt.receipt_code||' registrada'||
      case when nullif(p_input->>'supplier_name','') is null then '' else ' · supplier: '||(p_input->>'supplier_name') end||
      ' · '||v_position::text||' item'||case when v_position=1 then '' else 's' end,v_now,v_actor);
  perform public.append_audit_event(v_tenant,'warehouse_receipt_cn',v_receipt.id,'user',v_actor,'warehouse_receipt_created',
    'rpc','succeeded','Alta de recepción CN',null,jsonb_build_object('receipt_id',v_receipt.id),
    jsonb_build_object('items',v_position,'prospective',true),null,1,'internal');
  delete from dtd_client_normal.intakes where transaction_id=txid_current() and backend_pid=pg_backend_pid();
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='intake';
  return jsonb_build_object('availability','ready','receiptId',v_receipt.id,'receiptCode',v_receipt.receipt_code);
end $fn$;

create function dtd_client_normal.bind_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_member record;
begin
  -- SAME order as 0496: receipt first, then snapshot. No group/container lock
  -- after receipt: fixed membership and the receipt lock serialize binding.
  perform 1 from public.warehouse_receipts_cn r where r.id=new.receipt_id for update;
  if not found and tg_op<>'DELETE' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if not exists(select 1 from dtd_client_normal.receipts r where r.receipt_id=new.receipt_id) then return new; end if;
  select m.*,g.shipment_id,g.client_id,g.service,g.destination into v_member
    from dtd_client_normal.members m join dtd_client_normal.groups g on g.id=m.group_id where m.receipt_id=new.receipt_id;
  if found and new.superseded_at is null then
    if new.tenant_id is distinct from v_member.tenant_id or new.client_id is distinct from v_member.client_id
       or new.service is distinct from v_member.service or new.destination is distinct from v_member.destination
       or new.cbm is distinct from v_member.cbm or new.weight_kg is distinct from v_member.weight_kg
       or (new.shipment_id is not null and new.shipment_id <> v_member.shipment_id) then
      perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
    end if;
    new.shipment_id := v_member.shipment_id;
  end if;
  return new;
end $fn$;
create trigger aa_client_normal_bind_snapshot before insert or update on public.shipment_rate_snapshots
for each row execute function dtd_client_normal.bind_snapshot();
create function dtd_client_normal.check_live_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_receipt uuid := new.receipt_id;
begin
  if exists(select 1 from dtd_client_normal.members m join dtd_client_normal.groups g on g.id=m.group_id
    join public.shipment_rate_snapshots s on s.receipt_id=m.receipt_id and s.superseded_at is null
    where m.receipt_id=v_receipt and (s.shipment_id is distinct from g.shipment_id or s.tenant_id is distinct from m.tenant_id
      or s.client_id is distinct from g.client_id or s.service is distinct from g.service or s.destination is distinct from g.destination
      or s.cbm is distinct from m.cbm or s.weight_kg is distinct from m.weight_kg)) then
    perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
  end if;
  return null;
end $fn$;
create constraint trigger client_normal_snapshot_complete after insert or update on public.shipment_rate_snapshots
deferrable initially deferred for each row execute function dtd_client_normal.check_live_snapshot();
create constraint trigger client_normal_member_snapshot_complete after insert on dtd_client_normal.members
deferrable initially deferred for each row execute function dtd_client_normal.check_live_snapshot();

create function dtd_client_normal.rates_json(p_group uuid, p_observed timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_group dtd_client_normal.groups; v_missing jsonb; v_ids jsonb; v_known numeric; v_count integer;
begin
  select * into strict v_group from dtd_client_normal.groups where id=p_group;
  if exists(select 1 from dtd_client_normal.members m join public.shipment_rate_snapshots s
    on s.receipt_id=m.receipt_id and s.superseded_at is null where m.group_id=p_group
    and (s.tenant_id is distinct from m.tenant_id or s.client_id is distinct from v_group.client_id
      or s.shipment_id is distinct from v_group.shipment_id or s.service is distinct from v_group.service
      or s.destination is distinct from v_group.destination or s.cbm is distinct from m.cbm
      or s.weight_kg is distinct from m.weight_kg or s.amount_to_invoice is null or s.amount_to_invoice < 0)) then
    perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
  end if;
  select count(*)::integer,
    coalesce(jsonb_agg(m.receipt_id order by m.receipt_id) filter(where s.id is null),'[]'::jsonb),
    coalesce(jsonb_agg(s.id order by s.id) filter(where s.id is not null),'[]'::jsonb),
    trunc(coalesce(sum(s.amount_to_invoice),0)*100)
    into v_count,v_missing,v_ids,v_known
    from dtd_client_normal.members m left join public.shipment_rate_snapshots s
      on s.receipt_id=m.receipt_id and s.superseded_at is null where m.group_id=p_group;
  return jsonb_build_object('membershipRevision',v_group.revision,'observedAt',p_observed,
    'snapshotIds',v_ids,'receiptCount',v_count,'missingReceiptIds',v_missing,
    'knownSubtotalCents',v_known::text,'totalCents',case when jsonb_array_length(v_missing)=0 then v_known::text else null end,'complete',true);
end $fn$;

create function dtd_client_normal.group_json(p_group uuid, p_names boolean, p_observed timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('groupId',g.id,'shipmentId',g.shipment_id,'itemId',g.item_id,
    'clientId',g.client_id,'clientMarkbox',g.client_markbox,'clientName',case when p_names then s.client_name else null end,
    'code',s.code,'service',g.service,'destination',g.destination,'revision',g.revision,'status',s.status,
    'receiptIds',coalesce((select jsonb_agg(m.receipt_id order by m.receipt_id) from dtd_client_normal.members m where m.group_id=g.id),'[]'::jsonb),
    'boxIds',coalesce((select jsonb_agg(b.box_id order by b.box_id) from dtd_client_normal.member_boxes b
      join dtd_client_normal.members m on m.receipt_id=b.receipt_id where m.group_id=g.id),'[]'::jsonb),
    'measures',(select jsonb_build_object('cbm',sum(m.cbm)::text,'weightKg',sum(m.weight_kg)::text,'boxes',sum(m.boxes))
      from dtd_client_normal.members m where m.group_id=g.id),
    'rates',dtd_client_normal.rates_json(g.id,p_observed))
    from dtd_client_normal.groups g join public.shipments s on s.id=g.shipment_id where g.id=p_group
$fn$;

-- No price or name belongs to the membership seal. Box IDs and fixed source
-- values distinguish an extended item even when its item count/ID is unchanged.
create function dtd_client_normal.seal_payload(p_container uuid) returns jsonb
language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('protocol',1,'containerId',c.container_id,'containerRevision',c.revision,
    'groups',coalesce((select jsonb_agg(jsonb_build_object('groupId',g.id,'shipmentId',g.shipment_id,
      'itemId',g.item_id,'clientId',g.client_id,'service',g.service,'destination',g.destination,'revision',g.revision,
      'members',coalesce((select jsonb_agg(jsonb_build_object('receiptId',m.receipt_id,'cbm',m.cbm,
        'weightKg',m.weight_kg,'boxes',m.boxes,'groupRevision',m.group_revision,
        'boxIds',(select jsonb_agg(b.box_id order by b.box_id) from dtd_client_normal.member_boxes b where b.receipt_id=m.receipt_id))
        order by m.receipt_id) from dtd_client_normal.members m where m.group_id=g.id),'[]'::jsonb)) order by g.id)
      from dtd_client_normal.groups g where g.container_id=c.container_id),'[]'::jsonb))
    from dtd_client_normal.containers c where c.container_id=p_container
$fn$;

create function dtd_client_normal.manifest_json(p_container uuid, p_group uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_meta dtd_client_normal.containers; v_expected jsonb; v_stowed jsonb;
  v_missing jsonb; v_unexpected jsonb; v_plan jsonb; v_now timestamptz := clock_timestamp();
begin
  select * into strict v_c from public.consolidations where id=p_container;
  select * into v_meta from dtd_client_normal.containers where container_id=p_container;
  select coalesce(jsonb_agg(b.box_id order by b.box_id),'[]'::jsonb) into v_expected
    from dtd_client_normal.member_boxes b join dtd_client_normal.members m on m.receipt_id=b.receipt_id
    join dtd_client_normal.groups g on g.id=m.group_id where g.container_id=p_container and (p_group is null or g.id=p_group);
  select coalesce(jsonb_agg(p.box_id order by p.box_id),'[]'::jsonb) into v_stowed
    from public.consolidation_box_positions p where p.consolidation_id=p_container and p.unstuffed_at is null
      and (p_group is null or v_expected @> jsonb_build_array(p.box_id));
  select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into v_missing from jsonb_array_elements(v_expected) x where not v_stowed @> jsonb_build_array(x);
  select coalesce(jsonb_agg(x order by x),'[]'::jsonb) into v_unexpected from jsonb_array_elements(v_stowed) x where not v_expected @> jsonb_build_array(x);
  select jsonb_build_object('id',p.id,'version',p.version_no,'manifestRevision',i.manifest_revision) into v_plan
    from public.consolidation_plans p join dtd_client_normal.plan_inputs i on i.plan_id=p.id
    where p.consolidation_id=p_container and p.is_current and p.deleted_at is null;
  return jsonb_build_object('containerId',p_container,'revision',coalesce(v_meta.revision,0),'status',v_c.status,
    'sealed',v_meta.seal_id is not null,'sealId',v_meta.seal_id,
    'canConfirm',dtd_client_normal.can_form(v_c.tenant_id),'canClose',dtd_client_normal.module_allowed(v_c.tenant_id,'naviera',true),
    'groups',coalesce((select jsonb_agg(dtd_client_normal.group_json(g.id,dtd_client_normal.can_see_names(g.tenant_id),v_now) order by g.created_at,g.id)
      from dtd_client_normal.groups g where g.container_id=p_container and (p_group is null or g.id=p_group)),'[]'::jsonb),
    'expectedBoxIds',v_expected,'stowedBoxIds',v_stowed,'missingBoxIds',v_missing,'unexpectedBoxIds',v_unexpected,'currentPlan',v_plan);
end $fn$;

create function dtd_client_normal.receipt_json(p_receipt uuid) returns jsonb
language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object('receiptId',r.id,'receiptCode',r.receipt_code,'warehouseId',r.warehouse_id,
    'clientId',dtd_client_normal.strict_client(r.tenant_id,r.client_markbox),'clientMarkbox',r.client_markbox,
    'clientName',case when dtd_client_normal.can_see_names(r.tenant_id) then r.client_name else null end,
    'service',case when s.service::text in ('consolidado_lcl','puerta_a_puerta_DDP') then s.service else null end,
    'destination',coalesce(s.destination,nullif(btrim(r.destination_city),'')),
    'measures',case when r.total_cbm>0 and r.total_weight_kg>=0 and r.boxes>0 then
      jsonb_build_object('cbm',r.total_cbm::text,'weightKg',r.total_weight_kg::text,'boxes',r.boxes) else null end,
    'sourceVersion',dtd_client_normal.receipt_version(r.id),'shipmentId',r.shipment_id,'groupId',m.group_id,
    'eligible',coalesce(m.receipt_id is null and r.shipment_id is null and r.status::text='pendiente_consolidacion'
      and not r.is_orphan and r.total_cbm>0 and r.total_weight_kg>=0 and r.boxes>0
      and dtd_client_normal.strict_client(r.tenant_id,r.client_markbox) is not null
      and r.boxes=(select count(*) from public.warehouse_boxes b where b.receipt_id=r.id and b.deleted_at is null and b.status='recibida')
      and not exists(select 1 from public.consolidation_box_positions p join public.warehouse_boxes b on b.id=p.box_id where b.receipt_id=r.id)
      and not exists(select 1 from public.dispatch_order_packages p where p.package_kind='warehouse_receipt_cn' and p.package_id=r.id)
      and (s.id is null or s.service::text in ('consolidado_lcl','puerta_a_puerta_DDP')),false),
    'blockedReason',case when m.receipt_id is not null then 'Recepción ya incorporada'
      when r.shipment_id is not null or r.status::text<>'pendiente_consolidacion' then 'Recepción fuera del camino normal'
      when r.is_orphan or dtd_client_normal.strict_client(r.tenant_id,r.client_markbox) is null then 'Falta un cliente identificable'
      when s.id is not null and s.service::text not in ('consolidado_lcl','puerta_a_puerta_DDP') then 'Servicio fuera del camino normal'
      when r.total_cbm is null or r.total_cbm<=0 or r.total_weight_kg is null or r.total_weight_kg<0 or r.boxes<=0 then 'Faltan medidas completas'
      when r.boxes<>(select count(*) from public.warehouse_boxes b where b.receipt_id=r.id and b.deleted_at is null and b.status='recibida') then 'Revisa las cajas recibidas'
      when exists(select 1 from public.consolidation_box_positions p join public.warehouse_boxes b on b.id=p.box_id where b.receipt_id=r.id)
        or exists(select 1 from public.dispatch_order_packages p where p.package_kind='warehouse_receipt_cn' and p.package_id=r.id) then 'Tiene operación física o asignación previa'
      else null end)
    from public.warehouse_receipts_cn r left join dtd_client_normal.members m on m.receipt_id=r.id
    left join public.shipment_rate_snapshots s on s.receipt_id=r.id and s.superseded_at is null
    where r.id=p_receipt and r.deleted_at is null
$fn$;

create function public.client_consolidation_scope(p_receipt_ids uuid[] default '{}',p_shipment_ids uuid[] default '{}',
  p_container_ids uuid[] default '{}',p_box_ids uuid[] default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_tenant uuid := public.get_user_tenant_id();
begin
  if v_tenant is null or not (dtd_client_normal.module_allowed(v_tenant,'cn',false)
    or dtd_client_normal.module_allowed(v_tenant,'naviera',false) or dtd_client_normal.module_allowed(v_tenant,'tracking',false)
    or dtd_client_normal.module_allowed(v_tenant,'ve',false)
    or dtd_client_normal.module_allowed(v_tenant,'cn',true) or dtd_client_normal.module_allowed(v_tenant,'naviera',true)
    or dtd_client_normal.module_allowed(v_tenant,'tracking',true) or dtd_client_normal.module_allowed(v_tenant,'ve',true)) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  return jsonb_build_object('available',true,
    'receiptIds',coalesce((select jsonb_agg(r.receipt_id order by r.receipt_id) from dtd_client_normal.receipts r
      where r.tenant_id=v_tenant and r.receipt_id=any(p_receipt_ids)),'[]'::jsonb),
    'shipmentIds',coalesce((select jsonb_agg(g.shipment_id order by g.shipment_id) from dtd_client_normal.groups g
      where g.tenant_id=v_tenant and g.shipment_id=any(p_shipment_ids)),'[]'::jsonb),
    'containerIds',coalesce((select jsonb_agg(c.container_id order by c.container_id) from dtd_client_normal.containers c
      where c.tenant_id=v_tenant and c.container_id=any(p_container_ids)),'[]'::jsonb),
    'boxIds',coalesce((select jsonb_agg(b.id order by b.id) from public.warehouse_boxes b
      join dtd_client_normal.receipts r on r.receipt_id=b.receipt_id where r.tenant_id=v_tenant and b.id=any(p_box_ids)),'[]'::jsonb));
end $fn$;

create function public.client_consolidation_read(p_container_id uuid,p_after_receipt_id uuid default null,p_page_size integer default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare v_tenant uuid := public.get_user_tenant_id(); v_manifest jsonb; v_receipts jsonb; v_destinations jsonb;
  v_token text; v_next uuid; v_last uuid; v_ready boolean;
begin
  if not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_page_size is null or p_page_size not between 1 and 500 then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if not exists(select 1 from public.consolidations c where c.id=p_container_id and c.tenant_id=v_tenant and c.deleted_at is null) then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN');
  end if;
  v_manifest := dtd_client_normal.manifest_json(p_container_id);
  select exists(select 1 from dtd_client_normal.receipts r where r.tenant_id=v_tenant)
    or exists(select 1 from dtd_client_normal.scopes s where s.tenant_id=v_tenant and s.enabled and s.starts_at<=clock_timestamp()) into v_ready;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.city||' · '||c.state_name||' · '||c.municipio,
    'destination',c.city) order by c.state_name,c.city,c.id),'[]'::jsonb)
    into v_destinations from public.dispatch_city_catalog c where c.tenant_id=v_tenant and c.active;
  -- Token covers the COMPLETE candidate/version set, catalogue and manifest;
  -- never a hash supplied by the browser or just the first page/item count.
  select md5(jsonb_build_array(dtd_client_normal.seal_payload(p_container_id),v_destinations,
    (select jsonb_build_array(c.status,c.deleted_at,c.container_type) from public.consolidations c where c.id=p_container_id),
    (select coalesce(jsonb_agg(jsonb_build_array(g.id,s.status,s.arrived_destination_at,s.delivered_at) order by g.id),'[]'::jsonb)
      from dtd_client_normal.groups g join public.shipments s on s.id=g.shipment_id where g.container_id=p_container_id),
    (select coalesce(jsonb_agg(jsonb_build_array(p.id,p.version_no,p.is_current,p.deleted_at) order by p.id),'[]'::jsonb)
      from public.consolidation_plans p where p.consolidation_id=p_container_id),
    (select coalesce(jsonb_agg(jsonb_build_array(p.id,p.box_id,p.stuffed_at,p.unstuffed_at,p.plan_id,p.siguio_plan) order by p.id),'[]'::jsonb)
      from public.consolidation_box_positions p where p.consolidation_id=p_container_id),
    dtd_client_normal.can_see_names(v_tenant),dtd_client_normal.can_form(v_tenant),dtd_client_normal.module_allowed(v_tenant,'naviera',true),
    coalesce(jsonb_agg(jsonb_build_array(r.receipt_id,dtd_client_normal.receipt_version(r.receipt_id)) order by r.receipt_id),'[]'::jsonb))::text)
    into v_token from dtd_client_normal.receipts r join public.warehouse_receipts_cn s on s.id=r.receipt_id
    where r.tenant_id=v_tenant and s.deleted_at is null;
  select coalesce(jsonb_agg(dtd_client_normal.receipt_json(q.receipt_id) order by q.receipt_id),'[]'::jsonb), max(q.receipt_id::text)::uuid
    into v_receipts,v_last from (select r.receipt_id from dtd_client_normal.receipts r
      join public.warehouse_receipts_cn s on s.id=r.receipt_id where r.tenant_id=v_tenant and s.deleted_at is null
      and (p_after_receipt_id is null or r.receipt_id>p_after_receipt_id) order by r.receipt_id limit p_page_size) q;
  if v_last is not null and exists(select 1 from dtd_client_normal.receipts r join public.warehouse_receipts_cn s on s.id=r.receipt_id
    where r.tenant_id=v_tenant and s.deleted_at is null and r.receipt_id>v_last) then v_next:=v_last; end if;
  return jsonb_build_object('availability',case when v_ready then 'ready' else 'off' end,'readToken',v_token,
    'observedAt',clock_timestamp(),'manifest',v_manifest,'destinations',v_destinations,'receipts',v_receipts,'nextReceiptId',v_next);
end $fn$;

create function public.client_consolidation_shipment(p_shipment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_tenant uuid := public.get_user_tenant_id(); v_group dtd_client_normal.groups;
begin
  if v_tenant is null or not (dtd_client_normal.module_allowed(v_tenant,'tracking',false)
    or dtd_client_normal.module_allowed(v_tenant,'ve',false)) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if not exists(select 1 from public.shipments s where s.id=p_shipment_id and s.tenant_id=v_tenant and s.deleted_at is null) then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN');
  end if;
  select * into v_group from dtd_client_normal.groups g where g.shipment_id=p_shipment_id and g.tenant_id=v_tenant;
  return jsonb_build_object('cohort',v_group.id is not null,'complete',true,
    'manifest',case when v_group.id is null then null else dtd_client_normal.manifest_json(v_group.container_id,v_group.id) end);
end $fn$;

create function public.client_consolidation_confirm(p_operation text,p_container_id uuid,p_expected_revision bigint,
  p_reference uuid,p_reason text,p_groups jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare
  v_tenant uuid := public.get_user_tenant_id(); v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason),''); v_groups jsonb; v_intent jsonb;
  v_existing dtd_client_normal.intentions; v_c public.consolidations; v_meta dtd_client_normal.containers;
  v_group record; v_selection jsonb; v_receipt record; v_snapshot record; v_client public.clients;
  v_group_id uuid; v_shipment uuid; v_item uuid; v_destination text; v_service public.shipment_service;
  v_receipts uuid[]; v_all_receipts uuid[]; v_scope uuid; v_scope_count integer;
  v_now timestamptz; v_revision bigint; v_cbm numeric; v_weight numeric; v_boxes bigint;
  v_new_code text; v_key text; v_result jsonb; v_result_groups jsonb := '[]'::jsonb;
begin
  if v_tenant is null or v_actor is null then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN');
  end if;
  if p_operation is null or p_operation not in ('form','extend') or p_reference is null
     or p_expected_revision is null or p_expected_revision<0 or v_reason is null
     or char_length(v_reason) not between 4 and 1000 or v_reason ~ '^[[:space:]]*$'
     or jsonb_typeof(p_groups) is distinct from 'array' or jsonb_array_length(p_groups)=0
     or (p_operation='extend' and jsonb_array_length(p_groups)<>1) then
    perform dtd_client_normal.fail('NORMAL_CONFLICT');
  end if;
  if exists(select 1 from jsonb_array_elements(p_groups) g where jsonb_typeof(g->'receipts') is distinct from 'array'
      or jsonb_array_length(g->'receipts')=0 or g->>'clientId' is null or g->>'destinationId' is null
      or g->>'service' not in ('consolidado_lcl','puerta_a_puerta_DDP') or g->>'service' is null
      or (p_operation='form' and (g->>'groupId' is not null or g->>'expectedGroupRevision' is not null))
      or (p_operation='extend' and (g->>'groupId' is null or g->>'expectedGroupRevision' is null or g->>'code' is not null))) then
    perform dtd_client_normal.fail('NORMAL_CONFLICT');
  end if;
  -- Structured intent uses only canonical fields; no browser hash/measure/actor.
  select jsonb_agg(jsonb_build_object('clientId',(g->>'clientId')::uuid,'service',g->>'service',
    'destinationId',(g->>'destinationId')::uuid,'code',case when p_operation='form' then upper(btrim(coalesce(g->>'code',''))) else null end,
    'groupId',(g->>'groupId')::uuid,'expectedGroupRevision',(g->>'expectedGroupRevision')::bigint,
    'receipts',(select jsonb_agg(jsonb_build_object('receiptId',(r->>'receiptId')::uuid,'sourceVersion',r->>'sourceVersion')
      order by (r->>'receiptId')::uuid) from jsonb_array_elements(g->'receipts') r)) order by (g->>'clientId')::uuid)
    into v_groups from jsonb_array_elements(p_groups) g;
  if (select count(*)<>count(distinct g->>'clientId') from jsonb_array_elements(v_groups) g)
     or (select count(*)<>count(distinct r->>'receiptId') from jsonb_array_elements(v_groups) g cross join jsonb_array_elements(g->'receipts') r)
     or exists(select 1 from jsonb_array_elements(v_groups) g cross join jsonb_array_elements(g->'receipts') r
       where r->>'receiptId' is null or r->>'sourceVersion' is null or r->>'sourceVersion' !~ '^[0-9a-f]{32}$') then
    perform dtd_client_normal.fail('NORMAL_CONFLICT');
  end if;
  if p_operation='form' then
    if exists(select 1 from jsonb_array_elements(v_groups) g where g->>'code' !~ '^S-[0-9]{4}-[0-9]{4,10}$') then
      perform dtd_client_normal.fail('NORMAL_INVALID_CODE');
    end if;
    if (select count(*)<>count(distinct g->>'code') from jsonb_array_elements(v_groups) g) then
      perform dtd_client_normal.fail('NORMAL_CODE_UNAVAILABLE');
    end if;
  end if;
  v_intent := jsonb_build_object('operation',p_operation,'containerId',p_container_id,
    'expectedContainerRevision',p_expected_revision,'groups',v_groups,'reason',v_reason);
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions i where i.tenant_id=v_tenant and i.reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_existing.actor_id<>v_actor or v_existing.operation<>p_operation or v_existing.intent<>v_intent
       or v_existing.intent_hash<>md5(v_intent::text) then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_existing.result,'{outcome}','"replay"'::jsonb);
  end if;
  if not dtd_client_normal.can_form(v_tenant) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  -- Intent -> container -> existing group/shipment -> sorted NEW receipts ->
  -- identity/physical source rows -> live snapshots. Clock is acquired later.
  select * into v_c from public.consolidations c where c.id=p_container_id and c.tenant_id=v_tenant and c.deleted_at is null for update;
  if not found then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if v_c.status<>'consolidando' or (v_c.requested_by_operario_id is not null and v_c.authorized_at is null) then
    perform dtd_client_normal.fail('NORMAL_CONFLICT');
  end if;
  select * into v_meta from dtd_client_normal.containers c where c.container_id=p_container_id for update;
  if found then
    if v_meta.seal_id is not null then perform dtd_client_normal.fail('NORMAL_SEALED'); end if;
    if v_meta.revision<>p_expected_revision then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  else
    if p_operation<>'form' or p_expected_revision<>0
      or exists(select 1 from public.consolidation_items i where i.consolidation_id=p_container_id)
      or exists(select 1 from public.consolidation_plans p where p.consolidation_id=p_container_id)
      or exists(select 1 from public.consolidation_box_positions p where p.consolidation_id=p_container_id) then
      perform dtd_client_normal.fail('NORMAL_CONFLICT');
    end if;
  end if;
  if p_operation='extend' then
    select g.id,g.shipment_id,g.item_id,g.client_id,g.service,g.destination_id,g.destination,g.revision,s.status
      into v_group from dtd_client_normal.groups g join public.shipments s on s.id=g.shipment_id
      where g.id=(v_groups->0->>'groupId')::uuid and g.container_id=p_container_id and g.tenant_id=v_tenant
        and s.tenant_id=v_tenant and s.deleted_at is null for update of g,s;
    if not found or v_group.status::text<>'consolidating' or v_group.revision<>(v_groups->0->>'expectedGroupRevision')::bigint
      or v_group.client_id<>(v_groups->0->>'clientId')::uuid or v_group.service::text<>v_groups->0->>'service'
      or v_group.destination_id<>(v_groups->0->>'destinationId')::uuid then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  end if;
  select array_agg((r->>'receiptId')::uuid order by (r->>'receiptId')::uuid) into v_all_receipts
    from jsonb_array_elements(v_groups) g cross join jsonb_array_elements(g->'receipts') r;
  perform 1 from public.warehouse_receipts_cn r where r.id=any(v_all_receipts) and r.tenant_id=v_tenant order by r.id for update;
  if (select count(*) from public.warehouse_receipts_cn r where r.id=any(v_all_receipts) and r.tenant_id=v_tenant)<>cardinality(v_all_receipts) then
    perform dtd_client_normal.fail('NORMAL_CONFLICT');
  end if;
  if exists(select 1 from unnest(v_all_receipts) id left join dtd_client_normal.receipts r on r.receipt_id=id and r.tenant_id=v_tenant
    where r.receipt_id is null) then perform dtd_client_normal.fail('NORMAL_OFF'); end if;
  select count(distinct r.scope_id), (array_agg(r.scope_id))[1] into v_scope_count,v_scope
    from dtd_client_normal.receipts r where r.receipt_id=any(v_all_receipts);
  if v_scope_count<>1 or (v_meta.container_id is not null and v_meta.scope_id<>v_scope) then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
  perform 1 from public.clients c where c.id in (select (g->>'clientId')::uuid from jsonb_array_elements(v_groups) g) order by c.id for share;
  perform 1 from public.dispatch_city_catalog c where c.id in (select (g->>'destinationId')::uuid from jsonb_array_elements(v_groups) g) order by c.id for share;
  perform 1 from public.warehouse_boxes b where b.receipt_id=any(v_all_receipts) order by b.id for update;
  perform 1 from public.shipment_rate_snapshots s where s.receipt_id=any(v_all_receipts) and s.superseded_at is null order by s.receipt_id,s.id for update;
  for v_selection in select g from jsonb_array_elements(v_groups) g loop
    select * into v_client from public.clients c where c.id=(v_selection->>'clientId')::uuid and c.tenant_id=v_tenant and c.deleted_at is null;
    if not found then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
    select c.city into v_destination from public.dispatch_city_catalog c where c.id=(v_selection->>'destinationId')::uuid and c.tenant_id=v_tenant and c.active;
    if not found or nullif(btrim(v_destination),'') is null then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
    v_service := (v_selection->>'service')::public.shipment_service;
    if p_operation='form' and exists(select 1 from dtd_client_normal.groups g
      where g.tenant_id=v_tenant and g.container_id=p_container_id and g.client_id=v_client.id) then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
    for v_receipt in select r.*,e.value->>'sourceVersion' as expected_version from jsonb_array_elements(v_selection->'receipts') e
      join public.warehouse_receipts_cn r on r.id=(e.value->>'receiptId')::uuid order by r.id loop
      if v_receipt.deleted_at is not null or v_receipt.is_orphan or v_receipt.shipment_id is not null
        or v_receipt.status::text<>'pendiente_consolidacion' or v_receipt.total_cbm is null or v_receipt.total_cbm<=0
        or v_receipt.total_weight_kg is null or v_receipt.total_weight_kg<0 or v_receipt.boxes<=0
        or dtd_client_normal.strict_client(v_tenant,v_receipt.client_markbox) is distinct from v_client.id
        or exists(select 1 from dtd_client_normal.members m where m.receipt_id=v_receipt.id)
        or dtd_client_normal.receipt_version(v_receipt.id) is distinct from v_receipt.expected_version
        or (nullif(btrim(v_receipt.destination_city),'') is not null and v_receipt.destination_city<>v_destination)
        or v_receipt.boxes<>(select count(*) from public.warehouse_boxes b where b.receipt_id=v_receipt.id and b.deleted_at is null)
        or exists(select 1 from public.warehouse_boxes b where b.receipt_id=v_receipt.id and b.deleted_at is null and (b.tenant_id<>v_tenant or b.status<>'recibida'))
        or exists(select 1 from public.consolidation_box_positions p join public.warehouse_boxes b on b.id=p.box_id where b.receipt_id=v_receipt.id)
        or exists(select 1 from public.dispatch_order_packages p where p.package_kind='warehouse_receipt_cn' and p.package_id=v_receipt.id) then
        perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
      end if;
      select * into v_snapshot from public.shipment_rate_snapshots s where s.receipt_id=v_receipt.id and s.superseded_at is null;
      if found and (v_snapshot.tenant_id<>v_tenant or v_snapshot.client_id<>v_client.id or v_snapshot.service<>v_service
        or v_snapshot.destination is distinct from v_destination or v_snapshot.cbm<>v_receipt.total_cbm
        or v_snapshot.weight_kg is distinct from v_receipt.total_weight_kg or v_snapshot.shipment_id is not null) then
        perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
      end if;
    end loop;
  end loop;
  if p_operation='form' then
    for v_key in select g->>'code' from jsonb_array_elements(v_groups) g order by g->>'code' loop
      insert into dtd_client_normal.code_mutex(code,touched) values(v_key,1)
        on conflict(code) do update set touched=dtd_client_normal.code_mutex.touched+1;
      if exists(select 1 from dtd_client_normal.code_reservations r where r.code=v_key)
        or exists(select 1 from public.shipments s where s.deleted_at is null and upper(s.code)=v_key) then
        perform dtd_client_normal.fail('NORMAL_CODE_UNAVAILABLE');
      end if;
    end loop;
  end if;
  v_now := clock_timestamp(); -- after contention and source locks, one event clock
  if v_meta.container_id is null then
    insert into dtd_client_normal.containers(container_id,tenant_id,scope_id,enrolled_at) values(p_container_id,v_tenant,v_scope,v_now);
  end if;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,receipt_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'membership',v_actor,p_container_id,v_all_receipts,v_now);
  for v_selection in select g from jsonb_array_elements(v_groups) g loop
    select array_agg((r->>'receiptId')::uuid order by (r->>'receiptId')::uuid) into v_receipts from jsonb_array_elements(v_selection->'receipts') r;
    select * into strict v_client from public.clients c where c.id=(v_selection->>'clientId')::uuid;
    select c.city into strict v_destination from public.dispatch_city_catalog c where c.id=(v_selection->>'destinationId')::uuid;
    v_service := (v_selection->>'service')::public.shipment_service;
    if p_operation='form' then
      v_group_id:=gen_random_uuid(); v_shipment:=gen_random_uuid(); v_item:=gen_random_uuid(); v_revision:=1; v_new_code:=v_selection->>'code';
      update dtd_client_normal.contexts set shipment_ids=array_append(shipment_ids,v_shipment)
        where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='membership';
      select sum(r.total_cbm),sum(r.total_weight_kg),sum(r.boxes) into v_cbm,v_weight,v_boxes from public.warehouse_receipts_cn r where r.id=any(v_receipts);
      insert into public.shipments(id,tenant_id,code,client_id,client_markbox,client_name,origin,destination,shipment_service,status,volume_m3,weight_kg,created_at,updated_at)
        values(v_shipment,v_tenant,v_new_code,v_client.id,v_client.markbox,v_client.name,'China',v_destination,v_service,'consolidating',v_cbm,v_weight,v_now,v_now);
      insert into dtd_client_normal.code_reservations(code,shipment_id,tenant_id,reserved_at) values(v_new_code,v_shipment,v_tenant,v_now);
      insert into public.consolidation_items(id,tenant_id,consolidation_id,shipment_id,client_markbox,client_name,cbm,weight_kg,pieces,created_at)
        values(v_item,v_tenant,p_container_id,v_shipment,v_client.markbox,v_client.name,v_cbm,v_weight,v_boxes,v_now);
      insert into dtd_client_normal.groups(id,tenant_id,container_id,client_id,shipment_id,item_id,client_markbox,service,destination_id,destination,revision,created_at)
        values(v_group_id,v_tenant,p_container_id,v_client.id,v_shipment,v_item,v_client.markbox,v_service,(v_selection->>'destinationId')::uuid,v_destination,1,v_now);
    else
      v_group_id:=v_group.id; v_shipment:=v_group.shipment_id; v_item:=v_group.item_id; v_revision:=v_group.revision+1;
      update dtd_client_normal.contexts set shipment_ids=array[v_shipment] where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='membership';
      update dtd_client_normal.groups set revision=v_revision where id=v_group_id;
    end if;
    insert into dtd_client_normal.members(receipt_id,tenant_id,group_id,cbm,weight_kg,boxes,group_revision,source_version,added_at,added_by)
      select r.id,v_tenant,v_group_id,r.total_cbm,r.total_weight_kg,r.boxes,v_revision,e.value->>'sourceVersion',v_now,v_actor
      from jsonb_array_elements(v_selection->'receipts') e join public.warehouse_receipts_cn r on r.id=(e.value->>'receiptId')::uuid;
    insert into dtd_client_normal.member_boxes(box_id,receipt_id,tenant_id,fixed_data)
      select b.id,b.receipt_id,v_tenant,to_jsonb(b)-array['client_name','created_at','updated_at'] from public.warehouse_boxes b
      where b.receipt_id=any(v_receipts) and b.deleted_at is null;
    update public.warehouse_receipts_cn set shipment_id=v_shipment,status='consolidado',destination_city=v_destination where id=any(v_receipts) and tenant_id=v_tenant;
    update public.shipment_rate_snapshots set shipment_id=v_shipment where receipt_id=any(v_receipts) and superseded_at is null and shipment_id is null;
    select sum(m.cbm),sum(m.weight_kg),sum(m.boxes) into v_cbm,v_weight,v_boxes from dtd_client_normal.members m where m.group_id=v_group_id;
    update public.shipments set volume_m3=v_cbm,weight_kg=v_weight where id=v_shipment;
    update public.consolidation_items set cbm=v_cbm,weight_kg=v_weight,pieces=v_boxes where id=v_item;
    insert into public.warehouse_receipt_events(tenant_id,receipt_id,event_type,description,occurred_at,created_by)
      select v_tenant,r,'consolidated','Incorporada al envío por cliente '||(select code from public.shipments where id=v_shipment),v_now,v_actor from unnest(v_receipts) r;
    insert into public.shipment_events(tenant_id,shipment_id,status,note,occurred_at,created_by)
      values(v_tenant,v_shipment,'consolidating',case when p_operation='form' then 'Envío por cliente confirmado' else 'Se agregaron recepciones nuevas al envío por cliente' end,v_now,v_actor);
    if p_operation='form' then
      insert into public.expense_alerts(tenant_id,shipment_id,created_at) values(v_tenant,v_shipment,v_now)
        on conflict(shipment_id) where resolved_at is null do nothing;
    end if;
    perform public.append_audit_event(v_tenant,'shipment',v_shipment,'user',v_actor,
      case when p_operation='form' then 'shipment_client_group_confirmed' else 'shipment_client_group_extended' end,
      'rpc','succeeded',v_reason,null,jsonb_build_object('membership_revision',v_revision),
      jsonb_build_object('container_id',p_container_id,'group_id',v_group_id,'receipt_ids',to_jsonb(v_receipts),'boxes',v_boxes),
      'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
    -- Durable historical results exclude names, even if the confirming actor can
    -- see them now. A later replay cannot resurrect a name after a region change.
    v_result_groups:=v_result_groups||jsonb_build_array(dtd_client_normal.group_json(v_group_id,false,v_now));
  end loop;
  update dtd_client_normal.containers set revision=revision+1 where container_id=p_container_id returning revision into v_revision;
  -- Also change the public parent tuple. Equivalent writers using a snapshot
  -- older than first enrolment must serialize/fail, never miss private metadata
  -- after waiting on a lock under REPEATABLE READ.
  update public.consolidations set updated_at=v_now where id=p_container_id;
  update public.consolidation_plans set is_current=false where consolidation_id=p_container_id and is_current and deleted_at is null;
  perform public.append_audit_event(v_tenant,'consolidation',p_container_id,'user',v_actor,'consolidation_membership_changed',
    'rpc','succeeded',v_reason,jsonb_build_object('revision',p_expected_revision),jsonb_build_object('revision',v_revision),
    jsonb_build_object('operation',p_operation,'receipt_ids',to_jsonb(v_all_receipts)),
    'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
  v_result:=jsonb_build_object('outcome','confirmed','operation',p_operation,'reference',p_reference,'occurredAt',v_now,
    'containerId',p_container_id,'containerRevision',v_revision,'groups',v_result_groups);
  insert into dtd_client_normal.intentions(tenant_id,reference,actor_id,operation,intent,intent_hash,result,occurred_at)
    values(v_tenant,p_reference,v_actor,p_operation,v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='membership';
  return v_result;
end $fn$;

create function dtd_client_normal.assert_identity(p_container uuid,p_require_seal boolean) returns void
language plpgsql stable security definer set search_path = '' as $fn$
declare v_meta dtd_client_normal.containers;
begin
  select * into v_meta from dtd_client_normal.containers where container_id=p_container;
  if not found then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if p_require_seal and (v_meta.seal_id is null or v_meta.seal is distinct from dtd_client_normal.seal_payload(p_container)) then
    perform dtd_client_normal.fail('NORMAL_SEALED');
  end if;
  if not exists(select 1 from dtd_client_normal.groups g where g.container_id=p_container)
    or exists(select 1 from dtd_client_normal.groups g
      join public.shipments s on s.id=g.shipment_id join public.consolidation_items i on i.id=g.item_id
      left join dtd_client_normal.code_reservations cr on cr.shipment_id=g.shipment_id
      where g.container_id=p_container and (g.tenant_id<>v_meta.tenant_id or s.tenant_id<>g.tenant_id
        or s.deleted_at is not null or s.client_id is distinct from g.client_id or s.client_markbox is distinct from g.client_markbox
        or s.shipment_service<>g.service or s.destination is distinct from g.destination
        or s.code is distinct from cr.code or s.code<>upper(btrim(s.code)) or s.code !~ '^S-[0-9]{4}-[0-9]{4,10}$'
        or i.tenant_id<>g.tenant_id or i.consolidation_id<>g.container_id or i.shipment_id is distinct from g.shipment_id
        or i.client_markbox is distinct from g.client_markbox
        or s.volume_m3 is distinct from (select sum(m.cbm) from dtd_client_normal.members m where m.group_id=g.id)
        or s.weight_kg is distinct from (select sum(m.weight_kg) from dtd_client_normal.members m where m.group_id=g.id)
        or i.cbm is distinct from s.volume_m3 or i.weight_kg is distinct from s.weight_kg
        or i.pieces is distinct from (select sum(m.boxes) from dtd_client_normal.members m where m.group_id=g.id)))
    or exists(select 1 from public.consolidation_items i where i.consolidation_id=p_container
      and not exists(select 1 from dtd_client_normal.groups g where g.item_id=i.id and g.container_id=p_container))
    or exists(select 1 from dtd_client_normal.members m join dtd_client_normal.groups g on g.id=m.group_id
      join public.warehouse_receipts_cn r on r.id=m.receipt_id join dtd_client_normal.receipts e on e.receipt_id=r.id
      where g.container_id=p_container and (m.tenant_id<>g.tenant_id or e.tenant_id<>g.tenant_id or e.scope_id<>v_meta.scope_id
        or r.tenant_id<>g.tenant_id or r.shipment_id is distinct from g.shipment_id or r.status::text<>'consolidado'
        or r.is_orphan or r.deleted_at is not null or r.total_cbm is distinct from m.cbm or r.total_weight_kg is distinct from m.weight_kg
        or r.boxes<>m.boxes or r.destination_city is distinct from g.destination
        or m.boxes<>(select count(*) from dtd_client_normal.member_boxes b where b.receipt_id=m.receipt_id)
        or m.boxes<>(select count(*) from public.warehouse_boxes b where b.receipt_id=m.receipt_id and b.deleted_at is null)))
    or exists(select 1 from dtd_client_normal.member_boxes b join dtd_client_normal.members m on m.receipt_id=b.receipt_id
      join dtd_client_normal.groups g on g.id=m.group_id join public.warehouse_boxes w on w.id=b.box_id
      where g.container_id=p_container and b.fixed_data is distinct from (to_jsonb(w)-array['client_name','created_at','updated_at'])) then
    perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE');
  end if;
end $fn$;

create function dtd_client_normal.guard_shipment() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_group dtd_client_normal.groups; v_context dtd_client_normal.contexts; v_allowed text[] := array['updated_at'];
begin
  select * into v_group from dtd_client_normal.groups g where g.shipment_id=old.id;
  if not found then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_op='DELETE' then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  select * into v_context from dtd_client_normal.contexts c where c.transaction_id=txid_current() and c.backend_pid=pg_backend_pid()
    and old.id=any(c.shipment_ids) and c.container_id=v_group.container_id
    and c.operation in ('membership','note','transit','release_ve','dispatch_ve','naviera','seniat','tms','manual_delivery','pod')
    order by c.operation limit 1;
  if found then
    if v_context.operation='membership' then v_allowed:=v_allowed||array['volume_m3','weight_kg'];
    elsif v_context.operation='note' then v_allowed:=v_allowed||array['notes'];
    elsif v_context.operation in ('transit','release_ve','dispatch_ve','naviera','seniat','tms','manual_delivery','pod') then
      perform dtd_client_normal.assert_identity(v_group.container_id,true);
      v_allowed:=v_allowed||array['status'];
      if v_context.operation in ('release_ve','seniat') and new.status::text='arrived_destination' and old.status::text='in_customs' then
        new.arrived_destination_at:=v_context.occurred_at; v_allowed:=v_allowed||array['arrived_destination_at'];
      elsif v_context.operation='dispatch_ve' and new.status::text='out_for_delivery' and old.status::text='arrived_destination' then
        v_allowed:=v_allowed||array['delivery_address'];
      elsif v_context.operation='transit' and new.status::text='in_transit' and old.status::text='shipped' then null;
      elsif v_context.operation='tms' and new.status::text='last_mile' and old.status::text='out_for_delivery' then null;
      elsif v_context.operation='naviera' and new.status::text in ('shipped','in_customs')
        and public.naviera_avance_decision(old.shipment_service::text,old.status::text,new.status::text)='avanza' then null;
      elsif v_context.operation in ('manual_delivery','pod') and new.status::text='delivered' and old.status::text in ('out_for_delivery','last_mile') then
        new.delivered_at:=v_context.occurred_at; v_allowed:=v_allowed||array['delivered_at','pod_signed_by'];
      else perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    end if;
  end if;
  if (to_jsonb(new)-v_allowed) is distinct from (to_jsonb(old)-v_allowed) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  return new;
end $fn$;
create trigger ab_client_normal_shipment before update or delete on public.shipments
for each row execute function dtd_client_normal.guard_shipment();

create function dtd_client_normal.guard_item() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_container uuid; v_shipment uuid;
begin
  if tg_op='INSERT' then v_container:=new.consolidation_id; v_shipment:=new.shipment_id;
  else v_container:=old.consolidation_id; v_shipment:=old.shipment_id; end if;
  perform 1 from public.consolidations c where c.id in(v_container,case when tg_op='UPDATE' then new.consolidation_id else null end) order by c.id for update;
  if not found and tg_op<>'DELETE' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if v_shipment is not null then
    perform 1 from public.shipments where id=v_shipment for update;
    if not found and tg_op<>'DELETE' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  end if;
  if exists(select 1 from dtd_client_normal.containers c where c.container_id=v_container)
    or exists(select 1 from dtd_client_normal.groups g where g.shipment_id=v_shipment)
    or (tg_op='UPDATE' and (exists(select 1 from dtd_client_normal.containers c where c.container_id=new.consolidation_id)
      or exists(select 1 from dtd_client_normal.groups g where g.shipment_id=new.shipment_id))) then
    if tg_op='DELETE' or not dtd_client_normal.authorized_context('membership',v_container,v_shipment) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    if tg_op='UPDATE' and (to_jsonb(new)-array['cbm','weight_kg','pieces']) is distinct from (to_jsonb(old)-array['cbm','weight_kg','pieces']) then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_item before insert or update or delete on public.consolidation_items
for each row execute function dtd_client_normal.guard_item();

create function dtd_client_normal.guard_event() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_shipment uuid; v_context dtd_client_normal.contexts;
begin
  if tg_op='INSERT' then v_shipment:=new.shipment_id; else v_shipment:=old.shipment_id; end if;
  perform 1 from public.shipments where id=v_shipment for update;
  if not found and tg_op<>'DELETE' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if exists(select 1 from dtd_client_normal.groups g where g.shipment_id=v_shipment)
    or (tg_op='UPDATE' and exists(select 1 from dtd_client_normal.groups g where g.shipment_id=new.shipment_id)) then
    if tg_op<>'INSERT' then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    select c.* into v_context from dtd_client_normal.contexts c join dtd_client_normal.groups g
      on g.container_id=c.container_id and g.shipment_id=v_shipment
      where c.transaction_id=txid_current() and c.backend_pid=pg_backend_pid() and v_shipment=any(c.shipment_ids)
        and c.operation in ('membership','note','transit','release_ve','dispatch_ve','naviera','seniat','tms','manual_delivery','pod')
      order by c.operation limit 1;
    if not found or new.deleted_at is not null or not exists(select 1 from public.shipments s
      where s.id=v_shipment and s.tenant_id=new.tenant_id and s.status=new.status) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    new.occurred_at:=v_context.occurred_at; new.created_by:=v_context.actor_id;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_event before insert or update or delete on public.shipment_events
for each row execute function dtd_client_normal.guard_event();

create function dtd_client_normal.guard_container() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  if exists(select 1 from dtd_client_normal.containers c where c.container_id=old.id) then
    if tg_op='DELETE' or new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
      or new.deleted_at is distinct from old.deleted_at then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    if new.status is distinct from old.status then
      if not (dtd_client_normal.authorized_context('close',old.id) and old.status='consolidando' and new.status='cerrado')
        and not (dtd_client_normal.authorized_context('naviera',old.id)
          and ((old.status='cerrado' and new.status='zarpado') or (old.status='zarpado' and new.status='arribado'))) then
        perform dtd_client_normal.fail('NORMAL_GOVERNED');
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_container before update or delete on public.consolidations
for each row execute function dtd_client_normal.guard_container();

create function public.client_consolidation_close(p_container_id uuid,p_expected_revision bigint,p_reference uuid,p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_reason text:=nullif(btrim(p_reason),'');
  v_intent jsonb; v_existing dtd_client_normal.intentions; v_meta dtd_client_normal.containers; v_c public.consolidations;
  v_manifest jsonb; v_now timestamptz; v_seal uuid; v_result jsonb;
begin
  if v_tenant is null or v_actor is null then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_expected_revision is null or p_expected_revision<1 or v_reason is null or char_length(v_reason) not between 4 and 1000 then
    perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_intent:=jsonb_build_object('operation','close','containerId',p_container_id,'expectedRevision',p_expected_revision,'reason',v_reason);
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_existing.actor_id<>v_actor or v_existing.operation<>'close' or v_existing.intent<>v_intent then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_existing.result,'{outcome}','"replay"'::jsonb);
  end if;
  if not dtd_client_normal.module_allowed(v_tenant,'naviera',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  select * into v_c from public.consolidations where id=p_container_id and tenant_id=v_tenant and deleted_at is null for update;
  if not found then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  select * into v_meta from dtd_client_normal.containers where container_id=p_container_id and tenant_id=v_tenant for update;
  if not found or v_meta.revision<>p_expected_revision or v_c.status<>'consolidando' then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if v_meta.seal_id is not null then perform dtd_client_normal.fail('NORMAL_SEALED'); end if;
  perform 1 from public.shipments s join dtd_client_normal.groups g on g.shipment_id=s.id where g.container_id=p_container_id order by s.id for update of s;
  perform dtd_client_normal.assert_identity(p_container_id,false);
  if exists(select 1 from dtd_client_normal.groups g join public.shipments s on s.id=g.shipment_id where g.container_id=p_container_id and s.status::text<>'consolidating') then
    perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_manifest:=dtd_client_normal.manifest_json(p_container_id);
  if jsonb_array_length(v_manifest->'expectedBoxIds')=0 or jsonb_array_length(v_manifest->'missingBoxIds')<>0
    or jsonb_array_length(v_manifest->'unexpectedBoxIds')<>0 then perform dtd_client_normal.fail('NORMAL_COVERAGE'); end if;
  v_now:=clock_timestamp(); v_seal:=gen_random_uuid();
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,occurred_at)
    values(txid_current(),pg_backend_pid(),'close',v_actor,p_container_id,v_now);
  update dtd_client_normal.containers set seal_id=v_seal,sealed_at=v_now,seal=dtd_client_normal.seal_payload(p_container_id) where container_id=p_container_id;
  update public.consolidations set status='cerrado' where id=p_container_id;
  perform public.append_audit_event(v_tenant,'consolidation',p_container_id,'user',v_actor,'consolidation_manifest_sealed',
    'rpc','succeeded',v_reason,jsonb_build_object('status','consolidando'),jsonb_build_object('status','cerrado','seal_id',v_seal),
    jsonb_build_object('membership_revision',v_meta.revision,'box_count',jsonb_array_length(v_manifest->'expectedBoxIds')),
    'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
  v_result:=jsonb_build_object('outcome','closed','reference',p_reference,'containerId',p_container_id,
    'containerRevision',v_meta.revision,'sealId',v_seal,'occurredAt',v_now);
  insert into dtd_client_normal.intentions values(v_tenant,p_reference,v_actor,'close',v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='close';
  return v_result;
end $fn$;

create function dtd_client_normal.lock_sealed_shipment(p_shipment uuid) returns dtd_client_normal.groups
language plpgsql volatile security definer set search_path = '' as $fn$
declare v_group dtd_client_normal.groups;
begin
  select * into v_group from dtd_client_normal.groups where shipment_id=p_shipment;
  if not found then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  perform 1 from public.consolidations c where c.id=v_group.container_id and c.tenant_id=v_group.tenant_id and c.deleted_at is null for update;
  if not found then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  perform 1 from dtd_client_normal.containers c where c.container_id=v_group.container_id for update;
  select * into strict v_group from dtd_client_normal.groups where id=v_group.id for update;
  perform 1 from public.shipments s where s.id=p_shipment and s.tenant_id=v_group.tenant_id and s.deleted_at is null for update;
  if not found then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  perform dtd_client_normal.assert_identity(v_group.container_id,true);
  return v_group;
end $fn$;

create function public.client_consolidation_transition(p_shipment_id uuid,p_operation text,p_expected_status text,
  p_expected_group_revision bigint,p_expected_container_revision bigint,p_reference uuid,p_reason text,
  p_delivery_address text default null,p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_module text;
  v_reason text:=nullif(btrim(p_reason),''); v_address text:=nullif(btrim(p_delivery_address),''); v_note text:=nullif(btrim(p_note),'');
  v_intent jsonb; v_existing dtd_client_normal.intentions; v_group dtd_client_normal.groups; v_meta dtd_client_normal.containers;
  v_from text; v_to text; v_event_note text; v_now timestamptz; v_result jsonb;
begin
  v_module:=case when p_operation='transit' then 'tracking' when p_operation in ('release_ve','dispatch_ve') then 've' else null end;
  if v_tenant is null or v_actor is null or v_module is null then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_expected_group_revision is null or p_expected_group_revision<1
    or p_expected_container_revision is null or p_expected_container_revision<1 or p_expected_status is null
    or v_reason is null or char_length(v_reason) not between 4 and 1000 or v_reason ~ '^[[:space:]]*$'
    or char_length(coalesce(v_address,''))>1000 or char_length(coalesce(v_note,''))>1000
    or (p_operation<>'dispatch_ve' and (v_address is not null or v_note is not null)) then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if not exists(select 1 from dtd_client_normal.groups g where g.shipment_id=p_shipment_id and g.tenant_id=v_tenant) then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  v_intent:=jsonb_build_object('operation',p_operation,'shipmentId',p_shipment_id,'expectedStatus',p_expected_status,
    'expectedGroupRevision',p_expected_group_revision,'expectedContainerRevision',p_expected_container_revision,
    'reason',v_reason,'deliveryAddressHash',dtd_client_normal.content_hash(v_address),'noteHash',dtd_client_normal.content_hash(v_note));
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,v_module,false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_existing.actor_id<>v_actor or v_existing.operation<>p_operation or v_existing.intent<>v_intent then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_existing.result,'{outcome}','"replay"'::jsonb);
  end if;
  if not dtd_client_normal.module_allowed(v_tenant,v_module,true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  v_group:=dtd_client_normal.lock_sealed_shipment(p_shipment_id);
  select * into strict v_meta from dtd_client_normal.containers where container_id=v_group.container_id;
  select s.status::text into strict v_from from public.shipments s where s.id=p_shipment_id;
  if v_group.revision<>p_expected_group_revision or v_meta.revision<>p_expected_container_revision or v_from<>p_expected_status then
    perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if p_operation='transit' and v_from='shipped' then
    v_to:='in_transit'; v_event_note:='Tránsito manual registrado';
  elsif p_operation='release_ve' and v_from='in_customs' then
    v_to:='arrived_destination'; v_event_note:='Liberación operativa de aduana · listo para retiro';
  elsif p_operation='dispatch_ve' and v_from='arrived_destination' then
    v_to:='out_for_delivery'; v_event_note:='Asignado para reparto';
  else perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  v_now:=clock_timestamp();
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),p_operation,v_actor,v_group.container_id,array[p_shipment_id],v_now);
  update public.shipments set status=v_to::public.shipment_status,
    delivery_address=case when p_operation='dispatch_ve' and v_address is not null then v_address else delivery_address end,
    arrived_destination_at=case when p_operation='release_ve' then v_now else arrived_destination_at end
    where id=p_shipment_id and tenant_id=v_tenant and status::text=p_expected_status;
  if not found then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  insert into public.shipment_events(tenant_id,shipment_id,status,note,occurred_at,created_by)
    values(v_tenant,p_shipment_id,v_to::public.shipment_status,v_event_note||case when v_note is null then '' else ' · '||v_note end,v_now,v_actor);
  perform public.append_audit_event(v_tenant,'shipment',p_shipment_id,'user',v_actor,'shipment_status_changed','rpc','succeeded',v_reason,
    jsonb_build_object('status',v_from),jsonb_build_object('status',v_to),
    jsonb_build_object('via',p_operation,'container_id',v_group.container_id,'group_revision',v_group.revision,'seal_id',v_meta.seal_id),
    'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
  v_result:=jsonb_build_object('outcome','transitioned','reference',p_reference,'shipmentId',p_shipment_id,
    'from',v_from,'to',v_to,'occurredAt',v_now,'groupRevision',v_group.revision,'containerRevision',v_meta.revision);
  insert into dtd_client_normal.intentions values(v_tenant,p_reference,v_actor,p_operation,v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation=p_operation;
  return v_result;
end $fn$;

-- Timeline notes record the current state; they cannot manufacture a milestone.
create function public.client_consolidation_note(p_shipment_id uuid,p_expected_status text,p_reference uuid,p_note text,p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_note text:=nullif(btrim(p_note),'');
  v_reason text:=nullif(btrim(p_reason),''); v_group dtd_client_normal.groups; v_intent jsonb; v_existing dtd_client_normal.intentions;
  v_status public.shipment_status; v_now timestamptz; v_result jsonb;
begin
  if v_tenant is null or v_actor is null then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_expected_status is null or v_note is null or char_length(v_note)>1000
    or v_reason is null or char_length(v_reason) not between 4 and 1000 then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if not exists(select 1 from dtd_client_normal.groups g where g.shipment_id=p_shipment_id and g.tenant_id=v_tenant) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  v_intent:=jsonb_build_object('operation','note','shipmentId',p_shipment_id,'expectedStatus',p_expected_status,
    'noteHash',dtd_client_normal.content_hash(v_note),'reason',v_reason);
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,'tracking',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_existing.actor_id<>v_actor or v_existing.operation<>'note' or v_existing.intent<>v_intent then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_existing.result,'{outcome}','"replay"'::jsonb);
  end if;
  if not dtd_client_normal.module_allowed(v_tenant,'tracking',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  select * into strict v_group from dtd_client_normal.groups where shipment_id=p_shipment_id;
  perform 1 from public.consolidations where id=v_group.container_id and tenant_id=v_tenant for update;
  select status into v_status from public.shipments where id=p_shipment_id and tenant_id=v_tenant and deleted_at is null for update;
  if not found or v_status::text<>p_expected_status then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_now:=clock_timestamp();
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'note',v_actor,v_group.container_id,array[p_shipment_id],v_now);
  insert into public.shipment_events(tenant_id,shipment_id,status,note,occurred_at,created_by) values(v_tenant,p_shipment_id,v_status,v_note,v_now,v_actor);
  perform public.append_audit_event(v_tenant,'shipment',p_shipment_id,'user',v_actor,'shipment_note_added','rpc','succeeded',v_reason,null,null,
    jsonb_build_object('status',v_status,'group_id',v_group.id),'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
  v_result:=jsonb_build_object('outcome','recorded','reference',p_reference,'shipmentId',p_shipment_id,'status',v_status,'occurredAt',v_now);
  insert into dtd_client_normal.intentions values(v_tenant,p_reference,v_actor,'note',v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='note';
  return v_result;
end $fn$;

create function dtd_client_normal.plan_input(p_container uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_meta dtd_client_normal.containers; v_type public.container_types;
  v_input jsonb; v_vector jsonb; v_previous integer; v_space jsonb;
begin
  select * into strict v_c from public.consolidations where id=p_container;
  select * into strict v_meta from dtd_client_normal.containers where container_id=p_container;
  perform dtd_client_normal.assert_identity(p_container,false);
  select * into v_type from public.container_types t where t.tenant_id=v_c.tenant_id and t.code=v_c.container_type;
  if not found or v_type.cbm_capacity<=0 or jsonb_typeof(v_type.zone_layout) is distinct from 'object'
    or coalesce((v_type.zone_layout->>'nx')::integer,0)<1 or coalesce((v_type.zone_layout->>'ny')::integer,0)<1
    or coalesce((v_type.zone_layout->>'nz')::integer,0)<1 then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.item_id,'markbox',q.client_markbox,
    'clientName',case when dtd_client_normal.can_see_names(q.tenant_id) then q.client_name else null end,
    'cajas',q.pieces,'cbm',q.cbm,'ordenDescarga',q.download_order,'manejoEspecial',null) order by q.created_at,q.id),'[]'::jsonb)
    into v_input from (select g.*,i.client_name,i.pieces,i.cbm,
      count(*) over()-row_number() over(order by g.created_at,g.id)+1 as download_order
      from dtd_client_normal.groups g join public.consolidation_items i on i.id=g.item_id where g.container_id=p_container) q;
  if jsonb_array_length(v_input)=0 then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  select coalesce(jsonb_object_agg(g.id::text,g.revision),'{}'::jsonb) into v_vector from dtd_client_normal.groups g where g.container_id=p_container;
  select coalesce(max(p.version_no),0) into v_previous from public.consolidation_plans p where p.consolidation_id=p_container;
  v_space:=jsonb_build_object('code',v_type.code,'label',v_type.label,'cbmCapacity',v_type.cbm_capacity,
    'cbmAlertCeiling',v_type.cbm_alert_ceiling,'layout',v_type.zone_layout);
  return jsonb_build_object('manifestRevision',v_meta.revision,'manifestHash',md5(dtd_client_normal.seal_payload(p_container)::text),
    'groupRevisions',v_vector,'previousPlanVersion',v_previous,'input',v_input,'space',v_space);
end $fn$;

create function public.client_consolidation_plan_input(p_container_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id();
begin
  if not dtd_client_normal.module_allowed(v_tenant,'naviera',false)
    or not exists(select 1 from dtd_client_normal.containers c where c.container_id=p_container_id and c.tenant_id=v_tenant) then
    perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  return dtd_client_normal.plan_input(p_container_id);
end $fn$;

create function dtd_client_normal.guard_plan() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_container uuid;
begin
  if tg_op='INSERT' then v_container:=new.consolidation_id; else v_container:=old.consolidation_id; end if;
  perform 1 from public.consolidations c where c.id in(v_container,case when tg_op='UPDATE' then new.consolidation_id else null end) order by c.id for update;
  if not found and tg_op<>'DELETE' then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  if exists(select 1 from dtd_client_normal.containers c where c.container_id=v_container)
    or (tg_op='UPDATE' and exists(select 1 from dtd_client_normal.containers c where c.container_id=new.consolidation_id)) then
    if tg_op='DELETE' then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    if tg_op='INSERT' then
      if not dtd_client_normal.authorized_context('plan',v_container) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    elsif not (dtd_client_normal.authorized_context('plan',v_container) or dtd_client_normal.authorized_context('membership',v_container))
      or not old.is_current or new.is_current or (to_jsonb(new)-'is_current') is distinct from (to_jsonb(old)-'is_current') then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_plan before insert or update or delete on public.consolidation_plans
for each row execute function dtd_client_normal.guard_plan();

create function public.client_consolidation_save_plan(p_container_id uuid,p_expected_revision bigint,p_manifest_hash text,
  p_previous_plan_version integer,p_input jsonb,p_space jsonb,p_result jsonb,p_reference uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_intent jsonb; v_existing dtd_client_normal.intentions;
  v_c public.consolidations; v_meta dtd_client_normal.containers; v_source jsonb; v_now timestamptz; v_plan uuid; v_version integer; v_result jsonb;
begin
  if v_tenant is null or v_actor is null then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_expected_revision is null or p_previous_plan_version is null or p_previous_plan_version<0
    or jsonb_typeof(p_input) is distinct from 'array' or jsonb_typeof(p_space) is distinct from 'object'
    or jsonb_typeof(p_result) is distinct from 'object' or jsonb_typeof(p_result->'pasos') is distinct from 'array'
    or jsonb_typeof(p_result->'sinUbicar') is distinct from 'array' then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_intent:=jsonb_build_object('operation','plan','containerId',p_container_id,'expectedRevision',p_expected_revision,
    'manifestHash',p_manifest_hash,'previousPlanVersion',p_previous_plan_version,
    'inputHash',md5(p_input::text),'space',p_space,'resultHash',md5(p_result::text));
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_existing.actor_id<>v_actor or v_existing.operation<>'plan' or v_existing.intent<>v_intent then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_existing.result,'{outcome}','"replay"'::jsonb);
  end if;
  if not dtd_client_normal.module_allowed(v_tenant,'naviera',true) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  select * into v_c from public.consolidations c where c.id=p_container_id and c.tenant_id=v_tenant and c.deleted_at is null for update;
  if not found or v_c.status<>'consolidando' then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  select * into v_meta from dtd_client_normal.containers c where c.container_id=p_container_id and c.tenant_id=v_tenant for update;
  if not found or v_meta.seal_id is not null or v_meta.revision<>p_expected_revision then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_source:=dtd_client_normal.plan_input(p_container_id);
  if v_source->>'manifestHash' is distinct from p_manifest_hash
    or (v_source->>'previousPlanVersion')::integer<>p_previous_plan_version
    or v_source->'input' is distinct from p_input or v_source->'space' is distinct from p_space
    or p_result->'espacio' is distinct from p_space then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  if exists(select 1 from jsonb_array_elements(p_result->'pasos') p
      where not exists(select 1 from jsonb_array_elements(p_input) i where i->>'id'=p->>'loteId')
      or coalesce((p->>'cajasUbicadas')::integer,0)<1 or coalesce((p->>'cbmUbicado')::numeric,0)<=0)
    or exists(select 1 from jsonb_array_elements(p_result->'sinUbicar') p
      where not exists(select 1 from jsonb_array_elements(p_input) i where i->>'id'=p->>'loteId')
      or coalesce((p->>'cajas')::integer,0)<1 or coalesce((p->>'cbm')::numeric,0)<=0)
    or exists(select 1 from jsonb_array_elements(p_input) i where (i->>'cajas')::integer is distinct from
      (select coalesce(sum(n),0) from (select (p->>'cajasUbicadas')::integer n from jsonb_array_elements(p_result->'pasos') p where p->>'loteId'=i->>'id'
        union all select (p->>'cajas')::integer n from jsonb_array_elements(p_result->'sinUbicar') p where p->>'loteId'=i->>'id') counts)) then
    perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
  v_now:=clock_timestamp(); v_plan:=gen_random_uuid(); v_version:=p_previous_plan_version+1;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,occurred_at)
    values(txid_current(),pg_backend_pid(),'plan',v_actor,p_container_id,v_now);
  update public.consolidation_plans set is_current=false where consolidation_id=p_container_id and is_current and deleted_at is null;
  insert into public.consolidation_plans(id,tenant_id,consolidation_id,version_no,is_current,container_type,cbm_capacity,zone_layout,input,result,algorithm_version,created_by,created_at)
    values(v_plan,v_tenant,p_container_id,v_version,true,p_space->>'code',(p_space->>'cbmCapacity')::numeric,p_space->'layout',p_input,p_result,'estiba-plan@1',v_actor,v_now);
  insert into dtd_client_normal.plan_inputs(plan_id,container_id,manifest_revision,manifest_hash,group_revisions,input_hash)
    values(v_plan,p_container_id,p_expected_revision,p_manifest_hash,v_source->'groupRevisions',md5(p_input::text));
  perform public.append_audit_event(v_tenant,'consolidation',p_container_id,'user',v_actor,'consolidation_plan_recorded','rpc','succeeded',null,null,
    jsonb_build_object('plan_id',v_plan,'plan_version',v_version),jsonb_build_object('membership_revision',p_expected_revision,'manifest_hash',p_manifest_hash),
    'client-normal:'||v_tenant::text||':'||p_reference::text,1,'internal');
  v_result:=jsonb_build_object('outcome','recorded','reference',p_reference,'planId',v_plan,'versionNo',v_version,'manifestRevision',p_expected_revision,'occurredAt',v_now);
  insert into dtd_client_normal.intentions values(v_tenant,p_reference,v_actor,'plan',v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='plan';
  return v_result;
end $fn$;

-- Physical writers lock container first even before enrolment; a concurrent
-- first formation cannot miss an INSERT from a legacy mobile request.
create function dtd_client_normal.lock_physical_container(p_operario uuid,p_container uuid) returns public.consolidations
language plpgsql security definer set search_path = '' as $fn$
declare v_op public.operario_pins; v_container public.consolidations;
begin
  select * into v_op from public.operario_pins where id=p_operario;
  if not coalesce(v_op.active,false) or v_op.region<>'cn' then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  select * into v_container from public.consolidations where id=p_container and tenant_id=v_op.tenant_id and deleted_at is null for update;
  if not found then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  return v_container;
end $fn$;
create function dtd_client_normal.prepare_physical(p_operario uuid,p_container uuid,p_boxes uuid[],p_operation text) returns boolean
language plpgsql security definer set search_path = '' as $fn$
declare v_container public.consolidations; v_meta dtd_client_normal.containers; v_cohort boolean;
begin
  v_container:=dtd_client_normal.lock_physical_container(p_operario,p_container);
  select * into v_meta from dtd_client_normal.containers where container_id=p_container;
  v_cohort:=v_meta.container_id is not null or exists(select 1 from public.warehouse_boxes b
    join dtd_client_normal.receipts r on r.receipt_id=b.receipt_id where b.id=any(p_boxes));
  if not v_cohort then return false; end if;
  if v_meta.container_id is null or v_container.status::text<>'consolidando' or v_meta.seal_id is not null
    or p_operation not in('stow','unstow') or coalesce(cardinality(p_boxes),0)=0 then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  perform dtd_client_normal.assert_identity(p_container,false);
  if cardinality(p_boxes)<>(select count(distinct x)::integer from unnest(p_boxes) x)
    or exists(select 1 from unnest(p_boxes) x left join public.warehouse_boxes b on b.id=x
      left join dtd_client_normal.member_boxes mb on mb.box_id=b.id
      left join dtd_client_normal.members m on m.receipt_id=mb.receipt_id
      left join dtd_client_normal.groups g on g.id=m.group_id
      where b.id is null or b.tenant_id<>v_container.tenant_id or b.deleted_at is not null or b.status<>'recibida'
        or g.container_id is distinct from p_container) then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
  -- Prealerta precedes boxes; all participants in one lot use the same lock.
  perform 1 from public.prealertas p where p.id in(select b.prealerta_id from public.warehouse_boxes b where b.id=any(p_boxes)) order by p.id for update;
  perform 1 from public.warehouse_boxes b where b.id=any(p_boxes) order by b.id for update;
  perform 1 from public.consolidation_box_positions p where p.box_id=any(p_boxes) order by p.id for update;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,operario_id,container_id,box_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),p_operation,p_operario,p_container,p_boxes,clock_timestamp());
  return true;
end $fn$;
create function dtd_client_normal.guard_position() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_container uuid; v_old_container uuid; v_box uuid; v_meta dtd_client_normal.containers; v_context dtd_client_normal.contexts;
  v_cohort boolean; v_c public.consolidations;
begin
  if tg_op='DELETE' then v_container:=old.consolidation_id; v_box:=old.box_id;
  else v_container:=new.consolidation_id; v_box:=new.box_id; end if;
  if tg_op='UPDATE' then v_old_container:=old.consolidation_id; end if;
  -- Wrappers already own this lock before any physical row. Equivalent raw
  -- DML participates too; it never acquires authority from a late trigger.
  perform 1 from public.consolidations c where c.id in(v_container,v_old_container) order by c.id for update;
  select * into v_meta from dtd_client_normal.containers where container_id=v_container;
  v_cohort:=v_meta.container_id is not null
    or exists(select 1 from dtd_client_normal.containers where container_id=v_old_container)
    or exists(select 1 from public.warehouse_boxes b join dtd_client_normal.receipts r on r.receipt_id=b.receipt_id
      where b.id in(v_box,case when tg_op='UPDATE' then old.box_id else null end));
  if not v_cohort then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_op='DELETE' or v_meta.container_id is null then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  select * into v_c from public.consolidations where id=v_container;
  if v_c.status::text<>'consolidando' or v_meta.seal_id is not null then perform dtd_client_normal.fail('NORMAL_SEALED'); end if;
  select * into v_context from dtd_client_normal.contexts c where c.transaction_id=txid_current() and c.backend_pid=pg_backend_pid()
    and c.container_id=v_container and v_box=any(c.box_ids) and c.operation in('stow','unstow','annotate');
  if not found or new.tenant_id is distinct from v_meta.tenant_id
    or not exists(select 1 from dtd_client_normal.member_boxes b join dtd_client_normal.members m on m.receipt_id=b.receipt_id
      join dtd_client_normal.groups g on g.id=m.group_id where b.box_id=v_box and g.container_id=v_container and b.tenant_id=new.tenant_id)
    then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  if tg_op='INSERT' then
    if v_context.operation<>'stow' or new.unstuffed_at is not null or new.plan_id is not null or new.siguio_plan is not null
      or new.stuffed_by_operario_id is distinct from v_context.operario_id then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    new.stuffed_at:=v_context.occurred_at; new.created_at:=v_context.occurred_at;
  elsif v_context.operation='unstow' then
    if old.unstuffed_at is not null or new.unstuffed_at is null or new.unstuffed_by_operario_id is distinct from v_context.operario_id
      or (to_jsonb(new)-array['unstuffed_at','unstuffed_by_operario_id','zone_code']) is distinct from
         (to_jsonb(old)-array['unstuffed_at','unstuffed_by_operario_id','zone_code']) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
    new.unstuffed_at:=v_context.occurred_at;
  elsif v_context.operation='annotate' then
    if old.unstuffed_at is not null or (to_jsonb(new)-array['plan_id','siguio_plan','zone_code']) is distinct from
      (to_jsonb(old)-array['plan_id','siguio_plan','zone_code']) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  else perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  return new;
end $fn$;
create trigger aa_client_normal_position before insert or update or delete on public.consolidation_box_positions
for each row execute function dtd_client_normal.guard_position();

select dtd_client_normal.move_original('public.stuff_box_as_operario(uuid,uuid,text,integer,integer,integer,boolean)',
  'legacy_stuff_box_as_operario','74c9486fd9b9b6a175f9bd521a61ba3a');
select dtd_client_normal.move_original('public.unstuff_box_as_operario(uuid,text)',
  'legacy_unstuff_box_as_operario','ccfe127d2b3ec1b3edd255728878c0c6');
select dtd_client_normal.move_original('public.stuff_lot_as_operario(uuid,uuid,text,integer,integer)',
  'legacy_stuff_lot_as_operario','77b5e161cc1c81a527fd03dc9693b6d0');
select dtd_client_normal.move_original('public.unstuff_lot_as_operario(uuid,uuid)',
  'legacy_unstuff_lot_as_operario','33554f0c1794aa185f7c2a2d3f9965f4');

create function public.stuff_box_as_operario(p_operario_id uuid,p_consolidation_id uuid,p_code text,p_zx integer,p_zy integer,p_zz integer,p_manual boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_box uuid; v_normal boolean; v_result jsonb;
begin
  v_c:=dtd_client_normal.lock_physical_container(p_operario_id,p_consolidation_id);
  select id into v_box from public.warehouse_boxes where tenant_id=v_c.tenant_id and code=nullif(btrim(p_code),'') and deleted_at is null;
  v_normal:=dtd_client_normal.prepare_physical(p_operario_id,p_consolidation_id,array[v_box],'stow');
  v_result:=dtd_client_normal.legacy_stuff_box_as_operario(p_operario_id,p_consolidation_id,p_code,p_zx,p_zy,p_zz,p_manual);
  if v_normal then
    delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='stow';
    v_result:=jsonb_set(v_result,'{client_name}','null'::jsonb);
  end if;
  return v_result;
end $fn$;
create function public.stuff_lot_as_operario(p_operario_id uuid,p_consolidation_id uuid,p_scanned_code text,p_width integer,p_count integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_box public.warehouse_boxes; v_ids uuid[]; v_lot_size integer; v_count integer;
  v_normal boolean; v_load integer; v_seq integer; v_now timestamptz; v_pre public.prealertas;
begin
  v_c:=dtd_client_normal.lock_physical_container(p_operario_id,p_consolidation_id);
  select * into v_box from public.warehouse_boxes where tenant_id=v_c.tenant_id and code=upper(btrim(p_scanned_code)) and deleted_at is null;
  if v_box.prealerta_id is not null then perform 1 from public.prealertas where id=v_box.prealerta_id for update; end if;
  select count(*)::integer into v_lot_size from public.warehouse_boxes b where b.tenant_id=v_c.tenant_id and b.prealerta_id=v_box.prealerta_id
    and b.status='recibida' and b.deleted_at is null and not exists(select 1 from public.consolidation_box_positions p where p.box_id=b.id and p.unstuffed_at is null);
  v_count:=least(greatest(coalesce(p_count,v_lot_size),1),v_lot_size);
  select array_agg(id order by id) into v_ids from(select b.id from public.warehouse_boxes b where b.tenant_id=v_c.tenant_id
    and b.prealerta_id=v_box.prealerta_id and b.status='recibida' and b.deleted_at is null
    and not exists(select 1 from public.consolidation_box_positions p where p.box_id=b.id and p.unstuffed_at is null)
    order by (b.id=v_box.id) desc,b.seq,b.id limit v_count) attempted;
  v_normal:=dtd_client_normal.prepare_physical(p_operario_id,p_consolidation_id,coalesce(v_ids,'{}'),'stow');
  if not v_normal then return dtd_client_normal.legacy_stuff_lot_as_operario(p_operario_id,p_consolidation_id,p_scanned_code,p_width,p_count); end if;
  if v_box.id is null or v_box.status<>'recibida' or v_box.prealerta_id is null or p_width is null or p_width not between 0 and 2
    or not v_box.id=any(v_ids) or exists(select 1 from public.consolidation_box_positions where box_id=v_box.id and unstuffed_at is null)
    then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
  select occurred_at into v_now from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='stow';
  select coalesce(max(load_order),-1)+1,coalesce(max(seq),0) into v_load,v_seq from public.consolidation_box_positions where consolidation_id=p_consolidation_id and unstuffed_at is null;
  insert into public.consolidation_box_positions(tenant_id,consolidation_id,box_id,zx,zy,zz,seq,load_order,width_pos,lot_prealerta_id,stuffed_by_operario_id,stuffed_manual)
    select v_c.tenant_id,p_consolidation_id,b.id,v_load,0,p_width,v_seq+row_number() over(order by (b.id=v_box.id) desc,b.seq,b.id),
      v_load,p_width,v_box.prealerta_id,p_operario_id,false from public.warehouse_boxes b where b.id=any(v_ids);
  perform public.append_audit_event(v_c.tenant_id,'consolidation',p_consolidation_id,'operario',p_operario_id,'lote_stuffed',
    'rpc','succeeded',null,null,jsonb_build_object('prealerta_id',v_box.prealerta_id,'load_order',v_load,'width',p_width,'stuffed',v_count),
    jsonb_build_object('box_ids',to_jsonb(v_ids),'membership_revision',(select revision from dtd_client_normal.containers where container_id=p_consolidation_id)),null,1,'internal');
  select * into v_pre from public.prealertas where id=v_box.prealerta_id;
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='stow';
  return jsonb_build_object('ok',true,'lot_size',v_lot_size,'stuffed',v_count,'remaining',v_lot_size-v_count,'load_order',v_load,
    'width',p_width,'prealerta_code',v_pre.code,'client_markbox',v_pre.client_markbox,'client_name',null,'scanned_code',v_box.code);
end $fn$;
create function public.unstuff_box_as_operario(p_operario_id uuid,p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_op public.operario_pins; v_box uuid; v_container uuid; v_normal boolean; v_result jsonb;
begin
  select * into v_op from public.operario_pins where id=p_operario_id;
  select id into v_box from public.warehouse_boxes where tenant_id=v_op.tenant_id and code=nullif(btrim(p_code),'') and deleted_at is null;
  select consolidation_id into v_container from public.consolidation_box_positions where box_id=v_box and unstuffed_at is null;
  if v_container is null then return dtd_client_normal.legacy_unstuff_box_as_operario(p_operario_id,p_code); end if;
  v_normal:=dtd_client_normal.prepare_physical(p_operario_id,v_container,array[v_box],'unstow');
  v_result:=dtd_client_normal.legacy_unstuff_box_as_operario(p_operario_id,p_code);
  if v_normal then delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='unstow'; end if;
  return v_result;
end $fn$;
create function public.unstuff_lot_as_operario(p_operario_id uuid,p_consolidation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_last integer; v_boxes uuid[]; v_normal boolean; v_result jsonb;
begin
  v_c:=dtd_client_normal.lock_physical_container(p_operario_id,p_consolidation_id);
  select max(load_order) into v_last from public.consolidation_box_positions where consolidation_id=p_consolidation_id and unstuffed_at is null;
  select array_agg(box_id order by box_id) into v_boxes from public.consolidation_box_positions where consolidation_id=p_consolidation_id and load_order=v_last and unstuffed_at is null;
  if v_boxes is null and exists(select 1 from dtd_client_normal.containers where container_id=p_consolidation_id) then perform dtd_client_normal.fail('NORMAL_COVERAGE'); end if;
  v_normal:=dtd_client_normal.prepare_physical(p_operario_id,p_consolidation_id,coalesce(v_boxes,'{}'),'unstow');
  v_result:=dtd_client_normal.legacy_unstuff_lot_as_operario(p_operario_id,p_consolidation_id);
  if v_normal then delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='unstow'; end if;
  return v_result;
end $fn$;

-- Trace is a separate best-effort command after the physical write. Its failure
-- must never repeat a successful stow. Historical positions retain old plans.
create function public.client_consolidation_annotate_plan(p_operario_id uuid,p_container_id uuid,p_load_order integer,
  p_plan_id uuid,p_expected_revision bigint,p_followed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_meta dtd_client_normal.containers; v_boxes uuid[];
begin
  v_c:=dtd_client_normal.lock_physical_container(p_operario_id,p_container_id);
  select * into v_meta from dtd_client_normal.containers where container_id=p_container_id;
  if not found or v_meta.revision is distinct from p_expected_revision or v_meta.seal_id is not null or v_c.status::text<>'consolidando'
    or not exists(select 1 from public.consolidation_plans p join dtd_client_normal.plan_inputs i on i.plan_id=p.id
      where p.id=p_plan_id and p.consolidation_id=p_container_id and p.is_current and p.deleted_at is null and i.manifest_revision=v_meta.revision)
    then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  select array_agg(box_id order by box_id) into v_boxes from public.consolidation_box_positions where consolidation_id=p_container_id
    and load_order=p_load_order and unstuffed_at is null and stuffed_by_operario_id=p_operario_id;
  if v_boxes is null then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,operario_id,container_id,box_ids)
    values(txid_current(),pg_backend_pid(),'annotate',p_operario_id,p_container_id,v_boxes);
  update public.consolidation_box_positions set plan_id=p_plan_id,siguio_plan=p_followed
    where consolidation_id=p_container_id and load_order=p_load_order and unstuffed_at is null and box_id=any(v_boxes);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='annotate';
  return jsonb_build_object('ok',true,'annotated',cardinality(v_boxes));
end $fn$;

-- Existing authorities and their replay/document/resource gates stay inside
-- the checked originals. Only a validated cohort context crosses its guards.
select dtd_client_normal.move_original('public.advance_consolidation_governed(uuid,text)',
  'legacy_advance_consolidation_governed','95d1f9971f13ea798173eca51ef962ef');
select dtd_client_normal.move_original('public.clear_customs_filing_governed(uuid,date,text,text)',
  'legacy_clear_customs_filing_governed','04d5cf691b31bfa0fc3976b6a143b46b');
select dtd_client_normal.move_original('public.complete_tms_route_governed(uuid,text,text)',
  'legacy_complete_tms_route_governed','8f72f0e10f86b079b2cb345289f02ee5');
select dtd_client_normal.move_original('public.complete_ve_delivery_governed(uuid,text,text,text)',
  'legacy_complete_ve_delivery_governed','651252cda7e8354058ecb83b8cc0e324');

create function public.advance_consolidation_governed(p_consolidation_id uuid,p_to text) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_c public.consolidations; v_ships uuid[]; v_result jsonb;
begin
  select c.* into v_c from public.consolidations c where c.id=p_consolidation_id and c.deleted_at is null
    and exists(select 1 from public.user_tenants u where u.user_id=auth.uid() and u.tenant_id=c.tenant_id and u.disabled_at is null) for update;
  if not found then return dtd_client_normal.legacy_advance_consolidation_governed(p_consolidation_id,p_to); end if;
  if not exists(select 1 from dtd_client_normal.containers where container_id=p_consolidation_id) then
    return dtd_client_normal.legacy_advance_consolidation_governed(p_consolidation_id,p_to); end if;
  if not public.naviera_avance_module_authorized(v_c.tenant_id,'naviera') or not public.naviera_avance_module_authorized(v_c.tenant_id,'tracking')
    then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  perform 1 from dtd_client_normal.groups where container_id=p_consolidation_id order by id for update;
  perform 1 from public.shipments s join dtd_client_normal.groups g on g.shipment_id=s.id where g.container_id=p_consolidation_id order by s.id for update of s;
  perform dtd_client_normal.assert_identity(p_consolidation_id,true);
  select array_agg(shipment_id order by shipment_id) into v_ships from dtd_client_normal.groups where container_id=p_consolidation_id;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'naviera',auth.uid(),p_consolidation_id,v_ships,clock_timestamp());
  -- 0477 still decides avanza/saltados/already, including in_transit->in_customs.
  v_result:=dtd_client_normal.legacy_advance_consolidation_governed(p_consolidation_id,p_to);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='naviera';
  return v_result;
end $fn$;
create function public.clear_customs_filing_governed(p_filing_id uuid,p_effective_date date,p_reason text,p_request_ref text) returns text
language plpgsql security definer set search_path = '' as $fn$
declare v_f public.customs_filings; v_group dtd_client_normal.groups; v_result text;
begin
  select f.* into v_f from public.customs_filings f where f.id=p_filing_id and f.deleted_at is null
    and exists(select 1 from public.user_tenants u where u.user_id=auth.uid() and u.tenant_id=f.tenant_id and u.disabled_at is null
      and u.role in('admin','operations','accounting')) for update;
  if not found or not exists(select 1 from dtd_client_normal.groups where shipment_id=v_f.shipment_id) then
    return dtd_client_normal.legacy_clear_customs_filing_governed(p_filing_id,p_effective_date,p_reason,p_request_ref); end if;
  perform pg_advisory_xact_lock(hashtextextended('customs-clearance:'||v_f.tenant_id::text||':'||btrim(p_request_ref),228));
  v_group:=dtd_client_normal.lock_sealed_shipment(v_f.shipment_id);
  -- Same six rows/locks as 0484 before the new event clock. The original still
  -- validates paid/date/readiness/replay and never delegates them to VE.
  perform 1 from public.customs_documents where tenant_id=v_f.tenant_id and filing_id=p_filing_id
    and doc_type::text in('commercial','packing','bl','cert_origin','dua','payment') order by id for update;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'seniat',auth.uid(),v_group.container_id,array[v_group.shipment_id],clock_timestamp());
  v_result:=dtd_client_normal.legacy_clear_customs_filing_governed(p_filing_id,p_effective_date,p_reason,p_request_ref);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='seniat';
  return v_result;
end $fn$;
create function public.complete_tms_route_governed(p_route_id uuid,p_reason text,p_request_ref text) returns text
language plpgsql security definer set search_path = '' as $fn$
declare v_route public.tms_routes; v_group dtd_client_normal.groups; v_result text;
begin
  select r.* into v_route from public.tms_routes r where r.id=p_route_id and r.deleted_at is null
    and exists(select 1 from public.user_tenants u where u.user_id=auth.uid() and u.tenant_id=r.tenant_id and u.disabled_at is null
      and u.role in('admin','operations','warehouse')) for update;
  if not found or not exists(select 1 from dtd_client_normal.groups where shipment_id=v_route.shipment_id) then
    return dtd_client_normal.legacy_complete_tms_route_governed(p_route_id,p_reason,p_request_ref); end if;
  perform pg_advisory_xact_lock(hashtextextended('tms-route-completion:'||v_route.tenant_id::text||':'||btrim(p_request_ref),230));
  v_group:=dtd_client_normal.lock_sealed_shipment(v_route.shipment_id);
  perform 1 from public.tms_trucks where id=v_route.truck_id and tenant_id=v_route.tenant_id for update;
  perform 1 from public.tms_drivers where id=v_route.driver_id and tenant_id=v_route.tenant_id for update;
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'tms',auth.uid(),v_group.container_id,array[v_group.shipment_id],clock_timestamp());
  v_result:=dtd_client_normal.legacy_complete_tms_route_governed(p_route_id,p_reason,p_request_ref);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='tms';
  return v_result;
end $fn$;
create function public.complete_ve_delivery_governed(p_shipment_id uuid,p_received_by text,p_reason text,p_request_ref text) returns text
language plpgsql security definer set search_path = '' as $fn$
begin
  -- The legacy signature cannot attest an unseen complete sealed group.
  if exists(select 1 from dtd_client_normal.groups where shipment_id=p_shipment_id) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  return dtd_client_normal.legacy_complete_ve_delivery_governed(p_shipment_id,p_received_by,p_reason,p_request_ref);
end $fn$;

create function public.client_consolidation_complete_delivery(p_shipment_id uuid,p_expected_status text,p_expected_group_revision bigint,
  p_expected_container_revision bigint,p_seal_id uuid,p_receipt_ids uuid[],p_received_by text,p_reason text,p_reference uuid,p_attest_complete boolean) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare v_tenant uuid:=public.get_user_tenant_id(); v_actor uuid:=auth.uid(); v_reason text:=nullif(btrim(p_reason),'');
  v_receiver text:=nullif(btrim(p_received_by),''); v_group dtd_client_normal.groups; v_meta dtd_client_normal.containers;
  v_intent jsonb; v_previous dtd_client_normal.intentions; v_receipts uuid[]; v_status text; v_now timestamptz; v_result jsonb; v_outcome text;
begin
  if v_tenant is null or v_actor is null then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_attest_complete is distinct from true or p_seal_id is null or p_expected_status not in('out_for_delivery','last_mile')
    or p_expected_group_revision is null or p_expected_container_revision is null or v_receiver is null or char_length(v_receiver) not between 2 and 200
    or v_reason is null or char_length(v_reason) not between 4 and 1000 or coalesce(cardinality(p_receipt_ids),0)=0
    or cardinality(p_receipt_ids)<>(select count(distinct x) from unnest(p_receipt_ids) x) then perform dtd_client_normal.fail('NORMAL_INCOMPLETE'); end if;
  select array_agg(x order by x) into v_receipts from unnest(p_receipt_ids) x;
  v_intent:=jsonb_build_object('operation','manual_delivery','shipmentId',p_shipment_id,'expectedStatus',p_expected_status,
    'groupRevision',p_expected_group_revision,'containerRevision',p_expected_container_revision,'sealId',p_seal_id,
    'receiptIds',v_receipts,'receiverHash',dtd_client_normal.content_hash(v_receiver),'reason',v_reason,'attestComplete',true);
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_previous from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
    if not dtd_client_normal.module_allowed(v_tenant,'ve',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
    if v_previous.actor_id<>v_actor or v_previous.operation<>'manual_delivery' or v_previous.intent<>v_intent then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
    return jsonb_set(v_previous.result,'{outcome}','"replay"'::jsonb);
  end if;
  -- 0487 actual roles and active tenant, independently of formation permissions.
  if not exists(select 1 from public.user_tenants where tenant_id=v_tenant and user_id=v_actor and disabled_at is null
    and role in('admin','operations','warehouse')) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  v_group:=dtd_client_normal.lock_sealed_shipment(p_shipment_id);
  select * into strict v_meta from dtd_client_normal.containers where container_id=v_group.container_id;
  select status::text into v_status from public.shipments where id=p_shipment_id and tenant_id=v_tenant;
  if v_group.tenant_id<>v_tenant or v_meta.revision<>p_expected_container_revision or v_group.revision<>p_expected_group_revision
    or v_meta.seal_id<>p_seal_id or v_status is distinct from p_expected_status or v_receipts is distinct from
      (select array_agg(receipt_id order by receipt_id) from dtd_client_normal.members where group_id=v_group.id) then perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  perform pg_advisory_xact_lock(hashtextextended('warehouse-ve-delivery:'||v_tenant::text||':'||p_reference::text,231));
  v_now:=clock_timestamp();
  insert into dtd_client_normal.contexts(transaction_id,backend_pid,operation,actor_id,container_id,shipment_ids,receipt_ids,occurred_at)
    values(txid_current(),pg_backend_pid(),'manual_delivery',v_actor,v_group.container_id,array[p_shipment_id],v_receipts,v_now);
  v_outcome:=dtd_client_normal.legacy_complete_ve_delivery_governed(p_shipment_id,v_receiver,v_reason,p_reference::text);
  if v_outcome<>'transitioned' then perform dtd_client_normal.fail('NORMAL_INTENT_CONFLICT'); end if;
  v_result:=jsonb_build_object('outcome','transitioned','reference',p_reference,'occurredAt',v_now,'shipmentId',p_shipment_id,
    'containerId',v_group.container_id,'containerRevision',v_meta.revision,'from',v_status,'to','delivered');
  insert into dtd_client_normal.intentions(tenant_id,reference,actor_id,operation,intent,intent_hash,result,occurred_at)
    values(v_tenant,p_reference,v_actor,'manual_delivery',v_intent,md5(v_intent::text),v_result,v_now);
  delete from dtd_client_normal.contexts where transaction_id=txid_current() and backend_pid=pg_backend_pid() and operation='manual_delivery';
  return v_result;
end $fn$;

-- Remaining complete POD, Portal and ACL/postflight composition follows.
-- API ACL/owner and postflight are finalized with that complete body.
commit;
