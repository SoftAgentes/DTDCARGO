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
- **Migración:** `supabase/migrations/0503_chatwoot_bandeja.sql`; `supabase/tests/0503_chatwoot_bandeja.test.sql`; `lib/studio/__tests__/chatwoot-bandeja.migration.test.ts`; `supabase/migrations-baseline.json` (la 0503 declarada pendiente).
- **Documentos:** `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`; `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 2.2); `docs/architecture/module-sdd-map.md`; `.agents/handoffs/0585-chatwoot-bandeja-studio-e2.md`.

### Aceptación del paso 2.2

1. **Cabeceras:** `next-config.test.ts`, con el matcher de rutas de Next, prueba que `/studio/bandeja` y sus sub-rutas reciben **una sola** CSP (con `frame-src` del chat) y **una sola** `Permissions-Policy` (con el micrófono delegado al chat). Prueba también que el resto de `/studio` sigue con `microphone=()` y sin `frame-src`.
2. **Platform API:** sus pruebas cubren éxito, 401/404/5xx, red caída, sin configuración y un enlace de SSO de otro origen (rechazado).
3. **Vínculo:** la acción rechaza a quien no es admin, un usuario de otro tenant y un correo distinto. Sin vínculo no hay SSO. Las pruebas usan dobles que aplican los filtros.
4. **Migración:** el contrato en PGlite pasa, con el control rojo sin la migración. Cubre RLS (cada uno ve lo suyo; el admin, su tenant; nadie, otro tenant), unicidad y la fila del flag en tenants existentes y nuevos.
5. **Registro:** `rbac.test.ts`, `rbac-view-guard`, `rbac-actions-guard`, `feature-flags-catalog` e i18n (typecheck) en verde.
6. **Cierre:** `pnpm verify` PASÓ, coordinado con la sesión del programa (una corrida pesada a la vez).
7. **Puertas que esta entrega no cruza:** aplicar la 0503 en producción (OK nominal de Sam, runbook), cargar el token y las variables en el servidor de Studio, y desplegar.

### Gobernanza del paso 2.2

| Política | Clasificación | Evidencia |
|---|---|---|
| BTN-01 / AVS-01 | cumplimiento | Desvincular pasa por el `ConfirmDialog` canónico con `danger`; los botones son `studio-btn` (`VinculosAdmin.tsx`) |
| CMP-01 | cumplimiento | `EmptyState`, `ActionButton`, `ConfirmDialog` y `ErrorAlert`; ningún consumidor nuevo de un `deprecated`; `components:check` PASÓ |
| AUD-01 | **no conformidad, pendiente** | Crear o borrar un vínculo es una mutación con peso de seguridad (decide como quién entra el SSO) y hoy no deja evento en `entity_audit_log`. Queda para 2.5 (ciclo de vida de los agentes), con su propia migración y OK |
| IA-01 | no aplica | La Bandeja no llama a ningún modelo |
| Datos personales | cumplimiento parcial; revisión formal en 2.6 | La tabla guarda solo ids. El correo del usuario se lee con `service_role` solo para compararlo y no se guarda ni se registra. El enlace de SSO (que lleva el correo) no se registra ni pasa por la URL de Studio |

## Fuera de alcance de esta entrega

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
