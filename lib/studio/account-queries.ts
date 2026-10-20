/**
 * Queries del plan de cuentas (SDD-0040 · Contabilidad).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import {
  compareCodes,
  normalSide,
  parentCode,
  type Account,
  type CuentaDelPlan,
} from "./account-types";

const ACCOUNT_COLUMNS =
  "id, tenant_id, code, name, type, parent_id, qbo_type, subtype, is_postable, notes, created_at, updated_at";

function coerceAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as Account["type"],
    parent_id: (row.parent_id as string | null) ?? null,
    qbo_type: (row.qbo_type as string | null) ?? null,
    subtype: (row.subtype as string | null) ?? null,
    is_postable: Boolean(row.is_postable),
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/** Lista todas las cuentas del tenant, ordenadas naturalmente por code. */
export async function listAccounts(
  supabase: SupabaseClient,
): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .limit(1000);

  if (error) throw error;
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceAccount,
  );
  return rows.sort((a, b) => compareCodes(a.code, b.code));
}

/**
 * SDD-0565 · El plan completo del tenant (id, código y padre), paginado.
 * Es la base de las dos reglas que impiden una cuenta huérfana: un plan
 * cortado dejaría pasar una (`listAccounts` se corta en 1000 sin avisar), así
 * que si no llega completo, lanza.
 */
export async function planDeCuentas(supabase: SupabaseClient): Promise<CuentaDelPlan[]> {
  const { rows, complete } = await fetchAllPaged<Record<string, unknown>>((d, h) =>
    supabase.from("accounts").select("id, code, parent_id").order("id", { ascending: true }).range(d, h),
  );
  if (!complete) {
    throw new Error("El plan de cuentas supera el tope de lectura; no se puede comprobar la cuenta padre.");
  }
  return rows.map((r) => ({
    id: String(r.id),
    code: String(r.code),
    parent_id: (r.parent_id as string | null) ?? null,
  }));
}

/** Solo las cuentas postables (hojas) — para el selector del editor de asiento. */
export async function listPostableAccounts(
  supabase: SupabaseClient,
): Promise<Account[]> {
  const all = await listAccounts(supabase);
  return all.filter((a) => a.is_postable);
}

/** Saldo por cuenta. */
export type AccountBalance = {
  /** Acumulado de débitos (incluye rollup de hijos). */
  debit: number;
  /** Acumulado de créditos (incluye rollup de hijos). */
  credit: number;
  /**
   * Saldo natural de la cuenta según su lado normal:
   *  debe-normal (A/CGS/G) → debit − credit
   *  haber-normal (P/PT/I) → credit − debit
   * También con rollup de hijos.
   */
  balance: number;
};

export type AccountBalanceMap = Record<string, AccountBalance>;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Computa los saldos por cuenta a partir de líneas crudas (debe/credit por
 * account_id) y el set de cuentas. PURA — testeable sin DB.
 *
 * Pasos:
 *  1. Suma debe/haber de las líneas por cuenta (postings directos a hojas).
 *  2. Hace rollup hacia los padres por el árbol de codes: el debe/haber de un
 *     grupo = suma del debe/haber de sus descendientes (un grupo no recibe
 *     postings directos, pero muestra el agregado de sus hojas).
 *  3. Calcula el `balance` natural de cada cuenta según su lado normal sobre
 *     los acumulados con rollup.
 *
 * Solo deberían entrar líneas de asientos `asentado` (eso lo garantiza el
 * caller `accountBalances`).
 */
export function computeBalances(
  accounts: Account[],
  postings: { account_id: string; debit: number; credit: number }[],
): AccountBalanceMap {
  // 1. Agregar postings directos por cuenta.
  const direct = new Map<string, { debit: number; credit: number }>();
  for (const a of accounts) direct.set(a.id, { debit: 0, credit: 0 });
  for (const p of postings ?? []) {
    const slot = direct.get(p.account_id);
    if (!slot) continue; // posting a cuenta de otro tenant / inexistente → ignorar
    slot.debit += Number(p.debit) || 0;
    slot.credit += Number(p.credit) || 0;
  }

  // Índices por code para el rollup.
  const byCode = new Map<string, Account>();
  for (const a of accounts) byCode.set(a.code, a);

  // 2. Rollup: para cada cuenta, su debe/haber con rollup = directo +
  // suma de los acumulados de sus hijos. Procesamos de hoja a raíz
  // ordenando por profundidad descendente (codes más largos primero).
  const rolled = new Map<string, { debit: number; credit: number }>();
  for (const a of accounts) {
    const d = direct.get(a.id)!;
    rolled.set(a.id, { debit: d.debit, credit: d.credit });
  }

  const byDepthDesc = [...accounts].sort(
    (x, y) =>
      (y.code.match(/\./g)?.length ?? 0) - (x.code.match(/\./g)?.length ?? 0),
  );
  for (const a of byDepthDesc) {
    const pc = parentCode(a.code);
    if (!pc) continue;
    const parent = byCode.get(pc);
    if (!parent) continue;
    const childRolled = rolled.get(a.id)!;
    const parentRolled = rolled.get(parent.id)!;
    parentRolled.debit += childRolled.debit;
    parentRolled.credit += childRolled.credit;
  }

  // 3. Balance natural por lado normal del tipo.
  const out: AccountBalanceMap = {};
  for (const a of accounts) {
    const r = rolled.get(a.id)!;
    const debit = round2(r.debit);
    const credit = round2(r.credit);
    const balance =
      normalSide(a.type) === "debit"
        ? round2(debit - credit)
        : round2(credit - debit);
    out[a.id] = { debit, credit, balance };
  }
  return out;
}

/**
 * Saldos por cuenta del tenant. Suma SOLO líneas de asientos `asentado`
 * (ignora borrador y anulado) y hace rollup a los padres.
 *
 * Devuelve un map account_id → { debit, credit, balance }.
 */
export async function accountBalances(
  supabase: SupabaseClient,
  opts: { upToDate?: string; fromDate?: string } = {},
): Promise<AccountBalanceMap> {
  const accounts = await listAccounts(supabase);

  // Traemos los ids de asientos asentados (con filtro de fecha opcional)
  // y luego sus líneas. Dos queries simples evitan depender de la forma del
  // embedded join de PostgREST.
  // Paginado: son los asientos que entran al BALANCE. Uno que no entra
  // desaparece del saldo de su cuenta, sin error.
  const entriesPaged = await fetchAllPaged<{ id: string }>((d, h) => {
    let q = supabase
      .from("journal_entries")
      .select("id")
      .eq("status", "asentado")
      .is("deleted_at", null)
      .order("id", { ascending: true });
    if (opts.upToDate) q = q.lte("entry_date", opts.upToDate);
    if (opts.fromDate) q = q.gte("entry_date", opts.fromDate);
    return q.range(d, h);
  });
  if (!entriesPaged.complete) {
    throw new Error(
      "Los asientos superan el tope de lectura; el balance no se puede calcular completo.",
    );
  }

  const entryIds = entriesPaged.rows.map((r) => r.id);
  if (entryIds.length === 0) {
    return computeBalances(accounts, []);
  }

  // Por lotes y paginado: son las LÍNEAS del balance. Dos topes reales —
  // el `.in(...)` en la URL y las filas devueltas.
  const { rows: lineRows, complete: linesOk } = await fetchAllByIds<
    Record<string, unknown>
  >(entryIds, (lote, d, h) =>
    supabase
      .from("journal_lines")
      .select("id, account_id, debit, credit")
      .in("entry_id", lote)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!linesOk) {
    throw new Error(
      "Las líneas de asiento superan el tope de lectura; el balance quedaría descuadrado.",
    );
  }

  const postings = ((lineRows as Record<string, unknown>[] | null) ?? []).map(
    (r) => ({
      account_id: String(r.account_id),
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
    }),
  );

  return computeBalances(accounts, postings);
}

/** Busca una cuenta por code (para el asiento automático). */
export async function getAccountByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;
  return coerceAccount(data as Record<string, unknown>);
}

/** ¿La cuenta tiene movimientos (líneas)? Para no permitir borrarla. */
export async function accountHasMovements(
  supabase: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
