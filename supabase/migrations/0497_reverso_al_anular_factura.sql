-- ─────────────────────────────────────────────────────────────
-- SDD-0573 · Anular una factura revierte su asiento de venta, en la misma
--            transacción (2.5 del plan contable)
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md);
--    la aplica el Director con infra/ops/migraciones/. ORDEN: MIGRATE-FIRST. Se
--    aplica ANTES de fusionar la PR de SDD-0573.
--
-- B1 del plan: void_invoice_with_audit_reason (0294) solo cambiaba el estado a
-- 'anulada'. El asiento de venta seguía vivo e inflaba Clientes (1.1.2),
-- Ingresos (4.5) e IVA por pagar (2.1.5). El Director midió 0 anuladas con
-- asiento vivo el 2026-10-18: no hay reparación histórica.
--
-- Decisiones del Director (2026-10-20, por la delegación de Sam):
--   1. Se reescribe void_invoice_with_audit_reason con la MISMA firma y el mismo
--      retorno, desde su última definición (0294), con preflight sobre su md5
--      vivo (leído por el Director: 76644e17…, igual al del repo).
--   2. DEFINER, con rol admin o accounting y el tenant de la sesión.
--   3. El reverso es SIEMPRE un contra-asiento (source 'invoice_reversal', con
--      reverses_entry_id). El original no se toca, así que el reverso nunca
--      entra a un período cerrado: va fechado greatest(hoy en Caracas,
--      closing_date + 1), con un memo que cita la factura, el asiento y su fecha.
--   4. No se anula una factura con recibos vivos, ni con paid_amount > 0 sin
--      recibos (un crédito de referido o un reporte de pago confirmado).
--   5. La anulación sigue auditada en D2 (invoice_voided, 0290), con el motivo
--      en dtd.audit_reason, igual que antes.
-- ─────────────────────────────────────────────────────────────

-- Locks: una columna nullable sin default, un índice único parcial y un CHECK
-- sobre journal_entries (ACCESS EXCLUSIVE breve; el CHECK valida las filas, que
-- no tienen ningún 'invoice_reversal'); reemplazar la función no toma locks de
-- tabla. No toca filas.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_fn regprocedure := pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)');
  v_md5 text;
  v_md5_sin_espacios text;
  v_definer boolean;
  v_config text[];
begin
  if pg_catalog.to_regclass('public.journal_entries') is not null and exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.journal_entries'::regclass and a.attname = 'reverses_entry_id' and not a.attisdropped
  ) then
    raise exception '0497 abortado: el reverso de asientos ya existe';
  end if;
  if pg_catalog.to_regclass('public.invoices') is null or pg_catalog.to_regclass('public.journal_entries') is null
     or pg_catalog.to_regclass('public.journal_lines') is null or pg_catalog.to_regclass('public.payment_receipts') is null
     or pg_catalog.to_regclass('public.accounting_settings') is null or pg_catalog.to_regclass('public.user_tenants') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.next_entry_code(uuid)') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0497 requiere invoices, journal_entries, journal_lines, payment_receipts, accounting_settings, user_tenants, get_user_tenant_id(), next_entry_code(uuid) y auth.uid()';
  end if;
  -- La versión vigente: la de la 0294 (INVOKER, search_path vacío). El md5 se
  -- mide como el Director en producción: el prosrc con LF, y sin espacios.
  if v_fn is null then
    raise exception '0497 requiere void_invoice_with_audit_reason(uuid,text) (0294)';
  end if;
  select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
         pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g')),
         p.prosecdef, p.proconfig
    into v_md5, v_md5_sin_espacios, v_definer, v_config
  from pg_catalog.pg_proc p where p.oid = v_fn;
  if v_definer or v_config is distinct from array['search_path=""']
     or (v_md5 <> '76644e17876d0caaa46e727de5946138' and v_md5_sin_espacios <> 'c76c80e7b8cae81c28c7999803520fca') then
    raise exception '0497 abortado: void_invoice_with_audit_reason no es la de la 0294 (md5 %, definer %, config %)',
      v_md5, v_definer, v_config;
  end if;
  -- El cierre (0133/0493) sigue guardando el mayor: el reverso tiene que pasar
  -- por él, no esquivarlo.
  if not exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.journal_entries'::regclass and tgname = 'journal_entries_validate_closing_trg' and tgenabled = 'O')
     or not exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.journal_lines'::regclass and tgname = 'journal_lines_validate_closing_trg' and tgenabled = 'O') then
    raise exception '0497 requiere los disparadores del cierre sobre journal_entries y journal_lines (0133)';
  end if;
  -- La auditoría D2 de la factura (0290) es la que registra invoice_voided.
  if not exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.invoices'::regclass and tgname = 'audit_d2_invoices' and tgenabled = 'O') then
    raise exception '0497 requiere la auditoría D2 de invoices (0290)';
  end if;
end;
$preflight$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. El vínculo del reverso                                  ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Un asiento tiene a lo sumo un reverso (índice único), y el original no se
-- puede borrar mientras su reverso exista (restrict).
alter table public.journal_entries
  add column reverses_entry_id uuid references public.journal_entries(id) on delete restrict;
create unique index journal_entries_un_reverso
  on public.journal_entries (reverses_entry_id) where reverses_entry_id is not null;
alter table public.journal_entries
  add constraint journal_entries_reverso_coherente check (
    (source = 'invoice_reversal') = (reverses_entry_id is not null)
  );

comment on column public.journal_entries.reverses_entry_id is
  'SDD-0573: el asiento que este revierte (contra-asiento). Solo con source=invoice_reversal. El original no se toca: queda asentado, y el par suma cero.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Anular la factura: rechazos, contra-asiento y estado    ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.void_invoice_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reason  text := nullif(pg_catalog.btrim(p_reason), '');
  v_tenant  uuid := public.get_user_tenant_id();
  v_hoy     date := (pg_catalog.now() at time zone 'America/Caracas')::date;
  v_inv     record;
  v_entry   record;
  v_recibos integer;
  v_vivos   integer;
  v_debe    numeric;
  v_haber   numeric;
  v_cierre  date;
  v_fecha   date;
  v_code    text;
  v_nuevo   uuid;
  v_memo    text;
begin
  -- El mismo mensaje y código que la 0294: la app y sus pruebas lo conocen.
  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid()) and ut.tenant_id = v_tenant
      and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) in ('admin', 'accounting')
  ) then
    raise exception 'Solo admin o contabilidad anulan una factura.'
      using errcode = '42501', hint = 'dtd-anular';
  end if;

  -- La factura bajo lock: un cobro o una aplicación de crédito en vuelo
  -- terminan antes, y lo que se cuenta abajo ya los incluye.
  select i.id, i.invoice_code, i.status::text as status, i.paid_amount
    into v_inv
  from public.invoices i
  where i.id = p_id and i.tenant_id = v_tenant
  for update;
  -- Como la 0294: sin fila que cambiar, false (la app dice «ya no admite»).
  if not found or v_inv.status in ('pagada', 'anulada') then
    return false;
  end if;

  select pg_catalog.count(*) into v_recibos
  from public.payment_receipts r
  where r.invoice_id = p_id and r.deleted_at is null;
  if v_recibos > 0 then
    raise exception 'La factura tiene % cobro(s) vivo(s): anúlalos primero en Cobranzas.', v_recibos
      using errcode = '55000', hint = 'dtd-anular';
  end if;
  if coalesce(v_inv.paid_amount, 0) > 0 then
    raise exception 'La factura tiene % aplicado sin recibo (un crédito de referido o un reporte de pago): revierte el crédito antes de anular.',
      pg_catalog.to_char(v_inv.paid_amount, 'FM999999999990.00')
      using errcode = '55000', hint = 'dtd-anular';
  end if;

  -- El asiento de venta vivo: asentado y sin borrar. (Uno con reverso solo
  -- existe en una factura ya anulada, que salió arriba.)
  select pg_catalog.count(*) into v_vivos
  from public.journal_entries je
  where je.invoice_id = p_id and je.source = 'invoice' and je.status = 'asentado' and je.deleted_at is null;
  if v_vivos > 1 then
    raise exception 'La factura tiene % asientos de venta vivos: revisa el libro diario antes de anular.', v_vivos
      using errcode = '55000', hint = 'dtd-anular';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  if v_vivos = 1 then
    select je.id, je.entry_code, je.entry_date into v_entry
    from public.journal_entries je
    where je.invoice_id = p_id and je.source = 'invoice' and je.status = 'asentado' and je.deleted_at is null
    for update;

    select pg_catalog.sum(l.debit), pg_catalog.sum(l.credit) into v_debe, v_haber
    from public.journal_lines l where l.entry_id = v_entry.id;
    if v_debe is null or v_debe = 0 or v_debe <> v_haber then
      raise exception 'El asiento de venta % no cuadra: revisa el libro diario antes de anular.', v_entry.entry_code
        using errcode = '55000', hint = 'dtd-anular';
    end if;

    -- Nunca dentro del período cerrado: el primer día abierto es cierre + 1.
    select s.closing_date into v_cierre from public.accounting_settings s where s.tenant_id = v_tenant;
    v_fecha := greatest(v_hoy, coalesce(v_cierre + 1, v_hoy));
    v_memo := pg_catalog.format('Reverso de la factura %s (asiento %s del %s). Motivo: %s',
        v_inv.invoice_code, v_entry.entry_code, pg_catalog.to_char(v_entry.entry_date, 'YYYY-MM-DD'), v_reason)
      || case when v_cierre is not null and v_entry.entry_date <= v_cierre
           then ' — período cerrado: el reverso va en el período abierto.' else '' end;

    -- next_entry_code es max+1 sin lock (0078): como la 0485, reintento ante
    -- un código repetido.
    for v_intento in 1..3 loop
      begin
        v_code := public.next_entry_code(v_tenant);
        insert into public.journal_entries (
          tenant_id, entry_code, entry_date, memo, status, source, invoice_id, reverses_entry_id, posted_at
        ) values (
          v_tenant, v_code, v_fecha, v_memo, 'asentado', 'invoice_reversal', p_id, v_entry.id,
          pg_catalog.clock_timestamp()
        ) returning id into v_nuevo;
        exit;
      exception when unique_violation then
        if v_intento = 3 then
          raise exception 'No se pudo reservar el código del asiento de reverso. Intenta de nuevo.'
            using errcode = '40001', hint = 'dtd-anular';
        end if;
      end;
    end loop;

    -- Las líneas del original con el debe y el haber cambiados.
    insert into public.journal_lines (entry_id, account_id, debit, credit, line_memo)
    select v_nuevo, l.account_id, l.credit, l.debit,
      pg_catalog.left('Reverso: ' || coalesce(l.line_memo, ''), 500)
    from public.journal_lines l where l.entry_id = v_entry.id;
  end if;

  update public.invoices set status = 'anulada' where id = p_id;
  return true;
end;
$function$;

alter function public.void_invoice_with_audit_reason(uuid,text) owner to postgres;
revoke all on function public.void_invoice_with_audit_reason(uuid,text) from public, anon;
grant execute on function public.void_invoice_with_audit_reason(uuid,text) to authenticated;

comment on function public.void_invoice_with_audit_reason(uuid,text) is
  'SDD-0573 (reescribe la 0294): anula una factura con motivo (auditoría D2 invoice_voided) y, en la misma transacción, crea el contra-asiento de su asiento de venta (source invoice_reversal) fechado greatest(hoy Caracas, closing_date+1). Rechaza con hint dtd-anular: rol distinto de admin o accounting, recibos vivos, paid_amount > 0 sin recibos, más de un asiento de venta vivo o uno que no cuadra. Devuelve false si la factura no existe, está pagada o ya anulada.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Postflight                                              ║
-- ╚═══════════════════════════════════════════════════════════╝

do $postflight$
begin
  if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure('public.void_invoice_with_audit_reason(uuid,text)')
        and p.prosecdef and p.proconfig = array['search_path=""']) then
    raise exception '0497: postflight — void_invoice_with_audit_reason tiene que ser DEFINER con search_path vacío';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.void_invoice_with_audit_reason(uuid,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', 'public.void_invoice_with_audit_reason(uuid,text)', 'EXECUTE') then
    raise exception '0497: postflight — la ACL de void_invoice_with_audit_reason no es la esperada';
  end if;
  if pg_catalog.to_regclass('public.journal_entries_un_reverso') is null
     or not exists (select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.journal_entries'::regclass and conname = 'journal_entries_reverso_coherente') then
    raise exception '0497: postflight — falta el índice único o el CHECK del reverso';
  end if;
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
