/**
 * Fichas detalladas de servicios — sitio público (SDD-0063).
 *
 * Por qué existe: el AI Agent de Kommo crawlea dtdcargo.com como fuente de
 * conocimiento. El copy corto de `SERVICES_CN`/`SERVICES_VE` (en design-tokens)
 * era impreciso y la IA dio datos incorrectos a un lead. Acá cada servicio se
 * detalla a fondo (incluye / no incluye / precio o condición / cómo se solicita
 * / tiempos) para que el crawl tome info CERTERA.
 *
 * REGLA DE ORO — NO INVENTAR. Solo entra dato:
 *   (a) grounded en el FAQ de Kommo (docs/specs/0062/assets/faq-knowledge-base.md),
 *       el FAQ on-site (lib/faqs.ts), el TIMELINE o el copy actual; o
 *   (b) dictado por el founder en la entrevista por tandas (SDD-0063).
 * Campos vacíos ("" o []) = PENDIENTES de entrevista → la ficha NO los renderiza
 * (ver `_pendiente`). Nada inventado llega a la web.
 *
 * Coherencia obligatoria con el FAQ: la web y el FAQ deben decir lo mismo.
 */

export type ServicioEstado = "activo" | "suspendido" | "a-pedido";

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
  /** CHECKLIST INTERNO — NO se renderiza. Campos por dictar en la entrevista. */
  _pendiente?: string[];
};

/**
 * Grupos para el índice de salto y el render por sección. El orden refleja lo
 * que más se cotiza (núcleo marítimo primero), luego calidad/proveedores en
 * origen, luego trámites/legal.
 */
export type ServicioGrupo = {
  id: string;
  titulo: string;
  blurb: string;
};

export const SERVICIOS_GRUPOS: ServicioGrupo[] = [
  {
    id: "maritimo",
    titulo: "Envío marítimo puerta a puerta",
    blurb:
      "El núcleo: traer tu mercancía de China a tu puerta en Venezuela, todo incluido (DDP) y pagando al llegar (Financiamiento 100%).",
  },
  {
    id: "calidad",
    titulo: "Calidad y proveedores en origen",
    blurb:
      "Control en China antes de embarcar: inspección, verificación de proveedores, auditoría, laboratorio y compra asistida.",
  },
  {
    id: "tramites",
    titulo: "Trámites, documentos y legal",
    blurb:
      "Aduana, documentación de importación, visado de negocios y registro de marca — gestionado por nuestro equipo.",
  },
];

// ──────────────────────────────────────────────────────────────────
// FICHAS
//
// Estado de llenado a 2026-06-08 (antes de la entrevista por tandas):
// la mayoría tiene `resumen` + `comoSolicitar` grounded y el resto en
// `_pendiente`. Lo grounded se anota con su fuente entre paréntesis.
// ──────────────────────────────────────────────────────────────────

export const SERVICIOS_DETALLE: ServicioDetalle[] = [
  // ── Grupo: marítimo ──────────────────────────────────────────────
  {
    slug: "dtd-services-lcl",
    titulo: "Carga puerta a puerta (LCL) · DDP con Financiamiento 100%",
    sede: "ambas",
    // grounded: FAQ §22/§23/§24/§26 + lib/faqs.ts
    resumen:
      "Nuestro servicio insignia: carga consolidada (LCL) puerta a puerta de China a Venezuela, en modalidad DDP. Nosotros nos encargamos de todo y tú pagas cuando la carga llega — no por adelantado.",
    incluye: [
      // grounded: FAQ §22 (DDP incluye flete+aduana+impuestos) + §24 (toda VE)
      "Flete marítimo internacional desde China hasta Venezuela.",
      "Aduana e impuestos a nuestro nombre (DDP): sin cobros sorpresa.",
      "Entrega puerta a puerta hasta tu dirección, en toda Venezuela.",
      "Financiamiento 100%: pagas cuando la carga llega a Venezuela, no por adelantado.",
      "Consolidación en nuestra bodega de Yiwu de la mercancía de varios proveedores.",
    ],
    noIncluye: [], // [FALTA] founder: ¿seguro de carga? ¿costo de la mercancía? ¿estiba especial?
    // grounded: precio por CBM vía calculadora (FAQ §2/§22). NO hardcodear montos.
    precio:
      "Se calcula por volumen (CBM) y ciudad de destino. Sácalo al instante en la calculadora o pídele la cotización formal a un asesor.",
    comoSolicitar:
      "Calcula tu estimado en dtdcargo.com/calculadora, regístrate en dtdcargo.com/registro para tu MARKBOX y pre-alertas, o escríbenos por WhatsApp.",
    // grounded: FAQ §3 Kommo + decisión founder 2026-06-08 (publicar 60-90 puerta a puerta)
    tiempos:
      "60 a 90 días puerta a puerta: flete interno en China + espera de la próxima salida (cada 15-21 días) + travesía marítima + aduana y entrega en Venezuela.",
    estado: "activo",
    _pendiente: ["noIncluye", "precio: umbral/condición de mejora por volumen"],
  },
  {
    slug: "consolidacion-bodega-yiwu",
    titulo: "Consolidación en bodega propia (FCL / LCL)",
    sede: "cn",
    // grounded: copy actual + FAQ §26
    resumen:
      "Tus proveedores chinos envían a nuestra bodega propia en Yiwu. Ahí recibimos, inspeccionamos, etiquetamos y consolidamos todo en un solo envío — contenedor completo (FCL) o carga consolidada (LCL) — con un único punto de contacto.",
    incluye: [
      // grounded: copy actual SERVICES_CN
      "Recepción de la mercancía de tus distintos proveedores en la bodega de Yiwu.",
      "Consolidación en un solo envío (FCL o LCL).",
      "Un solo punto de contacto para toda tu operación.",
    ],
    noIncluye: [],
    precio: "", // [FALTA] founder
    comoSolicitar:
      "Regístrate en dtdcargo.com/registro para recibir la dirección de bodega y tu MARKBOX, o escríbenos por WhatsApp.",
    tiempos: "", // [FALTA] founder: tiempo de espera de salida (cada 15-21 días)
    estado: "activo",
    _pendiente: ["incluye: ¿almacenaje gratis X días? ¿reempaque?", "noIncluye", "precio/condición de almacenaje extra", "tiempos de espera de salida"],
  },
  {
    slug: "reserva-contenedores",
    titulo: "Reserva de contenedor completo (FCL)",
    sede: "cn",
    // grounded: copy actual SERVICES_CN
    resumen:
      "Coordinamos la reserva del buque, posicionamos el contenedor vacío en la fábrica de tu proveedor y embarcamos. Gestionamos la documentación de exportación para que tu carga salga en regla.",
    incluye: [
      "Reserva del buque y posicionamiento del contenedor vacío en la fábrica.",
      "Gestión de la documentación de exportación.",
    ],
    noIncluye: [],
    precio: "", // [FALTA] founder
    comoSolicitar:
      "El FCL y la carga especial se cotizan con un asesor (no están en la calculadora pública). Escríbenos por WhatsApp.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["incluye/noIncluye", "precio/condición", "tiempos"],
  },
  {
    slug: "transito-aduana",
    titulo: "Tránsito de aduana y desaduanaje",
    sede: "ve",
    // grounded: copy actual + FAQ §23
    resumen:
      "Coordinamos el paso de tu mercancía por la aduana venezolana. Equipo local que conoce la normativa vigente para nacionalizar tu carga marítima. En DDP la aduana y los impuestos ya van incluidos en el precio.",
    incluye: [
      "Gestión del paso por aduana y nacionalización de tu carga marítima.",
      "Aduana e impuestos a nuestro nombre cuando contratas DDP (sin cobros sorpresa).",
    ],
    noIncluye: [],
    precio: "", // [FALTA] founder: ¿se vende suelto o solo dentro de DDP?
    comoSolicitar: "Va incluido en tu envío DDP. Escríbenos por WhatsApp para tu caso.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["¿se ofrece suelto o solo dentro de DDP?", "noIncluye", "tiempos de nacionalización"],
  },
  {
    slug: "last-mile",
    titulo: "Entrega nacional (last mile)",
    sede: "ve",
    // grounded: copy actual + FAQ §24
    resumen:
      "Una vez liberada la carga, organizamos el transporte interno hasta tu almacén o negocio en cualquier punto de Venezuela. Como es puerta a puerta, no tienes que ir a buscar la carga a ningún puerto.",
    incluye: [
      "Transporte interno desde la bodega de Valencia hasta tu dirección, en toda Venezuela.",
    ],
    noIncluye: [],
    precio: "", // [FALTA] founder: ¿incluido en DDP siempre? ¿recargo por zona remota?
    comoSolicitar: "Va incluido en tu envío puerta a puerta. Confírmale tu ciudad a un asesor.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["¿incluido en DDP a toda ciudad o recargo por zona?", "noIncluye", "tiempos"],
  },

  // ── Grupo: calidad y proveedores ─────────────────────────────────
  {
    slug: "chequeo-etiquetado",
    titulo: "Inspección y etiquetado de mercancía",
    sede: "cn",
    // grounded: copy actual + /servicios/inspeccion (lib/inspeccion.ts)
    resumen:
      "Verificación física de tu mercancía contra la ficha técnica antes del embarque, más etiquetado y marcado según tus requerimientos o la normativa de destino. Parte de nuestra línea completa de inspección de calidad en China.",
    incluye: [
      "Verificación física contra ficha técnica antes de embarcar.",
      "Etiquetado y marcado según tus requerimientos o la normativa de destino.",
    ],
    noIncluye: [],
    // precios de inspección = STAND-BY (decisión founder): no publicar, los envía el asesor
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
    // grounded: copy actual + FAQ §9. ⚠️ Proveedor = red propia DTD, NUNCA se revela.
    resumen:
      "Somos tu departamento de compras en China: te ayudamos a ubicar el producto, negociar y gestionar la compra (incluso pagarle al proveedor) antes de consolidar tu carga.",
    incluye: [
      "Ubicación del producto y del proveedor adecuado.",
      "Negociación y gestión de la compra.",
      "Pago al proveedor en China (según tu caso).",
    ],
    noIncluye: [],
    // modelo comercial SIN DEFINIR (margen/comisión) → no publicar precio
    precio: "",
    comoSolicitar:
      "Mándanos tu lista de productos por WhatsApp; un asesor te confirma viabilidad, modalidad y costo.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["modelo comercial (margen/comisión/cómo se cobra) — SIN DEFINIR", "noIncluye", "tiempos"],
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
      // grounded por decisión founder: distinguir del flete aéreo de carga
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
  {
    slug: "documentos-importacion",
    titulo: "Documentos de importación",
    sede: "ve",
    // grounded: copy actual SERVICES_VE
    resumen:
      "Elaboramos, revisamos y tramitamos toda la documentación aduanera y logística: facturas de embarque, declaraciones, certificados y requerimientos normativos.",
    incluye: [
      "Elaboración y revisión de facturas de embarque, declaraciones y certificados.",
      "Gestión de los requerimientos normativos de importación.",
    ],
    noIncluye: [],
    precio: "",
    comoSolicitar: "Escríbenos por WhatsApp; va de la mano de tu envío.",
    tiempos: "",
    estado: "activo",
    _pendiente: ["¿suelto o dentro de DDP?", "noIncluye", "precio", "tiempos"],
  },
];

/** Índice slug → ficha, para lookups rápidos. */
export const SERVICIOS_DETALLE_BY_SLUG: Record<string, ServicioDetalle> =
  Object.fromEntries(SERVICIOS_DETALLE.map((s) => [s.slug, s]));

/** Agrupación slug → grupo (para render por sección + índice de salto). */
export const SERVICIOS_POR_GRUPO: Record<string, string[]> = {
  maritimo: [
    "dtd-services-lcl",
    "consolidacion-bodega-yiwu",
    "reserva-contenedores",
    "transito-aduana",
    "last-mile",
  ],
  calidad: [
    "chequeo-etiquetado",
    "verificacion-proveedores",
    "auditoria-calidad",
    "lab-permisologia",
    "compra-asistida",
    "asesoria-pagos",
    "muestras-courier",
  ],
  tramites: ["visado-chino", "registro-marca-cn", "documentos-importacion"],
};
