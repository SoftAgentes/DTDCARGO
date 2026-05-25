"use server";

/**
 * Server actions de upload de fotos del receipt (SDD-0028).
 *
 * Patrón:
 *  1. Cliente envía File por FormData a uploadReceiptPhotoAction
 *  2. Server resuelve operario desde cookie HTTP-only
 *  3. Sube a bucket `receipt-photos` con service_role
 *  4. Llama RPC link_receipt_photo para indexar
 *  5. Devuelve { ok, storage_path }
 *
 * El operario NO es authenticated → toda la operación usa
 * createAdminClient + service_role.
 */

import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";

const BUCKET = "receipt-photos";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;            // 8MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type UploadPhotoResult =
  | { ok: true; storagePath: string; photoId: string }
  | { ok: false; error: string };

/**
 * Sube 1 foto y la vincula al receipt. Llamar 1 vez por archivo.
 * El cliente del wizard pasa receipt_id + file + position.
 */
export async function uploadReceiptPhotoAction(
  formData: FormData,
): Promise<UploadPhotoResult> {
  const operario = await getCurrentOperario();
  if (!operario) return { ok: false, error: "Sesión expirada." };

  const receiptId = String(formData.get("receipt_id") ?? "").trim();
  const position = Number(formData.get("position") ?? 0);
  const file = formData.get("photo");

  if (!receiptId) return { ok: false, error: "Falta receipt_id." };
  if (!(file instanceof File)) return { ok: false, error: "Falta archivo." };
  if (file.size <= 0) return { ok: false, error: "Archivo vacío." };
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `Archivo > 8MB (${Math.round(file.size / 1024 / 1024)}MB).`,
    };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Tipo no soportado: ${file.type}`,
    };
  }

  // Path: {tenant_id}/{receipt_id}/{position}-{rand}.{ext}
  const ext = mimeToExt(file.type);
  const rand = crypto.randomUUID().slice(0, 8);
  const safePos = String(position).padStart(2, "0");
  const path = `${operario.tenant_id}/${receiptId}/${safePos}-${rand}.${ext}`;

  const admin = createAdminClient();

  // Upload a Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: "31536000",            // 1 año (path tiene rand uuid → immutable)
      upsert: false,
    });

  if (uploadErr) {
    console.error("[uploadReceiptPhoto] storage upload error:", uploadErr);
    return { ok: false, error: `Storage: ${uploadErr.message}` };
  }

  // Indexar via RPC (valida operario + tenant scope)
  const { data: photoId, error: linkErr } = await admin.rpc(
    "link_receipt_photo",
    {
      p_operario_id: operario.operario_id,
      p_receipt_id: receiptId,
      p_storage_path: path,
      p_position: position,
      p_size_bytes: file.size,
      p_content_type: file.type,
    },
  );

  if (linkErr) {
    console.error("[uploadReceiptPhoto] link error:", linkErr);
    // Rollback: borrar el object huérfano del bucket
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
    return { ok: false, error: `Link: ${linkErr.message}` };
  }

  return {
    ok: true,
    storagePath: path,
    photoId: photoId as string,
  };
}

/**
 * Devuelve URLs firmadas (TTL 1h) de las fotos de un receipt para que el
 * cliente las muestre en el detail modal del home. Service_role.
 */
export async function getReceiptPhotoSignedUrlsAction(
  receiptId: string,
): Promise<{ url: string; position: number; id: string }[]> {
  const operario = await getCurrentOperario();
  if (!operario) return [];
  if (!receiptId) return [];

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("warehouse_receipt_photos")
    .select("id, storage_path, position")
    .eq("receipt_id", receiptId)
    .eq("tenant_id", operario.tenant_id)
    .order("position", { ascending: true })
    .limit(20);

  if (error || !rows || rows.length === 0) return [];

  // Crear signed URLs en batch
  const paths = rows.map((r) => r.storage_path as string);
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (!signed) return [];

  return rows.map((r, i) => ({
    id: r.id as string,
    position: r.position as number,
    url: signed[i]?.signedUrl ?? "",
  }));
}

function mimeToExt(mime: string): string {
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
