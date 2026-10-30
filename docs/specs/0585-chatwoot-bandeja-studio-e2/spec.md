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
| 2.1 | PoC con banco reproducible, matriz y decisión | **esta entrega** |
| 2.2 | CSP y `Permissions-Policy` de la ruta (E2-D2), módulo, RBAC, flag, i18n, vínculos, `lib/studio/chatwoot`, SSO (E2-D5), capa persistente, página y `signOut` | pendiente |
| 2.3 | Contador, webhook con push y tarjeta en la ficha | pendiente |
| 2.4 | Dashboard App «Ficha DTD» | pendiente |
| 2.5 | Ciclo de vida de los agentes: Usuarios, cron y salud | pendiente |
| 2.6 | revisar-datos-ve, `/ui-check`, QA de navegadores (incluye Firefox y Safari reales) y runbook | pendiente |
| 2.7 | Usuarios y permisos: matriz real de CE, sincronización, pruebas por usuario y revocación del SSO | pendiente |

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
| AUD-01 | **no conformidad, pendiente** | Crear o borrar un vínculo es una mutación con peso de seguridad (decide como quién entra el SSO) y hoy no deja evento en `entity_audit_log`. Queda para 2.5 (ciclo de vida de los agentes), con su propia migración y OK |
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
| E2-D25 | **Base para E10:** `procesarEventoChatwoot` registra el evento y después corre una lista de manejadores. Hoy hay uno: el aviso push. E10 (10.2 `clasificar`) agrega el suyo a esa lista sin tocar la ruta ni la firma. |

### Allowlist exacta (paso 2.3)

- **Migración:** `supabase/migrations/0504_chatwoot_eventos.sql`; `supabase/tests/0504_chatwoot_eventos.test.sql`; `lib/studio/__tests__/chatwoot-eventos.migration.test.ts`; `supabase/migrations-baseline.json`; `supabase/pending-migration-symbol-declarations.json`.
- **Lógica:** `lib/studio/chatwoot/{webhook-signature.ts,webhook-events.ts,webhook-procesar.ts,conversations-queries.ts,account-api.ts,platform-api.ts,chatwoot-types.ts,config.ts}`; `lib/studio/chatwoot/__tests__/{webhook-signature.test.ts,webhook-events.test.ts,webhook-procesar.test.ts,account-api.test.ts,webhook-fixtures.ts}`.
- **Ruta:** `app/api/chatwoot/webhook/route.ts`; `app/api/chatwoot/webhook/__tests__/route.test.ts`.
- **Contador:** `app/studio/(app)/layout.tsx`; `app/studio/(app)/_components/StudioSidebar.tsx`; `app/studio/(app)/_components/BandejaBadge.tsx`; `app/studio/(app)/_components/__tests__/BandejaBadge.test.tsx`.
- **Bandeja:** `app/studio/(app)/bandeja/{page.tsx,actions.ts}`; `app/studio/(app)/bandeja/_components/BandejaClient.tsx`; `app/studio/(app)/bandeja/__tests__/{actions.test.ts,BandejaClient.test.tsx}`.
- **Ficha:** `app/studio/(app)/clientes/[markbox]/page.tsx`; `app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx`; `app/studio/(app)/clientes/_components/__tests__/ChatwootConversacionesCard.test.tsx`.
- **Textos:** `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts`.
- **Entorno:** `.env.example` e `infra/dtd-cargo/.env.example` (`CHATWOOT_WEBHOOK_SECRET`, `CHATWOOT_TENANT_ID`).
- **Contratos:** `lib/studio/rbac-actions-guard.test.ts` (inventario).
- **Documentos:** `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`; `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.3); `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`.

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
