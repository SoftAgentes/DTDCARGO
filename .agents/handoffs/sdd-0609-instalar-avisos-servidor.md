# Handoff — SDD-0609 · Guion de instalación de los avisos del servidor y lista para Sam

Fecha: 2026-11-07. Task ID: `sdd-0609-instalar-avisos-servidor`.

- **Owner / sesión escritora:** `local_heuristic-boyd-faed9b` (Worker Claude Code), por encargo del Subdirector `local_61442abe-3b66-423e-9af4-8008d5457aa3`.
- **Worktree:** `.claude/worktrees/heuristic-boyd-faed9b`.
- **Rama:** `claude/heuristic-boyd-faed9b`, desde `origin/main` `7e75f7708`.
- **SDD:** 0609, sin número nuevo. Solo documentación.
- **Permisos:** PR en borrador. Nada en producción.

## OBJETIVO ORIGINAL

1. Guion de instalación de la 0609 en el VPS de producción, en un runbook y no en código: orden, respaldo, instalación del guion de la #404, prueba con un aviso real en `#publicaciones` y vuelta atrás.
2. Lista única para Sam: qué webhooks faltan, el comando exacto para pegar cada uno sin pasar por un chat y qué le toca después.
3. Estado de `#salud` y de los avisos de correo.
4. Estado de la #403 y la #404, sin mezclarlas con esta PR.

## COMPLETADO

- **`docs/runbooks/instalar-avisos-servidor-discord.md` (nuevo):**
  - § 1, la lista para Sam: A servidor, B Studio y C después.
  - § 2, el paquete en la PC.
  - § 3, la ventana: L lectura, I1 scripts nuevos, S Sam pega, I2 `publicar-web.sh`, P prueba y cierre.
  - § 4, la vuelta atrás.
  - § 5, `#salud` y los avisos de correo.
  - § 6, lo que no hace.
- **`docs/runbooks/avisos-servidor-discord.md`:** una línea en el encabezado que enlaza al guion. No toca los § 2 y § 3, que reescribe la #404.

### Medido en el repo para el guion

| Qué | Resultado |
|---|---|
| Script que corre hoy en el VPS | sha256 `f71d27594e568f2b`, instalado el 2026-11-01 en el paso V3 (memoria del plan de salida). Es el de `ea8ca60d7` |
| Commits de `publicar-web.sh` entre `ea8ca60d7` y `main` `7e75f7708` | solo `f69d520b4`, el de la 0609 |
| sha256 en `main` `7e75f7708` | `publicar-web.sh` `1863b76e71e9f8f8` (blob `601afce0fcdf`) · `aviso-discord.sh` `70639acad24ef26b` (blob `6aa22abb1761`) |
| sha256 en las cabezas de las PR | `guardar-webhook-discord.sh` en la #404 `b93a80491`: `e0ca796f4bcd8362` · `publicar-web.sh` en la #403 `451363eb8`: `467c5f634af842a8` |
| `env-set.sh --name` | lee de stdin cuando no hay `/dev/tty` (`infra/ops/migrate/env-set.sh:78-79`), pero no valida que sea un webhook ni el canal |
| Avisos de correo | `mail-health` y `alta-health` van a la categoría `equipo` (`#avisos-equipo`), no a `#salud`. No hay categoría `salud` en el Studio |

### Estado de la #403 y la #404 (2026-11-07, solo lectura)

| | #403 relevo sin corte | #404 guardar el webhook |
|---|---|---|
| Cabeza | `451363eb8`, borrador | `b93a80491`, borrador |
| Base | `3d17292a4` | `14040bb87` |
| GitHub | `MERGEABLE`, `BEHIND` | `MERGEABLE`, `BEHIND` |
| Cambios de `main` en sus archivos desde la base | ninguno | ninguno |
| `git merge-tree` contra `main` `7e75f7708` | sin conflicto | sin conflicto |
| `git merge-tree` entre las dos | sin conflicto | sin conflicto |
| CI «Calidad local sin secretos» | PASÓ, run 42281870431. `pruebas-linux.sh` 6/0, `prueba-publicar-web.sh` 235 PASÓ | PASÓ, run 42277750175. `pruebas-linux.sh` 7/0, `prueba-guardar-webhook-discord.sh` 24 PASÓ |
| Revisiones y comentarios | ninguno | ninguno |
| `main` sin protección de rama | traer `main` no es obligatorio para fusionar | igual |

**Qué necesitan:**

- **#404:** revisión independiente y salir de borrador.
  - Traer `main` solo si el Director General quiere el CI sobre la base de hoy: nada de lo nuevo toca sus archivos.
  - Ajuste que no bloquea: el comando usa `ssh -o BatchMode=yes`. Si la PC de Sam no tiene la huella del VPS en `known_hosts`, falla con «Host key verification failed». Sam ya entró antes con esa llave, así que debería estar.
- **#403:**
  - Revisión independiente.
  - El `--mutantes` completo **NO EJECUTADO**: su handoff lo deja con turno, y el CI no lo corre (0 apariciones de `--mutantes` en el log).
  - El `free -m` del VPS antes de la primera publicación con relevo.
  - **Orden con la 0609:** si la #403 se fusiona antes de la ventana, el `publicar-web.sh` de `M` trae también el relevo. El § 2 del guion lo detecta con `git log` y para. Recomendación: instalar la 0609 desde un `M` sin la #403, o pedir los dos OK juntos.
- **Las dos:** ninguna de las PR tiene conflicto con esta.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (`pnpm docs:check`) | **PASÓ**: índice sincronizado con 596 specs |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | **PASÓ**: sin números repetidos (0342 y 0394, choques históricos conocidos) |
| `git diff --check` | **PASÓ** |
| `git merge-tree` de `92e1966ac` contra la #403 y la #404 | **PASÓ**: sin conflicto con ninguna |
| Comandos del guion en el VPS | **NO EJECUTADO**: la tarea prohíbe tocar producción. Son de la sesión de Contabo, en la ventana |
| `pnpm verify` y build | **NO APLICA**: solo documentación; el gate es el CI de GitHub |

## COMMITS

- `92e1966ac` docs(ops): SDD-0609 — guion de instalación de los avisos del servidor y lista para Sam
- el commit siguiente: esta tabla de validación

## PR / BRANCH

`claude/heuristic-boyd-faed9b` → `main`, en borrador.

## PENDIENTES DE ESTA TAREA

- Ninguno de escritura. La ventana misma es de la sesión de Contabo, con el OK del Director General y después de fusionar la #404.

## FUERA DE ALCANCE DETECTADO

1. **Webhooks del Studio sin guion por portapapeles** (B1-B5 y `DISCORD_TENANT_ID`). `env-set.sh` no valida forma ni canal. Propuesta: generalizar `guardar-webhook-discord.sh` con `--canal`, `--clave` y `--config` para `/srv/dtd-cargo/.env`, más el reinicio de la web.
2. **Avisos de correo:** el plan de la oficina los pone en `#salud` y el código, en `#avisos-equipo`. Decide Sam. Si es `#salud`, hace falta una SDD del Studio con una categoría nueva.
3. **SDD-0610 § 6.1** dice «`#salud`, por la cola de SDD-0606». La cola solo acepta `registro`, `bugs` y `reportes` (`lib/studio/alerts/alert-outbox.ts:36-40`).
4. **`docs/runbooks/chatwoot-vigilancia.md`** sigue diciendo «Telegram» en los cuatro monitores de Kuma (Subdirector de Chatwoot). Ya estaba anotado en la nota de la 0609.

## HANDOFF AL DIRECTOR

- La ventana se abre después de fusionar la #404. El runbook trae el orden y la lista para pedirle a Sam de una vez: § 1.
- Lo que Sam pega en esta instalación es una sola llave, la de `#publicaciones`. La de `#salud` ya está en Kuma, según la coordinadora; falta el repaso de los monitores.
- Impacto documental: un runbook nuevo y un enlace. Graphify, Archify y Obsidian: **NO EJECUTADO** en este worktree (solo docs de runbook, sin `node_modules`). Queda para el cierre del Director desde `main` integrado.
