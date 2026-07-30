// ──────────────────────────────────────────────────────────────────
// FAQ — Preguntas frecuentes de DTD Cargo (página /faq)
// ──────────────────────────────────────────────────────────────────
// Contenido verificado adversarialmente (sin datos inventados). El tránsito
// marítimo se declara como rango real (60-90 días) para fijar expectativa,
// consistente con el bot de WhatsApp (base #3); los precios/montos NO se
// hardcodean — se remiten a la cotización.
// Cifras de bodegaje/seguro citan el Acuerdo de Servicios v3 (fuente legal,
// docs/legal/acuerdo-servicios-v3.mdx). Merge jun-2026: 14 FAQ SEO originales
// + FAQ maestro del paquete F4 (faq/FAQ-sitio-DTDCargo.md). Fuente única para
// /faq (UI + FAQPage schema.org). Voz: tuteo venezolano neutro, cero voseo.
//
// `categoria` agrupa SOLO la UI de /faq en 5 bloques (refinamiento ui-ux
// 2026-06-10); el FAQPage schema NO se agrupa — sigue plano con todas las
// preguntas. Respuestas con lista (ej. prohibidos) usan `bloques` para la UI;
// el schema toma el string plano `respuesta` (mismo contenido, aplanado).
//
// Cifras de mínimo y baterías = las MISMAS que aplica la calculadora pública
// (confirmadas en prod 2026-06-10): piso del flete = rates.min_charge de la
// tarifa pública (USD 50) · recargo baterías = calculator_settings
// .recargo_bateria_mult (×1.5 = +50%). Si esos valores cambian en
// /studio/tarifas, actualizar estas dos respuestas a mano.

export type FaqCategoria =
  | "precio-y-pago"
  | "bodega-china-shipping-mark"
  | "almacenaje-seguro-baterias"
  | "rastreo"
  | "empresa-servicios";

/** Orden y rótulo visible de cada bloque en /faq (el id sirve de ancla #id). */
export const FAQ_CATEGORIAS: ReadonlyArray<{
  id: FaqCategoria;
  label: string;
}> = [
  { id: "precio-y-pago", label: "Precio, pago y entrega" },
  { id: "bodega-china-shipping-mark", label: "Bodega en China y Shipping Mark" },
  { id: "almacenaje-seguro-baterias", label: "Almacenaje, seguro y baterías" },
  { id: "rastreo", label: "Rastreo de tu envío" },
  { id: "empresa-servicios", label: "Empresa y servicios" },
];

/**
 * Bloque de respuesta enriquecida (solo UI). Cuando una FAQ necesita una lista
 * legible (ej. rubros prohibidos) usa `bloques`; el FAQPage schema sigue usando
 * el string plano `respuesta`, que debe contener el MISMO contenido aplanado.
 */
export type FaqBloque =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] };

export type Faq = {
  pregunta: string;
  respuesta: string;
  categoria: FaqCategoria;
  /** Render enriquecido opcional para la UI. Si falta, se pinta `respuesta` en un <p>. */
  bloques?: FaqBloque[];
  /**
   * Widget interactivo que reemplaza la prosa en la UI cuando se abre la FAQ.
   * El string `respuesta` se mantiene igual para el FAQPage schema (SEO/GEO).
   */
  widget?: "alibaba-guide" | "cbm-explicador";
  /**
   * Ancla estable para enlazar la pregunta desde otra superficie
   * (`/faq#<ancla>`). Solo la llevan las FAQ que se enlazan desde afuera: el
   * resto no necesita URL propia. `FaqExplorer` la usa como `id` del <details>
   * y la abre sola cuando el hash coincide.
   */
  ancla?: string;
};

export const FAQS: Faq[] = [
  {
    pregunta:
      "¿Qué significa DDP puerta a puerta y qué incluye el precio cuando importo de China con DTD Cargo?",
    respuesta:
      "DDP puerta a puerta significa que nos encargamos de todo el proceso: el precio ya incluye el flete desde China, la aduana y los impuestos, y te entregamos la mercancía en tu propia dirección en Venezuela, sin que hagas trámites ni trates con la aduana. En esta modalidad la importación no queda a tu nombre: recibes tu mercancía, no documentos de importación propios. Si prefieres importar a tu nombre y tener tus documentos, existe la modalidad con tu propia aduana (la explicamos más abajo). El monto se calcula por volumen (CBM) y destino en nuestra calculadora o al cotizarte por WhatsApp.",
    categoria: "precio-y-pago",
  },
  {
    // Ancla `cbm`: la enlaza el botón de ayuda del campo "CBM total" en las dos
    // calculadoras de /tarifas. Si cambia el slug, se rompe ese enlace.
    ancla: "cbm",
    pregunta:
      "¿Qué es el CBM y cómo calculo el volumen de mi carga?",
    respuesta:
      "CBM quiere decir cubic meter: metro cúbico. Es el espacio que ocupa tu mercancía dentro del contenedor, y es la unidad con la que se cobra el consolidado marítimo — no pagas por lo que pesa tu carga, sino por el espacio que ocupa. La fórmula es largo × ancho × alto, con las tres medidas en metros. Si mides en centímetros, que es como suele venir la ficha del proveedor chino, multiplica las tres y divide entre 1.000.000. Si mides en metros, el resultado ya es tu CBM. Si mides en pulgadas, multiplica las tres y divide entre 61.023,7; y si te lo dan en pies cúbicos (ft³), divide entre 35,3147 para pasarlo a CBM. Mide siempre por fuera de la caja, con el embalaje puesto, y hasta el punto más ancho si algo sobresale. Cuando tienes varios bultos iguales, calcula el CBM de uno y multiplícalo por la cantidad. Abre esta pregunta para calcularlo con tus propias medidas en centímetros, metros o pulgadas.",
    categoria: "precio-y-pago",
    widget: "cbm-explicador",
  },
  {
    pregunta:
      "¿Cuál es la diferencia entre consolidado (LCL) y contenedor completo (FCL) para traer mercancía de China a Venezuela?",
    respuesta:
      "En el consolidado marítimo (LCL) tu carga viaja junto a la de otros importadores y pagas solo por el volumen que ocupas (CBM), ideal cuando no tienes mercancía para llenar un contenedor. El contenedor completo (FCL) es para cuando tienes volumen suficiente y prefieres un contenedor entero para ti. LCL y FCL son la forma de transporte; aparte eliges la modalidad de servicio: puerta a puerta con todo incluido, o con tu propia aduana. Cuál te conviene depende de tu carga, y te orientamos al cotizar.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿Quién paga la aduana y los impuestos cuando importo de China?",
    respuesta:
      "En la modalidad puerta a puerta (DDP), la aduana y los impuestos ya van incluidos en el precio: no recibes cobros sorpresa ni tramitas nada con la aduana, de eso nos encargamos nosotros — y por eso la importación no queda a tu nombre (no recibes documentos ni factura de importación propios). Si prefieres importar a tu nombre, existe la modalidad con tu propia aduana: llevamos la carga hasta el almacén fiscal (ahí llega nuestro cobro por CBM) y de ahí tú cubres los impuestos, permisos y gastos de almacén fiscal. El costo se calcula por volumen (CBM) y tu destino.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿La importación queda a mi nombre? ¿Recibo los documentos y la factura?",
    respuesta:
      "Depende de la modalidad que elijas, y conviene definirla antes de cotizar. Puerta a puerta (DDP), todo incluido: nos encargamos de flete, aduana e impuestos y te entregamos en tu casa con un precio cerrado; la importación no queda a tu nombre, así que recibes tu mercancía pero no documentos de nacionalización ni factura de importación propios — es la opción más cómoda si solo quieres tu producto sin trámites. Con tu propia aduana (importas a tu nombre): tú eres el importador; llevamos tu carga hasta el almacén fiscal (ahí llega nuestro cobro por CBM) y te acompañamos en el trámite, pero necesitas entregarnos tu documentación y una autorización para gestionar en tu nombre, y de almacén fiscal en adelante los impuestos, permisos y gastos de almacén fiscal corren por tu cuenta (van a terceros, no están en el CBM); la ventaja es que la mercancía y los documentos quedan 100% a tu nombre y, ante el SENIAT, el importador eres tú. Si necesitas los documentos a nombre de tu empresa, dilo antes de cotizar para armarlo por esa modalidad.",
    categoria: "precio-y-pago",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Depende de la modalidad que elijas, y conviene definirla antes de cotizar:",
      },
      {
        tipo: "lista",
        items: [
          "Puerta a puerta (DDP), todo incluido: nos encargamos de flete, aduana e impuestos y te entregamos en tu casa con un precio cerrado. La importación no queda a tu nombre: recibes tu mercancía, no documentos de nacionalización ni factura de importación propios. Es la opción más cómoda si solo quieres tu producto sin trámites.",
          "Con tu propia aduana (importas a tu nombre): tú eres el importador. Llevamos tu carga hasta el almacén fiscal (ahí llega nuestro cobro por CBM) y te acompañamos en el trámite, pero necesitas entregarnos tu documentación y una autorización para gestionar en tu nombre. De almacén fiscal en adelante, los impuestos, permisos y gastos de almacén fiscal corren por tu cuenta (van a terceros, no están en el CBM). La ventaja: mercancía y documentos quedan 100% a tu nombre y, ante el SENIAT, el importador eres tú.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Si necesitas los documentos a nombre de tu empresa, dilo antes de cotizar para armarlo por esa modalidad.",
      },
    ],
  },
  {
    pregunta:
      "¿Cuándo pago mi mercancía? ¿Tengo que adelantar dinero o dar un depósito?",
    respuesta:
      "Bajo DDP puerta a puerta pagas cuando tu carga llega a Venezuela, no por adelantado: el flete, la aduana y los impuestos van incluidos y cancelas al momento de la entrega, así que no necesitas adelantar el costo del envío. La única excepción es si usas nuestra compra asistida para pagarle al proveedor en China, que se coordina aparte; por eso, si es tu primer envío o un caso especial, confírmalo con un asesor por WhatsApp antes de embarcar.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Cómo y en qué moneda pago mi envío?",
    respuesta:
      "Tu envío es un servicio de logística internacional, así que se cotiza en dólares: la mayor parte de los costos —el flete internacional, los trámites de aduana y la gestión en China— se pagan en divisas a terceros. La forma de pago y los datos exactos para tu operación te los coordina un asesor de forma segura, siempre con la referencia de tu Shipping Mark. Escríbenos por WhatsApp y te guiamos.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Cómo reporto un pago o subo mi comprobante?",
    respuesta:
      "Desde tu portal, en cada factura tienes la opción de reportar tu pago: subes el comprobante e indicas si es un abono parcial o el total. Tu asesor confirma cada reporte después de revisar el comprobante, y el saldo pendiente te queda siempre a la vista.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿Cómo calculan el costo del envío desde China, por peso o por volumen?",
    respuesta:
      "El costo del consolidado marítimo se calcula por volumen (CBM, metros cúbicos) y por el destino dentro de Venezuela, no por peso. Puedes sacar una estimación en la calculadora online metiendo tu volumen y a dónde va, o pedir la cotización exacta por WhatsApp. El monto final y los tiempos se confirman al cotizar según la modalidad y la ruta.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿Qué significa FOB y EXW cuando mi proveedor me da el precio?",
    respuesta:
      "Son términos de compra (Incoterms) que definen qué incluye el precio de tu proveedor. FOB: el proveedor incluye el flete interno en China, es decir, llevar la carga hasta nuestra bodega; te cotiza usando nuestra dirección de referencia. EXW: el precio es solo la mercancía en su fábrica, y el flete interno hasta nuestra bodega lo pagas aparte. Saber cuál te dieron te deja comparar precios reales; si tienes dudas, dinos qué te ofreció el proveedor y te ayudamos a ver tu costo total.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Dan descuento por volumen o a clientes frecuentes?",
    respuesta:
      "Sí. Premiamos el volumen y la frecuencia: mientras más CBM traigas, mejor tarifa, y nuestros clientes frecuentes tienen las mejores condiciones. Si importas seguido, te conviene registrarte para guardar tu historial y hacer recompras con mejores condiciones. Cuéntanos cuánto volumen mueves o cada cuánto importas, y un asesor te arma la tarifa con tu descuento.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Hay un mínimo para enviar con DTD Cargo?",
    respuesta:
      "Sí: el flete mínimo del consolidado marítimo es de USD 50 por envío — si tu carga ocupa muy poco volumen, ese es el piso que se factura. Lo bueno del consolidado es que puedes agrupar varias compras de distintos proveedores bajo tu mismo Shipping Mark para aprovecharlo mejor; la calculadora te muestra el monto exacto según tu volumen y destino.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿Cuánto tarda en llegar mi carga de China a Venezuela con DTD Cargo?",
    respuesta:
      "Tu carga viaja por barco, así que el tránsito marítimo de China a Venezuela toma normalmente entre 60 y 90 días. Ese tiempo suma tres tramos: el flete interno en China hasta nuestra bodega, la espera de la próxima salida del barco (sale cada 15 a 21 días) y la travesía marítima. Es un estimado y puede variar por la aduana o el clima. Apenas armamos tu cotización te confirmamos el tránsito para tu caso; escríbenos por WhatsApp o usa la calculadora online.",
    categoria: "precio-y-pago",
  },
  {
    pregunta:
      "¿A qué ciudades de Venezuela entregan y cómo funciona si no estoy en Valencia?",
    respuesta:
      "Entregamos en toda Venezuela. Nuestra sede y bodega están en Valencia, y el costo base cubre la entrega en el casco central de las ciudades. Si tu dirección queda fuera de la ruta de despacho, se suma el transporte terrestre hasta tu ubicación, y la calculadora te da ese aproximado automáticamente (lo cotizamos con transportistas nacionales) para que veas cuánto sale puesto en tu ciudad. Ten en cuenta que ese monto del transporte nacional es un estimado: como tu carga llega unos 90 días después, la tarifa puede moverse un poco para entonces, aunque lo normal es que se mantenga cerca de lo calculado. En todo caso, puerta a puerta significa que la carga te llega a tu dirección, sin ir a buscarla a un puerto o terminal.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Puedo cancelar mi envío o pedir un reembolso?",
    respuesta:
      "Depende de en qué punto esté tu carga. Si cancelas antes de que llegue a nuestra bodega de origen o de que se embarque, se reembolsa lo pagado menos los gastos ya hechos y un cargo por gestión. Una vez que la carga fue recibida, consolidada o embarcada, ya no procede reembolso porque el servicio está en marcha. Cada caso se revisa según el Acuerdo de Servicios (Anexo A); escríbele a un asesor por WhatsApp con tu Shipping Mark y lo vemos contigo.",
    categoria: "precio-y-pago",
  },
  {
    pregunta: "¿Tienen casillero o bodega en China para recibir mis compras?",
    respuesta:
      "Sí. Tenemos bodega propia en Yiwu donde recibimos lo que compras en Alibaba, 1688, Taobao o a cualquier proveedor chino. Tú compras y pides que envíen a nuestra dirección con tu Shipping Mark; nosotros recibimos, consolidamos y despachamos a Venezuela.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta:
      "¿Qué es el Shipping Mark y por qué debo ponerlo?",
    respuesta:
      "El Shipping Mark es tu código único en DTD Cargo (formato DTD-XXXX): la marca que va en cada una de tus cajas e identifica tu mercancía en la bodega, el sistema y todos los documentos. Es el nombre internacional de ese marcado —en China se conoce como 唛头—: un mismo concepto, un mismo código. Ponlo siempre en el destinatario y en la caja: es lo que nos deja encontrar tu mercancía rápido y sin confusiones.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta:
      "¿Cómo pongo la dirección de la bodega de DTD Cargo en Alibaba, 1688, Taobao u otras webs para que mi proveedor envíe?",
    respuesta:
      "Cuando registres tu dirección de recepción en Alibaba, 1688, Taobao u otra web (o se la pases directo a tu proveedor por WeChat), usa la dirección de nuestra bodega en Yiwu y pon TU Shipping Mark en el nombre — eso es lo que nos permite saber que la caja es tuya cuando llega. Llénalo campo por campo así: País/región → China. Nombre o empresa → DTD-Canopy - tu Shipping Mark (por ejemplo DTD-1014). Teléfono (+86) → 18606891419. Dirección → 浙江省义乌市义乌港二期直通仓2栋2号 货7-货11. Estado/provincia → 浙江省 (Zhejiang). Ciudad → 义乌市 (Yiwu; en el selector suele aparecer bajo 金华市, Jinhua). Código postal → 322000. Contacto de bodega → 林冠 (Lin Guan). Email → info@dtdcargo.com. La dirección va en chino porque es para el transporte dentro de China. Si tu Shipping Mark no aparece en el nombre, tu mercancía llega a la bodega pero no podemos identificar de quién es, así que no lo olvides. Este dato lo obtienes dentro de tu registro de clientes. Abre esta pregunta para tener la guía interactiva con botón de copiar campo por campo.",
    categoria: "bodega-china-shipping-mark",
    widget: "alibaba-guide",
  },
  {
    pregunta: "¿Cómo me registro y qué obtengo al instante?",
    respuesta:
      "Regístrate gratis en dtdcargo.com/registro: en un minuto recibes tu Shipping Mark (tu código DTD-XXXX para marcar tus cajas en China) y tu acceso al portal de seguimiento. No necesitas contraseña —entras al portal con un enlace que te llega a tu correo— y un asesor termina de activar tu cuenta para que empieces a importar.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta:
      "¿Puedo darle a mi proveedor la dirección y las etiquetas sin que se registre?",
    respuesta:
      "Sí. Desde tu cuenta generas un enlace privado para tu proveedor, bilingüe chino/español: él lo abre sin registrarse y ahí tiene la dirección de nuestra bodega en Yiwu con tu Shipping Mark y las etiquetas de esa compra, listas para pegar en cada caja. Así marca tu mercancía correctamente aunque no hable español.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta: "Ya mi proveedor envió, ¿qué hago ahora?",
    respuesta:
      "Carga tu pre-alerta en el portal: tu Shipping Mark, el número de guía (tracking) del proveedor y la descripción o packing list. Así sabemos que tu mercancía viene en camino y la recibimos a tu nombre.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta:
      "Si envío a la bodega de DTD en China en vez de a Venezuela, ¿pierdo la protección de Alibaba?",
    respuesta:
      "No. La protección de Trade Assurance depende de que pagues dentro de Alibaba, no de la dirección de entrega. Solo pagar por fuera de la plataforma la anula.",
    categoria: "bodega-china-shipping-mark",
  },
  {
    pregunta: "¿Cuánto tiempo puede quedarse mi compra en la bodega?",
    respuesta:
      "En China tienes 15 días continuos de almacenaje gratis desde que llega tu mercancía; luego se coordina el despacho (permanencia máxima 60 días). En Venezuela tienes 15 días hábiles de gracia desde el arribo; a partir del día 16 se causa bodegaje por CBM/día. (Acuerdo de Servicios, cláusula 4.)",
    categoria: "almacenaje-seguro-baterias",
  },
  {
    pregunta: "¿La carga está asegurada?",
    respuesta:
      "El flete no incluye seguro. Puedes contratar un seguro de carga opcional a través de DTD, solicitándolo antes de que tu mercancía llegue a la bodega de origen y declarando su valor real. Tenlo presente: la ventana para asegurar se cierra cuando la carga llega a la bodega en China.",
    categoria: "almacenaje-seguro-baterias",
  },
  {
    pregunta:
      "¿Puedo enviar baterías o productos con batería (powerbanks, electrónica)?",
    respuesta:
      "Sí. Los equipos con baterías pequeñas (hasta 100 Wh, como powerbanks, teléfonos y laptops) viajan con un trámite simplificado si tu proveedor entrega el certificado UN38.3 y la hoja de seguridad (MSDS); por el manejo especial, el flete de la carga con baterías lleva un recargo del 50% — márcalo en la calculadora para que tu estimado ya lo incluya. Las baterías grandes, de scooter o paneles solares son mercancía peligrosa y necesitan documentos adicionales y un canal especial: escríbenos antes de comprar. Indícalo siempre en tu pre-alerta.",
    categoria: "almacenaje-seguro-baterias",
  },
  {
    pregunta: "¿Qué productos están prohibidos para importar a Venezuela?",
    respuesta:
      "Para cumplir con la normativa aduanera, está prohibido enviar estos artículos sin autorización expresa y su documentación regulatoria completa: baterías de litio sin certificación UN38.3 (como las grandes para scooters o paneles solares); líquidos inflamables y aerosoles; gases comprimidos y sustancias tóxicas; armas, municiones, réplicas y juguetes bélicos; uniformes y accesorios militares; medicamentos sin registro sanitario y psicotrópicos; alimentos perecederos; divisas, valores y metales preciosos; réplicas de marcas y productos pirata; pirotecnia y explosivos. Los equipos con baterías pequeñas (hasta 100 Wh, como celulares, laptops o powerbanks) sí puedes traerlos con un trámite simplificado: tu proveedor debe entregar el certificado UN38.3 y la hoja de seguridad (MSDS); escríbenos siempre antes de comprar para validarlo e indícalo en tu pre-alerta. Enviar mercancía prohibida, productos no declarados o artículos restringidos sin sus permisos previos no entra dentro de nuestro servicio: hasta dónde llega el servicio no incluye cubrir multas, decomisos ni retrasos aduaneros por cargas mal declaradas o enviadas de forma oculta. Si tienes dudas sobre un producto específico, consúltanos antes de comprar.",
    categoria: "almacenaje-seguro-baterias",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Para cumplir con la normativa aduanera, está prohibido enviar estos artículos sin autorización expresa y su documentación regulatoria completa:",
      },
      {
        tipo: "lista",
        items: [
          "Baterías de litio sin certificación UN38.3 (como las grandes para scooters o paneles solares).",
          "Líquidos inflamables y aerosoles.",
          "Gases comprimidos y sustancias tóxicas.",
          "Armas, municiones, réplicas y juguetes bélicos.",
          "Uniformes y accesorios militares.",
          "Medicamentos sin registro sanitario y psicotrópicos.",
          "Alimentos perecederos.",
          "Divisas, valores y metales preciosos.",
          "Réplicas de marcas y productos pirata.",
          "Pirotecnia y explosivos.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "¿Y los equipos electrónicos con baterías pequeñas? Los equipos con baterías pequeñas (hasta 100 Wh, como celulares, laptops o powerbanks) sí puedes traerlos con un trámite simplificado: tu proveedor debe entregar el certificado UN38.3 y la hoja de seguridad (MSDS). Escríbenos siempre antes de comprar para validarlo e indícalo en tu pre-alerta.",
      },
      {
        tipo: "parrafo",
        texto:
          "Enviar mercancía prohibida, productos no declarados o artículos restringidos sin sus permisos previos no entra dentro de nuestro servicio: hasta dónde llega el servicio no incluye cubrir multas, decomisos ni retrasos aduaneros por cargas mal declaradas o enviadas de forma oculta. Si tienes dudas sobre un producto específico, consúltanos antes de comprar.",
      },
    ],
  },
  {
    pregunta: "¿Cómo entro a mi portal de cliente y qué puedo hacer ahí?",
    respuesta:
      "Tu portal es tu panel privado en dtdcargo.com/portal: entras con tu correo —te llega un enlace de acceso, sin contraseña— y ahí ves tus envíos y pre-alertas paso a paso, tus facturas y saldos, tus documentos y tus mensajes con el equipo. Si el enlace te dice que tu correo todavía no tiene el portal habilitado, pídele a tu asesor que te active el acceso.",
    categoria: "rastreo",
  },
  {
    pregunta: "¿Cada cuánto sale el barco y dónde veo cómo va mi envío?",
    respuesta:
      "El barco sale cada 15 a 21 días. Si ya eres cliente, en tu portal ves en qué etapa va cada uno de tus envíos, actualizado a medida que avanza. Si todavía no eres cliente, escríbenos por WhatsApp y un asesor te confirma la próxima salida para tu carga.",
    categoria: "rastreo",
  },
  {
    pregunta:
      "¿Puedo ver y descargar mis documentos (factura, BL, packing list)?",
    respuesta:
      "Sí. En tu portal, en las secciones de Documentos y Facturas, tienes los documentos de tu envío para consultarlos y descargarlos, junto con el comprobante de cada pago que reportas.",
    categoria: "rastreo",
  },
  {
    pregunta: "¿Puedo hacerle seguimiento a mi envío para saber dónde va?",
    respuesta:
      "Sí. El seguimiento se hace entrando a tu portal del cliente en dtdcargo.com/portal: ahí ves los eventos de cada envío en vivo, con su BL (Bill of Lading) y su código DTDU. Entras con un enlace que te llega a tu correo, sin contraseña. Si no tienes acceso a la mano, escríbenos por WhatsApp y te ayudamos a entrar.",
    categoria: "rastreo",
  },
  {
    pregunta:
      "¿Puedo rastrear con el número que me dio mi proveedor chino?",
    respuesta:
      "No. Ese número es del courier interno de China y solo sirve para el trayecto hasta nuestra bodega en Yiwu. Para seguir tu envío con DTD entra a tu portal del cliente en dtdcargo.com/portal: ahí aparece el embarque con el código que te damos al abrirlo.",
    categoria: "rastreo",
  },
  {
    pregunta:
      "¿Validan o verifican a mi proveedor en China antes de que le compre?",
    respuesta:
      "Sí. Ofrecemos validación de proveedores en China: verificamos que la empresa exista y sea legítima (registro, capacidad e instalaciones) y, si quieres, revisamos la producción antes de que embarque. Es un servicio con costo, ideal para comprarle con más seguridad a un proveedor nuevo. Como tenemos equipo propio en Yiwu, la revisión la hace gente nuestra en China. Pásanos los datos del proveedor por WhatsApp y te decimos alcance y precio.",
    categoria: "empresa-servicios",
  },
  {
    pregunta: "¿DTD Cargo revisa o inspecciona mi mercancía antes de embarcar desde China?",
    respuesta:
      "Cuando tu mercancía llega a nuestra bodega en Yiwu, nuestro equipo la recibe, la cuenta y revisa su estado externo antes de consolidar, con registro fotográfico — eso va incluido. Si quieres una revisión más a fondo, ofrecemos servicios de inspección con costo: inspección del producto contra tu ficha técnica (muestreo AQL con evidencia fotográfica) e inspección de fábrica al proveedor, ideales antes de pagar o embarcar. Como tenemos equipo y bodega propios en Yiwu, el control lo hace gente nuestra en China, no un tercero a distancia. Escríbenos por WhatsApp y te pasamos el alcance y los precios.",
    categoria: "empresa-servicios",
  },
  {
    pregunta: "¿Cómo abro un reclamo si mi carga llegó dañada o incompleta?",
    respuesta:
      "Lamentamos el inconveniente. Si ya eres cliente, abre tu caso desde el portal, en la sección de Reclamos, con tu Shipping Mark: queda registrado y le haces seguimiento en línea. Cada situación de daño o faltante se revisa según las condiciones del Acuerdo de Servicios, y un asesor la atiende contigo.",
    categoria: "empresa-servicios",
  },
  {
    pregunta: "¿Puedo recomendar DTD Cargo y ganar algo?",
    respuesta:
      "Sí. En tu portal, sección Referidos, tienes un código para compartir: el importador nuevo que traes recibe un beneficio en su primer embarque, y a ti se te reconoce por cada referido que hace su primera compra. Escríbenos por WhatsApp o revisa tu portal para el detalle vigente del programa.",
    categoria: "empresa-servicios",
  },
  {
    pregunta: "¿Qué es el Club DTD?",
    respuesta:
      "Es la comunidad de importadores que compran con DTD Cargo: compras grupales para mejorar el costo por metro cúbico, contenido y proveedores recomendados. Si quieres sumarte, habla con tu asesor por WhatsApp y te contamos cómo entrar.",
    categoria: "empresa-servicios",
  },
  {
    pregunta:
      "¿DTD Cargo tiene oficina propia en China y en Venezuela o es un intermediario?",
    respuesta:
      "Tenemos bodega y equipo propios en Yiwu (China) y en Valencia (Venezuela). Nuestra trayectoria en el comercio con China viene de 2008 y operamos en Venezuela desde 2015: la carga la maneja gente nuestra en los dos extremos, lo que nos deja controlar la recepción en China y la entrega puerta a puerta en Venezuela.",
    categoria: "empresa-servicios",
  },
  {
    pregunta:
      "¿DTD Cargo hace envíos aéreos de China a Venezuela?",
    respuesta:
      "El flete aéreo de carga está temporalmente suspendido: hoy movemos la carga por vía marítima (consolidado LCL y contenedor completo FCL), siempre puerta a puerta. Lo que sí mantenemos activo es el courier express de muestras y documentos pequeños por DHL, UPS o FedEx desde Yiwu (muestras pre-producción, documentos y lotes pequeños críticos) — eso es paquetería urgente, no carga aérea. Si necesitas enviar una muestra o un documento, escríbenos por WhatsApp y lo coordinamos.",
    categoria: "empresa-servicios",
  },
  {
    pregunta:
      "¿DTD Cargo me ayuda a comprar en China y qué tipo de productos puedo importar?",
    respuesta:
      "Sí, ofrecemos sourcing y compra asistida en China: te ayudamos a ubicar al proveedor y gestionar la compra antes de consolidar la carga. Para los rubros que puedes importar, lo mejor es consultarlo por WhatsApp con tu lista, porque depende del producto y la normativa; te confirmamos viabilidad y la modalidad (consolidado marítimo o contenedor completo) al cotizar.",
    categoria: "empresa-servicios",
  },
  {
    pregunta:
      "¿DTD Cargo trae mis productos para venderlos o compite con mi negocio?",
    respuesta:
      "No. DTD Cargo es tu operador logístico, no tu competencia. No usamos la información de tu negocio —tu proveedor, tus productos, tus diseños— para traer esa misma mercancía y revenderla por nuestra cuenta, ni contactamos a tu proveedor para competirte. Lo que importas a través de nosotros es tuyo: movemos tu carga, no te copiamos el negocio. Es un compromiso de la empresa con cada cliente, y la confidencialidad de tus proveedores está protegida.",
    categoria: "empresa-servicios",
  },
  {
    pregunta: "¿Tienen cursos para aprender a importar de China?",
    respuesta:
      "Sí. En la Academia DTD te enseñamos a importar paso a paso, con nuestra operación real detrás (bodega en Yiwu, consolidación y entrega puerta a puerta): cuatro cursos en escalera, del primer pedido a tu primer contenedor, con el Curso 0 gratis. Si ya eres cliente, la tienes en tu portal — regístrate en dtdcargo.com/registro y entra a la Academia desde ahí para empezar por el Curso 0. Si todavía no importas con nosotros, déjanos tus datos en dtdcargo.com/academia y te avisamos de las próximas cohortes en vivo.",
    categoria: "empresa-servicios",
  },
];
