/**
 * Asiento automático de causación al crear una CxP (SDD-0044 · §5.2).
 *
 * Hermano de `invoice-posting.ts`. Al crear una cuenta por pagar se registra
 * el costo/gasto y la obligación con el proveedor. Se crea un asiento
 * `asentado` con source='supplier_bill':
 *
 *   debe   expense_account_id  (costo/gasto, ej. 5.1 Flete navieras)  = totalUsd
 *   haber  2.1.1  Cuentas por pagar proveedores                       = totalUsd
 *
 * Reglas:
 *  - Idempotente por bill_id (no duplica si ya hay asiento vivo para la CxP).
 *    Se guarda el `journal_entry_id` en la CxP.
 *  - Corre con el cliente admin (service_role), igual que el audit log.
 *  - Best-effort: si algo falla, NO rompe la creación de la CxP (el caller
 *    logea y sigue). Devuelve un resultado en vez de throwear.
 *  - El monto está en USD funcional. Si la CxP entró en otra moneda, el
 *    equivalente USD se deriva con fx_rate (amount / fx_rate cuando fx_rate
 *    representa <moneda>/USD). Si no hay fx_rate, se usa el amount tal cual.
 */

import { usdOrNull } from "@/lib/shared/fx";
import { createAdminClient } from "@/lib/db/admin";

/** Cuenta de control de la CxP (haber de la causación, SDD-0040 §5). */
export const PAYABLE_AP_CODE = "2.1.1"; // Cuentas por pagar proveedores (haber)

export type BillPostingInput = {
  tenantId: string;
  billId: string;
  billCode: string;
  /** Cuenta de costo/gasto que se debita (la elige el usuario). Postable. */
  expenseAccountId: string;
  /** Monto de la CxP en su moneda. */
  amount: number;
  /** Moneda de la CxP. */
  currency: string;
  /** Tasa <moneda>/USD si la moneda no es USD (para derivar el equivalente). */
  fxRate?: number | null;
  /** Fecha del asiento (causación). YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type BillPostingResult = {
  ok: boolean;
  entryCode?: string;
  /** id del asiento creado (para guardarlo en la CxP). */
  entryId?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, etc.). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deriva el monto USD funcional de la CxP. PURA — testeable sin DB.
 * - USD / USDT → el amount tal cual.
 * - otra moneda con fx_rate>0 → amount / fx_rate (fx_rate = <moneda>/USD).
 * - SDD-0572: sin tasa, null (antes, el monto tal cual). Desde la 0569 toda CxP
 *   nueva en otra moneda trae tasa.
 */
export function billAmountUsd(
  amount: number,
  currency: string,
  fxRate?: number | null,
): number | null {
  // SDD-0572: el conversor canónico. Sin tasa, null: la CxP no se asienta (antes
  // se asentaba el nominal como si fueran dólares) y queda en «Por contabilizar».
  return usdOrNull(Number(amount) || 0, currency, fxRate);
}

/** Una línea del asiento de causación (debe XOR haber). */
export type BillLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento de causación. PURA — testeable sin DB.
 *
 *   DR  expenseAccountId  = amountUsd   (costo / gasto)
 *   CR  apAccountId       = amountUsd   (cuenta por pagar proveedores, 2.1.1)
 *
 * Por construcción siempre balancea (Σ debe == Σ haber == amountUsd).
 */
export function buildBillLines(
  expenseAccountId: string,
  apAccountId: string,
  amountUsd: number,
): BillLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: expenseAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Costo / gasto causado",
    },
    {
      account_id: apAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Cuenta por pagar al proveedor",
    },
  ];
}

/**
 * Crea (idempotente) el asiento de causación de una CxP. No throwea: devuelve
 * `{ ok, entryCode | entryId | skipped | error }`. El caller decide el log y
 * guarda el `entryId` en la CxP.
 */
export async function postBillJournalEntry(
  input: BillPostingInput,
): Promise<BillPostingResult> {
  try {
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo para esta CxP?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("bill_id", input.billId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = billAmountUsd(input.amount, input.currency, input.fxRate);
    if (amountUsd === null) return { ok: false, skipped: "missing-fx-rate" };
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 2. Resolver la cuenta de control CxP (2.1.1) en el tenant.
    const { data: apRow, error: apErr } = await admin
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("code", PAYABLE_AP_CODE)
      .maybeSingle<{ id: string }>();
    if (apErr) return { ok: false, error: apErr.message };
    if (!apRow?.id) {
      // El CoA no está sembrado (falta 2.1.1). No bloqueamos la CxP.
      return { ok: false, skipped: "missing-ap-account" };
    }

    // 3. Validar que la cuenta de gasto pertenece al tenant y es postable.
    const { data: expRow, error: expErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("id", input.expenseAccountId)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (expErr) return { ok: false, error: expErr.message };
    if (!expRow?.id || !expRow.is_postable) {
      return { ok: false, skipped: "missing-expense-account" };
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
        memo: `Causación CxP ${input.billCode}`,
        status: "asentado",
        source: "supplier_bill",
        bill_id: input.billId,
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

    const lines = buildBillLines(expRow.id, apRow.id, amountUsd).map((l) => ({
      ...l,
      entry_id: insertedEntry.id,
    }));

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
 * Anula el asiento de causación (al anular la CxP). Best-effort: marca el
 * asiento como 'anulado' (los saldos lo ignoran). No throwea.
 */
export async function voidBillJournalEntry(
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
