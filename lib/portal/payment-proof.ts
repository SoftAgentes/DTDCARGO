/**
 * Comprobante de pago del reporte (SDD-0134) → Storage privado `payment-proofs`.
 *
 * Espeja `client-photo.ts`: el bucket es PRIVADO (evidencia financiera) — solo el
 * admin client (service_role) sube/lee; el cliente del portal nunca lo toca
 * directo (no matchea get_user_tenant_id() → no puede firmar por RLS). Path:
 *   {tenant_id}/{invoice_id}/{report_id}/{uuid}.{ext}
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROOF_ALLOWED_MIME,
  PROOF_MAX_BYTES,
} from "@/lib/portal/payment-report-types";

export const PROOF_BUCKET = "payment-proofs";

function mimeToExt(mime: string): string {
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

export type ProofValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Valida un `File` candidato a comprobante (presencia + MIME + tamaño). Pura — no
 * toca Storage. El comprobante es OPCIONAL a nivel de negocio (un "otro" puede no
 * tenerlo), así que ausencia => ok:false con `error` que el caller trata como
 * "sin comprobante" cuando corresponde. Para distinguir "vacío" de "inválido"
 * devolvemos error específico; el caller decide si es bloqueante.
 */
export function validateProofFile(raw: FormDataEntryValue | null): ProofValidation {
  if (!(raw instanceof File) || raw.size <= 0) {
    return { ok: false, error: "Adjunta el comprobante de tu pago." };
  }
  if (!PROOF_ALLOWED_MIME.includes(raw.type)) {
    return { ok: false, error: "Formato inválido (PDF, JPG, PNG o WebP)." };
  }
  if (raw.size > PROOF_MAX_BYTES) {
    return { ok: false, error: "El comprobante pesa demasiado (máx 10 MB)." };
  }
  return { ok: true, file: raw };
}

/** ¿Se adjuntó algún archivo? (para distinguir "sin comprobante" de "inválido"). */
export function hasProofFile(raw: FormDataEntryValue | null): boolean {
  return raw instanceof File && raw.size > 0;
}

/**
 * Sube el comprobante al bucket privado y devuelve el `storage_path`. Recibe el
 * admin client (service_role). Devuelve `{ error }` si falla. Un resultado
 * incierto del registro posterior no autoriza borrar el objeto: podría estar
 * vinculado a un reporte confirmado en DB antes de perderse la respuesta.
 */
export async function uploadPaymentProof(
  admin: SupabaseClient,
  args: { tenantId: string; invoiceId: string; reportId: string; file: File },
): Promise<{ path?: string; error?: string }> {
  const ext = mimeToExt(args.file.type);
  const path = `${args.tenantId}/${args.invoiceId}/${args.reportId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await args.file.arrayBuffer());
  const { error } = await admin.storage.from(PROOF_BUCKET).upload(path, buffer, {
    contentType: args.file.type,
    cacheControl: "0", // evidencia: no cachear agresivo
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

type PaymentProofScope = { tenantId: string; invoiceId: string; reportId: string };

const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CANONICAL_PROOF_PATH = new RegExp(
  `^${UUID_PART}/${UUID_PART}/${UUID_PART}/${UUID_PART}\\.(pdf|jpg|png|webp|heic|heif)$`,
);

/**
 * Firma una URL temporal para VER el comprobante (server-side, admin client). El
 * caller debe autorizar primero factura y reporte mediante la sesión. La RLS
 * del reporte no valida su path: comprobar también su contexto antes de usar
 * admin impide firmar referencias ajenas o históricas incoherentes.
 */
export async function createProofSignedUrl(
  admin: SupabaseClient,
  path: string,
  scope: PaymentProofScope,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!scope || !CANONICAL_PROOF_PATH.test(path)
    || !path.startsWith(`${scope.tenantId}/${scope.invoiceId}/${scope.reportId}/`)
    || !Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 300) {
    return null;
  }
  try {
    const { data, error } = await admin.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
