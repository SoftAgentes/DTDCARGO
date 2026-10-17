# Portal — reportes de pago y aceptación por principal y tenant (SDD-0390 y SDD-0397)

Task ID: `portal-reportes-principal-0390-0397`. PR **#114**, en borrador: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/114.
Este documento tiene dos rondas. La vigente es la 2 (retoma del 2026-10-17). La 1 (extracción del 2026-09-14) queda abajo como evidencia fechada; sus SHA, conteos y líneas describen la rama de ese día.

## Ronda 2 — retoma del 2026-10-17 (vigente)

- **Owner / sesión escritora:** `worker-pr114-retoma-20261017`, Worker lanzado por el Director como subagente de Claude Code. Sin otras sesiones escritoras ni subagentes en este árbol.
- **Estado de tarea:** lista-para-revision. La PR sigue en borrador; el Director revisa y fusiona con el OK de Sam.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-a4c67afc698ae349c`.
- **Rama local:** `codex/portal-reportes-0390-0397-retoma`. La creé sin upstream desde `origin/codex/portal-reportes-principal-0390-0397` (`1b3a8c7bd74aaaad99f57c466177f0127c16058e`). Se publica sobre la rama remota de la PR, sólo con fast-forward.
- **Worktree de la ronda 1, sin tocar:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-reportes-principal-0390-0397`. Su rama local `codex/portal-reportes-principal-0390-0397` sigue en `b071a90f`, limpia y atrasada respecto del remoto. No hice checkout de esa rama ni la moví.
- **Base:** `origin/main` = `c2fabdcc17e3ca28c62238764a82aa46ca515cca` (merge de la PR #263), leído con `git fetch origin` al empezar. Base anterior de la rama: `419d25983357504723af4948b3bf867382888145`.
- **SDD:** 0390 y 0397, sin cambios en esta ronda. Sin migración.
- **Autorización:** encargo del Director del 2026-10-17. Cita a Sam, literal, al Director: «arranca también la de la PR 114». Antes Sam había decidido: «ok, retomamos la #114 después del jueves». Son palabras de Sam al Director, no a esta sesión; registro el texto a su nombre.
  - **Cubre:** merge normal de `origin/main` en la rama, push fast-forward (nunca force) a la rama remota de la PR, dejarla en borrador y comentar el resultado.
  - **No cubre:** fusionar a `main`, que publica en producción solo, a los ~5 min. Tampoco cubre producción, el servidor, la base de prueba ni leer datos de negocio.

### OBJETIVO ORIGINAL

Poner la PR #114 al día con `main` después del corte a Contabo. Pasos:

1. Traer `origin/main` con un merge normal.
2. Comprobar que las specs 0390 y 0397 siguen describiendo lo que hace el código.
3. Revalidar con pruebas focales y con un solo `pnpm verify`.
4. Empujar con fast-forward y dejar la PR en borrador para que el Director la revise.

### COMPLETADO

- **Aislamiento.** `guard` OK y `claim` adquirido con el owner de arriba. Revalidé el guard y la rama antes de cada commit y antes del push. No toqué el checkout principal, `main`, el worktree de la ronda 1 ni otros worktrees.
- **Dependencias.** `corepack pnpm install --frozen-lockfile` (pnpm 12.3.4). No copié `.env` ni credenciales.
- **Merge `e9378d3a`.** `git merge --no-ff origin/main` sobre `1b3a8c7b`, **sin conflictos**.
  - Main avanzó 684 commits (contando merges) desde la base anterior `419d2598`. Ninguno toca los 11 archivos de la PR: el único cambio de main bajo `aceptar/` es `page.tsx`, que no está en la PR.
  - Después del merge, el árbol difiere de `origin/main` en esos 11 archivos y en nada más: 426 inserciones y 55 borrados, el mismo diff que antes del merge.
  - `docs/specs/README.md` no tuvo conflicto ni cambio, porque las specs 0390 y 0397 conservan su frontmatter. No hizo falta regenerarlo: `docs:check` lo da sincronizado con 531 specs.
  - No hubo que resolver ningún conflicto a mano.
- **Choques con la PR #260 (SDD-0543), revisados uno por uno. Ninguno rompe esta PR:**
  - `lib/portal/portal-legal-queries.ts`: `getPendingAcceptanceInvoice` agrega `embarques` al resultado y hace una lectura de `shipments` scopeada por `tenantId`. La firma `(admin, { tenantId, markbox, code })` no cambió, así que `aceptar/actions.ts` la llama igual que antes, con el tenant y el Shipping Mark del principal. La acción no usa `embarques`. Los mocks de sus pruebas no lo necesitan, y typecheck pasa.
  - `app/portal/(app)/facturas/[code]/aceptar/page.tsx`: muestra la medida **sumada** de los embarques con `medidaDeLaFactura`. La acción sigue sellando `order.cbm`/`order.weightKg`, que es la medida del primer envío, exactamente como en `main`. La spec 0543 lo declara «limitación conocida que se decide aparte» (`docs/specs/0543-consolidados-en-camino/spec.md:97`). Esta PR no cambia esa decisión.
  - `lib/portal/pending-acceptance.ts` (nuevo) no importa nada de los archivos de esta PR.
  - `app/portal/(app)/facturas/[code]/page.tsx` sigue llamando `listMyInvoiceReports(supabase, code)` con la misma firma, y su prueba nueva (`page.test.tsx:35`) la mockea.
  - `app/portal/(app)/page.tsx:58` sigue llamando `listMyRecentActivity(supabase)`, y `page.test.tsx:54` la mockea.
- **SDD-0530: las notas de zarpe y arribo siguen visibles.** El evento de la 0477 se inserta con `tenant_id` (`0477_naviera_zarpe_avanza_envios.sql:455-457`). Todos los insertores de `shipment_events`, en SQL y en TypeScript, ponen `tenant_id`, y la columna es `not null` (`0002_shipments.sql:66`). Por eso el filtro de 0390 por el tenant del evento y del envío no oculta esas notas en el Portal.
- **Las specs siguen vigentes.**
  - `getPortalClientPrincipal` (`lib/portal/portal-queries.ts`) no cambió en main desde la base anterior. `reportar/actions.ts` y `payment-report-commands.ts` tampoco.
  - Los contratos de 0390 (tres lecturas por principal, corte temprano, tenant + Shipping Mark) y de 0397 (principal antes del admin, sin releer `clients`, cancelación con principal) describen el código mezclado tal cual.
  - No hubo que ajustar ninguna prueba.
  - Las notas de extracción del 2026-09-14 en ambas specs siguen siendo ciertas como relato fechado. No las edité.
- **Control rojo.** Puse temporalmente las versiones de `origin/main` de los 3 archivos de producto. Resultado: 13 de 48 pruebas fallan en los 5 archivos afectados, entre ellas las 4 de `portal-read-principal-scope` y las 2 de aceptación de `portal-invoice-actions-principal-scope`. Restauré los archivos desde HEAD y el árbol quedó limpio. Las pruebas siguen detectando la falta del código de 0390 y 0397 después del merge.

### VALIDACIÓN

Sin credenciales ni `.env`. No corrí nada contra producción, el servidor ni la base de prueba, y no leí ninguna fila. Los recibos quedaron fuera de Git, en el scratchpad de la sesión (`verify-e9378d3a.log`, `vitest-focal.log`, `typecheck.log`).

| Comprobación | Resultado / alcance |
|---|---|
| `guard` / `claim` | PASÓ; revalidado antes de cada commit y del push |
| Merge de `origin/main` | PASÓ: sin conflictos; el árbol difiere de `origin/main` sólo en los 11 archivos de la PR |
| `corepack pnpm exec vitest run lib/portal app/portal` (sobre `e9378d3a`) | PASÓ: 96 archivos / 1224 pruebas |
| Los 6 archivos de prueba de la PR, en modo detallado | PASÓ: 75 pruebas (`payment-reports`, `shipment-events`, `portal-read-principal-scope`, `portal-invoice-actions-principal-scope`, `payment-report-consumers` y `aceptar/__tests__/actions`) |
| Control rojo con los 3 archivos de producto de `main` | PASÓ como control: 13 fallos esperados; árbol restaurado |
| `corepack pnpm typecheck` | PASÓ (exit 0) |
| ESLint de los 8 archivos de código y pruebas de la PR | PASÓ (exit 0, 0 problemas) |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 531 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos (sólo los choques históricos exentos 0342, 0363 y 0394) |
| `git diff --check origin/main...HEAD` | PASÓ |
| Turno antes de verify | `Get-CimInstance` no estuvo disponible: el aislamiento del agente bloquea `powershell.exe`, y `wmic` ya no existe en este Windows. Lo sustituí por `tasklist`: ningún `node.exe` pasaba de 130 MB ni tenía CPU de corrida, y no había `chrome-headless-shell`. Además, ningún contenedor Docker corriendo y los puertos 3100–3109 libres (17:47Z). Sin línea de comando no puedo afirmar más |
| **`E2E_PORT=3107 corepack pnpm verify` sobre `e9378d3a`** | **Sin fallos en lo medido, con cierre incompleto.** Exit 0. Corrió de 17:47:57Z a 18:05:57Z (13:47 → 14:05 en Caracas), unos 18 min, con el árbol limpio al inicio y al final. 16 de 17 pasos PASÓ y `migrations-applied` quedó NO DISPONIBLE. Veredicto literal: `verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17); exit 0 NO equivale a cierre verde completo.` |
| Procesos tras verify | 0 `chrome-headless-shell`, puerto 3107 libre y ningún contenedor Docker corriendo (18:06Z) |
| `corepack pnpm knowledge:status` | `ok: false`, por falta de derivados en este worktree. Detalle en «Impacto documental» |
| Producción / servidor / base de prueba | NO EJECUTADO, por límite del encargo |
| `/ui-check` · `revisar-datos-ve` | NO EJECUTADO, porque no aplica: no hay UI ni datos personales nuevos |

Detalle por paso de verify sobre `e9378d3a` (Docker 29.8.2, pnpm 12.3.4):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ: 214 pruebas, 0 omitidas (24 archivos `scripts/tests/*.node.mjs`) |
| lint | PASÓ: 0 errores. Hay 15 warnings, todos en 6 archivos que esta PR no toca y que vienen de `main`: `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx:124`, `KommoClient.tsx:553`, `components/document-import/DocumentCalculator.tsx:109/110/149` y `scripts/lib/knowledge-vault.mjs` |
| rsc-boundary | PASÓ: 1685 módulos, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | PASÓ: 785 archivos aprobados y 1 omitido (786); 11038 pruebas aprobadas y 1 omitida |
| docs:check | PASÓ: 531 specs |
| numbering | PASÓ: 531 specs y 485 migraciones, sin números repetidos |
| feature-constants | PASÓ: 6 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE: `[SKIP]` sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, así que el ledger no se midió. No aplica a esta PR, que no trae migración, y no autoriza copiar credenciales |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ: 242 contratos SQL en `postgres:17` efímero, con rollback total |
| schema-rebuild | PASÓ: 485 migraciones en inventario; 467 aplicadas desde cero y 18 sólo-ledger; aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | PASÓ: 198 pruebas con 8 workers y dev server propio en el puerto 3107. Resultado: 177 aprobadas, 20 omitidas y 1 flaky que pasó en su reintento (`[chromium] e2e/auth.spec.ts:81:7`, «Acceso: un token inválido renderiza el mismo error las dos veces»). Sin corte del watchdog. Ningún spec del e2e visita `/portal/facturas/*` ni `/portal/envios/*`: esas pantallas exigen sesión, y su evidencia son las pruebas de vitest del paso `test` |
| build | PASÓ: 162/162 páginas estáticas |

### COMMITS

- `e9378d3a1fab7eebad1b26e879dd7492e5fd526d`: `Merge origin/main en codex/portal-reportes-principal-0390-0397`. Es el SHA de producto sobre el que corrió verify.
- Commit que contiene este documento: handoff de la ronda 2, sólo documentación. Su hash va en el comentario de la PR.

### PR / BRANCH

- PR #114 (borrador), base `main`, head `codex/portal-reportes-principal-0390-0397`.
- Publicación: `git push origin HEAD:refs/heads/codex/portal-reportes-principal-0390-0397`, fast-forward desde `1b3a8c7b`, sin force.
- Worktree y rama local se conservan. No hubo merge a main, deploy ni migraciones.

### PENDIENTES DE ESTA TAREA

- **Revisión del Director** del diff completo contra `main`: los mismos 11 archivos de la ronda 1, más el merge.
- **Merge con el OK de Sam.** Fusionar a `main` publica en producción solo, a los ~5 min (SDD-0541). El OK tiene que cubrir ese efecto.
- **CI «Calidad local sin secretos»** sobre la cabeza nueva.
- **E2E autenticado y ledger productivo:** NO DISPONIBLES en este entorno. No autorizan copiar credenciales.

### FUERA DE ALCANCE DETECTADO

1. **La SDD-0543 repite el patrón que la 0397 quitó de la acción.** `lib/portal/pending-acceptance.ts:31-42` (`tenantDe`) relee `clients.tenant_id` con el admin client. Lo hace para «Mis facturas», el estado de cuenta y la puerta del detalle (`facturas/page.tsx:83`, `facturas/[code]/page.tsx:35`), en vez de tomar el tenant del principal de sesión. Son lecturas best-effort, scopeadas después por tenant + Shipping Mark, y la RLS de esas pantallas no aplica porque van con admin. Si se quiere el mismo corte que 0397, es otro slice.
2. **La página de aceptación relee el tenant con admin.** `app/portal/(app)/facturas/[code]/aceptar/page.tsx:50-61` usa `getPortalClient` y luego `admin.from("clients").select("tenant_id")`. Ya estaba así antes. La 0397 dejó la UI fuera de su allowlist, y la acción, que es la que escribe, es más estricta que la página.
3. **La medida sellada no coincide con la mostrada cuando hay varios embarques.** La página muestra la suma; la acción sella el primer envío. La 0543 ya lo declara «limitación conocida que se decide aparte»; lo dejo visible porque toca el mismo flujo que esta PR.
4. **Lecturas del Portal que siguen sólo por Shipping Mark,** con la RPC `get_portal_client_markbox`: `lib/portal/portal-academy-queries.ts:83`, `app/portal/(app)/academia/actions.ts:26`, `app/portal/(app)/proveedores/actions.ts:177` y `lib/portal/portal-claims.ts:39`. Siguen como en la ronda 1, más `portal-claims`.
5. **`getReportById`** (`lib/portal/payment-report-queries.ts:151`) sigue sin llamador.
6. **Artefactos de #21 no importados** (auditorías y handoff del saneamiento). Siguen fuera de `main`, igual que en la ronda 1.
7. **Herramientas del turno.** Desde este aislamiento no hay forma de leer la línea de comando de procesos ajenos: `powershell.exe` está bloqueado y `wmic` ya no existe. Si el Director quiere que los subagentes comprueben el turno por línea de comando, hace falta otra vía, por ejemplo que lo mida el Director antes de lanzar.

### Impacto documental y conocimiento

- **Documentos canónicos:** ninguno cambia en esta ronda. Las specs 0390 y 0397 no se editaron, y este handoff es el único documento tocado.
- **Fuentes del piloto semántico y de Archify:** no se tocó ninguna (`scripts/knowledge-policy.json`). No hace falta recibo semántico ni `knowledge:visual`.
- **Graphify:** este worktree no tiene `graphify-out`, así que no hay grafo estructural que actualizar aquí. La actualización estructural va con la publicación del Director desde `main` integrado.
- **`knowledge:status` sobre `e9378d3a`:** `ok: false`.
  - Estructura: INVALID, porque falta `graphify-out/graph.json` en este worktree.
  - Piloto semántico: PENDING, 0 de 16.
  - Global: INVALID, 0 de 1262.
  - Archify: PENDING (`ARCHIFY_RUNTIME_MISSING`).
  - Obsidian: PENDING; la bóveda está en la revisión `6da8aebc`.

  Todo eso se debe a que el worktree es nuevo y no tiene derivados, no a esta PR. No lo reconstruí aquí. Queda para la publicación del Director desde `main` integrado.

### HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #114 en su cabeza nueva. Antes de pedir el OK de Sam, recuerda que fusionar publica en producción a los ~5 min. Reconsulta head, base y checks antes de integrar; si main avanza, hay que volver a mezclar.
- **Cambios compartidos:** ninguno fuera de `lib/portal` y `app/portal/(app)/facturas/[code]/aceptar`. No hay migración, cambio de RLS ni cambio de UI.
- **Sesiones y procesos:** sin subagentes. Mi verify no dejó procesos, puertos ni contenedores vivos. Antes de arrancar no se veía otra corrida pesada, con el límite de medición ya descrito; durante la corrida no volví a medir.
- **Ownership:** lo libero con `node scripts/harness-worktree.mjs release --owner worker-pr114-retoma-20261017` después del último push. Worktree y rama se conservan.

## Ronda 1 — extracción del 2026-09-14 (evidencia fechada)

Fecha: 2026-09-14. Task ID: `portal-reportes-principal-0390-0397`.
Owner / sesión escritora: `worker-w3-portal-reportes-20260914` (Worker asignado por el Director el 2026-09-14; sin subagentes ni otras sesiones escritoras).
Estado de tarea: lista-para-revision. PR #114 en borrador; la integración la decide el Director después del smoke de L14 y de aplicar 0422 y 0423.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-reportes-principal-0390-0397`.
Rama: `codex/portal-reportes-principal-0390-0397`. Base: `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24` (sin moverse durante la tarea: `git ls-remote origin main` lo confirmó antes del push).
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7`. Commits de referencia: `08ec803d1a1b0dc344d445f0509fd3b41c4473c2` (SDD-0390) y `2d0628d0d104845011f2f1fe66462ea07871a96d` (SDD-0397). Extracción con `git show <sha>:<ruta>`; la rama fuente no se modificó ni se publicó.
SDD: `docs/specs/0390-portal-payment-shipment-reads-principal-tenant/spec.md` y `docs/specs/0397-portal-invoice-actions-principal-tenant/spec.md`, ambas `status: done` en `main` (bloque A de #21, `44c751ea`) sin su código (hallazgo de L14). Sin reserva de número. Sin migración.
Permisos: commits locales selectivos (nunca `git add -A`), una unidad lógica por commit; push de la rama a sí misma y PR en borrador contra `main`, autorizados por el encargo y ya ejecutados. Prohibidos: merge, deploy, aplicar migraciones, leer filas de negocio, tocar el ruleset, borrar ramas o worktrees, copiar credenciales.

### Contrato del encargo

- **Objetivo:** que el código que SDD-0390 y SDD-0397 declaran hecho exista en `main`: lecturas de reportes de pago y eventos de envío del Portal resueltas por principal y tenant, y `app/portal/(app)/facturas/[code]/aceptar/actions.ts` sin releer `clients.tenant_id` con admin.
- **Aceptación:**
  1. `listMyInvoiceReports` y las lecturas de eventos de envío filtran por principal y tenant; `lib/portal/__tests__/portal-read-principal-scope.test.ts` importado o reescrito contra `main` actual.
  2. `aceptar/actions.ts` resuelve el principal como ya lo hace `reportar/actions.ts` (hunk de SDD-0397 ya en `main` por L14) y no relee `clients.tenant_id` con admin.
  3. Toda escritura sobre `payment_reports` sigue pasando por los comandos de 0421 (`run_report_command` y sus wrappers); ninguna vuelta a DML directo ni a `confirm_payment_report`. Verificado con grep en `lib/portal` y `app/portal`.
  4. `lib/portal/__tests__/payment-reports.test.ts` recupera la aserción y el mock de SDD-0390 que L14 excluyó; ningún test existente se debilita.
- **Alcance:** los archivos de las allowlists de 0390 y 0397 que faltan en `main`, sus tests, las dos specs y este handoff. Excluidos: los 111 archivos ajenos de la PR #21; migraciones, `supabase/` y las esperas de `migrations-baseline.json`; Studio; los audits/handoffs del saneamiento (`docs/audits/2026-09-02-*`, `2026-09-03-portal-*-local.md`, `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`), que no están en `main`.
- **Interpretación registrada:** el objetivo nombra «lecturas y eventos»; los eventos viven en `lib/portal/shipment-events-queries.ts`, que está en la allowlist de 0390 y del que importa `portal-read-principal-scope.test.ts`. Se incluye ese archivo y su test histórico; sin él la spec 0390 no queda hecha ni el test se puede importar tal cual.
- **Dependencias / orden:** desarrollo independiente. La integración la decide el Director después del smoke de L14 (PR #104, en `main` `36204665`) y de aplicar 0422 y 0423; la PR queda en borrador.
- **Solapamientos previstos** (sección «Integración» del handoff de L14): `lib/portal/payment-report-queries.ts`, `lib/portal/__tests__/payment-reports.test.ts` y `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts`. Resueltos en esta rama; la versión elegida y el porqué están en COMPLETADO.
- **Validación:** `E2E_PORT=3103 corepack pnpm verify` con veredicto por paso; `corepack pnpm exec vitest run lib/portal` y los tests focales; lint focal sobre los archivos tocados; `git diff --check` antes de cada commit.

### Punto de partida verificado (antes del primer cambio)

- `git rev-parse --show-toplevel` = el worktree de arriba; rama `codex/portal-reportes-principal-0390-0397`; `HEAD = b07ad98b`; árbol limpio. `guard` OK y `claim` adquirido con el owner de arriba.
- Identidad por blob de cada ruta del alcance (`git rev-parse <ref>:<ruta>`):

| Ruta | `main` (`b07ad98b`) | Padre del commit fuente | Commit fuente = head de #21 |
|---|---|---|---|
| `lib/portal/payment-report-queries.ts` | `63dbe421` | `08ec803d^` = `63dbe421` | `f0464875` |
| `lib/portal/shipment-events-queries.ts` | `0580a877` | `08ec803d^` = `0580a877` | `443f205e` |
| `lib/portal/__tests__/payment-reports.test.ts` | `ce5de1c7` | `08ec803d^` = `ce5de1c7` | `e1c75f6f` |
| `lib/portal/__tests__/shipment-events.test.ts` | `a62a098f` | `08ec803d^` = `a62a098f` | `bac6d4dc` |
| `lib/portal/__tests__/portal-read-principal-scope.test.ts` | ausente | — | `2528616c` (alta en `08ec803d`) |
| `app/portal/(app)/facturas/[code]/aceptar/actions.ts` | `d549b67e` | `2d0628d0^` = `d549b67e` | `a6c5e992` |
| `app/portal/(app)/facturas/[code]/aceptar/__tests__/actions.test.ts` | `d599b5d3` | `2d0628d0^` = `d599b5d3` | `94ffc956` |
| `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts` | `636d292a` (recorte de L14) | ausente | `814ef869` (alta en `2d0628d0`) |
| `app/portal/(app)/facturas/[code]/reportar/actions.ts` | = head de #21 (`66eb9ca0`) | — | ya en `main` por L14; sin cambio |
| `lib/portal/__tests__/payment-report-consumers.test.ts` | = head de #21 (`86a499c5`) | — | ya en `main` por L14; sin cambio |

  En las siete rutas que `main` conserva iguales al padre del commit fuente, el hunk de 0390/0397 es exactamente la diferencia entre `main` y el head de #21 (`git log --full-history 2a2e81bf..ea9952a4 -- <ruta>` no muestra otros commits después de 0390/0397). Por eso se toma el blob exacto del commit fuente. El recorte de L14 es un subconjunto estricto del test completo de 0397 (mismos mocks y casos del reporte; el test completo agrega los mocks legales y el caso de aceptación); se toma la versión completa.
- `getPortalClientPrincipal` (`lib/portal/portal-queries.ts`, L18/SDD-0462) tiene en `main` el mismo cuerpo que en `08ec803d`; `portal-queries.ts` sólo importa `./portal-types`, así que el import nuevo desde `payment-report-queries.ts` y `shipment-events-queries.ts` no crea un ciclo.
- Escrituras sobre `payment_reports` en `app/` y `lib/` (sin tests): sólo lecturas (`select`) en `lib/portal/payment-report-queries.ts:83,108,133,161` y `app/portal/(app)/facturas/[code]/reportar/actions.ts:65`; ningún `insert/update/delete/upsert`; `confirm_payment_report` sólo aparece en `lib/portal/__tests__/payment-report-consumers.test.ts:93` como detector de legado. Los comandos van por `lib/portal/payment-report-commands.ts:123-124` (`create_portal_payment_report`, `cancel_portal_payment_report`, `resolve_payment_report`).
- Columnas por las que ahora filtran las lecturas: `shipment_events.tenant_id` (`0002_shipments.sql:66`, `not null`) y `payment_reports.tenant_id` (`0195`), existentes.

### OBJETIVO ORIGINAL

Que el código que SDD-0390 y SDD-0397 declaran hecho exista en `main`: lecturas de reportes de pago y eventos de envío del Portal resueltas por principal y tenant, y la aceptación legal (`aceptar/actions.ts`) sin releer `clients.tenant_id` con admin; todo extraído de #21 sin merge de la rama entera, sin migración, con PR en borrador para que el Director decida la integración después del smoke de L14.

### COMPLETADO

- **Aislamiento.** Raíz, rama y HEAD verificados; `guard` y `claim` PASÓ; guard y rama revalidados antes de cada commit y del push. El checkout principal y los otros worktrees no se tocaron. Dependencias: `pnpm exec` disparó la instalación automática de pnpm 12.3.4 (equivalente a `install --frozen-lockfile`: `pnpm-lock.yaml` y `package.json` quedaron intactos frente a `HEAD`). No se copió `.env` ni credenciales.
- **SDD-0390** (commit `e4b10cab`): `listMyInvoiceReports`, `listMyShipmentEvents` y `listMyRecentActivity` resuelven `getPortalClientPrincipal()` en vez de la RPC `get_portal_client_markbox`, cortan sin consultar dominio ante principal inválido o incoherente y fijan `tenant_id` + Shipping Mark del principal (más `shipments.tenant_id` y `shipments.client_markbox` en los eventos, con el embed `shipments!inner(tenant_id, client_markbox)`). Mapeos, orden, límites y fallbacks (`null` en reportes, `[]` en eventos) se conservan; las firmas públicas no cambian, así que los tres llamadores (`facturas/[code]/page.tsx:38`, `envios/[code]/page.tsx:66`, `app/portal/(app)/page.tsx:57`) no se tocan. Alta de `portal-read-principal-scope.test.ts` (4 casos: principal incoherente corta las tres lecturas con cero operaciones de dominio; reportes, hitos y actividad fijan el scope canónico). `payment-reports.test.ts` y `shipment-events.test.ts` recuperan el mock de `../portal-queries` y las aserciones de `tenant_id` que L14 excluyó.
- **SDD-0397** (commit `3f0d59ac`): `registerAcceptanceAction` resuelve el principal con la sesión antes de construir el admin client, corta sin elevar ante principal inválido y usa `tenantId` + `client.markbox` del principal canónico; desaparece la relectura `admin.from("clients").select("tenant_id")` y su error «No pudimos resolver tu cuenta». Validaciones de checkboxes, `user_agent` de `headers()`, sello, idempotencia, correlativo con reintentos y revalidaciones se conservan. El test histórico de la acción mockea `getPortalClientPrincipal` (con `tenantId`) en vez de `getPortalClient`; su stub admin conserva la rama `clients` sin usarla (blob idéntico al origen). `portal-invoice-actions-principal-scope.test.ts` pasa a la versión completa: `it.each` de principal inválido para aceptación y reporte (cero construcción admin, cero lecturas), aceptación consulta la orden con tenant + Shipping Mark canónicos sin leer `clients`, reporte fija tenant + Shipping Mark sin releer `clients`, cancelación exige principal antes del comando.
- **Solapamientos con L14, resueltos:**
  - `payment-report-queries.ts` y `payment-reports.test.ts`: L14 tomó `bcf111a8`; aquí entra el hunk de `08ec803d` encima de esa misma versión (`main` era idéntico al padre), sin pisar nada de L14.
  - `portal-invoice-actions-principal-scope.test.ts`: se elige el blob completo de #21 (`814ef869`) sobre el recorte de L14 (`636d292a`) porque es su superconjunto estricto y el encabezado del recorte lo anunciaba como temporal. Quedan los mismos tres casos del reporte más el de aceptación.
- **Specs.** 0390 y 0397 llevan una nota de extracción fechada 2026-09-14 bajo el H1 (misma forma que las notas de importación de L14): qué entró, por qué blob, qué tomó L14, qué no se importa (auditoría, checklist y handoff del saneamiento) y que la casilla «Checklist original sigue 56/106» describe un artefacto de #21 que no aplica en `main`. Frontmatter intacto (`status: done`, `updated: 2026-09-03`, como el precedente de L14); quitando exactamente la nota, cada spec recupera su blob de `main` (`ef89add2` y `a932afc5`). `docs/specs/README.md` no cambia (mismo blob `e7f8b9cf` que `main`). Estado `done` conservado: todos los criterios de código de ambas specs quedan cumplidos en la rama; queda efectivo en `main` con la integración.
- **Aceptación del encargo:** (1) PASÓ, (2) PASÓ, (3) PASÓ (grep en «Punto de partida»; no hay ruta de escritura directa en `lib/portal` ni `app/portal`), (4) PASÓ (los tests históricos sólo agregan aserciones y un mock; ninguna aserción se quita ni se relaja).
- **Gobernanza (AGENT-BRIEF):** cambio de comportamiento del Portal con SDD y allowlist exacta (0390 y 0397): cumplimiento. Sin UI, sin nueva categoría de datos personales (las lecturas ya existían; sólo se estrecha el scope): `/ui-check` y `revisar-datos-ve` no aplican. AUD-01/AUD-02 sin cambio: las escrituras siguen por los comandos de 0421.

### VALIDACIÓN

Sin credenciales ni `.env`; nada se corrió contra producción ni se leyó ninguna fila. Recibos fuera de Git en el scratchpad de la sesión: `verify-3f0d59ac.log`, `verify-3f0d59ac-clean.log` (sin ANSI), `verify-3f0d59ac.meta` (HEAD, inicio, fin, exit y estado del árbol) y `pr-body.md`.

| Comprobación | Resultado / alcance |
|---|---|
| `guard` / `claim` | PASÓ; revalidado antes de cada commit y del push |
| Identidad por blob (8 archivos) | PASÓ: `git hash-object` = `git rev-parse <commit fuente>:<ruta>` en los ocho; 0 CR |
| Historia por archivo en #21 | PASÓ: `git log --full-history 2a2e81bf..ea9952a4 -- <ruta>` sin commits ocultos después de 0390/0397 |
| `corepack pnpm exec vitest run lib/portal "app/portal/(app)/facturas/[code]/aceptar"` | PASÓ: 52 archivos / 833 pruebas (incluye los 6 tests del alcance) |
| `corepack pnpm typecheck` | PASÓ (exit 0) |
| ESLint focal (8 archivos tocados) | PASÓ (exit 0, 0 problemas) |
| `corepack pnpm docs:check` / `sdd:check` / `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 452 specs sincronizadas; sin repetidos (sólo choques históricos exentos); 0 ROJO · 0 AMARILLO |
| Notas de specs removibles | PASÓ: sin la nota, 0390 y 0397 recuperan `ef89add2` y `a932afc5`; frontmatter igual a `main` |
| `git diff --check` | PASÓ en cada commit (`--cached`) y en `origin/main...HEAD` |
| Entorno antes de verify | Docker 29.7.2 disponible, puerto 3103 libre, sin contenedores `dtd_*`, sin verifies ajenos en ese momento |
| **`E2E_PORT=3103 corepack pnpm verify` sobre `3f0d59ac`** | **FALLÓ, exit 1**, 01:30:59 → 02:02:13 (−04:00), árbol limpio al inicio y al final. Corrieron 16 de 17 pasos: 15 PASÓ, `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ por entorno. Veredicto literal: `verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde |
| `verify` · `migrations-applied` | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`; el ledger no se midió. No aplica a esta PR (sin migración nueva) y no autoriza copiar credenciales |
| `verify` · `e2e` | FALLÓ con motivo COLGADO/TIMEOUT; detalle abajo. No se reintentó en bucle |
| Procesos tras verify | El watchdog terminó 25 procesos del árbol propio (chrome-headless-shell ×15, node ×9, cmd ×1), 0 sobrevivientes; puerto 3103 libre después. Los procesos que quedaron vivos son ajenos (ver HANDOFF AL DIRECTOR) y no se tocaron |
| Producción / Supabase | NO EJECUTADO por límite del encargo: sin conexión, sin filas, sin migraciones |
| `/ui-check` · `revisar-datos-ve` | NO EJECUTADO por no aplicar: sin UI ni captura/movimiento de datos personales nuevos |

Detalle por paso de `corepack pnpm verify` sobre `3f0d59ac` (Node 24.20.0, pnpm 12.3.4, Docker 29.7.2):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 98 pruebas, 0 fallos |
| lint | PASÓ, 0 errores; 8 warnings heredados en archivos que esta PR no toca: `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `app/studio/(app)/crm/_components/KommoBoardView.tsx:124`, `KommoClient.tsx:553` (los mismos que registró L14) |
| rsc-boundary | PASÓ, 1601 módulos escaneados, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ, 556 archivos / 7232 pruebas |
| docs:check | PASÓ, índice sincronizado con 452 specs |
| numbering | PASÓ, 452 specs · 449 migraciones sin repetidos |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO DISPONIBLE (`[SKIP]`, sin credenciales); `[AVISO] OMITIDO — no se midió` |
| pending-migration-symbols | PASÓ, 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ |
| schema-rebuild | PASÓ: inventario 449; 431 aplicadas desde cero sobre `postgres:17`, 18 sólo-ledger; aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | **FALLÓ por entorno.** Dev server propio en el puerto 3103; 186 pruebas con 8 workers. La primera pasada imprimió 168 de 186 resultados (123 aprobadas, 15 omitidas y 30 renglones de fallo) y se quedó 10 min en silencio tras `[mobile-safari] gastos-expense-void.spec.ts:99:7` (el mismo punto que L14 registró en dos corridas y L10 en otras dos); el watchdog de SDD-0454 cortó el paso sin reintento. Los 30 renglones son: los 14 ambientales conocidos sin Supabase con su reintento interno (`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium y mobile-chrome; `auth.spec.ts:21/91/98/105` en mobile-safari, que no llegó a `global-search`), con `proxy.ts:67` ×99 porque el WebServer no puede crear el cliente Supabase sin URL ni clave; más dos flaky aprobados en su reintento (`auth.spec.ts:74` y `smoke.spec.ts:150`, chromium). Contención añadida: durante mi e2e (01:41–02:01) corrían dos `verify` ajenos de otros worktrees, arrancados a las 01:40:10 y 01:50:19. Ningún spec del e2e visita `/portal/facturas/*` ni `/portal/envios/*` (sólo `global-search.spec.ts:68`, faceta «Pagos», Tier 3 omitido); esas pantallas exigen sesión y su evidencia son los tests focales de vitest, que corren dentro del paso `test` |
| build | PASÓ: Next.js 16.2.11 (Turbopack), 160/160 páginas estáticas; `[build] build de producción OK` |

### COMMITS

- `418de24ec` — `docs(handoff): portal-reportes-principal-0390-0397 — contrato de la tarea` (este handoff, versión de contrato, antes del primer cambio de producto).
- `e4b10cabf8b02f830803ac95f6bf810519c46ac7` — `fix(portal): SDD-0390 — lecturas de pagos y eventos por principal y tenant` (5 archivos de código/tests + spec 0390 con nota).
- `3f0d59ac96d1bc8770a7400055d14dd57d7ec547` — `fix(portal): SDD-0397 — aceptación legal por principal sin releer clients` (3 archivos de código/tests + spec 0397 con nota). **SHA de producto sobre el que corrió verify y cabeza revisable de la PR.**
- Commit que contiene este documento: cierre del handoff, sólo documentación; su hash se anota en la PR.

### PR / BRANCH

- PR **#114** (borrador): https://github.com/hailuwaycom-sketch/DTDCARGO/pull/114 — base `main`, head `codex/portal-reportes-principal-0390-0397`, abierta con `headRefOid = 3f0d59ac`.
- Publicación: un push de la rama a sí misma (`git push -u origin codex/portal-reportes-principal-0390-0397:codex/portal-reportes-principal-0390-0397`, sin force) y `gh pr create --draft` con el cuerpo de `pr-body.md`; segundo push sólo para este cierre.
- Worktree conservado en la ruta de arriba. Sin merge, deploy ni migraciones.
- **La PR queda en borrador a propósito:** la integración la decide el Director después del smoke de L14 y de aplicar 0422 y 0423. Fusionarla no autoriza nada en producción.

### PENDIENTES DE ESTA TAREA

- Ninguno de implementación: los cuatro criterios de aceptación están cumplidos y ambas specs quedan con su código en la rama.
- Revisión del Director: la interpretación de «eventos» (inclusión de `shipment-events-queries.ts` y su test), la elección del test de scope completo sobre el recorte de L14 y las notas de las specs (frontmatter intacto por precedente de L14; si prefieres `updated: 2026-09-14`, es un cambio de una línea).
- Confirmar el CI «Calidad local sin secretos» sobre el SHA final publicado.
- E2E autenticado y ledger productivo: NO DISPONIBLES en este entorno; no autorizan copiar credenciales.

### FUERA DE ALCANCE DETECTADO

- **Artefactos de #21 no importados:** `docs/audits/2026-09-02-codex-arranque-checklist.md`, `docs/audits/2026-09-03-portal-payment-shipment-reads-local.md`, `docs/audits/2026-09-03-portal-invoice-actions-local.md` y `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`. Las casillas «Checklist original sigue 56/106» de 0390 y 0397 describen ese checklist. Si el Director quiere esa evidencia en `main`, es otra tarea.
- **Cuelgue recurrente del e2e en mobile-safari sin Supabase**, en el mismo punto (`gastos-expense-void.spec.ts:99`) que L10 y L14; y contención de varios `verify` concurrentes en la misma máquina (ver abajo). Conviene serializar los verifies de Workers paralelos o darle al harness un lock de máquina; no se tocó el harness.
- **Warnings de lint heredados** (8, listados arriba), sin errores.
- **`getReportById`** (`lib/portal/payment-report-queries.ts:156`) sigue sin llamador (ya anotado por L14).
- **Lecturas Portal que siguen sólo por Shipping Mark:** `listMyShipments` y `getMyShipment` (`lib/portal/portal-queries.ts`), `portal-academy-queries.ts:83`, `academia/actions.ts:26` y `proveedores/actions.ts:177` usan la RPC `get_portal_client_markbox`. No forman parte de 0390/0397; son candidatos a un slice propio si se quiere el mismo corte por tenant.

### HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #114 (diff de 8 archivos de código/tests, idénticos por blob a `08ec803d`/`2d0628d0`, más dos notas de spec y este handoff). Después del smoke de L14 y de aplicar 0422 y 0423, decidir la integración; no hay migración ni cambio de UI que coordinar. Reconsultar head/base/checks antes de integrar.
- **Cambios compartidos:** ninguno fuera de `lib/portal` y `app/portal/(app)/facturas/[code]/aceptar`. Los otros tres Workers en paralelo (lectores financieros de Studio, helpers SQL del Portal, análisis de SDD-0235) no tocan estas rutas según el encargo; `git ls-remote origin main` seguía en `b07ad98b` al publicar.
- **Sesiones, procesos y contenedores:** sin subagentes ni sesiones consumidoras. Mi verify dejó 0 sobrevivientes. Al terminar quedaron vivos procesos **ajenos** que no toqué: dos `node scripts/verify.mjs` (arrancados 01:40:10 y 01:50:19), un Playwright con `next dev --webpack --port 3101` (02:01:26), un `check-schema-rebuild.mjs` (02:02:11) con `node` del worktree `facturas-borradas-lectores-financieros` y el contenedor `dtd_rebuild_6c391f22` (creado 02:02:13, sin etiquetas), más 32 `chrome-headless-shell` de ese Playwright. Pertenecen a otros Workers; nadie debe limpiarlos sin verificar a su dueño.
- **Ownership:** se libera con `node scripts/harness-worktree.mjs release --owner worker-w3-portal-reportes-20260914` después del último push. Worktree y rama se conservan; no se elimina nada.
