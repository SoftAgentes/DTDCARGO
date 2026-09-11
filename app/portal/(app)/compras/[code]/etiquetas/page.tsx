import { getLabelPresentation } from "@/lib/studio/label-presentation-queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { resolveBrandForClient } from "@/lib/studio/aliados/brand-resolve";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  getPrealertaByCode,
  listPrealertaDocuments,
  listPredeclaredBoxes,
  listSuppliers,
  listActivePrealertaAddons,
  listPrealertaServiceRequests,
} from "@/lib/studio/prealertas/queries";
import { PrealertaServiceSection } from "./ServiceSection";
import {
  buildLabels,
  buildLabelsFromBoxes,
  PREALERTA_DOC_BUCKET,
  PREALERTA_DOC_TYPE_LABEL,
} from "@/lib/studio/prealertas/types";
import { DocIcon } from "@/components/Icon";
import { LabelsClient } from "./LabelsClient";
import { ShareProviderButton } from "../../../../_components/ShareProviderButton";

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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  const { client, tenantId } = principal;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
  });
  if (!prealerta) notFound();

  const suppliers = await listSuppliers(supabase, { markbox: client.markbox });

  // SDD-0255 · la marca con la que se pinta la etiqueta. ⚠️ Va con el ADMIN
  // client a propósito: la política de `aliados` es `tenant_id =
  // get_user_tenant_id()` y un usuario del portal no tiene fila en
  // `user_tenants`, así que con su sesión esto devolvería DTD siempre, en
  // silencio.
  const brand = await resolveBrandForClient(createAdminClient(), {
    markbox: client.markbox,
  });
  const presentation = await getLabelPresentation(createAdminClient(), prealerta.tenant_id);
  const supplier = prealerta.supplier_id
    ? (suppliers.find((s) => s.id === prealerta.supplier_id) ?? null)
    : null;
  const supplierName = supplier?.name ?? null;
  const supplierWechat = supplier?.wechat ?? null;

  // SDD-0153: si la compra ya tiene cajas pre-declaradas, la etiqueta lleva el
  // código único escaneable de cada caja. Si no (compra vieja, o conteo que no
  // cuadra), cae a la etiqueta por cliente. La RLS del portal solo devuelve las
  // cajas del propio cliente.
  const predeclaredBoxes = await listPredeclaredBoxes(supabase, prealerta.id);
  const labels =
    predeclaredBoxes.length > 0
      ? buildLabelsFromBoxes(prealerta.code, predeclaredBoxes)
      : buildLabels(prealerta.code, prealerta.boxes);

  // Servicios de recepción (SDD-0098): menú activo + lo que el cliente ya pidió.
  const [addons, serviceRequests] = await Promise.all([
    listActivePrealertaAddons(supabase, { tenantId }),
    listPrealertaServiceRequests(supabase, {
      prealertaId: prealerta.id,
      markbox: client.markbox,
    }),
  ]);
  const prealertaReceived =
    prealerta.received_at != null ||
    prealerta.status === "recibida" ||
    prealerta.status === "consolidada";

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
        brand={brand}
        presentation={presentation.settings}
        code={prealerta.code}
        markbox={client.markbox}
        clientName={client.name}
        supplierName={supplierName}
        description={prealerta.description}
        labels={labels}
      />

      {prealerta.share_token && (
        <div className="mt-8 print:hidden card-shadow bg-white border border-grey-200 rounded-[16px] p-6">
          <div className="text-[15px] font-bold text-ink">
            Compartir con tu proveedor
          </div>
          <p className="mt-1.5 text-[13px] text-grey-700 leading-[1.5] max-w-[60ch]">
            Mándale este link a tu proveedor: trae la dirección de la bodega y
            estas etiquetas para que las baje él directo, sin que tengas que
            descargar ni reenviar nada.
          </p>
          <div className="mt-4">
            <ShareProviderButton token={prealerta.share_token} />
          </div>
        </div>
      )}

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
                      className="flex-shrink-0 text-[12.5px] font-bold text-wine-text hover:underline"
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

      <PrealertaServiceSection
        prealertaCode={prealerta.code}
        prealertaReceived={prealertaReceived}
        requests={serviceRequests}
        addons={addons}
      />
    </>
  );
}
