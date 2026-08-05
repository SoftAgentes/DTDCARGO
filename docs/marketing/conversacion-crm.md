# Cómo llevar una conversación con un lead

> **Para qué sirve:** el material de referencia sobre **cómo conversar**, no sobre qué responder.
> El *qué* vive en [`equipo-crm/02-respuestas-CRM.md`](../../equipo-crm/02-respuestas-CRM.md) y en
> la base de conocimiento del bot de Kommo. Acá está el criterio: **cómo leo lo que me
> escribieron, qué contesto, y sobre todo qué pregunto de vuelta.**
>
> **Estado:** propuesto · 2026-08-03
> **Fuentes y evidencia:** [`research/INVESTIGACION-conversacion-ventas-crm.md`](../../research/INVESTIGACION-conversacion-ventas-crm.md)
> — ahí está clasificado qué está verificado, qué es dato de vendor y qué es mentira repetida.
>
> **Derivados de este documento:** `equipo-crm/07-como-conversar.md` (el que consume el
> asistente del equipo) y el guion del agente de Kommo en
> [`docs/runbooks/kommo-reconfig.md`](../runbooks/kommo-reconfig.md).

---

## Por qué existe este documento

Teníamos las respuestas y no teníamos la conversación. Los guiones de
[`guiones-asesor.md`](guiones-asesor.md) son mensajes listos para pegar: sirven, pero el asesor
que solo pega guiones **contesta y se queda callado**. El cliente pregunta el precio, recibe el
precio, y ahí muere el hilo.

Este documento resuelve eso con una sola idea de fondo:

> ⭐ **Todo mensaje que sale de DTD lleva una respuesta y UNA pregunta. Sin excepción.**

Y con una advertencia que va contra lo que se enseña en todos lados:

> ⚠️ **"Haz siempre preguntas abiertas" es falso, y quien lo midió fue Neil Rackham.** En su
> investigación, abierta vs. cerrada **no tuvo efecto medible** sobre el cierre. Lo que importa
> es *de qué* preguntas, no *cómo* la formulas. Y el consejo hace daño, porque empuja a hacer
> preguntas de contexto general ("cuéntame de tu negocio") que son justo las que aburren al
> cliente y las que peor correlacionan con vender.

---

## Las 3 reglas que no se rompen

1. **Responde rápido.** Menos de 5 minutos en horario laboral. Responder dentro de la primera
   hora hace ~**7 veces** más probable **calificar** el lead que hacerlo una hora después, y
   **más de 60 veces** más probable que esperar 24 horas o más *(HBR, 2011, sobre 1,25 millones
   de leads de 42 empresas)*.
2. **Una pregunta por mensaje.** Ni cero ni tres. En un chat, dos preguntas producen **una sola
   respuesta**: el cliente contesta la última y olvida la primera. En correo, 1 a 3 preguntas
   suben la tasa de respuesta ~50%; pasando de 3, **cae** *(Boomerang)*.
3. **La pregunta tiene que ser fácil de contestar.** Una pregunta grande y vaga no genera
   tensión productiva: genera parálisis, y el mensaje se archiva.

> 💡 **En WhatsApp esto no es solo cortesía, es plata.** Cuando un cliente te escribe se abre una
> ventana de 24 horas en la que le puedes escribir gratis, y **esa ventana solo se reinicia si el
> cliente responde**. Un mensaje que no invita respuesta te cierra el canal: la próxima vez hay
> que pagar una plantilla.

---

## Paso 1 · Leer el mensaje antes de contestar

Cinco segundos. Cinco señales. De acá sale todo lo demás.

### 1.1 ¿En qué etapa está?

| Lo que escribe | Dónde está | Qué NO hacer |
|---|---|---|
| *"¿Ustedes qué hacen?"* · *"¿cómo funciona esto?"* | **Descubriendo.** Todavía está armando el problema en su cabeza. | No le tires el precio. Todavía no significa nada para él. |
| *"¿Tienen envío desde Yiwu?"* · *"¿cuál es la diferencia entre LCL y contenedor?"* | **Comparando.** Ya tiene opciones sobre la mesa. | No lo eduques desde cero. Ve a lo que nos diferencia. |
| *"¿Cuánto cuesta traer 3 metros a Barquisimeto?"* · *"¿aceptan pago al llegar?"* | **Decidiendo.** La decisión está cerca. | **No lo hagas esperar.** Y no le pidas cinco datos antes de darle un número. |

⭐ **Una pregunta de precio no es una pregunta: es una señal de compra.** Trátala como la máxima
prioridad del día.

### 1.2 ¿Cuánto sabe?

Esto cambia todo el tono de la conversación:

- **Si escribe "CBM", "FOB", "1688", "packing list", "consolidado"** → sabe lo que hace.
  ⭐ **No lo eduques.** Con un comprador ya informado, pasar de 5 preguntas de descubrimiento
  **baja el cierre 24%** *(Chorus.ai)*. Le molesta que le hagas repetir lo que ya sabe. Ve
  directo a lo que nos separa de los demás: el precio, que paga al llegar, y la bodega propia
  en Yiwu.
- **Si dice "una caja de zapatos", "un poquito de mercancía", "no sé cuánto pesa"** → empieza de
  cero. Acá **tú** estructuras la conversación, y las preguntas son un servicio, no un
  interrogatorio.

### 1.3 ¿Cuánto mueve y cada cuánto?

**Es el filtro real del negocio.** Según [`ventas.md`](ventas.md), apuntamos a dos perfiles:
el **mayorista que repone cada 30–45 días** y el **aliado white-label**. Todo lo demás se atiende
bien, pero no entra en la cadena de seguimiento.

La pregunta que lo revela es `/q3`: *"¿Cuánto volumen mueves por pedido y cada cuánto repones?"*

### 1.4 ¿Hay urgencia?

Señales que valen oro y que el asesor deja pasar:
- Menciona una **fecha**: *"lo necesito para diciembre"*.
- Menciona el **Año Nuevo chino** (o tú se lo mencionas: las fábricas paran y hay que adelantar).
- Escribe **fuera de horario** o manda **varios mensajes seguidos**.
- Pregunta *"¿cuándo sale el próximo?"* → está listo, solo quiere una fecha.

### 1.5 ¿Soltó un número?

⭐ **Si el cliente menciona un precio primero, te acaba de dar tu ancla.** No la desperdicies.

*"Es que Fulano me lo deja en $900."* → no discutas el número. Pregunta **de qué está hecho**:
*"¿Y ese precio incluye la aduana y la entrega en tu depósito, o es hasta almacén fiscal?"*

Ese es el error de comparación más común del rubro, y es nuestro mejor terreno.

---

## Paso 2 · La anatomía de la respuesta

Tres piezas, siempre en este orden:

```
[1 línea de valor]  →  [el dato concreto que pidió]  →  [UNA pregunta fácil]
```

**Ejemplo — el caso que más llega, "¿cuánto cuesta?":**

> ❌ **Lo que mata la conversación:**
> *"Depende del volumen. Aquí tienes la calculadora: dtdcargo.com/tarifas"*
>
> ✅ **Lo que la mantiene abierta:**
> *"Te cotizamos por volumen y el precio ya lleva todo incluido hasta tu puerta: flete, aduana,
> impuestos y entrega. Métele las medidas de tus cajas acá y te sale el estimado al momento →
> dtdcargo.com/tarifas*
> *Y cuéntame una cosa: ¿ya has traído de China antes o esta sería la primera vez?"*

Fíjate en tres cosas de ese mensaje:
1. **El precio no se esconde.** Los datos dicen que tocar el precio temprano sube el win rate
   ~10%; esconderlo se lee como truco.
2. **El valor va antes del número**, si no el número solo se puede comparar contra otro número.
3. **La pregunta es de una línea y se contesta con sí o no.** No es *"cuéntame de tu operación"*.

> ⚠️ **El número sale de la calculadora, nunca de tu memoria ni de un chat viejo.** Carga normal
> en `dtdcargo.com/tarifas`, contenedor completo en `dtdcargo.com/fcl`. Y todo lo que des es un
> **estimado**: el monto final lo confirma un asesor al reservar.

---

## Paso 3 · La escalera de preguntas de DTD

⭐ **Empieza estrecho, después abre.** Una pregunta abierta al inicio (*"cuéntame de tu negocio"*)
te expone como alguien que no sabe nada del rubro. Una pregunta **diagnóstica y precisa**
demuestra que perteneces a su mundo, y te compra el derecho a preguntar lo grande después.

**Escalón 1 — la pregunta que compra credibilidad.** Estrecha, se contesta en dos palabras:

> *"¿Ya traes directo de China o le compras a distribuidores aquí?"*

Es `/q2` de los guiones, y es el mejor primer movimiento que tenemos. Su respuesta divide el
mundo en dos conversaciones distintas:

| Si dice… | Está diciendo… | Tu siguiente movimiento |
|---|---|---|
| *"Le compro a distribuidores aquí"* | Paga el margen del intermediario y no sabe que puede saltárselo. | El comparativo: cuánto le costaría lo mismo trayéndolo él. |
| *"Sí, ya traigo"* | Tiene proveedor y tiene un agente. **Compites contra alguien.** | Averigua qué le duele del agente actual. Ahí está la venta. |

**Escalón 2 — el volumen y la cadencia.** La pregunta que decide si entra a seguimiento:

> *"¿Cuánto sueles traer por pedido, y cada cuánto repones?"*

**Escalón 3 — el dolor.** Recién acá abres:

> *"¿Qué es lo que más te cuesta hoy al traer mercancía?"*

⚠️ **Nunca los tres en el mismo mensaje.** Son tres turnos, y cada turno te deja leer más señales.

### El resto de las preguntas de calificación

Las 5 preguntas (`/q1`…`/q5`) siguen siendo las mismas de
[`guiones-asesor.md`](guiones-asesor.md). Lo que cambia es que **se hacen conversando, una por
mensaje, y se saltan las que el cliente ya contestó solo.**

Cada pregunta que puedes responder mirando su perfil de Instagram o su primer mensaje es una
pregunta que **no le robas al cliente**.

---

## Paso 4 · La cadena de profundización

Cuando el cliente menciona un problema, **no propongas la solución todavía.** Tira del hilo.

> ⭐ Esto tiene el respaldo más sólido de toda la investigación: las **preguntas de seguimiento**
> —las que profundizan lo que la persona acaba de decir— son lo único con evidencia experimental
> fuerte de que mejoran cómo te perciben y de que producen un resultado real
> *(Huang et al., 2017, con speed dating y conducta observada)*.

La cadena, adaptada a nuestro negocio:

| # | Pregunta | Qué saca |
|---|---|---|
| 1 | *"Cuéntame más de eso."* | Abre. No interpretes todavía. |
| 2 | *"¿Me das un ejemplo? ¿Qué pasó la última vez?"* | Baja de lo abstracto a un caso concreto. |
| 3 | *"¿Desde cuándo te viene pasando?"* | Distingue una molestia de una carga acumulada. |
| 4 | *"¿Y qué has intentado para resolverlo?"* | Te dice contra qué compites de verdad. |
| 5 | ⭐ *"¿Y te funcionó?"* | **La demoledora.** Lo obliga a admitir que lo anterior no sirvió — y ahí se abre el hueco para nosotros. |
| 6 | *"¿Más o menos cuánto te ha costado eso?"* | Pasa de operativo a plata. |
| 7 | *"¿Y cómo te sientes con eso?"* | Pasa de plata a personal. La gente compra emocionalmente. |

⭐ **Regla de oro: cada pregunta profundiza la respuesta anterior. Ninguna cambia de tema.** Ese
es todo el secreto, y es lo que separa una conversación de un formulario.

**Cómo se ve en DTD:**

> — *"Es que la última vez me llegó tarde y encima me cobraron extra en la aduana."*
> — *"¿Te cobraron extra al final? Cuéntame qué pasó."*
> — *"Sí, el agente me dio un precio y después aparecieron unos gastos de nacionalización."*
> — *"Uf. ¿Y eso te ha pasado más de una vez o fue esa sola?"*
> — *"Las últimas dos veces."*
> — *"¿Y has intentado que te lo den cerrado desde el principio?"*
> — *"Les pregunté pero me dicen que depende."*
> — *"¿Y más o menos cuánto te ha significado ese extra?"*

En ocho mensajes tienes el dolor, la frecuencia, el intento fallido y el monto. Y **no
mencionaste el servicio ni una sola vez.** Cuando lo menciones, ya no es un pitch: es la
respuesta a algo que él mismo enunció.

---

## Paso 5 · Las cuatro herramientas de conversación

Adaptadas al texto, que es donde trabajamos. En chat no tienes tono ni pausa ni cara — hay que
compensar con estructura.

### 5.1 El espejo

Repites 1 a 3 palabras de lo que acaba de decir, con signo de pregunta. Sirve para que siga
hablando sin que sientas que lo estás interrogando.

⚠️ **En texto el espejo pelado se lee frío o sarcástico.** Necesita una frase que explique tu
intención:

> ❌ *"¿Complicado…?"*
> ✅ *"¿Complicado en qué sentido? Quiero entender bien antes de proponerte nada."*

### 5.2 La etiqueta

Nombras en voz alta lo que percibes. Es la herramienta que **mejor funciona por escrito**, porque
el cliente puede releerla.

- *"Parece que ya te quemaste con un proveedor antes."*
- *"Suena a que el tema no es tanto el precio como el tiempo."*
- *"Se ve como que hay alguien más que tiene que aprobar esto."*

Dos reglas:
1. ⭐ **Nunca digas "yo creo que" ni "yo escucho que".** La palabra "yo" pone al otro a la
   defensiva. La etiqueta va impersonal.
2. ⭐ **Cállate después de etiquetar.** No encadenes una pregunta. En texto, callarse significa
   **terminar el mensaje ahí** y esperar.

### 5.3 Las preguntas que abren sin presionar

Empiezan con **"qué"** o **"cómo"**. Le devuelven el problema al cliente sin sonar a confrontación.

| Situación | La pregunta |
|---|---|
| Te dieron un precio de la competencia | ⭐ **"¿Comparado con qué?"** y **"¿Cómo llegaste a esa cifra?"** |
| Te piden algo que no puedes dar | **"¿Cómo se supone que haga eso?"** |
| Quieres saber por qué se movió ahora | **"¿Qué te llevó a buscar otra opción?"** |
| Quieres cerrar sin presionar | **"¿Qué haría falta para que esto te funcione?"** |
| Se quedó callado hace días | **"¿Ya descartaste traer esa mercancía?"** |

⚠️ **Nunca empieces con "¿por qué?".** Dispara defensa casi siempre. *"¿Qué te llevó a…?"* dice
lo mismo sin acorralar.

⭐ **Y la última de la tabla merece explicación:** una pregunta que se contesta con "no" da
seguridad y control. Es mucho mejor que *"¿sigues interesado?"*, que obliga a comprometerse y por
eso no se contesta.

### 5.4 El resumen

La más potente cuando la conversación se puso larga. Recapitulas su situación con tus palabras
hasta que el cliente diga **"exacto"**.

> *"Déjame ver si te entendí:*
> *· Traes como 3 metros cada mes y medio.*
> *· El problema no es el flete, es que te aparecen gastos después.*
> *· Ya intentaste que te lo cerraran desde el principio y no quisieron.*
> *¿Me falta algo o me pasé en algo?"*

Fíjate: **una sola pregunta, y se contesta con "no, está bien"**. Fácil de responder.

> ⭐ **"Exacto" y "tienes razón" no son lo mismo.** "Exacto" significa que se sintió entendido.
> "Tienes razón" suele ser un desaire cortés para que te calles. Si te dicen "tienes razón", **no
> terminaste de escuchar.**

---

## Paso 6 · La objeción

**Regla de fondo: la objeción de precio casi nunca es sobre el precio.** Es la señal de que no
alcanzaste a mostrar por qué vale. Tres escuelas independientes llegan a lo mismo, y la
consecuencia práctica es incómoda: **la objeción de precio se previene preguntando bien, no se
resuelve negociando.**

**La secuencia, en orden:**

1. **Pausa.** No contestes en dos segundos. Los mejores vendedores pausan unas 5 veces más que
   el promedio ante una objeción; el promedio casi interrumpe.
2. **Espejo o etiqueta.** *"¿Se te fue de presupuesto…?"* / *"Parece que el número te sorprendió."*
3. ⭐ **Pregunta antes de argumentar.** Los mejores responden a una objeción **con una pregunta el
   54% de las veces**; el promedio solo el 31% *(Gong, 67.149 grabaciones)*. La pregunta es
   *"¿comparado con qué?"*.
4. **Recién ahí, el argumento** — y basado en lo que él te dijo, no en el folleto.

**Lo que no se hace, con la razón al lado:**

| ❌ | Por qué |
|---|---|
| **Bajar el precio de una** | Los que descuentan de inmediato cierran ~25% menos a la larga. Además sienta precedente: el próximo pedido también espera descuento. |
| **Cerrar un número por chat** | Negociar precio solo por escrito rinde 5% de cierre; por teléfono + escrito, 35%. **Si hay que negociar de verdad, se llama.** |
| **Prometer para que se quede** | Un plazo inventado se cobra en el reclamo. Los tiempos los define la naviera. |
| **Contestar "depende"** a secas | Es un callejón sin salida. Si depende, di **de qué** depende y pide ese dato. |

⚠️ **Descuentos y tarifas especiales se escalan a Administración.** El asesor no los concede.

El catálogo completo de objeciones con la respuesta redactada vive en
[`equipo-crm/02-respuestas-CRM.md`](../../equipo-crm/02-respuestas-CRM.md).

---

## Los 4 asesinos de conversación

Si un hilo se murió, casi siempre fue uno de estos:

1. **El link solo.** *"Aquí tienes: dtdcargo.com/tarifas"*. Lo sacaste de la conversación y lo
   mandaste al navegador, donde no tienes contexto ni segunda oportunidad. El link va
   **acompañado**, nunca solo.
2. **El precio desnudo.** *"$800 el metro cúbico."* Punto. *(el número es ilustrativo: la tarifa vigente sale siempre de la calculadora)*. El cliente tiene dos opciones:
   comprar o irse. Y se va, porque un precio sin marco solo se puede comparar contra otro precio.
3. **La respuesta de una palabra.** *"Sí."* / *"Correcto."* Cierra el turno sin devolver la
   pelota, y el cliente no tiene ninguna obligación de sostener la conversación.
4. **El cierre inseguro.** *"¿Qué te parece?"* / *"¿Alguna otra pregunta?"* No son preguntas: son
   la ausencia de una, y comunican que no tienes confianza en lo que ofreces.

> 💡 **El dato que respalda esto:** pitchear de entrada reduce la tasa de respuesta **hasta 57%**
> *(Gong, 25 millones de correos)*. Un link o un precio como primera respuesta **es un pitch**.

---

## Detalles de canal

**Emojis.** Cero o mínimos en el primer contacto con un desconocido. La única evidencia
experimental disponible dice que en una primera impresión virtual **te hacen ver menos
competente**, y eso reduce cuánta información comparte el otro. Una vez hay confianza y si el
cliente los usa, **refléjalos**.

**Notas de voz.** Úsalas para **desempatar**: una objeción difícil, un malentendido, una relación
ya tibia. **No como primer contacto.** Y 10–15 segundos, no dos minutos.
⚠️ Vas a leer en blogs que "suben la respuesta 30-40%". **Ese dato no existe** — es marketing de
empresas que venden la herramienta.

**Las palabras del cliente, no las tuyas.** Si él dice "envíos", no le contestes "logística de
última milla". Si dice "la carga", no le digas "el embarque". Copiar su vocabulario es la única
forma de sintonía que te queda en texto, y sí tiene respaldo experimental.

**Fuera de horario.** Más del 40% de las consultas de alta intención llegan de noche y en fin de
semana. Si hay respuesta automática, **que haga una pregunta** — mantiene la ventana viva y
captura la señal. Un *"te respondemos en horario de oficina"* es un callejón sin salida.

---

## 🔴 Los datos falsos que circulan

Están acá para que **nadie los use** en una presentación, un anuncio o un argumento de venta.
Todos se repiten en blogs de marketing y **ninguno tiene fuente primaria**:

| Lo que vas a leer por ahí | La realidad |
|---|---|
| *"78% de los clientes le compra al primero que responde"* | La encuesta citada **no existe**. Es el dato más repetido y más falso del sector. |
| *"WhatsApp tiene 98% de tasa de apertura"* | Sin fuente. Aparece en todos los blogs de vendors en español. |
| *"Los DM de Instagram tienen 90% de apertura"* | Cadena circular de blogs citándose entre sí. |
| *"Las notas de voz suben la respuesta 30-40%"* | Claim de empresas que venden herramientas de outreach. |
| *"80% de las ventas requieren 5 seguimientos"* | Sin fuente primaria localizable. |
| *"La calidad del lead cae 80% después de 5 minutos"* | Se atribuye a Harvard Business Review. **No está en el artículo.** |

**Lo que sí puedes decir**, con la fuente: 7× calificar en la primera hora y 60× frente a esperar
24 horas (HBR 2011, sobre 1,25 millones de leads; la auditoría de 2.241 empresas del mismo
estudio es la que midió que el 23% **nunca responde**) · 21× entre 5 y 30 minutos
(Oldroyd/InsideSales 2007) · tener el
compromiso de respuesta **por escrito** sube el cumplimiento de 29,5% a 54,9% (Blazeo 2026).

---

## Lo que este documento no cubre

- **Los datos del negocio** (precios, plazos, qué incluye cada servicio, qué se puede enviar)
  → [`equipo-crm/01-servicios-y-cotizacion.md`](../../equipo-crm/01-servicios-y-cotizacion.md)
  y `lib/faqs.ts`. **Ninguna cifra se escribe de memoria.**
- **Lo que no se dice nunca** (las palabras prohibidas, a quién escalar, datos personales)
  → [`equipo-crm/05-reglas-y-limites.md`](../../equipo-crm/05-reglas-y-limites.md).
- **La cadencia de seguimiento** (día 2, 5, 10, 18 y el nurture mensual)
  → [`guiones-asesor.md`](guiones-asesor.md) y [`adquisicion.md`](adquisicion.md).
- **El entrenamiento del asesor como persona** — este documento está escrito para alimentar al
  asistente de IA. El manual de formación humana es una entrega aparte.

---

*DTD Cargo · uso interno. Evidencia y fuentes completas en
[`research/INVESTIGACION-conversacion-ventas-crm.md`](../../research/INVESTIGACION-conversacion-ventas-crm.md).
Si un dato de este documento contradice al código (`lib/calculadora.ts`, `lib/faqs.ts`,
`lib/shared/shipment-public.ts`), **manda el código**.*
