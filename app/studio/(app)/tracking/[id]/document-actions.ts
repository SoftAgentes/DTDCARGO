"use server";

/**
 * Server actions de Documentos del envío (SDD-0042 Fase 3b).
 *
 * Subida/borrado de documentos (BL/POD/otros) que el equipo adjunta a un envío
 * y el cliente ve read-only en el portal. Patrón espejo de gastos
 * (app/studio/(app)/gastos/actions.ts): valida MIME/tamaño, sube al bucket
 * `shipment-docs` con el user client (storage RLS por tenant), indexa la fila y
 * limpia el object si el insert falla.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  SHIPMENT_DOCS_BUCKET,
  SHIPMENT_DOC_MAX_BYTES,
  extFromDocMime,
  isAllowedDocMime,
  parseDocType,
} from "@/lib/studio/shipment-document-types";

export type DocActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: { file?: string };
};

export async function uploadShipmentDocumentAction(
  shipmentId: string,
  _prev: DocActionState,
  formData: FormData,
): Promise<DocActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión expirada. Vuelve a entrar." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // El envío debe ser del tenant (RLS) → traemos el markbox para denormalizar
  // en la fila (lo usa la RLS del portal).
  const { data: shipment } = await supabase
    .from("shipments")
    .select("id, client_markbox")
    .eq("id", shipmentId)
    .maybeSingle<{ id: string; client_markbox: string | null }>();
  if (!shipment?.id) return { error: "Envío no encontrado." };

  const docType = parseDocType(formData.get("doc_type"));

  const raw = formData.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return { fieldErrors: { file: "Elige un archivo." } };
  }
  if (!isAllowedDocMime(raw.type)) {
    return { fieldErrors: { file: "Formato inválido (PDF, JPG, PNG o WebP)." } };
  }
  if (raw.size > SHIPMENT_DOC_MAX_BYTES) {
    return { fieldErrors: { file: "Archivo muy pesado (máx 10 MB)." } };
  }

  const ext = extFromDocMime(raw.type);
  const path = `${link.tenant_id}/${shipmentId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(SHIPMENT_DOCS_BUCKET)
    .upload(path, raw, { contentType: raw.type, upsert: false });
  if (upErr) return { error: `No se pudo subir: ${upErr.message}` };

  const { error: insErr } = await supabase.from("shipment_documents").insert({
    tenant_id: link.tenant_id,
    shipment_id: shipmentId,
    client_markbox: shipment.client_markbox,
    doc_type: docType,
    storage_path: path,
    file_name: raw.name.slice(0, 200),
    content_type: raw.type,
    size_bytes: raw.size,
    uploaded_by: userResp.user.id,
  });
  if (insErr) {
    // rollback del object si no se pudo indexar
    await supabase.storage.from(SHIPMENT_DOCS_BUCKET).remove([path]);
    return { error: `No se pudo registrar: ${insErr.message}` };
  }

  revalidatePath(`/studio/tracking/${shipmentId}`);
  return { ok: true };
}

export async function deleteShipmentDocumentAction(
  shipmentId: string,
  docId: string,
): Promise<DocActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };

  const { data: doc } = await supabase
    .from("shipment_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .maybeSingle<{ id: string; storage_path: string }>();
  if (!doc?.id) return { error: "Documento no encontrado." };

  const { error } = await supabase
    .from("shipment_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // Best-effort: borrar el object del bucket (el soft-delete ya lo oculta).
  await supabase.storage.from(SHIPMENT_DOCS_BUCKET).remove([doc.storage_path]);

  revalidatePath(`/studio/tracking/${shipmentId}`);
  return { ok: true };
}
