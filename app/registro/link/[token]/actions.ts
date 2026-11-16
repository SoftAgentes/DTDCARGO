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
 *   1. validar con `validateRegisterInput` (las MISMAS reglas del registro)
 *   2. `portal_registration_link_complete` — todo o nada en la base: completa la
 *      ficha, gasta el link, guarda antes/después y marca el duplicado sin
 *      fusionar. Un correo con cuenta se rechaza ANTES de gastar el link.
 *   3. cuenta de auth con contraseña aleatoria (nunca la cédula)
 *   4. `portal_registration_link_bind` → client_users activo
 *   5. magic-link recién acuñado → botón «Entrar a mi portal»
 * Si 3 o 4 fallan, la ficha ya quedó completa: se anota `access_error` para que
 * el equipo lo vea en «Registros por link» y al cliente se le dice que lo
 * contactamos.
 */

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { generatePortalAccessLink } from "@/lib/studio/portal-invite-email";
import { validateRegisterInput, type RegisterInput } from "@/lib/portal/register-types";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import {
  isRegistroTokenShape,
  registroLinkErrorKind,
  REGISTRO_LINK_CORREO_EN_USO,
  REGISTRO_LINK_INVALIDO,
  type RegistroLinkActionState,
} from "@/lib/portal/registro-link-types";

/** Campo trampa (mismo nombre que el registro normal). */
const HONEYPOT_FIELD = "empresa_web";

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
    if (kind === "correo") return { fieldErrors: { email: REGISTRO_LINK_CORREO_EN_USO } };
    if (kind === "datos") return { error: "Revisa los datos: falta alguno obligatorio." };
    console.error("[registerByLinkAction] complete falló:", error.code);
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { markbox: string; email: string; link_id: string }
    | null
    | undefined;
  if (!row?.markbox) {
    return { error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un rato." };
  }

  const pendiente =
    "Tus datos quedaron guardados, pero no pudimos activar tu acceso al portal. Te contactamos por WhatsApp para resolverlo.";

  // 3. Cuenta de auth con contraseña ALEATORIA (el cliente entra por enlace).
  const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
    email: row.email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
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

  // 5. Un clic y adentro. Si el enlace no se pudo acuñar, el login por correo
  //    sigue sirviendo: ya tiene cuenta con ese correo.
  const portalUrl = await generatePortalAccessLink(admin, row.email);
  return { ok: true, markbox: row.markbox, portalUrl };
}
