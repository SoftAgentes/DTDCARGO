# Handoff · SDD-0673 · Corregir medidas, partir un embarque y grupo de WeChat

- Rama: `feat/sdd-0673-partir-embarque` · worktree `eager-gould-b7167d` · PR en borrador SoftAgentes/DTDCARGO#685.
- Spec: `docs/specs/0673-partir-embarque-y-referencia-de-grupo/spec.md` (in-progress). D1-D3 decididas por el DG el 2026-11-18 con la recomendación; Sam puede cambiarlas.
- Migración `0563_partir_embarque_y_medidas` (número del DG). **No aplicada.** Espera en `supabase/migrations-baseline.json`, degradación declarada en `supabase/pending-migration-symbol-declarations.json`, desarme en `supabase/desarmes/0563_desarme.sql`.

## Qué hay

1. `correct_shipment_measures`: corrige cajas, CBM y peso a la vez en `shipments`, la línea vigente de `consolidation_items` y la recepción CN viva. Las cajas físicas las reconcilia el trigger de 0240/0241. Bloquea si el embarque está entregado o cancelado, si tiene una factura emitida o una orden de despacho, si las cajas están estibadas o si una caja a quitar ya está en una recepción de Venezuela. Avisa si hay borrador de factura, si el contenedor zarpó o si se crean cajas sin etiqueta.
2. `split_shipment`: parte el embarque en «<código>-B» (o -C… si está ocupado) con su dueño. Mueve las cajas físicas sin cambiarles el código, copia la línea de tiempo y no cambia el total del contenedor. Bloquea si las medidas no coinciden entre las tablas: primero se corrigen.
3. `shipments.group_reference` («Grupo de WeChat», 1-120): solo en el Studio, no en el Portal.
4. Ficha `/studio/tracking/[id]`: franja «Carga» con los dos modales (vista previa y motivo) y el grupo. Dentro de un contenedor, el peso y el CBM de «Datos del envío» quedan en solo lectura; `updateShipment` tampoco los escribe.

## Evidencia

| Comprobación | Estado |
|---|---|
| `docs:check`, `sdd:check` (node directo) | PASÓ |
| `check-pending-migration-symbols` (node directo) | PASÓ: 0 rojos, 1 amarillo declarado |
| Contrato `supabase/tests/0563_…test.sql` en PGlite: verde (86 aserciones), rojo sin la 0563 y 20 mutantes (`lib/studio/__tests__/partir-embarque-y-medidas.migration.test.ts`) | PASÓ (22/22) |
| `lib/studio/__tests__/medidas-embarque.test.ts` | PASÓ (6/6) |
| `rbac-actions-guard` (inventario 488 → 493) y pruebas de `tracking/` | PASÓ |
| Contratos del Studio (`vitest run contract`, 34 archivos) | PASÓ |
| `tsc --noEmit` | PASÓ |
| ESLint de los archivos tocados | PASÓ |
| `pnpm build` y `pnpm verify` completos | NO EJECUTADO (turno de PC acotado a pruebas); queda para el CI |
| Contrato en Postgres real con Docker | NO EJECUTADO |
| Revisión independiente en Opus | Pendiente: la lanza el DG |

## Para el contenedor real

1. Con la 0563 aplicada (OK nominal de Sam con el nombre del archivo y el runbook), primero se corrigen las medidas de los dos embarques con «Corregir medidas».
2. Después se parte el embarque mezclado con «Partir embarque».
3. Cada paso lleva su motivo. Los números reales no van a Git.

## Pendientes de esta tarea

- Build y CI de la PR.
- Revisión `/ui-check` de la franja «Carga».

## FUERA DE ALCANCE DETECTADO

- La carga de consolidados podría llenar `group_reference` con el remitente (D6, spec siguiente).
- Buscar por grupo de WeChat en Embarques y Tracking.
- Ofrecer «Corregir medidas» y «Partir» también desde el panel de Embarques.
- `sync_boxes_for_receipt` (0240/0241) calcula el `seq` siguiente solo sobre cajas vivas: si hay cajas borradas con `seq` alto, crear cajas nuevas puede chocar con `warehouse_boxes_receipt_seq_key`. Es previo a esta spec y no se tocó; «Corregir medidas» lo detecta y bloquea (`cajas_borradas`) en vez de fallar.
