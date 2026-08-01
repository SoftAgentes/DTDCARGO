export const ATTACHMENT_BUCKET = "erp-attachments" as const;
export const ATTACHMENT_TUS_CHUNK_BYTES = 6 * 1024 * 1024;

export type AttachmentStatus =
  | "reservado"
  | "subiendo"
  | "guardado"
  | "verificando"
  | "cuarentena"
  | "disponible"
  | "protegido"
  | "fallido"
  | "eliminado";

export type AttachmentMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

export interface AttachmentReservationInput {
  entityType: "expense";
  entityId: string;
  folder: "receipt";
  docType?: string;
  originalName: string;
  declaredMime: AttachmentMime;
  declaredSize: number;
  idempotencyKey: string;
}

export interface AttachmentReservation {
  intentId: string;
  documentId: string;
  bucketId: typeof ATTACHMENT_BUCKET;
  objectKey: string;
  expiresAt: string;
}

export interface AttachmentUploadAuthorization extends AttachmentReservation {
  endpoint: string;
  signature: string;
}

export interface AttachmentDocument {
  id: string;
  tenant_id: string;
  bucket_id: string;
  object_key: string;
  original_name: string | null;
  canonical_mime: string | null;
  size_bytes: number | null;
  attachment_status: AttachmentStatus;
  scan_status: "legacy" | "pending" | "clean" | "infected" | "failed";
  backup_status: "not_required" | "pending" | "running" | "verified" | "failed";
  deleted_at: string | null;
}

