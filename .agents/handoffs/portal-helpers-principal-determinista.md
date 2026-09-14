# portal-helpers-principal-determinista — Helpers del Portal por principal, deterministas y sin cruce de tenant (SDD-0466 / migración 0453)

Fecha: 2026-09-14. Task ID: `portal-helpers-principal-determinista`. Estado de tarea: lista-para-revision, publicada como PR en borrador. Estado SDD-0466: `done`, que no significa aplicada.
Owner / sesión escritora: `worker-w2-portal-helpers-20260914`, Worker asignado por el Director (sesión Director del 2026-09-14). Sin subagentes escritores.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`, sin ninguna escritura en el checkout principal.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-helpers-principal-determinista`.
Rama: `codex/portal-helpers-principal-determinista`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`. En las rondas 1 a 3 main no avanzó. En la ronda 4 el Director trajo `832c0370` (PR #113) con update-branch (`d224613d`, incorporado acá por fast-forward) y esta sesión trajo `7cd50f4a` (PR #116) con el driver de main (`1f1245d2`).
SDD: `docs/specs/0466-portal-helpers-principal-determinista/spec.md`, reservada por el Director en `e8531e07` (rama local `codex/sdd-reserve-0466-portal-helpers-principal-determinista`), incorporada con `git cherry-pick` (`53414c08`) y completada acá. Migración asignada y usada: 0453.

Permisos del encargo:
- **Autorizado:** commits locales selectivos (`fix(studio): SDD-0466 — …`), publicar la rama a sí misma y abrir la PR en borrador contra `main`. En la ronda 4, además, fast-forward a la rama remota y merge de `origin/main` en la rama con el driver de main.
- **Prohibido:** merge a main, deploy, aplicar migraciones, leer filas de negocio o PII, tocar el ruleset, borrar ramas o worktrees, escribir en el checkout principal, tocar 0230, 0401 y 0416-0452, el Portal y el Studio. `supabase/migrations-baseline.json` quedó excluido en la ronda 1 salvo exigencia del gate de símbolos; en la ronda 2 el Director lo incluyó explícitamente para una única entrada nueva en `pendingBelowCutoff`.

Aceptación del encargo, en cuatro puntos:
1. Test SQL que reproduzca el cruce (vínculo `client_users` de otro tenant o cliente borrado) contra `client_delivery_addresses_validate_client()`, rojo sobre main y verde con la corrección.
2. Test SQL que muestre qué devuelven `get_portal_client_markbox()` y `get_user_tenant_id()` con dos vínculos o dos membresías; corrección por regla explícita o `NULL` fail-closed; la spec documenta la regla y por qué.
3. Las RPC de 0411, 0412 y 0413 y las policies que dependen de `get_user_tenant_id()` conservan su comportamiento con un solo vínculo: postflight de catálogo y tests existentes en verde.
4. Cero cambios en `app` y `lib`; consumidores a cambiar, como FUERA DE ALCANCE.

Dependencias: ninguna. Otros tres Workers en paralelo no tocan `supabase/`.
Ronda 2 (2026-09-14, revisión del Director sobre `01518252`): SQL de la 0453, spec y handoff aceptados en lo técnico. Única omisión: la espera de la 0453 en `supabase/migrations-baseline.json`, sin la cual `migrations-applied` sale rojo con credenciales al fusionar. El Director amplió la allowlist únicamente a ese archivo para agregar UNA entrada en `pendingBelowCutoff` con clave exacta `0453_portal_helpers_principal_determinista`, sin subir el cutoff 238 ni tocar las otras cuatro esperas, y pidió actualizar sólo este handoff (PENDIENTES y COMMITS). Nada más cambia.
Ronda 3 (2026-09-14, revisión del Director sobre `15ea0316`): sólo texto, con allowlist limitada a la spec 0466 y este handoff. «Alcance» de la spec decía que `supabase/migrations-baseline.json` quedaba fuera y «Allowlist exacta» no lo listaba, aunque la ronda 2 agregó allí la espera de la 0453. Como la allowlist exacta es normativa, la spec pasa a incluir el archivo únicamente para esa espera en `pendingBelowCutoff` (sin subir el cutoff 238 ni tocar las otras esperas), porque `migrations-applied` lo exige hasta aplicar; el gate de símbolos sigue sin exigir declaración. Sin cambios de `status`, criterios, `updated` ni otras secciones.
Ronda 4 (2026-09-14, sobre `d6006f7b` y el merge `d224613d`): la lectura previa en producción que autorizó Sam, sólo de catálogo y agregados, mostró que la 0453 abortaría en su preflight. No se aplicó nada.
- **Deriva:** `client_delivery_addresses_validate_client()` corre el cuerpo de 0198 sin su comentario interno de tres líneas (md5(prosrc) `7db6f812a549df579f2d7d0d6cd72298`; owner postgres, SECURITY DEFINER, volátil, `search_path=public`, ACL `{postgres=X/postgres,service_role=X/postgres}`; `client_delivery_addresses_validate_trg` vivo con tgtype 23 y tgenabled O, y `client_delivery_addresses_touch`). Los otros dos cuerpos coinciden con 0200 y 0080.
- **Conteos agregados:** 0 usuarios con más de una membresía activa, 1 vínculo `client_users` activo cuyo cliente está borrado y 0 vínculos activos con tenant distinto.
- **Pedido:** aceptar la forma Cloud con una constante nueva, sin relajar nada más ni tocar cuerpos finales ni postflight; un caso de contrato que la acepte y otro con un cuerpo distinto que aborte, con GREEN, RED y un mutante de la constante; registrar deriva, conteos e impacto en la spec y en la espera, con la línea de lo que hace la app; fast-forward a la rama remota antes de los commits y, al terminar, main con su driver si ya contenía la PR #116; `verify` sin e2e. Allowlist sin cambios.

## OBJETIVO ORIGINAL

Que las funciones SQL de resolución del Portal no crucen tenants ni elijan un vínculo arbitrario: `client_delivery_addresses_validate_client()` valida por principal y tenant, y `get_portal_client_markbox()` y `get_user_tenant_id()` resuelven de forma determinista o fallan cerrado cuando hay más de un vínculo.

## COMPLETADO

- **Hechos verificados en el árbol antes de diseñar** (todos en `supabase/migrations/`):
  - `client_users` conserva `unique (auth_user_id)` (0080:30) y ninguna migración la retira: hoy un `auth.uid()` no puede tener dos vínculos activos. El handoff `c-l02-portal-visibilidad` (hallazgo 13) ya había anotado que cinco funciones dependen de esa garantía sin declararlo. La corrección cierra el cruce real (vínculo incoherente o con cliente borrado) y deja la función fail-closed si la garantía se retira.
  - `user_tenants` tiene PK `(user_id, tenant_id)` (0001:28): N membresías por usuario. `get_user_tenant_id()` (0200:50-62) resuelve con `limit 1` sin orden. No hay claim de tenant en el JWT (la única lectura de `auth.jwt()` es el `aal` de 0270) ni selector en la aplicación; `getStudioAccess` (`lib/studio/rbac-guard.ts:72-78`) toma su propia fila con `limit(1)`.
  - `client_delivery_addresses_validate_client()` (0198:125-152) sella tenant y Shipping Mark desde `clients` sin mirar el principal; sin RLS (dueño, SECURITY DEFINER, service_role) acepta cualquier cliente vivo. Los escritores DEFINER reales son `merge_clients` (0361), `rename_client_markbox` (0371) y `delete_delivery_address` (0427); los tres validan antes membresía o vínculo contra el tenant del cliente. La app escribe direcciones con el cliente de sesión (`app/portal/(app)/perfil/address-actions.ts:49,81`; `app/studio/(app)/clientes/actions.ts:777+`), así que la RLS de 0425 y «by tenant» aplican.
- **`supabase/migrations/0453_portal_helpers_principal_determinista.sql`** (`1fdfe9fb`):
  - `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión al inicio, como 0422; `reset` de ambos al final.
  - `do $preflight$` que falla cerrado con `P0001`, mensajes sin ids ni Shipping Marks: `auth.uid()` y roles; cuatro tablas con RLS y sus columnas; las tres funciones con su forma (retorno, lenguaje, `SECURITY DEFINER`, volatilidad) y ACL (`authenticated` ejecuta las helpers y no la del trigger, y `anon` no ejecuta ninguna; la ronda 1 decía «nadie ejecuta la del trigger», que no es lo que se exige: producción tiene `service_role` y el preflight no lo mira); cuerpo normalizado igual al histórico (0200 / 0080 / 0198, calculado desde los archivos reales) o al final; trigger `client_delivery_addresses_validate_trg` vivo con la forma de 0198; huella md5 del catálogo dependiente guardada en un GUC de sesión.
  - Tres `create or replace function` con `comment on function`, `search_path = ''`, nombres calificados y `(select auth.uid())`:
    - `get_user_tenant_id()`: `(array_agg(tenant_id))[1] … having count(*) = 1` sobre las membresías activas → con cero o más de una, `NULL`.
    - `get_portal_client_markbox()`: lo mismo sobre los vínculos activos cuyo cliente vive y comparte tenant con el vínculo.
    - `client_delivery_addresses_validate_client()`: cliente vivo (23514 sin uuid en el mensaje); si hay principal, membresía activa en el tenant del cliente o vínculo activo a ese cliente del mismo tenant, si no `42501`; sellado de 0198 conservado.
  - `do $postflight$`: cuerpos finales exactos, `SECURITY DEFINER`, volatilidad y `search_path` vacío; huella del catálogo dependiente idéntica; sin principal las dos helpers devuelven `NULL`.
  - Sin DML, grants, policies, tablas, índices ni triggers; `create or replace` conserva oid, dueño y ACL. Idempotente.
- **`supabase/tests/0453_portal_helpers_principal_determinista.test.sql`** (`1fdfe9fb`), 113 aserciones en la ronda 1, rollback total. Migraciones reales 0006, 0080, 0081, 0198, 0230, 0347, 0425, 0411, 0258, 0261, 0267, 0294 y 0427 sobre stubs mínimos; `get_user_tenant_id()` y `current_studio_role()` extraídas del archivo 0200 por regexp. Cubre RED sobre main (dos membresías → un tenant y 5 filas de ese tenant; vínculo con cliente borrado → Shipping Mark y 1 envío; vínculo incoherente → 2 envíos `DUP`, uno por tenant; dos vínculos con la unique retirada → uno cualquiera; trigger sin RLS aceptando al vínculo de otro tenant, al de cliente borrado, al equipo de otro tenant y al titular de otro cliente, también por un comando DEFINER real), estático, huellas históricas contra los archivos reales, 13 casos de drift rechazados en el preflight y el guardián del postflight con huella sintética, catálogo y filas intactos, idempotencia, y el comportamiento con 0453 (detalle en la spec, tabla de evidencia).
- **Spec 0466** completa (`aa083acb`): contexto con evidencia, alcance, la regla y por qué `NULL`, el trigger caso por caso, la migración, locks y tiempos medidos, frontera e impacto en la app, evidencia, datos personales, allowlist, aceptación y producción. Índice regenerado con 453 specs.
- Cero cambios en `app/` y `lib/`. El gate de símbolos pendientes da 0 ROJO · 0 AMARILLO porque la 0453 no crea símbolos; no hace falta declaración.
- **Ronda 2 — espera de la 0453 en `supabase/migrations-baseline.json` (`2fea6ef6`).** Una entrada nueva `0453_portal_helpers_principal_determinista` en `pendingBelowCutoff`, agregada por script sobre el JSON parseado y reserializada con `JSON.stringify(…, null, 2)` (la forma exacta del archivo), al final del objeto, con el patrón de las vecinas 0414, 0415, 0422 y 0423 y los siete puntos del Director en un solo string (4543 caracteres). `cutoff` sigue en 238, las otras cuatro esperas y `$doc` no cambian; el diff son 2 líneas insertadas y 1 retirada (la coma de la entrada anterior). Su texto de locks quedó corregido en la ronda 4.
- **Ronda 3 — spec (`2a0238b8`):** «Alcance» y «Allowlist exacta» incluyen el baseline únicamente para esa espera.
- **Ronda 4 — migración (`7da114d1`):**
  - Constante `c_validate_0198_cloud` con la forma normalizada exacta de la lectura de producción, comentada con fecha y md5. La condición pasa a `v_body <> c_validate_0198 and v_body <> c_validate_0198_cloud and v_body <> c_validate_0453`, y el mensaje, a «no es el de 0198 (repo o Cloud) ni el final». Es el precedente de 0423 con el cuerpo de 0195. Cuerpos finales y postflight sin cambios.
  - Comentarios de cabecera corregidos con lo medido: el preflight acepta la forma Cloud; la ACL exigida es la que el código comprueba (`authenticated` las helpers y no la del trigger, `anon` ninguna); en main ninguna policy ni función nombra ya la helper, pero la RPC sigue llegando a la app; y los locks son sólo ACCESS SHARE, sobre 19 tablas y 28 índices, con la contención medida.
- **Ronda 4 — contrato (`7da114d1`), 119 aserciones:**
  - Variantes de 0198 construidas desde el archivo real: la Cloud (sin el comentario) y una casi Cloud (sin además el filtro de cliente vivo).
  - Caso de producción, en un savepoint: forma Cloud, ACL exactas de producción y los dos triggers, comparados con el literal de la lectura copiado en el contrato, no con la migración. La 0453 aplica, deja las tres formas finales, conserva las ACL exactas y el trigger, y `c_validate_0198_cloud` resulta ser la lectura carácter por carácter y distinta de 0198 del repo. El savepoint se revierte entero y el resto del contrato corre sobre el repo.
  - El cuerpo casi Cloud aborta en el preflight con el mensaje del cuerpo del trigger y deja el catálogo intacto.
  - La cabecera aclara que el RED por «shipments portal self read» usa la policy de 0080 que consumía la helper, que en main reemplazó 0416.
- **Ronda 4 — espera (`d81c181e`):** sólo el valor de la 0453, reescrito por script (7230 caracteres), con los siete puntos:
  - la regla;
  - el preflight con la deriva medida (cuerpo sin comentario, md5, `search_path`, ACL y trigger) y la aceptación de la forma Cloud;
  - locks y contención medidos sobre el schema completo, con la corrección explícita de la cifra anterior;
  - el impacto con los tres conteos: el vínculo con cliente borrado deja de resolver Shipping Mark, pero ninguna policy ni función usa ya la helper; lectores y acciones con `NULL`; la app ya no deja entrar a ese principal (`lib/portal/portal-queries.ts:89-95` y `app/portal/(app)/layout.tsx:39-40`); y el Studio vacío sin mensaje con dos membresías;
  - la lectura previa que hay que repetir, con el SQL de catálogo y de los tres conteos, más el smoke posterior;
  - el orden;
  - el cierre literal.
  `cutoff` 238, orden de las esperas y las otras cuatro intactos; diff de 1 línea por 1.
- **Ronda 4 — spec (`3c424b94`):**
  - Contexto: lectura agregada y de catálogo del 2026-09-14, y la helper ya sin policies consumidoras en main.
  - Alcance: corregido el punto de las policies por Shipping Mark.
  - La migración: la forma Cloud y la ACL que se exige de verdad.
  - Locks y tiempos: schema completo, contención y la corrección de la cifra anterior.
  - Frontera e impacto: el vínculo con cliente borrado, los lectores, las acciones y la app, con archivo y línea.
  - Evidencia: 119 aserciones, fila 3b, control rojo de la ronda 4, md5 no reproducible y schema completo.
  - Datos personales, un criterio de aceptación de la ronda 4 y Producción.
  `status`, título y `updated` sin cambios.
- **Ronda 4 — merge de main (`1f1245d2`):** trae `7cd50f4a` (PR #116, SDD-0465). El único registro generado compartido, `docs/specs/README.md`, lo resolvió el driver de main, copiado de `origin/main` a un temporal, y se regeneró con 454 specs.

## IMPACTO ESPERADO AL APLICAR (locks y comportamiento)

- **Locks,** medidos en la ronda 4 sobre el schema completo reconstruido (431 migraciones sin la 0453, 603 policies) con la forma y las ACL de producción:
  - sólo `AccessShareLock` hasta el COMMIT, sobre 19 tablas y 28 índices: `clients`, `client_users` y `user_tenants` por el smoke del postflight, y el resto porque el deparse con `pg_get_expr` de la huella toma ese modo sobre las tablas que nombran las subconsultas de las policies;
  - `RowExclusiveLock` sobre `pg_description`;
  - ninguno hace esperar lecturas ni escrituras;
  - con otra sesión reteniendo `ACCESS EXCLUSIVE` sobre `clients`, la 0453 cortó a los 5,0 s por `lock_timeout`, se revirtió y dejó las funciones intactas;
  - 63 a 89 ms la aplicación y 67 a 68 ms la reaplicación.
  - Corrección: las rondas 1 a 3 decían «sólo `clients`, `client_users` y `user_tenants`; 26,6 ms», medido sobre el fixture mínimo, sin policies con subconsultas.
- **Membresías:** 0 usuarios con más de una activa (lectura agregada del 2026-09-14). Si llegara a haber uno, dejaría de ver filas en toda tabla «by tenant», no escribiría y las RPC responderían `42501`; `getStudioAccess` le seguiría dando un rol por su propio `limit(1)`, así que vería el Studio vacío sin mensaje (ver FUERA DE ALCANCE).
- **Vínculo con cliente borrado,** 1 en la lectura: `get_portal_client_markbox()` le devuelve `NULL`. En el catálogo de main ninguna policy ni función nombra la helper (0 de 603 policies), así que no cambia ninguna lectura por RLS; en producción se confirma con la consulta de la lectura previa. Los lectores del Portal devuelven vacío (`lib/portal/portal-queries.ts:173-174`, entre otros) y las acciones responden «Tu sesión expiró. Vuelve a entrar.» sin escribir (`app/portal/(app)/proveedores/actions.ts:326-327`, `app/portal/(app)/academia/actions.ts:39-40`). La app ya no deja entrar a ese principal: `resolvePortalClientPrincipal` devuelve `null` con el cliente borrado (`lib/portal/portal-queries.ts:89-95`) y el layout lo manda a `/entrar` (`app/portal/(app)/layout.tsx:39-40`).
- **Escritores DEFINER de direcciones** (0361, 0371, 0427): siguen pasando, porque validan lo mismo antes. `service_role` sin JWT conserva el sellado.

## VALIDACIÓN

Sin credenciales copiadas ni `.env`. Entorno: Node 24.20.0, pnpm 12.3.4, Docker 29.7.2, PostgreSQL 17.11 (`postgres:17`). Recibos fuera de Git, en temporales no durables: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\6738c191-1d07-42b7-baff-9ff98d589a2d\scratchpad\0453\`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio y antes de cada commit. |
| `corepack pnpm install --frozen-lockfile` | PASÓ (26,2 s; `install.log`). |
| Huellas históricas y finales (`hist.sql`, `forms.txt`) | PASÓ: calculadas aplicando 0200 (statement extraído del archivo), 0006, 0080 y 0198 reales y las tres sentencias de la 0453 en un Postgres desechable; incrustadas con `fill.mjs`. |
| Aplicación de la 0453 en desarrollo (`apply.sql`, `locks.sql`) | PASÓ: aplica y reaplica; timeouts restaurados; drift del trigger aborta con P0001. Las cifras de locks y tiempos de esa corrida venían del fixture mínimo y la ronda 4 las corrigió. |
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

### Ronda 4 (forma Cloud de 0198, espera, spec y merge de main)

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ: el claim se readquirió al empezar y el guard corrió antes de cada commit y del merge. |
| Fast-forward a la rama remota | PASÓ: `git merge --ff-only origin/codex/portal-helpers-principal-determinista` llevó `d6006f7b` a `d224613d`, el merge de main `832c0370` (PR #113) que hizo el Director. Después, `docs:check` con 453 specs y el baseline intacto. |
| Forma de producción sobre el schema completo (`rebuild.mjs`, `measure.sql`, `rebuild-measure.log`) | PASÓ: 431 migraciones sin la 0453, reconstruidas en 15 s. Con 0198 sin comentario y las ACL de producción, coinciden con la lectura los cuerpos normalizados, `search_path`, ACL exactas, owner, SECURITY DEFINER, volatilidad y triggers (23/O y 19/O). Superficie de la helper en main: 0 policies de 603 y 0 funciones. |
| 0453 de la ronda 3 sobre esa forma (`rebuild-round3.log`) | ROJO esperado: exit 3 con «0453 abortada: el cuerpo de client_delivery_addresses_validate_client() no es el de 0198 ni el final», el mismo mensaje que en producción. |
| 0453 de la ronda 4 sobre esa forma (`apply-locks.sql`, `rebuild-apply.log`) | PASÓ: aplica, deja las formas finales y conserva las ACL exactas. Locks: sólo `AccessShareLock` en 19 tablas y 28 índices, más `RowExclusiveLock` en `pg_description`. |
| Tiempos (`timing.sql`, `rebuild-timing.log`) | MEDIDO sin otra carga: 88,5, 69,8 y 62,7 ms la aplicación; 67,2 y 68,2 ms la reaplicación. |
| Contención (`contention.sql`, `rebuild-contention.log`) | PASÓ: con `ACCESS EXCLUSIVE` retenido sobre `clients`, «canceling statement due to lock timeout» en la huella del preflight a los 5034 ms; rollback, funciones intactas y timeouts de sesión en 0. |
| md5 de producción (`md5-0198.mjs`, `md5-search.mjs`) | NO REPRODUCIBLE, y así queda documentado: 0198 tiene el comentario en `2678d4f2` y en `f27f4941`, y 1152 variantes no coinciden. La forma normalizada es idéntica a la lectura. |
| Contrato 0453 GREEN (`r4-green-final2.log`) | PASÓ, exit 0, 119 aserciones. |
| Control rojo sin 0453 (`r4-red-final2.log`) | HECHO, con el rojo esperado: exit 3, «Dos membresías activas → NULL (fail-closed), ya no un tenant cualquiera». |
| Mutantes (`mutants.mjs`, `mutants-r4.log`/`.json`, `mutants-r4b.log`/`.json`) | PASÓ: 34 de 34, con los dos controles en verde y el sha256 `4f622ea9…` restaurado tras cada uno. Son los 30 anteriores más C1 (la condición sin la forma Cloud), C2 (la constante Cloud igual a la de 0198 del repo), C3 (la constante Cloud sin el filtro de cliente vivo) y R3 (la 0453 de la ronda 3). En la primera serie, C2, C3 y R3 murieron en la comprobación del fixture, que leía la constante desde la migración; el contrato pasó a comparar contra el literal de la lectura, y en la segunda serie los cuatro murieron en el preflight, R3 con el mensaje exacto de producción. |
| Espera en el baseline (`r4-wait.mjs`) | PASÓ: JSON válido con la serialización exacta; `cutoff` 238; 5 esperas en el mismo orden; sólo cambió el valor de la 0453 (1 línea por 1); cierre literal presente y sin uuid. `check-migrations-applied` quedó en SKIP sin credenciales (exit 3), sin error de parseo; `check-pending-migration-symbols` dio 0 ROJO · 0 AMARILLO. |
| `corepack pnpm docs:check` / `sdd:check` / `git diff --check` | PASÓ antes de cada commit; tras el merge, con 454 specs. |
| Merge de main con el driver de main | PASÓ: `git show origin/main:scripts/merge-generated-records.mjs` a un temporal (sin imports locales e idéntico al de la rama) y `-c merge.dtd-generated-records.driver=…`. Salida «merge semántico: docs/specs/README.md», sin conflictos; `docs:index` regeneró 454 specs, y `docs:check`, `sdd:check`, el baseline y `git diff --cached --check` quedaron en verde. |
| `VERIFY_SKIP_E2E=1 E2E_PORT=3102 corepack pnpm verify` sobre `1f1245d2` | **Sin fallos en lo medido, exit 0, pero con cierre incompleto:** corrió de 03:39:04 a 03:48:29 (−04:00), sin cuelgue (`verify-r4.log`, `verify-r4-plain.log`, `verify-r4.meta`). PASARON 15 de 17 pasos: harness; lint (0 errores y 8 warnings preexistentes en archivos no tocados); rsc-boundary (1601 módulos); typecheck; edge-functions (4); test (7256 pruebas en 558 archivos); docs:check (454 specs); numbering; feature-constants (5); components:check; governance:check; pending-migration-symbols (0 ROJO · 0 AMARILLO); sql-tests (194 contratos, con el 0453 de la ronda 4); schema-rebuild (432 migraciones desde cero con la 0453 y aislamiento multi-tenant sobre 219 tablas y 2 tenants); y build. `migrations-applied` quedó en SKIP sin credenciales: NO EJECUTADO. `e2e` quedó NO EJECUTADO a pedido del Director (`VERIFY_SKIP_E2E=1`), porque el cambio es sólo de SQL y documentación. Veredicto literal: `verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, e2e. No hubo fallos en lo medido (15/17); exit 0 NO equivale a cierre verde completo.` Después de verify sólo cambia este handoff. |
| Alcance frente a main | PASÓ: `git diff --name-only origin/main...HEAD` lista las 6 rutas de la allowlist. |

## REVISIÓN FOCAL DE DATOS Y GOBERNANZA

- **Datos (`revisar-datos-ve`):**
  - ENCONTRADO en main y corregido localmente: la helper le entregaba Shipping Mark a vínculos incoherentes o con cliente borrado, y el trigger, sin RLS, dejaba crear direcciones bajo un cliente ajeno. Por RLS la helper ya no exponía filas en main, porque ninguna policy la nombra.
  - La 0453 no agrega campos ni tratamientos. Sus mensajes no llevan ids ni Shipping Marks, y el de cliente borrado deja de incluir el uuid.
  - Conteos del 2026-09-14: el cruce entre tenants no era posible, con 0 vínculos incoherentes y un solo tenant. Hay 1 vínculo con cliente borrado, que recibía el Shipping Mark de su propio cliente borrado.
  - NO VERIFICABLE si ese principal lo usó: haría falta revisar los registros de acceso de la API.
- **Aislamiento multi-tenant:** no conformidad corregida localmente y verificada en PostgreSQL efímero; en producción NO VERIFICABLE hasta aplicar.
- **Excepción:** ninguna. **No conformidad nueva:** ninguna.

## COMMITS

- `53414c08` — chore(sdd): reserva SDD-0466 (cherry-pick de `e8531e07`, del Director).
- `1fdfe9fb` — fix(studio): SDD-0466 — migración 0453 y su contrato SQL.
- `aa083acb` — docs(sdd): SDD-0466 — spec e índice (el head sobre el que corrió `verify` en la ronda 1).
- `01518252` — docs(handoff): SDD-0466 — cierre de la ronda 1 y spec en `done`.
- `2fea6ef6` — chore(db): SDD-0466 — declarar la espera de 0453 en `pendingBelowCutoff` (ronda 2).
- `15ea0316` — docs(handoff): SDD-0466 — ronda 2: espera de la 0453 declarada.
- `2a0238b8` — docs(sdd): SDD-0466 — ronda 3: alcance y allowlist incluyen la espera de 0453 en el baseline.
- `d6006f7b` — docs(handoff): SDD-0466 — ronda 3: nota de la alineación de la spec.
- `d224613d` — merge de main `832c0370` (PR #113), hecho por el Director con update-branch e incorporado por fast-forward.
- `7da114d1` — fix(studio): SDD-0466 — ronda 4: el preflight de 0453 acepta el cuerpo Cloud de 0198.
- `d81c181e` — chore(db): SDD-0466 — ronda 4: la espera de 0453 registra la deriva de 0198, los conteos y los locks medidos.
- `3c424b94` — docs(sdd): SDD-0466 — ronda 4: deriva de producción, conteos, impacto y locks medidos.
- `1f1245d2` — merge de `origin/main` `7cd50f4a` (PR #116) con el driver de main e índice regenerado (el head sobre el que corrió `verify` en la ronda 4).
- Commit que contiene este documento: nota de la ronda 4 (hash final en la PR).

## PR / BRANCH

- **PR:** [#115 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/115), «fix(studio): SDD-0466 — helpers del Portal por principal, deterministas y sin cruce de tenant», base `main`. Head verificado por `verify` en la ronda 4: `1f1245d2`; el commit de este documento se publica en el mismo push normal.
- **Rama:** `codex/portal-helpers-principal-determinista`, publicada a sí misma con `git push -u origin codex/portal-helpers-principal-determinista:codex/portal-helpers-principal-determinista`, sin force. Base: `main` `7cd50f4a`.
  - Ronda 1: `1fdfe9fb`, `aa083acb` y `01518252`.
  - Ronda 2: `2fea6ef6` y `15ea0316`, en un único push normal.
  - Ronda 3: `2a0238b8` y `d6006f7b`, en un único push normal.
  - Ronda 4: `d224613d` ya estaba en la rama remota; `7da114d1`, `d81c181e`, `3c424b94`, `1f1245d2` y el commit que contiene este documento, en un único push normal.
- Worktree el indicado arriba. Sin merge a main, sin salir de borrador y sin aplicar migraciones.

## PENDIENTES DE ESTA TAREA

- **CI y revisión:** CI alojado sobre el head publicado de la ronda 4 y revisión del Director. Sacar la PR de borrador y fusionar le corresponde al Director.
- **Espera y spec:** actualizadas en la ronda 4 (`d81c181e` y `3c424b94`). La allowlist sigue coincidiendo una a una con `git diff --name-only origin/main...HEAD`.
- **Antes de aplicar la 0453**, en otra tarea con OK nominal de Sam y el runbook: repetir la lectura que imprime la espera (`pg_get_functiondef` de las tres funciones y del trigger, cero policies que nombren la helper y los tres conteos). El preflight falla cerrado igual si algo cambió.
- **Después de aplicar:** smoke de una sesión del Studio (clientes y ficha con direcciones) y de una del Portal (Mi perfil › Direcciones y envíos), `migrations-applied` en verde y retiro de la espera en una rama propia.

## FUERA DE ALCANCE DETECTADO

- **`current_studio_role()` (`0200:70-82`), `get_portal_client_id()` (`0080:40-45`), `get_portal_client_tenant()` (`0105:44-49`) y `get_portal_person_id()` (`0187:28-40`)** comparten el `limit 1` sin orden. Con dos membresías el rol solo no abre nada porque el tenant es `NULL` (el contrato lo comprueba), y con vínculos inválidos las tres del Portal siguen devolviendo un valor. Arreglo: la misma forma `having count(*) = 1` con vínculo coherente, en una migración propia, más una revisión de las RPC 0401-0406, 0424 y 0431 que usan `limit 1` sobre `client_users`.
- **`softDeleteClientAction` (`app/studio/(app)/clientes/actions.ts:412-431`)** marca `deleted_at` en `clients` y no revoca el vínculo del Portal (no llama a `portal_revoke_client`). Es el origen probable del vínculo activo con cliente borrado que midió el Director. `merge_clients` (0361:117-134) sí muda o revoca el vínculo. Arreglo: revocar el acceso en la misma operación, o una RPC de baja que haga las dos cosas con auditoría. Revocar el vínculo que ya existe es una escritura en producción y necesita su propia autorización; la 0453 no depende de eso.
- **`getStudioAccess` (`lib/studio/rbac-guard.ts:72-78`)** toma un rol con `limit(1)` propio; con dos membresías la base cierra y la interfaz muestra el Studio vacío. Conviene resolver el tenant con `get_user_tenant_id()` y, si es `NULL` con sesión válida, mostrar «tu cuenta tiene más de una empresa activa; contacta a soporte».
- **`unique (auth_user_id)` de `client_users` (0080:30)** sigue sin comentario que declare quién depende de ella (hallazgo 13 de `c-l02`). Un `comment on constraint` en una migración propia lo dejaría escrito.
- **`_norte/backend/README.md`**, lectura exigida por AGENTS.md, no existe en la raíz; el documento vive en `docs/design/studio/_norte/backend/README.md`. Corregir la referencia.
- **Corrección de la ronda 4 a un punto anterior de esta lista:** las rondas 1 a 3 decían que quedaban policies del Portal comparando sólo el Shipping Mark con la helper. Medido sobre el schema de main reconstruido, no queda ninguna (0 de 603 policies, 0 funciones), así que ese punto se retira.

## HANDOFF AL DIRECTOR

- **Orden seguro:**
  1. revisar la PR sobre el head publicado de la ronda 4 y su CI;
  2. fusionar sobre el SHA revisado, repitiendo antes el merge de main con el driver si avanzó; con la espera declarada, `migrations-applied` exime a la 0453 con motivo escrito;
  3. aplicar la 0453 en otra tarea: OK nominal de Sam, de a una, name exacto `0453_portal_helpers_principal_determinista`, repitiendo antes la lectura que imprime la espera. No necesita ventana de baja actividad, porque sólo toma ACCESS SHARE y, si corta ante un DDL concurrente, se reintenta; tampoco necesita despliegue previo;
  4. smoke del Studio y del Portal, y retiro de la espera en una rama propia tras la verificación autorizada.
- **Aditiva respecto de producción:** no reescribe filas, no toca policies ni ACL; sólo redefine tres cuerpos con `create or replace`. Con una membresía y un vínculo coherente el comportamiento es el de hoy.
- **Correcciones de evidencia propia en la ronda 4, para que las revises explícitamente:**
  - locks: de «tres tablas y 26,6 ms» a 19 tablas y 28 índices, de 63 a 89 ms, con la contención medida;
  - efecto de la helper por RLS: ya no quedan policies consumidoras en main;
  - frase de la ACL: el preflight no exige que sólo el dueño ejecute la función del trigger, y producción tiene `service_role`.
  Las tres están dentro de la allowlist (migración, spec, espera y este handoff).
- **Decisión que no es de esta tarea:** qué hacer con el vínculo activo con cliente borrado (revocarlo es una escritura autorizable aparte).
- **Gate de símbolos:** 0 ROJO · 0 AMARILLO sin declaración. **Conflictos posibles al fusionar** por el driver `dtd-generated-records`: `docs/specs/README.md` y `supabase/migrations-baseline.json`, si main suma specs o esperas. En GitHub no corre el driver, así que si main avanza hay que repetir el merge en la rama y revisar que `pendingBelowCutoff` conserve el orden de main con la 0453 al final.
- **Contenedores propios, todos retirados:** `dtd_w2_dev`, `dtd_w2_r4` y `dtd_w2_rebuild`. Los `dtd_sqltest_*` y `dtd_rebuild_*` de `verify` los retiran sus scripts. No se tocó ningún contenedor ni proceso ajeno.
- **Ownership:** se libera al cierre con `node scripts/harness-worktree.mjs release --owner worker-w2-portal-helpers-20260914`, después de la última escritura. Se conservan el worktree y la rama.
