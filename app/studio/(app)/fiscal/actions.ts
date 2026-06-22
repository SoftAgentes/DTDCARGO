/**
 * Server actions del módulo Fiscal/SENIAT (SDD-0073).
 *
 * Única mutación V1: guardar la configuración fiscal del tenant (singleton).
 * Patrón Studio: "use server" + useActionState + parsing manual de FormData +
 * validateFiscalSettingsInput() (sin Zod) + revalidatePath. Upsert lazy: si la
 * row no existe, la crea; si existe, la actualiza.
 *
 * Admin-only: aunque la RLS de 0126 ya restringe write a admin del tenant,
 * verificamos el rol en la action para devolver un error amable (no un 403 de
 * PostgREST). tenant_id + updated_by son server-controlled (no vienen del form).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { canEditModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";
import {
  isFiscalModuleEnabled,
  validateFiscalSettingsInput,
  type FiscalSettingsActionState,
  type FiscalSettingsInput,
} from "@/lib/studio/fiscal/config-types";
import { getFiscalSettings, purchaseBook, salesBook } from "@/lib/studio/fiscal/queries";
import {
  isValidBookPeriod,
  isValidBookType,
  purchaseRowToEntry,
  salesRowToEntry,
  type FiscalBookEntryPayload,
  type PostedBookType,
} from "@/lib/studio/fiscal/books-types";
import {
  computeWithholdingAmount,
  validateWithholdingInput,
  type WithholdingActionState,
  type WithholdingInput,
} from "@/lib/studio/fiscal/withholding-types";

function parseNumber(v: FormDataEntryValue | null): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(formData: FormData, key: string): boolean {
  // El form manda un hidden "0" + (si está ON) un checkbox "1" con el mismo
  // name → getAll captura ambos y nos quedamos con el último presente. Así un
  // checkbox desmarcado llega como false sin ambigüedad.
  const all = formData.getAll(key).map((v) => String(v));
  if (all.length === 0) return false;
  const last = all[all.length - 1];
  return last === "1" || last === "true" || last === "on";
}

function parseStrOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function inputFromFormData(formData: FormData): Partial<FiscalSettingsInput> {
  const defMode = String(formData.get("default_invoice_iva_mode") ?? "");
  const mode = String(formData.get("purchase_iva_mode") ?? "");
  const period = String(formData.get("declaration_period") ?? "");
  return {
    // A · master
    fiscal_module_enabled: parseBool(formData, "fiscal_module_enabled"),
    // B · SPE
    is_special_taxpayer: parseBool(formData, "is_special_taxpayer"),
    // C · alícuotas
    iva_rate_general: parseNumber(formData.get("iva_rate_general")),
    iva_rate_reduced: parseNumber(formData.get("iva_rate_reduced")),
    iva_rate_export: parseNumber(formData.get("iva_rate_export")),
    iva_rate_luxury_surcharge: parseNumber(
      formData.get("iva_rate_luxury_surcharge"),
    ),
    // D · default factura
    default_invoice_iva_mode: (defMode ||
      undefined) as FiscalSettingsInput["default_invoice_iva_mode"],
    // E · IGTF
    igtf_enabled: parseBool(formData, "igtf_enabled"),
    igtf_rate_fx: parseNumber(formData.get("igtf_rate_fx")),
    igtf_is_perception_agent: parseBool(formData, "igtf_is_perception_agent"),
    // F · retención
    iva_withholding_agent: parseBool(formData, "iva_withholding_agent"),
    iva_withholding_pct: parseNumber(formData.get("iva_withholding_pct")),
    // G · facturación digital
    digital_invoicing_enabled: parseBool(formData, "digital_invoicing_enabled"),
    homologated_provider: parseStrOrNull(formData.get("homologated_provider")),
    // H · período + compras
    declaration_period: (period ||
      undefined) as FiscalSettingsInput["declaration_period"],
    purchase_iva_mode: (mode ||
      undefined) as FiscalSettingsInput["purchase_iva_mode"],
  };
}

const ADMIN_ONLY_MSG =
  "Solo los administradores pueden editar la configuración fiscal.";

export async function saveFiscalSettingsAction(
  _prev: FiscalSettingsActionState,
  formData: FormData,
): Promise<FiscalSettingsActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateFiscalSettingsInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver usuario + tenant + rol. Filtramos user_tenants por user_id: tras
  // la migración 0040 ese listado expone a TODOS los miembros del tenant, así
  // que un maybeSingle() sin filtro rompería con >1 usuario.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Sesión no válida." };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  if (link.role !== "admin") return { error: ADMIN_ONLY_MSG };

  const row = {
    tenant_id: link.tenant_id,
    fiscal_module_enabled: input!.fiscal_module_enabled,
    is_special_taxpayer: input!.is_special_taxpayer,
    iva_rate_general: input!.iva_rate_general,
    iva_rate_reduced: input!.iva_rate_reduced,
    iva_rate_export: input!.iva_rate_export,
    iva_rate_luxury_surcharge: input!.iva_rate_luxury_surcharge,
    default_invoice_iva_mode: input!.default_invoice_iva_mode,
    igtf_enabled: input!.igtf_enabled,
    igtf_rate_fx: input!.igtf_rate_fx,
    igtf_is_perception_agent: input!.igtf_is_perception_agent,
    iva_withholding_agent: input!.iva_withholding_agent,
    iva_withholding_pct: input!.iva_withholding_pct,
    digital_invoicing_enabled: input!.digital_invoicing_enabled,
    homologated_provider: input!.homologated_provider,
    declaration_period: input!.declaration_period,
    purchase_iva_mode: input!.purchase_iva_mode,
    updated_by: userId,
  };

  const { error } = await supabase
    .from("fiscal_settings")
    .upsert(row, { onConflict: "tenant_id" });

  if (error) {
    // No exponemos el mensaje crudo de Postgres/PostgREST al usuario (puede
    // revelar nombres de constraint/estructura); lo logueamos server-side.
    console.error("[fiscal] saveFiscalSettings upsert error:", error);
    return {
      error:
        "No se pudo guardar la configuración fiscal. Revisa los valores e intenta de nuevo.",
    };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// SDD-0104 · Libros asentados + Retenciones
//
// Gate de poderes DUPLICADO (action + DB): el founder lo exige para dinero
// (PostgREST evade la action). Acá devolvemos un error amable; la RLS/RPC de
// 0165/0166 vuelven a gatear rol accounting/admin dentro de la DB.
// ═══════════════════════════════════════════════════════════════

const FISCAL_DENY_MSG =
  "Solo Contabilidad puede asentar libros o registrar retenciones.";
const MODULE_OFF_MSG =
  "El módulo Fiscal/SENIAT está desactivado. Actívalo en Configuración para usar esta función.";

/**
 * Resuelve usuario→tenant→rol con el cliente del usuario (RLS). Devuelve el
 * gate listo: si `denied`, la action corta con ese mensaje. Filtra user_tenants
 * por user_id (post-0040 ese listado expone a todos los miembros → maybeSingle
 * sin filtro rompería con >1 usuario).
 */
async function resolveFiscalGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ tenantId: string; userId: string } | { denied: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { denied: "Sesión no válida." };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string; role: StudioUserRole }>();
  if (linkErr || !link?.tenant_id) {
    return { denied: "No se pudo resolver el tenant del usuario." };
  }
  if (!canEditModule(link.role, "fiscal")) return { denied: FISCAL_DENY_MSG };

  return { tenantId: link.tenant_id, userId };
}

/**
 * Asienta un libro (Ventas/Compras): clasifica el período vivo con los helpers
 * de 0073, arma las líneas y llama la RPC atómica `fiscal_post_book`. La RPC
 * recalcula los totales desde las líneas. Idempotente: el índice único parcial
 * de 0165 revienta 23505 si ya hay un asiento vigente → mensaje amable.
 */
export async function postFiscalBookAction(
  period: string,
  bookType: PostedBookType,
): Promise<{ ok?: boolean; error?: string; bookId?: string }> {
  if (!isValidBookPeriod(period)) return { error: "Período inválido." };
  if (!isValidBookType(bookType)) return { error: "Tipo de libro inválido." };

  const supabase = await createClient();
  const gate = await resolveFiscalGate(supabase);
  if ("denied" in gate) return { error: gate.denied };

  const settings = await getFiscalSettings(supabase);
  if (!isFiscalModuleEnabled(settings)) return { error: MODULE_OFF_MSG };

  // Clasifica el período VIVO (misma lógica que el preview) → líneas congeladas.
  let entries: FiscalBookEntryPayload[];
  if (bookType === "ventas") {
    const book = await salesBook(supabase, period, settings);
    entries = book.rows.map((r, i) => salesRowToEntry(r, i + 1));
  } else {
    const book = await purchaseBook(supabase, period, settings);
    entries = book.rows.map((r, i) => purchaseRowToEntry(r, i + 1));
  }

  const { data, error } = await supabase.rpc("fiscal_post_book", {
    p_period: period,
    p_book_type: bookType,
    p_entries: entries,
    p_default_iva_mode: settings.default_invoice_iva_mode,
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return {
        error:
          "Este período ya está asentado. Anula el asiento vigente para volver a asentarlo.",
      };
    }
    console.error("[fiscal] postFiscalBook rpc error:", error);
    return {
      error: "No se pudo asentar el período. Revisa los datos e intenta de nuevo.",
    };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true, bookId: (data as string | null) ?? undefined };
}

/**
 * Anula el asiento vigente de un libro. La RLS (accounting/admin) + el trigger
 * `fiscal_books_guard` de 0165 gatean el rol y la transición asentado→anulado;
 * voided_at/voided_by los sella el trigger. Tras anular se puede re-asentar.
 */
export async function voidFiscalBookAction(
  bookId: string,
  reason?: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!bookId) return { error: "Falta el identificador del asiento." };

  const supabase = await createClient();
  const gate = await resolveFiscalGate(supabase);
  if ("denied" in gate) return { error: gate.denied };

  const cleanReason = reason?.trim() ? reason.trim() : null;
  const { error } = await supabase
    .from("fiscal_books")
    .update({ status: "anulado", void_reason: cleanReason })
    .eq("id", bookId);

  if (error) {
    console.error("[fiscal] voidFiscalBook update error:", error);
    return { error: "No se pudo anular el asiento. Intenta de nuevo." };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}

// ── Retenciones ────────────────────────────────────────────────

function inputFromWithholdingForm(
  formData: FormData,
): Partial<WithholdingInput> {
  const type = String(formData.get("withholding_type") ?? "");
  return {
    withholdingType: (type || undefined) as WithholdingInput["withholdingType"],
    voucherNumber: parseStrOrNull(formData.get("voucher_number")) ?? "",
    period: String(formData.get("period") ?? ""),
    opDate: String(formData.get("op_date") ?? ""),
    supplierId: parseStrOrNull(formData.get("supplier_id")),
    supplierName: parseStrOrNull(formData.get("supplier_name")) ?? "",
    rif: parseStrOrNull(formData.get("rif")),
    sourceBillId: parseStrOrNull(formData.get("source_bill_id")),
    sourceDoc: parseStrOrNull(formData.get("source_doc")),
    base: parseNumber(formData.get("base")),
    pct: parseNumber(formData.get("pct")),
    // amount llega del form pero NO se confía: se recalcula server-side.
    amount: parseNumber(formData.get("amount")),
    currency: parseStrOrNull(formData.get("currency")) ?? "USD",
    notes: parseStrOrNull(formData.get("notes")),
  };
}

/**
 * Crea un comprobante de retención. Valida + RECALCULA el monto server-side (no
 * confía en el amount del form) y persiste. tenant_id + created_by son
 * server-controlled. La RLS de 0166 gatea rol accounting/admin (gate en DB);
 * 23505 = comprobante vigente duplicado → mensaje amable.
 */
export async function createWithholdingAction(
  _prev: WithholdingActionState,
  formData: FormData,
): Promise<WithholdingActionState> {
  const partial = inputFromWithholdingForm(formData);
  // Recalcular el monto desde base/pct ANTES de validar (no confiar en el form).
  if (
    partial.base != null &&
    partial.pct != null &&
    Number.isFinite(partial.base) &&
    Number.isFinite(partial.pct)
  ) {
    partial.amount = computeWithholdingAmount(partial.base, partial.pct);
  }

  const { input, fieldErrors } = validateWithholdingInput(partial);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const gate = await resolveFiscalGate(supabase);
  if ("denied" in gate) return { error: gate.denied };

  const settings = await getFiscalSettings(supabase);
  if (!isFiscalModuleEnabled(settings)) return { error: MODULE_OFF_MSG };

  const row = {
    tenant_id: gate.tenantId,
    withholding_type: input!.withholdingType,
    voucher_number: input!.voucherNumber,
    period: input!.period,
    op_date: input!.opDate,
    supplier_id: input!.supplierId,
    supplier_name: input!.supplierName,
    rif: input!.rif,
    source_bill_id: input!.sourceBillId,
    source_doc: input!.sourceDoc,
    base: input!.base,
    pct: input!.pct,
    amount: input!.amount,
    currency: input!.currency,
    notes: input!.notes,
    created_by: gate.userId,
  };

  const { error } = await supabase.from("tax_withholdings").insert(row);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Ya existe un comprobante vigente con ese número." };
    }
    console.error("[fiscal] createWithholding insert error:", error);
    return {
      error:
        "No se pudo registrar el comprobante. Revisa los valores e intenta de nuevo.",
    };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}

/**
 * Anula un comprobante de retención (queda en historial, tachado). La RLS de
 * 0166 gatea rol accounting/admin; el trigger sella voided_at/voided_by.
 */
export async function voidWithholdingAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (!id) return { error: "Falta el identificador del comprobante." };

  const supabase = await createClient();
  const gate = await resolveFiscalGate(supabase);
  if ("denied" in gate) return { error: gate.denied };

  const { error } = await supabase
    .from("tax_withholdings")
    .update({ status: "anulado" })
    .eq("id", id);

  if (error) {
    console.error("[fiscal] voidWithholding update error:", error);
    return { error: "No se pudo anular el comprobante. Intenta de nuevo." };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}
