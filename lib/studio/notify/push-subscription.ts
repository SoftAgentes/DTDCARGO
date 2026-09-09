/**
 * SDD-0373: frontera compartida de entrada Y salida, sin DNS ni red.
 * Sólo dominios de servicios Push documentados en la spec; no URLs arbitrarias.
 */
export const PUSH_SOCKET_TIMEOUT_MS = 10_000;
const MAX_ENDPOINT_LENGTH = 4096;

export interface ValidPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validEndpoint(value: unknown): value is string {
  if (
    typeof value !== "string" || value.length === 0 ||
    value.length > MAX_ENDPOINT_LENGTH || /[\s\\\\\u0000-\u001f\u007f]/.test(value)
  ) return false;
  try {
    const url = new URL(value);
    // web-push usa url.parse: no aceptar autoridad escapada o barras extra
    // que WHATWG normaliza pero el transporte interpreta de otra manera.
    const authority = /^https:\/\/([^/?#]+)(?:[/?]|$)/.exec(value)?.[1].toLowerCase();
    if (authority !== url.host && authority !== `${url.hostname}:443`) return false;
    if (
      url.protocol !== "https:" || !value.startsWith("https://") ||
      url.username || url.password || url.hash || value.includes("#") || url.port
    ) return false;
    const host = url.hostname;
    // Etiquetas DNS válidas; evita vacías y sufijos que sólo se parecen.
    if (!host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
      return false;
    }
    return host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

function validKey(value: unknown, bytes: number, publicKey = false): value is string {
  if (typeof value !== "string" || value.length > 90 || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) {
    return false;
  }
  const decoded = Buffer.from(value, "base64url");
  const canonical = decoded.toString("base64url");
  const padded = canonical + "=".repeat((4 - canonical.length % 4) % 4);
  return decoded.length === bytes && (value === canonical || value === padded) &&
    (!publicKey || decoded[0] === 4);
}

/** Proyecta sólo campos del contrato: nunca persiste campos arbitrarios. */
export function parsePushSubscription(value: unknown): ValidPushSubscription | null {
  if (!isRecord(value) || !validEndpoint(value.endpoint) || !isRecord(value.keys)) return null;
  if (!validKey(value.keys.p256dh, 65, true) || !validKey(value.keys.auth, 16)) return null;
  const expiration = value.expirationTime;
  if (
    expiration !== undefined && expiration !== null &&
    (typeof expiration !== "number" || !Number.isFinite(expiration) || expiration < 0)
  ) return null;
  return {
    endpoint: value.endpoint,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
    ...(expiration !== undefined ? { expirationTime: expiration } : {}),
  };
}
