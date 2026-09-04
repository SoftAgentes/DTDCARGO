import type { SupabaseClient } from "@supabase/supabase-js";

/** SDD-0435: límite vitalicio compartido por datos aprobados + reemplazos de ID. */
export const PROFILE_EDIT_LIMIT = 3;

export type ProfileEditQuota = {
  limit: number;
  applied: number;
  reserved: number;
  remaining: number;
  /** false = la RPC no está disponible; la UI debe fallar cerrada. */
  available: boolean;
};

export const UNAVAILABLE_PROFILE_EDIT_QUOTA: ProfileEditQuota = {
  limit: PROFILE_EDIT_LIMIT,
  applied: 0,
  reserved: 0,
  remaining: 0,
  available: false,
};

type QuotaRow = {
  limit_count?: unknown;
  applied_count?: unknown;
  reserved_count?: unknown;
  remaining_count?: unknown;
};

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

/** Normaliza la fila RPC y nunca permite mostrar un remanente mayor al límite. */
export function mapProfileEditQuota(row: QuotaRow): ProfileEditQuota {
  const limit = integer(row.limit_count) || PROFILE_EDIT_LIMIT;
  const applied = integer(row.applied_count);
  const reserved = integer(row.reserved_count);
  const serverRemaining = integer(row.remaining_count);
  return {
    limit,
    applied,
    reserved,
    remaining: Math.min(serverRemaining, Math.max(0, limit - applied - reserved)),
    available: true,
  };
}

/**
 * Lee únicamente el agregado self-scope. El ledger y las rutas históricas de
 * documentos no se exponen al cliente.
 */
export async function getPortalProfileEditQuota(
  supabase: SupabaseClient,
): Promise<ProfileEditQuota> {
  const { data, error } = await supabase.rpc(
    "get_my_portal_profile_edit_quota",
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("profile_edit_quota_unavailable");
  }
  return mapProfileEditQuota(row as QuotaRow);
}

export function profileEditQuotaLabel(quota: ProfileEditQuota): string {
  if (!quota.available) return "Cupo temporalmente no disponible";
  return `${quota.remaining} de ${quota.limit} cambios disponibles`;
}
