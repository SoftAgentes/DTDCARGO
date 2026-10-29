# Registro de evidencia · SDD-0583 (E1 de SDD-0582) · 2026-10-29

Etiquetas del programa: **C** el código lo permite · **D** el proveedor lo documenta · **T** la cuenta o el host de DTD lo tiene · **R** probado en runtime · **I** inferencia · **NV** no verificado.

Fuente del código: la imagen `chatwoot/chatwoot:v4.19.1-ce`, digest `sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf` (`docker pull` del 2026-10-29), leída dentro del contenedor. Las rutas son relativas a `/app`. Runtime: Docker Desktop 29.9.1 local (22 CPU, 16 GiB), **solo datos sintéticos**. Nada se ejecutó en el VPS salvo la lectura de la fila T-1.

## Host (lectura sin cambios, 2026-10-29 ~09:00Z)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-1 | En el VPS: **Tailscale no está instalado**; Compose 5.6.0; corren `ops-traefik-traefik-1` y `ops-uptime-kuma-uptime-kuma-1`; redes edge `dtd_edge`, `loop-3d_edge`, `loop-3d-staging_edge`, `rent-awada-pruebas_edge`; `/srv/ops/backup/` tiene `age-recipients.txt` y `rclone/`; disco `/` 49 % usado (150 GB libres); presión de CPU `some` avg300 = 29,34 %; ufw permite 22, 80 y 443 desde cualquier origen | `ssh root@217.216.54.70` con `tailscale`, `docker ps --format {{.Names}}`, `docker network ls`, `ls`, `df`, `/proc/pressure/cpu`, `ufw status`. Sin leer contenedores, bases ni datos | T |

## Código de Chatwoot 4.19.1

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| E1-C1 | `MAX_USER_SESSIONS` existe, por defecto 25 | `app/controllers/devise_overrides/sessions_controller.rb:116` | C |
| E1-C2 | `ENABLE_ACCOUNT_SIGNUP` vive en la base (InstallationConfig, `false` en la semilla); el entorno solo cuenta si la base está vacía | `config/installation_config.yml:61-64`, `lib/global_config_service.rb` | C |
| E1-C3 | El cifrado de columnas se activa con `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY` y tiene `support_unencrypted_data = true` | `config/application.rb:75-84` | C |
| E1-C4 | Columnas cifradas: `Webhook#secret`, `Channel::Email` (IMAP/SMTP), `Channel::FacebookPage` (tokens), `Channel::Whatsapp#business_management_token`, `Integrations::Hook#access_token`, `User#otp_*`, `DataImport#access_token` | `grep encrypts` en `app/models` | C |
| E1-C5 | La CSP de Rails está vacía (todo comentado): Chatwoot no manda `Content-Security-Policy` | `config/initializers/content_security_policy.rb` | C |
| E1-C6 | `LOG_LEVEL` se lee con `ENV.fetch(...).to_sym`: un valor vacío rompe | `config/environments/production.rb:50` | C |
| E1-C7 | Línea 13 de `AgentBots::WebhookJob` escribe `payload=#{payload.to_json}` (confirma CW-4) | `app/jobs/agent_bots/webhook_job.rb:13` | C |
| E1-C8 | El manejador de errores por defecto de Sidekiq 7.3.10 vuelca el contexto del trabajo (con `args`) | gema `sidekiq` 7.3.10, `lib/sidekiq/config.rb` (`ERROR_HANDLER`) | C |
| E1-C9 | Telemetría con conteos salvo `DISABLE_TELEMETRY`; relay de push por defecto encendido | `lib/chatwoot_hub.rb:88` y `:122`; `app/services/notification/push_notification_service.rb:115` | C |
| E1-C10 | Gravatar con el MD5 del correo del contacto, salvo `DISABLE_GRAVATAR` | `app/models/concerns/avatarable.rb:21-27`, `app/jobs/avatar/avatar_from_gravatar_job.rb:5-9` | C |
| E1-C11 | Sin `IP_LOOKUP_API_KEY` no se descarga MaxMind | `app/services/geocoder/setup_service.rb:7-10` | C |
| E1-C12 | Una instalación nueva manda a `/installation/onboarding`, que crea un super admin para el primer visitante | `app/controllers/dashboard_controller.rb:60`, `app/controllers/installation/onboarding_controller.rb:8-15` | C |
| E1-C13 | `GET /api` responde versión, `queue_services` y `data_services` (`ok` / `failing`) | `app/controllers/api_controller.rb:4-8` | C |
| E1-C14 | `/monitoring/sidekiq` (Sidekiq web) va montado bajo `authenticated :super_admin` | `config/routes.rb:827-829` | C |
| E1-C15 | Puma usa `WEB_CONCURRENCY` (0 = sin forks) y `RAILS_MAX_THREADS`; Sidekiq, `SIDEKIQ_CONCURRENCY` (10 por defecto) | `config/puma.rb`, `config/sidekiq.yml` | C |
| E1-C16 | El esquema exige la extensión `vector` (pgvector) | `db/schema.rb:19` | C |

## Ensayo local (`infra/chatwoot/pruebas/ensayo-local.sh`)

Imágenes: `chatwoot/chatwoot:v4.19.1-ce@sha256:04895c7b…`, `pgvector/pgvector:0.8.1-pg16`, `redis:7.2.11-alpine`, `traefik:v3.7.14` (la de producción) con `infra/ops/traefik/dynamic` montado tal cual, `axllent/mailpit:v1.31.3`, `traefik/whoami:v1.11.0`, `curlimages/curl:8.17.0`.

Corridas: 1.ª 09:05Z (6 fallas: el ensayo mismo y el hallazgo del onboarding), 2.ª 09:15Z (3 fallas: filtro del manifiesto, Gravatar aún sin variable y el control de claves), 3.ª 09:22Z (0 fallas, 18/18), **4.ª 09:29Z con R4b: 0 fallas, 19/19** (E1-R20). La tabla da los valores de la 3.ª; la 4.ª los repite salvo lo indicado.

| ID | Comprobación | Resultado (3.ª corrida) | Etiqueta |
|---|---|---|---|
| E1-R1 | A1 · control **sin** redacción: la sonda encuentra los datos sintéticos | correo 6, teléfono 7, contenido 7, `payload=` 1 | R |
| E1-R2 | C1 · `GET /api` por Traefik | `"version":"4.19.1"` | R |
| E1-R3 | C2 · registro cerrado | valor efectivo `false`; `POST /api/v1/accounts` → 404 | R |
| E1-R4 | C3 · cabeceras de `/app/login` | sin `X-Frame-Options`; `Content-Security-Policy: frame-ancestors 'self' https://studio.prueba.test` | R |
| E1-R5 | C4 · admin por IP | desde «internet»: `/super_admin` 403, `/monitoring` 403, `/installation/onboarding` 403; desde 100.64.250.200: `/super_admin` 200, `/installation/onboarding` 200 | R |
| E1-R6 | C4b · onboarding cerrado por consola | `/installation/onboarding` → 302; `/app/login` desde internet → 200. **Antes** del cierre, `/app/login` daba 302 a `/installation/onboarding` (1.ª corrida) | R |
| E1-R7 | C5 · access log de Traefik | `whoami.prueba.test` 1 línea (control); `chat.prueba.test` 0 | R |
| E1-R8 | C6 · **con** redacción | correo 0, teléfono 0, contenido 0, `payload=` 0 en Rails + Sidekiq + salida del runner; 0 en Traefik; `[REDACTADO]` 1, `[FILTERED]` 3 | R |
| E1-R9 | C7 · entorno efectivo | `MAX_USER_SESSIONS=5`, `DISABLE_TELEMETRY=true`, `ENABLE_PUSH_RELAY_SERVER=false`, `ENABLE_ACCOUNT_SIGNUP=false`, `DISABLE_GRAVATAR=true`; `GlobalConfigService.load('DISABLE_GRAVATAR')` presente | R |
| E1-R10 | C8 · consumo en reposo (≈1 min después de arrancar; 2.ª corrida) | rails 485 MiB / 1,5 GiB, sidekiq 406 MiB / 1,25 GiB, postgres 58 MiB / 768 MiB, redis 7 MiB / 192 MiB; CPU < 0,3 % cada uno. Límites aplicados: NanoCpus 1,0/0,75/0,75/0,25, `CpuShares` 512, `OomScoreAdj` 500, PIDs 512 en rails y sidekiq | R |
| E1-R11 | Arranque desde cero (prepare + rails + sidekiq hasta sanos) | 46 s | R |
| E1-R12 | R0 · el secreto del webhook queda cifrado en la base | sobre `{"p":…` | R |
| E1-R13 | R1/R1b · `respaldo.sh` | sale 0; piezas `db.dump.age`, `storage.tar.age`, `env.age`, `manifiesto.txt`; manifiesto sin correos ni contenido; `dump_entradas=1150` | R |
| E1-R14 | R2 · `restaurar.sh` en un proyecto nuevo | conteos (cuentas 1, usuarios 1, contactos 1, conversaciones 1, mensajes 4, adjuntos 1) y archivos (1) iguales al manifiesto; columnas cifradas `total=1 sobres=0`; tiempos: claves 2 s, base 17 s, adjuntos 1 s, arranque 31 s, verificación 6 s, **total 57 s** | R |
| E1-R15 | R3/R3b · huellas | adjunto y secreto con la misma sha256 que en el origen; el restaurado responde `4.19.1` en su propio host | R |
| E1-R16 | R4 · control: misma base con **otras** claves | **sin error**: el secreto se lee como el sobre cifrado (`secreto_es_sobre_cifrado=si`), huella distinta. `restaurar.sh` lo detecta: `CLAVES total=1 sobres=1` y sale ≠ 0 | R |
| E1-R17 | 1.4 · Platform API (stack local de la 1.ª corrida) | `PlatformApp.create!` da un token de 24 caracteres; `POST /platform/api/v1/accounts` crea la cuenta; `POST …/users` y `…/account_users` → 200; sin token → 401; sobre una cuenta que esa app no creó → 401; `GET …/users/{id}/login` → `/app/login?email=…&sso_auth_token=…` (correo y token en la query) | R |
| E1-R18 | 1.6 · `vigilar.sh` en `docker:29-cli` contra el stack local | dos corridas `up · ok` con las 24 columnas; `--resumen` con p50/p95/máx; control con `UMBRAL_PSI_CPU300=0 UMBRAL_MEM_LIMITE=1` → `down` con cinco motivos | R |
| E1-R19 | `docker compose config -q` con `.env.example` | valida; con un `.env` vacío se niega (`CHATWOOT_POSTGRES_PASSWORD falta en .env`, …) | R |
| E1-R20 | 4.ª corrida completa (09:29Z) | **19/19 PASÓ**: R4b `restaurar.sh` con otras claves sale 1 con `CLAVES total=1 sobres=1`; arranque desde cero 52 s; restauración 68 s (claves 2, base 19, adjuntos 1, arranque 39, verificación 7). Al terminar no quedó ningún contenedor ni red de prueba | R |

## Inferencias y pendientes

| ID | Afirmación | Etiqueta |
|---|---|---|
| E1-I1 | El consumo en reposo (≈0,95 GiB) deja margen bajo el techo de 3,7 GiB; con canales y uso real (E4) crecerá, sobre todo Sidekiq | I |
| E1-I2 | La CPU es el riesgo (VPS-7): en reposo Chatwoot no la usa; el pico estará en E4/E5 (carga del historial) | I |
| E1-NV1 | Que Traefik vea la IP `100.x` de Tailscale sin NAT en el VPS real | NV (puerta P3) |
| E1-NV2 | Comportamiento con `FORCE_SSL=true` detrás del Traefik real (en local va en `false`, HTTP plano) | NV (puerta P1, comprobación 3 del runbook) |
| E1-NV3 | Certificado de Let's Encrypt para `chat.dtdcargo.com` | NV (puertas P1 y P2) |
