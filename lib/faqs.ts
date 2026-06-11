// ──────────────────────────────────────────────────────────────────
// FAQ — Preguntas frecuentes de DTD Cargo (página /faq)
// ──────────────────────────────────────────────────────────────────
// Contenido verificado adversarialmente (sin datos inventados: nada de tiempos
// en días ni precios forjados — tiempos/costos se remiten a la cotización).
// Cifras de bodegaje/seguro citan el Acuerdo de Servicios v3 (fuente legal,
// docs/legal/acuerdo-servicios-v3.mdx). Merge jun-2026: 14 FAQ SEO originales
// + FAQ maestro del paquete F4 (faq/FAQ-sitio-DTDCargo.md). Fuente única para
// /faq (UI + FAQPage schema.org). Voz: tuteo venezolano neutro, cero voseo.
//
// Cifras de mínimo y baterías = las MISMAS que aplica la calculadora pública
// (confirmadas en prod 2026-06-10): piso del flete = rates.min_charge de la
// tarifa pública (USD 50) · recargo baterías = calculator_settings
// .recargo_bateria_mult (×1.5 = +50%). Si esos valores cambian en
// /studio/tarifas, actualizar estas dos respuestas a mano.

export type Faq = { pregunta: string; respuesta: string };

export const FAQS: Faq[] = [
  {
    pregunta:
      "¿Qué significa DDP puerta a puerta y qué incluye el precio cuando importo de China con DTD Cargo?",
    respuesta:
      "DDP puerta a puerta significa que nosotros nos encargamos de todo: el precio ya incluye el flete desde China, la aduana y los impuestos, y te entregamos la mercancía en tu propia dirección en Venezuela. Tú no tienes que pelear con la aduana ni hacer trámites; nosotros llevamos la carga hasta tu puerta. El monto se calcula por volumen (CBM) y destino en nuestra calculadora o al cotizarte por WhatsApp.",
  },
  {
    pregunta:
      "¿Cuál es la diferencia entre consolidado (LCL) y contenedor completo (FCL) para traer mercancía de China a Venezuela?",
    respuesta:
      "En el consolidado marítimo (LCL) tu carga viaja junto a la de otros importadores y pagas solo por el volumen que ocupas (CBM), ideal cuando no tienes mercancía para llenar un contenedor. El contenedor completo (FCL) es para cuando tienes volumen suficiente y prefieres un contenedor entero para ti. Ambas son DDP puerta a puerta; cuál te conviene depende de cuánta carga tengas, y te orientamos al cotizar.",
  },
  {
    pregunta:
      "¿Quién paga la aduana y los impuestos, y cuándo tengo que pagarle a DTD Cargo?",
    respuesta:
      "La aduana y los impuestos ya van incluidos en el precio DDP, así que no recibes cobros sorpresa ni tienes que gestionar nada con la aduana: de eso nos encargamos nosotros. Además, pagas cuando la carga llega a Venezuela, no por adelantado (pueden aplicar restricciones). El costo total se calcula según el volumen (CBM) y tu destino.",
  },
  {
    pregunta:
      "Con DTD Cargo, ¿cuándo tengo que pagar la mercancía que traigo de China?",
    respuesta:
      "Pagas cuando tu carga llega a Venezuela, no antes: bajo la modalidad DDP puerta a puerta, el flete, la aduana y los impuestos van incluidos en el precio y cancelas al momento de la entrega. Pueden aplicar restricciones según el caso.",
  },
  {
    pregunta:
      "¿Tengo que adelantar plata o dar un depósito para mandar a buscar mi carga en China?",
    respuesta:
      "La idea es que no tengas que adelantar el costo del envío: pagas al llegar la mercancía a Venezuela (pueden aplicar restricciones). Lo que adelantes depende de tu caso (por ejemplo, si usas nuestro servicio de compra asistida para pagarle al proveedor en China), así que lo mejor es confirmar las condiciones con un asesor por WhatsApp antes de embarcar.",
  },
  {
    pregunta:
      "¿Cómo calculan el costo del envío desde China, por peso o por volumen?",
    respuesta:
      "El costo del consolidado marítimo se calcula por volumen (CBM, metros cúbicos) y por el destino dentro de Venezuela, no por peso. Puedes sacar una estimación en la calculadora online metiendo tu volumen y a dónde va, o pedir la cotización exacta por WhatsApp. El monto final y los tiempos se confirman al cotizar según la modalidad y la ruta.",
  },
  {
    pregunta: "¿Hay un mínimo para enviar con DTD Cargo?",
    respuesta:
      "Sí: el flete mínimo del consolidado marítimo es de USD 50 por envío — si tu carga ocupa muy poco volumen, ese es el piso que se factura. Lo bueno del consolidado es que puedes agrupar varias compras de distintos proveedores bajo tu mismo Shipping Mark para aprovecharlo mejor; la calculadora te muestra el monto exacto según tu volumen y destino.",
  },
  {
    pregunta:
      "¿Cuánto tarda en llegar mi carga de China a Venezuela con DTD Cargo?",
    respuesta:
      "El tiempo depende de la modalidad y la ruta: no es lo mismo un consolidado marítimo (LCL) que un contenedor completo (FCL), ni todas las rutas demoran igual. Apenas armamos tu cotización te confirmamos el tránsito estimado para tu caso puntual. Escríbenos por WhatsApp o usa la calculadora online y lo aterrizamos contigo.",
  },
  {
    pregunta:
      "¿A qué ciudades de Venezuela entregan y cómo funciona si no estoy en Valencia?",
    respuesta:
      "Entregamos en toda Venezuela. Tenemos bodega y equipo propios en Valencia, que es nuestra sede; si estás en otra ciudad coordinamos el last-mile hasta tu dirección. Como manejamos DDP puerta a puerta, la carga te llega hasta donde estés sin que tengas que ir a buscarla a un puerto o terminal.",
  },
  {
    pregunta: "¿Tienen casillero o bodega en China para recibir mis compras?",
    respuesta:
      "Sí. Tenemos bodega propia en Yiwu donde recibimos lo que compras en Alibaba, 1688, Taobao o a cualquier proveedor chino. Tú compras y pides que envíen a nuestra dirección con tu Shipping Mark; nosotros recibimos, consolidamos y despachamos a Venezuela.",
  },
  {
    pregunta: "¿Qué es el Shipping Mark y por qué debo ponerlo?",
    respuesta:
      "Es tu código único en DTD (formato DTD-XXXX). Identifica tu caja en la bodega, el sistema y todos los documentos. Ponlo siempre que puedas en el destinatario y en la caja: es lo que nos deja encontrar tu mercancía rápido y sin confusiones.",
  },
  {
    pregunta:
      "¿Cómo pongo la dirección de DTD Cargo en China (Alibaba) para que mi proveedor envíe a la bodega?",
    respuesta:
      "Cuando registres tu dirección de recepción en Alibaba (o se la pases a tu proveedor), usa la dirección de nuestra bodega en Yiwu y pon TU Shipping Mark en el nombre — eso es lo que nos permite saber que la caja es tuya cuando llega. Llénalo campo por campo así: País/región → China. Nombre o empresa → DTD Cargo - tu Shipping Mark (por ejemplo DTD-1014). Teléfono (+86) → 18006891419. Dirección → 浙江省义乌市义乌港二期直通仓2栋2号 货7-货11. Estado/provincia → 浙江省 (Zhejiang). Ciudad → 义乌市 (Yiwu; en el selector suele aparecer bajo 金华市, Jinhua). Código postal → 322000. Contacto de bodega → 林冠 (Lin Guan). Email → info@dtdcargo.com. La dirección va en chino porque es para el transporte dentro de China. Si tu Shipping Mark no aparece en el nombre, tu mercancía llega a la bodega pero no podemos identificar de quién es, así que no lo olvides. En esta misma página tienes la guía con botón de copiar campo por campo.",
  },
  {
    pregunta: "Ya mi proveedor envió, ¿qué hago ahora?",
    respuesta:
      "Carga tu pre-alerta en el portal: tu Shipping Mark, el número de guía (tracking) del proveedor y la descripción o packing list. Así sabemos que tu mercancía viene en camino y la recibimos a tu nombre.",
  },
  {
    pregunta:
      "Si envío a la bodega de DTD en China en vez de a Venezuela, ¿pierdo la protección de Alibaba?",
    respuesta:
      "No. La protección de Trade Assurance depende de que pagues dentro de Alibaba, no de la dirección de entrega. Solo pagar por fuera de la plataforma la anula.",
  },
  {
    pregunta: "¿Cuánto tiempo puede quedarse mi compra en la bodega?",
    respuesta:
      "En China tienes 15 días continuos de almacenaje gratis desde que llega tu mercancía; luego se coordina el despacho (permanencia máxima 60 días). En Venezuela tienes 15 días hábiles de gracia desde el arribo; a partir del día 16 se causa bodegaje por CBM/día. (Acuerdo de Servicios, cláusula 4.)",
  },
  {
    pregunta: "¿La carga está asegurada?",
    respuesta:
      "El flete no incluye seguro. Puedes contratar un seguro de carga opcional a través de DTD, solicitándolo antes de que tu mercancía llegue a la bodega de origen y declarando su valor real. Tenlo presente: la ventana para asegurar se cierra cuando la carga llega a la bodega en China.",
  },
  {
    pregunta:
      "¿Puedo enviar baterías o productos con batería (powerbanks, electrónica)?",
    respuesta:
      "Sí. Los equipos con baterías pequeñas (hasta 100 Wh, como powerbanks, teléfonos y laptops) viajan con un trámite simplificado si tu proveedor entrega el certificado UN38.3 y la hoja de seguridad (MSDS); por el manejo especial, el flete de la carga con baterías lleva un recargo del 50% — márcalo en la calculadora para que tu estimado ya lo incluya. Las baterías grandes, de scooter o paneles solares son mercancía peligrosa y necesitan documentos adicionales y un canal especial: escríbenos antes de comprar. Indícalo siempre en tu pre-alerta.",
  },
  {
    pregunta: "¿Puedo hacerle seguimiento a mi envío para saber dónde va?",
    respuesta:
      "Sí. En la sección Rastrear de la web metes tu BL (Bill of Lading) o tu código DTDU y ves los eventos del envío en vivo, sin necesidad de registrarte. Si no tienes el código a la mano, escríbenos por WhatsApp y te lo buscamos para que le hagas seguimiento.",
  },
  {
    pregunta:
      "¿Puedo rastrear con el número que me dio mi proveedor chino?",
    respuesta:
      "No. Ese número es del courier interno de China y solo sirve para el trayecto hasta nuestra bodega en Yiwu. Para seguir tu envío con DTD usa el código que te damos al abrir tu embarque, en dtdcargo.com/track.",
  },
  {
    pregunta: "¿DTD Cargo revisa la mercancía antes de embarcarla desde China?",
    respuesta:
      "Sí. Antes de embarcar hacemos inspección de la mercancía en la propia fábrica del proveedor, para verificar que lo que despachamos sea lo que compraste. Tenemos equipo y bodega propios en Yiwu, así que el control lo hace gente nuestra en China, no un tercero a distancia.",
  },
  {
    pregunta:
      "¿DTD Cargo tiene oficina propia en China y en Venezuela o es un intermediario?",
    respuesta:
      "Tenemos bodega y equipo propios en Yiwu (China) y en Valencia (Venezuela), operando desde 2008: la carga la maneja gente nuestra en los dos extremos, lo que nos deja controlar la recepción en China y la entrega puerta a puerta en Venezuela.",
  },
  {
    pregunta:
      "¿DTD Cargo hace envíos aéreos de China a Venezuela?",
    respuesta:
      "El flete aéreo de carga está temporalmente suspendido: hoy movemos la carga por vía marítima (consolidado LCL y contenedor completo FCL), siempre puerta a puerta. Lo que sí mantenemos activo es el courier express de muestras y documentos pequeños por DHL, UPS o FedEx desde Yiwu (muestras pre-producción, documentos y lotes pequeños críticos) — eso es paquetería urgente, no carga aérea. Si necesitas enviar una muestra o un documento, escríbenos por WhatsApp y lo coordinamos.",
  },
  {
    pregunta:
      "¿DTD Cargo me ayuda a comprar en China y qué tipo de productos puedo importar?",
    respuesta:
      "Sí, ofrecemos sourcing y compra asistida en China: te ayudamos a ubicar al proveedor y gestionar la compra antes de consolidar la carga. Para los rubros que puedes importar, lo mejor es consultarlo por WhatsApp con tu lista, porque depende del producto y la normativa; te confirmamos viabilidad y la modalidad (consolidado marítimo o contenedor completo) al cotizar.",
  },
];
