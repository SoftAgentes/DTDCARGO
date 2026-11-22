---
sdd: "0661"
title: "Embarques por contenedor: franja de totales y detalle por cliente como en el Excel; dinero solo para quien ve Facturación"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0012", "0085", "0139", "0543", "0622", "0643"]
confidencialidad: interno
---

# SDD-0661 — Totales del contenedor en Embarques

> Al abrir un contenedor en `/studio/embarques` (SDD-0643) aparecen una **franja de totales** (clientes,
> cajas, cajas recibidas y CBM) y el **detalle por cliente como en el Excel** (envíos, cajas, recibidas
> y m³, con la fila «Total del contenedor»). Quien ve Facturación ve además **por cobrar** y
> **cobrado**, en la franja y como columnas. La cabecera cerrada dice clientes, envíos, cajas y m³.

## 1. Pedido

Sam, 2026-11-18, reunión con la oficina sobre el contenedor 64 y el 65 (por el DG). Primer encargo:
cajas en la cabecera, cajas por cliente y monto a cobrar solo para contabilidad. Ese mismo día Sam eligió
el diseño «Franja + Excel» de una maqueta con datos inventados, que reemplaza la parte visual del primer
encargo:

1. Franja de totales arriba al abrir el contenedor, para todos los roles: clientes, cajas, cajas
   recibidas y CBM total.
2. Detalle por cliente como en el Excel: columnas envíos, cajas, recibidas y m³, con la fila final
   «Total del contenedor».
3. Solo contabilidad: por cobrar y cobrado, en la franja y como columnas. Comercial y Logística no ven
   dinero (sí los totales de carga). El monto no viaja al navegador si el rol no puede verlo.
4. El encabezado cerrado conserva clientes, envíos, cajas y m³.

Confirmado por Sam: «recibidas» = cajas recibidas, no dinero. Las cajas salen de la misma fuente que la
carga del contenedor, para que Alejandro compare con su Excel.

Vocabulario: «contenedor 64», «DDP 64»; nunca «lote». Todo en dólares.

## 2. Cajas

- **Tabla y columna:** `public.consolidation_items.pieces`. Es lo que escribe la carga de consolidados
  (SDD-0543, `scripts/consolidados/lote-sql.ts`): por cada envío del Excel inserta un
  `consolidation_items` con `pieces = cajas` de la fila del envío. Es la misma cifra que va a
  `warehouse_receipts_cn.boxes` y que la verificación de la carga cuadra contra el Excel.
- **Qué fila cuenta:** la asignación vigente de cada embarque, la misma que ya decide en qué contenedor
  va (la `consolidation_items` más reciente por `shipment_id`, SDD-0643). Una fila vieja de un embarque
  que se movió de contenedor no suma.
- **Cómo se suma:** por cliente, la suma de `pieces` de sus embarques dentro del contenedor; por
  contenedor, la suma de sus clientes. Con filtros activos se suma lo que se ve, igual que los m³ y los
  envíos de la 0643.
- **Sin dato:** el grupo «Sin contenedor» no tiene carga y no muestra franja ni detalle. El envío FCL
  del dueño se carga con `pieces = 0` y suma 0.

## 3. Cajas recibidas

- **Modelo:** `ContenedoresDeEmbarques.recibidasPorContenedor[contenedor][Shipping Mark]`. Por cliente
  es la cifra de su Shipping Mark en ese contenedor (0 si el contenedor tiene recepción y el cliente no
  tiene cajas recibidas). Por contenedor es la suma de sus clientes.
- **Sin recepción:** si el contenedor no tiene recepción, la franja, la columna y el total dicen «Sin recepción»,
  nunca 0.
- **Fuente (decisión de Sam, 2026-11-18, por el DG: «escaneadas en el almacén de Venezuela al llegar el contenedor»; sin recepción, «sin recepción», nunca 0):** las cajas escaneadas en la
  recepción del almacén de Venezuela de ese contenedor. Son las `warehouse_receipt_ve_boxes` con
  `scanned_at` no nulo del `warehouse_receipts_ve` vivo cuyo `container_code` es el ISO del contenedor
  (comparado sin guiones ni espacios), contadas por `markbox` (`leerRecibidasDeContenedores`, paginada
  con `fetchAllPaged`). Se descartó `warehouse_receipts_cn.boxes`: la carga del Excel la iguala a las
  cajas y nunca diferiría.
- **Lectura fallida o cortada:** no hay datos de recibidas y todo dice «Sin recepción»; no se muestra un número que
  no cuadre.
- Las cajas recibidas son carga, no dinero: se leen para todos los roles.

## 4. Por cobrar y cobrado

### 4.1 Quién lo ve (decisión, confirmada por el DG el 2026-11-18)

El criterio de dinero del Studio es el módulo **`invoices`** (Facturación), que está en `MONEY_MODULES`
(`lib/studio/rbac.ts`, candado SDD-0139). Por rol lo ven `accounting` y `admin` (admin ve todo por
diseño, SDD-0085). `commercial`, `operations`, `support`, `warehouse` y `marketing` no lo ven. Desde la
SDD-0622 una persona puede tener un acceso adicional a un módulo bloqueado, con doble aviso, motivo y
auditoría; ese extra abre la puerta de Facturación, pero no la RLS de la tabla (ver abajo).

**Decisión:** los montos se muestran si y solo si se cumplen las dos condiciones:

1. `moduleViewDenial(supabase, "invoices") === null`, la misma comprobación que abre
   `/studio/facturacion`;
2. el rol es `accounting` o `admin`, que es lo que deja leer la tabla: `invoices_accounting_select`
   (migr 0414) solo abre el SELECT a esos dos roles del propio tenant.

Es lo más restrictivo coherente con el sistema: no se inventa un criterio nuevo («solo `accounting`»
dejaría fuera a administración, que ya ve toda la facturación) y no se abre a nadie que hoy no vea las
facturas. La condición 2 se agregó al registrar la lectura en la frontera SDD-0357, el 2026-11-18. Sin
ella, una persona con el extra de la 0622 pasaría la puerta, leería cero filas y vería «Sin facturar» sin
ser cierto. Esa persona no ve dinero aquí; abrírselo exige cambiar la RLS, con migración y OK de Sam.

**Frontera de lectura de facturas (SDD-0357):** la lectura está registrada en el inventario de
`scripts/__tests__/invoice-read-boundary.test.mjs`
(`lib/studio/embarques-contenedores-queries.ts`: 1) con su candado, su tenant y su uso.

**En el servidor:** `app/studio/(app)/embarques/page.tsx` evalúa el permiso. Sin permiso **no se
consulta** `invoices` y la prop `montos` no existe en el payload del componente cliente: el dato no
viaja al navegador. No basta con ocultarlo en la UI.

### 4.2 De dónde sale

- **Tabla:** `public.invoices`, leída con la sesión del usuario (RLS por tenant).
- **Qué facturas cuentan:** las que tienen `shipment_id` en un embarque del contenedor (asignación
  vigente, §2). La carga de consolidados crea una factura por cliente y la enlaza al primer embarque de
  ese cliente en ese contenedor; una factura hecha a mano desde un embarque también queda enlazada por
  `shipment_id`. Se suman por embarque y después por cliente y por contenedor.
- **Qué se excluye:** `deleted_at is not null` y `status = 'anulada'`. Los borradores **sí** cuentan:
  son lo que se va a cobrar (la carga del 65 deja sus facturas en borrador).
- **Decisión de Sam (2026-11-18, por el DG):** «por cobrar» = total facturado; «cobrado» = lo pagado. **Por cobrar:** `total_amount` (base + IVA), lo facturado. **Cobrado:** `paid_amount`. Ambos solo de
  las facturas en `USD`.
- **Otra moneda:** el sistema trabaja en dólares. Una factura en otra moneda no se convierte aquí: no se
  suma y la franja dice cuántas quedaron fuera.

### 4.3 Sin facturas

El contenedor 64 se cargó sin facturas. Sin ninguna factura viva no anulada, la franja y las columnas
dicen **«Sin facturar»**, nunca «$0.00». Si la lectura de facturas falla, la franja dice «No disponible»
y no inventa un número.

## 5. Pantalla

- **Cabecera cerrada** (`emb-cont-header`): pastillas «N clientes», «N envíos», «N cajas» y los m³. Sin
  dinero.
- **Al abrir el contenedor:**
  1. Franja de totales (`<dl>`): Clientes · Cajas · Cajas recibidas · CBM total; con permiso, además
     Por cobrar · Cobrado sobre `--warning-bg`.
  2. Tabla «Detalle por cliente»: Cliente (nombre + Shipping Mark) · Envíos · Cajas · Recibidas · m³;
     con permiso, además Por cobrar · Cobrado. Fila final «Total del contenedor».
  3. Debajo, el acordeón por cliente con sus embarques (SDD-0643), que también dice «N cajas».
- Cajas con punto de miles (`es-VE`). Los montos usan `fmtUsd` de `lib/money.ts`, el formato único de
  plata del ERP (decisión del founder 2026-08-11: `$1,234.50`).

## 6. Fuera de alcance

- Sin migraciones. Sin cambios en la carga de consolidados ni en las facturas.
- La vista sin contenedores (lectura fallida, SDD-0643) no gana franja ni detalle.

## 7. Aceptación

1. Para todos los roles con `shipments`, la cabecera cerrada dice clientes, envíos, cajas y m³, y al
   abrir aparecen la franja y el detalle por cliente con la fila de total.
2. Las cajas por cliente y por contenedor son la suma de `consolidation_items.pieces` vigentes de sus
   embarques visibles.
3. Las cajas recibidas siguen §3; sin recepción dicen «Sin recepción».
4. Un rol sin vista de `invoices` (p. ej. `commercial`) no dispara ninguna lectura de `invoices` y la
   página no le pasa montos al componente cliente (prueba del servidor).
5. Con vista de `invoices`, por cobrar y cobrado siguen §4.2; sin facturas dicen «Sin facturar».
6. Pruebas de las sumas por cliente y por contenedor y del render.

## 8. Evidencia

Se registra en `.agents/handoffs/sdd-0661-embarques-cajas-y-monto.md`.
