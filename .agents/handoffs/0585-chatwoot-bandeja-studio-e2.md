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
