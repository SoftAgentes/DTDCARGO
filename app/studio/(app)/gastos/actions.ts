"use server";

/**
 * Server actions del módulo Gastos web (SDD-0039).
 *
 * El módulo web lo usa el equipo CN (warehouse/operations/accounting) +
 * accounting VE. RLS (policies expenses_cn_team / expenses_ve_accounting
 * de 0074) decide qué ve/crea cada rol. Auth normal (auth.uid()).
 *
 * Diferencia vs mobile m/erp: maneja scope (shipment/external) + moneda
 * dual (amount_usd + fx_rate) + tenant_fx_history. Reusa next_expense_code
 * RPC + bucket expense-receipts.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  autoResolveAlertForShipment,
  resolveAlertManual,
} from "@/lib/studio/expense-alerts-queries";
import {
  listMonthExpensesForExport,
  resolveExpenseAccountId,
  signReceiptUrls,
} from "@/lib/studio/expense-queries";
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
  currencyPair,
  categoryLabel,
  METHOD_LABEL_KEYS,
  type CreateExpenseInput,
  type ExpenseActionState,
  type ExpenseCategory,
  type ExpenseCurrency,
  type ExpenseMethod,
  type ExpenseScope,
} from "@/lib/studio/expense-types";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { t } from "@/lib/i18n";

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

function parseExpenseForm(formData: FormData): Partial<CreateExpenseInput> {
  return {
    amount: Number(formData.get("amount") ?? 0),
    currency: (formData.get("currency") as ExpenseCurrency) || "USD",
    fx_rate: Number(formData.get("fx_rate") ?? 1),
    category: (formData.get("category") as ExpenseCategory) || "otro",
    scope: (formData.get("scope") as ExpenseScope) || "shipment",
    method: (formData.get("method") as ExpenseMethod) || "cash",
    shipment_id: (formData.get("shipment_id") as string | null) || null,
    note: (formData.get("note") as string | null) || null,
    location: (formData.get("location") as string | null) || null,
    billable:
      formData.get("billable") === "on" || formData.get("billable") === "true",
  };
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  const { input, fieldErrors } = validateExpenseInput(parseExpenseForm(formData));
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { errorCode: "tenant_unresolved" };

  // Guard de período cerrado (SDD-0080): el gasto se fecha hoy (occurred_at =
  // now); si el período de hoy está cerrado, no se carga (su asiento sería
  // rechazado por el trigger). Se valida antes de gastar correlativo/subir foto.
  const accSettings = await getAccountingSettings(supabase);
  if (isPeriodClosed(accSettings.closing_date, new Date().toISOString())) {
    return {
      error: `Período contable cerrado al ${accSettings.closing_date}: no puedes cargar gastos en un período cerrado.`,
    };
  }

  // Validar recibo ANTES de gastar correlativo
  const receiptRaw = formData.get("receipt");
  let receiptFile: File | null = null;
  if (receiptRaw && receiptRaw instanceof File && receiptRaw.size > 0) {
    if (!RECEIPT_ALLOWED_MIME.has(receiptRaw.type)) {
      return { fieldErrors: { receipt: "Formato inválido (JPG/PNG/WebP/HEIC)." } };
    }
    if (receiptRaw.size > RECEIPT_MAX_BYTES) {
      return { fieldErrors: { receipt: "Foto demasiado pesada (máx 5 MB)." } };
    }
    receiptFile = receiptRaw;
  }

  const { data: codeRaw, error: codeErr } = await supabase.rpc(
    "next_expense_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeRaw) {
    return { errorCode: "internal_error", error: codeErr?.message };
  }
  const expenseCode = String(codeRaw);

  let receiptPath: string | null = null;
  if (receiptFile) {
    const ext = extFromMime(receiptFile.type);
    const path = `${link.tenant_id}/${userResp.user.id}/${expenseCode}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, receiptFile, { contentType: receiptFile.type, upsert: true });
    if (uploadErr) return { errorCode: "internal_error", error: uploadErr.message };
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
      category: input!.category,
      scope: input!.scope,
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
    if (receiptPath) await supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath]);
    return { errorCode: "internal_error", error: insertErr?.message };
  }

  // Asiento automático del gasto (best-effort) — DR cuenta de gasto / CR
  // caja-banco según el método. No bloquea la carga si algo falla (SDD-0079).
  await syncExpenseEntry({
    tenantId: link.tenant_id,
    expenseId: insertedExp.id,
    expenseCode,
    accountId,
    amountUsd: input!.amount_usd,
    method: input!.method,
    entryDate: String(insertedExp.occurred_at).slice(0, 10),
  });

  // Registrar el fx usado en el historial del tenant (prefill futuro).
  const pair = currencyPair(input!.currency);
  if (pair && input!.fx_rate > 0) {
    await supabase.from("tenant_fx_history").insert({
      tenant_id: link.tenant_id,
      currency_pair: pair,
      rate: input!.fx_rate,
      set_by: userResp.user.id,
    });
  }

  // Auto-cerrar la alerta del contenedor: la contadora cargó un gasto del
  // shipment → su parte está hecha (SDD-0039 B.8, cierre 'auto'). Side-effect
  // de sistema → admin client.
  if (input!.scope === "shipment" && input!.shipment_id) {
    await autoResolveAlertForShipment(createAdminClient(), input!.shipment_id);
    revalidatePath("/studio/cn");
  }

  revalidatePath("/studio/gastos");
  return { ok: true, expenseCode };
}

export async function updateExpenseAction(
  id: string,
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  const { input, fieldErrors } = validateExpenseInput(parseExpenseForm(formData));
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };

  // Re-imputar la cuenta del plan (la categoría pudo cambiar al editar · SDD-0077).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const accountId = link?.tenant_id
    ? await resolveExpenseAccountId(supabase, link.tenant_id, input!.category)
    : null;

  // Estado contable previo (para re-sincronizar el asiento solo si cambió algo
  // relevante: monto, cuenta o método · SDD-0079).
  const { data: oldExp } = await supabase
    .from("expenses")
    .select("expense_code, amount_usd, account_id, method, occurred_at")
    .eq("id", id)
    .maybeSingle<{
      expense_code: string;
      amount_usd: number;
      account_id: string | null;
      method: ExpenseMethod;
      occurred_at: string;
    }>();

  // Guard de período cerrado (SDD-0080): no editar un gasto de período cerrado.
  if (oldExp) {
    const accSettings = await getAccountingSettings(supabase);
    if (isPeriodClosed(accSettings.closing_date, oldExp.occurred_at)) {
      return {
        error: `Período contable cerrado al ${accSettings.closing_date}: no puedes editar un gasto de período cerrado.`,
      };
    }
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      amount: input!.amount,
      currency: input!.currency,
      amount_usd: input!.amount_usd,
      fx_rate: input!.fx_rate,
      category: input!.category,
      scope: input!.scope,
      method: input!.method,
      shipment_id: input!.shipment_id,
      note: input!.note,
      location: input!.location,
      billable: input!.billable,
      account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { errorCode: "internal_error", error: error.message };

  // Re-sincronizar el asiento si cambió monto, cuenta o método (anula + repostea).
  if (link?.tenant_id && oldExp) {
    const changed =
      (oldExp.account_id ?? null) !== (accountId ?? null) ||
      Number(oldExp.amount_usd) !== Number(input!.amount_usd) ||
      oldExp.method !== input!.method;
    if (changed) {
      await voidExpenseEntriesForExpense(link.tenant_id, id);
      await syncExpenseEntry({
        tenantId: link.tenant_id,
        expenseId: id,
        expenseCode: oldExp.expense_code,
        accountId,
        amountUsd: input!.amount_usd,
        method: input!.method,
        entryDate: String(oldExp.occurred_at).slice(0, 10),
      });
    }
  }

  revalidatePath("/studio/gastos");
  return { ok: true };
}

export async function softDeleteExpenseAction(
  id: string,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  // Tenant + fecha del gasto (para anular su asiento y guardar el período · SDD-0079/0080).
  const { data: exp } = await supabase
    .from("expenses")
    .select("tenant_id, occurred_at")
    .eq("id", id)
    .maybeSingle<{ tenant_id: string; occurred_at: string }>();

  // Guard de período cerrado (SDD-0080): no borrar un gasto de período cerrado.
  if (exp?.occurred_at) {
    const accSettings = await getAccountingSettings(supabase);
    if (isPeriodClosed(accSettings.closing_date, exp.occurred_at)) {
      return {
        error: `Período contable cerrado al ${accSettings.closing_date}: no puedes borrar un gasto de período cerrado.`,
      };
    }
  }

  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { errorCode: "internal_error", error: error.message };
  // Anular el asiento del gasto (best-effort).
  if (exp?.tenant_id) await voidExpenseEntriesForExpense(exp.tenant_id, id);
  revalidatePath("/studio/gastos");
  return { ok: true };
}

/**
 * Cierre manual de una alerta de consolidado (contadora/admin · "ya cargué
 * todos los gastos de este contenedor"). RLS valida que el user puede.
 */
export async function resolveExpenseAlertAction(
  alertId: string,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  const res = await resolveAlertManual(supabase, alertId, userResp.user.id);
  if (res.error) return { errorCode: "internal_error", error: res.error };

  revalidatePath("/studio/gastos");
  revalidatePath("/studio/cn");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Export CSV del mes (loop de la contadora · SDD-0039 B.4)
// ─────────────────────────────────────────────────────────────

type ExportResult = {
  ok?: boolean;
  filename?: string;
  csv?: string;
  errorCode?: import("@/lib/i18n").ErrorCode;
  error?: string;
};

function csvCell(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Export de todos los gastos del mes (ambos scopes) a CSV (UTF-8 BOM para
 * Excel/contabilidad). Columnas estables para importar en software contable.
 * Las URLs de recibo se firman server-side (no se exponen en la página).
 *
 * Privacidad: el export NO incluye nombres de cliente — los gastos se
 * identifican por código de contenedor (shipment_code), nunca por importador.
 */
export async function exportExpensesCsvAction(
  month?: string,
): Promise<ExportResult> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  // locale para los labels legibles (categoría / método)
  const [{ data: prof }, { data: ut }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("locale")
      .eq("user_id", userResp.user.id)
      .maybeSingle<{ locale: string | null }>(),
    supabase
      .from("user_tenants")
      .select("region")
      .eq("user_id", userResp.user.id)
      .maybeSingle<{ region: string | null }>(),
  ]);
  const { locale } = await resolveLocale({
    userProfileLocale: prof?.locale ?? null,
    userTenantRegion: ut?.region ?? null,
  });

  let rows;
  try {
    rows = await listMonthExpensesForExport(supabase, month);
  } catch (e) {
    return {
      errorCode: "internal_error",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // URLs de recibo firmadas 24h (la contadora descarga el CSV y lo reenvía).
  const signed = await signReceiptUrls(supabase, rows, 24 * 60 * 60);

  const headers = [
    "expense_code", "date", "scope", "container", "category", "note",
    "location", "amount", "currency", "fx_rate", "amount_usd", "method",
    "billable", "receipt_url",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.expense_code),
        csvCell(r.occurred_at.slice(0, 10)),
        csvCell(r.scope),
        csvCell(r.shipment_code),
        csvCell(categoryLabel(r.category, locale)),
        csvCell(r.note),
        csvCell(r.location),
        csvCell(r.amount),
        csvCell(r.currency),
        csvCell(r.fx_rate),
        csvCell(r.amount_usd),
        csvCell(t(locale, METHOD_LABEL_KEYS[r.method])),
        csvCell(r.billable ? "yes" : "no"),
        csvCell(r.receipt_path ? signed[r.receipt_path] ?? "" : ""),
      ].join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n");
  const monthLabel = month ?? new Date().toISOString().slice(0, 7);
  return { ok: true, filename: `gastos-${monthLabel}.csv`, csv };
}
