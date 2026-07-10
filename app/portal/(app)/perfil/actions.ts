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
 * para `clients`; el cliente nunca toca el bucket privado directo). Rollback de
 * la foto recién subida si el update falla (no dejar huérfana) + borrado
 * best-effort de la reemplazada (no dejar PII colgada).
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

export type CedulaPhotoActionState = { ok?: boolean; error?: string };

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
  //    para el path y si ya había una foto (reemplazo).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, cedula_photo_path")
    .eq("id", clientId)
    .maybeSingle<{
      tenant_id: string;
      markbox: string;
      cedula_photo_path: string | null;
    }>();
  if (rowErr || !row) {
    return { error: "No pudimos cargar tu cuenta. Prueba de nuevo." };
  }
  const oldPath = String(row.cedula_photo_path ?? "").trim() || null;

  // 4. Subir la foto nueva al bucket privado (path nuevo por subida).
  const up = await uploadClientPhoto(admin, row.tenant_id, row.markbox, v.file);
  if (up.error || !up.path) {
    console.error("[uploadCedulaPhotoAction] upload error:", up.error);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. Update con rollback de la foto recién subida si falla.
  const { error: updErr } = await admin
    .from("clients")
    .update({ cedula_photo_path: up.path })
    .eq("id", clientId);
  if (updErr) {
    await admin.storage.from(PHOTO_BUCKET).remove([up.path]).catch(() => {});
    console.error("[uploadCedulaPhotoAction] update error:", updErr);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 6. Best-effort: borrar la foto vieja reemplazada.
  if (oldPath) {
    await admin.storage.from(PHOTO_BUCKET).remove([oldPath]).catch(() => {});
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
  _prev: ChangeRequestActionState,
): Promise<ChangeRequestActionState> {
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
