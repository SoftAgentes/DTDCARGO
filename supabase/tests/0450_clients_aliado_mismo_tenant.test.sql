\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0450 (SDD-0456): un cliente sólo cuelga de un
-- aliado de SU tenant. Fixtures ficticios y rollback: no consulta ni modifica una
-- base alojada. Aplica las migraciones reales 0362 y 0450.
--
-- Lo que defiende:
--   1. RED: sin 0450, la base acepta enlazar un cliente de T1 al aliado de T2 (el
--      hueco que reprodujo L01), y la lectura de marca por ese vínculo entrega la
--      marca de la otra empresa.
--   2. Con filas incoherentes, 0450 falla en el preflight con P0001 y un mensaje
--      que lleva sólo el CONTEO (ni uuid ni Shipping Mark), sin dejar DDL ni
--      tocar filas. El archivo no contiene DML y el preflight corre primero.
--   3. Aplicada y reaplicada: catálogo idéntico y cero filas modificadas.
--   4. La FK compuesta queda validada, MATCH SIMPLE, ON DELETE RESTRICT y ON
--      UPDATE NO ACTION. La simple de la 0362 sigue viva: el embed PostgREST
--      `aliados:aliado_id` depende de ella.
--   5. Enlazar, dar de alta o mover de tenant (al cliente o al aliado) cruzando
--      tenants falla con 23503. El mismo tenant y el cliente directo se aceptan.
--      `deleted_at` no exime.
--   6. Borrar un aliado con clientes se bloquea IGUAL que antes de 0450 (mismo
--      SQLSTATE). Sin clientes se borra igual que antes. Borrar un cliente de
--      aliado y borrar el tenant entero terminan igual antes y después.

begin;

do $fixture_guard$
begin
  if to_regnamespace('auth') is not null or to_regclass('public.clients') is not null then
    raise exception 'TEST 0450 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$fixture_guard$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
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
end;
$$;

-- `clients` con las columnas que leen la 0362 y la 0450. La FK a `tenants` copia
-- la de la 0006 (`on delete cascade`), que decide cómo termina borrar un tenant.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox text,
  name text not null,
  email text, phone text, rif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  merged_into_client_id uuid
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);

-- Stub de la migr 0342: normaliza el teléfono a sus últimos 7 dígitos.
create function public.phone_match_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 7), '');
$$;

-- La migración real que creó el vínculo y su FK simple.
\ir ../migrations/0362_aliados_base.sql

-- ── Fixture ─────────────────────────────────────────────────────────────────
-- T1 (la casa): dos clientes directos, el aliado HR con un cliente propio y el
-- aliado SC sin clientes. T2 (otra empresa): el aliado DC con un cliente propio.

insert into public.tenants (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002');

insert into public.clients (id, tenant_id, markbox, name) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9058', 'Directo Uno'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9059', 'Directo Dos'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9010', 'Herneka'),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9012', 'Sin Clientes'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'DTD-9011', 'Dynasty Cargo');

insert into public.aliados (id, tenant_id, client_id, prefix, trade_name, brand_name) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000003', 'HR', 'Herneka', 'Marca HR'),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000005', 'SC', 'Sin Clientes', null),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000004', 'DC', 'Dynasty Cargo', 'Marca DC');

insert into public.clients (id, tenant_id, markbox, name, aliado_id) values
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'HR-0001',
   'Cliente de HR', 'bbbbbbbb-0000-0000-0000-00000000000a'),
  ('cccccccc-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002', 'DC-0001',
   'Cliente de DC', 'bbbbbbbb-0000-0000-0000-00000000000b');

-- ── Ayudas ──────────────────────────────────────────────────────────────────

create function pg_temp.assert_true(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'TEST 0450: %', p_label; end if;
end;
$$;

-- Ejecuta la sentencia y SIEMPRE la deshace: devuelve 'ok' o el SQLSTATE.
create function pg_temp.outcome(p_sql text) returns text
language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'PT450', message = 'deshacer';
  exception
    when sqlstate 'PT450' then return 'ok';
    when others then return sqlstate;
  end;
end;
$$;

-- La marca que le llega a un cliente por el vínculo: el mismo join de
-- `resolveBrandForClient` y de la 0401, sin RLS (como service_role).
create function pg_temp.brand_of(p_client uuid) returns text
language sql stable as $$
  select coalesce(a.brand_name, a.trade_name)
    from public.clients c
    join public.aliados a on a.id = c.aliado_id
   where c.id = p_client
$$;

create function pg_temp.row_snapshot() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'clients', (select jsonb_agg(to_jsonb(c) order by c.id) from public.clients c),
    'aliados', (select jsonb_agg(to_jsonb(a) order by a.id) from public.aliados a)
  )
$$;

create function pg_temp.constraint_shape(p_rel regclass, p_name text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'type', c.contype,
    'ref', (select n.nspname || '.' || r.relname
              from pg_class r join pg_namespace n on n.oid = r.relnamespace
             where r.oid = c.confrelid),
    'cols', (select array_agg(a.attname order by k.ord)
               from unnest(c.conkey) with ordinality as k(num, ord)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.num),
    'ref_cols', (select array_agg(a.attname order by k.ord)
                   from unnest(c.confkey) with ordinality as k(num, ord)
                   join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.num),
    'match', c.confmatchtype,
    'on_delete', c.confdeltype,
    'on_update', c.confupdtype,
    'validated', c.convalidated,
    'comment', obj_description(c.oid, 'pg_constraint')
  )
  from pg_constraint c
  where c.conrelid = p_rel and c.conname = p_name
$$;

create function pg_temp.borrados() returns jsonb
language sql volatile as $$
  select jsonb_build_object(
    'aliado_con_clientes', pg_temp.outcome(
      $q$delete from public.aliados where id = 'bbbbbbbb-0000-0000-0000-00000000000a'$q$),
    'aliado_sin_clientes', pg_temp.outcome(
      $q$delete from public.aliados where id = 'bbbbbbbb-0000-0000-0000-00000000000c'$q$),
    'cliente_de_aliado', pg_temp.outcome(
      $q$delete from public.clients where id = 'cccccccc-0000-0000-0000-000000000006'$q$),
    'tenant_entero', pg_temp.outcome(
      $q$delete from public.tenants where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$)
  )
$$;

-- ── 1. RED: sin 0450 el cruce de tenants se acepta ──────────────────────────
savepoint red_cruce;
update public.clients
   set aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000b'   -- DC, aliado de T2
 where id = 'cccccccc-0000-0000-0000-000000000001';         -- cliente directo de T1
select pg_temp.assert_true(
  pg_temp.brand_of('cccccccc-0000-0000-0000-000000000001') = 'Marca DC',
  'RED: sin 0450 el cliente de T1 debía poder recibir la marca del aliado de T2');
rollback to savepoint red_cruce;
release savepoint red_cruce;

-- ── Borrados ANTES de 0450: la referencia del punto 6 ───────────────────────
create temporary table borrados_antes as select pg_temp.borrados() as resultado;

select pg_temp.assert_true(
  (select resultado ->> 'aliado_con_clientes' <> 'ok'
      and resultado ->> 'aliado_sin_clientes' = 'ok'
      and resultado ->> 'cliente_de_aliado' = 'ok'
     from borrados_antes),
  'Referencia: hoy un aliado con clientes no se borra y uno sin clientes sí');

-- ── 2. Preflight: con filas incoherentes, 0450 falla sin tocar nada ──────────
do $contrato_preflight$
declare
  v_migration text := pg_read_file('/sb/migrations/0450_clients_aliado_mismo_tenant.sql');
  v_codigo text;
  v_failed boolean := false;
  v_state text;
  v_message text;
  v_detail text;
  v_hint text;
  v_logs text;
begin
  -- El archivo no trae DML, y el preflight es lo primero que corre. El UPDATE se
  -- reconoce por su `set`, para no confundirlo con el `on update no action` de la FK.
  v_codigo := regexp_replace(v_migration, '--[^\n]*', '', 'g');
  perform pg_temp.assert_true(
    v_codigo !~* '\m(insert\s+into|delete\s+from|merge\s+into|truncate)\M'
    and v_codigo !~* '\mupdate\s+(only\s+)?[a-z0-9_."]+(\s+(as\s+)?[a-z0-9_]+)?\s+set\M',
    'La migración contiene DML');
  perform pg_temp.assert_true(
    strpos(v_codigo, 'do $preflight$') > 0
    and strpos(v_codigo, 'do $preflight$') < strpos(v_codigo, 'alter table'),
    'El preflight no corre antes del primer DDL');

  begin
    -- Dos clientes de T1 enlazados al aliado de T2.
    update public.clients
       set aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
     where id in ('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002');

    begin
      execute v_migration;
    exception when others then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_message = message_text,
        v_detail = pg_exception_detail,
        v_hint = pg_exception_hint;
      v_failed := true;
    end;

    perform pg_temp.assert_true(v_failed, 'El preflight aceptó dos filas incoherentes');
    perform pg_temp.assert_true(
      v_state = 'P0001' and v_message like '0450: 2 cliente(s) %',
      format('El preflight falló por otra causa: %s %s', v_state, v_message));

    -- Minimización: lo que queda en los logs no identifica a nadie.
    v_logs := concat_ws(' ', v_message, v_detail, v_hint);
    perform pg_temp.assert_true(
      v_logs !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' and v_logs !~ '[A-Z]{2,4}-[0-9]',
      format('El mensaje del preflight filtra ids o Shipping Marks: %s', v_logs));

    perform pg_temp.assert_true(
      not exists (select 1 from pg_constraint
                   where conname in ('clients_aliado_mismo_tenant_fkey', 'aliados_tenant_id_id_key')),
      'El preflight dejó DDL a medias');
    perform pg_temp.assert_true(
      (select count(*) from public.clients c join public.aliados a on a.id = c.aliado_id
        where a.tenant_id <> c.tenant_id) = 2,
      'El preflight tocó las filas incoherentes');

    raise exception using errcode = 'PT451', message = 'deshacer las filas incoherentes sintéticas';
  exception when sqlstate 'PT451' then null;
  end;

  perform pg_temp.assert_true(
    (select count(*) from public.clients where aliado_id is not null) = 2,
    'El fixture no volvió a su estado coherente');
end;
$contrato_preflight$;

-- ── 3. Aplicar 0450 sobre datos coherentes: sin DML e idempotente ───────────
create temporary table filas_antes as select pg_temp.row_snapshot() as filas;

\ir ../migrations/0450_clients_aliado_mismo_tenant.sql

create temporary table catalogo_primera as
select pg_temp.constraint_shape('public.clients', 'clients_aliado_mismo_tenant_fkey') as fk,
       pg_temp.constraint_shape('public.aliados', 'aliados_tenant_id_id_key') as destino;

\ir ../migrations/0450_clients_aliado_mismo_tenant.sql

select pg_temp.assert_true(
  (select to_jsonb(p) from catalogo_primera p) = jsonb_build_object(
    'fk', pg_temp.constraint_shape('public.clients', 'clients_aliado_mismo_tenant_fkey'),
    'destino', pg_temp.constraint_shape('public.aliados', 'aliados_tenant_id_id_key')),
  'Reaplicar 0450 cambia el catálogo');
select pg_temp.assert_true((select filas from filas_antes) = pg_temp.row_snapshot(),
  'Aplicar 0450 modificó filas');

-- ── 4. Catálogo ─────────────────────────────────────────────────────────────
select pg_temp.assert_true(
  pg_temp.constraint_shape('public.clients', 'clients_aliado_mismo_tenant_fkey') - 'comment'
    = jsonb_build_object(
        'type', 'f',
        'ref', 'public.aliados',
        'cols', array['tenant_id', 'aliado_id'],
        'ref_cols', array['tenant_id', 'id'],
        'match', 's',
        'on_delete', 'r',
        'on_update', 'a',
        'validated', true),
  format('La FK compuesta no tiene la forma del contrato: %s',
    pg_temp.constraint_shape('public.clients', 'clients_aliado_mismo_tenant_fkey')));
select pg_temp.assert_true(
  pg_temp.constraint_shape('public.clients', 'clients_aliado_mismo_tenant_fkey') ->> 'comment' like 'SDD-0456:%',
  'La FK compuesta perdió su comentario');
select pg_temp.assert_true(
  pg_temp.constraint_shape('public.aliados', 'aliados_tenant_id_id_key') ->> 'type' = 'u'
  and pg_temp.constraint_shape('public.aliados', 'aliados_tenant_id_id_key') -> 'cols'
      = '["tenant_id", "id"]'::jsonb,
  'El destino de la FK no es unique (tenant_id, id)');

-- La FK simple de la 0362 sigue viva, con su RESTRICT: sin ella el embed
-- PostgREST `aliados:aliado_id` se quedaría sin relación.
select pg_temp.assert_true(
  (select count(*) from pg_constraint c
    where c.conrelid = 'public.clients'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.aliados'::regclass
      and c.conkey = array[(select a.attnum from pg_attribute a
                              where a.attrelid = 'public.clients'::regclass
                                and a.attname = 'aliado_id')]::int2[]
      and c.confdeltype = 'r'
      and c.convalidated) = 1,
  'La FK simple de la 0362 ya no está');
select pg_temp.assert_true(
  (select count(*) from pg_constraint c
    where c.conrelid = 'public.clients'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.aliados'::regclass) = 2,
  'clients debe tener exactamente dos FK hacia aliados: la simple y la compuesta');

-- ── 5. Comportamiento ───────────────────────────────────────────────────────
select pg_temp.assert_true(
  pg_temp.brand_of('cccccccc-0000-0000-0000-000000000006') = 'Marca HR',
  'El cliente de HR dejó de recibir la marca de su aliado');

select pg_temp.assert_true(pg_temp.outcome($q$
  update public.clients set aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
   where id = 'cccccccc-0000-0000-0000-000000000001'$q$) = 'ok',
  'Enlazar un cliente a un aliado de su mismo tenant quedó bloqueado');

select pg_temp.assert_true(pg_temp.outcome($q$
  insert into public.clients (tenant_id, markbox, name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9060', 'Directo Nuevo')$q$) = 'ok',
  'Un cliente directo (aliado_id NULL) quedó bloqueado');

select pg_temp.assert_true(pg_temp.outcome($q$
  insert into public.clients (tenant_id, markbox, name, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'HR-0002', 'Otro de HR',
          'bbbbbbbb-0000-0000-0000-00000000000a')$q$) = 'ok',
  'Dar de alta un cliente de un aliado del mismo tenant quedó bloqueado');

select pg_temp.assert_true(pg_temp.outcome($q$
  update public.clients set aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
   where id = 'cccccccc-0000-0000-0000-000000000001'$q$) = '23503',
  'Enlazar un cliente de T1 al aliado de T2 no falló con 23503');

-- El Shipping Mark cumple la insignia de DC, así que el guard de la 0362 lo deja
-- pasar y es la FK compuesta la que frena.
select pg_temp.assert_true(pg_temp.outcome($q$
  insert into public.clients (tenant_id, markbox, name, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'DC-0002', 'Cruzado',
          'bbbbbbbb-0000-0000-0000-00000000000b')$q$) = '23503',
  'Dar de alta un cliente de T1 bajo el aliado de T2 no falló con 23503');

select pg_temp.assert_true(pg_temp.outcome($q$
  update public.clients set deleted_at = now(), aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
   where id = 'cccccccc-0000-0000-0000-000000000002'$q$) = '23503',
  'Un cliente borrado lógicamente pudo quedar enlazado al aliado de otro tenant');

select pg_temp.assert_true(pg_temp.outcome($q$
  update public.clients set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'cccccccc-0000-0000-0000-000000000006'$q$) = '23503',
  'Mover de tenant a un cliente de HR sin soltar su aliado no falló con 23503');

select pg_temp.assert_true(pg_temp.outcome($q$
  update public.aliados set tenant_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = 'bbbbbbbb-0000-0000-0000-00000000000a'$q$) = '23503',
  'Mover de tenant al aliado HR, que tiene clientes, no falló con 23503');

-- ── 6. Borrados DESPUÉS de 0450: iguales que antes ──────────────────────────
create temporary table borrados_despues as select pg_temp.borrados() as resultado;

select pg_temp.assert_true(
  (select resultado from borrados_antes) = (select resultado from borrados_despues),
  format('Borrar cambió de comportamiento con 0450: antes %s, después %s',
    (select resultado from borrados_antes), (select resultado from borrados_despues)));

select a.resultado as borrados_antes_0450, d.resultado as borrados_despues_0450
  from borrados_antes a cross join borrados_despues d;

rollback;

select to_regclass('public.clients') is null as aliado_tenant_0450_fixture_rolled_back;
