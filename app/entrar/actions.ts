"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { emailIlikePattern, sameEmail } from "@/lib/shared/email-literal";
import { resendPuedeEnviar } from "@/lib/studio/mail/resend-api";
import { mintPortalMagicToken, portalOpenUrl } from "@/lib/studio/portal/magic-link";
import { sendPortalMagicLinkEmail } from "@/lib/studio/portal/magic-link-email";
import { findClienteSinAcceso } from "@/lib/studio/portal/sin-acceso";
import { avisarClienteSinAcceso } from "@/lib/studio/portal/sin-acceso-aviso";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";
const THROTTLE_TABLE = "portal_registro_throttle";
const THROTTLE_PREFIX = "portal-login:";
/** Segundo cerrojo, por EMAIL: el de IP no frena a quien rota de red. */
const THROTTLE_EMAIL_PREFIX = "portal-login-mail:";
const THROTTLE_LIMIT = 8;
const THROTTLE_EMAIL_LIMIT = 5;
const THROTTLE_WINDOW_MINUTES = 60;

const VARIOS_PEDIDOS =
  "Hubo varios pedidos seguidos y por seguridad no mandamos más enlaces por ahora. Si ya tienes uno en tu correo, úsalo. Si no, vuelve a pedirlo dentro de una hora.";
const NO_PUDIMOS_ATENDER =
  "No pudimos atender tu pedido y no salió ningún enlace. Vuelve a intentarlo en unos minutos.";

export type PortalLoginState = {
  error?: string;
  /**
   * Se recibió el pedido. NO quiere decir que salió un correo: la respuesta es la
   * misma para un correo sin cuenta y para un envío que falló, porque distinguirlos
   * le diría a un enumerador qué correos son clientes (SDD-0597).
   */
  requested?: boolean;
  /** Pedidos seguidos desde esta pantalla: es lo que hace notar un reintento. */
  requests?: number;
  /** Email que escribió la persona, para mostrarlo y para volver a pedir. */
  email?: string;
};

function requestReceived(prev: PortalLoginState, email: string): PortalLoginState {
  return { requested: true, requests: (Number(prev.requests) || 0) + 1, email };
}

/**
 * Camino VIEJO — Supabase Auth manda el correo y el enlace vuelve con `?code=`
 * (flujo PKCE).
 *
 * 🔴 Depende de una cookie `code_verifier` del navegador que pidió el enlace: si
 * el cliente abre el correo en otro navegador, falla y el portal le decía
 * "el enlace venció" (ver `lib/studio/portal/magic-link.ts`). Queda **sólo como
 * plan B**, y sólo donde todavía no se acuñó nada (ver `requestMagicLink`).
 *
 * Su error se registra y no llega a la pantalla: a un correo sin cuenta Auth le
 * responde otra cosa que a uno con cuenta, y mostrarlo abriría el oráculo.
 */
async function sendMagicLinkLegacy(
  prev: PortalLoginState,
  email: string,
): Promise<PortalLoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/portal/callback`,
      shouldCreateUser: false,
    },
  });
  if (error) console.error("[entrar] Auth no mandó el enlace:", error.status, error.code);
  return requestReceived(prev, email);
}

type ThrottleResult = "ok" | "limit" | "error";

/** Cuenta + registra un toque en la ventana del cerrojo. Falla cerrado. */
async function touchThrottle(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  limit: number,
): Promise<ThrottleResult> {
  const windowStart = new Date(
    Date.now() - THROTTLE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", key)
    .gte("created_at", windowStart);
  if (error) return "error";
  if ((count ?? 0) >= limit) return "limit";
  const { error: insertError } = await admin.from(THROTTLE_TABLE).insert({ ip: key });
  return insertError ? "error" : "ok";
}

/**
 * Los cerrojos pueden decir lo que pasó porque corren ANTES de mirar si el correo
 * existe: a cualquier dirección le pasa igual, así que no revelan nada.
 */
function throttled(result: Exclude<ThrottleResult, "ok">, email: string): PortalLoginState {
  return { error: result === "limit" ? VARIOS_PEDIDOS : NO_PUDIMOS_ATENDER, email };
}

/**
 * Pide el enlace de acceso al portal. Método ÚNICO de entrada (SDD-0094): el
 * cliente entra con su email, no con su Shipping Mark.
 *
 * Sólo manda a emails habilitados, pero **una vez que mira el correo responde igual
 * pase lo que pase** —sin cuenta, entregado o con el envío caído— para no confirmarle
 * a un enumerador qué correos son clientes. Por eso esa respuesta nunca afirma que
 * algo salió (SDD-0597).
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
  prev: PortalLoginState,
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
    return sendMagicLinkLegacy(prev, email);
  }

  const originHash = createHash("sha256")
    .update(await getRequestIp())
    .digest("hex");
  const origin = await touchThrottle(
    admin,
    `${THROTTLE_PREFIX}${originHash}`,
    THROTTLE_LIMIT,
  );
  if (origin !== "ok") return throttled(origin, email);

  const emailHash = createHash("sha256").update(email).digest("hex");
  const perEmail = await touchThrottle(
    admin,
    `${THROTTLE_EMAIL_PREFIX}${emailHash}`,
    THROTTLE_EMAIL_LIMIT,
  );
  if (perEmail !== "ok") return throttled(perEmail, email);

  const { data: clientUser, error: clientUserError } = await admin
    .from("client_users")
    .select("id, tenant_id, email")
    .ilike("email", emailIlikePattern(email))
    .in("status", ["invited", "active"])
    .limit(1)
    .maybeSingle<{ id: string; tenant_id: string; email: string }>();
  // Una consulta caída falla igual para cualquier correo: decirlo no revela nada.
  if (clientUserError) return { error: NO_PUDIMOS_ATENDER, email };
  // `sameEmail` y no sólo la fila: `*` no se puede escapar (ver `email-literal.ts`).
  // Sin esto se le acuña un enlace y una cuenta de Auth al correo que escribió, sin
  // que el equipo lo haya habilitado.
  if (!clientUser || !sameEmail(clientUser.email, email)) {
    // SDD-0279 · sin fila de acceso NO quiere decir "desconocido". La mayoría de
    // los clientes vivos del ERP nunca fue invitada al portal: pedían el enlace
    // y esperaban para siempre un correo que nadie mandaba.
    //
    // Si es cliente, se le avisa a él y al equipo, y un humano le devuelve el
    // acceso por el flujo de invitación. NO se le manda a `/registro`: con
    // documento cargado choca contra el dedup y vuelve acá (bucle), y sin
    // documento le emite un Shipping Mark nuevo que le parte el historial
    // (medido en `lib/studio/portal/sin-acceso.ts`).
    //
    // Si NO es cliente, no sale ningún correo. Es lo que impide que `/entrar`
    // sirva para mandarle correo de DTD a un tercero cualquiera.
    const cliente = await findClienteSinAcceso(admin, email);
    if (cliente) await avisarClienteSinAcceso(admin, cliente, email);
    return requestReceived(prev, email);
  }

  // 🔴 Para Auth, acuñar cuenta como envío: `generateLink` escribe
  // `recovery_sent_at`, y el `/otp` de los 60 s siguientes
  // (`GOTRUE_SMTP_MAX_FREQUENCY`) da 429 sin mandar nada. El plan B sólo existe
  // ANTES de acuñar: sin Resend se va directo a Auth, que es como el entorno de
  // prueba entrega en Mailpit.
  if (!resendPuedeEnviar()) return sendMagicLinkLegacy(prev, email);

  // Camino nuevo: acuñar `token_hash` y mandarlo por nuestro pipeline.
  const tokenHash = await mintPortalMagicToken(admin, email);
  if (!tokenHash) return sendMagicLinkLegacy(prev, email);

  const sent = await sendPortalMagicLinkEmail(admin, clientUser.tenant_id, {
    email,
    url: portalOpenUrl(tokenHash),
  });
  // Ya se acuñó: Auth no puede cubrirlo. El detalle queda en `mail_logs`, y de ahí
  // lo levanta `/api/cron/mail-health`; acá va sin el correo ni el texto del
  // proveedor, que puede repetirlo.
  if (!sent.ok || sent.queued) {
    console.error("[entrar] el enlace no salió:", sent.ok ? "queued" : "failed");
  }
  return requestReceived(prev, email);
}
