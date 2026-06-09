import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  getPrealertaByCode,
  listPrealertaDocuments,
  listSuppliers,
} from "@/lib/studio/prealertas/queries";
import {
  buildLabels,
  PREALERTA_DOC_BUCKET,
  PREALERTA_DOC_TYPE_LABEL,
} from "@/lib/studio/prealertas/types";
import { DocIcon } from "@/components/Icon";
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
  const supplier = prealerta.supplier_id
    ? (suppliers.find((s) => s.id === prealerta.supplier_id) ?? null)
    : null;
  const supplierName = supplier?.name ?? null;
  const supplierWechat = supplier?.wechat ?? null;

  const labels = buildLabels(prealerta.code, prealerta.boxes);

  // Adjuntos que el cliente subió a esta compra (read-only · recordatorio). Las
  // signed URLs se generan server-side con admin (el cliente no firma vía Storage).
  const docs = await listPrealertaDocuments(supabase, {
    prealertaId: prealerta.id,
    markbox: client.markbox,
  });
  let signedDocs: {
    id: string;
    label: string;
    fileName: string;
    url: string | null;
  }[] = [];
  if (docs.length > 0) {
    try {
      const admin = createAdminClient();
      signedDocs = await Promise.all(
        docs.map(async (d) => {
          const { data } = await admin.storage
            .from(PREALERTA_DOC_BUCKET)
            .createSignedUrl(d.storage_path, 120);
          return {
            id: d.id,
            label: PREALERTA_DOC_TYPE_LABEL[d.doc_type],
            fileName: d.file_name,
            url: data?.signedUrl ?? null,
          };
        }),
      );
    } catch {
      signedDocs = docs.map((d) => ({
        id: d.id,
        label: PREALERTA_DOC_TYPE_LABEL[d.doc_type],
        fileName: d.file_name,
        url: null,
      }));
    }
  }

  return (
    <>
      <LabelsClient
        code={prealerta.code}
        clientName={client.name}
        supplierName={supplierName}
        description={prealerta.description}
        labels={labels}
      />

      {(signedDocs.length > 0 || supplierWechat) && (
        <div className="mt-10 print:hidden">
          <div className="text-[15px] font-bold text-ink">
            Lo que adjuntaste a esta compra
          </div>
          {supplierWechat && (
            <div className="mt-3 text-[13px] text-grey-700">
              WeChat / WhatsApp del proveedor:{" "}
              <span
                className="font-bold text-ink"
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                }}
              >
                {supplierWechat}
              </span>
            </div>
          )}
          {signedDocs.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {signedDocs.map((d) => (
                <li
                  key={d.id}
                  className="bg-white border border-grey-200 rounded-[12px] px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-grey-500 flex-shrink-0">
                    <DocIcon size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-ink">
                      {d.label}
                    </span>
                    <span className="block text-[12px] text-grey-500 truncate">
                      {d.fileName}
                    </span>
                  </span>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-[12.5px] font-bold text-wine hover:underline"
                    >
                      Ver
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
