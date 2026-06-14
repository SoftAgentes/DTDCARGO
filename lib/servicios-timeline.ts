/**
 * Join de PRESENTACIÓN para /servicios: agrupa los servicios por el MOMENTO del
 * viaje de la carga (origen → recepción en bodega → transporte y aduana →
 * tu puerta), con "Puerta a puerta DDP" como paraguas (cubre todo el recorrido).
 *
 * Por qué acá y no en servicios-detalle.ts: el contenido (qué incluye, precio…)
 * vive en `lib/servicios-detalle.ts` (estático hoy) o en el ERP vía
 * `getServiciosParaSitio()` (SDD-0076, cuando aterrice). Este módulo NO conoce la
 * fuente — recibe la lista ya resuelta y la ORDENA por el viaje, uniéndola a la
 * clasificación canónica de `lib/shared/service-catalog.ts` (eje `momentoTimeline`).
 *
 * Regla de oro (heredada de 0063/0076): NO INVENTAR. Los párrafos de cada fase
 * REUSAN verbatim los blurbs ya aprobados de `SERVICIOS_GRUPOS`. Lo único nuevo
 * son etiquetas estructurales de navegación ("Paso 1", "Origen · China").
 *
 * Público puro: cero imports de @/lib/studio · @/lib/db · @supabase/*.
 */
import {
  SERVICE_CATALOG,
  type MomentoTimeline,
} from "@/lib/shared/service-catalog";
import {
  SERVICIOS_GRUPOS,
  type ServicioDetalle,
} from "@/lib/servicios-detalle";

/** Las 4 fases visibles del viaje (todo_recorrido = DDP, va aparte como paraguas). */
export type ViajeMomento =
  | "origen"
  | "recepcion_bodega"
  | "transporte_aduana"
  | "transversal";

/** Una fase del viaje, lista para renderizar (cabecera + sus fichas ordenadas). */
export type FaseRender = {
  id: ViajeMomento;
  /** Etiqueta estructural de navegación (no es claim de servicio). */
  eyebrow: string;
  /** Reusado del titulo del grupo aprobado. */
  titulo: string;
  /** Reusado del blurb del grupo aprobado (verbatim). */
  blurb: string;
  servicios: ServicioDetalle[];
};

/** Un nodo del riel del viaje (índice de salto + filtro). */
export type RailNodo = {
  id: "todo" | ViajeMomento;
  label: string;
};

// Blurbs/titulos aprobados, indexados por id de grupo (continuidad de copy).
const GRUPO = Object.fromEntries(SERVICIOS_GRUPOS.map((g) => [g.id, g])) as Record<
  string,
  (typeof SERVICIOS_GRUPOS)[number]
>;

// Metadata fija de cada fase, en ORDEN de viaje. El blurb/titulo salen del grupo
// equivalente (cero copy nuevo); el eyebrow es una etiqueta de navegación.
const FASE_META: Omit<FaseRender, "servicios">[] = [
  {
    id: "origen",
    eyebrow: "Paso 1 · En origen, China",
    titulo: GRUPO.origen?.titulo ?? "Calidad y proveedores en origen",
    blurb: GRUPO.origen?.blurb ?? "",
  },
  {
    id: "recepcion_bodega",
    eyebrow: "Paso 2 · Recepción en bodega",
    titulo: GRUPO.bodega?.titulo ?? "En bodega: revisión y preparación",
    blurb: GRUPO.bodega?.blurb ?? "",
  },
  {
    id: "transporte_aduana",
    eyebrow: "Paso 3 · Transporte y aduana",
    titulo: GRUPO.transporte?.titulo ?? "Transporte de China a tu puerta",
    blurb: GRUPO.transporte?.blurb ?? "",
  },
  {
    id: "transversal",
    eyebrow: "En cualquier punto del viaje",
    titulo: GRUPO.tramites?.titulo ?? "Trámites y legal",
    blurb: GRUPO.tramites?.blurb ?? "",
  },
];

/** Riel del viaje: "Todo" + las 4 fases, en orden. */
export const RAIL_NODOS: RailNodo[] = [
  { id: "todo", label: "Todo el viaje" },
  { id: "origen", label: "Origen · China" },
  { id: "recepcion_bodega", label: "Bodega · Yiwu" },
  { id: "transporte_aduana", label: "Transporte y aduana" },
  { id: "transversal", label: "En cualquier punto" },
];

// Una fila del catálogo → su momento + orden, indexado por TODAS sus claves
// (legacySlug y id) para casar tanto el estático (slug viejo) como un servicio
// que venga del ERP por su id canónico.
type CatalogLite = { momento: MomentoTimeline; orden: number; principal: boolean };
const CATALOGO_POR_CLAVE: Map<string, CatalogLite> = (() => {
  const m = new Map<string, CatalogLite>();
  for (const e of SERVICE_CATALOG) {
    const lite: CatalogLite = {
      momento: e.momentoTimeline,
      orden: e.orden,
      principal: e.principal,
    };
    if (e.legacySlug) m.set(e.legacySlug, lite);
    m.set(e.id, lite);
  }
  return m;
})();

/** Quita campos internos (no se mandan al cliente ni al HTML). */
function aPublico(s: ServicioDetalle): ServicioDetalle {
  // _pendiente es checklist interno: nunca debe viajar al DOM/props del cliente.
  const { _pendiente: _omit, ...pub } = s;
  void _omit;
  return pub;
}

/**
 * Agrupa una lista de servicios por el viaje de la carga.
 * - DDP (momento `todo_recorrido` o `destacado`) sale aparte como paraguas.
 * - Cada servicio cae en su fase; si no está en el catálogo → `transversal`
 *   (fallback robusto a servicios nuevos del ERP).
 * - Dentro de cada fase, orden por `orden` del catálogo.
 * - Fases sin servicios no se devuelven (no se pinta cabecera vacía).
 */
export function agruparPorViaje(servicios: ServicioDetalle[]): {
  ddp: ServicioDetalle | null;
  fases: FaseRender[];
} {
  let ddp: ServicioDetalle | null = null;
  const buckets: Record<ViajeMomento, ServicioDetalle[]> = {
    origen: [],
    recepcion_bodega: [],
    transporte_aduana: [],
    transversal: [],
  };

  for (const raw of servicios) {
    const s = aPublico(raw);
    const cat = CATALOGO_POR_CLAVE.get(s.slug);

    // Paraguas: DDP por momento canónico o por flag destacado (estático).
    if (cat?.momento === "todo_recorrido" || (!cat && s.destacado)) {
      if (!ddp) ddp = s;
      continue;
    }

    const fase: ViajeMomento =
      cat?.momento === "origen" ||
      cat?.momento === "recepcion_bodega" ||
      cat?.momento === "transporte_aduana"
        ? cat.momento
        : "transversal"; // incluye "transversal" y cualquier desconocido
    buckets[fase].push(s);
  }

  const ordenDe = (s: ServicioDetalle) =>
    CATALOGO_POR_CLAVE.get(s.slug)?.orden ?? Number.MAX_SAFE_INTEGER;
  for (const k of Object.keys(buckets) as ViajeMomento[]) {
    buckets[k].sort((a, b) => ordenDe(a) - ordenDe(b));
  }

  const fases: FaseRender[] = FASE_META.map((meta) => ({
    ...meta,
    servicios: buckets[meta.id],
  })).filter((f) => f.servicios.length > 0);

  return { ddp, fases };
}
