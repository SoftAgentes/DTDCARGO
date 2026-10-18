"use server";

/**
 * Avatar del cliente (SDD-0138 Slice D · SDD-0487). Foto de perfil COSMÉTICA,
 * editable cuando quiera y sin gastar cupo, separada de la foto de cédula
 * (verificación). Identidad por SESIÓN (`getPortalClientPrincipal`) → ADMIN
 * client scopeado a ese id. Storage: bucket privado client-docs, sub-path
 * avatar/, con el tenant y el markbox del principal (SDD-0552: ya no se releen
 * de `clients` con el admin).
 *
 * SDD-0487: el navegador ya entrega un JPEG reducido (`prepareAvatar`). Aquí se
 * exige ese formato, se limita a 2 MB y se quitan los metadatos otra vez
 * (EXIF con GPS, XMP, IPTC), porque una llamada directa a la action podría
 * saltarse el navegador. `removeAvatarAction` borra la foto de verdad: primero
 * el objeto y después el puntero.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getPortalClientPrincipal,
  type PortalClientPrincipal,
} from "@/lib/portal/portal-queries";
import { PHOTO_BUCKET, uploadClientAvatarJpeg } from "@/lib/portal/client-photo";
import { AVATAR_MAX_BYTES, AVATAR_MESSAGES } from "@/lib/portal/avatar-image";
import { stripJpegMetadata } from "@/lib/portal/jpeg-metadata";

export type AvatarActionState = { ok?: boolean; removed?: boolean; error?: string };

const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a entrar al portal.";
const UNAVAILABLE = "No está disponible ahora. Prueba de nuevo en un rato.";

async function sessionPrincipal(): Promise<PortalClientPrincipal | null> {
  return getPortalClientPrincipal(await createClient());
}

export async function updateAvatarAction(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  // 1. Identidad por sesión.
  const principal = await sessionPrincipal();
  if (!principal) return { error: SESSION_EXPIRED };
  const clientId = principal.client.id;

  // 2. Sólo el JPEG que preparó el navegador, y sin metadatos.
  const raw = formData.get("avatar");
  if (!(raw instanceof File) || raw.size <= 0) {
    return { error: "Elige una foto para tu perfil." };
  }
  if (raw.type !== "image/jpeg") return { error: AVATAR_MESSAGES.notImage };
  if (raw.size > AVATAR_MAX_BYTES) return { error: AVATAR_MESSAGES.tooLarge };
  const clean = stripJpegMetadata(new Uint8Array(await raw.arrayBuffer()));
  if (!clean) return { error: AVATAR_MESSAGES.unreadable };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: UNAVAILABLE };
  }

  // 3. Avatar actual, scopeado al id verificado por sesión.
  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("avatar_path")
    .eq("id", clientId)
    .maybeSingle<{ avatar_path: string | null }>();
  if (rowErr || !row) {
    return { error: "La foto de perfil no está disponible todavía." };
  }
  const oldPath = String(row.avatar_path ?? "").trim() || null;

  // 4. Subir el avatar nuevo, bajo el tenant y el markbox del principal.
  const up = await uploadClientAvatarJpeg(
    admin,
    principal.tenantId,
    principal.client.markbox,
    clean,
  );
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

  revalidatePath("/portal/perfil");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<AvatarActionState> {
  const principal = await sessionPrincipal();
  if (!principal) return { error: SESSION_EXPIRED };
  const clientId = principal.client.id;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: UNAVAILABLE };
  }

  const { data: row, error: rowErr } = await admin
    .from("clients")
    .select("avatar_path")
    .eq("id", clientId)
    .maybeSingle<{ avatar_path: string | null }>();
  if (rowErr || !row) return { error: UNAVAILABLE };

  const path = String(row.avatar_path ?? "").trim();
  if (!path) {
    revalidatePath("/portal/perfil");
    return { ok: true, removed: true };
  }

  // Primero el objeto: si no se pudo borrar, el puntero queda y se puede
  // reintentar. Al revés, la foto quedaría en el bucket sin forma de ubicarla.
  const { error: rmErr } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
  if (rmErr) {
    console.error("[removeAvatarAction] remove error:", rmErr);
    return { error: "No pudimos quitar tu foto. Prueba de nuevo." };
  }

  const { error: updErr } = await admin
    .from("clients")
    .update({ avatar_path: null })
    .eq("id", clientId);
  if (updErr) {
    console.error("[removeAvatarAction] update error:", updErr);
    return { error: "No pudimos quitar tu foto. Prueba de nuevo." };
  }

  revalidatePath("/portal/perfil");
  return { ok: true, removed: true };
}
