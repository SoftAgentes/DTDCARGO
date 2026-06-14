/**
 * Server actions del Mobile ERP.
 * createExpenseAction (SDD Expenses) — incluye upload opcional de foto del recibo.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { resolveExpenseAccountId } from "@/lib/studio/expense-queries";
import {
  syncExpenseEntry,
  voidExpenseEntriesForExpense,
} from "@/lib/studio/accounting/expense-posting";
import {
  getAccountingSettings,
  isPeriodClosed,
} from "@/lib/studio/accounting/period-queries";
import {
  validateExpenseInput,
  type CreateExpenseInput,
  type ExpenseActionState,
  type ExpenseCurrency,
  type ExpenseCategory,
  type ExpenseMethod,
} from "@/lib/studio/expense-types";

const RECEIPT_BUCKET = "expense-receipts";
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

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

  // Guard de período cerrado (SDD-0080): el gasto se fecha hoy; si hoy está en
  // período cerrado, no se carga (su asiento sería rechazado por el trigger).
  const accSettings = await getAccountingSettings(supabase);
  if (isPeriodClosed(accSettings.closing_date, new Date().toISOString())) {
    return {
      error: `Período contable cerrado al ${accSettings.closing_date}: no puedes cargar gastos en un período cerrado.`,
    };
  }

  // Validar receipt ANTES de generar code (no malgastar correlativo si falla)
  const receiptRaw = formData.get("receipt");
  let receiptFile: File | null = null;
  if (receiptRaw && receiptRaw instanceof File && receiptRaw.size > 0) {
    if (!RECEIPT_ALLOWED_MIME.has(receiptRaw.type)) {
      return {
        fieldErrors: { receipt: "Formato inválido. Solo JPG/PNG/WebP/HEIC." },
      };
    }
    if (receiptRaw.size > RECEIPT_MAX_BYTES) {
      return {
        fieldErrors: { receipt: "Foto demasiado pesada (máx 5 MB)." },
      };
    }
    receiptFile = receiptRaw;
  }

  // Generar code via RPC
  const { data: codeRaw, error: codeErr } = await supabase.rpc(
    "next_expense_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeRaw) {
    return { error: `No se pudo generar código: ${codeErr?.message}` };
  }
  const expenseCode = String(codeRaw);

  // Upload del recibo (si vino) ANTES del insert para tener receipt_path
  let receiptPath: string | null = null;
  if (receiptFile) {
    const ext = extFromMime(receiptFile.type);
    const path = `${link.tenant_id}/${userResp.user.id}/${expenseCode}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, receiptFile, {
        contentType: receiptFile.type,
        upsert: true,
      });
    if (uploadErr) {
      return {
        error: `No se pudo subir el recibo: ${uploadErr.message}`,
      };
    }
    receiptPath = path;
  }

  // Imputación contable: cuenta del plan según la categoría (SDD-0077).
  const accountId = await resolveExpenseAccountId(
    supabase,
    link.tenant_id,
    input!.category,
  );

  const { data: insertedExp, error: insertErr } = await supabase
    .from("expenses")
    .insert({
      tenant_id: link.tenant_id,
      user_id: userResp.user.id,
      expense_code: expenseCode,
      amount: input!.amount,
      currency: input!.currency,
      amount_usd: input!.amount_usd,
      fx_rate: input!.fx_rate,
      scope: input!.scope,
      category: input!.category,
      method: input!.method,
      shipment_id: input!.shipment_id,
      note: input!.note,
      location: input!.location,
      billable: input!.billable,
      receipt_path: receiptPath,
      account_id: accountId,
    })
    .select("id, occurred_at")
    .single<{ id: string; occurred_at: string }>();

  if (insertErr || !insertedExp) {
    // Si falló el insert pero subimos foto, intentar limpiar el orphan
    if (receiptPath) {
      await supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath]);
    }
    return { error: `No se pudo guardar el gasto: ${insertErr?.message}` };
  }

  // Asiento automático del gasto (best-effort) — DR cuenta de gasto / CR
  // caja-banco según el método. No bloquea la carga (SDD-0079).
  await syncExpenseEntry({
    tenantId: link.tenant_id,
    expenseId: insertedExp.id,
    expenseCode,
    accountId,
    amountUsd: input!.amount_usd,
    method: input!.method,
    entryDate: String(insertedExp.occurred_at).slice(0, 10),
  });

  revalidatePath("/m/erp");
  return { ok: true, expenseCode };
}

/**
 * Editar gasto propio. RLS bloquea editar gastos de otros users.
 * Si vino una nueva foto, reemplaza la anterior (upload nueva → update path → delete vieja).
 * Si vino flag remove_receipt=true, elimina la foto sin reemplazo.
 */
export async function updateExpenseAction(
  id: string,
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

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

  // Cargar el row actual: expense_code + receipt_path + estado contable previo
  // (para re-sincronizar el asiento solo si cambió monto/cuenta/método · SDD-0079).
  const { data: existing, error: loadErr } = await supabase
    .from("expenses")
    .select(
      "expense_code, receipt_path, tenant_id, user_id, amount_usd, account_id, method, occurred_at",
    )
    .eq("id", id)
    .maybeSingle<{
      expense_code: string;
      receipt_path: string | null;
      tenant_id: string;
      user_id: string;
      amount_usd: number;
      account_id: string | null;
      method: ExpenseMethod;
      occurred_at: string;
    }>();

  if (loadErr || !existing) {
    return { error: "No se pudo cargar el gasto." };
  }
  if (existing.user_id !== userResp.user.id) {
    return { error: "Solo puedes editar tus propios gastos." };
  }

  // Guard de período cerrado (SDD-0080): no editar un gasto de período cerrado.
  const accSettings = await getAccountingSettings(supabase);
  if (isPeriodClosed(accSettings.closing_date, existing.occurred_at)) {
    return {
      error: `Período contable cerrado al ${accSettings.closing_date}: no puedes editar un gasto de período cerrado.`,
    };
  }

  // Manejo de foto
  let nextReceiptPath: string | null = existing.receipt_path;
  let oldReceiptToDelete: string | null = null;

  const wantsRemove = formData.get("remove_receipt") === "true";
  const receiptRaw = formData.get("receipt");
  const hasNewFile =
    receiptRaw && receiptRaw instanceof File && receiptRaw.size > 0;

  if (hasNewFile) {
    const file = receiptRaw as File;
    if (!RECEIPT_ALLOWED_MIME.has(file.type)) {
      return {
        fieldErrors: { receipt: "Formato inválido. Solo JPG/PNG/WebP/HEIC." },
      };
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      return {
        fieldErrors: { receipt: "Foto demasiado pesada (máx 5 MB)." },
      };
    }
    const ext = extFromMime(file.type);
    const path = `${existing.tenant_id}/${userResp.user.id}/${existing.expense_code}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadErr) {
      return { error: `No se pudo subir el recibo: ${uploadErr.message}` };
    }
    // Si el path es distinto al anterior, encolar el viejo para borrar
    if (existing.receipt_path && existing.receipt_path !== path) {
      oldReceiptToDelete = existing.receipt_path;
    }
    nextReceiptPath = path;
  } else if (wantsRemove && existing.receipt_path) {
    oldReceiptToDelete = existing.receipt_path;
    nextReceiptPath = null;
  }

  // Re-imputar la cuenta del plan (la categoría pudo cambiar al editar · SDD-0077).
  const accountId = await resolveExpenseAccountId(
    supabase,
    existing.tenant_id,
    input!.category,
  );

  const { error: updateErr } = await supabase
    .from("expenses")
    .update({
      amount: input!.amount,
      currency: input!.currency,
      amount_usd: input!.amount_usd,
      fx_rate: input!.fx_rate,
      scope: input!.scope,
      category: input!.category,
      method: input!.method,
      shipment_id: input!.shipment_id,
      note: input!.note,
      location: input!.location,
      billable: input!.billable,
      receipt_path: nextReceiptPath,
      account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return { error: `No se pudo guardar: ${updateErr.message}` };
  }

  // Re-sincronizar el asiento si cambió monto, cuenta o método (anula + repostea).
  const acctChanged =
    (existing.account_id ?? null) !== (accountId ?? null) ||
    Number(existing.amount_usd) !== Number(input!.amount_usd) ||
    existing.method !== input!.method;
  if (acctChanged) {
    await voidExpenseEntriesForExpense(existing.tenant_id, id);
    await syncExpenseEntry({
      tenantId: existing.tenant_id,
      expenseId: id,
      expenseCode: existing.expense_code,
      accountId,
      amountUsd: input!.amount_usd,
      method: input!.method,
      entryDate: String(existing.occurred_at).slice(0, 10),
    });
  }

  if (oldReceiptToDelete) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([oldReceiptToDelete]);
  }

  revalidatePath("/m/erp");
  return { ok: true, expenseCode: existing.expense_code };
}

/**
 * Soft-delete del gasto + cleanup de la foto en Storage si existe.
 */
export async function softDeleteExpenseAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: existing, error: loadErr } = await supabase
    .from("expenses")
    .select("receipt_path, user_id, tenant_id, occurred_at")
    .eq("id", id)
    .maybeSingle<{
      receipt_path: string | null;
      user_id: string;
      tenant_id: string;
      occurred_at: string;
    }>();

  if (loadErr || !existing) return { error: "Gasto no encontrado." };
  if (existing.user_id !== userResp.user.id) {
    return { error: "Solo puedes eliminar tus propios gastos." };
  }

  // Guard de período cerrado (SDD-0080): no borrar un gasto de período cerrado.
  const accSettings = await getAccountingSettings(supabase);
  if (isPeriodClosed(accSettings.closing_date, existing.occurred_at)) {
    return {
      error: `Período contable cerrado al ${accSettings.closing_date}: no puedes borrar un gasto de período cerrado.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) return { error: `No se pudo eliminar: ${updateErr.message}` };

  // Anular el asiento del gasto (best-effort · SDD-0079).
  await voidExpenseEntriesForExpense(existing.tenant_id, id);

  if (existing.receipt_path) {
    // Cleanup soft · si falla, el gasto igual quedó eliminado
    await supabase.storage.from(RECEIPT_BUCKET).remove([existing.receipt_path]);
  }

  revalidatePath("/m/erp");
  return { ok: true };
}
