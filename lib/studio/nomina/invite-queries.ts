/**
 * Queries puras del módulo Nómina · Invitaciones de empleado (SDD-0113 Slice A).
 * Funciones `(supabase: SupabaseClient, ...) => Promise<T>`. La RLS filtra por
 * tenant Y rol (admin/accounting); `getInviteByToken` la llama la action del
 * candidato con un cliente de servicio (sin sesión) validando el token.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeInvite } from "./invite-types";

const INVITE_COLUMNS =
  "id, tenant_id, token, cargo, department, status, expires_at, used_at, " +
  "created_by, created_at, updated_at";

/** Invitaciones del tenant, más recientes primero. */
export async function listInvites(
  supabase: SupabaseClient,
): Promise<EmployeeInvite[]> {
  const { data, error } = await supabase
    .from("nomina_employee_invites")
    .select(INVITE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listInvites]", error.message);
    return [];
  }
  return (data ?? []) as unknown as EmployeeInvite[];
}

/**
 * Invitación por token (o null). La usa el submit del candidato (cliente de
 * servicio): valida el token sin sesión. NO confía en el estado: el caller debe
 * chequear `isInviteUsable()`.
 */
export async function getInviteByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<EmployeeInvite | null> {
  const { data, error } = await supabase
    .from("nomina_employee_invites")
    .select(INVITE_COLUMNS)
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[getInviteByToken]", error.message);
    return null;
  }
  return (data as unknown as EmployeeInvite) ?? null;
}
