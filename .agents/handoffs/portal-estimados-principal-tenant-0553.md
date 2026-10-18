# Portal — avanzar estimado por principal y tenant (SDD-0553)

Task ID: `portal-estimados-principal-tenant-0553`.

- **Fecha:** 2026-10-18.
- **Owner / sesión escritora:** `worker-agent-a1b1ae84-estimados-tenant`, Worker lanzado por el Director como subagente de Claude Code. Sin otras sesiones escritoras ni subagentes en este árbol.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-a1b1ae84fc050772b`.
- **Rama:** `worktree-agent-a1b1ae84fc050772b`. Base `origin/main` = `a6b06205`, sin cambios en el fetch de las 22:16Z.
- **SDD:** `docs/specs/0553-portal-estimados-principal-tenant/spec.md`. Reserva publicada en `refs/heads/codex/sdd-reserve-0553` (`26b99a96`), hecha con `--expect 0553` después de un inventario que dio 0553. La local deja además `refs/heads/codex/sdd-reserve-0553-portal-estimados-principal-tenant`. `sdd:check` pasó después de reservar. Sin migración.
- **Estado de tarea:** lista-para-revision. La SDD queda en `in-progress`, como el resto de las specs fusionadas del repo; todas sus casillas de aceptación están marcadas.
- **Autorización:** encargo del Director del 2026-10-18. Pedido de Sam al Director, literal: «arranca la de estimados». Son palabras de Sam al Director, no a esta sesión; las registro a su nombre. Autorizados: commits en esta rama, push de esta rama y de la reserva, y una PR en borrador. Sin merge, sin producción, sin servidor, sin base de prueba y sin datos.

## OBJETIVO ORIGINAL

Cerrar el hallazgo FUERA DE ALCANCE 3 de la SDD-0552: `advanceEstimateToCotizacionAction` (`app/portal/(app)/estimados/actions.ts:63-71` y `:96-102` en `a6b06205`) lee y actualiza `quotes` con el admin filtrando sólo por código o id y Shipping Mark, sin `tenant_id`. Revisar todo `app/portal/(app)/estimados/` y los otros usos de `quotes` desde `app/portal` y `lib/portal`.

## COMPLETADO

1. **`app/portal/(app)/estimados/actions.ts`** (líneas del head):
   - `:54-58`: la identidad sale de `getPortalClientPrincipal` (antes `getPortalClient`, que ya era el principal pero descartaba el tenant). Se toman `client` y `tenantId`.
   - `:73`: la lectura con el admin filtra por `tenant_id` del principal, además de código, Shipping Mark y `deleted_at is null`.
   - `:106`: el UPDATE filtra por `tenant_id` del principal, además de `id`, Shipping Mark y `source='web'`.
   - `:120`: el aviso al asesor va a `tenantId` del principal (antes, `q.tenant_id` de la fila). `tenant_id` sale del `select` y del tipo.
   - El admin se conserva: la única policy Portal de `quotes` es SELECT (`0117`, `0428`); no hay UPDATE para el Portal.
2. **Columna comprobada:** `quotes.tenant_id uuid not null` desde `0007`, con `unique (tenant_id, quote_code)`. Ninguna migración la elimina ni la renombra.
3. **Revisado sin cambio** (detalle en la spec): `estimados/page.tsx` usa `listMyEstimates`, que ya filtra por tenant y Shipping Mark de la sesión (SDD-0380) y tiene prueba con el otro tenant. La búsqueda por valor de `quotes`, `quote_code`, `next_estimate_code` y `next_quote_code` en `app/portal` y `lib/portal` no encontró otro uso del mismo tipo: el alta de `cotizaciones/actions.ts` ya usa el tenant del principal (0552), y los `quote_code` de aceptación son de `legal_acceptances`, con tenant.
4. **Pruebas:** `app/portal/(app)/estimados/__tests__/principal-tenant.test.ts`, 9 pruebas. Admin = doble de la 0549 (aplica `eq`/`is` en lectura y UPDATE). El principal lo resuelve `getPortalClientPrincipal` **real** contra el doble de sesión. El tenant B tiene un estimado web con el mismo Shipping Mark y, según el caso, el mismo código.
   - **Control rojo:** con `actions.ts` de `a6b06205`, caen 4 de 9 por la razón esperada (dos filas en `maybeSingle`, el estimado de B avanzado, la lectura sin tenant). Las 5 que pasan cubren lo que no debía cambiar.
   - **Mutantes:** `mutantes-0553.cjs` en el scratchpad de la sesión, sin shell (`spawnSync` de `node_modules/vitest/vitest.mjs`), un reemplazo exacto por vez, y una muerte sólo cuenta con línea `Tests` y fallos > 0. Control 9/9 antes y después. Mueren los 5 del diff: lectura sin tenant (4 rojas), UPDATE sin tenant (1), lectura con tenant del formulario (4), UPDATE con tenant del formulario (2), aviso al tenant del formulario (1). Mueren también 2 controles de filtros preexistentes (Shipping Mark en lectura y en UPDATE).
   - «UPDATE sin tenant» sólo lo mata la aserción sobre los filtros de la operación: el UPDATE va por `id`, PK global, y con datos reales el tenant no cambia la fila tocada. Es la segunda valla que pidió el encargo; está explicado en la spec (Decisión).

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `sdd:next` (inventario) y `sdd:next --reserve … --expect 0553 --push` | `a6b06205` | PASÓ: 332 refs + worktrees, siguiente 0553; reserva publicada |
| `sdd:check` después de reservar | `5a40f8cd` | PASÓ |
| Prueba nueva con el producto nuevo | `ea073201` | PASÓ: 9 de 9 |
| Control rojo: prueba nueva con `actions.ts` de `a6b06205` | prueba `ea073201` | FALLÓ como se esperaba: 4 de 9 rojas |
| Mutantes | `ea073201` | PASÓ: 5 de 5 del diff mueren (más 2 controles); control 9/9 antes y después |
| `corepack pnpm typecheck` | `ea073201` | PASÓ |
| `eslint "app/portal/(app)/estimados" lib/portal app/portal` | `ea073201` | PASÓ: 0 errores; 6 warnings heredados en `compras/nueva/*.test.tsx`, archivos que no toqué |
| Focalizadas `vitest run lib/portal app/portal --pool=threads --maxWorkers=2` | `ea073201` | PASÓ: 108 archivos, 1304 pruebas |
| `docs:index` + `docs:check` / `sdd:check` | `5dc38d63` | PASÓ (540 specs) / PASÓ |
| `governance:check` / `components:check` | `5dc38d63` | PASÓ (28 políticas) / PASÓ |
| `git diff --check` | cada commit | PASÓ |
| `pnpm verify` | `5dc38d63` | PASÓ en lo medido: exit 0, 16 de 17 pasos. `migrations-applied` NO DISPONIBLE. El propio verify lo llama «CIERRE INCOMPLETO»: exit 0 no equivale a cobertura completa. Detalle abajo |
| `knowledge:status` | `5dc38d63` | `ok: false`: estado del worktree, no de esta PR. Ver «Impacto documental» |
| E2E autenticado, smoke en producción, ledger de producción | — | NO DISPONIBLE: sin credenciales ni autorización, y no corresponde antes de aprobar la PR |

### `pnpm verify` (una sola corrida)

- **SHA:** `5dc38d639007f81d5c2a9a1dd87d01ff33ce07e2`.
- **Corrida:** `node scripts/verify.mjs` en segundo plano, sin `timeout` (el tope de 60 min del encargo lo vigilé aparte), de 22:16:47Z a 22:39:04Z (22 min, 18:16 a 18:39 hora de Caracas). Exit 0.
- **Turno:** el encargo lo daba si no había otra corrida pesada. Antes de arrancar no había vitest, verify, next build, Playwright ni navegadores sin cabeza; los node vivos eran servidores MCP y de Codex de menos de 60 MB. Docker estaba apagado y sin contenedores; lo levanté yo (FUERA DE ALCANCE 4).
- **Resumen del propio verify:** «16 de 17 pasos corrieron de verdad · CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)».

| Paso | Resultado |
|---|---|
| harness | PASÓ: 215 pruebas |
| lint | PASÓ |
| rsc-boundary | PASÓ: 1683 módulos, sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | PASÓ: 803 archivos y 1 omitido; 11.277 pruebas y 1 omitida |
| docs:check | PASÓ: 540 specs |
| numbering / feature-constants / components:check / governance:check | PASÓ / PASÓ (6 banderas) / PASÓ / PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP «sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY». Esta SDD no trae migración, y no copié credenciales |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ: postgres:17 efímero |
| schema-rebuild | PASÓ: 485 migraciones, 467 desde cero y 18 sólo de ledger; barrido multi-tenant de 219 tablas |
| e2e | PASÓ con aviso: 177 pasaron, 20 omitidas y 1 flaky. El flaky es `e2e/auth.spec.ts:81` [chromium], «Acceso: un token inválido renderiza el mismo error las dos veces»: `page.goto` dio `net::ERR_ABORTED` y pasó en el reintento. Es `/acceso`, ajeno a esta PR. El proceso salió ≠ 0 por el worker de WebKit que no cierra en Windows; verify lo clasifica como aviso, no como fallo |
| build | PASÓ; el árbol quedó limpio (sólo este documento sin seguimiento) |

## COMMITS

- `5a40f8cd` chore(sdd): reserva SDD-0553 (cherry-pick del stub `26b99a96`).
- `cce91582` fix(portal): avanzar estimado por tenant del principal.
- `ea073201` test(portal): estimado del otro tenant con el mismo Shipping Mark.
- `5dc38d63` docs(sdd): spec e índice.
- Commit que contiene este documento: handoff, resultado de `verify` y su casilla en la spec. Sólo toca la spec y este documento; sobre ese head repetí `docs:check` y `sdd:check`.

## PR / BRANCH

- Rama `worktree-agent-a1b1ae84fc050772b` → base `main`. Un único push, con este documento adentro, y la PR en borrador. La URL queda en la PR y en el informe al Director.

## PENDIENTES DE ESTA TAREA

- Ninguno de código ni de prueba. `migrations-applied` queda NO DISPONIBLE: no aplica a esta SDD, que no trae migración.
- La revisión, el merge y el smoke son del Director.

## FUERA DE ALCANCE DETECTADO

1. **`portalQuoteScope` (`lib/portal/portal-queries.ts:417-444`)** repite a mano la resolución del principal para la lista de estimados y cotizaciones, sin exigir el nombre del cliente. Filtra bien por tenant y Shipping Mark de la sesión, así que no es aislamiento: pasarlo a `getPortalClientPrincipal` sería consistencia. El layout ya exige el principal con nombre para entrar a `(app)`.
2. **El UPDATE del estimado no filtra `deleted_at is null`.** La lectura sí. Si el Studio borra el estimado entre la lectura y el UPDATE, el cliente lo avanzaría igual. Es preexistente y la ventana es estrecha. Inferencia, no medida.
3. **Lecturas Studio que el Portal llama sólo con Shipping Mark** (`listPrealertas`, `listSuppliers`, `listPrealertaDocuments`, `listPrealertaServiceRequests`): siguen abiertas según el FUERA DE ALCANCE 4 de la 0552. No las volví a revisar.
4. **Docker Desktop estaba apagado** a las 22:16Z (`failed to connect to the docker API`). Lo levanté con su ejecutable por usuario para `verify` (motor 29.8.2 en 11 s) y lo dejé encendido. Otras sesiones también lo usan.

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0553 nueva y el índice `docs/specs/README.md` regenerado. Ningún runbook ni regla cambia.
- **Piloto semántico y Archify:** ninguna fuente tocada está en `semanticPilot` de `scripts/knowledge-policy.json`, y el mapa Archify (`docs/architecture/knowledge-lifecycle.archify.json`) no cambia. No hace falta recibo semántico ni `knowledge:visual`. La spec y este handoff sí caen en los temas `especificaciones` y `handoffs`: entran a Obsidian cuando el Director publique desde `main` integrado.
- **`knowledge:status`** en este worktree (`5dc38d63`): `ok: false`, el mismo estado que registró la 0552 en su worktree:
  - estructura INVALID y semántica INVALID, porque aquí no existe `graphify-out`;
  - Archify PENDING (`ARCHIFY_RUNTIME_MISSING`);
  - Obsidian PENDING.

  Es estado del worktree, no de esta PR. No reconstruí derivados: Graphify lo publica el Director desde `main`. Graphify estructural: NO EJECUTADO por esa regla.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador. Fusionar publica en producción en unos 5 minutos. No hay migración que aplicar antes, ni cambio de UI, RLS o RPC.
- **Revisión sugerida:** `actions.ts` completo (es un archivo) y la prueba nueva, en especial el caso «código sólo en el tenant B», que es el cruce real.
- **Smoke sugerido después de integrar** (no lo corrí): con un cliente Portal real que tenga un estimado web, entrar a `/portal/estimados`, tocar «Avanzar a cotización» y confirmar que llega a `/portal/cotizaciones` con el estimado en la lista y que el asesor recibe el aviso.
- **Sesiones:** sin subagentes. Antes de `verify` comprobé que no hubiera vitest, verify, next build, Playwright ni contenedores de otra sesión (la «Contabilidad» que avisó el Director): los node vivos eran servidores MCP y de Codex, de menos de 60 MB.
- **Ownership:** lo libero con `node scripts/harness-worktree.mjs release --owner worker-agent-a1b1ae84-estimados-tenant` después del último push. Worktree, rama y reservas se conservan.
