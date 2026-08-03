---
sdd: "0170"
title: "Portal — ciclo de 5 etapas y Seguimiento total por contenedor"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-28
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0042", "0047", "0101", "0133", "0169"]
confidencialidad: interno
---

# SDD-0170 — Portal · ciclo de 5 etapas + Seguimiento por contenedor

## 1. Decisión aprobada

Cerrar dos brechas del portal contra el Norte (`_norte/portal/app.jsx` ·
`PortalAlertas`), elegidas juntas porque tocan el mismo hub:

1. **El ciclo tiene 5 etapas, no 3.** Faltaban "En casa" (ya en Venezuela) y
   "Recibiste" (en tu puerta).
2. **"Seguimiento total" agrupa por contenedor.** Decisión textual del Norte:
   *"Cuando varias compras viajan consolidadas, se muestran como un solo
   seguimiento (agrupado por contenedor)."*

Segunda tanda de la **Fase 7 del Revestido**, después de SDD-0169.

## 2. Problema

**Etapas.** `lib/portal/alertas.ts` mapeaba **todo** envío a la etapa `envio`, sin
importar su status. Un envío ya entregado seguía apareciendo como "En camino a
ti" en el pipeline. El cliente no tenía forma de separar "viene navegando" de "ya
llegó al país" ni de "ya lo recibí".

**Seguimiento.** La vista pintaba una lista plana: un cliente con 4 compras en el
mismo contenedor veía 4 barras avanzando idéntico, sin saber que eran la misma
caja. La memoria del rediseño ya lo tenía anotado como pendiente ("esa data no
está en la fila del portal").

## 3. Alcance

### 3.1 Las 5 etapas — `lib/portal/alertas.ts`

`AlertStage` pasa de 3 a 5 y aparece `shipmentStage(status)`, que reparte los
envíos con un corte **geográfico** sobre el flow canónico de
`lib/studio/tracking-progress.ts` (`STATUS_FLOW_ORDER`):

| Etapa | Rótulo | Estados de `shipments` |
|---|---|---|
| `envio` | Envío · En camino a ti | `draft`, `in_warehouse`, `consolidating`, `shipped`, `in_transit`, `in_customs`, `exception` |
| `bodegave` | En casa · Ya en Venezuela | `arrived_destination`, `delayed_warehouse`, `out_for_delivery`, `last_mile` |
| `recibido` | Recibiste · Ya en tu puerta | `delivered` |
| — | no se muestra | `cancelled` |

Dos decisiones que se apartan del Norte, a propósito:

- **La descripción de `bodegave` dice "Ya en Venezuela", no "En nuestra bodega".**
  La etapa cubre también el reparto y la última milla; decir "en nuestra bodega"
  de una caja que ya salió a repartir sería mentira. El estado exacto
  (`En reparto`, `Última milla`) sigue visible en la fila.
- **`delayed_warehouse` cae en `bodegave`** porque el flow canónico lo ubica
  explícitamente "al mismo nivel que `arrived_destination`".
- **`exception` se queda en `envio`**: es transversal, no un paso del flow.

Efecto colateral corregido: los envíos **cancelados** ya no aparecen en el hub
(antes entraban como "Envío · Cancelado"). Es el mismo criterio que ya se
aplicaba a las prealertas canceladas.

### 3.2 Agrupación por contenedor

**`lib/portal/consolidation-queries.ts`** (nuevo) — resuelve en **lote** la cadena
`consolidation_items → consolidations → sailings`.

`getShipmentNaviera` (SDD-0101) resuelve UN envío con 5 consultas secuenciales:
servía para el detalle, pero en una lista de N envíos serían **5N**. La versión
batch son **3 consultas fijas** sea N=1 o N=100, sin duplicar dato en `shipments`.

Recibe el admin client (el cliente del portal no tiene RLS sobre
`consolidations`/`sailings`), y **el caller solo pasa ids de `listMyShipments`**,
ya filtrada por `client_markbox`.

**`lib/portal/seguimiento.ts`** (nuevo) — agrupación PURA. Decisiones:

- Envío sin consolidación → grupo de uno. Nunca se pierde un envío por falta de
  dato.
- Una sola compra dentro de un contenedor **no** se rotula "consolidado": no hay
  nada que agrupar.
- **Progreso del grupo = el MÍNIMO de sus envíos.** Van en la misma caja, así que
  en teoría comparten estado; cuando difieren es lag de datos, y conviene quedarse
  corto antes que prometer un avance que la carga más atrasada no tiene.
- Rótulo: nº de contenedor › ref de consolidación › código del envío.
- Ruta `POL → POD` solo si están los dos (no se inventa media ruta).
- Orden: progreso desc, desempate por rótulo → salida determinística.

### 3.3 UI

- Pipeline de 5 pasos con iconos nuevos (`WarehouseIcon`, `CheckIcon`) y dos
  tonos nuevos (`neutral`, `success`). `TONE_COLOR` **solo tiñe iconos y fondos**
  — los rótulos van en `text-ink`, así que el umbral aplicable es 3:1.
- Dos pestañas nuevas: "En casa" y "Recibidos".
- `SeguimientoTotal` pasa de lista plana a tarjetas de grupo: chip
  "Consolidado · N", barra compartida y sub-lista de compras clicables. El envío
  suelto sigue siendo una tarjeta-enlace entera; el consolidado **no** es clicable
  en bloque porque cada compra tiene su propio detalle.

## 4. Fuera de alcance

- Migraciones: **ninguna**. Toda la data ya existe (SDD-0047 / SDD-0101).
- Las 2 brechas que quedan de la Fase 7: asistente de 3 pasos de Nueva compra y
  estado de cuenta (`StatementLedger`).

## 5. Verificación

- `node scripts/verify.mjs` verde.
- 28 tests en `alertas.test.ts` + `seguimiento.test.ts` (11 nuevos de agrupación,
  7 nuevos de mapeo de etapas).
- Manual: cliente con 2+ compras en un contenedor → un solo seguimiento con las
  dos adentro; envío entregado → pestaña "Recibidos".
