# Handoff · SDD-0586 · Worker 10.5 · Los dos menores del DG sobre la #506 (solo docs)

**Rama:** `codex/0586-guion-menores`, sacada de `origin/main` `326be27fe`, con la #504 y la #506 en main.
**Worktree:** `DTD-worktrees/0586-guion-menores`.
**Encargo:** los menores de la aprobación del DG de la #506 en `1cf1f4f82`, pasados por el Subdirector Chatwoot el 2026-11-11. Van antes de cualquier puerta 5.

## Qué trae

1. **El guion** (`chatwoot-portal-p4-guion-puertas-3-4.md`): las dos citas viejas, al día.
   - El 4.6b ya no dice que «la #504 lo está cambiando». Ahora dice que su única versión es la del runbook, que trae la #504, en `main` desde `8f2029a80`.
   - «De dónde sale cada cosa» cita `main` `326be27fe` en lugar de `836b2cf19`.
2. **La vuelta atrás del 5a** (`chatwoot-portal-p4-puertas.md`):
   - **El problema:** el `sed "s|…|$v|"` se rompía con un token que trajera `&` o `|`.
   - **El arreglo:** un `awk` que lee la línea guardada como archivo (`NR == FNR`) y no interpreta su valor. El `.env` se reescribe con `cat >`, que conserva el dueño y los permisos.
   - **La comprobación:** se compara el `sha8` del `.env` vuelto con el `HECHO env sha8=` del punto 1.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Los comandos del runbook, sacados del archivo con `grep` y corridos sobre un `.env` simulado con `CHATWOOT_ROUTER_TOKEN='a&b\|c\d'` | PASÓ: el punto 2 da `1` y `1`; la vuelta atrás da `1`; el `sha8` vuelto es `5eec48dd`, igual al del valor original; el `.env` queda byte a byte |
| El `sed` de antes, con el mismo valor | Sale con `unknown option to 's'` y deja la línea vacía: la falla era real |
| `node scripts/build-docs-index.mjs --check` (`pnpm docs:check`) | PASÓ |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ |
| `pnpm verify` | NO APLICA: el cambio es solo de docs |
| En el VPS | NO EJECUTADO |

## Pendientes de esta tarea

- El verde del CI y la revisión del DG.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.
