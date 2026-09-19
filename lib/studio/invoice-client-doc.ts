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
 * Por eso el documento se sella **al emitir**, que es cuando la factura deja de
 * ser borrador y pasa a ser comprobante. Un borrador todavía se edita; no tiene
 * sentido congelarle nada.
 *
 * SDD-0487: el sello pasó a la base (trigger `invoices_seal_billing_titular`,
 * migración 0466). Cubre todos los caminos de emisión —antes la RPC 0128 emitía
 * sin sello— y sella el titular que eligió el cliente o el operador: nombre,
 * documento, tipo y domicilio fiscal. Este módulo quedó con lo que imprime.
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
 * Domicilio fiscal SELLADO en la factura (SDD-0487). Se lee aparte y tolerante:
 * sin la migración 0466 la columna no existe y el PDF sale igual que antes, sin
 * la línea. Lo sellado no se recalcula nunca desde el cliente.
 */
export async function domicilioFiscalSellado(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("client_fiscal_address")
      .eq("id", invoiceId)
      .maybeSingle<{ client_fiscal_address: string | null }>();
    if (error) return null;
    return (data?.client_fiscal_address ?? "").trim() || null;
  } catch {
    return null;
  }
}
