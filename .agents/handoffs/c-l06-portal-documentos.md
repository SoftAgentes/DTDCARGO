# L06 — Documentos y packing lists del Portal por principal

Fecha: 2026-09-11; ronda 2 el 2026-09-12. Task ID: `c-l06-portal-documentos`.
Owner / sesión escritora: ronda 1 `c-l06-worker-20260911-claude` (terminada y liberada); ronda 2 `c-l06-worker-20260911-ronda2`, por adopción explícita del Director sobre el mismo worktree y la misma rama. Estado: lista-para-revision en PR borrador.
**Ya no aplica el bloqueo migrate-first:** `0406_portal_packing_lists_por_principal` fue aplicada a producción el 2026-09-12 con OK nominal de Sam (ledger `20260912022540`), así que la rama dejó de declararla como espera y puede integrarse en el orden normal.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l06-portal-documentos`.
Rama: `codex/c-l06-portal-documentos`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main al crear; sin avances al cerrar la ronda 1). En la ronda 2 hubo **dos** merges de `origin/main`, ambos sin conflictos: partiendo de `94958f8e` se fusionó `6c282b44` (merge `7521151f`) y, tras aterrizar la PR #78, se fusionó `ce0239268fc5ce2fbdf5ae989efe026fc1b604d5` (merge `ca148f42`). Sin rebase ni force en ninguna ronda.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21 (merge-base con main `2a2e81bf`).
Permisos del encargo: ronda 1 y ronda 2, commits selectivos y push de la rama a sí misma; PR sigue en draft. NO merge, NO aplicar migraciones, NO tocar Supabase, NO deploy. En la ronda 2 el Director marca **cuándo** se publica: los commits quedan locales hasta que llegue el SHA de main posterior a la PR #78.

## OBJETIVO ORIGINAL

Preparar L06 del bloque C (documentos y packing lists del Portal por principal y tenant, RPC 0406, SDD-0342) como PR draft contra main, para integrarla sólo después de aplicar 0406 en producción.

## COMPLETADO

> Lo que sigue describe la **ronda 1** tal como se cerró el 2026-09-11 y se conserva como evidencia fechada. Tres puntos quedaron superados por la ronda 2: el baseline ya no lleva la espera de 0406, la declaración de símbolos `l06-portal-documents-packing-lists-pending-rpc` ya no existe, y la nota de la spec 0342 dice ahora «aplicada en producción». La sección «RONDA 2» manda sobre esos tres.

- **Idénticos por blob al origen:** `0406_portal_packing_lists_por_principal.sql` (`f6c3308e`, 1785 B), su contrato (`2934fefc`, 6485 B), `lib/portal/signed-portal-documents.ts` (`9dfe756e`, 1134 B), `portal-packing-list-documents.test.ts` (`5b0ea4da`, 1422 B) y `signed-portal-documents.test.ts` (`6958dc32`, 2242 B).
- **Spec 0342** exacta desde `ea9952a4` más una nota fechada 2026-09-11 con la forma de 0363: pendiente en baseline, MIGRATE-FIRST, OK nominal de Sam + runbook y corte focal. Sin la nota coincide byte a byte con `13311552` (2664 B). Se conserva el `status: done` histórico y todo el frontmatter; no se reservó número (0342/0406 no existían en main).
- **Adopción focal:** `listarPackingListsComoDocumentos` lee la RPC con la sesión y la página firma mediante el helper `server-only`. Los blobs de main (`5c1182f2`, `d127744f`) son los del merge-base: main no había modificado esos dos archivos desde que #21 se separó (la interacción con 0435–0449 es de base de datos y se verificó aparte). Por eso la página adoptada resulta idéntica al origen (`bbc9bc8d`) y `packing-list-queries.ts` (`c7eb2fd6`) difiere del origen sólo en las líneas 103–104: el docstring SDD-0343 de `obtenerPackingListDeCompra` pertenece a otro lote y queda como en main.
- **Baseline:** sólo la espera `0406_portal_packing_lists_por_principal` (bloque C L06 / SDD-0342; MIGRATE-FIRST; OK nominal de Sam y runbook; name exacto). Al retirarla, el archivo vuelve al blob base `3c5a67d4`; `cutoff: 238` y las esperas 0409/0418/0419/0430 intactas.
- **Declaración** `l06-portal-documents-packing-lists-pending-rpc` con el patrón L16/L05: sitio real `lib/portal/packing-list-queries.ts:231` y cuatro evidencias ancladas (232, 252, `page.tsx:56`, `page.tsx:141`). El gate la rechaza por un defecto del checker (ver VALIDACIÓN); por instrucción del Director se conserva anclada al sitio real.
- **Índice** regenerado con `corepack pnpm docs:index` (416 specs).
- **Tests nuevos:** `portal-packing-list-documents.rpc-state.test.ts` (RPC presente, vacía, ausente PGRST202, denegada 42501, transporte caído; sin lectura directa de tablas), `signed-portal-documents.scope.test.ts` (`signDocumentUrls` real: bucket `shipment-docs`, TTL 3600 s, paths ajenos no expuestos, rechazo de Storage), `PortalDocumentsPage.rpc-state.test.tsx` (composición de la página con RPC ausente/presente y firma no disponible) y el contrato SQL `0406_portal_packing_lists_mismo_markbox.test.sql` (mismo Shipping Mark en dos tenants y fila incoherente entre tenants; el contrato del origen usa Shipping Marks distintos).

## RONDA 2 — 2026-09-12 · 0406 aplicada, espera y declaración retiradas

Adopción explícita del worktree y la rama de la ronda 1, cuya sesión terminó. Antes de editar: `guard` OK, `git status --short` vacío, `HEAD = 94958f8e5c0c050564380c3910adb46a72cce148` como indicaba la asignación, y claim nuevo `c-l06-worker-20260911-ronda2`. No se creó otra rama ni otro worktree; no se ejecutó nada contra Supabase ni se copió ninguna credencial.

### Lo que cambió

- **0406 dejó de ser una espera.** La migración se aplicó a producción el 2026-09-12 con OK nominal de Sam, ledger `20260912022540 / 0406_portal_packing_lists_por_principal`. La aplicación y su verificación las hizo el Director en otra sesión; este Worker no tocó producción. El archivo de esta rama es el aplicado: `md5sum` local da `1502718da4773838c51bf9a460952a95` y 1785 B sobre `supabase/migrations/0406_portal_packing_lists_por_principal.sql`, los mismos que registró el ledger. Por eso `supabase/migrations-baseline.json` vuelve a `cutoff: 238` con `pendingBelowCutoff` vacío y `$doc` intacto, y `supabase/pending-migration-symbol-declarations.json` a `degradations: []`. Los dos quedan **idénticos a `origin/main`** (blobs `93939af9` y `8e52d5b3`): `git diff origin/main -- <archivo>` sale vacío en ambos, así que ya no aparecen en el diff de la PR.
- **Nota de importación de la spec 0342** reescrita con el patrón que main ya usa en `docs/specs/0352-bank-reconciliation-rbac/spec.md` (0409), `docs/specs/0362-portal-academia-tenant-boundary/spec.md` (0418) y `docs/specs/0336-marca-portal-por-principal/spec.md` (0401): migración aplicada, fecha, ledger, identidad del archivo por md5 y bytes, y dónde queda el registro. Frontmatter intacto (`status: done`, `updated: 2026-09-02`): aplicar la migración acredita la migración, no los criterios de la spec. Se conserva el párrafo del corte focal del bloque C.
- **Merge de `origin/main` `6c282b44`** con el driver semántico **de main**, no con la copia de esta rama: la rama nació antes de #88 y #93, y su driver viejo (`8cd8d315`) resucita esperas ya retiradas porque trata el borrado unilateral como «gana quien conserva». Se usó el override del punto 4 «Transición» del ADR-0002, con el driver extraído de `origin/main:scripts/merge-generated-records.mjs` (blob `4a5af4e5`, verificado con `git hash-object`) a un archivo fuera del repo. **El merge no tuvo ningún conflicto**: main y esta rama sólo se cruzan en `docs/specs/README.md` y `supabase/migrations-baseline.json`, y el driver resolvió los dos por unión semántica —retirando del baseline las esperas 0409/0418/0419/0430 que main ya había aplicado y conservando la de 0406, que después se retiró en su propio commit—. Tras este merge la rama ya lleva el driver corregido y el `.gitattributes` de main, que además pone la declaración de símbolos bajo el mismo driver, así que el próximo merge no necesita override.
- **Índice `docs/specs/README.md`:** el resultado del driver ya era el canónico. `node scripts/build-docs-index.mjs` no cambió un byte y `--check` lo confirma sincronizado con 429 specs. Contra main, el índice difiere sólo en lo que aporta esta rama: la fila `| 0342 | Resolver y firmar Documentos del Portal desde el principal | done | interno |`, el conteo 428 → 429 y el retiro de 0342 de la lista de huecos.
- **El gate `pending-migration-symbols` quedó verde por sí solo.** El defecto UTF-16 que la ronda 1 documentó (SDD-0450) está corregido en main —`scripts/tests/pending-migration-symbols-utf16.node.mjs` es su prueba— y, además, sin declaración no hay nada que evaluar: `0 ROJO · 0 AMARILLO declarado(s)`. La dependencia de `c-fix-pending-symbols-utf16` que la ronda 1 anotó como pendiente queda **satisfecha**.

### El camino degradado no quedó muerto

La declaración retirada apuntaba a un `try/catch` que **no se escribió para ella**. `listarPackingListsComoDocumentos` cierra con `} catch { return []; }` (`lib/portal/packing-list-queries.ts:249`), que es el mismo patrón defensivo que main ya trae en ese módulo dos veces (main `:189` y `:265`; en la rama, `:189` y `:249`). Con 0406 aplicada ese catch sigue siendo necesario y correcto: cubre rechazo por ACL, error de PostgREST, transporte caído y un `DROP FUNCTION` futuro. **No se borró nada.**

Los tests que ejercitan el caso «RPC ausente (PGRST202)» se conservan por la misma razón: lo que afirman es el contrato duradero —fallo cerrado, lista vacía y **cero** caída a leer `packing_list_submissions` por Shipping Mark con `service_role`—, no el estado de la migración. El `expect(from).not.toHaveBeenCalled()` sigue siendo la regresión que impide reintroducir el fallback admin sin tenant.

**Los docstrings atrasados sí se corrigieron**, por instrucción del Director y en su propio commit (`46faf3c9`). Eran dos, no uno: `lib/portal/__tests__/portal-packing-list-documents.rpc-state.test.ts:7-8` («L06 migrate-first», «PGRST202 mientras no se aplique») y `app/portal/(app)/documentos/PortalDocumentsPage.rpc-state.test.tsx:5` («L06 migrate-first»). El motivo: un comentario que dice «mientras no se aplique» cuando la migración ya está aplicada es el registro rancio que después hace que alguien saque la conclusión contraria —que el fallo cerrado era provisional y que con la RPC en la base sobra—. Ahora dicen el contrato duradero que los tests afirman, y en la página se aclara que los casos llamados «RPC ausente» simulan la respuesta con un mock y no describen el estado de la base.

**Sólo cambiaron comentarios:** ni una aserción, ni un nombre de test, ni una línea de código. Se barrió además el resto del diff buscando menciones vencidas de «migrate-first», «pendiente», «espera», «declaración» y «mientras no se aplique»: las que quedan son correctas y se dejaron como están —«Todavía no hay documentos.» es el copy del estado vacío, `markboxEsperado` en `packing-list-queries.ts:48,100-124` es de otro lote y describe el packing list del proveedor, y `'TEST 0406: la RPC no existe'` es el mensaje de una aserción del contrato SQL—.

### Segundo merge: `ce023926` (PR #78 aterrizada)

El Director marcó el turno cuando la PR #78 (L04 referidos, SDD-0339 / migración 0404) fusionó. Merge `ca148f42`, **sin un solo conflicto**, con el override del driver **igual que la primera vez** aunque ya no hiciera falta: los tres blobs de `scripts/merge-generated-records.mjs` —el de mi rama, el de `6c282b44` y el del main nuevo— son el mismo `4a5af4e5`, así que el driver del repo ya es el corregido. Se usó el override de todos modos por indicación del Director, para que el resultado no dependa de acertar qué árbol lee git.

Lo que trajo main: la migración `0404_portal_referidos_por_principal` con su contrato, la spec 0339, el árbol de referidos del Portal y el arreglo de harness de SDD-0457 (#94). **Main no tocó ninguno de mis archivos de producto**, y se comprobó por blob: los 12 archivos de producto/spec/SQL de esta rama tienen exactamente el mismo hash antes (`d17f17fa`) y después (`ca148f42`) del merge. Lo único que cambió fue el índice, y lo cambió el driver.

**Comprobaciones que pidió el Director, una por una:**

- **Identidad de 0406 después del merge** — intacta: `md5sum` da `1502718da4773838c51bf9a460952a95`, `wc -c` da **1785**, blob `f6c3308e`. Es byte a byte el archivo que se aplicó a producción. No hizo falta parar.
- **Conteo del índice** — la predicción del Director era **431** con las tres filas (0339 de #78, 0342 de esta rama, 0457 de #94) y **dio 431**, medido no asumido: main venía en 430, el driver dejó 431, `node scripts/build-docs-index.mjs` **no cambió un byte** (blob `45ff75fb` antes y después) y `docs:check` confirma «índice sincronizado con 431 specs». Contra main el índice difiere sólo en 430 → 431, la fila `| 0342 | … |` y el retiro de 0342 de la lista de huecos. No se forzó nada.
- **Los dos registros generados** siguen con **diff vacío** contra el main nuevo. Se confirmó además en el archivo de main, no por suposición: `origin/main:supabase/migrations-baseline.json` trae `cutoff: 238` y `pendingBelowCutoff: {}` —la PR #78 retiró su propia espera de 0404 al fusionar— y `origin/main:supabase/pending-migration-symbol-declarations.json` trae `degradations: []`. Los blobs de main (`93939af9` y `8e52d5b3`) eran **ya idénticos a los de esta rama antes del merge**, así que no hubo nada que reconciliar.

### Diff contra `origin/main` por archivo tras la ronda 2

`git diff origin/main...HEAD --numstat` contra `ce023926` — **14 archivos**. Los 13 de código, spec e índice suman **+839 −44**; este handoff va aparte porque crece con cada edición y cualquier número que escriba acá se invalida al guardarlo. Las cifras son las de `--numstat`, no las estimadas de `--stat` que traía una versión anterior de esta tabla:

| Archivo | Δ | Qué es |
|---|---|---|
| `supabase/migrations/0406_portal_packing_lists_por_principal.sql` | +51 | Migración **aplicada en prod** el 2026-09-12; idéntica al ledger. |
| `supabase/tests/0406_portal_packing_lists_por_principal.test.sql` | +137 | Contrato SQL del origen. |
| `supabase/tests/0406_portal_packing_lists_mismo_markbox.test.sql` | +94 | Contrato nuevo: mismo Shipping Mark en dos tenants. |
| `lib/portal/packing-list-queries.ts` | +7 −23 | `listarPackingListsComoDocumentos` lee la RPC con la sesión; se va la lectura `service_role` por Shipping Mark. |
| `lib/portal/signed-portal-documents.ts` | +36 | Firmador `server-only` de paths releídos por RLS. |
| `lib/portal/__tests__/portal-packing-list-documents.test.ts` | +42 | Test del origen (#21). |
| `lib/portal/__tests__/portal-packing-list-documents.rpc-state.test.ts` | +91 | Estados de la RPC; regresión del fallo cerrado sin fallback admin. |
| `lib/portal/__tests__/signed-portal-documents.test.ts` | +68 | Test del origen (#21). |
| `lib/portal/__tests__/signed-portal-documents.scope.test.ts` | +88 | Alcance real de `signDocumentUrls`: bucket, TTL y paths ajenos. |
| `app/portal/(app)/documentos/page.tsx` | +6 −19 | Composición de la página; JSX sin cambios. |
| `app/portal/(app)/documentos/PortalDocumentsPage.rpc-state.test.tsx` | +131 | Composición de la página con RPC presente/ausente y firma no disponible. |
| `docs/specs/0342-documentos-portal-por-principal/spec.md` | +85 | Spec con la nota de importación **actualizada a «aplicada»**. |
| `docs/specs/README.md` | +3 −2 | Fila 0342, conteo 430 → 431 y hueco 0342 retirado. |
| `.agents/handoffs/c-l06-portal-documentos.md` | (aparte) | Este documento, con la ronda 1 y la ronda 2. |

**Ya no aparecen** `supabase/migrations-baseline.json` ni `supabase/pending-migration-symbol-declarations.json`: quedaron iguales a main. `git diff --check origin/main...HEAD` limpio.

### Validación de la ronda 2

Recibos fuera de Git en `…\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\l06-ronda2\`: `verify.log`, `verify.exit`, `verify.sha`, `verify.start`, `verify.end`, `build2.log`, `build2.exit`, `build2.start`, `build2.end`, `vitest-focal.log`, `vitest-focal2.log`, `eslint-focal.log`, `nota.txt`, `patch-nota.mjs`, `vitest-docstring.log`, `eslint-docstring.log`, `typecheck-docstring.log`, `edits.mjs`, `edits2.mjs`, `edits3.mjs`, `edits4.mjs`, `edits5.mjs`, `edits6.mjs` y, del segundo merge, `merge2.log`, `sql-tests2.log`, `schema-rebuild2.log`, `sdd-check2.log`, `pending-symbols2.log`, `docs-index2.log`, `docs-check2.log`, `vitest-focal3.log`, `eslint-focal3.log`, `typecheck2.log`, `rsc-boundary2.log`, `components2.log` y `governance2.log`, más los dos drivers extraídos `dtd-merge-driver-main.mjs` y `dtd-merge-driver-main2.mjs`. Node 24.20.0, pnpm 12.3.4. Sin `.env` operativo: el árbol sólo tiene `.env.example`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | **PASÓ**: `guard` al tomar el árbol, claim `c-l06-worker-20260911-ronda2`, y `guard --owner` revalidado antes del primer commit. Estado inicial vacío y `HEAD = 94958f8e` como indicaba la asignación. |
| Identidad de 0406 contra el ledger | **PASÓ**: `md5sum` local `1502718da4773838c51bf9a460952a95` y 1785 B, iguales a los que registró el ledger en `20260912022540`. Comprobación local sobre el archivo; **no** se consultó producción. |
| Merge con el driver de `main` (override ADR-0002 §4) | **PASÓ**: driver extraído verificado por blob (`4a5af4e5`), **cero conflictos**, baseline e índice resueltos por unión semántica. Retiró del baseline las esperas 0409/0418/0419/0430 que main ya aplicó y conservó la de 0406. |
| `git diff origin/main -- supabase/migrations-baseline.json` | **PASÓ**: **vacío**. `cutoff: 238`, `pendingBelowCutoff: {}`, `$doc` intacto; blob `93939af9`, el de main. |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | **PASÓ**: **vacío**. `degradations: []`; blob `8e52d5b3`, el de main. |
| `node scripts/build-docs-index.mjs` (`docs:index`) | **PASÓ**: 429 specs, 27 huecos. No cambió un byte: lo que dejó el driver ya era el canónico. |
| `docs:check` | **PASÓ**: índice sincronizado con 429 specs (también dentro de `verify`). |
| `sdd:check` (`numbering`) | **PASÓ**: sin números repetidos; 429 specs · 431 migraciones. Conserva los choques históricos declarados de **migraciones**, entre ellos el de 0342 (`0342_kommo_contact_link` · `0342_phone_match_key_relleno`), ajeno a la spec 0342. |
| `node scripts/check-pending-migration-symbols.mjs` | **PASÓ**: `0 ROJO · 0 AMARILLO declarado(s)`, con el gate corregido de main. |
| ESLint sobre los 8 archivos tocados de producto | **PASÓ**: exit 0, sin errores ni advertencias. |
| Vitest focal — 7 archivos de la tarea | **PASÓ**: 5 archivos / 16 tests (helper, alcance del firmador, estados de la RPC y composición de la página) más `packing-list-queries.test.ts` y `portal-addon-consumers-tenant-scope.test.ts`, 2 archivos / 10 tests. Ninguna regresión. |
| `git diff --check origin/main...HEAD` | **PASÓ**: sin espacios finales ni marcadores; 14 archivos en el diff. |
| `corepack pnpm verify` | **FALLÓ, exit 1** sobre `77371956` (22:50:13 → 23:34:02 −04:00). 16 de 17 pasos corrieron de verdad: **14 PASÓ** (harness, lint, rsc-boundary, typecheck, edge-functions, test, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, schema-rebuild), `migrations-applied` **NO DISPONIBLE** y **2 FALLÓ**: `e2e` y `build`. Veredicto literal: `verify: 2 fallo(s) → e2e, build CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. |
| `verify` · `test` | **PASÓ en el reintento 1/1** que el propio gate contempla para el flaky conocido. Primera pasada: 8 archivos / 16 tests fallados, **los 16 por `Test timed out in 20000ms`** más errores `[vitest-pool]: Failed to start forks worker` (la máquina no pudo forkear workers). Los 8 archivos son ajenos al alcance: `hub-fichas`, `PortalAlertasHub`, `NewReceiptDrawer`, `PortalAddresses.delete-state`, `MobileErpClient.expense-void`, `CotizadorClient.borrado`, `register-error-summary` y `register-ciudad-entrega`. Segunda pasada: **537 archivos / 6751 tests en verde** (180,69 s). Ningún test de L06 falló en ninguna de las dos. |
| `verify` · `sql-tests` | **PASÓ**: 174 contratos con rollback total, incluidos `0406_portal_packing_lists_por_principal` y `0406_portal_packing_lists_mismo_markbox`. |
| `verify` · `schema-rebuild` | **PASÓ**: 413 migraciones aplicadas desde cero, 18 sólo-ledger, aislamiento multi-tenant verificado (219 tablas, 2 tenants). |
| `verify` · `migrations-applied` | **NO DISPONIBLE**: `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`, y el gate lo marca `[AVISO] OMITIDO — no se midio`. El ledger real **no** se midió en este árbol: la evidencia de que 0406 está aplicada es la que entregó el Director. **Dato del Director, no evidencia de este Worker:** confirmó que no hay `.env.local` en ninguna máquina de esta sesión —tampoco en el checkout principal—, así que este paso no lo midió nadie acá nunca; y midió él por MCP contra producción que no hay huecos, que toda migración de main por encima del corte 238 está aplicada, y que las únicas seis presentes en producción sin estar en main son las migrate-first en vuelo, 0406 entre ellas. Queda registrado como dato de él: este Worker no lo verificó y no tiene autorización para hacerlo. |
| `verify` · `e2e` | **FALLÓ (exit 1)**, sin colgarse: la suite terminó en 4,8 min y el watchdog de SDD-0454 no tuvo que intervenir. 152 pasaron, 15 fallaron, 1 flaky, 18 omitidos. Los 15 fallos son **los ambientales conocidos** —`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari—, causados por la falta de configuración de Supabase: sin ella `/studio/login` no pinta `form` y `/studio/dashboard` no rebota al login, y el servidor de pruebas imprime `Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY`. El flaky es `auth.spec.ts:74` en chromium, el mismo de la ronda 1. **Ningún spec de Documentos ni de packing lists falló.** Como validación de acceso el paso es NO DISPONIBLE por falta de configuración, pero **el fallo no se absuelve**. |
| `verify` · `build` | **FALLÓ dentro de verify (exit 1) por red, y PASÓ aislado.** Dentro de verify, Turbopack avisó `Error while requesting resource` para dos subsets `.woff2` de Noto Sans SC en `https://fonts.gstatic.com` y eso derivó en 8 errores `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` en el CSS generado de `next/font/google`, con traza única a `./app/layout.tsx`. **El diff de esta rama no toca `app/layout.tsx`, ni fuentes, ni CSS.** Diagnóstico con evidencia nueva antes de repetir: las dos URL exactas del error responden `HTTP 200` al medirlas con `curl`. Con eso, `node scripts/check-build.mjs` aislado sobre el mismo árbol (23:35:21 → 23:37:34): **PASÓ**, «build de producción OK», `tsconfig.json` restaurado y árbol limpio. No es un reintento de `verify`: es el paso de build, aislado en `.next-verify`. El veredicto de `verify` **sigue siendo FALLÓ**. |
| Corrección de docstrings (`46faf3c9`) | **PASÓ**: vitest sobre los dos archivos tocados, 2 archivos / **8 tests** en verde; ESLint exit 0 sin hallazgos; `corepack pnpm typecheck` exit 0. Recibos `vitest-docstring.log`, `eslint-docstring.log` y `typecheck-docstring.log`. No se volvió a correr `verify` entero: el cambio es de comentarios y `verify` se vuelve a medir después del segundo merge. |
| **Segundo merge (`ca148f42`)** · identidad de 0406 | **PASÓ**: md5 `1502718da4773838c51bf9a460952a95`, 1785 B, blob `f6c3308e`. Sin cambios. |
| **Segundo merge** · `git diff origin/main` de los dos registros generados | **PASÓ**: **0 bytes** en los dos, contra `ce023926`. |
| **Segundo merge** · índice | **PASÓ**: 431 specs. El driver ya dejó el canónico (`build-docs-index.mjs` no cambió un byte) y `docs:check` lo confirma sincronizado. |
| **Segundo merge** · blobs de mis 12 archivos | **PASÓ**: idénticos antes y después del merge; main no tocó ninguno. |
| **Segundo merge** · `sql-tests` | **PASÓ**: **175** contratos con rollback total, ahora con `0404_portal_referidos_por_principal` junto a los dos de 0406. Este gate sí se volvió a correr entero porque el set de migraciones cambió. |
| **Segundo merge** · `schema-rebuild` | **PASÓ**: **414** migraciones desde cero, 18 sólo-ledger, aislamiento multi-tenant verificado (219 tablas, 2 tenants). |
| **Segundo merge** · `sdd:check` / `pending-migration-symbols` | **PASÓ** / **PASÓ**: 431 specs · 432 migraciones sin números repetidos; `0 ROJO · 0 AMARILLO`. |
| **Segundo merge** · `typecheck` / ESLint focal / `rsc-boundary` | **PASÓ** / **PASÓ** / **PASÓ**: exit 0; ESLint sin hallazgos en los 8 archivos; 1598 módulos sin cruces server→client ni client→node. |
| **Segundo merge** · `components:check` / `governance:check` | **PASÓ** / **PASÓ**: CMP-01 válido; 28 políticas aprobadas, cápsula vigente. |
| **Segundo merge** · Vitest focal | **PASÓ**: 8 archivos / **30 tests**, incluidos los nuevos de referidos que main trajo y que comparten `lib/portal`. |
| **Segundo merge** · `install-merge-drivers --check` | **PASÓ**. |
| **Segundo merge** · `corepack pnpm verify` entero | **NO EJECUTADO, y se dice por qué.** Por acuerdo con el Director no se repitió: el merge no tocó producto de esta rama (blobs idénticos) y su veredicto de la corrida anterior sigue en pie en este mismo documento. En su lugar se corrieron por separado **los gates cuyo insumo sí cambió** (sql-tests y schema-rebuild, porque entró 0404) más los rápidos de arriba. **Sin medir en esta pasada:** `harness`, `lint` completo, `edge-functions`, `test` completo (6751), `feature-constants`, `e2e` y `build`. Lo mide el CI alojado sobre el SHA publicado. |
| `/ui-check` | **NO EJECUTADO**: lo corre el Director. El JSX no cambió en ninguna de las dos rondas; esta ronda sólo tocó JSON de registros, una nota de spec y este handoff. |
| Producción / Supabase | **NO EJECUTADO** por límite del encargo: no se aplicó ninguna migración, no se leyeron filas, no se copió ninguna credencial y no se abrió conexión alguna. |
| Publicación / `git push` | **NO EJECUTADO a propósito**: el Director marca el momento. Los tres commits de la ronda 2 quedan locales. |

## DIFF FOCAL POR ARCHIVO

> Tabla de la **ronda 1**, contra main en `3c610701`. Main no volvió a tocar `packing-list-queries.ts` ni `documentos/page.tsx` entre `3c610701` y `6c282b44`, así que sigue describiendo el diff vigente; sólo cambió su base de comparación.

`lib/portal/packing-list-queries.ts` (main → adoptado; resto del módulo intacto):

| main | adoptado | Justificación |
|---|---|---|
| 224–225 «admin client, y el `client_markbox` es acá el control de acceso» | 224–225 «SDD-0342: la RPC deriva el cliente desde auth.uid()» | El contrato del caller cambia; el texto anterior describía el acceso admin por Shipping Mark que desaparece. |
| 228–231 `(admin, markbox)` + `if (!markbox) return []` | 228 `(db: SupabaseClient)` | El caller ya no entrega identidad; la RPC la deriva de `auth.uid()` (0406:38–39). |
| 234–243 `admin.from("packing_list_submissions")…eq("client_markbox")…limit(200)` | 231 `db.rpc("get_portal_packing_list_documents")` | Retira la lectura service_role sin tenant; orden y tope 200 pasan al SQL (0406:40–41). |
| 247–251 normalización del embed `prealertas(code)` | 235 `String(r.purchase_code ?? "").trim()` | La RPC devuelve `purchase_code` plano. |
| 260–261 `created_at` / `total_ctns` | 244–245 `submitted_at` / `boxes` | Nombres de columnas de la RPC (0406:8–14). |
| 265–269 catch → `[]` | 249–253 catch → `[]` | Sin cambio: mismo fallo cerrado. |

`app/portal/(app)/documentos/page.tsx`:

| main | adoptado | Justificación |
|---|---|---|
| 3, 4, 6 imports de admin, `listMyDocuments/getPortalClient` y `signDocumentUrls` | 4 import de `listSignedPortalDocuments` | La página deja de construir service_role. |
| 53 `getPortalClient(supabase)` | — | Sólo servía para pasar el Shipping Mark a la lectura admin. |
| 58–63 `Promise.all(listMyDocuments, admin packing)` | 54–57 `Promise.all(listSignedPortalDocuments(supabase), listarPackingListsComoDocumentos(supabase))` | Ambas fuentes reciben sólo la sesión. |
| 65–70 `signDocumentUrls(createAdminClient(), paths)` sin try | helper `signed-portal-documents.ts:21–35` | Firma server-only de paths releídos por RLS, con fallo cerrado. |
| 78 `docs.map((doc) =>` y 89 `url: urls[doc.storagePath] ?? null` | 65 `signedDocs.map(({ document: doc, url }) =>` y 76 `url,` | La URL llega resuelta desde el helper. |
| JSX 132–175 | JSX 119–162 | Idéntico: sin cambio visual. |

Resumen `/ui-check` (NO EJECUTADO; lo corre el Director): el diff no toca JSX, clases, copy ni componentes; sólo imports y obtención de datos (líneas 1–15 y 52–78 del archivo adoptado).

## FIRMADOR Y RBAC DOCUMENTAL 0435–0444

- **Entradas:** `listSignedPortalDocuments(db)` sólo recibe el cliente de sesión (`signed-portal-documents.ts:18–20`); la página le pasa `supabase` (`page.tsx:55`). No acepta ids ni paths del llamador ni del navegador.
- **Origen de los paths:** `listMyDocuments(db)` (`portal-queries.ts:357–390`) lee `shipment_documents` con la sesión, filtra por el Shipping Mark de `get_portal_client_markbox()` (360–361, 368) y queda sujeta a RLS. Para un cliente Portal la policy aplicable es `shipment_documents portal self read` de 0416 (0416:55–72: `auth.uid()`, vínculo activo, cliente vivo, tenant y envío coherentes). Precisión sobre el encargo: los paths firmados provienen de esa lectura RLS ligada al principal, no de la RPC 0406; los packing lists no son archivos y nunca se firman (`page.tsx:106` enlaza a `/portal/compras/[code]`).
- **Elevación mínima:** sin documentos no se construye service_role (`signed-portal-documents.ts:22`); los packing lists nunca usan admin. El resultado sólo asocia URLs a los paths propios (29–32): una URL de un path ajeno devuelta por Storage se descarta (test de alcance).
- **TTL:** `signDocumentUrls` usa su default de 3600 s (`shipment-document-queries.ts:50`), el mismo que la página de main (main `page.tsx:66–69`, sin TTL propio). El test lo fija en 3600 s sobre el bucket `shipment-docs`, que es privado (0086:69–77).
- **Compatibilidad 0435–0444:** 0439 conserva la lectura Portal de 0416 (0439:7 y postcheck 244–252) y sólo añade `document_entity_authorized` al camino interno por tenant (152–183) y al bucket (185–222). El helper lee con la sesión, así que respeta ambas; la firma con service_role ya existía en main para los mismos paths. Un principal sólo de equipo no obtiene Shipping Mark Portal → `[]` sin elevar (`portal-queries.ts:360–361`). No se abre acceso que esas migraciones cerraron. 0435–0438 y 0440–0444 cambian otras entidades de `documents`, no `shipment_documents`.
- **0449:** su trigger `packing_list_reconcile_labels` es `after insert` sobre `packing_list_submissions` (0449:248–250); la RPC es de lectura y no depende de él. Verificado en base efímera con 0406 aplicada después de 0449.

## COMPORTAMIENTO ANTE FALLO

> Tabla de la **ronda 1**. Con 0406 aplicada el 2026-09-12, la fila «RPC 0406 ausente» deja de describir una ventana de producción: la función existe en la base. Sigue valiendo como contrato de fallo cerrado ante ACL revocada, transporte caído o un `DROP FUNCTION` futuro, y por eso sus tests se conservan.

| Situación | main hoy (`3c610701`) | Código adoptado |
|---|---|---|
| RPC 0406 ausente (PGRST202) | No aplica: main no llama la RPC; lee packing lists con service_role por Shipping Mark (main `packing-list-queries.ts:234–243`). | El helper lanza (232) y su catch devuelve `[]` (249–252), sin fallback. La página conserva los documentos de envío firmados (`page.tsx:55`, 65–78); si el cliente sólo tenía packing lists ve el estado vacío (141). Declarado AMARILLO; migrate-first evita esa ventana. |
| Error o rechazo de la lectura de packing lists | catch → `[]` (main 265–269). | Igual: catch → `[]` (249–253). |
| Falta URL o `SUPABASE_SERVICE_ROLE_KEY` (`createAdminClient` lanza, `lib/db/admin.ts:22–31`) | La página lanza al construir admin para packing lists (main `page.tsx:61`) o para firmar (66–67). | Packing lists no usan admin; la firma captura el error (`signed-portal-documents.ts:24–35`) y la tarjeta muestra «Enlace no disponible» (`DocumentsClient.tsx:151–153`). |
| Storage responde error | `signDocumentUrls` devuelve `{}` (`shipment-document-queries.ts:59`) → URL nula. | Igual; si además rechaza, el catch deja URL nula. |
| Error de `listMyDocuments` | `[]` (`portal-queries.ts:373`). | Igual. |
| Mismo Shipping Mark en dos tenants (`clients` es `unique (tenant_id, markbox)`, 0006:23) | Filtro sólo por `client_markbox` con service_role (main `packing-list-queries.ts:237`): puede listar packing lists de otro tenant. | La RPC exige tenant coherente en vínculo, cliente, packing list y compra (0406:21–37); contrato nuevo PASÓ. |

Conclusión: no empeora. El único modo nuevo de fallo (RPC ausente) es cerrado, sin exposición, y queda fuera de producción por el orden migrate-first. La auditoría (producto:182) advierte que un verde con mocks puede ocultar degradaciones: por eso se prueban RPC presente y ausente en helper y página.

## VALIDACIÓN

> Validación de la **ronda 1**, sobre `1b655967`. La de la ronda 2 está en su propia sección más arriba. Dos resultados de aquí quedaron superados: `pending-migration-symbols` ahora PASA (el defecto UTF-16 se corrigió en main y, sin declaración, no hay nada que evaluar) y el veredicto de `verify` se volvió a medir en la ronda 2, ya con el watchdog de SDD-0454.

Árbol de producto: commit `1b655967010c64542532d9fb4e1beebd62950bcf` sobre `3c610701`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4. Sin credenciales copiadas ni `.env` operativo. Recibos fuera de Git en `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\454d97be-b1e0-4fc9-97e9-c6bb621ba84c\scratchpad\c-l06-portal-documentos\`: `install.log`, `vitest-focal.log`, `focal-checks.log`, `typecheck.log`, `schema-rebuild.log`, `order-check.mjs` + `order-check.log`, `repro-checker.mjs` + `repro-checker.log`, `repro-minimo.mjs` + `repro-minimo.log`, `check-pending-migration-symbols.utf16.mjs` + `pending-symbols-utf16.log`, `verify.log`, `verify.exit`, `verify.meta`, `verify-summary.mjs`, `verify-kill.log`, `procs-before-kill.log`, `procs-chain.log`, `procs-after-kill.log`, `list-l06-procs.ps1`, `chain-l06-procs.ps1`, `build.log`, `build.exit`, `build.meta`, `diff-focal.patch`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio y antes del commit y del push. |
| `corepack pnpm install --frozen-lockfile` | PASÓ, 813 paquetes (25,8 s); aviso heredado `pnpm.onlyBuiltDependencies`. Lockfile intacto. |
| Blobs (`git hash-object` / `git rev-parse HEAD:`) | PASÓ: tabla abajo. |
| Spec sin nota / baseline sin 0406 | PASÓ: `13311552` y `3c5a67d4` exactos. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `sdd:check` | PASÓ: sin números repetidos; conserva colisiones históricas declaradas (entre ellas la de migraciones 0342, ajena a la spec 0342). |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 416 specs sincronizadas. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario 421, 403 desde cero, 18 sólo-ledger, aislamiento multi-tenant (219 tablas, 2 tenants). Contenedor retirado. |
| Orden tipo producción (`order-check.mjs`, fuera del repo) | PASÓ: 398 migraciones no pendientes hasta 0449 y 0406 al final; RPC `SECURITY DEFINER`, `search_path=""`, sin argumentos; EXECUTE sólo `authenticated` (anon/service_role `f`); policies 0416/0439, trigger 0449 y `UNIQUE (auth_user_id)` presentes; 0 filas para usuario sin vínculo. Contenedor `dtd_l06order_c7c2291b` retirado. |
| Contratos SQL focales | PASÓ: origen 0406 y nuevo mismo Shipping Mark, ambos con ROLLBACK. |
| `node scripts/check-pending-migration-symbols.mjs` | **FALLÓ (exit 2) por defecto del checker (enmascarado por code points con caracteres astrales).** Con índices UTF-16: **0 ROJO / 1 AMARILLO**. Detalle y repro abajo. |
| Vitest focal (7 archivos) | PASÓ: 40 tests (origen, existentes de packing list/filtro y nuevos). |
| Typecheck completo / ESLint focal / rsc-boundary | PASÓ / PASÓ / PASÓ (1598 módulos). |
| `corepack pnpm verify` | FALLÓ / INCOMPLETO sobre `1b655967`: 13 de 17 pasos PASÓ; `pending-migration-symbols` FALLÓ (exit 2) por defecto del checker; `migrations-applied` NO DISPONIBLE; e2e FALLÓ/NO DISPONIBLE: colgado, detenido por el Worker según protocolo del Director (puerto 3138); build NO EJECUTADO dentro de verify. Sin veredicto final impreso: `verify.exit = exit=0` es artefacto del wrapper MSYS tras `taskkill`. Detalle abajo. |
| `git diff --check` y allowlist | PASÓ: 15 archivos de producto + este handoff; nada fuera del alcance. |
| `/ui-check` | NO EJECUTADO: lo corre el Director; JSX sin cambios. |
| E2E autenticado, `migrations-applied`, producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |

### Detalle del gate canónico

`corepack pnpm verify` sobre `1b655967` (inicio 04:56:19; recibo `verify.log`, extractor `verify-summary.mjs`). Puerto E2E propio: **3138** («dev server propio en el puerto 3138», línea 330 del log).

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests (22,4 s). |
| lint | PASÓ, 0 errores y 8 advertencias en archivos fuera del alcance: `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`. |
| rsc-boundary | PASÓ, 1598 módulos. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan. |
| test | PASÓ, 6700 tests en 531 archivos (191,15 s). |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ, 416 specs · 421 migraciones; colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (SKIP, exit 3); ledger real sin medir. |
| pending-migration-symbols | FALLÓ (exit 2) por defecto del checker (enmascarado por code points con caracteres astrales); con índices UTF-16: 0 ROJO / 1 AMARILLO. |
| sql-tests | PASÓ, 164 contratos, incluidos `0406_portal_packing_lists_por_principal` y `0406_portal_packing_lists_mismo_markbox`; rollback total. |
| schema-rebuild | PASÓ, 403 desde cero, 18 sólo-ledger, aislamiento multi-tenant (219 tablas, 2 tenants). |
| e2e | **FALLÓ/NO DISPONIBLE: colgado, detenido por el Worker según protocolo del Director.** Primera pasada (13,8 min): 152 pasaron, 15 fallaron, 1 flaky, 18 omitidos. Los 15 fallos son ambientales y coinciden con L16: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari (`proxy.ts:67` sin URL/clave de Supabase). El flaky es `auth.spec.ts:74` (chromium, `ERR_ABORTED`). Además, `worker-47 … force-killed` a los 300 s. El reintento automático de verify arrancó a las 05:21:36 y el log quedó sin salida desde las 05:29:17. No se hizo ningún reintento adicional. |
| build | NO EJECUTADO dentro de verify. CI del SHA `1b655967` (run 34582301730, «Calidad local sin secretos»): failure en «Codigo contra migraciones pendientes» (mismo defecto del checker) y «Build de produccion sin secretos» SKIPPED. Vercel Preview del mismo SHA: completó (no sustituye el gate). Build aislado fuera de verify (`node scripts/check-build.mjs`, 05:50:03–05:52:42 sobre `1b655967`): **PASÓ**, «build de producción OK», `tsconfig.json` restaurado y árbol limpio. No es un reintento de verify: sólo el paso de build, aislado en `.next-verify`. |

Detención según protocolo del Director (recibos `procs-before-kill.log`, `procs-chain.log`, `verify-kill.log`, `procs-after-kill.log`; scripts de sólo lectura `list-l06-procs.ps1` y `chain-l06-procs.ps1`):

- Vigilante de un solo aviso: COLGADO (sin salida en el log por más de 15 min).
- Árbol propio identificado por ruta del worktree, puerto 3138 y cadena de padres: `sh.exe corepack pnpm verify` 23380 → `corepack.js` 45488 → `pnpm-native verify` 44396 → `cmd` 5304 → `verify.mjs` 45176 → Playwright 564 → workers 18388, 38604, 24300, 40104, 45392 y 15416 (con sus `chrome-headless-shell`) y `cmd` 29348 → `next dev --port 3138` 28136 → servidor 42424.
- 05:48:47: `taskkill /PID 23380 /T /F` terminó 30 procesos (exit 0).
- Sin sobrevivientes: 0 procesos con la ruta del worktree, ningún PID de la cadena sigue existiendo y el puerto 3138 no tiene listener. El árbol Git quedó limpio.
- No se tocaron procesos de otras sesiones (se observó un `pnpm typecheck` ajeno iniciado a las 05:48:43).
- `verify.exit` registra `exit=0` porque el wrapper de MSYS no propaga el código de un proceso terminado con `taskkill`. No es un resultado: verify no imprimió su veredicto final.

### `pending-migration-symbols`: defecto del checker y repro

> **Resuelto.** El arreglo entró a main y esta rama lo trae desde el merge `7521151f`; `scripts/tests/pending-migration-symbols-utf16.node.mjs` es su prueba. Lo que sigue es el diagnóstico original de la ronda 1, conservado como evidencia de cómo se detectó.

- **Caminos de la máscara** en `scripts/check-pending-migration-symbols.mjs`: `maskSqlNonCode` construye `const out = [...sql];` (106) y lo consume `extractCreatedSymbols` (180); `maskJavaScriptComments` construye `const out = [...source];` (253) y lo consume `findSymbolReferences` (389). `out` se arma por code points pero se indexa con posiciones UTF-16. En la máscara JS, cada carácter astral desplaza la escritura y pisa saltos de línea.
- **Árbol real** (`repro-checker.log`): `packing-list-queries.ts` mide 12042 unidades UTF-16 y 12040 code points, con astrales en las líneas 36 y 156 (comentarios de main). La máscara vigente deja 171 líneas de 294 y ubica la llamada en `:125`; con índices UTF-16 quedan 294 líneas y la llamada en `:231`. En SQL, la máscara vigente deja sin extraer `comments_freeze_immutable` (0090) y `sales_orders.invoicing_total_boxes`, `prealerta_sales_order_in_tenant` y `sales_order_claim_and_invoice` (0128). Hoy no cambian el resultado de este gate.
- **Repro mínimo** (`repro-minimo.mjs` / `repro-minimo.log`): un comentario de bloque con un emoji antes de la llamada. Fuente de 4 líneas → la máscara vigente deja 2 y reporta `a.ts:1`; con índices UTF-16 deja 4 y reporta `a.ts:3` (real). El caso SQL mínimo no reproduce (esa máscara protege los saltos); el impacto SQL citado es el medido en el árbol real.
- **Con índices UTF-16** (`check-pending-migration-symbols.utf16.mjs`, copia fuera del repo con `texto.split("")` en 106 y 253; `pending-symbols-utf16.log`): **0 ROJO / 1 AMARILLO**, con la declaración y sus cuatro evidencias válidas.
- Por instrucción del Director: la declaración se mantiene en `:231`, el checker no se modifica en esta rama y el cierre no se bloquea. `quality.yml:78` ejecuta el mismo check en CI.

Identidad de blobs (commit `1b655967`):

| Archivo | Blob | Bytes | Relación |
|---|---|---|---|
| `supabase/migrations/0406_portal_packing_lists_por_principal.sql` | `f6c3308e` | 1785 | idéntico al origen |
| `supabase/tests/0406_portal_packing_lists_por_principal.test.sql` | `2934fefc` | 6485 | idéntico al origen |
| `docs/specs/0342-documentos-portal-por-principal/spec.md` | `37c82384` | 3617 | origen + nota |
| `lib/portal/signed-portal-documents.ts` | `9dfe756e` | 1134 | idéntico al origen |
| `lib/portal/__tests__/portal-packing-list-documents.test.ts` | `5b0ea4da` | 1422 | idéntico al origen |
| `lib/portal/__tests__/signed-portal-documents.test.ts` | `6958dc32` | 2242 | idéntico al origen |
| `app/portal/(app)/documentos/page.tsx` | `bbc9bc8d` | 6774 | idéntico al origen |
| `lib/portal/packing-list-queries.ts` | `c7eb2fd6` | 12216 | origen salvo 103–104 (main) |

## REVISIÓN FOCAL DE DATOS (`revisar-datos-ve`)

> Revisión de la **ronda 1**, que sigue vigente: la ronda 2 no cambió ni una línea de código de producto ni de SQL. Un matiz sí cambió: el hallazgo «ENCONTRADO (main, se corrige al aplicar 0406 e integrar)» ya tiene su mitad hecha —0406 está aplicada en producción desde el 2026-09-12—, pero **no** queda cerrado hasta que se fusione y despliegue el código de esta rama: mientras main siga con la lectura `service_role` por Shipping Mark (main `packing-list-queries.ts:234–243`), la exposición cruzada entre tenants con el mismo Shipping Mark sigue abierta en producción. Sigue sin verificarse si hoy existen esas colisiones: no se leyeron filas.

Resumen: 3 CORRECTO · 2 ENCONTRADO (uno preexistente que L06 corrige al aplicar 0406, otro preexistente sin cambio) · 5 NO VERIFICABLE.

Inventario (sólo lo que toca esta pantalla):

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `packing_list_submissions.supplier_company/contact/email/wechat/phone` (0147:44–49) | Contacto del proveedor en China: titular no usuario (punto 12) | Contactar al proveedor (0147:44) | NO VERIFICABLE | Equipo por tenant; **no** sale por la RPC (0406:8–14, 20) |
| `packing_list_submissions.rows`, `total_amount`, `supplier_note` (0147:54, 57, 61) | Mercancía, montos y nota libre | Documento de la compra | NO VERIFICABLE | No salen por la RPC; el detalle de compra es de otro lote |
| `packing_list_submissions.submit_ip/user_agent` (0147:65–66) | Evidencia anti-abuso | Auditoría | NO VERIFICABLE | No salen por la RPC |
| `folio`, `created_at`, `total_ctns` (0147:53, 59, 67) y `prealertas.code` | Identificadores del documento y la compra | Listar en Documentos | NO VERIFICABLE | Cliente titular vía RPC (0406:20) |
| `client_users.auth_user_id`, `clients.markbox`, `tenant_id` | Vínculo e identificador del cliente | Derivar identidad dentro de la RPC | — | No se devuelven (0406:8–14) |
| `shipment_documents.*` (0086:17–31) y objetos del bucket `shipment-docs` | BL, POD y otros; un POD puede contener nombre y firma de quien recibe (titular no usuario) | Documentar el envío | La UI promete «7 años en archivo» (`page.tsx:135`): NO VERIFICABLE | Cliente (0416:55–72), equipo con RBAC de Tracking (0439), service_role sólo para firmar |
| URL firmada | Enlace portador temporal | Descarga | 3600 s (`shipment-document-queries.ts:50`) | Cualquiera con el enlace durante su vigencia |

Hallazgos:

- **CORRECTO — minimización:** la RPC devuelve sólo id, código de compra, folio, fecha y cajas (0406:8–14, 20); el contrato rechaza firmas con tenant/client/email/rows/amount (test 0406:70–72) y filas con contacto o montos (93–99). Norma: SC 332/2001, finalidad y calidad (`marco-legal-ve.md:74`); PIPL art. 6, mínimo alcance (`marco-legal-cn-pipl.md:46–48`).
- **CORRECTO — identidad y tenant:** derivados de `auth.uid()` con vínculo activo, cliente vivo y tenant coherente (0406:21–39); contrato nuevo con el mismo Shipping Mark en dos tenants PASÓ. Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`).
- **CORRECTO (código) — firma acotada:** sólo paths releídos por RLS y admin sólo si hay documentos (`signed-portal-documents.ts:21–32`). No verificado contra una base real con Storage.
- **ENCONTRADO (main, se corrige al aplicar 0406 e integrar):** lectura service_role de packing lists filtrada sólo por Shipping Mark (main `packing-list-queries.ts:234–243`) aunque `clients` sólo es único por tenant (0006:23). Puede listar folio, fecha, cajas y código de compra de otro cliente con el mismo Shipping Mark en otro tenant. Si hoy existen colisiones en producción: NO VERIFICABLE (no se leyeron filas). Arreglo: esta PR con 0406 aplicada. Norma: SC 332/2001, seguridad y confidencialidad.
- **ENCONTRADO (preexistente, sin cambio en L06):** la URL firmada es un enlace portador de 1 h que se abre en pestaña nueva (`DocumentsClient.tsx:181–190`); quien la reciba reenviada puede descargar sin sesión durante esa hora. Arreglo concreto, fuera de alcance: firmar al hacer clic mediante un Route Handler que revalide la sesión y use un TTL corto (p. ej. 60 s). Norma: SC 332/2001, seguridad y confidencialidad.
- **NO VERIFICABLE:** retención real de archivos y filas (promesa de 7 años en `page.tsx:135` sin mecanismo en este alcance); respaldos y registros de Storage/CDN que puedan conservar URLs firmadas; base de licitud y aviso a proveedores en China (PIPL) y a quien firma un POD; contrato con el proveedor de hosting/Storage; comportamiento en producción mientras 0406 no esté aplicada.

Verificación contra datos reales: no ejecutada (sin autorización para producción); la lógica se verificó en Postgres efímero con datos sintéticos. Esta revisión no es asesoría legal; lo marcado NO VERIFICABLE requiere revisión humana y, cuando corresponda, de un abogado.

## COMMITS

Ronda 1:

- `1b655967010c64542532d9fb4e1beebd62950bcf`: SDD-0342 — migración/contratos 0406, spec con nota, adopción focal, firmador, tests, baseline, declaración e índice.
- `94958f8e5c0c050564380c3910adb46a72cce148`: cierre del handoff de la ronda 1.

Ronda 2:

- `7521151f`: merge de origin/main `6c282b44` con el driver de main (override ADR-0002 §4). Sin conflictos; baseline e índice resueltos por unión semántica.
- `6dc493a8`: retirada de la espera 0406 del baseline y de la declaración `l06-portal-documents-packing-lists-pending-rpc`, ahora que la migración está aplicada.
- `77371956`: nota de importación de la spec 0342 actualizada a «aplicada a producción», con el ledger `20260912022540`.
- `deefc9bd`: primer cierre del handoff de la ronda 2.
- `46faf3c9`: docstrings de los dos tests de estado de la RPC, que dejan de decir «migrate-first». Sólo comentarios. Su mensaje se rehízo con `--amend` por un typo, sobre un commit que **nunca** estuvo publicado (el remoto seguía en `94958f8e`); no hubo force push ni reescritura de historia publicada.
- `ca148f42`: merge de origin/main `ce023926` (PR #78, L04 referidos / 0404) con el driver de main. Sin conflictos; sólo el índice se reconcilió, a 431 specs.
- Commit que contiene esta última versión del documento: cierre durable de la ronda 2; es el head publicado en la PR.

## PR / BRANCH

[PR #77](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/77), **sigue en borrador**, base `main`, rama `codex/c-l06-portal-documentos`, worktree indicado arriba. Rama publicada explícitamente a sí misma, sin force: `1b655967` al abrir la PR y `94958f8e` al cerrar la ronda 1. Sin merge, sin aplicar migraciones y sin deploy en ninguna ronda.

**Publicada al cerrar la ronda 2**, en un solo `git push origin codex/c-l06-portal-documentos` de la rama a sí misma, sin force y sin tocar ninguna otra rama. El orden fue el que pidió el Director: los commits quedaron locales mientras la PR #78 estaba en CI, y se publicó recién con main en `ce023926`, después del segundo merge y de la revalidación. Base de la PR: `main`.

**Título y estado actualizados en el mismo acto que el push**, como pidió el Director. Se retiró el prefijo «[NO FUSIONAR ANTES DE APLICAR 0406]» y el «(migrate-first)», que quedaron obsoletos con la aplicación, y quedó el formato aprobado en #78:

> `feat(studio): SDD-0342 — L06 documentos Portal por principal (0406 ya aplicada)`

La PR pasó de **draft a ready for review**. Sigue sin fusionarse y sin desplegarse: eso lo decide el Director.

## PENDIENTES DE ESTA TAREA

- ~~Aplicar 0406 antes de fusionar y después retirar la espera, la declaración y actualizar la nota~~. **Hecho:** 0406 se aplicó el 2026-09-12 (ledger `20260912022540`) y la ronda 2 retiró la espera del baseline y la declaración `l06-portal-documents-packing-lists-pending-rpc`, y actualizó la nota de la spec 0342. El bloqueo migrate-first ya no aplica.
- ~~Depende de la corrección del harness en `c-fix-pending-symbols-utf16`~~. **Hecho:** el arreglo está en main y esta rama lo trae desde el merge `7521151f`. El gate da `0 ROJO · 0 AMARILLO`.
- ~~Segundo merge y publicación a la señal del Director~~. **Hecho:** main llegó en `ce023926`, el merge `ca148f42` entró sin conflictos, se revalidó y se publicó en un solo push, con el título y el paso a ready en el mismo acto.
- **Falta el CI alojado sobre el head publicado**, y es lo que mide de verdad lo que acá quedó sin medir en la segunda pasada: `harness`, `lint` completo, `edge-functions`, `test` completo, `feature-constants`, `e2e` y `build`.
- **`migrations-applied` sin medir** en este árbol por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. La evidencia de que 0406 está aplicada es la que entregó el Director, no una consulta hecha aquí. Esto no autoriza copiar credenciales.
- **`e2e` sin cobertura real** por la misma falta de configuración: los fallos que registra son ambientales, no del producto. Hace falta el CI alojado o una corrida con configuración de Supabase.
- CI alojado del SHA publicado, revisión del Director y `/ui-check` (el JSX no cambió en ninguna de las dos rondas).

## FUERA DE ALCANCE DETECTADO

- ~~**Defecto de `scripts/check-pending-migration-symbols.mjs` (SDD-0450):** máscara por code points indexada en UTF-16 (líneas 106 y 253)~~. **Cerrado en main**: el arreglo y su prueba (`scripts/tests/pending-migration-symbols-utf16.node.mjs`) llegaron a esta rama con el merge `7521151f`. El diagnóstico de la ronda 1 se conserva en VALIDACIÓN como evidencia de cómo se detectó.
- ~~**Docstrings viejos** en los dos tests de estado de la RPC («L06 migrate-first», «PGRST202 mientras no se aplique»)~~. **Corregidos** dentro del alcance, por instrucción del Director, en el commit `46faf3c9`. Ver «El camino degradado no quedó muerto».
- **La exposición cruzada por Shipping Mark sigue abierta en producción** hasta que esta PR se fusione y despliegue: aplicar 0406 crea la RPC, pero main todavía lee `packing_list_submissions` con `service_role` filtrando sólo por `client_markbox`. Ver REVISIÓN FOCAL DE DATOS.
- Allowlist original de 0342 no importada: `scripts/__tests__/portal-service-role-boundary.test.mjs` (el criterio «6 rutas / 12 construcciones» no es verificable en main) y los documentos de auditoría/handoff de #21.
- Premisa del encargo: main no evolucionó `packing-list-queries.ts` ni `documentos/page.tsx` (blobs = merge-base); no hubo nada de SDD-0449/RBAC que conservar en ellos.
- URL firmada portadora de 1 h (preexistente; ver revisión de datos).
- Avisos heredados de pnpm 12 sobre `pnpm.onlyBuiltDependencies`.

## HANDOFF AL DIRECTOR

- **La rama ya no es migrate-first.** 0406 está aplicada (ledger `20260912022540`) y la espera, la declaración y la nota quedaron al día. El orden que falta es: PR #78 fusiona → llega el SHA de main → segundo merge con el override del driver → publicar → CI → revisión → fusionar → desplegar.
- **Título y `ready for review`: hechos** junto con el push. Quedó `feat(studio): SDD-0342 — L06 documentos Portal por principal (0406 ya aplicada)`, sin el prefijo «[NO FUSIONAR…]» ni el «(migrate-first)».
- **Estado de la espera al cerrar esta versión:** el Director avisó que `main` ya está en `664bb4b2` (incluye la PR #94 del harness) con CI verde, pero que la PR #78 va delante y todavía está en CI. **No se fusionó `664bb4b2`**: el segundo merge se hace con el SHA que el Director mande cuando #78 aterrice, y con el override del driver igual, aunque la rama ya lleve el driver corregido —no cuesta nada y no conviene que el resultado dependa de acertar qué árbol lee git—.
- **Publicada.** Un solo push de la rama a sí misma, sin force. Revisá sobre el head publicado y la base `ce023926`. El diff son **14 archivos**; los dos registros generados no aparecen porque quedaron idénticos a main.
- **Para tu verificación de que el producto no se movió**, contra el head que ya revisaste (`94958f8e`): de los 12 archivos de producto/spec/SQL, **nueve tienen el blob idéntico** —`page.tsx` `bbc9bc8d`, `packing-list-queries.ts` `c7eb2fd6`, `signed-portal-documents.ts` `9dfe756e`, `0406…sql` `f6c3308e`, sus dos contratos `2934fefc` y `aa9cec41`, los dos tests de origen `5b0ea4da` y `6958dc32`, y el de alcance `26443b06`— y **tres cambiaron, los tres a propósito y ninguno en su lógica**: `PortalDocumentsPage.rpc-state.test.tsx` `2d20df0a` → `26f29f43` y `portal-packing-list-documents.rpc-state.test.ts` `46775508` → `09e7a813`, sólo el docstring, en `46faf3c9` a pedido tuyo; y la spec `37c82384` → `1aaea599`, sólo la nota de importación, en `77371956`. **Cero cambios en el código que corre.**
- En ninguna ronda se tocó producción, se aplicó una migración, se fusionó a main ni se desplegó.
- Ownership: ronda 1 liberada con `release --owner c-l06-worker-20260911-claude`. La ronda 2 mantiene el claim `c-l06-worker-20260911-ronda2` **tomado** a propósito, porque la escritura no terminó: falta el segundo merge y el push. Se libera después de publicar. Sin subagentes ni contenedores propios activos. Se conservan worktree y rama.
