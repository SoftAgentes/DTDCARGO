\set ON_ERROR_STOP on
-- SDD-0573/I3-B: carrera PG17 local propia, AUTORADA NO EJECUTADA.
-- Requiere dblink y /sb; ausencia es FALLO de precondición, nunca SKIP verde.
-- Patrón0467: S confirma fixture REAL antes de A/B; rollback del coordinador
-- no deshace esos commits. Cleanup sólo objetos marcados propios, sin FORCE.
begin;
set local client_min_messages = notice;
do $guard$
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'I3B carrera requiere PostgreSQL17 local';
  end if;
  if exists(select 1 from pg_database where datname='dtd_carrera_0497_i3b')
     or exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))
     or exists(select 1 from pg_extension where extname='dblink') then
    raise exception 'I3B carrera: objetos previos; no se adoptan ni borran';
  end if;
  if not exists(select 1 from pg_available_extensions where name='dblink') then
    raise exception 'I3B carrera: dependencia dblink NO DISPONIBLE';
  end if;
end;
$guard$;
create extension dblink;
create temporary sequence i3b_assertions;
create temporary table i3b_owner(token text not null);
insert into i3b_owner values('i3b-local-'||md5(clock_timestamp()::text||pg_backend_pid()::text));
create temporary table i3b_results(name text primary key, evidence jsonb not null);

create function pg_temp.ok(p_ok boolean,p_message text) returns void language plpgsql as $f$
begin
  if p_ok is distinct from true then raise exception 'I3B carrera: %',p_message; end if;
  perform nextval('pg_temp.i3b_assertions');
end;
$f$;
create function pg_temp.fid(p_label text) returns uuid language sql immutable as $f$
  select md5('0497-synthetic-'||p_label)::uuid
$f$;
create function pg_temp.rid(p_label text) returns uuid language sql immutable as $f$
  select md5('0497-race-'||p_label)::uuid
$f$;
create function pg_temp.conn(p_db text,p_session text) returns text language sql as $f$
  select format('host=%s port=%s dbname=%s user=%s application_name=i3b_0497_%s',
    split_part(current_setting('unix_socket_directories'),',',1),
    current_setting('port'),p_db,current_user,p_session)
$f$;

-- Sólo región fija /sb/tests/0497 y sus \ir reales, no sustitutos de D2/cierre.
create function pg_temp.fixture() returns text language plpgsql as $fx$
declare
  src text:=pg_read_file('/sb/tests/0497_reverso_al_anular_factura.test.sql');
  start_at integer:=position(E'\nbegin;' in src);
  stop_at integer:=position('-- ── 0. La migración está' in src);
  line text; active boolean:=true; stack boolean[]:='{}'; out_lines text[]:='{}';
  token text:=(select o.token from pg_temp.i3b_owner o);
  result text;
begin
  if start_at=0 or stop_at<=start_at then raise exception 'I3B: región de fixture deriva'; end if;
  foreach line in array string_to_array(substr(src,start_at+length(E'\nbegin;'),
      stop_at-start_at-length(E'\nbegin;')),E'\n')
  loop
    if line ~ '^\\if :apply_fix\s*$' then
      stack:=stack||active; active:=active and true;
    elsif line ~ '^\\else\s*$' then
      if cardinality(stack)=0 then raise exception 'I3B: else sin if'; end if;
      active:=stack[cardinality(stack)] and not active;
    elsif line ~ '^\\endif\s*$' then
      if cardinality(stack)=0 then raise exception 'I3B: endif sin if'; end if;
      active:=stack[cardinality(stack)];stack:=stack[1:cardinality(stack)-1];
    elsif line ~ '^\\ir \.\./migrations/[0-9A-Za-z_]+\.sql\s*$' then
      if active then
        if line=chr(92)||'ir ../migrations/0497_reverso_al_anular_factura.sql' then
          -- F-COB:0467 ENTERA real antes de0497, sólo bootstrap LOCAL TEST.
          -- Este pin de input no sustituye ningún oráculo financiero.
          if md5(pg_read_file('/sb/migrations/0467_cobro_factura_atomico.sql'))
            <> 'e40de959683625eed6368ad5ea05d791' then
            raise exception 'F-COB:0467 completa deriva; no se modifica ni adopta';
          end if;
          out_lines:=out_lines||pg_read_file('/sb/migrations/0467_cobro_factura_atomico.sql');
        end if;
        out_lines:=out_lines||pg_read_file('/sb/migrations/'||
        substring(line from '^\\ir \.\./migrations/([0-9A-Za-z_]+\.sql)')); end if;
    elsif line ~ '^\s*\\' then raise exception 'I3B: metaorden no autorizada %',line;
    elsif active then out_lines:=out_lines||line;
    end if;
  end loop;
  if cardinality(stack)<>0 then raise exception 'I3B: if incompleto'; end if;
  result:='begin; do $own$ begin if exists(select 1 from pg_roles where rolname in '
    ||'(''anon'',''authenticated'',''service_role'')) then raise exception ''I3B roles previos''; end if; end; $own$;'
    ||'create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;'
    ||format('comment on role anon is %L;comment on role authenticated is %L;comment on role service_role is %L;',token,token,token)
    ||array_to_string(out_lines,E'\n')
    ||$ddl$
create function public.i3b_test_try(p_sql text) returns jsonb language plpgsql as $try$
declare result jsonb; state text; message text; hint text; n bigint;
begin
  execute p_sql into result; get diagnostics n=row_count;
  return jsonb_build_object('ok',true,'result',result,'rows',n);
exception when others then
  get stacked diagnostics state=returned_sqlstate,message=message_text,hint=pg_exception_hint;
  return jsonb_build_object('ok',false,'state',state,'message',message,'hint',hint);
end;
$try$;
grant execute on function public.i3b_test_try(text) to authenticated,service_role;
-- Actor SQL con permisos suficientes, no “procedencia RPC”. Ejecuta guardas,
-- constraints, D2 y cierre reales; no sustituye ninguna función de producto.
create function public.i3b_test_construct(p_invoice uuid,p_entry uuid,p_code text)
returns jsonb language plpgsql as $construct$
declare inv public.invoices%rowtype; ar uuid; sales uuid;
begin
  select * into inv from public.invoices where id=p_invoice;
  select id into ar from public.accounts where tenant_id=inv.tenant_id and code='1.1.2';
  select id into sales from public.accounts where tenant_id=inv.tenant_id and code='4.5';
  set constraints public.journal_lines_entry_id_fkey,
    public.i3_journal_entry_final_check,public.i3_invoice_final_check deferred;
  insert into public.journal_lines(entry_id,account_id,debit,credit) values
    (p_entry,ar,100,0),(p_entry,sales,0,100);
  insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)
    values(p_entry,inv.tenant_id,p_code,inv.issued_at,'asentado','invoice',p_invoice,now());
  set constraints public.journal_lines_entry_id_fkey,
    public.i3_journal_entry_final_check,public.i3_invoice_final_check immediate;
  return jsonb_build_object('entry',p_entry);
end;
$construct$;
-- F-RB/F-COB/F-COMMIT: lectores y actor TEST INVOKER, nunca ACL de producto.
-- Arrays crudos separados: ninguna JOIN puede ocultar una cabecera sin líneas.
create function public.i3b_fin_graph(p_invoice uuid) returns jsonb
language sql volatile security invoker set search_path='' as $graph$
  with headers as (
    select e.* from public.journal_entries e
    where e.invoice_id=p_invoice or e.reverses_entry_id in (
      select o.id from public.journal_entries o where o.invoice_id=p_invoice)
  ), receipts as (
    select r.* from public.payment_receipts r where r.invoice_id=p_invoice
  )
  select jsonb_build_object(
    'invoice',(select to_jsonb(i) from public.invoices i where i.id=p_invoice),
    'headers',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from headers h),'[]'::jsonb),
    'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l
      where l.entry_id in(select h.id from headers h)),'[]'::jsonb),
    'originalHeaders',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from headers h
      where h.source='invoice' and h.reverses_entry_id is null),'[]'::jsonb),
    'originalLines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l
      where l.entry_id in(select h.id from headers h where h.source='invoice'
        and h.reverses_entry_id is null)),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from receipts r),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a
      where (a.entity_type='invoice' and a.entity_id=p_invoice)
        or (a.entity_type='journal_entry' and a.entity_id in(select h.id from headers h))
        or (a.entity_type='payment_receipt' and a.entity_id in(select r.id from receipts r))),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.accounts a
      where a.id in(select l.account_id from public.journal_lines l
        where l.entry_id in(select h.id from headers h))),'[]'::jsonb),
    'netByAccount',coalesce((select jsonb_agg(to_jsonb(n) order by n.account_id) from (
      select l.account_id,sum(l.debit-l.credit) as net from public.journal_lines l
      where l.entry_id in(select h.id from headers h) group by l.account_id) n),'[]'::jsonb),
    'orphanLines',coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from public.journal_lines l
      where not exists(select 1 from public.journal_entries e where e.id=l.entry_id)),'[]'::jsonb),
    'orphanHeaders',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.journal_entries e
      where e.source in('invoice','invoice_reversal') and e.invoice_id is not null
        and not exists(select 1 from public.invoices i where i.id=e.invoice_id)),'[]'::jsonb),
    'orphanPostedAudit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a
      where a.entity_type='journal_entry' and a.event_type='journal_entry_posted'
        and not exists(select 1 from public.journal_entries e where e.id=a.entity_id)),'[]'::jsonb),
    'orphanReceiptAudit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.entity_audit_log a
      where a.entity_type='payment_receipt' and a.event_type='payment_registered'
        and not exists(select 1 from public.payment_receipts r where r.id=a.entity_id)),'[]'::jsonb))
$graph$;
revoke all on function public.i3b_fin_graph(uuid) from public,anon,authenticated,service_role;
grant execute on function public.i3b_fin_graph(uuid) to authenticated;

create function public.i3b_fin_void_wait(p_invoice uuid,p_tenant uuid,p_actor uuid,p_other_key integer)
returns jsonb language plpgsql volatile security invoker set search_path='' as $actor$
declare
  before_graph jsonb; after_graph jsonb; stage jsonb; result jsonb;
  did_void boolean; state text; message text; hint text;
begin
  -- VARIABLE fuera de la subunidad: EXCEPTION conserva stage, pero revierte void.
  -- La salida nativa JSON/NOTICE no depende de una tabla víctima del rollback.
  begin
    if current_user<>'authenticated' or auth.uid() is distinct from p_actor
      or public.get_user_tenant_id() is distinct from p_tenant or p_other_key not in(1,2) then
      raise exception 'F-RB: actor/tenant/TEST key inválidos' using errcode='42501';
    end if;
    before_graph:=public.i3b_fin_graph(p_invoice);
    if before_graph->'invoice'->>'tenant_id' is distinct from p_tenant::text
      or before_graph->'invoice'->>'status' is distinct from 'emitida'
      or (before_graph->'invoice'->>'total_amount')::numeric is distinct from 100
      or (before_graph->'invoice'->>'paid_amount')::numeric is distinct from 0
      or jsonb_array_length(before_graph->'originalHeaders')<>1
      or jsonb_array_length(before_graph->'originalLines')<>2
      or jsonb_array_length(before_graph->'receipts')<>0 then
      raise exception 'F-RB: preimagen positiva propia incompleta' using errcode='23514';
    end if;
    did_void:=public.void_invoice_with_audit_reason(p_invoice,'I3B F-RB anulación financiera real');
    after_graph:=public.i3b_fin_graph(p_invoice);
    stage:=jsonb_build_object('stage','after_real_void_before_opposite_TEST_wait',
      'capturedAt',clock_timestamp(),'operation','void_invoice_with_audit_reason',
      'role',current_user,'authUid',auth.uid(),'tenant',public.get_user_tenant_id(),
      'invoiceId',p_invoice,'voidResult',did_void,'before',before_graph,'after',after_graph);
    raise notice 'I3B_F_RB_STAGE_RAW %',stage;
    if did_void is distinct from true or after_graph->'invoice'->>'status' is distinct from 'anulada'
      or jsonb_array_length(after_graph->'headers')<>2
      or jsonb_array_length(after_graph->'lines')<>4
      or after_graph->'originalHeaders' is distinct from before_graph->'originalHeaders'
      or after_graph->'originalLines' is distinct from before_graph->'originalLines' then
      raise exception 'F-RB: void no produjo la etapa financiera completa' using errcode='23514';
    end if;
    -- Claves TEST de dos enteros; no namespace/helper privado de0497.
    perform pg_catalog.pg_advisory_xact_lock(5730497,p_other_key);
    result:=jsonb_build_object('ok',true,'stage',stage,'oppositeTestLockAcquired',p_other_key);
  exception when others then
    get stacked diagnostics state=returned_sqlstate,message=message_text,hint=pg_exception_hint;
    result:=jsonb_build_object('ok',false,'state',state,'message',message,'hint',hint,'stage',stage);
  end;
  raise notice 'I3B_F_RB_ACTOR_RESULT_RAW %',result;
  return result;
end;
$actor$;
revoke all on function public.i3b_fin_void_wait(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.i3b_fin_void_wait(uuid,uuid,uuid,integer) to authenticated;
commit;
$ddl$;
  return result;
end;
$fx$;

create function pg_temp.roles(p_role text) returns text language plpgsql as $f$
begin
  if p_role not in ('postgres','service_role','authenticated') then raise exception 'I3B role fuera de fixture'; end if;
  return format('set local role %I;set local request.jwt.claim.sub=%L;',p_role,
    case when p_role='authenticated' then pg_temp.fid('accounting-A')::text else '' end);
end;
$f$;
create function pg_temp.new_invoice(p_label text) returns uuid language plpgsql as $f$
declare id uuid:=pg_temp.rid(p_label);
begin
  perform dblink_exec('i3b_s',format(
    'insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,iva_amount,total_amount,paid_amount,status,issued_at)'
    ||' values(%L::uuid,%L::uuid,%L,''DTD-I3B'',''Cliente sintético'',''USD'',100,0,100,0,''emitida'',''2026-10-10'')',
    id,pg_temp.fid('tenant-A'),'F-RACE-'||p_label));
  return id;
end;
$f$;
create function pg_temp.post_sql(p_id uuid) returns text language sql as $f$
  select format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',pg_temp.fid('tenant-A'),p_id)
$f$;
create function pg_temp.void_sql(p_id uuid) returns text language sql as $f$
  select format('select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''I3B motivo carrera''))',p_id)
$f$;
create function pg_temp.run(p_connection text,p_sql text) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  select r into result from dblink(p_connection,format('select public.i3b_test_try(%L)',p_sql)) x(r jsonb);
  return result;
end;
$f$;
create function pg_temp.observe(p_id uuid) returns jsonb language plpgsql as $f$
declare result jsonb;
begin
  select r into result from dblink('i3b_s',format($q$
    select jsonb_build_object(
      'status',(select status::text from public.invoices where id=%1$L::uuid),
      'entries',(select count(*) from public.journal_entries where invoice_id=%1$L::uuid),
      'originals',(select count(*) from public.journal_entries where invoice_id=%1$L::uuid and source='invoice'),
      'reversals',(select count(*) from public.journal_entries where invoice_id=%1$L::uuid and source='invoice_reversal'),
      'lines',(select count(*) from public.journal_lines l join public.journal_entries e on e.id=l.entry_id where e.invoice_id=%1$L::uuid),
      'postedEvents',(select count(*) from public.entity_audit_log a join public.journal_entries e on e.id=a.entity_id
        where e.invoice_id=%1$L::uuid and a.event_type='journal_entry_posted'),
      'voidedEvents',(select count(*) from public.entity_audit_log where entity_id=%1$L::uuid and event_type='invoice_voided'),
      'orphans',(select count(*) from public.journal_lines l where not exists(select 1 from public.journal_entries e where e.id=l.entry_id)),
      'pairNet',(select coalesce(sum(abs(n)),0) from (
        select sum(l.debit-l.credit) n from public.journal_lines l join public.journal_entries e on e.id=l.entry_id
        where e.invoice_id=%1$L::uuid group by l.account_id) x))
  $q$,p_id)) x(r jsonb);
  return result;
end;
$f$;
create function pg_temp.start_session(p_connection text,p_role text,p_isolation text default 'read committed')
returns void language plpgsql as $f$
begin
  if p_isolation not in ('read committed','repeatable read','serializable') then raise exception 'I3B aislamiento inválido'; end if;
  perform dblink_exec(p_connection,'begin isolation level '||p_isolation||';'
    ||pg_temp.roles(p_role)||'set local statement_timeout=''15s'';set local lock_timeout=''12s'';');
end;
$f$;
create function pg_temp.wait_for(p_a integer,p_b integer) returns jsonb language plpgsql as $f$
declare deadline timestamptz:=clock_timestamp()+interval '10 seconds'; detail jsonb;
begin
  loop
    if p_a=any(pg_blocking_pids(p_b)) then
      select jsonb_agg(jsonb_build_object('type',locktype,'mode',mode,'granted',granted))
        into detail from pg_locks where pid=p_b and not granted;
      return jsonb_build_object('observedAt',clock_timestamp(),'a',p_a,'b',p_b,'blocking',true,'locks',detail);
    end if;
    if dblink_is_busy('i3b_b')=0 then raise exception 'I3B: B terminó antes de observar espera real'; end if;
    if clock_timestamp()>=deadline then raise exception 'I3B: barrera de servidor agotada'; end if;
    perform pg_sleep(0.01); -- sondeo de condición, no oráculo de carrera
  end loop;
end;
$f$;
create function pg_temp.drain_b() returns jsonb language plpgsql as $f$
declare result jsonb; terminal integer;
begin
  select r into result from dblink_get_result('i3b_b',false) x(r jsonb);
  if result is null then
    raise exception 'I3B: resultado nativo B ausente: %',dblink_error_message('i3b_b');
  end if;
  select count(*) into terminal from dblink_get_result('i3b_b',false) x(r jsonb);
  if terminal<>0 then raise exception 'I3B: resultado B no drenado'; end if;
  return result;
end;
$f$;

-- A conserva TX abierta; B sólo una SELECT asíncrona, commit explícito separado.
create function pg_temp.race(p_name text,p_a_sql text,p_b_sql text,p_a_commit boolean default true,
  p_a_role text default 'service_role',p_b_role text default 'service_role',p_a_after text default null,
  p_defer_a boolean default false)
returns jsonb language plpgsql as $f$
declare a jsonb; b jsonb; barrier jsonb; after_result jsonb; pid_a integer; pid_b integer; commit_b text;
begin
  perform pg_temp.start_session('i3b_a',p_a_role);
  perform pg_temp.start_session('i3b_b',p_b_role);
  if p_defer_a then
    perform dblink_exec('i3b_a','set constraints public.journal_lines_entry_id_fkey,'
      ||'public.i3_journal_entry_final_check,public.i3_invoice_final_check deferred');
  end if;
  select pid into pid_a from dblink('i3b_a','select pg_backend_pid()') x(pid integer);
  select pid into pid_b from dblink('i3b_b','select pg_backend_pid()') x(pid integer);
  a:=pg_temp.run('i3b_a',p_a_sql);
  perform pg_temp.ok((a->>'ok')::boolean,'A alcanza pausa: '||p_name);
  perform pg_temp.ok(dblink_send_query('i3b_b',format('select public.i3b_test_try(%L)',p_b_sql))=1,'envío B');
  barrier:=pg_temp.wait_for(pid_a,pid_b);
  if p_a_after is not null then
    after_result:=pg_temp.run('i3b_a',p_a_after);
    perform pg_temp.ok((after_result->>'ok')::boolean,'A completa construcción: '||p_name);
  end if;
  perform dblink_exec('i3b_a',case when p_a_commit then 'commit' else 'rollback' end);
  b:=pg_temp.drain_b();
  commit_b:=dblink_exec('i3b_b','commit',false);
  perform pg_temp.ok(commit_b='COMMIT','COMMIT B real: '||p_name);
  insert into pg_temp.i3b_results values(p_name,jsonb_build_object(
    'a',a,'b',b,'aCommit',p_a_commit,'bCommit',commit_b,'barrier',barrier));
  return b;
end;
$f$;
create function pg_temp.recover() returns text language plpgsql as $f$
declare problem text:=''; conn text;
begin
  if 'i3b_b'=any(coalesce(dblink_get_connections(),'{}')) then
    begin
      if dblink_is_busy('i3b_b')=1 then perform dblink_cancel_query('i3b_b'); end if;
      perform * from dblink_get_result('i3b_b',false) x(r jsonb);
      perform * from dblink_get_result('i3b_b',false) x(r jsonb);
    exception when others then problem:=problem||'drain:'||sqlerrm||';'; end;
  end if;
  foreach conn in array array['i3b_a','i3b_b','i3b_c'] loop
    if conn=any(coalesce(dblink_get_connections(),'{}')) then
      begin perform dblink_exec(conn,'rollback',false);
      exception when others then problem:=problem||conn||':'||sqlerrm||';'; end;
    end if;
  end loop;
  return nullif(problem,'');
end;
$f$;
create function pg_temp.cleanup() returns text language plpgsql as $f$
declare conn text; token text:=(select o.token from pg_temp.i3b_owner o); problem text:=''; r record;
begin
  problem:=coalesce(pg_temp.recover(),'');
  foreach conn in array array['i3b_a','i3b_b','i3b_c','i3b_s'] loop
    if conn=any(coalesce(dblink_get_connections(),'{}')) then
      begin perform dblink_disconnect(conn);
      exception when others then problem:=problem||conn||':'||sqlerrm||';'; end;
    end if;
  end loop;
  if exists(select 1 from pg_database where datname='dtd_carrera_0497_i3b') then
    if not exists(select 1 from pg_database d where d.datname='dtd_carrera_0497_i3b'
      and d.datdba=current_user::regrole and shobj_description(d.oid,'pg_database')=token) then
      return problem||'DB sin marca propia; conservada;';
    end if;
    begin
      -- Sin FORCE: un consumidor inesperado deja evidencia y falla cleanup.
      perform dblink_exec(pg_temp.conn('postgres','cleanup'),'drop database dtd_carrera_0497_i3b');
    exception when others then return problem||'DB:'||sqlerrm||';'; end;
  end if;
  for r in select oid,rolname from pg_roles where rolname in ('anon','authenticated','service_role') loop
    if shobj_description(r.oid,'pg_authid') is distinct from token then
      problem:=problem||r.rolname||' sin marca propia; conservado;';
    else
      begin perform dblink_exec(pg_temp.conn('postgres','cleanup'),format('drop role %I',r.rolname));
      exception when others then problem:=problem||r.rolname||':'||sqlerrm||';'; end;
    end if;
  end loop;
  return nullif(problem,'');
end;
$f$;

-- Suplemento financiero: helpers nuevos; R01-R18 y sus helpers quedan literales.
create function pg_temp.fin_start(p_conn text,p_role text,p_actor uuid default null)
returns jsonb language plpgsql as $f$
declare channel jsonb;
begin
  if p_conn not in('i3b_a','i3b_b') or p_role not in('authenticated','service_role','postgres')
    or (p_role='authenticated' and p_actor not in(pg_temp.fid('accounting-A'),pg_temp.fid('accounting-B')))
    or (p_role='authenticated' and p_actor is null) then raise exception 'F: canal/actor TEST inválido'; end if;
  perform pg_temp.ok(dblink_exec(p_conn,'begin isolation level read committed;'
    ||format('set local role %I;set local request.jwt.claim.sub=%L;',p_role,coalesce(p_actor::text,''))
    ||'set local statement_timeout=''15s'';set local lock_timeout=''12s'';')='SET','F inicio RC/canal real');
  select x.r into channel from dblink(p_conn,
    'select jsonb_build_object(''role'',current_user,''authUid'',auth.uid(),''tenant'',public.get_user_tenant_id(),'
    ||'''isolation'',current_setting(''transaction_isolation''))') x(r jsonb);
  raise notice 'I3B_FIN_CHANNEL_RAW %',jsonb_build_object('connection',p_conn,'channel',channel);
  perform pg_temp.ok(channel->>'role'=p_role and channel->>'isolation'='read committed'
    and channel->>'authUid' is not distinct from p_actor::text,'F canal/actor/RC observados dentro de sesión real');
  return channel;
end;
$f$;
create function pg_temp.fin_graph(p_conn text,p_invoice uuid) returns jsonb language plpgsql as $f$
declare value jsonb;
begin
  select x.r into value from dblink(p_conn,format('select public.i3b_fin_graph(%L::uuid)',p_invoice)) x(r jsonb);
  if value is null then raise exception 'F: snapshot completo ausente'; end if;
  return value;
end;
$f$;
create function pg_temp.fin_no_orphans(p_graph jsonb) returns boolean language sql as $f$
  select coalesce(p_graph->'orphanLines'='[]'::jsonb and p_graph->'orphanHeaders'='[]'::jsonb
    and p_graph->'orphanPostedAudit'='[]'::jsonb and p_graph->'orphanReceiptAudit'='[]'::jsonb,false)
$f$;
create function pg_temp.fin_graph_valid(p_graph jsonb,p_sale boolean,p_reverse boolean,
  p_paid numeric,p_receipts integer) returns boolean language sql as $f$
  select coalesce(
    p_graph->'invoice'->>'id' is not null and p_graph->'invoice'->>'currency'='USD'
    and (p_graph->'invoice'->>'base_amount')::numeric=100
    and (p_graph->'invoice'->>'iva_amount')::numeric=0
    and (p_graph->'invoice'->>'total_amount')::numeric=100
    and (p_graph->'invoice'->>'paid_amount')::numeric=p_paid
    and p_graph->'invoice'->>'status'=case when p_reverse then 'anulada'
      when p_paid=100 then 'pagada' when p_paid>0 then 'parcial' else 'emitida' end
    and p_graph->'invoice'->>'deleted_at' is null
    and jsonb_array_length(p_graph->'headers')=case when p_sale then 1 else 0 end+case when p_reverse then 1 else 0 end
    and jsonb_array_length(p_graph->'lines')=case when p_sale then 2 else 0 end+case when p_reverse then 2 else 0 end
    and jsonb_array_length(p_graph->'originalHeaders')=case when p_sale then 1 else 0 end
    and jsonb_array_length(p_graph->'originalLines')=case when p_sale then 2 else 0 end
    and jsonb_array_length(p_graph->'accounts')=case when p_sale then 2 else 0 end
    and not exists(select 1 from jsonb_array_elements(p_graph->'accounts') a where
      a->>'tenant_id' is distinct from p_graph->'invoice'->>'tenant_id'
      or a->>'is_postable' is distinct from 'true')
    and not exists(select 1 from jsonb_array_elements(p_graph->'headers') h where
      h->>'status'<>'asentado' or h->>'deleted_at' is not null or h->>'posted_at' is null
      or h->>'tenant_id' is distinct from p_graph->'invoice'->>'tenant_id'
      or h->>'invoice_id' is distinct from p_graph->'invoice'->>'id')
    and (not p_sale or (
      (select sum((l->>'debit')::numeric) from jsonb_array_elements(p_graph->'originalLines') l)=100
      and (select sum((l->>'credit')::numeric) from jsonb_array_elements(p_graph->'originalLines') l)=100
      and (select sum((l->>'debit')::numeric-(l->>'credit')::numeric)
        from jsonb_array_elements(p_graph->'originalLines') l where l->>'account_id' in(
          select a->>'id' from jsonb_array_elements(p_graph->'accounts') a where a->>'code'='1.1.2'))=100
      and (select sum((l->>'credit')::numeric-(l->>'debit')::numeric)
        from jsonb_array_elements(p_graph->'originalLines') l where l->>'account_id' in(
          select a->>'id' from jsonb_array_elements(p_graph->'accounts') a where a->>'code'='4.5'))=100))
    and (not p_reverse or (p_sale and jsonb_array_length(p_graph->'netByAccount')=2
      and not exists(select 1 from jsonb_array_elements(p_graph->'netByAccount') n where (n->>'net')::numeric<>0)
      and (select count(*) from jsonb_array_elements(p_graph->'headers') h where h->>'source'='invoice_reversal'
        and h->>'reverses_entry_id'=p_graph->'originalHeaders'->0->>'id')=1))
    and jsonb_array_length(p_graph->'receipts')=p_receipts
    and coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(p_graph->'receipts') r),0)=p_paid
    and not exists(select 1 from jsonb_array_elements(p_graph->'receipts') r where
      r->>'deleted_at' is not null or r->>'application_status'<>'aplicado'
      or r->>'tenant_id' is distinct from p_graph->'invoice'->>'tenant_id'
      or r->>'invoice_id' is distinct from p_graph->'invoice'->>'id'
      or r->>'cash_account_id' is distinct from pg_temp.fid('caja')::text
      or r->>'currency' is distinct from 'USD')
    and (select count(*) from jsonb_array_elements(p_graph->'audit') a where a->>'event_type'='journal_entry_posted')
      =case when p_sale then 1 else 0 end+case when p_reverse then 1 else 0 end
    and (select count(*) from jsonb_array_elements(p_graph->'audit') a where a->>'event_type'='invoice_voided')
      =case when p_reverse then 1 else 0 end
    and (select count(*) from jsonb_array_elements(p_graph->'audit') a where
      a->>'entity_type'='payment_receipt' and a->>'event_type'='payment_registered')=p_receipts
    and (select count(*) from jsonb_array_elements(p_graph->'audit') a where
      a->>'entity_type'='invoice' and a->>'event_type'='invoice_payment_registered')=p_receipts
    and (select count(*) from jsonb_array_elements(p_graph->'audit') a where
      a->>'entity_type'='invoice' and a->>'event_type'='invoice_emitted')=1
    and jsonb_array_length(p_graph->'audit')=1+case when p_sale then 1 else 0 end
      +case when p_reverse then 2 else 0 end+2*p_receipts
    and pg_temp.fin_no_orphans(p_graph),false)
$f$;
create function pg_temp.fin_new_invoice(p_label text,p_tenant uuid) returns uuid language plpgsql as $f$
declare id uuid:=pg_temp.rid('finance-'||p_label); graph jsonb;
begin
  if p_tenant not in(pg_temp.fid('tenant-A'),pg_temp.fid('tenant-B')) then raise exception 'F: tenant no propio'; end if;
  perform pg_temp.ok(dblink_exec('i3b_s',format(
    'insert into public.invoices(id,tenant_id,invoice_code,client_markbox,client_name,currency,base_amount,iva_amount,total_amount,paid_amount,status,issued_at)'
    ||' values(%L::uuid,%L::uuid,%L,''DTD-FIN-TEST'',''Cliente sintético'',''USD'',100,0,100,0,''emitida'',''2026-10-10'')',
    id,p_tenant,'F-FIN-'||p_label))='INSERT 0 1','F factura fresca confirmada');
  graph:=pg_temp.fin_graph('i3b_s',id);
  raise notice 'I3B_FIN_NEW_INVOICE_RAW %',graph;
  perform pg_temp.ok(pg_temp.fin_graph_valid(graph,false,false,0,0),'F preimagen nueva positiva sin venta/cobro');
  return id;
end;
$f$;
create function pg_temp.fin_post_sql(p_invoice uuid,p_tenant uuid) returns text language sql as $f$
  select format('select public.post_invoice_journal_entry_atomic(%L::uuid,%L::uuid)',p_tenant,p_invoice)
$f$;
create function pg_temp.fin_receipt_sql(p_invoice uuid,p_amount numeric) returns text language sql as $f$
  select format('select public.register_collection_receipt(%L::uuid,%s,%L::uuid,''transferencia'',''2026-10-10'',%L,null,''cliente'',null,null,true)',
    p_invoice,p_amount,pg_temp.fid('caja'),'F-COB TEST '||p_amount::text)
$f$;
create function pg_temp.fin_seed_sale(p_invoice uuid,p_tenant uuid) returns jsonb language plpgsql as $f$
declare value jsonb; committed text; graph jsonb;
begin
  perform pg_temp.fin_start('i3b_a','service_role');
  value:=pg_temp.run('i3b_a',pg_temp.fin_post_sql(p_invoice,p_tenant));
  perform pg_temp.ok(value->'result'->>'outcome'='posted','F semilla posting REAL posted, no already_posted');
  committed:=dblink_exec('i3b_a','commit',false);
  perform pg_temp.ok(committed='COMMIT','F original COMMIT literal');
  graph:=pg_temp.fin_graph('i3b_s',p_invoice);
  raise notice 'I3B_FIN_SEED_SALE_RAW %',jsonb_build_object('rpc',value,'commit',committed,'graph',graph);
  perform pg_temp.ok(pg_temp.fin_graph_valid(graph,true,false,0,0),'F original íntegro100/100 y D2 confirmado');
  return graph;
end;
$f$;
create function pg_temp.fin_drain(p_conn text) returns jsonb language plpgsql as $f$
declare rows_raw jsonb; terminal_raw jsonb; row_count bigint; terminal_count bigint; value jsonb;
begin
  if p_conn not in('i3b_a','i3b_b') then raise exception 'F: drain fuera de sesiones propias'; end if;
  select jsonb_agg(x.r),count(*) into rows_raw,row_count from dblink_get_result(p_conn,false) x(r jsonb);
  -- Llamada VACÍA adicional antes de volver a usar la conexión: PG17 dblink.
  select jsonb_agg(x.r),count(*) into terminal_raw,terminal_count from dblink_get_result(p_conn,false) x(r jsonb);
  value:=jsonb_build_object('connection',p_conn,'rows',rows_raw,'rowCount',row_count,
    'terminalRows',terminal_raw,'terminalCount',terminal_count,'result',rows_raw->0);
  raise notice 'I3B_FIN_DRAIN_RAW %',value;
  perform pg_temp.ok(row_count=1 and terminal_count=0,'F respuesta única y vacía final drenadas');
  return value;
end;
$f$;
create function pg_temp.fin_recover() returns text language plpgsql as $f$
declare conn text; problem text:=''; n bigint; step integer; until_at timestamptz;
begin
  -- Cancelar ambas consultas propias ANTES de drenar evita esperar al otro lock.
  foreach conn in array array['i3b_a','i3b_b'] loop
    if conn=any(coalesce(dblink_get_connections(),'{}')) then
      begin
        if dblink_is_busy(conn)=1 then perform dblink_cancel_query(conn); end if;
      exception when others then problem:=problem||conn||':cancel:'||sqlerrm||';'; end;
    end if;
  end loop;
  foreach conn in array array['i3b_a','i3b_b'] loop
    if conn=any(coalesce(dblink_get_connections(),'{}')) then
      begin
        until_at:=clock_timestamp()+interval '5 seconds';
        while dblink_is_busy(conn)=1 loop
          if clock_timestamp()>=until_at then raise exception 'F cleanup busy agotado'; end if;
          perform pg_sleep(0.01);
        end loop;
        step:=0;
        loop
          select count(*) into n from dblink_get_result(conn,false) x(r jsonb);
          step:=step+1;
          exit when n=0 and step>=2;
          if clock_timestamp()>=until_at then raise exception 'F cleanup drain agotado'; end if;
        end loop;
        perform dblink_exec(conn,'rollback',false);
      exception when others then problem:=problem||conn||':drain/rollback:'||sqlerrm||';'; end;
    end if;
  end loop;
  return nullif(problem,'');
end;
$f$;

create function pg_temp.fin_wait_test_edge(p_holder integer,p_waiter integer,p_key integer,p_conn text)
returns jsonb language plpgsql as $f$
declare until_at timestamptz:=clock_timestamp()+interval '10 seconds'; value jsonb;
begin
  loop
    select x.r into value from dblink('i3b_s',format($q$
      select jsonb_build_object('observedAt',clock_timestamp(),'holder',%1$s,'waiter',%2$s,
        'testNamespace',5730497,'testKey',%3$s,'blockingPids',to_jsonb(pg_blocking_pids(%2$s)),
        'waiting',%1$s=any(pg_blocking_pids(%2$s)) and exists(select 1 from pg_locks l
          where l.pid=%2$s and l.locktype='advisory' and l.classid=5730497::oid
            and l.objid=%3$s::oid and l.objsubid=2 and not l.granted),
        'locks',(select jsonb_agg(to_jsonb(l)) from pg_locks l where l.pid in(%1$s,%2$s)
          and l.locktype='advisory' and l.classid=5730497::oid and l.objsubid=2))
    $q$,p_holder,p_waiter,p_key)) x(r jsonb);
    if value->>'waiting'='true' then return value; end if;
    if dblink_is_busy(p_conn)=0 then raise exception 'F-RB: actor terminó antes de espera TEST nominal'; end if;
    if clock_timestamp()>=until_at then raise exception 'F-RB: barrera TEST nominal agotada'; end if;
    perform pg_sleep(0.01); -- sólo sondeo de esa condición real, nunca barrera por tiempo.
  end loop;
end;
$f$;
create function pg_temp.fin_wait_test_cycle(p_a integer,p_b integer) returns jsonb language plpgsql as $f$
declare until_at timestamptz:=clock_timestamp()+interval '10 seconds'; value jsonb;
begin
  loop
    select x.r into value from dblink('i3b_s',format($q$
      select jsonb_build_object('observedAt',clock_timestamp(),'a',%1$s,'b',%2$s,
        'aBlocking',to_jsonb(pg_blocking_pids(%1$s)),'bBlocking',to_jsonb(pg_blocking_pids(%2$s)),
        'cycle',%2$s=any(pg_blocking_pids(%1$s)) and %1$s=any(pg_blocking_pids(%2$s))
          and exists(select 1 from pg_locks l where l.pid=%1$s and l.locktype='advisory'
            and l.classid=5730497::oid and l.objid=2::oid and l.objsubid=2 and not l.granted)
          and exists(select 1 from pg_locks l where l.pid=%2$s and l.locktype='advisory'
            and l.classid=5730497::oid and l.objid=1::oid and l.objsubid=2 and not l.granted),
        'locks',(select jsonb_agg(to_jsonb(l)) from pg_locks l where l.pid in(%1$s,%2$s)
          and l.locktype='advisory' and l.classid=5730497::oid and l.objsubid=2))
    $q$,p_a,p_b)) x(r jsonb);
    if value->>'cycle'='true' then return value; end if;
    if dblink_is_busy('i3b_a')=0 or dblink_is_busy('i3b_b')=0 then
      raise exception 'F-RB: ciclo TEST no observado antes del resultado';
    end if;
    if clock_timestamp()>=until_at then raise exception 'F-RB: ciclo TEST agotado'; end if;
    perform pg_sleep(0.01);
  end loop;
end;
$f$;
create function pg_temp.fin_wait_invoice(p_a integer,p_b integer,p_invoice uuid)
returns jsonb language plpgsql as $f$
declare until_at timestamptz:=clock_timestamp()+interval '10 seconds'; value jsonb;
begin
  loop
    -- Las tres RPC reales toman primero ESTA factura FOR UPDATE. Se conserva
    -- query exacta con ID y espera transactionid deB contra el TX real deA.
    select x.r into value from dblink('i3b_s',format($q$
      select jsonb_build_object('observedAt',clock_timestamp(),'invoice',%3$L::uuid,'a',%1$s,'b',%2$s,
        'blockingPids',to_jsonb(pg_blocking_pids(%2$s)),
        'query',(select query from pg_stat_activity where pid=%2$s),
        'waitingInvoiceTx',%1$s=any(pg_blocking_pids(%2$s))
          and exists(select 1 from pg_stat_activity where pid=%2$s and wait_event_type='Lock'
            and position(%3$L in query)>0)
          and exists(select 1 from pg_locks w join pg_locks h on h.transactionid=w.transactionid
            where w.pid=%2$s and h.pid=%1$s and w.locktype='transactionid' and h.locktype='transactionid'
              and not w.granted and h.granted and h.mode='ExclusiveLock')
          and exists(select 1 from pg_locks l where l.pid=%2$s and l.relation='public.invoices'::regclass
            and l.locktype='relation' and l.granted),
        'locks',(select jsonb_agg(to_jsonb(l)) from pg_locks l where l.pid in(%1$s,%2$s)))
    $q$,p_a,p_b,p_invoice::text)) x(r jsonb);
    if value->>'waitingInvoiceTx'='true' then return value; end if;
    if dblink_is_busy('i3b_b')=0 then raise exception 'F-COB: B terminó sin bloqueo de factura observado'; end if;
    if clock_timestamp()>=until_at then raise exception 'F-COB: espera de factura agotada'; end if;
    perform pg_sleep(0.01);
  end loop;
end;
$f$;
create function pg_temp.fin_race(p_name text,p_invoice uuid,p_a_sql text,p_b_sql text,
  p_a_role text,p_b_role text) returns jsonb language plpgsql as $f$
declare a jsonb; b jsonb; before_graph jsonb; first_graph jsonb; final_graph jsonb;
  barrier jsonb; drain jsonb; a_commit text; b_commit text; pid_a integer; pid_b integer;
  cleanup_error text; value jsonb; channel_a jsonb; channel_b jsonb;
begin
  before_graph:=pg_temp.fin_graph('i3b_s',p_invoice);
  channel_a:=pg_temp.fin_start('i3b_a',p_a_role,case when p_a_role='authenticated' then pg_temp.fid('accounting-A') end);
  channel_b:=pg_temp.fin_start('i3b_b',p_b_role,case when p_b_role='authenticated' then pg_temp.fid('accounting-A') end);
  select x.pid into pid_a from dblink('i3b_a','select pg_backend_pid()') x(pid integer);
  select x.pid into pid_b from dblink('i3b_b','select pg_backend_pid()') x(pid integer);
  a:=pg_temp.run('i3b_a',p_a_sql);
  perform pg_temp.ok(a->>'ok'='true','F-COB primera operación financiera real alcanza pausa: '||p_name);
  perform pg_temp.ok(dblink_send_query('i3b_b',format('select public.i3b_test_try(%L)',p_b_sql))=1,'F-COB envío B: '||p_name);
  barrier:=pg_temp.fin_wait_invoice(pid_a,pid_b,p_invoice);
  raise notice 'I3B_F_COB_WAIT_RAW %',jsonb_build_object('name',p_name,'a',a,'barrier',barrier);
  a_commit:=dblink_exec('i3b_a','commit',false);
  perform pg_temp.ok(a_commit='COMMIT','F-COB COMMIT A literal: '||p_name);
  -- B conserva SU outer sin confirmar. S ve únicamente la etapa confirmada A;
  -- no se concede SELECT nuevo a service_role ni se observa no confirmado.
  first_graph:=pg_temp.fin_graph('i3b_s',p_invoice);
  raise notice 'I3B_F_COB_FIRST_COMMIT_RAW %',jsonb_build_object('name',p_name,'commit',a_commit,'graph',first_graph);
  drain:=pg_temp.fin_drain('i3b_b');b:=drain->'result';
  b_commit:=dblink_exec('i3b_b','commit',false);
  perform pg_temp.ok(b_commit='COMMIT','F-COB COMMIT B literal: '||p_name);
  final_graph:=pg_temp.fin_graph('i3b_s',p_invoice);
  value:=jsonb_build_object('a',a,'b',b,'before',before_graph,'afterFirstCommit',first_graph,
    'final',final_graph,'aRole',p_a_role,'bRole',p_b_role,'aCommit',a_commit,'bCommit',b_commit,
    'channelA',channel_a,'channelB',channel_b,'barrier',barrier,'drain',drain,'cashJavaScriptCovered',false);
  raise notice 'I3B_F_COB_RAW %',jsonb_build_object('name',p_name,'evidence',value);
  return value;
exception when query_canceled or assert_failure then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-COB cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
when others then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-COB cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
end;
$f$;

create function pg_temp.fin_stage_valid(p_stage jsonb,p_before jsonb,p_tenant uuid,p_actor uuid)
returns boolean language sql as $f$
  select coalesce(p_stage->>'stage'='after_real_void_before_opposite_TEST_wait'
    and p_stage->>'operation'='void_invoice_with_audit_reason' and p_stage->>'voidResult'='true'
    and p_stage->>'role'='authenticated' and p_stage->>'tenant'=p_tenant::text
    and p_stage->>'authUid'=p_actor::text and p_stage->>'invoiceId'=p_before->'invoice'->>'id'
    and p_stage->'before'=p_before
    and p_stage->'after'->'invoice'->>'id'=p_before->'invoice'->>'id'
    and pg_temp.fin_graph_valid(p_stage->'after',true,true,0,0)
    and p_stage->'after'->'originalHeaders'=p_before->'originalHeaders'
    and p_stage->'after'->'originalLines'=p_before->'originalLines'
    and (p_stage->'after'->'audit') @> (p_before->'audit'),false)
$f$;
create function pg_temp.fin_rollback_case() returns void language plpgsql as $f$
declare
  id_a uuid; id_b uuid; pid_a integer; pid_b integer; before_a jsonb; before_b jsonb;
  edge jsonb; cycle jsonb; drain_victim jsonb; drain_survivor jsonb; result_a jsonb; result_b jsonb;
  after_a jsonb; after_b jsonb; victim text; survivor text; victim_commit text; survivor_commit text;
  until_at timestamptz; cleanup_error text; evidence jsonb; channel_a jsonb; channel_b jsonb;
begin
  -- El accounting-B ya existe en el fixture: NO se duplica membresía/identidad.
  perform pg_temp.ok((select x.n=1 from dblink('i3b_s',format(
    'select count(*)::integer from public.user_tenants where user_id=%L::uuid and disabled_at is null'
    ||' having bool_and(tenant_id=%L::uuid and role=''accounting'')',pg_temp.fid('accounting-B'),pg_temp.fid('tenant-B'))) x(n integer)),
    'F-RB accounting-B tiene su única membresía activa propia');
  perform pg_temp.ok(dblink_exec('i3b_s',format(
    'insert into public.accounts(id,tenant_id,code,name,type,is_postable) values'
    ||'(%L::uuid,%L::uuid,''1.1.2'',''F-RB clientes B'',''A'',true),'
    ||'(%L::uuid,%L::uuid,''4.5'',''F-RB ventas B'',''I'',true),'
    ||'(%L::uuid,%L::uuid,''2.1.5'',''F-RB IVA B'',''P'',true),'
    ||'(%L::uuid,%L::uuid,''1.1.1.1'',''F-RB caja B'',''A'',true)',
    pg_temp.rid('fin-B-clientes'),pg_temp.fid('tenant-B'),pg_temp.rid('fin-B-ventas'),pg_temp.fid('tenant-B'),
    pg_temp.rid('fin-B-iva'),pg_temp.fid('tenant-B'),pg_temp.rid('fin-B-caja'),pg_temp.fid('tenant-B')))
    ='INSERT 0 4','F-RB soporte nominal B confirmado, sin ampliar ACL');
  id_a:=pg_temp.fin_new_invoice('rb-a',pg_temp.fid('tenant-A'));
  id_b:=pg_temp.fin_new_invoice('rb-b',pg_temp.fid('tenant-B'));
  before_a:=pg_temp.fin_seed_sale(id_a,pg_temp.fid('tenant-A'));
  before_b:=pg_temp.fin_seed_sale(id_b,pg_temp.fid('tenant-B'));
  channel_a:=pg_temp.fin_start('i3b_a','authenticated',pg_temp.fid('accounting-A'));
  channel_b:=pg_temp.fin_start('i3b_b','authenticated',pg_temp.fid('accounting-B'));
  -- Iniciales TEST en OUTER; void y espera contraria estarán en la MISMA subunidad.
  perform pg_temp.ok(dblink_exec('i3b_a','do $test_mutex$ begin perform pg_catalog.pg_advisory_xact_lock(5730497,1); end; $test_mutex$')='DO','F-RB outer A conserva TEST1');
  perform pg_temp.ok(dblink_exec('i3b_b','do $test_mutex$ begin perform pg_catalog.pg_advisory_xact_lock(5730497,2); end; $test_mutex$')='DO','F-RB outer B conserva TEST2');
  select x.pid into pid_a from dblink('i3b_a','select pg_backend_pid()') x(pid integer);
  select x.pid into pid_b from dblink('i3b_b','select pg_backend_pid()') x(pid integer);
  perform pg_temp.ok(dblink_send_query('i3b_a',format(
    'select public.i3b_fin_void_wait(%L::uuid,%L::uuid,%L::uuid,2)',id_a,pg_temp.fid('tenant-A'),pg_temp.fid('accounting-A')))=1,'F-RB envío void A real');
  edge:=pg_temp.fin_wait_test_edge(pid_b,pid_a,2,'i3b_a');
  perform pg_temp.ok(dblink_send_query('i3b_b',format(
    'select public.i3b_fin_void_wait(%L::uuid,%L::uuid,%L::uuid,1)',id_b,pg_temp.fid('tenant-B'),pg_temp.fid('accounting-B')))=1,'F-RB envío void B real');
  cycle:=pg_temp.fin_wait_test_cycle(pid_a,pid_b);
  raise notice 'I3B_F_RB_BARRIERS_RAW %',jsonb_build_object('edge',edge,'cycle',cycle);
  until_at:=clock_timestamp()+interval '10 seconds';
  while dblink_is_busy('i3b_a')=1 and dblink_is_busy('i3b_b')=1 loop
    if clock_timestamp()>=until_at then raise exception 'F-RB: servidor no resolvió el ciclo TEST'; end if;
    perform pg_sleep(0.01);
  end loop;
  if dblink_is_busy('i3b_a')=0 then victim:='i3b_a';survivor:='i3b_b';
  else victim:='i3b_b';survivor:='i3b_a';end if;
  perform pg_temp.ok(dblink_is_busy(survivor)=1,'F-RB superviviente sigue esperando lock OUTER de víctima');
  drain_victim:=pg_temp.fin_drain(victim);
  perform pg_temp.ok(drain_victim->'result'->>'ok'='false' and drain_victim->'result'->>'state'='40P01',
    'F-RB víctima nativa40P01 identificada por resultado, no por actor supuesto');
  -- La vacía final YA ocurrió. COMMIT real libera el lock outer ANTES de drenar al otro.
  victim_commit:=dblink_exec(victim,'commit',false);
  perform pg_temp.ok(victim_commit='COMMIT','F-RB COMMIT exterior víctima literalCOMMIT');
  drain_survivor:=pg_temp.fin_drain(survivor);
  perform pg_temp.ok(drain_survivor->'result'->>'ok'='true','F-RB superviviente resultado financiero exitoso');
  survivor_commit:=dblink_exec(survivor,'commit',false);
  perform pg_temp.ok(survivor_commit='COMMIT','F-RB COMMIT exterior superviviente literalCOMMIT');
  result_a:=case when victim='i3b_a' then drain_victim->'result' else drain_survivor->'result' end;
  result_b:=case when victim='i3b_b' then drain_victim->'result' else drain_survivor->'result' end;
  after_a:=pg_temp.fin_graph('i3b_s',id_a);after_b:=pg_temp.fin_graph('i3b_s',id_b);
  evidence:=jsonb_build_object('a',result_a,'b',result_b,'victim',victim,'survivor',survivor,
    'victimDrain',drain_victim,'survivorDrain',drain_survivor,'victimCommit',victim_commit,
    'survivorCommit',survivor_commit,'beforeA',before_a,'beforeB',before_b,
    'afterA',after_a,'afterB',after_b,'channelA',channel_a,'channelB',channel_b,
    'edge',edge,'cycle',cycle,'spontaneousProductDeadlockClaimed',false);
  raise notice 'I3B_F_RB_FINAL_RAW %',evidence;
  perform pg_temp.ok(pg_temp.fin_stage_valid(result_a->'stage',before_a,pg_temp.fid('tenant-A'),pg_temp.fid('accounting-A')),
    'F-RB etapa positiva A completa/propia antes del mutex contrario, conservada fuera rollback');
  perform pg_temp.ok(pg_temp.fin_stage_valid(result_b->'stage',before_b,pg_temp.fid('tenant-B'),pg_temp.fid('accounting-B')),
    'F-RB etapa positiva B completa/propia antes del mutex contrario, conservada fuera rollback');
  if victim='i3b_a' then
    perform pg_temp.ok(after_a=before_a and after_b=result_b->'stage'->'after','F-RB víctima A restaura grafo/auditoría ENTEROS; B conserva único par100');
  else
    perform pg_temp.ok(after_b=before_b and after_a=result_a->'stage'->'after','F-RB víctima B restaura grafo/auditoría ENTEROS; A conserva único par100');
  end if;
  perform pg_temp.ok(pg_temp.fin_no_orphans(after_a) and pg_temp.fin_no_orphans(after_b),'F-RB sin headers/líneas/eventos huérfanos');
  insert into pg_temp.i3b_results values('F-RB-financial-rollback',evidence);
exception when query_canceled or assert_failure then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-RB cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
when others then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-RB cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
end;
$f$;

create function pg_temp.fin_collection_cases() returns void language plpgsql as $f$
declare id uuid; before_graph jsonb; value jsonb; first_graph jsonb; final_graph jsonb;
  name text; amount numeric; collection_first boolean; receipt_result jsonb;
begin
  id:=pg_temp.fin_new_invoice('collect-before-void',pg_temp.fid('tenant-A'));
  before_graph:=pg_temp.fin_seed_sale(id,pg_temp.fid('tenant-A'));
  value:=pg_temp.fin_race('F-COB-collect40-void',id,pg_temp.fin_receipt_sql(id,40),
    pg_temp.void_sql(id),'authenticated','authenticated');
  first_graph:=value->'afterFirstCommit';final_graph:=value->'final';
  perform pg_temp.ok(value->'before'=before_graph,'F-COB cobro40/void usa original positivo confirmado');
  perform pg_temp.ok((value->'a'->'result'->>'paid_amount')::numeric=40
    and (value->'a'->'result'->>'amount')::numeric=40
    and value->'a'->'result'->>'invoice_id'=id::text
    and value->'a'->'result'->>'receipt_id'=first_graph->'receipts'->0->>'id'
    and value->'a'->'result'->>'status'='parcial'
    and value->'a'->'result'->>'fully_paid'='false','F-COB identidad/montos/estado nativos de cobro40');
  perform pg_temp.ok(pg_temp.fin_graph_valid(first_graph,true,false,40,1),'F-COB cobro40 confirma recibo+paid40+parcial+venta100+D2');
  perform pg_temp.ok(value->'b'->>'ok'='false' and value->'b'->>'state'='55000'
    and position('cobro(s) vivo(s)' in (value->'b'->>'message'))>0,'F-COB void rechazada55000 por recibo vivo real');
  perform pg_temp.ok(final_graph=first_graph,'F-COB rechazo void no altera grafo/auditoría ENTEROS tras cobro');
  insert into pg_temp.i3b_results values('F-COB-collect40-void',value);

  id:=pg_temp.fin_new_invoice('void-before-collect',pg_temp.fid('tenant-A'));
  before_graph:=pg_temp.fin_seed_sale(id,pg_temp.fid('tenant-A'));
  value:=pg_temp.fin_race('F-COB-void-collect40',id,pg_temp.void_sql(id),
    pg_temp.fin_receipt_sql(id,40),'authenticated','authenticated');
  first_graph:=value->'afterFirstCommit';final_graph:=value->'final';
  perform pg_temp.ok(value->'before'=before_graph and value->'a'->'result'='true'::jsonb,'F-COB void real sobre original confirmado');
  perform pg_temp.ok(pg_temp.fin_graph_valid(first_graph,true,true,0,0),'F-COB void confirma par100 íntegro+anulada y cero cobros');
  perform pg_temp.ok(value->'b'->>'ok'='false' and value->'b'->>'state'='23514'
    and value->'b'->>'message'='PAYMENT_STATE','F-COB cobro posterior rechazado PAYMENT_STATE/23514');
  perform pg_temp.ok(final_graph=first_graph,'F-COB cobro rechazado no deja recibo ni altera par/auditoría');
  insert into pg_temp.i3b_results values('F-COB-void-collect40',value);

  foreach amount in array array[40::numeric,100::numeric] loop
    foreach collection_first in array array[true,false] loop
      name:='F-COB-'||case when collection_first then 'collect-post-' else 'post-collect-' end||amount::text;
      id:=pg_temp.fin_new_invoice(name,pg_temp.fid('tenant-A'));
      before_graph:=pg_temp.fin_graph('i3b_s',id);
      perform pg_temp.ok(pg_temp.fin_graph_valid(before_graph,false,false,0,0),'F-COB posting parte SIN venta previa: '||name);
      if collection_first then
        value:=pg_temp.fin_race(name,id,pg_temp.fin_receipt_sql(id,amount),pg_temp.post_sql(id),'authenticated','service_role');
        receipt_result:=value->'a'->'result';
        perform pg_temp.ok(value->'b'->'result'->>'outcome'='posted','F-COB posting B REAL posted, no already_posted: '||name);
        perform pg_temp.ok(pg_temp.fin_graph_valid(value->'afterFirstCommit',false,false,amount,1),'F-COB recibo confirmado antes de venta: '||name);
        perform pg_temp.ok(value->'final'->'receipts'=value->'afterFirstCommit'->'receipts'
          and value->'final'->'invoice'=value->'afterFirstCommit'->'invoice','F-COB posting no pisa cobro/saldo/identidades: '||name);
      else
        value:=pg_temp.fin_race(name,id,pg_temp.post_sql(id),pg_temp.fin_receipt_sql(id,amount),'service_role','authenticated');
        receipt_result:=value->'b'->'result';
        perform pg_temp.ok(value->'a'->'result'->>'outcome'='posted','F-COB posting A REAL posted, no already_posted: '||name);
        perform pg_temp.ok(pg_temp.fin_graph_valid(value->'afterFirstCommit',true,false,0,0),'F-COB venta100 confirmada antes del recibo: '||name);
        perform pg_temp.ok(value->'final'->'originalHeaders'=value->'afterFirstCommit'->'originalHeaders'
          and value->'final'->'originalLines'=value->'afterFirstCommit'->'originalLines','F-COB cobro no reduce/cambia venta original: '||name);
      end if;
      final_graph:=value->'final';
      perform pg_temp.ok(value->'before'=before_graph and value->'a'->>'ok'='true' and value->'b'->>'ok'='true','F-COB dos operaciones nativas exitosas: '||name);
      perform pg_temp.ok(pg_temp.fin_graph_valid(final_graph,true,false,amount,1),'F-COB UNA venta100 y recibo/saldo40o100 completos sin huérfanos: '||name);
      perform pg_temp.ok((receipt_result->>'amount')::numeric=amount and (receipt_result->>'paid_amount')::numeric=amount
        and receipt_result->>'invoice_id'=id::text and receipt_result->>'receipt_id'=final_graph->'receipts'->0->>'id'
        and receipt_result->>'status'=final_graph->'invoice'->>'status'
        and receipt_result->>'fully_paid'=(amount=100)::text and (receipt_result->>'total_amount')::numeric=100,
        'F-COB identidad/monto nativos del recibo coinciden con estado persistido: '||name);
      perform pg_temp.ok((final_graph->'audit') @> (before_graph->'audit'),'F-COB auditoría previa íntegra y eventos nuevos medidos: '||name);
      insert into pg_temp.i3b_results values(name,value);
    end loop;
  end loop;
end;
$f$;
create function pg_temp.fin_inverse_commit_case() returns void language plpgsql as $f$
declare id uuid; before_graph jsonb; transient_graph jsonb; after_graph jsonb; changed jsonb;
  commit_status text; commit_error text; evidence jsonb; cleanup_error text; channel jsonb;
begin
  id:=pg_temp.fin_new_invoice('inverse-commit-fresh',pg_temp.fid('tenant-A'));
  before_graph:=pg_temp.fin_seed_sale(id,pg_temp.fid('tenant-A'));
  channel:=pg_temp.fin_start('i3b_a','postgres');
  -- RC ordinario. No SET CONSTRAINTS/deferred-eval ni void RPC: UPDATE directo.
  changed:=pg_temp.run('i3b_a',format('with changed as(update public.invoices set status=''anulada'''
    ||' where id=%L::uuid returning id) select to_jsonb(count(*)) from changed',id));
  transient_graph:=pg_temp.fin_graph('i3b_a',id);
  raise notice 'I3B_F_COMMIT_TRANSIENT_RAW %',jsonb_build_object('changed',changed,'before',before_graph,'transient',transient_graph);
  perform pg_temp.ok(changed->>'ok'='true' and changed->'result'='1'::jsonb
    and transient_graph->'invoice'->>'status'='anulada'
    and jsonb_array_length(transient_graph->'headers')=1
    and transient_graph->'originalHeaders'=before_graph->'originalHeaders',
    'F-COMMIT UPDATE directo modifica UNA fila transitoria sin reverso');
  -- COMMIT REAL fuera del helper de UPDATE. ERROR y mensaje son de ESTA orden.
  commit_status:=dblink_exec('i3b_a','commit',false);
  commit_error:=dblink_error_message('i3b_a');
  after_graph:=pg_temp.fin_graph('i3b_s',id);
  evidence:=jsonb_build_object('changed',changed,'before',before_graph,'transient',transient_graph,
    'commit',commit_status,'nativeError',commit_error,'commitSqlstate','NO DISPONIBLE por dblink_exec',
    'after',after_graph,'channel',channel,'ordinaryReadCommitted',channel->>'isolation'='read committed',
    'voluntaryRollbackUsedAsProof',false);
  raise notice 'I3B_F_COMMIT_NATIVE_RAW %',evidence;
  perform pg_temp.ok(commit_status='ERROR' and position('Una factura anulada con venta requiere su reverso íntegro.' in commit_error)>0,
    'F-COMMIT ordinario rechaza la dirección anulada-con-original sin reverso por mensaje específico');
  perform pg_temp.ok(after_graph=before_graph and pg_temp.fin_graph_valid(after_graph,true,false,0,0),
    'F-COMMIT restaura preimagen ENTERA positiva/original confirmado y cero reversos/huérfanos');
  insert into pg_temp.i3b_results values('F-COMMIT-inverse-ordinary',evidence);
exception when query_canceled or assert_failure then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-COMMIT cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
when others then
  cleanup_error:=pg_temp.fin_recover();raise notice 'F-COMMIT cleanup conserva primario: %',coalesce(cleanup_error,'OK');raise;
end;
$f$;

do $cases$
declare
  id uuid; id_b uuid; entry uuid; r jsonb; observed jsonb; a_result jsonb;
  token text:=(select o.token from pg_temp.i3b_owner o);
  text_result text; native_error text; cleanup_error text;
  before_state jsonb; before_guc jsonb; after_guc jsonb;
  pid_a integer; pid_b integer; barrier jsonb;
  ar uuid:=pg_temp.fid('clientes'); sales uuid:=pg_temp.fid('ventas');
  line_id uuid; role_sql text; context_value text; deadline timestamptz;
begin
  perform dblink_exec(pg_temp.conn('postgres','create'),'create database dtd_carrera_0497_i3b template template0');
  perform dblink_exec(pg_temp.conn('postgres','mark'),format('comment on database dtd_carrera_0497_i3b is %L',token));
  perform dblink_connect('i3b_s',pg_temp.conn('dtd_carrera_0497_i3b','s'));
  perform pg_temp.ok(dblink_exec('i3b_s',pg_temp.fixture())='COMMIT','fixture COMMIT real anterior a A/B');
  perform dblink_connect('i3b_a',pg_temp.conn('dtd_carrera_0497_i3b','a'));
  perform dblink_connect('i3b_b',pg_temp.conn('dtd_carrera_0497_i3b','b'));

  -- R01/R02: misma factura, commitA reconoce / rollbackA construye B.
  id:=pg_temp.new_invoice('same-commit');
  r:=pg_temp.race('R01-post-post-COMMIT',pg_temp.post_sql(id),pg_temp.post_sql(id));
  observed:=pg_temp.observe(id);
  perform pg_temp.ok(r->'result'->>'outcome'='already_posted'
    and observed->>'originals'='1' and observed->>'lines'='2'
    and observed->>'postedEvents'='1' and observed->>'orphans'='0','R01 única venta confirmada');
  id:=pg_temp.new_invoice('same-rollback');
  r:=pg_temp.race('R02-post-post-ROLLBACK',pg_temp.post_sql(id),pg_temp.post_sql(id),false);
  perform pg_temp.ok(r->'result'->>'outcome'='posted'
    and pg_temp.observe(id)->>'originals'='1' and pg_temp.observe(id)->>'postedEvents'='1',
    'R02 rollbackA no deja venta parcial ni se reconoce una inexistente');

  -- R03/R04: ambas prioridades posting/void, no se atribuye cobro nuevo.
  id:=pg_temp.new_invoice('void-first');
  r:=pg_temp.race('R03-void-post',pg_temp.void_sql(id),pg_temp.post_sql(id),true,'authenticated','service_role');
  perform pg_temp.ok(r->'result'->>'reason'='invoice_not_postable'
    and pg_temp.observe(id)->>'status'='anulada' and pg_temp.observe(id)->>'entries'='0',
    'R03 posting tardío no confirma después de anular sin venta');
  id:=pg_temp.new_invoice('post-first');
  r:=pg_temp.race('R04-post-void',pg_temp.post_sql(id),pg_temp.void_sql(id),true,'service_role','authenticated');
  observed:=pg_temp.observe(id);
  perform pg_temp.ok(r->'result'='true'::jsonb and observed->>'status'='anulada'
    and observed->>'entries'='2' and observed->>'lines'='4'
    and observed->>'postedEvents'='2' and observed->>'voidedEvents'='1'
    and (observed->>'pairNet')::numeric=0,'R04 par íntegro y eventos confirmados');

  -- R05: facturas distintas, B espera la UNIQUE del mismo correlativo no visible.
  id:=pg_temp.new_invoice('code-a');id_b:=pg_temp.new_invoice('code-b');
  r:=pg_temp.race('R05-code-collision',pg_temp.post_sql(id),pg_temp.post_sql(id_b));
  perform pg_temp.ok(r->'result'->>'outcome'='posted'
    and pg_temp.observe(id)->>'lines'='2' and pg_temp.observe(id_b)->>'lines'='2'
    and pg_temp.observe(id_b)->>'orphans'='0','R05 colisión selectiva revierte líneas del subintento');
  select v into text_result from dblink('i3b_s',format(
    'select count(distinct entry_code)::text from public.journal_entries where invoice_id in(%L::uuid,%L::uuid)',id,id_b)) x(v text);
  perform pg_temp.ok(text_result='2','R05 dos códigos distintos confirmados');

  -- R06: líneas pre-header deA, línea extraB espera MISMO mutex; commitA bloquea.
  id:=pg_temp.new_invoice('uuid-commit');entry:=pg_temp.rid('entry-commit');
  r:=pg_temp.race('R06-uuid-lines',format(
      'with i as(insert into public.journal_lines(entry_id,account_id,debit,credit) values'
      ||'(%1$L::uuid,%2$L::uuid,100,0),(%1$L::uuid,%3$L::uuid,0,100) returning id) select to_jsonb(count(*)) from i',
      entry,ar,sales),
    format('with i as(insert into public.journal_lines(entry_id,account_id,debit,credit) values'
      ||'(%L::uuid,%L::uuid,0,1) returning id) select to_jsonb(count(*)) from i',entry,sales),
    true,'postgres','postgres',format(
      'with i as(insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)'
      ||' values(%L::uuid,%L::uuid,''RACE-UUID-C'',''2026-10-10'',''asentado'',''invoice'',%L::uuid,now()) returning id)'
      ||' select to_jsonb(count(*)) from i',entry,pg_temp.fid('tenant-A'),id),true);
  -- El parámetro anterior difiere los tres nombres en A ANTES de sus líneas.
  perform pg_temp.ok(r->>'state'='23514' and pg_temp.observe(id)->>'lines'='2',
    'R06 después del commit no se añade línea protegida');

  -- R07: rollbackA permite una UNIDAD nueva válida deB, no INSERT aislado.
  id:=pg_temp.new_invoice('uuid-rollback');entry:=pg_temp.rid('entry-rollback');
  r:=pg_temp.race('R07-uuid-rollback',format(
      'with i as(insert into public.journal_lines(entry_id,account_id,debit,credit) values'
      ||'(%1$L::uuid,%2$L::uuid,100,0),(%1$L::uuid,%3$L::uuid,0,100) returning id) select to_jsonb(count(*)) from i',entry,ar,sales),
    format('select public.i3b_test_construct(%L::uuid,%L::uuid,''RACE-UUID-R'')',id,entry),
    false,'postgres','postgres',null,true);
  perform pg_temp.ok((r->>'ok')::boolean and pg_temp.observe(id)->>'originals'='1'
    and pg_temp.observe(id)->>'lines'='2','R07 unidadB después de rollbackA');

  -- R08: incluso cabecera MANUAL compite porUUID antes de admitir.
  id:=pg_temp.new_invoice('uuid-manual');entry:=pg_temp.rid('entry-manual-rival');
  r:=pg_temp.race('R08-uuid-manual-header',format(
      'with i as(insert into public.journal_lines(entry_id,account_id,debit,credit) values'
      ||'(%1$L::uuid,%2$L::uuid,100,0),(%1$L::uuid,%3$L::uuid,0,100) returning id) select to_jsonb(count(*)) from i',entry,ar,sales),
    format('with i as(insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source)'
      ||' values(%L::uuid,%L::uuid,''MANUAL-RIVAL'',''2026-10-10'',''borrador'',''manual'') returning id)'
      ||' select to_jsonb(count(*)) from i',entry,pg_temp.fid('tenant-A')),
    true,'postgres','postgres',format(
      'with i as(insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,posted_at)'
      ||' values(%L::uuid,%L::uuid,''RACE-UUID-M'',''2026-10-10'',''asentado'',''invoice'',%L::uuid,now()) returning id)'
      ||' select to_jsonb(count(*)) from i',entry,pg_temp.fid('tenant-A'),id),true);
  perform pg_temp.ok(r->>'state'='23514' and pg_temp.observe(id)->>'originals'='1','R08 manual no reemplaza protegido');

  -- R09: snapshot previo RR/SERIALIZABLE: rechazo25000, no fingir barrera.
  foreach role_sql in array array['repeatable read','serializable'] loop
    id:=pg_temp.new_invoice('isolation-'||replace(role_sql,' ','-'));
    perform pg_temp.start_session('i3b_a','service_role',role_sql);
    perform pg_temp.run('i3b_a','select to_jsonb(count(*)) from public.invoices');
    -- S confirma DESPUÉS de fijar el snapshot de A; A no ve esa cabecera.
    r:=pg_temp.run('i3b_s',pg_temp.post_sql(id));
    perform pg_temp.ok(r->'result'->>'outcome'='posted','R09 rival confirmado después del snapshot');
    before_state:=pg_temp.observe(id);
    r:=pg_temp.run('i3b_a',pg_temp.post_sql(id));
    perform pg_temp.ok(r->>'state'='25000','R09 RPC aislamiento rechazado antes de efectos');
    perform dblink_exec('i3b_a','rollback');
    perform pg_temp.ok(pg_temp.observe(id)=before_state,'R09 no añade efectos a la unidad rival confirmada');
    insert into pg_temp.i3b_results values('R09-'||role_sql,jsonb_build_object('result',r,'barrierClaimed',false));
  end loop;

  -- R10/R11: COMMIT real no deja FK huérfana ni reverso sin factura anulada.
  line_id:=pg_temp.rid('orphan-line');
  perform pg_temp.start_session('i3b_a','postgres');
  perform dblink_exec('i3b_a','set constraints public.journal_lines_entry_id_fkey deferred');
  r:=pg_temp.run('i3b_a',format('with i as(insert into public.journal_lines(id,entry_id,account_id,debit,credit)'
    ||' values(%L::uuid,%L::uuid,%L::uuid,0,1) returning id) select to_jsonb(count(*)) from i',
    line_id,pg_temp.rid('absent-header'),sales));
  perform pg_temp.ok((r->>'ok')::boolean,'R10 huérfana sólo transitoria');
  text_result:=dblink_exec('i3b_a','commit',false);native_error:=dblink_error_message('i3b_a');
  perform pg_temp.ok(text_result='ERROR' and position('journal_lines_entry_id_fkey' in native_error)>0,
    'R10 COMMIT real falla por FK, no rollback usado como prueba');
  perform dblink_exec('i3b_a','rollback',false);
  select v into text_result from dblink('i3b_s',format('select count(*)::text from public.journal_lines where id=%L::uuid',line_id)) x(v text);
  perform pg_temp.ok(text_result='0','R10 nada confirmado');
  insert into pg_temp.i3b_results values('R10-commit-FK',jsonb_build_object('commit','ERROR','nativeError',native_error,'sqlstate','NO DISPONIBLE por dblink_exec'));

  id:=pg_temp.new_invoice('reverse-no-transition');
  perform pg_temp.start_session('i3b_a','service_role');
  r:=pg_temp.run('i3b_a',pg_temp.post_sql(id));
  perform pg_temp.ok((r->>'ok')::boolean,'R11 posting previo');
  perform dblink_exec('i3b_a','commit');
  before_state:=pg_temp.observe(id);
  perform pg_temp.start_session('i3b_a','postgres');
  perform dblink_exec('i3b_a','set constraints public.journal_lines_entry_id_fkey,public.i3_journal_entry_final_check,public.i3_invoice_final_check deferred');
  entry:=pg_temp.rid('reverse-no-transition-entry');
  perform dblink_exec('i3b_a',format(
    'insert into public.journal_lines(entry_id,account_id,debit,credit) select %L::uuid,l.account_id,l.credit,l.debit'
    ||' from public.journal_lines l join public.journal_entries e on e.id=l.entry_id where e.invoice_id=%L::uuid and e.source=''invoice''',
    entry,id));
  perform dblink_exec('i3b_a',format(
    'insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source,invoice_id,reverses_entry_id,posted_at)'
    ||' select %L::uuid,tenant_id,''RACE-NO-TRANSITION'',greatest((now() at time zone ''America/Caracas'')::date,entry_date),'
    ||'''asentado'',''invoice_reversal'',invoice_id,id,now() from public.journal_entries where invoice_id=%L::uuid and source=''invoice''',entry,id));
  text_result:=dblink_exec('i3b_a','commit',false);native_error:=dblink_error_message('i3b_a');
  perform pg_temp.ok(text_result='ERROR' and position('Estado de factura y par contable incompatibles.' in native_error)>0,
    'R11 COMMIT real rechaza reverso sin transición final');
  perform dblink_exec('i3b_a','rollback',false);
  perform pg_temp.ok(pg_temp.observe(id)=before_state,'R11 rollback nativo de COMMIT conserva original y D2');
  insert into pg_temp.i3b_results values('R11-commit-final',jsonb_build_object('commit','ERROR','nativeError',native_error,'sqlstate','NO DISPONIBLE por dblink_exec'));

  -- R12: returnposted no equivale a commit de la transacción exterior.
  id:=pg_temp.new_invoice('outer-rollback');before_state:=pg_temp.observe(id);
  perform pg_temp.start_session('i3b_a','service_role');
  r:=pg_temp.run('i3b_a',pg_temp.post_sql(id));
  perform pg_temp.ok(r->'result'->>'outcome'='posted' and pg_temp.observe(id)=before_state,'R12 no visibilidad sin COMMIT');
  perform dblink_exec('i3b_a','rollback');
  perform pg_temp.ok(pg_temp.observe(id)=before_state,'R12 rollback exterior elimina unidad y eventos');

  -- R13: CASCADE manual físico en RC y RR. No soft-delete UI.
  foreach role_sql in array array['read committed','repeatable read'] loop
    entry:=pg_temp.rid('manual-delete-'||role_sql);
    perform dblink_exec('i3b_s',format(
      'insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source)'
      ||' values(%L::uuid,%L::uuid,%L,''2026-10-10'',''borrador'',''manual'');'
      ||'insert into public.journal_lines(entry_id,account_id,debit,credit) values'
      ||'(%L::uuid,%L::uuid,5,0),(%L::uuid,%L::uuid,0,5)',
      entry,pg_temp.fid('tenant-A'),'MANUAL-'||role_sql,entry,ar,entry,sales));
    perform pg_temp.start_session('i3b_a','postgres',role_sql);
    perform pg_temp.run('i3b_a','select to_jsonb(count(*)) from public.journal_entries');
    r:=pg_temp.run('i3b_a',format('with d as(delete from public.journal_entries where id=%L::uuid returning id) select to_jsonb(count(*)) from d',entry));
    perform pg_temp.ok((r->>'ok')::boolean and r->'result'='1'::jsonb,'R13 DELETE manual sin25000 artificial');
    perform dblink_exec('i3b_a','commit');
    select x.r into observed from dblink('i3b_s',format(
      'select jsonb_build_object(''parent'',(select count(*) from public.journal_entries where id=%1$L::uuid),'
      ||'''lines'',(select count(*) from public.journal_lines where entry_id=%1$L::uuid),'
      ||'''audit'',(select count(*) from public.entity_audit_log where entity_id=%1$L::uuid and event_type=''journal_entry_deleted''))',entry)) x(r jsonb);
    perform pg_temp.ok(observed->>'parent'='0' and observed->>'lines'='0' and observed->>'audit'='1','R13 CASCADE y evento confirmados');
    insert into pg_temp.i3b_results values('R13-'||role_sql,jsonb_build_object('delete',r,'observed',observed));
  end loop;

  -- R14: RR vio manual viejo; B lo sustituye por protegido del mismoUUID.
  entry:=pg_temp.rid('rr-replaced');id:=pg_temp.new_invoice('rr-replacement');
  perform dblink_exec('i3b_s',format(
    'insert into public.journal_entries(id,tenant_id,entry_code,entry_date,status,source)'
    ||' values(%L::uuid,%L::uuid,''RR-OLD'',''2026-10-10'',''borrador'',''manual'');'
    ||'insert into public.journal_lines(entry_id,account_id,debit,credit) values(%L::uuid,%L::uuid,1,0),(%L::uuid,%L::uuid,0,1)',
    entry,pg_temp.fid('tenant-A'),entry,ar,entry,sales));
  perform pg_temp.start_session('i3b_a','postgres','repeatable read');
  perform pg_temp.run('i3b_a',format('select to_jsonb(count(*)) from public.journal_lines where entry_id=%L::uuid',entry));
  perform dblink_exec('i3b_s',format('delete from public.journal_entries where id=%L::uuid',entry));
  r:=pg_temp.run('i3b_s',format('select public.i3b_test_construct(%L::uuid,%L::uuid,''RR-NEW'')',id,entry));
  perform pg_temp.ok((r->>'ok')::boolean,'R14 reemplazo confirmado real');
  before_state:=pg_temp.observe(id);
  r:=pg_temp.run('i3b_a',format('with d as(delete from public.journal_lines where entry_id=%L::uuid returning id) select to_jsonb(count(*)) from d',entry));
  perform pg_temp.ok(r->>'state'='40001','R14 error nativo de serialización se conserva');
  perform dblink_exec('i3b_a','rollback');
  perform pg_temp.ok(pg_temp.observe(id)=before_state,'R14 no borra líneas nuevas protegidas');
  insert into pg_temp.i3b_results values('R14-RR-replacement',jsonb_build_object('result',r,'observed',before_state));

  -- R15: C fresca distingue AUSENCIA REGISTRAL de ausencia de motivo.
  -- SET de función puede registrar placeholder y restaurarlo como cadena vacía.
  -- No precargar ni transformar los valores crudos de la observación.
  perform dblink_connect('i3b_c',pg_temp.conn('dtd_carrera_0497_i3b','c'));
  select x.r into before_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
  raise notice 'I3B_R15_RAW_CONTEXT %',jsonb_build_object(
    'stage','initial_before_first_call','beforeRaw',before_guc,
    'beforeRepresentation',case when before_guc is null then 'SQL_NULL' when before_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end);
  perform pg_temp.ok(before_guc is null,'R15 GUC AUSENTE medido antes de primera llamada en C');
  id:=pg_temp.new_invoice('context-fresh');
  perform pg_temp.start_session('i3b_c','service_role');
  r:=pg_temp.run('i3b_c',pg_temp.post_sql(id));
  raise notice 'I3B_R15_RAW_CONTEXT %',jsonb_build_object(
    'stage','rpc_result_before_posted_assert','rpcRaw',r);
  perform pg_temp.ok(r->'result'->>'outcome'='posted','R15 primera llamada real');
  perform dblink_exec('i3b_c','commit');
  select x.r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
  raise notice 'I3B_R15_RAW_CONTEXT %',jsonb_build_object(
    'stage','after_commit_before_semantic_assert','beforeRaw',before_guc,'afterRaw',after_guc,
    'beforeRepresentation',case when before_guc is null then 'SQL_NULL' when before_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'afterRepresentation',case when after_guc is null then 'SQL_NULL' when after_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'registryIdentityRestorationClaimed',false);
  insert into pg_temp.i3b_results values('R15-fresh-context',jsonb_build_object(
    'beforeRaw',before_guc,'afterRaw',after_guc,
    'beforeRepresentation',case when before_guc is null then 'SQL_NULL' when before_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'afterRepresentation',case when after_guc is null then 'SQL_NULL' when after_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'initialRegistryAbsenceMeasured',true,'registryIdentityRestorationClaimed',false));
  perform pg_temp.ok(after_guc is null or after_guc='""'::jsonb,
    'R15 tras RPC/COMMIT no queda motivo, sin exigir ausencia registral restaurada');
  select x.r into observed from dblink('i3b_s',format(
    'select jsonb_build_object(''posted'',count(*),''withReason'',count(*) filter(where a.reason is not null and a.reason<>''''))'
    ||' from public.entity_audit_log a join public.journal_entries e on e.id=a.entity_id'
    ||' where e.invoice_id=%L::uuid and a.event_type=''journal_entry_posted''',id)) x(r jsonb);
  raise notice 'I3B_R15_RAW_CONTEXT %',jsonb_build_object(
    'stage','audit_before_assert','auditRaw',observed);
  perform pg_temp.ok(observed->>'posted'='1' and observed->>'withReason'='0',
    'R15 primera llamada confirma un evento D2 sin motivo filtrado');
  update pg_temp.i3b_results set evidence=evidence||jsonb_build_object('auditRaw',observed)
    where name='R15-fresh-context';
  foreach context_value in array array['','I3B contexto exterior C'] loop
    perform dblink_exec('i3b_c',format('set dtd.audit_reason=%L',context_value));
    perform pg_temp.start_session('i3b_c','authenticated');
    r:=pg_temp.run('i3b_c',format('select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''  ''))',id));
    perform pg_temp.ok(r->>'state'='22023','R15 excepción concreta por motivo vacío');
    select x.r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
    perform pg_temp.ok(after_guc=to_jsonb(context_value),'R15 excepción restaura contexto exacto en TX');
    perform dblink_exec('i3b_c','commit');
    select x.r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
    perform pg_temp.ok(after_guc=to_jsonb(context_value),'R15 contexto vacío/no vacío tras COMMIT');
  end loop;
  perform dblink_exec('i3b_c',$nested$
    create function public.i3b_test_nested(p_tenant uuid,p_invoice uuid) returns jsonb
    language plpgsql set dtd.audit_reason='I3B contexto anidado' as $fn$
    declare result jsonb;
    begin
      result:=public.post_invoice_journal_entry_atomic(p_tenant,p_invoice);
      if current_setting('dtd.audit_reason',true) is distinct from 'I3B contexto anidado' then
        raise exception 'I3B contexto interior no restaurado';
      end if;
      return result;
    end;
    $fn$;
  $nested$);
  id:=pg_temp.new_invoice('context-nested');
  perform pg_temp.start_session('i3b_c','service_role');
  r:=pg_temp.run('i3b_c',format('select public.i3b_test_nested(%L::uuid,%L::uuid)',pg_temp.fid('tenant-A'),id));
  perform pg_temp.ok(r->'result'->>'outcome'='posted','R15 llamada anidada real');
  select x.r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
  perform pg_temp.ok(after_guc=to_jsonb('I3B contexto exterior C'::text),'R15 función anidada devuelve contexto exterior');
  perform dblink_exec('i3b_c','commit');

  -- R16: timeout nativo en lock de factura; sin retry ni efectos laterales.
  id:=pg_temp.new_invoice('lock-timeout');before_state:=pg_temp.observe(id);
  perform pg_temp.start_session('i3b_a','postgres');
  perform pg_temp.start_session('i3b_b','service_role');
  perform dblink_exec('i3b_b','set local lock_timeout=''2s''');
  perform pg_temp.run('i3b_a',format('select to_jsonb(id) from public.invoices where id=%L::uuid for update',id));
  select pid into pid_a from dblink('i3b_a','select pg_backend_pid()') x(pid integer);
  select pid into pid_b from dblink('i3b_b','select pg_backend_pid()') x(pid integer);
  perform pg_temp.ok(dblink_send_query('i3b_b',format('select public.i3b_test_try(%L)',pg_temp.post_sql(id)))=1,'R16 envío');
  barrier:=pg_temp.wait_for(pid_a,pid_b);
  r:=pg_temp.drain_b();
  perform pg_temp.ok(r->>'state'='55P03','R16 lock_timeout se propaga sin convertirlo en código ocupado');
  perform dblink_exec('i3b_b','rollback');perform dblink_exec('i3b_a','rollback');
  perform pg_temp.ok(pg_temp.observe(id)=before_state,'R16 no quedan unidad ni eventos');
  insert into pg_temp.i3b_results values('R16-lock-timeout',jsonb_build_object('result',r,'barrier',barrier));

  -- R17: ciclo real de los mutex. Se libera la víctima antes de drenar al otro.
  perform pg_temp.start_session('i3b_a','postgres');perform pg_temp.start_session('i3b_b','postgres');
  perform pg_temp.run('i3b_a',format('select jsonb_build_object(''lock'',public.i3_lock_entry(%L::uuid))',pg_temp.rid('deadlock-x')));
  perform pg_temp.run('i3b_b',format('select jsonb_build_object(''lock'',public.i3_lock_entry(%L::uuid))',pg_temp.rid('deadlock-y')));
  select pid into pid_a from dblink('i3b_a','select pg_backend_pid()') x(pid integer);
  select pid into pid_b from dblink('i3b_b','select pg_backend_pid()') x(pid integer);
  perform pg_temp.ok(dblink_send_query('i3b_b',format('select public.i3b_test_try(%L)',format(
    'select jsonb_build_object(''lock'',public.i3_lock_entry(%L::uuid))',pg_temp.rid('deadlock-x'))))=1,'R17 B espera X');
  barrier:=pg_temp.wait_for(pid_a,pid_b);
  perform pg_temp.ok(dblink_send_query('i3b_a',format('select public.i3b_test_try(%L)',format(
    'select jsonb_build_object(''lock'',public.i3_lock_entry(%L::uuid))',pg_temp.rid('deadlock-y'))))=1,'R17 A espera Y');
  deadline:=clock_timestamp()+interval '10 seconds';
  while dblink_is_busy('i3b_a')=1 and dblink_is_busy('i3b_b')=1 loop
    if clock_timestamp()>=deadline then raise exception 'R17 servidor no resolvió ciclo dentro del cap'; end if;
    perform pg_sleep(0.01);
  end loop;
  if dblink_is_busy('i3b_a')=0 then
    select v into a_result from dblink_get_result('i3b_a',false) x(v jsonb);
    perform * from dblink_get_result('i3b_a',false) x(v jsonb);
    perform dblink_exec('i3b_a','rollback');r:=pg_temp.drain_b();perform dblink_exec('i3b_b','rollback');
  else
    r:=pg_temp.drain_b();perform dblink_exec('i3b_b','rollback');
    select v into a_result from dblink_get_result('i3b_a',false) x(v jsonb);
    perform * from dblink_get_result('i3b_a',false) x(v jsonb);perform dblink_exec('i3b_a','rollback');
  end if;
  perform pg_temp.ok((a_result->>'state'='40P01' and (r->>'ok')::boolean)
    or (r->>'state'='40P01' and (a_result->>'ok')::boolean),'R17 un deadlock nativo y un superviviente, sin retry');
  insert into pg_temp.i3b_results values('R17-deadlock',jsonb_build_object('a',a_result,'b',r,'barrier',barrier));

  -- R18: construcción directa protegida también rechaza snapshot RR/serializable.
  foreach role_sql in array array['repeatable read','serializable'] loop
    id:=pg_temp.new_invoice('direct-'||replace(role_sql,' ','-'));before_state:=pg_temp.observe(id);
    perform pg_temp.start_session('i3b_a','postgres',role_sql);
    r:=pg_temp.run('i3b_a',format('select public.i3b_test_construct(%L::uuid,%L::uuid,''DIRECT-ISOLATION'')',id,pg_temp.rid('direct-entry-'||role_sql)));
    perform pg_temp.ok(r->>'state'='25000','R18 construcción no depende de procedencia RPC');
    perform dblink_exec('i3b_a','rollback');
    perform pg_temp.ok(pg_temp.observe(id)=before_state,'R18 sin efectos ni auditoría');
    insert into pg_temp.i3b_results values('R18-'||role_sql,jsonb_build_object('result',r,'barrierClaimed',false));
  end loop;

  -- Escenarios financieros nuevos, separados de R01-R18 y NO EJECUTADOS aquí.
  perform pg_temp.fin_rollback_case();
  perform pg_temp.fin_collection_cases();
  perform pg_temp.fin_inverse_commit_case();

  cleanup_error:=pg_temp.cleanup();
  perform pg_temp.ok(cleanup_error is null,'cleanup propio: '||coalesce(cleanup_error,'OK'));
exception when query_canceled or assert_failure then
  cleanup_error:=pg_temp.cleanup();
  raise notice 'I3B cleanup tras cancelación/aserción: %',coalesce(cleanup_error,'OK');
  raise;
when others then
  cleanup_error:=pg_temp.cleanup();
  raise notice 'I3B cleanup tras error: %',coalesce(cleanup_error,'OK');
  raise;
end;
$cases$;
select name,evidence from pg_temp.i3b_results order by name;
select 'I3B carrera AUTORÍA: ejecución futura produjo '||currval('pg_temp.i3b_assertions')||' aserciones' as resultado;
rollback;

-- Después del ROLLBACK del coordinador: ausencia física de SUS objetos.
do $closed$
begin
  if exists(select 1 from pg_database where datname='dtd_carrera_0497_i3b')
     or exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))
     or exists(select 1 from pg_extension where extname='dblink') then
    raise exception 'I3B cierre incompleto: objetos propios retenidos; no declarar verde';
  end if;
end;
$closed$;
