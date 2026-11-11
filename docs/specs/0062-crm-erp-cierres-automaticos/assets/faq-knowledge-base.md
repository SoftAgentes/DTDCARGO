# Base de conocimiento FAQ — DTD Cargo

> Fuente para Kommo (AI Agent + Respuestas sugeridas) y, opcionalmente, el sitio público.
> Reestructura del `DTDCARGO-Kommo-KnowledgeSource.docx` original (SDD-0062).
> Tono: español venezolano neutro, **tuteo**, cálido, claro y breve.
>
> ⚠️ **Al editar este archivo no basta con commitear.** Hay que convertirlo a DOCX y **subirlo a
> Kommo reemplazando el anterior** en Sources. Proceso completo en
> [`docs/runbooks/kommo-reconfig.md`](../../../runbooks/kommo-reconfig.md).
>
> **El criterio de conversación** (cómo leer el mensaje entrante, qué preguntar y qué mata el hilo)
> vive en [`docs/marketing/conversacion-crm.md`](../../../marketing/conversacion-crm.md).

> **SDD-0579 · 2026-10-23:** fuente preparada **localmente**, sin convertir ni subir a Kommo.
> Mientras el seguimiento del Portal esté en construcción, el estado de la carga se consulta con
> nuestro equipo por WhatsApp. Esta fuente es estática: no cambia automáticamente al apagar
> `TRACKING_EN_CONSTRUCCION`; deberá revisarse antes de una futura carga autorizada.

## ⚠️ Cambio 2026-08-03 — terminología retirada

Tres cosas que este documento decía y **ya no se dicen**. Estaban desincronizadas con el código
vivo y con las reglas de marca:

| ❌ Decía | ✅ Dice ahora | Por qué |
|---|---|---|
| "DDP" como nombre visible | **"Puerta a Puerta"** — y si hay que aclarar, *"(todos los gastos pagados)"* | Regla de marca. `lib/shared/shipment-public.ts` prohíbe la sigla en el nombre visible. |
| **"Financiamiento 100%"** | **"Pagas al llegar"** | ⚠️ **Se retiró el 2026-06-09 por riesgo legal.** Junto con "prepago". Ver `equipo-crm/05-reglas-y-limites.md`. |
| "DTD CARGO opera desde 2008" | **Fundada en 2015**; en el comercio con China **desde 2008** | 2008 sustenta la experiencia, no la fundación. `foundingDate` del schema = 2015. |
| `dtdcargo.com/calculadora` | **`dtdcargo.com/tarifas`** (carga normal) y **`dtdcargo.com/fcl`** (contenedor completo) | `/calculadora` es un 301 desde el rename de rutas. |

**Tampoco se dice nunca:** la palabra **"responsabilidad"** (para tiempos → *"lo define la
naviera"*) · nombres de **navieras** o del proveedor de tarifas (trabajamos white-label) · la
**razón social ni el RIF**.

## Cómo está escrito este documento y por qué

Sigue las reglas de redacción para bases de conocimiento que consume una IA:

- **Cada sección es autocontenida** y cubre un solo tema. No se enlaza a otra sección para
  completar una respuesta: el buscador que alimenta al agente no sigue enlaces.
- **La pregunta se repite dentro del cuerpo de la respuesta.** Al fragmentar el documento, el
  título puede quedar separado de su respuesta; repetirla evita que el agente pierda el contexto.
- **Prosa y listas, no tablas** en las respuestas. Las tablas se fragmentan mal.
- **Se repite el sustantivo** en vez de usar "esto", "eso" o "el mismo", que dependen del párrafo
  anterior y se rompen al fragmentar.

## El contrato de conversación

Estas cuatro reglas aplican a **todas** las respuestas de este documento:

1. **Una respuesta y UNA pregunta.** Nunca dos preguntas en el mismo mensaje: el cliente
   contesta la última y olvida la primera.
2. **La pregunta tiene que ser fácil de contestar.** *"¿Ya has traído de China antes?"* sirve.
   *"¿Cuál es tu estrategia de importación?"* no.
3. **La pregunta debe hacer avanzar la calificación, no solo pedir permiso.** *"¿Te cotizo?"* no
   averigua nada. *"¿Ya traes directo de China o le compras a distribuidores aquí?"* sí.
4. **Todo precio es un ESTIMADO.** El monto final lo confirma un asesor al reservar. Los números
   salen de la calculadora, nunca del chat ni de memoria.

## ⚠️ Si no está acá, el agente se queda MUDO

El AI Agent de Kommo **solo responde cuando encuentra información relevante en sus Sources**. Si
un tema no está redactado en este documento, el agente **no contesta nada** — no dice "no sé".

Por eso los temas sin definir están redactados igual, como **escalamiento explícito**, y por eso
existe el Action de fallback descrito en el runbook. **Un hueco acá es un cliente en visto.**

---

## A · Comercial (alta frecuencia)

### 1. Cómo iniciar un envío (registro · Shipping Mark)
**Preguntas:** ¿Cómo empiezo a enviar con ustedes? · Ya compré en China, ¿ahora qué hago? · ¿Cómo registro mi compra? · ¿Cómo me registro como cliente? · ¿Qué tengo que hacer para enviar? · Ya hice mi compra en 1688, ¿cuál es el siguiente paso? · ¿Cómo abro una cuenta? · ¿Qué es una pre-alerta? · ¿Qué es el casillero? · ¿Qué es el Shipping Mark (Markbox)? · Cómo empiezo a importar.

**Respuesta (aprobada):** ¡Hola! Registrarte toma dos minutos y **no necesitas tener la compra hecha todavía**. Entra en **dtdcargo.com/registro** y el formulario te va llevando paso a paso. Te pide poco:

1. Si eres **persona o empresa**.
2. **Nombre, cédula o RIF, correo y WhatsApp.**
3. **Estado y ciudad**, para saber hasta dónde te entregamos.
4. Revisas que todo esté bien y confirmas.

Apenas confirmas te aparece en pantalla tu **Shipping Mark** (唛头): es el código que identifica tus cajas en nuestra bodega en China. Tu proveedor lo escribe en cada bulto y así sabemos que ese bulto es tuyo. Es lo que muchos llaman "casillero", pero aquí lo llamamos **Shipping Mark**.

**No tienes que inventar ninguna contraseña:** te llega un correo con tu enlace de acceso al portal — si no lo ves, revisa spam. Ahí adentro cargas tus compras y haces tus **pre-alertas**, que le mandan a tu proveedor un enlace con todo lo que necesita para despacharte. El resto de tus datos los completas después, con calma, dentro del portal.

**Pregunta de continuación:** *"¿Ya tienes la mercancía comprada en China o todavía estás buscando proveedor?"*

> *Nota interna: datos verificados contra `app/registro/RegisterForm.tsx` y `app/registro/actions.ts` (2026-08-05). Obligatorios reales = tipo · nombre · documento · email · WhatsApp; el resto se difiere a `/portal/perfil`. La cuenta nace **activa** (`portal_approved_at = now`, SDD-0059): no hay pantalla de espera ni aprobación previa, y **no se pide contraseña** (enlace mágico por correo). El MARKBOX se genera atómico vía `rpc next_markbox_service`. **No prometer que el correo llega al instante** — el envío es best-effort y un fallo de email no rompe el alta.*

### 2. Cotización y tarifas (CBM)
**Preguntas:** ¿Cuánto cuesta enviar de China a Venezuela? · ¿Cuánto me sale traer mercancía de China? · ¿Cómo cobran el flete? · ¿Cobran por peso o por volumen? · ¿Cuánto cobran por CBM? · ¿Qué precio tiene el envío? · ¿Cuánto cuesta un contenedor completo? · ¿Tienen servicio aéreo? · ¿Qué es DDP? · ¿Cuál es el costo del envío marítimo?

**Habilidad de respuesta:** DIRIGIR A LA HERRAMIENTA (la calculadora tiene la lógica + tarifa viva). La IA **NO cotiza en el chat** (evita números viejos e ida y vuelta).

**Respuesta:** ¡Hola! Cuánto cuesta enviar de China a Venezuela depende sobre todo del **volumen (CBM)** de tu carga y de la ciudad de entrega. Lo bueno es que **lo calculas tú mismo al instante** en la calculadora, que ya tiene la tarifa vigente: 👉 **dtdcargo.com/tarifas**. Metes las medidas de tus cajas y te da el estimado en segundos. Es un **estimado**: el monto final lo confirma un asesor al reservar.

Nuestro servicio principal es el **Puerta a Puerta**: un solo precio que ya incluye flete, aduana, impuestos y entrega en tu dirección, y **pagas cuando tu carga llega a Venezuela** — sin adelantos. También trabajamos **Consolidado LCL** (hasta puerto, con tu propio BL) y **contenedor completo**, que se cotiza en **dtdcargo.com/fcl**. Todo va por vía **marítima**; el flete aéreo de carga está suspendido.

**Pregunta de continuación (elige UNA):** *"¿Ya traes directo de China o le compras a distribuidores aquí?"* — es la que más información da y la que abre el comparativo.

**Según lo que conteste:**
- **"Le compro a distribuidores aquí"** → está pagando el margen del intermediario. Ofrécele el comparativo con su propio volumen.
- **"Sí, ya traigo"** → tiene agente. Pregunta qué le cuesta más de traer hoy; ahí está la venta.
- **"Es la primera vez"** → explícale el flujo desde el registro y el Shipping Mark (sección 1).

> *Notas internas: (1) NO hardcodear tarifas $ ni la regla CBM en el chat — eso vive en la calculadora (dtdcargo.com/tarifas). (2) El pedido de email alimenta la reactivación (SDD-0062 · Slice D). (3) FCL, carga especial y cotización formal no están en la calculadora pública → ahí sí escala a asesor. (4) ⚠️ Actualizado 2026-08-03: se retiró "DDP" como nombre visible y "Financiamiento 100%" (riesgo legal, 2026-06-09); la ruta pasó de `/calculadora` (hoy 301) a `/tarifas`.*

### 3. Tiempos de tránsito
**Preguntas:** ¿Cuánto tarda en llegar de China a Venezuela? · ¿Cuánto tiempo demora el envío? · ¿En cuánto tiempo llega mi carga? · ¿Cuántos días tarda el barco? · ¿Cuánto se demora la mercancía? · ¿Cuánto tiempo de tránsito marítimo? · Cuánto dura el envío.

**Respuesta (aprobada · corta):** ¡Hola! Sin cuentos: tu carga va en **barco**, así que tarda **60 a 90 días** (flete interno en China + la espera de la próxima salida, cada 15-21 días + la travesía marítima). Puede variar por aduana o clima. El seguimiento de la carga dentro del portal está en construcción. Para conocer el estado de tu envío, escríbenos por WhatsApp. Te avisaremos apenas esté activo.

**Pregunta de continuación:** *"¿Para cuándo necesitas tener la mercancía aquí?"*

### 4. Cómo enviar a nuestra bodega en China
**Preguntas:** ¿A qué dirección le digo a mi proveedor que envíe? · ¿Cuál es la dirección de su bodega en China? · ¿Dónde envía mi proveedor la mercancía? · ¿Cómo marco mis cajas? · ¿Qué dirección le doy a mi proveedor chino? · ¿Cómo identifico mis cajas en su almacén? · ¿Qué instrucciones le doy a mi proveedor?

**Respuesta (aprobada):** ¡Hola! Para que tu proveedor te cotice el flete interno (**FOB** o **EXW**), pásale esta dirección de **referencia**. 👇 **Copia y pégasela a tu proveedor:**

📋 **Yiwu Port Phase II, Warehouse 2, No. 2, Yiwu City, Zhejiang, China**

Con eso te cotiza el costo hasta nuestra bodega. Ojo: es **solo de referencia para cotizar**. La **dirección completa para enviar** (con el detalle de cargo) + tus **códigos QR del Shipping Mark** los recibes al **registrarte** y generar tu pre-alerta: **dtdcargo.com/registro**.

**Pregunta de continuación:** *"¿Cuántos proveedores te van a enviar mercancía a la bodega?"*

> *Nota interna: dirección de referencia = la completa SIN el detalle "(Cargo 7-11)", que se entrega solo al registrar/pre-alertar. Decisión founder 2026-06-07.*

### 5. Incoterms: FOB y EXW
**Preguntas:** ¿Qué es FOB? · ¿Qué es EXW? · ¿Qué diferencia hay entre FOB y EXW? · Mi proveedor me dio precio FOB/EXW, ¿qué hago? · ¿Qué es un Incoterm? · ¿Quién paga el flete interno en China? · ¿El precio incluye llevar al puerto? · No entiendo los términos de mi proveedor.

**Respuesta (aprobada · corta):** ¡Hola! Sencillo:
🔹 **FOB:** el proveedor **incluye** el flete interno en China (llevar la carga hasta nuestra bodega). Te cotiza con la dirección de referencia.
🔹 **EXW:** el precio es **solo la mercancía** en su fábrica; el flete interno **lo pagas tú**.
En resumen: con FOB lo cubre el proveedor; con EXW lo cubres tú. Saberlo te ayuda a **comparar precios reales**: con el incoterm en la mano se ve el costo total, no solo el precio de fábrica.

**Pregunta de continuación:** *"¿Ya le pediste a tu proveedor el precio puesto en nuestra bodega de Yiwu?"*

### 6. Métodos de pago
**Preguntas:** ¿Qué métodos de pago aceptan? · ¿Puedo pagar con tarjeta/Visa/Mastercard? · ¿Puedo pagar con enlace o QR? · ¿Aceptan PayPal? · ¿Cómo/dónde pago la compra o el servicio?

**Respuesta (aprobada · corta):** ¡Hola! Tu envío es un servicio de logística internacional, así que se cotiza en **dólares** (la mayor parte de los costos —flete, aduana, gestión en China— se pagan en divisas a terceros). Los **datos y la forma de pago** exactos para tu caso te los pasa un asesor de forma segura, con la referencia de tu **Shipping Mark**.

**Pregunta de continuación:** *"¿Este sería tu primer envío con nosotros o ya has traído antes?"*

> *Nota interna (⚠️ LEGAL — actualizado 2026-07-10): NO listar medios de pago ni afirmar/negar el bolívar en canales públicos. El bolívar es de curso legal en Venezuela: no se puede rechazar por escrito, pero en la práctica se cobra en divisas (≈95% de los costos son a terceros en USD). Enfoque acordado: enmarcar en "servicio internacional cotizado en dólares" + derivar la forma de pago al asesor, caso por caso. Reemplaza la lista anterior de medios (USD/Bs/USDT/Yuan). Pendiente de validación de la abogada — ver docs/legal/ACUERDO-PENDIENTES-v3.1.md.*

---

## B · Servicios (secciones nuevas — requieren datos del founder)

### 7. Validación de proveedores
**Preguntas:** ¿Validan proveedores en China? · ¿Cómo sé si mi proveedor es confiable? · ¿Hacen verificación de fábrica? · ¿Qué incluye la validación de proveedor? · ¿Cuánto cuesta validar un proveedor? · ¿Validación digital o presencial?

**Respuesta (aprobada · captura email + link):** ¡Hola! Sí ✅ Validamos proveedores y fábricas en China para que compres seguro: **auditoría de legitimidad** (validez legal, capacidad, instalaciones) e **inspección pre-producción y pre-embarque**. Déjame tu **correo**: validamos tus datos y un asesor te pasa el **link** donde ves los **servicios de inspección con sus precios** y un ejemplo del reporte.

**Pregunta de continuación:** *"¿Es un proveedor nuevo o uno con el que ya has trabajado?"*

> *Nota interna: el "link" muestra el menú de servicios de inspección con precios (tarifas etiquetadas) + la muestra del reporte branded. Página/link **EN CONSTRUCCIÓN (stand by)** → mientras tanto el asesor lo envía a mano. Plantillas de reporte listas: **"Inspección de Producto (PSI)"** + **"Inspección de Fábrica (auditoría /100)"** (samples branded HTML en Downloads del founder). Captura de email obligatoria. Decisión founder 2026-06-08.*

### 8. Verificación de mercancía
**Preguntas:** ¿Revisan la mercancía antes de enviarla? · ¿Hacen inspección de calidad? · ¿Verifican cantidad y estado de mi pedido? · ¿Qué incluye la verificación de mercancía? · ¿Cuánto cuesta? · ¿Toman fotos/video?

**Respuesta (aprobada · captura email + link):** ¡Hola! Sí ✅ Antes de embarcar **inspeccionamos tu mercancía en la fábrica del proveedor** para confirmar que lo que sale sea **lo que compraste**: cantidad, calidad y especificaciones contra tu ficha técnica, con **muestreo AQL** y **evidencia fotográfica**. Déjame tu **correo**: validamos tus datos y un asesor te pasa el **link** donde ves los **servicios de inspección con sus precios** y un ejemplo del reporte.

**Pregunta de continuación:** *"¿Qué mercancía es la que quieres que revisemos?"*

> *Nota interna: corresponde al reporte **"Inspección de Producto (PSI)"** (muestreo AQL + galería de defectos + conformidad). Mismo patrón #7: captura email obligatoria + link con precios (stand by, lo envía el asesor) + ejemplo del reporte branded. Decisión founder 2026-06-08.*

### 9. Compra asistida
**Preguntas:** ¿Me ayudan a comprar en China? · No sé comprar en 1688/Alibaba, ¿me asisten? · ¿Compran por mí? · ¿Qué es la compra asistida? · ¿Cuánto cobran por la compra asistida? · ¿Negocian con el proveedor por mí?

**Respuesta (aprobada · captura email):** ¡Hola! Sí ✅ Con la **compra asistida** somos tu **departamento de compras en China**: te ayudamos a **ubicar al proveedor, negociar y gestionar la compra** (incluso **pagarle al proveedor**) antes de consolidar tu carga. Mándame tu **lista de productos** por aquí y tu **correo**, y un asesor te confirma **viabilidad, modalidad y costo**.

**Pregunta de continuación:** *"¿Lo que quieres comprar es para revender o para uso propio?"*

> *Nota interna (⚠️ PENDIENTE de definir — founder 2026-06-08): en compra asistida **el proveedor lo pone DTD (red propia)** — el bot NUNCA revela datos/contacto del proveedor; DTD ubica, negocia, paga y gestiona por dentro (protege contra que el cliente compre directo). Falta decidir el modelo comercial: margen vs comisión, cómo se cobra, hasta dónde se le cuenta al cliente. La frase "ubicar al proveedor" se mantiene porque describe el servicio, no entrega el contacto.*

### 10. Cursos
**Preguntas:** ¿Dan cursos de importación? · ¿Cómo me inscribo al curso? · ¿Cuánto cuesta el curso? · ¿Qué incluye el curso? · ¿Es online o presencial? · ¿Cuándo es el próximo curso?

**Respuesta (aprobada · captura email):** ¡Hola! Por ahora **no tenemos cursos disponibles**, pero estamos por **activarlos muy pronto** 🚀. Déjame tu **correo** y te aviso apenas abramos el próximo curso (**presencial u online**).

**Pregunta de continuación:** *"¿Qué producto tienes pensado traer de China?"*

> *Nota interna: cursos por activar; la captura de email arma la **lista de espera** para avisar al lanzar. Actualizar esta sección cuando haya temario/modalidad/precio/fechas. Decisión founder 2026-06-08.*

### 11. Seguimiento / Tracking
**Preguntas:** ¿Dónde está mi mercancía? · ¿Cómo rastreo mi envío? · ¿Dónde veo el estado de mi carga? · ¿Tienen tracking? · ¿Cómo sé dónde va mi mercancía? · Quiero el estado de mi pedido. · ¿En qué va mi envío? · ¿Ya llegó mi carga? · ¿Me puedes decir dónde va mi contenedor?

**Respuesta (aprobada):** ¡Hola! Te la ubico enseguida. Para eso necesito **tu Shipping Mark** (el código DTD-XXXX) **o el número de tu envío** — con ese dato un asesor te dice exactamente en qué punto va tu carga.

El seguimiento de la carga dentro del portal está en construcción. Para conocer el estado de tu envío, escríbenos por WhatsApp. Te avisaremos apenas esté activo.

**Pregunta de continuación:** *"¿Cuál es tu Shipping Mark?"* — sin ese dato no se puede ubicar nada, así que es la única pregunta que va.

> *Nota interna: ⚠️ **`dtdcargo.com/track` YA NO EXISTE** — `next.config.ts:388-389` lo redirige con **301 a `/portal/login`**. Esta sección lo seguía recomendando: un lead sin cuenta caía en una pantalla de login. Enlace retirado el 2026-08-05. Las pantallas del seguimiento del cliente están en el portal (`app/portal/(app)/envios/`, con detalle en `envios/[code]/`), pero mientras `TRACKING_EN_CONSTRUCCION` siga encendido no se promete que el cliente vea eventos. **No prometer fecha**: se conserva «Te avisaremos apenas esté activo», aprobado en SDD-0521; no define canal ni autoriza enviar avisos. La RPC pública `public_track_shipment` sigue existiendo en `lib/public/tracking-queries.ts`, pero **sin ruta pública que la use** — si alguien la reactiva, actualizar acá.*

---

## C · Empresa e información general

### 12. Ubicación (oficinas)
**Preguntas:** ¿Cómo puedo llegar? · ¿Cuál es la dirección de tu oficina? · ¿En qué zona/ciudad están? · ¿Cómo puedo contactarte?

**Respuesta:** ¡Hola! Con gusto te oriento.
- **Venezuela:** oficina en **Valencia**. Mapa: https://maps.app.goo.gl/76T5MAeeTyynwV1M6 · datos de contacto en el pie de **www.dtdcargo.com** o en "Contáctenos".
- **China:** bodegas en **Yiwu**. La dirección exacta se entrega a clientes registrados (cada envío tiene su proceso). Si ya compraste, regístrate en **www.dtdcargo.com/registro** y te indicamos dirección y pasos.

**Pregunta de continuación:** *"¿Y tú desde qué ciudad nos escribes? Así el asesor te confirma cómo sería la entrega hasta allá."*

### 13. Horario laboral
**Preguntas:** ¿Cuáles son sus horarios de atención? · ¿Qué días abren? · ¿Trabajan fines de semana? · ¿A qué hora abren/cierran?

**Respuesta:** ¡Hola! Nuestros horarios:
- **Oficina (Venezuela):** lunes a viernes, 9:00 a.m. a 5:00 p.m.
- **WhatsApp:** todos los días, 8:00 a.m. a 8:00 p.m.
Y entre nosotros... muchas veces andamos casi 24 horas pegados al teléfono, así que es muy probable que te respondamos incluso fuera de horario.

**Pregunta de continuación:** *"Aprovechando que andamos por aquí: ¿ya tienes mercancía lista en China o apenas estás organizando la compra?"*

### 14. Experiencia de la empresa
**Preguntas:** ¿Hace cuánto operan? · ¿Cuántos años llevan en el mercado? · ¿Cuál es su experiencia? · ¿Desde qué año operan?

**Respuesta:** ¡Hola! Sobre nuestra experiencia y desde cuándo operamos: estamos **en el comercio con China desde 2008**, abrimos **oficina propia en China en 2010** y **operamos en Venezuela desde 2015** — ese es nuestro año de fundación. Hacemos logística puerta a puerta entre China y Venezuela con carga consolidada, y acompañamos todo el proceso: compra, consolidación y envío hasta destino. Tenemos **equipo propio en Yiwu y en Valencia**. Más en **www.dtdcargo.com**.

**Pregunta de continuación:** *"¿Qué tipo de mercancía estás buscando traer?"*

> *Nota interna (⚠️ corregido 2026-08-03): decía "opera desde 2008", que contradice la regla canónica. **2008 = experiencia comercial con China · 2010 = primera oficina propia en China · 2015 = fundación en Venezuela** (`foundingDate` del schema). Fuente: `docs/marketing/estrategia.md`. **Nunca escribir un total fijo de años** — se calcula, no se hardcodea.*

### 15. Un solo nombre: DTD Cargo
**Preguntas:** ¿DoorTuDoor y DTD Cargo son lo mismo? · ¿Son la misma empresa? · ¿Qué significa DTD? · ¿Por qué antes los veía con otro nombre? · En Instagram los veía distinto.

*(⚠️ Los disparadores de arriba **conservan a propósito el nombre viejo**: la IA tiene que
RECONOCER la pregunta cuando un cliente la escriba. La respuesta de abajo ya no lo promueve.
Detectar ≠ promover — no quitar la palabra de la línea de preguntas.)*

**Respuesta:** ¡Hola! Sí, somos la misma empresa de siempre: mismo equipo, mismo servicio, misma gente. Hoy nuestro **único nombre es DTD Cargo**, tanto en la web como en redes. Si nos conociste antes con otro nombre, estás en el lugar correcto.

**Pregunta de continuación:** *"Y para saber por dónde empezar contigo: ¿ya has traído mercancía de China antes o esta sería tu primera vez?"*

---

## D · Postventa, soporte y administrativas (fusionadas)

### 16. Descuentos y ofertas (fusión de "Venta" + "Descuento")
**Preguntas:** ¿Tienen descuentos/ofertas? · ¿Puedo pedir un descuento? · ¿Ofrecen mejor precio por volumen? · ¿Hay promociones vigentes?

**Respuesta (aprobada):** ¡Hola! Sobre descuentos y mejores precios: sí, **premiamos el volumen y la frecuencia**. Mientras más CBM traigas mejor tarifa, y nuestros **clientes frecuentes** tienen las mejores condiciones — la tarifa preferencial se sostiene manteniendo la cadencia, no es un descuento de una sola vez.

Calcula tu base en **dtdcargo.com/tarifas** y un asesor te arma la tarifa con tu condición. Si importas seguido te conviene **registrarte** en **dtdcargo.com/registro**: guardas tu historial y haces la recompra más fácil.

**Pregunta de continuación:** *"¿Cada cuánto repones mercancía?"* — la frecuencia es lo que habilita la tarifa preferencial, así que es la pregunta correcta antes de hablar de números.

> *Nota interna: objetivo de negocio PRIORITARIO (founder 2026-06-07) = clientes FRECUENTES y de ALTO volumen. ⚠️ **El agente NO concede descuentos** — los escala a Administración. Ceder precio de entrada cuesta cierres a largo plazo y sienta precedente para el siguiente pedido. Lo que el agente sí hace es **cambiar el eje de la conversación del precio a la cadencia**, que es donde DTD gana. Actualizado 2026-08-03: la versión anterior hacía DOS preguntas en el mismo mensaje (CBM + ciudad) — el cliente contesta una y olvida la otra.*

> *Nota interna: objetivo de negocio PRIORITARIO (founder 2026-06-07) = clientes FRECUENTES y de ALTO volumen. El agente debe identificar/nutrir ese perfil e incentivar el registro para retención/recompra.*

### 17. Reembolsos, devoluciones y garantía (fusión de 3 secciones)
**Preguntas:** ¿Puedo obtener un reembolso? · ¿Cuáles son sus políticas de reembolso? · Mi carga llegó dañada/incompleta. · ¿Cuándo recupero mi dinero? · ¿Sus servicios tienen garantía? · ¿Qué cubre la garantía? · ¿Puedo cancelar mi envío? · Me arrepentí, ¿puedo sacar mi mercancía?

**Respuesta (aprobada · escalar, sin afirmar política):** ¡Hola! Lamento mucho el inconveniente con tu carga 🙏. Tu caso es importante y queremos resolverlo bien. Cada situación de pérdida o daño se revisa **según las condiciones del servicio**, así que déjame conectarte con un **asesor** que lo atiende personalmente. Si ya eres cliente, también puedes abrir tu caso en **dtdcargo.com/portal**, sección **Soporte**.

**Pregunta de continuación:** *"¿Tienes a la mano tu Shipping Mark (el código DTD-XXXX)? Con ese código el asesor ubica tu envío sin que tengas que repetir la historia."*


**Si lo que pregunta es CANCELAR (no un daño), el bot sí puede dar el corte** — respuesta aprobada:
¡Hola! El punto de no retorno es la **salida del contenedor**. Mientras tu carga siga en nuestra bodega de China y el contenedor no haya zarpado, puedes arrepentirte: te despachamos la mercancía a donde nos digas. Pagas los costos que ya se hayan causado al recibirla y el flete desde nuestra bodega hasta ese nuevo destino, que se cancela aparte al momento de despacharla. Una vez que confirmamos la salida de tu carga de nuestro depósito en China, hasta ahí llega nuestro servicio: ese tramo lo ves directamente con la empresa de envíos y con quien la vaya a recibir. Y tenlo en cuenta antes de decidir: ese trayecto va **por fuera de nuestro seguro de carga**, porque la ventana para contratarlo se cierra cuando tu mercancía llega a nuestra bodega. Si el contenedor **ya zarpó**, el envío sigue su curso. ¿Me pasas tu **Shipping Mark** y te conecto con un asesor para verlo?

> *Nota interna: el bot NO afirma la política de reembolso (crédito vs efectivo) ni explica el seguro externo — eso lo maneja el asesor con contexto. Habilidad = escalar con empatía. Decisión founder 2026-06-07. **Ampliado 2026-08-20:** el corte por *salida del contenedor* sí es afirmable — está publicado en `/faq` y no depende del caso. Lo que se sigue escalando es el DINERO (cuánto se devuelve, crédito vs efectivo) y todo lo de pérdida o daño. ⚠️ **No menciones cargo por cancelación:** el Anexo A aún trae uno (5-10%, mín USD 30) que la regla comercial vigente ya no cobra — la corrección del contrato está anotada para la v3.1.*

### 18. Soporte: dificultades y sugerencias
**Preguntas:** ¿Cómo reporto un problema? · No puedo acceder a la sección. · Tengo una sugerencia/idea para mejorar.

**Respuesta:** ¡Hola! Lamentamos el inconveniente y agradecemos tus sugerencias. Si ya eres cliente, entra a **www.dtdcargo.com/portal**, sección **Soporte**, registra tu caso y dale seguimiento. Si no tienes acceso o necesitas ayuda para ingresar, escríbenos por aquí y un asesor te orienta enseguida.

**Pregunta de continuación:** *"¿Y lo tuyo es algo que no te está funcionando o más bien una idea para mejorar?"*

### 19. Reseñas
**Preguntas:** ¿Cómo dejo una opinión/reseña del servicio? · ¿Dónde dejo un comentario?

**Respuesta:** ¡Hola! Nos encantaría conocer tu opinión. Puedes compartir tu experiencia por aquí o etiquetándonos: Instagram **@dtdcargo.ve** · TikTok **@dtdcargo.ve**. ¡Gracias por ayudarnos a mejorar!

**Pregunta de continuación:** *"¿Y ese envío fue tu primera carga con nosotros o ya vas por varias?"*

### 20. Redes sociales
**Preguntas:** ¿Tienen redes sociales? · ¿Cuál es su Instagram/Facebook? · ¿Dónde los sigo?

**Respuesta:** ¡Hola! Síguenos: Instagram **https://www.instagram.com/dtdcargo.ve/** · TikTok **https://www.tiktok.com/@dtdcargo.ve** · YouTube **https://www.youtube.com/@dtdcargo** · WhatsApp **https://api.whatsapp.com/send/?phone=584121668021**. Novedades en **https://dtdcargo.com/noticias**.

**Pregunta de continuación:** *"Y para pasarte el contenido que más te sirva: ¿qué tipo de mercancía estás buscando traer?"*

### 21. Newsletter y darse de baja (fusión)
**Preguntas:** ¿Cómo me suscribo al newsletter? · ¿Cómo me doy de baja del boletín? · ¿Cómo recibo sus actualizaciones?

**Respuesta:** ¡Hola! Por ahora **no manejamos boletín ni newsletter** por correo, así que no hay nada a qué suscribirse ni de qué darte de baja. Para novedades, visita **https://dtdcargo.com/noticias**. Si en algún momento no deseas recibir nuestros mensajes, avísanos por aquí y lo gestionamos.

**Pregunta de continuación:** *"¿Y tú ya estás registrado con nosotros? Con el registro tienes tu portal del cliente para cargar tus compras y pre-alertas."*

---

## E · Producto, pago y cobertura (cobertura ampliada · 2026-06-08)
> Secciones nuevas que cierran huecos detectados al cruzar el FAQ con el sitio público (`lib/faqs.ts`), el catálogo de 19 servicios y los 4 productos. Grounded en contenido real de DTD (sin inventar).

### 22. Puerta a Puerta: qué incluye y cuándo se paga
**Preguntas:** ¿Qué es el Puerta a Puerta? · ¿Qué incluye el precio? · ¿Cuándo pago mi mercancía? · ¿Tengo que adelantar o dar depósito? · ¿Pago por adelantado? · ¿Qué es DDP? · ¿Hay alguna restricción? · ¿Qué condiciones tiene pagar al llegar? · ¿Hay letra chica? · ¿Cualquier mercancía aplica? · ¿A todo el mundo le dan pagar al llegar?

**Respuesta (aprobada · captura email):** ¡Hola! El **Puerta a Puerta** es nuestro servicio principal, y funciona así: **un solo precio que ya incluye el flete desde China, la aduana, los impuestos y la entrega en tu dirección** en Venezuela. No tienes que gestionar nada con la aduana ni te aparecen cobros sorpresa después.

Y sobre cuándo pagas: **no adelantas nada ni das depósito para embarcar.** El cobro arranca cuando tu carga **está por llegar**: entre **5 y 10 días antes de que toque puerto en Venezuela** un asesor te pasa el monto y los datos, con la referencia de tu **Shipping Mark**. *(Si usas compra asistida para pagarle al proveedor en China, eso se coordina aparte con el asesor.)*

El monto se calcula por **volumen (CBM)** y ciudad de destino. Míralo en **dtdcargo.com/tarifas** — es un estimado; el monto final lo confirma un asesor al reservar.

**Si el cliente pregunta si hay alguna restricción o condición** (no lo menciones tú si no pregunta): sí, hay **una sola** y es de sentido común — si el flete termina costando **más que la mercancía**, se pide un **50% por adelantado** (founder, 2026-08-20 — ya es público, está en `/faq`). La razón es que un envío donde el flete se come todo el valor de lo que traes no te conviene a ti ni a nosotros. Fuera de eso no hay requisitos. Si tienes dudas de si tu caso entra, pásame los datos y un asesor te lo confirma. Cierra ese mensaje preguntando *"¿más o menos en cuánto te salió la mercancía?"* — con ese dato el asesor confirma al toque si aplica.

**Pregunta de continuación (cuando NO preguntó por restricciones):** *"¿Cada cuánto sueles reponer mercancía?"* — separa al mayorista recurrente del que compra una sola vez, que es la información que más vale.

> *Nota interna: el diferenciador #1 de DTD, y **nadie más en el rubro lo comunica como promesa central** (ver `docs/marketing/competencia-precios.md`). NO hardcodear montos (van en la calculadora). ⚠️ **Corregido 2026-08-03:** esta sección decía "DDP" y "Financiamiento 100%". Ambos términos están **prohibidos**: "Financiamiento 100%" se retiró el 2026-06-09 por riesgo legal y "prepago" antes. La verdad comercial que sí se dice es **"pagas al llegar"**. La sigla DDP solo existe internamente (`puerta_a_puerta_DDP` en el enum); al cliente **siempre** es "Puerta a Puerta".*
>
> *⚠️ **Actualizado 2026-08-05 (founder):** (1) la frase es **"pagas al llegar"** — la misma del sitio público, el FAQ (`lib/faqs.ts`) y la calculadora, para que el cliente lea lo mismo en todos lados. **Nunca "pagas al recibir" ni "contra entrega":** el cobro cae cuando la carga llega al país, unos días antes de que el cliente la tenga en la puerta. ✅ **Actualizado 2026-08-20 (founder):** ahora SÍ se dice **"está por llegar"**, junto con la ventana concreta — *el cobro arranca de 5 a 10 días antes de que toque puerto*. Es el mismo copy que `lib/faqs.ts` y ya no es una variante suelta: el gancho **"pagas al llegar"** se mantiene intacto en el resto del sitio. Esta línea vetaba la frase desde el 2026-08-05 por inconsistencia; el founder la reactivó por escrito. ⛔ Lo que sigue prohibido es **"pagas al recibir"** y **"contra entrega"**. (2) 🔴 **El margen del ~30% (mercancía ≥ flete × 1,3) se RETIRÓ el 2026-08-20.** El founder pidió un solo número en todos lados. **Hay una única restricción y su disparo es `flete > mercancía`** — no existe más la banda intermedia entre 1× y 1,3×. Sigue siendo **reactiva** (no se menciona si el cliente no pregunta) y quien la detecta de verdad es el **ERP**, no el chat, así que el número final siempre lo confirma un asesor. (3) ✅ **El "50% del flete adelantado" quedó CERRADO el 2026-08-20.** Estuvo vetado desde el 2026-08-05 esperando confirmación escrita del founder; ya la dio, junto con la decisión de publicarlo. **El agente sí lo nombra ahora**, con el corte exacto: *si el flete termina costando más que la mercancía, se pide un 50% por adelantado*. No choca con "sin adelantos", porque "sin adelantos" es la regla general y esto es su única excepción. **Y es el único porcentaje del tema:** el margen del 30% que convivía con él se retiró el mismo día (ver el punto 2). Si ves un 30% en material viejo de pago, está obsoleto.*

### 23. Aduana e impuestos
**Preguntas:** ¿Quién paga la aduana? · ¿El precio incluye impuestos? · ¿Tengo que hacer trámites de aduana? · ¿Hay cobros sorpresa? · ¿Me nacionalizan la carga?

**Respuesta (aprobada · captura email):** ¡Hola! Sobre quién paga la aduana y los impuestos: con el **Puerta a Puerta la aduana y los impuestos ya van incluidos** en el precio que te damos. **No hay cobros sorpresa** ni tienes que gestionar nada con la aduana — de eso nos encargamos nosotros. Tú solo recibes tu mercancía en tu puerta.

⚠️ Ten en cuenta una cosa importante: con el Puerta a Puerta **la importación no queda a tu nombre** y no recibes documentos de nacionalización propios. Si necesitas que la importación quede a nombre de tu empresa, existe la modalidad **con tu propia aduana**: llevamos la carga hasta el almacén fiscal y tú asumes impuestos, permisos y gastos de nacionalización. **Esa decisión se toma antes de embarcar.**

El costo total se calcula por CBM y destino en **dtdcargo.com/tarifas**.

**Pregunta de continuación:** *"¿Necesitas que la importación quede a nombre de tu empresa, o te sirve recibirla sin trámites?"*

> *Nota interna: ⚠️ **el error de comparación #1 del rubro** — un cliente compara una tarifa Puerta a Puerta contra una tarifa hasta almacén fiscal como si incluyeran lo mismo. Aclararlo temprano evita perder la venta por precio. La distinción "a nombre de quién queda la importación" es de las que más se escalan: si el cliente insiste en documentos fiscales, **escalar a Comercial/Legal**.*

### 24. Cobertura de entrega (¿a qué ciudades?)
**Preguntas:** ¿A qué ciudades entregan? · ¿Entregan en toda Venezuela? · ¿Llega a mi ciudad (Caracas/Maracaibo/etc.)? · ¿Y si no estoy en Valencia? · ¿La entrega es a domicilio?

**Respuesta (aprobada · captura email):** ¡Hola! **Entregamos en toda Venezuela** 🇻🇪. Nuestra sede y bodega están en **Valencia**, y si estás en otra ciudad coordinamos el **last-mile hasta tu dirección** — como es **puerta a puerta**, no tienes que ir a buscar la carga a ningún puerto. Dime tu **ciudad** y tu **correo** y un asesor te confirma la entrega para tu caso.

**Pregunta de continuación:** *"¿En qué ciudad recibirías tu carga?"*

### 25. Qué puedo importar (productos restringidos)
**Preguntas:** ¿Qué productos puedo importar? · ¿Puedo traer baterías/líquidos/comida/cosméticos? · ¿Hay productos prohibidos? · ¿Qué no puedo enviar?

> ⚠️ **Las réplicas NO se responden aquí. Tienen su propia sección (§25-bis) y su respuesta es NO.**
> Nunca mezclarlas con los rubros de abajo: éstos se revisan caso por caso, las réplicas no se revisan.

**Respuesta (aprobada · captura email):** ¡Hola! Traemos una gran variedad de productos, pero **algunos rubros hay que revisarlos antes** (por normativa o por ser carga peligrosa: ciertas baterías, líquidos, aerosoles, alimentos, cosméticos, etc.). Para no fallar, **pásame tu lista de productos** y tu **correo**, y un asesor te confirma **qué sí se puede** y la mejor modalidad.

**Pregunta de continuación:** *"¿Qué tipo de mercancía quieres traer?"*

### 25-bis. Réplicas, imitaciones y copias de marca — **NO se trabaja**

**Preguntas:** ¿Puedo traer réplicas? · ¿Traen imitaciones? · ¿Copias de marca? · ¿Zapatos/ropa réplica (Nike, Hoka, On Running, New Balance…)? · ¿Traen AAA / clones / genéricos de marca? · ¿Y si no dice la marca? · ¿Puedo traer poquitas para probar?

**Respuesta (aprobada · founder 2026-08-06):** Con las réplicas e imitaciones de marca te soy directo: **eso no lo trabajamos.** Está totalmente prohibido para nuestros servicios, sin excepciones — **sólo se podría si tienes una autorización de la marca**, y eso es un permiso que otorga el titular, no un trámite que se gestiona con nosotros.

Pero si tu interés es ese mercado, hay un camino que sí funciona y suele dejar más: **traer el mismo tipo de producto con tu propia marca.** En China lo fabrican con tu logo y tu empaque, y esa mercancía sí viaja sin problema. Muchos de nuestros clientes empezaron justo así.

**Pregunta de continuación:** *"¿Te interesaría traer ese mismo producto con tu propia marca?"*

> *Nota interna — es una pregunta trampa, tratarla como tal:*
> - **NUNCA** decir "no siempre es posible", "depende del caso", "tiene restricciones" ni "un asesor te confirma bajo qué condiciones". Eso es un "quizás" y no lo hay.
> - **NUNCA** pasarlo con un asesor "para que evalúe": no hay nada que evaluar, y escalarlo le dice al cliente que existe una puerta.
> - **NUNCA** mandarlo a cotizar, ni a `dtdcargo.com/tarifas`, ni pedirle factura, proforma o lista de productos. *(Fue el error real del 2026-08-06: el agente cerró una conversación de réplicas invitando a cotizar el flete.)*
> - **Reconocer el rubro aunque no digan "réplica":** AAA, clon, imitación, copia, "tipo original", "calidad espejo", "genérico de marca", o nombrar marcas deportivas/lujo junto a un precio que no da.
> - El **redireccionamiento a marca propia es la parte útil**: no es un consuelo, es la venta real. Lleva a marca blanca / compra asistida.
> - Base legal: Anexo B del Acuerdo de Servicios v3.0 (rubros prohibidos). No citar el anexo al cliente; basta el "no lo trabajamos".

> *Nota interna: NUNCA afirmar una lista cerrada de prohibidos (varía por normativa/caso) → siempre escalar al asesor con la lista del cliente. **Excepción: las réplicas de marca NO se escalan — van por §25-bis y la respuesta es no.** El resto de esta lista sí es caso por caso. Captura email + producto. Rubros restringidos concretos para el asesor (Anexo B del Acuerdo v3.0 + adiciones 2026-07-10): baterías de litio sin UN38.3, inflamables y aerosoles, gases comprimidos y tóxicos, armas/municiones/réplicas y **juguetes bélicos**, **uniformes y accesorios militares**, medicamentos sin registro y psicotrópicos, perecederos, divisas/valores/metales preciosos, réplicas de marca y pirata, pirotecnia y explosivos. Juguetes bélicos + uniformes/accesorios militares aún NO están en el texto legal congelado → entran en el Anexo B de v3.1 (ver docs/legal/ACUERDO-PENDIENTES-v3.1.md).*

### 26. Consolidado (LCL) y juntar varios proveedores
**Preguntas:** ¿Qué es carga consolidada / LCL? · ¿Pueden juntar mi mercancía de varios proveedores? · ¿No lleno un contenedor, igual me traen? · ¿Cómo funciona el consolidado? · ¿Diferencia entre consolidado y contenedor completo?

**Respuesta (aprobada · captura email):** ¡Hola! En el **consolidado marítimo (LCL)** tu carga viaja junto a la de otros importadores y **pagas solo por el volumen que ocupas (CBM)** — es lo ideal cuando no llenas un contenedor completo. Y sí: **juntamos en nuestra bodega de Yiwu la mercancía de tus distintos proveedores** bajo tu mismo Shipping Mark, en un solo envío. **Tener varios proveedores no te obliga a contratar un contenedor completo.**

Si tienes mucho volumen sí te conviene el **contenedor completo (FCL)**, que se cotiza en **dtdcargo.com/fcl**. Para carga suelta, calcula tu CBM en **dtdcargo.com/tarifas**.

**Pregunta de continuación:** *"¿Cuántos proveedores juntarías?"*

> *Nota interna: 💡 dato de venta fuerte y poco conocido — la consolidación multi-proveedor bajo un mismo Shipping Mark. Muchos clientes creen que necesitan un contenedor completo solo porque le compran a tres fábricas distintas.*

### 27. Envío aéreo y muestras
**Preguntas:** ¿Hacen envío aéreo? · ¿Pueden traerme una muestra por avión? · ¿Tienen courier aéreo? · ¿Envío rápido por avión? · ¿Cuánto cuesta el aéreo?

**Respuesta (aprobada · captura email):** ¡Hola! Por ahora el **flete aéreo de carga está suspendido** — la carga va por vía **marítima** (consolidado LCL y contenedor completo FCL). Lo que **sí mantenemos activo** es el **courier express de muestras y documentos** pequeños (DHL/UPS/FedEx desde Yiwu): muestras pre-producción, documentos y lotes pequeños críticos — eso es paquetería urgente, **no carga aérea**. Apenas se reactive el aéreo de carga te avisamos: déjame tu **correo**. Y si tu carga puede ir por barco, te ayudo a cotizarla.

**Pregunta de continuación:** *"¿Lo que necesitas mover ahora es una muestra o ya es el pedido completo?"*

> *Nota interna: flete aéreo de CARGA **SUSPENDIDO** (founder 2026-06-08); courier de muestras/documentos **ACTIVO**. Captura email = lista de espera del aéreo. ✅ Coherencia web RESUELTA (SDD-0063): la web ya distingue courier de muestras (activo) de carga aérea (suspendida) en `lib/design-tokens.ts` SERVICES_CN, `/servicios`, `public/llms.txt` y una FAQ nueva en `lib/faqs.ts`.*

### 28. Dirección para recibir compras de Alibaba / 1688
**Preguntas:** ¿Cómo registro mi dirección para que mis paquetes lleguen por Alibaba u otra plataforma 1688? · ¿Qué dirección pongo en Alibaba / 1688 / Taobao? · ¿A dónde envío mis compras online de China? · ¿Cuál es la dirección de recepción de la bodega en China? · ¿Cómo le digo a mi proveedor a dónde enviar? · Dirección de entrega para mis pedidos de Alibaba

**Se responde en DOS pasos. No pegues la dirección en el primer mensaje.**

**Paso 1 — primera vez que la piden:** ¡Hola! Te la puedo dar sin problema, pero déjame decirte lo que de verdad te conviene: **regístrate gratis en dtdcargo.com/registro** y carga tu compra con su **pre-alerta**. Ahí pasan dos cosas que valen oro: a tu proveedor le llega un **enlace con todo lo que necesita** para despacharte, y tu compra queda **registrada en tu portal** desde el primer día. Y hay un detalle práctico: **la dirección sola no sirve** — el destinatario tiene que llevar **tu Shipping Mark**, porque si no, la caja llega a la bodega y no sabemos de quién es.

**Pregunta de continuación:** *"¿Te ayudo a sacar tu Shipping Mark ahora? Es un minuto."*

**Paso 2 — sólo si insiste o dice que la quiere igual:** ahí sí se la das completa, con el recordatorio del Shipping Mark en el nombre del destinatario:
收货人 / Nombre: DTD Cargo - [tu Shipping Mark]  (ej. DTD-1014)
电话 / Teléfono: +86 180 0689 1419
地址 / Dirección: 浙江省义乌市义乌港二期直通仓2栋2号 货7-货11
邮编 / Código postal: 322000
仓库联系人 / Contacto de bodega: 林冠 (Lin Guan)

> *Nota interna: dirección de recepción REAL para Alibaba/1688/Taobao (founder 2026-06-08). ⚠️ **Reordenada 2026-08-05 (founder):** antes se entregaba abierta en el primer mensaje y el agente la soltaba de una — verificado en el panel de prueba, incluyendo el contacto de bodega y el detalle de cargo. La instrucción vigente es **ofrecer el registro primero y darla sólo si insiste**, porque la pre-alerta es lo que le da seguimiento al cliente y le manda el enlace al proveedor. Esto ya no choca con #4: ambas difieren la dirección completa. La pauta equivalente está cargada en Kommo, pero **la fuente le gana a la pauta** — por eso el arreglo va acá.*

---

---

## F · Temas sin política cerrada — redactados como escalamiento

> **Por qué existen estas secciones.** El AI Agent de Kommo **solo responde cuando encuentra
> información relevante en sus Sources**. Un tema que no esté redactado acá no produce un "no sé":
> produce **silencio**, y el cliente queda en visto.
>
> Estos cinco temas **no tienen política comercial cerrada**, así que no se responden con un dato
> — se responden **escalando bien**, que es distinto de no responder.

### 29. Seguro de carga
**Preguntas:** ¿La carga va asegurada? · ¿Tienen seguro? · ¿Qué pasa si se pierde mi mercancía? · ¿Cubren daños? · ¿Puedo asegurar mi carga? · ¿Cuánto cuesta el seguro?

**Respuesta (escalar · NO afirmar cobertura):** ¡Hola! Sobre el seguro de carga: **el flete no incluye seguro**. Puedes contratar un **seguro de carga opcional** a través de nosotros, y hay un detalle de tiempo importante: se solicita **antes de que tu mercancía llegue a la bodega en China**, declarando su valor real. Una vez que la carga llega a bodega, esa ventana se cierra.

El alcance y el costo dependen de tu mercancía y su valor, así que te conecto con un asesor para que te lo arme bien.

**Pregunta de continuación:** *"¿Ya sabes el valor declarado de la mercancía que vas a traer?"*

> *Nota interna: ⚠️ **NUNCA usar la palabra "responsabilidad"** — dispara temas de seguros y obligaciones legales. **Nunca afirmar que algo "está cubierto"**. El dato duro (el flete no incluye seguro, la ventana se cierra al llegar a bodega en China) sale de `lib/faqs.ts` y del Acuerdo de Servicios. Precio y alcance → **Comercial/Legal**. Si el cliente pregunta por una carga YA perdida o dañada → sección 17, escalar con empatía.*

### 30. Documentos y requisitos de importación
**Preguntas:** ¿Qué documentos necesito para importar? · ¿Me dan factura? · ¿La importación queda a mi nombre? · ¿Necesito RIF o registro de importador? · ¿Me dan los documentos de nacionalización? · ¿Sirve para mi contabilidad?

**Respuesta (escalar · Comercial/Legal):** ¡Hola! Sobre los documentos de importación, la respuesta depende de la modalidad que elijas, y conviene definirlo **antes de embarcar**:

- Con **Puerta a Puerta**, tú recibes la mercancía pero **la importación no queda a tu nombre** y no recibes documentos de nacionalización propios.
- Con **tu propia aduana**, tú eres el importador y los documentos pueden quedar a nombre de tu empresa; en ese caso asumes impuestos, permisos y gastos del almacén fiscal.

Cambiar esto con la carga ya en tránsito puede no ser viable, así que si necesitas soporte fiscal es mejor decirlo desde ahora. Te conecto con un asesor para revisarlo.

**Pregunta de continuación:** *"¿Necesitas que la importación quede a nombre de tu empresa?"*

> *Nota interna: tema de **Comercial/Legal**, no del agente. El agente explica **la disyuntiva** (que sí está cerrada y documentada) y escala el caso concreto. Nunca prometer una factura ni un documento específico.*

### 31. Reserva de contenedor completo (FCL)
**Preguntas:** ¿Cómo reservo un contenedor? · ¿Cuánto cuesta un contenedor de 40 pies? · ¿Tienen contenedor dedicado? · ¿Puedo cargar en la fábrica de mi proveedor? · ¿Qué diferencia hay entre FCL en bodega y FCL directo?

**Respuesta (aprobada · captura email):** ¡Hola! Sobre reservar un contenedor completo, trabajamos dos modalidades:

- **FCL directo de fábrica** — el contenedor se carga en la fábrica de tu proveedor. Un punto que vale la pena que sepas: **el Bill of Lading lo emitimos nosotros, no la fábrica**, así que tu proveedor no puede cambiar el destino ni desviar el contenedor.
- **FCL en bodega** — nosotros armamos y consolidamos el contenedor en Yiwu, útil cuando reúnes mercancía de varios proveedores.

Para un estimado inmediato entra en **dtdcargo.com/fcl**. La reserva en firme la confirma un asesor, porque depende del cupo y de la fecha de salida.

**Pregunta de continuación:** *"¿La mercancía sale de un solo proveedor o de varios?"* — decide directo cuál de las dos modalidades aplica.

> *Nota interna: la calculadora pública de FCL da estimado en **40' High Cube**; otras medidas → asesor. El argumento del BL propio es el más fuerte de este servicio y casi no se usa en la conversación.*

### 32. Transporte terrestre nacional
**Preguntas:** ¿Hacen transporte dentro de Venezuela? · ¿Mueven carga nacional? · ¿Me llevan mercancía de una ciudad a otra?

**Respuesta (aprobada · no ofrecer como servicio activo):** ¡Hola! El **transporte terrestre nacional como servicio independiente** todavía no está activo — figura como **próximamente**.

Lo que sí hacemos hoy es la **entrega de tu carga importada hasta tu dirección** en toda Venezuela, que va incluida dentro del Puerta a Puerta. Si lo que necesitas es mover mercancía que ya está en el país, te conecto con un asesor para ver si podemos ayudarte.

**Pregunta de continuación:** *"¿La mercancía que quieres mover viene de China o ya está en Venezuela?"*

> *Nota interna: ⚠️ **NO ofrecerlo como servicio activo.** `lib/servicios-detalle.ts` lo marca `proximamente` con la ficha vacía a propósito. La entrega nacional de carga importada sí está viva y se cobra por m³ según el tramo (SDD-0237).*

### 33. Servicios de nicho (registro de marca, visado, permisología, etiquetado)
**Preguntas:** ¿Registran marcas en China? · ¿Ayudan con el visado chino? · ¿Hacen pruebas de laboratorio? · ¿Gestionan permisos sanitarios? · ¿Hacen etiquetado o preparación para Amazon FBA? · ¿Ofrecen almacenaje de largo plazo?

**Respuesta (escalar · sin precio ni promesa):** ¡Hola! Además de la logística tenemos algunos servicios de apoyo, pero el alcance de cada uno depende del caso, así que prefiero que lo veas con un asesor antes de que tomes una decisión — no quiero darte información a medias.

Cuéntame qué necesitas específicamente y te conecto con la persona que lo maneja.

**Pregunta de continuación:** *"¿Qué necesitas resolver exactamente?"*

> *Nota interna: ⚠️ **NUNCA dar precio ni prometer alcance en ninguno de estos.** El **registro de marca en China** en particular tiene el alcance comercial **sin cerrar** (honorarios, tiempos, exclusiones) — no ofrecerlo con precio ni prometer el registro. Todo esto va a **Operaciones** o **Comercial** según el caso. Esta sección existe para que el agente **diga algo** en vez de quedarse mudo, no para vender.*

---

### ✅ FAQ completo (33/33)
33 secciones con respuesta aprobada: 21 base + 7 de cobertura ampliada + **5 de escalamiento
(2026-08-03)**. Sin `[FILL]` pendientes.

⚠️ **Al actualizar: convertir a DOCX y subirlo a Kommo reemplazando el anterior.** Commitear el
`.md` no cambia nada en el CRM. Proceso en
[`docs/runbooks/kommo-reconfig.md`](../../../runbooks/kommo-reconfig.md).
**Tarea pública aparte:** ✅ HECHA (SDD-0063, 2026-06-08). La web ya diferencia el courier de muestras/documentos (activo) del flete aéreo de carga (suspendido); el copy de `lib/design-tokens.ts` SERVICES_CN ya era correcto y se reforzó en `/servicios`, `public/llms.txt`, `/track` (se quitó AWB) y `lib/faqs.ts`. NO reabrir.

### Puntos de negocio pendientes de definir (no bloquean el FAQ)
- **#7/#8 — link de inspección:** página web con menú de servicios + precios (tarifas) + muestra del reporte branded; **stand by** (mientras tanto lo envía el asesor). Plantillas listas: "Inspección de Producto (PSI)" + "Inspección de Fábrica".
- **#9 — compra asistida:** proveedor propio de DTD (no se revela contacto); falta decidir modelo comercial (margen/comisión/cobro).
Para cada una necesito: **qué incluye · entregable · tiempos · precio/cómo se cobra · cómo se solicita**.
