/**
 * Asiento automático del gasto (SDD-0079) — expenses → journal_entries.
 *
 * Hermano de `bill-posting.ts`. Al cargar un gasto operativo se registra el
 * gasto y la salida de caja. Asiento `asentado` con source='expense':
 *
 *   debe   account_id   (cuenta de gasto imputada, SDD-0077; 5./6.)  = amountUsd
 *   haber  caja/banco según `method`                                 = amountUsd
 *
 * A diferencia de la CxP (DR gasto / CR 2.1.1 por pagar), el gasto es un
 * desembolso DIRECTO: el operario ya pagó, así que el haber es la cuenta de
 * caja/banco según el método (no "por pagar").
 *
 * Reglas (idénticas a bill-posting):
 *  - Idempotente por `expense_id` (no duplica si ya hay asiento vivo).
 *  - Corre con admin client (service_role).
 *  - Best-effort: si algo falla, NO rompe la carga del gasto (el caller logea).
 *  - El monto ya viene en USD funcional (`expenses.amount_usd`).
 *  - Si el gasto no quedó imputado (account_id null) o falta la cuenta de
 *    caja/contrapartida en el plan → skip graceful (no asienta, no bloquea).
 */

import { createAdminClient } from "@/lib/db/admin";
import type { ExpenseMethod } from "@/lib/studio/expense-types";

/**
 * Contrapartida (haber) del asiento del gasto, por método de pago → code de
 * cuenta del plan (seed 0078). El gasto es un desembolso directo:
 *  - cash     → 1.1.1.1 Caja chica
 *  - transfer → 1.1.1.2 Banco cuenta corriente
 *  - card     → 2.1.2   Tarjeta de crédito (pasivo: se incrementa la deuda)
 *  - usdt     → 1.1.1.3 Banco USD (lo más cercano a un saldo USDT)
 * Convención editable; si la cuenta no está en el plan del tenant, no se asienta.
 */
export const EXPENSE_METHOD_ACCOUNT_CODE: Record<ExpenseMethod, string> = {
  cash: "1.1.1.1",
  transfer: "1.1.1.2",
  card: "2.1.2",
  usdt: "1.1.1.3",
};

export type ExpensePostingInput = {
  tenantId: string;
  expenseId: string;
  expenseCode: string;
  /** Cuenta de gasto imputada (expenses.account_id, SDD-0077). Postable. */
  accountId: string | null;
  /** Monto del gasto YA en USD funcional (expenses.amount_usd). */
  amountUsd: number;
  /** Método de pago → determina la cuenta de contrapartida (haber). */
  method: ExpenseMethod;
  /** Fecha del asiento. YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type ExpensePostingResult = {
  ok: boolean;
  entryCode?: string;
  entryId?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, monto cero, etc.). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Una línea del asiento del gasto (debe XOR haber). */
export type ExpenseLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento del gasto. PURA — testeable sin DB.
 *
 *   DR  expenseAccountId  = amountUsd   (gasto operativo)
 *   CR  cashAccountId     = amountUsd   (salida de caja / banco)
 *
 * Por construcción siempre balancea (Σ debe == Σ haber == amountUsd).
 */
export function buildExpenseLines(
  expenseAccountId: string,
  cashAccountId: string,
  amountUsd: number,
): ExpenseLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: expenseAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Gasto operativo",
    },
    {
      account_id: cashAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Salida de caja / banco",
    },
  ];
}

/**
 * Crea (idempotente) el asiento del gasto. No throwea: devuelve
 * `{ ok, entryCode | entryId | skipped | error }`.
 */
export async function postExpenseJournalEntry(
  input: ExpensePostingInput,
): Promise<ExpensePostingResult> {
  try {
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo (no anulado) para este gasto?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("expense_id", input.expenseId)
      .eq("status", "asentado")
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = round2(Number(input.amountUsd) || 0);
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 2. La cuenta de gasto (imputación SDD-0077). Si no quedó imputado
    //    (account_id null, ej. tenant sin plan sembrado) → no asentamos.
    if (!input.accountId) {
      return { ok: true, skipped: "no-account-imputed" };
    }
    const { data: expRow, error: expErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("id", input.accountId)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (expErr) return { ok: false, error: expErr.message };
    if (!expRow?.id || !expRow.is_postable) {
      return { ok: false, skipped: "missing-expense-account" };
    }

    // 3. Cuenta de contrapartida (haber) según el método de pago.
    const cashCode = EXPENSE_METHOD_ACCOUNT_CODE[input.method] ?? "1.1.1.1";
    const { data: cashRow, error: cashErr } = await admin
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("code", cashCode)
      .maybeSingle<{ id: string }>();
    if (cashErr) return { ok: false, error: cashErr.message };
    if (!cashRow?.id) {
      // El CoA no está sembrado (falta la cuenta de caja/banco). No bloqueamos.
      return { ok: false, skipped: "missing-cash-account" };
    }

    // 4. entry_code atómico (mismo RPC que el resto de posteos).
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
        memo: `Gasto ${input.expenseCode}`,
        status: "asentado",
        source: "expense",
        expense_id: input.expenseId,
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

    const lines = buildExpenseLines(expRow.id, cashRow.id, amountUsd).map(
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
 * Anula el/los asiento(s) vivo(s) de un gasto (al editarlo cambiando monto/
 * cuenta/método, o al borrarlo). Marca `anulado` (los saldos lo ignoran).
 * Idempotente, best-effort, no throwea. Busca por `expense_id`.
 */
export async function voidExpenseEntriesForExpense(
  tenantId: string,
  expenseId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("journal_entries")
      .update({ status: "anulado" })
      .eq("tenant_id", tenantId)
      .eq("expense_id", expenseId)
      .eq("status", "asentado")
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Helper best-effort para el caller (web/móvil): postea el asiento del gasto y
 * logea si no se pudo. No throwea — el gasto ya está guardado pase lo que pase.
 */
export async function syncExpenseEntry(
  input: ExpensePostingInput,
): Promise<void> {
  try {
    const r = await postExpenseJournalEntry(input);
    if (!r.ok) {
      console.error(
        `[contabilidad] asiento del gasto ${input.expenseCode} no creado:`,
        r.skipped ?? r.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar el gasto ${input.expenseCode}:`,
      e,
    );
  }
}
