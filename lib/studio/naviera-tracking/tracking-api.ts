import "server-only";

/**
 * Cliente del Container Tracking API de SeaRates (SDD-0101 · Slice B).
 *
 * DISTINTO al cliente de fletes (lib/studio/searates/searates-api.ts, de otra
 * ventana): el tracking usa **auth directa por `api_key`** en el query string (NO
 * el platform-token/Bearer de rates). Por eso este cliente es independiente y NO
 * importa nada del lane de fletes.
 *
 * Contrato (doc oficial docs.searates.com/reference/tracking):
 *   GET https://tracking.searates.com/tracking
 *     ?api_key=<key>&number=<n>&type=<CT|BL|BK>&sealine=<SCAC|auto>&route=true
 *   → { status:'success', message, data:{ metadata, route, vessels, containers[].events, route_data } }
 *
 * Cuota: SeaRates reporta `data.metadata.api_calls.remaining` en CADA respuesta →
 * el caller (action) decide si seguir gastando. Este cliente NO persiste cuota.
 *
 * `import "server-only"` → la api key NUNCA llega al bundle del cliente. Mock-mode
 * si falta `SEARATES_API_KEY` (dev/CI sin gastar cuota). NUNCA tira: union ok/error.
 */

import { normalizeTracking, type TrackingLive } from "./tracking-normalize";

/** Endpoint del tracking; override por env (default = host oficial). */
const TRACKING_URL =
  process.env.SEARATES_TRACKING_API?.replace(/\/+$/, "") ||
  "https://tracking.searates.com/tracking";

const TIMEOUT_MS = 15_000;

export type TrackingNumberType = "CT" | "BL" | "BK";

export type TrackingInput = {
  /** Nº de contenedor / BL / booking. */
  number: string;
  /** Tipo del número; SeaRates autodetecta si se omite. */
  type?: TrackingNumberType;
  /** SCAC de la naviera; 'auto' por defecto. */
  sealine?: string | null;
  /** Pedir el detalle de ruta (paths/posición). Default true. */
  route?: boolean;
};

export type TrackingResult =
  | { ok: true; live: TrackingLive; remaining: number | null; raw: unknown }
  | {
      ok: false;
      error: string;
      code?: string;
      remaining?: number | null;
      raw?: unknown;
    };

/** fetch con timeout vía AbortController. Nunca tira: devuelve un objeto resultado. */
async function timedFetch(
  url: string,
): Promise<{ ok: boolean; status: number; body?: unknown; text?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      /* respuesta no-JSON → queda `text` */
    }
    return { ok: res.ok, status: res.status, body, text };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lee la cuota restante del envelope (también en errores de proveedor). */
function remainingFrom(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return null;
  const meta = (data as Record<string, unknown>).metadata;
  if (!meta || typeof meta !== "object") return null;
  const calls = (meta as Record<string, unknown>).api_calls;
  if (!calls || typeof calls !== "object") return null;
  const rem = (calls as Record<string, unknown>).remaining;
  return typeof rem === "number" ? rem : null;
}

/**
 * Consulta el tracking de un contenedor/BL. Gasta como máximo **1 llamada**.
 * Flujo:
 *   1. Sin `SEARATES_API_KEY` → { ok:false, error:'mock_no_key' } (sin fetch).
 *   2. number vacío → { ok:false, error:'invalid_input' } (sin fetch).
 *   3. GET tracking; no-2xx / `status != success` → error con `raw` para auditar.
 *   4. 2xx OK → normaliza; SIEMPRE devuelve `remaining` (de la metadata) si vino.
 */
export async function getContainerTracking(
  input: TrackingInput,
): Promise<TrackingResult> {
  const apiKey = process.env.SEARATES_API_KEY;
  if (!apiKey) return { ok: false, error: "mock_no_key" };

  const number = input.number?.trim().toUpperCase().replace(/\s+/g, "");
  if (!number) return { ok: false, error: "invalid_input" };

  const params = new URLSearchParams({
    api_key: apiKey,
    number,
    sealine: input.sealine?.trim() ? input.sealine.trim().toUpperCase() : "auto",
    route: String(input.route ?? true),
  });
  if (input.type) params.set("type", input.type);

  const r = await timedFetch(`${TRACKING_URL}?${params.toString()}`);
  const raw = r.body ?? r.text ?? null;

  if (r.error) return { ok: false, error: `network: ${r.error}` };
  if (!r.ok) {
    return { ok: false, error: `http_${r.status}`, remaining: remainingFrom(raw), raw };
  }

  const envelope =
    r.body && typeof r.body === "object" ? (r.body as Record<string, unknown>) : null;
  const apiStatus = envelope ? String(envelope.status ?? "") : "";
  if (apiStatus && apiStatus !== "success") {
    const msg = envelope ? String(envelope.message ?? "") : "";
    return {
      ok: false,
      error: "provider_error",
      code: msg || apiStatus,
      remaining: remainingFrom(raw),
      raw,
    };
  }

  const live = normalizeTracking(envelope ?? raw);
  if (!live) return { ok: false, error: "no_data", remaining: remainingFrom(raw), raw };

  return { ok: true, live, remaining: live.apiCallsRemaining, raw };
}
