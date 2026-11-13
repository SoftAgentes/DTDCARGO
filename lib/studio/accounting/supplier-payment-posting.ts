/**
 * Asiento automático del pago al registrar una orden de pago (SDD-0044 · §5.2).
 *
 * Hermano de `receipt-posting.ts`. Cierra el saldo que la causación
 * (bill-posting.ts) dejó en 2.1.1 Cuentas por pagar. Al registrar un pago se
 * crea un asiento `asentado` con source='supplier_payment':
 *
 *   debe   2.1.1  Cuentas por pagar proveedores             = amountUsd
 *   haber  cash_account_id  (la caja/banco que pagó)        = amountUsd
 *
 * Reglas:
 *  - Idempotente por supplier_payment_id (no duplica si ya hay asiento vivo
 *    para la orden). Se guarda el `journal_entry_id` en la orden.
 *  - Corre con el cliente admin (service_role), igual que el audit log.
 *  - Best-effort: si algo falla, NO rompe el pago (el caller logea y sigue).
 *    Devuelve un resultado en vez de throwear.
 *  - El monto está en USD funcional. Si el pago entró en otra moneda, el
 *    equivalente USD se deriva con fx_rate (amount / fx_rate cuando fx_rate
 *    representa <moneda>/USD). Si no hay fx_rate, se usa el amount tal cual.
 */

import { usdOrNull } from "@/lib/shared/fx";
import { createAdminClient } from "@/lib/db/admin";

/** Cuenta de control de la CxP que se debita al pagar (SDD-0040 §5). */
export const PAYMENT_AP_CODE = "2.1.1"; // Cuentas por pagar proveedores (debe)

export type SupplierPaymentPostingInput = {
  tenantId: string;
  paymentId: string;
  paymentCode: string;
  /** Cuenta de caja/banco que pagó (haber). Debe ser postable. */
  cashAccountId: string;
  /** Monto de la orden en su moneda. */
  amount: number;
  /** Moneda de la orden. */
  currency: string;
  /** Tasa <moneda>/USD si la moneda no es USD (para derivar el equivalente). */
  fxRate?: number | null;
  /** Fecha del asiento (pago). YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type SupplierPaymentPostingResult = {
  ok: boolean;
  entryCode?: string;
  /** id del asiento creado (para guardarlo en la orden). */
  entryId?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, etc.). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deriva el monto USD funcional del pago. PURA — testeable sin DB.
 * - USD / USDT → el amount tal cual.
 * - otra moneda con fx_rate>0 → amount / fx_rate (fx_rate = <moneda>/USD).
 * - SDD-0572: sin tasa, null (antes, el monto tal cual).
 */
export function paymentAmountUsd(
  amount: number,
  currency: string,
  fxRate?: number | null,
): number | null {
  // SDD-0572: el conversor canónico. Sin tasa, null: el pago no se asienta (antes
  // se asentaba el nominal como si fueran dólares) y queda en «Por contabilizar».
  return usdOrNull(Number(amount) || 0, currency, fxRate);
}

/** Una línea del asiento del pago (debe XOR haber). */
export type SupplierPaymentLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento del pago. PURA — testeable sin DB.
 *
 *   DR  apAccountId    = amountUsd   (cancelación de la CxP, 2.1.1)
 *   CR  cashAccountId  = amountUsd   (salida de caja / banco)
 *
 * Por construcción siempre balancea (Σ debe == Σ haber == amountUsd).
 */
export function buildSupplierPaymentLines(
  apAccountId: string,
  cashAccountId: string,
  amountUsd: number,
): SupplierPaymentLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: apAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Cancelación de cuenta por pagar",
    },
    {
      account_id: cashAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Salida de caja / banco por pago",
    },
  ];
}

/**
 * Crea (idempotente) el asiento del pago de una orden. No throwea: devuelve
 * `{ ok, entryCode | entryId | skipped | error }`. El caller decide el log y
 * guarda el `entryId` en la orden.
 */
export async function postSupplierPaymentJournalEntry(
  input: SupplierPaymentPostingInput,
): Promise<SupplierPaymentPostingResult> {
  try {
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo para esta orden?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("supplier_payment_id", input.paymentId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = paymentAmountUsd(
      input.amount,
      input.currency,
      input.fxRate,
    );
    if (amountUsd === null) return { ok: false, skipped: "missing-fx-rate" };
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 2. Resolver la cuenta de control CxP (2.1.1) en el tenant.
    const { data: apRow, error: apErr } = await admin
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("code", PAYMENT_AP_CODE)
      .maybeSingle<{ id: string }>();
    if (apErr) return { ok: false, error: apErr.message };
    if (!apRow?.id) {
      // El CoA no está sembrado (falta 2.1.1). No bloqueamos el pago.
      return { ok: false, skipped: "missing-ap-account" };
    }

    // 3. Validar que la cuenta de caja pertenece al tenant y es postable.
    const { data: cashRow, error: cashErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("id", input.cashAccountId)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (cashErr) return { ok: false, error: cashErr.message };
    if (!cashRow?.id || !cashRow.is_postable) {
      return { ok: false, skipped: "missing-cash-account" };
    }

    // 4. Generar el entry_code atómico.
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: input.tenantId },
    );
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);
    const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);

    // 5. Insertar el asiento (asentado) + sus 2 líneas.
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Pago a proveedor ${input.paymentCode}`,
        status: "asentado",
        source: "supplier_payment",
        supplier_payment_id: input.paymentId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      return {
        ok: false,
        error: entryErr?.message ?? "no se pudo crear el asiento",
      };
    }

    const lines = buildSupplierPaymentLines(
      apRow.id,
      cashRow.id,
      amountUsd,
    ).map((l) => ({ ...l, entry_id: insertedEntry.id }));

    const { error: linesErr } = await admin.from("journal_lines").insert(lines);
    if (linesErr) {
      // Rollback manual del header (no hay transacción cross-statement acá).
      await admin.from("journal_entries").delete().eq("id", insertedEntry.id);
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode, entryId: insertedEntry.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Anula el asiento del pago (al anular la orden). Best-effort: marca el
 * asiento como 'anulado' (los saldos lo ignoran). No throwea.
 */
export async function voidSupplierPaymentJournalEntry(
  journalEntryId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("journal_entries")
      .update({ status: "anulado" })
      .eq("id", journalEntryId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
