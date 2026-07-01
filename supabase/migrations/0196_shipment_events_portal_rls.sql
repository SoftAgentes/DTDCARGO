-- ─────────────────────────────────────────────────────────────
-- SDD-0132 · Hitos del envío en el portal — RLS portal self-read
--
-- `shipment_events` (SDD-0013) ya existe y la operación la puebla (auto por
-- cambio de status en transitionShipment + manual/backdated en addShipmentEvent).
-- Su RLS de tabla es SOLO "by tenant" → un cliente del portal (que no matchea
-- get_user_tenant_id()) NO puede leer sus propios eventos. Esta migración agrega
-- la política ADITIVA de portal self-read para que el stepper del portal muestre
-- la FECHA REAL de cada hito.
--
-- Sin denormalizar markbox en shipment_events: la política usa un EXISTS contra
-- `shipments` (que sí tiene client_markbox) filtrado por get_portal_client_markbox().
-- Defensa en profundidad: las queries del portal igual resuelven el envío por
-- markbox primero (getMyShipment) y filtran por shipment_id (patrón lib/portal/*).
--
-- NO se aplica a prod desde acá (lo hace el Director / MCP). Número 0196.
-- ─────────────────────────────────────────────────────────────

-- Cliente del portal: LEE los eventos de SUS envíos (por markbox, vía shipments).
-- Aditiva (permissive OR con "shipment_events by tenant"), SELECT-only.
create policy "shipment_events portal self read"
  on public.shipment_events for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.shipments s
      where s.id = shipment_events.shipment_id
        and s.client_markbox is not null
        and s.client_markbox = public.get_portal_client_markbox()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0196_shipment_events_portal_rls.sql
-- Aplicar con: MCP apply_migration (Director) · dry-run begin…rollback antes.
-- ─────────────────────────────────────────────────────────────
