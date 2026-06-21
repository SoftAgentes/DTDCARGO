/**
 * Tipos + validación del cliente SeaRates Logistics Explorer (fletes marítimos).
 * SDD-0092 Fase 1.
 *
 * Rol: BENCHMARK INTERNO. El rate de SeaRates es referencia para el costing/
 * pricing de DTD, NO el precio final al cliente (el cliente sigue viendo el
 * modelo DDP puerta a puerta). Fase 1 vive 100% adentro del Studio (admin),
 * NO toca el sitio público.
 *
 * Sin Zod (convención del repo): validación manual con `validateSeaRatesInput`.
 *
 * ⚠️ API REAL = GraphQL (confirmado en docs.searates.com/reference/logistics):
 *   - Endpoint: POST https://rates.searates.com/graphql.
 *   - Variables del request: pointIdFrom / pointIdTo (IDs de punto string
 *     "P_<n>"), shippingType (enum FCL|LCL|...), container (enum FCL: ST20/
 *     ST40/HC40/...), date (YYYY-MM-DD), weight+weightUnit, volume+volumeUnit.
 *   - Respuesta: totalPrice (Float), totalCurrency (String), provider (String =
 *     naviera), totalTransitTime (Int = días), flags spot/indicative/expired/
 *     individual, validityFrom/validityTo (YYYY-MM-DD), shipmentId.
 *   - La query EXACTA + el shape fino de la respuesta NO están en la doc →
 *     normalización best-effort + `raw` SIEMPRE expuesto para ajustar en vivo.
 */

export type SeaRatesMode = "FCL" | "LCL";

/**
 * Catálogo de contenedores (enum de SeaRates para shippingType=FCL). Lista
 * abierta (string &) para no quedar duros si el proveedor agrega tipos. Los más
 * comunes en la ruta China→Venezuela:
 *   - ST20 = 20' standard · ST40 = 40' standard · HC40 = 40' High Cube
 *   - REF20 / REF40 = reefer (refrigerado) 20'/40'
 */
export type SeaRatesContainer =
  | "ST20"
  | "ST40"
  | "HC40"
  | "REF20"
  | "REF40"
  | (string & {});

/**
 * ID de punto SeaRates: string `"P_<n>"` (P=puerto, A=aeropuerto, C=ciudad).
 * Ej: Nansha P_27395 · La Guaira P_19774 · Puerto Cabello P_19792.
 */
export type SeaRatesPointId = `P_${number}` | `A_${number}` | `C_${number}` | (string & {});

/**
 * Entrada de una consulta de tarifa (variables del request GraphQL).
 * - pointIdFrom / pointIdTo: IDs de punto SeaRates "P_<n>" (Fase 2 mapeará
 *   nombre→ID; Fase 1 el operador los ingresa a mano).
 * - shippingType: FCL | LCL.
 * - container: requerido si shippingType === 'FCL' (enum ST20/ST40/HC40/...).
 * - date: fecha de salida YYYY-MM-DD (opcional; el proveedor usa hoy si falta).
 * - weightKg / volumeM3: relevantes para LCL (peso/volumen de la carga suelta).
 */
export type SeaRatesQuoteInput = {
  /** Origen/destino por ID de punto "P_<n>" (probe admin) O por coordenadas. */
  pointIdFrom?: SeaRatesPointId;
  pointIdTo?: SeaRatesPointId;
  /** Coordenadas [lat, lng] (alternativa a pointId; el cron del cotizador las usa). */
  coordsFrom?: readonly [number, number];
  coordsTo?: readonly [number, number];
  shippingType: SeaRatesMode;
  container?: SeaRatesContainer;
  date?: string;
  weightKg?: number;
  volumeM3?: number;
};

/**
 * Resultado normalizado de una consulta. Union ok/error (patrón Resend/Telegram:
 * el cliente NUNCA tira, siempre devuelve este shape).
 *
 * Mapeo de la respuesta GraphQL de SeaRates:
 *   - rateUsd      ← totalPrice (Float)
 *   - currency     ← totalCurrency (String)
 *   - carrier      ← provider (String = naviera)
 *   - transitDays  ← totalTransitTime (Int)
 *   - validityTo   ← validityTo (YYYY-MM-DD)
 *   - spot / indicative / expired / individual ← flags Boolean
 *
 * `raw` lleva el JSON crudo del proveedor: la query/campos exactos de SeaRates
 * NO están 100% confirmados, así que la normalización es best-effort y `raw`
 * permite ajustar el mapeo durante la validación en vivo sin tocar el route
 * handler ni la UI.
 *
 * Errores conocidos en `error`:
 *   - 'mock_no_key'      → faltan envs (modo mock, no se hizo fetch)
 *   - 'invalid_input'    → validateSeaRatesInput falló (no se hizo fetch)
 *   - 'auth_failed'      → no se pudo obtener el platform token
 *   - 'graphql_error'    → la respuesta GraphQL trajo errors[] (code = 1er msg)
 *   - 'http_<status>'    → el endpoint GraphQL respondió no-2xx
 *   - 'network: <msg>'   → fallo de red / timeout (AbortController)
 *   - 'no_rate'          → respuesta 2xx OK pero sin tarifa parseable
 */
export type SeaRatesRate =
  | {
      ok: true;
      mode: SeaRatesMode;
      /** Precio de referencia (best-effort; null si no se mapeó). ← totalPrice */
      rateUsd: number | null;
      /** Moneda del precio (best-effort; null si no vino). ← totalCurrency */
      currency: string | null;
      /** Días de tránsito estimados (best-effort; null si no vino). ← totalTransitTime */
      transitDays: number | null;
      /** Naviera / carrier (best-effort; null si no vino). ← provider */
      carrier: string | null;
      /** Fin de validez de la tarifa YYYY-MM-DD (best-effort; null). ← validityTo */
      validityTo: string | null;
      /** Flags del rate (best-effort; null si no vinieron). */
      spot: boolean | null;
      indicative: boolean | null;
      expired: boolean | null;
      /** Cantidad de ofertas que devolvió SeaRates (se reporta la más barata). */
      offersCount: number;
      /** JSON crudo del proveedor para auditar/ajustar el mapeo en vivo. */
      raw: unknown;
    }
  | { ok: false; error: string; code?: string; raw?: unknown };

/**
 * Errores de campo de la validación. Mapea cada campo inválido a un mensaje.
 */
export type SeaRatesFieldErrors = Partial<
  Record<keyof SeaRatesQuoteInput, string>
>;

export type SeaRatesValidation =
  | { input: SeaRatesQuoteInput; fieldErrors?: undefined }
  | { input?: undefined; fieldErrors: SeaRatesFieldErrors };

/**
 * ID de punto SeaRates: prefijo de tipo (P/A/C) + `_` + número. Ej: "P_27395".
 * Tolerante a mayúsc/minúsc en el prefijo; se normaliza a mayúscula.
 */
const POINT_ID_RE = /^[PAC]_\d+$/;

/** Fecha ISO YYYY-MM-DD (validación de forma, no de calendario). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valores válidos del enum `container` de SeaRates (FCL/LAND_FCL/RAIL_FCL),
 * confirmados en la doc oficial (2026-06-17). Validar contra esta lista cierra el
 * paso a inyección — el valor se interpola INLINE en la query GraphQL — y caza
 * typos antes de gastar una llamada de la cuota.
 */
const CONTAINER_VALUES = new Set<string>([
  "ST20", "ST40", "HC40", "REF20", "REF40", "OT20", "OT40", "FL20", "FL40",
  "TA20", "FLC40", "FLC20", "PL20", "PL40", "BU20", "HC45", "ST10", "HCPW20",
  "HC20", "PW20", "HCPW40", "PW40", "HCPW45", "HC48", "HC53",
]);

function parseOptionalNumber(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Parsea coordenadas [lat, lng]; devuelve la tupla válida o null. */
function parseCoords(v: unknown): readonly [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const lat = Number(v[0]);
  const lng = Number(v[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/**
 * Validación manual (sin Zod). Normaliza point IDs (prefijo a mayúscula) y
 * shippingType a upper. Devuelve `{ input }` si todo OK, o `{ fieldErrors }` si
 * hay al menos un error.
 */
export function validateSeaRatesInput(
  partial: Partial<Record<keyof SeaRatesQuoteInput, unknown>>,
): SeaRatesValidation {
  const fieldErrors: SeaRatesFieldErrors = {};

  const shippingTypeRaw = String(partial.shippingType ?? "").trim().toUpperCase();

  // Origen/destino: por coordenadas [lat,lng] (lo que usa el cron del cotizador) O
  // por ID de punto "P_<n>" (probe admin). SeaRates no permite mezclar extremos.
  const usingCoords = partial.coordsFrom != null || partial.coordsTo != null;
  const coordsFrom = parseCoords(partial.coordsFrom);
  const coordsTo = parseCoords(partial.coordsTo);
  let pointIdFrom: string | undefined;
  let pointIdTo: string | undefined;

  if (usingCoords) {
    if (!coordsFrom) fieldErrors.coordsFrom = "Coordenadas de origen inválidas ([lat, lng]).";
    if (!coordsTo) fieldErrors.coordsTo = "Coordenadas de destino inválidas ([lat, lng]).";
  } else {
    pointIdFrom = String(partial.pointIdFrom ?? "").trim().toUpperCase();
    pointIdTo = String(partial.pointIdTo ?? "").trim().toUpperCase();
    if (!pointIdFrom) fieldErrors.pointIdFrom = "Punto de origen requerido.";
    else if (!POINT_ID_RE.test(pointIdFrom))
      fieldErrors.pointIdFrom = "Origen debe ser un ID de punto SeaRates (ej. P_27395).";
    if (!pointIdTo) fieldErrors.pointIdTo = "Punto de destino requerido.";
    else if (!POINT_ID_RE.test(pointIdTo))
      fieldErrors.pointIdTo = "Destino debe ser un ID de punto SeaRates (ej. P_19774).";
  }

  let shippingType: SeaRatesMode | null = null;
  if (shippingTypeRaw === "FCL" || shippingTypeRaw === "LCL")
    shippingType = shippingTypeRaw;
  else fieldErrors.shippingType = "Modo debe ser FCL o LCL.";

  let container: string | undefined;
  if (shippingType === "FCL") {
    container = String(partial.container ?? "").trim().toUpperCase();
    if (!container) fieldErrors.container = "Contenedor requerido para FCL.";
    else if (!CONTAINER_VALUES.has(container))
      fieldErrors.container = "Contenedor no reconocido (ej. ST20, ST40, HC40, REF40).";
  }

  let date: string | undefined;
  if (partial.date != null && String(partial.date).trim() !== "") {
    date = String(partial.date).trim();
    if (!DATE_RE.test(date)) fieldErrors.date = "Fecha debe ser YYYY-MM-DD.";
  }

  const weightKg = parseOptionalNumber(partial.weightKg);
  if (weightKg !== undefined && (Number.isNaN(weightKg) || weightKg <= 0))
    fieldErrors.weightKg = "Peso debe ser un número positivo.";

  const volumeM3 = parseOptionalNumber(partial.volumeM3);
  if (volumeM3 !== undefined && (Number.isNaN(volumeM3) || volumeM3 <= 0))
    fieldErrors.volumeM3 = "Volumen debe ser un número positivo.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const input: SeaRatesQuoteInput = {
    shippingType: shippingType as SeaRatesMode,
  };
  if (usingCoords) {
    input.coordsFrom = coordsFrom!;
    input.coordsTo = coordsTo!;
  } else {
    input.pointIdFrom = pointIdFrom;
    input.pointIdTo = pointIdTo;
  }
  if (container) input.container = container;
  if (date) input.date = date;
  if (weightKg !== undefined && !Number.isNaN(weightKg)) input.weightKg = weightKg;
  if (volumeM3 !== undefined && !Number.isNaN(volumeM3)) input.volumeM3 = volumeM3;

  return { input };
}
