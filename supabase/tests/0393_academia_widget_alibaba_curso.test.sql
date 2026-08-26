\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────
-- Contrato del CHECK `academy_lessons_widget_chk` tras la migración 0393.
--
-- Qué fija, y por qué cada aserción existe:
--   1. 'alibaba_curso' se ACEPTA        → es lo que la 0393 vino a habilitar.
--   2. 'alibaba_address' SIGUE aceptado → la 0393 recrea el CHECK; si al
--                                         reescribirlo se perdiera el valor
--                                         viejo, las lecciones que hoy usan la
--                                         guía de dirección dejarían de poder
--                                         guardarse. Regresión silenciosa.
--   3. NULL se ACEPTA                   → lección normal, el caso mayoritario.
--   4. Un valor inventado se RECHAZA    → LA MUTACIÓN. Sin esta aserción el
--                                         test pasaría igual con un CHECK
--                                         borrado, que es justo el error que
--                                         una migración de "drop + add" puede
--                                         dejar si el `add` no corre.
--   5. El constraint se llama `..._chk` → el runbook traía `..._check`
--                                         adivinado. Con ese nombre el `drop`
--                                         no borra nada y el `add` revienta.
--
-- Fixture autocontenida, termina en ROLLBACK. Nunca toca prod.
-- ─────────────────────────────────────────────────────────────

begin;

do $guard$
begin
  if to_regclass('public.academy_lessons') is not null then
    raise exception 'Fixture 0393 rechazada: public.academy_lessons ya existe';
  end if;
end
$guard$;

-- Tabla mínima con la MISMA columna y el MISMO CHECK que deja la 0149.
create table public.academy_lessons (
  id     uuid primary key default gen_random_uuid(),
  title  text not null,
  widget text
);

alter table public.academy_lessons
  add constraint academy_lessons_widget_chk
  check (widget is null or widget in ('alibaba_address'));

-- ── Estado PREVIO: 'alibaba_curso' todavía NO cabe ──
-- Si esto no fallara, el test no estaría midiendo nada: querría decir que el
-- CHECK de partida ya era permisivo y la 0393 no cambia nada observable.
do $previo$
begin
  begin
    insert into public.academy_lessons (title, widget) values ('previo', 'alibaba_curso');
    raise exception 'FALLA: el CHECK de la 0149 aceptó alibaba_curso ANTES de la 0393';
  exception
    when check_violation then null;  -- esperado
  end;
end
$previo$;

-- ── La migración bajo prueba ──
\ir ../migrations/0393_academia_widget_alibaba_curso.sql

-- 5) el constraint conserva el nombre real
do $nombre$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'academy_lessons_widget_chk'
      and conrelid = 'public.academy_lessons'::regclass
  ) then
    raise exception 'FALLA: no existe academy_lessons_widget_chk despues de la 0393';
  end if;
end
$nombre$;

-- 1) 'alibaba_curso' entra
insert into public.academy_lessons (title, widget) values ('curso', 'alibaba_curso');

-- 2) 'alibaba_address' sigue entrando (no hay regresión)
insert into public.academy_lessons (title, widget) values ('direccion', 'alibaba_address');

-- 3) NULL entra (lección normal)
insert into public.academy_lessons (title, widget) values ('normal', null);

do $conteo$
declare n int;
begin
  select count(*) into n from public.academy_lessons;
  if n <> 3 then
    raise exception 'FALLA: se esperaban 3 lecciones insertadas, hay %', n;
  end if;
end
$conteo$;

-- 4) LA MUTACIÓN: un valor fuera de la lista sigue rechazado.
do $mutacion$
begin
  begin
    insert into public.academy_lessons (title, widget) values ('inventado', 'alibaba_inventado');
    raise exception 'FALLA: el CHECK acepto un widget inventado — la 0393 lo dejo abierto';
  exception
    when check_violation then null;  -- esperado
  end;

  -- Y tampoco una cadena vacía, que es el "casi nulo" que se cuela sin querer.
  begin
    insert into public.academy_lessons (title, widget) values ('vacio', '');
    raise exception 'FALLA: el CHECK acepto la cadena vacia como widget';
  exception
    when check_violation then null;  -- esperado
  end;
end
$mutacion$;

-- 0393 es idempotente: correrla dos veces no puede reventar.
\ir ../migrations/0393_academia_widget_alibaba_curso.sql
insert into public.academy_lessons (title, widget) values ('curso otra vez', 'alibaba_curso');

rollback;
