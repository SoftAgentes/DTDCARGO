/**
 * Server actions del Mobile ERP.
 * createExpenseAction (SDD Expenses) — incluye upload opcional de foto del recibo.
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

  const { error: insertErr } = await supabase.from("expenses").insert({
    tenant_id: link.tenant_id,
    user_id: userResp.user.id,
    expense_code: expenseCode,
    amount: input!.amount,
    currency: input!.currency,
    category: input!.category,
    method: input!.method,
    shipment_id: input!.shipment_id,
    note: input!.note,
    location: input!.location,
    billable: input!.billable,
    receipt_path: receiptPath,
  });

  if (insertErr) {
    // Si falló el insert pero subimos foto, intentar limpiar el orphan
    if (receiptPath) {
      await supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath]);
    }
    return { error: `No se pudo guardar el gasto: ${insertErr.message}` };
  }

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

  // Cargar el row actual para conocer expense_code + receipt_path previo
  const { data: existing, error: loadErr } = await supabase
    .from("expenses")
    .select("expense_code, receipt_path, tenant_id, user_id")
    .eq("id", id)
    .maybeSingle<{
      expense_code: string;
      receipt_path: string | null;
      tenant_id: string;
      user_id: string;
    }>();

  if (loadErr || !existing) {
    return { error: "No se pudo cargar el gasto." };
  }
  if (existing.user_id !== userResp.user.id) {
    return { error: "Solo podés editar tus propios gastos." };
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

  const { error: updateErr } = await supabase
    .from("expenses")
    .update({
      amount: input!.amount,
      currency: input!.currency,
      category: input!.category,
      method: input!.method,
      shipment_id: input!.shipment_id,
      note: input!.note,
      location: input!.location,
      billable: input!.billable,
      receipt_path: nextReceiptPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return { error: `No se pudo guardar: ${updateErr.message}` };
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
  if (!userResp.user) return { error: "Iniciá sesión primero." };

  const { data: existing, error: loadErr } = await supabase
    .from("expenses")
    .select("receipt_path, user_id")
    .eq("id", id)
    .maybeSingle<{ receipt_path: string | null; user_id: string }>();

  if (loadErr || !existing) return { error: "Gasto no encontrado." };
  if (existing.user_id !== userResp.user.id) {
    return { error: "Solo podés eliminar tus propios gastos." };
  }

  const { error: updateErr } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) return { error: `No se pudo eliminar: ${updateErr.message}` };

  if (existing.receipt_path) {
    // Cleanup soft · si falla, el gasto igual quedó eliminado
    await supabase.storage.from(RECEIPT_BUCKET).remove([existing.receipt_path]);
  }

  revalidatePath("/m/erp");
  return { ok: true };
}
