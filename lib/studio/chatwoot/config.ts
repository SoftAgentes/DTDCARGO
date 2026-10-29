import "server-only";

import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { firstConfiguredSecret } from "@/lib/runtime/server-secret";

/**
 * Configuración de la Bandeja de Chatwoot (SDD-0585, E2-D11), leída del entorno
 * del servidor en cada llamada (sin caché: el cambio de token no pide reiniciar
 * más que el proceso).
 *
 * - `CHATWOOT_URL`: origen del chat. El mismo módulo lo usa `next.config.ts`
 *   para la CSP, así que el iframe y la cabecera no pueden divergir.
 * - `CHATWOOT_PLATFORM_TOKEN`: token de la Platform App «DTD Studio» (E1, paso
 *   1.4). SECRETO: solo en el entorno del servidor, nunca en Git ni con
 *   `NEXT_PUBLIC_`.
 * - `CHATWOOT_ACCOUNT_ID`: la cuenta «DTD Cargo» (id 1 en el VPS).
 *
 * Sin token o sin cuenta → `null`: la página muestra «sin configurar» y nada
 * llama a la red.
 */
export interface ChatwootConfig {
  origin: string;
  token: string;
  accountId: number;
}

export function chatwootConfig(): ChatwootConfig | null {
  const token = firstConfiguredSecret(process.env.CHATWOOT_PLATFORM_TOKEN);
  const cuenta = (process.env.CHATWOOT_ACCOUNT_ID ?? "").trim();
  if (!token || !/^[1-9][0-9]{0,9}$/.test(cuenta)) return null;
  return { origin: chatwootOriginFromEnv(process.env.CHATWOOT_URL), token, accountId: Number(cuenta) };
}
