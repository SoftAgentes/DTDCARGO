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
| 1.6 bis (2026-11-06) | Alarma de la puerta 7 de 4.9 de la SDD-0582 (cupo de 1.000 salientes y fallas de entrega de WhatsApp, por bandeja) y renovación diaria del token de Instagram, con su alarma. Código y prueba en CI; la instalación en el VPS la revisa el Director General | `infra/chatwoot/{vigilar.sh,vigilar-whatsapp.sql,renovar-instagram.sh}`, `systemd/chatwoot-instagram-token.{service,timer}`, [runbook de vigilancia](../../runbooks/chatwoot-vigilancia.md) §2, §2 bis y §2 ter |
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
| E1-D10 | Chatwoot se queda en este VPS (decisión G de la SDD-0582), ratificado por Sam el 2026-11-01: «¿Aceptas el 1.6 y dejas Chatwoot en este VPS?» → «Sí, acepto el 1.6», transmitido por el Director | La fila de presión de CPU falla (p95 98,85 en total; 53,85 sin el episodio, con dos rachas de 20 y 21 min sobre 60), pero las otras cinco señales cumplen y (I) el episodio viene de actividad ajena a Chatwoot. El plan B no se activa y el criterio se vuelve a leer al cerrar E4 |
| E1-D11 | (2026-11-06) Los días del token de Instagram se miden **al terminar la renovación diaria**, no contra la hora actual. `vigilar.sh` avisa si entonces le quedaban menos de 10 días, si la renovación salió `falla` o si pasaron más de 26 h sin una | Chatwoot 4.19.1 renueva cuando faltan menos de 10 días y se traga el error de la renovación. Con una corrida diaria, un token sano baja hasta ~9 días entre dos corridas: una alarma «menos de 10 días» contra la hora actual sonaría hasta 24 h en cada ciclo. Lo acordado con el Director General era «alarma si a `expires_at` le quedan menos de 10 días»: se cumple en el momento en que la renovación tuvo su oportunidad. Si prefiere medirlo contra la hora actual, es una línea y un mutante |
| E1-D12 | (2026-11-06) La consulta de la puerta 7 vive en su propio archivo (`vigilar-whatsapp.sql`), que se pasa por stdin a `psql` y la prueba de PGlite corre tal cual. Compara `created_at` con `now()` pasado a UTC, también en la ventana de 24 h | La consulta del handoff de 4.9 comparaba la ventana de 24 h con `now()` sin pasarlo a UTC. Ese resultado depende del TimeZone de la sesión de Postgres: con la sesión en Caracas, una falla de hace 25 h contaba. Cero bandejas de WhatsApp también da `down`: DTD tiene dos, así que cero filas indica una lectura rota |

## Allowlist exacta

- `infra/chatwoot/{compose.yml,.env.example,.gitignore,README.md,respaldo.sh,restaurar.sh,vigilar.sh}`
- `infra/chatwoot/rails/zz_dtd_redaccion_logs.rb`
- `infra/chatwoot/pruebas/{prueba-redaccion-canales.sh,compose.redaccion-canales.yml,sonda-redaccion-canales.rb,mutantes-redaccion-canales.rb}` y `.agents/handoffs/0583-logs-canales.md` (líneas de los canales en los logs, 2026-11-05)
- `infra/chatwoot/systemd/{chatwoot-respaldo.service,chatwoot-respaldo.timer,chatwoot-vigilancia.service,chatwoot-vigilancia.timer}`
- Paso 1.6 bis (2026-11-06): `infra/chatwoot/{vigilar-whatsapp.sql,renovar-instagram.sh}`, `infra/chatwoot/systemd/{chatwoot-instagram-token.service,chatwoot-instagram-token.timer}`, `infra/ops/tests/{prueba-vigilar-chatwoot.sh,vigilar-whatsapp.test.mjs}`, `infra/ops/tests/pruebas-linux.sh`, dos líneas (la ruta y el piso), y `.agents/handoffs/0583-alarmas-whatsapp-instagram.md`
- `infra/chatwoot/pruebas/{ensayo-local.sh,age-en-docker.sh,compose.local.yml,compose.sin-redaccion.yml,compose.traefik-prueba.yml,sonda-redaccion.rb,sembrar.rb,verificar.rb,vacio.rb,firmar-jwt-prueba.mjs}`
- `infra/chatwoot/cf-access/{verificador.mjs,verificador.node-test.mjs}` (P3 con Cloudflare Access, agregado el 2026-10-29)
- `infra/chatwoot/aplicar-marca.rb` (movido desde `marca/` el 2026-10-30 para que no se publique), `infra/chatwoot/marca/{dtdcargo-isologo-primary.png,dtdcargo-isologo-reverse.png,apple-touch-icon.png,dtdcargo-isologo-correo.png}` y `docs/runbooks/assets/chatwoot-marca-entrada-{claro,oscuro}.jpg` (marca de DTD, paso 1.3, agregado el 2026-10-29)
- `infra/chatwoot/rails/zz_dtd_correo.rb` y `infra/chatwoot/correo/{generar-avisos.sh,generar-logo.mjs,vista-previa.rb,views/**}` (correos de DTD, T-40 a T-46; agregado al integrar en `main`, 2026-11-05)
- `docs/runbooks/chatwoot-versiones.md` (los correos como pieza propia, la ruta del guion de marca y el estado montado de candado y revocación) y `lib/studio/chatwoot/analisis.ts` (solo la ruta del guion de marca), al integrar en `main`, 2026-11-05
- `docs/runbooks/backup-restore-servidor.md` y `docs/runbooks/servidor-contabo.md` (registro del cambio de llave de respaldos, coordinado por el Director)
- `docs/runbooks/{chatwoot-servidor.md,chatwoot-respaldo-restauracion.md,chatwoot-vigilancia.md}`
- `docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md`
- `docs/legal/privacidad/inventario-terceros.md` (sección nueva de Chatwoot)
- `docs/specs/0583-chatwoot-vps-e1/{spec.md,investigacion-2026-10-29.md}`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (filas 1.1–1.7)
- `docs/specs/0582-chatwoot-piloto/spec.md` (solo la fila de la decisión G, por encargo del Director, 2026-11-01)
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
- **2026-10-29 (noche):** P5 cerrada (T-25). La llave de respaldos del 14-10 no apareció: se cambió a dos llaves nuevas, de Sam y de emergencia, con respaldos y pruebas el mismo día (T-26; coordinado por el Director). P4 hecha y P3 pospuesta. Cloudflare Access para `/super_admin`, preparado y probado en local.
- **2026-11-05:** los correos, que corrían en el VPS desde el 2026-10-30 sin estar en `main`, se integran por `codex/0583-correos-chatwoot`, después de la PR de SDD-0584. A «¿Autorizas fusionar en main los correos de Chatwoot que ya corren en el VPS?», Sam respondió «Sí, fusiónalos», transmitido por el Director General. Cubre fusionar, no reinstalar ni copiar nada a `/srv/chatwoot`. Comparación con el VPS y lo que queda: en el handoff.
- **2026-11-05 (logs):** el filtro de 1.7 no tapaba las líneas propias de los canales, y entran clientes reales por Instagram desde el 2026-10-31. A «¿Arreglamos ya que el registro de Chatwoot guarde esos mensajes?», Sam respondió «Sí, arréglalo ya», transmitido por el Director General. Según él, cubre la PR, la fusión y la instalación de ese filtro con su reinicio; no cubre borrar líneas viejas. Líneas, evidencia y receta: [handoff](../../../.agents/handoffs/0583-logs-canales.md). Hallazgo: H1 bis de la [revisión](../../legal/privacidad/revision-chatwoot-e1-2026-10-29.md).
- **2026-11-05 (filtro instalado):** #375 fusionada a las 16:08:16Z (`49bdba2e5`). El Director General corrió la receta de 16:09Z a 16:12Z, con código 0 y sin recrear los contenedores. Huella en vivo: antes `10c24f5c2c5de738`, ahora `caf1430ddfba9368`, la de `main`. La sonda dio 0, 1, 1 y 1. Sidekiq tardó 1 min 55 s en volver, y Rails 56 s. Evidencia en `/srv/ops/evidencias/filtro-chatwoot-20261105T160907Z`. Todo, según él. **Falta el paso 6:** contar con el primer entrante real después de las 16:12Z. Las líneas viejas siguen ahí, y borrarlas lo decide Sam.
- **2026-11-06 (tanda D publicada):** con ella, todo lo de Chatwoot del mandato está en producción. Detalle en la SDD-0582. Los correos en `PIEZAS` van en una PR aparte, después de esta nota.
- **2026-11-06 (paso 1.6 bis, alarmas):** el Director General pidió, antes de las filas 4.5 y 8.2 de la SDD-0582, «la alarma de la puerta 7 de 4.9 en `vigilar.sh`, si no está ya». También pidió la renovación del token de Instagram que acordó con el Subdirector de Chatwoot. Se entregan `vigilar.sh` con los dos controles nuevos, `vigilar-whatsapp.sql`, `renovar-instagram.sh` con su timer diario, y una prueba en el CI con datos inventados, control rojo y mutantes. La puerta 7 está definida en el handoff `0582-e4-meta.md` (§«Puerta 7»). El tope inicial de mensajes que inicia DTD sigue sin vigilancia: se lee por la API de Meta cuando apruebe el nombre visible. Nada se instaló en el VPS; la receta está en el runbook §2 ter. Decisiones E1-D11 y E1-D12. [Handoff](../../../.agents/handoffs/0583-alarmas-whatsapp-instagram.md).
