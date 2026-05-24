/**
 * Queries del módulo Vault interno DTD-CARGO (SDD-0025 Fase 1).
 *
 * Fase 1 — solo lectura, NO desencripta. Las queries devuelven items
 * con `ciphertext`/`nonce`/`dek_encrypted`/`dek_nonce` crudos. La
 * desencripción es responsabilidad del runtime crypto (lib/studio/vault/
 * crypto.ts) que llega en Fase 2.
 *
 * RLS hace todo el filtrado server-side:
 *   - vault_items: user_id = auth.uid() (spec §4.8)
 *   - vault_user_keys: user_id = auth.uid()
 *   - vault_access_log: owner OR admin (vault_check_admin RPC)
 *   - vault_recovery_requests: requester OR admin
 *   - vault_kek_versions: admin
 *
 * Si el user no es admin, las queries que requieren admin devuelven []
 * (no error — RLS filtra silenciosamente).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VaultAccessLog,
  VaultCategory,
  VaultItem,
  VaultKekVersion,
  VaultKpis,
  VaultRecoveryRequest,
  VaultRecoveryStatus,
  VaultUserKeys,
  VaultUserKeysPublic,
} from "./vault-types";

const EMPTY_KPIS: VaultKpis = {
  totalItems: 0,
  itemsLast30d: 0,
  recoveryPending: 0,
  alerts24h: 0,
};

// ─── Items ──────────────────────────────────────────────────

export interface ListItemsFilters {
  category?: VaultCategory;
  search?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Lista items del Vault para el user logueado (RLS aplica user_id).
 * Excluye soft-deleted. Search es ilike en name + url + username
 * (NUNCA en ciphertext — eso requeriría desencriptar todo).
 *
 * Devuelve ciphertext crudo. El caller que necesite plaintext
 * desencripta con lib/studio/vault/crypto.ts (Fase 2).
 */
export async function listItems(
  supabase: SupabaseClient,
  filters: ListItemsFilters = {},
): Promise<VaultItem[]> {
  let q = supabase
    .from("vault_items")
    .select("*")
    .is("deleted_at", null);

  if (filters.category) q = q.eq("category", filters.category);
  if (filters.favorite !== undefined) q = q.eq("favorite", filters.favorite);

  if (filters.search) {
    const term = `%${filters.search.replace(/[%_]/g, "\\$&")}%`;
    q = q.or(`name.ilike.${term},url.ilike.${term},username.ilike.${term}`);
  }

  q = q.order("favorite", { ascending: false })
       .order("updated_at", { ascending: false });

  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as VaultItem[];
}

export async function getItem(
  supabase: SupabaseClient,
  id: string,
): Promise<VaultItem | null> {
  const { data, error } = await supabase
    .from("vault_items")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<VaultItem>();
  if (error) return null;
  return data;
}

// ─── User keys ──────────────────────────────────────────────

/**
 * Lee la row de vault_user_keys del user logueado (RLS filtra). Si
 * setup_completed=false, el caller debería redirect a /vault/setup.
 *
 * Devuelve la versión "completa" con bytea — usar solo server-side.
 * Para enviar al cliente, mapear a VaultUserKeysPublic con
 * `toPublicKeys()`.
 */
export async function getUserKeys(
  supabase: SupabaseClient,
): Promise<VaultUserKeys | null> {
  const { data, error } = await supabase
    .from("vault_user_keys")
    .select("*")
    .maybeSingle<VaultUserKeys>();
  if (error) return null;
  return data;
}

/** Convierte VaultUserKeys → shape segura para mandar al cliente. */
export function toPublicKeys(k: VaultUserKeys): VaultUserKeysPublic {
  return {
    user_id: k.user_id,
    has_master_password: k.has_master_password,
    totp_enabled: k.totp_enabled,
    setup_completed: k.setup_completed,
    role: k.role,
    last_unlock_at: k.last_unlock_at,
    failed_unlock_attempts: k.failed_unlock_attempts,
    locked_until: k.locked_until,
  };
}

// ─── Access log ─────────────────────────────────────────────

export interface ListAccessLogFilters {
  userId?: string;     // admin only — filtrar por user específico
  action?: string;
  itemId?: string;
  limit?: number;
  offset?: number;
}

export async function listAccessLog(
  supabase: SupabaseClient,
  filters: ListAccessLogFilters = {},
): Promise<VaultAccessLog[]> {
  let q = supabase
    .from("vault_access_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.itemId) q = q.eq("item_id", filters.itemId);

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as VaultAccessLog[];
}

// ─── Recovery requests ──────────────────────────────────────

export interface ListRecoveryRequestsFilters {
  status?: VaultRecoveryStatus;
  limit?: number;
  offset?: number;
}

/**
 * RLS devuelve solo las propias del user (si es member) o todas
 * (si es admin). El caller no necesita saber qué rol tiene — RLS
 * filtra solo.
 */
export async function listRecoveryRequests(
  supabase: SupabaseClient,
  filters: ListRecoveryRequestsFilters = {},
): Promise<VaultRecoveryRequest[]> {
  let q = supabase
    .from("vault_recovery_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status) q = q.eq("status", filters.status);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as VaultRecoveryRequest[];
}

// ─── KEK versions ───────────────────────────────────────────

/**
 * Lista versiones de KEK. RLS exige rol admin — si el caller no es
 * admin, devuelve [] sin error.
 */
export async function listKekVersions(
  supabase: SupabaseClient,
): Promise<VaultKekVersion[]> {
  const { data, error } = await supabase
    .from("vault_kek_versions")
    .select("*")
    .order("version", { ascending: false });
  if (error) return [];
  return (data ?? []) as VaultKekVersion[];
}

/**
 * Devuelve la versión activa actual (caché en el RPC). Útil para
 * que el cliente sepa qué `key_version` poner al crear items nuevos.
 *
 * Si retorna null, el Vault no está inicializado (KEK no creada
 * manualmente post-deploy — ver spec §7.1).
 */
export async function getActiveKekVersion(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("vault_get_active_kek_version");
  if (error || data == null) return null;
  return data as number;
}

// ─── KPIs ───────────────────────────────────────────────────

/**
 * KPIs agregados del Vault del user logueado. Defensivo: si alguna
 * query rompe (Vault no instalado, RLS bloquea), devuelve EMPTY_KPIS
 * para no romper el render.
 */
export async function computeVaultKpis(
  supabase: SupabaseClient,
): Promise<VaultKpis> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [totalResp, recentResp, pendingResp, alertsResp] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("vault_items")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("vault_recovery_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("vault_access_log")
      .select("id", { count: "exact", head: true })
      .in("action", ["recovery_requested", "kek_rotated"])
      .gte("created_at", twentyFourHoursAgo),
  ]);

  if (
    totalResp.error ||
    recentResp.error ||
    pendingResp.error ||
    alertsResp.error
  ) {
    return EMPTY_KPIS;
  }

  return {
    totalItems: totalResp.count ?? 0,
    itemsLast30d: recentResp.count ?? 0,
    recoveryPending: pendingResp.count ?? 0,
    alerts24h: alertsResp.count ?? 0,
  };
}

// ─── Helpers de admin check ─────────────────────────────────

/**
 * Wrapper conveniente del RPC vault_check_admin. Sin user_id explícito
 * usa auth.uid() del JWT (que es lo común).
 */
export async function isVaultAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("vault_check_admin", {
    p_user_id: userId,
  });
  if (error || data == null) return false;
  return data === true;
}
