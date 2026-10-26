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
 * - softDeleteInvoice: deleted_at = now(), SOLO si status=borrador (SDD-0465)
 * - lookupShipmentForInvoice: prefill del drawer desde un código de embarque
 *
 * Las mutaciones de factura se auditan dentro de su transacción PostgreSQL
 * mediante el trigger de dominio D2 (SDD-0174).
 *
 * GANCHO CONTABLE: emitInvoice (y createInvoice con emit_on_create) crean el
 * asiento automático de venta vía SDD-0040 Contabilidad
 * (DR 1.1.2 Clientes / CR 4.5 Ingresos [+ CR 2.1.5 IVA]). registerPayment NO
 * toca contabilidad (el asiento del cobro vive en Cobranzas/Tesorería, Bloque 2).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { postInvoiceJournalEntry } from "@/lib/studio/accounting/invoice-posting";
import { revertReferralCreditsForInvoice } from "@/lib/studio/accounting/referral-credit-posting";
import { voidReferralRevertWarning } from "@/lib/studio/fidelizacion/referral-revert-notice";
import { registerCollectionFor } from "@/lib/studio/collections-actions";
import { LEGAL_GATE_HARD_BLOCK } from "@/lib/studio/legal/gate-config";
import { hasValidAcceptanceForMarkbox } from "@/lib/studio/legal/queries";
import {
  deriveFundClass,
  type FundClass,
  type PaymentMethod,
} from "@/lib/studio/payment-types";
import {
  calcInvoiceTotals,
  isInvoiceIvaMode,
  isInvoiceStatus,
  normalizeLines,
  resolveInvoiceIva,
  statusLabel,
  validateInvoiceInput,
  type InvoiceActionState,
  type InvoiceCurrency,
  type InvoiceInput,
  type InvoiceLine,
} from "@/lib/studio/invoice-types";
import { createAdminClient } from "@/lib/db/admin";
import {
  nombreDeLaMoneda,
  tasaDelDocumento,
  tasaVigente,
  type FuenteTasa,
  type IntencionTasa,
  type TasaDelDocumento,
} from "@/lib/studio/fx-rates";
import { necesitaTasa, normalizarMoneda, tasaPersistible } from "@/lib/shared/fx";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import { varsDeFacturaEmitida } from "@/lib/studio/invoice-mail-vars";
import { getFiscalSettingsSafe } from "@/lib/studio/fiscal/queries";
import {
  billToInsertPatch,
  billToUpdatePatch,
  buildInvoiceBillingOptions,
  isBillingKind,
  parseBillToKind,
  type BillingKind,
  type InvoiceBillingOptions,
} from "@/lib/studio/invoice-billing";

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

/**
 * SDD-0569 · Las columnas de la tasa congelada (0495). Solo en VES o CNY: en USD
 * y USDT no hay tasa, y no se nombran las columnas nuevas.
 */
function columnasDeTasa(tasa: TasaDelDocumento): Record<string, unknown> {
  return tasa.fxRateSource ? {
    fx_rate_source: tasa.fxRateSource,
    fx_rate_valid_on: tasa.fxRateValidOn,
    fx_rate_is_override: tasa.fxRateIsOverride,
  } : {};
}

function intencionDeTasa(formData: FormData): IntencionTasa {
  const intent = formData.get("fx_rate_intent");
  if (intent === "preserve" || intent === "manual" || intent === "catalog") return intent;
  // Otros consumidores que envían una cifra explícita también indican intención;
  // una entrada inválida no debe desaparecer al parsearla ni consultar catálogo.
  return String(formData.get("fx_rate") ?? "").trim() === "" ? "catalog" : "manual";
}

const CONFLICTO_FACTURA = "La factura cambió mientras trabajabas. Recarga y revisa los datos antes de volver a intentar.";

function faltaTasaDeEmision(currency: string, today: string): string {
  return `No se puede emitir: falta la tasa de ${nombreDeLaMoneda(currency)} para el ${today}. Cárgala en Admin › Tasas o escríbela en el borrador.`;
}

function inputFromFormData(formData: FormData): Partial<InvoiceInput> {
  const currencyRaw = String(formData.get("currency") ?? "USD");
  const currency = (VALID_CURRENCIES as string[]).includes(currencyRaw)
    ? (currencyRaw as InvoiceCurrency)
    : "USD";

  const ivaModeRaw = parseStringOrNull(formData.get("iva_mode"));
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
    iva_mode: isInvoiceIvaMode(ivaModeRaw) ? ivaModeRaw : null,
  };
}

/**
 * Resuelve IVA on/off + tasa + modo a persistir (SDD-0073 §8), leyendo la config
 * fiscal del tenant. Con el módulo OFF cae al toggle de tenant (comportamiento
 * actual); con ON usa el iva_mode de la factura (o el default del tenant).
 */
async function resolveIva(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  ivaMode: InvoiceInput["iva_mode"],
): Promise<{ ivaOn: boolean; ivaRate: number; ivaMode: string | null }> {
  const [settings, tenantIva] = await Promise.all([
    getFiscalSettingsSafe(supabase),
    tenantIvaOn(supabase, tenantId),
  ]);
  return resolveInvoiceIva({
    fiscalModuleEnabled: settings.fiscal_module_enabled,
    ivaMode,
    defaultMode: settings.default_invoice_iva_mode,
    ivaRateGeneral: settings.iva_rate_general,
    tenantIvaOn: tenantIva,
  });
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

function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(baseISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Clase de fondos de la factura (SDD-0068 · decisión #5). Solo ESCRIBE la
 * columna `invoices.fund_class` al crear/emitir — no toca asientos ni estados.
 *  - sin shipment → local_revenue (servicio local de DTD Services).
 *  - con shipment → deriveFundClass(shipment_service): transporte_terrestre ⇒
 *    local_revenue; consolidado_lcl/DDP/FCL ⇒ third_party (Operadora).
 *  - shipment referenciado pero ilegible (RLS/borrado) → third_party
 *    (conservador: nunca inflar el ingreso propio).
 */
async function deriveInvoiceFundClass(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shipmentId: string | null,
): Promise<FundClass> {
  if (!shipmentId) return "local_revenue";
  const { data } = await supabase
    .from("shipments")
    .select("shipment_service")
    .eq("id", shipmentId)
    .maybeSingle<{ shipment_service: string | null }>();
  if (!data) return "third_party";
  return deriveFundClass(data.shipment_service);
}

/**
 * Gate legal AUT-04 (SDD-0054 · Slice B).
 *
 * 🔴 **El modo NO se lee acá: se lee en `LEGAL_GATE_HARD_BLOCK`**
 * (`lib/studio/legal/gate-config.ts`). Hoy está en **BLOQUEO DURO** — flip del
 * founder del 2026-06-11, en ventana limpia (0 aceptaciones y 0 facturas DDP en
 * vuelo, así que no congeló nada). Emitir una factura DDP sin aceptación vigente
 * está PROHIBIDO: la action no muta y el create-and-emit cae a borrador.
 *
 * ⚠️ Este bloque decía "modo ADVISORY" y que "el productor de aceptaciones
 * (Slice C) todavía no existe". Las dos cosas eran falsas: el Slice C se cerró
 * el MISMO DÍA que se escribió esto (`2ef74ba2`, 2026-06-04) y el flip a bloqueo
 * duro fue una semana después. Estuvo mintiendo dos meses y medio sobre si un
 * control legal bloquea o no — corregido el 2026-08-23 midiendo la constante.
 * **Si vuelves a dudar del modo, abre `gate-config.ts`; no confíes en este
 * comentario ni en el de al lado.**
 *
 * Consecuencia que conviene tener presente: el match incluye la MEDIDA real, así
 * que si la medida CN cambia después de que el cliente aceptó, la aceptación
 * vieja deja de matchear y **la factura se traba**. Eso es deliberado (nadie
 * factura una medida que el cliente no aceptó), pero hoy el cliente NO se entera
 * — pedirle la re-aceptación es el Slice B de SDD-0075, que sigue pendiente.
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
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  const partial = inputFromFormData(formData);
  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const today = new Date().toISOString().slice(0, 10);
  const emitNowRequested = String(formData.get("emit_on_create") ?? "") === "true";
  // SDD-0569: en VES o CNY, la tasa escrita o la vigente de fx_rates.
  const tasa = await tasaDelDocumento(
    supabase, tenantId, partial.currency ?? "USD", partial.fx_rate, today, null, intencionDeTasa(formData),
  );
  if (!tasa.ok) return { fieldErrors: { fx_rate: tasa.error } };
  if (emitNowRequested && partial.currency === "VES" && !tasa.tasa.fxRateIsOverride
      && tasa.tasa.fxRateValidOn !== today) {
    return { fieldErrors: { fx_rate: faltaTasaDeEmision("VES", today) } };
  }
  if (tasa.tasa.fxRate !== null) partial.fx_rate = tasa.tasa.fxRate;

  const { input, fieldErrors } = validateInvoiceInput(partial);
  if (fieldErrors) return { fieldErrors };
  const billTo = parseBillToKind(formData);

  const iva = await resolveIva(supabase, tenantId, input!.iva_mode);
  const totals = calcInvoiceTotals({
    lines: input!.lines,
    ivaRate: iva.ivaRate,
    ivaOn: iva.ivaOn,
  });

  // Generar invoice_code atómico
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_invoice_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de factura." };
  }
  const invoice_code = String(codeData);

  // Gate legal AUT-04 (SDD-0054). Se evalúa ANTES del insert para decidir si el
  // create-and-emit de un DDP puede realmente emitir.
  //   · ADVISORY (flag off — NO es el modo de hoy): create-and-emit no tiene confirm inline
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
      // SDD-0569: en USD y USDT, null aunque el campo oculto traiga una vieja.
      fx_rate: tasa.tasa.fxRate,
      ...columnasDeTasa(tasa.tasa),
      iva_rate: iva.ivaRate,
      iva_mode: iva.ivaMode,
      base_amount: totals.base,
      iva_amount: totals.iva,
      total_amount: totals.total,
      lines: input!.lines,
      notes: input!.notes,
      status: emitNow ? "emitida" : "borrador",
      issued_at: emitNow ? today : null,
      due_date: input!.due_date ?? (emitNow ? addDaysISO(today, 30) : null),
      // SDD-0068: clasificación de fondos del mandato (los recibos la heredan).
      fund_class: await deriveInvoiceFundClass(supabase, input!.shipment_id),
      // SDD-0298/0487: el titular (nombre, documento, tipo y domicilio) lo sella
      // la base al emitir (trigger 0466). Aquí sólo viaja la elección del
      // operador, y sólo si el selector de titular estaba en pantalla.
      ...billToInsertPatch(billTo),
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
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("status, invoice_code, tenant_id, currency, fx_rate, fx_rate_source, fx_rate_valid_on, fx_rate_is_override, write_version")
    .eq("id", id)
    .maybeSingle<{
      status: string;
      invoice_code: string;
      tenant_id: string;
      currency: string;
      fx_rate: number | string | null;
      fx_rate_source: FuenteTasa | null;
      fx_rate_valid_on: string | null;
      fx_rate_is_override: boolean;
      write_version: number | string;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status !== "borrador") {
    return { error: "Solo las facturas en borrador pueden editarse." };
  }

  const partial = inputFromFormData(formData);
  // SDD-0569: preservar es una intención expresa del formulario precargado.
  // Cambiar moneda invalida esa preservación, aunque el número coincida.
  const mismaMoneda = normalizarMoneda(current.currency) === normalizarMoneda(partial.currency ?? "USD");
  const tasa = await tasaDelDocumento(
    supabase, current.tenant_id, partial.currency ?? "USD", partial.fx_rate, new Date().toISOString().slice(0, 10),
    mismaMoneda
      ? {
          fxRate: tasaPersistible(current.fx_rate), fxRateSource: current.fx_rate_source,
          fxRateValidOn: current.fx_rate_valid_on, fxRateIsOverride: current.fx_rate_is_override,
        }
      : null,
    !mismaMoneda && intencionDeTasa(formData) === "preserve" ? "catalog" : intencionDeTasa(formData),
  );
  if (!tasa.ok) return { fieldErrors: { fx_rate: tasa.error } };
  if (tasa.tasa.fxRate !== null) partial.fx_rate = tasa.tasa.fxRate;
  const { input, fieldErrors } = validateInvoiceInput(partial);
  if (fieldErrors) return { fieldErrors };
  const billTo = parseBillToKind(formData);

  const iva = await resolveIva(supabase, current.tenant_id, input!.iva_mode);
  const totals = calcInvoiceTotals({
    lines: input!.lines,
    ivaRate: iva.ivaRate,
    ivaOn: iva.ivaOn,
  });

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      shipment_id: input!.shipment_id,
      shipment_code: input!.shipment_code,
      currency: input!.currency,
      // SDD-0569: las tres siempre; en USD y USDT van a null (lo promete la 0495).
      fx_rate: tasa.tasa.fxRate,
      fx_rate_source: tasa.tasa.fxRateSource,
      fx_rate_valid_on: tasa.tasa.fxRateValidOn,
      fx_rate_is_override: tasa.tasa.fxRateIsOverride,
      iva_rate: iva.ivaRate,
      iva_mode: iva.ivaMode,
      base_amount: totals.base,
      iva_amount: totals.iva,
      total_amount: totals.total,
      lines: input!.lines,
      notes: input!.notes,
      due_date: input!.due_date,
      // SDD-0487: la elección de titular del borrador (null = la preferencia
      // del cliente). Sólo si el selector estaba en pantalla.
      ...billToUpdatePatch(billTo),
    })
    .eq("id", id)
    .eq("tenant_id", current.tenant_id)
    .eq("write_version", current.write_version)
    .eq("status", "borrador")
    .eq("currency", current.currency)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (!updated) return { error: CONFLICTO_FACTURA };

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
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, status, invoice_code, client_markbox, client_name, currency, fx_rate, fx_rate_source, fx_rate_valid_on, fx_rate_is_override, write_version, shipment_id, shipment_code, due_date, base_amount, iva_amount, total_amount",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
      client_markbox: string;
      client_name: string;
      currency: string;
      fx_rate: number | null;
      fx_rate_source: FuenteTasa | null;
      fx_rate_valid_on: string | null;
      fx_rate_is_override: boolean;
      write_version: number | string;
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

  // Gate legal AUT-04 (SDD-0054 · Slice B). El modo lo decide
  // `LEGAL_GATE_HARD_BLOCK` (gate-config.ts), HOY EN BLOQUEO DURO — las dos ramas
  // de abajo siguen escritas porque la constante se puede volver a bajar.
  // Si es un embarque DDP sin aceptación T&C vigente, NO mutamos: en duro se
  // rechaza, y en advisory se devuelve needsLegalAck para que el detalle muestre
  // un banner y deje al operador emitir con override (queda en la auditoría como
  // `legal_ack: "override"`). El total a matchear = base_amount (pre-IVA,
  // comparable al total_usd aceptado).
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
          "No se puede emitir: este embarque DDP no tiene una aceptación de T&C vigente del cliente. Pídele que acepte los términos desde el Portal.",
      };
    }
    // ADVISORY (flag off — NO es el modo de hoy): se avisa pero el operador emite igual.
    if (!legalOverride) {
      return {
        needsLegalAck: true,
        warning:
          "Este embarque DDP no tiene una aceptación de T&C vigente del cliente. Puedes emitir igual (queda registrado en la auditoría).",
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Solo un override documental expreso se conserva. La fuente manual del
  // catálogo no significa override. VES automática exige fecha exacta; CNY
  // conserva la regla histórica <= día, por decisión del Director.
  let tasaDeEmision: Record<string, unknown> = {};
  if (necesitaTasa(current.currency)) {
    if (current.fx_rate_is_override) {
      if (current.fx_rate_source !== "manual" || !current.fx_rate_valid_on || tasaPersistible(current.fx_rate) === null) {
        return { error: "No se puede emitir: revisa la tasa manual del borrador; debe conservar un valor mayor que 0 con 8 decimales." };
      }
    } else {
      const vigente = await tasaVigente(supabase, current.tenant_id, current.currency, today);
      if (!vigente || (normalizarMoneda(current.currency) === "VES" && vigente.validOn !== today)) {
        return { error: faltaTasaDeEmision(current.currency, today) };
      }
      tasaDeEmision = {
        fx_rate: vigente.rate, fx_rate_source: vigente.source, fx_rate_valid_on: vigente.validOn,
        fx_rate_is_override: false,
      };
    }
  }

  const { data: emitted, error } = await supabase
    .from("invoices")
    .update({
      status: "emitida",
      issued_at: today,
      ...tasaDeEmision,
      due_date: current.due_date ?? addDaysISO(today, 30),
      // SDD-0068: re-derivar la clase de fondos al emitir (el shipment pudo
      // cambiar mientras era borrador). Solo escribe la columna — el asiento
      // de emisión y la máquina de estados quedan intactos.
      fund_class: await deriveInvoiceFundClass(supabase, current.shipment_id),
      // SDD-0298/0487: el titular lo sella la base en este UPDATE (trigger
      // 0466): borrador → emitida. Desde ahora el papel ya no cambia.
    })
    .eq("id", id)
    .eq("tenant_id", current.tenant_id)
    .eq("write_version", current.write_version)
    .eq("status", "borrador")
    .eq("currency", current.currency)
    .is("deleted_at", null)
    .select("id, fx_rate")
    .maybeSingle<{ id: string; fx_rate: number | null }>();

  if (error) return { error: error.message };
  if (!emitted) return { error: CONFLICTO_FACTURA };

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

  // SDD-0305: la factura emitida avisa por correo. `fireMailEvent` NO manda
  // nada por su cuenta: busca las reglas activas del tenant para este evento y,
  // si no hay ninguna, se va en silencio. Quién la recibe —cliente, equipo o un
  // correo fijo— y con qué plantilla se configura en Studio › Mailing, no acá.
  //
  // Best-effort igual que el asiento: si el correo falla, la factura ya se
  // emitió. El motor se traga sus propios errores; el catch cubre que reviente
  // la creación del cliente admin (sin SUPABASE_SERVICE_ROLE_KEY).
  try {
    await fireMailEvent(createAdminClient(), current.tenant_id, {
      event: "invoice_emitted",
      vars: varsDeFacturaEmitida(
        { ...current, fx_rate: emitted.fx_rate },
        today,
        current.due_date ?? addDaysISO(today, 30),
      ),
      clientMarkbox: current.client_markbox,
      clientName: current.client_name,
      sourceRef: { kind: "invoice", id: current.id },
    });
  } catch (e) {
    console.error("[emitInvoice] fireMailEvent falló:", e);
  }

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
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

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
  reasonRaw: string,
): Promise<{ ok?: boolean; error?: string; warning?: string }> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  // Anular es accounting/admin: gate del módulo "invoices" (SDD-0085) — resuelve
  // el viejo TODO de permisos. La RPC (0497) vuelve a exigirlo en la base.
  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("id, tenant_id, status, invoice_code, paid_amount")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      invoice_code: string;
      paid_amount: number | string | null;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.status === "pagada") {
    return { error: "No se puede anular una factura ya pagada." };
  }
  if (current.status === "anulada") {
    return { error: "Esta factura ya está anulada." };
  }

  // SDD-0573: con cobros vivos la base no la anula. Se mira ANTES de revertir el
  // crédito, para no liberarlo en una anulación que igual se va a rechazar. La
  // RPC lo vuelve a contar bajo el lock de la factura, que es lo que manda.
  // Un conteo desconocido no habilita efectos; sólo cuentan los recibos del tenant actual.
  const { count: recibosVivos, error: recibosError } = await supabase
    .from("payment_receipts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", current.tenant_id)
    .eq("invoice_id", id)
    .is("deleted_at", null);
  if (recibosError || recibosVivos == null) {
    return {
      error:
        "No se pudieron comprobar los cobros de esta factura. Intenta de nuevo antes de anularla.",
    };
  }
  if (recibosVivos > 0) {
    return { error: `La factura tiene ${recibosVivos} cobro(s) vivo(s): anúlalos primero en Cobranzas.` };
  }

  // SDD-0573: la base no anula una factura con abono sin recibo (decisión del
  // Director, 2026-10-20). El abono de un crédito de referido se revierte
  // PRIMERO, por la RPC revert_referral_credits (0471, factura FOR UPDATE), que
  // no exige la factura anulada. Antes (SDD-0137 §3.6 y 0495/0496) la reversión
  // corría después de anular y era best-effort; ahora, si el crédito no vuelve,
  // la factura no se anula: no queda un crédito pegado a una anulada.
  let warning: string | undefined;
  let liberados = 0;
  if (Number(current.paid_amount ?? 0) > 0) {
    const revert = await revertReferralCreditsForInvoice(
      supabase,
      current.tenant_id,
      current.id,
    );
    if (!revert.ok) {
      console.error(
        `[fidelizacion] no se pudieron revertir créditos de referido de la factura ${current.invoice_code}:`,
        revert.error,
      );
      if (revert.failure !== "entries") {
        return {
          error:
            "No se pudo liberar el crédito de referido aplicado a esta factura, así que no se anuló. Intenta de nuevo; si sigue, pásaselo a contabilidad con el código de la factura.",
        };
      }
      // "entries": la plata volvió entera; lo que quedó vivo es el asiento del
      // crédito. La anulación sigue, con su aviso (SDD-0496).
      warning = voidReferralRevertWarning(revert.failure);
    }
    liberados = revert.reverted;
    if (liberados > 0 || warning) revalidatePath("/studio/fidelizacion");
  }

  const { data: changed, error } = await supabase.rpc(
    "void_invoice_with_audit_reason",
    {
      p_id: id,
      p_reason: reasonResult.reason,
    },
  );

  // SDD-0573: solo los mensajes propios de la 0497 (hint dtd-anular) y el del
  // motivo; nunca el texto crudo de la base (ERR-01).
  const yaLiberado = liberados > 0
    ? " El crédito de referido que tenía aplicado ya volvió a estar disponible."
    : "";
  if (error) {
    if (error.hint === "dtd-anular" && error.message) return { error: error.message + yaLiberado };
    if (error.code === "22023" && error.message?.startsWith("audit: reason")) {
      return { error: "El motivo debe tener entre 4 y 1000 caracteres." + yaLiberado };
    }
    console.error("[facturacion] anular:", error.code, error.message);
    return { error: "No se pudo anular la factura. Intenta de nuevo." + yaLiberado };
  }
  // Sólo null en el transporte y un booleano acreditan el ACK. Un valor
  // inesperado no demuestra rechazo ni permite afirmar que no hubo efectos.
  if (error !== null || (changed !== true && changed !== false)) {
    return {
      error:
        "No se pudo confirmar la anulación de la factura. Revisa su estado antes de volver a intentar." + yaLiberado,
    };
  }
  if (changed === false) return { error: "La factura ya no admite anulación." + yaLiberado };

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  revalidatePath("/studio/contabilidad");
  return warning ? { ok: true, warning } : { ok: true };
}

/**
 * SDD-0465 · Por qué el borrado lógico no procede fuera de `borrador`.
 *
 * Es la matriz de permanencia MP-01 aplicada a facturación: «Borrador: P2/R2.
 * Emitido o asentado: P3/R3», y «`deleted_at` no demuestra por sí solo que P2
 * esté bien aplicado». Una factura emitida ya produjo el asiento de venta
 * (SDD-0040), puede tener recibos (SDD-0041) y créditos de referido aplicados
 * (SDD-0137) y entra al libro de ventas (SDD-0073); ocultarla con `deleted_at`
 * dejaría el mayor y los recibos apuntando a una factura que ningún lector
 * muestra. Para eso existe `voidInvoice`: conserva el original, exige motivo y
 * revierte lo que haya que revertir. Una `anulada` tampoco se elimina: es el
 * resultado P3 y su rastro tiene que seguir visible.
 */
function softDeleteDenial(status: string): string {
  if (status === "anulada") {
    return "Esta factura ya está anulada y se conserva como registro; no se elimina.";
  }
  const label = isInvoiceStatus(status)
    ? statusLabel(status).toLowerCase()
    : status;
  return `Solo las facturas en borrador pueden eliminarse. Esta está ${label}: si no corresponde, anúlala con un motivo y queda registrada.`;
}

export async function softDeleteInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("id, status, invoice_code, deleted_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      invoice_code: string;
      deleted_at: string | null;
    }>();
  if (readErr || !current) return { error: "Factura no encontrada." };
  if (current.deleted_at) return { error: "Esta factura ya está eliminada." };
  if (current.status !== "borrador") {
    return { error: softDeleteDenial(current.status) };
  }

  // El UPDATE repite las condiciones: si la factura se emitió entre la lectura
  // y la escritura, no matchea ninguna fila y no se borra una emitida.
  const { data: deleted, error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "borrador")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { error: error.message };
  if (!deleted) {
    return {
      error:
        "La factura cambió de estado mientras se eliminaba; recarga y revisa antes de intentarlo otra vez.",
    };
  }

  revalidatePath("/studio/facturacion");
  revalidatePath(`/studio/facturacion/${current.invoice_code}`);
  return { ok: true };
}

/**
 * SDD-0281 · Duplicar una factura.
 *
 * ⚠️ Feature FINANCIERA — lo importante acá es lo que **NO** se copia.
 *
 * El duplicado nace SIEMPRE en `borrador`, sin emitir. Eso no es cosmético:
 * emitir dispara el asiento contable de venta (SDD-0040) y el gate legal AUT-04.
 * Un "duplicar" que emitiera crearía plata en el libro mayor con un clic.
 *
 * Tampoco se copian:
 *
 *  - **`sales_order_id`** 🔴. Es el candado de idempotencia del motor de
 *    auto-facturación (SDD-0072/0128): una segunda factura colgando de la misma
 *    OV rompe el universo congelado de cajas y abre la puerta a cobrar dos veces
 *    la misma caja. Es la razón principal por la que esta acción existe como
 *    copia explícita y no como un `select *` con código nuevo.
 *  - **Pagos** (`paid_amount`, `last_payment_at`): son del original.
 *  - **`issued_at` / `due_date`**: los pone la emisión, cuando ocurra.
 *
 * Sí se copia el vínculo con el embarque: facturar dos veces contra un mismo
 * embarque es legítimo (cargos adicionales, última milla aparte) y sin ese
 * vínculo el ingreso deja de imputarse al envío en los reportes.
 *
 * El `fund_class` se **re-deriva** del embarque en vez de copiarse: si la
 * clasificación del servicio cambió desde que se emitió el original, el
 * duplicado tiene que nacer con la de hoy.
 */
export async function duplicateInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string; code?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "invoices");
  if (denial) return { error: denial };

  const { data: original, error: readErr } = await supabase
    .from("invoices")
    .select(
      "tenant_id, client_markbox, client_name, shipment_id, shipment_code, currency, fx_rate, iva_rate, iva_mode, base_amount, iva_amount, total_amount, lines, notes",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Record<string, unknown>>();
  if (readErr) return { error: readErr.message };
  if (!original) return { error: "No se encontró la factura a duplicar." };

  const tenantId = original.tenant_id as string;
  // SDD-0569 (revisión, hallazgo 4): la copia es un documento nuevo; resuelve su
  // tasa hoy, antes de consumir correlativo. No hereda la del original.
  const tasa = await tasaDelDocumento(
    supabase, tenantId, String(original.currency ?? "USD"), null, new Date().toISOString().slice(0, 10),
  );
  if (!tasa.ok) return { error: tasa.error };
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_invoice_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de factura." };
  }

  const shipmentId = (original.shipment_id as string | null) ?? null;

  const { error } = await supabase.from("invoices").insert({
    tenant_id: tenantId,
    invoice_code: String(codeData),
    client_markbox: original.client_markbox,
    client_name: original.client_name,
    shipment_id: shipmentId,
    shipment_code: original.shipment_code,
    currency: original.currency,
    fx_rate: tasa.tasa.fxRate,
    ...columnasDeTasa(tasa.tasa),
    iva_rate: original.iva_rate,
    iva_mode: original.iva_mode,
    base_amount: original.base_amount,
    iva_amount: original.iva_amount,
    total_amount: original.total_amount,
    lines: original.lines,
    notes: original.notes,
    status: "borrador",
    issued_at: null,
    due_date: null,
    fund_class: await deriveInvoiceFundClass(supabase, shipmentId),
  });
  if (error) return { error: `No se pudo duplicar la factura: ${error.message}` };

  revalidatePath("/studio/facturacion");
  return { ok: true, code: String(codeData) };
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

/**
 * SDD-0487 · Titulares posibles de la factura de un Shipping Mark, para el
 * selector del borrador. Lee por RLS: el cliente del tenant y su identidad de
 * facturación (0466 da SELECT a accounting, admin y commercial). Sin 0466 la
 * tabla no existe y devuelve null: el borrador no muestra el selector y se
 * guarda como antes.
 */
export async function lookupInvoiceBillingOptions(
  markbox: string,
  invoiceId?: string | null,
): Promise<(InvoiceBillingOptions & { current: BillingKind | null }) | null> {
  const mb = markbox?.trim();
  if (!mb) return null;
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, rif, doc_kind")
    .eq("markbox", mb)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; name: string | null; rif: string | null; doc_kind: string | null }>();
  if (error || !client) return null;

  const { data: identity, error: idErr } = await supabase
    .from("client_billing_identities")
    .select("kind, legal_name, doc, fiscal_address, is_billing_default")
    .eq("client_id", client.id)
    .maybeSingle<{
      kind: string;
      legal_name: string;
      doc: string;
      fiscal_address: string | null;
      is_billing_default: boolean;
    }>();
  if (idErr) return null;

  // En un borrador existente, la elección que ya tiene: el selector arranca en
  // ella y guardar no la borra sin querer.
  let current: BillingKind | null = null;
  if (invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("bill_to_kind")
      .eq("id", invoiceId)
      .maybeSingle<{ bill_to_kind: string | null }>();
    const stored = inv?.bill_to_kind;
    current = isBillingKind(stored) ? stored : null;
  }
  return { ...buildInvoiceBillingOptions(client, identity ?? null), current };
}
