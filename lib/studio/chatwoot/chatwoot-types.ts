/**
 * Tipos y validadores puros de la Bandeja de Chatwoot (SDD-0585, paso 2.2).
 *
 * Sin `server-only` a propósito: los usan el cliente HTTP, las server actions y
 * sus pruebas. Nada de acá toca la red ni el entorno.
 */

/** Errores del cliente de la Platform API. Las funciones nunca lanzan. */
export type ChatwootError =
  | "sin_configurar"
  | "no_autorizado"
  | "no_encontrado"
  | "origen_invalido"
  | "respuesta_invalida"
  | "red"
  | `http_${number}`;

export type ChatwootResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ChatwootError };

/**
 * Lo que Studio guarda de un agente de Chatwoot. La Platform API devuelve
 * además el `access_token` personal del agente y su `pubsub_token`: se
 * descartan al parsear y no salen de `platform-api.ts`.
 */
export interface ChatwootAgent {
  id: number;
  email: string;
  name: string;
  accountIds: number[];
}

/** Fila de `public.chatwoot_agent_links` (migración 0503). */
export interface ChatwootAgentLink {
  tenant_id: string;
  user_id: string;
  chatwoot_user_id: number;
  created_by: string | null;
  created_at: string;
}

/** Id de usuario de Chatwoot: entero positivo de Postgres (`bigint` acotado a int4 por sensatez). */
export function parseChatwootUserId(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^[1-9][0-9]{0,9}$/.test(text)) return null;
  const n = Number(text);
  return n <= 2_147_483_647 ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Comparación de correos para el candado del vínculo (E2-D10). */
export function mismoCorreo(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return !!x && x === y;
}

/**
 * El enlace de SSO solo se acepta si es `<origen del chat>/app/login` con
 * `sso_auth_token`. Chatwoot lo arma con su `FRONTEND_URL`: si apuntara a otro
 * lado, Studio estaría metiendo en su iframe un origen que su CSP no permite (o
 * peor, uno que no es el chat). Devuelve el enlace normalizado o `null`.
 */
export function validarEnlaceSso(raw: unknown, origin: string): string | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.pathname !== "/app/login") return null;
  if (!url.searchParams.get("sso_auth_token") || !url.searchParams.get("email")) return null;
  return url.toString();
}

/** URL del panel de la cuenta, sin token: la que abre el iframe cuando ya hay sesión. */
export function urlPanel(origin: string, accountId: number): string {
  return `${origin}/app/accounts/${accountId}/dashboard`;
}
