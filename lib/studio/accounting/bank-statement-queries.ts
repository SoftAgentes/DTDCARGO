/**
 * Queries del extracto bancario (SDD-0105 · Conciliación).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 * La sugerencia automática (`suggestMatches`) es una heurística PURA liviana
 * (monto + cuenta-banco coincidentes, asiento aún no conciliado) — display.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BankStatement,
  BankStatementLine,
  LineDirection,
  LineStatus,
  MatchConfidence,
  StatementStatus,
} from "./bank-statement-types";

const STATEMENT_COLUMNS =
  "id, tenant_id, account_id, period_label, period_start, period_end, bank_name, statement_ref, opening_balance, closing_balance, currency, status, notes, created_at, updated_at";

const LINE_COLUMNS =
  "id, statement_id, tenant_id, line_date, description, reference, direction, amount, status, matched_entry_id, match_confidence, note, reconciled_at, reconciled_by, created_at, updated_at";

function coerceStatement(row: Record<string, unknown>): BankStatement {
  const acct = (row.accounts as { code?: string; name?: string } | null) ?? null;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    account_id: String(row.account_id),
    period_label: String(row.period_label),
    period_start: (row.period_start as string | null) ?? null,
    period_end: (row.period_end as string | null) ?? null,
    bank_name: (row.bank_name as string | null) ?? null,
    statement_ref: (row.statement_ref as string | null) ?? null,
    opening_balance: Number(row.opening_balance) || 0,
    closing_balance: Number(row.closing_balance) || 0,
    currency: String(row.currency ?? "USD"),
    status: row.status as StatementStatus,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    account_code: acct?.code,
    account_name: acct?.name,
  };
}

function coerceLine(row: Record<string, unknown>): BankStatementLine {
  const je =
    (row.journal_entries as { entry_code?: string } | null) ?? null;
  return {
    id: String(row.id),
    statement_id: String(row.statement_id),
    tenant_id: String(row.tenant_id),
    line_date: String(row.line_date),
    description: String(row.description),
    reference: (row.reference as string | null) ?? null,
    direction: row.direction as LineDirection,
    amount: Number(row.amount) || 0,
    status: row.status as LineStatus,
    matched_entry_id: (row.matched_entry_id as string | null) ?? null,
    match_confidence: (row.match_confidence as MatchConfidence | null) ?? null,
    note: (row.note as string | null) ?? null,
    reconciled_at: (row.reconciled_at as string | null) ?? null,
    reconciled_by: (row.reconciled_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    matched_entry_code: je?.entry_code ?? null,
  };
}

/** Lista los extractos del tenant (cabecera + cuenta hidratada), recientes 1º. */
export async function listStatements(
  supabase: SupabaseClient,
): Promise<BankStatement[]> {
  const { data, error } = await supabase
    .from("bank_statements")
    .select(`${STATEMENT_COLUMNS}, accounts ( code, name )`)
    .order("period_label", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceStatement,
  );
}

/** Un extracto con sus movimientos (movimientos por fecha ascendente). */
export async function statementWithLines(
  supabase: SupabaseClient,
  statementId: string,
): Promise<BankStatement | null> {
  const { data, error } = await supabase
    .from("bank_statements")
    .select(`${STATEMENT_COLUMNS}, accounts ( code, name )`)
    .eq("id", statementId)
    .maybeSingle();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;
  const statement = coerceStatement(data as Record<string, unknown>);

  const { data: lineRows, error: linesErr } = await supabase
    .from("bank_statement_lines")
    .select(`${LINE_COLUMNS}, journal_entries ( entry_code )`)
    .eq("statement_id", statementId)
    .order("line_date", { ascending: true })
    .limit(2000);
  if (linesErr) throw linesErr;

  statement.lines = ((lineRows as Record<string, unknown>[] | null) ?? []).map(
    coerceLine,
  );
  return statement;
}

/** Un candidato de asiento del diario para ligar a un movimiento. */
export type EntryCandidate = {
  id: string;
  entry_code: string;
  entry_date: string;
  memo: string | null;
  /** Total del asiento (Σ debe = Σ haber). */
  amount: number;
  /** ¿Ya está ligado a algún movimiento de algún extracto? (1:1). */
  alreadyLinked: boolean;
  /** Confianza de la sugerencia (display), solo si es candidato sugerido. */
  confidence?: MatchConfidence;
};

/**
 * Candidatos del diario para conciliar un movimiento: asientos `asentado` vivos
 * que tocan la cuenta-banco del extracto. Marca cuáles ya están ligados (no se
 * pueden re-ligar: 1:1) y calcula una confianza de match PURA por monto.
 *
 * Liviano y display: la decisión final la toma el usuario en el LineMatchDrawer.
 */
export async function listEntryCandidates(
  supabase: SupabaseClient,
  opts: { accountId: string; tenantId: string },
): Promise<EntryCandidate[]> {
  // 1. Asientos asentados vivos del tenant que tienen una línea en la cuenta-banco.
  const { data: lineRows, error: lineErr } = await supabase
    .from("journal_lines")
    .select(
      "entry_id, debit, credit, journal_entries!inner ( id, entry_code, entry_date, memo, status, deleted_at, tenant_id )",
    )
    .eq("account_id", opts.accountId)
    .limit(2000);
  if (lineErr) throw lineErr;

  type Row = {
    entry_id: string;
    debit: number;
    credit: number;
    journal_entries: {
      id: string;
      entry_code: string;
      entry_date: string;
      memo: string | null;
      status: string;
      deleted_at: string | null;
      tenant_id: string;
    } | null;
  };

  const byEntry = new Map<string, EntryCandidate>();
  for (const r of (lineRows as unknown as Row[] | null) ?? []) {
    const je = r.journal_entries;
    if (!je) continue;
    if (je.status !== "asentado" || je.deleted_at) continue;
    if (je.tenant_id !== opts.tenantId) continue;
    const prev = byEntry.get(je.id);
    // El "monto" del movimiento en la cuenta-banco = |debe − haber| de esa línea.
    const lineAmount = Math.abs((Number(r.debit) || 0) - (Number(r.credit) || 0));
    if (prev) {
      prev.amount = round2(prev.amount + lineAmount);
    } else {
      byEntry.set(je.id, {
        id: je.id,
        entry_code: je.entry_code,
        entry_date: je.entry_date,
        memo: je.memo,
        amount: round2(lineAmount),
        alreadyLinked: false,
      });
    }
  }

  const candidates = [...byEntry.values()];
  if (candidates.length === 0) return [];

  // 2. ¿Cuáles ya están ligados a un movimiento? (1:1, anti doble-conciliación).
  const ids = candidates.map((c) => c.id);
  const { data: linkedRows, error: linkedErr } = await supabase
    .from("bank_statement_lines")
    .select("matched_entry_id")
    .in("matched_entry_id", ids)
    .limit(2000);
  if (linkedErr) throw linkedErr;
  const linked = new Set(
    ((linkedRows as { matched_entry_id: string | null }[] | null) ?? [])
      .map((r) => r.matched_entry_id)
      .filter((x): x is string => Boolean(x)),
  );
  for (const c of candidates) {
    if (linked.has(c.id)) c.alreadyLinked = true;
  }

  // Orden: no-ligados primero, luego por fecha descendente.
  candidates.sort((a, b) => {
    if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
    return a.entry_date < b.entry_date ? 1 : -1;
  });
  return candidates;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Confianza de match de un asiento contra un movimiento (heurística PURA).
 * Solo por monto (V1, display): exacto → high, ±2% → medium, ±10% → low,
 * fuera de eso → null (no se sugiere). Un asiento ya ligado nunca se sugiere.
 */
export function matchConfidenceFor(
  movementAmount: number,
  entry: { amount: number; alreadyLinked: boolean },
): MatchConfidence | null {
  if (entry.alreadyLinked) return null;
  const a = Math.abs(Number(movementAmount) || 0);
  const b = Math.abs(Number(entry.amount) || 0);
  if (a <= 0 || b <= 0) return null;
  const rel = Math.abs(a - b) / Math.max(a, b);
  if (rel < 0.005) return "high";
  if (rel <= 0.02) return "medium";
  if (rel <= 0.1) return "low";
  return null;
}

/**
 * Mejor sugerencia de asiento para un movimiento (display). Recorre los
 * candidatos de la cuenta-banco, calcula la confianza por monto y devuelve el
 * de mayor confianza no-ligado. PURA — el caller pasa los candidatos.
 */
export function suggestMatch(
  movement: { amount: number },
  candidates: EntryCandidate[],
): (EntryCandidate & { confidence: MatchConfidence }) | null {
  const rank: Record<MatchConfidence, number> = { high: 3, medium: 2, low: 1 };
  let best: (EntryCandidate & { confidence: MatchConfidence }) | null = null;
  for (const c of candidates ?? []) {
    const conf = matchConfidenceFor(movement.amount, c);
    if (!conf) continue;
    if (!best || rank[conf] > rank[best.confidence]) {
      best = { ...c, confidence: conf };
    }
  }
  return best;
}
