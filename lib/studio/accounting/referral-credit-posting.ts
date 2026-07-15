/**
 * Asiento automático del CRÉDITO DE REFERIDO aplicado (SDD-0137) —
 * referrals ('aplicado') → journal_entries.
 *
 * Hermano de `expense-posting.ts` / `claim-posting.ts`. Al APLICAR el crédito
 * acreditado ($80) del referidor a su próxima factura, se genera un asiento
 * propio (source='referral_credit', independiente del asiento de venta de la
 * factura, que queda INTACTO). El asiento depende del setting per-tenant
 * `referral_credit_mode` (fiscal_settings, migr 0237):
 *
 *   marketing_expense (default) → el crédito es GASTO DE INCENTIVO:
 *     DR  6.11  Publicidad y marketing        = 80.00
 *     CR  1.1.2 Cuentas por cobrar clientes    = 80.00   (baja el saldo del referidor)
 *   → NO toca la base ni el IVA de la factura (recomendación §3.2/§3.3 del spec).
 *
 *   commercial_discount → el crédito es DESCUENTO SOBRE VENTAS:
 *     DR  4.9   Descuentos sobre ventas (contra ingreso) = 80.00
 *     CR  1.1.2 Cuentas por cobrar clientes              = 80.00
 *   → reduce el ingreso neto (rebaja de precio). El founder decide el modo.
 *
 * En AMBOS modos el HABER es 1.1.2 CxC (el referidor paga $80 menos); solo
 * cambia la cuenta del DEBE. Molde idéntico a expense-posting:
 *  - Corre con admin client (service_role).
 *  - Best-effort: si falta una cuenta del plan → skip graceful (no asienta, no
 *    rompe la aplicación; el caller decide si revierte el estado).
 *  - Idempotencia REAL: la transición de estado 'acreditado'→'aplicado' es la
 *    guarda (row-lock en la acción); acá además no duplicamos si ya hay asiento
 *    vivo linkeado a este referral (referrals.applied_entry_id).
 */

import { createAdminClient } from "@/lib/db/admin";

/**
 * El enum y las cuentas viven en `./referral-credit-modes` (módulo SIN imports):
 * este archivo arrastra el admin client (service_role) y no puede tocar el bundle
 * del navegador, pero el form de config fiscal es CLIENTE y necesita las
 * constantes. Se re-exportan acá para no romper a quien ya las importaba de este
 * módulo.
 */
export {
  DEFAULT_REFERRAL_CREDIT_MODE,
  isReferralCreditMode,
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_MODES,
  type ReferralCreditMode,
} from "./referral-credit-modes";

import {
  DEFAULT_REFERRAL_CREDIT_MODE,
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
  type ReferralCreditMode,
} from "./referral-credit-modes";

export type ReferralCreditPostingInput = {
  tenantId: string;
  /** referrals.id del crédito que se aplica. */
  referralId: string;
  referralCode: string;
  /** MARKBOX del referidor (para el memo). */
  referrerMarkbox: string;
  /** Factura del referidor donde se aplica (invoices.id). Linkea el asiento. */
  invoiceId: string;
  invoiceCode: string;
  /** Monto del crédito en USD (referrals.reward_usd, típ. 80). */
  amountUsd: number;
  /** Modo de reflejo contable (fiscal_settings.referral_credit_mode). */
  mode: ReferralCreditMode;
  /** Fecha del asiento. YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type ReferralCreditPostingResult = {
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

/** Una línea del asiento (debe XOR haber). */
export type ReferralCreditLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento del crédito aplicado. PURA — testeable
 * sin DB. Por construcción balancea (Σ debe == Σ haber == amountUsd):
 *
 *   DR  debitAccountId   = amountUsd   (6.11 marketing | 4.9 descuento, según modo)
 *   CR  receivableId     = amountUsd   (1.1.2 CxC: baja el saldo del referidor)
 */
export function buildReferralCreditLines(
  mode: ReferralCreditMode,
  debitAccountId: string,
  receivableAccountId: string,
  amountUsd: number,
): ReferralCreditLine[] {
  const amt = round2(amountUsd);
  const debitMemo =
    mode === "marketing_expense"
      ? "Crédito de referido (gasto de marketing)"
      : "Crédito de referido (descuento sobre ventas)";
  return [
    {
      account_id: debitAccountId,
      debit: amt,
      credit: 0,
      line_memo: debitMemo,
    },
    {
      account_id: receivableAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Baja de CxC por crédito de referido",
    },
  ];
}

/**
 * Crea (idempotente, best-effort) el asiento del crédito de referido aplicado.
 * No throwea: devuelve `{ ok, entryCode | entryId | skipped | error }`.
 */
export async function postReferralCreditJournalEntry(
  input: ReferralCreditPostingInput,
): Promise<ReferralCreditPostingResult> {
  try {
    const admin = createAdminClient();

    const amountUsd = round2(Number(input.amountUsd) || 0);
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 1. Idempotencia REAL (hueco B): ¿ya hay un asiento VIVO (no anulado) de
    //    este crédito? Se busca por journal_entries.referral_id — NO por
    //    referrals.applied_entry_id, que puede quedar NULL si el proceso murió
    //    entre el claim y el linkage. Si existe, se devuelve su id para que el
    //    caller lo (re)linkee (idempotente). El UNIQUE parcial en DB
    //    (journal_entries_referral_credit_uniq) es la guarda dura contra la carrera.
    const { data: existing, error: exErr } = await admin
      .from("journal_entries")
      .select("id, entry_code")
      .eq("tenant_id", input.tenantId)
      .eq("referral_id", input.referralId)
      .eq("source", "referral_credit")
      .neq("status", "anulado")
      .is("deleted_at", null)
      .maybeSingle<{ id: string; entry_code: string }>();
    if (exErr) return { ok: false, error: exErr.message };
    if (existing?.id) {
      return {
        ok: true,
        entryId: existing.id,
        entryCode: existing.entry_code,
        skipped: "entry-already-exists",
      };
    }

    // 2. Cuenta del DEBE según el modo (6.11 marketing | 4.9 descuento).
    const debitCode = REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE[input.mode];
    const { data: debitAcc, error: debitErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("code", debitCode)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (debitErr) return { ok: false, error: debitErr.message };
    if (!debitAcc?.id || !debitAcc.is_postable) {
      return { ok: false, skipped: "missing-debit-account" };
    }

    // 3. Cuenta del HABER: CxC de clientes (1.1.2).
    const { data: crAcc, error: crErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("code", REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (crErr) return { ok: false, error: crErr.message };
    if (!crAcc?.id || !crAcc.is_postable) {
      return { ok: false, skipped: "missing-receivable-account" };
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

    // 5. Insertar el asiento (asentado) + sus 2 líneas. Se linkea a la factura
    //    (invoice_id) para la reversión al anular la factura (§3.6).
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Crédito de referido ${input.referralCode} · ${input.referrerMarkbox} · factura ${input.invoiceCode}`,
        status: "asentado",
        source: "referral_credit",
        invoice_id: input.invoiceId,
        referral_id: input.referralId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      // Carrera (doble-submit): el UNIQUE parcial journal_entries_referral_credit_uniq
      // rechazó un 2º asiento del mismo crédito (23505). Ganó otro proceso →
      // devolvemos el asiento vivo existente en vez de duplicar (idempotencia DB).
      if (entryErr?.code === "23505") {
        const { data: won } = await admin
          .from("journal_entries")
          .select("id, entry_code")
          .eq("tenant_id", input.tenantId)
          .eq("referral_id", input.referralId)
          .eq("source", "referral_credit")
          .neq("status", "anulado")
          .is("deleted_at", null)
          .maybeSingle<{ id: string; entry_code: string }>();
        if (won?.id) {
          return {
            ok: true,
            entryId: won.id,
            entryCode: won.entry_code,
            skipped: "entry-already-exists",
          };
        }
      }
      return {
        ok: false,
        error: entryErr?.message ?? "no se pudo crear el asiento",
      };
    }

    const lines = buildReferralCreditLines(
      input.mode,
      debitAcc.id,
      crAcc.id,
      amountUsd,
    ).map((l) => ({ ...l, entry_id: insertedEntry.id }));
    const { error: linesErr } = await admin
      .from("journal_lines")
      .insert(lines);
    if (linesErr) {
      // Rollback manual del header (no hay tx cross-statement acá). Fix D: si el
      // DELETE del header falla, NO dejamos un asiento 'asentado' sin líneas
      // (0=0, cuenta como vivo y bloquea el UNIQUE de reintento) → fallback:
      // marcarlo 'anulado' para que no afecte saldos ni tape la re-aplicación.
      const { error: delErr } = await admin
        .from("journal_entries")
        .delete()
        .eq("id", insertedEntry.id);
      if (delErr) {
        await admin
          .from("journal_entries")
          .update({ status: "anulado" })
          .eq("id", insertedEntry.id);
      }
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode, entryId: insertedEntry.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Anula el asiento vivo de un crédito de referido (al revertir la aplicación:
 * §3.6 factura anulada). Marca `anulado` (los saldos lo ignoran). Idempotente,
 * best-effort, no throwea. Busca por el asiento linkeado al referral.
 */
export async function voidReferralCreditEntry(
  tenantId: string,
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!entryId) return { ok: true };
    const admin = createAdminClient();
    const { error } = await admin
      .from("journal_entries")
      .update({ status: "anulado" })
      .eq("tenant_id", tenantId)
      .eq("id", entryId)
      .eq("status", "asentado")
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * REVIERTE los créditos de referido aplicados a una factura (§3.6: la factura
 * se anuló). Por cada crédito 'aplicado' con applied_invoice_id = esta factura:
 *  - anula su asiento de marketing/descuento (applied_entry_id → 'anulado'),
 *  - devuelve el crédito a 'acreditado' (vuelve a estar disponible),
 *  - limpia el rastro de aplicación (applied_invoice_id/entry_id/at → null).
 * Así el crédito no se "quema" por una factura que no existió. Idempotente
 * (revertir dos veces = no-op), best-effort (no throwea), admin client.
 */
export async function revertReferralCreditsForInvoice(
  tenantId: string,
  invoiceId: string,
): Promise<{ ok: boolean; reverted: number; error?: string }> {
  try {
    if (!invoiceId) return { ok: true, reverted: 0 };
    const admin = createAdminClient();

    const { data: rows, error: readErr } = await admin
      .from("referrals")
      .select("id, applied_entry_id, reward_usd")
      .eq("tenant_id", tenantId)
      .eq("applied_invoice_id", invoiceId)
      .eq("status", "aplicado")
      .is("deleted_at", null);
    if (readErr) return { ok: false, reverted: 0, error: readErr.message };

    const credits =
      (rows as { id: string; applied_entry_id: string | null; reward_usd: number }[] | null) ?? [];
    let reverted = 0;
    for (const c of credits) {
      // Anular el/los asiento(s) del crédito. Fix B: barrer por referral_id (no
      // solo por applied_entry_id) → si el proceso murió antes de linkear el
      // asiento, applied_entry_id es NULL pero el asiento vive con referral_id
      // seteado; igual lo anulamos (nada de asientos huérfanos). Idempotente
      // (.eq status='asentado').
      const { data: entries } = await admin
        .from("journal_entries")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("referral_id", c.id)
        .eq("source", "referral_credit")
        .eq("status", "asentado")
        .is("deleted_at", null);
      for (const e of (entries as { id: string }[] | null) ?? []) {
        await voidReferralCreditEntry(tenantId, e.id);
      }
      // Cinturón y tirantes: si quedó un applied_entry_id que no barrió el
      // filtro de arriba (referral_id null en asientos viejos pre-fix), anularlo.
      if (c.applied_entry_id) {
        await voidReferralCreditEntry(tenantId, c.applied_entry_id);
      }

      // Fix C: revertir el abono no-monetario en el subledger. Al aplicar se
      // subió invoices.paid_amount en el monto del crédito (para que el saldo
      // reflejara el $80 y el GL==subledger); al revertir se baja de vuelta.
      const creditAmt = round2(Number(c.reward_usd) || 0);
      if (creditAmt > 0) {
        const { data: inv } = await admin
          .from("invoices")
          .select("paid_amount")
          .eq("id", invoiceId)
          .maybeSingle<{ paid_amount: number }>();
        if (inv) {
          const newPaid = Math.max(0, round2((Number(inv.paid_amount) || 0) - creditAmt));
          await admin
            .from("invoices")
            .update({ paid_amount: newPaid })
            .eq("id", invoiceId);
        }
      }

      // Devolver el crédito a 'acreditado' + limpiar el rastro. El guard por
      // estado ('aplicado') hace la reversión idempotente.
      const { error: updErr } = await admin
        .from("referrals")
        .update({
          status: "acreditado",
          applied_invoice_id: null,
          applied_entry_id: null,
          applied_at: null,
        })
        .eq("id", c.id)
        .eq("status", "aplicado");
      if (!updErr) reverted += 1;
    }
    return { ok: true, reverted };
  } catch (e) {
    return {
      ok: false,
      reverted: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
