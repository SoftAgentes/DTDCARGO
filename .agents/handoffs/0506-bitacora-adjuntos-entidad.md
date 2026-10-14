# Handoff 0506 · Los adjuntos de Bitácora vuelven a pasar la validación de entidad

- Fecha: 2026-10-14 00:58Z → 01:35Z (2026-10-13 noche, Caracas). Estado de la tarea:
  **migración lista y probada, NO APLICADA**. PR abierta contra `main`, sin merge.
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
- (este handoff) docs: SDD-0506 handoff

## PR / BRANCH

- Rama `claude/reverent-poitras-59e021` → PR contra `main` (el enlace va en el reporte de cierre).
  No es draft: lo que falta es la aplicación, que es una autorización aparte, no validación pendiente.
- **Fusionar la PR NO aplica la migración** y no rompe nada: hasta aplicarla, la subida sigue
  fallando como hoy. Orden libre.

## PENDIENTES DE ESTA TAREA

1. **OK nominal de Sam para aplicar `0473_document_entity_bitacora_task`** en producción, que desde
   el 2026-10-14 es el Supabase self-hosted del servidor propio (217.216.54.70).
   **Bloqueo previo**: `docs/runbooks/servidor-contabo.md` §4 dice que hasta reescribir
   `aplicar-migraciones-prod.md` para el VPS (psql + fila del ledger a mano o
   `supabase migration up --db-url`) no se aplican migraciones allí. Ese runbook no existe
   todavía. Sam decide si se escribe primero o si hay una excepción explícita.
2. Antes de aplicar, en el servidor y en modo READ ONLY: `proowner`, `prosecdef`, `proconfig`,
   `proacl` y `md5(prosrc)` de `document_entity_in_tenant`. Se espera `fe0e8617…`, dueño `postgres`
   y la ACL de arriba. Si difiere, la migración aborta sola.
3. Aplicar **de a una**, con el name exacto `0473_document_entity_bitacora_task` y el archivo de
   11078 bytes / md5 `e4db161f…`. Postflight: md5 `333626d3…` y ACL.
4. **Smoke** en el servidor: subir una foto a una tarea de prueba, verla en la galería «Prueba de
   avance» y quitarla. Leer que la fila de `documents` quedó con `deleted_at` y el objeto fuera del
   bucket `bitacora`.
5. Tras aplicar y verificar: retirar la entrada de `pendingBelowCutoff` en una PR de limpieza y
   actualizar el estado de la SDD-0506.

## FUERA DE ALCANCE DETECTADO

1. **`documents.bucket_id` miente para los adjuntos de Bitácora.** `registerTaskAttachmentAction`
   no lo envía y la fila toma el default `'documents'` (0307), aunque el objeto vive en `bitacora`.
   El hub ya sabe que no las firma (nota de SDD-0146 en `lib/studio/documents/types.ts:266`). Pero
   `deleteDocument` (`app/studio/(app)/documentos/actions.ts:295`) borra el objeto en
   `DOCUMENTS_BUCKET` y en `bitacora` quedaría **huérfano**. Y `bitacora-purge-orphans` nunca toca
   adjuntos de tarea. Hoy no hay filas (0 en Cloud); aparecen apenas se aplique la 0473. Propuesta:
   que la acción envíe `bucket_id: 'bitacora'` y que el borrado del hub use `doc.bucket_id`. Es
   cambio de producto: otra SDD.
2. **Runbook de aplicación para el VPS** (SDD-0505 Fase 4): bloquea esta migración y cualquier otra
   en el servidor propio. Es del Director/SDD-0505.
3. **md5 vivo distinto del archivo en `comment_entity_in_tenant`** por comentarios que se perdieron
   al aplicar la 0215. No es un defecto. Pero un preflight futuro por md5 sobre esa función tiene
   que usar `473bd66f…`, no el md5 del archivo.
4. `migrations-applied` sigue midiendo Supabase Cloud (RPC 0239 contra `NEXT_PUBLIC_SUPABASE_URL`).
   Con producción en el servidor, su verde/rojo depende de a qué URL apunte `.env.local`.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico nuevo: la spec SDD-0506 (+ índice regenerado). Ningún runbook ni AGENTS
  cambió; la condición de aplicación vive en el baseline y en la cabecera de la migración.
- `pnpm knowledge:status`: `structural INVALID` (4479 pendientes, 3304 ausentes) y `semantic INVALID`
  en **todo** el repo, porque este worktree no tiene grafo construido. No lo causa este diff.
  Graphify se publica desde main integrado (Director). Recibos semánticos: no aplica (sin fuentes de
  `semanticPilot` modificadas que yo haya podido verificar; queda para el Director).
- Archify: **NO DISPONIBLE** — `knowledge:visual build` → `ARCHIFY_RUNTIME_MISSING` (falta
  `archify.zip` v2.16.0 en `graphify-out/archify-package`; descargarlo requiere permiso). Preview de
  Obsidian: no generada.

## HANDOFF AL DIRECTOR

- Revisar la PR (SHA de cabeza en el reporte). Integración: orden libre respecto de la migración.
- La aplicación necesita **dos** decisiones de Sam: el OK nominal de la 0473 y cómo se aplica en el
  VPS mientras no exista el runbook de la Fase 4.
- Si `main` se mueve antes del merge, `docs/specs/README.md` choca: usar el driver de main y
  regenerar con `node scripts/build-docs-index.mjs`.
- La rama de reserva `codex/sdd-reserve-0506-bitacora-adjuntos-entidad` es local y sin push. Se
  borra con `-D` cuando la spec esté en main.
