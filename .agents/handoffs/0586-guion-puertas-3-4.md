# Handoff · SDD-0586 · Worker 10.5 · El guion de las puertas 3 y 4, y el paso del token en la 5 (solo docs)

**Rama:** `codex/0586-guion-puertas-3-4`, sacada de `origin/main` `836b2cf19`.
**Worktree:** `DTD-worktrees/0586-guion-puertas-3-4`.
**Encargo:** del DG, pasado por el Subdirector Chatwoot el 2026-11-11. Va en paralelo con la #504. Nada se ejecuta en el VPS.

## Qué trae

1. **`docs/runbooks/chatwoot-portal-p4-guion-puertas-3-4.md`, nuevo:** el checklist del DG para la puerta 3 y para la 4.0 a la 4.10, con los comandos para copiar y una casilla por paso.
   - **Las variables de la puerta 2,** ya hecha: `BANDEJA=10` y `AGENTE_SERVICIO=1`.
   - **La nota del DG:** `ssh … bash -s` con `docker exec -i` se come el guion, así que los comandos van de a uno.
   - **El 3.0, con los mismos `scp`.** Agrega la comparación de los sha256 de los 27 archivos con `diff`.
   - **El ensayo como unidad de systemd,** con `systemd-run`: `TimeoutStopSec=600s` y `Nice=10`, los de `lanzar-unidad.sh:31` y `:84`. Ese lanzador no se reusa, porque solo acepta las unidades del Archivo Kommo (`:60-63`). Corre primero con `--solo-copia` y después completo.
   - **Lo que se mira de la corrida:** el journal, la evidencia y la prueba de borrado. Para la prueba se cuentan contenedores, volúmenes y redes con la etiqueta `com.docker.compose.project=portal-ensayo`, la misma que usa el guion (`ensayo-portal.sh:111-112` y `:165-167`).
   - **La puerta 4, de 4.0 a 4.10,** con los comandos del runbook en orden, las horas de 4.1 y 4.4 y el `md5` de `conteo-portal.sql`.
   - **El 4.6b no se copia:** se remite al runbook, porque la #504 lo está cambiando.
2. **`docs/runbooks/chatwoot-portal-p4-puertas.md`:**
   - un puntero al guion debajo del título de la puerta 3 y otro debajo del de la puerta 4;
   - en el sub-paso 5a, el paso ⛔ del `CHATWOOT_ROUTER_TOKEN` vencido: leer, guardar la línea, vaciarla, cargarla con `pegar-secretos-web.sh` y Enter, comprobar la misma imagen, verificar, la vuelta atrás y su OK nominal. **El `.env` no se toca:** solo se documenta.

## Lo que no toca

- `infra/ops/portal-historial/deshacer*`, `copia-columnas.tsv` ni nada de la #504.
- La rama `codex/0586-deshacer-pisos`, a la que no se hace push.
- **Los cruces con la #504** en el runbook se midieron con `git merge-tree`:
  - la #504 cambia las líneas ~169 y ~370;
  - esta PR, los títulos de las puertas 3 y 4 y el 5a.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (`pnpm docs:check`) | PASÓ |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ |
| `git merge-tree` contra `main` (`836b2cf19`) y contra la cabeza de la #504 (`93c325244`) | PASÓ: limpio en los dos |
| `pnpm verify` | NO APLICA: el cambio es solo de docs |
| Los comandos nuevos en el VPS | NO EJECUTADO: los corre el DG con sus OK |

## Pendientes de esta tarea

- El verde del CI y la revisión del DG.

## FUERA DE ALCANCE DETECTADO

- **El guion completo del 4.6b** se sigue leyendo solo en el runbook. Cuando la #504 entre, el DG decide si se arma su checklist aparte.
- **El código 6 de la 3.1** (`ensayo-portal.sh:131-141`, citado en `b5669b1a5`): no se volvió a medir en `836b2cf19`.
