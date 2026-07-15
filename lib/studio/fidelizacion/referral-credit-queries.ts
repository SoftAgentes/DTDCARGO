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

/**
 * Estados de factura a los que se puede aplicar un crédito (no borrador/anulada/
 * pagada). FUENTE ÚNICA: la usan el picker (acá) y el gate de la action.
 *
 * 'vencida' está en la lista pero en la práctica NUNCA matchea: es un estado
 * DERIVADO para pintar (`displayStatus()` en invoice-types, comparando due_date
 * contra hoy), no un valor que se guarde — los status reales en la columna son
 * borrador/emitida/parcial/pagada/anulada (verificado en prod 2026-07-15). Se deja
 * por si algún día se materializa: sacarlo volvería INAPLICABLE el crédito sobre
 * una compra nueva que se venció esperando, y eso no es lo que la regla pide (la
 * regla es "compra nueva", no "compra al día" → la fuerza `notBefore`, abajo).
 */
export const CREDIT_APPLICABLE_INVOICE_STATUSES: InvoiceStatus[] = [
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
 * Normaliza cualquier marca temporal a día calendario `YYYY-MM-DD`.
 *
 * Existe porque los dos lados de la regla tienen TIPOS DISTINTOS:
 *   · `invoices.issued_at`      es `date`        → PostgREST manda "2026-07-01"
 *   · `referrals.accredited_at` es `timestamptz` → PostgREST manda "2026-07-01T00:00:00+00:00"
 * Compararlos como strings crudos MIENTE: "2026-07-01" < "2026-07-01T00:00:00+00:00"
 * es `true` (el más corto es prefijo → menor), así que una factura emitida el MISMO
 * día en que se acreditó el crédito se rechazaría siendo legítima. Recortando ambos
 * a día, la comparación lexicográfica de ISO-8601 sí equivale a la cronológica.
 *
 * Granularidad DÍA a propósito: issued_at no tiene hora (se setea con
 * `toISOString().slice(0,10)`), así que el día es la única precisión real.
 */
export function toCalendarDay(v: string | null | undefined): string | null {
  if (!v) return null;
  // Se parsea y se re-serializa en UTC en vez de recortar el string crudo: el
  // offset con que PostgREST serializa un timestamptz NO es propiedad del tipo,
  // sale del TimeZone del rol (hoy UTC por default de Supabase). Si alguien pusiera
  // el rol en America/Caracas, accredited_at llegaría "2026-06-01T22:00:00-04:00"
  // (= 2026-06-02 UTC) y un slice daría el día VE, mientras issued_at sigue en día
  // UTC (se escribe con toISOString().slice(0,10)) → los dos lados en husos
  // distintos y la regla corrida un día, en silencio. Con Date el `date` desnudo
  // ("2026-07-01") también se lee como medianoche UTC → mismo resultado.
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * ¿La factura es una COMPRA NUEVA respecto del crédito? Regla del founder
 * (2026-07-15): el crédito es un descuento sobre la próxima compra, NO un abono
 * contra deuda que ya existía cuando el crédito nació.
 *
 * FUENTE ÚNICA de la regla: la usan el picker y el gate de la action. Que vivan
 * separadas fue un bug real — el picker (SQL) ofrecía facturas que la action (JS)
 * rechazaba, dejando al operador en un callejón sin salida.
 *
 * Fail-closed: sin fecha de emisión o sin fecha de acreditación no se puede PROBAR
 * que sea posterior → no es elegible. Es dinero: ante la duda, no.
 */
export function isPurchaseAfterCredit(
  issuedAt: string | null | undefined,
  accreditedAt: string | null | undefined,
): boolean {
  const issued = toCalendarDay(issuedAt);
  const accredited = toCalendarDay(accreditedAt);
  if (!issued || !accredited) return false;
  return issued >= accredited;
}

/**
 * Facturas del REFERIDOR (por MARKBOX) a las que se puede aplicar un crédito de
 * `minTotalUsd`. Reglas:
 *  - factura billable (ver CREDIT_APPLICABLE_INVOICE_STATUSES).
 *  - **COMPRA NUEVA**: emitida en o después del día en que se acreditó el crédito
 *    (`accreditedAt`). Regla del founder: no es un abono contra deuda vieja.
 *  - moneda USD/USDT (el crédito es $80 USD; VES/CNY → fx, fuera de V1).
 *  - SALDO (total − pagado) ≥ crédito. OJO: se valida contra el saldo REAL, no
 *    el total — una 'parcial' con paid_amount alto puede tener saldo < crédito y
 *    aplicarle el $80 dejaría la CxC negativa (over-credit, hueco A). El crédito
 *    entero se aplica solo a facturas con saldo suficiente; parcial = V2.
 * Orden: la más ANTIGUA primero dentro de las elegibles — todas son posteriores al
 * crédito, así que "más antigua" = la primera compra nueva, que es la que la regla
 * quiere descontar.
 *
 * @param accreditedAt `referrals.accredited_at` (migr 0238) — cuándo NACIÓ el
 *   crédito. NO usar created_at (cuándo se registró el referido: deja pasar deuda
 *   vieja) ni updated_at (lo pisa cualquier UPDATE). Sin él → [] (fail-closed).
 */
export async function applicableInvoicesForReferrer(
  supabase: SupabaseClient,
  referrerMarkbox: string,
  minTotalUsd: number,
  accreditedAt: string | null,
): Promise<ApplicableInvoice[]> {
  if (!referrerMarkbox) return [];
  const notBefore = toCalendarDay(accreditedAt);
  if (!notBefore) return [];
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_code, client_markbox, currency, total_amount, paid_amount, status, issued_at")
    .eq("client_markbox", referrerMarkbox)
    .in("status", CREDIT_APPLICABLE_INVOICE_STATUSES)
    .in("currency", ["USD", "USDT"])
    // `notBefore` ya es YYYY-MM-DD → Postgres lo coerce a `date` contra issued_at
    // (date), misma semántica que isPurchaseAfterCredit. Mandar el timestamptz
    // crudo acá era lo que hacía divergir al picker de la action.
    .gte("issued_at", notBefore)
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
    // Post-filtro con el MISMO helper que usa la action. El .gte() de arriba ya
    // acota en la DB (barato, aprovecha el índice), pero eso es la regla
    // REIMPLEMENTADA en SQL: convergen por coincidencia de semántica, no por
    // construcción. Pasar el resultado por el helper hace que "fuente única" sea
    // literal — si las dos alguna vez discrepan, gana el helper y el picker jamás
    // ofrece algo que la action vaya a rechazar (el callejón sin salida de la UI).
    .filter((inv) => isPurchaseAfterCredit(inv.issued_at, accreditedAt))
    .filter((inv) => inv.balance >= min);
}
