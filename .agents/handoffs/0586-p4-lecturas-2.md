# Handoff · SDD-0586 §10.5.10 · lecturas, segunda parte (después del tren 9)

- **Rama:** `codex/0586-p4-lecturas-2`, desde `origin/main` `e74cde6fc` (tren 9, #476, con la #470 y la #475). Worker 10.5, claim `worker-10.5-lecturas-2`.
- **Encargo:** el Subdirector Chatwoot, después del tren 9. Pidió tres cosas:
  - la prevención del log confirmada;
  - lo no bloqueante de la revisión del DG a la #475;
  - el punto 7, que viene de E5 y la #473.

## Qué trae

| Archivo | Qué |
|---|---|
| `docs/runbooks/chatwoot-portal-p4-puertas.md` | Ver la lista de abajo. |
| `infra/ops/portal-historial/README.md` | La línea 6 nombra `conteo-portal.sql` y `cola-y-flag.sql`. |
| `lib/studio/__tests__/portal-historial-lecturas.test.ts` | Ver la lista de abajo. |

**El runbook:**
- **La prevención del log** pasa a **confirmada**. Cita la #470, el tren 9 y su run verde 42533753896 (L1 a L3 y M35 a M38 en PASÓ), y también `DETALLE_DEL_LOG` en `cargar-portal.rb:78` y `:181-185`. La fila 4.10 ya no dice «por confirmar», y el renglón salió de «Lo que falta confirmar».
- **El 3.0** copia lo que pide el ensayo de la 2b:
  - `ensayo-portal.sh`, `copia-columnas.tsv` y `ensayo-studio-esquema.sql`;
  - las 10 migraciones de la guarda G0, en `/srv/ops/portal-historial/migraciones/`, con su `install -d` y su `scp` aparte.
  - Todos entran en la lista de sha256, comparados con `git show origin/main:<ruta>`.
- **Las comprobaciones a mano antes de 3.1:**
  - el `TimeoutStopSec` de 300 s o más;
  - los nombres reales `dtd-cargo-db-1`, `chatwoot-postgres-1` y `/srv/chatwoot`;
  - las 10 migraciones presentes, porque si falta una la G0 se niega.

**La prueba:**
- **`SIEMBRA`** pone en T1 un flag encendido, un encendido auditado y un corte, y en T2 un apagado auditado y un encendido de otra clave.
- **Casos nuevos:**
  - T2 sigue en `ok` con la siembra;
  - la siembra pone T1 en `NO` por las tres tablas;
  - una fila de estado de T2 con corte nulo da `corte=nulo` y `ok`.
- **5 mutantes nuevos:** sin `->>'enabled'`, sin `->>'key'`, y sin el tenant del flag, de la auditoría o del corte. Cada uno corre dos veces: sin la siembra sobrevive, que es el rojo previo, y con ella cae.
- **La prueba estática** cubre las dos lecturas y busca DML y DDL: `insert`, `update`, `delete`, `merge`, `create`, `alter`, `drop`, `grant`, `revoke`, `truncate` y `copy`.

## Lo que depende de la #473

- **La #473 (la 2b de E5) todavía no está en `main`.** Al arrancar estaba OPEN, con la cabeza remota en `6d37fd7b7`.
- **Por eso los tres archivos del ensayo** van marcados ‹por confirmar hasta que la #473 esté en `main`›.
- **El runbook cita `ensayo-portal.sh` por nombre, no por línea:** la variable `MIGRACIONES`, la guarda G0 y `TIMEOUT_STOP_MIN_S=300`. La cabeza de la #473 puede cambiar en la revisión. Esos tres se midieron en `6d37fd7b7`: `:59`, `:215-217` y `:76`.
- **Las 10 migraciones sí están en `main`** (comprobado).

## Evidencia

| Comprobación | Estado |
|---|---|
| `docs:check` | PASÓ (600 specs) |
| No queda «por confirmar hasta la #470» en el runbook | PASÓ (0) |
| La búsqueda de DML y DDL sobre `conteo-portal.sql` | 0 coincidencias |
| vitest `portal-historial-lecturas.test.ts` (`--maxWorkers=1`, `--reporter=verbose`) | PASÓ: **24/24**, exit 0. Incluye el control rojo, los 6 mutantes de la #475 cayendo y los 5 nuevos, cada uno con su rojo previo dentro de la prueba: sobrevive sin la siembra y cae con ella. |
| `tsc --noEmit -p .` | PASÓ, exit 0 |
| ESLint del archivo de prueba | PASÓ, exit 0 |
| Citas `ensayo-portal.sh:` con número de línea en el runbook | 0 |

## Pendientes de esta tarea

- **Cuando la #473 entre a `main`:** quitar el ‹por confirmar› de los tres archivos del ensayo en la pieza siguiente, y comprobar que `MIGRACIONES`, la G0 y `TIMEOUT_STOP_MIN_S` siguen así.
- **Publicar** con el OK, después de mandar el SHA y el `--stat`.

## Impacto documental

- Cambian el runbook de las puertas y el README de `infra/ops/portal-historial/`. La spec no se toca, así que `spec-migration-refs` no aplica.

## FUERA DE ALCANCE DETECTADO

- **Un resto en disco** de la limpieza de la #475: `DTD-worktrees/0586-p4-lecturas`, por `Filename too long` en `node_modules`. Ya no está registrado y su rama se borró, local y remota. Lo purga el Subdirector.
