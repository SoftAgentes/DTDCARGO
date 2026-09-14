# portal-helpers-principal-determinista — Helpers del Portal por principal, deterministas y sin cruce de tenant (SDD-0466 / migración 0453)

Fecha: 2026-09-14. Task ID: `portal-helpers-principal-determinista`. Estado de tarea: lista-para-revision, publicada como PR en borrador. Estado SDD-0466: `done`, que no significa aplicada.
Owner / sesión escritora: `worker-w2-portal-helpers-20260914`, Worker asignado por el Director (sesión Director del 2026-09-14). Sin subagentes escritores.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`, sin ninguna escritura en el checkout principal.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-helpers-principal-determinista`.
Rama: `codex/portal-helpers-principal-determinista`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`; origin/main no avanzó durante la tarea (verificado antes de publicar).
SDD: `docs/specs/0466-portal-helpers-principal-determinista/spec.md`, reservada por el Director en `e8531e07` (rama local `codex/sdd-reserve-0466-portal-helpers-principal-determinista`), incorporada con `git cherry-pick` (`53414c08`) y completada acá. Migración asignada y usada: 0453.

Permisos del encargo:
- **Autorizado:** commits locales selectivos (`fix(studio): SDD-0466 — …`), publicar la rama a sí misma y abrir la PR en borrador contra `main`.
- **Prohibido:** merge, deploy, aplicar migraciones, leer filas de negocio o PII, tocar el ruleset, borrar ramas o worktrees, escribir en el checkout principal, tocar 0230, 0401 y 0416-0452, el Portal y el Studio. `supabase/migrations-baseline.json` quedó excluido en la ronda 1 salvo exigencia del gate de símbolos; en la ronda 2 el Director lo incluyó explícitamente para una única entrada nueva en `pendingBelowCutoff`.

Aceptación del encargo, en cuatro puntos:
1. Test SQL que reproduzca el cruce (vínculo `client_users` de otro tenant o cliente borrado) contra `client_delivery_addresses_validate_client()`, rojo sobre main y verde con la corrección.
2. Test SQL que muestre qué devuelven `get_portal_client_markbox()` y `get_user_tenant_id()` con dos vínculos o dos membresías; corrección por regla explícita o `NULL` fail-closed; la spec documenta la regla y por qué.
3. Las RPC de 0411, 0412 y 0413 y las policies que dependen de `get_user_tenant_id()` conservan su comportamiento con un solo vínculo: postflight de catálogo y tests existentes en verde.
4. Cero cambios en `app` y `lib`; consumidores a cambiar, como FUERA DE ALCANCE.

Dependencias: ninguna. Otros tres Workers en paralelo no tocan `supabase/`.
Ronda 2 (2026-09-14, revisión del Director sobre `01518252`): SQL de la 0453, spec y handoff aceptados en lo técnico. Única omisión: la espera de la 0453 en `supabase/migrations-baseline.json`, sin la cual `migrations-applied` sale rojo con credenciales al fusionar. El Director amplió la allowlist únicamente a ese archivo para agregar UNA entrada en `pendingBelowCutoff` con clave exacta `0453_portal_helpers_principal_determinista`, sin subir el cutoff 238 ni tocar las otras cuatro esperas, y pidió actualizar sólo este handoff (PENDIENTES y COMMITS). Nada más cambia.
Ronda 3 (2026-09-14, revisión del Director sobre `15ea0316`): sólo texto, con allowlist limitada a la spec 0466 y este handoff. «Alcance» de la spec decía que `supabase/migrations-baseline.json` quedaba fuera y «Allowlist exacta» no lo listaba, aunque la ronda 2 agregó allí la espera de la 0453. Como la allowlist exacta es normativa, la spec pasa a incluir el archivo únicamente para esa espera en `pendingBelowCutoff` (sin subir el cutoff 238 ni tocar las otras esperas), porque `migrations-applied` lo exige hasta aplicar; el gate de símbolos sigue sin exigir declaración. Sin cambios de `status`, criterios, `updated` ni otras secciones.

## OBJETIVO ORIGINAL

Que las funciones SQL de resolución del Portal no crucen tenants ni elijan un vínculo arbitrario: `client_delivery_addresses_validate_client()` valida por principal y tenant, y `get_portal_client_markbox()` y `get_user_tenant_id()` resuelven de forma determinista o fallan cerrado cuando hay más de un vínculo.

## COMPLETADO

- **Hechos verificados en el árbol antes de diseñar** (todos en `supabase/migrations/`):
  - `client_users` conserva `unique (auth_user_id)` (0080:30) y ninguna migración la retira: hoy un `auth.uid()` no puede tener dos vínculos activos. El handoff `c-l02-portal-visibilidad` (hallazgo 13) ya había anotado que cinco funciones dependen de esa garantía sin declararlo. La corrección cierra el cruce real (vínculo incoherente o con cliente borrado) y deja la función fail-closed si la garantía se retira.
  - `user_tenants` tiene PK `(user_id, tenant_id)` (0001:28): N membresías por usuario. `get_user_tenant_id()` (0200:50-62) resuelve con `limit 1` sin orden. No hay claim de tenant en el JWT (la única lectura de `auth.jwt()` es el `aal` de 0270) ni selector en la aplicación; `getStudioAccess` (`lib/studio/rbac-guard.ts:72-78`) toma su propia fila con `limit(1)`.
  - `client_delivery_addresses_validate_client()` (0198:125-152) sella tenant y Shipping Mark desde `clients` sin mirar el principal; sin RLS (dueño, SECURITY DEFINER, service_role) acepta cualquier cliente vivo. Los escritores DEFINER reales son `merge_clients` (0361), `rename_client_markbox` (0371) y `delete_delivery_address` (0427); los tres validan antes membresía o vínculo contra el tenant del cliente. La app escribe direcciones con el cliente de sesión (`app/portal/(app)/perfil/address-actions.ts:49,81`; `app/studio/(app)/clientes/actions.ts:777+`), así que la RLS de 0425 y «by tenant» aplican.
- **`supabase/migrations/0453_portal_helpers_principal_determinista.sql`** (`1fdfe9fb`):
  - `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión al inicio, como 0422; `reset` de ambos al final.
  - `do $preflight$` que falla cerrado con `P0001`, mensajes sin ids ni Shipping Marks: `auth.uid()` y roles; cuatro tablas con RLS y sus columnas; las tres funciones con su forma (retorno, lenguaje, `SECURITY DEFINER`, volatilidad) y ACL (`authenticated` ejecuta las helpers, `anon` no, nadie ejecuta la del trigger); cuerpo normalizado igual al histórico (0200 / 0080 / 0198, calculado desde los archivos reales) o al final; trigger `client_delivery_addresses_validate_trg` vivo con la forma de 0198; huella md5 del catálogo dependiente guardada en un GUC de sesión.
  - Tres `create or replace function` con `comment on function`, `search_path = ''`, nombres calificados y `(select auth.uid())`:
    - `get_user_tenant_id()`: `(array_agg(tenant_id))[1] … having count(*) = 1` sobre las membresías activas → con cero o más de una, `NULL`.
    - `get_portal_client_markbox()`: lo mismo sobre los vínculos activos cuyo cliente vive y comparte tenant con el vínculo.
    - `client_delivery_addresses_validate_client()`: cliente vivo (23514 sin uuid en el mensaje); si hay principal, membresía activa en el tenant del cliente o vínculo activo a ese cliente del mismo tenant, si no `42501`; sellado de 0198 conservado.
  - `do $postflight$`: cuerpos finales exactos, `SECURITY DEFINER`, volatilidad y `search_path` vacío; huella del catálogo dependiente idéntica; sin principal las dos helpers devuelven `NULL`.
  - Sin DML, grants, policies, tablas, índices ni triggers; `create or replace` conserva oid, dueño y ACL. Idempotente.
- **`supabase/tests/0453_portal_helpers_principal_determinista.test.sql`** (`1fdfe9fb`), 113 aserciones, rollback total. Migraciones reales 0006, 0080, 0081, 0198, 0230, 0347, 0425, 0411, 0258, 0261, 0267, 0294 y 0427 sobre stubs mínimos; `get_user_tenant_id()` y `current_studio_role()` extraídas del archivo 0200 por regexp. Cubre RED sobre main (dos membresías → un tenant y 5 filas de ese tenant; vínculo con cliente borrado → Shipping Mark y 1 envío; vínculo incoherente → 2 envíos `DUP`, uno por tenant; dos vínculos con la unique retirada → uno cualquiera; trigger sin RLS aceptando al vínculo de otro tenant, al de cliente borrado, al equipo de otro tenant y al titular de otro cliente, también por un comando DEFINER real), estático, huellas históricas contra los archivos reales, 13 casos de drift rechazados en el preflight y el guardián del postflight con huella sintética, catálogo y filas intactos, idempotencia, y el comportamiento con 0453 (detalle en la spec, tabla de evidencia).
- **Spec 0466** completa (`aa083acb`): contexto con evidencia, alcance, la regla y por qué `NULL`, el trigger caso por caso, la migración, locks y tiempos medidos, frontera e impacto en la app, evidencia, datos personales, allowlist, aceptación y producción. Índice regenerado con 453 specs.
- Cero cambios en `app/` y `lib/`. El gate de símbolos pendientes da 0 ROJO · 0 AMARILLO porque la 0453 no crea símbolos; no hace falta declaración.
- **Ronda 2 — espera de la 0453 en `supabase/migrations-baseline.json` (`2fea6ef6`).** Una entrada nueva `0453_portal_helpers_principal_determinista` en `pendingBelowCutoff`, agregada por script sobre el JSON parseado y reserializada con `JSON.stringify(…, null, 2)` (la forma exacta del archivo), al final del objeto, con el patrón de las vecinas 0414, 0415, 0422 y 0423 y los siete puntos del Director en un solo string (4543 caracteres): qué redefine y la regla nueva; lo que exige el preflight y que aborta sin cambiar nada; locks y tiempos medidos (sólo ACCESS SHARE sobre `clients`, `client_users` y `user_tenants`; 26,6 ms; `lock_timeout` 5 s y `statement_timeout` 30 s de sesión, que rigen también en autocommit); impacto en producción (frontera preventiva con un solo tenant y la unique de `client_users`; con dos membresías activas el Studio queda vacío sin mensaje por `getStudioAccess`, dicho explícito); lectura previa de `pg_get_functiondef` de las tres funciones y el trigger y los dos conteos agregados con su SQL, ambos con autorización de Sam; smoke posterior y retiro de la espera en rama propia; orden sin dependencia de despliegue ni de baja actividad; y el cierre literal exigido. `cutoff` sigue en 238, las otras cuatro esperas y `$doc` no cambian; el diff son 2 líneas insertadas y 1 retirada (la coma de la entrada anterior).

## IMPACTO ESPERADO AL APLICAR (locks y comportamiento)

- Locks retenidos hasta el COMMIT, medidos con el fixture confirmado y la migración en su propia transacción: `AccessShareLock` sobre `clients`, `client_users`, `user_tenants` y sus índices; `RowExclusiveLock` sobre `pg_description`; locks de objeto sobre las tres funciones; `AccessShareLock` sobre catálogos. **Ningún lock exclusivo de tabla**: nada del Studio ni del Portal hace cola. 26,6 ms la aplicación y 26,3 ms la reaplicación.
- Un usuario con dos membresías activas (hoy ninguno: un solo tenant según el conteo autorizado del 2026-09-13) deja de ver filas en toda tabla «by tenant», no escribe y las RPC responden `42501`; `getStudioAccess` seguiría mostrándole un rol por su propio `limit(1)` → Studio vacío sin mensaje claro (ver FUERA DE ALCANCE).
- Un vínculo del Portal incoherente o con cliente borrado deja de obtener Shipping Mark: cero filas por las policies que aún comparan sólo el Shipping Mark. En la app esos principales ya no entran desde `4c07759c`.
- Los escritores DEFINER de direcciones (0361, 0371, 0427) siguen pasando: validan lo mismo antes. `service_role` sin JWT conserva el sellado.

## VALIDACIÓN

Sin credenciales copiadas ni `.env`. Entorno: Node 24.20.0, pnpm 12.3.4, Docker 29.7.2, PostgreSQL 17.11 (`postgres:17`). Recibos fuera de Git, en temporales no durables: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\6738c191-1d07-42b7-baff-9ff98d589a2d\scratchpad\0453\`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio y antes de cada commit. |
| `corepack pnpm install --frozen-lockfile` | PASÓ (26,2 s; `install.log`). |
| Huellas históricas y finales (`hist.sql`, `forms.txt`) | PASÓ: calculadas aplicando 0200 (statement extraído del archivo), 0006, 0080 y 0198 reales y las tres sentencias de la 0453 en un Postgres desechable; incrustadas con `fill.mjs`. |
| Aplicación de la 0453 en desarrollo (`apply.sql`, `locks.sql`) | PASÓ: aplica y reaplica; timeouts restaurados; drift del trigger aborta con P0001; locks y tiempos de arriba. |
| Contrato 0453 en GREEN (`green-v6.log`) | PASÓ, exit 0, 113 aserciones; las notices RED baseline reproducen los cuatro huecos sobre las definiciones de main. Las corridas v1-v5 corrigieron aserciones del propio contrato (posición del DDL frente a un comentario, patrones LIKE, conteo de clientes con 0230, `search_path` que sí cambia, y el caso del miembro de dos tenants en el trigger, que se reclasificó como aceptado porque la membresía se verifica contra el tenant concreto del cliente). |
| Control rojo, `-v apply_fix=false` (`red-control.log`, `red-control-final.log`) | HECHO, con el rojo esperado: exit 3, «TEST 0453: Dos membresías activas → NULL (fail-closed), ya no un tenant cualquiera», antes y después de endurecer el contrato. |
| Mutantes (`mutants.mjs`, `mutants.log`, `mutants-results.json`, `mutants-results-r2.json`) | PASÓ: 30 mutantes, 30 muertos, controles con el original en verde antes y después; el archivo se restauró y verificó por sha256 (`da48bd18…`) tras cada uno. Primera serie 28/30; los dos sobrevivientes (S9 «preflight sin chequeo de forma», que caía en el postflight, y S15 «postflight sin huella», no observable) murieron tras endurecer el contrato (rechazo sólo de preflight y guardián del postflight con huella sintética). |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos (choques históricos ya aplicados, no se renumeran). |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO, sin declaración. |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 453 specs sincronizadas. |
| `git diff --cached --check` y allowlist | PASÓ en cada commit. Frente a `origin/main` `b07ad98b` cambian exactamente la migración, el contrato, la spec, el índice y este handoff (ronda 1), más `supabase/migrations-baseline.json` desde la ronda 2. |
| `E2E_PORT=3102 corepack pnpm verify` | **FALLÓ, exit 1**, sobre `aa083acb`, de 01:50:19 a 02:19:11 (−04:00), sin cuelgue (`verify.log`, `verify-plain.log`, `verify.meta`). De 17 pasos, 15 PASARON: harness; lint (0 errores y 8 warnings preexistentes en archivos no tocados); rsc-boundary (1601 módulos); typecheck; edge-functions; test (7226 pruebas en 555 archivos); docs:check (453 specs); numbering; feature-constants (5); components:check; governance:check; pending-migration-symbols (0 ROJO · 0 AMARILLO); sql-tests (194 contratos, incluidos el 0453 y los de 0411, 0412, 0413, 0425 y 0427); schema-rebuild (432 migraciones desde cero con la 0453, 18 sólo-ledger verificadas y aislamiento multi-tenant sobre 219 tablas y 2 tenants); y build. `migrations-applied` quedó en SKIP sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`: NO EJECUTADO. `e2e` FALLÓ por entorno en sus dos pasadas; en el reintento 151 pasados, 2 flaky, 18 omitidos y 15 fallidos: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, porque el WebServer revienta en `proxy.ts:67` sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (1164 trazas). Es el patrón conocido que anticipó el encargo y el diff no toca rutas ni auth. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde. Después de verify sólo cambió documentación: `status` de la spec, este handoff y el índice; se revalidaron `docs:index`/`docs:check`, `sdd:check` y `git diff --check`. |
| E2E autenticado, `migrations-applied` (ledger real), producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |
| `/ui-check` | NO EJECUTADO: no hay cambio visual. |

### Ronda 2 (sobre `01518252`; sólo la espera y este handoff)

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ: el claim se readquirió al retomar (se había liberado al cerrar la ronda 1) y el guard corrió antes de cada commit. Árbol limpio y `origin/main` sin avances (`b07ad98b`). |
| Serialización del baseline | PASÓ: el archivo era idéntico a `JSON.stringify(…, null, 2)` más salto final antes y después; sin CRLF. |
| `node -e "require('./supabase/migrations-baseline.json')"` | PASÓ: `cutoff` 238; esperas `0415, 0414, 0422, 0423, 0453`, en ese orden. |
| `node scripts/check-migrations-applied.mjs` | SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (exit 3), sin error de parseo: NO EJECUTADO contra el ledger, como se esperaba. |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO. |
| `corepack pnpm exec vitest run scripts/check-migrations-applied.test.mjs` | PASÓ: 22/22. |
| `corepack pnpm harness:test` | PASÓ: 98 pruebas, 0 fallos (incluye `merge-generated-records`, el driver del baseline). |
| `git diff --check` / `git diff --cached --check` | PASÓ. El commit `2fea6ef6` contiene sólo `supabase/migrations-baseline.json` (2 insertadas, 1 retirada). |
| `corepack pnpm verify` | NO EJECUTADO: desde `aa083acb` (donde `verify.meta` prueba la corrida completa) sólo cambian documentación (`01518252`, este handoff) y el baseline, que `verify` cubre con `migrations-applied` (SKIP sin credenciales, mismo resultado), `pending-migration-symbols` y `harness`, repetidos acá con el mismo veredicto. Código, SQL, pruebas y spec quedan byte a byte iguales: `git diff --stat aa083acb..HEAD` lista sólo el handoff, la spec (`status`), el índice y el baseline. |

### Ronda 3 (sólo texto: la spec y este handoff)

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ: el claim se readquirió al empezar y el guard corrió antes de cada commit. Árbol limpio y `origin/main` sin avances (`b07ad98b`). |
| `corepack pnpm docs:check` | PASÓ: 453 specs sincronizadas; `status` (`done`), título y `updated` (2026-09-14) sin cambios. |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos. |
| `git diff --check` / `--cached --check` | PASÓ. El commit `2a0238b8` contiene sólo la spec: 7 líneas insertadas y 2 retiradas, en tres hunks (el bullet nuevo de «Alcance», el sub-bullet retirado de «Fuera de alcance» y la línea nueva de «Allowlist exacta»). |
| «Allowlist exacta» contra `git diff --name-only origin/main...HEAD` | PASÓ: las 6 rutas coinciden una a una (migración, contrato, spec, índice, baseline y este handoff). |
| `corepack pnpm verify` | NO EJECUTADO, con el motivo de la ronda 2: desde `aa083acb` sólo cambian prosa de la spec y del handoff y la espera del baseline; código, SQL, pruebas e índice quedan idénticos. |

## REVISIÓN FOCAL DE DATOS Y GOBERNANZA

- **Datos (`revisar-datos-ve`):** ENCONTRADO en main y corregido localmente: un vínculo incoherente o con cliente borrado obtenía Shipping Mark y leía envíos de otro tenant, y sin RLS podía crear direcciones de un cliente ajeno. La 0453 no agrega campos ni tratamientos; sus mensajes no llevan ids ni Shipping Marks (el de cliente borrado deja de incluir el uuid). NO VERIFICABLE si ocurrió en producción: requiere el conteo agregado que la spec describe, con autorización.
- **Aislamiento multi-tenant:** no conformidad corregida localmente y verificada en PostgreSQL efímero; en producción NO VERIFICABLE hasta aplicar.
- **Excepción:** ninguna. **No conformidad nueva:** ninguna.

## COMMITS

- `53414c08` — chore(sdd): reserva SDD-0466 (cherry-pick de `e8531e07`, del Director).
- `1fdfe9fb` — fix(studio): SDD-0466 — migración 0453 y su contrato SQL.
- `aa083acb` — docs(sdd): SDD-0466 — spec e índice (el head sobre el que corrió `verify`).
- `01518252` — docs(handoff): SDD-0466 — cierre de la ronda 1 y spec en `done` (el head que revisó el Director).
- `2fea6ef6` — chore(db): SDD-0466 — declarar la espera de 0453 en `pendingBelowCutoff` (ronda 2).
- `15ea0316` — docs(handoff): SDD-0466 — ronda 2: espera de la 0453 declarada (el head que revisó el Director).
- `2a0238b8` — docs(sdd): SDD-0466 — ronda 3: alcance y allowlist incluyen la espera de 0453 en el baseline.
- Commit que contiene este documento: nota de la ronda 3 (hash final en la PR).

## PR / BRANCH

- **PR:** [#115 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/115), «fix(studio): SDD-0466 — helpers del Portal por principal, deterministas y sin cruce de tenant», base `main`. Head revisado por `verify`: `aa083acb`; el commit de este documento se publica después en un push normal.
- **Rama:** `codex/portal-helpers-principal-determinista`, publicada a sí misma con `git push -u origin codex/portal-helpers-principal-determinista:codex/portal-helpers-principal-determinista`, sin force. Base `main` `b07ad98b`.
  - Ronda 1: `1fdfe9fb`, `aa083acb` y `01518252`.
  - Ronda 2: `2fea6ef6` y `15ea0316`, en un único push normal.
  - Ronda 3: `2a0238b8` y el commit que contiene este documento, en un único push normal y sin verify (ver la tabla de la ronda 3).
- Worktree el indicado arriba. Sin merge, sin salir de borrador y sin aplicar migraciones.

## PENDIENTES DE ESTA TAREA

- **CI y revisión:** CI alojado sobre el head publicado de la ronda 3 y revisión final del Director. Sacar la PR de borrador y fusionar le corresponde al Director.
- **Espera en `supabase/migrations-baseline.json`:** declarada en la ronda 2 (`2fea6ef6`). Con credenciales, `migrations-applied` exime a la 0453 con motivo escrito hasta que se aplique.
- **Spec 0466 y la espera:** alineada en la ronda 3 (`2a0238b8`): «Alcance» y «Allowlist exacta» incluyen el baseline únicamente para esa espera, y la allowlist coincide una a una con `git diff --name-only origin/main...HEAD`.
- **Antes de aplicar la 0453**, en otra tarea con OK nominal de Sam y el runbook: leer `pg_get_functiondef` de las tres funciones y el trigger (sin filas); si un cuerpo difiere del repo, el preflight aborta y hay que revisar. Conteos agregados recomendados: membresías activas por usuario mayores que uno, y vínculos activos con cliente borrado o tenant distinto al de su cliente.
- **Después de aplicar:** smoke de una sesión del Studio (clientes) y una del Portal (Mi perfil › Direcciones y envíos); `migrations-applied` en verde.

## FUERA DE ALCANCE DETECTADO

- **`current_studio_role()` (`0200:70-82`), `get_portal_client_id()` (`0080:40-45`), `get_portal_client_tenant()` (`0105:44-49`) y `get_portal_person_id()` (`0187:28-40`)** comparten el `limit 1` sin orden. Con dos membresías el rol solo no abre nada porque el tenant es `NULL` (el contrato lo comprueba), y con vínculos inválidos las tres del Portal siguen devolviendo un valor. Arreglo: la misma forma `having count(*) = 1` con vínculo coherente, en una migración propia, más una revisión de las RPC 0401-0406, 0424 y 0431 que usan `limit 1` sobre `client_users`.
- **Policies del Portal que comparan sólo el Shipping Mark** (`shipments portal self read` de 0080 y afines, según inventario del Director): con la helper corregida dejan de servir a vínculos inválidos, pero un vínculo válido de T1 sigue leyendo filas de T2 con el mismo Shipping Mark. Cierre por policy como hizo 0452 (0416 ya lo hizo para `shipments`; verificar el inventario restante).
- **`getStudioAccess` (`lib/studio/rbac-guard.ts:72-78`)** toma un rol con `limit(1)` propio; con dos membresías la base cierra y la interfaz muestra el Studio vacío. Conviene resolver el tenant con `get_user_tenant_id()` y, si es `NULL` con sesión válida, mostrar «tu cuenta tiene más de una empresa activa; contacta a soporte».
- **`unique (auth_user_id)` de `client_users` (0080:30)** sigue sin comentario que declare quién depende de ella (hallazgo 13 de `c-l02`). Un `comment on constraint` en una migración propia lo dejaría escrito.
- **`_norte/backend/README.md`**, lectura exigida por AGENTS.md, no existe en la raíz; el documento vive en `docs/design/studio/_norte/backend/README.md`. Corregir la referencia.

## HANDOFF AL DIRECTOR

- **Orden seguro:**
  1. revisar la PR sobre el head publicado de la ronda 3 y su CI;
  2. fusionar sobre el SHA revisado, repitiendo antes el merge de main si avanzó; con la espera declarada, `migrations-applied` exime a la 0453 con motivo escrito;
  3. aplicar la 0453 en otra tarea: OK nominal de Sam, de a una, name exacto `0453_portal_helpers_principal_determinista`, con la lectura previa del catálogo y los dos conteos agregados que la espera imprime; no necesita ventana de baja actividad (sin locks de tabla) ni despliegue previo;
  4. smoke del Studio y del Portal, y retiro de la espera en una rama propia tras la verificación autorizada.
- **Aditiva respecto de producción:** no reescribe filas, no toca policies ni ACL; sólo redefine tres cuerpos con `create or replace`. Con una membresía y un vínculo coherente el comportamiento es el de hoy.
- **Gate de símbolos:** 0 ROJO · 0 AMARILLO sin declaración. **Conflictos posibles al fusionar** por el driver `dtd-generated-records`: `docs/specs/README.md` y ahora también `supabase/migrations-baseline.json`, si main suma specs o esperas; en GitHub no corre el driver, así que si main avanza hay que repetir el merge en la rama y revisar que `pendingBelowCutoff` conserve el orden de main con la 0453 al final.
- **Contenedores propios, todos retirados:** `dtd_w2_dev`. Los `dtd_sqltest_*` y `dtd_rebuild_*` los retiran sus scripts. No se tocó ningún contenedor ni proceso ajeno.
- **Ownership:** se libera al cierre con `node scripts/harness-worktree.mjs release --owner worker-w2-portal-helpers-20260914`, después de la última escritura. Se conservan el worktree y la rama.
