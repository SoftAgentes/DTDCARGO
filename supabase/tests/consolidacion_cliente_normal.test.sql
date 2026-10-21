-- SDD-0578 · AUTHORED P1, NOT EXECUTED. Disposable PostgreSQL only.
-- The real0502 fuse intentionally aborts until Director grants the local GO
-- and its reviewed removal. Never strip the fuse in this runner/fixture.
-- No production, no backfill, no caller/flagPODv2 activation, no finance4.3.
\set ON_ERROR_STOP on
\ir _consolidacion_cliente_normal_schema.sql
\ir ../migrations/0502_consolidacion_cliente_camino_normal.sql
begin;
create schema sdd0578_fixture;
create table sdd0578_fixture.state(label text primary key,id uuid,value jsonb);
create sequence sdd0578_fixture.assertions;
create function sdd0578_fixture.id(p_label text) returns uuid language sql immutable as $$
  select md5('0578-owned-synthetic:'||p_label)::uuid
$$;
create function sdd0578_fixture.check(p_value boolean,p_message text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'SDD0578 assertion: %',p_message; end if;
  perform nextval('sdd0578_fixture.assertions');
end $$;
create function sdd0578_fixture.run_as(p_actor text,p_sql text,p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub',case when p_actor is null then '' else sdd0578_fixture.id(p_actor)::text end,true);
  execute format('set local role %I',p_role);
  execute p_sql into v_result;
  -- Exercise real deferred0496/roster invariants after the complete API command,
  -- never halfway through its membership transaction. Restore deferred mode
  -- for the next complete command; the outer fixture still rolls seed data back.
  set constraints all immediate;
  set constraints all deferred;
  reset role;
  return v_result;
exception when others then reset role; raise;
end $$;
-- Negative assertions execute a real command under the API role and ALWAYS
-- roll back its subtransaction, even if a mutated guard lets it succeed.
create function sdd0578_fixture.attempt(p_actor text,p_sql text,p_role text default 'authenticated')
returns jsonb language plpgsql as $$
declare v_message text; v_hint text;
begin
  begin
    perform sdd0578_fixture.run_as(p_actor,p_sql,p_role);
    raise exception using errcode='ZX578';
  exception when sqlstate 'ZX578' then return jsonb_build_object('state','OK');
  when others then
    get stacked diagnostics v_message=message_text,v_hint=pg_exception_hint;
    return jsonb_build_object('state',sqlstate,'message',v_message,'hint',v_hint);
  end;
end $$;
create function sdd0578_fixture.denied(p_sql text,p_code text,p_actor text default 'operations-A',p_role text default 'authenticated')
returns void language plpgsql as $$
declare v_result jsonb;
begin
  v_result:=sdd0578_fixture.attempt(p_actor,p_sql,p_role);
  perform sdd0578_fixture.check(v_result->>'message'=p_code and v_result->>'hint'='dtd-client-normal',p_code||' denied: '||v_result::text);
end $$;
create function sdd0578_fixture.receipt(p_label text,p_mark text default 'DTD-0001',p_boxes integer default 1,p_cbm numeric default 1)
returns uuid language plpgsql as $$
declare v_result jsonb; v_id uuid;
begin
  v_result:=sdd0578_fixture.run_as('operations-A',format('select public.client_consolidation_intake(%L::jsonb)',
    jsonb_build_object('warehouse_id',sdd0578_fixture.id('warehouse'),'client_markbox',p_mark,'client_name','Cliente sintético',
      'is_orphan',false,'supplier_name','Proveedor ficticio','boxes',p_boxes,'total_cbm',p_cbm,'total_weight_kg',p_boxes*100,
      'received_at','2026-10-21','items',jsonb_build_array(jsonb_build_object('description','Mercancía sintética','quantity',p_boxes)) )));
  perform sdd0578_fixture.check(v_result->>'availability'='ready' and v_result->>'receiptCode' like 'WR-%','atomic intake/0469');
  v_id:=(v_result->>'receiptId')::uuid;
  insert into sdd0578_fixture.state(label,id,value) values(p_label,v_id,v_result);
  -- Intake does not invent a destination. This fixture explicitly prepares the
  -- selected real catalogue city through the current editable-receipt guard,
  -- BEFORE any tariff freeze or membership fingerprint is observed.
  perform sdd0578_fixture.run_as('operations-A',format('with changed as(update public.warehouse_receipts_cn set destination_city=%L where id=%L::uuid returning id) select to_jsonb(count(*)) from changed',
    'Valencia',v_id));
  return v_id;
end $$;
create function sdd0578_fixture.selection(p_container text,p_client text,p_receipts text[],p_code text,p_extend boolean default false)
returns jsonb language plpgsql stable as $$
declare v_group dtd_client_normal.groups; v_receipts jsonb;
begin
  select * into v_group from dtd_client_normal.groups where container_id=sdd0578_fixture.id(p_container) and client_id=sdd0578_fixture.id(p_client);
  select jsonb_agg(jsonb_build_object('receiptId',s.id,'sourceVersion',dtd_client_normal.receipt_version(s.id)) order by s.id)
    into v_receipts from sdd0578_fixture.state s where s.label=any(p_receipts);
  return jsonb_build_object('clientId',sdd0578_fixture.id(p_client),'service','consolidado_lcl','destinationId',sdd0578_fixture.id('city'),
    'code',case when p_extend then null else p_code end,'groupId',case when p_extend then v_group.id end,
    'expectedGroupRevision',case when p_extend then v_group.revision end,'receipts',v_receipts);
end $$;
create function sdd0578_fixture.confirm_sql(p_container text,p_revision bigint,p_reference text,p_groups jsonb,p_operation text default 'form')
returns text language sql stable as $$
  select format('select public.client_consolidation_confirm(%L,%L::uuid,%L::bigint,%L::uuid,%L,%L::jsonb)',p_operation,
    sdd0578_fixture.id(p_container),p_revision,sdd0578_fixture.id(p_reference),'Carga sintética revisada',p_groups)
$$;
create function sdd0578_fixture.close_sql(p_container text,p_revision bigint,p_reference text) returns text language sql stable as $$
  select format('select public.client_consolidation_close(%L::uuid,%L::bigint,%L::uuid,%L)',sdd0578_fixture.id(p_container),p_revision,
    sdd0578_fixture.id(p_reference),'Cobertura física revisada')
$$;
create function sdd0578_fixture.freeze_sql(p_label text,p_per numeric default 100,p_service text default 'consolidado_lcl')
returns text language sql stable as $$
  select format('select to_jsonb(r) from public.congelar_tarifa_recepcion(%L::uuid,%L,null,null,%L::numeric,100::numeric,%L::public.shipment_service,500,%L,false) r',
    (select id from sdd0578_fixture.state where label=p_label),'manual',p_per,p_service,'Tarifa sintética autorizada')
$$;
create function sdd0578_fixture.stow_sql(p_container text,p_receipt text,p_revision bigint) returns text language sql stable as $$
  select format('select public.client_consolidation_physical(%L::uuid,%L::uuid,%L,%L::bigint,%L,null,null,%L::jsonb,false)',
    sdd0578_fixture.id('operario-cn'),sdd0578_fixture.id(p_container),'stow_box',p_revision,
    (select code from public.warehouse_boxes where receipt_id=(select id from sdd0578_fixture.state where label=p_receipt) and deleted_at is null order by seq limit 1),
    jsonb_build_object('zx',0,'zy',0,'zz',0))
$$;
create function sdd0578_fixture.transition_sql(p_shipment uuid,p_operation text,p_status text,p_group_revision bigint,p_revision bigint,p_reference text)
returns text language sql stable as $$
  select format('select public.client_consolidation_transition(%L::uuid,%L,%L,%L::bigint,%L::bigint,%L::uuid,%L)',p_shipment,p_operation,p_status,
    p_group_revision,p_revision,sdd0578_fixture.id(p_reference),'Hito operativo sintético')
$$;
-- Additional cases are isolated by literal labels in this disposable DB. These
-- helpers prepare synthetic parents only; every membership/physical/POD write
-- below still enters the real public API and its real guards.
create function sdd0578_fixture.new_container(p_label text) returns uuid language plpgsql as $$
declare v_id uuid:=sdd0578_fixture.id(p_label);
begin
  insert into public.consolidations(id,tenant_id,ref,container_type)
    values(v_id,sdd0578_fixture.id('tenant-A'),p_label,'S578');
  return v_id;
end $$;
create function sdd0578_fixture.operario_create_sql(p_operator text,p_warehouse uuid,p_boxes integer) returns text language sql stable as $$
  select format('select to_jsonb(r) from public.create_receipt_as_operario(%L::uuid,%L::uuid,false,%L,%L,null,null,%L,null,%L::integer,1,100,%L::date,null,%L::jsonb,false,null,%L) r',
    sdd0578_fixture.id(p_operator),p_warehouse,'DTD-0001','Cliente sintético','Proveedor sintético',p_boxes,'2026-10-21',
    '[{"description":"Mercancía sintética","quantity":1}]','Valencia')
$$;

-- Synthetic actors. No real accounts, credentials, addresses or media.
insert into public.tenants(id) values(sdd0578_fixture.id('tenant-A')),(sdd0578_fixture.id('tenant-B'));
insert into auth.users(id) select sdd0578_fixture.id(label) from unnest(array[
  'admin-A','operations-A','commercial-A','accounting-A','warehouse-A','support-A','operations-B','portal-A','hybrid-B','portal-unlinked']) label;
insert into public.user_tenants(user_id,tenant_id,role,region,warehouse_scope)
select sdd0578_fixture.id(label),sdd0578_fixture.id(tenant),role,region,scope from(values
  ('admin-A','tenant-A','admin',null,'all'),('operations-A','tenant-A','operations',null,'all'),
  ('commercial-A','tenant-A','commercial',null,'all'),('accounting-A','tenant-A','accounting',null,'all'),
  ('warehouse-A','tenant-A','warehouse','cn','cn'),('support-A','tenant-A','support',null,'all'),
  ('operations-B','tenant-B','operations',null,'all'),('hybrid-B','tenant-A','operations',null,'all')
) v(label,tenant,role,region,scope);
insert into public.clients(id,tenant_id,markbox,name) values
 (sdd0578_fixture.id('client-A'),sdd0578_fixture.id('tenant-A'),'DTD-0001','Cliente sintético A'),
 (sdd0578_fixture.id('client-A2'),sdd0578_fixture.id('tenant-A'),'DTD-0002','Cliente sintético A2'),
 (sdd0578_fixture.id('client-B'),sdd0578_fixture.id('tenant-B'),'DTD-0001','Cliente sintético B');
insert into public.client_users(auth_user_id,tenant_id,client_id,email,status) values
 (sdd0578_fixture.id('portal-A'),sdd0578_fixture.id('tenant-A'),sdd0578_fixture.id('client-A'),'portal-a@synthetic.invalid','active'),
 (sdd0578_fixture.id('hybrid-B'),sdd0578_fixture.id('tenant-A'),sdd0578_fixture.id('client-A2'),'hybrid-b@synthetic.invalid','active');
insert into public.warehouses_cn(id,code,hub_code,hub_name_es,hub_name_cn) values(sdd0578_fixture.id('warehouse'),'S578','S578','Hub sintético','合成');
insert into public.container_types(id,tenant_id,code,label,cbm_capacity,cbm_alert_ceiling,zone_layout)
values(sdd0578_fixture.id('type'),sdd0578_fixture.id('tenant-A'),'S578','Contenedor sintético',60,58,'{"nx":3,"ny":3,"nz":6}');
insert into public.dispatch_city_catalog(id,tenant_id,state_code,state_name,municipio,city)
values(sdd0578_fixture.id('city'),sdd0578_fixture.id('tenant-A'),'CAR','Carabobo','Valencia','Valencia');
insert into public.operario_pins(id,tenant_id,region,role,roles,warehouse_id,display_name) values
 (sdd0578_fixture.id('operario-cn'),sdd0578_fixture.id('tenant-A'),'cn','bodeguero',array['bodeguero'],sdd0578_fixture.id('warehouse'),'Operario sintético CN'),
 (sdd0578_fixture.id('operario-ve'),sdd0578_fixture.id('tenant-A'),'ve','supervisor',array['supervisor'],null,'Operario sintético VE');
insert into public.consolidations(id,tenant_id,ref,container_type)
select sdd0578_fixture.id(label),sdd0578_fixture.id('tenant-A'),label,'S578'
from unnest(array['normal','second','code-collision','race-form','race-code','race-extension','pod-multi','pod-last','pod-fragments','pod-rollback']) label;

-- Assert the actual install/defaults before the TEST ONLY nominal scope.
select sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.scopes),'rollout defaults OFF/empty, no backfill');
insert into dtd_client_normal.scopes(id,tenant_id,warehouse_id,enabled,starts_at)
values(sdd0578_fixture.id('scope'),sdd0578_fixture.id('tenant-A'),sdd0578_fixture.id('warehouse'),true,clock_timestamp());
select sdd0578_fixture.receipt('r1');
select sdd0578_fixture.receipt('r2');
select sdd0578_fixture.receipt('r3');
select sdd0578_fixture.receipt('foreign-client','DTD-0002');
select sdd0578_fixture.receipt('race-r1');
select sdd0578_fixture.receipt('race-r2');
select sdd0578_fixture.receipt('race-r3');
select sdd0578_fixture.receipt('race-r4');
select sdd0578_fixture.receipt('race-r5');
select sdd0578_fixture.receipt('race-r6');
-- These complete literal intentions are used unchanged by two-session runners.
insert into sdd0578_fixture.state(label,value) values
 ('race-form-sql',to_jsonb(sdd0578_fixture.confirm_sql('race-form',0,'race-form-ref',jsonb_build_array(sdd0578_fixture.selection('race-form','client-A',array['race-r1'],'S-2026-5001'))))),
 ('race-code-sql',to_jsonb(sdd0578_fixture.confirm_sql('race-code',0,'race-code-ref',jsonb_build_array(sdd0578_fixture.selection('race-code','client-A',array['race-r2'],'S-2026-5002')))));

create function sdd0578_fixture.ready(p_container text,p_clients text[],p_code_start integer,p_boxes integer default 1)
returns void language plpgsql as $$
declare v_client text; v_labels text[]; v_groups jsonb:='[]'; v_code integer:=p_code_start; v_box record; v_g record; i integer;
begin
  for i in 1..cardinality(p_clients) loop
    perform sdd0578_fixture.receipt(p_container||'-r'||i,(select markbox from public.clients where id=sdd0578_fixture.id(p_clients[i])),p_boxes);
  end loop;
  for v_client in select distinct unnest(p_clients) order by 1 loop
    select array_agg(p_container||'-r'||n order by n) into v_labels from generate_subscripts(p_clients,1) n where p_clients[n]=v_client;
    v_groups:=v_groups||jsonb_build_array(sdd0578_fixture.selection(p_container,v_client,v_labels,'S-2026-'||v_code)); v_code:=v_code+1;
  end loop;
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.confirm_sql(p_container,0,p_container||'-form',v_groups));
  for v_box in select b.code from public.warehouse_boxes b join sdd0578_fixture.state st on st.id=b.receipt_id
    where st.label like p_container||'-r%' and b.deleted_at is null order by b.id loop
    perform sdd0578_fixture.run_as(null,format('select public.client_consolidation_physical(%L::uuid,%L::uuid,%L,1,%L,null,null,%L::jsonb,false)',
      sdd0578_fixture.id('operario-cn'),sdd0578_fixture.id(p_container),'stow_box',v_box.code,'{"zx":0,"zy":0,"zz":0}'),'service_role');
  end loop;
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.close_sql(p_container,1,p_container||'-close'));
  perform sdd0578_fixture.run_as('operations-A',format('select to_jsonb(public.advance_consolidation_governed(%L::uuid,%L))',
    sdd0578_fixture.id(p_container),'zarpado'));
  perform sdd0578_fixture.run_as('operations-A',format('select to_jsonb(public.advance_consolidation_governed(%L::uuid,%L))',
    sdd0578_fixture.id(p_container),'arribado'));
  for v_g in select * from dtd_client_normal.groups where container_id=sdd0578_fixture.id(p_container) order by id loop
    perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.transition_sql(v_g.shipment_id,'release_ve','in_customs',1,1,p_container||'-release-'||v_g.id));
    perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.transition_sql(v_g.shipment_id,'dispatch_ve','arrived_destination',1,1,p_container||'-dispatch-'||v_g.id));
  end loop;
end $$;
create function sdd0578_fixture.od(p_label text,p_receipts text[]) returns uuid language plpgsql as $$
declare v_od uuid:=sdd0578_fixture.id(p_label);
begin
  insert into public.dispatch_orders(id,tenant_id,order_code,status,hub) values(v_od,sdd0578_fixture.id('tenant-A'),'OD-'||p_label,'en_ruta','valencia');
  insert into public.dispatch_order_packages(od_id,package_kind,package_id,markbox,client_name,city,pay,boxes_total,boxes_shipped,weight_kg,cbm)
    select v_od,'warehouse_receipt_cn',r.id,r.client_markbox,'Cliente sintético','Valencia','pendiente',r.boxes,r.boxes,r.total_weight_kg,r.total_cbm
    from public.warehouse_receipts_cn r join sdd0578_fixture.state st on st.id=r.id where st.label=any(p_receipts);
  insert into storage.objects(bucket_id,name,metadata) values
    ('receipt-photos','synthetic/'||p_label||'.jpg','{"eTag":"fictitious-photo","size":100}'),
    ('receipt-photos','synthetic/'||p_label||'.png','{"eTag":"fictitious-signature","size":80}');
  return v_od;
end $$;
create function sdd0578_fixture.mark(p_od uuid,p_receipt uuid,p_status text default 'entregado') returns void language plpgsql as $$
begin
  perform sdd0578_fixture.run_as(null,format('select public.operario_action(%L::uuid,%L,%L::jsonb)',sdd0578_fixture.id('operario-ve'),
    'partial_delivery',jsonb_build_object('od_id',p_od,'package_id',p_receipt,'status',p_status,'reason','Motivo sintético')),'service_role');
end $$;
create function sdd0578_fixture.pod_sql(p_od text,p_reference text) returns text language sql stable as $$
  select format('select public.camionero_pod_v2(%L::uuid,%L::uuid,null,%L,%L,%L,null,null,%L,null,null,null,%L)',
    sdd0578_fixture.id('operario-ve'),sdd0578_fixture.id(p_od),'synthetic/'||p_od||'.jpg','synthetic/'||p_od||'.png','Receptor sintético',p_reference,'off')
$$;
select sdd0578_fixture.ready('pod-multi',array['client-A','client-A2'],6001);
select sdd0578_fixture.ready('pod-last',array['client-A','client-A'],6101);
select sdd0578_fixture.ready('pod-fragments',array['client-A'],6201,2);
select sdd0578_fixture.ready('pod-rollback',array['client-A','client-A2'],6301);
select sdd0578_fixture.od('od-multi',array['pod-multi-r1','pod-multi-r2']);
select sdd0578_fixture.od('od-last1',array['pod-last-r1']);
select sdd0578_fixture.od('od-last2',array['pod-last-r2']);
select sdd0578_fixture.od('od-fragments',array['pod-fragments-r1']);
select sdd0578_fixture.od('od-rollback',array['pod-rollback-r1','pod-rollback-r2']);
select sdd0578_fixture.mark(p.od_id,p.package_id) from public.dispatch_order_packages p where p.od_id in
 (sdd0578_fixture.id('od-multi'),sdd0578_fixture.id('od-last1'),sdd0578_fixture.id('od-last2'),sdd0578_fixture.id('od-rollback'));

-- A database persistence vector, deliberately labelled as such: all unplaced
-- does NOT certify the TS estiba-plan@1 algorithm or a usable visual plan.
create function sdd0578_fixture.plan_sql(p_container text,p_reference text) returns text language plpgsql as $$
declare v_input jsonb; v_result jsonb;
begin
  v_input:=sdd0578_fixture.run_as('operations-A',format('select public.client_consolidation_plan_input(%L::uuid)',sdd0578_fixture.id(p_container)));
  select jsonb_build_object('espacio',v_input->'space','pasos','[]'::jsonb,'sinUbicar',jsonb_agg(jsonb_build_object(
    'loteId',i->>'id','cajas',i->'cajas','cbm',i->'cbm','motivo','Vector de persistencia SQL'))) into v_result from jsonb_array_elements(v_input->'input') i;
  return format('select public.client_consolidation_save_plan(%L::uuid,%L::bigint,%L,%L::integer,%L::jsonb,%L::jsonb,%L::jsonb,%L::uuid)',
    sdd0578_fixture.id(p_container),v_input->>'manifestRevision',v_input->>'manifestHash',v_input->>'previousPlanVersion',
    v_input->'input',v_input->'space',v_result,sdd0578_fixture.id(p_reference));
end $$;

-- One real prealerta, first receipt owns boxes1+3 and the later receipt box2.
-- A lot scanned at box1/count2 MUST NOT silently intersect with membership and
-- select boxes1+3. Actual0244 allocates codes; actual0449 receives exact IDs.
create function sdd0578_fixture.lot_sql(p_container text,p_revision bigint,p_box_label text,p_count integer) returns text language sql stable as $$
  select format('select public.client_consolidation_physical(%L::uuid,%L::uuid,%L,%L::bigint,%L,0,%L::integer,null,false)',
    sdd0578_fixture.id('operario-cn'),sdd0578_fixture.id(p_container),'stow_lot',p_revision,
    (select value#>>'{}' from sdd0578_fixture.state where label=p_box_label),p_count)
$$;
create function sdd0578_fixture.mixed_lot(p_container text,p_code integer) returns void language plpgsql as $$
declare v_pre uuid:=sdd0578_fixture.id(p_container||'-pre'); v_codes text[]; v_result jsonb; v_r uuid;
begin
  perform sdd0578_fixture.new_container(p_container);
  insert into public.prealertas(id,tenant_id,code,client_markbox,boxes)
    values(v_pre,sdd0578_fixture.id('tenant-A'),'CMP-S578-'||p_container,'DTD-0001',3);
  select array_agg(code order by seq) into v_codes from public.warehouse_boxes where prealerta_id=v_pre and deleted_at is null;
  perform sdd0578_fixture.check(cardinality(v_codes)=3,'actual0244 allocates exactly three expected box codes');
  v_result:=sdd0578_fixture.run_as(null,format('select public.receive_prealerta_boxes_as_operario(%L::uuid,%L,%L::text[])',
    sdd0578_fixture.id('operario-cn'),v_codes[1],array[v_codes[1],v_codes[3]]),'service_role');
  v_r:=(v_result->>'receipt_id')::uuid;
  insert into sdd0578_fixture.state(label,id,value) values(p_container||'-r1',v_r,v_result);
  perform sdd0578_fixture.run_as('operations-A',format('with changed as(update public.warehouse_receipts_cn set total_cbm=2,total_weight_kg=200 where id=%L::uuid returning id) select to_jsonb(count(*)) from changed',v_r));
  v_result:=sdd0578_fixture.run_as(null,format('select public.receive_prealerta_boxes_as_operario(%L::uuid,%L,%L::text[])',
    sdd0578_fixture.id('operario-cn'),v_codes[2],array[v_codes[2]]),'service_role');
  v_r:=(v_result->>'receipt_id')::uuid;
  insert into sdd0578_fixture.state(label,id,value) values(p_container||'-r2',v_r,v_result);
  perform sdd0578_fixture.run_as('operations-A',format('with changed as(update public.warehouse_receipts_cn set total_cbm=1,total_weight_kg=100 where id=%L::uuid returning id) select to_jsonb(count(*)) from changed',v_r));
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.confirm_sql(p_container,0,p_container||'-form',
    jsonb_build_array(sdd0578_fixture.selection(p_container,'client-A',array[p_container||'-r1'],'S-2026-'||p_code))));
  insert into sdd0578_fixture.state(label,id,value)
    select p_container||'-box'||seq,id,to_jsonb(code) from public.warehouse_boxes where prealerta_id=v_pre and deleted_at is null;
end $$;
select sdd0578_fixture.mixed_lot('lot-mixed',6401);

-- SDD0578_ASSERTIONS_BEGIN
-- The concurrency runner loads only the complete prefix above into its OWN DB,
-- then commits. It never removes the migration fuse or changes product code.
do $scope_fence_configuration$
declare v_scope uuid:=sdd0578_fixture.id('scope-config'); v_first uuid:=sdd0578_fixture.id('warehouse-config-1');
  v_second uuid:=sdd0578_fixture.id('warehouse-config-2'); v_before jsonb; v_touch bigint; v_result jsonb;
begin
  insert into public.warehouses_cn(id,code,hub_code,hub_name_es,hub_name_cn) values
    (v_first,'S578CFG1','S578','Configuración sintética1','合成'),(v_second,'S578CFG2','S578','Configuración sintética2','合成');
  select jsonb_agg(to_jsonb(r) order by r.receipt_id) into v_before from dtd_client_normal.receipts r;
  insert into dtd_client_normal.scopes(id,tenant_id,warehouse_id,enabled,starts_at)
    values(v_scope,sdd0578_fixture.id('tenant-A'),v_first,false,clock_timestamp());
  select touched into v_touch from dtd_client_normal.scope_fences where tenant_id=sdd0578_fixture.id('tenant-A') and warehouse_id=v_first;
  update dtd_client_normal.scopes set enabled=true where id=v_scope;
  update dtd_client_normal.scopes set enabled=false where id=v_scope;
  perform sdd0578_fixture.check((select touched>v_touch from dtd_client_normal.scope_fences
    where tenant_id=sdd0578_fixture.id('tenant-A') and warehouse_id=v_first),'ON/OFF repeated writes durable fence version');
  update dtd_client_normal.scopes set warehouse_id=v_second where id=v_scope;
  perform sdd0578_fixture.check((select count(*)=2 from dtd_client_normal.scope_fences where tenant_id=sdd0578_fixture.id('tenant-A')
    and warehouse_id in(v_first,v_second)),'config identity change fences both sorted old/new keys');
  select touched into v_touch from dtd_client_normal.scope_fences where tenant_id=sdd0578_fixture.id('tenant-A') and warehouse_id=v_second;
  delete from dtd_client_normal.scopes where id=v_scope;
  perform sdd0578_fixture.check((select touched>v_touch from dtd_client_normal.scope_fences
    where tenant_id=sdd0578_fixture.id('tenant-A') and warehouse_id=v_second),'scope delete retains/increments fence, never creates a missing-key gap');
  insert into dtd_client_normal.scopes(id,tenant_id,warehouse_id,enabled,starts_at)
    values(v_scope,sdd0578_fixture.id('tenant-A'),v_second,false,clock_timestamp());
  perform sdd0578_fixture.check((select touched>v_touch+1 from dtd_client_normal.scope_fences
    where tenant_id=sdd0578_fixture.id('tenant-A') and warehouse_id=v_second),'scope recreate uses durable prior fence, no reset');
  perform sdd0578_fixture.check((select jsonb_agg(to_jsonb(r) order by r.receipt_id)=v_before from dtd_client_normal.receipts r),
    'unrelated configuration cannot renew enrolled receipt identity/history');
  perform sdd0578_fixture.denied(format('with changed as(update dtd_client_normal.scopes set warehouse_id=%L::uuid where id=%L::uuid returning id) select to_jsonb(count(*)) from changed',
    v_first,sdd0578_fixture.id('scope')),'NORMAL_GOVERNED',null,'postgres');
  perform sdd0578_fixture.check((select warehouse_id=sdd0578_fixture.id('warehouse') from dtd_client_normal.scopes where id=sdd0578_fixture.id('scope')),
    'used scope cannot retarget historical cohort identity to a valid unused key');
  foreach v_result in array array[
    sdd0578_fixture.attempt(null,'select dtd_client_normal.fence_scope(null,null)','service_role'),
    sdd0578_fixture.attempt('operations-A','select to_jsonb(count(*)) from dtd_client_normal.scope_fences'),
    sdd0578_fixture.attempt('operations-A','delete from dtd_client_normal.scopes')
  ] loop
    perform sdd0578_fixture.check(v_result->>'state'='42501','scope helper/config/fence never an API permission');
  end loop;
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,sdd0578_fixture.operario_create_sql('absent-operario',sdd0578_fixture.id('warehouse'),1),'service_role')->>'state'='P0001',
    'unknown mobile operator retains original0045 rejection before scope fence');
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,sdd0578_fixture.operario_create_sql('operario-cn',sdd0578_fixture.id('warehouse'),0),'service_role')->>'state'='P0003',
    'invalid mobile quantity retains original0045 rejection before scope fence');
  perform sdd0578_fixture.denied(sdd0578_fixture.operario_create_sql('operario-ve',sdd0578_fixture.id('warehouse'),1),
    'NORMAL_FORBIDDEN',null,'service_role');
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.operario_create_sql('operario-ve',v_second,1),'service_role');
  perform sdd0578_fixture.check(v_result->>'receipt_id' is not null and not exists(select 1 from dtd_client_normal.receipts
    where receipt_id=(v_result->>'receipt_id')::uuid),'OFF0045 keeps its original authority; no inferred CN-only legacy permission change');
  perform sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.contexts) and not exists(select 1 from dtd_client_normal.intakes),
    'invalid original writer calls leave no borrowed intake authority/context');
end $scope_fence_configuration$;

do $normal$
declare v_input text; v_first jsonb; v_extended jsonb; v_old_member jsonb; v_old_boxes jsonb; v_snapshot uuid; v_created timestamptz;
 v_group dtd_client_normal.groups; v_ship uuid; v_counts jsonb; v_result jsonb; v_rate jsonb;
begin
  perform sdd0578_fixture.run_as('admin-A',sdd0578_fixture.freeze_sql('r1'));
  select id into v_snapshot from public.shipment_rate_snapshots where receipt_id=(select id from sdd0578_fixture.state where label='r1') and superseded_at is null;
  v_input:=sdd0578_fixture.confirm_sql('normal',0,'form-normal',jsonb_build_array(sdd0578_fixture.selection('normal','client-A',array['r1'],' s-2026-0001 ')));
  perform sdd0578_fixture.denied(v_input,'NORMAL_FORBIDDEN','commercial-A');
  perform sdd0578_fixture.denied(v_input,'NORMAL_FORBIDDEN','support-A');
  perform sdd0578_fixture.denied(v_input,'NORMAL_FORBIDDEN','operations-B');
  v_first:=sdd0578_fixture.run_as('operations-A',v_input);
  insert into sdd0578_fixture.state(label,value) values('normal-form',v_first),('normal-form-sql',to_jsonb(v_input));
  select * into strict v_group from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal'); v_ship:=v_group.shipment_id;
  select created_at into v_created from public.shipments where id=v_ship;
  select to_jsonb(m) into v_old_member from dtd_client_normal.members m where group_id=v_group.id;
  select jsonb_agg(to_jsonb(b) order by b.box_id) into v_old_boxes from dtd_client_normal.member_boxes b where receipt_id=(select id from sdd0578_fixture.state where label='r1');
  perform sdd0578_fixture.check(v_first->>'operation'='form' and v_first->>'containerRevision'='1','one durable confirmed intention/revision1');
  perform sdd0578_fixture.check((select client_id=sdd0578_fixture.id('client-A') and code='S-2026-0001' and status='consolidating'
    and volume_m3=1 and weight_kg=100 from public.shipments where id=v_ship),'client identity/manual code/fixed source measures');
  perform sdd0578_fixture.check((select shipment_id=v_ship from public.shipment_rate_snapshots where id=v_snapshot),'0496 binds NULL to shipment once');
  perform sdd0578_fixture.check((select count(*)=1 from public.expense_alerts where shipment_id=v_ship),'one alert, no costing');
  perform sdd0578_fixture.check((select count(*)=0 from public.shipments where code like 'C-%'),'no C- fallback in cohort');
  v_extended:=sdd0578_fixture.run_as('operations-A',sdd0578_fixture.confirm_sql('normal',1,'extend-normal',
    jsonb_build_array(sdd0578_fixture.selection('normal','client-A',array['r2'],null,true)),'extend'));
  insert into sdd0578_fixture.state(label,value) values('normal-extend',v_extended);
  perform sdd0578_fixture.check((select count(*)=1 from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal')),'extension does not create another group');
  perform sdd0578_fixture.check((select to_jsonb(m)=v_old_member from dtd_client_normal.members m where receipt_id=(v_old_member->>'receipt_id')::uuid),'old member snapshot byte-equivalent');
  perform sdd0578_fixture.check((select jsonb_agg(to_jsonb(b) order by b.box_id)=v_old_boxes from dtd_client_normal.member_boxes b where receipt_id=(v_old_member->>'receipt_id')::uuid),'old physical snapshot unchanged');
  perform sdd0578_fixture.check((select created_at=v_created and volume_m3=2 and weight_kg=200 and status='consolidating' from public.shipments where id=v_ship),'extension adds measures, preserves creation/status');
  v_rate:=v_extended#>'{groups,0,rates}';
  perform sdd0578_fixture.check(v_rate->>'knownSubtotalCents'='10000' and v_rate->'totalCents'='null'::jsonb
    and jsonb_array_length(v_rate->'missingReceiptIds')=1,'partial tariff known subtotal, never zero total');
  v_counts:=jsonb_build_array((select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log),(select count(*) from public.expense_alerts));
  v_result:=sdd0578_fixture.run_as('operations-A',v_input);
  perform sdd0578_fixture.check((v_result-'outcome')=(v_first-'outcome') and v_result->>'outcome'='replay','old replay retains original measures/rates/time/revision');
  perform sdd0578_fixture.check(v_counts=jsonb_build_array((select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log),(select count(*) from public.expense_alerts)),'replay no event/AUD/alert repetition');
  perform sdd0578_fixture.denied(replace(v_input,'Carga sintética revisada','Intención distinta'),'NORMAL_INTENT_CONFLICT');
  perform sdd0578_fixture.denied(sdd0578_fixture.confirm_sql('normal',1,'stale-extension',jsonb_build_array(sdd0578_fixture.selection('normal','client-A',array['r3'],null,true)),'extend'),'NORMAL_CONFLICT');
  perform sdd0578_fixture.denied(sdd0578_fixture.confirm_sql('normal',2,'old-member-again',jsonb_build_array(sdd0578_fixture.selection('normal','client-A',array['r1'],null,true)),'extend'),'NORMAL_INCOMPATIBLE');
  -- Compatible future freezes stay bound to the SAME shipment; replacing a
  -- committed member with another service may not leave an unbound live row.
  perform sdd0578_fixture.run_as('admin-A',sdd0578_fixture.freeze_sql('r2'));
  perform sdd0578_fixture.check((select shipment_id=v_ship from public.shipment_rate_snapshots where receipt_id=(select id from sdd0578_fixture.state where label='r2') and superseded_at is null),'late0496 freeze bound to current member');
  perform sdd0578_fixture.denied(sdd0578_fixture.freeze_sql('r1',200,'puerta_a_puerta_DDP'),'NORMAL_INCOMPATIBLE','admin-A');
  perform sdd0578_fixture.check((select shipment_id=v_ship and superseded_at is null from public.shipment_rate_snapshots where id=v_snapshot),'rejected replacement preserves prior live snapshot');
  perform sdd0578_fixture.check(not exists(select 1 from public.shipment_rate_snapshots s join dtd_client_normal.members m on m.receipt_id=s.receipt_id where s.superseded_at is null and s.shipment_id is null),'no new unbound live snapshot for members');
end $normal$;

do $scope_guards$
declare v_r uuid:=(select id from sdd0578_fixture.state where label='r1'); v_ship uuid:=(select shipment_id from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal')); v_query text;
begin
  perform sdd0578_fixture.denied(format('with r as(update public.shipments set volume_m3=999 where id=%L::uuid returning id) select to_jsonb(count(*)) from r',v_ship),'NORMAL_GOVERNED');
  perform sdd0578_fixture.denied(format('with r as(update public.warehouse_receipts_cn set shipment_id=null where id=%L::uuid returning id) select to_jsonb(count(*)) from r',v_r),'NORMAL_GOVERNED');
  perform sdd0578_fixture.denied(format('with r as(delete from public.consolidation_items where shipment_id=%L::uuid returning id) select to_jsonb(count(*)) from r',v_ship),'NORMAL_GOVERNED');
  perform sdd0578_fixture.denied(format('with r as(insert into public.shipment_events(tenant_id,shipment_id,status) values(%L::uuid,%L::uuid,%L) returning id) select to_jsonb(count(*)) from r',sdd0578_fixture.id('tenant-A'),v_ship,'delivered'),'NORMAL_GOVERNED');
  perform set_config('dtd.client_normal','membership',true); perform set_config('dtd.ve_delivery_completion','forged',true);
  perform sdd0578_fixture.denied(format('with r as(update public.shipments set status=%L where id=%L::uuid returning id) select to_jsonb(count(*)) from r','in_transit',v_ship),'NORMAL_GOVERNED',null,'service_role');
  v_query:=format('select public.client_consolidation_scope(array[%L::uuid],%L::uuid[],%L::uuid[],%L::uuid[])',v_r,'{}','{}','{}');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('operations-A',v_query)#>'{checked,receiptIds}'=jsonb_build_array(v_r),'scope checks exact known identity');
  perform sdd0578_fixture.denied(format('select public.client_consolidation_scope(array[%L::uuid,%L::uuid])',v_r,v_r),'NORMAL_INCOMPLETE');
  perform sdd0578_fixture.denied(format('select public.client_consolidation_scope(array[%L::uuid])',sdd0578_fixture.id('nonexistent')),'NORMAL_FORBIDDEN');
  update dtd_client_normal.scopes set enabled=false;
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('operations-A',v_query)#>'{receiptIds}'=jsonb_build_array(v_r),'OFF births does not erase membership');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('operations-A',format('select public.client_consolidation_intake(%L::jsonb)',jsonb_build_object('warehouse_id',sdd0578_fixture.id('warehouse'))))->>'availability'='off','explicit OFF branch without birth');
  update dtd_client_normal.scopes set enabled=true;
end $scope_guards$;

do $codes$
declare v_sql text; v_result jsonb; v_ship uuid:=(select shipment_id from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal'));
begin
  insert into public.shipments(id,tenant_id,code,shipment_service) values(sdd0578_fixture.id('other-tenant-code'),sdd0578_fixture.id('tenant-B'),'S-2026-4001','consolidado_lcl');
  v_sql:=sdd0578_fixture.confirm_sql('code-collision',0,'code-collision-ref',jsonb_build_array(sdd0578_fixture.selection('code-collision','client-A',array['r3'],'s-2026-4001')));
  perform sdd0578_fixture.denied(v_sql,'NORMAL_CODE_UNAVAILABLE');
  perform sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.containers where container_id=sdd0578_fixture.id('code-collision')),'collision has no partial enrolment/identity leak');
  perform sdd0578_fixture.denied(replace(v_sql,'s-2026-4001','C-2026-4001'),'NORMAL_INVALID_CODE');
  perform sdd0578_fixture.denied(format('with r as(insert into public.shipments(tenant_id,code,shipment_service) values(%L::uuid,%L,%L) returning id) select to_jsonb(count(*)) from r',sdd0578_fixture.id('tenant-B'),'s-2026-0001','consolidado_lcl'),'NORMAL_CODE_UNAVAILABLE','operations-B');
  perform sdd0578_fixture.check((select count(*)=1 from dtd_client_normal.code_reservations where shipment_id=v_ship),'one minimal reservation only for confirmed cohort');
end $codes$;

do $plan_revisions$
declare v_before text; v_replay jsonb; v_result jsonb;
begin
  v_before:=sdd0578_fixture.plan_sql('normal','plan-normal');
  v_result:=sdd0578_fixture.run_as('operations-A',v_before);
  perform sdd0578_fixture.check(v_result->>'versionNo'='1' and v_result->>'manifestRevision'='2','plan persists against complete current membership vector');
  v_replay:=sdd0578_fixture.run_as('operations-A',v_before);
  perform sdd0578_fixture.check((v_replay-'outcome')=(v_result-'outcome') and v_replay->>'outcome'='replay','plan historical replay, no new version');
  -- Keep history while invalidating current by a permitted new membership.
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.confirm_sql('second',0,'second-form',
    jsonb_build_array(sdd0578_fixture.selection('second','client-A',array['r3'],'S-2026-0003'))));
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('operations-A',format('select public.client_consolidation_plan_input(%L::uuid)',sdd0578_fixture.id('normal')))->>'previousPlanVersion'='1','maximum history survives independent reads');
end $plan_revisions$;

do $physical_and_states$
declare v_ship uuid:=(select shipment_id from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal'));
 v_close text:=sdd0578_fixture.close_sql('normal',2,'close-normal'); v_result jsonb; v_transit text; v_snapshot jsonb; v_ref uuid:=sdd0578_fixture.id('transit-normal');
begin
  perform sdd0578_fixture.denied(v_close,'NORMAL_COVERAGE');
  perform sdd0578_fixture.denied(sdd0578_fixture.stow_sql('normal','r3',2),'NORMAL_INCOMPATIBLE',null,'service_role');
  perform sdd0578_fixture.denied(sdd0578_fixture.stow_sql('normal','r1',1),'NORMAL_CONFLICT',null,'service_role');
  perform sdd0578_fixture.run_as(null,sdd0578_fixture.stow_sql('normal','r1',2),'service_role');
  perform sdd0578_fixture.denied(v_close,'NORMAL_COVERAGE');
  perform sdd0578_fixture.run_as(null,sdd0578_fixture.stow_sql('normal','r2',2),'service_role');
  v_result:=sdd0578_fixture.run_as('operations-A',v_close);
  perform sdd0578_fixture.check(v_result->>'outcome'='closed' and v_result->>'sealId' is not null and v_result->>'containerRevision'='2','seal exact complete current set');
  perform sdd0578_fixture.check((select status='consolidating' from public.shipments where id=v_ship),'close alone does not invent shipment milestone');
  perform sdd0578_fixture.denied(sdd0578_fixture.confirm_sql('normal',2,'extend-after-close',jsonb_build_array(sdd0578_fixture.selection('normal','client-A',array['r3'],null,true)),'extend'),'NORMAL_CONFLICT');
  v_result:=sdd0578_fixture.run_as('operations-A',format('select to_jsonb(public.advance_consolidation_governed(%L::uuid,%L))',sdd0578_fixture.id('normal'),'zarpado'));
  perform sdd0578_fixture.check((select status='shipped' from public.shipments where id=v_ship),'0477 actual shipped');
  v_transit:=sdd0578_fixture.transition_sql(v_ship,'transit','shipped',2,2,'transit-normal');
  insert into sdd0578_fixture.state(label,value) values('transit-sql',to_jsonb(v_transit));
  perform sdd0578_fixture.denied(replace(v_transit,'Hito operativo sintético','x'),'NORMAL_CONFLICT');
  insert into public.studio_role_module_overrides(tenant_id,role,module_id,can_view,can_edit) values(sdd0578_fixture.id('tenant-A'),'operations','tracking',true,false);
  perform sdd0578_fixture.denied(v_transit,'NORMAL_FORBIDDEN');
  delete from public.studio_role_module_overrides where tenant_id=sdd0578_fixture.id('tenant-A') and role='operations' and module_id='tracking';
  -- Real AUD writer failure, not a fake success stub: catalog rejection must
  -- roll back the shipment, event, intention, revision and seal atomically.
  select jsonb_build_array(to_jsonb(s),to_jsonb(c),(select count(*) from public.shipment_events where shipment_id=v_ship)) into v_snapshot
    from public.shipments s cross join dtd_client_normal.containers c where s.id=v_ship and c.container_id=sdd0578_fixture.id('normal');
  update public.audit_entity_types set status='deprecated',deprecated_at=now() where entity_type='shipment';
  perform sdd0578_fixture.check(sdd0578_fixture.attempt('operations-A',v_transit)->>'state'='23503','actual AUD failure rejects transition');
  update public.audit_entity_types set status='active',deprecated_at=null where entity_type='shipment';
  perform sdd0578_fixture.check((select jsonb_build_array(to_jsonb(s),to_jsonb(c),(select count(*) from public.shipment_events where shipment_id=v_ship))=v_snapshot
    from public.shipments s cross join dtd_client_normal.containers c where s.id=v_ship and c.container_id=sdd0578_fixture.id('normal')),'AUD failure whole rollback');
  perform sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.intentions where reference=v_ref),'failed transition no durable success intention');
  v_result:=sdd0578_fixture.run_as('operations-A',v_transit);
  insert into sdd0578_fixture.state(label,value) values('transit-result',v_result);
  perform sdd0578_fixture.check(v_result->>'to'='in_transit','ratified manual transit only');
  perform sdd0578_fixture.check((sdd0578_fixture.run_as('operations-A',v_transit)-'outcome')=(v_result-'outcome'),'transit replay original event clock');
  perform sdd0578_fixture.run_as('operations-A',format('select to_jsonb(public.advance_consolidation_governed(%L::uuid,%L))',sdd0578_fixture.id('normal'),'arribado'));
  perform sdd0578_fixture.check((select status='in_customs' from public.shipments where id=v_ship),'0477 advances after transit without backwards state');
  v_result:=sdd0578_fixture.run_as('operations-A',sdd0578_fixture.transition_sql(v_ship,'release_ve','in_customs',2,2,'release-normal'));
  perform sdd0578_fixture.check((select arrived_destination_at=(v_result->>'occurredAt')::timestamptz from public.shipments where id=v_ship),'release timestamp is governed customs milestone');
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.transition_sql(v_ship,'dispatch_ve','arrived_destination',2,2,'dispatch-normal'));
  perform sdd0578_fixture.denied(format('select to_jsonb(public.complete_ve_delivery_governed(%L::uuid,%L,%L,%L))',v_ship,'Receptor sintético','Atestación sintética','old-signature'),'NORMAL_GOVERNED');
end $physical_and_states$;

do $portal$
declare v_ship uuid:=(select shipment_id from dtd_client_normal.groups where container_id=sdd0578_fixture.id('normal'));
  v_result jsonb; v_history jsonb; v_feed jsonb; v_expected jsonb; v_actual jsonb; v_limit integer;
  v_ordering_ship uuid:=sdd0578_fixture.id('portal-ordering-legacy'); v_tie timestamptz:=clock_timestamp()+interval '1 day';
begin
  -- Events inserted only through the typed current-state note command; no
  -- fabricated private protocol context or direct bypass of guard_event.
  for i in 1..1105 loop
    perform sdd0578_fixture.run_as('operations-A',format('select public.client_consolidation_note(%L::uuid,%L,2,2,%L::uuid,%L)',
      v_ship,'out_for_delivery',sdd0578_fixture.id('history-'||i),'Nota sintética de historia completa'));
  end loop;
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('portal-A','select to_jsonb(public.get_user_tenant_id() is null)')='true'::jsonb,'Portal-only helper Studio NULL is valid');
  v_history:=sdd0578_fixture.run_as('portal-A',format('select public.client_consolidation_portal_events(%L::uuid,null)',v_ship));
  perform sdd0578_fixture.check(v_history->>'complete'='true' and v_history->>'view'='history' and v_history->'limit'='null'::jsonb
    and jsonb_array_length(v_history->'events')>1105,'history complete beyond1000 with original first milestone');
  perform sdd0578_fixture.check(v_history#>>'{events,0,status}'='consolidating','first actual event retained');
  select jsonb_agg(to_jsonb(e.id) order by e.occurred_at,e.id) into v_expected from public.shipment_events e
    where e.shipment_id=v_ship and e.deleted_at is null;
  select jsonb_agg(e.value->'id' order by e.ordinality) into v_actual from jsonb_array_elements(v_history->'events') with ordinality e;
  perform sdd0578_fixture.check(v_actual=v_expected,'cohort history exact full ID set and chronological order, not only >1000 count');
  perform sdd0578_fixture.check(not exists(select 1 from jsonb_array_elements(v_history->'events') e
    left join public.shipment_events source on source.id=(e->>'id')::uuid
    where source.shipment_id is distinct from v_ship or source.occurred_at is distinct from (e->>'occurredAt')::timestamptz),
    'full history preserves actual source clock for every exact event ID');

  -- Deterministic ordering fixture, NOT a cohort writer/arrival authority test:
  -- an owned legacy shipment has twelve known IDs, including ten equal clocks
  -- and a one-microsecond predecessor. Future time is synthetic ordering data,
  -- never inferred operational evidence. Legacy fixtures may set event times.
  insert into public.shipments(id,tenant_id,code,client_id,client_markbox,shipment_service)
    values(v_ordering_ship,sdd0578_fixture.id('tenant-A'),'S-2026-6901',sdd0578_fixture.id('client-A'),'DTD-0001','consolidado_lcl');
  insert into public.shipment_events(id,tenant_id,shipment_id,status,note,occurred_at)
    select ('ffffffff-ffff-4fff-8fff-'||lpad(i::text,12,'0'))::uuid,sdd0578_fixture.id('tenant-A'),v_ordering_ship,'consolidating',
      'Evento sintético para orden estable',case when i=1 then v_tie-interval '1 second' when i=2 then v_tie-interval '1 microsecond' else v_tie end
      from generate_series(1,12) i;
  v_history:=sdd0578_fixture.run_as('portal-A',format('select public.client_consolidation_portal_events(%L::uuid,null)',v_ordering_ship));
  select jsonb_agg(to_jsonb('ffffffff-ffff-4fff-8fff-'||lpad(i::text,12,'0')) order by i) into v_expected from generate_series(1,12) i;
  select jsonb_agg(e.value->'id' order by e.ordinality) into v_actual from jsonb_array_elements(v_history->'events') with ordinality e;
  perform sdd0578_fixture.check(v_actual=v_expected,'history tie orders all twelve literal IDs ASC, preserves microsecond predecessor');
  perform sdd0578_fixture.check((select count(distinct (e->>'occurredAt')::timestamptz)=3 from jsonb_array_elements(v_history->'events') e),
    'ordering fixture really contains a tie and distinct source clocks');
  foreach v_limit in array array[8,4] loop
    v_feed:=sdd0578_fixture.run_as('portal-A',format('select public.client_consolidation_portal_events(null,%s)',v_limit));
    perform sdd0578_fixture.check(jsonb_array_length(v_feed->'events')=v_limit and v_feed->>'view'='recent'
      and (v_feed->>'limit')::integer=v_limit,'feed8/4 exact separate selector');
    select jsonb_agg(to_jsonb('ffffffff-ffff-4fff-8fff-'||lpad(i::text,12,'0')) order by i desc) into v_expected
      from generate_series(13-v_limit,12) i;
    select jsonb_agg(e.value->'id' order by e.ordinality) into v_actual from jsonb_array_elements(v_feed->'events') with ordinality e;
    perform sdd0578_fixture.check(v_actual=v_expected,'recent topN exact newest literal IDs DESC at equal clocks, not oldest N/count only');
    perform sdd0578_fixture.check(not exists(select 1 from jsonb_array_elements(v_feed->'events') e where (e->>'occurredAt')::timestamptz<>v_tie),
      'recent topN reads the actual equal source clock');
  end loop;
  v_result:=sdd0578_fixture.run_as('hybrid-B','select public.client_consolidation_portal_read()');
  perform sdd0578_fixture.check(not exists(select 1 from jsonb_array_elements(v_result->'shipments') r where r->>'id'=v_ship::text),'hybrid own RPC never inherits broad Studio rows');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('hybrid-B',format('select to_jsonb(count(*)) from public.shipments where id=%L::uuid',v_ship))='1'::jsonb,'hybrid legitimate Studio scope survives outside own RPC');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('hybrid-B',format('select public.client_consolidation_portal_events(%L::uuid,null)',v_ship))->'events'='[]'::jsonb,'foreign selector known absence');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('hybrid-B',format('select public.client_consolidation_portal_events(%L::uuid,null)',sdd0578_fixture.id('absent')))->'events'='[]'::jsonb,'absent and foreign selectors indistinguishable');
  perform sdd0578_fixture.denied('select public.client_consolidation_portal_events(null,null)','NORMAL_INVALID','portal-A');
  perform sdd0578_fixture.denied('select public.client_consolidation_portal_events(null,0)','NORMAL_INVALID','portal-A');
  perform sdd0578_fixture.check(not exists(select 1 from public.client_users where auth_user_id=sdd0578_fixture.id('portal-unlinked')),
    'zero-link actor is really unlinked, not a claimed multiplicity fixture');
  perform sdd0578_fixture.denied('select public.client_consolidation_portal_read()','NORMAL_FORBIDDEN','portal-unlinked');
  perform sdd0578_fixture.denied('select public.client_consolidation_portal_events(null,8)','NORMAL_FORBIDDEN','portal-unlinked');
  -- Actual0080 UNIQUE(auth_user_id), acknowledged by effective0453, forbids two
  -- links today. Do not drop/weaken it to fabricate a valid ambiguous principal.
  -- TS doubles test defensive ambiguity separately, not a possible SQL state.
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,format(
    'with changed as(insert into public.client_users(auth_user_id,tenant_id,client_id,email,status) values(%L::uuid,%L::uuid,%L::uuid,%L,%L) returning id) select to_jsonb(count(*)) from changed',
    sdd0578_fixture.id('portal-A'),sdd0578_fixture.id('tenant-B'),sdd0578_fixture.id('client-B'),'duplicate-link@synthetic.invalid','active'),
    'service_role')->>'state'='23505','real duplicate Portal link rejected by unchanged0080 uniqueness');
  perform sdd0578_fixture.check((select count(*)=1 from public.client_users where auth_user_id=sdd0578_fixture.id('portal-A')),
    'duplicate-link attempt leaves the original single coherent principal unchanged');
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,'select public.client_consolidation_portal_events(null,8)','anon')->>'state'='42501','anon ACL no residual execute');
end $portal$;

do $mixed_lot_identity$
declare v_command text; v_before jsonb; v_old_boxes jsonb; v_result jsonb;
begin
  v_command:=sdd0578_fixture.lot_sql('lot-mixed',1,'lot-mixed-box1',2);
  v_before:=jsonb_build_array((select count(*) from public.consolidation_box_positions),(select count(*) from public.entity_audit_log));
  perform sdd0578_fixture.denied(v_command,'NORMAL_INCOMPATIBLE',null,'service_role');
  perform sdd0578_fixture.check(v_before=jsonb_build_array((select count(*) from public.consolidation_box_positions),
    (select count(*) from public.entity_audit_log)),'mixed lot rejects entire attempted box1+2, not a filtered box1+3 subset');
  perform sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.contexts),'mixed lot failure leaves no physical/intake context');
  select jsonb_agg(to_jsonb(b) order by b.box_id) into v_old_boxes from dtd_client_normal.member_boxes b
    where receipt_id=(select id from sdd0578_fixture.state where label='lot-mixed-r1');
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.lot_sql('lot-mixed',1,'lot-mixed-box1',1),'service_role');
  perform sdd0578_fixture.check(v_result->>'stuffed'='1','explicit single member box remains available after mixed rejection');
  perform sdd0578_fixture.run_as('operations-A',sdd0578_fixture.confirm_sql('lot-mixed',1,'lot-mixed-extension',
    jsonb_build_array(sdd0578_fixture.selection('lot-mixed','client-A',array['lot-mixed-r2'],null,true)),'extend'));
  perform sdd0578_fixture.check((select jsonb_agg(to_jsonb(b) order by b.box_id)=v_old_boxes from dtd_client_normal.member_boxes b
    where receipt_id=(select id from sdd0578_fixture.state where label='lot-mixed-r1')),'extension preserves prior member box snapshots');
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.lot_sql('lot-mixed',2,'lot-mixed-box2',2),'service_role');
  perform sdd0578_fixture.check(v_result->>'stuffed'='2' and v_result->>'normal_revision'='2','new member is stowable only after real additive extension');
  perform sdd0578_fixture.check((select count(*)=3 and count(distinct p.box_id)=3 from public.consolidation_box_positions p
    where p.consolidation_id=sdd0578_fixture.id('lot-mixed') and p.unstuffed_at is null),'each of three physical IDs stowed exactly once');
  perform sdd0578_fixture.check(sdd0578_fixture.run_as('operations-A',sdd0578_fixture.close_sql('lot-mixed',2,'lot-mixed-close'))->>'outcome'='closed',
    'complete extended lot can seal; no hidden subset or extra group');
end $mixed_lot_identity$;

do $pod_complete$
declare v_result jsonb; v_before jsonb; v_first jsonb; v_count integer;
begin
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-multi','pod-multi-ref'),'service_role');
  perform sdd0578_fixture.check(v_result->>'closed_count'='2' and jsonb_array_length(v_result->'shipments_closed')=2,'one POD closes two independently complete groups atomically');
  perform sdd0578_fixture.check((select count(*)=2 and count(distinct payload->>'request_ref')=2 and count(distinct entity_id)=2
    and bool_and(payload->>'pod_request_ref'='pod-multi-ref') from public.entity_audit_log where event_type='shipment_delivery_manually_confirmed'
      and payload->>'pod_request_ref'='pod-multi-ref'),'0321 compatible per-group AUD references, original POD intention retained');
  perform sdd0578_fixture.check((select count(*)=1 from dtd_client_normal.pod_intentions where request_ref='pod-multi-ref'),'one caller intention for multi-group capture');
  v_before:=jsonb_build_array((select count(*) from public.dispatch_pods),(select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log));
  perform sdd0578_fixture.check((sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-multi','pod-multi-ref'),'service_role')-'outcome')=(v_result-'outcome'),'multi-group replay exact historical clock/result');
  perform sdd0578_fixture.check(v_before=jsonb_build_array((select count(*) from public.dispatch_pods),(select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log)),'replay no repeated capture/AUD/events');
  v_first:=sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-last1','pod-last1-ref'),'service_role');
  perform sdd0578_fixture.check(v_first->>'closed_count'='0' and jsonb_array_length(v_first->'normal_pending')=1,'first OD persists valid POD while whole group remains pending');
  perform sdd0578_fixture.check((select count(*)=1 and bool_and(public.dispatch_pod_hash_valid(id)) from public.dispatch_pods where od_id=sdd0578_fixture.id('od-last1')),'partial valid capture sealed by actual0300');
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-last2','pod-last2-ref'),'service_role');
  perform sdd0578_fixture.check(v_result->>'closed_count'='1','last complete distinct receipt across ODs closes once');
  perform sdd0578_fixture.check((sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-last1','pod-last1-ref'),'service_role')-'outcome')=(v_first-'outcome'),'earlier partial replay remains historical, never late-closes');
end $pod_complete$;

do $fractions_are_not_identity$
declare v_r uuid:=(select id from sdd0578_fixture.state where label='pod-fragments-r1'); v_p2 uuid; v_result jsonb;
begin
  v_p2:=(sdd0578_fixture.run_as(null,format('select to_jsonb(public.bodeguero_split_p2(%L::uuid,%L::uuid,%L::uuid,1,%L,%L))',
    sdd0578_fixture.id('operario-ve'),sdd0578_fixture.id('od-fragments'),v_r,'falta_volumen','Fracción sintética'),'service_role')#>>'{}')::uuid;
  perform sdd0578_fixture.check((select count(*)=2 and sum(boxes_shipped)=2 from public.dispatch_order_packages where package_id=v_r),'actual0184 fractions sum to fixed boxes without physical identity');
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,format('select to_jsonb(public.bodeguero_split_p2(%L::uuid,%L::uuid,%L::uuid,1,%L,%L))',
    sdd0578_fixture.id('operario-ve'),sdd0578_fixture.id('od-fragments'),v_r,'falta_volumen','Fracción sintética'),'service_role')->>'state'='P0013','0184 idempotency stays actual P0013');
  update public.dispatch_orders set status='en_ruta' where id=v_p2;
  perform sdd0578_fixture.mark(sdd0578_fixture.id('od-fragments'),v_r); perform sdd0578_fixture.mark(v_p2,v_r);
  v_result:=sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-fragments','pod-fraction-ref'),'service_role');
  perform sdd0578_fixture.check(v_result->>'closed_count'='0' and v_result#>>'{normal_pending,0,reason}'='coverage_not_unique','sum/duplicate receipt identity cannot close');
  perform sdd0578_fixture.check((select status='out_for_delivery' from public.shipments where id=(select shipment_id from dtd_client_normal.groups where container_id=sdd0578_fixture.id('pod-fragments'))),'partial POD valid, shipment pending');
end $fractions_are_not_identity$;

create function sdd0578_fixture.reject_second_group_audit() returns trigger language plpgsql as $$
begin
  if new.entity_id::text=nullif(current_setting('test.sdd0578_fail_entity',true),'') and new.event_type='shipment_delivery_manually_confirmed' then
    raise exception 'Synthetic failure on second real AUD append' using errcode='P5780';
  end if;
  return new;
end $$;
create trigger aa_sdd0578_audit_failure before insert on public.entity_audit_log for each row execute function sdd0578_fixture.reject_second_group_audit();
do $pod_rollback$
declare v_before jsonb; v_target uuid;
begin
  select shipment_id into v_target from dtd_client_normal.groups where container_id=sdd0578_fixture.id('pod-rollback') order by id offset 1 limit 1;
  perform set_config('test.sdd0578_fail_entity',v_target::text,true);
  v_before:=jsonb_build_array((select count(*) from public.dispatch_pods),(select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log));
  perform sdd0578_fixture.check(sdd0578_fixture.attempt(null,sdd0578_fixture.pod_sql('od-rollback','pod-rollback-ref'),'service_role')->>'state'='P5780','second group real AUD failure reaches caller');
  perform sdd0578_fixture.check(v_before=jsonb_build_array((select count(*) from public.dispatch_pods),(select count(*) from public.shipment_events),(select count(*) from public.entity_audit_log)),'failed second AUD rolls back POD and every group/event/AUD');
  perform sdd0578_fixture.check((select bool_and(s.status='out_for_delivery') from public.shipments s join dtd_client_normal.groups g on g.shipment_id=s.id where g.container_id=sdd0578_fixture.id('pod-rollback')),'no first group partial success');
  perform sdd0578_fixture.check(not exists(select 1 from dtd_client_normal.pod_intentions where request_ref='pod-rollback-ref'),'no cached success after rollback');
  perform set_config('test.sdd0578_fail_entity','',true);
  perform sdd0578_fixture.check(sdd0578_fixture.run_as(null,sdd0578_fixture.pod_sql('od-rollback','pod-rollback-ref'),'service_role')->>'closed_count'='2','same intention retries after full rollback');
end $pod_rollback$;
drop trigger aa_sdd0578_audit_failure on public.entity_audit_log;
select 'SDD0578 SQL assertions: '||currval('sdd0578_fixture.assertions') as result;
rollback;
