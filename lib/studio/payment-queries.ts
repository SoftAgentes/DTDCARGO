/**
 * Queries del módulo Cobranzas (SDD-0041).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 *
 * La cola de CxC (`receivablesQueue`) se DERIVA de las facturas con saldo
 * (no es una tabla nueva): facturas con `total_amount - paid_amount > 0` y
 * status ≠ anulada, enriquecidas con aging (días vencido) + stage derivado a
 * partir de las gestiones (`collection_activities`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import type { Account } from "./account-types";
import { computeBalance, type Invoice } from "./invoice-types";
import { invoiceUsdAmount } from "./fidelizacion/types";
import { receiptAmountUsd } from "./accounting/receipt-posting";
import {
  type ApplicationStatus,
  type CollectionActivity,
  type FundClass,
  type PayerKind,
  type PayerRelation,
  type PaymentReceipt,
  type ReceivableStage,
} from "./payment-types";

const RECEIPT_COLUMNS =
  "id, tenant_id, receipt_code, invoice_id, client_markbox, client_name, amount, currency, fx_rate, method, cash_account_id, reference, received_at, journal_entry_id, notes, payer_kind, payer_name, payer_relation, licit_declared, application_status, identified_at, fund_class, created_at, deleted_at";

const ACTIVITY_COLUMNS =
  "id, tenant_id, invoice_id, kind, promised_amount, promised_date, next_followup, body, created_at, created_by";

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

const APPLICATION_STATUS_SET = new Set<string>([
  "recibido_sin_ref",
  "identificado",
  "aplicado",
  "rendido",
]);

function coerceReceipt(row: Record<string, unknown>): PaymentReceipt {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    receipt_code: String(row.receipt_code),
    invoice_id: row.invoice_id == null ? null : String(row.invoice_id),
    client_markbox: row.client_markbox == null ? null : String(row.client_markbox),
    client_name: row.client_name == null ? null : String(row.client_name),
    amount: num(row.amount),
    currency: (row.currency as PaymentReceipt["currency"]) ?? "USD",
    fx_rate: numOrNull(row.fx_rate),
    method: String(row.method ?? "transferencia"),
    cash_account_id: String(row.cash_account_id),
    reference: (row.reference as string | null) ?? null,
    received_at: String(row.received_at),
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    // SDD-0068 (0122) — defaults coherentes con la migración para filas viejas.
    payer_kind: row.payer_kind === "tercero" ? "tercero" : ("cliente" as PayerKind),
    payer_name: row.payer_name == null ? null : String(row.payer_name),
    payer_relation: (row.payer_relation as PayerRelation | null) ?? null,
    licit_declared: row.licit_declared === true,
    application_status: APPLICATION_STATUS_SET.has(String(row.application_status))
      ? (row.application_status as ApplicationStatus)
      : "aplicado",
    identified_at: (row.identified_at as string | null) ?? null,
    fund_class:
      row.fund_class === "local_revenue"
        ? "local_revenue"
        : ("third_party" as FundClass),
    created_at: String(row.created_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

function coerceActivity(row: Record<string, unknown>): CollectionActivity {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    invoice_id: String(row.invoice_id),
    kind: row.kind as CollectionActivity["kind"],
    promised_amount: numOrNull(row.promised_amount),
    promised_date: (row.promised_date as string | null) ?? null,
    next_followup: (row.next_followup as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    created_at: String(row.created_at),
    created_by: (row.created_by as string | null) ?? null,
  };
}

const INVOICE_COLUMNS =
  "id, tenant_id, invoice_code, client_markbox, client_name, shipment_id, shipment_code, currency, fx_rate, iva_rate, base_amount, iva_amount, total_amount, status, issued_at, due_date, paid_amount, last_payment_at, lines, notes, created_at, updated_at, deleted_at";

function coerceInvoice(row: Record<string, unknown>): Invoice {
  return {
    ...(row as unknown as Invoice),
    fx_rate: numOrNull(row.fx_rate),
    iva_rate: num(row.iva_rate),
    base_amount: num(row.base_amount),
    iva_amount: num(row.iva_amount),
    total_amount: num(row.total_amount),
    paid_amount: num(row.paid_amount),
    lines: Array.isArray(row.lines) ? (row.lines as Invoice["lines"]) : [],
  };
}

// ── Recibos ───────────────────────────────────────────────────

/** Lista los recibos (vivos) de una factura, más recientes primero. */
export async function listReceipts(
  supabase: SupabaseClient,
  opts: { invoiceId?: string } = {},
): Promise<PaymentReceipt[]> {
  let query = supabase
    .from("payment_receipts")
    .select(RECEIPT_COLUMNS)
    .order("received_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts.invoiceId) query = query.eq("invoice_id", opts.invoiceId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReceipt);
}

/**
 * Búsqueda de recibos para el buscador global (SDD-0135). Por texto libre
 * (código / cliente / Shipping Mark / referencia) o por monto exacto (± 0.5).
 * RLS acota al tenant. Tope pequeño (anti-scraping + UX del ⌘K).
 *
 * SEGURIDAD: solo la invoca el buscador cuando el rol tiene módulo de dinero
 * (`collections`). Un rol operativo jamás llega acá — el gate está en el
 * server action del buscador, no en la RLS (que filtra por tenant, no por rol).
 */
export async function searchReceipts(
  supabase: SupabaseClient,
  opts: { q?: string; amount?: number; limit?: number } = {},
): Promise<PaymentReceipt[]> {
  let query = supabase
    .from("payment_receipts")
    .select(RECEIPT_COLUMNS)
    .order("received_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 5);

  const q = opts.q?.trim();
  if (q) {
    const clean = q.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `receipt_code.ilike.%${clean}%`,
        `client_name.ilike.%${clean}%`,
        `client_markbox.ilike.%${clean}%`,
        `reference.ilike.%${clean}%`,
      ].join(","),
    );
  } else if (opts.amount != null && Number.isFinite(opts.amount)) {
    query = query
      .gte("amount", opts.amount - 0.5)
      .lte("amount", opts.amount + 0.5);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReceipt);
}

/** Lista las gestiones de cobranza de una factura, más recientes primero. */
export async function listActivities(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<CollectionActivity[]> {
  const { data, error } = await supabase
    .from("collection_activities")
    .select(ACTIVITY_COLUMNS)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceActivity);
}

/**
 * Recibo por su receipt_code (R-YYYY-NNNN). Para la vista imprimible
 * (SDD-0068). RLS acota al tenant y excluye anulados; `tenantId` se filtra
 * explícito además (cinturón y tirantes, criterio 0067). null si no existe.
 */
export async function getReceiptByCode(
  supabase: SupabaseClient,
  args: { tenantId: string; code: string },
): Promise<PaymentReceipt | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const code = String(args.code ?? "").trim();
  if (!tenantId || !code) return null;

  const { data, error } = await supabase
    .from("payment_receipts")
    .select(RECEIPT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("receipt_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return coerceReceipt(data as Record<string, unknown>);
}

// ── Pagos sin identificar + separación de fondos (SDD-0068) ────

/** Los pagos `recibido_sin_ref` (cláusula 7.3), más recientes primero. */
export async function listUnidentifiedReceipts(
  supabase: SupabaseClient,
): Promise<PaymentReceipt[]> {
  const { data, error } = await supabase
    .from("payment_receipts")
    .select(RECEIPT_COLUMNS)
    .eq("application_status", "recibido_sin_ref")
    .order("received_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReceipt);
}

/**
 * Totales de la separación de fondos del mandato (insumo directo de la
 * rendición SDD-D): lo recaudado por clase en un período, normalizado a USD
 * (misma convención que el asiento: `receiptAmountUsd`).
 */
export type FundsSeparation = {
  /** Recaudado para la Operadora (flete internacional), USD. */
  thirdPartyUsd: number;
  /** Ingreso local de DTD Services (servicios locales), USD. */
  localRevenueUsd: number;
  /** Subconjunto de third_party aún sin identificar (recibido_sin_ref), USD. */
  unidentifiedUsd: number;
  /** Cantidad de pagos sin identificar. */
  unidentifiedCount: number;
  /** Cantidad de recibos del período. */
  receiptCount: number;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

/**
 * Computa la separación a partir de recibos ya filtrados por período. PURA —
 * testeable sin DB. Los sin-ref cuentan como `third_party` (su clase hasta
 * identificar) y además se desglosan en `unidentifiedUsd`.
 */
export function computeFundsSeparation(
  receipts: Pick<
    PaymentReceipt,
    "amount" | "currency" | "fx_rate" | "fund_class" | "application_status"
  >[],
  range: { from: string; to: string },
): FundsSeparation {
  let thirdPartyUsd = 0;
  let localRevenueUsd = 0;
  let unidentifiedUsd = 0;
  let unidentifiedCount = 0;

  for (const r of receipts) {
    const usd = receiptAmountUsd(r.amount, r.currency, r.fx_rate);
    if (r.fund_class === "local_revenue") {
      localRevenueUsd += usd;
    } else {
      thirdPartyUsd += usd;
    }
    if (r.application_status === "recibido_sin_ref") {
      unidentifiedUsd += usd;
      unidentifiedCount += 1;
    }
  }

  return {
    thirdPartyUsd: round2(thirdPartyUsd),
    localRevenueUsd: round2(localRevenueUsd),
    unidentifiedUsd: round2(unidentifiedUsd),
    unidentifiedCount,
    receiptCount: receipts.length,
    from: range.from,
    to: range.to,
  };
}

/**
 * Separación de fondos del período [from, to] (inclusive, por `received_at`).
 * Lee los recibos vivos del tenant (RLS) y suma con `computeFundsSeparation`.
 */
export async function fundsSeparationSummary(
  supabase: SupabaseClient,
  range: { from: string; to: string },
): Promise<FundsSeparation> {
  // Paginado: la separación de fondos SUMA lo recaudado del período y decide
  // cuánto es de terceros y cuánto propio. Truncar reparte plata mal.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("payment_receipts")
        .select("id, amount, currency, fx_rate, fund_class, application_status")
        .gte("received_at", range.from)
        .lte("received_at", range.to)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Los cobros del período superan el tope de lectura; la separación de fondos no se puede calcular.",
    );
  }

  const receipts = data.map(
    (r) => ({
      amount: num(r.amount),
      currency: (r.currency as PaymentReceipt["currency"]) ?? "USD",
      fx_rate: numOrNull(r.fx_rate),
      fund_class: (r.fund_class === "local_revenue"
        ? "local_revenue"
        : "third_party") as FundClass,
      application_status: APPLICATION_STATUS_SET.has(
        String(r.application_status),
      )
        ? (r.application_status as ApplicationStatus)
        : ("aplicado" as ApplicationStatus),
    }),
  );

  return computeFundsSeparation(receipts, range);
}

// ── Cola de CxC (derivada) ─────────────────────────────────────

/** Una factura con saldo en la cola de cobranza, enriquecida. */
export type Receivable = {
  invoice: Invoice;
  /** Saldo pendiente (total − pagado), en la MONEDA DE OPERACIÓN de la factura. */
  balance: number;
  /**
   * Saldo pendiente normalizado a USD (decisión SDD-0052 r2): USD/USDT → 1:1 ·
   * VES → /fx_rate (si fx_rate>0, sino 0) · CNY → 0. Misma normalización que
   * `invoiceUsdAmount`. Para sumar/bucketizar aging y KPIs en USD real (el
   * `balance` nativo es multi-moneda y NO se puede sumar como si fuera USD).
   */
  balanceUsd: number;
  /** Días vencido (>0 = vencido, <0 = faltan ese tanto, 0 = vence hoy). null sin due_date. */
  daysOverdue: number | null;
  /** Stage derivado para la cola. */
  stage: ReceivableStage;
  /** Última gestión (la más reciente), o null. */
  lastActivity: CollectionActivity | null;
  /** Fecha comprometida vigente (de la última promesa), o null. */
  promiseDate: string | null;
};

/** Días entre `due_date` y hoy (positivo = vencido). null si no hay due_date. */
export function daysOverdue(
  dueDate: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const now = new Date(today + "T00:00:00Z").getTime();
  return Math.round((now - due) / 86400000);
}

/**
 * Normaliza un saldo (en la moneda de la factura) a USD, con la MISMA
 * convención que `invoiceUsdAmount` (decisión SDD-0052 r2): USD/USDT → 1:1 ·
 * VES → /fx_rate (si fx_rate>0, sino 0) · CNY → 0. PURA.
 */
export function balanceToUsd(
  balance: number,
  invoice: Pick<Invoice, "currency" | "fx_rate">,
): number {
  return invoiceUsdAmount({
    currency: invoice.currency,
    total_amount: balance,
    fx_rate: invoice.fx_rate,
  });
}

/**
 * Deriva el stage de un receivable. PURA — testeable sin DB.
 *
 * Prioridad:
 *  - pagado: saldo ≤ 0.
 *  - promesa: hay una gestión kind='promesa' con fecha comprometida ≥ hoy
 *    (promesa vigente, no incumplida).
 *  - contactado: hubo alguna gestión (contacto/recordatorio/nota) y no está
 *    vencida (o la promesa ya venció pero hubo gestión).
 *  - vencido: due_date < hoy.
 *  - al-dia: el resto.
 */
export function derivedStage(args: {
  balance: number;
  dueDate: string | null;
  activities: CollectionActivity[];
  today?: string;
}): { stage: ReceivableStage; promiseDate: string | null } {
  const today = args.today ?? new Date().toISOString().slice(0, 10);
  if (round2(args.balance) <= 0) return { stage: "pagado", promiseDate: null };

  // Última promesa (la más reciente por created_at).
  const promises = args.activities
    .filter((a) => a.kind === "promesa" && a.promised_date)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const lastPromise = promises[0] ?? null;
  const promiseDate = lastPromise?.promised_date ?? null;

  const overdue = !!args.dueDate && args.dueDate < today;

  if (lastPromise && promiseDate && promiseDate >= today) {
    return { stage: "promesa", promiseDate };
  }

  const hasContact = args.activities.some(
    (a) => a.kind === "contacto" || a.kind === "recordatorio" || a.kind === "promesa",
  );

  if (overdue) {
    return { stage: hasContact ? "contactado" : "vencido", promiseDate };
  }
  if (hasContact) return { stage: "contactado", promiseDate };
  return { stage: "al-dia", promiseDate };
}

/**
 * Construye la cola de CxC a partir de un set de facturas y un map de gestiones
 * por invoice_id. PURA — testeable sin DB.
 *
 * Solo facturas con saldo > 0 y status ≠ anulada (las pagadas y anuladas no
 * están en la cola). Ordenadas por días vencido descendente (las más atrasadas
 * arriba), luego por saldo descendente.
 */
export function buildReceivablesQueue(
  invoices: Invoice[],
  activitiesByInvoice: Map<string, CollectionActivity[]>,
  today: string = new Date().toISOString().slice(0, 10),
): Receivable[] {
  const out: Receivable[] = [];
  for (const inv of invoices) {
    if (inv.status === "anulada") continue;
    const balance = computeBalance(inv);
    if (balance <= 0) continue;

    const activities = activitiesByInvoice.get(inv.id) ?? [];
    const { stage, promiseDate } = derivedStage({
      balance,
      dueDate: inv.due_date,
      activities,
      today,
    });
    out.push({
      invoice: inv,
      balance,
      balanceUsd: round2(balanceToUsd(balance, inv)),
      daysOverdue: daysOverdue(inv.due_date, today),
      stage,
      lastActivity: activities[0] ?? null, // listActivities devuelve desc por created_at
      promiseDate,
    });
  }

  out.sort((a, b) => {
    const da = a.daysOverdue ?? -99999;
    const db = b.daysOverdue ?? -99999;
    if (da !== db) return db - da;
    return b.balance - a.balance;
  });
  return out;
}

/**
 * Cola de cuentas por cobrar del tenant: facturas con saldo, enriquecidas con
 * aging + stage. Lee invoices (RLS) + las gestiones de esas facturas.
 */
export async function receivablesQueue(
  supabase: SupabaseClient,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<Receivable[]> {
  // Paginado: es la cola de COBRANZA. Una factura vencida que no aparece no
  // se cobra — y la lista se ordena por vencimiento, así que lo que se pierde
  // por el tope es justo la cola más nueva.
  const { rows: invRows, complete: invOk } = await fetchAllPaged<
    Record<string, unknown>
  >((d, h) =>
    supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .neq("status", "anulada")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!invOk) {
    throw new Error("Las facturas superan el tope de lectura para armar la cobranza.");
  }

  const invoices = invRows
    .map(coerceInvoice)
    .filter((i) => computeBalance(i) > 0);

  if (invoices.length === 0) return [];

  const ids = invoices.map((i) => i.id);
  // Por lotes y paginado: dos topes (el `.in(...)` en la URL y las filas).
  const { rows: actRows, complete: actOk } = await fetchAllByIds<
    Record<string, unknown>
  >(ids, (lote, d, h) =>
    supabase
      .from("collection_activities")
      .select(ACTIVITY_COLUMNS)
      .in("invoice_id", lote)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!actOk) {
    throw new Error("Las gestiones de cobranza superan el tope de lectura.");
  }

  const byInvoice = new Map<string, CollectionActivity[]>();
  for (const r of actRows) {
    const a = coerceActivity(r);
    const arr = byInvoice.get(a.invoice_id) ?? [];
    arr.push(a);
    byInvoice.set(a.invoice_id, arr);
  }

  return buildReceivablesQueue(invoices, byInvoice, today);
}

// ── KPIs ───────────────────────────────────────────────────────

export type CollectionKpis = {
  /** Saldo total por cobrar, en MONEDA DE OPERACIÓN sumada (multi-moneda · vista Cobranzas). */
  porCobrar: number;
  /** Saldo de las vencidas (moneda de operación sumada). */
  vencido: number;
  /** Saldo comprometido en promesas vigentes (moneda de operación sumada). */
  enPromesa: number;
  /**
   * Saldo total por cobrar normalizado a USD real (decisión SDD-0052 r2). Suma
   * `balanceUsd` por documento — apto para cruzar con CxP/Dirección/Reportes.
   */
  porCobrarUsd: number;
  /** Saldo vencido normalizado a USD real. */
  vencidoUsd: number;
  /** Cantidad de casos abiertos (facturas con saldo). */
  casos: number;
  /** Tasa de cobro: % al día sobre el total por cobrar (0-100). */
  tasaCobro: number;
};

/** Computa KPIs a partir de la cola. PURA — testeable sin DB. */
export function computeCollectionKpis(queue: Receivable[]): CollectionKpis {
  let porCobrar = 0;
  let vencido = 0;
  let enPromesa = 0;
  let porCobrarUsd = 0;
  let vencidoUsd = 0;
  for (const r of queue) {
    porCobrar += r.balance;
    porCobrarUsd += r.balanceUsd;
    const esVencido =
      r.stage === "vencido" ||
      r.stage === "contactado" ||
      ((r.daysOverdue ?? 0) > 0 && r.stage !== "promesa");
    if (esVencido) {
      vencido += r.balance;
      vencidoUsd += r.balanceUsd;
    }
    if (r.stage === "promesa") enPromesa += r.balance;
  }
  porCobrar = round2(porCobrar);
  vencido = round2(vencido);
  enPromesa = round2(enPromesa);
  porCobrarUsd = round2(porCobrarUsd);
  vencidoUsd = round2(vencidoUsd);
  const tasaCobro =
    porCobrar > 0 ? Math.round((1 - vencido / porCobrar) * 100) : 100;
  return {
    porCobrar,
    vencido,
    enPromesa,
    porCobrarUsd,
    vencidoUsd,
    casos: queue.length,
    tasaCobro,
  };
}

/** KPIs de cobranza del tenant (deriva de la cola). */
export async function collectionKpis(
  supabase: SupabaseClient,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<CollectionKpis> {
  const queue = await receivablesQueue(supabase, today);
  return computeCollectionKpis(queue);
}

// ── Cuentas de caja/banco (para el selector del cobro) ─────────

/**
 * ¿Es una cuenta válida para recibir un cobro? Cuenta postable de tipo
 * banco/caja: `qbo_type='Bank'` o code que empieza con `1.1.1`. PURA.
 */
export function isCashAccount(acct: Pick<Account, "code" | "qbo_type" | "is_postable">): boolean {
  if (!acct.is_postable) return false;
  return acct.qbo_type === "Bank" || acct.code.startsWith("1.1.1");
}

/** Lista las cuentas de caja/banco postables del tenant (para el select). */
export async function listCashAccounts(
  supabase: SupabaseClient,
): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id, tenant_id, code, name, type, parent_id, qbo_type, subtype, is_postable, notes, created_at, updated_at",
    )
    .limit(1000);
  if (error) throw error;
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    code: String(r.code),
    name: String(r.name),
    type: r.type as Account["type"],
    parent_id: (r.parent_id as string | null) ?? null,
    qbo_type: (r.qbo_type as string | null) ?? null,
    subtype: (r.subtype as string | null) ?? null,
    is_postable: Boolean(r.is_postable),
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
  return rows
    .filter(isCashAccount)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
