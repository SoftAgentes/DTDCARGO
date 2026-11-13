/**
 * Asiento de PROVISIÓN del finiquito al confirmar una liquidación (SDD-0109,
 * integra SDD-0079). Decisión del founder (#5, 2026-06-27): el finiquito
 * **provisiona** — NO se paga en el acto. El pago real sale luego por Tesorería.
 *
 *   DR  6.5.3  Cargas sociales / impuestos de nómina   = net_usd   (el costo laboral)
 *   CR  2.1.3  Sueldos por pagar                        = net_usd   (lo que se le debe)
 *
 * Se provisiona el NETO (bruto − deducción de préstamos): el saldo de préstamo
 * que se recupera ya era un activo de la empresa y se concilia en el módulo de
 * préstamos; netearlo evita doble conteo. El mapeo de cuentas es advisory — el
 * contador lo afina (mismo criterio que el resto de Nómina).
 *
 * Reglas (espejo de receipt-posting.ts):
 *  - Corre con el cliente admin (service_role).
 *  - Best-effort: no throwea; devuelve { ok, entryCode | entryId | skipped | error }.
 *  - Idempotencia: la garantiza el CALLER (la action solo postea cuando el
 *    finiquito está en borrador y su journal_entry_id es null, y guarda el id).
 *  - Si falta una cuenta del CoA → skip (no bloquea la confirmación; queda sin
 *    asiento y se puede reintentar tras sembrar el plan).
 */

import { createAdminClient } from "@/lib/db/admin";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";

/** Gasto del finiquito (cargas sociales / nómina · CoA seed 0078). */
export const SETTLEMENT_EXPENSE_CODE = "6.5.3";
/** Pasivo "Sueldos por pagar" — provisiona el finiquito (CoA seed 0078). */
export const SETTLEMENT_PAYABLE_CODE = "2.1.3";
/** source del asiento del finiquito. */
export const SETTLEMENT_SOURCE = "nomina_settlement";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type SettlementLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Las 2 líneas de la provisión del finiquito. PURA — testeable sin DB.
 *
 *   DR  expenseAccountId  = netUsd
 *   CR  payableAccountId  = netUsd
 *
 * Por construcción balancea (Σ debe == Σ haber == netUsd).
 */
export function buildSettlementLines(
  expenseAccountId: string,
  payableAccountId: string,
  netUsd: number,
): SettlementLine[] {
  const amt = round2(netUsd);
  return [
    {
      account_id: expenseAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Provisión de finiquito (prestaciones + fracciones LOTTT)",
    },
    {
      account_id: payableAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Finiquito por pagar al trabajador",
    },
  ];
}

export type SettlementPostingInput = {
  tenantId: string;
  settlementId: string;
  settlementCode: string;
  employeeName: string;
  /** Neto a provisionar (USD funcional). */
  netUsd: number;
  /** Fecha del asiento (egreso). YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type SettlementPostingResult = {
  ok: boolean;
  entryCode?: string;
  entryId?: string;
  skipped?: string;
  error?: string;
};

async function resolveAccountIdByCode(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  code: string,
): Promise<string | null> {
  const { data } = await admin
    .from("accounts")
    .select("id, is_postable")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .maybeSingle<{ id: string; is_postable: boolean }>();
  return data?.id && data.is_postable ? data.id : null;
}

/**
 * Crea el asiento de provisión del finiquito. No throwea. La idempotencia la
 * garantiza el caller (solo postea con journal_entry_id null). Best-effort.
 */
export async function postSettlementJournalEntry(
  input: SettlementPostingInput,
): Promise<SettlementPostingResult> {
  try {
    const entryDate = input.entryDate === undefined ? fechaCaracas() : input.entryDate;
    const admin = createAdminClient();

    const netUsd = round2(input.netUsd);
    if (netUsd <= 0) return { ok: true, skipped: "zero-amount" };

    const [expenseId, payableId] = await Promise.all([
      resolveAccountIdByCode(admin, input.tenantId, SETTLEMENT_EXPENSE_CODE),
      resolveAccountIdByCode(admin, input.tenantId, SETTLEMENT_PAYABLE_CODE),
    ]);
    if (!expenseId) return { ok: false, skipped: "missing-expense-account" };
    if (!payableId) return { ok: false, skipped: "missing-payable-account" };

    const { data: codeData, error: codeErr } = await admin.rpc("next_entry_code", {
      p_tenant_id: input.tenantId,
    });
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);

    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Finiquito ${input.settlementCode} · ${input.employeeName}`,
        status: "asentado",
        source: SETTLEMENT_SOURCE,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      return { ok: false, error: entryErr?.message ?? "no se pudo crear el asiento" };
    }

    const lines = buildSettlementLines(expenseId, payableId, netUsd).map((l) => ({
      ...l,
      entry_id: insertedEntry.id,
    }));

    const { error: linesErr } = await admin.from("journal_lines").insert(lines);
    if (linesErr) {
      // Rollback manual del header (sin transacción cross-statement).
      await admin.from("journal_entries").delete().eq("id", insertedEntry.id);
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode, entryId: insertedEntry.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Anula el asiento del finiquito (al anular la liquidación). Best-effort: marca
 * el asiento como 'anulado' (los saldos lo ignoran). No throwea.
 */
export async function voidSettlementJournalEntry(
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
