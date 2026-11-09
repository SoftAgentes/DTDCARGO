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

> Los archivos del Storage de producción (cédulas, fotos, POD, comprobantes) salen cada día del VPS cifrados con `age` hacia Backblaze B2, igual que la base. Se pueden comprobar y restaurar con un script que verifica cada archivo.

## Contexto

Lo midió el Director General el 2026-11-09 a las ~05:10Z en el VPS (Contabo, `217.216.54.70`):

| Hecho | Valor |
|---|---|
| Backend de storage-api | `dtd-cargo-storage-1` con `STORAGE_BACKEND=file`, bind de `/srv/dtd-cargo/data/storage` a `/var/lib/storage` |
| Tamaño | ~515 MB, 714 archivos |
| Overlay `compose.supabase.s3.yml` | **no** está activo |
| Remotos de rclone | un solo `[b2]` (`type = b2`) en `/srv/ops/backup/rclone/rclone.conf` |
| Respaldo diario | `/srv/dtd-cargo/backup.sh` (timer `dtd-cargo-backup`, ~07:05 CET): `pg-dump-to-s3.sh` → `b2:dtdcargo-respaldos/db` y `config-backup.sh` (`.env` + `db-config`; acepta `--include`, sin uso). **Ninguno toca `data/storage`** |
| Única copia de esos bytes fuera de la carpeta | Auto Backup de Contabo: mismo proveedor, y Contabo reporta su restauración degradada |

El dump trae `storage.objects` (la metadata), pero no los bytes. La revisión del traslado ya lo había marcado (`docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md`, H11): con el backend en `file`, los objetos quedan «fuera de todo respaldo». Además, `docs/runbooks/backup-restore-servidor.md` §5 describía un `rclone sync r2:dtdcargo-storage b2:dtdcargo-storage-copia` semanal que nunca existió.

Sam autorizó el 2026-11-09, con sus palabras: «si prepara un pr el respaldo cifrado». Instalarlo en producción es un paso aparte, con OK nominal (§Instalación).

## Alcance

1. `infra/ops/backup/storage-backup.sh` (nuevo): respaldo cifrado del Storage.
2. `infra/ops/backup/storage-restore.sh` (nuevo): comprobación y restauración.
3. `infra/ops/lib/storage-lista.sh` (nuevo): la lista por archivo, compartida por los dos.
4. `infra/dtd-cargo/backup.sh`: tercer paso, después del dump y de la configuración.
5. `infra/dtd-cargo/systemd/dtd-cargo-backup.service`: solo la descripción.
6. Pruebas: `infra/ops/tests/prueba-respaldo-storage.sh` (nueva, en el CI Linux, con mutantes) y `infra/ops/tests/prueba-backup-dtd.sh` (VPS, adaptada al tercer paso).
7. Documentación: `docs/runbooks/backup-restore-servidor.md` (§1, fila del Storage, y §5), `infra/ops/README.md`, `infra/dtd-cargo/README.md` y `docs/legal/privacidad/inventario-terceros.md` (fila de Backblaze).

Fuera de alcance: instalar en el VPS, cambiar el `.env` de producción, pasar el Storage a S3/B2 y las líneas `r2:` de la base en §2/§3 del runbook, que son de otra tarea.

## Diseño

### D1 · Paso propio `tar | age`, no `config-backup.sh --include`

`config-backup.sh --include` **copia** el contenido a `/dev/shm` antes de cifrar. Son 515 MB de RAM, y sube solo cuando cambia la huella, con 8 copias locales y sin retención remota. El Storage pide otra cosa: que el claro no toque ningún disco, que se respalde completo todos los días y que tenga retención propia. Por eso va en un paso propio, con el modelo de `infra/chatwoot/respaldo.sh` (`tar` del contenedor directo a `age`).

Un solo `tar -C <origen> --numeric-owner -cf - .` alimenta, por `tee` y FIFOs en `/dev/shm`, a tres consumidores:

| Consumidor | Sale | En claro en disco |
|---|---|---|
| `age -R <destinatarios>` | `<base>.tar.age` | no |
| `tar -xf - --to-command=…` → `age` | `<base>-lista.age`: `sha256 bytes ruta` por archivo regular | no |
| `sha256sum` | huella del flujo descifrado (al manifiesto) | no (solo la huella, en RAM) |

La lista sale de **los mismos bytes** que se cifran: no hay carrera entre «listar» y «empaquetar», y el restore compara contra exactamente lo que se respaldó. Va cifrada porque las rutas pueden traer nombres de personas (p. ej. un archivo subido como `cedula-<nombre>.jpg`).

`<base>.manifiesto` va en claro y **sin rutas**: sello, `archivos`, `bytes`, `archivos_en_disco` (conteo de metadatos al empezar), `aviso_tar`, `flujo_sha256` y el sha256 de los dos `.age`, en formato de `sha256sum -c`.

Consistencia: storage-api sigue sirviendo mientras corre. Si tar sale 1 («file changed as we read it»), el respaldo sigue con `aviso_tar=1`: la lista sale del mismo flujo. Con tar ≥ 2, falla. Primero va la base y después los archivos, así que un archivo subido entre las dos copias queda huérfano, que es inofensivo. RPO: 24 h.

### D2 · Destino, retención, sha256 y verificación

- **Destino:** `b2:dtdcargo-respaldos/storage/dtd-cargo/` (`BACKUP_STORAGE_RCLONE_REMOTE`, por omisión `b2:dtdcargo-respaldos/storage`). Es un prefijo propio, fuera de `db/`, así que la retención de los dumps no lo toca, ni esta la de ellos. El remoto se valida como `<remoto>:<bucket>/<prefijo>`, nunca la raíz.
- **Subida:** `rclone copy` de los tres archivos (nunca `sync`) y `rclone check --one-way --include "/<base>*"`.
- **Retención:** `rclone delete --min-age 30d` acotado al prefijo, la misma que la base (decisión de Sam en la revisión del traslado; borrado real por `hard_delete`). En disco local, los 2 respaldos más nuevos (`BACKUP_STORAGE_KEEP_LOCAL`), porque cada uno pesa lo que el origen.
- **Guardas:** destinatarios válidos y sin clave privada, también en `--dry-run`. Al menos `BACKUP_STORAGE_MIN_FILES` (1) archivos: una carpeta vacía o equivocada **falla** y no late. Espacio libre ≥ origen + 10 % + 100 MB. GNU tar.
- **Fallo:** si `storage-backup.sh` sale ≠ 0, `backup.sh` termina en FALLÓ y no manda el latido. Un Storage sin respaldo se nota igual que una base sin respaldo.

### D3 · Prueba de restauración en un directorio desechable

`storage-restore.sh` trabaja sobre los tres archivos bajados del bucket:

- `--verificar`: descifra y recorre el flujo con `tar --to-command` **sin escribir ningún archivo**.
- `--destino <carpeta>`: restaura en una carpeta vacía o inexistente y nunca encima de nada. Para la prueba mensual se usa `/dev/shm/storage-restaurado`, que es desechable y cabe en RAM con 515 MB. Para un restore real, una carpeta nueva al lado de `data/storage`, y después el cambio de carpeta con storage-api detenido (runbook §5.3).

Las dos comprueban, con PASÓ/FALLÓ por línea: sha256 de los `.age` **antes** de descifrar, descifrado y tar sin errores, huella del flujo, lista restaurada = lista respaldada (rutas, bytes y sha256 de cada archivo), y conteo y bytes = manifiesto. La lista descifrada y la clave viven solo en `/dev/shm` y un trap las borra.

### D4 · Si el Storage crece

| Tamaño | Qué pasa | Qué hacer |
|---|---|---|
| ≤ 10 GB | completo diario; ≤ 300 GB en el bucket con 30 copias | nada |
| > 10 GB | el script escribe `AVISO` en el log (`--aviso-gb`) | SDD nueva: completo semanal + diferencial (`tar --listed-incremental`), o Storage en B2/R2 con el overlay S3 y respaldo entre buckets; se ensaya el restore antes |
| disco local justo | el script se niega a empezar (falla y no late) | liberar `/srv/backups` o bajar `KEEP_LOCAL` |
| cientos de miles de archivos | la lista corre un `sha256sum` por archivo | medir la duración antes de que el timer (`TimeoutStartSec=1h`) la corte |

No se comprime: fotos y PDF ya vienen comprimidos, y comprimir solo gasta CPU.

### D5 · Datos personales (`revisar-datos-ve`)

Se copian datos personales a un tercero, Backblaze. El inventario del Storage ya está en `revision-traslado-contabo-2026-10-09.md`: 16 buckets, entre ellos `client-docs` (cédula/RIF), `receipt-photos` (POD y firma), `client-facades`, `payment-proofs` y `bitacora`.

| Punto | Estado | Evidencia |
|---|---|---|
| Cifrado antes de salir del VPS; Backblaze solo ve `.age` | CORRECTO | `infra/ops/backup/storage-backup.sh`: tubería `tar … \| tee … \| age`; prueba C1 |
| Nada en claro en disco local (ni el tar ni la lista) | CORRECTO | prueba C1 (marcas buscadas en disco, remoto y `/dev/shm`, más un `age` espía) y mutante M2 |
| Rutas (pueden traer nombres) fuera del claro | CORRECTO | la lista va cifrada y el manifiesto no tiene rutas; prueba C1 busca un nombre sembrado |
| Retención 30 días con borrado real | CORRECTO en el script / NO VERIFICABLE en el bucket | `rclone delete --min-age 30d`; el `hard_delete` del remoto es configuración del VPS (`set-remote.sh`), no del repo |
| Clave privada fuera del servidor | CORRECTO | el script rechaza destinatarios con `AGE-SECRET-KEY-` |
| Supresión (CRBV art. 28) | igual que la base | un archivo borrado en vivo desaparece de los respaldos a los 30 días |
| DPA de Backblaze | NO VERIFICABLE | sigue sin leerse ni archivarse (`inventario-terceros.md`) |
| Credencial de subida = credencial de borrado | ENCONTRADO (preexistente) | la misma clave de `rclone.conf` sube y borra; ya figuraba en H7 de la revisión del traslado |

El Worker no leyó el contenido de ningún archivo del Storage. Las cifras de producción son las que midió el Director General, solo tamaños y conteos.

## Aceptación

1. `backup.sh` corre `storage-backup.sh` con la carpeta de `DTD_DATA_DIR` y su remoto, y falla sin latido si ese paso falla (pruebas C4 y M1; `prueba-backup-dtd.sh` en el VPS).
2. El respaldo deja en disco y en el remoto solo `.age` y un manifiesto sin rutas, sin claro intermedio (C1, M2).
3. La restauración devuelve los mismos archivos, con los mismos sha256, que el origen (C2, M3), y detecta un cifrado dañado antes de descifrar (C3, M4) y una lista que no cuadra (M5).
4. `prueba-respaldo-storage.sh` corre en el CI Linux (`pruebas-linux.sh`) y está clasificada en el contrato del workflow.
5. Runbook §1 y §5 describen lo que existe. Ya no hablan del `rclone sync` de R2 que no existe.
6. Instalación en producción **fuera de esta PR**: queda el guion para el OK nominal de Sam.

## Instalación (guion para el OK nominal de Sam; no lo ejecuta el Worker)

Lo pide el Director General. Cada paso dice lo que toca.

1. **Solo lectura:** `command -v age && tar --version | head -1` (age y GNU tar en el host) y `df -h /srv/backups /dev/shm`. Los scripts se copian desde el SHA de `main` que integró esta PR, con el mecanismo de copia a `/srv/ops` que el Director General use hoy. No se copian desde esta rama.
2. **Copiar** `infra/ops/backup/storage-backup.sh`, `infra/ops/backup/storage-restore.sh` y `infra/ops/lib/storage-lista.sh` a `/srv/ops/…`, y `infra/dtd-cargo/backup.sh` y `infra/dtd-cargo/systemd/dtd-cargo-backup.service` a sus lugares (`/srv/dtd-cargo/backup.sh`, `/etc/systemd/system/`; `systemctl daemon-reload`), con modo 700 para los scripts y dueño root. Antes, respaldo de los archivos que se reemplazan (`cp -p backup.sh backup.sh.bak-<fecha>`). El `.env` no cambia: los valores por omisión son los de producción (`DTD_DATA_DIR=./data`, remoto `b2:dtdcargo-respaldos/storage`).
3. **Dry-run, no escribe nada:** `/srv/ops/backup/storage-backup.sh --project dtd-cargo --source /srv/dtd-cargo/data/storage --remote b2:dtdcargo-respaldos/storage --age-recipients /srv/ops/backup/age-recipients.txt --dry-run`. Tiene que decir ~714 archivos y ~515 MB.
4. **Primera corrida a mano:** `systemctl start dtd-cargo-backup.service` y después `tail -n 40 /var/log/backup-dtd-cargo.log`. Tiene que terminar en `RESULTADO: PASÓ` y la línea `listo: dtd-cargo-storage-…`.
5. **Remoto:** `rclone lsl b2:dtdcargo-respaldos/storage/dtd-cargo/` con el contenedor de §3. Tienen que aparecer tres archivos, sin nada en claro.
6. **Restore de prueba:** runbook §5.2, con la clave privada de Sam en `/dev/shm` mientras dura. `--verificar` y `--destino /dev/shm/storage-restaurado` en `RESULTADO: N PASÓ · 0 FALLÓ`. Luego se borra todo. La clave la pega Sam, no un agente.
7. **Registro:** fecha, base, conteo y resultado en el runbook §8 y en el handoff.

Vuelta atrás: restaurar `backup.sh.bak-<fecha>`. Los scripts nuevos no se llaman sin ese `backup.sh` y no tocan nada más.

## Adjuntos

- Handoff: `.agents/handoffs/0620-respaldo-storage-studio.md`.
