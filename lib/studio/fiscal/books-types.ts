/**
 * Tipos + helpers PUROS de los Libros fiscales ASENTADOS (SDD-0104 · Slice A).
 *
 * SDD-0073 entregó los Libros de Ventas/Compras como CLASIFICACIÓN ON-THE-FLY
 * (preview vivo sobre invoices/supplier_bills). Acá se PERSISTE: "asentar"
 * congela un snapshot inmutable (fiscal_books + fiscal_book_entries, migr 0165).
 *
 * Server-safe (sin "use client", sin Supabase, sin Zod) → lo importan tanto
 * page.tsx (server), actions.ts (server action) como FiscalClient.tsx (client)
 * sin cruzar la frontera RSC.
 *
 * PRINCIPIO RECTOR (heredado de 0073): la clasificación gravada/exenta/tasa_cero
 * NO se recalcula acá — la hace `toSalesRow`/`toPurchaseRow` (./types) leyendo
 * iva_mode + fiscal_settings. Este módulo SOLO mapea esas filas YA clasificadas
 * al payload de línea de la RPC. Cero regla fiscal nueva.
 */

import type { PurchaseBookRow, SalesBookRow } from "./types";

// ── Enums (espejan los CHECK de la migración 0165) ─────────────

/** Estado del asiento de un libro. */
export type PostedBookStatus = "asentado" | "anulado";

/** Tipo de libro asentado. */
export type PostedBookType = "ventas" | "compras";

/** Clasificación de IVA de una línea (espeja el CHECK de fiscal_book_entries). */
export type PostedIvaClass = "gravada" | "exenta" | "tasa_cero";

/** Origen de una línea (espeja el CHECK source_type). */
export type PostedSourceType = "invoice" | "bill";

export const POSTED_BOOK_TYPES: PostedBookType[] = ["ventas", "compras"];

// ── Payload de línea para la RPC `fiscal_post_book` ────────────

/**
 * Una línea tal como la espera `fiscal_post_book(p_entries jsonb …)` (migr 0165).
 *
 * ⚠️ Contrato EXACTO: estas 15 keys (y solo estas) las consume
 * `jsonb_to_recordset` adentro de la RPC. Cambiar nombres/agregar keys acá sin
 * tocar la migración = línea silenciosamente vacía. Los validadores/tests lo
 * fijan. `line_no` es 1-based en el orden de la fila.
 */
export interface FiscalBookEntryPayload {
  line_no: number;
  op_date: string | null;
  document_number: string | null;
  control_number: string | null;
  rif: string | null;
  party_name: string | null;
  iva_class: PostedIvaClass | null;
  base: number | null;
  rate: number | null;
  iva: number | null;
  total: number | null;
  retention: number | null;
  currency: string | null;
  source_type: PostedSourceType;
  source_ref: string | null;
}

// ── Tipos de lectura (lo que devuelve books-queries) ───────────

/** Una línea congelada leída desde fiscal_book_entries. */
export interface PostedBookEntry {
  id: string;
  lineNo: number;
  opDate: string | null;
  documentNumber: string | null;
  controlNumber: string | null;
  rif: string | null;
  partyName: string | null;
  ivaClass: PostedIvaClass | null;
  base: number | null;
  rate: number | null;
  iva: number | null;
  total: number | null;
  retention: number | null;
  currency: string | null;
  sourceType: PostedSourceType | null;
  sourceRef: string | null;
}

/** Cabecera de un libro asentado + sus líneas. */
export interface PostedBook {
  id: string;
  period: string;
  bookType: PostedBookType;
  status: PostedBookStatus;
  totalBase: number;
  totalIva: number;
  totalTotal: number;
  totalBaseExenta: number;
  totalBaseGravada: number;
  totalBaseTasaCero: number;
  rowCount: number;
  currencies: string[];
  defaultIvaMode: string | null;
  postedAt: string;
  postedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  entries: PostedBookEntry[];
}

// ── Validadores (sin Zod, espejan los CHECK de la migración) ───

/** ¿`YYYY-MM` con mes 01–12? (espeja el CHECK period de 0165). */
export function isValidBookPeriod(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

/** ¿`ventas` | `compras`? (espeja el CHECK book_type de 0165). */
export function isValidBookType(raw: unknown): raw is PostedBookType {
  return raw === "ventas" || raw === "compras";
}

// ── Mapeo fila-clasificada → payload de línea ──────────────────

/**
 * Mapea una fila YA clasificada del Libro de Ventas (SalesBookRow, 0073) al
 * payload de línea de la RPC. La clase/base/iva/total vienen calculados por
 * `toSalesRow` — acá NO se reclasifica nada.
 *
 *  - source_type = 'invoice'; source_ref y document_number = invoiceCode.
 *  - party_name = clientName; op_date = date.
 *  - El resto directo (controlNumber→control_number, ivaClass→iva_class, etc.).
 */
export function salesRowToEntry(
  row: SalesBookRow,
  lineNo: number,
): FiscalBookEntryPayload {
  return {
    line_no: lineNo,
    op_date: row.date,
    document_number: row.invoiceCode,
    control_number: row.controlNumber,
    rif: row.rif,
    party_name: row.clientName,
    iva_class: row.ivaClass,
    base: row.base,
    rate: row.rate,
    iva: row.iva,
    total: row.total,
    retention: row.retention,
    currency: row.currency,
    source_type: "invoice",
    source_ref: row.invoiceCode,
  };
}

/**
 * Mapea una fila YA clasificada del Libro de Compras (PurchaseBookRow, 0073) al
 * payload de línea de la RPC. base/iva/rate pueden ser null (V1 no discrimina el
 * IVA de compras) — se persiste null tal cual (cero fabricado, §3.2). El Libro
 * de Compras no tiene clasificación de IVA derivada en V1 → iva_class = null.
 *
 *  - source_type = 'bill'; source_ref y document_number = documentNumber.
 *  - party_name = supplierName; op_date = date. Resto directo.
 */
export function purchaseRowToEntry(
  row: PurchaseBookRow,
  lineNo: number,
): FiscalBookEntryPayload {
  return {
    line_no: lineNo,
    op_date: row.date,
    document_number: row.documentNumber,
    control_number: row.controlNumber,
    rif: row.rif,
    party_name: row.supplierName,
    iva_class: null,
    base: row.base,
    rate: row.rate,
    iva: row.iva,
    total: row.total,
    retention: row.retention,
    currency: row.currency,
    source_type: "bill",
    source_ref: row.documentNumber,
  };
}
