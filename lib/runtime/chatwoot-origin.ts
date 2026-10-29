/**
 * Origen del Chatwoot que se embebe en la Bandeja de Studio (SDD-0585, E2-D14).
 *
 * Lo usan dos lados que tienen que coincidir:
 *   - `next.config.ts`, en build, para la `frame-src` y la `Permissions-Policy`
 *     de `/studio/bandeja`;
 *   - el servidor (`lib/studio/chatwoot/config.ts`), en runtime, para armar la
 *     URL del iframe y validar que el enlace de SSO sea de este origen.
 * Si divergieran, el navegador bloquearía el iframe sin que el servidor falle.
 *
 * Reglas:
 *   - Puro y sin imports de Next (lo evalúa `next.config.ts`), como
 *     `supabase-origin.ts`.
 *   - `CHATWOOT_URL` vacía o ausente → `https://chat.dtdcargo.com`, el de
 *     producción (E1). Una URL inválida, con ruta rara o con un esquema que no
 *     sea https también cae al de producción: un `.env` roto no abre la CSP a
 *     cualquier origen.
 *   - Solo `https:`, salvo `http://localhost` / `127.0.0.1` para desarrollo.
 */

export const CHATWOOT_ORIGIN_DEFAULT = "https://chat.dtdcargo.com";

const LOCAL = new Set(["localhost", "127.0.0.1"]);

export function chatwootOriginFromEnv(raw: string | undefined = process.env.CHATWOOT_URL): string {
  const value = raw?.trim();
  if (!value) return CHATWOOT_ORIGIN_DEFAULT;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return CHATWOOT_ORIGIN_DEFAULT;
  }
  const httpLocal = url.protocol === "http:" && LOCAL.has(url.hostname);
  if (url.protocol !== "https:" && !httpLocal) return CHATWOOT_ORIGIN_DEFAULT;
  if (url.username || url.password) return CHATWOOT_ORIGIN_DEFAULT;
  return url.origin;
}
