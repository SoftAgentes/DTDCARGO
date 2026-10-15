-- ─────────────────────────────────────────────────────────────────────────────
-- 0476 · SDD-0522 — Borrado auditado de embarques y recepciones de prueba.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    nominal de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md),
--    de a una, en una transacción, con el name exacto
--    `0476_borrado_embarques_recepciones`. Producción es el Supabase
--    self-hosted del servidor propio. Antes de aplicar, el Director lee en
--    producción, READ ONLY y sin filas de negocio, el catálogo que exige el
--    preflight (.agents/handoffs/0522-borrar-embarques-recepciones.md).
--    ORDEN: MIGRATE-FIRST y desplegar la app enseguida. Con 0476 aplicada y la
--    app de antes, «Eliminar envío» de Tracking y el DELETE de la API fallan
--    con su mensaje de error (el UPDATE directo de deleted_at queda vedado a
--    authenticated): no borran nada a medias. Con la app nueva y sin 0476, la
--    UI de borrado no aparece («No se pudo comprobar qué se puede eliminar»)
--    y las acciones devuelven error sin borrar. Fusionar la PR NO autoriza
--    aplicarla.
--
-- ── El defecto (main a8d99acf) ───────────────────────────────────────────────
-- 1. `deleteShipment` (tracking/[id]/actions.ts) y el DELETE de
--    /api/studio/shipments/[id] ponen shipments.deleted_at con un UPDATE por
--    RLS: sin motivo, sin evento de auditoría (AUD-01 §2 «eliminar»), sin
--    mirar dependencias (facturas, gastos, aduana…) y con el permiso de editar
--    Tracking, no de administrador. `softDeleteReceiptAction` (cn/actions.ts)
--    hace lo mismo con warehouse_receipts_cn, sin UI.
-- 2. authenticated conserva DELETE físico sobre shipments (0002:83) y
--    warehouse_receipts_cn (0008:204), y las policies «… by tenant» sólo
--    comparan tenant (0012, 0230): cualquier miembro del tenant borra
--    físicamente por PostgREST, sin evento y con cascada sobre eventos,
--    documentos, avisos, cajas y fotos.
-- 3. No existe evento `shipment_deleted` ni `warehouse_receipt_cn_deleted`.
--    Los tipos de entidad `shipment` y `warehouse_receipt_cn` están activos
--    (0258:113 y :116).
--
-- ── Decisión de Sam (2026-10-15, preguntas del Director) ────────────────────
-- «Embarques y recepciones (Recomendado)» · «No se borra hasta anular eso
-- (Recomendado)» · sólo admin. MP-01 pide P3 para lo logístico «en proceso»;
-- Sam aprueba P2 para datos de prueba sin efectos: excepción registrada en la
-- SDD-0522.
--
-- ── Qué cambia ──────────────────────────────────────────────────────────────
-- · RPC `soft_delete_shipments_with_audit_reason(p_ids uuid[], p_reason text)`
--   y `soft_delete_warehouse_receipts_cn_with_audit_reason(...)`: SECURITY
--   DEFINER (ven todas las dependencias aunque la RLS de facturas o cuentas por
--   pagar no se las muestre a todos los roles), con el rol admin activo en
--   user_tenants del tenant de get_user_tenant_id() (la RLS no filtra por rol),
--   1 a 100 ids distintos, FOR UPDATE en orden de id, motivo de 4 a 1000
--   caracteres (el CHECK de 0267) fijado en dtd.audit_reason sólo para la
--   transacción, y TODO O NADA: si un id no existe en el tenant, ya estaba
--   eliminado o tiene una dependencia viva, no se borra ninguno. Devuelven una
--   fila por id con `outcome` ∈ deleted | blocked | not_found | held y los
--   `blockers` (jsonb tipo→conteo).
--   Embarques: también cancelan sus avisos programados ('scheduled' →
--   'canceled', error 'envío eliminado', el mismo motivo del despacho de
--   SDD-0511). Recepciones: también retiran sus cajas vivas (warehouse_boxes),
--   para que no se puedan estibar ni imprimir.
-- · Lectura `shipment_delete_blockers(uuid[])` y
--   `warehouse_receipt_cn_delete_blockers(uuid[])`: lo mismo que decidiría el
--   borrado (bloqueos y avisos), para que la UI deshabilite la fila con su
--   motivo. Sólo admin, hasta 500 ids, sólo del tenant propio.
-- · Guardas, embarques: ya eliminado; entregado; factura no anulada; gasto;
--   cuenta por pagar no anulada; costeo; Financiero China (conversiones,
--   libro de socios, compensaciones de reclamo); expediente de aduana; ruta TMS
--   no cancelada; reclamo; consolidación naviera viva; recepciones CN vivas;
--   compra (prealerta) viva unida al embarque. No bloquean, se avisan:
--   adjuntos, avisos ya enviados, avisos pendientes y estimados convertidos.
-- · Guardas, recepciones: ya eliminada; consolidada en un embarque vivo; en
--   una orden de despacho no cancelada (dispatch_order_packages es polimórfico:
--   por package_kind + package_id); unida a una compra (prealerta) viva o a una
--   orden de venta viva; con cajas recibidas en una recepción de Venezuela
--   viva; con cajas estibadas en una consolidación viva. Aviso: cajas que se
--   retiran.
-- · Triggers AFTER UPDATE (deleted_at de NULL a valor) que escriben con
--   append_audit_event `shipment_deleted` / `warehouse_receipt_cn_deleted`
--   (P2, consecuencia, recuperación por base de datos, motivo, actor, antes y
--   después, correlación por transacción, sensibilidad restricted). Si el
--   evento falla, falla el borrado.
-- · Triggers BEFORE UPDATE con el mismo WHEN: authenticated y anon ya no
--   pueden poner deleted_at directo (42501); sólo la RPC (SECURITY DEFINER) y
--   los roles de confianza. Así el «sólo admin» y las guardas no se saltan por
--   PostgREST. Restaurar (deleted_at a NULL) no se toca.
-- · revoke delete … from authenticated en las dos tablas, como 0394, 0407 y
--   0456. service_role conserva DELETE: lo usa el rollback de createReceiptAction.
--
-- ── Preflight que falla cerrado (mensajes sin ids ni códigos) ───────────────
-- roles; RLS y columnas de las dos tablas y de cada tabla que leen las
-- guardas; etiquetas de los enums que se comparan; el CHECK de avisos admite
-- 'canceled'; append_audit_event (0294) SECURITY DEFINER con search_path vacío
-- y ejecutable por quien aplica; tipos de entidad activos; get_user_tenant_id
-- SECURITY DEFINER; quien aplica (dueño de las funciones) omite RLS y puede leer
-- y escribir lo que tocan; objetos con los nombres de esta migración ausentes o
-- con su forma final; huella del catálogo dependiente, que el postflight exige
-- intacta.
--
-- LOCKS (medidos en el contrato, ver la spec): CREATE TRIGGER toma SHARE ROW
-- EXCLUSIVE sobre shipments y warehouse_receipts_cn; el REVOKE y el COMMENT
-- toman locks de catálogo sobre las mismas tablas. Bloquean escrituras, no
-- lecturas, hasta el COMMIT. lock_timeout 5 s y statement_timeout 30 s de
-- sesión; se restauran al final. Reaplicar no crea ni cambia nada.
-- Sin backfill: los borrados históricos no tienen actor ni motivo
-- reconstruibles y un evento inventado sería historia falsa (0267).
-- ─────────────────────────────────────────────────────────────────────────────
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_req record;
  v_writer oid;
  v_huella text;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0476 requiere los roles authenticated, anon y service_role';
  end if;

  if exists (
    select 1 from (values ('public.shipments'), ('public.warehouse_receipts_cn')) t(name)
    where not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass(t.name) and c.relkind in ('r', 'p') and c.relrowsecurity
    )
  ) then
    raise exception '0476 requiere shipments y warehouse_receipts_cn con RLS';
  end if;

  -- Cada columna que leen o escriben las RPC y los triggers.
  for v_req in
    select * from (values
      ('public.shipments', 'id'), ('public.shipments', 'tenant_id'), ('public.shipments', 'code'),
      ('public.shipments', 'status'), ('public.shipments', 'deleted_at'),
      ('public.warehouse_receipts_cn', 'id'), ('public.warehouse_receipts_cn', 'tenant_id'),
      ('public.warehouse_receipts_cn', 'receipt_code'), ('public.warehouse_receipts_cn', 'status'),
      ('public.warehouse_receipts_cn', 'shipment_id'), ('public.warehouse_receipts_cn', 'prealerta_id'),
      ('public.warehouse_receipts_cn', 'sales_order_id'), ('public.warehouse_receipts_cn', 'deleted_at'),
      ('public.warehouse_boxes', 'id'), ('public.warehouse_boxes', 'receipt_id'),
      ('public.warehouse_boxes', 'deleted_at'),
      ('public.user_tenants', 'user_id'), ('public.user_tenants', 'tenant_id'),
      ('public.user_tenants', 'role'), ('public.user_tenants', 'disabled_at'),
      ('public.invoices', 'shipment_id'), ('public.invoices', 'status'), ('public.invoices', 'deleted_at'),
      ('public.expenses', 'shipment_id'), ('public.expenses', 'deleted_at'),
      ('public.supplier_bills', 'shipment_id'), ('public.supplier_bills', 'status'),
      ('public.supplier_bills', 'deleted_at'),
      ('public.shipment_costs', 'shipment_id'), ('public.shipment_costs', 'deleted_at'),
      ('public.currency_conversions', 'shipment_id'), ('public.currency_conversions', 'deleted_at'),
      ('public.partner_ledger_entries', 'shipment_id'), ('public.partner_ledger_entries', 'deleted_at'),
      ('public.supplier_claim_offsets', 'shipment_id'), ('public.supplier_claim_offsets', 'deleted_at'),
      ('public.customs_filings', 'shipment_id'), ('public.customs_filings', 'deleted_at'),
      ('public.tms_routes', 'shipment_id'), ('public.tms_routes', 'status'), ('public.tms_routes', 'deleted_at'),
      ('public.client_claims', 'shipment_id'), ('public.client_claims', 'deleted_at'),
      ('public.consolidation_items', 'shipment_id'), ('public.consolidation_items', 'consolidation_id'),
      ('public.consolidations', 'id'), ('public.consolidations', 'deleted_at'),
      ('public.prealertas', 'id'), ('public.prealertas', 'shipment_id'), ('public.prealertas', 'status'),
      ('public.prealertas', 'deleted_at'),
      ('public.documents', 'entity_type'), ('public.documents', 'entity_id'), ('public.documents', 'deleted_at'),
      ('public.shipment_documents', 'shipment_id'), ('public.shipment_documents', 'deleted_at'),
      ('public.client_notification_schedule', 'shipment_id'),
      ('public.client_notification_schedule', 'status'), ('public.client_notification_schedule', 'error'),
      ('public.quotes', 'converted_to_shipment_id'), ('public.quotes', 'deleted_at'),
      ('public.dispatch_order_packages', 'od_id'), ('public.dispatch_order_packages', 'package_kind'),
      ('public.dispatch_order_packages', 'package_id'),
      ('public.dispatch_orders', 'id'), ('public.dispatch_orders', 'status'),
      ('public.sales_orders', 'id'), ('public.sales_orders', 'status'), ('public.sales_orders', 'deleted_at'),
      ('public.warehouse_receipt_ve_boxes', 'receipt_id'),
      ('public.warehouse_receipt_ve_boxes', 'source_receipt_cn_id'),
      ('public.warehouse_receipts_ve', 'id'), ('public.warehouse_receipts_ve', 'deleted_at'),
      ('public.consolidation_box_positions', 'box_id'),
      ('public.consolidation_box_positions', 'consolidation_id'),
      ('public.consolidation_box_positions', 'unstuffed_at')
    ) as r(tbl, col)
  loop
    if pg_catalog.to_regclass(v_req.tbl) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_req.tbl)
        and attname = v_req.col and attnum > 0 and not attisdropped
    ) then
      raise exception '0476 requiere la columna %.%', v_req.tbl, v_req.col;
    end if;
  end loop;

  -- Etiquetas de los enums con que comparan las guardas.
  for v_req in
    select * from (values
      ('public.shipment_status', 'delivered'), ('public.invoice_status', 'anulada'),
      ('public.tms_route_status', 'cancelado'), ('public.dispatch_order_status', 'cancelada'),
      ('public.document_entity_type', 'shipment')
    ) as e(typ, label)
  loop
    if pg_catalog.to_regtype(v_req.typ) is null or not exists (
      select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_req.typ) and enumlabel = v_req.label
    ) then
      raise exception '0476 requiere la etiqueta % del enum %', v_req.label, v_req.typ;
    end if;
  end loop;

  -- La cancelación de avisos escribe 'canceled': el CHECK de 0247 tiene que admitirlo.
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.client_notification_schedule'::pg_catalog.regclass and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%status%'
      and pg_catalog.pg_get_constraintdef(oid) like '%''canceled''%'
  ) then
    raise exception '0476 requiere que client_notification_schedule.status admita canceled';
  end if;

  -- El writer de auditoría: SECURITY DEFINER, search_path vacío y ejecutable por
  -- el rol que aplica, que queda como dueño de los triggers.
  v_writer := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  if v_writer is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0476 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not pg_catalog.has_function_privilege(current_user, v_writer, 'EXECUTE') then
    raise exception '0476 abortada: el rol que aplica no puede ejecutar append_audit_event; los triggers quedarían con un dueño que no escribe el evento';
  end if;

  if pg_catalog.to_regclass('public.audit_entity_types') is null
     or (select pg_catalog.count(*) from public.audit_entity_types
         where entity_type in ('shipment', 'warehouse_receipt_cn') and status = 'active') <> 2 then
    raise exception '0476 abortada: los tipos de entidad shipment y warehouse_receipt_cn no están activos; cada borrado fallaría';
  end if;

  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.get_user_tenant_id()') and p.prosecdef
  ) then
    raise exception '0476 requiere get_user_tenant_id() SECURITY DEFINER';
  end if;

  -- Las RPC son SECURITY DEFINER: su dueño (quien aplica) tiene que ver TODAS las
  -- dependencias. Si la RLS le escondiera una factura, la guarda la daría por
  -- inexistente y el borrado pasaría.
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception '0476 abortada: el rol que aplica no omite RLS; las guardas no verían todas las dependencias';
  end if;
  -- Un privilegio por fila: has_table_privilege con 'A,B' responde «alguno», no «todos».
  for v_req in
    select * from (values
      ('public.shipments', 'SELECT'), ('public.shipments', 'UPDATE'),
      ('public.warehouse_receipts_cn', 'SELECT'), ('public.warehouse_receipts_cn', 'UPDATE'),
      ('public.warehouse_boxes', 'SELECT'), ('public.warehouse_boxes', 'UPDATE'),
      ('public.client_notification_schedule', 'SELECT'), ('public.client_notification_schedule', 'UPDATE'),
      ('public.user_tenants', 'SELECT'), ('public.invoices', 'SELECT'), ('public.expenses', 'SELECT'),
      ('public.supplier_bills', 'SELECT'), ('public.shipment_costs', 'SELECT'),
      ('public.currency_conversions', 'SELECT'), ('public.partner_ledger_entries', 'SELECT'),
      ('public.supplier_claim_offsets', 'SELECT'), ('public.customs_filings', 'SELECT'),
      ('public.tms_routes', 'SELECT'), ('public.client_claims', 'SELECT'),
      ('public.consolidation_items', 'SELECT'), ('public.consolidations', 'SELECT'),
      ('public.prealertas', 'SELECT'), ('public.documents', 'SELECT'),
      ('public.shipment_documents', 'SELECT'), ('public.quotes', 'SELECT'),
      ('public.dispatch_order_packages', 'SELECT'), ('public.dispatch_orders', 'SELECT'),
      ('public.sales_orders', 'SELECT'), ('public.warehouse_receipt_ve_boxes', 'SELECT'),
      ('public.warehouse_receipts_ve', 'SELECT'), ('public.consolidation_box_positions', 'SELECT')
    ) as g(tbl, priv)
  loop
    if not pg_catalog.has_table_privilege(current_user, v_req.tbl, v_req.priv) then
      raise exception '0476 abortada: el rol que aplica no tiene % sobre %', v_req.priv, v_req.tbl;
    end if;
  end loop;

  -- Objetos de esta migración: ausentes o con su forma final (reaplicación).
  if exists (
    select 1 from pg_catalog.pg_proc p
    left join (values
      ('soft_delete_shipments_with_audit_reason', 'public.soft_delete_shipments_with_audit_reason(uuid[],text)', true),
      ('soft_delete_warehouse_receipts_cn_with_audit_reason', 'public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[],text)', true),
      ('shipment_delete_blockers', 'public.shipment_delete_blockers(uuid[])', true),
      ('warehouse_receipt_cn_delete_blockers', 'public.warehouse_receipt_cn_delete_blockers(uuid[])', true),
      ('shipment_delete_blockers_internal', 'public.shipment_delete_blockers_internal(uuid,uuid[])', false),
      ('warehouse_receipt_cn_delete_blockers_internal', 'public.warehouse_receipt_cn_delete_blockers_internal(uuid,uuid[])', false),
      ('soft_delete_admin_tenant_internal', 'public.soft_delete_admin_tenant_internal()', false),
      ('soft_delete_ids_internal', 'public.soft_delete_ids_internal(uuid[],integer)', false),
      ('shipments_audit_soft_delete', 'public.shipments_audit_soft_delete()', true),
      ('warehouse_receipts_cn_audit_soft_delete', 'public.warehouse_receipts_cn_audit_soft_delete()', true),
      ('soft_delete_requires_governed_rpc', 'public.soft_delete_requires_governed_rpc()', false)
    ) as f(name, signature, definer) on f.name = p.proname
    where p.pronamespace = 'public'::pg_catalog.regnamespace
      and f.name is not null
      and not coalesce(
        p.oid = pg_catalog.to_regprocedure(f.signature)
        and p.prosecdef = f.definer
        and p.proconfig = array['search_path=""']::text[],
        false)
  ) then
    raise exception '0476 abortada: ya existe una función con el nombre de esta migración y otra forma o firma; revisar antes de aplicar';
  end if;

  if exists (
    select 1 from pg_catalog.pg_trigger t
    join (values
      ('public.shipments', 'shipments_soft_delete_guard', 'BEFORE', 'soft_delete_requires_governed_rpc'),
      ('public.shipments', 'shipments_audit_soft_delete', 'AFTER', 'shipments_audit_soft_delete'),
      ('public.warehouse_receipts_cn', 'warehouse_receipts_cn_soft_delete_guard', 'BEFORE', 'soft_delete_requires_governed_rpc'),
      ('public.warehouse_receipts_cn', 'warehouse_receipts_cn_audit_soft_delete', 'AFTER', 'warehouse_receipts_cn_audit_soft_delete')
    ) as x(tbl, name, timing, fn) on t.tgrelid = pg_catalog.to_regclass(x.tbl) and t.tgname = x.name
    where not t.tgisinternal
      and not coalesce(
        t.tgenabled = 'O'
        and t.tgfoid = pg_catalog.to_regprocedure('public.' || x.fn || '()')
        and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
              'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ')
            = 'CREATE TRIGGER ' || x.name || ' ' || x.timing || ' UPDATE ON ' || x.tbl
              || ' FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION '
              || x.fn || '()',
        false)
  ) then
    raise exception '0476 abortada: ya existe un trigger con el nombre de esta migración y otra forma; revisar antes de aplicar';
  end if;

  -- Huella del catálogo dependiente, que el postflight exige intacta. La ACL
  -- excluye sólo el DELETE de authenticated sobre las dos tablas: es lo único
  -- que esta migración revoca.
  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::pg_catalog.regclass::text || ':' || t.tgname || ':' || t.tgfoid::text
           || ':' || t.tgtype::text || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                         'public.warehouse_boxes'::pg_catalog.regclass,
                         'public.client_notification_schedule'::pg_catalog.regclass,
                         'public.entity_audit_log'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname not in ('shipments_soft_delete_guard', 'shipments_audit_soft_delete',
                            'warehouse_receipts_cn_soft_delete_guard', 'warehouse_receipts_cn_audit_soft_delete')
    union all
    select 'P:' || pol.polrelid::pg_catalog.regclass::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                            'public.warehouse_boxes'::pg_catalog.regclass,
                            'public.client_notification_schedule'::pg_catalog.regclass,
                            'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::pg_catalog.regclass::text || ':' || a.grantor::text || ':' || a.grantee::text || ':'
           || a.privilege_type || ':' || a.is_grantable::text
      from pg_catalog.pg_class c,
           lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
     where c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                     'public.warehouse_boxes'::pg_catalog.regclass,
                     'public.client_notification_schedule'::pg_catalog.regclass,
                     'public.entity_audit_log'::pg_catalog.regclass)
       and not (c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass)
                and a.grantee = pg_catalog.to_regrole('authenticated') and a.privilege_type = 'DELETE')
    union all
    select 'R:' || c.oid::pg_catalog.regclass::text || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                     'public.warehouse_boxes'::pg_catalog.regclass,
                     'public.client_notification_schedule'::pg_catalog.regclass,
                     'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::pg_catalog.regprocedure::text || ':' || pg_catalog.md5(p.prosrc) || ':'
           || coalesce(p.proacl::text, '') || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('append_audit_event', 'append_audit_event_v1', 'get_user_tenant_id',
                         'cascade_soft_delete_events', 'guard_ve_delivery_completion',
                         'sync_boxes_for_receipt', 'warehouse_receipts_cn_sync_boxes')
    union all
    select 'E:' || e.entity_type || ':' || e.status
      from public.audit_entity_types e
     where e.entity_type in ('shipment', 'warehouse_receipt_cn')
  ) s(x);
  perform pg_catalog.set_config('dtd.huella_0476', coalesce(v_huella, ''), false);
end;
$preflight$;

-- ─── Internos: tenant del admin, ids del lote y bloqueos ─────────────────────
create or replace function public.soft_delete_admin_tenant_internal()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
begin
  if v_actor is null then
    raise exception 'borrado: autenticación requerida' using errcode = '42501';
  end if;
  -- El tenant de la ÚNICA membresía activa (0453), el mismo que usa la RLS.
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.role = 'admin' and ut.disabled_at is null
  ) then
    raise exception 'borrado: solo un administrador puede eliminar embarques y recepciones'
      using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;

comment on function public.soft_delete_admin_tenant_internal is
  'SDD-0522/0476: tenant del admin activo que llama (get_user_tenant_id + rol admin en user_tenants); 42501 si no. Interna de las RPC de borrado.';

create or replace function public.soft_delete_ids_internal(p_ids uuid[], p_max integer)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception 'borrado: la lista de ids es obligatoria' using errcode = '22023';
  end if;
  if pg_catalog.array_position(p_ids, null) is not null then
    raise exception 'borrado: la lista de ids no admite nulos' using errcode = '22023';
  end if;
  select pg_catalog.array_agg(distinct u.x order by u.x) into v_ids
    from pg_catalog.unnest(p_ids) as u(x);
  if pg_catalog.cardinality(v_ids) > p_max then
    raise exception 'borrado: máximo % por lote', p_max using errcode = '22023';
  end if;
  return v_ids;
end;
$$;

comment on function public.soft_delete_ids_internal is
  'SDD-0522/0476: ids distintos y ordenados del lote; 22023 si la lista es nula, vacía, tiene nulos o pasa del máximo. Interna.';

-- Una fila por embarque del tenant pedido. blockers y warnings: tipo → conteo,
-- sólo los que aplican. Lo usan la lectura y el borrado: deciden lo mismo.
create or replace function public.shipment_delete_blockers_internal(p_tenant uuid, p_ids uuid[])
returns table (shipment_id uuid, code text, blockers jsonb, warnings jsonb)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    s.code,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'already_deleted', case when s.deleted_at is not null then 1 end,
      'delivered', case when s.status = 'delivered' then 1 end,
      'invoices', nullif((select pg_catalog.count(*) from public.invoices x
        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'anulada'), 0),
      'expenses', nullif((select pg_catalog.count(*) from public.expenses x
        where x.shipment_id = s.id and x.deleted_at is null), 0),
      'supplier_bills', nullif((select pg_catalog.count(*) from public.supplier_bills x
        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'anulada'), 0),
      'shipment_costs', nullif((select pg_catalog.count(*) from public.shipment_costs x
        where x.shipment_id = s.id and x.deleted_at is null), 0),
      'china_finance', nullif(
          (select pg_catalog.count(*) from public.currency_conversions x
            where x.shipment_id = s.id and x.deleted_at is null)
        + (select pg_catalog.count(*) from public.partner_ledger_entries x
            where x.shipment_id = s.id and x.deleted_at is null)
        + (select pg_catalog.count(*) from public.supplier_claim_offsets x
            where x.shipment_id = s.id and x.deleted_at is null), 0),
      'customs_filings', nullif((select pg_catalog.count(*) from public.customs_filings x
        where x.shipment_id = s.id and x.deleted_at is null), 0),
      'tms_routes', nullif((select pg_catalog.count(*) from public.tms_routes x
        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'cancelado'), 0),
      'client_claims', nullif((select pg_catalog.count(*) from public.client_claims x
        where x.shipment_id = s.id and x.deleted_at is null), 0),
      'naviera_consolidations', nullif((select pg_catalog.count(distinct ci.consolidation_id)
        from public.consolidation_items ci
        join public.consolidations co on co.id = ci.consolidation_id
        where ci.shipment_id = s.id and co.deleted_at is null), 0),
      'cn_receipts', nullif((select pg_catalog.count(*) from public.warehouse_receipts_cn x
        where x.shipment_id = s.id and x.deleted_at is null), 0),
      'purchases', nullif((select pg_catalog.count(*) from public.prealertas x
        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'cancelada'), 0)
    )),
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'documents', nullif(
          (select pg_catalog.count(*) from public.documents x
            where x.entity_type = 'shipment' and x.entity_id = s.id and x.deleted_at is null)
        + (select pg_catalog.count(*) from public.shipment_documents x
            where x.shipment_id = s.id and x.deleted_at is null), 0),
      'sent_notifications', nullif((select pg_catalog.count(*) from public.client_notification_schedule x
        where x.shipment_id = s.id and x.status = 'sent'), 0),
      'scheduled_notifications', nullif((select pg_catalog.count(*) from public.client_notification_schedule x
        where x.shipment_id = s.id and x.status = 'scheduled'), 0),
      'converted_quotes', nullif((select pg_catalog.count(*) from public.quotes x
        where x.converted_to_shipment_id = s.id and x.deleted_at is null), 0)
    ))
  from public.shipments s
  where s.tenant_id = p_tenant
    and s.id = any(p_ids)
$$;

comment on function public.shipment_delete_blockers_internal is
  'SDD-0522/0476: bloqueos (impiden borrar) y avisos (no impiden) de cada embarque del tenant pedido. Interna: la usan shipment_delete_blockers y soft_delete_shipments_with_audit_reason.';

create or replace function public.warehouse_receipt_cn_delete_blockers_internal(p_tenant uuid, p_ids uuid[])
returns table (receipt_id uuid, code text, blockers jsonb, warnings jsonb)
language sql
stable
set search_path = ''
as $$
  select
    r.id,
    r.receipt_code,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'already_deleted', case when r.deleted_at is not null then 1 end,
      'consolidated', case when exists (
        select 1 from public.shipments x where x.id = r.shipment_id and x.deleted_at is null) then 1 end,
      'dispatch_orders', nullif((select pg_catalog.count(*)
        from public.dispatch_order_packages p
        join public.dispatch_orders o on o.id = p.od_id
        where p.package_kind = 'warehouse_receipt_cn' and p.package_id = r.id
          and o.status <> 'cancelada'), 0),
      'purchase', case when exists (
        select 1 from public.prealertas x
        where x.id = r.prealerta_id and x.deleted_at is null and x.status <> 'cancelada') then 1 end,
      'sales_order', case when exists (
        select 1 from public.sales_orders x
        where x.id = r.sales_order_id and x.deleted_at is null and x.status <> 'cancelada') then 1 end,
      've_receipts', nullif((select pg_catalog.count(distinct v.id)
        from public.warehouse_receipt_ve_boxes vb
        join public.warehouse_receipts_ve v on v.id = vb.receipt_id
        where vb.source_receipt_cn_id = r.id and v.deleted_at is null), 0),
      'stowed_boxes', nullif((select pg_catalog.count(*)
        from public.consolidation_box_positions cp
        join public.warehouse_boxes b on b.id = cp.box_id
        join public.consolidations co on co.id = cp.consolidation_id
        where b.receipt_id = r.id and cp.unstuffed_at is null and co.deleted_at is null), 0)
    )),
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'boxes', nullif((select pg_catalog.count(*) from public.warehouse_boxes x
        where x.receipt_id = r.id and x.deleted_at is null), 0)
    ))
  from public.warehouse_receipts_cn r
  where r.tenant_id = p_tenant
    and r.id = any(p_ids)
$$;

comment on function public.warehouse_receipt_cn_delete_blockers_internal is
  'SDD-0522/0476: bloqueos y avisos de cada recepción CN del tenant pedido. Interna: la usan warehouse_receipt_cn_delete_blockers y soft_delete_warehouse_receipts_cn_with_audit_reason.';

revoke all on function public.soft_delete_admin_tenant_internal() from public, anon, authenticated, service_role;
revoke all on function public.soft_delete_ids_internal(uuid[], integer) from public, anon, authenticated, service_role;
revoke all on function public.shipment_delete_blockers_internal(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.warehouse_receipt_cn_delete_blockers_internal(uuid, uuid[]) from public, anon, authenticated, service_role;

-- ─── Lectura para la UI ──────────────────────────────────────────────────────
create or replace function public.shipment_delete_blockers(p_ids uuid[])
returns table (shipment_id uuid, code text, blockers jsonb, warnings jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.soft_delete_admin_tenant_internal();
  v_ids uuid[] := public.soft_delete_ids_internal(p_ids, 500);
begin
  return query
    select b.shipment_id, b.code, b.blockers, b.warnings
      from public.shipment_delete_blockers_internal(v_tenant, v_ids) as b
     order by b.code;
end;
$$;

comment on function public.shipment_delete_blockers is
  'SDD-0522/0476: qué impide borrar cada embarque y qué conviene avisar, con la misma regla del borrado. Sólo admin, hasta 500 ids, sólo del tenant propio.';

create or replace function public.warehouse_receipt_cn_delete_blockers(p_ids uuid[])
returns table (receipt_id uuid, code text, blockers jsonb, warnings jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.soft_delete_admin_tenant_internal();
  v_ids uuid[] := public.soft_delete_ids_internal(p_ids, 500);
begin
  return query
    select b.receipt_id, b.code, b.blockers, b.warnings
      from public.warehouse_receipt_cn_delete_blockers_internal(v_tenant, v_ids) as b
     order by b.code;
end;
$$;

comment on function public.warehouse_receipt_cn_delete_blockers is
  'SDD-0522/0476: qué impide borrar cada recepción CN y cuántas cajas se retirarían, con la misma regla del borrado. Sólo admin, hasta 500 ids, sólo del tenant propio.';

-- ─── Borrado ────────────────────────────────────────────────────────────────
create or replace function public.soft_delete_shipments_with_audit_reason(p_ids uuid[], p_reason text)
returns table (shipment_id uuid, code text, outcome text, blockers jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.soft_delete_admin_tenant_internal();
  v_ids uuid[] := public.soft_delete_ids_internal(p_ids, 100);
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_rows jsonb;
  v_apply boolean;
  v_count integer;
begin
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  -- Orden estable de id: dos lotes que se cruzan no se bloquean en ciclo. FOR
  -- UPDATE además frena el FOR KEY SHARE de quien inserte una factura, un gasto
  -- o una ruta que apunte a uno de estos embarques mientras se decide.
  perform 1 from public.shipments s
   where s.tenant_id = v_tenant and s.id = any(v_ids)
   order by s.id
   for update of s;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', r.id, 'code', b.code, 'found', b.shipment_id is not null,
           'blockers', coalesce(b.blockers, '{}'::jsonb)) order by r.id)
    into v_rows
    from pg_catalog.unnest(v_ids) as r(id)
    left join public.shipment_delete_blockers_internal(v_tenant, v_ids) as b on b.shipment_id = r.id;

  -- Todo o nada.
  v_apply := not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_rows) as e(v)
    where not (e.v ->> 'found')::boolean or e.v -> 'blockers' <> '{}'::jsonb);

  if v_apply then
    perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

    update public.shipments s
       set deleted_at = pg_catalog.now()
     where s.tenant_id = v_tenant and s.id = any(v_ids) and s.deleted_at is null;
    get diagnostics v_count = row_count;
    if v_count <> pg_catalog.cardinality(v_ids) then
      raise exception 'borrado: conflicto al eliminar embarques' using errcode = '40001';
    end if;

    -- El mismo motivo con que el despacho de SDD-0511 cancela los que encuentra.
    update public.client_notification_schedule n
       set status = 'canceled', error = 'envío eliminado'
     where n.shipment_id = any(v_ids) and n.status = 'scheduled';

    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);
  end if;

  return query
    select (e.v ->> 'id')::uuid,
           e.v ->> 'code',
           case when not (e.v ->> 'found')::boolean then 'not_found'
                when e.v -> 'blockers' <> '{}'::jsonb then 'blocked'
                when v_apply then 'deleted'
                else 'held' end,
           e.v -> 'blockers'
      from pg_catalog.jsonb_array_elements(v_rows) as e(v)
     order by e.v ->> 'code' nulls last, e.v ->> 'id';
end;
$$;

comment on function public.soft_delete_shipments_with_audit_reason is
  'SDD-0522/0476: borrado lógico de 1 a 100 embarques del tenant, sólo admin, con motivo (4 a 1000) para el evento shipment_deleted, todo o nada. Cancela los avisos programados. Una fila por id: deleted | blocked | not_found | held, con sus bloqueos.';

create or replace function public.soft_delete_warehouse_receipts_cn_with_audit_reason(p_ids uuid[], p_reason text)
returns table (receipt_id uuid, code text, outcome text, blockers jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.soft_delete_admin_tenant_internal();
  v_ids uuid[] := public.soft_delete_ids_internal(p_ids, 100);
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_rows jsonb;
  v_apply boolean;
  v_count integer;
begin
  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  perform 1 from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.id = any(v_ids)
   order by r.id
   for update of r;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', q.id, 'code', b.code, 'found', b.receipt_id is not null,
           'blockers', coalesce(b.blockers, '{}'::jsonb)) order by q.id)
    into v_rows
    from pg_catalog.unnest(v_ids) as q(id)
    left join public.warehouse_receipt_cn_delete_blockers_internal(v_tenant, v_ids) as b on b.receipt_id = q.id;

  v_apply := not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_rows) as e(v)
    where not (e.v ->> 'found')::boolean or e.v -> 'blockers' <> '{}'::jsonb);

  if v_apply then
    perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

    update public.warehouse_receipts_cn r
       set deleted_at = pg_catalog.now()
     where r.tenant_id = v_tenant and r.id = any(v_ids) and r.deleted_at is null;
    get diagnostics v_count = row_count;
    if v_count <> pg_catalog.cardinality(v_ids) then
      raise exception 'borrado: conflicto al eliminar recepciones' using errcode = '40001';
    end if;

    -- Sus cajas: ninguna está estibada (guarda), así que salen todas las vivas.
    update public.warehouse_boxes b
       set deleted_at = pg_catalog.now()
     where b.receipt_id = any(v_ids) and b.deleted_at is null;

    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);
  end if;

  return query
    select (e.v ->> 'id')::uuid,
           e.v ->> 'code',
           case when not (e.v ->> 'found')::boolean then 'not_found'
                when e.v -> 'blockers' <> '{}'::jsonb then 'blocked'
                when v_apply then 'deleted'
                else 'held' end,
           e.v -> 'blockers'
      from pg_catalog.jsonb_array_elements(v_rows) as e(v)
     order by e.v ->> 'code' nulls last, e.v ->> 'id';
end;
$$;

comment on function public.soft_delete_warehouse_receipts_cn_with_audit_reason is
  'SDD-0522/0476: borrado lógico de 1 a 100 recepciones CN del tenant, sólo admin, con motivo (4 a 1000) para el evento warehouse_receipt_cn_deleted, todo o nada. Retira sus cajas vivas. Una fila por id: deleted | blocked | not_found | held, con sus bloqueos.';

revoke all on function public.shipment_delete_blockers(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.warehouse_receipt_cn_delete_blockers(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.soft_delete_shipments_with_audit_reason(uuid[], text) from public, anon, authenticated, service_role;
revoke all on function public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[], text) from public, anon, authenticated, service_role;
grant execute on function public.shipment_delete_blockers(uuid[]) to authenticated;
grant execute on function public.warehouse_receipt_cn_delete_blockers(uuid[]) to authenticated;
grant execute on function public.soft_delete_shipments_with_audit_reason(uuid[], text) to authenticated;
grant execute on function public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[], text) to authenticated;

-- ─── Auditoría en el mismo acto del borrado lógico ───────────────────────────
create or replace function public.shipments_audit_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- append_audit_event (0294) prioriza dtd.audit_reason, el motivo que fija la
  -- RPC; sin él (un rol de confianza que no pasó por la RPC) queda el de abajo.
  perform public.append_audit_event(
    new.tenant_id,
    'shipment',
    new.id,
    case when v_actor is null then 'system' else 'user' end,
    v_actor,
    'shipment_deleted',
    'rpc',
    'succeeded',
    'Embarque eliminado sin motivo indicado (SDD-0522).',
    pg_catalog.jsonb_build_object('deleted_at', old.deleted_at, 'status', old.status),
    pg_catalog.jsonb_build_object('deleted_at', new.deleted_at, 'status', new.status),
    pg_catalog.jsonb_build_object(
      'permanence', 'P2',
      'consequence', 'removed_from_studio_portal_calendar_pending_notices_canceled',
      'recovery', 'database_only',
      'shipment_code', new.code,
      'related_files', '[]'::jsonb),
    pg_catalog.concat('sdd-0522:shipments:', pg_catalog.txid_current()::text),
    1,
    'restricted'
  );
  return null;
end;
$$;

comment on function public.shipments_audit_soft_delete is
  'SDD-0522/0476: al pasar shipments.deleted_at de NULL a un valor escribe en la misma transacción shipment_deleted con tenant, actor, antes/después, motivo y correlación del lote. Si el evento falla, falla el borrado.';

create or replace function public.warehouse_receipts_cn_audit_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  perform public.append_audit_event(
    new.tenant_id,
    'warehouse_receipt_cn',
    new.id,
    case when v_actor is null then 'system' else 'user' end,
    v_actor,
    'warehouse_receipt_cn_deleted',
    'rpc',
    'succeeded',
    'Recepción eliminada sin motivo indicado (SDD-0522).',
    pg_catalog.jsonb_build_object('deleted_at', old.deleted_at, 'status', old.status),
    pg_catalog.jsonb_build_object('deleted_at', new.deleted_at, 'status', new.status),
    pg_catalog.jsonb_build_object(
      'permanence', 'P2',
      'consequence', 'removed_from_cn_lists_boxes_retired',
      'recovery', 'database_only',
      'receipt_code', new.receipt_code,
      'related_files', '[]'::jsonb),
    pg_catalog.concat('sdd-0522:warehouse_receipts_cn:', pg_catalog.txid_current()::text),
    1,
    'restricted'
  );
  return null;
end;
$$;

comment on function public.warehouse_receipts_cn_audit_soft_delete is
  'SDD-0522/0476: al pasar warehouse_receipts_cn.deleted_at de NULL a un valor escribe en la misma transacción warehouse_receipt_cn_deleted con tenant, actor, antes/después, motivo y correlación del lote. Si el evento falla, falla el borrado.';

-- SECURITY INVOKER a propósito: current_user es el rol de quien ejecuta el
-- UPDATE. Desde PostgREST es authenticated (o anon); dentro de la RPC SECURITY
-- DEFINER es su dueño.
create or replace function public.soft_delete_requires_governed_rpc()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'borrado: eliminar desde la API exige la RPC con motivo (SDD-0522)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.soft_delete_requires_governed_rpc is
  'SDD-0522/0476: authenticated y anon no ponen deleted_at directo en shipments ni warehouse_receipts_cn; sólo las RPC de borrado (SECURITY DEFINER) y los roles de confianza.';

revoke all on function public.shipments_audit_soft_delete() from public, anon, authenticated, service_role;
revoke all on function public.warehouse_receipts_cn_audit_soft_delete() from public, anon, authenticated, service_role;
revoke all on function public.soft_delete_requires_governed_rpc() from public, anon, authenticated, service_role;

do $triggers$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.shipments'::pg_catalog.regclass
      and tgname = 'shipments_soft_delete_guard' and not tgisinternal
  ) then
    create trigger shipments_soft_delete_guard
      before update on public.shipments
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.soft_delete_requires_governed_rpc();
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.shipments'::pg_catalog.regclass
      and tgname = 'shipments_audit_soft_delete' and not tgisinternal
  ) then
    create trigger shipments_audit_soft_delete
      after update on public.shipments
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.shipments_audit_soft_delete();
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
      and tgname = 'warehouse_receipts_cn_soft_delete_guard' and not tgisinternal
  ) then
    create trigger warehouse_receipts_cn_soft_delete_guard
      before update on public.warehouse_receipts_cn
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.soft_delete_requires_governed_rpc();
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
      and tgname = 'warehouse_receipts_cn_audit_soft_delete' and not tgisinternal
  ) then
    create trigger warehouse_receipts_cn_audit_soft_delete
      after update on public.warehouse_receipts_cn
      for each row
      when (old.deleted_at is null and new.deleted_at is not null)
      execute function public.warehouse_receipts_cn_audit_soft_delete();
  end if;
end;
$triggers$;

-- Sin borrado físico desde la API. service_role (retención, rollback técnico de
-- createReceiptAction) y postgres conservan el suyo.
revoke delete on public.shipments from authenticated;
revoke delete on public.warehouse_receipts_cn from authenticated;

comment on table public.shipments is
  'Envíos del tenant. RLS por tenant_id. Borrado SUAVE y gobernado (SDD-0522, 0476): authenticated no tiene DELETE ni puede poner deleted_at directo; se elimina con soft_delete_shipments_with_audit_reason (sólo admin, motivo, guardas de dependencias, todo o nada y evento shipment_deleted).';
comment on table public.warehouse_receipts_cn is
  'Recepciones del Almacén CN. RLS por tenant_id. Borrado SUAVE y gobernado (SDD-0522, 0476): authenticated no tiene DELETE ni puede poner deleted_at directo; se elimina con soft_delete_warehouse_receipts_cn_with_audit_reason (sólo admin, motivo, guardas, todo o nada y evento warehouse_receipt_cn_deleted).';

do $postflight$
declare
  v_fn record;
  v_huella text;
begin
  -- Forma final de cada función: SECURITY, volatilidad, search_path vacío,
  -- retorno y una sola firma por nombre.
  for v_fn in
    select * from (values
      ('public.soft_delete_admin_tenant_internal()', false, 's', 'uuid', false),
      ('public.soft_delete_ids_internal(uuid[],integer)', false, 'i', 'uuid[]', false),
      ('public.shipment_delete_blockers_internal(uuid,uuid[])', false, 's', 'record', true),
      ('public.warehouse_receipt_cn_delete_blockers_internal(uuid,uuid[])', false, 's', 'record', true),
      ('public.shipment_delete_blockers(uuid[])', true, 's', 'record', true),
      ('public.warehouse_receipt_cn_delete_blockers(uuid[])', true, 's', 'record', true),
      ('public.soft_delete_shipments_with_audit_reason(uuid[],text)', true, 'v', 'record', true),
      ('public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[],text)', true, 'v', 'record', true),
      ('public.shipments_audit_soft_delete()', true, 'v', 'trigger', false),
      ('public.warehouse_receipts_cn_audit_soft_delete()', true, 'v', 'trigger', false),
      ('public.soft_delete_requires_governed_rpc()', false, 'v', 'trigger', false)
    ) as f(signature, definer, volatility, rettype, retset)
  loop
    if pg_catalog.to_regprocedure(v_fn.signature) is null or not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
        and p.prosecdef = v_fn.definer
        and p.provolatile::text = v_fn.volatility
        and p.prorettype = v_fn.rettype::pg_catalog.regtype
        and p.proretset = v_fn.retset
        and p.proconfig = array['search_path=""']::text[]
    ) or (
      select pg_catalog.count(*) from pg_catalog.pg_proc p
      where p.pronamespace = 'public'::pg_catalog.regnamespace
        and p.proname = (select p0.proname from pg_catalog.pg_proc p0
                          where p0.oid = pg_catalog.to_regprocedure(v_fn.signature))
    ) <> 1 then
      raise exception '0476: % no quedó con la forma final', v_fn.signature;
    end if;
  end loop;

  -- ACL: las cuatro RPC sólo las ejecuta authenticated; los internos y los
  -- triggers, nadie más que su dueño.
  for v_fn in
    select * from (values
      ('public.shipment_delete_blockers(uuid[])', true),
      ('public.warehouse_receipt_cn_delete_blockers(uuid[])', true),
      ('public.soft_delete_shipments_with_audit_reason(uuid[],text)', true),
      ('public.soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[],text)', true),
      ('public.soft_delete_admin_tenant_internal()', false),
      ('public.soft_delete_ids_internal(uuid[],integer)', false),
      ('public.shipment_delete_blockers_internal(uuid,uuid[])', false),
      ('public.warehouse_receipt_cn_delete_blockers_internal(uuid,uuid[])', false),
      ('public.shipments_audit_soft_delete()', false),
      ('public.warehouse_receipts_cn_audit_soft_delete()', false),
      ('public.soft_delete_requires_governed_rpc()', false)
    ) as a(signature, api)
  loop
    if exists (
      select 1 from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) x
      where p.oid = pg_catalog.to_regprocedure(v_fn.signature)
        and x.grantee <> p.proowner
        and (not v_fn.api or x.grantee <> pg_catalog.to_regrole('authenticated') or x.is_grantable)
    ) or (v_fn.api and not pg_catalog.has_function_privilege('authenticated', v_fn.signature, 'EXECUTE')) then
      raise exception '0476: ACL inválida en %', v_fn.signature;
    end if;
  end loop;

  -- Los dueños de los triggers de auditoría escriben el evento.
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid in (pg_catalog.to_regprocedure('public.shipments_audit_soft_delete()'),
                    pg_catalog.to_regprocedure('public.warehouse_receipts_cn_audit_soft_delete()'))
      and not pg_catalog.has_function_privilege(p.proowner,
            'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::pg_catalog.regprocedure,
            'EXECUTE')
  ) then
    raise exception '0476: el dueño de un trigger de auditoría no puede ejecutar append_audit_event';
  end if;

  -- Los cuatro triggers, habilitados y con su definición exacta.
  if (
    select pg_catalog.count(*) from pg_catalog.pg_trigger t
    join (values
      ('public.shipments', 'shipments_soft_delete_guard', 'BEFORE', 'soft_delete_requires_governed_rpc'),
      ('public.shipments', 'shipments_audit_soft_delete', 'AFTER', 'shipments_audit_soft_delete'),
      ('public.warehouse_receipts_cn', 'warehouse_receipts_cn_soft_delete_guard', 'BEFORE', 'soft_delete_requires_governed_rpc'),
      ('public.warehouse_receipts_cn', 'warehouse_receipts_cn_audit_soft_delete', 'AFTER', 'warehouse_receipts_cn_audit_soft_delete')
    ) as x(tbl, name, timing, fn) on t.tgrelid = pg_catalog.to_regclass(x.tbl) and t.tgname = x.name
    where not t.tgisinternal
      and t.tgenabled = 'O'
      and t.tgfoid = pg_catalog.to_regprocedure('public.' || x.fn || '()')
      and pg_catalog.replace(pg_catalog.regexp_replace(pg_catalog.pg_get_triggerdef(t.oid), '\s+', ' ', 'g'),
            'EXECUTE FUNCTION public.', 'EXECUTE FUNCTION ')
          = 'CREATE TRIGGER ' || x.name || ' ' || x.timing || ' UPDATE ON ' || x.tbl
            || ' FOR EACH ROW WHEN (((old.deleted_at IS NULL) AND (new.deleted_at IS NOT NULL))) EXECUTE FUNCTION '
            || x.fn || '()'
  ) <> 4 then
    raise exception '0476: los triggers de borrado no quedaron vivos con su forma';
  end if;

  -- Sin borrado físico desde la API; el resto del DML del equipo, intacto.
  if pg_catalog.has_table_privilege('authenticated', 'public.shipments', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.warehouse_receipts_cn', 'DELETE')
     or pg_catalog.has_table_privilege('anon', 'public.shipments', 'DELETE')
     or pg_catalog.has_table_privilege('anon', 'public.warehouse_receipts_cn', 'DELETE') then
    raise exception '0476: authenticated o anon conservan DELETE sobre shipments o warehouse_receipts_cn';
  end if;
  if exists (
    select 1
      from (values ('public.shipments'), ('public.warehouse_receipts_cn')) t(tbl),
           (values ('SELECT'), ('INSERT'), ('UPDATE')) p(priv)
     where not pg_catalog.has_table_privilege('authenticated', t.tbl, p.priv)
  ) then
    raise exception '0476: authenticated perdió SELECT, INSERT o UPDATE sobre shipments o warehouse_receipts_cn';
  end if;

  select pg_catalog.md5(pg_catalog.string_agg(x, '|' order by x)) into v_huella
  from (
    select 'T:' || t.tgrelid::pg_catalog.regclass::text || ':' || t.tgname || ':' || t.tgfoid::text
           || ':' || t.tgtype::text || ':' || t.tgenabled::text
      from pg_catalog.pg_trigger t
     where t.tgrelid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                         'public.warehouse_boxes'::pg_catalog.regclass,
                         'public.client_notification_schedule'::pg_catalog.regclass,
                         'public.entity_audit_log'::pg_catalog.regclass)
       and not t.tgisinternal
       and t.tgname not in ('shipments_soft_delete_guard', 'shipments_audit_soft_delete',
                            'warehouse_receipts_cn_soft_delete_guard', 'warehouse_receipts_cn_audit_soft_delete')
    union all
    select 'P:' || pol.polrelid::pg_catalog.regclass::text || ':' || pol.polname || ':' || pol.polcmd::text || ':'
           || pol.polpermissive::text || ':' || pol.polroles::text || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), '') || ':'
           || coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
      from pg_catalog.pg_policy pol
     where pol.polrelid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                            'public.warehouse_boxes'::pg_catalog.regclass,
                            'public.client_notification_schedule'::pg_catalog.regclass,
                            'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'A:' || c.oid::pg_catalog.regclass::text || ':' || a.grantor::text || ':' || a.grantee::text || ':'
           || a.privilege_type || ':' || a.is_grantable::text
      from pg_catalog.pg_class c,
           lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
     where c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                     'public.warehouse_boxes'::pg_catalog.regclass,
                     'public.client_notification_schedule'::pg_catalog.regclass,
                     'public.entity_audit_log'::pg_catalog.regclass)
       and not (c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass)
                and a.grantee = pg_catalog.to_regrole('authenticated') and a.privilege_type = 'DELETE')
    union all
    select 'R:' || c.oid::pg_catalog.regclass::text || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text
      from pg_catalog.pg_class c
     where c.oid in ('public.shipments'::pg_catalog.regclass, 'public.warehouse_receipts_cn'::pg_catalog.regclass,
                     'public.warehouse_boxes'::pg_catalog.regclass,
                     'public.client_notification_schedule'::pg_catalog.regclass,
                     'public.entity_audit_log'::pg_catalog.regclass)
    union all
    select 'F:' || p.oid::pg_catalog.regprocedure::text || ':' || pg_catalog.md5(p.prosrc) || ':'
           || coalesce(p.proacl::text, '') || ':' || coalesce(p.proconfig::text, '') || ':' || p.prosecdef::text
      from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::pg_catalog.regnamespace
       and p.proname in ('append_audit_event', 'append_audit_event_v1', 'get_user_tenant_id',
                         'cascade_soft_delete_events', 'guard_ve_delivery_completion',
                         'sync_boxes_for_receipt', 'warehouse_receipts_cn_sync_boxes')
    union all
    select 'E:' || e.entity_type || ':' || e.status
      from public.audit_entity_types e
     where e.entity_type in ('shipment', 'warehouse_receipt_cn')
  ) s(x);
  if coalesce(v_huella, '') is distinct from pg_catalog.current_setting('dtd.huella_0476', true) then
    raise exception '0476: cambió el catálogo dependiente (triggers, policies, ACL o RLS de shipments, warehouse_receipts_cn, warehouse_boxes, client_notification_schedule o entity_audit_log, el writer de auditoría, las funciones vecinas o los tipos de entidad); esta migración sólo agrega sus funciones y triggers y revoca un DELETE';
  end if;

  perform pg_catalog.set_config('dtd.huella_0476', '', false);
end;
$postflight$;

reset statement_timeout;
reset lock_timeout;
