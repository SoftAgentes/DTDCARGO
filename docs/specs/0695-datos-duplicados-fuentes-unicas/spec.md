---
sdd: "0695"
title: "Datos duplicados y fuentes únicas: identidad, correo, asesor, nombres copiados y fechas"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0170", "0246", "0533", "0576", "0660", "0694", "0696"]
confidencialidad: interno
---

# SDD-0695 — Datos duplicados y fuentes únicas

> **Estado: propuesta para que Sam la apruebe.** Esta PR no trae código, migraciones ni cambios de
> producto: solo la spec. Las preguntas para Sam están en la §9 y van una por una.
>
> **Medición:** código de `main` en `6a7787d08`. La reserva `9b00a1665` no cambia código. Las líneas se
> vuelven a verificar al arrancar cada fase. Los conteos de producción los corrió Dir_DTD el 2026-11-20,
> con la autorización de Sam. **Este repo es público, así que los números no se copian aquí:** van por
> chat, y la spec solo los cita en términos cualitativos (§3).

## 1. Pedido

El 2026-11-20 Sam pidió una sesión aparte para analizar la base de datos y los errores, con tres
encargos:

- revisar que no haya duplicados en las tablas;
- revisar que todo esté bien;
- dar recomendaciones para que «no vuelva a pasar», en concreto con la dirección, la fecha y la ciudad.

La dirección de entrega del cliente ya tiene su spec, la **SDD-0694** (PR #725). Esta spec toma todo lo
demás y deja la regla general que impide que el problema se repita con otro dato.

**Reparto de la dirección entre las tres SDD:**

| Tema | SDD |
|---|---|
| Fuente única de la dirección; ficha, chofer y comprobante; aviso; botón «Pedir»; dirección en el registro; exigirla en la primera compra; ciudad y estado visibles y conservados al fusionar | **0694** |
| Dirección del cliente final de un aliado: la carga el aliado, o el cliente con un enlace con la marca del aliado | **0696** |
| Regla general de fuente única, vista de completitud, guardia de CI contra los demás campos viejos (la de la dirección es de la 0694) y los demás datos duplicados | **0695** (esta) |

## 2. Medición: qué dato vive en más de un lugar

Cada fila dice dónde nace cada copia, quién la escribe, quién la lee, si algo las sincroniza y qué
pasa cuando se separan. Las marcadas como **INFERENCIA** no se probaron contra una base.

### D-1. Dirección de entrega: cuatro fuentes → la arregla la 0694

Confirmado en `9b00a1665` con las mismas líneas de la 0694 §2:

- `clients.address` (`0006_clients.sql:16`);
- `client_delivery_addresses` (`0198:23-38`), con una copia única en `0198:167-181` y sin trigger que la
  sincronice;
- `clients.city` y `clients.state` (`0348:38-40`);
- `clients.address_reference` (`0066:151`).

Además:

- la ficha lee el campo viejo (`app/studio/(app)/clientes/[markbox]/page.tsx:440`);
- el chofer también (`lib/studio/dispatch-mobile-queries.ts:163`, `:199-200`);
- el registro deja el campo en null (`app/registro/actions.ts:251`).

Hay una **quinta copia**, que es intencional: `shipments.delivery_address` (`0009:11`) es la dirección de
**ese** envío. La 0694 §8 la deja fuera de su alcance.

Lo que esta spec agrega para la dirección está en la §4: la guardia de CI y la vista de completitud.

### D-2. Ciudad y estado → la arregla la 0694 (decisión 8)

- El Studio no los muestra: `lib/studio/client-queries.ts:51` no los selecciona.
- La fusión los pierde: `merge_clients` en `0361` no menciona `city` ni `state`.
- La 0694 los muestra y los conserva al fusionar.
- **Dónde viven:** lo cerró la 0694 (decisión 8). Se quedan en la ficha y sirven de precarga. Esta spec no
  lo reabre.

### D-3. Identidad partida: `persons` frente a `clients` (riesgo alto)

| Pieza | Dónde |
|---|---|
| `persons` copia `national_id`, `doc_kind`, `name`, `email` y `phone` de la ficha | `0170_persons.sql:16-28`; copia única `0170:68-76` |
| `clients.person_id` y su copia única | `0172_clients_person_link.sql:11-12`, `:20-24`. El comentario de `:5-6` dice que el alta lo llenaría en la app; **eso nunca se programó** |
| Cédula única en `persons`, sin cruce con la de `clients` | `0170:38-40` frente a `0095` |

**Nadie llena `person_id` en una ficha nueva.** Lo comprobé en cada camino:

- `/registro`: `app/registro/actions.ts:239-284`;
- el alta del Studio: `app/studio/(app)/clientes/actions.ts:236-255`;
- la conversión de un lead de Kommo: `lib/studio/kommo-convert.ts:210-222`;
- el registro por enlace: `0562:240-255`, `:587-602`;
- Mi perfil: `portal_update_my_profile`.

La fusión solo conserva el valor que ya había (`0361:258`). Academia y Club crean una persona al vuelo
(`lib/studio/academia/queries.ts:507-517`), pero no la ligan a la ficha.

**Efecto:**

- **El Club no aparece en el portal** de un cliente nuevo, aunque el Studio lo haya inscrito. Las políticas
  del Club resuelven a la persona por `person_id`: `0187:28-89`, `0424:105-120` y `0235:224-268`, leídas
  por `lib/portal/portal-club-queries.ts:144-175`.
- La lista del Club en el Studio muestra «sin Shipping Mark de carga» (`lib/studio/club/club-member-queries.ts:39-46`).
- Academia busca solo en `persons` por cédula (`academia/queries.ts:418-448`). Con la cédula de un cliente
  nuevo **crea una segunda identidad**.
- En los clientes viejos, `persons` conserva el nombre, la cédula, el correo y el teléfono de la copia de
  0170: ninguna edición los sincroniza. El Club muestra esos datos viejos (`club-member-queries.ts:80-81`).
- **No dependen de `person_id`:** el portal de Academia (por `client_markbox`) y referidos.

**Es intencional que existan personas sin ficha:** alumnos de Academia que no son clientes de carga
(`0185:39-41`, `0177:16-17`).

### D-4. Correo: tres lugares (riesgo alto)

| Fuente | Escritores | Lectores principales |
|---|---|---|
| `clients.email` | alta y edición del Studio (`clientes/actions.ts:243`, `:390`); `/registro` (`registro/actions.ts:245`); enlace (`0562:245`, `:592`); Kommo (`kommo-convert.ts:220`) | perfil del portal (`lib/portal/portal-queries.ts:82-89`); **correo de avisos** (`lib/studio/notifications/drain-client-notifications.ts:233-259`); tarjeta de acceso de la ficha (`PortalAccessCard.tsx:136`, `:144`); `/entrar` sin acceso (`lib/studio/portal/sin-acceso.ts:81-83`) |
| `client_users.email` | invitación (`0080:106`, `:133`, `:139`); `/registro` (`registro/actions.ts:396-403`); enlace (`0559:195-205`) | **inicio de sesión** en `/entrar` (`app/entrar/actions.ts:218-224`, `:241`); recordatorio a invitados (`app/api/cron/portal-cold-reminder/route.ts:80-87`); volver a invitar (`0080:121-123`) |
| `auth.users.email` | `registro/actions.ts:367-372`; `lib/studio/portal/magic-link.ts:85`; comprobación de correo (`correo-comprobacion.ts:75`, `app/registro/correo/[token]/actions.ts:145`, `:209`) | enlace mágico (`magic-link.ts:66-87`); vincular invitado (`0080:155-170`) |

- **Lo único que sincroniza es la 0559.** Lo hacen dos piezas:
  - el **trigger** `clients_email_vuelve_sin_comprobar` (`0559:700-739`), que pone `client_users.email` en
    la dirección interna (`:704-713`);
  - `dejarCuentaSinComprobar` (`clientes/actions.ts:452-513`), que pasa la cuenta de Auth a esa dirección.

  Después, `/entrar` responde «sin comprobar» (`app/entrar/actions.ts:233-244`) hasta que el cliente
  compruebe el nuevo correo. **Solo cubre las cuentas con fila en `client_email_checks`**, es decir, las
  que nacieron del enlace. En las demás (invitación de la 0080 y `/registro`), el correo de entrada puede
  quedar distinto del de contacto.
- **Intencional:** la dirección interna `.invalid` mientras el correo no se compruebe (`0559:42-46`).

### D-5. Asesor: dos dueños (riesgo medio)

- `clients.advisor_id` (`0151:28-29`) lo escriben `assignAdvisorAction` (`clientes/actions.ts:1095-1133`) y
  la fusión (`0361:259`). Lo leen la ficha (`[markbox]/page.tsx:348`, `:511`), el «Tu asesor» del portal
  (`0403:10-40`) y los avisos de cambio de datos (`lib/studio/change-request-notify.ts:64-84`).
- `crm_tarjetas.asesor_id` (`0506:317`) lo escribe `cambiarDuenoTarjetaAction` (`crm/tarjeta-actions.ts:452-478`).
  Las RPC lo copian de la ficha **una sola vez y solo si la tarjeta no tiene dueño** (`coalesce`, en
  `0513:214-222`, `0553:106-125` y `0566:277-283`). Lo leen el tablero del CRM
  (`lib/studio/crm-tablero-queries.ts:30`, `:272`) y, según su plan, el futuro reporte «desempeño por
  asesor» (`lib/studio/reports/queries.ts:623-631`).
- **Efecto:** el cliente ve a un asesor en el portal y el CRM le atribuye la venta a otro.
- **Intencional:** que la tarjeta tenga dueño propio mientras no hay ficha (leads).

### D-6. Nombre del cliente copiado en 9 tablas operativas (riesgo medio)

**Ningún trigger sobre `clients` reacciona a un cambio de `name`.** `updateClientAction`
(`clientes/actions.ts:386-400`) actualiza la ficha y nada más.

| Copia | Nace | Se refresca | La leen |
|---|---|---|---|
| `shipments.client_name` | `0002:35` | solo al pasar a otro cliente (`0551:397`) o al partir (`0563:799`) | Tracking, drawer, dashboard, búsqueda, agente IA |
| `warehouse_receipts_cn.client_name` | `0008:59` | no | Almacén China, despacho |
| `warehouse_boxes.client_name` | `0240:53` | sigue a la recepción, no a la ficha (`0240:239-262`) | Estiba |
| `dispatch_order_packages.client_name` | `0024:426` | no (es una copia de la copia) | Bodeguero y camionero (`CurrentDelivery.tsx:134`) |
| `warehouse_receipt_ve_boxes.client_name` | `0067:79` | solo al partir (`0563:861`) | Recepción VE |
| `consolidation_items.client_name` | `0096:203` | solo al reasignar o partir | Naviera, tracking por contenedor |
| `sales_orders.client_name` | `0125:51` | no | Órdenes de venta |
| `inspection_reports.client_name` | `0176:60` | no | Inspecciones |
| `quotes.client_name` (borrador) | `0007:14` | no | Cotizador |

En varios casos el Studio guarda el texto que se escribió en el formulario, no el de la ficha. Por ejemplo,
`tracking/nuevo/actions.ts:112` y `cn/actions.ts:109`.

### D-7. El Shipping Mark: el cambio de código no cubre todo

`rename_client_markbox` (vigente en `0552:702-875`) reescribe el texto viejo en unas 30 tablas
(`0552:808-856`). **No cubre:**

- `exc0674_facturas.client_markbox` y `billed_markbox`, y `exc0674_factura_envios.client_markbox`
  (`0564:190`, `:193`, `:250`). Nacieron después de la 0552, y la función no se redefinió. Se cruzan con
  `shipments.client_markbox` (`0564:407`), así que después de un cambio de código quedan desalineadas;
- `shipment_rate_snapshots.client_markbox` (`0496:219`). La tarifa congelada es intencional (§2.1), pero
  su columna de texto no se reescribe al cambiar el código. Es menos grave porque se lee por `client_id`.

**`merge_clients` mueve `client_id`, no el texto** (`0361:130-222`).

- **INFERENCIA:** las filas guardadas con el código de la ficha fusionada (embarques, facturas, prealertas)
  no se verían en el portal del sobreviviente. Unas 32 políticas comparan el texto con el markbox vivo
  (`0367:12-17`). Lo mide la consulta Q18.

### D-8. Duplicados de clientes: solo el documento está protegido en la base

| Llave | Base | Aplicación |
|---|---|---|
| Documento (RIF o cédula, normalizado) | índice único `clients_tenant_doc_unique` (`0095:35-37`) | sí |
| Shipping Mark | `unique (tenant_id, markbox)` (`0006:23`), exacto: distingue mayúsculas y espacios | sí |
| Correo | **ninguna** | solo `/registro` y el enlace, con `find_duplicate_client_service` (`0552:147-207`, llamada en `app/registro/actions.ts:178`) |
| Teléfono | **ninguna** | igual que el correo, con `phone_match_key` (`0342:49`) |

- **El alta del Studio no busca duplicados por correo ni por teléfono:** `clientes/actions.ts:236-255`
  inserta directo y solo traduce el 23505 del documento o del código.
- La herramienta de fusión (`client_duplicate_candidates`, `0341:151`) existe para limpiar después.

### D-9. Fechas: «hoy» tiene varias fuentes (riesgo alto en lo fiscal)

**La base no fija zona.** Ninguna migración hace `set timezone` y las pruebas fijan UTC, así que
`current_date` es el día UTC. Esto es **INFERENCIA para producción**: lo mide la consulta Q19.

**SQL.** No hay ninguna función `caracas_today()`. La 0533 de la SDD-0576 no incorporó un helper SQL
(`docs/specs/0576-fechas-caracas/spec.md:222`, checkpoint C1), así que
59 líneas en 24 migraciones repiten `(… at time zone 'America/Caracas')::date`, con cuatro relojes distintos:
`now()`, `clock_timestamp()`, `statement_timestamp()` y `transaction_timestamp()`.

| Riesgo | Hallazgo | Dónde |
|---|---|---|
| **Alto** | El **número de factura** toma el año UTC (`extract(year from current_date)`), pero `issued_at` toma el día de Caracas. Entre las 20:00 y las 24:00 del 31 de diciembre sale una factura fechada en un año con número del siguiente. Lo mismo pasa con los asientos, los recibos y las CxP. Hay una veintena de funciones de correlativo así: el conteo crudo da 28 apariciones de `extract(year from current_date)` en 22 archivos, incluidas definiciones históricas. La lista exacta de las vigentes se arma al arrancar la F-2. **Preventivo:** Q20 no encontró ningún caso hasta hoy | `0077:70`; `0078:98`, `0079:97`, `0088:185`, `:211` y otros |
| **Alto** | El **Libro de Ventas** y la Posición de IVA filtran por `created_at` con límites UTC, no por `issued_at` en Caracas. Una factura del último día del mes, después de las 20:00, cae en el mes siguiente. **Preventivo:** Q21 no encontró ningún caso hasta hoy | `lib/studio/fiscal/queries.ts:225-226`; `fiscal/types.ts:25-28`, `:382` |
| **Alto** | Aging, Dirección y KPIs ponen por defecto un `today` en UTC y se lo pasan a colas que por defecto usan Caracas, así que el UTC **anula** al de Caracas | `lib/studio/reports/queries.ts:740-744`; `direccion/queries.ts:439`; `dashboard/dashboard-kpi-queries.ts:57` |
| **Alto** | Nómina y financiero China, con defaults SQL en UTC y valores por defecto en UTC en el código. El mismo módulo de nómina usa `hoyEnCaracas` en otras partes | `0161:37`, `0164:28`, `:48`, `0171:26`, `0114:87-258`; `nomina/loan-types.ts:222`; `partner-finance/posting.ts:237` |
| Medio | Las tarifas públicas vencen 4 horas antes; las guardas de «fecha no futura» aceptan el día siguiente; la cuenta regresiva al cut-off del portal está en UTC | `0256:153`, `0330:305`, `0458:116`; `0483:123`; `app/portal/(app)/layout.tsx:137` |
| Medio | Cotizaciones: `valid_until = current_date + 30` | `0007:29`; `cotizador/actions.ts:90` |

**Los 17 defaults de columna con `current_date` en UTC:**

- `quotes.valid_until` (`0007:29`);
- `warehouse_receipts_cn.received_at` (`0008:76`);
- `customs_filings.arrived_at` (`0010:71`);
- `tms_incidents.occurred_at` (`0011:150`);
- `news_posts.date` (`0055:39`);
- `supplier_charges.charged_on`, `supplier_credit_notes.issued_on`, `currency_conversions.converted_on`,
  `partner_ledger_entries.occurred_on` y `supplier_claim_offsets.claimed_on` (`0114:87`, `:126`, `:164`,
  `:205` y `:258`);
- `service_price_history.valid_from` (`0130:160`);
- `academy_diplomas.issued_at` (`0144:215`);
- `nomina_contractor_payments.paid_on` (`0161:37`);
- `nomina_loans.granted_on` y `nomina_loan_installments.paid_on` (`0164:28`, `:48`);
- `nomina_warnings.issued_on` (`0171:26`);
- `bitacora_meetings.fecha` (`0214:90`).

**TypeScript.** El lector compartido existe: `lib/shared/fechas-caracas.ts`, con 38 importadores. Pero:

- hay 102 usos de `toISOString().slice(0, …)` fuera de las pruebas;
- hay siete reimplementaciones del «hoy Caracas». Dos se llaman `fechaCaracas` con otra firma
  (`lib/studio/user-module-grants.ts:240` y `lib/news/autopublicar/ritmo.ts:21`), y otras usan `-04:00`
  escrito a mano.

**Fechas como texto o con tipos mezclados:**

- `tracking_snapshots.pol_date` y `pod_eta` son `text` (`0158:37`, `:39`), y se interpretan con una
  heurística (`resolve-shipment-eta.ts:40-50`);
- la ETA vive como `date` en unas tablas, como `timestamptz` en otras y como `text` en otra;
- `received_at`, `paid_at` y `occurred_at` también cambian de tipo según la tabla.

**Fechas copiadas que no se refrescan:**

- `client_notification_schedule.scheduled_for` es una copia de la ETA. `refreshTracking`
  (`naviera/actions.ts:408`, `:508`) actualiza `pod_eta` sin reprogramar los avisos, así que una ETA nueva
  de SeaRates deja el aviso con la fecha vieja;
- hay dos cadenas de ETA distintas: la de los avisos (`resolve-shipment-eta.ts:62-98`) y la del portal
  (`lib/portal/seguimiento-estimado.ts:170-175`).

**No hay defaults con fechas literales viejas.** La 0660 (el estándar del campo de fecha) sigue con sus
tandas 2 a 4 y no toca la base ni los validadores (`0660/spec.md:37`).

### D-10. Otras copias de riesgo bajo

| Dato | Copias | Clasificación |
|---|---|---|
| Nombre y contacto del aliado | `aliados.trade_name`, `support_email` y `support_whatsapp` (`0362:72`, `:82-83`) frente a la ficha de `aliados.client_id` | INFERENCIA: hoy nadie lee las columnas de marca. Se resuelve en la 0696 o la 0666 |
| Nombre del proveedor | texto libre en `warehouse_receipts_cn` (`0008:66`), `qr_print_orders` (`0027:35`), `consolidation_items` (`0096:204`) y `purchase_orders` (`0124:42`) | Riesgo medio; fuera de esta spec (§8) |
| Tasa de cambio sin fuente | `payment_receipts`, `supplier_payments`, `supplier_charges`, `partner_ledger_entries` y `expenses` | Riesgo bajo |
| `tenant_fx_history` | `0074:55`; la `0495:37-40` la da por obsoleta | Retiro pendiente |
| Comprobante HTML frente a PDF | `comprobante/page.tsx:232` lee la dirección viva; el PDF lee la sellada (`invoice-client-doc.ts:69-84`) | Lo arregla la 0694 (decisión 9) |

### 2.1 Copias intencionales: están bien y no se tocan

| Copia | Por qué |
|---|---|
| `invoices.client_name`, `client_rif`, `client_doc_kind` y `client_fiscal_address` | Se sellan al emitir. Un trigger impide cambiarlas (`0466:249-318`) |
| `payment_receipts.client_name` y `client_markbox` | Se copian de la factura al cobrar (`0467:312`) |
| `shipment_rate_snapshots` | Es la tarifa congelada (`0496:213-219`). Solo su texto `client_markbox` queda viejo al cambiar el código (D-7) |
| `invoices.fx_rate`, con su fuente y su fecha | Es la tasa del documento (`0495:349-359`) |
| `client_markbox` en las tablas que cubre `rename_client_markbox` | Es el Shipping Mark propagado: la llave del portal |
| `legal_acceptances.client_markbox`, `client_markbox_history` y `clients.legacy_markbox` | Son historial |
| `qr_print_orders.client_name` | Guarda el Shipping Mark, no el nombre (`app/m/cn/qr-actions.ts:71`) |
| `tenant_id` en casi todas las tablas | Es para la RLS, y lo validan triggers |
| `due_date` calculado al emitir | Es la condición del documento |
| CRM y Chatwoot | Están limpios: guardan ids, y el check de `0506:342` lo garantiza |

## 3. Producción: conteos agregados

Son 21 consultas (Q1 a Q21), con 25 sentencias, porque Q15 y Q18 miran varias tablas. Corrieron en una
sesión `read only` y solo devuelven conteos: ninguna fila, valor, PII ni monto. El SQL vive fuera del repo,
en las notas de Dir_DTD, que lo revisó y lo corrió el 2026-11-20. Los números van por chat. Aquí va qué
mide cada consulta y su lectura en términos cualitativos.

| Hallazgo | Consulta | Qué cuenta | Lectura (2026-11-20) |
|---|---|---|---|
| D-8 | Q1 a Q4 | Grupos de fichas vivas con el mismo correo, el mismo teléfono (`phone_match_key`), el mismo documento o el mismo Shipping Mark sin distinguir mayúsculas | **Hay** por correo y por teléfono. **No hay** por documento ni por código |
| D-1, D-2 | Q5 | Por canal de registro: fichas sin ninguna dirección, solo con la vieja, solo con la nueva, con las dos, y con ciudad | **Hay** clientes del portal sin ninguna dirección. Es materia de la 0694 |
| D-1 | Q6 | Fichas con las dos fuentes y textos distintos | **No hay** |
| D-1 | Q7 | Fichas con direcciones nuevas y ninguna predeterminada | **Hay.** Mientras tanto, el helper de la 0694 las lee como «la más reciente, sin predeterminada». La regla de integridad va en esta spec (§4.10, F-9) |
| D-2 | Q8 | Fusiones en las que se perdió la ciudad | **No hay** |
| D-3 | Q9 | Fichas sin `person_id`, por canal | **Hay**, en los clientes nuevos. **No hay** en los importados. Es el hallazgo con daño actual que más pesa en el Club y en Academia (F-3) |
| D-3 | Q10, Q11 | Personas ligadas que no coinciden con su ficha, y personas sueltas con la cédula de una ficha | Q10: **hay** en el correo y **no hay** en el nombre ni en el documento. Q11: **no hay** |
| D-4 | Q12, Q13 | Accesos activos cuyo correo no es el de la ficha, y Auth frente a `client_users` | Medido. El resultado va por chat |
| D-5 | Q14 | Tarjetas con ficha cuyo dueño difiere del asesor de la ficha | **No hay** |
| D-6 | Q15 | Copias de `client_name` distintas de la ficha (embarques, recepciones CN e ítems de consolidado) | **No hay:** el riesgo está latente |
| D-7 | Q16, Q18 | Filas de `exc0674_*`, embarques, facturas y prealertas con el código de una ficha fusionada o inexistente | **No hay** |
| D-9 | Q19 | La zona horaria de la sesión de la base | **UTC.** Confirma la inferencia |
| D-9 | Q20, Q21 | Facturas cuyo año de correlativo no es el de `issued_at`, y facturas cuyo mes UTC no es el de Caracas | **No hay:** el riesgo es **preventivo**, con fecha límite el 31 de diciembre |
| 0696 | Q17 | Clientes de aliado sin dirección | Medido. Es insumo de la 0696 |

**Cómo cambian las prioridades:**

- La identidad (F-3) tiene daño hoy.
- Las fechas fiscales (F-2) no tienen daño, pero sí fecha límite.
- El nombre copiado, el Shipping Mark y el asesor no tienen daño hoy, y siguen como prevención. Los
  duplicados existen y se revisan con la oficina (P-8).

## 4. Diseño: la regla para que no vuelva a pasar

### 4.1 Una fuente por dato, escrita en un registro

Archivo nuevo: `docs/architecture/fuentes-unicas.md`. Es un documento vivo y tiene una fila por dato.

| Dato | Fuente única | Lector compartido | Copias permitidas | Campos viejos y su plan de retiro |
|---|---|---|---|---|
| Dirección de entrega | `client_delivery_addresses` | `direccionDeEntrega` (0694) | `shipments.delivery_address` (la de ese envío); `invoices.client_fiscal_address` (sellada) | `clients.address` y `address_reference` (0694, fase F-4) |
| Ciudad y estado de entrega | `clients.city` y `clients.state` (0694, decisión 8) | la ficha | — | ninguno: se quedan (cerrado por la 0694) |
| Identidad de un cliente de carga | `clients` | `clients` | `persons` solo para personas **sin** ficha | `persons.name`, `email`, `phone` y `national_id` cuando hay ficha (§4.4, P-1) |
| Correo de contacto | `clients.email` | — | `client_users.email` y `auth.users.email` siguen a la ficha (§4.5, P-2) | — |
| Asesor | `clients.advisor_id` cuando hay ficha | — | `crm_tarjetas.asesor_id` solo sin ficha (§4.6, P-3) | — |
| Nombre del cliente en la operación | `clients.name`, leído en vivo | `nombreCliente` por lote | las selladas de §2.1 | las 9 de D-6 (§4.7, P-4) |
| Shipping Mark | `clients.markbox` | — | las columnas de `rename_client_markbox`, vigiladas por la guardia de §4.8 | — |
| «Hoy» de negocio | Caracas | SQL `public.dia_caracas()`; TS `fechaCaracas` | — | los 17 defaults en UTC (D-9), los correlativos con año UTC y las 7 reimplementaciones en TS (§4.9) |
| ETA | una cadena, en `lib/shared` | `etaDelEnvio` | `scheduled_for`, que se reprograma (§4.9) | las dos cadenas de hoy |

Toda columna nueva que copie un dato de la tabla debe declarar en su `comment on column` si es **sellada**
(con su trigger) o **derivada** (con su refresco). Lo revisa la guardia de §4.8.

### 4.2 Vista de completitud de la ficha

Vista nueva: `public.client_completeness`, con `security_invoker` y la RLS del Studio. Da una fila por ficha
viva, con columnas booleanas:

- `tiene_direccion`, que mide F-2 con la regla de la 0694 §4.1;
- `tiene_ciudad`;
- `tiene_correo`;
- `tiene_telefono_whatsapp`, con la misma regla de 11 a 15 dígitos de la 0694;
- `tiene_documento`;
- `persona_ligada`;
- `persona_por_revisar` (§4.4);
- `correo_acceso_coincide`;
- `asesor_coincide_crm`.

Tiene dos usos:

- `clientCompleteness` (`lib/studio/client-types.ts:426`) y el bloque «Perfil del cliente» la leen en lugar
  de calcular cada uno por su lado. **La dueña del cambio de `clientCompleteness` es la 0694 (F-1):** pasa a
  `hasDeliveryAddress`. Esta spec (F-8) solo cambia el cálculo por la vista, con la misma regla, y entra
  cuando la 0694 F-1 ya esté en `main`;
- un tablero de conteos para la oficina, solo con números, que dice cuántas fichas tienen cada falta.

No expone PII: devuelve booleanos y el id. En la región `cn` no admin se oculta como el resto de la ficha
(SDD-0531).

### 4.3 Duplicados de clientes (D-8)

1. **El alta del Studio y la conversión de Kommo llaman a `find_duplicate_client_service`**, como ya hace
   `/registro`. Si encuentran un duplicado, muestran «Ya existe una ficha con ese correo», o con ese
   teléfono, con un enlace a la ficha. La decisión de bloquear o dejar seguir es P-5.
2. **Índice parcial único por correo normalizado**: `lower(btrim(email))` en las fichas vivas con correo,
   solo **después** de que Q1 dé cero, limpiando con la herramienta de fusión. Si Q1 no da cero, el índice
   espera.
3. **Por teléfono no hay índice**: dos fichas pueden compartir de verdad el teléfono de una oficina. Basta
   con el aviso del punto 1.
4. **El Shipping Mark** se normaliza con un check `markbox = upper(btrim(markbox))`, solo si Q4 da cero.

### 4.4 Identidad: `persons` deja de copiar a la ficha (D-3, P-1)

Propuesta, sujeta a P-1:

- Un trigger `after insert` sobre `clients` crea o liga la persona, buscándola por la cédula normalizada
  dentro del tenant: si existe, la liga; si no, la crea. Así ninguna ficha nueva queda sin `person_id`.
  Cubre a la vez `/registro`, el Studio, el enlace y Kommo.
- Una migración idempotente liga las fichas vivas sin `person_id`, por cédula. Las personas sueltas con la
  cédula de una ficha (Q11) se ligan a esa ficha en lugar de crear otra.
- Cuando hay ficha, el nombre, el correo, el teléfono y la cédula se leen de `clients`. La vista
  `persona_vigente` hace `coalesce` de la ficha sobre la persona, y el Club y Academia leen la vista. Los
  campos de `persons` quedan solo para las personas sin ficha.
- `academia/queries.ts:418-448` busca primero en `clients` por cédula y después en `persons`.
- **La persona de la ficha fusionada** (la dueña es esta F-3, según la §5):
  - `merge_clients` ya hace `coalesce(c.person_id, m.person_id)` (`0361:258`). Si el sobreviviente no tenía
    persona, toma la de la fusionada, con sus vínculos de Club y Academia. **Eso no cambia, y esta spec no
    redefine `merge_clients`.** La única redefinición es la de la 0694 F-2, que conserva esa línea tal cual.
  - **Si los dos tenían persona,** no se fusionan personas automáticamente. Mover membresías del Club y
    matrículas de Academia de una persona a otra puede chocar con sus restricciones únicas. La persona de la
    fusionada queda como está, ligada a la ficha fusionada, que es el alias.
  - **La marca entra en la F-3**, no espera a la F-8. La migración de la F-3 crea una vista mínima,
    `client_person_review` (`security_invoker`, con la RLS del Studio). Devuelve el id de cada ficha viva
    que absorbió a otra cuyo `person_id` es distinto del suyo, y nada más. La oficina la revisa a mano. No
    hay trigger.
  - Cuando llegue la F-8, la vista `client_completeness` (§4.2) toma esa vista como `persona_por_revisar`.

### 4.5 Correo (D-4, P-2)

- `clients.email` es el correo de contacto.
- **Una sola semántica, la de la 0559, para todas las cuentas.** Si el Studio cambia el correo y el cliente
  tiene acceso activo:
  - la cuenta pasa en el acto a su dirección interna;
  - el acceso queda «sin comprobar»;
  - se manda la comprobación al correo nuevo.

  El correo anterior deja de servir para entrar desde ese momento. Después de comprobar, el correo de
  entrada y el de los avisos son el mismo.
- **Cuentas sin fila en `client_email_checks`** (invitación de la 0080 y `/registro`). La secuencia está
  verificada contra el trigger de la 0559, que solo actúa cuando `pending_email` **es distinto** del correo
  nuevo (`0559:714-731`):
  1. **Antes del `update`**, `updateClientAction` crea la fila con:
     - el `auth_user_id` de `client_users`;
     - el `internal_email` generado igual que en la 0559;
     - **`pending_email` con el correo anterior** (el que tiene hoy `clients.email`);
     - `verified_at` en null y `auth_interno` en false.
  2. El `update` de `clients.email` al correo nuevo dispara el trigger. Como `pending_email` (el anterior)
     es distinto del nuevo, el trigger pasa `client_users.email` a la dirección interna y deja
     `pending_email` con el nuevo (`0559:714-731`).
  3. `dejarCuentaSinComprobar` (`clientes/actions.ts:452-513`) encuentra la fila sin `verified_at` y con
     `auth_interno` en false, y pasa la cuenta de Auth a la dirección interna.

  Así el trigger y `dejarCuentaSinComprobar` las cubren **sin cambiar su cuerpo**.
- **Los pasos 1 y 2 los hace una sola RPC**, `client_email_change_service(p_client_id, p_new_email, p_actor)`:
  - es `security definer`, con `search_path = ''`, y **solo la ejecuta service_role** (`revoke` de
    `public`, `anon` y `authenticated`), porque `client_email_checks` está revocada para `authenticated`
    (`0559:145`);
  - `updateClientAction` la llama con el cliente admin, **después** de su propio control de rol;
  - crea la fila (paso 1) y hace el `update` de `clients.email` (paso 2) **en la misma transacción**. Si
    cualquiera de los dos falla, no queda nada: ni una fila con `pending_email` en el correo anterior (que
    dejaría la cuenta trabada en `/entrar`) ni el correo cambiado a medias;
  - si la cuenta ya tiene fila en `client_email_checks`, no crea otra y solo hace el `update`;
  - **el actor real queda en la auditoría.** El trigger `audit_d5_clients_contact` toma el actor de
    `auth.uid()` y, si es nulo, registra `'system'` (`0293:358-359`). Con service_role, `auth.uid()` sería
    nulo. Por eso la RPC recibe `p_actor`, que es el `auth.uid()` del operador que la acción ya verificó, y
    antes del `update` hace `perform set_config('request.jwt.claim.sub', p_actor::text, true)`. Eso dura solo
    en la transacción. Así `auth.uid()` devuelve al operador dentro del trigger, y el audit registra
    `'user'` con su id;
  - **el orden en la acción:** cuando el correo cambia, `updateClientAction` guarda los demás campos **sin
    `email`** y después llama a la RPC, que es **la única que escribe `clients.email`** en ese flujo. La
    acción no hace otro `update` del correo. Si la RPC falla, la acción responde con el error del correo, y
    el mensaje dice que los demás datos sí se guardaron.
- La tarjeta de acceso de la ficha dice «Sin comprobar desde …» y el botón «Reenviar comprobación» sirve
  para cualquier cuenta, no solo para las del enlace.

### 4.6 Asesor (D-5, P-3)

Propuesta: **con ficha, manda `clients.advisor_id`.**

- `cambiarDuenoTarjetaAction` sobre una tarjeta con `client_id` escribe `clients.advisor_id` con
  `assignAdvisorAction`, en lugar del dueño de la tarjeta.
- El tablero lee `coalesce(clients.advisor_id, crm_tarjetas.asesor_id)`.
- Sin ficha (lead), la tarjeta conserva su propio dueño.
- Cuando el lead se vuelve ficha, su dueño pasa a `advisor_id` si la ficha no tiene asesor.
- El reporte «desempeño por asesor» lee la misma expresión.

### 4.7 Nombre copiado (D-6, P-4)

Propuesta:

- **Lectura en vivo:** las pantallas operativas leen el nombre de la ficha, con `nombreCliente`, una lectura
  por lote por `client_id` o por markbox. La columna copiada queda solo como respaldo de las cajas huérfanas
  y de lo ya impreso.
- **Refresco acotado:** un trigger `after update of name on clients` actualiza las copias de las filas
  **abiertas**, y nunca las selladas. Abiertas significa embarques sin entregar, recepciones sin despachar,
  ítems de consolidados sin cerrar, borradores de cotización y órdenes sin facturar.
- `tracking/nuevo/actions.ts:112` y `cn/actions.ts:109` dejan de guardar el texto del formulario cuando hay
  Shipping Mark, y lo toman de la ficha, como ya hace el móvil (`app/m/cn/nueva/actions.ts:81`).

### 4.8 Guardia de CI: nadie vuelve a leer un campo viejo

Prueba de contrato nueva: `lib/__tests__/fuentes-unicas.contract.test.ts`. Corre en Vitest y lee el registro
de §4.1.

1. **Lectores de campos viejos.** Busca en `app/` y en `lib/` cada campo que el registro marca como viejo,
   por ejemplo `persons.name`, `persons.email` y `persons.phone` donde hay ficha. Falla si aparece un lector
   que no está en la lista de excepciones, y esa lista solo puede achicarse: la prueba guarda el máximo.
   - **`clients.address` y `address_reference` no entran aquí.** La dueña de esa guardia es la prueba de
     contrato de la 0694 (§7, punto 4), con su lista de excepciones que llega a cero en su F-4. Esta prueba
     solo la cita en el registro.
2. **Cobertura del Shipping Mark.** Compara las columnas `*markbox*` de las migraciones con la lista que
   reescribe `rename_client_markbox`. Falla si una columna nueva no está cubierta ni marcada como
   historial.
3. **«Hoy» en UTC.** Falla con un `toISOString().slice(0, 10)` nuevo o un `current_date` nuevo en lógica de
   negocio. La lista congelada de hoy se achica por tandas, como la `fechas-contract.test.ts` de la 0660.
4. **Copias sin declarar.** Las columnas nuevas llamadas `client_name`, `client_email`, `client_phone`,
   `client_address` o `*_markbox` necesitan su `comment on column` con «sellada» o «derivada».

### 4.9 Fechas (D-9)

1. **`public.dia_caracas()`**, `stable` y `security invoker`, que devuelve
   `(statement_timestamp() at time zone 'America/Caracas')::date`. Es un solo reloj, con una razón: el
   mismo día en toda la sentencia. Cada función nueva lo usa, y las existentes se migran por tandas.
2. **Correlativos.** El año del número sale del mismo día que `issued_at`: el de Caracas. La primera tanda
   son facturas, asientos, recibos y CxP. Los números ya emitidos no cambian.
3. **Libro de Ventas y Posición de IVA** filtran por `issued_at`, y cuando falta, por el día de Caracas
   de `created_at`: es una regla única, que hoy está repetida dos veces de forma distinta
   (`0534:211` frente a `fiscal/types.ts:382`).
4. Se quitan los `today` en UTC que anulan al de Caracas en Aging, Dirección y KPIs.
5. **Los 17 defaults en UTC** pasan a `dia_caracas()`: primero nómina y financiero China, después el resto.
6. **TS:** se retiran las dos funciones homónimas `fechaCaracas` y los `-04:00` escritos a mano. Todos usan
   `lib/shared/fechas-caracas.ts`.
7. **ETA:**
   - una cadena única, `etaDelEnvio`, en `lib/shared`, que comparten los avisos y el portal;
   - cuando `refreshTracking` cambia `pod_eta`, se reprograman los avisos pendientes, como ya pasa al editar
     el itinerario.
8. **China** (P-6): ¿la bodega de Yiwu registra su día en la hora de China o en la de Caracas?

### 4.10 Una sola predeterminada por cliente (Q7)

Es una regla de integridad de `client_delivery_addresses`, no de pantalla.

**Lo que existe hoy:**

- el índice único parcial `client_delivery_addresses_default_uidx` (`0198:44-46`) garantiza **como
  máximo una** predeterminada vigente por cliente;
- falta garantizar **al menos una** cuando el cliente tiene filas vivas;
- **la app cambia la predeterminada en dos peticiones PostgREST separadas**, es decir, en dos
  transacciones: `clearDefaultForClient` y después `insertClientDeliveryAddress`
  (`lib/studio/client-address-queries.ts:78-116`), o `clearDefaultForClient` y después
  `setDefaultDeliveryAddress` (`:146-160`). Las usan Mi perfil (`app/portal/(app)/perfil/address-actions.ts`)
  y la tarjeta del Studio (`app/studio/(app)/clientes/actions.ts`). Entre las dos peticiones, el cliente se
  queda sin predeterminada. Por eso un chequeo al confirmar rompería esos dos flujos.

**Diseño, en este orden:**

1. **Primero, una sola RPC atómica** para el cambio de predeterminada:
   - `client_delivery_address_save(p_client_id, p_address_id, …, p_make_default)`:
     - es `security invoker`, así que rige la RLS de la 0198;
     - tiene `search_path = ''` y `revoke` de `public` y `anon`. Solo la ejecuta `authenticated`;
   - cubre los tres flujos de hoy, que son alta, edición y elegir predeterminada:
     - `p_address_id` en null es un alta;
     - con un id, es una edición, con o sin cambio de `is_default`;
   - en una transacción, hace el `update … set is_default = false` de la predeterminada actual (si cambia) y
     después el `insert` o el `update` de la fila elegida;
   - **si el `update` o el `insert` de la fila elegida afecta cero filas** (id inexistente, de otro cliente
     u oculto por la RLS), termina con error, y la transacción no deja nada;
   - **desmarcar la única predeterminada se rechaza** con un error de campo: «Elige otra dirección como
     predeterminada antes de quitar esta». Desmarcarla mientras se elige otra en la misma llamada sí se
     permite.
   - Pasan a usarla los cuatro llamadores:
     - en el Studio, `addClientAddressAction` y `setDefaultClientAddressAction`;
     - en el portal, `app/portal/(app)/perfil/address-actions.ts`. Hoy tiene tres caminos que limpian y
       marcan en dos peticiones:
       - `addAddressAction` (`:36`), incluida su rama de «misma dirección», que llama a
         `setDefaultDeliveryAddress` (`:53`), y la de alta nueva, que llama a `clearDefaultForClient` y a
         `insertClientDeliveryAddress` (`:57-59`);
       - **`updateAddressAction`** (`:89-92`);
       - **`setDefaultAddressAction`** (`:102`, que llama a `setDefaultDeliveryAddress` en `:109`).

     `clearDefaultForClient` y `setDefaultDeliveryAddress` dejan de llamarse por separado. **Los triggers de los puntos 2 a 4 no entran
     hasta que la app use esta RPC en `main` y en producción.**
2. **Marcar la primera fila.** Un trigger `before insert` (normal, no de restricción, porque un constraint
   trigger no puede modificar `new`), **`security invoker`**: si el cliente no tiene ninguna fila viva
   predeterminada, pone `new.is_default = true`.
3. **Promover al borrar**, con dos triggers sobre la misma condición,
   `when (old.deleted_at is null and new.deleted_at is not null and old.is_default)`. Los dos son
   `security invoker`:
   - **`before update of deleted_at`:** pone `new.is_default = false` en la **misma fila**. Tiene que ir en
     `before`, porque un segundo `update` de la fila ya borrada afectaría cero filas sin error: la política
     de la 0198 exige `deleted_at is null`;
   - **`after update of deleted_at`:** marca predeterminada a la fila viva más reciente del mismo cliente.
     Esa fila está viva, así que la política la deja escribir.

   Va en `after` porque ahí la fila borrada ya no cuenta para el índice parcial (`where is_default and
   deleted_at is null`). En `before`, la promoción chocaría con el índice. Sin filas vivas, el cliente se
   queda sin predeterminada, y eso es válido.
4. **El chequeo**, un constraint trigger diferido (`deferrable initially deferred`):
   - `after insert or delete or update of is_default, deleted_at, client_id`, por fila. No dispara con
     cambios de otras columnas;
   - revisa **los dos clientes**, el de `old.client_id` y el de `new.client_id`, porque la fusión mueve
     filas de un cliente a otro;
   - falla si alguno de los dos tiene filas vivas y no exactamente una predeterminada;
   - **es el único `security definer`** de los cuatro, con `search_path = ''`, para contar todas las filas del
     cliente aunque la RLS del que escribe solo le deje ver algunas. Devuelve solo el error, sin datos.
5. **Preflight en la migración**, en la misma transacción que crea los triggers:
   - primero, `lock table public.client_delivery_addresses in share row exclusive mode`, para que nadie
     escriba entre el conteo y la creación de los triggers;
   - después, un bloque `do` cuenta los clientes con filas vivas y sin predeterminada (la condición de Q7);
   - si encuentra alguno, aborta con un error que **solo lleva el conteo**: «Hay N clientes sin dirección
     predeterminada. Arréglalos antes de aplicar». No lleva ids, markbox ni nombres.

   Así no se puede aplicar mientras queden fichas sin arreglar.
6. **Las fichas que hoy no tienen predeterminada no se arreglan con esta migración.** Arreglarlas es una
   operación de datos en producción, aparte, con su acta de conteo y **el OK nominal de Sam**, y se hace
   **antes** de aplicar la migración. El preflight lo comprueba.

## 5. Dependencias

- **0694** (dirección): se implementa primero. Las dos specs son del mismo Worker, y cada pieza
  compartida tiene una sola dueña:

  | Pieza | Dueña | La otra |
  |---|---|---|
  | La guardia de `clients.address` y `address_reference` | 0694 §7.4 | 0695 §4.8 la cita y no la repite |
  | `merge_clients`: dirección, ciudad y estado | 0694 F-2 | La 0695 F-6 parte de la versión vigente (la de la 0694 F-2), solo agrega el Shipping Mark y va después |
  | `clientCompleteness` → `hasDeliveryAddress` | 0694 F-1 | La 0695 F-8 cambia el cálculo por la vista, conservando la regla, y va después |
  | Ciudad y estado | 0694, decisión 8 (cerrada) | La 0695 no pregunta de nuevo |
  | La persona de la ficha fusionada (`person_id` en `merge_clients`, `coalesce` en `0361:258`) | 0695 F-3 (§4.4) | La F-3 no toca `merge_clients`: el caso de dos personas lo marca la vista (`persona_por_revisar`). La 0694 F-2 conserva la línea tal cual al redefinir `merge_clients`, y la 0695 F-6 también |
  | La regla de una sola predeterminada (§4.10) | 0695 F-9 | La 0694 no la repite. Su helper lee «la más reciente» mientras tanto |

  La misma tabla se cita en la 0694 (§8).
- **0696** (cliente final del aliado): el cliente final guarda su dirección en la misma fuente única,
  `client_delivery_addresses`, de su propia ficha. La 0696 define quién la carga y cómo.
- **0576** y **0660** (fechas): esta spec retoma lo que la 0576 dejó fuera, como el helper SQL y el cierre
  global. No toca el componente `<DateField>` de la 0660.
- **0559** (comprobación de correo): §4.5 aplica su misma semántica a todas las cuentas, sin cambiar el
  cuerpo de su trigger.

## 6. Fases

| Fase | Qué entra | Migración | Notas |
|---|---|---|---|
| F-0 | Esta spec y los conteos de §3. | No | Aprobación de Sam. |
| **F-1** | El registro `fuentes-unicas.md` y la guardia de CI de §4.8, con sus listas congeladas de hoy. | No | Es lo que evita que el problema vuelva a crecer. Va primero porque no cambia comportamiento. |
| F-2 | Fechas fiscales: `dia_caracas()`, los correlativos, el Libro de Ventas y los `today` en UTC de los reportes (§4.9, puntos 1 a 4). | Sí | **Antes del 31 de diciembre de 2026**, por el cambio de año de las facturas. Es preventiva: no hay daño medido. **Plan B** si no está en producción el 28 de diciembre: la oficina no emite facturas, asientos, recibos ni CxP entre las 20:00 y las 24:00 del 31 de diciembre. **Dir_DTD le avisa a Sam el 28 y Sam a la oficina.** La instrucción queda escrita en el handoff de la F-2 y como aviso fijo en el Studio de facturación (`<Aviso tono="atencion">`) del 29 al 31. Dir_DTD vuelve a correr Q20 el 1 de enero. |
| F-3 | Identidad (§4.4): el trigger de alta, la vinculación por cédula y la vista `persona_vigente`. | Sí | Arregla el Club en el portal. **Tiene daño hoy** (§3). Puede ir en paralelo con la F-2: no comparten archivos. |
| F-4 | Correo (§4.5) y asesor (§4.6). | Sí (la RPC `client_email_change_service`) | El trigger de la 0559 no cambia. |
| F-5 | Duplicados (§4.3): el aviso en el alta del Studio y en Kommo, y después los índices, si los conteos dan cero. | Sí, después de limpiar | La limpieza con la herramienta de fusión es una operación de la oficina, con su propio OK. |
| F-6 | El Shipping Mark (D-7): `rename_client_markbox` cubre `exc0674_*`. `merge_clients` reescribe el texto o deja el alias de la 0367. | Sí | Q16 y Q18 salieron limpios: es preventiva. La redefinición de `merge_clients` parte de la versión de la 0694 F-2 y va después. |
| F-7 | Nombre copiado (§4.7). | Sí (trigger) | Según P-4. |
| F-8 | El resto de las fechas (§4.9, puntos 5 a 7) y la vista de completitud (§4.2). | Sí | La vista requiere la 0694 F-1 en `main`. |
| F-9 | Una sola predeterminada por cliente (§4.10), en dos pasos: **F-9a**, la RPC atómica y el cambio de Mi perfil y de la tarjeta del Studio para usarla; **F-9b**, los triggers y el preflight. | F-9a: sí (la RPC). F-9b: sí (los triggers) | Va después del helper de la 0694 F-1. La F-9b entra solo con la F-9a publicada y con las fichas sin predeterminada ya arregladas: eso es una operación de datos aparte, con su acta y el OK nominal de Sam, y lo comprueba el preflight. |

Cada fase lleva su PR y su `pnpm verify`. Las migraciones las numera Dir_DTD y las aplica con el runbook de
producción y el OK nominal de Sam. **Ninguna corrige datos de producción** sin un acta de conteo previa y su
propio OK.

## 7. `revisar-datos-ve` aplicado

Esto no es asesoría legal. Estados posibles: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

1. **Inventario.** `ENCONTRADO`: la cédula, el nombre, el correo y el teléfono viven en `clients` y en
   `persons` (D-3), y el correo en tres lugares (D-4). Cada copia es otra superficie donde un dato viejo o
   borrado sigue vivo.
2. **Minimización.** Al leer de la ficha (§4.4, §4.7), se dejan de mantener copias de PII. Es a favor.
3. **Exactitud.** `ENCONTRADO`: el Club muestra el nombre y la cédula de la copia de 0170, y el correo de
   contacto y el de entrada pueden quedar distintos (D-4). Estas fases lo corrigen.
4. **Supresión.** `NO VERIFICABLE`: si borrar o anonimizar una ficha alcanza a su fila de `persons` y a las
   9 copias de `client_name`. Es una pregunta para la fase de supresión, fuera de esta spec (§8).
5. **China (PIPL).** Leer el nombre en vivo tiene que pasar por el mismo ocultamiento de la región `cn`
   (`lib/studio/privacidad-cn.ts`) que hoy se aplica a la copia. Así lo exige la aceptación 6.
6. **Trazabilidad.** El aviso de duplicado (§4.3) no dice de quién es la ficha a un visitante. En el Studio,
   el enlace a la ficha es para roles que ya la ven.

## 8. Fuera de alcance

- Todo lo que ya cubre la 0694 (§1) y la 0696.
- Corregir datos de producción: fusionar duplicados, ligar personas en bloque, rellenar correos. Cada
  operación lleva su acta y su OK, aparte de esta spec.
- El nombre del proveedor copiado como texto libre (D-10): va en su propia spec.
- La supresión completa de PII en las copias (§7, punto 4).
- El componente de fecha `<DateField>` y sus tandas (0660).
- El modelo de cobro de los subaliados (0663).

## 9. Preguntas para Sam, una por una

Cada pregunta trae la recomendación primero.

- **P-1 (identidad). Decidida por Sam el 2026-11-20:** «Sí, manda la ficha». Para un cliente de carga, la
  ficha manda, y `persons` queda solo para quien no tiene ficha. Se implementa con el trigger que liga la
  persona al darse de alta y con la vista que lee la ficha (§4.4).
- **P-2 (correo). Decidida por Sam el 2026-11-20:** «Sí, en todas». Al cambiar el correo de un cliente con
  acceso, la cuenta queda «sin comprobar» hasta que confirme el nuevo, sin importar cómo nació la cuenta
  (§4.5). Sam acepta el costo: si la oficina escribe mal el correo, el cliente no entra hasta que se corrija
  y se reenvíe la comprobación.
- **P-3 (asesor).** Cuando el cliente ya tiene ficha, ¿manda el asesor de la ficha también en el CRM?
  *Recomendado: sí;* la tarjeta conserva su dueño solo para los leads sin ficha (§4.6).
- **P-4 (nombre).** Si se corrige el nombre de un cliente, ¿lo actualizamos en sus embarques, recepciones
  y despachos **abiertos**? *Recomendado: sí,* y nunca en facturas ni en documentos sellados (§4.7).
- **P-5 (alta duplicada en el Studio).** Si la oficina da de alta a alguien con un correo o un teléfono que
  ya existe, ¿se bloquea o solo se avisa? *Recomendado:* bloquear con el correo y avisar con el teléfono
  (§4.3).
- **P-6 (día de China).** En la bodega de Yiwu, ¿la fecha de recepción es el día de China o el de Caracas?
  *Recomendado:* el de China en la recepción, y el de Caracas en la contabilidad.
- **P-7 (prioridad). Decidida por Sam el 2026-11-20:** «Sí, en paralelo». La F-2 (fechas fiscales) y la
  F-3 (identidad) van a la vez, cada una en su rama. La F-2 conserva el plan B de la §6.
- **P-8 (duplicados ya existentes).** Con los conteos de Q1 y Q2 en la mano, ¿la oficina revisa y fusiona
  los grupos con la herramienta que ya existe? *Recomendado: sí,* antes de crear el índice único.

## 10. Aceptación verificable

1. **Conteos.** Q1 a Q21 corridas por Dir_DTD el 2026-11-20. Resultados en el chat y, en Git, solo la
   lectura cualitativa de la §3. **Cumplido.**
2. **F-1, guardia.** El detector de §4.8 es una función pura que recibe el texto de archivos y
   migraciones. La prueba tiene **casos negativos permanentes**: textos de ejemplo dentro del propio test
   que el detector tiene que marcar. Un revisor los ve y los corre sin tocar el repo:
   - un lector nuevo de `persons.email` en un archivo de `lib/` simulado;
   - una migración simulada con una columna `*_markbox` que no está en la lista de `rename_client_markbox`;
   - un `toISOString().slice(0, 10)` nuevo en un archivo simulado de `lib/studio/fiscal/`;
   - una migración simulada con una columna `client_name` sin `comment on column`.

   Además, la prueba pasa sobre el repo real en `main`.
3. **F-2, fechas fiscales.** Cada pieza se prueba en su capa:
   - **SQL** (`.test.sql` en PGlite, con `set local timezone = 'UTC'`). El correlativo recibe la fecha de
     emisión y no lee el reloj. Con `2026-12-31` da `F-2026-…`, y con `2027-01-01` empieza la serie de 2027.
     **Los números ya emitidos no cambian:** el test compara `invoice_code` de las filas sembradas antes y
     después de aplicar la migración.
   - **TypeScript** (Vitest, con `vi.setSystemTime` en 2026-12-31 a las 21:00 de Caracas, que son las
     01:00 UTC del 1 de enero):
     - `currentPeriod` y `fiscalRange` (`lib/studio/fiscal/types.ts:25`, `:57`) dan diciembre;
     - el Libro de Ventas de diciembre (`lib/studio/fiscal/queries.ts`, con PostgREST simulado) pide las
       facturas por `issued_at` de diciembre, y una factura con `issued_at` del 31 de diciembre entra en
       diciembre y no en enero;
     - Aging, Dirección y KPIs reciben el día de Caracas por defecto.
4. **F-3, identidad.** Una ficha nueva dada de alta por cualquiera de los cuatro caminos queda con
   `person_id`. Al fusionar dos fichas con personas distintas, el sobreviviente aparece en
   `client_person_review`. Con una sola persona, no aparece y toma la persona por el `coalesce`. Con la cédula de una ficha, Academia no crea otra persona. Un cliente nuevo inscrito en el
   Club lo ve en el portal. La vista muestra el nombre de la ficha y no el de la copia.
5. **F-4, correo y asesor.**
   - Cambiar el correo de una cuenta activa nacida en `/registro`, en el enlace **o en una invitación de la
     0080**, deja el acceso «sin comprobar» en el acto y manda la comprobación. El correo anterior ya no
     entra.
   - Un `.test.sql` reproduce la secuencia de §4.5 contra el trigger real de la 0559: con la fila creada con
     `pending_email` igual al correo anterior, el `update` al nuevo deja `client_users.email` en la dirección
     interna y `pending_email` en el nuevo. **Un caso de control** crea la fila con `pending_email` igual al
     nuevo y comprueba que el trigger no actúa. Así queda probado por qué el orden importa.
   - Con `p_actor`, el evento de `audit_d5_clients_contact` tiene `actor_type = 'user'` y ese id, no
     `'system'`.
   - `client_email_change_service` solo la ejecuta service_role (`has_function_privilege`). Si el `update`
     falla (por ejemplo, un correo inválido), no queda ninguna fila nueva en `client_email_checks`.
   - Después de comprobar, `client_users.email` y `auth.users.email` coinciden con la ficha.
   - Si crear la fila de comprobación falla, el correo de la ficha no cambia.
   - Cambiar el dueño de una tarjeta con ficha cambia `advisor_id`, y el portal muestra el mismo asesor que
     el CRM.
6. **F-7, nombre.** Corregir el nombre actualiza las copias abiertas y no las selladas. Los lectores en vivo
   respetan el ocultamiento `cn`.
7. **F-6, Shipping Mark.** Cambiar el código de una ficha con filas en `exc0674_*` las reescribe (`.test.sql`).
   Después de una fusión, el portal del sobreviviente ve las filas guardadas con el código de la fusionada:
   lo prueba un `.test.sql` de RLS.
8. **F-5, duplicados.** El alta del Studio con un correo existente responde según P-5. El índice único
   existe solo si Q1 dio cero.
9. **F-9, una predeterminada.**
   - **F-9a**, con Vitest y `.test.sql`:
     - Mi perfil (`addAddressAction` con sus dos ramas, `updateAddressAction` y `setDefaultAddressAction`) y
       la tarjeta del Studio cambian la predeterminada en **una sola llamada** a
       `client_delivery_address_save`;
     - una prueba de contrato falla si `clearDefaultForClient`, `setDefaultDeliveryAddress`, o
       `insertClientDeliveryAddress` y `updateClientDeliveryAddress` con `isDefault`, vuelven a llamarse
       fuera de la RPC en `app/` o `lib/`;
     - funcionan por los dos caminos: agregar una predeterminada, elegir otra existente y editar la
       predeterminada sin cambiar la marca;
     - desmarcar la única predeterminada devuelve el error de campo y no cambia nada;
     - un id de otro cliente o inexistente termina con error y no deja cambios;
     - `anon` no puede ejecutar la RPC.
   - **F-9b**, con `.test.sql` en PGlite y los triggers ya creados:
     - el flujo real de la F-9a (la RPC) pasa: cambiar la predeterminada, agregar una predeterminada nueva
       y agregar una no predeterminada;
     - una transacción que deja un cliente con filas vivas y sin predeterminada falla al confirmar. Por
       ejemplo, dos peticiones separadas que imitan el flujo viejo: la primera ya falla;
     - el borrado lógico de la predeterminada pasa la marca a la fila viva más reciente, sin violar el
       índice;
     - borrar la última fila viva deja al cliente sin predeterminada, y pasa;
     - la primera fila de un cliente queda como predeterminada aunque llegue con `is_default = false`;
     - cambiar una columna que no es `is_default`, `deleted_at` ni `client_id` no dispara el chequeo;
     - `merge_clients` (la versión de la 0694 F-2) pasa con dos clientes que tienen predeterminada cada
       uno, y el chequeo revisa a los dos clientes;
     - con un cliente sembrado sin predeterminada, el preflight aborta la migración, y el mensaje lleva el
       conteo y ningún id ni markbox;
     - borrar la predeterminada deja a la borrada con `is_default = false`, y el trigger no dispara al
       borrar una fila que no era la predeterminada;
     - **estos casos corren con `set role authenticated`** y el claim del cliente o del operador, no como
       superusuario, para que la RLS de la 0198 aplique igual que en producción.

## 11. Archivos (allowlist provisional)

Es exacta para F-0 a F-6 y F-9. **La F-7 y la F-8 requieren un inventario previo:** sus lectores (9 tablas) y sus
reimplementaciones de fecha se listan archivo por archivo en esta spec antes de programarlas. Las
migraciones las numera Dir_DTD.

- **F-0:** esta spec, `docs/specs/README.md` (índice) y `.agents/handoffs/2026-11-20-sdd-0695-datos-duplicados.md`.
- **F-1:** `docs/architecture/fuentes-unicas.md`, `lib/shared/fuentes-unicas-detector.ts` (el detector puro)
  y `lib/__tests__/fuentes-unicas.contract.test.ts`.
- **F-2:**
  - migraciones `NNNN_dia_caracas.sql` y `NNNN_correlativos_anio_caracas.sql`, con su `.test.sql`;
  - `lib/studio/fiscal/queries.ts` y `fiscal/types.ts`;
  - `lib/studio/reports/queries.ts`, `lib/studio/direccion/queries.ts` y `lib/studio/dashboard/dashboard-kpi-queries.ts`;
  - el aviso del plan B (del 29 al 31 de diciembre): `app/studio/(app)/facturacion/page.tsx`, que usa
    `app/studio/_components/ui/Aviso.tsx` sin cambiarlo, con su prueba;
  - pruebas: `lib/studio/fiscal/__tests__/types.test.ts` y `queries.test.ts` (ya existen y se extienden),
    `lib/studio/reports/__tests__/aging-hoy-caracas.test.ts`,
    `lib/studio/direccion/__tests__/hoy-caracas.test.ts` y
    `lib/studio/dashboard/__tests__/kpi-hoy-caracas.test.ts`.
- **F-3:**
  - migración `NNNN_persona_de_la_ficha.sql`, con su `.test.sql`;
  - `lib/studio/academia/queries.ts`, `lib/studio/club/club-member-queries.ts` y `lib/portal/portal-club-queries.ts`;
  - la vista `client_person_review` en la misma migración `NNNN_persona_de_la_ficha.sql`;
  - pruebas de cada uno, en su carpeta `__tests__/`.
- **F-4:**
  - `app/studio/(app)/clientes/actions.ts` (`updateClientAction` y `dejarCuentaSinComprobar`);
  - `app/studio/(app)/clientes/_components/PortalAccessCard.tsx`;
  - `NNNN_client_email_change_service.sql` (la RPC de §4.5), con su `.test.sql`. El trigger
    `clients_email_vuelve_sin_comprobar` (`0559:700-739`) no cambia;
  - `app/studio/(app)/crm/tarjeta-actions.ts` y `lib/studio/crm-tablero-queries.ts`;
  - pruebas de cada uno.
- **F-5:** `app/studio/(app)/clientes/actions.ts`, `lib/studio/kommo-convert.ts`, sus pruebas y, si Q1 da
  cero después de la limpieza, `NNNN_clients_email_unique.sql` con su `.test.sql`.
- **F-6:** `NNNN_rename_markbox_cubre_exc0674.sql` y la redefinición de `merge_clients` (partiendo de la
  0694 F-2), con sus `.test.sql`.
- **F-7:**
  - `NNNN_client_name_refresco.sql`;
  - `lib/studio/client-name.ts` (`nombreCliente`);
  - `app/studio/(app)/tracking/nuevo/actions.ts` y `app/studio/(app)/cn/actions.ts`;
  - los lectores de D-6.
- **F-8:**
  - `NNNN_defaults_dia_caracas.sql` y `NNNN_client_completeness.sql`;
  - `lib/shared/eta.ts`, `app/studio/(app)/naviera/actions.ts` (`refreshTracking`), `lib/portal/seguimiento-estimado.ts` y
    `lib/studio/client-types.ts`;
  - las reimplementaciones de fecha de D-9.
- **F-9a:**
  - `NNNN_client_delivery_address_save.sql`, con su `.test.sql`;
  - `lib/studio/client-address-queries.ts`;
  - `app/portal/(app)/perfil/address-actions.ts` (`addAddressAction`, `updateAddressAction` y `setDefaultAddressAction`) y
    `app/studio/(app)/clientes/actions.ts` (`addClientAddressAction` y `setDefaultClientAddressAction`);
  - sus pruebas.
- **F-9b:** `NNNN_una_predeterminada_por_cliente.sql` (los cuatro triggers y el preflight), con su `.test.sql`.
  El arreglo de las fichas actuales no va en el repo como migración: es una operación de datos con acta.

## 12. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 / AUD-02 | cumplimiento (diseño) | Los cambios de correo y de asesor ya se auditan. El trigger de nombre no audita PII. |
| MP-01 | no aplica | Esta spec no borra nada. La limpieza de duplicados va con su acta. |
| ERR-01 | cumplimiento (diseño) | El aviso de duplicado dice qué coincide y adónde ir. |
| FRM-01 | cumplimiento (diseño) | El alta duplicada responde con un error de campo, sin perder lo escrito. |
| Privacidad CN (SDD-0531) | cumplimiento (diseño) | Los lectores en vivo pasan por `privacidad-cn.ts`. |
| CAL-01 (calendario y tiempo) | **no conformidad** del código actual; la corrige esta spec | El contrato dice «no se corta un `timestamptz` en UTC para presentar fecha local». Lo incumplen el Libro de Ventas (`fiscal/queries.ts:225-226`, `fiscal/types.ts:382`), Aging, Dirección y KPIs (D-9). La F-2 y la F-8 lo corrigen. |
| DAT-01 (selector de fecha) | **no conformidad** parcial del código actual; la corrige esta spec | «Min/max y timezone se aplican en UI y servidor»: las guardas de «fecha no futura» del servidor usan el día UTC (`0483:123`, `0484:124`, `0485:130`). Las corrige la F-8. El componente `<DateField>` es de la 0660 y no se toca. |
| NUM-01 (campos numéricos) | no aplica | Esta spec no cambia campos numéricos ni montos. Los correlativos son códigos, no campos de entrada. |
| Producción (AGENTS) | cumplimiento | Solo conteos agregados, que corrió Dir_DTD; ningún valor en Git. |
