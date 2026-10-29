# Handoff · SDD-0583 · E1 «Chatwoot en el VPS» (programa SDD-0582)

- **Rama:** `codex/0582-e1-chatwoot-vps`, apilada sobre `codex/0582-e0-preparacion` (`21e4c7e0e`, PR draft #327). Worktree `DTD-worktrees/0582-e1-chatwoot-vps`, owner `claude-0582-e1`. **PR en borrador [SoftAgentes/DTDCARGO#329](https://github.com/SoftAgentes/DTDCARGO/pull/329)**, apilada sobre la #328 (E0). La publicó la sesión del programa con el OK de Sam («Sí, publícalas», dado en esa sesión) hasta `9bd78b77c`; los commits de P1 se suben con `git push` normal, sin force. Sin merge.
- **Reserva:** SDD-0583 (`codex/sdd-reserve-0583-chatwoot-vps-e1` + `refs/dtd/reservations/0583`), incorporada con cherry-pick. Sin publicar a `origin`.
- **Fecha:** 2026-10-29. Worker: Claude (sesión hija de la 0582).

## Qué quedó hecho

| Paso | Estado | Qué |
|---|---|---|
| 1.1 | entregado | `infra/chatwoot/compose.yml`: imagen por etiqueta y digest, `prepare` que migra, pgvector 0.8.1-pg16, Redis 7.2.11, límites de CPU/memoria/PIDs, `cpu_shares: 512`, `oom_score_adj: 500`, red `chatwoot_edge` propia. **Desplegado en el VPS el 2026-10-29** (P1) |
| 1.2 | entregado | Labels de Traefik: sin `X-Frame-Options`, `frame-ancestors` al origen de Studio, `/super_admin`, `/monitoring` e `/installation` solo desde `100.64.0.0/10`, sin access log. DNS, TLS y Tailscale escritos en el runbook, esperando sus OK |
| 1.3 | entregado | `.env.example` + `x-entorno` (variables una por una): registro cerrado, `MAX_USER_SESSIONS=5`, SMTP, cifrado de columnas, telemetría, relay de push y Gravatar apagados |
| 1.4 | en curso | Procedimiento de Platform App, cuenta y usuario de servicio **probado en local**; se ejecuta tras el despliegue (P4) |
| 1.5 | en curso | `respaldo.sh` / `restaurar.sh` / timer; restauración conjunta ensayada en local (57 s) con control de claves; timer activo en el VPS y primer respaldo en B2; falta el ensayo en el host (P5) |
| 1.6 | espera externa | `vigilar.sh` cada 5 min en el VPS, monitores Push #6 y #7 en verde; 72 h hasta el 2026-11-01 ~16:00Z; los monitores HTTP, tras P2 |
| 1.7 | entregado | Revisión `revisar-datos-ve` (H1–H11), redacción de logs probada con control, inventario de terceros §2 bis, nota sobre `/privacidad` |

Avance del programa: sigue en **3,8 %** (solo `aceptado` suma). Entregados sin aceptar: 1.1, 1.2, 1.3, 1.7. Esperando: 1.6.

## P1 ejecutada (2026-10-29, 15:38–16:00Z)

**Autorización:** Sam, en el chat de esta sesión: «Autorizo P1». Cubre exactamente la lista P1 de abajo; no cubre P2–P5.

Hecho en el VPS, en orden (evidencia T-2 a T-12 del [registro](../../docs/specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md)):
1. Estado previo leído; línea base sin Chatwoot: presión de CPU 40,7–46,0 % a 5 min (sube respecto de E0).
2. `/srv/chatwoot` copiado (sha256 igual al repo); `data/` y `/srv/backups/chatwoot` creados.
3. `.env` 0600 generado en el servidor; ningún valor impreso. Vacíos a propósito: SMTP usuario y clave.
4. `chatwoot_edge` creada; Traefik conectado **sin reinicio**.
5. `up -d --wait`: `rails` quedó **unhealthy** por `FORCE_SSL` (el healthcheck recibía 301 a https). Arreglado en el repo (cabecera `X-Forwarded-Proto: https`) y en el VPS (el compose anterior quedó como `compose.yml.antes-healthcheck`). Los cuatro servicios, sanos.
6. Onboarding cerrado por consola, antes de cualquier DNS.
7. Comprobaciones 1–6 del runbook §5 en verde contra el Traefik real. DTD intacto (11 contenedores sin reiniciar; web 200).
8. Timers instalados; primer respaldo a B2 (44 s, `rclone check` sin diferencias); primera vigilancia `up · ok`.
9. Uptime Kuma (sesión de Sam en su Chrome): monitores Push «Respaldo Chatwoot · latido» (#6, 26 h) y «Chatwoot · recursos del host» (#7, 15 min), con aviso por Telegram; sus URL en el `.env` (0600, por stdin, sin imprimirlas); los dos en verde. Los dos HTTP («API» y «versión») se crean tras P2: sin DNS darían «caído».

**Pendiente de Sam para que el correo funcione:** `CHATWOOT_SMTP_USERNAME` y `CHATWOOT_SMTP_PASSWORD` de la casilla de Hostinger que elija (sin ellos, Chatwoot no puede mandar avisos ni restablecer contraseñas). Se pegan con una ventana oculta, como en 0.6.

## Hallazgos que cambian algo

1. **El onboarding de una instalación nueva regala el super admin** al primer visitante (`/installation/onboarding`). Se bloqueó en Traefik y el runbook lo cierra por consola **antes** del DNS.
2. **Con claves equivocadas, Chatwoot no da error**: devuelve el texto cifrado como si fuera el token (`support_unencrypted_data = true`). `restaurar.sh` ahora lo comprueba y falla.
3. **Fugas de datos personales** de la imagen oficial, tapadas: payload del bot en el log (`webhook_job.rb:13`), argumentos de trabajos, `args` de Sidekiq, access log de Traefik con correo y token del SSO, telemetría con conteos, relay de push y Gravatar con el MD5 del correo.
4. **El VPS no tiene Tailscale.** Hasta P3 nadie entra al `/super_admin` por web; la administración va por consola sobre SSH.
5. Consumo en reposo ≈ 0,95 GiB (rails 485 MiB, sidekiq 406 MiB). El techo es 2,75 vCPU y 3,7 GiB.

## Validación

| Comprobación | Resultado |
|---|---|
| `bash infra/chatwoot/pruebas/ensayo-local.sh` (4.ª corrida, 19 comprobaciones con dos controles) | **PASÓ** 19/19, 0 fallas |
| `docker compose --env-file .env.example config -q` | PASÓ |
| `bash -n` de los cinco scripts | PASÓ |
| `vigilar.sh` en contenedor Linux (normal y con umbrales forzados) | PASÓ |
| Platform API en local (1.4) | PASÓ |
| `docs:check` (con el índice regenerado) y `sdd:check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio no toca producto (infra nueva, docs y una fila del checklist); cierre por el diff (docs:check/sdd:check) |
| Despliegue, DNS, Tailscale, timers y ensayo en el host | NO EJECUTADO: puertas P1–P5 |

## Pedido de OK para Sam (cada uno aparte, nombrando la operación)

**P1 · Desplegar Chatwoot en el VPS 217.216.54.70.** ✅ **Hecha el 2026-10-29** («Autorizo P1»; ver § P1 ejecutada). Lo que pedía:
1. Crear `/srv/chatwoot/` y copiar `compose.yml`, `.env.example`, `.gitignore`, `README.md`, `respaldo.sh`, `restaurar.sh`, `vigilar.sh`, `rails/` y `systemd/` (sin `pruebas/`). Crear `/srv/chatwoot/data/{postgres,redis,storage}` y `/srv/backups/chatwoot/`.
2. Generar `/srv/chatwoot/.env` (0600) en el servidor con secretos aleatorios (runbook §2). Sam pone usuario y clave SMTP de la casilla que elija y guarda una copia del `.env` en su gestor.
3. `docker network create chatwoot_edge` y `docker network connect chatwoot_edge ops-traefik-traefik-1` (en caliente: Traefik **no** se reinicia; ningún sitio se corta).
4. `docker compose pull` (4 imágenes, ~1 GB) y `docker compose up -d --wait`: 5 contenedores nuevos del proyecto `chatwoot`.
5. Cerrar el onboarding por consola (`rails runner`).
6. Instalar y encender `chatwoot-respaldo.timer` (06:30 UTC) y `chatwoot-vigilancia.timer` (5 min) en `/etc/systemd/system/`; una corrida a mano de cada uno. El respaldo sube a `b2:dtdcargo-respaldos/chatwoot/` con el `rclone.conf` y las claves públicas `age` que ya existen.
7. Crear en Uptime Kuma (`vps.dtdcargo.com`) cuatro monitores: «Chatwoot · API», «Chatwoot · versión», «Chatwoot · recursos del host» (Push) y «Respaldo Chatwoot · latido» (Push).
- **No toca:** contenedores, redes, `.env` ni base de DTD; el compose de Traefik; ufw.
- **Vuelta atrás:** `docker compose down`, `docker network disconnect chatwoot_edge ops-traefik-traefik-1`, `systemctl disable --now` de los dos timers.

**P2 · Registro DNS en Cloudflare:** ⚠️ **hecha a medias el 2026-10-29** («Autorizo P2», como respuesta a «¿… sin proxy?»). El registro `A chat.dtdcargo.com → 217.216.54.70`, **Solo DNS**, existe desde las 16:11Z. Pero el certificado no sale: desde el 2026-10-22 el VPS solo acepta 80/443 desde Cloudflare (`cloudflare-origin-firewall`; registro T-16 a T-18), así que sin proxy nadie llega. Hacen falta la decisión y el OK de Sam: **activar el proxy en ese registro (recomendado)**, o dejarlo así. Con el proxy activo: recrear `rails` (`docker compose up -d --force-recreate --no-deps rails`), comprobar el certificado de Let's Encrypt y crear en Uptime Kuma los dos monitores HTTP («Chatwoot · API» y «Chatwoot · versión»). Van 2 intentos fallidos de Let's Encrypt (15:52Z y 16:28Z); el tope es 5 por hora.

**P3 · Instalar Tailscale en el VPS** y unirlo a la tailnet de Sam (`tailscale up --ssh`, runbook servidor-contabo §1.5). Habilita `/super_admin` por web.

**P4 · Platform App, cuenta «DTD Cargo» y usuario de servicio** en la instancia desplegada (runbook §6). El token va al gestor de Sam y a los secretos de Studio (E2).

**P5 · Ensayo de restauración en el host:** bajar el último respaldo desde B2, restaurarlo como proyecto `chatwoot-ensayo` con host `chat-ensayo.dtdcargo.com` (sin DNS), medir el RTO y bajarlo. Requiere que Sam pegue su clave privada `age` en `/dev/shm` durante el ensayo.

## Pendiente de esta tarea

- Push y PR solo con autorización de Sam.
- SMTP: usuario y clave de Hostinger (Sam), con ventana oculta.
- Tras las 72 h (2026-11-01 ~16:00Z): `vigilar.sh --resumen --desde 2026-10-29T15:55:00Z` → fila 1.6, con el criterio corregido (contra la línea base, no un número fijo).
- P5 → fila 1.5. P4 → fila 1.4.
- Reestimación de E1 al cerrar la etapa (real ≈ 0,35 d frente a 4,75 d base: la configuración salió mucho más rápida de lo estimado; lo que falta es sobre todo espera y puertas).

## Impacto documental

- Nuevos: `infra/chatwoot/**`, `docs/runbooks/chatwoot-{servidor,respaldo-restauracion,vigilancia}.md`, `docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md`, `docs/specs/0583-chatwoot-vps-e1/{spec.md,investigacion-2026-10-29.md}`.
- Cambiados: `docs/legal/privacidad/inventario-terceros.md` (§2 bis), checklist de la 0582 (filas 1.1–1.7), índice de specs.
- Graphify/Obsidian: no se tocaron (lo publica el Director desde main integrado).

## FUERA DE ALCANCE DETECTADO

- El monitor de Uptime Kuma «Publicación web DTD · vigilante» está **caído** (63 de 63 latidos en rojo al 2026-10-29; último evento «no pude bajar :publicable» el 2026-10-22). No es de Chatwoot; lo revisa el Director o la sesión de publicación de la web.
- La presión de CPU del VPS sin Chatwoot subió del 29–31 % (E0) a 41–46 % el 2026-10-29 por la tarde.

- `infra/ops/traefik/compose.yml` del repo solo declara `dtd_edge`; el Traefik del VPS ya está en `loop-3d_edge`, `loop-3d-staging_edge` y `rent-awada-pruebas_edge`. El repo y el servidor divergen.
- El access log de Traefik guarda rutas con query para **todos** los sitios (DTD incluido); aquí solo se apagó para Chatwoot.
- ufw deja el SSH (22) abierto a todo internet; el runbook servidor-contabo dice cerrarlo cuando haya Tailscale.
- `TRUSTED_PROXY_CIDRS` del Traefik no incluye los rangos de Cloudflare: con proxy, las apps detrás ven la IP de Cloudflare.
- El PDF del DPA de Contabo sigue sin seguimiento en la raíz del checkout principal (ya anotado en la spec 0582).

## Registro de corridas

| Corrida | Hora (UTC) | Resultado |
|---|---|---|
| ensayo 1 | 09:05 | 6 fallas (onboarding descubierto, formato de sha256 en Windows, pipefail, manifiesto) |
| ensayo 2 | 09:15 | 3 fallas (filtro del manifiesto con el `@` del digest, Gravatar aún sin variable, control de claves mal planteado) |
| ensayo 3 | 09:22 | 0 fallas, 18/18 |
| ensayo 4 (con R4b) | 09:29 | **0 fallas, 19/19**; entorno local limpio al final |
| `docs:check` (tras `docs:index`) y `sdd:check` | 09:35 | PASÓ los dos |
| P1 en el VPS: comprobaciones del runbook §5 | 15:53 | PASÓ las seis (tras arreglar el healthcheck) |
| P1: primer respaldo y primera vigilancia | 15:55 | PASÓ (`success`, `up · ok`) |
