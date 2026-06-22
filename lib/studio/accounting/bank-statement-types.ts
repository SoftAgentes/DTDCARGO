/**
 * Tipos del extracto bancario y sus movimientos (SDD-0105 · Conciliación).
 * Matchea el schema de supabase/migrations/0167_bank_reconciliation.sql.
 *
 * Conciliar SOLO vincula un movimiento a un asiento EXISTENTE del diario
 * (matched_entry_id) o lo marca manual/ignorado — NO crea ni muta asientos del
 * mayor en V1. Las funciones de balance del extracto son PURAS (testeables).
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ── Extracto (cabecera) ───────────────────────────────────────

export type StatementStatus = "open" | "reconciled" | "archived";

export const STATEMENT_STATUSES: StatementStatus[] = [
  "open",
  "reconciled",
  "archived",
];

export type BankStatement = {
  id: string;
  tenant_id: string;
  account_id: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  bank_name: string | null;
  statement_ref: string | null;
  opening_balance: number;
  closing_balance: number;
  currency: string;
  status: StatementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Hidratados via join / agregado (opcionales, para mostrar). */
  account_code?: string;
  account_name?: string;
  lines?: BankStatementLine[];
};

// ── Movimientos ───────────────────────────────────────────────

/** Sentido del movimiento: crédito = entrada, débito = salida. */
export type LineDirection = "credit" | "debit";

/** Estado de conciliación del movimiento. */
export type LineStatus = "pending" | "matched" | "manual" | "ignored";

export const LINE_STATUSES: LineStatus[] = [
  "pending",
  "matched",
  "manual",
  "ignored",
];

export type MatchConfidence = "high" | "medium" | "low";

export type BankStatementLine = {
  id: string;
  statement_id: string;
  tenant_id: string;
  line_date: string;
  description: string;
  reference: string | null;
  direction: LineDirection;
  amount: number;
  status: LineStatus;
  matched_entry_id: string | null;
  match_confidence: MatchConfidence | null;
  note: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_at: string;
  updated_at: string;
  /** Hidratado: code del asiento ligado (para mostrar). */
  matched_entry_code?: string | null;
};

// ── Inputs del operador (sin id/timestamps) ───────────────────

/** Lo que el operador edita en el StatementDrawer (cabecera + movimientos). */
export type StatementInput = {
  account_id: string;
  period_label: string;
  bank_name: string | null;
  statement_ref: string | null;
  opening_balance: number;
  closing_balance: number;
  currency: string;
  notes: string | null;
  lines: StatementLineInput[];
};

/** Un movimiento crudo del editor (lo que el operador tipea/pega). */
export type StatementLineInput = {
  line_date: string;
  description: string;
  reference: string | null;
  direction: LineDirection;
  amount: number;
};

// ── Labels + tonos ────────────────────────────────────────────

export const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  open: "Abierto",
  reconciled: "Conciliado",
  archived: "Archivado",
};

export function statementStatusLabel(s: StatementStatus): string {
  return STATEMENT_STATUS_LABEL[s] ?? s;
}

export function statementStatusBadgeTone(s: StatementStatus): BadgeTone {
  switch (s) {
    case "reconciled":
      return "success";
    case "archived":
      return "neutral";
    case "open":
      return "info";
  }
}

export const LINE_STATUS_LABEL: Record<LineStatus, string> = {
  pending: "Pendiente",
  matched: "Conciliado",
  manual: "Manual",
  ignored: "Ignorado",
};

export function lineStatusLabel(s: LineStatus): string {
  return LINE_STATUS_LABEL[s] ?? s;
}

export function lineStatusBadgeTone(s: LineStatus): BadgeTone {
  switch (s) {
    case "matched":
      return "success";
    case "manual":
      return "info";
    case "ignored":
      return "neutral";
    case "pending":
      return "warning";
  }
}

export function lineDirectionLabel(d: LineDirection): string {
  return d === "credit" ? "Crédito" : "Débito";
}

export function matchConfidenceLabel(c: MatchConfidence): string {
  switch (c) {
    case "high":
      return "Match seguro";
    case "medium":
      return "Match probable";
    case "low":
      return "Match dudoso";
  }
}

export function matchConfidenceBadgeTone(c: MatchConfidence): BadgeTone {
  switch (c) {
    case "high":
      return "success";
    case "medium":
      return "warning";
    case "low":
      return "danger";
  }
}

// ── Balance + KPIs del extracto (PUROS) ───────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type StatementBalance = {
  /** Σ de los movimientos crédito (entradas). */
  totalCredit: number;
  /** Σ de los movimientos débito (salidas). */
  totalDebit: number;
  /** opening + créditos − débitos (saldo final esperado del extracto). */
  expectedClosing: number;
  /** closing_balance declarado − expectedClosing. 0 = cuadra. */
  difference: number;
  /** ¿La tira de saldos cuadra? (|difference| < 0.005). */
  balanced: boolean;
};

/**
 * Tira de saldos del extracto. PURA — testeable sin DB.
 *
 *   expectedClosing = opening + Σ créditos − Σ débitos
 *   difference      = closing declarado − expectedClosing
 *
 * `balanced` cuando la diferencia es ~0 (el extracto cuadra contra sus
 * movimientos). Solo entran montos >= 0; el signo lo da `direction`.
 */
export function computeStatementBalance(
  openingBalance: number,
  closingBalance: number,
  lines: { direction: LineDirection; amount: number }[],
): StatementBalance {
  let totalCredit = 0;
  let totalDebit = 0;
  for (const l of lines ?? []) {
    const amt = Math.max(0, Number(l.amount) || 0);
    if (l.direction === "credit") totalCredit += amt;
    else totalDebit += amt;
  }
  totalCredit = round2(totalCredit);
  totalDebit = round2(totalDebit);
  const opening = round2(Number(openingBalance) || 0);
  const closing = round2(Number(closingBalance) || 0);
  const expectedClosing = round2(opening + totalCredit - totalDebit);
  const difference = round2(closing - expectedClosing);
  return {
    totalCredit,
    totalDebit,
    expectedClosing,
    difference,
    balanced: Math.abs(difference) < 0.005,
  };
}

export type StatementKpis = {
  imported: number;
  reconciled: number;
  pending: number;
  /** % de movimientos conciliados (matched + manual) sobre el total. */
  reconciledPct: number;
};

/**
 * KPIs de conciliación de un set de movimientos. PURA. "Conciliados" cuenta
 * matched + manual (ambos son "resueltos con conciliación"); "pendientes" son
 * los `pending`; los `ignored` no cuentan como pendientes ni como conciliados.
 */
export function computeStatementKpis(
  lines: { status: LineStatus }[],
): StatementKpis {
  const imported = lines?.length ?? 0;
  let reconciled = 0;
  let pending = 0;
  for (const l of lines ?? []) {
    if (l.status === "matched" || l.status === "manual") reconciled += 1;
    else if (l.status === "pending") pending += 1;
  }
  const reconciledPct =
    imported > 0 ? Math.round((reconciled / imported) * 100) : 0;
  return { imported, reconciled, pending, reconciledPct };
}

// ── Validadores (sin Zod) ─────────────────────────────────────

export type StatementActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof StatementInput | "lines", string>>;
  createdId?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-\d{2}$/;

/**
 * Normaliza líneas crudas del extracto a StatementLineInput[]. Descarta líneas
 * sin fecha, sin descripción o con monto <= 0. Negativos → descartados.
 */
export function normalizeStatementLines(raw: unknown): StatementLineInput[] {
  if (!Array.isArray(raw)) return [];
  const out: StatementLineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const line_date = String(r.line_date ?? "").trim();
    const description = String(r.description ?? "").trim();
    const amount = round2(Number(r.amount) || 0);
    const direction: LineDirection =
      String(r.direction ?? "") === "debit" ? "debit" : "credit";
    if (!DATE_RE.test(line_date)) continue;
    if (!description) continue;
    if (amount <= 0) continue;
    out.push({
      line_date,
      description,
      reference:
        typeof r.reference === "string" && r.reference.trim()
          ? r.reference.trim()
          : null,
      direction,
      amount,
    });
  }
  return out;
}

/** Input crudo del extracto (lines puede venir parcial; se normaliza). */
export type StatementInputRaw = Omit<Partial<StatementInput>, "lines"> & {
  lines?: unknown;
};

/**
 * Validación manual del input del extracto (sin Zod, patrón del repo).
 *  - account_id requerido (cuenta banco/caja del plan, se valida postable en la action).
 *  - period_label formato YYYY-MM.
 *  - opening/closing numéricos.
 *  - al menos 1 movimiento válido.
 */
export function validateStatementInput(input: StatementInputRaw): {
  input?: StatementInput;
  fieldErrors?: StatementActionState["fieldErrors"];
} {
  const errors: StatementActionState["fieldErrors"] = {};

  const account_id = (input.account_id ?? "").trim();
  if (!account_id) {
    errors.account_id = "Elige la cuenta del banco / caja.";
  }

  const period_label = (input.period_label ?? "").trim();
  if (!period_label) {
    errors.period_label = "Indica el período del extracto (YYYY-MM).";
  } else if (!PERIOD_RE.test(period_label)) {
    errors.period_label = "El período debe tener formato YYYY-MM (ej. 2026-05).";
  }

  const opening = round2(Number(input.opening_balance) || 0);
  const closing = round2(Number(input.closing_balance) || 0);

  const lines = normalizeStatementLines(input.lines);
  if (lines.length < 1) {
    errors.lines = "Carga al menos un movimiento del extracto.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      account_id,
      period_label,
      bank_name: input.bank_name?.trim() || null,
      statement_ref: input.statement_ref?.trim() || null,
      opening_balance: opening,
      closing_balance: closing,
      currency: input.currency?.trim() || "USD",
      notes: input.notes?.trim() || null,
      lines,
    },
  };
}
