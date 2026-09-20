import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import { getPrealertaByCode } from "@/lib/studio/prealertas/queries";
import { portalEnabled } from "@/lib/studio/document-import/access";
import { DocumentReviewClient } from "./DocumentReviewClient";

export const metadata: Metadata = { title: "Documento de la compra" };

/**
 * SDD-0473 · Revisión del Packing List + Factura de una compra.
 *
 * El cliente llega acá después de cargar sus documentos: revisa lo que se extrajo,
 * corrige lo que haga falta y comparte el enlace con su proveedor. Lo que guarda
 * es un borrador — quien confirma el despacho es el proveedor, desde su enlace.
 *
 * La resolución de la compra sigue el patrón del resto del portal: principal de la
 * sesión, búsqueda por `markbox` del cliente y comprobación explícita de tenant.
 * El workspace se abre desde el cliente, que es quien tiene el token de sesión.
 */
export default async function PortalDocumentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Documento de compra: exige el interruptor del portal, no sólo el del
  // cotizador. Sin él esta pantalla no existe (y la API tampoco la atendería).
  if (!portalEnabled()) notFound();
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);

  const supabase = await createClient();
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client, tenantId } = principal;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
  });
  // El chequeo de tenant es explícito aunque la consulta ya filtre por markbox:
  // son dos vallas distintas y la de arriba depende de datos del cliente.
  if (!prealerta || prealerta.tenant_id !== tenantId) notFound();

  return (
    <DocumentReviewClient code={code} shareToken={prealerta.share_token ?? null} />
  );
}
