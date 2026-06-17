import "server-only";

/**
 * Cliente SeaRates Logistics Explorer · fetch directo (sin dep npm).
 * SDD-0092 Fase 1 — benchmark interno de fletes marítimos FCL/LCL.
 *
 * Patrón espejo de `lib/studio/mail/resend-api.ts`:
 *   - `import "server-only"` → el secreto NUNCA llega al bundle del cliente.
 *   - Mock mode: si faltan envs (SEARATES_API_BASE / SEARATES_PLATFORM_ID /
 *     SEARATES_API_KEY) → todas las llamadas devuelven `{ ok:false,
 *     error:'mock_no_key' }` SIN hacer HTTP request (dev/CI sin gastar cuota).
 *   - Las funciones NUNCA tiran: devuelven una union ok/error.
 *
 * Límite de la cuenta: 100 llamadas/mes (vence 2026-07-17). Por eso el platform
 * token se CACHEA en memoria (módulo-level con expiración) para no quemar auth
 * en cada consulta de rate.
 *
 * ⚠️ La API REAL es GraphQL (confirmado en docs.searates.com/reference/logistics):
 *   - Auth (confirmado): GET https://www.searates.com/auth/platform-token?
 *     id=<PLATFORM_ID>&api_key=<API_KEY> → devuelve un token Bearer.
 *   - Rates (confirmado endpoint): POST https://rates.searates.com/graphql con
 *     `{ query, variables }` y header `Authorization: Bearer <token>`. Variables:
 *     pointIdFrom/pointIdTo ("P_<n>"), shippingType (FCL|LCL), container (FCL),
 *     date (YYYY-MM-DD), weight/weightUnit, volume/volumeUnit.
 *   - La QUERY GraphQL exacta + el shape fino de la respuesta NO están en la doc
 *     → la query es best-effort y la respuesta normalizada incluye `raw` (JSON
 *     crudo) para ajustar el mapeo en la validación en vivo. Buscar
 *     `// TODO: confirmar query/campos con respuesta real`.
 */

import type {
  SeaRatesQuoteInput,
  SeaRatesRate,
} from "./searates-types";
import { validateSeaRatesInput } from "./searates-types";

/** Auth vive en www.searates.com (confirmado). Fijo, no configurable. */
const AUTH_BASE = "https://www.searates.com";

const TIMEOUT_MS = 12_000;

/** Margen para refrescar el token antes de su expiración real (anti-borde). */
const TOKEN_SKEW_MS = 60_000;
/** TTL por defecto del token cacheado si el proveedor no informa expiración. */
const DEFAULT_TOKEN_TTL_MS = 50 * 60_000; // 50 min

// ── Caché del platform token (módulo-level, en memoria) ───────────
type CachedToken = { token: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

/** Solo para tests: limpiar la caché entre casos. No usar en producción. */
export function __resetSeaRatesTokenCacheForTests(): void {
  tokenCache = null;
}

function envConfig(): { base: string; platformId: string; apiKey: string } | null {
  const base = process.env.SEARATES_API_BASE;
  const platformId = process.env.SEARATES_PLATFORM_ID;
  const apiKey = process.env.SEARATES_API_KEY;
  if (!base || !platformId || !apiKey) return null;
  return { base: base.replace(/\/+$/, ""), platformId, apiKey };
}

/** fetch con timeout vía AbortController (patrón `timedFetch` de integration-health). */
async function timedFetch(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body?: unknown; text?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      // Sin caché de Next: estos son datos vivos de un proveedor de pago.
      cache: "no-store",
    });
    clearTimeout(timer);
    const text = await res.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      /* respuesta no-JSON · queda `text` */
    }
    return { ok: res.ok, status: res.status, body, text };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Extrae el token de la respuesta del auth endpoint. El shape exacto no está
 * confirmado → probamos las llaves más probables y caemos a string plano.
 */
function extractToken(body: unknown, text?: string): { token: string; ttlMs?: number } | null {
  if (typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    const candidate =
      o.token ?? o.access_token ?? o.platform_token ?? o.jwt ?? o.bearer ?? o.id_token;
    if (typeof candidate === "string" && candidate.trim()) {
      const expiresIn = o.expires_in ?? o.expiresIn;
      const ttlMs =
        typeof expiresIn === "number" && expiresIn > 0 ? expiresIn * 1000 : undefined;
      return { token: candidate.trim(), ttlMs };
    }
  }
  // Algunos endpoints devuelven el token como texto plano (no JSON).
  if (typeof text === "string") {
    const t = text.trim().replace(/^"|"$/g, "");
    // Heurística simple: un token tiene largo razonable y sin espacios.
    if (t && t.length >= 16 && !/\s/.test(t)) return { token: t };
  }
  return null;
}

/**
 * Obtiene (o reutiliza) el platform token. Cachea en memoria con expiración.
 * Devuelve `null` si:
 *   - faltan envs (modo mock), o
 *   - el auth endpoint falló / no devolvió token.
 *
 * NUNCA tira.
 */
export async function getPlatformToken(): Promise<string | null> {
  const cfg = envConfig();
  if (!cfg) return null; // mock mode

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - TOKEN_SKEW_MS > now) {
    return tokenCache.token;
  }

  const url = `${AUTH_BASE}/auth/platform-token?id=${encodeURIComponent(
    cfg.platformId,
  )}&api_key=${encodeURIComponent(cfg.apiKey)}`;

  const r = await timedFetch(url, { method: "GET" });
  if (!r.ok) return null;

  const extracted = extractToken(r.body, r.text);
  if (!extracted) return null;

  tokenCache = {
    token: extracted.token,
    expiresAt: now + (extracted.ttlMs ?? DEFAULT_TOKEN_TTL_MS),
  };
  return extracted.token;
}

/**
 * Query GraphQL del Logistics Explorer (best-effort). SeaRates expone el
 * explorador de tarifas vía un query raíz que recibe las variables confirmadas
 * y devuelve una lista de ofertas con los campos confirmados (totalPrice,
 * totalCurrency, provider, totalTransitTime, flags, validez, shipmentId).
 *
 * El NOMBRE del campo raíz y la forma EXACTA de la selección NO están en la doc
 * pública → esto es la mejor aproximación. Si la respuesta trae `errors[]`,
 * `getOceanRate` lo devuelve como `graphql_error` + el `raw` para corregir acá.
 *
 * // TODO: confirmar query/campos con respuesta real (nombre del campo raíz,
 * //       nombres exactos de selección, paginación). El `raw` queda expuesto
 * //       en /studio/debug → SeaRates para ajustar esto en vivo.
 */
const OCEAN_RATES_QUERY = /* GraphQL */ `
  query OceanRates(
    $pointIdFrom: String!
    $pointIdTo: String!
    $shippingType: ShippingType!
    $container: Container
    $date: String
    $weight: Float
    $weightUnit: WeightUnit
    $volume: Float
    $volumeUnit: VolumeUnit
  ) {
    rates(
      pointIdFrom: $pointIdFrom
      pointIdTo: $pointIdTo
      shippingType: $shippingType
      container: $container
      date: $date
      weight: $weight
      weightUnit: $weightUnit
      volume: $volume
      volumeUnit: $volumeUnit
    ) {
      totalPrice
      totalCurrency
      provider
      totalTransitTime
      spot
      indicative
      expired
      individual
      validityFrom
      validityTo
      shipmentId
      points {
        type
        name
        location
      }
    }
  }
`;

/** Construye las `variables` del request GraphQL desde el input validado. */
function buildVariables(input: SeaRatesQuoteInput): Record<string, unknown> {
  const variables: Record<string, unknown> = {
    pointIdFrom: input.pointIdFrom,
    pointIdTo: input.pointIdTo,
    shippingType: input.shippingType,
  };
  if (input.shippingType === "FCL" && input.container) {
    variables.container = input.container;
  }
  if (input.date) variables.date = input.date;
  if (input.weightKg !== undefined) {
    variables.weight = input.weightKg;
    variables.weightUnit = "KG";
  }
  if (input.volumeM3 !== undefined) {
    variables.volume = input.volumeM3;
    variables.volumeUnit = "M3";
  }
  return variables;
}

/**
 * Normaliza el bloque `data` de la respuesta GraphQL a los campos confirmados.
 * Best-effort: el path/forma exactos NO están confirmados, así que buscamos la
 * primera lista de ofertas dentro de `data` (sea cual sea el nombre del campo
 * raíz) y mapeamos por nombre de campo confirmado. SIEMPRE se devuelve `raw`.
 * Si no encontramos ninguna tarifa → `null` (el caller responde 'no_rate').
 *
 * // TODO: confirmar query/campos con respuesta real (ajustar paths si el campo
 * //       raíz no es `rates` o la oferta no es un array).
 */
function normalizeRate(data: unknown): {
  rateUsd: number | null;
  currency: string | null;
  transitDays: number | null;
  carrier: string | null;
  validityTo: string | null;
  spot: boolean | null;
  indicative: boolean | null;
  expired: boolean | null;
} | null {
  const offer = firstOffer(data);
  if (!offer) return null;

  const rateUsd = pickNumber(offer, [
    "totalPrice",
    "total_price",
    "totalRate",
    "price",
    "amount",
    "rate",
  ]);
  const currency = pickString(offer, ["totalCurrency", "total_currency", "currency"]);
  const transitDays = pickNumber(offer, [
    "totalTransitTime",
    "total_transit_time",
    "transitTime",
    "transit_time",
    "transitDays",
    "days",
  ]);
  const carrier = pickString(offer, [
    "provider",
    "carrier",
    "carrierName",
    "shippingLine",
    "line",
  ]);
  const validityTo = pickString(offer, ["validityTo", "validity_to", "validTo"]);
  const spot = pickBoolean(offer, ["spot"]);
  const indicative = pickBoolean(offer, ["indicative"]);
  const expired = pickBoolean(offer, ["expired"]);

  if (
    rateUsd === null &&
    transitDays === null &&
    carrier === null &&
    currency === null
  ) {
    return null;
  }
  return { rateUsd, currency, transitDays, carrier, validityTo, spot, indicative, expired };
}

/**
 * Encuentra la primera oferta dentro del bloque `data`: si algún campo raíz es
 * un array, toma su primer elemento; si es un objeto con forma de oferta, lo
 * toma; si `data` ya parece una oferta, lo devuelve. Best-effort.
 */
function firstOffer(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;

  // `data` ya es una oferta (tiene algún campo confirmado).
  if (looksLikeOffer(o)) return o;

  for (const v of Object.values(o)) {
    if (Array.isArray(v)) {
      const first = v.find((x) => x && typeof x === "object");
      if (first) return first as Record<string, unknown>;
    } else if (v && typeof v === "object" && looksLikeOffer(v as Record<string, unknown>)) {
      return v as Record<string, unknown>;
    }
  }
  return null;
}

const OFFER_MARKERS = [
  "totalPrice",
  "total_price",
  "totalCurrency",
  "provider",
  "totalTransitTime",
  "shipmentId",
];
function looksLikeOffer(o: Record<string, unknown>): boolean {
  return OFFER_MARKERS.some((k) => k in o);
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
      return Number(v);
  }
  return null;
}

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickBoolean(o: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
  }
  return null;
}

/** Extrae el primer mensaje de error de un `errors[]` GraphQL. */
function firstGraphqlError(errors: unknown): string | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const m = (first as Record<string, unknown>).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return "graphql error";
}

/**
 * Consulta una tarifa de flete marítimo (FCL o LCL) vía GraphQL.
 *
 * Flujo:
 *   1. Sin envs → `{ ok:false, error:'mock_no_key' }` (sin fetch).
 *   2. Input inválido → `{ ok:false, error:'invalid_input' }` (sin fetch).
 *   3. Token (cacheado) → si no se obtiene → `{ ok:false, error:'auth_failed' }`.
 *   4. POST GraphQL `{ query, variables }` a `SEARATES_API_BASE` con Bearer.
 *   5. Si la respuesta trae `errors[]` → `{ ok:false, error:'graphql_error',
 *      code:<1er msg>, raw }`. Si no, normaliza `data` best-effort.
 *   6. SIEMPRE devuelve `raw` (también en errores de proveedor) para ajustar.
 *
 * NUNCA tira. Gasta como máximo 1 llamada de rates + (a lo sumo) 1 de auth.
 *
 * // TODO: confirmar query/campos con respuesta real (ver OCEAN_RATES_QUERY).
 */
export async function getOceanRate(
  rawInput: Partial<Record<keyof SeaRatesQuoteInput, unknown>>,
): Promise<SeaRatesRate> {
  const cfg = envConfig();
  if (!cfg) return { ok: false, error: "mock_no_key" };

  const { input, fieldErrors } = validateSeaRatesInput(rawInput);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { ok: false, error: "invalid_input", code: first };
  }

  const token = await getPlatformToken();
  if (!token) return { ok: false, error: "auth_failed" };

  // POST GraphQL: { query, variables }. El endpoint es el SEARATES_API_BASE
  // completo (https://rates.searates.com/graphql), sin sufijo de path.
  const requestBody = {
    query: OCEAN_RATES_QUERY,
    variables: buildVariables(input),
  };

  const r = await timedFetch(cfg.base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const raw = r.body ?? r.text ?? null;

  if (r.error) return { ok: false, error: `network: ${r.error}` };
  if (!r.ok) {
    const detail =
      typeof r.body === "object" && r.body !== null
        ? pickString(r.body as Record<string, unknown>, ["message", "error", "detail"])
        : null;
    return { ok: false, error: `http_${r.status}`, code: detail ?? undefined, raw };
  }

  // GraphQL puede responder 200 con un bloque `errors[]` (la consulta falló).
  const envelope =
    typeof r.body === "object" && r.body !== null
      ? (r.body as Record<string, unknown>)
      : null;
  const gqlError = envelope ? firstGraphqlError(envelope.errors) : undefined;
  if (gqlError) {
    return { ok: false, error: "graphql_error", code: gqlError, raw };
  }

  const normalized = normalizeRate(envelope?.data ?? envelope);
  if (!normalized) {
    // 2xx OK pero no pudimos parsear una tarifa. Devolvemos raw igual.
    return { ok: false, error: "no_rate", code: undefined, raw };
  }

  return {
    ok: true,
    mode: input.shippingType,
    rateUsd: normalized.rateUsd,
    currency: normalized.currency,
    transitDays: normalized.transitDays,
    carrier: normalized.carrier,
    validityTo: normalized.validityTo,
    spot: normalized.spot,
    indicative: normalized.indicative,
    expired: normalized.expired,
    raw,
  };
}
