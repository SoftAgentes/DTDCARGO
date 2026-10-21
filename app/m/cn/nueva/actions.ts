"use server";

/**
 * Server action para crear recepción desde la PWA del operario (SDD-0027).
 *
 * Flow:
 *  1. getCurrentOperario() valida cookie + DB → si no hay sesión, error
 *  2. Parse + valida input contra validateCreateReceiptInput
 *  3. Llama RPC create_receipt_as_operario con service_role
 *  4. SDD-0524 · vincula la recepción a su compra (si hay exactamente una
 *     abierta) y programa el aviso «llegó a bodega» al cliente, como el Studio
 *  5. revalidatePath /studio/cn para que el Studio web refresh KPIs
 *  6. Retorna receipt_code para mostrar en el "Done" screen
 *
 * NO retorna detalle del operario al cliente — la PWA ya sabe quién es
 * por la cookie. Solo retorna el código asignado.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { resolveClientNameByMarkbox } from "@/lib/studio/warehouse-cn-queries";
import { vincularYAvisarRecepcionCn } from "@/lib/studio/notifications/aviso-recepcion-cn";
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
    return { error: "Sesión expirada. Inicia sesión de nuevo." };
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
  // (operarios CN siempre tienen warehouse_id; defensive check para satisfacer
  // el tipo nullable introducido en SDD-0030)
  if (!partial.warehouse_id) {
    if (!operario.warehouse_id) {
      return { error: "Operario sin warehouse asignado." };
    }
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
    // PRIVACIDAD (hallazgo H-7): el dispositivo CN manda `null`. El nombre lo
    // resuelve el server desde el Shipping Mark, para que el Studio (VE) siga
    // viendo el snapshot correcto sin que el nombre viaje nunca a Yiwu.
    p_client_name: await resolveClientNameByMarkbox(
      admin,
      operario.tenant_id,
      input.client_markbox,
    ),
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
    p_destination_city: input.destination_city,
  });

  if (error) {
    console.error("[createReceiptFromOperarioAction] RPC error:", error);
    // Only the new identified serialization/governed denials use this local
    // copy. Preserve the submitted intent; a response error is not proof of a
    // receipt or permission to retry this command automatically.
    if (error.code === "40001" || (error.code === "P0001" && error.hint === "dtd-client-normal"
      && (error.message === "NORMAL_GOVERNED" || error.message === "NORMAL_CONFLICT" || error.message === "NORMAL_FORBIDDEN"))) {
      return { error: "No se pudo confirmar la recepción. Revisa su estado y vuelve a intentarlo." };
    }
    return { error: `No se pudo guardar: ${error.message}` };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.receipt_code) {
    return { error: "RPC no devolvió código." };
  }

  // ── SDD-0524 · vincular a su compra y avisarle al cliente ──
  //
  // 🔴 Este camino no avisaba a nadie y nunca vinculaba: la mercancía que el
  // equipo de China registraba a mano llegaba a Yiwu en silencio, y en el
  // Portal la compra seguía diciendo que no había llegado. Ahora hace lo mismo
  // que el Studio de escritorio (detalle en `aviso-recepcion-cn.ts`).
  //
  // Con `await`, como el escritorio: el operario espera unos milisegundos y, a
  // cambio, la nota de un cliente sin aviso queda escrita antes de responder.
  // Best-effort: un fallo del aviso no invalida la recepción ya creada.
  // Una huérfana no avisa a nadie: todavía no se sabe de quién es.
  if (!input.is_orphan && input.client_markbox && row.receipt_id) {
    try {
      await vincularYAvisarRecepcionCn(admin, {
        tenantId: operario.tenant_id,
        receiptId: row.receipt_id,
        markbox: input.client_markbox,
      });
    } catch (err) {
      console.error("[createReceiptFromOperarioAction] aviso de recepción falló:", err);
    }
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
