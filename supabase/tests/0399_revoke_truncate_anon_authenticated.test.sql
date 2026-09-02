\set ON_ERROR_STOP on

-- Contrato del revoke de TRUNCATE (migr 0399).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- `TRUNCATE` **ignora RLS por completo**. Ninguna policy lo detiene, ni la mejor
-- escrita: es la única operación de borrado masivo que se salta el modelo de
-- seguridad entero del ERP. Medido en prod el 2026-08-28, `anon` lo tenía en 180
-- de las 249 tablas de `public` y `authenticated` en 205 — sin que ninguna
-- migración lo concediera. Entró fuera de banda, por los default privileges de
-- la plataforma.
--
-- ── ⚠️ POR QUÉ ESTE CONTRATO ENSUCIA EL FIXTURE A PROPÓSITO ───────────────
--
-- Éste es el punto entero del archivo, y sin él sería un placebo.
--
-- El schema reconstruido desde `supabase/migrations/` **sale limpio**: los
-- default privileges que abren el agujero en producción no viven en ninguna
-- migración, así que aquí `anon` nunca tuvo TRUNCATE para empezar. Un contrato
-- que se limitara a afirmar «anon no puede truncar» pasaría **verde sin haber
-- medido nada**, y seguiría verde el día que alguien reabra el permiso en prod.
--
-- Por eso el fixture **concede primero** el privilegio —reproduciendo el estado
-- real— y sólo entonces aplica la migración. Y antes del `\ir` hay un **control
-- positivo** que falla si el fixture NO quedó sucio: si el `grant` dejara de
-- tomar efecto, el contrato se delataría en vez de mentir en verde.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   0. 🔴 CONTROL POSITIVO: el fixture reproduce el agujero. Sin esto, los
--      contratos 1-3 no prueban nada.
--   1. 🔴 `anon` y `authenticated` pierden TRUNCATE en TODAS las tablas del
--      schema, no en una.
--   2. 🔴 `service_role` y `postgres` lo CONSERVAN — el borrado masivo legítimo
--      (workers, retención) no se toca. Un candado que traba a quien sí debe
--      borrar no es un candado, es un daño.
--   3. 🔴 El resto de los privilegios sobrevive: esto quita `D`, no el CRUD.
--      Revocar de más rompería el ERP entero en silencio.
--
-- ⚠️ LO QUE ESTE CONTRATO **NO** PUEDE VIGILAR: el default privilege de
-- `supabase_admin` sobre `public` incluye `D` para ambos roles, así que una
-- tabla creada POR ESE ROL nacería con TRUNCATE. No se puede cambiar sin ser
-- `supabase_admin` y hoy no ocurre (las 249 tablas de prod son de `postgres`,
-- cuyo default NO los incluye). Queda escrito en la migración.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Fixture: tres tablas cualesquiera ─────────────────────────────────────
create table public.tabla_uno  (id int primary key);
create table public.tabla_dos  (id int primary key);
create table public.tabla_tres (id int primary key);

-- ⚠️ Se REPRODUCE el estado de producción: el `grant all` que entró fuera de
-- banda. Sin esta línea el contrato mide un agujero que no existe en el fixture.
grant all on public.tabla_uno, public.tabla_dos, public.tabla_tres
  to anon, authenticated, service_role;

-- ── 0 · 🔴 CONTROL POSITIVO ───────────────────────────────────────────────
--
-- ¿El fixture quedó sucio de verdad? Si el `grant` de arriba dejara de tomar
-- efecto, los contratos 1-3 pasarían solos y en verde sin probar nada. Este
-- bloque hace que el archivo se delate en vez de mentir.
do $$
begin
  if not has_table_privilege('anon', 'public.tabla_uno', 'truncate')
     or not has_table_privilege('authenticated', 'public.tabla_dos', 'truncate') then
    raise exception
      'CONTRATO 0 ROTO: el fixture NO reproduce el agujero — anon/authenticated no '
      'llegaron a tener TRUNCATE, asi que los contratos de abajo no prueban nada. '
      'Revisar el «grant all» del fixture antes de creerle a este archivo';
  end if;
end;
$$;

-- Recién ahora, con el agujero reproducido, se aplica el candado.
\ir ../migrations/0399_revoke_truncate_anon_authenticated.sql

-- ── 1 · 🔴 Los dos roles pierden TRUNCATE en TODAS las tablas ─────────────
--
-- «en todas» no es adorno: el revoke es `on all tables in schema public`, y un
-- error de alcance que sólo cubriera una tabla se vería idéntico en un contrato
-- que mirara una sola.
do $$
declare v_quedan int;
begin
  select count(*) into v_quedan
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'truncate')
         or has_table_privilege('authenticated', c.oid, 'truncate'));

  if v_quedan > 0 then
    raise exception
      'CONTRATO 1 ROTO: % tabla(s) siguen dejando TRUNCATE a anon o authenticated. '
      'TRUNCATE ignora RLS: quien lo tenga se lleva la tabla entera sin que ninguna '
      'policy lo frene', v_quedan;
  end if;
end;
$$;

-- ── 2 · 🔴 El borrado masivo LEGÍTIMO sobrevive ───────────────────────────
do $$
begin
  if not has_table_privilege('service_role', 'public.tabla_uno', 'truncate') then
    raise exception
      'CONTRATO 2 ROTO: service_role perdio TRUNCATE — los workers de retencion y '
      'mantenimiento quedan sin brazo. El revoke se paso de alcance';
  end if;
  if not has_table_privilege('postgres', 'public.tabla_uno', 'truncate') then
    raise exception 'CONTRATO 2 ROTO: postgres perdio TRUNCATE sobre sus propias tablas';
  end if;
end;
$$;

-- ── 3 · 🔴 Se quita `D`, no el CRUD ───────────────────────────────────────
--
-- Un `revoke all` en vez de `revoke truncate` dejaría el ERP mudo: el Studio
-- entero lee y escribe como `authenticated`. Ese error no da error — da una app
-- que no muestra nada.
do $$
declare r record;
begin
  for r in select unnest(array['select','insert','update','delete']) as priv loop
    if not has_table_privilege('authenticated', 'public.tabla_uno', r.priv) then
      raise exception
        'CONTRATO 3 ROTO: authenticated perdio %, que no era el objetivo. El Studio '
        'entero opera con ese rol: revocar de mas lo deja mudo sin lanzar un error', r.priv;
    end if;
  end loop;

  -- anon conserva lo suyo (en el fixture tenía todo; en prod tiene lo que cada
  -- migración le dio — lo que importa es que ESTA no se lo quite).
  if not has_table_privilege('anon', 'public.tabla_uno', 'select') then
    raise exception 'CONTRATO 3 ROTO: anon perdio SELECT, que no era el objetivo';
  end if;
end;
$$;

rollback;
