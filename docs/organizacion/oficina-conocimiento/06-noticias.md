# Noticias: Test de Noticia, líneas rojas, categorías y formato

> Para el Redactor de noticias, el Experto en SEO, GEO y AEO, el Director de contenido y el
> Revisor. Fuente: el código del motor de noticias del Studio (`lib/news/`: `cerebro.ts`,
> `prompts.ts`, `categories.ts`, `score.ts` y `editorial.ts`), leído el 2026-11-05. Si este
> archivo y el código no coinciden, **manda el código** y hay que avisar.

## Qué es `/noticias`

- Es el centro editorial del sitio. En el menú se llama **Actualidad** y su portada,
  **«Actualidad, guía y noticias»**. No existe un blog aparte.
- Los artículos viven en el Studio, que es quien los guarda y los publica.
- **Publicar una noticia nunca envía una campaña de correo.**

## A quién se le escribe

Al **emprendedor o dueño de pyme que ya tiene capital y ya compra en China**, pero en compras
grandes cada tres meses más o menos. El objetivo es que reparta sus compras por mes. No se le
escribe a la empresa grande, al comprador de una sola vez ni al importador que ya trae
seguido.

## Líneas rojas

Valen para todo lo que genere el motor y para todo lo que redacte un agente:

1. **Público objetivo:** el de arriba, y solo ese.
2. **Lenguaje de calle, cero técnico.** Plata, billete, caja, mercancía, depósito. Nada de
   «flujo de caja» ni «rotación» en lo que ve el cliente.
3. **Nunca se le pide que compre menos.** El mensaje es «no congeles todo de golpe», no
   «compra menos».
4. **Sensibilizar, no acusar.** El lector es exitoso; el costo es invisible, no un fracaso.
5. **Confidencial:** el operador de consolidación **nunca se nombra**. Se dice «el Operador de
   Consolidación» y DTD Cargo es la cara.

A estas cinco se suman las reglas de voz de `01-voz-y-atencion.md`, que también cortan: sin
precios de memoria, sin plazos garantizados, sin nombrar a los inspectores externos, sin
descuentos ni promesas de reembolso.

## El Test de Noticia

Antes de escribir, la idea pasa por cinco preguntas de sí o no:

| # | Pregunta |
|---|---|
| 1 | ¿Alguien lo buscaría en Google? |
| 2 | ¿Una IA lo daría como respuesta? |
| 3 | ¿Sirve igual dentro de seis meses, sin caducar? |
| 4 | ¿Enseña o resuelve algo de verdad? |
| 5 | ¿Te hace ver como el que sabe? |

- **Tres o más «sí»: Flujo A.** Va a `/noticias` y después se reparte a los demás canales.
- **Dos o menos: Flujo B.** Va directo al canal (redes o WhatsApp) y no a `/noticias`.
- **Se responde con honestidad:** no se infla el puntaje para que la idea pase.
- El conteo lo recalcula el Studio; no se confía en el que dé un modelo.

### Los ocho tipos de idea

| Tipo | Qué es | ¿Puede ser noticia? |
|---|---|---|
| Guía o consejo | Enseña a hacer algo. No caduca: es el motor de las noticias | Sí |
| Dato que pega | Una cifra fuerte que incomoda y se comparte | Sí |
| Postura u opinión | Un punto de vista que abre debate honesto | Sí |
| Historia o caso | Un relato real; prueba de que no es teoría | Sí |
| Actualidad | Algo que pasó ahora | **Solo si el ángulo perdura** y afecta decisiones |
| Promo u oferta | Precio, fecha, cupos | **Nunca** |
| Pregunta o conversación | Para enganchar y medir interés | **Nunca** |
| Detrás de cámara | El día a día de la operación | **Nunca** |

Los tres últimos van siempre al Flujo B, aunque el test dé alto.

### Ángulos del gancho

Provocador, autoridad, historia, dato que pega, paso a paso y contrario («lo que todos creen
está mal, y por qué»).

## Las seis categorías

Son categorías de negocio, pensadas para ese lector. Cada titular empieza con el prefijo de
su categoría.

| Categoría | Tipo editorial | Prefijo del titular | De qué trata |
|---|---|---|---|
| Importa sin perder plata | Informativo | `Importa · ` | Comprar y traer mejor sin secar la caja. Es la categoría destacada |
| Cómo llega tu mercancía | Informativo | `Envío · ` | Envío, aduana, tiempos, costos, puerta a puerta |
| Qué se mueve en China | Curiosidad | `China · ` | Productos, ferias y tendencias del mercado chino |
| Historias reales | Curiosidad | `Historias · ` | Casos y detrás de cámara de la operación |
| Venezuela y tu bolsillo | Polémica | `Bolsillo · ` | Dólar, economía y reglas que le pegan al importador |
| Novedades DTD | Especial | `Novedades · ` | Servicios nuevos, equipo y sistema de DTD Cargo |

**Los cuatro tipos editoriales:**

| Tipo | Cómo suena |
|---|---|
| Informativo | Claro, directo, accionable. Periodístico serio, sin adjetivos vacíos |
| Curiosidad | Con gancho, que despierte interés sin trampa |
| Polémica | Provocador, abre debate honesto, sin desinformar |
| Especial | Anuncios oficiales de DTD Cargo. Solo cuando la pieza habla de la empresa misma, y lo decide una persona |

Ningún agente maneja datos de clientes (`02-reglas-de-la-oficina.md`). Por eso una pieza de
«Historias reales» con un cliente real la aporta y la aprueba una persona; el agente no la
arma por su cuenta.

## Formato del artículo

**Largo según el tipo**, en palabras, con un margen de unas cien hacia arriba o hacia abajo:

| Tipo | Largo |
|---|---|
| Informativo | Alrededor de 1.000 |
| Curiosidad | Alrededor de 700 |
| Polémica | Alrededor de 1.100 |
| Especial | Alrededor de 850 |

**Estructura obligatoria:**

1. **Introducción** sin subtítulo: un gancho de dos o tres oraciones que enmarca el problema.
2. **Párrafo de tesis:** el segundo párrafo resume el punto central en dos o tres oraciones.
   Quien lea solo los dos primeros párrafos se queda con la idea.
3. **Secciones** con subtítulo de segundo nivel, de cinco a siete, en el orden del esquema
   elegido.
4. **Transiciones naturales.** Ninguna sección empieza con «En esta sección…».
5. **Conclusión** al final, con su subtítulo.
6. **Preguntas frecuentes**, solo si la pieza resuelve dudas concretas del lector: de dos a
   cuatro, cada una como subtítulo de tercer nivel en forma de pregunta, con una respuesta de
   60 a 120 palabras en prosa, sin listas ni citas.

**Antes de redactar se proponen tres esquemas distintos** para el mismo titular: uno práctico
(«cómo funciona, qué hacer»), uno de contexto («por qué importa») y uno analítico («desafía el
supuesto»). Cada uno con su tesis en una oración y su tipo de cierre: conclusión, llamada a la
acción o pregunta abierta.

**Titulares:** cinco opciones, cada una con el prefijo exacto de su categoría, y después del
prefijo entre 35 y 50 caracteres. Sin comillas, sin numeración y sin emojis.

**Palabra clave:** una principal y hasta tres secundarias. La principal va en la
introducción, en al menos un subtítulo y dos o tres veces en el cuerpo, entre el 1 % y el 2 %
del texto. Nunca se repite de más.

**Lengua:**

- Castellano neutro de Latinoamérica por defecto, con «tú». Sin voseo y sin españolismos.
- Los venezolanismos entran solo cuando el pedido dice que el lector es claramente venezolano,
  y de forma natural.
- Sin muletillas de relleno: «en conclusión», «es importante destacar», «no podemos olvidar
  que».
- El contenido **resuelve**, no solo informa.

## Marcadores `[VERIFICAR]`

Todo dato numérico, fecha específica, cita atribuida, estadística o porcentaje que no se pueda
confirmar como hecho público se marca así: `[VERIFICAR: <dato>]`.

- **Es preferible marcar de más que inventar.**
- El conocimiento común no se marca.
- **Un artículo con un marcador sin resolver no se publica.** Lo resuelve una persona o el
  Revisor con su fuente.

## El puntaje

El Studio calcula un puntaje después de redactar. Mira:

- cantidad de palabras y tiempo de lectura;
- cantidad de subtítulos;
- cuántas veces aparece la palabra clave principal y qué porcentaje del texto es;
- qué dudas del lector quedaron cubiertas y cuáles no;
- si hay un párrafo de tesis entre los tres primeros;
- los marcadores `[VERIFICAR]` que queden.

**Listo para publicar** quiere decir, como mínimo: ningún marcador pendiente y al menos 400
palabras.

## Tipo de contenido e imagen

- Cada artículo se declara como **guía**, **noticia**, **análisis** o **caso real**, y con eso
  el sitio elige cómo presentarlo a los buscadores.
- **La imagen de portada sale de las fotos propias** del sitio. Una dirección de imagen
  externa no se acepta: se usa la foto de la categoría.
- Las preguntas del artículo ya no se convierten solas en marcado de preguntas frecuentes.

## Quién hace qué en el camino de una noticia

| Paso | Dónde |
|---|---|
| Traer los datos de búsqueda y armar la lista de temas | Studio |
| Leer la lista y analizarla | Oficina: Experto en SEO, GEO y AEO |
| Investigar y redactar el borrador | Oficina: Redactor de noticias |
| Revisar | Oficina: Revisor |
| Recibir el borrador, calcular el puntaje y bloquear por datos sin verificar | Studio |
| Publicar | Studio |
| Avisar a Sam con el enlace y la opción de retirar | Discord |
| Comprobar la indexación y vigilar el tráfico | Studio |

La oficina tendrá **dos puertas angostas** con el Studio y ninguna llave:

- **Salida:** temas y números agregados, sin datos de clientes.
- **Entrada:** solo crea borradores en revisión. No publica, no lee y no borra.

**Estas puertas todavía no existen.** Mientras tanto el Redactor entrega su borrador en su
carpeta de trabajo y una persona lo lleva al Studio.

## Publicación: lo que vale hoy y lo decidido

- **Hoy:** todo artículo es un **borrador** que aprueba y publica una persona. Es la regla de
  la casa (`02-reglas-de-la-oficina.md`).
- **Decidido por Sam el 2026-11-05:** las noticias de `/noticias` se publicarán solas, como
  excepción a esa regla y solo para noticias. La especificación es la SDD-0611 (aprobada) y su
  código espera integración. **No está vigente** hasta que su migración esté en producción y Sam
  encienda el interruptor. Ningún agente la da por activa.
- **Ya vale para todos:** el Studio no publica un texto con marcas `[VERIFICAR]`, ni siquiera
  vacías, por ninguna vía.
- **Cuando entre en vigor, el Studio publicará solo si se cumple todo esto;** si algo falla,
  el artículo queda en revisión y avisa:
  - pasó por el Revisor;
  - no quedan marcadores `[VERIFICAR]` ni datos sin fuente;
  - no toca las líneas rojas;
  - alcanza el puntaje mínimo;
  - no supera un artículo por día ni dos por semana;
  - el interruptor de publicación automática está encendido;
  - queda registrado con modelo, agente y versión, y se puede retirar con un clic.
- **Otras decisiones ya tomadas:** los temas salen solo de los datos de búsqueda; la firma es
  DTD Cargo como organización, con revisor humano; el ritmo es de dos artículos por semana.
