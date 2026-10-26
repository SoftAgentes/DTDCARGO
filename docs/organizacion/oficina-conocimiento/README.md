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

**Fuera de la biblioteca, a propósito:**

- nombres y contactos de prospectos, de personal y de la bodega;
- montos y datos financieros;
- runbooks de servidor y handoffs;
- datos de clientes y secretos.

**Limitación conocida:** en la ola 1 todos los agentes corren con el mismo usuario, así que
`03-norte-interno.md` lo puede leer cualquiera de ellos; el «para quién» es una instrucción, no un
candado.
