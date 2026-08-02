/**
 * Fichas detalladas de servicios — sitio público (SDD-0063).
 *
 * Por qué existe: el AI Agent de Kommo crawlea dtdcargo.com como fuente de
 * conocimiento. El copy corto de `SERVICES_CN`/`SERVICES_VE` (en design-tokens)
 * era impreciso y la IA dio datos incorrectos a un lead. Acá cada servicio se
 * detalla a fondo (incluye / no incluye / precio o condición / cómo se solicita
 * / tiempos) para que el crawl tome info CERTERA.
 *
 * Taxonomía (dictada por el founder 2026-06-09, ver
 * `docs/specs/0063-servicios-detalle-publico/assets/entrevista-servicios.md`):
 *   - PRINCIPAL: Puerta a puerta DDP (CBM) — el spine, todo incluido.
 *   - SECUNDARIOS (otras modalidades de transporte): LCL Consolidado · FCL
 *     Consolidado en Bodega · FCL Directo Fábrica · Transporte terrestre.
 *   - ADD-ON MODULAR: Tránsito de aduana (incluido en DDP y en el FCL "todo
 *     pagado"; opcional en LCL y en el FCL "hasta puerto" — founder 2026-07-19
 *     v2, matriz FCL 2×2 carga×recepción, supera el dictado 06-09);
 *     Documentos de importación va DENTRO de aduana (fusionado 2026-07-19,
 *     decisión founder: sin ficha propia — vive como "incluye" de aduana).
 *   - TERCIARIOS: Inspección (umbrella de 4) · Compra asistida · Asesoría de
 *     pagos · Courier de muestras · Visado · Registro de marca.
 *   - MINI-SERVICIOS de recepción en bodega (con reporte de fotos).
 *
 * REGLA DE ORO — NO INVENTAR. Solo entra dato grounded (FAQ/timeline/copy) o
 * dictado por el founder. Campos vacíos ("" o []) = PENDIENTES → la ficha NO
 * los renderiza. Nada inventado llega a la web.
 *
 * REGLA DE COPY: nunca usar la palabra "responsabilidad" (dispara temas de
 * seguros). Marco correcto: "hasta dónde llega el servicio".
 *
 * Coherencia obligatoria con el FAQ: la web y el FAQ deben decir lo mismo.
 */

export type ServicioEstado = "activo" | "suspendido" | "a-pedido" | "proximamente";

export type ServicioDetalle = {
  /** Ancla — coincide con el slug de SERVICES_CN/SERVICES_VE (continuidad de #hash). */
  slug: string;
  titulo: string;
  sede: "cn" | "ve" | "ambas";
  /** 1-2 frases: qué es el servicio. Siempre grounded. */
  resumen: string;
  /** Lo que SÍ incluye. [] = pendiente de entrevista. */
  incluye: string[];
  /** Lo que NO incluye (clave para que la IA no prometa de más). [] = pendiente. */
  noIncluye: string[];
  /** Precio, rango o condición ("vale tanto si hace X"). "" = pendiente. */
  precio: string;
  /**
   * Tabla de precios opcional (ej. comisión escalonada por monto de compra).
   * Se renderiza como tabla aparte; `precio` queda como intro/resumen de la tabla.
   */
  precioTabla?: {
    columnas: string[];
    filas: string[][];
    nota?: string;
  };
  /** Cómo se solicita (WhatsApp / calculadora / registro / asesor). */
  comoSolicitar: string;
  /** Tiempos del servicio. "" = pendiente. */
  tiempos: string;
  /** Salvedad opcional (courier, normativa, precios stand-by…). */
  nota?: string;
  /** Default "activo". */
  estado?: ServicioEstado;
  /** Deep-dive interno si existe (ej. inspección). */
  href?: string;
  /** Servicio principal (DDP): realce visual — badge "Principal", borde wine, abierto por default. */
  destacado?: boolean;
  /** CHECKLIST INTERNO — NO se renderiza. Campos por dictar en la entrevista. */
  _pendiente?: string[];
};

/**
 * Grupos para el índice de salto y el render por sección. El orden sigue el
 * viaje de la carga: transporte (el núcleo) → recepción en bodega → calidad en
 * origen → trámites y legal.
 */
export type ServicioGrupo = {
  id: string;
  titulo: string;
  blurb: string;
};

export const SERVICIOS_GRUPOS: ServicioGrupo[] = [
  {
    id: "transporte",
    titulo: "Transporte de China a tu puerta",
    blurb:
      "El núcleo: traer tu mercancía de China a Venezuela. Desde el puerta a puerta DDP con todo incluido (servicio principal) hasta las modalidades de carga compartida (LCL) y contenedor completo (FCL), más la aduana cuando la necesitas.",
  },
  {
    id: "bodega",
    titulo: "En bodega: revisión y preparación",
    blurb:
      "Servicios opcionales al recibir tu mercancía en nuestra bodega de Yiwu: revisión, etiquetado y reempaque — siempre con reporte de fotos.",
  },
  {
    id: "origen",
    titulo: "Calidad y proveedores en origen",
    blurb:
      "Control en China antes de embarcar: inspección de calidad, verificación de proveedores, auditoría, laboratorio, compra asistida, asesoría de pagos y courier de muestras. El detalle completo de inspección está en /servicios/inspeccion.",
  },
  {
    id: "tramites",
    titulo: "Trámites y legal",
    blurb:
      "Visado de negocios chino y registro de marca en China (CNIPA), gestionados por nuestro equipo desde Venezuela.",
  },
];

// ──────────────────────────────────────────────────────────────────
// FICHAS
//
// `resumen` + `comoSolicitar` grounded; el resto se llena por la entrevista
// por tandas (precio/tiempos pendientes no se renderizan). Los precios de
// referencia internos (DDP ~800/CBM, LCL ~550/CBM) NO se publican: la web
// remite a la calculadora / asesor.
// ──────────────────────────────────────────────────────────────────

export const SERVICIOS_DETALLE: ServicioDetalle[] = [
  // ── Grupo: transporte ────────────────────────────────────────────
  {
    slug: "dtd-services-lcl",
    titulo: "Puerta a puerta DDP · Pagas al llegar",
    sede: "ambas",
    destacado: true,
    // grounded: FAQ §22/§23/§24/§26 + dictado founder 2026-06-09
    resumen:
      "Nuestro servicio principal: traemos tu mercancía de China hasta tu puerta en Venezuela, todo incluido (DDP). Consolidamos, embarcamos, nacionalizamos a nuestro nombre y entregamos — tú solo recibes y pagas cuando la carga llega.",
    incluye: [
      "Flete marítimo internacional desde China hasta Venezuela.",
      "Aduana e impuestos a nuestro nombre (DDP): sin cobros sorpresa.",
      // SDD-0237: decía "incluida hasta el casco central de la ciudad", que hoy
      // es doblemente falso — el término murió de cara al cliente y la entrega
      // ya no se cobra por distancia sino por metro cúbico. Esta línea alimenta
      // /servicios, /tarifas y el `hasOfferCatalog` del JSON-LD, así que
      // prometía en tres sitios algo que el motor no cumple.
      "Entrega puerta a puerta — incluida en un grupo de ciudades; en el resto se cobra por metro cúbico.",
      "Pagas al llegar: pagas cuando la carga llega a Venezuela, no por adelantado (pueden aplicar restricciones).",
      "Consolidación en nuestra bodega de Yiwu de la mercancía de tus proveedores.",
    ],
    noIncluye: [
      // grounded: dictado founder 2026-06-09
      "El seguro de carga: se contrata aparte.",
      // SDD-0237: el "costo adicional" ya no depende de dónde quede la
      // dirección dentro de la ciudad, sino del volumen de la carga.
      "La entrega en las ciudades que no están en la zona sin costo: se cobra por metro cúbico.",
    ],
    // grounded: precio por CBM vía calculadora (FAQ §2/§22). NO publicar el monto.
    precio:
      "Se calcula por volumen (CBM) y ciudad de destino. Sácalo al instante en la calculadora o pídele la cotización formal a un asesor.",
    comoSolicitar:
      "Calcula tu estimado en dtdcargo.com/tarifas, regístrate en dtdcargo.com/registro para tu Shipping Mark, o escríbenos por WhatsApp.",
    // grounded: FAQ §3 Kommo + decisión founder (publicar 60-90 puerta a puerta)
    tiempos:
      "60 a 90 días puerta a puerta: flete interno en China + espera de la próxima salida (cada 15-21 días) + travesía marítima + aduana y entrega en Venezuela.",
    estado: "activo",
    nota: "Es el servicio insignia de DTD; el resto de los servicios son complementarios o variantes de transporte.",
    // La tarifa y el CBM mínimo salen de la calculadora (cruce configurable en
    // /studio/tarifas); la tarifa especial arranca desde 10 CBM. No se hardcodea acá.
  },
  {
    slug: "lcl-consolidado",
    titulo: "LCL Consolidado (carga compartida, con BL propio)",
    sede: "ambas",
    // grounded: dictado founder 2026-06-09
    resumen:
      "Una opción más económica de carga marítima compartida: tu mercancía viaja consolidada con la de otros clientes y recibes tu propio Bill of Lading. El servicio te lleva hasta la entrega de ese BL en Venezuela; de ahí en adelante haces tu trámite de aduana (o lo sumas con nosotros como servicio adicional).",
    incluye: [
      "Consolidación de tu carga en nuestra bodega de Yiwu.",
      "Flete marítimo internacional de China a Venezuela.",
      "Tu propio Bill of Lading, separado dentro del Bill Master del contenedor.",
    ],
    noIncluye: [
      "Aduana e impuestos en Venezuela: los gestionas tú, o los sumas aparte (servicio de aduana).",
      "Servicios portuarios, transporte interno y demás gastos hasta el destino.",
    ],
    // precio: referencia interna ~550/CBM — NO se publica el monto
    precio: "Se cotiza por volumen (CBM) con un asesor por WhatsApp.",
    comoSolicitar:
      "Escríbenos por WhatsApp para cotizar tu carga consolidada LCL.",
    tiempos:
      "60 a 90 días hasta que tu carga llega a Venezuela y te entregamos el Bill of Lading.",
    estado: "activo",
    nota: "El servicio de DTD llega hasta entregarte el Bill of Lading en Venezuela; el desaduanaje es un servicio adicional opcional.",
  },
  {
    slug: "consolidacion-bodega-yiwu",
    titulo: "FCL Consolidado en Bodega (contenedor completo)",
    sede: "cn",
    // grounded: dictado founder 2026-06-09 (es FCL, no LCL)
    resumen:
      "Llenamos tu contenedor completo en nuestra bodega de Yiwu con la mercancía de varios de tus proveedores. Hacemos el despacho de exportación en China y la reserva del contenedor y el flete. En Venezuela eliges cómo recibir: todo pagado hasta tu puerta (aduana, impuestos y entrega incluidos; pagas antes de la entrega) o hasta puerto (tú desaduanizas).",
    incluye: [
      "Recepción de la mercancía de tus distintos proveedores en la bodega de Yiwu.",
      "Carga y consolidación del contenedor completo (FCL).",
      "Despacho de exportación en China.",
      "Reserva del contenedor y del flete.",
      "En la modalidad todo pagado: aduana, impuestos y entrega hasta tu puerta (pagas antes de la entrega).",
      "Almacenaje gratis los primeros 15 días en la bodega de Yiwu.",
    ],
    noIncluye: [
      "En la modalidad hasta puerto: la desaduanización corre por tu cuenta (o sumas nuestro Tránsito de aduana como servicio adicional).",
      "Almacenaje después de los primeros 15 días gratis: tiene un costo adicional.",
    ],
    precio: "Se cotiza con un asesor por WhatsApp.",
    comoSolicitar:
      "El FCL se cotiza con un asesor (no está en la calculadora pública). Escríbenos por WhatsApp.",
    tiempos:
      "40 a 55 días aproximados: al ser contenedor completo, no espera la próxima salida consolidada.",
    estado: "activo",
    nota: "En la modalidad hasta puerto, el flete se paga durante el tránsito (el BL se entrega al completar el pago) o adelantado.",
  },
  {
    slug: "reserva-contenedores",
    titulo: "FCL Directo Fábrica (contenedor cargado en origen)",
    sede: "cn",
    // grounded: dictado founder 2026-06-09
    resumen:
      "Tu contenedor completo se carga directamente en la fábrica de tu proveedor (uno o dos fabricantes), sin pasar por nuestra bodega. Hacemos la reserva del contenedor y del buque con la naviera; el Bill of Lading lo emitimos nosotros — no la fábrica: nuestra empresa en China aparece como exportador (shipper) y tú como consignatario (quien recibe). La fábrica no tiene control sobre el BL, así que tu proveedor no puede cambiar el destino ni desviar el contenedor. En Venezuela eliges cómo recibir: todo pagado hasta tu puerta o hasta puerto (tú desaduanizas).",
    incluye: [
      "Reserva del contenedor y del buque con la naviera.",
      "Bill of Lading emitido por nosotros: DTD como exportador (shipper) y tú como consignatario (quien recibe).",
      "Coordinación de la carga en la fábrica de tu proveedor.",
      "En la modalidad todo pagado: aduana, impuestos y entrega hasta tu puerta (pagas antes de la entrega).",
    ],
    noIncluye: [
      "En la modalidad hasta puerto: la desaduanización corre por tu cuenta (o sumas nuestro Tránsito de aduana como servicio adicional).",
    ],
    precio: "Se cotiza con un asesor por WhatsApp.",
    comoSolicitar: "Se cotiza con un asesor. Escríbenos por WhatsApp.",
    tiempos:
      "40 a 55 días aproximados: al ser contenedor completo, no espera la próxima salida consolidada.",
    estado: "activo",
    nota: "Seguridad: el BL lo emitimos nosotros — la fábrica no aparece ni controla el BL, así que el proveedor no puede desviar ni cambiar el destino del contenedor. En la modalidad hasta puerto, el flete se paga durante el tránsito (el BL se entrega al completar el pago) o adelantado.",
  },
  {
    slug: "transporte-terrestre",
    titulo: "Transporte terrestre nacional",
    sede: "ve",
    // estado "proximamente" (founder 2026-06-09). La calculadora-terrestre sí está live.
    resumen:
      "Transporte de carga por vía terrestre dentro de Venezuela, para mover tu mercancía entre ciudades o hasta tu destino final.",
    incluye: [],
    noIncluye: [],
    precio: "",
    comoSolicitar: "",
    tiempos: "",
    estado: "proximamente",
    nota: "Disponible próximamente.",
  },
  {
    slug: "transito-aduana",
    titulo: "Tránsito de aduana y desaduanaje (servicio adicional)",
    sede: "ve",
    // grounded: dictado founder 2026-06-09 + FAQ §23
    resumen:
      "Gestionamos el paso de tu mercancía por la aduana venezolana y su nacionalización. Es un servicio adicional opcional para las cargas LCL y el FCL hasta puerto (en el puerta a puerta DDP y en el FCL todo pagado ya va incluido). Tú pagas tus planillas directamente a la aduana; nosotros te representamos como tu agente con tu carta poder.",
    incluye: [
      "Gestión del paso por aduana y nacionalización de tu carga.",
      "Representación ante la aduana como tu agente (con tu carta poder).",
      "Documentos de importación: facturas de embarque, declaraciones, certificados y normativa.",
    ],
    noIncluye: [
      "El pago de las planillas de aduana e impuestos: lo pagas tú directamente a la aduana.",
      "Servicios portuarios y transporte interno, que se facturan aparte.",
    ],
    precio:
      "El costo se cotiza según el valor del contenedor (por valorización de la factura). Como intervienen muchos factores, un asesor te da el aproximado por WhatsApp.",
    comoSolicitar:
      "Súmalo a tu carga LCL o FCL hasta puerto: escríbenos por WhatsApp con tu nombre o el de tu empresa para iniciar el trámite.",
    tiempos: "Nacionalización de 5 a 6 días hábiles.",
    estado: "activo",
    nota: "Incluido en el puerta a puerta DDP y en el FCL todo pagado; opcional (adicional) en LCL y FCL hasta puerto.",
  },
  // ── Grupo: bodega (mini-servicios de recepción) ──────────────────
  {
    slug: "revision-recepcion",
    titulo: "Revisión de mercancía al recibir",
    sede: "cn",
    // grounded: dictado founder 2026-06-09
    resumen:
      "A pedido, al recibir tu mercancía en la bodega de Yiwu abrimos las cajas, revisamos la mercancía y verificamos que la cantidad coincida con tu factura. Por defecto no abrimos las cajas; este es un servicio adicional. Te entregamos un reporte con fotos.",
    incluye: [
      "Apertura y revisión de las cajas al recibir.",
      "Conteo y chequeo de la cantidad recibida contra tu factura.",
      "Reporte con fotos.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar:
      "Pídelo por WhatsApp antes de que tu mercancía llegue a la bodega.",
    tiempos: "",
    estado: "activo",
    nota: "Servicio de recepción en bodega — distinto de la inspección de calidad en fábrica.",
    _pendiente: ["precio (¿lo confirma el asesor?)"],
  },
  {
    slug: "etiquetado-piezas",
    titulo: "Etiquetado por pieza",
    sede: "cn",
    // grounded: dictado founder 2026-06-09 (se cobra por pieza)
    resumen:
      "Etiquetamos y marcamos tus piezas en la bodega de Yiwu según tus requerimientos o la normativa de destino. Se cobra por pieza. Te entregamos un reporte con fotos.",
    incluye: [
      "Etiquetado y marcado de las piezas en bodega.",
      "Reporte con fotos.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar:
      "Pídelo por WhatsApp e indícanos el etiquetado que necesitas.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["precio por pieza"],
  },
  {
    slug: "reempaque-defectuosas",
    titulo: "Cajas defectuosas y reempaque",
    sede: "cn",
    // grounded: dictado founder 2026-06-09
    resumen:
      "Cuando una caja llega defectuosa a la bodega, la reempacamos para que tu mercancía viaje protegida. Te entregamos un reporte con fotos.",
    incluye: [
      "Reempaque de las cajas que llegan defectuosas.",
      "Reporte con fotos.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar:
      "Lo gestionamos al recibir tu mercancía; te avisamos si hace falta. Escríbenos por WhatsApp.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["precio/condición"],
  },

  // ── Grupo: calidad y proveedores en origen ───────────────────────
  {
    slug: "chequeo-etiquetado",
    titulo: "Inspección de calidad",
    sede: "cn",
    // grounded: /servicios/inspeccion (lib/inspeccion.ts). El "etiquetado" se
    // mudó a los mini-servicios de bodega (dictado founder 2026-06-09).
    resumen:
      "Verificación física de tu mercancía contra la ficha técnica, en la fábrica y antes del embarque. Parte de nuestra línea completa de inspección de calidad en China.",
    incluye: [
      "Verificación física del producto contra la ficha técnica.",
      "Inspección pre-embarque en la fábrica.",
    ],
    noIncluye: [],
    // precios de inspección = STAND-BY (decisión founder): no publicar
    precio: "",
    comoSolicitar:
      "Conoce el detalle en /servicios/inspeccion y solicita tu cotización por WhatsApp; un asesor te pasa los servicios de inspección y un ejemplo del reporte.",
    tiempos: "",
    estado: "activo",
    href: "/servicios/inspeccion",
    nota: "Precios de inspección: los confirma un asesor (no se publican aún).",
    _pendiente: ["incluye/noIncluye finos", "tiempos"],
  },
  {
    slug: "verificacion-proveedores",
    titulo: "Verificación de proveedores",
    sede: "cn",
    // grounded: copy actual + FAQ §7
    resumen:
      "Validamos proveedores y fábricas en China para que compres seguro: auditoría de legitimidad (validez legal, capacidad, instalaciones) e inspección pre-producción y pre-embarque.",
    incluye: [
      "Auditoría de legitimidad del proveedor (validez legal, capacidad, instalaciones).",
      "Inspección pre-producción y pre-embarque.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar:
      "Escríbenos por WhatsApp con los datos de tu proveedor; un asesor te pasa los servicios con sus precios y un ejemplo del reporte.",
    tiempos: "",
    estado: "activo",
    href: "/servicios/inspeccion",
    _pendiente: ["incluye/noIncluye finos", "precio (¿stand-by?)", "entregable (reporte)", "tiempos"],
  },
  {
    slug: "auditoria-calidad",
    titulo: "Auditoría y control de calidad",
    sede: "cn",
    // grounded: copy actual + lib/inspeccion.ts (auditorías de fábrica)
    resumen:
      "Auditorías de fábrica online o presenciales y control de calidad bajo estándares internacionales, ejecutadas por nuestro equipo en China.",
    incluye: [],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Conoce el detalle en /servicios/inspeccion y cotiza por WhatsApp.",
    tiempos: "",
    estado: "activo",
    href: "/servicios/inspeccion",
    _pendiente: ["incluye/noIncluye", "precio", "entregable", "tiempos"],
  },
  {
    slug: "lab-permisologia",
    titulo: "Lab testing y permisología en China",
    sede: "cn",
    // grounded: copy actual + lib/inspeccion.ts (LAB)
    resumen:
      "Coordinamos pruebas de laboratorio (RoHS, CE, FDA y otros, según el mercado de destino) y la gestión de permisos requeridos para exportación.",
    incluye: [],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Cotiza por WhatsApp indicando tu producto y mercado de destino.",
    tiempos: "",
    estado: "activo",
    href: "/servicios/inspeccion",
    _pendiente: ["incluye/noIncluye", "quién paga el laboratorio", "precio/condición", "tiempos"],
  },
  {
    slug: "compra-asistida",
    titulo: "Compra asistida / sourcing",
    sede: "cn",
    // grounded: dictado founder 2026-06-09 (TANDA 2). ⚠️ Proveedor = red propia
    // DTD, NUNCA se revela (DTD queda como proveedor del cliente).
    resumen:
      "Somos tu departamento de compras en China, en dos modalidades: sourcing completo —te conseguimos el proveedor, negociamos y gestionamos la compra— o sobre tu propio proveedor —si ya lo tienes pero temes que te estafen, lo verificamos y gestionamos la compra como tu comprador de confianza—. En ambas, la verificación del proveedor va incluida y te acompañamos hasta que la compra se completa.",
    incluye: [
      "Modalidad A (sourcing): ubicamos el producto y el proveedor, negociamos y gestionamos la compra por ti.",
      "Modalidad B (tu proveedor): si ya tienes proveedor y precios, lo verificamos y gestionamos la compra entrando como tu comprador de confianza.",
      "En ambas: verificación del proveedor incluida y seguimiento hasta que la compra se completa.",
    ],
    noIncluye: [
      "El pago al proveedor: es un servicio adicional. Si quieres que paguemos por ti, primero nos pagas a nosotros.",
      "El costo de la mercancía: lo pagas tú.",
      "Los fletes internacionales.",
      "Los fletes nacionales.",
    ],
    // grounded: tabla de comisión por monto aprobada por el founder 2026-06-09.
    // B = la mitad de la tabla de A (escalonado). Mínimo $50/orden en ambas.
    precio:
      "La comisión baja a medida que sube el monto de tu compra; mínimo $50 por orden, con la verificación del proveedor incluida.",
    precioTabla: {
      columnas: ["Monto (USD)", "A · sourcing", "B · tu proveedor"],
      filas: [
        ["hasta $2.000", "10%", "5%"],
        ["~$5.000", "8%", "4%"],
        ["~$10.000", "6%", "3%"],
        ["~$20.000", "5%", "2,5%"],
        ["~$50.000", "4%", "2%"],
        ["$100.000+", "3%", "1,5%"],
      ],
      nota: "Mínimo $50 por orden. La verificación del proveedor va incluida en ambas modalidades.",
    },
    comoSolicitar:
      "Mándanos tu lista de productos con su ficha técnica por WhatsApp; un asesor te confirma viabilidad, modalidad y costo.",
    tiempos:
      "Modalidad A: desde que nos pasas el producto con su ficha técnica, mínimo 1 semana para confirmarte el producto y hasta 15 días para sondear varios proveedores, verificar las especificaciones técnicas y validar que las fuentes sean buenas. Modalidad B: la misma ventana, normalmente más rápido porque verificamos un proveedor que ya tienes.",
    estado: "activo",
    nota: "El servicio llega hasta completar la compra y verificar que todo salga bien; lo que viene después —consolidación, flete, aduana y entrega— son servicios complementarios.",
  },
  {
    slug: "asesoria-pagos",
    titulo: "Asesoría en pagos a proveedores",
    sede: "cn",
    // grounded: copy actual + FAQ §6 (Yuan: Alipay/WeChat/transfer/efectivo)
    resumen:
      "Facilitamos transacciones seguras a tus proveedores chinos (Yuan vía Alipay, WeChat Pay, transferencia o efectivo en China), para que pagues con respaldo.",
    incluye: [],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Escríbenos por WhatsApp y un asesor te orienta de forma segura.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["incluye/noIncluye", "costo/comisión", "cómo se solicita (detalle)"],
  },
  {
    slug: "muestras-courier",
    titulo: "Envío de muestras y documentos (courier express)",
    sede: "cn",
    // grounded: copy actual. ACTIVO (decisión founder). NO es flete aéreo de carga.
    resumen:
      "Envíos urgentes por DHL, UPS o FedEx desde Yiwu para muestras pre-producción, documentos y lotes pequeños críticos.",
    incluye: ["Courier express de muestras, documentos y paquetes pequeños desde China."],
    noIncluye: [
      "No es flete aéreo de carga: la carga grande va por vía marítima (LCL/FCL). El aéreo de carga está temporalmente suspendido.",
    ],
    precio: "",
    comoSolicitar: "Escríbenos por WhatsApp con qué necesitas enviar y a dónde.",
    tiempos: "",
    estado: "activo",
    nota: "Courier de muestras y documentos: activo. Distinto del flete aéreo de carga (suspendido).",
    _pendiente: ["costo/condición", "tiempos", "límite de tamaño/peso"],
  },

  // ── Grupo: trámites y legal ──────────────────────────────────────
  {
    slug: "visado-chino",
    titulo: "Gestión de visado de negocios chino",
    sede: "ve",
    // grounded: copy actual SERVICES_VE
    resumen:
      "Asesoría documental, diligencia de formularios, coordinación con el consulado y toma de fotografía en nuestras oficinas. Todo el trámite desde Valencia: no necesitas ir a China.",
    incluye: [
      "Asesoría documental y diligencia de formularios.",
      "Coordinación con el consulado.",
      "Toma de fotografía en nuestras oficinas de Valencia.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Escríbenos por WhatsApp para agendar y conocer los requisitos.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["noIncluye", "honorarios + tasas oficiales", "tiempos", "requisitos del cliente"],
  },
  {
    slug: "registro-marca-cn",
    titulo: "Registro de marca en China (CNIPA)",
    sede: "ambas",
    // grounded: copy actual (CN ejecución legal + VE coordinación/documentos)
    resumen:
      "Protección de tu propiedad intelectual ante las autoridades chinas (CNIPA). Preparamos documentos, traducciones y asesoría estratégica desde Venezuela, y coordinamos internamente la gestión legal en China.",
    incluye: [
      "Preparación de documentos y traducciones.",
      "Asesoría estratégica y seguimiento del trámite desde Venezuela.",
      "Coordinación de la gestión legal ante CNIPA en China.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Escríbenos por WhatsApp con tu marca y rubro.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["noIncluye", "honorarios + tasas oficiales", "tiempos (meses)", "qué entrega"],
  },
];

/** Índice slug → ficha, para lookups rápidos. */
export const SERVICIOS_DETALLE_BY_SLUG: Record<string, ServicioDetalle> =
  Object.fromEntries(SERVICIOS_DETALLE.map((s) => [s.slug, s]));

/** Agrupación slug → grupo (para render por sección + índice de salto). */
export const SERVICIOS_POR_GRUPO: Record<string, string[]> = {
  transporte: [
    "dtd-services-lcl",
    "lcl-consolidado",
    "consolidacion-bodega-yiwu",
    "reserva-contenedores",
    "transporte-terrestre",
    "transito-aduana",
  ],
  bodega: [
    "revision-recepcion",
    "etiquetado-piezas",
    "reempaque-defectuosas",
  ],
  origen: [
    "chequeo-etiquetado",
    "verificacion-proveedores",
    "auditoria-calidad",
    "lab-permisologia",
    "compra-asistida",
    "asesoria-pagos",
    "muestras-courier",
  ],
  tramites: ["visado-chino", "registro-marca-cn"],
};
