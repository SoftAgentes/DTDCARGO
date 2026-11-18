---
sdd: "0667"
title: "CBM hasta 4 decimales, sin ceros de relleno al mostrar"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0543", "0659", "0661", "0665"]
confidencialidad: interno
---

# SDD-0667 — CBM hasta 4 decimales, sin ceros de relleno

## 1. Pedido

Sam, reunión con la oficina del 2026-11-18 (por el DG): los CBM deben admitir hasta **4 decimales**, porque a
veces hay cargas muy pequeñas, y al mostrarlos **no se rellena con ceros**: se ven solo los decimales que el
valor tiene (máximo 4). Además Sam quiere ver el contenedor 64 en el Studio contra el Excel de carga (peso,
clientes, cajas y CBM) y que los números den **igual** que el Excel.

Ejemplos (formato es-VE, coma decimal): 0.0012 → `0,0012` · 1.5 → `1,5` · 0.12 → `0,12` · 2 → `2`.

**Límite fijado por el DG:** solo visual y de cálculo de pantalla. No cambia cómo se guarda ni se redondea el
dato en la base, ni los cálculos de tarifa.

## 2. Qué se hizo

- **Un solo formateador:** `lib/shared/cbm.ts` → `formatCbm(n, { unit, fallback, locale })`, `roundCbm` (4
  decimales, solo para totales de pantalla) y `cbmPlano` (disponible para archivos; **los CSV no se tocaron**). Por defecto `es-VE`; el
  packing list público del proveedor y el portal de facturas conservan el punto decimal (`en-US`) porque su
  kg y USD ya lo usan. La vista previa de `NumericInput type="volume"` conserva su convención `en-US`.
- **Sitios que ya usan la función** (Studio, móvil y portal): Embarques (franja, tabla por cliente, fila de total, lista y detalle), Tracking (`metrosCubicos`), Cotizador (detalle y tabla), Almacén CN y VE, KPIs de CN, Inventario, Despacho (cola, órdenes activas y drawer), Club, Reportes (incluido embarques sin facturar), Costing, Proveedores, Dashboard, Dirección, drawer de tarifa congelada, móvil (operario CN, bodeguero, camionero), packing list público, y aceptación, detalle de envío y pendiente de factura del portal (estos con punto decimal, como sus kg y USD).
- **Captura:** todos los campos de CBM usan `NumericInput`, que guarda el texto tal cual (no trunca); solo su
  vista previa mostraba 2 decimales y ahora muestra los reales.
- **Totales de pantalla:** se afinan agregados de pantalla (inventario, club, CN, costing, shipment-queries, embarques-contenedores) de 2–3 a 4 decimales con `roundCbm`. No toca nada que se guarde: el de `despacho/actions.ts`, que se escribe en la base, quedó como estaba.
- **CSV:** `comercial-csv.ts` y `operativo-csv.ts` quedan exactamente como estaban (`toFixed(3)`); unificarlos iría aparte y con OK.

## 3. Cómo se guarda el CBM al cargar el Excel (medido en el código, sin leer producción)

Fuente: `scripts/consolidados/modelo.ts`, `lote-sql.ts`; suma de Embarques: `lib/studio/embarques-contenedores.ts`.

1. Cada fila del packing list se lee con todos sus decimales (`cbmFactura`).
2. Se **suman las filas por remitente sin redondear** y el total del envío se **redondea a 3 decimales**
   (`round3`, `modelo.ts` ~433). Ese valor es el que se guarda en `shipments.volume_m3`, que además es
   `numeric(10,3)` (migración 0002): la base **trunca a 3** de todos modos.
3. El total del lote es `round3(Σ de los envíos ya redondeados)` (`modelo.ts` ~493). El cargador avisa si
   difiere de la fila de totales del Excel en más de 0,001 m³.
4. Embarques suma `shipments.volume_m3` (valores de 3 decimales) por cliente y por contenedor, y redondea a 3
   (`embarques-contenedores.ts`); la pantalla además lo mostraba con 2 decimales (`toFixed(2)`).

**Conclusión — es el primero de los dos casos:** el Excel suma los valores completos de cada fila; el sistema
suma el valor **redondeado por envío**. Si el Excel muestra cada fila con N decimales, el sistema puede
diferir del total del Excel hasta ±0,0005 m³ por envío (peor caso ≈ 0,0005 × n.º de envíos), y mostrar 2
decimales lo agravaba (hasta ±0,005 por envío). Con este cambio la pantalla ya no recorta a 2, así que se ven
los 3 decimales guardados, pero **el dato guardado sigue en 3**.

## 4. Decisión para Sam (no implementada)

Para que el total cuadre con el Excel sin sumar decimales de más hay dos reglas:

- **A (recomendada si el Excel muestra 4 decimales por fila):** guardar cada envío con 4 decimales y sumar
  redondeando cada fila a 4 antes de sumar. Requiere ensanchar `volume_m3` y las otras columnas de CBM a
  `numeric(_,4)` y cambiar `round3`→`round4` en el cargador: **migración con OK de Sam**. La propuesta de
  migración (8 columnas más `sync_boxes_for_receipt`) queda en las notas de la sesión, no en el repo.
- **B (sin migración):** conservar 3 decimales guardados y declararlo: el total del contenedor es la suma de
  los envíos a 3 decimales; la diferencia máxima con el Excel es 0,0005 × n.º de envíos.

Mientras Sam elige, la pantalla muestra lo guardado, sin ceros de relleno.

## 5. Fuera de alcance

- Cómo se guarda y se redondea el dato en la base; el cargador de consolidados; la calculadora pública
  (`roundCBM` con `Math.ceil` a 3, que decide cuánto se cobra una carga pequeña: decisión comercial de Sam);
  la RPC de partición de paquetes del bodeguero (3 decimales); los CSV de exportación; **los textos que salen al cliente** (el mensaje de WhatsApp de la cotización, `quote-types.ts`, conserva `toFixed(3)`); y **Naviera** (`NavieraClient`, `AssignCargoDrawer`, `ConsolidationDrawer`, `ContainerPlanView`: KPIs, ocupación y plan de carga con 1 decimal, que son agregados de capacidad con `cbm_capacity` del contenedor), más los porcentajes de capacidad (`toFixed(0)`) de Despacho y Naviera, que no son CBM.

## 6. Aceptación

1. `formatCbm` muestra solo los decimales reales (máx. 4), con coma, y tiene pruebas (0,0012 / 1,5 / 2 / 0,12).
2. Ningún sitio de Studio, móvil o portal formatea el CBM de un registro con `toFixed` ni con decimales fijos; todos usan la función compartida. Excepciones nombradas en §5 (Naviera, CSV, texto de WhatsApp al cliente, calculadora pública).
3. `NumericInput` volumen muestra 4 decimales en su vista previa y envía el texto tal cual.
4. Sin cambios en base, migraciones ni cálculos de tarifa.

## 7. Evidencia

`.agents/handoffs/cbm-cuatro-decimales.md`.
