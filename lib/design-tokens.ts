/**
 * DTD·CARGO design tokens — fuente: _handoff_preview/dtd-cargo/project/Brand Book DTD.html
 * + Brochure_DTD_Cargo_China_Venezuela.docx (contenido editorial).
 *
 * Estos tokens espejan 1:1 las CSS custom properties definidas en globals.css.
 * Úsalos desde TSX cuando necesités el valor (ej. estilos inline, props, etc.).
 * Para clases utilitarias, preferí los tokens de Tailwind (@theme en globals.css).
 */

export const DTD = {
  // Brand primary (vino tinto)
  wine: "#7F0F1A",
  wineDeep: "#5E0A12",
  wineSoft: "#C2747F",

  // Brand secondary (navy oscuro)
  ink: "#0F1E3D",

  // Greys (escala neutra)
  grey900: "#1F1F1F",
  grey700: "#333333",
  grey500: "#6B6B6B",
  grey300: "#C9C5BE",
  grey200: "#E8E6E2",
  grey100: "#F2F0EC",

  // Surfaces
  paper: "#FBFAF7",
  white: "#FFFFFF",

  // Crema — color oficial para el isotipo sobre fondos oscuros
  cream: "#E8DCC8",

  // Status colors — Brand Book DTD v2.0
  statusSuccess: "#1F8A5B",
  statusWarning: "#B8893A",
  statusDanger:  "#C2353F",
  whatsapp:      "#25D366",
} as const;

export type DTDColor = keyof typeof DTD;

// ──────────────────────────────────────────────────────────────────
// BRAND ASSETS — rutas relativas a `public/`
// Cuando llegue el logo final, basta con dejar los archivos nuevos
// en `public/brand/` y actualizar este objeto. Nadie más se entera.
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// SOMBRAS OFICIALES — Brand Book DTD v2.0 · colors.json § shadows
// Usar estas variables en CSS/inline styles para consistencia total.
// ──────────────────────────────────────────────────────────────────

export const SHADOWS = {
  /** Sombra estándar de toda ventana/card en reposo */
  card: "0 2px 4px rgba(15,30,61,0.08), 0 8px 16px rgba(15,30,61,0.10), 0 24px 48px -16px rgba(15,30,61,0.22)",
  /** Sombra al hover — usar con transform: translateY(-2px) */
  cardHover: "0 4px 8px rgba(15,30,61,0.10), 0 12px 24px rgba(15,30,61,0.14), 0 32px 60px -18px rgba(15,30,61,0.32)",
  /** Sombra para cards sobre fondo navy */
  cardOnDark: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 20px rgba(0,0,0,0.32), 0 24px 60px -20px rgba(0,0,0,0.5)",
} as const;

export const BRAND_ASSETS = {
  /**
   * Lockup completo: null fuerza el render por componente (isotipo + wordmark CSS).
   *
   * Los SVG oficiales `dtdcargo-logo-lockup.svg` y `dtdcargo-logo-light.svg` embedean
   * el isotipo PNG via `<image xlink:href="dtdcargo-isotipo.png">`. Esta referencia
   * externa NO se resuelve cuando el SVG se carga como `<img src="...">` (restricción
   * de seguridad del navegador). Resultado visible: solo wordmark sin isotipo.
   *
   * Solución: usar el fallback de BrandMark que renderiza `<Image src=isotipo.png />`
   * + wordmark CSS con Archivo Black. Es brand-compliant (usa los archivos provistos
   * y la fuente oficial; no recoloriza vía CSS filter).
   */
  logoFull: null as string | null,
  logoFullDark: null as string | null,
  /**
   * Isotipo PNG directo (sin wrapper SVG). El wrapper SVG tendría el mismo problema
   * de imagen externa no resuelta. PNG funciona en cualquier `<img>` context.
   */
  isotipo: "/brand/dtdcargo-isotipo.png",
  /**
   * Isotipo para fondos oscuros. Si es null, el componente aplica `filter: invert`
   * (o el SVG light usa feColorMatrix interno).
   */
  isotipoDark: null as string | null,
  /** Ilustración hero del contenedor (SVG vectorial del handoff original). */
  containerSvg: "/brand/container.svg",
  /** Favicon multi-size (.ico) del brand-export. */
  favicon: "/brand/favicon.ico",
  /** Apple touch icon (180×180) del brand-export — para iOS home screen. */
  appleIcon: "/brand/apple-touch-icon.png",
  /** OG image (1200×630) — preview en redes sociales / WhatsApp / X. */
  ogImage: "/brand/og-image.png",
} as const;

// Layout tokens
export const LAYOUT = {
  maxWidth: 1280,
  breakpoints: {
    sm: 720,
    md: 1080,
    lg: 1200,
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// CONTACTO — fuente: Brand Book + Brochure
// ──────────────────────────────────────────────────────────────────

/**
 * Construye un link de wa.me con mensaje pre-rellenado. Usa CONTACT.ve.whatsappRaw.
 *
 * Mientras el ERP no exponga `POST /api/public/cotizar` y `/leads` reales,
 * todos los CTAs primarios del sitio abren WhatsApp para mantener la promesa
 * "un asesor humano te responde" y no romper trust con respuestas mock.
 *
 * Cuando el ERP esté listo, este helper queda como utility para el FAB y los
 * canales de soporte que sigan siendo WhatsApp.
 */
export function buildWhatsAppLink(message: string): string {
  // Acceso por nombre porque CONTACT está declarado más abajo en este archivo.
  // En runtime no hay problema porque es una llamada a función.
  return `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${encodeURIComponent(message)}`;
}

/**
 * Construye un link a Google Maps para una dirección. Usado en footer y /contacto
 * para que las direcciones físicas sean verificables (trust signal B2B logística).
 */
export function buildGoogleMapsLink(fullAddress: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export const CONTACT = {
  // Nombre legal completo
  legalName: "DTD CARGO · Doortudoor Services",
  // Web y social
  web: "www.dtdcargo.com",
  instagram: {
    handle: "@doortudoor_",
    url: "https://www.instagram.com/doortudoor_?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  },
  // Email general (fuente brochure)
  emailGeneral: "info@dtdcargo.com",
  // Sedes
  ve: {
    label: "Venezuela",
    city: "Valencia, Carabobo",
    address: "Edificio Kokuy, Av. Bolívar Norte",
    addressFull: "Edificio Kokuy, Av. Bolívar Norte. Valencia, Carabobo, Venezuela",
    /**
     * Link directo al pin de Google Maps con el logo y la info verificada de DTD.
     * Más confiable que una búsqueda por dirección (que puede caer en otra
     * coordenada del mismo edificio o en una ubicación aproximada).
     */
    mapsUrl: "https://maps.app.goo.gl/76T5MAeeTyynwV1M6",
    phone: "+58 241 414 7886",
    phoneRaw: "+582414147886",
    whatsapp: "+58 412 166 8021",
    whatsappRaw: "584121668021",
    email: "Vzla@dtdcargo.com",
    hours: "Lun a Vie · 8:00 – 17:00 (GMT-4)",
  },
  cn: {
    label: "China",
    city: "Yiwu City, Zhejiang",
    address: "Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11)",
    addressFull:
      "Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11), Yiwu City, Zhejiang, China",
    /**
     * Dirección oficial en caracteres chinos — para WeChat / proveedores locales.
     * Fuente: Brand Book DTD v1.0 § 19 (China Supplier Clip).
     */
    addressCjk: "义乌市义乌港二期直通仓2栋2号货7--货11",
    /** Encargado de bodega — 小孙 (Xiao Sun) */
    contactPersonCjk: "小孙",
    contactPersonPinyin: "Xiao Sun",
    /** Teléfono local · formato internacional para tel: link */
    phone: "+86 180 0689 1419",
    phoneRaw: "+8618006891419",
    /** Teléfono en formato chino (sin +86, como se escribe en WeChat). */
    phoneCjk: "18006891419",
    /** Horario en español (corregido a 17:30 según brand book). */
    hours: "Lun a Sáb · 9:00 – 17:30 (GMT+8)",
    /** Horario en chino — para el clip de WeChat. */
    hoursCjk: "周一至周六上午9点到下午5点半",
    email: "China@dtdcargo.com",
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// SERVICIOS — fuente: Brochure DTD Cargo China-Venezuela
// 16 servicios agrupados por sede + tabla cruzada
// ──────────────────────────────────────────────────────────────────

export type ServiceLocation = "cn" | "ve";

export type Service = {
  slug: string;
  title: string;
  /**
   * Traducción / expansión de jerga técnica del título (Incoterms, siglas).
   * Se renderiza en pequeño debajo del título para que clientes no expertos
   * entiendan el servicio sin tener que googlear. Ej: "Full Container Load".
   */
  subtitle?: string;
  copy: string;
  benefit: string;
  icon: string;
  location: ServiceLocation;
  featured?: boolean;
};

// Servicios desde Yiwu, China
export const SERVICES_CN: Service[] = [
  {
    slug: "reserva-contenedores",
    title: "Reserva de contenedores FCL",
    subtitle: "Full Container Load",
    copy: "Coordinamos la reserva del buque, posicionamos el contenedor vacío en la fábrica de tu proveedor y embarcamos. Nosotros figuramos como exportador en el BL; tú quedas como consignatario único.",
    benefit: "Tu proveedor no puede desviar la carga",
    icon: "Container",
    location: "cn",
  },
  {
    slug: "consolidacion-bodega-yiwu",
    title: "Consolidación en bodega Yiwu",
    copy: "Recepción de múltiples proveedores, clasificación y consolidación para envío.",
    benefit: "Optimización de espacio y costos",
    icon: "Warehouse",
    location: "cn",
    featured: true,
  },
  {
    slug: "chequeo-etiquetado",
    title: "Inspección y etiquetado de mercancía",
    copy: "Verificación física contra ficha técnica antes del embarque, más etiquetado y marcado según requerimientos del cliente o normativa de destino.",
    benefit: "Cero sorpresas a destino",
    icon: "Check",
    location: "cn",
  },
  {
    slug: "verificacion-proveedores",
    title: "Verificación de proveedores",
    copy: "Auditoría de legitimidad, inspección pre-producción y pre-embarque.",
    benefit: "Mitigación de riesgo comercial",
    icon: "Shield",
    location: "cn",
  },
  {
    slug: "auditoria-calidad",
    title: "Auditoría y control de calidad",
    copy: "Auditorías online/presenciales, QC, estándares internacionales.",
    benefit: "Cumplimiento normativo",
    icon: "Shield",
    location: "cn",
  },
  {
    slug: "lab-permisologia",
    title: "Lab testing y permisología en China",
    copy: "Coordinamos pruebas de laboratorio (RoHS, CE, FDA, SGS) y gestión de permisos requeridos para exportación.",
    benefit: "Certificación lista para destino",
    icon: "Shield",
    location: "cn",
  },
  {
    slug: "muestras-courier",
    title: "Envío de muestras y courier aéreo",
    copy: "Envíos urgentes por DHL/UPS/FedEx desde Yiwu: muestras pre-producción, documentos, lotes pequeños críticos.",
    benefit: "Velocidad cuando importa",
    icon: "Box",
    location: "cn",
  },
  {
    slug: "compra-asistida",
    title: "Compra asistida",
    copy: "Actuamos como tu departamento de compras en China: ubicación y negociación.",
    benefit: "Ahorro de tiempo, acceso directo",
    icon: "Cart",
    location: "cn",
  },
  {
    slug: "asesoria-pagos",
    title: "Asesoría en pagos",
    copy: "Facilitamos transacciones seguras a proveedores chinos.",
    benefit: "Seguridad financiera",
    icon: "Payment",
    location: "cn",
  },
  {
    slug: "registro-marca-cn",
    title: "Registro de marca",
    copy: "Gestión de propiedad intelectual ante autoridades chinas (CNIPA).",
    benefit: "Protección legal anti-falsificación",
    icon: "Stamp",
    location: "cn",
  },
];

// Servicios desde Valencia, Venezuela
export const SERVICES_VE: Service[] = [
  {
    slug: "dtd-services-lcl",
    title: "DTD Services — Carga puerta a puerta (LCL)",
    subtitle: "Less than Container Load · Carga consolidada",
    copy: "División de carga consolidada puerta a puerta, nacida en 2015. Especializada en volúmenes menores que no justifican un contenedor completo: consolidamos en China y entregamos directo en Venezuela.",
    benefit: "Promesa door-to-door cumplida",
    icon: "Box",
    location: "ve",
    featured: true,
  },
  {
    slug: "visado-chino",
    title: "Gestión de trámites de visado chino",
    copy: "Asesoría documental, diligencia de formularios, coordinación con consulado y toma de fotografía en nuestras oficinas. Todo el trámite desde Valencia, no necesitas ir a China.",
    benefit: "Cero burocracia para vos",
    icon: "Passport",
    location: "ve",
  },
  {
    slug: "registro-marca-coord",
    title: "Registro de marca en China (coordinación)",
    copy: "Preparación de documentos, traducciones, asesoría estratégica y seguimiento del trámite desde Venezuela. Coordinamos internamente con China.",
    benefit: "Tu marca protegida sin viajar",
    icon: "Stamp",
    location: "ve",
  },
  {
    slug: "documentos-importacion",
    title: "Documentos de importación",
    copy: "Elaboramos, revisamos y tramitamos toda la documentación aduanera y logística: facturas de embarque, declaraciones, certificados y requerimientos normativos.",
    benefit: "Tu carga entra sin contratiempos",
    icon: "Doc",
    location: "ve",
  },
  {
    slug: "transito-aduana",
    title: "Tránsito de aduana y desaduanaje",
    copy: "Coordinamos el paso de tu mercancía por aduana venezolana. Equipo local que conoce la normativa vigente para nacionalizar carga aérea o marítima.",
    benefit: "Nacionalización sin demoras",
    icon: "Shield",
    location: "ve",
  },
  {
    slug: "last-mile",
    title: "Trámites logísticos nacionales (last mile)",
    copy: "Una vez liberada la carga, organizamos transporte interno hasta tu almacén o negocio en cualquier punto de Venezuela.",
    benefit: "Desde el puerto hasta tu puerta",
    icon: "Truck",
    location: "ve",
  },
];

// Catálogo total ordenado para grids y selects
export const SERVICES: Service[] = [...SERVICES_VE, ...SERVICES_CN];

// Para vistas previas / home: los 5 más representativos (featured + estratégicos)
export const SERVICES_FEATURED: Service[] = [
  SERVICES_VE[0], // DTD Services LCL (featured VE)
  SERVICES_CN[1], // Consolidación bodega Yiwu (featured CN)
  SERVICES_CN[0], // Reserva FCL (con BL propio)
  SERVICES_VE[4], // Tránsito aduana
  SERVICES_CN[5], // Compra asistida
];

// Tabla cruzada de responsabilidad por sede (fuente: brochure Mapa de Servicios)
export const SERVICES_MATRIX = [
  { service: "Reserva de contenedores FCL", cn: "Ejecución completa", ve: "Coordinación con cliente" },
  { service: "Consolidación y bodega", cn: "Ejecución completa", ve: "—" },
  { service: "Inspección y etiquetado mercancía", cn: "Ejecución completa", ve: "Solicitud del cliente" },
  { service: "Verificación de proveedores", cn: "Ejecución completa", ve: "—" },
  { service: "Auditorías y control de calidad", cn: "Ejecución completa", ve: "—" },
  { service: "Lab testing y permisología", cn: "Ejecución completa", ve: "—" },
  { service: "Compra asistida / sourcing", cn: "Ejecución completa", ve: "Asesoría previa" },
  { service: "Asesoría pagos a proveedores", cn: "Ejecución completa", ve: "Asesoría de pago" },
  { service: "Envío de muestras / courier aéreo", cn: "Ejecución completa", ve: "—" },
  { service: "Registro de marca en China", cn: "Ejecución legal", ve: "Coordinación y documentos" },
  { service: "Trámite de visado chino", cn: "—", ve: "Gestión completa" },
  { service: "Documentos importación / aduana", cn: "—", ve: "Gestión completa" },
  { service: "Tránsito aduana Venezuela", cn: "—", ve: "Gestión completa" },
  { service: "Entrega puerta a puerta (last mile)", cn: "—", ve: "Gestión completa" },
] as const;

// ──────────────────────────────────────────────────────────────────
// INCOTERMS 2020 — términos comerciales que DTD-CARGO maneja en el
// corredor China-Venezuela. Los marcados como principales son los más
// usados en la operación real.
// ──────────────────────────────────────────────────────────────────

export type Incoterm = {
  code: string;
  name: string;
  /** Si es true, se renderiza con peso visual (wine filled). */
  principal: boolean;
  /** Descripción simple en español — se muestra en tooltip al hover/focus. */
  description: string;
};

export const INCOTERMS: Incoterm[] = [
  {
    code: "EXW",
    name: "Ex Works",
    principal: true,
    description:
      "El proveedor entrega en su fábrica. Tú asumes flete, aduana y entrega final.",
  },
  {
    code: "FCA",
    name: "Free Carrier",
    principal: true,
    description:
      "El proveedor entrega al transportista que tú designes en China.",
  },
  {
    code: "FAS",
    name: "Free Alongside Ship",
    principal: false,
    description:
      "El proveedor deja la carga al costado del barco en el puerto chino.",
  },
  {
    code: "FOB",
    name: "Free On Board",
    principal: true,
    description:
      "El proveedor entrega la mercancía ya cargada en el barco. Flete y riesgo pasan a tu cuenta.",
  },
  {
    code: "CFR",
    name: "Cost and Freight",
    principal: false,
    description:
      "El proveedor paga el flete hasta el puerto de destino. Tú cubres el seguro y la aduana.",
  },
  {
    code: "CIF",
    name: "Cost, Insurance and Freight",
    principal: true,
    description:
      "El proveedor paga flete y seguro hasta el puerto de destino. Tú haces aduana y entrega final.",
  },
  {
    code: "CPT",
    name: "Carriage Paid To",
    principal: false,
    description:
      "El proveedor paga el transporte hasta el lugar acordado. El riesgo pasa al primer transportista.",
  },
  {
    code: "CIP",
    name: "Carriage and Insurance Paid To",
    principal: false,
    description:
      "Como CPT, pero el proveedor también paga el seguro hasta el destino.",
  },
  {
    code: "DAP",
    name: "Delivered at Place",
    principal: false,
    description:
      "El proveedor entrega en el lugar acordado, listo para descargar. Aduana e impuestos por tu cuenta.",
  },
  {
    code: "DPU",
    name: "Delivered at Place Unloaded",
    principal: false,
    description:
      "Como DAP, pero el proveedor descarga la mercancía. Aduana e impuestos por tu cuenta.",
  },
  {
    code: "DDP",
    name: "Delivered Duty Paid",
    principal: true,
    description:
      "Tarifa cerrada todo incluido: el flete, el seguro, la aduana y los impuestos. Llega a tu puerta sin gestión para ti.",
  },
];

// ──────────────────────────────────────────────────────────────────
// GLOSARIO — términos de comercio exterior explicados en español.
// Fuente: Brand Book DTD v1.0 § "Página /glosario" + ampliado con
// términos del catálogo operativo (DTDU, MARKBOX, POD, etc.).
// ──────────────────────────────────────────────────────────────────

export type GlossaryCategory = "modalidad" | "incoterm" | "documento" | "tracking" | "tarifa";

export type GlossaryTerm = {
  /** ID para anchor link `/glosario#{id}` */
  id: string;
  /** Display name del término — visible en TOC y como h3 */
  term: string;
  /** Sigla / traducción / categoría secundaria — mostrado debajo del título en gris */
  acronym: string;
  category: GlossaryCategory;
  /** Párrafos del cuerpo del entry. Soporta `<b>` inline para énfasis. */
  body: string[];
  /** Callout opcional "Cómo lo vivís" / "Por qué importa" / "Ejemplo real" */
  analogy?: { label: string; text: string };
};

export const GLOSSARY_CATEGORIES: { id: GlossaryCategory; label: string }[] = [
  { id: "modalidad", label: "Modalidades de envío" },
  { id: "incoterm", label: "Incoterms" },
  { id: "documento", label: "Documentos" },
  { id: "tracking", label: "Tracking y tiempos" },
  { id: "tarifa", label: "Tarifa y volumen" },
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // MODALIDADES
  {
    id: "ddp",
    term: "DDP",
    acronym: "Delivered Duty Paid · Entrega con derechos pagados",
    category: "modalidad",
    body: [
      'Sigla en inglés que significa "Entrega con Derechos Pagados". Es un Incoterm internacional bajo el cual el vendedor —DTD·CARGO— se hace cargo de todos los costos del shipment: flete internacional, despacho aduanero, aranceles, impuestos y entrega final en el domicilio del comprador.',
      "Es el más completo de los 11 Incoterms 2020 — cubre absolutamente todo del lado del vendedor. Tú recibes la mercancía y no pagas nada en destino.",
    ],
    analogy: {
      label: "Cómo lo vives",
      text: "Pides cotización, pagas el total una vez, y semanas después recibes las cajas en tu galpón. Sin llamadas de aduana, sin transferencias de último momento, sin costos extra.",
    },
  },
  {
    id: "puerta-a-puerta",
    term: "Puerta a Puerta",
    acronym: "Door-to-Door",
    category: "modalidad",
    body: [
      "Servicio que cubre el recorrido físico completo: retiramos tu mercancía en la fábrica o proveedor en China y la dejamos en tu domicilio en Venezuela. No tienes que coordinar transporte, aduana, puertos ni retiros intermedios.",
      '"Puerta a Puerta" describe el recorrido; DDP describe quién paga qué. Por eso nuestro servicio se llama "Puerta a Puerta DDP" — las dos palabras juntas describen el qué y el quién.',
    ],
  },
  {
    id: "fcl",
    term: "FCL — Contenedor exclusivo",
    acronym: "Full Container Load",
    category: "modalidad",
    body: [
      "Contratas un contenedor entero (20' o 40') solo para tu mercancía. Conviene desde ~15 m³ o para cargas sensibles que no quieres mezclar (alimentos, frágiles, equipos calibrados).",
      "Un 20' tiene ~33 m³ útiles. Un 40' tiene ~67 m³ útiles. El 40' HC (High Cube) es 10% más alto.",
    ],
  },
  {
    id: "lcl",
    term: "LCL — Carga consolidada",
    acronym: "Less than Container Load",
    category: "modalidad",
    body: [
      "Tu mercancía comparte contenedor con otros clientes. Más económica que un contenedor exclusivo y es la opción ideal cuando tu carga ocupa menos de ~15 m³.",
      "Es el formato más usado por pymes que recién arrancan a importar — pagas solo el espacio que usas.",
    ],
  },
  {
    id: "prepago",
    term: "Prepago",
    acronym: "Modalidad de pago",
    category: "modalidad",
    body: [
      "Indica cuándo pagas a DTD·CARGO: al confirmar el envío, antes de que la carga salga. Esto es lo que nos permite cubrir por adelantado los aranceles e impuestos para que tu mercancía llegue sin trabas ni cobros sorpresa.",
    ],
    analogy: {
      label: "Por qué importa",
      text: "En otros esquemas (pago contra entrega), el cliente recibe sustos cuando la aduana cobra impuestos en destino. Con prepago, lo que cotizamos es lo que pagas — punto final.",
    },
  },

  // INCOTERM
  {
    id: "incoterm",
    term: "Incoterm",
    acronym: "International Commercial Terms · ICC",
    category: "incoterm",
    body: [
      "Reglas internacionales publicadas por la Cámara de Comercio Internacional (ICC) que definen, en una transacción de comercio exterior, quién paga qué y dónde se transfiere el riesgo entre vendedor y comprador.",
      "Existen 11 Incoterms 2020 — los más usados son EXW, FOB, CIF, DAP y DDP. Cuanto más cerca del final del alfabeto, más responsabilidad asume el vendedor. DDP es el más completo: el vendedor cubre absolutamente todo.",
    ],
  },

  // DOCUMENTOS
  {
    id: "bl",
    term: "BL — Bill of Lading",
    acronym: "Conocimiento de embarque marítimo",
    category: "documento",
    body: [
      "Documento legal emitido por la naviera que actúa como contrato de transporte, recibo de la mercancía y título de propiedad de la carga. Indica quién es el shipper (exportador), el consignee (destinatario), y describe la mercancía.",
      "Quien tiene el BL original tiene el derecho a retirar la carga en destino. Por eso emitir el BL a nombre del proveedor en China expone al cliente a desvíos — DTD·CARGO emite los BL a nuestro nombre como exportador, con tu empresa como consignatario único.",
    ],
  },
  {
    id: "awb",
    term: "AWB — Air Waybill",
    acronym: "Guía aérea",
    category: "documento",
    body: [
      "Equivalente al BL pero para carga aérea. Emitido por la aerolínea o consolidador, identifica el envío y permite hacer tracking. A diferencia del BL marítimo, el AWB no es un título de propiedad transferible — es solo un contrato de transporte.",
    ],
  },
  {
    id: "pod",
    term: "POD — Comprobante de entrega",
    acronym: "Proof of Delivery",
    category: "documento",
    body: [
      "Documento firmado por el destinatario cuando recibe la carga en su puerta. Cierra el ciclo logístico y sirve como prueba legal de que la entrega se completó.",
      "En el portal de tracking, el POD aparece como el último evento del envío junto con la fecha y firma escaneada.",
    ],
  },

  // TRACKING
  {
    id: "eta",
    term: "ETA — Llegada estimada",
    acronym: "Estimated Time of Arrival",
    category: "tracking",
    body: [
      "Fecha estimada de llegada del buque al puerto de destino (en nuestro caso, Puerto Cabello). NO es la fecha en que recibes la mercancía — a la ETA todavía hay que sumarle el despacho aduanero y el transporte interno hasta tu domicilio.",
    ],
    analogy: {
      label: "Ejemplo real",
      text: "ETA Puerto Cabello = 12 JUN. Entrega puerta estimada = 15 JUN. La diferencia son los 3 días de despacho + ruta interna hacia Valencia.",
    },
  },
  {
    id: "etd",
    term: "ETD — Salida estimada",
    acronym: "Estimated Time of Departure",
    category: "tracking",
    body: [
      "Fecha estimada de salida del buque desde el puerto de origen (en nuestro corredor: Ningbo o Shanghai). Una vez confirmado el ETD, podés calcular el tránsito típico de 30–40 días hasta Venezuela.",
    ],
  },
  {
    id: "dtdu",
    term: "DTDU — Código de tracking",
    acronym: "DTD Universal · formato propio",
    category: "tracking",
    body: [
      "Código interno de DTD·CARGO que identifica un envío de extremo a extremo. Formato: `DTDU-NNNNNN-XXXX`. Te lo damos al confirmar la cotización y lo usás en /track para ver el estado en tiempo real.",
      "El DTDU agrupa el BL marítimo, los documentos de aduana y el last mile bajo un solo identificador — más cómodo que recordar múltiples números.",
    ],
  },
  {
    id: "markbox",
    term: "MARKBOX",
    acronym: "Código de cliente · formato DTD-XXXX",
    category: "tracking",
    body: [
      "Código único que se le asigna a cada cliente al darse de alta con DTD·CARGO. Sirve para identificar quién es el dueño de cada caja que llega a nuestra bodega en Yiwu.",
      "Cuando pides mercancía a tu proveedor chino, le envías por WeChat el texto pre-formateado con tu MARKBOX. El proveedor lo escribe en cada caja y al llegar a bodega sabemos exactamente a quién pertenece.",
    ],
    analogy: {
      label: "Lo encontrás en",
      text: "/contacto — sección 'Texto listo para WeChat'. Si todavía no tienes MARKBOX, lo solicitás por WhatsApp.",
    },
  },

  // TARIFA Y VOLUMEN
  {
    id: "cbm",
    term: "CBM — Metro cúbico",
    acronym: "Cubic Meter · unidad de volumen",
    category: "tarifa",
    body: [
      "Unidad estándar para cotizar carga marítima LCL. 1 CBM = 1 metro × 1 metro × 1 metro. La tarifa de carga consolidada se calcula como `USD por CBM` o `USD por kg`, lo que sea mayor (por eso la carga liviana voluminosa cuesta lo mismo que la pesada compacta).",
    ],
    analogy: {
      label: "Ejemplo de cálculo",
      text: "Una caja de 60 × 50 × 40 cm = 0.12 CBM. Si tu tarifa es USD 180 por CBM, esa caja sale en USD 21.60 de flete (más aduana, impuestos y last mile en modalidad DDP).",
    },
  },
  {
    id: "hs-code",
    term: "HS Code",
    acronym: "Harmonized System · código arancelario",
    category: "tarifa",
    body: [
      "Sistema internacional de 6–10 dígitos que clasifica cada tipo de producto. Determina el arancel aduanero y los requisitos sanitarios/técnicos. Por ejemplo, herramientas manuales = 8205.59, juguetes plásticos = 9503.00.",
      "Tu factura comercial debe declarar el HS Code correcto para que el despacho sea rápido. Si no lo conoces, te ayudamos a clasificar — un HS Code incorrecto puede demorar días en aduana o generar reclasificación con multas.",
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// NEWS POSTS — placeholder posts para /noticias (tipo blog).
// Cuando el founder pase contenido real, reemplazar este array.
// ──────────────────────────────────────────────────────────────────

export type NewsCategory = "operacion" | "industria" | "tutorial" | "anuncio";

export type NewsPost = {
  /** Slug para URL `/noticias/{slug}` */
  slug: string;
  category: NewsCategory;
  title: string;
  excerpt: string;
  /** Fecha ISO YYYY-MM-DD */
  date: string;
  /** Tiempo de lectura aproximado en minutos */
  readTimeMin: number;
  /**
   * Cuerpo del artículo — array de párrafos.
   * Si está vacío/undefined, la página individual muestra "Próximamente"
   * con la metadata + CTA WhatsApp. Cuando llegue contenido real, llenar
   * este array y la página renderiza el artículo completo automáticamente.
   * Soporta `<b>` y `<a href>` inline en los párrafos.
   */
  body?: string[];
};

export const NEWS_CATEGORIES: Record<NewsCategory, { label: string; color: string }> = {
  operacion:  { label: "Operación",  color: "var(--color-wine)" },
  industria:  { label: "Industria",  color: "var(--color-ink)" },
  tutorial:   { label: "Tutorial",   color: "#1F8A5B" },
  anuncio:    { label: "Anuncio",    color: "#B8893A" },
};

export const NEWS_POSTS: NewsPost[] = [
  {
    slug: "guia-incoterms-2020",
    category: "tutorial",
    title: "Guía rápida de Incoterms 2020 para importadores venezolanos",
    excerpt:
      "Los 11 términos comerciales explicados sin jerga. Cuál elegir según tu tipo de carga y la relación que tienes con tu proveedor en China.",
    date: "2026-05-15",
    readTimeMin: 5,
  },
  {
    slug: "yiwu-ventaja-estrategica",
    category: "industria",
    title: "Por qué Yiwu es el mejor punto de partida para tu importación",
    excerpt:
      "75.000+ tiendas, 2 millones de productos disponibles, MOQ excepcionalmente bajo. Lo que hace a Yiwu único en el mapa logístico mundial.",
    date: "2026-05-08",
    readTimeMin: 4,
  },
  {
    slug: "tiempos-yiwu-puerto-cabello",
    category: "operacion",
    title: "Tiempos reales de tránsito: Yiwu → Puerto Cabello",
    excerpt:
      "ETD, ETA, despacho de aduana, last mile. Desglose del recorrido completo con tiempos típicos por modalidad (FCL, LCL DDP, courier aéreo).",
    date: "2026-04-22",
    readTimeMin: 6,
  },
];

// ──────────────────────────────────────────────────────────────────
// HERO — copy del bloque principal del home (fuente: Brand Book § Hero)
// ──────────────────────────────────────────────────────────────────

export const HERO = {
  eyebrow: "Logística end-to-end · Desde 2008",
  /**
   * Slogan dividido en 3 líneas.
   * `accent: "wine"` = pintada en wine.
   * `accent: "grey"` = pintada en grey-700.
   * Sin accent = ink (default).
   */
  headline: [
    { text: "DE CHINA", accent: null },
    { text: "A TU PUERTA.", accent: "wine" as const },
    { text: "SIN INTERMEDIARIOS.", accent: "grey" as const },
  ],
  subtitle:
    "Carga suelta DDP puerta a puerta, agente de compra en territorio, registro de marca y visa de negocios. Tu operación China-LATAM con un único responsable.",
  search: {
    originPlaceholder: "Origen — país, ciudad o fábrica",
    originDefault: "China",
    destPlaceholder: "Destino — país o ciudad",
    destDefault: "Venezuela",
    cta: "Cotizar por WhatsApp",
  },
  /** 3 trust marks debajo del cotizador */
  trustMarks: [
    "Tarifa mejorada por +10 CBM",
    "Inspección gratis +20 CBM",
    "Equipo propio en Yiwu & Valencia",
  ],
  /** Badge circular sobre el contenedor — "360°" = cobertura, no rotación literal */
  badge: {
    main: "360°",
    sub: "Puerta a puerta",
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// STATS — 4 KPI hero (banda navy debajo del Hero)
// ──────────────────────────────────────────────────────────────────

export const STATS = [
  {
    // Total de experiencia desde los orígenes comerciales en China (2008).
    // Hoy 2026 - 2008 = 18 años de operación en la cadena de suministro
    // China → América Latina.
    num: "18",
    suffix: "AÑOS",
    label: "De experiencia desde 2008",
  },
  {
    // 11 años de respaldo específico en Venezuela (desde la expansión 2015
    // al corredor VE con DTD Services).
    num: "11",
    suffix: "AÑOS",
    label: "Nos respaldan en Venezuela",
  },
  {
    num: "24",
    suffix: "HS",
    label: "Cotización cerrada garantizada",
  },
  {
    // Yiwu (China) + Valencia (Venezuela) — corregido vs Brand Book HTML que
    // decía "Yiwu & Guangzhou" (error: Guangzhou no es base, es origen de carga).
    num: "2",
    suffix: "BASES",
    label: "Equipo propio en Yiwu & Valencia",
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// CÓMO TRABAJAMOS — 4 pasos del flujo operativo
// ──────────────────────────────────────────────────────────────────

export const STEPS = [
  {
    n: "01",
    title: "Cotiza DDP",
    copy: "Envíanos el link de Alibaba o la ficha del producto. Cotización cerrada en 24 hs incluyendo todo.",
  },
  {
    n: "02",
    title: "Inspección",
    copy: "Nuestro equipo en China visita fábrica, audita calidad y envía reporte fotográfico.",
  },
  {
    n: "03",
    title: "Consolidamos",
    copy: "Recogemos en fábrica, consolidamos en depósito Yiwu o Shenzhen y embarcamos.",
  },
  {
    n: "04",
    title: "Entregamos",
    copy: "Aduana e impuestos a nuestro nombre. Entregamos en tu puerta con factura final.",
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// HISTORIA — 5 hitos (2008 → 2016) — fuente: brochure "Nuestra Historia"
// ──────────────────────────────────────────────────────────────────

export const TIMELINE = [
  {
    year: "2008",
    title: "Orígenes comerciales en China",
    copy: "Nuestro primer viaje de compra al país asiático. Aprendimos el terreno desde adentro.",
  },
  {
    year: "2010",
    title: "Fundación de la empresa de carga",
    copy: "Formalizamos la operación logística. Primera alianza estratégica en Guangzhou.",
  },
  {
    year: "2011",
    title: "Exportación a múltiples destinos",
    copy: "Operación de carga a varios países. Venezuela arranca con FCL (Full Container Load).",
  },
  {
    year: "2012",
    title: "Demanda creciente de carga consolidada",
    copy: "Aumenta la solicitud de LCL: consolidación de varios clientes en un mismo embarque.",
  },
  {
    year: "2013",
    title: "Apertura estratégica en Yiwu",
    copy: "Sede propia en el mercado mayorista más grande del mundo.",
  },
  {
    year: "2014",
    title: "Servicio puerta a puerta",
    copy: "Lanzamos el servicio door-to-door para clientes que necesitan logística end-to-end.",
  },
  {
    year: "2015",
    title: "Expansión a Venezuela",
    copy: "Nace DTD Services — carga LCL puerta a puerta para el mercado venezolano.",
  },
  {
    year: "2016",
    title: "Consolidación y auditorías",
    copy: "Integración de QC, lab testing y verificación de proveedores como estándar operativo.",
  },
  {
    year: "2019",
    title: "Catálogo de 8 servicios",
    copy: "Bodega ampliada en Yiwu y consolidación de la operación con suite completa de servicios.",
  },
  {
    year: "2020",
    title: "Operación durante la pandemia",
    copy: "Coordinamos importación de equipos médicos y mascarillas. Rutas activas cuando el mercado se paralizó.",
  },
  {
    year: "2023",
    title: "Reapertura de China al mundo",
    copy: "Retomamos visitas presenciales a fábrica y atendemos demanda contenida durante el cierre.",
  },
  {
    year: "2024",
    title: "Ampliación a 10 servicios",
    copy: "Sumamos etiquetado, envío de muestras y courier aéreo a la suite logística.",
  },
  {
    year: "2026",
    title: "12+ modalidades de servicio",
    copy: "Suite logística completa entre China y América Latina con cobertura end-to-end.",
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// YIWU — 6 ventajas estratégicas — fuente: brochure "Yiwu Ventaja"
// ──────────────────────────────────────────────────────────────────

export type YiwuAdvantage = {
  title: string;
  copy: string;
  metric: string;
  metricLabel: string;
  /**
   * Definición simple en español — si el metric es una sigla técnica
   * (ej. MOQ, FCL), se muestra en tooltip al hacer hover/focus.
   */
  definition?: string;
};

export const YIWU_ADVANTAGES: YiwuAdvantage[] = [
  {
    title: "Escala incomparable",
    copy: "Mercado mayorista más grande del mundo: 75.000+ tiendas y más de 2 millones de productos disponibles.",
    metric: "75K+",
    metricLabel: "tiendas",
  },
  {
    title: "Precios directos de fábrica",
    copy: "Proximidad a fabricantes y clusters de producción. Eliminamos intermediarios y garantizamos márgenes competitivos.",
    metric: "0",
    metricLabel: "intermediarios",
  },
  {
    title: "Flexibilidad de volumen",
    copy: "A diferencia de otras regiones chinas, Yiwu permite consolidar pedidos de diversos proveedores sin exigir volúmenes mínimos masivos.",
    metric: "MOQ",
    metricLabel: "bajo",
    definition:
      "Minimum Order Quantity — cantidad mínima de pedido que exige un proveedor. En Yiwu este límite es excepcionalmente bajo: puedes consolidar pedidos de varios proveedores sin volúmenes masivos.",
  },
  {
    title: "Concentración industrial",
    copy: "Los principales clusters manufactureros se ubican alrededor de Yiwu: auditar fábricas y consolidar mercancía en horas, no días.",
    metric: "1d",
    metricLabel: "radio",
    definition:
      "Las principales fábricas están a un día de viaje desde Yiwu. Esto permite visitar, auditar y consolidar mercancía en horas, no semanas.",
  },
];

// ──────────────────────────────────────────────────────────────────
// FILOSOFÍA — fuente: brochure "Nuestra Filosofía" + cierre
// ──────────────────────────────────────────────────────────────────

export const PHILOSOPHY = {
  headline: "Confía en los que ya\nrecorrieron el camino.",
  body: "Construimos nuestra reputación cliente a cliente. Sin campañas ruidosas, sin promesas exageradas: paso a paso, contenedor a contenedor. La confianza que nuestros clientes depositan en nosotros es nuestro principal canal de crecimiento.",
  pull: "El boca a boca nos ha mantenido sólidos y constantes en el mercado. No necesitamos tanta bulla cuando los resultados hablan por sí solos.",
  cta: "Deja que nuestra experiencia sea tu mayor tranquilidad.",
} as const;

// ──────────────────────────────────────────────────────────────────
// COTIZADOR — orígenes y destinos sugeridos
// ──────────────────────────────────────────────────────────────────

export const ORIGINS = [
  { code: "YIW", label: "Yiwu, CN", cjk: "义乌" },
  { code: "CAN", label: "Guangzhou, CN", cjk: "广州" },
  { code: "SZX", label: "Shenzhen, CN", cjk: "深圳" },
  { code: "NGB", label: "Ningbo, CN", cjk: "宁波" },
  { code: "SHA", label: "Shanghai, CN", cjk: "上海" },
] as const;

export const DESTINATIONS = [
  { code: "PBL", label: "Puerto Cabello, VE" },
  { code: "VLN", label: "Valencia, VE" },
  { code: "CCS", label: "Caracas, VE" },
  { code: "MAR", label: "Maracaibo, VE" },
] as const;
