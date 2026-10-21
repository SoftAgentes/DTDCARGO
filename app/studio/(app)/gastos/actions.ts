"use server";

/**
 * Server actions del módulo Gastos web (SDD-0039).
 *
 * El módulo web lo usa el equipo CN (warehouse/operations/accounting) +
 * accounting VE. RLS (policies expenses_cn_team / expenses_ve_accounting
 * de 0074) decide qué ve/crea cada rol. Auth normal (auth.uid()).
 *
 * Diferencia vs mobile m/erp: maneja scope (shipment/external) + moneda
 * dual (amount_usd + fx_rate); desde la SDD-0569 ya no escribe tenant_fx_history. Reusa next_expense_code
 * RPC + bucket expense-receipts.
 */

import { revalidatePath } from "next/cache";
import { fechaCaracas, isCalendarDate } from "@/lib/shared/fechas-caracas";
import { createClient } from "@/lib/db/server";
import { capabilityDenial, moduleEditDenial } from "@/lib/studio/rbac-guard";
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
  isPeriodClosed,
} from "@/lib/studio/accounting/period-queries";
import {
  validateExpenseInput,
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
import { attachmentsPilotState } from "@/lib/studio/attachments/pilot-gate";
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

type ExpenseOrigin = {
  id: string; tenant_id: string; deleted_at: null; expense_code: string;
  amount_usd: number; account_id: string | null; method: ExpenseMethod; occurred_at: string;
};
const HISTORY_UNAVAILABLE = "No pudimos comprobar el origen, el cierre o los asientos del gasto. No cambiamos el gasto ni su asiento. Reintenta o consulta a contabilidad. Código: GASTO-HISTORIA.";

/** Cero filas sólo es apertura tras lectura completa válida; un error no lo es. */
async function strictClosingDate(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string): Promise<string | null> {
  const { data, error } = await supabase.from("accounting_settings")
    .select("tenant_id, closing_date").eq("tenant_id", tenantId).limit(2);
  if (error || !Array.isArray(data) || data.length > 1) throw new Error(HISTORY_UNAVAILABLE);
  if (data.length === 0) return null;
  const row = data[0];
  if (!row || row.tenant_id !== tenantId || (row.closing_date !== null && !isCalendarDate(row.closing_date))) throw new Error(HISTORY_UNAVAILABLE);
  return row.closing_date;
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const occurredAt = new Date().toISOString();
  const businessDay = fechaCaracas(occurredAt);
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "expenses");
  if (denial) return { error: denial };

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
  let closingDate: string | null;
  try { closingDate = await strictClosingDate(supabase, link.tenant_id); }
  catch { return { error: HISTORY_UNAVAILABLE }; }
  if (isPeriodClosed(closingDate, businessDay)) {
    return {
      error: `Período contable cerrado al ${closingDate}: no puedes cargar gastos en un período cerrado.`,
    };
  }

  // Validar recibo ANTES de gastar correlativo
  const receiptRaw = attachmentsPilotState().enabled ? null : formData.get("receipt");
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
      occurred_at: occurredAt,
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
    entryDate: businessDay,
  });

  // SDD-0569: la tasa de un gasto queda en el gasto. Ya no se copia a
  // tenant_fx_history: mezclaba tasas operativas con la del admin, y las tasas
  // del tenant viven en fx_rates (Admin › Tasas).

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
  const denial = await moduleEditDenial(supabase, "expenses");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { errorCode: "auth_required" };

  const { input, fieldErrors } = validateExpenseInput(parseExpenseForm(formData));
  if (fieldErrors) return { fieldErrors, errorCode: "field_errors_present" };

  // Re-imputar la cuenta del plan (la categoría pudo cambiar al editar · SDD-0077).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { errorCode: "tenant_unresolved" };
  const tenantId = link.tenant_id;
  const accountId = await resolveExpenseAccountId(supabase, tenantId, input!.category);
  let oldExp: ExpenseOrigin;
  let entryDate: string;
  let changed: boolean;
  try {
    const { data: origins, error: originError } = await supabase.from("expenses")
      .select("id, tenant_id, deleted_at, expense_code, amount_usd, account_id, method, occurred_at")
      .eq("id", id).eq("tenant_id", tenantId).is("deleted_at", null).limit(2);
    if (originError || !Array.isArray(origins) || origins.length !== 1) return { error: HISTORY_UNAVAILABLE };
    const origin = origins[0];
    if (!origin || origin.id !== id || origin.tenant_id !== tenantId || origin.deleted_at !== null
      || typeof origin.expense_code !== "string"
      || (typeof origin.amount_usd !== "number" && typeof origin.amount_usd !== "string")
      || (typeof origin.amount_usd === "string" && origin.amount_usd.trim() === "")
      || !Number.isFinite(Number(origin.amount_usd))
      || (origin.account_id !== null && typeof origin.account_id !== "string")
      || !["cash", "card", "transfer", "usdt"].includes(origin.method)
      || typeof origin.occurred_at !== "string") return { error: HISTORY_UNAVAILABLE };
    oldExp = origin as ExpenseOrigin;
    entryDate = fechaCaracas(oldExp.occurred_at);
    const closingDate = await strictClosingDate(supabase, tenantId);
    if (isPeriodClosed(closingDate, entryDate)) {
      return { error: "Período contable cerrado al " + closingDate + ": no puedes editar un gasto de período cerrado." };
    }
    changed = (oldExp.account_id ?? null) !== (accountId ?? null)
      || Number(oldExp.amount_usd) !== Number(input!.amount_usd) || oldExp.method !== input!.method;
    if (changed) {
      const { data: entries, error: entriesError } = await supabase.from("journal_entries")
        .select("id, tenant_id, expense_id, source, entry_date, status, deleted_at")
        .eq("tenant_id", tenantId).eq("expense_id", id).eq("status", "asentado").is("deleted_at", null).limit(2);
      if (entriesError || !Array.isArray(entries) || entries.length > 1) return { error: HISTORY_UNAVAILABLE };
      const live = entries[0];
      if (live) {
        if (typeof live.id !== "string" || !live.id || live.tenant_id !== tenantId || live.expense_id !== id
          || live.source !== "expense" || live.status !== "asentado" || live.deleted_at !== null
          || !isCalendarDate(live.entry_date)) return { error: HISTORY_UNAVAILABLE };
        if (isPeriodClosed(closingDate, live.entry_date)) {
          return { error: "El asiento del gasto pertenece a un período cerrado al " + closingDate + ". No cambiamos el gasto ni su asiento." };
        }
        if (live.entry_date !== entryDate) {
          return { error: "La edición cambiaría la fecha contable histórica de " + live.entry_date + " a " + entryDate + ". No cambiamos el gasto ni su asiento. Solicita la corrección por la vía gobernada de contabilidad." };
        }
      }
    }
  } catch { return { error: HISTORY_UNAVAILABLE }; }

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
    .eq("id", id).eq("tenant_id", tenantId).is("deleted_at", null);

  if (error) return { errorCode: "internal_error", error: error.message };

  // Re-sincronizar el asiento si cambió monto, cuenta o método (anula + repostea).
  if (link?.tenant_id && oldExp) {
    if (changed) {
      await voidExpenseEntriesForExpense(link.tenant_id, id);
      await syncExpenseEntry({
        tenantId: link.tenant_id,
        expenseId: id,
        expenseCode: oldExp.expense_code,
        accountId,
        amountUsd: input!.amount_usd,
        method: input!.method,
        entryDate,
      });
    }
  }

  revalidatePath("/studio/gastos");
  return { ok: true };
}

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
    revalidatePath("/studio/gastos");
    revalidatePath("/m/erp");
    return { ok: true, outcome };
  } catch (error) {
    return { error: expenseVoidErrorMessage(error, parsed.input.requestRef) };
  }
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
  const exportMonth = month ?? fechaCaracas().slice(0, 7);
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
    rows = await listMonthExpensesForExport(supabase, exportMonth);
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
        csvCell(fechaCaracas(r.occurred_at)),
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
  return { ok: true, filename: `gastos-${exportMonth}.csv`, csv };
}
