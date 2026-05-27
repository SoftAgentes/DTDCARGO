/**
 * DTD Cargo design tokens — fuente: _handoff_preview/dtd-cargo/project/Brand Book DTD.html
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

/**
 * Sistema de assets de marca · DTD-Cargo v3.0 (mayo 2026).
 *
 * Fuente de verdad oficial:
 *   docs/design/brand-book/v3.0/proyecto/Brand Book DTD v3.0.html
 *   docs/design/brand-book/v3.0/proyecto/BRAND-MIGRATION-2026-05.md
 *
 * El isólogo oficial v3.0 tiene 4 variantes según el fondo. Usá `<BrandMark>`
 * desde `components/BrandMark.tsx` que abstrae la selección de variante.
 */
export const BRAND_ASSETS = {
  /** Isólogo oficial v3.0 — variante PRIMARY (sobre fondo claro). 741×764, transparente. */
  isologoPrimary: "/brand/dtdcargo-isologo-primary.png",
  /** Isólogo oficial v3.0 — variante REVERSE (sobre fondo navy/oscuro). 741×764, transparente. */
  isologoReverse: "/brand/dtdcargo-isologo-reverse.png",
  /** Isólogo oficial v3.0 — variante MONO-LIGHT (cream sólido sobre wine). 741×764. */
  isologoMonoLight: "/brand/dtdcargo-isologo-mono-light.png",
  /** Isólogo oficial v3.0 — variante MONO-DARK (navy sólido B&W para imprenta). 741×764. */
  isologoMonoDark: "/brand/dtdcargo-isologo-mono-dark.png",

  /** Ilustración hero del contenedor (SVG vectorial del handoff original). */
  containerSvg: "/brand/container.svg",
  /** Favicon PNG 32×32 (regenerado desde isologoPrimary v3.0 vía scripts/generate-favicons.mjs). */
  favicon32: "/brand/favicon-32.png",
  /** Favicon PNG 16×16 (regenerado v3.0). */
  favicon16: "/brand/favicon-16.png",
  /** Favicon .ico legacy fallback (sin regenerar — modern browsers usan los PNG primero). */
  favicon: "/brand/favicon.ico",
  /** Apple touch icon 180×180 (regenerado v3.0 con fondo paper #FBFAF7). */
  appleIcon: "/brand/apple-touch-icon.png",
  /** OG image (1200×630) — preview en redes sociales / WhatsApp / X. */
  ogImage: "/brand/og-image.png",

  /**
   * @deprecated v2.x. Reemplazado por isologoPrimary en v3.0. Se mantiene la
   * key únicamente porque JSON-LD legacy la consume en layout.tsx; nuevos
   * usos deben referenciar isologoPrimary / isologoReverse / mono-*.
   */
  isotipo: "/brand/dtdcargo-isologo-primary.png",
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
    // URL canónica sin tracking params — limpio para schema.org sameAs.
    url: "https://www.instagram.com/doortudoor_",
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
    subtitle: "FCL directo desde fábrica de tu proveedor",
    copy: "Coordinamos la reserva del buque, posicionamos el contenedor vacío en la fábrica de tu proveedor y embarcamos. Nosotros figuramos como exportador en el BL; tú quedas como consignatario único.",
    benefit: "Tu proveedor no puede desviar la carga",
    icon: "Container",
    location: "cn",
  },
  {
    slug: "consolidacion-bodega-yiwu",
    title: "Consolidación FCL en bodega propia",
    subtitle: "Cuando consolidás varios proveedores",
    copy: "Tus proveedores chinos envían a nuestra bodega propia en Yiwu. Ahí inspeccionamos, etiquetamos y consolidamos todo en un solo contenedor (FCL) o en grupaje (LCL). Sale unificado, con un único BL y un solo responsable.",
    benefit: "Una sola carga desde múltiples proveedores",
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
  { service: "Consolidación FCL en bodega propia", cn: "Ejecución completa", ve: "—" },
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

/**
 * Agrupación derivada de SERVICES_MATRIX por ownership: quién ejecuta cada
 * servicio. Tres buckets:
 *
 * - `onlyYiwu`: 🇨🇳 hace todo, 🇻🇪 no aplica → control de fábrica puro.
 * - `both`: 🇨🇳 ejecuta + 🇻🇪 coordina/asesora con el cliente → operación conjunta.
 * - `onlyValencia`: 🇻🇪 hace todo, 🇨🇳 no aplica → trámites locales venezolanos.
 *
 * Source of truth única: SERVICES_MATRIX. Si se agrega/quita un servicio acá,
 * la agrupación se recalcula sola.
 */
export const SERVICES_OWNERSHIP = {
  onlyYiwu: SERVICES_MATRIX.filter((s) => s.ve === "—").map((s) => s.service),
  both: SERVICES_MATRIX.filter((s) => s.cn !== "—" && s.ve !== "—").map(
    (s) => s.service,
  ),
  onlyValencia: SERVICES_MATRIX.filter((s) => s.cn === "—").map(
    (s) => s.service,
  ),
} as const;

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
      'Sigla en inglés que significa "Entrega con Derechos Pagados". Es un Incoterm internacional bajo el cual el vendedor —DTD Cargo— se hace cargo de todos los costos del shipment: flete internacional, despacho aduanero, aranceles, impuestos y entrega final en el domicilio del comprador.',
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
      "Indica cuándo pagas a DTD Cargo: al confirmar el envío, antes de que la carga salga. Esto es lo que nos permite cubrir por adelantado los aranceles e impuestos para que tu mercancía llegue sin trabas ni cobros sorpresa.",
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
      "Quien tiene el BL original tiene el derecho a retirar la carga en destino. Por eso emitir el BL a nombre del proveedor en China expone al cliente a desvíos — DTD Cargo emite los BL a nuestro nombre como exportador, con tu empresa como consignatario único.",
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
      "Código interno de DTD Cargo que identifica un envío de extremo a extremo. Formato: `DTDU-NNNNNN-XXXX`. Te lo damos al confirmar la cotización y lo usás en /track para ver el estado en tiempo real.",
      "El DTDU agrupa el BL marítimo, los documentos de aduana y el last mile bajo un solo identificador — más cómodo que recordar múltiples números.",
    ],
  },
  {
    id: "markbox",
    term: "MARKBOX",
    acronym: "Código de cliente · formato DTD-XXXX",
    category: "tracking",
    body: [
      "Código único que se le asigna a cada cliente al darse de alta con DTD Cargo. Sirve para identificar quién es el dueño de cada caja que llega a nuestra bodega en Yiwu.",
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
  {
    slug: "navieras-mas-grandes-mundo",
    category: "industria",
    title: "Navieras más grandes del mundo.",
    excerpt:
      "Las 8 Navieras Más Grandes del Mundo en Cargas Marítimas El transporte marítimo es una columna vertebral del comercio global, moviendo mercancías esenciales a través de los océanos de todo el mundo...",
    date: "2023-09-07",
    readTimeMin: 6,
    body: [
      "<b>Las 8 Navieras Más Grandes del Mundo en Cargas Marítimas</b>",
      "El transporte marítimo es una columna vertebral del comercio global, moviendo mercancías esenciales a través de los océanos de todo el mundo. Las navieras más grandes y poderosas del planeta desempeñan un papel crítico en esta industria. Aquí presentamos las 8 navieras más grandes del mundo en términos de cargas marítimas:",
      "<b>1. Maersk Line</b>:",
      "• <b>Sede</b>: Copenhague, Dinamarca.",
      "• <b>Flota</b>: Maersk opera una de las flotas de contenedores más grandes del mundo, con barcos de última generación y una presencia global sólida. Son conocidos por su eficiencia operativa y su compromiso con la sostenibilidad.",
      "fue fundada en 1904 en Copenhague, Dinamarca y se ha mantenido como la naviera más grande del mundo. Cuenta con una fuerza de trabajo de 79.000 empleados en 130 países y opera más de <b>700 </b>buques de carga que visitan 343 puertos a nivel mundial. <b>Maersk</b> puede transportar <b>más de 4 millones</b> de contenedores, medidos en unidades equivalentes a veinte pies (TEU), lo cual le otorga una cuota del mercado de traslado de contenedores de <b>17.7%</b>. Esta naviera es una de las más innovadoras en la industria y ha liderado la idea de inversión en nuevas tecnologías de envíos marítimos.",
      "<b>2. Mediterranean Shipping Company (MSC)</b>:",
      "• <b>Sede</b>: Ginebra, Suiza.",
      "• <b>Flota</b>: MSC es una de las navieras más grandes en términos de capacidad de contenedores. Opera una red extensa de rutas que conectan los cinco continentes y se enfoca en la innovación tecnológica.",
      "La <b>MSC</b> fue fundada en 1970 por el italiano Gianluigi Aponte. Tiene su base en Ginebra, Suiza y es conocida en el mundo tanto por el transporte de contenedores de peso pesado como por su línea operadora de cruceros (MSC Cruises). <b>MSC</b> cuenta con una flota de <b>517</b> buques que acuden a 315 puertos. Esta empresa tiene una capacidad de <b>3,3 millones de TEU</b>, lo cual le permite contar con una participación de mercado de <b>14,5%</b>.",
      "• <b>Sede</b>: Marsella, Francia.",
      "• <b>Flota</b>: CMA CGM es líder en transporte de contenedores y es conocida por su compromiso con la sostenibilidad y la reducción de emisiones. También opera servicios logísticos y terminales portuarias.",
      "La compañía francesa con base en Marsella fue fundada en 1978. Este es el resultado de una fusión entre Compagnie Maritime d’Affrètement (CMA) y Compagnie Générale Maritime (CGM). Esta naviera es ahora la cuarta más grande en el mundo y es una de las más agresivas en cuanto a expandir su cuota de mercado. <b>CMA CGM</b> a penas entró en el top 10 de compañías navieras en el 2000 y a la fecha cuenta con <b>492</b> barcos de carga. Tiene una capacidad para transportar <b>2,6 millones de TEU</b>, lo cual representa alrededor de <b>11.4%</b> del mercado.",
      "<b>4. COSCO Shipping Lines</b>:",
      "• <b>Sede</b>: Shanghái, China.",
      "• <b>Flota</b>: Como parte del grupo COSCO, esta naviera china es una de las más grandes del mundo y ha aumentado su presencia global en los últimos años, especialmente después de la adquisición de OOCL.",
      "Por sus siglas, <b>China Ocean Shipping (Group) Company</b>, es una naviera propiedad del gobierno chino con base en Beiging. Con el fin de convertirse en la tercera naviera más grande del mundo, tuvo que fusionarse con China Shipping Group en febrero del 2016 y adquirió Orient Overseas Container Line (OOCL) en julio del 2018. <b>COSCO</b> tiene una capacidad de <b>2.7 millones de TEU</b> con <b>473</b> buques y una porción de mercado del <b>12,2%</b>.",
      "<b>5. Evergreen Marine Corporation</b>:",
      "• <b>Sede</b>: Taipéi, Taiwán.",
      "• <b>Flota</b>: Evergreen es conocida por su flota de barcos verdes y su presencia en rutas comerciales clave. La empresa se ha centrado en la eficiencia energética y la reducción de emisiones.",
      "Fundada en 1968, <b>Evergreen</b> tiene base en Taoyuán, Taiwán. Cuenta con una flota de <b>203</b> buques con los que puede transportar <b>1.1 millón de TEU</b>. La séptima naviera más grande del mundo tiene una cuota de mercado de <b>5.2%</b>.",
      "<b>6. Hapag-Lloyd</b>:",
      "• <b>Sede</b>: Hamburgo, Alemania.",
      "• <b>Flota</b>: Hapag-Lloyd es una de las navieras más antiguas y grandes del mundo. Se ha centrado en modernizar su flota y en la digitalización de sus operaciones para una mayor eficiencia.",
      "Con su sede principal en Hamburgo, esta compañía fue fundada en 1970. Además es producto de la fusión entre Amerikanische Packetfahrt-Actien-Gesellschaft (HAPAG) y Norddeutscher Lloyd (NDL). Luego, en 2014, se fusionó con la Compañía Sud Americana de Vapores (CSAV) para convertirse en un conglomerado alemán-chileno y la quinta naviera más grande del mundo. <b>Hapag-Lloyd</b> tiene una flota de <b>223</b> buques y una capacidad de <b>1.6 millones de TEU</b>, lo cual le otorga un <b>7.3%</b> de participación en el mercado.",
      "<b>7. China Shipping Container Lines (CSCL)</b>:",
      "• <b>Sede</b>: Shanghái, China.",
      "• <b>Flota</b>: Parte del conglomerado chino China COSCO Shipping Corporation, CSCL ha crecido significativamente en términos de flota y rutas en los últimos años.",
      "CSG, la empresa matriz de CSCL y CSNA, fue fundada el 1 de julio de 1997 y tiene su sede en Shanghai. Es una de las 44 empresas estatales clave bajo la administración directa del Gobierno Central y es un conglomerado naviero de gran tamaño que opera a nivel mundial en varios sectores del transporte marítimo y la logística. Con CSCL como su núcleo, CSG tiene activos totales de RMB 40 mil millones (US$4.82 mil millones @ RMB8.3/US$). Bajo su paraguas, hay cinco flotas especializadas de buques portacontenedores, petroleros, vagabundos, de pasajeros y de carga especial, que comprenden 400 buques con un peso muerto total de 11,5 millones de toneladas. Hoy en día, CSG se ha diversificado en negocios de logística integrada, gestión de terminales, finanzas e inversiones, servicios de ingeniería y mano de obra, suministro y comercio, y tecnología de la información.",
      "<b>8. Yang Ming Marine Transport Corporation</b>:",
      "• <b>Sede</b>: Taipéi, Taiwán.",
      "• <b>Flota</b>: Yang Ming es una naviera de Taiwán que ha estado operando durante más de 40 años. Su flota se ha modernizado y ha expandido su presencia global en rutas comerciales clave.",
      "Fue fundada en 1972 y es ahora la octava compañía de envíos marítimos más grande. Tiene su base en Keelung, Taiwán. Con una flota de <b>97</b> barcos de carga, esta naviera puede manejar <b>656,491 de TEU</b>, lo cual le proporciona un <b>2.9%</b> del mercado.",
      "Estas navieras son gigantes en el mundo del transporte marítimo, moviendo una parte sustancial de la carga global en contenedores y contribuyendo significativamente al comercio internacional. Su influencia se extiende desde la gestión de flotas de última generación hasta iniciativas de sostenibilidad que buscan reducir el impacto ambiental de esta industria crucial. Su continua adaptación a los desafíos globales, como la digitalización y la sostenibilidad, garantiza que seguirán desempeñando un papel central en la economía global.",
      "Si quieres conocer más sobre nuestros servicios puedes escribirnos a nuestro correo info@doortudoor.com",
    ],
  },
  {
    slug: "buques-cargueros-mas-grandes",
    category: "industria",
    title: "Buques Cargueros mas grandes del planeta",
    excerpt:
      "BUQUES DE CARGA Comencemos explicando a que se hace referencia cuando llamamos buque de carga. En este caso, se trata de una nave que se utiliza para transportar todo tipo de mercancías, de un punt...",
    date: "2023-09-07",
    readTimeMin: 3,
    body: [
      "<b>BUQUES DE CARGA</b>",
      "<b>Comencemos explicando a que se hace referencia cuando llamamos buque de carga. En este caso, se trata de una nave que se utiliza para transportar todo tipo de mercancías, de un punto a otro. </b>",
      "De acuerdo con la OMI (Organización Marítima Internacional)<b> el transporte marítimo mueve un 90% del comercio mundial </b>por lo que estamos muy acostumbrados a ver este tipo de embarcaciones por nuestros mares.",
      "Estos pueden trasladar todo tipo de mercancías, desde diferentes muestras de productos como ropa o juguetes, hasta minerales, carbón o petróleo… y dependiendo de dichos materiales transportados reciben un nombre u otro, portacontenedores, buques Ro Ro, buque granelero, buque petrolero…",
      "Nosotros los englobamos todos en buques de carga como entre los barcos más grandes del mundo.",
      "<b>1. Evergreen Ever a lot</b>",
      "Se trata del buque de carga más grande del mundo y <b>ha sido el primero en en superar los 24.000 TEUs</b> (contenedores tamaño estándar) de capacidad. Se trata de un portacontenedor del grupo de astilleros chino CSSC. Sus medidas aproximadas son las siguientes <b>400 m de eslora y 61,50 m de manga</b>.",
      "Fue fabricado en 2022. Su extensión es muy grande y podemos compararlo con unas medidas de tres o cuatro campos de fútbol.",
      "<b>2. HMM Algeciras y HMM Oslo</b>",
      "Hyundai Merchant Marine (HMM) es el naviero del mayor portacontenedores del mundo, el Algeciras fue construido en septiembre de 2019 y el Oslo en 2020. Después del Evergreen el Algeciras es en mayor, con una <b>capacidad de 23.964 TEUs</b>, concretamente se posiciona el segundo lugar únicamente por una diferencia de 28 contenedores.",
      "Al igual que el anterior, tiene unos <b>400 metros de eslora y 61 metros de manga</b>. Su quilla se puede sumergir más de trece metros bajo la superficie. <b>Es el primero de la clase Megamax 24</b>.",
      "El HMM Oslo es el hermano gemelo y tiene prácticamente las mismas medidas y una capacidad de 23.820 TEUs.",
      "<b>3. MSC Gülsün y MSC Mina</b>",
      "La naviera MSC (Mediterranean Shipping Company) es una compañía muy conocida de buques de carga que quiere conquistar las principales rutas marítimas comerciales. Además, no sólo dispone de buques de carga sino que también dispone de cruceros, los cuáles hablaremos posteriormente.",
      "El MSC Mina es consideramos como uno de los barcos más grandes del mundo y fue fabricado en 2019 y en el momento de su presentación (a principios de 2020) era el portacontenedores más grande del mundo, <b>fue en su momento en primero en superar los 23.000 TEUs</b>, ya que tiene una capacidad de 23.756. Además, este buque está dispuesto para transportar cualquier tipo de alimento o medicamento refrigerado ya que dispone de casi 2.000 contenedores frigoríficos.",
      "De la misma compañía disponemos de otros de los buques más grandes como es el MSC Gülsun con una capacidad de 22.960 TEUs que fue en su momento el más grande, meses después superado por su hermano el Mina. <b>La diferencia entre ambos son las cubiertas</b>. El MSC Mina dispone de 13 cubiertas mientras que el Gülsün de 12.",
      "Si quieres conocer más sobre nuestros servicios puedes escribirnos a nuestro correo info@doortudoor.com",
    ],
  },
  {
    slug: "incoterm-exw-explicado",
    category: "tutorial",
    title: "Significado del incoterm EXW.",
    excerpt:
      "¿Qué es el Incoterm EXW (Ex Works)? El Incoterm EXW significa “Ex Works” o “En Fábrica” en español, es uno de los Incoterms establecidos en la versión más reciente de 2020. Es un término que indica...",
    date: "2023-06-26",
    readTimeMin: 5,
    body: [
      "<b>¿Qué es el Incoterm EXW </b>",
      "<b>(Ex Works)?</b>",
      "El Incoterm <b>EXW</b> significa “<b>Ex Works</b>” o “<b>En Fábrica</b>” en español, es uno de los Incoterms establecidos en la versión más reciente de 2020.",
      "Es un término que indica que el vendedor cumple con su obligación de entregar la mercancía al comprador en su propio establecimiento, fábrica o almacén. En este caso, el vendedor no tiene responsabilidad en el transporte de la mercancía ni en los trámites aduaneros.",
      "<b>Responsabilidades del vendedor en el Incoterm EXW</b>",
      "Las responsabilidades del vendedor en una transacción EXW incluyen:",
      "• <b>Preparar los bienes</b>: El vendedor debe preparar y empaquetar los bienes de acuerdo con las especificaciones del contrato y asegurarse de que estén listos para su recolección en la fecha acordada.",
      "• <b>Notificación al comprador</b>: El vendedor debe notificar al comprador cuando los bienes estén listos para su recolección en el lugar designado.",
      "• <b>Entrega de los bienes</b>: El vendedor debe entregar los bienes al comprador en el lugar acordado, pero no está obligado a cargarlos en el vehículo de transporte.",
      "<b>Responsabilidades del comprador en el Incoterm EXW</b>",
      "Las responsabilidades del comprador en una transacción EXW incluyen:",
      "• <b>Transporte</b>: El comprador debe organizar y pagar el transporte de los bienes desde las instalaciones del vendedor hasta su destino final.",
      "• <b>Carga de los bienes</b>: El comprador es responsable de cargar los bienes en el vehículo de transporte.",
      "• <b>Trámites aduaneros</b>: El comprador debe realizar y pagar los tramites aduaneros de exportación e importación, así como cualquier otro trámite relacionado con la transacción.",
      "• <b>Seguro</b>: El comprador debe contratar y pagar un seguro para los bienes durante el transporte, si así lo desea.",
      "<b>¿Cuándo utilizar el Incoterm EXW?</b>",
      "El Incoterm EXW es recomendable en las siguientes situaciones:",
      "• <b>Cuando el comprador tiene un amplio control sobre el transporte</b>: Si el comprador cuenta con una red de transporte establecida y puede gestionar de manera eficiente el transporte de la mercancía, el Incoterm EXW es una buena opción.",
      "• <b>Cuando la mercancía requiere de trámites aduaneros especiales</b>: En casos donde la mercancía requiera de permisos o licencias especiales para su exportación, el Incoterm EXW permite al comprador gestionar los trámites necesarios.",
      "• <b>Cuando el vendedor no desea involucrarse en el transporte</b>: Si el vendedor prefiere centrarse en la producción y venta de la mercancía y no desea asumir responsabilidades en el transporte, el Incoterm EXW es adecuado.",
      "<b>Surgen entonces varias preguntas sobre EXW:</b>",
      "• ¿Cómo se traduce esto en una operación real?",
      "• ¿Permitiría el vendedor que el transportista del comprador utilice su propia maquinaria y mano de obra para estibar la mercancía?",
      "• ¿Permitiría el vendedor que el transportista realice operaciones y desorden en su almacén?",
      "• ¿Cuál sería el seguro más adecuado en esta situación?",
      "• ¿Cómo sería la seguridad laboral y otras consecuencias de esto?",
      "Ahora bien, si la mercancía debe ser exportada a otro país, los problemas se incrementan. Ya que, como decíamos antes, corresponde al comprador exportar la mercancía.",
      "Sin embargo, en la mayoría de los países solamente las entidades registradas en dicho país pueden exportar mercancías. Y a esto todavía hay que agregar potenciales inconvenientes relacionados con los impuesto sobre el valor añadido (IVA, GST).",
      "Es decir, a menos que el vendedor tenga evidencia de que se trata de una exportación, el país al que se exporta debe aplicar dicho impuesto. De lo contrario esta operación se considerará como una venta local. En consecuencia, usar el Incoterm EXW en esta casuística es casi imposible, tal como se describe en la Guía Oficial de Incoterms 2020.",
      "<b>Ventajas y desventajas</b>",
      "• <b>Para el vendedor</b>: El EXW es beneficioso para el vendedor, ya que implica menos responsabilidades y costos en comparación con otros Incoterms. Además, el vendedor no necesita preocuparse por el transporte o los trámites aduaneros.",
      "• <b>Para el comprador</b>: El comprador tiene un mayor control sobre el transporte y los costos asociados, lo que puede resultar en ahorros si se gestiona de manera eficiente.",
      "• <b>Para el vendedor</b>: El vendedor puede perder oportunidades de negocio si el comprador no está familiarizado con los trámites aduaneros y de transporte, lo que puede resultar en demoras o costos adicionales.",
      "• <b>Para el comprador</b>: El comprador asume una mayor responsabilidady riesgo en la transacción, lo que puede resultar en costos adicionales si no se manejan adecuadamente los trámites aduaneros y de transporte.",
      "<b>Alternativas al Incoterm EXW</b>",
      "Si el Incoterm EXW no se ajusta a las necesidades específicas de una transacción, existen otros Incoterms que pueden ser más apropiados. Algunas alternativas incluyen:",
      "• <b>FCA (Free Carrier)</b>: En este Incoterm, el vendedor entrega los bienes al transportista designado por el comprador en un lugar acordado. El vendedor se encarga de los trámites aduaneros de exportación, pero el comprador asume la responsabilidad a partir de ese momento.",
      "• <b>CPT (Carriage Paid To)</b>: El vendedor se encarga del transporte y los costos hasta un lugar acordado en el país de destino, pero el riesgo se transfiere al comprador una vez que los bienes son entregados al transportista.",
      "• <b>CIP (Carriage and Insurance Paid To)</b>: Similar al CPT, pero el vendedor también proporciona un seguro de transporte para los bienes. Este incoterm",
      "<b>Conclusión</b>",
      "El Incoterm EXW es una opción popular en transacciones comerciales debido a sus ventajas para el vendedor y para compradores experimentados. Sin embargo, también conlleva riesgos y responsabilidades adicionales para el comprador, lo que puede no ser adecuado en todas las situaciones. Al elegir el Incoterm adecuado para una transacción, es importante considerar las necesidades y capacidades específicas de ambas partes, así como las características del producto y la logística involucrada.",
      "Si quieres conocer más sobre este servicio puedes escribirnos a nuestro correo info@doortudoor.com",
    ],
  },
  {
    slug: "muestras-importar-china",
    category: "operacion",
    title: "¿Por qué son importantes las muestras a la hora de importar desde China?",
    excerpt:
      "Generalmente, las muestras de un producto, sirven para que el cliente o el importador tengan una idea de la calidad del rubro o materia prima que desea adquirir desde China, a su vez que así tambié...",
    date: "2023-05-25",
    readTimeMin: 3,
    body: [
      "Generalmente, las muestras de un producto, sirven para que el cliente o el importador tengan una idea de la calidad del rubro o materia prima que desea adquirir desde China, a su vez que así también podrá conocer si el proveedor se encuentra en la capacidad de manufacturar tu mercancía en su totalidad.",
      "Por lo general, las muestras, suelen tener un bajo coste o inclusive suelen ser gratuitas, teniendo solo el comprador que pagar el transporte del mismo.",
      "¿Cómo funciona realmente un pedido de muestras en China?",
      "Primero, el importador, deberá primero buscar y validar un proveedor que se encuentre en China y que tenga experiencia fabricando el rubro o materia prima que desea adquirir desde el territorio chino. Debes tener en cuenta que este proveedor cumpla con todos los requisitos para manufacturar tu mercancía, además que debe tener en regla toda su documentación y estar legalmente establecido en China.",
      "Una vez el importador ya haya encontrado a su proveedor y sepa que es el indicado para fabricar el producto que desea, ya es el momento para solicitar una muestra del producto. La muestra del producto sirve para que el importador pueda examinar la calidad, el diseño y el acabado del rubro que desea adquirir desde China. Es importante recalcar, que las muestras de productos son ejemplares de un lote anterior fabricado por el proveedor, por lo que probablemente ciertas especificaciones técnicas no coincidirían con lo que el comprador desee.",
      "La importancia de una muestra de calidad",
      "Las muestras de calidad tienen dos funciones. La primera y mencionada anteriormente, verificar que el fabricante si posee la capacidad necesaria para manufacturar el producto que desee el importador, siguiendo las especificaciones y solicitudes que se realicen posteriormente. Y segunda descartar proveedores que no tengan la capacidad de manufacturar la mercancía.",
      "A la hora de pedir una muestra de un producto es de suma importancia que el importador o cliente verifique los materiales, el componente y los estándares, para decidir si el fabricante es el indicado para manufacturar la mercancía. Comprobar una muestra de producto supone un ahorro de tiempo y dinero, y así se estará evitando un malentendido o un problema con el proveedor a la hora de entablar una negociación con él.",
      "Además, pedir una muestra servirá para descartar algún tipo de proveedor fraudulento. Ya que, si un proveedor se resiste en enviarte una muestra de su producto, entonces tiene algo que esconder o simplemente se trata de un estafador.",
      "¿Cómo pedir una muestra de producto con un proveedor?",
      "Hay dos formas y la primera es que puedes hacerlo comunicándote con el fabricante y pidiéndole formalmente una muestra de su producto. Y la segunda a través de un agente de compras especializado y con una alta experiencia en China. En nuestra empresa DoorTuDoor, poseemos para todos nuestros clientes el servicio de Manejo de Muestras. Con este servicio podrás ahorrar en costos de envío y pagos a diferentes proveedores si estás comprando a muestras de varias fábricas en China. Puedes enviar muestras a nuestras oficinas y nosotros las enviaremos en un solo paquete para ti luego de haberlas verificado.",
      "Si quieres conocer más sobre este servicio puedes escribirnos a nuestro correo info@doortudoor.com",
    ],
  },
  {
    slug: "incoterm-cif-explicado",
    category: "tutorial",
    title: "Significado del incoterm CIF.",
    excerpt:
      "CIF (Cost Insurance And Freight/Coste, Seguro y Flete) y dos Incoterms multimodales (transporte marítimo, aéreo o terrestre). En el CIF Incoterms establece que la empresa vendedora contrata el tran...",
    date: "2023-05-19",
    readTimeMin: 2,
    body: [
      "CIF (Cost Insurance And Freight/Coste, Seguro y Flete) y dos Incoterms multimodales (transporte marítimo, aéreo o terrestre).",
      "En el<b> CIF</b> <b>Incoterms </b>establece que la empresa vendedora contrata el transporte marítimo y asume todos los costes y el flete que son intrínsecos al transporte de la mercancía hasta el puerto de destino convenido, sin descargar la mercancía del buque. Sin embargo, la entrega y transmisión de los riesgos se produce una vez la mercancía ha sido estibada a bordo del buque, y despachada de exportación.",
      "El vendedor también está obligado a contratar un seguro que cubra los riesgos del transporte que asume el comprador, es decir, una vez que la mercancía se ha embarcado a bordo del buque en el puerto de embarque designado. Los riesgos del transporte previos al embarque son soportados por la empresa vendedora.",
      "<b>¿Qué obligaciones tiene el vendedor?</b>",
      "El CIF Incoterms establece que el vendedor deberá:",
      "• Preparar la mercancía según se haya fijado en el contrato de compraventa, embalarla adecuadamente y marcar el embalaje.",
      "• Contratar y asumir el transporte de la mercancía hasta el puerto de destino que se haya acordado. No se incluye el coste de descarga, a menos que se haya acordado entre las partes.",
      "• Contratar un seguro de transporte que cubra los riesgos que soporta el comprador en el transporte de la mercancía desde el momento de la entrega en origen.",
      "• Aportar la documentación necesaria: factura y lista de bultos. También deberá ayudar al comprador en caso que éste solicite algún otro documento que sea requerido para poder despachar la mercancía en la aduana de importación.",
      "• Proporcionar al comprador el documento de transporte marítimo (Bill of Lading, B/L), dado que es el documento que va a permitir a la empresa compradora reclamar la mercancía a la naviera o transportista en el puerto de destino.",
      "• Notificar al comprador que la mercancía ha sido entregada para su transporte e informarle de cuándo está prevista su llegada al puerto de destino.",
      "• Si procede, realizar el despacho de exportación y obtener los documentos necesarios.",
      "<b>¿Qué obligaciones tiene el comprador?</b>",
      "El Incoterm CIF establece que el comprador deberá:",
      "• Abonar el precio de la mercancía acordado en el contrato de compraventa.",
      "• Recibir la mercancía que le entregue la naviera en el puerto de destino convenido.",
      "• Realizar el Despacho de importación, si procede, realizando las gestiones, la tramitación documental y el pago de los impuestos que se exijan.",
      "• Encargarse y asumir los costes en destino, como por ejemplo el coste de la descarga en el puerto, a menos que no se haya pactado lo contrario, y del transporte hasta sus instalaciones.",
    ],
  },
  {
    slug: "incoterm-fob-explicado",
    category: "tutorial",
    title: "Significado del incoterm FOB.",
    excerpt:
      "Resumiendo Podemos asegurar que esta terminología, FOB, será la más escuchada cuando te adentres de lleno en el mundo de las importaciones. El motivo de su popularidad es la de los importantes bene...",
    date: "2023-05-08",
    readTimeMin: 5,
    body: [
      "<b>Resumiendo</b>",
      "Podemos asegurar que esta terminología, FOB, será la más escuchada cuando te adentres de lleno en el mundo de las importaciones. <b>El motivo de su popularidad es la de los importantes beneficios que le aporta a cada uno de los protagonistas que están involucrados: Proveedores y clientes.</b>",
      "No obstante, es importante subrayar que durante todo el artículo nos hemos centrado en este incoterm que es el utilizado por excelencia. Sin embargo, <b>existen otros incoterms que podrían adaptarse a tu modelo de negocio sin lugar a dudas.</b>",
      "<b>¿Cuál es el significado del FOB?</b>",
      "Cada vez son más los emprendedores independientes que se largan a la aventura de la importación y China, es el país por excelencia en la búsqueda de proveedores. Sin embargo, existen algunas cuestiones básicas que podrías no conocer y que son de una grandísima relevancia, como lo es el significado FOB.",
      "Antes de comenzar en profundidad con el uso y las ventajas del FOB, primero arranquemos desde lo más básico: <b>¿Qué significa FOB?</b>",
      "<b>FOB es el acrónimo de Free On Board. Esto, básicamente lo que hace es brindarle toda la información del proceso de exportación</b>; en donde los costos y las responsabilidades se transfieren del proveedor al cliente.",
      "<b>¿Qué es el incoterm FOB?</b>",
      "El FOB, es el incoterm que se utiliza en todo el mundo para las actividades de importaciones. Como hemos mencionado <b>su sigla hace referencia al español de Flete A Bordo</b> y es un término que dictamina el departamento de comercio Internacional, en dónde <b>establece las responsabilidades entre el vendedor y el comprador</b>. Esta división de responsabilidades, quedarán sujetas a cada una de las partes según la ubicación durante el proceso de entrega.",
      "Básicamente, el FOB, establece que el vendedor tendrá la responsabilidad sobre la mercadería hasta el punto de embarque y, a partir de allí, esa responsabilidad estará a cargo del comprador.",
      "<b>¿Cuál es el funcionamiento del FOB?</b>",
      "El incoterm que se vaya a utilizar se establece entre las partes antes de coordinar el envío. <b>Con el FOB, seguramente, las partes habrán acordado que la responsabilidad del proveedor llega hasta el puerto de su país</b>. Desde allí, la responsabilidad cambia al comprador hasta llegar a destino.",
      "Por ejemplo, si el comprador es de Argentina y el proveedor es de China y se acuerdan los términos de FOB, hasta el puerto de Shanghái, el proveedor deberá hacerse responsable de los siguientes riesgos y costos:",
      "• Flete desde el depósito de producción",
      "• Gastos de envío al puerto",
      "• Cargas de productos en el puerto",
      "• Despacho de aduanas en Shanghái",
      "• Cargos del tránsito",
      "Durante todo este proceso, los riesgos están a cargo del proveedor y durante este período si la mercadería se pierde o daña es el vendedor quien asume los costos.",
      "Tras este punto, todos los riesgos y costos subyacentes pasan a estar a cargo del comprador quién recibirá su embarcación, según el ejemplo, en la Argentina.",
      "Cuando el comprador reciba en el puerto de Buenos Aires, los cargos que deberá afrontar en relación al incoterm que han pactado serán los siguientes:",
      "• Los gastos de flete marítimo",
      "• Cargas y descargas al puerto de Buenos Aires",
      "• Despacho de aduanas",
      "• Fletes y entrega en el depósito",
      "<b>¿Cuáles son las ventajas y desventajas de utilizar el FOB?</b>",
      "Existen muchas variantes de costos y riesgos que se establecen por contrato. <b>El FOB, es uno de los incoterms más utilizados, esto se debe a que divide en partes iguales las responsabilidades.</b>",
      "Sin embargo, este término se ve atravesado tanto por beneficios como por desventajas que iremos desgranando a continuación:",
      "<b>Ventajas del FOB:</b>",
      "• El proveedor tiene un mayor control de la mercadería y del transportista. Esto es un beneficio para ambas partes ya que el proveedor sabrá contactar al sistema de transporte más conveniente de su país y que mejor se adapte para el traslado de la mercadería al puerto.",
      "• La declaración de aduanas en el país de origen esta a cargo del proveedor, esto le quita una gran responsabilidad y preocupación al cliente. Además, los documentos de despacho son remitidos al comprador para que esto termine facilitando un poco más todo el proceso.",
      "• Este método, ha de ser el más rentable, debido a que cada una de las partes se hace cargo de todos los costos correspondientes a su país. Gracias a esto, cada una de las empresas podrán evaluar los costos y beneficios, por ejemplo, del flete que utilizarán.",
      "<b>Desventajas del FOB:</b>",
      "Sin dudas la metodología FOB es la más conveniente cuando se trata de importaciones. Sin embargo, como todo, podría ser perfectible, pero como sabemos nada es 100% infalible, analicemos algunas de las desventajas que tiene este incoterm.",
      "• Por supuesto, esta metodología le infiere una mayor responsabilidad como comprador. Esto significa que, una vez la mercadería haya llegado al puerto del país de destino, usted será el responsable de todos los gastos a pagar por derecho de importación, impuestos aduaneros y, por caso, los daños de la mercadería.",
      "• Entre estas responsabilidades en las que se ven inmiscuidos los compradores, también recaerá en el traslado de la mercadería al depósito. <b>Si durante el tránsito del puerto hasta el depósito receptor, ésta sufriera algún daño o accidentes, todo este contratiempo estará asignado a su integra responsabilidad.</b>",
      "• En la aduana del país del comprador, deberá presentar toda la documentación necesaria para poder despachar la mercadería. Esto, en el caso que no cuente con una persona que actúe en su nombre es un procedimiento engorroso. Entre la documentación que deberá presentar se encuentran: Factura invoice, lista de bienes de uso y otros documentos y certificaciones impositivas que podrían, de no estar acostumbrado, hacerlo “perder” una gran cantidad de tiempo.",
    ],
  },
  {
    slug: "4-claves-importar-china-cuenta-propia",
    category: "tutorial",
    title: "4 Claves para importar de China por tu propia cuenta.",
    excerpt:
      "2023 es el año perfecto para empezar a importar de China. Sé que al principio la idea de fabricar y comprar productos de empresas chinas y venderlos en una tienda online o en tu propio negocio pued...",
    date: "2023-04-19",
    readTimeMin: 5,
    body: [
      "<b>2023 es el año perfecto para empezar a importar de China. Sé que al principio la idea de fabricar y comprar productos de empresas chinas y venderlos en una tienda online o en tu propio negocio puede sonar bastante arriesgado. Pero al contrario de lo que piensan muchos, importar de China es cada vez más sencillo y fácil.</b>",
      "<b>¿Por qué deberías empezar a importar de China?</b>",
      "El mundo ha cambiado en el último año a raíz del Coronavirus. La pandemia no sólo ha afectado a las personas en cuanto a salud se refiere, sino que también ha hecho que nuestros hábitos y comportamientos hayan sufrido una serie de cambios.",
      "Una de las mayores alteraciones a raíz del Covid fue la reducción del espacio físico y social. Nos vimos obligados a quedarnos en casa y la mayoría de negocios tuvieron que cerrar sus puertas, algunos desgraciadamente para siempre.",
      "Sin embargo, de todos los problemas y crisis puede sacarse algo bueno. Todas las restricciones y problemas han hecho acelerar un cambio social y económico inminente: la digitalización.",
      "Muchas empresas españolas no le daban demasiado importancia a la revolución digital que se estaba extendiendo en todos los sectores. En cambio, otras sí que se habían subido al tren de la innovación antes de que la pandemia sacudiese la economía global.",
      "Como resultado de las restricciones, las empresas que contaban con ventas o tienda online pudieron afrontar la crisis mucho mejor que las que sólo vendían sus productos en una tienda física.",
      "Hoy vamos a ver algunas de las claves que deberías tener en cuenta o conocer si estás decidido para empezar a<b> importar de China </b>o si apenas te estás planteando montar un negocio de importación.",
      "<b>1. ¿Tienes ganas de emprender y de empezar a importar de China?</b>",
      "Las ganas lo son todo en el mundo de los negocios. Toda empresa empieza con una idea, con un objetivo y una meta a conseguir. Para lograr estos objetivos necesitamos ganas y voluntad.",
      "Muchas de las personas que he asesorado en temas de importación se plantearon embarcarse en este tipo de negocio por diferentes razones.",
      "Algunos querían montar su propia empresa, pues estaban cansados de trabajar para otras personas. Otros buscaban una fuente de ingresos extra que le permitiese ahorra o cumplir algunos objetivos financieros.",
      "Y por último, habían empresarios que ya tenían sus empresas consolidadas en su sector y buscaban reducir sus costes de producción y vieron en el negocio de la importación de China un mercado seguro y prometedor.",
      "Da igual cual sea tu motivación. Sí tienes ganas de empezar tu propia empresa de importación, continúa leyendo. La curiosidad y las ganas es lo primero que necesitas para empezar a <b>importar de China</b>.",
      "<b>2. ¿Tienes un nicho o un producto en mente?</b>",
      "Muchos de los que leen este blog han empezado a investigar sobre la importación de China pues ya tienen en mente un producto para fabricar en China y vender online.",
      "También puede que no tengas la idea afinada, simplemente un boceto de un producto o algún artículo que hayas visto en el mercado y que pienses que puedes mejorar con algunas personalizaciones.",
      "Como siempre he dicho desde que empecé éste blog, la base de cualquier negocio de <b>importación de Chin</b>a es tener claro cuál es el nicho de mercado que queremos abarcar. Nada de improvisar.",
      "¿Y cómo encontramos el nicho perfecto? En Importar de China te ofrezco toda mi experiencia de estos años en un curso específicamente creado para ayudarte y orientarte en esta fase de la importación.",
      "<b>3. ¿Sabes cómo encontrar proveedores para importar de China?</b>",
      "Cuando ya tienes un nicho de mercado rentable y un producto escogido, llega el paso de buscar proveedores capaces de fabricar en China nuestro producto.",
      "A estas alturas, creo que la mayoría de los lectores conocerá la página web Alibaba. Gracias a este marketplace, <b>importar de China</b> es más sencillo que nunca.",
      "Nunca se me hubiese ocurrido hace veinte o treinta años que localizar proveedores de confianza sería tan fácil y estaría al alcance de un solo clic.",
      "Pero si no te sientes preparado para lanzarte por tu cuenta a la búsqueda de proveedores o tienes miedo que te estafen en Alibaba, no te preocupes. Actualmente también cuento con el curso centrado exclusivamente en la búsqueda y selección de proveedores en Alibaba. Juntos conseguiremos que cierres contratos de producción en China sin correr ningún riesgo.",
      "<b>4. ¿Conoces el proceso de importación?</b>",
      "Muchos de los email y consultas que recibo a diario están relacionados con temas del proceso de importación, con el papeleo y toda la burocracia que<b> importar de China </b>conlleva.",
      "Puede que esta sea la parte más complicada de empezar un negocio de importación. Empiezas a hablar con un proveedor y no sabes que tipo de envío elegir: aéreo, por marítimo, urgente, grupaje, consolidado.",
      "Luego recibes ofertas de precios en condiciones CIF, FOB, EXW y todo te suena a chino (nunca mejor dicho). También tienes dudas de como pagar los aranceles e impuestos de tu mercancía.",
      "Vamos, muchos dolores de cabeza y líos para cargártelos a la espalda tu solo. En esto también te puedo ayudar. En Importar de China tenemos un curso que te ayudará a calcular el coste real del producto, a seleccionar la mejor opción de transporte y todos los gastos relacionados con las tasas e impuestos en la aduana. ¿Por qué vas arriesgarte tu solo cuando puedes contar con una ayuda garantizada de Doortudoor?",
    ],
  },
  {
    slug: "proveedor-correcto-alibaba",
    category: "operacion",
    title: "4 características del proveedor correcto en Alibaba",
    excerpt:
      "Encontrar el perfecto proveedor en Alibaba puede ser una tarea agotadora y difícil. Y es que cuando estamos empezando un negocio de importación de China, dar con un buen proveedor es la piedra angu...",
    date: "2023-04-19",
    readTimeMin: 5,
    body: [
      "Encontrar el <b>perfecto proveedor en Alibaba</b> puede ser una tarea agotadora y difícil. Y es que cuando estamos empezando un <b>negocio de importación de China</b>, dar con un buen proveedor es la piedra angular de todo el proceso de importación.",
      "En Alibaba hay cientos de miles de proveedores. Por lo que muchos se preguntarán: ¿Cómo sabremos diferenciar los buenos de los malos? ¿Y las empresas de verdad de las que buscan o quieren timarnos?",
      "Es verdad que el marketplace chino cuenta cada vez más con herramientas para dar garantías a sus compradores y vendedores, como Trade Assurance o Verified Supplier. Pero sí. Todavía siguen habiendo timos en Alibaba.",
      "Hay ciertas características que comparten los proveedores fiables y profesionales en Alibaba. Hoy hablaremos de cómo identificarlos y descartar a las malas opciones.",
      "<b>1. ¿Cuántos años lleva vendiendo el proveedor en Alibaba?</b>",
      "Probablemente esta es una de las señales principales para saber si un proveedor es de confianza. Al igual que en Amazon, en Alibaba hay cientos (o miles) de proveedores que vienen y van de la plataforma.",
      "¿Cuánta experiencia debería tener el <b>perfecto proveedor en Alibaba</b>? Por lo menos, nuestro proveedor chino tendría que tener más de tres años vendiendo en Alibaba.",
      "Por ejemplo, si encontramos un proveedor que tiene muy buena pinta. En su página web y en su perfil comprobamos que su fabrica lleva trabajando más de diez años en China. Sin embargo, vemos que sólo lleva un año vendiendo en Alibaba.",
      "¿Hay algún problema? Claro que sí. Casi seguro que la empresa de nuestro proveedor quería o se había dado de alta como vendedor en Alibaba, pero no llegaba a los requisitos mínimos que exige la plataforma china. A lo mejor el proveedor sea muy bueno vendiendo en el mercado chino. Pero deja cierta duda frente a la exportación y clientes en el extranjero.",
      "<b>2. ¿Es un proveedor especializado?</b>",
      "Esta es una cuestión que muchos importadores deberían de tener más en cuenta. Cuando estamos buscando nuestro <b>perfecto proveedor</b> <b>en Alibaba</b>, es mejor si nos centramos en encontrar fábricas especializadas en el producto que queremos.",
      "Deberíamos descartar proveedores cuyas líneas de producción parezcan la estantería de un bazar. Entre más especializada esté la fábrica en un tipo de producto, más calidad tendrá su trabajo. Esto se debe a que los operarios y las máquinas fabrican el mismo tipo de artículo día tras día, lo que los convierte en unos especialistas.",
      "Si vemos que nuestro proveedor fabrica un poco de todo, posiblemente con cada producción nueva tiene que ir preparando a la cadena de montaje y alternado proceso de producción de la maquinaria. Esto puede aumentar el porcentaje de errores de fabrica y defectos de producción.Además de calidad del producto, los proveedores especializados en cierto producto, suelen ser más capaces de personalizar sus producciones, ya que su fabrica está concentrada en este tipo de artículos y de las diferentes variaciones que un cliente puede pedirle. Eso sería otra ventaja para nosotros.",
      "<b>3. ¿Es un proveedor con buena comunicación?</b>",
      "Uno de los primeros requisitos del <b>perfecto proveedor en Alibaba</b> es que hable inglés. Ya que muchos de los emprendedores que quieren empezar una empresa de importación no hablan chino, dominar el inglés es nuestra mejor opción.",
      "Sin embargo, no sólo basta que el representante de ventas tenga un buen dominio del idioma. Muchas veces, las empresas que fabrican en China y venden en Amazon pierden dinero o clientes porque el departamento de ventas del proveedor no es nada profesional.",
      "Necesitamos encontrar con un proveedor cuyo agente o departamento de ventas sea comunicativo y proactivo. Esto lo podemos denotar con los primeros emails o preguntas que enviamos para hacer preguntas sobre la producción o el presupuesto.",
      "Si la comunicación es muy llana y ligera desde el principio, no esperemos que con el paso del tiempo se mejore. Si el agente o representante de nuestro proveedor pasa de contestar a nuestro emails desde el principio, lo hará hasta el final.",
      "<b>4. </b><b>¿Que tamaño tiene la empresa del proveedoor</b><b>?</b>",
      "Que un proveedor lleve más de tres años vendiendo en Alibaba es muy buena señal, no obstante, no significa que un proveedor sea estable.",
      "Por ejemplo, a raíz de la crisis del COVID, muchas empresas chinas tuvieron que cerrar sus puertas durante las restricciones del gobierno chino y no han podido recuperar totalmente su nivel de operaciones y de negocio anterior a la pandemia.",
      "Cuando estemos buscando el <b>perfecto proveedor en Alibaba</b>, la mejor forma de saber si nos encontramos con un proveedor consolidado en el mercado y estable, es fijándonos en el tamaño de la empresa y de la fabrica.",
      "¿Cuál es la mejor forma de saber el tamaño de una empresa? El número de sus empleados. Una empresa con bastantes trabajadores suele tener un nivel de negocio estable y regular. Tampoco te estoy diciendo que busques grandes fabricas en <b>Alibaba </b>con más de mil empleados, ya que estás no suelen estar interesadas en hacer negocios con pequeñas empresas o emprendedores.",
      "Lo mejor es buscar un proveedor en Alibaba cuya empresa tenga un tamaño medio. Estoy hablando de entre 50 a 100 trabajadores. En el caso concreto del COVID, una fabrica que mantiene una plantilla de este tamaño, es una fabrica que ha podido hacer frente a una gran crisis, por lo que es estable y está consolidada en el mercado.",
      "Ya hemos visto algunas características del <b>perfecto proveedor en Alibaba</b>. Estos son algunos detalles que he ido aprendiendo con todos los años que llevo <b>importando de China a través de Alibaba</b>.",
    ],
  },
  {
    slug: "productos-rentables-importar-china",
    category: "industria",
    title: "19 mejores productos mas rentables para importar desde China.",
    excerpt:
      "Hay tantos tipos de productos baratos de China, y debe estar muy confundido sobre cómo seleccionar para su negocio. No se preocupe; Enumeraré 25 ideas de productos para ayudarle a elegir productos ...",
    date: "2023-04-11",
    readTimeMin: 11,
    body: [
      "Hay tantos tipos de productos baratos de China, y debe estar muy confundido sobre cómo seleccionar para su negocio. No se preocupe; Enumeraré 25 ideas de productos para ayudarle a elegir productos baratos para importar de China.",
      "<b>1. Bolígrafos.</b>",
      "Los bolígrafos son uno de los productos baratos para importar desde China con gran demanda. Puede encontrar la mayoría de los tipos de bolígrafos y los mejores fabricantes y proveedores de bolígrafos en los mercados de China.",
      "Es una buena oportunidad para su empresa importar bolígrafos de China, y los precios unitarios de los bolígrafos son de $0,09 a $0,9 según los diferentes tipos de bolígrafos. También puede personalizar sus bolígrafos con los fabricantes de bolígrafos.",
      "<b>2. Juguetes: el producto más rentable para importar de China.</b>",
      "Si desea comenzar su negocio con juguetes, puedo decir que tiene la opción correcta. Los juguetes son uno de los productos más rentables y baratos para importar de China. Este tipo de producto cubre varios tipos y categorías, como juguetes de madera o juguetes educativos.",
      "Puede encontrar juguetes en Amazon y la mayoría de los precios de venta son caros: los tipos básicos van desde $60 hasta cientos de dólares. Mientras tanto, si busca juguetes en el sitio web mayorista de China, los precios al por mayor son mucho más bajos, los precios unitarios de los tipos básicos solo van de $2,5 a $26.",
      "Si importa juguetes, también puede personalizar u otros servicios de productos en sus productos de juguetes para que sean diferentes de los demás.",
      "<b>3. Gafas de sol: los mejores productos de marca privada para importar de China.</b>",
      "Las gafas de sol son cada vez más populares en la vida diaria de los clientes. Las gafas de sol en las boutiques son caras, pero en realidad son productos baratos para importar de China.",
      "En Amazon, los precios de venta de la mayoría de las gafas de sol oscilan entre $16 y $89; Los precios al por mayor en Alibaba oscilan entre $0,9 y $10,9.",
      "Además, las gafas de sol son uno de los mejores productos de marca privada para importar de China. Si importa gafas de sol, puede realizar una serie de servicios de productos de fabricantes y proveedores.",
      "<b>4. Camisetas.</b>",
      "La ropa es un buen producto barato de China para vender para su negocio. Las camisetas son uno de los productos más rentables para importar de China. Es un tipo básico de ropa y tiene una gran demanda en todos los países. Los precios de coste de las camisetas en China oscilan entre 2 y 8 dólares.",
      "Para que sus productos ocupen más mercados, es mejor personalizar o hacer logotipos únicos en sus productos, y las tarifas de personalización en China también son mucho más bajas. Debe importar camisetas de buena calidad para que su negocio sea más popular.",
      "<b>5. <b>Calcetines.</b>",
      "Los calcetines tienen una gran demanda de productos al por mayor baratos de China. Elegir calcetines para iniciar su negocio es una buena opción porque los clientes comprarían calcetines en muchos pares y este producto tiene un gran mercado.",
      "Como uno de los productos baratos de China, los precios unitarios de los calcetines oscilan entre $0,8 y $3, pero los calcetines al por mayor siempre tienen una calidad mínima de pedido y debe consultar a los proveedores de calcetines. También puede venir a los mercados de calcetines para encontrar más estilos diferentes, como Yiwu Market.",
      "<b> 6. </b><b>Luces LED: el mejor producto OEM para importar de China.</b>",
      "Cree que algunos productos son caros, pero en realidad son baratos, como las luces LED. Los precios de costo oscilan entre $0,3 y $3,08, según diferentes formas y estilos.",
      "Como uno de los productos chinos baratos, los estándares de producción de las luces LED también requieren un alto nivel. Debe dar importancia a las certificaciones de seguridad cuando importe luces LED de China.",
      "<b> 7. Cajass de regalo.</b>",
      "Las cajas de embalaje siempre se ignoran, pero tienen mercados potenciales. Cuando prepara regalos para otros, una hermosa caja de regalo hace que su regalo sea mejor. Las cajas de regalo en los sitios web minoristas siempre son caras, pero en realidad, son productos baratos de China para vender, los precios combinados oscilan entre $0,05 y $2,15.",
      "Las cajas de regalo pueden variar en materiales, tamaños y estilos, por lo que son muy adecuadas para personalizarlas según su demanda y necesidad.",
      "<b> 8. Decoraciones navideñas.</b>",
      "Alrededor del 85% de las decoraciones navideñas se importan de los mercados de China porque son productos baratos de China con una gran producción y múltiples tipos y estilos. Puede encontrar todas las decoraciones navideñas aquí, sobre Navidad, Halloween, etc.",
      "Estas decoraciones navideñas son caras en Amazon, pero en China, los precios al por mayor de las piezas pequeñas oscilan entre $0,42 y $4,15.",
      "<b>9. Suministros para fiestas.</b>",
      "Los artículos para fiestas tienen una gran demanda en los mercados de decoración porque a la gente le gusta celebrar fiestas sobre diversos temas, incluidos cumpleaños, Nochevieja, bodas o despedidas de soltero.",
      "Los precios al por mayor de estos productos baratos de China oscilan entre $0,5 y $5,89, mientras que los precios en Amazon oscilan entre $8,99 y $35.",
      "<b>10. Flores artificiales.</b>",
      "Las flores artificiales son cada vez más populares que las flores reales tradicionales porque son económicas, duraderas, similares a las reales y fáciles de limpiar. A diferencia de los precios de las flores reales, las flores artificiales son productos baratos de China. Los precios al por mayor oscilan entre $0,27 y $4, mientras que los precios en Amazon oscilan entre $15 y $35.",
      "<b> 11. </b><b>Productos para bebés (</b><b>Pañales de bebé).</b>",
      "Los pañales para bebés tienen una enorme demanda en el mercado y muchos dueños de negocios planean importar de China para obtener precios más baratos. El precio de los pañales para bebés es de solo $0,04 por pieza, mientras que el MOQ de este producto chino barato es mucho más que otros productos.",
      "Si desea importar pañales para bebés de China, debe considerar su capacidad de venta, incluso el precio al por mayor es bajo.",
      "<b>12. Baberos de bebé.</b>",
      "Los baberos son muy adecuados para importar como productos chinos baratos para vender. El precio de los baberos para bebés es de aproximadamente $0,29 por unidad, pero se requiere el MOQ y debe consultar los suministros en los números de pedido de acuerdo con su venta y demanda reales. Este producto es ligero y de pequeño tamaño, por lo que los gastos de envío no son elevados.",
      "<b>13. Ropa para mascotas.</b>",
      "A más y más personas les gusta gastar dinero en sus mascotas, por lo que los suministros para mascotas tienen un mercado más grande. La ropa para mascotas es uno de los productos baratos para importar de China. El precio de este producto es de aproximadamente $0,9 por unidad. También puede personalizar estos productos baratos de China.",
      "<b> 14. </b><b>Accesorios y herramientas de maquillaje: los mejores productos OEM para importar de China</b>",
      "<b>Espejos</b>",
      "Los espejos son una herramienta de maquillaje necesaria. Los precios de venta en Amazon oscilan entre $15 y $38, mientras que puede vender al por mayor este producto barato desde China, con precios de $2,32 por pieza.",
      "Puede personalizar los espejos de maquillaje con funciones diseñadas o logotipos únicos, y los costos de personalización también son económicos.",
      "<b>Pestañas postizas</b>",
      "Las pestañas postizas son productos particularmente baratos para importar de China. El precio unitario de venta al por mayor está entre $0,19 y $0,44 por par o desde $0,95 hasta $1,89 por paquete. Puede encontrar varios grados de pestañas postizas en diferentes materiales.",
      "La mayor ventaja de importar pestañas postizas es que el peso y el tamaño son extremadamente ligeros y pequeños, por lo que los gastos de envío le costarán poco y podrá obtener grandes ganancias con este producto barato de China.",
      "<b>15. Accesorios de moda</b>",
      "<b>Cintas para el pelo</b>",
      "Las cintas para el cabello son muy populares en las áreas de la moda con un amplio uso en la vida diaria. El precio de venta del estilo diseñado en Amazon es alto, mientras que el precio al por mayor es de $0,22 a $3,8 por pieza.",
      "Puede elegir este producto barato para importar desde China para comenzar su negocio y concentrarse en el MOQ requerido de los proveedores.",
      "<b>Bolsos: los mejores productos ODM para importar de China</b>",
      "Como mencioné anteriormente, los precios unitarios de los bolsos no son tan bajos como otros productos. Pero en comparación con muchos otros mercados, los bolsos son productos baratos de China, con precios que oscilan entre $5 y $18, e incluyen muchos estilos diferentes. Puede obtener buenas ganancias de este tipo de producto.",
      "Puede impotar bolsos con servicios de personalización únicos para formar su ventaja competitiva.",
      "<b> 16. </b><b>Teléfono y accesorios electrónicos. </b>",
      "<b>Protector de teléfono de vidrio.</b>",
      "Los dispositivos de bajo costo son adecuados para ser elegidos como productos baratos de China para vender, al igual que el vidrio protector del teléfono. Los clientes no pueden cambiar su teléfono con frecuencia, pero cambiarían el vidrio protector mucho más fácilmente si hay alguna rotura.",
      "El precio al por mayor es de aproximadamente $0,19 a $0,88 por pieza. Diferentes MOQ ofrecen diferentes precios, y puede contactar a los fabricantes para obtener el precio más favorable.",
      "<b>Soporte de teléfono y cargador.</b>",
      "Los soportes para teléfono son productos muy prácticos preferidos por muchos conductores. Son productos baratos de China para vender. El precio de mayoreo de este producto es entre $0,6 y $2. Para mejorar su competitividad, puede seleccionar este producto con funciones adicionales, como la carga inalámbrica.",
      "<b>Auricular.</b>",
      "Los auriculares son un accesorio electrónico de moda que le ayuda a evitar la vergüenza en público. Los precios de venta son caros en Amazon desde $45 hasta cientos de dólares, mientras que son productos baratos para importar desde China desde $4,15 hasta $10.",
      "Si importa este tipo de producto, debe prestar atención a sus certificaciones de producción porque su estándar de producción es diferente de otros productos diarios.",
      "<b>17. <b>Utensilios de cocina: productos más rentables para importar de China.</b>",
      "<b>Rallador y cortador de ajos</b>",
      "Los utensilios de cocina son productos muy baratos de China, que abarcan muchos tipos y materiales diferentes. Por ejemplo, puede elegir ralladores de ajo para vender en su negocio. Este producto puede cortar muchas cosas en partes pequeñas, incluidos el ajo y el jengibre.",
      "El precio en Alibaba es de unos $2,5 y en Amazon de hasta $20. Por lo tanto, puede obtener muchas ganancias al importar este producto barato de China para venderlo.",
      "<b>Guantes de goma o guantes de silicona</b>",
      "Los guantes de goma y silicona son productos chinos muy baratos para importar. Usted elige este producto para su negocio porque tiene una gran demanda en el mercado con un amplio uso en la vida diaria. El precio al por mayor de los guantes de goma es de $0,19 a $0,45 por par.",
      "Obviamente, no puede simplemente comprar algunos pares a este precio, se requiere el MOQ. Puede ponerse en contacto con los proveedores para alcanzar un precio y una cantidad de pedido adecuados para su negocio.",
      "<b>18. Vidrio</b>",
      "Los vasos y botellas de vidrio son productos muy rentables. Se venden en Amazon al precio de $32,99 mientras que son productos baratos para importar desde China a precios desde $0,28 a $2,07. Puede personalizar vasos y botellas de vidrio en diferentes estilos y tamaños para mejorar la competitividad de su producto.",
      "Vale la pena señalar que los costos de envío de estos productos son bastante altos porque son frágiles y necesitan paquetes gruesos para protegerlos. Si es propietario de una pequeña empresa, le aconsejo que no importe este tipo de productos.",
      "<b>19. Marco de lentes.</b>",
      "Los anteojos son productos muy rentables y baratos de China, incluidos anteojos y marcos de anteojos. Los anteojos son variados en diferentes grados y materiales, también requieren una serie de certificaciones, por lo que es mejor importar marcos de anteojos de China para su negocio.",
      "El precio mayorista de las monturas de las gafas es de $1,07 a $8. Si importa este producto barato de China para venderlo, puede solicitar servicios de productos de OEM y ODM a los fabricantes.",
      "<b>Sitios web mayoristas en línea</b>",
      "Cuando tenga experiencia en la selección de productos y la realización de pedidos, puede comprar productos baratos en los sitios web mayoristas de China directamente. Aquí hay algunas plataformas confiables para comprar productos baratos de China:",
      "Estos sitios web B2B en línea pueden ayudarle a encontrar varios productos baratos de China, así como fabricantes y suministros de productos, incluso si está lejos de China.",
      "<b>Preguntas frecuentes sobre productos baratos de China</b>",
      "<b>¿Los productos baratos de China significan mala calidad?</b>",
      "No todos los productos baratos de China significan mala o baja calidad. Un caso ideal es que, dentro del mismo rango de precios de productos baratos, los fabricantes y proveedores puedan ofrecer productos de mejor calidad que otros productos al mismo precio.",
      "<b>¿Cuál es la forma más barata de comprar productos baratos de China?</b>",
      "Para comprar productos baratos de China, debe considerar muchos factores de productos baratos. De acuerdo con su negocio y demanda, necesita comparar todos los aspectos para maximizar sus ganancias y reducir costos y riesgos. Con base en el conocimiento de cosas baratas para importar de China, incluidos los pros y los contras, los beneficios y los riesgos, es posible que pueda ganar mucho dinero.",
    ],
  },
  {
    slug: "ciudades-manufactureras-china",
    category: "industria",
    title: "17 ciudades manufactureras en China que debes conocer al momento de importar 2023",
    excerpt:
      "Debido la incrementación del desarrollo económico dentro y fuera de China, por medio de las importaciones y exportaciones, siempre se perciben lugares o ubicaciones con mayor potencial para este fi...",
    date: "2023-04-03",
    readTimeMin: 10,
    body: [
      "Debido la incrementación del desarrollo económico dentro y fuera de China, por medio de las importaciones y exportaciones, siempre se perciben lugares o ubicaciones con mayor potencial para este fin. Gracias a un análisis exhaustivo, se pudo determinar que su mayor fuerte es sobre algún ámbito en específico.",
      "Por esta razón, solamente basta emprender un viaje a través de la lectura de información útil, capaz de llevar hasta a ti lo mejor de cada ciudad. Esto te servirá como una excelente referencia para saber dónde es más conveniente emprender un negocio.",
      "<b>1- Guangzhou-Apparel</b>",
      "<b></b>Como una breve reseña geográfica, esta ciudad representa la capital de Guangdong, a su vez este territorio funge como el epicentro de diversas industrias, pero en el sector en el cual se destacan con mayor notoriedad es el de la confección, que termina originando el despacho de un sinfín de ropa de la categoría de moda rápida.",
      "Por esta razón, esta ciudad<b> </b>de China termina siendo un atractivo para la venta y distribución al mayor de ropa, por su fuerte de siempre proveer nuevos modelos en constante vanguardia y movimiento de la moda.Estas fábricas se encuentran ubicadas en el Distrito de Shahe, Distrito de Shisanhang y el Distrito Oeste.",
      "Esto se debe principalmente a que cerca deGuangzhou se encuentra un fácil acceso a una gran variedad de telas. También se puede ir en búsqueda de cualquier tipo de tela con la finalidad de crear ropa de calidad.",
      "<b></b>La ciudad<b> </b>de Zengcheng se bautiza primordialmente como un nicho de jeans o vaqueros, ya que dentro de esta provincia hacen vida más de cinco mil fábricas dedicadas complemente a este fin de atuendos vaqueros. Esto en cifras de negocios se traduce a 2,5 millones de conjuntos, en un solo día y esto equivale al 60% de producción.",
      "A su vez se encuentra el XinTag, que comprende un mercado en grandes dimensiones, destinado al mayoreo de este rubro, en el cual se exportan productos hacia la Unión Europea, Estados Unidos, Rusia, entre otra gran cantidad de países. El único aspecto a tomar en cuenta sobre esta ciudad es básicamente la seguridad al andar en ella.",
      "Se caracteriza esencialmente por reunir la mayor cantidad de productos electrónicos a nivel mundial, por lo que la tecnología impera sobre esta <b>ciudad</b>, y las cifras hablan por sí solas, ya que alberga más de diez mil empresas dedicadas a este campo ampliamente, según la última actualización realizada en el año 2017.",
      "La variedad aquí no tiene límites, se consigue desde el menor accesorio electrónico, hasta un mayor componente o pieza, bien sea para teléfonos móviles, u otros. Así mismo se presta para ser un portal de la inversión extranjera en cuánto a experimentar en tecnologías de primera mano, es un lugar a considerar cuando se quiera inclinar hacia lo electrónico.",
      "<b></b>A tan solo 444 km de Guangzhou, se encuentra esta ciudad la cual es la cuna para la fabricación de juguetes e industrias dedicadas a esto, de las cuales empezaron desde abajo como un proyecto familiar muy remoto. Entre los años 80 y 90 ha ido en un gran progreso, existiendo actualmente mucho más de cuatro mil empresas dedicadas a ello.",
      "Dentro de esta implementación se puede encontrar desde lo más tradicional de un juguete familiar para navidad, hasta los que poseen detalles tecnológicos controlados a control remoto. Ya que no hay barreras para la creatividad, se realiza una feria anual en la cual se cuenta con la presencia de empresarios extranjeros muy importantes.",
      "<b></b>Se encuentra entre Hong Kong y Guangzhou, y sin duda lo primero que se viene a la mente es la confección y fabricación de suéteres en esta localidad, esto se debe a que contiene el mayor mercado dedicado a la lana. Convirtiéndose así en el sitio ideal para adquirir este tipo de tela.",
      "Esta ciudad ah resaltando entre las otras durante muchos años, gracias al rubro de la lana. Razón por la cual posee una basta experiencia en todo lo que a este rubro requiere, garantizando así que todos los productos que se realicen serán de la mejor calidad.",
      "<b></b>Se puede decir que dentro de esta ciudad<b> </b>no reina la oscuridad, en el sentido de que es un sitio dedicado expresamente a la iluminación. Todo esto debido a que dispone de una producción profesional enfocada al ámbito de la luz, que alcanza el 70% de la producción nacional, brindando la alimentación eléctrica a gran parte de la cuidad.",
      "La calidad está totalmente asegurada ya que los productos que aquí se generan son dirigidos hacia mercados sumamente importantes como Estados Unidos, la Unión Europa, además de 130 países adicionales. Razón por la cual anualmente se celebra una feria en dedicación alusiva a esto, para exponer la mayor innovación de productos.",
      "<b></b>Muy cerca, a tan solo 30 km de Guangzhou se encuentra el principal nido o locación de los mejores muebles que pueden existir, esto debido a que Foshan es una ciudad dedicada al negocio textil de los muebles. Son ideales para su importación, cuenta con una gran cantidad de marcas, alrededor de 150.000 dedicadas a este negocio. Razón por la cual predomina la variedad y calidad, por sobre todas las cosas.",
      "No obstante, al visitar esta ciudad también se pueden encontrar otros rubros muy buenos también, como lo es la fabricación de cerámicas, ropa para niños, incluso material de construcción y electrodomésticos. Gracias a esto se puede salir de dos objetivos a la vez en esta localidad.",
      "<b></b>Todos los accesorios de cocina a base de acero inoxidable se consiguen en esta ciudad, desde cuchillos hasta las mejores tijeras, de hecho posee más de 1.500 fabricantes con diferentes marcas de cuchillos, y los productos son distribuidos alrededor de más de 100 países.",
      "Es una localidad importante ya que permite la exportación de estos útiles y versátiles productos a otros países. Se pueden encontrar tijeras de gama baja, media o alta, las cuales son sumamente eficientes y en algunos países no se consiguen.",
      "<b></b>Los negocios giran alrededor de esta localidad ya que es una ciudad portuaria, lo que es sumamente ideal como un pasaje para importar y exportar. Al mismo tiempo su fuerte de producción se basa en pequeños electrodomésticos, capaz de producir los productos más demandados a nivel nacional y al mismo tiempo es exportado a nivel internacional.",
      "Su producción consiste en la creación de la fábrica de moldeo por inyección, el ámbito de la papelería y también piezas de autopartes. Razón por la cual es muy dinámica la producción sobre este rubro.",
      "<b></b>Cuando se trata de conseguir los productos pequeños de primera necesidad, esta es la ciudad ideal para ello, ya que cuenta con más de 80 mil tiendas dedicadas a expender este rubro. La diversidad de productos se encuentra comprendida entre 30 mil productos de diversa índole y utilidad.",
      "Además de que en su año más productivo generó ingresos de más de US $ 10 mil millones en bienes, según datos provenientes del Banco Mundial, posee una economía muy activa. La cual está en constante producción final para cumplir con diferentes compromisos contractuales a nivel internacional.",
      "<b></b>Esta se encuentra dedicada enteramente a la fabricación de paraguas, en variedad de modelos y diseños, de la más alta calidad. Gracias al nivel competitivo que existe entre más de 1.100 empresas dentro de este medio, se logra representar una cadena de industria con amplia experiencia en el sector.",
      "En esta ciudad prevalece la demanda de la venta al mayor, y la ventaja de ello, es que se pueden encontrar un sinfín de tipos de paraguas que son una gran innovación para los demás países.",
      "<b></b>Ubicada a 110 kilómetros de Hangzhou, se concibe el nicho más grande de ropa para niños, desde lo más básico, hasta los diseños más innovadores para el ámbito infantil, el cual siempre ha resultado un buen proyecto de inversión. Por ello posee un mercado de más de 4 niveles para brindar las mejores opciones.",
      "Al mismo tiempo resulta el sitio más proporcional en cuanto a calidad y a precio, ya que se ofrece llegar hasta las personas de ingresos bajos o medios, sin renunciar al buen diseño, gracias a la estructuración y planificación de costos, lo cual puede resultar un beneficio para trasladar esto hacia países subdesarrollados.",
      "<b></b>Una de las ciudades más famosa por su carácter de celebrar negocios y contratos, aunque en sus inicios era una localidad pobre y plagada de carencias, le sirvió de impulso para buscar nuevas ideas millonarias, para empezar a emprender proyectos económicos. Motivo por lo cual se llegaron a formar diversas industrias, pero su potencial reside en el calzado.",
      "La industria de los zapatos se expandió hasta el punto de llevar su producción hasta contar con 4.500 de modelos de calzado, y también de esta cantidad se derivan más de 900 enfocados al ámbito infantil. Es el proveedor principal a nivel nacional por su diversidad de marcas, gracias al manejo de la tecnología para obtener grandes resultados.",
      "No obstante, más allá del calzado también se destaca dentro de las industrias de electrodomésticos, de hecho es el establecimiento físico de la marca famosa de Chint Electric, e incluso sobresale por la fabricación de autopartes, y válvulas. Lo que ha generado un gran movimiento económico e impulsado el embalaje para distribuir estos productos.",
      "<b></b>Siendo una <b>ciudad</b> de fácil acceso por su cercanía con el aeropuerto internacional de Xiaoshan Hangzhou, es el punto de encuentro textil más grande que existe, donde es posible hallar una enorme cantidad de telas. Se caracteriza por ser el mercado más grande a nivel mundial en este rubro.",
      "Por esta razón posee más de diez mil proveedores, de más de treinta mil tipos de telas, y el tráfico económico diario se estima entre unas cien mil personas. Es capaz de surtir a todo el país las mejores telas para la fabricación de ropa, y esto mismo sucede con los inversionistas extranjeros, se dirigen meramente a comprar tela.",
      "<b></b>Pero si de calzado deportivo se trata, este es el lugar indicado, al contar con más de tres mil empresas dedicadas a la producción de este rubro. Consiguiendo de esta forma alcanzar una cifra de producción muy grande de setecientos millones de pares aproximadamente, valorado en un costo o precio anual de 200 mil millones de yuanes.",
      "Estos calzados son exportados a más de 80 países a nivel mundial, convirtiéndose en la mayor base de producción de calzado deportivo, por lo que es mercado completamente estable y prometedor. Cuenta con una cadena de industrias consolidadas sobre esta actividad, y al mismo tiempo es capaz de realizar imitación de calidad de marcas como Nike o Adidas.",
      "<b></b>Bautizada como la <b>ciudad</b> de cristal de <b>China</b>, ya que se dedica a la distribución de materias primas, de hecho el cristal proveniente del mar de China Oriental es concebido mundialmente como una fuente de diversas reservas de este material de texturas puras. A esto se debe de que la producción nacional sea de más de quinientas toneladas de cristal.",
      "Históricamente la exploración y explotación de este material se inició en el siglo XIX, por ello se ha conmemorado un festival anual para realzar la importancia del mismo, tanto por su antigüedad como por los aportes económicos que produce.",
      "<b></b>En cambio sí se trata de moda y buena calidad, en este sitio se encontrará la mejor confección de vestidos de novias, de hecho toda novia se traslada hasta aquí para elegir un modelo de vestido específico. Su mercadeo se encuentra localizado en una calle en forma de exhibición para poder apreciar todos los diseños, a base de precios accesibles.",
      "Por esta razón su exportación e interés de muchos extranjeros se hace notar. Se ha conformado una plataforma nacional que los distribuye, así mismo se han construido mercados de vestidos de novias provenientes de esta ciudad del diseño conyugal para tener modelos preciosos.",
    ],
  },
  {
    slug: "secretos-importar-china",
    category: "tutorial",
    title: "Desvelando los secretos para importar de China en 2023",
    excerpt:
      "Como empresario, es posible que ya haya considerado la idea de importar productos de China. Después de todo, ¿quién no querría aprovechar el ahorro de costes y la comodidad de importar de la segund...",
    date: "2023-01-23",
    readTimeMin: 6,
    body: [
      "Como empresario, es posible que ya haya considerado la idea de importar productos de China. Después de todo, ¿quién no querría aprovechar el ahorro de costes y la comodidad de importar de la segunda economía más grande del mundo? No es ningún secreto que importar de China puede ser lucrativo y gratificante. Pero también puede ser un reto si no sabe qué importar de China.",
      "En este blog, hablaremos de las ventajas de importar de China, los retos de importar de China y qué importar de China en 2023. También ofreceremos algunos consejos para importadores y recursos para ayudarle a empezar.",
      "<b>Introducción a las importaciones de China</b>",
      "La República Popular China es la segunda economía más grande del mundo y se ha convertido en uno de los principales actores de la economía mundial. El país es un gran exportador de una gran variedad de productos, desde electrónica y ropa hasta muebles y electrodomésticos. China también es conocida por su producción a bajo coste, lo que la convierte en una opción atractiva para los empresarios que buscan ahorrar dinero en sus importaciones.",
      "A la hora de importar de China, hay que tener en cuenta algunas cosas. En primer lugar, tendrá que elegir un proveedor fiable. También tendrá que desarrollar una buena relación con su proveedor, ya que esto ayudará a garantizar un proceso de importación sin problemas. Por último, deberá conocer las normativas o impuestos que puedan aplicarse a sus importaciones.",
      "<b>Ventajas de importar de China</b>",
      "Importar de China tiene varias ventajas. En primer lugar, como ya se ha mencionado, China es conocida por su producción a bajo coste, lo que la convierte en una opción atractiva para los empresarios que buscan ahorrar dinero en sus importaciones. Además, la enorme capacidad de fabricación de China puede utilizarse para producir grandes cantidades de productos de calidad a precios competitivos.",
      "Además del ahorro de costes, importar de China también ofrece comodidad. China es un centro mundial de transporte y logística, lo que facilita que sus productos lleguen a sus clientes de forma rápida y eficaz.",
      "Por último, importar de China puede abrir nuevos mercados. Al importar productos de China, puede acceder a un mercado global y llegar a clientes de todo el mundo.",
      "<b>Los retos de importar de China</b>",
      "A pesar de las muchas ventajas de importar de China, es importante ser consciente también de los posibles retos. Uno de los mayores retos es superar la barrera del idioma. Es posible que muchos proveedores chinos no hablen inglés, por lo que es importante contar con alguien en su equipo que pueda comunicarse eficazmente con su proveedor.",
      "Además de la barrera del idioma, también hay una serie de reglamentos e impuestos que pueden aplicarse a sus importaciones. Es importante conocer estas normativas e impuestos y asegurarse de que se cumplen.",
      "Por último, es importante conocer los riesgos potenciales asociados a la importación desde China. Siempre existe la posibilidad de que se produzcan retrasos, problemas de calidad y otros problemas. Es importante asegurarse de que trabaja con un proveedor fiable y de que dispone de un plan para resolver cualquier problema que pueda surgir.",
      "<b>Qué importar de China en 2023</b>",
      "Cuando se trata de qué importar de China en 2023, hay algunas tendencias que debe vigilar. La primera es la creciente demanda de vehículos eléctricos. China ya es el mayor productor mundial de vehículos eléctricos, y se espera que la demanda de estos vehículos siga creciendo en los próximos años.",
      "Otra tendencia a tener en cuenta es la creciente demanda de productos sostenibles y ecológicos. Los fabricantes chinos fabrican cada vez más productos con materiales sostenibles y reciclados, y se espera que la demanda de estos productos siga creciendo en los próximos años.",
      "Por último, se espera que la demanda de electrónica de consumo siga siendo fuerte en los próximos años. Esto incluye desde teléfonos inteligentes y tabletas hasta dispositivos domésticos inteligentes.",
      "<b>DoorTuDoor: La forma más fácil de importar de China</b>",
      "Si usted está buscando importar desde China, DoorTuDoor puede hacer el proceso más fácil. Nuestra plataforma está diseñada para ayudar a los importadores como usted a obtener los productos adecuados, encontrar los proveedores adecuados y gestionar todo el proceso de importación.",
      "Hacemos que sea fácil obtener productos de China y gestionar todo el proceso de importación. Nuestro equipo de profesionales experimentados se encargará del papeleo y se asegurará de que sus importaciones se envíen a tiempo. También proporcionamos apoyo durante todo el proceso para garantizar una experiencia de importación fluida y satisfactoria.",
      "<b>Consejos para importar de China</b>",
      "Cuando se trata de importar de China, hay algunos consejos que pueden ayudar a asegurar una experiencia de importación exitosa. En primer lugar, es importante investigar. Asegúrese de que conoce el proceso de importación, las normativas o impuestos que pueden aplicarse a sus importaciones y los riesgos potenciales asociados a la importación desde China.",
      "También es importante trabajar con un proveedor fiable. Tómese su tiempo para encontrar el proveedor adecuado y establecer una buena relación con él. Esto le ayudará a garantizar un proceso de importación fluido y a reducir el riesgo de que surjan problemas.",
      "Por último, organícese. Establezca un sistema de seguimiento de sus importaciones y manténgase al día de cualquier papeleo u otros requisitos.",
      "<b>Evitar los errores más comunes al importar de China</b>",
      "A la hora de importar de China, hay que evitar algunos errores comunes. El primero es subestimar el coste. Asegúrese de que conoce los posibles costes asociados a sus importaciones, incluidos los impuestos y tasas.",
      "Otro error que hay que evitar es no investigar. Asegúrese de que comprende el proceso de importación y cualquier normativa o impuesto que pueda aplicarse a sus importaciones. Además, asegúrese de que trabaja con un proveedor fiable y de que dispone de un plan para resolver cualquier problema que pueda surgir.",
      "Por último, no olvide organizarse. Establezca un sistema de seguimiento de sus importaciones y asegúrese de que está al día de cualquier papeleo u otros requisitos.",
      "Importar de China puede ser una excelente manera de ahorrar dinero, acceder a nuevos mercados y llegar a clientes de todo el mundo. Sin embargo, es importante comprender el proceso de importación, los costes y riesgos potenciales asociados a la importación desde China y los mejores mercados para los importadores en 2023.",
      "En DoorTuDoor, facilitamos la obtención de los productos adecuados, la búsqueda de los proveedores adecuados y la gestión de todo el proceso de importación. Contáctenos si necesita importar de China a Venezuela. DoorTuDoor estará encantado de ayudarle.",
      "Importar de China puede ser una excelente manera de hacer crecer su negocio y acceder a nuevos mercados. Con la preparación adecuada, la investigación y los recursos, usted puede tomar ventaja del ahorro de costes y la conveniencia de importar de China.",
    ],
  },
  {
    slug: "ano-nuevo-chino",
    category: "anuncio",
    title: "NOTICIAS DEL AÑO NUEVO CHINO 2023",
    excerpt:
      "Las festividades del Año Nuevo chino son cambiantes, por lo general se sitúan entre el 21 de enero y el 20 de febrero. Sin embargo, este año se ha adelantado considerablemente; la festividad comenz...",
    date: "2023-01-12",
    readTimeMin: 3,
    body: [
      "Las festividades del Año Nuevo chino son cambiantes, por lo general se sitúan entre el 21 de enero y el 20 de febrero. Sin embargo, este año se ha adelantado considerablemente; la festividad comenzará el domingo 22 de enero",
      "La celebración terminará con el Festival de los Faroles el 5 de febrero de 2023.",
      "2023 es el año del Conejo, el cual representa la gracia, la belleza, la calma y la paz. También simboliza la perseverancia y el éxito.",
      "<b>¿EN QUÉ CONSISTE EL AÑO NUEVO CHINO?</b>",
      "Ya que en DoorTuDoor somos expertos en el negocio chino, tenemos que estar atentos al calendario festivo, marcar nuestros tiempos para no interrumpir nuestra cadena de suministro.",
      "La festividad más importante es el Año Nuevo Chino, o también llamado Festival de primavera. Las comunidades chinas celebran el inicio del año nuevo, despiden el año viejo y están destinadas a traer suerte y prosperidad en el nuevo.",
      "Es una tradición con más de 4.000 años de historia y se celebra en muchos países de Asia oriental como China continental, Hong Kong, Macao, Taiwán, Corea del Sur, Singapur o Japón. El zodiaco chino está representado por doce animales (rata, vaca, tigre, conejo, dragón, serpiente, caballo, cabra, mono, gallo, perro y cerdo) y cuatro elementos (fuego, tierra, aire y agua). Con este último punto en mente, debemos confirmar que 2023 es el año del Conejo de Agua.",
      "<b>EL AÑO NUEVO VUELVE A CELEBRARSE CON EL COVID-19</b>",
      "El Año Nuevo Chino 2023 estará marcado por un aumento en el número de casos de Covid-19 vistos en China desde diciembre.",
      "Los bloqueos y cierres en China están agotando el suministro y aumentando el riesgo de la escasez. La huelga afecta al puerto de Shanghái, donde se encuentran numerosos barcos paralizados congestionando el mayor puerto del mundo.",
      "A la paralización de barcos se suma la escasez de contenedores, el aumento desorbitado del precio de los fletes.",
      "Si a ello sumamos que el transporte terrestre y las fábricas también se han visto afectadas también debemos de tener en cuenta que los plazos de entrega de las mercancías han caído en picada en las últimas semanas.",
      "<b>¿CÓMO ORGANIZAR NUESTRAS IMPORTACIONES ACORDES CON EL AÑO NUEVO CHINO?</b>",
      "El año nuevo chino se acerca por lo que nos encontramos en semanas clave para planificar y estructurar con antelación las cargas de nuestra mercancía.",
      "Cualquier mercancía o contenedor que quiera ser enviada antes del CNY debe de conseguir espacio disponible para salidas de buques programadas entre el 10-15 de enero como tarde. Por ello, estas semanas son clave, ya que un gran número de importadores llevan a cabo sus reservas con tiempo por lo que el espacio disponible es realmente limitado.",
      "Si queremos crear una cadena efectiva para nuestro negocio, debemos pensar en este tipo de vacaciones en China porque durante CNY, China se detiene por completo y no obtendrá ninguna respuesta de los corredores, transitarios, compañías navieras, cargadores u otros participantes en el proceso de entrega.",
      "Es por eso que en DoorTuDoor planificamos y coordinamos con antelación los envíos de nuestros clientes, agilizando así todo el proceso, asegurando que todo se entrega a tiempo.",
    ],
  },
  {
    slug: "importar-paneles-solares-china",
    category: "industria",
    title: "IMPORTACIÓN DE PANELES SOLARES DE CHINA EN 2023",
    excerpt:
      "Las energías renovables, especialmente el uso de paneles solares se encuentra a la vanguardia de negocio global, combinando una inversión empresarial que aúna prosperidad económica y conciencia med...",
    date: "2023-01-05",
    readTimeMin: 3,
    body: [
      "Las energías renovables, especialmente el uso de paneles solares se encuentra a la vanguardia de negocio global, combinando una inversión empresarial que aúna prosperidad económica y conciencia medioambiental.",
      "China hace accesible la importación de paneles solares y de ello hablaremos a continuación. Para ello hablaremos de las especificaciones técnicas de los paneles solares y que hay que tener en cuenta para escoger un buen proveedor en China. También introduciremos las regulaciones, impuestos antidumping y ferias que incluyen estos productos.",
      "<b>ESPECIFICACIONES TÉCNICAS</b>",
      "En la industria solar la personalización del producto no es generalmente necesaria, por lo que lo que los compradores no suelen pedir mayores especificaciones de los paneles fotovoltaicos.",
      "Aunque estas especificaciones dependerán de la calidad y toque personal de cada fabricante, a continuación, se adjunta una lista de las especificaciones más comunes que es necesario tener en cuenta:",
      "• Vida útil de los paneles (entre 20 y 25 años aproximadamente)",
      "• Material (mono cristalino o poli cristalino)",
      "• Si cuenta o no con protección contra la sal en caso de que la instalación se realice en zonas costeras.",
      "• Frente (barras protectoras específicas y recubrimiento)",
      "• Parte posterior (barras conectoras específicas y material trasero)",
      "• Número de celdas (60 por panel)",
      "• Dimensiones del panel solar completo.",
      "• Rango de temperatura.",
      "• Capacidad máxima de carga",
      "• Marcas, modelo de cable y conector.",
      "• Material del marco.",
      "Las especificaciones finales serán ofrecidas por el proveedor. Sin embargo, en caso de que el comprador tenga algunos requisitos de rendimiento, debe comunicárselos al proveedor y que éste ofrezca un producto acorde a estas exigencias.",
      "<b>PÉRDIDAS DE EFICIENCIA</b>",
      "La mayoría de los proveedores advierten a los compradores que los paneles pierden cierta eficiencia con el paso del tiempo, mantienen entre un 90/95% de salida en los primeros 10 años y entre un 80/85% de salida los restantes 15 años de su vida útil. Es por esto por lo que muchos fabricantes chinos ofrecen una garantía de calidad de 25 años.",
      "<b>COMPONENTES DEL SISTEMA</b>",
      "Respecto a los componentes hay que tener muy en cuenta que éstos deben de cumplir con las medidas y regulaciones de seguridad del país al que va a ser importado el producto.",
      "La mayoría de los proveedores desconocen qué componentes son compatibles con las regulaciones y normas de otros mercados, así que es crucial que el comprador se informe sobre las regulaciones de su país en esta materia y de qué componentes exactos necesita el sistema para su pleno funcionamiento.",
      "<b>FABRICANTES DE PANELES SOLARES EN CHINA</b>",
      "Antes de contactar con un proveedor chino se debe tener en cuenta que China es el mayor fabricante y exportador de paneles solares y como es de esperar, el top 10 de fabricantes no negocia con pequeños y medianos importadores.",
      "Por suerte la industria fotovoltaica es mucho más que estas compañías, solamente en Alibaba hay casi 3000 proveedores, ubicadas en su mayoría en Zhejiang, Jiangsu y la provincia de Guangdong.",
      "<b>FERIAS DE PANELES SOLARES EN CHINA. (FERIA DE CANTÓN)</b>",
      "La feria de Cantón es la feria de comercio más grande de China. Se ubica en Guangzhou, Guangdong y tiene lugar cada año en abril y en octubre. En esta feria podemos encontrar:",
      "• Módulos y células solares.",
      "• Componentes eléctricos.",
      "• Productos fotovoltaicos.",
      "• Productos termo solares.",
      "¿Necesitas ayuda con tu importación de paneles solares? Contacta con nosotros <b>DoorTuDoor</b>",
    ],
  },
];

// ──────────────────────────────────────────────────────────────────
// HERO — copy del bloque principal del home (fuente: Brand Book § Hero)
// ──────────────────────────────────────────────────────────────────

export const HERO = {
  eyebrow: "Logística end-to-end · Desde 2008",
  /**
   * Tagline oficial v3.0 (mayo 2026). Fuente:
   *   docs/design/brand-book/v3.0/proyecto/Brand Book DTD v3.0.html § 02
   *
   * Antes (v2.x): "De China a tu puerta. Sin intermediarios."
   * Ahora (v3.0): "Con confianza, / de China a tu puerta."
   *
   * Por qué cambió (del brand book): "antepone el valor diferencial (confianza,
   * construida cliente a cliente) antes que la promesa funcional. La voz pasa
   * de transaccional a relacional, sin perder claridad."
   *
   * Layout: 2 líneas (NO hay 3ra "kicker"). Primera línea en wine, segunda
   * en color default (ink/navy).
   */
  headline: [
    { text: "Con confianza,", accent: "wine" as const },
    { text: "de China a tu puerta.", accent: null },
  ],
  /**
   * Sub-claim (voz interna · filosofía operativa). NO se renderiza en el hero;
   * se usa en footer y otros copy secundarios donde aplique.
   */
  subClaim: "Construyendo confianza cliente a cliente, contenedor a contenedor.",
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
