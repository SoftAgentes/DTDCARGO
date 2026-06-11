"use server";

/**
 * Server actions del camionero VE (SDD-0030 + Sprint 3 v3).
 *
 * - advanceOdAction: lista→en_ruta o en_ruta→entregada
 * - podAction: sube foto + firma + receptor + GPS opcional
 * - uploadFacadePhotoAction: 2do camino del flow híbrido foto fachada
 *   (cuando el camionero llega a la 1ra visita y `facade_photo_url` es null)
 * - partialDeliveryAction: marca un paquete como entregado/rechazado/retornado
 * - signOutAction: borra cookie
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import {
  getCurrentOperario,
  signOutOperario,
} from "@/lib/auth/operario-session";
import {
  validateCamioneroAdvanceInput,
  validateCamioneroPodInput,
  type CamioneroAdvanceInput,
  type CamioneroPodInput,
  type MobileActionState,
} from "@/lib/studio/dispatch-mobile-types";
import type { DispatchOrderStatus } from "@/lib/studio/dispatch-types";

const POD_BUCKET = "receipt-photos";
const FACADE_BUCKET = "client-facades";

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function requireCamioneroSession() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresa de nuevo." as const };
  if (session.region !== "ve") return { error: "Solo operarios VE." as const };
  const activeMode = session.current_mode ?? session.role;
  if (activeMode !== "camionero" && activeMode !== "supervisor") {
    return { error: "Tu modo activo no permite operar entregas." as const };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// advanceOd
// ─────────────────────────────────────────────────────────────

export async function advanceOdAction(
  _prev: MobileActionState,
  formData: FormData,
): Promise<MobileActionState> {
  const auth = await requireCamioneroSession();
  if ("error" in auth) return { error: auth.error };

  const partial: Partial<CamioneroAdvanceInput> = {
    od_id: parseStringOrNull(formData.get("od_id")) ?? undefined,
    status:
      (parseStringOrNull(formData.get("status")) as
        | CamioneroAdvanceInput["status"]
        | undefined) ?? undefined,
    progress: formData.get("progress") != null ? Number(formData.get("progress")) : null,
    current_city: parseStringOrNull(formData.get("current_city")),
  };
  const { input, fieldErrors } = validateCamioneroAdvanceInput(partial);
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();
  const { error } = await admin.rpc("camionero_advance_od", {
    p_operario_id: auth.session.operario_id,
    p_od_id: input!.od_id,
    p_status: input!.status as DispatchOrderStatus,
    p_progress: input!.progress,
    p_current_city: input!.current_city,
  });

  if (error) return { error: humanizeRpcError(error.message) };

  revalidatePath("/m/ve/camionero");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// pod · foto + firma + receptor + GPS opcional (Sprint 3 v3)
// ─────────────────────────────────────────────────────────────

export async function podAction(
  _prev: MobileActionState,
  formData: FormData,
): Promise<MobileActionState> {
  const auth = await requireCamioneroSession();
  if ("error" in auth) return { error: auth.error };

  const od_id = parseStringOrNull(formData.get("od_id"));
  const package_id = parseStringOrNull(formData.get("package_id"));
  const photoFile = formData.get("photo") as File | null;
  const signatureFile = formData.get("signature") as File | null;
  const received_by = parseStringOrNull(formData.get("received_by"));
  const received_doc = parseStringOrNull(formData.get("received_doc"));
  const notes = parseStringOrNull(formData.get("notes"));

  // Sprint 3 · GPS opcional
  const pod_lat = parseNumberOrNull(formData.get("pod_lat"));
  const pod_lng = parseNumberOrNull(formData.get("pod_lng"));
  const pod_accuracy_m = parseNumberOrNull(formData.get("pod_accuracy_m"));
  const pod_gps_status_raw = parseStringOrNull(formData.get("pod_gps_status"));
  const pod_gps_status: "on" | "off" | "denied" | "unavailable" | null =
    pod_gps_status_raw === "on" ||
    pod_gps_status_raw === "off" ||
    pod_gps_status_raw === "denied" ||
    pod_gps_status_raw === "unavailable"
      ? pod_gps_status_raw
      : null;

  if (!od_id) return { fieldErrors: { od_id: "Falta el ID de la OD." } };
  if (!photoFile || photoFile.size === 0) {
    return { fieldErrors: { photo: "Foto del POD obligatoria." } };
  }
  if (!signatureFile || signatureFile.size === 0) {
    return { fieldErrors: { signature: "Firma obligatoria." } };
  }
  if (!received_by) {
    return { fieldErrors: { received_by: "Indica nombre del receptor." } };
  }

  const admin = createAdminClient();
  const ts = Date.now();
  const tenantId = auth.session.tenant_id;
  const photoPath = `pod/${tenantId}/${od_id}/${ts}.jpg`;
  const signaturePath = `firma/${tenantId}/${od_id}/${ts}.png`;

  // 1. Upload foto
  const { error: photoErr } = await admin.storage
    .from(POD_BUCKET)
    .upload(photoPath, photoFile, {
      contentType: photoFile.type || "image/jpeg",
      upsert: false,
    });
  if (photoErr) {
    return { error: `No se pudo subir la foto: ${photoErr.message}` };
  }

  // 2. Upload firma
  const { error: sigErr } = await admin.storage
    .from(POD_BUCKET)
    .upload(signaturePath, signatureFile, {
      contentType: signatureFile.type || "image/png",
      upsert: false,
    });
  if (sigErr) {
    await admin.storage.from(POD_BUCKET).remove([photoPath]);
    return { error: `No se pudo subir la firma: ${sigErr.message}` };
  }

  // 3. Validar y crear POD
  const partial: Partial<CamioneroPodInput> = {
    od_id,
    package_id,
    photo_path: photoPath,
    signature_path: signaturePath,
    received_by,
    received_doc,
    notes,
  };
  const { input, fieldErrors } = validateCamioneroPodInput(partial);
  if (fieldErrors) {
    await admin.storage.from(POD_BUCKET).remove([photoPath, signaturePath]);
    return { fieldErrors };
  }

  const { data: podId, error } = await admin.rpc("camionero_pod", {
    p_operario_id: auth.session.operario_id,
    p_od_id: input!.od_id,
    p_package_id: input!.package_id,
    p_photo_path: input!.photo_path,
    p_signature_path: input!.signature_path,
    p_received_by: input!.received_by,
    p_received_doc: input!.received_doc,
    p_notes: input!.notes,
    p_pod_lat: pod_lat,
    p_pod_lng: pod_lng,
    p_pod_accuracy_m: pod_accuracy_m,
    p_pod_gps_status: pod_gps_status,
  });

  if (error) {
    await admin.storage.from(POD_BUCKET).remove([photoPath, signaturePath]);
    return { error: humanizeRpcError(error.message) };
  }

  revalidatePath("/m/ve/camionero");
  return { ok: true, createdPodId: String(podId ?? "") };
}

// ─────────────────────────────────────────────────────────────
// uploadFacadePhoto · Sprint 3 v3 (camino 2 del flow híbrido)
// ─────────────────────────────────────────────────────────────

/**
 * Camionero toma foto de la fachada del cliente en la 1ra visita si
 * `clients.facade_photo_url` es null. Sube al bucket `client-facades`
 * y patchea el row `clients` con el path.
 *
 * El cliente puede sobreescribir esto en cualquier momento desde su
 * portal (camino 3 del flow).
 */
export async function uploadFacadePhotoAction(
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; path?: string }> {
  const auth = await requireCamioneroSession();
  if ("error" in auth) return { error: auth.error };

  const markbox = parseStringOrNull(formData.get("markbox"));
  const photoFile = formData.get("photo") as File | null;

  if (!markbox) return { error: "Falta markbox del cliente." };
  if (!photoFile || photoFile.size === 0) {
    return { error: "Foto de fachada obligatoria." };
  }
  if (photoFile.size > 5 * 1024 * 1024) {
    return { error: "La foto excede 5MB · comprimila antes." };
  }

  const admin = createAdminClient();
  const ts = Date.now();
  const tenantId = auth.session.tenant_id;
  const ext =
    photoFile.type === "image/png"
      ? "png"
      : photoFile.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `${tenantId}/${markbox}/${ts}.${ext}`;

  // 1. Upload (allow overwrite · el camionero puede re-tomar si salió mal)
  const { error: upErr } = await admin.storage
    .from(FACADE_BUCKET)
    .upload(path, photoFile, {
      contentType: photoFile.type || "image/jpeg",
      upsert: true,
    });
  if (upErr) {
    return { error: `No se pudo subir foto fachada: ${upErr.message}` };
  }

  // 2. Patch clients.facade_photo_url via service_role
  const { error: dbErr } = await admin
    .from("clients")
    .update({ facade_photo_url: path })
    .eq("tenant_id", tenantId)
    .eq("markbox", markbox)
    .is("deleted_at", null);

  if (dbErr) {
    // No-fatal: la foto quedó subida, pero el path no se guardó. Retry
    // posible removiendo + re-uploading. Por ahora reportamos.
    return { error: `Foto subida pero no se pudo asociar: ${dbErr.message}` };
  }

  revalidatePath("/m/ve/camionero");
  return { ok: true, path };
}

// ─────────────────────────────────────────────────────────────
// partialDelivery · Sprint 3 v3
// ─────────────────────────────────────────────────────────────

export type PartialDeliveryStatus = "entregado" | "rechazado" | "retornado";

export async function partialDeliveryAction(input: {
  od_id: string;
  package_id: string;
  status: PartialDeliveryStatus;
  reason?: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireCamioneroSession();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin.rpc("operario_action", {
    p_operario_id: auth.session.operario_id,
    p_action_type: "partial_delivery",
    p_payload: {
      od_id: input.od_id,
      package_id: input.package_id,
      status: input.status,
      reason: input.reason ?? null,
    },
  });

  if (error) return { error: humanizeOperarioActionError(error.message) };

  revalidatePath("/m/ve/camionero");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  await signOutOperario();
  redirect("/m/ve/login");
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function humanizeRpcError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios VE pueden operar.";
  if (msg.includes("P0004")) return "Tu rol no tiene permiso para esta acción.";
  if (msg.includes("P0005")) return "OD no encontrada.";
  if (msg.includes("P0006")) return "Esta OD no pertenece a tu tenant.";
  if (msg.includes("P0007")) return "Transición de status no permitida.";
  if (msg.includes("P0010")) return "Receptor obligatorio.";
  if (msg.includes("P0011")) return "Foto del POD obligatoria.";
  if (msg.includes("P0012")) return "Firma del POD obligatoria.";
  if (msg.includes("P0013")) return "pod_gps_status inválido.";
  return msg;
}

function humanizeOperarioActionError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios VE pueden operar.";
  if (msg.includes("P0004")) return "Tu rol no permite esta acción.";
  if (msg.includes("P0005")) return "OD no encontrada.";
  if (msg.includes("P0006")) return "OD de otro tenant.";
  if (msg.includes("P0007")) return "OD debe estar en ruta.";
  if (msg.includes("P0008")) return "Paquete no encontrado en la OD.";
  if (msg.includes("P0110")) return "Faltan datos.";
  if (msg.includes("P0120")) return "Status inválido.";
  if (msg.includes("P0121")) return "Motivo obligatorio para rechazo/retorno.";
  if (msg.includes("P0122")) return "Paquete ya estaba marcado.";
  return msg;
}
