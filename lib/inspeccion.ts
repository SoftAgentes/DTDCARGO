/**
 * Contenido de la línea "Inspección de calidad en China" (sitio público).
 *
 * MARCA BLANCA: el cliente ve solo DTD. NUNCA se nombran los proveedores
 * terceros (V-Trust, SGS, QIMA, etc.) ni sus tarifas/costos — eso vive en el
 * backend interno (Fase 2). Acá solo va contenido editorial original.
 *
 * Las siglas técnicas (PSI, FA, CLS…) son genéricas de la industria y libres.
 * Copy redactado original (no se copian textos/logos de proveedores).
 *
 * Fuente editorial: docs/marketing + reporte integral de inspección (research).
 */

export const INSPECCION_HERO = {
  eyebrow: "Inspección en China",
  /** Línea 1 (ink) + línea 2 (wine) — patrón del hero de marca. */
  headline: "Inspección de calidad en China,",
  headlineAccent: "antes de embarcar.",
  lead: "No solo movemos tu carga puerta a puerta: también verificamos que lo que compras cumpla con lo que esperas. A través de nuestra red de inspectores acreditados en China, revisamos tu mercancía en la fábrica antes del envío — para que evites sorpresas, reduzcas riesgos y compres con tranquilidad.",
  benefits: [
    "Revisamos tu mercancía en origen, antes de pagar el saldo o embarcar.",
    "Te entregamos un reporte claro, con fotos y resultados, en español.",
    "Un solo socio para tu logística y tu control de calidad.",
    "Atención en español, con presencia directa en Yiwu, China.",
  ],
  ctaLabel: "Solicita tu cotización de inspección",
  /** Mensaje pre-armado para el CTA de WhatsApp. */
  ctaMessage:
    "Hola DTD Cargo, quiero cotizar una inspección de calidad en China. Mi producto es:",
} as const;

/** Flujo cliente de 5 pasos — simple por fuera, coordinado por dentro. */
export const INSPECCION_STEPS: { n: string; title: string; copy: string }[] = [
  {
    n: "01",
    title: "Eliges y cotizas",
    copy: "Seleccionas el tipo de inspección y completas un formulario corto: nombre, contacto, país y producto. Sin datos de pago en la web.",
  },
  {
    n: "02",
    title: "Coordinamos en China",
    copy: "Asignamos el inspector adecuado de nuestra red, confirmamos fecha y agendamos la visita en la fábrica de tu proveedor.",
  },
  {
    n: "03",
    title: "Inspeccionamos en fábrica",
    copy: "El inspector verifica tu mercancía contra la ficha técnica y el estándar acordado. Te mantenemos al tanto durante el proceso.",
  },
  {
    n: "04",
    title: "Recibes el reporte",
    copy: "Te entregamos el informe con fotos y resultados, traducido al español si hace falta, para que decidas con información clara.",
  },
  {
    n: "05",
    title: "Tu carga avanza",
    copy: "Si todo está conforme, tu mercancía sigue su camino puerta a puerta — con la misma coordinación de siempre.",
  },
];

export type InspeccionItem = { code: string; title: string; copy: string };
export type InspeccionGroup = {
  id: string;
  title: string;
  /** keyof iconMap del sitio (Check / Shield / Doc). */
  icon: string;
  blurb: string;
  items: InspeccionItem[];
};

/**
 * Sub-servicios agrupados en 3 familias (para no saturar). Cada familia abre
 * en su lista de servicios concretos. White-label: ningún proveedor nombrado.
 */
export const INSPECCION_GROUPS: InspeccionGroup[] = [
  {
    id: "inspecciones",
    title: "Inspecciones de producto",
    icon: "Check",
    blurb: "Verificación física de tu mercancía en distintos momentos de la producción.",
    items: [
      {
        code: "PSI",
        title: "Inspección pre-embarque",
        copy: "Revisión del pedido ya terminado, antes de embarcar: cantidades, funcionamiento, acabado y empaque contra la muestra aprobada.",
      },
      {
        code: "DUPRO",
        title: "Inspección durante producción",
        copy: "Verificación con la producción ya iniciada (~20% lista) para corregir desvíos a tiempo, antes de fabricar todo el lote.",
      },
      {
        code: "IPC",
        title: "Inspección inicial de materiales",
        copy: "Control de materias primas y componentes antes de arrancar la fabricación.",
      },
      {
        code: "CLS",
        title: "Supervisión de carga",
        copy: "Acompañamos la carga del contenedor para confirmar cantidades, estado y estiba correcta.",
      },
      {
        code: "PM",
        title: "Monitoreo de producción",
        copy: "Vigilancia continua de la línea durante toda la fabricación, para pedidos críticos o de alto volumen.",
      },
      {
        code: "SAM",
        title: "Toma de muestras",
        copy: "Selección y verificación de muestras representativas bajo norma AQL.",
      },
    ],
  },
  {
    id: "auditorias",
    title: "Auditorías de fábrica y cumplimiento",
    icon: "Shield",
    blurb: "Confirmamos que tu proveedor es legítimo, capaz y cumple los estándares.",
    items: [
      {
        code: "FA",
        title: "Auditoría de fábrica",
        copy: "Confirmamos que la fábrica es real, está operativa y tiene capacidad para tu pedido.",
      },
      {
        code: "SEA",
        title: "Evaluación del proveedor",
        copy: "Diagnóstico integral de capacidad, procesos y confiabilidad del proveedor.",
      },
      {
        code: "SCA",
        title: "Cumplimiento social",
        copy: "Revisión de condiciones laborales y prácticas éticas (estándares tipo SEDEX/SMETA).",
      },
      {
        code: "MSA",
        title: "Sistema de gestión (ISO 9001)",
        copy: "Auditoría del sistema de gestión de calidad del proveedor.",
      },
      {
        code: "PCA",
        title: "Certificación de producto",
        copy: "Auditoría orientada a certificar el producto según el estándar requerido en destino.",
      },
      {
        code: "CRA",
        title: "Verificación de crédito",
        copy: "Chequeo de la salud financiera del proveedor antes de comprometer pagos grandes.",
      },
    ],
  },
  {
    id: "lab-ecommerce",
    title: "Laboratorio y e-commerce",
    icon: "Doc",
    blurb: "Ensayos de laboratorio y preparación para marketplaces como Amazon.",
    items: [
      {
        code: "LAB",
        title: "Pruebas de laboratorio",
        copy: "Coordinamos ensayos (RoHS, CE, FDA y otros) según el mercado de destino de tu producto.",
      },
      {
        code: "FBA",
        title: "Preparación para Amazon",
        copy: "Etiquetado FNSKU y verificación de requisitos del marketplace para que tu carga entre a FBA sin rechazos.",
      },
    ],
  },
];

export type Sigla = { code: string; label: string; plain: string };

/** Glosario de siglas — profundización opcional (se muestra en <details>). */
export const INSPECCION_SIGLAS: { servicios: Sigla[]; acreditaciones: Sigla[] } = {
  servicios: [
    { code: "IPC", label: "Initial Production Check", plain: "Revisión de materiales antes de fabricar." },
    { code: "DUPRO / DPI", label: "During Production Inspection", plain: "Inspección con la producción ya iniciada (~20%)." },
    { code: "PM", label: "Production Monitoring", plain: "Vigilancia diaria de toda la producción." },
    { code: "PSI", label: "Pre-Shipment Inspection", plain: "Revisión del pedido terminado, antes de embarcar." },
    { code: "CLS", label: "Container Loading Supervision", plain: "Supervisión de la carga del contenedor." },
    { code: "SAM", label: "Sampling", plain: "Toma y verificación de muestras." },
    { code: "FA", label: "Factory Audit", plain: "Confirma si la fábrica es real y confiable." },
    { code: "SEA", label: "Supplier Evaluation Audit", plain: "Evaluación integral del proveedor." },
    { code: "PCA", label: "Product Certification Audit", plain: "Auditoría para certificar el producto." },
    { code: "SCA", label: "Social Compliance Audit", plain: "Revisión de condiciones laborales." },
    { code: "MSA", label: "Management System Audit", plain: "Auditoría del sistema de gestión (ISO 9001)." },
    { code: "CRA", label: "Credit Audit", plain: "Verificación de salud financiera del proveedor." },
    { code: "AQL", label: "Acceptable Quality Limit", plain: "Norma para decidir cuántas piezas revisar y los defectos aceptables." },
  ],
  acreditaciones: [
    { code: "ISO 9001", label: "Gestión de calidad", plain: "Estándar internacional de gestión de calidad." },
    { code: "CNAS", label: "China National Accreditation Service", plain: "Organismo chino de acreditación reconocido mundialmente." },
    { code: "ILAC", label: "Intl. Laboratory Accreditation", plain: "Red internacional de acreditación de laboratorios." },
    { code: "SEDEX / SMETA", label: "Comercio ético", plain: "Sistema y auditoría de comercio ético." },
    { code: "APSCA", label: "Auditores de cumplimiento social", plain: "Asociación de auditores de cumplimiento social." },
    { code: "SLCP", label: "Social & Labor Convergence", plain: "Programa de evaluación de condiciones laborales." },
    { code: "FBA / FNSKU", label: "Amazon", plain: "Logística y etiquetado para Amazon." },
  ],
};
