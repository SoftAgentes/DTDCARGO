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
