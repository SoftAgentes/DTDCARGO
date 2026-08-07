\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0353. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. ⭐ el `.0` de Excel NO se convierte en un dígito más — `4243745436.0`
--      tiene que dar `584243745436`, NUNCA `5842437454360`. Es el bug entero:
--      `toWhatsAppRaw` hace replace(/\D/g,'') y manda el WhatsApp a un tercero,
--      sin fallar ni avisar,
--   2. las tres formas reconocibles llegan al mismo canónico,
--   3. lo YA canónico no se toca (el backfill no debe reescribir de gusto),
--   4. lo irreconocible queda INTACTO y aparece en la vista — no se inventa un
--      número plausible, que es peor que un número feo,
--   5. `phone_legacy` guarda lo que había, para poder volver atrás,
--   6. la vista es `security_invoker` — si no, sirve PII de todos los tenants.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  markbox text not null,
  name text,
  phone text,
  deleted_at timestamptz
);

insert into public.clients (tenant_id, markbox, name, phone) values
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-A110', 'Excel .0',        '4243745436.0'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0002', 'Excel .0 con 0',  '04243745436.0'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0003', 'Local con 0',     '04243745436'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0004', 'Pelado',          '4243745436'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0005', 'Fijo local',      '02125551234'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0006', 'Ya canonico',     '584243745436'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0007', 'Con formato',     '+58 424-374.5436'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0008', 'Muy corto',       '12345'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0009', 'Dos numeros',     '04243745436 / 04122306212'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0010', 'Empieza en 9',    '9243745436'),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0011', 'Vacio',           ''),
  ('00000000-0000-0000-0000-0000000000f1', 'DTD-0012', 'Nulo',            null);

\ir ../migrations/0353_normaliza_telefonos_clientes.sql

-- ── 1 + 2. El `.0` no se cuela como dígito, y todo llega al canónico ────────
do $t1$
declare v text;
begin
  select phone into v from public.clients where markbox = 'DTD-A110';
  if v <> '584243745436' then
    raise exception 'REGRESION: el .0 de Excel se colo como digito → % (esperaba 584243745436)', v;
  end if;

  select phone into v from public.clients where markbox = 'DTD-0002';
  if v <> '584243745436' then raise exception 'local con .0 quedo en %', v; end if;

  select phone into v from public.clients where markbox = 'DTD-0003';
  if v <> '584243745436' then raise exception 'local con 0 quedo en %', v; end if;

  select phone into v from public.clients where markbox = 'DTD-0004';
  if v <> '584243745436' then raise exception 'pelado quedo en %', v; end if;

  select phone into v from public.clients where markbox = 'DTD-0005';
  if v <> '582125551234' then raise exception 'fijo quedo en %', v; end if;

  select phone into v from public.clients where markbox = 'DTD-0007';
  if v <> '584243745436' then raise exception 'con formato quedo en %', v; end if;
end;
$t1$;

-- ── 3. Lo ya canónico no se reescribe ──────────────────────────────────────
do $t2$
declare v text; leg text;
begin
  select phone, phone_legacy into v, leg from public.clients where markbox = 'DTD-0006';
  if v <> '584243745436' then raise exception 'se rompio uno que ya estaba bien: %', v; end if;
  if leg is not null then
    raise exception 'se toco una fila que no hacia falta tocar (phone_legacy=%)', leg;
  end if;
end;
$t2$;

-- ── 4. Lo irreconocible queda INTACTO y sale en la vista ───────────────────
do $t3$
declare v text; n int;
begin
  select phone into v from public.clients where markbox = 'DTD-0008';
  if v <> '12345' then raise exception 'se invento un numero para el corto: %', v; end if;

  select phone into v from public.clients where markbox = 'DTD-0009';
  if v <> '04243745436 / 04122306212' then
    raise exception 'se eligio uno de los dos numeros por su cuenta: %', v;
  end if;

  -- 10 dígitos pero empieza en 9: no es un prefijo VE conocido → no se adivina.
  select phone into v from public.clients where markbox = 'DTD-0010';
  if v <> '9243745436' then raise exception 'se normalizo un prefijo desconocido: %', v; end if;

  select count(*) into n from public.clients_phone_no_normalizable;
  if n <> 3 then
    raise exception 'la vista de revision manual deberia listar 3, lista %', n;
  end if;
end;
$t3$;

-- ── 5. phone_legacy permite volver atrás ───────────────────────────────────
do $t4$
declare leg text;
begin
  select phone_legacy into leg from public.clients where markbox = 'DTD-A110';
  if leg <> '4243745436.0' then
    raise exception 'phone_legacy no guardo el original (%)', leg;
  end if;
end;
$t4$;

-- ── 6. La vista NO puede saltarse la RLS ───────────────────────────────────
do $t5$
declare v_invoker text;
begin
  select coalesce(
           (select option_value from pg_options_to_table(c.reloptions)
             where option_name = 'security_invoker'), 'off')
    into v_invoker
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'clients_phone_no_normalizable';

  if v_invoker not in ('true', 'on') then
    raise exception 'La vista corre como su DUENO: sirve PII de todos los tenants (security_invoker=%)', v_invoker;
  end if;
end;
$t5$;

rollback;
