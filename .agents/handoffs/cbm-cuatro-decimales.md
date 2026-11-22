# Handoff — SDD-0667 CBM hasta 4 decimales (2026-11-18)

- **Owner/sesión:** Worker, rama `claude/friendly-maxwell-16e749`, base `main` 1daa6af75.
- **Encargo:** DG, a pedido de Sam (reunión de oficina 18/11). SDD asignado: 0667.
- **Alcance fijado por el DG:** solo visual y cálculo de pantalla; sin cambiar lo guardado en la base, sin migración, sin tarifas.

## Hecho
- `lib/shared/cbm.ts`: `formatCbm` (máx. 4 decimales, sin ceros de relleno, es-VE con coma), `roundCbm`, `cbmPlano` (CSV). Pruebas en `lib/shared/__tests__/cbm.test.ts`.
- Usada en los sitios de Studio, móvil y portal que formateaban CBM/m³: Embarques, Tracking, Cotizador, Almacén CN/VE, KPIs CN, Inventario, Despacho, Club, Reportes, Costing, Proveedores, Dashboard, Dirección, tarifa congelada, móvil, packing list público y portal (estos con punto decimal, como sus kg/USD). Los CSV y el texto de WhatsApp de la cotización (sale al cliente) no se tocaron (revisión 1: bloqueante 3).
- `NumericInput type="volume"`: la vista previa ya muestra los decimales reales (el valor enviado no se truncaba).
- Se afinan agregados de pantalla de 2–3 a 4 decimales con `roundCbm`. Se revirtió el de `despacho/actions.ts` porque ese sí se escribe en la base.
- Tests actualizados al formato nuevo (Embarques «3 m³», Tracking «4 m³»); nueva prueba de `metrosCubicos`.
- Spec `docs/specs/0667-cbm-cuatro-decimales/spec.md` con la investigación del Excel (§3) y la decisión para Sam (§4).

## Validación
- tsc: PASÓ. eslint de los archivos tocados: PASÓ.
- vitest sobre tracking, embarques, ui, lib/shared, móvil, inventario, cn, ve, despacho, club, facturas del portal, p, inventory, club, export, costing: PASÓ (207 archivos; 2 tests de Embarques actualizados).
- `pnpm verify` local: NO EJECUTADO (gate = CI de GitHub). `sdd:check` numbering: PASÓ.
- /ui-check: OK para commit (2 observaciones bajas).

## Pendientes de esta tarea
- Decisión de Sam (spec §4): regla A (4 decimales guardados, migración) o B (3 decimales, declarado). La propuesta de migración está en las notas de la sesión, no en el repo.

## FUERA DE ALCANCE DETECTADO
- Cargador de consolidados: redondea el envío a 3 decimales (`round3`) y `shipments.volume_m3` es `numeric(10,3)`; el total puede diferir del Excel hasta 0,0005 m³ por envío.
- Calculadora pública: `roundCBM` con `Math.ceil` a 3 decimales; decide cuánto se cobra una carga pequeña.
- RPC de partición de paquetes del bodeguero (3 decimales).
- Naviera (KPIs, ocupación y plan de carga con 1 decimal) y los CSV de exportación quedan fuera por decisión; ver spec §5.

## Impacto documental
Spec 0667 nuevo; el formato queda descrito en la cabecera de `lib/shared/cbm.ts`.
