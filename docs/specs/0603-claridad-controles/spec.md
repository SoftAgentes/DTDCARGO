---
sdd: "0603"
title: "Claridad de controles: qué se oprime, qué avisa y qué solo se lee"
status: in-progress
author: "Claude"
created: 2026-11-04
updated: 2026-11-04
supersedes: null
superseded_by: null
related: ["0120", "0441"]
confidencialidad: interno
---

# SDD-0603 — Claridad de controles: qué se oprime, qué avisa y qué solo se lee

> En el Studio y el portal no se distingue un botón de un mensaje. Quien opera tiene que saber dónde oprimir sin leer cada palabra.

## Contexto

**Pedido de Sam, 2026-11-04, literal, en el chat de la sesión hija de Director General:**

- «estoy viendo los botones muy pálidos. O sea, entre saber qué oprimir y qué es mensaje»
- Sobre una captura del CRM: «Es una issue del CRM, adentro de eso, y se ve muy pálido. [...] La idea es que lo hagamos en todo el ERP completo, más que en la página web, en el ERP y en el portal del cliente.»
- Tras verlo en prueba, por botón: «Prepara la adopción». Por texto: «Me gusta. Prepara todo y adopción».
- Por selector, viendo el BRAND-CHECK y el texto exacto de BD-037: «Apruebo, en azul (Recommended)». Como siguiente tramo: «Pestañas (Recommended)».
- Por chat, tras comparar Normal y Compacto: «que damos con compacto y prederteminado ocuro». Se lee como compacto y oscuro por defecto en el Studio.

Cubre preparar. No cubre fusionar ni publicar: para fusionar, el Director General pide un OK aparte con el tramo a la vista.

**Causa medida** en el DOM, sobre la tarjeta o el panel, en claro y oscuro:

| Qué | Antes | Después |
|---|---|---|
| Contorno del botón secundario (mínimo 3:1) | 1,48 / 1,54 | 16,49 / 13,08 |
| Contorno de un campo (mínimo 3:1) | 1,48 / 1,54 | 5,33 / 6,86 |
| Botón `xs`, alto y letra | 24 px, 10,5 px | 32 px, 13 px |

Además, botones secundarios, avisos y estados compartían el mismo cajón claro con borde fino. `Badge` tenía la forma de un botón pequeño. Otros: `.studio-btn-warning` llevaba blanco sobre oro (3,14:1), y había tres colores inventados en hovers de botón.

**Verificado en prueba** con imágenes de `codex/rediseno-studio-prueba`, que no se fusiona nunca. Recorridas 43 rutas del Studio y 15 del portal con los datos tapados y sin escribir; todas respondieron HTTP 200. La medida de controles sin señal aplica a esa rama, no a este tramo.

## La regla

1. **Lo que se oprime** lleva relleno o contorno de tinta, sombra y un verbo.
2. **Lo que avisa** es una franja plana con icono, sin contorno ni sombra.
3. **Lo que solo se lee** es texto, sin cajón.

Las tarjetas conservan su borde suave: el contorno fuerte queda para lo oprimible. Solo tokens del sistema; ningún color nuevo.

## Decisión de marca

Cambia la apariencia respecto al Norte, que es la fuente de apariencia. Aprobada por Sam y registrada en `docs/design/studio/_norte/BRAND-DECISIONS.md` y `BRAND.md`:

> **BD-037 · Claridad de controles (Studio y Portal).** Lo que se oprime lleva relleno o contorno de tinta; lo que avisa es una franja plana sin contorno; los estados son texto con icono, sin cajón. El vino queda para la acción principal y la identidad. La selección (pestaña, filtro) va con relleno de tinta; en el menú lateral, blanco con icono vino. La vista predeterminada es compacta y en tema oscuro; cada persona puede cambiarlas. Nada que se oprima baja de 32 px.

**BRAND-CHECK.** VIS-01 §3 y BRAND §Estados asignan la selección al vino. Aquí va en tinta, porque un relleno vino en cada pestaña compite con la acción principal y rompe el límite de una acción E4 por contexto (VIS-01 §5). Sam vio esta versión en prueba y la aprobó. Superficie: Studio y Portal. Tokens: `--ink`, `--ink-inv`. Contraste: 16,49:1 en claro, 13,08:1 en oscuro. Revisión de la excepción: al cerrar el tramo de pestañas.

## Tramos

AGENT-BRIEF prohíbe el barrido masivo: la adopción avanza por tramos, cada uno con su PR. Crear un componente nuevo sigue CMP-01 y puede pedir su propio SDD; lo asigna el Director.

| Tramo | Qué | Alcance |
|---|---|---|
| **1** | Piezas compartidas del Studio | Este documento |
| 2 | Pestañas (el siguiente, por decisión de Sam) | Una sola clase, `.studio-tab`, que ya existía (SDD-0274). Ver abajo; el CRM va después |
| 3 | Portal del cliente | `.btn-ghost`, campos, estados, sub-pestañas, filtros y enlaces, solo bajo `.portal-sys` |
| 4 | Avisos | Componente único; 59 archivos pintan avisos con fondo de estado y 116 usan `role="alert"` |
| 5 | Filas y pantallas propias | «Abrir» en Embarques y Cobranzas, Dashboard, Contabilidad, Tracking, Almacén CN, Documentos y CRM |

**Fuera de Tramo 1, a propósito:** las pantallas del CRM, porque las tandas de Chatwoot pendientes trabajan ahí; y lo que en la rama de prueba se resolvió con `!important` y selectores sobre el estilo en línea. Esos atajos no se adoptan: los reemplazan los tramos 2 y 4.

**Consecuencia para Sam:** con solo el Tramo 1, las pestañas de la captura del CRM siguen como hoy; lo que cambia ahí son botones, campos, estados y menú lateral. Se arreglan en el tramo de pestañas, cuando Chatwoot termine en el CRM.

## Tramo 1

### Allowlist

- `app/studio/studio.css`, `app/studio/tokens.css`
- `app/studio/_components/ui/`: `Badge.tsx`, `Badge.test.tsx`, `ErrorAlert.tsx`, `KpiCard.tsx`, `SegmentedControl.tsx`, `ActionMenu.tsx`, `drawer/DrawerShell.tsx`
- `app/studio/(app)/_components/`: `StudioSidebar.tsx`, `StudioTopbar.tsx`, `NotificationBell.tsx`, `ConversationsIndicator.tsx`, `DensityToggle.tsx`, `DensityToggle.test.tsx`
- `app/studio/_components/__tests__/claridad-controles-contract.test.ts`, `app/studio/_components/__tests__/apariencia-predeterminada.test.ts`
- `app/studio/layout.tsx`, `app/studio/_components/appearance-prefs.ts`, `app/studio/(app)/admin/_components/AppearanceSection.tsx`
- `app/studio/CLAUDE.md`, `docs/governance/components/segmented-control.json`, `docs/governance/generated/`
- `docs/specs/0603-claridad-controles/spec.md`, `docs/specs/README.md`, `.agents/handoffs/0603-claridad-controles.md`
- `BRAND.md`, `docs/design/studio/_norte/BRAND-DECISIONS.md`

Sin migraciones, rutas, acciones de servidor, permisos ni dependencias nuevas. No entran Tailwind, motion ni lenis.

### Aceptación

- El contorno del secundario y de los campos mide al menos 3:1 contra la tarjeta, en claro y oscuro. Lo vigila `claridad-controles-contract.test.ts`.
- El texto de cada botón con relleno mide al menos 4,5:1 en los dos temas.
- Nada que se oprima baja de 32 px, tampoco en la vista compacta.
- `Badge` no pinta fondo, relleno ni borde redondeado.
- «Compacto» se aplica al momento, se recuerda por navegador y comparte la preferencia de Administración › Apariencia (SDD-0120).
- Sin elección previa, el Studio abre compacto y oscuro. Quien ya eligió otra cosa la conserva.
- Lo impreso sale en claro, por CSS (`tokens.css`), también al generar un PDF. Los paneles dentro de Chatwoot (`/studio/ficha-chat`, `/studio/cerrar-chat`) no reciben tema ni densidad: siguen a Chatwoot.
- En la imagen de prueba, medido en Chromium real: un PDF de una pantalla del Studio se lee sobre papel blanco; las dos rutas de Chatwoot no llevan `data-theme` ni `data-density`; la carga no parpadea en claro.
- Sin colores inventados en las reglas de botón.

### Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: el contorno sube los secundarios, y el primario sigue siendo el único relleno vino. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | **Excepción aprobada por Sam:** selección en tinta. Ver BRAND-CHECK. |
| Contraste | Cumple: medido y vigilado por contrato. |
| Tokens | Cumple. Dos tokens nuevos de medida, `--sb-item-y` y `--kpi-fs`; ningún color. |
| Estados sin color | Cumple: `Badge` conserva texto e icono. |
| Light/dark | Cumple en contrato. Falta recorrer en oscuro todas las pantallas: ver Límites. |
| Móvil | **No conformidad previa, sin resolver:** a 375 px el menú lateral del Studio ocupa casi toda la pantalla y el CRM desborda 145 px. Este tramo no cambia su ancho. |
| Movimiento reducido | Cumple: la transición es de color; `transform` de 1 px al oprimir. |

## Tramo 2 · Pestañas

Rama `codex/0603-t2-pestanas`, partiendo del tramo 1. Sin PR hasta que el tramo 1 esté en `main`.

**Sin componente nuevo.** Reutiliza `.studio-tab`, y agrega el contenedor `.studio-tabs`. Así no suma una pieza a CMP-01.

**Dos semánticas, una forma.** Los grupos que ya eran `tablist` siguen siéndolo. Los 12 hechos a mano nunca lo fueron y no tienen flechas ni `tabpanel`, que A11Y-01 §11 exige a un `tablist`: quedan como `role="group"` con botones `aria-pressed`. Se ven igual. Ser pestañas formales sería otro cambio, de comportamiento.

**No es solo visual.** En esos 12 grupos cambia lo que anuncia un lector de pantalla: antes eran botones sin estado, y ahora se anuncian como grupo con nombre y botones presionados o no. Es una mejora, pero un cambio de lo que oye quien lo usa. No cambia el orden de foco ni el teclado.

**Nombres accesibles nuevos.** Son el único texto que agrega el tramo, y solo lo oye un lector de pantalla; no se ve. A11Y-01 pide nombre para todo grupo y `tablist`, y estos no lo tenían:

- Grupos (`role="group"`): «Secciones de contabilidad», «Secciones del editor» (Dashboard), «Embarques por estado», «Facturas por estado», «Secciones de fidelización», «Tipo de gasto», «Secciones del informe» (Inspecciones), «Secciones de naviera», «Secciones de nómina», «Compras y prealertas», «Secciones de proveedores», «Secciones de tesorería».
- `tablist` que ya existían sin nombre: «Secciones de rutas», «Secciones del bug», «Secciones de la cola de QR», «Secciones de costeo y margen», «Secciones del financiero China», «Líneas por estado de conciliación», «Reportes de la categoría», «Secciones de SENIAT», «Secciones de transporte» (TMS), «Secciones del perfil».

El contrato exige nombre en cada contenedor `.studio-tabs`.

**Foco.** El anillo de `.studio-tab` va por fuera, separado 2 px: la activa va rellena con `--ink`, igual que el anillo, y por dentro no se veía (WCAG 2.4.7, hallado en la revisión independiente de la PR).

**Los tramos se ven juntos, se fusionan por separado.** La imagen de prueba sale de esta rama, que contiene el tramo 1: Sam ve los dos a la vez, y el tramo 1 solo no lo ve nadie. Cada tramo lleva su `verify` sobre su SHA final.

**Fuera, a propósito:**
- CRM: `KommoClient.tsx`, `KommoBoardView.tsx`, `LeadDrawer.tsx`, hasta que termine Chatwoot. Son las pestañas de la captura de Sam, y este tramo no las cambia todavía.
- Parecen pestañas pero son otro patrón, sin decidir: `ReportesClient.tsx:363` (nivel 1, con opciones deshabilitadas), `InventarioClient.tsx:72`, `ConversationList.tsx:123`, `DocumentosHubClient.tsx:365`, `DiplomasClient.tsx:90`, `ComposeView.tsx:243`, `DispatchDashboardClient.tsx:72`, `LangToggle.tsx:69`.

**Riesgo visual, sin medir todavía:** los selectores compactos, como período del Dashboard, vista del Calendario, Bitácora, Bugs y Mailing, crecen con `.studio-tab`. Las pestañas de Nómina son 11 o más y ahora envuelven en varias líneas. Se revisa en una imagen de prueba antes de fusionar.

### Allowlist del tramo 2

- `app/studio/studio.css`, `app/studio/_components/__tests__/pestanas-contract.test.ts`
- `docs/specs/0603-claridad-controles/spec.md`, `docs/specs/README.md`, `.agents/handoffs/0603-t2-pestanas.md`
- `app/studio/(app)/academia/_components/AcademiaClient.tsx`
- `app/studio/(app)/admin/_components/PortalBackfillSection.tsx`
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/agentes/page.tsx`
- `app/studio/(app)/admin/rutas/_components/RoutesClient.tsx`
- `app/studio/(app)/bitacora/_components/BitacoraClient.tsx`
- `app/studio/(app)/bitacora/_components/BoardList.tsx`
- `app/studio/(app)/bitacora/nueva/_components/NuevaReunionClient.tsx`
- `app/studio/(app)/bugs/_components/BugDrawer.tsx`
- `app/studio/(app)/bugs/_components/BugsAdminClient.tsx`
- `app/studio/(app)/calendario/_components/CalendarClient.tsx`
- `app/studio/(app)/club/_components/ClubClient.tsx`
- `app/studio/(app)/cola-qr/_components/QrQueueClient.tsx`
- `app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx`
- `app/studio/(app)/costing/_components/CostingClient.tsx`
- `app/studio/(app)/dashboard/_components/DashboardEditorDrawer.tsx`
- `app/studio/(app)/dashboard/_components/DashboardWidgets.tsx`
- `app/studio/(app)/debug/_components/DebugTabs.tsx`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/(app)/facturacion/_components/FacturacionClient.tsx`
- `app/studio/(app)/fidelizacion/_components/FidelizacionClient.tsx`
- `app/studio/(app)/financiero-china/_components/FinancieroChinaClient.tsx`
- `app/studio/(app)/financiero-china/_components/StatementDetail.tsx`
- `app/studio/(app)/fiscal/_components/FiscalClient.tsx`
- `app/studio/(app)/gastos/_components/GastosClient.tsx`
- `app/studio/(app)/inspecciones/_components/ReportEditor.tsx`
- `app/studio/(app)/mailing/_components/MailingClient.tsx`
- `app/studio/(app)/mailing/_components/TemplateEditorDrawer.tsx`
- `app/studio/(app)/naviera/_components/NavieraClient.tsx`
- `app/studio/(app)/nomina/_components/NominaClient.tsx`
- `app/studio/(app)/ordenes-compra/_components/OrdenesCompraClient.tsx`
- `app/studio/(app)/proveedores/_components/ProveedoresClient.tsx`
- `app/studio/(app)/reportes/_components/ReportesClient.tsx`
- `app/studio/(app)/seniat/_components/SeniatClient.tsx`
- `app/studio/(app)/servicios/_components/ServicioDrawer.tsx`
- `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx`
- `app/studio/(app)/tms/_components/TmsClient.tsx`
- `app/studio/(app)/usuarios/_components/UsersClient.tsx`
- `app/studio/_components/wiring/ProfileModal.tsx`

### Aceptación del tramo 2

- Todo `tablist` del Studio, salvo el CRM, usa `.studio-tabs`, y cada pestaña formal usa `.studio-tab` sin estilo en línea. Lo vigila `pestanas-contract.test.ts`.
- Ningún grupo nuevo se declara `tablist` sin cumplir A11Y-01 §11.
- La activa se distingue por relleno de tinta y por `aria-selected` o `aria-pressed`, no solo por color.
- Las pestañas envuelven en pantallas angostas, sin recorte (A11Y-01 §13).
- No cambia ningún `onClick`, texto visible, orden ni ruta. Los únicos textos nuevos son los nombres accesibles de la lista de arriba.

## Límites

- **Oscuro por defecto sube el riesgo:** hasta ahora, en oscuro solo se revisó el CRM y un detalle de embarque en la rama de prueba. Una pantalla con colores fijos puede verse mal, y se recorre entera en la imagen de este tramo antes de fusionar. Lo impreso se comprueba en esa misma pasada.
- `pnpm verify` se corre con turno del Director.
- Sin PR hasta que el Director dé turno. La publicación a producción sigue congelada.
- `Badge` lleva letra de 12 a 13,5 px en lugar de 9,5 a 11,5, pero pierde su relleno lateral. Medido con Nunito Sans real: el estado más largo, «En bodega VE», pasa de 97,8 a 99,9 px en tamaño `sm`, y mide 107,2 px en `md`. No se midió pantalla por pantalla; se comprueba en prueba antes de fusionar.
