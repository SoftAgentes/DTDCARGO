# Runbook — Sumarle el canal Instagram/Facebook a un agente de IA de Kommo

> **Qué es:** el paso a paso para que uno de los agentes de IA de Kommo deje de atender sólo
> WhatsApp y atienda también los mensajes que entran por Instagram y Facebook — que son el **32% de
> la captación** y hoy **no crean tarea de seguimiento**, así que esas tarjetas nunca se ponen rojas.
>
> **Cuenta:** `dtdcargo.kommo.com` (id `31589859`) · pipeline **Ventas DTD** (`14036567`) ·
> pantalla: `/settings/ai-agent/`.
>
> 🔴 **Lo que este documento NO es: una medición de producción de hoy.** Se escribió el
> **2026-08-24** contra lo que dice el repo, **sin sesión de Kommo**. Los números más frescos que se
> citan son del **10, 11, 13 y 14 de agosto**. Todo lo que dependa del estado de hoy —empezando por
> el saldo de créditos— está marcado como **no medido** y hay que mirarlo en pantalla antes de tocar
> nada.
>
> **Antes de empezar, lee dos secciones en este orden:** [§5 el semáforo](#5--el-semáforo-hazlo-o-no-lo-hagas-ahora)
> (¿hay créditos?) y [§6 a qué agente](#6-a-qué-agente-sumárselo-y-por-qué) (¿a cuál?).
>
> Relacionados: [`../marketing/kommo-estado-y-pendientes.md`](../marketing/kommo-estado-y-pendientes.md) ·
> [`../marketing/kommo-consumo-y-limites.md`](../marketing/kommo-consumo-y-limites.md) ·
> [`../marketing/instagram-entrada.md`](../marketing/instagram-entrada.md) ·
> [`kommo-reconfig.md`](kommo-reconfig.md)

---

## 1. Qué resuelve y qué NO resuelve

### El mecanismo, en una línea

Sumarle el canal al agente hace que el agente **atienda** los mensajes de ese canal. El efecto que
se busca no es la respuesta en sí: es que, al atenderlos, **se evalúe la acción `Agregar tarea`** que
ya está cargada en los 4 agentes — y **la tarea vencida es lo que enciende el rojo de la tarjeta**.

```
mensaje de IG/FB → el agente lo atiende (porque el canal está en su lista)
                 → se dispara la Acción "El mensaje es recibido en horas específicas: Siempre"
                 → Agregar tarea · Fecha límite: Ahora
                 → la tarea nace vencida → la tarjeta se pone ROJA
```

⭐ **El rojo de las tarjetas es el semáforo de TAREAS, no de mensajes.** Verificado el 2026-08-10
ampliando tarjetas: las rojas dicen `1d` (tarea vencida hace 1 día); las demás dicen *"No hay
tareas"* y se quedan grises para siempre aunque el cliente escriba cinco veces
([`kommo-estado-y-pendientes.md:127-129`](../marketing/kommo-estado-y-pendientes.md)).

⭐ **La acción vive DENTRO del agente, no en el pipeline.** Por eso no hay forma de encender el rojo
en un canal sin que un agente atienda ese canal. El camino del pipeline está cerrado — ver §3,
trampa 6 ([`kommo-estado-y-pendientes.md:174-177`](../marketing/kommo-estado-y-pendientes.md)).

### ✅ Lo que sí resuelve

| | |
|---|---|
| Los mensajes de IG/FB dejan de entrar sin dejar rastro accionable | crean tarea → **tarjeta roja** |
| El 32% de la captación entra al mismo circuito de atención que WhatsApp | 72 de 226 contactos nuevos en 30 días, medido 2026-08-10 |
| El cliente recibe una primera respuesta con la voz de Manuel | en vez de copy de campaña pegado a mano |
| Lo que se conteste queda **atribuido y trazado en el lead** | hoy, respondiendo desde la app de Instagram, entra sin autor y Kommo lo firma `SalesBot:` |

### ❌ Lo que NO resuelve — y hay que decirlo antes, no después

1. **No compra créditos.** Si el agente está sin saldo, sumarle un canal **no enciende nada**: el
   agente queda mudo igual que en WhatsApp. Es la razón de ser del §5.
2. **No cubre las etapas del resto del embudo.** Si el canal se le suma sólo al agente de Entrada
   (la recomendación del §6), un lead de IG/FB que avance a `Estimado enviado`, `Negociación`,
   `Recontacto` o `Logrado con éxito` **vuelve a quedarse sin agente y sin tarea** en esas etapas.
   Kommo avisa en la propia pantalla de Ajustes que *"una vez que el agente inicia una conversación,
   continuará incluso si cambia la etapa"*
   ([`../marketing/agentes-ia-por-etapa.md:33`](../marketing/agentes-ia-por-etapa.md)), o sea que una
   conversación **ya empezada** sobrevive al cambio de etapa — pero una conversación **nueva** en
   otra etapa, no.
3. **No arregla las tarjetas en blanco.** Los contactos de IG/FB entran **sin teléfono** y muchas
   veces **sin nombre**; la tarjeta se diseñó para mostrar `Contacto: Nombre` + `Contacto: Teléfono`
   ([`kommo-estado-y-pendientes.md:39-44`](../marketing/kommo-estado-y-pendientes.md) y
   [`:351-354`](../marketing/kommo-estado-y-pendientes.md)). Seguirán viéndose vacías.
4. **No le pide el WhatsApp al cliente.** Si se quiere que Manuel capture el número en IG/FB, eso es
   una **pauta nueva** en el agente — trabajo aparte, y toca el guion que hoy comparten los cuatro.
5. **No toca los 4 bots de ping de 23 h.** Esos son Salesbots filtrados **por etapa**, no por canal
   ([`../marketing/kommo-consumo-y-limites.md:163-182`](../marketing/kommo-consumo-y-limites.md)).
   ⚠️ **No medido:** si disparan o no sobre conversaciones de IG/FB, y si la ventana de 24 h de
   Meta se comporta como la de WhatsApp. No lo asumas en ninguna dirección.
6. **No coordina con la automatización de Meta.** La automatización *"Respuesta a comentario -
   Comentarios · info y precio"* ya manda un DM de apertura desde Meta Business Suite
   ([`../marketing/instagram-entrada.md:236-252`](../marketing/instagram-entrada.md)). Con Manuel en
   el canal, el cliente puede recibir **el DM automático de Meta y encima el mensaje de Manuel**.
   La regla vigente es *"la automatización abre, la persona continúa"*; con un agente en el medio
   hay que decidirla de nuevo.
7. **No cubre a quien responde a mano desde la app de Instagram.** Eso lo hace una persona del
   equipo, no un sistema, y se sigue haciendo salvo que se le pida al equipo que conteste desde
   Kommo ([`../marketing/instagram-entrada.md:203-228`](../marketing/instagram-entrada.md)).
8. **No crea tareas retroactivas.** Los leads de IG/FB que ya están en el tablero sin tarea siguen
   grises. La acción se evalúa sobre mensajes **entrantes nuevos**.
9. **No tiene nada que ver con el write-back del Shipping Mark.** Esa es otra cadena
   ([`kommo-estado-y-pendientes.md:258-283`](../marketing/kommo-estado-y-pendientes.md)).

---

## 2. El paso a paso, clic por clic

> **Convención de este documento:** los rótulos entre comillas o en `código` están **verificados en
> el repo** con su cita `archivo:línea`. Donde el repo no tiene el rótulo, dice
> **⚠️ rótulo no verificado en el repo — confirmar en pantalla**. No los inventé: prefiero un hueco
> declarado a un runbook que suene completo y te haga clic en el botón equivocado.

### Paso 0 · Antes de abrir Kommo

- [ ] **Que nadie más tenga Kommo abierto.** 🔴 **Kommo admite una sola sesión a la vez**: cada vez
      que el founder abre el CRM expulsa la del agente, y al revés. Costó cuatro rondas
      ([`../marketing/kommo-consumo-y-limites.md:196-198`](../marketing/kommo-consumo-y-limites.md)).
      El 10-ago se vieron **5 sesiones activas** del usuario `DTD CARGO`
      ([`kommo-estado-y-pendientes.md:220-223`](../marketing/kommo-estado-y-pendientes.md)).
- [ ] **Mirar el saldo primero** → §5. Sin créditos, todo lo demás es decorado.
- [ ] **Decidir a qué agente** → §6.

### Paso 1 · Comprobar el saldo de créditos

`Ajustes → Facturación` → **`Facturación → Uso → Gestionar créditos`**
([`kommo-estado-y-pendientes.md:25`](../marketing/kommo-estado-y-pendientes.md) y
[`:76`](../marketing/kommo-estado-y-pendientes.md)).

Ahí está el desglose por función (**Agente de IA · Vista previa del agente · Respuestas sugeridas
con IA · Reescritor y resúmenes · Copilot · Fuentes**). Si la línea **Agente de IA** ya se comió el
plan, **para acá**. Detalle y criterio en §5.

### Paso 2 · Abrir el agente

1. Ir a **`/settings/ai-agent/`**
   ([`../marketing/agentes-ia-configuracion.md:20`](../marketing/agentes-ia-configuracion.md)).
2. En el listado, mirar la columna **`CANALES`**
   ([`../marketing/agentes-ia-configuracion.md:34`](../marketing/agentes-ia-configuracion.md)) —
   hoy los cuatro agentes muestran un solo canal: **`Importador de China`** (WhatsApp). Esa es tu
   línea base: anótala antes de tocar nada.
3. Abrir **`DTD Cargo asistente de ventas`** (id `326244`)
   ([`kommo-estado-y-pendientes.md:98`](../marketing/kommo-estado-y-pendientes.md)).

### Paso 3 · Sumar el canal

1. Ir a la pestaña **`Ajustes`** del agente
   ([`../marketing/agentes-ia-configuracion.md:201`](../marketing/agentes-ia-configuracion.md),
   [`kommo-estado-y-pendientes.md:198`](../marketing/kommo-estado-y-pendientes.md)).
   ⚠️ **rótulo no verificado en el repo — confirmar en pantalla:** el nombre de la **sección**
   dentro de `Ajustes` donde viven los canales (¿"Canales"?). El repo sólo documenta el control de
   abajo, no el encabezado.
2. Clic en **`+ Añadir canal`**
   ([`../marketing/agentes-ia-configuracion.md:199`](../marketing/agentes-ia-configuracion.md)).
3. 🔴 **El listado trae tres opciones y dos se llaman IGUAL:** `Whu Dragon Chino` ×2 e
   `Importador de China`. **No se distingue Instagram de Facebook por el nombre.** Así se confirmó
   cuál era el de WhatsApp en su momento: **revisando `Ajustes` del Agente 1, que ya funcionaba en
   producción — no adivinando por el nombre**
   ([`../marketing/agentes-ia-configuracion.md:199-202`](../marketing/agentes-ia-configuracion.md)).
   ⚠️ **Ese listado se leyó el 2026-08-07, y el 2026-08-10 se renombraron las 5 fuentes de leads** a
   **Instagram Messenger · Comentarios Instagram · Messenger Facebook · Comentarios Facebook ·
   WhatsApp** ([`kommo-estado-y-pendientes.md:46-49`](../marketing/kommo-estado-y-pendientes.md)).
   **Fuentes y canales son listas distintas** — el picker de canales mostraba 2 entradas de
   `Whu Dragon Chino` mientras las fuentes eran 4. **No está medido si el picker de canales muestra
   hoy los nombres nuevos.** Míralo antes de elegir.
4. ⚠️ **rótulo no verificado en el repo — confirmar en pantalla:** si al elegir el canal aparece un
   diálogo de confirmación, y con qué texto y qué botones.
5. ⚠️ **rótulo no verificado en el repo — confirmar en pantalla:** si Instagram y Facebook son **dos
   canales separados** (dos entradas a sumar) o **uno solo**. Las 2 entradas homónimas del picker
   sugieren dos, pero eso es una inferencia, no una medición.

### Paso 4 · Guardar

🔴 **Leer el rótulo del botón de arriba a la derecha ANTES de hacer clic.** Sin cambios pendientes
dice **"Desactivar agente"**; con cambios, **"Guardar"**. **Están en la misma coordenada**, y hacer
clic a ciegas ahí ya abrió el diálogo *"¿Desactivar tu agente de IA?"* **en producción**
([`kommo-estado-y-pendientes.md:179-182`](../marketing/kommo-estado-y-pendientes.md)).

### Paso 5 · Verificar recargando (no basta con que desaparezca `Guardar`)

Que el botón `Guardar` desaparezca **no prueba nada**
([`../marketing/agentes-ia-configuracion.md:236`](../marketing/agentes-ia-configuracion.md);
[`../marketing/kommo-consumo-y-limites.md:47`](../marketing/kommo-consumo-y-limites.md)).

- [ ] Recargar la página.
- [ ] Volver a `/settings/ai-agent/` y comprobar que la columna **`CANALES`** del agente ahora
      muestra **los dos** (o los tres) canales.

### Paso 6 · Comprobar que la acción de la tarea sigue en pie

Pestaña **`Acciones`** del agente
([`../marketing/agentes-ia-configuracion.md:355`](../marketing/agentes-ia-configuracion.md)).
Tiene que estar, tal cual
([`kommo-estado-y-pendientes.md:145-151`](../marketing/kommo-estado-y-pendientes.md)):

```
Cuando  El mensaje es recibido en horas específicas: Siempre
Hacer   Agregar tarea · Fecha límite: Ahora · Usuario responsable: Responsable actual
        Tipo: Seguimiento · Comentario: "Responder al cliente"
```

⭐ **`El mensaje es recibido en horas específicas` con valor `Siempre` es la llave**: es la única
condición del catálogo que se dispara con **todos** los mensajes entrantes; las demás van por
intención (*el cliente quiere*, *pregunta sobre*, *el sentimiento es*…)
([`kommo-estado-y-pendientes.md:140-143`](../marketing/kommo-estado-y-pendientes.md)).

⭐ **`Fecha límite: Ahora`, no 2 horas.** Corregido el 11-ago tras probarlo: con 2 h la tarjeta se
quedaba verde dos horas y el rojo llegaba cuando ya no servía. Con `Ahora` la tarea nace vencida y
la tarjeta se pone roja apenas el cliente escribe
([`kommo-estado-y-pendientes.md:153-156`](../marketing/kommo-estado-y-pendientes.md)).

### Paso 7 · Comprobar el techo de gasto

`Ajustes → Límites de conversación` (la sección va marcada `Nuevo`) →
**`Límite de mensajes`** y **`Límite de créditos`**
([`../marketing/kommo-consumo-y-limites.md:35-36`](../marketing/kommo-consumo-y-limites.md);
[`kommo-estado-y-pendientes.md:108-109`](../marketing/kommo-estado-y-pendientes.md)).

- [ ] `Límite de mensajes` = **2**. Los cuatro agentes quedaron en 2 el 2026-08-13, verificados
      recargando ([`../marketing/kommo-consumo-y-limites.md:38-47`](../marketing/kommo-consumo-y-limites.md)).
      ⚠️ **No medido hoy.** Si alguien lo subió, el gasto del canal nuevo se multiplica: con el
      límite en 20 *"un solo lead conversador se comía ~400 créditos"*.

📌 Kommo lo dice en la propia pantalla: *"Cuando se alcance un límite, la conversación **se
transferirá al usuario** y **se omitirán todas las demás acciones del agente**"*
([`../marketing/kommo-consumo-y-limites.md:56-57`](../marketing/kommo-consumo-y-limites.md)). O sea
que a la 2ª respuesta el agente transfiere y se va — no se calla un rato.

### Paso 8 · La prueba de verdad

🔴 **La `Vista previa del agente de IA` NO sirve para esta prueba.** Verificado el 2026-08-07 en
`Calendario → Todos los eventos`: **0 tareas** pese a haber disparado `Agregar tarea` más de una
decena de veces. El preview simula costo y texto, pero **no ejecuta los efectos secundarios** (tarea,
Telegram) ([`../marketing/agentes-ia-configuracion.md:145-152`](../marketing/agentes-ia-configuracion.md)).
Y encima **cuesta**: 1.345 créditos del ciclo de agosto se fueron ahí, ~50-70 respuestas
([`kommo-estado-y-pendientes.md:81`](../marketing/kommo-estado-y-pendientes.md) y
[`:88`](../marketing/kommo-estado-y-pendientes.md)).

La única prueba que vale es un **mensaje real**:

- [ ] Que alguien mande un DM desde una cuenta de Instagram **que no sea del equipo**.
- [ ] Comprobar en el hilo del lead que **contesta Manuel** (no un `SalesBot:` sin autor).
- [ ] Comprobar que **la tarjeta se pone roja**.
      ⚠️ **rótulo no verificado en el repo — confirmar en pantalla:** el texto del chip de la
      tarjeta con `Fecha límite: Ahora`. El repo sólo documenta `1d` para una tarea vencida hace un
      día ([`kommo-estado-y-pendientes.md:128`](../marketing/kommo-estado-y-pendientes.md)); qué
      muestra una tarea recién vencida no está medido.
- [ ] Comprobar que **llega el aviso de Telegram** al usuario `DTD CARGO`. La cadena está confirmada
      **por configuración** (las 4 filas de `Tareas:` con Telegram marcado en
      `Ajustes → Configuración del perfil`), no por una tarea real observada en este canal
      ([`../marketing/agentes-ia-configuracion.md:153-171`](../marketing/agentes-ia-configuracion.md)).

### Paso 9 · Volver a mirar el saldo a las 24-48 h

- [ ] `Facturación → Uso → Gestionar créditos` → mirar cuánto subió la línea **Agente de IA**.
- [ ] Comparar contra el rango del §4. Si va más rápido, la palanca es `Límite de mensajes`, no
      recargar.

### Rollback

Quitarle el canal al agente en la misma pantalla del Paso 3 y volver a `Guardar`.
⚠️ **rótulo no verificado en el repo — confirmar en pantalla:** el control para **quitar** un canal
ya asignado (¿una ✕ en el chip? ¿un menú?). El repo documenta cómo añadir, no cómo quitar.

⚠️ El rollback **no devuelve** los créditos gastados ni borra las tareas ya creadas.

---

## 3. Las trampas ya documentadas que aplican a esta pantalla

Ninguna de éstas es teórica: todas costaron tiempo o pasaron en producción.

### 🔴 1. El botón de arriba a la derecha alterna "Desactivar agente" / "Guardar" en la MISMA coordenada

Sin cambios pendientes dice **"Desactivar agente"**; con cambios, **"Guardar"**. Hacer clic a ciegas
ahí **abrió el diálogo *"¿Desactivar tu agente de IA?"* en producción**. **Verificar el rótulo antes
de cada clic** ([`kommo-estado-y-pendientes.md:179-182`](../marketing/kommo-estado-y-pendientes.md)).

### 🔴 2. El desplegable de *Hacer* viene por defecto en "Transferir al usuario"

Dejarlo así haría que el agente **transfiriera en cada mensaje**. Hay que cambiarlo a **"Agregar
tarea"** — y **el clic tiene que caer sobre el texto de la opción, no al borde**, o el desplegable se
cierra sin aplicar y parece que no pasó nada
([`kommo-estado-y-pendientes.md:165-168`](../marketing/kommo-estado-y-pendientes.md)).

*(Aplica si tocas la Acción del Paso 6. Si sólo sumas el canal, no deberías abrirla — pero es
exactamente el desplegable que uno abre "para verificar" y sale mal.)*

### 🔴 3. El campo de condición nace VACÍO, y vacío = TODAS las etapas

Documentado al armar los Salesbots del ping de 23 h: *"El campo de condición nace VACÍO en cada bot
nuevo, y vacío = TODAS las etapas. No es sólo cosa de la plantilla: pasa también empezando desde
cero. Revisarlo antes de guardar, siempre"*
([`../marketing/kommo-consumo-y-limites.md:186-187`](../marketing/kommo-consumo-y-limites.md)).

Lo que costó ahí: sin condición, el bot le escribía a **2.796 leads perdidos** y **244 ganados**.

⚠️ **Alcance honesto:** el repo lo midió en el editor de **Salesbots**, no en el de agentes de IA.
Trátalo como una regla de la casa —**revisar todo campo de condición antes de guardar**— no como un
hecho medido en esta pantalla.

### 🔴 4. En el selector de etapas hay que hacer clic en la ETIQUETA, no en la casilla

*"Clicando la casilla la lista se cierra sin marcar nada y el siguiente clic cae en el control de
abajo — así se cambió `Horas activas` a 'Lu-Sá 09:00-19:00' sin querer. Clicando el texto, la lista
se queda abierta y se pueden marcar varias"*
([`../marketing/kommo-consumo-y-limites.md:188-192`](../marketing/kommo-consumo-y-limites.md)).

⚠️ Mismo alcance que la trampa 3: medido en Salesbots. Si tienes que tocar
`Ajustes → "Lanzar agente de IA"` (las etapas del agente), asume que se comporta igual.

### 🔴 5. Que `Guardar` desaparezca no prueba nada — verificar recargando

Regla repetida en tres documentos distintos
([`../marketing/agentes-ia-configuracion.md:236`](../marketing/agentes-ia-configuracion.md);
[`../marketing/kommo-consumo-y-limites.md:47`](../marketing/kommo-consumo-y-limites.md);
[`kommo-estado-y-pendientes.md:55`](../marketing/kommo-estado-y-pendientes.md)).

Peor todavía: el 2026-08-06 una caída de sesión se llevó **todo lo que no se había guardado con el
botón `Guardar` de arriba** — `Guardar acción` solo no alcanza
([`../marketing/agentes-ia-configuracion.md:637-639`](../marketing/agentes-ia-configuracion.md)).

### 🔴 6. "Cannot run two different agents in the same status" — y las etapas NO se editan desde el pipeline

Kommo **rechaza cualquier disparador nuevo** en las etapas declaradas por un agente. Pasó **dos
veces** en `Contacto inicial`
([`kommo-estado-y-pendientes.md:184-191`](../marketing/kommo-estado-y-pendientes.md)).

⭐ **Las etapas se declaran en el agente, pestaña `Ajustes → "Lanzar agente de IA"`** — no en el
pipeline. La banda ancha que se dibuja bajo las columnas **es el reflejo de eso**, no una regla
editable aparte ([`kommo-estado-y-pendientes.md:198-200`](../marketing/kommo-estado-y-pendientes.md)).

**Por qué importa acá:** es la razón por la que la tarea automática vive dentro del agente. **No hay
un atajo por el pipeline** para encender el rojo en IG/FB sin pasar por un agente. Y
`Un usuario responde → Detener agente de IA` **no existe**: ese disparador ofrece una sola opción,
*"cuando es movido a esta etapa"*
([`kommo-estado-y-pendientes.md:209-210`](../marketing/kommo-estado-y-pendientes.md)).

### 🔴 7. Kommo admite una sola sesión a la vez

*"Cada vez que el founder abre el CRM por su lado, expulsa la del agente — y al revés. Costó cuatro
rondas"* ([`../marketing/kommo-consumo-y-limites.md:196-198`](../marketing/kommo-consumo-y-limites.md)).

### ⚠️ 8. Escribir en los campos: teclear de verdad, y `Tab` antes de guardar

Si vas a editar cualquier texto (una pauta, un comentario de tarea):

1. **`+ Añadir …` con un clic real** — es lo que marca el formulario como sucio y hace aparecer
   `Guardar`. Rellenar por script un campo que ya existía **no ensucia nada**.
2. **Teclear de verdad.** Un setter nativo sobre una fila recién creada no llega al estado interno de
   Kommo: la fila se guarda vacía. *(Así quedaron 10 pautas en blanco.)*
3. ⭐ **Sacar el foco antes de guardar — un `Tab` basta.** Kommo confirma el valor **al perder el
   foco**: la última fila tecleada se guarda vacía si pulsas `Guardar` con el cursor dentro.
4. **Verificar recargando.**

([`../marketing/agentes-ia-configuracion.md:223-236`](../marketing/agentes-ia-configuracion.md);
[`kommo-reconfig.md:67-70`](kommo-reconfig.md))

⚠️ **`computer type` no mete acentos.** Para texto con tildes: escribir sin acentos y corregir con el
setter nativo (`value` + `input`/`change`/`blur`), que en campos que **ya existen** sí registra
([`../marketing/kommo-consumo-y-limites.md:193`](../marketing/kommo-consumo-y-limites.md)).

### ⚠️ 9. Al medir después, `SalesBot:` no prueba que haya un bot

Kommo firma así **cualquier saliente que entra por webhook sin un usuario de Kommo asociado** — que
es exactamente lo que pasa cuando alguien del equipo responde **desde la app de Instagram**. Se
buscó durante horas una automatización que nunca existió
([`../marketing/instagram-entrada.md:220-224`](../marketing/instagram-entrada.md);
[`../marketing/agentes-ia-configuracion.md:53-56`](../marketing/agentes-ia-configuracion.md)).

Cuando verifiques el Paso 8, **un mensaje firmado `SalesBot:` puede ser una persona**, no Manuel.

### ⚠️ 10. Una fuente recién subida tarda hasta ~2 h en indexar; las pautas aplican al instante

Si de paso tocas contenido, no concluyas nada a los cinco minutos
([`kommo-reconfig.md:48-58`](kommo-reconfig.md)). **Cuando pauta y fuente se contradicen, gana la
fuente.**

---

## 4. El costo, con los números del repo

> ⚠️ **Esto es una estimación, no una medición.** Cada factor tiene su fuente y su fecha. Doy un
> **rango**, porque el repo tiene dos bases de volumen que no son la misma unidad y dos mediciones
> de costo por respuesta que no coinciden. Un número de tres cifras exactas sería falso.

### Los tres factores

| Factor | Valor | De dónde sale |
|---|---|---|
| **A · Volumen mensual IG/FB** | **72 – 147 leads/mes** | **72** = contactos nuevos de origen IG/FB en 30 días (72 de 226 = 32%), medido 2026-08-10 → [`../marketing/instagram-entrada.md:194-199`](../marketing/instagram-entrada.md). **147** = 32% de los ~460 leads/mes que salen de 107 leads en 7 días (15,3/día), medido 2026-08-13 → [`../marketing/kommo-consumo-y-limites.md:22-25`](../marketing/kommo-consumo-y-limites.md) |
| **B · Respuestas por lead** | **1 – 2** | El tope duro es **2**: `Límite de mensajes = 2` en los 4 agentes desde el 2026-08-13 → [`../marketing/kommo-consumo-y-limites.md:38-47`](../marketing/kommo-consumo-y-limites.md). El piso es 1 porque una parte de los leads no sigue la conversación |
| **C · Créditos por respuesta** | **15 – 28** | **~15** = mediana de lo observado en el panel de prueba (9 · 10 · 16 · 17 · 22), medido 2026-08-13 → [`../marketing/kommo-consumo-y-limites.md:27`](../marketing/kommo-consumo-y-limites.md). **19-28** = el rango citado el 06 y el 10-ago → [`../marketing/agentes-ia-por-etapa.md:359`](../marketing/agentes-ia-por-etapa.md), [`../marketing/agentes-ia-configuracion.md:28`](../marketing/agentes-ia-configuracion.md) |

⚠️ **Por qué A tiene dos valores tan distintos:** 72 son **contactos**, 147 sale de **leads**. No es
la misma unidad y el repo nunca midió el 32% sobre la base de leads. Uso las dos como extremos en vez
de elegir una y presentarla como el número.

### El rango

| Escenario | Cuenta | Créditos/mes | % del plan de 12.250 |
|---|---|---|---|
| Piso | 72 × 1 × 15 | **~1.100** | 9% |
| Central bajo | 72 × 2 × 15 | **~2.200** | 18% |
| Central alto | 147 × 1,5 × 20 | **~4.400** | 36% |
| Techo | 147 × 2 × 28 | **~8.200** | 67% |

⭐ **El número para decidir: entre ~1.100 y ~8.200 créditos/mes, con el escenario más probable en
2.000-4.500** — o sea entre el **16% y el 37%** del plan actual de 12.250.

### Y el costo de una sola vez: probarlo

La Vista previa consumió **1.345 créditos ≈ 50-70 respuestas** en el ciclo de agosto
([`kommo-estado-y-pendientes.md:81`](../marketing/kommo-estado-y-pendientes.md) y
[`:88`](../marketing/kommo-estado-y-pendientes.md)) → ~20-27 créditos por respuesta en preview. Una
batería corta de 5-8 casos son **~110-220 créditos**, una sola vez. Y **no prueba lo que importa**
(el preview no crea tareas — §2, Paso 8), así que gastarlos ahí es casi todo desperdicio para este
cambio concreto.

### El techo que no se negocia con más saldo

⭐ Medido el 2026-08-13: con ~460 leads/mes y 12.250 créditos, el **presupuesto por lead es ~27
créditos ≈ menos de 2 respuestas**
([`../marketing/kommo-consumo-y-limites.md:26-32`](../marketing/kommo-consumo-y-limites.md)).
Sumar IG/FB **no cambia el costo por lead: cambia cuántos leads entran al circuito.** Si el consumo
central se cumple, el plan pasa de holgado a justo.

**Escalones disponibles** ([`kommo-estado-y-pendientes.md:73-74`](../marketing/kommo-estado-y-pendientes.md)):
Inicial 5.000 (US$29) · **Crecimiento 50.000 (US$99)** · Escala 100.000 (US$199) · Personalizado.
**No hay nada entre 5.000 y 50.000.**

---

## 5. 🔴 El semáforo: hazlo o no lo hagas ahora

### 🔴 El estado del saldo NO está medido hoy (2026-08-24)

**No tengo sesión de Kommo y no la busqué.** Lo que sigue es historial del repo, no la foto de hoy.

**Por qué esto es lo primero y no un detalle:** si el agente está sin créditos, **sumarle un canal no
enciende nada**. Queda mudo en Instagram igual que quedó mudo en WhatsApp, no contesta, **no dispara
la acción `Agregar tarea` y las tarjetas siguen grises** — sólo que ahora creyendo que está
arreglado. Eso es peor que no haberlo tocado.

**Dónde se mira, exactamente:**

```
Kommo → Ajustes → Facturación → Uso → Gestionar créditos
```

([`kommo-estado-y-pendientes.md:25`](../marketing/kommo-estado-y-pendientes.md) y
[`:76`](../marketing/kommo-estado-y-pendientes.md))

Y **mira el desglose por función**, no sólo el total: `Agente de IA` · `Vista previa del agente` ·
`Respuestas sugeridas con IA` · `Reescritor y resúmenes` · `Copilot` · `Fuentes`. En agosto **sólo el
68% del gasto fue atender clientes**; 17,5% eran pruebas internas y 12,6% "Respuestas sugeridas" que
pide el equipo desde el mismo pozo
([`kommo-estado-y-pendientes.md:78-89`](../marketing/kommo-estado-y-pendientes.md)). Una proyección
que no separe esas líneas sale inflada — ya pasó: una primera estimación dio 54.000/mes contra un
real de 15.000-18.000.

### El historial de agosto, para calibrar

| Fecha | Créditos | Estado | Fuente |
|---|---|---|---|
| 06-ago | 2.380 / 7.250 | operando | [`../marketing/kommo-consumo-y-limites.md:11`](../marketing/kommo-consumo-y-limites.md) |
| 07-ago | **7.281 / 7.250** | 🔴 agotado — los 4 agentes mudos | ídem `:12` |
| 10-ago | 7.659 / 12.250 | tras recarga de 5.000 del founder | [`kommo-estado-y-pendientes.md:71`](../marketing/kommo-estado-y-pendientes.md) |
| 11-ago | **12.222 / 12.250** | 🔴 agotado otra vez | [`../marketing/kommo-consumo-y-limites.md:14`](../marketing/kommo-consumo-y-limites.md) |
| 13-ago | 12.222 / 12.250 | 🔴 **dos días sin contestarle a nadie** | ídem `:15` |
| 14-ago | *(proyección)* | *"los créditos se agotan alrededor del 18-ago, renovación el 29-ago"* | [`../marketing/checklist-kommo.md:107-108`](../marketing/checklist-kommo.md) |

⚠️ **Las dos proyecciones del repo no coinciden entre sí**: el 10-ago se proyectó agotamiento *"~8
días antes del 29-ago"* (≈ 21-ago,
[`kommo-estado-y-pendientes.md:216-218`](../marketing/kommo-estado-y-pendientes.md)) y el 14-ago se
escribió *"alrededor del 18-ago"*. **Ninguna se verificó.** Y de hecho el saldo ya se había agotado
el 11-ago, antes que las dos.

📌 **Dos datos del plan que hay que tener en la cabeza:**
- La **renovación es el 29.08.2026** ([`kommo-estado-y-pendientes.md:68`](../marketing/kommo-estado-y-pendientes.md)).
- La **recarga extra de 5.000 comprada el 10-ago vence el 29.08 y NO se renueva sola**
  ([`kommo-estado-y-pendientes.md:70`](../marketing/kommo-estado-y-pendientes.md)). O sea que el
  ciclo que arranca el 29-ago **puede empezar con menos techo del que se ve hoy**, no con más.

### El semáforo

| Lo que ves en `Facturación → Uso → Gestionar créditos` | Qué haces |
|---|---|
| 🔴 **Saldo agotado o casi** (queda menos de lo que estima el §4 para un mes) | **NO sumes el canal.** No encendería nada. Primero: decidir plan (Crecimiento US$99) o esperar la renovación del 29-ago |
| 🟡 **Alcanza para el mes pero sin margen** | Súmalo **sólo al agente de Entrada** (§6), con `Límite de mensajes = 2` confirmado, y **vuelve a medir a las 24-48 h** (Paso 9) |
| 🟢 **Sobra respecto del rango del §4** | Adelante con el §2 completo |
| ⚫ **Estamos a menos de 5 días de la renovación** | **Espera.** Estrenar un canal con el saldo del ciclo viejo, con la recarga de 5.000 venciendo el 29.08, es medir en las peores condiciones y sacar la conclusión equivocada |

⭐ **La regla de fondo, del 13-ago:** *"La pregunta no es 'cuánto recargamos' sino 'cuántas
respuestas por lead'"* ([`../marketing/kommo-consumo-y-limites.md:30-32`](../marketing/kommo-consumo-y-limites.md)).
Sumar un canal **sube la cantidad de leads atendidos**, no el costo por lead. Si el plan ya venía
justo, ésta es la decisión que lo rompe.

---

## 6. A qué agente sumárselo, y por qué

### Los 4 candidatos y qué etapas cubre cada uno

| Agente | id | Etapas que declara | ¿Es el primer toque de un mensaje de IG/FB? |
|---|---|---|---|
| ⭐ **DTD Cargo asistente de ventas** (Entrada) | `326244` | **Leads Entrantes · Contacto inicial** · Ventas Perdidos | ✅ **Sí** |
| DTD Cargo Cotizador | `350054` | Estimado enviado · Negociación | ❌ un lead sólo llega ahí después |
| DTD Cargo Reenganche | `350032` | Recontacto | ❌ ídem |
| Atención al cliente (Post-venta) | `28571` | Logrado con éxito | ❌ es para el que ya compró |

Fuente: [`kommo-estado-y-pendientes.md:96-101`](../marketing/kommo-estado-y-pendientes.md) y
[`../marketing/agentes-ia-configuracion.md:185-190`](../marketing/agentes-ia-configuracion.md).

### ⭐ La recomendación: **DTD Cargo asistente de ventas (Entrada), id `326244`**

**Porque es el único que declara `Leads Entrantes` y `Contacto inicial`, que es exactamente donde
cae un mensaje nuevo de Instagram o Facebook — un primer toque de alguien que no conocemos.**

Los cuatro respaldos:

1. **Es donde está el volumen.** El 10-ago: **436 de 471 leads** en `Contacto inicial`
   ([`kommo-estado-y-pendientes.md:115`](../marketing/kommo-estado-y-pendientes.md)). El 14-ago,
   tras la limpieza: **21 de 50 leads activos**
   ([`../marketing/checklist-kommo.md:27-28`](../marketing/checklist-kommo.md)).
2. **Es el perfil correcto.** Los contactos de IG/FB entran **sin teléfono y muchas veces sin
   nombre** ([`kommo-estado-y-pendientes.md:43-44`](../marketing/kommo-estado-y-pendientes.md)): son
   desconocidos, y el arquetipo de Entrada está escrito para recibir a un desconocido. Mandarlos a
   Post-venta o a Cotizador sería contestarles con un guion que no aplica — el error que ya se pagó
   una vez: *"el Agente 1 sí les contestaba, pero con el guion de Entrada, que no aplica a un cliente
   que ya compró"* ([`../marketing/agentes-ia-configuracion.md:192-197`](../marketing/agentes-ia-configuracion.md)).
3. **No hay nada que construir.** Ya tiene la acción `Agregar tarea · Fecha límite: Ahora`
   ([`kommo-estado-y-pendientes.md:145-151`](../marketing/kommo-estado-y-pendientes.md)) y ya tiene
   `Límite de mensajes = 2`
   ([`../marketing/kommo-consumo-y-limites.md:41`](../marketing/kommo-consumo-y-limites.md)). El
   cambio es **un canal**, nada más.
4. **Es el gasto más chico que prueba la hipótesis.** Un solo agente, un solo tope de 2 mensajes, y
   se mide en 48 h si el rojo aparece de verdad. Sumarle el canal a los cuatro multiplica el gasto
   sin más información: hoy no hay volumen de IG/FB en `Estimado enviado` (2 leads activos el
   14-ago) ni en `Negociación` (12).

### Lo que aceptas al elegir sólo uno

Un lead de IG/FB que **avance de etapa** queda sin agente y sin tarea automática en la etapa nueva
(§1, punto 2). Es una decisión consciente: **primero medir Entrada, después decidir si Cotizador y
Reenganche valen el crédito.**

⚠️ **Y una contradicción del repo que hay que resolver mirando la pantalla:** el 10-ago se anotó que
el Post-venta *"no tiene ningún techo"* — sin `Límite de mensajes` ni `Límite de créditos`
([`kommo-estado-y-pendientes.md:108-111`](../marketing/kommo-estado-y-pendientes.md)) — pero el
13-ago los cuatro quedaron en 2
([`../marketing/kommo-consumo-y-limites.md:38-47`](../marketing/kommo-consumo-y-limites.md)). La
segunda es más nueva y más específica, así que **debería** estar en 2. **No medido hoy** — si en
algún momento le sumas el canal a Post-venta, confirma el límite **antes**: atiende `Logrado con
éxito`, donde hay cientos de leads ganados, y es el que más puede sangrar sin que se note.

---

## Qué queda pendiente de medir

Nada de esto se puede cerrar desde el repo. Va todo con la pantalla delante:

- [ ] 🔴 **El saldo de créditos de hoy** y su desglose por función (§5).
- [ ] 🔴 **Si el picker `+ Añadir canal` muestra hoy los nombres renombrados** (Instagram
      Messenger · Comentarios Instagram · Messenger Facebook · Comentarios Facebook) o sigue
      mostrando `Whu Dragon Chino` ×2.
- [ ] 🔴 **Si Instagram y Facebook son dos canales separados o uno solo.**
- [ ] **Si los comentarios de posts entran como canal del agente** o sólo como fuente de lead.
- [ ] **Si `Límite de mensajes` sigue en 2** en los 4 agentes.
- [ ] **Si los 4 bots de ping de 23 h disparan sobre conversaciones de IG/FB.**
- [ ] **Cómo se muestra en la tarjeta una tarea con `Fecha límite: Ahora`** (el chip `1d` es de una
      tarea vencida hace un día).
- [ ] **Qué pasa con la automatización de comentarios de Meta** cuando Manuel también contesta
      (§1, punto 6).
- [ ] ⚠️ **El pendiente heredado del 11-ago que este cambio empeora:** *"con ~16 leads/día habrá
      mucho rojo. Si el tablero queda rojo permanentemente el indicador pierde valor"*
      ([`kommo-estado-y-pendientes.md:170-172`](../marketing/kommo-estado-y-pendientes.md)). Sumar
      el 32% de IG/FB **sube ese volumen**. Si el tablero ya está permanentemente rojo, arreglar el
      plazo va **antes** que sumar el canal.

---

## Bitácora

| Fecha | Qué |
|---|---|
| 2026-08-24 | Documento creado. **Preparado, no ejecutado.** Sin sesión de Kommo: todo lo de acá sale de los documentos del repo, con `archivo:línea`. Ningún dato de producción se midió en esta fecha |
