/**
 * Fotos de un reporte de inspección (SDD-0066 · Fase 2/3) — bucket privado
 * `inspections`. Calca el patrón de claim-evidence (SDD-0101): el path se arma
 * server-side ({tenant}/inspection/{report_id}/{uuid}.ext), la subida usa el
 * user client (storage RLS por tenant), las signed URLs se firman server-side.
 *
 * Las fotos crudas del tercero NUNCA van a git/seeds (solo Storage). `redacted`
 * marca una foto cuyas marcas del proveedor deben ocultarse (white-label).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const INSPECTION_BUCKET = "inspections";
export const INSPECTION_PHOTO_MAX_BYTES = 25 * 1024 * 1024; // 25MB (= límite del bucket)
export const INSPECTION_PHOTO_MAX_FILES = 12; // por subida

export const INSPECTION_PHOTO_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function photoExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export type PhotoValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

/** Valida un File candidato a foto (presencia + MIME + tamaño). PURO. */
export function validateInspectionPhoto(
  raw: FormDataEntryValue | null,
): PhotoValidation {
  if (!(raw instanceof File) || raw.size <= 0) {
    return { ok: false, error: "Archivo vacío o inválido." };
  }
  if (!INSPECTION_PHOTO_ALLOWED_MIME.has(raw.type)) {
    return { ok: false, error: "Formato no permitido (JPG/PNG/WebP)." };
  }
  if (raw.size > INSPECTION_PHOTO_MAX_BYTES) {
    return { ok: false, error: "Archivo muy pesado (máx 25 MB)." };
  }
  return { ok: true, file: raw };
}

/**
 * Extrae hasta INSPECTION_PHOTO_MAX_FILES fotos válidas del FormData (campo
 * `photos`). No tira: las inválidas se ignoran y se cuentan.
 */
export function collectInspectionPhotos(formData: FormData): {
  files: File[];
  skipped: number;
} {
  const all = formData.getAll("photos");
  const valid: File[] = [];
  let skipped = 0;
  for (const raw of all) {
    if (valid.length >= INSPECTION_PHOTO_MAX_FILES) break;
    const v = validateInspectionPhoto(raw);
    if (v.ok) valid.push(v.file);
    else if (raw instanceof File && raw.size > 0) skipped += 1;
  }
  return { files: valid, skipped };
}

/**
 * Sube UNA foto y registra la fila. Devuelve `{ path }` o `{ error }`; el caller
 * decide el rollback. El `sort` se calcula a partir del máximo existente.
 */
export async function uploadInspectionPhoto(
  db: SupabaseClient,
  args: {
    tenantId: string;
    reportId: string;
    file: File;
    category: string | null;
    sort: number;
  },
): Promise<{ path?: string; error?: string }> {
  const { tenantId, reportId, file, category, sort } = args;
  const ext = photoExt(file.type);
  const path = `${tenantId}/inspection/${reportId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from(INSPECTION_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

  const { error: insErr } = await db.from("inspection_report_photos").insert({
    tenant_id: tenantId,
    report_id: reportId,
    category,
    caption: (file.name || "").slice(0, 200) || null,
    storage_path: path,
    redacted: false,
    sort,
  });
  if (insErr) {
    await db.storage.from(INSPECTION_BUCKET).remove([path]).catch(() => {});
    return { error: insErr.message };
  }
  return { path };
}

/** Sube un lote; devuelve cuántas subieron OK. Best-effort por archivo. */
export async function uploadInspectionPhotoBatch(
  db: SupabaseClient,
  args: {
    tenantId: string;
    reportId: string;
    files: File[];
    category: string | null;
  },
): Promise<{ uploaded: number }> {
  // Punto de partida del sort = máximo actual + 1.
  const { data: maxRow } = await db
    .from("inspection_report_photos")
    .select("sort")
    .eq("report_id", args.reportId)
    .is("deleted_at", null)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort: number }>();
  let sort = (maxRow?.sort ?? -1) + 1;

  let uploaded = 0;
  for (const file of args.files) {
    const r = await uploadInspectionPhoto(db, {
      tenantId: args.tenantId,
      reportId: args.reportId,
      file,
      category: args.category,
      sort,
    });
    if (!r.error) {
      uploaded += 1;
      sort += 1;
    }
  }
  return { uploaded };
}

/** Soft-delete + borra el objeto del bucket (best-effort). */
export async function deleteInspectionPhoto(
  db: SupabaseClient,
  photoId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const { data: photo } = await db
    .from("inspection_report_photos")
    .select("storage_path")
    .eq("id", photoId)
    .is("deleted_at", null)
    .maybeSingle<{ storage_path: string }>();

  const { error } = await db
    .from("inspection_report_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photoId);
  if (error) return { error: `No se pudo eliminar la foto: ${error.message}` };

  if (photo?.storage_path) {
    await db.storage.from(INSPECTION_BUCKET).remove([photo.storage_path]).catch(() => {});
  }
  return { ok: true };
}

export type InspectionPhotoItem = {
  id: string;
  reportId: string;
  category: string | null;
  caption: string | null;
  storagePath: string;
  redacted: boolean;
  sort: number;
  createdAt: string;
  /** Signed URL (TTL corto) o null si no se pudo firmar. */
  url: string | null;
};

const PHOTO_URL_TTL = 3600; // 1h

/**
 * Lista las fotos de un set de reportes + firma las URLs. El mismo client lee
 * (RLS por tenant) y firma (storage RLS por tenant) en el Studio.
 */
export async function listInspectionPhotos(
  db: SupabaseClient,
  reportIds: string[],
): Promise<Map<string, InspectionPhotoItem[]>> {
  const out = new Map<string, InspectionPhotoItem[]>();
  if (reportIds.length === 0) return out;

  const { data, error } = await db
    .from("inspection_report_photos")
    .select("id, report_id, category, caption, storage_path, redacted, sort, created_at")
    .in("report_id", reportIds)
    .is("deleted_at", null)
    .order("sort", { ascending: true });
  if (error || !data) return out;

  const paths = data.map((r) => r.storage_path as string);
  const signed: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: urls } = await db.storage
      .from(INSPECTION_BUCKET)
      .createSignedUrls([...new Set(paths)], PHOTO_URL_TTL);
    if (urls) {
      for (const u of urls) {
        if (u.path && u.signedUrl) signed[u.path] = u.signedUrl;
      }
    }
  }

  for (const r of data) {
    const reportId = r.report_id as string;
    const item: InspectionPhotoItem = {
      id: r.id as string,
      reportId,
      category: (r.category as string | null) ?? null,
      caption: (r.caption as string | null) ?? null,
      storagePath: r.storage_path as string,
      redacted: r.redacted === true,
      sort: Number(r.sort) || 0,
      createdAt: r.created_at as string,
      url: signed[r.storage_path as string] ?? null,
    };
    const arr = out.get(reportId) ?? [];
    arr.push(item);
    out.set(reportId, arr);
  }
  return out;
}
