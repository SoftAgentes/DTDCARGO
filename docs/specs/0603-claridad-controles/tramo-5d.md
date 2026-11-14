# SDD-0603 · Tramo 5d · Pestañas, tarjetas y avisos de CRM y Conversaciones

Último tramo del rebrand. Parte del tramo 5 de [la spec](spec.md) («Filas y pantallas propias») y cierra lo que el tramo 2 dejó fuera en el CRM. Aplica BD-037: lo que se oprime lleva relleno o contorno de tinta, lo que avisa es `<Aviso>` (SDD-0628), lo que solo se lee es texto y la selección va con relleno de tinta. Rama `claude/0603-t5d-crm-6a705d`, desde `claude/rebrand-base-main` = `origin/main` `651bdbd73`.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS, tokens ni colores nuevos. No cambian la lógica ni las llamadas a Kommo o a Chatwoot. Los textos visibles no cambian; el único texto nuevo es «Abrir», ya aprobado en la tabla de tramos. Pills, badges y contadores de estado quedan igual.

## Allowlist

Los 8 archivos del encargo, más sus pruebas y documentos:

- `app/studio/(app)/crm/_components/KommoClient.tsx`, `KommoBoardView.tsx`, `LeadDrawer.tsx`, `CrmTableroKanban.tsx`, `DireccionTab.tsx`, `TarjetaFichaDrawer.tsx`
- `app/studio/(app)/conversaciones/_components/ConversationList.tsx`, `ConversationThread.tsx`
- Pruebas vecinas ajustadas: `crm/_components/CrmTableroKanban.test.tsx` (suma el bloque de «Abrir» y arrastre), `conversaciones/__tests__/thread-solo-lectura.test.tsx` (el aviso pasa de `note` a la franja en `status`)
- Nuevas: `conversaciones/_components/ConversationList.abrir.test.tsx`, `app/studio/_components/__tests__/claridad-t5d-contract.test.ts`
- `docs/specs/0603-claridad-controles/tramo-5d.md`, `.agents/handoffs/0603-t5d-crm.md`

## Por archivo

| Archivo | Clasificación | Qué cambia |
|---|---|---|
| `KommoClient.tsx` | Cumple | Las pestañas del CRM (la captura de Sam) pasan a `.studio-tabs` y `.studio-tab`, sin estilo en línea; la activa va con relleno de tinta (`data-activa`). Siguen siendo `tablist` con `aria-selected`. El teléfono de la lista deja el vino: queda como `studio-link-quiet`. **Filas: no aplica.** Las filas de la lista de leads no abren un registro del Studio; el nombre ya es un enlace real a la ficha externa y es la parada de teclado. |
| `KommoBoardView.tsx` | Cumple | El selector de embudo pasa a `.studio-tabs` y `.studio-tab`. **Tarjetas: no aplica**, por lo mismo: la tarjeta no tiene clic y el nombre es un enlace. |
| `LeadDrawer.tsx` | Cumple | El selector de verbo (Asesor, Etiquetas, Nota, Tarea) pasa a `.studio-tabs` y `.studio-tab`. «No se pisó el trabajo del CRM» deja el cajón con borde dorado: es un `Aviso` de atención, compacto, con su título. Las etiquetas por quitar eran botones sin contorno ni alto mínimo: ahora son `studio-chip` (32 px, contorno), con su `Badge` adentro. |
| `CrmTableroKanban.tsx` | Cumple | Cada tarjeta trae «Abrir» (`studio-btn-ghost -sm`, nombre «Abrir ficha de <nombre>») al pie, junto a «Mover a…». El nombre sigue abriendo con el ratón y sale del Tab (`tabIndex={-1}`); deja de anunciarse dos veces. La tarjeta sigue siendo arrastrable; el botón no lo es. |
| `DireccionTab.tsx` | Cumple | «Estos números son parciales.» deja la caja dorada con contorno: es un `Aviso` de atención con título. Pasa de `alert` a `status`, porque llega con la página y no responde a una acción. |
| `TarjetaFichaDrawer.tsx` | Cumple | El error de cargar la ficha pasa a `Aviso` de error con «Reintentar» como acción. Sigue en `alert`: es el panel que se acaba de abrir. Los errores de campo ya usaban `ErrorAlert`. |
| `ConversationList.tsx` | Cumple | Cada fila trae «Abrir» («Abrir conversación de <cliente> por <canal>») a la derecha. Los datos van en un `<button tabIndex={-1}>` que abre con el ratón. La elegida deja el vino: contorno de tinta a la izquierda y su «Abrir» con relleno de tinta (`studio-btn-dark`) y `aria-current`. Los filtros de estado y de canal pasan a `studio-chip` (32 px, contorno, relleno de tinta en el elegido). El buscador gana contorno de campo. **Avisos: no aplica**; «Sin conversaciones con esos filtros.» es un estado vacío, texto. |
| `ConversationThread.tsx` | Cumple | El aviso del hilo del portal en solo lectura deja la caja `note`: es un `Aviso` (informativo, o de atención si no se pudo comprobar la traba). «Caso» pasa a secundario de 32 px, y marcado va con relleno de tinta. Los selectores de agente y estado ganan contorno de campo. Las respuestas rápidas pasan a `studio-chip` (antes 24 px), su botón a `studio-icono-btn`, la caja de respuesta a `studio-input` (recupera el foco visible) y «Enviar» a `studio-btn-primary`, la única acción en vino. El Shipping Mark del encabezado deja el vino. |

### Decisión que conviene revisar: los filtros de Conversaciones

La spec dejó `ConversationList.tsx:123` en la lista «parecen pestañas pero son otro patrón, sin decidir». Este tramo no decide si son pestañas: siguen siendo botones `aria-pressed`. Solo les aplica lo que BD-037 fija para todo filtro («la selección (pestaña, filtro) va con relleno de tinta» y «nada que se oprima baja de 32 px»), con una clase que ya existía (`studio-chip`, SDD-0274). Medían 23 y 20 px, sin contorno, y marcaban el elegido con vino o con el color del canal. Los chips de canal pierden el color por canal; el punto de color de cada fila lo conserva. Si se prefiere dejarlos como estaban, como hizo el tramo 5c con Documentos, se revierte ese bloque sin tocar el resto.

### Excepciones que quedan, contadas en el contrato

- `role` crudo: el canal de anuncio del arrastre del kanban (`status` con `aria-live`, DND-01) y «Moviendo…» (status, texto); «Cargando la ficha…» (status, texto).
- Vino en línea: la columna del kanban mientras se arrastra una tarjeta encima (igual que en Bitácora); un KPI y la primera barra de la cartera en Dirección (color de dato); el contador de sin leer de la lista (pastilla de estado); la burbuja del mensaje saliente (identidad, no se oprime).

## Roles vivos

- `alert`: solo el error de cargar la ficha de la tarjeta, que responde a abrir el panel o a «Reintentar».
- `status`: «Estos números son parciales.» (llega con la página), «No se pisó el trabajo del CRM» (llega al abrir el panel) y el aviso del hilo del portal (llega al abrir la conversación).
- El hilo de mensajes no es una región viva y el contrato lo vigila: un mensaje entrante no se anuncia solo. El enlace «Responder en la Bandeja →» queda fuera del `Aviso`, porque depende de la carga del hilo, que se repite con cada mensaje; dentro de la región viva queda solo el texto fijo.
- Nada que cambie con cada tecla está en una región viva: el buscador, la caja de respuesta y las etiquetas no lo están.
- Ningún dato sensible quedó en región viva. Los nombres de cliente van en el `aria-label` de «Abrir», que no es una región viva y ya estaba en pantalla.
- «Reintentar» de `LeadDrawer` cambia a «…» mientras corre, dentro del `status`. Ya era así antes del tramo (la caja ya era `status`); cambia por una acción, no por una tecla.

## Aceptación

- Las tres pestañas del CRM usan `.studio-tabs` y `.studio-tab`, sin estilo en línea, con nombre, `aria-selected` y `data-activa`.
- Kanban y Conversaciones: un «Abrir» por tarjeta o fila con clases de secundario, enfocable y con nombre que dice qué abre; el nombre o la fila no son parada de Tab; Enter sobre «Abrir» abre lo mismo que el clic. Lo vigilan `CrmTableroKanban.test.tsx` y `ConversationList.abrir.test.tsx`.
- Arrastre del kanban: la tarjeta sigue con `draggable`, el botón no; un arrastre que empieza sobre «Abrir» mueve la tarjeta y no abre la ficha; el clic fantasma al soltar se descarta.
- `claridad-t5d-contract.test.ts` cuenta por archivo, sin comentarios: `<Aviso`, `role` crudo, `aria-live`, contorno de estado, «Abrir», `tabIndex={-1}`, `tablist`, `tab` y vino en línea. Total del grupo: 4 `<Aviso>` y 3 grupos de pestañas.
- Mutantes que deben morir: `<Aviso>` → `<p>`; volver la caja con contorno; quitar el import canónico; pestaña con estilo en línea, sin la clase o sin `data-activa`; `tablist` sin la clase; el nombre de la tarjeta otra vez en el Tab; la fila elegida otra vez en vino; el aviso del hilo otra vez como `note`; el hilo de mensajes como región viva. Y dos que prueban que los comentarios no cuentan.
- Nada que se oprima baja de 32 px: `.studio-tab` (36/32), «Abrir» `-sm` (36/32), «Caso» `-xs` (32), `studio-chip` (32) y `studio-icono-btn` (36/32).

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: todo lo nuevo es secundario. «Enviar» ya era la acción en vino del hilo; ahora usa la clase del primario. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple: avisos por tono de `Aviso`; selección en tinta (excepción aprobada de la spec). «Caso» marcado deja el rojo en el botón; el estado lo sigue diciendo el `Badge` rojo del encabezado. |
| Contraste | Cumple por herencia: `.studio-tab`, `--ctl-border`, `studio-btn-dark`, `studio-chip`, `studio-icono-btn`, `studio-input` y `.studio-aviso*`, ya medidos por `claridad-controles-contract`, `pestanas-contract`, `avisos-contract` y `dark-theme-contrast-contract`. El contorno de campo en línea usa `--ink-soft` (5,33:1 en claro, 6,86:1 en oscuro). |
| Tokens | Cumple: ninguno nuevo, ningún color nuevo, sin CSS. |
| Estados sin color | Cumple: cada aviso lleva icono; la elegida lleva `aria-current` y el filtro `aria-pressed`, además del relleno. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla (ver Límites). |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Pendientes fuera de este tramo

- `pestanas-contract.test.ts` todavía excluye `app/studio/(app)/crm/` entero (`PENDIENTES`). Los tres archivos de este tramo ya cumplen su forma, pero quitar la exclusión toca ese contrato, que no está en la allowlist, y antes hay que medir el resto de `crm/` (por ejemplo `RecoveryTab.tsx` y `CrmEmbudosClient.tsx`).
- Otros archivos de `crm/` fuera de la allowlist no se revisaron: `StageControl.tsx`, `LeadActionsButton.tsx`, `ConvertLeadDrawer.tsx`, `RecoveryTab.tsx`, `CrmEmbudosClient.tsx`, `StageMapConfig.tsx`, `MarkboxFieldConfig.tsx`, y `CrmEmbudosSlot.tsx` (en la PR abierta #509).
- `ConversacionesClient.tsx` y `GenerateDigestsPanel.tsx` tampoco estaban en la allowlist.

## Límites

- No se vio en pantalla con datos: se revisa en la imagen de prueba antes de fusionar, en claro, en oscuro y en compacto.
- La fila de Conversaciones pierde unos 90 px de ancho para «Abrir»: el nombre y la vista previa cortan antes con puntos suspensivos. La lista mide 360 px.
- Los chips de filtro suben de 11 a 13,5 px. Estimado con el ancho de letra, los cuatro de estado y los cuatro de canal caben en una línea de 332 px; si no, envuelven.
- La caja de respuesta pasa de 38 a 40 px (36 en compacto) y «Enviar» de 38 a 40 (36 en compacto).
- El buscador de la lista sigue sin anillo de foco propio (`outline: none` en el campo interno, anterior a este tramo). Arreglarlo pide CSS.
- Las pestañas de Kommo (`KommoBoardView`, la lista de leads, `LeadDrawer`, Dirección) están ocultas desde SDD-0614 S0. Se dejaron conformes igual, porque el código sigue ahí hasta 8.7; en la imagen de prueba se ven solo las pestañas del CRM y los Embudos.
