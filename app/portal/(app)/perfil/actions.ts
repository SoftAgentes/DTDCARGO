"use server";

/**
 * "Mi perfil" unificado (SDD-0145 · reemplaza al "Completa tu perfil" del
 * registro express). La única mutación self-service de IDENTIDAD es la foto de
 * cédula/RIF (verificación): el cliente la sube desde la fila de documento
 * pendiente. La dirección canónica vive en `client_delivery_addresses`
 * (SDD-0138 · address-actions.ts) y el resto de los datos los media el asesor.
 *
 * Misma defensa en profundidad que el resto del portal: identidad por SESIÓN
 * (`get_portal_client_id`, helper aislada) → escritura con ADMIN client
 * (service_role) scopeada EXPLÍCITO a ese id (la RLS del portal es read-only
 * para `clients`; el cliente nunca toca el bucket privado directo). Limpieza de
 * la foto nueva sólo ante rechazo confirmado; una respuesta perdida exige
 * reconciliar el puntero autorizado antes de decidir. Reemplazar una foto ya
 * cargada consume uno de los 3 cambios (SDD-0439 · SDD-0481). La foto
 * sustituida no se borra: queda como versión en el ledger restringido
 * (MP-01 §9, «no purgar» hasta que exista la purga gobernada).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadClientPhoto,
} from "@/lib/portal/client-photo";
import {
  normalizeDocByKind,
  type ClientDocKind,
} from "@/lib/studio/client-types";
import { normalizePhone } from "@/lib/studio/estimado-linking";
import { getOpenChangeRequest } from "@/lib/portal/change-request-queries";
import {
  buildChangeRequestDiff,
  mapChangeRequestRow,
  type EditableField,
} from "@/lib/portal/change-request-types";
import { notifyChangeRequestToAdmin } from "@/lib/studio/change-request-notify";
import { getPortalProfileEditQuota } from "@/lib/portal/profile-edit-quota";

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
  // 1. Identidad por SESIÓN: el client_id del portal logueado.
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = portalClientId as string;

  // 2. Validar la foto (obligatoria: esta action ES la subida de la foto).
  const v = validatePhotoFile(formData.get("cedula_photo"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al id verificado por sesión): tenant + markbox
  //    para construir el path privado. Un reemplazo consume cupo: si no queda,
  //    se corta ANTES de subir para no crear otro objeto sensible que luego
  //    dependa de un rollback. La RPC vuelve a imponer el límite con lock.
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, cedula_photo_path, deleted_at")
    .eq("id", clientId)
    .maybeSingle<{
      tenant_id: string;
      markbox: string;
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
  const up = await uploadClientPhoto(admin, row.tenant_id, row.markbox, v.file);
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
    // un cliente retirado/fusionado ni un prefijo que cambió concurrentemente.
    let current;
    try {
      const identity = await supabase.rpc("get_portal_client_id");
      if (identity.error || identity.data !== clientId) return uncertain();
      const result = await admin
        .from("clients")
        .select("tenant_id, markbox, cedula_photo_path, deleted_at")
        .eq("id", clientId)
        .maybeSingle<{
          tenant_id: string;
          markbox: string;
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
      current.tenant_id !== row.tenant_id ||
      current.markbox !== row.markbox ||
      !up.path.startsWith(`${row.tenant_id}/${row.markbox}/`) ||
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

// ── Solicitud de cambio de datos (SDD-0151) ──────────────────────────────────

export type ChangeRequestActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<EditableField, string>>;
};

/**
 * El cliente PROPONE un cambio a sus datos de identidad (nombre, cédula/RIF,
 * teléfono). No escribe `clients`: crea una solicitud PENDING que el asesor
 * aprueba en el Studio. Mismo blindaje que el resto del portal: identidad por
 * SESIÓN (`get_portal_client_id`) → escritura con ADMIN client (service_role)
 * scopeada a ese id. Solo persiste los campos que CAMBIAN (diff), snapshotea los
 * valores previos, y rechaza si ya hay una solicitud abierta (una a la vez).
 */
export async function submitDataChangeRequestAction(
  _prev: ChangeRequestActionState,
  formData: FormData,
): Promise<ChangeRequestActionState> {
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = portalClientId as string;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // Estado actual (scopeado al id verificado por sesión).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, name, rif, phone, doc_kind, advisor_id")
    .eq("id", clientId)
    .maybeSingle<{
      tenant_id: string;
      markbox: string;
      name: string | null;
      rif: string | null;
      phone: string | null;
      doc_kind: string | null;
      advisor_id: string | null;
    }>();
  if (rowErr || !row) {
    return { error: "No pudimos cargar tu cuenta. Prueba de nuevo." };
  }

  // Una sola solicitud abierta (refleja el índice único parcial; UX antes del 23505).
  const open = await getOpenChangeRequest(admin, clientId);
  if (open) {
    return {
      error:
        "Ya tienes una solicitud en revisión. Espera a que tu asesor la revise.",
    };
  }

  const kind: ClientDocKind = row.doc_kind === "empresa" ? "empresa" : "persona";
  const fieldErrors: Partial<Record<EditableField, string>> = {};

  // ── Parseo + validación por campo. proposed_* = solo lo que CAMBIA. ──
  const nameRaw = String(formData.get("name") ?? "").trim();
  const docRaw = String(formData.get("doc") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  let proposedName: string | null = null;
  let proposedRif: string | null = null;
  let proposedPhone: string | null = null;

  if (nameRaw) {
    if (nameRaw.length < 2 || nameRaw.length > 120) {
      fieldErrors.name = "Escribe tu nombre completo.";
    } else if (nameRaw !== (row.name ?? "").trim()) {
      proposedName = nameRaw;
    }
  }

  if (docRaw) {
    const norm = normalizeDocByKind(kind, docRaw);
    if (!norm) {
      fieldErrors.doc =
        kind === "empresa"
          ? "RIF inválido. Formato J-12345678-9."
          : "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567.";
    } else if (norm !== (row.rif ?? "").trim()) {
      proposedRif = norm;
    }
  }

  if (phoneRaw) {
    const digits = normalizePhone(phoneRaw);
    if (digits.length < 7 || digits.length > 15) {
      fieldErrors.phone = "Teléfono inválido.";
    } else if (digits !== normalizePhone(row.phone)) {
      proposedPhone = phoneRaw;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Revisa los datos marcados.", fieldErrors };
  }

  if (proposedName == null && proposedRif == null && proposedPhone == null) {
    return { error: "No cambiaste ningún dato." };
  }

  // Insert PENDING con snapshot de los valores previos (para el diff + auditoría).
  const { data: inserted, error: insErr } = await admin
    .from("client_change_requests")
    .insert({
      tenant_id: row.tenant_id,
      client_id: clientId,
      proposed_name: proposedName,
      proposed_rif: proposedRif,
      proposed_phone: proposedPhone,
      prev_name: row.name,
      prev_rif: row.rif,
      prev_phone: row.phone,
      status: "pending",
      source: "client",
      submitted_by: user?.id ?? null,
    })
    .select(
      "id, tenant_id, client_id, proposed_name, proposed_rif, proposed_phone, prev_name, prev_rif, prev_phone, status, submitted_at, reviewed_at, reviewed_by, review_note",
    )
    .single();

  if (insErr) {
    // 23505 = índice único parcial: otra solicitud abierta ganó la carrera.
    if ((insErr as { code?: string }).code === "23505") {
      return {
        error:
          "Ya tienes una solicitud en revisión. Espera a que tu asesor la revise.",
      };
    }
    if (insErr.message?.includes("profile_edit_limit_reached")) {
      return { error: PROFILE_EDIT_LIMIT_REACHED };
    }
    console.error("[submitDataChangeRequestAction] insert error:", insErr);
    return { error: "No pudimos guardar tu solicitud. Prueba de nuevo." };
  }

  // Aviso al equipo (best-effort, nunca tira).
  const request = mapChangeRequestRow(
    inserted as Parameters<typeof mapChangeRequestRow>[0],
  );
  await notifyChangeRequestToAdmin(admin, {
    tenantId: row.tenant_id,
    markbox: row.markbox,
    clientName: row.name ?? row.markbox,
    advisorId: row.advisor_id,
    diff: buildChangeRequestDiff(request, kind === "empresa"),
  });

  revalidatePath("/portal/perfil");
  return { ok: true };
}

/**
 * El cliente CANCELA su solicitud pendiente (se equivocó / ya no quiere el
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
