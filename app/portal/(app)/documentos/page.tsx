import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { listMyDocuments } from "@/lib/portal/portal-queries";
import { signDocumentUrls } from "@/lib/studio/shipment-document-queries";
import {
  shipmentDocTypeLabel,
  shipmentDocTypeShort,
  formatDocSize,
} from "@/lib/studio/shipment-document-types";
import { buildWhatsAppLink } from "@/lib/design-tokens";
import { ArrowIcon } from "@/components/Icon";
import { EnviosHubTabs } from "../../_components/PortalHubTabs";

export const metadata: Metadata = { title: "Documentos" };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Sección GLOBAL "Documentos" del portal (SDD-0042 Fase 3b · Norte). Lista TODOS
 * los documentos del cliente cruzando envíos (BL · POD · otros), cada uno con el
 * código del envío y descarga vía signed URL (firmada server-side con admin
 * client, ownership ya garantizado por la RLS por markbox). Espeja
 * `PortalDocuments` de `portal/app.jsx` del Norte.
 */
export default async function PortalDocumentsPage() {
  const supabase = await createClient();
  const docs = await listMyDocuments(supabase);
  const urls = docs.length
    ? await signDocumentUrls(
        createAdminClient(),
        docs.map((d) => d.storagePath),
      )
    : {};
  const waLink = buildWhatsAppLink(
    "Hola DTD Cargo, soy cliente y necesito un documento de mis envíos.",
  );

  return (
    <div>
      <EnviosHubTabs />
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Documentos.
      </h1>
      <p className="lead mt-3">
        BL · Packing List · Facturas comerciales · POD. Los carga nuestro equipo y
        quedan disponibles 7 años en archivo.
      </p>

      {docs.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no hay documentos.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[48ch] mx-auto leading-[1.55]">
            A medida que tus envíos avanzan, tu asesor sube acá el BL, el
            comprobante de entrega y otros documentos.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-6 inline-flex"
          >
            Escribir a mi asesor <ArrowIcon />
          </a>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => {
            const url = urls[doc.storagePath];
            const meta = [formatDocSize(doc.sizeBytes), formatDate(doc.createdAt)]
              .filter(Boolean)
              .join(" · ");

            const body = (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-bold tracking-wide text-wine bg-paper border border-grey-200 rounded-md px-2 py-1 flex-shrink-0"
                    style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                  >
                    {shipmentDocTypeShort(doc.docType)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink truncate">
                      {shipmentDocTypeLabel(doc.docType)}
                    </div>
                    {doc.shipmentCode && (
                      <div
                        className="text-[12px] text-grey-500 truncate"
                        style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                      >
                        Envío {doc.shipmentCode}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-grey-200 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-grey-500">{meta}</span>
                  {url ? (
                    <span className="text-[12.5px] font-semibold text-wine inline-flex items-center gap-1">
                      Descargar{" "}
                      <ArrowIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  ) : (
                    <span className="text-[12px] text-grey-500">No se pudo abrir</span>
                  )}
                </div>
              </>
            );

            return (
              <div key={doc.id}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-link group block bg-white border border-grey-200 rounded-[16px] p-5 transition-colors hover:border-ink focus-visible:border-ink"
                    aria-label={`Descargar ${shipmentDocTypeLabel(doc.docType)} del envío ${doc.shipmentCode ?? ""}`}
                  >
                    {body}
                  </a>
                ) : (
                  <div className="bg-white border border-grey-200 rounded-[16px] p-5 opacity-70">
                    {body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
