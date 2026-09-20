-- ─────────────────────────────────────────────────────────────────────────────
-- 0470 · SDD-0492 — Escribir cobros y cuentas por pagar queda para accounting y
-- admin: payment_receipts, suppliers, supplier_bills y supplier_payments.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    ORDEN: DESPUÉS de la 0468 (PR #169), si esa se aplica. La 0468 fija el md5
--    de void_supplier_payment_with_audit_reason (0294), que esta migración
--    reescribe: si la 0470 va primero, el preflight de la 0468 aborta sin
--    cambiar nada y hay que actualizar su huella. La 0467 (aplicada el
--    2026-09-19) fija el de void_payment_receipt_with_audit_reason y ya pasó su
--    preflight. Se integra la PR después de aplicar.
--
-- ── El hueco ────────────────────────────────────────────────
-- Cada tabla tiene una sola policy, «<tabla> by tenant» (0079:145, 0088:266-282,
-- con la 0230): FOR ALL para authenticated, que sólo pide el tenant. Cualquier
-- miembro del tenant, de cualquier rol, podía hacer INSERT, UPDATE o DELETE por
-- PostgREST, incluidos paid_amount y status de una CxP. Y las envolturas de
-- anulación de la 0294 (void_payment_receipt/_supplier_bill/_supplier_payment
-- _with_audit_reason) tampoco pedían rol.
--
-- ── Quién escribe hoy (inventario de la spec 0492) ───────────
-- · La app, con el cliente de sesión: Cobranzas, Facturación y Tesorería (sólo
--   accounting y admin: son módulos de dinero, candado en lib/studio/rbac.ts),
--   la recepción de una compra asistida (capability approve_money: accounting y
--   admin) y Rendiciones (admin y superadmin).
-- · Las RPC INVOKER de la 0467 y de la 0468, que ya exigen admin o accounting.
-- · rename_client_markbox (0371): DEFINER del dueño de las tablas, que no
--   tienen FORCE ROW LEVEL SECURITY. La RLS no lo alcanza: el comercial sigue
--   renombrando el Shipping Mark de un cliente y sus cobros.
-- · Nadie borra filas de estas tablas: se anulan (deleted_at o status).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- Es el mismo molde de la 0407 (SDD-0350), que ya hizo esto con invoices y
-- está aplicada. Por tabla, la policy FOR ALL se reemplaza por tres:
--   · «<tabla>_team_select» (SELECT): tenant-wide, como hoy. Las lecturas no
--     cambian, y siguen siendo la deuda deliberada que anotó la 0407;
--   · «<tabla>_accounting_insert» y «<tabla>_accounting_update»: además del
--     tenant, rol accounting o admin del usuario activo. current_studio_role()
--     (0200) sale de la membresía activa, y la igualdad de tenant ya ata la
--     fila a esa membresía: con dos membresías activas, get_user_tenant_id()
--     (0453) devuelve null y no escribe nada. Es el criterio de rol de la 0422
--     y de las RPC de la 0467 y la 0468, con la forma de la 0407.
-- DELETE se retira del todo: sin policy y sin el GRANT de authenticated
-- (service_role conserva el suyo). Decisión del Director del 2026-09-19,
-- revisable por Sam, por la permanencia (MP-01); la alternativa es dejarlo
-- sólo para accounting y admin.
-- Las tres envolturas de la 0294 exigen rol con assert_studio_role (0351):
-- quien no es accounting ni admin recibe 42501 en vez de un false. Mismo
-- cuerpo, mismo INVOKER, owner y ACL. Decisión del Director, revisable por
-- Sam; la alternativa es dejarlo sólo a la RLS de UPDATE, que devuelve false
-- en silencio.
--
-- ── Qué no cambia ───────────────────────────────────────────
-- Las lecturas, las filas, service_role (con BYPASSRLS y sus privilegios), los
-- generadores next_*, rename_client_markbox, las RPC de la 0467 y de la 0468 y
-- los triggers de auditoría (0290) y de updated_at.
--
-- ── Locks de esta migración ─────────────────────────────────
-- DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre cada una de las 4 tablas
-- hasta el COMMIT: frena lecturas y escrituras mientras dura, que son
-- milisegundos. lock_timeout de 5 s y statement_timeout de 30 s con set de
-- sesión, como 0464-0469, que rige también en autocommit: si corta, se
-- reintenta entera.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_t text;
  v_priv text;
  v_fn record;
  v_md5 text;
  v_md5_normalized text;
begin
  foreach v_t in array array['payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments'] loop
    -- De postgres, con RLS y SIN FORCE: así la RLS no alcanza a los DEFINER.
    if not exists (select 1 from pg_catalog.pg_class c
                    where c.oid = pg_catalog.to_regclass('public.' || v_t)
                      and c.relrowsecurity and not c.relforcerowsecurity
                      and c.relowner = 'postgres'::pg_catalog.regrole) then
      raise exception '0470 abortado: public.% no es de postgres con RLS activa y sin FORCE', v_t;
    end if;
    if not exists (select 1 from pg_catalog.pg_attribute a
                    where a.attrelid = pg_catalog.to_regclass('public.' || v_t)
                      and a.attname = 'tenant_id' and a.atttypid = 'uuid'::pg_catalog.regtype
                      and a.attnotnull and not a.attisdropped) then
      raise exception '0470 abortado: public.% no tiene tenant_id uuid not null', v_t;
    end if;

    -- Sólo la policy heredada, con la huella de producción (0079/0088 con 0230).
    if (select pg_catalog.count(*) from pg_catalog.pg_policies p
         where p.schemaname = 'public' and p.tablename = v_t) <> 1
       or not exists (
         select 1 from pg_catalog.pg_policies p
          where p.schemaname = 'public' and p.tablename = v_t
            and p.policyname = v_t || ' by tenant' and p.cmd = 'ALL'
            and p.roles = array['authenticated']::name[] and p.permissive = 'PERMISSIVE'
            and pg_catalog.md5(coalesce(p.qual, '') || '|' || coalesce(p.with_check, ''))
                = 'f118dd90556c13981e880287a2b28599') then
      raise exception '0470 abortado: public.% no tiene sólo «% by tenant» (FOR ALL, sólo tenant)', v_t, v_t;
    end if;

    -- Privilegios de hoy: authenticated lee y escribe; anon, nada (0465).
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not pg_catalog.has_table_privilege('authenticated', 'public.' || v_t, v_priv) then
        raise exception '0470 abortado: authenticated no tiene % sobre public.%', v_priv, v_t;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('anon', 'public.' || v_t,
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_any_column_privilege('anon', 'public.' || v_t, 'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception '0470 abortado: anon tiene privilegios sobre public.%', v_t;
    end if;
  end loop;

  -- La membresía que piden las policies nuevas: el usuario lee sus propias filas.
  if pg_catalog.to_regprocedure('auth.uid()') is null
     or not pg_catalog.has_table_privilege('authenticated', 'public.user_tenants', 'SELECT') then
    raise exception '0470 abortado: falta auth.uid() o el SELECT de authenticated sobre user_tenants';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_attribute a
       where a.attrelid = 'public.user_tenants'::pg_catalog.regclass and not a.attisdropped
         and ((a.attname = 'user_id' and a.atttypid = 'uuid'::pg_catalog.regtype)
           or (a.attname = 'tenant_id' and a.atttypid = 'uuid'::pg_catalog.regtype)
           or (a.attname = 'role' and a.atttypid = 'text'::pg_catalog.regtype)
           or (a.attname = 'disabled_at' and a.atttypid = 'timestamptz'::pg_catalog.regtype))) <> 4 then
    raise exception '0470 abortado: user_tenants no tiene user_id, tenant_id, role y disabled_at';
  end if;

  -- Cuerpos de producción (md5 del prosrc con CRLF→LF, o sin espacios), leídos
  -- del catálogo el 2026-09-19. Otro cuerpo aborta sin cambiar nada.
  for v_fn in select * from (values
    ('public.get_user_tenant_id()', true,
     '5ff0c51c26a49419c34abc78f1d95c37', '4ce5acd04a577f91ca77b74ebc622c49'),                -- 0453
    ('public.current_studio_role()', true,
     'b7157932457d04df4e8cf7621d212965', 'df8ba5229960ba06888dec61fbec2bc5'),                -- 0200
    ('public.assert_studio_role(text[])', true,
     'a03db72fff4d31f336c1124b4151ff6d', '8cc4c527334c2ac95662be6b921a551b'),                -- 0351
    ('public.void_payment_receipt_with_audit_reason(uuid,text)', false,
     '84882604a0e14fc16d9e76a956d6a63d', '344ff401342529ad131edd35a19b1eca'),                -- 0294
    ('public.void_supplier_bill_with_audit_reason(uuid,text)', false,
     '125c8825bf6261f910f3bf2c6ac565c1', 'efbd6e6793134fc6f038f53151342387'),                -- 0294
    ('public.void_supplier_payment_with_audit_reason(uuid,text)', false,
     'f06331df9d2c264d3dac7391f0cd0c12', '3488a63b89a9f16a2e7c1e9b306be53d')                 -- 0294
  ) e(signature, definer, body_md5, body_md5_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
      from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
       and p.prosecdef = v_fn.definer
       and p.proowner = 'postgres'::pg_catalog.regrole;
    if v_md5 is null
       or (v_md5 <> v_fn.body_md5 and v_md5_normalized <> v_fn.body_md5_normalized) then
      raise exception '0470 abortado: % no tiene el cuerpo, la seguridad o el owner de producción', v_fn.signature;
    end if;
  end loop;

  -- Las envolturas se reemplazan con el mismo INVOKER y search_path vacío.
  if exists (select 1 from pg_catalog.pg_proc p
              where p.oid in (pg_catalog.to_regprocedure('public.void_payment_receipt_with_audit_reason(uuid,text)'),
                              pg_catalog.to_regprocedure('public.void_supplier_bill_with_audit_reason(uuid,text)'),
                              pg_catalog.to_regprocedure('public.void_supplier_payment_with_audit_reason(uuid,text)'))
                and (p.proconfig is distinct from array['search_path=""']::text[]
                     or p.prorettype <> 'boolean'::pg_catalog.regtype)) then
    raise exception '0470 abortado: una envoltura de la 0294 no es boolean con search_path vacío';
  end if;

  -- rename_client_markbox escribe payment_receipts sin pasar por la RLS: tiene
  -- que seguir siendo DEFINER del dueño de las tablas.
  if pg_catalog.to_regprocedure('public.rename_client_markbox(uuid,text,text)') is not null
     and not exists (select 1 from pg_catalog.pg_proc p
                      where p.oid = pg_catalog.to_regprocedure('public.rename_client_markbox(uuid,text,text)')
                        and p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole) then
    raise exception '0470 abortado: rename_client_markbox no es DEFINER de postgres; la RLS nueva lo frenaría';
  end if;
end;
$preflight$;

-- ── payment_receipts ────────────────────────────────────────
drop policy "payment_receipts by tenant" on public.payment_receipts;
create policy payment_receipts_team_select
  on public.payment_receipts for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy payment_receipts_accounting_insert
  on public.payment_receipts for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy payment_receipts_accounting_update
  on public.payment_receipts for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
grant select, insert, update on public.payment_receipts to authenticated;
revoke delete on public.payment_receipts from authenticated;
comment on table public.payment_receipts is
  'SDD-0041: ledger de recibos de pago. Un recibo por cobro sobre una factura (invoice_id, on delete restrict). amount en la moneda de la factura; el asiento del cobro (DR cash_account_id / CR 1.1.2) se hace en USD funcional. Anular = deleted_at (auditable). RLS por tenant_id. SDD-0492: el SELECT sigue tenant-wide, INSERT/UPDATE exigen accounting o admin (0470) y authenticated no tiene DELETE físico; service_role queda para jobs y RPC controladas.';

-- ── suppliers ───────────────────────────────────────────────
drop policy "suppliers by tenant" on public.suppliers;
create policy suppliers_team_select
  on public.suppliers for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy suppliers_accounting_insert
  on public.suppliers for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy suppliers_accounting_update
  on public.suppliers for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
grant select, insert, update on public.suppliers to authenticated;
revoke delete on public.suppliers from authenticated;
comment on table public.suppliers is
  'SDD-0044: proveedor-lite (PRV-NNNN). type cubre proveedor_cn/naviera/agente_aduanal/servicio/otro. Lo justo para atar la CxP a un payee y agrupar deuda + remesas a China. Soft delete via deleted_at. RLS por tenant_id. SDD-0492: el SELECT sigue tenant-wide, INSERT/UPDATE exigen accounting o admin (0470) y authenticated no tiene DELETE físico. El catálogo comercial de proveedores del cliente es suppliers_cn, que no cambia.';

-- ── supplier_bills ──────────────────────────────────────────
drop policy "supplier_bills by tenant" on public.supplier_bills;
create policy supplier_bills_team_select
  on public.supplier_bills for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy supplier_bills_accounting_insert
  on public.supplier_bills for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy supplier_bills_accounting_update
  on public.supplier_bills for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
grant select, insert, update on public.supplier_bills to authenticated;
revoke delete on public.supplier_bills from authenticated;
comment on table public.supplier_bills is
  'SDD-0044: cuentas por pagar (CXP-YYYY-NNNN). Asiento de causación DR expense_account_id / CR 2.1.1. La cola CxP se deriva por query (total_amount-paid_amount>0, status≠anulada). paid_amount lo sube cada supplier_payment. Soft delete via deleted_at. RLS por tenant_id. SDD-0492: el SELECT sigue tenant-wide, INSERT/UPDATE exigen accounting o admin (0470) —también para paid_amount y status— y authenticated no tiene DELETE físico.';

-- ── supplier_payments ───────────────────────────────────────
drop policy "supplier_payments by tenant" on public.supplier_payments;
create policy supplier_payments_team_select
  on public.supplier_payments for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy supplier_payments_accounting_insert
  on public.supplier_payments for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy supplier_payments_accounting_update
  on public.supplier_payments for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
grant select, insert, update on public.supplier_payments to authenticated;
revoke delete on public.supplier_payments from authenticated;
comment on table public.supplier_payments is
  'SDD-0044: órdenes de pago a proveedores (OP-YYYY-NNNN). Una orden por CxP (bill_id, on delete restrict). amount en la moneda de la orden; asiento del pago (DR 2.1.1 / CR cash_account_id) en USD funcional. Anular = deleted_at (revierte saldo + asiento). RLS por tenant_id. SDD-0492: el SELECT sigue tenant-wide, INSERT/UPDATE exigen accounting o admin (0470) y authenticated no tiene DELETE físico.';

-- ── Envolturas de anulación (0294): exigen rol ──────────────
-- Mismo encabezado y cuerpo que la 0294, con el assert al principio. CREATE OR
-- REPLACE conserva el owner (postgres) y la ACL.
create or replace function public.void_payment_receipt_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  -- SDD-0492: anular un cobro es de accounting o admin (42501 si no).
  perform public.assert_studio_role(array['accounting', 'admin']);

  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.payment_receipts
  set deleted_at = pg_catalog.clock_timestamp()
  where id = p_id
    and deleted_at is null;

  return found;
end;
$function$;

create or replace function public.void_supplier_bill_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  -- SDD-0492: anular una CxP es de accounting o admin (42501 si no).
  perform public.assert_studio_role(array['accounting', 'admin']);

  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.supplier_bills
  set status = 'anulada'
  where id = p_id
    and status <> 'anulada'
    and paid_amount = 0;

  return found;
end;
$function$;

create or replace function public.void_supplier_payment_with_audit_reason(
  p_id uuid,
  p_reason text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  -- SDD-0492: anular una orden de pago es de accounting o admin (42501 si no).
  perform public.assert_studio_role(array['accounting', 'admin']);

  if v_reason is null
     or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres'
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.supplier_payments
  set deleted_at = pg_catalog.clock_timestamp()
  where id = p_id
    and deleted_at is null;

  return found;
end;
$function$;

do $postflight$
declare
  v_t text;
  v_priv text;
  v_fn text;
begin
  foreach v_t in array array['payment_receipts', 'suppliers', 'supplier_bills', 'supplier_payments'] loop
    -- Exactamente tres policies: lectura, alta y edición. Ninguna de DELETE.
    if exists (
      with expected(policyname, cmd) as (values
        (v_t || '_team_select', 'SELECT'),
        (v_t || '_accounting_insert', 'INSERT'),
        (v_t || '_accounting_update', 'UPDATE')
      ), actual as (
        select * from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = v_t
      )
      select 1 from expected e full join actual a on a.policyname = e.policyname
      where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
        or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
    ) then
      raise exception '0470 postflight: public.% no quedó con sus tres policies', v_t;
    end if;

    -- La lectura sigue siendo sólo el tenant, sin rol: es la de la 0407.
    if not exists (select 1 from pg_catalog.pg_policies p
                    where p.schemaname = 'public' and p.tablename = v_t
                      and p.policyname = v_t || '_team_select'
                      and p.with_check is null
                      and p.qual like '%get_user_tenant_id()%'
                      and p.qual not like '%current_studio_role%') then
      raise exception '0470 postflight: la lectura de public.% dejó de ser la del equipo del tenant', v_t;
    end if;

    -- Alta y edición piden, además del tenant, el rol financiero activo. En la
    -- de UPDATE, la fila vieja y la nueva pasan por la misma expresión.
    if exists (select 1 from pg_catalog.pg_policies p
                where p.schemaname = 'public' and p.tablename = v_t
                  and p.policyname in (v_t || '_accounting_insert', v_t || '_accounting_update')
                  and (p.with_check is null
                       or (p.cmd = 'UPDATE') is distinct from (p.qual is not null)
                       or not (p.with_check like '%get_user_tenant_id()%'
                               and p.with_check like '%current_studio_role()%'
                               and p.with_check like '%''accounting''%'
                               and p.with_check like '%''admin''%')
                       or (p.cmd = 'UPDATE' and p.qual is distinct from p.with_check))) then
      raise exception '0470 postflight: alta o edición de public.% no pide accounting o admin', v_t;
    end if;

    -- authenticated lee, da de alta y edita; no borra. service_role conserva
    -- todo. anon, nada.
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE'] loop
      if not pg_catalog.has_table_privilege('authenticated', 'public.' || v_t, v_priv) then
        raise exception '0470 postflight: authenticated perdió % sobre public.%', v_priv, v_t;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('authenticated', 'public.' || v_t, 'DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception '0470 postflight: authenticated todavía puede borrar public.%', v_t;
    end if;
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not pg_catalog.has_table_privilege('service_role', 'public.' || v_t, v_priv) then
        raise exception '0470 postflight: service_role perdió % sobre public.%', v_priv, v_t;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('anon', 'public.' || v_t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception '0470 postflight: anon tiene privilegios sobre public.%', v_t;
    end if;

    if exists (select 1 from pg_catalog.pg_class c
                where c.oid = pg_catalog.to_regclass('public.' || v_t) and c.relforcerowsecurity) then
      raise exception '0470 postflight: public.% quedó con FORCE ROW LEVEL SECURITY', v_t;
    end if;
  end loop;

  -- Las envolturas: INVOKER, search_path vacío, de postgres, con el assert, y
  -- ejecutables por authenticated (las RPC de la 0467 y la 0468 las llaman).
  foreach v_fn in array array[
    'public.void_payment_receipt_with_audit_reason(uuid,text)',
    'public.void_supplier_bill_with_audit_reason(uuid,text)',
    'public.void_supplier_payment_with_audit_reason(uuid,text)'
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = pg_catalog.to_regprocedure(v_fn)
                      and not p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole
                      and p.proconfig = array['search_path=""']::text[]
                      and p.prosrc like '%perform public.assert_studio_role(array[''accounting'', ''admin'']);%')
       or not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE') then
      raise exception '0470 postflight: % no quedó INVOKER, de postgres, con el assert y la ACL de antes', v_fn;
    end if;
  end loop;
end;
$postflight$;
