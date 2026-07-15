/**
 * Queries del CRÉDITO DE REFERIDO aplicado (SDD-0137 · Opción A).
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 * Dos piezas:
 *  - `getReferralCreditMode`: lee el setting per-tenant que decide cómo se
 *    asienta el crédito (fiscal_settings.referral_credit_mode, migr 0237).
 *    Default 'marketing_expense' si el tenant aún no guardó config fiscal.
 *  - `applicableInvoicesForReferrer`: facturas del referidor a las que se le
 *    puede aplicar el crédito (billable, USD/USDT, total ≥ crédito). El picker
 *    de la UI (solo rol dinero) las usa; VES/CNY quedan fuera en V1 (fx → V2).
 *
 * Supabase devuelve `numeric` como string → se coerce a number en cada lectura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_REFERRAL_CREDIT_MODE,
  isReferralCreditMode,
  type ReferralCreditMode,
} from "@/lib/studio/accounting/referral-credit-posting";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

/**
 * Modo de reflejo contable del crédito de referido del tenant logueado.
 * Lee fiscal_settings.referral_credit_mode (singleton per-tenant, RLS). Cae al
 * default 'marketing_expense' si no hay row o el valor es inválido.
 */
export async function getReferralCreditMode(
  supabase: SupabaseClient,
): Promise<ReferralCreditMode> {
  const { data, error } = await supabase
    .from("fiscal_settings")
    .select("referral_credit_mode")
    .maybeSingle<{ referral_credit_mode: string | null }>();
  if (error || !data) return DEFAULT_REFERRAL_CREDIT_MODE;
  return isReferralCreditMode(data.referral_credit_mode)
    ? data.referral_credit_mode
    : DEFAULT_REFERRAL_CREDIT_MODE;
}

/** Estados de factura "billable" (se le puede aplicar un crédito). */
const BILLABLE_STATUSES: InvoiceStatus[] = [
  "emitida",
  "parcial",
  "vencida",
];

export type ApplicableInvoice = {
  id: string;
  invoice_code: string;
  currency: InvoiceCurrency;
  total_amount: number;
  /** Ya pagado (subledger). El crédito se valida contra el SALDO, no el total. */
  paid_amount: number;
  /** Saldo pendiente real = total_amount − paid_amount. */
  balance: number;
  status: InvoiceStatus;
  issued_at: string | null;
};

/**
 * Facturas del REFERIDOR (por MARKBOX) a las que se puede aplicar un crédito de
 * `minTotalUsd`. Reglas V1 (§3.4):
 *  - factura billable (emitida/parcial/vencida; no borrador/anulada/pagada).
 *  - moneda USD/USDT (el crédito es $80 USD; VES/CNY → fx, fuera de V1).
 *  - SALDO (total − pagado) ≥ crédito. OJO: se valida contra el saldo REAL, no
 *    el total — una 'parcial' con paid_amount alto puede tener saldo < crédito y
 *    aplicarle el $80 dejaría la CxC negativa (over-credit, hueco A). El crédito
 *    entero se aplica solo a facturas con saldo suficiente; parcial = V2.
 * Orden: la más antigua primero (se aplica a la deuda más vieja).
 */
export async function applicableInvoicesForReferrer(
  supabase: SupabaseClient,
  referrerMarkbox: string,
  minTotalUsd: number,
): Promise<ApplicableInvoice[]> {
  if (!referrerMarkbox) return [];
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_code, client_markbox, currency, total_amount, paid_amount, status, issued_at")
    .eq("client_markbox", referrerMarkbox)
    .in("status", BILLABLE_STATUSES)
    .in("currency", ["USD", "USDT"])
    .order("issued_at", { ascending: true })
    .limit(200);

  if (error) throw error;

  const min = Number(minTotalUsd) || 0;
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map((r): ApplicableInvoice => {
      const total = Number(r.total_amount) || 0;
      const paid = Number(r.paid_amount) || 0;
      return {
        id: String(r.id ?? ""),
        invoice_code: String(r.invoice_code ?? ""),
        currency: r.currency as InvoiceCurrency,
        total_amount: total,
        paid_amount: paid,
        balance: Math.round((total - paid + Number.EPSILON) * 100) / 100,
        status: r.status as InvoiceStatus,
        issued_at: (r.issued_at as string | null) ?? null,
      };
    })
    .filter((inv) => inv.balance >= min);
}
