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
 *
 * SDD-0552: cliente, tenant y usuario salen del principal de sesión
 * (`getPortalClientPrincipal`); el admin ya no relee `clients.tenant_id`. El
 * embarque se busca con el tenant del principal: uno de otro tenant con el
 * mismo Shipping Mark no se vincula.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { isClaimType } from "@/lib/studio/reclamos/claims-types";
import {
  collectEvidenceFiles,
  evidenceNotYetUploaded,
  uploadClaimEvidenceBatch,
} from "@/lib/studio/reclamos/claim-evidence";
import {
  isClientRequestConflict,
  isMissingClientRequestColumn,
  readClientRequestId,
} from "@/lib/shared/client-request";

export type PortalClaimState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdCode?: string;
  /** true si algún archivo adjunto se descartó (inválido) o no pudo subir. */
  evidenceSkipped?: boolean;
  /** El reclamo ya existía: un reintento del mismo envío (SDD-0599). */
  replayed?: boolean;
};

type ExistingClaim = { id: string; claim_code: string };

/** El reclamo que ya creó este intento. Sin 0512 la columna no existe, y sigue como un envío nuevo. */
async function findClaimByRequest(
  admin: ReturnType<typeof createAdminClient>,
  args: { tenantId: string; markbox: string; requestId: string },
): Promise<ExistingClaim | null> {
  const { data, error } = await admin
    .from("client_claims")
    .select("id, claim_code")
    .eq("tenant_id", args.tenantId)
    .eq("client_markbox", args.markbox)
    .eq("client_request_id", args.requestId)
    .is("deleted_at", null)
    .maybeSingle<ExistingClaim>();
  return error ? null : data;
}

/** Un reintento del mismo envío responde lo mismo que el primero, y sube sólo la evidencia que faltó. */
async function replayClaim(
  admin: ReturnType<typeof createAdminClient>,
  args: { tenantId: string; existing: ExistingClaim; formData: FormData; uploadedBy: string },
): Promise<PortalClaimState> {
  const { files, skipped } = collectEvidenceFiles(args.formData);
  const faltan = await evidenceNotYetUploaded(admin, { claimId: args.existing.id, files });
  const { uploaded } = await uploadClaimEvidenceBatch(admin, {
    tenantId: args.tenantId,
    claimId: args.existing.id,
    files: faltan,
    source: "portal",
    uploadedBy: args.uploadedBy,
  });
  revalidatePath("/portal/soporte");
  return {
    ok: true,
    createdCode: args.existing.claim_code,
    evidenceSkipped: skipped > 0 || uploaded < faltan.length,
    replayed: true,
  };
}

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

  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) {
    return { error: "Tu sesión no está habilitada como cliente del portal." };
  }
  const { client, tenantId } = principal;

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

  // Antes de gastar un correlativo: si este intento ya creó el reclamo, no crea otro.
  const requestId = readClientRequestId(formData);
  const scope = { tenantId, markbox: client.markbox };
  if (requestId) {
    const existing = await findClaimByRequest(admin, { ...scope, requestId });
    if (existing) return replayClaim(admin, { tenantId, existing, formData, uploadedBy: principal.userId });
  }

  // Embarque opcional: solo se vincula si es del propio cliente (tenant del
  // principal + markbox). El admin no tiene RLS: sin el tenant, un envío de otro
  // tenant con el mismo Shipping Mark pasaba la comparación de abajo.
  let shipmentRefId: string | null = null;
  let shipmentCode: string | null = null;
  if (shipmentId) {
    const { data: ship } = await admin
      .from("shipments")
      .select("id, code, client_markbox")
      .eq("id", shipmentId)
      .eq("tenant_id", tenantId)
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

  // Insert con campos CONTROLADOS por el servidor (el cliente no los provee).
  const fila = {
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
    created_by: principal.userId,
  };
  const insertar = (row: typeof fila & { client_request_id?: string }) =>
    admin.from("client_claims").insert(row).select("id").maybeSingle<{ id: string }>();

  let { data: inserted, error } = await insertar(
    requestId ? { ...fila, client_request_id: requestId } : fila,
  );
  // Sin 0512 la columna no existe: el reclamo entra sin candado, como antes.
  if (isMissingClientRequestColumn(error)) {
    ({ data: inserted, error } = await insertar(fila));
  }

  if (error) {
    if (requestId && isClientRequestConflict(error)) {
      // Otro intento del mismo envío ganó la carrera: ese es el reclamo.
      const existing = await findClaimByRequest(admin, { ...scope, requestId });
      if (existing) return replayClaim(admin, { tenantId, existing, formData, uploadedBy: principal.userId });
    }
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
      uploadedBy: principal.userId,
    });
    uploadedCount = r.uploaded;
  }

  revalidatePath("/portal/soporte");
  return {
    ok: true,
    createdCode: claimCode,
    evidenceSkipped: skipped > 0 || uploadedCount < files.length,
  };
}
