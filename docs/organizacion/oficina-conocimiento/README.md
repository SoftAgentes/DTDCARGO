# Biblioteca de la oficina de agentes

Conocimiento de DTD Cargo para los agentes Hermes de Paperclip (SDD-0564, diseño en
[`../hermes-oficina.md`](../hermes-oficina.md)). En el VPS se publica como copia de **solo lectura**
en `/srv/oficina/conocimiento/`. La fuente es este directorio y cambia solo por PR.

| Archivo | Para quién | Qué trae |
|---|---|---|
| [`00-dtd-cargo.md`](00-dtd-cargo.md) | Todos | La empresa completa: identidad, cliente, servicios, proceso, precio y pago, postventa, contacto, glosario y contradicciones pendientes |
| [`01-voz-y-atencion.md`](01-voz-y-atencion.md) | Contenido, CEO | Cómo hablamos, palabras sí/no, lo que nunca va en un texto para clientes |
| [`02-reglas-de-la-oficina.md`](02-reglas-de-la-oficina.md) | Todos (obligatorio) | IA-01, qué se hace solo, con aprobación y nunca; cómo se trabaja en Paperclip |
| [`03-norte-interno.md`](03-norte-interno.md) | CEO, gabinete | Meta, motores, líneas de negocio, mercado, 6 sistemas, primeras metas |
| [`04-marketing.md`](04-marketing.md) | Marketing, Revisor, CEO | Para qué existe marketing, la oferta con nombre, canales y su papel, el embudo, reglas de copy y lo que marketing no hace |
| [`05-seo-geo-aeo.md`](05-seo-geo-aeo.md) | Experto en SEO, GEO y AEO, Director de contenido, Redactor, Revisor | Qué es cada sigla, reglas que no se rompen, checklist y las 20 preguntas del CRM |
| [`06-noticias.md`](06-noticias.md) | Redactor de noticias, Experto en SEO, Director de contenido, Revisor | Test de Noticia, líneas rojas, categorías, formato, marcadores `[VERIFICAR]`, puntaje y el camino de una noticia |
| [`07-quien-hace-que.md`](07-quien-hace-que.md) | CEO (obligatorio), y quien proponga una automatización | Catálogo de los 14 agentes: qué hace, qué nunca hace, modelo y a quién reporta; tabla para asignar |

Los archivos 04 a 07 los agregó la [SDD-0605](../../specs/0605-oficina-reestructura/spec.md)
el 2026-11-05. Están en Git; **publicarlos en el VPS es un paso aparte.** El archivo 07
describe el diseño aprobado, no el estado vivo de la oficina.

**Fuera de la biblioteca, a propósito:**

- nombres y contactos de prospectos, de personal y de la bodega;
- montos y datos financieros;
- runbooks de servidor y handoffs;
- datos de clientes y secretos;
- direcciones IP, llaves e identificadores de cuentas de analítica o de anuncios;
- nombres de competidores y cifras de seguidores o de tráfico.

**Limitación conocida:** en la ola 1 todos los agentes corren con el mismo usuario, así que
`03-norte-interno.md` lo puede leer cualquiera de ellos; el «para quién» es una instrucción, no un
candado.
