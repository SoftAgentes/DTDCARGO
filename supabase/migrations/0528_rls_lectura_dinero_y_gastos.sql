-- ─────────────────────────────────────────────────────────────────────────────
-- 0528 · SDD-0624 — La lectura del dinero queda para quien tiene el dinero, y
-- Soporte deja de escribir gastos.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Depende de la 0470 y la 0511,
--    ya aplicadas y selladas en supabase/migrations.lock.json: el preflight
--    aborta si sus policies `*_team_select` no existen. Medir el ledger antes.
--
-- ⚠️ ORDEN: aplicar DESPUÉS de desplegar la PR de la SDD-0624. Aplicarla antes
--    deja en falso la comprobación del asiento de gastos: la app anterior lee
--    `journal_entries` con la sesión al editar un gasto (gastos/actions.ts y
--    expenseHistoryError de m/erp/actions.ts); con esta migración, quien no es
--    accounting ni admin ve 0 filas, la comprobación pasa y el gasto se edita
--    sin mirar su asiento. La app de esta PR lee ese asiento con el cliente de
--    servicio y funciona con o sin la 0528.
--
-- ── El hueco ────────────────────────────────────────────────
-- La 0470 y la 0511 cerraron la ESCRITURA de asientos, cobros y cuentas por
-- pagar a accounting y admin, pero dejaron la LECTURA abierta a todo el tenant
-- («deuda deliberada» de la 0407). La matriz del Studio (lib/studio/rbac.ts,
-- MONEY_MODULES) dice que el dinero lo ven sólo accounting y admin; la base lo
-- dejaba leer a cualquier miembro activo —support, warehouse, marketing— por
-- PostgREST con el JWT de su sesión.
--
-- ── Quién lee hoy con el cliente de sesión (inventario de la spec 0624) ─────
-- journal_entries / journal_lines: contabilidad, conciliación, libro de control,
--   reportes (módulos de dinero → accounting). Los posting automáticos usan el
--   cliente admin (service_role, sin RLS). La única lectura FUERA del dinero es
--   reclamos (claims-queries.ts: `entry_code` del asiento de indemnización), que
--   ven commercial, operations y support: pasa a la RPC mínima de abajo.
-- payment_receipts: cobranzas, facturación, renditions (admin), reportes, la
--   búsqueda global (faceta `payments`, gateada por `collections`) y el CSV
--   operativo (gateado por `collections`).
-- supplier_bills / supplier_payments: tesorería, fiscal, reportes, financiero
--   China (admin) y recibir una OC (capability `approve_money` → accounting).
-- Se quedan como están, a propósito: `suppliers` (el módulo de proveedores lo
-- usan commercial y operations), `company_bank_accounts` (el número sale en
-- cotizaciones y facturas) y `accounts` (plan de cuentas, sin montos).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- · `studio_can_read_money()`: UN helper para todas las policies. Hoy es el rol
--   (accounting o admin, membresía activa). La SDD-0622 (accesos por persona)
--   lo puede redefinir para sumar los extras sin tocar ninguna policy.
-- · `*_team_select` de las cinco tablas pasa a `*_money_select`.
-- · `claim_indemnity_entry_codes(uuid[])`: DEFINER, devuelve sólo
--   (claim_id, entry_code) de asientos asentados del tenant, para quien ve
--   Reclamos. Nada de montos.
-- · expenses: `expenses_insert` y `expenses_update` (dueño) exigen además una
--   membresía activa que no sea `support` (read-only). Crear el gasto propio
--   sigue abierto al resto del staff A PROPÓSITO: el ERP móvil (/m/erp) deja a
--   comercial y operaciones cargar sus gastos de calle. `expenses_cn_team` y
--   `expenses_ve_accounting` (0074) no cambian: el equipo CN comparte los gastos
--   por diseño.
-- · Preflight: el conjunto exacto de policies que dejaron la 0047, la 0074, la
--   0470 y la 0511, con la huella de las que se reemplazan, y que las dos
--   funciones nuevas no existan. Postflight: el conjunto exacto que queda, las
--   lecturas con el helper, gastos sin support, y las dos funciones DEFINER con
--   search_path vacío, ejecutables sólo por authenticated (patrón 0470/0511).
--   Al final, `notify pgrst` para que PostgREST vea la RPC nueva (como la 0537).
--
-- ── Locks ───────────────────────────────────────────────────
-- DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre seis tablas hasta el COMMIT:
-- milisegundos. `set local`, como la 0511. Si corta, se reintenta entera.
-- ─────────────────────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_missing text;
begin
  select string_agg(r.t || '.' || r.p, ', ')
    into v_missing
  from (values
    ('journal_entries',   'journal_entries_team_select'),
    ('journal_lines',     'journal_lines_team_select'),
    ('payment_receipts',  'payment_receipts_team_select'),
    ('supplier_bills',    'supplier_bills_team_select'),
    ('supplier_payments', 'supplier_payments_team_select'),
    ('expenses',          'expenses_insert'),
    ('expenses',          'expenses_update')
  ) as r(t, p)
  where not exists (
    select 1 from pg_catalog.pg_policies
     where schemaname = 'public' and tablename = r.t and policyname = r.p
  );
  if v_missing is not null then
    raise exception '0528 abortado: faltan policies (¿se aplicaron la 0470 y la 0511?): %', v_missing;
  end if;

  if pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0528 abortado: faltan current_studio_role() o get_user_tenant_id()';
  end if;

  -- Las funciones nuevas no existen todavía: si están, otra migración ya las
  -- definió y esta las pisaría.
  if pg_catalog.to_regprocedure('public.studio_can_read_money()') is not null
     or pg_catalog.to_regprocedure('public.claim_indemnity_entry_codes(uuid[])') is not null then
    raise exception '0528 abortado: studio_can_read_money() o claim_indemnity_entry_codes(uuid[]) ya existen';
  end if;

  -- El conjunto EXACTO de policies que dejaron la 0047, la 0074, la 0470 y la
  -- 0511: nombre, comando, permisiva y roles. Una policy de más quedaría en
  -- paralelo y, si es permisiva, volvería a abrir lo que esta cierra.
  if exists (
    with expected(tablename, policyname, cmd, roles) as (values
      ('journal_entries',   'journal_entries_team_select',         'SELECT', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_insert',   'INSERT', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_update',   'UPDATE', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_delete',   'DELETE', array['authenticated']::name[]),
      ('journal_lines',     'journal_lines_team_select',           'SELECT', array['authenticated']::name[]),
      ('journal_lines',     'journal_lines_accounting_insert',     'INSERT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_team_select',        'SELECT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_accounting_insert',  'INSERT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_accounting_update',  'UPDATE', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_team_select',          'SELECT', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_accounting_insert',    'INSERT', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_accounting_update',    'UPDATE', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_team_select',       'SELECT', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_accounting_insert', 'INSERT', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_accounting_update', 'UPDATE', array['authenticated']::name[]),
      ('expenses',          'expenses_select',                     'SELECT', array['public']::name[]),
      ('expenses',          'expenses_insert',                     'INSERT', array['public']::name[]),
      ('expenses',          'expenses_update',                     'UPDATE', array['public']::name[]),
      ('expenses',          'expenses_cn_team',                    'ALL',    array['public']::name[]),
      ('expenses',          'expenses_ve_accounting',              'ALL',    array['public']::name[])
    ), actual as (
      select * from pg_catalog.pg_policies p
       where p.schemaname = 'public'
         and p.tablename in ('journal_entries', 'journal_lines', 'payment_receipts',
                             'supplier_bills', 'supplier_payments', 'expenses')
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> e.roles or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0528 abortado: las policies de dinero o gastos no son las que dejaron la 0470 y la 0511';
  end if;

  -- Huellas de lo que se reemplaza. Las lecturas son las del equipo del tenant,
  -- sin rol; las de gastos, las del dueño de la 0047, sin rol.
  if exists (select 1 from pg_catalog.pg_policies p
              where p.schemaname = 'public' and p.cmd = 'SELECT'
                and p.tablename in ('journal_entries', 'journal_lines', 'payment_receipts',
                                    'supplier_bills', 'supplier_payments')
                and (p.with_check is not null
                     or p.qual not like '%get_user_tenant_id()%'
                     or p.qual like '%current_studio_role%')) then
    raise exception '0528 abortado: una lectura *_team_select no es la del equipo del tenant';
  end if;
  if exists (select 1 from pg_catalog.pg_policies p
              cross join lateral (select case p.cmd when 'INSERT' then p.with_check else p.qual end as expr) e
              where p.schemaname = 'public' and p.tablename = 'expenses'
                and p.policyname in ('expenses_insert', 'expenses_update')
                and ((p.cmd = 'INSERT') is distinct from (p.qual is null)
                     or (p.cmd = 'UPDATE' and p.with_check is not null)
                     or e.expr is null
                     or e.expr not like '%auth.uid()%'
                     or e.expr not like '%user_tenants%'
                     or e.expr like '%current_studio_role%')) then
    raise exception '0528 abortado: expenses_insert o expenses_update no son las del dueño de la 0047';
  end if;
end;
$preflight$;

-- ── Helper ──────────────────────────────────────────────────
create or replace function public.studio_can_read_money()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_studio_role() in ('accounting', 'admin'), false)
$$;

comment on function public.studio_can_read_money() is
  'SDD-0624: ¿el usuario activo puede LEER los módulos de dinero? Hoy accounting o admin. Punto único para las policies *_money_select; la SDD-0622 lo redefine para sumar accesos por persona.';

revoke all on function public.studio_can_read_money() from public, anon;
grant execute on function public.studio_can_read_money() to authenticated;

-- ── journal_entries ─────────────────────────────────────────
drop policy journal_entries_team_select on public.journal_entries;
create policy journal_entries_money_select
  on public.journal_entries for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );

-- ── journal_lines ───────────────────────────────────────────
drop policy journal_lines_team_select on public.journal_lines;
create policy journal_lines_money_select
  on public.journal_lines for select
  to authenticated
  using (
    (select public.studio_can_read_money())
    and exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = (select public.get_user_tenant_id())
    )
  );

-- ── payment_receipts ────────────────────────────────────────
drop policy payment_receipts_team_select on public.payment_receipts;
create policy payment_receipts_money_select
  on public.payment_receipts for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );

-- ── supplier_bills ──────────────────────────────────────────
drop policy supplier_bills_team_select on public.supplier_bills;
create policy supplier_bills_money_select
  on public.supplier_bills for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );

-- ── supplier_payments ───────────────────────────────────────
drop policy supplier_payments_team_select on public.supplier_payments;
create policy supplier_payments_money_select
  on public.supplier_payments for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );

-- ── Reclamos: el código del asiento, sin montos ─────────────
create or replace function public.claim_indemnity_entry_codes(p_claim_ids uuid[])
returns table (claim_id uuid, entry_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select je.claim_id, je.entry_code
    from public.journal_entries je
   where je.claim_id = any (coalesce(p_claim_ids, '{}'::uuid[]))
     and je.tenant_id = public.get_user_tenant_id()
     and je.status = 'asentado'
     and je.deleted_at is null
     and public.current_studio_role() in ('admin', 'commercial', 'operations', 'accounting', 'support')
$$;

comment on function public.claim_indemnity_entry_codes(uuid[]) is
  'SDD-0624: para la pantalla de Reclamos. Devuelve sólo (claim_id, entry_code) de los asientos asentados del tenant a quien ve Reclamos (matriz: commercial, operations, accounting, support + admin). Reemplaza la lectura cruda de journal_entries que la 0528 cierra.';

revoke all on function public.claim_indemnity_entry_codes(uuid[]) from public, anon;
grant execute on function public.claim_indemnity_entry_codes(uuid[]) to authenticated;

-- ── expenses: support no escribe ────────────────────────────
drop policy expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    and coalesce((select public.current_studio_role()) <> 'support', false)
  );

drop policy expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update using (
    user_id = auth.uid()
    and tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    and coalesce((select public.current_studio_role()) <> 'support', false)
  );

do $postflight$
declare
  v_t text;
  v_fn regprocedure;
begin
  -- El conjunto EXACTO por tabla: la lectura del dinero es la *_money_select y
  -- ninguna otra; las escrituras de la 0470 y la 0511 y las cinco de gastos
  -- siguen, todas permisivas. Nada en paralelo.
  if exists (
    with expected(tablename, policyname, cmd, roles) as (values
      ('journal_entries',   'journal_entries_money_select',        'SELECT', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_insert',   'INSERT', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_update',   'UPDATE', array['authenticated']::name[]),
      ('journal_entries',   'journal_entries_accounting_delete',   'DELETE', array['authenticated']::name[]),
      ('journal_lines',     'journal_lines_money_select',          'SELECT', array['authenticated']::name[]),
      ('journal_lines',     'journal_lines_accounting_insert',     'INSERT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_money_select',       'SELECT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_accounting_insert',  'INSERT', array['authenticated']::name[]),
      ('payment_receipts',  'payment_receipts_accounting_update',  'UPDATE', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_money_select',         'SELECT', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_accounting_insert',    'INSERT', array['authenticated']::name[]),
      ('supplier_bills',    'supplier_bills_accounting_update',    'UPDATE', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_money_select',      'SELECT', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_accounting_insert', 'INSERT', array['authenticated']::name[]),
      ('supplier_payments', 'supplier_payments_accounting_update', 'UPDATE', array['authenticated']::name[]),
      ('expenses',          'expenses_select',                     'SELECT', array['public']::name[]),
      ('expenses',          'expenses_insert',                     'INSERT', array['public']::name[]),
      ('expenses',          'expenses_update',                     'UPDATE', array['public']::name[]),
      ('expenses',          'expenses_cn_team',                    'ALL',    array['public']::name[]),
      ('expenses',          'expenses_ve_accounting',              'ALL',    array['public']::name[])
    ), actual as (
      select * from pg_catalog.pg_policies p
       where p.schemaname = 'public'
         and p.tablename in ('journal_entries', 'journal_lines', 'payment_receipts',
                             'supplier_bills', 'supplier_payments', 'expenses')
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> e.roles or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0528 postflight: las policies de dinero o gastos no quedaron como se esperaba';
  end if;

  -- Cada lectura del dinero pide el tenant Y el helper, sin WITH CHECK.
  if exists (select 1 from pg_catalog.pg_policies p
              where p.schemaname = 'public' and p.cmd = 'SELECT'
                and p.tablename in ('journal_entries', 'journal_lines', 'payment_receipts',
                                    'supplier_bills', 'supplier_payments')
                and (p.with_check is not null
                     or p.qual not like '%get_user_tenant_id()%'
                     or p.qual not like '%studio_can_read_money()%')) then
    raise exception '0528 postflight: una lectura del dinero no pide el tenant y studio_can_read_money()';
  end if;

  -- Alta y edición del gasto propio: dueño, tenant y rol distinto de support.
  if exists (select 1 from pg_catalog.pg_policies p
              cross join lateral (select case p.cmd when 'INSERT' then p.with_check else p.qual end as expr) e
              where p.schemaname = 'public' and p.tablename = 'expenses'
                and p.policyname in ('expenses_insert', 'expenses_update')
                and ((p.cmd = 'INSERT') is distinct from (p.qual is null)
                     or (p.cmd = 'UPDATE' and p.with_check is not null)
                     or e.expr is null
                     or e.expr not like '%auth.uid()%'
                     or e.expr not like '%user_tenants%'
                     or e.expr not like '%current_studio_role()%'
                     or e.expr not like '%''support''%')) then
    raise exception '0528 postflight: expenses_insert o expenses_update no cierran a support';
  end if;

  -- RLS encendida, sin FORCE, y authenticated conserva su SELECT de tabla.
  foreach v_t in array array['journal_entries', 'journal_lines', 'payment_receipts',
                             'supplier_bills', 'supplier_payments', 'expenses'] loop
    if not exists (select 1 from pg_catalog.pg_class c
                    where c.oid = pg_catalog.to_regclass('public.' || v_t)
                      and c.relrowsecurity and not c.relforcerowsecurity) then
      raise exception '0528 postflight: public.% no quedó con RLS (sin FORCE)', v_t;
    end if;
    if not pg_catalog.has_table_privilege('authenticated', 'public.' || v_t, 'SELECT') then
      raise exception '0528 postflight: authenticated perdió SELECT sobre public.%', v_t;
    end if;
  end loop;

  -- Las dos funciones: SQL, STABLE, DEFINER y search_path vacío; las ejecuta
  -- authenticated, no PUBLIC ni anon.
  foreach v_fn in array array['public.studio_can_read_money()'::regprocedure,
                              'public.claim_indemnity_entry_codes(uuid[])'::regprocedure] loop
    if not exists (select 1 from pg_catalog.pg_proc p
                    join pg_catalog.pg_language l on l.oid = p.prolang
                    where p.oid = v_fn and l.lanname = 'sql' and p.provolatile = 's'
                      and p.prosecdef and p.proconfig = array['search_path=""']) then
      raise exception '0528 postflight: % no quedó SQL, STABLE, DEFINER y con search_path vacío', v_fn;
    end if;
    if exists (select 1 from pg_catalog.pg_proc p
                cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                where p.oid = v_fn and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception '0528 postflight: PUBLIC puede ejecutar %', v_fn;
    end if;
    if pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
       or not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      raise exception '0528 postflight: % no quedó sólo para authenticated', v_fn;
    end if;
  end loop;
end;
$postflight$;

notify pgrst, 'reload schema';
