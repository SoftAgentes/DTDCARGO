# Handoff — C / L20: frontera principal/tenant de cajas Portal

Fecha: 2026-09-11. Task ID: `c-l20-portal-cajas-bodega`.
Owner / sesión: `c-l20-worker-20260911-claude` (Worker Claude Code asignado por el Director; sin subagentes).
Estado: lista-para-revision; no integrada ni aplicada. Claim adquirido tras `guard` en el worktree creado por el Director; se libera después del último push y de crear la PR, con recibo en el cierre al Director.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal no modificado).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l20-portal-cajas-bodega`.
- Rama: `codex/c-l20-portal-cajas-bodega`.
- Base asignada y HEAD inicial: `3c6107012f754953323202a7386b3e7811593814`; igual a main remoto al iniciar, antes de publicar y antes de este commit; no hizo falta merge de origin/main.
- Origen solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de la PR #21 (abierta, draft), confirmado con `gh pr view 21`.
- SDD: `docs/specs/0400-portal-warehouse-boxes-principal-tenant/spec.md`, importada exacta; `status: done` histórico y frontmatter intactos; solo se añadió la nota de importación fechada bajo el título.
- Numeración: sin reserva. Entre todas las refs remotas, la spec 0400 y la migración 0432 existen solo en `origin/codex/saneamiento-integral` (#21); ausentes en la base.

## OBJETIVO ORIGINAL

Preparar el lote L20 del bloque C para integrarlo en main mediante PR draft: frontera principal/tenant de la lectura Portal de `warehouse_boxes`. Importar la migración 0432, su contrato SQL y la spec 0400, y declarar `0432_portal_warehouse_boxes_tenant_boundary` pendiente de aplicar. Sin cambios en app/lib. El Worker no fusiona ni aplica a producción.

## COMPLETADO

- Tres archivos importados con `git cat-file blob` desde `ea9952a4`. Migración y contrato idénticos por blob y byte a byte. La spec, retirando solo la nota (líneas 16-22), vuelve al blob original.
- `supabase/migrations-baseline.json`: única clave nueva `0432_portal_warehouse_boxes_tenant_boundary` en `pendingBelowCutoff`, con motivo, riesgo al aplicar, OK nominal de Sam, runbook y `name` exacto (forma de `docs/runbooks/aplicar-migraciones-prod.md:76-79`). `cutoff: 238`, `$doc` y las esperas 0409/0418/0419/0430 quedan idénticas (comparación estructural con `JSON.parse` contra la base).
- `docs/specs/README.md` regenerado con `corepack pnpm docs:index`: 416 specs, 36 huecos; 0400 sale de la lista de huecos.
- Evidencia de alcance y de consumidores (aceptación 6), abajo. No se encontró impacto: no hubo motivo para detenerse.
- Gobernanza y datos personales clasificados, abajo.

Alcance exacto: los tres archivos L20, `supabase/migrations-baseline.json` (solo la espera), `docs/specs/README.md` por generador y este handoff. Excluidos y no tocados: app/**, lib/**, otros lotes C, helpers de asesor de #21, cutoff, esperas existentes, `supabase/pending-migration-symbol-declarations.json`, ruleset y la rama de #21.

### 0432 altera solo la policy Portal de lectura

- Única sentencia DDL: `alter policy "warehouse_boxes portal self read" on public.warehouse_boxes`, en `supabase/migrations/0432_portal_warehouse_boxes_tenant_boundary.sql:46-59`. Un barrido de alter/create/drop/grant/revoke/insert/update/delete/truncate/set solo encuentra la línea 46. Coincide con el anexo SQL-20 (`docs/audits/c-analisis-bloque-c-sql.md:81`).
- Preflight fail-closed `:5-44`: `auth.uid()` `:8-10`, tablas `:12-17`, RLS activa `:19-25` e inventario exacto de dos policies PERMISSIVE para `authenticated` `:27-42` (`warehouse_boxes by tenant` ALL y `warehouse_boxes portal self read` SELECT). El postflight `:61-83` solo lee la policy Portal. Sin GRANT/REVOKE, funciones, triggers, Storage ni DML.
- La policy de equipo `warehouse_boxes by tenant` (`supabase/migrations/0240_warehouse_boxes.sql:271-276`, FOR ALL, `tenant_id = get_user_tenant_id() and deleted_at is null`) solo aparece en el inventario del preflight (`:29`) y no se altera. ACL de `0240_warehouse_boxes.sql:278-281` intacta.
- Antes: `supabase/migrations/0244_warehouse_boxes_predeclaradas.sql:279-288` tomaba el tenant de `get_portal_client_tenant()` (`0105_portal_compras.sql:44-49`, `client_users.tenant_id`) y el Shipping Mark de `get_portal_client_markbox()` (`0080_portal_cliente.sql:49-55`, sin comprobar tenant ni `clients.deleted_at`). Después: un único `EXISTS` exige vínculo activo, `c.tenant_id = cu.tenant_id`, cliente vivo, y el mismo tenant y Shipping Mark de la caja (`:48-58`).
- Contrato `supabase/tests/0432_portal_warehouse_boxes_tenant_boundary.test.sql`: RED `:109-120`; policy de equipo, ACL y RLS sin cambios `:122-128` y `:164-187`; principal coherente `:189-197`; incoherente sin lectura ni escritura `:199-213`; revocado `:215-222`; staff `:224-231`; service_role `:234-241`; drift de preflight `:133-161`; rollback `:244-245`.

### Consumidores

Portal, dependen de la policy y no se tocaron:

- `lib/studio/prealertas/queries.ts:237-255` (`listPredeclaredBoxes`): en el Portal lee por RLS con la sesión del usuario, desde `app/portal/(app)/compras/[code]/page.tsx:73,83` y `app/portal/(app)/compras/[code]/etiquetas/page.tsx:48,78` (`createClient` de `@/lib/db/server`). Su tercera llamada, `queries.ts:298`, pertenece a la ruta pública del proveedor con cliente admin (`:257-263`) y no depende de RLS.
- Un principal coherente conserva sus cajas. El `EXISTS` corre con la RLS del usuario Portal: `client_users self or tenant read` (`0080_portal_cliente.sql:68-70`) le expone su vínculo y `clients portal self read` (`0080_portal_cliente.sql:74-76`; su endurecimiento pendiente `0430_portal_profile_change_requests_principal_tenant.sql:46-55` exige la misma coherencia) le expone su cliente vivo. `unique (auth_user_id)` (`0080_portal_cliente.sql:30`) deja un solo vínculo por usuario.
- Al aplicarse, un principal incoherente, revocado o con cliente borrado deja de ver cajas: `listPredeclaredBoxes` devuelve `[]` y la etiqueta cae al fallback `buildLabels` (`queries.ts:240-241`). Es el efecto previsto por la spec, no un cambio de código.
- Precisión al plan: `listMyBoxes` no existe en la base `3c610701`, ni en la base del análisis `e325cb4d`, ni en el origen `ea9952a4`, ni en la historia de main (`git grep` y `git log -S` vacíos). `getProfileCompleteness` (`lib/portal/portal-queries.ts:596-633`) no lee `warehouse_boxes`: usa la RPC `get_portal_client_id`, `clients` y `client_delivery_addresses`. Ningún archivo de `lib/portal` menciona `warehouse_boxes` en esas tres refs. Ninguno de los dos depende de 0432.

Studio/móvil, sin impacto:

- `app/m/cn/recibir/actions.ts:72-84,128-134` y `app/m/cn/estibar/actions.ts:205-209,232-235`: `createAdminClient()` de `@/lib/db/admin` (service_role, BYPASSRLS), con filtro explícito por el tenant de la sesión del operario.
- `app/studio/(app)/cola-qr/[id]/imprimir/page.tsx:42,66-72` y `lib/studio/naviera/queries.ts:645-666` (embed `warehouse_boxes(code, markbox, client_name)`, llamado desde `app/studio/(app)/naviera/page.tsx:34,59-61`): sesión de equipo cubierta por `warehouse_boxes by tenant`, que no cambia. Las policies permisivas se combinan por OR y la rama Portal solo puede añadir filas, así que la visibilidad del equipo no cambia (contrato `:224-231`).
- El resto de menciones en app/lib son comentarios. Fuera de app/lib: `scripts/qa/prealertas-reception-concurrency.mjs:27` (psql como `postgres` local) y la exención histórica 0243 de `scripts/check-numbering.mjs:69`.

### Gobernanza y datos personales

- SGE-00.05, cumplimiento: principal, tenant y cliente vivo explícitos (`:48-58`).
- SGE-00.06, cumplimiento: el preflight rechaza drift antes del ALTER (`:5-44`; contrato `:133-161`).
- SGE-00.07, cumplimiento: la evidencia local no equivale a producción.
- SGE-00.12, cumplimiento: publicación, merge y producción separados.
- AUD-01, MP-01 y BTN-01: no aplica (sin eventos, retención ni controles).
- UI y marca: no aplica; `/ui-check` no aplica.
- Datos personales: **no aplica**. 0432 solo restringe lectura (`:46-59`), sin captura, movimiento ni borrado (sin DML ni cambios de ACL). El contrato usa UUID y Shipping Marks sintéticos (`DUP`, `OTHER`, `DEAD`) dentro de `begin`/`rollback` (`:10`, `:92-107`, `:244`). No se leyeron filas reales.

## VALIDACIÓN

- PASÓ: `node scripts/harness-worktree.mjs guard` («Guard OK») y `claim --owner c-l20-worker-20260911-claude` («Claim adquirido»). `guard --owner` y la rama se revalidaron antes de cada commit y del push.
- PASÓ: `corepack pnpm install --frozen-lockfile`: exit 0, 29.1 s (06:29:38Z–06:30:07Z), Node v24.20.0 / pnpm 12.3.4; lockfile intacto.
- PASÓ: identidad por blob, con `git cat-file --batch-check`, `git hash-object --no-filters` y `cmp`:

```text
migración  origen 0cd9380472723ec20336c3dc58c1d2ca2a6412a7 blob 2706 · HEAD igual · working tree igual · cmp IGUAL
contrato   origen 0c96ef21baa55afdf2d2f4ef9121d72d76c60b76 blob 9297 · HEAD igual · working tree igual · cmp IGUAL
spec       origen 1f3cdd9b787c1b8ada296b6d0dcf61147699eb3b blob 2217 · HEAD b5edf27a34fbcd5c9712e7136ddc73c34c13307a blob 2769 (con nota)
spec HEAD sin líneas 16-22 → 1f3cdd9b787c1b8ada296b6d0dcf61147699eb3b, 2217 bytes · cmp IGUAL
```

- PASÓ: `node scripts/install-merge-drivers.mjs --check` («merge driver 'dtd-generated-records' verificado»).
- PASÓ: `corepack pnpm docs:index` (416 specs, 36 huecos), `corepack pnpm docs:check` (índice sincronizado con 416 specs) y `corepack pnpm sdd:check` (sin números repetidos; 11 choques históricos ya aplicados en pausa, preexistentes).
- PASÓ: `node scripts/check-schema-rebuild.mjs` independiente, exit 0 (06:35:39Z–06:36:20Z): 421 archivos, 403 migraciones aplicadas desde cero (incluye 0432), 18 solo-ledger verificadas sin tocar el esquema y barrido de aislamiento de 219 tablas. Sus dos tenants se crean dentro de la transacción de `_tenant-isolation.assert.sql`, que termina en ROLLBACK; no son tenants de producción. El working tree tenía el contenido que luego quedó en `8262e3f8`.
- PASÓ: `node scripts/check-pending-migration-symbols.mjs`: `0 ROJO · 0 AMARILLO`; `supabase/pending-migration-symbol-declarations.json` intacto.
- **FALLÓ** `corepack pnpm verify`, exit **1**, 06:37:37Z–07:10:45Z, sobre el contenido exacto de `8262e3f8bc0ab2d311cdc9006ea958b466e0b6f0` con árbol limpio. **16 de 17 pasos ejecutados: 15 PASÓ, E2E FALLÓ, migrations-applied NO DISPONIBLE.** No es verde completo ni certificación de producción. El commit posterior solo añade este handoff y no cambia el contenido probado.
  - PASÓ: harness (18/18), lint (0 errores / 8 advertencias basales), rsc-boundary (1597 módulos), typecheck, edge-functions (4), unitarios (526 archivos / 6684 tests), docs:check (416 specs), numbering, feature-constants (5 banderas), components:check y governance:check.
  - PASÓ: pending-migration-symbols (`0 ROJO · 0 AMARILLO`).
  - PASÓ: sql-tests, **163 contratos** con rollback total en contenedor efímero `postgres:17`, incluido `0432_portal_warehouse_boxes_tenant_boundary.test.sql`, que reproduce el RED histórico antes de aplicar 0432.
  - PASÓ: schema-rebuild, con las mismas cifras de la corrida independiente (421 / 403 / 18 / 219 tablas).
  - NO DISPONIBLE: `migrations-applied`, SKIP explícito por ausencia de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó producción.
  - E2E: el comando **FALLÓ** (exit 1) y la cobertura autenticada queda **NO DISPONIBLE**. Dev server propio en el **puerto 3583**; el webServer de Playwright arrancó sin timeout y ningún worker quedó colgado. Resultado: **150 pasaron / 15 fallaron / 3 flaky / 18 omitidos** (186 tests, 7.3 min). Los 15 fallos son `auth.spec.ts:21,91,98,105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con `Your project's URL and Key are required to create a Supabase client!` en `proxy.ts:67`. Es ambiental: faltan credenciales Supabase y este diff no toca app/lib. Los 3 flaky (`attachments-gastos-pilot.spec.ts:20`, `calculadora-semantic-colors.spec.ts:53`, `smoke.spec.ts:150`) pasaron en el reintento del propio runner. No se reintentó ni se modificaron retries, timeouts ni tests.
  - PASÓ: build de producción y postbuild Norte. Next 16.2.11 compiló en 23.6 s, TypeScript en 60 s y 160 páginas estáticas. El runner restauró `tsconfig.json` y retiró `.next-verify`.
- PASÓ: `git diff --check` (index y `origin/main..HEAD`) y allowlist exacta con `git diff --name-only origin/main`: cinco rutas antes de este handoff; con él, seis.
- NO EJECUTADO: `/ui-check`, porque no hay UI. Merge, aplicación de 0432, lectura de datos de producción y despliegue quedan fuera de la autorización Worker.
- CI «Calidad continua»: corre en `pull_request` a main. Su resultado para el SHA final se consulta en la PR; no se atribuye a este documento.

PostgreSQL 17.11: imagen `postgres:17`, `PG_VERSION=17.11-1.pgdg13+2`, ID `sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675` (consultado con `docker image inspect`). Los runners retiraron los contenedores propios `dtd_sqltest_*` y `dtd_rebuild_*`; no quedan residuales. No se tocaron servicios Supabase ni contenedores de otra sesión.

Evidencia local fuera de Git: `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l20-portal-cajas-bodega/` (`install.log`, `docs-index.log`, `docs-check.log`, `sdd-check.log`, `merge-drivers.log`, `pending-symbols.log`, `schema-rebuild.log`, `blobs.log`, `allowlist.log`, `verify.log`, `verify.exit`, `pr-body.md`).

## COMMITS

- `8262e3f8bc0ab2d311cdc9006ea958b466e0b6f0` — unidad L20: spec con nota, migración y contrato exactos, espera en baseline e índice regenerado; cinco archivos añadidos selectivamente.
- Commit que contiene este documento — cierre durable del Worker. Su SHA final se registra en la PR, sin recursión de commits.

## PR / BRANCH

Rama `codex/c-l20-portal-cajas-bodega`, base `main` (`3c610701`), publicada con push explícito de la rama a sí misma; `8262e3f8` ya estaba en origin como respaldo. La PR draft contra main se crea justo después de publicar este commit, con `gh pr create --base main --head codex/c-l20-portal-cajas-bodega --draft`. Para no crear recursión, el SHA final queda en el cuerpo de la PR y la URL en el cierre al Director; también se localiza con `gh pr list --head codex/c-l20-portal-cajas-bodega`. No se fusionó ni desplegó.

## PENDIENTES DE ESTA TAREA

Ninguno de extracción. Para integrar faltan la revisión del Director, el CI del HEAD final en la PR y la autorización de merge. E2E autenticado y ledger siguen NO DISPONIBLE en este entorno; no se aplicará una migración para ponerlos en verde. La aplicación productiva de 0432 es otra tarea con OK nominal de Sam.

## FUERA DE ALCANCE DETECTADO

- El plan cita `listMyBoxes` y `getProfileCompleteness` como consumidores de L20 (`docs/audits/c-analisis-bloque-c.md:89`, `docs/audits/c-analisis-bloque-c-producto.md:218`). La primera no existe y la segunda no lee `warehouse_boxes`; el consumidor real es `listPredeclaredBoxes`. Es una corrección documental para quien mantenga el plan; no se editó porque está fuera de la allowlist.
- La spec 0400 conserva menciones de su origen: allowlist con «auditoría, checklist y handoff del saneamiento» (`spec.md:43-47`) y «el checklist original sigue 56/106» (`spec.md:57`). La allowlist de este encargo prevalece; no se editaron para preservar la identidad.
- Aviso de instalación: pnpm 12.3.4 ya no lee `pnpm.onlyBuiltDependencies` de package.json; la instalación congelada terminó en 0. No se tocó configuración.
- Lint: 8 advertencias preexistentes y 0 errores. Hay seis `no-unused-vars` en `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx` y `PurchaseStepDetalle.test.tsx`, y dos avisos React en `app/studio/(app)/crm/_components/KommoBoardView.tsx:124` y `KommoClient.tsx:553`. Están fuera de este diff y no se tocaron.
- E2E sin configuración Supabase: los 15 fallos de login/auth y del buscador protegido (`proxy.ts:67`), los 3 flaky resueltos por el runner y líneas `[WebServer] Request timed out after 3000ms / Retrying 1/3` del dev server durante su arranque (origen no investigado; el servidor atendió los 186 tests). Son límites del entorno, no reparaciones de esta tarea.
- Build: avisos `Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY` en fetchers públicos (`listPublishedPosts`, `getPublicServicios` y otros) durante la generación estática; los fetchers los capturan y el build terminó OK.
- Contenedores Docker `supabase_*_dtd-pr28-auth-02b5674f-20260906`, activos desde hace 37 h, y `dtd_relay_*` detenidos desde hace 4 días pertenecen a otra sesión; no se tocaron.

## HANDOFF AL DIRECTOR

- **Exacto en el plan:** la fila L20 (`docs/audits/c-analisis-bloque-c.md:89`) y el anexo SQL-20 (`docs/audits/c-analisis-bloque-c-sql.md:81,119,159,261`) describen un ALTER de la policy Portal (`:46-59`), el inventario de dos policies, productores 0006/0080/0240/0244, ningún productor interno C y ninguna allowlist app/lib nueva. Todo se confirma en esta base. No se añadieron helpers de asesor ni nada de `portal-queries`.
- **Precisiones:** los consumidores citados por el plan (arriba). El anexo ubica el inventario en `L12-41`; en el blob ocupa `:12-42`. El contrato sintetiza tablas y policies (`:34-56`, `:80-90`), como advierte `c-analisis-bloque-c-sql.md:171`: su verde no sustituye la reconstrucción completa, que también pasó. Las cifras y casillas de la spec pertenecen al origen; la evidencia vigente es la de este handoff.
- **Cambios compartidos:** L19 (0431, [PR #69](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/69)) y L21 (0433, [PR #70](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/70)), ambas draft, comparten con esta PR `supabase/migrations-baseline.json` y `docs/specs/README.md`, y ningún otro archivo (`gh pr view --json files` sobre los heads `727bdc90` y `4e100f8d`, ambos con base `3c610701`). Al integrar, hay que unir las entradas de `pendingBelowCutoff` y regenerar el índice con `pnpm docs:index`, sin elegir un lado. El merge driver `dtd-generated-records` está verificado en este worktree. No se incorporaron cambios de esos lotes.
- **Aplicación:** fusionar NO autoriza aplicar `0432_portal_warehouse_boxes_tenant_boundary`. Requiere OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, con `name` exacto. Riesgo al aplicar: los clientes Portal con vínculo incoherente, revocado o con cliente borrado dejan de ver sus cajas predeclaradas en `compras/[code]` y en `compras/[code]/etiquetas`. Si Sam lo autoriza en esa tarea, un conteo agregado y sin PII de vínculos activos incoherentes permitiría anticipar el alcance. Aquí no se leyó producción.
- **Ownership:** sesión escritora única `c-l20-worker-20260911-claude`, sin subagentes. Se libera con `node scripts/harness-worktree.mjs release --owner c-l20-worker-20260911-claude` después del último push y de crear la PR; el recibo queda en el cierre al Director. No quedan procesos de validación propios activos. No borrar rama ni worktree; una sesión futura debe reclamar ownership de nuevo.
