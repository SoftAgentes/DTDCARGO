/**
 * Queries de la cuenta corriente bilateral con el Socio China
 * (SDD-0059 · Slice A). Funciones PURAS que reciben un SupabaseClient; RLS
 * filtra por tenant_id.
 *
 * El saldo neto corriente (USD + RMB) se DERIVA acá (computePartnerBalance),
 * NO se persiste → evita drift. Supabase devuelve numeric como string → se
 * coerce a number al leer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  computePartnerBalance,
  num,
  type LedgerEntryInput,
  type PartnerBalance,
  type PartnerLedgerEntry,
} from "./types";

const LEDGER_COLUMNS =
  "id, tenant_id, supplier_id, entry_code, entry_type, direction, amount_usd, amount_rmb, fx_rate, currency_paid, container_id, shipment_id, charge_id, occurred_on, description, description_cn, journal_entry_id, created_at, deleted_at";

/** Coacciona una fila cruda a PartnerLedgerEntry (numeric→number). */
function coerceEntry(r: Record<string, unknown>): PartnerLedgerEntry {
  return {
    ...(r as unknown as PartnerLedgerEntry),
    amount_usd: num(r.amount_usd),
    amount_rmb: num(r.amount_rmb),
    fx_rate: r.fx_rate == null ? null : num(r.fx_rate),
  };
}

/**
 * Entries del libro mayor de un socio (más reciente primero). RLS por tenant.
 * Sin `supplierId` → todo el ledger del tenant.
 */
export async function listLedgerEntries(
  supabase: SupabaseClient,
  supplierId?: string,
): Promise<PartnerLedgerEntry[]> {
  // Paginado: es el libro del socio; el saldo sale de estas entradas.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) => {
      let q = supabase
        .from("partner_ledger_entries")
        .select(LEDGER_COLUMNS)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      if (supplierId) q = q.eq("supplier_id", supplierId);
      return q.range(d, h);
    },
  );
  if (!complete) {
    throw new Error("El libro del socio supera el tope de lectura; filtra por proveedor.");
  }

  return data.map(coerceEntry);
}

/**
 * Saldo neto corriente (USD + RMB) del socio. Derivado de sus entries vivas
 * (computePartnerBalance). RLS por tenant.
 */
export async function getPartnerBalance(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<PartnerBalance> {
  // Paginado: acá se calcula el SALDO con el socio. Truncar no muestra menos
  // movimientos: da un saldo equivocado, y sobre ese saldo se le paga.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("partner_ledger_entries")
        .select("id, direction, amount_usd, amount_rmb, deleted_at")
        .eq("supplier_id", supplierId)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Los movimientos del socio superan el tope de lectura; el saldo no se puede calcular.",
    );
  }

  const rows = data.map((r) => ({
    direction: String(r.direction) as PartnerLedgerEntry["direction"],
    amount_usd: num(r.amount_usd),
    amount_rmb: num(r.amount_rmb),
    deleted_at: (r.deleted_at as string | null) ?? null,
  }));

  return computePartnerBalance(rows);
}

/**
 * Inserta una entry en el libro mayor. Genera el entry_code con la RPC
 * `next_partner_ledger_code`. Devuelve la fila creada. RLS por tenant.
 */
export async function addLedgerEntry(
  supabase: SupabaseClient,
  tenantId: string,
  input: LedgerEntryInput,
): Promise<PartnerLedgerEntry> {
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_partner_ledger_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr) throw codeErr;
  const entryCode = String(codeData);

  const { data, error } = await supabase
    .from("partner_ledger_entries")
    .insert({
      tenant_id: tenantId,
      entry_code: entryCode,
      supplier_id: input.supplier_id,
      entry_type: input.entry_type,
      direction: input.direction,
      amount_usd: input.amount_usd,
      amount_rmb: input.amount_rmb,
      fx_rate: input.fx_rate,
      currency_paid: input.currency_paid,
      container_id: input.container_id,
      shipment_id: input.shipment_id,
      charge_id: input.charge_id,
      occurred_on: input.occurred_on ?? undefined,
      description: input.description,
      description_cn: input.description_cn,
    })
    .select(LEDGER_COLUMNS)
    .single();

  if (error) throw error;
  return coerceEntry(data as Record<string, unknown>);
}

/**
 * Soft-delete (anular) de una entry. RLS por tenant. Append-only + auditable.
 */
export async function voidLedgerEntry(
  supabase: SupabaseClient,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("partner_ledger_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", entryId)
    .is("deleted_at", null);
  if (error) throw error;
}
