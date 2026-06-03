/**
 * Queries de asientos (SDD-0040 · Contabilidad).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalSide,
  type Account,
  type AcctType,
} from "./account-types";
import type {
  EntryStatus,
  JournalEntry,
  JournalLine,
} from "./journal-types";

const ENTRY_COLUMNS =
  "id, tenant_id, entry_code, entry_date, memo, status, source, invoice_id, receipt_id, bill_id, supplier_payment_id, posted_at, created_at, updated_at, deleted_at";

export type JournalFilters = {
  status?: EntryStatus | "all";
  q?: string;
};

function coerceEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    entry_code: String(row.entry_code),
    entry_date: String(row.entry_date),
    memo: (row.memo as string | null) ?? null,
    status: row.status as EntryStatus,
    source: (row.source as JournalEntry["source"]) ?? "manual",
    invoice_id: (row.invoice_id as string | null) ?? null,
    receipt_id: (row.receipt_id as string | null) ?? null,
    bill_id: (row.bill_id as string | null) ?? null,
    supplier_payment_id: (row.supplier_payment_id as string | null) ?? null,
    posted_at: (row.posted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

function coerceLine(row: Record<string, unknown>): JournalLine {
  const acct = (row.accounts as { code?: string; name?: string } | null) ?? null;
  return {
    id: String(row.id),
    entry_id: String(row.entry_id),
    account_id: String(row.account_id),
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    line_memo: (row.line_memo as string | null) ?? null,
    account_code: acct?.code,
    account_name: acct?.name,
  };
}

/**
 * Totales de débito/crédito de un asiento a partir de sus líneas hidratadas.
 */
export function entryLineTotals(entry: JournalEntry): {
  debit: number;
  credit: number;
} {
  let debit = 0;
  let credit = 0;
  for (const l of entry.lines ?? []) {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  }
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return { debit: round2(debit), credit: round2(credit) };
}

/**
 * Lista los asientos del tenant con sus líneas (para mostrar el monto total).
 * `status` filtra por estado; "all" trae todos los vivos.
 */
export async function listEntries(
  supabase: SupabaseClient,
  filters: JournalFilters = {},
): Promise<JournalEntry[]> {
  let query = supabase
    .from("journal_entries")
    .select(
      `${ENTRY_COLUMNS}, journal_lines ( id, entry_id, account_id, debit, credit, line_memo, accounts ( code, name ) )`,
    )
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("entry_code", { ascending: false })
    .limit(500);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [`entry_code.ilike.%${q}%`, `memo.ilike.%${q}%`].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const entry = coerceEntry(row);
    const rawLines = (row.journal_lines as Record<string, unknown>[] | null) ?? [];
    entry.lines = rawLines.map(coerceLine);
    return entry;
  });
}

export async function getEntryByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      `${ENTRY_COLUMNS}, journal_lines ( id, entry_id, account_id, debit, credit, line_memo, accounts ( code, name ) )`,
    )
    .eq("entry_code", code)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const entry = coerceEntry(row);
  const rawLines = (row.journal_lines as Record<string, unknown>[] | null) ?? [];
  entry.lines = rawLines.map(coerceLine);
  return entry;
}

/** Un movimiento del libro mayor: la línea + el contexto del asiento + saldo corrido. */
export type LedgerMovement = {
  entry_id: string;
  entry_code: string;
  entry_date: string;
  status: EntryStatus;
  memo: string | null;
  line_memo: string | null;
  debit: number;
  credit: number;
  /** Saldo acumulado de la cuenta hasta este movimiento (según lado normal). */
  running: number;
};

export type AccountLedger = {
  account: Account;
  movements: LedgerMovement[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

/**
 * Libro mayor de una cuenta: movimientos de asientos `asentado` con saldo
 * corrido, ordenados por fecha ascendente. Solo postings directos a la cuenta
 * (las hojas son las que reciben movimientos).
 */
export async function ledgerForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<AccountLedger | null> {
  const { data: acctRow, error: acctErr } = await supabase
    .from("accounts")
    .select(
      "id, tenant_id, code, name, type, parent_id, qbo_type, is_postable, notes, created_at, updated_at",
    )
    .eq("id", accountId)
    .maybeSingle();
  if (acctErr) throw acctErr;
  if (!acctRow) return null;

  const account: Account = {
    id: String(acctRow.id),
    tenant_id: String(acctRow.tenant_id),
    code: String(acctRow.code),
    name: String(acctRow.name),
    type: acctRow.type as AcctType,
    parent_id: (acctRow.parent_id as string | null) ?? null,
    qbo_type: (acctRow.qbo_type as string | null) ?? null,
    is_postable: Boolean(acctRow.is_postable),
    notes: (acctRow.notes as string | null) ?? null,
    created_at: String(acctRow.created_at),
    updated_at: String(acctRow.updated_at),
  };

  const { data: lineRows, error: linesErr } = await supabase
    .from("journal_lines")
    .select(
      "entry_id, debit, credit, line_memo, journal_entries!inner ( entry_code, entry_date, status, memo, deleted_at )",
    )
    .eq("account_id", accountId)
    .limit(5000);
  if (linesErr) throw linesErr;

  type Row = {
    entry_id: string;
    debit: number;
    credit: number;
    line_memo: string | null;
    journal_entries: {
      entry_code: string;
      entry_date: string;
      status: EntryStatus;
      memo: string | null;
      deleted_at: string | null;
    } | null;
  };

  const rows = ((lineRows as unknown as Row[] | null) ?? [])
    .filter(
      (r) =>
        r.journal_entries &&
        r.journal_entries.status === "asentado" &&
        !r.journal_entries.deleted_at,
    )
    .map((r) => ({
      entry_id: r.entry_id,
      entry_code: r.journal_entries!.entry_code,
      entry_date: r.journal_entries!.entry_date,
      status: r.journal_entries!.status,
      memo: r.journal_entries!.memo,
      line_memo: r.line_memo,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
    }));

  // Orden cronológico para el saldo corrido (fecha, luego code).
  rows.sort((a, b) => {
    if (a.entry_date !== b.entry_date)
      return a.entry_date < b.entry_date ? -1 : 1;
    return a.entry_code < b.entry_code ? -1 : 1;
  });

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const sign = normalSide(account.type) === "debit" ? 1 : -1;

  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const movements: LedgerMovement[] = rows.map((r) => {
    running = round2(running + sign * (r.debit - r.credit));
    totalDebit = round2(totalDebit + r.debit);
    totalCredit = round2(totalCredit + r.credit);
    return {
      entry_id: r.entry_id,
      entry_code: r.entry_code,
      entry_date: r.entry_date,
      status: r.status,
      memo: r.memo,
      line_memo: r.line_memo,
      debit: r.debit,
      credit: r.credit,
      running,
    };
  });

  return {
    account,
    movements,
    totalDebit,
    totalCredit,
    balance: running,
  };
}

/** ¿Ya existe un asiento (vivo) para esta factura? Idempotencia del asiento automático. */
export async function entryExistsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}
