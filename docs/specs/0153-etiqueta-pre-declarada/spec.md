---
sdd: "0153"
title: "Etiqueta pre-declarada · la caja nace con el aviso, no con la recepción"
status: in-progress
author: "founder"
created: 2026-07-17
updated: 2026-07-17
supersedes: null
superseded_by: null
related: ["0152", "0105", "0096", "0100", "0031", "0027", "0067"]
confidencialidad: interno
---

# DTD-0153 — Etiqueta pre-declarada

## 1. Resumen en una línea

La caja física existe en el sistema **desde que el cliente anuncia su prealerta**, con
su `DTD-B-NNNNNN` definitivo — así el proveedor pega la etiqueta real y Yiwu **recibe
escaneando** en vez de tipear.

## 2. El problema

`warehouse_boxes.receipt_id` es `NOT NULL` (0240:45). Una caja **no puede existir antes
de llegar al almacén**. Consecuencia directa, verificada en el código:

- `/m/cn/nueva` son 4 pasos **tipeados a mano**: fotos → buscar cliente en una lista →
  escribir cajas/CBM/peso → confirmar. No hay cámara en ese flujo.
- El QR de la etiqueta que el cliente le manda al proveedor **no codifica nada**:
  *"Placeholder de QR (no codifica datos)"* — `LabelsClient.tsx:154`.
- `buildLabels(code, boxes)` (`prealertas/types.ts:110`) genera las etiquetas **al vuelo
  en cada render**. No hay tabla. Todas llevan el mismo `code` de la compra y solo cambia
  el texto "Caja M/N" → **identifica al CLIENTE, no a la CAJA**.

**Venezuela sí escanea** (`/m/ve/bodeguero/recepcion`) porque recibe contra una lista que
ya existe: `warehouse_receipt_ve_boxes` es *"1 row por caja esperada/escaneada …
pre-poblado al crear el receipt según manifest, updated al escanear"* (0067:12).

La asimetría es la clave: **VE recibe contra un manifiesto que hicimos nosotros en China.
China es donde la carga ENTRA al sistema — no hay lista contra qué escanear.** No falta
la pantalla: falta el dato.

## 3. El modelo

```
prealerta (boxes = N)                       ← el cliente anuncia
     │ trigger sync_boxes_for_prealerta
     ▼
warehouse_boxes  status='esperada'  receipt_id IS NULL  code YA asignado
     │            ↑ el proveedor imprime ESTA etiqueta y la pega
     │ trigger sync_boxes_for_receipt · ADOPCIÓN
     ▼
warehouse_boxes  status='recibida'  receipt_id = el receipt real
     │
     ▼  (SDD-0152, sin cambios)          (0067, sin cambios)
   estiba por zonas                    →  recepción en Valencia
```

**Una etiqueta, toda la vida**: de la mesa del proveedor en Yiwu al galpón en Valencia,
el mismo `DTD-B-NNNNNN`.

## 4. Decisiones

| Decisión | Por qué |
|---|---|
| La caja nace en la **prealerta**, no en el packing list | El packing list es opcional y hoy tiene **0 envíos vigentes** en prod. La prealerta es el único punto donde el cliente declara `boxes`. El packing list refina el conteo (Fase 3), no lo origina. |
| **Adoptar**, no re-crear | Si el trigger de recepción creara un segundo juego de codes, la etiqueta que el proveedor ya pegó apuntaría a una caja fantasma. |
| Al bajar el conteo, **des-adoptar** (no borrar) | La caja no llegó, pero su etiqueta existe y está pegada a un cartón que sigue en China. Vuelve a `esperada` y la próxima recepción la adopta. |
| Los codes **jamás se reusan** | `v_base` se calcula sin filtrar `deleted_at`. Reusar un code haría que una etiqueta impresa apunte a la caja equivocada. |
| El camino **sin prealerta no se toca** | Medido 17-jul: de 6 recepciones en prod, **0 tienen `prealerta_id`**. Hoy el 100% de la realidad es "llegó sin aviso" → el operario identifica y el hub etiqueta (SDD-0152). Pre-declarar es el camino nuevo, no el único. |

## 5. Scope

### Incluye

- **Fase 1 · Fundación** (`0244_warehouse_boxes_predeclaradas.sql`)
  - `receipt_id` → nullable · `prealerta_id` FK · `status` (`esperada|recibida`)
  - Constraints de coherencia: origen (receipt **o** prealerta) y `esperada ⇔ receipt_id IS NULL`
  - Unique parcial `(prealerta_id, seq)` — sin él, los NULL de `receipt_id` no colisionan
    y nada impide dos "caja 3" en la misma prealerta
  - `sync_boxes_for_prealerta()` + triggers en `prealertas` (insert · boxes · cancelada)
  - Trigger `require_recibida` sobre `consolidation_box_positions`: **no se estiba lo que
    no llegó** (agujero que abre esta migración — ver §9)
  - RLS: el cliente del portal lee sus cajas (`get_portal_client_tenant/markbox`), fail-closed
  - Backfill idempotente — medido: 2 prealertas vivas → 23 cajas esperadas

  **`sync_boxes_for_receipt` NO se toca.** La adopción (`esperada → recibida`) va en
  SDD-0154, con el escaneo. Motivo verificado: `create_receipt_as_operario` (0045) no
  recibe `prealerta_id`; lo setea un UPDATE **posterior** al insert
  (`app/studio/(app)/cn/actions.ts:257`). Los triggers de 0240 son `after insert` y
  `after update OF boxes` → cuando corren, `prealerta_id` todavía es NULL. Una adopción
  ahí sería código muerto que además colisionaría en `seq` al dispararse. **La adopción
  tiene que ser un acto explícito del operario (escanear), no un efecto colateral.**
- **Fase 2 · Etiqueta real** ✅ — QR escaneable con `&b=<code>` en
  `/portal/compras/[code]/etiquetas` (era placeholder que no codificaba nada) y en
  `/p/[token]` (era `?c=<markbox>` sin caja). `buildLabelsFromBoxes()` arma la etiqueta
  desde `warehouse_boxes`; `listPredeclaredBoxes()` las trae (RLS del portal / admin del
  proveedor). Fallback a `buildLabels()` si la compra aún no tiene cajas. El `DTD-B-NNNNNN`
  va también legible bajo el QR, por si el escáner falla en el galpón.

### Fuera de scope (van en sus propias specs)

- **SDD-0154 · Recepción por escaneo**: escanear → *"es de tal cliente pero no está en
  recepción, ¿recibir?"* → rectificar cantidades → recibir + alerta al cliente y al equipo.
- **SDD-0155 · Estiba por lotes**: escanear 1 → *"lote de 12"* → confirmar → montar las 12;
  posición a lo largo implícita por orden de carga; solo izq/centro/der; lote partido en
  dos contenedores.
- **Packing list como fuente del conteo**: hoy el campo `carton` se calcula en pantalla
  (`cartonRanges()`, ej. `"3-7"`) y **se persiste como `""`** — el numerado del proveedor
  se pierde al guardar. Revivirlo es Fase 3.
- Reconciliar `prealerta.boxes` vs `packing_list_submissions.total_ctns` — hoy divergen y
  nadie los cruza.

## 6. Riesgo conocido

**El flujo depende de que el cliente haga la prealerta, y hoy casi nadie la hace**:
2 prealertas y 0 packing lists en toda la base. Esto no invalida el diseño (el founder
está describiendo el destino, no el presente), pero sí obliga a que **los dos caminos
queden sólidos**: el pre-declarado y el de "apareció sin aviso".

## 7. Verificación

1. `node scripts/verify.mjs` verde, incluido el paso `migrations-applied`.
2. Unit (Vitest): `sync_boxes_for_prealerta` idempotente; adopción parcial (8 de 12);
   des-adopción al bajar conteo; el code no se reusa tras soft-delete.
3. Aplicar a prod **de a una**, con OK del founder nombrando cada migración
   (`docs/runbooks/aplicar-migraciones-prod.md`).
4. `get_advisors(security)` sin hallazgos nuevos tras aplicar.
5. Prueba con carga real — **sin datos de prueba en prod**.

## 8. Agujero que abre esta spec — y cómo se cierra

Hasta hoy **toda** caja de `warehouse_boxes` estaba recibida por construcción
(`receipt_id NOT NULL`). Por eso `stuff_box_as_operario` (0241) busca la caja por `code`
**sin mirar `status`**. Al introducir cajas `esperada`, un operario podría escanear la
etiqueta de una caja que **nunca llegó** y estibarla — la etiqueta existe, el proveedor
la imprimió y la pegó en China.

Peor: si después el cliente baja el conteo de su compra desde el portal, esa caja se
soft-borraría **estando estibada**, y `unstuff_box_as_operario` ya no la encontraría →
carga inamovible del contenedor.

Se cierra con un trigger `before insert` en `consolidation_box_positions` (errcode
`P0128`), **no re-declarando el RPC**: protege el invariante venga por donde venga (RPC,
backfill, fix manual futuro) y evita el drift de re-declarar ~120 líneas. Más el guard
`not exists (… consolidation_box_positions)` en el soft-delete, como segunda barrera.

## 9. Bug colateral encontrado y corregido

`0243_warehouse_boxes_seq_partial_unique.sql` — bug **vivo en prod**, introducido por 0240:
`unique (receipt_id, seq)` es constraint de tabla → no puede ser parcial → cuenta las
soft-borradas. Pero `sync_boxes_for_receipt` calcula el próximo `seq` mirando solo las
vivas. Secuencia `boxes 7 → 5 → 7` (alcanzable desde `/m/cn/recepcion/[id]/editar`, que
hace `boxes: input.boxes`) → `23505 unique_violation` → **se cae la edición entera**.
Fix: índice único **parcial** sobre las vivas. El unique de `code` **no** se toca y no
debe hacerse parcial.
