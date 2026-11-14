/**
 * Asiento automático de la indemnización (SDD-0101 C2) — client_claims →
 * journal_entries. Hermano de `expense-posting.ts`. Cuando un reclamo pasa a
 * 'pagado', se asienta el desembolso de la indemnización al cliente:
 *
 *   debe   6.20 Siniestros / indemnizaciones a clientes        = amountUsd
 *   haber  caja/banco según `method`                           = amountUsd
 *
 * Reglas (idénticas a expense-posting):
 *  - Idempotente por `claim_id` (no duplica si ya hay asiento vivo).
 *  - Corre con admin client (service_role).
 *  - Best-effort: si algo falla, NO rompe el pago (el caller logea).
 *  - El monto ya viene en USD funcional (client_claims.amount_usd).
 *  - Si falta la cuenta de siniestros (6.20) o la de caja en el plan del tenant
 *    → skip graceful (no asienta, no bloquea).
 *  - El trigger de cierre de período (0133) rechaza asentar en período cerrado;
 *    la action además valida isPeriodClosed antes de marcar 'pagado'.
 */

import { createAdminClient } from "@/lib/db/admin";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import type { ClaimPaymentMethod } from "@/lib/studio/reclamos/claims-types";

export type { ClaimPaymentMethod };

/** Código de la cuenta de gasto de la indemnización (seed 0157). */
export const CLAIM_INDEMNITY_ACCOUNT_CODE = "6.20";

/**
 * Contrapartida (haber) por método de pago → code de cuenta del plan (seed
 * 0078). Mismo mapeo que el gasto (sin `card`: una indemnización no se paga con
 * tarjeta de crédito). Convención editable; si la cuenta no está en el plan del
 * tenant, no se asienta.
 */
export const CLAIM_PAYMENT_METHOD_ACCOUNT_CODE: Record<ClaimPaymentMethod, string> = {
  cash: "1.1.1.1", // Caja chica
  transfer: "1.1.1.2", // Banco cuenta corriente
  usdt: "1.1.1.3", // Banco USD
};

export type ClaimPostingInput = {
  tenantId: string;
  claimId: string;
  claimCode: string;
  /** Monto de la indemnización YA en USD funcional (client_claims.amount_usd). */
  amountUsd: number;
  /** Método de pago → determina la cuenta de contrapartida (haber). */
  method: ClaimPaymentMethod;
  /** Fecha del asiento. YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type ClaimPostingResult = {
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

export type ClaimLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento de la indemnización. PURA — testeable sin
 * DB. Por construcción siempre balancea (Σ debe == Σ haber == amountUsd).
 *
 *   DR  indemnityAccountId (6.20)  = amountUsd
 *   CR  cashAccountId              = amountUsd
 */
export function buildClaimLines(
  indemnityAccountId: string,
  cashAccountId: string,
  amountUsd: number,
): ClaimLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: indemnityAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Indemnización al cliente",
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
 * Crea (idempotente) el asiento de la indemnización. No throwea: devuelve
 * `{ ok, entryCode | entryId | skipped | error }`.
 */
export async function postClaimIndemnityEntry(
  input: ClaimPostingInput,
): Promise<ClaimPostingResult> {
  try {
    const entryDate = input.entryDate === undefined ? fechaCaracas() : input.entryDate;
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo (no anulado) para este reclamo?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", input.claimId)
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

    // 2. Cuenta de la indemnización (6.20). Si no está sembrada → no asentamos.
    const { data: indemRow, error: indemErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("code", CLAIM_INDEMNITY_ACCOUNT_CODE)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (indemErr) return { ok: false, error: indemErr.message };
    if (!indemRow?.id || !indemRow.is_postable) {
      return { ok: false, skipped: "missing-indemnity-account" };
    }

    // 3. Cuenta de contrapartida (haber) según el método de pago.
    const cashCode = CLAIM_PAYMENT_METHOD_ACCOUNT_CODE[input.method] ?? "1.1.1.2";
    const { data: cashRow, error: cashErr } = await admin
      .from("accounts")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("code", cashCode)
      .maybeSingle<{ id: string }>();
    if (cashErr) return { ok: false, error: cashErr.message };
    if (!cashRow?.id) {
      return { ok: false, skipped: "missing-cash-account" };
    }

    // 4. entry_code atómico (mismo RPC que el resto de posteos).
    const { data: codeData, error: codeErr } = await admin.rpc("next_entry_code", {
      p_tenant_id: input.tenantId,
    });
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);

    // 5. Insertar el asiento (asentado) + sus 2 líneas.
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Indemnización ${input.claimCode}`,
        status: "asentado",
        source: "claim",
        claim_id: input.claimId,
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

    const lines = buildClaimLines(indemRow.id, cashRow.id, amountUsd).map((l) => ({
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
 * Helper best-effort para el caller: postea el asiento de la indemnización y
 * logea si no se pudo. No throwea — el reclamo ya quedó 'pagado' pase lo que pase.
 */
export async function syncClaimIndemnityEntry(
  input: ClaimPostingInput,
): Promise<void> {
  try {
    const r = await postClaimIndemnityEntry(input);
    if (!r.ok) {
      console.error(
        `[contabilidad] asiento de la indemnización ${input.claimCode} no creado:`,
        r.skipped ?? r.error,
      );
    }
  } catch (e) {
    console.error(
      `[contabilidad] error inesperado al asentar la indemnización ${input.claimCode}:`,
      e,
    );
  }
}
