/**
 * SDD-0298 · El documento fiscal del CLIENTE en la factura.
 *
 * ## Por qué se congela y no se lee en vivo
 *
 * `invoices` ya denormaliza `client_name` y `client_markbox`, y no por
 * descuido: una factura emitida es un **comprobante**, y un comprobante que se
 * reescribe solo deja de serlo. Si el RIF se leyera en vivo de `clients`,
 * corregir el documento de un cliente cambiaría en retroactivo el papel de
 * todas sus facturas viejas — incluidas las que ya se entregaron.
 *
 * Por eso el documento se copia acá y se sella **al emitir**, que es cuando la
 * factura deja de ser borrador y pasa a ser comprobante. Un borrador todavía se
 * edita; no tiene sentido congelarle nada.
 *
 * ## Por qué dos campos y no uno
 *
 * `clients.doc_kind` distingue `empresa` (RIF) de `persona` (cédula). Sin él el
 * papel no sabe qué etiqueta poner delante del número, y **poner "RIF" sobre
 * una cédula es un error fiscal, no de estilo**.
 *
 * ## Lo que NO hace: inventar
 *
 * 146 de 490 clientes vivos no tienen documento cargado (medido 2026-08-25).
 * Para ellos esto devuelve `null` y el PDF no imprime la línea. Una factura con
 * un identificador equivocado es peor que una sin él.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientDocKind } from "@/lib/studio/client-types";

/** Lo que se copia a `invoices` al emitir. */
export type DocumentoCongelado = {
  client_rif: string | null;
  client_doc_kind: string | null;
};

export const SIN_DOCUMENTO: DocumentoCongelado = {
  client_rif: null,
  client_doc_kind: null,
};

/**
 * La etiqueta que va delante del número en el papel.
 *
 * Consolida el `isCompany ? "RIF" : "Cédula"` que estaba suelto en la pantalla
 * de clientes y en el export. `docKindLabel` NO sirve acá: devuelve el tipo
 * ("Empresa" / "Persona"), no el nombre del documento.
 */
export function etiquetaDocumento(kind: string | null | undefined): string {
  if (kind === "empresa") return "RIF";
  if (kind === "persona") return "Cédula";
  return "Documento";
}

/**
 * El renglón del documento del cliente, o `null` si no hay qué imprimir.
 *
 * Sin número no hay línea, aunque venga el tipo: "RIF" solo no identifica a
 * nadie.
 */
export function lineaDocumentoCliente(
  rif: string | null | undefined,
  kind: string | null | undefined,
): string | null {
  const numero = (rif ?? "").trim();
  if (!numero) return null;
  return `${etiquetaDocumento(kind)}: ${numero}`;
}

/**
 * Lee de `clients` el documento a congelar. Best-effort: si el cliente no
 * existe o no tiene documento, la factura se emite igual sin él.
 *
 * Se busca por `markbox` porque es lo que la factura guarda — y es único por
 * tenant (RLS acota la consulta al tenant del usuario).
 */
export async function documentoDelCliente(
  supabase: SupabaseClient,
  markbox: string | null | undefined,
): Promise<DocumentoCongelado> {
  const mb = (markbox ?? "").trim();
  if (!mb) return SIN_DOCUMENTO;

  const { data } = await supabase
    .from("clients")
    .select("rif, doc_kind")
    .eq("markbox", mb)
    .is("deleted_at", null)
    .maybeSingle<{ rif: string | null; doc_kind: ClientDocKind | null }>();

  const rif = (data?.rif ?? "").trim();
  if (!rif) return SIN_DOCUMENTO;
  return { client_rif: rif, client_doc_kind: data?.doc_kind ?? null };
}
