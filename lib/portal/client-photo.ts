/**
 * Foto de identidad del cliente (cédula/RIF) → Storage privado.
 *
 * Antes vivía inline en el registro self-service. Con el REGISTRO EXPRESS (founder
 * 2026-06-07) la foto se DIFIERE a "Completa tu perfil" dentro del portal, así que
 * la lógica de validación + subida se factoriza acá para que la consuma la server
 * action del perfil (`app/portal/(app)/perfil/actions.ts`).
 *
 * El bucket `client-docs` es PRIVADO (PII sensible): solo el admin client
 * (service_role) sube/lee; el cliente nunca lo toca directo. El path conserva la
 * convención del proyecto: `{tenant_id}/{markbox}/{uuid}.{ext}`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "client-docs";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024; // 8MB
export const PHOTO_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

/** Resultado de validar el File subido. `error` es un mensaje de campo amable. */
export type PhotoValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Valida un `File` candidato a foto de identidad (presencia + tipo MIME + tamaño).
 * Función pura — no toca Storage. La usa la server action antes de subir.
 */
export function validatePhotoFile(raw: FormDataEntryValue | null): PhotoValidation {
  if (!(raw instanceof File) || raw.size <= 0) {
    return { ok: false, error: "Sube la foto de tu cédula/RIF." };
  }
  if (!PHOTO_ALLOWED_MIME.has(raw.type)) {
    return { ok: false, error: "Formato de foto inválido (JPG/PNG/WebP/HEIC)." };
  }
  if (raw.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: "Foto demasiado pesada (máx 8 MB)." };
  }
  return { ok: true, file: raw };
}

/**
 * Sube la foto al bucket privado y devuelve el `storage_path` (para guardar en
 * `clients.cedula_photo_path`). Recibe el admin client (service_role) — el bucket
 * es privado. Devuelve `{ error }` si la subida falla (el caller decide el rollback).
 */
export async function uploadClientPhoto(
  admin: SupabaseClient,
  tenantId: string,
  markbox: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const ext = mimeToExt(file.type);
  const path = `${tenantId}/${markbox}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    return { error: error.message };
  }
  return { path };
}

/**
 * Sube el AVATAR del cliente (SDD-0138 Slice D · SDD-0487) al mismo bucket
 * privado, bajo el sub-path `avatar/`, separado de la foto de cédula
 * (verificación). Recibe los bytes de un JPEG que ya pasó por
 * `stripJpegMetadata`: el avatar siempre se guarda como JPEG sin metadatos.
 * El path se guarda en `clients.avatar_path` (migr 0199).
 */
export async function uploadClientAvatarJpeg(
  admin: SupabaseClient,
  tenantId: string,
  markbox: string,
  jpeg: Uint8Array,
): Promise<{ path?: string; error?: string }> {
  const path = `${tenantId}/${markbox}/avatar/${crypto.randomUUID()}.jpg`;
  const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, Buffer.from(jpeg), {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    return { error: error.message };
  }
  return { path };
}
