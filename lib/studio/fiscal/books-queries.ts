/**
 * Queries de los Libros fiscales ASENTADOS (SDD-0104 · Slice A).
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id (las
 * tablas fiscal_books/fiscal_book_entries son select-only para authenticated del
 * tenant — migr 0165). No mutan: el asentado va por la RPC `fiscal_post_book`
 * desde la action; la anulación es un update en la action.
 *
 * numeric llega a TS como string vía PostgREST → se coerce con `num()`.
 *
 * Columnas seleccionadas (verificadas contra 0165_fiscal_books.sql). El test
 * `books-queries.test.ts` valida que el set ⊆ schema real (anti falso-verde).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  type PostedBook,
  type PostedBookEntry,
  type PostedBookStatus,
  type PostedBookType,
  type PostedIvaClass,
  type PostedSourceType,
} from "./books-types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Cabecera: columnas reales de fiscal_books (0165).
export const FISCAL_BOOK_COLUMNS =
  "id, period, book_type, status, total_base, total_iva, total_total, total_base_exenta, total_base_gravada, total_base_tasa_cero, row_count, currencies, default_iva_mode, posted_at, posted_by, voided_at, voided_by, void_reason";

// Líneas: columnas reales de fiscal_book_entries (0165).
export const FISCAL_BOOK_ENTRY_COLUMNS =
  "id, line_no, op_date, document_number, control_number, rif, party_name, iva_class, base, rate, iva, total, retention, currency, source_type, source_ref";

type BookRow = {
  id: string;
  period: string;
  book_type: string;
  status: string;
  total_base: number | string;
  total_iva: number | string;
  total_total: number | string;
  total_base_exenta: number | string;
  total_base_gravada: number | string;
  total_base_tasa_cero: number | string;
  row_count: number | string;
  currencies: string[] | null;
  default_iva_mode: string | null;
  posted_at: string;
  posted_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

type EntryRow = {
  id: string;
  line_no: number | string;
  op_date: string | null;
  document_number: string | null;
  control_number: string | null;
  rif: string | null;
  party_name: string | null;
  iva_class: string | null;
  base: number | string | null;
  rate: number | string | null;
  iva: number | string | null;
  total: number | string | null;
  retention: number | string | null;
  currency: string | null;
  source_type: string | null;
  source_ref: string | null;
};

/** numeric|null → number|null (no fabrica 0 cuando la fuente es null). */
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapEntry(r: EntryRow): PostedBookEntry {
  return {
    id: r.id,
    lineNo: num(r.line_no),
    opDate: r.op_date,
    documentNumber: r.document_number,
    controlNumber: r.control_number,
    rif: r.rif,
    partyName: r.party_name,
    ivaClass: (r.iva_class as PostedIvaClass | null) ?? null,
    base: numOrNull(r.base),
    rate: numOrNull(r.rate),
    iva: numOrNull(r.iva),
    total: numOrNull(r.total),
    retention: numOrNull(r.retention),
    currency: r.currency,
    sourceType: (r.source_type as PostedSourceType | null) ?? null,
    sourceRef: r.source_ref,
  };
}

function mapHeader(r: BookRow, entries: PostedBookEntry[]): PostedBook {
  return {
    id: r.id,
    period: r.period,
    bookType: r.book_type as PostedBookType,
    status: r.status as PostedBookStatus,
    totalBase: num(r.total_base),
    totalIva: num(r.total_iva),
    totalTotal: num(r.total_total),
    totalBaseExenta: num(r.total_base_exenta),
    totalBaseGravada: num(r.total_base_gravada),
    totalBaseTasaCero: num(r.total_base_tasa_cero),
    rowCount: num(r.row_count),
    currencies: Array.isArray(r.currencies) ? r.currencies : [],
    defaultIvaMode: r.default_iva_mode,
    postedAt: r.posted_at,
    postedBy: r.posted_by,
    voidedAt: r.voided_at,
    voidedBy: r.voided_by,
    voidReason: r.void_reason,
    entries,
  };
}

/**
 * Libro asentado VIGENTE de un período+tipo (status='asentado') + sus líneas
 * ordenadas por line_no. `null` si ese período no está asentado (o solo tiene
 * asientos anulados). RLS filtra el tenant. Una query por la cabecera + una por
 * las líneas (sin N+1).
 */
export async function getPostedBook(
  supabase: SupabaseClient,
  period: string,
  bookType: PostedBookType,
): Promise<PostedBook | null> {
  const { data, error } = await supabase
    .from("fiscal_books")
    .select(FISCAL_BOOK_COLUMNS)
    .eq("period", period)
    .eq("book_type", bookType)
    .eq("status", "asentado")
    .maybeSingle<BookRow>();
  if (error) throw error;
  if (!data) return null;

  // Paginado: este es el libro fiscal ASENTADO, el que se presenta. Un mes
  // movido pasa de mil líneas sin esfuerzo, y `.limit(20000)` no lo evitaba —
  // PostgREST devolvía 1.000 y el libro salía incompleto sin decir nada.
  // `line_no` es único dentro del libro, así que ya desempata.
  const { rows: lineData, complete } = await fetchAllPaged<EntryRow>((from, to) =>
    supabase
      .from("fiscal_book_entries")
      .select(FISCAL_BOOK_ENTRY_COLUMNS)
      .eq("book_id", data.id)
      .order("line_no", { ascending: true })
      .range(from, to),
  );
  if (!complete) {
    throw new Error(
      "Este libro fiscal supera el tope de lectura; no se puede mostrar incompleto.",
    );
  }

  const entries = lineData.map(mapEntry);
  return mapHeader(data, entries);
}

/**
 * Historial de asientos de un tipo de libro (todos los estados), por período
 * descendente y luego por fecha de asentado. Sin líneas (vista de listado). RLS
 * filtra el tenant. Útil para mostrar los anulados de un período.
 */
export async function listPostedBooks(
  supabase: SupabaseClient,
  bookType: PostedBookType,
): Promise<PostedBook[]> {
  const { data, error } = await supabase
    .from("fiscal_books")
    .select(FISCAL_BOOK_COLUMNS)
    .eq("book_type", bookType)
    .order("period", { ascending: false })
    .order("posted_at", { ascending: false })
    // Tope DECLARADO, no paginado: acá cada fila es la CABECERA de un libro
    // (uno por período y tipo), así que mil filas son ~83 años de libros
    // mensuales. El `.limit(2000)` anterior era falso —PostgREST devuelve
    // 1.000 igual—; éste dice la verdad y no gasta un request extra en
    // paginar algo que no va a crecer.
    .limit(1000);
  if (error) throw error;
  return ((data as BookRow[] | null) ?? []).map((r) => mapHeader(r, []));
}
