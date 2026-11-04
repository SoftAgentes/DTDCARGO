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

/**
 * Configuración del webhook entrante (SDD-0585, E2-D16).
 *
 * - `CHATWOOT_WEBHOOK_SECRET`: el token del webhook de cuenta en Chatwoot (su
 *   `secret`, que firma cada entrega). SECRETO.
 * - `CHATWOOT_TENANT_ID`: el tenant de Studio al que pertenecen los eventos.
 * - `CHATWOOT_ACCOUNT_ID`: los eventos de otra cuenta se ignoran.
 *
 * Falta algo → `null`: la ruta responde 503 y no toca la base.
 */
export interface ChatwootWebhookConfig {
  secret: string;
  tenantId: string;
  accountId: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function chatwootWebhookConfig(): ChatwootWebhookConfig | null {
  const secret = firstConfiguredSecret(process.env.CHATWOOT_WEBHOOK_SECRET);
  const tenantId = (process.env.CHATWOOT_TENANT_ID ?? "").trim();
  const cuenta = (process.env.CHATWOOT_ACCOUNT_ID ?? "").trim();
  if (!secret || !UUID.test(tenantId) || !/^[1-9][0-9]{0,9}$/.test(cuenta)) return null;
  return { secret, tenantId, accountId: Number(cuenta) };
}

/**
 * Id del usuario de servicio de Chatwoot (E1, paso 1.4: «Servicio DTD Studio»),
 * para el ciclo de vida de los agentes (SDD-0585, paso 2.5). Es administrador de
 * la cuenta pero no es una persona: la salud no lo cuenta como admin humano y
 * las bajas nunca lo tocan. Vive en `/srv/chatwoot/secretos/platform-app.env`.
 * Sin él → `null`: la salud dice que no lo puede medir.
 */
export function chatwootServicioUserId(): number | null {
  const valor = (process.env.CHATWOOT_SERVICE_USER_ID ?? "").trim();
  return /^[1-9][0-9]{0,9}$/.test(valor) ? Number(valor) : null;
}

/**
 * Tenant de Studio al que pertenece la cuenta de Chatwoot (`CHATWOOT_TENANT_ID`,
 * el mismo del webhook), para el cron de agentes (SDD-0585, paso 2.5). Sin un
 * uuid válido → `null`.
 */
export function chatwootTenantId(): string | null {
  const valor = (process.env.CHATWOOT_TENANT_ID ?? "").trim();
  return UUID.test(valor) ? valor : null;
}
