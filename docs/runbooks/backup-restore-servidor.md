# Runbook · Backup y restore del servidor propio · SDD-0505

**SDD:** [0505](../specs/0505-dockerizar-dtd-cargo-contabo/spec.md)
**Estado:** borrador operativo; se activa en la Fase 2 de [servidor-contabo.md](servidor-contabo.md) y es condición para la Fase 3
**RPO:** 24 h con el dump diario (objetivo: minutos, cuando exista WAL continuo · §7)
**RTO objetivo:** ≤ 4 h, medido en cada restore de prueba

## 1 · Qué se respalda, dónde y con qué frecuencia

En Supabase Cloud el backup lo hacía el proveedor. En el VPS nadie lo hace por
nosotros, y un backup que nadie restaura no existe: por eso este runbook tiene
un restore mensual obligatorio (§3) y un latido que avisa cuando el dump no
corrió (§2.3).

| Qué | Dónde vive | Cómo se respalda | Frecuencia | Destino |
|---|---|---|---|---|
| Base de datos completa (`public`, `auth`, `storage` (metadata), `vault`, `cron`, `supabase_migrations`) | contenedor `db` de `/srv/dtd-cargo` | `pg-dump-to-s3.sh`: `pg_dump -Fc` + roles, **cifrados con `age`** (los claros solo en `/dev/shm`) | diaria | bucket de backups fuera de Contabo (R2 o B2) |
| Objetos de Storage (fotos, POD, documentos) | R2/B2 (nunca el disco del VPS; `compose.supabase.s3.yml`) | `rclone sync` a un segundo bucket en **otro** proveedor, con `--backup-dir` | semanal | segundo proveedor |
| Adjuntos con archivo inmutable (SDD-0224/0235) | R2 `dtdcargo-attachments-archive-prod` con Bucket Lock | ya cubierto por [adjuntos-backup-antivirus-restore.md](adjuntos-backup-antivirus-restore.md) | continuo | — |
| `.env` del proyecto y **clave raíz de Vault** (`pgsodium_root.key`, volumen `<proyecto>_db-config`) | `/srv/<proyecto>/.env` y el volumen | `config-backup.sh`: `tar` en `/dev/shm` + `age` (§4) | diaria, sube solo si cambió | `<remoto>/<proyecto>-config/` + copia del `.env` en el gestor de contraseñas de Sam |
| Repo y plantillas de correo | GitHub | — | — | ya está versionado |

Los dumps **nunca** se quedan solo en el VPS: un disco de Contabo que se pierde
se lleva el dump local con él. Y nunca se mandan al Object Storage de Contabo
como único destino, por la misma razón (mismo proveedor, misma cuenta).

## 2 · Dump diario

### 2.1 Qué hace el script

`infra/ops/backup/pg-dump-to-s3.sh` corre en el **host** por `cron`, no dentro
del contenedor `cron` de la app. El dump lleva la base completa con datos
personales, así que el cifrado no es opcional (revisión del traslado, H1:
[revision-traslado-contabo-2026-10-09.md](../legal/privacidad/revision-traslado-contabo-2026-10-09.md)):

1. `pg_dump -Fc` y `pg_dumpall --roles-only` (los roles no viajan en el dump)
   se escriben en **`/dev/shm`**: tmpfs, memoria. El claro nunca toca el disco
   ni los snapshots de Contabo.
2. `pg_restore --list` recorre el dump entero para comprobar que se lee.
3. `age -R <destinatarios>` cifra los dos; se borran los claros y el script
   comprueba que no quedó ninguno.
4. `sha256` de los **cifrados**, `rclone copy` (nunca `sync`) a
   `<remoto>:<bucket>/<prefijo>/<proyecto>/`, retención remota con
   `rclone delete --min-age` acotada a ese prefijo y retención local de 7 días.

Sin un archivo de destinatarios válido **no corre**, ni siquiera en `--dry-run`
(rechaza también un archivo vacío o uno con una clave privada). Si el script
muere a la mitad (error, `kill`, corte de SSH), un trap borra la carpeta de
`/dev/shm` y baja los contenedores de esa corrida; rclone tiene plazos
(`--contimeout 30s --timeout 5m --retries 3`) para que un remoto caído haga
fallar el cron en vez de colgarlo.

**Medido en el VPS el 2026-10-09** (contenedores desechables, clave de prueba;
evidencia en el handoff de SDD-0505): remoto y disco con solo `.age` y
`.sha256`; `pg_restore` no lee el `.dump.age`; un cifrado alterado se rechaza
por sha256 sin descifrar; clave equivocada, contraseña mala y `kill` durante la
subida terminan sin dejar nada en `/dev/shm` ni contenedores vivos (el `kill`
corta en 1 s).

Lo que necesita el host, una vez:

```bash
apt-get install -y age                    # 1.1.1 en Ubuntu 24.04
install -d -m 700 /srv/ops/backup /srv/backups
# SOLO las claves públicas: la de Sam (age1… o su ssh-ed25519) y, si la crea,
# una de emergencia guardada fuera de línea. La privada nunca viene al VPS.
install -m 600 /dev/null /srv/ops/backup/age-recipients.txt   # y pegar las públicas
install -d -m 700 /srv/ops/backup/rclone  # rclone.conf, 600, nunca en Git
```

Sam genera su par **en la laptop**, no en el servidor: `age-keygen -o clave-backups-dtd.txt`
(imprime la pública `age1…`); la privada va al gestor de contraseñas y a papel
(§4). El remoto de rclone usa credenciales de **escritura y listado** sobre el
bucket, sin borrado masivo cuando el proveedor lo permite: un atacante dentro del
VPS no debe poder vaciar el bucket (en R2/B2, una regla de ciclo de vida del
propio bucket puede sustituir al `rclone delete`).

DTD Cargo (red interna `dtd-cargo_dtd_internal`, `.env` en `/srv/dtd-cargo`):

```bash
PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' /srv/dtd-cargo/.env | cut -d= -f2-)" \
  /srv/ops/backup/pg-dump-to-s3.sh --project dtd-cargo --network dtd-cargo_dtd_internal \
  --remote r2:dtdcargo-backups/db --age-recipients /srv/ops/backup/age-recipients.txt
/srv/ops/backup/config-backup.sh --project dtd-cargo --remote r2:dtdcargo-backups/db \
  --age-recipients /srv/ops/backup/age-recipients.txt
```

Los proyectos hechos con la plantilla lo llaman todo desde su `backup.sh`.

**Retención.** Lo que el script hace hoy: 30 días en el bucket y 7 en el VPS.
Hasta el 2026-10-09 este runbook prometía además 12 semanales y 12 mensuales que
ningún script implementaba (revisión del traslado, H7). Es una decisión de Sam
(con su abogado: cuánto tiempo guardar copias con datos personales); la
recomendación del Worker es quedarse en 30 días y que la política publicada lo
diga. Hasta que decida, vale lo que hace el script.

### 2.2 Horario

`0 6 * * * /srv/dtd-cargo/backup.sh >> /var/log/backup-dtd-cargo.log 2>&1`
(para DTD, `/srv/dtd-cargo/backup.sh` son los dos comandos de §2.1 con
`set -euo pipefail`; los proyectos de la plantilla ya traen el suyo).

06:00 UTC = 02:00 en Caracas, 14:00 en Yiwu. No hay una hora en la que los dos
equipos duerman (12 h de diferencia); como `pg_dump` no bloquea y la base pesa
69 MB (2026-10-08), la hora importa poco. Si Sam quiere un RPO menor que 24 h
antes de tener WAL continuo (§7), el mismo script se agenda cada 6 h: con ese
tamaño cuesta segundos y centavos.

### 2.3 Latido: un backup mudo no es un backup

El script termina con un `curl` al monitor de tipo **Push** de Uptime Kuma
(`infra/ops/`) **solo si todo lo anterior salió 0**. Si en 26 h no llega el
latido, Uptime Kuma avisa a Sam por Telegram. Un cron que falla en silencio
(sin espacio, `age` sin clave, credenciales del bucket vencidas) se descubre así
el mismo día, no el día que haga falta el restore.

Revisión semanal (2 minutos): `rclone lsl backups:dtdcargo-backups/db/daily/ | tail -7`
muestra 7 archivos de fechas consecutivas y tamaño parecido. Un tamaño que cae
a la mitad es un dump roto aunque el latido haya llegado.

## 3 · Restore de prueba mensual (obligatorio)

El primer lunes de cada mes, en un **contenedor desechable**, no en un staging:
un staging permanente con la copia de producción es justo lo que la revisión
del traslado pidió evitar (H6). `infra/ops/backup/restore-test.sh` levanta un
`supabase/postgres` efímero con PGDATA en **tmpfs** (los datos restaurados viven
en RAM), en una red interna sin puertos, restaura con `restore.sh` como
`supabase_admin` (los event triggers de Supabase exigen superusuario: como
`postgres` salen 88 errores, medido el 2026-10-09), comprueba y destruye todo.

```bash
cd /srv/restores && umask 077
# 1. Bajar el ÚLTIMO dump DESDE EL BUCKET (no la copia local): prueba toda la cadena.
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro -v /srv/restores:/data rclone/rclone:1.75.1 \
  copy r2:dtdcargo-backups/db/dtd-cargo/ /data/ --max-age 26h
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro -v /srv/restores:/data rclone/rclone:1.75.1 \
  copy r2:dtdcargo-backups/db/dtd-cargo-config/ /data/ --max-age 32d
# 2. La clave privada SOLO en memoria, y solo mientras dura la prueba.
install -m 600 /dev/null /dev/shm/clave.txt   # pegar la privada de Sam
# 3. Restore en el contenedor desechable, con la raíz de Vault respaldada.
/srv/ops/backup/restore-test.sh --file dtd-cargo-<stamp>.dump.age --roles dtd-cargo-<stamp>-roles.sql.age \
  --config dtd-cargo-config-<stamp>.tar.age --age-identity /dev/shm/clave.txt --vault-readable \
  --expect auth.users=<cifra de producción> --evidence /srv/ops/evidencias/restore-$(date -u +%Y%m).txt
# 4. Fuera la clave y los cifrados bajados.
rm -f /dev/shm/clave.txt /srv/restores/*.age /srv/restores/*.sha256
```

El script compara el sha256 de cada cifrado antes de descifrar y termina con
PASÓ/FALLÓ por comprobación, el RTO de la prueba y la confirmación de que no
quedó ni el contenedor ni nada en `/dev/shm`. Comprobaciones, cada una con su
cifra en el registro (§8):

1. `--expect` de `auth.users`, `storage.objects`,
   `supabase_migrations.schema_migrations` y de la tabla de embarques: iguales
   a las de producción al momento del dump.
2. `--vault-readable`: todos los secretos de Vault se descifran con la raíz del
   respaldo de configuración. Si falla, el que falló es el respaldo de §4.
3. `select jobname from cron.job` dentro de la prueba (o `--expect cron.job=3`).
4. RTO: desde el `rclone copy` hasta el último PASÓ, en minutos. Si pasa de
   4 h, el procedimiento se corrige antes del mes siguiente.

El smoke con la app (Studio, Portal, una foto) no forma parte de la prueba
mensual: se hace en el ensayo de la Fase 2 y en cada corte.

**Pendiente antes de un DR real (NO VERIFICADO).** `restore-test.sh` restaura en
una base nueva, que no hereda default privileges, así que sus permisos son los
del dump. Un DR de verdad restaura sobre la base `postgres` de un stack nuevo, y
ahí la imagen le da a `supabase_admin` default privileges abiertos en `public`:
los objetos que cree `pg_restore` nacerían con ALL para `anon` y `authenticated`
(el mismo mecanismo medido en el traslado, servidor-contabo.md §2.2). Antes del
primer DR hay que igualar los permisos al dump (o restaurar con esos defaults
cerrados) y comprobarlo con la huella de permisos de `public`.

Un restore que falla **es un incidente**: se arregla la causa antes del
siguiente dump, no se anota «ver el mes que viene».

## 4 · Secretos y configuración

Sin estas dos piezas el dump no sirve entero:

- **La clave raíz de Vault** (`pgsodium_root.key`). Vive en el volumen
  `<proyecto>_db-config`, montado en `/etc/postgresql-custom` del contenedor
  `db`. Con ella se cifran los secretos de `vault.secrets`; sin ella, los de
  cualquier dump quedan ilegibles. **No es `VAULT_ENC_KEY`**: esa variable del
  `.env` es la clave de cifrado de Supavisor (el pooler), no la de Vault. Este
  runbook decía lo contrario hasta el 2026-10-09 (revisión del traslado, H2).
- **El `.env`**: `JWT_SECRET` firma `ANON_KEY`/`SERVICE_ROLE_KEY` y las sesiones,
  `POSTGRES_PASSWORD` abre la base y fija las contraseñas de los roles internos,
  y están las claves de SMTP, S3 y Supavisor.

`infra/ops/backup/config-backup.sh` respalda las dos: reúne `.env` y el volumen
en `/dev/shm`, comprueba que esté `pgsodium_root.key`, cifra con `age` y sube a
`<remoto>/<proyecto>-config/`, un prefijo propio que la retención de los dumps
no toca (el script no borra nada remoto; en el VPS conserva los 8 más nuevos).
Solo sube cuando algo cambió, así que corre a diario detrás del dump sin llenar
el bucket. Imprime la **huella sha256** de la raíz (no la raíz): se anota en el
registro y sirve para comprobar, después de un restore, que el servidor nuevo
tiene la misma.

Restaurar la configuración en un servidor nuevo (clave privada en `/dev/shm`):

```bash
mkdir -m 700 /dev/shm/cfg
age -d -i /dev/shm/clave.txt dtd-cargo-config-<stamp>.tar.age | tar -x -C /dev/shm/cfg
install -m 600 /dev/shm/cfg/env/.env /srv/dtd-cargo/.env
docker volume create dtd-cargo_db-config
tar -C /dev/shm/cfg/volume -cf - . | docker run --rm -i -v dtd-cargo_db-config:/dst \
  --entrypoint tar supabase/postgres:17.6.1.136 -C /dst -xf -
rm -rf /dev/shm/cfg /dev/shm/clave.txt
```

…y recién entonces `docker compose up -d db`: si la base arranca antes sin ese
volumen, genera una raíz nueva y los secretos del dump no se podrán leer.

**Secretos de Vault al pasar de Cloud al VPS.** Cloud no entrega su clave raíz,
así que los secretos que vienen en el dump de Cloud llegan ilegibles. Medido el
2026-10-09 (metadatos, sin leer valores): Vault tiene `kommo_cron_key` y
`kommo_token_dtd_v1`, los dos **regenerables** (la clave de cron se genera de
nuevo y el token lo vuelve a emitir Sam en Kommo), y `no_olvidar` no guarda
nada en Vault. Por eso no hace falta la raíz de Cloud: en el VPS se reescriben
con `vault.update_secret` sobre el mismo id (servidor-contabo.md §2.2).

Además:

- Sam guarda el `.env` de producción en su gestor de contraseñas el día del
  corte y cada vez que cambie. Es la copia que sobrevive si Contabo y el bucket
  fallan a la vez.
- La clave privada `age` de Sam vive en el gestor de contraseñas y en un papel
  en la caja fuerte. Nunca en el VPS (salvo en `/dev/shm` mientras dura un
  restore), nunca en el repo, nunca en un chat. En el servidor solo está
  `/srv/ops/backup/age-recipients.txt` con las públicas.

## 5 · Objetos de Storage

Los binarios ya no están en un disco: el overlay `compose.supabase.s3.yml` pone
Storage sobre R2 (o B2). El riesgo no es el disco, es un borrado (humano o de un
atacante con la `SERVICE_ROLE_KEY`) o la pérdida de la cuenta del proveedor.

- Semanal: `rclone sync r2:dtdcargo-storage b2:dtdcargo-storage-copia --backup-dir b2:dtdcargo-storage-borrados/$STAMP`.
  El `--backup-dir` conserva 30 días lo que se borró en el origen, así un
  borrado se deshace con un `rclone copy` de vuelta.
- Mensual, junto con §3: `rclone size` de origen y copia, y abrir desde la
  copia un objeto por bucket.
- Los adjuntos con recibo inmutable siguen bajo su runbook propio; este no lo
  sustituye ni lo repite.

## 6 · Snapshots de Contabo: conveniencia, no backup

El Cloud VPS 8 incluye 3 snapshots. Se usan **antes de un cambio arriesgado**
(actualizar Docker, subir el compose de Supabase, una major de Postgres): si
sale mal, se vuelve en minutos. No cuentan como backup, por tres razones que no
se arreglan con disciplina: viven en el **mismo proveedor y el mismo host**, se
**borran solos a los 30 días** y **no se restauran en otro servidor**. El add-on
«Auto Backup» de Contabo tiene el primer problema igual; si Sam lo contrata, es
una capa más, no un sustituto de §2.

## 7 · Pendiente antes del corte: WAL continuo (pgBackRest)

El dump diario deja un RPO de 24 h: un disco que muere a las 17:00 pierde el
día. Para llevarlo a minutos hace falta archivar el WAL de Postgres al bucket
(`archive_command`) y poder restaurar a un instante (PITR). La herramienta
estándar es **pgBackRest** (alternativa: `wal-g`). La imagen
`supabase/postgres:17.6.1.136` no la trae: hace falta un sidecar que comparta
el directorio de WAL del contenedor `db`, o compilarla en una imagen derivada,
y ensayar el PITR en staging.

La spec SDD-0505 lo deja **fuera de la Fase 0** a propósito. Decisión que Sam
toma antes de la Fase 3, por escrito en el OK del corte:

- (a) implementar pgBackRest en la Fase 2 y cortar con RPO de minutos, o
- (b) cortar con el dump cada 6 h (§2.2) y aceptar ese RPO hasta que exista el
  WAL continuo, con fecha límite.

## 8 · Registro de restores de prueba

| Fecha | Dump usado (nombre) | `auth.users` | `storage.objects` | ledger | Vault legible | RTO (min) | Resultado | Quién |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | pendiente (arranca en la Fase 2) | — |
