# Handoff · SDD-0572 · Los 13 conversores a USD pasan a uno solo, que falla cerrado (0572-a)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0572-conversor-usd-reemplazos` |
| Rama | `codex/sdd-0572-conversor-usd-reemplazos`, apilada sobre la #301 (`3d0c9028`, mezclada en `9c864da5`) |
| SDD | [0572](../../docs/specs/0572-conversor-usd-reemplazos/spec.md), diseño aprobado por el Director el 2026-10-20 |
| Estado | 0572-a implementada (reglas A a F), sin push. Faltan typecheck, eslint y `pnpm verify` con turno del Director |
| Permisos | Instrucción del Director: «crea su rama desde la cabeza de la #301 (`3d0c9028`), porque necesita `toUsd`, y escribe el código de los reemplazos. Pruebas puntuales de un archivo, sí; nada pesado.» Push y PR en borrador cuando el Director dé el turno y pida el push. **No hay migración en la 0572-a.** |

## OBJETIVO ORIGINAL

La 2.1 del plan contable, segunda parte: reemplazar las 13 implementaciones de conversión a USD y las tasas fijas del código por el conversor canónico de la 0569, fallando cerrado.

## COMPLETADO

- Reglas A a F, según la tabla *Implementación* de la spec.
- La regla G se difiere a la 2.3. El asiento de venta sigue al nominal (B2); convertir solo el subdiario de clientes abriría una diferencia falsa.
- Las pruebas que fijaban lo de antes se reescribieron. Hay pruebas nuevas para los asientos sin tasa, gastos y pagos, y la previa de la rendición.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales, un archivo a la vez (`node node_modules/vitest/vitest.mjs run <archivo>`) | PASÓ en 31 archivos (detalle abajo) |
| `tsc` | NO EJECUTADO con turno. Hubo un `tsc` completo **sin turno**, antes de las reglas B a F; se le confesó al Director el 2026-10-20 |
| eslint | NO EJECUTADO |
| `pnpm verify` | NO EJECUTADO: espera turno |
| Mutantes de app | NO EJECUTADO: con el turno, sobre los cinco `missing-fx-rate`, `emitRenditionFor`, el CNY del validador y `resolveDisplayRate` |

Pruebas puntuales que pasaron:

- **Conversión y cobros:** `payment` 46, `treasury` 57, `partner-finance/types` 54, `alerts` 7, `fidelizacion/types` 38.
- **Costing:** `costing/queries` 18, `costing/ui` 17, `costing/types` 28.
- **Reportes:** `reports/types` 45, `reports/queries` 28.
- **Ingreso del período y libro de control:** `ingreso-periodo` 38, `libro-control` 42, `libro-control-queries` 34.
- **Dashboard y Dirección:** `dashboard-kpi-queries` 8, `direccion/queries` 39.
- **Pantallas:** `reportes-tab` 9, `estado-gerencial-mezclado` 2, `pantallas-muestran-la-denegacion` 9, `TesoreriaClient.cxp-saldada` 9.
- **Cobros sin identificar y cobranza:** `payment-receipts-0068` 31, `collections-identify` 22, `recordatorios` 19.
- **Exportación:** `operativo-csv` 15.
- **Rendiciones:** `renditions` 35, `emit-void` 9.
- **CxP y pagos a proveedores:** `cxp-congela-la-tasa` 4, `treasury-payments` 11.
- **Nuevas:** `asiento-sin-tasa` 5, `gastos-y-pagos-en-usd-0572` 7, `EmitDrawer.sin-tasa` 2.

## Impacto documental y conocimiento

- La spec 0572 trae la implementación, la allowlist y lo que queda abierto.
- No cambia reglas de AGENTS.
- El cambio de comportamiento visible para Sam está en *Qué cambia para Sam, pantalla por pantalla*.

## PENDIENTES DE ESTA TAREA

1. Con el turno: `tsc`, eslint, `pnpm verify` y los mutantes de app.
2. Hacer el commit selectivo según la allowlist. Hacer push y abrir el PR en borrador apilado sobre la #301. Cuando entre la #301, moverlo a main.
3. **0572-b:** el SQL de 0404 y 0411. Necesita el número del Director, la previa y el OK nominal de Sam.
4. Hacer el `/ui-check` de Costing (selector apagado), la previa de Rendiciones, los avisos de Reportes, Dirección y Financiero China.

## FUERA DE ALCANCE DETECTADO (para el Director)

- **Cobro aplicado a una factura sin tasa:** hereda la tasa de la factura (RPC 0467). Sin tasa, queda sin asiento, en «Por contabilizar». La pantalla de «asentar pendientes» es de la 2.2.
- **«Gastos hoy» usa la hora del servidor** (`expense-queries.ts`, `setHours(0, 0, 0, 0)`), no la de Caracas. Va en la SDD de la hora de Caracas.
- **Las sumas multimoneda con «$» sin convertir** van en la SDD de KPIs multimoneda (decisión 5).
