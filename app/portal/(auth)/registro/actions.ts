"use server";

/**
 * Registro self-service del Portal del Cliente (SDD-0042 Fase 6 · slice 10.1).
 *
 * El cliente se da de alta SOLO (sin invitación admin) y queda con cuenta
 * ACTIVA: MARKBOX al instante + cuenta de auth (login = MARKBOX + contraseña,
 * contraseña inicial = cédula/RIF). El gate de aprobación de la Fase 5 queda en
 * stand-by — el insert setea `portal_approved_at = now()`.
 *
 * Flujo (los pasos 7-9 son best-effort: un fallo en email NO rompe el alta):
 *   1. validar (validateRegisterInput, sin Zod)
 *   2. dedup por documento (clients del tenant con lower(rif)=doc o lower(cedula_*))
 *   3. resolver el tenant operativo de DTD
 *   4. rpc next_markbox → MARKBOX atómico
 *   5. subir la foto de cédula/RIF a Storage privado (bucket client-docs)
 *   6. insert clients ACTIVO (portal_approved_at=now, tier 'regular', cedula_photo_path)
 *   7. auth.admin.createUser({ email, password: <documento>, email_confirm: true })
 *   8. insert client_users (auth_user_id, status 'active', email)
 *   9. welcome email SIN la clave (reusa sendWelcomeEmail · template welcome_markbox)
 *
 * Todo el alta corre con el admin client (service_role): el registrante es
 * anónimo y necesita bypassear RLS para insertar clients/client_users + subir la
 * foto. Sin SUPABASE_SERVICE_ROLE_KEY el alta no puede completarse (error claro).
 */

import { createAdminClient } from "@/lib/db/admin";
import { sendWelcomeEmail } from "@/lib/studio/welcome-email";
import { validateMarkboxFormat } from "@/lib/studio/markbox-utils";
import {
  validateRegisterInput,
  composeAddress,
  type RegisterActionState,
  type RegisterInput,
} from "@/lib/portal/register-types";

const PHOTO_BUCKET = "client-docs";
const PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8MB
const PHOTO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function parseForm(formData: FormData): Partial<RegisterInput> {
  const kindRaw = String(formData.get("kind") ?? "persona");
  return {
    kind: kindRaw === "empresa" ? "empresa" : "persona",
    name: (formData.get("name") as string | null) ?? undefined,
    company: (formData.get("company") as string | null) ?? undefined,
    document: (formData.get("document") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    whatsapp: (formData.get("whatsapp") as string | null) ?? undefined,
    officePhone: (formData.get("office_phone") as string | null) ?? undefined,
    state: (formData.get("state") as string | null) ?? undefined,
    municipio: (formData.get("municipio") as string | null) ?? undefined,
    city: (formData.get("city") as string | null) ?? undefined,
    postalCode: (formData.get("postal_code") as string | null) ?? undefined,
    barrio: (formData.get("barrio") as string | null) ?? undefined,
    address: (formData.get("address") as string | null) ?? undefined,
    reference: (formData.get("reference") as string | null) ?? undefined,
  };
}

export async function registerClientAction(
  _prev: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  // 1. Validar
  const { input, fieldErrors } = validateRegisterInput(parseForm(formData));
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  // Foto de identidad OBLIGATORIA — validar antes de gastar correlativo.
  const photoRaw = formData.get("cedula_photo");
  if (!(photoRaw instanceof File) || photoRaw.size <= 0) {
    return { fieldErrors: { document: "Subí la foto de tu cédula/RIF." } };
  }
  if (!PHOTO_ALLOWED_MIME.has(photoRaw.type)) {
    return { fieldErrors: { document: "Formato de foto inválido (JPG/PNG/WebP/HEIC)." } };
  }
  if (photoRaw.size > PHOTO_MAX_BYTES) {
    return { fieldErrors: { document: "Foto demasiado pesada (máx 8 MB)." } };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "El registro no está disponible ahora. Probá de nuevo en un rato.",
    };
  }

  // 3. Resolver el tenant operativo de DTD (hoy uno solo; multi-tenant signup = futuro).
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantErr || !tenantRow?.id) {
    return { error: "No pudimos resolver tu cuenta. Contactá a tu asesor." };
  }
  const tenantId = tenantRow.id;

  // 2. Dedup por documento (RIF en empresa; cédula guardada en rif para persona —
  //    el módulo Clientes guarda el documento en `clients.rif`). Comparamos en
  //    minúsculas contra el documento canónico.
  const docLower = input.document.toLowerCase();
  const { data: dup } = await admin
    .from("clients")
    .select("id, markbox")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .ilike("rif", docLower)
    .limit(1)
    .maybeSingle<{ id: string; markbox: string }>();
  if (dup) {
    return {
      fieldErrors: {
        document: `Este ${input.kind === "empresa" ? "RIF" : "cédula"} ya tiene una cuenta en DTD Cargo. Si sos vos, entrá con tu MARKBOX o pedí recuperar tu contraseña.`,
      },
    };
  }

  // 4. MARKBOX atómico.
  const { data: markboxData, error: markboxErr } = await admin.rpc("next_markbox", {
    p_tenant_id: tenantId,
  });
  if (markboxErr || !markboxData) {
    return { error: "No pudimos generar tu código. Probá de nuevo." };
  }
  const markbox = String(markboxData);
  if (!validateMarkboxFormat(markbox)) {
    return { error: "No pudimos generar tu código. Probá de nuevo." };
  }

  // 5. Subir la foto a Storage privado. Path: {tenant_id}/{markbox}/{uuid}.{ext}
  const ext = mimeToExt(photoRaw.type);
  const photoPath = `${tenantId}/${markbox}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await photoRaw.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(photoPath, buffer, {
      contentType: photoRaw.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[registerClientAction] foto upload error:", uploadErr);
    return { error: "No pudimos guardar tu foto de identidad. Probá de nuevo." };
  }

  // 6. Insert del cliente ACTIVO (portal_approved_at = now, tier standard, foto).
  const { data: clientRow, error: clientErr } = await admin
    .from("clients")
    .insert({
      tenant_id: tenantId,
      markbox,
      name: input.company ?? input.name,
      email: input.email,
      phone: input.whatsapp,
      address: composeAddress(input),
      rif: input.document,
      // El enum client_tier es regular|vip|premium (sin 'standard'): el alta
      // self-service entra como 'regular', que es además el default de la tabla.
      tier: "regular",
      cedula_photo_path: photoPath,
      portal_approved_at: new Date().toISOString(),
      notes:
        input.kind === "empresa"
          ? `Contacto: ${input.name}${input.officePhone ? ` · Tel. oficina: ${input.officePhone}` : ""}`
          : input.officePhone
            ? `Tel. oficina: ${input.officePhone}`
            : null,
    })
    .select("id")
    .single<{ id: string }>();
  if (clientErr || !clientRow) {
    // Rollback de la foto huérfana.
    await admin.storage.from(PHOTO_BUCKET).remove([photoPath]).catch(() => {});
    console.error("[registerClientAction] insert clients error:", clientErr);
    return { error: `No pudimos crear tu cuenta: ${clientErr?.message ?? "error"}` };
  }

  // 7. Crear la cuenta de auth · contraseña inicial = documento (cédula/RIF).
  const { data: authResp, error: authErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.document,
    email_confirm: true,
    user_metadata: { portal_markbox: markbox, tenant: "dtd-cargo" },
  });
  if (authErr || !authResp?.user) {
    const msg = (authErr?.message ?? "").toLowerCase();
    // El cliente ya existe en clients (markbox emitido). Si el email ya tiene
    // cuenta de auth, no podemos crear la contraseña-cédula → guía a recuperar.
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        markbox,
        warning:
          "Tu cuenta quedó creada, pero ese email ya tenía acceso. Entrá con tu MARKBOX o pedí recuperar tu contraseña.",
      };
    }
    console.error("[registerClientAction] createUser error:", authErr);
    return {
      markbox,
      warning:
        "Tu cuenta quedó creada con tu MARKBOX, pero no pudimos activar el login automático. Pedí recuperar tu contraseña desde el login.",
    };
  }

  // 8. Vincular el auth.user con el cliente (client_users active). Best-effort:
  //    si falla, el cliente igual tiene MARKBOX; un admin puede re-vincular.
  const { error: linkErr } = await admin.from("client_users").insert({
    tenant_id: tenantId,
    client_id: clientRow.id,
    email: input.email,
    auth_user_id: authResp.user.id,
    status: "active",
    bound_at: new Date().toISOString(),
  });
  if (linkErr) {
    console.error("[registerClientAction] insert client_users error:", linkErr);
  }

  // 9. Email de bienvenida SIN la clave (template welcome_markbox: solo markbox +
  //    link al portal). Best-effort.
  let warning: string | undefined;
  const welcome = await sendWelcomeEmail(admin, tenantId, {
    markbox,
    name: input.name,
    email: input.email,
  });
  if (!welcome.ok) {
    warning = "Cuenta creada. El email de bienvenida no se pudo encolar.";
    console.warn("[registerClientAction] welcome email failed:", welcome.error);
  }

  return { ok: true, markbox, warning };
}
