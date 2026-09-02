# Handoff · SDD-0342 · Documentos del Portal por principal

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · MIGRACIÓN 0406 NO APLICADA

## Alcance cerrado

- `get_portal_packing_list_documents()` deriva cliente, tenant y Shipping Mark
  desde `auth.uid()` y sólo expone metadatos mínimos de packing lists vigentes.
- `listSignedPortalDocuments()` relee mediante la sesión/RLS y firma únicamente
  esos storage paths; el caller no puede suministrar ids ni rutas.
- `/portal/documentos` deja de construir dos clientes `service_role`.
- El baseline RSC baja de 7 rutas / 14 construcciones a 6 / 12.

## Evidencia

- Focales: 3 archivos / 7 pruebas verdes.
- Suite completa: 517 archivos / 5.915 pruebas verdes.
- TypeScript y ESLint focal: verdes.
- SQL: 147 contratos verdes con rollback total.
- Rebuild: 403 migraciones; 385 aplicadas desde cero y 18 sólo-ledger;
  aislamiento verificado en 219 tablas y 2 tenants.

## Gate alojado pendiente

`0406_portal_packing_lists_por_principal.sql` no fue aplicada a Cloud o
Producción. Requiere autorización específica, ejecución individual y el runbook
`docs/runbooks/aplicar-migraciones-prod.md`.
