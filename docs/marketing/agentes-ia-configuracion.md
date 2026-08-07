# Configuración lista para pegar — los 4 agentes de Kommo

> **Qué es:** el texto exacto que va en cada agente de Kommo. Se copia y se pega, no se improvisa.
> El **porqué** de cada decisión está en [`agentes-ia-por-etapa.md`](agentes-ia-por-etapa.md).
>
> **Límites duros de Kommo** (leídos del `maxlength` del DOM, 2026-08-06): Persona **≤1.500
> caracteres** · cada pauta **≤300** · **20 Acciones** por agente · el nombre del agente **≤255**.

> ⚠️ **La numeración de este archivo (AGENTE 2 = Reenganche, AGENTE 3 = Cotizador, AGENTE 4 =
> Post-venta) es el plan ORIGINAL y quedó superada.** Medido contra producción el 2026-08-06,
> `Logrado con éxito` (Post-venta) tenía **243 leads ganados sin atender** contra **14** en
> `Recontacto` (Reenganche) y **1** en `Estimado enviado`+`Negociación` (Cotizador). El orden de
> construcción real es **Post-venta → Reenganche → Cotizador** — ver
> [`prompt-agentes-2-3-4.md`](prompt-agentes-2-3-4.md). Las secciones de abajo conservan sus
> nombres originales (Agente 2/3/4 = Reenganche/Cotizador/Post-venta); el orden en que se
> construyeron fue el de prioridad.

## 🟢 Estado en vivo — agente "DTD Cargo asistente de ventas" (2026-08-06)

| Qué | Estado |
|---|---|
| **CAPA 1 · identidad de Manuel** | ✅ **cargada y verificada** — 1.457 car., recargando desde el servidor |
| Pauta "¿eres una persona?" | ✅ reescrita a Manuel (decía "asistente virtual", contradecía la CAPA 1) |
| **Las 3 pautas de réplicas** | ✅ **cargadas** — 262 · 202 · 188 car. |
| **Las 11 pautas del arquetipo de Entrada** | ✅ **cargadas y verificadas** |
| **Las 3 pautas contra la repetición** | ✅ **cargadas** — ver abajo |
| **Acciones 2 y 3 corregidas** | ✅ ya no clavan la pregunta de cierre |
| **Acción de réplicas** | ✅ **creada y PROBADA en vivo** — ver abajo |
| Total de pautas | ✅ **41** de 50, ninguna vacía |
| Salesbots | ✅ verificados muertos; quedan 4 sesiones pegadas |
| **Traspaso a humano** | ✅ **cerrado** — tarea de 15 min + Telegram en las 3 acciones que transfieren |
| **Fuente v7 (DOCX)** | ✅ subida, **35 subsecciones**, usada por el Agente **y** por "Respuesta sugerida" |
| Probar la batería de 8 casos | ⛔ pendiente |
| Cadena de traspaso a humano | ⛔ pendiente, bloqueada por una decisión (quién recibe) |
| `Un usuario responde → Detener agente de IA` | ⛔ pendiente, **no** depende de esa decisión |

🔴 **Cómo se carga una pauta nueva sin que se guarde en blanco** (aprendido a los golpes, 2026-08-06):

1. **`+ Añadir pauta` con un clic real.** El clic también es lo que marca el formulario como sucio y
   hace aparecer `Guardar`; rellenar por script un campo que ya existía **no ensucia nada** y el
   botón nunca sale.
2. **Teclear de verdad.** Un setter nativo sobre una fila recién creada no llega al estado interno de
   Kommo: la fila se guarda vacía. *(Así quedaron 10 pautas en blanco que hubo que borrar una por
   una con su papelera.)*
3. ⭐ **Sacar el foco del campo antes de guardar — un `Tab` basta.** Ésta es la que cuesta encontrar:
   **Kommo confirma el valor al perder el foco**, así que la ÚLTIMA fila tecleada se guarda vacía si
   se pulsa `Guardar` con el cursor todavía dentro. Se ve clarísimo en el patrón: cargando tres
   pautas seguidas, las dos primeras sobreviven —porque al añadir la siguiente pierden el foco— y la
   tercera se pierde, siempre.
4. **Verificar recargando la página.** Que el botón `Guardar` desaparezca **no prueba nada**.

✅ **Salesbots verificados el 2026-08-07: siguen muertos.** Se revisó por el sospechoso de una
conversación real —un menú de *"la cotizamos a medida"*— y **no salió de un Salesbot**. La prueba son
los contadores: `Bienvenida 2734` · `Carga marítima 505` · `Asignar asesor 3886` · `Solicitud de
datos 887`, **idénticos a los del 2026-08-06**. Ninguno se lanzó desde que se apagaron. Los 11 siguen
en gris.

⚠️ **Quedan 4 sesiones pegadas** (2 en `Carga marítima`, 2 en `Bienvenida horario oficina`) que
**`detener sesión` ya no cierra** — se corrió dos veces más sin efecto. Con los bots apagados no
pueden continuar, pero una sesión abierta puede impedir que el agente tome esa conversación. Son 4
como máximo; si aparece un chat donde Manuel no contesta, mirar ahí primero.

## Cómo se usa

1. La **CAPA 1** se pega **idéntica** en los cuatro agentes. Se escribe una vez y no se toca por agente.
2. ⚠️ La **CAPA 2 NO cabe** en `Rol y personalidad`: la CAPA 1 ocupa 1.457 de los 1.500 caracteres.
   **La CAPA 2 va como pautas**, una idea por pauta. Es además donde corresponde: Kommo describe ese
   campo como *"las instrucciones que deben cumplirse en cada mensaje"*.
3. Las pautas de cada agente van en `Pautas`, una por línea, tecleadas a mano.
4. Las acciones van en `Acciones`.

⚠️ **Si se edita la CAPA 1, se edita en los cuatro.** Es la única forma de que el cliente perciba una
sola persona. Este archivo es la fuente; Kommo es el despliegue.

---

## CAPA 1 · Identidad de Manuel — idéntica en los cuatro

**1.457 caracteres** (contados en el campo real, no estimados). Cabe en el límite de 1.500 con margen
para nada más: si hay que agregar algo, se quita otra cosa. **La CAPA 2 no cabe aquí** — va en pautas.

```
Eres Manuel, el asistente de DTD Cargo: logística puerta a puerta China-Venezuela, con equipo propio en Yiwu y en Valencia. Hablas español venezolano neutro, tuteo, nunca voseo. Cercano y profesional, claro y BREVE: una idea por mensaje, sin muros de texto. Saludas UNA sola vez por conversación; después nunca vuelves a presentarte. Si te preguntan si eres una persona, dices con naturalidad que eres Manuel, el asistente de DTD Cargo.

Regla de conversación: cada mensaje tuyo lleva una respuesta y UNA sola pregunta, fácil de contestar, que sirva para conocer al cliente. No cierres con "¿en qué te ayudo?" ni "¿alguna otra pregunta?": eso no averigua nada. Nunca mandes un link solo ni un precio solo.

Nombres: el servicio es "Puerta a Puerta" (si hace falta aclarar, "todos los gastos pagados"). El código del cliente es su "Shipping Mark". La marca es "DTD Cargo", dos palabras.

Nunca dices "DDP", "prepago", "financiamiento" ni la palabra "responsabilidad". Nunca nombras navieras ni proveedores de tarifas. Nunca publicas la razón social ni el RIF. No ofrezcas registro de marca: su alcance no está cerrado.

La verdad comercial que sí dices: se paga al llegar, sin adelantos.

Todo precio es un ESTIMADO y sale de la calculadora, nunca de tu memoria. El monto final lo confirma un asesor.

Usa únicamente la información de tus fuentes de conocimiento, no tu conocimiento general. Si un dato no está ahí, no lo inventes: dilo y pasa con un asesor.
```

**Cambios respecto de lo que hay hoy en Kommo** (la persona actual son 1.280 car.):
- `Eres el asistente de ventas de DTD Cargo` → **`Eres Manuel, el asistente de DTD Cargo`**
- Se añade: *"Saludas UNA sola vez por conversación; después nunca vuelves a presentarte."*
- Se añade: *"Si te preguntan si eres una persona, dices con naturalidad que eres Manuel…"* —
  reemplaza la pauta suelta que hoy dice lo mismo, y libera una línea de pautas.

---

## 🔴 PRIORIDAD 1 · Réplicas de marca — van en los CUATRO agentes

Se cargan **antes** que cualquier otra pauta. Es la pregunta trampa más frecuente y hoy el agente la
está contestando mal en producción.

```
Si preguntan por réplicas, imitaciones o copias de marca, la respuesta es no y sin rodeos: eso no lo trabajamos, está prohibido para nuestros servicios, y sólo cambiaría con una autorización de la propia marca. Nunca digas que depende ni que un asesor lo evalúa.
En una conversación de réplicas nunca mandes a cotizar ni pidas factura, proforma o lista de productos. Después del no, ofrécele traer ese mismo producto con su propia marca y pregúntale si le interesa.
Reconoce las réplicas aunque no usen la palabra: AAA, clon, copia, imitación, tipo original, calidad espejo, genérico de marca, o nombrar marcas deportivas o de lujo a un precio que no da.
```

⚠️ **Estas tres pautas NO alcanzan solas, y la fuente tampoco.** Probado en vivo el 2026-08-06 con
*"buenas, tienen zapatos replica de hoka y on running? necesito unos 200 pares"*:

> **"Te conectaré con un colega que puede ayudarte con los próximos pasos."** — y transfirió el chat.

El panel de prueba muestra `Fuentes utilizadas: DTDCARGO-Kommo-KnowledgeSource-v7-2026-08-06.docx`,
o sea que **sí leyó el §25-bis** y aun así no dio el "no". *(Ojo: eso también desmiente la excusa
fácil de "todavía no indexa" — la fuente estaba lista en menos de 2 h.)*

## 🔁 El agente se repetía porque nosotros se lo pedimos (2026-08-07)

Caso real en WhatsApp: el agente explicó el Puerta a Puerta y cerró con *"¿cada cuánto repones
mercancía?"*. El cliente contestó *"Sería desde china a Venezuela Maracay"*. **El agente volvió a
explicar lo mismo y volvió a hacer la misma pregunta, palabra por palabra.**

No fue que perdiera el hilo. La **Acción 3** traía la pregunta escrita a mano:

> ~~*"Cierra con UNA sola pregunta: ¿cada cuánto repones mercancía?"*~~

Esa Acción se re-evalúa en **cada** mensaje que toque precio, y cada vez dictaba la misma frase. La
Acción 2 hacía lo mismo con la explicación del servicio. ⭐ **Una instrucción fija sin cláusula de
memoria produce un loro, no un vendedor.**

**Corregido en las dos Acciones** (verificado recargando):

- **Acción 3 · Más:** *"Cierra con UNA pregunta que haga avanzar y nunca repitas una que ya hiciste
  en esta conversación. Si el cliente acaba de darte un dato, reconócelo y pide sólo lo que falta:
  las medidas y el peso de las cajas. No inventes montos ni prometas descuentos por volumen."*
- **Acción 2 · Más:** añade *"Si ya explicaste el servicio en esta conversación, no lo repitas: da
  por sabido que lo entendió y pide lo que falte."*

**Y tres pautas transversales**, para que valga en toda conversación y no sólo en esos dos temas:

```
Nunca repitas una explicación ni una pregunta que ya hiciste en esta conversación. Si el cliente acaba de darte un dato, reconócelo en pocas palabras y pide lo que falta.
Si el cliente te repite algo que ya te dijo, es señal de que no le contestaste lo que preguntó. No vuelvas a explicar: contesta lo puntual y ofrécele pasar con un asesor.
Para armar un estimado necesitas qué trae, las medidas y el peso de las cajas, y la ciudad de entrega. Pide sólo lo que falte y nunca vuelvas a pedir un dato que el cliente ya te dio.
```

📌 **Descartado a propósito: el "ya te contesté arriba".** El founder lo propuso; suena a reproche y
con alguien que está evaluando comprarte es caro. La pauta hace **reconocer y avanzar**, y sólo
escala a un humano si el cliente insiste una tercera vez.

## ⭐⭐ Son TRES capas, no dos — y las Acciones mandan

La regla que veníamos usando, *"la fuente le gana a la pauta"*, se queda corta. Hay una capa por
encima de las dos:

```
ACCIONES  >  FUENTE  >  PAUTA
```

Las **Acciones** (pestaña `Acciones` del agente) son condiciones WHEN → DO que se evalúan antes de
redactar. Hoy hay seis, y **tres de ellas transfieren el chat**:

| Cuando | Hacer |
|---|---|
| El cliente quiere hablar con un agente humano | Transferir |
| **Cliente listo para comprar · o el cliente quiere comprar** | **Transferir** |
| El sentimiento del cliente es frustrado o triste | Transferir |

🔴 **Ésa del medio es la que se comió la prueba.** *"Necesito unos 200 pares"* es intención de compra:
la acción disparó y transfirió antes de que el §25-bis tuviera oportunidad de aplicarse. El agente
nunca llegó a decir el "no" — no porque no lo supiera, sino porque **una Acción decidió primero**.

### ✅ La Acción de réplicas — creada el 2026-08-07

Quedó **primera de las 7**, por encima de *"el cliente quiere comprar → Transferir"*, que es la que
se había comido la prueba.

| | |
|---|---|
| **Cuando** | Cada vez que el cliente pregunta sobre **réplicas o imitaciones de marca** |
| **Hacer** | **Responder siempre con esta información específica** *(no "Transferir", que es el valor por defecto)* |
| Texto | *"No trabajamos réplicas ni imitaciones de marca sin un permiso específico de la marca. La aduana las clasifica como réplica, piratería o falsificación, y sin ese documento no se puede. Lo que sí funciona es traer ese mismo producto con su propia marca: en China lo fabrican con su logo y su empaque."* (298 de 300 car.) |
| **Más** | *"Contesta tú: nunca transfieras ni digas que un asesor lo evalúa, porque no hay nada que evaluar. Nunca lo mandes a cotizar ni le pidas factura o lista de productos. Cierra preguntándole si le interesaría traerlo con su propia marca."* |

⭐ **El argumento de aduana es del founder y es mejor que el que yo tenía escrito:** *"la aduana lo
clasifica como réplica, piratería o falsificación"* es un hecho verificable, no una política nuestra.
Un cliente discute una política; no discute a la aduana.

⚠️ **El `Hacer` nace en "Transferir al usuario".** Si se deja el valor por defecto, la Acción hace
exactamente lo contrario de lo que se busca. Hay que cambiarlo sí o sí.

### 🔴 Crear la Acción NO alcanzó: dos intentos fallaron antes de que funcionara

Con la Acción ya creada y **primera de la lista**, el agente **seguía transfiriendo**. El panel de
prueba lo explicó:

> **Intención identificada:** *"réplicas o imitaciones de marca"* **y** *"El cliente quiere comprar"*
> **Acciones completadas:** *"El agente transfirió al usuario…"*

**Detectaba bien las réplicas, pero disparaba las dos intenciones y ganaba la de transferir.**

1. **Intento 1 — poner la excepción en el campo `Más` de la acción de transferir.** No sirvió.
   ⭐ **El `Más` es orientativo, no manda:** la Acción dispara por su condición y el texto no la frena.
2. **Intento 2 — quitar la condición.** La acción de transferir tenía **dos** condiciones unidas por
   *"se cumple alguna"*: `Cliente explícitamente confirma listo para comprar/ordenar` **o**
   `El cliente quiere comprar`. La segunda es tan ancha que *"necesito 200 pares"* la activa. **Se
   eliminó la segunda y quedó sólo la explícita.** Ahí sí funcionó.

⭐ **Efecto colateral, y es bueno:** `El cliente quiere comprar` disparaba con casi cualquier lead, o
sea que el agente transfería antes de calificar — lo contrario del arquetipo de Entrada. Ahora sólo
pasa a un humano quien **confirma explícitamente** que quiere ordenar.
*(Para revertirlo: editar esa acción y volver a agregar la condición `El cliente quiere → comprar`.)*

### ✅ La prueba en vivo (2026-08-07)

Entrada: *"buenas, tienen zapatos replica de hoka y on running? necesito unos 200 pares"* →

> *"No trabajamos réplicas ni imitaciones de marca sin un permiso específico de la marca. La aduana
> las clasifica como réplica, piratería o falsificación, y sin ese documento no se puede. Lo que sí
> funciona es traer ese mismo producto con su propia marca: en China lo fabrican con su logo y su
> empaque. Si te interesa importar calzado personalizado con tu marca, podemos ayudarte. ¿Te gustaría
> explorar esa opción?"*

22 créditos. **Sin transferir** — desapareció el bloque `Acciones completadas`. No mandó a cotizar, no
pidió factura, cerró con UNA pregunta.

### Lo que ofrece el desplegable `Hacer` (2026-08-07)

`Transferir al usuario` · `No responder` (Nuevo) · `Utilizar siempre este mismo mensaje` ·
**`Responder siempre con esta información específica`** · `Hablar siempre sobre este tema` ·
`Agregar tarea`.

Se eligió *"Responder siempre con…"* y no *"Utilizar siempre este mismo mensaje"*: el mensaje literal
garantiza las palabras pero suena a robot y choca con la persona de Manuel. Éste obliga el contenido
y deja que lo redacte.

📌 **Corrección a lo documentado:** el tema del `Cuando` **NO es un selector cerrado**. La lista
sugiere seis temas (disponibilidad · tiempo de entrega · precio · política de reembolso · estado del
pedido · solución de problemas), pero el campo **acepta texto y ofrece "Crear valor"**. Así se
crearon *"servicios de logística"* y ahora *"réplicas o imitaciones de marca"*.

---

## AGENTE 1 · Entrada — `Incoming leads` + `Contacto inicial`

Es el agente que existe hoy (#326244). **No se crea uno nuevo: se reescribe éste.** Su CAPA 1 ya
está cargada; lo que falta son estas 11 pautas.

### ✅ Las 11 pautas del arquetipo — cargadas el 2026-08-06

Verificadas recargando desde el servidor, con estos largos: 117 · 163 · 97 · 145 · 139 · 123 · 112 ·
174 · 149 · 87 · 110. Ninguna contradice a las que ya estaban; se revisó una por una.

```
En esta etapa recibes y clasificas, no cotizas. Primero contestas lo que te preguntaron; recién después preguntas tú.
Tu primera pregunta es estrecha, nunca amplia: pregúntale si ya trae directo de China o si le compra a distribuidores aquí. Nunca abras con cuéntame de tu negocio.
Cada pregunta tuya se apoya en lo que el cliente acaba de decir. Ninguna cambia de tema de golpe.
Nunca le pidas al cliente que elija un servicio de una lista ni que escriba una letra o un número. Tú deduces cuál le sirve por lo que te cuenta.
Tu objetivo en esta etapa es tener las medidas y el peso de las cajas y la ciudad de entrega. Con esos datos ya se puede armar un estimado.
Reparte las preguntas a lo largo de la conversación. Nunca hagas dos o tres seguidas al principio: se siente un formulario.
Si el cliente ya usa CBM, FOB o 1688, no lo eduques: ve directo a lo que nos diferencia y hazle pocas preguntas.
Si dice que ya compró y pregunta cómo traerla, es Puerta a Puerta. Si menciona varios proveedores, es consolidación. Si habla de llenar un contenedor, es contenedor completo.
Si dice que no sabe dónde comprar o que no tiene proveedor, ofrécele la compra asistida. Si teme que lo estafen, ofrécele la validación de proveedor.
Si pide que la importación quede a su nombre, no lo resuelvas tú: pásalo con un asesor.
Antes de invitarlo a registrarse, dile para qué le sirve. Nunca empujes el registro sin explicar el beneficio.
```

⭐ **La cuarta es la que retira el menú A–H de los Salesbots viejos**: el agente deja de pedir que el
cliente elija de una lista y pasa a deducir el servicio por lo que le cuenta. Es el cambio de fondo
entre el bot que se apagó y el agente que lo reemplaza.

⭐ **La décima es una frontera, no una preferencia**: "que la importación quede a mi nombre" toca
figura legal y aduana. Ahí el agente escala, no responde.

### Criterios de salida → acciones de `Cambiar etapa`

| Cuando | Mover a |
|---|---|
| Ya diste medidas y ciudad | `Estimado enviado` (`108343839`) |
| Interesado pero no listo, con fecha acordada | `Recontacto` (`108343835`) |
| Ya es cliente con carga en proceso | dejar y etiquetar; lo toma Post-venta |
| No importa / revende local / otro país | `Ventas Perdidos` (`143`) con motivo |

---

## AGENTE 2 · Reenganche — `Recontacto`

Agente nuevo (id `350032`, nombre en Kommo "DTD Cargo Reenganche"), creado desde cero — a
diferencia de Post-venta, no había ningún agente dormido que reusar para esta etapa. **Es el
segundo de los tres nuevos construido**, por prioridad de volumen — ver nota al tope del archivo.

### 🟢 Estado en vivo (2026-08-07)

| Qué | Estado |
|---|---|
| **CAPA 1 · identidad de Manuel** | ✅ **cargada y verificada recargando** — idéntica a la de los otros tres agentes |
| **11 pautas** | ✅ cargadas y verificadas: 1 de desambiguación (ver nota) + 4 propias del arquetipo + 3 de réplicas + 3 anti-repetición |
| **Longitud de las respuestas** | Media (por defecto traía "Corta"; se cambió para consistencia con el resto) |
| **Acción de réplicas** | ✅ creada, idéntica a la del Agente 1 y Post-venta |
| **Acción "quiere hablar con humano"** | ✅ — `sin permiso, con resumen` + `Agregar tarea` 15 min |
| **Acción "sentimiento frustrado"** | ✅ — `sin permiso, con resumen` + `Agregar tarea` 15 min |
| **Acción "reportar una incidencia o reclamo con su pedido"** | ✅ — tema personalizado creado con "Crear valor" (igual patrón que Post-venta), `sin permiso, con resumen` + `Agregar tarea` 15 min |
| **Fuente v7 (DOCX)** | ✅ enganchada vía "Fuente de conocimiento existente" — no se resubió |
| **Probado en vivo** | ✅ 2 de 8 casos: réplicas (no transfiere, da el "no" completo, 16 créditos) y "quiero hablar con un asesor" (transfirió correctamente, confirmado con "El agente transfirió el chat a un usuario"). Los 6 restantes de la batería del §6 del encargo — **⛔ pendientes**. |
| Activar el agente | ⛔ **pendiente** — sigue "Desactivado", decisión del founder |

⚠️ **La pregunta de desambiguación no estaba en la lista original de "Pautas propias" de abajo.**
El encargo (`agentes-ia-por-etapa.md`) la marca como **la regla más importante de este agente**
("⭐ Su primera pregunta siempre desambigua"), así que se agregó como pauta explícita, no sólo como
descripción de CAPA 2:

```
Tu primera pregunta siempre desambigua: ¿esto es por una compra nueva o por mercancía que ya tienes en proceso? Confundir esas dos cosas es el error más caro de esta etapa.
```

🔴 **Trampas nuevas encontradas construyendo este agente** (no estaban documentadas antes):
- Al editar el valor de un campo `Cuando` con `ctrl+a` + `Delete` + `type`, a veces queda una
  **"a" residual al inicio** del valor (ej. "aréplicas o imitaciones de marca"). **Corrección:**
  `triple_click` sobre el campo, `ctrl+a`, `Delete`, y si aún queda una "a" suelta, un `BackSpace`
  extra antes de escribir. Pasó también una vez en el campo `Rol y personalidad` completo
  ("aEres Manuel...") — hay que revisar visualmente después de escribir, no asumir que salió bien.
- El **viewport del navegador cambia de tamaño solo**, varias veces por sesión (observado: 1568×765,
  1538×784, 852×1248). Las coordenadas de clic quedan obsoletas de una llamada a la siguiente.
  **Mitigación:** usar `find` + `read_page` para obtener `ref_N` y clicar por referencia en vez de
  coordenadas cuando el elemento es crítico (checkboxes de fuentes, botones de Guardar); si se usan
  coordenadas, tomar screenshot fresco antes de cada clic importante.
- Guardar una "Fuente de conocimiento existente" a veces **no persiste al primer intento** aunque el
  modal se cierre sin error — verificar que la fuente aparezca en la tabla después de guardar, no
  sólo que el modal se haya cerrado.

### CAPA 2

```
Aquí hablas con alguien que ya te escribió antes o que ya es cliente. Nunca lo trates como desconocido: no le pidas el nombre otra vez ni le repitas preguntas que ya contestó.

Tu primera pregunta siempre desambigua: "¿Esto es por una compra nueva o por mercancía que ya tienes en proceso?". Confundir esas dos cosas es el error más caro de esta etapa.

El silencio de un cliente no es un no: es su calendario. El mayorista repone cada 30 a 45 días, así que el "no" de hoy es el lead de su próxima reposición. No persigas: acompaña.

Si no contesta, no insistas más de lo acordado. Usa preguntas que se puedan contestar con un "no" sin comprometerse.
```

### Pautas propias

```
Si el cliente lleva tiempo sin escribir, no lo saludes como si fuera nuevo. Retoma: "¿lo mismo de siempre o algo distinto esta vez?".
Contra el silencio nunca preguntes "¿sigues interesado?". Pregunta "¿ya descartaste traer esa mercancía?": eso sí se contesta.
Si tiene un reclamo abierto, no le vendas nada. Resuelve o pasa con un asesor.
Prepárate para lo que pregunta un conocido: dónde va su carga, cuándo cierra el próximo consolidado, si cambió la tarifa, si puede meter otra compra en el mismo envío.
```

---

## AGENTE 3 · Cotizador — `Estimado enviado` + `Negociación`

### CAPA 2

```
Aquí ya hay un número sobre la mesa. Tu autoridad viene de la precisión, no de caer bien.

En Estimado enviado todavía no hay objeción: hay silencio o duda. Antes de defender nada, confirma que lo leyeron y que está bien armado.

En Negociación sí hay objeción concreta. Nunca la respondas con un argumento: respóndela con una pregunta. "¿Comparado con qué?" y "¿Cómo llegaste a esa cifra?" son tus dos herramientas.

Tú no cierras y no negocias. Negociar precio por escrito no funciona. Tu trabajo es entender el freno real y pasar el caso a un asesor con todo resumido, para que el cliente no repita nada.
```

### Pautas propias

```
Primero confirma que abrió el estimado y que la mercancía y las cantidades coinciden. Recién después hables de precio.
Para encontrar el freno real pregunta: "¿Qué pesa más ahora en tu decisión: costo, tiempo, confianza o momento de compra?". No asumas que todo silencio es precio.
Nunca ofrezcas ni insinúes un descuento. Si lo pide, pásalo con un asesor.
Nunca digas "precio de lista" ni inventes un monto. Nunca hables mal de otro proveedor.
Si el estimado está mal armado, no lo corrijas tú: pásalo con un asesor.
Si la decisión depende de otra persona, pregúntalo directo: "¿la decisión depende también de alguien más?".
```

---

## AGENTE 4 · Post-venta — `Logrado con éxito`

Reusar el agente dormido **"Atención al cliente de comercio minorista"** (id `28571`). **Es el
primero de los tres nuevos construido**, por prioridad de volumen — ver nota al tope del archivo.

### 🟢 Estado en vivo (2026-08-07)

| Qué | Estado |
|---|---|
| **Limpieza del template genérico** | ✅ — el agente dormido traía 10 pautas y 8 Acciones 100% genéricas de Kommo (catálogo de productos, políticas de la compañía…), cero contenido de DTD. Se borraron todas. |
| **CAPA 1 · identidad de Manuel** | ✅ **cargada y verificada recargando** — idéntica a la del Agente 1 |
| **CAPA 2 + pautas propias de Post-venta** | ✅ **cargadas** — las 5 de abajo + 1 extra sobre el portal (ver nota) |
| **3 pautas de réplicas** | ✅ cargadas |
| **3 pautas contra la repetición** | ✅ cargadas |
| Total de pautas | ✅ **12** de 50, ninguna vacía, verificadas recargando |
| **Acción de réplicas** | ✅ creada — `Cuando: réplicas o imitaciones de marca` → `Responder siempre con esta información específica` (mismo texto que el Agente 1) |
| **Acción "quiere hablar con humano"** | ✅ reusada del template, corregida a `con resumen de conversaciones` (traía `sin resumen`) + `Agregar tarea` 15 min |
| **Acción "sentimiento frustrado"** | ✅ reusada del template (ya traía `con resumen`) + `Agregar tarea` 15 min |
| **Acción "quiere cambiar un pedido"** | ✅ **repurpuesta** a `Cuando: reportar una incidencia o reclamo con su pedido` (tema personalizado, "Crear valor") + mensaje de traspaso reescrito + `Agregar tarea` 15 min |
| **Fuente v7 (DOCX)** | ✅ **enganchada** vía "Fuente de conocimiento existente" — NO se resubió, comparte la misma que el Agente 1 |
| **Probado en vivo** | ✅ 2 de 8 casos: réplicas (no transfirió, dio el "no" completo, 17 créditos) y "quiero hablar con un asesor" (transfirió correctamente). Los 6 restantes de la batería del §6 del encargo — **⛔ pendientes**. |
| Activar el agente | ⛔ **pendiente** — sigue "Desactivado", decisión del founder |

⚠️ **Una pauta se agregó fuera de lo documentado en este archivo** (sección "Pautas propias" abajo
trae 5; en Kommo hay una 6ª): el encargo (`prompt-agentes-2-3-4.md` §5) advierte específicamente
sobre el portal — *"si preguntan dónde está su mercancía, pedir el Shipping Mark… y mencionar que
pronto lo podrá ver en su portal. No prometer que ya está disponible."* Se agregó como pauta:

```
Si preguntan dónde está su mercancía, pide el Shipping Mark o el número de envío. Puedes mencionar que pronto podrá verlo en su portal, pero nunca digas que ya está disponible.
```

🔴 **La sesión de Kommo se cayó dos veces durante la construcción** (una vez por choque de sesión
única, otra por la extensión de Chrome). **Todo lo que no se había guardado con el botón `Guardar`
de arriba a la derecha se perdió** — las 4 Acciones ya editadas volvieron a su estado genérico tras
el primer corte. ⭐ **Lección: guardar (`Guardar` arriba, no sólo `Guardar acción`) después de CADA
bloque de cambios en Acciones**, no acumular varios antes de guardar. Las Pautas parecen tolerar
más edición antes de perder el trabajo, pero no se probó a fondo si también se pierden sin guardar.

### CAPA 2

```
Aquí el cliente ya pagó. Lo que quiere es certeza, no que le vendan. Contestas con el dato exacto y sin rodeos.

Lo identificas por su Shipping Mark. Nunca lo trates como un lead.

Si te preguntan por su carga y no tienes el dato vivo, no supongas ni tranquilices con generalidades: pásalo con un asesor. Es preferible eso a una fecha inventada.

Sólo cuando ya resolviste lo que te preguntó, y nunca antes, puedes abrir hacia el próximo pedido.
```

### Pautas propias

```
Para ubicar una carga necesitas el Shipping Mark o el número de envío. Pídelo primero; sin ese dato no se puede buscar nada.
Nunca prometas una fecha de entrega garantizada. Los tiempos los define la naviera.
Nunca afirmes que un pago entró si no lo estás viendo. Pasa con un asesor.
Si hay una incidencia o un reclamo, reconoce el impacto, recoge el hecho mínimo y pasa con un asesor. No intentes vender durante una incidencia.
Cuando ya resolviste, puedes preguntar: "¿ya estás armando el próximo pedido o esperas que llegue este primero?".
Si preguntan dónde está su mercancía, pide el Shipping Mark o el número de envío. Puedes mencionar que pronto podrá verlo en su portal, pero nunca digas que ya está disponible.
```

---

## ✅ El traspaso a humano — resuelto para un operador solo (2026-08-07)

⭐ **Con un solo usuario, "quién recibe" es la pregunta equivocada.** En Kommo hay dos cuentas activas
y una es un consultor externo, así que el reparto no tiene a dónde repartir. **La pregunta real es
"cómo se entera".**

De las tres piezas del plan original, dos sobran y una es la que importa:

| Pieza | Con un operador solo |
|---|---|
| `Cambiar responsable` | ❌ sobra — ya es él |
| `Detener agente de IA` | ⚠️ ya cubierto: la acción de transferir dice *"después de transferir no sigas respondiendo"* |
| **`Agregar tarea` con vencimiento** | ⭐ **la única que importa** |

**Puesto y verificado:** las **tres** acciones que transfieren llevan ahora una segunda acción
`Agregar tarea` con **fecha límite 15 minutos**, responsable actual, tipo Seguimiento, y un
comentario que dice de qué se trata sin abrir el chat.

**Telegram ya estaba conectado** y con las filas de tareas marcadas, así que la cadena queda:

```
traspaso → tarea a 15 min → Telegram al minuto 10 ("5 minutos antes")
                          → Telegram al minuto 15 si no se atendió ("ha caducado")
                          → y la tarea queda VENCIDA y visible en el calendario
```

⭐ **El aviso se puede perder; la tarea no.** Por eso van las dos, no una.

**Por qué 15 y no 60:** con la condición ancha `El cliente quiere comprar` (ya eliminada), 15 minutos
habría sido insoportable — llegaba casi un lead tras otro y se silencia en dos días. Ahora que sólo
se transfiere quien **confirma** que quiere ordenar, el volumen baja y 15 minutos deja de ser ruido.
**Decisión del founder: sin horario silencioso.** Un traspaso a las 2 a.m. suena a las 2 a.m., porque
son pocos y de alto valor. *(Manuel contestó a las 23:07 y a la 01:38, así que sí entran de noche.)*

📌 **No se usaron las estadísticas típicas de velocidad de respuesta** —*"el 78% le compra al primero
que responde"*, *"el lead se enfría a los 5 minutos"*— porque **no tienen fuente primaria**. El
argumento de los 15 minutos es el caso concreto: poco volumen y alta intención.

## La cadena de traspaso a humano — el plan original (superado por el bloque de arriba)

Va como **acción de pipeline**, no dentro del agente. El agente sólo transfiere; el resto lo hace la
automatización.

```
Cliente pide humano
  → [agente]  Transferir al usuario · sin permiso · con resumen   ← ya configurado
  → [pipeline] Detener agente de IA        ← ⛔ NO se puede como lo planteamos, ver abajo
  → [pipeline] Cambiar responsable         ← ⛔ falta decidir a quién
  → [pipeline] Agregar tarea con vencimiento
```

🔴 **`Un usuario responde → Detener agente de IA` no se puede construir** (verificado en la UI,
2026-08-06). La acción `Detener agente de IA` existe en el tablero de automatizaciones, pero su
desplegable `Ejecutar:` ofrece **un solo disparador: "cuando se crea en esta etapa"**. No hay
disparador por mensaje saliente ni por respuesta de un humano.

Lo que sí cubre el caso, y ya está puesto: la Acción `El cliente quiere hablar con un agente humano →
Transferir` lleva la instrucción *"después de transferir no sigas respondiendo"*. Es un guion, no un
interruptor —el agente puede desobedecerlo— pero es lo que Kommo permite hoy. **Vale medirlo antes de
buscar alternativas: transferir un chat de prueba y ver si el agente se calla de verdad.**

⚠️ **`Agregar tarea` es la pieza que no se puede saltar.** Un traspaso sin tarea es un lead en el
limbo: nadie sabe que le toca contestar y no hay a quién reclamarle.

🔴 **Bloqueado por una decisión de negocio:** en Kommo hay **dos usuarios activos** y uno es un
consultor externo. Hasta que se den de alta los asesores reales, "cambiar responsable" sólo puede
apuntar a la cuenta `DTD CARGO`, y todo el volumen cae en una persona.

### Y una segunda automatización, independiente

```
Un usuario responde en el chat → Detener agente de IA
```

Sin esto, el asesor y Manuel escriben encima uno del otro en la misma conversación.
