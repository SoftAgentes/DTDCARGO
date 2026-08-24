---
sdd: "0282"
title: "El aviso de que la carga llegó a Yiwu deja de perderse en silencio"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0154","0156","0162","0281"]
confidencialidad: interno
---

# DTD-0282 — El aviso de Yiwu deja de perderse en silencio

> El cliente anuncia una compra, sus cajas llegan a la bodega de Yiwu, y no se
> entera. No porque falte el aviso: porque el aviso existe y se descarta solo.

## Contexto

El checklist del 2026-08-24 decía que "el aviso está atado al estado del envío,
no a la recepción de la caja". **Al medir, eso resultó ser sólo la mitad, y la
mitad menos importante.** Lo que hay de verdad, medido sobre `main`:

1. **Sí existe un gancho en la recepción de Yiwu.** `scheduleReceiptInWarehouse`
   (SDD-0162, puente 0154↔0156) programa `status:in_warehouse` cuando el
   operario escanea la caja.

2. 🔴 **Pero descarta el aviso cuando el cliente no tiene un envío abierto**, y
   ese caso no es raro: es el **normal en una primera compra**. El cliente
   anuncia, la caja llega a Yiwu, y el envío recién se crea al consolidar — que
   puede ser semanas después. El código decía, literal:

   ```ts
   if (!shipment) continue;   // ← nadie se entera nunca
   ```

   La causa de fondo es de schema: `client_notification_schedule.shipment_id` es
   `not null references shipments(id)` (migr 0247). Sin envío no hay dónde
   colgar el aviso.

3. 🔴 **Y la recepción registrada desde la OFICINA no avisaba a nadie.**
   `createReceiptAction` (`/studio/cn`) inserta la recepción, sus items y su
   evento `received`, y **nunca llamaba al fan-out**. O sea: toda la mercancía
   que la oficina carga a mano —la huérfana que aparece sin etiqueta, la que se
   registra en lote, la de un cliente que no pre-declaró— llegaba a Yiwu en
   silencio absoluto.

## Alcance

### Entra

1. **El camino de la oficina también avisa.** `createReceiptAction` llama al
   fan-out. Una recepción **huérfana** sigue sin notificar a propósito: todavía
   no se sabe de quién es, y adivinar sería avisarle al cliente equivocado.
2. **El salto deja de ser invisible.** `scheduleReceiptInWarehouse` devuelve
   `{ scheduled, sinDestino }` en vez de un número suelto — un `0` podía
   significar "no había a quién avisar" o "había un cliente esperando y no se le
   avisó", que son opuestos.
3. **La bitácora de la recepción lo asienta.** Los DOS caminos escriben un
   `warehouse_receipt_events` de tipo `note` cuando alguien se queda sin aviso,
   con su Shipping Mark y qué hacer. La oficina lo ve al abrir la recepción y
   decide si le escribe a mano.

### No entra — y es lo que falta de verdad

**Colgar el aviso de la compra en vez del envío.** Es la cura de raíz y pide
**migración**: hacer `client_notification_schedule.shipment_id` nullable, sumar
`prealerta_id`, y rehacer el índice único de deduplicación. Además ripplea por
todo el pipeline (`resolveShipmentEta`, el drain, el historial, la visibilidad
del portal), que hoy asume que todo aviso cuelga de un envío.

No se hace acá por dos razones, y las dos importan: es una spec propia, y **una
migración sobre una tabla viva se escribe pero no se aplica sin que el founder
la nombre** (`docs/runbooks/aplicar-migraciones-prod.md`).

Mientras tanto, el cliente que se queda sin aviso **sí puede ver que su carga
llegó**: SDD-0281 le dio la pantalla `/portal/compras/[code]`, que lee las
recepciones directo. Lo que falta es el empujón, no el dato.

## Diseño

`notaSinAviso` es pura y vive junto al fan-out: la escriben los dos caminos de
recepción, así que el texto tiene un solo dueño. Devuelve `null` cuando no hubo
nadie sin avisar, para que el llamador no ensucie la bitácora con una nota vacía.

En el móvil el fan-out sigue siendo fire-and-forget (no se le hace esperar al
operario). En la oficina va con `await`: la action ya terminó de escribir, el
operador puede esperar unos milisegundos, y a cambio la nota entra en la
bitácora **antes** de que la pantalla se refresque — así la ve.

Validado con mutación: volver al `continue` mudo pone el test en rojo.

## Adjuntos

Ninguno.
