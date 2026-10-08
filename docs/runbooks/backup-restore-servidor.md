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
| Base de datos completa (`public`, `auth`, `storage` (metadata), `vault`, `cron`, `supabase_migrations`) | contenedor `db` de `/srv/dtd-cargo` | `pg_dump -Fc` + roles, cifrado con `age` | diaria | bucket de backups fuera de Contabo (R2 o B2) |
| Objetos de Storage (fotos, POD, documentos) | R2/B2 (nunca el disco del VPS; `compose.supabase.s3.yml`) | `rclone sync` a un segundo bucket en **otro** proveedor, con `--backup-dir` | semanal | segundo proveedor |
| Adjuntos con archivo inmutable (SDD-0224/0235) | R2 `dtdcargo-attachments-archive-prod` con Bucket Lock | ya cubierto por [adjuntos-backup-antivirus-restore.md](adjuntos-backup-antivirus-restore.md) | continuo | — |
| Secretos y configuración: `.env` de cada proyecto, `/etc/dokploy/traefik`, `supabase/volumes` | `/srv/<proyecto>` | `tar` + `age` | semanal y en cada cambio | bucket `config/` + copia del `.env` en el gestor de contraseñas de Sam |
| Repo y plantillas de correo | GitHub | — | — | ya está versionado |

Los dumps **nunca** se quedan solo en el VPS: un disco de Contabo que se pierde
se lleva el dump local con él. Y nunca se mandan al Object Storage de Contabo
como único destino, por la misma razón (mismo proveedor, misma cuenta).

## 2 · Dump diario

### 2.1 Qué hace el script

`infra/ops/backup/pg-dump-to-s3.sh` (entregable 6 de la spec) corre en el
**host**, por `cron` del usuario `deploy`, no dentro del contenedor `cron` de la
app. Pasos, para poder correrlos a mano si el script no está:

```bash
cd /srv/dtd-cargo
STAMP=$(date -u +%Y%m%d-%H%MZ)
# Roles y base. pg_dump toma un snapshot consistente y no bloquea la app.
docker compose exec -T db pg_dumpall -U postgres --roles-only > backups/roles-$STAMP.sql
docker compose exec -T db pg_dump    -U postgres -Fc postgres > backups/dtd-cargo-$STAMP.dump
# ¿Es restaurable? Un dump truncado lista cero objetos.
test "$(pg_restore --list backups/dtd-cargo-$STAMP.dump | wc -l)" -gt 100
sha256sum backups/dtd-cargo-$STAMP.dump backups/roles-$STAMP.sql > backups/$STAMP.sha256
# Cifrado con la clave pública de Sam; la privada NO está en el servidor.
age -r "$BACKUP_AGE_RECIPIENT" -o backups/dtd-cargo-$STAMP.dump.age backups/dtd-cargo-$STAMP.dump
age -r "$BACKUP_AGE_RECIPIENT" -o backups/roles-$STAMP.sql.age      backups/roles-$STAMP.sql
rm backups/dtd-cargo-$STAMP.dump backups/roles-$STAMP.sql
# Fuera de Contabo. `copy`, no `sync`: nunca borra lo que ya está en el bucket.
rclone copy backups/ backups:dtdcargo-backups/db/daily/ --include "*$STAMP*"
# Retención: 7 días en el VPS; 30 diarios, 12 semanales y 12 mensuales en el bucket.
find backups/ -name '*.age' -mtime +7 -delete
rclone delete backups:dtdcargo-backups/db/daily/ --min-age 30d
```

Los domingos el mismo script copia además a `db/weekly/` (retención 12
semanas) y el día 1 de cada mes a `db/monthly/` (12 meses).

Variables que necesita (en `/srv/ops/backup/.env`, `0600`, nunca en el repo):
`BACKUP_AGE_RECIPIENT` (clave pública `age1...` de Sam), y el remoto `backups:`
configurado en `rclone config` con credenciales de **solo escritura y listado**
sobre el bucket (sin permiso de borrado masivo: un atacante que entre al VPS no
debe poder vaciar el bucket; el `rclone delete` de retención usa una regla de
ciclo de vida del propio bucket cuando el proveedor la ofrece).

### 2.2 Horario

`0 6 * * * /srv/ops/backup/pg-dump-to-s3.sh >> /srv/dtd-cargo/backups/backup.log 2>&1`

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

El primer lunes de cada mes, sobre el stack de **staging**
(`/srv/dtd-cargo-staging`), nunca sobre producción. `infra/ops/backup/restore.sh`
hace esto; a mano:

```bash
cd /srv/dtd-cargo-staging
# 1. Bajar el ÚLTIMO dump DESDE EL BUCKET (no la copia local): prueba toda la cadena.
rclone copy backups:dtdcargo-backups/db/daily/ restore/ --include "*$(date -u +%Y%m%d)*"
# 2. Descifrar con la clave privada de Sam (la pega en la sesión, no queda en disco).
age -d -i /dev/stdin -o restore/dtd-cargo.dump restore/dtd-cargo-*.dump.age
sha256sum -c restore/*.sha256
# 3. Base de staging desde cero y restore.
docker compose stop web cron && docker compose exec -T db dropdb -U postgres --force postgres && docker compose exec -T db createdb -U postgres postgres
docker compose exec -T db psql -U postgres -f - < restore/roles.sql
docker compose exec -T db pg_restore -U postgres -d postgres --no-owner --role=postgres restore/dtd-cargo.dump
docker compose up -d
```

Comprobaciones, cada una con su cifra en el registro (§8):

1. `select count(*) from auth.users`, `from storage.objects`,
   `from supabase_migrations.schema_migrations` y de la tabla de embarques:
   iguales a las de producción al momento del dump.
2. `select name from vault.secrets` lista `functions_base_url` y
   `select convert_from(decrypted_secret, 'utf8') ...` **se puede leer**: si da
   error, el `VAULT_ENC_KEY` del `.env` de staging no es el de producción y el
   backup de configuración (§4) es el que falló.
3. `select jobname from cron.job`: los 3 jobs.
4. Smoke: un admin entra al Studio de staging, abre un embarque, ve una foto
   (Storage apunta al bucket de staging, copia del real) y el Portal abre un
   enlace `token_hash`.
5. RTO medido: desde el `rclone copy` hasta el smoke verde, en minutos. Si pasa
   de 4 h, el procedimiento se corrige antes del mes siguiente.

Un restore que falla **es un incidente**: se arregla la causa antes del
siguiente dump, no se anota «ver el mes que viene».

## 4 · Secretos y configuración

Sin el `.env` el dump no sirve: `VAULT_ENC_KEY` descifra `vault.secrets`,
`JWT_SECRET` firma `ANON_KEY`/`SERVICE_ROLE_KEY` y las sesiones,
`POSTGRES_PASSWORD` abre la base. Son irreemplazables.

- Semanal, y en cada cambio del `.env`: `tar czf - /srv/*/.env /srv/*/supabase/volumes /etc/dokploy/traefik | age -r "$BACKUP_AGE_RECIPIENT" > config-$STAMP.tar.gz.age` y `rclone copy` a `config/`.
- Además, Sam guarda el `.env` de producción en su gestor de contraseñas el
  día del corte y cada vez que cambie. Es la copia que sobrevive si Contabo y
  el bucket fallan a la vez.
- La clave privada `age` de Sam vive en el gestor de contraseñas y en un papel
  en la caja fuerte. Nunca en el VPS, nunca en el repo, nunca en un chat.

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
