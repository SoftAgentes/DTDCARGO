/**
 * Queries de asientos (SDD-0040 · Contabilidad).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import {
  normalSide,
  type Account,
  type AcctType,
} from "./account-types";
import {
  ENTRY_CODE_RE,
  type EntryStatus,
  type JournalEntry,
  type JournalEntryProtection,
  type JournalLine,
} from "./journal-types";

const ENTRY_COLUMNS =
  "id, tenant_id, entry_code, entry_date, memo, status, source, invoice_id, receipt_id, bill_id, supplier_payment_id, posted_at, created_at, updated_at, deleted_at";

const PROTECTION_COLUMNS =
  "id, tenant_id, entry_code, source, status, deleted_at, invoice_id, reverses_entry_id";
const HEADER_FIELDS = ["id", "tenant_id", "entry_code", "source", "status", "deleted_at", "invoice_id", "reverses_entry_id"] as const;
const KNOWN_SOURCES = ["manual", "invoice", "invoice_reversal", "receipt", "supplier_bill", "supplier_payment", "expense", "depreciacion"];
type RawEntry = Record<string, unknown>;
const isRecord = (value: unknown): value is RawEntry =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const knownId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const nullableId = (value: unknown): boolean => value === null || knownId(value);
const knownSource = (value: unknown): boolean => typeof value === "string" && KNOWN_SOURCES.includes(value);
const knownStatus = (value: unknown): boolean => value === "borrador" || value === "asentado" || value === "anulado";
const positiveProtection = (row: RawEntry): boolean =>
  row.source === "invoice" || row.source === "invoice_reversal" ||
  (row.reverses_entry_id !== undefined && row.reverses_entry_id !== null);
const knownBase = (row: RawEntry, tenant: string): boolean =>
  knownId(row.id) && row.tenant_id === tenant && knownSource(row.source) && knownStatus(row.status) &&
  (row.deleted_at === null || knownId(row.deleted_at)) && nullableId(row.invoice_id);
const knownHeader = (row: RawEntry, tenant: string): boolean =>
  knownBase(row, tenant) && nullableId(row.reverses_entry_id);

async function visibleEntryRows(
  query: PromiseLike<{ data: unknown; error: unknown }>, message: string,
): Promise<RawEntry[]> {
  try {
    const { data, error } = await query;
    if (error !== null || !Array.isArray(data) || !data.every(isRecord)) throw new Error(message);
    return data;
  } catch { throw new Error(message); }
}

/** Contexto de la misma sesión, sin importar módulos server/auth/RBAC en este lector client-safe. */
async function visibleJournalTenant(supabase: SupabaseClient): Promise<string | null> {
  const session = await supabase.auth.getUser();
  if (session.error !== null || !knownId(session.data?.user?.id)) return null;
  const userId = session.data.user.id;
  const { data, error } = await supabase.from("user_tenants")
    .select("tenant_id, user_id, disabled_at").eq("user_id", userId).is("disabled_at", null).limit(1).maybeSingle();
  if (error !== null || !isRecord(data) || data.user_id !== userId || data.disabled_at !== null || !knownId(data.tenant_id)) return null;
  return data.tenant_id;
}

/**
 * Protección de cabeceras raw: lotes/páginas completos en ambos sentidos,
 * incluidos vínculos anulado/borrado/fuera del listado. El tercer argumento
 * sólo lo aporta la action desde moduleEditGate; no es un permiso del cliente.
 * RLS delimita lo visible y REST no aporta snapshot ni bloqueo transaccional.
 */
export async function journalEntryProtections(
  supabase: SupabaseClient,
  entries: readonly RawEntry[],
  trustedTenant?: string,
): Promise<JournalEntryProtection[]> {
  const observed: RawEntry[] = [...entries];
  const uncertain = (entry: RawEntry): JournalEntryProtection =>
    positiveProtection(entry) || observed.some((row) => knownId(entry.id) &&
      (row.reverses_entry_id === entry.id || (row.id === entry.id && positiveProtection(row))))
      ? { state: "protegido", reading: "no_comprobada", relation: "no_comprobado" }
      : { state: "no_comprobado", reading: "no_comprobada", relation: "no_comprobado" };
  if (entries.length === 0) return [];
  try {
    const tenant = trustedTenant === undefined ? await visibleJournalTenant(supabase) : trustedTenant;
    if (!knownId(tenant)) return entries.map(uncertain);
    const ids = [...new Set(entries.filter((row) => row.tenant_id === tenant).map((row) => row.id).filter(knownId))];
    const read = async (column: "id" | "reverses_entry_id", values: string[]): Promise<RawEntry[]> => {
      const result = await fetchAllByIds<RawEntry>(values, async (batch, from, to) => {
        const response = await supabase.from("journal_entries").select(PROTECTION_COLUMNS)
          .eq("tenant_id", tenant).in(column, batch).order("id", { ascending: true }).range(from, to);
        // Validar ANTES de PageResult: el paginador compartido no valida shape.
        if (response.error !== null || !Array.isArray(response.data)) throw new Error("Lectura de protección no comprobable.");
        for (const row of response.data) {
          if (!isRecord(row)) throw new Error("Cabecera ilegible.");
          observed.push(row); // Evidencia positiva no se pierde si otra fila falla.
          if (!knownId(row.id) || row.tenant_id !== tenant || !batch.includes(row[column] as string)) throw new Error("Contexto de cabecera no comprobable.");
        }
        return { data: response.data, error: null };
      });
      if (!result.complete) throw new Error("Lectura de protección incompleta.");
      return result.rows;
    };
    const own = await read("id", ids);
    const parents = [...new Set([...entries, ...own].map((row) => row.reverses_entry_id).filter(knownId))];
    await read("id", parents.filter((id) => !ids.includes(id)));
    const roots = [...new Set([...ids, ...parents])];
    const incoming = await read("reverses_entry_id", roots);
    // También observar referencias hacia el reverso candidato, sin N+1.
    const extra = [...new Set(incoming.map((row) => row.id).filter(knownId))].filter((id) => !roots.includes(id));
    await read("reverses_entry_id", extra);
    const header = (id: string): { row?: RawEntry; incomplete: boolean; contradictory: boolean } => {
      const rows = observed.filter((row) => row.id === id);
      // La fila base no proyecta aún reverses_entry_id; las lecturas auxiliares sí.
      const full = rows.filter((row) => Object.prototype.hasOwnProperty.call(row, "reverses_entry_id"));
      const row = full[0];
      const incomplete = !row || rows.some((r) => !knownBase(r, tenant)) || full.some((r) => !knownHeader(r, tenant));
      const contradictory = rows.some((r) => knownId(r.tenant_id) && r.tenant_id !== tenant) ||
        (row !== undefined && rows.some((r) => HEADER_FIELDS.some((key) =>
          r[key] !== undefined && row[key] !== undefined && r[key] !== row[key])));
      return { row, incomplete, contradictory };
    };
    const inverse = (id: string): string[] => [...new Set(observed
      .filter((row) => row.reverses_entry_id === id).map((row) => row.id).filter(knownId))];
    const incoherent = (): JournalEntryProtection => ({ state: "protegido", reading: "completa", relation: "inconsistente" });
    return entries.map((entry) => {
      if (!knownId(entry.id) || entry.tenant_id !== tenant) return uncertain(entry);
      if (!own.some((row) => row.id === entry.id)) return uncertain(entry);
      const current = header(entry.id);
      const related = inverse(entry.id);
      const positive = positiveProtection(entry) || observed.some((row) => row.id === entry.id && positiveProtection(row)) || related.length > 0;
      if (current.contradictory) return positive ? incoherent() : uncertain(entry);
      if (!knownBase(entry, tenant) || current.incomplete || !current.row) return uncertain(entry);
      const row = current.row;
      if (!positive) {
        return row.reverses_entry_id === null && knownSource(row.source)
          ? { state: "sin_vinculo_visible", reading: "completa", relation: "ninguno_visible" }
          : uncertain(entry);
      }
      if (row.source === "invoice" && row.reverses_entry_id === null && related.length === 0) {
        return { state: "protegido", reading: "completa", relation: "ninguno_visible" };
      }
      const originalId = row.source === "invoice" ? entry.id : row.reverses_entry_id;
      if (!knownId(originalId)) return incoherent();
      const original = header(originalId);
      const reversals = inverse(originalId);
      if (original.contradictory || reversals.length !== 1) return incoherent();
      if (!original.row || original.incomplete) return { state: "protegido", reading: "no_comprobada", relation: "no_comprobado" };
      const reversal = header(reversals[0]);
      if (reversal.contradictory) return incoherent();
      if (!reversal.row || reversal.incomplete) return { state: "protegido", reading: "no_comprobada", relation: "no_comprobado" };
      const o = original.row;
      const r = reversal.row;
      if (o.id === r.id || o.source !== "invoice" || r.source !== "invoice_reversal" ||
          r.reverses_entry_id !== o.id || o.reverses_entry_id !== null || !knownId(o.invoice_id) || r.invoice_id !== o.invoice_id ||
          o.status !== "asentado" || r.status !== "asentado" || o.deleted_at !== null || r.deleted_at !== null ||
          inverse(r.id as string).length > 0 || (row.source !== "invoice" && row.id !== r.id)) return incoherent();
      const counterpart = row.id === o.id ? r : o;
      return {
        state: "protegido", reading: "completa", relation: row.id === o.id ? "original" : "reverso",
        ...(typeof counterpart.entry_code === "string" && ENTRY_CODE_RE.test(counterpart.entry_code)
          ? { counterpartCode: counterpart.entry_code } : {}),
      };
    });
  } catch {
    // Incluye columna0497 ausente, shape, permiso, timeout y corte: nada habilita.
    return entries.map(uncertain);
  }
}

/**
 * Tope DECLARADO de la pantalla del libro diario (SDD-0557). Pintar miles de
 * asientos no le sirve a nadie: la pantalla muestra los más recientes y dice
 * «Mostrando N de M» con el total real de `countEntries`. El diario completo
 * se descarga en CSV por `/api/studio/contabilidad/export?tipo=diario`.
 */
export const DIARIO_PANTALLA_MAX = 500;

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
    .limit(DIARIO_PANTALLA_MAX);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [`entry_code.ilike.%${q}%`, `memo.ilike.%${q}%`].join(","),
    );
  }

  const data = await visibleEntryRows(query, "No se pudo cargar el libro diario. Recarga la página.");
  const protections = await journalEntryProtections(supabase, data);
  return data.map((row, index) => {
    const entry = coerceEntry(row);
    entry.protection = protections[index];
    const rawLines = (row.journal_lines as Record<string, unknown>[] | null) ?? [];
    if (!Array.isArray(rawLines) || !rawLines.every(isRecord)) throw new Error("No se pudo cargar el libro diario. Recarga la página.");
    entry.lines = rawLines.map(coerceLine);
    return entry;
  });
}

/**
 * Totales REALES del diario (SDD-0557), sin el tope de pantalla: asientos vivos
 * (no borrados, cualquier estado) y, de ellos, los asentados. Dos conteos
 * `head`: no trae filas.
 */
export async function countEntries(
  supabase: SupabaseClient,
): Promise<{ total: number; asentados: number }> {
  const [todos, asentados] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "asentado"),
  ]);
  if (todos.error) throw todos.error;
  if (asentados.error) throw asentados.error;
  return { total: todos.count ?? 0, asentados: asentados.count ?? 0 };
}

export async function getEntryByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<JournalEntry | null> {
  // Un cap HTTP1 puede ocultar la segunda fila de un código ambiguo: completar
  // hasta página vacía, en vez de confundir limit/maybeSingle con unicidad.
  const detail = await fetchAllPaged<RawEntry>(async (from, to) => ({
    data: await visibleEntryRows(supabase.from("journal_entries")
      .select(`${ENTRY_COLUMNS}, journal_lines ( id, entry_id, account_id, debit, credit, line_memo, accounts ( code, name ) )`)
      .eq("entry_code", code).is("deleted_at", null).order("id", { ascending: true }).range(from, to),
    "No se pudo comprobar el asiento. Recarga la página."),
    error: null,
  }));
  const data = detail.rows;

  if (!detail.complete || data.length > 1) throw new Error("No se pudo comprobar el asiento. Recarga la página.");
  if (data.length === 0) return null;
  const row = data[0];
  const entry = coerceEntry(row);
  [entry.protection] = await journalEntryProtections(supabase, [row]);
  const rawLines = (row.journal_lines as Record<string, unknown>[] | null) ?? [];
  if (!Array.isArray(rawLines) || !rawLines.every(isRecord)) throw new Error("No se pudo comprobar el asiento. Recarga la página.");
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
      "id, tenant_id, code, name, type, parent_id, qbo_type, subtype, is_postable, notes, created_at, updated_at",
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
    subtype: (acctRow.subtype as string | null) ?? null,
    is_postable: Boolean(acctRow.is_postable),
    notes: (acctRow.notes as string | null) ?? null,
    created_at: String(acctRow.created_at),
    updated_at: String(acctRow.updated_at),
  };

  // Paginado, no `.limit(5000)`: PostgREST corta en 1.000 y no avisa, y acá el
  // resultado no es una lista — es el SALDO de la cuenta. Una cuenta de banco
  // con más de mil movimientos habría mostrado un saldo corrido equivocado,
  // sin error y sin forma de notarlo.
  //
  // Y el filtro se baja a SQL: antes se traían las líneas de TODOS los estados
  // y se descartaban en JS los borradores y los borrados. Con el tope, ese
  // descarte llegaba tarde — las 1.000 filas ya se habían gastado en asientos
  // que no cuentan.
  const { rows: lineRows, complete } = await fetchAllPaged<Record<string, unknown>>(
    (from, to) =>
      supabase
        .from("journal_lines")
        .select(
          "id, entry_id, debit, credit, line_memo, journal_entries!inner ( entry_code, entry_date, status, memo, deleted_at )",
        )
        .eq("account_id", accountId)
        .eq("journal_entries.status", "asentado")
        .is("journal_entries.deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to),
  );
  if (!complete) {
    throw new Error(
      "El libro mayor de esta cuenta supera el tope de lectura; el saldo no se puede calcular completo.",
    );
  }

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
