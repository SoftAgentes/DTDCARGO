/**
 * Write-back ERP→Kommo: lado ENCOLA (SDD-0083 · SDD-0062 Slice A+B).
 *
 * El ERP solo encola en `kommo_writeback_outbox` (vía RPC con admin client). La
 * edge function `kommo-writeback` drena la cola, lee el token de Vault y hace el
 * PATCH a Kommo (dry-run por default). El token NUNCA entra a este runtime
 * (modelo de seguridad SDD-0043). Guardrail 0107: jamás se escribe el espejo.
 *
 * Plano (no carpeta) para matchear los `kommo-*.ts` existentes (queries/types/
 * convert/analytics).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type WritebackOp = "patch_price" | "patch_stage" | "patch_lead";

/**
 * Payload del PATCH `/api/v4/leads/{id}` para setear el `price` del lead. PURO.
 * Kommo guarda `price` como entero (unidades de la moneda de la cuenta) → se
 * redondea; valores no finitos o ≤0 caen a 0.
 */
export function buildPricePatchPayload(
  totalUsd: number | null | undefined,
): { price: number } {
  const n = Number(totalUsd);
  return { price: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
}

/**
 * Encola un `patch_price` para el lead de Kommo del cliente (resuelto por
 * `client_markbox → clients.kommo_lead_id`). **Best-effort**: devuelve el id de la
 * fila de outbox, o `null` si el cliente no tiene lead vinculado o si algo falla.
 * NUNCA tira — el caller (transición del estimado) no debe romperse por esto.
 */
export async function enqueueKommoWriteback(
  admin: SupabaseClient,
  tenantId: string,
  input: { clientMarkbox: string | null | undefined; totalUsd: number | null },
): Promise<string | null> {
  try {
    const markbox = (input.clientMarkbox ?? "").trim();
    if (!markbox) return null;

    // Resolver el lead de Kommo del cliente (markbox → clients.kommo_lead_id).
    const { data: client } = await admin
      .from("clients")
      .select("kommo_lead_id")
      .eq("tenant_id", tenantId)
      .eq("markbox", markbox)
      .is("deleted_at", null)
      .maybeSingle<{ kommo_lead_id: number | null }>();
    const leadId = client?.kommo_lead_id ?? null;
    if (leadId == null) return null; // cliente sin lead de Kommo → nada que sincronizar

    // Snapshot del updated_at del lead (trazabilidad anti-overwrite). Best-effort.
    const { data: lead } = await admin
      .from("kommo_leads")
      .select("kommo_updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", leadId)
      .maybeSingle<{ kommo_updated_at: string | null }>();

    const { data, error } = await admin.rpc("enqueue_kommo_writeback", {
      p_tenant_id: tenantId,
      p_kommo_lead_id: leadId,
      p_op: "patch_price" satisfies WritebackOp,
      p_payload: buildPricePatchPayload(input.totalUsd),
      p_kommo_updated_at: lead?.kommo_updated_at ?? null,
    });
    if (error) {
      console.error("[kommo-writeback] enqueue error:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[kommo-writeback] enqueue threw:", err);
    return null;
  }
}
