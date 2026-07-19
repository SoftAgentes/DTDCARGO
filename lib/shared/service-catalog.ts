/**
 * Catálogo canónico de servicios — claves + estructura COMPARTIDAS público ↔ ERP.
 *
 * Por qué existe (SDD-0076): hoy hay DOS catálogos de "servicio" desincronizados:
 *   - Marketing/público: `lib/servicios-detalle.ts` (fichas con copy) + `lib/design-tokens.ts` legacy.
 *   - Operacional/ERP: el enum `ShipmentService` (solo 4) que mueve tarifa/OV/factura/cobro.
 * No había una fuente única que reconciliara ambos. Este archivo es esa fuente para la
 * ESTRUCTURA y las CLAVES (id, tipo núcleo/add-on, grupo, sede, posición en el timeline,
 * mapeo→ShipmentService). El CONTENIDO editable (descripción, alcance, FAQ, precio, cobro,
 * adicionales) NO vive acá: va en la DB del ERP (tablas `service_configs` + hijas, Fase 2),
 * editable sin deploy, unido a este catálogo por `id`.
 *
 * Vive en `lib/shared/` porque lo necesitan AMBOS lados: el sitio público (orden/grupos/sede)
 * y el Studio (qué servicios configurar). Cumple el criterio de admisión de `shipment-public.ts`.
 *
 * Regla de oro (heredada de 0063): NO INVENTAR. Acá solo van claves y clasificación estable.
 */

import type { ShipmentService } from "./shipment-public";

/** Identificador estable de cada servicio. Une los 3 mundos (web, ERP, legal). */
export type ServicioId =
  | "puerta-a-puerta-ddp"
  | "lcl-consolidado"
  | "fcl-bodega"
  | "fcl-directo"
  | "transporte-terrestre"
  | "transito-aduana"
  | "documentos-importacion"
  | "revision-recepcion"
  | "etiquetado-piezas"
  | "reempaque-defectuosas"
  | "inspeccion-calidad"
  | "verificacion-proveedores"
  | "auditoria-calidad"
  | "lab-permisologia"
  | "compra-asistida"
  | "asesoria-pagos"
  | "muestras-courier"
  | "visado-chino"
  | "registro-marca-cn"
  | "cursos-importacion";

/** Núcleo = mueve un embarque (tiene tarifa, OV, factura, cobro, gate legal). Add-on = servicio suelto. */
export type ServicioTipo = "nucleo" | "addon";

export type ServicioSede = "cn" | "ve" | "ambas";

export type ServicioGrupo =
  | "transporte"
  | "bodega"
  | "origen"
  | "tramites"
  | "formacion";

/** Dónde entra el servicio en el flujo de la operación (decisión founder 2026-06-13). */
export type MomentoTimeline =
  | "todo_recorrido" // DDP: origen → puerta, todo el recorrido
  | "origen" // China, antes de bodega (sourcing, inspección, compra)
  | "recepcion_bodega" // al recibir en la bodega de Yiwu
  | "transporte_aduana" // después de bodega (flete, aduana, entrega)
  | "transversal"; // sin posición fija en el flujo

/** Mismos estados que `ServicioDetalle.estado` en lib/servicios-detalle.ts (continuidad). */
export type ServicioEstado = "activo" | "suspendido" | "a-pedido" | "proximamente";

export type ServiceCatalogEntry = {
  id: ServicioId;
  nombre: string;
  /**
   * Slug histórico en lib/servicios-detalle.ts (continuidad del #hash de /servicios).
   * `null` = servicio nuevo sin ficha previa (ej. cursos-importacion).
   */
  legacySlug: string | null;
  tipo: ServicioTipo;
  grupo: ServicioGrupo;
  sede: ServicioSede;
  momentoTimeline: MomentoTimeline;
  /**
   * Enum operacional — SOLO los núcleo (mueven embarque/tienen tarifa+OV+factura). `null` en add-ons.
   * OJO: el mapeo es N:1, no 1:1 — `fcl-bodega` y `fcl-directo` comparten `reserva_FCL`.
   */
  shipmentService: ShipmentService | null;
  /** Servicio insignia (realce visual en /servicios). */
  principal: boolean;
  estado: ServicioEstado;
  /** Orden de presentación (1..N), global. */
  orden: number;
};

/** Grupos para el índice de salto / render por sección. Orden = viaje de la carga + extras. */
export const SERVICE_GROUPS: { id: ServicioGrupo; titulo: string }[] = [
  { id: "transporte", titulo: "Transporte de China a tu puerta" },
  { id: "bodega", titulo: "En bodega: revisión y preparación" },
  { id: "origen", titulo: "Calidad y proveedores en origen" },
  { id: "tramites", titulo: "Trámites y legal" },
  { id: "formacion", titulo: "Formación" },
];

/**
 * Las 20 entradas del catálogo. Es la reconciliación de los 19 de marketing + Cursos (nuevo).
 * Los 5 núcleo cubren los 4 valores de `ShipmentService` (reserva_FCL se comparte).
 */
export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  // ── Transporte ───────────────────────────────────────────────────
  {
    id: "puerta-a-puerta-ddp",
    nombre: "Puerta a puerta DDP",
    legacySlug: "dtd-services-lcl",
    tipo: "nucleo",
    grupo: "transporte",
    sede: "ambas",
    momentoTimeline: "todo_recorrido",
    shipmentService: "puerta_a_puerta_DDP",
    principal: true,
    estado: "activo",
    orden: 1,
  },
  {
    id: "lcl-consolidado",
    nombre: "LCL Consolidado (carga compartida, con BL propio)",
    legacySlug: "lcl-consolidado",
    tipo: "nucleo",
    grupo: "transporte",
    sede: "ambas",
    momentoTimeline: "transporte_aduana",
    shipmentService: "consolidacion",
    principal: false,
    estado: "activo",
    orden: 2,
  },
  {
    id: "fcl-bodega",
    nombre: "FCL Consolidado en bodega (contenedor completo)",
    legacySlug: "consolidacion-bodega-yiwu",
    tipo: "nucleo",
    grupo: "transporte",
    sede: "cn",
    momentoTimeline: "recepcion_bodega",
    shipmentService: "reserva_FCL",
    principal: false,
    estado: "activo",
    orden: 3,
  },
  {
    id: "fcl-directo",
    nombre: "FCL Directo fábrica (contenedor cargado en origen)",
    legacySlug: "reserva-contenedores",
    tipo: "nucleo",
    grupo: "transporte",
    sede: "cn",
    momentoTimeline: "transporte_aduana",
    shipmentService: "reserva_FCL", // N:1 con fcl-bodega
    principal: false,
    estado: "activo",
    orden: 4,
  },
  {
    id: "transporte-terrestre",
    nombre: "Transporte terrestre nacional",
    legacySlug: "transporte-terrestre", // absorbe el legacy `last-mile` (ver LEGACY_SLUG_ALIASES)
    tipo: "nucleo",
    grupo: "transporte",
    sede: "ve",
    momentoTimeline: "transporte_aduana",
    shipmentService: "transporte_terrestre",
    principal: false,
    estado: "proximamente",
    orden: 5,
  },
  {
    id: "transito-aduana",
    nombre: "Tránsito de aduana y desaduanaje",
    legacySlug: "transito-aduana",
    tipo: "addon",
    grupo: "transporte",
    sede: "ve",
    momentoTimeline: "transporte_aduana",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 6,
  },
  {
    // FUSIONADO en transito-aduana (founder 2026-07-19): sin ficha pública ni
    // tarjeta propia — la gestión documental es un "incluye" de aduana. El id
    // queda para la config del ERP (service_configs, charge-mode, contabilidad).
    id: "documentos-importacion",
    nombre: "Documentos de importación",
    legacySlug: null, // sin ficha pública desde la fusión (ver LEGACY_SLUG_ALIASES)
    tipo: "addon",
    grupo: "transporte",
    sede: "ve",
    momentoTimeline: "transporte_aduana",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 7,
  },
  // ── En bodega (Yiwu) ─────────────────────────────────────────────
  {
    id: "revision-recepcion",
    nombre: "Revisión de mercancía al recibir",
    legacySlug: "revision-recepcion",
    tipo: "addon",
    grupo: "bodega",
    sede: "cn",
    momentoTimeline: "recepcion_bodega",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 8,
  },
  {
    id: "etiquetado-piezas",
    nombre: "Etiquetado por pieza",
    legacySlug: "etiquetado-piezas",
    tipo: "addon",
    grupo: "bodega",
    sede: "cn",
    momentoTimeline: "recepcion_bodega",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 9,
  },
  {
    id: "reempaque-defectuosas",
    nombre: "Cajas defectuosas y reempaque",
    legacySlug: "reempaque-defectuosas",
    tipo: "addon",
    grupo: "bodega",
    sede: "cn",
    momentoTimeline: "recepcion_bodega",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 10,
  },
  // ── Calidad y proveedores en origen ──────────────────────────────
  {
    id: "inspeccion-calidad",
    nombre: "Inspección de calidad",
    legacySlug: "chequeo-etiquetado",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 11,
  },
  {
    id: "verificacion-proveedores",
    nombre: "Verificación de proveedores",
    legacySlug: "verificacion-proveedores",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 12,
  },
  {
    id: "auditoria-calidad",
    nombre: "Auditoría y control de calidad",
    legacySlug: "auditoria-calidad",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 13,
  },
  {
    id: "lab-permisologia",
    nombre: "Lab testing y permisología en China",
    legacySlug: "lab-permisologia",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 14,
  },
  {
    id: "compra-asistida",
    nombre: "Compra asistida / sourcing",
    legacySlug: "compra-asistida",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 15,
  },
  {
    id: "asesoria-pagos",
    nombre: "Asesoría en pagos a proveedores",
    legacySlug: "asesoria-pagos",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "origen",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 16,
  },
  {
    id: "muestras-courier",
    nombre: "Envío de muestras y documentos (courier express)",
    legacySlug: "muestras-courier",
    tipo: "addon",
    grupo: "origen",
    sede: "cn",
    momentoTimeline: "transversal",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 17,
  },
  // ── Trámites y legal ─────────────────────────────────────────────
  {
    id: "visado-chino",
    nombre: "Gestión de visado de negocios chino",
    legacySlug: "visado-chino",
    tipo: "addon",
    grupo: "tramites",
    sede: "ve",
    momentoTimeline: "transversal",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 18,
  },
  {
    id: "registro-marca-cn",
    nombre: "Registro de marca en China (CNIPA)",
    legacySlug: "registro-marca-cn", // absorbe el legacy `registro-marca-coord` (ver LEGACY_SLUG_ALIASES)
    tipo: "addon",
    grupo: "tramites",
    sede: "ambas",
    momentoTimeline: "transversal",
    shipmentService: null,
    principal: false,
    estado: "activo",
    orden: 19,
  },
  // ── Formación ────────────────────────────────────────────────────
  {
    id: "cursos-importacion",
    nombre: "Cursos de importación",
    legacySlug: null, // servicio nuevo; contenido lo define la ventana del curso Alibaba (dep. cross-ventana)
    tipo: "addon",
    grupo: "formacion",
    sede: "ambas",
    momentoTimeline: "transversal",
    shipmentService: null,
    principal: false,
    estado: "proximamente",
    orden: 20,
  },
];

/** Índice id → entrada, para lookups rápidos. */
export const SERVICE_CATALOG_BY_ID: Record<ServicioId, ServiceCatalogEntry> =
  Object.fromEntries(SERVICE_CATALOG.map((s) => [s.id, s])) as Record<
    ServicioId,
    ServiceCatalogEntry
  >;

/**
 * Slugs legacy (de `lib/design-tokens.ts`) que NO son servicio propio → su id canónico.
 * Documenta las fusiones; útil para redirects/anclas cuando el sitio migre (Fase 3).
 *   - `last-mile` = la entrega final → Transporte terrestre (o incluida en DDP).
 *   - `registro-marca-coord` = el mismo registro de marca, visto desde VE.
 *   - `documentos-importacion` = fusión founder 2026-07-19: la gestión documental
 *     va DENTRO del Tránsito de aduana (la ficha pública ya no existe).
 */
export const LEGACY_SLUG_ALIASES: Record<string, ServicioId> = {
  "last-mile": "transporte-terrestre",
  "registro-marca-coord": "registro-marca-cn",
  "documentos-importacion": "transito-aduana",
};

/** Solo los núcleo (transporte que mueve embarque). */
export const NUCLEO_SERVICES: ServiceCatalogEntry[] = SERVICE_CATALOG.filter(
  (s) => s.tipo === "nucleo",
);

/**
 * Lookup inverso ShipmentService → ids del catálogo. Devuelve array porque el mapeo
 * es N:1 (reserva_FCL ← fcl-bodega + fcl-directo).
 */
export function serviceIdsForShipment(svc: ShipmentService): ServicioId[] {
  return SERVICE_CATALOG.filter((s) => s.shipmentService === svc).map(
    (s) => s.id,
  );
}
