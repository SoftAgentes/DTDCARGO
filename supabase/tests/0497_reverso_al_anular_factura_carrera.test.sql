\set ON_ERROR_STOP on
-- SDD-0573/I3-B: carrera PG17 local propia, AUTORADA NO EJECUTADA.
-- Requiere dblink y /sb; ausencia es FALLO de precondición, nunca SKIP verde.
-- Patrón0467: S confirma fixture REAL antes de A/B; rollback del coordinador
-- no deshace esos commits. Cleanup sólo objetos marcados propios, sin FORCE.
begin;
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
      if active then out_lines:=out_lines||pg_read_file('/sb/migrations/'||
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
    select r into observed from dblink('i3b_s',format(
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
  select r into before_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
  perform pg_temp.ok(before_guc is null,'R15 GUC AUSENTE medido antes de primera llamada en C');
  id:=pg_temp.new_invoice('context-fresh');
  perform pg_temp.start_session('i3b_c','service_role');
  r:=pg_temp.run('i3b_c',pg_temp.post_sql(id));
  perform pg_temp.ok(r->'result'->>'outcome'='posted','R15 primera llamada real');
  perform dblink_exec('i3b_c','commit');
  select r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
  insert into pg_temp.i3b_results values('R15-fresh-context',jsonb_build_object(
    'beforeRaw',before_guc,'afterRaw',after_guc,
    'beforeRepresentation',case when before_guc is null then 'SQL_NULL' when before_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'afterRepresentation',case when after_guc is null then 'SQL_NULL' when after_guc='""'::jsonb then 'EMPTY_STRING' else 'OTHER_VALUE' end,
    'initialRegistryAbsenceMeasured',true,'registryIdentityRestorationClaimed',false));
  perform pg_temp.ok(after_guc is null or after_guc='""'::jsonb,
    'R15 tras RPC/COMMIT no queda motivo, sin exigir ausencia registral restaurada');
  select r into observed from dblink('i3b_s',format(
    'select jsonb_build_object(''posted'',count(*),''withReason'',count(*) filter(where a.reason is not null and a.reason<>''''))'
    ||' from public.entity_audit_log a join public.journal_entries e on e.id=a.entity_id'
    ||' where e.invoice_id=%L::uuid and a.event_type=''journal_entry_posted''',id)) x(r jsonb);
  perform pg_temp.ok(observed->>'posted'='1' and observed->>'withReason'='0',
    'R15 primera llamada confirma un evento D2 sin motivo filtrado');
  update pg_temp.i3b_results set evidence=evidence||jsonb_build_object('auditRaw',observed)
    where name='R15-fresh-context';
  foreach context_value in array array['','I3B contexto exterior C'] loop
    perform dblink_exec('i3b_c',format('set dtd.audit_reason=%L',context_value));
    perform pg_temp.start_session('i3b_c','authenticated');
    r:=pg_temp.run('i3b_c',format('select to_jsonb(public.void_invoice_with_audit_reason(%L::uuid,''  ''))',id));
    perform pg_temp.ok(r->>'state'='22023','R15 excepción concreta por motivo vacío');
    select r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
    perform pg_temp.ok(after_guc=to_jsonb(context_value),'R15 excepción restaura contexto exacto en TX');
    perform dblink_exec('i3b_c','commit');
    select r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
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
  select r into after_guc from dblink('i3b_c','select to_jsonb(current_setting(''dtd.audit_reason'',true))') x(r jsonb);
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
