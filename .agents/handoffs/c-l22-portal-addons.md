# L22 — Catálogo de add-ons de prealerta Portal por principal (0434)

Fecha: 2026-09-11. Task ID: `c-l22-portal-addons`.
Owner / sesión escritora: `c-l22-worker-20260911-claude` (Worker asignado por el Director; sin subagentes escritores).
Estado de tarea: lista-para-revision. La ronda 1 entregó SQL, contrato, spec, baseline e índice y documentó el bloqueo de los consumidores. La ronda 2, tras la decisión (A) del Director, incorporó el hunk mínimo de SDD-0389 y los tres consumidores.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l22-portal-addons`.
Rama: `codex/c-l22-portal-addons`. Historia de la base, siempre por merge y sin rebase:
- `start` desde `3c6107012f754953323202a7386b3e7811593814`, y fast-forward a `5894538d` (PR #71) antes del primer commit.
- Merge `1168cc09` de `50100cc4` (L19 #69, L21 #70 y la corrección #79).
- Merge `20cbb854` de `c6c673127dea93e6adb9094f6d217cfa1ec6974c` (L20 #72, L15 #73 y L08 #74).
- `fe7c2c5d` restituye el orden de main en el baseline.

Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (PR #21). Base común con main: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0402-portal-prealerta-addons-principal-tenant/spec.md` (`status: done` del origen, con nota de importación). Migración `0434_portal_prealerta_addons_principal_tenant` declarada pendiente. Sin reserva de número: ni la spec 0402 ni la migración 0434 existían en ninguna ref (la migración 0402 de L02 es otra cosa).

## Contrato del encargo

- **Alcance exacto:** migración y contrato 0434; spec 0402; cambios focales en `app/portal/(app)/proveedores/page.tsx`, `app/portal/(app)/compras/nueva/page.tsx` y `app/portal/(app)/compras/[code]/etiquetas/page.tsx`; test de scope del origen; tests nuevos mínimos; baseline; declaraciones sólo si el gate da ROJO; índice; este handoff.
- **Ampliación de la ronda 2 (decisión A del Director):** sólo el hunk de #21 para `listActivePrealertaAddons` en `lib/studio/prealertas/queries.ts` (parámetro opcional `opts: { tenantId?: string } = {}` y `.eq("tenant_id", …)` cuando viene) y el test nuevo del callee. Nada más de SDD-0389 ni de #21.
- **Excluidos:** hunks de marca de L01, otros hunks de #21, otros lotes, cutoff, esperas existentes y la rama de #21.
- **Permisos:** commits selectivos, push de la rama a sí misma sin force y PR draft contra `main`. Prohibidos: merge a main, aplicar 0434, leer producción y deploy.
- **Dependencias:** L18 integrado (principal en `lib/portal/portal-queries.ts`). Etiquetas se comparte con L01 (#82), serializada por el Director. `queries.ts` se comparte con L11 (#81), en otra función. Baseline, índice y declaraciones se comparten con otros lotes.

## OBJETIVO ORIGINAL

Preparar el lote L22 del bloque C como PR draft contra `main`: importar la migración 0434, su contrato y la spec 0402; adoptar los cambios focales de los tres consumidores y el test de scope sobre las versiones vigentes de `main`; declarar 0434 pendiente; y clasificar con evidencia si el código depende de 0434. En la ronda 2, aplicar la decisión (A) del Director sobre el hunk de SDD-0389.

## COMPLETADO

- Aislamiento: `start`, guard y claim PASÓ. En la ronda 2 se reclamó de nuevo. Guard `--owner` y rama se revalidaron antes de cada commit, merge y push.
- Importación por blob exacto (`git cat-file blob` del origen y `git hash-object` del archivo en la rama):

| Artefacto | Blob origen = blob en rama | Bytes |
|---|---|---|
| `supabase/migrations/0434_portal_prealerta_addons_principal_tenant.sql` | `0c2f25c7a2c4ff79d9ad12ec0abec6cdafee6639` | 3233 |
| `supabase/tests/0434_portal_prealerta_addons_principal_tenant.test.sql` | `42a75dd19282ac9ab3e282d6912e6695b09a6519` | 10104 |
| `docs/specs/0402-portal-prealerta-addons-principal-tenant/spec.md`, sin la nota | `b014224d06a4c204c041cd71b2eb15bb48168319` | 2581 |
| `lib/portal/__tests__/portal-addon-consumers-tenant-scope.test.ts` | `16b44cf2af1f749e8db4f9f2b7712ea40b88b0c3` | 660 |

- **Spec final:** `f26174a40d166892788a82d874bf4c103d632466` (3810 B). Sólo añade una nota fechada de 13 líneas bajo el H1, con la forma de 0363, que registra la decisión (A) y la procedencia SDD-0389 del hunk. Al quitar exactamente ese bloque se recupera el blob fuente. Frontmatter, `status: done` y casillas quedan intactos.
- **Baseline:** sólo la espera nueva `0434_portal_prealerta_addons_principal_tenant` («bloque C L22 / SDD-0402», no migrate-first, OK nominal de Sam, runbook y name exacto). Tras el segundo merge, el driver dejó las esperas en otro orden (0431/0433 antes de 0408/0424/0432). `fe7c2c5d` restituye el texto exacto de `origin/main` con 0434 al final; contra main sólo cambian dos líneas: la coma de 0433 y la línea de 0434. `cutoff: 238`, `$doc` y todas las demás esperas quedan intactos.
- **Declaraciones de símbolos:** no corresponden. El gate da 0 ROJO / 0 AMARILLO, también con el checker corregido por #79. 0434 sólo ejecuta `alter policy` (línea 53), sin `execute` ni `format(` y sin caracteres fuera del BMP. El archivo queda idéntico a `main`.
- **Índice:** regenerado con `corepack pnpm docs:index`; tras los merges está sincronizado con 421 specs.
- **Hunk de SDD-0389 (decisión A):** `lib/studio/prealertas/queries.ts:471-489`. Lleva el parámetro opcional (473), el filtro sólo si viene tenant (481) y conserva el respaldo de defaults (489). La función es idéntica byte a byte a la de #21, docstring incluido (28 líneas). Los llamadores sin opciones (`app/portal/(app)/proveedores/actions.ts:266` y `:669`) no cambian.
- **Consumidores:** proveedores (líneas 3, 29-31 y 36), nueva compra (4, 33-35 y 40) y etiquetas (7, 49-51 y 87). En Etiquetas quedan intactos la marca (`resolveBrandForClient`, 65), `getLabelPresentation` (68, que pasa `presentation.settings` a `LabelsClient`), `listPredeclaredBoxes` (79) y la firma de adjuntos vigente. `listSuppliers`, `listPrealertas`, `getPrealertaByCode` y `listPrealertaServiceRequests` siguen sin tenant: son hunks de SDD-0399, excluidos. El JSX no cambia en ninguna página. Los blobs son iguales a la propuesta validada.
- **Tests:** el test de scope del origen (blob exacto, regex sobre el fuente) y el test nuevo del callee `lib/studio/prealertas/__tests__/addons-tenant-scope.test.ts` (blob `8bd09f19`). Este último tiene tres casos: tenant antes del límite, sin tenant no filtra y un fallo de lectura conserva los defaults activos.

### Por qué se amplió el alcance (ronda 1)

El cambio focal de SDD-0402 es `listActivePrealertaAddons(supabase, { tenantId })`; el commit origen `ac190356` no toca `queries.ts`. En `main` el callee tenía un solo parámetro. La opción la introdujo en #21 **SDD-0389** (`cc6242cd`). Su spec está en `main` (blob `ea9bf0ee`, `status: done`), pero entró sólo como documento en `44c751ea`; su código nunca llegó. Ninguna otra ref la traía.

Una sonda con ediciones temporales, revertidas, lo confirmó en dos pasos:
- sobre el callee de `main`, `tsc` dio exit 2 con `TS2554` en `etiquetas/page.tsx(87,41)`, `compras/nueva/page.tsx(40,41)` y `proveedores/page.tsx(36,41)`;
- en ese mismo estado el test de origen pasaba 3/3, porque es sólo una regex.

Con el hunk de #21, `tsc`, vitest y eslint pasaron. El Director eligió la opción (A): ampliar la allowlist sólo con ese hunk. La alternativa (B) era importar antes todo SDD-0389.

### Diff focal

```diff
--- lib/studio/prealertas/queries.ts
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

```diff
--- en las tres páginas, con la misma forma
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

### Clasificación migrate-first y comportamiento ante fallo

**No es migrate-first.** 0434 no crea RPC, columnas, funciones ni otros símbolos: su único DDL es `alter policy` (líneas 53-66) y el gate de símbolos da 0 ROJO. El código de la PR sólo usa la columna `tenant_id` de `prealerta_addons`, que existe desde 0150, y no llama nada que nazca en 0434. Se puede fusionar antes de aplicarla, y aplicarla antes o después no rompe nada.

| Escenario | Qué pasa, con líneas |
|---|---|
| `main` hoy | `getPortalClient` delega en el principal L18 (`lib/portal/portal-queries.ts:125-129` → `111-119` → `59-109`). Con un principal inválido (`72-74`, `83-89`) la página devuelve `null` antes del catálogo. El catálogo va sin filtro bajo la RLS histórica (`0150_prealerta_addons.sql:180-185`). Un fallo de lectura cae a los defaults (`lib/studio/prealertas/addons.ts:83-170`, merge en `193-216`). |
| Esta PR, antes de 0434 | El principal se resuelve igual (`proveedores/page.tsx:29-31`, `compras/nueva/page.tsx:33-35`, `etiquetas/page.tsx:49-51`) y el catálogo se filtra por `principal.tenantId` (`queries.ts:481`). El principal exige un solo vínculo activo (`maybeSingle`, `72-74`), así que ese tenant coincide con `get_portal_client_tenant()` y devuelve las mismas filas. Un principal que es a la vez equipo y Portal deja de mezclar dos tenants (rama `0150:183`). Si falla la lectura, defaults (`queries.ts:489`), igual que `main`. |
| Esta PR, después de 0434 | Igual que la fila anterior; la policy (`0434:56-65`) y el filtro se suman. Un vínculo incoherente, revocado o con cliente borrado obtiene 0 filas por RLS, y esas sesiones además no pasan el guard de la página. Si el preflight detecta drift, la migración aborta y queda la policy histórica (`0434:5-51`). |
| Llamadores sin opciones (`proveedores/actions.ts:266,669`) | Sin cambio: sin `opts` no se aplica filtro (lo cubre el test del callee). Tras 0434, ante un vínculo anómalo, pasan de leer el catálogo de otro tenant a 0 filas y defaults, sin fuga entre tenants. Cerrar esas acciones es dominio del resto de SDD-0389. |

Ninguna variante empeora a `main`.

### Revisión focal de datos (`revisar-datos-ve`)

- **Inventario:** `prealerta_addons` (`0150_prealerta_addons.sql:38-57`) guarda configuración comercial por tenant: `code`, `label`, `description`, `notas_placeholder`, `consent_text`, `video_url`, `multi_tracking`, `sort`, `is_active` y fechas. Ninguna columna identifica a una persona natural.
- **Quién lee qué:**
  - equipo del tenant, por `get_user_tenant_id()` (rama conservada, `0434:55`);
  - cliente Portal, sólo con vínculo activo, cliente vivo y el mismo tenant (`0434:56-65`; antes `0150:184`), y en aplicación sólo el catálogo del tenant de su principal (`queries.ts:481`);
  - `service_role`, todo (`0150:193-195`).

  Escribe sólo el equipo (`0150:188-191`). Los grants (`0150:168,171`) y el trigger de auditoría (`0293_audit_d5_residual_and_writer_retirement.sql:521-522`) quedan intactos; 0434 no tiene DML.
- **CORRECTO** (código y contrato local): vínculo incoherente, revocado o con cliente borrado da 0 filas; principal coherente, equipo y `service_role` conservan su lectura (`supabase/tests/0434_portal_prealerta_addons_principal_tenant.test.sql:198-263`); el RED histórico se reproduce antes del fix (`119-131`). El test del callee prueba el filtro por tenant antes del límite. Todo con PostgreSQL desechable, mocks y datos sintéticos.
- **Fuera del cambio:** las páginas también leen `suppliers_cn` (`name`, `city`, `wechat`, `contact`, `notes`; `queries.ts:52-53`, `104-126`), y etiquetas muestra el WeChat del proveedor. Son datos de contacto de terceros que no son usuarios (punto 12 del checklist). Esta PR no cambia esas lecturas.
- **NO VERIFICABLE:** estado real de la policy en producción (0434 sin aplicar), contenido real de los textos libres del catálogo (no se leyeron filas), y base de licitud y retención de los contactos de proveedores. Esta revisión no es asesoría legal.

### Gobernanza

- SGE-00.05: cumplimiento; principal, tenant y cliente vivo en la policy, y tenant explícito en los tres consumidores.
- SGE-00.07: cumplimiento; la UI consume el tenant durable del principal autorizado.
- SGE-00.12: cumplimiento; no hubo merge a main, aplicación ni lectura productiva.
- AUD-01 / MP-01: no aplica (sin mutación ni permanencia).
- Excepción de alcance autorizada: el hunk de SDD-0389 en `queries.ts` y su test quedan fuera de la allowlist original de 0402, por decisión (A) del Director. Excepción documental: la nota de importación sólo rompe el blob final de la spec, y el contenido fuente está comprobado.

## VALIDACIÓN

verify completo corrió sobre `968258c5d1859270192f5c9f9f6a0973a81e5565` (tree `f669d379`, merge de `50100cc4`). El segundo merge sólo trajo lotes SQL de main: 0408, 0424 y 0432, con sus contratos, specs, handoffs, baseline e índice. No tocó `lib/`, `app/`, `components/`, `scripts/`, `package.json`, el lockfile ni las declaraciones. Por eso lo afectado se revalidó sobre el SHA de producto final `fe7c2c5d9ba2692e857ff6dda08136b9aa336c93`, sin repetir el E2E. Sin credenciales copiadas ni `.env` operativo.

| Comprobación | Resultado / alcance |
|---|---|
| guard / claim | PASÓ; reclamado de nuevo en la ronda 2 y revalidado antes de cada commit, merge y push |
| Merges de `origin/main` | PASÓ: `1168cc09` y `20cbb854` sin conflictos. El orden del baseline se corrigió en `fe7c2c5d` (ver COMPLETADO) |
| Parche de la propuesta validada | PASÓ: `git apply` limpio (sha256 `6a5f4f6bea06cf08a709a6a6259d05ca4f9d01d411cb3020b089d9e0dc48a226`); blobs iguales a los validados |
| Identidad por blob | PASÓ: tabla de COMPLETADO; spec sin la nota = `b014224d` |
| `corepack pnpm typecheck` | PASÓ en `968258c5` y en `fe7c2c5d` |
| ESLint focal (6 archivos) | PASÓ en `968258c5` y en `fe7c2c5d` |
| vitest focal | En `968258c5`: PASÓ, 9 archivos / 136 tests. En `fe7c2c5d`: el primer intento FALLÓ por infraestructura, porque 8 de 9 archivos no arrancaron (`Timeout waiting for worker to respond`) mientras corrían en paralelo los contenedores de SQL y rebuild; 0 aserciones fallidas. Repetido sin carga: PASÓ, 9 archivos / 136 tests (08:35), sin errores no manejados |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ, 0 ROJO / 0 AMARILLO, en ambos SHA |
| `corepack pnpm docs:check` / `sdd:check` | PASÓ: 418 specs en `968258c5` y 421 en `fe7c2c5d`; sólo choques históricos declarados |
| `node scripts/run-sql-tests.mjs` sobre `fe7c2c5d` | PASÓ: 168 contratos con rollback total, incluidos 0408, 0424, 0432 y 0434 |
| `node scripts/check-schema-rebuild.mjs` sobre `fe7c2c5d` | PASÓ: 426 en inventario; 408 desde cero (con 0408, 0424, 0432 y 0434) y 18 sólo-ledger; aislamiento multi-tenant en 219 tablas |
| `git diff --check` y allowlist | PASÓ: 12 rutas frente a la base de merge `c6c67312` (las 11 autorizadas más este handoff). Declaraciones, `actions.ts`, `package.json` y lockfile intactos. `queries.ts` sólo cambia dentro de `listActivePrealertaAddons` |
| `corepack pnpm verify` sobre `968258c5` | FALLÓ, exit 1, veredicto literal `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Sin cuelgue. Detalle abajo |
| CI | `6aefb1ee` PASÓ (ronda 1). `968258c5` PASÓ: «Calidad local sin secretos» (14 min 18 s, run 34595018510, incluye «Build de produccion sin secretos»), más Vercel Preview y Preview Comments. El CI del SHA final se registra en la PR |
| E2E autenticado y `migrations-applied` | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó el ledger |
| `/ui-check` | NO EJECUTADO: lo corre el Director; sin cambios JSX (sólo import, principal y argumento del catálogo) |

Detalle de verify sobre `968258c5`:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18/18. |
| lint | PASÓ, 0 errores y 8 warnings en archivos intactos. |
| rsc-boundary | PASÓ, 1597 módulos. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones. |
| test | PASÓ, 528 archivos / 6690 tests: dos archivos y seis tests más que en la ronda 1, que son los nuevos. |
| docs:check, numbering, feature-constants, components:check, governance:check | PASÓ: 418 specs / 423 migraciones; 5 banderas. |
| migrations-applied | NO DISPONIBLE: SKIP por credenciales ausentes. |
| pending-migration-symbols | PASÓ, 0 / 0. |
| sql-tests | PASÓ: 165 contratos con rollback total, incluido 0434. |
| schema-rebuild | PASÓ: 405 desde cero + 18 sólo-ledger; aislamiento en 219 tablas. |
| e2e | FALLÓ por entorno. Primera pasada: 153 PASÓ, 15 FALLÓ, 18 omitidos, sin flaky. Reintento: 152 PASÓ, 15 FALLÓ, 1 flaky (`calculadora-semantic-colors.spec.ts:53`, mobile-chrome) y 18 omitidos. Los 15 son los ambientales conocidos: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. |
| build | PASÓ: Next.js 16.2.11, 160/160 páginas estáticas. Hay avisos esperables de getters públicos sin URL/clave Supabase. |

Ronda 1, como registro histórico, sobre `6aefb1ee`:
- **PASÓ:** instalación congelada, `install-merge-drivers --check`, rebuild standalone y CI.
- **COLGADO:** verify quedó colgado en el reintento de E2E y se detuvo sólo el árbol propio (`taskkill /PID 46468 /T /F`, 34 procesos, ninguno vivo después). En esa ronda, build quedó NO EJECUTADO dentro de verify y el `verify.exit = 0` fue un artefacto de la terminación forzada.

Recibos fuera de Git, en la carpeta de evidencia de la sesión: los de la ronda 1 (`verify.log`, `verify-killed-pids-46468.txt`, sondas y parche) y los de la ronda 2 bajo `r2/`: `verify.log`, `verify.meta`, `typecheck*.log`, `vitest-focal*.log`, `pending-symbols.log`, `sql-tests-final.log` y `schema-rebuild-final.log`.

## COMMITS

- `6aefb1eec016be2db34217dfed7660c8d41b57cc`: SQL, contrato y spec con nota, baseline e índice.
- `841f2b48c0dba1c2edfd4757478532f26406f987`: handoff de la ronda 1 (bloqueo documentado).
- `1168cc09`: merge de `origin/main` (`50100cc4`).
- `b1cacdea`: hunk SDD-0389 de `listActivePrealertaAddons` y test del callee.
- `968258c5d1859270192f5c9f9f6a0973a81e5565`: tres consumidores, test de origen y nota de la spec; árbol de verify.
- `20cbb854`: merge de `origin/main` (`c6c67312`).
- `fe7c2c5d9ba2692e857ff6dda08136b9aa336c93`: baseline con el orden exacto de main más 0434; SHA de producto final.
- Commit que contiene este documento: cierre del handoff, sólo documentación. El hash final va en la PR.

## PR / BRANCH

[PR #84 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/84), base `main`, rama `codex/c-l22-portal-addons` publicada a sí misma sin force. El título ya no dice «consumidores bloqueados». Worktree conservado en la ruta de arriba. Sin merge ni aplicación de migraciones. Fusionar NO autoriza aplicar `0434_portal_prealerta_addons_principal_tenant`.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación o preparación del lote.
- Quedan la revisión del Director y el `/ui-check` que le corresponde.
- E2E autenticado y ledger productivo: NO DISPONIBLES. No autorizan copiar credenciales ni aplicar 0434.

## FUERA DE ALCANCE DETECTADO

- **El resto de SDD-0389 sigue sin código en `main`.** Sólo se importó el hunk de `listActivePrealertaAddons`. Faltan:
  - las acciones de `app/portal/(app)/proveedores/actions.ts`, que siguen resolviendo tenant y markbox con helpers históricos (`174-177`, `358`, `536`, `660`, `752`) y llaman al catálogo sin tenant (`266`, `669`);
  - el tenant explícito en `getPrealertaByCode`, `listSuppliers`, `listPrealertas` y `listPrealertaDocuments`.

  Las specs 0388/0389/0398/0399 figuran como `done` en `main` (entraron sólo como documento en `44c751ea`), así que hay riesgo de leerlas como cierre efectivo.
- El merge driver `dtd-generated-records` conservó el orden «nuestro» de las esperas y añadió detrás las nuevas de main, así que el baseline mergeado no coincidía textualmente con main. Aquí se corrigió a mano (`fe7c2c5d`). Conviene revisar ese comportamiento del driver para los demás lotes.
- El test de scope del origen es sólo una regex sobre el fuente; la cobertura real la da el test del callee.
- Ocho warnings de lint en archivos intactos, sin errores: `NewPurchaseWizard.test.tsx` (4), `PurchaseStepDetalle.test.tsx` (2), `KommoBoardView.tsx:124` y `KommoClient.tsx:553`.
- E2E sin configuración Supabase: los 15 fallos ambientales conocidos y varios flaky: `auth.spec.ts:74` y `smoke.spec.ts:150` en la ronda 1, `calculadora-semantic-colors.spec.ts:53` en la ronda 2.
- Runner de Playwright: en la ronda 1 hubo un cierre forzado de `worker-47` y un reintento colgado. Es evidencia del runner, sin diagnóstico de causa raíz; el harness no se modificó.
- El pool de vitest no arranca los workers a tiempo cuando la máquina corre en paralelo los contenedores de SQL y rebuild. Es un problema de planificación de mi validación, no de producto.
- Avisos heredados de pnpm 12/npm (`pnpm.onlyBuiltDependencies`, `auto-install-peers`, `strict-dep-builds`), sin cambios de configuración.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #84 con la ampliación (A) aplicada, correr `/ui-check` si lo consideras necesario (no hay JSX nuevo) y decidir la integración. Fusionarla no autoriza aplicar 0434.
- **Integración:** baseline e índice se resuelven por unión con el driver. Después hay que revisar que el orden del baseline coincida con main (ver FUERA DE ALCANCE). Con L01 (#82) hay un conflicto trivial de imports en etiquetas (línea 6 de L01 contra la 7 de L22); conservar ambos. Con L11 (#81) no se espera solapamiento textual en `queries.ts`: la otra función está unas 45 líneas más abajo.
- **Cierre local:** verify sobre `968258c5` sólo falló en E2E por entorno, con `migrations-applied` sin medir; build PASÓ. La revalidación afectada sobre `fe7c2c5d` está en VALIDACIÓN, y el CI del SHA final en la PR.
- **Sesiones y ownership:** sin subagentes ni sesiones consumidoras delegadas. El ownership se libera con `node scripts/harness-worktree.mjs release --owner c-l22-worker-20260911-claude` después del último push. Worktree y rama se conservan.
- **Procesos y contenedores:** sólo se usaron los propios, con nombre aleatorio. No se tocaron los contenedores `supabase_*_dtd-pr28-auth…` ni procesos de otras sesiones.
