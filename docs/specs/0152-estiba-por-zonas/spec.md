---
sdd: "0152"
title: "Estiba por zonas — identidad por bulto, captura al cargar y visor isométrico del contenedor"
status: superseded
author: "Claude Code (worktree estiba-por-zonas) + founder"
created: 2026-07-16
updated: 2026-08-02
supersedes: null
superseded_by: "0155"
related: ["0047", "0081", "0096", "0098"]
confidencialidad: interno
---

# SDD-0152 · Estiba por zonas

> Pedido founder 2026-07-16. Que el operario en Yiwu **escanee cada bulto al subirlo
> al contenedor** y marque en qué zona quedó, para que el Studio muestre
> **gráficamente dónde está realmente** la carga de cada cliente antes de consolidar.

## Contexto

Hoy el módulo Naviera (SDD-0047) sabe **cuánto** va en cada contenedor (CBM y peso por
`consolidation_items`) pero no **dónde**. La posición física dentro del contenedor no se
registra en ningún lado: el operario la decide y la ejecuta, y el dato se pierde. Cuando
en Valencia hay que ubicar la carga de un cliente, o cuando un cliente pregunta dónde
está lo suyo, no hay respuesta en el sistema.

**Relevamiento de mercado (2026-07-16).** Se evaluaron SeaRates (el founder está
afiliado), EasyCargo, Gateway Load Planner, 3DPACK.ING, CubeMaster, Cube-IQ, CargoWiz,
PIER2PIER, LoadOptimizer y TruckLoad3D. **Todas resuelven el problema inverso**: son
planificadores teóricos que, dada una lista de bultos con medidas, calculan el acomodo
óptimo *antes* de cargar. Ninguna captura la realidad post-estiba. SeaRates ofrece un
widget white-label embebible y API, útiles solo para planificación previa →
**diferido** (ver Fuera de alcance).

**Decisión de granularidad: por zonas, no por coordenadas.** El contenedor se modela como
una grilla gruesa (3 tramos de largo × 3 de ancho × 2 de altura = 18 zonas). Esto evita
lo caro del mercado: **no hay que medir largo × ancho × alto de cada bulto** (hoy solo se
captura CBM y peso, ver `warehouse_receipts_cn`) **ni hace falta un motor de bin-packing**.
El operario escanea y tapea la zona; eso es todo.

**Decisión de motor gráfico: ninguno.** El repo no tiene ni una librería de visualización
en sus 17 dependencias; todo lo que dibuja data es SVG hecho a mano con tokens
(`app/studio/(app)/reportes/_components/charts.tsx` — *"Simples, sin libs, solo `var(--*)`"*).
18 zonas son ~54 polígonos; three.js (~155 KB gzip), Konva (~150 KB) o PixiJS resuelven
cargas ~400× mayores. El visor va como **server component con SVG inline → 0 KB de JS**.

## Alcance

### Fase 1 · Identidad del bulto
Hoy no existe un ID único por bulto: la etiqueta lleva "MARKBOX + Caja M/N" y el QR es un
placeholder que **no codifica datos** (`app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx`).
Sin código escaneable no hay escaneo.

- Tabla `warehouse_boxes` — una fila por caja física, con `code` único escaneable
  (`DTD-B-NNNNNN`), ligada a la recepción CN y al MARKBOX del cliente.
- Las cajas se materializan al registrar la recepción en CN (extensión de
  `create_receipt_as_operario`). `warehouse_receipts_cn.boxes` sigue siendo el conteo.
- El QR de la etiqueta pasa a codificar `warehouse_boxes.code` (un QR por caja).

### Fase 2 · Zonas y captura
- `container_types.zone_layout jsonb` — la grilla por tipo de contenedor
  (default `{nx:3, ny:2, nz:3}`), configurable.
- Tabla `consolidation_box_positions` — el registro de realidad: qué bulto, en qué
  consolidación, en qué zona, cuándo y quién lo puso.
- Branch `stuff_box` / `unstuff_box` en el RPC `operario_action` (mismo patrón que
  `scan_box` de SDD-0067), con evento `box_stuffed` en `entity_audit_log`.

### Fase 3 · Interfaces
- **Operario** (`/m/cn/estibar/[consolidationId]`): escanear → grilla **plana** 3×3 +
  toggle Piso/Arriba → confirmar. Plana y no isométrica a propósito: el operario tapea
  con guantes y apurado, necesita cero ambigüedad y 44×44 px por celda.
- **Studio**: visor **isométrico 2.5D** como pestaña "Estiba" del `ConsolidationDrawer`
  de Naviera — no es pantalla nueva. Zonas coloreadas por cliente + leyenda textual.
- Paleta categórica nueva por cliente (hoy no existe una: la única del repo tiene 4
  colores y 2 son grises de texto), separada de los tonos semánticos — `--wine` ya
  significa "sobre capacidad" en `utilizationTone()` en esa misma pantalla.

## Fuera de alcance

- **Planificación previa / optimización de acomodo.** El widget de SeaRates
  (`<div id="loadCalculator" data-filter='{"platform":ID}'>` + script) entraría como
  pestaña "Planificar" si el founder lo pide. Es un problema distinto al de esta spec.
- **Medidas por bulto (largo × ancho × alto).** No se capturan; la granularidad por zonas
  no las necesita.
- **Posición exacta 3D / bin-packing.** Descartado explícitamente por el founder.
- **Vista del cliente en el Portal.** Posible evolución; esta spec solo cubre el Studio y
  la PWA del operario.
- **Estiba en Venezuela.** `warehouse_receipt_ve_boxes` (SDD-0067) ya tiene su propio
  flujo de escaneo de recepción; no se toca.

## Diseño

Mockup aprobado por el founder el 2026-07-16 (isométrica 2.5D, ubicación como pestaña
del drawer, grilla plana del operario, paleta categórica). Fija la proyección isométrica
y el algoritmo del pintor usados en la implementación.

El lenguaje visual del contenedor (corrugado vertical, casco) sigue el isológo de marca
`public/brand/container.svg` (registrado en `lib/design-tokens.ts` como `containerSvg`).

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | Captura de realidad, no planificación | Es el diferencial: ninguna herramienta del mercado lo hace |
| 2 | Granularidad por zonas | Evita medir cada bulto y el motor de bin-packing |
| 3 | Cero dependencias gráficas | 18 zonas = 54 polígonos; el precedente del repo es SVG a mano |
| 4 | Visor = server component | 0 KB de JS al cliente; no puede ponerse lento |
| 5 | Operario ve grilla plana, Studio isométrica | La isométrica es para mirar; la plana es para trabajar con guantes |
| 6 | Paleta categórica separada de la semántica | `--wine` ya significa "sobre capacidad" en la misma pantalla |

## Adjuntos

Mockup de decisión (HTML) → ver Diseño. Sin binarios en git.
