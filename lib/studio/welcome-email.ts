/**
 * Email de bienvenida al crear cliente (SDD-0032 · entrega real SDD-0059).
 *
 * Lee el template `welcome_markbox` (seedeado por 0026_welcome_email_template_seed.sql)
 * y lo ENVÍA de verdad por Resend delegando en `sendEmail` (lib/studio/mail/send-email).
 *
 * Antes (V1) solo encolaba un `mail_logs` con status='queued' y nunca enviaba →
 * el cliente recibía su MARKBOX en pantalla pero nunca por correo. Ahora pasa
 * por el mismo pipeline que el resto de los emails del Studio: mail_config
 * (test_mode + from) + blacklist + Resend + `mail_logs` status='sent'.
 *
 * Best-effort: NUNCA tira excepción — la creación del cliente NO debe romperse
 * si el email falla. Mantiene la firma y el contrato de retorno previos para no
 * tocar los call sites (registro self-service + alta admin).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./mail/send-email";

const TEMPLATE_SLUG = "welcome_markbox";

/** Base del sitio (el portal del cliente vive en una ruta de este dominio). */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

export type WelcomeEmailInput = {
  markbox: string;
  name: string;
  email: string;
};

export type WelcomeEmailResult =
  | {
      ok: true;
      log_id: string;
      /**
       * `true` = el `mail_log` quedó REGISTRADO pero el correo NO salió (Resend
       * sin key). El caller debe tratarlo como "no enviado": antes esta señal se
       * perdía acá y el alta reportaba éxito, así que el cliente veía su
       * Shipping Mark en pantalla y nunca lo recibía por correo.
       */
      queued: boolean;
    }
  | { ok: false; error: string };

/**
 * Link al portal para el correo de bienvenida → `{SITE_URL}/portal/login`.
 *
 * El portal NO vive en un subdominio `portal.dtdcargo.com` (no existe ese
 * rewrite/redirect en next.config; aun resolviéndolo, no hay ruta `/[markbox]`).
 * Todo el código referencia `/portal/login` en el dominio principal: ahí entra
 * el cliente con su MARKBOX, vía magic-link o la contraseña que define con
 * "¿olvidaste tu contraseña?" (la cuenta se crea con clave aleatoria, NO su
 * documento — fix de la vuln de registro, prod 90e035c).
 */
export function portalLoginUrl(): string {
  return `${SITE_URL}/portal/login`;
}

/**
 * Dispara el email de bienvenida (envío real vía Resend).
 *
 * @param supabaseAdmin cliente service_role — el INSERT en `mail_logs` está
 *   bloqueado para `authenticated`; ambos callers pasan `createAdminClient()`.
 * @returns `log_id` en éxito o `error` string en falla. NUNCA tira excepción.
 */
export async function sendWelcomeEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  client: WelcomeEmailInput,
): Promise<WelcomeEmailResult> {
  if (!client.email || !client.email.trim()) {
    return { ok: false, error: "cliente sin email" };
  }

  const result = await sendEmail(supabaseAdmin, tenantId, {
    templateSlug: TEMPLATE_SLUG,
    to: client.email,
    to_name: client.name,
    vars: {
      client_name: client.name,
      markbox: client.markbox,
      portal_link: portalLoginUrl(),
    },
    metadata: { source: "welcome_markbox" },
  });

  if (result.ok) return { ok: true, log_id: result.logId, queued: result.queued };
  return { ok: false, error: result.error };
}
