/**
 * Normalizador del Container Tracking API de SeaRates (SDD-0101 · Slice B).
 *
 * PURO (sin red, sin secretos, sin server-only) → testeable con el ejemplo de la
 * doc. Toma el JSON crudo de `GET https://tracking.searates.com/tracking` y extrae
 * el snapshot "vivo" que muestran el ERP y el portal (estado, buque, ETA real,
 * última posición, hitos), más la cuota restante que SeaRates reporta en cada
 * respuesta (`data.metadata.api_calls.remaining`).
 *
 * Contrato confirmado en la doc oficial (docs.searates.com/reference/tracking).
 * Defensivo: cualquier campo puede faltar; nunca tira.
 */

/** Un hito del recorrido del contenedor (evento de SeaRates, aplanado y legible). */
export type TrackingMilestone = {
  /** Descripción del evento ("Vessel Departure", "Discharged", …). */
  description: string;
  /** Fecha del evento (string tal cual de SeaRates, "YYYY-MM-DD HH:mm:ss"). */
  date: string | null;
  /** true = ya ocurrió; false = estimado/futuro. */
  actual: boolean;
  /** Nombre del lugar resuelto (de `data.locations`), o null. */
  location: string | null;
  /** Modo del tramo: 'land' | 'sea' | … (de `event.type`). */
  transportType: string | null;
};

/** Snapshot "vivo" del tracking de SeaRates para un contenedor/BL. */
export type TrackingLive = {
  /** Estado del envío (metadata.status): IN_TRANSIT, DELIVERED, … */
  status: string | null;
  /** SCAC de la naviera (metadata.sealine). */
  sealine: string | null;
  /** Nombre de la naviera (metadata.sealine_name). */
  sealineName: string | null;
  /** Buque actual (vessels[0].name). */
  vessel: string | null;
  /** Salida del POL (route.pol.date) + si ya ocurrió. */
  polDate: string | null;
  polActual: boolean | null;
  /** Arribo al POD: fecha (route.pod.date) + si es real o ETA + ETA predictiva. */
  podEta: string | null;
  podActual: boolean | null;
  podPredictiveEta: string | null;
  /** Última posición conocida (route_data.pin = [lat, lng]). */
  lastLat: number | null;
  lastLng: number | null;
  /** Hitos del recorrido (events del primer contenedor), recientes al final. */
  milestones: TrackingMilestone[];
  /** Llamadas que SeaRates dice que quedan en el plan (metadata.api_calls.remaining). */
  apiCallsRemaining: number | null;
  /** Cuándo SeaRates actualizó el dato (metadata.updated_at). */
  updatedAt: string | null;
  /** Cuándo expira el cache de SeaRates (metadata.cache_expires). */
  cacheExpires: string | null;
  /** ¿La respuesta vino del cache de SeaRates? (metadata.from_cache). */
  fromCache: boolean | null;
};

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/** Mapa id→nombre de `data.locations` (los events/route referencian por id). */
function locationNames(data: Record<string, unknown>): Map<number, string> {
  const map = new Map<number, string>();
  for (const loc of arr(data.locations)) {
    const o = obj(loc);
    if (!o) continue;
    const id = num(o.id);
    const name = str(o.name);
    if (id != null && name) map.set(id, name);
  }
  return map;
}

/** Extrae el primer contenedor con eventos (la mayoría de respuestas trae 1). */
function firstContainerEvents(data: Record<string, unknown>): unknown[] {
  for (const c of arr(data.containers)) {
    const o = obj(c);
    if (o && arr(o.events).length > 0) return arr(o.events);
  }
  return [];
}

/**
 * Normaliza la respuesta cruda del tracking a `TrackingLive`. Devuelve null si el
 * envelope no trae `data` usable (el caller cae al snapshot interno / heurística).
 */
export function normalizeTracking(raw: unknown): TrackingLive | null {
  const root = obj(raw);
  if (!root) return null;
  const data = obj(root.data);
  if (!data) return null;

  const metadata = obj(data.metadata) ?? {};
  const route = obj(data.route) ?? {};
  const pol = obj(route.pol) ?? {};
  const pod = obj(route.pod) ?? {};
  const vessels = arr(data.vessels);
  const firstVessel = obj(vessels[0]) ?? {};
  const routeData = obj(data.route_data) ?? {};
  const pin = arr(routeData.pin);
  const apiCalls = obj(metadata.api_calls) ?? {};
  const locNames = locationNames(data);

  const milestones: TrackingMilestone[] = firstContainerEvents(data)
    .map((e) => obj(e))
    .filter((e): e is Record<string, unknown> => e !== null)
    .map((e) => {
      const locId = num(e.location);
      return {
        description: str(e.description) ?? "—",
        date: str(e.date),
        actual: bool(e.actual) ?? false,
        location: locId != null ? (locNames.get(locId) ?? null) : null,
        transportType: str(e.type),
      };
    });

  return {
    status: str(metadata.status),
    sealine: str(metadata.sealine),
    sealineName: str(metadata.sealine_name),
    vessel: str(firstVessel.name),
    polDate: str(pol.date),
    polActual: bool(pol.actual),
    podEta: str(pod.date),
    podActual: bool(pod.actual),
    podPredictiveEta: str(pod.predictive_eta),
    lastLat: num(pin[0]),
    lastLng: num(pin[1]),
    milestones,
    apiCallsRemaining: num(apiCalls.remaining),
    updatedAt: str(metadata.updated_at),
    cacheExpires: str(metadata.cache_expires),
    fromCache: bool(metadata.from_cache),
  };
}
