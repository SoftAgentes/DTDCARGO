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
| Archivos de Storage (cédulas, fotos, POD, comprobantes, documentos) | disco del VPS: `/srv/dtd-cargo/data/storage` (storage-api con `STORAGE_BACKEND=file`; el overlay `compose.supabase.s3.yml` **no** está activo) | `storage-backup.sh` desde `backup.sh`: `tar` con los xattrs `user.*` por tuberías a `age`, **sin copia en claro**, lista por archivo cifrada y manifiesto sin rutas (§5, SDD-0620) | diaria, completa, **desde la instalación (pendiente de OK de Sam)**; hasta entonces, solo el Auto Backup de Contabo | `b2:dtdcargo-respaldos/storage/dtd-cargo/`, 30 días |
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
   ni los snapshots de Contabo. Al lado va `<x>-acl.sql`: los permisos de
   `public` para `anon`, `authenticated`, `service_role` y `PUBLIC`, con su huella
   en la primera línea (`infra/ops/lib/acl.sh`; para qué sirve, §3).
2. `pg_restore --list` recorre el dump entero para comprobar que se lee.
3. `age -R <destinatarios>` cifra los tres; se borran los claros y el script
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

**Retención: 30 días en el bucket y 7 en el VPS** (decisión de Sam del
2026-10-09, respuesta «30 días»). Es lo que hace el script. Hasta esa fecha
este runbook prometía además 12 semanales y 12 mensuales que ningún script
implementaba (revisión del traslado, H7); ya no. Consecuencia que la política
publicada debe decir: una persona que pide borrar sus datos desaparece de la
base viva en el acto y de los respaldos a los 30 días. Cambiar la retención es
una decisión de Sam, no un ajuste técnico.

### 2.2 Horario

DTD Cargo usa un **timer de systemd**, no una línea de cron
(`infra/dtd-cargo/systemd/dtd-cargo-backup.timer`, instalado en el VPS el
2026-10-13): `OnCalendar=*-*-* 06:00:00 UTC` con la zona explícita, porque el
reloj del VPS está en `Europe/Berlin` y un cron a secas correría a otra hora;
`Persistent=true` recupera la corrida si el servidor estaba apagado. El service
corre `/srv/dtd-cargo/backup.sh` y escribe en `/var/log/backup-dtd-cargo.log`
(rotado por logrotate, 12 meses). `backup.sh` envuelve los dos comandos de §2.1
con los valores del `.env`, toma un candado (`flock`) para que dos corridas no
se pisen, y mientras exista `NO-ENCENDER-HASTA-EL-CORTE.txt` sale 0 diciendo
«producción apagada»: el timer queda encendido desde antes del corte. Los
proyectos de la plantilla siguen con su `backup.sh` en el cron del host.

```bash
systemctl list-timers dtd-cargo-backup.timer   # próxima corrida
systemctl start dtd-cargo-backup.service       # una corrida a mano
tail -n 20 /var/log/backup-dtd-cargo.log
```

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

**Hecho el 2026-10-13:** Uptime Kuma corre en `https://vps.dtdcargo.com` (usuario
admin de Sam) con el monitor Push «Respaldo diario DTD · latido» (#3, cada
93.600 s = 26 h, 0 reintentos). Su URL de push está en `BACKUP_HEARTBEAT_URL`
del `.env` de producción (600; no va en Git) y `backup.sh` la llama al terminar
bien. Un latido de prueba a mano devolvió `{"ok":true}`. **El monitor queda en
pausa hasta el corte** (producción apagada no late y avisaría cada día): el
día del corte, al encender producción, se reanuda desde el panel («Reanudar»)
y se comprueba que la primera corrida a mano lo deje en verde.

Revisión semanal (2 minutos), en el VPS. `rclone` no está instalado en el host:
corre en el contenedor de `pg-dump-to-s3.sh`, con su configuración en solo lectura.
La sección del `rclone.conf` es `[b2]` y el remoto por defecto de `backup.sh` es
`b2:dtdcargo-respaldos/db` (`BACKUP_RCLONE_REMOTE`):

```bash
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro rclone/rclone:1.75.1 \
  lsl b2:dtdcargo-respaldos/db/dtd-cargo/ --include '*.dump.age' | sort -k2,3 | tail -7
```

Tiene que mostrar 7 archivos de fechas consecutivas y tamaño parecido. Un tamaño
que cae a la mitad es un dump roto aunque el latido haya llegado. La
configuración va aparte, en `b2:dtdcargo-respaldos/db/dtd-cargo-config/`. Hasta
el 2026-10-20 este runbook decía `backups:dtdcargo-backups/db/daily/`, un remoto
que no existe.

## 3 · Restore de prueba mensual (obligatorio)

El primer lunes de cada mes, en un **contenedor desechable**, no en un staging:
un staging permanente con la copia de producción es justo lo que la revisión
del traslado pidió evitar (H6). `infra/ops/backup/restore-test.sh` levanta un
`supabase/postgres` efímero con PGDATA en **tmpfs** (los datos restaurados viven
en RAM), en una red interna sin puertos, restaura con `restore.sh` como
`supabase_admin` (los event triggers de Supabase exigen superusuario: como
`postgres` salen 88 errores, medido el 2026-10-09), comprueba y destruye todo.

**El restore sale del dump, no de las migraciones.** `restore.sh` y
`restore-test.sh` (también con `--dr`) hacen `pg_restore --clean --if-exists` de un
`pg_dump -Fc` de la base entera, sin filtrar esquemas. Ese dump trae `auth` y
`storage` con sus tablas, sus policies y el estado de su RLS, y `--clean` reemplaza
lo que GoTrue o storage-api hayan creado al arrancar, así que el orden de arranque
no importa. Distinto es **reconstruir la base desde las migraciones** con GoTrue y
storage-api ya arriba: la 0038 falla («relation "public.instances" does not
exist») porque esos servicios dejan RLS encendida en sus tablas. Para eso hay que
seguir el procedimiento del entorno de prueba (SDD-0540, `plataforma-prueba.sql`
antes de las migraciones y `plataforma-prueba-cierre.sql` después). Hallazgo de la
Fase 1 de la 0540, 2026-10-16.

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
3. `select jobname from cron.job`: **no se puede en base nueva ni con `--dr`**, porque
   `pg_cron` solo se crea en la base `postgres` (ver «Qué no se restaura igual»). Se
   comprueba en un restore sobre `--target postgres`.
4. Event triggers (SDD-0594): `restore.sh` informa «iguales» contra el índice del
   dump, el dump trae `ensure_rls` y una tabla nueva de `public` nace con RLS. Si
   falla alguna, el resultado es FALLÓ aunque lo demás pase.
5. RTO: desde el `rclone copy` hasta el último PASÓ, en minutos. Si pasa de
   4 h, el procedimiento se corrige antes del mes siguiente.

El smoke con la app (Studio, Portal, una foto) no forma parte de la prueba
mensual: se hace en el ensayo de la Fase 2 y en cada corte.

**Permisos de `public` en un DR (medido el 2026-10-11).** Un DR de verdad
restaura sobre la base `postgres` de un stack nuevo, y ahí la imagen le da a
`supabase_admin` default privileges abiertos en `public`: los objetos que crea
`pg_restore` nacen con ALL para `anon` y `authenticated`, y el dump no lo
revierte (solo emite lo que difiere de `acldefault`). Es el mismo mecanismo
medido en el traslado (servidor-contabo.md §2.2). Por eso:

- `pg-dump-to-s3.sh` guarda `<x>-acl.sql.age` junto al dump (§2.1).
- `restore.sh` lo busca al lado del dump (o `--acl`), lo aplica en una
  transacción y compara la huella de permisos con la del origen. Si no
  coinciden sale **8**: esa base no se expone a PostgREST hasta igualarla.
- Sobre un destino destructivo (la base viva), sin archivo de permisos, el
  script rechaza (3) antes de pedir la confirmación; `--skip-acl` existe solo
  para igualarlos a mano.
- `restore-test.sh` exige «permisos iguales» en cada prueba mensual, y `--dr`
  restaura sobre una copia de la base `postgres` de la imagen, con sus default
  privileges: es la condición del DR.

Prueba en el VPS (`infra/ops/tests/prueba-traslado-y-respaldos.sh`, origen
sintético con permisos como los de producción, 60 PASÓ · 0 FALLÓ):

| Corrida | Huella del origen | Huella restaurada | Resultado |
|---|---|---|---|
| Base nueva (prueba mensual) | `35:b5acf91e…` | `35:b5acf91e…` | iguales |
| `--dr --acl-verify-only` (control rojo) | `35:b5acf91e…` | `52:2abba70b…` | DISTINTOS: 17 permisos de más |
| `--dr` (igualando) | `35:b5acf91e…` | `35:b5acf91e…` | iguales |

La prueba mensual corre en base nueva; una vez por trimestre conviene agregarle
`--dr` para ensayar la condición real.

### Event triggers: `ensure_rls` no sale del dump (SDD-0594)

`ensure_rls` activa RLS en toda tabla nueva de `public`. Hasta la SDD-0594, una
restauración dejaba la base sin él y lo único que quedaba era una advertencia: las
pruebas reales del 14 y del 29 de octubre traían sus dos errores y salieron 5 de 5.
El corte y el rehacer de prueba del 2026-11-02 lo recrearon a mano.

**Por qué se pierde.** `pg_restore` corre como `supabase_admin`, porque los otros seis
event triggers exigen superusuario. `ensure_rls` dispara una función de `postgres`, y
supautils rechaza que un superusuario dispare la función de un rol que no lo es:

```text
ERROR:  Superuser owned event trigger must execute a superuser owned function
ERROR:  event trigger "ensure_rls" does not exist
```

**Qué hace ahora `restore.sh`** (`infra/ops/lib/event-triggers.sh`):

1. Lee el índice del dump antes de tocar el destino, sin red. Si no se lee, sale 2.
2. Se lo da a `pg_restore` sin `ensure_rls` (`-L`), así no hay errores que normalizar.
   Si el destino ya lo tiene, lo quita antes: si no, `--clean` falla al borrar su función.
3. Lo recrea con `set role postgres` y la definición de la migración 0277.
4. Compara la base con el índice: cada event trigger del dump, con su dueño, y
   `ensure_rls` exacto (dueño, función, estado y etiquetas). Lo informa en una línea:
   `event triggers: esperados 7 · restaurada 7 · iguales`.
5. Si falta alguno, escribe `FALTAN <nombres>` y **sale 9**. No hay opción para saltárselo.

Ensayo local del 2026-11-02, con la imagen del VPS y datos sintéticos:

| Corrida | Antes | Con la SDD-0594 |
|---|---|---|
| `--target postgres`, stack nuevo | Sale 4, 2 errores, 6 event triggers | Sale 0, 0 errores, 7 event triggers, `ensure_rls` exacto |
| Otra vez encima de esa base | No medido | Sale 0, 0 errores |
| `restore-test.sh`, base nueva y `--dr` | No medido en este ensayo; las pruebas reales salían 5 de 5 | 8 PASÓ · 0 FALLÓ, con entre 15 y 17 errores según la corrida, todos de `pg_cron` (§«Qué no se restaura igual») |

Una tabla nueva de `public` nace con RLS si la crea `postgres` y **sin RLS si la crea
`supabase_admin`**: supautils no dispara estos triggers para un superusuario. Por eso la
prueba mide con `set local role postgres`. Las migraciones de producción van como
`postgres` (`infra/ops/migraciones/aplicar.sh`), así que a ellas sí las cubre; una tabla
creada a mano como `supabase_admin` no queda protegida.

`ensure_rls` se exige si el dump trae el trigger **o su función**. Un dump con la función
y sin el trigger viene de un origen que ya lo perdió: `restore.sh` lo recrea, avisa con
una `ADVERTENCIA` y `restore-test.sh` da FALLÓ, porque el que hay que revisar es el
origen. Un proyecto de la plantilla no trae ninguno de los dos y no se le exige.

**Si sale 9:** no des esa base por restaurada ni la expongas. Lee los `FALTAN`. Para
`ensure_rls`, comprueba que exista `public.rls_auto_enable()` con dueño `postgres` y
corre, con `--user supabase_admin`, el comando de `EVT_ENSURE_RLS_CREAR_SQL`. Otro event
trigger perdido no tiene receta: es un fallo nuevo y se investiga como incidente.

```sql
select evtname, pg_get_userbyid(evtowner), evtfoid::regproc, evtenabled, evttags
from pg_event_trigger order by 1;
```

Con esa consulta producción da 7 filas (medido el 2026-11-02, §«Qué no se restaura
igual»). `ensure_rls` es el único con dueño `postgres`; los otros seis son de `supabase_admin`.

### Qué no se restaura igual

Inventario de lo que exige superusuario o queda fuera de un `pg_dump -Fc` de la base
(sin `--create`). Fuentes, todas del 2026-11-02 salvo que se indique: catálogo de
producción y de prueba y el índice de un dump de prueba, por solo lectura; las
evidencias reales del 14 y del 29 de octubre; y un ensayo en Docker local con
`supabase/postgres:17.6.1.136` y datos sintéticos. Los dumps de producción no se
abrieron: están cifrados con la llave de Sam.

| Objeto | En producción | Qué pasa al restaurar | Qué lo cubre |
|---|---|---|---|
| `ensure_rls` | 1, función de `postgres` | **Se perdía** en toda restauración, con dos errores | `restore.sh` lo recrea (SDD-0594) |
| Otros event triggers | 6, de `supabase_admin` con funciones de `supabase_admin` | Se restauran; como `postgres`, no (88 errores, medido el 2026-10-09) | Comparación con el índice; `--user supabase_admin` |
| `pg_cron` y sus 3 trabajos | Solo en la base `postgres` | **Se pierde en base nueva y con `--dr`**: `can only create extension in database postgres` (19 de los 21 errores de las pruebas reales). Sobre `--target postgres` se restaura, trabajos incluidos (ensayo local, sin errores) | Nada, ni hace falta: es propio de la prueba, no de un DR. Por eso `--expect cron.job=N` no pasa en la prueba mensual y `restore-test.sh` sale con `restore.sh` en 4 |
| `ALTER DATABASE postgres SET app.settings.jwt_exp` | 1 | **No viaja en el dump**. La imagen sola no lo trae (ensayo local); lo pone `infra/dtd-cargo/supabase/volumes/db/jwt.sql` al crear el stack, con `JWT_EXP` del `.env` | El `.env` respaldado (§4) |
| Permisos y comentario de la base `postgres` | ACL con `dashboard_user`, `supabase_etl_admin` y `supabase_storage_admin`; 1 comentario | **No viajan en el dump**, pero la imagen recién creada trae la misma ACL y un comentario (ensayo local) | La imagen, fijada por tag |
| `ALTER ROLE … SET` globales | 10 roles | Viajan en `-roles.sql`, sin comparación automática | Prueba tiene los mismos parámetros, por nombre |
| Publicaciones | `supabase_realtime` (11 tablas) y `supabase_realtime_messages_publication` (1) | Están en el índice y las pruebas reales no dan error por ellas; sin comparación automática | Prueba las tiene iguales |
| Extensiones | 9, dos solo en producción (`hypopg`, `index_advisor`) | Salvo `pg_cron`, las pruebas reales no dan error por ellas | — |
| Default ACL, objetos de superusuario en `_realtime` y `realtime` | 30 y 5 | Las pruebas reales no dan error por ellos | Prueba tiene las mismas cifras |
| Suscripciones, FDW, servidores, lenguajes propios, tablespaces, etiquetas de seguridad | 0 | No aplica | — |

Lo que este inventario no demuestra: nunca se restauró un dump **de producción** sobre
`--target postgres`. Ese destino se midió con un dump de prueba y con el ensayo sintético;
los dumps de producción, en base nueva. `--dr` no lo reemplaza, porque ahí `pg_cron` falla.
Y solo los event triggers tienen comparación automática: una publicación perdida sin
error no la detecta ninguna comprobación.

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

## 5 · Archivos de Storage

**Cómo es hoy** (medido por el Director General el 2026-11-09 en el VPS):
`dtd-cargo-storage-1` corre con `STORAGE_BACKEND=file`, con el bind de
`/srv/dtd-cargo/data/storage` a `/var/lib/storage` (~515 MB, 714 archivos). El
overlay `compose.supabase.s3.yml` no está activo. El dump de §2 trae solo la
metadata (`storage.objects`); los bytes están en esa carpeta, y el Content-Type y
el Cache-Control de cada objeto, en sus xattrs `user.supabase.*` (714 de 714
archivos los tienen, medido el mismo día). Sin esos xattrs, una restauración
serviría los PDF y las imágenes sin su tipo.

Hoy ningún respaldo propio los copia: la única copia está en el Auto Backup de
Contabo, que es el mismo proveedor (§6). La SDD-0620 los respalda **desde su
instalación, pendiente del OK de Sam**. Este runbook describía un `rclone sync`
semanal de R2 a B2 que **nunca existió**.

El Storage guarda lo más sensible del sistema (cédulas y RIF, fotos de
recepción, POD y firmas, fachadas, comprobantes de pago; inventario en
[revision-traslado-contabo-2026-10-09.md](../legal/privacidad/revision-traslado-contabo-2026-10-09.md)).
Por eso sale de Contabo igual que la base: cifrado con `age` antes de salir, y
Backblaze solo guarda archivos ilegibles.

### 5.1 Respaldo diario (desde la instalación, pendiente de OK)

`backup.sh` llama a `infra/ops/backup/storage-backup.sh` después del dump y de
la configuración. El script:

1. Comprueba la carpeta (`<DTD_DATA_DIR>/storage`, o `BACKUP_STORAGE_DIR`), los
   destinatarios `age`, el espacio libre en `/srv/backups` y que haya al menos
   `BACKUP_STORAGE_MIN_FILES` archivos (1 por omisión). Una carpeta vacía o
   equivocada hace **fallar** el respaldo, y sin respaldo no hay latido.
2. Hace un solo `tar --format=posix --xattrs --xattrs-include='user.*'` de la
   carpeta y lo reparte por tuberías a tres consumidores: `age` (el `.tar.age`),
   la **lista por archivo** (sha256, bytes, huella de los xattrs `user.*` y ruta,
   sacada de los mismos bytes por `infra/ops/lib/storage-lista.py`, y también
   cifrada) y la huella sha256 del flujo. **Nada en claro toca el disco**: el
   contenido pasa por tuberías y FIFOs en `/dev/shm`. Los avisos de tar, que
   nombran archivos, quedan en `/dev/shm` y se borran: el log solo dice cuántos.
3. Escribe `<base>.manifiesto` en claro, **sin rutas**: sello, conteo, bytes,
   huella del flujo y sha256 de los dos `.age`. Las rutas pueden traer nombres de
   personas, por eso la lista va cifrada.
4. `rclone copy` (nunca `sync`) de los tres a
   `b2:dtdcargo-respaldos/storage/dtd-cargo/` y `rclone check --one-way`.
5. **Guarda contra un borrado masivo, que falla cerrada.** Compara el conteo con
   el del último respaldo aceptado
   (`${OUT}/dtd-cargo/storage/dtd-cargo-storage.referencia`, escrita con
   `.part` + `mv`). Si cae por debajo del 50 %, el respaldo **se sube igual**,
   pero no se aplica la retención (ni remota ni local), y el script sale 1: no hay
   latido y alguien mira. Lo mismo si la referencia no se puede leer (vacía, sin
   `archivos=` o `base=`, a medias o sin permisos). Si la referencia falta o es
   ilegible, compara contra el **máximo** de `archivos=` de los manifiestos
   anteriores, los locales **y los del remoto**, que la retención conserva 30 días:
   el más nuevo puede ser ya el de después de la caída, y en un disco nuevo, o con
   un `--out` equivocado, no hay manifiestos locales. Se repite cada día hasta que
   se acepte a mano.

   **Aceptar la caída: solo con OK nominal de Sam.** Antes, alguien comprueba en
   el Studio que la caída es legítima, por ejemplo una limpieza autorizada. La
   corrida exige el conteo exacto, para que no se corra por accidente. Toma el
   mismo candado que el timer, para no correr a la vez que el respaldo de la
   noche, y los mismos valores del `.env` que usa `backup.sh`. Este **bloque de
   valores** sirve también para el paso 5 del guion de instalación y para la
   vuelta atrás (spec 0620):

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
   ```

   ```bash
   flock -n -E 75 "/run/lock/backup-${P}.lock" "${OPS}/backup/storage-backup.sh" "${ARGS[@]}" \
     --aceptar-caida=<archivos que dice el log> \
     || { rc=$?; [ "${rc}" = 75 ] && echo "✗ candado tomado: el respaldo de la noche está corriendo; esperar a que termine y repetir" || echo "✗ salió ${rc}: leer el log, no se aceptó nada"; }
   ```

   **Qué hace y qué borra.** Sale 1 sin tocar nada si el conteo no es exactamente
   el dicho o si no encuentra un respaldo bueno: ni la referencia ni ningún
   manifiesto anterior, local o del remoto, da uno válido. Si coincide:
   - Primero **retiene el último respaldo bueno**: el de la referencia o, si es
     ilegible o falta, el manifiesto con más archivos, local o del remoto. En el
     remoto lo copia a `${REMOTO}/${P}-retenido/`, lo
     comprueba con `rclone check` y cuenta que estén sus 3 archivos, porque rclone
     sale 0 aunque no haya copiado nada. Si cualquiera de esos pasos falla, no se
     borra nada. Recién después mueve a `${OUT}/${P}/storage-retenido/` lo
     que de ese respaldo haya en disco; si en disco no estaba completo, lo dice el
     log, y el retenido verificado es el del remoto. Ninguna retención toca esos
     dos prefijos: se quedan hasta que Sam autorice borrarlos. Cada aceptación
     suma un respaldo completo, hoy ~515 MB, en cada uno.
   - Recién después aplica la retención normal: en el remoto,
     `rclone delete --min-age <BACKUP_RETENTION_DAYS>d` dentro de
     `${REMOTO}/${P}/`, que borra los respaldos más viejos que eso; en disco,
     deja en `storage/` solo los `BACKUP_STORAGE_KEEP_LOCAL` más nuevos, que son
     los de después de la caída.
   - La referencia pasa al conteo nuevo.

   **Si el bloqueo no tiene salida.** Hay tres casos que frenan la retención cada
   día y que `--aceptar-caida` tampoco destraba:
   - un manifiesto anterior con `archivos=` fuera de formato: vacío, con cero
     inicial, con algo más en la línea o de más de 16 cifras. Al aceptar, el
     script se niega, porque no sabría cuál era el más grande;
   - un manifiesto cuyo nombre no es `<proyecto>-storage-<sello>.manifiesto`
     (los del remoto se leen uno por uno, con la base sacada del nombre, igual
     que los locales);
   - el respaldo de ese máximo ya no tiene sus 3 archivos en el remoto (el log
     dice «hay N de los 3 archivos»).

   Esos manifiestos solo los escribe el script, así que cualquiera de los tres es
   un daño o una manipulación: se mira antes de tocar nada. Con el **bloque de
   valores** cargado, que es lo que fija `P`, `OUT`, `REMOTO` y `RC`, se listan;
   van en claro y sin rutas:

   ```bash
   for m in "${OUT:?}/${P:?}/storage/"*.manifiesto; do printf '%s %s %s\n' "$(sed -n 's/^archivos=//p' "$m")" "$(sed -n 's/^sello=//p' "$m")" "$(basename "$m")"; done
   docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 cat "${REMOTO:?}/${P:?}/" --include "*.manifiesto" | grep -E '^(sello|archivos)='
   # Cuántos archivos de un respaldo hay en el remoto (tienen que ser 3):
   docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 lsf "${REMOTO:?}/${P:?}/" --files-only --include "/<base>*"
   ```

   Retirarlo es **solo con OK nominal de Sam**. Se aparta el respaldo entero, con
   lo que tenga de sus 3 archivos, fuera del prefijo y sin borrarlo: queda como
   evidencia, y ninguna retención lo toca. `<base>` es el nombre del manifiesto
   sin `.manifiesto`. Los `:?` hacen que el comando no corra si el bloque de
   valores no está cargado:

   ```bash
   mkdir -m 700 -p "${OUT:?}/${P:?}/storage-apartado" \
     && mv -n "${OUT:?}/${P:?}/storage/<base>".* "${OUT:?}/${P:?}/storage/<base>-lista.age" "${OUT:?}/${P:?}/storage-apartado/" 2>/dev/null
   docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 move "${REMOTO:?}/${P:?}/" "${REMOTO:?}/${P:?}-apartado/" --include "/<base>*"
   # Ni mv -n ni rclone move dicen qué movieron: se mira lo apartado y lo que quedó.
   ls -l "${OUT:?}/${P:?}/storage-apartado/"; ls "${OUT:?}/${P:?}/storage/" | grep -F -- "<base>" || echo "(en disco ya no queda nada de <base>)"
   docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 lsf "${REMOTO:?}/${P:?}-apartado/" --include "/<base>*"
   docker run --rm -v "${RC:?}:/config/rclone:ro" rclone/rclone:1.75.1 lsf "${REMOTO:?}/${P:?}/" --include "/<base>*" | grep . || echo "(en el remoto ya no queda nada de <base>)"
   ```

   El respaldo siguiente vuelve a comparar sin ese manifiesto.
6. Retención: `rclone delete --min-age 30d` acotado a ese prefijo, con
   `hard_delete` del remoto (borrado real), y en disco local los 2 respaldos más
   nuevos (`BACKUP_STORAGE_KEEP_LOCAL`).

Consistencia: storage-api sigue sirviendo mientras corre. Un archivo subido
entre el dump y el tar queda huérfano (inofensivo). Si un archivo cambia a mitad
de lectura, tar sale 1: el script lo avisa (`aviso_tar=1` en el manifiesto) y
sigue, porque la lista sale del mismo flujo. RPO del Storage: 24 h, igual que la
base.

### 5.2 Comprobación mensual (junto con §3)

Sobre el último respaldo **bajado del bucket**, no la copia local:

```bash
umask 077; mkdir -p /srv/restores/storage
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro -v /srv/restores/storage:/data rclone/rclone:1.75.1 \
  copy b2:dtdcargo-respaldos/storage/dtd-cargo/ /data/ --max-age 26h
install -m 600 /dev/null /dev/shm/clave.txt   # pegar la privada de Sam
# Sin escribir ningún archivo: descifra y recorre el flujo.
/srv/ops/backup/storage-restore.sh --dir /srv/restores/storage --age-identity /dev/shm/clave.txt --verificar
# Restauración real en una carpeta DESECHABLE en RAM (cabe: ~515 MB), y fuera.
/srv/ops/backup/storage-restore.sh --dir /srv/restores/storage --age-identity /dev/shm/clave.txt \
  --destino /dev/shm/storage-restaurado
rm -rf /dev/shm/storage-restaurado /dev/shm/clave.txt /srv/restores/storage
```

Cada modo termina con `RESULTADO: N PASÓ · M FALLÓ` y comprueba: sha256 de los
dos `.age` **antes** de descifrar, huella del flujo, lista por archivo (mismas
rutas, bytes, sha256 y xattrs `user.*`, comparados por huella) y conteo y bytes
contra el manifiesto. La salida no trae rutas. `--destino` en `/dev/shm` restaura
también los xattrs; tmpfs los admite desde el kernel 6.6 (el VPS corre Ubuntu
24.04: NO VERIFICABLE hasta la primera prueba). Si fallara, basta `--verificar`,
que compara los xattrs sin escribir nada. Se anota en §8 el
conteo del manifiesto junto al de `storage.objects` del restore de la base: si
difieren por más de las subidas de un día, algo falta.

### 5.3 Restaurar en producción

Con la autorización de Sam para tocar producción, nunca encima de la carpeta viva:

```bash
/srv/ops/backup/storage-restore.sh --dir /srv/restores/storage --age-identity /dev/shm/clave.txt \
  --destino /srv/dtd-cargo/data/storage-restaurado
cd /srv/dtd-cargo && docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml stop storage imgproxy
mv data/storage data/storage-antes-$(date -u +%Y%m%dT%H%M%SZ) && mv data/storage-restaurado data/storage
docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml start storage imgproxy
```

Como root, `tar --numeric-owner --xattrs` conserva los dueños originales y los
xattrs `user.supabase.*` (Content-Type y Cache-Control). La carpeta
`storage-antes-*` se borra solo después de comprobar la web y el Studio, y con
el visto bueno de Sam.

### 5.4 Si el Storage crece

Hoy son ~515 MB: el respaldo completo diario cuesta unos 15 GB en el bucket
(30 copias), centavos al mes, y sube en segundos. El script avisa en el log
cuando el origen pasa de `--aviso-gb` (10 GB). Ese aviso es la señal para
revisar la estrategia en una SDD nueva, sin improvisar en el servidor:

- **Hasta ~10 GB:** completo diario, como ahora (~300 GB en el bucket).
- **Más de 10 GB:** completo semanal más diferencial diario
  (`tar --listed-incremental`), o pasar el Storage a B2 o R2 con el overlay
  `compose.supabase.s3.yml` y un respaldo entre buckets. Cualquiera de las dos
  cambia la restauración y se ensaya antes.
- **Disco:** el `.tar.age` pesa lo mismo que el origen (las fotos y los PDF no se
  comprimen). El script se niega a empezar si `/srv/backups` no tiene el tamaño
  del origen + 10 % + 100 MB libres.
- **Muchos archivos:** la lista lee cada archivo una vez, en Python, del mismo
  flujo. Con 714 tarda segundos; con cientos de miles hay que medirla.

Los adjuntos con recibo inmutable siguen bajo su runbook propio
([adjuntos-backup-antivirus-restore.md](adjuntos-backup-antivirus-restore.md));
este no lo sustituye ni lo repite.

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

## Registro · 2026-10-14 · primera restauración del respaldo real

- Respaldo `dtd-cargo-20261014T014837Z` (6,1 MB) + configuración `dtd-cargo-config-20261014T014859Z`, con la llave age **nueva** de Sam (huella pública `f4aab8d945aa686a`; la del 12-10 se perdió y sus respaldos de 00:10Z y 00:31Z son ilegibles).
- `/srv/ops/backup/restore-real-prueba.sh` (llave pegada sin eco, en `/dev/shm`, borrada al salir): **5 PASÓ · 0 FALLÓ**, permisos de public idénticos, 3 secretos de Vault legibles con la raíz respaldada, **RTO 34 s**. Evidencia: `/srv/ops/evidencias/restore-real-20261014T015017Z.txt`.
- Próxima: mensual (§3), con el mismo script.

## Registro · 2026-10-29 · segunda llave perdida y cambio a dos llaves

Coordinado por el Director del programa SDD-0582, ejecutado por el Worker de la SDD-0583. OK de Sam, literal: «Autorizo las dos» (llave nueva para los respaldos de DTD y de Chatwoot, y archivo de los respaldos viejos).

- **Incidente.** La llave privada del 2026-10-14 (huella pública `f4aab8d945aa686a`) no apareció. Sam pegó tres candidatas; una era una llave age válida pero de otro par (probablemente la del 12-10). Es la segunda pérdida en 17 días. Lo que falló fue la custodia, no la prueba: la entrada del gestor guardaba un texto más corto que la llave (en el primer intento de hoy, la vuelta dio 45 caracteres en lugar de 74).
- **Respaldos viejos, sin borrar nada.** Copiados (`rclone copy`) a `b2:dtdcargo-respaldos/archivo-llave-2026-10-14/`, fuera de la retención de 30 días: `db/dtd-cargo` 87 objetos y 847.900.543 bytes; `db/dtd-cargo-config` 24 y 740.976; `chatwoot` 4 y 426.929. El origen y el destino tienen los mismos conteos y tamaños, y `rclone check --one-way` da 0 diferencias. El bucket no tiene reglas de ciclo de vida. La retención de los scripts habría empezado a borrar los originales el 2026-11-13 a las 06:00 UTC.
- **Dos llaves nuevas**, generadas en la PC de Sam (contenedor local `dtd-age`). Al VPS solo llegaron las públicas (`/root/agregar-publica-age.sh`, que rechaza privadas). En cada una, Sam pegó la llave de vuelta sacándola de donde la guardó:
  - `Sam-2026-10-29`: huella `f0bdbaa91af5fc7c`. En su gestor, entrada «DTD Cargo · llave de respaldos (age) · Sam-2026-10-29».
  - `Emergencia-2026-10-29`: huella `f2b06f66dad23591`. Fuera de línea (USB o papel), aparte del gestor.
- **Destinatarios.** `age-recipients.txt` tiene solo esas dos líneas (600). Copias: `age-recipients.txt.bak-20261029` (la del 14-10) y `.bak-20261014` (la del 12-10).
- **Respaldos nuevos de inmediato:** DTD `dtd-cargo-20261029T183145Z` (6,7 MB) y configuración `dtd-cargo-config-20261029T183231Z`, «RESULTADO: PASÓ», latido enviado. Chatwoot `chatwoot-20261029T183240Z`, `rclone check` sin diferencias.
- **Pruebas del mismo día** (evidencias en `/srv/ops/evidencias/`):
  - con la llave de **emergencia**, restauración de DTD (`restore-test.sh`): **5 PASÓ · 0 FALLÓ**, RTO 52 s, 4 de 4 secretos de Vault legibles. También P5 de Chatwoot, bajado de B2: **PASÓ**, 200 s, con conteos y claves iguales al manifiesto (`p5-llave-sam-20261029T183444Z.txt`). La llave se pegó en la pestaña de «sam», pero su huella dice emergencia;
  - con la llave del **gestor**: los 7 archivos de los respaldos nuevos se descifran (`p5-llave-gestor-20261029T184050Z.txt`).
- **Regla nueva de custodia:** al guardar una llave, comprobar en el gestor que el campo tiene 74 caracteres. Si el campo de contraseña la corta, usar el de notas. La prueba con la llave del gestor se hace sacándola del gestor, nunca del portapapeles.

## Registro · 2026-11-02 · hallazgo sobre las pruebas anteriores (SDD-0594)

- Las pruebas reales del 2026-10-14 y del 2026-10-29 salieron 5 PASÓ, pero no comprobaban `ensure_rls`: sus evidencias traen los dos errores, y `restore.sh` había salido 4. Sobre los dumps en sí no dicen nada malo: el trigger viene en el índice.
- Desde la SDD-0594, una corrida correcta da **7 comprobaciones**, 1 más con `--vault-readable` y una por cada `--expect`: `restore-real-prueba.sh` da 8. Un resultado de 5 PASÓ ya no es la cifra esperada.
- Pendiente de la primera corrida real con el script nuevo, después de instalarlo: esperar `event triggers: esperados 7 · restaurada 7 · iguales`.
