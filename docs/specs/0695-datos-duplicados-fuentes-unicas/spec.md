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
> **Medición:** código de `main` en `9b00a1665`. Los conteos de producción los corre Dir_DTD, con la
> autorización de Sam. **Este repo es público, así que los números no se copian aquí**: van en el
> reporte por chat y la spec solo los cita en términos cualitativos.

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
| Regla general de fuente única, vista de completitud, guardia de CI contra lectores del campo viejo, y los demás datos duplicados | **0695** (esta) |

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
- Queda abierto dónde viven a largo plazo: P-9.

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

- **Lo único que sincroniza es la 0559** (`0559:700-739`, más `dejarCuentaSinComprobar` en
  `clientes/actions.ts:452-513`), y solo cubre las cuentas que nacieron del enlace.
- **INFERENCIA, siguiendo el código.** El Studio corrige el correo de un cliente que ya entra al portal.
  Desde ese momento:
  - los avisos salen al correo nuevo;
  - el viejo sigue sirviendo para entrar;
  - con el nuevo, `/entrar` no encuentra el acceso y termina en «sin portal»;
  - volver a invitar manda al correo viejo.
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
- `shipment_rate_snapshots.client_markbox` (`0496:219`). Tiene `client_id`, así que es menos grave.

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

**SQL.** No hay ninguna función `caracas_today()`. La 0576 decidió no crearla (`0576/spec.md:222`), así que
59 líneas en 24 migraciones repiten `(… at time zone 'America/Caracas')::date`, con cuatro relojes distintos:
`now()`, `clock_timestamp()`, `statement_timestamp()` y `transaction_timestamp()`.

| Riesgo | Hallazgo | Dónde |
|---|---|---|
| **Alto** | El **número de factura** toma el año UTC (`extract(year from current_date)`), pero `issued_at` toma el día de Caracas. Entre las 20:00 y las 24:00 del 31 de diciembre sale una factura fechada en un año con número del siguiente. Lo mismo pasa con los asientos, los recibos y las CxP: son 22 correlativos | `0077:70`; `0078:98`, `0079:97`, `0088:185`, `:211` y otros |
| **Alto** | El **Libro de Ventas** y la Posición de IVA filtran por `created_at` con límites UTC, no por `issued_at` en Caracas. Una factura del último día del mes, después de las 20:00, cae en el mes siguiente | `lib/studio/fiscal/queries.ts:225-226`; `fiscal/types.ts:25-28`, `:382` |
| **Alto** | Aging, Dirección y KPIs ponen por defecto un `today` en UTC y se lo pasan a colas que por defecto usan Caracas, así que el UTC **anula** al de Caracas | `lib/studio/reports/queries.ts:740-744`; `direccion/queries.ts:439`; `dashboard/dashboard-kpi-queries.ts:57` |
| **Alto** | Nómina y financiero China, con defaults SQL en UTC y valores por defecto en UTC en el código. El mismo módulo de nómina usa `hoyEnCaracas` en otras partes | `0161:37`, `0164:28`, `:48`, `0171:26`, `0114:87-258`; `nomina/loan-types.ts:222`; `partner-finance/posting.ts:237` |
| Medio | Las tarifas públicas vencen 4 horas antes; las guardas de «fecha no futura» aceptan el día siguiente; la cuenta regresiva al cut-off del portal está en UTC | `0256:153`, `0330:305`, `0458:116`; `0483:123`; `app/portal/(app)/layout.tsx:137` |
| Medio | Cotizaciones: `valid_until = current_date + 30` | `0007:29`; `cotizador/actions.ts:90` |

En total hay 17 defaults de columna con `current_date` en UTC (lista en el informe de fechas del handoff).

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
| `shipment_rate_snapshots` | Es la tarifa congelada (`0496:213-219`) |
| `invoices.fx_rate`, con su fuente y su fecha | Es la tasa del documento (`0495:349-359`) |
| `client_markbox` en las tablas que cubre `rename_client_markbox` | Es el Shipping Mark propagado: la llave del portal |
| `legal_acceptances.client_markbox`, `client_markbox_history` y `clients.legacy_markbox` | Son historial |
| `qr_print_orders.client_name` | Guarda el Shipping Mark, no el nombre (`app/m/cn/qr-actions.ts:71`) |
| `tenant_id` en casi todas las tablas | Es para la RLS, y lo validan triggers |
| `due_date` calculado al emitir | Es la condición del documento |
| CRM y Chatwoot | Están limpios: guardan ids, y el check de `0506:342` lo garantiza |

## 3. Producción: conteos agregados

Hay 25 consultas de solo lectura (Q1 a Q21), en una sesión `read only`. Devuelven solo conteos: ninguna
fila, valor, PII ni monto. La lista está en el handoff y Dir_DTD da el OK antes de correrla. Los resultados
van al reporte por chat, nunca a Git.

| Hallazgo | Consultas |
|---|---|
| D-8: fichas duplicadas | Q1 a Q4 |
| D-1 y D-2: dirección, ciudad y fusión | Q5 a Q8, Q17 |
| D-3: identidad | Q9 a Q11 |
| D-4: correo | Q12 y Q13 |
| D-5: asesor | Q14 |
| D-6: nombre copiado | Q15 |
| D-7: Shipping Mark | Q16 y Q18 |
| D-9: fechas | Q19 a Q21 |

**Estado de los conteos:** PENDIENTE, a la espera del OK de Dir_DTD (§10, aceptación 1).

## 4. Diseño: la regla para que no vuelva a pasar

### 4.1 Una fuente por dato, escrita en un registro

Archivo nuevo: `docs/architecture/fuentes-unicas.md`. Es un documento vivo y tiene una fila por dato.

| Dato | Fuente única | Lector compartido | Copias permitidas | Campos viejos y su plan de retiro |
|---|---|---|---|---|
| Dirección de entrega | `client_delivery_addresses` | `direccionDeEntrega` (0694) | `shipments.delivery_address` (la de ese envío); `invoices.client_fiscal_address` (sellada) | `clients.address` y `address_reference` (0694, fase F-4) |
| Ciudad y estado de entrega | `clients.city` y `clients.state` (0694, decisión 8) | la ficha | — | P-9 |
| Identidad de un cliente de carga | `clients` | `clients` | `persons` solo para personas **sin** ficha | `persons.name`, `email`, `phone` y `national_id` cuando hay ficha (§4.4, P-1) |
| Correo de contacto | `clients.email` | — | `client_users.email` y `auth.users.email` siguen a la ficha (§4.5, P-2) | — |
| Asesor | `clients.advisor_id` cuando hay ficha | — | `crm_tarjetas.asesor_id` solo sin ficha (§4.6, P-3) | — |
| Nombre del cliente en la operación | `clients.name`, leído en vivo | `nombreCliente` por lote | las selladas de §2.1 | las 9 de D-6 (§4.7, P-4) |
| Shipping Mark | `clients.markbox` | — | las columnas de `rename_client_markbox`, vigiladas por la guardia de §4.8 | — |
| «Hoy» de negocio | Caracas | SQL `public.dia_caracas()`; TS `fechaCaracas` | — | los 17 defaults en UTC, los 22 correlativos y las 7 reimplementaciones en TS (§4.9) |
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
- `correo_acceso_coincide`;
- `asesor_coincide_crm`.

Tiene dos usos:

- `clientCompleteness` (`lib/studio/client-types.ts:426`) y el bloque «Perfil del cliente» la leen en lugar
  de calcular cada uno por su lado;
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

### 4.5 Correo (D-4, P-2)

- `clients.email` es el correo de contacto.
- Si el Studio lo cambia y el cliente tiene acceso activo, la acción aplica a todas las cuentas la regla
  de la 0559: el acceso queda «sin comprobar» y se le manda la comprobación al correo nuevo. Así, el correo
  de entrada y el de los avisos vuelven a ser el mismo.
- Mientras no se compruebe, el correo viejo sigue entrando. Así no se le corta el acceso a alguien por un
  error de tipeo de la oficina.
- La tarjeta de acceso de la ficha muestra los dos correos cuando no coinciden: «Entra con: …» y «Avisos
  a: …». Así el equipo lo ve.
- Va en la misma transacción que la RPC de la 0559, redefinida para que no dependa de `client_email_checks`.

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
   por ejemplo `clients.address`, `address_reference` y `persons.email` cuando hay ficha. Falla si aparece un
   lector que no está en la lista de excepciones, y esa lista solo puede achicarse: la prueba guarda el
   máximo.
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

## 5. Dependencias

- **0694** (dirección): se implementa primero. Esta spec no repite sus fases y solo agrega la guardia de
  §4.8 y la vista de §4.2.
- **0696** (cliente final del aliado): el cliente final guarda su dirección en la misma fuente única,
  `client_delivery_addresses`, de su propia ficha. La 0696 define quién la carga y cómo.
- **0576** y **0660** (fechas): esta spec retoma lo que la 0576 dejó fuera, como el helper SQL y el cierre
  global. No toca el componente `<DateField>` de la 0660.
- **0559** (comprobación de correo): §4.5 la extiende a todas las cuentas.

## 6. Fases

| Fase | Qué entra | Migración | Notas |
|---|---|---|---|
| F-0 | Esta spec y los conteos de §3. | No | Aprobación de Sam. |
| **F-1** | El registro `fuentes-unicas.md` y la guardia de CI de §4.8, con sus listas congeladas de hoy. | No | Es lo que evita que el problema vuelva a crecer. Va primero porque no cambia comportamiento. |
| F-2 | Fechas fiscales: `dia_caracas()`, los correlativos, el Libro de Ventas y los `today` en UTC de los reportes (§4.9, puntos 1 a 4). | Sí | **Antes del 31 de diciembre de 2026**, por el cambio de año de las facturas. |
| F-3 | Identidad (§4.4): el trigger de alta, la vinculación por cédula y la vista `persona_vigente`. | Sí | Arregla el Club en el portal. |
| F-4 | Correo (§4.5) y asesor (§4.6). | Sí (la RPC de la 0559) | — |
| F-5 | Duplicados (§4.3): el aviso en el alta del Studio y en Kommo, y después los índices, si los conteos dan cero. | Sí, después de limpiar | La limpieza con la herramienta de fusión es una operación de la oficina, con su propio OK. |
| F-6 | El Shipping Mark (D-7): `rename_client_markbox` cubre `exc0674_*`, y `merge_clients` reescribe el texto o deja el alias de la 0367. Va según Q18. | Sí | — |
| F-7 | Nombre copiado (§4.7). | Sí (trigger) | Según P-4. |
| F-8 | El resto de las fechas (§4.9, puntos 5 a 7) y la vista de completitud (§4.2). | Sí | La vista requiere la F-1 de la 0694. |

Cada fase lleva su PR y su `pnpm verify`. Las migraciones las numera Dir_DTD y las aplica con el runbook de
producción y el OK nominal de Sam. **Ninguna corrige datos de producción** sin un acta de conteo previa y su
propio OK.

## 7. `revisar-datos-ve` aplicado

Esto no es asesoría legal. Estados posibles: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

1. **Inventario.** `ENCONTRADO`: la cédula, el nombre, el correo y el teléfono viven en `clients` y en
   `persons` (D-3), y el correo en tres lugares (D-4). Cada copia es otra superficie donde un dato viejo o
   borrado sigue vivo.
2. **Minimización.** Al leer de la ficha (§4.4, §4.7), se dejan de mantener copias de PII. Es a favor.
3. **Exactitud.** `ENCONTRADO`: el Club muestra el nombre y la cédula de la copia de 0170, y los avisos
   pueden salir a un correo con el que el cliente ya no entra. Estas fases lo corrigen.
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

- **P-1 (identidad).** ¿La ficha manda y `persons` queda solo para quien no tiene ficha? *Recomendado: sí,*
  con un trigger que liga la persona al darse de alta y una vista que lee la ficha (§4.4).
- **P-2 (correo).** Si la oficina cambia el correo de un cliente que ya entra al portal, ¿también cambia el
  correo con el que entra? *Recomendado: sí, después de que el cliente compruebe el nuevo;* mientras
  tanto, sigue entrando con el viejo (§4.5).
- **P-3 (asesor).** Cuando el cliente ya tiene ficha, ¿manda el asesor de la ficha también en el CRM?
  *Recomendado: sí;* la tarjeta conserva su dueño solo para los leads sin ficha (§4.6).
- **P-4 (nombre).** Si se corrige el nombre de un cliente, ¿lo actualizamos en sus embarques, recepciones
  y despachos **abiertos**? *Recomendado: sí,* y nunca en facturas ni en documentos sellados (§4.7).
- **P-5 (alta duplicada en el Studio).** Si la oficina da de alta a alguien con un correo o un teléfono que
  ya existe, ¿se bloquea o solo se avisa? *Recomendado:* bloquear con el correo y avisar con el teléfono
  (§4.3).
- **P-6 (día de China).** En la bodega de Yiwu, ¿la fecha de recepción es el día de China o el de Caracas?
  *Recomendado:* el de China en la recepción, y el de Caracas en la contabilidad.
- **P-7 (prioridad).** ¿Arrancamos por las fechas fiscales (F-2) antes que por la identidad (F-3)?
  *Recomendado: sí,* por el cambio de año del 31 de diciembre.
- **P-8 (duplicados ya existentes).** Con los conteos de Q1 y Q2 en la mano, ¿la oficina revisa y fusiona
  los grupos con la herramienta que ya existe? *Recomendado: sí,* antes de crear el índice único.
- **P-9 (ciudad y estado a largo plazo).** ¿Se quedan en la ficha para siempre o pasan a la dirección de
  entrega cuando el cliente tenga una? *Recomendado:* que se queden en la ficha (decisión 8 de la 0694) y
  sirvan de precarga.

## 10. Aceptación verificable

1. **Conteos.** Q1 a Q21 corridas con el OK de Dir_DTD. Resultados en el chat y, en Git, solo una frase
   cualitativa por hallazgo. Esta spec se actualiza si un conteo cambia una prioridad.
2. **F-1, guardia.** La prueba de §4.8:
   - falla si se agrega en `lib/` un lector nuevo de `clients.address` fuera de la lista;
   - falla con una columna `*_markbox` nueva sin cubrir;
   - falla con un `toISOString().slice(0, 10)` nuevo en `lib/studio/fiscal/`;
   - falla con una columna `client_name` nueva sin comentario.
   Las cuatro fallas se demuestran con un cambio de prueba que después se revierte, y la prueba pasa en
   `main`.
3. **F-2, fechas fiscales.** En una prueba `.test.sql`, con `set local timezone = 'UTC'` y el reloj
   simulado al 31 de diciembre a las 21:00 de Caracas:
   - el correlativo de la factura lleva el año de `issued_at`;
   - el Libro de Ventas de diciembre la incluye, y el de enero no;
   - Aging, Dirección y KPIs usan el día de Caracas: lo prueba una prueba unitaria con el reloj a las 21:00.
4. **F-3, identidad.** Una ficha nueva dada de alta por cualquiera de los cuatro caminos queda con
   `person_id`. Con la cédula de una ficha, Academia no crea otra persona. Un cliente nuevo inscrito en el
   Club lo ve en el portal. La vista muestra el nombre de la ficha y no el de la copia.
5. **F-4, correo y asesor.** Cambiar el correo de una cuenta activa nacida en `/registro` deja el acceso
   «sin comprobar» y manda la comprobación. Después de comprobarlo, `client_users.email` y
   `auth.users.email` coinciden con la ficha. Cambiar el dueño de una tarjeta con ficha cambia
   `advisor_id`, y el portal muestra el mismo asesor que el CRM.
6. **F-7, nombre.** Corregir el nombre actualiza las copias abiertas y no las selladas. Los lectores en vivo
   respetan el ocultamiento `cn`.
7. **F-6, Shipping Mark.** Cambiar el código de una ficha con filas en `exc0674_*` las reescribe. Q18 vuelve
   a dar cero o el portal del sobreviviente ve esas filas: lo prueba una prueba de RLS.
8. **F-5, duplicados.** El alta del Studio con un correo existente responde según P-5. El índice único
   existe solo si Q1 dio cero.

## 11. Archivos (allowlist provisional)

Se confirma en cada fase. Las migraciones las numera Dir_DTD.

- **F-0:** esta spec, `docs/specs/README.md` (índice) y `.agents/handoffs/2026-11-20-sdd-0695-datos-duplicados.md`.
- **F-1:** `docs/architecture/fuentes-unicas.md` y `lib/__tests__/fuentes-unicas.contract.test.ts`.
- **F-2:**
  - migraciones `NNNN_dia_caracas.sql` y `NNNN_correlativos_anio_caracas.sql`, con su `.test.sql`;
  - `lib/studio/fiscal/queries.ts` y `fiscal/types.ts`;
  - `lib/studio/reports/queries.ts`, `lib/studio/direccion/queries.ts` y `lib/studio/dashboard/dashboard-kpi-queries.ts`;
  - y sus pruebas.
- **F-3:**
  - migración `NNNN_persona_de_la_ficha.sql`, con su `.test.sql`;
  - `lib/studio/academia/queries.ts`, `lib/studio/club/club-member-queries.ts` y `lib/portal/portal-club-queries.ts`.
- **F-4:**
  - migración `NNNN_correo_acceso_sigue_ficha.sql`;
  - `app/studio/(app)/clientes/actions.ts` y `PortalAccessCard.tsx`;
  - `app/studio/(app)/crm/tarjeta-actions.ts` y `lib/studio/crm-tablero-queries.ts`.
- **F-5:** `app/studio/(app)/clientes/actions.ts`, `lib/studio/kommo-convert.ts` y, si aplica,
  `NNNN_clients_email_unique.sql`.
- **F-6:** `NNNN_rename_markbox_cubre_exc0674.sql` y, según Q18, la redefinición de `merge_clients`.
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

## 12. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 / AUD-02 | cumplimiento (diseño) | Los cambios de correo y de asesor ya se auditan. El trigger de nombre no audita PII. |
| MP-01 | no aplica | Esta spec no borra nada. La limpieza de duplicados va con su acta. |
| ERR-01 | cumplimiento (diseño) | El aviso de duplicado dice qué coincide y adónde ir. |
| FRM-01 | cumplimiento (diseño) | El alta duplicada responde con un error de campo, sin perder lo escrito. |
| Privacidad CN (SDD-0531) | cumplimiento (diseño) | Los lectores en vivo pasan por `privacidad-cn.ts`. |
| Producción (AGENTS) | cumplimiento | Solo conteos agregados, con el OK de Dir_DTD; ningún valor en Git. |
