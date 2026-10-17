"use server";

/**
 * «Ver» de la sección «Todos los adjuntos» de la ficha del cliente (SDD-0507).
 *
 * No reutiliza `signDocumentUrl` (documentos/actions.ts): el contrato de RBAC
 * por acción la tiene en `DEUDA` porque firma cualquier ruta del bucket sin
 * candado, y sumarle un consumidor agranda esa deuda. Ésta:
 *
 *  1. pide la vista del módulo `clients` antes de tocar nada (la sección vive
 *     en la ficha del cliente);
 *  2. acepta sólo los dos buckets de los que sale la sección y sólo las formas
 *     de ruta que arman las subidas de hoy (`moduloDeRutaAdjunto`);
 *  3. si la ruta es de un embarque, pide además la vista de `tracking`, que es
 *     el módulo que la RLS de esos documentos exige
 *     (`document_entity_authorized('shipment', …, 'view')`, migr 0439/0444);
 *  4. firma con el cliente de sesión y TTL de 60 s: la RLS de Storage decide
 *     por tenant y por entidad. Ningún cliente admin.
 *
 * Devuelve la URL o `null`. No registra la ruta ni el nombre del archivo.
 */

import { createClient } from "@/lib/db/server";
import { moduleViewDenial } from "@/lib/studio/rbac-guard";
import { moduloDeRutaAdjunto } from "@/lib/studio/documents/adjuntos";

/** Igual que el panel del hub: corto, sólo para abrir en una pestaña. */
const TTL_SEGUNDOS = 60;

export async function firmarAdjuntoAction(
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const denegado = await moduleViewDenial(supabase, "clients");
  if (denegado) return null;

  const modulo = moduloDeRutaAdjunto(String(bucket), String(storagePath));
  if (modulo === null) return null;
  if (modulo === "tracking" && (await moduleViewDenial(supabase, "tracking"))) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, TTL_SEGUNDOS);
  if (error || !data) return null;
  return data.signedUrl;
}
