-- ─────────────────────────────────────────────────────────────────────────────
-- 0511 · SDD-0593 — Escribir asientos queda para accounting y admin, y las cuentas
-- bancarias de la empresa sólo se escriben por su RPC auditada.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Va antes de que el ERP entre en
--    uso real, como la 0510.
--
-- ── El hueco ────────────────────────────────────────────────
-- Las tres tablas tienen una sola policy FOR ALL para authenticated, que sólo
-- pide el tenant («journal_entries by tenant», «journal_lines by entry tenant»,
-- «company_bank_accounts by tenant»). Cualquier miembro activo del tenant, de
-- cualquier rol, podía por PostgREST crear, asentar, alterar o borrar asientos,
-- y cambiar el número de cuenta bancaria que sale en las facturas. Los clientes
-- del portal no pasan: no tienen membresía en user_tenants.
--
-- ── Quién escribe hoy (inventario de la spec 0593) ───────────
-- Asientos:
-- · Los posting automáticos (lib/studio/accounting/*-posting.ts y
--   partner-finance/posting.ts) usan el cliente admin: service_role, que no pasa
--   por RLS. Por eso un flujo de un rol no financiero, como un gasto de
--   operaciones, sigue asentando.
-- · createJournalEntry, postEntry y softDeleteEntry, en
--   app/studio/(app)/contabilidad/actions.ts, con el cliente de sesión, después
--   del guard del módulo accounting (accounting y admin, bajo candado). voidEntry,
--   igual, por void_journal_entry_with_audit_reason (0294), que es INVOKER.
-- · Las RPC DEFINER de postgres: las de cierre (0493), void_expense_governed,
--   void_payroll_settlement_governed y pay_claim_indemnity_governed. La RLS no las
--   alcanza, y cada una tiene su propio candado.
-- · Nadie edita ni borra una línea con el cliente de sesión: sólo se insertan.
-- Cuentas bancarias:
-- · saveBankAccountAction y deleteBankAccountAction, por audit_d1_execute, DEFINER
--   de postgres, que exige admin. Ningún camino escribe directo: el código sólo
--   la lee (lib/studio/company-queries.ts).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- · journal_entries: el molde de la 0470 y la 0510, con _team_select y
--   _accounting_insert, _update y _delete. DELETE se queda porque
--   createJournalEntry borra la cabecera si fallan sus líneas.
-- · journal_lines: _team_select y _accounting_insert, atadas al tenant del asiento.
--   Se revocan UPDATE y DELETE de authenticated: nadie los usa, y el borrado en
--   cascada no pasa por este permiso.
-- · company_bank_accounts: sólo _team_select. Se revocan INSERT y UPDATE de
--   authenticated: la escritura sigue por la RPC. Es la forma de la 0422.
--
-- ── Qué no cambia ───────────────────────────────────────────
-- Las lecturas, las filas, service_role, las RPC y los triggers de cierre (0133),
-- de auditoría (0290) y de updated_at. La lectura de asientos sigue siendo de todo
-- el equipo del tenant: la deuda deliberada que anotó la 0407. Un no financiero que
-- llame a void_journal_entry_with_audit_reason recibe false, sin error: la RLS de
-- UPDATE no le deja fila. Es lo que recibe hoy quien no alcanza el asiento.
--
-- ── Locks de esta migración ─────────────────────────────────
-- DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre las tres tablas hasta el COMMIT:
-- milisegundos. Los límites son `set local` y sin `reset`, para que alcancen
-- también al INSERT del ledger que el empaquetador agrega después de este archivo.
-- Si corta, se reintenta entera.
-- ─────────────────────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_t record;
  v_priv text;
  v_fn record;
  v_md5 text;
  v_md5_normalized text;
begin
  -- Huella sin espacios de la policy heredada, medida en producción el 2026-11-02.
  for v_t in select * from (values
    ('journal_entries', 'journal_entries by tenant', '166af3198bb588089bebf7ac447ad386', true),
    ('journal_lines', 'journal_lines by entry tenant', 'c734203dcb6046a39222f6fc8c17ebd5', true),
    ('company_bank_accounts', 'company_bank_accounts by tenant', '166af3198bb588089bebf7ac447ad386', false)
  ) e(tabla, politica, huella, con_delete) loop
    -- De postgres, con RLS y SIN FORCE: así la RLS no alcanza a los DEFINER.
    if not exists (select 1 from pg_catalog.pg_class c
                    where c.oid = pg_catalog.to_regclass('public.' || v_t.tabla)
                      and c.relrowsecurity and not c.relforcerowsecurity
                      and c.relowner = 'postgres'::pg_catalog.regrole) then
      raise exception '0511 abortado: public.% no es de postgres con RLS activa y sin FORCE', v_t.tabla;
    end if;

    if (select pg_catalog.count(*) from pg_catalog.pg_policies p
         where p.schemaname = 'public' and p.tablename = v_t.tabla) <> 1
       or not exists (
         select 1 from pg_catalog.pg_policies p
          where p.schemaname = 'public' and p.tablename = v_t.tabla
            and p.policyname = v_t.politica and p.cmd = 'ALL'
            and p.roles = array['authenticated']::name[] and p.permissive = 'PERMISSIVE'
            and pg_catalog.md5(pg_catalog.regexp_replace(
                  coalesce(p.qual, '') || '|' || coalesce(p.with_check, ''), '\s', '', 'g')) = v_t.huella) then
      raise exception '0511 abortado: public.% no tiene sólo «%» (FOR ALL, sólo tenant)', v_t.tabla, v_t.politica;
    end if;

    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE'] loop
      if not pg_catalog.has_table_privilege('authenticated', 'public.' || v_t.tabla, v_priv) then
        raise exception '0511 abortado: authenticated no tiene % sobre public.%', v_priv, v_t.tabla;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('authenticated', 'public.' || v_t.tabla, 'DELETE') <> v_t.con_delete then
      raise exception '0511 abortado: el DELETE de authenticated sobre public.% no es el de producción', v_t.tabla;
    end if;
    if pg_catalog.has_table_privilege('anon', 'public.' || v_t.tabla,
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or pg_catalog.has_any_column_privilege('anon', 'public.' || v_t.tabla, 'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception '0511 abortado: anon tiene privilegios sobre public.%', v_t.tabla;
    end if;
  end loop;

  -- Cuerpos de producción (md5 del prosrc con CRLF→LF, o sin espacios), leídos
  -- del catálogo el 2026-11-02. Otro cuerpo aborta sin cambiar nada.
  for v_fn in select * from (values
    ('public.get_user_tenant_id()',
     '5ff0c51c26a49419c34abc78f1d95c37', '4ce5acd04a577f91ca77b74ebc622c49'),                -- 0453
    ('public.current_studio_role()',
     'b7157932457d04df4e8cf7621d212965', 'df8ba5229960ba06888dec61fbec2bc5')                 -- 0200
  ) e(signature, body_md5, body_md5_normalized) loop
    select pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')),
           pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g'))
      into v_md5, v_md5_normalized
      from pg_catalog.pg_proc p
     where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
       and p.prosecdef
       and p.proowner = 'postgres'::pg_catalog.regrole;
    if v_md5 is null
       or (v_md5 <> v_fn.body_md5 and v_md5_normalized <> v_fn.body_md5_normalized) then
      raise exception '0511 abortado: % no tiene el cuerpo, la seguridad o el owner de producción', v_fn.signature;
    end if;
  end loop;

  -- La escritura de cuentas bancarias sigue por la RPC sólo si esta es del dueño
  -- de la tabla y DEFINER: sin eso, el revoke la rompería.
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = pg_catalog.to_regprocedure('public.audit_d1_execute(uuid,text,uuid,jsonb,text)')
                    and p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole) then
    raise exception '0511 abortado: audit_d1_execute no es DEFINER de postgres; el revoke la frenaría';
  end if;
  -- voidEntry pasa por esta INVOKER: la RLS nueva la alcanza a propósito.
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = pg_catalog.to_regprocedure('public.void_journal_entry_with_audit_reason(uuid,text)')
                    and not p.prosecdef) then
    raise exception '0511 abortado: void_journal_entry_with_audit_reason no es INVOKER';
  end if;
end;
$preflight$;

-- ── journal_entries ─────────────────────────────────────────
drop policy "journal_entries by tenant" on public.journal_entries;
create policy journal_entries_team_select
  on public.journal_entries for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy journal_entries_accounting_insert
  on public.journal_entries for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy journal_entries_accounting_update
  on public.journal_entries for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy journal_entries_accounting_delete
  on public.journal_entries for delete
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

-- ── journal_lines ───────────────────────────────────────────
drop policy "journal_lines by entry tenant" on public.journal_lines;
create policy journal_lines_team_select
  on public.journal_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = (select public.get_user_tenant_id())
    )
  );
create policy journal_lines_accounting_insert
  on public.journal_lines for insert
  to authenticated
  with check (
    exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = (select public.get_user_tenant_id())
    )
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
revoke update, delete on public.journal_lines from authenticated;

-- ── company_bank_accounts ───────────────────────────────────
drop policy "company_bank_accounts by tenant" on public.company_bank_accounts;
create policy company_bank_accounts_team_select
  on public.company_bank_accounts for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
revoke insert, update on public.company_bank_accounts from authenticated;

do $postflight$
declare
  v_t text;
  v_priv text;
begin
  -- Las policies exactas de cada tabla.
  if exists (
    with expected(tablename, policyname, cmd) as (values
      ('journal_entries', 'journal_entries_team_select', 'SELECT'),
      ('journal_entries', 'journal_entries_accounting_insert', 'INSERT'),
      ('journal_entries', 'journal_entries_accounting_update', 'UPDATE'),
      ('journal_entries', 'journal_entries_accounting_delete', 'DELETE'),
      ('journal_lines', 'journal_lines_team_select', 'SELECT'),
      ('journal_lines', 'journal_lines_accounting_insert', 'INSERT'),
      ('company_bank_accounts', 'company_bank_accounts_team_select', 'SELECT')
    ), actual as (
      select * from pg_catalog.pg_policies p
       where p.schemaname = 'public' and p.tablename in ('journal_entries', 'journal_lines', 'company_bank_accounts')
    )
    select 1 from expected e full join actual a
      on a.tablename = e.tablename and a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0511 postflight: asientos o cuentas bancarias no quedaron con sus policies';
  end if;

  -- Las lecturas siguen siendo sólo el tenant, sin rol.
  if exists (select 1 from pg_catalog.pg_policies p
              where p.schemaname = 'public' and p.tablename in ('journal_entries', 'journal_lines', 'company_bank_accounts')
                and p.cmd = 'SELECT'
                and (p.with_check is not null
                     or p.qual not like '%get_user_tenant_id()%'
                     or p.qual like '%current_studio_role%')) then
    raise exception '0511 postflight: una lectura dejó de ser la del equipo del tenant';
  end if;

  -- Las escrituras piden, además del tenant, el rol financiero activo. En la de
  -- UPDATE, la fila vieja y la nueva pasan por la misma expresión.
  if exists (select 1 from pg_catalog.pg_policies p
              cross join lateral (select case p.cmd when 'DELETE' then p.qual else p.with_check end as expr) e
              where p.schemaname = 'public' and p.tablename in ('journal_entries', 'journal_lines')
                and p.cmd in ('INSERT', 'UPDATE', 'DELETE')
                and (e.expr is null
                     or (p.cmd = 'INSERT') is distinct from (p.qual is null)
                     or (p.cmd = 'DELETE') is distinct from (p.with_check is null)
                     or not (e.expr like '%get_user_tenant_id()%'
                             and e.expr like '%current_studio_role()%'
                             and e.expr like '%''accounting''%'
                             and e.expr like '%''admin''%')
                     or (p.cmd = 'UPDATE' and p.qual is distinct from p.with_check))) then
    raise exception '0511 postflight: una escritura de asientos no pide accounting o admin';
  end if;

  -- Los GRANT: lo que la app usa se queda, lo demás sale.
  foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not pg_catalog.has_table_privilege('authenticated', 'public.journal_entries', v_priv) then
      raise exception '0511 postflight: authenticated perdió % sobre public.journal_entries', v_priv;
    end if;
  end loop;
  if not pg_catalog.has_table_privilege('authenticated', 'public.journal_lines', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.journal_lines', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.journal_lines', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '0511 postflight: public.journal_lines no quedó con SELECT e INSERT para authenticated';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.company_bank_accounts', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.company_bank_accounts', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '0511 postflight: public.company_bank_accounts no quedó de sólo lectura para authenticated';
  end if;

  foreach v_t in array array['journal_entries', 'journal_lines', 'company_bank_accounts'] loop
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not pg_catalog.has_table_privilege('service_role', 'public.' || v_t, v_priv) then
        raise exception '0511 postflight: service_role perdió % sobre public.%', v_priv, v_t;
      end if;
    end loop;
    if pg_catalog.has_table_privilege('anon', 'public.' || v_t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception '0511 postflight: anon tiene privilegios sobre public.%', v_t;
    end if;
    if exists (select 1 from pg_catalog.pg_class c
                where c.oid = pg_catalog.to_regclass('public.' || v_t) and c.relforcerowsecurity) then
      raise exception '0511 postflight: public.% quedó con FORCE ROW LEVEL SECURITY', v_t;
    end if;
  end loop;
end;
$postflight$;
