# infra/ops — piezas compartidas del servidor (SDD-0505)

Lo que corre en el VPS y no pertenece a un proyecto en particular: el proxy de
entrada, el monitor y los scripts de respaldo. En el servidor vive en `/srv/ops`
(copia de esta carpeta); cada proyecto vive en `/srv/<proyecto>` con su propio
compose (plantilla en `infra/templates/proyecto/`, DTD Cargo en `infra/dtd-cargo/`).

| Carpeta | Qué es | Imagen |
|---|---|---|
| `traefik/` | Proxy 80/443 con Let's Encrypt, para entornos **sin Dokploy** | `traefik:v3.7.14` |
| `uptime-kuma/` | Monitor de disponibilidad con avisos | `louislam/uptime-kuma:2.5.5` |
| `backup/pg-dump-to-s3.sh` | Dump diario + roles + copia a R2/B2 con rclone y retención | `supabase/postgres:17.6.1.136`, `rclone/rclone:1.75.1` |
| `backup/restore.sh` | Restore en base nueva o staging, con guarda contra pisar producción | `supabase/postgres:17.6.1.136` |

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
hacerlo. Si prefieres que el panel no sea público, añade `tailscale-only@file` a
`traefik.http.routers.uptime-kuma.middlewares` (las páginas de estado públicas
dejarían de verse desde fuera).

Monitores mínimos por proyecto: `GET https://<app>/` (200), `GET https://<api>/rest/v1/`
con la `apikey` anon (200), y un `HEAD` a una ruta de cron (403 es la respuesta
sana: exige el Bearer). Avisos por Telegram al mismo chat que usa la app.

## Backups

### Qué hace `pg-dump-to-s3.sh`

En orden: `pg_dump -Fc` de la base, `pg_dumpall --roles-only`, `pg_restore --list`
para comprobar que el archivo se lee, sha256 de ambos, `rclone copy` (nunca `sync`)
al prefijo `<remoto>:<bucket>/<prefijo>/<proyecto>/`, `rclone delete --min-age Nd`
**solo** dentro de ese prefijo y limpieza local de dumps viejos. Cada paso corre en
contenedor: `pg_dump` sale de la misma imagen que corre la base (misma versión) y
se conecta por la red interna del proyecto (`<proyecto>_internal`).

Cada proyecto lo llama desde su `backup.sh` (lee `.env`), agendado en el cron del
host, escalonado para no solapar:

```
15 3 * * * /srv/dtd-cargo/backup.sh >> /var/log/backup-dtd-cargo.log 2>&1
45 3 * * * /srv/loop3d/backup.sh   >> /var/log/backup-loop3d.log   2>&1
```

Antes del primer cron: `backup/rclone/rclone.conf` con el remoto (`rclone config`
en el host o a mano; permisos 600; **nunca en Git**) y un `backup.sh --dry-run`
para ver los comandos exactos sin ejecutar nada.

Lo que no cubre: WAL continuo / point-in-time recovery. Un dump diario pierde
hasta 24 h de datos; pgBackRest queda como pendiente declarado antes del corte.

### Restore de prueba mensual (obligatorio)

Un backup que nunca se restauró no es un backup. Una vez al mes, en el VPS:

1. Baja el dump más reciente y sus roles a `/srv/restores/`:
   `docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro -v /srv/restores:/data rclone/rclone:1.75.1 copy r2:<bucket>/<prefijo>/<proyecto>/<archivo>.dump /data/`
   (igual para `-roles.sql` y `.sha256`), y comprueba `sha256sum -c <archivo>.sha256`.
2. Restaura en una base NUEVA al lado de la viva (nunca en `postgres`):
   ```sh
   PGPASSWORD=… /srv/ops/backup/restore.sh \
     --file /srv/restores/<archivo>.dump --roles /srv/restores/<archivo>-roles.sql \
     --project dtd-cargo --target prueba_restore_$(date -u +%Y%m) --verify-table auth.users
   ```
   La guarda rechaza (`exit 3`) si el target existe o es la base viva. `exit 4`
   significa que `pg_restore` emitió advertencias: léelas antes de dar el restore
   por bueno (las de extensiones ya presentes son normales; las de tablas, no).
3. Anota en el runbook de backup: fecha, archivo, tamaño, `count(*)` de
   `auth.users` y de una tabla de negocio, duración y advertencias.
4. Borra la base de prueba: `docker compose -f /srv/<proyecto>/compose.yml exec db psql -U postgres -c 'drop database prueba_restore_<AAAAMM>'`.

Para restaurar sobre un staging completo, usa `--project <proyecto>-staging`: ahí
el target puede existir y se pisa con `--clean --if-exists`.

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
