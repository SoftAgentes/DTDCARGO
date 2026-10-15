---
sdd: "0521"
title: "Tracking en construcción: «Te avisaremos apenas esté activo» y textos públicos sin promesa de rastreo"
status: done
author: "Claude"
created: 2026-10-14
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0514","0516","0517","0519"]
confidencialidad: interno
---

# SDD-0521 — Tracking en construcción: «Te avisaremos apenas esté activo» y textos públicos sin promesa de rastreo

> El aviso «Seguimiento en construcción» del Portal agrega «Te avisaremos apenas
> esté activo.». Mientras ese interruptor esté encendido, la web pública deja de
> prometer rastreo: dice lo que pasa hoy y conserva sus destinos. La 404 deja de
> mencionar un buscador de tracking que ya no existe.

## Contexto

La bodega de China todavía registra la mercancía en Excel, así que el
seguimiento del Portal está en construcción (SDD-0514). El rastreo público se
retiró: `/track` hace 301 a `/portal/login` y `/rastreo` y `/tracking` dan 404.

Pedido de Sam, sobre la sección de seguimiento del Portal:

> «me gustaría que al cliente le diga: "Esto está en construcción, pronto le
> avisaremos", para que sepa que todavía está en construcción.»

Después de ver la propuesta del Director:

> «sí, agrega «Te avisaremos apenas esté activo» y corrige los textos públicos»

El Director encontró tres textos públicos que prometían rastreo: el enlace del
pie de página, la tarjeta y los metadatos de `/enlaces`, y la 404. El barrido de
esta tarea encontró seis lugares más (ver «Barrido»).

## Objetivo

1. El aviso del Portal dice, después de «Muy pronto vas a ver aquí cada paso de
   tu carga.», exactamente «Te avisaremos apenas esté activo.». El resto no
   cambia.
2. Con `TRACKING_EN_CONSTRUCCION = true`, ningún texto público promete rastreo
   activo de la carga ni «tiempo real». Los destinos (`/entrar`, `/portal`) se
   conservan. Con `false`, vuelven los textos de siempre.
3. El texto de la 404 sobre el «buscador de tracking en la home» se corrige en
   las dos posiciones del interruptor, porque ese buscador ya no existe.

Se usa el mismo interruptor de la 0514 (`lib/portal/tracking-en-construccion.ts`);
no se crea otro.

## Decisión

### Portal

| Lugar | Antes | Ahora |
|---|---|---|
| Aviso «Seguimiento en construcción» (`PortalTrackingEnConstruccion`) | Estamos activando el registro de tu mercancía en nuestra bodega de China. Muy pronto vas a ver aquí cada paso de tu carga. Tus pre-alertas quedan guardadas y nuestro equipo las recibe. | Estamos activando el registro de tu mercancía en nuestra bodega de China. Muy pronto vas a ver aquí cada paso de tu carga. **Te avisaremos apenas esté activo.** Tus pre-alertas quedan guardadas y nuestro equipo las recibe. |

El aviso sólo existe con el interruptor encendido, así que la frase no tiene
versión «apagada».

### Web pública

| Archivo | Lugar | Apagado (el de siempre) | Encendido |
|---|---|---|---|
| `components/Footer.tsx` | «Enlaces rápidos», enlace a `/entrar` | Rastrea tu envío | Seguimiento en construcción |
| `app/enlaces/page.tsx` | Tarjeta a `/entrar`, título | Rastrear mi embarque | Seguimiento en construcción |
| `app/enlaces/page.tsx` | Tarjeta a `/entrar`, subtítulo | Sigue tu carga en tiempo real | Te avisaremos apenas esté activo |
| `app/enlaces/page.tsx` | `description` | Todos los enlaces de DTD Cargo en un solo lugar: cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. China → Venezuela, con Confianza. | Todos los enlaces de DTD Cargo en un solo lugar: cotiza por WhatsApp, calcula tu envío y entra a tu portal. China → Venezuela, con Confianza. |
| `app/enlaces/page.tsx` | Open Graph y Twitter, `description` | Cotiza por WhatsApp, calcula tu envío, rastrea tu carga y entra a tu portal. | Cotiza por WhatsApp, calcula tu envío y entra a tu portal. |
| `app/not-found.tsx` | Botón a `/entrar` | Rastrear envío | Entrar a mi portal |
| `app/noticias/_components/ActualidadHub.tsx` | «También puedes:», acceso a `/entrar` | Rastrear un envío | Entrar a mi portal |
| `app/verificar/page.tsx` | Botón a `/entrar`, junto a WhatsApp | Rastrear un envío | Entrar a mi portal |
| `lib/design-tokens.ts` + `components/Philosophy.tsx` (`/brochure`) | Tarjeta «TRAZABILIDAD», título | Tracking etapa por etapa | Acompañamiento etapa por etapa |
| (ídem) | Tarjeta «TRAZABILIDAD», texto | Sigue tu carga desde la recepción en China hasta la entrega final en Venezuela. | Nuestro equipo sigue tu carga desde la recepción en China hasta la entrega final en Venezuela. |
| `components/ShippingMark.tsx` (`/shipping-mark`) | Paso 06, título | Consolidamos y rastreas | La consolidamos |
| (ídem) | Paso 06, texto | Se consolida con el resto de tu carga y empieza a verse en tu tracking, etapa por etapa. | Se consolida con el resto de tu carga y nuestro equipo la sigue etapa por etapa. |
| `app/pre-alertas/page.tsx` | Descripción: metadatos, Open Graph, Twitter y JSON-LD `Service` | Pre-alerta tu carga antes de que salga de China: registra tu compra, define la modalidad de envío y sigue cada paso con tu Shipping Mark, desde la bodega en Yiwu hasta tu puerta en Venezuela. | Pre-alerta tu carga antes de que salga de China: registra tu compra, define la modalidad de envío y tu Shipping Mark la identifica desde la bodega en Yiwu hasta tu puerta en Venezuela. |
| `app/pre-alertas/page.tsx` | Entrada del hero, final | … la revisa y la consolida — tú sigues cada paso desde el portal. | … la revisa y la consolida. Te acompañamos hasta tu puerta. |
| `app/pre-alertas/page.tsx` | Bloque «Tu carga, siempre identificada», segundo beneficio | Seguimiento de punta a punta desde el portal | Nuestro equipo la sigue de punta a punta |

### 404 (siempre)

| Lugar | Antes | Ahora, con el interruptor en cualquier posición |
|---|---|---|
| `app/not-found.tsx`, texto | No encontramos la página que buscas. Vuelve al inicio o usa el buscador de tracking en la home. | No encontramos la página que buscas. Vuelve al inicio o entra a tu portal. |

El texto nuevo es cierto con el interruptor en las dos posiciones: el botón de
al lado lleva a `/entrar` en ambas.

### Razones

- **Los destinos no cambian.** Cada enlace lleva a donde llevaba. En `/enlaces`
  la tarjeta conserva `origen=rastreo` en la URL, para que la analítica del
  link-in-bio siga comparable.
- **«Seguimiento en construcción» donde el texto es un nombre de enlace.** Es el
  título del aviso del Portal: quien hace clic entra y lee el mismo mensaje. En
  `/enlaces` el subtítulo repite la frase que pidió Sam.
- **Sin nombres repetidos.** El pie ya tiene «Mi portal» (a `/entrar`) en
  Explora, y `/enlaces` ya tiene «Portal del Cliente» (a `/portal`). Por eso el
  enlace de «Enlaces rápidos» y la tarjeta de `/enlaces` no pasan a llamarse así.
- **«Entrar a mi portal» donde el texto es un botón.** En la 404, Actualidad y
  `/verificar` es un verbo directo (BRAND.md, Tono y voz) y dice lo que hace el
  botón.
- **«Nuestro equipo sigue tu carga» donde el texto es un beneficio.** En
  `/brochure`, `/shipping-mark` y `/pre-alertas` la promesa era que el cliente
  ve su carga. Lo que es cierto hoy es que el equipo la sigue (en Excel y en el
  Studio). Así no se cambia el argumento de la página por un «en construcción»
  dentro de una lista de razones para elegirnos.
- **La descripción de `/pre-alertas` dice lo que hace el Shipping Mark.** «Tu
  Shipping Mark la identifica desde la bodega en Yiwu hasta tu puerta» repite lo
  que la propia página ya dice en el bloque del Shipping Mark.
- **La tarjeta de `/brochure` guarda sus dos textos en `lib/design-tokens.ts`.**
  Ese archivo no importa nada. La variante va en un campo `enConstruccion` de la
  misma tarjeta y la elige `components/Philosophy.tsx`, que sí lee el interruptor.
- **Sin cambios visuales.** Mismos elementos, clases, colores e íconos; sólo
  cambia el texto. Tuteo, sin voseo.

### El interruptor se sigue importando desde `lib/portal`

Las páginas y componentes públicos importan
`@/lib/portal/tracking-en-construccion`, como la 0517 (registro) y la 0519
(`components/servicios/`). El grupo restringido de la frontera ESLint es
`@/lib/studio/**`, `@/lib/db/**`, `@/app/studio/**` y `@supabase/*`; `lib/portal`
no lo está, y el lint de los archivos tocados sale limpio. El módulo no importa
nada, y la prueba de la 0519
(`components/servicios/hub-fichas-sin-promesa-bodega.test.tsx`) falla si algún
día importa algo. Moverlo a `lib/shared/` tocaría los consumidores de la 0514 a
la 0519 sin cambiar el comportamiento.

### Relación con la 0516

El criterio 1 de la 0516 decía que el detalle de una compra sin recepciones no
contiene «Te avisaremos» en ninguna parte. Ese detalle muestra el aviso de la
0514, que ahora trae «Te avisaremos apenas esté activo.» porque Sam lo pidió. La
frase avisa que la herramienta se activó, no que la carga llegó a bodega. Su
prueba (`app/portal/(app)/compras/[code]/page.test.tsx`) admite esa frase una
sola vez y sólo dentro del aviso. Cualquier otra promesa, o la misma frase en
otro lugar o repetida, la sigue haciendo fallar.

**Datos personales:** no aplica. Es texto fijo: no captura, no mueve ni borra
datos personales, y no agrega consultas.

## Barrido

Se buscaron `rastre`, «tiempo real», «sigue tu carga», «sigues», «cada paso»,
«en todo momento», «ves el estado», «estado de tu», «en vivo», «etapa por
etapa», «seguimiento» y `tracking` en `app/` (fuera de `portal`, `studio`, `m`,
`api` y `back`), `components/`, `lib/` (fuera de `studio`, `portal` y `back`),
metadatos, JSON-LD y `public/`. Las clases `tracking-*` de Tailwind se
descartaron.

Además de los tres lugares que nombró el Director, prometían rastreo activo y
se corrigen aquí: Actualidad, `/verificar`, `/brochure`, `/shipping-mark` y
`/pre-alertas` (descripción, entrada y beneficio).

Revisados que **no** se cambian, porque no prometen que el cliente siga su
carga:

- «trackings» y «tracking 01…04» de la ficha de Re-Empaque, y «Guía de rastreo»
  de la de courier en `components/servicios/hub-fichas.tsx`: son números del
  proveedor o del courier express (DHL, UPS, FedEx).
- «Datos del proveedor y número de seguimiento» en `/pre-alertas`: es un dato
  que pide la pre-alerta.
- «Rastrear mi carga» en `components/ContactoForm.tsx`: es un motivo para
  escribirle al equipo por WhatsApp, que hoy es justo el canal correcto.
- «Trazabilidad de cada caja, de origen a destino» en `components/ShippingMark.tsx`:
  describe para qué sirve el Shipping Mark.
- «Busca costos, tiempos, proveedores o rastreo» en Actualidad: es un tema de
  artículos.
- «cookies … de rastreo» en `/cookies` y los comentarios de código.

Lo dudoso o fuera del encargo queda en el handoff como FUERA DE ALCANCE
DETECTADO, sin tocarlo: las FAQ de rastreo (`lib/faqs.ts`, atadas a la base de
conocimiento de Kommo por la regla de coherencia de la SDD-0063/0064), el
glosario (`lib/design-tokens.ts`, términos DTDU y POD), «Tracking del envío» en
la tabla de `components/PuertaAPuerta.tsx` (SDD-0064), la política de
privacidad, los beneficios de `/entrar` (el login quedó fuera del encargo),
`public/llms.txt`, el `manifest.json` del Portal, el panel de ejemplo de
`/pre-alertas` y «Ves el estado de tu compra en todo momento» en la ficha de
pre-alerta de `/servicios` (ya anotado por la 0519).

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `app/portal/_components/PortalTrackingEnConstruccion.tsx` | La frase «Te avisaremos apenas esté activo.» en el aviso. |
| `app/portal/_components/__tests__/PortalTrackingEnConstruccion.test.tsx` | El caso del componente fija el párrafo entero, en orden; cada pantalla comprueba que su aviso trae la frase. |
| `app/portal/(app)/compras/[code]/page.test.tsx` | La frase aprobada, una vez y dentro del aviso, es la única excepción a la búsqueda de promesas de la 0516; el caso de la 0514 comprueba que está. |
| `components/Footer.tsx` | El enlace de «Enlaces rápidos» según el interruptor. |
| `app/enlaces/page.tsx` | La tarjeta a `/entrar` y las tres descripciones según el interruptor. |
| `app/not-found.tsx` | El texto corregido siempre; el botón según el interruptor. |
| `app/noticias/_components/ActualidadHub.tsx` | El acceso a `/entrar` según el interruptor. |
| `app/verificar/page.tsx` | El botón a `/entrar` según el interruptor. |
| `lib/design-tokens.ts` | La variante `enConstruccion` de la tarjeta «TRAZABILIDAD». |
| `components/Philosophy.tsx` | Elige la variante de la tarjeta según el interruptor. |
| `components/ShippingMark.tsx` | El paso 06 según el interruptor. |
| `app/pre-alertas/page.tsx` | La descripción, la entrada del hero y el segundo beneficio del bloque del Shipping Mark según el interruptor. |
| `components/sin-promesa-rastreo.test.tsx` | Nuevo. Pie de página, `/brochure` y `/shipping-mark`, encendido y apagado. |
| `app/__tests__/sin-promesa-rastreo.test.tsx` | Nuevo. `/enlaces` (tarjeta y metadatos), 404, Actualidad, `/verificar` y `/pre-alertas`, encendido y apagado. |
| `lib/portal/tracking-en-construccion.ts` | Sólo el comentario: los lugares que dependen del interruptor (también la ficha de la 0519, que había quedado pendiente). El valor no cambia. |
| `scripts/feature-constants.json` | Sólo el `significa` de `TRACKING_EN_CONSTRUCCION`. `value` sigue en `true`. |
| `docs/marketing/README.md` | Una viñeta fechada sobre los textos públicos de rastreo. |
| `docs/specs/0521-tracking-en-construccion-aviso/spec.md` | Esta spec. |
| `docs/specs/README.md` | Índice regenerado con `node scripts/build-docs-index.mjs`. |
| `.agents/handoffs/0521-tracking-en-construccion-aviso.md` | Handoff de la tarea. |

Fuera de alcance: datos, migraciones, server actions y RPC; el login de
`/entrar`; la lógica del Portal más allá del texto del aviso; el recibo
semántico de `docs/marketing/README.md` (lo renueva el Director después del
merge).

## Aceptación

1. Con `TRACKING_EN_CONSTRUCCION = true`, el párrafo del aviso del Portal es,
   palabra por palabra, el de la tabla del Portal, y el aviso de la portada, de
   Envíos (lista y «Seguimiento total»), del detalle de un envío y del detalle
   de una compra trae «Te avisaremos apenas esté activo.».
2. Con `TRACKING_EN_CONSTRUCCION = true`, cada lugar de la tabla de la web
   pública muestra su texto «Encendido» y no el «Apagado», y el texto de cada
   superficie no contiene una promesa de rastreo (`rastre`, «tiempo real»,
   «sigue tu carga» dicho al cliente, «sigue(s) cada paso», «tu tracking»,
   «tracking etapa»).
3. Con `TRACKING_EN_CONSTRUCCION = false`, vuelven los textos «Apagado» y no
   aparece ningún texto «Encendido».
4. La 404 muestra el texto nuevo con el interruptor en las dos posiciones.
5. Los destinos no cambian: el pie, `/enlaces`, la 404, Actualidad y
   `/verificar` siguen llevando a `/entrar`, y «Portal del Cliente» de
   `/enlaces` sigue en `/portal`. Ni el pie ni la lista de `/enlaces` repiten
   un nombre de enlace.
6. En `/brochure` y `/shipping-mark` sólo cambia la tarjeta o el paso de la
   tabla; las otras tres tarjetas y los otros siete pasos son iguales con el
   interruptor en cualquier posición.
7. Las pruebas de la 0514, la 0516, la 0517 y la 0519 siguen verdes, y el paso
   `feature-constants` sigue verde con `value: true`.

## Evidencia

Detalle en el handoff `.agents/handoffs/0521-tracking-en-construccion-aviso.md`.

- **Pruebas:** 38 casos en 4 archivos, en verde (criterios 1 a 6). Con las
  pruebas vecinas de la 0514, 0516, 0517 y 0519 y los contratos de JSON-LD y
  sitemap: 121/121 en 16 archivos (criterio 7).
- **Control rojo:** con los 10 fuentes de `origin/main` `530a3158` y las pruebas
  nuevas caen 18 casos: todos los «prendido», la 404 apagada y la presencia de
  la frase en el Portal. Pasan los 20 restantes.
- **Mutantes:** 19 aplicados, 19 muertos, cada uno en el caso que le toca, con
  control verde antes y después.
- **Estáticas:** typecheck, ESLint de los archivos tocados, `feature-constants`
  (6 banderas), `docs:check` y `check-numbering`, en verde.
- **`pnpm verify` completo:** NO EJECUTADO (sin turno de corrida pesada); la
  evidencia de la suite completa es el CI de la PR.

## Riesgos y límites

- Igual que en la 0514: si la bodega empieza a registrar en el sistema y nadie
  apaga el interruptor, estos textos siguen neutros. Al apagarlo vuelven todos
  en el mismo commit.
- «Te avisaremos apenas esté activo» es una promesa: cuando el seguimiento se
  active, alguien tiene que avisar a los clientes. No hay un aviso automático
  programado; depende del equipo.
- El subtítulo de `/enlaces` le dice «te avisaremos» también a quien todavía no
  es cliente. Se dejó así porque es la frase que pidió Sam y la tarjeta lleva al
  Portal.
- Los textos estáticos sin interruptor (`public/llms.txt`) y los que dependen de
  otra regla (FAQ y glosario) siguen prometiendo seguimiento en el Portal hasta
  que se decida aparte (ver el handoff).
- Si Sam prefiere otro texto para alguno de los lugares nuevos del barrido, se
  cambia sin tocar el resto: cada uno vive en su archivo.

## Cierre (2026-10-15)

- **Merge:** PR #221, merge `1b19ba5c` a las 04:19:11Z, con `--match-head-commit 7fceaa18`, con OK de Sam («ok, fusiona la #221 cuando esté en verde»). Fue fuera de la ventana del corte: eran las 00:15 en Caracas del jueves 15, y el corte es esa noche.
- **Validación:** el CI «Calidad continua» PASÓ sobre la cabeza fusionada, con la suite completa y el build. El `pnpm verify` local quedó NO EJECUTADO, porque no había turno de corrida pesada.
- **Deploy:** «Deployment has completed» a las 04:20:54Z.
- **Comprobado por el Director en producción** (curl del HTML público, después del deploy):
  - el pie de página dice «Seguimiento en construcción» y ya no «Rastrea tu envío»;
  - `/enlaces` dice «Te avisaremos apenas esté activo» y ya no «Sigue tu carga en tiempo real» ni «rastrea tu carga»;
  - una URL inexistente muestra «entra a tu portal» y el botón «Entrar a mi portal», sin el «buscador de tracking»;
  - `/pre-alertas` dice «Te acompañamos hasta tu puerta» y ya no «tú sigues cada paso desde el portal».
- **Smoke en producción del aviso del Portal: PASÓ.** Sam, literal: «ya probé el Portal, funciona el aviso».
- **Conocimiento:** el recibo semántico de `docs/marketing/README.md` se renovó en main `1b19ba5c`:
  - se quitó su capa y se corrió `graphify update`;
  - se reinyectó con las ubicaciones corridas desde la línea 161, más el nodo de esta SDD;
  - quedó publicado con `knowledge:check` en `ok: true`.
- Fuera de alcance que sigue abierto, ya anotado en el handoff, a la espera de la decisión de Sam: FAQ con su base de Kommo, glosario, `/entrar`, `llms.txt`, `hub-fichas` y la política de privacidad.
- Estado de la tarea: **integrada**.
