# Guion de entrada por Instagram — qué se responde a un comentario o un DM

> **Para qué sirve:** Instagram es el canal más fuerte (20 mil seguidores) y **el único sin guion**.
> Lo que responde hoy es una automatización de Meta con copy de anuncio, no una conversación.
> Este documento tiene el texto exacto que debe reemplazarla.
>
> **Por qué existe:** ver el diagnóstico medido del 2026-08-10 en
> [`agentes-ia-configuracion.md`](agentes-ia-configuracion.md) — la automatización **no vive en
> Kommo**; se configura en Instagram/Meta.
>
> **El porqué conversacional** está en [`conversacion-crm.md`](conversacion-crm.md) y
> [`agentes-ia-por-etapa.md`](agentes-ia-por-etapa.md). Acá sólo va el texto.

## Qué está mal con lo que se responde hoy

Caso real, lead `#23317615` (09-ago-2026). El cliente comentó **"Información"** en un post de
juguetes de temporada. Recibió dos mensajes publicitarios y **nunca escribió**.

| Lo que hace la automatización | Regla que rompe |
|---|---|
| Pitchea antes de dar algo | *pitchear de entrada reduce la respuesta hasta **57%*** (Gong, 25M emails) |
| 🔥 🎁 💬 con un desconocido | los emoticones **reducen la percepción de competencia** (Glikson et al. 2018) |
| **Cero preguntas** | el contrato es *una respuesta y **UNA** pregunta*; sin pregunta no hay turno siguiente |
| "Escríbenos al 0412-1668021" | lo manda a otra app **y** a copiar un número a mano |
| "¡Hola, emprendedor!" | eso es un segmento, no una persona |
| Ignora que comentó en un post de **juguetes** | el rubro estaba servido y no se usó |

⭐ El último es el más caro: **el cliente ya te dijo qué vende sin que se lo preguntaras.**

## ⭐ Son DOS tiempos, y el primero es el que más gente lee

Un comentario abre **dos conversaciones distintas** sobre el mismo lead, y en Kommo se ven con
número propio (verificado en el lead `#23317615`, 2026-08-10):

| Hilo | Qué es | Quién lo ve |
|---|---|---|
| **A3854** | el comentario público bajo el post | **todo el que pase por el post** |
| **A3858** | el DM privado | sólo esa persona |

**No hay que salirse a Meta para responder el comentario.** En la ficha del lead, el compositor de
abajo escribe al **DM** por defecto; para responder el comentario hay que **hacer clic en el nombre
del autor dentro del bloque del comentario** → el compositor cambia a *"Comentar para @usuario"* y
publica en el hilo de Instagram.

⚠️ **Hoy esto es manual**: ningún agente de IA cubre el canal de Instagram. Con ~2-3 comentarios al
día es llevable a mano, y no gasta créditos.

### Las reglas del comentario público (distintas a las del DM)

1. **Dos líneas, máximo.** En público nadie lee párrafos.
2. **Da un dato real antes de invitar al privado.** La respuesta la leen los demás: es la pieza de
   mayor alcance de todo el sistema. Un "te escribimos al DM" solo, desperdicia esa audiencia.
3. **Nunca pidas datos personales en público** — ni teléfono, ni cédula, ni dirección.
4. **No pegues el número de WhatsApp en el comentario.** El DM es el camino: así la conversación
   queda en el CRM con su lead y su trazabilidad.
5. **La pregunta es opcional acá.** En el DM siempre va UNA; en público el objetivo es abrir el DM.
6. **Un reclamo jamás se discute en público.** Una línea y a privado.

### Las respuestas, por tipo de comentario

**"Información" · "info" · "precios"** — el más común, y el del caso real

> @usuario Te escribimos por privado con los detalles. Te adelanto que la carga va por barco y toma
> entre 60 y 90 días, así que para diciembre el momento de embarcar es ahora.

**Pregunta el precio**

> @usuario El costo va por el volumen que ocupa la carga, no por lo que valga la mercancía. Pásanos
> las medidas de las cajas por privado y te damos el estimado.

**"¿Cómo funciona?"**

> @usuario Lo recogemos donde tu proveedor en China, lo consolidamos con tu Shipping Mark y te lo
> entregamos en la puerta de tu negocio. Te contamos el detalle por privado.

**"¿Traen [producto]?"**

> @usuario Cuéntanos por privado qué producto es exactamente y te confirmamos si lo podemos traer y
> cómo sale.

⚠️ **No afirmes que sí antes de saber qué es.** Hay mercancía restringida, y una respuesta pública
prometiendo algo que después se niega es peor que no contestar.

**"¿Entregan en [ciudad]?"**

> @usuario Coordinamos la entrega dentro de Venezuela. Dinos por privado tu ciudad y qué vas a traer,
> y te damos el estimado con el flete nacional incluido.

**Desconfianza — "¿esto es real?", "¿no es estafa?"**

> @usuario Entendemos la duda. Tenemos oficina propia en China desde 2010 y operamos en Venezuela
> desde 2015. Escríbenos por privado y te mostramos cómo trabajamos.

Los años salen de [`identidad.md`](identidad.md): **2008** experiencia con China · **2010** oficina
propia en China · **2015** fundación en Venezuela. Nunca un total fijo de años.

**Etiqueta a otra persona** — *"@fulano mira esto"*

> @usuario Gracias por pasar el dato. Si a alguno les sirve, escríbannos por privado y les contamos.

Ese comentario es una recomendación espontánea: vale más agradecerla que venderle encima.

**Reclamo público**

> @usuario Lamentamos lo que pasó. Escríbenos por privado con tu Shipping Mark y lo revisamos hoy
> mismo.

Una línea, sin explicar nada, sin justificarse y **sin discutir**. El resto va por privado.

## Las cuatro respuestas del DM (el segundo tiempo)

Todas: **50-125 palabras · cero emojis · tuteo venezolano · UNA sola pregunta**. Vocabulario:
*Puerta a Puerta · Shipping Mark · pagas al llegar*. Nunca *DDP · casillero · prepago ·
financiamiento*.

### A · Comentó o compartió un post de temporada ⭐

> Hola, buenas. Llegaste en el mes correcto: la carga va por barco y el tránsito de China a
> Venezuela toma entre 60 y 90 días, así que lo que se embarca en agosto es lo que alcanza a estar
> aquí para la temporada. Nosotros lo recogemos donde tu proveedor en China y te lo entregamos en la
> puerta de tu negocio.
>
> ¿Los juguetes se los compras a un distribuidor aquí en Venezuela o quieres traerlos directo de China?

Los **60-90 días** salen de [`lib/faqs.ts`](../../lib/faqs.ts) — no se escriben de memoria y no se
prometen más cortos. Cambia "los juguetes" por el rubro del post.

La pregunta es la `/q2` de [`guiones-asesor.md`](guiones-asesor.md): se contesta en tres palabras y
dice **contra quién compites** — el margen del mayorista o el agente que ya tiene.

### B · "Información" / "precios" / un DM en blanco

> Hola, con gusto. Traemos mercancía desde China hasta la puerta de tu negocio en Venezuela: la
> recogemos donde tu proveedor, la consolidamos con tu Shipping Mark y te la entregamos aquí.
>
> Para decirte algo útil y no un número al aire, ¿qué producto estás trayendo o pensando traer?

### C · Pregunta el precio de una vez

> Hola. El costo se calcula por el volumen que ocupa la carga en el contenedor, no por lo que valga
> la mercancía. Con las medidas de las cajas y tu ciudad te saco el estimado el mismo día.
>
> ¿Ya tienes las medidas de las cajas o todavía estás cotizando con el proveedor?

🔴 **El CBM sale de las MEDIDAS, no de la cantidad de cajas.** Nunca escribir *"¿cuántas cajas? con
eso te saco el CBM"* — es factualmente falso y ya se coló una vez.

### D · Manda un reel o un post que el sistema no puede ver

Cuando el cliente comparte contenido, Kommo muestra *"no podemos mostrar este mensaje debido a las
restricciones de Instagram"* y **nadie ve qué mandó**. No se responde con una plantilla: se admite.

> Hola. Me llegó tu mensaje, pero Instagram no me deja ver desde acá lo que compartiste. ¿Me dices
> en dos palabras qué producto es y te confirmo si lo traemos?

## Cómo se logra que siga escribiendo

No es una pregunta mejor: es **no amontonarlas**. Tres turnos, **una por mensaje**, y cada una
profundiza la anterior **sin cambiar de tema**.

| # | Pregunta | Qué saca |
|---|---|---|
| 1 | *"¿Ya traes directo de China o le compras a distribuidores aquí?"* | contra quién competimos |
| 2 | *"¿Cada cuánto repones mercancía?"* | ⭐ separa al mayorista recurrente del comprador de una vez |
| 3 | *"¿Qué es lo que más te cuesta hoy al traer mercancía?"* | el dolor real |

Cuando suelte un problema, **tira del hilo antes de ofrecer nada**. La demoledora de la cadena es
*"¿y te funcionó?"*: lo obliga a admitir que lo anterior no sirvió.

**El objetivo de la conversación no es cotizar: es llegar a medidas y ciudad.** Sin eso no hay
estimado — y por eso hay 372 leads clavados en `Contacto inicial`.

## Si se deriva a WhatsApp, que sea un enlace

Nunca el número en texto plano. El enlace con texto pre-armado, para no perder la atribución:

`https://wa.me/584121668021?text=Hola%2C%20vengo%20de%20Instagram%20y%20quiero%20traer%20mercanc%C3%ADa%20de%20China`

El número canónico vive en `CONTACT.ve.whatsappRaw` de [`lib/design-tokens.ts`](../../lib/design-tokens.ts).
No se copia a mano en ningún otro lado.

## Nunca

- Enlace solo · precio desnudo · respuesta de una palabra.
- Cerrar con *"¿en qué te ayudo?"* — eso no es una pregunta, es la ausencia de una.
- Saludar dos veces. Manuel saluda **una sola vez** por conversación.
- Hablar de **usted**. Toda la voz es tuteo venezolano.
- Pedirle al cliente que elija un servicio del catálogo: **rutear es nuestro trabajo, no suyo.**

## Cuánto pesa esto — medido el 2026-08-10

Contactos nuevos de los últimos 30 días, por origen:

| Origen | Contactos | % |
|---|---|---|
| WhatsApp (traen teléfono) | 154 | 68% |
| **Instagram / Facebook** | **72** | **32%** |
| **Total** | **226** | |

**Un tercio de todo lo que entra** — unas 72 personas al mes, 2 o 3 por día — llega por un canal
que ningún agente atiende. *(Medida por presencia de teléfono en el contacto: los de mensajería
social entran sin número. Los nombres lo confirman: `casr273`, `quail.7761624`, `gladysp_camacho`.)*

## Dónde se cambia cada cosa — son dos sitios distintos

| Qué | Dónde |
|---|---|
| **Responder un comentario o un DM a mano** | **en Kommo**, sobre el lead (ver los dos tiempos, arriba) |
| **La respuesta automática** que hoy dispara el copy publicitario | **Instagram / Meta Business Suite** |

⚠️ **La automatización no vive en Kommo.** Está medido: los Salesbots están apagados, no hay
difusiones creadas y ningún agente de IA tiene el canal de Instagram. Mientras no se cambie en Meta,
seguirá saliendo el anuncio aunque alguien conteste bien después.

Si en algún momento se decide que Manuel atienda Instagram, hay que sumarle el canal en
`/settings/ai-agent/`. Eso **consume créditos**: al 2026-08-10 el saldo quedó en 7.281/12.250 tras
la recarga del founder, con el plan dando ~10 respuestas al día contra ~16 leads diarios.
**Responder los comentarios a mano no gasta nada** — por eso es el primer movimiento.
