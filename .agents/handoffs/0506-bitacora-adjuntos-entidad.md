# Handoff 0506 · Los adjuntos de Bitácora vuelven a pasar la validación de entidad

- Fecha: 2026-10-14 00:58Z → 01:50Z (2026-10-13 noche, Caracas). Estado de la tarea:
  **0473 APLICADA en el servidor propio el 2026-10-14 a las 01:44:06Z y verificada**. Falta el
  smoke en la UI. PR [#199](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/199) abierta
  contra `main`, sin merge.
- Owner/sesión: `claude-jovial-lovelace-6d8291` (Claude Opus 5.5, Worker). Sesión de la app:
  «Arreglar adjuntos de tareas de bitácora». No había Director activo (ListAgents a las
  01:20Z); hice la coordinación de esta tarea según la skill Worker.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/jovial-lovelace-6d8291`
  (lo creó la app de Claude). `guard` OK, sin claim previo; reclamé con
  `harness-worktree.mjs claim --owner claude-jovial-lovelace-6d8291` y revalidé con
  `guard --owner` antes de commitear.
- Rama: `claude/reverent-poitras-59e021` (el nombre lo puso la app), desde `origin/main` = `221c48f4`.
- SDD: [0506](../../docs/specs/0506-bitacora-adjuntos-entidad/spec.md), reservada en local con
  `next-number.mjs --reserve bitacora-adjuntos-entidad` (rama
  `codex/sdd-reserve-0506-bitacora-adjuntos-entidad`, commit `cd828b97`, **sin push**).
  Migración 0473: el escaneo de refs y worktrees no encontró ninguna 0473+ antes ni después
  (la Worker «adjuntos-visibles-studio» tomó la SDD-0507 sin migración; la siguiente libre es 0474).
- Permisos del encargo (Sam): rama y worktree propios, SDD reservado, **PR al final, sin merge**.
  Aplicar en producción **no** es parte de la tarea.

## OBJETIVO ORIGINAL

En el Studio, Bitácora → editar tarea → «Prueba de avance» → «Subir foto o documento» falla
con «No se pudo registrar el adjunto: documento sobre entidad inexistente, de otro tipo o ajena
al tenant: bitacora_task/<id>», aunque la tarea existe en el mismo tenant. Arreglar
`document_entity_in_tenant()` con una migración nueva que agregue la rama `bitacora_task`,
conservando SECURITY DEFINER, `search_path ''`, dueño y grants; revisar si
`comments_validate_entity` necesita lo mismo; contrato SQL con control rojo y tenant ajeno
rechazado; dejar la aplicación para el OK de Sam.

## COMPLETADO

### Diagnóstico (medido)

- **Causa raíz: regresión de la 0314.** `0215_bitacora_enums.sql` (SDD-0146) agregó
  `bitacora_task` al enum **y** la rama al CASE. `0314_expenses_document_adapter.sql`
  (SDD-0224) reescribió la función para sumar `expense` partiendo del CASE de 0097 y perdió
  la rama. Ninguna migración posterior la recrea.
- **Producción = 0314 byte por byte.** El md5 del cuerpo de la 0314 en el repo, calculado
  sobre el archivo, es `fe0e86178dfd646dc7d58b46ef404949`, el mismo que midió Sam en Cloud y en el
  servidor. Releí el catálogo de **Supabase Cloud** (solo `pg_proc`, ninguna fila de negocio) el
  2026-10-14 ~01:05Z: dueño `postgres`, `prosecdef` true, `proconfig {search_path=""}`,
  `provolatile s`, ACL `{postgres=X, service_role=X, authenticated=X}`, sin `bitacora_task`.
  **El servidor propio no lo leí**: el dato del servidor es la medición de Sam.
- **Enum**: `bitacora_task` existe (0215); 0444 confirma los 12 tipos.
- **`bitacora_tasks` no tiene `deleted_at`** (0214; ningún `alter table` posterior). El ciclo de
  vida es `estado` y `authenticated` no tiene DELETE (`using (false)`).
- **Flujo de la app**: `TaskCollabSection.tsx` sube al bucket `bitacora` y
  `registerTaskAttachmentAction` (`app/studio/(app)/bitacora/collab-actions.ts:166`) inserta en
  `documents` con `entity_type='bitacora_task'`. Si el insert falla, borra el objeto. No hace
  falta cambiar la app.
- **Comentarios: no necesitan arreglo.** `comment_entity_in_tenant()` se definió por última vez
  en 0215, con la rama y el filtro de tenant. Su cuerpo vivo en Cloud es el de 0215 **sin sus dos
  comentarios de línea**: md5 vivo `473bd66fcd3a2ccc1fe83f0d1699b63a` contra
  `86d37a438337bc91e2f44e204d2051d4` del archivo. Mismo SQL. `comments_validate_entity` vivo = 0093
  (`1ddbd6629691ea4b99978c66309cc468`).
- **Otros candados del INSERT** (para que, ya arreglada la función, no aparezca otro error): los
  triggers BEFORE INSERT de `documents` son `documents_entity_rbac_guard_trg`,
  `documents_sync_storage_identity_trg` y `documents_validate_entity_trg`, en ese orden alfabético.
  Los dos primeros ya pasaron en el intento de Sam. La policy de INSERT (0438) exige
  `document_entity_authorized('bitacora_task', tenant, 'edit')`, la misma decisión que ya pasó la
  subida al bucket. `documents_touch` es solo de UPDATE.

### `supabase/migrations/0473_document_entity_bitacora_task.sql` (NUEVA, **NO APLICADA**)

- `create or replace` de `public.document_entity_in_tenant(public.document_entity_type, uuid, uuid)`
  con el cuerpo de 0314 (líneas 13-38) **verbatim**, más una línea antes del `else`:
  `when 'bitacora_task' then select exists(select 1 from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;`
- Conserva DEFINER, STABLE, `search_path = ''` y la firma; `create or replace` mantiene oid,
  dueño y ACL. Repite el revoke/grant de 0209. Comentario actualizado (nombra SDD-0506).
- **Preflight**: aborta si la función no existe, si no es DEFINER/STABLE/boolean con
  `search_path` vacío, o si `md5(prosrc)` ∉ {`fe0e86178dfd646dc7d58b46ef404949` (0314),
  `333626d3c6fc4a6b2490f7a4607abab9` (0473, re-aplicable)}. También si el enum no tiene
  `bitacora_task` o si `bitacora_tasks` no tiene `id`/`tenant_id`, o tiene `deleted_at`.
- **Postflight**: md5 = 0473, misma forma, EXECUTE para `authenticated` y `service_role`, ni
  `anon` ni PUBLIC. `lock_timeout 5s`, `statement_timeout 30s`. Sin DML. Locks solo de catálogo.
- Identidad del archivo (commit `6e72a85b`): blob `66fc588842f6877efbf46d92287ef76f0fd91e5f`,
  **11078 bytes, md5 `e4db161fb91db934d71585f9c8da86f8`**. Es lo que se compara con el ledger al aplicar.
- Espera declarada en `supabase/migrations-baseline.json › pendingBelowCutoff`, con la condición
  completa (se imprime en cada corrida del gate).

### Cobertura

- `supabase/tests/0473_document_entity_bitacora_task.test.sql`: **48 aserciones**. ANTES =
  copia verbatim de lo que corre en producción (0314 + comentario de 0215 + ACL de 0209 + trigger
  de 0097 con el `search_path` de 0210), y la 0473 se aplica **dos veces**. Cubre las once ramas
  previas (viva, otro tenant, `deleted_at`), `none`/null y el tipo cruzado. La rama nueva: mismo
  tenant, tarea `hecho`, inexistente, otro tenant y tipo cruzado en los dos sentidos. El camino de
  la app como `authenticated` sin grant sobre `bitacora_tasks`: INSERT aceptado; tarea ajena con
  `23514` y el mensaje exacto de 0097; UPDATE hacia tarea ajena rechazado; tenant B con su tarea.
  También el catálogo (oid y dueño iguales, ACL, `anon` → `42501`), el comentario y que no toca
  otras funciones de `public`.
- `lib/studio/__tests__/document-entity-bitacora-task.migration.test.ts`: **20 pruebas**.
  - Texto: md5 de 0314 = producción; 0473 = 0314 + la rama y nada más; md5 propio en el
    preflight y el postflight; copias del ANTES iguales a los archivos; sin DML/DDL de tablas; la
    espera declarada.
  - **Propiedad**: la última definición de la función en `supabase/migrations/` tiene una rama
    por cada valor del enum, derivado de 0097 + todos los `add value`. Así la regresión de la 0314
    no se puede repetir en silencio.
  - PGlite: green; control rojo; 4 preflights que abortan (cuerpo de 0215, un espacio de más,
    `deleted_at`, enum sin el valor); mutante del preflight sin md5, que deja pasar el drift; y
    6 mutantes coherentes (con el md5 de su propio cuerpo) que caen cada uno en su aserción: sin
    filtro de tenant, sin filtro de id, otra etiqueta, sin la rama `expense`, INVOKER, EXECUTE para `anon`.

## VALIDACIÓN

Cierre elegido por el diff: migración + sus pruebas + baseline + docs, sin código de `app/`.
**No corrí `pnpm verify` completo.** Corrí los pasos que este diff puede afectar, de a uno, con
la máquina libre (CPU 0 %, Docker sin contenedores, sin Director activo).

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contrato 0473 en PGlite | PASÓ | `TEST 0473 GREEN: 48 aserciones` |
| Control rojo en PGlite | PASÓ (rojo esperado) | `TEST 0473: bitacora_task del mismo tenant se acepta` |
| Contrato 0473 en `postgres:17` (psql real) | PASÓ | 48 aserciones; control rojo en la misma aserción; 0 funciones en `public` tras el ROLLBACK |
| Contrato 0473 en `supabase/postgres:17.6.1.165` (como `postgres` y como `supabase_admin`) | PASÓ | 48 aserciones; control rojo en la misma aserción |
| `schema-rebuild` sobre `supabase/postgres:17.6.1.136` (la imagen del servidor) | PASÓ | 469 migraciones (451 desde cero + 18 solo-ledger), 0473 incluida en orden; aislamiento multi-tenant (219 tablas + 2 tenants). El preflight aceptó la función que deja la cadena real 0097→0215→0314 |
| Envoltorio 0473 (Vitest) | PASÓ | 20/20 |
| Todos los `*migration.test*` (leen el baseline) | PASÓ | 16 archivos, 198 pruebas |
| `scripts/tests/merge-generated-records.node.mjs` (baseline) | PASÓ | 20/20 (TAP) |
| typecheck (`tsc --noEmit` completo) | PASÓ | exit 0, sin salida |
| eslint del archivo nuevo | PASÓ | exit 0 |
| docs:check | PASÓ | índice sincronizado con 492 specs |
| numbering (`sdd:check`) | PASÓ | sin números repetidos |
| governance:check | PASÓ | 28 políticas · cápsula vigente |
| pending-migration-symbols | PASÓ | 0 ROJO · 0 AMARILLO (la 0473 no crea símbolos) |
| `git diff --check` | PASÓ | exit 0 |
| migrations-applied | NO DISPONIBLE | SKIP: worktree sin `.env.local`. Además mide Cloud, no el servidor |
| `sql-tests` completo (226 contratos) | NO EJECUTADO | Solo el de 0473; ningún otro contrato hace `\ir` de 0473 |
| `test` completo, lint completo, build, e2e, rsc-boundary, edge-functions, harness | NO EJECUTADO | Sin código de app ni de harness en el diff. Corrida pesada: turno del Director si se quiere |

## COMMITS

- `65f0bbbd` docs: SDD-0506 spec — los adjuntos de Bitácora vuelven a pasar la validación de entidad
- `6e72a85b` fix(studio): SDD-0506 — 0473 devuelve la rama bitacora_task a document_entity_in_tenant
- `8cea4821` docs: SDD-0506 handoff — 0473 lista y probada, pendiente del OK de Sam
- Tras aplicar: un commit que retira la espera del baseline y ajusta la prueba («ya no es una
  espera y el archivo no se tocó»), y otro con la spec y este handoff al día.

## PR / BRANCH

- Rama `claude/reverent-poitras-59e021` → PR [#199](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/199)
  contra `main`. No es draft.
- La espera se agregó y se retiró en esta misma PR, así que no hace falta una PR de limpieza: el
  diff neto del baseline contra `main` es vacío.

## APLICACIÓN EN EL SERVIDOR (2026-10-14)

- **Autorización**: Sam, en esta sesión, textual: «ok, aplica la 0473_document_entity_bitacora_task
  en el servidor». Nombra la migración y el destino. Sam la ordenó en el servidor sabiendo (lo
  decía el reporte anterior) que el procedimiento del §4 de `servidor-contabo.md` no existe todavía:
  la registro como la **excepción explícita** a ese bloqueo, solo para esta migración.
- **Coordinación**: no había Director activo; la sesión «Contabo VPS y dockerización de proyectos»
  estaba inactiva. En el servidor: stack `dtd-cargo` sano (Up 11 h, `db` healthy), carga 6 sobre
  8 vCPU, 24 conexiones y 0 esperando locks.
- **Acceso**: `C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70` (agente de
  Windows). Base: `docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X` (postgres no es
  superusuario; es dueño de la función y del ledger).
- **Lectura previa** (READ ONLY, 01:42:43Z): cuerpo `fe0e86178dfd646dc7d58b46ef404949` (0314), dueño
  `postgres`, DEFINER, STABLE, boolean, `{search_path=""}`, ACL
  `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`, comentario de 0215; el
  enum con `bitacora_task`; `bitacora_tasks` con `id,tenant_id`, sin `deleted_at`;
  `documents_validate_entity` = 0097 (`f30ca464…`); `comment_entity_in_tenant` = `473bd66f…` (igual
  que Cloud). Ledger de 478 filas, última `20261013002655 · 0472_kommo_functions_base_url`, sin 0473.
  0 documentos `bitacora_task`.
- **Convención del ledger, medida**: la fila de 0472 guarda el archivo **con** el salto final (md5 =
  md5 del archivo, `1cfa2376…`, 10142 caracteres); la de 0471, sin él (`45696a7f…`). Para 0473 se
  guardó el archivo exacto, así que la identidad es directa contra el blob.
- **Aplicación** (01:44:06.960Z → 01:44:06.996Z, 36 ms): el script lo generó node a partir del blob
  de `6e72a85b`. El generador comprobó md5, bytes, que no hubiera CRLF ni barras invertidas, y que
  el delimitador no apareciera en el texto. Se verificó el md5 del script en el servidor
  (`d096408f…`). Una sola transacción: el texto de la migración + `insert` en
  `supabase_migrations.schema_migrations` (`version` = hora UTC, `name` exacto, `statements` =
  `array[<archivo>]`, `created_by` = `servidor-propio:psql:SDD-0506`) + `commit`. Salida: `SET`,
  `SET`, `DO` (preflight), `CREATE FUNCTION`, `COMMENT`, `REVOKE`, `GRANT`, `DO` (postflight),
  `INSERT 0 1`, `COMMIT`; psql exit 0.
- **Verificación** (READ ONLY, 01:44:43Z): cuerpo `333626d3c6fc4a6b2490f7a4607abab9`, dueño `postgres`,
  DEFINER, STABLE, boolean, `search_path` vacío, la misma ACL; EXECUTE para `authenticated` y
  `service_role`, no para `anon`; comentario de SDD-0506. `documents_validate_entity` y
  `comment_entity_in_tenant` intactas. Ledger: `20261014014406 · 0473_document_entity_bitacora_task`,
  1 sentencia, md5 `e4db161fb91db934d71585f9c8da86f8` = blob, 11078 bytes, **479 filas**. Prueba
  funcional, agregada y sin mostrar filas: `hay_tareas` t, `todas_aceptadas_con_su_tenant` t,
  `alguna_aceptada_con_otro_tenant` f, `alguna_inexistente_aceptada` f. 0 esperando locks.
- **Evidencia**: `/srv/ops/evidencias/apply-0473-dtd-cargo-20261014T0144Z/` (los tres scripts, sus
  tres salidas y `SHA256SUMS`). La copia de trabajo en `/root/dtd-0473` se borró después de copiarla.
- **Cloud NO**: Supabase Cloud no tiene la 0473. Si el corte se revirtiera a Cloud, la subida
  fallaría allí otra vez hasta aplicarla.
- La cabecera «NO APLICADA» del archivo **no se corrige**: el ledger guarda su texto exacto.

## PENDIENTES DE ESTA TAREA

1. **Smoke en la UI** (Sam, que tiene la sesión): Bitácora → editar una tarea de prueba → «Prueba de
   avance» → «Subir foto o documento». La foto aparece en la galería; quitarla con el botón de la
   galería. Si falla, el mensaje que devuelva la acción dice qué candado saltó.
2. Revisión y merge de la PR #199. El encargo pidió no mergear desde esta sesión: lo hace el
   Director o Sam (merge = despliegue). La PR no cambia la app, así que el orden respecto de la
   migración ya no importa.

## FUERA DE ALCANCE DETECTADO

1. **`documents.bucket_id` miente para los adjuntos de Bitácora.** `registerTaskAttachmentAction`
   no lo envía y la fila toma el default `'documents'` (0307), aunque el objeto vive en `bitacora`.
   El hub ya sabe que no las firma (nota de SDD-0146 en `lib/studio/documents/types.ts:266`). Pero
   `deleteDocument` (`app/studio/(app)/documentos/actions.ts:295`) borra el objeto en
   `DOCUMENTS_BUCKET` y en `bitacora` quedaría **huérfano**. Y `bitacora-purge-orphans` nunca toca
   adjuntos de tarea. Había 0 filas antes de aplicar; con la 0473 ya aplicada, la primera subida
   real crea la primera. Propuesta (tarea sugerida aparte en la app):
   que la acción envíe `bucket_id: 'bitacora'` y que el borrado del hub use `doc.bucket_id`. Es
   cambio de producto: otra SDD.
2. **Runbook de aplicación para el VPS** (SDD-0505 Fase 4): sigue sin existir. La 0473 entró por
   excepción explícita de Sam, y el procedimiento de arriba («APLICACIÓN EN EL SERVIDOR») sirve de
   borrador medido: psql en el contenedor, migración y ledger en una transacción, identidad contra
   el blob y evidencia en `/srv/ops/evidencias`. Escribirlo es del Director/SDD-0505.
3. **md5 vivo distinto del archivo en `comment_entity_in_tenant`** por comentarios que se perdieron
   al aplicar la 0215. No es un defecto. Pero un preflight futuro por md5 sobre esa función tiene
   que usar `473bd66f…`, no el md5 del archivo.
4. `migrations-applied` mide lo que diga `NEXT_PUBLIC_SUPABASE_URL` (RPC 0239). Si un `.env.local`
   todavía apunta a Cloud, va a marcar la 0473 como faltante. Sería medir bien el objeto
   equivocado: la 0473 está en el ledger del servidor, que es producción.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico nuevo: la spec SDD-0506 (+ índice regenerado). Ningún runbook ni AGENTS
  cambió. La aplicación quedó registrada en la spec (§ Aplicación) y en este handoff.
- `pnpm knowledge:status`: `structural INVALID` (4479 pendientes, 3304 ausentes) y `semantic INVALID`
  en **todo** el repo, porque este worktree no tiene grafo construido. No lo causa este diff.
  Graphify se publica desde main integrado (Director). Recibos semánticos: no aplica (sin fuentes de
  `semanticPilot` modificadas que yo haya podido verificar; queda para el Director).
- Archify: **NO DISPONIBLE** — `knowledge:visual build` → `ARCHIFY_RUNTIME_MISSING` (falta
  `archify.zip` v2.16.0 en `graphify-out/archify-package`; descargarlo requiere permiso). Preview de
  Obsidian: no generada.

## HANDOFF AL DIRECTOR

- Revisar la PR #199 (SHA de cabeza en el reporte). La 0473 ya está aplicada en el servidor; la PR
  ya no declara espera.
- Escribir en el ledger del servidor queda registrado arriba: quién (esta sesión), con qué OK y
  con qué método. GitHub no distingue sesiones; este handoff sí.
- Si `main` se mueve antes del merge, `docs/specs/README.md` choca: usar el driver de main y
  regenerar con `node scripts/build-docs-index.mjs`.
- La rama de reserva `codex/sdd-reserve-0506-bitacora-adjuntos-entidad` es local y sin push. Se
  borra con `-D` cuando la spec esté en main.
