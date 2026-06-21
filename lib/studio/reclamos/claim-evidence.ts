/**
 * Evidencia de un reclamo (SDD-0101 · B2) — fotos/documentos en el bucket
 * privado `claim-evidence`. Factorizado acá para que lo consuman tanto la action
 * del Studio (equipo) como la del Portal (cliente). El portal lo importa por la
 * misma razón que claims-types: no está bajo la frontera público↔ERP.
 *
 * El bucket es PRIVADO: el path se arma server-side ({tenant}/{claim}/{uuid}.ext)
 * y la subida usa el client que reciba (user client en el Studio vía storage RLS
 * por tenant; admin client en el Portal porque el cliente no matchea el tenant).
 * Las signed URLs se generan server-side; el ownership ya lo garantiza la RLS de
 * tabla antes de firmar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLAIM_EVIDENCE_BUCKET = "claim-evidence";
export const CLAIM_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024; // 10MB (= límite del bucket)
export const CLAIM_EVIDENCE_MAX_FILES = 8; // por subida/reclamo

export const CLAIM_EVIDENCE_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type ClaimEvidenceType = "foto" | "documento" | "otro";

export function inferEvidenceType(mime: string): ClaimEvidenceType {
  if (mime === "application/pdf") return "documento";
  if (mime.startsWith("image/")) return "foto";
  return "otro";
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

function evidenceExt(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
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

export type EvidenceValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

/** Valida un File candidato a evidencia (presencia + MIME + tamaño). PURO. */
export function validateEvidenceFile(raw: FormDataEntryValue | null): EvidenceValidation {
  if (!(raw instanceof File) || raw.size <= 0) {
    return { ok: false, error: "Archivo vacío o inválido." };
  }
  if (!CLAIM_EVIDENCE_ALLOWED_MIME.has(raw.type)) {
    return { ok: false, error: "Formato no permitido (JPG/PNG/WebP/HEIC o PDF)." };
  }
  if (raw.size > CLAIM_EVIDENCE_MAX_BYTES) {
    return { ok: false, error: "Archivo muy pesado (máx 10 MB)." };
  }
  return { ok: true, file: raw };
}

/**
 * Extrae hasta `CLAIM_EVIDENCE_MAX_FILES` archivos válidos del FormData (campo
 * `evidence`). Devuelve los válidos + cuántos se descartaron. No tira: los
 * inválidos se ignoran (la evidencia es opcional, no debe romper el reporte).
 */
export function collectEvidenceFiles(formData: FormData): {
  files: File[];
  skipped: number;
} {
  const all = formData.getAll("evidence");
  const valid: File[] = [];
  let skipped = 0;
  for (const raw of all) {
    if (valid.length >= CLAIM_EVIDENCE_MAX_FILES) break;
    const v = validateEvidenceFile(raw);
    if (v.ok) valid.push(v.file);
    else if (raw instanceof File && raw.size > 0) skipped += 1;
  }
  return { files: valid, skipped };
}

/**
 * Sube UN archivo de evidencia y registra la fila. Recibe el client (user client
 * en Studio, admin en Portal). El trigger fuerza el client_markbox correcto desde
 * el claim. Devuelve `{ path }` o `{ error }`; el caller decide el rollback.
 */
export async function uploadClaimEvidence(
  db: SupabaseClient,
  args: {
    tenantId: string;
    claimId: string;
    file: File;
    source: "studio" | "portal";
    uploadedBy: string | null;
  },
): Promise<{ path?: string; error?: string }> {
  const { tenantId, claimId, file, source, uploadedBy } = args;
  const ext = evidenceExt(file.type);
  const path = `${tenantId}/${claimId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from(CLAIM_EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };

  const { error: insErr } = await db.from("client_claim_evidence").insert({
    tenant_id: tenantId,
    claim_id: claimId,
    evidence_type: inferEvidenceType(file.type),
    storage_path: path,
    file_name: (file.name || `evidencia.${ext}`).slice(0, 200),
    content_type: file.type,
    size_bytes: file.size,
    source,
    uploaded_by: uploadedBy,
  });
  if (insErr) {
    await db.storage.from(CLAIM_EVIDENCE_BUCKET).remove([path]).catch(() => {});
    return { error: insErr.message };
  }
  return { path };
}

/** Sube un lote; devuelve cuántas subieron OK. No tira (best-effort por archivo). */
export async function uploadClaimEvidenceBatch(
  db: SupabaseClient,
  args: {
    tenantId: string;
    claimId: string;
    files: File[];
    source: "studio" | "portal";
    uploadedBy: string | null;
  },
): Promise<{ uploaded: number }> {
  let uploaded = 0;
  for (const file of args.files) {
    const r = await uploadClaimEvidence(db, {
      tenantId: args.tenantId,
      claimId: args.claimId,
      file,
      source: args.source,
      uploadedBy: args.uploadedBy,
    });
    if (!r.error) uploaded += 1;
  }
  return { uploaded };
}

export type ClaimEvidenceItem = {
  id: string;
  claimId: string;
  evidenceType: ClaimEvidenceType;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  isImage: boolean;
  createdAt: string;
  /** Signed URL (TTL corto) o null si no se pudo firmar. */
  url: string | null;
};

const EVIDENCE_URL_TTL = 3600; // 1h — galería en pantalla

/**
 * Lista la evidencia de un set de claims (read) + firma las URLs. `readDb` lee la
 * tabla (RLS aplica: equipo por tenant, cliente por markbox). `signDb` firma el
 * storage (user client en Studio; admin client en Portal, porque el cliente no
 * matchea la storage RLS por tenant). Pueden ser el mismo client en el Studio.
 */
export async function listClaimEvidence(
  readDb: SupabaseClient,
  signDb: SupabaseClient,
  claimIds: string[],
): Promise<Map<string, ClaimEvidenceItem[]>> {
  const out = new Map<string, ClaimEvidenceItem[]>();
  if (claimIds.length === 0) return out;

  const { data, error } = await readDb
    .from("client_claim_evidence")
    .select("id, claim_id, evidence_type, storage_path, file_name, content_type, created_at")
    .in("claim_id", claimIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !data) return out;

  const paths = data.map((r) => r.storage_path as string);
  const signed: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: urls } = await signDb.storage
      .from(CLAIM_EVIDENCE_BUCKET)
      .createSignedUrls([...new Set(paths)], EVIDENCE_URL_TTL);
    if (urls) {
      for (const u of urls) {
        if (u.path && u.signedUrl) signed[u.path] = u.signedUrl;
      }
    }
  }

  for (const r of data) {
    const claimId = r.claim_id as string;
    const item: ClaimEvidenceItem = {
      id: r.id as string,
      claimId,
      evidenceType: r.evidence_type as ClaimEvidenceType,
      storagePath: r.storage_path as string,
      fileName: r.file_name as string,
      contentType: (r.content_type as string | null) ?? null,
      isImage: isImageMime(r.content_type as string | null),
      createdAt: r.created_at as string,
      url: signed[r.storage_path as string] ?? null,
    };
    const arr = out.get(claimId) ?? [];
    arr.push(item);
    out.set(claimId, arr);
  }
  return out;
}
