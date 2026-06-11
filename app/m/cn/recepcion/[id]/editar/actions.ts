"use server";

/**
 * editReceiptAction · Sprint 1 v3
 *
 * Wrapper de `operario_action.edit_receipt` para que el operario CN edite
 * su propia recepción mientras esté en `pendiente_consolidacion`.
 *
 * Audit log automático en `entity_audit_log` via la RPC. La PWA muestra
 * badge "editada" via Realtime si el admin estaba mirando esa row.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import {
  validateCreateReceiptInput,
  type CreateReceiptInput,
  type CreateReceiptState,
} from "@/lib/studio/operario-types";

export async function editReceiptAction(
  receiptId: string,
  _prev: CreateReceiptState,
  formData: FormData,
): Promise<CreateReceiptState> {
  const operario = await getCurrentOperario();
  if (!operario) {
    return { error: "Sesión expirada. Inicia sesión de nuevo." };
  }
  if (operario.region !== "cn") {
    return { error: "Solo operarios CN pueden editar recepciones CN." };
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
    console.error("[editReceiptAction] parse error:", e);
    return { error: "Payload con formato inválido." };
  }

  // El warehouse_id no es editable · usamos el del operario para validar
  if (!partial.warehouse_id) {
    partial.warehouse_id = operario.warehouse_id ?? undefined;
  }
  if (!partial.warehouse_id) {
    return { error: "Operario sin warehouse asignado." };
  }

  const validation = validateCreateReceiptInput(partial);
  if ("error" in validation && validation.error) {
    return { error: validation.error };
  }
  if (!("input" in validation) || !validation.input) {
    return { error: "Validación falló sin razón explícita." };
  }
  const input = validation.input;

  // RPC operario_action con branch edit_receipt
  const admin = createAdminClient();
  const { error } = await admin.rpc("operario_action", {
    p_operario_id: operario.operario_id,
    p_action_type: "edit_receipt",
    p_payload: {
      receipt_id: receiptId,
      client_markbox: input.client_markbox,
      client_name: input.client_name,
      orphan_marks: input.orphan_marks,
      orphan_brought_by: input.orphan_brought_by,
      supplier_name: input.supplier_name,
      supplier_name_translated: input.supplier_name_translated,
      boxes: input.boxes,
      total_cbm: input.total_cbm,
      total_weight_kg: input.total_weight_kg,
      notes: input.notes,
      destination_city: input.destination_city,
      items: input.items,
    },
  });

  if (error) {
    return { error: humanizeEditError(error.message) };
  }

  revalidatePath("/m/cn");
  revalidatePath(`/m/cn/recepcion/${receiptId}`);
  revalidatePath("/studio/cn");

  return {
    ok: true,
    receiptId,
  };
}

function humanizeEditError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios CN pueden editar acá.";
  if (msg.includes("P0110")) return "Falta el ID de la recepción.";
  if (msg.includes("P0140")) return "Recepción no encontrada.";
  if (msg.includes("P0141")) return "Esta recepción no pertenece a tu tenant.";
  if (msg.includes("P0142")) return "Solo puedes editar tus propias recepciones.";
  if (msg.includes("P0143")) return "Esta recepción ya fue consolidada · no se puede editar.";
  if (msg.includes("P0144")) return "Cajas debe ser un número positivo.";
  return msg;
}
