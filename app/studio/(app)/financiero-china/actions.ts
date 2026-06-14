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
 * La página gatea admin-only; estas acciones igual resuelven tenant vía RLS.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  addCharge,
  applyCreditNote,
  transitionChargeStatus,
} from "@/lib/studio/partner-finance/charges-queries";
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
  validateChargeInput,
  validateCreditNoteInput,
  validateStatementInput,
  validateStatementLineInput,
  type ChargeStatus,
  type MatchConfidence,
  type MatchStatus,
  type StatementLineInput,
} from "@/lib/studio/partner-finance/types";

const ROUTE = "/studio/financiero-china";

type ActionResult = { ok?: boolean; error?: string };

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

  try {
    await addCharge(supabase, tenantId, v.input);
  } catch (e) {
    return { error: `No se pudo crear el cargo: ${(e as Error).message}` };
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
