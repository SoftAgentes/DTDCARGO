-- ============================================================================
-- 0333 · SDD-0237 — Retira la tarifa terrestre sembrada Valencia→Maracaibo
-- ============================================================================
-- La migración 0005 sembró seis tarifas de ejemplo, y una de ellas sigue viva:
--
--   transporte_terrestre · Valencia → Maracaibo · flat_rate $650 · 2 días
--   nota: "Camión chico Valencia-Maracaibo"
--
-- DE DÓNDE SALIÓ ESE $650: de información NO verificada (founder, 1-ago-2026).
-- Nadie lo confirmó con un transportista y no corresponde a ningún acuerdo.
--
-- POR QUÉ MOLESTA. No llega al sitio público —`public_cbm_rate()` filtra
-- `is_public = true` y `per_cbm is not null`, y esta fila falla las dos— pero
-- sí llega al asesor: `findRateForDestination()` (lib/studio/destination-change.ts)
-- busca por servicio + ILIKE del destino y **le sugiere el cobro** al operador
-- cuando cambia el destino de un envío. Con esta fila viva, redirigir un envío
-- terrestre a Maracaibo proponía $650 de un clic.
--
-- El precio real de ese tramo hoy es $123,60 por m³ (tramo Foráneo del
-- tarifario de Benito, migración 0332). Para 2 m³ son $247,20, no $650.
-- También inflaba en +1 el KPI "tarifas activas" del dashboard, que cuenta
-- `valid_until >= today` y esta vencía el 31-dic-2026.
--
-- POR QUÉ MIGRACIÓN Y NO UN CLIC EN EL STUDIO. El módulo Tarifas tiene su
-- botón de soft-delete y con eso bastaría en producción, pero el seed vive en
-- la migración 0005: en una reconstrucción del schema desde cero
-- (`scripts/check-schema-rebuild.mjs`) la fila vuelve a nacer. Retirarla acá la
-- retira en los dos mundos.
--
-- SOFT DELETE, NO BORRADO. `rates` está diseñada con `deleted_at` y la RLS ya
-- filtra `deleted_at is null`: marcarla la saca del catálogo, del KPI y del
-- sugeridor de una vez, y conserva la traza de que existió.
--
-- ALCANCE QUIRÚRGICO. El WHERE clava servicio + origen + destino + tarifa +
-- nota, así que no puede tocar una tarifa terrestre legítima que alguien cargue
-- después para esa misma ruta. Si mañana se cotiza camión dedicado, se crea con
-- un número verificado y esta migración no la roza.
--
-- IDEMPOTENTE. `deleted_at is null` en el WHERE: correrla dos veces no cambia
-- nada la segunda vez, y tampoco pisa la fecha de borrado original.
-- ============================================================================

update public.rates r
   set deleted_at = now()
  from public.tenants t
 where r.tenant_id = t.id
   and t.slug = 'dtd'
   and r.service = 'transporte_terrestre'::shipment_service
   and r.origin = 'Valencia'
   and r.destination = 'Maracaibo'
   and r.flat_rate = 650.00
   and r.notes = 'Camión chico Valencia-Maracaibo'
   and r.deleted_at is null;
