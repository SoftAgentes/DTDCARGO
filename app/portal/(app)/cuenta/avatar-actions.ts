"use server";

/**
 * Avatar del cliente (SDD-0138 Slice D). Foto de perfil COSMÉTICA, editable
 * cuando quiera — separada de la foto de cédula (verificación, "Completa tu
 * perfil"). Mismo patrón de defensa que completeProfileAction: identidad por
 * SESIÓN (`get_portal_client_id`) → escribir con ADMIN client scopeado a ese id.
 * Storage: bucket privado client-docs, sub-path avatar/ (migr 0199).
 *
 * Deploy-seguro: si la migración 0199 todavía no está aplicada, el select/update
 * de `avatar_path` falla → mensaje amable, nada se rompe.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  PHOTO_BUCKET,
  validateAvatarFile,
  uploadClientAvatar,
} from "@/lib/portal/client-photo";

export type AvatarActionState = { ok?: boolean; error?: string };

export async function updateAvatarAction(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  // 1. Identidad por sesión.
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = portalClientId as string;

  // 2. Validar la foto.
  const v = validateAvatarFile(formData.get("avatar"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al id verificado por sesión). Si la columna
  //    avatar_path no existe todavía (migr 0199 sin aplicar) → mensaje amable.
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, avatar_path")
    .eq("id", clientId)
    .maybeSingle<{ tenant_id: string; markbox: string; avatar_path: string | null }>();
  if (rowErr || !row) {
    return { error: "La foto de perfil no está disponible todavía." };
  }
  const oldPath = String(row.avatar_path ?? "").trim() || null;

  // 4. Subir el avatar nuevo.
  const up = await uploadClientAvatar(admin, row.tenant_id, row.markbox, v.file);
  if (up.error || !up.path) {
    console.error("[updateAvatarAction] upload error:", up.error);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. Update (rollback del archivo recién subido si falla — no dejar huérfano).
  const { error: updErr } = await admin
    .from("clients")
    .update({ avatar_path: up.path })
    .eq("id", clientId);
  if (updErr) {
    await admin.storage.from(PHOTO_BUCKET).remove([up.path]).catch(() => {});
    console.error("[updateAvatarAction] update error:", updErr);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 6. Best-effort: borrar el avatar viejo reemplazado.
  if (oldPath) {
    await admin.storage.from(PHOTO_BUCKET).remove([oldPath]).catch(() => {});
  }

  revalidatePath("/portal/cuenta");
  return { ok: true };
}
