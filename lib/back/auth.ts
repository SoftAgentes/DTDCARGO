/**
 * Helpers de auth para el back de administración (SDD-back-0001).
 *
 * Reusa la infraestructura del Studio:
 *   - createClient() de lib/db/server.ts (cliente Supabase con cookies)
 *   - getUser() de lib/auth/session.ts (devuelve auth.users record o null)
 *
 * Agrega lo específico del back:
 *   - getBackRoles()       → array de roles del user en su tenant
 *   - requireAnyBackRole() → garantiza sesión + algún rol back, redirect si no
 *   - requireBackRole(r)   → garantiza un rol específico (admin / disenador / editor)
 *
 * Estos helpers se usan en:
 *   - app/back/(app)/layout.tsx          → gatekeeping antes de SSR
 *   - app/back/(app)/<modulo>/actions.ts → gating de operaciones por rol
 *     (junto con field-level whitelisting en el server action)
 *
 * RLS de Supabase es la última línea de defensa, no la única.
 * Los helpers cortan ANTES de llegar a la DB cuando es posible.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getUser } from "@/lib/auth/session";
import type { User } from "@supabase/supabase-js";

export type BackRole = "admin" | "disenador" | "editor";

/**
 * Devuelve la lista de roles back del user autenticado en su tenant.
 * Array vacío si no hay sesión o si el user no tiene ningún rol back.
 *
 * Implementación: SELECT directo sobre back_user_roles. RLS de la tabla
 * limita a roles del propio user en su tenant.
 */
export async function getBackRoles(): Promise<BackRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("back_user_roles")
    .select("role");
  if (error || !data) return [];
  return data.map((row) => row.role as BackRole);
}

/**
 * Garantiza sesión + al menos 1 rol back en el tenant.
 * Si falta sesión → /back/login.
 * Si tiene sesión pero ningún rol back → /back/login?reason=no_role.
 *
 * Retorna user + roles para evitar re-queries en el layout.
 */
export async function requireAnyBackRole(): Promise<{
  user: User;
  roles: BackRole[];
}> {
  const user = await getUser();
  if (!user) redirect("/back/login");

  const roles = await getBackRoles();
  if (roles.length === 0) {
    redirect("/back/login?reason=no_role");
  }

  return { user, roles };
}

/**
 * Garantiza un rol back específico.
 * Si no tiene sesión o ningún rol back → redirect a /back/login.
 * Si tiene sesión + algún rol pero NO el pedido → redirect a /back con error.
 */
export async function requireBackRole(role: BackRole): Promise<{
  user: User;
  roles: BackRole[];
}> {
  const result = await requireAnyBackRole();
  if (!result.roles.includes(role)) {
    redirect(`/back?reason=missing_role&need=${role}`);
  }
  return result;
}

/**
 * Helper síncrono para chequear roles dentro de un componente que ya tiene
 * el array de roles cargado. No hace fetch, solo array.includes().
 */
export function hasRole(roles: BackRole[], role: BackRole): boolean {
  return roles.includes(role);
}

/**
 * Helper para chequear si el user puede editar contenido visual
 * (assets, imágenes, fields visuales de servicios/noticias).
 */
export function canEditVisuals(roles: BackRole[]): boolean {
  return roles.includes("admin") || roles.includes("disenador");
}

/**
 * Helper para chequear si el user puede editar contenido textual
 * (copy, body, titles).
 */
export function canEditText(roles: BackRole[]): boolean {
  return roles.includes("admin") || roles.includes("editor");
}
