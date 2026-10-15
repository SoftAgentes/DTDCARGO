---
sdd: "0516"
title: "Portal: el detalle de compra no promete avisos mientras el seguimiento está en construcción"
status: done
author: "Claude"
created: 2026-10-14
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0514"]
confidencialidad: interno
---

# SDD-0516 — Portal: el detalle de compra no promete avisos mientras el seguimiento está en construcción

> Mientras el aviso «Seguimiento en construcción» de la 0514 esté encendido, el
> detalle de una compra y la tarjeta de notificaciones de la portada dejan de
> prometer un aviso de llegada a bodega que hoy no va a salir.

## Contexto

La bodega de China todavía registra la mercancía en Excel. El aviso al cliente
«recibido en bodega» sólo se programa cuando la recepción se registra en el
sistema (`scheduleReceiptInWarehouse`, que llaman `app/m/cn/recibir/actions.ts` y
`app/studio/(app)/cn/actions.ts`), así que hoy no sale.

Aun así, el detalle de una compra sin recepciones dice «Todavía no llegó a nuestra
bodega · Anunciaste 4 cajas. Te avisamos apenas el proveedor entregue en Yiwu.» y,
en la tarjeta de recepción, «Cuando el proveedor entregue, verás acá cada recepción
con su fecha, sus cajas y las medidas reales.». La tarjeta de notificaciones de la
portada promete que el navegador avisa «cuando tu mercancía llega a bodega». Lo
detectó el handoff de la 0514 (FUERA DE ALCANCE).

Decisión de Sam (2026-10-14, AskUserQuestion), opción elegida: «Sí, en una tarea
aparte (Recomendado)». Lo que se le explicó: «Mientras el aviso esté encendido, esa
frase se oculta o se suaviza para no prometer un aviso que no va a llegar. Va como
tarea corta después de la #211.»

## Objetivo

Con `TRACKING_EN_CONSTRUCCION = true`, ninguna de esas frases promete un aviso ni
una recepción automática: se reemplazan por texto neutro y cierto. Con `false`,
vuelve el texto de hoy, palabra por palabra. Se usa el mismo interruptor de la 0514
(`lib/portal/tracking-en-construccion.ts`); no se crea otro.

## Decisión

Texto con el interruptor encendido (compra con 4 cajas anunciadas y sin
recepciones):

| Lugar | Hoy (y con el interruptor apagado) | Con el interruptor encendido |
|---|---|---|
| Estado de llegada, título | Todavía no llegó a nuestra bodega | La llegada a bodega todavía no aparece aquí |
| Estado de llegada, detalle | Anunciaste 4 cajas. Te avisamos apenas el proveedor entregue en Yiwu. | Anunciaste 4 cajas. Mientras activamos el seguimiento, nuestro equipo en China lleva el control de cada recepción. Para saber si ya llegó, escríbenos en Soporte. |
| Tarjeta «Recepción en bodega (China)», sin recepciones | Todavía no registramos la llegada de esta compra a nuestra bodega en Yiwu. Cuando el proveedor entregue, verás acá cada recepción con su fecha, sus cajas y las medidas reales. | Las recepciones de esta compra todavía no aparecen aquí mientras activamos el seguimiento. |
| Portada, tarjeta de notificaciones, descripción | Activa las notificaciones y tu navegador te avisa cuando tu mercancía llega a bodega, cuando zarpa y cuando está por entregarse — aunque no tengas el portal abierto. | Activa las notificaciones y tu navegador te avisa cuando tu carga zarpa y cuando está por entregarse — aunque no tengas el portal abierto. |

Razones:

- **El título también cambia.** «Todavía no llegó a nuestra bodega» es el estado
  automático de bodega que hoy no se puede afirmar: con el registro en Excel, la
  mercancía puede estar en Yiwu sin recepción en el sistema. El título nuevo dice
  sólo lo que se sabe y repite el «aquí» del aviso de la 0514 («Muy pronto vas a
  ver aquí cada paso de tu carga»).
- **No se usa «Nuestro equipo en China confirma la recepción de tu mercancía».**
  Era el ejemplo del encargo, pero en presente se puede leer como «tu mercancía ya
  se recibió». «Lleva el control de cada recepción» dice lo mismo sin afirmar una
  llegada, y «Para saber si ya llegó, escríbenos en Soporte» da la acción que hoy
  sí responde.
- **«Soporte» va como texto, sin enlace.** El aviso de la 0514, justo encima, ya
  trae el enlace «¿Dudas? Escríbenos en Soporte».
- **Sólo cambia la compra sin recepciones.** Los estados «parcial», «completo» y
  «excedente» sólo existen con recepciones registradas en el sistema, que son
  reales: se muestran como siempre.
- **En la portada se conservan zarpe y entrega.** Esos avisos los disparan
  operaciones del Studio (`transitionShipment` en
  `app/studio/(app)/tracking/[id]/actions.ts`, `scheduleSailingEvent` y
  `scheduleConsolidationEvent`), no la bodega de China. El título «Entérate apenas
  se mueva tu carga» y el texto activo «Te avisamos apenas tu carga se mueva.» no
  nombran la bodega y no cambian.
- **Tono y estilo.** Sin cambios visuales: mismos bloques, clases, colores y
  tamaños. El estado de llegada sigue en tono información (punto gris), como hoy.

**Datos personales:** no aplica. Es texto fijo: no captura, no mueve ni borra
datos personales, y no agrega consultas.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/portal/(app)/compras/[code]/page.tsx` | Lee `TRACKING_EN_CONSTRUCCION`; título y detalle de «sin llegar» y texto de la tarjeta de recepción sin recepciones, según el interruptor. |
| `app/portal/(app)/compras/[code]/page.test.tsx` | El caso «prendido» de la 0514 busca el título nuevo; casos nuevos de la 0516 (prendido, posición, apagado) y la recepción real sin frase neutra. |
| `app/portal/(app)/page.tsx` | Tarjeta de notificaciones de la portada: descripción sin «llega a bodega» con el interruptor encendido. |
| `app/portal/(app)/page.test.tsx` | Nuevo. Portada con el interruptor encendido y apagado. |
| `lib/portal/tracking-en-construccion.ts` | Sólo el comentario: qué otros textos cambian con el interruptor. El valor no cambia. |
| `app/portal/_components/PortalTrackingEnConstruccion.tsx` | Sólo el comentario: decía que era el único lector del interruptor. |
| `scripts/feature-constants.json` | Sólo el `significa` de `TRACKING_EN_CONSTRUCCION`: nombra la 0516 y los textos que vuelven al apagarlo. Las líneas de la 0514 no tenían voseo («apágalo» es tuteo); el `$doc` del archivo no se toca. |
| `docs/specs/0516-compra-texto-sin-promesa/spec.md` | Esta spec. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0516-compra-texto-sin-promesa.md` | Handoff de la tarea. |

Fuera de alcance: datos, consultas, RLS, migraciones, el aviso de la 0514 y el
resto del copy del Portal. No se tocan `lib/portal/payment-report-queries.ts` ni
`lib/portal/shipment-events-queries.ts` (PR #114); la prueba de la portada sólo
simula la segunda.

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, el detalle de una compra sin recepciones
   no contiene «Te avisamos», «Te notificamos», «Te avisaremos» ni «verás acá cada
   recepción» en ninguna parte, y muestra los tres textos neutros de la tabla.
2. Con `TRACKING_EN_CONSTRUCCION = false`, vuelven los tres textos de hoy, palabra
   por palabra, y no aparece ningún texto neutro.
3. Con una recepción real, la pantalla es la de siempre («Llegaron las 4 cajas»,
   «Recibidas en nuestra bodega de Yiwu el …») con el interruptor encendido.
4. Con el interruptor encendido, la tarjeta de notificaciones de la portada no
   nombra la bodega y conserva zarpe y entrega; apagado, vuelve el texto de hoy.
5. El aviso de la 0514 sigue arriba del estado de llegada y sus pruebas siguen
   verdes.

## Evidencia

Detalle en el handoff `.agents/handoffs/0516-compra-texto-sin-promesa.md`.

- **Pruebas:** 8 casos en dos archivos, en verde (criterios 1 a 5); `vitest
  related` de los archivos tocados, 21/21 en 4 archivos.
- **Control rojo:** con el código de `origin/main` `4c4c6c17` y las pruebas nuevas,
  fallan los 4 casos «prendido» (promesa presente o frase neutra ausente) y pasan
  los 4 «apagado» o de recepción real.
- **Mutantes:** 6 aplicados, 6 muertos, con control verde antes y después.

## Riesgos y límites

- Igual que en la 0514: si la bodega empieza a registrar en el sistema y nadie
  apaga el interruptor, estos textos siguen neutros con datos reales debajo. Al
  apagarlo vuelven solos.
- No se verificó que los avisos de zarpe y entrega salgan hoy para todos los
  clientes: se conservan porque no dependen de la bodega de China (lectura de
  código, no medición).
- Si una compra tuviera parte de sus cajas en el sistema y parte sólo en Excel,
  el estado «parcial» diría «Faltan N cajas por recibir». No se cambia: ese caso
  necesita recepciones registradas y el aviso de la 0514 lo pone en contexto.

## Cierre (2026-10-14)

- **Merge:** PR #213, merge `d28fa515` a las 19:55:06Z, con `--match-head-commit 7400be53`, con OK de Sam («ok, fusiona la #213 cuando esté en verde») y el CI como evidencia.
- **Deploy:** «Deployment has completed» a las 19:56:36Z.
- **Smoke en producción: PASÓ.** Sam, literal: «ya hice el smoke del Portal, funciona todo».
- Fuera de alcance que queda abierto: `app/registro/RegisterForm.tsx:787` también promete un aviso por WhatsApp «cuando llega a bodega». Estado de la tarea: **integrada**.

## Nota posterior (2026-10-15)

- La [SDD-0521](../0521-tracking-en-construccion-aviso/spec.md), PR #221, agrega al aviso «Seguimiento en construcción» la frase «Te avisaremos apenas esté activo», aprobada por Sam con estas palabras: «sí, agrega «Te avisaremos apenas esté activo» y corrige los textos públicos».
- El aviso aparece también en el detalle de una compra. Por eso la prueba de esta spec, `app/portal/(app)/compras/[code]/page.test.tsx`, admite esa frase exacta una sola vez y sólo dentro del aviso. Cualquier otra promesa de aviso en el detalle de compra sigue fallando el criterio 1: un mutante que repite la frase tumba la prueba.
- El criterio 1 de esta spec se lee con esa salvedad.
