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

/**
 * Cuenta puente del pago SIN referencia (SDD-0068, seed 0122): pasivo
 * "Fondos por identificar". 2.1.7 ya la tomó 0114 (Socio Logístico China) →
 * el siguiente code libre en 2.1.x es 2.1.8.
 */
export const UNIDENTIFIED_FUNDS_CODE = "2.1.8"; // Fondos por identificar

/** source del asiento de reclasificación al identificar (SDD-0068 #3). */
export const RECLASS_SOURCE = "receipt_reclass";

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
 *
 * INVARIANTE del mandato (SDD-0068 · "nunca mezclar en un mismo asiento"):
 * los asientos automáticos de cobro son POR-RECIBO y un recibo tiene UNA sola
 * `fund_class` → cada asiento toca fondos de una única clase por construcción
 * (este builder y los de abajo emiten exactamente 2 líneas de un solo recibo).
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
 * Líneas del asiento del pago SIN referencia (SDD-0068 #2). PURA.
 *
 *   DR  cashAccountId    = amountUsd   (entró plata a caja/banco)
 *   CR  bridgeAccountId  = amountUsd   (pasivo "Fondos por identificar" 2.1.8 —
 *                                       NO es ingreso ni cancela CxC: no se
 *                                       sabe de quién es todavía)
 */
export function buildUnidentifiedReceiptLines(
  cashAccountId: string,
  bridgeAccountId: string,
  amountUsd: number,
): ReceiptLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: cashAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Ingreso a caja / banco por pago sin identificar",
    },
    {
      account_id: bridgeAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Fondos por identificar (pago sin referencia)",
    },
  ];
}

/**
 * Líneas del asiento de RECLASIFICACIÓN al identificar (SDD-0068 #3). PURA.
 *
 *   DR  bridgeAccountId  = amountUsd   (sale del pasivo puente 2.1.8)
 *   CR  arAccountId      = amountUsd   (cancela la CxC del cliente, 1.1.2)
 *
 * La fecha del asiento la pone el caller = `received_at` ORIGINAL del recibo
 * (imputación retroactiva a la fecha de recepción de fondos, decisión #6).
 */
export function buildReclassLines(
  bridgeAccountId: string,
  arAccountId: string,
  amountUsd: number,
): ReceiptLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: bridgeAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Reclasificación de fondos por identificar",
    },
    {
      account_id: arAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Cancelación de cuenta por cobrar (identificación retroactiva)",
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

// ── Pago sin referencia + identificación retroactiva (SDD-0068) ──

/**
 * Resuelve el id de una cuenta postable del tenant por su `code`. null si no
 * existe o no es postable (CoA sin sembrar / cuenta grupo).
 */
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
 * Inserta un asiento asentado de 2 líneas atado a un recibo (header + lines +
 * rollback manual del header si fallan las líneas). Compartido por el posting
 * del sin-ref y la reclasificación. NO valida idempotencia (la valida cada
 * caller con su criterio: por receipt_id, o por receipt_id + source).
 */
async function insertReceiptEntry(args: {
  admin: ReturnType<typeof createAdminClient>;
  tenantId: string;
  receiptId: string;
  memo: string;
  source: string;
  entryDate: string;
  lines: ReceiptLine[];
}): Promise<ReceiptPostingResult> {
  const { data: codeData, error: codeErr } = await args.admin.rpc(
    "next_entry_code",
    { p_tenant_id: args.tenantId },
  );
  if (codeErr || !codeData) {
    return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
  }
  const entryCode = String(codeData);

  const { data: insertedEntry, error: entryErr } = await args.admin
    .from("journal_entries")
    .insert({
      tenant_id: args.tenantId,
      entry_code: entryCode,
      entry_date: args.entryDate,
      memo: args.memo,
      status: "asentado",
      source: args.source,
      receipt_id: args.receiptId,
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

  const lines = args.lines.map((l) => ({ ...l, entry_id: insertedEntry.id }));
  const { error: linesErr } = await args.admin
    .from("journal_lines")
    .insert(lines);
  if (linesErr) {
    await args.admin.from("journal_entries").delete().eq("id", insertedEntry.id);
    return { ok: false, error: linesErr.message };
  }

  return { ok: true, entryCode, entryId: insertedEntry.id };
}

/**
 * Asiento del pago SIN referencia (SDD-0068 #2): DR caja / CR 2.1.8 "Fondos
 * por identificar" (pasivo puente — la plata entró pero no se sabe de quién
 * es; NO toca CxC ni ingresos). Idempotente por receipt_id (mismo criterio
 * que el cobro normal: es el asiento INICIAL del recibo). Best-effort.
 */
export async function postUnidentifiedReceiptJournalEntry(
  input: ReceiptPostingInput,
): Promise<ReceiptPostingResult> {
  try {
    const admin = createAdminClient();

    // Idempotencia: ¿ya hay asiento vivo para este recibo?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", input.receiptId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = receiptAmountUsd(input.amount, input.currency, input.fxRate);
    if (amountUsd <= 0) return { ok: true, skipped: "zero-amount" };

    const bridgeId = await resolveAccountIdByCode(
      admin,
      input.tenantId,
      UNIDENTIFIED_FUNDS_CODE,
    );
    if (!bridgeId) {
      // Falta la cuenta puente (migración 0122 sin aplicar). No bloquea el registro.
      return { ok: false, skipped: "missing-bridge-account" };
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

    return insertReceiptEntry({
      admin,
      tenantId: input.tenantId,
      receiptId: input.receiptId,
      memo: `Pago sin identificar ${input.receiptCode}`,
      source: "receipt",
      entryDate: input.entryDate ?? new Date().toISOString().slice(0, 10),
      lines: buildUnidentifiedReceiptLines(cashRow.id, bridgeId, amountUsd),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ReclassPostingInput = {
  tenantId: string;
  receiptId: string;
  receiptCode: string;
  /** Monto del recibo en su moneda. */
  amount: number;
  currency: string;
  fxRate?: number | null;
  /**
   * Fecha del asiento = `received_at` ORIGINAL del recibo — la imputación es
   * retroactiva a la fecha de recepción de fondos (decisión #6 del handoff).
   */
  entryDate: string;
};

/**
 * Asiento de RECLASIFICACIÓN al identificar un pago sin referencia (SDD-0068
 * #3): DR 2.1.8 "Fondos por identificar" / CR 1.1.2 Clientes, con fecha =
 * `received_at` original. Idempotente por (receipt_id, source='receipt_reclass')
 * — el recibo YA tiene su asiento inicial source='receipt', por eso acá la
 * idempotencia filtra por source. Best-effort: no rompe la identificación.
 */
export async function postReceiptReclassEntry(
  input: ReclassPostingInput,
): Promise<ReceiptPostingResult> {
  try {
    const admin = createAdminClient();

    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", input.receiptId)
      .eq("source", RECLASS_SOURCE)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const amountUsd = receiptAmountUsd(input.amount, input.currency, input.fxRate);
    if (amountUsd <= 0) return { ok: true, skipped: "zero-amount" };

    const [bridgeId, arId] = await Promise.all([
      resolveAccountIdByCode(admin, input.tenantId, UNIDENTIFIED_FUNDS_CODE),
      resolveAccountIdByCode(admin, input.tenantId, RECEIPT_AR_CODE),
    ]);
    if (!bridgeId) return { ok: false, skipped: "missing-bridge-account" };
    if (!arId) return { ok: false, skipped: "missing-ar-account" };

    return insertReceiptEntry({
      admin,
      tenantId: input.tenantId,
      receiptId: input.receiptId,
      memo: `Identificación ${input.receiptCode} (imputación retroactiva)`,
      source: RECLASS_SOURCE,
      entryDate: input.entryDate,
      lines: buildReclassLines(bridgeId, arId, amountUsd),
    });
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

/**
 * Anula TODOS los asientos vivos atados a un recibo (SDD-0068): un recibo
 * identificado tiene 2 — el inicial (source='receipt', a la cuenta puente) y
 * la reclasificación (source='receipt_reclass'). Al anular el recibo deben
 * caer ambos; anular solo `journal_entry_id` dejaría la reclasificación viva.
 */
export async function voidEntriesForReceipt(
  receiptId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("journal_entries")
      .update({ status: "anulado" })
      .eq("receipt_id", receiptId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
