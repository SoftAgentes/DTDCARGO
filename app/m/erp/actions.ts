/**
 * Server actions del Mobile ERP.
 * Por ahora solo createExpenseAction (SDD Expenses).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateExpenseInput,
  type CreateExpenseInput,
  type ExpenseActionState,
  type ExpenseCurrency,
  type ExpenseCategory,
  type ExpenseMethod,
} from "@/lib/studio/expense-types";

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  const partial: Partial<CreateExpenseInput> = {
    amount: Number(formData.get("amount") ?? 0),
    currency: (formData.get("currency") as ExpenseCurrency) || "USD",
    category: (formData.get("category") as ExpenseCategory) || "otro",
    method: (formData.get("method") as ExpenseMethod) || "cash",
    shipment_id: (formData.get("shipment_id") as string | null) || null,
    note: (formData.get("note") as string | null) || null,
    location: (formData.get("location") as string | null) || null,
    billable: formData.get("billable") === "on" || formData.get("billable") === "true",
  };

  const { input, fieldErrors } = validateExpenseInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Generar code via RPC
  const { data: codeRaw, error: codeErr } = await supabase.rpc(
    "next_expense_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeRaw) {
    return { error: `No se pudo generar código: ${codeErr?.message}` };
  }

  const { error: insertErr } = await supabase.from("expenses").insert({
    tenant_id: link.tenant_id,
    user_id: userResp.user.id,
    expense_code: String(codeRaw),
    amount: input!.amount,
    currency: input!.currency,
    category: input!.category,
    method: input!.method,
    shipment_id: input!.shipment_id,
    note: input!.note,
    location: input!.location,
    billable: input!.billable,
  });

  if (insertErr) {
    return { error: `No se pudo guardar el gasto: ${insertErr.message}` };
  }

  revalidatePath("/m/erp");
  return { ok: true, expenseCode: String(codeRaw) };
}
