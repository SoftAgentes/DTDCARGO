---
sdd: "0665"
title: "Embarques: peso total del contenedor y por cliente"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0543", "0643", "0661"]
confidencialidad: interno
---

# SDD-0665 — Peso total del contenedor y por cliente

> Amplía la SDD-0661. La franja de totales y el detalle por cliente de un contenedor en
> `/studio/embarques` suman el **peso**, junto a clientes, cajas, cajas recibidas y CBM. Así la oficina
> tiene la trazabilidad completa del contenedor en una sola pantalla.

## 1. Pedido

Sam, 2026-11-18, en la reunión con la oficina (por el DG): la oficina quiere la trazabilidad completa del
contenedor en Embarques: CBM por cliente, CBM total, total de clientes, total de cajas y **total de
peso**, que es lo nuevo. Todo lo demás ya está desde la 0661.

## 2. De dónde sale el peso hoy (medido en el código y las migraciones, sin leer producción)

| Dónde | Columna | Quién la escribe | Qué es |
|---|---|---|---|
| `shipments` | `weight_kg` | La carga de consolidados (SDD-0543) pone `peso` del Excel; el Studio permite editarla | Peso del envío |
| `consolidation_items` | `weight_kg` | La carga de consolidados, con el mismo `peso` del Excel | Aporte del envío al contenedor |
| `warehouse_receipts_cn` | `total_weight_kg` | La carga de consolidados, con el mismo `peso` | Recepción en China |
| `warehouse_receipt_ve_boxes` | `weight_kg` | Se copia al crear la recepción en Venezuela (`warehouse-receipt-ve-queries.ts`), desde lo que trae cada caja | Snapshot por caja; **el escaneo no lo cambia** |

Lo que mide el código:

- **Peso declarado (cargado):** existe, y las tres primeras columnas salen del mismo dato del Excel, el
  mismo origen que las cajas de la 0661.
- **Peso recibido:** en Venezuela **no se pesa nada**. El escaneo (`operario_action` / `scan_box`,
  migraciones 0069-0072) solo marca `scanned_at`, el operario y si fue manual. El `weight_kg` de la caja
  en Venezuela es una copia del peso de origen. Si se sumara solo el de las cajas escaneadas, saldría «el
  peso declarado de lo que llegó», no un peso medido.

## 3. Propuesta (decisión para Sam)

**Peso del contenedor = `shipments.weight_kg`.** Es el peso declarado del Excel de carga, sumado por
cliente y por contenedor con la misma regla que el CBM, que ya sale de `shipments.volume_m3`. Así el peso
y el CBM siempre salen de la misma fila del envío. Si alguien corrige el envío en el Studio, se ven los
dos corregidos, en vez de un peso viejo de `consolidation_items` al lado de un CBM nuevo.

**«Peso recibido»: no se muestra por ahora.** La regla de «recibidas» (lo escaneado en Venezuela) no da
un peso medido: daría la suma del peso copiado de las cajas escaneadas, que parece una medición y no lo
es. Para tener un peso recibido de verdad haría falta pesar en Venezuela, con una columna nueva y su
migración. Si Sam igual quiere «peso de las cajas recibidas» (declarado), se agrega como columna con
esa etiqueta exacta, sin migración.

Las dos cosas quedan **pendientes de la decisión de Sam**. El DG dio la propuesta por razonable el 2026-11-18; mientras Sam decide, se implementa.

## 4. Cómo se suma y qué se ve

- Por cliente: la suma de `weight_kg` de sus embarques dentro del contenedor (`stats.totalWeight`, que
  ya calcula `computeClientStats`). Por contenedor: la suma de sus clientes. Con filtros activos se suma
  lo que se ve, igual que el CBM.
- **Envío sin peso** (`weight_kg` nulo): no suma y se cuenta aparte. Un cliente sin ningún peso dice
  «Sin peso», nunca «0 kg». Si en el contenedor hay envíos sin peso, la franja lo dice
  («N envíos sin peso cargado»).
- Franja de totales: Clientes · Cajas · Cajas recibidas · CBM total · **Peso total**, más el dinero para
  quien lo ve (0661 §4).
- Detalle por cliente: Envíos · Cajas · Recibidas · m³ · **kg**, más el dinero; la fila «Total del
  contenedor» también suma el peso.
- Formato: kg con punto de miles y hasta dos decimales (`es-VE`).

**Notas de la revisión independiente (2026-11-18, sobre `6615df8a7`, no bloqueantes; sin código nuevo
en esta PR):**

1. Formatos mezclados en la misma tabla: m³ usa `toFixed` («2.00») y kg usa `es-VE` («1.234,5 kg»).
   Unificar en una PR siguiente.
2. Un peso cargado como 0 explícito muestra «0 kg», no «Sin peso». Decisión para la oficina.
3. Un contenedor sin ningún peso dice «Sin peso», pero no dice cuántos envíos son.
4. Comprobado leyendo el código: `grupo.embarques` es `lista.length`, y `groupShipmentsByClient(lista)`
   pone cada envío en exactamente un cliente, sin filtrar. La suma de `enviosSinPeso` de los clientes se
   compara entonces contra los mismos envíos, y «Sin peso» solo sale cuando ninguno tiene peso.

## 5. Fuera de alcance

- Sin migraciones. Pesar en Venezuela sería otra spec, con migración y OK de Sam.
- Sin cambios en la carga de consolidados ni en la cabecera cerrada (clientes, envíos, cajas y m³, 0661).

## 6. Aceptación

1. La franja muestra el peso total y la tabla una columna kg, por cliente y en la fila de total, para
   todos los roles con `shipments`.
2. El peso es la suma de `shipments.weight_kg` de los embarques visibles del contenedor; un envío sin
   peso no suma y se avisa; un cliente sin peso dice «Sin peso».
3. Pruebas de la suma, del aviso y del render.

## 7. Evidencia

Se registra en `.agents/handoffs/sdd-0665-embarques-peso.md`.
