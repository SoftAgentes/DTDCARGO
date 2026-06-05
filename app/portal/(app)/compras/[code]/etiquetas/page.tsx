import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  getPrealertaByCode,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";
import { buildLabels } from "@/lib/studio/prealertas/types";
import { LabelsClient } from "./LabelsClient";

export const metadata: Metadata = { title: "Etiquetas" };

/**
 * Etiquetas imprimibles de una compra (SDD-0057 · Slice B · V1 básico). Por cada
 * caja: "SHIPPING TO DTD-CARGO" + el código de la compra + "Caja M/N" + nombre
 * del cliente. Botón "Descargar / Imprimir" (window.print con CSS print).
 *
 * El nº de caja NO es un 5º segmento del código (regla del Norte): la lista de
 * etiquetas comparte el MISMO `code` y varía sólo "Caja M/N".
 *
 * TODO (Slice futuro · Norte LabelGenerator paso "docs"): adjuntar packing
 * list / factura / fotos de la compra antes de generar — diferido en V1.
 */
export default async function PortalLabelsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
  });
  if (!prealerta) notFound();

  const suppliers = await listSuppliers(supabase, { markbox: client.markbox });
  const supplierName = prealerta.supplier_id
    ? (suppliers.find((s) => s.id === prealerta.supplier_id)?.name ?? null)
    : null;

  const labels = buildLabels(prealerta.code, prealerta.boxes);

  return (
    <LabelsClient
      code={prealerta.code}
      clientName={client.name}
      supplierName={supplierName}
      description={prealerta.description}
      labels={labels}
    />
  );
}
