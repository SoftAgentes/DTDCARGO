"use server";

/**
 * Avatar del cliente (SDD-0138 Slice D). Foto de perfil COSMÉTICA, editable
 * cuando quiera — separada de la foto de cédula (verificación, fila de
 * documento de Mi perfil). Mismo patrón de defensa que uploadCedulaPhotoAction:
 * principal por SESIÓN con tenant coherente → ADMIN scopeado a tenant e id.
 * Storage: bucket privado client-docs, sub-path avatar/ (migr 0199).
 *
 * Deploy-seguro: si la migración 0199 todavía no está aplicada, el select/update
 * de `avatar_path` falla → mensaje amable, nada se rompe.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { createComponentLogger } from "@/lib/observability/structured-logger";
import {
  PHOTO_BUCKET,
  validateAvatarFile,
  uploadClientAvatar,
} from "@/lib/portal/client-photo";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

export type AvatarActionState = { ok?: boolean; error?: string };

async function resolveActionPrincipal() {
  try {
    return await getPortalClientPrincipal(await createClient());
  } catch {
    return null;
  }
}

export async function updateAvatarAction(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const logger = createComponentLogger("portal.profile.avatar-update");
  // 1. Principal por sesión: vínculo activo, cliente vivo y tenant coherente.
  const principal = await resolveActionPrincipal();
  if (!principal) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = principal.client.id;
  const tenantId = principal.tenantId;

  // 2. Validar la foto.
  const v = validateAvatarFile(formData.get("avatar"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al principal verificado). Si la columna
  //    avatar_path no existe todavía (migr 0199 sin aplicar) → mensaje amable.
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, avatar_path")
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle<{ tenant_id: string; markbox: string; avatar_path: string | null }>();
  if (rowErr || !row) {
    return { error: "La foto de perfil no está disponible todavía." };
  }
  const oldPath = String(row.avatar_path ?? "").trim() || null;

  // 4. Subir el avatar nuevo.
  const up = await uploadClientAvatar(admin, tenantId, row.markbox, v.file);
  if (up.error || !up.path) {
    logger.error("portal_profile.action_failed", {
      error: up.error,
      operation: "avatar_update",
      stage: "upload",
    });
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. Update (rollback del archivo recién subido si falla — no dejar huérfano).
  const { error: updErr } = await admin
    .from("clients")
    .update({ avatar_path: up.path })
    .eq("tenant_id", tenantId)
    .eq("id", clientId)
    .is("deleted_at", null);
  if (updErr) {
    await admin.storage.from(PHOTO_BUCKET).remove([up.path]).catch(() => {});
    logger.error("portal_profile.action_failed", {
      error: updErr,
      operation: "avatar_update",
      stage: "write",
    });
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 6. Best-effort: borrar el avatar viejo reemplazado.
  if (oldPath) {
    await admin.storage.from(PHOTO_BUCKET).remove([oldPath]).catch(() => {});
  }

  revalidatePath("/portal/perfil");
  return { ok: true };
}
