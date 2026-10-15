---
sdd: "0524"
title: "Avisos de bodega confiables para el cliente"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0042", "0148", "0154", "0156", "0162", "0282", "0283", "0284", "0307", "0511", "0514", "0516", "0517", "0519", "0521"]
confidencialidad: interno
---

# SDD-0524 — Avisos de bodega confiables para el cliente

> Cuando el equipo de China registre una recepción, por cualquiera de los tres caminos, el
> cliente recibe el aviso «llegó a bodega». Si la compra se conoce, el aviso cuelga de la
> compra y lleva a su detalle en el Portal. Si el aviso no sale, la bitácora de la recepción
> dice por qué. Sin migración.

## Pedido de Sam

Literal, transmitido por el Director el 2026-10-15:

> «Ya quiero empezar a que cuando generemos ahorita en China, el usuario de China o cualquiera
> de mi oficina, porque vamos a empezar nosotros generando los embarques de allá, al cliente le
> salga el aviso en su tracking de que ya llegó la mercancía al warehouse o cualquier estatus.»

Canal decidido por Sam: **«Correo y push (Recomendado)»**. Hoy la regla `status:in_warehouse` es
`email`; Sam la cambia en `/studio/admin/notificaciones`. Esta SDD no cambia datos.

## Diagnóstico

Verificado sobre `main` = `a8d99acf`. Las líneas son de ese commit.

### Los tres caminos de registro

| Camino | ¿Vincula a la compra? | ¿Avisa? |
|---|---|---|
| Escaneo móvil `/m/cn/recibir` | Sí, por la caja DTD-B: RPC `receive_prealerta_as_operario` (`app/m/cn/recibir/actions.ts:186`) | Sí, sin esperar respuesta (`:218-249`) |
| Studio de escritorio `/studio/cn` (`app/studio/(app)/cn/actions.ts:131`) | Sólo si hay **una** compra en `anunciada`/`en_camino` (`:255`, `:267`). Con dos o más, la recepción queda sin compra | Sí (`:315`) |
| Recepción manual del móvil `/m/cn/nueva` | **No**: llama al RPC `create_receipt_as_operario` (`app/m/cn/nueva/actions.ts:70`, definido en `0045:17`) y termina (`:109-116`) | **No** |

### El aviso se pierde en silencio

- `scheduleReceiptInWarehouse` probaba primero el **envío abierto** del cliente
  (`lib/studio/notifications/schedule-fanout.ts:341-357`) y sólo después la compra (`:365`).
- Un cliente recurrente tiene un envío abierto: el de una compra anterior, que ya tuvo su
  `status:in_warehouse`. El índice único `client_notif_sched_idem_envio_uniq` (`0389:100-102`)
  rechaza el aviso nuevo con 23505. El motor lo trata como «ya programado»
  (`schedule-client-notifications.ts:185-202`), y el fan-out sigue sin anotarlo (`continue` en
  `schedule-fanout.ts:356`). La bitácora no dice nada.
- Y si el aviso salía, el correo enlazaba a ese envío viejo y no a la compra que llegó.

### Push con dos usuarios del Portal: no se reproduce hoy

`dispatchPush` busca el vínculo con `.maybeSingle()` (`drain-client-notifications.ts:291-298`). Con
dos filas activas, PostgREST devuelve PGRST116 y `data: null`, y el push se daría por «sin
destino». **Pero `client_users` es `unique (tenant_id, client_id)` (`0080:29`)**: un cliente no
puede tener dos vínculos, así que esto no ocurre con el esquema actual. Se corrige igual para no
depender de esa garantía, como hizo la 0453 con sus helpers del Portal.

Mientras se probaba apareció otro defecto, que sí ocurre hoy: se encolaba el push aunque el usuario
no tuviera ninguna suscripción. El outbox lo marcaba enviado por falta de destino y el aviso
quedaba como **enviado** sin que llegara nada.

### Textos que volverían al apagar el interruptor

`TRACKING_EN_CONSTRUCCION` (`lib/portal/tracking-en-construccion.ts`) está en `true`.

- `app/registro/RegisterForm.tsx:793-795`, apagado: «El WhatsApp es por donde **te avisamos** de tu
  carga…». Es **falso**: los avisos automáticos salen por correo o push, nunca por WhatsApp.
- `app/portal/(app)/page.tsx:161-163`, tarjeta de push, apagado: promete el push de bodega, zarpe y
  entrega. Esta SDD lo hace cierto para bodega cuando la regla esté en `both`. Zarpe y reparto
  dependen de sus reglas en producción: **NO VERIFICADO** (no leo producción). No cambia.
- `app/portal/(app)/compras/[code]/page.tsx:178-189` y `:483-491`, apagado: «Te avisamos apenas el
  proveedor entregue» y «verás acá cada recepción». Es cierto para la recepción vinculada a su
  compra (escaneo, escritorio con una compra y ahora `/m/cn/nueva`). No cambia; el caso residual
  está en Riesgos.
- `components/servicios/hub-fichas.tsx:792` y su ficha, apagado: «escanea y te avisa». Es cierto
  para el escaneo. No cambia.

## Diseño

### 1. `/m/cn/nueva` vincula y avisa como el escritorio

Lo nuevo vive en `lib/studio/notifications/aviso-recepcion-cn.ts` (`vincularYAvisarRecepcionCn`).
La acción lo llama con `await` después del RPC, salvo si la recepción es huérfana:

1. **Vínculo operativo.** Si el Shipping Mark tiene **exactamente una** compra viva del tenant en
   `anunciada`/`en_camino`, la recepción queda con `prealerta_id`. Con dos o más no se elige.
2. **Vínculo financiero.** `sales_order_id` con la regla estricta del escritorio: OV atada y
   compra sin facturar.
3. **Aviso** `status:in_warehouse` con `scheduleReceiptInWarehouse`, la misma función del
   escritorio. Cuelga de la compra **sólo si el UPDATE del vínculo escribió la fila**
   (`select("id").maybeSingle()`).
4. **Nota** en `warehouse_receipt_events` si el cliente se quedó sin aviso.

**Sin migración.** No hace falta tocar `create_receipt_as_operario`:

- el RPC ya devuelve `receipt_id` (`0045:37`);
- el vínculo se escribe desde el servidor con el cliente admin y el tenant de la sesión del
  operario como filtro explícito;
- las garantías son las del escritorio, que también escribe el vínculo después de su INSERT, sin
  atomicidad: si el vínculo falla, la recepción queda como antes y el aviso usa el envío o deja la
  nota.

La 0477 queda sin usar.

### 2. La compra primero, y ningún descarte silencioso

**De qué cuelga el aviso.** `scheduleReceiptInWarehouse` invierte el orden: primero la compra, si
el llamador la conoce; después el envío abierto.

**El motivo de cada resultado.** El motor (`scheduleClientNotifications`) devuelve ahora `motivo`:

- `programado`
- `duplicado`
- `sin_regla`
- `regla_apagada`
- `sin_fecha`
- `falta_migracion`
- `sin_markbox`
- `error`

**Qué hace el fan-out con cada motivo.**

| Motivo del motor | Fan-out | ¿En `sinDestino`? |
|---|---|---|
| `programado` | cuenta | no |
| `sin_regla`, `regla_apagada` | decisión del tenant | no |
| `duplicado` | `ya_avisado`, con el código del ancla | **sí** |
| `sin_fecha` | `regla_sin_fecha` | **sí** |
| `falta_migracion` (compra) | cae al envío, como antes de la 0389 | según el envío |
| `error`, `sin_markbox`, lectura de envíos caída, excepción | `fallo` | **sí** |
| sin compra ni envío | `sin_destino` | **sí** |

- **Un duplicado de la compra no se compensa por el envío**: sería un segundo correo por la misma
  llegada.
- `FanoutBodega.detalle` lleva el motivo por Shipping Mark. `notaSinAvisoBodega` escribe una frase
  por motivo, y la usan los tres caminos.
- `notaSinAviso` («no tiene un envío abierto») queda sólo para el arribo a Venezuela, donde sigue
  siendo cierta.

### 3. Push a todos los usuarios activos con suscripción

`dispatchPush` lee la **lista** de vínculos activos del tenant y del cliente que tienen
`auth_user_id`. Se queda con los que tienen suscripción: `user_push_subscriptions`, o el jsonb viejo
de `user_notification_prefs` con el push encendido, igual que `sendPushToUserDevices`.

Encola uno por usuario con `enqueueUserPush`, por la cola durable `outbox_push_events`. La
idempotencia de `enqueue_user_push` es por usuario y tag (`0216:104-106`), así que el tag compartido
no los pisa.

| Caso | Resultado |
|---|---|
| Nadie con suscripción | `no_destination` |
| No se puede leer quién tiene suscripción | se encola a todos y decide el outbox |
| No se pueden leer los vínculos | transitorio |
| Uno encolado | `sent` |
| Ninguno encolado | transitorio |

### 4. Texto del registro

Apagado, el paso Contacto dice:

> «El WhatsApp es por donde hablamos contigo sobre tu carga. Los avisos de cuando llega a bodega en
> China, cuando zarpa y cuando está lista para entrega te llegan por correo y, si activas las
> notificaciones en tu Portal, también en tu teléfono o tu computadora.»

Prendido no cambia. `TRACKING_EN_CONSTRUCCION` **sigue en `true`**. Su comentario y su `significa`
en `scripts/feature-constants.json` dejan dicho que el registro ya no vuelve al texto de WhatsApp.

## Alcance — allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/notifications/schedule-client-notifications.ts` | `MotivoProgramacion`; `motivo` en cada salida |
| `lib/studio/notifications/schedule-fanout.ts` | compra primero; `FanoutBodega.detalle`; duplicado, sin fecha y fallos anotados; fallo por cliente; `notaSinAvisoBodega` |
| `lib/studio/notifications/drain-client-notifications.ts` | push a todos los vínculos activos con suscripción; `usuariosConSuscripcion` |
| `lib/studio/notifications/aviso-recepcion-cn.ts` (nuevo) | vínculo a la compra, aviso y nota para `/m/cn/nueva` |
| `app/m/cn/nueva/actions.ts` | llama a `vincularYAvisarRecepcionCn` |
| `app/m/cn/recibir/actions.ts` | la nota usa `notaSinAvisoBodega` |
| `app/studio/(app)/cn/actions.ts` | **dos líneas**: import y nota con `notaSinAvisoBodega` |
| `app/registro/RegisterForm.tsx` | texto apagado del paso Contacto |
| `lib/portal/tracking-en-construccion.ts` | sólo el comentario; el valor no cambia |
| `scripts/feature-constants.json` | sólo el `significa` de `TRACKING_EN_CONSTRUCCION`; el valor no cambia |
| `lib/studio/__tests__/lectores-admin-double.ts` | `insert` con índices únicos parciales (23505), `rechazarInsert`, `fallarSelect`, `or`, `inserts` |
| `lib/studio/notifications/__tests__/avisos-bodega-confiables.test.ts` (nuevo) | fan-out y motor reales con el doble |
| `lib/studio/notifications/__tests__/push-varios-usuarios.test.ts` (nuevo) | despacho real con el doble |
| `app/m/cn/nueva/actions.test.ts` (nuevo) | acción real: una, dos o ninguna compra, OV, huérfana, vínculo fallido |
| `lib/studio/notifications/__tests__/schedule-client-notifications.test.ts` | aserciones con `motivo` exacto; error genérico y 42703 |
| `lib/studio/notifications/__tests__/schedule-fanout.test.ts` | forma con `detalle`; la precedencia nueva (ver Evidencia) |
| `lib/studio/notifications/__tests__/drain-client-notifications.test.ts` | su doble devuelve la lista de vínculos y la suscripción |
| `lib/studio/__tests__/avisos-sin-eliminados.test.ts` | forma con `detalle`; el control de la precedencia vieja pasa a la nueva |
| `app/m/cn/recibir/actions.test.ts` | caso del aviso con la nota real |
| `app/studio/(app)/cn/__tests__/create-receipt-code.test.ts` | mock con la nota real; caso de la nota |
| `app/registro/__tests__/register-sin-promesa-bodega.test.tsx` | texto apagado nuevo y control de su expresión |
| Esta spec, `docs/specs/README.md`, `.agents/handoffs/0524-avisos-bodega-confiables.md` | documentación |

Sobre `app/studio/(app)/cn/actions.ts`: la SDD-0522 edita `softDeleteReceiptAction` y las
acciones por lote de ese archivo. Esta SDD sólo toca el import (`:21-24`) y la nota de
`createReceiptAction` (`:322`), en otros trozos. Es imprescindible porque, sin ese cambio, el
escritorio escribiría «no tiene un envío abierto» también cuando el aviso se descartó por
duplicado, y eso sería falso.

## Fuera de alcance

Detalle en el handoff:

- WhatsApp.
- Pantalla para vincular a mano una recepción huérfana o sin compra.
- Que «zarpado» en Naviera avance los envíos.
- `prealertas.shipment_id`.
- El historial de avisos de compra.
- La campana del Portal.
- Ocultar nombres de clientes a usuarios cn en Tracking y Naviera.
- El borrado de embarques y recepciones (SDD-0522).
- Mover el vínculo del escritorio a `aviso-recepcion-cn.ts`. Hoy la regla está escrita dos veces
  con el mismo contenido; se une cuando entre la 0522.

## Aceptación

1. **`/m/cn/nueva` vincula y avisa.**
   - Con una sola compra abierta del Shipping Mark, la recepción queda con `prealerta_id` y el
     aviso `status:in_warehouse` cuelga de esa compra, con `portalPath` a su detalle.
   - Con dos o más compras abiertas no vincula, y el aviso usa el envío abierto.
   - Sin compra ni envío, deja la nota en la bitácora.
   - La huérfana no vincula ni avisa.
   - La OV sólo se ata si la compra no está facturada.
2. **Con la compra conocida, el aviso cuelga de la compra aunque el cliente tenga un envío
   abierto ya avisado.** Vale para los tres caminos, porque todos pasan la compra que conocen.
3. **Ningún descarte es silencioso.**
   - El duplicado, sea de compra o de envío, sale en `sinDestino` con el código del ancla y en la
     nota.
   - También salen la regla sin fecha, el error y la lectura caída.
   - La regla apagada no se anota.
4. **Push.** Llega a todos los vínculos activos del cliente con suscripción, y no a los revocados ni
   a los de otro tenant. Sin suscripción, el aviso por push queda `skipped`, no `sent`.
5. **Textos.**
   - Apagado, el registro no promete avisos por WhatsApp y dice correo y push.
   - Prendido, el registro no cambia.
   - El interruptor sigue en `true`.
6. **Sin migración**, sin cambio de policies y sin tocar `migrations-baseline.json`.

## Evidencia

**Rojo contra el código de `main`**, antes de tocar producto:

- Fan-out: **8 rojos y 6 verdes** de 14. Los verdes son tres controles del doble, la primera compra,
  la caída al envío sin la 0389 y la nota de Venezuela.
- Push: **8 rojos y 2 verdes** de 10. Los verdes son el control PGRST116 del doble y el caso de un
  solo usuario.
- `/m/cn/nueva`: **5 rojos y 2 verdes** de 7. Los verdes son la huérfana y el RPC fallido.

Cada rojo falla por lo que describe: `scheduled 0` por el 23505, `sinDestino` vacío, `prealerta_id`
nulo, push sin destinatarios.

**Pruebas existentes que cambian, y por qué.**

- Seis aserciones de forma suman el `motivo` exacto, así que quedan más estrictas.
- Cinco aserciones de forma del fan-out suman `detalle`.
- Dos afirmaban la **precedencia vieja**:
  - «con envío abierto NO usa la compra», en `schedule-fanout.test.ts`;
  - el control «ese mismo envío, vivo, se lleva el aviso en vez de la compra», en
    `avisos-sin-eliminados.test.ts`.

  Ahora afirman la regla nueva sobre el mismo fixture. Lo que la 0511 protegía (que un envío
  eliminado no reciba el aviso) sigue cubierto por el par sin compra y por «sin envío vivo ni
  compra».
- El doble del drain viejo devuelve la lista de vínculos. No cambia lo que afirma.

**Verde con el arreglo:**

- La batería focalizada y el foco ampliado (Portal, `components/servicios`, `lib/studio/notify` y
  `check-feature-constants`): 56 archivos y 526 pruebas.
- `vitest related` sobre los archivos de producto: 34 archivos y 238 pruebas.
- `typecheck`, `eslint`, `docs:check`, `sdd:check` y `check-feature-constants`: limpios.

**Mutantes.** Fueron 55, uno por cada decisión del diff, con reemplazo exacto.

- Un mutante cuenta como muerto sólo con una línea «N failed», y la batería de 10 archivos tiene
  que estar verde antes y después.
- **Mueren 53.**
- El 48 (el UPDATE del vínculo sin `eq tenant_id`) sobrevivió la primera vez. Faltaba la prueba, no
  sobraba el código: la defensa contra una recepción de otro tenant ahora tiene su caso.
- **Dos son equivalentes:**
  - el `.not("auth_user_id", "is", null)` del push, porque el filtro en JS descarta igual los
    nulos;
  - el `!input.is_orphan` de la acción, porque `validateCreateReceiptInput` ya anula el Shipping
    Mark de una huérfana (`lib/studio/operario-types.ts:177-179`).

La lista completa está en el handoff.

## Riesgos y límites

- **Más avisos que antes, a propósito.** A los clientes recurrentes con un envío abierto ahora les
  llega el aviso de cada compra nueva, que antes se descartaba en silencio. No hay envío
  retroactivo: sólo recepciones nuevas.
- **Avisos duplicados.** Los evitan los índices únicos de la 0389, uno por ancla. Hay un caso nuevo:
  una compra avisada por compra y, en otra recepción sin compra, por el envío. Pueden salir dos
  correos para el mismo cliente si la segunda recepción no se vincula. Es el caso de varias compras
  abiertas.
- **Avisos masivos.** No los hay: cada recepción programa a lo sumo un aviso por Shipping Mark, y
  el inline drain y el cron ya existían.
- **La conjetura del escritorio.** Sin vínculo, el escritorio todavía elige la compra del aviso
  entre `anunciada`/`en_camino`/`recibida` (`compraParaElAviso`, `:381-392`). Ahora esa compra le
  gana al envío abierto:
  - Si esa compra ya tuvo su aviso, queda la nota.
  - Si no lo tuvo, el correo lleva a esa compra.

  Antes llevaba al envío abierto, que tampoco era seguro. Se alinea con la regla estricta de
  `/m/cn/nueva` cuando se una el código (fuera de alcance).
- **Recepción con dos o más compras abiertas.** No se vincula, no aparece en el detalle de ninguna
  compra del Portal y el aviso usa el envío abierto o deja la nota. La oficina lo ve en la
  bitácora.
- **Incidencia.** Una recepción del móvil marcada con incidencia también avisa la llegada: la
  mercancía llegó. La incidencia la maneja la oficina.
- **El push depende de la regla.** Mientras `status:in_warehouse` sea `email`, sólo sale el
  correo. La regla la cambia Sam.

## Datos personales

Revisé `.claude/skills/revisar-datos-ve/SKILL.md`. El cambio no captura datos nuevos ni crea
columnas. Lo que mueve, y para qué:

- El correo del cliente y su Shipping Mark, que ya se usaban para este mismo aviso. Ahora salen
  también en los casos que se perdían.
- La lista de vínculos del Portal de un cliente, para el push.

China sigue operando con el Shipping Mark y sin el nombre: `/m/cn/nueva` no devuelve nada nuevo al
dispositivo, y la nota de la bitácora sólo lleva Shipping Mark y códigos de compra o envío.

Resultado: **CORRECTO** en minimización, porque el aviso usa los datos que ya se usaban con la
misma finalidad. **NO VERIFICABLE** el contenido real de las reglas en producción.

## Gobernanza

- **AUD-01/02 (rastro).** Cumplimiento: cada aviso faltante deja una nota en la bitácora de la
  recepción.
- **MP-01/BTN-01.** No aplica: no hay botones ni acciones nuevas en pantalla.
- **ERR-01.** Cumplimiento: los fallos del aviso no rompen la recepción y quedan dichos.
- **CMP-01.** No aplica: no hay componentes.
