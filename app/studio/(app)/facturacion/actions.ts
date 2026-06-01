/**
 * Server actions del módulo Facturación (SDD-0021).
 *
 * State machine:
 *   borrador → emitida → parcial → pagada
 *           ↘ anulada (no si pagada)   · vencida se deriva visual
 *
 * - createInvoice: autogenera invoice_code via rpc + insert como borrador
 *   (o emitida si se marca "emitir al crear"); recalcula base/iva/total server-side
 * - updateInvoice: edit (solo si status=borrador)
 * - emitInvoice: borrador → emitida + issued_at/due_date
 * - registerPayment: paid_amount += amount; recalcula status (parcial/pagada)
 * - voidInvoice: → anulada (no si pagada)
 * - softDeleteInvoice: deleted_at = now()
 * - lookupShipmentForInvoice: prefill del drawer desde un código de embarque
 *
 * Las acciones sensibles (emit, pago, anular) escriben en entity_audit_log
 * con actor_type='user' via el admin client (service_role) — entity_type
 * 'invoice' habilitado en la migración 0077.
 *
 * GANCHO CONTABLE: emitInvoice (y createInvoice con emit_on_create) crean el
 * asiento automático de venta vía SDD-0040 Contabilidad
 * (DR 1.1.2 Clientes / CR 4.5 Ingresos [+ CR 2.1.5 IVA]). registerPayment NO
 * toca contabilidad (el asiento del cobro vive en Cobranzas/Tesorería, Bloque 2).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { postInvoiceJournalEntry } from "@/lib/studio/accounting/invoice-posting";
import {
  calcInvoiceTotals,
  computeBalance,
  IVA_RATE_DEFAULT,
  normalizeLines,
  validateInvoiceInput,
  type InvoiceActionState,
  type InvoiceCurrency,
  type InvoiceInput,
  type InvoiceLine,
} from "@/lib/studio/invoice-types";

const VALID_CURRENCIES: InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseLines(formData: FormData): InvoiceLine[] {
  const raw = formData.get("lines");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

function inputFromFormData(formData: FormData): Partial<InvoiceInput> {
  const currencyRaw = String(formData.get("currency") ?? "USD");
  const currency = (VALID_CURRENCIES as string[]).includes(currencyRaw)
    ? (currencyRaw as InvoiceCurrency)
    : "USD";

  return {
    client_markbox: parseStringOrNull(formData.get("client_markbox")) ?? undefined,
    client_name: parseStringOrNull(formData.get("client_name")) ?? undefined,
    shipment_id: parseStringOrNull(formData.get("shipment_id")),
    shipment_code: parseStringOrNull(formData.get("shipment_code")),
    currency,
    fx_rate: parseNumberOrNull(formData.get("fx_rate")),
    due_date: parseStringOrNull(formData.get("due_date")),
    lines: parseLines(formData),
    notes: parseStringOrNull(formData.get("notes")),
  };
}

/** Resuelve el tenant del usuario logueado (RLS). */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ tenantId?: string; error?: string }> {
  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  return { tenantId: link.tenant_id };
}

/** Lee el flag iva_enabled del tenant (fuente de verdad del toggle fiscal). */
async function tenantIvaOn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("tenants")
    .select("iva_enabled")
    .eq("id", tenantId)
    .maybeSingle<{ iva_enabled: boolean }>();
  return data?.iva_enabled ?? false;
}

/** Best-effort audit log con actor_type='user'. No bloquea la mutación. */
async function auditInvoice(
  tenantId: string,
  invoiceId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("entity_audit_log").insert({
      tenant_id: tenantId,
      entity_type: "invoice",
      entity_id: invoiceId,
      actor_type: "user",
      actor_id: actorId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.error("[auditInvoice] no se pudo registrar audit:", e);
  }
}

/**
 * Dispara el asiento automático de venta (SDD-0040). Best-effort: nunca rompe
 * la emisión (la factura ya se persistió). Logea el resultado para diagnóstico.
 */
async function postInvoiceJournalEntryForInvoice(
  input: Parameters<typeof postInvoiceJournalEntry>[0],
): Promise<void> {
  try {
    const r = await postInvoiceJournalEntry(input);
    if (!r.ok) {
      console.error(
        `[contabilidad] asiento de factura ${input.invoiceCode} no creado:`,
        r.skipped ?? r.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar factura ${input.invoiceCode}:`,
      e,
    );
  }
}

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createInvoice(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateInvoiceInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const ivaOn = await tenantIvaOn(supabase, tenantId);
  const ivaRate = ivaOn ? IVA_RATE_DEFAULT : 0;
  const totals = calcInvoiceTotals({ lines: input!.lines, ivaRate, ivaOn });

  // Generar invoice_code atómico
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_invoice_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de factura." };
  }
  const invoice_code = String(codeData);

  const emitNow = String(formData.get("emit_on_create") ?? "") === "true";
  const today = new Date().toISOString().slice(0, 10);

  const { data: inserted, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      invoice_code,
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      shipment_id: input!.shipment_id,
      shipment_code: input!.shipment_code,
      currency: input!.currency,
      fx_rate: input!.fx_rate,
      iva_rate: ivaRate,
      base_amount: totals.base,
      iva_amount: totals.iva,
      total_amount: totals.total,
      lines: input!.lines,
      notes: input!.notes,
      status: emitNow ? "emitida" : "borrador",
      issued_at: emitNow ? today : null,
      due_date: input!.due_date ?? (emitNow ? addDaysISO(today, 30) : null),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: `No se pudo crear la factura: ${error?.message}` };
  }

  if (emitNow) {
    // SDD-0040: asiento automático de venta al emitir (también al crear-y-emitir).
    await postInvoiceJournalEntryForInvoice({
      tenantId,
      invoiceId: inserted.id,
      invoiceCode: invoice_code,
      baseAmount: totals.base,
      ivaAmount: totals.iva,
      totalAmount: totals.total,
      entryDate: today,
    });
    await auditInvoice(
      tenantId,
      inserted.id,
      await currentUserId(supabase),
      "issued",
      { invoice_code, total_amount: totals.total, on_create: true },
    );
  }

  revalidatePath("/studio/facturacion");
  return { ok: true, createdCode: invoice_code };
}

export async function updateInvoice(
  id: string,
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("status, invoice_code, tenant_id")
    .eq("id", id)
    .maybeSingle<{ status: string; invoice_code: string; tenant_id: string }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status !== "borrador") {
    return { error: "Solo las facturas en borrador pueden editarse." };
  }

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateInvoiceInput(partial);
  if (fieldErrors) return { fieldErrors };

  const ivaOn = await tenantIvaOn(supabase, current.tenant_id);
  const ivaRate = ivaOn ? IVA_RATE_DEFAULT : 0;
  const totals = calcInvoiceTotals({ lines: input!.lines, ivaRate, ivaOn });

  const { error } = await supabase
    .from("invoices")
    .update({
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      shipment_id: input!.shipment_id,
      shipment_code: input!.shipment_code,
      currency: input!.currency,
      fx_rate: input!.fx_rate,
      iva_rate: ivaRate,
      base_amount: totals.base,
      iva_amount: totals.iva,
      total_amount: totals.total,
      lines: input!.lines,
      notes: input!.notes,
      due_date: input!.due_date,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

export async function emitInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, status, invoice_code, due_date, base_amount, iva_amount, total_amount",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
      due_date: string | null;
      base_amount: number;
      iva_amount: number;
      total_amount: number;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status !== "borrador") {
    return { error: "Solo las facturas en borrador pueden emitirse." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "emitida",
      issued_at: today,
      due_date: current.due_date ?? addDaysISO(today, 30),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // SDD-0040: asiento automático de venta (DR Clientes / CR Ingresos [+ IVA]).
  // Best-effort: si la contabilidad falla, la factura se emite igual.
  await postInvoiceJournalEntryForInvoice({
    tenantId: current.tenant_id,
    invoiceId: current.id,
    invoiceCode: current.invoice_code,
    baseAmount: Number(current.base_amount),
    ivaAmount: Number(current.iva_amount),
    totalAmount: Number(current.total_amount),
    entryDate: today,
  });

  await auditInvoice(
    current.tenant_id,
    current.id,
    await currentUserId(supabase),
    "issued",
    { invoice_code: current.invoice_code, total_amount: current.total_amount },
  );

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

export async function registerPayment(
  id: string,
  amount: number,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { error: "El monto del pago debe ser mayor a cero." };
  }

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, status, invoice_code, total_amount, paid_amount",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
      total_amount: number;
      paid_amount: number;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };

  if (
    current.status !== "emitida" &&
    current.status !== "parcial" &&
    current.status !== "vencida"
  ) {
    return {
      error: "Solo se pueden registrar pagos en facturas emitidas o parciales.",
    };
  }

  const balance = computeBalance(current);
  if (amt > balance + 1e-6) {
    return {
      error: `El pago ($${amt.toFixed(2)}) no puede superar el saldo ($${balance.toFixed(2)}).`,
    };
  }

  const newPaid = Math.round((current.paid_amount + amt + Number.EPSILON) * 100) / 100;
  const fullyPaid = newPaid >= Number(current.total_amount) - 1e-6;
  const newStatus = fullyPaid ? "pagada" : "parcial";

  const { error } = await supabase
    .from("invoices")
    .update({
      paid_amount: newPaid,
      status: newStatus,
      last_payment_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // TODO(SDD-contabilidad): asiento de cobro al registrar el pago.
  // TODO(SDD-cobranzas): ledger de pagos (quién, método, recibo).
  await auditInvoice(
    current.tenant_id,
    current.id,
    await currentUserId(supabase),
    "payment_registered",
    {
      invoice_code: current.invoice_code,
      amount: amt,
      paid_total: newPaid,
      new_status: newStatus,
    },
  );

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

export async function voidInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // TODO(permisos): anular debería ser admin/contabilidad (matriz de roles
  // transversal, SDD aparte). Por ahora cualquier rol con acceso al módulo.
  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("id, tenant_id, status, invoice_code")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status === "pagada") {
    return { error: "No se puede anular una factura ya pagada." };
  }
  if (current.status === "anulada") {
    return { error: "Esta factura ya está anulada." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "anulada" })
    .eq("id", id);

  if (error) return { error: error.message };

  await auditInvoice(
    current.tenant_id,
    current.id,
    await currentUserId(supabase),
    "voided",
    { invoice_code: current.invoice_code },
  );

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

export async function softDeleteInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/studio/facturacion");
  return { ok: true };
}

/**
 * Lookup helper para prefill del drawer desde un código de embarque.
 * Devuelve client + shipment_id si existe, o null. No bloquea (blando).
 */
export async function lookupShipmentForInvoice(code: string): Promise<{
  shipment: {
    id: string;
    code: string;
    client_name: string | null;
    client_markbox: string | null;
  } | null;
}> {
  const trimmed = code?.trim();
  if (!trimmed) return { shipment: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, client_name, client_markbox")
    .eq("code", trimmed)
    .maybeSingle();
  if (error || !data) return { shipment: null };
  return {
    shipment: data as {
      id: string;
      code: string;
      client_name: string | null;
      client_markbox: string | null;
    },
  };
}
