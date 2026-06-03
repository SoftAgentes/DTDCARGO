"use server";

/**
 * Server actions del Hub de Documentos (DMS · SDD-0049 Slice B).
 *
 * Patrón espejo de tracking/[id]/document-actions.ts (0086): valida MIME/tamaño,
 * sube al bucket privado `documents` con el user client (Storage RLS por tenant),
 * indexa la fila (el trigger DB de Slice A valida la entidad) y limpia el object
 * si el insert falla. Generaliza a CUALQUIER entidad (entity_type polimórfico).
 *
 * Seguridad (revisada adversarialmente):
 *  - El `storage_path` se construye SIEMPRE server-side con buildDocumentStoragePath
 *    a partir de get_user_tenant_id() (RPC) — NUNCA se acepta un path del cliente.
 *  - El 1er segmento del path = tenant del caller (Storage RLS lo re-verifica).
 *  - mime/size los acota el bucket, PERO se re-validan acá (defensa en profundidad).
 *  - entity_id pasa por validateDocumentInput() + el trigger DB documents_validate_entity
 *    (rechaza entity inexistente / wrong-type / de otro tenant vía PostgREST directo).
 *  - Las signed URLs se firman server-side con TTL corto (60s).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  DOCUMENTS_BUCKET,
  buildDocumentStoragePath,
  canonicalContentType,
  extFromMime,
  isAllowedDocumentMime,
  validateDocumentInput,
  type DocumentEntityType,
  type DocumentInput,
  type DocumentStatus,
} from "@/lib/studio/documents/types";

export type DocActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Resuelve el tenant del usuario logueado vía la helper SQL (RLS). null si no. */
async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_user_tenant_id");
  if (error || !data) return null;
  return String(data);
}

/** TTL de las signed URLs del hub/panel: corto (60s, solo para abrir en pestaña). */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Sube un documento al bucket + inserta la fila. El path lo arma el servidor
 * (NUNCA el cliente). El form trae: entity_type, entity_id, folder, name,
 * doc_type, status, valid_until y el archivo en `file`.
 */
export async function uploadDocument(
  _prev: DocActionState,
  formData: FormData,
): Promise<DocActionState> {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión expirada. Volvé a entrar." };

  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const raw = formData.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return { fieldErrors: { file: "Elegí un archivo." } };
  }
  // Re-validación de archivo (el bucket ya lo acota; defensa en profundidad).
  if (!isAllowedDocumentMime(raw.type)) {
    return {
      fieldErrors: {
        file: "Formato no permitido (PDF, imagen, xlsx, docx o zip).",
      },
    };
  }

  const entityTypeRaw = (formData.get("entity_type") as string) ?? "none";
  const entityIdRaw = (formData.get("entity_id") as string) || null;

  const validated = validateDocumentInput({
    entityType: entityTypeRaw as DocumentEntityType,
    entityId: entityIdRaw,
    folder: (formData.get("folder") as string) ?? "",
    name: ((formData.get("name") as string) || raw.name || "").trim(),
    contentType: raw.type,
    sizeBytes: raw.size,
    status: ((formData.get("status") as string) || "vigente") as DocumentStatus,
    validUntil: (formData.get("valid_until") as string) || null,
    docType: (formData.get("doc_type") as string) || null,
  });
  if (!validated.ok) {
    return { fieldErrors: validated.errors };
  }
  const input: DocumentInput = validated.value;

  // Path SERVER-SIDE: {tenant}/{entity_type}/{entity_id|none}/{uuid}.{ext}.
  // El uuid y el tenant los pone el servidor; el cliente no puede inyectarlos.
  const ext = extFromMime(raw.type);
  const path = buildDocumentStoragePath({
    tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    uuid: crypto.randomUUID(),
    ext,
  });

  // content_type SERVER-SIDE: derivado de la extensión confiable (canonical),
  // NUNCA el raw.type crudo del cliente. Si a futuro entra un tipo renderizable
  // a la whitelist, el MIME servido sigue siendo el canónico del tipo esperado
  // (mitiga XSS stored inline al servir la signed URL). Preserva el "Ver" inline.
  const contentType = canonicalContentType(raw.type);

  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, raw, { contentType, upsert: false });
  if (upErr) return { error: `No se pudo subir: ${upErr.message}` };

  const { error: insErr } = await supabase.from("documents").insert({
    tenant_id: tenantId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    folder: input.folder,
    doc_type: input.docType,
    name: input.name,
    storage_path: path,
    content_type: contentType,
    size_bytes: raw.size,
    status: input.status,
    valid_until: input.validUntil,
    uploaded_by: userResp.user.id,
  });
  if (insErr) {
    // rollback del object si no se pudo indexar (incluye el rechazo del trigger
    // documents_validate_entity sobre entity_id forjado).
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { error: `No se pudo registrar: ${insErr.message}` };
  }

  revalidateDocuments(input.entityType, input.entityId);
  return { ok: true };
}

/** Soft-delete (deleted_at) + borra el object del bucket (best-effort). */
export async function deleteDocument(id: string): Promise<DocActionState> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, entity_type, entity_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      storage_path: string;
      entity_type: DocumentEntityType;
      entity_id: string | null;
    }>();
  if (!doc?.id) return { error: "Documento no encontrado." };

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // El soft-delete ya lo oculta (RLS + queries filtran deleted_at). Borrar el
  // object es best-effort — NUNCA confiamos en un path del cliente: usamos el de
  // la fila (validado en su día por la Storage RLS al subir).
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);

  revalidateDocuments(doc.entity_type, doc.entity_id);
  return { ok: true };
}

/**
 * Actualiza metadatos editables del documento (carpeta, estado, vencimiento,
 * tipo, nombre). NO toca el storage_path ni el entity_type/entity_id (un cambio
 * de entidad cambiaría el path; no se soporta en V1).
 */
export async function updateDocumentMeta(
  id: string,
  meta: {
    folder?: string;
    status?: DocumentStatus;
    validUntil?: string | null;
    docType?: string | null;
    name?: string;
  },
): Promise<DocActionState> {
  const supabase = await createClient();

  // Leemos la fila para validar contra su entity_type (coherencia del validador).
  const { data: doc } = await supabase
    .from("documents")
    .select("id, entity_type, entity_id, folder, name, status, content_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      entity_type: DocumentEntityType;
      entity_id: string | null;
      folder: string;
      name: string;
      status: DocumentStatus;
      content_type: string | null;
    }>();
  if (!doc?.id) return { error: "Documento no encontrado." };

  const validated = validateDocumentInput({
    entityType: doc.entity_type,
    entityId: doc.entity_id,
    folder: meta.folder ?? doc.folder,
    name: (meta.name ?? doc.name).trim(),
    contentType: doc.content_type,
    sizeBytes: null,
    status: meta.status ?? doc.status,
    validUntil: meta.validUntil === undefined ? null : meta.validUntil,
    docType: meta.docType === undefined ? null : meta.docType,
  });
  if (!validated.ok) {
    return { fieldErrors: validated.errors };
  }
  const v = validated.value;

  const { error } = await supabase
    .from("documents")
    .update({
      folder: v.folder,
      status: v.status,
      valid_until: v.validUntil,
      doc_type: v.docType,
      name: v.name,
    })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidateDocuments(doc.entity_type, doc.entity_id);
  return { ok: true };
}

/**
 * Firma una signed URL (TTL corto) para abrir/descargar un documento. La firma
 * la hace el user client (Storage RLS por tenant) — un cliente de otro tenant no
 * matchea el 1er segmento del path → no puede firmar. Devuelve null si falla.
 */
export async function signDocumentUrl(
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Revalida el hub + el detalle de la entidad adjunta (si tiene módulo). */
function revalidateDocuments(
  entityType: DocumentEntityType,
  entityId: string | null,
): void {
  revalidatePath("/studio/documentos");
  if (entityType === "shipment" && entityId) {
    revalidatePath(`/studio/tracking/${entityId}`);
  }
  // El detalle de cliente se enruta por markbox (no por id) → revalidamos el
  // listado; el panel se refresca con su propia revalidación de ruta al volver.
  if (entityType === "client") {
    revalidatePath("/studio/clientes", "layout");
  }
}
