"use server";

/**
 * Registro al portal por link (SDD-0646) — el POST.
 *
 * El cliente YA tiene ficha (los del legado: DTD-8xxx, casi sin datos). Este
 * formulario completa ESA ficha: no hay `next_markbox_service`, no se crea ficha
 * ni código. Mismo patrón que `app/registro/actions.ts`: ruta pública con el
 * admin client y el visitante anónimo; el control es el token (256 bits, un solo
 * uso, 14 días) y el honeypot.
 *
 * Orden, a propósito:
 *   1. validar con `validateRegisterInput` (las MISMAS reglas del registro) y
 *      pasar el throttle por IP de `/registro`
 *   2. `portal_registration_link_complete` — todo o nada en la base: completa la
 *      ficha, gasta el link, guarda antes/después y marca el duplicado sin
 *      fusionar. Un correo con cuenta se rechaza ANTES de gastar el link.
 *   3. cuenta de auth con contraseña aleatoria (nunca la cédula) y con una
 *      DIRECCIÓN INTERNA que no recibe correo (D-1, opción C): el correo que
 *      escribió el cliente no entra a la cuenta hasta que su dueño lo compruebe
 *   4. `portal_registration_link_bind` → client_users activo y el correo
 *      anotado «sin comprobar»
 *   5. correo con el enlace de comprobación (sólo comprueba, no abre sesión) y
 *      magic-link recién acuñado para la cuenta → «Entrar a mi portal»
 * Si 3 o 4 fallan, la ficha ya quedó completa: se anota `access_error` para que
 * el equipo lo vea en «Registros por link» y al cliente se le dice que lo
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
  REGISTRO_LINK_DATOS_NO_SIRVEN,
  REGISTRO_LINK_INVALIDO,
  type RegistroLinkActionState,
} from "@/lib/portal/registro-link-types";

/** Campo trampa (mismo nombre que el registro normal). */
const HONEYPOT_FIELD = "empresa_web";

// Throttle por IP: la MISMA tabla y los mismos topes que /registro (SDD-0042 §10).
// Además de frenar bots, impide usar un link vivo para probar correos uno tras
// otro: «correo en uso» no gasta el link.
const REGISTRO_IP_LIMIT = 5;
const REGISTRO_WINDOW_MINUTES = 60;
const THROTTLE_TABLE = "portal_registro_throttle";

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

export async function registerByLinkAction(
  _prev: RegistroLinkActionState,
  formData: FormData,
): Promise<RegistroLinkActionState> {
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    return { error: "No pudimos procesar tu registro. Prueba de nuevo." };
  }

  const token = String(formData.get("token") ?? "");
  if (!isRegistroTokenShape(token)) return { error: REGISTRO_LINK_INVALIDO };

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

  // 1b. Throttle por IP, antes de tocar la ficha. Igual que /registro: si falla
  //     la lectura, no se bloquea un registro legítimo (fail-open).
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

  // 2. Completar la ficha (todo o nada en la base).
  const { data, error } = await admin.rpc("portal_registration_link_complete", {
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
    const kind = registroLinkErrorKind(error);
    if (kind === "invalido") return { error: REGISTRO_LINK_INVALIDO };
    // Mensaje genérico, sin señalar el correo: que no sirva para saber qué
    // correos tienen cuenta en DTD Cargo.
    if (kind === "correo") return { error: REGISTRO_LINK_DATOS_NO_SIRVEN };
    if (kind === "datos") return { error: "Revisa los datos: falta alguno obligatorio." };
    console.error("[registerByLinkAction] complete falló:", error.code);
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { tenant_id: string; markbox: string; email: string; link_id: string }
    | null
    | undefined;
  if (!row?.markbox) {
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }

  const pendiente =
    "Tus datos quedaron guardados, pero no pudimos activar tu acceso al portal. Te contactamos por WhatsApp para resolverlo.";

  // 3. Cuenta de auth con contraseña ALEATORIA (el cliente entra por enlace).
  //    SDD-0646 D-1 (opción C): el link de WhatsApp prueba quién es la persona,
  //    no que el correo sea suyo. La cuenta nace con una dirección interna que
  //    no recibe correo; el correo que escribió queda en la ficha, sin
  //    comprobar, y pasa a la cuenta cuando su dueño lo confirma.
  const correoInterno = nuevoCorreoInterno();
  const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
    email: correoInterno,
    password: randomBytes(24).toString("base64url"),
    email_confirm: false,
    user_metadata: { portal_markbox: row.markbox, tenant: "dtd-cargo" },
  });
  if (authErr || !authResp?.user) {
    await admin.rpc("portal_registration_link_access_error", {
      p_link_id: row.link_id,
      p_error: `createUser: ${authErr?.message ?? "sin usuario"}`,
    });
    return { ok: true, markbox: row.markbox, portalUrl: null, warning: pendiente };
  }

  // 4. Vincular la cuenta con la ficha.
  const { error: bindErr } = await admin.rpc("portal_registration_link_bind", {
    p_link_id: row.link_id,
    p_auth_user_id: authResp.user.id,
  });
  if (bindErr) {
    await admin.rpc("portal_registration_link_access_error", {
      p_link_id: row.link_id,
      p_error: `bind: ${bindErr.message}`,
    });
    return { ok: true, markbox: row.markbox, portalUrl: null, warning: pendiente };
  }

  // 4b. Enlace de comprobación al correo que escribió (D-1, opción C). Sólo
  //     comprueba el correo: no abre sesión. Si no sale, no frena la entrada:
  //     el equipo lo reenvía desde «Registros por link».
  const { data: check } = await admin
    .from("client_email_checks")
    .select("id")
    .eq("link_id", row.link_id)
    .maybeSingle<{ id: string }>();
  if (check?.id) {
    const envio = await emitirYEnviarComprobacion(admin, check.id);
    if (!envio.ok) console.warn("[registerByLinkAction] la comprobación no salió");
  } else {
    console.warn("[registerByLinkAction] el registro no quedó anotado para comprobar");
  }

  // 5. Un clic y adentro: el enlace se acuña para la cuenta (su dirección
  //    interna) y se entrega en esta misma página; no sale por correo.
  const portalUrl = await generatePortalAccessLink(admin, correoInterno);
  return { ok: true, markbox: row.markbox, portalUrl, correoPorComprobar: true };
}
