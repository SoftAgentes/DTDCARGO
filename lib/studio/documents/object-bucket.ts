/**
 * Bucket del objeto de una fila de `documents` (SDD-0508).
 *
 * La fila guarda en `bucket_id` dónde vive su binario (columna de 0307, default
 * `'documents'`). El hub sube al bucket `documents`; la «Prueba de avance» de
 * Bitácora, al bucket `bitacora`. El tipo de entidad no lo decide: el hub
 * también acepta un `bitacora_task` y lo guarda en `documents`. Quien firme o
 * borre el objeto de una fila resuelve el bucket con esta función, nunca con una
 * constante.
 *
 * Solo devuelve los buckets cuyo objeto maneja el user client del Studio.
 * `erp-attachments` (SDD-0224) queda fuera a propósito: su descarga pasa por
 * `authorizeAttachmentDownload`, que exige `scan_status = 'clean'`, y su ciclo
 * de vida es de ese servicio. Cualquier otro valor → null: no se firma ni se
 * borra nada.
 *
 * Módulo puro (sin server-only ni supabase), como `lib/studio/bitacora/storage`.
 */
import { DOCUMENTS_BUCKET } from "./types";
import {
  BITACORA_BUCKET,
  isValidTaskAttachmentPath,
} from "@/lib/studio/bitacora/storage";

export type DocumentObjectBucket =
  | typeof DOCUMENTS_BUCKET
  | typeof BITACORA_BUCKET;

/** Lo mínimo de la fila que hace falta para ubicar su objeto. */
export type DocumentObjectRow = {
  bucket_id: string | null | undefined;
  tenant_id: string;
  entity_type: string;
  entity_id: string | null;
  storage_path: string;
};

export function documentObjectBucket(
  row: DocumentObjectRow,
): DocumentObjectBucket | null {
  if (row.bucket_id === DOCUMENTS_BUCKET) return DOCUMENTS_BUCKET;
  if (row.bucket_id === BITACORA_BUCKET) {
    // El bucket `bitacora` también guarda los audios de las actas
    // ({tenant}/bitacora_meeting/…). Una fila solo alcanza un objeto de la
    // carpeta de su propia tarea, en su propio tenant.
    if (row.entity_type !== "bitacora_task" || !row.entity_id) return null;
    return isValidTaskAttachmentPath(
      row.storage_path,
      row.tenant_id,
      row.entity_id,
    )
      ? BITACORA_BUCKET
      : null;
  }
  return null;
}
