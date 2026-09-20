/**
 * Queries del CRÉDITO DE REFERIDO aplicado (SDD-0137 · Opción A).
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 *
 * ⚠️ Acá NO se lee `fiscal_settings`. El cordón con el módulo Fiscal se cortó
 * (decisión del founder 2026-07-15): la clasificación contable del premio es FIJA
 * (descuento sobre la venta) y vive en `accounting/referral-credit-modes`.
 *
 *  - `applicableInvoicesForReferrer`: facturas del referidor a las que se le
 *    puede aplicar el crédito (billable, USD/USDT, saldo ≥ crédito, POSTERIORES al
 *    crédito). El picker de la UI (solo rol dinero) las usa; VES/CNY → V2.
 *  - `isPurchaseAfterCredit` / `toCalendarDay`: la regla "solo compra nueva".
 *  - `strandedReferralCredits` / `strandedCreditsForInvoice` (SDD-0495): los
 *    créditos que quedaron 'aplicado' colgando de una factura ANULADA porque la
 *    reversión de `voidInvoice` no pudo hacerse. Son las dos mitades del mismo
 *    hecho, separadas a propósito por el rol que las lee (ver abajo).
 *
 * Supabase devuelve `numeric` como string → se coerce a number en cada lectura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

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
 *  - factura billable (ver CREDIT_APPLICABLE_INVOICE_STATUSES) y NO borrada
 *    (`deleted_at`, SDD-0465): un crédito aplicado a una factura eliminada
 *    bajaría una CxC que ningún lector muestra.
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
    .is("deleted_at", null)
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

// ── Créditos varados: 'aplicado' sobre una factura ANULADA (SDD-0495) ─────────

/**
 * Por qué esto se CONSULTA y no se guarda en ninguna parte.
 *
 * Al anular una factura, `voidInvoice` manda a revertir los créditos de referido
 * que tenía aplicados (SDD-0137 §3.6, reforzada por la SDD-0490). La reversión
 * es best-effort a propósito: si falla, la anulación NO se deshace. Hasta la
 * SDD-0495 su único rastro era un `console.error`, así que el crédito quedaba
 * 'aplicado' apuntando a una factura anulada — para el sistema, consumido; para
 * el referidor, perdido; para el Studio, invisible.
 *
 * El estado inconsistente es CONSULTABLE tal cual: «un referido 'aplicado',
 * vivo, cuyo `applied_invoice_id` apunta a una factura 'anulada'». Por eso la
 * SDD-0495 no lleva migración. Una bandera persistida sería una segunda verdad
 * que se puede desincronizar de la primera (y que habría que escribir
 * justo cuando algo ya está fallando); derivarla no puede mentir y además
 * alcanza a los casos anteriores a este cambio.
 *
 * Son DOS funciones y no una porque los roles que las miran NO se solapan
 * (matriz de `rbac.ts`): `invoices` es accounting (+admin) y `fidelizacion` es
 * commercial/support (+admin). Quien anula la factura no puede abrir
 * Fidelización; quien lleva el programa de referidos no puede abrir la factura.
 * Cada mitad proyecta SÓLO lo que el rol que la lee ya maneja: la de
 * Fidelización no devuelve el código de la factura (dato del módulo de dinero) y
 * la de facturación no devuelve al referidor ni al referido. El handle común es
 * el `referral_code`, que es lo que los dos lados necesitan para nombrar el
 * mismo caso al hablarse.
 *
 * Las dos lecturas caen sobre índices que ya existen: `(tenant_id, status)
 * where deleted_at is null` (migr 0098) y `(applied_invoice_id)` (migr 0237).
 */

/** Un crédito varado, como lo ve FIDELIZACIÓN. Sin datos de la factura. */
export type StrandedReferralCredit = {
  referralId: string;
  referralCode: string;
  referrerMarkbox: string;
  referredName: string;
  rewardUsd: number;
};

export type StrandedReferralCredits = {
  credits: StrandedReferralCredit[];
  /**
   * `false` = alguna de las dos lecturas se quedó corta (ver `fetchAllPaged`):
   * los que están son reales, pero puede haber más. La pantalla lo dice en vez
   * de presentar el conteo como si fuera el total.
   */
  complete: boolean;
};

/**
 * Todos los créditos varados del tenant (RLS filtra). Para el aviso durable de
 * Fidelización.
 *
 * Dos lecturas en vez de un embebido de PostgREST: el filtro sobre un recurso
 * embebido exige `!inner` y un hint de relación, y ese hint deja de resolver en
 * silencio si mañana aparece una segunda FK de `referrals` a `invoices` — el
 * aviso se apagaría solo y nadie lo notaría, que es exactamente el modo de falla
 * que esta spec vino a cerrar.
 *
 * `opts` es el mismo de `fetchAllPaged` y va a las dos lecturas. En producción
 * no se pasa; existe para poder ejercitar el camino truncado (`complete: false`)
 * sin fabricar las 60.000 filas que harían falta con los topes por defecto — un
 * camino que si no se prueba es justo el que devuelve un conteo con cara de
 * total.
 */
export async function strandedReferralCredits(
  supabase: SupabaseClient,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<StrandedReferralCredits> {
  const { rows, complete } = await fetchAllPaged<Record<string, unknown>>(
    (from, to) =>
      supabase
        .from("referrals")
        .select(
          "id, referral_code, referrer_markbox, referred_name, reward_usd, applied_invoice_id",
        )
        .eq("status", "aplicado")
        .is("deleted_at", null)
        .not("applied_invoice_id", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
    opts,
  );

  // Agrupar por factura: una misma factura anulada puede tener más de un
  // crédito varado, y los ids se consultan una sola vez.
  const byInvoice = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const invoiceId = String(r.applied_invoice_id ?? "");
    if (!invoiceId) continue;
    const list = byInvoice.get(invoiceId);
    if (list) list.push(r);
    else byInvoice.set(invoiceId, [r]);
  }
  if (byInvoice.size === 0) return { credits: [], complete };

  const { rows: voided, complete: voidedComplete } = await fetchAllByIds<{
    id: string;
  }>(
    [...byInvoice.keys()],
    (lote, from, to) =>
      supabase
        .from("invoices")
        .select("id")
        .in("id", lote)
        .eq("status", "anulada")
        .order("id", { ascending: true })
        .range(from, to),
    opts,
  );

  const credits: StrandedReferralCredit[] = [];
  for (const inv of voided) {
    for (const r of byInvoice.get(String(inv.id)) ?? []) {
      credits.push({
        referralId: String(r.id ?? ""),
        referralCode: String(r.referral_code ?? ""),
        referrerMarkbox: String(r.referrer_markbox ?? ""),
        referredName: String(r.referred_name ?? ""),
        rewardUsd: Number(r.reward_usd) || 0,
      });
    }
  }
  // Orden estable por código: el aviso no cambia de forma entre dos cargas.
  credits.sort((a, b) => a.referralCode.localeCompare(b.referralCode));
  // `voidedComplete` es, con los topes por defecto, siempre `true`: un lote de
  // `fetchAllByIds` trae como mucho 500 ids y 500 filas caben de sobra en una
  // página de 1.000, así que la segunda lectura no puede quedarse corta. Ningún
  // fixture lo puede distinguir —`opts` va a las dos lecturas y la de facturas
  // nunca tiene más filas que la de referidos—, así que el mutante que lo borra
  // SOBREVIVE y está documentado como tal en el handoff. Se conserva igual
  // porque `fetchAllByIds` devuelve el campo y tirarlo al piso es exactamente el
  // error que `lib/db/paginate.ts` describe: si mañana sube `idsPerBatch` o la
  // query cambia de forma, el `&&` ya está puesto.
  return { credits, complete: complete && voidedComplete };
}

/** Un crédito varado, como lo ve FACTURACIÓN. Sin datos del referido. */
export type StrandedCreditOnInvoice = {
  referralId: string;
  referralCode: string;
  rewardUsd: number;
};

/**
 * Créditos que siguen 'aplicado' sobre ESTA factura.
 *
 * Llamarla sólo con una factura ANULADA: sobre una factura viva el mismo
 * resultado es el estado NORMAL (el crédito está aplicado porque se aplicó), no
 * una anomalía. La condición de anulada la pone el llamador porque ya tiene el
 * estado leído; repetir acá la lectura de `invoices` sería un round-trip de más
 * para volver a saber lo mismo.
 */
export async function strandedCreditsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<StrandedCreditOnInvoice[]> {
  if (!invoiceId) return [];
  const { data, error } = await supabase
    .from("referrals")
    .select("id, referral_code, reward_usd")
    .eq("applied_invoice_id", invoiceId)
    .eq("status", "aplicado")
    .is("deleted_at", null)
    .order("referral_code", { ascending: true })
    .limit(50);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    (r): StrandedCreditOnInvoice => ({
      referralId: String(r.id ?? ""),
      referralCode: String(r.referral_code ?? ""),
      rewardUsd: Number(r.reward_usd) || 0,
    }),
  );
}
