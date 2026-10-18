"use server";

/**
 * "Mi perfil" unificado (SDD-0145 · reemplaza al "Completa tu perfil" del
 * registro express). El cliente edita por sí mismo la foto de cédula/RIF
 * (SDD-0481) y su nombre, documento y teléfono (SDD-0482), todo dentro del cupo
 * compartido de 3 cambios. La dirección canónica vive en
 * `client_delivery_addresses` (SDD-0138 · address-actions.ts); email y
 * Shipping Mark siguen fuera del Portal.
 *
 * Misma defensa en profundidad que el resto del portal: identidad por SESIÓN
 * (`getPortalClientPrincipal`: vínculo activo, cliente vivo del mismo tenant) →
 * escritura con ADMIN client (service_role) scopeada EXPLÍCITO a ese id (la RLS
 * del portal es read-only para `clients`; el cliente nunca toca el bucket
 * privado directo). Tenant y Shipping Mark salen del principal, no de releer
 * `clients` con el admin (SDD-0552): el admin sólo lee lo que el principal no
 * trae (puntero de la foto, asesor). Limpieza de
 * la foto nueva sólo ante rechazo confirmado; una respuesta perdida exige
 * reconciliar el puntero autorizado antes de decidir. Reemplazar una foto ya
 * cargada consume uno de los 3 cambios (SDD-0439 · SDD-0481). La foto
 * sustituida no se borra: queda como versión en el ledger restringido
 * (MP-01 §9, «no purgar» hasta que exista la purga gobernada).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadClientPhoto,
} from "@/lib/portal/client-photo";
import { type ClientDocKind } from "@/lib/studio/client-types";
import { type EditableField } from "@/lib/portal/change-request-types";
import { notifyBlockedProfileEditToAdmin } from "@/lib/studio/change-request-notify";
import { getPortalProfileEditQuota } from "@/lib/portal/profile-edit-quota";
import {
  DIRECT_EDIT_MESSAGES,
  isDirectEditOutcome,
  validateDirectEdit,
} from "@/lib/portal/profile-direct-edit";

export type CedulaPhotoActionState = { ok?: boolean; error?: string };

// Sólo se ve si la app llega a producción antes que la migración 0461: la RPC
// todavía trae el gate de 0447 y rechaza el reemplazo.
const IDENTITY_PHOTO_REPLACEMENT_DISABLED =
  "El cambio de foto todavía no está activo. Escríbenos por soporte y te ayudamos a corregirla.";
const PROFILE_EDIT_LIMIT_REACHED =
  "Ya usaste tus 3 cambios de perfil. Si necesitas corregir algo importante, escríbenos por soporte.";
const PROFILE_EDIT_QUOTA_UNAVAILABLE =
  "No pudimos consultar tus cambios disponibles. Prueba de nuevo en un rato o escríbenos por soporte.";

export async function uploadCedulaPhotoAction(
  _prev: CedulaPhotoActionState,
  formData: FormData,
): Promise<CedulaPhotoActionState> {
  // 1. Identidad por SESIÓN: el principal Portal (cliente, tenant y markbox).
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;
  const { tenantId } = principal;
  const { markbox } = principal.client;

  // 2. Validar la foto (obligatoria: esta action ES la subida de la foto).
  const v = validatePhotoFile(formData.get("cedula_photo"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al id verificado por sesión): ¿ya tiene foto?
  //    El path privado se arma con el tenant + markbox del principal. Un
  //    reemplazo consume cupo: si no queda, se corta ANTES de subir para no
  //    crear otro objeto sensible que luego dependa de un rollback. La RPC
  //    vuelve a imponer el límite con lock.
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("cedula_photo_path, deleted_at")
    .eq("id", clientId)
    .maybeSingle<{
      cedula_photo_path: string | null;
      deleted_at: string | null;
    }>();
  if (rowErr || !row || row.deleted_at != null) {
    return { error: "No pudimos cargar tu cuenta. Prueba de nuevo." };
  }
  if (String(row.cedula_photo_path ?? "").trim()) {
    let remaining: number;
    try {
      remaining = (await getPortalProfileEditQuota(supabase)).remaining;
    } catch {
      return { error: PROFILE_EDIT_QUOTA_UNAVAILABLE };
    }
    if (remaining <= 0) return { error: PROFILE_EDIT_LIMIT_REACHED };
  }
  // 4. Subir la foto nueva al bucket privado (path nuevo por subida).
  const up = await uploadClientPhoto(admin, tenantId, markbox, v.file);
  if (up.error || !up.path) {
    console.error("[uploadCedulaPhotoAction] upload error:", up.error);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. RPC self-scope: actualiza el puntero y, si es reemplazo, consume un cupo
  //    en la MISMA transacción. La primera foto es gratuita (SDD-0439).
  let updErr: { code?: string; message?: string } | null = null;
  let mutationStatus = 0;
  try {
    const result = await supabase.rpc("portal_set_identity_photo", {
      p_new_path: up.path,
    });
    updErr = result.error;
    mutationStatus = result.status;
  } catch {
    // Transporte/SDK puede lanzar o devolver error. Ninguno prueba rollback.
    updErr = {};
  }
  if (updErr) {
    const uncertain = () => {
      console.error("[uploadCedulaPhotoAction] update uncertain", {
        reason: "identity_photo_requires_reconciliation",
      });
      return {
        error:
          "No pudimos confirmar el estado de tu foto. Conservamos la carga para no perderla. Escríbenos por soporte antes de volver a subirla.",
      };
    };
    // La sesión puede cambiar durante el upload. No reconciliar otra cuenta,
    // un cliente retirado/fusionado ni un prefijo que cambió concurrentemente:
    // el principal se resuelve otra vez y tiene que ser el mismo cliente, con
    // el mismo tenant y el mismo markbox (SDD-0552: antes se comparaban contra
    // lo que el admin releía de `clients`).
    let current;
    try {
      const again = await getPortalClientPrincipal(supabase);
      if (
        !again || again.client.id !== clientId ||
        again.tenantId !== tenantId || again.client.markbox !== markbox
      ) return uncertain();
      const result = await admin
        .from("clients")
        .select("cedula_photo_path, deleted_at")
        .eq("id", clientId)
        .maybeSingle<{
          cedula_photo_path: string | null;
          deleted_at: string | null;
        }>();
      if (result.error || !result.data) return uncertain();
      current = result.data;
    } catch {
      return uncertain();
    }
    if (
      current.deleted_at != null ||
      !up.path.startsWith(`${tenantId}/${markbox}/`) ||
      up.path.includes("..") || up.path.includes("/avatar/")
    ) return uncertain();

    if (current.cedula_photo_path === up.path) {
      // El servidor sí comprometió la foto. Nunca borrar por el error de red.
      revalidatePath("/portal");
      revalidatePath("/portal/perfil");
      return { ok: true };
    }

    // Un puntero distinto/null no prueba rollback: el commit puede seguir en
    // vuelo. Sólo estos rechazos SQL exactos de 0445/0447 prueban no-commit.
    const rejected = mutationStatus >= 400 && mutationStatus < 500 && [
      "P0001:identity_photo_replacement_temporarily_disabled",
      "P0001:profile_edit_limit_reached",
      "P0001:profile_client_not_found",
      "22023:invalid_identity_photo_path",
      "22023:identity_photo_object_not_found",
      "42501:portal_session_required",
    ].includes(`${updErr.code}:${updErr.message}`);
    if (!rejected) return uncertain();

    try {
      const { error: cleanupErr } = await admin.storage
        .from(PHOTO_BUCKET)
        .remove([up.path]);
      if (cleanupErr) throw cleanupErr;
    } catch {
      console.error("[uploadCedulaPhotoAction] rollback error", {
        reason: "storage_remove_failed",
      });
      return {
        error:
          "No pudimos completar ni retirar la carga. Escríbenos por soporte para revisar el archivo de forma segura.",
      };
    }
    console.error("[uploadCedulaPhotoAction] update rejected", {
      reason: "identity_photo_rpc_rejected",
    });
    if (
      updErr.message === "identity_photo_replacement_temporarily_disabled"
    ) {
      return { error: IDENTITY_PHOTO_REPLACEMENT_DISABLED };
    }
    if (updErr.message === "profile_edit_limit_reached") {
      return { error: PROFILE_EDIT_LIMIT_REACHED };
    }
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  revalidatePath("/portal");
  revalidatePath("/portal/perfil");
  return { ok: true };
}

// ── Edición directa de datos (SDD-0482) ──────────────────────────────────────

export type ChangeRequestActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<EditableField, string>>;
};

const RPC_FIELD_ERRORS: Record<string, [EditableField, string]> = {
  invalid_profile_name: ["name", "Escribe tu nombre completo."],
  invalid_profile_document: ["doc", "Revisa el formato de tu documento."],
  invalid_profile_phone: ["phone", "Teléfono inválido."],
};

/**
 * El cliente EDITA sus datos (nombre, cédula/RIF, teléfono) y el cambio se
 * aplica al instante (decisión de Sam, SDD-0482): sin solicitud ni aprobación,
 * dentro del cupo compartido de 3 cambios. La RPC `portal_update_my_profile`
 * (0462) resuelve el cliente por SESIÓN, bloquea la ficha, decide qué cambió,
 * bloquea duplicados sin revelarlos, cobra el cupo y deja el historial. Esta
 * action sólo normaliza, traduce el resultado y, si hubo bloqueo, avisa al
 * asesor. No toca la verificación de identidad (decisión de Sam).
 */
export async function updateMyProfileAction(
  _prev: ChangeRequestActionState,
  formData: FormData,
): Promise<ChangeRequestActionState> {
  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: DIRECT_EDIT_MESSAGES.unavailable };
  }

  // Sólo lo necesario para armar el aviso. El tenant, el markbox, el nombre y el
  // tipo de documento salen del principal; con el admin se lee únicamente el
  // asesor, que el principal no trae (SDD-0552).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("advisor_id")
    .eq("id", clientId)
    .maybeSingle<{ advisor_id: string | null }>();
  if (rowErr || !row) {
    return { error: "No pudimos cargar tu cuenta. Prueba de nuevo." };
  }

  const kind: ClientDocKind =
    principal.client.docKind === "empresa" ? "empresa" : "persona";
  const validation = validateDirectEdit(kind, {
    name: String(formData.get("name") ?? ""),
    doc: String(formData.get("doc") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!validation.ok) {
    return { error: "Revisa los datos marcados.", fieldErrors: validation.fieldErrors };
  }
  const { values } = validation;
  if (values.name == null && values.doc == null && values.phone == null) {
    return { error: DIRECT_EDIT_MESSAGES.noChanges };
  }

  let data: unknown;
  let rpcError: { code?: string; message?: string } | null;
  try {
    const result = await supabase.rpc("portal_update_my_profile", {
      p_name: values.name,
      p_doc: values.doc,
      p_phone: values.phone,
    });
    data = result.data;
    rpcError = result.error;
  } catch {
    rpcError = {};
  }

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (message === "profile_edit_limit_reached") {
      return { error: DIRECT_EDIT_MESSAGES.limitReached };
    }
    if (message === "portal_session_required") {
      return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
    }
    const fieldError = RPC_FIELD_ERRORS[message];
    if (fieldError) {
      return {
        error: "Revisa los datos marcados.",
        fieldErrors: { [fieldError[0]]: fieldError[1] },
      };
    }
    console.error("[updateMyProfileAction] rpc error", { code: rpcError.code });
    return { error: DIRECT_EDIT_MESSAGES.failed };
  }

  const first = Array.isArray(data) ? data[0] : data;
  const outcome = (first as { outcome?: unknown } | null)?.outcome;
  if (!isDirectEditOutcome(outcome)) {
    console.error("[updateMyProfileAction] resultado inesperado de la RPC");
    return { error: DIRECT_EDIT_MESSAGES.failed };
  }

  if (outcome === "applied") {
    revalidatePath("/portal");
    revalidatePath("/portal/perfil");
    return { ok: true };
  }
  if (outcome === "no_changes") return { error: DIRECT_EDIT_MESSAGES.noChanges };
  if (outcome === "rate_limited") return { error: DIRECT_EDIT_MESSAGES.rateLimited };

  // blocked · el asesor se entera con los Shipping Marks, nunca con el valor.
  try {
    const { data: attempt } = await admin
      .from("client_profile_blocked_attempts")
      .select("field, conflicting_client_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ field: string; conflicting_client_id: string | null }>();
    let conflictingMarkbox: string | null = null;
    if (attempt?.conflicting_client_id) {
      const { data: other } = await admin
        .from("clients")
        .select("markbox")
        .eq("id", attempt.conflicting_client_id)
        .maybeSingle<{ markbox: string | null }>();
      conflictingMarkbox = other?.markbox ?? null;
    }
    await notifyBlockedProfileEditToAdmin(admin, {
      tenantId: principal.tenantId,
      markbox: principal.client.markbox,
      clientName: principal.client.name,
      advisorId: row.advisor_id,
      field: attempt?.field === "phone" ? "phone" : "document",
      conflictingMarkbox,
    });
  } catch {
    console.error("[updateMyProfileAction] aviso de bloqueo falló");
  }
  return { error: DIRECT_EDIT_MESSAGES.blocked };
}

/**
 * Flujo anterior a SDD-0482 · el cliente CANCELA una solicitud pendiente que
 * haya quedado de antes (se equivocó / ya no quiere el
 * cambio). Borra SOLO la PENDING scopeada a su sesión: al no estar revisada no
 * tiene valor de auditoría, y el DELETE libera el índice único parcial → puede
 * proponer de nuevo. Si el asesor ya la resolvió (carrera), el `.eq(status,
 * 'pending')` no matchea nada y queda no-op (la UI mostrará el resultado real).
 */
export async function cancelDataChangeRequestAction(
  prev: ChangeRequestActionState,
): Promise<ChangeRequestActionState> {
  void prev;
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = portalClientId as string;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  const { error: delErr } = await admin
    .from("client_change_requests")
    .delete()
    .eq("client_id", clientId)
    .eq("status", "pending");
  if (delErr) {
    console.error("[cancelDataChangeRequestAction] delete error:", delErr);
    return { error: "No pudimos cancelar la solicitud. Prueba de nuevo." };
  }

  revalidatePath("/portal/perfil");
  return { ok: true };
}
