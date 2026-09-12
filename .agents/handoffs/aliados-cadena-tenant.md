# aliados-cadena-tenant — La cadena de aliados no cruza tenants (SDD-0461 / migración 0451)

Fecha: 2026-09-12. Task ID: `aliados-cadena-tenant`. Estado de tarea: lista-para-revision, publicada como PR en borrador. Estado SDD-0461: `done`, que no significa aplicada.
Owner / sesión escritora: `aliados-cadena-tenant-20260912`, un subagente Worker lanzado por el Director. No hubo subagentes escritores propios.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`, sin ninguna escritura en el checkout principal.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/aliados-cadena-tenant`.
Rama: `codex/aliados-cadena-tenant`. Base: `main` `004b38f5`, y la reserva del Director es `85486484`. La rama se actualizó con origin/main `42c8839e` (PR #102, solo handoffs) por el merge `80b72653`, sin rebase.
SDD: `docs/specs/0461-aliados-cadena-tenant/spec.md`, reservada por el Director y completada acá. Migración asignada: 0451.

Permisos del encargo:
- **Autorizado:** commits locales selectivos, y publicar la rama y abrir la PR en borrador contra `main` (OK de Sam).
- **Prohibido:**
  - merge, sacar la PR de borrador y deploy;
  - aplicar migraciones y tocar el ruleset;
  - borrar ramas o worktrees;
  - leer filas de negocio o PII;
  - escribir en el checkout principal;
  - tocar las migraciones 0362, 0382, 0401 y 0450, el Portal y la baseline.

Aceptación del encargo, en seis puntos:
1. FK compuesta del padre que reutiliza `aliados_tenant_id_id_key`, con un preflight que falla cerrado.
2. `unique (tenant_id, id)` en `clients` y FK compuesta del cliente-ancla, con su preflight.
3. `get_portal_brand()` con `and a.tenant_id = c.tenant_id` en la migración nueva, sin tocar la 0401.
4. `createClientAction` traduce el 23503 como el 23505 vecino.
5. Pruebas SQL de rechazo y aceptación para las dos FK.
6. Cero cambios de comportamiento fuera de lo anterior, sin debilitar pruebas.

Dependencias: la 0450 y la 0401 ya están aplicadas en producción, y `pendingBelowCutoff` está vacío en main.
Interrupción: un corte de red (ENOTFOUND) detuvo la sesión mientras corría el contrato SQL. Al retomar se comprobó el árbol real antes de repetir nada: HEAD `85486484`, los dos borradores sin commitear, la corrección del caso SH ya aplicada y el guard OK.

## OBJETIVO ORIGINAL

Que la cadena de aliados no pueda cruzar tenants, de modo que ningún cliente se cotice con la lista de precios de otro tenant ni cuelgue de un aliado ajeno. Además, que la RPC de marca del Portal filtre el tenant por su cuenta, y que el alta de clientes no muestre el 23503 crudo de la FK de tenant.

## COMPLETADO

- **`supabase/migrations/0451_aliados_cadena_mismo_tenant.sql`**, un bloque `do` sin DML:
  - `lock_timeout` de 5 s y `statement_timeout` de 60 s, locales a la transacción;
  - locks antes del conteo, en el mismo orden que la 0450: `aliados` y después `clients`, las dos en ACCESS EXCLUSIVE (`clients` sube frente a la 0450 porque recibe una constraint única);
  - dos preflights de solo conteo, uno por FK (`0451: N aliado(s) cuelgan de un aliado de otro tenant…` y `…de un cliente de otro tenant…`), con P0001 y sin ids;
  - `clients_tenant_id_id_key unique (tenant_id, id)`: se verificó en el árbol que la 0450 solo había creado `aliados_tenant_id_id_key`;
  - `aliados_parent_mismo_tenant_fkey` `(tenant_id, parent_aliado_id) → aliados (tenant_id, id)`, que reutiliza `aliados_tenant_id_id_key` (la 0451 solo lo crea si faltara);
  - `aliados_client_mismo_tenant_fkey` `(tenant_id, client_id) → clients (tenant_id, id)`;
  - las dos FK en MATCH SIMPLE, ON DELETE RESTRICT y ON UPDATE NO ACTION, como las simples de la 0362, que se conservan;
  - idempotente sin drops, con postflight de forma exacta para las tres constraints;
  - comentarios SDD-0461 en las tres. El de `aliados_tenant_id_id_key` (SDD-0456) no se toca.
- **`get_portal_brand()` redefinida en la 0451**, con `create or replace` y su propio postflight.
  - El cuerpo difiere del de la 0401 en exactamente una línea, `and a.tenant_id = c.tenant_id`. Lo comprobó el Director a mano y `diff` lo confirma.
  - Los revoke y grant son idénticos a 0401:52-55 (`diff` exit 0).
  - El contrato exige además que el `pg_get_functiondef` completo, sin esa línea, sea el de la 0401 y que el ACL sea el mismo.
- **`app/studio/(app)/clientes/actions.ts`**, solo en el sitio de la línea 224 de `createClientAction`: si el 23503 trae `clients_aliado_mismo_tenant_fkey`, responde «Ese aliado no existe o no está disponible.», que es el mismo mensaje de la lectura previa del aliado (`actions.ts:145`).
  - Cualquier otro 23503 sigue con el mensaje genérico.
  - Solo esa FK puede disparar en ese insert: las dos de la 0451 viven en `aliados`.
  - PostgREST 16.1 confirmó que el nombre de la constraint viaja en `message`.
- **`supabase/tests/0451_aliados_cadena_mismo_tenant.test.sql`**, sobre las migraciones reales 0362, 0382, 0401, 0450 y 0451, con fixtures ficticios y rollback. Cubre:
  - RED, sin 0451:
    - AG de T1 bajo DC de T2 da la insignia `DC-AG` y `resolve_price_book` devuelve la «Lista de Dynasty Cargo» de T2 para un cliente de T1;
    - un aliado de T1 acepta un ancla de T2;
    - con la FK de la 0450 soltada, la RPC entrega «Marca DC» a un cliente de T1.
  - Estático:
    - sin DML (UPDATE reconocido por su `set`, INSERT, DELETE, MERGE, TRUNCATE y COPY);
    - orden `lock_timeout` → lock `aliados` → lock `clients` → preflight del padre → preflight del ancla → primer DDL;
    - el orden de locks de la 0450 sigue siendo el mismo;
    - la 0401 no contiene el filtro.
  - Preflights: P0001 con «2 aliado(s)…» y «1 aliado(s)…», sin uuid ni Shipping Mark en el mensaje, el detail ni el hint.
  - Drift de las tres constraints: padre y ancla con CASCADE, y destino con las columnas invertidas. Las tres hacen fallar el postflight.
  - Aplicar y reaplicar: filas idénticas (clients, aliados y price_books), y catálogo y `pg_get_functiondef` idénticos.
  - Catálogo:
    - forma exacta de las dos FK y del destino, más sus comentarios;
    - las FK simples de la 0362 siguen vivas;
    - exactamente dos FK de `aliados` hacia `clients` y dos hacia sí misma.
  - Comportamiento, cada cruce con `23503:<constraint>` exacta:
    - alta y edición;
    - `deleted_at`;
    - mover el sub-aliado, el padre, el aliado y el cliente-ancla.
    - Para aislar la FK que se mide, el aliado que se mueve arrastra su ancla en la misma sentencia con un CTE. Sin eso, Postgres reporta la primera FK que dispara: el primer intento con SH marcó otra FK, y el caso se rediseñó.
    - Lo legítimo se acepta: sub-aliado del mismo tenant, vuelta a raíz y ancla del mismo tenant.
  - RPC: tiene el filtro, coincide con la 0401 salvo esa línea y su ACL, solo authenticated ejecuta, devuelve cero filas ante un vínculo cruzado y conserva la marca propia.
  - `resolve_price_book` intacto para la cadena legítima, el raíz sin lista, el directo y el cliente de DC.
  - Borrados iguales antes y después: `{"tenant_entero":"ok","aliado_sin_nada":"ok","cliente_de_aliado":"ok","aliado_con_subaliado":"23503","cliente_ancla_de_aliado":"23503"}`.
- **Spec 0461** completa: contexto, alcance, diseño, semántica, impacto de locks, allowlist, aceptación y producción. Índice regenerado con 439 specs.

## EVIDENCIA EMPÍRICA — PostgREST 16.1

Imagen local `postgrest/postgrest:v16.1` (`Server: postgrest/16.1`) sobre PostgreSQL 17.11, sin descargas (`--pull never`).
- Red y contenedores propios, retirados al final: `dtd_act_net`, `dtd_act_pgrst_db` y `dtd_act_pgrst_rest`.
- El fixture es el del contrato, más RLS y grants de los stubs, y `service_role` con BYPASSRLS.
- Las escrituras se hicieron con `Prefer: tx=rollback`, y la 0451 se aplicó con `psql -f` en autocommit.
- La sesión es un usuario de T1; el Portal, el cliente de HR.

| Llamada (select exacto del código o escritura) | Sin 0451 | Con 0451 |
|---|---|---|
| `listAliadoOptions` (`aliado-queries.ts:41`) `aliados?select=…,clients:client_id(markbox)`, sesión / service_role | 200 (4 / 5 filas) | 200, JSON idéntico |
| `resolveBrandForClient` (`brand-resolve.ts:41`) `clients?select=aliado_id,aliados:aliado_id(…)` | 200 | 200, idéntico |
| etiquetas (`etiquetas/page.tsx:82`) `clients?select=markbox,name,aliado_id,aliados:aliado_id(…)` | 200 (8 / 11) | 200, idéntico |
| `listPriceBooks` (`price-book-queries.ts:38`), embed sin pista `aliados(prefix),rates(count)` | 200 (2 / 4) | 200, idéntico |
| PATCH del padre cruzado (AG de T1 → DC de T2), sesión y service_role | 200 (el hueco) | 409 · 23503 `aliados_parent_mismo_tenant_fkey` |
| POST de un aliado de T1 con ancla de T2, sesión y service_role | 201 (el hueco) | 409 · 23503 `aliados_client_mismo_tenant_fkey` |
| POST de un cliente de T1 con aliado de T2 (service_role) | 409 · 23503, `message` con `clients_aliado_mismo_tenant_fkey` | igual |
| PATCH del padre y POST del ancla del mismo tenant (sesión) | 200 / 201 | 200 / 201 |
| RPC `get_portal_brand`: Portal HR / anon / service_role | 200 / 401 / 403 (42501) | igual |
| Contraprueba: con 0451 y sin `aliados_client_id_fkey` | — | 400 · PGRST200 en `listAliadoOptions` |

El hueco también estaba abierto por la sesión del Studio, no solo por service_role: la RLS de `aliados` solo mira `aliados.tenant_id`. La versión de PostgREST de producción no se verificó.

## MUTACIONES

`mut/run-mutants.mjs` corrió en su contenedor propio `dtd_act_mut`, ya retirado, sobre una copia de los archivos. El contrato original salió verde antes y después de la serie, y las 28 mutaciones se reparten así:

- **Estático (7):**
  - sin `lock_timeout`;
  - sin lock de `clients`;
  - `clients` en SHARE ROW EXCLUSIVE;
  - locks en orden inverso;
  - DDL antes del preflight;
  - `update … where false`;
  - `insert … where false`.
- **Preflight (5):**
  - sin preflight del padre;
  - sin preflight del ancla;
  - umbral que lo anula;
  - conteo de lo coherente;
  - ids en el mensaje.
- **FK (6):**
  - sin la FK del padre;
  - sin la FK del ancla;
  - padre con CASCADE;
  - padre con MATCH FULL;
  - ancla con NO ACTION;
  - reemplazo de la FK simple.
  - Las variantes que neutralizan su postflight las detecta primero la capa de drift.
- **Postflight ciego (3):** del destino, del padre y del ancla.
- **Comentario (1):** el destino sin la marca SDD-0461.
- **RPC (5):**
  - sin filtro;
  - sin SECURITY DEFINER;
  - `search_path = public`;
  - ejecutable por anon;
  - filtro contra el tenant equivocado.
- **Equivalente esperado (1):** sin los revoke y grant repetidos, sobrevive, porque `create or replace` conserva el ACL de la 0401. Los grants se repiten igual, para que el estado final no dependa del previo.

Resultado: los 27 mutantes quedaron en rojo, el equivalente sobrevivió y hubo 0 filas fallidas.

## IMPACTO ESPERADO AL APLICAR (locks)

- `aliados` y `clients` quedan en ACCESS EXCLUSIVE durante la corrida, un nivel más que en la 0450 para `clients`.
- Esperan las lecturas y escrituras de las dos tablas:
  - del Studio: clientes, aliados, etiquetas y listas;
  - del Portal: la marca, y los datos del cliente vía `client_users → clients`.
- La corrida es corta: dos conteos, el índice único sobre `clients` (unos cientos de filas) y la validación de dos FK sobre las 3 filas de `aliados` (conteo del Director). `statement_timeout` la limita a 60 s.
- `lock_timeout` de 5 s: si otra transacción retiene una de las tablas, falla rápido. Mientras espera, las consultas nuevas a esas tablas hacen cola detrás de ella, hasta 5 s.
- Aplicarla en horario de baja actividad. El aviso no está en la baseline porque el encargo la excluyó.

## VALIDACIÓN

Sin credenciales copiadas ni `.env`. Entorno: Node 24.20.0, pnpm 12.3.4, Docker 29.7.2, PostgreSQL 17.11 y PostgREST 16.1. Los recibos quedan fuera de Git, en temporales no durables: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\a4705ad7-612e-488b-9826-2cd036e3da72\scratchpad\aliados-cadena-tenant\`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | PASÓ al inicio, al retomar y antes de cada commit y del merge. |
| `corepack pnpm install --frozen-lockfile` | PASÓ (19,9 s; `install.log`). |
| Contrato 0451 focal (`dtd_act_sql_focal`, retirado) | PASÓ, exit 0, sobre la versión final (`sql-0451-focal-v3.log`). La v1 falló por el diseño del caso SH (ver COMPLETADO); la v2 pasó antes de endurecer drift y RPC. |
| Mutaciones (`mut/mutants.log`, `mutants-results.json`) | PASÓ: 27 rojos, 1 equivalente y los dos controles verdes. |
| PostgREST 16.1 efímero (`pgrst/run.log`, `pgrst-results.json`) | PASÓ: tabla de arriba. La primera corrida abortó por un error de tipos en la consulta de catálogo del corredor, antes de la fase A; se corrigió y se repitió completa. |
| Residual tras 0451 (`residual/residual.log`) | Ejecutado como evidencia de FUERA DE ALCANCE (ver abajo). |
| Prueba temporal TS del 23503 (`vitest-scratch-23503.log`) | PASÓ 4/4: FK de tenant → mensaje de la lectura previa; otro 23503 → genérico; nombre con otro código → genérico; 23505 sin cambio. El archivo se creó y se borró fuera del diff. |
| RPC contra la 0401 | PASÓ: `diff` del cuerpo = una línea; `diff` de revoke/grant = exit 0. |
| `docs:index` / `docs:check` / `sdd:check` / `install-merge-drivers --check` | PASÓ: 439 specs, sin números repetidos, driver verificado. `docs:check` ya fallaba en `85486484` (ver FUERA DE ALCANCE). |
| `git diff --check` y allowlist | PASÓ en cada commit. Frente a origin/main `42c8839e` cambian solo los 6 archivos de la allowlist, este handoff incluido. |
| `corepack pnpm verify` | **FALLÓ, exit 1**, sobre `80b72653` (árbol final con origin/main `42c8839e` mergeado), de 15:51:51 a 16:11:43 (−04:00), sin cuelgue (`verify-v1.log`, `verify-v1.meta`). De 17 pasos, 15 PASARON: harness; lint (0 errores y 8 warnings, todos en `NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx` y `KommoClient.tsx`, que no se tocaron); rsc-boundary (1599 módulos); typecheck; edge-functions (4); test (6809 pruebas en 543 archivos); docs:check; numbering; feature-constants (5); components:check; governance:check; pending-migration-symbols (0 ROJO · 0 AMARILLO); sql-tests (180 contratos, incluidos 0362, 0382, 0401, 0450 y 0451); schema-rebuild (419 migraciones desde cero, aislamiento multi-tenant sobre 219 tablas y 2 tenants); y build. `migrations-applied` quedó en SKIP sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`: NO EJECUTADO. `e2e` FALLÓ por entorno en sus dos pasadas: la primera en 5,4 min (152 pasados, 18 omitidos y 1 flaky, `auth.spec.ts:74` de chromium, «un token inválido renderiza el mismo error las dos veces», que pasó al reintentar) y la segunda en 5,0 min (153 pasados, 18 omitidos). Fallaron los mismos 15 escenarios en las dos: `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, porque el WebServer revienta en `proxy.ts:67` sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` (198 trazas). Es el patrón conocido que anticipó el encargo, y el diff no toca rutas ni auth. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se presenta como verde. Después de verify solo cambió documentación: el estado y la aceptación de la spec, la referencia 880-888 calificada como de main, el índice y este handoff. Se revalidaron `docs:index`/`docs:check`, `sdd:check` y `git diff --check`. |
| E2E autenticado, `migrations-applied` (ledger real), producción | NO DISPONIBLE / NO EJECUTADO: sin credenciales y fuera de la autorización. |
| `_norte/backend/README.md` (lectura previa exigida por AGENTS.md) | NO DISPONIBLE: no existe ni en el worktree ni en el checkout principal. Se leyeron AGENT-BRIEF, ERR-01, las migraciones y el handoff de la 0450. |
| `/ui-check` | NO EJECUTADO: no hay cambio visual. |

## REVISIÓN FOCAL DE DATOS Y GOBERNANZA

- **Datos (`revisar-datos-ve`): no aplica.** No se captura, mueve ni borra ningún dato personal: son constraints de integridad y un filtro de lectura. Los preflights reportan solo conteos, y la mutación que agrega ids al mensaje hace fallar el contrato. La base deja de aceptar el vínculo por el que un cliente de T1 podía recibir la marca y el contacto de soporte de un aliado de T2.
- **Aislamiento multi-tenant: no conformidad corregida** localmente y verificada en Postgres y PostgREST efímeros. En producción sigue NO VERIFICABLE hasta aplicar.
- **ERR-01: cumplimiento.** El 23503 del alta se traduce a un copy seguro que ya existía, sin SQL ni nombre de constraint. El resto de las reglas de UI no aplica: no hay cambio visual.
- **Excepción:** ninguna. **No conformidad nueva:** ninguna.

## COMMITS

- `85486484` — chore(sdd): reserva SDD-0461 (Director).
- `c620d249` — fix(studio): SDD-0461 — migración 0451 y su contrato SQL.
- `715de761` — fix(studio): SDD-0461 — `createClientAction` traduce el 23503 de la FK de tenant.
- `d058efad` — docs(sdd): SDD-0461 — spec e índice.
- `80b72653` — merge de origin/main `42c8839e` (PR #102, solo handoffs).
- Commit que contiene este documento: el handoff y el cierre de la spec (hash final en la PR).

## PR / BRANCH

- **PR:** en borrador contra `main`. Se abrió inmediatamente después de publicar el commit que contiene este documento, y su URL está en la PR y en el reporte al Director.
- **Rama:** `codex/aliados-cadena-tenant`, publicada a sí misma con `git push -u origin codex/aliados-cadena-tenant:codex/aliados-cadena-tenant`, sin force.
- Worktree el indicado arriba. Sin merge, sin salir de borrador y sin aplicar migraciones.

## PENDIENTES DE ESTA TAREA

- **CI y revisión:** CI alojado sobre el SHA publicado y revisión del Director. Sacar la PR de borrador y fusionar le corresponde al Director.
- **Prueba TS versionada del 23503:** la allowlist del encargo no incluye pruebas TS, así que la verificación se hizo con una prueba temporal fuera del diff. Si el Director amplía la allowlist a `app/studio/(app)/clientes/__tests__/alta-bajo-aliado.test.ts`, este bloque va dentro de `describe("createClientAction · el 23505 deja de mentir")`:

  ```ts
  it("el 23503 de la FK de tenant (migr 0450) responde como la lectura previa del aliado", async () => {
    clientsWriteError = {
      code: "23503",
      message: 'insert or update on table "clients" violates foreign key constraint "clients_aliado_mismo_tenant_fkey"',
    };
    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));
    expect(res.error).toBe("Ese aliado no existe o no está disponible.");
  });

  it("otro 23503 conserva el mensaje genérico", async () => {
    clientsWriteError = {
      code: "23503",
      message: 'insert or update on table "clients" violates foreign key constraint "clients_aliado_id_fkey"',
    };
    const res = await createClientAction({}, clientForm({ aliadoId: "aliado-hr" }));
    expect(res.error).toMatch(/^No se pudo crear el cliente: /);
  });
  ```

- **Baseline:** la excluyó el encargo. Antes o al fusionar, el Director decide si aplica la 0451 o si declara su espera en `supabase/migrations-baseline.json`, con el aviso de locks de arriba. Con credenciales, `migrations-applied` la marcará faltante.
- **Antes de aplicar**, en una tarea aparte con el OK nominal de Sam y el runbook: repetir el conteo agregado de solo lectura justo antes. El preflight falla cerrado igual.
  - `select count(*) from public.aliados h join public.aliados p on p.id = h.parent_aliado_id where p.tenant_id <> h.tenant_id;`
  - `select count(*) from public.aliados a join public.clients c on c.id = a.client_id where c.tenant_id <> a.tenant_id;`
- **Después de aplicar:** smoke del listado de aliados de la ficha de un cliente (embed `clients:client_id`) y de la marca del Portal, porque la versión de PostgREST de producción no se verificó.

## FUERA DE ALCANCE DETECTADO

- **Lista de precios que queda en el tenant viejo (residual medido tras la 0451).** Un superusuario o service_role todavía puede mover de tenant a un aliado raíz sin clientes ni sub-aliados, si arrastra su cliente-ancla en la misma sentencia (CTE). Su `price_books` se queda en el tenant anterior, porque `price_books_guard_aliado` (0382:130-168) solo se dispara desde `price_books`.
  - Evidencia: con la 0451 aplicada, NB con «Lista de NB» en T1 pasó a T2, un cliente nuevo de NB en T2 dio de alta sin error, y `resolve_price_book` le devolvió «Lista de NB» con tenant T1.
  - La sesión del Studio no puede hacerlo: 42501, `new row violates row-level security policy for table "aliados"`.
  - Arreglo concreto: FK compuesta `price_books (tenant_id, aliado_id) → aliados (tenant_id, id)`, que reutiliza `aliados_tenant_id_id_key`, con su preflight; o prohibir cambiar `aliados.tenant_id`; o filtrar `pb.tenant_id` en la rama del aliado de `resolve_price_book`.
- **`mensajeDeErrorAliado` (`actions.ts:1155-1175` en esta rama; 1147-1167 en main)** devuelve el 23503 crudo de las FK nuevas en `convertirEnAliadoAction` y `actualizarAliadoAction`, del tipo `No se pudo guardar el aliado: insert or update on table "aliados" violates foreign key constraint "aliados_parent_mismo_tenant_fkey"`.
  - Solo pasa con un request fabricado, porque la UI ofrece clientes y aliados del propio tenant.
  - Arreglo: traducir el 23503 por nombre de constraint, como en `createClientAction`.
- **`_norte/backend/README.md`**, lectura obligatoria según AGENTS.md para backend del Studio, no existe ni en el worktree ni en el checkout principal. Hay que corregir la referencia o restaurar el documento.
- **La reserva `85486484` deja `docs/specs/README.md` desactualizado.** `docs:check` falla sobre la rama de reserva hasta que la rama de trabajo regenera el índice. Conviene regenerarlo en el procedimiento de reserva.

## HANDOFF AL DIRECTOR

- **Orden seguro:**
  1. revisar la PR y su CI;
  2. decidir baseline o aplicación de la 0451;
  3. fusionar sobre el SHA revisado, repitiendo antes el merge de main si avanzó;
  4. aplicar la 0451 en otra tarea: OK nominal de Sam, de a una, name exacto `0451_aliados_cadena_mismo_tenant`, en horario de baja actividad y con el conteo agregado previo;
  5. smoke del listado de aliados y de la marca del Portal;
  6. si se declaró espera, retirarla.
- **Aditiva respecto de producción:** no reescribe filas, y solo redefine `get_portal_brand()` agregando la línea del filtro. La 0450 y la 0401 no se tocan.
- **Gate de símbolos:** `get_portal_brand()` ya existe en producción (0401), así que la 0451 no crea símbolos nuevos y no requiere declaración.
- **Conflictos posibles:** `docs/specs/README.md`, que se une con el driver `dtd-generated-records`. En GitHub no corre el driver: si main avanza con specs nuevas antes de fusionar, hay que repetir el merge en la rama.
- **Contenedores propios, todos retirados:** `dtd_act_sql_focal`, `dtd_act_mut`, `dtd_act_pgrst_db`, `dtd_act_pgrst_rest` y la red `dtd_act_net`. Los `dtd_sqltest_*` y `dtd_rebuild_*` los retiran sus scripts. No se tocó el stack `dtd-pr28-auth-*` ni ningún proceso ajeno.
- **Ownership:** se libera al cierre con `node scripts/harness-worktree.mjs release --owner aliados-cadena-tenant-20260912`, después de la última escritura. Se conservan el worktree y la rama.
