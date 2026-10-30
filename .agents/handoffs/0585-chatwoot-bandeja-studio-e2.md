# Handoff — SDD-0585, paso 2.1 del programa SDD-0582 (PoC del iframe)

- **Fecha:** 2026-10-29
- **Worker:** Claude, owner `claude-0582-e2-poc`
- **Rama:** `codex/0582-e2-poc`, en el worktree `DTD-worktrees/0582-e2-poc`
- **Base:** apilada sobre `codex/0582-e1-chatwoot-vps` (PR #329), punta `16546aa2d`
- **Reserva:** SDD-0585, local, con `refs/heads/codex/sdd-reserve-0585-chatwoot-bandeja-studio-e2` en `24af1975`; sin publicar, igual que las reservas de 0583 y 0584.

## Resultado

**Sí, iframe.** La matriz completa y las decisiones E2-D1 a E2-D6 están en [`spec.md`](../../docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md) y en el [registro de la PoC](../../docs/specs/0585-chatwoot-bandeja-studio-e2/poc-iframe-2026-10-29.md).

| | Chrome 156 | Edge 156 | Firefox | Safari |
|---|---|---|---|---|
| Iframe | PASÓ | PASÓ | NO DISPONIBLE | PASÓ (WebKit de Playwright, indicador) |
| SSO | PASÓ | PASÓ | NO DISPONIBLE | PASÓ (indicador) |
| Micrófono / nota de voz | PASÓ | PASÓ | NO DISPONIBLE | NO DISPONIBLE (WebKit de Windows sin captura de medios) |

**Cabeceras:**
- **Studio:** solo en la ruta de la bandeja, excluida del catch-all:
  - `frame-src https://chat.dtdcargo.com`;
  - `Permissions-Policy` con `microphone=(self "https://chat.dtdcargo.com")`;
  - iframe con `allow="microphone"`.
- **Traefik:** sin cambios. `frame-ancestors 'self' https://dtdcargo.com` ya es correcto, porque Studio vive en `dtdcargo.com/studio` y `www` redirige al apex. **No** se agrega `https://studio…`.

**Lo que manda sobre el diseño de 2.2:**
1. **Mismo sitio, como invariante (E2-D1).** Desde otro sitio, el SSO no entra en ningún motor: la cookie del panel es Lax por omisión (S4).
2. **SSO solo cuando hace falta (E2-D5).** Con `MAX_USER_SESSIONS=5`, el sexto login de navegador da 409 y la pantalla para elegir sesión dentro del iframe (S5). Además, rack-attack corta a 5 logins por IP cada 5 minutos.

## Reproducir

```bash
cd infra/chatwoot/pruebas/iframe-poc
POC_TRABAJO=<carpeta fuera del repo> bash levantar.sh
PLAYWRIGHT_MODULE=<checkout>/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs \
  node matriz.mjs <POC_TRABAJO>/poc.json chrome edge webkit firefox
bash levantar.sh --bajar
```

- Arranque: ~65 s.
- Matriz: ~4 min.
- Es una corrida pesada: una a la vez.
- El token de la Platform App local queda en `<POC_TRABAJO>/secretos` (0600). Es local y sintético, y se borra con `--bajar` y la carpeta.

## Validación

| Comprobación | Resultado |
|---|---|
| `matriz.mjs` (corrida final 2026-10-29T19:35Z) | PASÓ en Chrome y Edge (I1–I3, S1–S3, M1–M3) y en S5. WebKit: I y S en PASÓ, M en NO DISPONIBLE. Firefox: NO DISPONIBLE |
| Controles | Los cinco controles bloquean (I2, I3, M2, M3, S4). Un falso verde evitado: en WebKit, el ícono de «grabando» aparece sin micrófono (E2-R6) |
| `node scripts/build-docs-index.mjs --check` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ: sin números repetidos; avisos históricos conocidos |
| `node scripts/avance-checklist.mjs …/checklist.md` | Avance 5,0 % (falta 95,0 %); 2.1 entre «entregados sin aceptar» |
| `bash -n` / `node --check` de los scripts | PASÓ |
| `pnpm verify` | NO EJECUTADO: no hay cambio de producto, solo scripts de prueba locales y documentos |

## Pendientes de esta tarea

- ~~Aceptación de 2.1~~: **aceptado por Sam el 2026-10-29** («Acepto 2.1»), en un commit aparte.
- **Firefox:** correr `matriz.mjs … firefox` si Sam autoriza descargar el Firefox de Playwright (~90 MB, cdn.playwright.dev). Si no, va al QA de 2.6 con Firefox de escritorio.
- **Safari real** (macOS o iOS): en 2.6.
- **E2-NV1:** `clipboard-write`, `autoplay` y el websocket de ActionCable dentro del iframe. Pasan a 2.2.

## Impacto documental

- Nuevos: `docs/specs/0585-…/{spec.md,poc-iframe-2026-10-29.md}`.
- Fila 2.1 del checklist.
- Índice de specs regenerado. El hueco 0584 es de esta base: la PR #331 no está debajo, y el driver del índice lo resuelve al integrar.
- `docs/runbooks/chatwoot-servidor.md` §3 dice «El otro lado del iframe … es de E2»: se actualiza en 2.2, cuando la cabecera exista.

## FUERA DE ALCANCE DETECTADO

- **rack-attack detrás de Cloudflare (E2-I3, NV).** El `req.ip` de Chatwoot podría ser la IP de Cloudflare, y entonces los topes por IP (login 5 cada 5 min, `req/ip`) se comparten entre usuarios. Le toca a E1 o E3: medirlo en el VPS con OK y, si hace falta, `trusted_proxies`.
- **`ensayo-local.sh` de E1 no copia `marca/`** a su carpeta de prueba (`preparar_carpeta`), así que el ensayo monta una carpeta vacía en `/app/public/dtd-marca`. Es inofensivo, pero el ensayo no cubre la marca.
- **Sesiones huérfanas:** un intento de SSO desde otro sitio crea la sesión en el servidor aunque el navegador no guarde la cookie (E2-R3), y cuenta para `MAX_USER_SESSIONS`.

---

# Paso 2.2 — la Bandeja en Studio (entregado, 2026-10-29)

Pedido por la sesión coordinadora del programa («CRM Chatwoot»), a cuenta de Sam: su texto, tal como lo citó esa sesión, fue «listo avanza con lo demas». Diseño E2-D7 a E2-D15, allowlist y aceptación en [`spec.md`](../../docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md) §«Paso 2.2». Nada desplegado ni aplicado.

## Qué quedó

| Pieza | Dónde | Pruebas |
|---|---|---|
| Cabeceras: `frame-src` del chat y micrófono delegado, solo en `/studio/bandeja/:path*` | `next.config.ts`, `lib/runtime/chatwoot-origin.ts` | `next-config.test.ts` con el matcher de Next (una sola CSP y una sola Permissions-Policy por URL); 2 mutantes muertos |
| Platform API (SSO y agente), configuración y marca `dtd_cw_sso` | `lib/studio/chatwoot/` | 35 casos; el `access_token` del agente no sale del cliente |
| Migración 0503: flag `chatwoot_inbox` y `chatwoot_agent_links` con RLS | `supabase/migrations/0503_chatwoot_bandeja.sql` (**NO APLICADA**, declarada en `migrations-baseline.json`) | PGlite con la 0337 real: 26 aserciones, control rojo, 8 mutantes y reaplicación |
| Módulo `bandeja`, RBAC (admin, commercial, support), flag con efecto `ruta`, i18n es-VE/zh-CN | `lib/studio/{modules,rbac,feature-flags-types}.ts`, `lib/i18n/*/bandeja.ts` | RBAC, view-guard, actions-guard (78 archivos, 447 acciones) y catálogo de flags |
| Página, iframe, vínculos (solo admin, con el mismo correo) y `signOut` | `app/studio/(app)/bandeja/`, `app/studio/(app)/actions.ts` | acciones 19 (doble que filtra; 3 mutantes), componente 8, `signOut` 1 |
| `/ui-check` | — | 3 ajustes aplicados: botones del sistema, `ConfirmDialog` y `ErrorAlert` |

## Hallazgos de este paso

- **Lookahead suelto (corregido aquí):** con `studio/bandeja` a secas en el catch-all, `/studio/bandejas` se quedaba sin **ninguna** cabecera de seguridad. Se acotó a `studio/bandeja(?:/|$)`.
- **Platform API:** `GET /platform/api/v1/users/{id}` devuelve el `access_token` personal del agente. El cliente lo descarta.
- **`signOut`:** la Platform API de 4.19.1 no revoca sesiones (E2-D13). Studio borra su marca y el próximo ingreso pide un SSO nuevo. La sesión del panel sigue viva en ese navegador para quien abra `chat.dtdcargo.com` directo, hasta 2 meses. El cierre real va en 2.7.
- **`CHATWOOT_URL` se lee en el build** (cabeceras de `next.config.ts`) **y en runtime** (servidor). Si algún día cambia, hay que reconstruir la imagen.

## Validación del paso 2.2 (hasta ahora)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | PASÓ (exit 0) |
| `eslint` de lo tocado | PASÓ |
| Vitest puntual (cabeceras, chatwoot, 0503, RBAC, flags, i18n, Bandeja, signOut, env) | PASÓ |
| `governance:check`, `components:check` | PASÓ |
| `pnpm verify` (2026-10-29, 21:00Z a 22:09Z) | **FALLÓ** (exit 1). Lo de este paso (pending-migration-symbols) se corrigió en `ccf28367c`. Los demás rojos son heredados o de carga: ver la tabla en `spec.md` §«Validación del paso 2.2». migrations-applied: NO DISPONIBLE (sin `.env.local`) |

## Pendientes del paso 2.2

- ~~verify verde~~: el Director dio el 2.2 por **entregado** con el verify del 2026-10-29 («el 2.2 queda ENTREGADO con el verify que tienes»). Falta la aceptación de Sam o del Director.
- Puertas que este paso no cruza, cada una con su OK nominal de Sam:
  - aplicar la 0503 en producción;
  - cargar `CHATWOOT_PLATFORM_TOKEN` y `CHATWOOT_ACCOUNT_ID` en el servidor de Studio;
  - desplegar;
  - encender `chatwoot_inbox`.
- **AUD-01 (no conformidad pendiente):** los vínculos no dejan evento en `entity_audit_log`. Va en 2.5.
- **E2-NV1:** `clipboard-write`, `autoplay` y el websocket dentro del iframe. Se miden en el QA de 2.6 contra un Chatwoot real.

## FUERA DE ALCANCE DETECTADO (2.2)

**Rojos del verify** (detalle y etiquetas en `spec.md` §«Validación del paso 2.2»):
- **sql-tests 0467 y 0497×2** (I): los archivos son idénticos a `main` `ec5786bb8`, salvo la 0503. Es de SDD-0573.
- **`infra/chatwoot/cf-access/verificador.test.mjs`** (R): usa `node:test`. Es de E1, y **rompería `main` al integrar**, porque el CI de calidad corre `pnpm test`.
- **`avance-checklist.test.mjs` «arranca en 0 %»** (R): es de E0 (SDD-0582).
- **e2e `sin-scroll-horizontal.spec.ts:119`** (R): flaky por compilación en frío de `next dev`. Sin dueño por ahora.
- **Timeouts de Vitest y e2e colgado** (R): por carga de la máquina; aislados pasan.

**Otros:**

- **El mismo lookahead suelto existe hoy con `studio/bitacora`:** cualquier ruta que empiece así (por ejemplo `/studio/bitacora-x`) se queda sin las cabeceras de seguridad. Hoy no hay una ruta así; corregirlo es otra tarea.
- **«Conversaciones» (SDD-0056)** es otra bandeja propia de Studio. Qué pasa con ella cuando Chatwoot sea la bandeja es una decisión de producto de Sam.

---

# Paso 2.3 — contador, webhook con push y tarjeta en la ficha (entregado, 2026-10-30)

Pedido por el Director con el OK de Sam («ok»). Diseño E2-D16 a E2-D25 y allowlist en [`spec.md`](../../docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md) §«Paso 2.3». La migración es la **0504**, dada por el Director. Nada desplegado ni aplicado, y el webhook no se registró en el Chatwoot del VPS.

## Qué quedó

| Pieza | Dónde | Pruebas |
|---|---|---|
| Migración 0504: `chatwoot_webhook_events`, `chatwoot_conversations` (en Realtime) y la RPC `chatwoot_registrar_evento` | `supabase/migrations/0504_chatwoot_eventos.sql` (**NO APLICADA**, declarada) | PGlite: 23 aserciones, control rojo, 9 mutantes y reaplicación |
| Webhook `POST /api/chatwoot/webhook`, con firma HMAC y anti-replay de 5 min | `app/api/chatwoot/webhook/route.ts`, `lib/studio/chatwoot/webhook-*.ts` | Firma, interpretación, procesamiento y ruta; mutante de firma muerto |
| Push al vinculado del asignado, o a todos, por el outbox | `webhook-procesar.ts` (`avisarPorPush`) | Destinatarios y casos sin aviso; mutante de filtro muerto |
| Contador del sidebar, vivo por Realtime | `BandejaBadge.tsx`, `StudioSidebar.tsx`, `layout.tsx` | `BandejaBadge.test.tsx` |
| Reconciliación con el token del agente | `bandeja/actions.ts` (`reconciliarBandeja`), `account-api.ts` | `actions.test.ts` y `account-api.test.ts` |
| `?c=N` y SSO a una conversación | `bandeja/page.tsx`, `BandejaClient.tsx`, `pedirEnlaceSso(conversacion)` | `actions.test.ts` y `BandejaClient.test.tsx` |
| Tarjeta en la ficha | `clientes/_components/ChatwootConversacionesCard.tsx`, `clientes/[markbox]/page.tsx` | `ChatwootConversacionesCard.test.tsx` |

## Decisiones menores que tomé (registro pedido por el Director)

- **Ruta del webhook:** `/api/chatwoot/webhook`, fuera de `/api/studio` porque no lleva sesión.
- **Tenant:** viene de `CHATWOOT_TENANT_ID`, un solo tenant por cuenta. Los eventos de otra cuenta se ignoran con 200.
- **Clave de idempotencia:**
  - semántica, no el `X-Chatwoot-Delivery`, para que un reintento con otro id de entrega también se deduplique;
  - de estado: `conversación:estado:updated_at`.
- **Orden:** un evento más viejo (`updated_at`) se registra pero no pisa el estado.
- **Reconciliación:**
  - hasta 4 páginas (100 conversaciones) con `status=all` en orden de actividad, una vez por montaje;
  - lo que el agente no ve en Chatwoot no se corrige con su token.
- **Contador:**
  - es el total del tenant, no el de cada agente: la vista por agente es de 2.7;
  - `unread_count` es el de Chatwoot, con tope de 10 por conversación (`last(10)`), así que el badge cuenta conversaciones, no mensajes.
- **Columna `id` generada en la 0504:** la necesita `useRealtimeTable`. La 0504 no está aplicada, así que se pudo cambiar.

## Validación del paso 2.3 (hasta ahora)

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | PASÓ |
| `eslint` de lo tocado | PASÓ |
| Vitest puntual (48 archivos: Bandeja, sidebar, ficha, webhook, chatwoot, RBAC, flags, runtime y env) | PASÓ: 1029 |
| Contrato 0504 en PGlite | PASÓ: 13/13 |
| `pending-migration-symbols` | PASÓ: 0 ROJO · 5 AMARILLO |
| `pnpm verify` (2026-10-30, 02:32Z a 03:30Z) | **FALLÓ** (exit 1). El rojo propio (contraste de `BandejaBadge`) se corrigió. Los demás son de carga (aislados PASÓ 32/32) o heredados del 2.2. sql-tests, schema-rebuild y migrations-applied: NO DISPONIBLE. Detalle en `spec.md` §«Validación del paso 2.3» |

## Pendientes del paso 2.3

- ~~`pnpm verify` con turno~~: corrido el 2026-10-30.
- ~~sql-tests y schema-rebuild con Docker~~: corridos el 2026-10-30. 0503 y 0504 PASÓ; los 3 rojos son de SDD-0573. schema-rebuild PASÓ.
- ~~Hallazgo de Codex~~ (el evento quedaba procesado aunque fallara la acción): corregido en `19df1e51f`, con rojo primero. Ver `spec.md` §«Después del verify».
- **Reproceso de eventos fallidos:** Chatwoot 4.19.1 no reintenta webhooks de cuenta (C). Un evento fallido espera una reentrega manual o un reproceso propio, que se propone para E10.
- **Puertas,** cada una con su OK nominal de Sam:
  - aplicar la 0503 y la 0504;
  - cargar `CHATWOOT_WEBHOOK_SECRET` y `CHATWOOT_TENANT_ID`;
  - crear el webhook de cuenta en Chatwoot con `message_created` y `conversation_status_changed`, apuntado a `https://dtdcargo.com/api/chatwoot/webhook`;
  - desplegar.
- **Retención (ENCONTRADO por revisar-datos-ve):** fijar un plazo para `chatwoot_webhook_events` y `chatwoot_conversations`.

## FUERA DE ALCANCE DETECTADO (2.3)

- **El aviso de mensaje entrante a staff de «Conversaciones»** (SDD-0056) mete nombre y un extracto del mensaje en Telegram y en el push del portal (`conversation-inbound-notify.ts`, `conversation-reply-push.ts`). No hay una regla escrita contra datos personales en el cuerpo de un push. Se recomienda escribirla.
- **El verificador de Resend compara la firma con `===`** (`resend-api.ts:240-296`), no en tiempo constante.

---

# Paso 2.3 — piezas de la v3: tope de tamaño y reintento propio (entregado, 2026-10-30)

Pedido por el Director: «terminas las dos piezas de la v3 ahora, no las pasamos a E10». Commit `84e68c809`, con rojo primero (7 casos en Vitest, 2 archivos sin módulo y el contrato SQL). Decisión E2-D26 en `spec.md`.

| Pieza | Dónde | Pruebas |
|---|---|---|
| Tope de 256 KiB antes de la firma → 413 | `lib/studio/chatwoot/webhook-body.ts`, `route.ts` | `webhook-body.test.ts` (Content-Length, flujo sin Content-Length, bytes y no caracteres) y la ruta; 2 mutantes muertos |
| El evento guarda lo mínimo, espera creciente, descartado al quinto intento | 0504 (`chatwoot_webhook_events`, `chatwoot_cerrar_evento`, `chatwoot_tomar_pendientes`) | Contrato 0504: 18/18, 49 aserciones y 14 mutantes (4 nuevos: espera, tope, toma temprana y lectura de no-admin) |
| Reproceso con lo guardado | `reprocesarEventosChatwoot` en `webhook-procesar.ts` | Reproceso, nuevo fallo y sin 0504 |
| Cron cada 5 min | `app/api/cron/chatwoot-reintentos/route.ts`, `vercel.json`, `infra/dtd-cargo/cron/crontab` | Ruta (403 sin secreto) y `build-crontab.test.ts` (20 crons) |
| Descartados visibles para el admin | `bandeja/page.tsx`, `BandejaClient.tsx`, RLS de 0504 | `BandejaClient.test.tsx` y contrato (no-admin 0, admin de T1 sí, T2 no) |

**Validación:**

| Comprobación | Resultado |
|---|---|
| `tsc` y `eslint` | PASÓ |
| Vitest afectado | PASÓ: 23 archivos, 710 pruebas |
| `pending-migration-symbols` | PASÓ: 0 ROJO · 5 AMARILLO |
| `build-crontab --check` | PASÓ: 21 crons |
| `pnpm verify` completo con Docker sobre `d714834be` (04:28Z a 05:28Z) | FALLÓ, **sin rojos propios**. Por paso, en la tabla de abajo |

### Verify completo de la v3 (turno del Director)

Docker 29.9.1 encendido. Medidos 16 de 17 pasos.

| Paso | Resultado | De quién es |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 5 AMARILLO), build | PASÓ | — |
| schema-rebuild | PASÓ | 475 migraciones desde cero, con la 0503 y la 0504; aislamiento multi-tenant en 219 tablas |
| sql-tests | FALLÓ: 248 verdes y 3 rojos (`0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_…_carrera`) | Heredado de SDD-0573: los tres `.test.sql` son idénticos a `main`, igual que en el 2.2. **`0503_chatwoot_bandeja` y `0504_chatwoot_eventos` PASÓ** en Postgres real, ya con la 0504 de la v3 |
| test (Vitest) | FALLÓ: 13403 verdes y 3 rojos en cada una de las dos vueltas | Ninguno propio: todos son timeouts por carga, en archivos fuera del diff. Detalle abajo |
| e2e | FALLÓ: Shipping Mark y luego colgado | Ninguno propio. Detalle abajo |
| migrations-applied | NO DISPONIBLE (SKIP): sin `.env.local` | Sin medir: no se copian secretos al worktree |

**Los rojos de Vitest** (timeouts; ninguno de estos archivos está en el diff contra la base E1 `2d51991a5`):
- **Primera vuelta:** `vitest/pglite-limpio.test.ts` (60 s), `app/p/[token]/PackingListProductsStep.test.tsx` (20 s) y `scripts/__tests__/entorno-prueba-scripts.test.mjs` (600 s).
- **Reintento:** `scripts/__tests__/norte-bake.test.mjs` (20 s), `entorno-prueba-scripts.test.mjs` y `infra/ops/tests/migraciones.test.mjs` (600 s cada una).
- **Aislados después del verify:** `pglite-limpio`, `PackingListProductsStep` y `norte-bake` PASÓ, 18/18. Los dos scripts bash de 600 s ya habían pasado aislados en el 2.3 (32/32) y no se repitieron.

**Los rojos de e2e** (no hay archivos de `e2e/` ni `playwright.config.ts` en el diff):
- `sin-scroll-horizontal.spec.ts:119` (Shipping Mark → `/registro`), en chromium y mobile-chrome, con su reintento. Es el mismo rojo heredado del 2.2 y del 2.3.
- **Flaky:** `calculadora-semantic-colors.spec.ts:53` en dark falló en chromium y pasó al reintento.
- **Colgado:** el watchdog cortó la corrida tras 10 min sin salida, en mobile-safari, después de `cbm-ayuda.spec.ts:111` (prueba 189 de 240). Iban 170 verdes y 14 saltadas; unas 50 quedaron sin medir. Que no sea de esta rama es una **inferencia**: lo que corría era la calculadora pública, y esta rama no la toca. No se comprobó repitiendo e2e.

**Rojos propios:** ninguno, así que no hubo arreglo ni otra corrida.

### Puerta de integración: el cron `chatwoot-reintentos`

- **Llega al VPS con el merge a `main`.** `main` despliega solo en el VPS. El merge suma al crontab del contenedor `cron` esta línea: `*/5 * * * * curl … http://web:3000/api/cron/chatwoot-reintentos` (`infra/dtd-cargo/cron/crontab:26`, generada desde `vercel.json`). No hace falta otro paso de despliegue.
- **Sin la 0504 responde `omitido`.** Si la 0504 no está aplicada, `chatwoot_tomar_pendientes` no existe y la ruta responde 200 con `{ ok: true, tomados: 0, procesados: 0, fallidos: 0, omitido: true }`. No falla y no escribe nada.
- **Lo que deja en el log.** Cada 5 minutos, una línea `[chatwoot] chatwoot_tomar_pendientes: <código>`, con el código de PostgREST y sin datos personales. Es esperable mientras falte la 0504.
- **Para el integrador:**
  - Comprobar que `CRON_SECRET` está en el contenedor `cron`; ya lo usan los demás crons.
  - Después del deploy, mirar que la ruta conteste `omitido` y no 403 ni 500.
  - Al aplicar la 0504, con OK nominal de Sam y siguiendo el runbook, el cron empieza a reprocesar solo.
  - Mientras no se registre el webhook en Chatwoot no habrá eventos, así que tomará 0.

---

# Paso 2.4 — Dashboard App «Ficha DTD» (entregado, 2026-10-30)

Lo pidió el Director el 2026-10-30, en la misma rama y sin pausar. No hay migración. Diseño, allowlist, validación y revisar-datos-ve: SDD-0585 §«Paso 2.4» (E2-D27 a E2-D35).

**Qué quedó:**
- **Página:** `/studio/ficha-chat`, en el grupo `(panel)` y sin sidebar. Es la URL que se registra como Dashboard App.
- **Acción:** `pedirFichaDtd`, en `bandeja/actions.ts`.
- **Lógica:** `lib/studio/chatwoot/dashboard-app.ts` filtra el contexto, y `obtenerConversacion` pide la conversación con el token del agente.
- **Cabeceras:** `frame-ancestors` solo del chat y sin `X-Frame-Options`.
- **Proxy:** sin sesión deja pasar solo esa ruta exacta.
- **Textos** en es-VE y zh-CN.
- **Runbook de registro,** sin ejecutar.

**Lo que hay que saber:**
- **El contexto no es una credencial.** Chatwoot 4.19.1 no firma el contexto de una Dashboard App: lo manda con `postMessage(…, "*")` y con nombre, teléfono y correo del contacto (`Frame.vue`, evidencia C). Por eso la «firma» se arma de otro modo:
  - la sesión de Studio;
  - el agente vinculado, que tiene que ser el del contexto;
  - la conversación pedida a Chatwoot con el token de ese agente;
  - el `client_id` que decidió la base.

  Del contexto solo salen los dos ids.
- **Todas las apps reciben el contexto.** Chatwoot manda ese contexto a toda Dashboard App registrada. Al registrar la nuestra, conviene revisar que no haya otras (revisar-datos-ve: NO VERIFICABLE).
- **Huecos preparados:**
  - `FichaDtd.segmento` es siempre `null` hasta que E10 lo exponga;
  - `FichaDtdView` recibe `costoChat` (el 2.8 opcional) y hoy nadie lo pasa.
- **Para E10:** el tipo `SegmentoFicha` ya está en `bandeja/actions.ts` (`"cliente" | "lead_registrado"`). Con eso basta para llenar el campo en `pedirFichaDtd` sin tocar la vista.

**Validación:**
- tsc y eslint PASÓ.
- 1021 pruebas afectadas PASÓ, en 43 archivos.
- `check-rsc-boundary` y `components:check` PASÓ.
- 13/13 mutantes muertos.
- `/ui-check` con dos ajustes aplicados.
- `pnpm verify` completo con turno del Director, sobre `cf755a7a6`: FALLÓ con un rojo propio (`pending-migration-symbols`), ya corregido. Lo demás es heredado o por carga, y la tabla está más abajo.

**Puertas que este paso no cruza** (cada una con su OK):
- desplegar;
- aplicar la 0503 y la 0504;
- registrar la Dashboard App en el Chatwoot del VPS (`docs/runbooks/chatwoot-ficha-dtd.md`).

### Verify completo del 2.4 (turno del Director, 06:30Z a 07:27Z)

| Paso | Resultado | De quién es |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, build | PASÓ | — |
| schema-rebuild | PASÓ: 475 migraciones desde cero; aislamiento multi-tenant en 219 tablas | — |
| pending-migration-symbols | FALLÓ → **corregido** | **Propio.** Al editar `bandeja/actions.ts`, las líneas declaradas se vencieron, y `pedirFichaDtd` sumó un sitio de llamada de `chatwoot_conversations`. Se resincronizaron las líneas y se declaró la degradación del sitio nuevo: sin la 0504 la acción responde «service» antes de leer. Repetido solo: 0 ROJO · 5 AMARILLO |
| sql-tests | FALLÓ: 248 verdes y 3 rojos (`0467_reversion_credito_carrera` y los dos `0497_reverso_al_anular_factura`) | Heredado de SDD-0573, igual que en el 2.2 y el 2.3. **0503 y 0504 PASÓ** |
| test (Vitest) | FALLÓ: 13470 verdes y 2 timeouts de 600 s; al reintento, 13471 y 1 | Por carga: `scripts/__tests__/entorno-prueba-scripts.test.mjs` e `infra/ops/tests/migraciones.test.mjs`, fuera del diff. **Aislados después: PASÓ 32/32** |
| e2e | FALLÓ: 218 verdes, 1 rojo, 1 flaky y 20 saltadas, en las dos vueltas | El rojo es `sin-scroll-horizontal.spec.ts:119` (Shipping Mark), heredado. Flaky: `auth.spec.ts:81` y `calculadora-semantic-colors.spec.ts:53`. **No se colgó:** corrieron todas |
| migrations-applied | NO DISPONIBLE (SKIP): sin `.env.local` | Sin medir |

### Puerta de integración: registrar la Ficha DTD en Chatwoot

Decisión del Director (2026-10-30): **no se registra ahora**. La URL `https://dtdcargo.com/studio/ficha-chat` todavía no existe en producción, porque no está en `main`. El orden es este:
1. merge a `main`, con el despliegue automático al VPS;
2. comprobar en producción que `/studio/ficha-chat` responde con `frame-ancestors https://chat.dtdcargo.com` y sin `X-Frame-Options`;
3. aplicar la 0503 y la 0504, con OK nominal de Sam y siguiendo el runbook;
4. registrar la Dashboard App, con OK de Sam y siguiendo `docs/runbooks/chatwoot-ficha-dtd.md`. De paso, revisar que no haya otras Dashboard Apps: todas reciben el contexto con datos del contacto.

### FUERA DE ALCANCE DETECTADO (2.4)

- `getClientAccountState` (`lib/studio/client-queries.ts:801`, SDD-0558) registra `e.message` de PostgREST cuando falla el conteo de embarques. No se midió si ese mensaje puede llevar valores. Es código compartido de la ficha y no se tocó.

---

# Paso 2.5 — ciclo de vida de los agentes: Usuarios, cron y salud (entregado, 2026-10-30)

Lo pidió el Director el 2026-10-30, en la misma rama. No hay migración. El trabajo se cortó con el reinicio de la PC (14:02Z) y se retomó sin descartar nada. El detalle está en SDD-0585 §«Paso 2.5» (E2-D36 a E2-D43).

**Qué quedó:**
- **Alta:** Bandeja › Vínculos › «Dar de alta» (`altaAgente`). Crea o adopta el agente por la Platform API, lo mete en la cuenta como agente y lo vincula. Solo para quien ve la Bandeja.
- **Baja:**
  - en Usuarios, al desactivar o cambiar el rol, en ese momento (`sincronizarAgenteDeUsuario`);
  - en el cron diario `/api/cron/chatwoot-agentes`, a las 12:30 UTC, como red.

  Nunca saca al usuario de servicio ni al último admin humano. Si Chatwoot no responde no hay baja: el vínculo queda y se reintenta.
- **Salud:**
  - alertas: Chatwoot no responde, cuenta **sin admin humano**, falta `CHATWOOT_SERVICE_USER_ID`, vínculos fuera de la cuenta y baja bloqueada;
  - se ve en Bandeja › Vínculos;
  - el cron avisa por push a los admins.
- **Runbook:** `docs/runbooks/chatwoot-agentes.md`.

**Validación** (puntual, porque E10 tiene el próximo turno de verify):
- tsc y eslint PASÓ.
- 1021 pruebas afectadas PASÓ, en 51 archivos.
- `entorno-prueba-scripts` 2/2.
- 17/17 mutantes muertos.
- `pending-migration-symbols` 0 ROJO · 5 AMARILLO.
- `build-crontab --check` (22 crons) y `check-rsc-boundary` PASÓ.
- `pnpm verify` completo **NO EJECUTADO**: va después de E10 y E6, con turno del Director.

**Puertas de integración del 2.5** (cada una con su OK):
- El merge a `main` suma al crontab del VPS `30 12 * * * … /api/cron/chatwoot-agentes`. Sin la 0503 responde `omitido`; con la 0503 y sin `CHATWOOT_SERVICE_USER_ID`, alerta «falta configurar el usuario de servicio».
- Cargar `CHATWOOT_SERVICE_USER_ID` en el `.env` del VPS. El valor está en `/srv/chatwoot/secretos/platform-app.env`.
- La primera corrida en producción puede dar de baja a un agente vinculado si su usuario de Studio ya no ve la Bandeja. Conviene revisar los vínculos antes.

**Pendiente de esta tarea:**
- **AUD-01:** auditar en `entity_audit_log` el alta y la baja del vínculo. Necesita migración; el número se pidió al Director el 2026-10-30 y no llegó.

### FUERA DE ALCANCE DETECTADO (2.5)

- La baja no borra el usuario de Chatwoot (nombre y correo del empleado), a propósito, para conservar la asignación de sus conversaciones. Falta un plazo de borrado (`DELETE platform/api/v1/users/{id}`), para decidir en 2.6 o 2.7 con Sam. Es el ENCONTRADO de revisar-datos-ve.
- Vitest toma el filtro de ruta como expresión regular: con `(app)` sin escapar, quedan archivos afuera en silencio. La validación puntual del 2.4 pudo contar de menos; el verify completo sobre `cf755a7a6` la cubre.

---

# Paso 2.6 — revisión de E2, QA, caídas, runbook y /privacidad (entregado, 2026-10-30)

Lo pidió el Director el 2026-10-30, solo con pruebas puntuales. Detalle en SDD-0585 §«Paso 2.6». La propuesta del 2.7 queda en la misma SDD, **sin implementar**.

**Qué quedó:**
- **revisar-datos-ve de toda E2:** 12 puntos, con 3 ENCONTRADO:
  - retención de eventos y conversaciones (se proponen 90 días y 12 meses);
  - el usuario de Chatwoot sigue tras la baja (se proponen 12 meses);
  - AUD-01.

  Además, 3 NO VERIFICABLE: derechos sobre la conversación en Chatwoot, otras Dashboard Apps y la ubicación del VPS frente a lo que dice `/privacidad`.
- **`/privacidad`:** lead de WhatsApp, BSUID (1 año sin actividad), respuesta automática (30 días), lead perdido (anonimizado a los 12 meses) y Meta como tercero. La fecha pasa a «30 de octubre de 2026». Lo fija `app/__tests__/privacidad-chat.test.ts`.
- **`/ui-check`:** el `aria-label` del badge pasa por i18n.
- **Caídas del webhook:** escenario de punta a punta con la 0504 real en PGlite (3/3 y 4/4 mutantes).
- **QA de navegadores:** `e2e/ficha-chat.spec.ts` (chromium, mobile-chrome y WebKit) entra en el próximo verify; Firefox NO DISPONIBLE.
- **Runbook:** `docs/runbooks/chatwoot-bandeja.md`.

**Puertas de integración nuevas:**
- **`/privacidad` se publica con el merge a `main`.** Antes hacen falta tres cosas: el OK de Sam al texto y la 0505 (E10) y la 0506 (E6.2) aplicadas con sus crons. Lo publicado obliga: no puede prometer plazos que todavía no corren.
- **El e2e de la Ficha** corre por primera vez en el verify de esta rama. Si falla, hay que mirar `requiereSupabase` y el `frame-ancestors` del entorno local.

**Pendientes para Sam** (por el Director):
- plazos de retención 5a y 5b;
- número de migración para AUD-01;
- OK al texto de `/privacidad`;
- ubicación del VPS;
- las 5 decisiones de la matriz del 2.7.

### FUERA DE ALCANCE DETECTADO (2.6)

- **`/privacidad` §5** dice que los datos se alojan en Estados Unidos. Desde SDD-0505 la base vive en el VPS de Contabo, y la ubicación del VPS no se comprobó. Si no es Estados Unidos, ese punto hay que corregirlo, pero no es del 2.6.
- **La prueba de «otro origen»** del e2e afirma una ausencia: también daría verde si la página no cargara por otro motivo. La prueba fuerte es la de las cabeceras, del mismo spec.
