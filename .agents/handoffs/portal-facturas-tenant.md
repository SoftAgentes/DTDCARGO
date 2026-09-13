# portal-facturas-tenant — Las facturas del Portal quedan ligadas al tenant del principal (SDD-0462)

Fecha: 2026-09-13. Task ID: `portal-facturas-tenant`. Estado de tarea: lista-para-revision, publicada como PR en borrador. Estado SDD-0462: `done`, que no significa desplegada.
Owner / sesión escritora: `portal-facturas-tenant-20260913`, un subagente Worker lanzado por el Director. No hubo subagentes escritores propios.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`, sin ninguna escritura en el checkout principal.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-facturas-tenant`.
Rama: `codex/portal-facturas-tenant`. Base: `origin/main` `bca98147`, sin avances al cierre (comprobado con fetch). La reserva del Director (`cf03dad7`) entró por cherry-pick como `5009896b`.
SDD: `docs/specs/0462-portal-facturas-tenant/spec.md`, reservada por el Director y completada acá. Sin migración.

Permisos del encargo:
- **Autorizado:** commits locales selectivos, y publicar la rama y abrir la PR en borrador contra `main`.
- **Prohibido:**
  - merge, sacar la PR de borrador y deploy;
  - leer o escribir datos de producción, aplicar migraciones y tocar el ruleset;
  - borrar ramas o worktrees;
  - tocar los worktrees y ramas de las PR #104, #105 y #106;
  - escribir en el checkout principal.

Aceptación del encargo, en seis tareas:
1. Inventario de todo camino del Portal que lee facturas, más las otras lecturas de `portal-queries.ts` por Shipping Mark.
2. Arreglo: principal, tenant y Shipping Mark; PDF con el principal primero y el emisor de su tenant; el mismo 404; sin llamadas nuevas a `from("invoices")`.
3. Solapes con las PR abiertas.
4. Pruebas con control rojo y medición en PostgreSQL 17 + PostgREST efímeros.
5. Residual de RLS y recomendación.
6. Datos personales.

Dependencias: ninguna para integrar. La migración recomendada y la 0414 de la PR #106 son independientes de esta PR.

## OBJETIVO ORIGINAL

Cerrar en la capa de aplicación, sin migraciones, que un cliente del Portal pueda ver facturas de otra empresa que tenga un cliente con su mismo Shipping Mark: la lista, el detalle, el PDF y cualquier otro camino del Portal que lea facturas. Con inventario, pruebas con control rojo, medición en PostgreSQL 17 + PostgREST efímeros, análisis del residual de RLS con una recomendación para el Director y revisión de datos personales.

## COMPLETADO

### Arreglo (`5a640783`)

- **`lib/portal/portal-queries.ts`**
  - `listMyInvoices` (`:242`) y `getMyInvoice` (`:283`) resuelven `getPortalClientPrincipal`. Sin principal devuelven `[]` o `null` sin consultar `invoices`. Con principal filtran `tenant_id = principal.tenantId` (`:253` y `:308`) y `client_markbox = principal.client.markbox`, además de `neq borrador` y `deleted_at is null`.
  - `getMyInvoiceForPrincipal` (`:297`) es nueva: la lectura de detalle para quien ya resolvió el principal. `getMyInvoice` delega en ella.
  - No hay llamadas nuevas a `from("invoices")`: el archivo sigue con 2.
- **`app/portal/(app)/facturas/[code]/pdf/route.ts`**
  - El principal va primero (`:50`); sin él, 404.
  - La factura sale de `getMyInvoiceForPrincipal` (`:53`), el emisor de `principal.tenantId` (`:68`) y el Shipping Mark impreso del principal (`:77`).
  - Inexistente, ajena, borrador y sin principal responden el mismo `noEncontrado("Factura")`, sin construir el cliente admin.
- **`lib/studio/company-queries.ts`** (`:125` y `:132`): `getCompanyDataForTenant` filtra oficinas y cuentas bancarias por `tenant_id`.
  - Es una decisión propia. Se midió que el PDF, incluso el de la factura propia, imprimía las cuentas bancarias de todos los tenants: sin el filtro, «usar el tenant del principal para los datos del emisor» no se cumplía para las cuentas.
  - El impacto en el Studio está en la spec, sección «Datos del emisor».
  - Si el Director prefiere sacarlo a otra tarea, es el único cambio en `lib/studio`, y su prueba es el caso «el emisor y sus cuentas salen sólo del tenant del principal».
- **`app/portal/(app)/facturas/estado-de-cuenta/pdf/route.ts`**: solo el comentario de cabecera, que describía una protección por la RPC que ya no aplica.
- **Pruebas**:
  - `lib/portal/__tests__/portal-invoices-tenant-boundary.test.ts`, nueva, con 19 casos;
  - `invoices.test.ts`, que suma la aserción de tenant y cuyo stub ahora resuelve el principal;
  - `dashboard.test.ts`, que adapta su stub.

### Spec e índice (`4b52ac91` y `bbf9dac5`)

- **Spec** con contexto, inventario con archivo:línea, diseño, evidencia, riesgo residual, migración recomendada con su convergencia, datos personales, «Allowlist exacta», aceptación y producción.
- **Índice** regenerado con `node scripts/build-docs-index.mjs`: 440 specs, y solo se agrega la fila 0462.
- **Corrección** (`bbf9dac5`): el verify #1 detectó que la spec citaba `0414_invoices_read_rbac.sql`, que no está en main. Ahora nombra la migración de la PR #106 sin la extensión; la prueba de trazabilidad no se tocó.

### Inventario de lectores

El detalle con archivo:línea de main está en la spec.

| Camino | Cliente | En main | Con SDD-0462 |
|---|---|---|---|
| Lista, estado de cuenta en pantalla y Finanzas (`listMyInvoices`) | sesión | **expone** (medido) | cerrado |
| KPIs del inicio (`getDashboardKpis`) | sesión | **expone**: facturado 1277 en vez de 250 (medido) | cerrado |
| Detalle, comprobante y página de reportar (`getMyInvoice`) | sesión | **expone** nombre, RIF, montos y líneas (medido). La factura propia con código repetido en otro tenant daba 404 | cerrado |
| PDF de la factura | sesión y admin | **expone** el PDF de T2 con su emisor, y las cuentas de todos los tenants también en el PDF propio (medido) | cerrado |
| Estado de cuenta en PDF | sesión | **expone**: el libro incluía facturas de T2 (medido) | cerrado |
| Acción de reportar pago (archivo de la PR #104) | admin | no: tenant de la fila `clients` del cliente del principal | sin cambio |
| Aceptación de términos (página y acción), tarjeta de órdenes del inicio y botón del detalle de envío | admin | no: tenant de la fila `clients` del cliente del principal | sin cambio |
| RPC `get_portal_referral_program` (0404) | definer | no: principal con tenant | sin cambio |
| Rutas API del Portal | — | no leen facturas | — |
| Otras de `portal-queries.ts` por Shipping Mark: envíos, documentos, activación y próximo arribo | sesión | RLS por tenant desde 0416; sin exposición para el cliente puro (medido) | hallazgo, sin cambio |
| Reportes de pago (`listMyInvoiceReports`, archivo de la PR #104) | sesión | **expone**: RLS 0195 solo por Shipping Mark (medido) | hallazgo, otro dueño |

### Pruebas con control rojo

- **Primer rojo, antes de tocar producción** (`5009896b` más la prueba nueva sin commitear): 13 fallos por aserción y 6 verdes (`vitest-red-control.log`). Los verdes son los casos de principal inválido que main ya cortaba: sesión anónima, sin vínculo y vínculo revocado, en lectores y PDF.
- **Rojo final sobre la prueba commiteada** (`5a640783`): 15 fallos y 15 verdes (`rojo-final/vitest-rojo-final.log`). Son los 13 de la prueba nueva más las 2 aserciones de tenant de `invoices.test.ts`.
  - Los 4 archivos de producción se pusieron en su versión de `bca98147` y después se restauraron desde un respaldo.
  - `git diff --exit-code` dio 0 y el árbol quedó limpio.
- **Motivos de los rojos**:
  - la lista trae `F-T2-0009`;
  - los filtros no llevan `tenant_id`;
  - el detalle ajeno se entrega;
  - con el código repetido el detalle da `null`;
  - un vínculo incoherente o un cliente retirado leen facturas;
  - los KPIs dan 877 en vez de 100;
  - el PDF ajeno da 200;
  - `invoices` se lee antes que `client_users` (índice 6 frente a 1);
  - las cuentas incluyen `0001-T1` y `0002-T2`;
  - el libro del estado de cuenta suma 877.
- **Verde con el arreglo**: las 3 pruebas tocadas pasan (38 casos), y `lib/portal`, `app/portal` y `lib/studio` pasan completas (332 archivos, 4410 pruebas).

### Medición en PostgreSQL 17 + PostgREST 16.1 efímeros

- **Base**: el esquema de main se reconstruyó con el método de `scripts/check-schema-rebuild.mjs` (419 migraciones, PostgreSQL 17.11). La red era interna (`pft_net_int`) y PostgREST solo escuchaba en 127.0.0.1.
- **Adaptaciones**: `auth.uid()` lee los claims de PostgREST y el rol `authenticator` tiene login. No se tocaron policies ni funciones del producto.
- **Datos sintéticos**: T1 y T2 con el Shipping Mark `DTD-9901` y un vínculo Portal activo en T1.
- **Código**: se ejecutaron las funciones y rutas reales del worktree, con `lib/db/server` y `lib/db/admin` reales. `next/headers` fue un shim, y un proxy emuló `/auth/v1/user` verificando el JWT con el secreto de PostgREST.

| Lectura del cliente de T1 | Antes (main) | Después (SDD-0462) | Después, con la policy candidata |
|---|---|---|---|
| `listMyInvoices` | 4 facturas: 2 de T2 (250 y 777) | las 2 de T1 | igual |
| `getMyInvoice("F-T2-0009")` | la factura de T2 con nombre, RIF, total y líneas | `null` | `null` |
| `getMyInvoice("F-2026-0001")` | `null` (dos filas, PGRST116) | la de T1 | la de T1 |
| KPIs | facturado 1277 y 4 pendientes | 250 y 2 | 250 y 2 |
| PDF de `F-T2-0009` | 200; el admin lee `tenants?id=eq.T2` («Empresa ajena T2») | 404 igual al de inexistente y borrador, sin admin | 404 |
| PDF de `F-T1-0001` | 200; `company_bank_accounts` sin filtro trae `0001-T1` y `0002-T2` | 200; tenants, oficinas y cuentas con `tenant_id=eq.T1`, solo `0001-T1` | 200 |
| Estado de cuenta en PDF | libro con las 4 facturas | libro con las 2 de T1 | igual |
| PostgREST directo `GET /invoices` con el JWT del cliente | 4 filas | **4 filas: residual** | 2 filas, de T1 |
| PostgREST directo `GET /payment_reports` | 1 fila de T2 | 1 fila de T2 | 1 fila de T2 |
| Envíos y documentos | solo T1 | solo T1 | solo T1 |

Recibos fuera de Git, en el scratchpad: `env/results-{antes,despues,candidata}.json`, `env/proxy-{antes,despues}.json`, `env/proxy.jsonl` y `env/converge.log`. Contenedores `pft_db` y `pft_rest`, red `pft_net_int` y el proceso del proxy quedaron retirados; se verificó 0 contenedores, 0 redes y 0 puertos en escucha.

### Residual y recomendación

- **Residual**: la policy `invoices portal self read` de 0085 sigue comparando solo el Shipping Mark.
  - Con el JWT de su propia sesión, un cliente del Portal lee por PostgREST las facturas no borrador de otro tenant con su mismo Shipping Mark. Medido antes y después del arreglo.
  - `payment_reports` (0195) tiene el mismo problema hasta la 0420 de la PR #104.
- **Migración recomendada, no escrita en el repo**:
  - reemplaza solo esa policy, con el predicado **idéntico** al de 0414 (líneas 62-80 en la PR #106);
  - preflight que no dependa de la policy de equipo, postflight de forma como el de 0416, `lock_timeout` y `statement_timeout`;
  - número 0452 o mayor: entre 0400 y 0451 todos están usados o reservados.
- **Convergencia medida** con una candidata escrita solo en el entorno efímero:
  - en orden cronológico (candidata → 0407, 0411–0414), numérico (0407, 0411–0414 → candidata) y con la PR #106 sola, las tres terminan con el mismo catálogo de policies de `invoices` (md5 `345b2d10…`) y las mismas filas visibles;
  - el preflight de 0414 pasa después de la candidata.
- **Ajustes en la PR #106**: ninguno en el SQL. Sí en los textos: su espera en el baseline y la sección «Frontera del Portal al aplicar 0414», que con la candidata aplicada antes pasa a ser un no-op en la parte del Portal. Su prueba SQL no cambia.
- **Recomendación**:
  1. Integrar esta PR primero.
  2. Pedir a Sam el conteo agregado.
  3. Asignar el número de la migración de solo la policy Portal y aplicarla antes de L07, con contrato SQL y el mismo ensayo de convergencia.
  4. Si se espera a 0414, declarar el residual abierto en la PR #106.

### Datos personales (`revisar-datos-ve`)

- **4 ENCONTRADO**:
  - facturas de otro tenant en la app, grave (CRBV art. 28 y art. 60): corregido acá;
  - cuentas bancarias de todas las empresas en el PDF (minimización, SC 332/2001): corregido acá;
  - RLS 0085 por PostgREST: residual, con migración recomendada;
  - `payment_reports`: otro dueño, la PR #104.
- **1 CORRECTO**: el arreglo no agrega campos, logs ni tratamientos, y la medición usó solo datos sintéticos.
- **1 NO VERIFICABLE**: si la exposición ocurrió en producción. Hace falta el conteo agregado pendiente con Sam y, si es mayor que cero, registros de acceso con retención suficiente. No es asesoría legal.

## VALIDACIÓN

Sin credenciales copiadas ni `.env`. Entorno: Node 24.20.0, pnpm 12.3.4, Docker 29.7.2, PostgreSQL 17.11 y PostgREST 16.1. Los recibos quedan en temporales no durables: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\a4705ad7-612e-488b-9826-2cd036e3da72\scratchpad\portal-facturas-tenant\`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` | PASÓ. El primer `guard` falló porque el claim aún no estaba tomado; se reclamó y pasó antes de cada escritura y de cada commit. |
| `corepack pnpm install --frozen-lockfile` | PASÓ (21 s; `install.log`). |
| Control rojo inicial y final | HECHO, con los rojos esperados (ver «Pruebas con control rojo»). |
| Vitest focal: 3 archivos tocados, más `lib/portal`, `app/portal` y `lib/studio` | PASÓ: 38 pruebas (`vitest-verde-tocadas.log`) y 4410 pruebas en 332 archivos (`vitest-focal-despues.log`). |
| ESLint sobre los 7 archivos de código y pruebas | PASÓ, exit 0 (`eslint-focal.log`). |
| Typecheck completo | PASÓ tras corregir los tipos de la tabla de casos de la prueba nueva (`typecheck-focal-2.log`); la primera corrida falló por ese tipado (`typecheck-focal.log`). |
| Medición PostgREST antes, después y con la candidata | PASÓ (tabla de arriba). Una primera corrida del medidor abortó al transformar el propio script (top-level await en CJS), antes de cualquier request; se corrigió y se repitió completa. |
| Convergencia con 0414 | PASÓ: tres órdenes completos, catálogo idéntico (`env/converge.log`). |
| Retiro del entorno efímero | PASÓ: 0 contenedores `pft_`, 0 redes y 0 puertos 51885/51886 en escucha. |
| Inventario AST de `from("invoices")` | PASÓ: los 4 archivos de producción tocados mantienen su conteo (2, 0, 0 y 0), igual que el BASELINE de la PR #106 para el Portal; ninguna ruta nueva lee `invoices`. |
| `docs:index` / `docs:check` / `sdd:check` / `git diff --check` | PASÓ: 440 specs, sin números repetidos, sin espacios sobrantes. |
| Prueba `scripts/__tests__/spec-migration-refs.test.ts` tras corregir la cita de la spec | PASÓ, 5/5 (`vitest-spec-migration-refs.log`), y `docs:check` sincronizado. |
| `corepack pnpm verify` #1 sobre `4b52ac91` | **FALLÓ, exit 1**, de 04:15:56 a 04:35:57 (−04:00) (`verify.meta`, `verify.log`). `test` FALLÓ en sus dos intentos (6829 de 6830) por `scripts/__tests__/spec-migration-refs.test.ts`: la spec citaba `0414_invoices_read_rbac.sql`, que solo existe en la PR #106. Lo causó esta rama y se corrigió en `bbf9dac5`, sin tocar la prueba. `e2e` FALLÓ por entorno y `migrations-applied` quedó NO EJECUTADO. Los demás pasos PASARON. |
| `corepack pnpm verify` #2 sobre `bbf9dac5`, head de código final | **FALLÓ, exit 1**, solo por el `e2e` de entorno. Corrió de 04:38:06 a 04:55:27 (−04:00) (`verify-2.meta`, `verify-2.log`). Antes de lanzarlo no había otro verify ni e2e, y el árbol estaba limpio al inicio y al fin, con el mismo HEAD. Por paso: harness PASÓ (41); lint PASÓ (0 errores y 8 warnings, en archivos que no se tocaron); rsc-boundary PASÓ (1599 módulos); typecheck PASÓ; edge-functions PASÓ (4); test PASÓ (6830 pruebas en 544 archivos); docs:check PASÓ; numbering PASÓ; feature-constants PASÓ (5); components:check PASÓ; governance:check PASÓ; migrations-applied NO EJECUTADO (SKIP sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`); pending-migration-symbols PASÓ (0 ROJO · 0 AMARILLO); sql-tests PASÓ (180 contratos); schema-rebuild PASÓ (419 migraciones desde cero y barrido multi-tenant de 219 tablas); e2e FALLÓ; build PASÓ. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde. |
| Diagnóstico de `e2e` en el verify #2, sin volver a correrlo | FALLÓ por entorno. Fallaron los mismos 15 escenarios en las dos pasadas: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22`, en chromium, mobile-chrome y mobile-safari. El WebServer revienta en `proxy.ts:67` sin `NEXT_PUBLIC_SUPABASE_URL` ni `ANON_KEY` (210 trazas). Pasada 1: 153 pasados y 18 omitidos. Pasada 2: 151 pasados, 2 flaky (`auth.spec.ts:74` en chromium y `calculadora-semantic-colors.spec.ts:53` en mobile-chrome) y 18 omitidos. No hubo línea `watchdog:`, así que no se colgó. El diff no toca rutas públicas ni auth. |
| Huérfanos al cierre | PASÓ: sin contenedores `dtd_sqltest_*`, `dtd_rebuild_*` ni `pft_*`; sin procesos node de verify, Playwright, Next, Vitest, tsx ni del proxy; y sin puertos 3000, 3100, 3200, 51885 ni 51886 en escucha. |
| Tras el commit de este documento | NO EJECUTADO verify, a pedido del encargo: el commit solo agrega el handoff, como lo demuestra `git diff --stat bbf9dac5..HEAD` (salida en el reporte al Director y en la PR). |
| Allowlist de la spec contra `git diff --name-only origin/main...HEAD` | PASÓ: 10 rutas contra 10, una a una, con este handoff incluido; comprobado por script antes del commit de este documento. |
| `/ui-check` | NO EJECUTADO: no aplica, no hay cambio de UI ni de copy. |
| Producción: lectura de datos, conteo y migraciones | NO EJECUTADO: fuera de la autorización. |

## COMMITS

- `5009896b` — chore(sdd): reserva SDD-0462 (Director, cherry-pick de `cf03dad7`).
- `5a640783` — fix(studio): SDD-0462 — facturas del Portal ligadas al tenant del principal.
- `4b52ac91` — docs(sdd): SDD-0462 — spec e índice de facturas del Portal por tenant.
- `bbf9dac5` — docs(sdd): SDD-0462 — la spec nombra la 0414 de la PR #106 sin citarla como archivo del repo (corrige el `test` del verify #1).
- Commit que contiene este documento: docs(handoff) (hash final en la PR).

## PR / BRANCH

- **PR:** en borrador contra `main`, abierta después del único push de la rama. La URL y el SHA final van en la descripción de la PR y en el reporte al Director.
- **Rama:** `codex/portal-facturas-tenant`, publicada a sí misma, sin force. Worktree indicado arriba. Sin merge, sin salir de borrador y sin aplicar nada.

## PENDIENTES DE ESTA TAREA

- CI alojado sobre el head publicado y revisión del Director. El ruleset exige el check verde sobre el commit que se fusiona; sacar de borrador y fusionar le corresponde al Director.
- Ningún otro pendiente de la aceptación.

## FUERA DE ALCANCE DETECTADO

1. **Reportes de pago por Shipping Mark.** `listMyInvoiceReports` (`lib/portal/payment-report-queries.ts:78-79` en main; igual en el head de la PR #104) y la policy `payment_reports portal self read` (`0195_payment_reports.sql:119-125`).
   - Medido: en el detalle de `F-2026-0001` de T1 aparece el reporte de T2 (monto, método, fecha y nota).
   - La PR #104 trae la 0420 para la RLS, pero su lector sigue sin tenant.
   - Arreglo concreto: `getPortalClientPrincipal`, más `tenant_id` y `client_markbox` del principal en `listMyInvoiceReports`, dentro de la PR #104.
2. **Principal híbrido en envíos, documentos, activación y próximo arribo.** El caso es un usuario de equipo de T2 que además es cliente Portal de T1 con el mismo Shipping Mark.
   - La policy «by tenant» de T2 se suma por OR a la del Portal, y esos lectores filtran solo por Shipping Mark (`portal-queries.ts:173`, `:209`, `:340`, `:547` y `:699` en main). El Portal le mostraría envíos y documentos de T2.
   - Son datos que ya puede leer como equipo, pero fuera de contexto. No se midió.
   - Arreglo: el mismo filtro por principal; la PR #21 lo trae (SDD0391).
3. **Emisor del estado de cuenta en PDF.** `app/portal/(app)/facturas/estado-de-cuenta/pdf/route.ts:46` usa `getCompanyData` con sesión.
   - Para un cliente Portal puro el emisor sale vacío (la limitación de SDD-0298, que solo se corrigió en el PDF de la factura).
   - Para un híbrido podría salir el emisor de su tenant de equipo.
4. **Comentarios desactualizados** que atribuyen el aislamiento a «RLS por markbox»: `comprobante/page.tsx:5-6` y `:72-73`, `facturas/[code]/page.tsx:26-27` (archivo de la PR #104), `lib/portal/comprobante.ts:4` y `:47`, y `lib/studio/pdf/factura-pdf.tsx:11`. Además, la cabecera de la ruta del estado de cuenta nombra `?vista=estado`, pero el parámetro real es `?vista=cuenta` (`facturas/page.tsx:64`).
5. **Conflicto previsible con la PR #21.** Al extraer sus lotes del Portal, `lib/portal/portal-queries.ts` chocará en los dos lectores de facturas, aunque ambas versiones filtran igual por tenant.
   - Su ruta del PDF sigue usando `inv.tenantId`, y su `company-queries.ts` no filtra las cuentas.
   - Hay que conservar lo de esta PR.
6. **La lectura del backend del Norte existe.** Está en `docs/design/studio/_norte/backend/README.md`, junto con `API-CONTRACT.md`, y se leyó. El handoff de `aliados-cadena-tenant` la daba por inexistente porque buscó `_norte/backend/README.md` en la raíz.

## HANDOFF AL DIRECTOR

- **Orden seguro:**
  1. revisar la PR y su CI sobre el head publicado;
  2. fusionar sobre el SHA revisado, repitiendo antes el merge de main si avanzó;
  3. desplegar según política;
  4. después, decidir la migración de la policy Portal con el conteo de Sam.
- **Solapes con las PR abiertas:** con las PR #104, #105 y #106 el único archivo en común es `docs/specs/README.md`, el índice generado. `git merge-tree --write-tree` con base `origin/main` da exit 0, sin conflictos, contra las tres cabezas (`93f1cbed`, `f555f5eb` y `c09b5155`). No se tocan `facturas/[code]/page.tsx`, `_components/InvoicePaymentReports.tsx`, `reportar/*` ni `lib/portal/payment-report-*`. Si otra PR entra antes, hay que regenerar el índice con el script.
- **Inventario congelado de la PR #106:** mi cambio no lo altera. `lib/portal/portal-queries.ts` sigue con 2 llamadas, las rutas del PDF con 0, y no aparece ningún archivo nuevo.
- **Contenedores y procesos:** `pft_db`, `pft_rest`, la red `pft_net_int` y el proxy quedaron retirados. Los `dtd_sqltest_*` y `dtd_rebuild_*` del verify los retiran sus scripts. No se tocó el stack `dtd-pr28-auth-*` ni ningún proceso ajeno.
- **Preview:** el último commit del push solo trae el handoff, así que el `ignoreCommand` de Vercel puede cancelar su preview. No afecta la validación de arriba, ni el deploy de `main` al fusionar, porque el merge se compara con el `main` anterior.
- **Producción:** sin lecturas ni escrituras. Sigue pendiente el conteo agregado con Sam.
- **Ownership:** se libera al cierre con `node scripts/harness-worktree.mjs release --owner portal-facturas-tenant-20260913`, después de la última escritura. El worktree y la rama se conservan.
