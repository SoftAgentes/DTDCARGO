---
sdd: "0583"
title: "Chatwoot CE en el VPS del ERP (etapa E1 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E1» (Sam)"
created: 2026-10-29
updated: 2026-10-29
supersedes: null
superseded_by: null
related: ["0582", "0505", "0540"]
confidencialidad: interno
---

# SDD-0583 — Chatwoot CE en el VPS del ERP (E1)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E1 «Chatwoot en el VPS»**, pasos 1.1 a 1.7 del [checklist](../0582-chatwoot-piloto/checklist.md). Deja la configuración **probada en local** y el pedido de despliegue listo. **No despliega nada:** el VPS, el DNS, Cloudflare y Tailscale esperan cada uno su OK nominal de Sam.

## Contexto

- Sam decidió (E0-D1) instalar Chatwoot en el **VPS actual del ERP** (Contabo Cloud VPS 8, 217.216.54.70), donde vive la base de producción de DTD. La presión de CPU `some` ya era del 31 % a 5 minutos (VPS-4); el riesgo es la CPU, no la RAM (VPS-7).
- Mitigación pedida: límites por servicio, respaldo fuera del host y vigilancia del ERP.
- Kommo sigue operando hasta el 100 % del programa. E1 no toca WhatsApp, Meta ni Kommo.

## Alcance

| Paso | Entregable | Dónde |
|---|---|---|
| 1.1 | Compose con `chatwoot/chatwoot:v4.19.1-ce` fija por etiqueta y digest, Postgres 16 con pgvector, Redis, Sidekiq y un `prepare` que migra; límites de CPU, memoria y PIDs, peso de CPU a la mitad y `oom_score_adj` para ceder ante DTD | `infra/chatwoot/compose.yml` |
| 1.2 | Labels de Traefik: router del panel, `X-Frame-Options` quitado, `frame-ancestors` acotado al origen de Studio, `/super_admin` y `/monitoring` solo desde la tailnet; plan de DNS y TLS | `compose.yml`, [runbook](../../runbooks/chatwoot-servidor.md) §3–4 |
| 1.3 | Variables: `SECRET_KEY_BASE`, cifrado de columnas, registro cerrado, `MAX_USER_SESSIONS`, SMTP, sin telemetría ni relay de push | `infra/chatwoot/.env.example`, `compose.yml` (`x-entorno`) |
| 1.4 | Procedimiento de Platform App, cuenta por API y usuario de servicio. **Se ejecuta después del despliegue** | [runbook](../../runbooks/chatwoot-servidor.md) §6 |
| 1.5 | Respaldo conjunto cifrado (base, adjuntos, claves), restauración conjunta, RPO y RTO, ensayo local | `infra/chatwoot/respaldo.sh`, `restaurar.sh`, `systemd/`, [runbook de respaldo](../../runbooks/chatwoot-respaldo-restauracion.md) |
| 1.6 | Plan de vigilancia sobre `ops-uptime-kuma`, script de recursos con latido y criterio de las 72 h | `infra/chatwoot/vigilar.sh`, [runbook de vigilancia](../../runbooks/chatwoot-vigilancia.md) |
| 1.7 | revisar-datos-ve, redacción de logs probada con datos sintéticos (con control), inventario de terceros y nota sobre `/privacidad` | `infra/chatwoot/rails/zz_dtd_redaccion_logs.rb`, [revisión](../../legal/privacidad/revision-chatwoot-e1-2026-10-29.md), `inventario-terceros.md` |
| — | Prueba local con Docker de todo lo anterior | `infra/chatwoot/pruebas/ensayo-local.sh` |

## Fuera de alcance

- Desplegar en el VPS, crear registros DNS, tocar Cloudflare o instalar Tailscale (puertas de abajo).
- La bandeja dentro de Studio, el SSO y la CSP de Studio (E2). Aquí solo queda el lado de Chatwoot del iframe.
- Canales (E4), historial (E5) y bot (E7).
- Cambiar el Traefik compartido (`ops-traefik`), salvo conectarlo a la red `chatwoot_edge`, que va en el pedido de despliegue.

## Decisiones

| ID | Decisión | Por qué |
|---|---|---|
| E1-D1 | Proyecto de Compose propio (`/srv/chatwoot`, `name: chatwoot`) y red edge propia `chatwoot_edge`, no `dtd_edge` | Chatwoot no ve el `web` ni el `api-gw` de DTD; se baja o se mueve a otro VPS sin tocar DTD |
| E1-D2 | Techo de 2,75 vCPU y ~3,7 GiB para todo Chatwoot (rails 1,0/1,5 GiB, sidekiq 0,75/1,25 GiB, postgres 0,75/768 MiB, redis 0,25/192 MiB), `cpu_shares: 512` y `oom_score_adj: 500` | Con la CPU disputada DTD recibe el doble de turno; ante falta de memoria el kernel mata primero a Chatwoot. Consumo en reposo medido en el ensayo local ([registro](investigacion-2026-10-29.md)) |
| E1-D3 | Variables una por una (`x-entorno`), sin `env_file` | Una línea vacía llega como `""`: `MAX_USER_SESSIONS=` daría tope 0 y `LOG_LEVEL=` tumba el arranque (`config/environments/production.rb:50`) |
| E1-D4 | Adjuntos en disco local (`ACTIVE_STORAGE_SERVICE=local`), respaldados con la base | 150 GB libres (VPS-2); R2 suma un tercero y un secreto sin necesidad en el piloto |
| E1-D5 | Redacción de logs con un inicializador propio montado en solo lectura, sin reconstruir la imagen | La imagen oficial queda intacta y fijada por digest; E3 vuelve a correr la prueba en cada versión |
| E1-D6 | Sin access log de Traefik para los routers de Chatwoot (`observability.accesslogs=false`) | La URL del SSO lleva el correo del agente y un token, y las búsquedas llevan teléfonos; el log de Rails (filtrado) registra cada pedido |
| E1-D7 | `DISABLE_TELEMETRY=true` y `ENABLE_PUSH_RELAY_SERVER=false` | Sin ellas, Chatwoot manda conteos de conversaciones al hub y el texto de cada notificación al relay de push (`lib/chatwoot_hub.rb`) |
| E1-D8 | `/super_admin` y `/monitoring` solo desde `100.64.0.0/10` (`tailscale-only@file`). Mientras el VPS no tenga Tailscale (T, 2026-10-29), la administración va por `docker compose exec` sobre SSH. **Decisión de Sam del 2026-10-29 («Cerrado y consola»):** P3 se pospone; `/super_admin` queda cerrado para todos y no se instala ni Tailscale ni Cloudflare Access hasta que haga falta. Cuando haga falta, la opción preferida es Cloudflare Access con verificación del token `Cf-Access-Jwt-Assertion` en el origen | No hay acceso web de super admin desde internet en ningún momento; E2 entra por la Platform API (P4) |
| E1-D9 | ~~Recomendación de DNS: sin proxy (nube gris)~~ **Revisada el 2026-10-29 tras P2:** el VPS solo acepta 80/443 desde Cloudflare (`cloudflare-origin-firewall`, desde el 2026-10-22; registro T-17), así que sin proxy Chatwoot no es alcanzable ni recibe certificado (T-16). Nueva recomendación: **con proxy**, como el resto de la web | Cloudflare ya procesa todo el tráfico de la web y de Supabase de DTD, con datos de clientes; Chatwoot le suma el contenido de las conversaciones. Abrir el origen a todos le quitaría la protección a todos los sitios del VPS. Decide Sam |

## Allowlist exacta

- `infra/chatwoot/{compose.yml,.env.example,.gitignore,README.md,respaldo.sh,restaurar.sh,vigilar.sh}`
- `infra/chatwoot/rails/zz_dtd_redaccion_logs.rb`
- `infra/chatwoot/systemd/{chatwoot-respaldo.service,chatwoot-respaldo.timer,chatwoot-vigilancia.service,chatwoot-vigilancia.timer}`
- `infra/chatwoot/pruebas/{ensayo-local.sh,age-en-docker.sh,compose.local.yml,compose.sin-redaccion.yml,compose.traefik-prueba.yml,sonda-redaccion.rb,sembrar.rb,verificar.rb,vacio.rb}`
- `docs/runbooks/{chatwoot-servidor.md,chatwoot-respaldo-restauracion.md,chatwoot-vigilancia.md}`
- `docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md`
- `docs/legal/privacidad/inventario-terceros.md` (sección nueva de Chatwoot)
- `docs/specs/0583-chatwoot-vps-e1/{spec.md,investigacion-2026-10-29.md}`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (filas 1.1–1.7)
- `docs/specs/README.md` (índice regenerado)
- `.agents/handoffs/0583-chatwoot-vps-e1.md`

## Aceptación

1. `docker compose config -q` valida con `.env.example` y se niega a arrancar sin las variables críticas.
2. `pruebas/ensayo-local.sh` sale 0 con todas las comprobaciones en PASÓ, incluido el control A1 (sin redacción, la sonda **encuentra** los datos sintéticos) y el control R4 (con otras claves, el secreto restaurado es ilegible).
3. Cada paso 1.x queda `entregado` en el checklist con su evidencia, salvo los que necesitan el VPS (1.4 y la parte en el host de 1.5 y 1.6), que quedan con la puerta escrita.
4. El pedido de despliegue lista, una por una, las operaciones que tocan el VPS, el DNS, Cloudflare y Tailscale.

## Puertas (cada una, OK nominal de Sam por separado)

| Puerta | Qué cubre | Paso |
|---|---|---|
| P1 · Despliegue en el VPS | Copiar `infra/chatwoot` a `/srv/chatwoot`, generar el `.env`, crear la red `chatwoot_edge`, conectar `ops-traefik-traefik-1` a ella sin reiniciarlo, `docker compose up -d`, timers de respaldo y vigilancia | 1.1, 1.5, 1.6 |
| P2 · DNS en Cloudflare | Registro A `chat.dtdcargo.com` → 217.216.54.70, sin proxy (o con, si Sam lo decide) | 1.2 |
| P3 · Tailscale en el VPS | Instalar Tailscale y unir el VPS a la tailnet de Sam | 1.2 |
| P4 · Platform App y cuenta | Crear la Platform App, la cuenta de DTD por API y el usuario de servicio en la instancia desplegada | 1.4 |
| P5 · Ensayo de restauración en el host | Restaurar el último respaldo real en un proyecto `chatwoot-ensayo` con otro host, medir el RTO y bajarlo | 1.5 |

Ninguna puerta cubre tocar los contenedores ni la base de DTD, ni leer PII.

## Evidencia

Registro de esta SDD: [`investigacion-2026-10-29.md`](investigacion-2026-10-29.md). Las etiquetas son las del programa (C, D, T, R, I, NV).

## Seguimiento

- **2026-10-29:** reserva y alcance. Configuración escrita y ensayo local (ver registro). Pedido de despliegue en el handoff.
- **2026-10-29 (tarde):** Sam autorizó P1 («Autorizo P1»). Chatwoot desplegado en el VPS; el healthcheck de `rails` se corrigió por `FORCE_SSL` (T-7). Respaldo diario y vigilancia en marcha; empiezan las 72 h de 1.6.
- **2026-10-29 (tarde):** P2 cerrada. El registro se creó sin proxy («Autorizo P2»); el origen solo acepta a Cloudflare (T-17), así que se activó el proxy («Sí, actívalo» y «Confirmo» de Sam) y salió el certificado de Let's Encrypt. HTTPS verificado y los cuatro monitores en verde. E1-D9 queda «con proxy». Siguen pendientes P3, P4, P5 y el SMTP.
