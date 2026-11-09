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

**Tercera vuelta, por la segunda revisión** (CHANGES_REQUESTED sobre `39c2f7022`, dos bloqueantes en la guarda):
- **B1.** `--aceptar-caida` exige `=<conteo exacto>` (sin él, sale 2; con otro conteo, sale 1 sin tocar nada), y el runbook dice «solo con OK nominal de Sam» y qué borra. Antes de la retención retiene el último bueno: en disco lo mueve a `storage-retenido/`; en el remoto lo copia a `<proyecto>-retenido/` con `rclone check`. Si eso falla, no borra nada.
- **B2.** La guarda falla cerrada: una referencia ilegible o vacía sale 1 sin retención; sin referencia, compara contra el máximo de los manifiestos locales. La referencia guarda `archivos=` y `base=` y se escribe con `.part` + `mv`.
- Pruebas: C6 ampliado (sin conteo, conteo equivocado, retención del bueno en disco y en el remoto) y C7 nuevo (referencia ilegible y vacía; máximo sin referencia). Mutantes M9 (ilegible no frena), M10 (mínimo en vez de máximo) y M11 (acepta sin retener).
- No bloqueantes: `find` con `|| aviso`; tipos de error de tar sin ruta en el log y en el restore; docstring de `storage-lista.py` (orden y enlaces duros); guion con `merge-base --is-ancestor` y `sha256sum -c` automático (paso 0), lectura del `.env` y del prefijo en B2 (paso 1), comprobación de kernel, tar y xattrs en `/dev/shm` (paso 4b) y un paso 6 que no depende de `$F`.

**Cuarta vuelta, por la tercera revisión** (CHANGES_REQUESTED sobre `0fc4e96c4`, un bloqueante):
- **B1'.** Sin un respaldo bueno identificado (referencia ilegible sin manifiestos, o un `--out` equivocado), `--aceptar-caida` sale 1 sin tocar nada. Después del `copy` y del `check` cuenta con `lsf` los 3 archivos en `<proyecto>-retenido/`, porque rclone sale 0 aunque no haya copiado nada, y recién entonces mueve la copia local. El doble de rclone sale 0 con cero coincidencias, como el real, y aprende `lsf` y una falla simulada.
- §5.1 y el paso 5 del guion toman el candado del timer (`flock -n /run/lock/backup-dtd-cargo.lock`) y el `--out` del `.env`.
- **La prueba destapó un fallo propio:** sin permisos de lectura en la referencia, `sed` fallaba bajo `pipefail` y el script salía sin mensaje. Era seguro, porque no borraba nada, pero no decía por qué. Ahora cae en «ilegible».
- Pruebas: C7 ampliado (`archivos=` sin `base=`; sin permisos, si no es root; aceptar sin referencia), C8 (aceptar sin bueno, en dos variantes), C9 (rclone falla al retener), C10 (el bueno ya no está en el remoto) y `--aceptar-caida=` vacío. Mutantes M12 (sin bueno solo avisa), M13 (`|| falla` → `|| true`) y M14 (sin conteo de los 3), y M11 reapuntado a la copia local.
- No bloqueantes: log de tar con `sed -nE …p` y un contador de «otros avisos» (respaldo y restore); `--aceptar-caida=` vacío sale 2; una línea sobre el crecimiento de `storage-retenido/`; el paso 0 en un subshell con `set -euo pipefail`.

**Seguimiento, después de la aprobación** (APPROVED sobre `ddc427dfd`; rama `claude/0620-seguimiento`, PR aparte, antes de pedirle a Sam el OK de instalación):
- **N1.** Si en disco no estaban los 3 archivos del bueno, el log lo dice; el retenido verificado es el del remoto.
- **N3.** `flock -n -E 75 … || { …candado tomado… }` en §5.1, y `set -o pipefail` en el paso 5, que pasa por `| tee`.
- **N4.** §5.1 toma del `.env` todo lo que usa `backup.sh`: `BACKUP_DIR`, `BACKUP_STORAGE_DIR`, `BACKUP_STORAGE_RCLONE_REMOTE`, `BACKUP_AGE_RECIPIENTS_FILE`, `RCLONE_CONFIG_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_STORAGE_KEEP_LOCAL` y `BACKUP_STORAGE_MIN_FILES`.
- **N5.** Las rutas pasan a `${OUT}/dtd-cargo/…` en vez de la ruta fija.
- **N6.** C11, un `check` del retenido con una diferencia simulada, más el mutante M15, que quita solo su `|| falla`.
- **N7, decidido que va.** Sin referencia confiable, la guarda compara contra el máximo de los manifiestos locales y del remoto (`rclone cat`). Un disco nuevo o un `--out` equivocado ya no pasan por una primera corrida. Va con C12 (dos días de caída sin estado local y la aceptación) y el mutante M16. Primero lo hice solo «sin locales», pero C12 mostró que al otro día el manifiesto local de después de la caída ganaba, así que ahora siempre es local ∪ remoto.
- **N2, decidido que no.** `lsf … || true`: si `lsf` falla, el conteo da 0 y la aceptación falla. El `|| true` no abre nada y evita que `pipefail` corte sin mensaje. Queda anotado en la spec.
- M9 y M11, reapuntados a las líneas nuevas.

**Seguimiento, segunda vuelta** (CHANGES_REQUESTED de la #486 sobre `b7fd0f422`, un bloqueante; ya con main y la #482 adentro):
- **Bloqueante.** `archivos=` fuera de formato dejaba pasar la retención: uno enorme desbordaba la cuenta y uno con cero inicial bash lo leía como octal. Ahora los conteos valen solo como `^[1-9][0-9]{0,15}$`, en la referencia (si no, «ilegible»), en `--aceptar-caida` y en los manifiestos, y se comparan con `10#`. Un manifiesto anterior fuera de formato, local o del remoto, frena la retención. Las demás opciones numéricas quedan acotadas a 9 cifras y `--min-pct` a 0..100 sin cero inicial. Va con la prueba C13 (enorme y con cero inicial en la referencia, en un manifiesto local y en uno del remoto) y los mutantes M17 y M18.
- El awk vacía `sello` después de cada manifiesto. Si además de la referencia ilegible falla `cat`, se conserva el mensaje «referencia ilegible».
- Runbook §5.1: un **bloque de valores** del `.env` (`PROYECTO`, `OPS_DIR`, `BACKUP_DIR`, `DTD_DATA_DIR`, `BACKUP_STORAGE_*`, `BACKUP_RETENTION_DAYS`, `BACKUP_AGE_RECIPIENTS_FILE` y `RCLONE_CONFIG_DIR`) con la misma regla de comillas que `envget`. Lo usan §5.1, el paso 5 y la vuelta atrás. También «Si el bloqueo no tiene salida»: cómo listar los manifiestos y apartarlos, con OK de Sam.
- Textos vencidos corregidos: el encabezado del script, los mensajes del `--out` y la spec D2 y aceptación 4. M8 quedó reapuntado.

**Seguimiento, tercera vuelta** (CHANGES_REQUESTED de la #486 sobre `a0a2fb07f`; el bloqueante era una regresión):
- **Bloqueante.** Al aceptar una caída, un manifiesto fuera de formato se ignoraba sin avisar: si era el más grande, su respaldo quedaba sin retener y caía en la retención. Ahora `--aceptar-caida` sale 1 sin retener ni borrar mientras haya uno, y el aviso de «ilegible» también lo nombra. Prueba C14: el más grande con `archivos=0700`, referencia ilegible y después aceptación. Mutante M20.
- Un solo filtro, `patron_linea` (`^<n> [^[:space:]]+$`, anclado a los dos lados), decide cuáles manifiestos valen y si alguno no vale. Así `archivos=5 999999` ya no pasa como 5 (va a C13). `n_re` y `patron_n` se definen una vez y los usan la referencia, `--aceptar-caida` y los manifiestos. Mutante M19 sobre el filtro; M17 reapuntado a `n_re`.
- `--min-pct` va de 1 a 100, porque 0 apagaba la guarda.
- Runbook: apartar con `${P:?}`, `${OUT:?}`, `${REMOTO:?}` y `${RC:?}`, y también cuando el máximo no tiene sus 3 archivos en el remoto (`lsf`). La vuelta atrás de la spec también usa `:?`.

**Seguimiento, cuarta vuelta** (CHANGES_REQUESTED de la #486 sobre `532098f16`: el remoto no pasaba por el filtro único):
- **Bloqueante.** El `awk` sobre el `rclone cat` concatenado solo imprimía con `archivos=`. Un manifiesto remoto vacío o sin `archivos=` no generaba línea, y `archivos=5=700` se leía como 5. Ahora los del remoto se listan con `rclone lsf` y se leen uno por uno con `rclone cat`, con la misma lectura que los locales: la última línea `archivos=` y la base sacada del NOMBRE del archivo. El `awk` ya no existe.
- `patron_linea` exige también `patron_base` (`base_re`), así que un nombre que pasa el glob pero no el patrón también frena.
- Pruebas: C15 con cuatro variantes del remoto, todas con el disco vacío (vacío, sin `archivos=`, `archivos=5=700` y un nombre fuera de patrón): frenan la retención y la aceptación, sin `delete` ni retenido. Mutantes M21 (salta el vacío), M22 (salta el sin `archivos=`) y M23 (lee `5=700` como 5); M16 quedó reapuntado al `lsf`.
- Runbook: después de apartar, un `ls`/`lsf` de lo apartado y de lo que quedó, porque `mv -n` y `rclone move` no dicen qué movieron.
- **Autorización de Sam (vía DG, 2026-11-09):** «ok en seguimineto y intalar». Cubre la #486 hasta main y que el DG instale la SDD-0620 en el VPS siguiendo §Instalación, desde el SHA de main que ya traiga la #486. No cubre `--aceptar-caida`, apartar, purge ni la vuelta atrás con borrado en B2. Pendiente de esta tarea: pasarle al DG el guion resuelto para ese SHA.

Criterios de aceptación de la spec: del 1 al 4 y el 6, cumplidos en código y en la prueba en Linux. El 5 espera el CI de la PR. El 7, por diseño, queda fuera de esta PR.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| Seguimiento, tercera vuelta: `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, como root y como uid 1001 | árbol de trabajo antes del commit | **PASÓ** 78 PASÓ · 0 FALLÓ en las dos; M1-M20 con base limpia |
| Seguimiento, segunda vuelta: `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, como root y como uid 1001 | árbol de trabajo después del merge de main, antes del commit | **PASÓ** 72 PASÓ · 0 FALLÓ en las dos; M1-M18 con base limpia |
| Seguimiento: `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, como root y como uid 1001 | árbol de trabajo de `claude/0620-seguimiento`, antes del commit | **PASÓ** 64 PASÓ · 0 FALLÓ en las dos; M1-M16 con base limpia |
| Cuarta vuelta: `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, como root y como uid 1001 | árbol de trabajo de la cuarta vuelta, antes del commit | **PASÓ** 58 PASÓ · 0 FALLÓ en las dos; M1-M14 con base limpia |
| Tercera vuelta: `prueba-respaldo-storage.sh` en `ubuntu:24.04` desechable, como root y como uid 1001 (`/run/lock` 1777) | árbol de trabajo de la tercera vuelta, antes del commit | **PASÓ** 48 PASÓ · 0 FALLÓ en las dos; M1-M11 con base limpia |
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
- Segunda vuelta: `7eac25d5e` fix(ops) y `39c2f7022` docs. Merge de main (#481): `3c777e33e`.
- Tercera vuelta: `e84caee62` fix(ops) y `0fc4e96c4` docs.
- Cuarta vuelta: `0773dcc02` fix(ops), `e72b703dc` docs y el merge de main `ddc427dfd` (APPROVED).
- Seguimiento (rama `claude/0620-seguimiento`, PR #486): `57e9940fd` fix(ops) y `b7fd0f422` docs; merge de main con la #482; segunda vuelta `4012b8c93` fix(ops) y `a0a2fb07f` docs; tercera vuelta con un commit `fix(ops)` (aceptar con dudoso falla, filtro anclado) y uno `docs`.

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

Cuarta vuelta lista en la #482: B1' y los cinco no bloqueantes. 58 PASÓ · 0 FALLÓ en Linux, con root y sin root. La PR se marca lista al publicar, para que corra la Calidad. El DG revisa el delta desde `0fc4e96c4`.

## Impacto documental

Actualizados: `docs/runbooks/backup-restore-servidor.md` (§1, §5), `infra/ops/README.md`, `infra/dtd-cargo/README.md`, `docs/legal/privacidad/inventario-terceros.md` y el índice de specs. Graphify/Archify: NO EJECUTADO, pendiente del Director tras integrar.
