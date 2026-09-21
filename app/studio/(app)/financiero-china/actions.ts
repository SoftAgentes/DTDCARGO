/**
 * Server actions del módulo Financiero con el Socio China (SDD-0059 · Slice B2).
 *
 * Reusan el backend de Slice A + B1 (`lib/studio/partner-finance/`): queries
 * puras + el motor de match PURO `reconcileStatement`. Acá sólo se resuelve el
 * tenant del usuario (RLS), se parsea el FormData / payload, se valida con los
 * `validate*Input()` propios (no Zod) y se delega.
 *
 * Acciones:
 *  - importStatement   · crea el estado de cuenta + sus líneas + corre el match
 *                        auto (guarda la sugerencia de cada línea).
 *  - decideMatchLine   · confirma / corrige / rechaza la decisión de UNA línea.
 *  - closePeriod       · cierra el estado (marca reconciled en los cargos).
 *  - addChargeAction   · alta de un cargo del socio.
 *  - addCreditNoteAction · aplica una nota de crédito sobre un cargo.
 *  - reconcileNow      · re-corre el match de un estado abierto (sin cerrar).
 *
 * Cada acción lleva su propio gate de RBAC: `moduleEditDenial` las que mutan y
 * `moduleViewDenial` las dos lecturas del final (SDD-0497). Que la página gatee
 * admin-only NO alcanza — una server action es un endpoint invocable directo.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import {
  addCharge,
  applyCreditNote,
  transitionChargeStatus,
} from "@/lib/studio/partner-finance/charges-queries";
import { addConversion } from "@/lib/studio/partner-finance/conversions-queries";
import {
  addClaimOffset,
  markClaimOffsetPaidInChina,
  transitionClaimOffset,
  nextClaimOffsetStatus,
} from "@/lib/studio/partner-finance/claim-offsets-queries";
import { isClaimOffsetStatus } from "@/lib/studio/partner-finance/types";
import {
  syncChargeJournalEntry,
  syncConversionJournalEntry,
  syncClaimOffsetJournalEntry,
} from "@/lib/studio/partner-finance/posting";
import {
  getPartnerBalance,
  listLedgerEntries,
} from "@/lib/studio/partner-finance/ledger-queries";
import { listCharges } from "@/lib/studio/partner-finance/charges-queries";
import {
  reconcileStatement,
  type ReconcileCharge,
  type ReconcileLedgerEntry,
  type ReconcileLine,
} from "@/lib/studio/partner-finance/reconciliation";
import {
  addStatementLines,
  applyMatchDecision,
  closeStatement,
  createStatement,
  getStatementWithLines,
} from "@/lib/studio/partner-finance/statements-queries";
import {
  canTransitionCharge,
  isChargeStatus,
  isMatchConfidence,
  isMatchStatus,
  amountToUsd,
  validateChargeInput,
  validateClaimOffsetInput,
  validateConversionInput,
  validateCreditNoteInput,
  validateClaimPaymentInput,
  validateStatementInput,
  validateStatementLineInput,
  type ChargeStatus,
  type MatchConfidence,
  type MatchStatus,
  type StatementLineInput,
} from "@/lib/studio/partner-finance/types";

const ROUTE = "/studio/financiero-china";

type ActionResult = { ok?: boolean; error?: string; replayed?: boolean };

/** Resuelve el tenant del user logueado (RLS). null si no hay vínculo. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

// ── Importar estado de cuenta + auto-match ───────────────────────
/**
 * Crea el estado de cuenta del socio, inserta sus líneas crudas y corre el
 * motor de match auto contra los cargos + entries del socio. Persiste la
 * sugerencia de cada línea (match_status + confianza + id matcheado).
 *
 * El parser de archivo (CSV/XLSX) es Slice C — acá las líneas llegan ya
 * estructuradas (alta manual en el drawer de import). // TODO: upload CSV/XLSX.
 */
export async function importStatement(payload: {
  supplier_id: string;
  period_label: string;
  total_usd: number;
  total_rmb: number;
  lines: Array<Record<string, unknown>>;
}): Promise<ActionResult & { statementId?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Validar cabecera.
  const head = validateStatementInput({
    supplier_id: payload.supplier_id,
    period_label: payload.period_label,
    total_usd: payload.total_usd,
    total_rmb: payload.total_rmb,
  });
  if (!head.ok) {
    return { error: Object.values(head.fieldErrors)[0] ?? "Datos del estado inválidos." };
  }

  // Validar líneas (al menos una).
  const validLines: StatementLineInput[] = [];
  for (const raw of payload.lines ?? []) {
    const v = validateStatementLineInput(raw);
    if (!v.ok) {
      return { error: Object.values(v.fieldErrors)[0] ?? "Una línea del estado es inválida." };
    }
    validLines.push(v.input);
  }
  if (validLines.length === 0) {
    return { error: "El estado de cuenta necesita al menos una línea." };
  }

  // 1. Crear cabecera + líneas.
  let statementId: string;
  try {
    const statement = await createStatement(supabase, tenantId, head.input);
    statementId = statement.id;
    await addStatementLines(supabase, tenantId, statementId, validLines);
  } catch (e) {
    return { error: `No se pudo importar el estado: ${(e as Error).message}` };
  }

  // 2. Correr el match auto y persistir la sugerencia por línea.
  try {
    await runAutoMatch(supabase, statementId, payload.supplier_id);
  } catch (e) {
    // El import quedó persistido; el match se puede re-correr desde la UI.
    return {
      ok: true,
      statementId,
      error: `Importado, pero el match automático falló: ${(e as Error).message}`,
    };
  }

  revalidatePath(ROUTE);
  return { ok: true, statementId };
}

/**
 * Re-corre el match auto de un estado abierto (no lo cierra). Útil tras cargar
 * cargos/entries nuevos. Sólo re-sugiere a las líneas que siguen sin decisión
 * humana (match_manual / discrepancia resueltas a mano no se pisan).
 */
export async function reconcileNow(
  statementId: string,
  supplierId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  try {
    await runAutoMatch(supabase, statementId, supplierId);
  } catch (e) {
    return { error: `No se pudo re-correr el match: ${(e as Error).message}` };
  }
  revalidatePath(ROUTE);
  return { ok: true };
}

/**
 * Corre el motor PURO de match y persiste la sugerencia de cada línea. No pisa
 * decisiones humanas (match_manual). Reusa reconcileStatement (Slice B1).
 */
async function runAutoMatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  statementId: string,
  supplierId: string,
): Promise<void> {
  const statement = await getStatementWithLines(supabase, statementId);
  if (!statement) throw new Error("Estado de cuenta no encontrado.");

  const [charges, entries] = await Promise.all([
    listCharges(supabase, supplierId),
    listLedgerEntries(supabase, supplierId),
  ]);

  const recLines: ReconcileLine[] = statement.lines
    .filter((l) => l.deleted_at == null)
    .map((l) => ({
      id: l.id,
      raw_description: l.raw_description,
      raw_description_cn: l.raw_description_cn,
      amount: l.amount,
      currency: l.currency,
      line_date: l.line_date,
    }));

  const recCharges: ReconcileCharge[] = charges
    .filter((c) => c.status !== "cancelado")
    .map((c) => ({
      id: c.id,
      description: c.description,
      description_cn: c.description_cn,
      amount: c.amount,
      currency: c.currency,
      charged_on: c.charged_on,
    }));

  const recEntries: ReconcileLedgerEntry[] = entries.map((e) => ({
    id: e.id,
    description: e.description,
    description_cn: e.description_cn,
    amount_usd: e.amount_usd,
    amount_rmb: e.amount_rmb,
    currency_paid: e.currency_paid,
    occurred_on: e.occurred_on,
  }));

  const result = reconcileStatement(recLines, recCharges, recEntries);

  // No pisar líneas resueltas a mano.
  const manualLineIds = new Set(
    statement.lines.filter((l) => l.match_status === "match_manual").map((l) => l.id),
  );

  for (const lr of result.lines) {
    if (manualLineIds.has(lr.line_id)) continue;
    await applyMatchDecision(supabase, lr.line_id, {
      match_status: lr.match_status,
      matched_charge_id: lr.matched_charge_id,
      matched_ledger_entry_id: lr.matched_ledger_entry_id,
      match_confidence: lr.match_confidence,
    });
  }
}

// ── Decisión de match de UNA línea (confirmar / corregir / rechazar) ──
/**
 * Persiste la decisión del operador sobre una línea del estado:
 *  - confirmar la sugerencia auto (`match_auto`).
 *  - corregir a un match manual (`match_manual` + chargeId/entryId elegido).
 *  - rechazar (`solo_en_estado`, suelta el candidato).
 */
export async function decideMatchLine(payload: {
  lineId: string;
  match_status: string;
  matched_charge_id?: string | null;
  matched_ledger_entry_id?: string | null;
  match_confidence?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  if (!payload.lineId) return { error: "Falta la línea a resolver." };
  if (!isMatchStatus(payload.match_status)) {
    return { error: "Estado de match inválido." };
  }
  const status = payload.match_status as MatchStatus;

  const confidence =
    payload.match_confidence && isMatchConfidence(payload.match_confidence)
      ? (payload.match_confidence as MatchConfidence)
      : null;

  try {
    await applyMatchDecision(supabase, payload.lineId, {
      match_status: status,
      matched_charge_id: payload.matched_charge_id ?? null,
      matched_ledger_entry_id: payload.matched_ledger_entry_id ?? null,
      match_confidence: confidence,
      note: payload.note ?? null,
    });
  } catch (e) {
    return { error: `No se pudo guardar la decisión: ${(e as Error).message}` };
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

// ── Cerrar período ───────────────────────────────────────────────
/** Cierra el estado de cuenta (marca reconciled en los cargos matcheados). */
export async function closePeriod(statementId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };
  if (!statementId) return { error: "Falta el estado de cuenta." };

  try {
    await closeStatement(supabase, statementId);
  } catch (e) {
    return { error: `No se pudo cerrar el período: ${(e as Error).message}` };
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

// ── Cargos ───────────────────────────────────────────────────────
/** Alta de un cargo facturado por el socio. */
export async function addChargeAction(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const v = validateChargeInput(raw);
  if (!v.ok) {
    return { error: Object.values(v.fieldErrors)[0] ?? "Datos del cargo inválidos." };
  }

  let charge: Awaited<ReturnType<typeof addCharge>>;
  try {
    charge = await addCharge(supabase, tenantId, v.input);
  } catch (e) {
    return { error: `No se pudo crear el cargo: ${(e as Error).message}` };
  }

  // Asiento de causación (SDD-0110). Best-effort: si falla no rompe el alta.
  // Un cargo nuevo no tiene notas de crédito → net = amount.
  //  - No se asienta un cargo nacido `cancelado`.
  //  - El monto se convierte a USD funcional (el plan lleva el mayor en USD).
  //    Un cargo no-USD SIN fx_rate válido NO se asienta (preferible dejar
  //    journal_entry_id NULL que meter un asiento en moneda equivocada — lo
  //    captura el detector de no-asentados).
  if (charge.status !== "cancelado") {
    const conv = amountToUsd({
      amount: charge.amount,
      currency: charge.currency,
      fxRate: charge.fx_rate,
    });
    if (conv.ok) {
      await syncChargeJournalEntry({
        tenantId,
        chargeId: charge.id,
        netAmountUsd: conv.usd,
        entryDate: charge.charged_on,
      });
    } else {
      console.error(
        `[financiero-china] cargo ${charge.id} (${charge.currency}) sin fx_rate válido — no se asienta (journal_entry_id queda NULL).`,
      );
    }
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

// ── Conversión de divisa (spread forex = revenue) ─────────────────
/**
 * Alta de una conversión de divisa con su asiento del spread (revenue).
 * SDD-0110: cablea `syncConversionJournalEntry` tras persistir la fila. El
 * monto del asiento = comisión captada (commission_amount, computada en lib).
 * Best-effort: una comisión 0 (sin spread) no genera asiento (no es error).
 */
export async function addConversionAction(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const v = validateConversionInput(raw);
  if (!v.ok) {
    return { error: Object.values(v.fieldErrors)[0] ?? "Datos de la conversión inválidos." };
  }

  let conversion: Awaited<ReturnType<typeof addConversion>>;
  try {
    conversion = await addConversion(supabase, tenantId, v.input);
  } catch (e) {
    return { error: `No se pudo registrar la conversión: ${(e as Error).message}` };
  }

  // La comisión captada está en la moneda `from` (computeConversionSpread). El
  // ingreso forex (4.6) lleva el mayor en USD. Si `from` es USD/USDT → 1:1. Si
  // `from` es VES no hay tasa VES/USD directa persistida (effective_rate es
  // from→to) → NO asentamos en moneda equivocada; queda visible en el detector.
  const commConv = amountToUsd({
    amount: conversion.commission_amount,
    currency: conversion.from_currency,
    fxRate: null,
  });
  if (commConv.ok) {
    await syncConversionJournalEntry({
      tenantId,
      conversionId: conversion.id,
      commissionUsd: commConv.usd,
      entryDate: conversion.converted_on,
    });
  } else {
    console.error(
      `[financiero-china] conversión ${conversion.id}: comisión en ${conversion.from_currency} sin tasa a USD — no se asienta (journal_entry_id queda NULL).`,
    );
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

// ── Cruce contable (claim offset) ─────────────────────────────────
/**
 * Alta de un cruce contable reclamo→cliente con su asiento de neutralización
 * de margen. SDD-0110: cablea `syncClaimOffsetJournalEntry` tras persistir la
 * fila. El monto del asiento = amount_usd del cruce. Best-effort.
 */
export async function addClaimOffsetAction(
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const v = validateClaimOffsetInput(raw);
  if (!v.ok) {
    return { error: Object.values(v.fieldErrors)[0] ?? "Datos del cruce inválidos." };
  }

  let claimOffset: Awaited<ReturnType<typeof addClaimOffset>>;
  try {
    claimOffset = await addClaimOffset(supabase, tenantId, v.input);
  } catch (e) {
    return { error: `No se pudo registrar el cruce: ${(e as Error).message}` };
  }

  // El cruce ya se almacena en USD (columna amount_usd) → sin conversión.
  await syncClaimOffsetJournalEntry({
    tenantId,
    claimOffsetId: claimOffset.id,
    amountUsd: claimOffset.amount_usd,
    entryDate: claimOffset.claimed_on,
  });

  revalidatePath(ROUTE);
  return { ok: true };
}

/**
 * SDD-0115 sub-slice 2: avanza un cruce al SIGUIENTE estado de la máquina
 * (reclamado → reconocido_proveedor → pagado_en_china → aplicado_a_cliente →
 * cerrado). El guard `canTransitionClaimOffset` (en la query) rechaza saltos; el
 * `.eq("status", from)` es optimista (la fila debe seguir en `from`). RLS por
 * tenant + gate de rol. El asiento ya se posteó al crear el cruce.
 */
export async function transitionClaimOffsetAction(
  raw: {
    claimId?: string;
    from?: string;
    effectiveDate?: string;
    reason?: string;
    requestRef?: string;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };

  const claimId = String(raw.claimId ?? "").trim();
  const from = String(raw.from ?? "").trim();
  if (!claimId || !isClaimOffsetStatus(from)) {
    return { error: "Cruce o estado inválido." };
  }
  const to = nextClaimOffsetStatus(from);
  if (!to) return { error: "El cruce ya está en su estado final." };

  if (from === "reconocido_proveedor") {
    const validation = validateClaimPaymentInput({
      claim_id: claimId,
      from,
      effective_date: raw.effectiveDate,
      reason: raw.reason,
      request_ref: raw.requestRef,
    });
    if (!validation.ok) return { error: validation.error };

    try {
      const result = await markClaimOffsetPaidInChina(supabase, {
        claimId: validation.input.claim_id,
        effectiveDate: validation.input.effective_date,
        reason: validation.input.reason,
        requestRef: validation.input.request_ref,
      });
      revalidatePath(ROUTE);
      return { ok: true, replayed: result === "replayed" };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
      if (code === "42501") return { error: "No tienes permiso para declarar este pago." };
      if (code === "22023") return { error: "Revisa el motivo y la fecha efectiva." };
      if (code === "40001") return { error: "El cruce cambió. Actualiza la página antes de reintentar." };
      if (code === "P0002") return { error: "El cruce ya no está disponible." };
      return {
        error: `No se pudo declarar el pago. Referencia: ${validation.input.request_ref}`,
      };
    }
  }

  try {
    await transitionClaimOffset(supabase, claimId, from, to);
  } catch (e) {
    return { error: `No se pudo avanzar el cruce: ${(e as Error).message}` };
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

/**
 * Transición de estado de un cargo (disputar / cancelar / revertir disputa).
 * Guard `canTransitionCharge` (la query ya lo aplica; lo validamos antes para
 * un error claro).
 */
export async function transitionCharge(payload: {
  chargeId: string;
  from: string;
  to: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  if (!isChargeStatus(payload.from) || !isChargeStatus(payload.to)) {
    return { error: "Estado de cargo inválido." };
  }
  const from = payload.from as ChargeStatus;
  const to = payload.to as ChargeStatus;
  if (!canTransitionCharge(from, to)) {
    return { error: `No se puede pasar el cargo de ${from} a ${to}.` };
  }

  try {
    await transitionChargeStatus(supabase, payload.chargeId, from, to);
  } catch (e) {
    return { error: `No se pudo cambiar el estado: ${(e as Error).message}` };
  }

  revalidatePath(ROUTE);
  return { ok: true };
}

// ── Nota de crédito ──────────────────────────────────────────────
/** Aplica una nota de crédito sobre un cargo (recalcula net_amount). */
export async function addCreditNoteAction(
  raw: Record<string, unknown>,
): Promise<ActionResult & { net_amount?: number }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "financiero-china");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const v = validateCreditNoteInput(raw);
  if (!v.ok) {
    return { error: Object.values(v.fieldErrors)[0] ?? "Datos de la nota inválidos." };
  }

  try {
    const { net_amount } = await applyCreditNote(supabase, tenantId, v.input);
    revalidatePath(ROUTE);
    return { ok: true, net_amount };
  } catch (e) {
    return { error: `No se pudo aplicar la nota de crédito: ${(e as Error).message}` };
  }
}

// ── Lecturas (para cambio de socio + detalle de estado en la UI) ──
//
// 🔴 Las dos lecturas de esta sección llevan `moduleViewDenial` (SDD-0497), no
// `moduleEditDenial`: no mutan nada, pero exponen dinero. El gate de VISTA es el
// que corresponde y además arrastra el segundo candado de superadministrador,
// porque `financiero-china` está en SUPERADMIN_ONLY_MODULES (rbac.ts).
//
// Hasta esta spec sólo llamaban a `resolveTenant`. El `requireModuleView` del
// layout protege la PÁGINA; una server action es un endpoint invocable directo
// (SDD-0085 §Seguridad), y la policy viva de las tablas del socio —
// `supplier_charges`, `partner_ledger_entries`, `partner_statements`,
// `partner_statement_lines` (0114/0115)— sólo compara `tenant_id`, sin predicado
// de rol. O sea que cualquier miembro autenticado del tenant leía saldo del
// socio, libro mayor y estados de cuenta de un módulo que la matriz reserva a
// admin. La cabecera de `0356_superadmin_legal_renditions_gate.sql:16-22` daba
// por hecho un gate de app que en estas dos funciones no existía.
/**
 * Saldo neto + libro mayor + cargos de un socio. Para que el cliente recargue
 * la cuenta corriente / cargos al cambiar el socio del selector sin un full
 * reload. Datos serializables. RLS por tenant.
 */
export async function getSupplierFinance(supplierId: string): Promise<
  | {
      ok: true;
      balance: import("@/lib/studio/partner-finance/types").PartnerBalance;
      ledgerEntries: import("@/lib/studio/partner-finance/types").PartnerLedgerEntry[];
      charges: import("@/lib/studio/partner-finance/types").SupplierChargeWithNet[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "financiero-china");
  if (denial) return { ok: false, error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { ok: false, error: "No se pudo resolver el tenant." };
  if (!supplierId) return { ok: false, error: "Falta el socio." };

  try {
    const [balance, ledgerEntries, charges] = await Promise.all([
      getPartnerBalance(supabase, supplierId),
      listLedgerEntries(supabase, supplierId),
      listCharges(supabase, supplierId),
    ]);
    return { ok: true, balance, ledgerEntries, charges };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Detalle de un estado de cuenta: cabecera + líneas (con su sugerencia de
 * match ya persistida) + los cargos / entries vivos del socio para el panel de
 * match manual. Datos serializables. RLS por tenant.
 */
export async function getStatementDetail(
  statementId: string,
  supplierId: string,
): Promise<
  | {
      ok: true;
      statement: import("@/lib/studio/partner-finance/types").PartnerStatementWithLines;
      charges: import("@/lib/studio/partner-finance/types").SupplierChargeWithNet[];
      ledgerEntries: import("@/lib/studio/partner-finance/types").PartnerLedgerEntry[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "financiero-china");
  if (denial) return { ok: false, error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { ok: false, error: "No se pudo resolver el tenant." };

  try {
    const statement = await getStatementWithLines(supabase, statementId);
    if (!statement) return { ok: false, error: "Estado de cuenta no encontrado." };

    const [charges, ledgerEntries] = await Promise.all([
      listCharges(supabase, supplierId),
      listLedgerEntries(supabase, supplierId),
    ]);
    return { ok: true, statement, charges, ledgerEntries };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
