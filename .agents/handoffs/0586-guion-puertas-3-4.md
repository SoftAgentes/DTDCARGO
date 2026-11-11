# Handoff · SDD-0586 · Worker 10.5 · El guion de las puertas 3 y 4, y el paso del token en la 5 (solo docs)

**Rama:** `codex/0586-guion-puertas-3-4`, sacada de `origin/main` `836b2cf19`.
**Worktree:** `DTD-worktrees/0586-guion-puertas-3-4`.
**Encargo:** del DG, pasado por el Subdirector Chatwoot el 2026-11-11. Va en paralelo con la #504. Nada se ejecuta en el VPS.

## Qué trae

1. **`docs/runbooks/chatwoot-portal-p4-guion-puertas-3-4.md`, nuevo:** el checklist del DG para la puerta 3 y para la 4.0 a la 4.10, con los comandos para copiar y una casilla por paso.
   - **Las variables de la puerta 2,** ya hecha: `BANDEJA=10` y `AGENTE_SERVICIO=1`.
   - **La nota del DG:** `ssh … bash -s` con `docker exec -i` se come el guion, así que los comandos van de a uno.
   - **El 3.0, con los mismos `scp`.** Agrega la comparación de los sha256 de los 27 archivos con `diff`.
   - **El ensayo como unidad de systemd,** con `systemd-run`: `TimeoutStopSec=600s` y `Nice=10`, los de `lanzar-unidad.sh:32` y `:84`. Ese lanzador no se reusa, porque solo acepta las unidades del Archivo Kommo (`:60-63`). Corre primero con `--solo-copia` y después completo.
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

## La revisión independiente del DG en `1e04bcfcc` (CHANGES_REQUESTED)

**Los bloqueantes:**
1. **Sin salida que deje seguir sin la #504.** El guion ahora exige que esté en `main` antes del 3.0, y la condición de 4.0 dice que ya entró.
2. **La comparación de los 27 sha256:** el `sed` es `sed -E 's#^([0-9a-f]{64}) [ *](.*/)?#\1  #'`, en los dos lados.
   - **Lo que corrí,** el 2026-11-11 en la PC, con Git Bash y `sha256sum (GNU coreutils) 8.32`:
     - el lado del repo da `27`;
     - un VPS simulado, que es una carpeta local con los 27 archivos, `migraciones/`, `sistema-produccion` y `deshacer/`, con el comando del lado del VPS corrido ahí, da `iguales`;
     - con un `README.md` de más, el `diff` lo muestra; con un archivo cambiado, también;
     - el `sed` deja igual una línea de formato Linux (`hash  ruta`) que una de Git Bash (`hash *ruta`).
   - **No probado:** el lado del VPS en el VPS.
3. **En el 5a, los comandos literales, dentro del repo:**
   - el punto 1 trae los tres comandos de lectura: los `AccessToken` con su `sha8` y sus fechas, la huella del `.env` y del contenedor, y los ids;
   - el punto 6 trae la huella del contenedor con `printenv … | tr -d '\n' | sha256sum | cut -c1-8`. Probé que `tr -d '\n'` da lo mismo que `printf '%s'`;
   - el punto 6 trae también `GET /api/v1/profile` desde el contenedor, con `node` y su propio entorno. Probé en local que, sin servidor, da `HECHO perfil=error`.

**Los menores:**
- **La vuelta atrás:** el punto 2 exige `grep -c` = 1 antes de guardar, y la vuelta atrás comprueba `grep -c '^CHATWOOT_ROUTER_TOKEN=.'` = 1.
- **El código de error:** `codigo()` (`portal.ts:79-81`) arma `<paso>_<error>`. Con el token vencido sale `contacto_no_autorizado`, `conversacion_no_autorizado` o `mensaje_no_autorizado`, según el primer paso que llame a Chatwoot. `mensaje_no_autorizado` sí existe: es el de los hilos ya vinculados por la puerta 4, por `falloPost("mensaje", …)` en `:194`. El runbook ahora nombra los tres.
- **`lanzar-unidad.sh:31`** pasa a `:32` (`readonly TIMEOUT_STOP_S=600`).
- **La prueba de borrado** incluye `/tmp` del Chatwoot de producción: el conteo de `ls -A /tmp` en `chatwoot-rails-1` y en `chatwoot-postgres-1`, anotado antes de la corrida y comparado después. El ensayo no escribe ahí: lee por `COPY … TO STDOUT`, y `ensayo-portal.sh` no nombra `/tmp`.
- **El merge-tree** se mide contra el `main` que traiga la #504, antes de subir.
