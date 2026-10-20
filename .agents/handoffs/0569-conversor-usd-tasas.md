# Handoff · SDD-0569 · Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0569-conversor-usd-tasas` |
| Rama | `codex/sdd-0569-conversor-usd-tasas`, desde `origin/main` `88b36c7a` |
| SDD | [0569](../../docs/specs/0569-conversor-usd-tasas/spec.md), `in-progress`. La reserva (`d5e11670`, rama `codex/sdd-reserve-0569`) entró por cherry-pick. El Director asignó la migración 0495 |
| Estado | lista para revisión: PR en borrador, `pnpm verify` 16/17 sin fallos sobre `2938439c`. La 0495 se aplica antes de fusionar (MIGRATE-FIRST), con la previa del Director y el OK nominal de Sam |
| Permisos | El Director la asignó como la primera parte de la 2.1 del plan y aprobó el diseño (`88150bc9`) el 2026-10-20. Eso cubre commits selectivos, push de la rama propia y PR en borrador. **No incluye aplicar la 0495 ni leer producción:** eso es del Director, con el OK nominal de Sam |

## OBJETIVO ORIGINAL

La 2.1 del plan contable, primera parte: la tabla `fx_rates` (fuente, fecha de valor, quién) y un conversor canónico a USD que falla cerrado (nunca 0 ni el monto tal cual), con USDT = USD 1:1 (decisión 1 de Sam). Los 13 reemplazos van en la SDD siguiente; la hora de Caracas es la 0570; la carga del BCV, la tercera.

## COMPLETADO

- **El diseño** (`88150bc9`), aprobado por el Director con sus cinco respuestas: `tenant_fx_history` medida en 0 filas y sin copia; la segunda tasa manual del día reemplaza a la primera, con auditoría; `bcv` > `manual` > `operacion`; el móvil precarga la tasa; la partición.
- **La migración 0495:** `fx_rates` con RLS de lectura por tenant; `to_usd` (IMMUTABLE) y `fx_normalizar_moneda`; `fx_rate_on` (STABLE); la RPC `registrar_tasa_de_cambio` (admin o accounting, sin fecha futura); la auditoría D2; `fx_rate_source` y `fx_rate_valid_on` en `invoices` y `supplier_bills`; preflight y postflight.
- **El contrato** en `supabase/tests/0495_fx_rates_conversor_usd.test.sql` y su corrida en PGlite con control rojo, 16 mutantes, el aborto con una fila en `tenant_fx_history`, la reaplicación y la espera.
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
| Unicidad de los textos de los mutantes (`sdd0566-check-mutants.cjs`) | la prueba PGlite contra la 0495 | PASÓ: «mutantes: 16 · con from no único: 0» |
| Contrato en PostgreSQL 17 (turno del Director, 2026-10-20) | la migración | PASÓ: «TEST 0495 GREEN: 34 aserciones». Sin la 0495 (`apply_fix=false`): «TEST 0495: existe public.to_usd(numeric,text,numeric)». La primera corrida falló por el fixture (el CHECK legacy de `entity_type` que 0077/0078/0088 recrean y que en producción retiró la 0261); el contrato ahora lo retira |
| `fx-rates-conversor.migration.test.ts` (PGlite) | contrato, control rojo, 16 mutantes, preflight con fila en `tenant_fx_history`, reaplicación y espera | PASÓ: `Tests  21 passed (21)`. La primera corrida dio 3 rojos: dos mutantes morían con el error crudo de `to_usd` (el helper ahora lo atrapa) y el del filtro de la consulta moría en la aserción de la RLS (la de `service_role` va ahora antes) |
| `vitest run` de las 5 pruebas nuevas y de facturación, admin, tesorería, gastos, móvil, `invoice-types` e `invoice-lines-shipment-code` | app | PASÓ: `Test Files  21 passed (21)`, `Tests  293 passed (293)`; las 5 nuevas, `Tests  32 passed (32)` |
| `typecheck` y eslint `--max-warnings=0` | repo y archivos tocados | PASÓ: `tsc=0`, `eslint=0` |
| **`pnpm verify` sobre `2938439c`** (de 2026-10-20T12:20:22Z a 13:05:13Z) | completo | `VERIFY_EXIT=0`: «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del `verify` sobre `2938439c`, copiado de su salida:
- **PASÓ:** harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («0 ROJO · 1 AMARILLO declarado(s)», el de `fx_rate_on` de la 0495), sql-tests («245 contrato(s) de SQL verificado(s) · rollback total», con `0495_fx_rates_conversor_usd.test.sql`), schema-rebuild («470 migraciones aplicadas desde cero») y build.
- **test, al reintento:** la primera corrida dio 1 rojo en `TransportistasPanel.test.tsx` («ante un error conserva lo escrito, enfoca el aviso y permite reintentar»), ajeno a esta SDD; el reintento dio `Tests  12121 passed | 1 skipped (12122)`.
- **e2e, al reintento:** la primera corrida dio 2 rojos y 6 flaky en `company-photo-carousel.spec.ts`, `calculadora-semantic-colors.spec.ts` y `auth.spec.ts:81`, que no tocan nada de esta SDD; el reintento dio `175 passed`, `3 flaky` (calculadora y carrusel en mobile-chrome) y `20 skipped`.
- **NO DISPONIBLE:** migrations-applied (el worktree no tiene `.env.local`). La 0495 es MIGRATE-FIRST y la aplica el Director.
- **Lectura de catálogo del Director (producción, 2026-10-20, sin filas de negocio):** `exchange_rate` activo en `audit_entity_types` y ningún CHECK sobre `entity_type` en `entity_audit_log`. El preflight pasa y el ajuste del fixture refleja producción.

## Impacto documental y conocimiento

La spec 0569 y el índice. **Cambia el esquema** (la 0495), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. **Hecho** con el turno del Director: el contrato en Docker, PGlite con los mutantes, las pruebas de la app, typecheck, eslint y `pnpm verify` (16/17 sin fallos).
1b. **Pedidos del Director (2026-10-20), hechos:** el aislamiento por tenant de `fx_rate_on` en la consulta y en la RLS, y la auditoría D2 sin la nota ni `set_by`, cada uno con su aserción y su mutante. El tipo `exchange_rate` existe vivo en producción: lo confirmó el Director con la lectura de catálogo.
2. PR en borrador y aviso al Director.
3. La previa de producción del Director (`tenant_fx_history` en 0 y `fx_rates`/`to_usd` ausentes) y el OK nominal de Sam NOMBRANDO `0495_fx_rates_conversor_usd`. Después, aplicar, hacer el smoke de la espera y fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **El día del documento es hoy en UTC** en `createInvoice` y `updateInvoice` (`new Date().toISOString().slice(0, 10)`): entre las 20:00 y la medianoche de Caracas toma la tasa del día siguiente. Es la 0570.
2. **`tenant_fx_history` queda sin uso.** Ni se lee ni se escribe; borrarla es una migración aparte, cuando el Director lo decida.
3. **`createInvoice` y `createBillFor` devuelven el texto de la base** en su error de insert («No se pudo crear la factura: …», «No se pudo crear la CxP: …»). Es anterior a esta SDD y choca con ERR-01.
