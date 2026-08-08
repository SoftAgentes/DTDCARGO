/**
 * Lectura de `studio_role_module_overrides` (SDD-0252, migr 0357).
 *
 * Función pura que recibe el `SupabaseClient` (patrón `lib/studio/*-queries.ts`
 * del resto del repo) — sin `"use server"`, la usan tanto `rbac-guard.ts` (el
 * gate real) como `app/studio/(app)/layout.tsx` (para el sidebar).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleModuleOverrides } from "@/lib/studio/rbac";

interface OverrideRow {
  role: string;
  module_id: string;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Trae los desvíos del tenant, ya armados como mapa `"${role}:${moduleId}"`.
 * Fail-closed suave: cualquier error de lectura devuelve `{}` (el default de
 * código sigue aplicando — nunca abre más de lo que había).
 */
export async function getRoleModuleOverrides(
  supabase: SupabaseClient,
): Promise<RoleModuleOverrides> {
  const { data, error } = await supabase
    .from("studio_role_module_overrides")
    .select("role, module_id, can_view, can_edit")
    .returns<OverrideRow[]>();
  if (error || !data) return {};

  const map: Record<string, { view: boolean; edit: boolean }> = {};
  for (const row of data) {
    map[`${row.role}:${row.module_id}`] = { view: row.can_view, edit: row.can_edit };
  }
  return map;
}
