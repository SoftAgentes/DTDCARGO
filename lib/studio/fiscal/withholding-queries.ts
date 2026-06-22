/**
 * Queries de Retenciones (SDD-0104 · Slice B).
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id (migr
 * 0166). `listWithholdings` trae TODOS los del período (incluidos anulados, con
 * su status, para mostrarlos tachados en la tabla); `withholdingTotals` solo
 * suma los `emitido` (los anulados no cuentan al total del período).
 *
 * numeric llega a TS como string vía PostgREST → se coerce con `num()`.
 *
 * Columnas seleccionadas verificadas contra 0166_tax_withholdings.sql. El test
 * `withholding-queries.test.ts` valida el rango por período + exclusión de
 * anulados de los totales.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type TaxWithholding,
  type WithholdingStatus,
  type WithholdingType,
} from "./withholding-types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Columnas reales de tax_withholdings (0166).
export const WITHHOLDING_COLUMNS =
  "id, withholding_type, voucher_number, period, op_date, supplier_id, supplier_name, rif, source_bill_id, source_doc, base, pct, amount, currency, status, notes, created_at";

type WithholdingRow = {
  id: string;
  withholding_type: string;
  voucher_number: string;
  period: string;
  op_date: string;
  supplier_id: string | null;
  supplier_name: string;
  rif: string | null;
  source_bill_id: string | null;
  source_doc: string | null;
  base: number | string;
  pct: number | string;
  amount: number | string;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
};

function mapRow(r: WithholdingRow): TaxWithholding {
  return {
    id: r.id,
    withholdingType: r.withholding_type as WithholdingType,
    voucherNumber: r.voucher_number,
    period: r.period,
    opDate: r.op_date,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    rif: r.rif,
    sourceBillId: r.source_bill_id,
    sourceDoc: r.source_doc,
    base: num(r.base),
    pct: num(r.pct),
    amount: num(r.amount),
    currency: r.currency,
    status: r.status as WithholdingStatus,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * Comprobantes de retención del período (todos los estados). Ordenados por
 * op_date asc, luego created_at. Incluye anulados (la UI los muestra tachados);
 * los totales los excluyen vía `withholdingTotals`. RLS filtra el tenant.
 */
export async function listWithholdings(
  supabase: SupabaseClient,
  period: string,
): Promise<TaxWithholding[]> {
  const { data, error } = await supabase
    .from("tax_withholdings")
    .select(WITHHOLDING_COLUMNS)
    .eq("period", period)
    .order("op_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) throw error;
  return ((data as WithholdingRow[] | null) ?? []).map(mapRow);
}

/** Totales del período por tipo. SOLO cuenta los `emitido` (anulados fuera). */
export function withholdingTotals(rows: TaxWithholding[]): {
  iva: number;
  islr: number;
} {
  let iva = 0;
  let islr = 0;
  for (const r of rows) {
    if (r.status !== "emitido") continue;
    if (r.withholdingType === "iva") iva += r.amount;
    else islr += r.amount;
  }
  return {
    iva: Math.round(iva * 100) / 100,
    islr: Math.round(islr * 100) / 100,
  };
}
