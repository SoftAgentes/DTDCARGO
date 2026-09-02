import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { PHOTO_BUCKET } from "@/lib/portal/client-photo";

type PrivateProfileRpcRow = {
  previous_markboxes?: unknown;
  avatar_path?: unknown;
  cedula_photo_path?: unknown;
};

export type PortalPrivateProfileContext = {
  previousMarkboxes: string[];
  avatarUrl: string | null;
  cedulaUrl: string | null;
};

const EMPTY: PortalPrivateProfileContext = {
  previousMarkboxes: [],
  avatarUrl: null,
  cedulaUrl: null,
};

/**
 * Resuelve códigos históricos y firma las fotos del propio principal. No recibe
 * ids ni paths: ambos salen de una RPC ligada a auth.uid(). Sin principal o ante
 * cualquier fallo, devuelve el contexto vacío.
 */
export async function getPortalPrivateProfileContext(
  db: SupabaseClient,
): Promise<PortalPrivateProfileContext> {
  const { data, error } = await db.rpc("get_portal_private_profile_context");
  if (error) return EMPTY;

  const row = (Array.isArray(data) ? data[0] : data) as PrivateProfileRpcRow | null;
  if (!row) return EMPTY;

  const previousMarkboxes = Array.isArray(row.previous_markboxes)
    ? row.previous_markboxes.map(String).filter(Boolean)
    : [];
  const avatarPath = String(row.avatar_path ?? "").trim();
  const cedulaPath = String(row.cedula_photo_path ?? "").trim();
  if (!avatarPath && !cedulaPath) {
    return { previousMarkboxes, avatarUrl: null, cedulaUrl: null };
  }

  try {
    const storage = createAdminClient().storage.from(PHOTO_BUCKET);
    const [avatar, cedula] = await Promise.all([
      avatarPath
        ? storage.createSignedUrl(avatarPath, 3600)
        : Promise.resolve({ data: null }),
      cedulaPath
        ? storage.createSignedUrl(cedulaPath, 3600)
        : Promise.resolve({ data: null }),
    ]);
    return {
      previousMarkboxes,
      avatarUrl: avatar.data?.signedUrl ?? null,
      cedulaUrl: cedula.data?.signedUrl ?? null,
    };
  } catch {
    return { previousMarkboxes, avatarUrl: null, cedulaUrl: null };
  }
}
