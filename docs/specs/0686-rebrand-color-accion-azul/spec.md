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
- **69 archivos en línea bajo `app/studio/`:** `(app)/admin` (28), `(app)/marketing` (10), `(app)/bitacora` (8), `(app)/mailing` (7), `(app)/academia` (3), `(app)/inspecciones` (3), `(app)/usuarios` (1) y `_components/` fuera de `ui` (`bug-reporter` 2, `documents` 1, `guia` 1, `wiring` 5).
- El contrato nuevo `app/studio/_components/__tests__/color-accion-fase2-g3-contract.test.ts`, esta spec y el handoff.

| Destino | Qué |
|---|---|
| Neutro (`lib/studio`) | Rol admin, tipo de cuenta, modelo Opus del agente, eventos del calendario, nivel del cliente, plan del club, canal portal, tipos de documento, nivel platino, inspecciones, etiquetas de correo, recordatorios, asistencia y cargos de nómina, cola QR |
| Éxito y atención (`lib/studio`) | Canje «aplicado» de fidelización → `success`; reclamo «abierto» al proveedor → `warning`, porque pide intervención |
| Acción | Enlaces y botones de texto («Editar →», «Ver», «+ Subir nueva versión», «CC», «Agregar ciudad»); casillas (`accentColor`); foco; interruptores encendidos; botón principal de notificaciones; la columna del kanban de bitácora donde se suelta una tarjeta; el aro con el que la Guía señala un control; el hover del buscador global |
| Tinta (selección) | Pestañas, pastillas y tarjetas elegidas (fondo `color-mix(in srgb, var(--ink) 8%, transparent)`, o fondo de tinta con texto `--ink-inv` si el relleno era sólido); opción elegida del esquema de noticias, del diseño de firma y del rol al invitar; versión vigente de un documento; franja lateral del ítem activo |
| Tinta (datos y cifras) | Códigos y variables en mono, porcentaje y barra de avance de la invitación al Portal, conteos, el nombre en el saludo de marketing |
| Neutro (en línea) | Rótulos en mayúscula (`--ink-soft`, como `.studio-eyebrow`), eyebrows con clase (sin color en línea), asterisco de obligatorio, iconos informativos, fichas de icono de agentes y marketing (`--bg-elevated` y tinta), mapas de tono de mailing (la clave `wine` pinta como `neutral`), puntaje bajo de una ruta |
| Información | Aviso de sugerencia editorial de Claude en noticias web (`--info` e `--info-bg`) |
| Atención | «Falta el almacén» en el resumen oscuro de la invitación (`--warning`) |
| Se queda: identidad | Diploma impreso (26 usos; documento de marca, regla 8, se revisa con los PDF de la fase 4); informe de inspección impreso, wordmark y rótulo del encabezado (2; la banda «muestra» pasa a tinta); franja de la vista previa de la firma de correo (1, regla 8); tarjeta de la Guía con su tinte de marca (6) |

`Avatar`, `Badge` y `EmptyState` son del grupo 1 y no se tocan aquí.

El contrato del grupo 3 congela las cuatro cuentas de identidad (la lista solo baja), mide al menos 150 archivos y trae un mutante. Para `lib/studio` exige cero `"wine"` como valor fuera de las uniones de tipo, mide al menos 300 archivos y al menos 10 uniones que todavía lo nombran, y trae un mutante sobre el rol admin.

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
