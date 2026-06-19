/**
 * Lectura de body JSON con tope de tamaño para route handlers PÚBLICOS.
 *
 * Los route handlers del App Router NO heredan el límite de body de las viejas
 * API routes de Pages (`bodyParser` 1 MB) — `req.json()` bufferea lo que venga.
 * Para los endpoints públicos anónimos (registro/check, contacto, estimación,
 * ocean-rate) un body anormalmente grande es un vector de DoS de memoria barato.
 * Este helper acota eso:
 *   1. Rechaza por `Content-Length` ANTES de leer (caso común — costo cero).
 *   2. Backstop: si el header falta o miente, corta por bytes reales tras leer.
 *
 * LÍMITE conocido: si el cliente OMITE `Content-Length` y stremea un body enorme,
 * `req.text()` igual lo bufferea antes del backstop. El tope duro real ahí lo pone
 * la plataforma (Vercel limita el body de las funciones serverless a unos MB); este
 * helper lo TENSA a 16 KB para estos endpoints y rechaza temprano el caso normal
 * (header presente). Es defensa en profundidad, no un guard de memoria absoluto.
 *
 * Devuelve un discriminated union para que el caller responda 413/400 con su propio
 * formato de error, sin filtrar internals.
 */

/** Tope de body para los endpoints públicos JSON. Holgado para forms (cédula,
 *  teléfono, mensaje de contacto, payload de la calculadora). */
export const MAX_PUBLIC_JSON_BYTES = 16 * 1024; // 16 KB

export type JsonBodyResult<T> =
  | { ok: true; body: T }
  /** 413 = body demasiado grande · 400 = JSON inválido / ilegible. */
  | { ok: false; status: 400 | 413 };

export async function readJsonBody<T>(
  req: Request,
  maxBytes: number = MAX_PUBLIC_JSON_BYTES,
): Promise<JsonBodyResult<T>> {
  // 1. Guard por Content-Length: rechaza el caso común sin leer el stream.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > maxBytes) return { ok: false, status: 413 };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400 };
  }

  // 2. Backstop por bytes reales (Content-Length ausente o mentido).
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}
