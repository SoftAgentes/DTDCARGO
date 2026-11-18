---
sdd: "0620"
title: "Respaldo cifrado de los archivos del Storage de Studio"
status: in-progress
author: "Claude"
created: 2026-11-09
updated: 2026-11-09
supersedes: null
superseded_by: null
related: ["0505", "0583"]
confidencialidad: interno
---

# SDD-0620 — Respaldo cifrado de los archivos del Storage de Studio

> Los archivos del Storage de producción (cédulas, fotos, POD, comprobantes), con sus xattrs de storage-api, salen cada día del VPS cifrados con `age` hacia Backblaze B2, igual que la base. Se pueden comprobar y restaurar con un script que verifica cada archivo.

## Contexto

Lo midió el Director General el 2026-11-09 en el VPS (Contabo, `217.216.54.70`), solo metadatos:

| Hecho | Valor |
|---|---|
| Backend de storage-api | `dtd-cargo-storage-1` con `STORAGE_BACKEND=file`, bind de `/srv/dtd-cargo/data/storage` a `/var/lib/storage` |
| Tamaño | ~515 MB, 714 archivos |
| xattrs | **714 de 714** archivos tienen `user.supabase.content-type` y `user.supabase.cache-control` (~09:20Z, solo nombres de atributos) |
| Overlay `compose.supabase.s3.yml` | **no** está activo |
| Remotos de rclone | un solo `[b2]` (`type = b2`) en `/srv/ops/backup/rclone/rclone.conf` |
| Respaldo diario | `/srv/dtd-cargo/backup.sh` (timer `dtd-cargo-backup`, ~07:05 CET): `pg-dump-to-s3.sh` → `b2:dtdcargo-respaldos/db` y `config-backup.sh` (`.env` + `db-config`; acepta `--include`, sin uso). **Ninguno toca `data/storage`** |
| Única copia de esos bytes fuera de la carpeta | Auto Backup de Contabo: mismo proveedor, y Contabo reporta su restauración degradada |

El dump trae `storage.objects` (la metadata), pero no los bytes ni los xattrs. La revisión del traslado ya lo había marcado (`docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md`, H11): con el backend en `file`, los objetos quedan «fuera de todo respaldo». Además, `docs/runbooks/backup-restore-servidor.md` §5 describía un `rclone sync r2:dtdcargo-storage b2:dtdcargo-storage-copia` semanal que nunca existió.

Sam autorizó el 2026-11-09, con sus palabras: «si prepara un pr el respaldo cifrado». Instalarlo en producción es un paso aparte, con OK nominal (§Instalación).

## Alcance

1. `infra/ops/backup/storage-backup.sh` (nuevo): respaldo cifrado del Storage.
2. `infra/ops/backup/storage-restore.sh` (nuevo): comprobación y restauración.
3. `infra/ops/lib/storage-lista.py` (nuevo): la lista por archivo, compartida por los dos.
4. `infra/dtd-cargo/backup.sh`: tercer paso, después del dump y de la configuración.
5. `infra/dtd-cargo/systemd/dtd-cargo-backup.service` y `infra/dtd-cargo/compose.supabase.yml`: solo textos (descripción y comentario).
6. Pruebas: `infra/ops/tests/prueba-respaldo-storage.sh` (nueva, en el CI Linux, con mutantes) y `infra/ops/tests/prueba-backup-dtd.sh` (VPS, adaptada al tercer paso).
7. Documentación: `docs/runbooks/backup-restore-servidor.md` (§1, fila del Storage, y §5), `infra/ops/README.md`, `infra/dtd-cargo/README.md` y `docs/legal/privacidad/inventario-terceros.md` (fila de Backblaze).

Fuera de alcance: instalar en el VPS, cambiar el `.env` de producción, pasar el Storage a S3/B2 y las líneas `r2:` de la base en §2/§3 del runbook, que son de otra tarea (E10, #479).

## Diseño

### D1 · Paso propio `tar | age`, no `config-backup.sh --include`

`config-backup.sh --include` **copia** el contenido a `/dev/shm` antes de cifrar. Son 515 MB de RAM, y sube solo cuando cambia la huella, con 8 copias locales y sin retención remota. El Storage pide otra cosa: que el claro no toque ningún disco, que se respalde completo todos los días y que tenga retención propia. Por eso va en un paso propio, con el modelo de `infra/chatwoot/respaldo.sh` (`tar` del contenedor directo a `age`).

Un solo `tar -C <origen> --format=posix --xattrs --xattrs-include='user.*' --numeric-owner -cf - .` alimenta, por `tee` y FIFOs en `/dev/shm`, a tres consumidores:

| Consumidor | Sale | En claro en disco |
|---|---|---|
| `age -R <destinatarios>` | `<base>.tar.age` | no |
| `storage-lista.py flujo` → `age` | `<base>-lista.age`: `sha256 bytes huella-xattrs ruta` por archivo regular | no |
| `sha256sum` | huella del flujo descifrado (al manifiesto) | no (solo la huella, en RAM) |

La lista sale de **los mismos bytes** que se cifran: no hay carrera entre «listar» y «empaquetar», y el restore compara contra exactamente lo que se respaldó. La lee `tarfile` de Python porque `tar --to-command` no expone los xattrs. Va cifrada porque las rutas pueden traer nombres de personas y el Shipping Mark (`lib/portal/client-photo.ts:76`: `${tenantId}/${markbox}/…`).

**xattrs.** storage-api guarda en `user.supabase.content-type` y `user.supabase.cache-control` el tipo y la caché de cada objeto. Sin ellos, una restauración serviría los PDF y las imágenes sin Content-Type. El tar los lleva en cabeceras pax (`--format=posix`). La lista guarda por archivo el sha256 de las parejas `nombre=valor-en-hex` de sus `user.*` ordenadas, o `-` si no tiene: compara valores sin imprimirlos.

`<base>.manifiesto` va en claro y **sin rutas**: sello, `archivos`, `bytes`, `archivos_en_disco` (conteo de metadatos al empezar), `aviso_tar`, `flujo_sha256` y el sha256 de los dos `.age`, en formato de `sha256sum -c`.

**Log sin rutas.** El stderr de `tar` y de la lista nombra archivos («./tenant/…: file changed as we read it»), y el log del servicio (`/var/log/backup-dtd-cargo.log`) está en claro. Ese stderr va a `/dev/shm` y se borra: el log solo dice cuántas líneas hubo y sus tipos, sin la ruta (`sed -E 's/^tar: .*: //' | sort | uniq -c`), igual que la salida del restore. `find` y `du` del conteo inicial callan su stderr por la misma razón.

Consistencia: storage-api sigue sirviendo mientras corre. Si tar sale 1, el respaldo sigue con `aviso_tar=1`: la lista sale del mismo flujo. Con tar ≥ 2, falla. Primero va la base y después los archivos, así que un archivo subido entre las dos copias queda huérfano, que es inofensivo. RPO: 24 h.

### D2 · Destino, retención, guardas y verificación

- **Destino:** `b2:dtdcargo-respaldos/storage/dtd-cargo/` (`BACKUP_STORAGE_RCLONE_REMOTE`, por omisión `b2:dtdcargo-respaldos/storage`). Es un prefijo propio, fuera de `db/`, así que la retención de los dumps no lo toca, ni esta la de ellos. El remoto se valida como `<remoto>:<bucket>/<prefijo>`, nunca la raíz.
- **Subida:** `rclone copy` de los tres archivos (nunca `sync`) y `rclone check --one-way --include "/<base>*"`.
- **Guarda contra un borrado masivo, que falla cerrada.** Con `MIN_FILES=1`, un borrado de casi todo pasaría, y en 30 días la retención se llevaría los respaldos buenos. Por eso, después de subir y antes de la retención, el script compara el conteo con el del último respaldo **aceptado**: `archivos=` y `base=` de `<out>/<proyecto>/storage/<proyecto>-storage.referencia`, escrita con `.part` + `mv`.
  - Si el conteo cae por debajo de `--min-pct` (50), el respaldo queda subido, pero no se aplica la retención, ni remota ni local, la referencia no cambia y el script sale 1: sin latido.
  - Si la referencia no se puede leer (vacía, sin `archivos=` o sin `base=` válida, sin permisos), lo mismo. Los conteos valen solo como `^[1-9][0-9]{0,15}$` y se comparan en base 10 (`10#`): un `archivos=` enorme desbordaría la cuenta, y uno con cero inicial bash lo leería como octal; en los dos casos la guarda no saltaría. Un manifiesto anterior con `archivos=` fuera de formato (también con algo más en la línea: el filtro está anclado a los dos lados) frena la retención, y también una aceptación: si fuera el más grande, ignorarlo dejaría su respaldo sin retener. `--min-pct` va de 1 a 100, porque 0 apagaría la guarda.
  - Si falta o es ilegible, se compara contra el **máximo** de `archivos=` de los manifiestos anteriores, locales y del remoto, que la retención conserva 30 días; van en claro y sin rutas. Los del remoto se listan con `rclone lsf` y se leen uno por uno con `rclone cat`, con la misma lectura que los locales: la última línea `archivos=` y la base sacada del **nombre** del archivo. Así, un manifiesto vacío, sin `archivos=`, con `archivos=5=700` o con un nombre que no casa con `<proyecto>-storage-<sello>` da una línea que el filtro rechaza. No se usa el más nuevo, que puede ser ya el de después de la caída. Con el remoto, un disco nuevo o un `--out` equivocado no se pasan por una primera corrida. Si el remoto no se puede leer, sale 1 sin retención.
  - `lsf … | grep -c . || true`: si `lsf` fallara, el conteo da 0 y la aceptación falla, así que el `|| true` no abre nada; está para que `pipefail` no corte el script sin mensaje.
  - Se repite cada día hasta que una persona corra `--aceptar-caida=<conteo>`, **solo con OK nominal de Sam**. El conteo tiene que ser exactamente el del respaldo; si no, sale 1 sin tocar nada. Si no hay un respaldo bueno identificado (ni la referencia ni ningún manifiesto anterior, local o del remoto, da uno válido), sale 1 sin tocar nada; la salida de ese bloqueo, con OK de Sam, está en el runbook §5.1. Antes de aplicar la retención, esa corrida **retiene el último respaldo bueno**:
    - en el remoto lo copia a `<remoto>/<proyecto>-retenido/`, lo comprueba con `rclone check` y cuenta sus 3 archivos con `rclone lsf`, porque rclone sale 0 aunque no haya copiado nada;
    - recién entonces, en disco, mueve a `<out>/<proyecto>/storage-retenido/` lo que de ese respaldo haya; si no estaba completo, lo avisa en el log, y el retenido verificado es el del remoto.

    Ninguna retención toca esos prefijos. Si cualquier paso falla, no se borra nada. El comando de §5.1 toma el candado del timer (`/run/lock/backup-dtd-cargo.lock`) y el `--out` del `.env`. Qué borra después: runbook §5.1.
- **Retención:** `rclone delete --min-age 30d` acotado al prefijo, la misma que la base (decisión de Sam en la revisión del traslado; borrado real por `hard_delete`). En disco local, los 2 respaldos más nuevos (`BACKUP_STORAGE_KEEP_LOCAL`), porque cada uno pesa lo que el origen.
- **Otras guardas:** destinatarios válidos y sin clave privada, también en `--dry-run`. Al menos `BACKUP_STORAGE_MIN_FILES` (1) archivos: una carpeta vacía o equivocada **falla** y no late. Espacio libre ≥ origen + 10 % + 100 MB. GNU tar y `python3`.
- **Fallo:** si `storage-backup.sh` sale ≠ 0, `backup.sh` termina en FALLÓ y no manda el latido. Un Storage sin respaldo se nota igual que una base sin respaldo.

### D3 · Prueba de restauración en un directorio desechable

`storage-restore.sh` trabaja sobre los tres archivos bajados del bucket. Normaliza `--dir`, `--age-identity` y `--destino` a rutas absolutas:

- `--verificar`: descifra y recorre el flujo con `storage-lista.py` **sin escribir ningún archivo**.
- `--destino <carpeta>`: restaura con `tar --xattrs --xattrs-include='user.*'` en una carpeta vacía o inexistente, nunca encima de nada, y lee la lista de lo que quedó. Para la prueba mensual, `/dev/shm/storage-restaurado`: desechable, cabe en RAM con 515 MB, y tmpfs admite xattrs `user.*` desde el kernel 6.6. Para un restore real, una carpeta nueva al lado de `data/storage` y el cambio de carpeta con storage-api detenido (runbook §5.3).

Las dos comprueban, con PASÓ/FALLÓ por línea: sha256 de los `.age` **antes** de descifrar, descifrado y tar sin errores, huella del flujo, lista restaurada = lista respaldada (rutas, bytes, sha256 y huella de xattrs de cada archivo), y conteo y bytes = manifiesto. La lista descifrada, los avisos de tar y la clave viven solo en `/dev/shm` y un trap los borra. La salida no trae rutas.

### D4 · Si el Storage crece

| Tamaño | Qué pasa | Qué hacer |
|---|---|---|
| ≤ 10 GB | completo diario; ≤ 300 GB en el bucket con 30 copias | nada |
| > 10 GB | el script escribe `AVISO` en el log (`--aviso-gb`) | SDD nueva: completo semanal + diferencial (`tar --listed-incremental`), o Storage en B2/R2 con el overlay S3 y respaldo entre buckets; se ensaya el restore antes |
| disco local justo | el script se niega a empezar (falla y no late) | liberar `/srv/backups` o bajar `KEEP_LOCAL` |
| cientos de miles de archivos | la lista lee cada archivo una vez en Python | medir la duración antes de que el timer (`TimeoutStartSec=1h`) la corte |

No se comprime: fotos y PDF ya vienen comprimidos, y comprimir solo gasta CPU.

### D5 · Datos personales (`revisar-datos-ve`)

Se copian datos personales a un tercero, Backblaze. El inventario del Storage ya está en `revision-traslado-contabo-2026-10-09.md`: 16 buckets, entre ellos `client-docs` (cédula/RIF), `receipt-photos` (POD y firma), `client-facades`, `payment-proofs` y `bitacora`.

| Punto | Estado | Evidencia |
|---|---|---|
| Cifrado antes de salir del VPS; Backblaze solo ve `.age` | CORRECTO | `infra/ops/backup/storage-backup.sh`: tubería `tar … \| tee … \| age`; prueba C1 |
| Nada en claro en disco local (ni el tar ni la lista) | CORRECTO | prueba C1 (marcas buscadas en disco, remoto y `/dev/shm`, más un `age` espía al empezar y al terminar) y mutante M2 |
| Rutas (pueden traer nombres y el Shipping Mark) fuera del claro | CORRECTO | la lista va cifrada y el manifiesto no tiene rutas (C1); el log y la salida del restore tampoco (C5, M7) |
| Retención 30 días con borrado real | CORRECTO en el script / NO VERIFICABLE en el bucket | `rclone delete --min-age 30d`; el `hard_delete` del remoto es configuración del VPS (`set-remote.sh`), no del repo |
| Un borrado masivo no se lleva los respaldos buenos | CORRECTO | guarda de D2, que falla cerrada; pruebas C6 a C15; mutantes M8 a M23 |
| Clave privada fuera del servidor | CORRECTO | el script rechaza destinatarios con `AGE-SECRET-KEY-` |
| Supresión (CRBV art. 28) | igual que la base | un archivo borrado en vivo desaparece de los respaldos a los 30 días |
| DPA de Backblaze | NO VERIFICABLE | sigue sin leerse ni archivarse (`inventario-terceros.md`) |
| Credencial de subida = credencial de borrado | ENCONTRADO (preexistente) | la misma clave de `rclone.conf` sube y borra; ya figuraba en H7 de la revisión del traslado |

El Worker no leyó el contenido de ningún archivo del Storage. Las cifras de producción son las que midió el Director General: tamaños, conteos y nombres de atributos.

## Aceptación

1. `backup.sh` corre `storage-backup.sh` con la carpeta de `DTD_DATA_DIR` y su remoto, y falla sin latido si ese paso falla (pruebas C4 y M1; `prueba-backup-dtd.sh` en el VPS).
2. El respaldo deja en disco y en el remoto solo `.age` y un manifiesto sin rutas, sin claro intermedio (C1, M2), y el log no trae rutas (C5, M7).
3. La restauración devuelve los mismos archivos, con los mismos sha256 y xattrs `user.*`, que el origen (C2, M3, M6a, M6b). Detecta un cifrado dañado antes de descifrar (C3, M4), una lista que no cuadra (M5) y xattrs distintos en `--verificar`.
4. Una caída del conteo de más de la mitad, o una referencia ilegible, sube el respaldo, no aplica la retención y sale 1 hasta que se acepte con `--aceptar-caida=<conteo exacto>`, con OK nominal de Sam. Esa corrida retiene antes el último respaldo bueno fuera de la retención, en disco y en el remoto. Sin referencia, la comparación es contra el máximo de los manifiestos locales y del remoto, y un `archivos=` fuera de formato frena. Sin un respaldo bueno, o si rclone falla o no deja los 3 archivos en el retenido, no se borra nada (C6 a C15, M8 a M23).
5. `prueba-respaldo-storage.sh` corre en el CI Linux (`pruebas-linux.sh`) y está clasificada en el contrato del workflow.
6. Runbook §1 y §5 describen lo que existe y lo que existirá desde la instalación. Ya no hablan del `rclone sync` de R2 que no existe.
7. Instalación en producción **fuera de esta PR**: queda el guion literal para el OK nominal de Sam.

## Instalación (guion para el OK nominal de Sam; no lo ejecuta el Worker)

Lo pide el Director General **después** de fusionar la PR, con el texto del OK de Sam registrado. Cada bloque dice qué toca. `<SHA>` es el commit de `main` que integró la PR.

**0 · En la PC (Git Bash), desde el checkout de main actualizado.** Lleva al VPS solo los cuatro archivos, desde `main` y no desde la rama, y comprueba sus sha256 en el VPS sin mirarlos a ojo. Si algo sale ✗ o `FAILED`, se para aquí:

Va en un subshell con `set -euo pipefail`: si algo falla, para ahí y no sigue al paso siguiente.

```bash
( set -euo pipefail
  SHA=<SHA>
  git fetch origin
  git merge-base --is-ancestor "$SHA" origin/main || { echo "✗ $SHA NO está en origin/main: PARAR"; exit 1; }
  ARCH="infra/ops/backup/storage-backup.sh infra/ops/backup/storage-restore.sh infra/ops/lib/storage-lista.py infra/dtd-cargo/backup.sh"
  for f in $ARCH; do printf '%s  %s\n' "$(git show "$SHA:$f" | sha256sum | cut -c1-64)" "$f"; done > "$HOME/instalar-0620.sha256"
  git archive "$SHA" $ARCH \
    | ssh root@217.216.54.70 'rm -rf /root/instalar-0620 && mkdir -m 700 /root/instalar-0620 && tar -x -C /root/instalar-0620'
  ssh root@217.216.54.70 'cd /root/instalar-0620 && sha256sum -c -' < "$HOME/instalar-0620.sha256"   # cuatro «OK»
  echo "✓ paso 0 completo" )
```

**1 · En el VPS (`ssh root@217.216.54.70`), solo lectura.** Se para aquí en cualquiera de estos casos:
- falta `age`, `python3` o GNU tar;
- el timer se dispara en menos de 30 min;
- en el `.env`, `PROYECTO` u `OPS_DIR` tienen un valor distinto de `dtd-cargo` y `/srv/ops` (el guion copia ahí), o alguna clave tiene un valor inesperado (abajo);
- ya hay algo bajo `b2:dtdcargo-respaldos/storage/`.

```bash
command -v age python3 && tar --version | head -1 && df -h /srv/backups /dev/shm
ls -l /srv/ops/backup/ /srv/ops/lib/ /srv/dtd-cargo/backup.sh
systemctl list-timers dtd-cargo-backup.timer --no-pager
# Solo estas claves, que no son secretos. Lo esperado: PROYECTO y OPS_DIR ausentes o
# dtd-cargo y /srv/ops; BACKUP_DIR ausente o /srv/backups; DTD_DATA_DIR ausente o ./data;
# BACKUP_STORAGE_* ausentes; BACKUP_RETENTION_DAYS ausente o 30.
grep -E '^(PROYECTO|OPS_DIR|BACKUP_DIR|DTD_DATA_DIR|BACKUP_STORAGE_[A-Z_]+|BACKUP_RETENTION_DAYS|BACKUP_AGE_RECIPIENTS_FILE|RCLONE_CONFIG_DIR)=' /srv/dtd-cargo/.env || echo "(ninguna: valores por omisión)"
# El prefijo del Storage tiene que estar vacío antes de la primera retención.
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro rclone/rclone:1.75.1 lsf -R b2:dtdcargo-respaldos/storage/ | head
```

**2 · Copia de lo que se reemplaza.** Solo `backup.sh`; los otros tres son nuevos:

```bash
S=$(date -u +%Y%m%dT%H%M%SZ); echo "$S" > /root/instalar-0620/SELLO
cp -p /srv/dtd-cargo/backup.sh /srv/dtd-cargo/backup.sh.bak-$S
```

**3 · Primero `/srv/ops`.** El `backup.sh` nuevo exige `storage-backup.sh` (`backup.sh:79`): si se instalara antes, el respaldo de esa noche fallaría entero, base incluida.

```bash
F=/root/instalar-0620/infra
install -o root -g root -m 700 $F/ops/backup/storage-backup.sh /srv/ops/backup/storage-backup.sh
install -o root -g root -m 700 $F/ops/backup/storage-restore.sh /srv/ops/backup/storage-restore.sh
install -o root -g root -m 700 $F/ops/lib/storage-lista.py /srv/ops/lib/storage-lista.py
```

**4 · Dry-run, no escribe nada.** Tiene que decir ~714 archivos y ~515 MB:

```bash
/srv/ops/backup/storage-backup.sh --project dtd-cargo --source /srv/dtd-cargo/data/storage \
  --remote b2:dtdcargo-respaldos/storage --age-recipients /srv/ops/backup/age-recipients.txt \
  --rclone-config /srv/ops/backup/rclone --dry-run
```

**4b · xattrs: el kernel, tmpfs y tar.** Si cualquiera falla, se para aquí: sin xattrs, la restauración serviría los archivos sin su tipo.

```bash
uname -r
tar --help | grep -q -- '--xattrs-include' && echo "✓ tar con xattrs" || echo "✗ tar sin xattrs: PARAR"
python3 -c 'import os; p="/dev/shm/zz-xattr-0620"; open(p, "w").close(); os.setxattr(p, "user.prueba", b"1"); assert os.getxattr(p, "user.prueba") == b"1"; os.remove(p); print("✓ /dev/shm admite xattrs user.*")'
```

**5 · Primera subida, solo del Storage.** No toca la base ni manda latido. Toma el candado del timer y los valores del `.env` con el mismo **bloque de valores** del runbook §5.1. Tiene que terminar en `listo: dtd-cargo-storage-…`:

```bash
cd /srv/dtd-cargo
# Los mismos valores y la misma regla que envget de backup.sh: la última línea de la
# clave, sin las comillas simples o dobles que la rodean; vacío = valor por omisión.
v() { local x; x="$(grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true)"
      case "${x}" in \'*\'|\"*\") x="${x:1:${#x}-2}" ;; esac; printf '%s' "${x:-$2}"; }
P="$(v PROYECTO dtd-cargo)"; OPS="$(v OPS_DIR /srv/ops)"; OUT="$(v BACKUP_DIR /srv/backups)"
DATOS="$(v DTD_DATA_DIR ./data)"; case "${DATOS}" in /*) ;; *) DATOS="/srv/dtd-cargo/${DATOS#./}" ;; esac
REMOTO="$(v BACKUP_STORAGE_RCLONE_REMOTE b2:dtdcargo-respaldos/storage)"; RC="$(v RCLONE_CONFIG_DIR /srv/ops/backup/rclone)"
ARGS=(--project "${P}" --source "$(v BACKUP_STORAGE_DIR "${DATOS%/}/storage")" --remote "${REMOTO}"
      --age-recipients "$(v BACKUP_AGE_RECIPIENTS_FILE /srv/ops/backup/age-recipients.txt)" --rclone-config "${RC}"
      --out "${OUT}" --retention-days "$(v BACKUP_RETENTION_DAYS 30)" --keep-local "$(v BACKUP_STORAGE_KEEP_LOCAL 2)"
      --min-files "$(v BACKUP_STORAGE_MIN_FILES 1)")
printf '%q ' "${OPS}/backup/storage-backup.sh" "${ARGS[@]}"; echo   # revisar antes de seguir: rutas y remoto, ningún secreto
set -o pipefail   # si no, el `| tee` se quedaría con el código de salida
flock -n -E 75 "/run/lock/backup-${P}.lock" "${OPS}/backup/storage-backup.sh" "${ARGS[@]}" 2>&1 \
  | tee -a /var/log/backup-dtd-cargo.log \
  || { rc=$?; [ "${rc}" = 75 ] && echo "✗ candado tomado: el respaldo de la noche está corriendo; esperar y repetir" || echo "✗ salió ${rc}: PARAR y leer el log"; }
```

**6 · Después, `backup.sh`.** No depende de lo que se definió en el paso 3:

```bash
install -o root -g root -m 700 /root/instalar-0620/infra/dtd-cargo/backup.sh /srv/dtd-cargo/backup.sh
/srv/dtd-cargo/backup.sh --dry-run   # solo imprime los comandos del dump
```

**7 · Corrida completa del servicio.** **Ojo:** además del Storage, hace un **dump de la base y de la configuración** y manda el latido, como si el timer corriera antes de su hora. Es un respaldo más del día; tarda minutos. Tiene que terminar en `RESULTADO: PASÓ`:

```bash
systemctl start dtd-cargo-backup.service
tail -n 40 /var/log/backup-dtd-cargo.log
```

**8 · Remoto.** Tienen que aparecer seis archivos (dos respaldos: `.tar.age`, `-lista.age` y `.manifiesto`), sin nada en claro:

```bash
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro rclone/rclone:1.75.1 lsl b2:dtdcargo-respaldos/storage/dtd-cargo/
```

**9 · Restore de prueba:** runbook §5.2. La clave privada la pega Sam en `/dev/shm`, no un agente. `--verificar` y `--destino /dev/shm/storage-restaurado` en `RESULTADO: N PASÓ · 0 FALLÓ`; luego se borra todo.

**10 · Cierre:** `rm -rf /root/instalar-0620`. Se registran fecha, base, conteo y resultado en el runbook §8 y en el handoff.

**Vuelta atrás.** Primero `backup.sh`, porque es el que llama a los otros, y después los scripts nuevos:

```bash
S=$(cat /root/instalar-0620/SELLO)   # o el sello del .bak-<sello> que se ve en ls -l /srv/dtd-cargo/
install -o root -g root -m 700 /srv/dtd-cargo/backup.sh.bak-$S /srv/dtd-cargo/backup.sh
rm -f /srv/ops/backup/storage-backup.sh /srv/ops/backup/storage-restore.sh /srv/ops/lib/storage-lista.py
/srv/dtd-cargo/backup.sh --dry-run   # vuelve a ser el de dos pasos
```

Lo ya subido (cifrado) queda en `${REMOTO}/${P}/` y en `${OUT}/${P}/storage/`, junto con la referencia y, si se llegó a aceptar una caída o a apartar un manifiesto, los prefijos `…-retenido/` y `…-apartado/`. Sin el script no corre su retención, así que no se borra solo. Borrarlo es un borrado permanente, con OK de Sam y prefijo por prefijo:

```bash
# Con el bloque de valores del runbook §5.1 cargado (P, OUT, REMOTO, RC). Los `:?` hacen
# que no corra nada si falta alguno: sin ellos, `rm -rf "${OUT}/${P}/storage"` sería `//storage`.
docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 purge "${REMOTO:?}/${P:?}/"
rm -rf -- "${OUT:?}/${P:?}/storage"
# Solo si existen y Sam lo autoriza aparte: guardan el último respaldo bueno de antes de una caída
# y los manifiestos apartados.
# docker run … purge "${REMOTO:?}/${P:?}-retenido/" ; rm -rf -- "${OUT:?}/${P:?}/storage-retenido"
# docker run … purge "${REMOTO:?}/${P:?}-apartado/" ; rm -rf -- "${OUT:?}/${P:?}/storage-apartado"
```

La unidad `dtd-cargo-backup.service` no se reinstala: en esta PR solo cambia su `Description`.

## Adjuntos

- Handoff: `.agents/handoffs/0620-respaldo-storage-studio.md`.
