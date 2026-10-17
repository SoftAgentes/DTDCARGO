# infra/ops — piezas compartidas del servidor (SDD-0505)

Lo que corre en el VPS y no pertenece a un proyecto en particular: el proxy de
entrada, el monitor y los scripts de respaldo. En el servidor vive en `/srv/ops`
(copia de esta carpeta); cada proyecto vive en `/srv/<proyecto>` con su propio
compose (plantilla en `infra/templates/proyecto/`, DTD Cargo en `infra/dtd-cargo/`).

| Carpeta | Qué es | Imagen |
|---|---|---|
| `traefik/` | Proxy 80/443 con Let's Encrypt, para entornos **sin Dokploy** | `traefik:v3.7.14` |
| `uptime-kuma/` | Monitor de disponibilidad con avisos | `louislam/uptime-kuma:2.5.5` |
| `backup/pg-dump-to-s3.sh` | Dump diario + roles + permisos de `public` con su huella, **cifrados con age** (claros solo en `/dev/shm`), copia a R2/B2 con rclone y retención | `supabase/postgres:17.6.1.136`, `rclone/rclone:1.75.1`, `age` del host |
| `backup/config-backup.sh` | `.env` + clave raíz de pgsodium/Vault (volumen `db-config`), cifrados, solo cuando cambian | ídem |
| `backup/restore.sh` | Restore en base nueva o staging, con guarda contra pisar producción; descifra `.age` en memoria; iguala los permisos de `public` a los del origen y los compara por huella (sale 8 si difieren) | `supabase/postgres:17.6.1.136` |
| `backup/restore-test.sh` | Restore de prueba mensual en un contenedor desechable con PGDATA en tmpfs; `--dr` ensaya sobre la base `postgres` de la imagen | ídem |
| `lib/acl.sh` | SQL de permisos de `public` (igualar y huella), compartido por el import y los respaldos; se carga con `source` | — |
| `migrate/import-from-cloud.sh` | Copia de Supabase Cloud a un staging (Fase 2): dump en memoria, tablas de log fuera, verificación por conteos | CLI `supabase` 2.118.0, ídem |
| `staging/destroy-staging.sh` | Borra los datos de un staging al cerrar el ensayo, con evidencia | — |
| `staging/*-prueba.sh`, `staging/verificar-aislamiento.sh` | Entorno de prueba con datos sintéticos (SDD-0540): `.env`, clave del web, aislamiento, semilla, reset de la base, creación y despliegue. Procedimiento: `docs/runbooks/entorno-prueba.md` | las del compose del proyecto |
| `migrate/aplicar-migracion.sh` · `lib/migracion.sh` | Una migración con su fila del ledger en una transacción (método del Director, SDD-0540 §2.6); por ahora solo en `*-staging` | `supabase/postgres` del proyecto |

Todas las imágenes van fijadas por tag exacto (verificado en Docker Hub y GitHub
Releases el 2026-10-08). Nunca `latest`. Los procedimientos completos (fases del
servidor, corte, rollback) están en `docs/runbooks/servidor-contabo.md` y
`docs/runbooks/backup-restore-servidor.md`; este README cubre lo operativo de
estas piezas.

## Traefik

1. Crea la red edge de cada proyecto antes de levantar nada:
   `docker network create dtd_edge` (una por proyecto; agrégalas a
   `traefik/compose.yml › networks` y a `services.traefik.networks`).
2. `cp traefik/.env.example traefik/.env` y rellena `ACME_EMAIL`. Si Cloudflare va
   delante (proxied), pon sus rangos en `TRUSTED_PROXY_CIDRS`.
3. `mkdir -p traefik/letsencrypt && touch traefik/letsencrypt/acme.json && chmod 600 traefik/letsencrypt/acme.json`.
4. `docker compose -f traefik/compose.yml up -d` y `docker compose -f traefik/compose.yml ps`
   hasta ver `healthy`.

Los proyectos se publican por labels (`traefik.enable=true`, router por `Host`,
`traefik.docker.network=<su red edge>`). Middlewares y transports comunes están en
`traefik/dynamic/middlewares.yml`; lee el aviso sobre `buffering` antes de usar
`body-12mb`/`body-50mb`: almacena también las respuestas y rompe el streaming.

**IP real del cliente.** Sin Cloudflare, Traefik sobreescribe `X-Real-Ip` con la IP
del peer y la app usa `REQUEST_IP_HEADER=x-real-ip`. Detrás de Cloudflare, el peer
es Cloudflare: la app debe usar `cf-connecting-ip` y el firewall del VPS debe
aceptar 80/443 solo desde los rangos de Cloudflare; si el origen queda abierto,
ese header se puede falsificar. Prueba, con el servidor arriba:

```sh
curl -sS -H "X-Real-Ip: 1.2.3.4" -H "X-Forwarded-For: 1.2.3.4" https://<dominio>/api/whoami-ip
```

(o la ruta que exponga la IP de evidencia): la respuesta tiene que traer tu IP,
no `1.2.3.4`.

Con Dokploy no se levanta este compose: Dokploy trae su Traefik y ocupa 80/443.
Los labels de los proyectos funcionan igual; solo cambia dónde se definen los
middlewares `@file`.

## Uptime Kuma

`cp uptime-kuma/.env.example uptime-kuma/.env`, define `UPTIME_KUMA_HOST` (DNS al
VPS) y `docker compose -f uptime-kuma/compose.yml up -d`. Entra de inmediato a
crear el usuario admin: hasta entonces cualquiera que llegue al dominio puede
hacerlo. **En el VPS de DTD (2026-10-13):** `UPTIME_KUMA_HOST=vps.dtdcargo.com`
(el `whoami` de prueba que vivía ahí se retiró), base SQLite, admin creado por
Sam, monitores `Web · dtdcargo.com`, `Supabase servidor · auth` (con la cabecera
`apikey` anon) y el Push del respaldo diario (en pausa hasta el corte). Si prefieres que el panel no sea público, añade `tailscale-only@file` a
`traefik.http.routers.uptime-kuma.middlewares` (las páginas de estado públicas
dejarían de verse desde fuera).

Monitores mínimos por proyecto: `GET https://<app>/` (200), `GET https://<api>/rest/v1/`
con la `apikey` anon (200), y un `HEAD` a una ruta de cron (403 es la respuesta
sana: exige el Bearer). Avisos por Telegram al mismo chat que usa la app.

## Backups

### Qué hace `pg-dump-to-s3.sh`

En orden: `pg_dump -Fc` de la base y `pg_dumpall --roles-only` en **`/dev/shm`**
(memoria; el claro nunca toca el disco), `pg_restore --list` para comprobar que
el archivo se lee, **cifrado con `age`** para las claves públicas de
`--age-recipients`, borrado de los claros, sha256 de los cifrados, `rclone copy`
(nunca `sync`) al prefijo `<remoto>:<bucket>/<prefijo>/<proyecto>/`,
`rclone delete --min-age Nd` **solo** dentro de ese prefijo y limpieza local de
cifrados viejos. `pg_dump` sale de la misma imagen que corre la base y se conecta
por la red interna del proyecto. Sin destinatarios válidos no corre (tampoco en
`--dry-run`); si muere a la mitad, un trap borra `/dev/shm` y los contenedores de
esa corrida.

`config-backup.sh` respalda el `.env` y el volumen `<proyecto>_db-config` (la
clave raíz de Vault, `pgsodium_root.key`; **no** es `VAULT_ENC_KEY`, que es de
Supavisor) en `<remoto>/<proyecto>-config/`, cifrados, y solo cuando cambiaron.

Cada proyecto los llama desde su `backup.sh` (lee `.env`). DTD Cargo lo agenda
con un timer de systemd a las 06:00 UTC (`infra/dtd-cargo/systemd/`, zona
explícita porque el VPS está en `Europe/Berlin`); los proyectos de la plantilla,
en el cron del host, escalonados para no solapar:

```
45 3 * * * /srv/loop3d/backup.sh   >> /var/log/backup-loop3d.log   2>&1
```

Antes del primer cron: `apt-get install -y age`; `backup/age-recipients.txt`
con **solo** las claves públicas (la privada de Sam nunca viene al servidor);
`backup/rclone/rclone.conf` con el remoto (permisos 600; **nunca en Git**); y un
`backup.sh --dry-run` para ver los comandos exactos sin ejecutar nada.

Lo que no cubre: WAL continuo / point-in-time recovery. Un dump diario pierde
hasta 24 h de datos; pgBackRest queda como pendiente declarado antes del corte.

### Restore de prueba mensual (obligatorio)

Un backup que nunca se restauró no es un backup. Una vez al mes, en el VPS, con
`restore-test.sh`: levanta un `supabase/postgres` desechable con PGDATA en tmpfs y
red interna sin puertos, restaura con `restore.sh` como `supabase_admin`, compara
`--expect tabla=filas`, comprueba con `--config` + `--vault-readable` que la raíz
respaldada abre los secretos de Vault, y destruye todo. La clave privada entra a
`/dev/shm` solo mientras dura la prueba. Pasos y registro:
`docs/runbooks/backup-restore-servidor.md` §3 y §8.

`restore.sh` solo también sirve para restaurar en una base NUEVA al lado de la
viva o en un staging (`--project <proyecto>-staging`). Con un `.age` pide
`--age-identity`, compara el sha256 hermano antes de descifrar (código 5 si no
coincide) y descifra en `/dev/shm`. Al aplicar los roles quita las cláusulas
`PASSWORD` del origen: si no, le cambiaría la contraseña al usuario con el que
se conecta. `exit 4` significa advertencias de `pg_restore`: léelas antes de dar
el restore por bueno (como `postgres` salen errores de event triggers, que
exigen superusuario: usa `--user supabase_admin`).

### Staging de la Fase 2 y traslado desde Cloud

`migrate/import-from-cloud.sh` copia producción de Supabase Cloud a un
`*-staging` vacío (dump en memoria, tablas de log fuera, verificación por
conteos, evidencia sin datos personales) y `migrate/vault-set-secret.sh`
reescribe después los secretos de Vault, que llegan cifrados con la raíz de
Cloud. `staging/destroy-staging.sh` borra los datos del staging al cerrar el
ensayo. Procedimiento: `docs/runbooks/servidor-contabo.md` §2.2 y §2.6.

### Pisar producción (solo con decisión de Sam)

`restore.sh` se niega a restaurar sobre la base viva del proyecto de producción
(`PROD_COMPOSE_PROJECT`, por defecto `dtd-cargo`; `PROD_DB_NAME`, por defecto
`postgres`). Hacerlo exige `--i-know-this-destroys-prod` **y** escribir
`DESTRUIR <proyecto>/<base>` en una terminal interactiva; sin terminal, rechaza.
Antes de eso: parar `web` y `cron`, tomar un dump fresco con `pg-dump-to-s3.sh`, y
tener el plan de rollback del runbook a mano.

## Pendientes declarados

- `docker-socket-proxy` delante de `/var/run/docker.sock` para Traefik (hoy va en
  solo lectura, que limita pero no elimina el riesgo).
- pgBackRest o WAL-G para WAL continuo.
- Rotación de `acme.json` y alertas de vencimiento en Uptime Kuma (monitor de
  certificado).
