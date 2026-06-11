/**
 * Queries de la Rendición quincenal (SDD-0069). Funciones que reciben un
 * SupabaseClient y confían en RLS por tenant.
 *
 *   · localRevenueInvoicedSummary = servicios locales FACTURADOS en el período
 *     (base DEVENGADO: invoices fund_class='local_revenue' con status emitida/
 *     parcial/pagada e issued_at en rango, normalizado a USD). Espejo de
 *     `fundsSeparationSummary` (que es base CAJA, sobre recibos).
 *   · previewRendition            = el preview en vivo (decisión #5): compone el
 *     recaudado de terceros (CAJA) + el local facturado (DEVENGADO) + la lista
 *     de recibos elegibles. NO persiste nada.
 *   · listRenditions              = el historial de rendiciones del tenant.
 *   · getRenditionWithReceipts    = una rendición + sus recibos (vista imprimible
 *     + export).
 *
 * `numeric` de Supabase llega como string → se coerce en cada lectura. La
 * normalización a USD usa el helper existente `receiptAmountUsd` (USD/USDT 1:1 ·
 * VES /fx_rate · CNY 0), misma convención que el asiento y SDD-0068.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { receiptAmountUsd } from "../accounting/receipt-posting";
import type { InvoiceCurrency } from "../invoice-types";
import type { PaymentReceipt } from "../payment-types";
import {
  isReceiptEligible,
  netToOperadora,
  type Rendition,
  type RenditionLine,
  type RenditionPreview,
  type RenditionReceipt,
  type RenditionStatus,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Servicios locales facturados (base DEVENGADO) ──────────────

/** Facturas que cuentan como ingreso local facturado del período. */
const LOCAL_REVENUE_STATUSES = new Set<string>(["emitida", "parcial", "pagada"]);

export type LocalRevenueInvoiced = {
  /** Servicios locales facturados en el período, USD. */
  localRevenueUsd: number;
  /** Cantidad de facturas que entraron. */
  invoiceCount: number;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

/** Forma serializable de una factura local para sumar el devengado. PURA. */
export type LocalInvoiceRow = {
  fund_class: string;
  status: string;
  issued_at: string | null;
  currency: InvoiceCurrency;
  total_amount: number;
  fx_rate: number | null;
};

/**
 * Computa el ingreso local facturado a partir de facturas ya leídas. PURA —
 * testeable sin DB (decisión #3, base DEVENGADO):
 *  - `fund_class === 'local_revenue'`.
 *  - `status ∈ {emitida, parcial, pagada}` (las anuladas/borrador no devengan).
 *  - `issued_at` dentro de [from, to] inclusive (emisión en el período).
 * El total se normaliza a USD con la MISMA convención de `receiptAmountUsd`.
 */
export function computeLocalRevenueInvoiced(
  invoices: LocalInvoiceRow[],
  range: { from: string; to: string },
): LocalRevenueInvoiced {
  let localRevenueUsd = 0;
  let invoiceCount = 0;
  for (const inv of invoices) {
    if (inv.fund_class !== "local_revenue") continue;
    if (!LOCAL_REVENUE_STATUSES.has(inv.status)) continue;
    const issued = inv.issued_at ? String(inv.issued_at) : "";
    if (!issued || issued < range.from || issued > range.to) continue;
    localRevenueUsd += receiptAmountUsd(
      inv.total_amount,
      inv.currency,
      inv.fx_rate,
    );
    invoiceCount += 1;
  }
  return {
    localRevenueUsd: round2(localRevenueUsd),
    invoiceCount,
    from: range.from,
    to: range.to,
  };
}

/**
 * Servicios locales facturados del período [from, to] (inclusive, por
 * `issued_at`). Lee las facturas vivas del tenant (RLS) y suma con
 * `computeLocalRevenueInvoiced`. Espejo de `fundsSeparationSummary`.
 */
export async function localRevenueInvoicedSummary(
  supabase: SupabaseClient,
  range: { from: string; to: string },
): Promise<LocalRevenueInvoiced> {
  const { data, error } = await supabase
    .from("invoices")
    .select("fund_class, status, issued_at, currency, total_amount, fx_rate")
    .eq("fund_class", "local_revenue")
    .gte("issued_at", range.from)
    .lte("issued_at", range.to)
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw error;

  const invoices: LocalInvoiceRow[] = (
    (data as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    fund_class: r.fund_class === "local_revenue" ? "local_revenue" : "third_party",
    status: String(r.status ?? ""),
    issued_at: (r.issued_at as string | null) ?? null,
    currency: (r.currency as InvoiceCurrency) ?? "USD",
    total_amount: num(r.total_amount),
    fx_rate: numOrNull(r.fx_rate),
  }));

  return computeLocalRevenueInvoiced(invoices, range);
}

// ── Recibos elegibles → líneas del detalle ────────────────────

const ELIGIBLE_RECEIPT_COLUMNS =
  "id, receipt_code, invoice_id, client_markbox, client_name, amount, currency, fx_rate, received_at, application_status, fund_class";

/** Forma mínima de un recibo para el preview (subset serializable). */
export type EligibleReceiptRow = Pick<
  PaymentReceipt,
  | "id"
  | "receipt_code"
  | "invoice_id"
  | "client_markbox"
  | "client_name"
  | "amount"
  | "currency"
  | "fx_rate"
  | "received_at"
  | "application_status"
  | "fund_class"
>;

/**
 * Construye las líneas del detalle a partir de recibos elegibles + un mapa
 * receipt.invoice_id → invoice_code (la "referencia" de envío). PURA —
 * testeable sin DB. Solo incluye los recibos que pasan `isReceiptEligible`.
 */
export function buildRenditionLines(
  receipts: EligibleReceiptRow[],
  invoiceCodeById: Map<string, string>,
  range: { from: string; to: string },
): RenditionLine[] {
  const lines: RenditionLine[] = [];
  for (const r of receipts) {
    if (!isReceiptEligible(r, range)) continue;
    const amountUsd = receiptAmountUsd(r.amount, r.currency, r.fx_rate);
    lines.push({
      receiptId: String(r.id),
      receiptCode: String(r.receipt_code),
      clientName: r.client_name ?? null,
      clientMarkbox: r.client_markbox ?? null,
      reference: r.invoice_id ? invoiceCodeById.get(r.invoice_id) ?? null : null,
      amount: num(r.amount),
      currency: String(r.currency),
      amountUsd: round2(amountUsd),
      receivedAt: String(r.received_at),
    });
  }
  // Orden estable: por fecha de recepción asc, luego por código.
  lines.sort((a, b) =>
    a.receivedAt === b.receivedAt
      ? a.receiptCode < b.receiptCode
        ? -1
        : a.receiptCode > b.receiptCode
          ? 1
          : 0
      : a.receivedAt < b.receivedAt
        ? -1
        : 1,
  );
  return lines;
}

/**
 * Arma el preview a partir de las líneas elegibles + el local facturado. PURA.
 * `thirdPartyUsd` se suma de las líneas (= recaudado de terceros del período,
 * CAJA). El neto = terceros − local facturado (DEVENGADO).
 */
export function buildRenditionPreview(
  lines: RenditionLine[],
  localRevenueInvoicedUsd: number,
  range: { from: string; to: string },
): RenditionPreview {
  const thirdPartyUsd = round2(
    lines.reduce((sum, l) => sum + l.amountUsd, 0),
  );
  const local = round2(localRevenueInvoicedUsd);
  return {
    from: range.from,
    to: range.to,
    thirdPartyUsd,
    localRevenueInvoicedUsd: local,
    netToOperadoraUsd: netToOperadora(thirdPartyUsd, local),
    receiptCount: lines.length,
    lines,
  };
}

/**
 * Preview EN VIVO de la rendición de un período (decisión #5, NO persiste):
 *  1. lee los recibos elegibles del período (third_party + aplicado + en rango,
 *     vivos);
 *  2. resuelve invoice_code de sus facturas (la referencia de envío);
 *  3. suma el recaudado de terceros (de las líneas) y el local facturado
 *     (DEVENGADO, `localRevenueInvoicedSummary`);
 *  4. compone el preview con los 3 totales y el detalle.
 *
 * Re-emitir un período ya rendido da preview vacío: los recibos rendidos ya no
 * están en `aplicado` → no pasan el filtro (idempotencia visible, acceptance).
 */
export async function previewRendition(
  supabase: SupabaseClient,
  range: { from: string; to: string },
): Promise<RenditionPreview> {
  // 1. Recibos elegibles: filtros duros en la query (third_party + aplicado +
  //    en rango + vivos); isReceiptEligible re-valida en memoria (cinturón).
  const { data: recRows, error: recErr } = await supabase
    .from("payment_receipts")
    .select(ELIGIBLE_RECEIPT_COLUMNS)
    .eq("fund_class", "third_party")
    .eq("application_status", "aplicado")
    .gte("received_at", range.from)
    .lte("received_at", range.to)
    .is("deleted_at", null)
    .limit(20000);
  if (recErr) throw recErr;

  const receipts: EligibleReceiptRow[] = (
    (recRows as Record<string, unknown>[] | null) ?? []
  ).map((r) => ({
    id: String(r.id),
    receipt_code: String(r.receipt_code),
    invoice_id: r.invoice_id == null ? null : String(r.invoice_id),
    client_markbox: r.client_markbox == null ? null : String(r.client_markbox),
    client_name: r.client_name == null ? null : String(r.client_name),
    amount: num(r.amount),
    currency: (r.currency as InvoiceCurrency) ?? "USD",
    fx_rate: numOrNull(r.fx_rate),
    received_at: String(r.received_at),
    application_status: "aplicado",
    fund_class: "third_party",
  }));

  // 2. invoice_code de las facturas referenciadas (la "referencia" del detalle).
  const invoiceIds = [
    ...new Set(
      receipts.map((r) => r.invoice_id).filter((id): id is string => !!id),
    ),
  ];
  const invoiceCodeById = new Map<string, string>();
  if (invoiceIds.length > 0) {
    const { data: invRows, error: invErr } = await supabase
      .from("invoices")
      .select("id, invoice_code")
      .in("id", invoiceIds)
      .limit(20000);
    if (invErr) throw invErr;
    for (const row of (invRows as Record<string, unknown>[] | null) ?? []) {
      invoiceCodeById.set(String(row.id), String(row.invoice_code));
    }
  }

  // 3 + 4.
  const lines = buildRenditionLines(receipts, invoiceCodeById, range);
  const local = await localRevenueInvoicedSummary(supabase, range);
  return buildRenditionPreview(lines, local.localRevenueUsd, range);
}

// ── Historial de rendiciones ──────────────────────────────────

const RENDITION_COLUMNS =
  "id, tenant_id, rendition_code, period_from, period_to, third_party_usd, local_revenue_usd, net_to_operadora_usd, receipt_count, status, void_reason, created_by, emitted_at, created_at";

function coerceRendition(row: Record<string, unknown>): Rendition {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    rendition_code: String(row.rendition_code),
    period_from: String(row.period_from),
    period_to: String(row.period_to),
    third_party_usd: num(row.third_party_usd),
    local_revenue_usd: num(row.local_revenue_usd),
    net_to_operadora_usd: num(row.net_to_operadora_usd),
    receipt_count: num(row.receipt_count),
    status: (row.status === "anulada" ? "anulada" : "emitida") as RenditionStatus,
    void_reason: (row.void_reason as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    emitted_at: String(row.emitted_at),
    created_at: String(row.created_at),
  };
}

/** El historial de rendiciones del tenant, más recientes primero. */
export async function listRenditions(
  supabase: SupabaseClient,
): Promise<Rendition[]> {
  const { data, error } = await supabase
    .from("renditions")
    .select(RENDITION_COLUMNS)
    .order("period_from", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceRendition,
  );
}

const RENDITION_RECEIPT_COLUMNS =
  "id, tenant_id, rendition_id, receipt_id, amount_usd, rendition_voided, created_at";

function coerceRenditionReceipt(
  row: Record<string, unknown>,
): RenditionReceipt {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    rendition_id: String(row.rendition_id),
    receipt_id: String(row.receipt_id),
    amount_usd: num(row.amount_usd),
    rendition_voided: row.rendition_voided === true,
    created_at: String(row.created_at),
  };
}

/**
 * Una rendición por su `rendition_code` + el detalle de sus recibos (enriquecido
 * con código/cliente/ref. del recibo). Para la vista imprimible + el export
 * (SDD-0069). RLS acota al tenant; `tenantId` se filtra explícito además
 * (cinturón y tirantes, criterio 0067). null si no existe.
 */
export async function getRenditionWithReceipts(
  supabase: SupabaseClient,
  args: { tenantId: string; code: string },
): Promise<{ rendition: Rendition; lines: RenditionLine[] } | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const code = String(args.code ?? "").trim();
  if (!tenantId || !code) return null;

  const { data: rendRow, error: rendErr } = await supabase
    .from("renditions")
    .select(RENDITION_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("rendition_code", code)
    .maybeSingle();
  if (rendErr) throw rendErr;
  if (!rendRow) return null;
  const rendition = coerceRendition(rendRow as Record<string, unknown>);

  const { data: brRows, error: brErr } = await supabase
    .from("rendition_receipts")
    .select(RENDITION_RECEIPT_COLUMNS)
    .eq("rendition_id", rendition.id)
    .limit(20000);
  if (brErr) throw brErr;
  const bridge = ((brRows as Record<string, unknown>[] | null) ?? []).map(
    coerceRenditionReceipt,
  );

  // Enriquecer cada fila puente con datos del recibo (código/cliente/ref).
  const receiptIds = bridge.map((b) => b.receipt_id);
  const lines: RenditionLine[] = [];
  if (receiptIds.length > 0) {
    const { data: recRows, error: recErr } = await supabase
      .from("payment_receipts")
      .select(
        "id, receipt_code, invoice_id, client_markbox, client_name, amount, currency, received_at",
      )
      .in("id", receiptIds)
      .limit(20000);
    if (recErr) throw recErr;
    const recById = new Map<string, Record<string, unknown>>();
    for (const r of (recRows as Record<string, unknown>[] | null) ?? []) {
      recById.set(String(r.id), r);
    }

    // invoice_code de las facturas referenciadas (la referencia de envío).
    const invoiceIds = [
      ...new Set(
        [...recById.values()]
          .map((r) => (r.invoice_id == null ? null : String(r.invoice_id)))
          .filter((id): id is string => !!id),
      ),
    ];
    const invoiceCodeById = new Map<string, string>();
    if (invoiceIds.length > 0) {
      const { data: invRows } = await supabase
        .from("invoices")
        .select("id, invoice_code")
        .in("id", invoiceIds)
        .limit(20000);
      for (const row of (invRows as Record<string, unknown>[] | null) ?? []) {
        invoiceCodeById.set(String(row.id), String(row.invoice_code));
      }
    }

    for (const b of bridge) {
      const rec = recById.get(b.receipt_id);
      const invoiceId =
        rec && rec.invoice_id != null ? String(rec.invoice_id) : null;
      lines.push({
        receiptId: b.receipt_id,
        receiptCode: rec ? String(rec.receipt_code) : b.receipt_id,
        clientName: rec ? ((rec.client_name as string | null) ?? null) : null,
        clientMarkbox: rec
          ? ((rec.client_markbox as string | null) ?? null)
          : null,
        reference: invoiceId ? invoiceCodeById.get(invoiceId) ?? null : null,
        amount: rec ? num(rec.amount) : 0,
        currency: rec ? String(rec.currency) : "USD",
        amountUsd: b.amount_usd,
        receivedAt: rec ? String(rec.received_at) : rendition.period_from,
      });
    }
    lines.sort((a, b) =>
      a.receivedAt === b.receivedAt
        ? a.receiptCode < b.receiptCode
          ? -1
          : a.receiptCode > b.receiptCode
            ? 1
            : 0
        : a.receivedAt < b.receivedAt
          ? -1
          : 1,
    );
  }

  return { rendition, lines };
}
