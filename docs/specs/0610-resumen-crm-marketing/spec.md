---
sdd: "0610"
title: "Resumen semanal agregado del CRM para marketing, sin datos personales"
status: proposed
author: "Claude"
created: 2026-11-06
updated: 2026-11-14
supersedes: null
superseded_by: null
related: ["0062", "0149", "0582", "0585", "0587", "0604", "0605", "0606"]
confidencialidad: interno
---

# SDD-0610 — Resumen semanal agregado del CRM para marketing

> Cada lunes el Studio cuenta qué preguntaron, qué objetaron y por qué escribieron las personas
> en Chatwoot la semana anterior, y le entrega a la oficina de agentes solo esos conteos, sin
> nombres, teléfonos, correos, textos literales ni montos.

**Solo spec.** Esta SDD no trae código ni migraciones. Propone una migración **sin número**: el
número lo asigna el Director General.

## 1. Contexto

Pedido de Sam (2026-11-05): que el departamento de marketing de la oficina de agentes (Hermes +
Paperclip, en un VPS aparte) entienda qué pasa en el CRM (Chatwoot con Instagram, Facebook y
WhatsApp) para proponer campañas y temas de noticias.

La regla ya está escrita en la oficina y no cambia:

- Los agentes **no leen conversaciones ni reciben datos de clientes**
  (`docs/organizacion/oficina-conocimiento/07-quien-hace-que.md`, fila 5 y «Común a los 13»).
- **Esquema mixto:** los agentes piensan en la oficina; el Studio guarda los datos, las llaves y
  publica. La oficina se conecta con el Studio por **puertas angostas**: una salida de datos
  agregados sin datos de clientes y una entrada que solo crea borradores
  (`07-quien-hace-que.md` §«Antes de proponer una automatización»; `06-noticias.md` §«Quién hace
  qué»).
- El resumen ya está anunciado como pendiente: `04-marketing.md` («Lo que marketing recibe del
  CRM»), `organigrama-paperclip.md` («Marketing mira el CRM sin datos personales… Necesita SDD
  propia con `revisar-datos-ve`») y `plan-maestro-oficina.md` paso 8.

### Lo que existe hoy (medido en `main` `5373e6c81`)

| Pieza | Dónde | Qué sirve aquí |
|---|---|---|
| Conversaciones y eventos de Chatwoot en el Studio | `public.chatwoot_conversations` (estado, bandeja, asignado y última actividad) y `public.chatwoot_webhook_events` (un evento `message_created` por mensaje, con `conversation_id` y `received_at`), los dos de la 0504 (SDD-0585). **Sin texto ni datos del contacto** (`supabase/migrations/0504_chatwoot_eventos.sql:53-75` y `:90-104`). Los eventos se purgan a los 90 días (`lib/studio/chatwoot/purga.ts:13-15`). El evento no dice si el mensaje fue entrante o saliente | Qué conversaciones tuvieron actividad en la semana |
| Texto de los mensajes | Solo en Chatwoot. El Studio lo lee por la API de cuenta (`lib/studio/chatwoot/account-api.ts:127`, `GET …/conversations/{id}/messages?after=N`, 100 por página) | Es lo único que permite contar preguntas y objeciones |
| Tarjetas del CRM propio | `crm_tarjetas`, `crm_etapas`, `crm_historial_etapas` (0506, SDD-0587). `fuente` cerrada a diez valores (`supabase/migrations/0506_crm_modelo.sql:318-320`); los cinco que vienen de Chatwoot son `whatsapp_leads`, `whatsapp_clientes`, `instagram`, `messenger` y `correo` (`0513_crm_entrada_leads.sql:205`), y el canal sale de `fuenteDeCanal` (`lib/studio/chatwoot/entrada-leads.ts:86`) | Volumen por canal de entrada y por etapa |
| Etapas | 7 de Leads y 4 de Clientes, `sistema = true` (SDD-0587 §4.3 y §4.4). El admin puede crear etapas propias con `clave` y `nombre` libres (`0506_crm_modelo.sql:207-210`) | Solo las de sistema salen con su clave; las propias se suman en «otras» |
| Motivo de pérdida | `crm_tarjetas.motivo_perdida`, texto libre de 1 a 200 caracteres (`0506_crm_modelo.sql:316`) | No sale nunca como texto: se clasifica igual que un mensaje |
| Precedente de análisis sin datos personales | `docs/marketing/seo-aeo-preguntas-crm.md`: 401 conversaciones de Kommo, con porcentajes por tema y sin datos personales | Origen del catálogo de temas (§4.3) |
| Precedente de resumen con IA | `lib/studio/conversaciones/digest-extract.ts` (SDD-0149): manda el nombre del cliente y la transcripción completa a Anthropic (`:65-69`, `:80`) | **No se reutiliza.** Es un resumen por cliente para uso interno; aquí el texto no sale del proceso del Studio (§4.4) |
| La puerta de salida | No existe todavía (`06-noticias.md:193-199`). Ninguna SDD la define: la de publicación automática de noticias (en preparación, 2026-11-06) la deja fuera de su alcance y solo fija la puerta de entrada | **Esta SDD define su transporte** (§5); los temas de Search Console lo reutilizan después |

## 2. Alcance

1. **Generar** cada semana un resumen agregado de Chatwoot y del CRM propio del Studio.
2. **Guardarlo** en el Studio (una tabla, migración sin número).
3. **Entregarlo** a la oficina por la puerta de salida, sin que la oficina tenga ninguna llave del
   Studio ni de Chatwoot.
4. **Probar** automáticamente que el resumen no trae nombres, teléfonos, correos, códigos de
   cliente, montos ni textos literales.

**Fuera de alcance:**

- Kommo. Mientras siga atendiendo parte de WhatsApp (SDD-0587, F2), lo que entra por Kommo no se
  cuenta. El resumen lo dice en su cabecera (decisión D5).
- El correo de `vzla@` dentro de Chatwoot: se cuenta su volumen (canal `correo`), pero sus
  textos no se clasifican en v1 (traen firmas, direcciones y adjuntos; decisión D5).
- Cifras de las cuentas de Instagram, Facebook o TikTok (seguidores, alcance). Es otra salida.
- Que un agente pida «más detalle». Cualquier corte nuevo es una SDD nueva con su revisión de
  privacidad.

## 3. Qué trae el resumen

Un resumen cubre **una semana ISO cerrada** (lunes 00:00 a domingo 23:59, hora de Caracas). Nunca
ventanas móviles ni solapadas: así no se pueden restar dos resúmenes para despejar una celda
escondida (§6.3).

| Bloque | Qué cuenta | Unidad | Fuente |
|---|---|---|---|
| `volumen_canal` | Por canal (`whatsapp_leads`, `whatsapp_clientes`, `instagram`, `messenger`, `correo`): conversaciones con actividad en la semana y, de ellas, las que tuvieron al menos un mensaje entrante y las que empezaron en la semana | Conversación | Actividad: `chatwoot_webhook_events`. Entrantes y nuevas: los mensajes leídos de Chatwoot. Canal: `fuenteDeCanal` sobre el tipo de bandeja |
| `volumen_etapa` | Por etapa de sistema: tarjetas que **entraron** en la semana y tarjetas **en la etapa** al cierre del domingo. Etapas propias del admin, sumadas en `otras` | Tarjeta | `crm_historial_etapas`, `crm_tarjetas` |
| `preguntas` | Conversaciones en las que la persona hizo cada pregunta del catálogo | Conversación distinta | Mensajes entrantes de la semana |
| `objeciones` | Conversaciones con cada objeción del catálogo | Conversación distinta | Mensajes entrantes + `motivo_perdida` de las tarjetas que pasaron a «Perdido» |
| `motivos` | Conversaciones por motivo de consulta (cotizar, seguimiento, reclamo…) | Conversación distinta | Primer mensaje entrante de la semana |
| `cobertura` | Conversaciones leídas, sin clasificar y omitidas por error | Conversación | El propio cálculo |

Se cuentan **conversaciones distintas, no mensajes**: una persona que escribe 50 veces sobre
precios suma 1. Un tema cuenta como máximo una vez por conversación y por semana.

Solo mensajes **entrantes** (`message_type = 0`), no privados. Un saliente del equipo, una nota
interna o el eco de un mensaje enviado no cuentan. Por eso la actividad sale de los eventos, pero
los entrantes se cuentan leyendo los mensajes: un mensaje que envía el equipo también crea un
evento `message_created`.

**No trae:** nombres, usuarios, teléfonos (ni los últimos 10 dígitos), correos, Shipping Marks,
ids de conversación, de contacto o de tarjeta, direcciones, montos, fechas de una conversación,
nombres de asesores ni frases de las personas. Tampoco el porcentaje de conversión: el indicador
de marketing es el volumen que entra (`04-marketing.md`).

## 4. Diseño

### 4.1 Quién lo genera y cuándo

- **El Studio**, en el contenedor cron del VPS de producción, con el patrón de
  `app/api/cron/ceo-brief/route.ts`: ruta `GET /api/cron/crm-resumen-semanal` protegida por
  `CRON_SECRET`.
- **Lunes 07:00 de Caracas (11:00 UTC)**, sobre la semana anterior.
- **Reintento:** si un bloque queda `no_disponible`, el cron vuelve a correr el martes y el
  miércoles a la misma hora solo para los bloques que faltan. El miércoles el resumen se cierra
  como está.
- **Idempotencia:** una fila por `(tenant_id, semana)`. Correrlo dos veces no duplica ni cambia
  una semana ya entregada (se puede regenerar a mano, antes de entregarla, desde el Studio).

### 4.2 Lectura de Chatwoot

- **Por la API de cuenta**, como el resto de la integración (SDD-0587 §2: Chatwoot es la fuente
  de los mensajes; el Studio no copia textos).
- Con un **usuario propio de Chatwoot**, «Resumen semanal», agente miembro de las bandejas que se
  cuentan, y su token en una variable del servidor del Studio, `CHATWOOT_RESUMEN_TOKEN`
  (decisión D2). No se reutiliza `CHATWOOT_ROUTER_TOKEN`: ese token escribe etiquetas y responde,
  y separarlos deja revocar uno sin tocar el otro.
- Recorre las conversaciones con algún `message_created` en la semana (`chatwoot_webhook_events`
  por `received_at`, con el corte de la hora de Caracas) y, de cada una, solo los mensajes con
  `created_at` dentro de la semana. Un evento perdido por una caída del webhook deja fuera su
  conversación; la reconciliación de la Bandeja (`account-api.ts:8-18`) no lo repone. Es un límite
  conocido: el resumen lo dice en su cabecera y no lo disfraza de cobertura completa.
- El tipo de cada bandeja (`GET …/inboxes`) se lee en cada corrida. Sin él, `volumen_canal` queda
  `no_disponible`: no se adivina el canal por el número de bandeja.
- Chatwoot corre en el mismo servidor de Contabo que el Studio (`inventario-terceros.md` §2 bis):
  el texto no cruza internet.

### 4.3 Catálogo cerrado de temas

El resumen solo puede nombrar temas de un **catálogo versionado en el repositorio**
(`lib/studio/crm-resumen/catalogo.ts`, `CATALOGO_VERSION`). Cada entrada tiene un `id` fijo, una
etiqueta escrita por DTD y las reglas que la detectan. **Ningún texto del resumen sale de una
conversación**: todo lo que no es número es un `id` o una etiqueta del catálogo.

Catálogo inicial, a partir de las 20 preguntas de `seo-aeo-preguntas-crm.md` y la base de
SDD-0062 (`docs/specs/0062-crm-erp-cierres-automaticos/assets/faq-knowledge-base.md`):

| Familia | Entradas iniciales (`id`) |
|---|---|
| `preguntas` | `como_empezar`, `costo_envio`, `plazo_maritimo`, `direccion_bodega`, `incoterms`, `forma_pago`, `puerta_a_puerta`, `cbm_flete`, `lcl_fcl`, `aduana_impuestos`, `importacion_a_nombre`, `shipping_mark`, `despues_del_despacho`, `rastreo`, `cobertura_venezuela`, `prohibidos`, `baterias`, `validar_proveedor`, `inspeccion`, `compra_consolidacion`, `aereo`, `horario_ubicacion` |
| `objeciones` | `precio_alto`, `plazo_largo`, `desconfianza`, `minimo_de_carga`, `pago_por_adelantado`, `compara_con_otro`, `prefiere_aereo`, `ya_tiene_agente`, `documentos` |
| `motivos` | `cotizar`, `seguimiento_carga`, `reclamo`, `compras_proveedor`, `alianza`, `empleo`, `cortesia_ruido` |

`compara_con_otro` nunca nombra al competidor. `cortesia_ruido` replica el 42 % de ruido que
midió SDD-0062: sirve para que marketing vea cuánto del volumen es real.

Agregar o renombrar una entrada es un cambio de código con revisión: sube `CATALOGO_VERSION` y
la prueba de §7 corre sobre el catálogo nuevo.

### 4.4 Clasificación, sin sacar el texto del Studio

**v1: clasificador determinista** en el propio proceso del Studio
(`lib/studio/crm-resumen/clasificar.ts`): normaliza el texto (minúsculas, sin tildes, sin
emojis) y aplica las reglas del catálogo (palabras y expresiones por entrada). Sin red, sin
modelo, sin reloj ni azar: el mismo texto da siempre el mismo resultado.

- El texto vive **solo en memoria**, mientras se clasifica una conversación. No se guarda, no se
  registra en logs (ni en error), no va a la cola de trabajos ni a otro servicio.
- Un mensaje puede caer en varias entradas o en ninguna (`cobertura.sin_clasificar`).
- **Por qué no un modelo de lenguaje en v1:** clasificar con Anthropic o GLM manda el texto
  completo de cada conversación a un tercero en EE. UU. o China, para una finalidad nueva. El
  determinista no tiene ese costo y da un piso medible. La opción con modelo queda en la
  decisión D3 con sus condiciones (texto tapado, salida restringida al catálogo, tercero ya
  contado en el inventario).
- **Calidad:** el clasificador trae un conjunto de evaluación **sintético** (mensajes escritos
  por el equipo, no copiados de clientes) en `__tests__/fixtures/`. La calidad real solo se
  puede medir con una muestra de conversaciones leída por una persona del equipo que ya tiene
  acceso al CRM, dentro del Studio; eso necesita el OK de Sam (decisión D4).

### 4.5 Umbral mínimo: k = 5

**Propuesta: una fila solo sale si cuenta 5 o más conversaciones distintas** (o tarjetas, en
`volumen_etapa`). Por debajo, la fila no aparece; el bloque solo dice cuántas filas quedaron
escondidas (`filas_bajo_umbral`), sin decir cuáles.

**Por qué 5:**

1. **El volumen es bajo.** Instagram entra desde el 2026-10-31 y, según una medición de una
   sesión de coordinación que no está en el repositorio (inferencia), tenía menos de diez
   remitentes en total la primera semana. Con canales o temas de 1, 2 o 3 personas, una fila
   con «1» describe a una persona concreta: quien sepa quién escribió esa semana la reconoce.
2. **5 es el piso habitual en estadística pública** para celdas de conteos pequeños (es la regla
   de muchas oficinas de estadística y de salud; algunas usan 10). Con 5, una fila visible
   siempre mezcla al menos cinco personas.
3. **10 escondería casi todo hoy.** Con el volumen actual, k = 10 dejaría el resumen vacío varias
   semanas y marketing volvería a pedir datos a mano, que es peor para la privacidad. k sube
   a 10 sin cambiar código (constante `UMBRAL_K`) cuando el volumen lo permita (decisión D1).
4. **Se complementa con otras reglas**, porque k solo no basta:
   - **Sin cruces en v1:** cada bloque es una lista de una sola dimensión (tema, canal o etapa).
     No sale «tema × canal» ni «tema × etapa»: un cruce parte cada fila en celdas más chicas.
   - **Semanas fijas, sin solapes** (§3), para que no se puedan restar resúmenes.
   - **Sin totales que despejen lo escondido:** `cobertura` da el total de conversaciones leídas,
     pero cada bloque de temas es de respuesta múltiple (una conversación cae en varios temas),
     así que total menos filas visibles no da ninguna celda. En `volumen_canal` y
     `volumen_etapa`, que sí suman, el total sale solo si también las filas escondidas suman 5 o
     más; si no, el total no sale.
   - **Semana de poco volumen:** si una semana tiene menos de 5 conversaciones con entrantes, no
     sale ningún bloque de temas; el resumen dice «semana con poco volumen».

### 4.6 Formato

Un JSON con esquema cerrado (`crm-resumen/1`) y su versión en Markdown generada **desde el JSON**
(nunca desde los textos). Ejemplo con números inventados:

```json
{
  "esquema": "crm-resumen/1",
  "semana": "2026-W45",
  "desde": "2026-11-02",
  "hasta": "2026-11-08",
  "zona": "America/Caracas",
  "generado_at": "2026-11-09T11:00:04Z",
  "catalogo_version": "1",
  "clasificador_version": "1",
  "umbral_k": 5,
  "alcance": "Solo Chatwoot. No incluye lo que entra por Kommo.",
  "bloques": {
    "volumen_canal": {
      "estado": "ok",
      "filas": [
        { "canal": "whatsapp_leads", "nuevas": 31, "con_entrantes": 44 },
        { "canal": "instagram", "nuevas": 6, "con_entrantes": 9 }
      ],
      "filas_bajo_umbral": 2,
      "total": null
    },
    "volumen_etapa": {
      "estado": "ok",
      "filas": [
        { "tablero": "leads", "etapa": "nuevo", "entraron": 37, "al_cierre": 52 },
        { "tablero": "leads", "etapa": "estimado_enviado", "entraron": 8, "al_cierre": 15 }
      ],
      "filas_bajo_umbral": 5,
      "total": null
    },
    "preguntas": {
      "estado": "ok",
      "filas": [
        { "id": "costo_envio", "etiqueta": "¿Cuánto cuesta traer mercancía de China?", "conversaciones": 19 },
        { "id": "plazo_maritimo", "etiqueta": "¿Cuánto tarda un envío marítimo?", "conversaciones": 11 }
      ],
      "filas_bajo_umbral": 9
    },
    "objeciones": { "estado": "ok", "filas": [], "filas_bajo_umbral": 3 },
    "motivos": {
      "estado": "no_disponible",
      "motivo": "chatwoot_no_responde",
      "filas": []
    }
  },
  "cobertura": { "leidas": 58, "sin_clasificar": 12, "omitidas_por_error": 0 }
}
```

Validación al generar y al entregar (`validarResumen`): claves exactas sin propiedades extra;
`canal`, `tablero`, `etapa` e `id` dentro de sus listas cerradas; `etiqueta` igual a la del
catálogo; números enteros ≥ `umbral_k` (o `null` en `total`); `motivo` dentro de una lista
cerrada. **Un resumen que no valida no se guarda ni se entrega**, y el cron avisa del error.

### 4.7 Dónde se guarda

Tabla nueva, **migración sin número** (la numera el Director General):

| Tabla | Columnas | Acceso |
|---|---|---|
| `crm_resumen_semanal` | `tenant_id`, `semana` (texto ISO, único con el tenant), `payload` jsonb (el JSON de §4.6), `catalogo_version`, `estado` (`completo`, `parcial`, `fallido`), `generado_at`, `entregado_at`, `entrega_estado` (`pendiente`, `entregado`, `incierto`, `fallido`), `intentos` | Escribe solo `service_role`. Leen `admin` y el rol de marketing del tenant. Sin `delete` por la API |

`payload` no es dato personal si cumple §4.5 y §4.6, pero igual tiene un `check` de tamaño (≤ 64
KB) y se valida antes del `insert` (§4.6). Retención propuesta: 24 meses (sirve para comparar
temporadas).

## 5. Cómo se entrega: la puerta de salida

**Regla:** la llave que mueve el resumen vive **en el Studio**. La oficina **no tiene ninguna
credencial** del Studio, de Chatwoot ni de Supabase, y no consulta nada: **recibe**. Así, aunque
la oficina quede comprometida, desde ahí no se puede pedir otra semana, otro corte ni un dato
de un cliente.

- **El Studio empuja** el resumen después de generarlo (lunes, después de las 07:00).
- **Esta SDD define la puerta de salida.** La SDD de publicación automática de noticias la deja
  fuera de su alcance (lo confirmó su sesión el 2026-11-06) y solo fija la puerta de entrada.
  El transporte de abajo queda como el de toda salida agregada: cuando lleguen los temas de
  Search Console (`docs/marketing/agente-seo-noticias.md`, fase C), usan el mismo canal y las
  mismas reglas, cada uno con su propio esquema de contenido.
- **Transporte propuesto (decisión D6):** un webhook de Discord a un canal nuevo de la categoría
  Oficina, `#datos-marketing`, con el Markdown en el cuerpo y el JSON adjunto como archivo. La
  dirección del webhook es una variable del servidor del Studio
  (`DISCORD_WEBHOOK_DATOS_MARKETING`), con la confirmación `wait=true`, la cola durable y el
  `Retry-After` de SDD-0606 (en la PR #380, todavía sin fusionar: esta SDD depende de ella). La oficina lo lee con el bot de ALFRED, que ya tiene acceso a la
  categoría Oficina, y el Director de contenido lo recibe como tarea en Paperclip.
- **Alternativa:** el Studio crea la tarea en Paperclip con el JSON adjunto. Deja la llave de
  Paperclip en el Studio (sigue la regla) pero necesita un camino de red del VPS de producción al
  de la oficina, que hoy solo se abre por túnel desde la PC de Sam.
- **Nunca:** que Hermes o Paperclip tengan una llave para pedirle el resumen al Studio, ni una
  carpeta compartida con escritura desde la oficina.

**Quién lo usa en la oficina** (`07-quien-hace-que.md`):

| Agente | Para qué |
|---|---|
| Director de contenido | Lo cruza con el plan del mes y reparte |
| Experto en SEO, GEO y AEO | Lo cruza con los temas de búsqueda: una pregunta frecuente sin página es un tema |
| Redactor de noticias | Elige qué explicar en `/noticias` |
| Experto en Instagram y Facebook | Respuestas tipo, reels y carruseles sobre las objeciones que más se repiten |

Los agentes no pueden pedir más detalle ni el texto de una conversación. Si un tema necesita
contexto, se lo piden a Sam, que decide si una persona lo mira dentro del Studio.

## 6. Qué falla y qué no

### 6.1 Chatwoot no responde

| Caso | Qué pasa |
|---|---|
| Chatwoot caído, 401/403 del token, tiempo agotado (10 s por llamada, 3 intentos con espera) | Los bloques que dependen de Chatwoot (`preguntas`, `objeciones`, `motivos` y `volumen_canal`) quedan `no_disponible` con su motivo. `volumen_etapa` sale igual, porque viene solo de la base del Studio. El resumen queda `parcial` y se reintenta el martes y el miércoles |
| La lectura de una conversación falla a la mitad | Esa conversación no se cuenta (`cobertura.omitidas_por_error`). Si las omitidas pasan del 10 % de las leídas, los tres bloques de temas quedan `no_disponible`: **nunca se entregan conteos de una lectura incompleta como si fueran completos** |
| Paginación incompleta (más de 10 páginas de mensajes en una conversación) | Se clasifica lo leído y se suma a `omitidas_por_error` solo si no llegó a la semana completa |
| El miércoles sigue sin Chatwoot | Se entrega el resumen `parcial`: `volumen_etapa` con sus números y los demás bloques como `no_disponible`. Los agentes reciben «sin temas esta semana: Chatwoot no respondió» y **no rellenan con suposiciones** |

Cada fallo avisa en Discord (`#salud`, por la cola de SDD-0606) con el motivo técnico, nunca con
datos de una conversación.

### 6.2 La entrega falla

Cola durable de SDD-0606: `wait=true`, `Retry-After`, entrega incierta marcada como `incierto`
sin reenviar a ciegas. Un resumen entregado no se reenvía solo; reenviarlo es un botón del
Studio.

### 6.3 Lo que este diseño no protege

- **Conocimiento de quien recibe.** Si alguien en la oficina sabe por otro lado que «la única
  persona que escribió por Messenger el martes preguntó por baterías», el resumen no se lo
  confirma si k funciona, pero no puede borrarle lo que ya sabe. Por eso no hay cruces ni fechas
  dentro de la semana.
- **Un catálogo con trampas.** Una entrada del catálogo escrita como «pregunta de Pedro Pérez»
  saldría en el resumen. La protección es la revisión del código y la prueba de §7, que exige
  que las etiquetas no tengan dígitos, arrobas ni nombres de la lista de prueba.

## 7. La prueba que exige que no salgan datos personales

Archivo propuesto: `lib/studio/crm-resumen/__tests__/sin-datos-personales.test.ts`. Corre en
Vitest dentro de `pnpm verify`, sin red ni base (dobles de Chatwoot y de Supabase).

**Fixture con canarios.** Conversaciones inventadas cuyos mensajes traen, a propósito:

- nombres (`Zoraida Canaria Pérez`, `@zoraida.canaria`),
- teléfonos en varios formatos (`+58 414-555-0199`, `04145550199`, `0414 555 01 99`),
- un correo (`zoraida.canaria@example.com`),
- un Shipping Mark (`DTD-9Q7Z`),
- montos (`$1.234,56`, `350 USD`, `Bs. 12.000`),
- una dirección (`Calle Canaria, casa 7`),
- una frase única (`quiero traer cuarenta cajas de zapatos color mandarina`),

y, a la vez, las palabras que hacen caer cada conversación en temas del catálogo, para que la
prueba mire algo.

**Lo que exige** (cada punto falla con un mutante concreto, que va en el mismo archivo como caso
negativo):

| # | Exige | Mutante que lo pone en rojo |
|---|---|---|
| P1 | Ninguno de los canarios aparece, ni en minúsculas ni sin tildes, en el JSON serializado, en el Markdown ni en lo que se escribió en `console.*` durante la corrida | Agregar al JSON un campo `ejemplo` con el primer mensaje |
| P2 | Ninguna cadena del JSON ni del Markdown calza con: secuencias de 7 o más dígitos (con espacios, puntos o guiones en medio), correos, `@usuario`, `DTD-[A-Z0-9]{3,}`, montos con símbolo o moneda, enlaces | Cambiar una etiqueta del catálogo para que incluya un teléfono |
| P3 | Toda cadena del JSON es una clave del esquema, un valor de las listas cerradas, una etiqueta del catálogo o una fecha/versión con su formato | Devolver la etapa con el `nombre` libre del admin en lugar de su `clave` |
| P4 | **Piso de coincidencias:** el fixture produce al menos 3 filas visibles en `preguntas` y 1 en `objeciones`; si no, la prueba falla (evita el verde de una lista vacía) | Clasificador que no devuelve nada |
| P5 | Umbral: un tema con 4 conversaciones no sale y suma 1 a `filas_bajo_umbral`; con 5 sale con 5 | Quitar el filtro de `UMBRAL_K` |
| P6 | Conteo por conversación: 50 mensajes sobre precios en una conversación cuentan 1 | Contar mensajes |
| P7 | Solo entrantes: un saliente del equipo con las palabras de un tema no suma | Quitar el filtro de `message_type` |
| P8 | Total que despeja: en `volumen_canal`, si las filas escondidas suman menos de 5, `total` es `null` | Calcular siempre el total |
| P9 | Chatwoot falla (doble que responde 503): los bloques que dependen de Chatwoot quedan `no_disponible`, sin números; `volumen_etapa` sale | Entregar los conteos de lo leído antes del fallo |
| P10 | `validarResumen` rechaza un JSON con una propiedad extra, un `id` fuera del catálogo o un número menor que k | Validador que acepta todo |

Además, una prueba de contrato del catálogo: ninguna etiqueta tiene dígitos, `@`, ni coincide
con la lista de nombres del fixture.

## 8. Privacidad

Revisión con `revisar-datos-ve` en [`privacidad.md`](privacidad.md). Lo principal:

- **Hallazgo que bloquea el arranque:** la política pública no cubre esta finalidad.
  `app/privacidad/page.tsx:183-222` lista para qué se usan los datos y cierra con «No los usamos
  para fines distintos de los aquí descritos». Leer los mensajes para contar temas es una
  finalidad nueva, aunque lo que salga sea agregado. Antes de la primera corrida hay que sumar
  esa finalidad a la política (decisión D7).
- El texto no sale del Studio en v1, no se guarda y no va a ningún modelo.
- Discord y la oficina reciben solo agregados con k ≥ 5.

## 9. Criterios de aceptación (para la implementación)

- [ ] `pnpm verify` en verde con las pruebas de §7, incluidos sus mutantes.
- [ ] El catálogo v1 de §4.3 está en `catalogo.ts` con su versión.
- [ ] El texto de los mensajes no aparece en ninguna tabla, log ni cola (comprobado con el
      fixture de canarios contra la base local efímera, no contra producción).
- [ ] La política de privacidad dice la finalidad nueva y está publicada antes de la primera
      corrida real (D7).
- [ ] La migración tiene número del Director General y OK nominal de Sam antes de aplicarse.
- [ ] El token de Chatwoot y el webhook viven solo en el servidor del Studio. Ningún archivo del
      repositorio ni de la oficina los tiene.
- [ ] Primera corrida real con OK de Sam; su resumen lo mira Sam antes de que se entregue
      (la primera entrega es a mano).
- [ ] Fila nueva en `docs/legal/privacidad/inventario-terceros.md` (Discord recibe agregados) y
      en `registro-tratamiento.md` (finalidad nueva sobre las conversaciones).
- [ ] `04-marketing.md` y `07-quien-hace-que.md` dicen que el resumen existe y cómo se lee.

## 10. Decisiones de Sam

**Respuestas de Sam del 2026-11-14.** Dadas en la pantalla del Subdirector SEO y relatadas al Director
General, que las reconfirma con Sam. Se transcribe la opción elegida, textualmente.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | Umbral mínimo | (a) k = 5 · (b) k = 10 · (c) k = 3 | **(a)**: protege con el volumen de hoy sin vaciar el resumen; sube a 10 cuando el volumen lo permita |
| D2 | Cómo lee el Studio los mensajes | (a) usuario propio de Chatwoot con su token · (b) reutilizar el token del enrutador · (c) rol de solo lectura en la base de Chatwoot | **(a)**: separado, revocable, por la API que ya se usa. (c) es solo lectura de verdad pero ata el Studio al esquema interno de Chatwoot |
| D3 | Cómo se clasifica | (a) determinista en el Studio · (b) modelo de lenguaje con texto tapado y salida cerrada al catálogo | **(a)** en v1. (b) solo después de medir (a) y con su propia revisión de privacidad |
| D4 | Medir la calidad con conversaciones reales | (a) una persona del equipo con acceso al CRM etiqueta una muestra dentro del Studio · (b) solo fixture sintético | **(a)**, una vez, con OK nominal: sin eso no se sabe si los números sirven |
| D5 | Qué canales entran | (a) Chatwoot sin el texto del correo · (b) Chatwoot con correo · (c) también Kommo | **(a)** |
| D6 | Transporte de la puerta | (a) webhook de Discord a `#datos-marketing` · (b) tarea en Paperclip creada por el Studio | **(a)**: no necesita un camino de red nuevo entre los dos VPS y la oficina ya lee Discord. Lo reutilizan los temas de Search Console |
| D7 | Política de privacidad | (a) sumar la finalidad a §2 antes de la primera corrida · (b) consultarlo antes con la abogada | **(a) y (b)**: el texto lo propone `privacidad.md`; la abogada lo confirma |
| D8 | Frecuencia | (a) semanal, lunes 07:00 · (b) quincenal | **(a)** |
| D9 | Retención del resumen | (a) 24 meses · (b) 12 meses | **(a)** |

| # | Respuesta de Sam (2026-11-14) |
|---|---|
| D1 | «k = 5» |
| D2 | «Usuario propio con su token» |
| D3 | «Modelo de lenguaje». **Pendiente de reconfirmación del Director General:** no es la recomendación (⭐ determinista en v1; el modelo solo después de medir lo determinista y con su propia revisión de privacidad). Hasta su respuesta no es una decisión de la spec |
| D4 | «Sí, una vez» (con OK nominal de Sam cuando llegue el momento) |
| D5 | «Chatwoot sin el texto del correo» |
| D6 | «Webhook a #datos-marketing» |
| D7 | «Solo sumarla». **Pendiente de reconfirmación del Director General:** no es la recomendación (⭐ sumarla y que la abogada confirme). Hasta su respuesta no es una decisión de la spec |
| D8 | «Semanal, lunes 07:00» |
| D9 | «24 meses» |
