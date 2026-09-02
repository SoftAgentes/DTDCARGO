# Handoff · SDD-0345 · Detalle privado de envío acotado

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · SIN GATE CLOUD NUEVO

## Alcance cerrado

- `/portal/envios/[code]` ya no importa ni construye `service_role`.
- `getPortalShipmentPrivateContext()` sólo recibe el código y prueba el envío
  mediante la sesión/RLS antes de cualquier lectura interna.
- Un único admin firma exclusivamente documentos RLS-visibles y usa únicamente
  el shipment id comprobado para avisos, naviera, tracking y aceptación.
- Si no hay envío propio o falla la elevación, no se entregan URLs ni datos
  internos; se conservan sólo envío y metadatos RLS cuando corresponda.
- El baseline RSC baja de 4 rutas / 9 construcciones a 3 / 7.

## Evidencia

- Focales: 2 archivos / 6 pruebas verdes.
- Suite completa: 520 archivos / 5.928 pruebas verdes.
- TypeScript, ESLint y `git diff --check`: verdes.

## Gates alojados

Este slice no crea migración ni refresca tracking. No se hizo push, deploy,
Cloud o Producción.
