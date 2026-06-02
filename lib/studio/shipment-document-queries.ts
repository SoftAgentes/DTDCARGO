/**
 * Queries del módulo Documentos del envío (SDD-0042 Fase 3b). Funciones puras
 * que reciben un `SupabaseClient`.
 *
 * La firma de URLs (`signDocumentUrls`) usa un client con permisos de storage
 * (admin/service o un user del tenant). El ownership SIEMPRE se garantiza antes
 * a nivel de tabla (RLS por tenant o por markbox) — acá sólo firmamos paths ya
 * autorizados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SHIPMENT_DOCS_BUCKET,
  type ShipmentDocument,
} from "./shipment-document-types";

const DOC_COLUMNS =
  "id, shipment_id, doc_type, storage_path, file_name, content_type, size_bytes, created_at";

/**
 * Documentos de un envío, recientes primero. La RLS decide visibilidad:
 *  - equipo → "shipment_documents by tenant"
 *  - cliente del portal → "shipment_documents portal self read" (por markbox).
 * No agrega filtro de cliente/tenant: confía en la RLS (igual que el resto del
 * portal, que además ya viene de un shipment resuelto por markbox).
 */
export async function listShipmentDocuments(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<ShipmentDocument[]> {
  const { data, error } = await supabase
    .from("shipment_documents")
    .select(DOC_COLUMNS)
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as ShipmentDocument[];
}

/**
 * Genera signed URLs (TTL 1h por default) para una lista de storage paths.
 * Devuelve un map { storage_path: signed_url }. Pensado para uso server-side.
 * El `supabase` debe poder leer del bucket (admin client en el portal; user del
 * tenant en el Studio — ambos funcionan).
 */
export async function signDocumentUrls(
  supabase: SupabaseClient,
  paths: string[],
  ttlSeconds = 60 * 60,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(SHIPMENT_DOCS_BUCKET)
    .createSignedUrls(unique, ttlSeconds);

  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
