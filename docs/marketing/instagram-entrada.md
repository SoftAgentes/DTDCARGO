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

## Las cuatro respuestas

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

## Dónde se cambia

⚠️ **No es en Kommo.** Está medido: los Salesbots están apagados, no hay difusiones creadas y ningún
agente de IA tiene el canal de Instagram. La automatización que responde los comentarios se
configura en **Instagram / Meta Business Suite**.

Si en algún momento se decide que Manuel atienda Instagram, hay que sumarle el canal en
`/settings/ai-agent/` — pero eso **consume créditos**, y hoy están agotados (ver el diagnóstico).
