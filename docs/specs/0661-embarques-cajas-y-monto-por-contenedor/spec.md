---
sdd: "0661"
title: "Embarques por contenedor: total de cajas para todos y monto a cobrar solo para quien ve dinero"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0012", "0085", "0139", "0543", "0622", "0643"]
confidencialidad: interno
---

# SDD-0661 — Cajas y monto a cobrar en la vista por contenedor

> La cabecera de cada contenedor de `/studio/embarques` (SDD-0643) suma el **total de cajas** a los
> clientes y m³ que ya mostraba. Quien puede ver Facturación (contabilidad y administración) ve además
> el **monto a cobrar** del contenedor, en dólares. Cada cliente, al abrir el contenedor, muestra sus
> cajas junto a «N envíos» y los m³.

## 1. Pedido

Sam, 2026-11-18, en la reunión con la oficina sobre el contenedor 64 y el 65:

1. En la cabecera de cada contenedor, para todos los roles: número de clientes, **total de cajas** y
   total de m³. Sirve para que Alejandro compare con su Excel.
2. **Solo contabilidad** ve además el **monto total a cobrar** del contenedor. Comercial no ve dinero.
3. Al abrir el contenedor, cada cliente muestra sus **cajas**, además de «N envíos» y los m³.
4. Las cajas salen de la misma fuente que la carga del contenedor, para que cuadren con el Excel.

Vocabulario: «contenedor 64», «DDP 64»; nunca «lote». Todo en dólares.

## 2. De dónde salen las cajas

- **Tabla y columna:** `public.consolidation_items.pieces`. Es lo que escribe la carga de consolidados
  (SDD-0543, `scripts/consolidados/lote-sql.ts`): por cada envío del Excel inserta un
  `consolidation_items` con `pieces = cajas` de la fila del envío (la misma cifra que va a
  `warehouse_receipts_cn.boxes` y que la verificación del lote cuadra contra el Excel).
- **Qué fila cuenta:** la asignación vigente de cada embarque, la misma que ya decide en qué contenedor
  va (la `consolidation_items` más reciente por `shipment_id`, SDD-0643). Una fila vieja de un
  embarque que se movió de contenedor no suma.
- **Cómo se suma:**
  - por cliente = suma de `pieces` de los embarques de ese cliente dentro del contenedor;
  - por contenedor = suma de los clientes del contenedor.
  - Con filtros activos, la suma es sobre lo que se ve (igual que los m³ y los envíos de la 0643).
- **Sin dato:** un embarque sin asignación (grupo «Sin contenedor») no tiene cajas de la carga; ese
  grupo no muestra cajas en vez de inventar un 0. El envío FCL del dueño se carga con `pieces = 0`
  (la carga no trae cajas para él) y suma 0, como en el Excel.

## 3. Monto a cobrar

### 3.1 Quién lo ve (decisión)

El criterio de dinero del Studio es el módulo **`invoices`** (Facturación), que está en
`MONEY_MODULES` (`lib/studio/rbac.ts`, candado SDD-0139): por rol lo ven `accounting` y `admin`
(admin ve todo por diseño, SDD-0085); `commercial`, `operations`, `support`, `warehouse` y `marketing`
no. Desde la SDD-0622 una persona puede tener un acceso adicional a un módulo bloqueado, con doble
aviso, motivo y auditoría; ese extra también abre Facturación y por eso también abre este monto.

**Decisión:** el monto se muestra si y solo si `moduleViewDenial(supabase, "invoices") === null`, la
misma comprobación que abre `/studio/facturacion`. Es lo más restrictivo coherente con el sistema: no
se inventa un criterio nuevo («solo `accounting`» dejaría fuera a administración, que ya ve toda la
facturación) y no se abre a nadie que hoy no vea las facturas.

**En el servidor:** `app/studio/(app)/embarques/page.tsx` evalúa el permiso. Sin permiso **no se
consulta** `invoices` y la prop del monto no existe en el payload del componente cliente: el dato no
viaja al navegador. No basta con ocultarlo en la UI.

### 3.2 De dónde sale

- **Tabla:** `public.invoices`, leída con la sesión del usuario (RLS por tenant).
- **Qué facturas son del contenedor:** las que tienen `shipment_id` en uno de los embarques del
  contenedor (asignación vigente, §2). La carga de consolidados crea una factura por cliente y la enlaza
  al primer embarque de ese cliente en ese contenedor; una factura hecha a mano desde un embarque también
  queda enlazada por `shipment_id`.
- **Qué se excluye:** `deleted_at is not null` y `status = 'anulada'`. Los borradores **sí** cuentan:
  son lo que se va a cobrar (la carga del 65 deja sus facturas en borrador).
- **Qué se suma:** `total_amount` (base + IVA) de las facturas en `USD`. Es el monto total facturado del
  contenedor, no el saldo: lo que pidió Sam es el total a cobrar para comparar con el Excel.
- **Otra moneda:** el sistema trabaja en dólares. Si alguna factura del contenedor está en otra moneda,
  no se convierte aquí: se suma solo lo que está en USD y la cabecera dice cuántas facturas quedaron
  fuera («+ 1 factura en otra moneda»).

### 3.3 Sin facturas

El contenedor 64 se cargó sin facturas. Si un contenedor no tiene ninguna factura viva (o todas están
anuladas), la cabecera dice **«sin facturar»**, nunca «$0,00». Si la lectura de facturas falla, la
cabecera dice «monto no disponible» y no inventa un número.

## 4. Pantalla

- Cabecera del contenedor (`emb-cont-header`), junto a los conteos: `N clientes · N envíos · N cajas`
  y los m³ de siempre. Con permiso de dinero, debajo de los m³: «A cobrar $12,345.00», «Sin facturar» o
  «Monto no disponible».
- Cliente dentro del contenedor: «N envíos · N cajas» además de los m³.
- Cajas con punto de miles (`es-VE`). El monto usa `fmtUsd` de `lib/money.ts`, el formato único de
  plata del ERP (decisión del founder 2026-08-11: `$1,234.50`).

## 5. Fuera de alcance

- Sin migraciones. Sin cambios en la carga de consolidados.
- No se toca el saldo, el cobro ni el estado de las facturas.
- La vista sin contenedores (lectura fallida, SDD-0643) no gana cajas.

## 6. Aceptación

1. Para todos los roles con `shipments`, la cabecera de cada contenedor muestra el total de cajas, igual a
   la suma de `consolidation_items.pieces` vigentes de sus embarques visibles.
2. Cada cliente dentro del contenedor muestra sus cajas.
3. Un rol sin vista de `invoices` (p. ej. `commercial`) no dispara ninguna lectura de `invoices` y la
   página no le pasa monto al componente cliente (prueba del servidor).
4. Con vista de `invoices`, el monto es la suma de `total_amount` USD de las facturas vivas no anuladas
   del contenedor; sin facturas dice «sin facturar».
5. Pruebas de las sumas por cliente y por contenedor y del render.

## 7. Evidencia

Se registra en `.agents/handoffs/sdd-0661-embarques-cajas-y-monto.md`.
