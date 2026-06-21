/**
 * Server action del Portal · reportar un reclamo (SDD-0101 · Slice B).
 *
 * El cliente del portal NO está en `user_tenants`, así que el path normal del
 * Studio (RLS por tenant + next_claim_code con assert_tenant_match) no le sirve.
 * Patrón del registro self-service (next_markbox_service, 0109): resolvemos el
 * cliente/tenant con confianza server-side y usamos el ADMIN client para generar
 * el código y CONTROLAR los campos del insert.
 *
 * Seguridad: el cliente solo provee tipo + descripción + embarque (validado que
 * es suyo). El monto, el seguro y el estado los fija el servidor (0 / false /
 * 'reportado') — el cliente no puede forjar una indemnización ni saltar la
 * evaluación. El embarque ajeno se ignora (no se vincula). El trigger
 * client_claims_check valida igual la coherencia de tenant.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { isClaimType } from "@/lib/studio/reclamos/claims-types";
import {
  collectEvidenceFiles,
  uploadClaimEvidenceBatch,
} from "@/lib/studio/reclamos/claim-evidence";

export type PortalClaimState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdCode?: string;
  /** true si algún archivo adjunto se descartó (inválido) o no pudo subir. */
  evidenceSkipped?: boolean;
};

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function createPortalClaimAction(
  _prev: PortalClaimState,
  formData: FormData,
): Promise<PortalClaimState> {
  const supabase = await createClient();

  const client = await getPortalClient(supabase);
  if (!client) {
    return { error: "Tu sesión no está habilitada como cliente del portal." };
  }

  // ── Validación del input del cliente (solo tipo + descripción + embarque) ──
  const claimType = String(formData.get("claim_type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const shipmentId = strOrNull(formData.get("shipment_id"));

  const fieldErrors: Record<string, string> = {};
  if (!isClaimType(claimType)) {
    fieldErrors.claim_type = "Elige el tipo de problema.";
  }
  if (!description) {
    fieldErrors.description = "Cuéntanos qué pasó con tu carga.";
  } else if (description.length > 2000) {
    fieldErrors.description = "La descripción es demasiado larga.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const admin = createAdminClient();

  // Tenant del cliente (robusto: admin lee su fila por id; mismo criterio que
  // getPortalAdvisor). El client.id ya viene del principal autenticado.
  const { data: clientRow, error: tenantErr } = await admin
    .from("clients")
    .select("tenant_id")
    .eq("id", client.id)
    .maybeSingle<{ tenant_id: string }>();
  if (tenantErr || !clientRow?.tenant_id) {
    return { error: "No se pudo resolver tu cuenta. Intenta más tarde." };
  }
  const tenantId = clientRow.tenant_id;

  // Embarque opcional: solo se vincula si es del propio cliente (markbox).
  let shipmentRefId: string | null = null;
  let shipmentCode: string | null = null;
  if (shipmentId) {
    const { data: ship } = await admin
      .from("shipments")
      .select("id, code, client_markbox")
      .eq("id", shipmentId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; code: string; client_markbox: string | null }>();
    if (ship && ship.client_markbox === client.markbox) {
      shipmentRefId = ship.id;
      shipmentCode = ship.code;
    }
  }

  // Correlativo por el path-servidor-de-confianza (sin guard de tenant).
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_claim_code_service",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del reclamo." };
  }
  const claimCode = String(codeData);

  const { data: userResp } = await supabase.auth.getUser();

  // Insert con campos CONTROLADOS por el servidor (el cliente no los provee).
  const { data: inserted, error } = await admin
    .from("client_claims")
    .insert({
      tenant_id: tenantId,
      claim_code: claimCode,
      client_id: client.id,
      client_markbox: client.markbox,
      client_name: client.name,
      shipment_id: shipmentRefId,
      shipment_code: shipmentCode,
      container_code: null,
      claim_type: claimType,
      description,
      amount_usd: 0,
      insured: false,
      status: "reportado",
      source: "portal",
      created_by: userResp.user?.id ?? null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return { error: "Hubo un cruce al registrar. Intenta de nuevo." };
    }
    return { error: "No se pudo enviar el reclamo. Intenta más tarde." };
  }

  // Evidencia (fotos/PDF) opcional — best-effort, no rompe el reclamo si falla.
  const { files, skipped } = collectEvidenceFiles(formData);
  let uploadedCount = 0;
  if (inserted?.id && files.length > 0) {
    const r = await uploadClaimEvidenceBatch(admin, {
      tenantId,
      claimId: inserted.id,
      files,
      source: "portal",
      uploadedBy: userResp.user?.id ?? null,
    });
    uploadedCount = r.uploaded;
  }

  revalidatePath("/portal/reclamos");
  return {
    ok: true,
    createdCode: claimCode,
    evidenceSkipped: skipped > 0 || uploadedCount < files.length,
  };
}
