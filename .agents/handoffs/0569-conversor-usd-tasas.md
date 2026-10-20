# Handoff · SDD-0569 · Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0569-conversor-usd-tasas` |
| Rama | `codex/sdd-0569-conversor-usd-tasas`, desde `origin/main` `88b36c7a` |
| SDD | [0569](../../docs/specs/0569-conversor-usd-tasas/spec.md), `in-progress`. La reserva (`d5e11670`, rama `codex/sdd-reserve-0569`) entró por cherry-pick. El Director asignó la migración 0495 |
| Estado | implementada; falta correr el contrato, PGlite y las pruebas de la app con turno de máquina, y después `pnpm verify`. La 0495 se aplica antes de fusionar (MIGRATE-FIRST), con la previa del Director y el OK nominal de Sam |
| Permisos | El Director la asignó como la primera parte de la 2.1 del plan y aprobó el diseño (`88150bc9`) el 2026-10-20. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0495 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 2.1 del plan contable, primera parte: la tabla `fx_rates` (fuente, fecha de valor, quién) y un conversor canónico a USD que falla cerrado (nunca 0 ni el monto tal cual), con USDT = USD 1:1 (decisión 1 de Sam). Los 13 reemplazos van en la SDD siguiente; la hora de Caracas es la 0570; la carga del BCV, la tercera.

## COMPLETADO

- **El diseño** (`88150bc9`), aprobado por el Director con sus cinco respuestas: `tenant_fx_history` medida en 0 filas y sin copia; la segunda tasa manual del día reemplaza a la primera, con auditoría; `bcv` > `manual` > `operacion`; el móvil precarga la tasa; la partición.
- **La migración 0495:** `fx_rates` con RLS de lectura por tenant; `to_usd` (IMMUTABLE) y `fx_normalizar_moneda`; `fx_rate_on` (STABLE); la RPC `registrar_tasa_de_cambio` (admin o accounting, sin fecha futura); la auditoría D2; `fx_rate_source` y `fx_rate_valid_on` en `invoices` y `supplier_bills`; preflight y postflight.
- **El contrato** en `supabase/tests/0495_fx_rates_conversor_usd.test.sql` y su corrida en PGlite con control rojo, 13 mutantes, el aborto con una fila en `tenant_fx_history`, la reaplicación y la espera.
- **La app:** `lib/shared/fx.ts`, `lib/studio/fx-rates.ts`, la factura y la CxP congelan la tasa, Admin › Tasas por la RPC, gastos y el móvil sobre `fx_rates`. Nada escribe `tenant_fx_history`.
- **Las pruebas nuevas:** `fx.test.ts`, `fx-rates.test.ts`, `factura-congela-la-tasa.test.ts`, `cxp-congela-la-tasa.test.ts` y `exchange-rates-actions.test.ts`.
- **El gobierno:** la espera de la 0495, los 7 símbolos declarados con sus 6 evidencias y el índice.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `check-pending-migration-symbols` | código alcanzable que usa la 0495 | PASÓ: «0 ROJO · 1 AMARILLO declarado(s) · 2 homónimo(s) descartado(s)» |
| `migrations-lock verificar` | candado | PASÓ: la 0495 figura como espera, «0 nueva(s) sin sellar» |
| `check-numbering` | numeración | PASÓ: «sin números repetidos» |
| `docs:check` (554 specs) | documentación | PASÓ |
| Unicidad de los textos de los mutantes (`sdd0566-check-mutants.cjs`) | la prueba PGlite contra la 0495 | PASÓ: «mutantes: 13 · con from no único: 0» |
| Contrato en PostgreSQL 17 | la migración | NO EJECUTADO: espera turno de máquina |
| `vitest run` de la prueba PGlite y de las pruebas nuevas y tocadas | migración y app | NO EJECUTADO: espera turno de máquina |
| `typecheck` y eslint `--max-warnings=0` | repo y archivos tocados | NO EJECUTADO: espera turno de máquina |
| `pnpm verify` | completo | NO EJECUTADO |

## Impacto documental y conocimiento

La spec 0569 y el índice. **Cambia el esquema** (la 0495), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. Con turno de máquina: el contrato en Docker, PGlite con los mutantes, las pruebas de la app, typecheck y eslint; después `pnpm verify`.
2. PR en borrador y aviso al Director.
3. La previa de producción del Director (`tenant_fx_history` en 0 y `fx_rates`/`to_usd` ausentes) y el OK nominal de Sam NOMBRANDO `0495_fx_rates_conversor_usd`. Después, aplicar, hacer el smoke de la espera y fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **El día del documento es hoy en UTC** en `createInvoice` y `updateInvoice` (`new Date().toISOString().slice(0, 10)`): entre las 20:00 y la medianoche de Caracas toma la tasa del día siguiente. Es la 0570.
2. **`tenant_fx_history` queda sin uso.** Ni se lee ni se escribe; borrarla es una migración aparte, cuando el Director lo decida.
3. **`createInvoice` y `createBillFor` devuelven el texto de la base** en su error de insert («No se pudo crear la factura: …», «No se pudo crear la CxP: …»). Es anterior a esta SDD y choca con ERR-01.
