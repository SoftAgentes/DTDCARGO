-- ─────────────────────────────────────────────────────────────────────────────
-- 0551 · SDD-0645 — Pasar un embarque a otro cliente desde el Studio.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, de a una,
--    con el name exacto `0551_pasar_embarque_a_otro_cliente`. Fusionar la PR NO
--    autoriza aplicarla.
--    ORDEN: MIGRATE-FIRST. Con la migración aplicada y la app de antes no cambia
--    nada visible (nadie llama a la función). Con la app nueva y sin la
--    migración, el modal «Pasar a otro cliente» dice que la acción todavía no
--    está disponible y no cambia nada.
--
-- ── El defecto (main b9b29db96) ─────────────────────────────────────────────
-- El Studio no permite cambiar el cliente de un embarque. `updateShipment`
-- ignora a propósito client_markbox y client_name; no hay forma de cambiar el
-- cliente de una recepción CN; `updateInvoice` cambia sólo el texto de un
-- borrador y lo deja desalineado del embarque. `merge_clients` (0361) no mueve
-- embarques y `rename_client_markbox` (0371) mueve TODO el código y falla si el
-- destino existe. Caso real: dos líneas sin código del consolidado 64 quedaron
-- en una ficha provisional que operaciones tiene que pasar a su dueño real.
--
-- ── Qué crea ────────────────────────────────────────────────────────────────
-- · `reassign_shipment_client(p_shipment_id, p_client_id, p_reason, p_dry_run)`
--   SECURITY DEFINER, search_path vacío, EXECUTE sólo authenticated:
--   - exige `operations`, `commercial` o `admin` activo (D2 de Sam, 2026-11-16) en el tenant de get_user_tenant_id()
--     (42501); motivo de 4 a 1000 caracteres salvo en la vista previa (22023);
--   - embarque vivo del tenant (P0002), cliente destino vivo, no fusionado, con
--     Shipping Mark y distinto del actual (P0002 / 22023);
--   - bloquea (outcome 'blocked', sin escribir) con: factura viva ya no en
--     borrador, borrador que factura otros embarques (lines[].shipmentCode),
--     reclamo vivo, prealerta viva unida, recepción en orden de despacho viva;
--   - si no, en la misma transacción y todo o nada: el embarque, sus recepciones
--     CN vivas (is_orphan = false; las cajas las sincroniza el trigger de 0240),
--     sus borradores (sin el titular fiscal del viejo: lo sella 0466 al emitir),
--     sus líneas de consolidación, sus documentos del Portal y sus avisos
--     'scheduled'. Escribe `shipment_client_reassigned` con append_audit_event
--     (motivo por dtd.audit_reason, antes/después sólo con el Shipping Mark).
--   - con p_dry_run devuelve lo mismo que haría, sin bloquear filas ni escribir.
--   - avisa (no bloquea) cuántas recepciones tienen tarifa congelada (0496) de otro
--     cliente: contabilidad la reemplaza antes de facturar; no se toca acá. El conteo
--     va también en el evento. Y cuenta, por tipo y sin contenido, los documentos y
--     eventos que verá el cliente nuevo en el Portal.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- Tablas, RLS, triggers ni grants de tablas, ni las tarifas congeladas (0496). Facturas anuladas o eliminadas,
-- avisos ya enviados, cotizaciones, aceptaciones legales, recibos y pagos.
-- El código del embarque y de sus cajas se conserva (spec §4.4).
--
-- LOCKS: sólo CREATE FUNCTION, REVOKE, GRANT y COMMENT; ningún lock de tabla.
-- Sin backfill. Reaplicar reemplaza la función por el mismo texto.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_req record;
  v_writer oid;
begin
  if pg_catalog.to_regrole('authenticated') is null
     or pg_catalog.to_regrole('anon') is null
     or pg_catalog.to_regrole('service_role') is null then
    raise exception '0551 requiere los roles authenticated, anon y service_role';
  end if;

  -- Cada columna que la función lee o escribe.
  for v_req in
    select * from (values
      ('public.shipments', 'id'), ('public.shipments', 'tenant_id'), ('public.shipments', 'code'),
      ('public.shipments', 'client_markbox'), ('public.shipments', 'client_name'),
      ('public.shipments', 'deleted_at'),
      ('public.clients', 'id'), ('public.clients', 'tenant_id'), ('public.clients', 'markbox'),
      ('public.clients', 'name'), ('public.clients', 'deleted_at'), ('public.clients', 'merged_into_client_id'),
      ('public.user_tenants', 'user_id'), ('public.user_tenants', 'tenant_id'),
      ('public.user_tenants', 'role'), ('public.user_tenants', 'disabled_at'),
      ('public.warehouse_receipts_cn', 'id'), ('public.warehouse_receipts_cn', 'tenant_id'),
      ('public.warehouse_receipts_cn', 'shipment_id'), ('public.warehouse_receipts_cn', 'client_markbox'),
      ('public.warehouse_receipts_cn', 'client_name'), ('public.warehouse_receipts_cn', 'is_orphan'),
      ('public.warehouse_receipts_cn', 'deleted_at'),
      ('public.warehouse_boxes', 'receipt_id'), ('public.warehouse_boxes', 'deleted_at'),
      ('public.invoices', 'id'), ('public.invoices', 'tenant_id'), ('public.invoices', 'shipment_id'),
      ('public.invoices', 'status'), ('public.invoices', 'lines'), ('public.invoices', 'deleted_at'),
      ('public.invoices', 'client_markbox'), ('public.invoices', 'client_name'),
      ('public.invoices', 'client_rif'), ('public.invoices', 'client_doc_kind'),
      ('public.invoices', 'client_fiscal_address'), ('public.invoices', 'bill_to_kind'),
      ('public.consolidation_items', 'tenant_id'), ('public.consolidation_items', 'shipment_id'),
      ('public.consolidation_items', 'client_markbox'), ('public.consolidation_items', 'client_name'),
      ('public.shipment_documents', 'tenant_id'), ('public.shipment_documents', 'shipment_id'),
      ('public.shipment_documents', 'client_markbox'),
      ('public.client_notification_schedule', 'shipment_id'),
      ('public.client_notification_schedule', 'status'),
      ('public.client_notification_schedule', 'client_markbox'),
      ('public.client_claims', 'tenant_id'), ('public.client_claims', 'shipment_id'),
      ('public.client_claims', 'deleted_at'),
      ('public.prealertas', 'tenant_id'), ('public.prealertas', 'shipment_id'),
      ('public.prealertas', 'status'), ('public.prealertas', 'deleted_at'),
      ('public.dispatch_orders', 'id'), ('public.dispatch_orders', 'tenant_id'),
      ('public.dispatch_orders', 'status'),
      ('public.dispatch_order_packages', 'od_id'), ('public.dispatch_order_packages', 'package_kind'),
      ('public.dispatch_order_packages', 'package_id'),
      ('public.shipment_rate_snapshots', 'receipt_id'), ('public.shipment_rate_snapshots', 'client_id'),
      ('public.shipment_rate_snapshots', 'superseded_at'),
      ('public.shipment_documents', 'doc_type'), ('public.shipment_documents', 'deleted_at'),
      ('public.shipment_events', 'shipment_id'), ('public.shipment_events', 'note'),
      ('public.shipment_events', 'deleted_at')
    ) as r(tbl, col)
  loop
    if pg_catalog.to_regclass(v_req.tbl) is null or not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(v_req.tbl)
        and attname = v_req.col and attnum > 0 and not attisdropped
    ) then
      raise exception '0551 requiere la columna %.%', v_req.tbl, v_req.col;
    end if;
  end loop;

  -- La RLS del Portal compara estas columnas: si una tabla perdió la RLS, algo
  -- cambió y esta migración no lo sabe.
  if exists (
    select 1 from (values ('public.shipments'), ('public.shipment_documents'),
      ('public.warehouse_receipts_cn'), ('public.invoices')) t(name)
    where not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = pg_catalog.to_regclass(t.name) and c.relkind in ('r', 'p') and c.relrowsecurity
    )
  ) then
    raise exception '0551 requiere RLS en shipments, shipment_documents, warehouse_receipts_cn e invoices';
  end if;

  -- Etiquetas con que compara la función.
  for v_req in
    select * from (values
      ('public.invoice_status', 'borrador'), ('public.invoice_status', 'anulada'),
      ('public.dispatch_order_status', 'cancelada')
    ) as e(typ, label)
  loop
    if pg_catalog.to_regtype(v_req.typ) is null or not exists (
      select 1 from pg_catalog.pg_enum
      where enumtypid = pg_catalog.to_regtype(v_req.typ) and enumlabel = v_req.label
    ) then
      raise exception '0551 requiere la etiqueta % del enum %', v_req.label, v_req.typ;
    end if;
  end loop;

  -- Las cajas siguen a su recepción por el trigger de 0240: sin él quedarían
  -- con el Shipping Mark viejo.
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.warehouse_receipts_cn'::pg_catalog.regclass
      and tgname = 'warehouse_receipts_cn_sync_identity' and not tgisinternal and tgenabled <> 'D'
  ) then
    raise exception '0551 requiere el trigger warehouse_receipts_cn_sync_identity (0240) activo';
  end if;

  v_writer := pg_catalog.to_regprocedure(
    'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)');
  if v_writer is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_writer and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0551 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)';
  end if;
  if not pg_catalog.has_function_privilege(current_user, v_writer, 'EXECUTE') then
    raise exception '0551 abortada: el rol que aplica no puede ejecutar append_audit_event';
  end if;

  if pg_catalog.to_regclass('public.audit_entity_types') is null
     or not exists (select 1 from public.audit_entity_types
                    where entity_type = 'shipment' and status = 'active') then
    raise exception '0551 abortada: el tipo de entidad shipment no está activo; cada cambio fallaría';
  end if;

  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.get_user_tenant_id()') and p.prosecdef
  ) then
    raise exception '0551 requiere get_user_tenant_id() SECURITY DEFINER';
  end if;

  -- La función es SECURITY DEFINER: su dueño (quien aplica) tiene que ver todas
  -- las facturas, reclamos y órdenes; si la RLS le escondiera una, el bloqueo no
  -- la vería y el cambio pasaría.
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception '0551 abortada: el rol que aplica no omite RLS; los bloqueos no verían todo';
  end if;

  -- Un objeto ajeno con el mismo nombre y otra firma quedaría al lado.
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reassign_shipment_client'
      and pg_catalog.pg_get_function_identity_arguments(p.oid)
          <> 'p_shipment_id uuid, p_client_id uuid, p_reason text, p_dry_run boolean'
  ) then
    raise exception '0551 abortada: ya existe reassign_shipment_client con otra firma';
  end if;
end;
$preflight$;

create or replace function public.reassign_shipment_client(
  p_shipment_id uuid,
  p_client_id uuid,
  p_reason text default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_dry boolean := coalesce(p_dry_run, false);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  v_ship record;
  v_client record;
  v_old text;
  v_new text;
  v_receipts uuid[];
  v_invoices uuid[];
  v_blockers jsonb := '{}'::jsonb;
  v_warnings jsonb := '{}'::jsonb;
  v_portal jsonb;
  v_moved jsonb;
  v_n integer;
  v_m integer;
begin
  if v_actor is null then
    raise exception 'pasar embarque: autenticación requerida' using errcode = '42501';
  end if;
  -- El tenant de la ÚNICA membresía activa (0453), el mismo que usa la RLS.
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = v_actor and ut.tenant_id = v_tenant
      and ut.role in ('admin', 'operations', 'commercial') and ut.disabled_at is null
  ) then
    raise exception 'pasar embarque: solo operaciones, comercial o un administrador puede pasar un embarque a otro cliente'
      using errcode = '42501';
  end if;

  if p_shipment_id is null or p_client_id is null then
    raise exception 'pasar embarque: faltan el embarque o el cliente' using errcode = '22023';
  end if;
  if not v_dry and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000) then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  -- Aplicar bloquea el embarque: dos cambios del mismo embarque se ordenan, y
  -- quien inserte una factura o una recepción que apunte a él espera (KEY SHARE).
  -- La vista previa no bloquea nada.
  if v_dry then
    select s.id, s.code, s.client_markbox, s.deleted_at into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant;
  else
    select s.id, s.code, s.client_markbox, s.deleted_at into v_ship
      from public.shipments s where s.id = p_shipment_id and s.tenant_id = v_tenant
      for update of s;
  end if;
  if v_ship.id is null or v_ship.deleted_at is not null then
    raise exception 'pasar embarque: embarque no encontrado' using errcode = 'P0002';
  end if;

  select c.id, c.markbox, c.name, c.deleted_at, c.merged_into_client_id into v_client
    from public.clients c where c.id = p_client_id and c.tenant_id = v_tenant;
  if v_client.id is null or v_client.deleted_at is not null then
    raise exception 'pasar embarque: cliente no encontrado' using errcode = 'P0002';
  end if;
  if v_client.merged_into_client_id is not null then
    raise exception 'pasar embarque: esa ficha fue fusionada; elige la que sobrevivió' using errcode = '22023';
  end if;
  v_new := nullif(pg_catalog.btrim(coalesce(v_client.markbox, '')), '');
  if v_new is null then
    raise exception 'pasar embarque: el cliente no tiene Shipping Mark' using errcode = '22023';
  end if;
  v_new := v_client.markbox;
  v_old := v_ship.client_markbox;
  if v_old is not distinct from v_new then
    raise exception 'pasar embarque: el embarque ya es de ese cliente' using errcode = '22023';
  end if;

  if not v_dry then
    -- Orden estable de id. Las facturas y recepciones quedan quietas mientras se
    -- decide: nadie emite un borrador ni consolida otra recepción a la vez.
    perform 1 from public.warehouse_receipts_cn r
     where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null
     order by r.id for update of r;
    perform 1 from public.invoices i
     where i.tenant_id = v_tenant and i.deleted_at is null
       and (i.shipment_id = v_ship.id or exists (
         select 1 from pg_catalog.jsonb_array_elements(
           case when pg_catalog.jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) l
         where pg_catalog.btrim(l.value ->> 'shipmentCode') = v_ship.code))
     order by i.id for update of i;
  end if;

  select coalesce(pg_catalog.array_agg(r.id order by r.id), '{}') into v_receipts
    from public.warehouse_receipts_cn r
   where r.tenant_id = v_tenant and r.shipment_id = v_ship.id and r.deleted_at is null;

  -- Facturas vivas del embarque: por shipment_id o por una línea con su código
  -- (SDD-0555). `otros`: también factura otro embarque.
  with inv as (
    select i.id, i.status,
           (i.shipment_id is not null and i.shipment_id <> v_ship.id)
           or exists (
             select 1 from pg_catalog.jsonb_array_elements(
               case when pg_catalog.jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) l
             where nullif(pg_catalog.btrim(l.value ->> 'shipmentCode'), '') is not null
               and pg_catalog.btrim(l.value ->> 'shipmentCode') <> v_ship.code) as otros
      from public.invoices i
     where i.tenant_id = v_tenant and i.deleted_at is null and i.status <> 'anulada'
       and (i.shipment_id = v_ship.id or exists (
         select 1 from pg_catalog.jsonb_array_elements(
           case when pg_catalog.jsonb_typeof(i.lines) = 'array' then i.lines else '[]'::jsonb end) l
         where pg_catalog.btrim(l.value ->> 'shipmentCode') = v_ship.code))
  )
  select
    coalesce(pg_catalog.array_agg(inv.id order by inv.id)
             filter (where inv.status = 'borrador' and not inv.otros), '{}'),
    pg_catalog.count(*) filter (where inv.status <> 'borrador'),
    pg_catalog.count(*) filter (where inv.status = 'borrador' and inv.otros)
    into v_invoices, v_n, v_m
    from inv;
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('factura_emitida', v_n); end if;
  if v_m > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('factura_varios_embarques', v_m); end if;

  select pg_catalog.count(*) into v_n from public.client_claims c
   where c.tenant_id = v_tenant and c.shipment_id = v_ship.id and c.deleted_at is null;
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('reclamo', v_n); end if;

  select pg_catalog.count(*) into v_n from public.prealertas p
   where p.tenant_id = v_tenant and p.shipment_id = v_ship.id and p.deleted_at is null
     and p.status <> 'cancelada';
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('prealerta', v_n); end if;

  select pg_catalog.count(distinct o.id) into v_n
    from public.dispatch_order_packages dp
    join public.dispatch_orders o on o.id = dp.od_id
   where o.tenant_id = v_tenant and o.status <> 'cancelada'
     and dp.package_kind = 'warehouse_receipt_cn' and dp.package_id = any(v_receipts);
  if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('orden_despacho', v_n); end if;

  -- Aviso, no bloqueo (H-1, DG 2026-11-16): la tarifa congelada (0496) es del
  -- cliente anterior y esta migración no la toca; contabilidad la reemplaza antes
  -- de facturar.
  select pg_catalog.count(distinct rs.receipt_id) into v_n
    from public.shipment_rate_snapshots rs
   where rs.tenant_id = v_tenant and rs.receipt_id = any(v_receipts)
     and rs.superseded_at is null and rs.client_id <> v_client.id;
  if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;

  -- Lo que el cliente nuevo va a ver en el Portal (H-2), por tipo y sin contenido.
  v_portal := pg_catalog.jsonb_build_object(
    'documentos', coalesce((
      select pg_catalog.jsonb_object_agg(x.doc_type, x.n)
        from (select d.doc_type::text as doc_type, pg_catalog.count(*) as n
                from public.shipment_documents d
               where d.tenant_id = v_tenant and d.shipment_id = v_ship.id and d.deleted_at is null
               group by d.doc_type) x), '{}'::jsonb),
    'eventos', (select pg_catalog.count(*) from public.shipment_events e
                 where e.shipment_id = v_ship.id and e.deleted_at is null),
    'eventos_con_nota', (select pg_catalog.count(*) from public.shipment_events e
                          where e.shipment_id = v_ship.id and e.deleted_at is null
                            and nullif(pg_catalog.btrim(coalesce(e.note, '')), '') is not null));

  v_moved := pg_catalog.jsonb_build_object(
    'shipments', 1,
    'warehouse_receipts_cn', pg_catalog.cardinality(v_receipts),
    'warehouse_boxes', (select pg_catalog.count(*) from public.warehouse_boxes b
                         where b.receipt_id = any(v_receipts) and b.deleted_at is null),
    'invoices', pg_catalog.cardinality(v_invoices),
    'consolidation_items', (select pg_catalog.count(*) from public.consolidation_items ci
                             where ci.tenant_id = v_tenant and ci.shipment_id = v_ship.id),
    'shipment_documents', (select pg_catalog.count(*) from public.shipment_documents d
                            where d.tenant_id = v_tenant and d.shipment_id = v_ship.id),
    'client_notification_schedule', (select pg_catalog.count(*) from public.client_notification_schedule n
                                      where n.shipment_id = v_ship.id and n.status = 'scheduled'));

  if v_blockers <> '{}'::jsonb or v_dry then
    return pg_catalog.jsonb_build_object(
      'outcome', case when v_blockers <> '{}'::jsonb then 'blocked' else 'preview' end,
      'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
      'old_markbox', v_old, 'new_markbox', v_new,
      'blockers', v_blockers, 'warnings', v_warnings, 'portal', v_portal, 'moved', v_moved);
  end if;

  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  update public.shipments s
     set client_markbox = v_new, client_name = v_client.name
   where s.id = v_ship.id and s.tenant_id = v_tenant;

  update public.warehouse_receipts_cn r
     set client_markbox = v_new, client_name = v_client.name, is_orphan = false
   where r.id = any(v_receipts) and r.tenant_id = v_tenant;
  get diagnostics v_n = row_count;
  if v_n <> pg_catalog.cardinality(v_receipts) then
    raise exception 'pasar embarque: conflicto con las recepciones' using errcode = '40001';
  end if;

  -- El titular fiscal del borrador era del cliente viejo; al emitir, el sello de
  -- 0466 lo toma del Shipping Mark nuevo.
  update public.invoices i
     set client_markbox = v_new, client_name = v_client.name,
         client_rif = null, client_doc_kind = null, client_fiscal_address = null, bill_to_kind = null
   where i.id = any(v_invoices) and i.tenant_id = v_tenant and i.status = 'borrador';
  get diagnostics v_n = row_count;
  if v_n <> pg_catalog.cardinality(v_invoices) then
    raise exception 'pasar embarque: conflicto con las facturas' using errcode = '40001';
  end if;

  update public.consolidation_items ci
     set client_markbox = v_new, client_name = v_client.name
   where ci.tenant_id = v_tenant and ci.shipment_id = v_ship.id;

  update public.shipment_documents d
     set client_markbox = v_new
   where d.tenant_id = v_tenant and d.shipment_id = v_ship.id;

  -- Lo ya enviado, saltado o fallido es lo que recibió el cliente viejo.
  update public.client_notification_schedule n
     set client_markbox = v_new
   where n.shipment_id = v_ship.id and n.status = 'scheduled';

  perform public.append_audit_event(
    v_tenant,
    'shipment',
    v_ship.id,
    'user',
    v_actor,
    'shipment_client_reassigned',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object('client_markbox', v_old),
    pg_catalog.jsonb_build_object('client_markbox', v_new),
    pg_catalog.jsonb_build_object(
      'permanence', 'P1',
      'consequence', 'portal_owner_changed',
      'recovery', 'reassign_again',
      'shipment_code', v_ship.code,
      'moved', v_moved,
      'warnings', v_warnings),
    pg_catalog.concat('sdd-0645:reassign:', pg_catalog.txid_current()::text),
    1,
    'internal'
  );

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);

  return pg_catalog.jsonb_build_object(
    'outcome', 'reassigned',
    'shipment_id', v_ship.id, 'shipment_code', v_ship.code,
    'old_markbox', v_old, 'new_markbox', v_new,
    'blockers', '{}'::jsonb, 'warnings', v_warnings, 'portal', v_portal, 'moved', v_moved);
end;
$$;

comment on function public.reassign_shipment_client(uuid, uuid, text, boolean) is
  'SDD-0645/0551: pasa un embarque (y sus recepciones CN, borradores, líneas de consolidación, documentos y avisos programados) a otro cliente del tenant. Sólo operations/commercial/admin, motivo 4-1000, todo o nada, evento shipment_client_reassigned. p_dry_run: vista previa sin escribir. outcome: preview | blocked | reassigned.';

revoke all on function public.reassign_shipment_client(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.reassign_shipment_client(uuid, uuid, text, boolean) to authenticated;

do $postflight$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.reassign_shipment_client(uuid,uuid,text,boolean)');
begin
  if v_fn is null or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0551 postflight: reassign_shipment_client sin SECURITY DEFINER o con search_path';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE') then
    raise exception '0551 postflight: EXECUTE de reassign_shipment_client debe ser sólo de authenticated';
  end if;
  if exists (
    select 1 from pg_catalog.aclexplode((select proacl from pg_catalog.pg_proc where oid = v_fn)) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0551 postflight: PUBLIC conserva EXECUTE sobre reassign_shipment_client';
  end if;
end;
$postflight$;

notify pgrst, 'reload schema';
