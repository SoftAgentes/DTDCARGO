---
sdd: "0645"
title: "Pasar embarque a otro cliente: operaciones corrige el dueño de un embarque desde el Studio"
status: in-progress
author: "Claude (Worker del Subdirector Portal) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0077", "0096", "0106", "0108", "0258", "0267", "0294", "0371", "0466", "0522", "0543", "0555"]
confidencialidad: interno
---

# SDD-0645 — Pasar embarque a otro cliente

> Cuando un embarque quedó a nombre de una ficha equivocada o provisional, una persona de operaciones lo pasa a su
> dueño real desde el detalle del embarque, con motivo. Junto con él se mueven sus recepciones del Almacén CN, sus
> cajas, su factura en borrador, sus líneas de consolidación, sus documentos del Portal y sus avisos pendientes. El
> cliente viejo deja de verlo en el Portal y el nuevo lo ve. Queda auditado.

**Estado:** `in-progress`. Migración `0551_pasar_embarque_a_otro_cliente.sql` **sin aplicar** (espera declarada en
`supabase/migrations-baseline.json`). Fusionar la PR no autoriza aplicarla.

## 1. Contexto

En prueba se cargó el consolidado DDP 64. Dos líneas sin código (5 cajas «HZ» y 1 caja «SIN CODIGO») quedaron en una
ficha provisional **DTD-0000 «SIN IDENTIFICAR»**, para que la persona de operaciones las pase a su dueño real cuando lo
sepa. Pedido de Sam (2026-11-16, con el nombre reemplazado por su rol): «Móntalas como están y sin código para que [la
persona de operaciones] las aclare… y que él los pueda editar adentro del ERP si es necesario.» Sam aprobó encargarla: «Sí, encárgala».

Hoy el Studio no lo permite (verificado en `main` b9b29db96):

- `app/studio/(app)/tracking/[id]/actions.ts`, `updateShipment`: ignora a propósito `client_name` y `client_markbox`.
- `app/studio/(app)/cn/actions.ts`: no hay forma de cambiar el cliente de una recepción CN.
- `app/studio/(app)/facturacion/actions.ts`, `updateInvoice`: cambia solo el texto `client_markbox`/`client_name` de un
  borrador y lo deja desalineado del embarque.
- `merge_clients` (0361) no mueve embarques, facturas ni recepciones. `rename_client_markbox` (0371) mueve **todo** el
  código de un cliente y falla si el código destino ya existe: no sirve para pasar un solo embarque.

### Cómo se ata hoy un embarque a su cliente

No hay `client_id` en `shipments`. El vínculo es el texto `client_markbox` (Shipping Mark) más el snapshot
`client_name`, repetido en las tablas que cuelgan del embarque:

| Tabla | Columnas | Cómo se liga al embarque | Quién la lee por el Shipping Mark |
|---|---|---|---|
| `shipments` | `client_markbox`, `client_name` | — | RLS del Portal «shipments portal self read» (0416) |
| `shipment_documents` | `client_markbox` | `shipment_id` | RLS del Portal (0416) |
| `shipment_events` | — | `shipment_id` | RLS del Portal, vía el embarque (0416) |
| `warehouse_receipts_cn` | `client_markbox`, `client_name`, `is_orphan` | `shipment_id` (al consolidar) | Studio CN, Portal |
| `warehouse_boxes` | `markbox`, `client_name` | `receipt_id` | se sincroniza sola con el trigger `warehouse_receipts_cn_sync_identity` (0240) |
| `invoices` | `client_markbox`, `client_name` (+ titular fiscal) | `shipment_id` o `lines[].shipmentCode` (SDD-0555) | Portal (0085) |
| `consolidation_items` | `client_markbox`, `client_name` | `shipment_id` | Naviera, manifiesto |
| `client_notification_schedule` | `client_markbox` | `shipment_id` | el despacho de avisos al cliente |

## 2. Alcance

**Entra:**

1. Una RPC transaccional `reassign_shipment_client(p_shipment_id, p_client_id, p_reason, p_dry_run)` que mueve un
   embarque y lo que cuelga de él a otro cliente del mismo tenant, o explica por qué no.
2. Una acción RBAC nueva `reassign_shipment_owner` (operations + commercial + admin, D2) en `lib/studio/rbac.ts`.
3. En el detalle del embarque (`/studio/tracking/[id]`), «Pasar a otro cliente»: buscador de cliente por nombre,
   cédula o Shipping Mark (el `ClientCombobox` de SDD-0108), vista previa de lo que se mueve, motivo obligatorio y
   confirmación.
4. Contrato SQL, prueba en PGlite, RBAC y la action.

**No entra (FUERA DE ALCANCE):**

- Asignar una recepción CN huérfana que **no** está consolidada en un embarque (`is_orphan` sin `shipment_id`). Es otro
  flujo, del Almacén CN.
- Pasar varios embarques a la vez, o partir un embarque entre dos clientes.
- Renombrar el código del embarque o de las cajas (ver §4.4).
- Mover facturas emitidas, cobros, recibos, reclamos o prealertas (ver §4.2): se niega con el motivo.
- Avisar al cliente nuevo o al viejo por correo o WhatsApp de que el embarque cambió de dueño.
- Kommo: el embarque no se empuja a Kommo por esta vía.

## 3. Comportamiento

### 3.1 Quién

Solo `operations`, `commercial` y `admin` activos del tenant (D2 de Sam) (`user_tenants.disabled_at is null`, la única membresía activa de
`get_user_tenant_id()`, 0453). La server action exige la acción RBAC `reassign_shipment_owner`; la base lo exige por su
cuenta (42501), porque la RPC es alcanzable por PostgREST.

### 3.2 Qué se valida

- El embarque existe en el tenant y no está eliminado (P0002 si no).
- El cliente destino existe en el tenant, no está eliminado ni fusionado (`merged_into_client_id`), y **tiene
  Shipping Mark**: sin él el Portal no se lo mostraría (22023).
- El destino no es el mismo Shipping Mark que ya tiene el embarque (22023).
- Motivo de 4 a 1000 caracteres (el CHECK de 0267), salvo en la vista previa (`p_dry_run`), que no escribe.

### 3.3 Qué lo bloquea

La RPC devuelve `outcome = 'blocked'` con `blockers` (tipo → conteo) y **no mueve nada** si encuentra:

| Bloqueo | Por qué |
|---|---|
| `factura_emitida` | Una factura viva (no eliminada, no anulada) del embarque que ya no está en borrador. Después de emitir, el titular está congelado (`invoices_seal_billing_titular`, 0466) y la factura es del cliente viejo. Primero se anula. |
| `factura_varios_embarques` | Un borrador del embarque que también factura otros embarques (`lines[].shipmentCode` distinto, SDD-0555). Moverlo pasaría al cliente nuevo el cobro de embarques ajenos. Primero se separa. |
| `reclamo` | Un reclamo vivo del cliente sobre el embarque (`client_claims`). Es del cliente que lo abrió. |
| `prealerta` | Una prealerta viva (no cancelada) unida al embarque: la anunció el cliente viejo. |
| `orden_despacho` | Una recepción del embarque en una orden de despacho no cancelada: la orden ya va a nombre del cliente viejo. |

Las facturas anuladas o eliminadas no bloquean y **no se mueven**: son historia del cliente viejo.

### 3.4 Qué se mueve, en una sola transacción

Con el embarque bloqueado `FOR UPDATE` y todo o nada:

1. `shipments`: `client_markbox` y `client_name` ← los del cliente nuevo.
2. `warehouse_receipts_cn` vivas con ese `shipment_id`: `client_markbox`, `client_name`, `is_orphan = false`. Sus
   `warehouse_boxes` se actualizan solas por el trigger de 0240.
3. `invoices` en borrador del embarque: `client_markbox`, `client_name`, y se limpian `client_rif`, `client_doc_kind`,
   `client_fiscal_address` y `bill_to_kind`, que eran del cliente viejo; al emitir, el sello de 0466 los toma del nuevo.
4. `consolidation_items` del embarque: `client_markbox`, `client_name`.
5. `shipment_documents` del embarque: `client_markbox` (la RLS del Portal los compara con el embarque).
6. `client_notification_schedule` del embarque en `scheduled`: `client_markbox`. Lo ya enviado, saltado o fallido se
   queda como está: es lo que recibió el cliente viejo.

**Portal:** como la RLS de 0416 compara `shipments.client_markbox` con el Shipping Mark de la ficha del usuario, al
terminar la transacción el cliente viejo deja de ver el embarque, sus eventos y sus documentos, y el nuevo los ve. No
hace falta tocar la RLS.

**No se toca:** `quotes` convertidas (la cotización fue del viejo), `legal_acceptances`, recibos y pagos, cajas de
Venezuela y paquetes de despacho (si hay despacho vivo, se bloquea antes).

### 3.4b Avisos que no bloquean (H-1 y H-2, decisiones del DG, 2026-11-16)

- **Tarifa congelada (H-1).** `shipment_rate_snapshots` (0496) guarda por recepción el `client_id` y el precio del
  cliente que la congeló. La 0551 **no la toca y no bloquea**: la vista previa avisa «N recepciones tienen tarifa congelada
  del cliente anterior; contabilidad debe reemplazarla antes de facturar» (las vivas, `superseded_at is null`, de otro
  cliente) y el evento guarda ese conteo en `payload.warnings`.
- **Lo que verá el cliente nuevo en el Portal (H-2).** La vista previa cuenta, por tipo y sin contenido, los documentos
  del Portal (BL, POD, otro) y los eventos del seguimiento (cuántos tienen nota). Que el cliente nuevo vea documentos y
  notas escritos cuando el embarque era de la ficha anterior es un **riesgo aceptado**, con ese aviso para que quien lo
  pasa revise antes de confirmar.

### 3.5 Respuesta

`jsonb` con `outcome` (`preview` | `blocked` | `reassigned`), el Shipping Mark viejo y el nuevo, el código del embarque,
`blockers`, `warnings` (§3.4b), `portal` (§3.4b) y `moved` (tabla → filas). La vista previa calcula exactamente lo mismo, sin escribir.

### 3.6 Auditoría (AUD-01, AUD-02)

Un evento `shipment_client_reassigned` por `append_audit_event` (0294), en la misma transacción: entidad `shipment`,
actor `user` con `auth.uid()`, fuente `rpc`, motivo (por `dtd.audit_reason`, solo para la transacción), antes y después
con **solo** el Shipping Mark (sin nombres), `payload` con el código del embarque, `moved`, `permanence: P1`
(reversible: se vuelve a pasar), y correlación `sdd-0645:reassign:<txid>`. Sensibilidad `internal`. Si el evento falla,
no se mueve nada.

**Sin texto libre en el evento** (condición del DG, 2026-11-16): `payload`, `before_data` y `after_data` sólo llevan
Shipping Marks, el código del embarque, conteos y valores de un vocabulario cerrado (`P1`, `portal_owner_changed`,
`reassign_again`). El único texto que escribe la persona es el **motivo**, que va a la columna `reason` del contrato
de auditoría (AUD-01, 4 a 1000 caracteres) como en todas las acciones R3, y que el pedido de Sam exige. Si el DG
prefiere también un motivo de lista cerrada, es un cambio de la acción y de la RPC.

Las facturas además dejan su propio rastro por `audit_d2_invoices`.

## 4. Decisiones

### 4.1 Qué se mueve junto (resuelta por la tarea)

El embarque, sus recepciones CN, su factura en borrador, sus líneas de consolidación, sus documentos del Portal y sus
avisos pendientes. Es lo que el Portal y la oficina asocian al dueño de ese embarque.

### 4.2 Factura que ya no está en borrador (recomendación de la tarea: negarse)

Se niega con el motivo `factura_emitida`. Mover una factura emitida cambia un documento ya entregado y su titular está
congelado por 0466.

### 4.3 Items de consolidación y Portal (resuelta por la tarea)

Se mueven; el viejo deja de verlo y el nuevo lo ve (§3.4).

### 4.4 El código del embarque: **se conserva, con trazabilidad visible** (D1, resuelta por Sam el 2026-11-16)

El código del embarque y los de sus cajas **no cambian**. Motivo: el código es la llave que ya está impresa en las
etiquetas físicas de las cajas, en el manifiesto, en el snapshot `invoices.shipment_code` y en las líneas
`lines[].shipmentCode` (SDD-0555), y es único por tenant (`unique (tenant_id, code)`). Renombrarlo rompería esas
referencias y las etiquetas ya pegadas.

Consecuencia visible: un embarque nacido en la ficha provisional puede llevar el Shipping Mark viejo dentro del código
(por ejemplo `DTD-0000-…`).

**Respuesta de Sam (2026-11-16, en el chat del DG, literal):**

> «Se queda registrado el cambio como historial dentro del embarque. No conserva el código del otro cliente, sino que
> queda como registro: conserva el cambio del cliente nuevo y se mantiene el cliente nuevo, pero yo puedo ver en
> registros que se hizo eso. O sea, si yo en algún momento llego a ver el embarque, que aparezca: tal día, fulano de tal
> hizo este cambio y la justificación de por qué hizo este cambio.»
>
> «Para que la recomendación que tú estás dando sea viable, cuando haya un cambio, este debe ser totalmente visible. Por
> ejemplo, que "DTD 000" salga tachado y al lado diga "nuevo", o algo así. Tiene que haber un elemento visual que
> identifique la trazabilidad del cambio de cliente. Además, si oprimo el botón encima, debería salir alguna
> justificación o aclaración de por qué es así, considerando que la etiqueta ya está puesta como "000".»

**Cómo se aplica (lectura del DG, 2026-11-16):**

- El código del embarque y de las cajas se conserva, porque la etiqueta ya está impresa. El dueño pasa a ser el
  cliente nuevo.
- En el detalle del embarque del Studio, junto al cliente: el Shipping Mark anterior **tachado** y el nuevo al lado,
  con la marca «nuevo».
- Al pulsar esa marca se abre la explicación: «El código de las etiquetas (`<código>`) se mantiene porque ya está
  impreso en las cajas; el embarque es de `<Shipping Mark nuevo>` desde `<fecha>`».
- **Historial del cliente** visible en el detalle: fecha, quién hizo el cambio, cliente anterior → nuevo y el motivo.
  Sale del evento `shipment_client_reassigned` que ya escribe la 0551 (§3.6), sin otra tabla.

### 4.5 Roles (resuelta por la tarea)

`operations`, `commercial` y `admin` (D2 de Sam, 2026-11-16), con la acción RBAC nueva `reassign_shipment_owner`
(lista `["operations", "commercial"]`, admin implícito). No hay un rol de logística distinto de `operations`: los roles
son `admin`, `commercial`, `operations`, `accounting`, `warehouse`, `support` y `marketing`.

### 4.6 Auditoría (resuelta por la tarea)

`append_audit_event` con motivo obligatorio (§3.6).

### 4.7 Decisiones de Sam abiertas

El Subdirector Portal se las hace **una por una**:

- **D1. ¿El código del embarque se conserva al pasarlo?** **Resuelta por Sam el 2026-11-16:** se conserva, con el
  cambio tachado y explicado en el detalle y su historial (§4.4).
- **D2. ¿`commercial` también puede pasarlo?** **Resuelta por Sam el 2026-11-16** (en el chat del DG; el nombre de la
  persona va reemplazado por su rol, porque el repositorio es público):

  > «Que comercial, logística y [la persona de operaciones] (que no sé qué rol tiene) puedan hacerlo. Lo importante es
  > que quede un registro de quién está haciendo los cambios en los logs, eso es todo. Después pongo algo para poder
  > buscar en los logs quién hizo ese cambio o que aparezca en una ficha en el embarque, así que no hay problema por
  > ahora. Deja que ellos lo hagan porque estamos en start y no quiero estar al pendiente de todos los permisos. Ya los
  > voy modificando con el tiempo.»

  Traducción del DG: `admin`, `operations` y `commercial`. «Logística» es `operations` (no hay otro rol), y la
  persona de operaciones también.
- **D3. ¿El Portal del cliente nuevo muestra la trazabilidad?** Propuesta del DG: que vea solo la explicación del
  código («el código de las etiquetas se mantiene porque ya estaba impreso»), **sin** el Shipping Mark ni el nombre del
  cliente anterior, que son datos de otra persona. **Abierta para Sam; esta PR no toca el Portal.**

## 5. Diseño de UI

- En el detalle del embarque, panel «Cliente» en la columna derecha, encima de «Esto verá el cliente»: muestra el
  Shipping Mark actual y el botón secundario **«Pasar a otro cliente»**. Solo lo ve quien tiene
  `reassign_shipment_owner` y puede ver nombres de clientes: el equipo de China (SDD-0531) no lo ve, porque el
  buscador muestra nombres. La acción RBAC se llama distinto de la función SQL para que el gate de símbolos
  pendientes no confunda una con otra.
- El botón abre un modal (`useDialogA11y`: foco atrapado, Escape, foco de vuelta):
  1. **Cliente nuevo** con `ClientCombobox` (cédula, nombre o Shipping Mark). Hasta elegir uno de la lista no se puede
     seguir.
  2. Al elegirlo, la **vista previa** (`p_dry_run`): «Se moverán: N recepciones del Almacén CN, la factura en borrador,
     N líneas de consolidación, N documentos y N avisos pendientes», o los bloqueos con su motivo en texto llano.
  3. **Motivo** (4 a 1000 caracteres) con contador y el aviso «no escribas datos personales (nombres, cédula, teléfono ni
     dirección)»: el motivo es texto del equipo y queda en la bitácora (DG, 2026-11-16).
  4. Botón primario **«Pasar a DTD-1234»** (con el Shipping Mark nuevo), deshabilitado sin cliente, sin motivo o con
     bloqueos. Texto de confirmación sobre el botón: «El cliente actual dejará de verlo en el Portal y DTD-1234 lo verá».
- Al terminar: toast «Embarque pasado a DTD-1234» y se refresca la página.
- **Trazabilidad (D1).** Si el embarque cambió de cliente, la columna derecha muestra, a **todo** el que ve el detalle
  (también al equipo de China, que ve Shipping Marks y nombres del equipo, no de clientes; el motivo, que es texto
  libre y puede traer un nombre, a China no se le manda y ve «Motivo registrado» — B-1, DG 2026-11-16):
  - el Shipping Mark anterior tachado (`<s>`, con texto para lectores de pantalla «antes»), el actual y el botón «nuevo»
    (`aria-expanded`). Al pulsarlo se abre la explicación del código de las etiquetas, con la fecha del cambio;
  - **«Historial del cliente»**: una línea por cambio, del más reciente al más viejo, con fecha y hora de Caracas, el
    nombre de la persona del equipo (o «Alguien del equipo» si ya no está), anterior → nuevo y el motivo.
  - La lectura es acotada: con el cliente de servicio (la 0270 no deja leer la bitácora a `authenticated`), después de
    que la RLS dejó leer el embarque, con filtro fijo por tenant de la sesión, `entity_type = 'shipment'`, el id del
    embarque y `event_type = 'shipment_client_reassigned'`, columnas fijas y tope de 20. Si falla, no se muestra y el
    detalle sigue.
- Sin la migración aplicada, el modal dice «Esta acción todavía no está disponible.» y no ofrece confirmar.
- Tokens `var(--*)` y la tipografía de `BRAND.md`. Español venezolano neutro, con tuteo.

## 6. Criterios de aceptación

1. Un `operations`, `commercial` o `admin` activo pasa un embarque a otro cliente con motivo, y se mueven el embarque, sus
   recepciones vivas (y sus cajas), su borrador, sus líneas de consolidación, sus documentos y sus avisos `scheduled`.
2. `accounting`, `warehouse`, `support`, `marketing`, un usuario desactivado, `anon` y un admin de otro
   tenant reciben 42501, sin cambios.
3. Cada bloqueo de §3.3 impide el cambio y su contraparte (anulada, eliminada, cancelada) no lo impide.
4. Todo o nada: con un bloqueo o un error del evento de auditoría, ninguna fila cambia.
4b. (H-1) Con una recepción con tarifa congelada viva de otro cliente, la vista previa avisa el conteo, el cambio
    se hace, la tarifa no cambia y el evento guarda el conteo; una ya sustituida no avisa.
4c. (H-2) La vista previa cuenta los documentos del Portal por tipo y los eventos del seguimiento (y cuántos con nota).
4d. (H-6) Un admin de otro tenant no encuentra el embarque, ni con un cliente de su propio tenant.
5. La vista previa devuelve los mismos conteos que el cambio real y no escribe nada ni deja evento.
6. El evento `shipment_client_reassigned` lleva actor, motivo, antes/después solo con el Shipping Mark y la correlación.
7. Las facturas anuladas, los avisos enviados, las recepciones eliminadas y las cotizaciones no cambian.
8. La server action exige la acción RBAC antes de leer, valida el motivo y traduce los errores a texto llano, y degrada
   con mensaje si falta la migración.
9. Un embarque dentro de un contenedor (con línea de consolidación) se pasa y su línea sigue al cliente nuevo; la
   de otro embarque del mismo contenedor no cambia.
10. Con el `EXECUTE` por defecto de Supabase (`alter default privileges`), la migración deja la función sólo a
    `authenticated`.
11. (D1) En el detalle de un embarque que cambió de cliente, cualquiera que lo vea encuentra el Shipping Mark anterior
    tachado, el actual con «nuevo», la explicación del código de las etiquetas al pulsarlo y el historial con fecha,
    persona, anterior → nuevo y motivo. La lectura de la bitácora es la acotada de §5 y, si falla, el detalle sigue.
12. El modal solo aparece para quien tiene la acción y no deja confirmar sin cliente, sin motivo o con bloqueos.

## 7. Migración

`supabase/migrations/0551_pasar_embarque_a_otro_cliente.sql`:

- Preflight que falla cerrado: roles, RLS de las tablas, columnas que lee y escribe, etiquetas de enum,
  `append_audit_event` SECURITY DEFINER con `search_path` vacío, tipo de entidad `shipment` activo, el trigger de
  sincronía de cajas de 0240, `get_user_tenant_id()` SECURITY DEFINER, y que quien aplica omite RLS.
- `reassign_shipment_client(uuid, uuid, text, boolean)`: SECURITY DEFINER, `search_path` vacío, `EXECUTE` solo
  `authenticated`.
- Postflight: forma y ACL. `lock_timeout` y `statement_timeout` son `set local`: rigen sólo dentro de la transacción del
  envoltorio del runbook y vuelven solos al terminar; el postflight no los mide (H-5).
- Concurrencia: aplicar toma `FOR UPDATE` del embarque, sus recepciones y sus facturas, en orden de id; la vista
  previa no bloquea. PGlite tiene una sola conexión, así que el contrato no prueba la carrera: queda como
  **NO VERIFICADO** en concurrencia real.
- Sin backfill. Sin locks de tabla: solo `CREATE FUNCTION`, `REVOKE`, `GRANT` y `COMMENT`. Reaplicar no cambia nada.
- Orden: **migrate-first**. Con la app de antes y la migración aplicada no cambia nada visible. Con la app nueva y sin
  la migración, el modal dice que la acción no está disponible.
- Desarme: `supabase/desarmes/0551_desarme` (extensión `.sql`; se nombra sin ella para no leerse como migración citada) (quita la función; los cambios hechos quedan, con su evento).

## 8. Allowlist exacta

Cualquier archivo fuera de esta lista pide enmendar esta spec.

- `docs/specs/0645-pasar-embarque-a-otro-cliente/spec.md`
- `docs/specs/README.md` (índice regenerado)
- `supabase/migrations/0551_pasar_embarque_a_otro_cliente.sql` (nueva)
- `supabase/tests/0551_pasar_embarque_a_otro_cliente.test.sql` (nueva)
- `supabase/desarmes/0551_desarme` (extensión `.sql`, nueva)
- `supabase/migrations-baseline.json` (espera en `pendingBelowCutoff`)
- `supabase/pending-migration-symbol-declarations.json` (degradación declarada)
- `lib/studio/__tests__/pasar-embarque-a-otro-cliente.migration.test.ts` (nueva, contrato en PGlite)
- `lib/studio/rbac.ts` (acción `reassign_shipment_owner`)
- `lib/studio/rbac.test.ts`
- `lib/studio/reasignar-embarque.ts` (nueva: tipos y textos del resultado)
- `lib/studio/__tests__/reasignar-embarque.test.ts` (nueva)
- `app/studio/(app)/tracking/[id]/actions.ts` (dos server actions nuevas)
- `lib/studio/rbac-actions-guard.test.ts` (inventario de acciones 472 → 474)
- `app/studio/(app)/tracking/[id]/__tests__/reasignar-actions.test.ts` (nueva)
- `app/studio/(app)/tracking/[id]/_components/ReassignClientPanel.tsx` (nueva)
- `app/studio/(app)/tracking/[id]/_components/__tests__/ReassignClientPanel.test.tsx` (nueva)
- `app/studio/(app)/tracking/[id]/page.tsx` (montar el panel y la trazabilidad)
- `lib/studio/reasignar-historial.ts` (nueva: lectura acotada del historial de cambios de cliente)
- `lib/studio/__tests__/reasignar-historial.test.ts` (nueva)
- `app/studio/(app)/tracking/[id]/_components/ClienteCambiado.tsx` (nueva: tachado, «nuevo» e historial)
- `app/studio/(app)/tracking/[id]/_components/__tests__/ClienteCambiado.test.tsx` (nueva)
- `app/studio/(app)/tracking/__tests__/ocultar-nombres-cn.test.tsx` (China no ve el panel; Venezuela sí)
- `.agents/handoffs/0645-pasar-embarque-a-otro-cliente.md`

## 9. Gobernanza

| Política | Clasificación |
|---|---|
| SGE-00 / MP-01 (permanencia) | cumplimiento: P1, reversible volviendo a pasar el embarque; confirmación con motivo |
| BTN-01 (acción con consecuencia) | cumplimiento: botón secundario que abre confirmación; el primario nombra el destino |
| AUD-01 / AUD-02 | cumplimiento: evento en la misma transacción, motivo obligatorio, sin PII |
| FRM-01 / ERR-01 | cumplimiento: motivo con contador; errores en texto llano |
| A11Y-01 | cumplimiento: diálogo con `useDialogA11y` y combobox WAI-ARIA existente |
| AUD-02 (consulta de la bitácora) | excepción autorizada por Sam (D1, 2026-11-16): lectura acotada de un solo tipo de evento del embarque, columnas fijas, para mostrar su historial a quien ya ve el embarque |
| Privacidad (`revisar-datos-ve`) | cumplimiento: no se capturan datos personales nuevos; el evento guarda solo Shipping Marks |
