\set ON_ERROR_STOP on
-- SDD-0381: fixture sintética PostgreSQL desechable, nunca Cloud.
-- RED causal: -v apply_fix=false; GREEN: default con 0429.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $$ begin
 if to_regnamespace('auth') is not null or to_regclass('public.prealertas') is not null then raise exception 'Disposable fixture required'; end if;
 if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth; create schema extensions; create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.tenants(id uuid primary key, slug text);
create table public.user_tenants(user_id uuid primary key, tenant_id uuid not null, disabled_at timestamptz);
create function public.get_user_tenant_id() returns uuid language sql stable security definer set search_path='' as $$
 select tenant_id from public.user_tenants where user_id=auth.uid() and disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
create table public.shipments(id uuid primary key,tenant_id uuid,client_markbox text,deleted_at timestamptz);
alter table public.shipments enable row level security;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
\ir ../migrations/0006_clients.sql
\ir ../migrations/0080_portal_cliente.sql
\ir ../migrations/0105_portal_compras.sql
\ir ../migrations/0118_prealerta_documents.sql
\ir ../migrations/0150_prealerta_addons.sql
\ir ../migrations/0229_suppliers_cn_operator_write.sql
\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql
\ir ../migrations/0417_portal_prealertas_tenant_boundary.sql
create function pg_temp.f(label text) returns uuid language sql immutable as $$ select md5('0429-synthetic-'||label)::uuid $$;
create temporary sequence assertion_count;
grant usage on sequence assertion_count to authenticated, service_role;
create function pg_temp.assert_probe(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'TEST 0429: %',label;end if;perform nextval('pg_temp.assertion_count');raise notice 'TEST 0429 OK: %',label;end $$;
insert into public.tenants values(pg_temp.f('TA'),'synthetic-A'),(pg_temp.f('TB'),'synthetic-B');
insert into auth.users(id) select pg_temp.f(label) from unnest(array['A','B','retired','incoherent','invited','revoked','unbound','staffA','staffB']) label;
insert into public.user_tenants values(pg_temp.f('staffA'),pg_temp.f('TA'),null),(pg_temp.f('staffB'),pg_temp.f('TB'),null);
insert into public.clients(id,tenant_id,markbox,name) values
(pg_temp.f('CA'),pg_temp.f('TA'),'DUP','synthetic-A'),
(pg_temp.f('CB'),pg_temp.f('TB'),'DUP','synthetic-B'),
(pg_temp.f('CD'),pg_temp.f('TA'),'DEAD','synthetic-retired'),
(pg_temp.f('CI'),pg_temp.f('TA'),'INVITED','synthetic-invited'),
(pg_temp.f('CR'),pg_temp.f('TA'),'REVOKED','synthetic-revoked'),
(pg_temp.f('CO'),pg_temp.f('TB'),'OTHER','synthetic-other');
insert into public.client_users(auth_user_id,tenant_id,client_id,email,status)
select pg_temp.f(actor),pg_temp.f(tenant),pg_temp.f(client),actor||'@example.invalid',status from(values
('A','TA','CA','active'),('B','TB','CB','active'),('retired','TA','CD','active'),
('incoherent','TA','CB','active'),('invited','TA','CI','invited'),('revoked','TA','CR','revoked')
)v(actor,tenant,client,status);
insert into public.prealertas(id,tenant_id,client_markbox,code,description,boxes)
select pg_temp.f(label),pg_temp.f(tenant),markbox,label,'synthetic',1 from(values
('PA','TA','DUP'),('PAempty','TA','DUP'),('PB','TB','DUP'),('PD','TA','DEAD'),
('PI','TA','INVITED'),('PR','TA','REVOKED'),('PO','TB','OTHER')
)v(label,tenant,markbox);
insert into public.prealerta_service_requests(id,tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted,notes)
select pg_temp.f(label),pg_temp.f(tenant),pg_temp.f(parent),markbox,'verificacion',true,label from(values
('RA','TA','PA','DUP'),('RB','TB','PB','DUP'),('RD','TA','PD','DEAD'),
('RI','TA','PI','INVITED'),('RR','TA','PR','REVOKED'),('RO','TB','PO','OTHER')
)v(label,tenant,parent,markbox);
update public.clients set deleted_at=now() where id=pg_temp.f('CD');
create temporary table original_rows as select jsonb_agg(to_jsonb(r) order by id) value from public.prealerta_service_requests r;


-- La fixture reproduce las policies históricas; ningún trigger ni FK se desactiva.
savepoint legacy_probe;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealertas where id=pg_temp.f('PB'))=0,
 'Baseline0417: padre B oculto al Portal A');
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests where id=pg_temp.f('RB'))=1,
 'RED baseline: A lee solicitud B con el mismo Shipping Mark');
do $legacy_rebind$
declare n bigint; blocked boolean:=false;
begin
 begin update public.prealerta_service_requests set notes='synthetic-forbidden' where id=pg_temp.f('RB');
 exception when check_violation then blocked:=true;end;
 perform pg_temp.assert_probe(blocked,'Baseline: editar notas ajenas sin reubicar falla 23514 por el guard');
 update public.prealerta_service_requests set tenant_id=pg_temp.f('TA'),prealerta_id=pg_temp.f('PAempty'),
   notes='synthetic-rebound' where id=pg_temp.f('RB');
 get diagnostics n=row_count;
 perform pg_temp.assert_probe(n=1,'RED baseline: UPDATE reubica una solicitud ajena hacia tenant y padre propios');
end;
$legacy_rebind$;
reset role;
select pg_temp.assert_probe((select tenant_id=pg_temp.f('TA') and prealerta_id=pg_temp.f('PAempty')
 from public.prealerta_service_requests where id=pg_temp.f('RB')),
 'Owner confirma reasignación real de la fila B');
rollback to legacy_probe;release legacy_probe;
savepoint legacy_principal;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('retired')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealertas)=0 and
 (select count(*) from public.prealerta_service_requests where id=pg_temp.f('RD'))=1,
 'RED baseline: cliente retirado lee solicitud aunque el padre ya esté oculto');
select set_config('request.jwt.claim.sub',pg_temp.f('incoherent')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealertas)=0 and
 (select count(*) from public.prealerta_service_requests)=2,
 'RED baseline: vínculo incoherente lee solicitudes de ambos tenants');
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
do $legacy_soft_delete$
declare blocked boolean:=false;
begin
 begin update public.prealerta_service_requests set deleted_at=now() where id=pg_temp.f('RA');
 exception when insufficient_privilege then blocked:=true;end;
 perform pg_temp.assert_probe(blocked and
  (select deleted_at is null from public.prealerta_service_requests where id=pg_temp.f('RA')),
  'Baseline: soft delete propio falla 42501 y conserva fila, residuo fuera de 0429');
end;
$legacy_soft_delete$;
reset role;
rollback to legacy_principal;release legacy_principal;

-- Casos adicionales tras la sonda: el conteo causal histórico permanece inequívoco.
insert into auth.users(id) values(pg_temp.f('disabled'));
insert into public.user_tenants values(pg_temp.f('disabled'),pg_temp.f('TA'),now());
insert into public.clients(id,tenant_id,markbox,name) values
 (pg_temp.f('CAother'),pg_temp.f('TA'),'OTHER-A','synthetic-other-A');
insert into public.prealertas(id,tenant_id,client_markbox,code,description,boxes) values
 (pg_temp.f('PAother'),pg_temp.f('TA'),'OTHER-A','PAother','synthetic',1),
 (pg_temp.f('PAnoclient'),pg_temp.f('TA'),'NO-CLIENT','PAnoclient','synthetic',1),
 (pg_temp.f('PAreceived'),pg_temp.f('TA'),'DUP','PAreceived','synthetic',1);
update public.prealertas set received_at=now() where id=pg_temp.f('PAreceived');
insert into public.prealerta_service_requests(id,tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted,notes,deleted_at)
select pg_temp.f(label),pg_temp.f(tenant),pg_temp.f(parent),markbox,'compactar',true,label,
 case when label in ('RAhist','RBhist') then now() else null end
from(values
 ('RAhist','TA','PA','DUP'),('RBhist','TB','PB','DUP'),
 ('RAother','TA','PAother','OTHER-A'),('RAnoclient','TA','PAnoclient','NO-CLIENT')
)v(label,tenant,parent,markbox);
insert into public.prealerta_addons(id,tenant_id,code,label,description,consent_text)
values(pg_temp.f('addon-A'),pg_temp.f('TA'),'verificacion','synthetic A','synthetic','synthetic consent'),
 (pg_temp.f('addon-B'),pg_temp.f('TB'),'verificacion','synthetic B','synthetic','synthetic consent');

create function pg_temp.catalog_snapshot() returns jsonb language sql stable as $catalog$
select jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid)
  from pg_class c where c.relnamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'columns',(select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid
  where c.relnamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace) and a.attnum>0),
 'constraints',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c
  where c.connamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'indexes',(select jsonb_agg(to_jsonb(i) order by i.indexrelid) from pg_index i join pg_class c on c.oid=i.indrelid
  where c.relnamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where c.relnamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'policies',(select jsonb_agg(case when p.polrelid='public.prealerta_service_requests'::regclass
   and p.polname in('psr portal self select','psr portal self insert','psr portal self update')
   then to_jsonb(p)-'polqual'-'polwithcheck' else to_jsonb(p) end order by p.oid)
  from pg_policy p join pg_class c on c.oid=p.polrelid
  where c.relnamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
  where p.pronamespace in('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)),
 'schemas',(select jsonb_agg(jsonb_build_array(oid,nspowner,nspacl) order by oid)
  from pg_namespace where nspname in('public','auth','storage','extensions'))
);
$catalog$;
create function pg_temp.row_snapshot() returns jsonb language sql stable as $rows$
select jsonb_build_object(
 'requests',(select jsonb_agg(to_jsonb(r) order by id) from public.prealerta_service_requests r),
 'parents',(select jsonb_agg(to_jsonb(p) order by id) from public.prealertas p),
 'addons',(select jsonb_agg(to_jsonb(a) order by id) from public.prealerta_addons a),
 'clients',(select jsonb_agg(to_jsonb(c) order by id) from public.clients c),
 'bindings',(select jsonb_agg(to_jsonb(cu) order by id) from public.client_users cu),
 'tenants',(select jsonb_agg(to_jsonb(t) order by id) from public.tenants t),
 'staff',(select jsonb_agg(to_jsonb(t) order by user_id) from public.user_tenants t),
 'users',(select jsonb_agg(to_jsonb(u) order by id) from auth.users u),
 'shipments',(select jsonb_agg(to_jsonb(s) order by id) from public.shipments s),
 'suppliers',(select jsonb_agg(to_jsonb(s) order by id) from public.suppliers_cn s),
 'documents',(select jsonb_agg(to_jsonb(d) order by id) from public.prealerta_documents d),
 'buckets',(select jsonb_agg(to_jsonb(b) order by id) from storage.buckets b),
 'objects',(select jsonb_agg(to_jsonb(o) order by id) from storage.objects o)
);
$rows$;
create temporary table before_state as select pg_temp.catalog_snapshot() catalog,pg_temp.row_snapshot() rows;
\if :apply_fix
\ir ../migrations/0429_portal_service_requests_principal_tenant.sql
create temporary table policies_first as
 select jsonb_agg(to_jsonb(p) order by oid) value from pg_policy p;
\ir ../migrations/0429_portal_service_requests_principal_tenant.sql
select pg_temp.assert_probe((select value from policies_first)=
 (select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p),'Reejecución idempotente conserva todas las policies');
do $drift$
declare drift text; failed boolean; message text; after_drift jsonb; after_policies jsonb;
 original jsonb:=pg_temp.catalog_snapshot(); original_rows jsonb:=pg_temp.row_snapshot();
 original_policies jsonb:=(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p);
 migration text:=pg_read_file('/sb/migrations/0429_portal_service_requests_principal_tenant.sql');
begin
 foreach drift in array array[
  'create policy fixture_extra on public.prealerta_service_requests for select to authenticated using(true)',
  'drop policy "psr portal self insert" on public.prealerta_service_requests',
  'alter policy "psr portal self select" on public.prealerta_service_requests to anon',
  'alter policy "psr portal self insert" on public.prealerta_service_requests to public',
  'alter policy "psr portal self update" on public.prealerta_service_requests to authenticated, anon',
  'alter policy "psr tenant read" on public.prealerta_service_requests to anon',
  'alter policy "psr tenant update" on public.prealerta_service_requests to anon',
  'alter policy "psr service_role all" on public.prealerta_service_requests to authenticated',
  'drop policy "psr portal self select" on public.prealerta_service_requests; create policy "psr portal self select" on public.prealerta_service_requests as restrictive for select to authenticated using(true)',
  'drop policy "psr portal self update" on public.prealerta_service_requests; create policy "psr portal self update" on public.prealerta_service_requests for select to authenticated using(true)',
  'drop policy "psr portal self update" on public.prealerta_service_requests; create policy "psr portal self update" on public.prealerta_service_requests for update to authenticated using(true)',
  'drop policy "psr service_role all" on public.prealerta_service_requests; create policy "psr service_role all" on public.prealerta_service_requests for all to service_role using(true)',
  'alter table public.prealerta_service_requests disable row level security',
  'alter table public.client_users disable row level security',
  'alter table public.clients disable row level security',
  'alter table public.prealertas disable row level security'
 ] loop
  failed:=false;
  begin
   execute drift;
   after_drift:=pg_temp.catalog_snapshot();
   select jsonb_agg(to_jsonb(p) order by oid) into after_policies from pg_policy p;
   begin execute migration;
   exception when others then
    get stacked diagnostics message=message_text;
    if sqlstate<>'P0001' or message not like '0429%' then
     raise exception 'TEST 0429: drift no falló en preflight: % / %',sqlstate,message;
    end if;
    failed:=true;
   end;
   if not failed or after_drift<>pg_temp.catalog_snapshot() or original_rows<>pg_temp.row_snapshot()
     or after_policies<>(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p) then
    raise exception 'TEST 0429: drift aceptado o cambio parcial: %',drift;
   end if;
   raise exception using errcode='PT429',message='rollback drift sintético';
  exception when sqlstate 'PT429' then null;end;
  perform pg_temp.assert_probe(failed and original=pg_temp.catalog_snapshot() and original_policies=
    (select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p),'Preflight rechaza y revierte: '||drift);
 end loop;
end;
$drift$;
\endif
select pg_temp.assert_probe((select catalog from before_state)=pg_temp.catalog_snapshot(),
 'Sólo cambian expresiones de tres policies Portal: preserva ACL, formas, roles, helpers, índices, columnas y triggers');
select pg_temp.assert_probe((select rows from before_state)=pg_temp.row_snapshot(),
 'Migración conserva solicitudes, clientes, vínculos, padres, catálogo y demás filas');

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
-- Falla causalmente en RED; no intenta abrir una migración ausente.
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests where id=pg_temp.f('RB'))=0,
 'Portal A no lee solicitud B aunque Shipping Mark sea igual');
select pg_temp.assert_probe((select array_agg(notes order by notes) from public.prealerta_service_requests)=array['RA'],
 'Portal A sólo ve solicitud propia viva, no otro markbox, huérfana ni históricos');
select pg_temp.assert_probe((select count(*) from public.prealertas where id=pg_temp.f('PB'))=0,
 'El padre B sigue oculto por 0417');
select set_config('request.jwt.claim.sub',pg_temp.f('B')::text,true);
select pg_temp.assert_probe((select array_agg(notes order by notes) from public.prealerta_service_requests)=array['RB'],
 'Portal B conserva propia sin cruce recíproco ni histórico');
do $invalid_principals$
declare actor text; n bigint; rejected boolean;
begin
 foreach actor in array array['retired','incoherent','invited','revoked','unbound','disabled','missing-uid'] loop
  perform set_config('request.jwt.claim.sub',case when actor='missing-uid' then '' else pg_temp.f(actor)::text end,true);
  perform pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=0,actor||': sin lectura');
  update public.prealerta_service_requests set notes='synthetic-forbidden';
  get diagnostics n=row_count;
  perform pg_temp.assert_probe(n=0,actor||': UPDATE no modifica filas');
  delete from public.prealerta_service_requests;
  get diagnostics n=row_count;
  perform pg_temp.assert_probe(n=0,actor||': DELETE no modifica filas');
  rejected:=false;
  begin
   insert into public.prealerta_service_requests(tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted)
   values(pg_temp.f('TA'),pg_temp.f('PAempty'),'DUP','compactar',true);
  exception when insufficient_privilege or check_violation then rejected:=true;end;
  perform pg_temp.assert_probe(rejected,actor||': INSERT ajeno rechazado por guard/RLS reales');
 end loop;
end;
$invalid_principals$;
reset role;

savepoint negatives;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
do $foreign_writes$
declare n bigint; rejected boolean; destination text;
begin
 update public.prealerta_service_requests set tenant_id=pg_temp.f('TA'),prealerta_id=pg_temp.f('PAempty'),
  notes='synthetic-hijack' where id=pg_temp.f('RB');
 get diagnostics n=row_count;
 perform pg_temp.assert_probe(n=0,'USING impide reasignar fila B a tenant y padre propios');
 update public.prealerta_service_requests set notes='synthetic-forbidden' where id=pg_temp.f('RB');
 get diagnostics n=row_count;
 perform pg_temp.assert_probe(n=0,'UPDATE ajeno no llega al guard: cero filas');
 delete from public.prealerta_service_requests;
 get diagnostics n=row_count;
 perform pg_temp.assert_probe(n=0,'Portal no obtiene DELETE físico propio ni ajeno');
 rejected:=false;
 begin
  insert into public.prealerta_service_requests(tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted)
  values(pg_temp.f('TA'),pg_temp.f('PAempty'),'DUP','compactar',false);
 exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.assert_probe(rejected,'INSERT propio sin consentimiento falla 42501');
 foreach destination in array array['PB','PAother','missing-parent'] loop
  rejected:=false;
  begin
   update public.prealerta_service_requests set prealerta_id=pg_temp.f(destination),
    tenant_id=case when destination='PB' then pg_temp.f('TB') else pg_temp.f('TA') end,
    client_markbox=case when destination='PAother' then 'OTHER-A' else 'DUP' end
   where id=pg_temp.f('RA');
  exception when insufficient_privilege or check_violation then rejected:=true;end;
  perform pg_temp.assert_probe(rejected,'WITH CHECK/guard no permiten cambiar propia hacia '||destination);
  rejected:=false;
  begin
   insert into public.prealerta_service_requests(tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted)
   values(case when destination='PB' then pg_temp.f('TB') else pg_temp.f('TA') end,
    pg_temp.f(destination),case when destination='PAother' then 'OTHER-A' else 'DUP' end,'etiquetado_pieza',true);
  exception when insufficient_privilege or check_violation then rejected:=true;end;
  perform pg_temp.assert_probe(rejected,'INSERT con destino ajeno/inexistente rechazado: '||destination);
 end loop;
 rejected:=false;
 begin update public.prealerta_service_requests set deleted_at=now() where id=pg_temp.f('RA');
 exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.assert_probe(rejected and (select deleted_at is null from public.prealerta_service_requests where id=pg_temp.f('RA')),
  'Soft delete propio conserva 42501 y fila original, no se amplía SELECT histórico');
 update public.prealerta_service_requests set deleted_at=null where id=pg_temp.f('RAhist');
 get diagnostics n=row_count;
 perform pg_temp.assert_probe(n=0,'Portal no reactiva histórico invisible');
end;
$foreign_writes$;
reset role;
select pg_temp.assert_probe((select rows from before_state)=pg_temp.row_snapshot(),'Negativos preservan íntegramente todas las filas');
rollback to negatives;release negatives;

savepoint positives;
set local role authenticated;
do $own_operations$
declare actor text; request text; parent text; tenant text; n bigint;
begin
 foreach actor in array array['A','B'] loop
  request:='R'||actor; parent:='P'||actor; tenant:='T'||actor;
  perform set_config('request.jwt.claim.sub',pg_temp.f(actor)::text,true);
  update public.prealerta_service_requests set notes='synthetic-own-edit' where id=pg_temp.f(request);
  get diagnostics n=row_count;
  perform pg_temp.assert_probe(n=1,actor||': conserva UPDATE notas propias');
  insert into public.prealerta_service_requests(id,tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted,timing)
  values(pg_temp.f('new-'||actor),pg_temp.f(tenant),pg_temp.f(parent),'DUP','etiquetado_pieza',true,'tardia');
  perform pg_temp.assert_probe((select timing='a_tiempo' from public.prealerta_service_requests where id=pg_temp.f('new-'||actor)),
   actor||': conserva INSERT propio y trigger corrige timing a_tiempo');
 end loop;
 perform set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
 insert into public.prealerta_service_requests(id,tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted,timing)
 values(pg_temp.f('late-A'),pg_temp.f('TA'),pg_temp.f('PAreceived'),'DUP','verificacion',true,'a_tiempo');
 perform pg_temp.assert_probe((select timing='tardia' from public.prealerta_service_requests where id=pg_temp.f('late-A')),
  'Trigger conserva timing tardía después de recepción aunque el caller mande a_tiempo');
end;
$own_operations$;
reset role;
rollback to positives;release positives;

savepoint revoke_after_login;
update public.client_users set status='revoked' where auth_user_id=pg_temp.f('A');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=0,'Revocación tras login corta lectura');
do $$ declare n bigint;begin
 update public.prealerta_service_requests set notes='synthetic-revoked' where id=pg_temp.f('RA');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=0,'Revocación tras login corta UPDATE');
end $$;
reset role;
rollback to revoke_after_login;release revoke_after_login;
savepoint retire_after_login;
update public.clients set deleted_at=now() where id=pg_temp.f('CA');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('A')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=0,'Baja cliente tras login corta lectura');
do $$ declare n bigint;begin
 update public.prealerta_service_requests set notes='synthetic-retired' where id=pg_temp.f('RA');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=0,'Baja cliente tras login corta UPDATE');
end $$;
reset role;
rollback to retire_after_login;release retire_after_login;

savepoint studio;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('staffA')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=7 and
 (select count(*) from public.prealerta_service_requests where id=pg_temp.f('RAhist'))=1,
 'Equipo A conserva siete filas propias incluyendo histórico y clientes retirados/sin vínculo');
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests where tenant_id=pg_temp.f('TB'))=0,
 'Equipo A no lee tenant B');
do $staff_writes$
declare n bigint; rejected boolean:=false;
begin
 update public.prealerta_service_requests set notes='synthetic-team' where id=pg_temp.f('RAother');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Equipo A conserva UPDATE de otro cliente de su tenant');
 update public.prealerta_service_requests set deleted_at=now() where id=pg_temp.f('RAother');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Equipo A conserva soft delete propio y lectura histórica');
 update public.prealerta_service_requests set notes='synthetic-forbidden' where id=pg_temp.f('RB');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=0,'Equipo A no actualiza B');
 delete from public.prealerta_service_requests;
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=0,'Equipo no gana DELETE que no tenía');
 begin
  insert into public.prealerta_service_requests(tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted)
  values(pg_temp.f('TA'),pg_temp.f('PAempty'),'DUP','compactar',true);
 exception when insufficient_privilege then rejected:=true;end;
 perform pg_temp.assert_probe(rejected,'Equipo no gana INSERT PSR que no tenía');
end;
$staff_writes$;
select set_config('request.jwt.claim.sub',pg_temp.f('staffB')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=3 and
 (select count(*) from public.prealerta_service_requests where id=pg_temp.f('RBhist'))=1,
 'Equipo B conserva tres filas propias, histórico incluido');
reset role;
rollback to studio;release studio;

-- La unión de policies permisivas es legítima; la consulta Portal se prueba aparte.
savepoint hybrid;
insert into public.user_tenants values(pg_temp.f('B'),pg_temp.f('TA'),null);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.f('B')::text,true);
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=8 and
 (select count(*) from public.prealerta_service_requests where id=pg_temp.f('RAhist'))=1 and
 (select count(*) from public.prealerta_service_requests where id in(pg_temp.f('RBhist'),pg_temp.f('RO')))=0,
 'Híbrido conserva siete derechos Studio A más solicitud Portal B, sin históricos B');
do $hybrid_writes$
declare n bigint;
begin
 update public.prealerta_service_requests set notes='synthetic-hybrid-A' where id=pg_temp.f('RAother');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Híbrido conserva UPDATE por Studio A');
 update public.prealerta_service_requests set notes='synthetic-hybrid-B' where id=pg_temp.f('RB');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Híbrido conserva UPDATE por Portal B');
end;
$hybrid_writes$;
reset role;
update public.clients set deleted_at=now() where id=pg_temp.f('CB');
set local role authenticated;
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=7 and
 (select count(*) from public.prealerta_service_requests where tenant_id=pg_temp.f('TB'))=0,
 'Retirar cliente B del híbrido no retira Studio A');
reset role;
rollback to hybrid;release hybrid;

savepoint service;
set local role service_role;
select pg_temp.assert_probe((select count(*) from public.prealerta_service_requests)=10 and
 (select count(*) from public.prealerta_service_requests where deleted_at is not null)=2,
 'Servicio conserva ambos tenants e históricos');
do $service_writes$
declare n bigint;
begin
 update public.prealerta_service_requests set notes='synthetic-service' where id=pg_temp.f('RB');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Servicio conserva UPDATE B');
 insert into public.prealerta_service_requests(id,tenant_id,prealerta_id,client_markbox,addon_code,consent_accepted)
 values(pg_temp.f('service-new'),pg_temp.f('TA'),pg_temp.f('PAempty'),'DUP','compactar',false);
 perform pg_temp.assert_probe((select count(*) from public.prealerta_service_requests where id=pg_temp.f('service-new'))=1,
  'Servicio conserva INSERT sin regla de consentimiento Portal');
 delete from public.prealerta_service_requests where id=pg_temp.f('service-new');
 get diagnostics n=row_count;perform pg_temp.assert_probe(n=1,'Servicio conserva DELETE propio');
end;
$service_writes$;
reset role;
rollback to service;release service;

set local role anon;
do $anon$
declare rejected boolean:=false;
begin
 begin perform 1 from public.prealerta_service_requests;
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'TEST 0429: anon obtuvo SELECT';end if;
end;
$anon$;
reset role;
select pg_temp.assert_probe(not has_table_privilege('anon','public.prealerta_service_requests','select'),
 'anon conserva ausencia de ACL SELECT, comprobada por ejecución');
select pg_temp.assert_probe((select catalog from before_state)=pg_temp.catalog_snapshot(),
 'Catálogo completo ajeno a las tres expresiones sigue idéntico');
select pg_temp.assert_probe((select rows from before_state)=pg_temp.row_snapshot(),
 'Todos los casos de escritura/fixtures revierten sin cambios persistidos');
select last_value as assertions_0429 from assertion_count;
rollback;
select to_regclass('public.prealerta_service_requests') is null and to_regnamespace('auth') is null as fixture_0429_rolled_back;
