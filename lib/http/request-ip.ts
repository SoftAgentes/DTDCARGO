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
 * LÍMITE (m-4 · round-3): el invariante "el primer XFF es la IP real" SOLO vale
 * detrás del edge de Vercel (prod). En self-host / preview sin el edge / un proxy
 * mal configurado, un atacante que setee `X-Forwarded-For: 1.2.3.4` controla el
 * primer hop (1 salto ≤ MAX_XFF_HOPS pasa el guard) → la IP sellada sería
 * atacante-elegida. Mitigante: la IP es un campo de EVIDENCIA, no de control de
 * acceso — no gatea nada; spoofearla degrada el no-repudio, no abre acceso. Si
 * algún día se self-hostea, derivar la IP de un header FIRMADO por el proxy de
 * confianza (no del XFF crudo). Bajo Vercel, no-op.
 *
 * Recibe `Headers` (no lee `next/headers` por sí mismo) → PURO y testeable. El
 * caller pasa `(await headers())`.
 */

/** Tope de saltos razonable detrás de Vercel (cliente + N proxies internos). */
const MAX_XFF_HOPS = 8;

const UNKNOWN_IP = "unknown";

/**
 * Resuelve la IP del request a partir de los headers del edge. El primer
 * `x-forwarded-for` (lo que Vercel observó en el borde) → fallback `x-real-ip`
 * → "unknown". Si la cadena XFF es anómalamente larga, descartamos el primero.
 */
export function resolveRequestIp(headers: Headers): string {
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
