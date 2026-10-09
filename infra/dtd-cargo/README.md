# infra/dtd-cargo · DTD Cargo en el servidor propio (SDD-0505 · Fase 0)

Compose de la app y de Supabase self-hosted para el VPS de Contabo. Esta carpeta
se copia tal cual a `/srv/dtd-cargo/` en el servidor (runbook
[servidor-contabo.md](../../docs/runbooks/servidor-contabo.md) §1.9); el repo
solo guarda plantillas, nunca el `.env` ni los datos.

```
compose.yml               app: web (imagen de GHCR), cron, auth-templates · redes
compose.supabase.yml      overlay Supabase (db, api-gw, auth, rest, realtime, storage, imgproxy, functions; studio/meta y supavisor por perfil)
compose.supabase.s3.yml   overlay Storage sobre R2/B2 (producción)
compose.staging.yml       overlay del staging con copia de producción: solo las IP de STAGING_ALLOWED_IPS
.env.example              TODAS las variables, solo nombres y placeholders
cron/                     imagen crond+curl y el crontab GENERADO (scripts/build-crontab.mjs)
supabase/templates/       plantillas de correo de Auth (las sirve auth-templates)
supabase/volumes/         copia verbatim del upstream (ver "Origen de los volúmenes")
```

## Arrancar

```bash
/srv/ops/staging/new-env.sh --example .env.example --out .env --set …   # genera los secretos y los JWT (ver --help)
# Edge Functions: una carpeta armada con el router del upstream + las funciones del repo
mkdir -p functions && cp -r supabase/volumes/functions/. functions/ && cp -r <repo>/supabase/functions/. functions/
docker network create dtd_edge               # una vez por host; Traefik se conecta a ella
docker compose -f compose.yml -f compose.supabase.yml -f compose.supabase.s3.yml config -q   # valida
docker compose -f compose.yml -f compose.supabase.yml -f compose.supabase.s3.yml up -d
docker compose -f compose.yml -f compose.supabase.yml --profile studio up -d studio          # solo por Tailscale
```

`compose.yml` valida y arranca solo (web contra un Supabase externo, por ejemplo
staging contra la copia). Las variables críticas llevan `${VAR:?...}`: sin
`.env` el compose se niega a arrancar en vez de levantar una app a medias.

Desplegar una versión nueva = fijar `DTD_WEB_IMAGE` en `.env`
(`ghcr.io/hailuwaycom-sketch/dtdcargo:sha-<sha>`) y
`docker compose pull web && docker compose up -d web cron`.

## Claves JWT (ANON_KEY / SERVICE_ROLE_KEY)

Son JWT HS256 firmados con `JWT_SECRET`. No se copian las demo del compose
oficial (cualquiera las conoce). Con el `JWT_SECRET` ya generado:

```bash
JWT_SECRET='<el de .env>' node -e '
const c = require("node:crypto"); const s = process.env.JWT_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b64({ alg: "HS256", typ: "JWT" }); const now = Math.floor(Date.now() / 1000);
for (const role of ["anon", "service_role"]) {
  const p = b64({ role, iss: "supabase", iat: now, exp: now + 10 * 365 * 86400 });
  console.log(role.toUpperCase() + "_KEY=" + h + "." + p + "." + c.createHmac("sha256", s).update(h + "." + p).digest("base64url"));
}'
```

`ANON_KEY` = `NEXT_PUBLIC_SUPABASE_ANON_KEY` (viaja al navegador y es build arg
de la imagen); `SERVICE_ROLE_KEY` = `SUPABASE_SERVICE_ROLE_KEY` (salta la RLS,
nunca al cliente).

## Qué cambia respecto del compose oficial

Base: `docker/docker-compose.yml`, `docker-compose.s3.yml` y `.env.example` de
[supabase/supabase@4205c41](https://github.com/supabase/supabase/tree/4205c4103d3d51536cc63985c1a7f533769c0760/docker)
(2026-10-08). Mismas etiquetas de imagen. Diferencias, todas a propósito:

| Upstream | Acá | Por qué |
|---|---|---|
| 11 `container_name` | ninguno | dos proyectos (producción, staging) en el mismo host |
| `ports:` en api-gw (8000) y supavisor (5432/6543) | ninguno | nada en la IP pública; solo Traefik llega a `web` y `api-gw` |
| red `default` | `dtd_internal` (internal), `dtd_edge` (externa, Traefik), `dtd_egress` (salida a internet para auth/functions/storage/imgproxy) | aislamiento de la spec |
| `api-gw` depende de `studio` | no | Studio y meta solo con `--profile studio` (Tailscale) |
| Envoy enruta `/` → Studio, `/pg/` → postgres-meta, `/mcp`, `/realtime/v1/api` | la plantilla se conserva, pero el router de Traefik solo manda `/auth/v1`, `/rest/v1`, `/graphql/v1`, `/storage/v1`, `/functions/v1` y `/realtime/v1` (sin `/realtime/v1/api`) | postgres-meta es acceso total a la base tras una sola basic auth |
| supavisor siempre | `--profile pooler` | sin puertos publicados no sirve a nadie; ahorra ~700 MB |
| `db` con `command: postgres -c config_file=... -c log_min_messages=fatal` | lo mismo + `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=8MB`, `max_connections=100` | memoria para la VPS de 24 GB; el `config_file` NO se quita (sin él no cargan pg_cron, pg_net, pgsodium ni vault) |
| datos en `./volumes/db/data`, `./volumes/storage` | `${DTD_DATA_DIR}/db`, `${DTD_DATA_DIR}/storage` (`/srv/dtd-cargo/data`) | fuera del árbol del repo; es lo que respalda el runbook de backup |
| `./volumes/snippets` (bind) | volumen nombrado `studio-snippets` | el upstream trae `snippets/.gitkeep`; un bind inexistente lo crearía Docker como root |
| functions monta `./volumes/functions` | `${DTD_FUNCTIONS_DIR:-./functions}` (solo lectura), armada al desplegar con `main/` y `deno.jsonc` del upstream + `supabase/functions/*` del repo | las funciones reales viven en el repo; en el servidor no hay repo, y montar archivos dentro de un montaje de solo lectura impide arrancar el contenedor (medido el 2026-10-09) |
| `FUNCTIONS_VERIFY_JWT` | `false` | las 4 funciones de Kommo se autentican solas (ver `.env.example`) |
| Auth sin plantillas | `GOTRUE_MAILER_TEMPLATES_*` → `http://auth-templates/*.html`, asuntos de la casa, `MAILER_OTP_EXP=3600`, `GOTRUE_SMTP_MAX_FREQUENCY=60s`, teléfono apagado | mismas plantillas que el dashboard de Cloud |
| sin límites | `deploy.resources.limits.memory` por servicio: 9,5 GB sin perfiles, 11,25 GB con studio+meta+pooler | spec: suma de DTD ≤ 12 GB |
| MinIO en `docker-compose.s3.yml` | bucket externo (R2/B2) | menos piezas; el respaldo lo hace el proveedor |
| `.env.example` con claves demo | solo nombres y placeholders | las demo funcionan tal cual |

## Origen de los volúmenes (`supabase/volumes/`)

Copia byte a byte de `docker/volumes/` de `supabase/supabase@4205c41`. Se trajo
con `gh api -H 'Accept: application/vnd.github.raw' repos/supabase/supabase/contents/docker/volumes/<ruta>?ref=4205c41`
por archivo; se verifica contra el upstream con `sha256sum` (o por SHA de blob
con `gh api repos/supabase/supabase/git/trees/4205c41?recursive=1`). Para
refrescar: copiar la carpeta entera desde el commit nuevo, actualizar el SHA en
este README y en `compose.supabase.yml`, y revisar la tabla de arriba.

Copiados (18): `api/envoy/{cds.yaml,docker-entrypoint.sh,envoy.yaml,lds.template.yaml}`,
`api/{kong.yml,kong-entrypoint.sh}`, `db/{_supabase.sql,jwt.sql,logs.sql,pooler.sql,realtime.sql,roles.sql,webhooks.sql}`,
`db/init/data.sql`, `functions/deno.jsonc`, `functions/main/index.ts`,
`logs/vector.yml`, `pooler/pooler.exs`.

Omitidos y por qué: `functions/hello/index.ts` (función de ejemplo);
`proxy/caddy/Caddyfile` y `proxy/nginx/supabase-nginx.conf.tpl` (el TLS lo
termina Traefik); `snippets/.gitkeep` y `storage/.gitkeep` (sustituidos por el
volumen nombrado y por `DTD_DATA_DIR`). `kong.yml`/`kong-entrypoint.sh` y
`logs/vector.yml` se copian por fidelidad aunque el gateway activo es Envoy
(`api/envoy/*`) y Logflare/Vector no se levantan.

El router de Edge Functions (`functions/main/index.ts`) trae 4 líneas con
espacios al final del upstream; `.gitattributes` apaga `git diff --check` solo
para esta carpeta (`-whitespace`) para conservar la identidad con el upstream.
`tsconfig.json` y `eslint.config.mjs` excluyen `infra/`: es código Deno
(`jsr:`, global `Deno`/`EdgeRuntime`), no de la app.

## Traefik: lo que el compose no puede fijar

Las labels de `web` y `api-gw` usan el transporte largo (300 s de respuesta)
`${TRAEFIK_SERVERS_TRANSPORT:-slow-300s@file}` y declaran el tope de cuerpo de
12 MB en `web`. El transporte vive en el **proveedor de archivo**
(`infra/ops/traefik/dynamic/middlewares.yml`): Traefik no admite definir
serversTransports con labels de Docker. Hasta el 2026-10-09 el compose lo
declaraba así (`dtd-long@docker`) y la ruta quedaba rota con «servers transport
not found»; lo destapó el staging del VPS. Con otro Traefik (Dokploy, por
ejemplo), definir ese transporte en su configuración dinámica o cambiar
`TRAEFIK_SERVERS_TRANSPORT`. Además, dos cosas son configuración ESTÁTICA de
Traefik:

- `entryPoints.websecure.transport.respondingTimeouts.readTimeout: 300s`
  (default 60 s): sin esto una subida lenta de 12 MB o un import de 5 minutos
  muere en el proxy aunque las labels digan 300 s.
- El entrypoint `websecure` y el resolver `letsencrypt` existen con esos
  nombres (o se cambian `TRAEFIK_ENTRYPOINT`/`TRAEFIK_CERT_RESOLVER` en `.env`).

Pruebas después de levantar (runbook §1.8):

```bash
curl -i https://supabase.dtdcargo.com/pg/            # 404 de Traefik: postgres-meta no se expone
curl -i https://supabase.dtdcargo.com/               # 404: Studio tampoco
curl -i https://supabase.dtdcargo.com/rest/v1/       # 401 de PostgREST: la API sí
curl -i https://supabase.dtdcargo.com/realtime/v1/api/tenants   # 404: API admin de Realtime fuera
```

## Postgres y pruebas manuales

- Con la base arriba: `docker compose exec db psql -U postgres -c 'show shared_preload_libraries'`
  tiene que listar `pg_cron`, `pg_net`, `pgsodium`, `supabase_vault`… Si sale
  vacío, alguien quitó el `-c config_file=` del `command:`.
- `docker compose exec db psql -U postgres -c 'show shared_buffers'` → `1GB`.
- Desde Git Bash en Windows, `docker run ... -c config_file=/etc/postgresql/...`
  convierte la ruta a `C:/Program Files/Git/etc/...` y Postgres no arranca:
  anteponer `MSYS_NO_PATHCONV=1` al comando. Compose y `node` no sufren esa
  conversión.
- Reconstrucción del schema sobre la imagen real: `pnpm schema:rebuild:supabase`
  (estado y bloqueos en `supabase/tests/_supabase-platform-stubs.supabase.sql`).
- `kommo_run_sync()`/`kommo_run_writeback_drain()` leen la base de la URL de
  functions del secreto de Vault `functions_base_url` (migración 0472). En
  self-hosted vale `http://api-gw:8000/functions/v1` (red interna): se crea con
  `select vault.create_secret('http://api-gw:8000/functions/v1', 'functions_base_url')`
  después de restaurar la base.

## cron

`cron/crontab` lo genera `scripts/build-crontab.mjs` desde `vercel.json`
(`--check` en CI; la prueba `scripts/__tests__/build-crontab.test.ts` falla si
cambian los horarios sin regenerar). El entrypoint exige `CRON_SECRET`, instala
el crontab tal cual (el `${CRON_SECRET}` lo expande `sh -c` en cada job: BusyBox
crond hereda el entorno del contenedor, medido el 2026-10-08) y arranca
`crond -f -d 8` (log a stderr, lo que muestra `docker logs cron`). crond escribe
la línea de cada job en el log en todos los niveles; como el secreto no se
renderiza, el log muestra `Bearer ${CRON_SECRET}` literal y nunca el valor. La
salida de cada curl (JSON de la ruta o `curl: (22) ... 401`) va directo a los
mismos logs: en modo `-f -d` crond no usa sendmail.

## Diferencias conocidas con Vercel

- La pestaña Norte de `/studio/debug` no tiene snapshot (`/norte.html`): el
  `postbuild` que lo hornea lee docs internos que no viajan en la imagen.
- `web` ve el `.env` completo (incluidos `JWT_SECRET` y `POSTGRES_PASSWORD`).
  Ya tiene `SERVICE_ROLE_KEY`, que equivale en poder; si algún día se quiere
  separar, el camino es un `app.env` propio para `web`.
