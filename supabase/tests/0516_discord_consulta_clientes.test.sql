\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0516 (SDD-0608).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. La búsqueda escapa `%`, `_` y `\`, y `*` es literal: un comodín no
--      devuelve «todos». Un término sin palabras de 2+ caracteres no devuelve nada.
--   2. Busca por palabras, sin mayúsculas ni acentos, sólo en el tenant pedido
--      y sin clientes eliminados.
--   3. Devuelve SÓLO markbox y name, con tope de 25.
--   4. El límite por minuto frena la consulta que lo pasa y la anota como
--      'limite'; no frena a otra persona ni cuenta filas de hace más de un minuto.
--   5. La retención borra filas de más de 180 días.
--   6. Ni anon ni authenticated leen la tabla ni ejecutan las funciones.
--   7. Aplicarla dos veces no falla.

begin;

do $roles$
begin
  if to_regclass('public.tenants') is not null then
    raise exception 'TEST 0516 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
create table auth.users (id uuid primary key);
create table public.tenants (id uuid primary key);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  name text not null,
  phone text,
  email text,
  deleted_at timestamptz
);
grant select on public.clients to service_role;

insert into auth.users values ('00000000-0000-4000-8000-0000000000aa');
insert into public.tenants values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

insert into public.clients (tenant_id, markbox, name, phone, deleted_at) values
  ('00000000-0000-4000-8000-000000000001', 'DTD-0001', 'Pedro Pérez',       '0412-0000001', null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0002', 'PEDRO JOSE PEREZ',  '0412-0000002', null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0003', 'Pérez Gómez, Pedro', null,          null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0004', 'Inversiones 100% C.A.', null,       null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0005', 'Ana_Luisa',         null,           null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0006', 'AnaXLuisa',         null,           null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0007', 'Ana*Luisa',         null,           null),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0008', 'Pedro Pérez',       null,           now()),
  ('00000000-0000-4000-8000-000000000001', 'DTD-0009', 'Muñoz Peña',        null,           null),
  ('00000000-0000-4000-8000-000000000002', 'DTD-0010', 'Pedro Pérez',       null,           null);

insert into public.clients (tenant_id, markbox, name)
select '00000000-0000-4000-8000-000000000001', 'DTD-1' || lpad(g::text, 3, '0'), 'Comercial Lote ' || g
  from generate_series(1, 30) g;

\ir ../migrations/0516_discord_consulta_clientes.sql

-- 7. Idempotente.
\ir ../migrations/0516_discord_consulta_clientes.sql

set local role service_role;

-- 1 a 3. Búsqueda.
do $busqueda$
declare
  v_caso record;
  v_obtenido text;
begin
  for v_caso in
    select * from (values
      ('palabras sin acento',  'pedro perez',  10, 'DTD-0001,DTD-0002,DTD-0003'),
      ('mayúsculas y acentos', 'PÉREZ',        10, 'DTD-0001,DTD-0002,DTD-0003'),
      ('ñ sin tilde',          'munoz pena',   10, 'DTD-0009'),
      ('ñ con tilde',          'Muñoz',        10, 'DTD-0009'),
      ('% solo',               '%',            10, ''),
      ('%% literal',           '%%',           10, ''),
      ('% dentro',             '100%',         10, 'DTD-0004'),
      ('_ literal',            'ana_luisa',    10, 'DTD-0005'),
      ('* literal',            'ana*luisa',    10, 'DTD-0007'),
      ('\ literal',            'ana\luisa',    10, ''),
      ('vacío',                '',             10, ''),
      ('espacios',             '   ',          10, ''),
      ('una letra',            'a',            10, ''),
      ('palabra de 1 se salta','p perez',      10, 'DTD-0001,DTD-0002,DTD-0003'),
      ('nulo',                 null,           10, '')
    ) as t(nombre, termino, limite, esperado)
  loop
    select coalesce(string_agg(r.markbox, ',' order by r.markbox), '')
      into v_obtenido
      from public.discord_buscar_clientes('00000000-0000-4000-8000-000000000001', v_caso.termino, v_caso.limite) r;
    if v_obtenido is distinct from v_caso.esperado then
      raise exception 'CONTRATO 1/2: búsqueda «%» (%) dio [%], esperaba [%]',
        v_caso.termino, v_caso.nombre, v_obtenido, v_caso.esperado;
    end if;
  end loop;

  -- Otro tenant: sólo el suyo.
  select coalesce(string_agg(r.markbox, ','), '') into v_obtenido
    from public.discord_buscar_clientes('00000000-0000-4000-8000-000000000002', 'pedro', 10) r;
  if v_obtenido <> 'DTD-0010' then
    raise exception 'CONTRATO 2: el tenant 2 vio [%]', v_obtenido;
  end if;

  -- 3. Topes.
  if (select count(*) from public.discord_buscar_clientes('00000000-0000-4000-8000-000000000001', 'lote', 11)) <> 11 then
    raise exception 'CONTRATO 3: el tope pedido de 11 no se respetó';
  end if;
  if (select count(*) from public.discord_buscar_clientes('00000000-0000-4000-8000-000000000001', 'lote', 1000)) <> 25 then
    raise exception 'CONTRATO 3: el techo de 25 no se respetó';
  end if;
end;
$busqueda$;

reset role;

-- 3. Sólo dos columnas: markbox y name.
do $columnas$
begin
  if pg_get_function_result('public.discord_buscar_clientes(uuid, text, integer)'::regprocedure)
     <> 'TABLE(markbox text, name text)' then
    raise exception 'CONTRATO 3: la búsqueda devuelve otras columnas: %',
      pg_get_function_result('public.discord_buscar_clientes(uuid, text, integer)'::regprocedure);
  end if;
  -- Cada dato personal del registro lleva su finalidad junto a la columna.
  if exists (
    select 1
      from unnest(array['discord_user_id', 'user_id', 'termino']) as c(nombre)
     where col_description(
             'public.discord_consultas_clientes'::regclass,
             (select attnum from pg_attribute
               where attrelid = 'public.discord_consultas_clientes'::regclass and attname = c.nombre)
           ) is null
  ) then
    raise exception 'CONTRATO 3: una columna con dato personal no documenta su finalidad';
  end if;
end;
$columnas$;

-- 4 y 5. Registro y límite.
set local role service_role;

insert into public.discord_consultas_clientes (created_at, discord_user_id, termino, resultado) values
  (now() - interval '2 minutes', '111111111111111111', 'viejo', 'ok'),
  (now() - interval '200 days',  '333333333333333333', 'vencido', 'ok');

do $limite$
declare
  i integer;
  v_ok boolean;
begin
  for i in 1..3 loop
    v_ok := public.discord_consulta_registrar(
      '111111111111111111', '00000000-0000-4000-8000-0000000000aa',
      '00000000-0000-4000-8000-000000000001', 'pedro', 'ok', 3);
    if not v_ok then
      raise exception 'CONTRATO 4: la consulta % de 3 quedó frenada', i;
    end if;
  end loop;

  v_ok := public.discord_consulta_registrar(
    '111111111111111111', '00000000-0000-4000-8000-0000000000aa',
    '00000000-0000-4000-8000-000000000001', 'pedro', 'ok', 3);
  if v_ok then
    raise exception 'CONTRATO 4: la cuarta consulta del minuto pasó el tope de 3';
  end if;

  -- Otra persona no queda frenada; sin enlace también se anota.
  v_ok := public.discord_consulta_registrar('222222222222222222', null, null, 'pedro', 'sin_enlace', 3);
  if not v_ok then
    raise exception 'CONTRATO 4: el tope de una persona frenó a otra';
  end if;

  if (select count(*) from public.discord_consultas_clientes
       where discord_user_id = '111111111111111111' and resultado = 'limite') <> 1 then
    raise exception 'CONTRATO 4: la consulta frenada no quedó anotada como limite';
  end if;
  if (select count(*) from public.discord_consultas_clientes
       where discord_user_id = '111111111111111111' and resultado = 'ok') <> 4 then
    raise exception 'CONTRATO 4: faltan filas ok (3 nuevas y 1 de hace 2 minutos)';
  end if;

  -- 5. Retención.
  if exists (select 1 from public.discord_consultas_clientes where termino = 'vencido') then
    raise exception 'CONTRATO 5: la fila de hace 200 días no se borró';
  end if;

  -- Un término vacío se anota sin romper el CHECK.
  perform public.discord_consulta_registrar('444444444444444444', null, null, '   ', 'sin_enlace', 3);
  if not exists (select 1 from public.discord_consultas_clientes where termino = '(vacío)') then
    raise exception 'CONTRATO 4: el término vacío no se anotó';
  end if;

  -- Resultado inválido: lo frena el CHECK.
  begin
    perform public.discord_consulta_registrar('555555555555555555', null, null, 'x', 'inventado', 3);
    raise exception 'CONTRATO 4: entró un resultado inventado';
  exception
    when check_violation then null;
  end;
end;
$limite$;

reset role;

-- 6. Ni anon ni authenticated.
do $privilegios$
declare
  v_rol text;
  v_sql text;
begin
  -- Primero el privilegio en sí. Las funciones son SECURITY INVOKER: si un rol
  -- tuviera EXECUTE, igual caería por no poder leer `clients` o la tabla, y el
  -- bloque de abajo pasaría por la razón equivocada (lo mostró el CI de la #387).
  foreach v_rol in array array['anon', 'authenticated'] loop
    if has_function_privilege(v_rol, 'public.discord_buscar_clientes(uuid, text, integer)', 'EXECUTE') then
      raise exception 'CONTRATO 6: % tiene EXECUTE sobre discord_buscar_clientes', v_rol;
    end if;
    if has_function_privilege(v_rol, 'public.discord_consulta_registrar(text, uuid, uuid, text, text, integer)', 'EXECUTE') then
      raise exception 'CONTRATO 6: % tiene EXECUTE sobre discord_consulta_registrar', v_rol;
    end if;
    if has_table_privilege(v_rol, 'public.discord_consultas_clientes', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
      raise exception 'CONTRATO 6: % tiene privilegios sobre discord_consultas_clientes', v_rol;
    end if;
  end loop;

  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_sql in array array[
      'select count(*) from public.discord_consultas_clientes',
      'insert into public.discord_consultas_clientes (discord_user_id, termino, resultado) values (''111111111111111111'', ''x'', ''ok'')',
      'delete from public.discord_consultas_clientes',
      'select * from public.discord_buscar_clientes(''00000000-0000-4000-8000-000000000001'', ''pedro'', 10)',
      'select public.discord_consulta_registrar(''111111111111111111'', null, null, ''x'', ''ok'', 3)'
    ] loop
      begin
        execute format('set local role %I', v_rol);
        execute v_sql;
        reset role;
        raise exception 'CONTRATO 6: % pudo ejecutar: %', v_rol, v_sql;
      exception
        when insufficient_privilege then reset role;
      end;
    end loop;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_policies
     where schemaname = 'public' and tablename = 'discord_consultas_clientes'
  ) then
    raise exception 'CONTRATO 6: la tabla no debía tener policies';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.discord_consultas_clientes'::regclass) then
    raise exception 'CONTRATO 6: RLS apagada';
  end if;
end;
$privilegios$;

rollback;

\echo 'TEST 0516 OK'
