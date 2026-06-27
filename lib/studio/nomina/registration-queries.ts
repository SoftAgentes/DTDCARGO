/**
 * Queries puras del módulo Nómina · Solicitudes de registro (SDD-0113 Slice A).
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>`. La RLS filtra por
 * tenant Y rol (admin/accounting).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeRegistration, RegistrationStatus } from "./registration-types";

const REG_COLUMNS =
  "id, tenant_id, invite_id, full_name, national_id, birth_date, phone, email, " +
  "cargo, start_date, bank_name, bank_account_type, bank_account, photo_path, " +
  "status, reviewed_by, reviewed_at, employee_id, rejection_reason, created_at, updated_at";

/** Solicitudes del tenant, pendientes primero y más recientes arriba. */
export async function listRegistrations(
  supabase: SupabaseClient,
): Promise<EmployeeRegistration[]> {
  const { data, error } = await supabase
    .from("nomina_employee_registrations")
    .select(REG_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listRegistrations]", error.message);
    return [];
  }
  return (data ?? []) as unknown as EmployeeRegistration[];
}

/** Una solicitud por id (o null). */
export async function getRegistration(
  supabase: SupabaseClient,
  id: string,
): Promise<EmployeeRegistration | null> {
  const { data, error } = await supabase
    .from("nomina_employee_registrations")
    .select(REG_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getRegistration]", error.message);
    return null;
  }
  return (data as unknown as EmployeeRegistration) ?? null;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ KPIs del listado (PURO)                                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type RegistrationKpis = {
  total_count: number;
  pending_count: number;
  approved_count: number;
};

export function computeRegistrationKpis(
  rows: { status: RegistrationStatus }[],
): RegistrationKpis {
  let pending = 0;
  let approved = 0;
  for (const r of rows) {
    if (r.status === "pendiente") pending += 1;
    if (r.status === "aprobada") approved += 1;
  }
  return {
    total_count: rows.length,
    pending_count: pending,
    approved_count: approved,
  };
}
