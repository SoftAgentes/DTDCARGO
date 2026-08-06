# equipo-crm — el cerebro del equipo de oficina

> **Qué es esta carpeta:** el paquete de contexto que usa la cuenta de Claude del equipo
> (`doortudoorservices@gmail.com`) para responder rápido en el CRM y apoyar marketing.
>
> **Proyecto en Claude:** `DTD Cargo · CRM y Marketing`
>
> **Para dar de alta a una persona** (mensajes listos para mandar + cómo verificar que
> quedó bien + qué hacer cuando alguien se va) →
> [`docs/runbooks/setup-asistente-equipo-crm.md`](../docs/runbooks/setup-asistente-equipo-crm.md)

## Cómo está armado

Son **dos capas**, y la diferencia importa:

| Capa | Qué es | Dónde va |
|---|---|---|
| **Instrucciones** (`00`) | Lo que Claude tiene **siempre** en contexto. Corto a propósito. Son **dos campos distintos** — ver abajo. | Configuración › General **y** Proyecto › Instrucciones |
| **Conocimiento** (`01`–`05` + baterías) | Lo que Claude **consulta cuando hace falta**. Acá va el detalle. | *Archivos* del Proyecto |

**Por qué separados y no un solo documento:** lo que está en Instrucciones ocupa contexto en
cada mensaje; si metes todo ahí, se diluye y Claude deja de seguir las reglas. Y varios
documentos temáticos se recuperan mejor que un mamotreto — además se actualizan por separado
sin volver a subir todo.

### ⚠️ Los dos campos de instrucciones

- **Configuración › General → "Instrucciones para Claude"** — aplica a **todos los chats de la
  cuenta**, incluso fuera del proyecto.
- **Proyecto → "Instrucciones"** — aplica **solo dentro del proyecto**.

Si alguien abre un chat suelto para una pregunta rápida, las del Proyecto **no corren**. Por eso
las prohibiciones de vocabulario van en los dos. Ambos textos están en
[`00-INSTRUCCIONES-PROYECTO.md`](00-INSTRUCCIONES-PROYECTO.md).

## Los archivos

| Archivo | Qué contiene |
|---|---|
| [`00-INSTRUCCIONES-PROYECTO.md`](00-INSTRUCCIONES-PROYECTO.md) | El texto de las Instrucciones. **No se sube como archivo** — se pega en el campo. |
| [`01-servicios-y-cotizacion.md`](01-servicios-y-cotizacion.md) | Los 5 servicios, qué incluye cada uno, las 2 decisiones del cliente, cómo se cotiza, CBM, servicios adicionales, el flujo completo |
| [`02-respuestas-CRM.md`](02-respuestas-CRM.md) | **El documento de batalla.** Las 20 preguntas frecuentes con respuesta redactada + los guiones de WhatsApp + **12 objeciones** |
| [`03-el-ERP-por-dentro.md`](03-el-ERP-por-dentro.md) | Los 57 módulos del Studio por grupo, el portal del cliente, los estados de envío |
| [`04-la-web-publica.md`](04-la-web-publica.md) | Qué enlace mandar en cada situación + los redirects viejos |
| [`05-reglas-y-limites.md`](05-reglas-y-limites.md) | Lo que nunca se dice, a quién escalar, datos personales |
| [`06-marca-para-piezas.md`](06-marca-para-piezas.md) | Tagline, colores en hex, fuentes, las 4 variantes del logo, qué es AI slop. Para presentaciones, video y redes. |
| [`07-como-conversar.md`](07-como-conversar.md) | **Cómo llevar la conversación**, que es lo que faltaba: leer el mensaje entrante, la escalera de preguntas, cómo profundizar cuando el cliente menciona un problema, los 4 asesinos de conversación, y los datos falsos que circulan por ahí. |
| [`DTDCARGO-baterias-CRM.md`](DTDCARGO-baterias-CRM.md) | Guía completa de baterías de litio (ya existía) |

> **`06` es la versión HUMANA de [`BRAND.md`](../BRAND.md).** El original está escrito para
> Claude Code (habla de `var(--*)`, de `BrandMark.tsx` y de ratios WCAG) y para una persona
> haciendo una pieza es ruido. No compartas `BRAND.md` con el equipo — comparte el `06`.

## El manual de operación → [`manual/`](manual/README.md)

Los `01`–`07` dicen **qué responder**. La subcarpeta [`manual/`](manual/README.md) explica
**cómo funciona**: el precio, el paso a paso de cada servicio, el portal, qué hacer cuando
algo falla y dónde está el material de marketing. Es lo que se le da a **Codex** —
empieza por [`manual/PROMPT.md`](manual/PROMPT.md).

## Cómo actualizarlo

1. Edita el `.md` acá.
2. En el Proyecto de Claude, borra el archivo viejo y sube el nuevo.

> ⚠️ **Estos documentos derivan de fuentes vivas del repo.** Si cambia un servicio
> (`lib/shared/shipment-public.ts`), un módulo (`lib/studio/modules.ts`), una ruta
> (`next.config.ts`) o un guion (`docs/marketing/`), hay que reflejarlo acá — no se actualiza
> solo.

## Lo que NO va en este paquete

Deliberadamente fuera, porque el equipo responde a clientes:

- **Márgenes y costos internos** (`/studio/costing`, `docs/legal/casos/`)
- **Los topes de peso exactos** — `docs/marketing/manual-vendedores-peso.md` es interno
- **Precios de la competencia** — `docs/marketing/competencia-precios.md`
- **La meta interna de volumen mensual** — explícitamente no se publica
- **Razón social y RIF** — solo en documentos legales, nunca en un chat de venta
- **Datos personales de clientes** — viven en Supabase con RLS, no en un documento
