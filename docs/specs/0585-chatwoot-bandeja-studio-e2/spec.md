---
sdd: "0585"
title: "Bandeja de Chatwoot dentro de Studio, usuarios y permisos (etapa E2 del programa SDD-0582)"
status: in-progress
author: "Claude Worker «0582 E2» (Sam)"
created: 2026-10-29
updated: 2026-10-29
supersedes: null
superseded_by: null
related: ["0582", "0583", "0146"]
confidencialidad: interno
---

# SDD-0585 — Bandeja de Chatwoot dentro de Studio (E2)

> SDD hija de la [SDD-0582](../0582-chatwoot-piloto/spec.md), etapa **E2 «Bandeja en Studio, usuarios y permisos»**, pasos 2.1 a 2.7 del [checklist](../0582-chatwoot-piloto/checklist.md). Esta primera entrega cierra **solo el paso 2.1**, la prueba de concepto con decisión sí o no. Los pasos 2.2 a 2.7 amplían esta SDD en su propia rama y PR.

## Contexto

- **Decisión A del programa:** el panel de Chatwoot va en un iframe sobre `chat.dtdcargo.com`, con SSO por la Platform API. Si la prueba 2.1 falla, se abre en una pestaña aparte.
- **E1 ya dejó el lado de Chatwoot** ([SDD-0583](../0583-chatwoot-vps-e1/spec.md)): Traefik borra `X-Frame-Options` y fija `frame-ancestors 'self' https://dtdcargo.com`; existe la Platform App «DTD Studio».
- **El lado de Studio todavía bloquea el iframe:** hoy no tiene `frame-src` y manda `microphone=()` (E2-T3).

## Decisión del paso 2.1: **sí, iframe**

Evidencia: [registro de la PoC](poc-iframe-2026-10-29.md).

En Chrome y Edge pasan las tres capacidades:
- el iframe carga y sus controles bloquean lo que tienen que bloquear;
- el SSO de un solo uso entra, la sesión sigue en un iframe nuevo y el enlace reusado no entra;
- la nota de voz de Chatwoot consigue el micrófono dentro del iframe.

En el WebKit de Playwright (indicador de Safari) pasan el iframe y el SSO. Firefox y el micrófono en Safari quedan NO DISPONIBLE en esta máquina y se cubren en 2.6 (QA de navegadores).

| ID | Decisión | Por qué |
|---|---|---|
| E2-D1 | **Mismo sitio, como invariante.** La bandeja solo se monta desde un origen de `dtdcargo.com`. Studio no la ofrece en otro dominio (previsualizaciones en otro dominio, otro dominio propio): ahí muestra «Abrir en pestaña aparte» | La cookie de sesión del panel es Lax por omisión (E2-C1). Desde otro sitio, el SSO no entra en ninguno de los tres motores (E2-R3) |
| E2-D2 | **Studio, en la ruta de la bandeja y solo en ella:** CSP con `frame-src https://chat.dtdcargo.com` y `Permissions-Policy` con `microphone=(self "https://chat.dtdcargo.com")`. Esa ruta queda excluida del catch-all, como `/studio/bitacora`. El iframe lleva `allow="microphone"` | Sin `frame-src`, la CSP de hoy bloquea el marco (I3). Hacen falta la cabecera **y** el atributo (M2, M3). Varias `Permissions-Policy` sobre la misma URL se intersectan (gotcha de `next.config.ts`) |
| E2-D3 | **Studio sigue sin dejarse enmarcar:** `frame-ancestors 'none'` y `X-Frame-Options: DENY` no cambian. Studio es el marco, no el enmarcado | — |
| E2-D4 | **Traefik no cambia.** `CHATWOOT_FRAME_ANCESTORS=https://dtdcargo.com` ya es el origen de Studio. No se agrega `https://studio.…` (no existe), ni `www` (redirige al apex), ni orígenes de previsualización | E2-T1, E2-T2; E2-D1 |
| E2-D5 | **SSO solo cuando hace falta.** Studio pide el enlace de un solo uso en el servidor y nunca lo pone en su propia URL. No lo pide en cada visita: la primera vez de la sesión de Studio o cuando el panel avisa que no hay sesión. El mecanismo se define en 2.2. Al salir de Studio se cierra también la sesión del panel (`signOut`, en 2.2) | Cada SSO es un login: con 5 sesiones vivas, el 6.º da 409 y la pantalla para elegir cuál cerrar, **dentro del iframe** (E2-R7). Además, rack-attack corta a 5 logins por IP cada 5 minutos (E2-C4) |
| E2-D6 | **Pestaña aparte como salida de emergencia**, no como plan: el mismo enlace de SSO abierto arriba también funciona (es el flujo de E1). Studio lo ofrece si el iframe no carga | Pedido de Sam: «adentro de mi ERP, no de forma externa» |

**Pendiente para 2.2:** medir `clipboard-write`, `autoplay` y el websocket de ActionCable dentro del iframe (E2-NV1).

## Alcance de E2

| Paso | Entregable | Estado |
|---|---|---|
| 2.1 | PoC con banco reproducible, matriz y decisión | aceptado (Sam, 2026-10-29: «Acepto 2.1») |
| 2.2 | CSP y `Permissions-Policy` de la ruta (E2-D2), módulo, RBAC, flag, i18n, vínculos, `lib/studio/chatwoot`, SSO (E2-D5), capa persistente, página y `signOut` | aceptado (Sam, 2026-10-30: «Acepto todo») |
| 2.3 | Contador, webhook con push y tarjeta en la ficha | aceptado (Sam, 2026-10-30: «Acepto todo»), con el verify de `d714834be` registrado: FALLÓ solo por rojos heredados, unas 50 e2e NO EJECUTADAS (la corrida se colgó) y migrations-applied NO DISPONIBLE |
| 2.4 | Dashboard App «Ficha DTD» | entregado (2026-10-30), sin registrar en el Chatwoot del VPS |
| 2.5 | Ciclo de vida de los agentes: Usuarios, cron y salud | entregado (2026-10-30); AUD-01 pendiente de número de migración |
| 2.6 | revisar-datos-ve, `/ui-check`, QA de navegadores (incluye Firefox y Safari reales) y runbook | entregado (2026-10-30); e2e de la Ficha en el próximo verify; Firefox NO DISPONIBLE |
| 2.7 | Usuarios y permisos: matriz real de CE, sincronización, pruebas por usuario y revocación del SSO | propuesta lista para Sam (§«Propuesta para el paso 2.7»); sin implementar |

## Paso 2.2 — la Bandeja en Studio

Pedido el 2026-10-29 por la sesión coordinadora del programa («CRM Chatwoot»), a cuenta de Sam («listo avanza con lo demas»). Se programa en la rama de E2, sin desplegar ni aplicar nada.

### Diseño

| ID | Decisión |
|---|---|
| E2-D7 | **Módulo `bandeja`** («Bandeja», grupo COMERCIAL, `/studio/bandeja`). La lista de módulos ya tiene «Conversaciones» (SDD-0056), una bandeja propia que no es Chatwoot: qué pasa con ella es una decisión aparte (ver «Fuera de alcance detectado» en el handoff). |
| E2-D8 | **RBAC:** `bandeja` la ven `admin` (implícito), `commercial` y `support`. Son los roles de quien atiende (E0-D2: Sam admin más una persona que ve y contesta). Ver la Bandeja no da permiso de editar nada en Studio: lo que la persona puede hacer en Chatwoot lo decide su rol de Chatwoot (2.7). |
| E2-D9 | **Flag `chatwoot_inbox`**, apagado por omisión, con efecto `ruta`: el layout llama `requireFeatureEnabled("bandeja")` y el sidebar lo esconde. La migración redefine `feature_flag_catalog()` desde su última definición (0337) agregando la fila, y siembra la fila en los tenants existentes con `on conflict do nothing`. |
| E2-D10 | **Vínculo usuario de Studio ↔ agente de Chatwoot** en `public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id, created_by, created_at)`: uno a uno dentro del tenant. RLS: cada usuario lee su propia fila y el admin lee y escribe las del tenant (`is_tenant_admin()`). Lo crea solo un admin, y **solo si el correo del agente en Chatwoot (Platform API) es el mismo del usuario de Studio**. Un vínculo equivocado sería entrar a Chatwoot como otra persona. |
| E2-D11 | **`lib/studio/chatwoot/`** (`server-only`): configuración por entorno (`CHATWOOT_URL`, `CHATWOOT_PLATFORM_TOKEN`, `CHATWOOT_ACCOUNT_ID`), cliente de la Platform API que nunca lanza (unión ok/error, patrón de SeaRates), y validación de que el enlace de SSO es del origen del chat. El token **solo** vive en el entorno del servidor. |
| E2-D12 | **SSO solo cuando hace falta** (E2-D5): una cookie de Studio `dtd_cw_sso` (httpOnly, `Secure`, `SameSite=Lax`, de sesión, `path=/studio`) guarda el id del usuario al que se le pidió el último SSO. Si coincide con el usuario actual, el iframe abre el panel sin pedir otro. Si no hay o no coincide, el cliente pide el enlace por una server action y lo pone en el iframe. Hay un botón «Volver a entrar» que fuerza un SSO nuevo. El enlace nunca pasa por la URL de Studio. |
| E2-D13 | **`signOut` de Studio** borra `dtd_cw_sso`, así que el próximo ingreso a Studio pide un SSO nuevo, que reemplaza la sesión del panel en el navegador. **Límite conocido:** la Platform API de 4.19.1 no revoca sesiones. La sesión del panel sigue viva en ese navegador si alguien abre `chat.dtdcargo.com` directo, hasta 2 meses (`token_lifespan`). El cierre real va en 2.7, por un script del panel (`DASHBOARD_SCRIPTS`) que llama al logout de Chatwoot cuando Studio se lo pide por `postMessage`; requiere despliegue en el VPS. |
| E2-D14 | **Cabeceras** (E2-D2): `next.config.ts` agrega la regla `/studio/bandeja/:path*` con la CSP de Studio más `frame-src <origen del chat>` y la `Permissions-Policy` estricta con `microphone=(self "<origen del chat>")`, y la excluye del catch-all. El origen sale de `lib/runtime/chatwoot-origin.ts` (`CHATWOOT_URL`; por omisión `https://chat.dtdcargo.com`; solo https, o http en localhost), el mismo que usa el servidor. |
| E2-D15 | **Estados de la página:** sin configurar (falta el token o la cuenta), sin vínculo (con el formulario de vínculos si eres admin), cargando, error de SSO (con reintento y «Abrir en pestaña aparte», E2-D6) y el panel. Textos en es-VE y zh-CN. |

### Allowlist exacta (paso 2.2)

- **Configuración:** `next.config.ts`; `.env.example` (bloque de Chatwoot); `infra/dtd-cargo/.env.example`.
- **Origen del chat:** `lib/runtime/chatwoot-origin.ts`; `lib/runtime/__tests__/chatwoot-origin.test.ts`; `lib/runtime/__tests__/next-config.test.ts` (casos nuevos).
- **Lógica:** `lib/studio/chatwoot/{config.ts,platform-api.ts,chatwoot-types.ts,links-queries.ts,sso-cookie.ts}`; `lib/studio/chatwoot/__tests__/{platform-api.test.ts,chatwoot-types.test.ts}`.
- **Registro del módulo:** `lib/studio/modules.ts`, `lib/studio/rbac.ts`, `lib/studio/feature-flags-types.ts`; `lib/studio/__tests__/feature-flags-catalog.test.ts` (lee la última definición del catálogo, no solo la de 0337); `lib/studio/rbac-actions-guard.test.ts` (inventario: 78 archivos y 447 acciones, con la justificación de las tres nuevas); `app/studio/_components/icons.tsx` (ícono `chat`).
- **Textos:** `lib/i18n/es-VE/{chrome.ts,bandeja.ts}`, `lib/i18n/zh-CN/{chrome.ts,bandeja.ts}`, `lib/i18n/dict.ts`.
- **Pantalla:** `app/studio/(app)/bandeja/{layout.tsx,page.tsx,actions.ts}`; `app/studio/(app)/bandeja/_components/{BandejaClient.tsx,VinculosAdmin.tsx}`; `app/studio/(app)/bandeja/__tests__/{actions.test.ts,BandejaClient.test.tsx}`.
- **Cierre de sesión:** `app/studio/(app)/actions.ts`; `app/studio/(app)/__tests__/signout-bandeja.test.ts`.
- **Migración:** `supabase/migrations/0503_chatwoot_bandeja.sql`; `supabase/tests/0503_chatwoot_bandeja.test.sql`; `lib/studio/__tests__/chatwoot-bandeja.migration.test.ts`; `supabase/migrations-baseline.json` (la 0503 declarada pendiente); `supabase/pending-migration-symbol-declarations.json` (degradación sin 0503).
- **Documentos:** `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`; `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.2); `docs/architecture/module-sdd-map.md`; `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`.

### Aceptación del paso 2.2

1. **Cabeceras:** `next-config.test.ts`, con el matcher de rutas de Next, prueba que `/studio/bandeja` y sus sub-rutas reciben **una sola** CSP (con `frame-src` del chat) y **una sola** `Permissions-Policy` (con el micrófono delegado al chat). Prueba también que el resto de `/studio` sigue con `microphone=()` y sin `frame-src`.
2. **Platform API:** sus pruebas cubren éxito, 401/404/5xx, red caída, sin configuración y un enlace de SSO de otro origen (rechazado).
3. **Vínculo:** la acción rechaza a quien no es admin, un usuario de otro tenant y un correo distinto. Sin vínculo no hay SSO. Las pruebas usan dobles que aplican los filtros.
4. **Migración:** el contrato en PGlite pasa, con el control rojo sin la migración. Cubre RLS (cada uno ve lo suyo; el admin, su tenant; nadie, otro tenant), unicidad y la fila del flag en tenants existentes y nuevos.
5. **Registro:** `rbac.test.ts`, `rbac-view-guard`, `rbac-actions-guard`, `feature-flags-catalog` e i18n (typecheck) en verde.
6. **Cierre:** `pnpm verify` PASÓ, coordinado con la sesión del programa (una corrida pesada a la vez).
7. **Puertas que esta entrega no cruza:** aplicar la 0503 en producción (OK nominal de Sam, runbook), cargar el token y las variables en el servidor de Studio, y desplegar.

### Validación del paso 2.2 — `pnpm verify` del 2026-10-29 (21:00Z a 22:09Z, punta `de4ea0747`)

Turno dado por la sesión coordinadora. Resultado global: **FALLÓ** (exit 1), con 16 de 17 pasos medidos.

| Paso | Resultado | De quién es |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions | PASÓ | — |
| test (Vitest) | FALLÓ: 1 suite y 4 casos | Ver abajo: ninguno es de este paso |
| docs:check, numbering, feature-constants, components:check, governance:check | PASÓ | — |
| migrations-applied | NO DISPONIBLE (SKIP): el worktree no tiene `.env.local` con la URL y la clave de servicio | Sin medir. No se copian secretos a worktrees |
| pending-migration-symbols | FALLÓ → **corregido** en `ccf28367c` | De este paso: faltaba declarar `chatwoot_agent_links` (0503 pendiente). Ahora 0 ROJO · 4 AMARILLO |
| sql-tests | FALLÓ: `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_…_carrera` | Heredado de SDD-0573, que está en la base: preflight de `excepcion_al_cierre_vigente(uuid)` y archivos no tocados aquí. **`0503_chatwoot_bandeja.test.sql` PASÓ** |
| schema-rebuild | PASÓ | — |
| e2e | FALLÓ: 1 rojo, 1 flaky y después colgado 22,6 min (el watchdog lo cortó) | El rojo es `sin-scroll-horizontal.spec.ts:119` (Shipping Mark → `/registro`, sitio público, no tocado). Aislado sale *flaky*: el primer intento espera la compilación en frío de `next dev` |
| build | PASÓ | — |

**Los rojos de Vitest:**
- `infra/chatwoot/cf-access/verificador.test.mjs`: «No test suite found», porque usa `node:test` y Vitest no ve suites. Es de E1 (`e93654ce3`), que está en la base.
- `scripts/__tests__/avance-checklist.test.mjs` («arranca en 0 %»): ya fallaba en la base, que daba 5,0 % desde que se aceptó E0. Es de SDD-0582.
- `PackingListProductsStep`, `supplier-flow` y `NewOperarioDrawer`: timeouts bajo carga, con 3 workers de Vitest caídos. Aislados pasan 37/37.

**Lo de este paso, medido aparte:** cabeceras, chatwoot, 0503 (PGlite y psql), RBAC, flags, i18n, Bandeja, `signOut` y `pending-migration-symbols`, todo en PASÓ.

#### FUERA DE ALCANCE DETECTADO (verify del 2.2)

Decisión del Director (2026-10-29): el 2.2 queda **entregado** con este verify. Los rojos de abajo no son de esta tarea y no se tocan sus archivos. Se resuelven al integrar, con un merge normal de la base, cuando cada dueño los corrija.

| Rojo | Origen | Etiqueta | Dueño |
|---|---|---|---|
| sql-tests: `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_…_carrera` (el preflight de `excepcion_al_cierre_vigente(uuid)` no coincide) | Los `.test.sql` y las migraciones de esta rama son idénticos a `main` `ec5786bb8`, salvo la 0503 (comprobado por el Director). El rojo vendría de `main`; no se midió ahí porque `quality.yml` no corre sql-tests | I | SDD-0573 |
| Vitest: `infra/chatwoot/cf-access/verificador.test.mjs` («No test suite found»: usa `node:test`) | E1 (`e93654ce3`). El CI de calidad corre `pnpm test`, así que **rompería `main` al integrar** | R | E1 (SDD-0583) |
| Vitest: `scripts/__tests__/avance-checklist.test.mjs` («arranca en 0 %») | Exige 0 % y el programa ya daba 5,0 % en la base, desde que se aceptó E0 | R | E0 (SDD-0582) |
| e2e: `sin-scroll-horizontal.spec.ts:119` (Shipping Mark → `/registro`) | Flaky por la compilación en frío de `next dev` en el sitio público. Aislado: falla el primer intento y pasa el reintento | R | Sin dueño por ahora (hallazgo) |
| Vitest: timeouts de `PackingListProductsStep`, `supplier-flow` y `NewOperarioDrawer`; e2e colgado 22,6 min | Carga de la máquina (3 workers de Vitest caídos). Aislados pasan 37/37 | R | — |

### Gobernanza del paso 2.2

| Política | Clasificación | Evidencia |
|---|---|---|
| BTN-01 / AVS-01 | cumplimiento | Desvincular pasa por el `ConfirmDialog` canónico con `danger`; los botones son `studio-btn` (`VinculosAdmin.tsx`) |
| CMP-01 | cumplimiento | `EmptyState`, `ActionButton`, `ConfirmDialog` y `ErrorAlert`; ningún consumidor nuevo de un `deprecated`; `components:check` PASÓ |
| AUD-01 | **no conformidad, pendiente** | Crear o borrar un vínculo es una mutación con peso de seguridad (decide como quién entra el SSO) y hoy no deja evento en `entity_audit_log`. Queda para 2.5 (ciclo de vida de los agentes), con su propia migración y OK. **2.5 entregado sin ella:** el número se pidió al Director el 2026-10-30 y sigue pendiente |
| IA-01 | no aplica | La Bandeja no llama a ningún modelo |
| Datos personales | cumplimiento parcial; revisión formal en 2.6 | La tabla guarda solo ids. El correo del usuario se lee con `service_role` solo para compararlo y no se guarda ni se registra. El enlace de SSO (que lleva el correo) no se registra ni pasa por la URL de Studio |

## Paso 2.3 — contador, webhook con push y tarjeta en la ficha

Pedido por el Director el 2026-10-29, con el OK de Sam («ok»). Va en la misma rama. No se registra el webhook en el Chatwoot del VPS ni se toca Meta: eso pide su propio OK. Las pruebas son locales y con payloads sintéticos.

### Diseño

| ID | Decisión |
|---|---|
| E2-D16 | **Webhook** `POST /api/chatwoot/webhook` (`runtime = "nodejs"`):<br>- lee el cuerpo crudo y verifica la firma de Chatwoot 4.19.1: `X-Chatwoot-Signature: sha256=<hex>`, con `HMAC-SHA256(secreto, "<X-Chatwoot-Timestamp>.<cuerpo>")` (`lib/webhooks/trigger.rb`). La comparación es en tiempo constante (`sameSecret`);<br>- **anti-replay:** rechaza un timestamp a más de 5 minutos del reloj;<br>- sin `CHATWOOT_WEBHOOK_SECRET` o `CHATWOOT_TENANT_ID` responde 503; con firma mala, 401; con JSON malo, 400;<br>- un evento ajeno (otra cuenta, otro tipo) recibe 200 `ignored`;<br>- la ruta es delgada: verificar → interpretar → procesar. |
| E2-D17 | **Eventos:** `message_created` y `conversation_status_changed`. `interpretarEvento` es pura y se queda solo con ids, estado, `unread_count`, asignado, bandeja, fechas y los últimos 10 dígitos del teléfono del contacto. **Nunca toma el texto, el nombre ni el teléfono completo.** |
| E2-D18 | **Idempotencia y orden:** la RPC `chatwoot_registrar_evento` (`service_role`, una transacción):<br>- inserta el evento en `chatwoot_webhook_events` con clave semántica: `message_created:<id del mensaje>` y `conversation_status_changed:<conversación>:<estado>:<updated_at>`. Un duplicado no hace nada más;<br>- actualiza `chatwoot_conversations` solo si el evento no es más viejo que lo guardado (`source_updated_at`). |
| E2-D19 | **Cruce con el cliente:** la RPC busca `clients.phone_last10` (no es único) en el tenant, sin borrados. Con **exactamente un** cliente guarda `client_id`; con cero o más de uno, `null`. No adivina. |
| E2-D20 | **Push:** solo en un `message_created` **nuevo**, entrante y no privado, y con el flag `chatwoot_inbox` encendido. Va por el outbox durable (`enqueueUserPush`, deduplica 60 s por `tag`):<br>- destinatario: el usuario vinculado al agente asignado o, sin asignado, a todos los vinculados del tenant;<br>- **cuerpo sin datos personales:** «Tienes un mensaje nuevo en la conversación #N», con la URL `/studio/bandeja?c=N`. |
| E2-D21 | **Contador** en el sidebar (módulo `bandeja`): conversaciones abiertas con `unread_count > 0`. El layout lo calcula en el servidor y se mantiene vivo con Supabase Realtime (`useRealtimeTable`, la tabla entra en la publicación `supabase_realtime`). Ve el total del tenant; la vista por agente es de 2.7. |
| E2-D22 | **Reconciliación** (decisión del Director): al abrir la Bandeja, la server action `reconciliarBandeja` pide con el token **del propio agente vinculado** las primeras 4 páginas de conversaciones (`GET /api/v1/accounts/{id}/conversations?status=all`, orden por actividad) y aplica estado y `unread_count` con la misma RPC. Así corrige lo que el webhook no ve (un agente que lee sin responder no dispara ningún evento). El token del agente se pide por la Platform API, se usa en el servidor y no se guarda. |
| E2-D23 | **Tarjeta en la ficha** (`/studio/clientes/[markbox]`): las 5 conversaciones más recientes con ese `client_id`, con número, estado, no leídos, última actividad y un enlace a `/studio/bandeja?c=N`. Solo con acceso al módulo `bandeja` y el flag encendido. Si el cruce fue ambiguo no hay `client_id`, y la tarjeta no muestra nada. |
| E2-D24 | **Enlace a una conversación:** `?c=N` abre el iframe en `/app/accounts/{id}/conversations/N`. Si hace falta SSO, el enlace lleva `sso_account_id` y `sso_conversation_id`, y Chatwoot redirige solo a esa conversación después del login (`getLoginRedirectURL`). |
| E2-D26 | **Lo que sumó la v3** (Director, 2026-10-30: «terminas las dos piezas de la v3 ahora»):<br>- **Tope de tamaño:** 256 KiB, verificado **antes** de la firma. Se mira `Content-Length` sin leer y, si falta o miente, se corta el flujo al pasar el tope. La ruta responde 413 sin leer, registrar ni tocar la base.<br>- **Reintento propio:** Chatwoot 4.19.1 no reintenta webhooks de cuenta. El evento guarda lo mínimo para reprocesar sin el payload (`message_id`, `avisar`, `assignee_id`; sin texto ni teléfonos). Al fallar espera 1, 2, 4 y 8 min, y al quinto intento queda `descartado`.<br>- **El cron:** `/api/cron/chatwoot-reintentos` (Bearer `CRON_SECRET`, cada 5 min en `vercel.json` y en el crontab del VPS) llama `chatwoot_tomar_pendientes` (`FOR UPDATE SKIP LOCKED`) y vuelve a correr los manejadores.<br>- **El admin** ve los descartados en la Bandeja. E10 reutiliza este camino para la redirección. |
| E2-D25 | **Base para E10:** `procesarEventoChatwoot` registra el evento y después corre una lista de manejadores. Hoy hay uno: el aviso push. E10 (10.2 `clasificar`) agrega el suyo a esa lista sin tocar la ruta ni la firma. |

### Allowlist exacta (paso 2.3)

- **Migración:** `supabase/migrations/0504_chatwoot_eventos.sql`; `supabase/tests/0504_chatwoot_eventos.test.sql`; `lib/studio/__tests__/chatwoot-eventos.migration.test.ts`; `supabase/migrations-baseline.json`; `supabase/pending-migration-symbol-declarations.json`.
- **Lógica:** `lib/studio/chatwoot/{webhook-signature.ts,webhook-events.ts,webhook-procesar.ts,conversations-queries.ts,account-api.ts,platform-api.ts,chatwoot-types.ts,config.ts}`; `lib/studio/chatwoot/__tests__/{webhook-signature.test.ts,webhook-events.test.ts,webhook-procesar.test.ts,account-api.test.ts,webhook-fixtures.ts}`.
- **Ruta:** `app/api/chatwoot/webhook/route.ts`; `app/api/chatwoot/webhook/__tests__/route.test.ts`; `lib/studio/chatwoot/{webhook-body.ts,__tests__/webhook-body.test.ts}` (tope, v3).
- **Reintento propio (v3):** `app/api/cron/chatwoot-reintentos/{route.ts,__tests__/route.test.ts}`; `vercel.json` (cron cada 5 min); `infra/dtd-cargo/cron/crontab` (regenerado con `scripts/build-crontab.mjs`); `scripts/__tests__/build-crontab.test.ts` (19 → 20 crons).
- **Contador:** `app/studio/(app)/layout.tsx`; `app/studio/(app)/_components/StudioSidebar.tsx`; `app/studio/(app)/_components/BandejaBadge.tsx`; `app/studio/(app)/_components/__tests__/BandejaBadge.test.tsx`.
- **Bandeja:** `app/studio/(app)/bandeja/{page.tsx,actions.ts}`; `app/studio/(app)/bandeja/_components/BandejaClient.tsx`; `app/studio/(app)/bandeja/__tests__/{actions.test.ts,BandejaClient.test.tsx}`.
- **Ficha:** `app/studio/(app)/clientes/[markbox]/page.tsx`; `app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx`; `app/studio/(app)/clientes/_components/__tests__/ChatwootConversacionesCard.test.tsx`.
- **Textos:** `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`.
- **Entorno:** `.env.example` e `infra/dtd-cargo/.env.example` (`CHATWOOT_WEBHOOK_SECRET`, `CHATWOOT_TENANT_ID`).
- **Contratos:** `lib/studio/rbac-actions-guard.test.ts` (inventario).
- **Documentos:** `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`; `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.3); `docs/specs/0582-chatwoot-piloto/spec.md` (nota «2.3: no se acepta hasta arreglar la idempotencia», actualizada por pedido del Director); `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`.

### Aceptación del paso 2.3

1. **Firma:** pruebas de firma buena, mala, sin cabeceras, timestamp vencido o del futuro, y cuerpo alterado.
2. **Ruta:** 503 sin configuración, 401 con firma mala (sin tocar la base), 400 con JSON malo, 200 `ignored` con otra cuenta u otro evento, y 200 al procesar.
3. **Interpretación:** el texto, el nombre y el teléfono completo no salen de `interpretarEvento`. Con fixtures sintéticos.
4. **Migración 0504:** contrato en PGlite con control rojo y mutantes. Cubre la idempotencia, el orden (un evento viejo no pisa uno nuevo), el cruce ambiguo (`null`), la RLS (cada tenant ve lo suyo; `chatwoot_webhook_events` cerrada a `authenticated`) y la RPC solo para `service_role`.
5. **Push:** solo en un mensaje entrante, nuevo y no privado, con el flag encendido. El destinatario es el vinculado asignado o todos los vinculados. Sin datos personales en el cuerpo.
6. **Reconciliación:** usa el token del agente vinculado, no lo devuelve al cliente y aplica con la RPC.
7. **Tarjeta y contador:** pruebas del componente y del cálculo.
8. **Cierre:** `pnpm verify`, con turno.
### Validación del paso 2.3 — `pnpm verify` del 2026-10-30 (02:32Z a 03:30Z, punta `250574457`)

Turno dado por el Director. Resultado global: **FALLÓ** (exit 1).
- **Medidos:** 14 pasos.
- **Sin medir:** 3. Docker Desktop estaba apagado, así que sql-tests y schema-rebuild salieron SKIP. migrations-applied no tiene `.env.local`.

| Paso | Resultado | De quién es |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 5 AMARILLO), build | PASÓ | — |
| migrations-applied | NO DISPONIBLE (SKIP): sin `.env.local` | Sin medir |
| sql-tests | NO DISPONIBLE (SKIP): Docker apagado | Sin medir. El contrato de la 0504 PASÓ en PGlite (13/13) |
| schema-rebuild | NO DISPONIBLE (SKIP): Docker apagado | Sin medir |
| test (Vitest) | FALLÓ: 5 | Detalle abajo: **uno propio, ya corregido** |
| e2e | FALLÓ: 2 rojos y 2 flaky | `sin-scroll-horizontal.spec.ts:119` (Shipping Mark → `/registro`) en chromium y mobile-chrome. Es el mismo rojo del 2.2: sitio público, no tocado. Flaky: `auth.spec.ts:49` y `:81`, y `cbm-ayuda.spec.ts:111` |

**Los rojos de Vitest:**
- **Propio, corregido en el commit de esta validación.** `dark-theme-contrast-contract`: `BandejaBadge.tsx` pintaba la tinta invertida sobre `--wine`, que en el tema Oscuro da 2,51. Pasó a `--ink-side-strong`, blanco en los dos temas. Repetido: el contrato y `BandejaBadge.test.tsx` pasan 5/5.
- **Por carga, aislados PASÓ 32/32 en 3 min.** `infra/ops/tests/migraciones.test.mjs` (`prueba-migraciones-produccion.sh`) y `scripts/__tests__/entorno-prueba-scripts.test.mjs` se pasaron de 10 min dentro del verify. Son bash con dobles, sin Docker, y no los toqué.
- **Heredados del 2.2:**
  - `infra/chatwoot/cf-access/verificador.test.mjs` usa `node:test`. Es de E1.
  - `scripts/__tests__/avance-checklist.test.mjs` exige «arranca en 0 %». Es de E0.

**Lo de este paso, medido aparte:** 1029 pruebas puntuales PASÓ antes del verify, y PASÓ también el contrato de contraste repetido.

#### Después del verify (2026-10-30)

**`sql-tests` y `schema-rebuild` con Docker encendido.** Turno del Director. Se corrieron dos veces, antes y después del arreglo de abajo, la última a las 03:58Z:

| Paso | Resultado | De quién es |
|---|---|---|
| sql-tests | FALLÓ: `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_…_carrera` | Heredado de SDD-0573, igual que en el 2.2. **`0503_chatwoot_bandeja` y `0504_chatwoot_eventos` PASÓ** en Postgres real |
| schema-rebuild | PASÓ | 475 migraciones aplicadas desde cero; aislamiento multi-tenant verificado en 219 tablas, con las nuevas |
| migrations-applied | NO DISPONIBLE | Sin `.env.local`; no se copian secretos |

**Hallazgo de la revisión independiente de Codex, comprobado y corregido** (`19df1e51f`):
- **El problema:** el evento se marcaba procesado al registrarlo, antes de las acciones. Si el aviso fallaba, la reentrega se descartaba como duplicado. Hoy eso pierde un push; en E10 dejaría a un cliente sin su redirección.
- **Rojo primero:** 4 casos en Vitest más el contrato SQL, que no tenía `chatwoot_cerrar_evento`.
- **El arreglo:**
  - el evento pasa por `procesando` y termina en `procesado` o `fallido`;
  - uno fallido, o colgado en procesando más de 5 minutos, se reclama;
  - un duplicado real sigue siendo duplicado;
  - `avisarPorPush` falla si no pudo encolar ningún aviso;
  - la ruta responde 500 a un evento fallido.
- **Verde:** el contrato 0504 da 15/15 (33 aserciones y 11 mutantes, 2 de ellos nuevos). Pasan 135 pruebas afectadas y mueren 2 mutantes de TypeScript.
- **Lo que este arreglo no resuelve (evidencia C):** Chatwoot 4.19.1 **no reintenta** los webhooks de cuenta. `Webhooks::Trigger#execute` rescata cualquier error, también un 5xx; solo reintenta agentes bot, y el job corta a los 5 s. Así que un evento fallido espera una reentrega manual o un reproceso de Studio. El reproceso no está en este paso: se propone para E10, que lo necesita. Para eso habría que guardar, sin datos personales, lo mínimo para volver a correr las acciones (ids y asignado).

#### Verify completo de la v3 — 2026-10-30 (04:28Z a 05:28Z, punta `d714834be`, Docker 29.9.1)

Turno del Director, con Docker encendido para que sql-tests y schema-rebuild entraran en la misma corrida. Resultado global: **FALLÓ** (exit 1).
- **Medidos:** 16 de 17 pasos.
- **Sin medir:** migrations-applied.

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

### Datos personales del paso 2.3 (revisar-datos-ve, alcance del cambio)

Estados de la skill: ENCONTRADO, CORRECTO y NO VERIFICABLE.

| Punto | Estado | Evidencia |
|---|---|---|
| **Inventario:** `chatwoot_conversations` | CORRECTO | Guarda ids, estado, conteos, fechas y `client_id`. La finalidad es el contador y la tarjeta. Es metadato de una comunicación con una persona identificable cuando hay `client_id` (0504) |
| **Inventario:** `chatwoot_webhook_events` | CORRECTO | Solo clave, tipo e id de conversación (0504) |
| **Minimización** | CORRECTO | Sin texto, nombre, correo ni teléfono en tablas, logs, respuestas ni push: `webhook-events.ts` (`interpretarEvento`); `route.ts`, que no registra el cuerpo; `webhook-procesar.ts`, con el cuerpo del push sin datos. Lo prueban `webhook-events.test.ts` y `route.test.ts` |
| **Cruce con el cliente** | CORRECTO | Solo con exactamente un cliente vivo del tenant (RPC de 0504, `v_cruces <> 1`). Ambiguo → `null`. El teléfono llega reducido a 10 dígitos y no se persiste |
| **Retención** | **ENCONTRADO** | `chatwoot_webhook_events` y `chatwoot_conversations` no tienen plazo de borrado. El índice `received_at` queda listo para una purga. Plazo y job, a decidir en 2.6 o E3 con Sam |
| **Acceso** | CORRECTO | La RLS por tenant en `chatwoot_conversations`; los eventos, solo `service_role`. La tarjeta y el contador, solo con acceso al módulo `bandeja` y el flag |
| **Token del agente** | CORRECTO | Lo pide el servidor por la Platform API, lo usa y lo descarta (`actions.ts` `reconciliarBandeja`). No llega al cliente (`actions.test.ts`) |
| **Logs del proxy y de Next en el servidor** | NO VERIFICABLE | Que el servidor de Studio no registre el cuerpo de `POST /api/chatwoot/webhook` depende de la configuración de Traefik del VPS (`infra/dtd-cargo`), que no se midió aquí |
| **Tercero** | NO VERIFICABLE | Chatwoot es autohospedado en el mismo VPS (E1) y su inventario de terceros es de E1 |

9. **Puertas que este paso no cruza:**
   - aplicar la 0504;
   - cargar `CHATWOOT_WEBHOOK_SECRET` y `CHATWOOT_TENANT_ID`;
   - registrar el webhook en el Chatwoot del VPS;
   - desplegar.

   Cada una, con su OK nominal de Sam.

## Paso 2.4 — Dashboard App «Ficha DTD»

El Director lo pidió el 2026-10-30, en la misma rama y sin pausar. Tiene que mostrar, al lado de cada conversación de Chatwoot, la ficha del cliente desde Studio con estos datos:
- código;
- segmento: el hueco queda listo para cuando E10 lo exponga;
- envíos activos;
- saldo, **solo para los roles que ya lo ven en Studio**.

**Otras condiciones del pedido:**
- autenticación y firma entre Chatwoot y Studio;
- cero datos personales en los logs;
- «sin ficha» si el teléfono es ambiguo;
- el lugar del 2.8 preparado, sin implementarlo.

**Sin migración:** usa la 0503 (vínculos) y la 0504 (`chatwoot_conversations.client_id`). La Dashboard App **no se registra en el Chatwoot del VPS**: eso pide su propio OK.

### Lo que hace Chatwoot 4.19.1 con una Dashboard App (evidencia C, imagen `chatwoot/chatwoot:v4.19.1-ce`)

- **Cómo la carga.** `app/javascript/dashboard/components/widgets/DashboardApp/Frame.vue` monta un `<iframe :src="url">` sin `sandbox` ni `allow`. La URL es fija, sin plantillas, y la guarda `DashboardApp#content` (`app/models/dashboard_app.rb`, solo `https?://`).
- **Cómo pasa el contexto.** Al cargar, y cuando la app manda `chatwoot-dashboard-app:fetch-info`, Chatwoot envía `postMessage(JSON.stringify({ event: "appContext", data }), "*")`. En `data` van `conversation`, `contact`, `currentAgent: { id, name, email }`, `customAttributes` y `theme` (`light` o `dark`).
- **No hay firma:** el contexto viaja en claro y a cualquier origen (`"*"`), con el nombre, el teléfono y el correo del contacto. Cualquier página que enmarque la app puede mandar un `appContext` falso, así que **el contexto no es una credencial**.

### Diseño

| ID | Decisión |
|---|---|
| E2-D27 | **Ruta propia** `/studio/ficha-chat`, fuera del layout con sidebar: grupo `(panel)`, sin layout propio; la página pone su `LocaleProvider` y el tema lo manda Chatwoot. Es la URL que se registra como Dashboard App: `https://dtdcargo.com/studio/ficha-chat`. |
| E2-D28 | **Quién la puede enmarcar:** una regla de cabeceras solo para esa ruta, con `frame-ancestors <origen del chat>` y sin `X-Frame-Options`. El catch-all la excluye. El resto de la CSP es la estricta del sitio. Nadie más que `chat.dtdcargo.com` puede enmarcarla. |
| E2-D29 | **Autenticación: la sesión de Studio.** La cookie de Supabase es `SameSite=Lax`. Studio (`dtdcargo.com`) y el chat (`chat.dtdcargo.com`) son el mismo sitio, así que la cookie viaja dentro del iframe.<br>- **Sin sesión**, la página muestra «Inicia sesión en Studio», con un enlace que abre en otra pestaña. El proxy deja pasar **solo esta ruta exacta** sin sesión, porque redirigir al login dentro del iframe da un marco en blanco: el login no se deja enmarcar.<br>- **La página no lee datos sin sesión:** la server action repite el candado. |
| E2-D30 | **«Firma» entre Chatwoot y Studio.** Chatwoot no firma el contexto, así que la confianza se arma con cinco amarres y ninguno depende del contexto:<br>1. el `postMessage` se acepta solo si `event.origin` es el del chat y `event.source` es `window.parent`;<br>2. del contexto salen **solo dos enteros**, el id de la conversación y el del agente. El nombre, el teléfono y el correo se descartan en el navegador y nunca llegan al servidor;<br>3. el agente del contexto tiene que ser el **vinculado a la sesión de Studio** (0503). Si no, «Esta sesión de Studio es de otra persona»;<br>4. el servidor pide la conversación a Chatwoot **con el token de ese agente** (Platform API, como en la reconciliación). Si Chatwoot no se la muestra a ese agente (401, 403 o 404), no hay ficha. Así la firma de esa respuesta la pone Chatwoot: decide sus propios permisos de bandeja;<br>5. el cliente sale de `chatwoot_conversations.client_id`, que cruzó la base (0504). **Nunca del teléfono del contexto.** |
| E2-D31 | **Cruce y «sin ficha»:** la respuesta de Chatwoot se aplica con la misma RPC de la reconciliación (`chatwoot_registrar_evento` con clave nula). Así la conversación existe aunque el webhook no haya llegado, y el `client_id` lo decide la regla de E2-D19: exactamente un cliente vivo con ese `phone_last10`. Con cero o más de uno, la página dice «Sin ficha». No ofrece candidatos ni muestra el teléfono. |
| E2-D32 | **Qué muestra y a quién:**<br>- **El candado de la Bandeja:** `moduleViewDenial(supabase, "bandeja")` y el flag `chatwoot_inbox`.<br>- **Sin el módulo `clients`:** «Tu rol no ve fichas de clientes».<br>- **Lo que se lee:** el cliente, con el cliente **de sesión** (la RLS de `clients` repite el candado), y la cuenta con `getClientAccountState`, la misma función de la cabecera de la ficha (SDD-0558).<br>- **El saldo:** solo con `puedeVerSaldoCliente`, el mismo criterio que la 0492. Sin permiso, esa parte no se pinta.<br>- **Lo que se pinta:** código vigente, códigos anteriores, envíos en curso, saldo por moneda (abierto y vencido) y un enlace «Abrir en Studio» a la ficha, en otra pestaña.<br>- **Sin el nombre del cliente:** el agente ya lo ve en Chatwoot. |
| E2-D33 | **Huecos preparados, sin implementar:**<br>- **Segmento:** `segmento: "cliente" \| "lead_registrado" \| null`. Hoy es siempre `null` y no se pinta; E10 lo llena con la regla de SDD-0582 §«Regla de segmentos».<br>- **2.8:** la vista recibe `costoChat` opcional (cantidad, tarifa, fecha y fuente). Hoy no se pasa y no se pinta. |
| E2-D34 | **Logs y errores:**<br>- los logs llevan solo el código del error de Chatwoot o de PostgREST;<br>- nunca un id de cliente, un código, un teléfono, un nombre ni el contexto de Chatwoot;<br>- el cliente recibe códigos de error que traduce con `bandeja.ficha.error.<código>`. |
| E2-D35 | **Tema e idioma:** la página toma el `theme` que manda Chatwoot (`data-theme="dark"`) para combinar con el panel. El idioma sale del perfil del usuario, como en el resto de Studio. |

### Allowlist exacta (paso 2.4)

- **Página:** `app/studio/(panel)/ficha-chat/page.tsx`; `app/studio/(panel)/ficha-chat/_components/{FichaDtdClient.tsx,FichaDtdView.tsx}`; `app/studio/(panel)/ficha-chat/__tests__/{FichaDtdClient.test.tsx,FichaDtdView.test.tsx}`.
- **Acción:** `app/studio/(app)/bandeja/actions.ts` (`pedirFichaDtd`); `app/studio/(app)/bandeja/__tests__/ficha-dtd-action.test.ts`.
- **Lógica:** `lib/studio/chatwoot/{dashboard-app.ts,account-api.ts}`; `lib/studio/chatwoot/__tests__/{dashboard-app.test.ts,account-api.test.ts}`.
- **Cabeceras y proxy:** `next.config.ts`; `lib/runtime/__tests__/next-config.test.ts`; `proxy.ts`; `lib/runtime/__tests__/proxy-ficha-chat.test.ts`.
- **Textos:** `lib/i18n/es-VE/bandeja.ts` y `lib/i18n/zh-CN/bandeja.ts`.
- **Contratos:** `lib/studio/rbac-actions-guard.test.ts` (inventario 448 → 449).
- **Documentos:**
  - `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`;
  - `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.4);
  - `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`;
  - `docs/runbooks/chatwoot-ficha-dtd.md`: cómo se registra la app en Chatwoot. Se escribe, no se ejecuta.

### Aceptación del paso 2.4

1. **Contexto:** un `postMessage` de otro origen o de otra ventana se ignora. Del contexto salen solo los dos ids: una prueba con un contexto sintético completo comprueba que el nombre, el teléfono y el correo no llegan a la acción.
2. **Acción:** pruebas del camino que no tiene que mostrar datos:
   - sin Bandeja, `denied`;
   - sin vínculo, `unlinked`;
   - con otro agente, `otro_agente`;
   - si Chatwoot no muestra la conversación, `sin_acceso`;
   - sin `client_id`, «sin ficha»;
   - sin el módulo `clients`, `sin_clientes`;
   - sin permiso de saldo, no hay dinero en la respuesta.

   Tampoco hay datos personales en los logs.
3. **Cabeceras:** la ruta tiene `frame-ancestors` con el origen del chat y no tiene `X-Frame-Options`, el catch-all no la toca y `/studio/ficha-chats` no hereda la regla.
4. **Proxy:** sin sesión deja pasar solo `/studio/ficha-chat` exacta. Otra ruta de Studio sigue yendo al login.
5. **Vista:** prueba de cada estado y de que el saldo no se pinta sin permiso.
6. **Revisiones:** `/ui-check` y `revisar-datos-ve` del cambio.
7. **Cierre:** pruebas afectadas, `tsc` y `eslint`. El `pnpm verify` completo, con turno del Director.

### Validación del paso 2.4 — 2026-10-30, puntual y sin `pnpm verify`

E10 programa en paralelo, así que el `pnpm verify` completo espera turno del Director.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` y `eslint` sobre lo tocado | PASÓ |
| Vitest afectado y contratos de Studio: `rbac-actions-guard` (449), `rbac-view-guard`, `rbac-subroute-guard`, `studio-api-auth-guard`, `privacidad-cn`, `app/studio/_components/__tests__` (contraste incluido), `signout-bandeja`, `proxy-matcher-contract`, Bandeja, Ficha DTD, `lib/studio/chatwoot`, `lib/runtime/__tests__` y las tarjetas de la ficha | PASÓ: 43 archivos, 1021 pruebas |
| `check-rsc-boundary` y `components:check` | PASÓ |
| **Rojo primero** | Antes de escribir el código fallaron 23 pruebas por falta de `dashboard-app`, `obtenerConversacion` y `pedirFichaDtd`, 2 de cabeceras y 1 del proxy |
| **Mutantes** (13: cada uno quita un amarre) | 13 muertos:<br>- `postMessage` a «*»;<br>- sin chequeo de ventana;<br>- sin chequeo de origen;<br>- sin chequeo de agente;<br>- sin candado de clientes;<br>- saldo sin el criterio compartido;<br>- `sin_acceso` como `service`;<br>- proxy por prefijo;<br>- catch-all sin `$`;<br>- `X-Frame-Options` que se queda;<br>- dinero sin permiso;<br>- una respuesta vieja que pisa;<br>- una conversación con otro id.<br>El del saldo sobrevivió la primera vez: con la regla de hoy es equivalente, porque quien ve clientes ve saldo (decisión 14). Se agregó una prueba que fija que la acción delega en `puedeVerSaldoCliente` |
| `/ui-check` | OK con ajustes menores. Aplicados: la grilla con el mínimo medido de SDD-0558, `minmax(min(260px, 100%), 1fr)`, y el Shipping Mark como `<h1>`. Los enlaces a otra pestaña quedan como en la Bandeja |
| `revisar-datos-ve` | Tabla de abajo: 9 CORRECTO y 2 NO VERIFICABLE |
| `pnpm verify` completo | Corrido con turno del Director sobre `cf755a7a6`. Detalle en la tabla siguiente |
| Prueba en un Chatwoot real | **NO EJECUTADO**. La app se registra después del merge y del despliegue, con OK de Sam; hoy apuntaría a una página que no está en `main`. El procedimiento está en `docs/runbooks/chatwoot-ficha-dtd.md` |

#### Verify completo del 2.4 — 2026-10-30 (06:30Z a 07:27Z, punta `cf755a7a6`, Docker 29.9.1)

Resultado global: **FALLÓ** (exit 1). Midió 16 de 17 pasos; sin medir, migrations-applied.

| Paso | Resultado | De quién es |
|---|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, build | PASÓ | — |
| schema-rebuild | PASÓ: 475 migraciones desde cero; aislamiento multi-tenant en 219 tablas | — |
| pending-migration-symbols | FALLÓ → **corregido** | **Propio.** Al editar `bandeja/actions.ts`, las líneas declaradas se vencieron, y `pedirFichaDtd` sumó un sitio de llamada de `chatwoot_conversations`. Se resincronizaron las líneas y se declaró la degradación del sitio nuevo: sin la 0504 la acción responde «service» antes de leer. Repetido solo: 0 ROJO · 5 AMARILLO |
| sql-tests | FALLÓ: 248 verdes y 3 rojos (`0467_reversion_credito_carrera` y los dos `0497_reverso_al_anular_factura`) | Heredado de SDD-0573, igual que en el 2.2 y el 2.3. **0503 y 0504 PASÓ** |
| test (Vitest) | FALLÓ: 13470 verdes y 2 timeouts de 600 s; al reintento, 13471 y 1 | Por carga: `scripts/__tests__/entorno-prueba-scripts.test.mjs` e `infra/ops/tests/migraciones.test.mjs`, fuera del diff. **Aislados después: PASÓ 32/32** |
| e2e | FALLÓ: 218 verdes, 1 rojo, 1 flaky y 20 saltadas, en las dos vueltas | El rojo es `sin-scroll-horizontal.spec.ts:119` (Shipping Mark), heredado. Flaky: `auth.spec.ts:81` y `calculadora-semantic-colors.spec.ts:53`. **No se colgó:** corrieron todas |
| migrations-applied | NO DISPONIBLE (SKIP): sin `.env.local` | Sin medir |

**Rojo propio:** uno, `pending-migration-symbols`, ya corregido en el commit de esta validación. Lo demás es heredado o por carga.

### Datos personales del paso 2.4 (revisar-datos-ve, alcance del cambio)

Estados de la skill: ENCONTRADO, CORRECTO y NO VERIFICABLE.

| Punto | Estado | Evidencia |
|---|---|---|
| **Inventario** | CORRECTO | No hay tablas, columnas ni almacenamiento nuevos. La ficha lee `chatwoot_conversations` (0504), `clients` y la cuenta (`getClientAccountState`), y no guarda nada propio (`app/studio/(app)/bandeja/actions.ts:224-300`) |
| **Minimización: el contexto de Chatwoot** | CORRECTO | Chatwoot manda el nombre, el teléfono y el correo del contacto (`Frame.vue`, evidencia C). Del contexto salen solo dos enteros y el tema (`lib/studio/chatwoot/dashboard-app.ts:52`), y la acción recibe solo esos dos ids (`FichaDtdClient.tsx:52`). Lo prueban `dashboard-app.test.ts` y `FichaDtdClient.test.tsx` con un contexto sintético completo |
| **Minimización: lo que se pinta** | CORRECTO | Código, códigos anteriores, envíos y cuenta. Sin nombre, teléfono ni documento (`FichaDtdView.tsx`); el agente ya ve el contacto en Chatwoot |
| **Cruce con el cliente** | CORRECTO | El `client_id` sale de la base (`actions.ts:270`), con la regla de exactamente un cliente vivo de la 0504. Con un cruce ambiguo se ve «Sin ficha», sin candidatos (`actions.ts:275`) |
| **Acceso** | CORRECTO | Cinco candados:<br>- el módulo `bandeja` y el flag (`actions.ts:226`);<br>- el agente vinculado a la sesión (`actions.ts:243`);<br>- el módulo `clients` (`actions.ts:244`);<br>- el permiso de Chatwoot sobre la conversación (`account-api.ts`, `obtenerConversacion`);<br>- la RLS de `clients` con el cliente de sesión (`actions.ts:277`).<br>El saldo sigue el criterio de la ficha (`actions.ts:290`), y la vista no pinta dinero sin permiso (`FichaDtdView.tsx:139`) |
| **Quién la enmarca** | CORRECTO | `frame-ancestors` solo del chat y sin `X-Frame-Options` (`next.config.ts:328`). El proxy deja pasar sin sesión solo la ruta exacta (`proxy.ts:131`), y sin sesión no se lee nada |
| **Logs** | CORRECTO | `[ficha-dtd]` registra solo el código de Chatwoot o de PostgREST (`actions.ts:250`, `:256` y `:264`). Lo prueba `ficha-dtd-action.test.ts` («los logs no llevan ids de cliente, códigos ni teléfonos») |
| **Token del agente** | CORRECTO | Lo pide el servidor, lo usa y lo descarta; no llega al navegador (`actions.ts:248-254`) |
| **Logs compartidos de la cuenta** | NO VERIFICABLE | `getClientAccountState` (`lib/studio/client-queries.ts:801`, SDD-0558) registra `e.message` de PostgREST cuando falla el conteo. El contenido de ese mensaje no se midió aquí. Es código existente de la ficha y no se tocó |
| **Otras Dashboard Apps en Chatwoot** | NO VERIFICABLE | Chatwoot manda el mismo contexto, con datos del contacto, a **toda** Dashboard App registrada (`postMessage` con `"*"`). Que no haya otras depende de la configuración del Chatwoot del VPS, que no se revisó |
| **Retención** | CORRECTO | El paso no persiste nada nuevo. La retención de `chatwoot_conversations` sigue ENCONTRADA desde el 2.3, a decidir en 2.6 o E3 |

## Paso 2.5 — ciclo de vida de los agentes: Usuarios, cron y salud

Lo pidió el Director el 2026-10-30, en la misma rama y sin pausar. El pedido incluye lo que se encontró ese día en el VPS:
- el superadmin no pertenece a ninguna cuenta;
- el único admin de la cuenta 1 era la cuenta de servicio `servicio-chatwoot@dtdcargo.com`, hasta que se creó `vzla@dtdcargo.com` (usuario 3, administrator);
- la salud tiene que alertar si la cuenta queda sin ningún admin humano.

**Sin migración.** AUD-01 (auditar el vínculo) sí necesita una, y el número ya se le pidió al Director: queda **pendiente**. Nada se ejecutó contra el Chatwoot del VPS.

### Lo que permite la Platform API de 4.19.1 (evidencia C, imagen `chatwoot/chatwoot:v4.19.1-ce`)

- **Rutas** (`config/routes.rb`, namespace `:platform`):
  - `users`: `create`, `show`, `update`, `destroy`, más `login` y `token`;
  - `accounts/{id}/account_users`: `index`, `create` y un `destroy` de colección con `user_id`.
- **Quién la puede usar:** la cuenta 1 la creó la Platform App (E1), así que es permisible. Por eso las tres de `account_users` sirven para **cualquier** usuario de la cuenta (`account_users_controller.rb`: `validate_platform_app_permissible` sobre la cuenta). `GET users/{id}` solo sirve para usuarios que creó o adoptó la app: `vzla@` no lo es, así que su correo no se puede leer.
- **Qué devuelve `account_users#index`:** los `AccountUser`, con `user_id` y `role` (`agent` o `administrator`) y sin correos.
- **Cómo crea usuarios** (`users#create`): adopta un usuario existente por correo (`User.from_email`) y salta la confirmación. La clave pasa por `password_has_required_content` (devise-secure_password): mayúscula, minúscula, número y signo.
- **No hay revocación de sesiones** (E2-D13). Sacar a alguien de la cuenta le corta el acceso a **esa** cuenta: Chatwoot autoriza cada pedido contra `Current.account`.

### Diseño

| ID | Decisión |
|---|---|
| E2-D36 | **Alta desde Studio** (`altaAgente`, solo admin, en Bandeja › Vínculos). Recibe un miembro activo del tenant del admin cuyo rol, con los overrides de ese tenant, ve la Bandeja. Los pasos:<br>1. crea o adopta su usuario de Chatwoot con el nombre y el correo de Studio y una clave aleatoria de 32 caracteres que nadie usa (entra por SSO) y no se guarda;<br>2. lo mete en la cuenta como `agent`;<br>3. guarda el vínculo.<br>El rol `administrator` en Chatwoot es de la matriz (2.7). |
| E2-D37 | **Candados del alta:**<br>- **Sin la 0503:** si la lectura de vínculos falla, responde «service» **antes** de tocar Chatwoot. Crear el agente y no poder guardar el vínculo lo dejaría en la cuenta sin dueño.<br>- **Agente de otra persona:** si el usuario adoptado ya está vinculado a otra persona, responde «duplicate» sin meterlo en la cuenta. |
| E2-D38 | **Baja** (`sincronizarAgentes`). Un vínculo sobra si su usuario de Studio está desactivado, ya no es del tenant o perdió la Bandeja (rol u override). Los pasos:<br>1. se saca al agente de la cuenta (`DELETE account_users`);<br>2. si eso salió bien, o si ya no estaba en la cuenta, se borra el vínculo.<br>El usuario de Chatwoot **no se borra**: sus conversaciones conservan a quién estuvieron asignadas. |
| E2-D39 | **Lo que nunca sale de la cuenta** (`bloqueoDeBaja`):<br>- el usuario de servicio (`CHATWOOT_SERVICE_USER_ID`);<br>- el **último admin humano**: el vínculo queda y la salud avisa «baja bloqueada». Sin el id de servicio, se cuenta a todos los demás admins, que es lo conservador.<br>**Si Chatwoot no responde no hay baja:** sin la lista de la cuenta no se puede comprobar el candado, y borrar solo el vínculo dejaría al agente adentro sin que nada lo vuelva a mirar. |
| E2-D40 | **Desde Usuarios, al momento:** `disableUserAction` y `changeUserRoleAction` llaman a `sincronizarAgenteDeUsuario` **después** de confirmar, solo para ese usuario y en el tenant de Chatwoot (`CHATWOOT_TENANT_ID`). Nunca lanza ni cambia el resultado de Usuarios. |
| E2-D41 | **Cron diario** `/api/cron/chatwoot-agentes`, a las 12:30 UTC (08:30 en Caracas), en `vercel.json` y en el crontab del VPS:<br>- con Bearer `CRON_SECRET`, sincroniza a todos los vínculos y es la red para lo que Usuarios no vio (un override, un fallo de Chatwoot en ese momento);<br>- sin configuración, sin tenant o sin la 0503, responde 200 `omitido`;<br>- la respuesta lleva solo conteos y códigos de alerta. |
| E2-D42 | **Salud** (`evaluarSalud`). La calcula el cron y la página de la Bandeja para el admin, con estas alertas:<br>- `chatwoot_no_responde`;<br>- `sin_admin_humano`: ningún `administrator` de la cuenta además del de servicio, que es el caso del VPS antes de `vzla@`;<br>- `servicio_sin_configurar`: falta `CHATWOOT_SERVICE_USER_ID` y no se pueden contar humanos;<br>- `vinculo_fuera_de_cuenta`: el SSO entraría a una cuenta vacía;<br>- `baja_bloqueada`.<br>El superadmin no cuenta porque no es `AccountUser`. |
| E2-D43 | **Aviso:** con alertas, el cron manda un push a cada admin activo del tenant (`tag: chatwoot-salud`). El cuerpo dice solo qué revisar, sin nombres, correos ni ids de Studio. |

### Allowlist exacta (paso 2.5)

- **Platform API y configuración:** `lib/studio/chatwoot/{platform-api.ts,config.ts}`; `lib/studio/chatwoot/__tests__/platform-agentes.test.ts`.
- **Reglas y ciclo:** `lib/studio/chatwoot/{agentes-salud.ts,agentes-ciclo.ts,agentes-usuario.ts}`; `lib/studio/chatwoot/__tests__/{agentes-salud.test.ts,agentes-ciclo.test.ts,agentes-usuario.test.ts}`.
- **Cron:** `app/api/cron/chatwoot-agentes/{route.ts,__tests__/route.test.ts}`; `vercel.json`; `infra/dtd-cargo/cron/crontab` (regenerado, 22); `scripts/__tests__/build-crontab.test.ts` (20 → 21).
- **Bandeja:** `app/studio/(app)/bandeja/{actions.ts,page.tsx}`; `app/studio/(app)/bandeja/_components/{VinculosAdmin.tsx,BandejaClient.tsx}`; `app/studio/(app)/bandeja/__tests__/{alta-agente.test.ts,VinculosAdmin.test.tsx,BandejaClient.test.tsx}`.
- **Usuarios:** `app/studio/(app)/usuarios/actions.ts`, solo las dos llamadas después de confirmar; `app/studio/(app)/usuarios/__tests__/baja-chatwoot.test.ts`.
- **Textos:** `lib/i18n/{es-VE,zh-CN}/bandeja.ts`.
- **Entorno:** `.env.example` e `infra/dtd-cargo/.env.example` (`CHATWOOT_SERVICE_USER_ID`).
- **Contratos:**
  - `lib/studio/rbac-actions-guard.test.ts` (inventario 449 → 450);
  - `supabase/pending-migration-symbol-declarations.json`: sitios nuevos de `chatwoot_agent_links` y su degradación sin la 0503.
- **Documentos:**
  - `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`;
  - `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.5);
  - `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`;
  - `docs/runbooks/chatwoot-agentes.md`.

### Aceptación del paso 2.5

1. **Platform API:** forma de las cuatro llamadas, una clave con los cuatro tipos aunque el azar salga en ceros, solo el id en la respuesta y ningún fallo que lance.
2. **Reglas:**
   - el servicio nunca se saca;
   - el último admin humano nunca se saca, aunque el de servicio siga siendo admin;
   - el caso del VPS da `sin_admin_humano`.
3. **Ciclo:**
   - se da de baja al desactivado, al que salió del tenant y al que perdió la Bandeja por override;
   - el override de otro tenant no cuenta;
   - si Chatwoot no responde, no hay baja;
   - si sacarlo falla, el vínculo queda;
   - solo se borra el vínculo del tenant y del usuario;
   - el push va a los admins activos, sin datos personales.
4. **Alta:** casos de denied, invalid, not_member, `sin_bandeja`, duplicate (también el agente de otra persona) y «service» sin la 0503 sin crear nada. Los logs no llevan el correo.
5. **Usuarios:** solo después de confirmar; un fallo de Chatwoot no cambia el resultado.
6. **Cron:** 403 sin secreto, `omitido` sin configuración o sin la 0503, conteos y alertas.
7. **Cierre:** pruebas afectadas, tsc, eslint y mutantes. El `pnpm verify` completo, con turno del Director después de E10 y E6.

### Validación del paso 2.5 — 2026-10-30, puntual

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` y `eslint` sobre lo tocado | PASÓ |
| Vitest afectado: Bandeja, Usuarios, Ficha DTD, `lib/studio/chatwoot`, cron, `rbac-actions-guard` (450), `rbac-view-guard`, `build-crontab`, `app/studio/_components/__tests__`, `lib/runtime/__tests__` y `proxy-matcher-contract` | PASÓ: 51 archivos, 1021 pruebas |
| `scripts/__tests__/entorno-prueba-scripts.test.mjs`, que lee `infra/dtd-cargo/.env.example` | PASÓ: 2/2, en 180 s |
| `pending-migration-symbols` | PASÓ: 0 ROJO · 5 AMARILLO |
| `build-crontab --check` y `check-rsc-boundary` | PASÓ: 22 crons |
| **Rojo primero** | Las pruebas de Usuarios fallaron 2/4 antes de los ganchos |
| **Rojos propios hallados en el camino, ya corregidos** | Dos:<br>- `BandejaClient.test.tsx` mockeaba `../actions` sin `altaAgente`, y además había dos selects con «Luis»; ahora la consulta se acota al formulario de vincular;<br>- sin la 0503, `altaAgente` habría creado el agente antes de fallar al guardar el vínculo (E2-D37) |
| **Mutantes** (17) | 17 muertos. «Clave sin signo» sobrevivió primero porque el resto de la clave trae un signo por azar; se agregó la prueba con el azar en ceros |
| `/ui-check` (inline) | OK. Tokens del sistema, el texto de las alertas además del color y el patrón de formulario de Vínculos |
| `pnpm verify` completo | **NO EJECUTADO**: va después de E10 y E6, con turno del Director |
| AUD-01 (auditoría del vínculo) | **PENDIENTE**: necesita una migración, y el número se pidió al Director el 2026-10-30 |

**Nota sobre la validación del 2.4:** Vitest toma el filtro de ruta como expresión regular, y `(app)` es un grupo. La cuenta de «43 archivos» del 2.4 pudo dejar archivos afuera. La cobertura completa la dio el `pnpm verify` sobre `cf755a7a6`, que corrió las 13473 pruebas. Desde el 2.5 el filtro va sin paréntesis (`bandeja/__tests__`).

### Datos personales del paso 2.5 (revisar-datos-ve, alcance del cambio)

Estados de la skill: ENCONTRADO, CORRECTO y NO VERIFICABLE.

| Punto | Estado | Evidencia |
|---|---|---|
| **Comunicación a un tercero** | CORRECTO | El alta manda a Chatwoot el nombre y el correo del **empleado** de Studio (`app/studio/(app)/bandeja/actions.ts:261`). Chatwoot está autohospedado en el mismo VPS (E1) y la finalidad es que la persona atienda. Solo pasa cuando el admin lo decide (`:211`) y la persona ve la Bandeja (`:238`) |
| **Clave** | CORRECTO | Aleatoria, sin registro ni respuesta (`lib/studio/chatwoot/platform-api.ts:202` y `:224`); el agente entra por SSO |
| **Logs** | CORRECTO | `[bandeja]` y `[chatwoot-agentes]` llevan solo códigos (`actions.ts:263` y `:278`; `agentes-ciclo.ts:87`, `:126` y `:139`). Lo prueba `alta-agente.test.ts` («los logs no llevan el correo») |
| **Aviso push** | CORRECTO | El cuerpo dice qué revisar, sin nombres, correos ni ids (`agentes-ciclo.ts:173`) |
| **Retención en Chatwoot tras la baja** | **ENCONTRADO** | La baja saca al agente de la cuenta pero **no borra** su usuario de Chatwoot (nombre y correo), a propósito: sus conversaciones conservan la asignación (E2-D38, `agentes-ciclo.ts:124`). Hace falta un plazo para borrarlo (`DELETE platform/api/v1/users/{id}`); se decide en 2.6 o 2.7 con Sam |
| **Acceso tras la baja** | CORRECTO, con un límite | Sale de la cuenta (`agentes-ciclo.ts:124`) y Chatwoot le corta el acceso a ella. La sesión del panel no se revoca (E2-D13), pero ya no ve la cuenta |
| **Admin humano** | CORRECTO | `bloqueoDeBaja` nunca saca al último (`agentes-salud.ts:69`) y la salud alerta (`:92`) |
| **Usuarios de la cuenta creados fuera de Studio** (como `vzla@`) | NO VERIFICABLE | La Platform API no deja leer su correo, porque no son permisibles para la app. Studio solo ve su id y su rol |

## Paso 2.6 — revisar-datos-ve, `/ui-check`, QA de navegadores, caídas del webhook y runbook

Lo pidió el Director el 2026-10-30, solo con pruebas puntuales: E10 y E6.2 tienen los turnos de verify. Incluye la actualización de `/privacidad` que mandó E6.2 (SDD-0587 §14.3, punto 7), **sin desplegar**.

### Revisión de datos personales de toda E2 (revisar-datos-ve)

Consolida las revisiones del 2.2, 2.3, 2.4 y 2.5 y suma lo de este paso. Estados de la skill: ENCONTRADO, CORRECTO y NO VERIFICABLE.

| # | Punto | Estado | Evidencia y arreglo |
|---|---|---|---|
| 1 | **Inventario** | CORRECTO | Tres tablas y una cookie:<br>- `chatwoot_agent_links`: usuario de Studio, id del agente y quién lo creó (0503);<br>- `chatwoot_conversations`: ids, estado, conteos, fechas y `client_id` (0504);<br>- `chatwoot_webhook_events`: clave, tipo, ids y lo mínimo para reintentar (0504);<br>- cookie `dtd_cw_sso`: solo el uuid del usuario de Studio.<br>La Ficha DTD no guarda nada. El alta manda a Chatwoot el nombre y el correo del empleado (`actions.ts`, `altaAgente`) |
| 2 | **Minimización** | CORRECTO | Nada guarda texto de mensajes, nombres ni teléfonos completos:<br>- `interpretarEvento` toma solo ids y los últimos 10 dígitos, sin guardarlos;<br>- la Ficha toma del contexto de Chatwoot solo dos enteros (`dashboard-app.ts:52`);<br>- los avisos push no llevan datos personales. |
| 3 | **Consentimiento** | No aplica a E2 | E2 no recoge datos del público. El aviso a quien escribe por WhatsApp es el punto 7 |
| 4 | **Derechos** | NO VERIFICABLE | Hay dos caminos para el titular:<br>- **Studio:** el `client_id` de `chatwoot_conversations` se suelta solo al purgar el cliente (`on delete set null`);<br>- **Chatwoot:** la conversación completa vive allá.<br>No hay un camino de Studio para pedir que se borre la conversación en Chatwoot. Es del mapa de borrado (NV-3 de SDD-0586) |
| 5 | **Borrado y retención** | **ENCONTRADO** (2) | **(a)** `chatwoot_webhook_events` y `chatwoot_conversations` no tienen plazo. **Propuesta para Sam:** borrar los eventos `procesado` y `descartado` a los 90 días, y las conversaciones sin actividad a los 12 meses, dentro de la purga del cron `chatwoot-reintentos` (patrón de E10). **(b)** El usuario de Chatwoot de un agente dado de baja no se borra (2.5). **Propuesta:** borrarlo a los 12 meses de la baja, con `DELETE platform/api/v1/users/{id}`. Las dos van a 2.7 o E3, con el OK de Sam |
| 6 | **Trazabilidad** | **ENCONTRADO** | Crear o borrar un vínculo y las altas y bajas no dejan evento en `entity_audit_log` (AUD-01). **Arreglo:** un trigger en `chatwoot_agent_links`. Necesita migración; el número se pidió al Director el 2026-10-30 |
| 7 | **Política pública** | CORRECTO **en la rama**, falta el OK | `/privacidad` (`app/privacidad/page.tsx`) suma el lead de WhatsApp, el BSUID con su año, la respuesta automática con sus 30 días, el lead perdido anonimizado a los 12 meses y a Meta como tercero. Lo fija `app/__tests__/privacidad-chat.test.ts`. **No se publica** sin el OK de Sam al texto y sin la 0505 y la 0506 en producción: el merge a `main` despliega solo |
| 8 | **Terceros** | CORRECTO / NO VERIFICABLE | **CORRECTO:** Chatwoot es autohospedado y Meta transporta los mensajes; los dos están nombrados en `/privacidad`. **NO VERIFICABLE:** que toda Dashboard App de Chatwoot recibe el contexto con datos del contacto (`Frame.vue`, `postMessage` con `"*"`) y que no haya otras registradas depende de la configuración del VPS |
| 9 | **Transferencia internacional** | NO VERIFICABLE | `/privacidad` dice que los datos se alojan en Estados Unidos. Desde SDD-0505 la base vive en el VPS de Contabo, y desde E1, Chatwoot también. La ubicación del VPS no se comprobó aquí; si no es Estados Unidos, el punto 5 de `/privacidad` hay que corregirlo, y eso es aparte del 2.6 |
| 10 | **Decisiones automatizadas** | CORRECTO | E2 no decide nada sobre personas. El cruce con el cliente es determinista y, ante ambigüedad, no adivina (0504) |
| 11 | **Valor probatorio** | No aplica | E2 no recoge aceptaciones |
| 12 | **Titulares que no son usuarios** | CORRECTO | El contacto de WhatsApp sin ficha no deja datos en E2: sin cruce no hay `client_id`, y la Ficha dice «Sin ficha» |

**Pendientes para Sam** (por el Director):
- plazos 5a y 5b;
- número de migración para AUD-01;
- OK al texto de `/privacidad`;
- ubicación del VPS para el punto 9.

### `/ui-check` de la Bandeja y la Ficha

| Prioridad | Hallazgo | Estado |
|---|---|---|
| media ⭐ | `BandejaBadge.tsx:22`: el `aria-label` («N sin leer») estaba fijo en español | **Corregido:** pasa por i18n (`bandeja.badge.aria`) |
| baja | `BandejaClient.tsx:146`: `calc(100dvh - 180px)` usa un desplazamiento que no está medido | Anotado; se mide en 2.7 con la Bandeja real |
| — | Ficha DTD: ancho medido de las tarjetas y `<h1>` (2.4) | Ya aplicado |

Lo que está bien:
- tokens del sistema y escala `--s-*`;
- el padding del badge igual al del sidebar (`StudioSidebar.tsx:376`);
- estados de carga, vacío, error y sin sesión;
- tuteo y «Shipping Mark»;
- las alertas de salud llevan texto, no solo color.

### QA de navegadores

| Navegador | Qué | Resultado |
|---|---|---|
| Chrome y Edge | iframe, SSO y micrófono de la Bandeja (PoC 2.1) | PASÓ (2.1, E2-R1 a R5) |
| WebKit | iframe y SSO de la Bandeja (PoC 2.1) | PASÓ; micrófono NO DISPONIBLE (2.1) |
| Chromium, mobile-chrome y mobile-safari | Ficha DTD sin sesión: no redirige, avisa, ofrece Studio en otra pestaña; `frame-ancestors` del chat y sin `X-Frame-Options`; desde otro origen el navegador la bloquea | **NO EJECUTADO todavía:** `e2e/ficha-chat.spec.ts` corre en el próximo `pnpm verify`, con turno |
| Firefox | Todo | **NO DISPONIBLE**: no está instalado y descargarlo pide OK (2.1) |
| Bandeja y Ficha con sesión real | SSO, Dashboard App y contexto real de Chatwoot | **NO EJECUTADO**: pide el despliegue y el registro en el Chatwoot del VPS (puertas del 2.4) |

### Pruebas de caída del webhook

`lib/studio/chatwoot/__tests__/caida-webhook.scenario.test.ts` corre las funciones reales de TypeScript contra la **0504 real en PGlite**. El doble solo traduce `admin.rpc` a SQL. Escenarios:
1. **Falla el aviso:** el evento queda «fallido», el cron no lo toma antes de la espera, al vencer lo reintenta y queda «procesado», y una reentrega es «duplicado».
2. **Cinco fallos seguidos:** queda «descartado» y el cron ya no lo toma.
3. **Webhook perdido** (alguien lee sin responder): la reconciliación corrige el contador, un dato más viejo no lo pisa y no deja eventos.

Resultado: 3/3 PASÓ. Murieron los 4 mutantes:
- en TypeScript, un fallo que cuenta como éxito;
- en SQL, tomar antes de la espera;
- en SQL, el tope de intentos;
- en SQL, el orden en la reconciliación.

### Runbook

`docs/runbooks/chatwoot-bandeja.md`: cómo se enciende (7 puertas en orden), una tabla de diagnóstico, cómo se recupera de una caída y cómo se apaga. Lo acompañan `chatwoot-ficha-dtd.md` (2.4) y `chatwoot-agentes.md` (2.5).

### Allowlist exacta (paso 2.6)

- **Política:** `app/privacidad/page.tsx`; `app/__tests__/privacidad-chat.test.ts`; `app/__tests__/faq-seguimiento-coherente.test.tsx`, solo la fecha de la política.
- **Pruebas:** `lib/studio/chatwoot/__tests__/caida-webhook.scenario.test.ts`; `e2e/ficha-chat.spec.ts`.
- **UI:** `app/studio/(app)/_components/BandejaBadge.tsx`; `lib/i18n/{es-VE,zh-CN}/bandeja.ts`.
- **Documentos:**
  - `docs/runbooks/chatwoot-bandeja.md`;
  - `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`;
  - `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.6);
  - `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`.

### Validación del paso 2.6 — 2026-10-30, puntual

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | PASÓ |
| Escenario de caída (PGlite) | PASÓ: 3/3, con 4/4 mutantes muertos |
| `/privacidad`: `privacidad-chat` y `faq-seguimiento-coherente` | PASÓ: 14/14. La fecha fijada pasó de «13 de octubre» a «30 de octubre de 2026» a propósito |
| Badge y contraste | PASÓ: 5/5 |
| e2e de la Ficha | NO EJECUTADO; entra en el próximo verify |
| `pnpm verify` completo | NO EJECUTADO; con turno, después de E10 y E6.2 |

## Propuesta para el paso 2.7 — matriz real de permisos (para que Sam la apruebe; **no implementada**)

### Lo que hay hoy en el Chatwoot del VPS (hallazgos del 2026-10-30)

- **El superadmin** (`/super_admin`, detrás de Cloudflare Access) **no es de ninguna cuenta**: administra la instalación, no atiende.
- **La cuenta 1 «DTD Cargo»** tiene dos administradores:
  - el usuario de servicio `servicio-chatwoot@dtdcargo.com`, que usa la Platform App de Studio;
  - `vzla@dtdcargo.com` (usuario 3), creado el 2026-10-30, el **único admin humano**.
- **`vzla@` no lo creó Studio:** la Platform API no deja leer su correo, solo su id y su rol.

### Cómo decide Chatwoot CE 4.19.1 (evidencia C, imagen `chatwoot/chatwoot:v4.19.1-ce`)

| Qué | Regla en 4.19.1 |
|---|---|
| **Roles de cuenta** | `agent` y `administrator` (`account_user.rb`, `enum role`). Los roles personalizados (`custom_role_id`) son de Enterprise: en CE no hay |
| **Ver una conversación** | Un admin, siempre. Un agente, si es de una **bandeja suya** (`inbox_access?`) **o de un equipo suyo** (`team_access?`) (`conversation_policy.rb`, `show?`) |
| **Listar conversaciones** | Las de las bandejas asignadas al agente (`conversation_finder.rb`, `assigned_inboxes`), filtradas por `PermissionFilterService` |
| **Contactos** | Todos los de la cuenta para cualquier agente. Varias acciones exigen `administrator` (`contact_policy.rb:11`, `:15` y `:51`). Cuáles son exactamente: **NO VERIFICABLE** con lo leído |
| **API** | Cada usuario tiene su `access_token` con sus mismos permisos. Studio lo usa en el servidor para la reconciliación y la Ficha; un agente lo puede ver en su perfil de Chatwoot |
| **Acceso directo** | `chat.dtdcargo.com` acepta usuario y clave. Los agentes que crea Studio tienen una clave aleatoria, pero con el SMTP de E1 pueden pedir «olvidé mi clave» y entrar **sin pasar por Studio** |

### Propuesta de matriz

| Rol de Studio | ¿Bandeja? | Rol en Chatwoot | Bandejas de Chatwoot | Equipo | Notas |
|---|---|---|---|---|---|
| `admin` (Sam) | Sí | `administrator` | Todas | Todos | Al menos uno siempre. La salud del 2.5 avisa si falta |
| `commercial` | Sí | `agent` | Leads (número de leads, E10) | «Comercial» | Ve los contactos de la cuenta (regla de CE) |
| `support` | Sí | `agent` | Clientes (número de clientes, E10) | «Atención» | Igual |
| `operations`, `accounting`, `warehouse` y `marketing` | No (salvo override) | Sin cuenta | — | — | Un override que les dé la Bandeja los da de alta como `agent` sin bandejas, hasta que el admin las asigne |
| Usuario de servicio | — | `administrator` | — | — | Nunca se toca; no cuenta como humano |
| Superadmin | — | Fuera de la cuenta | — | — | Solo instalación. Se entra por Cloudflare Access |

### Decisiones que pide la matriz (Sam)

1. **¿Se aprueba la matriz de arriba?** Incluye qué rol de Studio va a qué bandeja y qué equipo.
2. **Acceso directo:** ¿se cierra? La opción recomendada es **cerrarlo**: Studio pone una clave nueva y aleatoria en cada alta, y se apaga el «olvidé mi clave» para quien no es admin. Si no se puede apagar en CE, se documenta como riesgo aceptado.
3. **El token de API del agente:** ¿se rota al dar de baja? Que lo rote la Platform API (`POST users/{id}/token`) queda **por comprobar**: en 4.19.1 esa ruta devuelve el token actual y no está claro que genere uno nuevo.
4. **Sincronización:** ¿Studio manda en el rol y las bandejas, y pisa los cambios hechos a mano en Chatwoot? La opción recomendada es **sí**, en el cron diario, y nunca sobre el usuario de servicio ni el último admin humano.
5. **Revocación del SSO:** la sesión del panel no se puede revocar por API en 4.19.1 (E2-D13). ¿Se acepta que la baja corte el acceso a la cuenta y no la sesión?

**Hasta el OK de Sam no se implementa nada del 2.7.**

## Fuera de alcance del paso 2.1

- Cualquier cambio en Studio (`next.config.ts`, rutas, `lib/`): es de 2.2.
- El VPS, el Chatwoot de producción, Traefik y Cloudflare: la PoC no los toca y E2-D4 no pide cambios.
- Usuarios reales: la PoC usa una agente sintética en un Chatwoot local.

## Allowlist exacta (paso 2.1)

- `infra/chatwoot/pruebas/iframe-poc/{levantar.sh,frente.mjs,matriz.mjs,sembrar-poc.rb,compose.traefik-poc.yml}`
- `docs/specs/0585-chatwoot-bandeja-studio-e2/{spec.md,poc-iframe-2026-10-29.md}`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.1)
- `docs/specs/README.md` (índice regenerado)
- `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`

Los pasos 2.2 a 2.7 agregan aquí sus archivos antes de tocarlos.

## Aceptación del paso 2.1

1. `bash infra/chatwoot/pruebas/iframe-poc/levantar.sh` levanta el Chatwoot local con `FORCE_SSL=true`, sin `X-Frame-Options` y con `frame-ancestors` acotado.
2. `node matriz.mjs <poc.json> chrome edge webkit firefox` da PASÓ en I1–I3, S1–S3, M1–M3 y S5 para Chrome y Edge. Los controles bloquean lo que tienen que bloquear. Lo que no se puede correr queda NO DISPONIBLE con el motivo.
3. La decisión sí o no y las cabeceras de Studio y de Traefik quedan escritas (E2-D1 a E2-D6).
4. La fila 2.1 queda `entregado`. Pasa a `aceptado` con el OK de Sam o del Director.

## Puertas

| Puerta | Qué cubre | Paso |
|---|---|---|
| Despliegue de Studio | La CSP y la `Permissions-Policy` nuevas en producción (merge a `main` = despliegue en el VPS) | 2.2 |
| Usuarios de prueba en el Chatwoot de producción | Crear o usar una agente de prueba en `chat.dtdcargo.com` para el QA de 2.6 | 2.6 |
| Migración | Capa persistente de 2.2 | 2.2 |
| Matriz de permisos | Roles, bandejas y equipos reales | 2.7 |

Esta entrega no pasa por ninguna puerta: todo es local.

## Validación

| Comprobación | Resultado |
|---|---|
| `matriz.mjs` (chrome, edge, webkit, firefox), 2026-10-29T19:35Z | PASÓ en Chrome y Edge: 11 de 11 más los controles. WebKit: iframe y SSO en PASÓ, micrófono NO DISPONIBLE. Firefox: NO DISPONIBLE |
| `pnpm docs:check`, `pnpm sdd:check` | ver el handoff |
| `pnpm verify` | NO EJECUTADO: el cambio no toca el producto (scripts de prueba locales y documentos) |

## Seguimiento

- **2026-10-29:** reserva (`sdd:next --reserve`), PoC 2.1 y decisión «sí, iframe».
