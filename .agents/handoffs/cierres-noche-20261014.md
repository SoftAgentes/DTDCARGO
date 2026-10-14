# Cierres de la noche del 2026-10-14 — SDD-0507, 0508, 0509, 0510 y 0511

- **Task ID / owner**: `cierres-noche-20261014`, subagente Worker del Director (sesión «Revisión de
  tareas en progreso»). Claim del worktree: `cierres-noche-20261014-worker-subagente`.
- **Worktree**: `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a06ce8196b6ff5092`
- **Rama**: `codex/cierres-noche-20261014`, creada con `git switch -c` desde `origin/main`
  `7f05a501` después de `git fetch origin`. `harness-worktree guard` OK.
- **SDD**: ninguna nueva. Se actualizan las specs existentes 0507, 0508, 0509, 0510 y 0511.
- **Migración**: ninguna. No se toca ningún archivo de `supabase/migrations/`.
- **Fechas**: 2026-10-14 UTC.
- **Permisos del encargo**: commits locales selectivos, push de la rama a sí misma y PR contra main
  (no draft). Prohibido fusionar, tocar producción o el VPS, escribir en otra rama o worktree y
  tocar main.

## OBJETIVO ORIGINAL

Una sola PR de cierre que deje en el repo lo que pasó en producción la noche del 2026-10-14 con
las SDD 0507, 0508, 0509, 0510 y 0511. En la 0508 eso incluye retirar la espera de la migración
0474, ya aplicada. Sin cambio de comportamiento de producto: sólo
`supabase/migrations-baseline.json`, una prueba de migración, specs y handoffs.

Allowlist exacta del encargo:

- `supabase/migrations-baseline.json`: sólo quitar `0474_documents_bitacora_bucket_backfill` de
  `pendingBelowCutoff`.
- `lib/studio/__tests__/documents-bitacora-bucket-backfill.migration.test.ts`: la prueba de la
  espera pasa a afirmar que ya no hay espera, el md5 y los bytes del archivo.
- Declaraciones de símbolos pendientes, sólo si nombran la 0474.
- Las cinco specs (y el índice regenerado con el script si cambia un status).
- Los cinco handoffs de esas tareas, con una sección «CIERRE (Director, 2026-10-14)» al final.
- Este handoff.

## COMPLETADO

- **Baseline.** Sale la entrada `0474_documents_bitacora_bucket_backfill` de
  `pendingBelowCutoff`, más la coma de la entrada 0423. `cutoff` (238) y las esperas 0422 y 0423 no
  cambian. El archivo resultante es **byte a byte** el que dejó `a1f66769` al retirar la 0473: los
  dos tienen el blob `db339f5933737d5243fb96f6f11d880aa5b02034` (`git hash-object`).
- **Prueba.** En `documents-bitacora-bucket-backfill.migration.test.ts`, el
  `it("la espera está declarada con su orden y el OK nominal")` se reemplaza, siguiendo el patrón
  de `a1f66769`, por `it("aplicada al servidor propio el 2026-10-14: ya no es una espera y el
  archivo no se tocó")`. Afirma `BASELINE.pendingBelowCutoff[NAME]` undefined,
  `md5(FILE_0474) = 6f4bb32df48a6e8851c8ced80ca02361` y `Buffer.byteLength(FILE_0474) = 5786`, con
  un comentario: aplicada el 2026-10-14 a las 04:02:18Z en el servidor propio, y editar el archivo
  (aunque sea la cabecera «NO APLICADA») rompería la identidad con el ledger. Se importa
  `createHash` de `node:crypto`; el archivo no lo importaba.
- **md5 sobre `FILE_0474`.** El archivo se lee con CRLF→LF. El md5 calculado sobre `FILE_0474` es
  el del blob: `git cat-file -p HEAD:supabase/migrations/0474_documents_bitacora_bucket_backfill.sql
  | md5sum` da `6f4bb32df48a6e8851c8ced80ca02361` y `git cat-file -s` da 5786; el texto
  normalizado da lo mismo con node. El blob es `4f901d17ae3f7779cb999272fa17f53bb2bec99b` en `HEAD`
  y en `4328f4fa`. No hizo falta ningún ajuste.
- **Declaraciones de símbolos.** `git grep -n 0474 -- scripts supabase` no encuentra la 0474 en
  `supabase/pending-migration-symbol-declarations.json` ni en ningún script de declaraciones (sólo
  `scripts/check-guia-alibaba.ts`, que cita la SDD-0474 de la guía de Alibaba, otra cosa). **No se
  tocó ningún archivo de declaraciones.**
- **Specs.**
  - 0507 → `done`, con «Cierre (2026-10-14)».
  - 0509 → `done`, con «Cierre (2026-10-14)», que deja dicho que reemplaza la nota de
    `in-progress` de «Aceptación» y el «NO VERIFICADA» de la cuenta.
  - 0510 → `done`, con «Cierre (2026-10-14)».
  - 0508 sigue `in-progress`, con «Aplicación de la 0474 (2026-10-14)»: merge, deploy, OK nominal,
    lectura previa, script, aplicación, verificación, evidencia, qué cambia en el repo y el estado
    del criterio 10.
  - 0511 sigue `in-progress`, con «Seguimiento (2026-10-14)»: cuenta previa, integración, CI,
    merge, deploy y el pendiente de la primera cancelación real.
  - `updated: 2026-10-14` ya estaba en las cinco. Índice `docs/specs/README.md` regenerado con
    `node scripts/build-docs-index.mjs`: cambian sólo las filas 0507, 0509 y 0510.
- **Handoffs.** Sección «## CIERRE (Director, 2026-10-14)» al final de los cinco, con los hechos de
  su tarea. Lo que ya decían no se reescribió.

## VALIDACIÓN

| Comprobación | Comando | Resultado |
|---|---|---|
| Dependencias | `corepack pnpm install --frozen-lockfile --prefer-offline` | PASÓ (37 s) |
| Prueba de la 0474 | `corepack pnpm exec vitest run lib/studio/__tests__/documents-bitacora-bucket-backfill.migration.test.ts --reporter=default` | PASÓ: `Test Files 1 passed (1)`, `Tests 14 passed (14)`, exit 0 |
| Control rojo: la espera de vuelta en el baseline (`git show HEAD:supabase/migrations-baseline.json`) | el mismo vitest | FALLÓ como se esperaba: `Tests 1 failed \| 13 passed (14)`, sólo la prueba nueva, con `AssertionError: expected 'PENDIENTE DE APLICAR — SDD-0508. Corr…' to be undefined`. Baseline restaurado después: blob `db339f59` |
| Identidad del archivo 0474 | `git cat-file -p HEAD:… \| md5sum`, `git cat-file -s`, md5 en node del texto normalizado | PASÓ: `6f4bb32df48a6e8851c8ced80ca02361`, 5786 bytes en los tres |
| Diff del baseline | `git diff`, comparación de la línea 0423 sin la coma, `git hash-object` | PASÓ: sólo sale la 0474 y la coma; blob igual al de `a1f66769` |
| Símbolos pendientes | `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO declarado(s)`, exit 0 |
| Índice de specs | `node scripts/build-docs-index.mjs --check` | PASÓ: `índice sincronizado con 497 specs` |
| Numeración | `node scripts/check-numbering.mjs` | PASÓ: `numbering: sin números repetidos` (los choques históricos 0342, 0363 y 0394 aparecen como ya aplicados, sin cambio) |
| Referencias spec↔migración | No hay script `spec-migration-refs` en `package.json`; es la prueba `scripts/__tests__/spec-migration-refs.test.ts`: `corepack pnpm exec vitest run scripts/__tests__/spec-migration-refs.test.ts --reporter=default` | PASÓ: `Tests 5 passed (5)` |
| Espacios | `git diff --check` | PASÓ |
| `pnpm verify` completo, vitest completo, e2e, Docker | — | NO EJECUTADO, por el encargo: cambio de baseline, una prueba y docs, sin código de producto |
| Conocimiento | `node scripts/knowledge-sync.mjs status` | `structural INVALID` (4519 pendientes, 3333 ausentes), `semantic INVALID` (1186), `archify PENDING` (`ARCHIFY_RUNTIME_MISSING`), `obsidian PENDING`: el worktree no tiene `graphify-out/`. No lo causa este diff |

Las validaciones se repitieron después de escribir este handoff: `git diff --check` y
`build-docs-index.mjs --check`.

## Impacto documental y conocimiento

- Documentos canónicos tocados: las specs 0507-0511 y su índice. Ninguna fuente del piloto
  semántico (`scripts/knowledge-policy.json › semanticPilot`, 16 documentos) cambió.
- Graphify estructural: NO EJECUTADO en el worktree (sin grafo; corrida pesada). Lo publica el
  Director desde main integrado.
- Archify: NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING`). Vista previa de Obsidian: no generada.

## COMMITS

- `0f7321cb` test(db): SDD-0508 — 0474 aplicada en el servidor: sale de las esperas y se fija la
  identidad del archivo (baseline y prueba).
- El commit que contiene este documento: `docs(sdd): cierres de la noche del 2026-10-14 — 0507,
  0509 y 0510 a done; 0508 y 0511 con su seguimiento` (cinco specs, índice, cinco handoffs y este
  handoff). Su SHA va en el reporte al Director y en la PR.

## PR / BRANCH

Rama `codex/cierres-noche-20261014` contra `main`, no draft. La PR se abre después del último
commit; su URL va en el reporte al Director. Sin merge.

## PENDIENTES DE ESTA TAREA

1. Revisión y merge de la PR: los decide el Director con Sam. El merge despliega, pero esta PR no
   cambia comportamiento.

## FUERA DE ALCANCE DETECTADO

- **La ref local `main` de este clon está en `7ddab50f`** (PR #193, 2026-10-08), detrás de
  `origin/main` `7f05a501`. `knowledge:status` informa la bóveda de Obsidian en esa misma
  revisión. No lo toqué: la publicación es del Director, desde main comprobado.
- **SDD-0507, «Ver» de «Todos los adjuntos».** `lib/studio/documents/adjuntos-queries.ts:235`
  sigue fijando `bucket: "documents"`. Es el pendiente propuesto de la 0507 (pasar a
  `documentObjectBucket`); hoy no cambia el comportamiento.
- **SDD-0511, dobles duplicados.** `lib/studio/__tests__/lectores-admin-double.ts` y
  `lib/studio/__tests__/listados-double.ts` están los dos en main; unirlos sigue abierto (pendiente 4
  del handoff de la 0511).

## HANDOFF AL DIRECTOR

- **Número de criterio de la 0508.** El encargo decía «falta la prueba manual de Sam (aceptación
  7)». En la spec de la 0508 el criterio 7 es el contrato SQL de la 0474 (cumplido); la prueba
  manual (la foto en la galería y en el «Historial», y borrar un adjunto de prueba desde el hub) es
  el **criterio 10**, y así la nombra también el handoff de la 0508 (pendiente 3 y tabla de
  VALIDACIÓN). En la spec y en los handoffs escribí «criterio 10». Si te referías a otra cosa,
  dímelo y lo corrijo.
- **La 0511, frase que quité.** No escribí que el primer cron «no tenía avisos que cancelar»: el
  conteo fue a las 03:59:44Z y el deploy a las 04:28:44Z, y entre los dos no se volvió a medir.
- **Diff**: 14 archivos, todos de la allowlist: cinco specs, el índice, cinco handoffs, este
  handoff, el baseline y la prueba de la 0474. Ningún archivo de producto.
- **Sesiones consumidoras**: ninguna. El claim se libera al terminar la escritura; el worktree y la
  rama se conservan.
