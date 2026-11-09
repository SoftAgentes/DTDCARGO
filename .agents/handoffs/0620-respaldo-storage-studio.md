# Handoff · SDD-0620 · respaldo cifrado de los archivos del Storage de Studio

- **Owner:** Worker (Claude), sesión hija del Director General `local_25e2dded-103b-4eaa-b10e-6527564b9cad`; claim `local_respaldo-storage-studio`.
- **Ruta:** `.claude/worktrees/respaldo-storage-studio-4e17a7` · **rama:** `claude/respaldo-storage-studio-4e17a7` · base `origin/main` `793ee2c17`.
- **SDD:** [0620](../../docs/specs/0620-respaldo-storage-studio/spec.md), `in-progress`. La reserva está publicada (`codex/sdd-reserve-0620`, `refs/dtd/reservations/0620`, `d5305d3eb`) e incorporada en esta rama.
- **Autorización:** Sam, 2026-11-09: «si prepara un pr el respaldo cifrado». Incluye la PR en borrador. **No** incluye merge, VPS ni producción.
- **Fecha:** 2026-11-09.

## OBJETIVO ORIGINAL

Que los archivos del Storage de Studio en producción (modo `file`, ~515 MB) se respalden cifrados con `age` en Backblaze B2 igual que la base, y que la documentación diga la verdad.

## COMPLETADO

- `infra/ops/backup/storage-backup.sh` (nuevo): un `tar` de `data/storage` alimenta por tuberías y FIFOs a `age` (`.tar.age`), a la lista por archivo (`tar --to-command`, cifrada) y a la huella del flujo. El manifiesto va sin rutas. Hace `rclone copy` + `check` a `b2:dtdcargo-respaldos/storage/<proyecto>/` y aplica retención de 30 días acotada al prefijo y de 2 respaldos locales. Guardas: carpeta con ≥ 1 archivo, destinatarios sin clave privada, espacio libre y GNU tar.
- `infra/ops/backup/storage-restore.sh` (nuevo): `--verificar` (sin escribir) y `--destino` (carpeta vacía). Comprueba el sha256 de los `.age` antes de descifrar, la huella del flujo, la lista por archivo, el conteo y los bytes.
- `infra/ops/lib/storage-lista.sh` (nuevo): la lista que comparten los dos scripts.
- `infra/dtd-cargo/backup.sh`: tercer paso, después del dump y la configuración. Si falla, el respaldo sale FALLÓ y no late. La descripción de la unidad systemd ahora nombra el Storage.
- Pruebas: `infra/ops/tests/prueba-respaldo-storage.sh` (nueva, agregada a `pruebas-linux.sh` → CI «Calidad continua») con contratos C1 a C4 y mutantes M1 a M5, cada uno con base limpia. `prueba-backup-dtd.sh` (VPS) queda adaptada al tercer paso.
- Documentación: runbook `backup-restore-servidor.md`. En §1, la fila del Storage. La §5 se reescribió: lo medido, el respaldo diario, la comprobación mensual, el restore en producción y qué hacer si crece. Ya no aparece el `rclone sync r2:… b2:…-copia` que no existía. También `infra/ops/README.md`, `infra/dtd-cargo/README.md` (el overlay S3 no está activo) y la fila de Backblaze en `inventario-terceros.md`.
- La spec trae el diseño (D1 a D5), la revisión `revisar-datos-ve` y el **guion de instalación** para el OK nominal de Sam.

Criterios de aceptación de la spec: 1, 2, 3 y 5 cumplidos en código y en la prueba local. El 4 (que corra en el CI) espera a Actions. El 6, por diseño, queda fuera de esta PR.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `prueba-respaldo-storage.sh` en Git Bash (Windows) | `9c2e01cb5`, copia de scratch con 3 adaptaciones solo locales: `/run/lock` → `/tmp/lock` en `backup.sh`, `WORK_ROOT` `/dev/shm` → `/tmp` y un `flock` doble (Windows no tiene ni `/run`, ni `/dev/shm` escribible, ni flock). El resto, idéntico a lo commiteado (verificado con `diff`) | **PASÓ** 27 PASÓ · 0 FALLÓ. Log: `side-session-notes/…/prueba-respaldo-storage-9c2e01cb5-windows.log` |
| Misma prueba sin adaptar, en Git Bash | `9c2e01cb5` | 24 PASÓ · 3 FALLÓ. Los 3 fallos (C4, «backup.sh sin storage» y M1 base limpia) son `/run/lock` inexistente en Windows, no defectos |
| Misma prueba en Linux (CI ubuntu o Docker) | — | **NO EJECUTADO**: GitHub Actions no corre desde 2026-11-09 03:36Z (facturación) y Docker Desktop está apagado, porque al encenderlo levanta los 5,3 GB de loop-3d y pide turno |
| `age` real (ida y vuelta) | — | **NO EJECUTADO**: no hay `age` en esta PC. La prueba lo usa sola si encuentra `/usr/bin/age` |
| `prueba-backup-dtd.sh` (adaptada) | — | **NO EJECUTADO**: es del VPS, como root con Docker. No se toca el VPS |
| `bash -n` de los 6 scripts tocados | HEAD | PASÓ |
| `node scripts/build-docs-index.mjs --check` (docs:check) | HEAD | PASÓ (601 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | HEAD | PASÓ (solo advisories históricos) |
| `node scripts/build-governance-capsule.mjs --check` | HEAD | PASÓ |
| `git diff --check` | HEAD | PASÓ |
| `ci-workflow-contract.test.mjs` (clasificación de pruebas bash) | — | **NO EJECUTADO** local (sin `node_modules`). La prueba nueva está en `PRUEBAS=( … )` de `pruebas-linux.sh`, que es lo que esa prueba lee |
| `shellcheck` | — | NO DISPONIBLE en la PC |
| `pnpm verify` | — | NO EJECUTADO: el cambio es de operaciones en bash y documentación, sin producto. Las comprobaciones que aplican son las de arriba |
| Graphify / Archify / `knowledge:status` | — | NO EJECUTADO (sin `node_modules`; los publica el Director desde main) |

Mutantes (en la corrida local): **M1** `backup.sh` sin el paso del Storage cae en C4. **M2**, el tar pasa por disco en claro y se borra: lo atrapa el `age` espía de C1. **M3**, el tar excluye `client-docs`: cae C2. **M4**, el restore no compara el sha256: cae C3. **M5**, el restore no compara la lista: cae con una lista adulterada. Antes de cada uno, el contrato pasó sin mutar.

## COMMITS

- `d5305d3eb` chore(sdd): reserva SDD-0620 (de la reserva).
- `9c2e01cb5` feat(ops): scripts, `backup.sh`, unidad, pruebas.
- `4080a9344` docs(ops): spec, índice, runbook, READMEs, inventario de terceros.
- (este handoff, commit propio).

## PR / BRANCH

Rama `claude/respaldo-storage-studio-4e17a7`, **sin publicar**. Actions está bloqueado y el encargo pide no gastar pushes. La PR en borrador se abre con un solo push cuando el DG lo diga o cuando Actions vuelva.

## PENDIENTES DE ESTA TAREA

1. Correr `prueba-respaldo-storage.sh` en Linux: el CI de la PR, o `docker run … node:24` con turno del DG.
2. Abrir la PR en borrador y avisar al DG cuando el CI esté verde, para la revisión independiente.
3. Instalación en producción, con OK nominal de Sam: guion en la spec, §Instalación (lo pide el DG).
4. Después de instalar: primer registro en el runbook §8 (conteo del manifiesto frente a `storage.objects`).

## FUERA DE ALCANCE DETECTADO

- **La #479 no es la que nombró el DG.** La #479 abierta es «SDD-0586 · runbook de las puertas» y no toca `backup-restore-servidor.md`. Las líneas `r2:dtdcargo-backups/db…` de §2 y §3 siguen sin corregir en main. No las toqué.
- `inventario-terceros.md:46` todavía dice que Backblaze está «todavía sin datos reales». Producción respalda allí desde octubre. Corregir el estado le toca a privacidad.
- La credencial de subida a B2 es la misma que borra (H7 de la revisión del traslado). Sigue abierta.
- El DPA de Backblaze sigue NO VERIFICABLE.
- `config-backup.sh --include` no tiene uso; se puede quitar o documentar.

## HANDOFF AL DIRECTOR

Listo en local (3 commits + handoff). Hace falta tu decisión: ¿publico la rama con un push para que corra el CI cuando vuelva Actions, o me das turno para correr la prueba en Docker local? Después, la revisión independiente y el OK nominal de Sam para el guion de instalación.

## Impacto documental

Actualizados: `docs/runbooks/backup-restore-servidor.md` (§1, §5), `infra/ops/README.md`, `infra/dtd-cargo/README.md`, `docs/legal/privacidad/inventario-terceros.md` y el índice de specs. Graphify/Archify: NO EJECUTADO, pendiente del Director tras integrar.
