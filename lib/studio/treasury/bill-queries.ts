import { fechaCaracas } from "@/lib/shared/fechas-caracas";
/**
 * Queries de CxP y pagos del módulo Tesorería (SDD-0044).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 *
 * La cola de CxP (`buildPayablesQueue`) se DERIVA de las CxP con saldo
 * (no es una tabla nueva): bills con `total_amount - paid_amount > 0` y
 * status ≠ anulada, enriquecidas con aging (días vencido) + stage derivado.
 *
 * Espejo de payment-queries.ts (Cobranzas). El stage acá es por estado de la
 * CxP (vencida/por_vencer/parcial/pagada), no por gestión.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type { Account } from "../account-types";
import { isCashAccount } from "../payment-queries";
import { invoiceUsdAmount } from "../fidelizacion/types";
import {
  billBalance,
  type SupplierBill,
  type SupplierPayment,
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

const BILL_COLUMNS =
  "id, tenant_id, bill_code, supplier_id, supplier_name, concept, expense_account_id, currency, fx_rate, total_amount, paid_amount, status, bill_kind, issue_date, due_date, reference, shipment_id, journal_entry_id, notes, created_at, updated_at, deleted_at";

const PAYMENT_COLUMNS =
  "id, tenant_id, payment_code, bill_id, supplier_id, supplier_name, amount, currency, fx_rate, method, cash_account_id, reference, paid_at, journal_entry_id, notes, created_at, deleted_at";

function coerceBill(row: Record<string, unknown>): SupplierBill {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    bill_code: String(row.bill_code),
    supplier_id: String(row.supplier_id),
    supplier_name: String(row.supplier_name ?? ""),
    concept: (row.concept as string | null) ?? null,
    expense_account_id: String(row.expense_account_id),
    currency: (row.currency as SupplierBill["currency"]) ?? "USD",
    fx_rate: numOrNull(row.fx_rate),
    total_amount: num(row.total_amount),
    paid_amount: num(row.paid_amount),
    status: (row.status as SupplierBill["status"]) ?? "pendiente",
    bill_kind: (row.bill_kind as SupplierBill["bill_kind"]) ?? "full",
    issue_date: String(row.issue_date),
    due_date: String(row.due_date),
    reference: (row.reference as string | null) ?? null,
    shipment_id: (row.shipment_id as string | null) ?? null,
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

function coercePayment(row: Record<string, unknown>): SupplierPayment {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    payment_code: String(row.payment_code),
    bill_id: String(row.bill_id),
    supplier_id: String(row.supplier_id),
    supplier_name: String(row.supplier_name ?? ""),
    amount: num(row.amount),
    currency: (row.currency as SupplierPayment["currency"]) ?? "USD",
    fx_rate: numOrNull(row.fx_rate),
    method: String(row.method ?? "transferencia"),
    cash_account_id: String(row.cash_account_id),
    reference: (row.reference as string | null) ?? null,
    paid_at: String(row.paid_at),
    journal_entry_id: (row.journal_entry_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

// ── Bills ─────────────────────────────────────────────────────

/**
 * Lista las CxP vivas del tenant, opcionalmente de un proveedor.
 *
 * Sin borradas (SDD-0494): anular una CxP es `status = 'anulada'` (la 0294), y
 * eso ya lo descarta `buildPayablesQueue`; pero `deleted_at` es OTRA marca, que
 * la RLS dejó de filtrar en la 0230 y que la propia base trata como la de
 * liveness (`sp_tenant_bill_idx ... where deleted_at is null`, 0088; y el
 * preflight de `register_supplier_payment_order` la rechaza igual que a una
 * anulada, 0468). Sin este `.is`, una CxP borrada entra a la cola y suma en el
 * KPI «Por pagar» — lo destapó el fixture de regresión de esta tarea.
 */
export async function listBills(
  supabase: SupabaseClient,
  opts: { supplierId?: string } = {},
): Promise<SupplierBill[]> {
  // Paginado: es la cola de PAGOS a proveedor, ordenada por vencimiento —
  // lo que se perdía por el tope era justo lo que vence después.
  const pagina = (d: number, h: number) => {
    let q = supabase
      .from("supplier_bills")
      .select(BILL_COLUMNS)
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (opts.supplierId) q = q.eq("supplier_id", opts.supplierId);
    return q.range(d, h);
  };
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(pagina);
  if (!complete) {
    throw new Error("Las facturas de proveedor superan el tope de lectura; filtra por proveedor.");
  }
  return data.map(coerceBill);
}

/** Lee una CxP por id. null si no existe (o RLS la oculta). */
export async function getBill(
  supabase: SupabaseClient,
  id: string,
): Promise<SupplierBill | null> {
  const { data, error } = await supabase
    .from("supplier_bills")
    .select(BILL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? coerceBill(data as Record<string, unknown>) : null;
}

/**
 * Lista las órdenes de pago vivas del tenant, opcionalmente de una CxP.
 *
 * Sin anuladas (SDD-0494): anular una orden es ponerle `deleted_at`
 * (`void_supplier_payment_order`, 0468) —`supplier_payments` no tiene columna
 * de estado— y la RLS no la oculta (0230 sacó ese filtro del USING). Sin este
 * `.is`, la orden revertida seguía en el tab «Pagos», en el historial del
 * drawer de su CxP y sumando en el KPI de pagado, que es el mismo listado.
 */
export async function listPayments(
  supabase: SupabaseClient,
  opts: { billId?: string } = {},
): Promise<SupplierPayment[]> {
  let query = supabase
    .from("supplier_payments")
    .select(PAYMENT_COLUMNS)
    .is("deleted_at", null)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (opts.billId) query = query.eq("bill_id", opts.billId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(coercePayment);
}

// ── Cola de CxP (derivada) ─────────────────────────────────────

/** Stage derivado de la cola de CxP. NO se persiste — se deriva del saldo + vencimiento. */
export type PayableStage = "vencida" | "por_vencer" | "parcial" | "pagada";

/** Una CxP con saldo en la cola, enriquecida. */
export type Payable = {
  bill: SupplierBill;
  /** Saldo pendiente (total − pagado), en la MONEDA DE OPERACIÓN de la CxP. */
  balance: number;
  /**
   * Saldo pendiente normalizado a USD (decisión SDD-0052 r2): USD/USDT → 1:1 ·
   * VES → /fx_rate (si fx_rate>0, sino 0) · CNY → 0. Misma normalización que
   * `invoiceUsdAmount`. Para sumar/bucketizar aging y KPIs en USD real.
   */
  /** SDD-0572: null sin tasa (no suma; los KPIs lo cuentan en `cxpSinTasa`). */
  balanceUsd: number | null;
  /** Días vencido (>0 = vencido, <0 = faltan, 0 = vence hoy). null sin due_date. */
  daysOverdue: number | null;
  /** Stage derivado para la cola. */
  stage: PayableStage;
};

/** Días entre `due_date` y hoy (positivo = vencido). null si no hay due_date. */
export function daysOverdue(
  dueDate: string | null,
  today: string = fechaCaracas(),
): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00Z").getTime();
  const now = new Date(today + "T00:00:00Z").getTime();
  return Math.round((now - due) / 86400000);
}

/**
 * Normaliza un saldo de CxP (en la moneda de la bill) a USD, con la MISMA
 * convención que `invoiceUsdAmount` (decisión SDD-0052 r2): USD/USDT → 1:1 ·
 * VES → /fx_rate (si fx_rate>0, sino 0) · CNY → 0. PURA.
 */
export function billBalanceToUsd(
  balance: number,
  bill: Pick<SupplierBill, "currency" | "fx_rate">,
): number | null {
  return invoiceUsdAmount({
    currency: bill.currency,
    total_amount: balance,
    fx_rate: bill.fx_rate,
  });
}

/**
 * Deriva el stage de una CxP. PURA — testeable sin DB.
 *
 * Prioridad:
 *  - pagada: saldo ≤ 0.
 *  - vencida: due_date < hoy con saldo.
 *  - parcial: 0 < paid < total y no vencida.
 *  - por_vencer: tiene saldo, no vencida, sin pagos.
 */
export function derivedStage(args: {
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  today?: string;
}): PayableStage {
  const today = args.today ?? fechaCaracas();
  if (round2(args.balance) <= 0) return "pagada";

  const overdue = !!args.dueDate && args.dueDate < today;
  if (overdue) return "vencida";

  if (round2(args.paidAmount) > 0) return "parcial";
  return "por_vencer";
}

/**
 * Enriquece UNA CxP con saldo, aging y stage. PURA — testeable sin DB.
 *
 * NO filtra: quién entra lo decide el llamador. `buildPayablesQueue` descarta
 * anuladas y saldadas porque es una COLA de pagos; `payableForBill` no descarta
 * nada porque es una CONSULTA de un documento concreto (SDD-0494). Sacarlo a
 * una función es lo que impide que las dos lecturas deriven distinto el stage.
 */
export function buildPayable(
  bill: SupplierBill,
  today: string = fechaCaracas(),
): Payable {
  const balance = billBalance(bill);
  return {
    bill,
    balance,
    balanceUsd: (() => {
      const usd = billBalanceToUsd(balance, bill);
      return usd === null ? null : round2(usd);
    })(),
    daysOverdue: daysOverdue(bill.due_date, today),
    stage: derivedStage({
      totalAmount: bill.total_amount,
      paidAmount: bill.paid_amount,
      balance,
      dueDate: bill.due_date,
      today,
    }),
  };
}

/**
 * Construye la cola de CxP a partir de un set de bills. PURA — testeable sin DB.
 *
 * Solo CxP con saldo > 0 y status ≠ anulada. Ordenadas por días vencido
 * descendente (las más atrasadas arriba), luego por saldo descendente.
 */
export function buildPayablesQueue(
  bills: SupplierBill[],
  today: string = fechaCaracas(),
): Payable[] {
  const out: Payable[] = [];
  for (const bill of bills) {
    if (bill.status === "anulada") continue;
    const balance = billBalance(bill);
    if (balance <= 0) continue;

    out.push(buildPayable(bill, today));
  }

  out.sort((a, b) => {
    const da = a.daysOverdue ?? -99999;
    const db = b.daysOverdue ?? -99999;
    if (da !== db) return db - da;
    return b.balance - a.balance;
  });
  return out;
}

/** Cola de cuentas por pagar del tenant: CxP con saldo, enriquecidas con aging. */
export async function payablesQueue(
  supabase: SupabaseClient,
  today: string = fechaCaracas(),
): Promise<Payable[]> {
  const bills = await listBills(supabase);
  return buildPayablesQueue(bills, today);
}

/**
 * Una CxP por id como `Payable`, TENGA O NO SALDO (SDD-0494).
 *
 * El drawer de la CxP es el único lugar del Studio donde se anula una orden de
 * pago, y solo se abría desde la cola — que descarta las CxP saldadas. Una
 * orden que saldaba su CxP quedaba así fuera de alcance: si el pago se devolvía
 * después, no había camino en la UI para revertirlo. Esta lectura es la puerta
 * de consulta desde el tab «Pagos».
 *
 * No filtra por saldo ni por status a propósito: el drawer ya decide qué
 * acciones ofrece (registrar pago pide saldo > 0; anular la CxP pide pagado 0),
 * así que una CxP saldada o anulada se abre en consulta con su historial.
 *
 * null si no existe, si la RLS la oculta o si está borrada.
 */
export async function payableForBill(
  supabase: SupabaseClient,
  billId: string,
  today: string = fechaCaracas(),
): Promise<Payable | null> {
  const id = String(billId ?? "").trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("supplier_bills")
    .select(BILL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return buildPayable(coerceBill(data as Record<string, unknown>), today);
}

// ── KPIs ───────────────────────────────────────────────────────

export type TreasuryKpis = {
  /** Saldo total por pagar, en MONEDA DE OPERACIÓN sumada (multi-moneda · vista Tesorería). */
  porPagar: number;
  /** Saldo de las vencidas (moneda de operación sumada). */
  vencido: number;
  /**
   * Saldo total por pagar normalizado a USD real (decisión SDD-0052 r2). Suma
   * `balanceUsd` por documento — apto para cruzar con CxC/Dirección/Reportes.
   */
  porPagarUsd: number;
  /** Saldo vencido normalizado a USD real. */
  vencidoUsd: number;
  /** SDD-0572: CxP sin tasa, fuera de `porPagarUsd` y `vencidoUsd`. */
  cxpSinTasa: number;
  /** Total pagado en el mes en curso (de las órdenes de pago vivas). */
  pagadoMes: number;
  /** Cantidad de proveedores con CxP con saldo. */
  proveedoresActivos: number;
};

/**
 * Computa KPIs a partir de la cola + los pagos del mes. PURA — testeable sin DB.
 * `payments` ya viene filtrado a pagos vivos; el mes se deriva de `today`.
 */
export function computeTreasuryKpis(
  queue: Payable[],
  payments: Pick<SupplierPayment, "amount" | "paid_at">[] = [],
  today: string = fechaCaracas(),
): TreasuryKpis {
  let porPagar = 0;
  let vencido = 0;
  let porPagarUsd = 0;
  let vencidoUsd = 0;
  let cxpSinTasa = 0;
  const suppliers = new Set<string>();
  for (const p of queue) {
    porPagar += p.balance;
    if (p.balanceUsd === null) cxpSinTasa += 1;
    else porPagarUsd += p.balanceUsd;
    if (p.stage === "vencida") {
      vencido += p.balance;
      if (p.balanceUsd !== null) vencidoUsd += p.balanceUsd;
    }
    suppliers.add(p.bill.supplier_id);
  }

  const month = today.slice(0, 7); // YYYY-MM
  let pagadoMes = 0;
  for (const pay of payments) {
    if ((pay.paid_at ?? "").slice(0, 7) === month) {
      pagadoMes += Number(pay.amount) || 0;
    }
  }

  return {
    porPagar: round2(porPagar),
    vencido: round2(vencido),
    porPagarUsd: round2(porPagarUsd),
    vencidoUsd: round2(vencidoUsd),
    pagadoMes: round2(pagadoMes),
    proveedoresActivos: suppliers.size,
    cxpSinTasa,
  };
}

/** KPIs de tesorería del tenant (deriva de la cola + pagos del mes). */
export async function treasuryKpis(
  supabase: SupabaseClient,
  today: string = fechaCaracas(),
): Promise<TreasuryKpis> {
  const [queue, payments] = await Promise.all([
    payablesQueue(supabase, today),
    listPayments(supabase),
  ]);
  return computeTreasuryKpis(queue, payments, today);
}

// ── Cuentas (selects del drawer) ───────────────────────────────

/**
 * ¿Es una cuenta válida para imputar el costo/gasto de una CxP? Cuenta
 * postable de tipo costo de ventas / gasto: `qbo_type` en
 * ('Cost of Goods Sold','Expense','Other Expense') o code que empieza con
 * `5.` / `6.`. PURA.
 */
export function isExpenseAccount(
  acct: Pick<Account, "code" | "qbo_type" | "is_postable">,
): boolean {
  if (!acct.is_postable) return false;
  if (
    acct.qbo_type === "Cost of Goods Sold" ||
    acct.qbo_type === "Expense" ||
    acct.qbo_type === "Other Expense"
  ) {
    return true;
  }
  return acct.code.startsWith("5.") || acct.code.startsWith("6.");
}

const ACCOUNT_COLUMNS =
  "id, tenant_id, code, name, type, parent_id, qbo_type, subtype, is_postable, notes, created_at, updated_at";

function coerceAccount(r: Record<string, unknown>): Account {
  return {
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
  };
}

async function listAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .limit(1000);
  if (error) throw error;
  return data.map(coerceAccount);
}

/** Lista las cuentas de costo/gasto postables del tenant (para el select de CxP). */
export async function listExpenseAccounts(
  supabase: SupabaseClient,
): Promise<Account[]> {
  const accounts = await listAccounts(supabase);
  return accounts
    .filter(isExpenseAccount)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/** Lista las cuentas de caja/banco postables del tenant (para el select del pago). */
export async function listCashAccounts(
  supabase: SupabaseClient,
): Promise<Account[]> {
  const accounts = await listAccounts(supabase);
  return accounts
    .filter(isCashAccount)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}
