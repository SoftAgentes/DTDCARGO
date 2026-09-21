"use server";

/**
 * Server actions de Documentos del envío (SDD-0042 Fase 3b).
 *
 * Subida/borrado de documentos (BL/POD/otros) que el equipo adjunta a un envío
 * y el cliente ve read-only en el portal. Patrón espejo de gastos
 * (app/studio/(app)/gastos/actions.ts): valida MIME/tamaño, sube al bucket
 * `shipment-docs` con el user client (storage RLS por tenant), indexa la fila y
 * limpia el object si el insert falla.
 *
 * Gate: `moduleEditGate(supabase, "tracking")` al tope de las dos mutaciones
 * (SDD-0500). Es el espejo exacto de la RLS que la migr 0439 puso sobre
 * `shipment_documents` y sobre el bucket: `document_entity_authorized('shipment',
 * …, 'edit')` exige `role <> 'support'` y la misma fila de la matriz. Hasta la
 * 0500 no había gate de aplicación ninguno — el borrado ni siquiera resolvía el
 * tenant, y saca el objeto del bucket, que no vuelve.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditGate } from "@/lib/studio/rbac-guard";
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
  // El gate resuelve sesión, rol y tenant de la MISMA fila (SDD-0498). Antes
  // acá había una relectura de `user_tenants` sin `user_id` ni `disabled_at`:
  // le prestaba el tenant del primer miembro que hubiera y dejaba subir a un
  // usuario suspendido.
  const gate = await moduleEditGate(supabase, "tracking");
  if (!gate.ok) return { error: gate.denied };

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
  const path = `${gate.tenantId}/${shipmentId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(SHIPMENT_DOCS_BUCKET)
    .upload(path, raw, { contentType: raw.type, upsert: false });
  if (upErr) return { error: `No se pudo subir: ${upErr.message}` };

  const { error: insErr } = await supabase.from("shipment_documents").insert({
    tenant_id: gate.tenantId,
    shipment_id: shipmentId,
    client_markbox: shipment.client_markbox,
    doc_type: docType,
    storage_path: path,
    file_name: raw.name.slice(0, 200),
    content_type: raw.type,
    size_bytes: raw.size,
    uploaded_by: gate.userId,
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
  // El gate va ANTES de leer el documento: esta action no resolvía ni la
  // sesión, así que el `remove()` del bucket —que no es borrado lógico— era lo
  // primero que la aplicación no comprobaba.
  const gate = await moduleEditGate(supabase, "tracking");
  if (!gate.ok) return { error: gate.denied };

  const { data: doc } = await supabase
    .from("shipment_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .eq("tenant_id", gate.tenantId)
    .maybeSingle<{ id: string; storage_path: string }>();
  if (!doc?.id) return { error: "Documento no encontrado." };

  const { error } = await supabase
    .from("shipment_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", docId)
    .eq("tenant_id", gate.tenantId);
  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  // Best-effort: borrar el object del bucket (el soft-delete ya lo oculta).
  await supabase.storage.from(SHIPMENT_DOCS_BUCKET).remove([doc.storage_path]);

  revalidatePath(`/studio/tracking/${shipmentId}`);
  return { ok: true };
}
