# Handoff · SDD-0569 · Un solo conversor a USD, que falla cerrado, y una tabla de tasas con fuente y fecha

## Relevo Codex y reparación de revisión · 2026-10-20

El Director asignó esta reparación después de pausar formalmente 0572-a en
`9c254107`. Sam autorizó pausar Claude y adoptar el worktree existente. Se
comprobaron raíz, rama, árbol limpio y ausencia de procesos consumidores; el
Director liberó el claim anterior. Codex reclamó
`codex-0569-01a15a4e-ddf0`, validó guard y avanzó exclusivamente con ff-only de
`3d0c9028` a `e6579944c5bfdc5c4addf23a59fa477f3219db7b`.
`node_modules` es local, sin junction; no se copiaron secretos.

Estado actual: **reparación implementada y validada localmente, lista para revisión del Director**, con la allowlist de **39 rutas** de la spec:
38 originales y la prueba `update-invoice-conserva-embarque.test.ts`, ampliación
autorizada por el Director para representar la confirmación del UPDATE
condicional sin perder sus aserciones de embarques ni totales.
La evidencia histórica de abajo no valida estos cambios. El Director autorizó
ajustar la 0495 todavía no aplicada, sus contratos/símbolos/espera y documentación.
Commits selectivos, push de esta rama y actualización del borrador #301 están
autorizados. Merge, deploy, DB real y lecturas de negocio: **NO AUTORIZADOS**.

Alcance: distinguir fuente del catálogo de override documental explícito;
detectar ediciones concurrentes antes de emitir o guardar; limpiar tasa al
cambiar moneda; rechazar tasas que redondeen a cero en numeric(20,8). Este
último es un borde preexistente, no un defecto atribuido al merge.
La referencia histórica a “0570 = hora de Caracas” queda corregida: 0570 es
PGlite; hora de Caracas sigue sin número asignado.

Diseño de concurrencia: `write_version` de factura se incrementa en cada UPDATE
por trigger; la acción compara la versión leída y comprueba una fila afectada
antes de asiento/correo. Esto cubre todos los datos usados por esas operaciones.
`updated_at` usa `now()` de transacción y no garantiza distinguir dos UPDATE
dentro de la misma transacción.

Precisión autorizada por delegación del Director: la emisión automática VES
requiere una tasa cuya fecha sea exactamente la de emisión. Un catálogo con
una tasa anterior no basta. CNY, borradores y CxP conservan el resolver histórico.
El override documental explícito se mantiene. §9 del plan ya fija BCV oficial,
carga diaria y respaldo manual; implementar la carga y concretar su operación
queda fuera de esta tarea. La reparación cambia SQL de 0495. El Director
comunicó que reconstruyó el paquete desde `5f0d04ad`; conserva a su cargo la
previa vigente y el OK nominal de Sam. El Worker no aplicó la migración.

### Evidencia de la reparación actual

El Director devolvió el turno exclusivo después de terminar la medición de #304.
Se comprobaron guard/HEAD, ausencia de procesos pesados previos y ausencia de
`.env.local`, URL Supabase y service key. El producto permaneció en `e6579944`
mientras se añadían las regresiones. Los diez archivos preparados fuera del
árbol se aplicaron solo después del rojo, comprobando antes sus SHA-256.

| Comprobación | Resultado actual |
|---|---|
| Rojo de app sobre producto `e6579944` | **PASÓ como control rojo:** 24 fallos de aserción y 19 casos que ya pasaban, en facturas, drawer y CxP. Ningún fallo de importación/setup |
| Rojo SQL con 0495 anterior y contrato nuevo | **PASÓ como control rojo:** falla en «facturas y CxP distinguen override explícito, false por defecto» |
| Primera focal verde | **FALLÓ:** 87 pasaron y dos cambios de moneda conservaron el valor interno de NumericInput. Corregido con `key={currency}` en el campo del drawer, sin cambiar el componente compartido |
| Focal corregida de app | **PASÓ:** 6 archivos, 89 pruebas, incluidas intercalaciones reales guardar/emitir en ambos sentidos, edición de importes/destinatario sin cambiar moneda, catálogo manual frente a override y límites de captura |
| SQL en PGlite | **PASÓ:** 32 pruebas; contrato, control sin 0495, 26 mutantes, preflights de historia/instalación parcial y reaplicación. El contrato prueba dos UPDATE en una transacción, versión enviada por cliente y escritura RLS autenticada |
| Mutantes adicionales de app | **PASÓ:** 13/13 muertos por aserciones; 13/13 archivos restaurados y comprobados por SHA-256 |
| Recuperación visual del drawer | **FALLÓ y corregido:** con una tasa faltante, React reiniciaba el selector visible a USD aunque el estado seguía en CNY. Reproducido también en Vitest. Se cancela el reset con listener nativo local del formulario; `onReset` sintético no bastó durante el commit de React. Focal final: 89/89 |
| Typecheck y lint | **PASÓ:** typecheck completo; ESLint de archivos TS/TSX modificados con cero warnings. Se repitieron después de la corrección visible del drawer |
| Gates documentales y símbolos | **PASÓ:** índice regenerado/sincronizado con 556 specs, numeración sin colisiones nuevas, candado 486 selladas/3 esperas/0 nueva sin sellar, diff-check limpio. Símbolos: 0 rojo, 1 amarillo declarado (0495), 3 homónimos descartados |
| `corepack pnpm verify` sobre `5f0d04ad0749df5aa79c3a3f4635e83ce2c1eeae` | **PASÓ lo medido, cierre canónico incompleto explícito:** exit 0, 14/17 pasos, del 2026-10-20 18:44:21Z al 19:15:07Z. `migrations-applied`, `sql-tests` y `schema-rebuild` se omitieron; los dos últimos se ejecutaron después y se detallan abajo. Incluyó build de producción |
| Unitarios dentro de verify | Primera corrida **FALLÓ:** timeout de 20 s en `supplier-flow.test.tsx` («supports correction and append-only resubmission without clearing the form»), 12.276 aprobados/1 fallo/1 omitido. Reintento automático **PASÓ:** 12.277 aprobados/1 omitido, 860 archivos aprobados/1 omitido. No se cambió el portal ni su timeout |
| Navegación dentro de verify | **PASÓ:** 176 aprobados, 2 flaky recuperados (carrusel visual Chromium y selector calculadora mobile-chrome), 20 omitidos. Servicio Supabase sintético deny-only local; no prueba de datos reales |
| Contratos SQL posteriores sobre el mismo SHA | **PASÓ:** PostgreSQL 17 local, 246 contratos incluida 0495, rollback total. Del 19:15:50Z al 19:18:06Z; `sql-tests-5f0d04ad.log` y `sql-tests-result.json` |
| Reconstrucción posterior sobre el mismo SHA | **PASÓ:** 471 migraciones desde cero, 18 sólo-ledger verificadas, aislamiento de 219 tablas con dos tenants sintéticos y radiografías de integridad/referidos. Del 19:18:19Z al 19:18:57Z; `schema-rebuild-5f0d04ad.log` y `schema-rebuild-result.json` |
| Ledger productivo | **NO DISPONIBLE** en el Worker: sin URL/key de producción. Es validación de release del Director; no se aplica DB para poner verde la PR |
| UI visible del drawer | **PASÓ en alcance local:** Chrome y revisión independiente IAB del Director, componente y CSS reales, datos sintéticos y acciones mock. VES→CNY limpia la tasa; al guardar sin tasa, mensaje junto al campo y selector CNY conservado. Capturas `drawer-cny-error-local.png` y `director-cny-error-local.png` fuera de Git. No certifica persistencia real ni fidelidad tipográfica de la app completa |
| Graphify, Archify y preview Obsidian | **NO EJECUTADO** para esta reparación, por coordinación expresa del Director al devolver el turno a 0571. Sólo se consultó `knowledge:status` en lectura; los derivados se cerrarán coordinadamente desde main después de integración |
| Diagnóstico `knowledge:status --preview` | **FALLÓ como estado de conocimiento (`ok: false`):** Graphify 0.9.61 sin `graph.json`, estructura INVALID/4.974 fuentes pendientes, semántica local 0/16 del piloto y 0/1.322 global; Archify y preview PENDING. No es una pérdida medida del grafo de main, sino ausencia de derivados en este worktree |
| Producción, migración aplicada, merge y despliegue | **NO EJECUTADO**, fuera de autorización Worker |

Los logs y el runner reproducible de los mutantes se conservan fuera de Git en
`C:/tmp/director-traspaso-20261020/0569-codex-validation/`. El verify original
conserva sus tres SKIPs: las corridas SQL complementarias no reescriben ese
resultado. La evidencia conjunta cubre los 16 pasos locales; el ledger sigue
separado como release. La omisión unitaria corresponde al corpus real externo
de proformas; las 20 omisiones E2E son escenarios que requieren seed/credenciales
de prueba. No se solicitaron datos comerciales ni secretos para ejecutarlos.
Lint canónico pasó con 15 warnings generales; el lint focal de los archivos
modificados pasó con cero warnings.

Docker estaba instalado (Desktop 4.96.0, motor 29.9.1), pero apagado y sin el
pipe `dockerDesktopLinuxEngine`. Se inició oculto sólo después de verify,
con autorización del Director. Imagen local `postgres:17`, digest
`sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`.
Los contenedores propios `dtd_sqltest_242b7664` y `dtd_rebuild_242b7664`
fueron retirados; los cuatro ajenos permanecieron detenidos y sin cambios.
Docker volvió a estado detenido con su CLI oficial, exit 0; se comprobaron
cero procesos de prueba y cero procesos Desktop/backend/proxy antes de devolver
el turno. Evidencias: `docker-start.json`, `docker-cleanup.json`, `docker-stop.log`.

Ninguna de esas pruebas constituye evidencia del servidor de producción. La precisión de VES usa
la fecha de emisión actual de la app (UTC); no certifica aún la futura
unificación a Caracas. Se corrigieron los comentarios de la migración para
no afirmar esa unificación.

### Cierre actual y entrega al Director

**OBJETIVO ORIGINAL:** reparar procedencia, carreras guardar/emitir y bordes de
captura de la SDD-0569, conservando la separación de 0572 y MIGRATE-FIRST.

**COMPLETADO:** los dos P1 y los bordes asignados, pruebas de regresión,
mutantes, contrato SQL, validación local y revisión visible sintética. El
commit de implementación es `5f0d04ad0749df5aa79c3a3f4635e83ce2c1eeae`;
este cierre documental no modifica producto, pruebas ni SQL.

**VALIDACIÓN:** matriz anterior; evidencia exacta por SHA y por corrida fuera de
Git. Ninguna omisión se presenta como una prueba aprobada.

**COMMITS:** implementación `5f0d04ad` sobre `e6579944`; el commit documental
que contiene este cierre conserva el mismo blob SQL
`c6d17d946d957a29791fec426a1213a05efa7bf4` y SHA-256
`964abe064db544ac2b6f19592a24d3d45d6bef68c0ffa2e1e43279d2b20e8ab7`.

**PR / BRANCH:** [#301](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/301),
en borrador; `codex/sdd-0569-conversor-usd-tasas`. El SHA documental final se
confirma al Director después del push explícito a la misma rama.

**PENDIENTES DE ESTA TAREA:** revisión y CI del SHA documental final;
previa vigente, OK nominal de Sam y secuencia MIGRATE-FIRST a cargo del
Director; posterior integración/despliegue y recorrido real según sus permisos.
No queda una reparación de producto conocida pendiente dentro de la asignación.

**Impacto documental y conocimiento:** spec y este handoff guardan las decisiones
autorizadas y la evidencia. La integración en main sigue pendiente. La estructura
Graphify, cobertura semántica, mapa Archify 2.16.0 y exportación preview no se
actualizaron en este turno por instrucción del Director. Ninguna de las 16 fuentes
del piloto semántico cambió en esta reparación; eso no certifica un grafo ausente
ni la semántica global. `knowledge-status-before.json` conserva el diagnóstico
en lectura. Publicación compartida y revisión visible en Obsidian:
**NO EJECUTADO**. El Director coordina esas capas después de integrar; el Worker
no escribió la bóveda compartida.

**FUERA DE ALCANCE DETECTADO:** intermitencias observadas del portal y de los dos
casos E2E recuperados, sin causa raíz nueva demostrada ni cambios en sus áreas.
La carga automática BCV, hora Caracas y reemplazos de reportes 0572 permanecen
entregas separadas; no se reabre la decisión de fuente BCV ya fijada en §9.

**HANDOFF AL DIRECTOR:** turno pesado devuelto explícitamente tras limpiar los
recursos propios. La escritura se limita al cierre documental autorizado; al
terminar push y comprobación de estado se libera el claim
`codex-0569-01a15a4e-ddf0` y se comunica el resultado. No se aplicó 0495, no se
fusionó main ni se desplegó.

## Antecedente fechado de la sesión anterior

El siguiente registro conserva lo medido antes del relevo; sus SHAs y resultados
no cubren la reparación actual ni constituyen autorización de producción.

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

La 2.1 del plan contable, primera parte: la tabla `fx_rates` (fuente, fecha de valor, quién) y un conversor canónico a USD que falla cerrado (nunca 0 ni el monto tal cual), con USDT = USD 1:1 (decisión 1 de Sam). Los 13 reemplazos van en la SDD siguiente; la hora Caracas continúa sin número asignado (0570 es PGlite); la carga BCV es otra entrega.

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
| **Merge de main con la #303** (`eafbd910`, que sella la 0494), opción (a) del Director: sin repetir el verify | merge limpio (`b68761e4`). pending-symbols «0 ROJO · 1 AMARILLO declarado(s)» (solo la 0495); migrations-lock «486 selladas (la mayor: 0494) · 3 espera(s)… · 0 nueva(s) sin sellar»; numbering sin repetidos; docs:check con 556 specs; `credito-referido-candado.migration.test.ts` y `fx-rates-conversor.migration.test.ts`: `Test Files  2 passed (2)`, `Tests  77 passed (77)` |
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

1. **El día del documento es hoy en UTC** en `createInvoice` y `updateInvoice` (`new Date().toISOString().slice(0, 10)`): entre las 20:00 y la medianoche de Caracas toma la tasa del día siguiente. La unificación de hora Caracas sigue sin número asignado; 0570 corresponde a PGlite.
2. **`tenant_fx_history` queda sin uso.** Ni se lee ni se escribe; borrarla es una migración aparte, cuando el Director lo decida.
3. **`createInvoice` y `createBillFor` devuelven el texto de la base** en su error de insert («No se pudo crear la factura: …», «No se pudo crear la CxP: …»). Es anterior a esta SDD y choca con ERR-01.
