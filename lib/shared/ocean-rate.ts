/**
 * Tipos + catálogo + validación del cotizador público de fletes (SDD-0095 Fase 2).
 *
 * Vive en `lib/shared/` = el ÚNICO puente público↔ERP permitido por ESLint. Es
 * código PURO (sin Supabase, sin imports del ERP ni del sitio): lo usan a la vez
 * el sitio público (UI + API route), `lib/public/` (lectura cacheada) y el ERP
 * (cron que llena la caché).
 *
 * Candado de país (regla founder 2026-06-17): origen = puertos de CHINA; destino
 * = puertos de VENEZUELA + SOLO Barranquilla (Colombia). Ningún otro país aparece.
 * Fase 2 (slice B) expandirá el catálogo a TODOS los puertos vía un resolver
 * nombre→ID; este slice arranca con las rutas principales (las que el cron cachea).
 */

export type OceanShippingType = "FCL" | "LCL";
export type OceanCountry = "CN" | "VE" | "CO";
export type OceanRateStatus = "ok" | "no_rate" | "error";

/**
 * Punto del cotizador público. `id` = slug estable (clave de caché + value del
 * <select>). `lat`/`lng` = coords [lat,lng] para la query a SeaRates
 * (`coordinatesFrom/To`) → agregar un puerto = sumar su lat/lng, sin cazar el `P_<n>`.
 */
export type OceanPoint = {
  id: string;
  name: string;
  country: OceanCountry;
  lat: number;
  lng: number;
};

/**
 * Contenedores FCL ofrecidos al público (subconjunto curado del enum de SeaRates;
 * el enum completo de 25 valores vive en `lib/studio/searates/searates-types.ts`).
 */
export const OCEAN_CONTAINERS = ["ST20", "ST40", "HC40", "REF20", "REF40"] as const;
export type OceanContainer = (typeof OCEAN_CONTAINERS)[number];

/**
 * Catálogo de puntos permitidos (= allowlist del candado de país). Origen China,
 * destino Venezuela + Barranquilla. Coords [lat,lng] validadas EN VIVO contra
 * SeaRates (todas devuelven tarifas reales). La query usa `coordinatesFrom/To`, así
 * que sumar un puerto = agregar su lat/lng (no hace falta cazar el `P_<n>`).
 */
export const OCEAN_ORIGINS: readonly OceanPoint[] = [
  { id: "nansha", name: "Nansha", country: "CN", lat: 22.76, lng: 113.62 },
  { id: "shekou", name: "Shekou", country: "CN", lat: 22.48, lng: 113.9 },
  { id: "ningbo", name: "Ningbo", country: "CN", lat: 29.87, lng: 121.83 },
  { id: "shanghai", name: "Shanghai", country: "CN", lat: 31.23, lng: 121.49 },
  { id: "qingdao", name: "Qingdao", country: "CN", lat: 36.08, lng: 120.32 },
];

export const OCEAN_DESTINATIONS: readonly OceanPoint[] = [
  { id: "la-guaira", name: "La Guaira", country: "VE", lat: 10.6, lng: -66.93 },
  { id: "puerto-cabello", name: "Puerto Cabello", country: "VE", lat: 10.48, lng: -68.01 },
  { id: "guanta", name: "Guanta", country: "VE", lat: 10.24, lng: -64.59 },
  { id: "barranquilla", name: "Barranquilla", country: "CO", lat: 11.0, lng: -74.8 },
];

const ORIGIN_IDS = new Set(OCEAN_ORIGINS.map((p) => p.id));
const DEST_IDS = new Set(OCEAN_DESTINATIONS.map((p) => p.id));

/** Busca un punto (origen o destino) por ID. */
export function findOceanPoint(id: string): OceanPoint | undefined {
  const norm = id.trim().toLowerCase();
  return (
    OCEAN_ORIGINS.find((p) => p.id === norm) ??
    OCEAN_DESTINATIONS.find((p) => p.id === norm)
  );
}

/** Entrada de una consulta del cotizador público. */
export type OceanRouteInput = {
  pointIdFrom: string;
  pointIdTo: string;
  shippingType: OceanShippingType;
  /** Requerido si shippingType === 'FCL'. */
  container?: OceanContainer;
};

export type OceanRouteFieldErrors = Partial<
  Record<keyof OceanRouteInput, string>
>;

export type OceanRouteValidation =
  | { input: OceanRouteInput; fieldErrors?: undefined }
  | { input?: undefined; fieldErrors: OceanRouteFieldErrors };

const POINT_ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Valida + normaliza una consulta pública con candado de país: el origen debe ser
 * un puerto de China del catálogo y el destino un puerto de Venezuela/Barranquilla
 * del catálogo. FCL exige un contenedor del set público. Sin Zod (convención repo).
 */
export function validateOceanRouteInput(
  partial: Partial<Record<keyof OceanRouteInput, unknown>>,
): OceanRouteValidation {
  const fieldErrors: OceanRouteFieldErrors = {};

  const pointIdFrom = String(partial.pointIdFrom ?? "").trim().toLowerCase();
  const pointIdTo = String(partial.pointIdTo ?? "").trim().toLowerCase();
  const shippingTypeRaw = String(partial.shippingType ?? "").trim().toUpperCase();

  if (!pointIdFrom) fieldErrors.pointIdFrom = "Indica el puerto de origen.";
  else if (!POINT_ID_RE.test(pointIdFrom) || !ORIGIN_IDS.has(pointIdFrom))
    fieldErrors.pointIdFrom = "Origen no disponible (solo puertos de China habilitados).";

  if (!pointIdTo) fieldErrors.pointIdTo = "Indica el puerto de destino.";
  else if (!POINT_ID_RE.test(pointIdTo) || !DEST_IDS.has(pointIdTo))
    fieldErrors.pointIdTo = "Destino no disponible (Venezuela o Barranquilla).";

  // Este cotizador es SOLO FCL (full container). El LCL público vive en
  // /calculadora (decisión founder 2026-06-20). Rechazamos cualquier otro modo.
  let shippingType: OceanShippingType | null = null;
  if (shippingTypeRaw === "FCL") shippingType = "FCL";
  else fieldErrors.shippingType = "Este cotizador es solo para contenedor completo (FCL).";

  // Contenedor SIEMPRE requerido (es FCL).
  let container: OceanContainer | undefined;
  if (shippingType === "FCL") {
    const c = String(partial.container ?? "").trim().toUpperCase();
    if (!c) fieldErrors.container = "Elige el tipo de contenedor.";
    else if (!(OCEAN_CONTAINERS as readonly string[]).includes(c))
      fieldErrors.container = "Contenedor no disponible.";
    else container = c as OceanContainer;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const input: OceanRouteInput = {
    pointIdFrom,
    pointIdTo,
    shippingType: shippingType as OceanShippingType,
  };
  if (container) input.container = container;
  return { input };
}

/**
 * Tarifa pública normalizada (lo que devuelve la RPC / el API route al sitio).
 * `status` ≠ 'ok' → no hay tarifa usable para esa ruta (se muestra "no disponible").
 */
export type PublicOceanRate = {
  rateUsd: number | null;
  currency: string | null;
  transitDays: number | null;
  carrier: string | null;
  offersCount: number | null;
  validTo: string | null;
  indicative: boolean | null;
  spot: boolean | null;
  status: OceanRateStatus;
  /** ISO timestamp de cuándo el cron cacheó esta tarifa (frescura). */
  fetchedAt: string | null;
};

/**
 * Disclaimer corto para el sitio (≈285c). Fuente: docs/marketing/condiciones-
 * cotizacion.md. El precio es REFERENCIAL (white-label: nunca se nombra al
 * proveedor ni a la naviera), calza con "Pagas al llegar*".
 */
export const OCEAN_RATE_DISCLAIMER =
  "Precio estimado, para que te orientes. El monto final se confirma al reservar " +
  "y puede variar según el cupo, la fecha de salida, la temporada y tu tipo de " +
  "carga. Los tiempos de tránsito los define la naviera. ¿Lo quieres en firme? " +
  "Escríbenos y un asesor te lo cierra.";
