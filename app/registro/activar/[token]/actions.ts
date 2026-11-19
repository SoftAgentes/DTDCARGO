"use server";

/**
 * SDD-0672 (entrega 2) · el POST del enlace de autoservicio.
 *
 * El cliente YA tiene ficha y nunca tuvo portal; el enlace le llegó al correo de
 * la ficha desde `/entrar`. Este formulario completa ESA ficha, igual que el
 * registro por link de la SDD-0646, con una diferencia: el portal sólo se activa
 * si la cédula/RIF o el WhatsApp coinciden con lo que la ficha ya tenía (la guarda
 * de `portal_registration_link_complete_self`, migración 0562).
 *
 * Orden, a propósito:
 *   1. validar con `validateRegisterInput` y pasar el throttle por IP de
 *      `/registro` (5 por hora)
 *   2. `portal_registration_link_complete_self` — la guarda primero. Si no
 *      coincide, no toca la ficha, no gasta el enlace (suma un intento; con 3,
 *      muere) y el cliente lee un mensaje que NO dice cuál dato falló: el mismo
 *      que para un correo que ya tiene cuenta.
 *   3. Si dejó el MISMO correo al que llegó el enlace, ese correo quedó probado:
 *      cuenta de Auth con el correo real y `portal_registration_link_bind_self`
 *      (sin «sin comprobar»).
 *      Si lo cambió, el camino de la SDD-0646 D-1: dirección interna,
 *      `portal_registration_link_bind` y enlace de comprobación al correo nuevo.
 *   4. magic-link recién acuñado para la cuenta → «Entrar a mi portal».
 * Si 3 falla, la ficha ya quedó completa: se anota `access_error` para que el
 * equipo lo vea en «Registros por link», y al cliente se le dice que lo
 * contactamos.
 */

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import { generatePortalAccessLink } from "@/lib/studio/portal-invite-email";
import {
  emitirYEnviarComprobacion,
  nuevoCorreoInterno,
} from "@/lib/studio/portal/correo-comprobacion";
import { validateRegisterInput, type RegisterInput } from "@/lib/portal/register-types";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import {
  isRegistroTokenShape,
  registroLinkErrorKind,
  REGISTRO_AUTOSERVICIO_INVALIDO,
  REGISTRO_AUTOSERVICIO_NO_SIRVEN,
  type RegistroLinkActionState,
} from "@/lib/portal/registro-link-types";

/** Campo trampa (mismo nombre que el registro normal). */
const HONEYPOT_FIELD = "empresa_web";

// Throttle por IP: la MISMA tabla y los mismos topes que /registro (SDD-0042 §10).
// Además de frenar bots, impide usar un enlace vivo para probar cédulas o correos
// uno tras otro (la base, además, mata el enlace al tercer intento que no coincide).
const REGISTRO_IP_LIMIT = 5;
const REGISTRO_WINDOW_MINUTES = 60;
const THROTTLE_TABLE = "portal_registro_throttle";

const PENDIENTE =
  "Tus datos quedaron guardados, pero no pudimos activar tu acceso al portal. Te contactamos por WhatsApp para resolverlo.";

function parseForm(formData: FormData): Partial<RegisterInput> {
  const str = (k: string) => (formData.get(k) as string | null) ?? undefined;
  return {
    kind: String(formData.get("kind") ?? "persona") === "empresa" ? "empresa" : "persona",
    name: str("name"),
    company: str("company"),
    document: str("document"),
    email: str("email"),
    whatsapp: str("whatsapp"),
    officePhone: str("office_phone"),
    city: str("city"),
    state: str("state"),
    emailOptin: formData.get("email_optin") != null,
  };
}

type CompleteSelfRow = {
  estado: "ok" | "no_coincide";
  tenant_id: string | null;
  markbox: string | null;
  email: string | null;
  link_id: string | null;
  correo_probado: boolean | null;
};

export async function registerBySelfLinkAction(
  _prev: RegistroLinkActionState,
  formData: FormData,
): Promise<RegistroLinkActionState> {
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    return { error: "No pudimos procesar tu registro. Prueba de nuevo." };
  }

  const token = String(formData.get("token") ?? "");
  if (!isRegistroTokenShape(token)) return { error: REGISTRO_AUTOSERVICIO_INVALIDO };

  const { input, fieldErrors } = validateRegisterInput(parseForm(formData));
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const address = String(formData.get("address") ?? "").trim();
  if (address.length > 300) {
    return { fieldErrors: { address: "La dirección es demasiado larga (máx 300)." } };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "El registro no está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 1b. Throttle por IP, antes de tocar la ficha (fail-open, como /registro).
  const ip = await getRequestIp();
  const windowStart = new Date(Date.now() - REGISTRO_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: recentCount, error: throttleErr } = await admin
    .from(THROTTLE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (!throttleErr && (recentCount ?? 0) >= REGISTRO_IP_LIMIT) {
    return { error: "Demasiados intentos desde tu conexión. Prueba de nuevo en un rato." };
  }
  await admin.from(THROTTLE_TABLE).insert({ ip });

  // 2. La guarda y, si pasa, la ficha (todo o nada en la base).
  const { data, error } = await admin.rpc("portal_registration_link_complete_self", {
    p_token_hash: hashRegistroToken(token),
    p_kind: input.kind,
    p_name: input.name,
    p_company: input.company,
    p_document: input.document,
    p_email: input.email,
    p_phone: input.whatsapp,
    p_office_phone: input.officePhone,
    p_city: input.city,
    p_state: input.state,
    p_address: address || null,
    p_email_optin: input.emailOptin,
  });

  if (error) {
    // Sin la migración 0562 la función no existe: el enlace no puede servir.
    if (error.code === "PGRST202" || error.code === "42883") {
      return { error: REGISTRO_AUTOSERVICIO_INVALIDO };
    }
    const kind = registroLinkErrorKind(error);
    if (kind === "invalido") return { error: REGISTRO_AUTOSERVICIO_INVALIDO };
    // El MISMO mensaje que un dato que no coincide: no dice qué correos tienen cuenta.
    if (kind === "correo") return { error: REGISTRO_AUTOSERVICIO_NO_SIRVEN };
    if (kind === "datos") return { error: "Revisa los datos: falta alguno obligatorio." };
    console.error("[registerBySelfLinkAction] complete_self falló:", error.code);
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as CompleteSelfRow | null | undefined;
  // La guarda no pasó. No dice cuál dato: ni que la cédula no coincidió, ni el WhatsApp.
  if (row?.estado === "no_coincide") return { error: REGISTRO_AUTOSERVICIO_NO_SIRVEN };
  if (row?.estado !== "ok" || !row.markbox || !row.link_id || !row.email) {
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }
  const { markbox, link_id: linkId, email } = row;

  // 3a. Dejó el mismo correo al que llegó el enlace: ese correo está probado.
  if (row.correo_probado === true) {
    const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: { portal_markbox: markbox, tenant: "dtd-cargo" },
    });
    if (authErr || !authResp?.user) {
      await admin.rpc("portal_registration_link_access_error", {
        p_link_id: linkId,
        p_error: `createUser: ${authErr?.message ?? "sin usuario"}`,
      });
      return { ok: true, markbox, portalUrl: null, warning: PENDIENTE };
    }
    const { error: bindErr } = await admin.rpc("portal_registration_link_bind_self", {
      p_link_id: linkId,
      p_auth_user_id: authResp.user.id,
    });
    if (bindErr) {
      await admin.rpc("portal_registration_link_access_error", {
        p_link_id: linkId,
        p_error: `bind_self: ${bindErr.message}`,
      });
      return { ok: true, markbox, portalUrl: null, warning: PENDIENTE };
    }
    const portalUrl = await generatePortalAccessLink(admin, email);
    return { ok: true, markbox, portalUrl };
  }

  // 3b. Cambió el correo: el nuevo no está probado. Camino de la SDD-0646 D-1.
  const correoInterno = nuevoCorreoInterno();
  const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
    email: correoInterno,
    password: randomBytes(24).toString("base64url"),
    email_confirm: false,
    user_metadata: { portal_markbox: markbox, tenant: "dtd-cargo" },
  });
  if (authErr || !authResp?.user) {
    await admin.rpc("portal_registration_link_access_error", {
      p_link_id: linkId,
      p_error: `createUser: ${authErr?.message ?? "sin usuario"}`,
    });
    return { ok: true, markbox, portalUrl: null, warning: PENDIENTE };
  }
  const { error: bindErr } = await admin.rpc("portal_registration_link_bind", {
    p_link_id: linkId,
    p_auth_user_id: authResp.user.id,
  });
  if (bindErr) {
    await admin.rpc("portal_registration_link_access_error", {
      p_link_id: linkId,
      p_error: `bind: ${bindErr.message}`,
    });
    return { ok: true, markbox, portalUrl: null, warning: PENDIENTE };
  }
  const { data: check } = await admin
    .from("client_email_checks")
    .select("id")
    .eq("link_id", linkId)
    .maybeSingle<{ id: string }>();
  if (check?.id) {
    const envio = await emitirYEnviarComprobacion(admin, check.id);
    if (!envio.ok) console.warn("[registerBySelfLinkAction] la comprobación no salió");
  } else {
    console.warn("[registerBySelfLinkAction] el registro no quedó anotado para comprobar");
  }
  const portalUrl = await generatePortalAccessLink(admin, correoInterno);
  return { ok: true, markbox, portalUrl, correoPorComprobar: true };
}
