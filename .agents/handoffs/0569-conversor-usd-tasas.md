# Handoff · SDD-0569 · Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0569-conversor-usd-tasas` |
| Rama | `codex/sdd-0569-conversor-usd-tasas`, desde `origin/main` `88b36c7a`, con main mezclado después (`d50aa3e7`, la #298) |
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

**Después de la revisión de seguridad** (turno de máquina del Director):

| Comprobación | Resultado |
|---|---|
| Contrato 0495 en PostgreSQL 17 | «TEST 0495 GREEN: 45 aserciones» |
| `fx-rates-conversor.migration.test.ts` (PGlite) | `Tests  27 passed (27)`, con 22 mutantes («mutantes: 22 · con from no único: 0») |
| Mutantes de la app (`mutantes-0569-app.cjs`, restaurados por copia con la huella sha256) | `MUERTOS 19/19 · restaurados 19/19` |
| Pruebas de las áreas tocadas (facturación, admin, contabilidad, gastos, tesorería, móvil, `lib/shared`, `fx-rates`, `invoice-types`, `NumericInput`, RBAC) | `Test Files  63 passed (63)`, `Tests  1319 passed (1319)` |
| `typecheck` y eslint `--max-warnings=0` | `tsc=0`, `eslint=0` |
| pending-migration-symbols | «0 ROJO · 2 AMARILLO declarado(s)» (0494 y 0495) |
| migrations-lock, docs:check | 4 esperas, «0 nueva(s) sin sellar»; índice con 555 specs |
| **`pnpm verify` sobre `27d17587`** (de 13:56:06Z a 14:35:05Z) | `VERIFY_EXIT=1`: «1 fallo(s) → test», más migrations-applied NO DISPONIBLE (sin `.env.local`). Los demás pasos, PASÓ: sql-tests «246 contrato(s) de SQL verificado(s)», schema-rebuild «471 migraciones aplicadas desde cero», e2e `177 passed`, `1 flaky`, y build. El paso test dio 2 rojos en las dos corridas: `env-example-contract` (`expected [ 'TZ' ] to deeply equal []`) y un timeout de 20 s en `app/p/[token]/supplier-flow.test.tsx`, una prueba distinta en cada corrida |
| La causa de `env-example-contract` | **MÍA:** `ExpenseDrawer.fecha-tasa.test.ts` leía `process.env.TZ`, y el contrato exige documentar toda variable que el código lee. Corregido en `bc8f4a62` con `vi.stubEnv("TZ", …)`; el mutante de la fecha sigue muriendo (`Tests  1 failed | 1 passed (2)`, archivo restaurado por huella) |
| `supplier-flow.test.tsx` sola | `Tests  23 passed (23)`. La rama no toca `app/p` (`git diff --stat origin/main -- app/p` vacío): es un timeout del portal bajo carga, ajeno |
| **Paso `test`, veredicto** (el Director, 2026-10-20) | **FALLÓ en la primera vuelta por un defecto propio, corregido en `bc8f4a62`; la vuelta siguiente quedó con un único rojo ajeno (timeout en `app/p`).** No es PASÓ. El Director dio por bueno el cierre de la 0569 con este veredicto |
| **`vitest run` completo sobre `bc8f4a62`** (de 14:37:28Z a 14:46:44Z) | `Tests  1 failed | 12215 passed | 1 skipped (12217)`. `env-example-contract` ya pasa. El único rojo es otro timeout de 20 s del portal, ahora en `app/p/[token]/standard-format.test.tsx`; sola da `Tests  7 passed (7)` |

**Antes de la revisión:**

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

## REVISIÓN DE SEGURIDAD DEL DIRECTOR (2026-10-20, sobre `cc6e7333`)

El Director mandó 2 bloqueantes, 5 importantes, 7 menores y un NO VERIFICADO. **Cada escenario se confirmó con una prueba en rojo antes de corregirlo**, y cada corrección tiene su mutante. El detalle, hallazgo por hallazgo, está en la spec (*Revisión de seguridad del Director*).

Rojos confirmados antes de corregir:
- **Contrato en Docker**, uno por vuelta, en este orden:
  - «el tope es el mismo que en TS: |monto| < 1e12» (12);
  - «una tasa con más de 8 decimales se rechaza» (14);
  - «una tasa se puede borrar» (B1: ningún DELETE funcionaba);
  - «la tasa de facturas y CxP es numeric(20,8), como fx_rates» (6).
  - Los casos espejo de medio centavo ya daban bien en SQL.
- **`fx.test.ts`:**
  - `expected { ok: true, usd: 2.17 } to deeply equal { ok: true, usd: 2.18 }` (5);
  - un monto vacío daba `{ ok: true, usd: +0 }` (12).
- **`fx-rates.test.ts`:** 3 rojos, la procedencia (3) y `ultimaTasa` (10). Después, otro por los 8 decimales (14).
- **`factura-congela-la-tasa.test.ts`:** 6 rojos.
  - editar: la procedencia y el paso a USD (3);
  - emitir: re-resolver la tasa y no emitir sin ella (4);
  - duplicar: la tasa propia y no consumir correlativo (4).
- **`cxp-congela-la-tasa.test.ts`:** `expected 7.123456789 to be 7.12345679` (6).
- **`InvoiceDrawer.tasa.test.tsx`:** 3 rojos (B2).
- **Admin › Tasas:** 3 rojos, el módulo pedido (NO VERIFICADO), los 8 decimales (14) y la nota (11).
- **`ExpenseDrawer.fecha-tasa.test.ts`:** 1 rojo (8).

**La decisión sobre el NO VERIFICADO:** la acción pide el módulo de Contabilidad (admin y accounting), igual que la RPC, y la misma sección está también en Contabilidad › Tasas de cambio. La contadora no entra a Admin.

**Lo que no lleva prueba propia:** `step="any"` del móvil (9) es un atributo; no hay prueba de render del gasto móvil.

## Impacto documental y conocimiento

La spec 0569 y el índice. **Cambia el esquema** (la 0495), así que el Director tiene que publicar Graphify y Archify después de integrarla.

## PENDIENTES DE ESTA TAREA

1. **Hecho** con el turno del Director: el contrato en Docker, PGlite con los mutantes, las pruebas de la app, typecheck, eslint y `pnpm verify` (16/17 sin fallos).
1b. **Pedidos del Director (2026-10-20), hechos:** el aislamiento por tenant de `fx_rate_on` en la consulta y en la RLS, y la auditoría D2 sin la nota ni `set_by`, cada uno con su aserción y su mutante. El tipo `exchange_rate` existe vivo en producción: lo confirmó el Director con la lectura de catálogo.
2. PR en borrador y aviso al Director.
3. La previa de producción del Director (`tenant_fx_history` en 0 y `fx_rates`/`to_usd` ausentes) y el OK nominal de Sam NOMBRANDO `0495_fx_rates_conversor_usd`. Después, aplicar, hacer el smoke de la espera y fusionar.

## FUERA DE ALCANCE DETECTADO (para el Director)

- **Timeouts del portal de proveedores bajo carga** (`app/p/[token]/supplier-flow.test.tsx`, `standard-format.test.tsx`): con la suite completa, una prueba distinta pasa los 20 s en cada corrida; solas pasan. Hay que subirles el timeout o aliviar su montaje, como ya se hizo en otros archivos.
- **Fidelización › Referidos, estado vacío** (el Director, 2026-10-20): dice «El crédito se acredita a mano cuando hace su primer embarque». Con la 0250 y la 0494, se acredita **solo** con la primera venta real posterior al alta, y a mano únicamente el admin, con motivo. Va en una SDD chica de Fidelización, o en la próxima que toque esa pantalla.

1. **El día del documento es hoy en UTC** en `createInvoice` y `updateInvoice` (`new Date().toISOString().slice(0, 10)`): entre las 20:00 y la medianoche de Caracas toma la tasa del día siguiente. Es la 0570.
2. **`tenant_fx_history` queda sin uso.** Ni se lee ni se escribe; borrarla es una migración aparte, cuando el Director lo decida.
3. **`createInvoice` y `createBillFor` devuelven el texto de la base** en su error de insert («No se pudo crear la factura: …», «No se pudo crear la CxP: …»). Es anterior a esta SDD y choca con ERR-01.
