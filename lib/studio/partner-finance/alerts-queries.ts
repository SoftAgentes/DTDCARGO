/**
 * Alertas PP/CA del Socio China (SDD-0115 · Slice C3).
 *
 * Detector de CxP del tramo de socio (`bill_kind in ('pp','ca')`) VENCIDAS con
 * balance pendiente — el crédito comercial es 30-45 días, así que una PP/CA que
 * pasó su `due_date` con saldo es plata que se le debe al socio y nadie está
 * mirando.
 *
 * La alerta se DERIVA (no se persiste, decisión D2 del spec): query pura sobre
 * `supplier_bills` + builder testeable sin DB. Patrón espejo de
 * `buildPayablesQueue` (treasury). Reusa `billBalance`/`billBalanceToUsd`/
 * `daysOverdue` de treasury — fecha de corte por parámetro (sin `Date.now`
 * escondido en la lógica pura).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  billBalanceToUsd,
  daysOverdue,
} from "../treasury/bill-queries";
import { billBalance, type BillKind, type SupplierBill } from "../treasury/types";

/** Una CxP de socio (PP/CA) vencida con saldo, enriquecida para la alerta. */
export type PartnerBillAlert = {
  bill: SupplierBill;
  /** 'pp' | 'ca' (nunca 'full' — esas no son alerta de socio). */
  kind: Exclude<BillKind, "full">;
  /** Saldo pendiente en la moneda de la CxP. */
  balance: number;
  /** Saldo normalizado a USD real (misma convención que la cola de CxP). */
  balanceUsd: number;
  /** Días de atraso (>0; la lista sólo trae vencidas). */
  daysOverdue: number;
};

/**
 * Construye las alertas PP/CA a partir de un set de bills. PURA — testeable sin
 * DB. Sólo `bill_kind in ('pp','ca')`, status ≠ anulada, saldo > 0 y
 * `due_date < today`. Ordenadas por días de atraso desc (la más vieja arriba).
 */
export function buildPartnerBillAlerts(
  bills: SupplierBill[],
  today: string = new Date().toISOString().slice(0, 10),
): PartnerBillAlert[] {
  const out: PartnerBillAlert[] = [];
  for (const bill of bills) {
    if (bill.bill_kind !== "pp" && bill.bill_kind !== "ca") continue;
    if (bill.status === "anulada") continue;

    const balance = billBalance(bill);
    if (balance <= 0) continue;

    const days = daysOverdue(bill.due_date, today);
    if (days == null || days <= 0) continue; // sólo vencidas

    out.push({
      bill,
      kind: bill.bill_kind,
      balance,
      balanceUsd: billBalanceToUsd(balance, bill),
      daysOverdue: days,
    });
  }

  out.sort((a, b) => {
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.balance - a.balance;
  });
  return out;
}

const ALERT_BILL_COLUMNS =
  "id, tenant_id, bill_code, supplier_id, supplier_name, concept, expense_account_id, currency, fx_rate, total_amount, paid_amount, status, bill_kind, issue_date, due_date, reference, shipment_id, journal_entry_id, notes, created_at, updated_at, deleted_at";

/**
 * CxP de socio (PP/CA) vencidas con saldo pendiente del tenant. RLS por tenant.
 * Lee sólo las `bill_kind in ('pp','ca')` no anuladas y deriva la alerta con
 * `buildPartnerBillAlerts` (fecha de corte por parámetro).
 */
export async function listOverduePartnerBills(
  supabase: SupabaseClient,
  today: string = new Date().toISOString().slice(0, 10),
): Promise<PartnerBillAlert[]> {
  // Paginado: son las ALERTAS de vencimiento. Se ordenan por due_date, así
  // que lo que se perdía por el tope era la cola más lejana — que es la que
  // se vuelve urgente mañana.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("supplier_bills")
        .select(ALERT_BILL_COLUMNS)
        .in("bill_kind", ["pp", "ca"])
        .neq("status", "anulada")
        .is("deleted_at", null)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) throw new Error("Las alertas de vencimiento superan el tope de lectura.");

  const bills = ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceAlertBill,
  );
  return buildPartnerBillAlerts(bills, today);
}

/** Coacciona una fila cruda de supplier_bills (numeric→number). */
function coerceAlertBill(r: Record<string, unknown>): SupplierBill {
  const numOrNull = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    bill_code: String(r.bill_code),
    supplier_id: String(r.supplier_id),
    supplier_name: String(r.supplier_name ?? ""),
    concept: (r.concept as string | null) ?? null,
    expense_account_id: String(r.expense_account_id),
    currency: (r.currency as SupplierBill["currency"]) ?? "USD",
    fx_rate: numOrNull(r.fx_rate),
    total_amount: num(r.total_amount),
    paid_amount: num(r.paid_amount),
    status: (r.status as SupplierBill["status"]) ?? "pendiente",
    bill_kind: (r.bill_kind as SupplierBill["bill_kind"]) ?? "full",
    issue_date: String(r.issue_date),
    due_date: String(r.due_date),
    reference: (r.reference as string | null) ?? null,
    shipment_id: (r.shipment_id as string | null) ?? null,
    journal_entry_id: (r.journal_entry_id as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}
