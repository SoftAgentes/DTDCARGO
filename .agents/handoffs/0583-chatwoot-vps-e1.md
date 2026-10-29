# Handoff · SDD-0583 · E1 «Chatwoot en el VPS» (programa SDD-0582)

- **Rama:** `codex/0582-e1-chatwoot-vps`, apilada sobre `codex/0582-e0-preparacion` (`21e4c7e0e`, PR draft #327). Worktree `DTD-worktrees/0582-e1-chatwoot-vps`, owner `claude-0582-e1`. **PR en borrador [SoftAgentes/DTDCARGO#329](https://github.com/SoftAgentes/DTDCARGO/pull/329)**, apilada sobre la #328 (E0). La publicó la sesión del programa con el OK de Sam («Sí, publícalas», dado en esa sesión) hasta `9bd78b77c`; los commits de P1 se suben con `git push` normal, sin force. Sin merge.
- **Reserva:** SDD-0583 (`codex/sdd-reserve-0583-chatwoot-vps-e1` + `refs/dtd/reservations/0583`), incorporada con cherry-pick. Sin publicar a `origin`.
- **Fecha:** 2026-10-29. Worker: Claude (sesión hija de la 0582).

## Qué quedó hecho

| Paso | Estado | Qué |
|---|---|---|
| 1.1 | entregado | `infra/chatwoot/compose.yml`: imagen por etiqueta y digest, `prepare` que migra, pgvector 0.8.1-pg16, Redis 7.2.11, límites de CPU/memoria/PIDs, `cpu_shares: 512`, `oom_score_adj: 500`, red `chatwoot_edge` propia. **Desplegado en el VPS el 2026-10-29** (P1) |
| 1.2 | entregado | Labels de Traefik: sin `X-Frame-Options`, `frame-ancestors` al origen de Studio, `/super_admin`, `/monitoring` e `/installation` solo desde `100.64.0.0/10`, sin access log. **DNS y TLS hechos en P2** (`chat.dtdcargo.com` con proxy de Cloudflare y certificado de Let's Encrypt). Tailscale espera P3 |
| 1.3 | entregado | `.env.example` + `x-entorno` (variables una por una): registro cerrado, `MAX_USER_SESSIONS=5`, SMTP, cifrado de columnas, telemetría, relay de push y Gravatar apagados |
| 1.4 | entregado | **P4 hecha el 2026-10-29** («Autorizo P4»): Platform App «DTD Studio», cuenta «DTD Cargo» (id 1) y usuario de servicio administrador. Token, ids y clave en `/srv/chatwoot/secretos/platform-app.env` (0600); Sam los copia a su gestor con `ssh root@217.216.54.70 cat /srv/chatwoot/secretos/platform-app.env`, desde su terminal y no en el chat |
| 1.5 | entregado | `respaldo.sh` / `restaurar.sh` / timer; ensayo local (57 s) con control de claves; timer activo en el VPS. **P5 hecha el 2026-10-29** («Autorizo P5»): el respaldo bajado de B2 se restauró en 200 s, con conteos y claves iguales (T-25) |
| 1.6 | espera externa | `vigilar.sh` cada 5 min en el VPS; los cuatro monitores de Uptime Kuma en verde (dos Push y, desde P2, dos HTTP); 72 h hasta el 2026-11-01 ~16:00Z |
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

**P2 · Registro DNS en Cloudflare:** ✅ **cerrada el 2026-10-29** (registro T-13 a T-22).
- **Autorizaciones de Sam, literales:**
  1. «Autorizo P2», en esta sesión, a la pregunta «¿Autorizas P2, crear chat.dtdcargo.com en Cloudflare sin proxy?»;
  2. «Sí, actívalo», en la sesión del programa («CRM Chatwoot»), a «¿Activamos el proxy de Cloudflare para chat.dtdcargo.com?», con alcance «solo ese registro» y sin tocar otros registros ni ajustes de la zona;
  3. «Confirmo», en esta sesión, a «¿Confirmas aquí activar el proxy solo en el registro chat.dtdcargo.com?».
- 16:11Z: registro `A chat.dtdcargo.com → 217.216.54.70` creado sin proxy. Let's Encrypt no llegó (2 intentos fallidos): el VPS solo acepta 80/443 desde Cloudflare (`cloudflare-origin-firewall`, desde el 2026-10-22).
- 16:49Z: proxy activado **solo en ese registro**. No se tocó ningún otro registro ni ajuste de la zona.
- 16:52Z: certificado de Let's Encrypt emitido al tercer intento (vence el 2027-01-27). HTTPS verificado de punta a punta: `/api` 200, sin `X-Frame-Options`, `frame-ancestors` a `https://dtdcargo.com` y las rutas de administración en 403.
- 16:56Z: los monitores HTTP «Chatwoot · API» y «Chatwoot · versión» creados y en verde. Los cuatro de Chatwoot, en verde.

**P3 · Instalar Tailscale en el VPS** ⏸️ **pospuesta por Sam el 2026-10-29.** Le pregunté si lo mismo se podía hacer con Cloudflare: sí, con Cloudflare Access y la verificación del token en el origen. Su decisión, literal: «Cerrado y consola». `/super_admin`, `/monitoring` e `/installation` siguen en 403 para todos, y lo de super admin se hace por `docker compose exec` sobre SSH. Cuando haga falta el acceso web, la opción preferida es Cloudflare Access.

**P4 · Platform App, cuenta «DTD Cargo» y usuario de servicio** en la instancia desplegada (runbook §6). El token va al gestor de Sam y a los secretos de Studio (E2).

**P5 · Ensayo de restauración en el host:** ✅ **hecha el 2026-10-29** («Autorizo P5»). Resultado en T-25: bajado de B2, restaurado en `chatwoot-ensayo` sin Traefik y bajado al terminar. La llave usada fue la nueva de emergencia (sección de abajo).

## Pendiente de esta tarea

- SMTP: usuario y clave de Hostinger (Sam), con ventana oculta.
- Tras las 72 h (2026-11-01 ~16:00Z): `vigilar.sh --resumen --desde 2026-10-29T15:55:00Z` → fila 1.6, con el criterio corregido (contra la línea base, no un número fijo).
- `/super_admin` con Cloudflare Access (§4.1 del runbook): preparado y probado en local (E1-R21, E1-R22); espera la confirmación de Sam en esta sesión, con el alcance de Zero Trust y del VPS.
- ~~Marca de DTD en Chatwoot~~ **hecha el 2026-10-29** («Autorizo la marca»): título «DTD Cargo», ícono y logos de DTD (claro y oscuro según `BRAND.md`), pantalla de entrada en español, sin «Chatwoot» visible (T-27 a T-29; runbook §6 bis). Queda en la edición CE el «Powered by Chatwoot» del widget y de los correos, y la etiqueta «E-mail» de la traducción de Chatwoot.

## FUERA DE ALCANCE (coordinado por el Director) · cambio de llave de respaldos de DTD y Chatwoot

- **Autorizaciones.** El Director (sesión del programa) me encargó coordinarlo con condiciones. Sam lo autorizó en esta sesión, literal: «Autorizo las dos» (llave nueva para DTD y Chatwoot, y archivo de los respaldos viejos).
- **Incidente.** La llave privada del 2026-10-14 (`f4aab8d9…`) no apareció. Sam pegó tres candidatas: una era una llave age válida de otro par. Es la segunda pérdida en 17 días; falló la custodia (el gestor guardaba un texto cortado).
- **Hecho, en orden:**
  1. Respaldos viejos copiados a `b2:dtdcargo-respaldos/archivo-llave-2026-10-14/`: 87 + 24 + 4 objetos, mismos bytes, 0 diferencias. No se borró nada. El bucket no tiene ciclo de vida; la retención de los scripts los borraba desde el 2026-11-13.
  2. Llaves nuevas generadas en la PC de Sam, con solo las públicas en el VPS: `Sam-2026-10-29` (`f0bdbaa91af5fc7c`, gestor) y `Emergencia-2026-10-29` (`f2b06f66dad23591`, USB o papel). Cada una se pegó de vuelta desde donde se guardó.
  3. `age-recipients.txt` con esas dos (copia `.bak-20261029`).
  4. Respaldos nuevos: DTD PASÓ (base y configuración) y Chatwoot OK.
  5. Pruebas del mismo día:
     - DTD restaurado 5 PASÓ · 0 FALLÓ (RTO 52 s, Vault 4/4) con la llave de emergencia;
     - Chatwoot P5 PASÓ con la de emergencia;
     - la llave del gestor descifra los 7 archivos.
- **Registro:** `docs/runbooks/backup-restore-servidor.md` («Registro · 2026-10-29») y `servidor-contabo.md` (fila de la 2.ª pérdida).
- **Guiones que quedan en el VPS** (sin secretos, en `/root`): `recibir-clave-age.sh`, `agregar-publica-age.sh`, `p5-pruebas-llave.sh` y `comprobar-p1-chatwoot.sh`. En la PC de Sam, en la carpeta de notas: `nueva-llave-age-0583.ps1` y `probar-llave-0583.ps1`.
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
