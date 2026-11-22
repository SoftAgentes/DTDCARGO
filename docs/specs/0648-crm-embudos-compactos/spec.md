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
  - **Ajuste por la SDD-0655 (en main desde el 2026-11-17):** la Bandeja pasó a ser la pestaña «Bandeja» del CRM, con la cabecera y las pestañas del CRM arriba. Esa pestaña cumple D5 y trae «Embudos» para volver, así que esta PR ya no agrega el enlace «Conversaciones», ni `?volver=crm`, ni «← Volver al embudo».
- **D8 · La ficha no se cierra con un clic fuera.** Resuelta el 2026-11-17: a la pregunta «¿la ficha del CRM deja de cerrarse con un clic fuera?», Sam respondió «Sí, que no se cierre» (por el chat del Director General). La ficha se cierra solo con su botón «Cerrar» o con Escape, y el foco vuelve a lo que la abrió. Va en la PR de seguimiento de la #628: `DrawerShell` suma `closeOnBackdrop` (por defecto `true`, así los demás drawers no cambian) y `TarjetaFichaDrawer` lo pasa en `false`.

## Diseño

### 1. Tarjeta compacta (`CrmTableroKanban`)

- Dos líneas: logo del canal + nombre y, debajo, estado · dueño · días. El nombre abre la ficha con el ratón en una zona de 32 px y sale del Tab (`tabIndex={-1}`).
- Dos acciones visibles, en la misma fila: «Abrir ›» (`studio-btn-ghost sm`, la parada de teclado y de lector que exige el contrato SDD-0603 tramo 5d) y un `ActionMenu` «⋯» de solo icono, 32 × 32 (BTN-01 §7, BRAND BD-037: nada que se oprima baja de 32 px), con «Abrir ficha», «Abrir chat» y las etapas destino («Mover a …»).
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
| `carga_erp` (0553, SDD-0647) | Canales DTD | isólogo: cliente de la casa, sin canal de terceros |
| `correo` | Correo | icono `mail` del Studio, sin color |
| `kommo`, `manual`, otra | sin logo | — |

Cada logo lleva su nombre como `aria-label` y `title`: el canal no depende solo del color (BRAND §Accesibilidad, WCAG 1.4.1). Formas de Simple Icons 15.22.0 (CC0); las marcas siguen siendo de sus dueños y se usan solo para identificar el canal.

### 3. Ancho completo y vistas

- En Embudos, `KommoClient` deja su tope de 1.280 px y el contenedor del Studio deja el suyo (`.studio-content:has([data-ancho-completo])`). Las demás pantallas no cambian.
- Las columnas usan `grid-auto-columns: minmax(232px, 1fr)`: llenan el ancho y, si no caben, el tablero se desplaza en horizontal como antes.
- Selector de vista dentro de Embudos: **Tablero** | **Lista**. La Lista es una tabla densa (canal, nombre, etapa, estado, dueño, días, tareas) con las mismas tarjetas ya filtradas por embudo y búsqueda; no hace lecturas nuevas.
- Las conversaciones (D5) son la pestaña «Bandeja» del CRM que trajo la SDD-0655; esta PR no agrega un enlace propio.

### 4. Chat a pantalla completa

- `GET /studio/crm/chat/[tarjetaId]` resuelve la conversación y redirige a `/studio/bandeja?c=N` (pestaña Bandeja del CRM, SDD-0655):
  - con ficha (`client_id`): la conversación más reciente de `chatwoot_conversations`, bajo la RLS de quien mira;
  - sin ficha: las conversaciones del contacto en Chatwoot (`chatwoot_contact_id`), con el token del enrutador; la más reciente.
  - Sin sesión o sin el módulo del CRM (`kommo`): `/studio/dashboard?denied=kommo`, igual que `requireModuleView`.
  - Con CRM pero sin entrada a la Bandeja (rol `bandeja` o flag `chatwoot_inbox` apagado): `/studio/crm?tab=embudos&chat=sin_bandeja`, con aviso.
  - Id que no es UUID, tarjeta que la RLS no deja ver o sin conversación: `chat=sin`, con aviso.
  - Error de la base o de Chatwoot: `chat=error`, con aviso.
- «Abrir chat» (tarjeta y ficha) solo se muestra si `puedeAbrirBandeja` da sí: es `accesoCrm(…).bandeja` de la SDD-0655 (módulo `bandeja` por rol + flag `chatwoot_inbox`), la misma regla que muestra la pestaña Bandeja. Lo calcula `CrmEmbudosSlot` en el servidor y lo pasa por contexto (`ChatPermitido`); sin proveedor vale `false`.
- La Bandeja respeta sus dos capas (rol + flag `chatwoot_inbox`) y el vínculo del agente; Chatwoot decide qué bandejas ve cada agente. Leer y contestar ocurre en Chatwoot: Studio no copia mensajes.

## Dependencia

`fuente` y `utmSource` en `CrmTarjetaTablero` llegan con la SDD-0647 (PR #621, rama `claude/sdd-0647-crm-segmentos`),
que esta rama trae por merge. Esta PR se fusiona después de la #621.

## Fuera de alcance

- Lista propia de conversaciones con la API (D5 la deja para después).
- TikTok como `fuente` propia (migración, D4).
- Guardar o mostrar el texto de los mensajes en Studio.

## Criterios de aceptación

1. Una tarjeta de Leads sin tareas mide como mucho 64 px de alto y no tiene ningún control oprimible menor de 32 × 32.
2. El menú de la tarjeta se recorre con flechas, lista las etapas destino de `destinosDe` y mover a una etapa de cierre sigue pidiendo motivo.
3. Cada `fuente` de la tabla de §2 pinta el canal indicado, con nombre accesible; `kommo` y `manual` no pintan logo.
4. `utm_source` con `tiktok` pinta TikTok solo en fuentes web.
5. En Embudos el tablero usa el ancho de la ventana; en otras pantallas el tope de 1.440 px sigue.
6. La vista Lista muestra las mismas tarjetas que el tablero para el embudo y la búsqueda elegidos.
7. «Abrir chat» lleva a la Bandeja en la conversación de esa tarjeta; sin conversación vuelve al tablero con aviso.
7b. Quien no puede entrar a la Bandeja no ve «Abrir chat», y si abre la ruta a mano recibe el aviso `sin_bandeja`, no el rebote al inicio.
8. Desde la Bandeja se vuelve al tablero con la pestaña «Embudos» del CRM (SDD-0655).
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
| `app/studio/(app)/crm/_components/CanalLogo.tsx` | nuevo |
| `app/studio/(app)/crm/_components/CrmTableroKanban.tsx` | tarjeta compacta, menú, columnas flexibles |
| `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx` | pruebas de la tarjeta |
| `app/studio/(app)/crm/_components/CrmEmbudosLista.tsx` | nuevo: vista Lista |
| `app/studio/(app)/crm/_components/CrmEmbudosLista.test.tsx` | nuevo |
| `app/studio/(app)/crm/_components/CrmVistaEmbudo.tsx` | nuevo: selector Tablero/Lista y aviso de chat |
| `app/studio/(app)/crm/_components/CrmEmbudosClient.tsx` | solo el bloque que monta el tablero: pasa a `CrmVistaEmbudo` |
| `app/studio/(app)/crm/_components/CrmEmbudosClient.test.tsx` | mover pasa por el menú de la tarjeta (dos pruebas) |
| `app/studio/(app)/crm/_components/TarjetaFichaDrawer.tsx` | botón «Abrir chat»; D8: `closeOnBackdrop={false}` |
| `app/studio/(app)/crm/_components/TarjetaFichaDrawer.test.tsx` | nuevo (D8): clic fuera no cierra; Escape y «Cerrar» sí; foco al disparador |
| `app/studio/_components/ui/drawer/DrawerShell.tsx` | D8: opción `closeOnBackdrop` (default `true`) |
| `app/studio/(app)/crm/_components/KommoClient.tsx` | ancho completo en Embudos |
| `app/studio/(app)/crm/chat/[tarjetaId]/route.ts` | nuevo: redirección al chat |
| `app/studio/(app)/crm/chat/[tarjetaId]/route.test.ts` | nuevo: sin sesión, sin CRM, sin Bandeja e id inválido |
| `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx` | calcula `puedeAbrirBandeja` y monta `ChatPermitido` |
| `app/studio/(app)/crm/_components/CrmEmbudosSlot.test.tsx` | doble de `puedeAbrirBandeja` |
| `app/studio/(app)/crm/_components/ChatPermitido.tsx` | nuevo: contexto del permiso de chat |
| `app/studio/(app)/crm/_components/CrmVistaEmbudo.test.tsx` | nuevo: selector, vista recordada, avisos de chat, criterio 6 |
| `lib/studio/crm-chat-acceso.ts` | nuevo: `puedeAbrirBandeja`, sobre `accesoCrm` de la SDD-0655 |
| `app/studio/(app)/layout.tsx` | clase `studio-content` en el contenedor |
| `app/studio/studio.css` | ancho completo con `:has`, logo DTD por tema |

## Validación

Worktree propio, `corepack pnpm@11.19.0 install --frozen-lockfile` (la versión de CI), turno de PC del Director General, 2026-11-16, sobre `45e6b8eaf` + la #621 en `f29d95a4f`:

| Comprobación | Resultado |
|---|---|
| vitest `app/studio/(app)/crm`, `app/studio/(app)/bandeja`, `crm-canal`, `crm-chat` | PASÓ: 24 archivos, 333 pruebas |
| `typecheck` | PASÓ |
| eslint del diff | PASÓ: 0 errores; un aviso previo en `KommoClient.tsx:580` |
| `docs:check`, `sdd:check`, `governance:check`, `components:check` | PASÓ |
| merge-tree contra la #621 (`1330e7606`) y contra `main` (`26a9a911e`) | sin conflictos; `1330e7606` traída por merge |
| `pnpm verify` completo | NO EJECUTADO: el portón es CI |
| Capturas antes/después | NO EJECUTADO: el Preview comparte base con producción; el DG la despliega en el entorno de prueba tras la revisión |
| `/ui-check` | EJECUTADO: 1 hallazgo alto (el nombre de la tarjeta medía ~21 px, BD-037 pide 32) y 2 bajos de escala. Sam aprobó aplicarlos; aplicados: el botón abarca las dos líneas con `minHeight: 32`. Vitest y typecheck de este ajuste: en CI (orden del DG, PC ocupada) |
| Revisión independiente (DG, cabeza `1afcd4169`) | sin fugas de seguridad; pidió filtrar el chat por el permiso de Bandeja, pruebas de `CrmVistaEmbudo` y de la ruta, y traer la #621 (`ebc71fc69`). Hecho; vitest, typecheck y eslint de esta ronda corren en CI (orden del DG) |
| Merge de main con la #621 y la SDD-0655 | conflictos resueltos: la Bandeja es pestaña del CRM; se retiran «Conversaciones», `?volver=crm` y «← Volver al embudo»; `studio.css` conserva los dos bloques |
| CI en `3103801e3` | FALLÓ: `claridad-t5d-contract` (SDD-0603 5d) pide «Abrir ›» como parada de teclado; restituido sin tocar el contrato |
| PR de seguimiento (D8 y menores) | pruebas con turno de PC; detalle en su PR |
