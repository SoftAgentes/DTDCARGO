/**
 * Asientos automáticos del dominio Socio China (SDD-0059 · Slice A · §5).
 *
 * Hermano de `accounting/bill-posting.ts` / `supplier-payment-posting.ts`.
 * Reusa `accounts` (plan de cuentas, 0078) + `journal_entries`/`journal_lines`
 * (doble partida) + la RPC `next_entry_code`. Tres eventos del dominio:
 *
 *  1. Cargo del socio (causación) → DR Costo mercancía-cliente (5.10) /
 *     CR Cuenta corriente Socio China (2.1.7).  Monto = net_amount (NUNCA el
 *     bruto si hay nota de crédito; guard §4.3).
 *
 *  2. Conversión de divisa (spread forex) → DR Cuenta corriente Socio China
 *     (2.1.7) / CR Ingresos por cambio de moneda (4.6).  Monto = comisión
 *     captada (revenue, no costo).
 *
 *  3. Cruce contable (claim offset) → DR Cuenta corriente Socio China (2.1.7)
 *     / CR Costo mercancía-cliente (5.10).  Neutraliza margen: devolución de
 *     valor ya cobrado, NO pérdida.
 *
 * Los line-builders son PUROS (testeables sin DB: Σ debe == Σ haber). El
 * poster corre con el cliente admin (service_role), idempotente por su origen,
 * best-effort (no throwea; devuelve un resultado).
 */

import { createAdminClient } from "@/lib/db/admin";

// ── Códigos de cuenta del plan (sembrados en 0110 §11) ─────────
/** Cuenta corriente Socio Logístico China (pasivo, familia Proveedores). */
export const PARTNER_AC_CODE = "2.1.7";
/** Ingresos por cambio de moneda (revenue del spread forex). */
export const FOREX_REVENUE_CODE = "4.6";
/** Costo de mercancía pagada a fábrica por cuenta de cliente (CGS). */
export const FACTORY_COGS_CODE = "5.10";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Una línea de asiento (debe XOR haber). */
export type PartnerLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Line builders PUROS (siempre balancean Σ debe == Σ haber) ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Cargo del socio (causación). PURA.
 *   DR  cogsAccountId     = amountUsd   (costo mercancía-cliente)
 *   CR  partnerAcAccountId= amountUsd   (cuenta corriente socio China)
 */
export function buildChargeLines(
  cogsAccountId: string,
  partnerAcAccountId: string,
  amountUsd: number,
): PartnerLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: cogsAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Costo causado del cargo del socio China",
    },
    {
      account_id: partnerAcAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Cuenta corriente con el Socio China",
    },
  ];
}

/**
 * Conversión de divisa (spread forex como revenue). PURA.
 *   DR  partnerAcAccountId   = commissionUsd  (cuenta corriente socio China)
 *   CR  forexRevenueAccountId= commissionUsd  (ingresos por cambio de moneda)
 */
export function buildConversionLines(
  partnerAcAccountId: string,
  forexRevenueAccountId: string,
  commissionUsd: number,
): PartnerLine[] {
  const amt = round2(commissionUsd);
  return [
    {
      account_id: partnerAcAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Spread captado vía cuenta corriente del socio",
    },
    {
      account_id: forexRevenueAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Ingreso por cambio de moneda (spread forex)",
    },
  ];
}

/**
 * Cruce contable (claim offset). Neutraliza margen. PURA.
 *   DR  partnerAcAccountId = amountUsd   (el socio retiene a favor de DTD)
 *   CR  cogsAccountId      = amountUsd   (reversa del costo mercancía-cliente)
 */
export function buildClaimOffsetLines(
  partnerAcAccountId: string,
  cogsAccountId: string,
  amountUsd: number,
): PartnerLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: partnerAcAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Retención del socio a favor de DTD (cruce)",
    },
    {
      account_id: cogsAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Reversa de costo mercancía-cliente (devolución de valor)",
    },
  ];
}

/** Σ debe y Σ haber de un set de líneas (para el chequeo de balance). PURA. */
export function lineTotals(lines: PartnerLine[]): {
  debit: number;
  credit: number;
  balanced: boolean;
} {
  const debit = round2(lines.reduce((a, l) => a + l.debit, 0));
  const credit = round2(lines.reduce((a, l) => a + l.credit, 0));
  return { debit, credit, balanced: debit === credit };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Poster genérico (admin, idempotente, best-effort)          ║
// ╚═══════════════════════════════════════════════════════════╝

export type PartnerPostingResult = {
  ok: boolean;
  entryCode?: string;
  entryId?: string;
  skipped?: string;
  error?: string;
};

/** Resuelve el id de una cuenta por code en el tenant. Devuelve null si falta. */
async function resolveAccountId(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  code: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("accounts")
    .select("id, is_postable")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .maybeSingle<{ id: string; is_postable: boolean }>();
  if (error || !data?.id || !data.is_postable) return null;
  return data.id;
}

type PostArgs = {
  tenantId: string;
  /** Columna FK del journal_entry para idempotencia (ej. 'charge_id'). */
  sourceColumn: string;
  /** Valor del FK (id del cargo/conversión/cruce). */
  sourceId: string;
  /** Valor de `source` (texto libre). */
  source: string;
  memo: string;
  lines: PartnerLine[];
  entryDate?: string;
};

/**
 * Inserta (idempotente por sourceColumn=sourceId) un asiento `asentado` con
 * sus líneas. No throwea: devuelve `{ ok, entryCode|entryId|skipped|error }`.
 * Rechaza si las líneas no balancean (defensa de doble partida).
 */
async function postPartnerEntry(
  args: PostArgs,
): Promise<PartnerPostingResult> {
  try {
    const admin = createAdminClient();

    const totals = lineTotals(args.lines);
    if (!totals.balanced) {
      return { ok: false, error: "asiento desbalanceado (Σ debe ≠ Σ haber)" };
    }
    if (totals.debit <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // Idempotencia por origen.
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq(args.sourceColumn, args.sourceId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) return { ok: true, skipped: "entry-already-exists" };

    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: args.tenantId },
    );
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);
    const entryDate = args.entryDate ?? new Date().toISOString().slice(0, 10);

    const { data: inserted, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: args.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: args.memo,
        status: "asentado",
        source: args.source,
        [args.sourceColumn]: args.sourceId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !inserted) {
      return {
        ok: false,
        error: entryErr?.message ?? "no se pudo crear el asiento",
      };
    }

    const rows = args.lines.map((l) => ({ ...l, entry_id: inserted.id }));
    const { error: linesErr } = await admin.from("journal_lines").insert(rows);
    if (linesErr) {
      await admin.from("journal_entries").delete().eq("id", inserted.id);
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode, entryId: inserted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Asiento de un cargo del socio. Monto = net_amount (NUNCA el bruto si hay
 * nota de crédito). Idempotente por charge_id.
 */
export async function postChargeJournalEntry(input: {
  tenantId: string;
  chargeId: string;
  netAmountUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const admin = createAdminClient();
  const cogs = await resolveAccountId(admin, input.tenantId, FACTORY_COGS_CODE);
  const partner = await resolveAccountId(
    admin,
    input.tenantId,
    PARTNER_AC_CODE,
  );
  if (!cogs || !partner) {
    return { ok: false, skipped: "missing-account" };
  }
  return postPartnerEntry({
    tenantId: input.tenantId,
    sourceColumn: "charge_id",
    sourceId: input.chargeId,
    source: "supplier_charge",
    memo: "Causación de cargo del Socio China",
    lines: buildChargeLines(cogs, partner, input.netAmountUsd),
    entryDate: input.entryDate,
  });
}

/**
 * Asiento de una conversión (spread forex como revenue). Monto = comisión
 * captada (USD). Idempotente por conversion_id.
 */
export async function postConversionJournalEntry(input: {
  tenantId: string;
  conversionId: string;
  commissionUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const admin = createAdminClient();
  const partner = await resolveAccountId(
    admin,
    input.tenantId,
    PARTNER_AC_CODE,
  );
  const forex = await resolveAccountId(
    admin,
    input.tenantId,
    FOREX_REVENUE_CODE,
  );
  if (!partner || !forex) {
    return { ok: false, skipped: "missing-account" };
  }
  return postPartnerEntry({
    tenantId: input.tenantId,
    sourceColumn: "conversion_id",
    sourceId: input.conversionId,
    source: "currency_conversion",
    memo: "Spread por cambio de moneda (revenue)",
    lines: buildConversionLines(partner, forex, input.commissionUsd),
    entryDate: input.entryDate,
  });
}

/**
 * Asiento de un cruce contable (claim offset). Neutraliza margen. Monto en
 * USD. Idempotente por claim_offset_id.
 */
export async function postClaimOffsetJournalEntry(input: {
  tenantId: string;
  claimOffsetId: string;
  amountUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const admin = createAdminClient();
  const partner = await resolveAccountId(
    admin,
    input.tenantId,
    PARTNER_AC_CODE,
  );
  const cogs = await resolveAccountId(admin, input.tenantId, FACTORY_COGS_CODE);
  if (!partner || !cogs) {
    return { ok: false, skipped: "missing-account" };
  }
  return postPartnerEntry({
    tenantId: input.tenantId,
    sourceColumn: "claim_offset_id",
    sourceId: input.claimOffsetId,
    source: "supplier_claim_offset",
    memo: "Cruce contable reclamo→cliente (neutraliza margen)",
    lines: buildClaimOffsetLines(partner, cogs, input.amountUsd),
    entryDate: input.entryDate,
  });
}
