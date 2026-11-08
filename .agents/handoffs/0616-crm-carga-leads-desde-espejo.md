# Handoff — SDD-0616 · 6.5, carga de Kommo al CRM (preparada, sin cargar)

- **Owner:** Worker «E6 carga 6.5», sesión `b565c293` (iniciada por el Subdirector Chatwoot `local_535053f4`).
- **Ruta:** `.claude/worktrees/ecstatic-noyce-10be5c` · **rama:** `claude/ecstatic-noyce-10be5c` · base `main` `3c14715ad`.
- **SDD:** [0616](../../docs/specs/0616-crm-carga-leads-desde-espejo/spec.md). El número lo reservó el DG (stub `c764cf399`, `refs/dtd/reservations/0616`).
- **Permisos de esta tarea:** preparar, probar con datos inventados y abrir la PR en borrador. **No cubre**: cargar en producción, leer filas o contar en producción, ni escribir en Kommo, Meta o el Chatwoot vivo. Tampoco fusionar.

## Objetivo original

Preparar la 6.5: leads, etapas, tareas, mappings e IDs de Kommo al CRM propio, sin cargar.

## Completado

- Diseño en la SDD-0616, con D-6.5-1 a D-6.5-6 abiertas para el DG.
- Cargador `supabase/cargas/crm-kommo/carga.sql`: función en `pg_temp`, sin migración. Su lanzador `correr.sh` tiene modo seco (rollback) y modo cargar (commit, con `--confirmo-ok-de-sam`). La salida son solo conteos.
- Contrato `supabase/tests/crm_carga_kommo.test.sql`, con las migraciones 0503 a 0506 y la 0513 reales y datos inventados.
- Prueba en PGlite con control rojo, 17 mutantes y una revisión estática del código del cargador.
- `sql-tests.yml` se dispara también con `supabase/cargas/**`.

## Validación

| Comprobación | Resultado |
|---|---|
| `crm-carga-kommo.migration.test.ts`, `--maxWorkers=1`, con turno del Subdirector | PASÓ, 20 de 20 |
| ESLint del archivo de prueba | PASÓ |
| `bash -n correr.sh` | PASÓ |
| `spec-migration-refs.test.ts` | PASÓ, 5 de 5 |
| `sdd:check` | PASÓ |
| `docs:check` | PASÓ, después de `docs:index` |
| `migrations-lock` | PASÓ: 0 nuevas sin sellar |
| «Contratos SQL» en Postgres 17 | NO EJECUTADO en la PC (lleva Docker): lo corre Actions en la PR |
| `pnpm verify` y el build | NO EJECUTADO, por regla del carril |

## Pendientes de esta tarea

- CI de la PR, la revisión independiente y el diff del DG.
- Que el DG decida D-6.5-1 a D-6.5-6.
- Al corte (E8), cada paso con su OK: L1, el ensayo en una copia efímera, el seco en producción y la carga con OK nominal. Después, el acta.
- Si la migración A o la B de la 6.6 se aplican antes de la carga: D-6.5-4 y D-6.5-5 piden un cambio del cargador.

## FUERA DE ALCANCE DETECTADO

- `docs/runbooks/kommo-salesbots-inventario.md` dice que «500 KG por CBM es FALSO». Para el material que va al cliente, la regla son 500 kg/m³. Se registra en la SDD-0617 (6.7).
- Fusionar dos tarjetas de la misma persona sigue fuera (SDD-0614 §12).

## Impacto documental

SDD nueva y su fila en el índice regenerado (`docs/specs/README.md`). Graphify, Archify y Obsidian quedan para el cierre del DG: no corrí `knowledge:*` en este worktree.
