# Plantilla de proyecto en el servidor propio (SDD-0505)

Molde para levantar un proyecto (Loop 3D, Renta Aguada…) en el VPS de Contabo con
el mismo patrón que DTD Cargo: una app Next.js en Docker, un Supabase self-hosted
recortado, un `cron` que reemplaza a los crons de Vercel, y backup diario a R2/B2.
Todo aislado por proyecto: su compose, su red interna, sus volúmenes, su `.env`.

Lo que trae:

| Archivo | Para qué |
|---|---|
| `compose.yml` | `web` + `cron` + Supabase recortado (`db`, `api-gw`, `auth`, `rest`, `storage`, `imgproxy`, `meta`); perfiles `realtime`, `functions`, `studio` |
| `.env.example` | Todas las variables, solo nombres y placeholders |
| `Dockerfile.next` | Imagen multi-stage de una app Next.js con pnpm (standalone, no root, healthcheck) |
| `cron/` | Imagen mínima (`alpine:3.24.2` + crond + curl) y un `crontab` de ejemplo |
| `backup.sh` | Envoltorio del backup de ops con los valores del `.env` del proyecto |

Supabase viene del compose oficial (`supabase/supabase@4205c41`, `docker/`,
2026-10-08) con las imágenes fijadas: `supabase/postgres:17.6.1.136`,
`envoyproxy/envoy:v1.39.1`, `supabase/gotrue:v2.197.0`, `postgrest/postgrest:v14.17`,
`supabase/storage-api:v1.77.6`, `darthsim/imgproxy:v3.31.4`,
`supabase/postgres-meta:v0.99.0`; perfiles: `supabase/realtime:v2.134.10`,
`supabase/edge-runtime:v1.76.2`, `supabase/studio:2026.09.07-sha-7996410`. Fuera:
Supavisor, Logflare, Vector. Las reglas (sin `container_name`, sin puertos, tags
fijos, secretos solo en `.env`) están comentadas en `compose.yml`.

## Cómo usar

Pasos en el VPS (los de servidor, Traefik y DNS están en
`docs/runbooks/servidor-contabo.md`; aquí solo lo del proyecto).

1. **Copia la carpeta** a `/srv/<proyecto>/` y entra. Renombra nada: los nombres
   salen de `.env`.
2. **Archivos de arranque de Supabase.** Copia `infra/dtd-cargo/supabase/volumes/`
   del repo de DTD Cargo (son los `docker/volumes/` del upstream en `4205c41`) a
   `/srv/<proyecto>/supabase/volumes/`. Hacen falta: `api/envoy/{envoy.yaml,cds.yaml,lds.template.yaml,docker-entrypoint.sh}`,
   `db/{realtime,webhooks,roles,jwt,_supabase,logs,pooler}.sql` y, para los perfiles,
   `functions/main/index.ts` y `snippets/` (vacía). Crea `supabase/volumes/db/data`
   y `supabase/volumes/storage` vacíos.
3. **`.env`.** `cp .env.example .env`, rellena cada valor y genera los secretos con
   los comandos del propio archivo. `ANON_KEY`/`SERVICE_ROLE_KEY` son JWT firmados
   con `JWT_SECRET` (upstream: `utils/generate-keys.sh`). El `.env` no entra en Git.
4. **Red edge.** `docker network create <PROYECTO>_edge` (el valor de `EDGE_NETWORK`)
   y súmala al Traefik de ops (`infra/ops/traefik/compose.yml`).
5. **Imagen de la app.** O la publica el workflow de GHCR del repo del proyecto
   (copia `.github/workflows/build-image.yml` de DTD Cargo y cambia el nombre de la
   imagen), o se construye en el VPS: `docker build -f Dockerfile.next -t <proyecto>:local --build-arg NEXT_PUBLIC_SITE_URL=… .`
   desde el repo del proyecto. `WEB_IMAGE` apunta a esa imagen con tag exacto.
6. **Crontab.** Escribe `cron/crontab` con las rutas `/api/cron/*` del proyecto
   (formato en el propio archivo). Una línea por ruta, horarios en UTC.
7. **Arranque.** `docker compose config` primero (si falta una variable `:?`, lo
   dice). Luego `docker compose up -d db` y espera `healthy`; aplica las
   migraciones del proyecto (`psql` por `docker compose exec db`); después
   `docker compose up -d` y `docker compose ps`. Los perfiles se activan con
   `--profile realtime`, `--profile functions`, `--profile studio`.
8. **Backup.** `./backup.sh --dry-run` para ver los comandos; luego el cron del
   host (ver `infra/ops/README.md`).

## Verificación mínima después de levantar

- `docker compose ps` → todos `healthy`/`running`; `docker compose ps --format json | grep -c Ports` no muestra puertos publicados salvo Studio en loopback.
- `curl -sS https://<APP_DOMAIN>/` → 200; `curl -sS https://<SUPABASE_DOMAIN>/rest/v1/ -H "apikey: <ANON_KEY>"` → 200.
- `docker compose exec cron sh -c 'test -n "$CRON_SECRET" && echo ok'` → `ok`
  (sin eso, los crons devuelven 403 en silencio); `docker compose logs cron` muestra
  las ejecuciones.
- `docker compose exec web node -e "console.log(process.env.APP_ENV)"` → `production`:
  con `APP_ENV` vacío la app falla cerrado y no habilita las acciones locales.

## Límites y decisiones

- `cron` usa BusyBox crond, que hereda el entorno del contenedor (por eso
  `${CRON_SECRET}` se expande en cada línea) y también su stdout/stderr, así que
  la salida de cada curl llega a `docker logs cron`. Ambas cosas comprobadas el
  2026-10-08 con `alpine:3.24.2` (BusyBox 1.37.0). Vixie cron no lo haría. DTD
  Cargo además renderiza el crontab con `envsubst` en su entrypoint.
- `web` depende de `api-gw` sano; `api-gw` enruta hacia `studio`, `realtime` y
  `functions` aunque no estén levantados (responden 503 en esas rutas, sin afectar
  al resto).
- Studio no se publica por Traefik: bajo `--profile studio` se ata a
  `STUDIO_BIND_IP:STUDIO_PORT` (loopback por defecto; la IP de Tailscale si quieres
  entrar desde tu laptop). Envoy también lo sirve en `/` de `SUPABASE_DOMAIN` con
  basic auth (`DASHBOARD_*`), herencia del upstream.
- Memoria: `deploy.resources.limits` por servicio, ajustables en `.env`
  (`WEB_MEMORY_LIMIT`, `DB_MEMORY_LIMIT`). Suma por defecto ≈ 5,5 GB con los tres
  perfiles; sin perfiles ≈ 4 GB.
- El límite de cuerpo (12 MB) y de archivo (50 MB) lo aplican Next y Storage; no se
  usa `buffering` en Traefik porque rompe streaming y websockets.
