import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { ATTACHMENT_BUCKET, type AttachmentDocument, type AttachmentReservation, type AttachmentReservationInput } from "./types";
import { validateAttachmentCandidate } from "./policy";
import { isCanonicalAttachmentObjectKey } from "./storage-path";

type RpcRow = {
  intent_id: string;
  document_id: string;
  bucket_id: string;
  object_key: string;
  expires_at: string;
};

function mapReservation(row: RpcRow): AttachmentReservation {
  if (row.bucket_id !== ATTACHMENT_BUCKET || !isCanonicalAttachmentObjectKey(row.object_key)) {
    throw new Error("La reserva devolvió una identidad de objeto no canónica.");
  }
  return {
    intentId: row.intent_id,
    documentId: row.document_id,
    bucketId: ATTACHMENT_BUCKET,
    objectKey: row.object_key,
    expiresAt: row.expires_at,
  };
}

export async function reserveAttachment(
  client: SupabaseClient,
  input: AttachmentReservationInput,
): Promise<AttachmentReservation> {
  const invalid = validateAttachmentCandidate({
    name: input.originalName,
    mime: input.declaredMime,
    size: input.declaredSize,
  });
  if (invalid) throw new Error(invalid);
  const { data, error } = await client.rpc("reserve_document_upload", {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_folder: input.folder,
    p_doc_type: input.docType ?? null,
    p_original_name: input.originalName,
    p_declared_mime: input.declaredMime,
    p_declared_size: input.declaredSize,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  if (!row) throw new Error("Supabase no devolvió la reserva del adjunto.");
  return mapReservation(row);
}

export async function reauthorizeAttachment(
  client: SupabaseClient,
  intentId: string,
): Promise<Pick<AttachmentReservation, "bucketId" | "objectKey" | "expiresAt">> {
  const { data, error } = await client.rpc("reauthorize_document_upload", {
    p_intent_id: intentId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Pick<RpcRow, "bucket_id" | "object_key" | "expires_at"> | undefined;
  if (!row || row.bucket_id !== ATTACHMENT_BUCKET || !isCanonicalAttachmentObjectKey(row.object_key)) {
    throw new Error("Reserva no reautorizable.");
  }
  return { bucketId: ATTACHMENT_BUCKET, objectKey: row.object_key, expiresAt: row.expires_at };
}

export async function createTusAuthorization(objectKey: string): Promise<string> {
  if (!isCanonicalAttachmentObjectKey(objectKey)) throw new Error("Clave de objeto inválida.");
  const { data, error } = await createAdminClient().storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(objectKey, { upsert: false });
  if (error || !data?.token) throw new Error(error?.message ?? "No se pudo firmar la subida.");
  return data.token;
}

export function directTusEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada.");
  const url = new URL(raw);
  if (url.hostname.endsWith(".supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  return url.toString();
}

export async function storedObjectSize(objectKey: string): Promise<number> {
  if (!isCanonicalAttachmentObjectKey(objectKey)) throw new Error("Clave de objeto inválida.");
  const slash = objectKey.lastIndexOf("/");
  const folder = objectKey.slice(0, slash);
  const name = objectKey.slice(slash + 1);
  const { data, error } = await createAdminClient().storage
    .from(ATTACHMENT_BUCKET)
    .list(folder, { search: name, limit: 10 });
  if (error) throw new Error(error.message);
  const exact = data.find((entry) => entry.name === name);
  const size = Number(exact?.metadata?.size);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("El objeto reservado no está completo.");
  return size;
}

export async function finalizeAttachment(client: SupabaseClient, intentId: string, objectKey: string): Promise<string> {
  const actualSize = await storedObjectSize(objectKey);
  const { data, error } = await client.rpc("finalize_document_upload", {
    p_intent_id: intentId,
    p_actual_size: actualSize,
  });
  if (error || typeof data !== "string") throw new Error(error?.message ?? "No se pudo finalizar el adjunto.");
  return data;
}

export async function authorizeAttachmentDownload(client: SupabaseClient, documentId: string): Promise<string> {
  const { data, error } = await client.from("documents")
    .select("id,tenant_id,bucket_id,object_key,original_name,canonical_mime,size_bytes,attachment_status,scan_status,backup_status,deleted_at")
    .eq("id", documentId).maybeSingle<AttachmentDocument>();
  if (error || !data || data.deleted_at || data.scan_status !== "clean") {
    throw new Error("Adjunto no disponible.");
  }
  if (data.bucket_id !== ATTACHMENT_BUCKET || !isCanonicalAttachmentObjectKey(data.object_key)) {
    throw new Error("Identidad de adjunto inválida.");
  }
  const signed = await createAdminClient().storage.from(data.bucket_id).createSignedUrl(data.object_key, 60, {
    download: data.original_name ?? "adjunto",
  });
  if (signed.error || !signed.data?.signedUrl) throw new Error("No se pudo firmar la descarga.");
  return signed.data.signedUrl;
}

