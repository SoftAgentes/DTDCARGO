# Handoff · SDD-0673 · Corregir medidas, partir un embarque y grupo de WeChat

- Rama: `feat/sdd-0673-partir-embarque` · worktree `eager-gould-b7167d` · PR SoftAgentes/DTDCARGO#685 (lista para revisión).
- Spec: `docs/specs/0673-partir-embarque-y-referencia-de-grupo/spec.md` (in-progress). D1-D3 decididas por el DG el 2026-11-18 con la recomendación; Sam puede cambiarlas.
- Migración `0563_partir_embarque_y_medidas` (número del DG). **Aplicada en producción el 2026-11-19 01:37:17Z** (ver al final). La espera en `supabase/migrations-baseline.json` y la degradación declarada en `supabase/pending-migration-symbol-declarations.json` se retiraron en la #698, que además la selló en `supabase/migrations.lock.json`. El desarme de la 0563 sigue en `supabase/desarmes/`.

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
| Contrato `supabase/tests/0563_…test.sql` en PGlite: verde (91 aserciones), rojo sin la 0563 y 30 mutantes (`lib/studio/__tests__/partir-embarque-y-medidas.migration.test.ts`) | PASÓ (32/32) |
| `lib/studio/__tests__/medidas-embarque.test.ts` | PASÓ (6/6) |
| `medidas-embarque-queries.test.ts` (lecturaFallida, falla cerrado) y `tracking/[id]/__tests__/grupo-wechat-actions.test.ts` (0 filas) | PASÓ (9 pruebas) |
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
- Revisión del delta (B1-B4 y no bloqueantes 1, 2, 3, 4, 5 y 8 de la revisión Opus): la relanza el DG.

## Cambios por la revisión Opus (CHANGES_REQUESTED en `dbf39c12a`)

- B1: la fixture aplica la 0241 y la 0243 como producción; se quitó el bloqueo `cajas_borradas` (la 0243 dejó el índice único solo sobre las vivas). Subir después de bajar queda probado.
- B2: `tarifa_congelada` avisa también al corregir; al partir, el texto dice que la tarifa del original queda con el CBM entero y contabilidad la reemplaza. No se toca la tarifa.
- B3: la parte nueva nace con `notes` en nulo.
- 1: la parte nueva copia GPS, llegada y planificación.
- 2: el preflight exige el md5 del cuerpo de `sync_boxes_for_receipt` (0241) y el índice de la 0243.
- 3: la spec §5 justifica por qué corregir no bloquea por reclamo ni prealerta.
- 4: mutantes nuevos para las dos postcondiciones de partir, el evento de corrección, el borrador y la tarifa en cada función, las notas, la planificación y el md5.
- 5: `estaEnContenedor` falla cerrado.
- 8: `updateShipmentGroupReference` falla si no actualizó ninguna fila.
- Revisión `/ui-check` de la franja «Carga».

## FUERA DE ALCANCE DETECTADO

- La carga de consolidados podría llenar `group_reference` con el remitente (D6, spec siguiente).
- Buscar por grupo de WeChat en Embarques y Tracking.
- Ofrecer «Corregir medidas» y «Partir» también desde el panel de Embarques.
- (Revisión Opus, punto 6) `PATCH /api/studio/shipments/[id]` (`route.ts:125-135`) todavía escribe `weight_kg` y `volume_m3` sueltos, sin pasar por `correct_shipment_measures`.
- (Revisión Opus, punto 7) El grupo de WeChat, como cualquier columna de `shipments`, se puede leer desde el Portal por PostgREST: la policy «shipments portal self read» (0416) filtra por fila, no por columna. Ninguna pantalla lo muestra; el riesgo es bajo.

## 2026-11-18 · Preflight de la 0563 contra producción (rama `fix/sdd-0673-md5-sync-boxes-cloud`)

- La lectura previa en producción abortó sin escribir: «0563 abortada: sync_boxes_for_receipt no es la de la 0241».
- Medido por el DG en el catálogo, solo lectura: el `prosrc` de producción tiene md5 `7cb66f72fc71ea058d7f46fb0551eb05` y 2004 caracteres.
- Es el cuerpo de la 0241 (`a6e9542f…`, 2078 caracteres) sin sus líneas de solo comentario, como lo dejó Supabase Cloud. Lo comprobé con el archivo del repo.
- El preflight ahora acepta los dos md5.
- Pruebas: la 0241 sin líneas de comentario pasa el contrato entero, y otro cuerpo aborta. Contrato: PASÓ (34/34).

## 2026-11-19 · 0563 aplicada en producción y cierre

- Aplicada el 2026-11-19 a las 01:37:17Z: `version` 20261119013717, md5 `0bd55ef482794f52bb0baffdf2376352`, 51433 bytes.
- Verificación PASÓ, con los cuerpos vivos iguales. El paquete se armó desde el SHA `6ac848871` (#693).
- Evidencia: `/srv/ops/evidencias/apply-0563-dtd-cargo-20261119T013717Z`.
- OK de Sam, por el DG: «OK, aplica 0563 y 0564», y «si».
- Cierre (rama `chore/sdd-0673-cierre-0563`):
  - `retirar-espera.mjs … --md5 0bd55ef4…`: exit 0. Quitó la espera y 1 declaración, y selló sha256 `a193fd5d…`. `revisarAMano` salió vacío.
  - `migrations-lock`: 548 selladas, 0 nuevas sin sellar.
  - Pruebas del candado (`node --test`, 31/31), `check-migrations-applied` y el contrato de la 0563 (vitest, 70/70): PASÓ.
  - Busqué a mano pruebas que afirmen la espera de la 0563: no hay. Las coincidencias de «0563» en contabilidad son de la SDD-0563, no de esta migración.
- La oficina ya puede usar «Corregir medidas» y «Partir embarque» en la ficha del embarque.
