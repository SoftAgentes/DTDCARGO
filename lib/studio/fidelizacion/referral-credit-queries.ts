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
 * Modo de reflejo contable del crédito de referido — LECTURA TOLERANTE (display).
 *
 * Para PINTAR el modo en la UI. Ante cualquier fallo cae al default y sigue: una
 * página no debe morir por no poder leer una etiqueta. Loguea para que el fallo
 * no sea invisible.
 *
 * ⚠️ NO usar en el camino de dinero: al tragarse el error no distingue "el tenant
 * no configuró" (default legítimo) de "no pude leer" (adivinar = asentar contra la
 * cuenta equivocada). Para asentar usá `requireReferralCreditMode`.
 */
export async function getReferralCreditMode(
  supabase: SupabaseClient,
): Promise<ReferralCreditMode> {
  // Sin tenantId: acá el client SIEMPRE es el del usuario logueado y la RLS de
  // fiscal_settings ya filtra por tenant. El camino de dinero no puede asumir eso
  // (ver requireReferralCreditMode).
  const res = await readCreditMode(supabase);
  if (!res.ok) {
    console.error("[getReferralCreditMode] degradando al default:", res.error);
    return DEFAULT_REFERRAL_CREDIT_MODE;
  }
  return res.mode;
}

export type ReferralCreditModeResult =
  | { ok: true; mode: ReferralCreditMode }
  | { ok: false; error: string };

/**
 * Lectura cruda del setting. `tenantId` opcional: si viene, filtra explícito en
 * vez de confiar en la RLS.
 */
async function readCreditMode(
  supabase: SupabaseClient,
  tenantId?: string,
): Promise<ReferralCreditModeResult> {
  let query = supabase.from("fiscal_settings").select("referral_credit_mode");
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.maybeSingle<{
    referral_credit_mode: string | null;
  }>();

  if (error) {
    return {
      ok: false,
      error: `No se pudo leer el modo fiscal del crédito (fiscal_settings): ${error.message}`,
    };
  }
  if (!data || data.referral_credit_mode == null) {
    return { ok: true, mode: DEFAULT_REFERRAL_CREDIT_MODE };
  }
  if (!isReferralCreditMode(data.referral_credit_mode)) {
    return {
      ok: false,
      error: `Modo fiscal no reconocido en fiscal_settings: "${data.referral_credit_mode}".`,
    };
  }
  return { ok: true, mode: data.referral_credit_mode };
}

/**
 * Modo de reflejo contable — LECTURA ESTRICTA (dinero). Falla CERRADO.
 *
 * Distingue los tres casos que la lectura tolerante confunde:
 *  - sin row / columna null → el tenant nunca configuró: default legítimo (ok).
 *  - error de lectura (RLS, columna faltante, timeout) → NO adivina (error).
 *  - valor no reconocido → alguien guardó basura: NO adivina (error).
 *
 * El porqué (SDD-0137): el default del código ('marketing_expense') coincide con
 * el de la columna, así que hoy adivinar parece gratis. Pero cuando el tenant
 * ponga 'commercial_discount', un fallo transitorio de esta lectura asentaría
 * contra 6.11 Publicidad y marketing en vez de 4.9 Descuentos sobre ventas: mismo
 * monto, cuenta equivocada, ingreso neto inflado, sin error visible. Preferimos
 * no acreditar antes que acreditar mal (el usuario reintenta; la plata mal
 * asentada no se nota hasta el cierre).
 *
 * `tenantId` es OBLIGATORIO acá, a diferencia de la lectura de display: el
 * posting (`postReferralCreditJournalEntry`) corre con service_role, que BYPASSA
 * la RLS. Confiar en el filtro implícito funcionaría hoy por accidente
 * (mono-tenant) y leería el tenant equivocado el día que no lo sea.
 */
export async function requireReferralCreditMode(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ReferralCreditModeResult> {
  return readCreditMode(supabase, tenantId);
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
