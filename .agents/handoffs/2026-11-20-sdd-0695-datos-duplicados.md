# Handoff — SDD-0695 datos duplicados y fuentes únicas

- **Owner:** Worker `datos-duplicados-9e6364`, sesión hija de Dir_DTD.
- **Ruta:** `.claude/worktrees/datos-duplicados-9e6364`.
- **Rama:** `claude/datos-duplicados-9e6364`, sobre la reserva `codex/sdd-reserve-0695` (9b00a1665).
- **Objetivo:** el encargo de Sam del 2026-11-20 tiene tres partes: un diagnóstico de los datos duplicados
  o viejos, recomendaciones para que no vuelva a pasar y la spec. Esto es la fase 1 (diagnóstico) y la
  fase 2 (spec).
- **SDD:** 0695, asignada por Dir_DTD. Está relacionada con la 0694 (PR #725, ahora de este Worker) y con
  la 0696 (dirección del cliente final de un aliado, reservada, que va después).
- **Permisos del encargo:**
  - solo lectura del código;
  - conteos agregados de producción, con el OK previo de Dir_DTD;
  - publicar la rama y una PR en **borrador**.
  - No incluye migraciones, arreglos de datos, merges, `pnpm install`, vitest ni `pnpm verify`.

## Hecho

- Medición en `main` (9b00a1665) de D-1 a D-10, con archivo:línea (spec §2). Tres subagentes de solo
  lectura midieron D-3 a D-6 y D-9, y este Worker comprobó por muestreo las líneas de mayor riesgo:
  - `0077:70`;
  - `fiscal/queries.ts:225-226`;
  - `reports/queries.ts:740`;
  - `dashboard-kpi-queries.ts:57`;
  - la ausencia de `person_id` en `/registro` y en el Studio;
  - `updateClientAction` sin propagación;
  - la ausencia de `exc0674` en `rename_client_markbox`;
  - el alta del Studio sin búsqueda de duplicados.
- Spec `docs/specs/0695-datos-duplicados-fuentes-unicas/spec.md`, en estado `proposed`.
- La lista de 25 conteos (Q1 a Q21) está en la carpeta de notas compartidas de la sesión de Dir_DTD
  (`sdd-0695-conteos-produccion.sql`), fuera del repo. Se le mandó a Dir_DTD para su OK.

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | ver el commit |
| `node scripts/check-numbering.mjs` | ver el commit |
| `git diff --check` | ver el commit |
| `pnpm verify` | NO EJECUTADO: el cambio es solo de docs y el encargo no da turno de PC |

## Pendientes de esta tarea

1. Correr los conteos cuando Dir_DTD dé el OK. Reportar los números por chat y actualizar la §3 solo con
   texto cualitativo.
2. Las respuestas de Sam a P-1 a P-9 (spec §9), una por una.
3. La SDD-0696, en su propia rama y su propia PR, después de esta.
4. Las correcciones de revisión de la #725 (SDD-0694), cuando lleguen.

## Fuera de alcance detectado

- `next_receipt_code(uuid)`: la 0079:90 redefine con la misma firma la función de la 0008:150 (WR de China
  frente a R de cobros). Es una colisión de nombre ya documentada en `cn/actions.ts:164`.
- Varias cabeceras de migración dicen «NO APLICADA A PRODUCCIÓN» (0506, 0513, 0551, 0552, 0559, 0562 y
  0566), pero `migrations-baseline.json` no tiene pendientes. Conviene que Dir_DTD compare las cabeceras
  con el ledger.
- `warehouse_receipts_ve.eta` casi no tiene escritor: `createReceiptVe` no tiene llamadores
  (`naviera/actions.ts:548-549`).

## Impacto documental

- Spec nueva y el índice `docs/specs/README.md`.
- La F-1 propone un documento vivo nuevo, `docs/architecture/fuentes-unicas.md`. Todavía no se crea:
  depende de que Sam apruebe la spec.
