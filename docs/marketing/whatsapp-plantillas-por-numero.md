# Plantillas de WhatsApp por número: qué tener en cada uno, qué dicen y por qué

> **Para qué:** decidir el juego de plantillas de los dos números de DTD Cargo:
> - **Atención al público:** leads nuevos y los que se registran en la web.
> - **Clientes:** gente que ya trabaja con nosotros.
>
> **Estado (2026-11-16):** propuesta. No se creó nada en Meta, Kommo ni Chatwoot.
>
> **Continúa** [`whatsapp-plantillas-utilidad.md`](whatsapp-plantillas-utilidad.md), que explica las
> categorías de Meta, el MCP, la sincronización con Chatwoot y por qué las plantillas no pasan de
> una cuenta de mensajes a otra.
>
> **Etiquetas:** **V** = verificado en la fuente citada (leída el 2026-11-16) · **R** = está en el
> repo · **I** = inferido o recomendación mía, sin medir en DTD.

---

## La idea que ordena todo

**Una plantilla no vende: consigue un toque.**

- Fuera de las 24 h solo se puede escribir con plantilla. Cuando el cliente responde, se abre la
  ventana de servicio y desde ahí el asesor (o el bot) conversa con texto libre (V: [Meta,
  «Pricing»](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).
- Por eso el trabajo de cada plantilla es que la persona **toque un botón o conteste**. Lo demás lo
  hace la conversación, como manda [`conversacion-crm.md`](conversacion-crm.md).

De ahí salen las reglas de redacción de abajo, y una consecuencia técnica que casi nadie mira:

> ⭐ **El botón de respuesta rápida abre la ventana; el botón de enlace, no.**
>
> Tocar una respuesta rápida le manda un mensaje a DTD, y ese mensaje abre la ventana. Tocar un
> botón de URL abre el navegador y no le manda nada a DTD (I: se deduce de que la ventana la abre
> un mensaje de la persona).
>
> Por eso las plantillas pensadas para reabrir conversación llevan **respuestas rápidas**. El
> enlace va solo donde lo que queremos es que la persona haga algo en el portal.

---

## 1 · ¿Cuántas plantillas podemos tener sin problema?

### El tope técnico no es el problema

- Meta permite **6.000 plantillas por cuenta de mensajes** en un portfolio verificado y 250 en uno
  sin verificar (V: [Meta, «Templates overview»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)).
  En «Administrar plantillas» se veía «5 de 6.000» (R: E0, M-30).
- Se pueden crear **100 por hora**, y cada idioma cuenta como una plantilla aparte (V).

### El límite real es la calidad

- Meta califica **cada plantilla** por cómo reacciona la gente: bloqueos, denuncias y lectura.
- Cuando una llega a calidad baja, **se pausa 3 horas**. La segunda vez, 6 horas. La tercera, **se
  desactiva** (V: [Meta, «Template pausing»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing)).
- Si se repiten las plantillas de baja calidad, terminan afectando al número.

Muchas plantillas casi iguales reparten los envíos, ninguna junta historial de calidad y el equipo
termina mandando la que no es.

### Recomendación (I)

- **Atención al público:** 10 plantillas en dos paquetes, lead abierto y lead registrado (4 de utilidad y 6 de marketing, contando la variante L9b).
- **Clientes:** 10 plantillas (8 de utilidad y 2 de marketing).
- Se arranca con la **fase 1**: 5 en el público y 4 en Clientes. El resto se agrega cuando las primeras tengan
  calidad verde y datos de respuesta.

**¿Por qué no más?**

- Cada plantilla de esta lista responde a **un evento real** del sistema: registro, cotización
  enviada, recepción en China, cambio de estado, documento que falta, llegada, entrega o días
  desde la última carga.
- Una plantilla sin evento que la dispare es una plantilla que alguien va a mandar «por si acaso».
  Esas son las que se bloquean.

**Dos aclaraciones:**

- Si los dos números quedan en **cuentas de mensajes distintas**, las plantillas comunes (el aviso
  de corte del contenedor) se crean dos veces, una en cada cuenta. Ver el documento anterior, §5.
- ✅ **La regla de la spec 0582 ya está enmendada.** Decía «No se le escribe al cliente desde el
  número de clientes». Sam aprobó cambiarla el 2026-11-16 («Sí, enmiéndala»). Ahora se permiten
  plantillas aprobadas con las condiciones de §2 y §6 (R: `docs/specs/0582-chatwoot-piloto/spec.md`,
  *Redirección sin IA* y Seguimiento).

---

## 2 · Cómo se redacta para que contesten (y para que Meta la apruebe)

### ¿Preguntas cerradas o abiertas?

**En la plantilla, cerrada con opciones. En la conversación, abierta después.**

1. **La plantilla compite con 50 chats.** El esfuerzo de contestar decide más que el interés.
   - El modelo de conducta de B. J. Fogg dice que una acción ocurre cuando coinciden motivación,
     capacidad y un disparador. Bajar el esfuerzo a un toque es lo más barato que se puede mover
     ([Fogg, «A behavior model for persuasive design», 2009](https://doi.org/10.1145/1541948.1541999)).
   - Una respuesta rápida es el mínimo esfuerzo posible.
2. **2 o 3 opciones, no más.** Elegir entre muchas opciones paraliza: en el estudio de las
   mermeladas compró mucha menos gente con 24 sabores que con 6 ([Iyengar y Lepper, 2000](https://doi.org/10.1037/0022-3514.79.6.995)).
   - Además, con 3 o más botones WhatsApp muestra 2 y esconde el resto detrás de «Ver todas las
     opciones» (V: [Meta, «Template components»](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)).
   - La opción que más importa va **primero**.
3. **Siempre una salida digna.** Va un botón «No por ahora», «Ya lo resolví» o «Detener
   promociones».
   - Quien no tiene cómo decir que no, bloquea, y el bloqueo baja la calidad de la plantilla.
   - Un «no» también informa: es un motivo de pérdida que hoy no tenemos.
4. **La pregunta que se contesta con «no».** *«¿Ya descartaste traer esa mercancía?»* funciona
   mejor que *«¿sigues interesado?»*. Decir «no» da sensación de control, y «sí, sigo interesado»
   obliga a comprometerse (R: `conversacion-crm.md`, §5.3; viene de Chris Voss, negociador, no de
   un estudio controlado).
5. **Lo abierto, en el segundo turno.** Neil Rackham midió que abierta o cerrada **no cambia el
   cierre de la venta**; lo que importa es qué se pregunta (R: `conversacion-crm.md`).
   - Así que la plantilla abre la puerta con una pregunta cerrada y fácil.
   - El asesor profundiza con *«¿qué es lo que más te cuesta hoy al traer mercancía?»* cuando la
     ventana ya está abierta y escribir es gratis o casi.
6. **El menú de ayudas le gana al sí/no.** Lo midió el propio Sam: el ping de 23 h que quedó, del
   2026-08-13, ofrece tres puertas («validar proveedor», «registrarte y tener tu Shipping Mark» y
   «alguna pregunta») en vez de preguntar si sigue interesado (R: `kommo-consumo-y-limites.md`).
   Las plantillas de abajo usan ese mismo patrón con botones.

### Curiosidad sin trampa

- **Brecha de información.** La curiosidad aparece cuando la persona nota que le falta un dato que
  le importa ([Loewenstein, «The psychology of curiosity», 1994](https://doi.org/10.1037/0033-2909.116.1.75)).
  En DTD la brecha **es real**: «todavía no ha llegado nada a tu Shipping Mark» o «¿todo coincide
  con lo que compraste?» (foto de la recepción).
- **Lo empezado tira.** Quien ya tiene un avance, aunque sea regalado, tiende a terminar más
  ([Nunes y Drèze, «The endowed progress effect», 2006](https://doi.org/10.1086/500480)). El
  Shipping Mark ya generado es ese avance, y las plantillas del registrado lo nombran.
- **Un sí chico abre el siguiente.** Pedir primero algo pequeño hace más probable que después
  acepten lo grande ([Freedman y Fraser, «pie en la puerta», 1966](https://doi.org/10.1037/h0023552)).
  El primer toque es el sí chico: confirmar, elegir una opción.
- ⛔ **Lo que no se hace:**
  - el gancho vacío («tenemos algo para ti»): Meta lo trata como contenido genérico y lo vuelve
    marketing (V: [Meta, «Template categorization»](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/));
  - la urgencia inventada: Sam ya la descartó el 2026-08-13, porque el equipo después tiene que
    sostener la mentira (R: `kommo-consumo-y-limites.md`).

  **La urgencia solo vale con una fecha real** de corte del contenedor, que va en una variable.

### Reglas de forma

- **Que se entienda en la notificación.** Primero el nombre y luego un dato suyo: el Shipping
  Mark, el producto o el contenedor. La primera línea dice por qué le escribimos.
- **Corto.** Menos de 350 caracteres de cuerpo (I). El tope de Meta es 1.024 (V), pero en el
  teléfono lo largo se corta en «Leer más».
- **Una sola pregunta,** al final del cuerpo (R: `conversacion-crm.md`, regla 2).
- **Sin emojis en el primer contacto con un lead.** En una primera impresión virtual restan
  competencia (R: `conversacion-crm.md`, «Detalles de canal»). Con clientes, como mucho uno.
- **No mezclar respuestas rápidas con botón de enlace o de llamada.** WhatsApp de escritorio no
  muestra esas plantillas (V: «Template components»). Muchos importadores atienden desde el
  computador.
- **Variables:** nunca al principio ni al final, nunca dos seguidas y siempre con ejemplo. Si
  hay demasiadas variables para el texto, Meta suele rechazar (I: así lo reportan los BSP; la
  página de Meta solo exige ejemplos).
- **«Contenedor»,** no «lote». Montos en **US$**. Nada de «oferta», «descuento» ni «promoción» en
  las de utilidad.
- **En las de marketing, el botón de baja de Meta** («Detener promociones»), en tercer lugar.

### Consentimiento: la condición para todo esto

- Meta exige que la persona haya aceptado recibir mensajes **de DTD Cargo** por WhatsApp, y
  recomienda pedir el consentimiento **por tipo de mensaje**: avisos de embarque por un lado,
  novedades por otro (V: [Meta, «Getting opt-in»](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)).
- Hoy el registro solo pide permiso para **correo** («Quiero recibir novedades, ofertas y guías de
  importación por email»; R: `app/registro/RegisterForm.tsx`).
- **Para las de utilidad** basta con que la persona haya pedido el servicio y dado su WhatsApp
  (I). **Para las de marketing** falta una casilla de WhatsApp en el registro y en los formularios.
- Ese cambio es de producto: lleva SDD propia y pasa por `revisar-datos-ve` (FUERA DE ALCANCE de
  este documento).
- Mientras tanto, a quien escribe por WhatsApp se le puede preguntar en la conversación: *«¿Te
  aviso por aquí cuando cierre la recepción del próximo contenedor?»*. Su «sí» queda escrito en el
  chat (I: Meta no menciona el chat de WhatsApp como método, pero exige solo que el
  consentimiento sea claro y nombre a la empresa).

---

## 3 · Número de atención al público: dos paquetes

En este número hay **dos tipos de lead**, cada uno con su paquete. Lo pidió Sam el 2026-11-16: «a
los que no están registrados hay que empujarlos a que se registren, porque así ya tenemos sus
datos».

| | **Paquete A · lead abierto** (sin registro) | **Paquete B · lead registrado** (con Shipping Mark) |
|---|---|---|
| Quién es | Escribió o dejó una consulta y no tiene cuenta en dtdcargo.com | Creó su cuenta y tiene Shipping Mark, pero todavía no mandó carga |
| Objetivo de cada plantilla | **Que se registre** | **Que mande su primera carga** |
| Qué datos tenemos | Solo el WhatsApp y lo que contó en el chat | Nombre, correo, WhatsApp y Shipping Mark. La foto de la cédula y la dirección se completan en el portal antes de la primera compra (R: `app/registro/RegisterForm.tsx`) |
| Plantillas | L9, L9b, L4 y L8 | L1, L3 y L5 |
| Comunes | L2, L6 y L7 | L2, L6 y L7 |

### Cómo se sabe en qué paquete está cada lead (sin IA)

- **Ya existe en el ERP:** `chatwoot_segmento_contacto` (migración 0505, SDD-0586) cruza los
  últimos 10 dígitos del teléfono con las fichas y responde `lead_nuevo`, `lead_registrado` o
  `cliente`.
  - Se calcula en el momento y no se guarda.
  - En Chatwoot ya etiqueta la conversación con ese segmento (R: `lib/studio/chatwoot/enrutar.ts`).
  - Cuando un lead abierto se registra con el mismo número, pasa solo al paquete B.
- **No hace falta IA para clasificar:** registrado o no es un dato, no una opinión.
- **Mientras el número siga en Kommo:** el enrutador del ERP solo funciona en Chatwoot. Hasta el
  corte, el asesor elige el paquete mirando si la ficha existe en el Studio (I).
- **Riesgo:** si el lead se registra con **otro** número, sigue apareciendo como lead abierto. Por
  eso todo mensaje que pide el registro dice «con este mismo número de WhatsApp».

### Cómo se empuja el registro sin perder la conversación

- **Las preguntas del paquete A tienen dos respuestas, y las dos llevan al registro.**
  - «Ya tengo proveedor» → regístrate para darle tu Shipping Mark a tu proveedor.
  - «Lo estoy buscando» → regístrate y te ayudamos a verificarlo antes de pagar.

  Nadie queda acorralado y los dos caminos terminan en el mismo lugar.
- **El enlace al registro va en el segundo mensaje, no en la plantilla.**
  - El cliente toca una respuesta rápida, eso abre la ventana y ahí se le manda el enlace con el
    motivo que corresponde a lo que contestó.
  - Así se sabe qué contestó, y el enlace llega acompañado, como pide `conversacion-crm.md` («el
    link solo» es uno de los asesinos de conversación).
  - El costo es un mensaje de servicio.
  - Para comparar, va una variante con botón directo «Crear mi cuenta» (L9b).
- **El registro filtra la seriedad.** Quien se toma unos minutos para crear su cuenta ya dio un
  primer paso. Ese pie en la puerta hace más probable el siguiente (Freedman y Fraser, §2), y nos
  deja datos verificables.
  - La cédula **no** se pide al registrarse; se pide en el perfil, antes de la primera compra (L3).
  - Pedirla antes sería un cambio del registro: tarea aparte con `revisar-datos-ve`.

### Paquete A · lead abierto: que se registre

#### L9 · `invitacion_registro` — marketing · **fase 1**

- **Se dispara** de 24 a 48 h después de una primera conversación sin registro, con la ventana ya
  cerrada y el segmento en `lead_nuevo`. Una sola vez.
- **Qué busca:** que cree su cuenta. La pregunta lo clasifica de paso.

```
Hola {{1}}, gracias por escribirnos sobre {{2}}.

Para cotizarte con exactitud y asignarte tu Shipping Mark, el siguiente paso es crear tu cuenta en DTD Cargo. Toma pocos minutos.

¿Ya tienes proveedor en China o todavía lo estás buscando?
```

- **Botones:** «Ya tengo proveedor» · «Lo estoy buscando» · «Detener promociones»
- **Ejemplo:** Pedro · traer ropa deportiva para tu tienda
- **Lo que sigue en la ventana abierta** (texto libre que manda el asesor, o un mensaje fijo
  automático cuando exista la fase B):
  - **«Ya tengo proveedor»:**
    > Perfecto. Crea tu cuenta con este mismo número de WhatsApp aquí: dtdcargo.com/registro. Al
    > terminar te aparece tu Shipping Mark, el código que tu proveedor pone en cada bulto. ¿Me
    > avisas cuando lo tengas?
  - **«Lo estoy buscando»:**
    > Te ayudamos con eso: verificamos al proveedor antes de que pagues. Crea tu cuenta con este
    > mismo número aquí: dtdcargo.com/registro, y desde tu portal nos pasas el proveedor que estás
    > viendo. ¿Lo encontraste en Alibaba o en otra página?

  El portal ya tiene la sección de proveedores (R: `app/portal/(app)/proveedores`).
- **Por qué funciona:**
  - el registro se presenta como **el paso que destraba lo que el lead quiere** (cotización
    exacta y código para su proveedor), no como un trámite;
  - la pregunta es cerrada y fácil, y las dos respuestas siguen adelante.

#### L9b · `invitacion_registro_enlace` — marketing · variante para comparar

Mismo cuerpo, pero la última línea es *«Puedes crear tu cuenta desde el botón; usa este mismo
número de WhatsApp.»*

- **Botón:** solo URL «Crear mi cuenta» → `https://dtdcargo.com/registro?utm_source=whatsapp&utm_medium=plantilla&utm_campaign=invitacion_registro`
- **Cómo se compara:** se mandan las dos por partes iguales durante dos semanas y se cuentan
  **registros**, no respuestas. L9 abre conversación; L9b manda directo a la página.

#### L4 · `seguimiento_consulta` — marketing · **fase 1**

- **Se dispara** de 2 a 7 días después de una consulta que no avanzó, con la ventana cerrada. Una
  sola vez.
- Sirve en los dos paquetes. En el A, lo que sigue empuja el registro.

```
Hola {{1}}, hace unos días nos escribiste por traer {{2}} desde China.

Para no escribirte de más: ¿sigues con ese plan o ya lo resolviste por otro lado?
```

- **Botones:** «Sigo con el plan» · «Ya lo resolví» · «Detener promociones»
- **Ejemplo:** Pedro · ropa deportiva para tu tienda
- **Lo que sigue:**
  - **«Sigo con el plan»** en el paquete A:
    > Buenísimo. Para avanzar, crea tu cuenta con este mismo número aquí: dtdcargo.com/registro.
    > Con eso te asignamos tu Shipping Mark y te cotizamos con tus datos. ¿Qué volumen piensas
    > traer, más o menos?
  - **«Sigo con el plan»** en el paquete B: el asesor hace la pregunta del volumen.
  - **«Ya lo resolví»:** el asesor pregunta, una sola vez, con qué lo resolvió. Así sabemos contra
    quién perdimos.
- **Por qué funciona:**
  - pide permiso («para no escribirte de más») y nombra lo suyo, no lo nuestro;
  - «ya lo resolví» es una salida cómoda que además informa.

#### L8 · `consulta_web_recibida` — utilidad · fase 2, con condición

- **Se dispara cuando** llega un formulario de `/contacto` con WhatsApp, **solo si** el formulario
  dice que respondemos por WhatsApp.
  - Si no lo dice, Meta lo considera «llevar la conversación a WhatsApp sin que lo pidieran» y la
    vuelve marketing (V: «Template categorization»).
  - `/cotizar` y `/estimacion` hoy redirigen a `/tarifas` (R: `next.config`).

```
Hola {{1}}, recibimos tu consulta sobre {{2}} desde dtdcargo.com.

Para darte un número exacto nos falta un dato: ¿ya tienes el volumen o el peso aproximado?
```

- **Botones:** «Sí, lo tengo» · «Todavía no lo sé»
- **Ejemplo:** Daniel · traer maquinaria pequeña
- **Lo que sigue:** con el dato, el asesor cotiza **e invita a registrarse** para dejar la
  cotización a su nombre. Como es utilidad, la invitación no va en la plantilla sino en la
  conversación.

### Paquete B · lead registrado: que mande su primera carga

#### L1 · `cuenta_creada_shipping_mark` — utilidad · **fase 1**

- **Se dispara cuando** alguien se registra en `/registro` y no hay conversación abierta.
- **Qué busca:** que el registrado diga en qué punto está y entre al embudo con la primera
  calificación hecha. Esa respuesta es justo la escalera de `conversacion-crm.md`, escalón 1.

```
Hola {{1}}, tu cuenta en DTD Cargo está activa.

Tu Shipping Mark es {{2}}. Tu proveedor lo debe poner en cada bulto para que identifiquemos tu carga en nuestro almacén de China.

¿Ya compraste la mercancía o todavía estás eligiendo proveedor?
```

- **Botones (respuesta rápida):** «Ya la compré» · «Busco proveedor» · «Tengo una duda»
- **Ejemplo:** `{{1}}` Luis · `{{2}}` DTD-1234
- **Riesgo:** medio. La pregunta final puede leerse como calificación comercial.
  - Si Meta la aprueba como marketing, se puede usar igual (cuesta más).
  - O se manda la variante segura: cambiar la última línea por *«La dirección del almacén está en
    tu portal. Si tu proveedor tiene dudas con el marcado, responde a este mensaje.»* y los
    botones por «Entendido» · «Tengo una duda».

#### L3 · `perfil_pendiente` — utilidad · fase 2

- **Se dispara cuando** aceptó la cotización y le falta la foto de la cédula o la dirección de
  entrega (el registro avisa que se completan antes de la primera compra; R: `RegisterForm.tsx`).

```
Hola {{1}}, para recibir tu primera carga nos falta completar tu perfil: {{2}}.

Se hace en un par de minutos desde tu portal.
```

- **Botón:** solo URL «Completar perfil» (enlace fijo al portal). Aquí el objetivo es la acción en
  el portal, no la conversación, así que va sin respuestas rápidas.
- **Ejemplo:** José · foto de la cédula y dirección de entrega

#### L5 · `registrado_sin_carga` — marketing · **fase 1**

- **Se dispara** a los 10–15 días del registro, si no ha llegado nada al almacén con ese Shipping
  Mark. Una sola vez.

```
Hola {{1}}, tu Shipping Mark {{2}} está activo, pero todavía no ha llegado nada a nuestro almacén de China.

¿Qué te falta para dar el primer paso?
```

- **Botones:** «Encontrar proveedor» · «Cotizar mi carga» · «Tengo una duda»
- **Ejemplo:** Ana · DTD-5678
- **Por qué funciona:**
  - el avance regalado (ya tiene su código) más una brecha concreta (no ha llegado nada);
  - las tres puertas que Sam eligió el 2026-08-13, ahora como botones;
  - cada botón lleva a un servicio real: verificación de proveedores y compra asistida, la
    calculadora o una consulta.

### Comunes a los dos paquetes

#### L2 · `cotizacion_lista` — utilidad · fase 2

- **Se dispara cuando** el estimado pasa a «enviado» y no hay ventana abierta.
- **Qué busca:** la entrega de algo que la persona pidió. Es utilidad pura.

```
Hola {{1}}, ya está lista la cotización que nos pediste para {{2}}.

Monto estimado puerta a puerta: {{3}}. Es referencial hasta el {{4}}; el desglose y las condiciones están en tu portal.

¿La reservamos para el próximo contenedor?
```

- **Botones:** «Sí, reservar» · «Tengo una duda» · «Ajustar volumen»
- **Ejemplo:** Carla · 2 m³ de repuestos de moto · US$ 1.180,00 · 30 de noviembre
- **En el paquete A,** «Sí, reservar» lleva primero al registro: la reserva queda a nombre de su
  cuenta.
- **Por qué cierra:** pedir la reserva es el cierre directo; «ajustar volumen» da una salida que
  no es «no».

#### L6 · `cotizacion_sin_respuesta` — marketing · **fase 1**

- **Se dispara** a los 5–7 días de una cotización enviada sin respuesta. Va antes del paso
  automático a «perdido» a los 14 días (R: `embudo-ventas.md`, etapa 3).

```
Hola {{1}}, te enviamos la cotización para {{2}} el {{3}} y no queremos dejarla en el aire.

¿Ya descartaste traer esa mercancía?
```

- **Botones:** «No, sigue en pie» · «Quiero ajustarla» · «Sí, por ahora»
- **Ejemplo:** Mario · 1,5 m³ de artículos de ferretería · 10 de noviembre
- **Por qué funciona:** es la pregunta que se contesta con «no», ya documentada en el repo. Las
  tres respuestas mueven la tarjeta:
  - «sigue en pie» → el asesor cierra (en el paquete A, con el registro primero);
  - «ajustarla» → nuevo estimado;
  - «por ahora» → perdido con su motivo.

#### L7 · `corte_contenedor` — marketing · fase 2 (comparte texto con C10)

- **Se dispara** como máximo **una vez al mes**, y solo a quien aceptó avisos por WhatsApp, cuando
  hay una fecha real de cierre de recepción.

```
Hola {{1}}, el próximo contenedor desde {{2}} cierra la recepción en nuestro almacén el {{3}}.

¿Tienes mercancía para ese corte o te aviso del siguiente?
```

- **Botones:** «Tengo para este» · «Avísame el siguiente» · «Detener promociones»
- **Ejemplo:** Rosa · Yiwu · 5 de diciembre
- **Por qué funciona:**
  - la escasez es real y tiene fecha;
  - las dos respuestas son «sí», una ahora y otra después, así que nadie queda acorralado;
  - el que dice «avísame el siguiente» da permiso explícito para el próximo aviso.

### Quién contesta en este número

| Respuesta | Quién | ¿IA? |
|---|---|---|
| Botones de L9, L4, L5 y L6 | El asesor con los textos de arriba. En la fase B, un mensaje fijo automático por botón | No |
| Texto libre («Tengo una duda» o lo que escriba) | El asesor. Con dtd-bot en **Sugerir** cuando la bandeja esté en Chatwoot (SDD-0618) | Sí, solo sugerencia |
| Saber si está registrado | El ERP (`chatwoot_segmento_contacto`) | No |
| Mientras el número siga en Kommo | El asesor desde Kommo, con las plantillas creadas en la cuenta de mensajes de Kommo. Sin automatizaciones nuevas en Kommo | No |

**Fase 1 de este número: L9 y L4 (paquete A), L1 y L5 (paquete B) y L6 (común).** Cubren los
huecos más grandes:

- leads que nunca se registran;
- registrados que no envían;
- consultas que se enfrían;
- cotizaciones sin respuesta.

---

## 4 · Número de clientes (ya trabajan con nosotros)

**Quién recibe:** quien tiene un embarque abierto o ya recibió uno.

**Aquí casi todo es utilidad:** la gente quiere saber dónde está su carga. Un aviso bien dado
genera la respuesta sin que haya que pedirla.

### C1 · `bienvenida_cliente` — utilidad · **fase 1**

- **Se dispara cuando** se acepta la cotización y se abre el primer embarque.
- **Por qué existe:** presenta el número de Clientes. Así el cambio de número no se siente como un
  desconocido escribiendo, y queda la costumbre de responder ahí.

```
Hola {{1}}, tu embarque {{2}} quedó registrado.

Por este número te escribiremos con las novedades de tu embarque. Guárdanos como DTD Cargo Clientes para tenernos a mano.
```

- **Botones:** «Ya los guardé» · «Tengo una duda»
- **Ejemplo:** María · S-2026-0457
- **El truco:** pedirle que guarde el contacto es un sí chico, y además un contacto guardado
  reporta menos como spam (I).

### C2 · `recepcion_almacen_china` — utilidad · fase 2

- **Se dispara cuando** se recibe la carga en el almacén de China (R: servicio
  `revision-recepcion` en `lib/servicios-detalle.ts`).
- **Encabezado:** imagen con la foto de la recepción.

```
Hola {{1}}, recibimos en nuestro almacén de China tu carga con Shipping Mark {{2}}: {{3}}.

Revisa la foto: ¿todo coincide con lo que compraste?
```

- **Botones:** «Todo correcto» · «Algo no cuadra»
- **Ejemplo:** María · DTD-1234 · 3 bultos, 0,42 m³
- **Por qué funciona:**
  - la brecha es real (¿llegó bien?) y la foto se abre sola;
  - la pregunta pide verificar, no comprar;
  - «algo no cuadra» detecta un problema **en China**, cuando todavía se arregla barato.

### C3 · `actualizacion_embarque` — utilidad · **fase 1**

Es la P1 del documento anterior: estado y próximo paso. Sirve para consolidación, salida del
contenedor, tránsito y llegada a aduana.

### C4 · `documento_pendiente_embarque` — utilidad · fase 2

Es la P2 del documento anterior.

### C5 · `carga_lista_para_entrega` — utilidad · **fase 1**

Es la P3 del documento anterior: llegada con saldo pendiente.

### C6 · `entrega_programada` — utilidad · fase 2

```
Hola {{1}}, tu carga {{2}} sale a entrega el {{3}}, entre las {{4}}.

¿Confirmas que habrá alguien para recibirla en la dirección registrada?
```

- **Botones:** «Confirmo» · «Cambiar fecha» · «Cambiar dirección»
- **Ejemplo:** Ana · S-2026-0459 · martes 25 de noviembre · 9:00 y 12:00
- **Por qué:** es una cita. Confirmar evita la segunda vuelta del camión, que es plata.

### C7 · `pago_recibido` — utilidad · fase 2

```
Hola {{1}}, recibimos tu pago de {{2}} para el embarque {{3}}.

Saldo pendiente: {{4}}. El recibo está disponible en tu portal.
```

- **Botones:** ninguno (no espera respuesta; el recibo está en el portal).
- **Ejemplo:** Carlos · US$ 500,00 · S-2026-0458 · US$ 0,00

### C8 · `como_llego_tu_carga` — utilidad · **fase 1**

- **Se dispara** 1 o 2 días después de la entrega. Meta solo acepta como utilidad una encuesta
  atada a un pedido concreto (V: «Template categorization»), y esta nombra el embarque.

```
Hola {{1}}, ya entregamos tu carga {{2}}.

¿Cómo llegó todo?
```

- **Botones:** «Todo bien» · «Hubo un problema»
- **Ejemplo:** Luis · S-2026-0460
- **Lo que viene después,** con la ventana ya abierta y en texto libre, sin plantilla:
  - si dijo «todo bien» → pedir la reseña en Google y el referido (R: `guiones-asesor.md` §8 y la
    sección `referidos` del portal);
  - si dijo «hubo un problema» → reclamo y asesor de inmediato.

  Es el momento de mayor satisfacción: la pregunta corta abre la puerta y el pedido grande va
  después.

### C9 · `reposicion_cadencia` — marketing · fase 2 (fase 1 si hay cadencia cargada)

- **Se dispara** según la cadencia del cliente (30, 45 o 60 días; R: `embudo-ventas.md`, campo
  «Cadencia esperada»), si no hay un embarque nuevo.

```
Hola {{1}}, tu última carga llegó hace {{2}} días. Si te toca reponer, el próximo contenedor cierra recepción el {{3}}.

¿Te preparo la cotización con el mismo volumen?
```

- **Botones:** «Sí, cotizar» · «Todavía no» · «Detener promociones»
- **Ejemplo:** Pedro · 45 · 5 de diciembre
- **Por qué funciona:**
  - «con el mismo volumen» le ahorra pensar: es la decisión por defecto;
  - lo que se ofrece por defecto se acepta mucho más que lo que hay que elegir ([Johnson y
    Goldstein, «Do defaults save lives?», 2003](https://doi.org/10.1126/science.1091721)).

### C10 · `corte_contenedor` — marketing · fase 2

Mismo texto que L7, creado en la cuenta de mensajes de Clientes.

**Fase 1 de este número: C1, C3, C5 y C8.** Cubren el recorrido mínimo: bienvenida, estados,
cobro y entrega, y la pregunta de cierre que siembra reseñas y referidos.

---

## 5 · Los llamados a la acción, en una tabla

| Plantilla | Qué queremos que haga | Botón principal | Qué hace DTD con la respuesta |
|---|---|---|---|
| L9 | Registrarse | «Ya tengo proveedor» / «Lo estoy buscando» | Enlace al registro con el motivo de su respuesta |
| L1 | Decir en qué punto está | «Ya la compré» | Pasa a Calificado y le pide los datos del proveedor |
| L2 | Reservar | «Sí, reservar» | Convierte: MARKBOX y embarque (I) |
| L3 | Completar perfil | URL «Completar perfil» | El portal desbloquea la primera carga |
| L4 | Confirmar el plan | «Sigo con el plan» | El asesor hace la pregunta del volumen |
| L5 | Elegir su puerta | «Encontrar proveedor» / «Cotizar mi carga» | Compra asistida o calculadora |
| L6 | Reabrir la cotización | «No, sigue en pie» | El asesor cierra o ajusta |
| L7 / C10 | Llegar al corte | «Tengo para este» | Cotización con fecha |
| C1 | Guardar el contacto | «Ya los guardé» | Queda la costumbre de responder aquí |
| C2 | Verificar la carga | «Todo correcto» / «Algo no cuadra» | Reclamo en China, antes de embarcar |
| C6 | Confirmar la cita | «Confirmo» | Ruta de entrega cerrada |
| C8 | Calificar la entrega | «Todo bien» | Reseña y referido en la ventana abierta |
| C9 | Repetir | «Sí, cotizar» | Estimado con el volumen anterior |

---

## 6 · Frecuencia y medición (para no quemar el número)

- **Máximo un mensaje de marketing por persona a la semana**, y cada reactivación **una sola
  vez**, no en secuencia. Esto coincide con la regla de Sam: «un recordatorio se perdona; tres
  seguidos hacen que reporten el número» (R: `kommo-consumo-y-limites.md`).
- Meta además frena el marketing a quien ya recibe mucho de cualquier empresa (error 131049; ver
  el documento anterior). **Si una plantilla de marketing no llega, no se reenvía en el día.**
- **Medir cada plantilla:**
  - cuántas se enviaron;
  - cuántas recibieron respuesta en 48 h (en Chatwoot, conversaciones reabiertas);
  - la calidad en WhatsApp Manager.
- **Si una pasa a calidad amarilla, se deja de usar y se reescribe.** No se espera a la pausa.
- **Para probar redacciones, dos versiones de la misma plantilla** (por ejemplo, L5 con menú de
  tres o con pregunta de sí/no), repartidas por igual. Gana la que más responden con menos
  bloqueos. Cada versión es una plantilla aparte (I).

---

## 7 · ¿Y Instagram?

**Instagram no usa plantillas aprobadas como WhatsApp.**

- Solo se responde dentro de las **24 h** desde el último mensaje de la persona.
- Con la etiqueta `human_agent`, una **persona** (no un bot) puede responder hasta **7 días**
  después, y la app necesita la revisión de Meta para ese permiso (V: [Meta, plataforma de
  Instagram, vía la ayuda de Chatwoot](https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel)).
- Fuera de eso no hay forma de reabrir.

**Por eso la estrategia de Instagram es otra (I):**

- dentro de la ventana, conseguir el WhatsApp con su permiso: *«¿Te aviso por WhatsApp cuando
  tengamos tu cotización?»*;
- desde ahí, las plantillas de este documento.

Lo vemos aparte cuando toque Instagram.

---

## Preguntas para Sam (con mi recomendación)

1. ~~¿Cambiamos la regla de la spec 0582 «No se le escribe al cliente desde el número de
   clientes»?~~ **Resuelta el 2026-11-16:** Sam dijo «Sí, enmiéndala» y la spec ya está
   enmendada.
2. **¿Arrancamos con la fase 1 (L9, L4, L1, L5 y L6 en el público; C1, C3, C5 y C8 en Clientes)?**
   - Recomendación: **sí**. Nueve plantillas, cada una con su disparador real.
3. **¿Abrimos una tarea aparte para agregar la casilla de avisos por WhatsApp al registro y a los
   formularios?**
   - Recomendación: **sí**, como SDD de producto con `revisar-datos-ve`. Sin ella, las de
     marketing quedan limitadas a quien aceptó en el chat.
4. **¿Te parece bien el tope de un marketing por persona a la semana y una sola reactivación por
   etapa?**
   - Recomendación: **sí**. Protege el número, que es lo que más cuesta reemplazar.
5. **¿Quién manda cada plantilla al principio: el asesor a mano desde Chatwoot o automatizado?**
   - Recomendación: **a mano las primeras dos semanas**, para leer las respuestas. Después se
     automatizan las de utilidad (C3, C5 y C8), que dependen de cambios de estado del ERP.
     Automatizar es otra tarea.

## Fuentes

**Meta,** leídas el 2026-11-16:

- [Templates overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- [Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)
- [Template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing)
- [Template categorization](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)
- [Getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)
- [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

**Chatwoot:** [Human Agent tag en Instagram y Messenger](https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel)

**Psicología** (estudios clásicos; ninguno se midió en WhatsApp ni en DTD):

- Fogg (2009)
- Iyengar y Lepper (2000). La réplica del efecto es mixta: tómalo como orientación, no como ley.
- Loewenstein (1994)
- Nunes y Drèze (2006)
- Freedman y Fraser (1966)
- Johnson y Goldstein (2003)

**Repo:**

- `docs/marketing/conversacion-crm.md`
- `docs/marketing/guiones-asesor.md`
- `docs/marketing/kommo-consumo-y-limites.md`
- `docs/marketing/embudo-ventas.md`
- `docs/specs/0582-chatwoot-piloto/spec.md`
- `app/registro/RegisterForm.tsx`
- `lib/servicios-detalle.ts`
