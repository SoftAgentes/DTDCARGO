---
sdd: "0311"
title: "«Tu carga llegó a Venezuela» — el aviso que quedó sin disparador"
status: done
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0156", "0282", "0283", "0310"]
confidencialidad: interno
---

# DTD-0311 — El aviso de arribo sin disparador

> El aviso que un cliente más espera no le llegaba a nadie, por las dos vías a
> la vez, y todo estaba en verde.

## Lo que se encontró

El 2026-07-19 se tomó una decisión correcta: el arribo a Venezuela deja de
avisarse por la transición de status del envío —se quita el mail
`shipment_arrived`— y pasa a ser **canónico** por `received_ve`, disparado por
el hecho físico de recibir el contenedor.

Se hizo todo lo que esa decisión pedía:

- se quitó `shipment_arrived` de `transitionShipment` (con su comentario
  explicando por qué),
- la migración **0331** sembró la regla `received_ve` para los tenants,
- el motor SDD-0156 quedó completo: agenda, drain inline, cron cada minuto.

Falta una sola cosa, y es la primera: **`createReceiptVe` no tiene un solo
llamador en todo el repo.**

```
createReceiptVe   →  scheduleReceiptVeReceived  →  scheduleClientNotifications
      ↑
   nadie
```

El recibo de contenedor VE no se puede crear desde ninguna pantalla. `/studio/ve`
opera **envíos**, no contenedores. `/m/ve/bodeguero/recepcion` **lista y escanea**
recibos que alguien más tendría que haber creado. No existe ese alguien.

### Medido, no supuesto

| Qué | Cómo se midió | Resultado |
|---|---|---|
| Llamadores de `createReceiptVe` | grep de TODO el repo | **0** (sólo su definición y una spec) |
| Otros disparadores de `received_ve` | grep de `received_ve` fuera de `docs/` | ninguno |
| `insert` a `warehouse_receipts_ve` | grep en `app/` + `lib/` | sólo dentro de `createReceiptVe` |
| Recibos VE en producción | `select count(*)` | **1**, del 2026-05-28, contenedor `MSCU-9876543` (demo) |
| Regla `received_ve` en producción | `client_notification_rules` | **1**, activa, default, esperando |

⚠️ **La agenda vacía en producción NO es la prueba.** `client_notification_schedule`
tiene 0 filas, pero el sistema todavía no está en uso operativo — 0 filas es lo
esperado en cualquier caso. Lo que prueba el hueco es el grep: el disparador no
tiene por dónde ser llamado.

## Por qué nada se puso rojo

Porque el código estaba escrito, testeado y desplegado. `scheduleReceiptVeReceived`
tiene sus tests y pasan. La migración está aplicada. El evento existe en el
catálogo, con su copy y su regla.

**Un evento con regla sembrada y sin disparador alcanzable se ve exactamente
igual que uno que funciona.**

## Lo que se hizo

### 1 · El arribo vuelve a avisar, por lo que sí está vivo

`changeConsolidationStatus` (módulo Naviera) ya dispara `consolidated` al pasar
el contenedor a `cerrado`. Ahora también dispara **`received_ve` al pasar a
`arribado`** — el mismo hecho físico, expresado con lo que el producto tiene
montado hoy.

- **Mismo `trigger_event`** → usa la regla ya sembrada por la 0331. Sin migración
  nueva, sin escritura a producción.
- **Idempotente por índice único parcial** → el día que `createReceiptVe` tenga
  pantalla, los dos caminos conviven sin duplicar el correo.

### 1b · 🔴 …y el botón que faltaba, encontrado cometiendo el mismo error

Con el cableado puesto, el contrato daba verde y **el aviso seguía sin poder
salir**: la UI de Naviera ofrecía «Cerrar contenedor» y «Marcar zarpado», y ahí
se cortaba. `arribado` era un estado que el producto sabía nombrar y **nadie
podía poner**.

Es el mismo bug de esta spec, un piso más arriba, cometido mientras la escribía.
La lección va por tercera vez: **que el disparador esté en `app/` no prueba que
se pueda apretar.** Hay que llegar hasta el componente.

Se agregó el escalón `zarpado → arribado` con el mismo `ActionButton` que los
otros dos, y un `title` que avisa que ese botón **le escribe a todos los
clientes del contenedor** — quien lo aprieta tiene que saberlo antes, no después.

El toast dice **cuántos avisos se programaron de verdad**: la acción devuelve el
conteo del fan-out en vez de que la pantalla muestre la cantidad de items del
contenedor. No es lo mismo —dos items pueden ser del mismo cliente, y un envío
sin regla activa no genera aviso— y un número plausible pero inventado es peor
que ninguno. Si salen **cero**, el toast lo dice con todas las letras.

### 2 · El fan-out de VE deja de tragarse a quien se queda sin aviso

`scheduleReceiptVeReceived` devolvía un número y hacía `continue` en silencio
cuando no encontraba envío abierto para un Shipping Mark. Ahora devuelve
`FanoutResultado` con `sinDestino`, igual que la recepción en China desde
SDD-0282.

Era la misma asimetría de siempre: el hueco se cerró en Yiwu y quedó abierto en
Venezuela, que es el lado que más importa — «llegó a Yiwu» se puede esperar,
«llegó a Venezuela» es la llamada del día siguiente.

### 3 · `createReceiptVe` deja de disparar al aire

Era `void … .catch()`: el resultado se tiraba —incluidos los clientes sin
avisar— y en serverless la función podía cortarse antes de que el fan-out
terminara. Ahora se `await`ea y devuelve `sinAviso`, listo para el día que se le
construya la puerta.

### 4 · La copia deja de mentir sobre dónde está la carga

El cuerpo decía *«Recibimos tu mercancía en nuestra bodega en Venezuela»*.
Disparado al arribar el contenedor **al país**, eso es falso: faltan el puerto y
el traslado. Un cliente al que se le dice que su mercancía está en bodega llama
ese mismo día a pedir la entrega.

El texto nuevo —*«Tu mercancía ya está en Venezuela. Te avisamos apenas
coordinemos la entrega.»*— es verdadero en los **dos** momentos. El día que
convenga separarlos, se parten en dos eventos; no se vuelve a estirar el mismo.

> **Decisión del founder pendiente:** la regla en producción usa el copy default
> (sin `custom_title`/`custom_body`). Si prefieres otro texto, se edita en
> Studio › Mailing sin tocar código.

### 5 · El contrato que habría gritado

`lib/studio/notifications/__tests__/disparador-vivo.test.ts`: toda función
exportada de `lib/` que programe un aviso tiene que nombrarse en algún archivo
de `app/`. `createReceiptVe` queda en una allowlist **con motivo escrito**, y hay
un contrato que exige que esa allowlist siga describiendo algo real.

## Verificación

1. **Mutación · el guard del fan-out**: quitando `sinDestino.push(markbox)`, dos
   tests se ponen rojos con *«expected [] to deeply equal [ 'DTD-404' ]»*.
2. **Mutación · el cableado del arribo**: quitando `arribado: "received_ve"`, el
   contrato grita *«ningún archivo de app/ programa received_ve»*.
3. **Mutación · la allowlist**: vaciándola, sale
   *«createReceiptVe (lib\studio\warehouse-receipt-ve-queries.ts)»*.
4. **Mutación · el botón**: cambiando el `"arribado"` del componente por
   `"zarpado"`, salta *«ningún componente pone el contenedor en arribado»*.
5. Gate completo `node scripts/verify.mjs` — **15 de 15 pasos**, 5.812 tests,
   149 e2e, build OK.

### 🔴 Dos contratos nacieron decorados, y así se detectó

Las dos primeras versiones de `disparador-vivo.test.ts` pasaban en verde **con
la mutación puesta**:

- `expect(textoApp).toContain("received_ve")` matcheaba el **comentario** que yo
  mismo escribí en `naviera/actions.ts` para explicar el cableado.
- el filtro de huérfanos encontraba `createReceiptVe` en `app/`… en ese mismo
  comentario, que lo nombra tres veces.

Un contrato que se cumple con su propia documentación no verifica nada. La
solución fue medir sobre el código **sin comentarios** y exigir las dos señales
juntas —el nombre del evento y una llamada real a un dispatcher, en el mismo
archivo—. Sin la validación por mutación, los dos habrían entrado al repo
verdes y falsos.

## Lo que esta spec NO puede afirmar

- **Que el aviso llegue a un buzón.** No se ejecutó el flujo con datos reales:
  el sistema todavía no está en uso operativo y crear una consolidación de
  prueba en producción escribiría datos de negocio. Lo que está probado es que
  el evento se programa; el drain y el envío ya tenían sus contratos.
- **Que `→ arribado` sea el momento definitivo.** Es el que existe hoy. Si la
  recepción física de contenedor llega a tener pantalla, ese es el disparador
  que la decisión del 2026-07-19 nombró, y este queda como el aviso temprano.
- **Que no haya más eventos así.** El contrato nuevo cubre los disparadores que
  viven en `lib/`. Un archivo de `app/` que nadie monte seguiría siendo
  invisible.

## Pendiente para el founder

1. **La pantalla de recepción de contenedor VE** — decidir si se construye. Es
   la puerta que falta y el disparador que la decisión original nombró.
2. **El copy del aviso** — el default nuevo, o uno propio desde Studio › Mailing.
