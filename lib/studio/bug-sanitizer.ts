/**
 * Sanitizer del Bug Reporter (SDD-0036 Fase 4 · CRITICAL SECURITY).
 *
 * Redacciona patrones sensibles ANTES de que entren al buffer rolling
 * de `bug-tech-capture.ts`. Defense in depth: si el capture falla en
 * sanitizar (regresión, dep nueva, etc.), el sanitizer es la última línea.
 *
 * Funciones puras + sin side effects + sin acceso a window/document.
 * Testeable en aislamiento.
 *
 * Patrones cubiertos:
 *   - URLs:
 *       · query strings con keys sensibles (token, apiKey, secret, etc.)
 *       · hash/fragment con mismos keys (#access_token=...)
 *       · userinfo Basic Auth (user:password@host)
 *       · tokens conocidos embebidos en path (/auth/jwt/eyJ.../callback)
 *   - Headers sensibles (Authorization, Cookie, X-API-Key, etc.)
 *   - Tokens en texto libre (Bearer, JWT, Stripe, AWS, GitHub, Slack,
 *     OpenAI/Anthropic, custom prefix _live_ / _test_, generic key=value)
 *   - URLs sensibles inline en mensajes de consola
 *
 * NO cubre rrweb (Fase 4.5). rrweb tendrá su propio sanitizer + block
 * selectors para <input type="password">, [data-sensitive], etc.
 *
 * Historial: re-escrito 2026-05-26 tras codex adversarial review que
 * encontró 7 vectores P1 en V1 (callback genérico rompía Stripe/AWS/etc,
 * paths/hash/userinfo no sanitizados, console messages no pasaban por
 * redactUrl). Ver memoria `project_sdd0036_bug_reporter`.
 */

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const REDACTED = "[REDACTED]";

const SENSITIVE_QUERY_KEYS = new Set([
  // Auth genéricos
  "token", "access_token", "refresh_token", "id_token",
  "auth", "auth_token", "authorization", "bearer", "jwt",
  "session", "session_id", "sessionid", "sid",
  "code", "state", "nonce",
  // API keys
  "api_key", "apikey", "api-key", "key",
  "client_secret", "client-secret", "secret",
  // Passwords
  "password", "passwd", "pwd", "pass",
  // Otros
  "signature", "sig", "hmac", "hash", "csrf", "xsrf", "_csrf",
  // Payment-like
  "card", "cvc", "cvv", "ccnum",
]);

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization", "cookie", "set-cookie",
  "x-api-key", "x-auth-token", "x-csrf-token", "x-xsrf-token",
  "x-access-token", "x-amz-security-token", "x-supabase-auth",
  "apikey", "api-key", "proxy-authorization", "www-authenticate",
]);

/**
 * Patrones de tokens conocidos en texto libre.
 *
 * IMPORTANTE: el callback de `String.replace` distingue por `name`. Solo
 * "Generic credential" preserva el container del match y reemplaza el
 * value group. Todos los demás se reemplazan COMPLETOS por [REDACTED].
 *
 * Esto fue un bug P1 en V1 del sanitizer (codex review 2026-05-26): el
 * callback aplicaba la heurística "preservar prefijo, reemplazar grupo 2"
 * a TODOS los patrones, lo que hacía que Stripe `sk_live_xxx` quedara
 * como `sk_[REDACTED]_xxx`.
 */
const TOKEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // JWT (3 partes base64url separadas por punto). Mínimo 20 chars en header.
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  // Bearer tokens en text ("Bearer xxx") · greedy hasta whitespace/comilla
  { name: "Bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{16,}/gi },
  // Basic auth en text ("Basic base64...")
  { name: "Basic", re: /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi },
  // Stripe-style: sk_live, sk_test, pk_live, pk_test, rk_live, rk_test, whsec_*
  // CRITICAL: pattern SIN grupos de captura para evitar el bug del callback.
  { name: "Stripe", re: /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  // Custom *_live_*/*_test_* / *_prod_*/*_dev_* (proprietary token shape)
  { name: "Custom prefix", re: /\b[a-z][a-z0-9_]{1,15}_(?:live|test|prod|dev)_[A-Za-z0-9]{16,}\b/gi },
  // AWS Access Key (AKIA + 16 chars)
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  // AWS Secret asignado a env var (genérico — el value puede tener cualquier shape)
  { name: "AWS Secret", re: /\b(?:aws_?secret(?:_?access)?_?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },
  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_, ghi_, ght_)
  { name: "GitHub", re: /\bgh[oprusti]_[A-Za-z0-9]{30,}\b/g },
  // Slack tokens (xoxa-, xoxb-, xoxp-, xoxr-, xoxs-)
  { name: "Slack", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  // OpenAI / Anthropic keys (sk-..., sk-ant-..., sk-proj-...)
  { name: "OpenAI/Anthropic", re: /\bsk-(?:ant|proj)?-?[A-Za-z0-9_-]{32,}\b/g },
  // GenericKeyValue: <word_with_token_meaning>=<value16+>
  // Captura grupos para preservar el prefijo. PARSEAR con cuidado en callback.
  {
    name: "Generic credential",
    re: /\b(token|secret|password|api[_-]?key|auth(?:[_-]?token)?|bearer|session[_-]?id|client[_-]?secret)\s*[:=]\s*['"]?([A-Za-z0-9_\-+/=.]{16,})['"]?/gi,
  },
];

// ─────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────

/**
 * Sanitiza una URL: redacta query params + hash con keys sensibles,
 * userinfo Basic Auth, y tokens conocidos embebidos en path.
 *
 * Ejemplo:
 *   "https://api.x.com/v1/users?token=abc&limit=10#access_token=xyz"
 *   → "https://api.x.com/v1/users?token=[REDACTED]&limit=10#access_token=[REDACTED]"
 *
 *   "https://user:secret@api.x.com/auth/jwt/eyJ...xxx.yyy/callback"
 *   → "https://[REDACTED]@api.x.com/auth/jwt/[REDACTED]/callback"
 */
export function redactUrl(url: string): string {
  if (!url || typeof url !== "string") return url;

  // Best-effort: si la URL viene con encoding doble, intentamos decode UNA
  // vez para que keys/values sensibles que vienen percent-encoded matcheen.
  // Si el decode produce algo que no es URL válida o vuelve a tener `%XX`,
  // mantenemos el original y aplicamos regex fallback.
  const decoded = tryDecodeOnce(url);
  const working = decoded ?? url;

  let out = working;

  // 1. Userinfo Basic Auth
  out = out.replace(
    /^(https?:\/\/)([^:@/?#\s]+:[^@/?#\s]+)@/i,
    (_m, scheme) => `${scheme}${REDACTED}@`,
  );

  // 2. Path tokens (segments que matchean patrones conocidos).
  // CRITICAL: usar redactTokenPatternsOnly (NO redactTokensInText) para
  // evitar recursión infinita · redactTokensInText también llama redactUrl
  // para URLs absolutas, y si la entrada actual es una URL absoluta entra
  // en stack overflow. Descubierto por test adversarial 2026-05-26.
  out = redactTokenPatternsOnly(out);

  // 3. Query + hash via parseo URL
  try {
    const u = new URL(out, "http://__placeholder__/");

    // Query params
    const params = u.searchParams;
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        params.set(key, REDACTED);
      }
    }

    // Hash/fragment como pseudo-query
    if (u.hash.length > 1) {
      const hashQuery = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
      // Solo procesar si parece "key=value&key2=value2"
      if (/^[A-Za-z0-9_\-]+=/.test(hashQuery)) {
        const hashParams = new URLSearchParams(hashQuery);
        let changedHash = false;
        for (const key of Array.from(hashParams.keys())) {
          if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
            hashParams.set(key, REDACTED);
            changedHash = true;
          }
        }
        if (changedHash) {
          u.hash = `#${hashParams.toString()}`;
        }
      }
    }

    // Reconstruir
    if (working.startsWith("http://") || working.startsWith("https://")) {
      return u.toString();
    }
    // URL relativa: solo path + search + hash
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    // URL no parseable como tal · seguimos con regex fallback
    return redactUrlByRegex(out);
  }
}

/**
 * Sanitiza headers. Headers sensibles se redactan completos; los demás
 * pasan por redactTokensInText para limpiar values con tokens embebidos.
 */
export function redactHeaders(
  headers: Record<string, string> | Array<[string, string]> | Headers | undefined | null,
): Record<string, string> {
  if (!headers) return {};

  const out: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers);

  for (const [name, value] of entries) {
    if (typeof name !== "string" || typeof value !== "string") continue;
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
      out[name] = REDACTED;
    } else {
      out[name] = redactTokensInText(value);
    }
  }
  return out;
}

/**
 * Helper interno · aplica SOLO TOKEN_PATTERNS sin tocar URLs. Esto rompe
 * la recursión entre `redactUrl` (que limpia tokens en el path) y
 * `redactTokensInText` (que limpia URLs dentro de texto).
 *
 * Si llamáramos `redactTokensInText` desde `redactUrl`, y `redactTokensInText`
 * a su vez llama `redactUrl` para cualquier `https?://...` que aparezca,
 * con una URL absoluta entraríamos en stack overflow (descubierto por test
 * adversarial 2026-05-26).
 */
function redactTokenPatternsOnly(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const { name, re } of TOKEN_PATTERNS) {
    out = out.replace(re, (match, ...args) => {
      if (name === "Generic credential") {
        const groups = args.slice(0, -2) as string[];
        const value = groups[1];
        if (typeof value === "string" && value.length > 0) {
          return match.replace(value, REDACTED);
        }
        return REDACTED;
      }
      return REDACTED;
    });
  }
  return out;
}

/**
 * Sanitiza texto libre: redacta tokens conocidos + URLs sensibles inline.
 *
 * Cobertura:
 *   - TOKEN_PATTERNS (JWT, Bearer, Basic, Stripe, custom prefix _live_/_test_,
 *     AWS, GitHub, Slack, OpenAI/Anthropic, generic key=value)
 *   - URLs sensibles dentro del texto (delega a redactUrl, que cubre
 *     query/hash/userinfo/path tokens)
 *
 * Defense in depth: incluso si un token está en un mensaje genérico
 * que no parece sensible, debe redactarse.
 */
export function redactTokensInText(text: string): string {
  if (!text || typeof text !== "string") return text;

  // 1. Token patterns standalone (sin tocar URLs)
  let out = redactTokenPatternsOnly(text);

  // 2. URLs absolutas inline (cubre query+hash+userinfo+path tokens via
  // redactUrl). redactUrl usa redactTokenPatternsOnly internamente, NO
  // re-llama esta función, por eso no hay recursión.
  out = out.replace(/\bhttps?:\/\/[^\s'"<>)]+/g, (m) => redactUrl(m));

  // 3. URLs relativas con query/hash sensible (ej: "/api/login?token=abc")
  out = out.replace(/(?<![\w/])\/[^\s'"<>)]+\?[^\s'"<>)]+/g, (m) => redactUrl(m));

  return out;
}

/**
 * Sanitiza un stack trace: redacta tokens y URLs sensibles inline.
 */
export function redactStack(stack: string | undefined | null): string | undefined {
  if (!stack) return undefined;
  return redactTokensInText(stack);
}

/**
 * Sanitiza un console_log entry. Devuelve nuevo objeto, no muta input.
 */
export function redactConsoleEntry<
  T extends { level?: string; message?: string; stack?: string; ts?: string },
>(entry: T): T {
  return {
    ...entry,
    message: entry.message ? redactTokensInText(entry.message) : entry.message,
    stack: entry.stack ? redactStack(entry.stack) : entry.stack,
  };
}

/**
 * Sanitiza un network_request entry. URL pasa por redactUrl (que ahora
 * cubre query + hash + userinfo + path tokens).
 */
export function redactNetworkEntry<
  T extends { url?: string; method?: string; status?: number; ms?: number; ts?: string },
>(entry: T): T {
  return {
    ...entry,
    url: entry.url ? redactUrl(entry.url) : entry.url,
  };
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

/**
 * Intenta decodeURIComponent una vez. Devuelve null si:
 *   - no hay nada para decodear
 *   - decodear produce un error
 *   - el resultado sigue teniendo %XX (double-encoded, no atacamos eso aquí)
 */
function tryDecodeOnce(s: string): string | null {
  if (!s.includes("%")) return null;
  try {
    const decoded = decodeURIComponent(s);
    if (decoded === s) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Fallback regex cuando new URL() falla.
 * Matchea `<key>=<value>` donde key está en SENSITIVE_QUERY_KEYS,
 * tanto en query (?key=) como en hash (#key=).
 */
function redactUrlByRegex(url: string): string {
  const keysAlt = Array.from(SENSITIVE_QUERY_KEYS).join("|");
  // En query/hash: precedido por ? & o #
  const re = new RegExp(`([?&#](?:${keysAlt})=)([^&#\\s]+)`, "gi");
  return url.replace(re, (_m, prefix) => `${prefix}${REDACTED}`);
}

// ─────────────────────────────────────────────────────────────
// Exports para test
// ─────────────────────────────────────────────────────────────

export const _internal = {
  SENSITIVE_QUERY_KEYS,
  SENSITIVE_HEADER_NAMES,
  TOKEN_PATTERNS,
  REDACTED,
  redactUrlByRegex,
  tryDecodeOnce,
};
