/**
 * Miembros que ofrece la Bandeja en «Vincular» y «Dar de alta» (SDD-0585, enmienda del 2026-11-16).
 *
 * La RLS de `user_tenants` deja ver a cada usuario solo su propia fila, así que con el cliente de
 * sesión el admin veía únicamente a sí mismo. Usuarios resuelve lo mismo con el cliente admin; aquí
 * igual, pero la lista solo se pide si quien llama es admin del tenant (el cliente admin ni se crea
 * si no) y siempre filtrada por el `tenant_id` de quien pide: `listMembers` lo exige.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listMembers } from "@/lib/studio/user-queries";
import type { StudioUserRole, UserMembershipWithProfile } from "@/lib/studio/user-types";

export async function miembrosDeBandeja(
  access: { role: StudioUserRole | null; tenantId: string | null },
  crearClienteAdmin: () => SupabaseClient,
): Promise<UserMembershipWithProfile[]> {
  if (access.role !== "admin" || !access.tenantId) return [];
  return listMembers(crearClienteAdmin(), { tenantId: access.tenantId });
}
