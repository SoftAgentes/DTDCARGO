/**
 * Queries de proveedores del módulo Tesorería (SDD-0044).
 *
 * Funciones puras que reciben un SupabaseClient. RLS filtra por tenant_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supplier } from "./types";

const SUPPLIER_COLUMNS =
  "id, tenant_id, supplier_code, name, name_cn, type, country, default_currency, payment_channel, contact_name, contact_phone, contact_email, tax_id, notes, created_at, updated_at, deleted_at";

function coerceSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    supplier_code: String(row.supplier_code),
    name: String(row.name ?? ""),
    name_cn: (row.name_cn as string | null) ?? null,
    type: (row.type as Supplier["type"]) ?? "proveedor_cn",
    country: String(row.country ?? "CN"),
    default_currency:
      (row.default_currency as Supplier["default_currency"]) ?? "USD",
    payment_channel: (row.payment_channel as string | null) ?? null,
    contact_name: (row.contact_name as string | null) ?? null,
    contact_phone: (row.contact_phone as string | null) ?? null,
    contact_email: (row.contact_email as string | null) ?? null,
    tax_id: (row.tax_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  };
}

/** Lista los proveedores (vivos) del tenant, opcionalmente filtrados por tipo. */
export async function listSuppliers(
  supabase: SupabaseClient,
  opts: { type?: string } = {},
): Promise<Supplier[]> {
  let query = supabase
    .from("suppliers")
    .select(SUPPLIER_COLUMNS)
    .order("name", { ascending: true })
    .limit(1000);
  if (opts.type) query = query.eq("type", opts.type);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceSupplier);
}

/** Lee un proveedor por id. null si no existe (o RLS lo oculta). */
export async function getSupplier(
  supabase: SupabaseClient,
  id: string,
): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(SUPPLIER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? coerceSupplier(data as Record<string, unknown>) : null;
}
