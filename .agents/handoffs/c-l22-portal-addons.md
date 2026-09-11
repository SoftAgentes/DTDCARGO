# L22 — Catálogo de add-ons de prealerta Portal por principal (0434)

Fecha: 2026-09-11. Task ID: `c-l22-portal-addons`.
Owner / sesión escritora: `c-l22-worker-20260911-claude` (Worker asignado por el Director; sin subagentes escritores).
Estado de tarea: lista-para-revision, **parcial**. SQL, contrato, spec, baseline e índice entregados; los tres consumidores y el test de scope quedan bloqueados por un límite de alcance, con propuesta validada.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l22-portal-addons`.
Rama: `codex/c-l22-portal-addons`. `start` desde `3c6107012f754953323202a7386b3e7811593814`; antes del primer commit origin/main avanzó a `5894538d0c99dd597bfff136b6283c364671b19c` (PR #71: handoff de 0425/0427 y nota en la spec 0372, ninguna ruta de L22) y se integró por merge fast-forward, sin rebase. Base efectiva: `5894538d`.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21). Base común con main: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0402-portal-prealerta-addons-principal-tenant/spec.md` (`status: done` del origen, con nota de importación). Sin reserva de número: ni la spec 0402 ni la migración 0434 existían en ninguna ref local o remota (la migración 0402 de L02 es otra cosa).

## Contrato del encargo

- **Alcance exacto:** migración y contrato 0434; spec 0402; cambios focales en `app/portal/(app)/proveedores/page.tsx`, `app/portal/(app)/compras/nueva/page.tsx` y `app/portal/(app)/compras/[code]/etiquetas/page.tsx`; test de scope del origen; tests nuevos mínimos; baseline; declaraciones sólo si el gate da ROJO; índice; este handoff.
- **Excluidos:** hunks de marca de L01, otros hunks de #21, otros lotes, cutoff, esperas existentes y la rama de #21.
- **Permisos:** commits selectivos, push de la rama a sí misma y PR draft contra `main`. Prohibidos: merge, aplicar 0434, leer producción y deploy.
- **Dependencias:** L18 integrado (principal en `lib/portal/portal-queries.ts`); etiquetas compartida con L01 (#82), la serializa el Director; baseline, índice y declaraciones compartidos con otros lotes.

## OBJETIVO ORIGINAL

Preparar el lote L22 del bloque C como PR draft contra `main`: importar la migración 0434, su contrato y la spec 0402; adoptar los cambios focales de los tres consumidores y el test de scope sobre las versiones vigentes de `main`; declarar 0434 pendiente; y clasificar con evidencia si el código depende de 0434.

## COMPLETADO

- Aislamiento: `start`, guard y claim PASÓ; guard `--owner` y rama revalidados antes de cada commit.
- Importación por blob exacto (`git cat-file blob` del origen y `git hash-object` del archivo en la rama):

| Artefacto | Blob origen = blob en rama | Bytes |
|---|---|---|
| `supabase/migrations/0434_portal_prealerta_addons_principal_tenant.sql` | `0c2f25c7a2c4ff79d9ad12ec0abec6cdafee6639` | 3233 |
| `supabase/tests/0434_portal_prealerta_addons_principal_tenant.test.sql` | `42a75dd19282ac9ab3e282d6912e6695b09a6519` | 10104 |
| `docs/specs/0402-portal-prealerta-addons-principal-tenant/spec.md`, sin la nota | `b014224d06a4c204c041cd71b2eb15bb48168319` | 2581 |

  La spec final (`1334b31b217068f119cb8ef30e66ae57acdbfa0d`, 3576 B) sólo añade una nota fechada bajo el H1, con la forma de 0363 en `main`; al quitar exactamente ese bloque se recupera el blob fuente. Frontmatter, `status: done` y casillas quedan intactos; la nota explica que describen la rama de origen.
- Baseline: sólo la espera nueva `0434_portal_prealerta_addons_principal_tenant` («bloque C L22 / SDD-0402», no migrate-first, OK nominal de Sam, runbook y name exacto). Comparación estructural: sin esa clave el JSON es idéntico a `main`; `cutoff: 238`, `$doc` y las esperas 0409/0418/0419/0430 intactos.
- Declaraciones de símbolos: no corresponden. El gate da 0 ROJO / 0 AMARILLO. 0434 sólo ejecuta `alter policy` (línea 53); sus bloques DO no tienen `execute` ni `format(` y no hay caracteres fuera del BMP (sólo U+00B7, U+00E1 y U+00F3). Por eso los dos defectos conocidos del checker (desfase UTF-16 de la PR #79 y DDL dinámico en DO) no alteran esta lectura. El archivo queda idéntico a `main`.
- Índice regenerado con `corepack pnpm docs:index`: 416 specs; 0402 sale de la lista de huecos.

### Bloqueo de los consumidores: límite de alcance

El cambio focal de SDD-0402 en las tres páginas es `listActivePrealertaAddons(supabase, { tenantId })`; el commit origen `ac190356` no toca `queries.ts`. En `main` el callee tiene un solo parámetro (`lib/studio/prealertas/queries.ts:471-473`). La opción `opts: { tenantId?: string } = {}` la introdujo en #21 **SDD-0389** (`cc6242cd`, «aislar compras por principal»). Su spec está en `main` (`docs/specs/0389-portal-purchases-application-principal-tenant/spec.md`, blob `ea9bf0ee`, `status: done`, allowlist con `lib/studio/prealertas/queries.ts`), pero entró sólo como documento en `44c751ea` («bloque A de PR #21, las 77 specs que faltaban…»); su código no está en `main`. Ninguna ref local o remota salvo `origin/codex/saneamiento-integral` contiene esa opción; L11 (#81) sólo cambia `listPrealertaServiceRequests` y L01 (#82) sólo la marca.

Sonda de compilación sobre `3c610701` (ediciones temporales, no commiteadas y revertidas; los blobs restaurados se verificaron contra HEAD; #71 no tocó código, así que vale igual para `5894538d`):

- Cambio focal en las tres páginas con el callee de `main` (`queries.ts` blob `9fc37d02`): `tsc --noEmit` exit 2 con exactamente tres errores `TS2554: Expected 1 arguments, but got 2.` en `compras/[code]/etiquetas/page.tsx(87,41)`, `compras/nueva/page.tsx(40,41)` y `proveedores/page.tsx(36,41)`.
- En ese mismo estado el test de scope del origen **pasa** (3/3): es una regex sobre el fuente y no prueba el filtro.

Incorporar el hunk del callee significaría traer otro hunk de #21 (SDD-0389) en un archivo fuera del alcance exacto, así que no se hizo. Tampoco se commitean las páginas ni el test de origen: romperían `typecheck` o fallarían.

### Propuesta mínima validada (NO incorporada; requiere decisión del Director)

Con el hunk exacto de #21 para esa única función (docstring y cuerpo idénticos byte a byte, 28 líneas), los tres cambios focales, el test de origen y un test nuevo del callee: `tsc --noEmit` exit 0; vitest 4 archivos / 26 tests PASÓ (test de origen, test nuevo, `lib/studio/prealertas/__tests__/addons.test.ts` y `app/portal/(app)/proveedores/__tests__/update-prealerta-detalle.test.ts`); eslint exit 0 sobre los seis archivos. Los otros callers (`app/portal/(app)/proveedores/actions.ts:266` y `:669`) conservan la llamada sin tenant.

```diff
--- lib/studio/prealertas/queries.ts (main 9fc37d02 → propuesta f7bbb27a)
- * y lo combina con los DEFAULTS de código. Defensivo: si la tabla no existe (0150
- * sin aplicar en un env) cae a los 7 defaults activos → la pantalla del portal
- * funciona igual ANTES de la migración.
+ * y lo combina con los DEFAULTS de código. Los callers Portal que ya derivaron
+ * principal pasan tenant explícito. Defensivo: si la tabla no existe (0150 sin
+ * aplicar en un env) cae a los 7 defaults activos.
  */
 export async function listActivePrealertaAddons(
   supabase: SupabaseClient,
+  opts: { tenantId?: string } = {},
 ): Promise<PrealertaAddon[]> {
   try {
-    const { data, error } = await supabase
+    const query = supabase
       .from("prealerta_addons")
       .select(
         "code, label, description, notas_placeholder, consent_text, video_url, multi_tracking, sort, is_active",
-      )
+      );
+    const scoped = opts.tenantId ? query.eq("tenant_id", opts.tenantId) : query;
+    const { data, error } = await scoped
       .limit(50);
```

En cada página, con la misma forma (en etiquetas, la llamada al catálogo está en la línea 86):

```diff
-import { getPortalClient } from "@/lib/portal/portal-queries";
+import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
…
-  const client = await getPortalClient(supabase);
-  if (!client) return null;
+  const principal = await getPortalClientPrincipal(supabase);
+  if (!principal) return null;
+  const { client, tenantId } = principal;
…
-    listActivePrealertaAddons(supabase),
+    listActivePrealertaAddons(supabase, { tenantId }),
```

Son 3 archivos, 15 inserciones y 12 borrados. `listSuppliers`, `listPrealertas`, `getPrealertaByCode` y `listPrealertaServiceRequests` siguen sin tenant: esos hunks son de SDD-0399 y están excluidos. En etiquetas se conservan `getLabelPresentation` (línea 67, que pasa `presentation.settings` en 139), `listPredeclaredBoxes` (78), `resolveBrandForClient` (64, marca de L01) y la firma de adjuntos vigente. El import de la línea 7 queda adyacente a la línea 6 que cambia L01: conflicto textual esperado y trivial al serializar (conservar ambos imports). Test nuevo propuesto: `lib/studio/prealertas/__tests__/addons-tenant-scope.test.ts`, con tres casos (tenant antes del límite, sin tenant no filtra, fallo de lectura → defaults). El parche completo (223 líneas, sha256 `6a5f4f6bea06cf08a709a6a6259d05ca4f9d01d411cb3020b089d9e0dc48a226`) quedó fuera de Git, en la carpeta temporal de evidencia de la sesión, y se reproduce con los hunks de arriba.

Opciones para el Director: **(A)** ampliar la allowlist de L22 con ese único hunk de `queries.ts` y su test, y adoptar los consumidores en esta rama; **(B)** importar primero el código de SDD-0389 (acciones, `queries.ts` y tests) como tarea propia y después los consumidores de L22. En ambos casos la migración puede ir antes o después.

### Clasificación migrate-first y comportamiento ante fallo

**No es migrate-first.** 0434 no crea RPC, columnas, funciones ni otros símbolos: su único DDL es `alter policy` (líneas 53-66) y el gate de símbolos da 0 ROJO. Ni el código de esta PR (idéntico a `main`) ni la propuesta llaman nada que nazca en 0434. Se puede fusionar antes de aplicarla, y aplicarla antes o después no rompe ninguna de las dos versiones.

| Escenario | Qué pasa, con líneas |
|---|---|
| `main` hoy (= esta PR) | Páginas: `getPortalClient` → principal L18 (`lib/portal/portal-queries.ts:125-129` → `111-119` → `59-109`). Vínculo incoherente, revocado, múltiple o con cliente borrado → `null` (`72-74`, `83-89`), y la página devuelve `null` antes de leer el catálogo (`proveedores/page.tsx:29-30`, `compras/nueva/page.tsx:33-34`, `etiquetas/page.tsx:49-50`). Catálogo: `queries.ts:471-488` sin filtro, bajo la RLS histórica `0150_prealerta_addons.sql:180-185` (`get_user_tenant_id()` o `get_portal_client_tenant()`). Si falla la lectura → `catch` → 7 defaults activos (`queries.ts:485-486`; `lib/studio/prealertas/addons.ts:83-170`, merge en `193-216`). |
| `main` / esta PR tras aplicar 0434 | Principal coherente: misma lectura, porque la rama Portal exige `client_users` activo y `clients` vivo del mismo tenant (`0434:56-65`); UI idéntica. Equipo y `service_role` sin cambio (`0434:55`; `0150:188-195`). Si el preflight detecta drift, la migración aborta y queda la policy histórica (`0434:5-51`); el postflight exige la forma final (`0434:68-89`). Las acciones con helpers históricos (`proveedores/actions.ts:266,669`), ante un vínculo incoherente, pasan de leer el catálogo de otro tenant a 0 filas → defaults, sin fuga entre tenants. Para ese vínculo anómalo los defaults tampoco reflejan la configuración de su tenant (hoy tampoco la refleja: lee la de otro); cerrarlo en las acciones es dominio de SDD-0389. |
| Propuesta, antes de 0434 | `.eq("tenant_id", principal.tenantId)`: con un solo vínculo activo coincide con `get_portal_client_tenant()`, así que devuelve las mismas filas. Un principal dual (equipo X + Portal Y) deja de mezclar X e Y (rama `0150:183`). Si falla la lectura → defaults, igual que `main`. |
| Propuesta, después de 0434 | Igual que la fila anterior; ambas defensas se suman. |

Ninguna variante empeora a `main`.

### Revisión focal de datos (`revisar-datos-ve`)

- **Inventario:** `prealerta_addons` (`0150_prealerta_addons.sql:38-57`) guarda configuración comercial por tenant: `code`, `label`, `description`, `notas_placeholder`, `consent_text`, `video_url`, `multi_tracking`, `sort`, `is_active` y fechas. Ninguna columna identifica a una persona natural.
- **Quién lee qué:**
  - equipo del tenant, por `get_user_tenant_id()` (rama conservada, `0434:55`);
  - cliente Portal, sólo con vínculo activo, cliente vivo y el mismo tenant (`0434:56-65`; antes `0150:184`);
  - `service_role`, todo (`0150:193-195`).

  Escribe sólo el equipo (`0150:188-191`). Los grants (`0150:168,171`) y el trigger de auditoría (`0293_audit_d5_residual_and_writer_retirement.sql:521-522`) quedan intactos; 0434 no tiene DML.
- **CORRECTO** (código y contrato local): vínculo incoherente, revocado o con cliente borrado → 0 filas; principal coherente, equipo y `service_role` conservan su lectura (`supabase/tests/0434_portal_prealerta_addons_principal_tenant.test.sql:198-263`); el RED histórico se reproduce antes del fix (`119-131`). Sólo PostgreSQL desechable y datos sintéticos.
- **Fuera del cambio:** las páginas también leen `suppliers_cn` (`name`, `city`, `wechat`, `contact`, `notes`; `queries.ts:52-53` y `104-126`), y etiquetas muestra el WeChat del proveedor (`etiquetas/page.tsx:72,164-182`). Son datos de contacto de terceros que no son usuarios (punto 12 del checklist). Esta PR no cambia esas lecturas.
- **NO VERIFICABLE:** estado real de la policy en producción (0434 sin aplicar), contenido real de los textos libres del catálogo (no se leyeron filas), y base de licitud y retención de los contactos de proveedores. Esta revisión no es asesoría legal.

### Gobernanza

- SGE-00.05: cumplimiento en SQL (principal, tenant y cliente vivo en la policy). En aplicación hay una no conformidad heredada de `main`, no introducida por esta PR (el catálogo sigue sin tenant explícito), bloqueada por alcance.
- SGE-00.07: no aplica a esta PR (sin cambio de UI); la adopción propuesta lo cumpliría.
- SGE-00.12: cumplimiento; no hubo merge, aplicación ni lectura productiva.
- AUD-01 / MP-01: no aplica (sin mutación ni permanencia).
- Excepción documental: la nota de importación sólo rompe el blob final de la spec; el contenido fuente está comprobado.

## VALIDACIÓN

Commit de producto validado: `6aefb1eec016be2db34217dfed7660c8d41b57cc` (tree `1cb86f71`) sobre `5894538d`. Sin credenciales copiadas ni `.env` operativo. Node 24, corepack pnpm 12.3.4.

| Comprobación | Resultado / alcance |
|---|---|
| guard / claim | PASÓ: `start` desde `3c610701`; guard y claim `c-l22-worker-20260911-claude`; guard `--owner` y rama revalidados antes de cada commit y del push. |
| `corepack pnpm install --frozen-lockfile` | PASÓ: 813 paquetes en 2 min 6 s; lockfile intacto. Aviso heredado de pnpm 12 sobre `pnpm.onlyBuiltDependencies`. |
| Identidad por blob | PASÓ: tabla de COMPLETADO; spec sin la nota = `b014224d`. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ: `dtd-generated-records` verificado. |
| `corepack pnpm sdd:check` | PASÓ: 416 specs / 421 migraciones; sólo choques históricos declarados. |
| `corepack pnpm docs:index` y `docs:check` | PASÓ: índice sincronizado con 416 specs. Repetido tras el fast-forward a `5894538d`: PASÓ. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: 421 en inventario; 403 desde cero (0434 incluida) y 18 sólo-ledger sin cambio de esquema; aislamiento multi-tenant en 219 tablas con 2 tenants sintéticos. El script retiró su propio contenedor `dtd_rebuild_*`. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO / 0 AMARILLO, también tras el fast-forward. Declaraciones intactas. |
| Sonda `tsc --noEmit` del cambio focal con el callee de `main` | FALLÓ, como se esperaba: exit 2, TS2554 ×3. Es la evidencia del bloqueo y no forma parte de la PR. |
| Propuesta no incluida: `tsc`, vitest y eslint | PASÓ: exit 0; 4 archivos / 26 tests; exit 0. |
| vitest focal de esta PR | NO EJECUTADO: la PR no trae tests de aplicación; el test de origen y el test mínimo de scope quedan bloqueados junto con los consumidores. Suites existentes: fila `test` de verify. |
| `corepack pnpm verify` | COLGADO y detenido; cierre incompleto, no PASÓ. Antes de E2E terminaron 15 de 17 pasos: 14 PASÓ y `migrations-applied` NO DISPONIBLE (detalle abajo). El reintento automático de E2E quedó sin salida desde las 07:04:43 y el vigilante marcó COLGADO a las 07:20. Se detuvo sólo el árbol propio con `taskkill /PID 46468 /T /F` a las 07:22:19: 34 procesos registrados, ninguno vivo después. `build` quedó NO EJECUTADO dentro de verify. El `verify.exit = 0` que escribió el shell es un artefacto de la terminación forzada: el log no tiene veredicto final. No se reintentó. |
| `git diff --check` y allowlist | PASÓ: 5 rutas autorizadas en el commit de producto (más este handoff). `queries.ts`, las tres páginas, `actions.ts`, declaraciones, `package.json` y lockfile intactos por blob. |
| CI de la PR #84 sobre `6aefb1ee` | PASÓ: «Calidad local sin secretos» (11 min 47 s, run 34591259834). Vercel Preview y Preview Comments en pass: preview automático del push, no producción. No sustituyen verify ni cubren E2E autenticado ni Supabase. |
| E2E autenticado y `migrations-applied` | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó el ledger productivo. |
| `/ui-check` | NO EJECUTADO: lo corre el Director. Esta PR no cambia JSX ni TSX; la propuesta tampoco toca JSX (sólo la obtención de datos: import, principal y argumento del catálogo). |

Detalle del gate canónico sobre `6aefb1ee`:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18/18. |
| lint | PASÓ, 0 errores y 8 warnings en archivos intactos: `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx` (4), `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx` (2), `app/studio/(app)/crm/_components/KommoBoardView.tsx:124` y `app/studio/(app)/crm/_components/KommoClient.tsx:553`. |
| rsc-boundary | PASÓ, 1597 módulos. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones con Deno 2. |
| test | PASÓ, 526 archivos / 6684 tests en 179,7 s. |
| docs:check, numbering, feature-constants, components:check, governance:check | PASÓ: 416 specs; 421 migraciones sin repetidos nuevos; 5 banderas. |
| migrations-applied | NO DISPONIBLE: SKIP por credenciales ausentes. |
| pending-migration-symbols | PASÓ, 0 / 0. |
| sql-tests | PASÓ: 163 contratos con rollback total, incluido `0434_portal_prealerta_addons_principal_tenant.test.sql`. |
| schema-rebuild | PASÓ: 421 (403 + 18); aislamiento en 219 tablas. |
| e2e | Primera pasada: 151 PASÓ, 15 FALLÓ, 2 flaky y 18 omitidos (10,0 min), más `worker-47 process did not exit within 300000ms after stop, force-killed it`. Los 15 son los ambientales conocidos: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. Flaky: `auth.spec.ts:74` y `smoke.spec.ts:150` (chromium). Reintento automático (186 tests, 8 workers): el último resultado registrado es el test 167 (`[mobile-safari] global-search.spec.ts:22`, fallo ambiental conocido); después no hubo salida desde las 07:04:43, con el dev server registrando la falta de URL/clave Supabase en `proxy.ts:67`. Quedó COLGADO y se detuvo como indica la fila de verify. Resultado: e2e colgado / NO DISPONIBLE. |
| build | NO EJECUTADO dentro de verify, porque el gate se detuvo en e2e. Evidencia sustituta, no equivalente: el CI «Calidad local sin secretos» sobre `6aefb1ee` ejecutó «Build de produccion sin secretos» (`node scripts/check-build.mjs`, `.github/workflows/quality.yml:89-93`) y PASÓ, y el preview de Vercel del mismo SHA terminó en pass. Esta PR no cambia código de aplicación, y `typecheck` PASÓ dentro de verify. |

Recibos fuera de Git, en la carpeta de evidencia de la sesión: `verify.log`, `verify.exit`, `verify.meta`, `schema-rebuild.log`, los logs de docs, sdd y símbolos, `probe-a-tsc-main-callee.log`, `probe-b-tsc-proposal.log`, `probe-b-vitest.log`, `l22-consumers-proposal.patch` y `commit1-staged.diff`.

## COMMITS

- `6aefb1eec016be2db34217dfed7660c8d41b57cc`: SQL, contrato y spec con nota, baseline e índice. Es el árbol validado por verify (tree `1cb86f71c4d6c077bded7e62cf52a560f5296c76`).
- Commit que contiene este documento: cierre del handoff, sólo documentación. El hash final va en la PR.

## PR / BRANCH

[PR #84 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/84), base `main`, rama `codex/c-l22-portal-addons` publicada a sí misma con upstream propio (primer push en `6aefb1ee`). Worktree conservado en la ruta de arriba. Sin merge ni aplicación de migraciones. Fusionar NO autoriza aplicar `0434_portal_prealerta_addons_principal_tenant`.

## PENDIENTES DE ESTA TAREA

- Decisión del Director sobre los consumidores: (A) ampliar la allowlist de L22 con el hunk único de `lib/studio/prealertas/queries.ts` (SDD-0389) y su test, o (B) importar antes el código de SDD-0389. Hasta entonces esta PR no cumple las aceptaciones 2 y 7 del encargo (cambios focales y test de origen), ni el test mínimo de scope de aplicación.
- CI alojado del SHA publicado y revisión del Director.
- E2E autenticado y ledger productivo: NO DISPONIBLES. No autorizan copiar credenciales ni aplicar 0434.

## FUERA DE ALCANCE DETECTADO

- Las specs de aplicación 0388/0389/0398/0399 están en `main` como `done` (entraron sólo como documento en `44c751ea`), pero sin su código: `main` no tiene el tenant explícito que declaran (por ejemplo `queries.ts:104-126`, `135-156`, `203-218` y `471-488`). Hay riesgo de leer esas specs como cierre efectivo.
- `app/portal/(app)/proveedores/actions.ts` sigue resolviendo tenant y markbox con helpers históricos (`174-177`, `358`, `536`, `660`, `752`) y llama al catálogo sin tenant (`266`, `669`). Es dominio de SDD-0389, no de L22.
- Principal dual equipo+Portal: la rama de equipo de la policy (`0150:183`, conservada por 0434 en `55`) permite leer catálogos de dos tenants, y `mergePrealertaAddons` puede mezclar configuraciones. Lo corrige el filtro de aplicación propuesto, no el SQL.
- El test de scope del origen es sólo una regex sobre el fuente y pasa con código que no compila. Si se adopta, conviene acompañarlo del test del callee (incluido en la propuesta).
- Avisos heredados de pnpm 12/npm (`pnpm.onlyBuiltDependencies`, `auto-install-peers`, `strict-dep-builds`), sin cambios de configuración.
- Ocho warnings de lint en archivos intactos, sin errores: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx:124` y `KommoClient.tsx:553`.
- E2E sin configuración Supabase: los mismos 15 fallos ambientales que registraron L16 y L18 (`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en los tres proyectos), más dos flaky conocidos (`auth.spec.ts:74`, cuyo comentario de las líneas 70-72 documenta el flaky de primera compilación, y `smoke.spec.ts:150`). Esta PR no cambia código de aplicación, así que no son una regresión atribuible a L22.
- Runner de Playwright: la primera pasada cerró con `worker-47 process did not exit within 300000ms after stop, force-killed it`, el mismo patrón que L18 registró con `worker-45`. Además, el reintento automático quedó sin salida más de 15 minutos después del test 167 y hubo que detenerlo. Es evidencia del runner, sin diagnóstico de causa raíz; el harness no se modificó.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** decidir A o B. Con A, esta rama puede recibir la propuesta (cuatro rutas de código, el test de origen y el test del callee) y revalidarse; con B, los consumidores de L22 esperan a la tarea de SDD-0389.
- **SQL independiente:** la PR puede integrarse antes o después de aplicar 0434. Fusionarla no autoriza aplicar `0434_portal_prealerta_addons_principal_tenant`.
- **Integración:** baseline e índice se resuelven por unión con el driver `dtd-generated-records`. Esta PR no toca etiquetas; con la propuesta aparece un conflicto trivial de imports con L01.
- **Cierre local incompleto:** verify quedó COLGADO en el reintento de E2E y build no se midió dentro de verify. La compilación de producción la cubre el CI «Calidad local sin secretos» de `6aefb1ee`, que PASÓ. E2E autenticado y ledger siguen NO DISPONIBLES.
- **Sesiones y ownership:** sin subagentes ni sesiones consumidoras delegadas. El ownership se libera con `node scripts/harness-worktree.mjs release --owner c-l22-worker-20260911-claude` después del último push. Worktree y rama se conservan.
- **Procesos y contenedores:** verify se detuvo matando sólo el árbol propio: raíz `sh.exe` 46468 (`corepack pnpm verify`), 34 procesos registrados en el recibo `verify-killed-pids-46468.txt`, ninguno vivo después. Un primer intento apuntó por error al PID 34988, un ancestro que ya no existía, y la comprobación previa impidió matar nada. Los contenedores de rebuild y SQL fueron sólo los propios, con nombre aleatorio, y no quedó ninguno. No se tocaron los contenedores `supabase_*_dtd-pr28-auth…` ni procesos de otras sesiones.
