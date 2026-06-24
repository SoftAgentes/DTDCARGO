"use server";

/**
 * Server actions del módulo Cola de QR (SDD-0033).
 *
 * - batchAssignPrinterAction: status pendiente → imprimiendo + assigned_printer
 * - markPrintedAction: status imprimiendo → impreso (uno o batch)
 * - markDeliveredAction: status impreso → entregado (uno o batch)
 * - cancelQrOrderAction: * → cancelado con razón
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateBatchPrintInput,
  validateCancelQrOrderInput,
  type BatchPrintInput,
  type CancelQrOrderInput,
  type QrQueueActionState,
} from "@/lib/studio/qr-queue-types";

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseIdsList(formData: FormData): string[] {
  // Acepta múltiples valores 'ids' o un solo string JSON-array
  const all = formData.getAll("ids");
  if (all.length > 1) {
    return all.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const v = parseStringOrNull(formData.get("ids"));
  if (!v) return [];
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      /* fallthrough */
    }
  }
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// batchAssignPrinter (pendiente → imprimiendo)
// ─────────────────────────────────────────────────────────────

export async function batchAssignPrinterAction(
  _prev: QrQueueActionState,
  formData: FormData,
): Promise<QrQueueActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "qrqueue");
  if (denial) return { error: denial };


  const partial: Partial<BatchPrintInput> = {
    ids: parseIdsList(formData),
    printer_label: parseStringOrNull(formData.get("printer_label")) ?? undefined,
  };

  const { input, fieldErrors } = validateBatchPrintInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error, data: updated } = await supabase
    .from("qr_print_orders")
    .update({
      status: "imprimiendo",
      assigned_printer: input!.printer_label,
    })
    .in("id", input!.ids)
    .eq("status", "pendiente")
    .select("id");

  if (error) return { error: `No se pudo asignar impresora: ${error.message}` };

  revalidatePath("/studio/cola-qr");
  return { ok: true, updatedCount: updated?.length ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// markPrinted (imprimiendo → impreso)
// ─────────────────────────────────────────────────────────────

export async function markPrintedAction(
  _prev: QrQueueActionState,
  formData: FormData,
): Promise<QrQueueActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "qrqueue");
  if (denial) return { error: denial };

  const ids = parseIdsList(formData);
  if (ids.length === 0) return { fieldErrors: { ids: "Selecciona al menos 1 orden." } };

  const { error, data: updated } = await supabase
    .from("qr_print_orders")
    .update({ status: "impreso" })
    .in("id", ids)
    .eq("status", "imprimiendo")
    .select("id");

  if (error) return { error: `No se pudo marcar impreso: ${error.message}` };

  revalidatePath("/studio/cola-qr");
  return { ok: true, updatedCount: updated?.length ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// markDelivered (impreso → entregado)
// ─────────────────────────────────────────────────────────────

export async function markDeliveredAction(
  _prev: QrQueueActionState,
  formData: FormData,
): Promise<QrQueueActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "qrqueue");
  if (denial) return { error: denial };

  const ids = parseIdsList(formData);
  if (ids.length === 0) return { fieldErrors: { ids: "Selecciona al menos 1 orden." } };

  const { error, data: updated } = await supabase
    .from("qr_print_orders")
    .update({ status: "entregado" })
    .in("id", ids)
    .eq("status", "impreso")
    .select("id");

  if (error) return { error: `No se pudo marcar entregado: ${error.message}` };

  revalidatePath("/studio/cola-qr");
  return { ok: true, updatedCount: updated?.length ?? 0 };
}

// ─────────────────────────────────────────────────────────────
// cancelQrOrder (cualquier no-terminal → cancelado)
// ─────────────────────────────────────────────────────────────

export async function cancelQrOrderAction(
  _prev: QrQueueActionState,
  formData: FormData,
): Promise<QrQueueActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "qrqueue");
  if (denial) return { error: denial };


  const partial: Partial<CancelQrOrderInput> = {
    id: parseStringOrNull(formData.get("id")) ?? undefined,
    reason: parseStringOrNull(formData.get("reason")) ?? undefined,
  };
  const { input, fieldErrors } = validateCancelQrOrderInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("qr_print_orders")
    .update({ status: "cancelado", cancel_reason: input!.reason })
    .eq("id", input!.id);

  if (error) return { error: `No se pudo cancelar: ${error.message}` };

  revalidatePath("/studio/cola-qr");
  return { ok: true, updatedCount: 1 };
}
