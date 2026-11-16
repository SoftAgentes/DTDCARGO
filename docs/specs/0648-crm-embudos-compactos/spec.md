---
sdd: "0648"
title: "CRM › Embudos: tarjeta compacta, logo por canal, ancho completo, vista Lista y chat a pantalla completa"
status: in-progress
author: "Claude (Worker CRM Embudos) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0587", "0585", "0586", "0603", "0614"]
confidencialidad: interno
---

# SDD-0648 — CRM › Embudos: tarjeta compacta, logo por canal, ancho completo, vista Lista y chat a pantalla completa

> El tablero de Embudos muestra el doble de tarjetas en el mismo alto, dice de qué canal vino cada lead
> con su logo, usa todo el ancho de la pantalla y suma una vista Lista. Desde la tarjeta o la ficha se
> abre la conversación de Chatwoot a pantalla completa, para leerla y contestar desde el ERP.

## Contexto

Pedido de Sam del 2026-11-16, sobre una captura del tablero:

1. El selector «Mover a…» y el botón «Abrir» de cada tarjeta son muy grandes; quiere una vista compacta de verdad.
2. Un logo a color por canal junto a la fuente del lead: Instagram con sus colores, TikTok pequeño, Facebook en azul y, para «canales» (el portal), un logo pequeño de DTD. Acepta que rompe un poco la marca.
3. Una vista de conversaciones al lado de Embudos, aprovechar el ancho (hoy sobra espacio a los lados y las columnas son estrechas) y ver varias vistas.

Propuesta con investigación y bocetos: artefacto privado «Embudos compactos del CRM» (2026-11-16). Sam la aprobó
el mismo día y preguntó cómo entrar al chat, ver lo conversado y contestar desde el ERP, y pidió que el chat abra a
pantalla completa, no a media pantalla.

### Lo que había (medido en `main` cb199c4a7)

- La tarjeta (`CrmTableroKanban.tsx`) lleva una fila propia con un `<select>` «Mover a…» y un botón «Abrir», de 32 px.
- Columnas de 268 px fijos. Dos topes de ancho: `KommoClient` (1.280 px) y el contenedor del Studio (`--content-max`, 1.440 px).
- El canal ya existe como dato: `crm_tarjetas.fuente` (0506) y `crm_tarjetas.utm_source`. El tablero leía `fuente` y no la pasaba a la tarjeta.
- «Abrir» abre la ficha (`TarjetaFichaDrawer`) a media pantalla. Del chat muestra solo el estado y quién lo atiende. Studio no guarda el texto de los mensajes.
- La Bandeja (`/studio/bandeja`, SDD-0585) monta el panel de Chatwoot con SSO y abre una conversación con `?c=N`.

## Decisiones aprobadas por Sam (2026-11-16, texto literal de la propuesta)

- **D1 · Excepción de marca para logos de terceros.** «BRAND prohíbe colores saturados fuera de la paleta. Propongo registrar una excepción acotada: logos de canal a color, de 14 a 18 px, solo en el CRM y en listas de conversaciones.»
- **D2 · Origen de los logos.** «Simple Icons (CC0, versión fija) para WhatsApp, Facebook y TikTok; para Instagram, el degradado oficial sobre la misma forma. La alternativa es bajar cada uno del kit de marca de Meta y TikTok.»
- **D3 · WhatsApp también con logo.** «No lo pediste, pero es el canal de la mayoría de los leads. Propongo incluirlo en verde.»
- **D4 · TikTok por `utm_source`.** «Sin migración: solo pinta TikTok cuando el registro web llega con esa marca. Si quieres TikTok como fuente propia, es una migración aparte con su OK.»
- **D5 · Conversaciones con el panel de Chatwoot.** «Recomiendo reusar la Bandeja dentro del CRM. La lista propia queda como mejora futura si hace falta ver la etapa junto a cada chat.»
- **D6 · Vista Lista en esta entrega.** «Pediste "varias vistas". La incluyo en la misma PR, o la dejo para una segunda si prefieres una PR más corta.» Sam aprobó la propuesta tal como estaba: la Lista va en esta PR.

Respuesta de Sam a la propuesta (2026-11-16): «Sí, apruebo la nueva propuesta, me gusta […] quisiera que cuando yo entre a chatear con alguien me abra ventana completa y no media ventana, porque a veces por error oprimen el mouse y se cierra la conversación».

- **D7 · El chat abre a pantalla completa.** La ficha sigue a media pantalla. «Abrir chat» navega a la Bandeja (`/studio/bandeja?c=N&volver=crm`), que es una página: un clic fuera no la cierra y «← Volver al embudo» (o Atrás) regresa al tablero. Aplica D5: la vista «Conversaciones» del CRM es la misma Bandeja a pantalla completa.
- **D8 · La ficha no se cierra con un clic fuera.** Pendiente de respuesta de Sam; no se implementa en esta PR sin su sí.

## Diseño

### 1. Tarjeta compacta (`CrmTableroKanban`)

- Dos líneas: logo del canal + nombre (botón que abre la ficha y vuelve a ser parada de teclado) y, debajo, estado · dueño · días.
- Una sola acción visible: `ActionMenu` de solo icono, 32 × 32 (BTN-01 §7, BRAND BD-037: nada que se oprima baja de 32 px), con «Abrir ficha», «Abrir chat» y las etapas destino («Mover a …»).
- Tercera línea solo cuando existe: tareas (vencidas o abiertas) y «Vino de Leads / Volvió de Clientes».
- El arrastre (DND-01) no cambia. La etapa de cierre sigue pidiendo motivo en `CrmEmbudosClient`.

### 2. Logo por canal

`lib/studio/crm-canal.ts` traduce `fuente` + `utm_source` a un canal:

| fuente | canal | logo |
|---|---|---|
| `whatsapp_leads`, `whatsapp_clientes` | WhatsApp | Simple Icons, `#25D366` |
| `instagram` | Instagram | forma de Simple Icons con el degradado oficial |
| `messenger` | Facebook | Simple Icons, `#0866FF` |
| `portal`, `web_registro`, `cotizador` | Canales DTD | isólogo (primary en claro, reverse en oscuro) |
| `web_registro`, `portal`, `cotizador` con `utm_source` que contiene `tiktok` | TikTok | Simple Icons, con el desplazado cian/rojo de la marca |
| `correo` | Correo | icono `mail` del Studio, sin color |
| `kommo`, `manual`, otra | sin logo | — |

Cada logo lleva su nombre como `aria-label` y `title`: el canal no depende solo del color (BRAND §Accesibilidad, WCAG 1.4.1). Formas de Simple Icons 15.22.0 (CC0); las marcas siguen siendo de sus dueños y se usan solo para identificar el canal.

### 3. Ancho completo y vistas

- En Embudos, `KommoClient` deja su tope de 1.280 px y el contenedor del Studio deja el suyo (`.studio-content:has([data-ancho-completo])`). Las demás pantallas no cambian.
- Las columnas usan `grid-auto-columns: minmax(232px, 1fr)`: llenan el ancho y, si no caben, el tablero se desplaza en horizontal como antes.
- Selector de vista dentro de Embudos: **Tablero** | **Lista**. La Lista es una tabla densa (canal, nombre, etapa, estado, dueño, días, tareas) con las mismas tarjetas ya filtradas por embudo y búsqueda; no hace lecturas nuevas.
- Junto a la pestaña Embudos, un enlace «Conversaciones» abre la Bandeja a pantalla completa (D5, D7).

### 4. Chat a pantalla completa

- `GET /studio/crm/chat/[tarjetaId]` resuelve la conversación y redirige a `/studio/bandeja?c=N&volver=crm`:
  - con ficha (`client_id`): la conversación más reciente de `chatwoot_conversations`, bajo la RLS de quien mira;
  - sin ficha: las conversaciones del contacto en Chatwoot (`chatwoot_contact_id`), con el token del enrutador; la más reciente.
  - Sin conversación, sin permiso o con error, vuelve a `/studio/crm?tab=embudos&chat=sin` y el tablero lo dice.
- La Bandeja respeta sus dos capas (rol + flag `chatwoot_inbox`) y el vínculo del agente; Chatwoot decide qué bandejas ve cada agente. Leer y contestar ocurre en Chatwoot: Studio no copia mensajes.
- Con `volver=crm`, la Bandeja muestra «← Volver al embudo».

## Fuera de alcance

- Lista propia de conversaciones con la API (D5 la deja para después).
- TikTok como `fuente` propia (migración, D4).
- Guardar o mostrar el texto de los mensajes en Studio.
- D8 hasta que Sam responda.

## Criterios de aceptación

1. Una tarjeta de Leads sin tareas mide como mucho 64 px de alto y no tiene ningún control oprimible menor de 32 × 32.
2. El menú de la tarjeta se recorre con flechas, lista las etapas destino de `destinosDe` y mover a una etapa de cierre sigue pidiendo motivo.
3. Cada `fuente` de la tabla de §2 pinta el canal indicado, con nombre accesible; `kommo` y `manual` no pintan logo.
4. `utm_source` con `tiktok` pinta TikTok solo en fuentes web.
5. En Embudos el tablero usa el ancho de la ventana; en otras pantallas el tope de 1.440 px sigue.
6. La vista Lista muestra las mismas tarjetas que el tablero para el embudo y la búsqueda elegidos.
7. «Abrir chat» lleva a la Bandeja en la conversación de esa tarjeta; sin conversación vuelve al tablero con aviso.
8. La Bandeja con `volver=crm` muestra «← Volver al embudo».
9. Sin migraciones, sin lecturas de PII nuevas en el tablero (no se lee teléfono ni BSUID) y sin texto de mensajes en Studio.

## Allowlist

| Archivo | Cambio |
|---|---|
| `docs/specs/0648-crm-embudos-compactos/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0648-crm-embudos-compactos.md` | handoff |
| `BRAND.md` | excepción D1 |
| `lib/studio/crm-canal.ts` | nuevo: fuente + utm → canal |
| `lib/studio/__tests__/crm-canal.test.ts` | nuevo |
| `lib/studio/crm-chat.ts` | nuevo: resolver la conversación de una tarjeta |
| `lib/studio/__tests__/crm-chat.test.ts` | nuevo |
| `lib/studio/crm-tablero.ts` | `fuente` y `utmSource` en `CrmTarjetaTablero` (coordinado con la sesión de segmentos) |
| `lib/studio/crm-tablero-queries.ts` | leer `utm_source` y pasar `fuente`/`utmSource` (coordinado) |
| `app/studio/(app)/crm/_components/CanalLogo.tsx` | nuevo |
| `app/studio/(app)/crm/_components/CrmTableroKanban.tsx` | tarjeta compacta, menú, columnas flexibles |
| `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx` | pruebas de la tarjeta |
| `app/studio/(app)/crm/_components/CrmEmbudosLista.tsx` | nuevo: vista Lista |
| `app/studio/(app)/crm/_components/CrmEmbudosLista.test.tsx` | nuevo |
| `app/studio/(app)/crm/_components/CrmVistaEmbudo.tsx` | nuevo: selector Tablero/Lista y aviso de chat |
| `app/studio/(app)/crm/_components/CrmEmbudosClient.tsx` | solo el bloque que monta el tablero: pasa a `CrmVistaEmbudo` |
| `app/studio/(app)/crm/_components/CrmEmbudosClient.test.tsx` | mover pasa por el menú de la tarjeta (dos pruebas) |
| `app/studio/(app)/crm/_components/TarjetaFichaDrawer.tsx` | botón «Abrir chat» |
| `app/studio/(app)/crm/_components/KommoClient.tsx` | ancho completo en Embudos y enlace «Conversaciones» |
| `app/studio/(app)/crm/chat/[tarjetaId]/route.ts` | nuevo: redirección al chat |
| `app/studio/(app)/bandeja/page.tsx` | lee `volver` |
| `app/studio/(app)/bandeja/_components/BandejaClient.tsx` | «← Volver al embudo» |
| `app/studio/(app)/bandeja/__tests__/BandejaClient.test.tsx` | caso de `volver` |
| `lib/i18n/es-VE/bandeja.ts` | texto «← Volver al embudo» |
| `lib/i18n/zh-CN/bandeja.ts` | el mismo texto en chino |
| `app/studio/(app)/layout.tsx` | clase `studio-content` en el contenedor |
| `app/studio/studio.css` | ancho completo con `:has`, logo DTD por tema |

## Validación

Pendiente: pruebas con turno de PC del Director General, `/ui-check` sobre el diff y capturas antes/después.
