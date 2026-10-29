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
