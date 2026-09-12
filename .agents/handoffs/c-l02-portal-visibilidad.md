# L02 — Visibilidad de hitos del Portal por principal (RPC 0402)

Fecha: 2026-09-11; **ronda 2 el 2026-09-11/12** (0402 aplicada en producción).
Task ID: `c-l02-portal-visibilidad`.
Owner / sesión escritora ronda 1: `c-l02-worker-20260911-claude`. Ronda 2: `worker-c-l02-session-454d97be` (Claude Code, Worker asignado por el Director; el claim de la ronda 1 estaba liberado). Estado: **lista para revisión, PR #76 fuera de borrador**; 0402 ya está APLICADA en producción, así que la PR **deja de ser migrate-first** y no declara nada pendiente. Falta el push, que el Director autoriza en el encargo pero cuyo momento marca él.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l02-portal-visibilidad`.
Rama: `codex/c-l02-portal-visibilidad`. Base de la ronda 1: `3c6107012f754953323202a7386b3e7811593814`. En la ronda 2 se fusionó `origin/main` = `664bb4b22a314eb58161abd6518df653090db78f` (ya incluye la PR #94 del harness) dentro de la rama, sin rebase ni force push.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de la PR #21). Base común con main: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
SDD: `docs/specs/0337-visibilidad-portal-por-principal/spec.md`, importada. No se reservó número: 0337 y 0402 no existían en main.

## OBJETIVO ORIGINAL

Preparar L02 del bloque C como PR draft contra main. Importar la migración 0402, su contrato SQL y la spec 0337. Adoptar de forma focal la lectura de hitos ocultos vía RPC en las versiones vigentes de main de `lib/studio/notifications/portal-visibility-queries.ts` y de las tres páginas del manifiesto. Declarar `0402_portal_hidden_statuses_por_principal` pendiente de aplicar. La PR se integra sólo después de aplicar 0402 en producción.

## COMPLETADO

- Aislamiento comprobado: worktree, rama y base asignados, árbol inicial limpio. Guard y claim PASÓ; guard `--owner` y rama revalidados antes de cada commit.
- Importación exacta desde `ea9952a4`, verificada con `git hash-object` y `cmp` byte a byte, sin CR:

| Artefacto | Blob del origen = importado |
|---|---|
| `supabase/migrations/0402_portal_hidden_statuses_por_principal.sql` | `2641599c16b5aff680684b1f5dffd7efc8434f48` (2068 B) |
| `supabase/tests/0402_portal_hidden_statuses_por_principal.test.sql` | `faa056f3fa39f9d7d7af567a2cd8e0cb0b50e141` (5832 B) |
| `docs/specs/0337-visibilidad-portal-por-principal/spec.md` sin la nota | `fe152f4c7649a27b78b8bf9dcc6aee42634f88e4` (2750 B); blob final con la nota: `b1e386c1a1e4aae70899379c96a6e97716cf1caf` |

- Nota de importación fechada 2026-09-11 bajo el H1, con la forma de la de 0363. Menciona MIGRATE-FIRST y el corte focal; `status: done` y el frontmatter se conservan como estado histórico del origen. Al retirar exactamente la nota se recupera `fe152f4c`.
- **Hallazgo de base:** los cinco archivos de código de main son idénticos a la base común `2a2e81bf`; el diff base→main es vacío en los cinco. Toda la diferencia viene de #21, incluidos los contextos privados excluidos. «Conservar lo de main» significa conservar las páginas vigentes enteras y tomar de #21 sólo la lectura por RPC.

### Adopción focal por ruta (líneas en `a851c88d`)

| Ruta | Cambio | Justificación |
|---|---|---|
| `lib/studio/notifications/portal-visibility-queries.ts` | Añade `getHiddenPortalStatusesForPortal` (L24-56): cuerpo del origen más el registro de fallos de la corrección de revisión (`console.error` en L37-40 y L50-53; helper privado `errorLabel` en L58-69). La cabecera (L11-17) describe el camino por RPC y el motivo del migrate-first. | Es el único lector nuevo. `getHiddenPortalStatusesForClient` y `getHiddenPortalStatuses` quedan byte a byte, con sus tests, para cumplir «conserva lo de main» y «pasan los tests existentes». Quedan sin consumidores; su retiro es decisión del Director. |
| `app/portal/(app)/page.tsx` | Import (L23) y llamada (L63): `getHiddenPortalStatusesForPortal(supabase)` en vez de `getHiddenPortalStatusesForClient(createAdminClient(), client.id)`. | Sólo cambia cómo se obtiene el set. `if (!client) return null` (L45) ya exige principal. Asesor, zarpe, aceptación, naviera y push se conservan. |
| `app/portal/(app)/envios/page.tsx` | Import (L17) y llamada (L56), igual que inicio. | Mismo criterio; `if (!client) return null` en L45. Documentos, packing, consolidados y banner se conservan. |
| `app/portal/(app)/envios/[code]/page.tsx` | Import (L10). En L69-76, RPC **sólo si hay `client`**. `const admin` baja a L80, su primer consumidor. Se retira `resolveClientTenant`, que queda sin llamadas. | Main no consultaba sin cliente (sin tenant, set vacío). La condición conserva ese caso y la precondición del origen, cuyo contexto privado exige principal. Evita también el `limit 1` de la RPC cuando el principal de L18 se anula por vínculos múltiples (`maybeSingle`). El JSDoc de `loadPendingAcceptance` vuelve a quedar sobre su función. |
| `lib/studio/notifications/__tests__/portal-visibility-queries.test.ts` | Conserva los 5 tests existentes (L36-75) y añade el helper y los 3 casos del origen (L77-102) y 2 mínimos: RPC ausente PGRST202 (L123-146) y promesa rechazada (L148-168). Con la corrección, ambos espían `console.error`, exigen una sola llamada con la etiqueta y el código o mensaje exactos, y usan ids ficticios en `details`, `hint` y `cause` (L104-118) para comprobar que el log no lleva ningún id ni UUID. | Aceptación 7, sin debilitar nada. |
| `supabase/migrations-baseline.json` | Sólo la espera `0402_portal_hidden_statuses_por_principal`. | Bloque C L02 / SDD-0337, MIGRATE-FIRST, motivo fail-open, OK nominal de Sam, runbook y name exacto. Cutoff 238, `$doc` y las esperas 0409/0418/0419/0430 intactos: sin la entrada nueva, el JSON es igual a la base. |
| `supabase/pending-migration-symbol-declarations.json` | Grupo `l02-portal-hidden-statuses-pending-rpc`: llamada en `portal-visibility-queries.ts:35`, con evidencia en L36, L39 y L52 (condición y registro de ambas ramas) y en inicio L63, envíos L56 y detalle L75. | Conforme al `$doc` y al patrón de L16. Resultado: 0 ROJO, 1 AMARILLO. |
| `docs/specs/README.md` | Regenerado con `corepack pnpm docs:index`. | 416 specs; entra la fila 0337 y sale del listado de huecos. |

**JSX sin cambios:** los bloques `return` de las tres páginas son idénticos antes y después (inicio 2 de 2, envíos 1 de 1, detalle 1 de 1).

### Comportamiento ante fallo

**Main y el código adoptado son fail-open. Se conserva el criterio del origen, y eso es lo que obliga al migrate-first.**

| Caso | main hoy (`3c610701`; módulo `7a1dce9a`) | Adoptado (`a851c88d`; módulo `f6320102`) |
|---|---|---|
| Lectura | Admin client: `clients.tenant_id` por id (L30-34) y reglas por tenant/cliente (L58-63). | RPC con la sesión; identidad desde `auth.uid()` (L35). |
| Error devuelto por PostgREST | `if (error \|\| !data) return hidden;` (L64): set vacío, sin log. | `if (error \|\| !Array.isArray(data))` (L36): `console.error` con la etiqueta fija y sólo el código o el mensaje (L37-40), y set vacío (L41). |
| Excepción | El catch de L86-88 hace `console.error` y devuelve set vacío; el de `ForClient` (L38-40) devuelve set vacío. | El catch (L49-55) registra igual con `console.error` y devuelve set vacío. |
| Sin principal válido | Inicio y envíos: `return null`. Detalle (L74-77): sin tenant, set vacío. | Igual. Detalle (L74-76): sin `client` no consulta y queda set vacío. |
| Efecto en pantalla | Se muestran todos los hitos, también los que una regla oculta. | Igual. |
| RPC 0402 ausente | No aplica. | PGRST202 en cada vista: set vacío **permanente**. El cliente ve «en aduana» u otro hito que su tenant ocultó; la página no rompe. |

Con 0402 aplicada antes del código, el fallo vuelve a ser transitorio y equivalente a main. La migración es aditiva (función, comentario y ACL) y el código vigente de main no la llama, así que aplicarla primero no altera la operación actual. El fail-open queda declarado en la PR, en este handoff, en la entrada del baseline y en la declaración de símbolos. Tras la corrección de revisión, el adoptado registra las dos ramas de fallo (main sólo registra la excepción), siempre sin ids: la degradación, incluido el PGRST202 permanente, queda visible en los logs.

### Datos personales y gobernanza

- **Datos personales: no aplica.** No se capturan, mueven ni borran datos personales. La RPC devuelve sólo nombres de status (0402, L12 y L43-48), y el contrato exige que la firma no exponga `tenant_id`, `client_id`, `trigger_event` ni `visible_in_portal` (test L100-104). El lector entrega `Set<ShipmentStatus>` (módulo L44-48) y sus registros de fallo llevan sólo el código o el mensaje (`errorLabel`, L58-69). La identidad se resuelve en la base (L25) y la app deja de enviar ids a una lectura con service_role: es minimización. No se abrió `revisar-datos-ve`.
- **SGE-00.05, cumplimiento.** Identidad y tenant en la base (L18-28), EXECUTE sólo para `authenticated` (L55-58). El contrato incluye pruebas negativas de ACL (L80-84), otro tenant (L122-132), vínculo revocado (L134-141) y cliente eliminado (L143-150).
- **SGE-00.12, cumplimiento.** Sin merge, sin aplicar 0402, sin leer producción.
- **ERR-01, no aplica a mensajes.** No hay error visible ni mutación. La observabilidad del fallo se atendió en la corrección de revisión: ambas ramas quedan registradas, sin ids ni datos de la sesión.
- **VIS-01/02, MOT-01, LOD-01, A11Y-01 y CMP-01, no aplica.** JSX idéntico.

## VALIDACIÓN

Producto validado: `b92e68530043b3d37758ce5b69b2c8bc153cd5c1` sobre la base `3c610701`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2. Sin credenciales ni `.env` operativo. Los recibos están fuera de Git, en la carpeta de evidencia del Director (`…/scratchpad/c-l02-portal-visibilidad/`): `install.log`, `vitest-focal.log`, `typecheck.log`, `eslint-focal.log`, `sdd-check.log`, `docs-check.log`, `schema-rebuild.log`, `pending-symbols.log`, `verify.log`, `verify.exit`, `verified-product-manifest.txt`, `diffs/` y `origin/`.

| Comprobación | Estado y evidencia |
|---|---|
| guard / claim / guard `--owner` | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ en 36 s; lockfile intacto |
| Blobs con `git hash-object` + `cmp` | PASÓ (tabla de arriba) |
| Spec sin la nota | PASÓ: igual a `fe152f4c` |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas ya declaradas |
| `corepack pnpm docs:index` y `docs:check` | PASÓ: índice sincronizado, 416 specs |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 421; 403 migraciones desde cero, 18 sólo-ledger sin cambio de esquema, aislamiento multi-tenant en 219 tablas |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO declarado (`get_portal_hidden_shipment_statuses`) |
| Vitest focal `lib/studio/notifications/__tests__/portal-visibility-queries.test.ts` | PASÓ: 10/10 (5 existentes, 3 del origen, 2 nuevos) |
| typecheck y ESLint de las cinco rutas de código (antes del commit) | PASÓ |
| Baseline y declaraciones frente a la base | PASÓ: JSON válido, una sola clave nueva, cutoff 238 y `$doc` iguales |
| `git diff --check` y allowlist | PASÓ: 12 rutas exactas, handoff incluido |
| `corepack pnpm verify` | FALLÓ, exit 1, sobre `b92e6853` (04:39–05:16). Ejecutó 16 de 17 pasos: 15 PASÓ, `e2e` FALLÓ por el entorno y `migrations-applied` quedó omitido. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` El vigilante del Director terminó en FIN, sin cuelgue. No se presenta como verde ni se reintentó a mano. |
| `/ui-check` | NO EJECUTADO: lo corre el Director. JSX idéntico, sin cambio visual |
| E2E autenticado y ledger real | NO DISPONIBLE: sin credenciales, fuera de la autorización |
| CI alojado de la PR | PASÓ: `Calidad continua` / `Calidad local sin secretos` sobre `b92e6853` ([run 34580833291](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34580833291)); todos los pasos en success, incluidos el build de producción sin secretos y el árbol reproducible. No cubre E2E autenticado ni Supabase. Preview de Vercel: pass |

Detalle de `verify`:

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ, 18 tests. |
| lint | PASÓ: 0 errores; 8 advertencias en archivos intactos (`NewPurchaseWizard.test.tsx` 4, `PurchaseStepDetalle.test.tsx` 2, `KommoBoardView.tsx` 1, `KommoClient.tsx` 1). |
| rsc-boundary | PASÓ, 1597 módulos escaneados. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones compilan con Deno 2. |
| test | PASÓ: 6689 tests en 526 archivos (190,6 s). |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ: 416 specs / 421 migraciones; sólo colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (SKIP). No se midió el ledger real; 0402 está pendiente por diseño. |
| pending-migration-symbols | PASÓ: 0 ROJO, 1 AMARILLO declarado. |
| sql-tests | PASÓ: 163 contratos, incluido `0402_portal_hidden_statuses_por_principal.test.sql`; rollback total. |
| schema-rebuild | PASÓ (dentro de verify). |
| e2e | NO DISPONIBLE como validación de acceso/Supabase: el runner corrió y FALLÓ (exit 1) por el entorno, no por L02. Puerto propio 3117; 186 tests con 8 workers. Primera pasada: 150 PASÓ, 15 FALLÓ, 3 flaky y 18 omitidos (14,7 min). Los 15 fallos son los ambientales conocidos de L16/L18: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari; causa observada en `proxy.ts:67`, «Your project's URL and Key are required to create a Supabase client!». Flaky recuperados (chromium): `attachments-gastos-pilot-network.spec.ts:4`, `auth.spec.ts:74` y `calculadora-semantic-colors.spec.ts:5`. Error fuera de test: `worker-49 process did not exit within 300000ms after stop, force-killed it` (cierre de Playwright; log L2658). Reintento automático de verify: 152 PASÓ, los mismos 15 FALLÓ, 1 flaky (`auth.spec.ts:74` en mobile-chrome) y 18 omitidos (11,2 min). Es el reintento 1/1 que trae verify; no hubo reintento manual. Sin credenciales, el E2E no ejerce con sesión las tres vistas del Portal que cambian. |
| build | PASÓ: compilación de producción en 34,3 s, TypeScript y 160/160 páginas estáticas. `check-build` restauró `tsconfig.json`; el árbol versionado quedó intacto al terminar, sin contenedores propios y con el puerto 3117 libre. |

### Corrección de revisión del Director (`a851c88d`)

El Director pidió registrar las dos ramas de fallo del lector adoptado. El cambio queda dentro de `portal-visibility-queries.ts`, su test y los anclajes de la declaración; la semántica (set vacío) no cambia. Recibos: `vitest-focal-fix.log`, `typecheck-fix.log`, `eslint-focal-fix.log`, `pending-symbols-fix.log` y `diffs/fix-logging-*.diff`.

| Comprobación | Estado y evidencia |
|---|---|
| guard, claim y guard `--owner` más rama antes del commit | PASÓ |
| Vitest focal `portal-visibility-queries.test.ts` | PASÓ: 10/10. Los tests de PGRST202 y de promesa rechazada exigen una sola llamada a `console.error` con la etiqueta y el código o mensaje exactos, y ningún id ni UUID en el log |
| `corepack pnpm typecheck` | PASÓ |
| ESLint del módulo y el test | PASÓ, 0 problemas |
| `git diff --check` | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO, 1 AMARILLO; evidencia reanclada a L36, L39 y L52, con la llamada en L35 sin cambio |
| `corepack pnpm verify` | NO EJECUTADO de nuevo, por indicación del Director: el cambio es de registro dentro de un solo módulo, su test y los anclajes de la declaración, sin SQL, JSX, rutas ni dependencias. verify completo ya corrió sobre `b92e6853` |
| CI alojado del SHA final | Se registra en la PR #76: corre al publicar el commit que contiene este documento, que incluye `a851c88d` |

## COMMITS

- `b92e68530043b3d37758ce5b69b2c8bc153cd5c1`: `feat(studio): SDD-0337 — importar L02 visibilidad Portal por principal (migrate-first)`. Contiene SQL, contrato, spec con nota, módulo, test, tres páginas, baseline, declaración e índice; es el producto que validó verify.
- `7733c437de1c248d42be00fbddae05cb4fb8ad90`: `chore(harness): cerrar handoff L02 visibilidad Portal`. Primera versión de este documento; sólo documentación.
- `a851c88d891e1b9859c56a4acd25e6e300f5addf`: `fix(studio): SDD-0337 — registrar fallos del lector de hitos ocultos del Portal`. Corrección de revisión: módulo, test y anclajes de la declaración.
- `092ca77d76f3ab44fe1968ae09997a617d5027f4`: `chore(harness): actualizar handoff L02 tras la corrección de revisión`. Sólo documentación. **Es el head publicado hasta el push de la ronda 2.**

Ronda 2 (todos en local, sin push):

- `c5e477c43607f46becf9cbf4050171a222e3f664`: merge de `origin/main` (`664bb4b2`) en la rama, con el driver de registros generados de main. Sin conflictos.
- `30a089a2`: `chore(db): 0402 aplicada a producción antes de fusionar`. Retira la espera de `migrations-baseline.json`, retira la declaración `l02-…` de `pending-migration-symbol-declarations.json` —ambos quedan idénticos a main— y pasa la nota de 0337 a aplicada, con el ledger. Mismo procedimiento que `b49f1c0b` en L16.
- `cf24f7a5`: `docs(studio): SDD-0337 — el lector ya no anuncia 0402 como pendiente`. Sólo comentarios del módulo y del test; ninguna línea ejecutable, ningún test debilitado.
- Commit que contiene esta actualización del documento: `chore(harness): actualizar handoff L02 con la ronda de 0402 aplicada`. Sólo documentación; el hash final se anota en la PR al publicar.

`docs/specs/README.md` no aparece en un commit propio de la ronda 2: el merge driver ya lo había dejado en el mismo estado que produce `docs:index`, así que la regeneración no cambió ningún byte.

## PR / BRANCH

[PR #76](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/76). Título de la ronda 2: «feat(studio): SDD-0337 — L02 visibilidad Portal por principal (0402 aplicada en producción)»; se retiró el prefijo «[NO FUSIONAR ANTES DE APLICAR 0402]». **Fuera de borrador** (`isDraft: false`). Base `main`; rama `codex/c-l02-portal-visibilidad`, publicada a sí misma con upstream propio. Worktree conservado en la ruta de arriba. El Worker no fusionó ni aplicó migraciones en ninguna ronda.

## RONDA 2 — 0402 APLICADA EN PRODUCCIÓN (retiro de la espera)

Sam autorizó `0402_portal_hidden_statuses_por_principal` nombrándola y el Director la aplicó y verificó. El Worker **no** tocó producción en ninguna ronda: sólo recibió la evidencia y la asentó.

| Dato de la aplicación | Valor |
|---|---|
| Ledger | `20260912022703 / 0402_portal_hidden_statuses_por_principal` |
| md5 del archivo aplicado | `b28cacbbd4d84d736ecd16f1016aa38d` |
| Tamaño | 2068 B |
| Archivo de esta rama | Idéntico: mismo md5 y bytes antes y después del merge; blob `2641599c16b5aff680684b1f5dffd7efc8434f48` sin cambio desde la importación |

**Consecuencia de diseño:** la PR deja de ser migrate-first. El orden se cumplió — la RPC existe en la base antes de fusionar el código que la consume —, así que el fail-open del lector vuelve a ser transitorio y equivalente al de main, en vez de un PGRST202 permanente que mostraría los hitos que una regla del tenant oculta.

### Merge de main

`origin/main` = `664bb4b2` (incluye la PR #94 del harness). Se fusionó con el driver de registros generados **de main**, extraído a un temporal fuera del repo, porque el de la rama es anterior y resucita entradas retiradas. El driver de la rama (`8cd8d315`) y el de main (`4a5af4e5`) difieren en 127 inserciones.

Con el de main el merge quedó **sin un solo conflicto**: los dos únicos archivos que main y la rama tocaban a la vez son registros generados con driver en `.gitattributes` (`docs/specs/README.md` y `supabase/migrations-baseline.json`), y el driver los resolvió preservando lo de main — `pendingBelowCutoff` vacío, sin resucitar las esperas 0409/0418/0419/0430 que main ya retiró — y añadiendo sólo lo de la rama. Ningún archivo de producto entró en conflicto: main no tocó los cinco archivos de código de L02 ni la spec 0337. Merge commit `c5e477c4`.

### Retiro de la espera y de la declaración

| Registro | Estado tras la ronda 2 |
|---|---|
| `supabase/migrations-baseline.json` | **Idéntico a main**, blob `93939af96cbe3bec89c2ab80bdb8073d8ff4fabe` en los dos lados. `cutoff` 238 y `pendingBelowCutoff` en `{}`. `git diff origin/main --` VACÍO |
| `supabase/pending-migration-symbol-declarations.json` | **Idéntico a main**, blob `8e52d5b3d8c5448aaa9d90fb3f8df0199097fdbe` en los dos lados. `degradations` en `[]`; se retiró el grupo `l02-portal-hidden-statuses-pending-rpc` completo. `git diff origin/main --` VACÍO |

**Auditoría del camino degradado (lo pidió el Director):** no quedó código muerto y no se borró nada a ciegas. La declaración retirada era sólo un registro del gate, no una bandera que el código leyera: `getHiddenPortalStatusesForPortal` nunca la importó. Su rama de degradación —`if (error || !Array.isArray(data))` y el `catch`, ambos con `console.error` sin ids y `return new Set()`— sigue siendo correcta y necesaria ahora que la función existe, porque cubre fallos transitorios de PostgREST, del transporte y de caché de esquema sin recargar; es el mismo fail-open que main ya aplica en sus lectores. Los dos tests que la ejercen (PGRST202 y promesa rechazada) se conservan íntegros: verifican el contrato del lector y que el log no lleve ids, no que la RPC falte en producción. Lo único que quedó obsoleto fue **texto**: la cabecera del módulo decía «por eso 0402 se aplica antes de desplegar este consumidor (migrate-first)» y el comentario del test decía «sin 0402 aplicada». Ambos pasaron a describir el fallo como transitorio, en `cf24f7a5`, sin tocar una línea ejecutable.

### Resto de la ronda

- **Nota de la spec 0337** pasada a aplicada en producción, con la redacción aprobada de 0339 en `e0e57054` (L04): cita el ledger `20260912022703`, el md5, los 2068 B, este handoff y que 0402 ya no figura como espera ni tiene declaración. Conserva el aviso de que `status: done` es histórico del origen y el corte focal de L02.
- **`docs/specs/README.md`** regenerado con `corepack pnpm docs:index` (`scripts/build-docs-index.mjs`, blob idéntico al de main): 430 specs, 27 huecos. El diff contra main es exactamente el esperado: 429 → 430, fila 0337 añadida y 0337 fuera de la lista de huecos; la fila 0457 que trae main se conserva. El generador produjo **el mismo byte** que había dejado el driver en el merge, así que el registro quedó consistente sin edición a mano.
- **Metadatos de la PR #76:** título sin el prefijo y fuera de borrador. Se comprobó antes que esto no gasta CI: `.github/workflows/quality.yml` es el único workflow y dispara con los tipos por defecto de `pull_request` (opened/synchronize/reopened); `ready_for_review` no está en la lista y no hay ninguna condición de `draft`. El head remoto sigue en `092ca77d` hasta el push.
- **No se publicó.** Por indicación del Director todo queda commiteado en local: #78 y #77 fusionan antes y moverán main.

### Validación de la ronda 2

Sobre el árbol de la ronda 2, ya fusionado con `664bb4b2`. Recibos en la carpeta de scratchpad de esta sesión (`verify.log`).

| Comprobación | Estado y evidencia |
|---|---|
| guard / claim / guard `--owner` | PASÓ: raíz, rama y owner `worker-c-l02-session-454d97be` revalidados antes de cada commit |
| Diff de `migrations-baseline.json` contra main | PASÓ: VACÍO, blob idéntico |
| Diff de `pending-migration-symbol-declarations.json` contra main | PASÓ: VACÍO, blob idéntico |
| Integridad de 0402 tras el merge | PASÓ: md5 `b28cacbbd4d84d736ecd16f1016aa38d`, 2068 B |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 430 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; sólo las colisiones históricas ya declaradas (0277, 0297, 0336, 0342, 0362, 0363, 0394) |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: **0 ROJO · 0 AMARILLO**. El gate queda limpio, que es la señal de que la espera se retiró de forma consistente |
| Vitest focal `portal-visibility-queries.test.ts` | PASÓ: 10/10, con los dos tests de degradación conservados |
| `corepack pnpm typecheck` | PASÓ |
| ESLint de los cinco archivos de código tocados | PASÓ: 0 problemas |
| `git diff --check` | PASÓ |
| `corepack pnpm verify` | **FALLÓ, exit 1.** Corrieron de verdad 16 de 17 pasos: **15 PASÓ**, `e2e` FALLÓ por el entorno y `migrations-applied` quedó en SKIP. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde ni se reintentó a mano |

Detalle de `verify` en la ronda 2 (los conteos suben porque la rama ya trae main `664bb4b2`):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ |
| lint | PASÓ: **0 errores**, 8 advertencias, todas en archivos que esta tarea no toca (`_prev`/`_fd` sin usar y dos avisos del compilador de React) |
| rsc-boundary | PASÓ: 1597 módulos escaneados en `app`, `lib` |
| typecheck | PASÓ |
| edge-functions | PASÓ |
| test | PASÓ: **6740 tests en 532 archivos**, 0 fallos (222,8 s). Incluye los 10 del lector de hitos ocultos |
| docs:check | PASÓ: índice sincronizado con 430 specs |
| numbering | PASÓ: 430 specs / 431 migraciones; sólo las colisiones históricas ya declaradas |
| feature-constants · components:check · governance:check | PASÓ |
| migrations-applied | **NO EJECUTADO (SKIP)**: falta `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` en el worktree. **El ledger real no se midió acá.** Que 0402 esté aplicada es evidencia del Director, no de este paso. Sin credenciales no se puede medir y copiarlas no está autorizado |
| pending-migration-symbols | PASÓ: **0 ROJO · 0 AMARILLO**. En la ronda 1 había 1 AMARILLO declarado; el retiro de la declaración lo cerró |
| sql-tests | PASÓ: **173 contratos**, con `0402_portal_hidden_statuses_por_principal.test.sql` entre ellos; postgres:17 en contenedor efímero, rollback total |
| schema-rebuild | PASÓ: inventario de 431; 413 aplicadas desde cero, 18 sólo-ledger sin tocar schema, aislamiento multi-tenant verificado en 219 tablas y 2 tenants |
| e2e | **FALLÓ (exit 1) por el entorno, no por L02.** Dos pasadas (la primera más el reintento 1/1 de verify) con el **mismo resultado exacto**: 153 PASÓ / 15 FALLÓ / 18 omitidos, 4,9 y 4,8 min. Los 15 fallos son los ambientales ya conocidos y son **los mismos 15 de la ronda 1**: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. Causa observada en el log: `Your project's URL and Key are required to create a Supabase client!`. Ninguno de los 15 toca las tres vistas de L02: exigen sesión y sin credenciales no se pueden ejercer. Los e2e que sí pasan por `/portal` son redirecciones públicas y PASARON |
| build | PASÓ: build de producción OK, `tsconfig.json` restaurado por `check-build` y el árbol versionado intacto al terminar |

**Lectura honesta del cierre:** `verify` no dio verde y no se lo presenta como tal. El único fallo es `e2e`, por credenciales ausentes, reproducido dos veces con el mismo conjunto de tests que ya fallaba en la ronda 1 sobre un árbol distinto; y `migrations-applied` no se midió. La cobertura que falta es exactamente la que necesita Supabase: E2E autenticado y ledger real. Todo lo demás —incluidos los 6740 unitarios, los 173 contratos SQL, la reconstrucción de esquema y el build— PASÓ.
| `/ui-check` | NO EJECUTADO: lo corre el Director. El JSX sigue idéntico; la ronda 2 no tocó ninguna línea ejecutable de producto |
| E2E autenticado y ledger real contra Supabase | NO DISPONIBLE en local: sin credenciales, fuera de la autorización del Worker |
| CI alojado del SHA de la ronda 2 | NO EJECUTADO todavía: depende del push, que el Director agenda |
## PENDIENTES DE ESTA TAREA

- **Push, cuando el Director dé el SHA de main.** Las PR #78 y #77 fusionan antes; publicar ahora dejaría la rama atrasada y el ruleset la rechazaría. Al recibir el aviso: `git merge origin/main` con el mismo override del driver, revalidar lo afectado y publicar de una sola vez. Publicar ya está autorizado por el encargo; el momento lo marca el Director.
- Revisión del Director y CI alojado del SHA final publicado. `/ui-check` lo corre el Director (el JSX sigue idéntico).
- E2E autenticado y ledger real siguen NO DISPONIBLES en local: sin credenciales. No son permiso para copiarlas. `migrations-applied` sólo se puede medir donde haya credenciales; 0402 ya no es una espera, así que ese paso deja de tener un pendiente por diseño.

## FUERA DE ALCANCE DETECTADO

1. **Observabilidad, resuelta en la corrección de revisión (`a851c88d`).** El lector del origen no registraba nada; ahora ambas ramas registran con `console.error` sólo el código o el mensaje. Main sigue sin registrar los errores que devuelve PostgREST en sus lectores con admin client (L64 de `7a1dce9a`), que quedan sin consumidores.
2. **SQL 0402, `limit 1` sin `order by` (L27).** Con varios vínculos activos, la RPC elige uno arbitrario. En estas vistas lo mitigan el principal de L18 y la condición del detalle. El SQL se importa idéntico.
3. **Lectores con admin client sin consumidores tras L02.** `getHiddenPortalStatuses` interpola `clientId` en `.or()` (L56 de main). Conviene retirarlos después de aplicar y verificar 0402, con decisión del Director. **Ronda 2:** 0402 ya está aplicada, así que la condición se cumple; el retiro sigue fuera del alcance de esta tarea y se mantienen byte a byte con sus tests.
4. **Allowlist histórica de 0337.** Incluye `scripts/__tests__/portal-service-role-boundary.test.mjs` y la meta «10 rutas / 19 construcciones de service_role», que no existen en main; pertenecen al saneamiento de #21 y no se importan.
5. **`supabase/pending-migration-symbol-declarations.json` no tiene merge driver** en `.gitattributes`. #75 (L05) también agrega un grupo, así que al integrar habría conflicto textual en `degradations`. **Ronda 2:** el riesgo se desactivó para esta rama. main tiene `degradations: []`, esta rama ya no aporta ningún grupo y su archivo es idéntico al de main, así que si #75 entra antes del push el próximo merge toma la versión de main sin conflicto. La falta de driver sigue siendo cierta para las demás PRs que sí declaran grupos.
6. **Encargo.** Decía que los cinco archivos «cambiaron en main desde #21»; en realidad main no los tocó desde la base común. No altera el resultado, pero sí cómo se lee el diff.
7. **Entorno E2E.** Los 15 fallos son los ambientales conocidos de L16 y L18: `proxy.ts:67` crea Supabase sin URL ni clave. Hubo flaky recuperados en ambas pasadas y, en la primera, un timeout de cierre de Playwright (`worker-49`, 300000 ms, forzado). Es evidencia del runner, no una regresión atribuida a L02; no se diagnosticó ni se reparó.
8. **Avisos heredados.** Hay 8 advertencias de lint en archivos intactos (`NewPurchaseWizard.test.tsx` 4, `PurchaseStepDetalle.test.tsx` 2, `KommoBoardView.tsx` 1, `KommoClient.tsx` 1) y avisos de npm por `auto-install-peers` y `strict-dep-builds` en la configuración del proyecto. No se tocó configuración.
9. **Contenedores ajenos.** Hay contenedores `dtd_relay_*` y `dtd_fixture_*` detenidos hace 4 días, de otra tarea (`dtd-pr28-auth`). No se tocaron.
10. **Ronda 2 — el driver viejo de registros generados es una trampa para las ramas del bloque C.** `scripts/merge-generated-records.mjs` de esta rama (`8cd8d315`) es anterior al de main (`4a5af4e5`, +127 inserciones) y, sin override, resucita entradas de `pendingBelowCutoff` que main ya retiró (0409, 0418, 0419, 0430). El driver que Git invoca se resuelve desde el árbol de trabajo, así que fusionar main «con el driver de la rama» es exactamente el caso roto. Aquí se evitó extrayendo el de main a un temporal fuera del repo. No se modificó el script en esta rama: el arreglo ya vive en main y el merge lo trajo. **Toda PR del bloque C abierta antes de la #94 arrastra el mismo riesgo**; vale avisarlo al integrar las demás.
11. **Ronda 2 — el `limit 1` sin `order by` de 0402 dejó de ser hipotético.** El hallazgo 2 describía un defecto del archivo; ahora la función está en la base, así que con varios vínculos activos la RPC elige un vínculo arbitrario **en producción**, la llame o no este código. En las tres vistas de L02 lo mitigan el principal de L18 (`maybeSingle`) y la condición del detalle. Sigue fuera de alcance —el SQL se importa idéntico y no se toca—, pero pasó de riesgo en un archivo a riesgo en la base y merece decisión del Director.
12. **Ronda 2 — el título de la PR ya no advierte nada, y eso sube el peso del orden de integración.** Mientras el prefijo «[NO FUSIONAR ANTES DE APLICAR 0402]» existía, el propio título frenaba un merge accidental. Retirado por encargo, la PR queda fuera de borrador con el head remoto todavía en `092ca77d`, que es anterior al merge de main y a este retiro. Hasta el push, el contenido publicado de la #76 **no** corresponde al estado descrito en este documento.

## HANDOFF AL DIRECTOR

- **Orden migrate-first: cumplido.** Los pasos 1 a 4 del plan de la ronda 1 están hechos: la PR se revisó, Sam autorizó 0402 nombrándola, el Director la aplicó y verificó (ledger `20260912022703`) y esta ronda retiró la espera, la declaración y la nota. El gate quedó en 0 ROJO y 0 AMARILLO.
- **Lo que queda del paso 5, en este orden:**
  1. El Director manda el SHA de main cuando #78 y #77 estén fusionadas.
  2. El Worker hace `git merge origin/main` con el mismo override del driver de main, revalida lo afectado y publica de una sola vez.
  3. CI alojado y revisión del SHA publicado; merge con `--match-head-commit`.
- **Producción:** main publica en Vercel, así que la autorización del merge debe cubrir ese efecto. Fusionar no autoriza aplicar 0402, ni aplicar 0402 autoriza fusionar.
- **Compartido con otros lotes:** índice y baseline (con driver) con #69, #70, #72, #73, #74 y #75; declaraciones sin driver con #75. Ninguna PR abierta toca los cinco archivos de código. L03 tocará después la home (import de `getPortalAdvisor` y su llamada) y `portal-queries`, en hunks distintos de los de L02.
- **Decisiones pendientes para el Director:** retirar los lectores con admin client (hallazgo 3). El registro acotado del hallazgo 1 ya está aplicado en `a851c88d`.
- **Ownership:** en la ronda 2 el claim es `worker-c-l02-session-454d97be` y **se mantiene abierto a propósito**, porque falta el push y un último merge de main; se libera con `node scripts/harness-worktree.mjs release --owner worker-c-l02-session-454d97be` cuando termine esa escritura. El claim de la ronda 1 (`c-l02-worker-20260911-claude`) ya estaba liberado, así que no se robó ninguno. No hubo subagentes escritores ni quedan sesiones consumidoras delegadas. Se conservan rama y worktree; no se borró nada.
