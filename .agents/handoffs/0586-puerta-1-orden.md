# Handoff · SDD-0586 · Worker 10.5 · El orden de la puerta 1 y los «por confirmar» cerrados (solo docs)

**Rama:** `codex/0586-puerta-1-orden`, sacada de `main` `3c14dde83`.
**Worktree:** `DTD-worktrees/0586-puerta-1-orden`.
**Encargo:** del DG, pasado por el Subdirector Chatwoot el 2026-11-11. El contenido sale del paquete de la puerta 1 que el Subdirector le mandó al DG (`paquete-puerta-1.md`). Va antes de la #500.

## Qué trae

### `docs/runbooks/chatwoot-portal-p4-puertas.md`

1. **Una sección nueva, «El orden de las puertas 1 a 3: primero la 2».** El orden queda así: puerta 2 → los OK 1a y 1b, los dos antes de la primera corrida → `--solo-copia` → puerta 3. Las líneas citadas se comprobaron con `git show 3c14dde83:infra/ops/portal-historial/ensayo-portal.sh`:
   - `:232-233`: `CUENTA`, `BANDEJA` y `AGENTE_SERVICIO` tienen que ser números; si no, sale con `HECHO error=numeros` y 2.
   - `:585`: `USUARIOS` sale de `studio_copia`, es decir, de los `chatwoot_user_id` de `chatwoot_agent_links` y de `AGENTE_SERVICIO`. Por eso Studio se copia primero.
   - `:269-270`: `LISTA_MD5` y `HECHO lista_md5=`.
   - Además: la copia vive solo mientras dura una corrida, así que se copia dos veces, una en `--solo-copia` y otra en la puerta 3. Los OK cubren las dos corridas.
2. **La 1a y la 1b, sin «por confirmar».**
   - **La lista:** `copia-columnas.tsv`, con md5 `cc1534a8a223e37ab9485451d5ee922c` y 49 líneas, medido con `git show 3c14dde83:… | md5sum`.
   - **El comando:** el de `ensayo-portal.sh:23-25`, que trae `--solo-copia`, el ensayo completo y `--limpiar`.
   - **La 3.1:** ahora dice que la corrida crea la copia, y que su comando es sin `--solo-copia`.
3. **Los dos OK, copiados palabra por palabra del paquete.**
4. **«Antes de la primera puerta»:**
   - T1 a T4: verificados (`/privacidad` muestra «8 de noviembre de 2026», según el Subdirector, 2026-11-11).
   - La 1c-1 y la 1c-1b: verificadas (el DG midió en el VPS, el 2026-11-11, la revisión `2e2ddeb34` exacta).
   - El aviso al equipo antes de 4.4: pendiente.
5. **Los «por confirmar» de la #478 y la #480, cerrados:** las dos están en `main` desde `3c14dde83`.
   - Los SHAs de rama (`e64bfef65`, `1e2c94b93`) pasan a «en `main` desde `3c14dde83`».
   - Las líneas citadas siguen valiendo: `git diff --stat e64bfef65 3c14dde83 -- deshacer.sh` y `git diff --stat 1e2c94b93 3c14dde83 -- deshacer-vinculos.sh limpiar.sh` salen vacíos, y se releyeron `:44`, `:52`, `:96`, `:98`, `:134-137`, `:191-196`, `:218`, `:220-227` y `:231`.
   - En «Lo que falta confirmar» salen los dos puntos ya cerrados.
   - Queda solo la marca de la leyenda (`:12`).

### `docs/runbooks/chatwoot-portal-encendido.md`, la tabla §0

- **T1 a T4:** ✅, en el tren #441 (`146d5ea5e`). `a34a7f7e1`, la fecha de T4, entra por ese tren: es ancestro de `146d5ea5e` y no de su primer padre.
- **La 1c-1 (#440):** ✅, en el tren #441 (`146d5ea5e`, el merge de `pr/440`).
- **La 1c-1b (#451):** ✅, en el tren #452 (`2e2ddeb34`, el merge de `pr/451`).
- **El dato de producción** de las tres es el del DG en el VPS, el 2026-11-11: la revisión `2e2ddeb34` exacta. `146d5ea5e` es ancestro de `2e2ddeb34`.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (`pnpm docs:check`) | PASÓ: el índice está sincronizado con 604 specs |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ: no hay números repetidos; los choques históricos 0342 y 0394 son conocidos |
| `pnpm verify` | NO APLICA: el cambio es solo de docs |

Los dos se corrieron con `node` directo, sin `pnpm install`.

## Pendientes de esta tarea

- El verde del CI y la revisión del DG.

## FUERA DE ALCANCE DETECTADO

- **El código 6 de la 3.1** (`ensayo-portal.sh` en `main` desde `b5669b1a5`, `:131-141`): esa línea no se volvió a medir en `3c14dde83`, porque no la pidieron.
- **La #500** (el piso de 139, N1, N2 y N4) sigue aparte: su rama es otra y no toca estos archivos.

## La revisión del DG en `8ac635426` (CHANGES_REQUESTED, un bloqueante)

- **El bloqueante:** `copia-columnas.tsv:32` saca `chatwoot_portal_salida.error`, y el OK 1b decía «lo demás son ids, estados y fechas».
  - **El arreglo:** el texto del OK 1b es el nuevo del Subdirector, y agrega «, y el código de error técnico de la salida (un código fijo como mensaje_red o contacto_http_401, nunca texto)». La lista no cambia.
  - **La nota debajo,** con sus fuentes comprobadas en `3c14dde83`:
    - el `check` de `0519_chatwoot_portal.sql:117`;
    - el 22023 de `:332-333`;
    - el único que escribe la columna, `portal.ts:206`, con `codigo()` en `:79-81`;
    - los valores de `chatwoot-types.ts:9-16`;
    - `base` en `:251`.
    `git grep chatwoot_portal_marcar` confirma que ningún otro lo llama. `chatwoot_portal_marcar_conciliado` no escribe `error`.
- **«49 líneas»** pasa a «49 líneas, 26 de datos (16 de Studio y 10 de Chatwoot) y el resto comentarios», medido con `awk`: 23 comentarios y 0 líneas vacías.
- **Las cabezas fusionadas:** `602d5200e` (#478) y `a0c32c9cc` (#480). Las dos son ancestro de `3c14dde83`. Se citan en la leyenda, en el 3.0 y en el bloque `SISTEMA`.
- **El cierre de docs:** `docs:check` y `sdd:check` dan PASÓ.
