---
sdd: "0655"
title: "La Bandeja pasa a ser una pestaña de CRM"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-17
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0585", "0647", "0589", "0614", "0622"]
confidencialidad: interno
---

# SDD-0655 — La Bandeja pasa a ser una pestaña de CRM

> Enmienda de la **SDD-0585** (dónde vive la Bandeja y sus vínculos) y de la **SDD-0647** (la barra del
> CRM). Toda la comunicación queda en un solo lugar: CRM. La Bandeja deja el menú lateral, aparece como
> pestaña junto a Embudos, y «Agentes vinculados» se muda a Usuarios. No hay migración.

**Estado:** `in-progress`. Número asignado por el Director General el 2026-11-17.

## 0. La decisión de Sam, literal

En el chat del Director General: **«A: pestaña en CRM»**. El encargo la traduce así:

1. La Bandeja (el Chatwoot embebido de la SDD-0585) pasa a ser una pestaña dentro de CRM.
2. Sale del menú lateral.
3. «Agentes vinculados» se muda a Usuarios o a Ajustes, con un texto que diga qué hace.

Es función nueva: no entra en el reporte de la reunión del 2026-11-17. Que a Sam el iframe le salga roto
(probablemente por abrir Studio desde un host distinto de `dtdcargo.com`) **no** es parte de esta spec.

## 1. Lo que había (medido en el código, base `955c23059`)

- `lib/studio/modules.ts`: el módulo `bandeja` (slug `/studio/bandeja`) y el módulo `kommo` (rótulo «CRM»,
  slug `/studio/crm`) eran dos ítems del menú.
- Permisos (`lib/studio/rbac.ts`): `bandeja` para `commercial` y `support`; `kommo` solo para `commercial`.
  Admin ve todo. La Bandeja además depende del flag `chatwoot_inbox` (`feature-flags-types.ts`).
  **`support` ve la Bandeja y no ve CRM.**
- `next.config.ts`: la CSP con `frame-src https://chat.dtdcargo.com` y el micrófono delegado se aplican solo
  a `/studio/bandeja/:path*`; el catch-all estricto excluye esa ruta.
- Enlaces a `/studio/bandeja`, buscados por valor: la tarjeta de la ficha del cliente
  (`ChatwootConversacionesCard.tsx`, `?c=N`), el hilo de Conversaciones (`ConversationThread.tsx`, `?c=N`),
  los avisos push (`webhook-procesar.ts` con `?c=N`, `portal.ts` y `agentes-ciclo.ts`), la guía
  (`recorridos.ts`) y los `revalidatePath` de `bandeja/actions.ts`. Ninguna e2e navega a `/studio/bandeja`.
- `BandejaBadge` colgaba del ítem «Bandeja» del menú (`StudioSidebar.tsx`).
- «Agentes vinculados» (`chatwoot_agent_links`, con la salud de la cuenta y el alta de agentes) se pintaba
  debajo del marco de la Bandeja, solo para admin. Sus acciones: `vincularAgente`, `desvincularAgente` y
  `altaAgente` en `bandeja/actions.ts`, todas con `tenantAdminGate`.

## 2. Decisiones

**D1 · La ruta se queda en `/studio/bandeja`; CRM la muestra como pestaña.** Es la opción más segura:

- La CSP con `frame-src` del chat y el micrófono siguen en la ruta exacta que ya se probó en producción.
  Moverlas a `/studio/crm/...` obligaba a tocar el catch-all y su exclusión; abrirlas en `/studio/crm` sería
  relajar la CSP de Embudos. No se toca `next.config.ts`.
- Los `?c=N` ya entregados (avisos push en teléfonos, enlaces copiados) siguen llegando directo. Un
  redirect añadiría un salto antes del SSO de un solo uso, sin ganancia.
- Así no hace falta redirigir ni reescribir ningún enlace: todos caen en la pestaña Bandeja.

**D2 · La barra del CRM es una sola, en las dos rutas.** `/studio/crm` y `/studio/bandeja` pintan la misma
cabecera («Comercial · CRM.») y la misma barra (`CrmPestanas`, clase `.studio-tabs`). Cambian la pestaña
activa y la bajada. La Bandeja deja de repetir su propio título.

**D3 · Cada pestaña conserva su permiso** (`lib/studio/crm-acceso.ts`, `accesoCrm`):
Embudos = módulo `kommo`; Bandeja = módulo `bandeja` + flag `chatwoot_inbox`. Respeta los desvíos por rol
(SDD-0252) y los accesos extra por persona (SDD-0622). Quien ve CRM y no la Bandeja no ve la pestaña. El
candado real sigue en cada layout (`requireModuleView("kommo")`; rol + flag en `bandeja/layout.tsx`).

**D4 · El ítem «CRM» del menú reúne las dos pestañas.** Se ve si se ve alguna; lleva a Embudos, o a la
Bandeja si es la única que se ve; queda activo en las dos rutas (con `aria-current="page"`). Sin esto,
`support` perdería su único acceso a la Bandeja al quitarla del menú. **No cambia ningún permiso**:
`support` sigue sin poder abrir `/studio/crm`. El módulo `bandeja` lleva `dentroDe: "kommo"`: sale del menú
pero sigue en la matriz de permisos, en el mapa de accesos de Usuarios, en el flag y en el guard. No se usa
`hidden` (como Legal), porque también lo saca del mapa de accesos (`MapaAcceso.tsx`).

**D5 · El contador** (`BandejaBadge`) pasa al ítem «CRM» y solo se pinta si quien mira ve la Bandeja.

**D6 · «Agentes vinculados» va a Usuarios, pestaña «Bandeja»** (`/studio/usuarios?tab=bandeja`), no a
Ajustes: Usuarios es solo admin (como antes el panel), ya trae la ficha de cada persona y la guía ya
llamaba a su ancla `usuarios.acceso-bandeja`. La pestaña solo aparece con el flag encendido y la Bandeja
conectada; la lectura (que llama a la Platform API de Chatwoot, timeout 10 s) solo corre con
`?tab=bandeja`, así abrir Usuarios no espera al chat. Mismas acciones (`bandeja/actions.ts`, sin cambios de lógica; ahora también revalidan
`/studio/usuarios`), misma lectura (`cargarAgentesBandeja`, mudada de `bandeja/page.tsx`). Texto nuevo
arriba: «Vincula tu usuario del Studio con tu agente de Chatwoot para abrir la Bandeja con tu sesión.» Al
admin, la Bandeja le deja el enlace «Agentes vinculados». Los eventos descartados y la ida del portal se
quedan en la Bandeja.

**D7 · Guía (SDD-0589).** El paso U1 («Dar acceso a la Bandeja») apuntaba al ancla de Vínculos dentro del
recorrido de la Bandeja. Como el ancla se mudó, U1 sale de ese recorrido y queda como paso suelto
(`PASO_ACCESO_BANDEJA`), igual que U3. Sus textos aprobados no cambian. **Queda registrado: U1 no tiene
recorrido** — hoy ningún recorrido de la guía lo muestra, ni al admin. Un recorrido de Usuarios que abra la
pestaña Bandeja es trabajo aparte (SDD-0589).

## 3. Aceptación

1. El menú no tiene ítem «Bandeja». «CRM» lleva a `/studio/crm` (o a `/studio/bandeja` a quien solo ve la
   Bandeja), queda activo en las dos rutas y lleva el contador si se ve la Bandeja.
2. En `/studio/crm`, quien ve la Bandeja tiene las pestañas «Embudos» y «Bandeja»; quien no, solo Embudos.
3. En `/studio/bandeja`, la barra muestra Bandeja activa, y Embudos solo a quien ve `kommo`.
4. `/studio/crm` no tiene `frame-src` ni micrófono; `/studio/bandeja` conserva los suyos; ningún redirect
   toca `/studio/bandeja`; todos los enlaces existentes caen en la pestaña Bandeja.
5. «Agentes vinculados» está en Usuarios › Bandeja, con su texto, las mismas acciones y la misma salud; la
   Bandeja ya no lo pinta.
6. La guía no busca el ancla U1 en la Bandeja.

## 4. Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/crm-acceso.ts` | nuevo: permisos de cada pestaña, destino y estado activo de «CRM» |
| `lib/studio/crm-acceso-server.ts` | nuevo: lee rol y flags en servidor |
| `lib/studio/__tests__/crm-acceso.test.ts` | nuevo: permisos, barra, menú y enlaces existentes |
| `lib/studio/modules.ts` | campo `dentroDe`; `bandeja` lleva `dentroDe: "kommo"` |
| `app/studio/(app)/_components/StudioSidebar.tsx` | ítem «CRM» con las dos pestañas, contador y `aria-current` |
| `app/studio/(app)/_components/__tests__/StudioSidebar-crm.test.tsx` | nuevo |
| `app/studio/(app)/crm/_components/CrmPestanas.tsx` | nuevo: cabecera y barra compartidas |
| `app/studio/(app)/crm/_components/kommo-tabs.shared.ts` | `pestanasCrm` |
| `app/studio/(app)/crm/_components/KommoClient.tsx` | usa la cabecera y la barra compartidas |
| `app/studio/(app)/crm/page.tsx` | pasa si se ve la Bandeja |
| `app/studio/(app)/crm/__tests__/kommo-oculto.test.tsx` | doble del acceso; casos de la pestaña |
| `app/studio/(app)/bandeja/page.tsx` | cabecera y barra del CRM; sin la lectura de vínculos |
| `app/studio/(app)/bandeja/_components/BandejaClient.tsx` | sin título propio ni vínculos; enlace a Usuarios |
| `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx` | casos de vínculos → enlace |
| `app/studio/(app)/bandeja/actions.ts` | también revalida `/studio/usuarios` |
| `app/studio/(app)/bandeja/_components/VinculosAdmin.tsx` → `app/studio/(app)/usuarios/_components/AgentesBandeja.tsx` | mudado y renombrado, con el texto nuevo |
| `app/studio/(app)/bandeja/__tests__/VinculosAdmin.test.tsx` → `app/studio/(app)/usuarios/__tests__/AgentesBandeja.test.tsx` | mudado; suma los casos que estaban en `BandejaClient.test.tsx` |
| `lib/studio/chatwoot/agentes-bandeja-admin.ts` | nuevo: la lectura de vínculos, miembros y salud, mudada |
| `app/studio/(app)/usuarios/page.tsx` | carga los vínculos si la Bandeja está encendida |
| `app/studio/(app)/usuarios/_components/UsersClient.tsx` | pestaña «Bandeja» |
| `lib/i18n/es-VE/bandeja.ts`, `lib/i18n/zh-CN/bandeja.ts` | `bandeja.links.what` y `bandeja.links.manage` |
| `lib/studio/guia/recorridos.ts` | U1 sale del recorrido de la Bandeja (`PASO_ACCESO_BANDEJA`) |
| `lib/studio/guia/__tests__/anclas.test.ts`, `guia.test.ts`, `puente.test.ts` | siguen el ancla mudada |
| `lib/runtime/__tests__/next-config.test.ts` | CSP de `/studio/crm` y ningún redirect en `/studio/bandeja` |
| `app/studio/_components/__tests__/claridad-t5d-contract.test.ts` | la barra del CRM se cuenta en `CrmPestanas.tsx` (sus 2 mutantes también); `TOTAL_PESTANAS` sigue en 3 |
| `lib/i18n/es-VE/guide.ts` | solo el comentario de U1 (los textos aprobados no cambian) |
| `docs/specs/0655-bandeja-en-crm/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0655-bandeja-en-crm.md` | handoff |

Sin migraciones, sin variables nuevas, sin tocar `next.config.ts`, el borde, Cloudflare ni la
configuración de Chatwoot.

## 5. Datos personales

El panel mudado muestra los mismos datos que antes (nombre del usuario de Studio e id de su agente), al
mismo público (admin del tenant) y con la misma lectura. No se captura, mueve ni borra ningún dato nuevo.
`revisar-datos-ve`: **no aplica**, porque solo cambia la pantalla donde se pinta.

## 6. Gobernanza

| Política | Clasificación |
|---|---|
| A11Y-01 (pestañas, teclado) | cumplimiento: `role="tablist"`/`tab` + `aria-selected`, como la barra existente; el menú suma `aria-current` |
| VIS-01 §3 (selección en tinta) | cumplimiento: `.studio-tabs` canónica |
| BTN-01 | cumplimiento: acciones del panel sin cambios; el enlace a Usuarios es `studio-btn-ghost` |
| CMP-01 | cumplimiento: sin componente canónico nuevo; `CrmPestanas` es local del módulo |
