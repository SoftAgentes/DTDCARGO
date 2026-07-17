/**
 * DTD Cargo design tokens — fuente: el Brand Book vigente del Norte (docs/design/studio/_norte/)
 * + Brochure_DTD_Cargo_China_Venezuela.docx (contenido editorial).
 *
 * Estos tokens espejan 1:1 las CSS custom properties definidas en globals.css.
 * Úsalos desde TSX cuando necesites el valor (ej. estilos inline, props, etc.).
 * Para clases utilitarias, prefiere los tokens de Tailwind (@theme en globals.css).
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

  // Status colors — brand book
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
// SOMBRAS OFICIALES — brand book · colors.json § shadows
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
 * Mono de marca (JetBrains Mono) para valores copiables del sitio público:
 * Shipping Mark, teléfonos, códigos postales, emails (guía Alibaba + clip de
 * proveedor). La página que monte el componente debe cargar la variable
 * `--font-mono` con `jetbrainsMono.variable` de `lib/fonts.ts` (instancia
 * única — NO redefinir JetBrains_Mono inline: otros weights = faux-bold
 * silencioso). El fallback va DENTRO del var(): un var() sin resolver
 * invalida el font-family completo (caería a Archivo heredado en vez de a
 * ui-monospace).
 */
export const FONT_MONO =
  "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco), monospace";

/**
 * Sistema de assets de marca · DTD Cargo.
 *
 * Fuente de verdad oficial:
 *   docs/design/studio/_norte/Brand Book DTD v4.6.html
 *   docs/design/studio/_norte/BRAND-MIGRATION-2026-05.md
 *
 * El isólogo oficial tiene 4 variantes según el fondo. Usa `<BrandMark>`
 * desde `components/BrandMark.tsx` que abstrae la selección de variante.
 */
export const BRAND_ASSETS = {
  /** Isólogo oficial — variante PRIMARY (sobre fondo claro). 741×764, transparente. */
  isologoPrimary: "/brand/dtdcargo-isologo-primary.png",
  /** Isólogo oficial — variante REVERSE (sobre fondo navy/oscuro). 741×764, transparente. */
  isologoReverse: "/brand/dtdcargo-isologo-reverse.png",
  /** Isólogo oficial — variante MONO-LIGHT (cream sólido sobre wine). 741×764. */
  isologoMonoLight: "/brand/dtdcargo-isologo-mono-light.png",
  /** Isólogo oficial — variante MONO-DARK (navy sólido B&W para imprenta). 741×764. */
  isologoMonoDark: "/brand/dtdcargo-isologo-mono-dark.png",

  /** Ilustración hero del contenedor (SVG vectorial del handoff original). */
  containerSvg: "/brand/container.svg",
  /** Favicon PNG 32×32 (regenerado desde isologoPrimary vía scripts/generate-favicons.mjs). */
  favicon32: "/brand/favicon-32.png",
  /** Favicon PNG 16×16 (regenerado). */
  favicon16: "/brand/favicon-16.png",
  /** Favicon .ico legacy fallback (sin regenerar — modern browsers usan los PNG primero). */
  favicon: "/brand/favicon.ico",
  /** Apple touch icon 180×180 (regenerado con fondo paper #FBFAF7). */
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
 * Los CTAs primarios del sitio abren WhatsApp para mantener la promesa
 * "un asesor humano te responde" (la captación server-side ya es real:
 * `POST /api/contact` y `POST /api/public/estimacion`). Los clicks a estos
 * links los cuenta el listener global de `components/Analytics.tsx`
 * (conversión de Ads "Click WhatsApp" + evento GA4 `whatsapp_click`).
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
  // String de marca para el footer (NO es la razón social legal)
  legalName: "DTD Cargo · DoorTuDoor Services",
  // Nombre público limpio para schema.org (name / knowledge graph)
  brandName: "DTD Cargo",
  /**
   * Entidad legal REAL — SOLO para schema.org (legalName/taxID/founder).
   * NUNCA mostrar en texto visible del sitio (regla de marca del founder).
   */
  legalEntity: {
    legalName: "INVERSIONES DTD SERVICES, C.A",
    taxID: "J-50648869-8", // RIF — público por diseño (sale en el HTML source)
    founder: "José Méndez", // representante legal
  },
  // Web y social
  web: "www.dtdcargo.com",
  instagram: {
    handle: "@doortudoor_",
    // URL canónica sin tracking params — limpio para schema.org sameAs.
    url: "https://www.instagram.com/doortudoor_",
  },
  youtube: {
    // sameAs usa la URL por ID del canal (PERMANENTE) — sobrevive a renombres de
    // nombre y de handle. ID verificado 200 (canal "DoorTuDoor" → "DTD Cargo").
    handle: "@doortudoor",
    url: "https://www.youtube.com/channel/UCzUeKxFb47h5yImw5xiJ-gg",
  },
  tiktok: {
    handle: "@doortudoor",
    url: "https://www.tiktok.com/@doortudoor",
  },
  // Email general (fuente brochure)
  emailGeneral: "info@dtdcargo.com",
  // Sedes
  ve: {
    label: "Venezuela",
    city: "Valencia, Carabobo",
    address: "Edificio Kokuy, Calle 151",
    addressFull:
      "Edificio Kokuy, Calle 151, entre Av. Bolívar Norte y Av. Paseo Cabriales. Valencia, Carabobo, Venezuela",
    postalCode: "2001", // Valencia, Carabobo — para schema.org PostalAddress

    /**
     * Coordenadas GPS exactas del Edificio Kokuy (founder 2026-07-11) — para
     * schema.org GeoCoordinates (señal fuerte de local SEO) y pin de mapas.
     */
    geo: { lat: 10.220449465809326, lng: -68.00848104738162 },

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
    email: "info@dtdcargo.com", // unificado al buzón general (vzla@ es alias del mismo correo en Hostinger)
    hours: "Lun a Vie · 9:00 – 17:00 (GMT-4)",
    whatsappHours: "Todos los días · 8:00 – 20:00 (GMT-4)",
  },
  cn: {
    label: "China",
    city: "Yiwu City, Zhejiang",
    address: "Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11)",
    addressFull:
      "Yiwu Port Phase II, Warehouse 2, No. 2 (Cargo 7-11), Yiwu City, Zhejiang, China",
    postalCode: "322000", // Yiwu, Zhejiang — para schema.org PostalAddress
    /**
     * Razón social CN de la bodega — encabeza el packing list/factura del
     * proveedor (NORTE-SYNC v4.4 · packlist). Solo visible en documentos CN.
     */
    companyCjk: "义乌市林冠进出口有限公司",
    /**
     * Dirección oficial en caracteres chinos — para WeChat / proveedores locales.
     * Fuente: brand book § China Supplier Clip.
     */
    addressCjk: "浙江省义乌市义乌港二期直通仓2栋2号 货7-货11",
    /** Provincia y ciudad en chino — para formularios tipo Alibaba (selectores separados). */
    provinceCjk: "浙江省", // Zhejiang
    cityCjk: "义乌市", // Yiwu — en los selectores aparece bajo 金华市 (Jinhua)
    cityParentCjk: "金华市", // Jinhua (prefectura a la que pertenece Yiwu)
    /** Encargado de bodega — 林冠 (Lin Guan) */
    contactPersonCjk: "林冠",
    contactPersonPinyin: "Lin Guan",
    /** Contacto de coordinación con el proveedor para el instructivo/clip
     *  (SDD-0096, founder 2026-06-19). Distinto del encargado de bodega (林冠). */
    supplierContactCjk: "吴小姐",
    supplierContactEs: "Srta. Wu",
    /** WeChat ID de DTD para que el proveedor nos agregue. */
    wechatId: "DTDLogistic",
    /** Teléfono local · formato internacional para tel: link ("186 siempre", founder 2026-06-19). */
    phone: "+86 186 0689 1419",
    phoneRaw: "+8618606891419",
    /** Teléfono en formato chino (sin +86, como se escribe en WeChat). */
    phoneCjk: "18606891419",
    /** Fijo de bodega (Yiwu) · formato internacional para tel: link (NORTE-SYNC v4.4 · packlist). */
    phoneLandline: "+86 579 8543 1781",
    phoneLandlineRaw: "+8657985431781",
    /** Horario en español (corregido a 17:30 según brand book). */
    hours: "Lun a Sáb · 9:00 – 17:30 (GMT+8)",
    /** Horario en chino — para el clip de WeChat. */
    hoursCjk: "周一至周六上午9点到下午5点半",
    email: "info@dtdcargo.com", // unificado al buzón general (antes China@; canónico en minúsculas)
    /** Email de recepción de la bodega CN — para el packing list del proveedor (NORTE-SYNC v4.4). */
    warehouseEmail: "candywu@ywlgcanopy.com",
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
    copy: "Coordinamos la reserva del buque, posicionamos el contenedor vacío en la fábrica de tu proveedor y embarcamos. Gestionamos la documentación de exportación para que tu carga salga en regla.",
    benefit: "Coordinación directa fábrica–buque",
    icon: "Container",
    location: "cn",
  },
  {
    slug: "consolidacion-bodega-yiwu",
    title: "Consolidación en bodega propia (LCL/FCL)",
    subtitle: "Cuando consolidas varios proveedores",
    copy: "Tus proveedores chinos envían a nuestra bodega propia en Yiwu. Ahí inspeccionamos, etiquetamos y consolidamos todo en un solo contenedor (FCL) o en grupaje (LCL). Sale unificado, con un solo punto de contacto.",
    benefit: "Una sola carga desde múltiples proveedores",
    icon: "Warehouse",
    location: "cn",
    featured: true,
  },
  {
    slug: "chequeo-etiquetado",
    title: "Inspección y etiquetado de mercancía",
    copy: "Verificación física contra ficha técnica antes del embarque, más etiquetado y marcado según requerimientos del cliente o normativa de destino.",
    benefit: "Menos imprevistos a destino",
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
    copy: "Coordinamos pruebas de laboratorio (RoHS, CE, FDA y otros) y gestión de permisos requeridos para exportación.",
    benefit: "Certificación lista para destino",
    icon: "Shield",
    location: "cn",
  },
  {
    slug: "muestras-courier",
    title: "Envío de muestras y documentos",
    copy: "Envíos urgentes por DHL/UPS/FedEx desde Yiwu: muestras pre-producción, documentos y lotes pequeños críticos. (El flete aéreo de carga está temporalmente suspendido; la carga va por vía marítima.)",
    benefit: "Velocidad cuando importa",
    icon: "Box",
    location: "cn",
  },
  {
    slug: "compra-asistida",
    title: "Compra asistida",
    copy: "Actuamos como tu departamento de compras en China: ubicamos, negociamos y gestionamos la compra por ti.",
    benefit: "Ahorro de tiempo, compras sin enredos",
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
    benefit: "Sin que tengas que lidiar con el papeleo",
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
    copy: "Bajo DDP nos encargamos del paso de tu carga por la aduana venezolana y de la nacionalización: la aduana y los impuestos ya van incluidos en tu precio, sin cobros sorpresa. Equipo local que conoce la normativa vigente.",
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
  { service: "Envío de muestras y documentos", cn: "Ejecución completa", ve: "—" },
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
// Fuente: brand book § "Página /glosario" + ampliado con
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
  /** Callout opcional "Cómo lo vives" / "Por qué importa" / "Ejemplo real" */
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
  // Orden: primero el concepto que el cliente entiende (Puerta a Puerta), luego
  // la metodología (DDP); después la modalidad más usada por pymes (LCL) antes
  // del contenedor exclusivo (FCL). Decisión founder 2026-06-14.
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
    id: "prepago",
    term: "Pagas al llegar",
    acronym: "Modalidad de pago",
    category: "modalidad",
    body: [
      "Indica cómo y cuándo pagas a DTD Cargo: pagas cuando tu carga llega a Venezuela, no por adelantado — con la aduana y los impuestos ya incluidos. Pueden aplicar restricciones según el caso.",
    ],
    analogy: {
      label: "Por qué importa",
      text: "En otros esquemas (pago contra entrega), la aduana te cobra de más en destino y te llevas el susto. Con nosotros, lo que cotizamos es lo que pagas — todo incluido, con menos imprevistos en el puerto.",
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
      "Quien tiene el BL original tiene el derecho a retirar la carga en destino, por eso es un documento crítico. Define siempre con tu operador logístico a nombre de quién se emite el BL, según el tipo de envío.",
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
      "Fecha estimada de salida del buque desde el puerto de origen (en nuestro corredor: Ningbo o Shanghai). Una vez confirmado el ETD, la travesía marítima puerto a puerto suele tomar 30–40 días; el tránsito total puerta a puerta es mayor, porque también se suma el flete interno en China, la espera de la próxima salida (cada 15-21 días) y el despacho aduanero más el last-mile en Venezuela.",
    ],
  },
  {
    id: "dtdu",
    term: "DTDU — Código de tracking",
    acronym: "DTD Universal · formato propio",
    category: "tracking",
    body: [
      "Código interno de DTD Cargo que identifica un envío de extremo a extremo. Formato: `DTDU-NNNNNN-XXXX`. Te lo damos al confirmar la cotización y lo usas en /track para ver el estado en tiempo real.",
      "El DTDU agrupa el BL marítimo, los documentos de aduana y el last mile bajo un solo identificador — más cómodo que recordar múltiples números.",
    ],
  },
  {
    id: "markbox",
    term: "Shipping Mark",
    acronym: "唛头 · marca de envío · código del cliente DTD-XXXX · antes MARKBOX",
    category: "tracking",
    body: [
      "El Shipping Mark es la marca que identifica cada una de tus cajas — así se conoce este marcado a nivel internacional (en China, 唛头). Es tu código único —formato DTD-XXXX— que se te asigna al darte de alta: identifica tus cajas desde origen, para que sepamos de quién es cada bulto que llega a nuestra bodega en Yiwu.",
      "Cuando pides mercancía a tu proveedor chino, le envías por WeChat el texto pre-formateado con tu Shipping Mark. El proveedor lo escribe en cada caja y al llegar a bodega sabemos exactamente a quién pertenece.",
    ],
    analogy: {
      label: "Lo encuentras en",
      text: "/contacto — sección 'Texto listo para WeChat'. Si todavía no tienes tu Shipping Mark, lo solicitas por WhatsApp.",
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
// NEWS POSTS — migrated to news_posts table (Plan v4 · Phase B+F).
//
// Single source of truth: supabase/migrations/0055_news_posts.sql
// Queries: lib/news/queries.ts (listPublishedPosts, getPostBySlug, …).
// Categorías + tipos editoriales: lib/news/categories.ts
//   (NEWS_CATEGORIES_V4, NEWS_TIPOS, gradientToCss).
// ──────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────
// HERO — copy del bloque principal del home (fuente: Brand Book § Hero)
// ──────────────────────────────────────────────────────────────────

export const HERO = {
  /**
   * Eyebrow gris arriba del kicker: categoría + año de fundación.
   * 2015 = fundación e inauguración en Venezuela = el año de la empresa (founder
   * 2026-07-17), y coincide con el año del corredor. Alinea con la banda de Stats
   * ("Operando en Venezuela · 2015") y con `foundingDate` del schema.
   * 2008 = inicios en China: es EXPERIENCIA, no fundación → vive en Stats ("En el
   * comercio con China desde 2008"). 2010 = hito histórico (se formalizó la
   * empresa de carga), nunca un claim de "operando/empresa desde".
   */
  eyebrow: "Logística China → Venezuela · Desde 2015",
  /**
   * Kicker = tagline oficial "Con Confianza, de China a tu puerta." (brand
   * book vigente; casing C mayúscula autorizado 2026-06-05).
   * SDD-0064 (decisión founder 2026-06-08): el tagline pasa de H1 a
   * KICKER y el H1 ahora es de ACCIÓN ("Importa desde China hasta tu puerta"),
   * para claridad + SEO + conversión, dejando "DDP" como aclaración secundaria.
   *
   * BRAND-EXCEPTION: BRAND.md define el tagline como el H1 del hero. Acá se
   * conserva el tagline pero como kicker (no como H1) — autorizado por el
   * founder el 2026-06-08 (regla estratégica: "el cliente entiende puerta a
   * puerta; DDP es la metodología técnica que lo hace posible").
   */
  kicker: { accent: "Con Confianza,", rest: "de China a tu puerta." },
  /**
   * H1 del hero (founder 2026-06-14): el tagline-headline "Con Confianza, desde
   * China hasta tu puerta." `lead` ("Con Confianza,") va en wine; `accent`
   * ("desde China hasta tu puerta.") en ink. Venezuela se aclara en el subtítulo,
   * no en el H1 — el H1 lidera el beneficio (tu puerta), no el destino.
   */
  title: {
    lead: "Con Confianza,",
    accent: "desde China hasta tu puerta.",
  },
  subtitle:
    "Servicio puerta a puerta hacia Venezuela con recepción, inspección, consolidación, aduana, impuestos y entrega final coordinados por un solo equipo responsable.",
  /** Microcopy bajo el CTA: disclaimer DDP. "Puerta a puerta" ya lo lidera el
   *  subtítulo, no se repite acá para no hacer eco (founder 2026-06-14). */
  microcopy:
    "Aduana e impuestos gestionados según tu cotización (modalidad DDP).",
  /**
   * Sub-claim (voz interna · filosofía operativa). NO se renderiza en el hero;
   * se usa en footer y otros copy secundarios donde aplique.
   */
  subClaim: "Construyendo confianza cliente a cliente, contenedor a contenedor.",
  search: {
    originPlaceholder: "Origen — país, ciudad o fábrica",
    originDefault: "China",
    destPlaceholder: "Destino — país o ciudad",
    destDefault: "Venezuela",
    cta: "Cotizar por WhatsApp",
  },
  /**
   * Beneficios para clientes de VOLUMEN. SDD-0064: salen del hero/barra de
   * confianza → van en una sección comercial de volumen (Fase posterior).
   */
  trustMarks: [
    "Tarifa mejorada por +10 CBM",
    "Inspección sin costo +20 CBM",
    "Equipo propio en Yiwu & Valencia",
  ],
  /**
   * Badge circular sobre el contenedor — ícono de bucle + "De China a tu puerta"
   * = el ciclo completo puerta a puerta. Reemplaza el "360°" abstracto que no
   * comunicaba nada (2026-06-13). El ciclo de 4 pasos se explica en HowWeWork.
   */
  badge: {
    line1: "Puerta a puerta",
    line2: "China → Venezuela",
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// STATS — 4 KPI hero (banda navy debajo del Hero)
// ──────────────────────────────────────────────────────────────────

/**
 * Años en el comercio con China — se CALCULA solo desde 2008 para que el KPI
 * "X AÑOS" no quede viejo. Importante: se llama en el RENDER del componente (no a
 * nivel de módulo) para que recompute en cada revalidación ISR, no al build.
 * 2026 → 18 · enero 2027 → 19, automático. (Inicio: enero 2008, founder 2026-06-13.)
 */
export function aniosComercioChina(): number {
  return new Date().getFullYear() - 2008;
}

export const STATS = [
  {
    // Total de experiencia desde los orígenes comerciales en China (2008).
    // Hoy 2026 - 2008 = 18 años de operación en la cadena de suministro
    // China → América Latina.
    num: "18",
    suffix: "AÑOS",
    label: "En el comercio con China desde 2008",
  },
  {
    // Hito de expansión a Venezuela (2015 · DTD Services LCL). Se muestra como
    // AÑO (no "AÑOS") para no repetir el formato de la cifra de China de arriba
    // — evita la doble antigüedad contigua que confundia (auditoria ui-ux).
    num: "2015",
    suffix: "",
    label: "Operando en Venezuela",
  },
  {
    num: "24",
    suffix: "HS",
    label: "Cotización inicial estimada",
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

export const STEPS: { n: string; title: string; copy: string; tag?: string }[] = [
  {
    n: "01",
    title: "Cotiza",
    tag: "Puerta a puerta · DDP",
    copy: "Calcula tu envío por CBM en segundos —modalidad DDP, todo incluido— o pídelo por WhatsApp. Estimación al instante.",
  },
  {
    n: "02",
    title: "Pre-alerta · Shipping Mark",
    copy: "Te registras y recibes tu Shipping Mark — tu proveedor en China lo escribe en cada caja antes de despachar.",
  },
  {
    n: "03",
    title: "Recibimos",
    copy: "Tu carga llega a nuestra bodega propia en Yiwu, identificada por tu Shipping Mark. La revisamos y la consolidamos.",
  },
  {
    n: "04",
    title: "Entregamos",
    copy: "Aduana e impuestos a nuestro nombre. Te llega puerta a puerta en Venezuela, con factura final — y vuelves a pedir.",
  },
];

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
    copy: "Sumamos etiquetado y courier de muestras y documentos a la suite logística.",
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
    copy: "Proximidad a fabricantes y clusters de producción. Comprar en el origen ayuda a conseguir mejores precios.",
    metric: "Origen",
    metricLabel: "precio de fábrica",
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
  headline: "Confía en quienes ya\nrecorrieron el camino.",
  body: [
    "Importar desde China no debería sentirse como un salto al vacío. En DTD Cargo recorrimos esta ruta cliente a cliente, caja a caja y contenedor a contenedor.",
    "Coordinamos recepción en China, inspección, consolidación, aduana, impuestos y entrega final en Venezuela con un solo equipo responsable. Por eso no prometemos magia: te damos proceso, trazabilidad y acompañamiento real.",
    "Nuestra reputación se construyó con resultados. Sin campañas ruidosas, sin promesas exageradas: solo operaciones bien ejecutadas, carga identificada desde origen y clientes que vuelven.",
  ],
  pull: "La confianza no se promete. Se construye en cada envío.",
  /**
   * 4 razones — se renderizan con el patrón de tarjeta de <HowWeWork />.
   * `kicker` cumple el rol del índice "01 / 04" de HowWeWork (acento wine en
   * Archivo Black); el de MARKBOX va en 唛头 (Noto Sans SC vía fallback de la pila).
   */
  cards: [
    {
      kicker: "EXPERIENCIA",
      title: "En la ruta desde 2015",
      copy: "Conocemos la ruta China → Venezuela desde dentro: compras, fábrica, bodega, aduana y entrega final. (En el comercio con China desde 2008.)",
    },
    {
      kicker: "DOS BASES",
      title: "Equipo en Yiwu y Valencia",
      copy: "Operamos en ambos extremos: recepción y consolidación en China, nacionalización y última milla en Venezuela.",
    },
    {
      kicker: "唛头",
      title: "Shipping Mark desde origen",
      copy: "Cada caja se identifica desde China con tu Shipping Mark —tu marca de envío personalizada (唛头)— para reducir errores y mezclas.",
    },
    {
      kicker: "TRAZABILIDAD",
      title: "Tracking etapa por etapa",
      copy: "Sigue tu carga desde la recepción en China hasta la entrega final en Venezuela.",
    },
  ],
  cta: "Deja que nuestra experiencia sea tu mayor tranquilidad.",
} as const;

// ──────────────────────────────────────────────────────────────────
// TESTIMONIOS — clientes reales (la sección se auto-oculta si está vacío)
// ──────────────────────────────────────────────────────────────────

export type Testimonial = {
  /** La frase del cliente, verbatim. */
  quote: string;
  /** Nombre de la persona o del comercio. */
  name: string;
  /** Contexto corto: ciudad · rubro. */
  detail: string;
  /** Ruta opcional a foto/logo en public/ (ej. "/testimonios/x.jpg"). */
  photo?: string;
};

export const TESTIMONIALS: Testimonial[] = [
  // Sin testimonios reales todavía. El material entregado solo tenía
  // placeholders de la plantilla (no clientes de DTD). Cargar reales acá.
];

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
