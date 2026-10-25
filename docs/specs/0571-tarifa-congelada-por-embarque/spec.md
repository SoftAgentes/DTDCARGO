---
sdd: "0571"
title: "Tarifa congelada por embarque: el precio por CBM queda guardado al recibir en Yiwu"
status: in-progress
author: "founder + Claude Opus 5.5"
created: 2026-10-20
updated: 2026-10-25
supersedes: null
superseded_by: null
related: ["0008", "0016", "0061", "0072", "0269", "0476", "0543", "0567"]
confidencialidad: interno
---

# SDD-0571 — Tarifa congelada por embarque

> Cada recepción en Yiwu guarda su precio por CBM, su mínimo, su CBM medido, de dónde salió el precio, cuándo y quién lo fijó. Ese registro no se edita: un cambio crea otro con motivo y deja el anterior a la vista. En Almacén CN cada fila dice «CBM real · tarifa · a facturar», o «Sin tarifa» en rojo.

**Estado:** diseño aprobado por el Director el 2026-10-20 e implementado en la rama `claude/peaceful-franklin-a3831e`. La migración `0496` espera la revisión de seguridad del Director y el OK nominal de Sam (MIGRATE-FIRST).

## Decisiones del Director, 2026-10-20

«Revisé el diseño de la 0571 (`fccd1941`). **Aprobado, con tus 7 decisiones.**» Las toma por la delegación de Sam del 2026-10-20 (decisión 9). Sobre la sexta (congelar sola al recibir), el servicio de la recepción queda para la 4.2.

### La previa de catálogo del Director (producción, 2026-10-20, sin leer filas)

| Función | md5 vivo (CRLF→LF) | md5 sin espacios | DEFINER | Volatilidad | Config | Contra el repo |
|---|---|---|---|---|---|---|
| `current_studio_role()` | `b7157932457d04df4e8cf7621d212965` | `df8ba5229960ba06888dec61fbec2bc5` | sí | `s` | `search_path=public` | coincide con la 0200 |
| `get_user_tenant_id()` | `5ff0c51c26a49419c34abc78f1d95c37` | `4ce5acd04a577f91ca77b74ebc622c49` | sí | `s` | `search_path=""` | coincide con la 0453 |
| `resolve_price_book(uuid)` | `4f39f4349889a6e5a00bb5d85617751c` | `7004f04b5c3815441a63a99ffab49b4c` | no | `s` | `search_path=public` | **deriva**: la única definición es la 0382 (`c96106507…`); el vivo es ese cuerpo **sin sus dos líneas de comentario** («-- Tope de seguridad…»), y quitándolas da exactamente este md5. La lógica es idéntica |

`shipment_rate_snapshots` no existe en producción. El preflight acepta los dos cuerpos de `resolve_price_book` (repo y vivo) y ningún otro; la prueba en PGlite corre el contrato entero con el cuerpo vivo, y su control rojo (sin aceptar el vivo) aborta.

## Contexto

### El plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`)

- **4.1** (fase 4, adelantada al carril paralelo según «Mi ajuste» del §8): «Tarifa congelada por embarque (`shipment_rate_snapshots`: tarifa, mínimo, fuente estimado / lista del cliente / casa / manual / Excel de Yiwu, fecha, quién, motivo auditado) y cargos del embarque; importador del Excel con reporte "tarifa Excel ≠ tarifa ERP"; fila "CBM real · tarifa · a facturar" y alerta "embarque sin tarifa" en Almacén CN».
- **B12 y §3:** «El precio por CBM no queda guardado en el embarque, ni en la recepción, ni en la orden de venta: solo existe en el estimado (si lo hubo), en el tarifario y en las listas de precios.» «Si al llegar el embarque no tiene tarifa congelada, el sistema **no factura**.»

### Decisión 9, tomada por recomendación el 2026-10-20 (§9 del plan, PR #305)

«**Tarifa por CBM:** se congela al recibir en Yiwu, con el CBM medido allí (500 kg/m³ es la regla y 1.000 la excepción). El orden es estimado aceptado → lista del cliente o aliado → tarifario. El mínimo se cobra. Hay pre-factura informativa al consolidar y la factura sale al llegar a Venezuela, con vencimiento inmediato.» El texto completo de la recomendación agrega: «el Excel se importa como fuente auditada y sus diferencias se aprueban una a una hasta retirarlo; […] exceso de peso según decidas por contenedor».

### Lo que hay hoy (mapa en solo lectura, `main` `eafbd910`)

| Dónde | Qué guarda | Qué falta |
|---|---|---|
| Cotizador público (`lib/calculadora.ts:788`, `calcularEnvioLCL`) | calcula con la tarifa pública (`public_cbm_rate`, 0458) o con `CONFIG.tarifaBaseCBM`; mínimo `min_charge` o `CONFIG.minimoFacturable`; peso incluido de `calculator_settings` (1.000 en producción desde 2026-07-06, `:105-117`) | nada se guarda |
| Estimados `quotes` (`0007:9-36`) | `rate_per_cbm`, `flat_rate`, `rate_used_id`, `status` (`accepted`) | **sin mínimo**; `calcQuoteTotal` (`lib/studio/quote-types.ts:173-195`) es CBM × tarifa; al convertir a embarque la tarifa se pierde (`cotizador/actions.ts:375-438`) |
| Listas de precios (`0382`, `0384`) | `price_books` (`is_house`, `discount_pct`, `base_per_cbm`), `rates.price_book_id`, `resolve_price_book(client)` | — |
| Resolutor (`lib/studio/price-books/price-book-queries.ts:219`, `resolveRateForClient`) | propia → pactada → descuento → casa; devuelve `rateId` y `origen` | lo usa solo el cotizador del Studio |
| Recepción CN `warehouse_receipts_cn` (`0008:52-80`, `0044`, `0127`) | `total_cbm`, `total_weight_kg`, `destination_city`, `sales_order_id`, `payment_status` manual | **sin precio** |
| Consolidación (`cn/actions.ts:426-530` → `findOrCreateConsolidationShipment`) | crea el `C-YYYY-NNNN` **sin cliente ni CBM** | lo resuelve la 4.2 |
| Orden de venta (`0125`, `0128`) | `subtotal_usd`, `total_usd`; la auto-factura prorratea por **cajas** | sin CBM ni tarifa |
| Lote SDD-0543 (`scripts/consolidados/`) | el «precio venta CBM» del Excel, solo dentro de `invoices.lines` | sin entidad propia |

**No existe** ninguna tabla ni columna que congele la tarifa de un embarque.

## Decisiones de diseño (propuestas al Director)

1. **La unidad es la recepción en Yiwu** (`warehouse_receipts_cn`): ahí se mide el CBM, y es por cliente. El contenedor `C-` de hoy mezcla clientes, así que no puede llevar un precio. La tabla conserva el nombre del plan (`shipment_rate_snapshots`) y trae `shipment_id` vacío: lo llena la 4.2 cuando nazca el envío por cliente.
2. **La base deriva los números; la app solo elige la fuente.** La app propone un estimado (`quote_id`) o una fila del tarifario (`rate_id`) y la RPC lee de esas filas la tarifa y el mínimo, y clasifica la fuente (lista o casa, con su origen propia / pactada / descuento) con la misma regla que `resolveRateForClient`. Así nadie puede guardar «casa» con un número inventado. La búsqueda de la ruta por destino (ILIKE) sigue en la app (`resolveRateForClient`), que es quien sabe elegir la fila; la RPC verifica que la fila sea del tenant, esté viva, cobre por CBM, sea del servicio pedido y pertenezca a la lista del cliente o a la de la casa.
3. **Fuentes** (`source`): `estimado` (un estimado aceptado del mismo cliente), `lista` (la lista del cliente o de su aliado raíz: `rate_origin` propia / pactada / descuento), `casa`, `manual` y `excel_yiwu`. Las dos últimas exigen motivo (10 a 1.000 caracteres) y las fija solo admin o contabilidad.
4. **Inmutable.** Una fila no se edita ni se borra por la API. Cambiar el precio de una recepción que ya tiene tarifa crea una fila nueva con motivo (admin o contabilidad) y marca la anterior como reemplazada (`superseded_at`, `superseded_by_id`); el historial queda completo. Una sola fila viva por recepción (índice único parcial).
5. **El CBM y el peso los lee la base de la recepción** al congelar, no la app. Si después se corrige el CBM, la fila conserva el congelado y la pantalla avisa «el CBM cambió desde que se fijó la tarifa»; volver a congelar es un reemplazo con motivo.
6. **A facturar = máx(CBM × tarifa, mínimo)**, redondeado a centavos, como columna generada. El mínimo se cobra (decisión 9). Un estimado no guarda mínimo: se usa el `min_charge` de la fila del tarifario de la que salió (`rate_used_id`), o 0 si no la tiene.
7. **Peso incluido: 500 kg/m³ por defecto; 1.000 es la excepción** y exige motivo y admin o contabilidad. El exceso de peso (`excess_weight_kg`) se calcula y se muestra, **pero no se suma a lo que se factura**: la decisión 9 deja el cobro del exceso «según decidas por contenedor», y eso no está decidido.
8. **El servicio** lo elige quien congela (por defecto «Puerta a Puerta», `puerta_a_puerta_DDP`, el caso de Yiwu). La recepción no guarda servicio, así que congelar sola al recibir podría usar el servicio equivocado. Por eso, en esta SDD congela una persona: por fila o en lote («Congelar tarifas pendientes»), y la alerta «Sin tarifa» queda a la vista hasta hacerlo. Ver *Pendiente de decisión*.
9. **Estimado aceptado primero.** La propuesta automática usa el estimado de la orden de venta ligada a la recepción (`sales_order_id → sales_orders.quote_id`) si está aceptado; si no, la lista del cliente o aliado, y si no, la casa (`resolveRateForClient`). Quien congela puede elegir otro estimado aceptado del mismo cliente.
10. **El importador del Excel de Yiwu queda fuera** de esta SDD: el archivo todavía no llegó (§11 del plan: «El Excel de Yiwu queda para cuando lo mandes»). La fuente `excel_yiwu` ya existe en la tabla, para que el importador y su reporte «tarifa Excel ≠ tarifa ERP» entren después sin migración nueva.

## Migración `0496_tarifa_congelada_por_embarque.sql` (MIGRATE-FIRST)

### Tabla `public.shipment_rate_snapshots`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid | pk |
| `tenant_id` | uuid | fk `tenants` on delete cascade |
| `receipt_id` | uuid | fk `warehouse_receipts_cn` on delete cascade |
| `shipment_id` | uuid null | fk `shipments` (no action); la llena la 4.2, una vez, y después no cambia ni vuelve a null. **Qué pasa con la FK si se borra el envío se decide en la 4.2** |
| `client_id` | uuid | fk `clients` (no action) |
| `client_markbox` | text | el Shipping Mark al congelar |
| `service` | `shipment_service` | |
| `destination` | text null | la ciudad de la recepción |
| `source` | text | `estimado`, `lista`, `casa`, `manual`, `excel_yiwu` |
| `rate_origin` | text null | `propia`, `pactada`, `descuento`; solo con `lista` |
| `rate_id`, `price_book_id`, `quote_id` | uuid null | fk (no action) |
| `discount_pct` | numeric(5,2) null | solo con `descuento` |
| `per_cbm` | numeric(12,2) | > 0 |
| `min_charge` | numeric(12,2) | ≥ 0 |
| `cbm` | numeric(12,3) | > 0, el de la recepción |
| `weight_kg` | numeric(12,2) null | el de la recepción |
| `included_kg_per_cbm` | integer | 500 o 1.000 |
| `amount_to_invoice` | numeric(14,2) | generada: `greatest(round(cbm × per_cbm, 2), min_charge)` |
| `excess_weight_kg` | numeric(14,2) | generada: `greatest(coalesce(weight_kg, 0) − cbm × included_kg_per_cbm, 0)` |
| `reason` | text null | 10 a 1.000 caracteres |
| `frozen_at`, `frozen_by` | timestamptz, uuid null | |
| `superseded_at`, `superseded_by_id` | null | las dos juntas |

CHECK de coherencia: `estimado` exige `quote_id`; `lista` y `casa` exigen `rate_id`; `lista` exige `rate_origin` y las demás no lo llevan; `descuento` exige `discount_pct`; `manual` y `excel_yiwu` exigen motivo y no llevan `rate_id` ni `quote_id`; 1.000 kg/m³ exige motivo; una fila no se reemplaza a sí misma.

### Permisos

- RLS: SELECT para `authenticated` del mismo tenant (`get_user_tenant_id()`) con rol admin, operations, warehouse, support, accounting o commercial. Ningún INSERT, UPDATE ni DELETE para `authenticated` ni `anon`.
- Guardián `shipment_rate_snapshots_guard` (BEFORE INSERT OR UPDATE OR DELETE, para todos los roles): el INSERT no mezcla tenants; el UPDATE solo deja marcar el reemplazo una vez (`superseded_at` y `superseded_by_id` de null a valor) y llenar `shipment_id` de null a un envío del mismo tenant, **una sola vez: no se cambia ni se vuelve a poner en null**; un DELETE pasa solo si la recepción o el tenant ya no existen (borrado en cascada). Un chequeo diferido (`shipment_rate_snapshots_supersede_check`) confirma al cerrar la transacción que la reemplazada apunta a una tarifa viva de la misma recepción.
- Nadie tiene TRUNCATE (no pasa por los disparadores de fila), tampoco `service_role`; el postflight lo comprueba.

### RPC `public.congelar_tarifa_recepcion(...)` (SECURITY DEFINER, `search_path` vacío)

Parámetros: `p_receipt_id`, `p_source` (`estimado` | `tarifario` | `manual` | `excel_yiwu`), `p_rate_id`, `p_quote_id`, `p_per_cbm`, `p_min_charge`, `p_service`, `p_included_kg_per_cbm`, `p_reason`, `p_dry_run`. Devuelve una fila con lo que quedó (o quedaría) congelado.

1. Bloquea la recepción (`FOR UPDATE`). Exige: del tenant de la sesión, viva, no huérfana, con CBM > 0 y con un Shipping Mark que corresponda a un cliente vivo del tenant.
2. Deriva los números según la fuente:
   - `estimado`: estimado aceptado, vivo, del tenant y del mismo Shipping Mark, con `rate_per_cbm > 0`. Servicio = el del estimado. Mínimo = `min_charge` de su `rate_used_id`, o 0.
   - `tarifario`: fila viva del tenant, con `per_cbm`, del servicio pedido, **vigente** (`valid_until` vacío o desde hoy en Caracas), **del destino de la recepción** (el mismo ILIKE tolerante de `findRateInBook`; sin ciudad destino no se congela) y de la lista del cliente (`resolve_price_book`) o de la casa. **Si es de la casa y la lista del cliente tiene su propia fila viva, vigente, del servicio y del destino, se rechaza**: el orden de la decisión 9 manda, y `resolveRateForClient` nunca elegiría la de la casa. Si es de la lista del cliente → `lista`/`propia`; si es de la casa y la lista del cliente pacta `base_per_cbm` → `lista`/`pactada`; si pacta descuento → `lista`/`descuento` (`round(per_cbm × (1 − pct/100), 2)`; el mínimo no se descuenta, como en 0269); si no → `casa`.
   - `manual` / `excel_yiwu`: tarifa > 0, mínimo ≥ 0 y motivo.
3. Permisos por rol (`current_studio_role()`):
   - ver (`p_dry_run`): admin, operations, warehouse, support, accounting;
   - congelar desde estimado o tarifario una recepción sin tarifa, con 500 kg/m³: admin, operations, warehouse, accounting;
   - `manual`, `excel_yiwu`, 1.000 kg/m³ o reemplazar una tarifa viva (con motivo): admin o accounting.
4. Si ya hay una fila viva y no es un reemplazo con motivo, rechaza. Si es un reemplazo, inserta la nueva y marca la vieja en la misma transacción.
5. Errores con `hint = 'dtd-tarifa'` (la app muestra solo esos, ERR-01): 42501 sin permiso, P0002 no encontrado, 22023 dato inválido, 23505 ya congelada.

EXECUTE solo para `authenticated`.

### Preflight y postflight

Aborta sin cambiar nada si falta una tabla, una columna con su tipo, un valor de enum (`quote_status.accepted`, `shipment_service.puerta_a_puerta_DDP`), o si `get_user_tenant_id()`, `current_studio_role()` y `resolve_price_book(uuid)` no tienen el cuerpo, la seguridad, la volatilidad y el `search_path` del árbol (md5 del `prosrc`); también si la tabla ya existe. El postflight exige DEFINER y `search_path` vacío en la RPC y el guardián, la ACL prometida, RLS activa y los grants de la tabla.

### Locks

Crea objetos nuevos. Las FK nuevas toman SHARE ROW EXCLUSIVE breve sobre `tenants`, `warehouse_receipts_cn`, `shipments`, `clients`, `rates`, `price_books` y `quotes`; no toca filas. `lock_timeout` 5 s y `statement_timeout` 30 s.

### Rollback

`drop function` de la RPC y del guardián, y `drop table public.shipment_rate_snapshots`. Deja de ser seguro en cuanto haya tarifas congeladas que alguien vaya a facturar (4.3) o la PR esté desplegada.

## Revisión de seguridad del Director (2026-10-20, sobre `38198401`)

Cada escenario se confirmó con una prueba que fallaba sin la corrección (el mutante que la quita).

| # | Hallazgo | Corrección |
|---|---|---|
| 1 | La #307 apuntaba a `239abca4`, no a lo revisado | un solo push con la cabeza final, después del verify |
| 2 | La RPC aceptaba filas que `resolveRateForClient` nunca elegiría | vigente con la fecha de Caracas, del destino de la recepción por el mismo ILIKE, y la de la casa rechazada si la lista del cliente tiene su fila para la ruta. Un mutante por regla y la paridad prueba también el rechazo |
| 3 | Contabilidad no llegaba a la vía elevada por la UI (la matriz da `cn` a operations, warehouse y support) | **decisión del Director: la matriz de `cn` no cambia.** Capability nueva `fix_frozen_rate` (accounting + admin implícito) en `lib/studio/rbac.ts`, y dos acciones elevadas (`freezeElevatedRateAction`, `previewElevatedRateAction`) que la exigen al tope y solo admiten entradas elevadas (a mano, Excel, 1.000 kg/m³, reemplazo con motivo); la vía común sigue con `cn`. Así el contrato de RBAC (`rbac-actions-guard`) ve un candado incondicional en cada acción. Prueba de RBAC por rol |
| 4 | La spec decía que `shipment_id` podía volver a null; el guardián no lo deja | spec alineada con el guardián; la FK a `shipments` se resuelve en la 4.2 |
| 5 | TRUNCATE salta los disparadores | `revoke truncate` a todos, en el postflight; el esquema de prueba trae los privilegios por defecto de Supabase para que el caso mida |
| 6 | `FOR UPDATE` también en la vista previa | solo al congelar |
| 7 | El lote perdía lo congelado si fallaba a la mitad | devuelve `frozen` y refresca aunque falle |
| 8 | La app comparaba el Shipping Mark exacto y la RPC con `upper(btrim())` | la propuesta compara como la RPC, sin confundir `DTD-0001` con `DTD-00012` |
| 9 | FUERA DE ALCANCE | ver el handoff, con destino a la SDD de RBAC multitenant |

## App

- `lib/studio/rate-snapshots/`: tipos y etiquetas (`types.ts`), lectura de las filas vivas por recepción con respaldo si la tabla no existe (`queries.ts`), la propuesta automática (`propuesta.ts`: estimado ligado → `resolveRateForClient`).
- `app/studio/(app)/cn/rate-snapshot-actions.ts`: ver la propuesta, congelar, reemplazar y congelar en lote las pendientes (solo propuestas automáticas; las que no tienen propuesta se cuentan y se nombran).
- Almacén CN: columna «Tarifa · a facturar» con el $/m³, el monto, la fuente y el aviso si el CBM cambió; «Sin tarifa» en rojo. El cajón de la tarifa muestra la propuesta, permite elegir servicio y estimado, y (admin o contabilidad) fijarla a mano con motivo; abajo, el historial. En la barra de selección, «Congelar tarifas pendientes».
- Textos en `es-VE` y `zh-CN` (el equipo de Yiwu usa el módulo en chino).
- Sin la 0496 aplicada, la columna dice «No disponible» y las acciones responden con su mensaje; la lista no se rompe. Los símbolos se declaran en `supabase/pending-migration-symbol-declarations.json`.

## Pendiente de decisión (no bloquea esta SDD)

1. **Congelar sola al recibir.** Hace falta saber el servicio de la recepción. Propuesta: que la 4.2 (o la prealerta) lo guarde, y entonces congelar en la misma recepción.
2. **El exceso de peso** sobre 500 (o 1.000) kg/m³: se muestra, no se cobra, hasta que Sam decida «por contenedor».
3. **El importador del Excel de Yiwu** y su reporte «tarifa Excel ≠ tarifa ERP»: cuando llegue el archivo.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0496_tarifa_congelada_por_embarque.sql` | la migración |
| `supabase/tests/0496_tarifa_congelada_por_embarque.test.sql` | el contrato (85 aserciones) |
| `supabase/tests/_0496_tarifa_congelada_schema.sql` | su esquema mínimo, con los cuerpos exactos de los helpers |
| `lib/studio/__tests__/tarifa-congelada.migration.test.ts` | el contrato en PGlite: control rojo, 35 mutantes, deriva del preflight, reaplicación y espera |
| `supabase/migrations-baseline.json` | la espera de la 0496 |
| `supabase/pending-migration-symbol-declarations.json` | los dos símbolos y su degradación |
| `lib/studio/rate-snapshots/types.ts` | tipos, etiquetas, validación y errores propios |
| `lib/studio/rate-snapshots/queries.ts` | lectura de las vivas y del historial |
| `lib/studio/rate-snapshots/propuesta.ts` | propuesta automática y estimados aceptados |
| `lib/studio/rate-snapshots/__tests__/types.test.ts` | reglas puras |
| `lib/studio/rate-snapshots/__tests__/paridad-resolver.migration.test.ts` | paridad de la RPC con `resolveRateForClient` (también el rechazo), con propiedad del descuento |
| `lib/studio/rate-snapshots/__tests__/propuesta.test.ts` | propuesta automática y Shipping Mark comparado como la RPC |
| `app/studio/(app)/cn/rate-snapshot-actions.ts` | acciones (vía común con `cn`, vía elevada con `fix_frozen_rate`) |
| `lib/studio/rbac.ts` | la capability `fix_frozen_rate` |
| `lib/studio/rbac.test.ts` | su prueba |
| `lib/studio/rbac-actions-guard.test.ts` | inventario (77 archivos, 444 acciones) y las dos lecturas en EXCEPCIONES, con su motivo |
| `app/studio/(app)/cn/__tests__/rate-snapshot-actions.test.ts` | pruebas de las acciones |
| `app/studio/(app)/cn/page.tsx` | lee las tarifas vivas y quién congela en lote |
| `app/studio/(app)/cn/_components/AlmacenCnClient.tsx` | columna «Tarifa · a facturar», cajón y acción en lote |
| `app/studio/(app)/cn/_components/ReceiptRateCell.tsx` | celda de la tarifa |
| `app/studio/(app)/cn/_components/ReceiptRateCell.test.tsx` | prueba de la celda |
| `app/studio/(app)/cn/_components/RateSnapshotDrawer.tsx` | cajón de la tarifa |
| `app/studio/(app)/cn/_components/RateSnapshotDrawer.test.tsx` | regresiones del estado de carga y vista previa, con promesas controladas |
| `lib/i18n/es-VE/warehouse.ts`, `lib/i18n/zh-CN/warehouse.ts` | textos |
| `docs/specs/0571-tarifa-congelada-por-embarque/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0571-tarifa-congelada-por-embarque.md` | handoff |

No toca `lib/studio/accounting`, `invoices`, recibos ni tasas (sesión Contabilidad).

## Criterios de aceptación

1. Una recepción viva, de un cliente, con CBM, se congela desde un estimado aceptado del mismo cliente o desde una fila del tarifario, y la base guarda la tarifa, el mínimo, el CBM, el peso, la fuente, la fecha y quién.
2. Los números de `estimado`, `lista` y `casa` salen de las filas de origen, no de la app: un número que no corresponde no se puede guardar con esas fuentes.
3. La clasificación propia / pactada / descuento / casa coincide con `resolveRateForClient` para la misma fila y el mismo cliente.
4. A facturar = máx(CBM × tarifa, mínimo); el exceso de peso se calcula y no se suma.
5. `manual`, `excel_yiwu`, 1.000 kg/m³ y el reemplazo exigen motivo y admin o contabilidad; warehouse y operations solo congelan una pendiente desde estimado o tarifario.
6. Una sola tarifa viva por recepción; el reemplazo deja la anterior marcada y visible.
7. Nadie edita ni borra una fila por la API; el guardián rechaza todo cambio salvo marcar el reemplazo y llenar el envío.
8. Otro tenant no ve ni congela; marketing no ve.
9. Almacén CN muestra «CBM real · tarifa · a facturar» o «Sin tarifa», y el aviso de CBM cambiado; congelar en lote solo usa propuestas automáticas.
10. Sin la 0496, la app no se rompe.
11. Control rojo y un mutante por regla en el contrato.
12. La búsqueda del cliente recorre las páginas de candidatos y compara el Shipping Mark normalizado antes de resolver: un cliente exacto después de 50 coincidencias parciales aparece y dos clientes exactos, aun en páginas distintas, son ambiguos. Los estimados aceptados se paginan en orden estable; el límite de 20 se aplica a coincidencias exactas válidas, de modo que 20 parciales más recientes no ocultan el estimado del cliente.
13. La carga del cajón pertenece a una recepción, un servicio y una generación de petición. Una respuesta anterior no reemplaza la selección vigente. La identidad cambiante de la función de traducción no reinicia la carga; los mensajes se traducen al renderizar.
14. Cambiar una entrada numérica o su fuente invalida la vista previa anterior inmediatamente, incluso en una secuencia A → B → A. La propuesta incluida en la carga solo se usa con esa carga vigente; las otras vistas previas se vinculan a la edición actual. El botón y el manejador del formulario impiden congelar con una vista previa fallida, obsoleta o pendiente. Cambiar solo el motivo no vuelve a calcular los números.

### Validación local del cierre P2 del 2026-10-20

Los criterios 12–14 y sus regresiones se prepararon sobre `b70be5d792ca4ee0417426266301a9e2e7fd9ffc`, por adopción autorizada del mismo worktree. **PASÓ:** focal de 62/62 casos en cinco archivos, siete controles rojos detectados, typecheck, lint focal, docs/numbering y revisión visible del Worker con el cajón y campo numérico reales, sobre datos sintéticos sin DB. La revisión independiente del Director en IAB también pasó: entrada 900 conserva los datos y retira el importe durante la espera, luego muestra $1,800.00 y habilita confirmar; entrada 999 elimina el resultado, bloquea confirmar y conserva el error sintético. Evidencia y límites en el handoff. **NO EJECUTADO** todavía: validación canónica sobre la base final, integración, actualización del conocimiento compartido y producción. Fixture detenida, sin procesos propios, y turno pesado devuelto. El cierre se limita a paginación y vigencia del estado en la app; no cambia SQL0496, RBAC ni las limitaciones históricas documentadas en el handoff.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| AUD-01 | cumplimiento | cada fila guarda quién, cuándo, de dónde y por qué; no se edita, y el reemplazo deja la anterior |
| ERR-01 | cumplimiento | la app muestra solo los mensajes con `hint = 'dtd-tarifa'` |
| FRM-01, A11Y-01 | se valida con `/ui-check` | cajón con `<label>`, motivo con ayuda, aviso con `role="status"` |
| Producción | cumplimiento | no se leyeron filas; la 0496 se aplica con OK nominal y el runbook |
| Datos personales | no aplica | no se capturan ni mueven nombres, RIF ni contactos: solo el Shipping Mark que la recepción ya tiene |

## Validación

Ver el handoff `.agents/handoffs/0571-tarifa-congelada-por-embarque.md`.

## Corrección serial autorizada · 2026-10-25 · AUD-01 y servicio durante saving

Esta ampliación se basa en la reasignación humana al mismo CORE y General
exec-ad48ddc8-4f43-4250-a6dd-75f77f7dfb8d. Fuente directa ba43747a803ea9aec3b8750d1b461d69795834a5;
rama nueva codex/sdd-0571-correcciones-20261025. No reescribe resultados históricos.
La clasificación AUD-01 anterior describía los snapshots, pero no acreditaba un
evento en el log canónico: la RPC retornaba después del INSERT sin emitirlo.

### Auditoría obligatoria y atómica

- Crear/reemplazar llama a public.append_audit_event antes de retornar, dentro de
  la misma transacción de la fila nueva y la marca de reemplazo anterior.
- Se reutiliza la entidad canónica warehouse_receipt_cn con entity_id de la
  recepción, como en el patrón logístico0292. Eventos estables:
  rate_snapshot_frozen y rate_snapshot_replaced; source rpc, result succeeded.
- Tenant y actor user provienen del contexto de servidor y frozen_by/auth.uid;
  nunca se convierte un actor desconocido en system. La correlación incluye el
  UUID del snapshot nuevo. El payload enlaza snapshot_id y replaced_snapshot_id.
- Before/after conservan la decisión y el vínculo anterior; se omite
  client_markbox y no se duplica reason en esos objetos. El motivo validado se
  entrega al writer canónico, conservando su wrapper0294 vigente.
- No se absorbe el error del log. Un ID de evento null también aborta. Un fallo
  revierte fila nueva, marca anterior y evento; dry-run sale antes de mutar o
  auditar. Los rechazos no producen eventos de éxito comprometidos.
- Preflight exige entity_audit_log, audit_entity_types, la firma canónica de
  append_audit_event y warehouse_receipt_cn activa. No se amplían grants API ni
  se modifica el writer compartido.
- No se encontró auditoría equivalente en los dos triggers de0496: son guardas
  de integridad. El bridge0292 sólo transforma INSERT legacy de actor operario
  en el log y no duplica el nuevo evento user/rpc.

### Coherencia del Drawer

El selector de servicio permanece disabled durante saving y su manejador
rechaza también un cambio sintético mientras guarda. A → intento de B →
respuesta A conserva selección/carga A; tras éxito o rechazo, B puede elegirse
de nuevo y carga B. Los errores siguen visibles y las guardas de preview,
generaciones, tenant y permisos se conservan. No cambia estilo, componente
numérico ni validación del formulario.

### Oráculos y límites de esta corrección

El contrato SQL conserva las aserciones existentes y añade observación de
eventos reales de la RPC sobre fixture FICTICIO: identidad/tenant/actor,
before/after/motivo/correlación, dry-run con y sin tarifa viva, rechazo,
rollback forzado después de observar el evento, error del sink y cancelación
del INSERT del evento. Los mutantes nuevos omiten el evento, confunden el tipo
de reemplazo, absorben el error o aceptan ID null. El schema _0496 existente
queda intacto: el test permitido aloja un doble estrecho del writer, expresamente
sin acreditar su implementación canónica o producción. Los casos PGlite que
requieren bootstrap reutilizan ese mismo bloque declarado del test.

El Drawer añade promesas diferidas para éxito/rechazo y comprueba selección,
cargas, feedback y desbloqueo, manteniendo los tests previos.

Allowlist de esta fase: 0496 SQL y su test; tarifa-congelada.migration.test.ts;
RateSnapshotDrawer.tsx y su test; esta spec; handoff sdd-0571-correcciones-20261025.
Baseline: sólo se amplía la descripción de la espera0496 con los requisitos de
auditoría que el operador debe leer antes de aplicar; cutoff y demás entradas
se preservan.

Estado del candidato: fuente corregida, validación funcional NO DISPONIBLE /
NO EJECUTADA local por node_modules/Vitest ausentes en el nuevo worktree. No se
instalan ni copian dependencias. Los resultados históricos no se transfieren.
Se mantiene in-progress, 0496 PENDIENTE y MIGRATE-FIRST. CI y revisión del SHA,
validación visual/canónica y autorización nominal de aplicación siguen
pendientes. No se consultó ni aplicó producción, no se modifica otra PR ni se
declara completado el plan contable. Handoff nuevo conserva evidencia y límites.
