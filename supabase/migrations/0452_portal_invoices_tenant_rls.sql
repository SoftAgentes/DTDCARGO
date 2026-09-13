-- ─────────────────────────────────────────────────────────────
-- 0452 · SDD-0463 — Por RLS, el Portal sólo lee facturas del tenant de su vínculo.
--
-- EL HUECO (en main, y en producción hasta aplicar esta migración)
-- `invoices portal self read` (0085:19-26) compara sólo
-- `client_markbox = public.get_portal_client_markbox()`. Esa helper (0080:49-55)
-- no mira el tenant ni la baja del cliente, y el Shipping Mark es único POR
-- tenant (0006:23). Un cliente del Portal de T1 cuyo Shipping Mark también existe
-- en T2 lee, con su propio JWT y directo contra PostgREST, las facturas no
-- borrador de T2: nombre, RIF, montos, líneas y notas. SDD-0462 (PR #107) lo
-- cerró en la aplicación y lo midió abierto en la base, antes y después de su
-- arreglo.
--
-- EL ARREGLO: EL PREDICADO DE LA 0414 DE L07, IDÉNTICO
-- Reemplaza SÓLO esa policy, con el mismo nombre, `for select to authenticated`
-- y la expresión idéntica a la de `0414_invoices_read_rbac` (PR #106, rama
-- codex/c-l07-fidelizacion-conversations, líneas 62-80 de su archivo). Exige un
-- vínculo `client_users` activo del `auth.uid()`, con su cliente vivo y del mismo
-- tenant, y ese tenant igual al de la factura, además del Shipping Mark. No toca
-- las policies de equipo, la ACL, funciones, comentarios ni filas.
--
-- POR QUÉ IDÉNTICO: CONVERGE CON L07 EN LOS DOS ÓRDENES
--   · Producción, cronológico: 0452 → 0407 → 0411–0413 → 0414. El preflight de
--     0414 pide la policy por nombre, y su drop + create la deja igual.
--   · Rebuild, numérico: 0407 … 0414 → 0452. El preflight de 0452 reconoce la
--     forma final y no cambia nada.
-- Con otra expresión el estado final dependería del orden. El postflight y el
-- contrato exigen la forma exacta.
--
-- FRONTERA: LA MISMA DE 0414, ACEPTADA POR EL DIRECTOR EN L07
-- Un vínculo activo cuyo cliente está borrado, o cuyo vínculo y cliente son de
-- tenants distintos, deja de leer facturas SIN ningún error: cero filas. Un
-- vínculo coherente conserva las suyas.
--
-- UNA SOLA SENTENCIA
-- Timeouts, lock, preflight, DDL y postflight van en un único `do`: la lectura
-- del catálogo y el reemplazo comparten transacción aunque se aplique en
-- autocommit.
--   · `lock_timeout` de 5 s rige sobre el lock también en autocommit (medido).
--   · `statement_timeout` de 60 s NO acota este mismo `do`: PostgreSQL arma ese
--     reloj al empezar cada sentencia (medido en 17.11). Rige para lo que venga
--     después dentro de la transacción de aplicación. El bloque sólo toca
--     catálogo; lo que puede tardar es la espera del lock, y esa la corta
--     `lock_timeout`.
--
-- LOCKS
-- ACCESS EXCLUSIVE sobre `invoices` ANTES de leer el catálogo, así nadie cambia
-- la policy entre el preflight y el reemplazo. Al crearla, PostgreSQL toma ACCESS
-- SHARE sobre `client_users` y `clients`, que la expresión nombra. Todo hasta el
-- COMMIT. Mientras espera el lock, hasta 5 s, las lecturas nuevas de facturas
-- (Facturación, Cobranzas, Portal, tablero y reportes) hacen cola detrás.
--
-- PREFLIGHT SIN DML, QUE FALLA CERRADO
--   · la policy `invoices portal self read` existe y es permisiva, SELECT, sólo
--     de `authenticated` y sin WITH CHECK;
--   · su expresión es la de 0085 (se reemplaza) o la final (no se toca);
--   · ninguna otra policy de `invoices` usa `get_portal_client_markbox()`, porque
--     la lectura sin tenant seguiría abierta con otro nombre.
-- No mira las policies de equipo: vale con `invoices by tenant` (main) y con las
-- de L07. Las expresiones se comparan con `search_path` vacío y sin espacios, así
-- no dependen de la sesión que aplica; el `search_path` se restaura al final. Los
-- mensajes no llevan ids ni Shipping Marks.
--
-- POSTFLIGHT
-- La policy quedó con la forma final exacta y las demás policies de `invoices`
-- quedaron idénticas a como estaban.
--
-- NO aplicar a Producción desde esta rama. Requiere el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md: de a una y con el name
-- exacto `0452_portal_invoices_tenant_rls`.
-- ─────────────────────────────────────────────────────────────

do $migracion$
declare
  -- Formas normalizadas: pg_get_expr con search_path vacío y sin espacios.
  c_forma_0085 constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(client_markbox=public.get_portal_client_markbox()))';
  c_forma_final constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(EXISTS(SELECT1FROM(public.client_userscuJOINpublic.clientscON'
    || '(((c.id=cu.client_id)AND(c.tenant_id=cu.tenant_id)AND(c.deleted_atISNULL))))'
    || 'WHERE((cu.auth_user_id=(SELECTauth.uid()ASuid))AND(cu.status=''active''::text)'
    || 'AND(cu.tenant_id=invoices.tenant_id)AND(c.markbox=invoices.client_markbox)))))';
  v_search_path   text := pg_catalog.current_setting('search_path');
  v_forma         text;
  v_con_helper    bigint;
  v_otras_antes   text;
  v_otras_despues text;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '60s';

  if pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.client_users') is null
     or pg_catalog.to_regclass('public.clients') is null
     or pg_catalog.to_regprocedure('auth.uid()') is null
     or pg_catalog.to_regrole('authenticated') is null then
    raise exception '0452 requiere invoices, client_users, clients, auth.uid() y el rol authenticated';
  end if;

  lock table public.invoices in access exclusive mode;

  perform pg_catalog.set_config('search_path', '', true);

  -- ─── Preflight ─────────────────────────────────────────────────────────────
  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  if v_forma is null then
    raise exception '0452 abortada: la policy "invoices portal self read" está ausente o no es permisiva, SELECT, sólo de authenticated y sin WITH CHECK; revisar antes de aplicar';
  end if;

  if v_forma <> c_forma_0085 and v_forma <> c_forma_final then
    raise exception '0452 abortada: la expresión de "invoices portal self read" no es la de 0085 ni la final; revisar antes de aplicar';
  end if;

  select count(*)
    into v_con_helper
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname <> 'invoices portal self read'
     and (coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') like '%get_portal_client_markbox%'
          or coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') like '%get_portal_client_markbox%');

  if v_con_helper > 0 then
    raise exception '0452 abortada: % policy(s) más de invoices usan get_portal_client_markbox(); la lectura sin tenant seguiría abierta',
      v_con_helper;
  end if;

  select pg_catalog.md5(coalesce(pg_catalog.string_agg(
           p.polname::text || ':' || p.polcmd::text || ':' || p.polpermissive::text || ':' || p.polroles::text
           || ':' || coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '')
           || ':' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), ''),
           '|' order by p.polname), ''))
    into v_otras_antes
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname <> 'invoices portal self read';

  -- ─── Reemplazo ─────────────────────────────────────────────────────────────
  if v_forma = c_forma_0085 then
    drop policy "invoices portal self read" on public.invoices;
    create policy "invoices portal self read"
      on public.invoices for select to authenticated
      using (
        deleted_at is null
        and status <> 'borrador'
        and client_markbox is not null
        and exists (
          select 1
          from public.client_users as cu
          join public.clients as c
            on c.id = cu.client_id and c.tenant_id = cu.tenant_id
              and c.deleted_at is null
          where cu.auth_user_id = (select auth.uid())
            and cu.status = 'active'
            and cu.tenant_id = invoices.tenant_id
            and c.markbox = invoices.client_markbox
        )
      );
    raise notice '0452: "invoices portal self read" reemplazada por la forma con vínculo activo, cliente vivo y tenant';
  else
    raise notice '0452: "invoices portal self read" ya tenía la forma final; sin cambios';
  end if;

  -- ─── Postflight ────────────────────────────────────────────────────────────
  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  if v_forma is distinct from c_forma_final then
    raise exception '0452: "invoices portal self read" no quedó con la forma final; revisar antes de aplicar';
  end if;

  select pg_catalog.md5(coalesce(pg_catalog.string_agg(
           p.polname::text || ':' || p.polcmd::text || ':' || p.polpermissive::text || ':' || p.polroles::text
           || ':' || coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '')
           || ':' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), ''),
           '|' order by p.polname), ''))
    into v_otras_despues
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname <> 'invoices portal self read';

  if v_otras_despues is distinct from v_otras_antes then
    raise exception '0452: cambió otra policy de invoices; esta migración sólo reemplaza la del Portal';
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end;
$migracion$;
