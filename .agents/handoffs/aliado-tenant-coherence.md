# aliado-tenant-coherence — Coherencia de tenant en `clients.aliado_id` (SDD-0456 / migración 0450)

Fecha: 2026-09-11. Task ID: `aliado-tenant-coherence`. Estado de tarea: lista-para-revision. El Director la aprobó con un ajuste del orden de la baseline, ya aplicado. Sin publicar: espera el OK de Sam para push y PR draft. Estado SDD-0456: `done`, que no significa aplicada.
Owner / sesión escritora: `admiring-pascal-832793-fd-b54374` (sesión Claude `admiring-pascal-832793-fd`).
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/aliado-tenant-coherence`.
Rama: `codex/aliado-tenant-coherence`. Base al crear: `07d000970011ee12364e31124ebe4b301f064b40`. Actualizada con origin/main `6fdc00b4474e0a8835f118e405b809e4c907814f` en el merge `aa535e0b`; al cierre no hay commits nuevos en main.
Permisos del encargo: commits locales selectivos. Publicar la rama o abrir la PR draft requiere la autorización de Sam en esta sesión. Sin merge, sin producción, sin leer filas de negocio.

## Asignación (Director, sesión `dtdcargo-5f`)

- **SDD-0456.** El Director la reservó localmente en `codex/sdd-reserve-0456-aliado-tenant-coherence` (`efde2001`); se incorporó por cherry-pick (`a0800910`). Las 0454 y 0455 ya las habían tomado otras sesiones.
- **Migración 0450**, la siguiente libre según el inventario de 217 refs y worktrees, registrada a esta tarea. Sigue libre en origin/main `6fdc00b4`.
- **Base `main` (opción B).** La FK no se ata a la PR #82, que es migrate-first y espera el OK de Sam para 0401.
- **Sin cambios TS.** La FK garantiza la coherencia, y no se toca `lib/studio/aliados/brand-resolve.ts` para no chocar con #82.
- **Filtro explícito de `get_portal_brand()`:** queda en FUERA DE ALCANCE, como seguimiento para cuando 0401 esté en main.
- **Semántica de borrado:** la de la FK simple de 0362 (RESTRICT), con el caso «borrar un aliado con clientes» probado antes y después.

## OBJETIVO ORIGINAL

Impedir en la base que `clients.aliado_id` apunte a un aliado de otro tenant, sin romper datos existentes. La migración lleva un preflight que falla si ya hay filas incoherentes, sin DML silencioso. Se entregan además su contrato SQL en `supabase/tests/` y la espera en `supabase/migrations-baseline.json`. Pedido adicional del encargo: que la resolución de marca filtre también por tenant.

## COMPLETADO

- **`supabase/migrations/0450_clients_aliado_mismo_tenant.sql`, un único bloque `do` sin DML:**
  - `lock_timeout` 5 s y `statement_timeout` 60 s, locales a la transacción, como en la 0342 y la 0383;
  - locks antes del conteo y en orden fijo: `aliados` en ACCESS EXCLUSIVE y `clients` en SHARE ROW EXCLUSIVE. Entre el preflight y la FK no se cuela una fila incoherente, y `clients` sigue legible mientras se valida;
  - preflight: si hay clientes con aliado de otro tenant, falla con P0001 y un mensaje de solo conteo (`0450: N cliente(s) …`), sin ids ni Shipping Marks;
  - `unique (tenant_id, id)` en `aliados` (`aliados_tenant_id_id_key`) como destino, y FK compuesta `clients_aliado_mismo_tenant_fkey` `(tenant_id, aliado_id) → aliados (tenant_id, id)`, MATCH SIMPLE, ON UPDATE NO ACTION, ON DELETE RESTRICT;
  - idempotente sin drops: crea solo lo que falta, y un postflight exige la forma exacta, así que una constraint con el mismo nombre y otra forma hace fallar la migración;
  - la FK simple de 0362 se conserva, y los comentarios quedan en el catálogo.
- **`supabase/tests/0450_clients_aliado_mismo_tenant.test.sql`**, sobre las migraciones reales 0362 y 0450, con fixtures ficticios y rollback. Cubre:
  - RED con marca ajena;
  - estático: sin DML (con UPDATE reconocido por su `set`, MERGE, COPY y comentarios de bloque), y el orden `lock_timeout` → locks → preflight → primer DDL;
  - preflight: P0001 y solo conteo;
  - drift: una FK homónima con CASCADE hace fallar el postflight;
  - aplicar sobre datos coherentes sin cambiar filas y reaplicar con el catálogo idéntico;
  - forma exacta de la FK y supervivencia de la FK simple;
  - cada cruce frenado con `23503:clients_aliado_mismo_tenant_fkey`, y aceptación de los casos legítimos;
  - borrados iguales antes y después.
- **Baseline:** `pendingBelowCutoff` queda con el orden exacto de main y la espera `0450_clients_aliado_mismo_tenant` al final. Frente a origin/main solo cambian la coma de la última entrada de main y la línea nueva. El driver de merge había conservado el orden de la rama, igual que le pasó a L22, y el Director pidió corregirlo. Quedan 12 esperas y `cutoff: 238`.
- **Spec 0456:** contexto, alcance, diseño (FK, locks e idempotencia), semántica, allowlist y aceptación. Índice regenerado: 423 specs.
- **Resolución de marca por tenant:** con la FK, todo join por `aliado_id` queda dentro del tenant por construcción, incluidos `resolveBrandForClient` (admin y sesión) y la RPC 0401. La lectura con sesión del Studio ya filtraba por RLS (verificado abajo). El filtro explícito en SQL o TS no se implementó, por decisión del Director (ver FUERA DE ALCANCE).

## SEMÁNTICA (observada por el contrato en PostgreSQL 17.11)

| Caso | Antes de 0450 | Con 0450 |
|---|---|---|
| Cliente directo (`aliado_id` NULL) | se acepta | se acepta (MATCH SIMPLE) |
| Enlazar o dar de alta con un aliado del mismo tenant | se acepta | se acepta |
| Enlazar o dar de alta con un aliado de otro tenant | se acepta (el hueco) | 23503 `clients_aliado_mismo_tenant_fkey` |
| Mover de tenant a un cliente con aliado | se acepta | 23503 `clients_aliado_mismo_tenant_fkey` |
| Mover de tenant a un aliado con clientes | se acepta | 23503 `clients_aliado_mismo_tenant_fkey` |
| Borrar un aliado con clientes | 23503 | 23503 |
| Borrar un aliado sin clientes o un cliente de aliado | ok | ok |
| Borrar el tenant entero (fixture con la cascada de 0006; en producción la 0268 ya lo impide) | ok | ok |
| Cliente con `deleted_at` enlazado a otro tenant | se acepta | 23503 |

## EVIDENCIA EMPÍRICA — PostgREST 16.1

Imagen local `postgrest/postgrest:v16.1`, sin descargas (`--pull never`). Red y contenedores propios (`dtd_atc_net`, `dtd_atc_pgrst_db`, `dtd_atc_pgrst_rest`), retirados al final; no se tocó el stack `dtd-pr28-auth-*`. La 0450 final se aplicó con `psql -f` en autocommit, lo que ejercita el camino de una sola sentencia.

| Fase | `clients?select=…,aliados:aliado_id(…)` como service_role | Mismo embed como authenticated de T1 | `aliados?select=prefix,clients:client_id(markbox)` | PATCH cruzado como service_role |
|---|---|---|---|---|
| Sin 0450, con un cliente de T1 enlazado a DC de T2 | 200: el cliente de T1 recibe «Marca DC» (el hueco del camino admin) | 200: `aliados: null` para ese cliente (la RLS `aliados by tenant` ya filtra la sesión) | 200 | — |
| Con 0450 | 200: embed intacto (HR-0001 → «Marca HR») | 200 | 200 | 409 · 23503 `clients_aliado_mismo_tenant_fkey` |
| Contraprueba: con 0450 y sin la FK simple | 400 · PGRST200 | 400 · PGRST200 | 200 | 409 · 23503 |

La contraprueba confirma que la FK simple de 0362 debe conservarse: sin ella se rompe el embed de `brand-resolve.ts:41` y `app/studio/(app)/etiquetas/page.tsx:82`, y la marca cae a DTD. La versión de PostgREST de producción no se verificó (ver PENDIENTES).

Camino Studio de alta (`app/studio/(app)/clientes/actions.ts:135-146`): lee el aliado con la sesión (RLS), así que un aliado ajeno ya daba «Ese aliado no existe o no está disponible.». Lo que 0450 cierra son los caminos sin esa lectura previa: service_role, o un PATCH directo a PostgREST con la sesión, que la RLS de `clients` no frena porque solo mira el tenant de la fila.

## REVISIÓN INDEPENDIENTE (subagente de solo lectura sobre `cee03d1c`)

Veredicto: CHANGES_REQUESTED, sin bloqueantes en el SQL. Atendido así:

- **Cierre incompleto:** este documento y el verify final sobre el SHA entregado.
- **Rama detrás de main**, con conflictos en la baseline y el índice que GitHub no resuelve: merge de origin/main `6fdc00b4` (`aa535e0b`) con el driver, índice regenerado y revalidación completa.
- **Locks sin `lock_timeout`**, con `drop constraint` en ACCESS EXCLUSIVE sobre `clients` y una carrera entre el preflight y la FK: un solo `do`, `lock_timeout`, locks antes del conteo y sin drops (`bcb2e69e`).
- **Dos aserciones tautológicas**, deshechas por la subtransacción: se retiraron. Las reemplazan el chequeo estático de orden y el caso de drift, que sí pueden fallar. La spec aclara que la atomicidad la da la transacción, no el contrato.
- **Fila del tenant en la spec:** acotada al fixture, con la nota de la 0268.
- **Nits:**
  - resueltos: regex de DML ampliado (COPY, MERGE, comentarios de bloque); constraint fijada en los 23503; idempotencia sin drops; conteo de mutaciones corregido (16); `related` sin 0336.
  - quedan como observación: los recibos, fuera de Git en un directorio temporal, y el mensaje crudo de `actions.ts:224` (FUERA DE ALCANCE).

## VALIDACIÓN

Sin credenciales copiadas ni `.env`. Entorno: Node 24.20.0, pnpm 12.3.4, Docker 29.7.2, PostgreSQL 17.11 y PostgREST 16.1. Los recibos quedan fuera de Git (temporales, no durables), en `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-admiring-pascal-832793\5f56cf33-2bb6-4c84-8ccd-9516a2b17226\scratchpad\aliado-tenant-coherence\`.

Sobre el árbol final (`bcb2e69e`, con origin/main `6fdc00b4` mergeado):

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio y antes de cada commit y del merge. |
| `corepack pnpm install --frozen-lockfile` | PASÓ (39,3 s, lockfile intacto; `install.log`). |
| Contrato 0450 focal (contenedor propio `dtd_atc_sql_focal`) | PASÓ, exit 0 (`sql-0450-focal-v2.log`); borrados iguales antes y después. Contenedor retirado. |
| Mutaciones (`mutate.mjs`, contenedor `dtd_atc_mut`) | PASÓ: el original sale en verde y las 16 mutaciones en rojo, por la capa esperada (`mutations-v2.log`): estático (sin preflight, sin locks, sin `lock_timeout`, DDL antes del preflight, 3 variantes con DML); preflight (ids en el mensaje, preflight anulado); postflight y drift (sin FK compuesta, SET NULL, CASCADE, postflight ciego); catálogo (reemplazo de la FK simple, SET NULL sin postflight); validación de la FK (MATCH FULL). |
| `node scripts/run-sql-tests.mjs` | PASÓ: 170 contratos, incluidos 0362, 0424, 0432, 0433 y 0450 (`sql-tests-v2.log`). |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario de 428; 410 desde cero y 18 solo-ledger sin cambio de schema; aislamiento multi-tenant sobre 219 tablas y 2 tenants (`schema-rebuild-v2.log`). |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO (`pending-symbols-v2.log`). |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; conserva los choques históricos declarados (`sdd-check-v2.log`). |
| `corepack pnpm docs:index` / `docs:check` | PASÓ: 423 specs sincronizadas. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| PostgREST 16.1 efímero | PASÓ: tabla de arriba (`pgrst-check-v2.log`, `pgrst-*.json`). |
| `git diff --check` y allowlist | PASÓ. Frente a origin/main quedan 6 archivos, todos dentro de la allowlist. |
| `corepack pnpm verify` | **FALLÓ, exit 1**, sobre `bcb2e69e`, de 08:51:41 a 09:28:23 (−04:00). El vigilante dio FIN, no COLGADO: no hizo falta `taskkill` (`verify-v2.log`, `verify-v2.meta.json`). De 18 pasos, 16 PASARON: harness, lint (0 errores y 8 warnings en archivos intactos), rsc-boundary (1597 módulos), typecheck, edge-functions (4), test (6709 tests en 527 archivos), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0/0), sql-tests, schema-rebuild y build. `migrations-applied` quedó en SKIP por falta de credenciales: NO EJECUTADO. e2e FALLÓ por entorno: en las dos pasadas (6,5 min y 15,1 min) pasaron 153, se omitieron 18 y fallaron los mismos 15: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, porque el WebServer revienta en `proxy.ts:67` sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`. Es el patrón que ya registraron sobre main L01, L16, L18 y L19, y el diff no toca TS. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde. |
| E2E autenticado, `migrations-applied` (ledger real), producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |
| `/ui-check` | NO EJECUTADO: no hay cambio visual. |

Cambios posteriores al verify, solo de documentación y texto:
- el aviso de impacto de los locks en la espera 0450 de la baseline, que pidió el Director;
- el orden de `pendingBelowCutoff`, igual al de main, con la 0450 al final (ajuste de la revisión del Director; los textos de las entradas no cambian);
- la aceptación y el estado `done` de la spec 0456, más el índice regenerado;
- este handoff.

Sobre el árbol final se revalidaron el JSON de la baseline, `check-pending-migration-symbols` (0/0), `sdd:check`, `docs:index`/`docs:check` y `git diff --check`. La migración, el contrato y el código no cambiaron después del verify.

Corrida superada: `pnpm verify` sobre `cee03d1c` (antes de la revisión y del merge; `verify.log`). Quince pasos salieron OK o SKIP: harness, lint, rsc-boundary, typecheck, edge-functions, test (6684 tests), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests y schema-rebuild; `migrations-applied` quedó en SKIP. En e2e fallaban los mismos 15 casos de entorno sin Supabase (`proxy.ts:67`). La detuve yo durante e2e (`taskkill /T` sobre mi propio vigilante, PID 33232) porque los cambios de la revisión la dejaban superada. No es evidencia del SHA entregado.

## REVISIÓN FOCAL DE DATOS (`revisar-datos-ve`)

Resumen: 3 CORRECTO · 0 ENCONTRADO nuevo · 2 NO VERIFICABLE. El cambio no captura, mueve ni borra datos personales: agrega una restricción de integridad y un preflight de solo conteo.

- **CORRECTO — seguridad y confidencialidad.** La base deja de aceptar el vínculo que hacía que un documento de un cliente de T1 mostrara el nombre comercial y el contacto de soporte del aliado de T2 (`support_email`, `support_whatsapp`, `support_website`, 0362:82-84). Esos datos pueden identificar a una persona natural si el aliado es unipersonal (punto 12, `checklist-datos-ve.md:400`). Evidencia: la FK de 0450, los 23503 del contrato y el PATCH 409 en PostgREST. Norma: SC 332/2001, seguridad y confidencialidad (`marco-legal-ve.md:77`).
- **CORRECTO — minimización del preflight.** El mensaje lleva solo el conteo; la mutación que añade ids al `detail` hace fallar el contrato. Como los locks se toman antes del conteo, tampoco queda la vía del 23503 crudo con uuids en el DETAIL por una carrera. Norma: SC 332/2001, finalidad y calidad (`marco-legal-ve.md:74`); PIPL, mínimo alcance, como referencia (`marco-legal-cn-pipl.md:47`).
- **CORRECTO — sin DML silencioso.** El chequeo estático y las mutaciones confirman que no hay DML, y aplicar 0450 no cambia ninguna fila (snapshot antes y después). La decisión sobre filas incoherentes queda en manos humanas.
- **NO VERIFICABLE:** si hoy existen en producción clientes enlazados a un aliado de otro tenant (no se leyó producción; el conteo agregado requiere autorización de Sam), y si los contactos de soporte de los aliados reales son de personas naturales.

No se ejecutó verificación contra datos reales. Esta revisión no es asesoría legal.

## GOBERNANZA

- **`cumplimiento`:** aislamiento multi-tenant exigido en la base por constraint para `clients.aliado_id`. Migración con preflight fail-closed, sin DML, con `lock_timeout` y locks explícitos (runbook de migraciones; lección 0238: sin backfill inventado).
- **`no aplica`:** DAT-01 (fecha), ERR-01 y el resto de políticas de UI. No hay cambio visual, de copy ni de componentes, y el alta del Studio conserva su mensaje actual para aliados no visibles (`actions.ts:146`).
- **`excepción`:** el pedido de que la resolución de marca filtre también por tenant se cumple por construcción (FK), no con un filtro explícito en `get_portal_brand()` ni en TS. Lo decidió el Director; el seguimiento está abajo.
- **`no conformidad`:** ninguna nueva. La preexistente de 0362 queda corregida localmente; en producción sigue NO VERIFICABLE hasta aplicar.

## COMMITS

- `a0800910` — chore(sdd): reserva SDD-0456 (cherry-pick de `efde2001`, del Director).
- `fdb9a088` — fix(studio): SDD-0456: migración 0450, contrato, baseline, spec e índice.
- `cee03d1c` — docs(handoff): handoff en progreso.
- `aa535e0b` — merge de origin/main `6fdc00b4` (PR #70, #72, #73, #74 y #81), baseline e índice unidos por el driver.
- `bcb2e69e` — fix(studio): SDD-0456: 0450 en una sola sentencia con locks, `lock_timeout` y postflight, más el contrato y la spec según la revisión.
- `d357284f` — fix(studio): SDD-0456 cierre: aviso de impacto de locks en la espera 0450, aceptación y estado `done` de la spec 0456, e índice.
- `8570f713` — docs(handoff): primer cierre de este documento.
- fix(studio): SDD-0456 — baseline con el orden exacto de main y la 0450 al final (ajuste de la revisión del Director); es el commit inmediatamente anterior a este documento.
- Commit que contiene este documento: handoff con ese ajuste (hashes finales en la PR).

## PR / BRANCH

Sin publicar. Rama local `codex/aliado-tenant-coherence` (base `main`, al día con `6fdc00b4`), en el worktree indicado arriba. Falta la autorización de Sam para publicar la rama y abrir la PR draft contra `main`.

## PENDIENTES DE ESTA TAREA

- Autorización de Sam para `git push -u origin codex/aliado-tenant-coherence:codex/aliado-tenant-coherence` y para la PR draft.
- Revisión del Director y CI alojado sobre el SHA publicado.
- Antes de aplicar 0450 (tarea aparte, con OK nominal de Sam y runbook): un conteo agregado de solo lectura, con su autorización: `select count(*) from public.clients c join public.aliados a on a.id = c.aliado_id where a.tenant_id <> c.tenant_id;`. Si da > 0, se decide fila por fila; el preflight falla cerrado igualmente.
- **Impacto esperado al aplicar.** Mientras corre la migración:
  - `aliados` queda en ACCESS EXCLUSIVE, así que las lecturas de marca del Portal y del Studio, y los listados de aliados, esperan.
  - `clients` queda en SHARE ROW EXCLUSIVE: se puede leer, pero las altas y ediciones de clientes esperan.
  - La corrida en sí dura poco: un conteo, un índice único sobre la tabla chica `aliados` y la validación de la FK sobre `clients`. `statement_timeout` la limita a 60 s.
  - El `lock_timeout` de 5 s acota la espera por los locks. Mientras la migración espera, las lecturas nuevas de `aliados` hacen cola detrás de ella.
  - Conviene aplicarla en horario de baja actividad. El mismo aviso va en la espera del baseline, que el gate imprime antes de aplicar.
- Después de aplicar: un smoke del embed de marca en producción (etiquetas del Studio o comprobante de un cliente de aliado), porque la versión de PostgREST de producción no se verificó.
- E2E autenticado y ledger real quedan sin validar; no autorizan copiar credenciales ni aplicar migraciones.

## FUERA DE ALCANCE DETECTADO

- **Filtro explícito en `get_portal_brand()` (0401, PR #82, líneas 41-42).** Seguimiento acordado con el Director: cuando 0401 esté en main, una migración posterior la redefine con `and a.tenant_id = c.tenant_id`, sin modificar 0401. Con 0450 aplicada, el join ya es coherente por construcción.
- **`aliados.parent_aliado_id` no exige el mismo tenant** (FK simple, 0362:69). Un sub-aliado puede colgar de un aliado de otro tenant. Entonces `aliado_prefix_chain` (0362:159-179) compondría una insignia con prefijos de dos tenants, y `resolve_price_book` (0382:292-328) sube por esa cadena y toma la lista del raíz sin filtrar `pb.tenant_id` en la rama del aliado: el cliente se cotizaría con la lista de otro tenant. Arreglo concreto: FK compuesta `aliados (tenant_id, parent_aliado_id) → aliados (tenant_id, id)` que reutilice `aliados_tenant_id_id_key`, con su propio preflight de conteo.
- **`aliados.client_id` no exige el mismo tenant** (FK simple, 0362:66). `convertirEnAliadoAction` (`app/studio/(app)/clientes/actions.ts:880-888`) inserta el `clientId` del formulario, y la RLS de `aliados` solo mira `aliados.tenant_id`. Arreglo concreto: `unique (tenant_id, id)` en `clients` y FK compuesta `aliados (tenant_id, client_id) → clients (tenant_id, id)`, con preflight de conteo; o validar el cliente con la sesión en la acción.
- **Mover de tenant un aliado sin clientes pero con lista de precios** deja la lista en el tenant viejo: `price_books_guard_aliado` (0382:130-168) solo se dispara desde `price_books`. Menor; se resuelve junto con el punto anterior o prohibiendo cambiar `aliados.tenant_id`.
- **`createClientAction` (`actions.ts:224`)** devolvería el mensaje crudo de la constraint si la FK nueva diera 23503. Solo pasaría en una carrera, porque el alta lee el aliado con RLS antes de insertar. El arreglo, sin cambiar la regla, es traducir el 23503 de `clients_aliado_mismo_tenant_fkey` como el 23505 de al lado.

## HANDOFF AL DIRECTOR

- 0450 es independiente de #82 y aditiva: no reescribe funciones ni filas. Orden seguro:
  1. revisar;
  2. publicar con OK de Sam;
  3. fusionar;
  4. aplicar 0450 en otra tarea: conteo agregado autorizado, de a una, name exacto, en horario de baja actividad por los locks;
  5. smoke del embed;
  6. retirar la espera del baseline.
- No crea funciones, así que el punto ciego del gate de símbolos con bloques `do` (hallazgo de L17) no la afecta, y no requiere declaración. Confirmado por el Director.
- Posibles conflictos con otros lotes, por unión con el driver `dtd-generated-records`: `supabase/migrations-baseline.json` y `docs/specs/README.md`. En GitHub no corre el driver: si main avanza antes de fusionar, hay que repetir el merge en la rama. Después de ese merge, revisar que `pendingBelowCutoff` conserve el orden de main, porque el driver conserva el orden de la rama. `git diff origin/main -- supabase/migrations-baseline.json` debe mostrar solo la coma y la línea de la 0450. `brand-resolve.ts` no se tocó.
- Sin subagentes escritores. El único subagente fue un revisor de solo lectura. Retiré mis contenedores (`dtd_atc_*`); los `dtd_rebuild_*` y `dtd_sqltest_*` los retiran sus propios scripts. No se tocaron procesos ni contenedores de otras sesiones.
- Ownership: se libera al cierre con `node scripts/harness-worktree.mjs release --owner admiring-pascal-832793-fd-b54374`, después de la última escritura. Se conservan el worktree y la rama.
