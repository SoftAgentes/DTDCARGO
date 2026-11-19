---
sdd: "0673"
title: "Partir un embarque en dos, corregir sus medidas y anotar la referencia del grupo"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0240", "0476", "0522", "0543", "0560", "0643", "0645", "0661", "0662", "0665"]
confidencialidad: interno
---

# SDD-0673: Partir un embarque, corregir sus medidas y anotar la referencia del grupo

> **El problema.** Un embarque que ya va cargado en un contenedor puede traer la carga de dos clientes. Hoy no hay forma gobernada de:
> - separarlo en dos;
> - corregir sus cajas, CBM y peso sin que se desalineen las tablas;
> - anotar la referencia del grupo de WeChat con el proveedor en China.
>
> **La propuesta.** Dos funciones gobernadas en la base y un campo de texto libre en el embarque.

## 1. Pedido

Sam, 2026-11-18, en la conciliación de un contenedor (por el DG).

Un embarque cargado en un contenedor mezcla la carga de dos clientes. Su «código» era la referencia del grupo de WeChat con el proveedor en China, no la de un cliente (corrección de Sam por el DG, 2026-11-18: es WeChat, no WhatsApp).

Ejemplo inventado: el embarque `DTD-9001` lleva 29 cajas y 1,78 m³. De eso, 21 cajas y 1,38 m³ son del cliente A, y 8 cajas y 0,40 m³ son del cliente B.

Sam pidió dos cosas:
1. un camino para partir ese embarque;
2. un lugar en el embarque para anotar el «grupo de WeChat», coherente con lo que pidió antes para la ficha del cliente.

Sam también confirmó que en ese contenedor hay que corregir dos CBM y una caja para que cuadren con el Excel. Eso exige un camino gobernado para corregir medidas, que hoy tampoco existe (§2.3).

Vocabulario: contenedor o consolidado, nunca «lote». FCL se dice FCL.

## 2. Qué existe hoy

Se midió en el código y en las migraciones, sin leer producción.

### 2.1 Cómo nace un embarque de contenedor

La carga de consolidados (SDD-0543, `scripts/consolidados/lote-sql.ts`) escribe, por cada envío del Excel:

| Tabla | Qué guarda | Medidas |
|---|---|---|
| `shipments` | `code` = remitente del Excel (en la práctica, la referencia del grupo con el proveedor), cliente por Shipping Mark, estado `in_transit` | `volume_m3` = CBM, `weight_kg` = peso. Sin columna de cajas |
| `consolidation_items` | La asignación al contenedor, con copia del Shipping Mark y del nombre | `cbm`, `weight_kg`, `pieces` = cajas |
| `warehouse_receipts_cn` | Recepción `WR-C<n>-<remitente>`, estado `consolidado` | `boxes`, `total_cbm`, `total_weight_kg` |
| `warehouse_boxes` (0240) | Una fila por caja física, con código `DTD-B-NNNNNN` y `seq`. La crea el trigger `warehouse_receipts_cn_sync_boxes` a partir de `boxes` | `cbm` y `weight_kg` como copia opcional |
| `warehouse_receipt_items` | Filas del packing list, como texto con cantidad | La medida va dentro de `notes` |
| `shipment_events` | Línea de tiempo: consolidado, zarpó, en tránsito | — |
| `entity_audit_log` | `shipment_imported` y `warehouse_receipt_cn_imported` | — |
| `invoices` | Un **borrador** por cliente, con `lines[].shipmentCode` | La medida va en `qty` de cada línea |

Las pantallas leen así:
- cajas: de `consolidation_items.pieces` (0661);
- CBM: de `shipments.volume_m3` (0643);
- peso: de `shipments.weight_kg` (0665);
- cajas recibidas: de `warehouse_receipt_ve_boxes` escaneadas (0661).

### 2.2 Guardas que tocan esto

| Guarda | Qué hace | Qué significa para esta spec |
|---|---|---|
| `guard_ve_delivery_completion_trg` (0321) | Un embarque `delivered` no cambia estado, entrega, POD ni `deleted_at`. No tiene salida por variable de sesión | Partir o corregir un embarque entregado no tiene sentido: se bloquea antes de llegar al trigger |
| `shipments_soft_delete_guard` (0476) | `authenticated` no pone `deleted_at` directo | Partir no borra nada |
| `warehouse_receipts_cn_sync_boxes` (0240) | Si `boxes` sube, crea cajas con códigos nuevos. Si baja, borra (lógico) las de `seq` más alto que no estén estibadas | Partir **mueve** cajas existentes y deja `boxes` igual a las filas que quedan, para que el trigger no cree ni borre nada (§4.4) |
| `warehouse_receipts_cn_sync_identity` (0240) | Copia el Shipping Mark de la recepción a sus cajas | La parte nueva nace con el Shipping Mark del dueño nuevo |
| `reassign_shipment_client` (0551, SDD-0645) | Pasa un embarque **entero** a otro cliente, con bloqueos, motivo y auditoría | Es el molde de las dos funciones nuevas. No sirve para partir |
| `soft_delete_shipments_with_audit_reason` (0476) | Borrado lógico gobernado | No se usa |

### 2.3 Lo que falta, con evidencia

1. **No se puede partir.** No hay función ni pantalla para hacerlo.
2. **No se puede crear un embarque dentro de un contenedor cargado.**
   - `assignLooseCargo` (`app/studio/(app)/naviera/actions.ts`) solo acepta contenedores en `consolidando`.
   - La carga de consolidados crea contenedores nuevos, no agrega a uno existente.
3. **No hay camino gobernado para corregir medidas.**
   - La ficha del embarque (`updateShipment`, `app/studio/(app)/tracking/[id]/actions.ts`) cambia `weight_kg` y `volume_m3` con un UPDATE directo, sin motivo ni evento de auditoría.
   - Solo toca `shipments`. `consolidation_items` y `warehouse_receipts_cn` quedan con el valor viejo.
   - Las cajas no se editan en ningún lado: la edición del operario (0070/0072) solo vale con la recepción en `pendiente_consolidacion`.
   - Por eso hoy, si alguien corrige el CBM en la ficha, Embarques muestra el CBM nuevo y las cajas viejas, y la recepción de China guarda el CBM viejo.
4. **No hay dónde anotar la referencia del grupo.**
   - El remitente del Excel termina en `shipments.code`, que es la identidad del embarque.
   - `wechat` existe solo para proveedores (`suppliers_cn`). Ni el embarque ni el cliente tienen grupo.

## 3. Alcance

1. **F1 (migración):**
   - función `split_shipment` (§4);
   - función `correct_shipment_measures` (§5);
   - columna `shipments.group_reference` (§6).
2. **F2 (aplicación, misma spec, con la migración ya aplicada):**
   - en la ficha del embarque, una franja «Carga» con «Corregir medidas» y «Partir embarque» como modales con vista previa (el panel de Embarques queda para una PR siguiente);
   - el campo «Grupo de WeChat»;
   - en un embarque que está en un contenedor, los campos de peso y CBM de la ficha pasan a solo lectura, con un botón a «Corregir medidas». Así se cierra el desalineamiento de §2.3.3.

**Fuera de alcance:**
- grupos de WeChat en la ficha del cliente (spec aparte si Sam la quiere);
- unir dos embarques;
- partir en más de dos de una vez (se puede repetir);
- que la carga de consolidados llene `group_reference` sola (decisión D6, §7);
- cualquier dato real: los ejemplos son inventados.

## 4. `split_shipment`: partir un embarque en dos

### 4.1 Firma y reglas comunes

Firma: `public.split_shipment(p_shipment_id uuid, p_client_id uuid, p_boxes int, p_cbm numeric, p_weight_kg numeric, p_reason text, p_box_codes text[] default null, p_dry_run boolean default false) returns jsonb`.

Reglas:
- `SECURITY DEFINER`, `search_path = ''`, EXECUTE solo para `authenticated`. Lo mismo que 0551, con su preflight y su postflight.
- **Roles:** `operations` o `admin` activos en el tenant de `get_user_tenant_id()` (42501). Ver la decisión D1.
- **Motivo:** de 4 a 1000 caracteres, salvo en la vista previa (22023). Va en `dtd.audit_reason`.
- **Todo o nada,** en una sola transacción, con `FOR UPDATE` sobre el embarque, su línea del contenedor y su recepción.
- Con `p_dry_run` devuelve lo que haría (bloqueos, avisos, medidas resultantes y código nuevo), sin bloquear filas ni escribir.

### 4.2 Qué se parte

Los parámetros `p_boxes`, `p_cbm` y `p_weight_kg` son **la parte que se va** al embarque nuevo. El original se queda con el resto, calculado por resta exacta en `numeric`. Así **el total del contenedor no cambia**: la suma de las dos partes es igual a lo de antes, en cajas, m³ y kg.

Validaciones (22023):
- `1 ≤ p_boxes < cajas del original`: ninguna de las dos partes queda sin cajas;
- `0 ≤ p_cbm ≤ CBM del original` y `0 ≤ p_weight_kg ≤ peso del original`;
- escalas: CBM con 3 decimales y kg con 2, las mismas de las columnas. Si traen más decimales, se rechaza; no se redondea en silencio.

### 4.3 El dueño de la parte nueva

- `p_client_id` es una ficha de cliente **viva, no fusionada y con Shipping Mark**. Se elige con el mismo buscador de «Pasar a otro cliente» (SDD-0645). Respeta SDD-0531: quien no ve nombres no monta el buscador.
- Puede ser el mismo cliente del original, si solo se quiere separar la carga en dos embarques. Puede ser el comodín `DTD-0000` si todavía no se sabe de quién es; después se pasa con 0645.
- **La referencia del grupo no decide el dueño** (§6).

### 4.4 Qué escribe

| Dónde | Original | Parte nueva |
|---|---|---|
| `shipments` | `volume_m3` y `weight_kg` quedan con el resto | Fila nueva: mismo tenant, origen, destino, GPS, servicio, estado y `vehicle_category`; la misma llegada (`arrived_destination_at`, para que el bodegaje no se reinicie) y la misma planificación (`planned_*`, `planning_timezone`); cliente y Shipping Mark de `p_client_id`; CBM y peso de la parte; `code` según D2; `group_reference` heredada (§6). **`notes` va en nulo**: son del dueño original y el nuevo las leería por la API (0416) |
| `consolidation_items` | Su línea vigente queda con el resto en `cbm`, `weight_kg` y `pieces` | Línea nueva en el mismo contenedor, con el Shipping Mark y el nombre del dueño nuevo |
| `warehouse_receipts_cn` | `boxes`, `total_cbm` y `total_weight_kg` quedan con el resto | Recepción nueva `<código de la recepción original>-B` (sufijo libre siguiente si ya existe), mismo almacén, estado y `received_at` |
| `warehouse_boxes` | Conserva las cajas que no se van | Se le **mueven** (`receipt_id`, Shipping Mark y nombre) las cajas de `p_box_codes`, o, si no se pasan, las `p_boxes` de `seq` más alto. Se conserva el código físico de cada caja, porque puede tener la etiqueta impresa |
| `warehouse_receipt_items` | Quedan todas | Sin filas, salvo D4 |
| `shipment_events` | Sin cambios: una nota nueva se vería en el Portal del dueño original | Se copian los estados ya vividos por el original (estado, nota y `occurred_at`), para que su dueño vea en el Portal la misma línea de tiempo. El evento inicial que crea la 0003 queda como «Nace de partir <código original>» |
| `entity_audit_log` | `shipment_split_out` con antes y después de las medidas, el id y el código nuevos, la recepción nueva y los códigos de caja | `shipment_split_in` con el id y el código del original |
| `warehouse_receipt_ve_boxes` | — | Si hay recepción en Venezuela **sin escanear**, las cajas movidas cambian de Shipping Mark y de nombre. Si alguna está escaneada, se bloquea (§4.5) |

Orden dentro de la transacción, para que el trigger de 0240 no cree ni borre cajas:
1. Se inserta la recepción nueva con `boxes = 0`.
2. Se mueven las cajas.
3. Se fijan los dos `boxes` iguales a las filas vivas de cada recepción.

Una postcondición comprueba tres cosas y aborta si alguna falla:
- la suma de las dos partes es igual al total de antes;
- cada recepción tiene tantas cajas vivas como dice `boxes`;
- el contenedor tiene la misma suma de `pieces`, `cbm` y `weight_kg` que antes.

### 4.5 Bloqueos

Se devuelven con `outcome 'blocked'` y la lista de motivos, sin escribir nada.

- Embarque eliminado o de otro tenant (P0002).
- Embarque `delivered` o `cancelled`.
- Sin línea vigente en un contenedor vivo. Partir es para carga de contenedor; un embarque suelto se edita como hoy.
- **Medidas desalineadas.** El embarque, su línea del contenedor y su recepción no dicen lo mismo en CBM, peso o cajas. Se bloquea con el motivo «corrige primero las medidas», para no partir sobre un número que no se sabe cuál es (§5).
- Más de una recepción CN viva del embarque, o ninguna: no se sabe qué cajas mover.
- **Factura viva que ya no es borrador** y que factura el embarque, por `shipment_id` o por `lines[].shipmentCode`.
- **Caja escaneada en Venezuela** entre las que se moverían.
- Caja de `p_box_codes` que no es de la recepción, está borrada o está repetida.
- Reclamo vivo, prealerta viva unida o recepción en orden de despacho viva. Son los mismos bloqueos de 0551.

### 4.6 Avisos

Los avisos no bloquean. Se devuelven en el resultado y van en el evento.

- **Borrador de factura** que factura el embarque. No se toca. Contabilidad lo ajusta antes de emitir y crea el del dueño nuevo si corresponde. Ver D3.
- Documentos del Portal (`shipment_documents`) y avisos programados: se quedan con el original y se cuentan.
- Tarifa congelada (0496) en la recepción: guarda su propio CBM y su monto (`cbm`, `amount_to_invoice`), y la usa lo pendiente de facturar. **No se toca** (es dinero; decisión del DG, 2026-11-18). La del original queda calculada con el CBM entero y la parte nueva no la hereda: contabilidad (administración o contabilidad) la reemplaza antes de facturar.
- El contenedor ya zarpó o arribó: se informa, no bloquea.

## 5. `correct_shipment_measures`: corregir cajas, CBM y peso

Firma: `public.correct_shipment_measures(p_shipment_id uuid, p_boxes int, p_cbm numeric, p_weight_kg numeric, p_reason text, p_dry_run boolean default false) returns jsonb`.

Reglas:
- **Seguridad, roles, motivo, vista previa y todo o nada:** igual que §4.1.
- **Valores:** los nuevos, no la diferencia. Un parámetro nulo deja ese valor como está. Las mismas escalas de §4.2; cajas de 1 en adelante.
- **Qué escribe:** los tres lugares a la vez, para que queden alineados:
  - `shipments.volume_m3` y `weight_kg`;
  - la línea vigente de `consolidation_items` (`cbm`, `weight_kg` y `pieces`);
  - la recepción CN viva (`boxes`, `total_cbm` y `total_weight_kg`).
- **Si suben las cajas,** el trigger de 0240 crea códigos nuevos para las cajas que faltan. Esas cajas no tienen etiqueta impresa, y la vista previa lo dice.
- **Si bajan las cajas,** el trigger borra (lógico) las de `seq` más alto que no estén estibadas. Si no alcanzan las no estibadas, se bloquea.
- **Sin contenedor ni recepción:** se corrige solo `shipments`, igual que hoy pero con motivo y evento.
- **Bloqueos:** entregado o cancelado, factura emitida, orden de despacho viva, más de una recepción CN viva, cajas físicas que no coinciden con el conteo, cajas que se quitarían estibadas o ya en una recepción de Venezuela.
  - No bloquean «medidas desalineadas», porque esta función es justamente la que las alinea.
  - Tampoco bloquean el reclamo ni la prealerta (sí bloquean al partir): no dependen de las medidas y corregir no cambia el dueño ni la carga de nadie más. Partir sí reparte la carga entre dos clientes, y un reclamo o una prealerta del original quedaría sin saber de cuál parte es.
- **Avisos:** borrador de factura, contenedor zarpado o arribado, cajas nuevas sin etiqueta y **tarifa congelada** (no cambia sola; contabilidad la reemplaza).
- **Cajas físicas:** las crea y las borra el trigger de 0240 con la sincronía de la 0241. Desde la 0243 el número de caja es único solo entre las vivas: volver a subir después de bajar no choca. El preflight exige ese cuerpo de la función (md5) y ese índice.
- **Auditoría:** `shipment_measures_corrected`, con el antes y el después de los tres lugares.

## 6. Referencia del grupo

- **Columna:** `shipments.group_reference text`, nula por defecto, con `check` de 1 a 120 caracteres después de quitar espacios.
- **Para qué sirve:** es texto libre. Guarda el nombre o la referencia del grupo de WeChat con el proveedor en China (ejemplo inventado: «Grupo Yiwu juguetes 9001»).
- **Etiqueta visible:** «Grupo de WeChat». La columna tiene nombre genérico, pero la pantalla dice WeChat.
- **Qué no es:** no es el dueño. No decide el cliente, no entra en la facturación ni en el Shipping Mark, y no se usa para asignar nada solo.
- **Al partir:** si el original no tenía referencia, las dos partes quedan con el `code` original como referencia. Así se lee que vienen del mismo grupo. Si ya tenía, la parte nueva la hereda.
- **Quién la ve:** solo el Studio. **El Portal no la muestra**, porque un grupo compartido revela que hay otro cliente. Ver D5.
  - Límite conocido: la policy «shipments portal self read» (0416) filtra por fila, no por columna. Un cliente que consulte la API directamente podría leer el grupo de sus propios embarques. Cerrarlo es otra spec.
- **Edición:** se edita en la franja «Carga» de la ficha con el permiso de editar Tracking, sin motivo y sin evento, igual que las notas del embarque.
- **Búsqueda:** buscar por el grupo en Embarques y en Tracking queda para una PR siguiente.

## 7. Decisiones

**Decididas por el DG el 2026-11-18, con la recomendación de esta spec: D1, D2 y D3.** Sam puede cambiarlas. D4 a D6 quedan con la recomendación hasta que Sam diga otra cosa.

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Quién puede partir y corregir medidas | `operations` y `admin`. Comercial no, porque cambia carga del contenedor, no la relación con el cliente; a diferencia de 0645, que sí incluye a comercial |
| D2 | Código de la parte nueva | `<código original>-B`, y `-C`, `-D`… si se vuelve a partir. El original conserva su código, que ya está en el Excel, en el Portal y en los borradores |
| D3 | Borrador de factura del embarque | Permitir partir y avisar. El borrador no se toca; contabilidad lo ajusta. Una factura emitida sí bloquea |
| D4 | Filas del packing list (`warehouse_receipt_items`) | Quedan todas en el original. Si Sam las quiere repartidas, se agrega `p_item_ids` |
| D5 | ¿El cliente ve la referencia del grupo en el Portal? | No |
| D6 | ¿La carga de consolidados llena `group_reference` con el remitente? | Sí, en una spec siguiente: los envíos ya cargados quedan como están |

## 8. Aceptación

Pruebas de la migración (PGlite, `.test.sql`), con datos inventados:

1. Se parte `DTD-9001` (29 cajas, 1,780 m³, 300,00 kg) en 8 cajas, 0,400 m³ y 80,00 kg para un cliente B:
   - el original queda con 21 cajas, 1,380 m³ y 220,00 kg;
   - nace `DTD-9001-B` con 8 cajas, 0,400 m³ y 80,00 kg;
   - el contenedor suma lo mismo que antes;
   - las 8 cajas movidas conservan su código.
2. Las dos recepciones tienen tantas cajas vivas como dice `boxes`, y el trigger de 0240 no creó ni borró ninguna.
3. Hay eventos `shipment_split_out` y `shipment_split_in` con el motivo. La parte nueva tiene la línea de tiempo copiada.
4. Cada bloqueo de §4.5 da `blocked` sin escribir: entregado, factura emitida, caja escaneada en Venezuela, medidas desalineadas, sin contenedor, caja ajena, `p_boxes` igual al total y escala de más.
5. La vista previa no escribe ni bloquea filas.
6. Sin rol (42501), sin motivo (22023) y desde otro tenant (P0002).
7. `correct_shipment_measures` deja alineados los tres lugares.
   - Subir cajas crea códigos nuevos.
   - Bajar cajas borra (lógico) las de `seq` más alto no estibadas, y bloquea si no alcanzan.
8. `group_reference` rechaza texto vacío o de más de 120 caracteres. El Portal no la lee.
9. Preflight y postflight: `SECURITY DEFINER`, `search_path` vacío y EXECUTE solo de `authenticated`, con PUBLIC revocado.

Pruebas de la aplicación (F2):

10. «Partir embarque» muestra la vista previa con las dos partes y el total del contenedor sin cambios, y pide motivo.
11. En un embarque de contenedor, los campos de peso y CBM de la ficha quedan en solo lectura y llevan a «Corregir medidas».
12. Sin `puedeVerNombres` (SDD-0531), el buscador de clientes no se monta.

## 9. Migración y orden

- **Una migración: `0563_partir_embarque_y_medidas`** (número del DG, 2026-11-18): dos funciones, una columna con su `check` y un comentario.
- **Prioridad del DG:** primero `correct_shipment_measures`, que se necesita para corregir dos embarques reales; después `split_shipment` y `group_reference`.
- **Orden: MIGRATE-FIRST,** igual que 0551.
  - Con la migración aplicada y la app de antes, no cambia nada visible.
  - Con la app nueva y sin la migración, los modales dicen que la acción todavía no está disponible.
  - La columna se lee de forma tolerante.
- **Producción:** aplicarla exige el OK nominal de Sam con el nombre del archivo, el runbook [aplicar-migraciones-prod](../../runbooks/aplicar-migraciones-prod.md) y el DG. Fusionar la PR no la aplica.
- **Para el contenedor real:**
  1. Sam o la oficina corrigen primero las medidas con `correct_shipment_measures`.
  2. Después parten con `split_shipment`.
  3. Cada paso lleva su motivo.
  4. Los números reales no van a Git.

### 9.1 Aplicación en producción

- **Aplicada** el 2026-11-19 a las 01:37:17Z, `version` 20261119013717, con el name `0563_partir_embarque_y_medidas`.
- Archivo aplicado: md5 `0bd55ef482794f52bb0baffdf2376352`, 51433 bytes. El paquete se armó desde el SHA `6ac848871` (#693).
- Verificación PASÓ, con los cuerpos vivos iguales a los del archivo.
- Evidencia en el servidor: `/srv/ops/evidencias/apply-0563-dtd-cargo-20261119T013717Z`.
- OK nominal de Sam, por el DG: «OK, aplica 0563 y 0564» y, para seguir, «si».
- La primera lectura previa abortó sin escribir («sync_boxes_for_receipt no es la de la 0241»). Producción guarda el cuerpo de la 0241 sin sus líneas de solo comentario. La #693 hizo que el preflight aceptara también ese md5.
- Cierre: la espera salió de la línea base, la declaración de degradación se quitó y la migración quedó sellada en `supabase/migrations.lock.json`.

## 10. Allowlist (F1 y F2)

- `supabase/migrations/0563_partir_embarque_y_medidas.sql` y `supabase/migrations-baseline.json` (espera)
- `supabase/tests/0563_partir_embarque_y_medidas.test.sql` y `lib/studio/__tests__/partir-embarque.migration.test.ts`
- el desarme de la 0563 en `supabase/desarmes/` y `supabase/pending-migration-symbol-declarations.json`
- `app/studio/(app)/tracking/[id]/actions.ts`, `page.tsx`, `_components/CargaDelEmbarque.tsx` (nuevo) y `_components/ShipmentDataPanel.tsx` (peso y CBM en solo lectura dentro de un contenedor)
- `app/studio/studio.css` (clases `.studio-ficha-embarque-carga*`, `-modal*`, `-medidas`)
- `lib/studio/rbac.ts` (acciones `correct_shipment_measures` y `split_shipment`)
- `lib/studio/medidas-embarque.ts` y `lib/studio/medidas-embarque-queries.ts` (nuevos), y sus pruebas
- `docs/specs/0673-partir-embarque-y-referencia-de-grupo/`, `docs/specs/README.md`
- `.agents/handoffs/partir-embarque-0673.md`
