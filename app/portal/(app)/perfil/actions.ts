"use server";

/**
 * "Mi perfil" unificado (SDD-0145 · reemplaza al "Completa tu perfil" del
 * registro express). La única mutación self-service de IDENTIDAD es la foto de
 * cédula/RIF (verificación): el cliente la sube desde la fila de documento
 * pendiente. La dirección canónica vive en `client_delivery_addresses`
 * (SDD-0138 · address-actions.ts) y el resto de los datos los media el asesor.
 *
 * Misma defensa en profundidad que el resto del portal: identidad por SESIÓN
 * (`get_portal_client_id`, helper aislada) → escritura con ADMIN client
 * (service_role) scopeada EXPLÍCITO a ese id (la RLS del portal es read-only
 * para `clients`; el cliente nunca toca el bucket privado directo). Rollback de
 * la foto recién subida si el update falla (no dejar huérfana) + borrado
 * best-effort de la reemplazada (no dejar PII colgada).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadClientPhoto,
} from "@/lib/portal/client-photo";

export type CedulaPhotoActionState = { ok?: boolean; error?: string };

export async function uploadCedulaPhotoAction(
  _prev: CedulaPhotoActionState,
  formData: FormData,
): Promise<CedulaPhotoActionState> {
  // 1. Identidad por SESIÓN: el client_id del portal logueado.
  const supabase = await createClient();
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) {
    return { error: "Tu sesión expiró. Vuelve a entrar al portal." };
  }
  const clientId = portalClientId as string;

  // 2. Validar la foto (obligatoria: esta action ES la subida de la foto).
  const v = validatePhotoFile(formData.get("cedula_photo"));
  if (!v.ok) return { error: v.error };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "No está disponible ahora. Prueba de nuevo en un rato." };
  }

  // 3. Estado actual (scopeado al id verificado por sesión): tenant + markbox
  //    para el path y si ya había una foto (reemplazo).
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("tenant_id, markbox, cedula_photo_path")
    .eq("id", clientId)
    .maybeSingle<{
      tenant_id: string;
      markbox: string;
      cedula_photo_path: string | null;
    }>();
  if (rowErr || !row) {
    return { error: "No pudimos cargar tu cuenta. Prueba de nuevo." };
  }
  const oldPath = String(row.cedula_photo_path ?? "").trim() || null;

  // 4. Subir la foto nueva al bucket privado (path nuevo por subida).
  const up = await uploadClientPhoto(admin, row.tenant_id, row.markbox, v.file);
  if (up.error || !up.path) {
    console.error("[uploadCedulaPhotoAction] upload error:", up.error);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 5. Update con rollback de la foto recién subida si falla.
  const { error: updErr } = await admin
    .from("clients")
    .update({ cedula_photo_path: up.path })
    .eq("id", clientId);
  if (updErr) {
    await admin.storage.from(PHOTO_BUCKET).remove([up.path]).catch(() => {});
    console.error("[uploadCedulaPhotoAction] update error:", updErr);
    return { error: "No pudimos guardar tu foto. Prueba de nuevo." };
  }

  // 6. Best-effort: borrar la foto vieja reemplazada.
  if (oldPath) {
    await admin.storage.from(PHOTO_BUCKET).remove([oldPath]).catch(() => {});
  }

  revalidatePath("/portal");
  revalidatePath("/portal/perfil");
  return { ok: true };
}
