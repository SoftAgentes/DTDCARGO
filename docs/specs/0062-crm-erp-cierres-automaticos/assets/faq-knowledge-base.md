# Base de conocimiento FAQ — DTD CARGO (reestructurada)

> Fuente para Kommo (AI Agent + Respuestas sugeridas) y, opcionalmente, el sitio público.
> Reestructura del `DTDCARGO-Kommo-KnowledgeSource.docx` original (SDD-0062).
> **Cambios vs. original:** reordenado por frecuencia real (análisis de 401 conversaciones) · `"prepago/prepagado"` → **`Financiamiento 100%`** (regla de marca) · enlace a la calculadora · captura de email en cotización · secciones admin fusionadas · **5 secciones nuevas** (Validación, Verificación, Compra asistida, Cursos, Seguimiento) ya redactadas.
> Tono: español venezolano, cálido, claro y breve. Cada respuesta cierra invitando a continuar.

---

## A · Comercial (alta frecuencia)

### 1. Cómo iniciar un envío (registro · Shipping Mark)
**Preguntas:** ¿Cómo empiezo a enviar con ustedes? · Ya compré en China, ¿ahora qué hago? · ¿Cómo registro mi compra? · ¿Cómo me registro como cliente? · ¿Qué tengo que hacer para enviar? · Ya hice mi compra en 1688, ¿cuál es el siguiente paso? · ¿Cómo abro una cuenta? · ¿Qué es una pre-alerta? · ¿Qué es el casillero? · ¿Qué es el Shipping Mark (Markbox)? · Cómo empiezo a importar.

**Respuesta (aprobada · corta):** ¡Hola! Súper fácil 👇 Regístrate en **dtdcargo.com/registro**: al instante recibes tu **Shipping Mark** (唛头, para marcar tus cajas en China), tu **portal de seguimiento** y las **pre-alertas**. ¿Te paso el enlace o prefieres que un asesor te guíe?

### 2. Cotización y tarifas (CBM)
**Preguntas:** ¿Cuánto cuesta enviar de China a Venezuela? · ¿Cuánto me sale traer mercancía de China? · ¿Cómo cobran el flete? · ¿Cobran por peso o por volumen? · ¿Cuánto cobran por CBM? · ¿Qué precio tiene el envío? · ¿Cuánto cuesta un contenedor completo? · ¿Tienen servicio aéreo? · ¿Qué es DDP? · ¿Cuál es el costo del envío marítimo?

**Habilidad de respuesta:** DIRIGIR A LA HERRAMIENTA (la calculadora tiene la lógica + tarifa viva). La IA **NO cotiza en el chat** (evita números viejos e ida y vuelta).

**Respuesta:** ¡Hola! El costo depende del **volumen (CBM)** de tu carga, y lo bueno es que **lo calculas tú mismo al instante** en nuestra calculadora, que ya tiene la **tarifa vigente**: 👉 **dtdcargo.com/calculadora**. Solo metes las medidas de tus cajas y te da el estimado en segundos.
Trabajamos envíos **marítimos**: LCL (carga suelta puerta a puerta), FCL (contenedor completo) y **DDP — Financiamiento 100%** (pagas pocos días antes de la entrega). El aéreo está temporalmente desactivado.
Para **contenedor completo (FCL), carga especial o una cotización formal**, déjame tu **correo** y un asesor te la arma a medida. ¿Te sirve la calculadora o prefieres que te cotice un asesor?

> *Notas internas: (1) NO hardcodear tarifas $ ni la regla CBM en el chat — eso vive en la calculadora (dtdcargo.com/calculadora). (2) El pedido de email alimenta la reactivación (SDD-0062 · Slice D). (3) FCL/carga especial/DDP no están en la calculadora pública → ahí sí escala a asesor.*

### 3. Tiempos de tránsito
**Preguntas:** ¿Cuánto tarda en llegar de China a Venezuela? · ¿Cuánto tiempo demora el envío? · ¿En cuánto tiempo llega mi carga? · ¿Cuántos días tarda el barco? · ¿Cuánto se demora la mercancía? · ¿Cuánto tiempo de tránsito marítimo? · Cuánto dura el envío.

**Respuesta (aprobada · corta):** ¡Hola! Sin cuentos: tu carga va en **barco**, así que tarda **60 a 90 días** (flete interno en China + la espera de la próxima salida, cada 15-21 días + la travesía marítima). Puede variar por aduana o clima. ¿Quieres seguir tu envío? Regístrate en **dtdcargo.com/registro** y lo ves en tu portal.

### 4. Cómo enviar a nuestra bodega en China
**Preguntas:** ¿A qué dirección le digo a mi proveedor que envíe? · ¿Cuál es la dirección de su bodega en China? · ¿Dónde envía mi proveedor la mercancía? · ¿Cómo marco mis cajas? · ¿Qué dirección le doy a mi proveedor chino? · ¿Cómo identifico mis cajas en su almacén? · ¿Qué instrucciones le doy a mi proveedor?

**Respuesta (aprobada):** ¡Hola! Para que tu proveedor te cotice el flete interno (**FOB** o **EXW**), pásale esta dirección de **referencia**. 👇 **Copia y pégasela a tu proveedor:**

📋 **Yiwu Port Phase II, Warehouse 2, No. 2, Yiwu City, Zhejiang, China**

Con eso te cotiza el costo hasta nuestra bodega. Ojo: es **solo de referencia para cotizar**. La **dirección completa para enviar** (con el detalle de cargo) + tus **códigos QR del Shipping Mark** los recibes al **registrarte** y generar tu pre-alerta: **dtdcargo.com/registro**.

> *Nota interna: dirección de referencia = la completa SIN el detalle "(Cargo 7-11)", que se entrega solo al registrar/pre-alertar. Decisión founder 2026-06-07.*

### 5. Incoterms: FOB y EXW
**Preguntas:** ¿Qué es FOB? · ¿Qué es EXW? · ¿Qué diferencia hay entre FOB y EXW? · Mi proveedor me dio precio FOB/EXW, ¿qué hago? · ¿Qué es un Incoterm? · ¿Quién paga el flete interno en China? · ¿El precio incluye llevar al puerto? · No entiendo los términos de mi proveedor.

**Respuesta (aprobada · corta):** ¡Hola! Sencillo:
🔹 **FOB:** el proveedor **incluye** el flete interno en China (llevar la carga hasta nuestra bodega). Te cotiza con la dirección de referencia.
🔹 **EXW:** el precio es **solo la mercancía** en su fábrica; el flete interno **lo pagas tú**.
En resumen: con FOB lo cubre el proveedor; con EXW lo cubres tú. Saberlo te ayuda a **comparar precios reales**. ¿Tu proveedor te lo dio en FOB o EXW? Te ayudo a ver tu costo total.

### 6. Métodos de pago
**Preguntas:** ¿Qué métodos de pago aceptan? · ¿Puedo pagar con tarjeta/Visa/Mastercard? · ¿Puedo pagar con enlace o QR? · ¿Aceptan PayPal? · ¿Cómo/dónde pago la compra o el servicio?

**Respuesta (aprobada · corta):** ¡Hola! Trabajamos varias divisas:
💵 **USD:** Zelle · Wire · efectivo en oficina
🇻🇪 **Bs:** Pago Móvil · transferencia
🟡 **USDT:** Binance
🇨🇳 **Yuan:** efectivo en China · Alipay · WeChat Pay · transferencia
Para los **datos exactos** según tu envío, un asesor te los pasa de forma segura. Y al **registrarte**, puedes aclarar cualquier otra información — la encuentras en tu sección de **preguntas y respuestas**: **dtdcargo.com/registro**.

> *Nota interna: cierre reutilizable — "al registrarte, lo demás está en tu sección de preguntas y respuestas del portal" (patrón dirigir-a-herramienta + portal). Decisión founder 2026-06-07.*

---

## B · Servicios (secciones nuevas — requieren datos del founder)

### 7. Validación de proveedores
**Preguntas:** ¿Validan proveedores en China? · ¿Cómo sé si mi proveedor es confiable? · ¿Hacen verificación de fábrica? · ¿Qué incluye la validación de proveedor? · ¿Cuánto cuesta validar un proveedor? · ¿Validación digital o presencial?

**Respuesta (aprobada · captura email + link):** ¡Hola! Sí ✅ Validamos proveedores y fábricas en China para que compres seguro: **auditoría de legitimidad** (validez legal, capacidad, instalaciones) e **inspección pre-producción y pre-embarque**. Déjame tu **correo**: validamos tus datos y un asesor te pasa el **link** donde ves los **servicios de inspección con sus precios** y un ejemplo del reporte. ¿Me dejas tu correo y lo revisamos?

> *Nota interna: el "link" muestra el menú de servicios de inspección con precios (tarifas etiquetadas) + la muestra del reporte branded. Página/link **EN CONSTRUCCIÓN (stand by)** → mientras tanto el asesor lo envía a mano. Plantillas de reporte listas: **"Inspección de Producto (PSI)"** + **"Inspección de Fábrica (auditoría /100)"** (samples branded HTML en Downloads del founder). Captura de email obligatoria. Decisión founder 2026-06-08.*

### 8. Verificación de mercancía
**Preguntas:** ¿Revisan la mercancía antes de enviarla? · ¿Hacen inspección de calidad? · ¿Verifican cantidad y estado de mi pedido? · ¿Qué incluye la verificación de mercancía? · ¿Cuánto cuesta? · ¿Toman fotos/video?

**Respuesta (aprobada · captura email + link):** ¡Hola! Sí ✅ Antes de embarcar **inspeccionamos tu mercancía en la fábrica del proveedor** para confirmar que lo que sale sea **lo que compraste**: cantidad, calidad y especificaciones contra tu ficha técnica, con **muestreo AQL** y **evidencia fotográfica**. Déjame tu **correo**: validamos tus datos y un asesor te pasa el **link** donde ves los **servicios de inspección con sus precios** y un ejemplo del reporte. ¿Me dejas tu correo y activamos la inspección?

> *Nota interna: corresponde al reporte **"Inspección de Producto (PSI)"** (muestreo AQL + galería de defectos + conformidad). Mismo patrón #7: captura email obligatoria + link con precios (stand by, lo envía el asesor) + ejemplo del reporte branded. Decisión founder 2026-06-08.*

### 9. Compra asistida
**Preguntas:** ¿Me ayudan a comprar en China? · No sé comprar en 1688/Alibaba, ¿me asisten? · ¿Compran por mí? · ¿Qué es la compra asistida? · ¿Cuánto cobran por la compra asistida? · ¿Negocian con el proveedor por mí?

**Respuesta (aprobada · captura email):** ¡Hola! Sí ✅ Con la **compra asistida** somos tu **departamento de compras en China**: te ayudamos a **ubicar al proveedor, negociar y gestionar la compra** (incluso **pagarle al proveedor**) antes de consolidar tu carga. Mándame tu **lista de productos** por aquí y tu **correo**, y un asesor te confirma **viabilidad, modalidad y costo**. ¿Empezamos con tu lista?

> *Nota interna (⚠️ PENDIENTE de definir — founder 2026-06-08): en compra asistida **el proveedor lo pone DTD (red propia)** — el bot NUNCA revela datos/contacto del proveedor; DTD ubica, negocia, paga y gestiona por dentro (protege contra que el cliente compre directo). Falta decidir el modelo comercial: margen vs comisión, cómo se cobra, hasta dónde se le cuenta al cliente. La frase "ubicar al proveedor" se mantiene porque describe el servicio, no entrega el contacto.*

### 10. Cursos
**Preguntas:** ¿Dan cursos de importación? · ¿Cómo me inscribo al curso? · ¿Cuánto cuesta el curso? · ¿Qué incluye el curso? · ¿Es online o presencial? · ¿Cuándo es el próximo curso?

**Respuesta (aprobada · captura email):** ¡Hola! Por ahora **no tenemos cursos disponibles**, pero estamos por **activarlos muy pronto** 🚀. Déjame tu **correo** y te aviso apenas abramos el próximo curso (**presencial u online**). ¿Me lo dejas?

> *Nota interna: cursos por activar; la captura de email arma la **lista de espera** para avisar al lanzar. Actualizar esta sección cuando haya temario/modalidad/precio/fechas. Decisión founder 2026-06-08.*

### 11. Seguimiento / Tracking
**Preguntas:** ¿Cómo rastreo mi envío? · ¿Dónde veo el estado de mi carga? · ¿Tienen tracking? · ¿Cómo sé dónde va mi mercancía? · Quiero el estado de mi pedido.

**Respuesta (aprobada):** ¡Hola! Sigue tu carga así: con tu **código** en **dtdcargo.com/track**, o desde tu **portal** (**dtdcargo.com/portal**), donde ves cada etapa de tus pre-alertas y envíos. ¿No tienes el código a mano? Pásame tu **Shipping Mark** y un asesor te ubica el estado.

---

## C · Empresa e información general

### 12. Ubicación (oficinas)
**Preguntas:** ¿Cómo puedo llegar? · ¿Cuál es la dirección de tu oficina? · ¿En qué zona/ciudad están? · ¿Cómo puedo contactarte?

**Respuesta:** ¡Hola! Con gusto te oriento.
- **Venezuela:** oficina en **Valencia**. Mapa: https://maps.app.goo.gl/76T5MAeeTyynwV1M6 · datos de contacto en el pie de **www.dtdcargo.com** o en "Contáctenos".
- **China:** bodegas en **Yiwu**. La dirección exacta se entrega a clientes registrados (cada envío tiene su proceso). Si ya compraste, regístrate en **www.dtdcargo.com/registro** y te indicamos dirección y pasos.
¿Puedo ayudarte en algo más?

### 13. Horario laboral
**Preguntas:** ¿Cuáles son sus horarios de atención? · ¿Qué días abren? · ¿Trabajan fines de semana? · ¿A qué hora abren/cierran?

**Respuesta:** ¡Hola! Nuestros horarios:
- **Oficina (Venezuela):** lunes a viernes, 9:00 a.m. a 5:00 p.m.
- **WhatsApp:** todos los días, 8:00 a.m. a 8:00 p.m.
Y entre nosotros... muchas veces andamos casi 24 horas pegados al teléfono, así que es muy probable que te respondamos incluso fuera de horario. ¿En qué te ayudamos?

### 14. Experiencia de la empresa
**Preguntas:** ¿Hace cuánto operan? · ¿Cuántos años llevan en el mercado? · ¿Cuál es su experiencia? · ¿Desde qué año operan?

**Respuesta:** ¡Hola! **DTD CARGO opera desde 2008** en logística internacional puerta a puerta entre China y Venezuela, con carga consolidada. Acompañamos todo el proceso: compra, consolidación y envío hasta destino. Más en **www.dtdcargo.com**. ¿En qué puedo ayudarte?

### 15. DoorTuDoor y DTD CARGO (misma empresa)
**Preguntas:** ¿DoorTuDoor y DTD Cargo son lo mismo? · ¿Son la misma empresa? · ¿Qué significa DTD? · ¿Por qué dos nombres? · En Instagram son DoorTuDoor pero la web es DTD Cargo.

**Respuesta:** ¡Hola! Sí, **somos la misma empresa**. **DoorTuDoor** es el nombre con que nacimos como marca, y evolucionamos a **DTD CARGO** ("DTD" = abreviación de DoorTuDoor). Por eso nos ves como "DoorTuDoor" en redes y "DTD CARGO" en la web: mismo equipo, mismo servicio. Puedes confiar en cualquiera de los dos nombres. ¿En qué te ayudamos?

---

## D · Postventa, soporte y administrativas (fusionadas)

### 16. Descuentos y ofertas (fusión de "Venta" + "Descuento")
**Preguntas:** ¿Tienen descuentos/ofertas? · ¿Puedo pedir un descuento? · ¿Ofrecen mejor precio por volumen? · ¿Hay promociones vigentes?

**Respuesta (aprobada):** ¡Hola! Sí 👍 De hecho **premiamos el volumen y la frecuencia**: mientras **más CBM** traigas, mejor tarifa, y nuestros **clientes frecuentes** tienen las mejores condiciones. Cuéntame: ¿cuántos **CBM** (o medidas) llevas y a qué **ciudad**? Calcula tu base en **dtdcargo.com/calculadora** y déjame tu **correo** para que un asesor te arme la tarifa con tu descuento. Si importas seguido, te conviene **registrarte** (**dtdcargo.com/registro**): guardas tu historial y haces recompra fácil con mejores condiciones.

> *Nota interna: objetivo de negocio PRIORITARIO (founder 2026-06-07) = clientes FRECUENTES y de ALTO volumen. El agente debe identificar/nutrir ese perfil e incentivar el registro para retención/recompra.*

### 17. Reembolsos, devoluciones y garantía (fusión de 3 secciones)
**Preguntas:** ¿Puedo obtener un reembolso? · ¿Cuáles son sus políticas de reembolso? · Mi carga llegó dañada/incompleta. · ¿Cuándo recupero mi dinero? · ¿Sus servicios tienen garantía? · ¿Qué cubre la garantía?

**Respuesta (aprobada · escalar, sin afirmar política):** ¡Hola! Lamento mucho el inconveniente con tu carga 🙏. Tu caso es importante y queremos resolverlo bien. Cada situación de pérdida o daño se revisa **según las condiciones del servicio**, así que déjame conectarte con un **asesor** que lo atiende personalmente. Si ya eres cliente, también puedes abrir tu caso en **dtdcargo.com/portal**, sección **Soporte**. ¿Te paso con un asesor ahora?

> *Nota interna: el bot NO afirma la política de reembolso (crédito vs efectivo) ni explica el seguro externo — eso lo maneja el asesor con contexto. Habilidad = escalar con empatía. Decisión founder 2026-06-07.*

### 18. Soporte: dificultades y sugerencias
**Preguntas:** ¿Cómo reporto un problema? · No puedo acceder a la sección. · Tengo una sugerencia/idea para mejorar.

**Respuesta:** ¡Hola! Lamentamos el inconveniente y agradecemos tus sugerencias. Si ya eres cliente, entra a **www.dtdcargo.com/portal**, sección **Soporte**, registra tu caso y dale seguimiento. Si no tienes acceso o necesitas ayuda para ingresar, escríbenos por aquí y un asesor te orienta enseguida. ¿En qué te ayudamos?

### 19. Reseñas
**Preguntas:** ¿Cómo dejo una opinión/reseña del servicio? · ¿Dónde dejo un comentario?

**Respuesta:** ¡Hola! Nos encantaría conocer tu opinión. Puedes compartir tu experiencia por aquí o etiquetándonos: Instagram **@doortudoor_** · TikTok **@doortudoor**. ¡Gracias por ayudarnos a mejorar!

### 20. Redes sociales
**Preguntas:** ¿Tienen redes sociales? · ¿Cuál es su Instagram/Facebook? · ¿Dónde los sigo?

**Respuesta:** ¡Hola! Síguenos: Instagram **https://www.instagram.com/doortudoor_/** · TikTok **https://www.tiktok.com/@doortudoor** · YouTube **https://www.youtube.com/@doortudoor** · WhatsApp **https://api.whatsapp.com/send/?phone=584121668021**. Novedades en **https://dtdcargo.com/noticias**. ¿En qué podemos ayudarte?

### 21. Newsletter y darse de baja (fusión)
**Preguntas:** ¿Cómo me suscribo al newsletter? · ¿Cómo me doy de baja del boletín? · ¿Cómo recibo sus actualizaciones?

**Respuesta:** ¡Hola! Por ahora **no manejamos boletín ni newsletter** por correo, así que no hay nada a qué suscribirse ni de qué darte de baja. Para novedades, visita **https://dtdcargo.com/noticias**. Si en algún momento no deseas recibir nuestros mensajes, avísanos por aquí y lo gestionamos. ¿Te ayudo en algo más?

---

## E · Producto, pago y cobertura (cobertura ampliada · 2026-06-08)
> Secciones nuevas que cierran huecos detectados al cruzar el FAQ con el sitio público (`lib/faqs.ts`), el catálogo de 19 servicios y los 4 productos. Grounded en contenido real de DTD (sin inventar).

### 22. DDP y Financiamiento 100% (qué incluye · cuándo se paga)
**Preguntas:** ¿Qué es DDP? · ¿Qué incluye el precio DDP? · ¿Cuándo pago mi mercancía? · ¿Tengo que adelantar o dar depósito? · ¿Qué es el Financiamiento 100%? · ¿Pago por adelantado?

**Respuesta (aprobada · captura email):** ¡Hola! **DDP puerta a puerta** = nos encargamos de todo: el precio ya incluye **flete + aduana + impuestos**, y te entregamos en tu dirección en Venezuela. Y con el **Financiamiento 100%** pagas **cuando tu carga llega a Venezuela**, no por adelantado (nosotros financiamos el trayecto). *(Si usas compra asistida para pagarle al proveedor en China, eso se confirma aparte con el asesor.)* El monto se calcula por **volumen (CBM)** y destino: míralo en **dtdcargo.com/calculadora** o déjame tu **correo** y un asesor te lo arma. ¿Te ayudo a calcularlo?

> *Nota interna: el diferenciador #1 de DTD. NO hardcodear montos (van en la calculadora). "prepago/prepagado" → "Financiamiento 100%" (regla de marca).*

### 23. Aduana e impuestos
**Preguntas:** ¿Quién paga la aduana? · ¿El precio incluye impuestos? · ¿Tengo que hacer trámites de aduana? · ¿Hay cobros sorpresa? · ¿Me nacionalizan la carga?

**Respuesta (aprobada · captura email):** ¡Hola! Tranquilo: con **DDP la aduana y los impuestos ya van incluidos** en el precio — **no hay cobros sorpresa** ni tienes que gestionar nada con la aduana, de eso nos encargamos nosotros. Tú solo recibes tu mercancía en tu puerta. El costo total se calcula por **CBM** y destino en **dtdcargo.com/calculadora**; déjame tu **correo** y un asesor te lo detalla. ¿Te cotizo?

### 24. Cobertura de entrega (¿a qué ciudades?)
**Preguntas:** ¿A qué ciudades entregan? · ¿Entregan en toda Venezuela? · ¿Llega a mi ciudad (Caracas/Maracaibo/etc.)? · ¿Y si no estoy en Valencia? · ¿La entrega es a domicilio?

**Respuesta (aprobada · captura email):** ¡Hola! **Entregamos en toda Venezuela** 🇻🇪. Nuestra sede y bodega están en **Valencia**, y si estás en otra ciudad coordinamos el **last-mile hasta tu dirección** — como es **puerta a puerta**, no tienes que ir a buscar la carga a ningún puerto. Dime tu **ciudad** y tu **correo** y un asesor te confirma la entrega para tu caso. ¿A dónde llegaría tu carga?

### 25. Qué puedo importar (productos restringidos)
**Preguntas:** ¿Qué productos puedo importar? · ¿Puedo traer baterías/líquidos/comida/cosméticos? · ¿Hay productos prohibidos? · ¿Puedo traer réplicas o productos de marca? · ¿Qué no puedo enviar?

**Respuesta (aprobada · captura email):** ¡Hola! Traemos una gran variedad de productos, pero **algunos rubros tienen restricciones** (por normativa o por ser carga peligrosa: ciertas baterías, líquidos, aerosoles, alimentos, réplicas de marca, artículos militares o bélicos, etc.). Para no fallar, **pásame tu lista de productos** y tu **correo**, y un asesor te confirma **qué sí se puede** y la mejor modalidad. ¿Me dices qué quieres traer?

> *Nota interna: NUNCA afirmar una lista cerrada de prohibidos (varía por normativa/caso) → siempre escalar al asesor con la lista del cliente. Captura email + producto. Rubros restringidos concretos para el asesor (Anexo B del Acuerdo v3.0 + adiciones 2026-07-10): baterías de litio sin UN38.3, inflamables y aerosoles, gases comprimidos y tóxicos, armas/municiones/réplicas y **juguetes bélicos**, **uniformes y accesorios militares**, medicamentos sin registro y psicotrópicos, perecederos, divisas/valores/metales preciosos, réplicas de marca y pirata, pirotecnia y explosivos. Juguetes bélicos + uniformes/accesorios militares aún NO están en el texto legal congelado → entran en el Anexo B de v3.1 (ver docs/legal/ACUERDO-PENDIENTES-v3.1.md).*

### 26. Consolidado (LCL) y juntar varios proveedores
**Preguntas:** ¿Qué es carga consolidada / LCL? · ¿Pueden juntar mi mercancía de varios proveedores? · ¿No lleno un contenedor, igual me traen? · ¿Cómo funciona el consolidado? · ¿Diferencia entre consolidado y contenedor completo?

**Respuesta (aprobada · captura email):** ¡Hola! En el **consolidado marítimo (LCL)** tu carga viaja junto a la de otros importadores y **pagas solo por el volumen que ocupas (CBM)** — ideal cuando no llenas un contenedor. Y sí: **juntamos en nuestra bodega de Yiwu la mercancía de tus distintos proveedores** en un solo envío. Si tienes mucho volumen, te conviene un **contenedor completo (FCL)**; te orientamos al cotizar. Calcula tu CBM en **dtdcargo.com/calculadora** y déjame tu **correo** para armarte la opción. ¿Cuántos proveedores juntarías?

### 27. Envío aéreo y muestras
**Preguntas:** ¿Hacen envío aéreo? · ¿Pueden traerme una muestra por avión? · ¿Tienen courier aéreo? · ¿Envío rápido por avión? · ¿Cuánto cuesta el aéreo?

**Respuesta (aprobada · captura email):** ¡Hola! Por ahora el **flete aéreo de carga está suspendido** — la carga va por vía **marítima** (consolidado LCL y contenedor completo FCL). Lo que **sí mantenemos activo** es el **courier express de muestras y documentos** pequeños (DHL/UPS/FedEx desde Yiwu): muestras pre-producción, documentos y lotes pequeños críticos — eso es paquetería urgente, **no carga aérea**. Apenas se reactive el aéreo de carga te avisamos: déjame tu **correo**. Y si tu carga puede ir por barco, te ayudo a cotizarla. ¿Te calculo el marítimo o necesitas enviar una muestra?

> *Nota interna: flete aéreo de CARGA **SUSPENDIDO** (founder 2026-06-08); courier de muestras/documentos **ACTIVO**. Captura email = lista de espera del aéreo. ✅ Coherencia web RESUELTA (SDD-0063): la web ya distingue courier de muestras (activo) de carga aérea (suspendida) en `lib/design-tokens.ts` SERVICES_CN, `/servicios`, `public/llms.txt` y una FAQ nueva en `lib/faqs.ts`.*

### 28. Dirección para recibir compras de Alibaba / 1688
**Preguntas:** ¿Cómo registro mi dirección para que mis paquetes lleguen por Alibaba u otra plataforma 1688? · ¿Qué dirección pongo en Alibaba / 1688 / Taobao? · ¿A dónde envío mis compras online de China? · ¿Cuál es la dirección de recepción de la bodega en China? · ¿Cómo le digo a mi proveedor a dónde enviar? · Dirección de entrega para mis pedidos de Alibaba

**Respuesta (aprobada · captura email):** ¡Hola! Para que tus compras de **Alibaba / 1688 / Taobao** lleguen a nuestra bodega en China, pon ESTA dirección como destino del pedido, con **tu código Shipping Mark (唛头) en el nombre del destinatario** (así sabemos que la caja es tuya):
收货人 / Nombre: DTD Cargo - [tu Shipping Mark]  (ej. DTD-1014)
电话 / Teléfono: +86 180 0689 1419
地址 / Dirección: 浙江省义乌市义乌港二期直通仓2栋2号 货7-货11
邮编 / Código postal: 322000
仓库联系人 / Contacto de bodega: 林冠 (Lin Guan)
¿Aún no tienes tu Shipping Mark? Regístrate gratis en dtdcargo.com/registro (te lo dan al instante) y déjame tu correo. ¿Te paso el enlace?

> *Nota interna: dirección de recepción REAL para Alibaba/1688/Taobao (provista por founder 2026-06-08). El nombre del destinatario lleva el Shipping Mark del cliente → necesita registrarse. ⚠️ Revisar coherencia con #4 "Cómo enviar a nuestra bodega" (hoy defiere la dirección completa al registro); el founder decidió darla abierta para el flujo Alibaba.*

---

### ✅ FAQ completo (28/28)
Todas las secciones tienen respuesta aprobada (21 base + 7 de cobertura ampliada). Sin `[FILL]` pendientes. Listo para convertir a DOCX y subir a Kommo (reemplaza el knowledge source de 20 secciones).

**Huecos de menor prioridad — pendientes de decisión (NO redactados aún):** Reserva FCL (dedicada) · Seguro de carga (proactivo) · Documentos/requisitos de importación · ¿**transporte terrestre** entra al FAQ? · servicios de nicho (registro de marca · visado chino · lab testing/permisología · etiquetado/Amazon FBA · almacenaje).
**Tarea pública aparte:** ✅ HECHA (SDD-0063, 2026-06-08). La web ya diferencia el courier de muestras/documentos (activo) del flete aéreo de carga (suspendido); el copy de `lib/design-tokens.ts` SERVICES_CN ya era correcto y se reforzó en `/servicios`, `public/llms.txt`, `/track` (se quitó AWB) y `lib/faqs.ts`. NO reabrir.

### Puntos de negocio pendientes de definir (no bloquean el FAQ)
- **#7/#8 — link de inspección:** página web con menú de servicios + precios (tarifas) + muestra del reporte branded; **stand by** (mientras tanto lo envía el asesor). Plantillas listas: "Inspección de Producto (PSI)" + "Inspección de Fábrica".
- **#9 — compra asistida:** proveedor propio de DTD (no se revela contacto); falta decidir modelo comercial (margen/comisión/cobro).
Para cada una necesito: **qué incluye · entregable · tiempos · precio/cómo se cobra · cómo se solicita**.
