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

    // Idempotencia por origen: si YA hay un asiento vivo para esta fila,
    // devolvemos su id (no insertamos otro). Devolver el entryId permite al
    // caller re-aplicar el write-back del back-pointer aunque el asiento ya
    // existiera (idempotente de punta a punta). El filtro por tenant_id es
    // explícito (admin bypasea RLS) → no se cruza un asiento de otro tenant.
    const { data: existing, error: existsErr } = await admin
      .from("journal_entries")
      .select("id")
      .eq("tenant_id", args.tenantId)
      .eq(args.sourceColumn, args.sourceId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existsErr) return { ok: false, error: existsErr.message };
    if (existing?.id) {
      return { ok: true, entryId: existing.id, skipped: "entry-already-exists" };
    }

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

// ╔═══════════════════════════════════════════════════════════╗
// ║ Wiring (SDD-0110) · cablea el posting al alta + back-pointer║
// ╚═══════════════════════════════════════════════════════════╝
// Hasta SDD-0110 los `post*JournalEntry` existían pero NUNCA se invocaban →
// journal_entry_id quedaba siempre NULL. Estos wrappers best-effort (patrón
// `syncClaimIndemnityEntry`, SDD-0101) cierran el loop:
//   1. crean el asiento (idempotente por origen);
//   2. escriben el back-pointer journal_entry_id en la fila origen, sólo si
//      sigue NULL (no pisa un valor previo) y filtrando por tenant_id
//      (admin bypasea RLS → el scoping es explícito).
// No throwean: el alta del cargo/conversión/cruce ya quedó persistida; si el
// asiento falla, se logea y se puede re-postear (el índice de idempotencia lo
// hace seguro).

/**
 * Escribe el back-pointer `journal_entry_id` en la fila origen, idempotente:
 * sólo actualiza si la columna sigue NULL (`is journal_entry_id null`) → un
 * segundo intento no pisa nada. Filtra por tenant_id (defensa cross-tenant con
 * el admin client). Best-effort: devuelve `{ ok, error? }`, no throwea.
 */
async function writeBackJournalEntryId(args: {
  table: "supplier_charges" | "supplier_claim_offsets" | "currency_conversions";
  tenantId: string;
  rowId: string;
  entryId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from(args.table)
      .update({ journal_entry_id: args.entryId })
      .eq("id", args.rowId)
      .eq("tenant_id", args.tenantId)
      .is("journal_entry_id", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Cablea el asiento de un cargo del socio + escribe el back-pointer. Best-effort.
 * El monto es el NETO (amount − Σ notas de crédito) — el caller lo resuelve.
 */
export async function syncChargeJournalEntry(input: {
  tenantId: string;
  chargeId: string;
  netAmountUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const result = await postChargeJournalEntry(input);
  if (result.ok && result.entryId) {
    const wb = await writeBackJournalEntryId({
      table: "supplier_charges",
      tenantId: input.tenantId,
      rowId: input.chargeId,
      entryId: result.entryId,
    });
    if (!wb.ok) {
      console.error(
        `[financiero-china] cargo ${input.chargeId}: asiento ${result.entryId} creado pero el back-pointer falló:`,
        wb.error,
      );
    }
  } else if (!result.ok) {
    console.error(
      `[financiero-china] asiento del cargo ${input.chargeId} no creado:`,
      result.skipped ?? result.error,
    );
  }
  return result;
}

/**
 * Cablea el asiento de una conversión (spread forex = revenue) + back-pointer.
 * Best-effort. Monto = comisión captada (USD).
 */
export async function syncConversionJournalEntry(input: {
  tenantId: string;
  conversionId: string;
  commissionUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const result = await postConversionJournalEntry(input);
  if (result.ok && result.entryId) {
    const wb = await writeBackJournalEntryId({
      table: "currency_conversions",
      tenantId: input.tenantId,
      rowId: input.conversionId,
      entryId: result.entryId,
    });
    if (!wb.ok) {
      console.error(
        `[financiero-china] conversión ${input.conversionId}: asiento ${result.entryId} creado pero el back-pointer falló:`,
        wb.error,
      );
    }
  } else if (!result.ok && result.skipped !== "zero-amount") {
    // Una conversión sin comisión (spread 0) no genera asiento → no es error.
    console.error(
      `[financiero-china] asiento de la conversión ${input.conversionId} no creado:`,
      result.skipped ?? result.error,
    );
  }
  return result;
}

/**
 * Cablea el asiento de un cruce contable (claim offset) + back-pointer.
 * Best-effort. Monto en USD (amount_usd del cruce).
 */
export async function syncClaimOffsetJournalEntry(input: {
  tenantId: string;
  claimOffsetId: string;
  amountUsd: number;
  entryDate?: string;
}): Promise<PartnerPostingResult> {
  const result = await postClaimOffsetJournalEntry(input);
  if (result.ok && result.entryId) {
    const wb = await writeBackJournalEntryId({
      table: "supplier_claim_offsets",
      tenantId: input.tenantId,
      rowId: input.claimOffsetId,
      entryId: result.entryId,
    });
    if (!wb.ok) {
      console.error(
        `[financiero-china] cruce ${input.claimOffsetId}: asiento ${result.entryId} creado pero el back-pointer falló:`,
        wb.error,
      );
    }
  } else if (!result.ok) {
    console.error(
      `[financiero-china] asiento del cruce ${input.claimOffsetId} no creado:`,
      result.skipped ?? result.error,
    );
  }
  return result;
}
