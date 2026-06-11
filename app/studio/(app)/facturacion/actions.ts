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
import { registerCollectionFor } from "@/lib/studio/collections-actions";
import { LEGAL_GATE_HARD_BLOCK } from "@/lib/studio/legal/gate-config";
import { hasValidAcceptanceForMarkbox } from "@/lib/studio/legal/queries";
import { type PaymentMethod } from "@/lib/studio/payment-types";
import {
  calcInvoiceTotals,
  IVA_RATE_DEFAULT,
  normalizeLines,
  validateInvoiceInput,
  type InvoiceActionState,
  type InvoiceCurrency,
  type InvoiceInput,
  type InvoiceLine,
} from "@/lib/studio/invoice-types";

const VALID_CURRENCIES: InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];

// FLAG del gate legal AUT-04 (advisory ⇄ bloqueo duro): vive en
// `lib/studio/legal/gate-config.ts` (SDD-0067 — /studio/legal muestra el modo).
// El flip del founder es 1 línea ALLÁ; acá solo se consume.

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

/**
 * Gate legal AUT-04 (SDD-0054 · Slice B) — modo ADVISORY.
 *
 * Decisión del founder ("advisory → duro al cerrar C"): el gate se cablea AHORA
 * pero AVISA, no bloquea. El productor de aceptaciones reales (Slice C) todavía
 * no existe; un bloqueo duro dejaría TODA factura DDP sin poder emitirse. Queda
 * listo para volverse bloqueo duro cuando Slice C produzca aceptaciones.
 *
 * Devuelve:
 *   · required       = la factura nace de un embarque DDP (puerta_a_puerta_DDP).
 *                      Si no hay shipment o no es DDP ⇒ false (no aplica el gate).
 *   · hasAcceptance  = (solo si required) hay una aceptación T&C vigente del
 *                      cliente que matchee la MEDIDA real del embarque + el total.
 *
 * El match va por MARKBOX + medida (cbm/weight del shipment) + total
 * (base_amount, pre-IVA) + la ORDEN puntual (`orderRef`), porque la factura no
 * enlaza al client_id ni al quote_code de la aceptación.
 *
 * M-1 (round-3): se pasa `orderRef = invoice.shipment_code` para atar el gate a
 * ESTA orden y no a cualquier factura del cliente con la misma terna. La action
 * de Slice C sella `quote_code = shipment_code`, así que el match es 1:1. Para
 * DDP el `shipment_code` SIEMPRE está poblado (la factura DDP siempre nace de un
 * shipment); si por alguna razón fuese null/vacío, NO se pasa orderRef y el gate
 * cae al comportamiento previo (match por terna) — no rompe la emisión existente.
 */
async function evaluateLegalGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    tenantId: string;
    shipmentId: string | null;
    shipmentCode: string | null;
    totalForMatch: number;
  },
): Promise<{ required: boolean; hasAcceptance: boolean }> {
  if (!args.shipmentId) return { required: false, hasAcceptance: false };

  const { data: shipment } = await supabase
    .from("shipments")
    .select("shipment_service, client_markbox, volume_m3, weight_kg")
    .eq("id", args.shipmentId)
    .maybeSingle<{
      shipment_service: string;
      client_markbox: string | null;
      volume_m3: number | null;
      weight_kg: number | null;
    }>();

  const required = shipment?.shipment_service === "puerta_a_puerta_DDP";
  if (!required) return { required: false, hasAcceptance: false };

  // orderRef = shipment_code de la factura (= quote_code que selló Slice C). Vacío
  // ⇒ no se ata a la orden (legacy). Para DDP siempre está poblado.
  const orderRef = String(args.shipmentCode ?? "").trim() || undefined;

  const hasAcceptance = await hasValidAcceptanceForMarkbox(supabase, {
    tenantId: args.tenantId,
    clientMarkbox: shipment?.client_markbox ?? "",
    cbm: Number(shipment?.volume_m3 ?? 0),
    weight: Number(shipment?.weight_kg ?? 0),
    total: args.totalForMatch,
    orderRef,
  });

  return { required: true, hasAcceptance };
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

  const emitNowRequested = String(formData.get("emit_on_create") ?? "") === "true";
  const today = new Date().toISOString().slice(0, 10);

  // Gate legal AUT-04 (SDD-0054). Se evalúa ANTES del insert para decidir si el
  // create-and-emit de un DDP puede realmente emitir.
  //   · ADVISORY (flag off, modo actual): create-and-emit NO tiene confirm inline
  //     → si es DDP sin aceptación, EMITE IGUAL y deja `legal_ack: "override"`.
  //   · BLOQUEO DURO (flag on, §3.1): un DDP sin aceptación NO se emite al crear →
  //     cae a BORRADOR (el cliente acepta por el Portal y luego se emite). Así el
  //     create-and-emit nunca puentea el gate cuando está en modo duro.
  const gate = emitNowRequested
    ? await evaluateLegalGate(supabase, {
        tenantId,
        shipmentId: input!.shipment_id,
        shipmentCode: input!.shipment_code,
        totalForMatch: totals.base,
      })
    : { required: false, hasAcceptance: false };
  const hardBlocked =
    emitNowRequested && LEGAL_GATE_HARD_BLOCK && gate.required && !gate.hasAcceptance;
  const emitNow = emitNowRequested && !hardBlocked;

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
    const legalAck = !gate.required
      ? "n/a"
      : gate.hasAcceptance
        ? "valid"
        : "override";

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
      {
        invoice_code,
        total_amount: totals.total,
        on_create: true,
        ...(gate.required ? { legal_ack: legalAck } : {}),
      },
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
  legalOverride?: boolean,
): Promise<{
  ok?: boolean;
  error?: string;
  needsLegalAck?: boolean;
  warning?: string;
}> {
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, status, invoice_code, shipment_id, shipment_code, due_date, base_amount, iva_amount, total_amount",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
      shipment_id: string | null;
      shipment_code: string | null;
      due_date: string | null;
      base_amount: number;
      iva_amount: number;
      total_amount: number;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status !== "borrador") {
    return { error: "Solo las facturas en borrador pueden emitirse." };
  }

  // Gate legal AUT-04 (SDD-0054 · Slice B) — ADVISORY. Si es un embarque DDP sin
  // aceptación T&C vigente, NO mutamos y devolvemos needsLegalAck: el detalle
  // muestra un banner y deja al operador emitir igual con override (queda en la
  // auditoría como `legal_ack: "override"`). El total a matchear = base_amount
  // (pre-IVA, comparable al total_usd aceptado).
  const gate = await evaluateLegalGate(supabase, {
    tenantId: current.tenant_id,
    shipmentId: current.shipment_id,
    shipmentCode: current.shipment_code,
    totalForMatch: Number(current.base_amount),
  });
  if (gate.required && !gate.hasAcceptance) {
    // BLOQUEO DURO (flag on, SDD-0054 §3.1): sin aceptación vigente NO se emite y
    // NO se ofrece override (el cliente debe aceptar por el Portal · Slice C).
    if (LEGAL_GATE_HARD_BLOCK) {
      return {
        error:
          "No se puede emitir: este embarque DDP no tiene una aceptación de T&C vigente del cliente. Pedile que acepte los términos desde el Portal.",
      };
    }
    // ADVISORY (flag off, modo actual): se avisa pero el operador puede emitir igual.
    if (!legalOverride) {
      return {
        needsLegalAck: true,
        warning:
          "Este embarque DDP no tiene una aceptación de T&C vigente del cliente. Puedes emitir igual (queda registrado en la auditoría).",
      };
    }
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

  // legal_ack: "valid" (había aceptación), "override" (DDP sin aceptación,
  // emitido igual), o se omite si no es DDP (gate no aplica).
  const legalAck = gate.hasAcceptance ? "valid" : "override";
  await auditInvoice(
    current.tenant_id,
    current.id,
    await currentUserId(supabase),
    "issued",
    {
      invoice_code: current.invoice_code,
      total_amount: current.total_amount,
      ...(gate.required ? { legal_ack: legalAck } : {}),
    },
  );

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

/**
 * Registra un cobro sobre una factura (SDD-0041). Delega en la lógica
 * compartida `registerCollectionFor` (crea recibo R-YYYY-NNNN + sube saldo +
 * recalcula status + asiento del cobro DR caja / CR 1.1.2). El detalle de
 * factura y el módulo Cobranzas usan el mismo camino server-side.
 *
 * Recibe `cashAccountId` (cuenta de caja/banco), `method`, `receivedAt` y
 * `reference` además del `amount`.
 */
export async function registerPayment(
  id: string,
  payload: {
    amount: number;
    cashAccountId: string;
    method?: PaymentMethod;
    receivedAt?: string;
    reference?: string | null;
    notes?: string | null;
  },
): Promise<{ ok?: boolean; error?: string; receiptCode?: string; fullyPaid?: boolean }> {
  const supabase = await createClient();

  // Resolver el invoice_code para revalidar el detalle (la lógica compartida
  // no lo devuelve; lo leemos barato acá).
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_code")
    .eq("id", id)
    .maybeSingle<{ invoice_code: string }>();

  const result = await registerCollectionFor(supabase, id, {
    amount: payload.amount,
    cashAccountId: payload.cashAccountId,
    method: payload.method,
    receivedAt: payload.receivedAt,
    reference: payload.reference ?? null,
    notes: payload.notes ?? null,
  });

  if (!result.ok) {
    // Aplanar fieldErrors a un mensaje (el modal muestra un banner simple).
    const firstFieldError = result.fieldErrors
      ? Object.values(result.fieldErrors)[0]
      : undefined;
    return { error: result.error ?? firstFieldError ?? "No se pudo registrar el cobro." };
  }

  revalidatePath("/studio/facturacion");
  revalidatePath("/studio/cobranzas");
  if (inv?.invoice_code) {
    revalidatePath(`/studio/facturacion/${inv.invoice_code}`);
  }
  return { ok: true, receiptCode: result.receiptCode, fullyPaid: result.fullyPaid };
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
