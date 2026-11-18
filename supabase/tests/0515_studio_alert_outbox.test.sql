\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0515 (SDD-0606).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege:
--   1. La cola sólo acepta el aviso MÍNIMO: una clave de más (un nombre, un
--      teléfono, el texto completo) no entra. Es la barrera de la base detrás
--      de la del código.
--   2. Las menciones sólo son IDs de Discord.
--   3. Nadie de la aplicación la lee ni la escribe: ni `anon` ni
--      `authenticated`. Sólo `service_role`.
--   4. Una fila no puede quedar entregada y abandonada a la vez.
--   5. Aplicarla dos veces no falla.

begin;

do $roles$
begin
  if to_regclass('public.tenants') is not null then
    raise exception 'TEST 0515 requiere una base PostgreSQL desechable vacía';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema if not exists extensions;
create or replace function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;
grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);
insert into public.tenants values ('00000000-0000-4000-8000-000000000001');

\ir ../migrations/0515_studio_alert_outbox.sql

-- 5. Idempotente.
\ir ../migrations/0515_studio_alert_outbox.sql

-- Una fila válida entra (como service_role, que es quien escribe).
set local role service_role;
insert into public.studio_alert_outbox (tenant_id, category, payload, mention_user_ids)
values (
  '00000000-0000-4000-8000-000000000001',
  'registro',
  '{"titulo":"Cliente nuevo","codigo":"DTD-0123","url":"https://dtdcargo.com/studio/clientes/DTD-0123"}',
  array['111111111111111111']
);
insert into public.studio_alert_outbox (tenant_id, category, payload)
values (
  '00000000-0000-4000-8000-000000000001',
  'reportes',
  '{"titulo":"Reporte diario","conteos":[{"etiqueta":"Recepciones","valor":3}]}'
);
reset role;

-- 1, 2 y 4. Lo que NO entra: cada caso tiene que caer por un CHECK (23514).
do $rechazos$
declare
  v_caso record;
begin
  for v_caso in
    select * from (values
      ('clave de más',      'registro', '{"titulo":"Cliente nuevo","nombre":"María Pérez"}'::jsonb, '{}'::text[]),
      ('texto completo',    'registro', '{"titulo":"x","telegramText":"María · 0412"}'::jsonb,    '{}'::text[]),
      ('sin título',        'registro', '{"codigo":"DTD-1"}'::jsonb,                              '{}'::text[]),
      ('título no texto',   'registro', '{"titulo":5}'::jsonb,                                    '{}'::text[]),
      ('no es objeto',      'registro', '["titulo"]'::jsonb,                                      '{}'::text[]),
      ('demasiado grande',  'registro', jsonb_build_object('titulo', repeat('x', 3000)),          '{}'::text[]),
      ('categoría inválida','ventas',   '{"titulo":"x"}'::jsonb,                                  '{}'::text[]),
      ('mención inválida',  'registro', '{"titulo":"x"}'::jsonb,                                  array['everyone']),
      ('mención corta',     'registro', '{"titulo":"x"}'::jsonb,                                  array['1234'])
    ) as t(nombre, category, payload, menciones)
  loop
    begin
      insert into public.studio_alert_outbox (tenant_id, category, payload, mention_user_ids)
      values ('00000000-0000-4000-8000-000000000001', v_caso.category, v_caso.payload, v_caso.menciones);
      raise exception 'CONTRATO 1/2: entró una fila inválida (%)', v_caso.nombre;
    exception
      when check_violation then null;
    end;
  end loop;

  begin
    update public.studio_alert_outbox
       set delivered_at = now(), abandoned_at = now()
     where category = 'registro';
    raise exception 'CONTRATO 4: una fila quedó entregada y abandonada a la vez';
  exception
    when check_violation then null;
  end;
end;
$rechazos$;

-- 3. Ni anon ni authenticated: sin privilegio de tabla, cada acceso cae (42501).
do $privilegios$
declare
  v_rol text;
  v_sql text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_sql in array array[
      'select count(*) from public.studio_alert_outbox',
      'insert into public.studio_alert_outbox (tenant_id, category, payload) values (''00000000-0000-4000-8000-000000000001'', ''bugs'', ''{"titulo":"x"}'')',
      'update public.studio_alert_outbox set attempts = attempts + 1',
      'delete from public.studio_alert_outbox'
    ] loop
      begin
        execute format('set local role %I', v_rol);
        execute v_sql;
        reset role;
        raise exception 'CONTRATO 3: % pudo ejecutar: %', v_rol, v_sql;
      exception
        when insufficient_privilege then reset role;
      end;
    end loop;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_policies
     where schemaname = 'public' and tablename = 'studio_alert_outbox'
  ) then
    raise exception 'CONTRATO 3: la tabla no debía tener policies';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.studio_alert_outbox'::regclass) then
    raise exception 'CONTRATO 3: RLS apagada';
  end if;
end;
$privilegios$;

do $conteo$
begin
  if (select count(*) from public.studio_alert_outbox) <> 2 then
    raise exception 'se esperaban exactamente las 2 filas válidas';
  end if;
end;
$conteo$;

rollback;

\echo 'TEST 0515 OK'
