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
--  12. 🔴 `anon` no ejecuta `next_bug_folio`. La 0028 le puso el `grant` a
--      `authenticated` sin el `revoke ... from public, anon` que sí llevan sus
--      dos RPC hermanas, y en Postgres las funciones nacen con EXECUTE para
--      PUBLIC. Lo cierra la 0394 (ver abajo por qué esto NO era una fuga viva).
--  13. Los dos mensajes que el usuario LEE están en tuteo. No es cosmética:
--      `app/studio/(app)/bugs/actions.ts:83` devuelve `error.message` crudo al
--      cliente, así que el texto del `raise exception` ES la copy de la
--      pantalla. La ruta API los mapea a mensajes propios; la server action no.
--
-- ── ⚠️ EL HUECO MEDIDO QUE ESTE CONTRATO **NO** CIERRA ────────────────────
--
-- No se contrata porque hoy está abierto: una afirmación que diga que está
-- cerrado saldría roja, y una que diga que está abierto dejaría clavado el
-- problema. Queda escrito acá para que se decida, no para que se olvide.
--
--   🔴 **La máquina de estados tiene una segunda puerta.** El comentario de
--      la migración dice que «las transiciones de estado pasan por RPC», pero
--      nada lo obliga: hay `grant update on bug_reports to authenticated` y la
--      policy `bug_reports_admin_update`. Medido acá con el mismo Postgres —
--      un admin hace `update bug_reports set state = 'resuelto'` y el bug pasa
--      de `nuevo` a `resuelto` **de un salto, sin renglón de timeline y sin
--      `resolved_at`**; y de `resuelto` vuelve a `nuevo`, saltándose el guard
--      terminal. Es dentro de su propia empresa y sólo un admin, así que no es
--      una fuga: es el expediente que deja de ser fiel. Cerrarlo es un trigger
--      que rechace el UPDATE de `state` fuera de la RPC.
--
-- ── 📏 EL SEGUNDO HUECO ERA DEL ARCHIVO, NO DE LA BASE ────────────────────
--
-- Acá decía que `anon` puede EJECUTAR `next_bug_folio`, medido en este mismo
-- Postgres. Era cierto **de este replay** y falso de producción, y la
-- diferencia importa más que el hallazgo.
--
-- Este harness es AISLADO a propósito: hace `\ir` de su propia migración y de
-- nada más. Con sólo la 0028 aplicada, el `grant` sin `revoke` deja la función
-- abierta a PUBLIC y la medición da `true`. Pero la base real no ejecuta la
-- 0028 sola: 181 números después, `0209_revoke_anon_rpc_sweep.sql:64` revoca
-- `next_bug_folio` de `public, anon` en un barrido, y nada la vuelve a abrir
-- (la 0248 re-otorga sólo a `authenticated`).
--
-- Medido el 2026-08-27 replayando las 372 migraciones sobre Postgres limpio:
-- `has_function_privilege('anon','public.next_bug_folio(uuid)','execute')` =
-- **false**, con ACL `postgres=X/postgres service_role=X/postgres
-- authenticated=X/postgres` — sin PUBLIC y sin anon.
--
-- Así que la 0394 no cerró una fuga viva: hizo explícita a nivel de archivo una
-- invariante que dependía de un barrido lejano, y recién por eso el contrato 12
-- puede afirmarla acá sin mentir. La lección es del método: **una medición en
-- el harness aislado dice qué hace el ARCHIVO, no qué hace la BASE.** Cuando lo
-- que se afirma es un privilegio, las dos preguntas tienen respuestas distintas.
--
-- ── 📏 EL DÍA QUE ESTE CONTRATO ESTUVO VERDE CON PROD EN ROJO ─────────────
--
-- ✅ Ya está reparado (0397, aplicada el 2026-08-28). Se deja escrito porque
-- la falla se repite sola y el contrato sigue sin poder verla.
--
-- Durante unas horas el contrato 13 pasó acá con **el voseo vivo en
-- producción**. No fue un bug del contrato: fue su alcance, otra vez.
--
-- El 2026-08-28 entraron a prod TRES migraciones con el número **0394**, desde
-- tres ventanas que no se veían entre sí (ninguna de las tres pusheada):
--
--   005838  0394_bug_reporter_tuteo_y_revoke_anon      ← la del tuteo
--   005909  0394_documents_sin_borrado_duro
--   005950  0394_bug_state_transitions_via_rpc_only    ← SDD-0313
--
-- La de SDD-0313 cerró la «segunda puerta» de acá arriba, y para meter sus dos
-- `set_config` alrededor del UPDATE **copió el cuerpo de la 0039** — la versión
-- con voseo. Corrió 72 s después, y `create or replace` se lleva la función
-- ENTERA, no sólo la parte que uno vino a cambiar. Ganó el último.
--
-- Medido en prod: `bug_advance_state` tiene voseo Y el `set_config`;
-- `bug_increment_duplicate` conserva su tuteo (nadie la volvió a tocar).
--
-- El archivo estuvo verde todo el tiempo porque hace `\ir` de su propia 0394 y
-- de nada más. **Mide el archivo, no la base** — lo mismo que se explica más
-- arriba sobre `next_bug_folio`, pero esta vez el que se equivocaba era el lado
-- optimista: allá el contrato habría gritado de más, acá se quedó callado.
--
-- ✅ Lo reparó `0397_bug_advance_state_tuteo_sobre_sdd0313.sql`, aplicada el
-- 2026-08-28 (ledger 20260828162058). Tomó el cuerpo VIVO y le cambió sólo las
-- dos cadenas; verificado por HUELLA, no por «success»: el md5 del `prosrc`
-- resultante es el que se había calculado antes aplicándole los dos reemplazos
-- al cuerpo que estaba corriendo, así que no se movió nada de SDD-0313.
--
-- ⏸ **Lo que sigue faltando acá:** este contrato todavía no compone la cadena
-- real. Cuando la ventana de SDD-0313 pushee
-- `0394_bug_state_transitions_via_rpc_only.sql`, hay que hacerle `\ir` de esa y
-- de la 0397, en ese orden, después de la 0394 propia. Hasta entonces el
-- contrato 13 afirma sobre una composición que la base no tiene — sigue siendo
-- cierto que el tuteo está bien, pero por un camino que no es el de producción.
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

-- La 0394 cierra los dos residuos que este archivo dejó anotados: el tuteo de
-- los mensajes que la server action devuelve crudos, y el `revoke ... from
-- public, anon` que le faltaba a `next_bug_folio`. Va acá porque sin ella los
-- contratos 12 y 13 afirmarían sobre una función que este replay no tiene.
\ir ../migrations/0394_bug_reporter_tuteo_y_revoke_anon.sql

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

-- ── 12 · 🔴 `anon` no ejecuta las RPC del Bug Reporter ────────────────────
--
-- Las tres son `security definer`: corren como su dueño, así que quien las
-- puede llamar importa más que en una función común. La 0028 le puso a
-- `next_bug_folio` el `grant` a `authenticated` pero se saltó el `revoke ...
-- from public, anon` que sí llevan sus dos hermanas, y en Postgres una función
-- nace con EXECUTE para PUBLIC — o sea que el olvido no es neutro, ABRE.
--
-- Se afirma en las DOS direcciones a propósito. Sólo con la mitad de `anon`,
-- un `revoke execute ... from public` a secas —que también le saca el permiso
-- a `authenticated`— saldría verde con la app rota.
do $$
declare
  r          record;
  v_abiertas text := '';
  v_cerradas text := '';
begin
  for r in
    select unnest(array[
      'public.next_bug_folio(uuid)',
      'public.bug_advance_state(uuid,bug_state,text)',
      'public.bug_increment_duplicate(uuid)'
    ]) as sig
  loop
    -- `anon` hereda lo que tenga PUBLIC, así que esta sola pregunta cubre las dos.
    if has_function_privilege('anon', r.sig, 'execute') then
      v_abiertas := v_abiertas || ' ' || r.sig;
    end if;
    if not has_function_privilege('authenticated', r.sig, 'execute') then
      v_cerradas := v_cerradas || ' ' || r.sig;
    end if;
  end loop;

  if v_abiertas <> '' then
    raise exception
      'CONTRATO 12 ROTO: anon puede EJECUTAR%  — falta el revoke from public, anon', v_abiertas;
  end if;
  if v_cerradas <> '' then
    raise exception
      'CONTRATO 12 ROTO: authenticated PERDIO el execute de% — el revoke se llevo puesta la app', v_cerradas;
  end if;
end;
$$;

-- ── 13 · Los mensajes que el usuario LEE están en tuteo ───────────────────
--
-- No es cosmética ni gusto: `app/studio/(app)/bugs/actions.ts:83` devuelve
-- `error.message` CRUDO al cliente, así que el texto del `raise exception` ES
-- la copy de la pantalla del Studio. (La ruta API
-- `app/api/studio/bugs/[id]/state/route.ts` sí los mapea a mensajes propios —
-- por ahí no se ve, y por eso el voseo sobrevivió tanto.)
--
-- Se prueban las DOS capas, porque cada una sola deja un hueco — y la mutación
-- lo confirmó: hay un mutante que sólo caza (a) y otro que sólo caza (b).
--   (a) se EJERCITAN los cuatro caminos que devuelven texto al usuario (las dos
--       RPC × sin-sesión y sesión-ajena) y se compara el mensaje EXACTO. Prueba
--       lo que el usuario lee de verdad, no lo que dice el fuente, y no depende
--       de acertarle a la forma del voseo.
--   (b) se BARRE el fuente de las tres RPC por formas de voseo. Es una lista de
--       palabras —se le escapa una acentuación que no enumere— pero alcanza los
--       mensajes que ningún contrato ejercita todavía, que (a) no puede ver.
--
-- ⚠️ Los intentos se aíslan y las afirmaciones van AFUERA de todo handler:
-- un `raise exception` propio sale con el mismo P0001 que levanta la RPC, y
-- atraparlo adentro haría que el contrato se comiera su propio fallo.
do $$
declare
  v_sin_sesion  text;
  v_dup_sesion  text;
  v_ajeno       text;
  v_dup_ajeno   text;
  v_voseo       text;
begin
  perform set_config('test.uid', '', true);   -- auth.uid() → null

  begin
    perform public.bug_advance_state(
      'b0000001-0000-0000-0000-000000000001', 'triaje', null);
    v_sin_sesion := '(no levanto excepcion)';
  exception when others then
    v_sin_sesion := sqlerrm;
  end;

  begin
    perform public.bug_increment_duplicate('b0000001-0000-0000-0000-000000000001');
    v_dup_sesion := '(no levanto excepcion)';
  exception when others then
    v_dup_sesion := sqlerrm;
  end;

  -- Sesión válida, pero de la OTRA empresa. Se ejercitan las DOS RPC: el
  -- barrido (b) es una LISTA DE PALABRAS y sólo caza las formas que enumera —
  -- un voseo con otra acentuación se le escapa. Lo único que no depende de
  -- adivinar la forma es comparar el mensaje exacto, así que cada texto que el
  -- usuario puede leer se ejercita acá.
  perform set_config('test.uid', 'aa555555-2222-2222-2222-222222222222', true);
  begin
    perform public.bug_advance_state(
      'b0000001-0000-0000-0000-000000000001', 'triaje', null);
    v_ajeno := '(no levanto excepcion)';
  exception when others then
    v_ajeno := sqlerrm;
  end;

  begin
    perform public.bug_increment_duplicate('b0000001-0000-0000-0000-000000000001');
    v_dup_ajeno := '(no levanto excepcion)';
  exception when others then
    v_dup_ajeno := sqlerrm;
  end;

  perform set_config('test.uid', '', true);

  -- (b) el barrido del fuente, para los mensajes que nadie ejercita.
  select string_agg(p.proname, ', ' order by p.proname) into v_voseo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('next_bug_folio', 'bug_advance_state', 'bug_increment_duplicate')
     and p.prosrc ~ '(Necesitás|pertenecés|podés|tenés|querés|debés|usá |ingresá|revisá|verificá|seleccioná|completá|intentá|agregá|escribí|elegí|mirá )';

  -- ── afirmaciones, fuera de todo `exception when` ──
  if v_sin_sesion <> 'Necesitas estar autenticado' then
    raise exception
      'CONTRATO 13 ROTO: bug_advance_state sin sesion dice «%» (esperado «Necesitas estar autenticado»)', v_sin_sesion;
  end if;
  if v_dup_sesion <> 'Necesitas estar autenticado' then
    raise exception
      'CONTRATO 13 ROTO: bug_increment_duplicate sin sesion dice «%» (esperado «Necesitas estar autenticado»)', v_dup_sesion;
  end if;
  if v_ajeno <> 'No perteneces al tenant del bug' then
    raise exception
      'CONTRATO 13 ROTO: bug_advance_state con sesion ajena dice «%» (esperado «No perteneces al tenant del bug»)', v_ajeno;
  end if;
  if v_dup_ajeno <> 'No perteneces al tenant del bug' then
    raise exception
      'CONTRATO 13 ROTO: bug_increment_duplicate con sesion ajena dice «%» (esperado «No perteneces al tenant del bug»)', v_dup_ajeno;
  end if;
  if v_voseo is not null then
    raise exception
      'CONTRATO 13 ROTO: queda voseo en el fuente de: % — el usuario lee ese texto tal cual', v_voseo;
  end if;
end;
$$;

rollback;
