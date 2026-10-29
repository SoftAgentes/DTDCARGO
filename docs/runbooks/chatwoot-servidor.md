# Runbook · Chatwoot en el VPS del ERP · SDD-0583

**SDD:** [0583](../specs/0583-chatwoot-vps-e1/spec.md) (etapa E1 del programa [0582](../specs/0582-chatwoot-piloto/spec.md))
**Estado:** probado en local (2026-10-29). **Nada desplegado.** Cada sección que toca el VPS, el DNS o Tailscale dice qué puerta de Sam necesita.
**Relacionados:** [respaldo y restauración](chatwoot-respaldo-restauracion.md) · [vigilancia](chatwoot-vigilancia.md) · [servidor Contabo](servidor-contabo.md) · [revisión de datos personales](../legal/privacidad/revision-chatwoot-e1-2026-10-29.md)

## 1 · Qué se instala y dónde

Chatwoot CE `v4.19.1-ce` en el mismo VPS que la producción de DTD (decisión E0-D1), como proyecto de Compose aparte:

```
/srv/chatwoot/                 ← copia de infra/chatwoot/ (sin pruebas/)
├── compose.yml                ← prepare, rails, sidekiq, postgres (pgvector), redis
├── .env                       ← 0600; generado aquí (§2); NUNCA en git
├── rails/zz_dtd_redaccion_logs.rb
├── respaldo.sh · restaurar.sh · vigilar.sh
└── data/                      ← postgres/, redis/, storage/ (adjuntos)
/srv/backups/chatwoot/         ← respaldos cifrados locales, 7 días
```

| Servicio | Límite CPU | Límite memoria | Red |
|---|---|---|---|
| rails (Puma, 5 hilos, sin workers) | 1,0 | 1,5 GiB | `chatwoot_edge` + `interna` |
| sidekiq (5 hilos) | 0,75 | 1,25 GiB | `interna` + `salida` |
| postgres 16 + pgvector 0.8.1 | 0,75 | 768 MiB | `interna` |
| redis 7.2.11 | 0,25 | 192 MiB | `interna` |
| prepare (solo al desplegar) | 1,0 | 1,5 GiB | `interna` |

Todos llevan `cpu_shares: 512` (DTD conserva el doble de peso con la CPU disputada) y `oom_score_adj: 500` (el kernel mata primero a Chatwoot si falta memoria). El porqué de cada número está en la spec (E1-D2) y el consumo medido en el [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md).

## 2 · Generar el `.env` (en el servidor, dentro de la puerta P1)

```bash
cd /srv/chatwoot
install -m 600 /dev/null .env && cp .env.example .env && chmod 600 .env
# Secretos aleatorios, sin que pasen por la pantalla ni el historial:
for v in CHATWOOT_SECRET_KEY_BASE:64 CHATWOOT_POSTGRES_PASSWORD:32 CHATWOOT_REDIS_PASSWORD:32; do
  n="${v%%:*}"; b="${v##*:}"; s="$(openssl rand -hex "$b")"
  sed -i "s|^$n=.*|$n=$s|" .env; unset s
done
# Claves de cifrado de columnas: las imprime la propia imagen; se pegan en el .env.
docker run --rm --entrypoint "" chatwoot/chatwoot:v4.19.1-ce bundle exec rails db:encryption:init 2>/dev/null \
  | awk '/primary_key:/ {print "CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=" $2}
         /deterministic_key:/ {print "CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=" $2}
         /key_derivation_salt:/ {print "CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=" $2}' >/dev/shm/cw-ar.env
while IFS='=' read -r n s; do sed -i "s|^$n=.*|$n=$s|" .env; done </dev/shm/cw-ar.env; rm -f /dev/shm/cw-ar.env
grep -c '<generar' .env      # tiene que dar 0
```

Después, a mano: `CHATWOOT_SMTP_USERNAME` y `CHATWOOT_SMTP_PASSWORD` (la casilla que Sam indique), y las URL Push de Uptime Kuma (§[vigilancia](chatwoot-vigilancia.md) 2). **El mismo día, Sam guarda una copia del `.env` en su gestor de contraseñas:** sin `SECRET_KEY_BASE` y las tres claves de cifrado, un respaldo no se puede leer entero (lo prueba el control R4 del ensayo).

Comprobar sin imprimir valores (regla de la casa: nombre y largo, nunca el valor):

```bash
awk -F= '/^CHATWOOT_/ { printf "%-45s %3d\n", $1, length($2) }' .env
docker compose config -q && echo config-ok
```

## 3 · Red y Traefik (puerta P1)

El Traefik compartido (`ops-traefik-traefik-1`) solo ve las redes edge a las que está conectado. Chatwoot usa la suya:

```bash
docker network create chatwoot_edge
docker network connect chatwoot_edge ops-traefik-traefik-1    # en caliente: Traefik NO se reinicia
```

Para que sobreviva a una recreación de Traefik, agregar `chatwoot_edge` (external) a `services.traefik.networks` y a `networks:` en `/srv/ops/traefik/compose.yml` (y en `infra/ops/traefik/compose.yml`, en la PR que lo despliegue). Recrear Traefik corta todos los sitios unos segundos: **no** se hace en el despliegue de Chatwoot.

Routers que declara `rails` (labels en `compose.yml`, prefijo = nombre del proyecto):

| Router | Regla | Middlewares | Access log |
|---|---|---|---|
| `chatwoot-chat` | `Host(chat.dtdcargo.com)` | `chatwoot-marco`, `security-headers@file` | apagado |
| `chatwoot-admin` (prioridad 1000) | mismo host y `/super_admin`, `/monitoring` o `/installation` | `tailscale-only@file`, `chatwoot-marco`, `security-headers@file` | apagado |

`chatwoot-marco` borra `X-Frame-Options` (Rails manda `SAMEORIGIN`) y fija `Content-Security-Policy: frame-ancestors 'self' <CHATWOOT_FRAME_ANCESTORS>`. Chatwoot 4.19.1 no manda CSP propia (`config/initializers/content_security_policy.rb` vacío), así que la de Traefik no pisa nada. El otro lado del iframe (la `frame-src` y `Permissions-Policy` de Studio) es de E2.

**TLS:** el resolver `letsencrypt` del Traefik compartido, con desafío HTTP-01. Funciona con o sin proxy de Cloudflare.

## 4 · DNS (puerta P2) y administración (puerta P3)

**DNS, en Cloudflare** (el DNS de `dtdcargo.com` está ahí, C-1 del registro E0): registro `A chat → 217.216.54.70`. Recomendación (E1-D9): **sin proxy** (nube gris).

- Con proxy, Cloudflare termina TLS y ve cada mensaje: sería un tercero más con todas las conversaciones (revisión de datos E1, H3).
- Con proxy, Rails ve la IP de Cloudflare y el límite por IP de Rack::Attack mete a todos en la misma bolsa, porque `TRUSTED_PROXY_CIDRS` del Traefik no incluye los rangos de Cloudflare.
- Sin proxy, se expone la IP del VPS; hoy ya es pública (ufw deja 80 y 443 abiertos a todos y el SSH también).

**`/super_admin` y `/monitoring`:** solo desde `100.64.0.0/10`. **El VPS no tiene Tailscale** (comprobado el 2026-10-29), así que hoy nadie entra por web, ni siquiera Sam. Mientras tanto, lo de super admin se hace por consola sobre SSH:

```bash
cd /srv/chatwoot
docker compose exec rails bundle exec rails runner 'p GlobalConfigService.account_signup_enabled?'   # false
docker compose exec rails bundle exec rails c      # consola, solo si hace falta
```

Con Tailscale instalado (puerta P3, runbook servidor-contabo §1.5), Sam entra a `https://chat.dtdcargo.com/super_admin` desde su equipo resolviendo `chat.dtdcargo.com` a la IP de Tailscale del VPS (línea en su `hosts`, o DNS dividido de la tailnet). El certificado es el mismo, y Traefik ve la IP `100.x` y deja pasar. Que la regla deja pasar a la tailnet y frena a internet lo prueba el ensayo local (C4). Que la IP de origen llegue sin NAT por la interfaz de Tailscale está **NO VERIFICADO**: se comprueba al instalarla.

## 5 · Desplegar (puerta P1)

```bash
# Desde el equipo de Sam: copiar la carpeta, sin pruebas/
scp -r infra/chatwoot/{compose.yml,.env.example,.gitignore,README.md,respaldo.sh,restaurar.sh,vigilar.sh,rails,systemd} root@217.216.54.70:/srv/chatwoot/
# En el VPS:
cd /srv/chatwoot && chmod 700 respaldo.sh restaurar.sh vigilar.sh
mkdir -p data/postgres data/redis data/storage /srv/backups/chatwoot
# (§2: .env) y (§3: red y Traefik)
docker compose pull
docker compose up -d --wait                       # prepare crea la base y migra; después rails y sidekiq
# EN SEGUIDA, antes del DNS: cerrar el onboarding. Una instalación nueva manda todo a
# /installation/onboarding, donde el PRIMER visitante crea el super admin
# (onboarding_controller.rb). Traefik ya bloquea /installation desde internet; esto
# lo cierra también en Rails.
docker compose exec -T rails bundle exec rails runner \
  'Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING); print "onboarding=", Redis::Alfred.get(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING).inspect'
curl -s https://chat.dtdcargo.com/api             # {"version":"4.19.1",…,"queue_services":"ok","data_services":"ok"}
```

El super admin de la instancia (para `/super_admin`) se crea por consola cuando haga falta y con Tailscale arriba (`SuperAdmin.create!` en `rails c`); para E1 no hace falta: la Platform App (§6) no lo necesita.

Comprobaciones posteriores (cada una con su resultado en el handoff):

1. `GET /api` da `4.19.1` y los dos servicios `ok`.
2. Registro cerrado: el `rails runner` de §4 imprime `false`, y `POST /api/v1/accounts` no crea cuenta.
3. `curl -sI https://chat.dtdcargo.com/app/login` sin `X-Frame-Options` y con `frame-ancestors 'self' https://dtdcargo.com`.
4. `curl -s -o /dev/null -w '%{http_code}' https://chat.dtdcargo.com/super_admin/sign_in` → `403`; lo mismo con `/monitoring/sidekiq` y `/installation/onboarding`; `/app/login` → `200`.
5. Logs: `docker compose logs rails sidekiq | grep -c 'redacción de logs activa'` ≥ 2.
6. La web de DTD sigue igual: `infra/ops/web/smoke-web.sh` y el monitor de Uptime Kuma de DTD en verde.

**Vuelta atrás:** `docker compose down` (los datos quedan en `data/`), `docker network disconnect chatwoot_edge ops-traefik-traefik-1` y, si hace falta, borrar el registro DNS. Nada de esto toca a DTD.

## 6 · Platform App, cuenta y usuario de servicio (paso 1.4, puerta P4)

Después del despliegue. La Platform API crea cuentas y usuarios sin abrir el registro. El token sale una sola vez y va al gestor de contraseñas de Sam y a los secretos de Studio (E2); nunca a git ni al chat.

```bash
cd /srv/chatwoot
# 1. La Platform App y su token (en /dev/shm, 0600).
# (rails runner también escribe líneas de log en stdout: el token va marcado y se extrae)
docker compose exec -T rails bundle exec rails runner \
  'app = PlatformApp.create!(name: "DTD Studio"); print "TOKEN:" + app.access_token.token' 2>/dev/null \
  | grep -o 'TOKEN:[A-Za-z0-9_-]*' | cut -d: -f2 | tr -d '\n' >/dev/shm/cw-platform-token
chmod 600 /dev/shm/cw-platform-token; wc -c /dev/shm/cw-platform-token     # 24 caracteres en 4.19.1
# 2. La cuenta de DTD por API.
T="$(cat /dev/shm/cw-platform-token)"
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/accounts -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"name":"DTD Cargo","locale":"es"}'
# 3. Usuario de servicio (sin persona detrás) y su rol en la cuenta.
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/users -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"name":"Servicio DTD Studio","email":"servicio-chatwoot@dtdcargo.com","password":"<generar>"}'
curl -s -X POST https://chat.dtdcargo.com/platform/api/v1/accounts/<id>/account_users -H "api_access_token: $T" \
  -H 'Content-Type: application/json' -d '{"user_id":<id>,"role":"administrator"}'
unset T; shred -u /dev/shm/cw-platform-token
```

Los usuarios de personas (Sam y la persona que atiende, E0-D2) los da de alta Studio en E2.7, no a mano aquí.

## 7 · Operación diaria

| Qué | Cómo |
|---|---|
| Estado | `docker compose ps` · `curl -s https://chat.dtdcargo.com/api` |
| Logs | `docker compose logs --since 1h rails sidekiq` (redactados; 10 MB × 5 por contenedor) |
| Consumo | `docker stats --no-stream $(docker compose ps -q)` |
| Reiniciar un servicio | `docker compose restart sidekiq` (no toca a DTD) |
| Subir de versión | **No** con `pull` suelto: es la etapa E3 (runbook de versiones, respaldo antes, ensayo de redacción después) |
| Respaldo | [chatwoot-respaldo-restauracion.md](chatwoot-respaldo-restauracion.md) |
| Vigilancia | [chatwoot-vigilancia.md](chatwoot-vigilancia.md) |

## Registro

| Fecha | Qué | Quién | Evidencia |
|---|---|---|---|
| 2026-10-29 | Configuración escrita y probada en local (`pruebas/ensayo-local.sh`). Nada en el VPS | Worker SDD-0583 | [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md) |
