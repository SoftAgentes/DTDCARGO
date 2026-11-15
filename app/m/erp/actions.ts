/**
 * Server actions del Mobile ERP.
 * createExpenseAction (SDD Expenses) — incluye upload opcional de foto del recibo.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { resolveExpenseAccountId } from "@/lib/studio/expense-queries";
import {
  syncExpenseEntry,
  voidExpenseEntriesForExpense,
} from "@/lib/studio/accounting/expense-posting";
import { isPeriodClosed } from "@/lib/studio/accounting/period-queries";
import { fechaCaracas, isCalendarDate, validInstant } from "@/lib/shared/fechas-caracas";
import {
  validateExpenseInput,
  type CreateExpenseInput,
  type ExpenseActionState,
  type ExpenseCurrency,
  type ExpenseCategory,
  type ExpenseMethod,
} from "@/lib/studio/expense-types";
import { capabilityDenial, getStudioRole } from "@/lib/studio/rbac-guard";
import {
  expenseVoidErrorMessage,
  validateExpenseVoidInput,
  voidExpenseGoverned,
  type ExpenseVoidOutcome,
} from "@/lib/studio/expense-void";

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

/**
 * SDD-0624 · `support` es de solo lectura: la 0528 le niega escribir gastos en
 * la base. Devuelve el mensaje claro (o null si puede escribir) para no llegar
 * a un 42501 crudo después de haber gastado correlativo y subido la foto.
 */
async function rolSoloLectura(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const role = await getStudioRole(supabase);
  return role === "support"
    ? "Tu rol es de solo lectura: no puedes cargar ni editar gastos."
    : null;
}

type ExpenseClient = Awaited<ReturnType<typeof createClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Estas lecturas privadas no heredan la tolerancia del lector general.
async function expenseTenant(client: ExpenseClient): Promise<string | null> {
  try {
    const { data, error } = await client.rpc("get_user_tenant_id");
    return !error && isUuid(data) ? data : null;
  } catch {
    return null;
  }
}

async function expenseClosing(client: ExpenseClient, tenantId: string): Promise<
  { closing_date: string | null } | { error: string }
> {
  const unavailable = { error: "No se pudo comprobar el cierre contable. Reintenta." };
  try {
    const { data, error } = await client.from("accounting_settings")
      .select("tenant_id, closing_date").eq("tenant_id", tenantId).limit(2);
    if (error || !Array.isArray(data) || data.length > 1) return unavailable;
    if (data.length === 0) return { closing_date: null };
    const row: unknown = data[0];
    if (!isRow(row) || row.tenant_id !== tenantId ||
        (row.closing_date !== null && !isCalendarDate(row.closing_date))) return unavailable;
    return { closing_date: row.closing_date as string | null };
  } catch {
    return unavailable;
  }
}

type OwnExpense = {
  id: string; tenant_id: string; user_id: string; deleted_at: null;
  expense_code: string; receipt_path: string | null; amount_usd: number | string;
  account_id: string | null; method: ExpenseMethod; occurred_at: string;
};
async function ownExpense(client: ExpenseClient, id: string, tenantId: string, userId: string): Promise<
  { expense: OwnExpense; day: string } | { error: string }
> {
  const unavailable = { error: "No se pudo comprobar el gasto propio y su fecha histórica. Reintenta." };
  try {
    const { data, error } = await client.from("expenses")
      .select("id, expense_code, receipt_path, tenant_id, user_id, deleted_at, amount_usd, account_id, method, occurred_at")
      .eq("id", id).eq("tenant_id", tenantId).eq("user_id", userId).is("deleted_at", null).limit(2);
    if (error || !Array.isArray(data) || data.length !== 1) return unavailable;
    const row: unknown = data[0];
    if (!isRow(row) || !isUuid(row.id) || row.id !== id || row.tenant_id !== tenantId ||
        row.user_id !== userId || row.deleted_at !== null ||
        typeof row.expense_code !== "string" || !row.expense_code ||
        (row.receipt_path !== null && typeof row.receipt_path !== "string") ||
        (row.account_id !== null && !isUuid(row.account_id)) ||
        !["cash", "card", "transfer", "usdt"].includes(row.method as string) ||
        !((typeof row.amount_usd === "number" || (typeof row.amount_usd === "string" && row.amount_usd.trim() !== "")) &&
          Number.isFinite(Number(row.amount_usd))) ||
        typeof row.occurred_at !== "string") return unavailable;
    const day = fechaCaracas(validInstant(row.occurred_at));
    return { expense: row as OwnExpense, day };
  } catch {
    return unavailable;
  }
}

async function expenseHistoryError(
  client: ExpenseClient | ReturnType<typeof createAdminClient>, tenantId: string, expenseId: string, day: string, closingDate: string | null,
): Promise<string | null> {
  const unavailable = "No se pudo comprobar el asiento histórico del gasto. Reintenta.";
  try {
    const { data, error } = await client.from("journal_entries")
      .select("id, tenant_id, expense_id, source, entry_date, status, deleted_at")
      .eq("tenant_id", tenantId).eq("expense_id", expenseId)
      .eq("status", "asentado").is("deleted_at", null).limit(2);
    if (error || !Array.isArray(data) || data.length > 1) return unavailable;
    if (data.length === 0) return null;
    const row: unknown = data[0];
    if (!isRow(row) || !isUuid(row.id) || row.tenant_id !== tenantId ||
        row.expense_id !== expenseId || row.source !== "expense" ||
        row.status !== "asentado" || row.deleted_at !== null || !isCalendarDate(row.entry_date)) return unavailable;
    if (isPeriodClosed(closingDate, row.entry_date)) {
      return "Período contable cerrado: el asiento histórico del gasto no se puede modificar.";
    }
    if (row.entry_date !== day) {
      return "La fecha del asiento histórico no coincide con la fecha del gasto. Requiere revisión contable.";
    }
    return null;
  } catch {
    return unavailable;
  }
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  // Una sola ancla antes de sesión, auth o cualquier otra espera.
  const occurredAt = new Date().toISOString();
  const expenseDay = fechaCaracas(occurredAt);
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };
  // SDD-0624: la base (0528) ya no deja escribir gastos a support; se lo
  // decimos claro ANTES de gastar un correlativo o subir la foto.
  const soloLectura = await rolSoloLectura(supabase);
  if (soloLectura) return { error: soloLectura };

  const partial: Partial<CreateExpenseInput> = {
    amount: Number(formData.get("amount") ?? 0),
    currency: (formData.get("currency") as ExpenseCurrency) || "USD",
    // SDD-0569: el móvil manda la tasa (precargada de fx_rates); el validador la exige fuera de USD.
    fx_rate: formData.get("fx_rate") ? Number(formData.get("fx_rate")) : undefined,
    category: (formData.get("category") as ExpenseCategory) || "otro",
    method: (formData.get("method") as ExpenseMethod) || "cash",
    shipment_id: (formData.get("shipment_id") as string | null) || null,
    note: (formData.get("note") as string | null) || null,
    location: (formData.get("location") as string | null) || null,
    billable: formData.get("billable") === "on" || formData.get("billable") === "true",
  };

  const { input, fieldErrors } = validateExpenseInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await expenseTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Guard de período cerrado (SDD-0080): el gasto se fecha hoy; si hoy está en
  // período cerrado, no se carga (su asiento sería rechazado por el trigger).
  const accSettings = await expenseClosing(supabase, tenantId);
  if ("error" in accSettings) return accSettings;
  if (isPeriodClosed(accSettings.closing_date, expenseDay)) {
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
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeRaw) {
    return { error: `No se pudo generar código: ${codeErr?.message}` };
  }
  const expenseCode = String(codeRaw);

  // Upload del recibo (si vino) ANTES del insert para tener receipt_path
  let receiptPath: string | null = null;
  if (receiptFile) {
    const ext = extFromMime(receiptFile.type);
    const path = `${tenantId}/${userResp.user.id}/${expenseCode}.${ext}`;
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
    tenantId,
    input!.category,
  );

  const { data: insertedExp, error: insertErr } = await supabase
    .from("expenses")
    .insert({
      tenant_id: tenantId,
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
      occurred_at: occurredAt,
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
    tenantId,
    expenseId: insertedExp.id,
    expenseCode,
    accountId,
    amountUsd: input!.amount_usd,
    method: input!.method,
    entryDate: expenseDay,
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
  const soloLectura = await rolSoloLectura(supabase);
  if (soloLectura) return { error: soloLectura };

  const partial: Partial<CreateExpenseInput> = {
    amount: Number(formData.get("amount") ?? 0),
    currency: (formData.get("currency") as ExpenseCurrency) || "USD",
    // SDD-0569: el móvil manda la tasa (precargada de fx_rates); el validador la exige fuera de USD.
    fx_rate: formData.get("fx_rate") ? Number(formData.get("fx_rate")) : undefined,
    category: (formData.get("category") as ExpenseCategory) || "otro",
    method: (formData.get("method") as ExpenseMethod) || "cash",
    shipment_id: (formData.get("shipment_id") as string | null) || null,
    note: (formData.get("note") as string | null) || null,
    location: (formData.get("location") as string | null) || null,
    billable: formData.get("billable") === "on" || formData.get("billable") === "true",
  };

  const { input, fieldErrors } = validateExpenseInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await expenseTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };
  const origin = await ownExpense(supabase, id, tenantId, userResp.user.id);
  if ("error" in origin) return origin;
  const { expense: existing, day: expenseDay } = origin;

  // Guard de período cerrado (SDD-0080): no editar un gasto de período cerrado.
  const accSettings = await expenseClosing(supabase, tenantId);
  if ("error" in accSettings) return accSettings;
  if (isPeriodClosed(accSettings.closing_date, expenseDay)) {
    return {
      error: `Período contable cerrado al ${accSettings.closing_date}: no puedes editar un gasto de período cerrado.`,
    };
  }

  // Resolver y comprobar historia ANTES de foto, UPDATE, anulación o repost.
  const accountId = await resolveExpenseAccountId(
    supabase,
    tenantId,
    input!.category,
  );
  const acctChanged =
    (existing.account_id ?? null) !== (accountId ?? null) ||
    Number(existing.amount_usd) !== Number(input!.amount_usd) ||
    existing.method !== input!.method;
  if (acctChanged) {
    // SDD-0624: desde la 0528 comercial y operaciones no leen journal_entries;
    // con su sesión verían 0 filas y la comprobación pasaría en falso. El gasto
    // ya se probó propio (ownExpense, con la sesión); el asiento se lee con el
    // cliente de servicio, el mismo que después lo anula y lo vuelve a asentar.
    const error = await expenseHistoryError(createAdminClient(), tenantId, id, expenseDay, accSettings.closing_date);
    if (error) return { error };
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
  if (acctChanged) {
    await voidExpenseEntriesForExpense(existing.tenant_id, id);
    await syncExpenseEntry({
      tenantId: existing.tenant_id,
      expenseId: id,
      expenseCode: existing.expense_code,
      accountId,
      amountUsd: input!.amount_usd,
      method: input!.method,
      entryDate: expenseDay,
    });
  }

  if (oldReceiptToDelete) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([oldReceiptToDelete]);
  }

  revalidatePath("/m/erp");
  return { ok: true, expenseCode: existing.expense_code };
}

/** Anulación P3/R3: conserva gasto, asiento, referencias y recibo. */
export async function voidExpenseAction(
  id: string,
  reason: string,
  requestRef: string,
): Promise<{ ok?: boolean; outcome?: ExpenseVoidOutcome; error?: string }> {
  const parsed = validateExpenseVoidInput({ expenseId: id, reason, requestRef });
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "void_expense");
  if (denial) return { error: denial };

  try {
    const outcome = await voidExpenseGoverned(supabase, parsed.input);
    revalidatePath("/m/erp");
    revalidatePath("/studio/gastos");
    return { ok: true, outcome };
  } catch (error) {
    return { error: expenseVoidErrorMessage(error, parsed.input.requestRef) };
  }
}
