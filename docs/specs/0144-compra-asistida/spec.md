---
sdd: "0144"
title: "Compra asistida — renombre, filtros y reglas propias del módulo"
status: draft
author: "Claude Code (ventana Director) + founder"
created: 2026-07-03
updated: 2026-07-03
supersedes: null
superseded_by: null
related: ["0071", "0072", "0044", "0057"]
confidencialidad: interno
---

# SDD-0144 · Compra asistida

> Renombra el módulo **"Órdenes de compra" → "Compras asistidas"**
> (`/studio/ordenes-compra`) con copy sin jerga, filtros por momento de vida y
> columnas configurables (Slice A, aplicado en la ventana Director), y define
> el norte de las **reglas propias de la compra asistida** para la ventana que
> implemente el módulo profundo (Slices B+).

## Contexto y problema

El módulo nació como SDD-0071 con el vocabulario contable del modelo
QuickBooks: "OC de DTD", "OC de cliente", "Bill", "Provenance". Decisión del
founder (2026-07-03): **lo van a usar operadores que no saben qué es una
"OC"** — la pantalla debe explicar sola qué hace el módulo (DTD compra al
proveedor en China por encargo del cliente) y qué compras están pendientes.
Además la tabla no tenía filtros ni búsqueda.

**Qué NO cambia (contrato interno):** el slug `/studio/ordenes-compra`, el id
`purchase-orders` del RBAC, las tablas `purchase_orders`/`purchase_order_items`,
el enum de estados en DB y el correlativo `OC-YYYY-NNNN` (RPC
`next_purchase_order_code`). Solo cambia lo que ve el usuario.

## Slice A — Renombre + filtros + columnas configurables ✅ (esta ventana)

Sin migración, sin tocar transiciones ni el puente OC→Bill.

1. **Renombre visible** (código y DB intactos):
   - Sidebar (`lib/studio/modules.ts`): "Compras asistidas".
   - Título: **"Compras asistidas."** · botón **"Nueva compra"** · cada
     registro se llama **"compra"** (toasts, errores, drawer "Nueva compra
     asistida", submit "Crear compra").
   - Tabs: **"Compras de DTD"** / **"Prealertas del cliente"**.
   - Descripción sin jerga: qué es (DTD compra al proveedor en China por
     encargo del cliente), qué pasa al recibir (se genera sola la cuenta por
     pagar en Tesorería) y qué es la pestaña de prealertas.
   - "Provenance" → **"Vínculos"** (badges "Orden de venta" / "Cuenta por
     pagar" / "Sin vínculos"); "Standalone" → "Sin vínculo".
   - KPIs: Compras · **Abiertas** (borrador+confirmada+recibida) · Facturadas
     · Costo total.
   - Bonus: se corrigió voseo en mensajes de validación/acciones
     ("Indicá/Revisá/Agregá/elegí" → tuteo).
2. **Filtros por momento de vida** (chips + contador):
   `Todas · Abiertas · Facturadas · Cerradas · Canceladas` — "Abiertas" agrupa
   `borrador + confirmada + recibida` (el modelo mental del operador:
   pendientes / no concluidas = dinero en la calle). Default: **Abiertas**.
   Búsqueda por código, Shipping Mark del cliente o proveedor.
3. **Columnas configurables** (metodología del Norte, regla Studio):
   `useColumnConfig` + `<ColumnManager>` (claves `dtd-compras-cols-v1` /
   `dtd-compras-sort-v1`), headers ordenables (Fecha, Costo, Cliente) y fila
   de totales sobre lo filtrado (Σ compras · Σ costo USD).

## Slices B+ — Reglas propias de la compra asistida (otra ventana)

La compra asistida **no es una orden de compra genérica**: DTD pone la plata
por el cliente. El módulo profundo debe modelar esas reglas. Norte propuesto
(cada punto se decide con el founder antes de implementar):

- **B · Cobro al cliente**: hoy la compra genera el Bill (lo que DTD *paga*)
  pero no ata lo que el cliente *debe*. Definir: ¿anticipo obligatorio del
  cliente antes de confirmar? ¿% configurable? ¿factura/cargo automático al
  cliente al confirmar (espejo del Bill)? Relación con la Orden de venta
  (SDD-0072) cuando exista.
- **C · Comisión del servicio**: la compra asistida es un servicio cobrable
  (fee fijo o % del valor de la compra). Dónde se configura (matriz de
  `/studio/servicios` · SDD-0090) y cómo cae en la factura del cliente.
- **D · Ciclo operativo fino**: sub-estados de la vida real (cotizada con el
  proveedor · pagada al proveedor · en producción · lista para embarque) y
  vínculo con la prealerta/embarque cuando la mercancía entra al flujo normal
  China→VE.
- **E · Reglas de gate**: qué bloquea qué — p. ej. no confirmar sin anticipo
  del cliente (gate en DB, patrón SDD-0102), no cerrar con saldo abierto.
- **F · Portal del cliente**: visibilidad de sus compras asistidas (estado,
  hitos) sin exponer costos internos ni proveedor (white-label, regla
  SDD-0066).

## Decisiones abiertas (founder)

1. ¿El correlativo visible sigue `OC-YYYY-NNNN` o se migra a `CA-YYYY-NNNN`?
   (Cambiarlo = migración + RPC nuevo; el código es solo un identificador, la
   UI ya no depende de saber qué significa "OC".)
2. ¿Redirect `/studio/compra-asistida` → `/studio/ordenes-compra`? (Cosmético;
   hoy no hay links externos rotos.)
3. Anticipo del cliente: ¿% fijo por defecto (100%? 50%?) y quién lo puede
   excepcionar?
4. La "metodología de etapas" que el founder implementó en el Norte para
   filtros/etapas del módulo — detallarla en la ventana del módulo profundo
   antes de construir Slice D.

## Criterios de aceptación (Slice A)

- Ninguna cadena visible al usuario contiene "OC" ni "Provenance" ni
  "Standalone"; el código correlativo `OC-…` sigue mostrándose como código.
- Los filtros agrupan estados exactamente: Abiertas = borrador ∪ confirmada ∪
  recibida; Facturadas = facturada; Cerradas = cerrada; Canceladas = cancelada.
- La config de columnas/orden persiste por navegador y reconcilia claves
  nuevas/muertas (contrato de `ColumnConfig`).
- `pnpm typecheck` + `pnpm lint` + tests de `lib/studio/purchase-orders` en
  verde; cero imports nuevos cruzando la frontera público↔ERP.
