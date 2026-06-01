/**
 * Asiento automático del cobro al registrar un recibo de pago (SDD-0041 · §5.2).
 *
 * Hermano de `invoice-posting.ts`. Cierra el ciclo iniciado por el asiento de
 * emisión de SDD-0040 (que dejó el saldo en Clientes 1.1.2). Al registrar un
 * cobro se crea un asiento `asentado` con source='receipt':
 *
 *   debe   cash_account_id  (la caja/banco que recibió)   = amountUsd
 *   haber  1.1.2  Cuentas por cobrar clientes              = amountUsd
 *
 * Reglas:
 *  - Idempotente por receipt_id (no duplica si ya hay asiento vivo para el
 *    recibo). Se guarda el `journal_entry_id` en el recibo.
 *  - Corre con el cliente admin (service_role), igual que el audit log.
 *  - Best-effort: si algo falla, NO rompe el cobro (el caller logea y sigue).
 *    Devuelve un resultado en vez de throwear.
 *  - El monto del asiento está en USD funcional. Si el cobro entró en otra
 *    moneda, el equivalente USD se deriva con fx_rate (amount / fx_rate cuando
 *    fx_rate representa <moneda>/USD, p.ej. VES/USD). Si no hay fx_rate, se usa
 *    el amount tal cual (cobro en USD).
 */

import { createAdminClient } from "@/lib/db/admin";

/** Cuenta destino del crédito del cobro (CxC clientes, SDD-0040 §5). */
export const RECEIPT_AR_CODE = "1.1.2"; // Cuentas por cobrar clientes (haber)

export type ReceiptPostingInput = {
  tenantId: string;
  receiptId: string;
  receiptCode: string;
  /** Cuenta de caja/banco que recibió (debe). Debe ser postable. */
  cashAccountId: string;
  /** Monto del recibo en su moneda. */
  amount: number;
  /** Moneda del recibo. */
  currency: string;
  /** Tasa <moneda>/USD si la moneda no es USD (para derivar el equivalente). */
  fxRate?: number | null;
  /** Fecha del asiento (cobro). YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type ReceiptPostingResult = {
  ok: boolean;
  /** entry_code creado, si se asentó. */
  entryCode?: string;
  /** id del asiento creado (para guardarlo en el recibo). */
  entryId?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, etc.). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deriva el monto USD funcional del cobro. PURA — testeable sin DB.
 * - USD / USDT → el amount tal cual.
 * - otra moneda con fx_rate>0 → amount / fx_rate (fx_rate = <moneda>/USD).
 * - sin fx_rate → amount tal cual (mejor que 0; el caller ya guarda currency).
 */
export function receiptAmountUsd(
  amount: number,
  currency: string,
  fxRate?: number | null,
): number {
  const a = Number(amount) || 0;
  if (currency === "USD" || currency === "USDT") return round2(a);
  const fx = Number(fxRate);
  if (Number.isFinite(fx) && fx > 0) return round2(a / fx);
  return round2(a);
}

/** Una línea del asiento del cobro (debe XOR haber). */
export type ReceiptLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento del cobro. PURA — testeable sin DB.
 *
 *   DR  cashAccountId  = amountUsd   (ingreso a caja / banco)
 *   CR  arAccountId    = amountUsd   (cancelación de la CxC clientes, 1.1.2)
 *
 * Por construcción siempre balancea (Σ debe == Σ haber == amountUsd).
 */
export function buildReceiptLines(
  cashAccountId: string,
  arAccountId: string,
  amountUsd: number,
): ReceiptLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: cashAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Ingreso a caja / banco por cobro",
    },
    {
      account_id: arAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Cancelación de cuenta por cobrar",
    },
  ];
}

/**
 * Crea (idempotente) el asiento del cobro de un recibo. No throwea: devuelve
 * `{ ok, entryCode | entryId | skipped | error }`. El caller decide el log y
 * guarda el `entryId` en el recibo.
 */
export async function postReceiptJournalEntry(
  input: ReceiptPostingInput,
): Promise<ReceiptPostingResult> {
  try {
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo para este recibo?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", input.receiptId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = receiptAmountUsd(
      input.amount,
      input.currency,
      input.fxRate,
    );
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 2. Resolver la cuenta de CxC (1.1.2) en el tenant. La cuenta de caja
    // ya viene como id (cash_account_id), pero validamos que pertenezca al
    // tenant y sea postable.
    const { data: arRow, error: arErr } = await admin
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("code", RECEIPT_AR_CODE)
      .maybeSingle<{ id: string }>();
    if (arErr) return { ok: false, error: arErr.message };
    if (!arRow?.id) {
      // El CoA no está sembrado (falta 1.1.2). No bloqueamos el cobro.
      return { ok: false, skipped: "missing-ar-account" };
    }

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

    // 3. Generar el entry_code atómico.
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: input.tenantId },
    );
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);
    const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);

    // 4. Insertar el asiento (asentado) + sus 2 líneas.
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Cobro ${input.receiptCode}`,
        status: "asentado",
        source: "receipt",
        receipt_id: input.receiptId,
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

    const lines = buildReceiptLines(cashRow.id, arRow.id, amountUsd).map(
      (l) => ({ ...l, entry_id: insertedEntry.id }),
    );

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
 * Anula el asiento del cobro (al anular el recibo). Best-effort: marca el
 * asiento como 'anulado' (los saldos lo ignoran). No throwea.
 */
export async function voidReceiptJournalEntry(
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
