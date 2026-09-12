\set ON_ERROR_STOP on
-- SDD-0375. Sólo PostgreSQL local vacío; fixture, DDL y datos se revierten.
-- Concurrencia multiconexión: node scripts/check-public-verify-concurrency.mjs
begin;
do $guard$
begin
  if to_regclass('public.public_verify_throttle') is not null then
    raise exception 'TEST 0426 requiere una base desechable vacía';
  end if;
end;
$guard$;
do $roles$
begin
  if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  create role fixture_0426_extra nologin;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
\ir ../migrations/0169_public_verify_throttle.sql
-- Emula grants de plataforma; 0169 por sí misma sólo define tabla/RLS/índice.
grant select,insert on public.public_verify_throttle to service_role, anon, authenticated;
insert into public.public_verify_throttle(id,ip,created_at) values
  ('00000426-0000-0000-0000-000000000001','historical unnormalized key','2000-01-01T00:00:00Z'),
  ('00000426-0000-0000-0000-000000000002','2001:0DB8:0000:0000:0000:0000:0000:0042','2000-01-02T00:00:00Z');

create temporary table assertions(label text primary key);
grant insert,select on assertions to anon,authenticated,service_role;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST 0426: %',label; end if;
  insert into pg_temp.assertions values(label);
end;
$$;
create function pg_temp.table_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'relation',(select jsonb_build_array(relkind,relowner,relacl,relrowsecurity,relforcerowsecurity,
      obj_description(oid)) from pg_class where oid='public.public_verify_throttle'::regclass),
    'columns',(select jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,
      a.attnotnull,a.attidentity,a.attgenerated,a.attacl,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='public.public_verify_throttle'::regclass and a.attnum>0 and not a.attisdropped),
    'indexes',(select jsonb_agg(jsonb_build_array(indexname,indexdef) order by indexname)
      from pg_indexes where schemaname='public' and tablename='public_verify_throttle'),
    'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname)
      from pg_constraint where conrelid='public.public_verify_throttle'::regclass),
    'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
      where schemaname='public' and tablename='public_verify_throttle'),
    'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname)
      from pg_trigger where tgrelid='public.public_verify_throttle'::regclass and not tgisinternal),
    'rows',(select jsonb_agg(to_jsonb(t) order by id) from public.public_verify_throttle t));
$$;
create temporary table before_migration as select pg_temp.table_snapshot() value;
create function pg_temp.catalog_snapshot() returns jsonb language sql as $$
  select jsonb_build_object('table',pg_temp.table_snapshot(),
    'functions',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
      where pronamespace='public'::regnamespace and proname='reserve_public_verify_attempt'));
$$;
\ir ../migrations/0426_public_verify_atomic_reservation.sql
select pg_temp.assert_true((select value from before_migration)=pg_temp.table_snapshot(),
  'Migración conserva filas históricas, columnas, ACL, RLS, índice y triggers');
create temporary table function_snapshot as select to_jsonb(p) value from pg_proc p
  where p.oid='public.reserve_public_verify_attempt(text)'::regprocedure;
\ir ../migrations/0426_public_verify_atomic_reservation.sql
select pg_temp.assert_true((select value from before_migration)=pg_temp.table_snapshot(),
  'Reejecución no altera tabla ni datos');
select pg_temp.assert_true((select value from function_snapshot)=(select to_jsonb(p) from pg_proc p
  where p.oid='public.reserve_public_verify_attempt(text)'::regprocedure),
  'Reejecución conserva función propia exactamente');
select pg_temp.assert_true((select not prosecdef and provolatile='v' and prorettype='boolean'::regtype
  and pronargs=1 and proargnames=array['p_ip'] and 'search_path=""'=any(proconfig)
  from pg_proc where oid='public.reserve_public_verify_attempt(text)'::regprocedure),
  'Firma estable, VOLATILE, SECURITY INVOKER y search_path vacío');
select pg_temp.assert_true(has_function_privilege('service_role','public.reserve_public_verify_attempt(text)','EXECUTE')
  and not has_function_privilege('anon','public.reserve_public_verify_attempt(text)','EXECUTE')
  and not has_function_privilege('authenticated','public.reserve_public_verify_attempt(text)','EXECUTE')
  and not exists(select from pg_proc p cross join lateral aclexplode(p.proacl) a
    where p.oid='public.reserve_public_verify_attempt(text)'::regprocedure and a.grantee=0),
  'EXECUTE sólo service_role y owner; PUBLIC/anon/authenticated revocados');

-- Acceso real: EXECUTE rechazado incluso aunque la tabla tenga GRANT.
do $denied$
declare actor text; blocked boolean; seen bigint;
begin
  foreach actor in array array['anon','authenticated'] loop
    execute format('set local role %I',actor);
    blocked:=false;
    begin perform public.reserve_public_verify_attempt('198.51.100.1');
    exception when insufficient_privilege then blocked:=true; end;
    select count(*) into seen from public.public_verify_throttle;
    execute 'reset role';
    perform pg_temp.assert_true(blocked,actor||': RPC denegada realmente con 42501');
    perform pg_temp.assert_true(seen=0,actor||': RLS sin policies oculta filas pese a SELECT grant');
    execute format('set local role %I',actor);
    blocked:=false;
    begin insert into public.public_verify_throttle(ip) values('198.51.100.1');
    exception when insufficient_privilege then blocked:=true; end;
    execute 'reset role';
    perform pg_temp.assert_true(blocked,actor||': RLS deniega INSERT directo con 42501');
  end loop;
end;
$denied$;

-- INVOKER real: quitar SELECT o INSERT rompe la RPC sin insertar ni elevar rol.
do $invoker$
declare privilege text; blocked boolean; before_rows jsonb;
begin
  foreach privilege in array array['SELECT','INSERT'] loop
    before_rows:=pg_temp.table_snapshot();
    execute format('revoke %s on public.public_verify_throttle from service_role',privilege);
    execute 'set local role service_role';
    blocked:=false;
    begin perform public.reserve_public_verify_attempt('198.51.100.2');
    exception when insufficient_privilege then blocked:=true; end;
    execute 'reset role';
    execute format('grant %s on public.public_verify_throttle to service_role',privilege);
    perform pg_temp.assert_true(blocked,'INVOKER requiere GRANT '||privilege||' real');
    perform pg_temp.assert_true((select count(*)=0 from public.public_verify_throttle where ip='198.51.100.2'),
      'Falta de '||privilege||' no inserta');
    -- El orden textual de relacl puede variar al regrant: las filas son invariantes.
    perform pg_temp.assert_true(before_rows->'rows'=pg_temp.table_snapshot()->'rows',
      'Falta de '||privilege||' preserva históricos');
  end loop;
end;
$invoker$;

set local role service_role;
select pg_temp.assert_true(public.reserve_public_verify_attempt('198.51.100.10'), 'Cupo0 permite primer intento');
select pg_temp.assert_true((select count(*)=1 from public.public_verify_throttle where ip='198.51.100.10'),
  'TRUE corresponde a una fila confirmada');
insert into public.public_verify_throttle(ip) select '198.51.100.39' from generate_series(1,39);
select pg_temp.assert_true(public.reserve_public_verify_attempt('198.51.100.39'), 'Cupo39 permite intento40');
select pg_temp.assert_true(not public.reserve_public_verify_attempt('198.51.100.39'), 'Cupo40 rechaza intento41');
select pg_temp.assert_true((select count(*)=40 from public.public_verify_throttle where ip='198.51.100.39'),
  'Rechazo no agrega fila');
insert into public.public_verify_throttle(ip) select '198.51.100.50' from generate_series(1,50);
select pg_temp.assert_true(not public.reserve_public_verify_attempt('198.51.100.50'), 'Cupo mayor40 heredado rechaza');
insert into public.public_verify_throttle(ip,created_at)
  select '198.51.100.30',clock_timestamp()-interval '31 minutes' from generate_series(1,40);
select pg_temp.assert_true(public.reserve_public_verify_attempt('198.51.100.30'), 'Ventana excluye intentos de31min');
select pg_temp.assert_true((select count(*)=41 from public.public_verify_throttle where ip='198.51.100.30'),
  'La reserva no borra histórico vencido');
insert into public.public_verify_throttle(ip,created_at)
  select '198.51.100.29',clock_timestamp()-interval '29 minutes' from generate_series(1,40);
select pg_temp.assert_true(not public.reserve_public_verify_attempt('198.51.100.29'), 'Ventana incluye intentos de29min');
select pg_temp.assert_true(public.reserve_public_verify_attempt('unknown'), 'unknown conserva bucket explícito');
select pg_temp.assert_true(public.reserve_public_verify_attempt('2001:0DB8:0000:0000:0000:0000:0000:0042'),
  'IPv6 válida sin normalizar');
select pg_temp.assert_true((select count(*)=2 from public.public_verify_throttle
  where ip='2001:0DB8:0000:0000:0000:0000:0000:0042'), 'Texto IPv6 histórico intacto');
select pg_temp.assert_true(public.reserve_public_verify_attempt('::ffff:192.0.2.42'), 'IPv6 con IPv4 embebida válida');
reset role;

do $invalid$
declare ip text; before_count bigint;
begin
  select count(*) into before_count from public.public_verify_throttle;
  execute 'set local role service_role';
  foreach ip in array array[null,'',' ','UNKNOWN','127.1','1.2.3','256.0.0.1','198.51.100.37/32',
    '2001:db8::/64','fe80::1%eth0','[::1]','198.51.100.37,198.51.100.38',' 198.51.100.37',
    '198.51.100.37 ',E'198.51.100.37\n',E'198.51.100.37\t',E'198.51.100.37\r',
    'localhost','198.51.100.37:443',repeat('1',65)] loop
    perform pg_temp.assert_true(public.reserve_public_verify_attempt(ip) is false,
      'Entrada inválida rechazada: '||coalesce(quote_literal(ip),'NULL'));
  end loop;
  execute 'reset role';
  perform pg_temp.assert_true((select count(*) from public.public_verify_throttle)=before_count,
    'Ninguna entrada inválida agrega filas');
end;
$invalid$;

savepoint reserve_rollback;
set local role service_role;
select pg_temp.assert_true(public.reserve_public_verify_attempt('198.51.100.99'), 'Reserva dentro de savepoint');
reset role;
rollback to reserve_rollback;
select pg_temp.assert_true((select count(*)=0 from public.public_verify_throttle where ip='198.51.100.99'),
  'ROLLBACK revierte la reserva confirmada de su transacción');

-- Si el catálogo deriva DESPUÉS de aplicar0426, un INSERT suprimido no puede
-- declararse confirmado. La migración no crea este trigger: sólo el fixture.
savepoint suppressed_insert;
create function pg_temp.suppress_attempt() returns trigger language plpgsql as $$
begin return null; end;
$$;
create trigger suppress_attempt_0426 before insert on public.public_verify_throttle
  for each row execute function pg_temp.suppress_attempt();
do $suppressed$
declare blocked boolean:=false; reserved boolean;
begin
  execute 'set local role service_role';
  begin
    reserved:=public.reserve_public_verify_attempt('198.51.100.98');
  exception when others then blocked:=true; end;
  execute 'reset role';
  if reserved is true or not blocked then
    raise exception 'TEST 0426: INSERT suprimido no puede ser reserva confirmada; debe propagar error';
  end if;
  perform pg_temp.assert_true((select count(*)=0 from public.public_verify_throttle where ip='198.51.100.98'),
    'INSERT suprimido no confirma ni inserta');
end;
$suppressed$;
rollback to suppressed_insert;

-- La migración completa se ejecuta dentro del bloque para comprobar preflight
-- atómico y rollback del drift. No se sustituyen partes de su implementación.
do $drift$
declare drift text; failed boolean; message text; original jsonb; after_drift jsonb;
  migration text:=pg_read_file('/sb/migrations/0426_public_verify_atomic_reservation.sql');
begin
  foreach drift in array array[
    'alter table public.public_verify_throttle disable row level security',
    'create policy drift_0426 on public.public_verify_throttle for select to authenticated using(true)',
    'drop index public.public_verify_throttle_ip_created_idx',
    'alter table public.public_verify_throttle alter column ip drop not null',
    'alter role service_role nobypassrls',
    'alter function public.reserve_public_verify_attempt(text) security definer',
    'alter function public.reserve_public_verify_attempt(text) stable',
    'alter function public.reserve_public_verify_attempt(text) set search_path=public',
    'create or replace function public.reserve_public_verify_attempt(p_ip text) returns boolean language plpgsql as $foreign$ begin return true; end; $foreign$',
    'create function public.reserve_public_verify_attempt(p_ip bigint) returns boolean language sql as $foreign$ select true $foreign$',
    'grant execute on function public.reserve_public_verify_attempt(text) to fixture_0426_extra'
  ] loop
    original:=pg_temp.catalog_snapshot();
    failed:=false;
    begin
      execute drift;
      after_drift:=pg_temp.catalog_snapshot();
      begin
        execute migration;
      exception when others then
        get stacked diagnostics message=message_text;
        if message not like '0426:%' then
          raise exception 'TEST 0426: drift falló fuera de preflight: % / %',sqlstate,message;
        end if;
        failed:=true;
      end;
      if not failed then raise exception 'TEST 0426: preflight aceptó drift: %',drift; end if;
      if after_drift<>pg_temp.catalog_snapshot() then raise exception 'TEST 0426: preflight mutó catálogo ante drift'; end if;
      raise exception using errcode='PT426',message='rollback drift sintético';
    exception when sqlstate 'PT426' then null; end;
    perform pg_temp.assert_true(failed and original=pg_temp.catalog_snapshot(),'Preflight rechaza sin mutar: '||drift);
  end loop;
end;
$drift$;

select count(*) as assertions_0426 from assertions;
rollback;
do $rollback$
begin
  if to_regclass('public.public_verify_throttle') is not null
    or to_regprocedure('public.reserve_public_verify_attempt(text)') is not null then
    raise exception 'TEST 0426: fixture no revertida';
  end if;
end;
$rollback$;
