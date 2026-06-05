/**
 * Queries del estado de cuenta del Socio China + sus líneas
 * (SDD-0059 · Slice B1). Funciones PURAS que reciben un SupabaseClient; RLS
 * filtra por tenant_id. El motor de match vive en reconciliation.ts (PURO, sin
 * DB); estas queries SÓLO persisten/leen.
 *
 *  - createStatement       · cabecera del estado importado.
 *  - addStatementLines      · inserta las líneas crudas del estado.
 *  - listStatements         · estados de un tenant (opcional por socio).
 *  - getStatementWithLines  · cabecera + líneas.
 *  - applyMatchDecision     · persiste la decisión de match de UNA línea.
 *  - closeStatement         · status → 'cerrado' + marca reconciled en los
 *                             cargos matcheados (reusa charges-queries).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { markChargesReconciled } from "./charges-queries";
import {
  num,
  type MatchConfidence,
  type MatchStatus,
  type PartnerStatement,
  type PartnerStatementLine,
  type PartnerStatementWithLines,
  type StatementInput,
  type StatementLineInput,
} from "./types";

const STATEMENT_COLUMNS =
  "id, tenant_id, supplier_id, period_label, imported_at, source_file_document_id, total_usd, total_rmb, status, created_at, deleted_at";

const LINE_COLUMNS =
  "id, tenant_id, statement_id, raw_description, raw_description_cn, amount, currency, line_date, match_status, matched_charge_id, matched_ledger_entry_id, match_confidence, note, created_at, deleted_at";

function coerceStatement(r: Record<string, unknown>): PartnerStatement {
  return {
    ...(r as unknown as PartnerStatement),
    total_usd: num(r.total_usd),
    total_rmb: num(r.total_rmb),
  };
}

function coerceLine(r: Record<string, unknown>): PartnerStatementLine {
  return {
    ...(r as unknown as PartnerStatementLine),
    amount: num(r.amount),
  };
}

/** Inserta la cabecera de un estado de cuenta. RLS por tenant. */
export async function createStatement(
  supabase: SupabaseClient,
  tenantId: string,
  input: StatementInput,
): Promise<PartnerStatement> {
  const { data, error } = await supabase
    .from("partner_statements")
    .insert({
      tenant_id: tenantId,
      supplier_id: input.supplier_id,
      period_label: input.period_label,
      source_file_document_id: input.source_file_document_id,
      total_usd: input.total_usd,
      total_rmb: input.total_rmb,
      status: "importado",
    })
    .select(STATEMENT_COLUMNS)
    .single();
  if (error) throw error;
  return coerceStatement(data as Record<string, unknown>);
}

/**
 * Inserta en lote las líneas crudas de un estado de cuenta. Todas arrancan en
 * `sin_match` (el motor las clasifica en una pasada aparte). Devuelve las filas
 * creadas. No-op si la lista viene vacía. RLS por tenant.
 */
export async function addStatementLines(
  supabase: SupabaseClient,
  tenantId: string,
  statementId: string,
  lines: StatementLineInput[],
): Promise<PartnerStatementLine[]> {
  if (lines.length === 0) return [];
  const payload = lines.map((l) => ({
    tenant_id: tenantId,
    statement_id: statementId,
    raw_description: l.raw_description,
    raw_description_cn: l.raw_description_cn,
    amount: l.amount,
    currency: l.currency,
    line_date: l.line_date ?? undefined,
    match_status: "sin_match" as MatchStatus,
  }));
  const { data, error } = await supabase
    .from("partner_statement_lines")
    .insert(payload)
    .select(LINE_COLUMNS);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceLine);
}

/**
 * Estados de cuenta del tenant (más reciente primero). Sin `supplierId` → todos.
 * RLS por tenant.
 */
export async function listStatements(
  supabase: SupabaseClient,
  supplierId?: string,
): Promise<PartnerStatement[]> {
  let q = supabase
    .from("partner_statements")
    .select(STATEMENT_COLUMNS)
    .order("imported_at", { ascending: false })
    .limit(2000);
  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceStatement);
}

/** Cabecera + líneas de un estado. null si no existe / no es del tenant. */
export async function getStatementWithLines(
  supabase: SupabaseClient,
  statementId: string,
): Promise<PartnerStatementWithLines | null> {
  const { data, error } = await supabase
    .from("partner_statements")
    .select(STATEMENT_COLUMNS)
    .eq("id", statementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const statement = coerceStatement(data as Record<string, unknown>);

  const { data: lineData, error: lineErr } = await supabase
    .from("partner_statement_lines")
    .select(LINE_COLUMNS)
    .eq("statement_id", statementId)
    .is("deleted_at", null)
    .order("line_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (lineErr) throw lineErr;

  const lines = ((lineData as Record<string, unknown>[] | null) ?? []).map(
    coerceLine,
  );
  return { ...statement, lines };
}

/**
 * Persiste la decisión de match de UNA línea (auto-propuesta o resuelta a mano
 * por el operador): match_status + matched ids + confianza. RLS por tenant.
 * Sólo escribe el id que corresponde al tipo de match (el otro va a null).
 */
export async function applyMatchDecision(
  supabase: SupabaseClient,
  lineId: string,
  decision: {
    match_status: MatchStatus;
    matched_charge_id?: string | null;
    matched_ledger_entry_id?: string | null;
    match_confidence?: MatchConfidence | null;
    note?: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    match_status: decision.match_status,
    matched_charge_id: decision.matched_charge_id ?? null,
    matched_ledger_entry_id: decision.matched_ledger_entry_id ?? null,
    match_confidence: decision.match_confidence ?? null,
  };
  if (decision.note !== undefined) payload.note = decision.note;

  const { error } = await supabase
    .from("partner_statement_lines")
    .update(payload)
    .eq("id", lineId)
    .is("deleted_at", null);
  if (error) throw error;
}

/**
 * Cierra un estado de cuenta: status → 'cerrado' y marca `reconciled = true` en
 * todos los cargos atados a sus líneas (matched_charge_id de las líneas vivas).
 * Reusa markChargesReconciled de charges-queries. RLS por tenant.
 */
export async function closeStatement(
  supabase: SupabaseClient,
  statementId: string,
): Promise<void> {
  // 1. Cargos atados a las líneas vivas de este estado.
  const { data: lineData, error: lineErr } = await supabase
    .from("partner_statement_lines")
    .select("matched_charge_id")
    .eq("statement_id", statementId)
    .is("deleted_at", null);
  if (lineErr) throw lineErr;

  const chargeIds = Array.from(
    new Set(
      ((lineData as Record<string, unknown>[] | null) ?? [])
        .map((r) => r.matched_charge_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  // 2. Marcar esos cargos como reconciliados.
  await markChargesReconciled(supabase, chargeIds);

  // 3. Cerrar el estado.
  const { error } = await supabase
    .from("partner_statements")
    .update({ status: "cerrado" })
    .eq("id", statementId)
    .is("deleted_at", null);
  if (error) throw error;
}
