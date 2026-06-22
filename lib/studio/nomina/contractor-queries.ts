/**
 * Queries puras del módulo Nómina · Prestadores (SDD-0103 · Slice A).
 *
 * Funciones `(supabase: SupabaseClient) => Promise<T>` consumidas desde
 * `app/studio/(app)/nomina/page.tsx`. La RLS filtra por tenant Y rol
 * (admin/accounting). Los montos `numeric` se coercen con `num()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./employee-types";
import type { Contractor, ContractorPayment } from "./contractor-types";

const CONTRACTOR_COLUMNS =
  "id, tenant_id, full_name, service, phone, national_id, default_rate_usd, " +
  "status, notes, created_by, created_at, updated_at, deleted_at";

const PAYMENT_COLUMNS =
  "id, tenant_id, contractor_id, paid_on, concept, amount_usd, created_by, " +
  "created_at, updated_at, deleted_at";

function rowToContractor(row: Record<string, unknown>): Contractor {
  return {
    ...(row as Contractor),
    default_rate_usd: num(row.default_rate_usd),
  };
}

function rowToPayment(row: Record<string, unknown>): ContractorPayment {
  return {
    ...(row as ContractorPayment),
    amount_usd: num(row.amount_usd),
  };
}

/** Lista los prestadores vivos del tenant: activos primero, luego por nombre. */
export async function listContractors(
  supabase: SupabaseClient,
): Promise<Contractor[]> {
  const { data, error } = await supabase
    .from("nomina_contractors")
    .select(CONTRACTOR_COLUMNS)
    .is("deleted_at", null)
    .order("status", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[listContractors]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToContractor(r as unknown as Record<string, unknown>),
  );
}

/** Pagos por sesión vivos del tenant, más recientes primero. */
export async function listContractorPayments(
  supabase: SupabaseClient,
  limit = 200,
): Promise<ContractorPayment[]> {
  const { data, error } = await supabase
    .from("nomina_contractor_payments")
    .select(PAYMENT_COLUMNS)
    .is("deleted_at", null)
    .order("paid_on", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[listContractorPayments]", error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    rowToPayment(r as unknown as Record<string, unknown>),
  );
}

/** Un prestador por id (o null). */
export async function getContractor(
  supabase: SupabaseClient,
  id: string,
): Promise<Contractor | null> {
  const { data, error } = await supabase
    .from("nomina_contractors")
    .select(CONTRACTOR_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getContractor]", error.message);
    return null;
  }
  return data ? rowToContractor(data as unknown as Record<string, unknown>) : null;
}
