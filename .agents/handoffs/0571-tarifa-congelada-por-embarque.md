# Handoff · SDD-0571 · Tarifa congelada por embarque (4.1 del plan contable)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `fase4-carril-adelantado` / sesión Worker «carril del embarque» (Claude, `claude-peaceful-franklin-a3831e`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\peaceful-franklin-a3831e` |
| Rama | `claude/peaceful-franklin-a3831e`, sobre la reserva `codex/sdd-reserve-0571` (`37fd5608`, que parte de `origin/main` `eafbd910`) |
| SDD | [0571](../../docs/specs/0571-tarifa-congelada-por-embarque/spec.md), `in-progress`. Número y migración `0496` asignados por el Director el 2026-10-20 (intercambio 0571↔0572 con «Contabilidad»). Reserva con `sdd:next --reserve tarifa-congelada-por-embarque --number 0571 --push` |
| Estado | lista para revisión de diseño y seguridad del Director; `pnpm verify` pedido al Director (turno) |
| Permisos | Encargo de Sam: commits, push de la rama propia y PR **en borrador**; no fusionar. **No incluye** aplicar la 0496 ni leer producción: la aplica el Director con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 4.1 del plan (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md` §8, carril adelantado) con la decisión 9: la tarifa por CBM se congela al recibir en Yiwu con el CBM medido allí (500 kg/m³ regla, 1.000 excepción); el orden es estimado aceptado → lista del cliente o aliado → tarifario; el mínimo se cobra. Fila «CBM real · tarifa · a facturar» y alerta «sin tarifa» en Almacén CN.

## COMPLETADO

- **Mapa en solo lectura** de dónde se calcula la tarifa hoy (cotizador, estimados, listas, recepción CN, consolidación, OV, lote 0543): ninguna tabla operativa la congelaba. Está en la spec, § «Lo que hay hoy».
- **Migración 0496** (`fccd1941`): tabla `shipment_rate_snapshots` inmutable por recepción, guardián para todos los roles, chequeo diferido del reemplazo, RPC `congelar_tarifa_recepcion` (DEFINER) que deriva tarifa y mínimo de la fila de origen y clasifica lista propia/pactada/descuento o casa con la regla de `resolveRateForClient`; preflight por md5 de `get_user_tenant_id`, `current_studio_role` y `resolve_price_book`; postflight; espera MIGRATE-FIRST en el baseline.
- **App** (`2e29f752`): columna «Tarifa · a facturar» en Almacén CN, cajón con propuesta, estimado, a mano y Excel (los dos últimos solo admin/contabilidad), historial; «Congelar tarifas pendientes» en lote; textos es-VE y zh-CN; símbolos declarados con su degradación.
- **`/ui-check`**: 4 hallazgos (ancho de la columna medido con el peor monto, contraste del aviso, borde izquierdo, gaps); los tres primeros corregidos antes del commit.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Contrato `0496_tarifa_congelada_por_embarque.test.sql` en PGlite | la migración | PASÓ: «TEST 0496 GREEN: 79 aserciones»; control rojo: «TEST 0496: existe public.shipment_rate_snapshots» |
| `lib/studio/__tests__/tarifa-congelada.migration.test.ts` | contrato, control rojo, 30 mutantes (cada uno muere en su aserción), aborto del preflight, reaplicación, espera | PASÓ: 35/35 (una corrida previa mostró un mutante que moría en otra aserción; se acotó la lectura de commercial y warehouse al tenant A) |
| `lib/studio/rate-snapshots/__tests__/` | tipos (14) y paridad SQL↔`resolveRateForClient` (8 casos + propiedad del descuento, 40 casos con semilla) | PASÓ: 23/23. Mutante a mano (sin la rama «pactada»): muere en «DTD-0042 a Valencia: pactada»; archivo restaurado con `git checkout` y `git diff --quiet` |
| `app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts` | acciones, ERR-01, lote, permisos | PASÓ: 13/13 |
| `ReceiptRateCell.test.tsx` + `AlmacenCnClient.test.ts` + `ReceiptRowActions.test.tsx` | UI | PASÓ: 9/9 (la celda, 4/4 después del ajuste del ui-check) |
| `tsc --noEmit` | repo | PASÓ (0 errores) sobre el árbol de `2e29f752` |
| eslint de los archivos tocados | — | PASÓ (0 errores, 0 avisos) |
| `check-pending-migration-symbols` | código alcanzable | PASÓ: «0 ROJO · 1 AMARILLO declarado(s)» |
| `docs:check`, `sdd:check`, `governance:check`, `components:check` | — | PASÓ |
| Contrato en PostgreSQL 17 (Docker, `run-sql-tests`) | — | NO EJECUTADO: es corrida pesada; entra en `pnpm verify` |
| `pnpm verify` | completo | NO EJECUTADO: turno pedido al Director el 2026-10-20 |

Las corridas puntuales usaron el `node_modules` de main por junction (`node node_modules/vitest/vitest.mjs`, nunca `pnpm exec`). Se quita con `cmd /c rmdir` antes de borrar el worktree.

## COMMITS

- `37fd5608` reserva SDD-0571.
- `fccd1941` migración 0496, contrato, PGlite, espera y spec.
- `2e29f752` app del Almacén CN, pruebas, textos y símbolos.
- El commit que contiene este documento.

## PR / BRANCH

Rama `claude/peaceful-franklin-a3831e`, base `main`. PR en borrador: ver la PR de esta rama.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` completo (turno del Director).
2. Revisión de diseño y seguridad del Director (las 7 decisiones de la spec).
3. Previa del Director en producción: md5 vivos de los tres helpers del preflight; luego OK nominal de Sam nombrando `0496_tarifa_congelada_por_embarque` y aplicación por el runbook (MIGRATE-FIRST); smoke en Almacén CN.
4. Pendiente de decisión (no bloquea): congelar sola al recibir (falta el servicio en la recepción), cobro del exceso de peso por contenedor, importador del Excel de Yiwu cuando llegue el archivo.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/price-books/price-book-types.ts:95` `aplicarDescuento` redondea con `Math.round(n*100)/100` en coma flotante; la base redondea en `numeric`. La propiedad de 40 casos no encontró diferencia, pero en un borde exacto (`x.xx5`) podrían diferir un centavo. Hoy es solo visual en el cotizador; la tarifa congelada usa la de la base.
- El rol `accounting` puede congelar por la RPC pero no ve el módulo `cn` (`lib/studio/rbac.ts`, matriz `cn`). Si Sam quiere que la contadora corrija tarifas desde la pantalla, es un cambio de la matriz (decisión 15 cubre lecturas de otros módulos).
- `quotes` no guarda mínimo: un estimado aceptado toma el `min_charge` de su `rate_used_id`.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico actualizado: la spec 0571 e índice `docs/specs/README.md`.
- Graphify/Archify: NO EJECUTADO en este worktree (sin cambios en fuentes del piloto semántico); `knowledge:status` corrido, modo integrado. El Director publica desde main al integrar.

## HANDOFF AL DIRECTOR

- Siguiente acción: turno de `verify`, revisión de la spec y previa de los md5. Después la 4.5 («Embarques sin facturar»), que lee `shipment_rate_snapshots`: conviene que la 0496 esté al menos aprobada en diseño.
- Contratos compartidos: tabla nueva y RPC nueva; toca `AlmacenCnClient.tsx`, `cn/page.tsx` y los diccionarios `warehouse.ts`. No toca `lib/studio/accounting`, `invoices`, recibos ni tasas.
- Ownership: claim de `claude-peaceful-franklin-a3831e` vigente mientras siga la tarea (4.5 y 4.2 vienen en esta misma sesión).
