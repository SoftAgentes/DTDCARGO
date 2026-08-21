-- TEST 0388 · el gate de `platform_admins` vacía deja de matar el replay
--
-- QUÉ PRUEBA, sobre el ARTEFACTO REAL (`\ir` de la migración, no una copia):
--   1. MUTACIÓN — con DOS entradas candidatas la migración ABORTA sin tocar nada.
--   2. Camino feliz — baja el `raise exception` a `raise notice` en las dos
--      entradas y NADA más del payload cambia (se prueba por ida y vuelta).
--   3. Replay — correrla otra vez sobre el ledger ya parcheado es no-op y no
--      falla. Ésta es la propiedad que obligó a las 0282/0287/0288 a existir.
--   4. MUTACIÓN — si falta la entrada en el ledger ABORTA en vez de callarse, y
--      se mide por el efecto: la 0355 (que se restaura sin parchear antes) queda
--      sin parchear, porque el `do` entero revierte.
--
-- SIN TRANSACCIÓN ENVOLVENTE, A PROPÓSITO: los dos casos de mutación esperan que
-- la migración reviente, y dentro de un `begin;` la transacción quedaría abortada
-- y no se podría observar nada. En autocommit el error revierte sólo su propio
-- statement y el fixture sigue ahí para medirlo. La limpieza es explícita al
-- final, con su assert.
\set ON_ERROR_STOP on

drop schema if exists supabase_migrations cascade;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version    text primary key,
  name       text not null,
  statements text[] not null
);

-- ── Fixture: los payloads tal como los guarda el ledger ──────────────
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  (
    '20260807170000',
    '0355_superadmin_llaves_del_sistema',
    array[
      $f355a$do $preflight$
begin
  if to_regclass('public.platform_admins') is null then
    raise exception '0355 requiere public.platform_admins (migr 0058)';
  end if;
  if to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0355 requiere public.is_platform_admin() (migr 0058)';
  end if;
  if not exists (select 1 from public.platform_admins) then
    raise exception '0355 abortado: platform_admins está VACÍA. Aplicarla dejaría las llaves sin dueño y nadie podría tocar los feature flags.';
  end if;
end;
$preflight$;$f355a$,
      $f355b$drop policy if exists feature_flags_admin_update on public.feature_flags;$f355b$
    ]
  ),
  (
    '20260807180000',
    '0356_superadmin_legal_renditions_gate',
    array[
      $f356$do $preflight$
begin
  if to_regprocedure('public.is_platform_admin()') is null then
    raise exception '0356 requiere public.is_platform_admin() (migr 0058)';
  end if;
  if not exists (select 1 from public.platform_admins) then
    raise exception '0356 abortado: platform_admins está VACÍA — dejaría Legal/Rendiciones sin nadie que pueda escribir.';
  end if;
end;
$preflight$;$f356$
    ]
  ),
  -- Ruido: una entrada ajena que NO se puede tocar.
  ('20260101000000', 'ruido_ajeno', array['select 1;']);

create table public.t0388_original as
select version, statements from supabase_migrations.schema_migrations;

-- ── CASO 1 · MUTACIÓN: dos candidatas para la 0355 → tiene que abortar ──
insert into supabase_migrations.schema_migrations (version, name, statements)
values (
  '20260807170001',
  '0355_duplicada_por_error',
  array[$dup$  if not exists (select 1 from public.platform_admins) then
    raise exception '0355 abortado: platform_admins está VACÍA. Aplicarla dejaría las llaves sin dueño y nadie podría tocar los feature flags.';
  end if;$dup$]
);

\set ON_ERROR_STOP off
\ir ../migrations/0388_replay_gate_platform_admins_history.sql
\set ON_ERROR_STOP on

do $mutacion_ambiguedad$
declare
  v_sin int;
begin
  select count(*) into v_sin
  from supabase_migrations.schema_migrations m
  where exists (
    select 1 from unnest(m.statements) s
    where strpos(s, $v$raise exception '0355 abortado: platform_admins está VACÍA.$v$) > 0
  );
  if v_sin <> 2 then
    raise exception
      'TEST 0388 (mutación · ambigüedad): con 2 candidatas la migración tenía que abortar sin tocar nada; quedaron % sin parchear',
      v_sin;
  end if;
end
$mutacion_ambiguedad$;

delete from supabase_migrations.schema_migrations where version = '20260807170001';

-- ── CASO 2 · camino feliz ────────────────────────────────────────────
\ir ../migrations/0388_replay_gate_platform_admins_history.sql

do $camino_feliz$
declare
  v_nuevo355 constant text := $n$raise notice '0355 (replay · 0388): platform_admins está VACÍA — gate omitido; las llaves se provisionan fuera del replay.';$n$;
  v_viejo355 constant text := $v$raise exception '0355 abortado: platform_admins está VACÍA. Aplicarla dejaría las llaves sin dueño y nadie podría tocar los feature flags.';$v$;
  v_nuevo356 constant text := $n$raise notice '0356 (replay · 0388): platform_admins está VACÍA — gate omitido; las llaves se provisionan fuera del replay.';$n$;
  v_viejo356 constant text := $v$raise exception '0356 abortado: platform_admins está VACÍA — dejaría Legal/Rendiciones sin nadie que pueda escribir.';$v$;
  v_falta text;
begin
  if exists (
    select 1 from supabase_migrations.schema_migrations m
    where exists (select 1 from unnest(m.statements) s
                  where strpos(s, v_viejo355) > 0 or strpos(s, v_viejo356) > 0)
  ) then
    raise exception 'TEST 0388: quedó un `raise exception` del gate en el ledger';
  end if;

  if (select count(*) from supabase_migrations.schema_migrations m
      where exists (select 1 from unnest(m.statements) s where strpos(s, v_nuevo355) > 0)) <> 1 then
    raise exception 'TEST 0388: la 0355 no quedó con el notice (o quedó en más de una entrada)';
  end if;

  if (select count(*) from supabase_migrations.schema_migrations m
      where exists (select 1 from unnest(m.statements) s where strpos(s, v_nuevo356) > 0)) <> 1 then
    raise exception 'TEST 0388: la 0356 no quedó con el notice (o quedó en más de una entrada)';
  end if;

  -- NADA fuera del gate cambió: deshacer los dos reemplazos reconstruye el
  -- payload original byte a byte, en las tres entradas (ruido incluido).
  select o.version into v_falta
  from public.t0388_original o
  join supabase_migrations.schema_migrations m on m.version = o.version
  where o.statements is distinct from (
    select array_agg(replace(replace(s, v_nuevo355, v_viejo355), v_nuevo356, v_viejo356) order by ord)
    from unnest(m.statements) with ordinality as u(s, ord)
  )
  limit 1;
  if v_falta is not null then
    raise exception 'TEST 0388: el payload de la entrada % cambió FUERA del gate', v_falta;
  end if;

  if (select count(*) from supabase_migrations.schema_migrations) <> 3 then
    raise exception 'TEST 0388: cambió la cantidad de entradas del ledger';
  end if;
end
$camino_feliz$;

-- ── CASO 3 · replay: correrla sobre el ledger ya parcheado es no-op ───
create table public.t0388_parcheado as
select version, statements from supabase_migrations.schema_migrations;

\ir ../migrations/0388_replay_gate_platform_admins_history.sql

do $replay$
declare
  v_distintas int;
begin
  select count(*) into v_distintas
  from public.t0388_parcheado p
  full join supabase_migrations.schema_migrations m on m.version = p.version
  where p.version is null
     or m.version is null
     or m.statements is distinct from p.statements;
  if v_distintas <> 0 then
    raise exception
      'TEST 0388 (replay): la segunda corrida movió % entrada(s) del ledger; tenía que ser no-op',
      v_distintas;
  end if;
end
$replay$;

-- ── CASO 4 · MUTACIÓN: sin la entrada en el ledger, tiene que abortar ──
-- Se restaura la 0355 SIN parchear: si la migración se callara ante la ausencia
-- de la 0356, terminaría parcheando la 0355 y este assert lo cazaría. Que quede
-- sin parchear es la prueba de que el `do` entero revirtió.
update supabase_migrations.schema_migrations m
set statements = o.statements
from public.t0388_original o
where o.version = m.version and m.version = '20260807170000';

delete from supabase_migrations.schema_migrations where version = '20260807180000';

\set ON_ERROR_STOP off
\ir ../migrations/0388_replay_gate_platform_admins_history.sql
\set ON_ERROR_STOP on

do $mutacion_ausencia$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations m
    where m.version = '20260807170000'
      and exists (
        select 1 from unnest(m.statements) s
        where strpos(s, $v$raise exception '0355 abortado: platform_admins está VACÍA.$v$) > 0
      )
  ) then
    raise exception
      'TEST 0388 (mutación · ausencia): faltando la entrada de la 0356, la migración tenía que abortar entera; en cambio alcanzó a parchear la 0355';
  end if;
end
$mutacion_ausencia$;

-- ── Limpieza ─────────────────────────────────────────────────────────
drop table public.t0388_original;
drop table public.t0388_parcheado;
drop schema supabase_migrations cascade;

select to_regnamespace('supabase_migrations') is null
   and to_regclass('public.t0388_original') is null
   and to_regclass('public.t0388_parcheado') is null
  as sdd_0277_fixture_limpio;
