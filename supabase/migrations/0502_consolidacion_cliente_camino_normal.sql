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
    'public.client_users', 'public.calculator_cities', 'public.expense_alerts'
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
  destination_id uuid not null references public.calculator_cities(id) on delete restrict,
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
  shipment_ids uuid[] not null default '{}', receipt_ids uuid[] not null default '{}',
  primary key (transaction_id, backend_pid, operation)
);
comment on table dtd_client_normal.contexts is
  'Contexto interno del writer validado. Sin grants API, no GUC como autoridad. Se elimina al retornar; rollback atómico elimina la fila.';

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
declare v_scope uuid; v_now timestamptz := clock_timestamp();
begin
  select s.id into v_scope from dtd_client_normal.scopes s where s.tenant_id = new.tenant_id
    and s.warehouse_id = new.warehouse_id and s.enabled and s.starts_at <= v_now;
  if v_scope is not null then
    if new.shipment_id is not null or new.status::text <> 'pendiente_consolidacion' then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
    insert into dtd_client_normal.receipts(receipt_id,tenant_id,scope_id,enrolled_at) values(new.id,new.tenant_id,v_scope,v_now);
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
       and (to_jsonb(new) - array['notes','updated_at']) is distinct from (to_jsonb(old) - array['notes','updated_at']) then
      perform dtd_client_normal.fail('NORMAL_GOVERNED');
    end if;
  elsif new.shipment_id is not null or new.status::text = 'consolidado' then perform dtd_client_normal.fail('NORMAL_GOVERNED');
  end if;
  return new;
end $fn$;
create trigger aa_client_normal_receipt before update or delete on public.warehouse_receipts_cn
for each row execute function dtd_client_normal.guard_receipt();
create function dtd_client_normal.guard_member_box() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_old uuid; v_new uuid;
begin
  if tg_op <> 'INSERT' then v_old := old.receipt_id; end if;
  if tg_op <> 'DELETE' then v_new := new.receipt_id; end if;
  if exists(select 1 from dtd_client_normal.members m where m.receipt_id in (v_old,v_new)) then
    if tg_op <> 'UPDATE' or to_jsonb(new) is distinct from to_jsonb(old) then perform dtd_client_normal.fail('NORMAL_GOVERNED'); end if;
  end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end $fn$;
create trigger aa_client_normal_member_box before insert or update or delete on public.warehouse_boxes
for each row execute function dtd_client_normal.guard_member_box();

create function dtd_client_normal.bind_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare v_member record;
begin
  -- SAME order as 0496: receipt first, then snapshot. No group/container lock
  -- after receipt: fixed membership and the receipt lock serialize binding.
  if not exists(select 1 from dtd_client_normal.receipts r where r.receipt_id=new.receipt_id) then return new; end if;
  perform 1 from public.warehouse_receipts_cn r where r.id=new.receipt_id for update;
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
    or dtd_client_normal.module_allowed(v_tenant,'ve',false)) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
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
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label) order by c.sort_order,c.id),'[]'::jsonb)
    into v_destinations from public.calculator_cities c where c.tenant_id=v_tenant and c.deleted_at is null;
  -- Token covers the COMPLETE candidate/version set, catalogue and manifest;
  -- never a hash supplied by the browser or just the first page/item count.
  select md5(jsonb_build_array(dtd_client_normal.seal_payload(p_container_id),v_destinations,
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
  if v_tenant is null or v_actor is null or not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then
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
  perform 1 from public.calculator_cities c where c.id in (select (g->>'destinationId')::uuid from jsonb_array_elements(v_groups) g) order by c.id for share;
  perform 1 from public.warehouse_boxes b where b.receipt_id=any(v_all_receipts) order by b.id for update;
  perform 1 from public.shipment_rate_snapshots s where s.receipt_id=any(v_all_receipts) and s.superseded_at is null order by s.receipt_id,s.id for update;
  for v_selection in select g from jsonb_array_elements(v_groups) g loop
    select * into v_client from public.clients c where c.id=(v_selection->>'clientId')::uuid and c.tenant_id=v_tenant and c.deleted_at is null;
    if not found then perform dtd_client_normal.fail('NORMAL_INCOMPATIBLE'); end if;
    select c.label into v_destination from public.calculator_cities c where c.id=(v_selection->>'destinationId')::uuid and c.tenant_id=v_tenant and c.deleted_at is null;
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
    select c.label into strict v_destination from public.calculator_cities c where c.id=(v_selection->>'destinationId')::uuid;
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
  if v_tenant is null or v_actor is null or not dtd_client_normal.module_allowed(v_tenant,'naviera',false) then perform dtd_client_normal.fail('NORMAL_FORBIDDEN'); end if;
  if p_reference is null or p_expected_revision is null or p_expected_revision<1 or v_reason is null or char_length(v_reason) not between 4 and 1000 then
    perform dtd_client_normal.fail('NORMAL_CONFLICT'); end if;
  v_intent:=jsonb_build_object('operation','close','containerId',p_container_id,'expectedRevision',p_expected_revision,'reason',v_reason);
  perform pg_advisory_xact_lock(hashtextextended('client-normal-intent:'||v_tenant::text||':'||p_reference::text,0));
  select * into v_existing from dtd_client_normal.intentions where tenant_id=v_tenant and reference=p_reference;
  if found then
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

-- Remaining plan/state/physical writers and composition follow.
-- API ACL/owner and postflight are finalized with that complete body.
commit;
