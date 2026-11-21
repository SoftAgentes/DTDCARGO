---
sdd: "0686"
title: "Color de acción azul en web, Portal y ERP: el rojo queda para el peligro y el vino para la identidad"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-20
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0603", "0441", "0654", "0687", "0688"]
confidencialidad: interno
---

# SDD-0686 — Color de acción azul en web, Portal y ERP

> El botón principal y el botón de borrar se ven del mismo rojo. Quien opera no debe dudar entre «haz esto» y «cuidado».
> Sin migraciones, sin datos de producción y sin PII. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## Estado (2026-11-20)

**Aprobada por Sam el 2026-11-20** para empezar las fases 0 y 1. Pregunta: «¿Apruebas la spec de la SDD-0686 para empezar con las fases 0 y 1?». Respuesta literal: «Sí, empieza». La aprobación cubre el diseño y la implementación de esas dos fases; no cubre fusionar ni publicar.

**Fase 0 escrita** (BD-076, `BRAND.md`, VIS-01 v1.1, BTN-01 v1.2, nota del Norte, `app/studio/CLAUDE.md`). **Fase 1 escrita** (PR #722, aprobada en revisión independiente sobre `d32d6d3e9`). **Fase 2, grupos 1 y 2, escrita** (PR #736, apilada sobre la #722). Número asignado por el Director General el 2026-11-20 (reserva `codex/sdd-reserve-0686`, `c20842933`). Va primero de tres: SDD-0687 (formato de cifras) y SDD-0688 (simetría de pantallas) siguen después, cada una con su PR.

## 1. Problema

**Pedido de Sam, 2026-11-20, literal, en el chat de la sesión «Rebrand Design»:**

- «El rojo que tenemos, el vino tinto, visualmente la gente lo ve como algo negativo o como borrar.»
- «¿qué otras opciones tenemos para hacer un cambio total en el rojo? Todos estos cambios los vamos a hacer en conjunto, a nivel de portal del cliente y a nivel de ERP».
- Vistas cinco opciones con su contraste: «opcion 2  Completamente todo el proyecto web, portal y ERP; todo el sistema completo.»
- «Si hay que cambiar el branding completo, se puede cambiar. Si hay que eliminar algo que nos pueda dar errores adentro del brand.md, hay que cambiarlo.»

Antecedente del mismo dolor: el 2026-11-17 Sam dijo «El rojo siempre llama como si fuera un error» y aprobó la excepción EXC-0654-01 (vino claro en la Vista simple del Portal, `BRAND.md`).

**Causa medida** (`app/studio/tokens.css`, **C** y **M**):

| Hecho | Medición |
|---|---|
| El vino y el rojo de peligro comparten tono | `--wine` `#7F0F1A` y `--danger` `#A8323E`: ambos a 354°; contrastan 1,61:1 entre sí |
| En tema oscuro el botón principal usa el mismo hex que el peligro del tema claro | `--wine` oscuro = `#A8323E` = `--danger` claro |
| En oscuro, el botón principal casi no se separa de la tarjeta | `#A8323E` sobre `--bg-surface` `#16264A`: 2,26:1 (mínimo 3:1). SDD-0603 lo compensó con un aro (`--ctl-edge-hi`) |
| El Studio abre oscuro por defecto | SDD-0603 / BD-037 |
| El vino también pinta enlaces, pestañas, saldos y KPI | 1.018 usos por token en `app/studio`, 259 en `app/portal`, 612 en la web y `components/`, 131 en `app/m` |

## 2. La regla

1. **Azul = acción.** Botón principal, enlaces, foco y acento de «esto se oprime».
2. **Rojo = peligro y error.** Es el único rojo de la interfaz.
3. **Vino = identidad.** Logo, wordmark «DTD», sello y documentos de marca. No pinta botones, enlaces ni cifras.
4. **Tinta = selección** (pestaña, filtro), como ya fija BD-037, **y cifras** (saldos, KPI, montos). Un saldo va en rojo solo si está vencido.
5. Un estado nunca se comunica solo con color: el peligro conserva icono y verbo (BRAND §Estados).

## 3. Decisión de marca

Cambia la apariencia respecto al Norte. Aprobada por Sam (cita en §1). Se registra como **BD-076** en `docs/design/studio/_norte/BRAND-DECISIONS.md` y en `BRAND.md`.

Por qué BD-076 y no BD-071 (número asignado por el Director General el 2026-11-20, comprobado por valor en todo `origin/main` `2ea18799a`): el registro llega a BD-070, pero BD-071 ya la usa `docs/specs/0654-version-light-portal/spec.md`, y BD-074 y BD-075 están reclamadas en `docs/design/studio/respuesta-cloud-design-2026-08-02-v6-verificacion.md` y en esa misma spec. BD-072 y BD-073 no aparecen en ningún archivo: son huecos y **no se reutilizan**.

**BRAND-CHECK.**

```
Lo que se pide:          azul como color de acción en web, Portal y ERP
Regla que rompe:         BRAND §Sistema de color («--wine: Acento primario · CTAs · links»),
                         regla 1 («cero hex inventados»), VIS-01 §3 («Wine: identidad, selección
                         y acción primaria») y BD-037 («El vino queda para la acción principal»)
Por qué va:              el vino y el peligro comparten tono (354°) y en oscuro comparten hex;
                         Sam lo vio y lo decidió
Alternativa dentro del sistema: tinta (navy/crema), sin colores nuevos; descartada por Sam porque
                         se confunde con la selección
Resultado:               excepción convertida en regla; BD-076; el Norte recibe la enmienda
                         por NORTE-SYNC (el Norte no se edita localmente salvo la nota de enmienda,
                         como en SDD-0441)
```

### Valores propuestos

Misma familia de tono que el navy de la marca (219° frente a 220° de `--ink`). **Tono fijado por Sam el 2026-11-20:** vio tres tonos en claro y en oscuro, junto al rojo de peligro y al vino del logo: A `#2B5FC7`, B `#1F4FA8` y C `#173F8A`. Respondió «eligo la b». Quedan los valores de esta tabla, sin cambios.

| Token (ERP) | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--accion` | `#1F4FA8` | `#7FAAF0` | Relleno del botón principal; acento de acción |
| `--accion-hover` | `#183E86` | `#9BBDF4` | Hover del relleno |
| `--on-accion` | `#FFFFFF` | `#0F1E3D` | Texto e icono sobre el relleno |
| `--accion-text` | `#1F4FA8` | `#7FAAF0` | Acción como texto: enlaces |
| `--accion-tint` | `rgba(31,79,168,0.08)` | `rgba(127,170,240,0.14)` | Fondo suave de acción |
| `--accion-soft` | `#7FAAF0` | `#7FAAF0` | Anillo de foco sobre superficies siempre oscuras (menú lateral) |

En la web, el Portal y el móvil los pares son `--color-accion`, `--color-accion-hover`, `--color-on-accion`, `--color-accion-text`, `--color-accion-tint`, declarados en `app/globals.css` (claro en el tema base y oscuro en `[data-portal-theme="dark"]`).

**Contraste medido** (fórmula WCAG, valores de `tokens.css`):

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `--on-accion` sobre `--accion` | 7,66 | 7,00 | 4,5 |
| `--on-accion` sobre `--accion-hover` | 10,13 | 8,62 | 4,5 |
| `--accion` contra `--bg-surface` (forma) | 7,66 | 6,32 | 3 |
| `--accion` contra `--bg-elevated` (forma) | 6,73 | 5,53 | 3 |
| `--accion-text` sobre `--bg-base` | 7,34 | 7,78 | 4,5 |
| `--accion-text` sobre `--accion-tint` (compuesto sobre la tarjeta) | 6,76 | 4,90 | 4,5 |
| `--accion-soft` contra `--bg-sidebar` (foco) | 7,00 | 8,23 | 3 |

En oscuro el texto sobre el relleno es navy y **no** blanco: blanco sobre `#7FAAF0` mide 2,36:1.

**Límite conocido.** Azul y rojo de peligro tienen luminosidad parecida (1,16:1 en claro): se distinguen por tono, no por claridad. Por eso la regla 5 es obligatoria y un botón destructivo nunca queda como única señal por su color.

## 4. Qué pasa con el vino

- `--wine`, `--wine-deep`, `--wine-soft`, `--wine-text` y `--wine-tint` **se conservan** como tokens de identidad. No se borran: el logo, los documentos y los gradientes de marca los usan.
- Los alias `--studio-wine*` de `app/studio/studio.css:37-39` se retiran cuando su último consumidor pase a `--accion*`.
- Cada uso actual del vino se reparte en tres destinos: **acción** → `--accion*`; **cifra o selección** → `--ink`; **identidad** → se queda.
- **EXC-0654-01** (vino claro en la Vista simple del Portal) se cierra cuando la fase 3 llegue a esa pantalla: la sustituye el azul.

## 5. Fases

AGENT-BRIEF prohíbe el barrido masivo: **una fase, una rama, una PR**. Cada fase fija su allowlist archivo por archivo antes de empezar y la añade a esta spec.

| Fase | Qué | Superficie | Tamaño |
|---|---|---|---|
| **0** | Marca y políticas: BD-076, `BRAND.md`, VIS-01 §3, BTN-01 §2, nota de enmienda en el Norte | Documentos | S |
| **1** | Tokens de acción y clases compartidas del Studio: botón principal, foco, enlaces y acentos de `studio.css`; contratos de contraste | ERP | M |
| **2** | Usos en línea del Studio (`var(--wine…)` en TSX), repartidos en acción, tinta o identidad, por grupos de módulos | ERP | L, en varias PR |
| **3** | Tokens y clases de la web, el Portal y el móvil (`bg-wine`, `text-wine-text`, `var(--color-wine…)`) | Web, Portal, móvil | L, en varias PR |
| **4** | Colores de la familia vino escritos a mano (unos 190) y el inicio de sesión | Todas | M |
| **5** | Documentos y correos de marca, según decida Sam; cierre de EXC-0654-01; NORTE-SYNC | Documentos | M |

### Fase 0 · allowlist

- `docs/specs/0686-rebrand-color-accion-azul/spec.md`, `docs/specs/README.md`
- `BRAND.md`
- `docs/design/studio/_norte/BRAND-DECISIONS.md`
- `docs/design/studio/_norte/CLAUDE.md` (solo la nota de enmienda local al tope de §Sistema de color; el resto llega por NORTE-SYNC)
- `docs/governance/policies/vis-01.md`, `docs/governance/policies/btn-01.md`, `docs/governance/generated/` (lo que regenere `pnpm governance:check`)
- `app/studio/CLAUDE.md` (tabla de variantes: `primary` deja de ser «wine»)
- `docs/governance/README.md` (filas de VIS-01 y BTN-01)
- `.agents/handoffs/0686-rebrand-color-accion-azul.md`
- Observaciones de la revisión de la PR #715, que por orden del Director entran aquí: `.agents/handoffs/rebrand-design-evaluacion-ant-design.md`, `docs/design/rebrand-erp/borrador-sdd-rebrand-sistema.md`, `docs/design/rebrand-erp/checklist-y-color.md` y `docs/design/rebrand-erp/evaluacion-carbon.md`

Líneas de `BRAND.md` que se reescriben (**C**, sobre `main` `2ea18799a`): `:104` (fila «Marca»), `:121-123` y `:145-146` (rol de `--wine`), `:162` (los azules siguen prohibidos **para alertas**; el de acción no es alerta), `:183`, `:186` y `:188-189` (relleno y texto), `:309` (BD-037: «el vino queda para la acción principal»), `:324-325` (variantes de botón y tono de badge) y `:389-398` (EXC-0654-01, que queda con fecha de cierre).

### Fase 1 · allowlist

- `app/studio/tokens.css` (tokens nuevos en claro, oscuro e impresión)
- `app/studio/studio.css` (las 83 líneas que nombran el vino: cada una pasa a acción, a tinta o se queda como identidad, con el motivo en la PR)
- `app/studio/_components/__tests__/claridad-controles-contract.test.ts` (hoy mide `--ink-side-strong` sobre `--wine`, `:93`)
- `app/studio/_components/__tests__/dark-theme-contrast-contract.test.ts`
- `app/studio/_components/__tests__/color-accion-contract.test.ts` (nuevo)
- `docs/specs/0686-rebrand-color-accion-azul/spec.md`, `.agents/handoffs/0686-rebrand-color-accion-azul.md`

Sin tocar ningún TSX: lo que cambia en pantalla tras la fase 1 es todo lo que se pinta por clase (`.studio-btn-primary`, anillos de foco, enlaces y chips de `studio.css`). Los usos en línea siguen en vino hasta la fase 2; **es un estado intermedio visible y aceptado**, y por eso la fase 1 no se publica sola (condición de publicación, §8.1).

### Fase 1 · reparto aplicado en `studio.css` (2026-11-20)

Sin contar comentarios, el vino aparecía en **74 líneas** de declaraciones y queda en **24** (**M**, contando líneas sin comentarios antes y después). Cada una queda con su motivo:

| Destino | Qué | Reglas |
|---|---|---|
| Acción (`--accion*`) | Botón principal (relleno, hover, texto `--on-accion`), todos los anillos de foco (44 reglas `:focus-visible`, ninguna en vino), borde de foco de campos, enlace del aviso, enlace discreto, botón «Hoy» del calendario, restablecer permiso, enlaces de la matriz, hover de fila y de fecha clicables, asa de ancho de columna | `.studio-btn-primary*`, `.studio-input:focus-visible`, `.studio-toast-action`, `.studio-link-quiet`, `.studio-cal-today-btn*`, `.studio-permcell-reset*`, `.studio-mx-link*`, `.studio-row-linkable:hover`, `.studio-date-field__*:hover`, `.studio-col-resize*` y los `:focus-visible` |
| Tinta (selección, BD-037) | Fila seleccionada, opción marcada de la matriz, estado activo del botón fantasma | `.studio-row-selected`, `.studio-mx-opt[aria-checked]`, `.bug-fab-ghost[data-active]`. El fondo es `color-mix(in srgb, var(--ink) 8%, transparent)`: sin color nuevo |
| Tinta (cifras) | Valor KPI con acento en Tracking | `.studio-tracking-ops-kpis dd[data-acento]` |
| Se queda: identidad | Guión del eyebrow; tono «vino» del contador de iconos (lo elige quien lo usa) | `.studio-eyebrow*::before`, `.studio-contador-icono[data-tono="vino"]` |
| Se queda: **pendiente de decisión en la fase 2** | Vista de Tracking en vivo (barra, mapa, hitos, eyebrow, fila resaltada, código); chip de @mención; destello al guardar un permiso; estado y cambio de la matriz de permisos; contador de alerta de pestaña | `.studio-tracking-ops-*`, `.mention-chip`, `studio-permcell-saved`, `.studio-mx-st/chg/dot`, `.studio-tab-n[data-alerta]`. Son datos o estados, no acción; se deciden viendo la pantalla, con su consumidor en TSX |

Alias retirados: `--studio-wine` y `--studio-wine-deep` (su único consumidor era el botón principal). `--studio-wine-soft` se queda para el eyebrow. El foco global de `tokens.css` pasa a `var(--accion)` en los dos temas y desaparece la regla oscura que usaba `--wine-soft`.

### Fase 1 · archivos fuera de la allowlist escrita (anotados el 2026-11-20)

La PR #722 tocó también estos archivos, que la allowlist de arriba no nombra:
- Las cuatro fichas de componentes que pasaron a BTN-01 1.2 y VIS-01 1.1 por `components:check`: `docs/governance/components/action-menu.json`, `aviso.json`, `confirm-dialog.json` y `segmented-control.json`.
- El pedido a Cloud Design (`docs/design/studio/pedido-cloud-design-2026-11-20-azul-de-accion.md`).

Quedan registrados aquí. **Pendiente fuera de la #736:** el foco del campo oscuro (`studio.css:331`, `.studio-input-dark:focus-visible`) conserva un halo rosado (`rgba(194, 116, 127, 0.22)`) junto al borde `--accion-soft`. `studio.css` es de la fase 1 y la #722 está aprobada; se corrige en el próximo tramo que toque `studio.css`.

### Fase 2 · grupo 1 · allowlist y reparto (2026-11-20)

Lo abrió Sam con «Lo que no necesita mi aprobación, avances. Con esto que te di puedes ir avanzando», después de cerrar las decisiones de §10. Va en la rama `claude/sdd-0686-fase2-g1`, apilada sobre la PR de la fase 1. No se fusiona ni se publica sola (§8.1).

**Archivos:**
- Marco del Studio: `StudioSidebar.tsx`, `StudioTopbar.tsx`, `BandejaBadge.tsx` y `comments/CommentItem.tsx`.
- Primitivas: `SegmentedControl`, `KpiCard`, `SplitActionButton`, `DateField`, `DataTable`, `ClientCombobox`, `RealtimeIndicator`, `columns/ColumnConfig` y `Badge` (el tono `wine` queda marcado como obsoleto).
- Dashboard: `page.tsx`, `DashboardWidgets`, `DashboardEditorDrawer`, `RecentActivityCard` y `RecentQuotesCard`.
- Los 19 `<Badge tone="wine">` del Studio, en 18 archivos y con un cambio de una línea cada uno. Rutas bajo `app/studio/`:
  - `(app)/_components/StudioTopbar.tsx`
  - `(app)/academia/_components/AcademiaClient.tsx` y `CourseEditorDrawer.tsx` (dos badges)
  - `(app)/admin/rutas/_components/RoutesClient.tsx`
  - `(app)/clientes/_components/DeliveryAddressesCard.tsx`
  - `(app)/cola-qr/_components/QrQueueClient.tsx`
  - `(app)/crm/_components/ConvertLeadDrawer.tsx`
  - `(app)/etiquetas/_components/LabelGeneratorClient.tsx`
  - `(app)/fidelizacion/_components/FidelizacionClient.tsx`
  - `(app)/ordenes-venta/_components/OrdenesVentaClient.tsx`
  - `(app)/reportes/_components/BuilderView.tsx`
  - `(app)/seniat/_components/CustomsAgentsTab.tsx` y `FilingDetailDrawer.tsx`
  - `(app)/tarifas/_components/TarifasClient.tsx`
  - `(app)/tesoreria/_components/TesoreriaClient.tsx`
  - `(panel)/ficha-chat/_components/FichaDtdView.tsx`
  - `_components/documents/DocsPanel.tsx` (pasa a `success`)
  - `_components/wiring/GenerateBLModal.tsx`
- **Catálogo del dashboard** (revisión independiente de la #736): `lib/studio/dashboard/dashboard-catalog.ts` y `dashboard-kpi-queries.ts`. Tres KPI del catálogo y dos de las consultas pasan de `"wine"` a `"neutral"`. `KpiTone` deja de admitir `"wine"` y `TONE_TO_VALUE_COLOR` pierde esa clave, así que el valor del KPI y el icono del editor (`var(--${meta.tone})`) ya no pueden salir en vino. El contrato lo vigila por variable y trae dos mutantes.
- La enmienda de BD-011 y el contrato nuevo `color-accion-fase2-contract.test.ts`.

| Destino | Qué |
|---|---|
| Acción (`--accion*`) | Anillo de foco y borde al pasar el ratón de `SegmentedControl` (el anillo pasa de un tinte que no llegaba a 3:1 a 2 px de `--accion`); casilla y «Restablecer» de columnas; asa de ancho del menú (`--accion-soft`, sobre navy); enlaces del dashboard; zona donde se suelta un widget, «+» e interruptor del editor del dashboard |
| Tinta (selección, BD-037) | Segmento y tarjeta activos; opción por defecto del botón dividido; día elegido del calendario (texto `--ink-inv`); día de hoy; fila activa de `DataTable`; opción activa del buscador de clientes; botón «Columnas» abierto; reacción propia en comentarios; icono y punto del módulo activo del menú |
| Tinta (cifras, aprobado por Sam) | Barras, etiquetas y KPI «en curso» del dashboard; monto de los estimados; código del embarque en la actividad; KPI destacado en degradado navy (antes vino) |
| Neutro o estado | Estados de viaje en `--info`; «En vivo» en `--success`; contador de la bandeja en una pastilla blanca con tinta fija, como la selección del menú; badges en `neutral` y «Vigente» en `success` |
| Se queda: identidad | Brillo de marca del menú (BD-034), panel de bienvenida del dashboard (BD-034) y eyebrow de `EmptyState` |
| Se queda: por decidir | Tono `wine` de `Avatar`, que son iniciales de persona: no es acción ni cifra |

También corrige el voseo «refrescá» del indicador en vivo, que pasa a «refresca».

### Fase 2 · grupo 2 · operación diaria (2026-11-20)

En la misma rama. Son 104 usos en línea, en 33 archivos de `embarques`, `tracking`, `clientes`, `cn`, `cobranzas`, `facturacion` y `crm`. Ninguno queda en vino. El contrato `color-accion-fase2-contract.test.ts` suma estas siete carpetas, con cero usos permitidos.

| Destino | Qué |
|---|---|
| Acción | Enlaces de documento y su foco; casillas (`accentColor`); botones de texto («Agregar dirección», «Cambiar destino», «Usar esta»); enlaces a duplicados, adjuntos y WhatsApp; el hover de las acciones de recepción; el botón «Traducir»; la columna del kanban donde se suelta una tarjeta |
| Acción con subrayado (regla 6) | El Shipping Mark que, él solo, lleva a la ficha del cliente: en la tabla de embarques y en el panel del embarque |
| Tinta (cifras y datos) | Saldos y KPI «por cobrar» o «pendiente»; montos de la factura; CBM; código del recibo; Shipping Mark que no lleva a ninguna parte; valor de la tarifa; tarjeta del fee |
| Tinta (selección y estado) | Filas y tarjetas elegidas; opción activa del tipo de cliente, del idioma y del titular; botón «ver nombres» encendido; dirección predeterminada; progreso del tracking y su línea de tiempo; completitud de la ficha |
| Neutro | El asterisco de campo obligatorio (`--ink-soft`, porque no es un error), las etiquetas «pendiente», el contador de no leídos, el bloque de traducción y el chino del encabezado del almacén |
| Peligro | La fecha vencida sobre el panel oscuro de la factura (`--color-status-danger-on-dark`) |

Quedan para un grupo siguiente las funciones de `lib/studio` que devuelven el tono `"wine"` a un `<Badge>` por variable (nivel VIP, plan mayorista, ETA del calendario y otras). Cada una necesita su propio reparto por función, y el contrato de hoy solo detecta el literal `tone="wine"`. **Hecho en el grupo 3.**

### Fase 2 · grupo 3 · allowlist y reparto (2026-11-21)

Lo asignó el Director General después de fusionar la #722: «Sigue con la 0686 fase 2, grupo 3: los tonos «wine» de lib/studio y el resto de los módulos». Va en la rama `claude/sdd-0686-fase2-g3`, desde `origin/main` `72d7f04ec`. El grupo 4 será dinero (tesorería, contabilidad, cotizador y afines) y después el resto de los módulos.

**Allowlist (**M**, `git diff --name-only`):**
- **`lib/studio`, 21 archivos de tipos:** cada función o mapa que devolvía `"wine"` como valor. 27 valores en total: `account-types`, `agent-types`, `audit-types`, `bug-types`, `calendar-events-queries`, `calendar-events-types`, `client-types`, `club/club-member-types`, `conversaciones/conversations-types` (canal portal), `documents/types`, `fidelizacion/types`, `inspecciones/types`, `mail-types`, `no-olvidar-types`, `nomina/attendance-types`, `nomina/ficha-empleado`, `nomina/position-types`, `op-calendar-types`, `proveedores/scorecard-types`, `qr-queue-types` y `user-types`. Las uniones de tipo (`| "wine"`) se quedan: no pintan nada y las limpia la fase 3, cuando el móvil deje de usar el tono.
- **Dos pruebas de `lib/studio`** que fijaban el tono viejo: `__tests__/scorecard-types.test.ts` y `conversaciones/__tests__/conversaciones.test.ts`.
- **79 archivos bajo `app/studio/`** (TSX, `.ts` y una hoja `.css`), con su ruta desde `app/studio/`:
  - `(app)/academia` (3): `_components/AcademiaClient.tsx`, `_components/LessonDrawer.tsx`, `diplomas/_components/DiplomasClient.tsx`
  - `(app)/admin` (28): `_components/ApiIntegrationSection.tsx`, `_components/AppearanceSection.tsx`, `_components/CalendarSection.tsx`, `_components/CompanySection.tsx`, `_components/ExchangeRatesSection.tsx`, `_components/ImportExportSection.tsx`, `_components/MasterDataSection.tsx`, `_components/NumberingSection.tsx`, `_components/PortalBackfillSection.tsx`, `_components/WebhookDrawer.tsx`, `_components/WorkflowsSection.tsx`, `_components/calculator/CityDrawer.tsx`, `_components/calculator/TariffDrawer.tsx`, `_components/calculator/TransportistasPanel.tsx`, `_components/calculator/WeightModelExplainer.tsx`, `agentes/[skillSlug]/page.tsx`, `agentes/_components/AgentKpisRow.tsx`, `agentes/_components/RunAgentModal.tsx`, `agentes/_components/RunsTable.tsx`, `agentes/_components/SkillCard.tsx`, `agentes/page.tsx`, `alertas-telegram/_components/TelegramAlertsPanel.tsx`, `notificaciones/_components/NotificationsClient.tsx`, `page.tsx`, `rutas/_components/CityDrawer.tsx`, `rutas/_components/CityPicker.tsx`, `rutas/_components/RouteDrawer.tsx`, `rutas/_components/RoutesClient.tsx`
  - `(app)/bitacora` (8): `_components/AgentQueue.tsx`, `_components/BitacoraClient.tsx`, `_components/BoardKanban.tsx`, `_components/BoardList.tsx`, `_components/ExportMenu.tsx`, `_components/TaskCollabSection.tsx`, `nueva/_components/ActaReview.tsx`, `nueva/_components/NuevaReunionClient.tsx`
  - `(app)/inspecciones` (3): `_components/InspeccionDrawer.tsx`, `_components/InspeccionesClient.tsx`, `_components/report-css.ts`
  - `(app)/mailing` (8): `_components/ComposeView.tsx`, `_components/MailingClient.tsx`, `_components/RulesView.tsx`, `_components/ScheduledView.tsx`, `_components/SignaturesView.tsx`, `_components/TemplateEditorDrawer.tsx`, `_components/TemplatesView.tsx`, `_components/mailing-types.ts`
  - `(app)/marketing` (17): `_components/FrictionReportsPanel.tsx`, `calendario/page.tsx`, `docs/_components/DocsReaderClient.tsx`, `hub/page.tsx`, `newsletter/_components/CampaignComposer.tsx`, `newsletter/page.tsx`, `noticias-web/_components/CategoryDetector.tsx`, `noticias-web/_components/KeywordPanel.tsx`, `noticias-web/_components/NoticiasTabs.tsx`, `noticias-web/_components/PublishModal.tsx`, `noticias-web/_components/RouteIdeaPanel.tsx`, `noticias-web/_components/Step0Brief.tsx`, `noticias-web/_components/Step1Headlines.tsx`, `noticias-web/_components/Step2Outlines.tsx`, `noticias-web/page.tsx`, `noticias-web/publicadas/page.tsx`, `page.tsx`
  - `(app)/usuarios` (3): `_components/InviteUserDrawer.tsx`, `_components/MembersTable.tsx`, `_components/acceso/permisos.css`
  - `_components/bug-reporter` (2): `BugFABButton.tsx`, `BugReportModal.tsx`
  - `_components/documents` (1): `DocsPanel.tsx`
  - `_components/guia` (1): `GuiaMotor.tsx`
  - `_components/wiring` (5): `GenerateBLModal.tsx`, `GlobalSearchModal.tsx`, `OAuthFlowModal.tsx`, `ProfileModal.tsx`, `ShortcutsModal.tsx`
- El contrato nuevo `app/studio/_components/__tests__/color-accion-fase2-g3-contract.test.ts`, esta spec y el handoff.

| Destino | Qué |
|---|---|
| Neutro (`lib/studio`) | Rol admin, tipo de cuenta, modelo Opus del agente, eventos del calendario, nivel del cliente, plan del club, canal portal, tipos de documento, inspecciones, etiquetas de correo, recordatorios, asistencia y cargos de nómina, cola QR |
| Éxito y atención (`lib/studio`) | Canje «aplicado» y nivel Platinum de fidelización → `success` (Platinum así se distingue de Bronze, que es `neutral`); reclamo «abierto» al proveedor → `warning`, porque pide intervención |
| Acción | Enlaces y botones de texto («Editar →», «Ver», «+ Subir nueva versión», «CC», «Agregar ciudad»); casillas (`accentColor`); foco; interruptores encendidos; botón principal de notificaciones; la columna del kanban de bitácora donde se suelta una tarjeta; el aro con el que la Guía señala un control; el hover del buscador global |
| Tinta (selección) | Pestañas, pastillas y tarjetas elegidas (fondo `color-mix(in srgb, var(--ink) 8%, transparent)`, o fondo de tinta con texto `--ink-inv` si el relleno era sólido); opción elegida del esquema de noticias, del diseño de firma y del rol al invitar; versión vigente de un documento; franja lateral del ítem activo |
| Tinta (datos y cifras) | Códigos y variables en mono, porcentaje y barra de avance de la invitación al Portal, conteos, el nombre en el saludo de marketing |
| Neutro (en línea) | Rótulos en mayúscula (`--ink-soft`, como `.studio-eyebrow`), eyebrows con clase (sin color en línea), asterisco de obligatorio, iconos informativos, fichas de icono de agentes y marketing (`--bg-elevated` y tinta), mapas de tono de mailing (sin clave `wine`; el clic del registro de correo pasa a `success`), puntaje bajo de una ruta |
| Atención | «Falta el almacén» en el resumen oscuro de la invitación (`--warning`). **Pendiente:** en claro, `--warning` (`#B8893A`) da 4,14:1 en el extremo `#1F3055` del degradado y 5,24 en `#0F1E3D`; no llega a 4,5 en todo el fondo. No empeora (antes, 3,78 a 4,79). Hace falta un token de atención sobre fondo oscuro fijo, que hoy no existe; no se inventa hex |
| Se queda: identidad | Diploma impreso (26 usos; documento de marca, regla 8, se revisa con los PDF de la fase 4); informe de inspección impreso, wordmark y rótulo del encabezado (2; la banda «muestra» pasa a tinta); franja de la vista previa de la firma de correo (1, regla 8); tarjeta de la Guía con su tinte de marca (6) |

`Avatar`, `Badge` y `EmptyState` son del grupo 1 y no se tocan aquí. Sí se tocan los que llaman a `Avatar` con `color="wine"` dentro del grupo: los responsables del tablero de bitácora, la firma elegida de mailing y el rol marketing de usuarios pasan a `neutral`.

El contrato del grupo 3 ve el vino se escriba como se escriba: `var(--wine…)`, `var(--grad-wine…)`, `var(--color-wine…)`, clases Tailwind (`bg-wine`, `hover:border-wine`…) y tonos `"wine"` por valor, en `.ts`, `.tsx` y `.css`. Congela las cuatro cuentas de identidad (la lista solo baja), mide al menos 150 archivos y al menos un `.css`, y trae un mutante por forma. Quedan fuera de la cuenta, por ser identidad que nombra el token como texto, las variables `--wine:` que declara el diploma para imprimir (`DiplomasClient.tsx:324-325`) y la muestra de paleta de Apariencia (`AppearanceSection.tsx:41-42`). Para `lib/studio` (`.ts` y `.tsx`) exige cero `"wine"` como valor: quita antes las uniones de tipo y las comparaciones, y detecta un valor en la misma línea que una unión. Mide al menos 300 archivos y al menos 10 uniones que todavía lo nombran, y trae dos mutantes. No detecta, y hoy no hay ninguno en el grupo, la variante arbitraria de Tailwind (`[&>svg]:text-wine`), el alias `--studio-wine*` de `studio.css`, un hex de la familia vino escrito a mano (fase 4), un tono armado con plantilla ni un `var(--wine)` de un `.tsx` de `lib/studio` que no sea tono. noticias-web entra a la lista permitida con su acción en vino (12 archivos), hasta la fase 3.

#### Grupo 3 · correcciones de la revisión independiente de la #739 (2026-11-21)

La revisión sobre `a31e77dd3` pidió cambios. Decisión del Director General: el grupo 3 cierra sin vino de acción en sus carpetas, se escriba como se escriba. Lo que se corrigió:

- **Contraste del resumen de la invitación** (`usuarios/_components/InviteUserDrawer.tsx`). El fondo es navy fijo (`#0F1E3D` → `#1F3055`). `--ink-inv-soft` se invierte con el tema y en oscuro quedaba navy sobre navy (1,00 a 1,19:1). El rótulo, el paréntesis de región y el cuerpo de la tarjeta pasan a `--ink-side`, que no cambia con el tema (blanco al 85 %, como el texto del menú lateral). **El cuerpo (`:785`) ya venía igual desde `main`:** se arregla aquí por estar en el mismo bloque.
- **noticias-web** (segunda revisión, sobre `be7ba878d`). Todo su contenido vive en un bloque `data-theme="light"` (`noticias-web/page.tsx:69`, `NoticiasShell.tsx:22`, `ManualPromptModal.tsx:91`, `PublishModal.tsx:226`) y ningún CSS define ese selector. Con el Studio en oscuro, el tema por defecto, los tokens del Studio toman su valor oscuro sobre el fondo claro: `--ink` daba entre 1,00 y 1,14:1. Decisión del Director General, la opción más chica: en noticias-web, solo tokens web fijos, que no cambian con el tema.
  - Titular elegido, pestaña activa, acentos de los títulos, chips de palabras clave, prefijo del titular y chip de categoría pasan a `text-ink` o `var(--color-ink)`: 14,49 a 16,49:1.
  - Asteriscos, iconos, rótulos y el número del titular pasan a `text-grey-500` o `var(--color-grey-500)`: 4,68:1 sobre `grey-100`, 5,11 sobre `paper` y 5,33 sobre blanco.
  - El aviso de sugerencia editorial pasa a `--color-grey-100` con borde `--color-grey-300` y texto `--color-ink`. La opción elegida del esquema pasa a `--color-grey-100` y `--color-ink`. El puntaje bajo de una ruta pasa a `--color-grey-100` y `--color-grey-700`: 11,10:1.
  - **La acción se queda en vino hasta la fase 3:** el botón principal (`bg-wine`), los bordes y textos al pasar el ratón o con foco, y los enlaces de volver (`--color-wine-text`). No hay `--color-accion*` en la web todavía. El contrato los permite archivo por archivo con ese motivo, y la lista solo baja.
  - **Pendiente de la fase 3, con su propia revisión:** un bloque `[data-theme="light"]` en `tokens.css` que devuelva los tokens del Studio a su valor claro, como ya hace `@media print`. Esta PR no toca `tokens.css`.
- **`usuarios/_components/acceso/permisos.css`:**
  - anillos de foco, casilla y enlace pasan a `--accion` y `--accion-text`;
  - las opciones marcadas pasan a la selección en tinta;
  - el cambio pendiente de la matriz pasa a `--warning`;
  - la franja de la barra fija pasa a tinta;
  - la etiqueta «estado» pasa a neutro.
- **Badges y avatares por valor:** el país VE en Empresa, «Enviando» del boletín, el flujo B de la ruta de ideas y el tono del video adjunto en bitácora pasan a `neutral`. `SuccessScreen` de mailing deja el nombre `wine` por `neutral`.
- **Menores:**
  - el comentario de `BugFABButton.tsx`;
  - el parámetro que sobraba en `roleBadgeTone` de No olvidar, que no tiene llamadas;
  - los espacios al final de línea;
  - Platinum, que ahora se distingue de Bronze.

Ninguna carpeta queda fuera del grupo 3: noticias-web es de marketing y `permisos.css` es de usuarios.

#### Grupo 3 · revisión uno por uno de los tonos de `lib/` (2026-11-21)

El Director General pidió revisar cada tono de `lib/` para ver si era identidad o acción, sin hacerlo en automático, y confirmar que ninguno se guarda. En `origin/main` `72d7f04ec` había 53 `"wine"` en `lib/` (**M**): 26 nombran el tono dentro de una unión de tipo y no pintan nada; 27 son valores en `lib/studio` y se revisaron uno por uno; el que queda en `lib/portal/alertas.ts:49` es del Portal y entra en la fase 3.

**Ninguno de los 27 es identidad.** Identidad es la marca, la bienvenida o el sello. Estos tonos marcan una categoría, un rol, un tipo o un estado, y casi todos llegan a un `<Badge>`, donde el tono `wine` está retirado (regla 7: `neutral` si informa, `success` si confirma). No se deja ninguno.

| Archivo | Qué marcaba el vino | Destino | Dónde se pinta |
|---|---|---|---|
| `account-types.ts` | Cuenta de patrimonio (PT) | `neutral` | Badge |
| `agent-types.ts` | Modelo Opus («premium») | `neutral` | Badge |
| `audit-types.ts` | Actor «operario» | `neutral` | Badge |
| `bug-types.ts` | Categoría «sugerencia» | `neutral` | Badge |
| `calendar-events-types.ts` (2) y `calendar-events-queries.ts` (2) | ETA y llegada planificada | `neutral` | Chip del calendario: `toneVar` y `toneBgVar` dan `--ink-soft` y `--neutral-bg` |
| `client-types.ts` | Nivel «premium» | `neutral` | Badge |
| `club/club-member-types.ts` | Plan «mayorista» | `neutral` | Badge |
| `conversaciones/conversations-types.ts` | Canal «portal» | `neutral` | Badge. El portal es un canal de DTD, pero el badge informa el canal, no es la marca |
| `documents/types.ts` | Carpeta «Logísticas» | `neutral` | `var(--neutral-bg)` y `var(--neutral)`; los dos tokens existen en claro, oscuro e impresión |
| `fidelizacion/types.ts` | Nivel «Platinum» | `success` | Badge, y `tierColor`, que da `--success`. Primero fue `neutral`, igual que Bronze (`--ink-mute`); la revisión de la #739 pidió que se distinga |
| `fidelizacion/types.ts` | Referido «aplicado» | `success` | Badge: confirma |
| `inspecciones/types.ts` | Auditoría de fábrica | `neutral` | Badge |
| `mail-types.ts` | Categoría «comercial» | `neutral` | Badge |
| `no-olvidar-types.ts` (3) | Tarjeta; rotación de clave y recuperación; rol admin | `neutral` | Badge. El rol admin ya no se distingue por color: lo dice la etiqueta |
| `nomina/attendance-types.ts` | Feriado de empresa | `neutral` | Badge |
| `nomina/ficha-empleado.ts` (2) | Préstamo; consulta de la cuenta bancaria | `neutral` | La línea de tiempo de la ficha no pinta el tono hoy (`FichaEmpleadoVista.tsx:645-655`) |
| `nomina/position-types.ts` | Cargo de contabilidad | `neutral` | Badge |
| `op-calendar-types.ts` | Feria | `neutral` | Badge |
| `proveedores/scorecard-types.ts` | Reclamo «abierto» | `warning` | Badge: pide intervención |
| `qr-queue-types.ts` | Prioridad «urgente» | `neutral` | Badge. **I:** lo urgente ya lo dice la etiqueta; si Sam quiere que resalte, va `warning`, nunca vino |
| `user-types.ts` | Rol admin | `neutral` | Badge |

**Nada de esto se guarda** (**C**, búsqueda en `supabase/`, `*.sql`, `*.json` y `localStorage`). Los 27 son constantes o funciones puras que se calculan al pintar. Ninguno se escribe en preferencias, en JSON de la base ni en un enum de SQL, así que no hace falta una caída del valor viejo.

**Único tono guardado en la base, fuera de este grupo:** `public.carriers.tone` (`supabase/migrations/0096_naviera_consolidacion.sql:36`, texto libre con `'neutral'` por defecto), que `lib/studio/naviera/queries.ts:71` lee tal cual. No se toca aquí. Si alguna fila guarda `'wine'`, se sigue pintando sin error, porque `Badge` todavía acepta ese tono como obsoleto (grupo 1). Su reparto va con naviera, en el grupo que la incluya, con la prueba de caída que pide el Director.

### Fase 2 · grupo 4 · dinero: allowlist y reparto (2026-11-21)

Lo asignó el Director General al fusionarse la #739. El grupo es contabilidad, financiero-china, seniat, fiscal, cotizador, nómina, proveedores, tesorería y gastos. Va en la rama `claude/sdd-0686-fase2-g4`, desde `origin/main` `f569411d6`, con revisión previa. Rigen las condiciones del grupo 3:
- revisar uno por uno si el vino es identidad;
- confirmar que ningún tono se guarda;
- medir el contraste en los dos temas.

Además rige una condición propia: **no cambiar el significado de ningún estado de dinero**. Un vino que significara peligro o vencido iría a `--danger`, no a neutro.

**Inventario (M, con el mismo detector del contrato):** 140 usos en 49 archivos, entre token, clase, tono por valor y `.css`. No hay bloques `data-theme` fijos en estas carpetas. Ningún tono del grupo se guarda: son estilos en línea y tonos de Badge y Avatar calculados al pintar. `lib/studio` ya quedó sin `"wine"` como valor en el grupo 3.

**Allowlist (rutas desde `app/studio/`):**
  - `(app)/contabilidad` (14): `_components/AccountDrawer.tsx`, `_components/ActivosFijosTab.tsx`, `_components/AjustesDelCierre.tsx`, `_components/AssetDrawer.tsx`, `_components/ClosingDateDrawer.tsx`, `_components/ConciliacionTab.tsx`, `_components/EntryDrawer.tsx`, `_components/IngresoDelPeriodoCard.tsx`, `_components/LibroDiarioTab.tsx`, `_components/LibroMayorTab.tsx`, `_components/LineMatchDrawer.tsx`, `_components/PlanCuentasTab.tsx`, `_components/PorContabilizarTab.tsx`, `_components/StatementDrawer.tsx`
  - `(app)/cotizador` (4): `[code]/page.tsx`, `_components/CotizadorClient.tsx`, `_components/QuoteDetailClient.tsx`, `_components/QuoteDrawer.tsx`
  - `(app)/financiero-china` (2): `_components/LedgerTab.tsx`, `_components/StatementDetail.tsx`
  - `(app)/fiscal` (3): `_components/FiscalClient.tsx`, `_components/FiscalConfig.tsx`, `_components/WithholdingsView.tsx`
  - `(app)/gastos` (3): `_components/ExpenseDrawer.tsx`, `_components/GastosClient.tsx`, `_components/GastosKpis.tsx`
  - `(app)/nomina` (7): `_components/AmonestacionDrawer.tsx`, `_components/EmpleadoDrawer.tsx`, `_components/GenerarFiniquitoDrawer.tsx`, `_components/NominaClient.tsx`, `_components/PuestoDrawer.tsx`, `_components/PuestosTab.tsx`, `_components/form-bits.tsx`
  - `(app)/proveedores` (8): `_components/PackingListDrawer.tsx`, `_components/PackingListsTab.tsx`, `_components/ProveedoresClient.tsx`, `_components/ReclamosTab.tsx`, `_components/ScorecardTab.tsx`, `_components/ServiceRequestDrawer.tsx`, `_components/ServiceRequestsTab.tsx`, `_components/SupplierClaimDrawer.tsx`
  - `(app)/seniat` (7): `_components/CostHelpers.tsx`, `_components/CreateFilingDrawer.tsx`, `_components/CustomsAgentsTab.tsx`, `_components/CustomsFilingsList.tsx`, `_components/CustomsKpis.tsx`, `_components/CustomsTaxTab.tsx`, `_components/FilingDetailDrawer.tsx`
  - `(app)/tesoreria` (1): `_components/TesoreriaClient.tsx`
- Además: el contrato nuevo `_components/__tests__/color-accion-fase2-g4-contract.test.ts`, el módulo común `_components/__tests__/vino-detector.ts` (la detección del vino que comparten los grupos 3 y 4) y el contrato del grupo 3, que pasa a usar ese módulo sin cambiar lo que mide.

**Estados de dinero, caso por caso.** Ningún vino de estas pantallas marcaba un vencido, una mora ni un error. Marcaba montos, saldos, deudas y el lado de un movimiento. Por la regla 4 (cifras en tinta; rojo solo si está vencido) van a tinta. En las tiras navy fijas van a `--ink-side`, que no se invierte con el tema. Nada pasa a `--danger`, porque nada significaba peligro. A pedido del Director General se revisó, fila por fila, que ningún saldo negativo o deuda quedara distinguido solo por el vino: la última columna dice qué lo distingue sin color. El único caso que dependía del color era la columna «Saldo» del mayor del socio, y ahora lo dice una leyenda.

| Pantalla y archivo | Qué marcaba el vino | Destino | Por qué no es `--danger` | Qué lo dice sin el color |
|---|---|---|---|---|
| Activos fijos (`ActivosFijosTab.tsx:126`, `:269`; `AssetDrawer.tsx:336`) | Depreciación acumulada: KPI, fila y vista previa | `--ink` | Es un monto contable, no una alerta | La etiqueta «Depreciación acumulada» y «Acumulada a hoy» |
| Conciliación (`ConciliacionTab.tsx:300`) | Total de débitos del extracto | `--ink` | El débito es un lado del movimiento; el crédito sigue en `--success` | La etiqueta «Débitos» y el signo «−» de la celda |
| Conciliación (`ConciliacionTab.tsx:388`) y match de línea (`LineMatchDrawer.tsx:193`) | Badge «Débito» (crédito en `success`) | `neutral` | Informa la dirección (regla 7); la etiqueta lo dice | El texto del Badge («Débito» / «Crédito») |
| Extracto bancario (`StatementDrawer.tsx:435`) | «− Débitos» en la tira navy de saldos | `--ink-side` | Ídem; sobre navy fijo | La etiqueta «− Débitos» |
| Libro mayor (`LibroMayorTab.tsx:179`, `:267`) | Código de cuenta y saldo destacado | `--ink` | Cifra | No distinguía estado: era el total destacado, que sigue en peso 800 |
| Financiero China (`LedgerTab.tsx:120`, `:138`, `:302`) | Saldo neto > 0, «Le debemos al socio», y su saldo corriente | `--ink` | Es deuda corriente, no vencida; «el socio nos debe» sigue en `--success` y el texto debajo dice quién debe | KPI: el texto debajo («Le debemos al socio» / «El socio nos retiene / nos debe»). **Columna «Saldo» de la tabla: solo el color decía que el positivo es deuda nuestra; se suma una leyenda sobre la tabla:** «Saldo positivo: le debemos al socio. Con signo menos: el socio nos debe o nos retiene. «—»: saldo en cero.» (texto ajustado en el grupo 5) El negativo ya lleva signo (`-$` en USD, `−¥` en RMB) |
| Estado del socio (`StatementDetail.tsx:283`) | «Conciliado» por debajo de 100 % en la tira navy | `--ink-side` | Es avance; lo que pide atención («A revisar») ya va en `--warning`, y el 100 % en `--success` | El porcentaje mismo («Conciliado 80 %») |
| SENIAT (`CustomsKpis.tsx:43`, `CustomsTaxTab.tsx:9`, `:160`) | «Impuestos pagados», aranceles en el desglose y total | `--ink` | Pagado, no vencido. En el desglose, el arancel es una serie más: IGTF `--warning`, IVA `--info` y agente `--success` no cambian | Las etiquetas («Impuestos pagados», «Aranceles de importación») |
| SENIAT (`CreateFilingDrawer.tsx:383`, `FilingDetailDrawer.tsx:293`) | Rótulo «Total a pagar SENIAT» en la tira navy | `--ink-side` | Rótulo; el monto sigue en blanco | Es un rótulo; dice «Total a pagar SENIAT» |
| Cotizador (`[code]/page.tsx:206`, `QuoteDrawer.tsx:844`) | Fecha «Válida hasta» en el panel navy del total | `--ink-side` | Es una fecha. Una cotización vencida se ve en su estado, no en este color | El texto «Vigencia:» / «Válida hasta» |
| Cotizador (`CotizadorClient.tsx:448`) | Total de la fila | `--ink` | Cifra | No distinguía estado: era el total de la fila |
| Tesorería (`TesoreriaClient.tsx:215`, `:592`) | KPI «Por pagar» y «Remesas a China» cuando hay saldo | `--ink` | Saldo pendiente, no vencido (como «por cobrar» en el grupo 2) | Las etiquetas «Por pagar» y «Remesas a China», y el texto debajo («N proveedor(es) con saldo») |
| Gastos (`GastosClient.tsx:648`, `GastosKpis.tsx:33`, `ExpenseDrawer.tsx:415`) | Monto en USD, total del mes y vista previa | `--ink` | Cifra | No distinguía estado: es el monto |
| Proveedores (`ProveedoresClient.tsx:237`, `:655`, `:931`; `ScorecardTab.tsx:89`; `PackingListDrawer.tsx:350`) | KPI de consolidadas, CBM, totales, rating y total destacado | `--ink` | Cifra | Las etiquetas del KPI; el CBM vacío sigue en `--ink-mute` con «—» |
| Retenciones (`WithholdingsView.tsx:306`) | Badge «IVA» (ISLR en `info`) | `neutral` | Informa el tipo | El texto del Badge («IVA» / «ISLR») |

**Resto del reparto**

| Destino | Qué |
|---|---|
| Acción | Casillas (`accentColor`, 8); enlaces a lo que falta contabilizar, al diario y a los anulados; «Ver CxP» de tesorería; la zona de adjuntos al pasar el ratón en gastos |
| Tinta (selección) | Servicio y extras elegidos del cotizador, moneda elegida y estado activo del financiero China, opción elegida del finiquito, columna ordenada de proveedores (fondo `color-mix(in srgb, var(--ink) 8%, transparent)` y borde de tinta) |
| Tinta (datos) | Códigos de asiento, de compra, de embarque y de expediente; Shipping Mark que no lleva a otro lugar (regla 6); acento lateral del detalle de cotización; pasos hechos de la amonestación y del reclamo |
| Neutro | Asteriscos de obligatorio (`--ink-soft`, 27); rótulos en mayúscula; eyebrow de Fiscal (vuelve al de `.studio-eyebrow`); chips de HS y su «Quitar»; avatares de agentes aduanales y del empleado (`neutral` y `--bg-elevated`); icono del adjunto |
| Atención | La nota «Candado» de un puesto de nómina (`PuestosTab.tsx:149-151`): pasa a `--warning-bg` con borde `--warning` y texto de tinta. Es una regla que restringe, no un error |
| Se queda: identidad | El encabezado impreso de los libros de IVA y de retenciones (`.fp-eyebrow` en `FiscalClient.tsx` y `WithholdingsView.tsx`): documento de marca, regla 8 |

**Contraste** (fórmula WCAG, hex de `tokens.css`):
- `--ink-side` sobre `--bg-sidebar` da 12,14:1 en claro y 14,97:1 en oscuro.
- La tinta y `--ink-soft` sobre superficie dan las mismas cifras que en los grupos 1 a 3.
- La nota «Candado» usa tinta sobre `--warning-bg`, el mismo par que `Aviso` en atención.

El contrato del grupo 4 congela las dos cuentas de identidad, mide al menos 100 archivos y trae dos mutantes: el KPI «Por pagar» en vino y el Badge de débito en vino.

### Fase 2 · grupo 5 · operación de la oficina: allowlist y reparto (2026-11-21)

Lo asignó el Director General al fusionarse la #740 (`cae9687e2`), en la rama `claude/sdd-0686-fase2-g5`. El grupo reúne los ocho módulos con vino que más usa la oficina: despacho, calendario, tms, operarios, etiquetas, cola-qr, tarifas y reclamos (**I:** orden por uso diario en la operación, no medido). Son 136 usos en 40 archivos. Rigen las condiciones del grupo 4: identidad, lo que se guarda, el contraste en los dos temas, los bloques `data-theme` y qué lo dice sin el color.

- **Identidad:** no queda ninguna. El grupo cierra con cero usos de vino por token, clase y tono; quedan los hex escritos a mano de la etiqueta impresa, para la fase 4.
- **Lo que se guarda:** nada. En estas carpetas, `localStorage` guarda solo anchos de columna; los tonos se calculan al pintar. `public.carriers.tone` es de naviera y no entra aquí.
- **`data-theme`:** no hay bloques fijos. Las tiras navy (la ocupación del camión del despacho) usan `--ink-side*`, que no se invierte con el tema.
- **Arreglos menores de la revisión de la #740:**
  - el comentario de `proveedores/_components/ProveedoresClient.tsx:887-888`, que todavía decía «valor wine»;
  - la leyenda del socio en `financiero-china/_components/LedgerTab.tsx`, que ahora nombra «nos retiene» y explica la raya del saldo en cero.

**Allowlist (rutas desde `app/studio/`):**
  - `(app)/calendario` (8): `_components/AgendaView.tsx`, `_components/CalendarClient.tsx`, `_components/CalendarLegend.tsx`, `_components/DayDrawer.tsx`, `_components/FairsPanel.tsx`, `_components/MonthView.tsx`, `_components/UpcomingHolidaysCard.tsx`, `_components/WeekView.tsx`
  - `(app)/cola-qr` (4): `_components/BatchPrintDrawer.tsx`, `_components/QrQueueClient.tsx`, `_components/QrQueueKpis.tsx`, `_components/QrQueueTable.tsx`
  - `(app)/despacho` (7): `_components/ActiveOdsPanel.tsx`, `_components/CreateOdDrawer.tsx`, `_components/DispatchKpis.tsx`, `_components/DispatchQueueTable.tsx`, `dashboard/_components/DispatchDashboardClient.tsx`, `page.tsx`, `reglas/_components/RulesClient.tsx`
  - `(app)/etiquetas` (2): `_components/LabelGeneratorClient.tsx`, `_components/SupplierMessageModal.tsx`
  - `(app)/financiero-china` (1): `_components/LedgerTab.tsx`
  - `(app)/operarios` (7): `_components/EditOperarioDrawer.tsx`, `_components/MotivoField.tsx`, `_components/NewOperarioDrawer.tsx`, `_components/OperariosClient.tsx`, `_components/PinRevealBlock.tsx`, `_components/PinViewDialog.tsx`, `_components/ResetPinDrawer.tsx`
  - `(app)/proveedores` (1): `_components/ProveedoresClient.tsx`
  - `(app)/reclamos` (2): `_components/ClaimDrawer.tsx`, `_components/ReclamosClient.tsx`
  - `(app)/tarifas` (2): `_components/RateDrawer.tsx`, `_components/TarifasClient.tsx`
  - `(app)/tms` (8): `_components/DriverDrawer.tsx`, `_components/DriversTab.tsx`, `_components/FleetTab.tsx`, `_components/GpsLiveTab.tsx`, `_components/IncidentsTab.tsx`, `_components/RouteDrawer.tsx`, `_components/RoutesTab.tsx`, `_components/TmsKpis.tsx`
- Además: el contrato nuevo `_components/__tests__/color-accion-fase2-g5-contract.test.ts`, la prueba nueva `(app)/calendario/_components/MonthView.test.tsx`, esta spec y el handoff.

**Estados y señales, caso por caso**

| Pantalla y archivo | Qué marcaba el vino | Destino | Qué lo dice sin el color |
|---|---|---|---|
| Calendario (`AgendaView`, `DayDrawer`, `FairsPanel`, `WeekView`, `MonthView:132`, `CalendarLegend:68`, `:73`, `UpcomingHolidaysCard:25`) | Feriado de China | `--warning` (borde, punto y Badge) | El Badge dice «CN». Un feriado común avisa: va en atención, no en peligro |
| Calendario, mes (`MonthView:132`) y leyenda (`CalendarLegend:66-68`) | Feriado **crítico** de China: la operación se para (Año Nuevo Chino, Golden Week) | Barra en `--danger`: 4,62:1 en claro y 3,11:1 en oscuro contra la celda. Con `--warning` daba 2,21:1 en claro (revisión de la #741, que corrige la decisión anterior: el crítico sí es peligro) | Un ícono de alerta junto al nombre del feriado en la celda y el título «· feriado crítico». Para lectores de pantalla, el estado va en el nombre accesible del botón del día («Ver eventos del AAAA-MM-DD, feriado crítico en China»): el botón lleva `aria-label`, que tapa el texto de adentro (revisión de la #741). Lo vigila `calendario/_components/MonthView.test.tsx`. En la agenda y el cajón del día el texto ya decía «Operación CN paralizada» y «Crítico». El Badge «Crítico» de `FairsPanel.tsx` pasa a `danger` y la marca «crítico» de `UpcomingHolidaysCard.tsx` a `--danger-text`: como texto de 9 px da 5,78:1 en claro y 5,89:1 en oscuro sobre `--bg-elevated` (con `--danger` en oscuro daba 4,43:1, por debajo de AA) |
| Calendario (`MonthView:192`, `UpcomingHolidaysCard:24`) | Texto del nombre del feriado chino | `--ink` | El nombre mismo. `--warning` no llega a 4,5:1 como texto chico |
| Calendario (`CalendarClient:327`) | Punto de «Arribos · ETA» en los filtros | `--ink-soft` | La etiqueta; igual que la ETA del grupo 3, que pinta neutral |
| Calendario (`MonthView:160`, `WeekView:66`, `:91`, `CalendarLegend:82`) | Día de hoy | `--ink` (fondo de tinta y número en `--bg-surface`) | La leyenda «Hoy» y el círculo; como el día de hoy del grupo 1 |
| Despacho (`CreateOdDrawer.tsx:392`) | Ocupación normal del camión (≤ 90 %) en la tira navy | `--ink-side-strong` | El porcentaje y la cifra «usado / total». Arriba de 90 % sigue `--warning`, y arriba de 100 % `--danger` |
| Despacho, cola QR (`DispatchKpis`, `QrQueueKpis`, `DispatchDashboardClient:109`) | KPI «En cola», «Pendientes» sin urgentes y «Total ODs» | `neutral` | Las etiquetas. Con urgentes, «Pendientes» sigue en `--warning` y el texto dice «N urgentes» |
| Despacho (`DispatchDashboardClient:235`) | Barra del primer lugar en «Top ciudades» | `--ink` (las demás, tinta al 30 %) | El orden de la lista y el número «N ODs» |
| TMS (`IncidentsTab:44`, `TmsKpis:18`) | «Mantenimientos» cuando hay, y «Flota total» | `--ink` | Las etiquetas y el texto «Programados» |
| TMS (`RoutesTab:207`, `GpsLiveTab:301`) | Avance de la ruta por debajo de 100 % | `--ink` | El porcentaje. Al 100 % sigue `--success` |
| TMS (`RouteDrawer:266-269`) | Última parada (destino) del recorrido | `--ink`, igual que la primera | El orden y el número de la parada. No va en `--success`: una parada sin recorrer no está confirmada, y el número sobre verde daba 4,15:1 en claro |
| Reclamos (`ReclamosClient:215`, `:397`, `:629`) | «Monto expuesto» de reclamos abiertos y montos | `--ink` | La etiqueta «Monto expuesto» y «reclamos abiertos». No es un vencido |
| Reclamos (`ReclamosClient:669`, `:692`) | Pasos alcanzados del reclamo | `--ink` | El número del paso y la etiqueta |
| Operarios (`OperariosClient:409`) | Badge del rol supervisor | `neutral` | El texto del rol. Como el rol admin del grupo 3 |

**Resto del reparto**

| Destino | Qué |
|---|---|
| Acción | Casillas y el control deslizante de reglas; enlaces a reglas de despacho, rutas y clientes VIP; «+ Agregar parada intermedia» del TMS; «Copiar» del mensaje al proveedor |
| Tinta (selección) | Política y estrategia elegidas en las reglas de despacho, fila elegida de la cola, opción elegida del lote de impresión, barra de selección de la cola QR, copias por caja y formato elegidos de etiquetas |
| Tinta (datos) | Códigos de OD, ruta, embarque, Shipping Mark sin destino propio (regla 6) y orden; valores de las reglas; el PIN que se muestra una vez; la tarifa |
| Neutro | Asteriscos de obligatorio, rótulos y eyebrows (vuelven al color de `.studio-eyebrow`), la flecha entre paradas, avatares de choferes y operarios, la caja del Shipping Mark de etiquetas y la nota del tier elevado (`--neutral-bg` con borde `--border-strong`) |

**Contraste:**
- `--ink-side` sobre `--bg-sidebar` da 12,14:1 en claro y 14,97:1 en oscuro.
- `--ink-side-strong` (blanco) sobre la misma tira da más que eso.
- La tinta, `--ink-soft` y `--warning` como borde (forma) usan los pares ya medidos en los grupos 1 a 4.

**Pendientes fuera de esta PR:**
- Los tintes `--cal-cn-soft` y `--cal-cn-critical` de `tokens.css` siguen en la familia roja (`rgba(168,50,62,…)` en claro y `rgba(224,119,133,…)` en oscuro). Son de la fase 1. Se deciden junto con la barra del feriado crítico del mes, en el próximo tramo que toque `tokens.css` y con su propia revisión.
- La etiqueta impresa (`etiquetas/_components/Label.tsx:153`, `:162` y `:200`) conserva `#7F0F1A` escrito a mano, incluido el Shipping Mark, que es un dato. El detector no ve hex: va con la fase 4, donde están los hex de la familia vino. Por eso esta carpeta tiene cero vino **por token y por clase**, no cero vino.
- La barra de ocupación blanca del despacho da 2,83:1 contra su pista en claro (antes 1,21) y 3,65:1 en oscuro. La acompaña la cifra «usado / total». Llevarla a 3:1 en claro queda pendiente.
- ~~La marca «crítico» de `UpcomingHolidaysCard.tsx`, en `--warning` a 3,14:1, venía de `main`.~~ Resuelto en esta PR: pasa a `--danger-text` (fila del feriado crítico).

El contrato del grupo 5 exige cero vino por token, clase y tono en las ocho carpetas (los hex escritos a mano son de la fase 4). Mide al menos 60 archivos y trae dos mutantes: el feriado de China y un KPI de flota.

**Orden de los módulos que quedan (grupo 6 en adelante, de 5 a 8 por grupo; I: por uso):**
1. Grupo 6: reportes, dirección, bugs, mis-bugs, costing, legal y ve.
2. Grupo 7: naviera (con la prueba de caída del `wine` guardado en `public.carriers.tone`), fidelización, documentos, órdenes de compra, órdenes de venta, club e inventario.
3. Grupo 8: conversaciones, menciones, rendiciones, servicios, ajustes, `(panel)` y los restos de un uso en cobranzas, dashboard, mailing e inspecciones.

El vino de identidad que ya está permitido (diploma, informe de inspección, firma de correo, Guía y libros fiscales impresos) y la acción de noticias-web, que espera la fase 3, no cuentan como pendientes.

### Fase 2 · grupo 6 · reportes y dirección: allowlist y reparto (2026-11-21)

Sigue el orden que dejó el grupo 5, al fusionarse la #741 (`d81f7c504`), en la rama `claude/sdd-0686-fase2-g6`. Los módulos son reportes, dirección, bugs, mis-bugs, costing, legal y ve: 112 usos en 27 archivos. Rigen las mismas condiciones del grupo 5: identidad, lo que se guarda, el contraste en los dos temas, los bloques `data-theme` y qué lo dice sin el color.

- **Identidad:** queda el encabezado impreso «DTD Cargo · Constructor de reportes» (`.rpt-eyebrow` en `BuilderView.tsx`), igual que los libros fiscales del grupo 4 (regla 8).
- **Lo que se guarda:** en estas carpetas, `localStorage` guarda los filtros del panel de bugs y las combinaciones del constructor de reportes. Ningún tono ni color.
- **`data-theme`:** no hay bloques fijos. Las tiras navy (la proyección de costos, la cabecera del editor de costos y el encabezado de legal) usan `--ink-side*` y `--color-status-danger-on-dark`, que no se invierten con el tema.

**Allowlist (rutas desde `app/studio/`):**
  - `(app)/bugs` (5): `_components/BugDrawer.tsx`, `_components/BugKanban.tsx`, `_components/BugStats.tsx`, `_components/BugTable.tsx`, `page.tsx`
  - `(app)/costing` (2): `_components/CostEditorDrawer.tsx`, `_components/CostingClient.tsx`
  - `(app)/direccion` (8): `_components/AlertsCard.tsx`, `_components/CommercialCard.tsx`, `_components/FinanceHealthCard.tsx`, `_components/ForecastCard.tsx`, `_components/MiniStat.tsx`, `_components/OpsCard.tsx`, `_components/SinFacturarCard.tsx`, `page.tsx`
  - `(app)/legal` (3): `_components/LegalClient.tsx`, `evidencia/[code]/page.tsx`, `expediente/[code]/page.tsx`
  - `(app)/mis-bugs` (1): `_components/BugCard.tsx`
  - `(app)/reportes` (4): `_components/BuilderView.tsx`, `_components/ReportesClient.tsx`, `_components/charts.tsx`, `page.tsx`
  - `(app)/ve` (4): `_components/AlmacenVeClient.tsx`, `_components/VeKpis.tsx`, `_components/VeRowActions.tsx`, `page.tsx`
- Además: el contrato nuevo `_components/__tests__/color-accion-fase2-g6-contract.test.ts`, esta spec y el handoff.

**Estados y señales, caso por caso**

| Pantalla y archivo | Qué marcaba el vino | Destino | Qué lo dice sin el color |
|---|---|---|---|
| Costing (`CostEditorDrawer.tsx:120`, `CostingClient.tsx:1258`) | Margen negativo, en la tira navy (positivo en `--success`) | `--color-status-danger-on-dark`: 7,46:1 en claro y 8,78:1 en oscuro sobre `--bg-sidebar` | El signo (`-$`) y el porcentaje. Un margen negativo es pérdida, así que va en peligro |
| Reportes, recompra (`ReportesClient.tsx:1200`) | KPI «En ventana · contactar ya» (vencidos en `--danger`, en curso en `--success`) | `--warning`: 3,14:1 en claro y 7,15:1 en oscuro sobre `--bg-surface`. Alcanza porque es texto grande: la cifra del KPI (`KpiCard.tsx:92`) va en peso 900 a `--kpi-fs`, que mide 30 px en densidad normal y 24 px en compacta (`tokens.css:186` y `:477`), y el umbral es 18,66 px en negrita. En el extremo del degradado de la tarjeta da 3,01:1, apenas sobre el 3:1 (medido en la revisión de la #742). No existe `--warning-text`; si la cifra bajara de 18,66 px, haría falta un tono de 4,5:1 | La etiqueta «En ventana» y «contactar ya» |
| Reportes, recompra (`ReportesClient.tsx:1248`) | Días desde la última compra, cuando no está vencida | `--ink` | El Badge «Ventana» o «Vencida» al lado. Lo vencido sigue en `--danger` |
| Reportes, IVA (`ReportesClient.tsx:1642`) | «IVA a pagar» (el excedente a favor, en `--success`) | `--ink` | La etiqueta «IVA a pagar» y «luego de retenciones». Es un monto que se debe, no un vencido |
| Reportes, meta (`ReportesClient.tsx:1309`, `:1315`) | Avance contra la meta por debajo de 100 % | `--ink` | El porcentaje y «N vs meta CBM/mes». Al 100 %, `--success` |
| Reportes, margen por ruta (`ReportesClient.tsx:2151`) | Barra de margen positivo (negativo en `--danger`) | `--ink` | La cifra al lado |
| Reportes, margen bruto (`ReportesClient.tsx:1931`) | KPI «Margen bruto», siempre en vino | `--ink` | El signo y el porcentaje de margen. El vino no cambiaba con el signo |
| Reportes, gráficas (`charts.tsx`, `ReportesClient.tsx:685` a `:1855`, `BuilderView.tsx:491`) | Barras, líneas, donut y barra «facturado» (cobrado en `--success`) | Tinta: barras en `--ink`, línea de CBM en `--ink-soft`; en el donut y en las barras del constructor, tinta en grados (70 %, 45 % y 22 % sobre la superficie; el donut pasa a 82 %, 66 % y 50 % con trazo en el grupo 7) | La leyenda de cada serie y las cifras. Regla de Sam: cifras y gráficas en tinta |
| Dirección, proyección (`ForecastCard.tsx:100`) | Semana en curso en vino; las siguientes en vino claro | `--ink` para la semana en curso y tinta al 45 % para las siguientes | La etiqueta de la semana y el monto |
| Dirección, operaciones (`OpsCard.tsx:18`) | Cut-off de la naviera a más de 3 días (a 3 o menos, `--danger`) | `neutral` | Los días que faltan |
| Legal (`LegalClient.tsx:403`, `:410`) | Versión vigente del documento | Selección en tinta | El Badge «Vigente» de la fila |
| VE (`VeKpis.tsx:47`) | «DDP en camino» cuando hay repartos | `--ink` | El texto «DDP en camino al cliente» o «Ningún reparto activo» |

**Resto del reparto**

| Destino | Qué |
|---|---|
| Acción | Enlaces («Ver embarques sin facturar →», CRM, tesorería, naviera, el reporte sin facturar); bordes al pasar el ratón en el kanban de bugs, en las acciones de VE y en editar costos |
| Tinta (selección) | El modo activo de reportes (fondo de tinta y texto `--ink-inv`), el primer lugar de las estadísticas de bugs y la columna ordenada |
| Tinta (datos) | Folios, códigos de embarque, de envío y de acuse, Shipping Mark sin destino propio (regla 6), CBM, totales y KPI |
| Neutro | Rótulos en mayúscula, la flecha de la ruta, avatares de asesores (sin `wine`), mensajes del administrador en bugs (`--neutral-bg` con borde de tinta), la marca «abierto», el ícono del encabezado de legal sobre navy (`--ink-side-strong` en un fondo translúcido) y los chips de código |

Los mapas de tono locales de bugs y mis-bugs pierden la clave `wine`. Son `Record<string, …>`, y el tono «sugerencia» ya llega como `neutral` desde `lib/studio/bug-types.ts` (grupo 3).

El contrato del grupo 6 congela la única cuenta de identidad, mide al menos 40 archivos y trae dos mutantes: el margen negativo y la barra de las gráficas.

### Fase 2 · grupo 7 · naviera, fidelización y órdenes: allowlist y reparto (2026-11-21)

Sigue el orden del grupo 5 y empieza al fusionarse la #742, en la rama `claude/sdd-0686-fase2-g7`.
- **Módulos:** naviera, fidelización, documentos, órdenes de compra, órdenes de venta, club e inventario.
- **Tamaño:** 52 líneas con vino en 13 archivos de pantalla, más las uniones de tono de sus tipos en `lib/studio`.
- **Condiciones:** las mismas del grupo 5.
- **Arrastres de la revisión de la #742:** el donut de reportes y las dos impresas de legal.

- **Identidad:** no queda ningún vino de identidad en estas carpetas.
- **Lo que se guarda:**
  - `public.carriers.tone` es texto libre y su comentario de 0096 nombra «wine». La base no se toca. Al leerla, `carrierTone()` (`lib/studio/naviera/types.ts`) deja pasar solo los tonos del sistema y lleva a `neutral` un «wine» viejo o cualquier valor desconocido, sin error. `coerceCarrier` lo usa, y `Carrier.tone` pasa de `string` a `BadgeTone`. Lo prueba `lib/studio/naviera/__tests__/carrier-tone.test.ts`, también a través de `listCarriers`. Hoy ninguna pantalla pinta ese tono.
  - `localStorage` guarda solo el orden de las compras. No guarda ningún tono.
- **`data-theme`:** no hay bloques fijos. La cola «Listo para consolidar» de inventario está sobre `--bg-sidebar` y usa `--ink-side`, como la invitación del grupo 3.
- **Tonos armados con plantilla:** las cabeceras de estado de `PoDrawer` y `OvDrawer` y las carpetas de documentos usan `var(--${tono})`, que el detector no ve. Ahora el tipo de esos tonos ya no incluye «wine», así que tsc impide que vuelva.

**Allowlist (rutas desde la raíz):**
  - `app/studio/(app)/naviera` (3): `_components/AssignCargoDrawer.tsx`, `_components/NavieraClient.tsx`, `_components/UtilizationBar.tsx`
  - `app/studio/(app)/fidelizacion` (2): `_components/FidelizacionClient.tsx`, `_components/ReferralDrawer.tsx`
  - `app/studio/(app)/documentos` (1): `_components/DocumentosHubClient.tsx`
  - `app/studio/(app)/ordenes-compra` (1): `_components/OrdenesCompraClient.tsx`
  - `app/studio/(app)/ordenes-venta` (2): `_components/OrdenesVentaClient.tsx`, `_components/OvDrawer.tsx`
  - `app/studio/(app)/club` (3): `_components/ClubClient.tsx`, `_components/GroupBuysView.tsx`, `_components/MembersView.tsx`
  - `app/studio/(app)/inventario` (1): `_components/InventarioClient.tsx`
  - `lib/studio` (9): `naviera/types.ts`, `naviera/queries.ts`, `naviera/client-palette.ts` (comentario), `naviera/__tests__/consolidation-request-status.test.ts`, `documents/types.ts`, `purchase-orders/types.ts`, `sales-orders/types.ts`, `club/club-member-types.ts` y `club/group-buy-types.ts`
  - Arrastres de la #742 (4): `app/studio/(app)/reportes/_components/charts.tsx` y `ReportesClient.tsx`, y `app/studio/(app)/legal/evidencia/[code]/page.tsx` y `expediente/[code]/page.tsx`
- **Además:**
  - el contrato `app/studio/_components/__tests__/color-accion-fase2-g7-contract.test.ts`;
  - las pruebas `lib/studio/naviera/__tests__/carrier-tone.test.ts` y `app/studio/(app)/reportes/_components/charts.donut.test.tsx`;
  - esta spec y el handoff.

**Estados y señales, caso por caso**

| Pantalla y archivo | Qué marcaba el vino | Destino | Qué lo dice sin el color |
|---|---|---|---|
| Naviera, utilización (`UtilizationBar.tsx`) | Contenedor por encima del 100 % (80 % a 100 % en `--warning`, el resto en `--success`) | `--danger` | El porcentaje y «usado / capacidad». La sobrecapacidad avisa pero no bloquea |
| Naviera, asignar carga (`AssignCargoDrawer.tsx`) | Mensaje de sobrecapacidad | `--danger-text` | El mensaje mismo, que nombra el exceso |
| Naviera, KPI «Carga suelta en CN» (`NavieraClient.tsx`) | Hay carga sin asignar | `--warning` en el KPI: texto grande, como «En ventana» del grupo 6 | «N embarque(s) sin asignar» |
| Naviera, contenedores (`NavieraClient.tsx`) | Contenedor seleccionado (borde y código) | Selección en tinta: borde `--ink` con sombra | `aria-pressed` en la tarjeta (nuevo) |
| Naviera, reservas (`NavieraClient.tsx`) | Badge FCL | `neutral` | El texto «FCL» frente a «LCL» en `info` |
| Fidelización, progreso del referido (`ReferralDrawer.tsx`) | Pasos cumplidos, paso actual y conector | Tinta: círculo `--ink` con el check en `--ink-inv`, conector `--ink` | El check en los pasos cumplidos y el peso 700 del paso actual |
| Fidelización, referidos (`FidelizacionClient.tsx`) | Monto de un crédito «aplicado» (acreditado en `--success`) | `--ink` | La columna de estado de la fila |
| Fidelización, aplicar crédito (`ReferralDrawer.tsx`) | Borde del panel de acción | `--accion` | El título «Aplicar $N a una factura» y su botón |
| Documentos (`DocumentosHubClient.tsx`) | Carpeta y vista activas | Selección en tinta (`color-mix` al 8 % y texto `--ink`) | El peso 700 y `aria-current` en el enlace (nuevo) |
| Órdenes de compra (`OrdenesCompraClient.tsx`) | Columna ordenada | `--ink` | La flecha ▲/▼ |
| Club, compras grupales (`GroupBuysView.tsx`) | Avance de la ronda por debajo de 100 % | `--ink` (al 100 %, `--success`) | `role="progressbar"` con su valor |
| Inventario (`InventarioClient.tsx`) | Badge del modo consolidación | `neutral` | El texto «Modo consolidación · entrada» frente a «Modo despacho · salida» en `info` |

**Resto del reparto**

| Destino | Qué |
|---|---|
| Acción | «Ver todos» de los embajadores y el enlace a PreAlertas de servicios |
| Tinta (datos) | Shipping Mark sin destino propio (regla 6), códigos de compra, venta, estimado, pago y factura, totales de compras, el primer lugar de los embajadores, el conteo de referidos y los KPI de club e inventario |
| Neutro | El rótulo «Club DTD», el código para compartir, «Crédito aplicado» y los números de los pasos del programa (círculo `--ink` con `--ink-inv`) |

**Arrastres de la revisión de la #742**
- **Donut de «Mix de servicios»:**
  - Los grados de tinta pasan a `GRADOS_DE_TINTA` en `charts.tsx`: 100 %, 82 %, 66 % y 50 % de `--ink` sobre `--bg-surface`.
  - El más claro da 3,25:1 en claro y 4,36:1 en oscuro; antes, el de 22 % daba 1,58:1 y 1,91:1.
  - Los segmentos se separan con un trazo de 2 px en `--bg-surface`.
  - `gradoDeTinta(i, total)` evita que el último segmento, que toca al primero, repita su grado. Con cinco toma el del medio.
  - Las barras de «Revenue por servicio» usan los mismos grados, así que cada servicio tiene el mismo grado en las dos tarjetas.
- **Impresas de legal:** sale la declaración `--wine: #7F0F1A` de evidencia y expediente. Nadie la usaba.
- **«En ventana»:** su nota quedó en la tabla del grupo 6.

**Contrato del grupo 7:**
- exige cero vino en las siete carpetas y en los tipos de `lib/studio` del grupo;
- mide al menos 60 archivos;
- trae tres mutantes: la sobrecapacidad, el badge FCL y la carpeta activa de documentos;
- comprueba que las dos impresas de legal ya no declaran `--wine`.

**Fuera de este grupo:**
- `tierBadgeTone` de `lib/studio/client-types.ts` todavía declara «wine» en su tipo de retorno, aunque no lo devuelve. Es de clientes.
- El Excel de `lib/studio/document-import/export.ts` usa el hex del vino como identidad de la plantilla (fase 4).

### Fases 2 a 5

Sus allowlists se fijan al abrir cada una. Inventario de partida (**M**):

| Superficie | Por token o clase | Familia vino escrita a mano |
|---|---|---|
| `app/studio` | 1.018 usos en 276 archivos | 97 en 36 |
| `app/portal` | 259 en 73 | 2 en 1 |
| Web (`app/*` público + `components/`) | 612 en 64 | 30 en 7 |
| `app/m` | 131 en 25 | 2 en 2 |
| `lib/` | 20 en 9 | 49 en 22 |
| `app/back`, `app/marca`, `app/invitar` | 11 en 6 | 14 en 5 |

Orden de los grupos de la fase 2: lo que se ve siempre (menú lateral, barra superior), operación diaria (`dashboard`, `embarques`, `tracking`, `clientes`, `cn`, `cobranzas`, `facturacion`, `crm`) y el resto por grupos de 5 a 8 módulos.

## 6. Aceptación

### Fase 0

- `BRAND.md`, VIS-01 y BTN-01 dicen lo mismo que §2 y no quedan frases que asignen la acción al vino.
- BD-076 registrado con cita literal, superficie, tokens, contraste y fecha.
- `pnpm docs:check`, `pnpm sdd:check` y `pnpm governance:check` pasan.

### Fase 1

Lo vigila `color-accion-contract.test.ts`, leyendo los valores reales de `tokens.css`. Cada regla tiene piso (cuenta mínima de lo que mide) y al menos un mutante que la rompe:

- `--on-accion` sobre `--accion` y sobre `--accion-hover` mide al menos 4,5:1 en los dos temas.
- `--accion` mide al menos 3:1 contra `--bg-surface` y `--bg-elevated` en los dos temas.
- `--accion-text` mide al menos 4,5:1 sobre `--bg-base`, `--bg-surface` y `--bg-elevated` en los dos temas.
- **La acción y el peligro no comparten tono:** la distancia de tono entre `--accion` y `--danger` es de al menos 90° en los dos temas. Mutante: devolver `--accion` a `#A8323E`.
- Ninguna regla de `.studio-btn-primary` nombra `--wine` ni `--studio-wine`.
- Los tokens `--accion*` no referencian tokens `--wine*`.
- Al imprimir, los tokens de acción vuelven a su valor claro, como cada token que el tema oscuro sobrescribe.
- Todo lo de SDD-0603 sigue valiendo: contornos de al menos 3:1, nada oprimible bajo 32 px, elevación por niveles y verbos en peso 700.

### Fases 2 a 4

- Un contrato congela la lista de archivos con `var(--wine` o clases `*-wine*`, con cuenta exacta por archivo, y la lista solo puede bajar. Al cerrar, quedan únicamente los usos de identidad, cada uno con su motivo escrito.
- Ningún saldo, monto ni KPI usa `--wine-text`.
- La selección sigue en tinta (BD-037); ningún tramo la pasa a azul.

## 7. Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: sigue habiendo un único relleno de acción por contexto; cambia su color |
| Acción dominante | Cumple: no cambia la cantidad de primarios |
| Semántica de color | **Cambio de política aprobado por Sam:** VIS-01 §3 pasa de «Wine: identidad, selección y acción primaria» a acción en azul e identidad en vino. Se enmienda la política en la fase 0 |
| Contraste | Cumple en valores medidos; lo vigila el contrato de la fase 1 |
| Tokens | Seis tokens de color nuevos, registrados en el BD |
| Estados sin color | Cumple: el peligro conserva icono y verbo; ver «Límite conocido» en §3 |
| Light/dark | Cumple en contrato. Falta el recorrido en pantalla (§8) |
| Móvil | Sin cambio de disposición; `app/m` entra en la fase 3 |
| Movimiento reducido | No aplica: no se agrega movimiento |

## 8. Verificación y publicación

- **Imagen de prueba** (rama que no se fusiona) con las fases 1 y 2 juntas, para que Sam vea el azul en el Studio en claro, oscuro y compacto antes de fijar el tono. Datos tapados, sin escribir.
- `/ui-check` por PR y `/ui-pro` sobre las pantallas principales al cierre.
- `pnpm verify` con turno del Director; CI verde sobre la cabeza exacta; revisión independiente que lanza el Director General.
- Fusionar y publicar a producción piden cada uno su autorización. Las decisiones de Sam del 2026-11-20 cubren el diseño.

### 8.1 Condición de publicación

**Entre la fase 1 y el final de la fase 2 no se publica**, salvo que lo que queda en pantalla sea coherente. Confirmada por el Director General el 2026-11-20.

- **Por qué:** la fase 1 cambia lo que se pinta por clase y la fase 2 lo que se pinta en línea. Publicar la primera sin la segunda deja botones azules junto a enlaces y acentos en vino, que es peor que no haber empezado.
- **Alcanza a la fusión, no solo al despliegue:** en este repo cada push a `main` publica la web (SDD-0541). Mientras la condición no se cumpla, la PR de la fase 1 no entra a `main`.
- **Qué es «coherente» y cómo se comprueba:** en lo que se ve siempre (menú lateral, barra superior) y en la operación diaria (los ocho módulos de §5) no queda ningún botón principal, enlace ni acento de acción en vino. Lo mide el contrato de la fase 2 (§6): para esos grupos, la lista de usos de `var(--wine` solo contiene usos de identidad, cada uno con su motivo.
- **Cómo se llega sin publicar a medias:** lo decide el Director al abrir la fase 1. Propuesta: las PR de la fase 1 y de los dos primeros grupos de la fase 2 se revisan una por una, pero entran a `main` juntas, en una sola fusión.
- Ninguna excepción a esta condición se toma por el Worker: la autoriza Sam.

## 9. Lo que esta spec no cubre

- **Logo y wordmark:** las 4 variantes PNG y el «DTD» en vino no se tocan.
- **Formato de cifras:** SDD-0687. **Encabezados, drawers, tablas y espaciados:** SDD-0688.
- **Correos y plantillas guardadas en la base de datos:** 8 migraciones ya aplicadas llevan el vino en plantillas. Cambiarlas exige migración nueva y escritura en producción con OK nominal de Sam y el runbook; se decide en la fase 5.
- **Chatwoot** (`infra/chatwoot`) y **`infra/dtd-cargo`**: se despliegan aparte.
- **PDF de factura, estado de cuenta, etiquetas y diplomas:** son documentos de marca; conservan el vino salvo decisión contraria de Sam.

## 10. Pendientes de decisión

1. ~~Tono exacto del azul.~~ **Decidido el 2026-11-20:** opción B, `#1F4FA8` en claro y `#7FAAF0` en oscuro.
2. ~~Color del **Shipping Mark**.~~ **Decidido el 2026-11-20** (BD-076, regla 6). Va en tinta, y en azul con subrayado fino solo si la marca, ella sola, lleva a otro lugar. Si toda la fila se abre al tocarla, va en tinta. El chip de la ficha sigue siendo botón. En impresión y sin destino, va en tinta. La regla vale para cualquier dato que lleve a algún lugar (cliente, factura, contenedor, tracking). Respuesta de Sam: «Sí, la regla del Shipping Mark queda así».
3. ~~Qué hacer con correos, PDF y Chatwoot (§9).~~ **Decidido el 2026-11-20** (BD-076, regla 8). **Correo:** logo y línea del encabezado en vino; botones y enlaces en azul; montos en tinta. **PDF** (factura, estado de cuenta, etiquetas): vino solo en el logo y en la línea del encabezado; sin azul, porque en papel nada se oprime; datos y cifras en tinta. **Chatwoot:** la burbuja del chat en azul. Sam vio las tres piezas dibujadas y respondió: «Correos, PDF y Chatwoot: queda como la propuesta». La decisión fija el color. **Aplicarlo necesita su propio OK** cuando llegue la fase 5: las plantillas de correo guardadas en la base de datos exigen una migración y una escritura en producción, y Chatwoot se configura en su servidor de producción (§9).
4. ~~El tono de badge `wine`.~~ **Decidido el 2026-11-20** (BD-076, regla 7). El tono se retira y cada badge toma el tono de su función: `neutral` si informa, `success` si confirma y tinta si cuenta una selección; ninguno en azul. Hay unos 30 usos en el Studio, el Portal y el móvil, que migran en la fase 2. Sam vio los casos reales dibujados y respondió: «se retira, cada uno por su función como en la propuesta quitar vino».
5. **Gráficos y dashboard (choque con BD-011), para decidir antes de la fase 2.** BD-011 (2026-06-20) fija la paleta de gráficos con el «wine protagonista». El dashboard del Studio pinta en vino su gráfica de barras, las etiquetas de sección y los íconos (`dashboard/_components/DashboardWidgets.tsx`). También el estado «en tránsito», «en reparto» y «última milla» (`dashboard/_components/RecentActivityCard.tsx:35-39`), que además choca con la política de Estados de `BRAND.md`: estar en camino no es riesgo. Propuesta mostrada a Sam el 2026-11-20: cifras y gráficas en tinta, con rampa por opacidad y sin colores nuevos; estados de viaje en `--info` (neutro); el rojo solo para la excepción. El azul queda fuera de los gráficos, para que una barra no parezca un botón. **Aprobada por Sam el 2026-11-20**: a «¿Apruebas la propuesta del dashboard: cifras y gráficas en tinta, y estados neutros?» respondió «Sí, así». BD-011 se enmienda en la misma PR de la fase 2, junto con el dashboard.

## 11. Límites

Los valores de §3 son calculados; nadie los ha visto en pantalla. Los conteos de §5 son por texto en el código. No se midió accesibilidad en vivo ni se probó con personas con daltonismo.
