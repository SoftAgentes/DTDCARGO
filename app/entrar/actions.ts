"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { mintPortalMagicToken, portalOpenUrl } from "@/lib/studio/portal/magic-link";
import { sendPortalMagicLinkEmail } from "@/lib/studio/portal/magic-link-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const THROTTLE_TABLE = "portal_registro_throttle";
const THROTTLE_PREFIX = "portal-login:";
/** Segundo cerrojo, por EMAIL: el de IP no frena a quien rota de red. */
const THROTTLE_EMAIL_PREFIX = "portal-login-mail:";
const THROTTLE_LIMIT = 8;
const THROTTLE_EMAIL_LIMIT = 5;
const THROTTLE_WINDOW_MINUTES = 60;

export type PortalLoginState = {
  error?: string;
  sent?: boolean;
  /** Email al que se mandó el enlace (para el mensaje de confirmación). */
  email?: string;
};

function genericSuccess(email: string): PortalLoginState {
  return { sent: true, email };
}

/**
 * Camino VIEJO — Supabase Auth manda el correo y el enlace vuelve con `?code=`
 * (flujo PKCE).
 *
 * 🔴 Depende de una cookie `code_verifier` del navegador que pidió el enlace: si
 * el cliente abre el correo en otro navegador, falla y el portal le decía
 * "el enlace venció" (ver `lib/studio/portal/magic-link.ts`). Queda **sólo como
 * plan B** para que un fallo al acuñar o al enviar no deje a nadie sin puerta:
 * es exactamente lo que había hasta el 2026-08-21, así que nadie queda peor.
 */
async function sendMagicLinkLegacy(email: string): Promise<PortalLoginState> {
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/portal/callback`,
      shouldCreateUser: false,
    },
  });
  return genericSuccess(email);
}

/** Cuenta + registra un toque en la ventana del cerrojo. `true` = pasa. */
async function throttleOk(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  limit: number,
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - THROTTLE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", key)
    .gte("created_at", windowStart);
  if (error || (count ?? 0) >= limit) return false;
  const { error: insertError } = await admin.from(THROTTLE_TABLE).insert({ ip: key });
  return !insertError;
}

/**
 * Pide el enlace de acceso al portal. Método ÚNICO de entrada (SDD-0094): el
 * cliente entra con su email, no con su Shipping Mark.
 *
 * Sólo manda a emails habilitados, pero **responde igual pase lo que pase** para
 * no confirmarle a un enumerador qué correos son clientes.
 *
 * SDD-0278 · el enlace se acuña como `token_hash` y lo mandamos nosotros, no Auth:
 * así funciona aunque el correo se abra en otro navegador, y queda en `mail_logs`.
 * El camino viejo sigue vivo abajo como plan B.
 *
 * ⚠️ Cambió un invariante: antes decía "el login nunca crea `auth.users`". Ahora
 * puede crearlo, pero **sólo** para un email que ya tiene fila en `client_users`
 * (`invited` o `active`) — o sea alguien a quien el equipo ya habilitó. Sin eso,
 * los 14 clientes en estado `invited` (ninguno con `auth_user_id`) no podían
 * entrar nunca por su cuenta: Auth no manda nada para un usuario que no existe.
 */
export async function requestMagicLink(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Ingresa un email válido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return sendMagicLinkLegacy(email);
  }

  const originHash = createHash("sha256")
    .update(await getRequestIp())
    .digest("hex");
  if (!(await throttleOk(admin, `${THROTTLE_PREFIX}${originHash}`, THROTTLE_LIMIT))) {
    return genericSuccess(email);
  }

  const emailHash = createHash("sha256").update(email).digest("hex");
  if (
    !(await throttleOk(
      admin,
      `${THROTTLE_EMAIL_PREFIX}${emailHash}`,
      THROTTLE_EMAIL_LIMIT,
    ))
  ) {
    return genericSuccess(email);
  }

  const { data: clientUser, error: clientUserError } = await admin
    .from("client_users")
    .select("id, tenant_id")
    .ilike("email", email)
    .in("status", ["invited", "active"])
    .limit(1)
    .maybeSingle<{ id: string; tenant_id: string }>();
  if (clientUserError || !clientUser) return genericSuccess(email);

  // Camino nuevo: acuñar `token_hash` y mandarlo por nuestro pipeline.
  const tokenHash = await mintPortalMagicToken(admin, email);
  if (tokenHash) {
    const sent = await sendPortalMagicLinkEmail(admin, clientUser.tenant_id, {
      email,
      url: portalOpenUrl(tokenHash),
    });
    // `queued` = el mail_log quedó pero el correo NO salió (sin key de Resend).
    // Eso no es entrega: se cae al plan B en vez de dejar al cliente esperando.
    if (sent.ok && !sent.queued) return genericSuccess(email);
  }

  return sendMagicLinkLegacy(email);
}
