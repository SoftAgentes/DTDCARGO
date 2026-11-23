---
sdd: "0711"
title: "Studio · Embarques: cajas y CBM por proveedor en el detalle del envío"
status: in-progress
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-23
updated: 2026-11-23
supersedes: null
superseded_by: null
related: ["0012", "0661", "0643", "0522", "0710"]
confidencialidad: interno
---

# SDD-0711 — Embarques: cajas y CBM por proveedor en el detalle del envío

> Pedido de Sam (2026-11-23), textual: «Se debe agregar el total de cajas que tiene cada proveedor», señalando el panel
> «Detalle del envío» (Studio › Embarques). Se le dibujaron dos opciones y eligió «Opción A». Después, textual: «En la
> opción A, que es común, sería bueno que cada producto diga su CBM, porque cada producto tiene CBM separados. O sea,
> que el reporte de información incluya las cajas, el CBM y el volumen». En el sistema CBM y volumen son lo mismo (m³); el panel ya muestra el volumen del envío, así que cada
> proveedor lleva sus cajas y su CBM en m³. El repo es público: sin datos de clientes, montos ni secretos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia.

## 1. Problema

El panel `ShipmentDetailDrawer` muestra Servicio, Subtipo, Origen, Destino, Peso, Volumen y Creado (**C**), pero no
cuántas cajas trae el envío ni cuántas de cada proveedor, aunque la recepción en Almacén China ya las registra.

## 2. De dónde salen los datos (sin migración)

`warehouse_receipts_cn` (migr 0008) trae por recepción `boxes`, `total_cbm`, `supplier_name`, `shipment_id` (se llena al
consolidar), `status` y `deleted_at` (**C**). Cuentan solo las recepciones `status = 'consolidado'` y `deleted_at is
null` (la RLS no esconde las eliminadas, migr 0230). Mismo patrón que `leerRecepcionesPorEnvio` de
`almacen-cn-contenedores-queries.ts`. Lectura con la sesión del usuario (RLS por tenant), sin `service_role`.

## 3. Comportamiento (opción A)

1. **Campo «Cajas»** en la cuadrícula, junto a Peso y Volumen: «14 cajas» / «1 caja».
2. **Sección «Por proveedor»** debajo de la cuadrícula: tabla con Proveedor, Cajas y CBM (m³, coma decimal, `formatCbm`).
   Un proveedor es la suma de sus recepciones (cajas y CBM); se agrupa sin distinguir mayúsculas ni espacios sobrantes.
   Orden: más cajas primero; empate por nombre. Recepción sin proveedor: «Sin proveedor».
3. **Sin recepción consolidada:** el campo dice «Sin recepción» (nunca 0, SDD-0661) y no hay sección.
4. **Lectura fallida o sobre el tope:** el campo dice «No se pudo leer» (decir «Sin recepción» sería falso) y no hay sección.
5. Solo m³; cifras con coma decimal; «contenedor/consolidado», nunca «lote».

**No cambia:** permisos, escrituras, acciones de servidor, el resto del listado. El proveedor chino no es el cliente;
`privacidad-cn.ts` no lo oculta (**C**).

## 4. Accesibilidad

Sección con `aria-labelledby`, tabla con `th scope="col"`, cifras alineadas a la derecha; sin controles nuevos.

## 5. Criterios de aceptación

- **CA-1** El panel muestra «Cajas» con el total y, si hay recepción, la tabla «Por proveedor» con cajas y CBM.
- **CA-2** Dos recepciones del mismo proveedor se suman; «Acme» y « acme » son uno.
- **CA-3** Sin recepción → «Sin recepción», sin sección. Lectura fallida → «No se pudo leer».
- **CA-4** La consulta filtra `status = consolidado` y `deleted_at is null` y devuelve `null` si falla o supera el tope.
- **CA-5** Sin migraciones, permisos ni escrituras. `pnpm verify` (o su subconjunto, anotando SKIPs).

## 6. Allowlist exacta

- `lib/studio/cajas-por-proveedor.ts` (nuevo)
- `lib/studio/cajas-por-proveedor-queries.ts` (nuevo)
- `lib/studio/__tests__/cajas-por-proveedor.test.ts` (nuevo)
- `app/studio/(app)/embarques/page.tsx`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/(app)/embarques/_components/ShipmentDetailDrawer.tsx`
- `app/studio/(app)/embarques/_components/__tests__/ShipmentDetailDrawer.cajas.test.tsx` (nuevo)
- `docs/specs/0711-embarques-cajas-por-proveedor/spec.md`
- índice de specs, solo si `pnpm docs:check` lo exige
- `.agents/handoffs/sdd-0711-embarques-cajas-por-proveedor.md`

## 7. Carril

Pantalla de solo lectura sin migraciones ni permisos: candidata al carril rápido; `node scripts/carril.mjs` decide.

## 8. Fuera de alcance

Peso por proveedor, editar cajas desde el panel, el listado y el resto de pantallas.
