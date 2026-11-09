# Handoff · SDD-0620 · respaldo cifrado de los archivos del Storage de Studio

- **Owner:** Worker (Claude), sesión hija del Director General `local_25e2dded-103b-4eaa-b10e-6527564b9cad`; claim `local_respaldo-storage-studio`.
- **Ruta:** `.claude/worktrees/respaldo-storage-studio-4e17a7` · **rama:** `claude/respaldo-storage-studio-4e17a7` · base `origin/main` `793ee2c17`.
- **SDD:** [0620](../../docs/specs/0620-respaldo-storage-studio/spec.md), `in-progress`. La reserva está publicada (`codex/sdd-reserve-0620`, `refs/dtd/reservations/0620`, `d5305d3eb`) e incorporada en esta rama.
- **Autorización:** Sam, 2026-11-09: «si prepara un pr el respaldo cifrado». Incluye la PR en borrador. **No** incluye merge, VPS ni producción.
- **Fecha:** 2026-11-09.

## OBJETIVO ORIGINAL

Que los archivos del Storage de Studio en producción (modo `file`, ~515 MB) se respalden cifrados con `age` en Backblaze B2 igual que la base, y que la documentación diga la verdad.

## COMPLETADO

**Primera vuelta** (cabeza `282a692e0`):
- `storage-backup.sh`: un tar por tuberías a `age`, lista por archivo cifrada, manifiesto sin rutas, `copy` + `check` y retención acotada al prefijo.
- `storage-restore.sh`: `--verificar` y `--destino`.
- Tercer paso en `backup.sh`.
- `prueba-respaldo-storage.sh` con los mutantes M1 a M5.
- Runbook §1 y §5, READMEs e inventario de terceros.

**Segunda vuelta, por la revisión independiente** (CHANGES_REQUESTED sobre `282a692e0`):
- **B1, xattrs.** En el VPS, 714 de 714 archivos tienen `user.supabase.content-type` y `user.supabase.cache-control`.
  - El tar ahora es `--format=posix --xattrs --xattrs-include='user.*'` al crear y al extraer.
  - La lista pasa a `infra/ops/lib/storage-lista.py` (`tarfile`), porque `--to-command` no ve los xattrs. Lleva por archivo una huella de sus `user.*` (nombre y valor), sin imprimir los valores.
  - Se retira `storage-lista.sh`.
  - C2 siembra los xattrs y los compara después de restaurar. `--verificar` detecta una huella de xattrs cambiada. Mutantes nuevos: M6a (respaldo sin `--xattrs`) y M6b (restore sin `--xattrs`).
- **Rutas fuera del log.** El stderr de tar y de la lista va a `/dev/shm` y se borra; el log solo dice cuántas líneas hubo. `find` y `du` callan su stderr. La salida del restore no trae rutas. Prueba C5: un socket con nombre sembrado provoca un aviso de tar. Mutante M7.
- **Guarda contra un borrado masivo.** Si el conteo cae por debajo del 50 % de la referencia aceptada, el respaldo se sube, pero no corre la retención (ni remota ni local) y sale 1, cada día, hasta `--aceptar-caida`. Prueba C6 (dos días seguidos y la aceptación). Mutante M8.
- **Guion de instalación literal** en la spec, §Instalación: `git archive | ssh`, comprobación de sha256, `.bak` de `backup.sh`, `install` con modo 700, primero `/srv/ops` y después `backup.sh`, dry-run, primera subida solo del Storage, `systemctl start` (avisa que también hace el dump de la base y de la configuración), `lsl` del remoto, restore de prueba y vuelta atrás con sus comandos.
- **Runbook** en presente: «desde la instalación (pendiente de OK de Sam)» en §1 y §5; §5.1 explica la guarda y `--aceptar-caida`; §5.2 y §5.3 cubren los xattrs.
- `storage-restore.sh` normaliza `--dir`, `--age-identity` y `--destino` a rutas absolutas (prueba con rutas relativas).
- **Textos viejos:** encabezado de `backup.sh` («tres scripts»), comentario de `compose.supabase.yml` (el overlay S3 no está activo) y este handoff.
- **No bloqueante:** el `age` espía de la prueba ahora mira al empezar y al terminar.

Criterios de aceptación de la spec: del 1 al 4 y el 6, cumplidos en código y en la prueba en Linux. El 5 espera el CI de la PR. El 7, por diseño, queda fuera de esta PR.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, **como root**, árbol de trabajo de esta vuelta (todas las comprobaciones, mutantes M1-M8 con base limpia) | rama antes del commit de esta vuelta; GNU tar 1.35, Python 3.12.3, kernel 6.18 WSL2, `/tmp` en tmpfs | **PASÓ** 41 PASÓ · 0 FALLÓ; por el runner del CI, 1 PASÓ · 0 FALLÓ en 19 s |
| La misma, **sin root** (uid 1001, `/run/lock` 1777 como en el runner de GitHub, `/tmp` en overlay) | idem | **PASÓ** 41 PASÓ · 0 FALLÓ |
| Primera vuelta en `ubuntu:24.04` | `5881e98e7` | PASÓ 27 · 0 (histórico) |
| Docker al terminar | — | la imagen `ubuntu:24.04` se borró; ningún contenedor propio; los mismos 22 de antes. Docker Desktop ya estaba encendido y se dejó así |
| `age` real (ida y vuelta) | — | **NO EJECUTADO**: no está en el CI ni en la PC. La prueba lo usa si encuentra `/usr/bin/age` |
| `prueba-backup-dtd.sh` (adaptada) | — | **NO EJECUTADO**: es del VPS, como root con Docker |
| xattrs en `/dev/shm` del VPS | — | NO VERIFICABLE hasta la primera prueba (tmpfs los admite desde el kernel 6.6; el VPS corre Ubuntu 24.04) |
| `bash -n`, docs:check, sdd:check, governance:check, `git diff --check` | HEAD de esta vuelta | ver el commit; registrados en el aviso al DG |
| `ci-workflow-contract.test.mjs` | — | NO EJECUTADO local (sin `node_modules`); lo corre el CI |
| `pnpm verify` | — | NO EJECUTADO: cambio de operaciones en bash y Python, sin producto |
| Graphify / Archify / `knowledge:status` | — | NO EJECUTADO (los publica el Director desde main) |

Logs en `side-session-notes/…`: `prueba-respaldo-storage-5881e98e7-ubuntu2404.log` (primera vuelta).

## COMMITS

- `d5305d3eb` chore(sdd): reserva SDD-0620.
- `9c2e01cb5` feat(ops): scripts, `backup.sh`, unidad, pruebas.
- `4080a9344` docs(ops): spec, índice, runbook, READMEs, inventario de terceros.
- `51c13c3b2`, `5881e98e7`, `282a692e0`: handoff.
- Segunda vuelta: un commit `fix(ops)` (xattrs, log sin rutas, guarda, restore absoluto, pruebas) y un commit `docs` (spec con guion literal, runbook, READMEs, handoff).

## PR / BRANCH

- PR [SoftAgentes/DTDCARGO#482](https://github.com/SoftAgentes/DTDCARGO/pull/482), **en borrador**, base `main`, rama `claude/respaldo-storage-studio-4e17a7`.
- Revisión independiente sobre `282a692e0`: CHANGES_REQUESTED (B1 y los pedidos 1 a 6). Esta vuelta los atiende y mueve la cabeza; el DG decide si revisa de nuevo.
- Auto-fix está encendido en la PR.

## PENDIENTES DE ESTA TAREA

1. CI verde sobre la cabeza nueva; marcar la PR lista; nueva revisión, que lanza el DG.
2. Instalación en producción, con OK nominal de Sam: guion literal en la spec, §Instalación (lo pide el DG).
3. Después de instalar: primer registro en el runbook §8 (conteo del manifiesto frente a `storage.objects`) y comprobar xattrs en `/dev/shm`.

## FUERA DE ALCANCE DETECTADO

- La #479 (E10) corrige las líneas `r2:` de §2/§3 del runbook y choca en §5. El DG decidió que esta PR entra primero y E10 se acomoda después.
- `inventario-terceros.md:46` todavía dice que Backblaze está «todavía sin datos reales». Producción respalda allí desde octubre. Corregir el estado le toca a privacidad.
- La credencial de subida a B2 es la misma que borra (H7 de la revisión del traslado). Sigue abierta.
- El DPA de Backblaze sigue NO VERIFICABLE.
- `config-backup.sh --include` no tiene uso.

## HANDOFF AL DIRECTOR

Segunda vuelta lista y publicada en la #482 (sigue en borrador): B1 y los pedidos 1 a 6 atendidos, con pruebas y mutantes nuevos (M6a, M6b, M7 y M8). 41 PASÓ · 0 FALLÓ en Linux, con root y sin root. Falta el CI de la cabeza nueva y tu nueva revisión. El guion de instalación literal está en la spec, para pedirle el OK a Sam.

## Impacto documental

Actualizados: `docs/runbooks/backup-restore-servidor.md` (§1, §5), `infra/ops/README.md`, `infra/dtd-cargo/README.md`, `docs/legal/privacidad/inventario-terceros.md` y el índice de specs. Graphify/Archify: NO EJECUTADO, pendiente del Director tras integrar.
