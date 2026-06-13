// SDD-0043 · cliente HTTP de Kommo v4.
// M1 getFieldValue · M2 paginación doble-pasada · M4 manejo 204/401/429/5xx + rate limit ~7 req/s.
import type { HalList, KommoCustomFieldValue } from "./types.ts";

export const RATE_LIMIT_DELAY_MS = 150; // ~6.6 req/s < límite ~7 req/s de Kommo
const MAX_RETRIES = 4;
const LIMIT = 250; // máximo por página en Kommo v4
const MAX_PAGES = 20; // tope de seguridad por pasada

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class KommoError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "KommoError";
    this.status = status;
  }
}

/**
 * M4 — GET autenticado a Kommo. Devuelve el JSON, o null si 204 (sin contenido → fin de paginación).
 * 401 → error claro (token inválido). 429/5xx → backoff + reintento. Otros 4xx → error con cuerpo.
 */
export async function kommoFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
): Promise<T | null> {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (res.status === 204) return null; // sin contenido → fin
    if (res.status === 401) {
      throw new KommoError("Kommo 401: token inválido o sin scope", 401);
    }

    // rate limit / server error → backoff + reintento
    if (res.status === 429 || res.status >= 500) {
      if (attempt++ >= MAX_RETRIES) {
        throw new KommoError(`Kommo ${res.status}: agotados los reintentos`, res.status);
      }
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
      const backoff = Math.max(retryAfter * 1000, 500 * 2 ** attempt);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new KommoError(`Kommo ${res.status}: ${body.slice(0, 300)}`, res.status);
    }

    return (await res.json()) as T;
  }
}

/**
 * SDD-0074 — ESCRITURA autenticada a Kommo (POST/PATCH). Hermano de `kommoFetch`:
 * espeja la misma escalera (401 → error · 429/5xx → backoff+reintento · otros 4xx → error
 * con cuerpo) para mutaciones con cuerpo JSON. Devuelve el JSON parseado (o null en 204).
 *
 * A propósito NO toca `kommoFetch`: ese es el path GET probado en prod por el cron diario, y
 * `supabase/functions` está fuera del typecheck/lint del gate → no se refactoriza lo que
 * funciona sin red de seguridad. La unificación de la escalera (un solo core) vive en
 * SDD-0062 Slice A, cuando se construya el write-back completo (outbox + PATCH de precio/etapa).
 */
export async function kommoWrite<T>(
  baseUrl: string,
  token: string,
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T | null> {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 204) return null; // sin contenido (p.ej. PATCH ok sin payload)
    if (res.status === 401) {
      throw new KommoError("Kommo 401: token inválido o sin scope", 401);
    }

    // rate limit / server error → backoff + reintento (idéntico a kommoFetch)
    if (res.status === 429 || res.status >= 500) {
      if (attempt++ >= MAX_RETRIES) {
        throw new KommoError(`Kommo ${res.status}: agotados los reintentos`, res.status);
      }
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
      const backoff = Math.max(retryAfter * 1000, 500 * 2 ** attempt);
      await sleep(backoff);
      continue;
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new KommoError(`Kommo ${res.status}: ${errBody.slice(0, 300)}`, res.status);
    }

    return (await res.json()) as T;
  }
}

/**
 * M1 — busca en custom_fields_values el primer campo cuyo field_name/field_code contenga
 * alguna keyword (case-insensitive) y devuelve su primer value como string; null si no hay.
 * (El array crudo se guarda igual en la columna jsonb; esto es para lectura/normalización.)
 */
export function getFieldValue(
  entity: { custom_fields_values?: KommoCustomFieldValue[] | null },
  ...keywords: string[]
): string | null {
  const cfv = entity.custom_fields_values ?? [];
  const kw = keywords.map((k) => k.toLowerCase());
  for (const f of cfv) {
    const name = (f.field_name ?? "").toLowerCase();
    const code = (f.field_code ?? "").toLowerCase();
    if (kw.some((k) => name.includes(k) || code.includes(k))) {
      const v = f.values?.[0]?.value;
      return v === null || v === undefined ? null : String(v);
    }
  }
  return null;
}

/**
 * M2 — paginación de DOS PASADAS: order[updated_at]=desc y order[created_at]=desc,
 * deduplicando por id. Corta cuando la página viene incompleta (< limit) o 204.
 */
export async function paginateTwoPass<T extends { id: number }>(
  baseUrl: string,
  token: string,
  entity: "leads" | "contacts",
): Promise<T[]> {
  const byId = new Map<number, T>();
  for (const order of ["updated_at", "created_at"] as const) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const path = `/api/v4/${entity}?limit=${LIMIT}&page=${page}&order[${order}]=desc`;
      const data = await kommoFetch<HalList<T>>(baseUrl, token, path);
      if (!data) break; // 204 → fin de esta pasada
      const items = (data._embedded?.[entity] ?? []) as T[];
      for (const it of items) byId.set(it.id, it);
      if (items.length < LIMIT) break; // página incompleta → fin
      await sleep(RATE_LIMIT_DELAY_MS);
    }
    await sleep(RATE_LIMIT_DELAY_MS);
  }
  return [...byId.values()];
}
