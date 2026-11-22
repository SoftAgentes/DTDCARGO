---
sdd: "0707"
title: "El nombre «Conversaciones» pasa a «Soporte» en todo el sistema"
status: approved
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-22
updated: 2026-11-22
revision: "v0.6 (Sam: D-7 A, actualizar las firmas guardadas, 2026-11-22)"
supersedes: null
superseded_by: null
related: ["0056", "0147", "0583", "0585", "0626", "0655", "0702", "0705"]
confidencialidad: interno
---

# SDD-0707 — «Conversaciones» pasa a «Soporte» en todo el sistema

> Decisión de Sam (2026-11-22), relayada por el Director Ofi_Hermes, textual: «Correcto, va a ser soporte en vez de
> conversación. Hay que cambiarlo y decirle al director general que haga ese cambio general, y también a Chatwoot:
> hay un cambio total de conversaciones a soporte».
>
> **Estado: aprobada, solo spec.** No lleva código, ni migración, ni cambios en Chatwoot. Decisión final de Sam (§9):
> D-1 **A**, D-2 **A**, D-3 **B** (barrido de la palabra), D-4 **B** (idioma propio en Chatwoot), D-5 **A** y D-6 **B**
> (el rol pasa a «Atención al cliente»). Reemplaza a la respuesta anterior, «Con todas las recomendadas».
> Repo público: sin llaves, correos, IP ni montos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia · **NV** no verificado.
Base: `main` `471ea1d0b` (v0.5; la v0.2 a v0.4 sobre `8c15a4bb0` y la v0.1 sobre `33ef3ad82`; los conteos de archivos no cambiaron). Conteos hechos
con `git grep -il "conversaci"`.

## 1. Qué existe hoy

| Hecho | Ev. |
|---|---|
| El Portal del cliente ya dice «Soporte»: ruta `/portal/soporte`, y `/portal/mensajes` redirige a ella | C `app/portal/(app)/mensajes/page.tsx:10` |
| El Studio tiene **dos** superficies con el nombre viejo, y no son la misma cosa (ver §1.1) | C |
| El módulo `conversaciones` (SDD-0056) está en el menú COMERCIAL con la etiqueta «Conversaciones» y la ruta `/studio/conversaciones` | C `lib/studio/modules.ts:131` |
| La Bandeja de Chatwoot (`/studio/bandeja`, SDD-0585) es otra pestaña, dentro de CRM (SDD-0655); se llama «Bandeja» | C `lib/studio/modules.ts:136` |
| La ficha del cliente muestra la columna `aside` con `aria-label="Conversaciones"` y las tarjetas «Conversaciones en la Bandeja» (`ChatwootConversacionesCard`) y el panel de la SDD-0650 F2 (`ConversacionesFichaCard`) | C `app/studio/(app)/clientes/[markbox]/page.tsx:628` · `lib/i18n/es-VE/bandeja.ts:84` |
| En Chatwoot de producción hay una bandeja llamada «Conversaciones del portal» (canal API, SDD-0519) y el `cargar.sh` la cruza **por ese nombre** | D `docs/runbooks/chatwoot-portal-p4-puertas.md:54` |
| El rol «Soporte» existe en el Studio (id `support`): es una **persona**, no una pantalla | C `lib/studio/user-types.ts:273` |
| Ya hubo un cambio de nombre con redirección permanente: `/studio/admin/oficina` → `/studio/admin/oficina-virtual` (SDD-0626, PR #720) | C `next.config.ts:677-680` |
| Chatwoot corre con la imagen oficial `chatwoot/chatwoot:v4.20.0-ce` fijada por digest y `DEFAULT_LOCALE` `es`. De DTD solo se montan los correos (SDD-0583) y la marca; no hay imagen propia | C `infra/chatwoot/compose.yml:51,59,155-158` |

### 1.1 El nombre viejo cubre dos cosas distintas

1. **Módulo «Conversaciones» (SDD-0056):** bandeja interna del ERP con las tablas `conversations`/`messages`, el correo
   entrante de Resend, el hilo del Portal y el resumen mensual (SDD-0149). Es lo que el Portal muestra como «Soporte».
2. **Bandeja de Chatwoot:** la atención diaria por WhatsApp, Instagram, Messenger y correo. En el Studio se llama
   «Bandeja»; dentro de Chatwoot, «conversación» es el nombre del objeto.

Con D-1 en **A**, solo el primero pasa a llamarse «Soporte». «Bandeja» sigue igual. El sustantivo «conversación»
dentro de los textos de los dos se barre con D-3 (§2.1).

## 2. Inventario

Conteo de archivos con «conversaci» (sin `docs/specs` ni `.agents/handoffs`, que son históricos y no se tocan):
`lib/studio` 146 · `app/studio` 84 · `infra/chatwoot` 33 · `infra/ops` 31 · `supabase/tests` 26 ·
`docs/marketing` 26 · `docs/design` 27 · `docs/runbooks` 23 · `app/api` 11 · `docs/audits` 12 · `docs/organizacion` 11 ·
`supabase/migrations` 37 · el resto con 1 a 7. La mayoría es **código** (clase C) y no se toca.

| Clase | Qué incluye | Qué se hace |
|---|---|---|
| **A · Nombre visible de la pantalla** | Etiqueta del menú (`modules.ts:131`), `metadata.title` de la página (`conversaciones/page.tsx:23`) y su título visible (`conversaciones/page.tsx:66`), `ConversationsIndicator` (`label = "Conversaciones"`), `aria-label` de la columna de la ficha y título de sus tarjetas (D-2 A), la guía «Conversaciones en la ficha del cliente» (`guide.ts:141-146`), `bandeja.card.title` (`bandeja.ts:84`), la entrada del asistente en `asistente/contenido/catalogo.ts:78` (dice «Bandeja de atención: conversaciones con clientes…»; «Bandeja» queda por D-1 A y el sustantivo va al barrido), y en la pantalla de rutas de alerta `lib/studio/telegram/alert-routing.ts:53` (rótulo «Conversaciones del portal») y `:66` (ayuda «Un cliente escribió por el chat del portal») | **Cambiar** (fase 1) |
| **A′ · Visible pero atado a un nombre externo** | `lib/i18n/es-VE/bandeja.ts:266` (`bandeja.portal.help`, nombra la bandeja «Conversaciones del portal» de Chatwoot) · `lib/studio/discord/channels.ts:40` (canal `#conversaciones-portal`, nombre de un canal real de Discord) | Cambian solo junto con el nombre externo, en la fase 5: el primero con la bandeja, el segundo con el canal, y con OK |
| **A″ · Sustantivo en textos visibles** | Ver §2.1 | **Barrido** (fase 3, D-3 B) |
| **B · Ruta** | `/studio/conversaciones` (+ `?c=<id>`), `/api/studio/conversaciones/[id]`, `/api/conversaciones/email` | Pantalla: **cambiar** con *rewrite* y 308 (§3). API: no cambia |
| **C · Nombre de código** | Carpeta `app/studio/(app)/conversaciones/` (§3.1), comentarios de código que nombran el módulo (`conversation-inbound-notify.ts:3`, `app/portal/(app)/soporte/page.tsx:40,87,161`, `app/portal/(app)/mensajes/actions.ts:11`: se dejan, porque nombran la SDD-0056 y no se ven), `lib/studio/conversaciones/`, componentes `Conversacion*`, tipos y funciones, el id de módulo `"conversaciones"` (RBAC), la categoría de alerta `conversaciones` (Telegram/Discord), `DISCORD_WEBHOOK_CONVERSACIONES`, tablas `conversations`/`messages`, la migración `0106_conversaciones.sql`, `data-guia="cliente.conversaciones"`, clases CSS `studio-ficha-conversaciones`, nombres de campo de formulario (`name="conversacion"`), `logTag`, `console.warn` y códigos de `apiError` | **No cambiar** (D-5 A) |
| **D · Documentación** | `docs/runbooks` (23), `docs/marketing` (26), `docs/design` (27), `docs/organizacion` (11), `docs/audits` (12, fechados), `docs/specs/0056-conversaciones` (se conserva el nombre de la carpeta) | Runbooks, guías de agentes y marketing **vigentes**: nombre en la fase 1 y sustantivo en la fase 3. Auditorías, handoffs y specs: **no**, son evidencia fechada |
| **E · Objeto técnico de Chatwoot** | «conversación» en el código de `lib/studio/chatwoot/*` (`account-api.ts`, `router-api.ts`, `bot/decidir.ts`), `infra/chatwoot/correo/*.rb`, la tabla `chatwoot_conversations` y la API `…/conversations` | **No cambia** (§5). Los textos que **ven** los agentes (plantillas `.liquid` y el panel) sí: §2.1 y §4.1 |
| **F · Otro sentido de la palabra** | «Ver conversación» de `lib/studio/bug-email-notify.ts:485` (hilo de un bug en `/studio/mis-bugs`) y lo demás que §2.1 deja fuera: Bitácora, Bugs, privacidad, `lib/news/cerebro.ts`, `scripts/bot-conocimiento.mjs`, guías públicas (`comprar-en-alibaba`, `guia-peso`) | **No cambia** (ver §2.1, «Queda fuera») |

### 2.1 Barrido de la palabra (D-3 B)

**Criterio para elegir la palabra.**
- **«chat»** cuando el texto habla del **hilo de mensajes** o del canal: abrir, leer, escribir, ver el historial, la
  columna de la ficha, el enlace a Chatwoot. Ejemplos: «Abre la conversación» → «Abre el chat»; «Sin conversación en
  Chatwoot ligada a esta ficha» → «Sin chat de Chatwoot ligado a esta ficha»; «Ves los últimos 90 días de tu
  conversación» → «… de tu chat».
- **«caso»** cuando el texto habla de una **unidad de atención con responsable, estado o cierre**: asignar, cerrar,
  escalar, contar, «por cerrar», KPI por estado. Ejemplos: «Conversación asignada» → «Caso asignado»; «No hay
  conversaciones por cerrar» → «No hay casos por cerrar»; «Estado de la conversación» → «Estado del caso».
- **Con número de Chatwoot:** «conversación #123» → «chat #123» (el número es el `display_id` del chat).
- Si una frase tiene las dos ideas, manda la acción: se **asigna un caso**, se **abre un chat**.
- Cambia el género («la conversación» → «el chat» o «el caso»): hay que revisar artículos y concordancias, no solo la palabra.

**Inventario (medido sobre `471ea1d0b`).** Los conteos son **mínimos**: salen de una búsqueda por líneas con la
palabra entre comillas o en JSX, y un texto partido en varias líneas o con dos cadenas en la misma línea puede
escaparse. Quien ejecute vuelve a medir archivo por archivo.

| Superficie | Dónde | Cuántos |
|---|---|---|
| Diccionario de la Bandeja y de la ficha | `lib/i18n/es-VE/bandeja.ts` | 22 líneas |
| Guías del Studio y de la ficha DTD | `lib/i18n/es-VE/guide.ts` | 13 líneas |
| Pantalla Soporte (SDD-0056) | `conversaciones/_components/ConversacionesClient.tsx:192-193`, `ConversationList.tsx:165,294`, `ConversationThread.tsx:215` (dos cadenas: «Conversación asignada» y «Conversación sin asignar»), `ConversationThread.tsx:324`, `conversaciones/actions.ts:131,251,254` | 10 como mínimo |
| Ficha del cliente | `clientes/conversaciones-actions.ts:105,112,115` y los textos interiores de las tarjetas | ≈6 |
| CRM | `crm/_components/CrmVistaEmbudo.tsx:25`, `TarjetaFichaDrawer.tsx:187` | 2 |
| Bandeja, vincular | `bandeja/vincular-actions.ts:147` («Vinculado desde la conversación…», queda en el historial de la ficha) | 1 |
| Oficina virtual (pantalla de Sam) | `admin/oficina-virtual/page.tsx:38,96,102,116,119,120,125`, `_components/TarjetaBorrador.tsx:37,66,74`, `TarjetaCierre.tsx:23,26`, `_components/resultado.ts:15`, `vista/page.tsx:166` | 15 como mínimo |
| Administración | `admin/page.tsx:157` («conversaciones del portal») | 1 |
| Portal | `app/portal/(app)/soporte/page.tsx:209,264`, `lib/portal/simple/bloques.ts:51` | 3 |
| Guías de agentes | `docs/runbooks/chatwoot-agentes.md` (3) y las guías del asistente que hablen de la Bandeja (se miden al ejecutar) | 3 o más |
| Avisos de Chatwoot a los agentes | `infra/chatwoot/correo/generar-avisos.sh` (11) y las 5 plantillas `.liquid` de `conversation_notifications_mailer` (18) | 29, **en el repo**; aplicarlos en el servidor es la fase 5 |

Los números de línea se vencen: quien ejecute vuelve a medir con `git grep -n -i "conversaci"` por valor, sin comentarios.

**Pruebas que hoy afirman las cadenas viejas** (se actualizan al texto nuevo en el mismo PR; no se debilitan ni se
borran): `conversaciones/__tests__/set-status-gate.test.ts:185,198`,
`conversaciones/_components/ConversationList.abrir.test.tsx:67-100` («Abrir conversación de…»),
`conversaciones/__tests__/thread-solo-lectura.test.tsx:136` («Estado de la conversación») y
`admin/oficina-virtual/_components/AvisoResultado.test.tsx` (los textos de `detalleDelCierre` y del aviso de cierre).
Antes de dar la fase por terminada: `git grep -n -i "conversaci"` en los `*.test.*` de esas carpetas, para encontrar las
que falten.

**Queda fuera del barrido.** Es una propuesta de este documento; si Sam quiere sumar alguna, se agrega a la fase 3.
- **Bitácora** (`bitacora/nueva/*`, `bitacora-types.ts:471,495`, `extract.ts`, `match.ts`, `prompts.ts`,
  `bitacora/actions.ts:570`): ahí «conversación» es una reunión o una charla de trabajo, no atención al cliente.
  Pasarla a «chat» o a «caso» cambia el sentido.
- **Bugs** (`BugDrawer.tsx:269`, `bug-email-notify.ts:485`, `api/studio/bugs/[id]/prompt/route.ts:86`): es el hilo de
  un bug interno.
- **Política de privacidad** (`app/privacidad/page.tsx:74`): es texto legal. Cambia solo con la revisión de datos
  personales (`.claude/skills/revisar-datos-ve`), no en este barrido.
- **Contenido** (`lib/news/cerebro.ts`, `scripts/bot-conocimiento.mjs`, guías públicas): es otro sentido de la palabra.
- **Lo que no se ve** (clase C): registros, llaves, nombres de campo, prompts internos.

### 2.2 El rol «Soporte» pasa a «Atención al cliente» (D-6 B)

El **id** del rol (`support`) **no cambia**. Está en `rbac.ts` (`:63-89` y siguientes), `chatwoot/matriz.ts:75,82`,
`guia/preferencias.ts:31`, `nomina/position-types.ts:64`, `bitacora-types.ts:48`, en la base (`studio_users.role`) y
en las policies. El RBAC y la matriz de Chatwoot comparan **ids**, nunca el nombre visible: cambiar el rótulo no toca
permisos (C).

| Clase | Dónde | Cambio |
|---|---|---|
| Rótulo del rol | `lib/studio/user-types.ts:273`, `lib/i18n/es-VE/users.ts:36` (`users.role.support`), `lib/studio/bitacora/bitacora-types.ts:142`, `lib/studio/comments/comments-queries.ts:287` | «Soporte» → «Atención al cliente» |
| Textos que nombran el rol | `admin/_components/PermisoCeldaPanel.tsx:204` («Soporte nunca edita.»), `usuarios/_components/acceso/MapaAcceso.tsx:378`, guías del asistente `asistente/contenido/guias/clients.ts:156`, `quotes.ts:177`, `shipments.ts:135` («… soporte y administración. Soporte solo consulta») | El rol pasa a «Atención al cliente» dentro del texto |
| Comentarios | `clientes/conversaciones-actions.ts:7`, `chatwoot/ficha-conversaciones.ts:11`, `chatwoot/vincular.ts:16` | Se actualizan en el mismo PR para no dejar dos nombres |
| Documentación vigente | `docs/organizacion`, runbooks que nombren el rol | Se actualiza; auditorías y specs fechadas no |
| **No es el rol, no cambia** | `StudioTopbar.tsx:438` (menú de ayuda), `bugs/page.tsx:106` («Soporte interno»), `ProfileModal.tsx:741` («Soporte del portal»), `components/NavClient.tsx:49` e `Icon.tsx:66` (la pantalla del Portal), `fidelizacion/types.ts:39` («Soporte estándar», un beneficio), `oficina-virtual/page.tsx:83` (`soporte-chatwoot`, el agente de la Oficina) y la base de conocimiento del bot | — |

Las pruebas que comparan el rótulo se actualizan; no se debilitan: `admin/_components/PermissionsSection.test.tsx:189,191`
y `usuarios/_components/acceso/AccesoPanel.test.tsx:149` («Soporte nunca edita.»). Que los **equipos** de Chatwoot no
se llamen como el rol es **NV** (la matriz usa ids, `matriz.ts:82`); se mide en el inventario de la fase 5.

**Firmas de correo: el nombre del rol queda guardado en la base.** La pantalla de Mailing precarga
`roleLabel(m.role)` (`mailing/page.tsx:225`) como cargo de la firma (`SignaturesView.tsx:245`); al guardar, ese texto
va a la columna `role_label` (`SignaturesView.tsx:263`, `mailing/actions.ts:231`) y sale en cada correo que el cliente
recibe. Además, al crear un usuario se escribe `ROLE_LABELS[input.role]` (`usuarios/actions.ts:253`). Consecuencia:
cambiar el rótulo en la fase 2 arregla las firmas **nuevas**, pero **las firmas ya guardadas seguirán diciendo
«Soporte»**. Sam decidió actualizarlas (D-7 A, §9): es el paso 2b de la fase 2.

## 3. Rutas

### 3.1 Cambio
La URL `/studio/conversaciones` pasa a `/studio/soporte`. **La carpeta `app/studio/(app)/conversaciones/` no se mueve**
(D-5 A, clase C). En `lib/studio/modules.ts:131` cambian solo `label` («Soporte») y `slug` (`/studio/soporte`); el
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

Next conserva `?c=<id>`. `proxy.ts` está verificado: no menciona `conversaciones` ni la Bandeja (solo protege
`/studio/**` con sesión) y **no cambia**. Prueba obligatoria: la de `lib/runtime/__tests__/next-config.test.ts` (el
patrón de las redirecciones existentes), y quitar `/studio/conversaciones` de la lista de rutas «no Bandeja» de las
líneas 193 y siguientes, o cambiarla a `/studio/soporte`.

### 3.3 Qué apunta a la ruta vieja
Medido sobre `8c15a4bb0`. Cambian a la URL nueva los enlaces: `ConversationsIndicator.tsx:42` (`href`),
`ConversacionesClient.tsx`, `ConversationList.tsx`, `ConversationThread.tsx`, `GenerateDigestsPanel.tsx`,
`SaldoPendienteContexto.tsx`, `layout.tsx` del Studio y `lib/studio/conversation-inbound-notify.ts:107` (el enlace del
aviso por Discord, Telegram y correo, con `?c=…`). Los 5 `revalidatePath("/studio/conversaciones")` de
`conversaciones/actions.ts` siguen la medición de §3.1. Las pruebas que comparan la URL (`route-auth.test.ts`,
`avisos-discord-minimo.test.ts:195`, `crm-acceso.test.ts:90`) se actualizan. Los `import` de
`@/lib/studio/conversaciones/*` y las rutas de archivo en pruebas de contrato **no cambian**, porque la carpeta queda.
- **Avisos ya enviados** (Discord, Telegram, correo) con la ruta vieja siguen sirviendo por la redirección: es la razón
  del 308 y no hay que reenviar nada.
- **APIs** `/api/studio/conversaciones/[id]` y `/api/conversaciones/email`: **no cambian**. La segunda es la dirección
  que Resend Inbound tiene configurada (`docs/runbooks/setup-resend-inbound.md:61`); moverla exige tocar la
  configuración externa y no se ve en pantalla (D-5 A).
- Antes de ejecutar: `git grep -n "conversaciones"` por **valor** (no solo por carpeta) sobre `app lib scripts infra e2e`,
  y comprobar que no queda `href`/`router.push`/`redirect` a la ruta vieja fuera de `next.config.ts` y de sus pruebas.

## 4. Chatwoot (solo se describe; no se ejecuta aquí)

**Todo lo que toque Chatwoot de producción es la fase 5, con OK nominal de Sam.** Esta spec no cambia nada allí.

| Qué | Dónde está | Visible para | Riesgo |
|---|---|---|---|
| Bandeja «**Conversaciones del portal**» (canal API, cuenta 1) | Chatwoot; `CHATWOOT_INBOX_PORTAL_ID`; `cargar.sh` y `ensayo-portal.sh` la cruzan **por nombre** | el equipo | **Alto si se renombra a ciegas**: el cruce por nombre falla y el portal puede dejar de enrutar. Primero se cambia el cruce a ID |
| Flag «Conversaciones del portal en Chatwoot» (Studio → Admin → Feature flags) | Studio, texto | admin | Bajo; es texto del Studio (fase 3) |
| Ayuda `bandeja.portal.help` (`bandeja.ts:266`) | Studio, texto | admin | Cambia **en el mismo paso** que el nombre de la bandeja; si no, el texto nombra una bandeja que no existe |
| Canal de Discord `#conversaciones-portal` (`discord/channels.ts:40`) | Discord | el equipo | Bajo, pero es externo: el canal y su texto juntos, con OK |
| Nombres de otras bandejas, equipos y **etiquetas** | Chatwoot | el equipo; las etiquetas no las ve el cliente | **NV**: no hay inventario en el repo; se lista por la API en lectura, con OK |
| Plantillas de aviso a agentes (`infra/chatwoot/correo/views/.../*.liquid`, `generar-avisos.sh`): «Conversación nueva», «Te asignaron una conversación», «Abrir conversación» | repo + servidor de Chatwoot | el equipo, por correo | Medio: el texto se cambia en el repo en la fase 3; aplicarlo es subir las plantillas al servidor (fase 5) |
| Interfaz de Chatwoot (el menú y los textos del panel que dicen «Conversaciones») | imagen de Chatwoot | el equipo | **Cambia (D-4 B)**: idioma propio, §4.1 |
| Textos que ve el **cliente** (saludo, mensaje de fuera de horario, encuesta, plantillas de WhatsApp en Meta) | Chatwoot/Meta | el cliente | **NV**. Las plantillas de Meta necesitan nueva aprobación; hoy no se sabe si alguna dice «conversación». Se mide en lectura |

Lecturas previas: `docs/runbooks/oficina-cable.md` (la bandeja de la Oficina y «Conversaciones por cerrar»),
`chatwoot-bandeja.md`, `chatwoot-portal-encendido.md`, `chatwoot-portal-p4-puertas.md`, `chatwoot-agentes.md` y
`chatwoot-versiones.md`. La bandeja de la Oficina **no** se renombra aquí: sus guiones los lleva Ofi_Hermes.

### 4.1 Idioma propio para la interfaz de Chatwoot (D-4 B)

**Por qué no basta con montar un archivo (I, a medir).** Los textos del panel de agentes salen de los archivos de
idioma del *frontend*, que van **compilados** dentro de la imagen oficial. Montar un JSON nuevo no los cambia. Vías, de
menor a mayor costo:
1. **Imagen propia (recomendada):** `FROM` la imagen oficial con su digest, se cambian las cadenas de `es` que dicen
   «conversación» y se recompila el *frontend*. Es la vía limpia; agrega un paso de *build* en cada subida.
2. **Parche sobre lo ya compilado** al arrancar: frágil, se rompe con cualquier cambio de nombres de archivo. No se recomienda.
3. **Pedirlo a la comunidad de Chatwoot:** no sirve, porque «Soporte», «chat» y «caso» son nombres de DTD, no una
   traducción mejor.

**Alcance.** Solo las cadenas que dicen «conversación(es)» en el panel de agentes (menú, títulos, filtros, vacíos), con
el mismo criterio «chat» / «caso» de §2.1. El resto queda con la traducción del proveedor.

**Costo de mantenerlo.** En **cada** subida de versión: (a) comparar las cadenas de `es` de la versión nueva con las
propias y reaplicar el cambio; (b) recompilar y publicar la imagen propia con su digest; (c) revisar el menú a ojo.
Estimado **NV** hasta medir el *build* (I: de media hora a dos horas por subida, más la compilación). Se agrega como
paso fijo del análisis de cada subida (el informe «Análisis del salto» de Studio › Administración › Actualizaciones).
Si en una subida se omite, el menú vuelve a decir «Conversaciones»: no rompe nada, pero se nota.

**Coordinación con la #776** (análisis de la subida 4.20.0 → 4.20.1, abierta, solo docs). Esa subida es un parche sin
migraciones. Orden recomendado: primero se aplica la 4.20.1 con la imagen oficial, como dice la #776; **después** se
arma la imagen propia sobre el digest de la 4.20.1, con el idioma. Así cambia una sola cosa por vez. Desde ahí, el
informe de cada subida suma la fila «idioma propio: cadenas nuevas o cambiadas». Publicar la imagen propia en el
servidor pide **OK nominal de Sam**.

**Dónde vive la imagen y cómo se fija (propuesta, se decide en la fase 5).** El `Dockerfile` y el archivo de cadenas
van en el repo, en `infra/chatwoot/idioma/`, sin secretos. La imagen se construye en GitHub Actions y se publica en
el registro de paquetes de GitHub (GHCR) como **paquete privado**. En `compose.yml` se fija por **etiqueta y digest
juntos**, igual que hoy la oficial: la etiqueta lleva la versión de Chatwoot más un sufijo propio
(`v4.20.1-ce-dtd.1`), y el digest sale de `docker buildx imagetools inspect`. El VPS necesita un token de solo lectura
del registro, que **no** va al repo. Alternativa sin registro: construir en el VPS y fijar por el ID local de la
imagen. Es más simple, pero no deja un artefacto que se pueda revisar. **NV:** el costo de Actions y si el *build*
del *frontend* cabe en el runner.

**El runbook se enmienda en esa fase.** `docs/runbooks/chatwoot-versiones.md:7,79` describe hoy una sola imagen
oficial fijada por etiqueta y digest (el paso 3 copia el digest de `chatwoot/chatwoot`). Con la imagen propia, ese
paso pasa a ser: digest de la oficial → *build* de la propia sobre ese digest → digest de la propia en
`compose.yml`. La enmienda va en el mismo PR de la fase 5, no en esta spec.

## 5. Lo que NO cambia

- La palabra técnica «conversación» como **objeto de Chatwoot** en el código y la API (`…/conversations`, `display_id`,
  `chatwoot_conversations`, los `.rb` de `infra/chatwoot/correo/`, los tipos `ConversacionDeCliente`, etc.).
- Tablas, columnas, enums y migraciones (`conversations`, `messages`, `0106_conversaciones.sql`): una migración
  aplicada no se renumera ni se renombra por un cambio de rótulo.
- El id de módulo `conversaciones` (clave de RBAC, `role_module_overrides`, `user_module_grants`, mapa de accesos) y la
  categoría de alerta `conversaciones`: cambiarlos toca datos de producción (permisos por persona) sin ganancia visible.
  Misma lógica que dejó `id: "kommo"` con el rótulo «CRM» (`modules.ts:138`).
- El **id** del rol `support` (§2.2): cambia solo su nombre visible.
- Carpeta `docs/specs/0056-conversaciones` y las specs, handoffs y auditorías **fechados**.
- Lo que §2.1 deja fuera del barrido y la API `/api/conversaciones/email`.

## 6. Colisión de nombres

«Soporte» era a la vez un **rol** (`support`) y el chat del Portal; con el cambio sería también la pantalla del
Studio. **Se resuelve con D-6 B:** el rol pasa a «Atención al cliente» (§2.2) y «Soporte» queda solo para las
pantallas. Siguen diciendo «Soporte» cosas que no son el rol ni la pantalla (menú de ayuda, «Soporte interno» de bugs,
«Soporte estándar» de fidelización): ver la última fila de §2.2.

## 7. Plan por fases

| Fase | Contenido | Quién | Requiere |
|---|---|---|---|
| **1 · Nombre y ruta** | Clases A y B: etiqueta y `slug` en `modules.ts`, *rewrite* y 308 en `next.config.ts` (carpeta sin mover, §3.1), enlaces de avisos (§3.3), título y guía de las tarjetas de la ficha (D-2 A), rótulos de rutas de alerta, catálogo del asistente, runbooks y marketing vigentes con el nombre de la pantalla. Pruebas del 308, del *rewrite* y del enlace del aviso | Worker de producto | PR con revisión previa (rutas y notificaciones: **no** carril rápido) |
| **2 · Rol «Atención al cliente»** | §2.2: rótulo, textos, guías del asistente, comentarios, pruebas y documentación vigente. Sin tocar el id `support`. **Paso 2b (D-7 A):** actualizar una sola vez las firmas guardadas de rol `support` cuyo cargo sea exactamente «Soporte»: conteo previo con su autorización, escritura con OK nominal de Sam y el runbook de producción | Worker de producto | PR con revisión previa (toca archivos de usuarios y permisos; `carril.mjs` decide). Puede ir **en paralelo** con la 1: no comparten archivos |
| **3 · Barrido de la palabra** | §2.1 en Studio y Portal: `bandeja.ts`, `guide.ts`, pantalla Soporte, ficha, CRM, Bandeja, Oficina virtual, Administración, Portal, guías de agentes (`chatwoot-agentes.md` y las del asistente) y los textos de los avisos `.liquid` **en el repo** (sin aplicarlos). Va **después de la 1 y de la 2**: con la 1 comparte las pantallas y la ficha; con la 2, `clientes/conversaciones-actions.ts` y las guías del asistente. La ayuda `bandeja.ts:266` (clase A′) **no** se toca aquí: espera a la fase 5 | Worker de producto | PR con revisión previa; capturas claro/oscuro de las pantallas con más cambios |
| **4 · Guiones de la Oficina** | Lo que la Oficina dice al cliente y a Sam (avisos de Discord, guiones de `docs/oficina`), con el criterio de §2.1. La pantalla de la Oficina ya queda en la 3 | Ofi_Hermes (no esta spec) | Su propio encargo |
| **5 · Chatwoot** | §4 y §4.1, en este orden: (a) inventario en lectura de bandejas, equipos, etiquetas y textos al cliente; (b) cruce de `cargar.sh`/`ensayo-portal.sh` de nombre a ID; (c) renombrar la bandeja «Conversaciones del portal» y cambiar `bandeja.ts:266` en el mismo paso; (d) subir al servidor las plantillas `.liquid` de la fase 3; (e) idioma propio, después de la subida 4.20.1 de la #776; (f) canal de Discord `#conversaciones-portal`, si Sam quiere; (g) plantillas de Meta, si alguna lo dice | Worker de infraestructura | **OK nominal de Sam** por cada escritura en Chatwoot de producción o en el servidor; Meta pide nueva aprobación |

**Criterios de aceptación.**
- **Fase 1:** (1) `/studio/conversaciones?c=x` responde 308 a `/studio/soporte?c=x`; (2) el menú, el título de la
  pestaña y el indicador dicen «Soporte»; (3) los avisos nuevos llevan la ruta nueva; (4) ningún `href`,
  `router.push`, `redirect` ni enlace de aviso apunta a `/studio/conversaciones`; esa cadena solo queda en
  `next.config.ts` (destino del *rewrite* y origen del 308), en `revalidatePath` si la medición de §3.1 lo pide, en
  pruebas y en documentos fechados; (5) `pnpm verify` en verde; (6) ningún cambio en tablas, migraciones ni `id` de
  módulo.
- **Fase 2:** ninguna pantalla nombra el rol como «Soporte»; `git grep '"support"'` da lo mismo antes y después en
  `rbac.ts`, `matriz.ts` y las migraciones; `pnpm verify` en verde.
- **Fase 3:** `git grep -n -i "conversaci"` sobre los textos visibles de las superficies de §2.1 da cero, salvo lo que
  §2.1 deja fuera y la clase A′ (`bandeja.ts:266`, «Conversaciones del portal», y `discord/channels.ts:40`), que
  esperan a la fase 5; las pruebas de §2.1 afirman el texto nuevo; `pnpm verify` en verde.
- **Fase 5:** cada paso con su OK nominal y su comprobación (el chat del Portal sigue llegando a la bandeja después de
  renombrarla; el menú de Chatwoot dice lo nuevo después de publicar la imagen).

## 8. Riesgos

- **Caché sin invalidar** si se olvida un `revalidatePath` (§3.1).
- **Enlaces ya enviados**: cubiertos por el 308; no quitarlo nunca.
- **Cruce por nombre de la bandeja del portal** en Chatwoot (§4): el riesgo más serio, por eso va en la fase 5 y
  después de pasar el cruce a ID.
- **Barrido que cambia el sentido**: por eso el criterio de §2.1 y la lista de lo que queda fuera.
- **Idioma propio de Chatwoot**: un paso más en cada subida de versión (§4.1).
- **Guías y capturas** (Faro/asistente, `docs/design/studio/_norte`) con el nombre viejo; los HTML del Norte son versión
  fechada de diseño y no se reescriben salvo que Sam lo pida.

## 9. Decisiones de Sam

**Respuesta final (la que vale).** Sam, en el chat del Director (Dir_DTD), 2026-11-22, **después** de la respuesta de
abajo, textual:

> «Decisiones de Soporte — Soporte 1 pantalla: A solo Conversaciones · Soporte 2 ficha: A titulo y guia · Soporte 3
> palabra: B barrido · Soporte 4 chatwoot: B si · Soporte 5 interno: A no · Soporte 6 rol: B renombrar rol»

Queda: **D-1 A · D-2 A · D-3 B · D-4 B · D-5 A · D-6 B.**

**Respuesta anterior (reemplazada).** Sam, en la sesión del Worker, 2026-11-22, textual: «Con todas las recomendadas»
(D-1 a D-6 en A). La respuesta final la reemplaza en D-3, D-4 y D-6.

Lo que fija para el trabajo:
- **D-1 A:** solo «Conversaciones» (SDD-0056) pasa a «Soporte». «Bandeja» sigue igual.
- **D-2 A:** la tarjeta de la ficha cambia el título y la guía.
- **D-3 B:** barrido de «conversación» a «chat» o «caso» en los textos visibles (§2.1, fase 3).
- **D-4 B:** idioma propio en la interfaz de Chatwoot (§4.1, fase 5).
- **D-5 A:** no se renombra código, carpeta, tablas, id, API ni el canal de Discord.
- **D-6 B:** el rol pasa a «Atención al cliente» (§2.2, fase 2), con el id `support` igual.

**D-7 · Resuelta: A.** Sam, en la sesión del Worker, 2026-11-22, textual: «A: actualizarlas». Era la pregunta: ¿qué pasa
con las **firmas de correo ya guardadas** que dicen «Soporte» (§2.2)?
- **A (recomendada):** se actualizan una sola vez, y solo las de personas con rol `support` cuyo cargo sea
  **exactamente** «Soporte». Las que alguien escribió a mano («Soporte China», «Coordinadora») no se tocan. Va como
  paso aparte de la fase 2: primero un conteo (con su autorización), después la escritura con **OK nominal de Sam**
  y el runbook de producción. Así el cliente deja de ver dos nombres para el mismo puesto.
- **B:** se quedan como están; cada persona cambia su firma en Mailing si quiere. No toca datos, pero durante un
  tiempo los correos salen con «Soporte» y las pantallas dicen «Atención al cliente».

Opciones tal como se presentaron (con la recomendación de entonces):

**D-1 · ¿Qué pantalla del Studio se llama «Soporte»?**
- **A (recomendada):** «Conversaciones» (SDD-0056) pasa a «Soporte»; «Bandeja» queda como la pestaña de Chatwoot dentro de CRM. Es lo que dijo Sam y espeja al Portal (donde «Soporte» es este mismo hilo).
- **B:** las dos pasan a «Soporte» (Bandeja también), con una sola entrada en el menú. Más limpio de cara afuera, pero toca la SDD-0655/0585, el flag `chatwoot_inbox` y la guía de agentes: otra fase.

**D-2 · ¿Cambia el nombre de las tarjetas de la ficha del cliente?** («Conversaciones en la Bandeja» y el panel de la SDD-0650)
- **A (recomendada):** sí, a «Soporte» (título de la tarjeta, `aria-label` de la columna y la guía).
- **B:** solo el título, y la guía y los vacíos se revisan después.

**D-3 · ¿«Soporte» en singular en todas partes, y qué pasa con el sustantivo?**
- **A (recomendada):** singular «Soporte» para el nombre de la pantalla; «conversación» queda como sustantivo común dentro de los textos. No se reescribe cada aparición.
- **B:** barrido total: «conversación» → «chat»/«caso» en todo texto visible. Más trabajo, cambia el sentido de frases y las guías de agentes.

**D-4 · ¿La interfaz de Chatwoot (su menú «Conversaciones») se toca?**
- **A (recomendada):** no. Es la traducción del producto; solo se renombran bandejas, equipos y etiquetas propias.
- **B:** sí, con un archivo de idioma propio. Cuesta mantenerlo en cada subida de versión de Chatwoot.

**D-5 · ¿Se renombra código (incluida la carpeta de la pantalla), tablas, id de módulo, la API `/api/conversaciones/email` o el canal de Discord `#conversaciones-portal`?**
- **A (recomendada):** no. Solo lo visible y la URL de la pantalla (con *rewrite*). Cero riesgo en datos, permisos y en la configuración de Resend. El canal de Discord se renombra después, si Sam quiere, junto con su texto.
- **B:** sí, carpetas y tipos en un PR de puro renombrado, sin cambio de comportamiento (ni tablas ni `id`).

**D-6 · ¿Cómo se evita el choque con el rol «Soporte» y el chat interno del equipo?**
- **A (recomendada):** el rol queda como «Soporte» y la pantalla como «Soporte»; el chat interno del equipo **no** se llama Soporte.
- **B:** renombrar el rol a «Atención al cliente» para dejar «Soporte» solo a la pantalla. Toca `user-types.ts`, bitácora y comentarios, y el vocabulario ya aprendido por el equipo.

## 10. Fuera de alcance

Nombre de la Oficina virtual y sus guiones (Ofi_Hermes); cualquier escritura en Chatwoot, Meta, Resend, Discord o
Kommo fuera de la fase 5; migraciones; el rediseño de la pantalla (SDD-0677/0680); el texto de marketing público
(Noticias, redes); la política de privacidad.

## 11. Verificación de este documento

- Número libre: no hay carpeta `0707-*` en `docs/specs`, rama, ni `refs/dtd/reservations/0707` en `origin` al 2026-11-22.
- Los conteos y las líneas citadas salen de `git grep` sobre `471ea1d0b`; las líneas se vencen si alguien edita arriba:
  se vuelven a medir al ejecutar.
- **NV:** inventario real de bandejas, equipos, etiquetas y textos al cliente de Chatwoot, plantillas de Meta, el
  costo real de la imagen propia y cuántas firmas guardadas dicen «Soporte»; no se consultó producción ni se compiló nada.
