import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpenseVoidOutcome = "voided" | "replayed";

export interface ExpenseVoidInput {
  expenseId: string;
  reason: string;
  requestRef: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function validateExpenseVoidInput(raw: Partial<ExpenseVoidInput>):
  | { input: ExpenseVoidInput }
  | { error: string } {
  const expenseId = raw.expenseId?.trim() ?? "";
  const reason = raw.reason?.trim() ?? "";
  const requestRef = raw.requestRef?.trim() ?? "";

  if (!UUID_RE.test(expenseId)) {
    return { error: "El gasto no tiene un identificador válido. Actualiza la vista." };
  }
  if (reason.length < 4 || reason.length > 1000) {
    return { error: "Escribe un motivo de 4 a 1000 caracteres." };
  }
  if (!REQUEST_REF_RE.test(requestRef)) {
    return { error: "La referencia de la solicitud no es válida. Vuelve a abrir el diálogo." };
  }
  return { input: { expenseId, reason, requestRef } };
}

export async function voidExpenseGoverned(
  supabase: SupabaseClient,
  input: ExpenseVoidInput,
): Promise<ExpenseVoidOutcome> {
  const { data, error } = await supabase.rpc("void_expense_governed", {
    p_expense_id: input.expenseId,
    p_reason: input.reason,
    p_request_ref: input.requestRef,
  });
  if (error) throw error;
  if (data !== "voided" && data !== "replayed") {
    throw new Error("Respuesta inválida de void_expense_governed");
  }
  return data;
}

export function expenseVoidErrorMessage(
  error: unknown,
  requestRef: string,
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "42501") return "No tienes permiso para anular este gasto.";
  if (code === "P0002") return "El gasto no está disponible en tu tenant.";
  if (code === "40001") {
    return "El gasto cambió o ya fue anulado. Actualiza la vista antes de reintentar.";
  }
  if (code === "22023") return "El gasto, el motivo o la referencia ya no son válidos.";
  if (code === "23514") return "El gasto pertenece a un período contable cerrado.";
  return `No se pudo anular el gasto. Intenta de nuevo. Referencia: ${requestRef}`;
}
