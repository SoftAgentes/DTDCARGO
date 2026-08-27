\set ON_ERROR_STOP on

-- Contrato del Bug Reporter (SDD-0036 · migr 0028).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Es el canal por el que el equipo reporta que algo del ERP se rompió, y su
-- expediente es la historia de qué se hizo con eso: quién lo tomó, cuándo, en
-- qué quedó. Todo lo que decide esa historia vive en una máquina de estados
-- cerrada, un folio correlativo por empresa y un timeline que nadie escribe a
-- mano. Si cualquiera de las tres se afloja, el registro sigue viéndose bien y
-- deja de ser prueba de nada.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 La whitelist de transiciones. `nuevo → resuelto` de un salto no
--      existe: hay que triar. Se prueban los saltos prohibidos Y los
--      permitidos, porque una máquina que no deja avanzar tampoco sirve.
--   2. 🔴 `resuelto` y `descartado` son terminales. Un bug cerrado no se
--      reabre por la RPC. ⚠️ Lo sostienen DOS piezas: el guard explícito y el
--      hecho de que la whitelist no tenga ninguna fila que arranque en un
--      estado terminal. Arrancar el guard solo deja el caso igual de cerrado
--      —lo descubrió la mutación—, así que la que se prueba es la pérdida de
--      las dos: es lo que significa «el terminal dejó de serlo».
--   3. 🔴 Sólo un admin mueve estados, con UNA excepción exacta: el reportador
--      puede mover SU bug de `espera` a `triaje` al responder. Se prueba que
--      esa excepción no se estira — ni desde otro estado, ni hacia otro
--      estado, ni sobre el bug de otro.
--   4. 🔴 Nadie mueve el bug de otra empresa, y un miembro **deshabilitado**
--      tampoco mueve el de la suya.
--   5. 🔴 Cada transición deja su renglón en el timeline con el de-dónde y el
--      a-dónde — y el timeline no lo escribe `authenticated`: sólo el
--      servidor. Una bitácora que el interesado puede editar no es bitácora.
--   6. 🔴 El auto-sellado no se pisa: `taken_at` marca la PRIMERA vez que
--      alguien lo tomó, y volver a triaje desde espera no lo re-escribe.
--   7. 🔴 El folio es por empresa: dos empresas van cada una por su BUG-00001,
--      y `next_bug_folio` exige pertenecer al tenant que se pide.
--   8. 🔴 **Nada se borra — y el folio es único PORQUE no se puede borrar.**
--      `next_bug_folio` es `max() + 1`: si se pudiera borrar el último bug, el
--      siguiente reusaría su número y dos expedientes distintos compartirían
--      folio en la memoria de la gente. Las dos piezas van juntas.
--   9. 🔴 `bug_tech_data` no lo escribe el usuario. El reportador no sabe que
--      se captura consola, red y replay (decisión D3 del handoff); si pudiera
--      insertarlo, podría fabricarlo.
--  10. `progress_pct` no puede contradecir al estado: es columna generada. Y
--      `severity` sólo aplica a `error`.
--  11. El aislamiento de lectura: el reportador ve los suyos, el admin ve los
--      de SU empresa, y el admin de otra no ve ninguno.
--
-- ── ⚠️ DOS HUECOS MEDIDOS QUE ESTE CONTRATO **NO** CIERRA ─────────────────
--
-- No se contratan porque hoy están abiertos: una afirmación que diga que están
-- cerrados saldría roja, y una que diga que están abiertos dejaría clavado el
-- problema. Quedan escritos acá para que se decidan, no para que se olviden.
--
--   A. 🔴 **La máquina de estados tiene una segunda puerta.** El comentario de
--      la migración dice que «las transiciones de estado pasan por RPC», pero
--      nada lo obliga: hay `grant update on bug_reports to authenticated` y la
--      policy `bug_reports_admin_update`. Medido acá con el mismo Postgres —
--      un admin hace `update bug_reports set state = 'resuelto'` y el bug pasa
--      de `nuevo` a `resuelto` **de un salto, sin renglón de timeline y sin
--      `resolved_at`**; y de `resuelto` vuelve a `nuevo`, saltándose el guard
--      terminal. Es dentro de su propia empresa y sólo un admin, así que no es
--      una fuga: es el expediente que deja de ser fiel. Cerrarlo es un trigger
--      que rechace el UPDATE de `state` fuera de la RPC.
--   B. `anon` puede EJECUTAR `next_bug_folio`. Las otras dos RPC llevan su
--      `revoke ... from public, anon`; ésta no, y en Postgres las funciones
--      nacen con EXECUTE para PUBLIC. El guard interno la salva —sin
--      `auth.uid()` no hay membresía y levanta «No autorizado»— pero es la
--      única capa.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

-- Las policies de la 0028 leen `user_tenants`; sin este grant, `authenticated`
-- choca con «permission denied» antes de llegar a la policy y los contratos de
-- aislamiento pasarían por la razón equivocada.
grant select on public.user_tenants to authenticated;

\ir ../migrations/0028_bug_reporter.sql

-- 🔴 La 0028 nació MUERTA y hay que cargar su parche para probar lo que corre.
-- Su `bug_advance_state` arma el renglón del timeline con un
-- `case when … then 'admin' else 'user' end`, que Postgres resuelve como `text`,
-- contra una columna del enum `bug_author_type` — y no hay cast implícito de
-- `text` a enum en un INSERT. **Ninguna transición de estado funcionaba.** Se
-- descubrió el 2026-05-26, cuando el founder le dio a «Tomar bug» en el drawer,
-- y lo cierra la 0039 con un cast explícito. Los guards son idénticos entre las
-- dos: lo único que cambia es que la de abajo corre.
--
-- Es el argumento entero de esta spec en una línea: la migración estuvo once
-- números en el repo sin que nada la ejercitara. Un contrato la habría puesto
-- roja el día uno; lo que la encontró fue un clic.
\ir ../migrations/0039_fix_bug_advance_state_actor_type_cast.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otra-empresa');

\set admin1  'aa111111-1111-1111-1111-111111111111'
\set report1 'aa222222-1111-1111-1111-111111111111'
\set otro1   'aa333333-1111-1111-1111-111111111111'
\set baja1   'aa444444-1111-1111-1111-111111111111'
\set admin2  'aa555555-2222-2222-2222-222222222222'
insert into auth.users (id, email) values
  (:'admin1',  'admin@dtd.test'),
  (:'report1', 'reporta@dtd.test'),
  (:'otro1',   'otro@dtd.test'),
  (:'baja1',   'exadmin@dtd.test'),
  (:'admin2',  'admin@otra.test');

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  (:'admin1',  :'t1', 'admin',     null),
  (:'report1', :'t1', 'operativo', null),
  (:'otro1',   :'t1', 'operativo', null),
  (:'baja1',   :'t1', 'admin',     now()),   -- admin DESHABILITADO
  (:'admin2',  :'t2', 'admin',     null);

-- Un bug por escenario, todos del reportador salvo el de la otra empresa.
insert into public.bug_reports (id, tenant_id, folio, reporter_id, category, severity, title, description, module) values
  ('b0000001-0000-0000-0000-000000000001', :'t1', 'BUG-00001', :'report1', 'error', 'alta',  'se cae al guardar', 'revienta', '/studio/clientes'),
  ('b0000002-0000-0000-0000-000000000002', :'t1', 'BUG-00002', :'report1', 'error', 'media', 'salto prohibido',   'x',        '/studio/x'),
  ('b0000003-0000-0000-0000-000000000003', :'t1', 'BUG-00003', :'report1', 'improve', null,  'terminal',          'x',        '/studio/x'),
  ('b0000004-0000-0000-0000-000000000004', :'t1', 'BUG-00004', :'report1', 'question', null, 'permisos',          'x',        '/studio/x'),
  ('b0000005-0000-0000-0000-000000000005', :'t1', 'BUG-00005', :'report1', 'error', 'baja',  'sellado',           'x',        '/studio/x'),
  ('b0000009-0000-0000-0000-000000000009', :'t2', 'BUG-00001', :'admin2',  'error', 'alta',  'de la otra empresa','x',        '/studio/x');

-- Mueve el bug y devuelve el estado en el que QUEDÓ. Se mira el estado de la
-- fila, no el texto del error: así da igual si el guard rechaza con excepción,
-- con un no-op silencioso o de ninguna forma.
create or replace function pg_temp.mover(p_bug uuid, p_estado bug_state, p_uid uuid)
returns text language plpgsql as $m$
declare v_estado text;
begin
  perform set_config('test.uid', p_uid::text, true);
  begin
    perform public.bug_advance_state(p_bug, p_estado, 'nota de prueba');
  exception when others then
    null;
  end;
  select state::text into v_estado from public.bug_reports where id = p_bug;
  return v_estado;
end;
$m$;

-- ── 1 · 🔴 La whitelist de transiciones ───────────────────────────────────
--
-- `nuevo → resuelto` de un salto no existe: un bug se cierra después de
-- pasar por triaje, y ese paso es el que deja quién lo tomó.
do $$
declare v text;
begin
  -- (a) los saltos prohibidos desde `nuevo`
  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'resuelto',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 1 ROTO: nuevo → resuelto paso de un salto (quedo en %)', v;
  end if;

  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'progreso',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 1 ROTO: nuevo → progreso salteo el triaje (quedo en %)', v;
  end if;

  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'espera',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 1 ROTO: nuevo → espera no deberia existir (quedo en %)', v;
  end if;

  -- (b) y el camino permitido SÍ avanza: una maquina que no deja pasar nada
  --     tambien esta rota, y el contrato no lo notaria.
  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'triaje',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'triaje' then
    raise exception 'CONTRATO 1 ROTO: nuevo → triaje no avanzo (quedo en %)', v;
  end if;

  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'progreso',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'progreso' then
    raise exception 'CONTRATO 1 ROTO: triaje → progreso no avanzo (quedo en %)', v;
  end if;

  -- (c) y desde `espera` tampoco se salta a progreso
  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'espera',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'espera' then
    raise exception 'CONTRATO 1 ROTO: progreso → espera no avanzo (quedo en %)', v;
  end if;
  v := pg_temp.mover('b0000002-0000-0000-0000-000000000002', 'progreso',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'espera' then
    raise exception 'CONTRATO 1 ROTO: espera → progreso paso sin volver a triaje (quedo en %)', v;
  end if;
end;
$$;

-- ── 2 · 🔴 Un bug cerrado no se reabre ────────────────────────────────────
do $$
declare v text;
begin
  perform pg_temp.mover('b0000003-0000-0000-0000-000000000003', 'triaje',
                        'aa111111-1111-1111-1111-111111111111');
  v := pg_temp.mover('b0000003-0000-0000-0000-000000000003', 'descartado',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'descartado' then
    raise exception 'CONTRATO 2 ROTO: no se pudo descartar (quedo en %)', v;
  end if;

  -- Terminal: ni hacia atrás ni hacia el otro terminal.
  v := pg_temp.mover('b0000003-0000-0000-0000-000000000003', 'triaje',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'descartado' then
    raise exception 'CONTRATO 2 ROTO: un bug DESCARTADO se reabrio (quedo en %)', v;
  end if;
  v := pg_temp.mover('b0000003-0000-0000-0000-000000000003', 'resuelto',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'descartado' then
    raise exception 'CONTRATO 2 ROTO: un bug DESCARTADO se marco resuelto (quedo en %)', v;
  end if;
end;
$$;

-- ── 3 · 🔴 Sólo admin mueve, y la excepción no se estira ──────────────────
--
-- El reportador puede mover SU bug de `espera` a `triaje` — es cómo responde
-- una pregunta del admin. Nada más.
do $$
declare v text;
begin
  -- (a) el reportador no mueve su bug en `nuevo`
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'triaje',
                     'aa222222-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 3 ROTO: un NO admin movio el bug desde nuevo (quedo en %)', v;
  end if;

  -- (b) ni un compañero de la misma empresa que no es el reportador
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'triaje',
                     'aa333333-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 3 ROTO: un tercero de la empresa movio el bug (quedo en %)', v;
  end if;

  -- (c) el admin lo lleva a `espera` y ahí SÍ el reportador puede responder
  perform pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'triaje',
                        'aa111111-1111-1111-1111-111111111111');
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'espera',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'espera' then
    raise exception 'CONTRATO 3 ROTO: el admin no pudo poner el bug en espera (quedo en %)', v;
  end if;

  -- (d) pero SÓLO a triaje: no puede descartarlo ni cerrarlo
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'descartado',
                     'aa222222-1111-1111-1111-111111111111');
  if v <> 'espera' then
    raise exception
      'CONTRATO 3 ROTO: el reportador DESCARTO su propio bug desde espera (quedo en %)', v;
  end if;

  -- (e) y el compañero tampoco puede usar la excepción del reportador
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'triaje',
                     'aa333333-1111-1111-1111-111111111111');
  if v <> 'espera' then
    raise exception
      'CONTRATO 3 ROTO: un tercero uso la excepcion que es solo del reportador (quedo en %)', v;
  end if;

  -- (f) el reportador sí responde: espera → triaje
  v := pg_temp.mover('b0000004-0000-0000-0000-000000000004', 'triaje',
                     'aa222222-1111-1111-1111-111111111111');
  if v <> 'triaje' then
    raise exception
      'CONTRATO 3 ROTO: el reportador no pudo responder su propio bug en espera (quedo en %)', v;
  end if;
end;
$$;

-- ── 4 · 🔴 Ni de otra empresa, ni estando deshabilitado ───────────────────
do $$
declare v text;
begin
  -- (a) el admin del tenant 1 sobre el bug del tenant 2
  v := pg_temp.mover('b0000009-0000-0000-0000-000000000009', 'triaje',
                     'aa111111-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception 'CONTRATO 4 ROTO: se movio el bug de OTRA empresa (quedo en %)', v;
  end if;

  -- (b) un admin de la casa pero DESHABILITADO
  v := pg_temp.mover('b0000001-0000-0000-0000-000000000001', 'triaje',
                     'aa444444-1111-1111-1111-111111111111');
  if v <> 'nuevo' then
    raise exception
      'CONTRATO 4 ROTO: un admin DESHABILITADO movio el estado de un bug (quedo en %)', v;
  end if;

  -- (c) y lo mismo con la RPC de duplicados, que también escribe
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  begin
    perform public.bug_increment_duplicate('b0000009-0000-0000-0000-000000000009');
  exception when others then null;
  end;
  if (select duplicate_count from public.bug_reports
       where id = 'b0000009-0000-0000-0000-000000000009') <> 0 then
    raise exception
      'CONTRATO 4 ROTO: se incremento el contador de duplicados de OTRA empresa';
  end if;

  perform set_config('test.uid', 'aa444444-1111-1111-1111-111111111111', true);
  begin
    perform public.bug_increment_duplicate('b0000001-0000-0000-0000-000000000001');
  exception when others then null;
  end;
  if (select duplicate_count from public.bug_reports
       where id = 'b0000001-0000-0000-0000-000000000001') <> 0 then
    raise exception
      'CONTRATO 4 ROTO: un admin DESHABILITADO incremento el contador de duplicados';
  end if;
end;
$$;

-- ── 5 · 🔴 El timeline lo escribe el servidor, no el interesado ───────────
do $$
declare v_reng int; v_from text; v_to text;
begin
  select count(*) into v_reng from public.bug_timeline
   where bug_id = 'b0000004-0000-0000-0000-000000000004';
  -- triaje · espera · triaje = 3 movimientos del contrato 3
  if v_reng <> 3 then
    raise exception
      'CONTRATO 5 ROTO: 3 transiciones dejaron % renglon(es) de timeline', v_reng;
  end if;

  -- ⚠️ No se ordena por `created_at`: `now()` es la hora de la TRANSACCIÓN, así
  -- que los tres renglones la comparten y ordenar por tiempo no ordena nada. Se
  -- afirma sobre el CONJUNTO de saltos, que además es más fuerte.
  select string_agg(payload->>'from_state' || '→' || (payload->>'to_state'), ', '
                    order by payload->>'from_state' || '→' || (payload->>'to_state'))
    into v_from
    from public.bug_timeline
   where bug_id = 'b0000004-0000-0000-0000-000000000004';
  if v_from is distinct from 'espera→triaje, nuevo→triaje, triaje→espera' then
    raise exception
      'CONTRATO 5 ROTO: el timeline no dice de donde a donde — quedo «%»', v_from;
  end if;

  -- Y el interesado no puede escribirlo ni corregirlo.
  if has_table_privilege('authenticated', 'public.bug_timeline', 'insert')
     or has_table_privilege('authenticated', 'public.bug_timeline', 'update')
     or has_table_privilege('authenticated', 'public.bug_timeline', 'delete') then
    raise exception
      'CONTRATO 5 ROTO: authenticated puede escribir el timeline — deja de ser bitacora';
  end if;
end;
$$;

-- ── 6 · 🔴 El sellado marca la PRIMERA vez, y no se pisa ──────────────────
--
-- ⚠️ `now()` en Postgres es la hora de la TRANSACCIÓN: si no se antedata, un
-- segundo sellado escribiría el mismo valor y el contrato pasaría con el guard
-- arrancado.
do $$
declare v_taken timestamptz; v_por uuid; v_res timestamptz;
begin
  perform pg_temp.mover('b0000005-0000-0000-0000-000000000005', 'triaje',
                        'aa111111-1111-1111-1111-111111111111');
  select taken_at, taken_by into v_taken, v_por
    from public.bug_reports where id = 'b0000005-0000-0000-0000-000000000005';
  if v_taken is null or v_por is distinct from 'aa111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'CONTRATO 6 ROTO: entrar a triaje no sello quien lo tomo (at=% by=%)', v_taken, v_por;
  end if;

  update public.bug_reports
     set taken_at = timestamptz '2020-01-01 00:00:00+00'
   where id = 'b0000005-0000-0000-0000-000000000005';

  perform pg_temp.mover('b0000005-0000-0000-0000-000000000005', 'espera',
                        'aa111111-1111-1111-1111-111111111111');
  perform pg_temp.mover('b0000005-0000-0000-0000-000000000005', 'triaje',
                        'aa111111-1111-1111-1111-111111111111');

  select taken_at into v_taken
    from public.bug_reports where id = 'b0000005-0000-0000-0000-000000000005';
  if v_taken <> timestamptz '2020-01-01 00:00:00+00' then
    raise exception
      'CONTRATO 6 ROTO: volver a triaje re-escribio taken_at — se perdio cuando lo tomaron de verdad';
  end if;

  -- Y al cerrar sí se sella el cierre.
  perform pg_temp.mover('b0000005-0000-0000-0000-000000000005', 'progreso',
                        'aa111111-1111-1111-1111-111111111111');
  perform pg_temp.mover('b0000005-0000-0000-0000-000000000005', 'resuelto',
                        'aa111111-1111-1111-1111-111111111111');
  select resolved_at into v_res
    from public.bug_reports where id = 'b0000005-0000-0000-0000-000000000005';
  if v_res is null then
    raise exception 'CONTRATO 6 ROTO: se marco resuelto sin sellar resolved_at';
  end if;
end;
$$;

-- ── 7 · 🔴 El folio es por empresa ────────────────────────────────────────
--
-- Los contadores van desparejos a propósito: con un solo bug por empresa,
-- filtrar o no filtrar daría el mismo número y el contrato no distinguiría las
-- dos hipótesis.
do $$
declare v_f1 text; v_f2 text; v_ajeno text;
begin
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  v_f1 := public.next_bug_folio('11111111-1111-1111-1111-111111111111');
  if v_f1 <> 'BUG-00006' then
    raise exception 'CONTRATO 7 ROTO: el proximo folio del tenant 1 es % (esperado BUG-00006)', v_f1;
  end if;

  perform set_config('test.uid', 'aa555555-2222-2222-2222-222222222222', true);
  v_f2 := public.next_bug_folio('22222222-2222-2222-2222-222222222222');
  if v_f2 <> 'BUG-00002' then
    raise exception
      'CONTRATO 7 ROTO: la otra empresa arranco en % — le contaron los bugs ajenos', v_f2;
  end if;

  -- Y no se pide el folio de una empresa a la que no se pertenece.
  --
  -- ⚠️ El intento se aísla y la afirmación va AFUERA. Un `raise exception` en
  -- plpgsql sale con sqlstate P0001 — el mismo que levanta la RPC —, así que
  -- una versión anterior de este contrato atrapaba su PROPIO fallo en su propio
  -- `exception when` y salía verde con el guard arrancado.
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  begin
    v_ajeno := public.next_bug_folio('22222222-2222-2222-2222-222222222222');
  exception when others then
    v_ajeno := null;
  end;
  if v_ajeno is not null then
    raise exception
      'CONTRATO 7 ROTO: se quemo un folio de OTRA empresa (devolvio %)', v_ajeno;
  end if;
end;
$$;

-- ── 8 · 🔴 Nada se borra — y por eso el folio no se recicla ───────────────
--
-- `next_bug_folio` es `max() + 1`. Las dos piezas se sostienen entre sí: si
-- `authenticated` pudiera borrar el último bug, el siguiente reusaría su número
-- y dos expedientes distintos compartirían folio.
do $$
declare v_tabla text;
begin
  foreach v_tabla in array array[
    'public.bug_reports', 'public.bug_attachments', 'public.bug_tech_data',
    'public.bug_messages', 'public.bug_timeline', 'public.bug_notifications'
  ] loop
    if has_table_privilege('authenticated', v_tabla, 'delete') then
      raise exception 'CONTRATO 8 ROTO: authenticated puede BORRAR de %', v_tabla;
    end if;
  end loop;

  -- Y los mensajes del expediente tampoco se editan después de escritos.
  if has_table_privilege('authenticated', 'public.bug_messages', 'update')
     or has_table_privilege('authenticated', 'public.bug_attachments', 'update') then
    raise exception
      'CONTRATO 8 ROTO: authenticated puede reescribir mensajes o adjuntos del expediente';
  end if;

  -- La policy de borrado existe y niega, además del grant ausente.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'bug_reports'
       and cmd = 'DELETE' and qual = 'false'
  ) then
    raise exception 'CONTRATO 8 ROTO: bug_reports perdio su policy de DELETE que niega';
  end if;
end;
$$;

-- ── 9 · 🔴 Los datos técnicos no los escribe el usuario ───────────────────
--
-- El reportador no sabe que se captura consola, red y replay (decisión D3 del
-- handoff). Si pudiera insertarlos, podría fabricarlos.
do $$
begin
  if has_table_privilege('authenticated', 'public.bug_tech_data', 'insert')
     or has_table_privilege('authenticated', 'public.bug_tech_data', 'update') then
    raise exception 'CONTRATO 9 ROTO: authenticated escribe bug_tech_data';
  end if;
  if not has_table_privilege('service_role', 'public.bug_tech_data', 'insert') then
    raise exception 'CONTRATO 9 ROTO: el servidor perdio el insert de bug_tech_data';
  end if;
  if has_table_privilege('anon', 'public.bug_tech_data', 'select')
     or has_table_privilege('anon', 'public.bug_reports', 'select') then
    raise exception 'CONTRATO 9 ROTO: anon lee el Bug Reporter';
  end if;
end;
$$;

-- ── 10 · El porcentaje no puede contradecir al estado ─────────────────────
do $$
declare r record;
begin
  -- El CASE va dentro del SELECT y no dentro del IF: plpgsql corta la expresión
  -- de un `if` en el primer `then`, y un CASE trae los suyos.
  select state::text as st, progress_pct as pct into r
    from public.bug_reports
   where progress_pct <> (case state::text
                            when 'nuevo' then 0 when 'triaje' then 25 when 'espera' then 40
                            when 'progreso' then 65 when 'resuelto' then 100 else 0 end)
   limit 1;
  if r.st is not null then
    raise exception
      'CONTRATO 10 ROTO: un bug en «%» muestra % %% de avance', r.st, r.pct;
  end if;

  -- Y la severidad sólo aplica a los errores: una «sugerencia crítica» no es
  -- una categoría, es ruido en el triaje.
  begin
    insert into public.bug_reports (tenant_id, folio, reporter_id, category, severity, title, description, module)
    values ('11111111-1111-1111-1111-111111111111', 'BUG-09999',
            'aa222222-1111-1111-1111-111111111111', 'suggest', 'critica', 'x', 'x', '/x');
    raise exception 'CONTRATO 10 ROTO: se guardo una SUGERENCIA con severidad critica';
  exception when check_violation then
    null;
  end;
end;
$$;

-- ── 11 · El aislamiento de lectura ────────────────────────────────────────
do $$
declare v_n int;
begin
  set local role authenticated;

  -- (a) el admin de la otra empresa no ve nada de la primera
  perform set_config('test.uid', 'aa555555-2222-2222-2222-222222222222', true);
  select count(*) into v_n from public.bug_reports
   where tenant_id = '11111111-1111-1111-1111-111111111111';
  if v_n > 0 then
    raise exception
      'CONTRATO 11 ROTO: el admin de otra empresa ve % bug(s) ajenos', v_n;
  end if;

  -- (b) el admin de la casa ve los suyos
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  select count(*) into v_n from public.bug_reports;
  if v_n <> 5 then
    raise exception 'CONTRATO 11 ROTO: el admin de la casa ve % de sus 5 bugs', v_n;
  end if;

  -- (c) el tercero, que no es admin ni reportador, no ve ninguno
  perform set_config('test.uid', 'aa333333-1111-1111-1111-111111111111', true);
  select count(*) into v_n from public.bug_reports;
  if v_n > 0 then
    raise exception
      'CONTRATO 11 ROTO: un operativo que no reporto ve % bug(s) de sus companeros', v_n;
  end if;

  -- (d) el reportador ve los suyos
  perform set_config('test.uid', 'aa222222-1111-1111-1111-111111111111', true);
  select count(*) into v_n from public.bug_reports;
  if v_n <> 5 then
    raise exception 'CONTRATO 11 ROTO: el reportador ve % de sus 5 bugs', v_n;
  end if;

  reset role;
exception when others then
  reset role;
  raise;
end;
$$;

rollback;
