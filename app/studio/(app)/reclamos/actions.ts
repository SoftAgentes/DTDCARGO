/**
 * Server actions del módulo Reclamos (SDD-0101 · Slice A).
 *
 *  - createClaimAction        · genera RC-YYYY-NNN (next_claim_code) + snapshot
 *                               de cliente/embarque + insert.
 *  - updateClaimAction        · edita campos del reclamo (no toca code/estado).
 *  - advanceClaimStatusAction · transición de la máquina (valida canTransition).
 *  - softDeleteClaimAction    · deleted_at = now().
 *
 * Toda mutación pasa el gate de edición por módulo (moduleEditDenial, SDD-0085):
 * las server actions son invocables directo como un endpoint → validan su rol.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateClaimInput,
  canTransitionClaim,
  isClaimStatus,
  type ClaimActionState,
  type ClaimStatus,
} from "@/lib/studio/reclamos/claims-types";
import {
  collectEvidenceFiles,
  uploadClaimEvidenceBatch,
  CLAIM_EVIDENCE_BUCKET,
} from "@/lib/studio/reclamos/claim-evidence";

const MODULE_ID = "reclamos";

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function inputFromFormData(formData: FormData) {
  return {
    client_id: strOrNull(formData.get("client_id")) ?? undefined,
    shipment_id: strOrNull(formData.get("shipment_id")),
    container_code: strOrNull(formData.get("container_code")),
    claim_type: strOrNull(formData.get("claim_type")) ?? undefined,
    description: strOrNull(formData.get("description")) ?? undefined,
    amount_usd: strOrNull(formData.get("amount_usd")) ?? 0,
    insured: formData.get("insured"),
  };
}

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

export async function createClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateClaimInput(inputFromFormData(formData));
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  // Snapshot del cliente (RLS garantiza que es del tenant del usuario).
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, markbox, name")
    .eq("id", input!.client_id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; markbox: string; name: string }>();
  if (clientErr) return { error: `No se pudo leer el cliente: ${clientErr.message}` };
  if (!client) return { fieldErrors: { client_id: "Cliente no encontrado." } };

  // Snapshot del embarque (opcional).
  let shipmentCode: string | null = null;
  if (input!.shipment_id) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, code")
      .eq("id", input!.shipment_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; code: string }>();
    if (!shipment) return { fieldErrors: { shipment_id: "Embarque no encontrado." } };
    shipmentCode = shipment.code;
  }

  // Correlativo RC-YYYY-NNN.
  const { data: codeData, error: codeErr } = await supabase.rpc("next_claim_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del reclamo." };
  }
  const claimCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("client_claims").insert({
    tenant_id: tenantId,
    claim_code: claimCode,
    client_id: client.id,
    client_markbox: client.markbox,
    client_name: client.name,
    shipment_id: input!.shipment_id,
    shipment_code: shipmentCode,
    container_code: input!.container_code,
    claim_type: input!.claim_type,
    description: input!.description,
    amount_usd: input!.amount_usd,
    insured: input!.insured,
    status: "reportado",
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Carrera al generar el código. Intenta de nuevo." };
    }
    return { error: `No se pudo crear el reclamo: ${error.message}` };
  }

  revalidatePath("/studio/reclamos");
  return { ok: true, createdCode: claimCode };
}

export async function updateClaimAction(
  claimId: string,
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateClaimInput(inputFromFormData(formData));
  if (fieldErrors) return { fieldErrors };

  // Snapshot del cliente si cambió.
  const { data: client } = await supabase
    .from("clients")
    .select("id, markbox, name")
    .eq("id", input!.client_id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; markbox: string; name: string }>();
  if (!client) return { fieldErrors: { client_id: "Cliente no encontrado." } };

  let shipmentCode: string | null = null;
  if (input!.shipment_id) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, code")
      .eq("id", input!.shipment_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; code: string }>();
    if (!shipment) return { fieldErrors: { shipment_id: "Embarque no encontrado." } };
    shipmentCode = shipment.code;
  }

  const { error } = await supabase
    .from("client_claims")
    .update({
      client_id: client.id,
      client_markbox: client.markbox,
      client_name: client.name,
      shipment_id: input!.shipment_id,
      shipment_code: shipmentCode,
      container_code: input!.container_code,
      claim_type: input!.claim_type,
      description: input!.description,
      amount_usd: input!.amount_usd,
      insured: input!.insured,
    })
    .eq("id", claimId);

  if (error) return { error: `No se pudo guardar el reclamo: ${error.message}` };

  revalidatePath("/studio/reclamos");
  return { ok: true };
}

/**
 * Avanza el reclamo de su estado actual a `to`. Valida la transición contra la
 * máquina (defensa server-side aunque la UI solo ofrezca las válidas). El
 * sellado de evaluated_at/resolved_at lo hace el trigger en DB.
 */
export async function advanceClaimStatusAction(
  claimId: string,
  to: ClaimStatus,
  note?: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isClaimStatus(to)) return { error: "Estado destino inválido." };

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { data: current, error: readErr } = await supabase
    .from("client_claims")
    .select("id, status")
    .eq("id", claimId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; status: ClaimStatus }>();
  if (readErr) return { error: `No se pudo leer el reclamo: ${readErr.message}` };
  if (!current) return { error: "Reclamo no encontrado." };

  if (!canTransitionClaim(current.status, to)) {
    return { error: `Transición inválida: ${current.status} → ${to}.` };
  }

  const patch: { status: ClaimStatus; resolution_note?: string } = { status: to };
  const trimmed = note?.trim();
  if (trimmed) patch.resolution_note = trimmed;

  const { error } = await supabase
    .from("client_claims")
    .update(patch)
    .eq("id", claimId);

  if (error) return { error: `No se pudo actualizar el estado: ${error.message}` };

  revalidatePath("/studio/reclamos");
  return { ok: true };
}

export async function softDeleteClaimAction(
  claimId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("client_claims")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", claimId);

  if (error) return { error: `No se pudo eliminar el reclamo: ${error.message}` };

  revalidatePath("/studio/reclamos");
  return { ok: true };
}

/**
 * Sube evidencia (fotos/PDF) a un reclamo desde el Studio (equipo). User client:
 * la storage RLS por tenant valida el path {tenant}/{claim}/… El trigger fuerza
 * el client_markbox del claim. Best-effort por archivo (B2).
 */
export async function uploadStudioClaimEvidenceAction(
  claimId: string,
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // El claim debe ser del tenant (RLS ya lo scopea; filtro defensivo).
  const { data: claim } = await supabase
    .from("client_claims")
    .select("id")
    .eq("id", claimId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (!claim) return { error: "Reclamo no encontrado." };

  const { files, skipped } = collectEvidenceFiles(formData);
  if (files.length === 0) {
    return {
      error:
        skipped > 0
          ? "Archivos no válidos (usa JPG/PNG/WebP/HEIC o PDF, máx 10 MB)."
          : "Elige al menos un archivo.",
    };
  }

  const { data: userResp } = await supabase.auth.getUser();
  const { uploaded } = await uploadClaimEvidenceBatch(supabase, {
    tenantId,
    claimId,
    files,
    source: "studio",
    uploadedBy: userResp.user?.id ?? null,
  });
  if (uploaded === 0) return { error: "No se pudo subir la evidencia." };

  revalidatePath("/studio/reclamos");
  return { ok: true };
}

/** Soft-delete de una evidencia + borra el objeto del bucket (best-effort). */
export async function deleteClaimEvidenceAction(
  evidenceId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { data: ev } = await supabase
    .from("client_claim_evidence")
    .select("storage_path")
    .eq("id", evidenceId)
    .is("deleted_at", null)
    .maybeSingle<{ storage_path: string }>();

  const { error } = await supabase
    .from("client_claim_evidence")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", evidenceId);
  if (error) return { error: `No se pudo eliminar la evidencia: ${error.message}` };

  if (ev?.storage_path) {
    await supabase.storage
      .from(CLAIM_EVIDENCE_BUCKET)
      .remove([ev.storage_path])
      .catch(() => {});
  }

  revalidatePath("/studio/reclamos");
  return { ok: true };
}
