"use server";

/**
 * "Mi perfil" unificado (SDD-0145 · reemplaza al "Completa tu perfil" del
 * registro express). La única mutación self-service de IDENTIDAD es la foto de
 * cédula/RIF (verificación): el cliente la sube desde la fila de documento
 * pendiente. La dirección canónica vive en `client_delivery_addresses`
 * (SDD-0138 · address-actions.ts) y el resto de los datos los media el asesor.
 *
 * Misma defensa en profundidad que el resto del portal: principal por SESIÓN
 * con vínculo cliente/tenant coherente → escritura con ADMIN client
 * (service_role) scopeada EXPLÍCITO a ese tenant e id (la RLS del portal es
 * read-only para `clients`; el cliente nunca toca el bucket privado directo). Rollback de
 * la foto recién subida si el update falla (no dejar huérfana) + borrado
 * best-effort de la reemplazada (no dejar PII colgada).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { createComponentLogger } from "@/lib/observability/structured-logger";
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
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  buildChangeRequestDiff,
  mapChangeRequestRow,
  type EditableField,
} from "@/lib/portal/change-request-types";
import { notifyChangeRequestToAdmin } from "@/lib/studio/change-request-notify";

export type CedulaPhotoActionState = { ok?: boolean; error?: string };

async function resolveActionPrincipal() {
  try {
    return await getPortalClientPrincipal(await createClient());
  } catch {
    return null;
  }
}

export async function uploadCedulaPhotoAction(
  _prev: CedulaPhotoActionState,
  formData: FormData,
): Promise<CedulaPhotoActionState> {
  const logger = createComponentLogger("portal.profile.identity-photo");
  // 1. Principal por SESIÓN: vínculo activo, cliente vivo y tenant coherente.
  const principal = await resolveActionPrincipal();
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;
  const tenantId = principal.tenantId;

  // 2. Validar la foto (obligatoria: esta action ES la subida de la foto).
  const v = validatePhotoFile(formData.get("cedula_photo"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al principal verificado): tenant + markbox
  //    para el path y si ya había una foto (reemplazo).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, cedula_photo_path")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .is("deleted_at", null)
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
  const up = await uploadClientPhoto(admin, tenantId, row.markbox, v.file);
  if (up.error || !up.path) {
    logger.error("portal_profile.action_failed", {
      error: up.error,
      operation: "identity_photo",
      stage: "upload",
    });
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. Update con rollback de la foto recién subida si falla.
  const { error: updErr } = await admin
    .from("clients")
    .update({ cedula_photo_path: up.path })
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .is("deleted_at", null);
  if (updErr) {
    await admin.storage.from(PHOTO_BUCKET).remove([up.path]).catch(() => {});
    logger.error("portal_profile.action_failed", {
      error: updErr,
      operation: "identity_photo",
      stage: "write",
    });
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
 * SESIÓN con vínculo cliente/tenant coherente → escritura con ADMIN client
 * (service_role) scopeada a ese tenant e id. Solo persiste los campos que CAMBIAN (diff), snapshotea los
 * valores previos, y rechaza si ya hay una solicitud abierta (una a la vez).
 */
export async function submitDataChangeRequestAction(
  _prev: ChangeRequestActionState,
  formData: FormData,
): Promise<ChangeRequestActionState> {
  const logger = createComponentLogger("portal.profile.change-request");
  const principal = await resolveActionPrincipal();
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;
  const tenantId = principal.tenantId;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // Estado actual (scopeado al principal verificado por sesión).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, name, rif, phone, doc_kind, advisor_id")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .is("deleted_at", null)
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
  const { data: open, error: openErr } = await admin
    .from("client_change_requests")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("source", "client")
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();
  if (openErr) {
    return { error: "No pudimos revisar tu solicitud. Prueba de nuevo." };
  }
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
      tenant_id: tenantId,
      client_id: clientId,
      proposed_name: proposedName,
      proposed_rif: proposedRif,
      proposed_phone: proposedPhone,
      prev_name: row.name,
      prev_rif: row.rif,
      prev_phone: row.phone,
      status: "pending",
      source: "client",
    })
    .select(
      "id, tenant_id, client_id, proposed_name, proposed_rif, proposed_phone, prev_name, prev_rif, prev_phone, status, source, submitted_at, reviewed_at, reviewed_by, review_note",
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
    logger.error("portal_profile.action_failed", {
      error: insErr,
      operation: "change_request_submit",
      stage: "write",
    });
    return { error: "No pudimos guardar tu solicitud. Prueba de nuevo." };
  }

  // Aviso al equipo (best-effort, nunca tira).
  const request = mapChangeRequestRow(
    inserted as Parameters<typeof mapChangeRequestRow>[0],
  );
  await notifyChangeRequestToAdmin(admin, {
    tenantId,
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
  const logger = createComponentLogger("portal.profile.change-request-cancel");
  const principal = await resolveActionPrincipal();
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;
  const tenantId = principal.tenantId;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  const { error: delErr } = await admin
    .from("client_change_requests")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("source", "client")
    .eq("status", "pending");
  if (delErr) {
    logger.error("portal_profile.action_failed", {
      error: delErr,
      operation: "change_request_cancel",
      stage: "write",
    });
    return { error: "No pudimos cancelar la solicitud. Prueba de nuevo." };
  }

  revalidatePath("/portal/perfil");
  return { ok: true };
}
