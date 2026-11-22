---
sdd: "0707"
title: "El nombre «Conversaciones» pasa a «Soporte» en todo el sistema"
status: proposed
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-22
updated: 2026-11-22
revision: "v0.2 (cambios pedidos por Dir_DTD en la #774)"
supersedes: null
superseded_by: null
related: ["0056", "0147", "0585", "0626", "0655", "0702", "0705"]
confidencialidad: interno
---

# SDD-0707 — «Conversaciones» pasa a «Soporte» en todo el sistema

> Decisión de Sam (2026-11-22), relayada por el Director Ofi_Hermes, textual: «Correcto, va a ser soporte en vez de
> conversación. Hay que cambiarlo y decirle al director general que haga ese cambio general, y también a Chatwoot:
> hay un cambio total de conversaciones a soporte».
>
> **Estado: propuesta, solo spec.** No lleva código, ni migración, ni cambios en Chatwoot. Las decisiones que faltan
> están en §9 (D-1 a D-6), con opciones A/B y una recomendada. Repo público: sin llaves, correos, IP ni montos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no verificado.
Base: `main` `8c15a4bb0` (v0.2; la v0.1 se midió sobre `33ef3ad82`; los conteos no cambiaron). Conteos hechos con `git grep -il "conversaci"` (insensible a mayúsculas y tildes parciales).

## 1. Qué existe hoy

| Hecho | Ev. |
|---|---|
| El Portal del cliente ya dice «Soporte»: ruta `/portal/soporte`, y `/portal/mensajes` redirige a ella | C `app/portal/(app)/mensajes/page.tsx:10` |
| El Studio tiene **dos** superficies con el nombre viejo, y no son la misma cosa (ver §1.1) | C |
| El módulo `conversaciones` (SDD-0056) está en el menú COMERCIAL con la etiqueta «Conversaciones» y la ruta `/studio/conversaciones` | C `lib/studio/modules.ts:131` |
| La Bandeja de Chatwoot (`/studio/bandeja`, SDD-0585) es otra pestaña, dentro de CRM (SDD-0655); se llama «Bandeja» | C `lib/studio/modules.ts:136` |
| La ficha del cliente muestra la columna `aside` con `aria-label="Conversaciones"` y las tarjetas «Conversaciones en la Bandeja» (`ChatwootConversacionesCard`) y el panel de la SDD-0650 F2 (`ConversacionesFichaCard`) | C `app/studio/(app)/clientes/[markbox]/page.tsx:628` · `lib/i18n/es-VE/bandeja.ts:84` |
| En Chatwoot de producción hay una bandeja llamada «Conversaciones del portal» (canal API, SDD-0519) y el `cargar.sh` la cruza **por ese nombre** | D `docs/runbooks/chatwoot-portal-p4-puertas.md:54` |
| El rol «Soporte» ya existe en el Studio (`support`): es una **persona**, no una pantalla | C `lib/studio/user-types.ts:273` |
| Ya hubo un cambio de nombre con redirección permanente: `/studio/admin/oficina` → `/studio/admin/oficina-virtual` (SDD-0626, PR #720) | C `next.config.ts:677-680` |

### 1.1 El nombre viejo cubre dos cosas distintas

1. **Módulo «Conversaciones» (SDD-0056):** bandeja interna del ERP con las tablas `conversations`/`messages`, el correo
   entrante de Resend, el hilo del Portal y el resumen mensual (SDD-0149). Es lo que el Portal muestra como «Soporte».
2. **Bandeja de Chatwoot:** la atención diaria por WhatsApp, Instagram, Messenger y correo. En el Studio se llama
   «Bandeja»; dentro de Chatwoot, «conversación» es el nombre del objeto.

Sam dijo «conversaciones» → «Soporte». El primero es el que hoy se llama «Conversaciones» en el menú. El segundo
se llama «Bandeja» y aparece como «conversaciones» solo dentro de textos (tarjeta de la ficha, guías, avisos).
**La decisión D-1 aclara si «Bandeja» también pasa a «Soporte»** (no se asume).

## 2. Inventario

Conteo de archivos con «conversaci» (sin `docs/specs` ni `.agents/handoffs`, que son históricos y no se tocan):
`lib/studio` 146 · `app/studio` 84 · `infra/chatwoot` 33 · `infra/ops` 31 · `supabase/tests` 26 ·
`docs/marketing` 26 · `docs/design` 27 · `docs/runbooks` 23 · `app/api` 11 · `docs/audits` 12 · `docs/organizacion` 11 ·
`supabase/migrations` 37 · el resto con 1 a 7. La mayoría es **código** (ver B) y no se toca.

| Clase | Qué incluye | Recomendación |
|---|---|---|
| **A · Texto visible** | Etiqueta del menú (`modules.ts:131`), `metadata.title` de la página (`conversaciones/page.tsx:23`), `ConversationsIndicator` (`label = "Conversaciones"`), `aria-label` de la columna de la ficha, tarjetas de la ficha, `lib/i18n/es-VE/bandeja.ts` (≈22 claves) y `guide.ts` (guías «Conversaciones en la ficha del cliente»), vacíos y errores, `lib/portal/simple/bloques.ts:51` («Ver mis conversaciones en la Vista Pro»), la entrada del asistente en `asistente/contenido/catalogo.ts:78` (dice «Bandeja de atención: conversaciones con clientes…»: «Bandeja» depende de D-1), y en la pantalla de rutas de alerta `lib/studio/telegram/alert-routing.ts:53` (rótulo «Conversaciones del portal») y `:66` (ayuda «Un cliente escribió por el chat del portal») | **Cambiar** (fase 1) |
| **A′ · Visible pero atado a un nombre externo** | `lib/i18n/es-VE/bandeja.ts:266` (`bandeja.portal.help`, nombra la bandeja «Conversaciones del portal» de Chatwoot) · `lib/studio/discord/channels.ts:40` (canal `#conversaciones-portal`, nombre de un canal real de Discord) | **No en la fase 1.** Cambian solo junto con el nombre externo: el primero con la fase 3 de Chatwoot, el segundo con el renombre del canal en Discord (D-5 y OK) |
| **B · Ruta** | `/studio/conversaciones` (+ `?c=<id>`), `/api/studio/conversaciones/[id]`, `/api/conversaciones/email` | Pantalla: **cambiar** con 308. API: ver §3.3 |
| **C · Nombre de código** | Carpeta `app/studio/(app)/conversaciones/` (§3.1), comentarios de código que nombran el módulo (`conversation-inbound-notify.ts:3`, `app/portal/(app)/soporte/page.tsx:40,87,161`, `app/portal/(app)/mensajes/actions.ts:11`: se dejan, porque nombran la SDD-0056 y no se ven), `lib/studio/conversaciones/`, componentes `Conversacion*`, tipos y funciones, el id de módulo `"conversaciones"` (RBAC), la categoría de alerta `conversaciones` (Telegram/Discord), `DISCORD_WEBHOOK_CONVERSACIONES`, tablas `conversations`/`messages`, la migración `0106_conversaciones.sql`, `data-guia="cliente.conversaciones"`, clases CSS `studio-ficha-conversaciones` | **No cambiar** (D-5) |
| **D · Documentación** | `docs/runbooks` (23), `docs/marketing` (26), `docs/design` (24), `docs/organizacion` (11), `docs/audits` (12, fechados), `docs/specs/0056-conversaciones` (se conserva el nombre de la carpeta) | Runbooks y marketing **vigentes**: actualizar el nombre visible en la fase 1. Auditorías, handoffs y specs: **no**, son evidencia fechada |
| **E · Objeto técnico de Chatwoot** | «conversación» en `lib/studio/chatwoot/*`, `account-api.ts`, `router-api.ts`, `infra/chatwoot/correo/*.rb`, plantillas `.liquid` de avisos de Chatwoot, `chatwoot_conversations` | **No cambia** (§5). Las plantillas `.liquid` son texto que ven los agentes: ver §4 |
| **F · Texto de contenido** | «Ver conversación» de `lib/studio/bug-email-notify.ts:485` (es el hilo de un bug en `/studio/mis-bugs`, no el módulo) · `lib/news/cerebro.ts` («Pregunta / Conversación», un tipo de contenido de marketing), `scripts/bot-conocimiento.mjs`, guías públicas (`comprar-en-alibaba`, `guia-peso`) | **No cambia**: es el sentido de la palabra en español, no el módulo |

> Regla para quien ejecute: una frase como «tu conversación con el cliente» o «conversaciones por cerrar» de la Oficina
> es lenguaje corriente. Se cambia **el nombre de la pantalla o del módulo**, no cada aparición del sustantivo (D-3).

## 3. Rutas

### 3.1 Cambio
La URL `/studio/conversaciones` pasa a `/studio/soporte`. **La carpeta `app/studio/(app)/conversaciones/` no se mueve**
(D-5, clase C). En `lib/studio/modules.ts:131` cambian solo `label` («Soporte») y `slug` (`/studio/soporte`); el
`id: "conversaciones"` queda. La URL nueva se sirve con un *rewrite* hacia la carpeta de siempre:

```
rewrites: { source: "/studio/soporte",        destination: "/studio/conversaciones" },
          { source: "/studio/soporte/:path*", destination: "/studio/conversaciones/:path*" },
```

Ojo con el precedente: con kommo → crm **sí se movió la carpeta** (hoy existe `app/studio/(app)/crm/` y no `kommo/`).
Aquí no se copia eso; se copia solo la redirección.

**Qué se mide en la fase 1 antes de dar por buena esta vía (NV hoy):**
- que la redirección de §3.2 y el *rewrite* no entren en bucle (Next aplica `redirects` sobre la URL que llega y el
  *rewrite* es interno, así que no debería, pero se prueba con `curl -I` en local y en `next-config.test.ts`);
- que los `revalidatePath("/studio/conversaciones")` de `conversaciones/actions.ts` (5) sigan invalidando la página
  servida en `/studio/soporte`; si no, pasan a invalidar las dos rutas;
- que el ítem del menú quede marcado como activo (compara la URL del navegador con `slug`).

**Alternativa (si la medición falla): mover la carpeta.** Entonces se rompen y hay que actualizar en el mismo PR:
`app/studio/_components/__tests__/color-accion-fase2-g8-contract.test.ts:24,143` ·
`drawer-derived-state-contract.test.ts:10` · `fechas-contract.test.ts:155` · `state-reconciliation-contract.test.ts:12` ·
`claridad-t5d-contract.test.ts:65,67,207-219,351-369` · `lib/studio/__tests__/crm-acceso.test.ts:113` ·
`infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs:23-32` · `docs/governance/components/date-field.json:69,95` y
`docs/governance/generated/component-registry.json:394,420` (regenerado y con `pnpm governance:check`). Las líneas se
vencen: se vuelven a medir al ejecutar.

### 3.2 Redirección permanente (precedente)
Igual que la SDD-0626 (`next.config.ts:677-680`, PR #720): redirección `permanent: true` (308) desde la vieja, con
subrutas y query string, para no romper marcadores ni avisos ya enviados:

```
{ source: "/studio/conversaciones",         destination: "/studio/soporte",         permanent: true },
{ source: "/studio/conversaciones/:path*",  destination: "/studio/soporte/:path*",  permanent: true },
```

Next conserva `?c=<id>`. `proxy.ts` está verificado: no menciona `conversaciones` ni la Bandeja (solo protege `/studio/**` con sesión) y **no cambia**. Prueba obligatoria: la de `lib/runtime/__tests__/next-config.test.ts` (el patrón de las
redirecciones existentes), y quitar `/studio/conversaciones` de la lista de rutas «no Bandeja» de las líneas 193 y
siguientes, o cambiarla a `/studio/soporte`.

### 3.3 Qué apunta a la ruta vieja (hay que cambiarlo a la nueva)
Archivos de producto con `studio/conversaciones` (medido sobre `8c15a4bb0`). Cambian a la URL nueva los enlaces: `ConversationsIndicator.tsx:42` (`href`),
`ConversacionesClient.tsx`, `ConversationList.tsx`, `ConversationThread.tsx`, `GenerateDigestsPanel.tsx`,
`SaldoPendienteContexto.tsx`, `conversaciones/actions.ts` (5 `revalidatePath("/studio/conversaciones")`, **si no se
cambian el caché no se invalida y la pantalla queda vieja**), `layout.tsx` del Studio, `lib/studio/conversation-inbound-notify.ts:107`
(el enlace del aviso por Discord/Telegram/correo, `?c=…`), y las pruebas que comparan la URL `route-auth.test.ts`, `avisos-discord-minimo.test.ts:195`,
`crm-acceso.test.ts:90`. Los `import` de `@/lib/studio/conversaciones/*` y las rutas de archivo en pruebas de contrato **no cambian**, porque la carpeta queda. Los comentarios de `monthly-digest.ts` y `digest-extract.ts` tampoco.
- **Avisos ya enviados** (Discord, Telegram, correo) con la ruta vieja siguen sirviendo por la redirección: es la razón
  del 308 y no hay que reenviar nada.
- **APIs** `/api/studio/conversaciones/[id]` y `/api/conversaciones/email`: **no cambian** en esta spec. La segunda es
  la dirección que Resend Inbound tiene configurada (`docs/runbooks/setup-resend-inbound.md:61`); moverla exige tocar
  la configuración externa y no se ve en pantalla. Decisión D-5.
- El enlace del bot de Telegram y de las alertas usa `SITE_URL` + la ruta: el cambio es el mismo literal.
- Antes de ejecutar: `git grep -n "conversaciones"` por **valor** (no solo por carpeta) sobre `app lib scripts infra e2e`,
  y comprobar que no queda `href`/`router.push`/`redirect` a la ruta vieja fuera de `next.config.ts` y de sus pruebas.

## 4. Chatwoot (solo se describe; no se ejecuta aquí)

**Todo lo que toque Chatwoot de producción es otra fase, con OK nominal de Sam.** Esta spec no cambia nada allí.
Alcance a decidir con Sam, de menor a mayor riesgo:

| Qué | Dónde está | Visible para | Riesgo |
|---|---|---|---|
| Bandeja «**Conversaciones del portal**» (canal API, cuenta 1) | Chatwoot; `CHATWOOT_INBOX_PORTAL_ID`; `cargar.sh` y `ensayo-portal.sh` la cruzan **por nombre** | el equipo | **Alto si se renombra a ciegas**: el cruce por nombre falla y el portal puede dejar de enrutar. Renombrar exige cambiar primero el cruce a ID, o cambiar nombre y script en el mismo paso |
| Flag «Conversaciones del portal en Chatwoot» (Studio → Admin → Feature flags) | Studio, texto | admin | Bajo; es etiqueta de Studio (fase 1) |
| Ayuda `bandeja.portal.help` (`bandeja.ts:266`) | Studio, texto | admin | Cambia **en el mismo paso** que el nombre de la bandeja; si no, el texto nombra una bandeja que no existe |
| Canal de Discord `#conversaciones-portal` (`discord/channels.ts:40`) | Discord | el equipo | Bajo, pero es externo: renombrar el canal en Discord y el texto juntos, con OK (D-5) |
| Nombres de otras bandejas, equipos y **etiquetas** (labels) | Chatwoot | el equipo; las etiquetas no las ve el cliente | **NV**: no hay inventario en el repo; hay que listarlo por la API en lectura, con OK |
| Plantillas de aviso a agentes (`infra/chatwoot/correo/views/.../*.liquid`, `generar-avisos.sh`): «Conversación nueva», «Te asignaron una conversación», «Abrir conversación» | repo + Chatwoot servidor | el equipo, por correo | Medio: el texto está en el repo y se regenera; aplicar es subir plantillas al servidor |
| Interfaz de Chatwoot («Conversations» en su menú, «Conversaciones» en la traducción) | Chatwoot del proveedor | el equipo | Se deja: es la traducción del producto. Cambiarla es forkear el idioma (D-4) |
| Textos que ve el **cliente** (saludo, mensaje de fuera de horario, encuesta, plantillas de WhatsApp en Meta) | Chatwoot/Meta | el cliente | **NV**. Las plantillas de Meta necesitan nueva aprobación; hoy no se sabe si alguna dice «conversación». Se mide en lectura |

Lecturas previas: `docs/runbooks/oficina-cable.md` (§ de la bandeja de la Oficina y «Conversaciones por cerrar»),
`chatwoot-bandeja.md`, `chatwoot-portal-encendido.md`, `chatwoot-portal-p4-puertas.md` y `chatwoot-agentes.md`.
La bandeja de la Oficina **no** se renombra aquí: sus guiones los lleva Ofi_Hermes.

## 5. Lo que NO cambia

- La palabra técnica «conversación» como **objeto de Chatwoot** (API `…/conversations`, `display_id`, `chatwoot_conversations`,
  los `.rb` de `infra/chatwoot/correo/`, los tipos `ConversacionDeCliente`, etc.).
- Tablas, columnas, enums y migraciones (`conversations`, `messages`, `0106_conversaciones.sql`): una migración
  aplicada no se renumera ni se renombra por un cambio de rótulo.
- El id de módulo `conversaciones` (clave de RBAC, `role_module_overrides`, `user_module_grants`, mapa de accesos) y la
  categoría de alerta `conversaciones`: cambiarlos toca datos de producción (permisos por persona) sin ganancia visible.
  Misma lógica que dejó `id: "kommo"` con el rótulo «CRM» (`modules.ts:138`).
- Carpeta `docs/specs/0056-conversaciones` y las specs, handoffs y auditorías **fechados**.
- Usos del sustantivo en español corriente (§2, F) y la API pública `/api/conversaciones/email`.

## 6. Colisión de nombres a vigilar

«Soporte» ya es el nombre de un **rol** (`support`, «Soporte» en `user-types.ts:273`, `bitacora-types.ts:142`,
`comments-queries.ts:287`) y del chat del Portal. Con el cambio, «Soporte» sería rol, pantalla del Studio y pantalla del
Portal a la vez. No rompe nada técnico, pero un texto como «Soporte ve Soporte» confunde. Ver D-6.

## 7. Plan por fases

| Fase | Contenido | Quién | Requiere |
|---|---|---|---|
| **1 · Studio y Portal** | §2 clases A y B de pantalla: etiqueta y `slug` en `modules.ts`, *rewrite* y 308 en `next.config.ts` (carpeta sin mover, §3.1), `revalidatePath`, enlaces de avisos (§3.3), i18n `bandeja.ts`/`guide.ts`, tarjetas de la ficha según D-2, ayuda del asistente, textos del Portal que dicen «conversaciones» como pantalla, runbooks vigentes y marketing con el nombre visible. Prueba del 308 y del enlace del aviso | Worker de producto | PR con revisión previa (toca rutas y notificaciones: **no** carril rápido) |
| **2 · Guiones de la Oficina** | Textos que la Oficina dice al cliente y a Sam («Conversaciones por cerrar», avisos de Discord, guiones de `docs/oficina`) | Ofi_Hermes (no esta spec) | Su propio encargo; ajustar la pantalla «Conversaciones por cerrar» de `admin/oficina-virtual/page.tsx:125` solo si D-3 lo pide |
| **3 · Chatwoot** | §4: inventario en lectura, luego renombrar bandejas/equipos/etiquetas, plantillas de agentes y textos al cliente; antes, mover el cruce de `cargar.sh`/`ensayo-portal.sh` de nombre a ID | Worker de infraestructura | **OK nominal de Sam** por cada escritura en Chatwoot de producción; plantillas de Meta: nueva aprobación |

Criterios de aceptación de la fase 1 (para que la spec pueda cerrarse): (1) `/studio/conversaciones?c=x` responde 308 a
`/studio/soporte?c=x`; (2) el menú, el título de la pestaña y el indicador dicen «Soporte»; (3) los avisos nuevos llevan la
ruta nueva; (4) ningún `href`, `router.push`, `redirect` ni enlace de aviso apunta a `/studio/conversaciones`; esa cadena solo queda en `next.config.ts` (destino del *rewrite* y origen del 308), en `revalidatePath` si la medición de §3.1 lo pide, en pruebas y en documentos fechados;
(5) `pnpm verify` en verde; (6) ningún cambio en tablas, migraciones ni `id` de módulo.

## 8. Riesgos

- **Caché sin invalidar** si se olvida un `revalidatePath` (§3.3).
- **Enlaces ya enviados**: cubiertos por el 308; no quitarlo nunca.
- **Cruce por nombre de la bandeja del portal** en Chatwoot (§4): el riesgo más serio, por eso va en la fase 3.
- **Doble sentido de «Soporte»** (§6).
- **Guías y capturas** (Faro/asistente, `docs/design/studio/_norte`) con el nombre viejo; los HTML del Norte son versión
  fechada de diseño y no se reescriben salvo que Sam lo pida.

## 9. Decisiones para Sam

Cada una con opciones A/B y una recomendada, dibujables con el mismo patrón de las demás SDD (clic para elegir).

**D-1 · ¿Qué pantalla del Studio se llama «Soporte»?**
- **A (recomendada):** «Conversaciones» (SDD-0056) pasa a «Soporte»; «Bandeja» queda como la pestaña de Chatwoot dentro de CRM. Es lo que dijo Sam y espeja al Portal (donde «Soporte» es este mismo hilo).
- **B:** las dos pasan a «Soporte» (Bandeja también), con una sola entrada en el menú. Más limpio de cara afuera, pero toca la SDD-0655/0585, el flag `chatwoot_inbox` y la guía de agentes: otra fase.

**D-2 · ¿Cambia el nombre de las tarjetas de la ficha del cliente?** («Conversaciones en la Bandeja» y el panel de la SDD-0650)
- **A (recomendada):** sí, a «Soporte» (título de la tarjeta, `aria-label` de la columna y la guía), y el texto interior queda «conversaciones» como sustantivo corriente («Sin conversaciones vinculadas…»).
- **B:** solo el título, y la guía y los vacíos se revisan después.

**D-3 · ¿«Soporte» en singular en todas partes, y qué pasa con el sustantivo?**
- **A (recomendada):** singular «Soporte» para el nombre de la pantalla; «conversación» queda como sustantivo común dentro de los textos («Abre la conversación…»). No se reescribe cada aparición.
- **B:** barrido total: «conversación» → «chat»/«caso» en todo texto visible. Más trabajo, cambia el sentido de frases y las guías de agentes, y no es lo que dijo Sam.

**D-4 · ¿La interfaz de Chatwoot (su menú «Conversaciones») se toca?**
- **A (recomendada):** no. Es la traducción del producto; solo se renombran bandejas, equipos y etiquetas propias (fase 3).
- **B:** sí, con un archivo de idioma propio. Cuesta mantenerlo en cada subida de versión de Chatwoot.

**D-5 · ¿Se renombra código (incluida la carpeta de la pantalla), tablas, id de módulo, la API `/api/conversaciones/email` o el canal de Discord `#conversaciones-portal`?**
- **A (recomendada):** no. Solo lo visible y la URL de la pantalla (con *rewrite*). Cero riesgo en datos, permisos y en la configuración de Resend. El canal de Discord se renombra después, si Sam quiere, junto con su texto.
- **B:** sí, carpetas y tipos en un PR de puro renombrado, sin cambio de comportamiento (ni tablas ni `id`). Se puede hacer luego; no aporta de cara al usuario.

**D-6 · ¿Cómo se evita el choque con el rol «Soporte» y el chat interno del equipo?**
- **A (recomendada):** el rol queda como «Soporte» y la pantalla como «Soporte»; en textos donde se mezclen se escribe «rol Soporte» y «pantalla Soporte». El chat interno del equipo **no** se llama Soporte (es entre personas del equipo, no atención al cliente).
- **B:** renombrar el rol a «Atención al cliente» para dejar «Soporte» solo a la pantalla. Toca `user-types.ts`, bitácora y comentarios, y el vocabulario ya aprendido por el equipo.

## 10. Fuera de alcance

Nombre de la Oficina virtual y sus guiones (Ofi_Hermes); cualquier escritura en Chatwoot, Meta, Resend o Kommo;
migraciones; el rediseño de la pantalla (SDD-0677/0680); el texto de marketing público (Noticias, redes).

## 11. Verificación de este documento

- Número libre: no hay carpeta `0707-*` en `docs/specs`, rama, ni `refs/dtd/reservations/0707` en `origin` al 2026-11-22.
- Los conteos y las líneas citadas salen de `git grep` sobre `33ef3ad82`; las líneas se vencen si alguien edita arriba (D de la memoria del proyecto: verificar de nuevo al ejecutar).
- **NV:** inventario real de bandejas/equipos/etiquetas de Chatwoot y de plantillas de Meta; no se consultó producción.
