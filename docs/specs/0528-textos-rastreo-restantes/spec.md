---
sdd: "0528"
title: "Textos públicos de rastreo que quedan: /entrar, glosario, /servicios y llms.txt"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0514","0519","0521"]
confidencialidad: interno
---

# SDD-0528 — Textos públicos de rastreo que quedan: /entrar, glosario, /servicios y llms.txt

> Continuación de la SDD-0521. Mientras el seguimiento del Portal esté en
> construcción, la puerta de acceso `/entrar`, el glosario, la ficha de
> pre-alerta de `/servicios` y `public/llms.txt` dejan de prometer rastreo.
> Dicen lo que es cierto hoy y conservan sus destinos.

## Contexto

La SDD-0521 corrigió nueve superficies públicas que prometían rastreo y dejó
anotadas las que quedaban fuera de su encargo. El Director se las describió a
Sam como «Textos públicos que quedan», y Sam eligió esa tarea:

> «Que el login (/entrar), el glosario, /servicios («Ves el estado de tu compra
> en todo momento») y llms.txt dejen de prometer rastreo mientras esté en
> construcción. Las FAQ con Kommo y la política de privacidad quedan aparte para
> tu decisión.»

(Texto de la descripción que el Director le presentó a Sam; la elección de Sam
fue esa opción.)

Al asignarla, el Director dejó fuera la ficha de pre-alerta de `/servicios`
(`components/servicios/hub-fichas.tsx`), porque la SDD-0524 podía estar
tocando ese archivo. Cuando la SDD-0524 cerró su PR (#227) sin tocarlo, el
Director la sumó a esta tarea, con la propuesta de la 0519 y la orden de
ampliar su prueba de forma explícita, sin debilitarla.

## Objetivo

1. Con `TRACKING_EN_CONSTRUCCION = true`, `/entrar`, los términos DTDU y POD
   de `/glosario` (ficha y JSON-LD) y la ficha de pre-alerta de `/servicios` no
   prometen que el cliente sigue su carga o su compra. Con `false`, vuelven los
   textos de siempre.
2. `public/llms.txt`, que es estático, enlaza al Portal con un nombre cierto en
   las dos posiciones del interruptor.
3. En `/entrar` sólo cambia el texto: campos, botones, enlaces, destinos y
   títulos son los mismos con el interruptor en cualquier posición.

Se usa el mismo interruptor de la 0514 (`lib/portal/tracking-en-construccion.ts`);
no se crea otro.

## Decisión

| Archivo | Lugar | Apagado (el de siempre) | Encendido |
|---|---|---|---|
| `app/entrar/EntrarForm.tsx` | Panel lateral, primer beneficio | Seguimiento por compra y contenedor | Tus compras y pre-alertas en un solo lugar |
| `app/entrar/EntrarForm.tsx` | Fila «Crear mi cuenta y Shipping Mark», tercer beneficio | Seguimiento hasta tu puerta | Acompañamiento hasta tu puerta |
| `app/entrar/EntrarForm.tsx` | Panel lateral, párrafo | Tu Shipping Mark identifica tu carga de punta a punta. Cotiza, sigue tus envíos y paga, todo en un lugar. | Tu Shipping Mark identifica tu carga de punta a punta. Cotiza y paga, todo en un lugar. |
| `lib/design-tokens.ts` + `app/glosario/page.tsx` | DTDU, primer párrafo (ficha y JSON-LD) | … Te lo damos al confirmar la cotización y lo ves entrando a tu portal del cliente (dtdcargo.com/portal), donde sigues el estado en tiempo real. | … Te lo damos al confirmar la cotización y con él nuestro equipo sigue tu envío. El seguimiento desde tu portal del cliente (dtdcargo.com/portal) está en construcción. |
| `lib/design-tokens.ts` + `app/glosario/page.tsx` | POD, segundo párrafo (ficha y JSON-LD) | En el portal de tracking, el POD aparece como el último evento del envío junto con la fecha y firma escaneada. | Es el último evento del envío: lleva la fecha de la entrega y la firma de quien recibe. |
| `components/servicios/hub-fichas.tsx` | `/servicios`, ficha de pre-alerta, «¿Por qué te conviene?», beneficio 3 | Ves el **estado de tu compra** en todo momento. | Tu compra queda **registrada en tu portal** desde el primer día. |

`public/llms.txt` (estático, igual en las dos posiciones):

| Lugar | Antes | Ahora |
|---|---|---|
| «Enlaces útiles», enlace a `https://dtdcargo.com/portal` | Rastrear envío (dentro del portal del cliente) | Portal del cliente |

### Razones

- **Los dos beneficios de `/entrar` son las propuestas del handoff de la
  0521.** «Tus compras y pre-alertas en un solo lugar» dice lo que el Portal ya
  muestra. «Acompañamiento hasta tu puerta» sigue el patrón de la 0521 en
  `/pre-alertas` («Te acompañamos hasta tu puerta»).
- **El párrafo lateral de `/entrar` salió del barrido.** «Cotiza, sigue tus
  envíos y paga» es la misma promesa en la misma pantalla, y el encargo es que
  el login deje de prometer rastreo. Sólo se quita «sigue tus envíos»; no se
  agrega nada nuevo para no repetir el primer beneficio, que ya nombra compras
  y pre-alertas.
- **`/entrar` es el login.** No se tocan la acción, el formulario, los campos,
  los botones ni los enlaces: el interruptor sólo elige textos. La prueba lo
  fija comparando la estructura del acceso en las dos posiciones.
- **El glosario sigue explicando el concepto.** DTDU sigue siendo el código que
  identifica el envío, y lo que es cierto hoy es que el equipo lo sigue con ese
  código (el Studio numera los envíos `DTDU-…`). En un glosario sí cabe decir
  que el seguimiento del Portal está en construcción: no es una lista de razones
  para elegirnos, como en la 0521. POD conserva su primer párrafo; el segundo
  dice qué registra el comprobante sin decir dónde lo ve el cliente.
- **La variante vive en `lib/design-tokens.ts`, en un campo `enConstruccion`
  del término**, como la tarjeta de `/brochure` de la 0521. Ese archivo sigue sin
  imports. `app/glosario/page.tsx` elige el cuerpo con una sola función y la
  usa en la ficha y en el JSON-LD `DefinedTermSet`, para que la página y su
  versión para buscadores digan lo mismo.
- **El beneficio de la ficha de pre-alerta es la propuesta de la 0519.** Dice
  lo que el Portal ya hace al pre-alertar: registrar la compra. Conserva la
  negrita en el mismo lugar de la frase. Lo elige la misma variable
  `enConstruccion` que la 0519 ya lee al renderizar la ficha.
- **La prueba de la 0519 se amplía, no se afloja.** Su invariante «el resto de
  la ficha no cambia con el interruptor» excluye ahora cuatro lugares por
  nombre (los tres de la 0519 y este beneficio); cualquier otro texto que cambie
  la sigue tumbando, y un mutante lo comprueba. Además mide la forma (tres
  beneficios) y el beneficio en las dos posiciones.
- **`llms.txt` no puede leer el interruptor.** «Portal del cliente» es cierto en
  las dos posiciones y conserva el enlace.
- **Sin cambios visuales.** Mismos elementos, clases, colores e íconos; sólo
  cambia el texto. Tuteo, sin voseo.

**Datos personales:** no aplica. Es texto fijo: no captura, no mueve ni borra
datos personales, y no agrega consultas.

## Barrido

Se buscaron `rastre`, «seguimiento», «sigue», «tiempo real», «en vivo», «cada
paso», «en todo momento», «estado de tu» y `tracking` en `app/entrar/**`, en
`GLOSSARY_TERMS` y en `public/llms.txt`. «Estado de tu compra» y «en todo
momento» se buscaron además en todo el repositorio: fuera de la ficha sólo
aparecen en handoffs, specs y el copy fuente de la infografía de pre-alerta
(fuera de alcance, ver «Riesgos y límites»).

Revisados que **no** se cambian:

- «DTDU — Código de tracking» (título del término) y la categoría «Tracking y
  tiempos» del glosario: nombran un concepto, no prometen que el cliente lo vea.
- «identifica el envío y permite hacer tracking» en AWB: describe la guía aérea
  en general, no el Portal.
- `public/llms.txt:17` «Seguimiento de cada envío mediante un código de cliente
  propio (Shipping Mark "DTD-…")»: está en «Qué hace DTD Cargo» y describe lo
  que hace el equipo, que es cierto en las dos posiciones. Si Sam lo prefiere
  más neutro, la propuesta está en el handoff.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/entrar/EntrarForm.tsx` | Dos beneficios y el párrafo del panel lateral según el interruptor. Nada más. |
| `lib/design-tokens.ts` | Campo opcional `enConstruccion` en `GlossaryTerm` y la variante de DTDU y POD. |
| `app/glosario/page.tsx` | `cuerpoVigente()` elige el cuerpo de cada término para la ficha y el JSON-LD. |
| `public/llms.txt` | El nombre del enlace al Portal. |
| `app/__tests__/sin-promesa-rastreo-restantes.test.tsx` | Nuevo. `/entrar`, `/glosario` y `llms.txt`, encendido y apagado. |
| `components/servicios/hub-fichas.tsx` | El beneficio 3 de la ficha de pre-alerta según el interruptor, y su comentario. |
| `components/servicios/hub-fichas-sin-promesa-bodega.test.tsx` | Prueba de la 0519 ampliada: el beneficio en las dos posiciones, la forma de la lista y la invariante con el cuarto lugar nombrado. |
| `lib/portal/tracking-en-construccion.ts` | Sólo el comentario: los lugares nuevos. El valor no cambia. |
| `scripts/feature-constants.json` | Sólo el `significa` de `TRACKING_EN_CONSTRUCCION`. `value` sigue en `true`. |
| `docs/marketing/README.md` | Una viñeta fechada; la última frase de la viñeta de la 0521 deja de afirmar el estado actual. |
| `docs/specs/0528-textos-rastreo-restantes/spec.md` | Esta spec. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0528-textos-rastreo-restantes.md` | Handoff de la tarea. |

Fuera de alcance: el resto de `components/servicios/hub-fichas.tsx`, el copy
fuente de la infografía (`docs/marketing/servicios-infografias/prealerta-compra.md`),
las FAQ (`lib/faqs.ts`, atadas a la base de Kommo), la política de privacidad, `components/PuertaAPuerta.tsx` (tabla de la SDD-0064),
`public/portal/manifest.json`, el formulario de contacto, `app/portal/**` y
`app/registro/**`. Tampoco datos, migraciones, server actions ni RPC, ni el
recibo semántico de `docs/marketing/README.md` (lo renueva el Director después
del merge).

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, `/entrar` muestra los tres textos
   «Encendido» de la tabla y su texto no contiene «seguimiento» ni otra promesa
   de rastreo (`rastre`, «tiempo real», «sigue(s) tu/tus/el/cada», «portal de
   tracking», «tu tracking», «cada paso», «en todo momento», «en vivo»).
2. Con el interruptor en cualquier posición, `/entrar` tiene los mismos campos
   (correo obligatorio, sin contraseña), formularios, botones, enlaces con sus
   destinos (incluido «Crear mi cuenta» a `/registro`) y títulos.
3. Con `TRACKING_EN_CONSTRUCCION = true`, las fichas DTDU y POD de `/glosario` y
   sus entradas del JSON-LD `DefinedTermSet` dicen los textos «Encendido», y ni
   la página ni el JSON-LD contienen una promesa de rastreo.
4. Los demás términos del glosario, y el título y el nombre de DTDU y POD, son
   iguales con el interruptor en cualquier posición. Sólo DTDU y POD tienen
   variante.
5. Con `TRACKING_EN_CONSTRUCCION = false`, `/entrar` y el glosario vuelven a sus
   textos «Apagado», en la ficha y en el JSON-LD.
6. `public/llms.txt` enlaza a `https://dtdcargo.com/portal` exactamente como
   «- Portal del cliente: https://dtdcargo.com/portal» y no contiene una
   promesa de rastreo.
7. Con `TRACKING_EN_CONSTRUCCION = true`, el beneficio 3 de la ficha de
   pre-alerta de `/servicios` dice «Tu compra queda registrada en tu portal
   desde el primer día.» y la ficha no contiene «en todo momento» ni «estado de
   tu compra». Con `false`, vuelve «Ves el estado de tu compra en todo
   momento.».
8. El resto de la ficha de pre-alerta, fuera de los tres lugares de la 0519 y
   este beneficio, y las demás fichas del hub, son iguales con el interruptor
   en cualquier posición.
9. Las pruebas de `/entrar` (SDD-0276), de la 0521 y de la 0519, los contratos
   del glosario y de JSON-LD y el paso `feature-constants` siguen verdes, con
   `value: true`.

## Evidencia

Detalle en el handoff `.agents/handoffs/0528-textos-rastreo-restantes.md`.

## Riesgos y límites

- Igual que en la 0514 y la 0521: si la bodega empieza a registrar en el
  sistema y nadie apaga el interruptor, estos textos siguen neutros. Al
  apagarlo vuelven todos en el mismo commit, salvo `llms.txt`, que dice lo mismo
  en las dos posiciones.
- El copy fuente de la infografía de pre-alerta
  (`docs/marketing/servicios-infografias/prealerta-compra.md:32`) sigue diciendo
  «Ves el estado de tu compra en todo momento.». No alimenta la web, pero sí a
  Cloud Design y al PDF: queda anotado en el handoff.
- La PR #227 (SDD-0524) toca también el comentario del interruptor y el
  `significa` de `scripts/feature-constants.json`. Quien entre segundo resuelve
  el conflicto conservando las dos frases.
- El texto de DTDU encendido repite la palabra «seguimiento» para decir que
  está en construcción. Es la misma frase que ya ve el cliente en el pie y en el
  Portal.
- Si Sam prefiere otro texto para alguno de estos lugares, se cambia sin tocar
  el resto: cada uno vive en su archivo.
