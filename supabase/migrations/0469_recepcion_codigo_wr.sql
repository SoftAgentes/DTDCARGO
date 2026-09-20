-- ─────────────────────────────────────────────────────────────────────────────
-- 0469 · SDD-0491 — La recepción de bodega China creada en el Studio vuelve a
-- numerarse WR- (y la huérfana, SIN-CODIGO-), asignada por la base al insertar.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: MIGRATE-FIRST. Se aplica ANTES de integrar la PR de SDD-0491: esa
--    app inserta la recepción sin receipt_code y cuenta con este trigger. La app
--    desplegada hoy siempre manda el código, así que el trigger no la cambia.
--
-- ── El defecto ──────────────────────────────────────────────
-- createReceiptAction (app/studio/(app)/cn/actions.ts) pedía el código a
-- next_receipt_code. Esa función generaba WR-YYYY-NNNN (0008, 0012), pero la
-- 0079 la redefinió para Cobranzas: ahora da R-YYYY-NNNN con el máximo de
-- payment_receipts. Desde entonces, una recepción creada a mano en el Studio
-- sale con un código de la serie de cobros, que además no avanza con las
-- recepciones: dos seguidas sin un cobro en medio piden el mismo código, y la
-- segunda choca con unique (tenant_id, receipt_code). Una recepción huérfana
-- pedía next_orphan_code, que la 0211 dejó sólo para service_role: desde el
-- Studio falla. next_receipt_code NO se toca: la usan los cobros (0079, 0467).
--
-- ── Qué agrega ──────────────────────────────────────────────
-- public.warehouse_receipts_cn_assign_code(), trigger BEFORE INSERT. Si la fila
-- llega sin receipt_code, lo asigna en la misma transacción del INSERT:
-- WR-YYYY-NNNN, o SIN-CODIGO-NNNN si is_orphan, con el máximo del tenant más
-- uno. Es la regla de la 0449 (la prealerta) y de la 0045 (el operario). Cuenta
-- también las recepciones borradas, porque el unique las incluye: por eso es
-- SECURITY DEFINER, ya que la RLS del Studio las esconde (deleted_at is null).
-- Una fila que trae su código (el operario, la prealerta) no cambia.
--
-- ── Concurrencia ────────────────────────────────────────────
-- La 0449 toma la tabla en SHARE ROW EXCLUSIVE antes de numerar. Dentro de un
-- trigger ese lock llega tarde: el INSERT ya tiene ROW EXCLUSIVE, y dos altas a
-- la vez se esperarían una a la otra (deadlock). El trigger toma en cambio un
-- lock consultivo por tenant (clave 491) hasta el COMMIT:
--   · dos altas del Studio se serializan al numerar;
--   · con la 0449 las serializa su lock de tabla, que espera al INSERT, o el
--     INSERT lo espera a él.
-- Medido en supabase/tests/0469_recepcion_codigo_wr_carrera.test.sql.
--
-- ── Datos existentes ────────────────────────────────────────
-- No toca filas. Las recepciones que ya salieron con código R- quedan como
-- están: auditarlas y corregirlas lo decide Sam (spec 0491).
--
-- ── Locks de esta migración ─────────────────────────────────
-- CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre warehouse_receipts_cn hasta el
-- COMMIT: frena altas y ediciones de recepciones mientras dura. lock_timeout de
-- 5 s y statement_timeout de 30 s con set de sesión, como 0464-0467, que rige
-- también en autocommit: si corta, se reintenta entera.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regclass('public.warehouse_receipts_cn') is null then
    raise exception '0469 requiere public.warehouse_receipts_cn (0008)';
  end if;

  if (select pg_catalog.count(*) from pg_catalog.pg_attribute a
       where a.attrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
         and not a.attisdropped
         and ((a.attname = 'tenant_id' and a.atttypid = 'uuid'::pg_catalog.regtype and a.attnotnull)
           or (a.attname = 'receipt_code' and a.atttypid = 'text'::pg_catalog.regtype and a.attnotnull)
           or (a.attname = 'is_orphan' and a.atttypid = 'boolean'::pg_catalog.regtype and a.attnotnull)
           or (a.attname = 'deleted_at' and a.atttypid = 'timestamptz'::pg_catalog.regtype))) <> 4 then
    raise exception '0469 abortado: warehouse_receipts_cn no tiene tenant_id, receipt_code, is_orphan y deleted_at como en la 0008';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_index i
     where i.indrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
       and i.indisunique and i.indpred is null and i.indexprs is null
       and (select pg_catalog.array_agg(a.attname::text order by a.attname)
              from pg_catalog.pg_attribute a
             where a.attrelid = i.indrelid and a.attnum = any (i.indkey::int2[]))
           = array['receipt_code', 'tenant_id']
  ) then
    raise exception '0469 abortado: falta unique (tenant_id, receipt_code) de la 0008';
  end if;

  if pg_catalog.to_regprocedure('public.warehouse_receipts_cn_assign_code()') is not null
     or exists (select 1 from pg_catalog.pg_trigger t
                 where t.tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
                   and t.tgname = 'warehouse_receipts_cn_assign_code') then
    raise exception '0469 abortado: el trigger de numeración ya existe';
  end if;
end;
$preflight$;

create function public.warehouse_receipts_cn_assign_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_year text;
  v_next integer;
begin
  if new.receipt_code is not null and pg_catalog.btrim(new.receipt_code) <> '' then
    return new;
  end if;
  if new.tenant_id is null then
    raise exception 'warehouse_receipts_cn: hace falta tenant_id para numerar la recepción'
      using errcode = '23502';
  end if;

  -- Una recepción a la vez por tenant al numerar, hasta el COMMIT.
  perform pg_catalog.pg_advisory_xact_lock(491, pg_catalog.hashtext(new.tenant_id::text));

  if new.is_orphan then
    select coalesce(pg_catalog.max(
             (pg_catalog.regexp_match(wr.receipt_code, '^SIN-CODIGO-(\d+)$'))[1]::integer), 0) + 1
      into v_next
      from public.warehouse_receipts_cn as wr
     where wr.tenant_id = new.tenant_id
       and wr.receipt_code like 'SIN-CODIGO-%';
    new.receipt_code := 'SIN-CODIGO-'
      || pg_catalog.lpad(v_next::text, greatest(4, pg_catalog.char_length(v_next::text)), '0');
  else
    v_year := pg_catalog.to_char(current_date, 'YYYY');
    select coalesce(pg_catalog.max(
             (pg_catalog.regexp_match(wr.receipt_code, '^WR-\d{4}-(\d+)$'))[1]::integer), 0) + 1
      into v_next
      from public.warehouse_receipts_cn as wr
     where wr.tenant_id = new.tenant_id
       and wr.receipt_code like 'WR-' || v_year || '-%';
    new.receipt_code := 'WR-' || v_year || '-'
      || pg_catalog.lpad(v_next::text, greatest(4, pg_catalog.char_length(v_next::text)), '0');
  end if;
  return new;
end;
$function$;

alter function public.warehouse_receipts_cn_assign_code() owner to postgres;
revoke all on function public.warehouse_receipts_cn_assign_code()
  from public, anon, authenticated, service_role;

create trigger warehouse_receipts_cn_assign_code
  before insert on public.warehouse_receipts_cn
  for each row
  execute function public.warehouse_receipts_cn_assign_code();

comment on function public.warehouse_receipts_cn_assign_code() is
  'SDD-0491: asigna receipt_code (WR-YYYY-NNNN, o SIN-CODIGO-NNNN si is_orphan) a la recepción que llega sin código, con un lock consultivo por tenant hasta el COMMIT. Cuenta las borradas. No toca la que trae su código.';

do $postflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger t
     where t.tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
       and t.tgname = 'warehouse_receipts_cn_assign_code'
       and not t.tgisinternal and t.tgenabled = 'O'
       and t.tgfoid = 'public.warehouse_receipts_cn_assign_code()'::pg_catalog.regprocedure
       and (t.tgtype & 1) = 1      -- FOR EACH ROW
       and (t.tgtype & 2) = 2      -- BEFORE
       and (t.tgtype & 4) = 4      -- INSERT
       and (t.tgtype & 24) = 0     -- ni DELETE ni UPDATE
  ) then
    raise exception '0469 postflight: el trigger no quedó BEFORE INSERT FOR EACH ROW y habilitado';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
     where p.oid = 'public.warehouse_receipts_cn_assign_code()'::pg_catalog.regprocedure
       and p.prosecdef
       and p.proowner = 'postgres'::pg_catalog.regrole
       and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception '0469 postflight: la función no quedó DEFINER, de postgres y con search_path vacío';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE') then
    raise exception '0469 postflight: la función de trigger quedó ejecutable por un rol de la API';
  end if;
end;
$postflight$;
