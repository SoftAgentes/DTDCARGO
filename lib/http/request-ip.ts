/**
 * IP del request (server-side) — fuente única para anti-abuso (registro del
 * Portal · SDD-0042 §10) y evidencia legal (aceptaciones T&C · SDD-0054 Slice C).
 *
 * ¿Por qué confiar en el PRIMER `x-forwarded-for` detrás de Vercel?
 * En el edge de Vercel, el proxy SETEA `x-forwarded-for` con la cadena
 * `<ip-del-cliente>, <proxy1>, <proxy2>, …`: el PRIMER elemento es la IP real del
 * visitante tal como Vercel la observó en el borde, y los proxies internos se
 * agregan a la derecha. Cualquier header `x-forwarded-for` "crudo" que un cliente
 * malicioso intente inyectar queda DESPUÉS (Vercel antepone lo que vio), así que
 * el primer hop es la fuente confiable para registrar la IP. `x-real-ip` (también
 * seteado por el edge) es el fallback. Si no hay ninguno → "unknown" (no rompemos
 * por no tener IP; la evidencia/anti-abuso degrada sin fallar).
 *
 * Guarda de robustez: si la cadena trae MÁS de `MAX_XFF_HOPS` saltos, no confiamos
 * en el primero (cadena anómala → posible spoof) y caemos a `x-real-ip`/"unknown".
 *
 * SELF-HOST (SDD-0505 · cierra el LÍMITE m-4 de round-3): el invariante "el
 * primer XFF es la IP real" SOLO vale detrás del edge de Vercel. Detrás de
 * Traefik (sin `forwardedHeaders.trustedIPs`) el proxy CONSERVA el XFF que manda
 * el cliente y anexa la IP real al final, así que `curl -H 'X-Forwarded-For:
 * 1.2.3.4'` fijaría la IP de evidencia a gusto del atacante. Por eso existe
 * `REQUEST_IP_HEADER`: el nombre del header que el proxy de confianza SOBRESCRIBE
 * en cada request con la IP de la conexión TCP. Si está definido y el header
 * llega con valor, gana (primer elemento si trae lista, recortado); si no llega,
 * cae a la conducta de arriba.
 *
 *   - Traefik fija `x-real-ip` SIEMPRE desde la conexión TCP → `x-real-ip`.
 *   - `cf-connecting-ip` solo vale si Traefik acepta ÚNICAMENTE los rangos de
 *     Cloudflare; si cualquiera puede llegar al puerto, el cliente lo inventa.
 *   - El valor es confiable SOLO si el proxy pisa ese header en cada request. Un
 *     header que el proxy deja pasar del cliente vuelve a ser spoofeable.
 *   - `x-forwarded-for` se RECHAZA como header de confianza: configurarlo sería
 *     reintroducir el spoof y además saltarse la guarda de saltos. Se ignora y
 *     queda la conducta actual (la guarda incluida).
 *
 * Mitigante que sigue vigente: la IP es un campo de EVIDENCIA, no de control de
 * acceso — no gatea nada; spoofearla degrada el no-repudio, no abre acceso. El
 * runbook del servidor exige probar el header con `curl -H` tras configurarlo.
 *
 * Recibe `Headers` y el `env` (por defecto `process.env`), no lee `next/headers`
 * por sí mismo → PURO y testeable. El caller pasa `(await headers())`.
 */

import type { EnvSource } from "@/lib/runtime/app-env";

/** Tope de saltos razonable detrás de Vercel (cliente + N proxies internos). */
const MAX_XFF_HOPS = 8;

const UNKNOWN_IP = "unknown";

/** El header que se spoofea: nunca se acepta como "de confianza". */
const UNTRUSTED_HEADER = "x-forwarded-for";

/** Nombre del header del proxy de confianza, o null si no hay uno válido. */
function trustedHeaderName(env: EnvSource): string | null {
  const name = env.REQUEST_IP_HEADER?.trim().toLowerCase();
  if (!name || name === UNTRUSTED_HEADER) return null;
  return name;
}

/** Primer elemento no vacío de una lista separada por comas, recortado. */
function firstHop(raw: string | null): string | null {
  const first = raw?.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * Resuelve la IP del request. Primero el header del proxy de confianza
 * (`REQUEST_IP_HEADER`, si está configurado y llegó con valor); si no, el primer
 * `x-forwarded-for` (lo que Vercel observó en el borde) → fallback `x-real-ip`
 * → "unknown". Si la cadena XFF es anómalamente larga, descartamos el primero.
 */
export function resolveRequestIp(headers: Headers, env: EnvSource = process.env): string {
  const trusted = trustedHeaderName(env);
  if (trusted) {
    let raw: string | null = null;
    try {
      raw = headers.get(trusted);
    } catch {
      // Un nombre que no es un header válido (espacios, caracteres raros) hace
      // que `Headers.get` lance: una variable mal escrita no tumba el request.
      raw = null;
    }
    const fromProxy = firstHop(raw);
    if (fromProxy) return fromProxy;
  }

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h !== "");
    // Cadena anómala (demasiados saltos) → no confiamos en el primero.
    if (hops.length > 0 && hops.length <= MAX_XFF_HOPS) {
      return hops[0];
    }
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return UNKNOWN_IP;
}

/**
 * Versión async que lee `next/headers` por el caller (server action / route
 * handler). Fuera de un request scope (o si headers() falla) → "unknown".
 */
export async function getRequestIp(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return resolveRequestIp(await headers());
  } catch {
    return UNKNOWN_IP;
  }
}
