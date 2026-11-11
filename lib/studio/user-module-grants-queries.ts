/**
 * Lectura de `studio_user_module_grants` (SDD-0622, migr 0529).
 *
 * Funciones puras que reciben el `SupabaseClient` (patrón `*-queries.ts`), sin
 * `"use server"`. La escritura NO vive aquí: solo por las RPC
 * `studio_grant_user_module` / `studio_revoke_user_module_grant`, que llama
 * `app/studio/(app)/usuarios/actions.ts` después de su guard.
 *
 * Fail-closed suave, igual que los desvíos por rol: cualquier error (por ejemplo,
 * la 0529 todavía sin aplicar) devuelve vacío. Nunca abre más de lo que el rol
 * ya permitía.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserModuleGrants } from "@/lib/studio/rbac";

export interface UserModuleGrantRow {
  user_id: string;
  module_id: string;
  can_view: boolean;
  can_edit: boolean;
  reason: string;
  expires_at: string | null;
  granted_by: string | null;
  sensitive_confirmed_at: string | null;
  effects_version: string | null;
  created_at: string;
  updated_at: string;
}

/** Un extra listo para la pantalla de Usuarios. */
export interface UserModuleGrantView {
  userId: string;
  moduleId: string;
  canView: boolean;
  canEdit: boolean;
  reason: string;
  expiresAt: string | null;
  grantedBy: string | null;
  sensitive: boolean;
  updatedAt: string;
  expired: boolean;
  /** Vence en los próximos 7 días (calculado en el servidor, al leer). */
  expiringSoon: boolean;
}

const POR_VENCER_MS = 7 * 86_400_000;

const COLUMNS =
  "user_id, module_id, can_view, can_edit, reason, expires_at, granted_by, sensitive_confirmed_at, effects_version, created_at, updated_at";

function isExpired(expiresAt: string | null, now: number): boolean {
  return expiresAt !== null && Date.parse(expiresAt) <= now;
}

/** Filas → mapa por módulo, solo las VIGENTES (sin vencer). */
export function grantsFromRows(rows: readonly UserModuleGrantRow[], now = Date.now()): UserModuleGrants {
  const map: Record<string, { view: boolean; edit: boolean; expiresAt: string | null }> = {};
  for (const row of rows) {
    if (isExpired(row.expires_at, now)) continue;
    map[row.module_id] = { view: row.can_view, edit: row.can_edit, expiresAt: row.expires_at };
  }
  return map;
}

/**
 * Extras vigentes de la persona de la sesión. La RLS de la 0529 ya deja leer solo
 * las filas propias (o todas a un admin): el filtro por `user_id` hace que no
 * dependa de eso, igual que `getStudioAccess` con `user_tenants`.
 */
export async function getMyModuleGrants(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserModuleGrants> {
  try {
    const { data, error } = await supabase
      .from("studio_user_module_grants")
      .select(COLUMNS)
      .eq("user_id", userId);
    if (error || !Array.isArray(data)) return {};
    return grantsFromRows(data as UserModuleGrantRow[]);
  } catch {
    // Cliente sin la tabla o doble de pruebas sin esa consulta: el rol decide solo.
    return {};
  }
}

/** Filas → vista de pantalla (incluye vencidos, marcados). */
export function grantViewsFromRows(
  rows: readonly UserModuleGrantRow[],
  isSensitive: (moduleId: string) => boolean,
  now = Date.now(),
): UserModuleGrantView[] {
  return rows.map((r) => ({
    userId: r.user_id,
    moduleId: r.module_id,
    canView: r.can_view,
    canEdit: r.can_edit,
    reason: r.reason,
    expiresAt: r.expires_at,
    grantedBy: r.granted_by,
    sensitive: isSensitive(r.module_id),
    updatedAt: r.updated_at,
    expired: isExpired(r.expires_at, now),
    expiringSoon:
      r.expires_at !== null && !isExpired(r.expires_at, now) && Date.parse(r.expires_at) - now < POR_VENCER_MS,
  }));
}

/**
 * Todos los extras del tenant (vigentes y vencidos), para la pantalla de
 * Usuarios. Con el cliente de sesión de un admin la RLS devuelve las del tenant;
 * con service_role hay que pasar `tenantId`.
 */
export async function listTenantModuleGrants(
  supabase: SupabaseClient,
  isSensitive: (moduleId: string) => boolean,
  tenantId?: string,
): Promise<UserModuleGrantView[]> {
  try {
    let q = supabase.from("studio_user_module_grants").select(COLUMNS);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return grantViewsFromRows(data as UserModuleGrantRow[], isSensitive);
  } catch {
    return [];
  }
}

/** Extras vigentes por persona del tenant (para evaluar a terceros: bandeja, asesores). */
export async function getTenantGrantsByUser(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Map<string, UserModuleGrants>> {
  const out = new Map<string, UserModuleGrants>();
  let rows: UserModuleGrantRow[] = [];
  try {
    const { data, error } = await supabase
      .from("studio_user_module_grants")
      .select(COLUMNS)
      .eq("tenant_id", tenantId);
    if (error || !Array.isArray(data)) return out;
    rows = data as UserModuleGrantRow[];
  } catch {
    return out;
  }
  const byUser = new Map<string, UserModuleGrantRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  for (const [userId, rows] of byUser) out.set(userId, grantsFromRows(rows));
  return out;
}
