---
sdd: "0522"
title: "Borrado auditado de embarques y recepciones de prueba"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0469", "0300", "0509", "0511", "0497", "0394", "0407", "0456", "0416", "0321", "0240", "0465"]
confidencialidad: interno
---

# SDD-0522 · Borrado auditado de embarques y recepciones de prueba

> Sam (admin) puede elegir embarques en `/studio/embarques` y recepciones en `/studio/cn` y
> eliminarlos con un motivo. El borrado es lógico (P2), auditado en la misma transacción, todo o
> nada, y no ocurre si algo vivo depende del registro: la pantalla dice qué lo bloquea. La base lo
> exige por su cuenta (migración `0476_borrado_embarques_recepciones`).

## El pedido

Sam, literal:

> «Requiero de ti también que tenga una opción de borrar los embarques de China, porque yo hice
> muchas pruebas de los embarques, pero no hay una manera de borrarlos. Quisiera eliminar los
> embarques que están ahí, porque muchos de ellos son pruebas, no hay ni uno real. Pero no quiero
> que los elimines tú, quiero que yo tenga una opción de escoger y eliminar los embarques.»

Sus respuestas a las preguntas del Director (2026-10-15):

- «Embarques y recepciones (Recomendado)»: se borran embarques (`shipments`) y recepciones del
  Almacén CN (`warehouse_receipts_cn`).
- «No se borra hasta anular eso (Recomendado)»: con una factura, un gasto u otra dependencia viva no
  se borra, y la UI dice qué lo bloquea.
- Quién borra: sólo admin (recomendación del Director, que Sam no objetó).

## Contexto (main `a8d99acf`)

- **El borrado de embarques no servía.** `deleteShipment`
  (`app/studio/(app)/tracking/[id]/actions.ts:180-197`) y el DELETE de
  `app/api/studio/shipments/[id]/route.ts:138-158` ponían `deleted_at` con un UPDATE por RLS:
  - sin motivo y sin evento de auditoría (AUD-01 §2 exige auditar «eliminar»);
  - sin mirar dependencias;
  - con `moduleEditDenial(…, "tracking")`, no con un permiso de borrar;
  - sin detectar cuándo no tocaba ninguna fila.

  El botón vivía al pie del detalle (`tracking/[id]/_components/FooterActions.tsx:142-149`, modal
  `:267-365`).
- **Ninguna pantalla de listado permitía borrar.** `/studio/embarques` (`EmbarquesClient.tsx`) era
  de solo lectura y cada fila era un `<button>` (`:637-739`). En el Almacén CN,
  `softDeleteReceiptAction` (`app/studio/(app)/cn/actions.ts:896-913`) existía sin UI, aunque
  `AlmacenCnClient.tsx` ya tenía selección múltiple y una barra de acciones (`:118-133`, `:342-358`,
  `:914-1159`) con lotes de hasta 100 (`cn/actions.ts:765`).
- **El Almacén CN no excluía lo eliminado.** `listReceipts`
  (`lib/studio/warehouse-cn-queries.ts:98-108`) y `computeWarehouseKpis` (`:271-293`) no filtraban
  `deleted_at`, y desde la 0230 la RLS tampoco lo hace.
- **El DELETE físico seguía abierto.** `authenticated` tenía `delete` sobre `shipments`
  (`0002_shipments.sql:83`) y `warehouse_receipts_cn` (`0008_warehouses_cn.sql:204`), con policies
  que sólo comparan tenant. `supabase/tests/0416_portal_shipments_tenant_boundary.test.sql:265-267`
  afirmaba que el equipo borra un envío.
- **Un embarque entregado ya no se podía tocar.** Lo impide `guard_ve_delivery_completion_trg`
  (`0321_warehouse_ve_delivery_governance.sql:66-76`).
- **Auditoría.** `shipment` y `warehouse_receipt_cn` están activos en `audit_entity_types`
  (`0258_audit_entity_catalog.sql:113` y `:116`); no hacía falta agregar un tipo. No existían
  `shipment_deleted` ni `warehouse_receipt_cn_deleted`. El CHECK de 0267 exige motivo para todo
  evento `_deleted` (`0267_audit_contract_append_only.sql:354`) y el wrapper de 0294 prioriza
  `dtd.audit_reason` (`0294_audit_d2_human_reasons.sql:71-88`).
- **Cascadas que ya existían.** `cascade_soft_delete_events` marca los eventos del embarque
  (`0003_shipment_events_on_insert.sql:29-50`). El despacho de avisos cancela los de un envío
  eliminado al despacharlos, con `error = 'envío eliminado'` (SDD-0511,
  `lib/studio/notifications/drain-client-notifications.ts:50`). Las cajas (`warehouse_boxes`, 0240)
  NO se retiraban al eliminar su recepción: quedaban vivas, escaneables y estibables.
- **Dependencias medidas en las migraciones** (FK y su `ON DELETE`, o enlace polimórfico):

  | Hacia | Tabla | Dónde |
  |---|---|---|
  | shipments | `invoices`, `expenses`, `supplier_bills` | `0077:30`, `0047:31`, `0088:78` |
  | shipments | `shipment_costs`, `customs_filings`, `tms_routes` | `0100:42`, `0010:59`, `0011:112` |
  | shipments | `currency_conversions`, `partner_ledger_entries`, `supplier_claim_offsets` | `0114:162`, `:203`, `:254` |
  | shipments | `client_claims`, `consolidation_items`, `warehouse_receipts_cn.shipment_id` | `0152:27`, `0096:201`, `0008:74` |
  | shipments | `client_notification_schedule`, `shipment_events`, `shipment_documents` | `0247:93`, `0002:67`, `0086:20` |
  | shipments | `quotes.converted_to_shipment_id`, `expense_alerts` | `0007:32`, `0075:27` |
  | shipments | `prealertas.shipment_id` (sin FK) y `documents` (polimórfico, sin FK) | `0105:96`, `0097` |
  | warehouse_receipts_cn | `warehouse_boxes`, `warehouse_receipt_ve_boxes.source_receipt_cn_id` | `0240:45`, `0067:83` |
  | warehouse_receipts_cn | `prealerta_id`, `sales_order_id` de la propia recepción | `0127:70`, `:77` |
  | warehouse_receipts_cn | `dispatch_order_packages` (polimórfico: `package_kind` + `package_id`) | `0024:421-439` |
  | warehouse_boxes | `consolidation_box_positions` (estiba) | `0241:110-131` |

## Decisión

### Permanencia: P2, como excepción de MP-01

MP-01 (`docs/governance/policies/mp-01.md:67`) pide para la operación logística «borrador sin
movimiento: P2/R2. En proceso: cancelar/cerrar P3/R3». Un embarque `in_transit` de prueba es «en
proceso» por estado. Sam aprueba borrarlo con P2 porque son datos de prueba **sin efectos**: la
regla es que no se borra nada que haya producido un hecho vivo (factura, gasto, aduana, despacho,
recepción en Venezuela…). Esas son exactamente las guardas.

| Campo (SGE-00 §7) | Valor |
|---|---|
| Principio y política | SGE-00.03 · MP-01 §5, fila «Operación logística» |
| Motivo y riesgo aceptado | Sam necesita retirar embarques y recepciones de prueba. Riesgo: borrar con P2 un registro con estado «en proceso» que fuera real |
| Alcance exacto | `shipments` y `warehouse_receipts_cn` sin dependencias vivas (guardas de la 0476), sólo admin |
| Mitigación | Guardas que fallan cerrado; motivo obligatorio; evento por fila; todo o nada; recuperación por base de datos (la fila, su código y sus referencias se conservan) |
| Responsable y aprobador | Sam (founder), 2026-10-15, por las preguntas del Director |
| Revisión | Al construir una UI de restaurar o una papelera (MP-D2), o si aparece un caso real borrado por error |

### Fricción: R3

Motivo obligatorio, consecuencia explícita y permiso especial (MP-01 §3, R3). No se usa HTD-01: la
confirmación ya pide motivo y nombra los códigos.

### Quién: sólo admin, en la base

La RLS sólo compara tenant, así que el rol lo comprueban las RPC: `role = 'admin'` y
`disabled_at is null` en `user_tenants`, para el tenant de `get_user_tenant_id()` (la ÚNICA
membresía activa, 0453). En la app, la capability `delete_shipments` / `delete_warehouse_receipts`
(`[]` = admin) esconde las casillas a los demás (BTN-01 §6: la acción no pertenece al rol).

### Contrato por entidad (MP-01 §7)

| Campo | Embarque | Recepción CN |
|---|---|---|
| Resultado | P2: `deleted_at`, identidad y referencias conservadas | P2, y sus cajas vivas pasan a `deleted_at` |
| Fricción | R3 | R3 |
| Permiso | `delete_shipments` (admin) + RPC admin | `delete_warehouse_receipts` (admin) + RPC admin |
| Consecuencia | Sale de Embarques, Tracking, el Portal y el calendario; se cancelan sus avisos pendientes; el código no se reusa | Sale del Almacén CN y sus KPIs; las cajas se retiran (no se estiban ni se imprimen); el código no se reusa |
| Recuperación | Por base de datos (`deleted_at = null`); sin UI | Igual; las cajas se restauran aparte |
| Motivo | Obligatorio, 4 a 1000 caracteres | Igual |
| Auditoría | `shipment_deleted`, atómico | `warehouse_receipt_cn_deleted`, atómico |
| Retención | La fila se conserva | La fila se conserva |
| Archivos vinculados | Adjuntos (`documents`, `shipment_documents`) se conservan; `related_files: []` | Fotos e items se conservan |

### Guardas

Bloquean (y su contraparte no):

| Embarque | Bloquea si | No bloquea |
|---|---|---|
| `already_deleted` | ya tiene `deleted_at` | — |
| `delivered` | `status = 'delivered'` | cancelado o cualquier otro estado |
| `invoices` | factura viva y no `anulada` (borrador incluido) | anulada o eliminada |
| `expenses` | gasto vivo | gasto anulado (0340 lo marca con `deleted_at`) |
| `supplier_bills` | cuenta por pagar viva y no `anulada` | anulada |
| `shipment_costs` | costeo vivo | — |
| `china_finance` | conversión, libro de socios o compensación de reclamo vivos | eliminados |
| `customs_filings` | expediente de aduana vivo | — |
| `tms_routes` | ruta viva no `cancelado` | cancelada |
| `client_claims` | reclamo vivo (cualquier estado: es evidencia) | eliminado |
| `naviera_consolidations` | en una consolidación viva | consolidación eliminada |
| `cn_receipts` | es contenedor de recepciones CN vivas | recepción eliminada |
| `purchases` | una compra (prealerta) viva no `cancelada` lo apunta (`prealertas.shipment_id`) | cancelada |

Avisan sin bloquear: adjuntos, avisos ya enviados, avisos pendientes (se cancelan) y estimados
convertidos (`quotes.converted_to_shipment_id` queda apuntando a un embarque eliminado).

| Recepción | Bloquea si | No bloquea |
|---|---|---|
| `already_deleted` | ya tiene `deleted_at` | — |
| `consolidated` | su `shipment_id` es un embarque vivo | embarque eliminado |
| `dispatch_orders` | está en una orden de despacho no `cancelada` (`package_kind = 'warehouse_receipt_cn'`) | cancelada; otro tipo de paquete con el mismo id |
| `purchase` | su `prealerta_id` es una compra viva no `cancelada` | cancelada o eliminada |
| `sales_order` | su `sales_order_id` es una orden de venta viva no `cancelada` | cancelada |
| `ve_receipts` | una caja suya está en una recepción de Venezuela viva | recepción VE eliminada |
| `stowed_boxes` | una caja suya está estibada (`unstuffed_at is null`) en una consolidación viva | desestibada o consolidación eliminada |

Por qué estas además de las que listó el Director:

- **`purchases` (embarque)**: `prealertas.shipment_id` no tiene FK, pero el Portal deduplica las
  alertas de la compra por ese enlace (`lib/portal/alertas.ts:16`). Borrar el embarque escondería la
  compra del cliente.
- **`sales_order`, `ve_receipts`, `stowed_boxes` (recepción)**: una recepción con orden de venta
  puede haber facturado (0127/0128); una ya recibida en Venezuela o estibada está consumida por otro
  proceso (MP-01 §4, punto 2).
- **Compra de la recepción**: se BLOQUEA, no se revierte. Revertir dejaría que alguien des-reciba la
  compra (`recibida` → `en_camino`) y las cajas `recibida` → `esperada` desde un borrado, una
  transición de negocio que no le corresponde a esta acción. Primero se desvincula la recepción.

Para eliminar un contenedor con recepciones consolidadas: se sacan las recepciones del contenedor
(su estado vuelve a pendiente, `cn/actions.ts:512` en main, y la alerta de gastos se revierte,
`:542`), se
eliminan las recepciones y después el contenedor.

## Diseño

### La migración

`supabase/migrations/0476_borrado_embarques_recepciones.sql`:

1. `set lock_timeout = '5s'` y `statement_timeout = '30s'` (`:104-105`); se restauran al final.
2. `do $preflight$` (`:107`) falla cerrado con mensajes sin ids ni códigos. Exige:
   - los roles de la API y las dos tablas con RLS;
   - cada columna que leen o escriben las RPC, en las 27 tablas;
   - las etiquetas de enum con que comparan las guardas (`delivered`, `anulada`, `cancelado`,
     `cancelada`, `shipment`);
   - que el CHECK de `client_notification_schedule.status` admita `canceled`;
   - `append_audit_event` SECURITY DEFINER con `search_path` vacío y ejecutable por quien aplica;
   - los tipos de entidad activos y `get_user_tenant_id()` SECURITY DEFINER;
   - que quien aplica (dueño de las funciones) tenga BYPASSRLS y SELECT/UPDATE sobre esas tablas:
     si la RLS le escondiera una factura, la guarda la daría por inexistente;
   - funciones y triggers con los nombres de la migración ausentes o con su forma final;
   - una huella md5 del catálogo vecino (triggers, policies, ACL y RLS de las tablas que toca;
     writer de auditoría y funciones vecinas; tipos de entidad), que el postflight exige intacta.
     La ACL excluye sólo el DELETE de `authenticated` sobre las dos tablas.
3. Internos, sin EXECUTE para nadie más que su dueño:
   - `soft_delete_admin_tenant_internal()` (`:379`): tenant del admin activo; 42501 si no;
   - `soft_delete_ids_internal(uuid[], integer)` (`:409`): ids distintos y ordenados; 22023 si la
     lista es nula, vacía, con nulos o pasa del tope;
   - `shipment_delete_blockers_internal` (`:438`) y `warehouse_receipt_cn_delete_blockers_internal`
     (`:501`): una fila por id del tenant con `blockers` y `warnings` (jsonb tipo → conteo). **La
     lectura y el borrado usan la misma función**: deciden lo mismo.
4. Lecturas para la UI, SECURITY DEFINER, sólo admin, hasta 500 ids, sólo del tenant propio:
   `shipment_delete_blockers(uuid[])` (`:553`) y `warehouse_receipt_cn_delete_blockers(uuid[])`
   (`:574`).
5. Borrado, SECURITY DEFINER (ve todas las dependencias aunque la RLS de facturas o CxP no se las
   muestre a todos los roles): `soft_delete_shipments_with_audit_reason(uuid[], text)` (`:596`) y
   `soft_delete_warehouse_receipts_cn_with_audit_reason(uuid[], text)` (`:671`):
   - admin, 1 a 100 ids, motivo recortado de 4 a 1000 (22023 si no);
   - `perform … order by id for update` sobre las filas del tenant (orden estable; además frena el
     FOR KEY SHARE de quien inserte una factura o un gasto que apunte a ese embarque);
   - bloqueos por la función interna; **todo o nada**: si un id no existe en el tenant o tiene un
     bloqueo, no se borra ninguno;
   - si aplica: `dtd.audit_reason` sólo para la transacción, `deleted_at = now()` con conteo exacto
     (40001 si no cuadra), avisos `scheduled` → `canceled` con `error = 'envío eliminado'`
     (embarques) o cajas vivas → `deleted_at` (recepciones), y se restaura el motivo previo;
   - devuelve una fila por id: `outcome` ∈ `deleted` · `blocked` · `not_found` · `held` y sus
     `blockers`. `not_found` no distingue otro tenant de inexistente (no enumera).
6. `revoke all` de los cuatro roles y `grant execute` sólo a `authenticated` en las cuatro RPC
   (`:742-749`).
7. Triggers de auditoría AFTER UPDATE con `WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT
   NULL)`: `shipments_audit_soft_delete()` (`:752`) y `warehouse_receipts_cn_audit_soft_delete()`
   (`:792`), SECURITY DEFINER. Escriben con `append_audit_event`:
   - actor `user` + `auth.uid()`, o `system` sin principal;
   - motivo de `dtd.audit_reason` o «Embarque/Recepción eliminado/a sin motivo indicado (SDD-0522).»;
   - antes y después de `deleted_at` y `status`;
   - payload `permanence: P2`, `consequence`, `recovery: database_only`, el código y
     `related_files: []`;
   - correlación `sdd-0522:<tabla>:<txid>`, compartida por el lote; sensibilidad `restricted`.

   Si el evento falla, falla el borrado.
8. Guarda BEFORE UPDATE con el mismo WHEN, `soft_delete_requires_governed_rpc()` (`:833`),
   SECURITY INVOKER: si `current_user` es `authenticated` o `anon`, 42501. Dentro de la RPC
   SECURITY DEFINER `current_user` es su dueño y pasa; `service_role` y `postgres` también. Así «sólo
   admin» y las guardas no se saltan con un UPDATE por PostgREST. Restaurar (`deleted_at` a NULL) no
   se toca. **Es un objeto que el Director no pidió**: sin él, cualquier miembro con Tracking seguía
   eliminando por PostgREST sin guardas (con evento, pero sin control). Es el mismo patrón de
   `guard_ve_delivery_completion` (0321), que exige la RPC gobernada para entregar.
9. `do $triggers$` (`:855`) crea los cuatro triggers sólo si no existen.
10. `revoke delete … from authenticated` en las dos tablas (`:906-907`), como 0394, 0407 y 0456.
    `service_role` conserva el suyo (rollback técnico de `createReceiptAction`). Comentarios de
    tabla con la regla (`:909-912`).
11. `do $postflight$` (`:914`): forma final, una sola firma por nombre, ACL exacta, dueños de los
    triggers capaces de escribir el evento, los cuatro triggers con su definición, sin DELETE para
    `authenticated` ni `anon` y con SELECT/INSERT/UPDATE intactos, y la huella idéntica.

Sin backfill. Reaplicar no crea ni cambia nada.

### Locks y tiempos (PostgreSQL 17, fixture del contrato)

- **Primera aplicación**: `ShareRowExclusiveLock` (CREATE TRIGGER) y `ShareUpdateExclusiveLock`
  (COMMENT) sobre `shipments` y `warehouse_receipts_cn`, más `RowExclusiveLock` sobre
  `pg_description`, hasta el COMMIT. Bloquean escrituras sobre esas dos tablas, no lecturas. El
  resto: `AccessShareLock` (31 tablas y 1 índice de `public` en PGlite). 147 ms en Docker
  (`postgres:17`, con el arranque de psql) y 41,8 ms en PGlite 0.5.8.
- **Reaplicación**: sólo `ShareUpdateExclusiveLock` (COMMENT); 27,5 ms en PGlite.
- **Contención** (Docker, dos sesiones): con un UPDATE sin confirmar sobre `shipments`, la 0476 cortó
  a los **5,16 s** por `lock_timeout` en el bloque de triggers y se revirtió entera: 0 funciones y 0
  triggers. Una sesión nueva quedó con `lock_timeout` 0. Mientras espera, también esperan las
  escrituras sobre esas tablas: aplicar en baja actividad y reintentar si corta.
- Medido sobre la fixture del contrato, no sobre el schema completo; `schema-rebuild` de
  `pnpm verify` aplica la 0476 sobre todas las migraciones del repo.

### La aplicación

- **Capabilities** (`lib/studio/rbac.ts`): `delete_shipments: []` y `delete_warehouse_receipts: []`,
  con la nota de que la base exige admin por su cuenta.
- **Regla pura** (`lib/studio/borrado/reglas.ts`):
  - `parseBloqueos` falla cerrado: una clave desconocida (una guarda futura) cuenta como `otro` y
    bloquea; un valor raro cuenta 1; algo que no es objeto bloquea;
  - `shipmentDeleteBlockReason(info)`: el texto de la casilla deshabilitada y del error del servidor
    (patrón `quoteDeleteBlockReason`, SDD-0300); sin información, bloquea;
  - `shipmentDeleteWarningsSummary`, `receiptDeleteBlockers` (tipos para traducir),
    `receiptBoxesToRetire`, `normalizarLote` (1 a 100 uuid distintos) e `interpretarFilas` (todo o
    nada; si las filas no cuadran con lo pedido, `sin_confirmar` y nunca «eliminado»).
- **Servidor** (`lib/studio/borrado/servidor.ts`): lecturas en tramos de 500 (`null` si fallan) y
  las dos RPC de borrado. El error crudo va al log, nunca a la pantalla.
- **Acciones** (todas con `capabilityDenial` al tope, antes de tocar nada):
  - `deleteShipmentsAction(ids, reason)` (`app/studio/(app)/embarques/actions.ts`, nueva);
  - `deleteShipment(id, reason)` de Tracking, que redirige sólo si borró;
  - el DELETE de `/api/studio/shipments/[id]` con body `{ "reason": "…" }`: 409 con los bloqueos,
    404 si no existe, 403, 400 o 500;
  - `deleteReceiptsAction(ids, reason)` (reemplaza a `softDeleteReceiptAction`), con códigos de
    error bilingües y el porqué de cada recepción bloqueada.
- **Rollback de `createReceiptAction`**: pasa al cliente admin, acotado al id y al tenant; con el de
  sesión fallaría por el revoke y dejaría una recepción sin items. Ahora el error se registra.
- **Listados**: `listReceipts` y los tres conteos de `computeWarehouseKpis` piden
  `.is("deleted_at", null)`.

### La UI

- **`/studio/embarques`** (`EmbarquesClient.tsx`), sólo con la capability:
  - la fila pasa a `[casilla | botón con el resto]`: la casilla queda FUERA del `<button>` (HTML
    válido). El botón usa las mismas columnas sin la primera, así no se desalinea del encabezado;
  - la fila bloqueada tiene la casilla deshabilitada y el motivo a la vista, asociado con
    `aria-describedby` (BTN-01 §6);
  - una casilla por cliente en el encabezado del grupo elige sólo los que se pueden eliminar;
  - la barra («N seleccionados» · «Cancelar selección» · «Eliminar…» en `danger`) aparece sólo con
    selección y se deshabilita con más de 100, diciendo cuántos quitar;
  - el `ConfirmDialog` `danger` con motivo obligatorio, los códigos, las consecuencias y lo que se
    conserva; el foco inicial es Cancelar; un error queda dentro del diálogo;
  - un solo aviso de resumen (`toast.show`, AVS-01);
  - si no se pudo leer qué bloquea: «No se pudo comprobar qué embarques se pueden eliminar. Recarga la
    página.» y sin casillas.

  Barra, diálogo y aviso viven en un panel que sólo se monta con selección: el diálogo es hermano de
  la barra porque la barra tiene `transform` y `backdrop-filter`, que la vuelven el contenedor de un
  hijo `position: fixed`.
- **`/studio/cn`** (`AlmacenCnClient.tsx`): «Eliminar…» al final de la barra de selección que ya
  existía, separado. Si algo elegido está bloqueado, el botón se deshabilita y la barra dice cuáles
  y por qué (tres, y «Y N más»). El mismo diálogo, bilingüe (es-VE y zh-CN), con las cajas que se
  retiran.
- **Tracking** (`FooterActions.tsx`): «Eliminar envío» sólo con la capability; el modal pide motivo
  además del código y dice la consecuencia real (ya no «puede recuperarse desde Supabase»).

### Contrato de acción (BTN-01 §8)

| Campo | Embarques | Recepciones |
|---|---|---|
| `actionKey` / `verb` | `shipments.soft_delete` / Eliminar | `warehouse_receipts_cn.soft_delete` / Eliminar |
| `outcome` | Salen de Embarques, Tracking, el Portal y el calendario; avisos pendientes cancelados; `shipment_deleted` | Salen del Almacén CN; cajas retiradas; `warehouse_receipt_cn_deleted` |
| `role` / `risk` | destructive / critical | destructive / critical |
| `permanence` / `friction` | P2 (excepción de MP-01) / R3 | P2 / R3 |
| `permission` | `delete_shipments` + RPC admin | `delete_warehouse_receipts` + RPC admin |
| `preconditions` | 1 a 100 elegidos, ninguno bloqueado, motivo de 4 a 1000 | igual |
| `buttonType` | `button` (abre) y `submit` (confirma en el diálogo) | igual |
| `idleLabel` / `loadingLabel` / `successLabel` | «Eliminar…» · «Eliminar embarques» / «Procesando…» / «N embarques eliminados. Ya no aparecen…» | «Eliminar…» · «Eliminar recepciones» / «Procesando…» / «N recepciones eliminadas…» |
| `errorRecovery` | Error dentro del diálogo, con el porqué por código; reintento | igual, bilingüe |
| `audit` | `{ required: true, eventKey: "shipment_deleted" }` | `{ required: true, eventKey: "warehouse_receipt_cn_deleted" }` |
| `correlationId` | `sdd-0522:shipments:<txid>` en la base; el aviso no lo muestra | `sdd-0522:warehouse_receipts_cn:<txid>` |
| `afterSuccess` | `remove-from-view` (se revalida la lista) | `remove-from-view` |
| `undo` | `{ available: false }`: se recupera por base de datos | igual |

## Evidencia

Todo con fixtures sintéticos y rollback. Cero lecturas o escrituras en producción.

### Contrato SQL

`supabase/tests/0476_borrado_embarques_recepciones.test.sql` corre con `psql` (Docker,
`scripts/run-sql-tests.mjs` en verify) y en PGlite (`lib/studio/__tests__/
borrado-embarques-recepciones.migration.test.ts`, para el CI sin Docker).

- Aplica las migraciones REALES 0258, 0261, 0267, 0294 (auditoría), 0002, 0003, 0009 (embarques),
  0008 (Almacén CN), 0230, 0240 (cajas) y 0321 (entrega). Las tablas que sólo leen las guardas van
  como dobles mínimos con las columnas de producción.
- **215 aserciones**, idénticas en Docker (`postgres:17`) y en PGlite:

| Sección | Qué defiende |
|---|---|
| 1. RED (`:519`) | Sin borrado físico (embarque y recepción) ni UPDATE directo de `deleted_at` (admin, operations, warehouse); el equipo sigue editando los demás campos |
| 2. Forma (`:551`) | Timeouts restaurados; ni huella ni motivo en la sesión; seguridad, `search_path` y EXECUTE de las 11 funciones; FOR UPDATE ordenado y la misma regla en lectura y borrado (sobre el `prosrc`); los 4 triggers; ACL cambiada SÓLO en el DELETE de authenticated; policies, triggers y funciones ajenas intactos; sin filas ni eventos al aplicar; reaplicar no cambia nada |
| 3. Quién (`:701`) | Los 6 roles no admin, el admin desactivado y el de dos membresías: 42501 en las cuatro RPC; sin sesión, anon y service_role: 42501; motivo nulo, vacío, en blanco, de 3 y de 1001: 22023; ids nulos, vacíos, con nulos o 101: 22023; 100 entran; 501 en la lectura: 22023 |
| 4. Lectura (`:763`) | Sólo el tenant propio; bloqueos y avisos exactos |
| 5. Guardas (`:791`) | Cada una de las 15 de embarques y 7 de recepciones bloquea sola, sin eventos ni efectos |
| 6. Todo o nada (`:829`) | Lote mixto: el libre queda `held`; otro tenant e inexistente: `not_found` sin código; nada borrado, sin eventos, avisos ni cajas tocados |
| 7. Embarques (`:865`) | Lote de 10 con todas las contrapartes (anulada, eliminada, cancelada) y un duplicado; motivo recortado y el del caller restaurado; un evento por fila con actor, motivo, antes/después, payload exacto, sin datos del cliente y una sola correlación; eventos del timeline marcados; aviso programado cancelado y el enviado intacto; adjuntos y estimado intactos; el código no se reusa (23505); borrar dos veces se bloquea; el admin de B borra lo suyo |
| 8. Recepciones (`:938`) | Lote de 10 con contrapartes; cajas retiradas sólo de las borradas; motivo restaurado; evento exacto, sin datos del cliente |
| 9. Atomicidad (`:975`) | Con el tipo de entidad inactivo no se borra nada; service_role sí puede y queda como `system` con el motivo por defecto, y conserva el DELETE físico; restaurar no escribe evento; volver a borrar sí; mover `deleted_at` no |

- **Control rojo** (`-v apply_fix=false`): falla en la primera aserción, «el equipo borró
  físicamente un embarque por la API», en psql y en PGlite.
- **Drift** (PGlite, 8 casos): RLS apagada, una columna que leen las guardas, una etiqueta de enum
  renombrada, un tipo de entidad inactivo, el writer sin SECURITY DEFINER, avisos sin `canceled`,
  una función ajena y un trigger ajeno con los nombres de la migración. Todos abortan en el preflight
  con su mensaje, sin uuid ni códigos.
- **Mutantes de la migración** (PGlite, 76): sin el postflight (con su huella limpia, para que no
  mueran por la huella que dejaría en la sesión), salvo seis que van con él. Mueren todos, cada uno
  con la aserción que el test nombra:
  - frontera de la API (revokes, guardas BEFORE);
  - quién (sin rol admin, sin membresía, anon con EXECUTE, RPC INVOKER);
  - entrada (motivo, topes, nulos);
  - cada guarda y cada contraparte;
  - todo o nada, incluido el **borrado parcial** (aplica los libres, salta los bloqueados y sus
    efectos), que sólo caza el lote mixto de la sección 6;
  - tenant, motivo restaurado, avisos (sin cancelar y cancelando lo enviado), cajas y FOR UPDATE;
  - auditoría (nombre, trigger, error tragado, antes con `new`, payload, correlación, actor);
  - postflight (revoke, ACL, INVOKER, condición del trigger, guarda, catálogo vecino).

  Muertes revisadas por su causa: «sin todo o nada» muere por la red del conteo exacto (40001) y por
  eso se agregó el mutante de borrado parcial, que la esquiva; las guardas de entrega, factura y
  consolidada mueren en la lectura (sección 4), que usa la misma función.
- **Equivalentes, documentados**: quitar `ut.disabled_at is null` del helper (`get_user_tenant_id`
  ya sólo devuelve la membresía activa) y quitar el tenant del UPDATE (sólo se aplica si todos los
  ids se encontraron en el tenant). Son defensa en profundidad.

### Aplicación (Vitest)

| Suite | Casos |
|---|---|
| `lib/studio/borrado/__tests__/reglas.test.ts` | 30 |
| `lib/studio/borrado/__tests__/servidor.test.ts` | 6 |
| `app/studio/(app)/embarques/__tests__/delete-shipments-action.test.ts` | 21 |
| `app/studio/(app)/tracking/__tests__/delete-shipment-gate.test.ts` (reescrita) | 20 |
| `app/studio/(app)/cn/__tests__/delete-receipts-action.test.ts` | 14 |
| `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx` | 13 |
| `app/studio/(app)/cn/_components/__tests__/AlmacenCnClient.borrado.test.tsx` | 6 |
| `app/studio/(app)/tracking/[id]/_components/__tests__/FooterActions.borrado.test.tsx` | 2 |
| `lib/studio/__tests__/recepciones-sin-eliminadas.test.ts` | 4 |
| `lib/studio/__tests__/borrado-embarques-recepciones.migration.test.ts` | 87 |

- Las acciones usan `user-tenants-double.ts`, que APLICA `.eq`/`.is` y devuelve copias: el admin
  desactivado no pasa porque `getStudioAccess` filtra `disabled_at`. Los listados usan
  `listados-double.ts` con fixture infeliz (la eliminada es la más reciente y cumple los demás
  filtros) y su control del doble.
- **Mutantes de la aplicación** (47, con control verde de 153 casos y restauración verificada por
  sha256): mueren 46. El equivalente: la casilla del cliente sin filtrar los bloqueados, porque
  `elegidos` vuelve a filtrar y un bloqueado nunca queda elegido.
- Ajustes de pruebas existentes, sin debilitarlas: `delete-shipment-gate` reescrita (el
  comportamiento cambió: admin, RPC, motivo); `pantallas-muestran-la-denegacion` pasa `canDelete` y
  escribe el motivo; `route-auth` agrega `capabilityDenial` al mock; `rbac-actions-guard` sube 74 → 75
  archivos y 430 → 431 acciones, con su justificación; `rbac.test` agrega el caso admin-only; la
  0416 deja de afirmar el DELETE físico del equipo y limpia su fila como superusuario.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

- **CORRECTO, en local.** El evento no copia datos personales: antes y después sólo llevan
  `deleted_at` y `status`, y el payload el código (`0476:752-830`). El contrato lo exige: sin nombre
  ni Shipping Mark del cliente (secciones 7 y 8). Los mensajes del preflight y del postflight no
  llevan ids ni códigos (drift).
- **CORRECTO.** No agrega columnas, tablas, buckets ni tratamientos. No borra datos: la fila de
  `shipments` (nombre del cliente, Shipping Mark, dirección de entrega) y la de la recepción se
  conservan con `deleted_at`; adjuntos, fotos e items también.
- **ENCONTRADO, mitigado en parte.** El motivo es texto libre de hasta 1000 caracteres y queda en
  `entity_audit_log.reason` con sensibilidad `restricted`. Mitigación: la etiqueta «Motivo
  (obligatorio, sin datos personales)» en los tres diálogos; la base no lo comprueba.
- **ENCONTRADO, fuera de alcance (MP-D4).** Eliminar NO es purgar datos personales: un embarque o
  una recepción eliminados conservan los datos del cliente. Una solicitud de supresión de una persona
  sigue el proceso especial de MP-01 §4.6 y MP-D4, que esta SDD no implementa.
- **CORRECTO.** El Almacén CN sigue redactando el nombre del cliente a usuarios `region = 'cn'`: el
  diálogo y la barra muestran códigos de recepción, nunca nombres.
- **NO VERIFICABLE:** el estado en producción hasta aplicar la 0476; que los operadores escriban el
  motivo sin datos personales; si algún proceso fuera del repo pone `deleted_at` con `service_role`
  (quedaría auditado como `system`).

## Gobernanza

Políticas abiertas desde `docs/governance/AGENT-BRIEF.md` para «acción, borrado, permanencia,
auditoría» y «componente»: SGE-00, MP-01, BTN-01, AUD-01, AUD-02 y CMP-01.

| Principio / política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 predecible · BTN-01 vocabulario | cumplimiento | «Eliminar» aplica al resultado P2 (BTN-01 §3); la confirmación nombra el objeto: «Eliminar embarques» |
| SGE-00.02 pérdida de trabajo | cumplimiento | Un error deja el diálogo abierto con el motivo escrito (test «el error queda en el diálogo y se puede reintentar»); la selección no se pierde al cancelar |
| SGE-00.03 riesgo y fricción | **excepción** (MP-01) + cumplimiento R3 | P2 para lo «en proceso» de prueba, con la excepción registrada arriba; motivo, consecuencia y permiso especial |
| SGE-00.04 auditoría · AUD-01 | cumplimiento | §1/§4 trigger de dominio en la misma transacción; §8 el writer roto revierte el borrado (sección 9); §3 tenant y actor del contexto, antes/después, motivo, hora del servidor, correlación, fuente y resultado; §6 permanencia, consecuencia, motivo, recuperación y archivos. Límite: `source` es siempre `rpc` |
| SGE-00.05 permisos y tenant | cumplimiento | Capability antes de todo (vitest) y rol admin en la RPC (contrato, sección 3); tenant propio (sección 6); la guarda BEFORE cierra el UPDATE directo y el revoke el DELETE físico |
| SGE-00.06 prevenir errores | cumplimiento | La UI deshabilita con el motivo antes de mutar; la acción valida lote y motivo antes de la base; preflight que falla cerrado |
| SGE-00.07 estado verdadero | cumplimiento | Sólo «todas borradas» es éxito; respuesta que no cuadra = `sin_confirmar`; `pending` bloquea la doble ejecución; el aviso llega después del resultado |
| SGE-00.08 pasos | cumplimiento | Elegir → «Eliminar…» → motivo → confirmar, para hasta 100 a la vez; antes no había camino |
| SGE-00.09 patrón · CMP-01 | cumplimiento | Reusa `ConfirmDialog` (`canonical`), la barra del Almacén CN, el patrón `*_with_audit_reason` (0294/0455), el writer de 0267 y el guardián gobernado de 0321. Sin primitivas nuevas |
| SGE-00.10 accesibilidad | cumplimiento del componente; verificación visual NO EJECUTADA | Casilla fuera del botón, nombre accesible por código, motivo con `aria-describedby`, foco inicial en Cancelar, `role="status"` en los avisos. `/ui-check` advisory hecho; prueba en navegador real pendiente (smoke de Sam) |
| SGE-00.11 lenguaje | cumplimiento | Consecuencia explícita, sin prometer restauración, error con qué hacer, tuteo sin voseo (tests), zh-CN completo |
| SGE-00.12 IA | no aplica | Sin IA |
| MP-01 | excepción (P2 para lo «en proceso» de prueba) | Ver «Permanencia: P2, como excepción de MP-01» |
| BTN-01 | cumplimiento | Contrato de acción en Diseño; destructiva al final y separada; deshabilitar con motivo visible; ocultar a quien no tiene el permiso |
| AUD-02 | no aplica | No cambia quién consulta, conserva ni exporta eventos |
| CMP-01 | cumplimiento | Consumidores nuevos de `ConfirmDialog`; sin variantes |

## Allowlist exacta

- `supabase/migrations/0476_borrado_embarques_recepciones.sql`
- `supabase/tests/0476_borrado_embarques_recepciones.test.sql`
- `supabase/tests/0416_portal_shipments_tenant_boundary.test.sql` (sólo el bloque del equipo)
- `supabase/migrations-baseline.json` (sólo la espera `0476_borrado_embarques_recepciones`)
- `supabase/pending-migration-symbol-declarations.json` (sólo `sdd-0522-borrado-embarques-recepciones`)
- `lib/studio/borrado/reglas.ts`, `lib/studio/borrado/servidor.ts` y sus tests en
  `lib/studio/borrado/__tests__/`
- `lib/studio/rbac.ts` (dos capabilities) y `lib/studio/rbac.test.ts`
- `lib/studio/rbac-actions-guard.test.ts` (dos totales)
- `lib/studio/warehouse-cn-queries.ts` (`listReceipts` y `computeWarehouseKpis`)
- `lib/studio/__tests__/recepciones-sin-eliminadas.test.ts`
- `lib/studio/__tests__/borrado-embarques-recepciones.migration.test.ts`
- `lib/i18n/error-codes.ts`, `lib/i18n/es-VE/errors.ts`, `lib/i18n/zh-CN/errors.ts`,
  `lib/i18n/es-VE/warehouse.ts`, `lib/i18n/zh-CN/warehouse.ts` (claves del borrado)
- `app/studio/(app)/embarques/actions.ts` (nueva), `page.tsx`, `_components/EmbarquesClient.tsx` y
  `__tests__/delete-shipments-action.test.ts`, `_components/__tests__/EmbarquesClient.borrado.test.tsx`
- `app/studio/(app)/cn/actions.ts` (`deleteReceiptsAction`, el rollback y la cabecera), `page.tsx`,
  `_components/AlmacenCnClient.tsx`, `__tests__/delete-receipts-action.test.ts`,
  `_components/__tests__/AlmacenCnClient.borrado.test.tsx`
- `app/studio/(app)/tracking/[id]/actions.ts` (`deleteShipment`), `page.tsx` (`canDelete`),
  `_components/FooterActions.tsx`, `_components/__tests__/FooterActions.borrado.test.tsx`
- `app/studio/(app)/tracking/__tests__/delete-shipment-gate.test.ts`
- `app/studio/(app)/__tests__/pantallas-muestran-la-denegacion.test.tsx` (el bloque de Tracking)
- `app/api/studio/shipments/[id]/route.ts` (DELETE) y `app/api/studio/__tests__/route-auth.test.ts`
- esta spec, `docs/specs/README.md` (generado) y `.agents/handoffs/0522-borrar-embarques-recepciones.md`

## Aceptación

- [x] 1. Un admin elige embarques en `/studio/embarques` y recepciones en `/studio/cn` y los
      elimina con motivo; los demás roles no ven la opción y la base los rechaza.
- [x] 2. Lo que tiene dependencias vivas no se borra: la casilla o el botón se deshabilitan con el
      motivo a la vista, y el servidor rechaza con el mismo texto.
- [x] 3. Todo o nada: un lote con un bloqueado o un id ajeno no borra ninguno.
- [x] 4. Borrado y evento son atómicos; el evento lleva actor, tenant, motivo, antes/después,
      clasificación P2, consecuencia y recuperación, sin datos personales.
- [x] 5. Avisos pendientes cancelados (embarques) y cajas retiradas (recepciones); adjuntos y
      avisos enviados se conservan.
- [x] 6. Sin borrado físico ni UPDATE directo de `deleted_at` desde la API; el rollback de
      `createReceiptAction` sigue funcionando.
- [x] 7. El Almacén CN deja fuera las recepciones eliminadas en el listado y en los KPIs.
- [x] 8. 0476 con preflight, postflight, huella y locks medidos; contrato con control rojo, drift y
      mutantes; espera en el baseline y degradación declarada.
- [x] 9. Tests de la regla, las acciones (con un doble que filtra) y la UI; mutantes muertos.
- [x] 10. Allowlist exacta, matriz de gobernanza y revisión de datos personales.
- [x] 11. `pnpm verify` completo: exit 0, 16 de 17 pasos medidos sin fallos; `migrations-applied`
      sin medir en el worktree (detalle en el handoff).
- [ ] 12. 0476 aplicada en producción con OK nominal de Sam y smoke de Sam: pendiente del Director.

## Riesgos

- **Ventana migrate-first.** Entre aplicar la 0476 y desplegar, «Eliminar envío» y el DELETE de la
  API del código viejo fallan con su error (no borran nada). Se acepta por corta.
- **Carreras sin FK.** El FOR UPDATE frena a quien inserte con FK hacia el embarque mientras se
  decide; los enlaces sin FK (`prealertas.shipment_id`, `dispatch_order_packages`, `documents`) no.
  Una orden de despacho que se cree en el mismo instante podría quedar apuntando a una recepción
  eliminada. Riesgo bajo con datos de prueba.
- **Equivalencia del texto de las guardas.** La UI lee la misma función que el borrado, pero entre
  la lectura y la confirmación algo pudo cambiar: el servidor vuelve a decidir y lo dice.
- **Un estimado convertido** queda apuntando a un embarque eliminado y, por la regla de SDD-0300, no
  se puede borrar desde el Cotizador (ver FUERA DE ALCANCE del handoff).
- **Recuperación sólo por base de datos.** No hay UI de restaurar (MP-D2 la pediría para P2). Al
  restaurar a mano un embarque, sus eventos del timeline y sus avisos cancelados no vuelven solos.

## Fuera de alcance

- El borrado físico, una papelera o un «restaurar» en la UI.
- La purga de datos personales (MP-D4).
- Las consolidaciones de Naviera.
- `POST /api/studio/shipments` sin gate de edición (anotado en el handoff).

## Producción

- Aplicar `0476_borrado_embarques_recepciones` exige el OK nominal de Sam y
  `docs/runbooks/aplicar-migraciones-prod.md`: de a una, en una transacción, con el name exacto.
- **Orden: migrate-first.** El Director aplica la 0476 en el servidor propio y después fusiona la PR
  (que despliega).
- Lecturas previas (catálogo, sin filas), postflight y smoke: en el handoff.
- Después de aplicar: retirar la espera del baseline y la declaración de símbolos.
