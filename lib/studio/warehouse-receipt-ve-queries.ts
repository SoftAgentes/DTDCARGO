/**
 * Queries server-side de Recepción VE (Sprint E · plan v3).
 *
 * Llamadas con admin client (service_role) desde server components porque
 * el operario no tiene auth.uid().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeReceiptProgress,
  type WarehouseReceiptVe,
  type WarehouseReceiptVeBox,
  type WarehouseReceiptVeWithBoxes,
} from "./warehouse-receipt-ve-types";

// ─────────────────────────────────────────────────────────────
// Lista de receipts (active + recientes sellados)
// ─────────────────────────────────────────────────────────────

/**
 * Lista los receipts del tenant en estado "en_muelle" / "recibiendo" /
 * "con_incidencia" (lo que el bodeguero tiene que operar hoy). Los
 * sellados se ocultan después de 7 días para mantener la lista limpia.
 */
export async function listReceiptsVe(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Array<WarehouseReceiptVe & { scanned_count: number; expected_count: number }>> {
  const { data, error } = await supabase
    .from("warehouse_receipts_ve")
    .select(
      `
      id, tenant_id, receipt_code, container_code, vessel, port, eta,
      expected_cbm, expected_boxes, status,
      received_by_operario_id, sealed_by_operario_id, started_at, sealed_at,
      notes, incident_note, deleted_at, created_at, updated_at,
      boxes:warehouse_receipt_ve_boxes ( id, scanned_at )
      `,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("eta", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) throw error;

  type Raw = WarehouseReceiptVe & {
    boxes: { id: string; scanned_at: string | null }[];
  };

  return ((data as Raw[] | null) ?? []).map((r) => {
    const total = r.boxes?.length ?? 0;
    const scanned = (r.boxes ?? []).filter((b) => b.scanned_at).length;
    // No retornamos `boxes` en la lista · ahorra payload
    const { boxes: _boxes, ...rest } = r;
    void _boxes;
    return {
      ...rest,
      scanned_count: scanned,
      expected_count: total,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Detalle de un receipt + cajas (para la pantalla de scan)
// ─────────────────────────────────────────────────────────────

export async function getReceiptVeWithBoxes(
  supabase: SupabaseClient,
  tenantId: string,
  receiptId: string,
): Promise<WarehouseReceiptVeWithBoxes | null> {
  const { data: receipt, error: rErr } = await supabase
    .from("warehouse_receipts_ve")
    .select(
      `id, tenant_id, receipt_code, container_code, vessel, port, eta,
       expected_cbm, expected_boxes, status,
       received_by_operario_id, sealed_by_operario_id, started_at, sealed_at,
       notes, incident_note, deleted_at, created_at, updated_at`,
    )
    .eq("id", receiptId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle<WarehouseReceiptVe>();

  if (rErr) throw rErr;
  if (!receipt) return null;

  const { data: boxes, error: bErr } = await supabase
    .from("warehouse_receipt_ve_boxes")
    .select(
      `id, tenant_id, receipt_id, code, markbox, client_name, cbm, weight_kg,
       source_receipt_cn_id, scanned_at, scanned_by_operario_id, scanned_manual,
       created_at`,
    )
    .eq("receipt_id", receiptId)
    .order("markbox", { ascending: true, nullsFirst: false })
    .order("code", { ascending: true });

  if (bErr) throw bErr;

  const boxesArr = (boxes as WarehouseReceiptVeBox[] | null) ?? [];
  const progress = computeReceiptProgress(boxesArr);

  return {
    ...receipt,
    boxes: boxesArr,
    scanned_count: progress.scanned,
    expected_count: progress.expected,
  };
}

// ─────────────────────────────────────────────────────────────
// Crear receipt (admin · no en RPC porque setup inicial)
// ─────────────────────────────────────────────────────────────

export type CreateReceiptVeInput = {
  container_code?: string | null;
  vessel?: string | null;
  port?: string | null;
  eta?: string | null; // ISO date
  expected_cbm?: number | null;
  expected_boxes: number;
  notes?: string | null;
  /** Cajas esperadas pre-pobladas · cada una con su code DTDU. */
  boxes: Array<{
    code: string;
    markbox?: string | null;
    client_name?: string | null;
    cbm?: number | null;
    weight_kg?: number | null;
    source_receipt_cn_id?: string | null;
  }>;
};

/**
 * Crea un receipt VE con sus cajas esperadas. Usado por:
 *  - Admin desde Studio (al anunciar contenedor en camino).
 *  - Seed / dev para tests.
 */
export async function createReceiptVe(
  admin: SupabaseClient,
  tenantId: string,
  input: CreateReceiptVeInput,
): Promise<{ id: string; receipt_code: string } | { error: string }> {
  // 1. Generar code
  const { data: codeData, error: codeErr } = await admin.rpc(
    "next_receipt_ve_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr) return { error: `No se pudo generar code: ${codeErr.message}` };
  const code = String(codeData ?? "");
  if (!code) return { error: "Code generator devolvió vacío." };

  // 2. Insert receipt
  const { data: row, error: insErr } = await admin
    .from("warehouse_receipts_ve")
    .insert({
      tenant_id: tenantId,
      receipt_code: code,
      container_code: input.container_code ?? null,
      vessel: input.vessel ?? null,
      port: input.port ?? null,
      eta: input.eta ?? null,
      expected_cbm: input.expected_cbm ?? null,
      expected_boxes: input.expected_boxes,
      notes: input.notes ?? null,
    })
    .select("id, receipt_code")
    .single<{ id: string; receipt_code: string }>();

  if (insErr || !row) {
    return { error: `No se pudo crear receipt: ${insErr?.message ?? "sin row"}` };
  }

  // 3. Insert cajas esperadas (batch)
  if (input.boxes.length > 0) {
    const rows = input.boxes.map((b) => ({
      tenant_id: tenantId,
      receipt_id: row.id,
      code: b.code,
      markbox: b.markbox ?? null,
      client_name: b.client_name ?? null,
      cbm: b.cbm ?? null,
      weight_kg: b.weight_kg ?? null,
      source_receipt_cn_id: b.source_receipt_cn_id ?? null,
    }));
    const { error: boxesErr } = await admin
      .from("warehouse_receipt_ve_boxes")
      .insert(rows);
    if (boxesErr) {
      // Rollback manual del receipt (no hay transacción a nivel SDK)
      await admin.from("warehouse_receipts_ve").delete().eq("id", row.id);
      return { error: `No se pudieron crear cajas: ${boxesErr.message}` };
    }
  }

  return { id: row.id, receipt_code: row.receipt_code };
}
