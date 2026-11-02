# Registro de evidencia · SDD-0583 (E1 de SDD-0582) · 2026-10-29

Etiquetas del programa: **C** el código lo permite · **D** el proveedor lo documenta · **T** la cuenta o el host de DTD lo tiene · **R** probado en runtime · **I** inferencia · **NV** no verificado.

Fuente del código: la imagen `chatwoot/chatwoot:v4.19.1-ce`, digest `sha256:04895c7bd0550d9e74b45b7202787b56f7ee4e891ebbde0c429c8c32901b97cf` (`docker pull` del 2026-10-29), leída dentro del contenedor. Las rutas son relativas a `/app`. Runtime: Docker Desktop 29.9.1 local (22 CPU, 16 GiB), **solo datos sintéticos**. Nada se ejecutó en el VPS salvo la lectura de la fila T-1.

## Host (lectura sin cambios, 2026-10-29 ~09:00Z)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-1 | En el VPS: **Tailscale no está instalado**; Compose 5.6.0; corren `ops-traefik-traefik-1` y `ops-uptime-kuma-uptime-kuma-1`; redes edge `dtd_edge`, `loop-3d_edge`, `loop-3d-staging_edge`, `rent-awada-pruebas_edge`; `/srv/ops/backup/` tiene `age-recipients.txt` y `rclone/`; disco `/` 49 % usado (150 GB libres); presión de CPU `some` avg300 = 29,34 %; ufw permite 22, 80 y 443 desde cualquier origen (**corregido por T-17**: Docker no pasa por ufw y 80/443 solo aceptan a Cloudflare) | `ssh root@217.216.54.70` con `tailscale`, `docker ps --format {{.Names}}`, `docker network ls`, `ls`, `df`, `/proc/pressure/cpu`, `ufw status`. Sin leer contenedores, bases ni datos | T |

## Despliegue en el VPS (puerta P1, «Autorizo P1» de Sam, 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-2 | Antes de tocar: no existían `/srv/chatwoot` ni la red `chatwoot_edge`; Traefik en `dtd_edge`, `loop-3d_edge` y `rent-awada-pruebas_edge`, 0 reinicios desde el 2026-10-22 18:31Z; `age` y `flock` en el host; `rclone.conf` con sección `[b2]`; 1 clave pública en `age-recipients.txt`; 14,7 GiB disponibles; web de DTD 200 en 0,57 s | ssh, 15:38Z | T |
| T-3 | Línea base sin Chatwoot: presión de CPU `some` avg300 40,71 % (15:38Z), 45,95 % y 44,85 % (15:43Z); TTFB de la web de DTD 0,34–0,43 s desde el VPS | `/proc/pressure/cpu`; `vigilar.sh` (dos muestras, CSV) | T |
| T-4 | `/srv/chatwoot` copiado; `compose.yml` y el inicializador de redacción con el mismo sha256 que el repo | `sha256sum` en los dos lados | R |
| T-5 | `.env` 0600 generado en el servidor: 24 variables con valor y 4 vacías a propósito (SMTP usuario y clave, dos latidos); ningún valor impreso | `awk` de nombre y largo | R |
| T-6 | `chatwoot_edge` creada y `ops-traefik-traefik-1` conectado **sin reinicio** (mismo `StartedAt`, sano); la web de DTD siguió en 200 | `docker inspect`, `curl` | R |
| T-7 | `docker compose up -d --wait`: `prepare` salió 0, postgres/redis/sidekiq sanos, **`rails` unhealthy**: con `FORCE_SSL=true` el healthcheck por http recibe 301 a https (con `X-Forwarded-Proto: https` responde `{"status":"woot"}`). Traefik no enruta a contenedores unhealthy. Arreglo: cabecera en el healthcheck; tras el `up`, los cuatro sanos | `wget -S`, `docker inspect` | R |
| T-8 | Comprobaciones del runbook §5 contra el Traefik real (`--resolve`, sin DNS): `/api` → 4.19.1 con `queue_services` y `data_services` `ok`; registro `false` y `POST /api/v1/accounts` → 404; Gravatar apagado; `/app/login` → 200 con `content-security-policy: frame-ancestors 'self' https://dtdcargo.com`, HSTS y **sin** `X-Frame-Options`; `/super_admin/sign_in`, `/monitoring/sidekiq` e `/installation/onboarding` → 403; redacción activa en rails y sidekiq; 0 líneas del host de Chatwoot en el access log de Traefik | `/root/comprobar-p1-chatwoot.sh` | R |
| T-9 | Onboarding cerrado por consola antes de cualquier DNS (`ONB=nil`) | `rails runner` | R |
| T-10 | DTD intacto: los 11 contenedores de `dtd-cargo` seguían «Up 4 days» / «Up 10 days»; web 200 en 0,88 s. Consumo de Chatwoot en el VPS al arrancar: rails 376 MiB, sidekiq 437 MiB, postgres 57 MiB, redis 4 MiB | `docker ps`, `docker stats` | R |
| T-11 | Let's Encrypt rechazó el certificado de `chat.dtdcargo.com` (sin DNS), una vez, a las 15:52Z | log de Traefik | R |
| T-12 | Primer respaldo real: 44 s, `success`, 4 archivos en `b2:dtdcargo-respaldos/chatwoot/chatwoot-20261029T155439Z` y `rclone check` sin diferencias (`dump_entradas=1146`, 0 filas de negocio); timers `chatwoot-respaldo` (06:30 UTC) y `chatwoot-vigilancia` (5 min) activos; monitores Push #6 y #7 creados en Uptime Kuma y en verde tras el primer latido | `systemctl`, log del respaldo, panel de Uptime Kuma | R |

## DNS (puerta P2, «Autorizo P2» de Sam, 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-13 | Antes: ningún registro con «chat» entre los 19 de la zona; `dns.google` sin respuesta para A, AAAA y CNAME. La web, `supabase.`, `prueba.`, `supabase-prueba.` y `vps.` van con proxy de Cloudflare | panel DNS de Cloudflare (sesión de Sam), `dns.google` | T |
| T-14 | Creado `A chat.dtdcargo.com → 217.216.54.70`, **Solo DNS**, TTL automático (20 de 200 registros). Cloudflare muestra el aviso «Tu dirección IP del servidor de origen está parcialmente expuesta» (aceptado en E1-D9) | panel DNS de Cloudflare, 16:11Z | T |
| T-15 | La autoritativa (`cloudflare-dns.com`) responde `217.216.54.70` al instante; `dns.google` y el VPS siguen con el caché negativo del intento de las 15:52Z (SOA mínimo 1800 s); a las 16:25Z ya resuelven los dos | DoH, `getent` | R |
| T-16 | Segundo intento de certificado (16:28Z, tras recrear `rails`): Let's Encrypt **no llega al puerto 80** («Timeout during connect (likely firewall problem)») y Traefik sigue con su certificado por defecto | log de Traefik, `openssl s_client` | R |
| T-17 | Causa: desde el **2026-10-22** el VPS tiene `/usr/local/sbin/cloudflare-origin-firewall`, que pone en `DOCKER-USER` la cadena `CF-WEB-ORIGIN`: todo lo que entra por `eth0` a 80/443 solo pasa si viene de uno de los 15 rangos de Cloudflare; lo demás se descarta. ufw todavía muestra 80/443 abiertos, pero Docker no pasa por ufw. **Corrige T-1 y E1-D9**: el origen NO es público para la web; solo SSH (22) lo es | `iptables -S DOCKER-USER`, `iptables -S CF-WEB-ORIGIN`, `ls -la` del script | T |
| T-18 | Consecuencia: con el registro sin proxy, ni Let's Encrypt ni los navegadores llegan a `chat.dtdcargo.com`. Por la tailnet (otra interfaz, no `eth0`) la regla no aplica | lectura de la regla (`-i eth0`) | C |
| T-19 | Proxy activado en el registro `chat` («Redirigido mediante proxy»; nombre, tipo, IP y TTL sin cambios; ningún otro registro ni ajuste de la zona tocado). Autorización de Sam: «Sí, actívalo» en la sesión del programa y «Confirmo» en esta. El DNS público pasa a dar IP de Cloudflare | panel DNS de Cloudflare 16:49Z; DoH | T |
| T-20 | Tercer intento de certificado (16:52Z, tras recrear `rails`): «The server validated our request» y «Server responded with a certificate». Certificado de origen: Let's Encrypt YR2, `CN=chat.dtdcargo.com`, vence el 2027-01-27 | log de Traefik; `openssl s_client` en el VPS | R |
| T-21 | Por Cloudflare, desde afuera: `/api` → 200 con 4.19.1 y servicios `ok`, TLS verificado; `/app/login` → 200 con `frame-ancestors 'self' https://dtdcargo.com`, HSTS y sin `X-Frame-Options`; `/super_admin/sign_in`, `/monitoring/sidekiq` e `/installation/onboarding` → 403. DTD: web 200 y los 11 contenedores sin reiniciar | `curl` desde la PC de Sam y en el VPS | R |
| T-22 | Monitores HTTP «Chatwoot · API» (60 s, 2 reintentos, palabra clave de los dos servicios `ok`) y «Chatwoot · versión» (3600 s, `"version":"4.19.1"`) creados y en verde («keyword is found»). Con los dos Push, los cuatro monitores de Chatwoot en verde | panel de Uptime Kuma, 16:56Z | T |

## Platform App (puerta P4, «Autorizo P4» de Sam, 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-23 | Antes: 0 Platform Apps, 0 cuentas, 0 usuarios. Creados por `rails runner` + Platform API sobre `https://chat.dtdcargo.com`: Platform App «DTD Studio» (token de 24 caracteres), cuenta «DTD Cargo» (id 1, `locale=es`), usuario «Servicio DTD Studio» (id 1, `servicio-chatwoot@dtdcargo.com`, confirmado) con rol `administrator` (`account_users` → 200). Comprobado: GET de la cuenta propia → 200; sin token → 401; registro público sigue en `false`. Después: 1 app, 1 cuenta, 1 usuario | `/root/p4-chatwoot.sh` en el VPS | R |
| T-24 | Token, ids, correo y clave del usuario de servicio en `/srv/chatwoot/secretos/platform-app.env` (carpeta 0700, archivo 0600, root); ningún valor impreso. El token también vive en la base (tabla `access_tokens`), así que el respaldo conjunto lo cubre | `ls -ld`, `awk` de nombre y largo | R |

## P5 y llave de respaldos (2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-25 | P5 («Autorizo P5»): respaldo `chatwoot-20261029T183240Z` bajado de B2 (4 archivos) y restaurado con `restaurar.sh` en el proyecto `chatwoot-ensayo` (sin Traefik, `/srv/chatwoot-ensayo`). Integridad OK. Conteos iguales al manifiesto: cuentas 1, usuarios 1, el resto 0. Columnas cifradas `total=0 sobres=0`. Tiempos: claves 1 s, base 24 s, adjuntos 6 s, arranque 142 s, verificación 27 s, **total 200 s** (207 s con la bajada). `/api` 4.19.1 por dentro y `traefik.enable=false`. Después, `down -v` y carpeta borrada: 0 contenedores, 0 restos en `/dev/shm`. Producción de Chatwoot sana | `/srv/ops/evidencias/p5-llave-sam-20261029T183444Z.txt` | R |
| T-26 | La llave del 2026-10-14 (`f4aab8d9…`) no apareció. Con «Autorizo las dos» de Sam y la coordinación del Director: respaldos viejos copiados a `archivo-llave-2026-10-14/` (115 objetos, 0 diferencias); llaves nuevas `Sam-2026-10-29` (`f0bdbaa91af5fc7c`) y `Emergencia-2026-10-29` (`f2b06f66dad23591`), generadas en la PC de Sam, con solo las públicas en el VPS; respaldos nuevos de DTD y Chatwoot; restauración de DTD 5 PASÓ (RTO 52 s) con la de emergencia; con la del gestor se descifran los 7 archivos. Detalle en `docs/runbooks/backup-restore-servidor.md`, «Registro · 2026-10-29» | evidencias `p5-llave-*` | R |

## Marca de DTD (paso 1.3, «Autorizo la marca» de Sam, 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-27 | Antes: las 10 opciones de marca con los valores de Chatwoot, `locked=true` (`INSTALLATION_NAME`/`BRAND_NAME` «Chatwoot», `LOGO*` en `/brand-assets/*.svg`, `DISPLAY_MANIFEST` true). `ConfigLoader` corre con `reconcile_only_new: true` por omisión (`lib/config_loader.rb`, `db_enhancements.rake:5`), así que no pisa valores existentes. `RAILS_SERVE_STATIC_FILES=true` sirve `/app/public` | `rails runner`, código de la imagen | C + R |
| T-28 | Aplicada: montaje `./marca:/app/public/dtd-marca:ro` (recreación de prepare/rails/sidekiq en 130 s; DTD 200); `aplicar-marca.rb` cambió las 10 opciones y limpió la caché (`BRAND_NAME` efectivo «DTD Cargo»); los 3 PNG responden 200 `image/png` desde `chat.dtdcargo.com/dtd-marca/` | VPS, 2026-10-29 | R |
| T-29 | Desde afuera, en un navegador: título «DTD Cargo»; único `link rel=icon` → `/dtd-marca/apple-touch-icon.png`; texto «Iniciar sesión en DTD Cargo / E-mail / Contraseña / ¿Olvidaste tu contraseña?»; 0 apariciones de «Chatwoot» en el texto visible; con tema claro se ve el primary y con oscuro solo el reverse. Capturas `docs/runbooks/assets/chatwoot-marca-entrada-{claro,oscuro}.jpg` | navegador integrado | R |

## `/super_admin` con Cloudflare Access (P3 sin Tailscale; «Confirmo Access» de Sam, 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-30 | Zero Trust ya estaba activo (equipo `dawn-mud-1d9d`, plan Free) con una app ajena, «Defensa Samer · Privado», que no se tocó. Creada la app self-hosted «Chatwoot · super admin»: destino `chat.dtdcargo.com/super_admin`, sesión de 6 h, política «chatwoot-super-admin-sam» (Allow, Include Emails = `hailuway.com@gmail.com`, correo elegido por Sam). `<team>/cdn-cgi/access/certs` publica JWK RS256 con `kid` | panel de Cloudflare One (sesión de Sam); `curl` desde el VPS | T |
| T-31 | VPS: `cf-access/verificador.mjs` (sha `420b0da7…` tras el arreglo del JSON roto), `.env` con las 5 variables (copia `.env.antes-access`), `up` en 107 s; `acceso` sano. Saltándose Cloudflare (`--resolve` a 127.0.0.1): sin token, token inventado, `alg none`, `kid` desconocido y JSON roto → 403. El log da «kid desconocido», lo que prueba que leyó las claves reales. `/monitoring` e `/installation` → 403. Por Cloudflare: `/super_admin/sign_in` → 302 a `dawn-mud-1d9d.cloudflareaccess.com/cdn-cgi/access/login/chat.dtdcargo.com`; `/app/login` → 200; `/api` → 4.19.1 | `curl`; `docker compose logs acceso` | R |
| T-32 | Super admin de Chatwoot `hailuway.com@gmail.com` creado (id 2, `SuperAdmin`, confirmado; la contraseña la escribió Sam sin eco). Sam entró: `sign_in_count` 1 y último ingreso 19:31:51Z; el verificador registró 6 «permitido» | `rails runner`; logs | R |

## Correo saliente: SMTP de Hostinger (sesión «Hostinger config», 2026-10-29)

| ID | Afirmación | Fuente | Etiqueta |
|---|---|---|---|
| T-33 | Antes: plan Premium Business Email de dtdcargo.com con 1 de 2 buzones (`vzla@`, con 1 alias: `info@`). Creado el buzón `notificaciones@dtdcargo.com` con el OK de Sam («Sí, notificaciones@»). La clave la escribió Sam y la guardó en su gestor. Después: 2 de 2, los dos activos | hPanel → Emails → Buzones (Chrome de Sam) | T |
| T-34 | Respuesta automática en `notificaciones@`, pedida por Sam: remitente «DTD Cargo», asunto «Buzón solo de notificaciones», texto que remite a `vzla@dtdcargo.com`. Empieza el 2026-10-29, sin fin. Hostinger manda 1 por remitente cada 24 h | hPanel → Respuesta automática | T |
| T-35 | El `.ps1` que heredé pasaba un `awk` con comillas internas a `ssh` desde PowerShell 5.1, que se las come. La lógica pasó a `/root/pegar-smtp.sh` (`infra/chatwoot/pegar-smtp.sh`, sha256 `a5c4a759…`, igual en el VPS). Probado con un `.env` falso: escribe, no repite, rechaza claves distintas, comillas simples y espacios, e ignora líneas vacías y `\r`. Con `docker compose config` sobre un `.env` de prueba, compose v5.6.0 lee literal un valor con `$`, `#` y `\` entre comillas simples | Git Bash local; VPS | R |
| T-36 | Dos intentos fallidos de Sam, sin escritura (variables con largo 0 en cada control): (1) en el campo visible del usuario se pegó un token de Meta (`EAA…`) que estaba en el portapapeles, y el guion lo rechazó por no ser un correo; (2) «no coinciden», porque el gestor copia con salto de línea. Arreglos: el usuario viene por omisión (Enter) y se ignoran las líneas vacías. El token quedó visible en una pestaña del Terminal y en la transcripción de la sesión, no en Git ni en el VPS | `read_terminal`; `.env` por largos | R |
| T-37 | Copia `/srv/chatwoot/.env.antes-smtp` (0600). Remitente → `"DTD Cargo <notificaciones@dtdcargo.com>"`, y el resto del `.env` es idéntico (`diff` sin las 3 líneas). Usuario (27) y clave (10), entre comillas simples, `.env` 0600 | VPS, nombres y largos | R |
| T-38 | `docker compose up -d --wait` en 185 s: `rails` y `sidekiq` recreados y sanos; `acceso`, `postgres` y `redis` sin reinicio. Dentro de los dos: `SMTP_USERNAME=notificaciones@dtdcargo.com`, largo de la clave 10, remitente nuevo. `chat.dtdcargo.com/api` → 200 | `docker compose ps`/`exec` | R |
| T-39 | Prueba: `ActionMailer::Base.mail(...).deliver_now` desde `rails` (smtp, `smtp.hostinger.com:587`, `login`, STARTTLS) → aceptado sin excepción a las 22:31:31Z, a `hailuway.com@gmail.com`. Sam confirmó que llegó a Recibidos. No lo pude leer en Gmail: el conector pide permisos que no tiene | `rails runner`; Sam | R (envío aceptado) · NV por mí (la llegada la confirmó Sam) |
| T-40 | Cierre de las 72 h (2026-11-01 16:22Z, solo lectura): 845 muestras; presión de CPU p95 98,85 (58,63 sin 18:00–06:00Z; 53,85 sin 18:00–07:30Z), rachas de hasta 550 min; CPU propia de Chatwoot p95 40,1 %; web de DTD p95 0,67 s; sin OOM. Detalle en el handoff, «Cierre de la vigilancia» | `vigilar.sh --resumen`, `docker stats`, `du`, journal (conteos) y cálculo propio sobre el CSV | R (la causa del episodio: I) |

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
| E1-R21 | Verificador de Cloudflare Access (`cf-access/verificador.mjs`), pruebas unitarias: **19/19 PASÓ** (token válido; rechazo por formato, algoritmo, kid, firma —dos formas—, aud, iss, vencido, nbf, iat y correo; holgura de 60 s; caché de claves; configuración; servidor 200/403/404, cierre si las claves fallan y log sin token ni correo). Control: 5 mutantes (sin AUD, sin iss, sin firma, sin vencimiento y sin lista de correos) mueren todos (1–2 fallas cada uno) | `node --test --test-reporter=tap` | R |
| E1-R22 | Ensayo local con fase D (18:09Z): **23/23 PASÓ**. Con el modo Access (perfil `cf-access` y `chatwoot-prueba-cf-access@docker`): `/super_admin` sin token → 403; con token válido → 200; `/monitoring` sin token → 403; desde la «tailnet» sin token → 403; tokens con AUD, iss, vencimiento, firma o correo ajenos → 403; token forjado sin firma → 403; con el verificador caído, el mismo token válido → 500 (cierra); el log del verificador solo da razones. Corridas previas: dos con fallas del propio ensayo (carpeta `cf-access/` sin copiar; rutas `/tmp` y `/c/…` que Node lee distinto que Git Bash); en una, D2 y D3 «pasaban» con todo en 403/404 y se endurecieron para exigir que D1 abra | `pruebas/ensayo-local.sh` | R |
| E1-R23 | Prueba renombrada a `cf-access/verificador.node-test.mjs` porque vitest (patrón `*.test.*`, que corre en `pnpm test` del CI) la tomaba y fallaba con «No test suite found»; es de `node:test`. Ahora vitest sobre `infra/chatwoot` → «No test files found»; con una copia temporal bajo el nombre viejo, vitest sí la recoge y sale 1 (control rojo). `node --test`: **19/19 PASÓ**, los mismos casos. Mutante sin la comprobación de AUD: 2 fallas, exit 1; restaurado, 19/19. `docs:check` y `sdd:check` PASÓ. Como ni `pnpm test` ni `verify` la corren, `pruebas/ensayo-local.sh` la llama en la fase U (U1, sin Docker): bloque probado aparte, PASÓ con 19/19 y FALLÓ con el mutante de AUD (`FALLAS=1`) | `vitest run`; `node --test --test-reporter=tap` | R |

## Inferencias y pendientes

| ID | Afirmación | Etiqueta |
|---|---|---|
| E1-I1 | El consumo en reposo (≈0,95 GiB) deja margen bajo el techo de 3,7 GiB; con canales y uso real (E4) crecerá, sobre todo Sidekiq | I |
| E1-I2 | La CPU es el riesgo (VPS-7): en reposo Chatwoot no la usa; el pico estará en E4/E5 (carga del historial) | I |
| E1-NV1 | Que Traefik vea la IP `100.x` de Tailscale sin NAT en el VPS real | NV (puerta P3) |
| E1-NV2 | ~~Comportamiento con `FORCE_SSL=true` detrás del Traefik real~~ → **resuelto en P1** (T-7, T-8): rompía el healthcheck; con la cabecera, todo en verde | R |
| E1-NV3 | Certificado de Let's Encrypt para `chat.dtdcargo.com` | NV (puertas P1 y P2) |
