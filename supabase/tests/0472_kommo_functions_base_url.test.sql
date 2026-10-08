\set ON_ERROR_STOP on
-- SDD-0505 · Contrato de 0472: kommo_run_sync() y kommo_run_writeback_drain()
-- arman la URL de las Edge Functions con el secreto de Vault functions_base_url
-- y, sin él, con la URL de Supabase Cloud de 0084/0136. Fixture sintético
-- aislado; no ejecutar sobre una DB real. Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0472_kommo_functions_base_url.test.sql
--
-- No se hace \ir de 0084/0136: crean las extensiones pg_cron y pg_net, que un
-- Postgres pelado y PGlite no tienen. El ANTES son copias VERBATIM de sus dos
-- funciones (0084:11-43 y 0136:150-182, más la ACL y el comentario de 0084); el
-- envoltorio lib/studio/__tests__/kommo-functions-base-url.migration.test.ts
-- comprueba que la copia sigue igual al archivo. Vault: si la base trae el real
-- (imagen supabase/postgres, supabase_vault) se usa tal cual; si no, un stub con
-- la misma superficie (vault.create_secret, vault.decrypted_secrets) y el
-- secreto en claro. net.http_post se reemplaza SIEMPRE por un doble que registra
-- la llamada en una tabla temporal: lo que se afirma es la URL que recibiría pg_net.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regprocedure('public.kommo_run_sync()') is not null
     or to_regprocedure('public.kommo_run_writeback_drain()') is not null
     or to_regclass('public.tenants') is not null then
    raise exception 'TEST 0472: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;

-- Vault real o stub. Las funciones sólo usan la vista decrypted_secrets(name,
-- decrypted_secret); el contrato siembra con vault.create_secret(secreto, nombre),
-- que en supabase_vault 0.3 y en el stub comparten esos dos primeros parámetros.
create schema if not exists vault;
do $vault_stub$
begin
  if to_regclass('vault.secrets') is null then
    create table vault.secrets (
      id uuid primary key default gen_random_uuid(), name text unique, secret text, description text
    );
    create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as $stub$
      insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id
    $stub$;
    create view vault.decrypted_secrets as
      select id, name, description, secret, secret as decrypted_secret from vault.secrets;
  end if;
end;
$vault_stub$;

-- Doble de pg_net: misma firma y nombres de parámetro que net.http_post real (y
-- que el stub de plataforma). Si la base trae pg_net, el `or replace` lo
-- sustituye dentro de esta transacción y el rollback lo devuelve. Registra lo
-- que la función le pasa y devuelve el id, que es lo que pg_net devolvería.
create schema if not exists net;
create temporary table http_calls (
  id bigserial primary key, url text not null, body jsonb, params jsonb, headers jsonb, timeout_ms integer
);
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000
) returns bigint language sql as $$
  insert into pg_temp.http_calls (url, body, params, headers, timeout_ms)
  values ($1, $2, $3, $4, $5) returning id
$$;

-- ── ANTES: 0084 líneas 11-49, copia verbatim ────────────────
create or replace function public.kommo_run_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_sync] kommo_cron_key no está en Vault — salteo';
    return null;
  end if;

  select net.http_post(
    url     := 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-sync',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

comment on function public.kommo_run_sync() is
  'SDD-0043 Fase B: invoca kommo-sync (read-only) leyendo el service key de Vault (kommo_cron_key). La corre pg_cron.';

revoke execute on function public.kommo_run_sync() from public, anon, authenticated;
grant  execute on function public.kommo_run_sync() to service_role;

-- ── ANTES: 0136 líneas 150-185, copia verbatim ──────────────
create or replace function public.kommo_run_writeback_drain()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_writeback_drain] kommo_cron_key no esta en Vault — salteo';
    return null;
  end if;

  select net.http_post(
    url     := 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

revoke execute on function public.kommo_run_writeback_drain() from public, anon, authenticated;
grant execute on function public.kommo_run_writeback_drain() to service_role;

-- Foto de pg_proc en public antes de 0472: la migración sólo puede tocar las dos.
create temporary table baseline_functions as
select p.oid, p.proname, to_jsonb(p) as definition
from pg_catalog.pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

\if :apply_fix
\ir ../migrations/0472_kommo_functions_base_url.sql
\endif

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0472: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
-- Deja el Vault con exactamente ese secreto; null lo quita.
create function pg_temp.set_secret(p_name text, p_value text) returns void language plpgsql as $$
begin
  delete from vault.secrets where name = p_name;
  if p_value is not null then
    perform vault.create_secret(p_value, p_name);
  end if;
end;
$$;
-- Corre la función como postgres y devuelve lo que devolvió más la llamada
-- que registró el doble bajo ese id (null si no llamó).
create function pg_temp.run(p_fn text) returns jsonb language plpgsql as $$
declare v_req bigint;
begin
  execute format('select public.%I()', p_fn) into v_req;
  return jsonb_build_object('req', v_req,
    'call', (select to_jsonb(c) from pg_temp.http_calls c where c.id = v_req),
    'calls', (select count(*) from pg_temp.http_calls));
end;
$$;
-- Corre la función bajo otro rol y devuelve el SQLSTATE del rechazo, o null.
create function pg_temp.as_role(p_role text, p_fn text) returns text language plpgsql as $$
declare v_state text;
begin
  execute format('set local role %I', p_role);
  begin
    execute format('select public.%I()', p_fn);
  exception when others then get stacked diagnostics v_state = returned_sqlstate;
  end;
  reset role;
  return v_state;
end;
$$;

-- 1. Sin functions_base_url: la URL de Cloud exacta, los mismos headers y el
--    mismo body que 0084/0136, y el retorno es el id que devolvió pg_net.
do $sin_secreto$
declare v_sync jsonb; v_drain jsonb;
begin
  perform pg_temp.set_secret('kommo_cron_key', 'cron-key-0472');
  perform pg_temp.set_secret('functions_base_url', null);
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-sync',
    'sin functions_base_url en Vault, kommo_run_sync llama a la URL de Cloud de 0084');
  v_drain := pg_temp.run('kommo_run_writeback_drain');
  perform pg_temp.assert_true(v_drain->'call'->>'url' = 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback',
    'sin functions_base_url en Vault, kommo_run_writeback_drain llama a la URL de Cloud de 0136');
  perform pg_temp.assert_true(
    v_sync->'call'->'headers' = jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer cron-key-0472', 'apikey', 'cron-key-0472')
    and v_drain->'call'->'headers' = v_sync->'call'->'headers',
    'los headers siguen siendo Content-Type, Authorization Bearer y apikey con kommo_cron_key');
  perform pg_temp.assert_true(
    v_sync->'call'->'body' = jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
    and v_drain->'call'->'body' = v_sync->'call'->'body',
    'el body sigue llevando el tenant_id de DTD');
  perform pg_temp.assert_true((v_sync->>'req')::bigint = (v_sync->'call'->>'id')::bigint
    and (v_drain->>'req')::bigint = (v_drain->'call'->>'id')::bigint,
    'cada función devuelve el id de la petición que registró pg_net');
end;
$sin_secreto$;

-- 2. Con functions_base_url: la base nueva, con la ruta de cada función y sin
--    cambiar headers ni body. Acá cae el control rojo: 0084/0136 llevan la URL fija.
do $con_secreto$
declare v_sync jsonb; v_drain jsonb; v_antes jsonb;
begin
  v_antes := pg_temp.run('kommo_run_sync');
  perform pg_temp.set_secret('functions_base_url', 'http://functions:9000');
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'http://functions:9000/kommo-sync',
    'con functions_base_url en Vault, kommo_run_sync llama a la base nueva');
  v_drain := pg_temp.run('kommo_run_writeback_drain');
  perform pg_temp.assert_true(v_drain->'call'->>'url' = 'http://functions:9000/kommo-writeback',
    'con functions_base_url en Vault, kommo_run_writeback_drain llama a la base nueva');
  perform pg_temp.assert_true(v_sync->'call'->'headers' = v_antes->'call'->'headers'
    and v_sync->'call'->'body' = v_antes->'call'->'body'
    and v_drain->'call'->'headers' = v_antes->'call'->'headers'
    and v_drain->'call'->'body' = v_antes->'call'->'body',
    'el secreto sólo cambia la URL: headers y body quedan como estaban');
end;
$con_secreto$;

-- 3. Un secreto con barra final no produce `//`; y con varias, tampoco.
do $barra_final$
declare v_sync jsonb; v_drain jsonb;
begin
  perform pg_temp.set_secret('functions_base_url', 'https://api.dtd.example/functions/v1/');
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'https://api.dtd.example/functions/v1/kommo-sync',
    'un secreto con barra final no produce doble barra en kommo_run_sync');
  v_drain := pg_temp.run('kommo_run_writeback_drain');
  perform pg_temp.assert_true(v_drain->'call'->>'url' = 'https://api.dtd.example/functions/v1/kommo-writeback',
    'un secreto con barra final no produce doble barra en kommo_run_writeback_drain');
  perform pg_temp.set_secret('functions_base_url', 'http://functions:9000//');
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'http://functions:9000/kommo-sync',
    'varias barras finales se recortan todas');
end;
$barra_final$;

-- 4. Cada llamada lee el Vault: cambiar o quitar el secreto rige en la siguiente
--    corrida, sin recrear nada (así se corta y se vuelve atrás sin migración).
do $en_caliente$
declare v_sync jsonb;
begin
  perform pg_temp.set_secret('functions_base_url', 'http://functions:9001');
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'http://functions:9001/kommo-sync',
    'un secreto nuevo rige en la siguiente llamada');
  perform pg_temp.set_secret('functions_base_url', null);
  v_sync := pg_temp.run('kommo_run_sync');
  perform pg_temp.assert_true(v_sync->'call'->>'url' = 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-sync',
    'quitar el secreto devuelve la URL de Cloud sin tocar la función');
end;
$en_caliente$;

-- 5. Sin kommo_cron_key se saltea igual que antes: null y ninguna petición,
--    tenga o no functions_base_url.
do $sin_cron_key$
declare v_antes bigint; v_sync jsonb; v_drain jsonb;
begin
  v_antes := (select count(*) from pg_temp.http_calls);
  perform pg_temp.set_secret('kommo_cron_key', null);
  perform pg_temp.set_secret('functions_base_url', 'http://functions:9000');
  v_sync := pg_temp.run('kommo_run_sync');
  v_drain := pg_temp.run('kommo_run_writeback_drain');
  perform pg_temp.assert_true(v_sync->'req' = 'null'::jsonb and v_drain->'req' = 'null'::jsonb
    and (v_drain->>'calls')::bigint = v_antes,
    'sin kommo_cron_key las dos devuelven null y no llaman a pg_net');
  perform pg_temp.set_secret('functions_base_url', null);
  perform pg_temp.set_secret('kommo_cron_key', 'cron-key-0472');
end;
$sin_cron_key$;

-- 6. Forma y ACL: DEFINER, search_path vacío, bigint, EXECUTE sólo para
--    service_role (ni anon, ni authenticated, ni PUBLIC), y service_role la
--    corre de verdad mientras anon recibe 42501.
do $acl$
declare v_antes bigint; v_sync text; v_drain text;
begin
  perform pg_temp.assert_true((select count(*) from pg_catalog.pg_proc p
    where p.oid in (to_regprocedure('public.kommo_run_sync()'),
                    to_regprocedure('public.kommo_run_writeback_drain()'))
      and p.prosecdef and p.prorettype = 'pg_catalog.int8'::regtype
      and p.proconfig = array['search_path=""']::text[]
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE')) = 2,
    'las dos siguen DEFINER, con search_path vacío, bigint y EXECUTE sólo para service_role');
  perform pg_temp.assert_true(pg_temp.as_role('anon', 'kommo_run_sync') = '42501'
    and pg_temp.as_role('authenticated', 'kommo_run_writeback_drain') = '42501',
    'anon y authenticated no ejecutan las funciones de Kommo');
  v_antes := (select count(*) from pg_temp.http_calls);
  -- Cada llamada va en su propia sentencia: un count en la MISMA sentencia que
  -- las llamadas no vería las filas que ellas insertan (snapshot por sentencia).
  v_sync := pg_temp.as_role('service_role', 'kommo_run_sync');
  v_drain := pg_temp.as_role('service_role', 'kommo_run_writeback_drain');
  perform pg_temp.assert_true(v_sync is null and v_drain is null
    and (select count(*) from pg_temp.http_calls) = v_antes + 2,
    'service_role ejecuta las dos y cada una registra su petición');
end;
$acl$;

-- 7. Los comentarios nombran el secreto: es lo único que un operador ve en el
--    catálogo antes de preguntarse por qué el cron llama a Cloud.
do $comentarios$
begin
  perform pg_temp.assert_true(
    obj_description(to_regprocedure('public.kommo_run_sync()'), 'pg_proc') like '%functions_base_url%'
    and obj_description(to_regprocedure('public.kommo_run_writeback_drain()'), 'pg_proc') like '%functions_base_url%',
    'los comentarios de las dos funciones nombran el secreto functions_base_url');
end;
$comentarios$;

-- 8. 0472 reemplaza (mismo oid) y no toca ninguna otra función de public ni
--    agenda nada en pg_cron.
do $sin_danos$
declare v_cron_kommo bigint := 0;
begin
  perform pg_temp.assert_true(
    (select oid from baseline_functions where proname = 'kommo_run_sync') = to_regprocedure('public.kommo_run_sync()')::oid
    and (select oid from baseline_functions where proname = 'kommo_run_writeback_drain') = to_regprocedure('public.kommo_run_writeback_drain()')::oid,
    'las dos funciones conservan su oid: se reemplazan, no se recrean');
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) not in ('kommo_run_sync', 'kommo_run_writeback_drain')
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0472 no toca ninguna otra función de public');
  if to_regclass('cron.job') is not null then
    execute $q$select count(*) from cron.job where command like '%kommo%'$q$ into v_cron_kommo;
  end if;
  perform pg_temp.assert_true(v_cron_kommo = 0, '0472 no agenda ni reagenda jobs de Kommo en pg_cron');
end;
$sin_danos$;

select 'TEST 0472 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
