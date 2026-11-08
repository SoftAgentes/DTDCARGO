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
- Prueba en PGlite con control rojo, 22 mutantes, dos revisiones estáticas (cargador y lanzador) y el lanzador corrido sin `--entorno` o sin `--sistema`.
- Revisión del DG sobre `4c0c2af54`, ya atendida:
  - `--entorno copia|produccion` comparado con la marca `dtd.entorno`;
  - `produccion` identificada con `--sistema` contra `pg_control_system()`;
  - `\set VERBOSITY terse`;
  - aborto con dos fichas vivas con el mismo `kommo_lead_id`;
  - el caso de las etapas;
  - el candado de transacción;
  - las comillas del `\i`;
  - los mutantes con su aserción;
  - el índice en la allowlist.
- Pendiente medir en el ensayo: que el rol de la carga pueda leer `pg_control_system()` (**NV**).
- `sql-tests.yml` se dispara también con `supabase/cargas/**`.

## Validación

| Comprobación | Resultado |
|---|---|
| `crm-carga-kommo.migration.test.ts`, `--maxWorkers=1`, con turno del Subdirector | PASÓ, 20 de 20. Después de la revisión del DG: rojo previo del contrato nuevo contra el cargador de `4c0c2af54` (cae en «pedir produccion en una base marcada como copia se rechaza»), y con el arreglo PASÓ, 27 de 27 (68 aserciones y 22 mutantes) |
| ESLint del archivo de prueba | PASÓ |
| `bash -n correr.sh` | PASÓ |
| `spec-migration-refs.test.ts` | PASÓ, 5 de 5 |
| `sdd:check` | PASÓ |
| `docs:check` | PASÓ, después de `docs:index` |
| `migrations-lock` | PASÓ: 0 nuevas sin sellar |
| «Contratos SQL» en Postgres 17 | NO EJECUTADO en la PC (lleva Docker). En Actions: rojo en el run 42478778578, por la copia del control C4, y PASÓ en el 42479215146 sobre `8915943f8`, con 267 de 267 y `✓ crm_carga_kommo.test.sql` |
| `pnpm verify` y el build | NO EJECUTADO, por regla del carril |

**`verify` también corre el contrato.**
- `scripts/run-sql-tests.mjs` monta la carpeta `supabase/` entera en `/sb`, en modo `:ro` (línea 102).
- Por eso `pnpm verify` y el paso «Contratos SQL» corren `crm_carga_kommo.test.sql` con `carga.sql` tal cual.
- El único que arma una copia aparte es el control C4 de `scripts/ci-sql-tests-control.sh`, y por eso suma `cargas/`.
- Nada de `cargas/` se aplica como migración: solo lo incluye el `\ir` del contrato.

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
