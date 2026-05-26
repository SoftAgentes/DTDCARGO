"use server";

/**
 * Server actions del camionero VE (SDD-0030).
 *
 * - advanceOdAction: lista→en_ruta o en_ruta→entregada
 * - podAction: sube foto + firma + receptor (al bucket receipt-photos)
 *   y crea fila dispatch_pods
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

const BUCKET = "receipt-photos";

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function requireCamioneroSession() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresá de nuevo." as const };
  if (session.region !== "ve") return { error: "Solo operarios VE." as const };
  if (
    session.role !== "camionero" &&
    session.role !== "supervisor"
  ) {
    return { error: "Tu rol no permite operar entregas." as const };
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
// pod · sube foto + firma + datos receptor
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

  if (!od_id) return { fieldErrors: { od_id: "Falta el ID de la OD." } };
  if (!photoFile || photoFile.size === 0) {
    return { fieldErrors: { photo: "Foto del POD obligatoria." } };
  }
  if (!signatureFile || signatureFile.size === 0) {
    return { fieldErrors: { signature: "Firma obligatoria." } };
  }
  if (!received_by) {
    return { fieldErrors: { received_by: "Indicá nombre del receptor." } };
  }

  const admin = createAdminClient();
  const ts = Date.now();
  const tenantId = auth.session.tenant_id;
  const photoPath = `pod/${tenantId}/${od_id}/${ts}.jpg`;
  const signaturePath = `firma/${tenantId}/${od_id}/${ts}.png`;

  // 1. Upload foto
  const { error: photoErr } = await admin.storage
    .from(BUCKET)
    .upload(photoPath, photoFile, {
      contentType: photoFile.type || "image/jpeg",
      upsert: false,
    });
  if (photoErr) {
    return { error: `No se pudo subir la foto: ${photoErr.message}` };
  }

  // 2. Upload firma
  const { error: sigErr } = await admin.storage
    .from(BUCKET)
    .upload(signaturePath, signatureFile, {
      contentType: signatureFile.type || "image/png",
      upsert: false,
    });
  if (sigErr) {
    // Limpieza: borrar la foto subida
    await admin.storage.from(BUCKET).remove([photoPath]);
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
    // Cleanup uploads si validación falla (defensive · no debería pasar)
    await admin.storage.from(BUCKET).remove([photoPath, signaturePath]);
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
  });

  if (error) {
    await admin.storage.from(BUCKET).remove([photoPath, signaturePath]);
    return { error: humanizeRpcError(error.message) };
  }

  revalidatePath("/m/ve/camionero");
  return { ok: true, createdPodId: String(podId ?? "") };
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
  return msg;
}
