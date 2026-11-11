-- ─────────────────────────────────────────────────────────────────────────────
-- 0510 · SDD-0591 — Cambiar el plan de cuentas queda para accounting y admin.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Condición de Sam del
--    2026-11-02, al quitar el filtro de la 0497: tiene que estar aplicada antes
--    de que el ERP entre en uso real.
--
-- ── El hueco ────────────────────────────────────────────────
-- La tabla tiene una sola policy, «accounts by tenant» (0078:147): FOR ALL para
-- authenticated, que sólo pide el tenant. Cualquier miembro activo del tenant,
-- de cualquier rol, podía hacer INSERT, UPDATE o DELETE por PostgREST. Los
-- clientes del portal no pasan: no tienen membresía en user_tenants.
-- Desde la 0497 la validez de cada venta depende de is_postable, parent_id y
-- code de esta tabla: un PATCH a is_postable de la 4.5 dejaría sin cobro a todas
-- las facturas con venta del tenant.
--
-- ── Quién escribe hoy (inventario de la spec 0591) ───────────
-- · La app: createAccount, updateAccount y deleteAccount, en
--   app/studio/(app)/contabilidad/actions.ts. Usan el cliente de sesión después
--   de moduleEditDenial("accounting"): accounting y admin. El módulo es de dinero
--   y está bajo candado (LOCKED_MODULES en lib/studio/rbac.ts): los overrides no
--   lo abren.
-- · Ninguna función del catálogo de producción escribe en accounts (medido el
--   2026-11-02). Las siembras de 0078, 0114, 0122 y 0157 corrieron como postgres.
--
-- ── Qué cambia ──────────────────────────────────────────────
-- El molde de la 0470 (SDD-0492), que ya corre en producción. La policy FOR ALL
-- se reemplaza por cuatro:
--   · accounts_team_select: tenant-wide, como hoy. Asientos, gastos, tesorería y
--     reportes leen el plan desde roles que no son financieros;
--   · accounts_accounting_insert, _update y _delete: además del tenant, rol
--     accounting o admin del usuario activo (current_studio_role(), 0200). Con
--     dos membresías activas, get_user_tenant_id() (0453) devuelve null y no
--     escribe nada.
-- A diferencia de la 0470, DELETE se queda y authenticated conserva su GRANT:
-- deleteAccount borra físico con el cliente de sesión.
--
-- ── Qué no cambia ───────────────────────────────────────────
-- Las lecturas, las filas, los GRANT, service_role (BYPASSRLS), los triggers de
-- auditoría (0290) y de updated_at, y la app. accounting y admin todavía pueden
-- hacer ese PATCH por PostgREST: la validación de la app no vive en la base. Es
-- el FUERA DE ALCANCE de la spec.
--
-- ── Locks de esta migración ─────────────────────────────────
-- DROP/CREATE POLICY toma ACCESS EXCLUSIVE sobre accounts hasta el COMMIT: frena
-- lecturas y escrituras mientras dura, que son milisegundos. Los límites son
-- `set local` y sin `reset`, para que alcancen también al INSERT del ledger que
-- el empaquetador agrega después de este archivo. Si corta, se reintenta entera.
-- ─────────────────────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_priv text;
  v_fn record;
  v_md5 text;
  v_md5_normalized text;
begin
  -- De postgres, con RLS y SIN FORCE.
  if not exists (select 1 from pg_catalog.pg_class c
                  where c.oid = pg_catalog.to_regclass('public.accounts')
                    and c.relrowsecurity and not c.relforcerowsecurity
                    and c.relowner = 'postgres'::pg_catalog.regrole) then
    raise exception '0510 abortado: public.accounts no es de postgres con RLS activa y sin FORCE';
  end if;
  if not exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = pg_catalog.to_regclass('public.accounts')
                    and a.attname = 'tenant_id' and a.atttypid = 'uuid'::pg_catalog.regtype
                    and a.attnotnull and not a.attisdropped) then
    raise exception '0510 abortado: public.accounts no tiene tenant_id uuid not null';
  end if;

  -- Sólo la policy heredada, con la huella de producción (0078), medida el 2026-11-02.
  if (select pg_catalog.count(*) from pg_catalog.pg_policies p
       where p.schemaname = 'public' and p.tablename = 'accounts') <> 1
     or not exists (
       select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = 'accounts'
          and p.policyname = 'accounts by tenant' and p.cmd = 'ALL'
          and p.roles = array['authenticated']::name[] and p.permissive = 'PERMISSIVE'
          and pg_catalog.md5(coalesce(p.qual, '') || '|' || coalesce(p.with_check, ''))
              = 'f118dd90556c13981e880287a2b28599') then
    raise exception '0510 abortado: public.accounts no tiene sólo «accounts by tenant» (FOR ALL, sólo tenant)';
  end if;

  -- Privilegios de hoy: authenticated lee y escribe; anon, nada.
  foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not pg_catalog.has_table_privilege('authenticated', 'public.accounts', v_priv) then
      raise exception '0510 abortado: authenticated no tiene % sobre public.accounts', v_priv;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('anon', 'public.accounts',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or pg_catalog.has_any_column_privilege('anon', 'public.accounts', 'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception '0510 abortado: anon tiene privilegios sobre public.accounts';
  end if;

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
      raise exception '0510 abortado: % no tiene el cuerpo, la seguridad o el owner de producción', v_fn.signature;
    end if;
  end loop;
end;
$preflight$;

drop policy "accounts by tenant" on public.accounts;
create policy accounts_team_select
  on public.accounts for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );
create policy accounts_accounting_insert
  on public.accounts for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy accounts_accounting_update
  on public.accounts for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );
create policy accounts_accounting_delete
  on public.accounts for delete
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) in ('accounting', 'admin')
  );

do $postflight$
declare
  v_priv text;
begin
  -- Exactamente cuatro policies, una por operación.
  if exists (
    with expected(policyname, cmd) as (values
      ('accounts_team_select', 'SELECT'),
      ('accounts_accounting_insert', 'INSERT'),
      ('accounts_accounting_update', 'UPDATE'),
      ('accounts_accounting_delete', 'DELETE')
    ), actual as (
      select * from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = 'accounts'
    )
    select 1 from expected e full join actual a on a.policyname = e.policyname
    where e.policyname is null or a.policyname is null or a.cmd <> e.cmd
      or a.roles <> array['authenticated']::name[] or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0510 postflight: public.accounts no quedó con sus cuatro policies';
  end if;

  -- La lectura sigue siendo sólo el tenant, sin rol.
  if not exists (select 1 from pg_catalog.pg_policies p
                  where p.schemaname = 'public' and p.tablename = 'accounts'
                    and p.policyname = 'accounts_team_select'
                    and p.with_check is null
                    and p.qual like '%get_user_tenant_id()%'
                    and p.qual not like '%current_studio_role%') then
    raise exception '0510 postflight: la lectura de public.accounts dejó de ser la del equipo del tenant';
  end if;

  -- Alta, edición y borrado piden, además del tenant, el rol financiero activo.
  -- En la de UPDATE, la fila vieja y la nueva pasan por la misma expresión.
  if exists (select 1 from pg_catalog.pg_policies p
              cross join lateral (select case p.cmd when 'DELETE' then p.qual else p.with_check end as expr) e
              where p.schemaname = 'public' and p.tablename = 'accounts'
                and p.cmd in ('INSERT', 'UPDATE', 'DELETE')
                and (e.expr is null
                     or (p.cmd = 'INSERT') is distinct from (p.qual is null)
                     or (p.cmd = 'DELETE') is distinct from (p.with_check is null)
                     or not (e.expr like '%get_user_tenant_id()%'
                             and e.expr like '%current_studio_role()%'
                             and e.expr like '%''accounting''%'
                             and e.expr like '%''admin''%')
                     or (p.cmd = 'UPDATE' and p.qual is distinct from p.with_check))) then
    raise exception '0510 postflight: alta, edición o borrado de public.accounts no pide accounting o admin';
  end if;

  -- Los GRANT no cambian: authenticated sigue con los cuatro, service_role
  -- también y anon sin nada.
  foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not pg_catalog.has_table_privilege('authenticated', 'public.accounts', v_priv) then
      raise exception '0510 postflight: authenticated perdió % sobre public.accounts', v_priv;
    end if;
    if not pg_catalog.has_table_privilege('service_role', 'public.accounts', v_priv) then
      raise exception '0510 postflight: service_role perdió % sobre public.accounts', v_priv;
    end if;
  end loop;
  if pg_catalog.has_table_privilege('anon', 'public.accounts', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception '0510 postflight: anon tiene privilegios sobre public.accounts';
  end if;

  if exists (select 1 from pg_catalog.pg_class c
              where c.oid = pg_catalog.to_regclass('public.accounts') and c.relforcerowsecurity) then
    raise exception '0510 postflight: public.accounts quedó con FORCE ROW LEVEL SECURITY';
  end if;
end;
$postflight$;
