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
 * token se CACHEA en memoria (con su `exp` real del JWT) para no quemar auth en
 * cada consulta de rate.
 *
 * API REAL — confirmada EN VIVO 2026-06-17 contra rates.searates.com/graphql
 * (introspección deshabilitada → query fijada con el ejemplo real de la doc):
 *   - Auth: GET https://www.searates.com/auth/platform-token?id=<id>&api_key=<key>
 *     → `{ "s-token": "<JWT>" }`. El JWT lleva `platform` + `exp`.
 *   - Rates: POST https://rates.searates.com/graphql con `{ query }` (args INLINE,
 *     todos validados) y header `Authorization: Bearer <token>`.
 *   - El campo raíz es `rates(...)` y devuelve un ARRAY de ofertas. Cada oferta:
 *       · `general`  → resumen: totalPrice, totalCurrency, totalTransitTime,
 *                      validityFrom/To, spot, indicative, expired, individual,
 *                      shipmentId.
 *       · `points[]` → legs de la ruta; la naviera (`provider`) vive acá.
 *   - includedServices = p2p (puerto-a-puerto): el flete comparable, sin inland.
 *   - `raw` se expone SIEMPRE en /studio/debug para auditar la respuesta cruda.
 */

import type { SeaRatesQuoteInput, SeaRatesRate } from "./searates-types";
import { validateSeaRatesInput } from "./searates-types";

/** Auth vive en www.searates.com (confirmado). Fijo, no configurable. */
const AUTH_BASE = "https://www.searates.com";

const TIMEOUT_MS = 12_000;

/** Margen para refrescar el token antes de su expiración real (anti-borde). */
const TOKEN_SKEW_MS = 60_000;
/** TTL por defecto del token cacheado si NO es un JWT con `exp`. */
const DEFAULT_TOKEN_TTL_MS = 50 * 60_000; // 50 min

/** includedServices para el benchmark: p2p = puerto-a-puerto (flete comparable). */
const INCLUDED_SERVICES = "p2p";

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
 * Extrae el token de la respuesta del auth endpoint.
 *
 * Shape REAL confirmado en vivo (2026-06-17): SeaRates devuelve
 * `{ "s-token": "<JWT>" }` (NO `token`). Probamos `s-token` primero y dejamos
 * los demás como fallback por si cambia el shape; caemos a string plano (no-JSON).
 */
function extractToken(body: unknown, text?: string): { token: string; ttlMs?: number } | null {
  let candidate: unknown = null;
  let expiresIn: unknown;
  if (typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    candidate =
      o["s-token"] ??
      o.token ??
      o.access_token ??
      o.platform_token ??
      o.jwt ??
      o.bearer ??
      o.id_token;
    expiresIn = o.expires_in ?? o.expiresIn;
  }
  // Algunos endpoints devuelven el token como texto plano (no JSON).
  if ((typeof candidate !== "string" || !candidate.trim()) && typeof text === "string") {
    const t = text.trim().replace(/^"|"$/g, "");
    // Heurística simple: un token tiene largo razonable y sin espacios.
    if (t && t.length >= 16 && !/\s/.test(t)) candidate = t;
  }
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const token = candidate.trim();

  // TTL: el token de SeaRates es un JWT → usar su `exp` real (preciso). Si no es
  // JWT, caer a `expires_in` del body; si tampoco, el caller usa el default.
  let ttlMs: number | undefined;
  const expMs = jwtExpMs(token);
  if (expMs) {
    const delta = expMs - Date.now();
    if (delta > 0) ttlMs = delta;
  } else if (typeof expiresIn === "number" && expiresIn > 0) {
    ttlMs = expiresIn * 1000;
  }
  return { token, ttlMs };
}

/** Lee el `exp` (ms epoch) de un JWT sin verificar firma. null si no es JWT con exp. */
function jwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp > 0) return payload.exp * 1000;
  } catch {
    /* no es un JWT parseable */
  }
  return null;
}

/**
 * Obtiene (o reutiliza) el platform token. Cachea en memoria con expiración.
 * Devuelve `null` si faltan envs (modo mock) o el auth falló. NUNCA tira.
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
 * Fecha de zarpe por defecto (~hoy+14d, formato YYYY-MM-DD) para cuando el caller
 * no pasa `date`. SeaRates RECHAZA la query de rates sin fecha (responde 200 con
 * errors:[{message:"Internal server error"}]) → el cron de caché, que no especifica
 * fecha, la necesita. Descubierto en vivo 2026-06-21.
 */
function defaultShipDate(): string {
  return new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Arma la query GraphQL de rates con los args INLINE (no variables).
 *
 * Origen/destino: por coordenadas `[lat,lng]` (cron del cotizador) O por `pointId`
 * "P_<n>" (probe admin). SeaRates exige ambos extremos del mismo tipo (no mezcla).
 *
 * Seguro contra inyección: TODOS los valores vienen de `validateSeaRatesInput`
 * (pointId `^[PAC]_\d+$`, coords numéricas en rango, shippingType ∈ FCL|LCL,
 * container del enum cerrado, date `YYYY-MM-DD`, weight/volume numéricos) → no hay
 * forma de meter comillas, llaves ni espacios. Args inline (no variables) porque la
 * introspección está cerrada (p. ej. `date` es el scalar `Date`, no `String`).
 *
 * El campo raíz `rates` devuelve un ARRAY de ofertas `{ general, points }`.
 */
function buildRatesQuery(input: SeaRatesQuoteInput): string {
  const endpoints =
    input.coordsFrom && input.coordsTo
      ? [
          `coordinatesFrom: [${input.coordsFrom[0]}, ${input.coordsFrom[1]}]`,
          `coordinatesTo: [${input.coordsTo[0]}, ${input.coordsTo[1]}]`,
        ]
      : [`pointIdFrom: "${input.pointIdFrom}"`, `pointIdTo: "${input.pointIdTo}"`];
  const args: string[] = [
    ...endpoints,
    `shippingType: ${input.shippingType}`,
    `includedServices: ${INCLUDED_SERVICES}`,
  ];
  if (input.date) args.push(`date: "${input.date}"`);
  if (input.shippingType === "FCL" && input.container) {
    args.push(`container: ${input.container}`);
  }
  if (input.weightKg !== undefined) args.push(`weight: ${input.weightKg}`, `weightUnit: KG`);
  if (input.volumeM3 !== undefined) args.push(`volume: ${input.volumeM3}`, `volumeUnit: M3`);

  return `{
  rates(${args.join(", ")}) {
    general {
      totalPrice
      totalCurrency
      totalTransitTime
      validityFrom
      validityTo
      spot
      indicative
      expired
      individual
      shipmentId
    }
    points {
      provider
      shippingType
      totalPrice
      totalCurrency
    }
  }
}`;
}

type Offer = { general?: unknown; points?: unknown };

/** Saca el array de ofertas del bloque `data` de la respuesta GraphQL. */
function extractOffers(data: unknown): Offer[] {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.rates)) {
      return o.rates.filter((x) => x && typeof x === "object") as Offer[];
    }
  }
  if (Array.isArray(data)) return data.filter((x) => x && typeof x === "object") as Offer[];
  return [];
}

/**
 * Elige la mejor oferta: **prefiere NO vencidas** (una oferta válida le gana a
 * cualquier vencida, aunque sea más cara) y entre las de igual validez, la más
 * barata por `general.totalPrice`. Si TODAS están vencidas, cae a la más barata.
 * (SeaRates suele devolver tarifas vencidas mezcladas; mostrar una vencida como
 *  benchmark es engañoso — descubierto 2026-06-21.)
 */
function pickCheapest(offers: Offer[]): Offer {
  let best = offers[0]!;
  let bestPrice = Infinity;
  let bestExpired = true; // arrancamos "peor que cualquier no-vencida"
  for (const off of offers) {
    const g = (off.general ?? {}) as Record<string, unknown>;
    const p = pickNumber(g, ["totalPrice"]);
    if (p === null || p <= 0) continue;
    const expired = pickBoolean(g, ["expired"]) === true;
    // No-vencida > vencida; a igual validez, la más barata.
    const better = (bestExpired && !expired) || (bestExpired === expired && p < bestPrice);
    if (better) {
      best = off;
      bestPrice = p;
      bestExpired = expired;
    }
  }
  return best;
}

/** Primer `provider` (naviera) no vacío entre los `points` de la oferta. */
function firstProvider(points: unknown): string | null {
  if (!Array.isArray(points)) return null;
  for (const p of points) {
    if (p && typeof p === "object") {
      const v = (p as Record<string, unknown>).provider;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

type NormalizedRate = {
  rateUsd: number | null;
  currency: string | null;
  transitDays: number | null;
  carrier: string | null;
  validityTo: string | null;
  spot: boolean | null;
  indicative: boolean | null;
  expired: boolean | null;
  offersCount: number;
};

/**
 * Normaliza la respuesta al benchmark: toma la oferta MÁS BARATA del array
 * `rates`, lee su `general` (precio/tránsito/validez/flags) y el `provider` de
 * sus `points`. Devuelve `null` si no hay ninguna oferta parseable (→ 'no_rate').
 */
function normalizeRate(data: unknown): NormalizedRate | null {
  const offers = extractOffers(data);
  if (!offers.length) return null;

  const best = pickCheapest(offers);
  const g = (best.general ?? {}) as Record<string, unknown>;

  const rateUsd = pickNumber(g, ["totalPrice"]);
  const currency = pickString(g, ["totalCurrency"]);
  const transitDays = pickNumber(g, ["totalTransitTime"]);
  const carrier = firstProvider(best.points);
  const validityTo = pickString(g, ["validityTo"]);
  const spot = pickBoolean(g, ["spot"]);
  const indicative = pickBoolean(g, ["indicative"]);
  const expired = pickBoolean(g, ["expired"]);

  if (rateUsd === null && transitDays === null && carrier === null && currency === null) {
    return null;
  }
  return {
    rateUsd,
    currency,
    transitDays,
    carrier,
    validityTo,
    spot,
    indicative,
    expired,
    offersCount: offers.length,
  };
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
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
 *   4. POST GraphQL `{ query }` (args inline) a `SEARATES_API_BASE` con Bearer.
 *   5. `errors[]` → `{ ok:false, error:'graphql_error', code, raw }`.
 *      no-2xx → `{ ok:false, error:'http_<status>', raw }`.
 *      2xx sin oferta parseable → `{ ok:false, error:'no_rate', raw }`.
 *   6. SIEMPRE devuelve `raw` (también en errores de proveedor) para auditar.
 *
 * NUNCA tira. Gasta como máximo 1 llamada de rates + (a lo sumo) 1 de auth.
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

  // SeaRates EXIGE `date`: sin fecha la query de rates responde 200 con
  // errors:[{message:"Internal server error"}]. Si el caller no la pasa (p.ej. el
  // cron de caché), inyectamos un zarpe por defecto (~hoy+14d). Descubierto 2026-06-21.
  const dated: SeaRatesQuoteInput = input.date ? input : { ...input, date: defaultShipDate() };

  const r = await timedFetch(cfg.base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: buildRatesQuery(dated) }),
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
    typeof r.body === "object" && r.body !== null ? (r.body as Record<string, unknown>) : null;
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
    offersCount: normalized.offersCount,
    raw,
  };
}
