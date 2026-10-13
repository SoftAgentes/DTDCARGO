/**
 * Origen del Supabase que usa la app, derivado de `NEXT_PUBLIC_SUPABASE_URL`
 * (SDD-0505).
 *
 * La CSP y los `images.remotePatterns` de `next.config.ts` solo admitían
 * `*.supabase.co`. Con Supabase self-hosted detrás del propio dominio
 * (`https://supabase.dtdcargo.com`, o `http://api-gw:8000` en una prueba
 * local), el navegador bloquearía REST, Realtime (websocket) y las imágenes de
 * Storage sin que nada falle en el servidor. Este módulo saca del `.env` lo
 * que hay que añadir a esas listas.
 *
 * Reglas:
 *   - Puro y sin imports de Next: `next.config.ts` se evalúa en build, antes
 *     de que exista el bundler, así que acá solo se usa `URL` de la plataforma.
 *   - Tolerante: una URL vacía, inválida o con esquema que no sea http/https
 *     devuelve `null`. El caller conserva `*.supabase.co` y no añade nada; un
 *     `.env` roto no tumba el build por este camino.
 *   - `isSupabaseCloud` marca el host `*.supabase.co`, que las listas ya
 *     cubren con comodín: el caller no lo repite.
 */

export type SupabaseOrigin = {
  /** Esquema sin los dos puntos, en el formato que esperan los `remotePatterns`. */
  protocol: "http" | "https";
  /** Host sin puerto (`remotePatterns.hostname`). */
  hostname: string;
  /** Puerto explícito o cadena vacía (`remotePatterns.port`). */
  port: string;
  /** `protocol://host[:port]`, lo que va en `img-src`/`media-src`/`connect-src`. */
  origin: string;
  /** `ws(s)://host[:port]`, lo que necesita Realtime en `connect-src`. */
  wsOrigin: string;
  /** `true` cuando el host termina en `.supabase.co` (Supabase Cloud). */
  isSupabaseCloud: boolean;
};

export function isSupabaseCloudHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".supabase.co");
}

export function originFromEnv(raw: string | undefined): SupabaseOrigin | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const protocol = url.protocol === "https:" ? "https" : "http";
  return {
    protocol,
    hostname: url.hostname,
    port: url.port,
    origin: url.origin,
    wsOrigin: `${protocol === "https" ? "wss" : "ws"}://${url.host}`,
    isSupabaseCloud: isSupabaseCloudHost(url.hostname),
  };
}
