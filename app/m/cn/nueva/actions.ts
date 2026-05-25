"use server";

/**
 * Server action para crear recepción desde la PWA del operario (SDD-0027).
 *
 * Flow:
 *  1. getCurrentOperario() valida cookie + DB → si no hay sesión, error
 *  2. Parse + valida input contra validateCreateReceiptInput
 *  3. Llama RPC create_receipt_as_operario con service_role
 *  4. revalidatePath /studio/cn para que el Studio web refresh KPIs
 *  5. Retorna receipt_code para mostrar en el "Done" screen
 *
 * NO retorna detalle del operario al cliente — la PWA ya sabe quién es
 * por la cookie. Solo retorna el código asignado.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import {
  validateCreateReceiptInput,
  type CreateReceiptInput,
  type CreateReceiptState,
} from "@/lib/studio/operario-types";

export async function createReceiptFromOperarioAction(
  _prev: CreateReceiptState,
  formData: FormData,
): Promise<CreateReceiptState> {
  const operario = await getCurrentOperario();
  if (!operario) {
    return { error: "Sesión expirada. Iniciá sesión de nuevo." };
  }

  // Parse desde FormData (todo el payload viene como JSON en `payload`)
  let partial: Partial<CreateReceiptInput>;
  try {
    const raw = formData.get("payload");
    if (typeof raw !== "string" || !raw) {
      return { error: "Payload vacío." };
    }
    partial = JSON.parse(raw) as Partial<CreateReceiptInput>;
  } catch (e) {
    console.error("[createReceiptFromOperarioAction] parse error:", e);
    return { error: "Payload con formato inválido." };
  }

  // Default: warehouse del operario si el cliente no lo mandó
  if (!partial.warehouse_id) {
    partial.warehouse_id = operario.warehouse_id;
  }

  const validation = validateCreateReceiptInput(partial);
  if ("error" in validation && validation.error) {
    return { error: validation.error };
  }
  if (!("input" in validation) || !validation.input) {
    return { error: "Validación falló sin razón explícita." };
  }
  const input = validation.input;

  // RPC con service_role
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_receipt_as_operario", {
    p_operario_id: operario.operario_id,
    p_warehouse_id: input.warehouse_id,
    p_is_orphan: input.is_orphan,
    p_client_markbox: input.client_markbox,
    p_client_name: input.client_name,
    p_orphan_marks: input.orphan_marks,
    p_orphan_brought_by: input.orphan_brought_by,
    p_supplier_name: input.supplier_name,
    p_supplier_translated: input.supplier_name_translated,
    p_boxes: input.boxes,
    p_total_cbm: input.total_cbm,
    p_total_weight_kg: input.total_weight_kg,
    p_received_at: input.received_at,
    p_notes: input.notes,
    p_items: input.items,
    p_incident: input.incident,
    p_incident_note: input.incident_note,
  });

  if (error) {
    console.error("[createReceiptFromOperarioAction] RPC error:", error);
    return { error: `No se pudo guardar: ${error.message}` };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.receipt_code) {
    return { error: "RPC no devolvió código." };
  }

  // Refresh Studio web (KPIs + listado)
  revalidatePath("/studio/cn");
  revalidatePath("/m/cn");

  return {
    ok: true,
    receiptId: row.receipt_id,
    receiptCode: row.receipt_code,
  };
}
