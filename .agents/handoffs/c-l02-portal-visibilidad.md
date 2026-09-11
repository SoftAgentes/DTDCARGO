# L02 — Visibilidad de hitos del Portal por principal (RPC 0402)

Fecha: 2026-09-11. Task ID: `c-l02-portal-visibilidad`.
Owner / sesión escritora: `c-l02-worker-20260911-claude` (Claude Code, Worker asignado por el Director). Estado: lista-para-revision en PR draft; **migrate-first**, no se fusiona antes de aplicar y verificar 0402.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l02-portal-visibilidad`.
Rama: `codex/c-l02-portal-visibilidad`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main; no avanzó durante la tarea).
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

### Adopción focal por ruta (líneas en `b92e6853`)

| Ruta | Cambio | Justificación |
|---|---|---|
| `lib/studio/notifications/portal-visibility-queries.ts` | Añade `getHiddenPortalStatusesForPortal` (L24-46) con **cuerpo idéntico al origen**. La cabecera (L11-17) describe el camino por RPC y el motivo del migrate-first. | Es el único lector nuevo. `getHiddenPortalStatusesForClient` y `getHiddenPortalStatuses` quedan byte a byte, con sus tests, para cumplir «conserva lo de main» y «pasan los tests existentes». Quedan sin consumidores; su retiro es decisión del Director. |
| `app/portal/(app)/page.tsx` | Import (L23) y llamada (L63): `getHiddenPortalStatusesForPortal(supabase)` en vez de `getHiddenPortalStatusesForClient(createAdminClient(), client.id)`. | Sólo cambia cómo se obtiene el set. `if (!client) return null` (L45) ya exige principal. Asesor, zarpe, aceptación, naviera y push se conservan. |
| `app/portal/(app)/envios/page.tsx` | Import (L17) y llamada (L56), igual que inicio. | Mismo criterio; `if (!client) return null` en L45. Documentos, packing, consolidados y banner se conservan. |
| `app/portal/(app)/envios/[code]/page.tsx` | Import (L10). En L69-76, RPC **sólo si hay `client`**. `const admin` baja a L80, su primer consumidor. Se retira `resolveClientTenant`, que queda sin llamadas. | Main no consultaba sin cliente (sin tenant, set vacío). La condición conserva ese caso y la precondición del origen, cuyo contexto privado exige principal. Evita también el `limit 1` de la RPC cuando el principal de L18 se anula por vínculos múltiples (`maybeSingle`). El JSDoc de `loadPendingAcceptance` vuelve a quedar sobre su función. |
| `lib/studio/notifications/__tests__/portal-visibility-queries.test.ts` | Conserva los 5 tests existentes (L36-75) y añade el helper y los 3 casos del origen (L77-102) y 2 mínimos: RPC ausente PGRST202 (L107-117) y promesa rechazada (L119-125). | Aceptación 7, sin debilitar nada. |
| `supabase/migrations-baseline.json` | Sólo la espera `0402_portal_hidden_statuses_por_principal`. | Bloque C L02 / SDD-0337, MIGRATE-FIRST, motivo fail-open, OK nominal de Sam, runbook y name exacto. Cutoff 238, `$doc` y las esperas 0409/0418/0419/0430 intactos: sin la entrada nueva, el JSON es igual a la base. |
| `supabase/pending-migration-symbol-declarations.json` | Grupo `l02-portal-hidden-statuses-pending-rpc`: llamada en `portal-visibility-queries.ts:35`, con evidencia en L36/L44 y en inicio L63, envíos L56 y detalle L75. | Conforme al `$doc` y al patrón de L16. Resultado: 0 ROJO, 1 AMARILLO. |
| `docs/specs/README.md` | Regenerado con `corepack pnpm docs:index`. | 416 specs; entra la fila 0337 y sale del listado de huecos. |

**JSX sin cambios:** los bloques `return` de las tres páginas son idénticos antes y después (inicio 2 de 2, envíos 1 de 1, detalle 1 de 1).

### Comportamiento ante fallo

**Main y el código adoptado son fail-open. Se conserva el criterio del origen, y eso es lo que obliga al migrate-first.**

| Caso | main hoy (`3c610701`; módulo `7a1dce9a`) | Adoptado (`b92e6853`; módulo `57fab9a2`) |
|---|---|---|
| Lectura | Admin client: `clients.tenant_id` por id (L30-34) y reglas por tenant/cliente (L58-63). | RPC con la sesión; identidad desde `auth.uid()` (L35). |
| Error devuelto por PostgREST | `if (error \|\| !data) return hidden;` (L64): set vacío, sin log. | `if (error \|\| !Array.isArray(data)) return new Set();` (L36): set vacío, sin log. |
| Excepción | El catch de L86-88 hace `console.error` y devuelve set vacío; el de `ForClient` (L38-40) devuelve set vacío. | El catch de L43-45 devuelve set vacío, sin log. |
| Sin principal válido | Inicio y envíos: `return null`. Detalle (L74-77): sin tenant, set vacío. | Igual. Detalle (L74-76): sin `client` no consulta y queda set vacío. |
| Efecto en pantalla | Se muestran todos los hitos, también los que una regla oculta. | Igual. |
| RPC 0402 ausente | No aplica. | PGRST202 en cada vista: set vacío **permanente**. El cliente ve «en aduana» u otro hito que su tenant ocultó; la página no rompe. |

Con 0402 aplicada antes del código, el fallo vuelve a ser transitorio y equivalente a main. La migración es aditiva (función, comentario y ACL) y el código vigente de main no la llama, así que aplicarla primero no altera la operación actual. El fail-open queda declarado en la PR, en este handoff, en la entrada del baseline y en la declaración de símbolos.

### Datos personales y gobernanza

- **Datos personales: no aplica.** No se capturan, mueven ni borran datos personales. La RPC devuelve sólo nombres de status (0402, L12 y L43-48), y el contrato exige que la firma no exponga `tenant_id`, `client_id`, `trigger_event` ni `visible_in_portal` (test L100-104). El lector entrega `Set<ShipmentStatus>` (módulo L38-42). La identidad se resuelve en la base (L25) y la app deja de enviar ids a una lectura con service_role: es minimización. No se abrió `revisar-datos-ve`.
- **SGE-00.05, cumplimiento.** Identidad y tenant en la base (L18-28), EXECUTE sólo para `authenticated` (L55-58). El contrato incluye pruebas negativas de ACL (L80-84), otro tenant (L122-132), vínculo revocado (L134-141) y cliente eliminado (L143-150).
- **SGE-00.12, cumplimiento.** Sin merge, sin aplicar 0402, sin leer producción.
- **ERR-01, no aplica a mensajes.** No hay error visible ni mutación. La observabilidad se registra como hallazgo.
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

## COMMITS

- `b92e68530043b3d37758ce5b69b2c8bc153cd5c1`: `feat(studio): SDD-0337 — importar L02 visibilidad Portal por principal (migrate-first)`. Contiene SQL, contrato, spec con nota, módulo, test, tres páginas, baseline, declaración e índice; es el producto que validó verify.
- Commit que contiene este documento: `chore(harness): cerrar handoff L02 visibilidad Portal`. Sólo documentación; el hash final se anota en la PR.

## PR / BRANCH

[PR #76 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/76): «[NO FUSIONAR ANTES DE APLICAR 0402] feat(studio): SDD-0337 — L02 visibilidad Portal por principal (migrate-first)». Base `main`; rama `codex/c-l02-portal-visibilidad`, publicada a sí misma con upstream propio. Worktree conservado en la ruta de arriba. Sin merge ni aplicación de migraciones.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación o preparación: SQL, contrato, spec, adopción focal, tests, baseline, declaración, índice, PR y handoff están entregados.
- Revisión del Director y CI alojado del SHA final. `/ui-check` lo corre el Director.
- E2E autenticado y ledger real siguen NO DISPONIBLES. No son permiso para copiar credenciales ni para aplicar la migración.

## FUERA DE ALCANCE DETECTADO

1. **Observabilidad.** Main registra con `console.error` las excepciones de la lectura de reglas (L87 de `7a1dce9a`); el lector del origen no registra nada, y ninguno de los dos registra errores devueltos por PostgREST, PGRST202 incluido. Si se quiere una señal operativa del migrate-first, bastan dos líneas de `console.error` acotado, sin PII, en L36/L44. No se hizo para conservar el cuerpo del origen.
2. **SQL 0402, `limit 1` sin `order by` (L27).** Con varios vínculos activos, la RPC elige uno arbitrario. En estas vistas lo mitigan el principal de L18 y la condición del detalle. El SQL se importa idéntico.
3. **Lectores con admin client sin consumidores tras L02.** `getHiddenPortalStatuses` interpola `clientId` en `.or()` (L56 de main). Conviene retirarlos después de aplicar y verificar 0402, con decisión del Director.
4. **Allowlist histórica de 0337.** Incluye `scripts/__tests__/portal-service-role-boundary.test.mjs` y la meta «10 rutas / 19 construcciones de service_role», que no existen en main; pertenecen al saneamiento de #21 y no se importan.
5. **`supabase/pending-migration-symbol-declarations.json` no tiene merge driver** en `.gitattributes`. #75 (L05) también agrega un grupo, así que al integrar habrá conflicto textual en `degradations` y se resuelve por unión.
6. **Encargo.** Decía que los cinco archivos «cambiaron en main desde #21»; en realidad main no los tocó desde la base común. No altera el resultado, pero sí cómo se lee el diff.
7. **Entorno E2E.** Los 15 fallos son los ambientales conocidos de L16 y L18: `proxy.ts:67` crea Supabase sin URL ni clave. Hubo flaky recuperados en ambas pasadas y, en la primera, un timeout de cierre de Playwright (`worker-49`, 300000 ms, forzado). Es evidencia del runner, no una regresión atribuida a L02; no se diagnosticó ni se reparó.
8. **Avisos heredados.** Hay 8 advertencias de lint en archivos intactos (`NewPurchaseWizard.test.tsx` 4, `PurchaseStepDetalle.test.tsx` 2, `KommoBoardView.tsx` 1, `KommoClient.tsx` 1) y avisos de npm por `auto-install-peers` y `strict-dep-builds` en la configuración del proyecto. No se tocó configuración.
9. **Contenedores ajenos.** Hay contenedores `dtd_relay_*` y `dtd_fixture_*` detenidos hace 4 días, de otra tarea (`dtd-pr28-auth`). No se tocaron.

## HANDOFF AL DIRECTOR

- **Orden migrate-first:**
  1. Revisar la PR #76 sobre los SHA publicados.
  2. Con OK nominal de Sam y el runbook, aplicar `0402_portal_hidden_statuses_por_principal` individualmente, con name exacto.
  3. Verificar el objeto por catálogo, sin filas de negocio: resultado `TABLE(status text)`, `prosecdef` con `search_path=""`, EXECUTE sólo para `authenticated` y no para `anon` ni `service_role`, además del ledger.
  4. En esta rama, un commit que retire la espera del baseline y la declaración `l02-…` y actualice la nota de 0337, como hizo `b49f1c0b` en L16. Con eso el gate queda sin AMARILLO.
  5. CI y revisión del SHA final; merge con `--match-head-commit`.
- **Producción:** main publica en Vercel, así que la autorización del merge debe cubrir ese efecto. Fusionar no autoriza aplicar 0402, ni aplicar 0402 autoriza fusionar.
- **Compartido con otros lotes:** índice y baseline (con driver) con #69, #70, #72, #73, #74 y #75; declaraciones sin driver con #75. Ninguna PR abierta toca los cinco archivos de código. L03 tocará después la home (import de `getPortalAdvisor` y su llamada) y `portal-queries`, en hunks distintos de los de L02.
- **Decisiones pendientes para el Director:** retirar los lectores con admin client y añadir el `console.error` acotado (hallazgos 1 y 3).
- **Ownership:** la escritura termina con este documento. Tras su commit y push se libera el claim con `node scripts/harness-worktree.mjs release --owner c-l02-worker-20260911-claude`; el estado efectivo queda en los metadatos Git del worktree. No hubo subagentes escritores ni quedan sesiones consumidoras delegadas. Se conservan rama y worktree; no se borró nada.
