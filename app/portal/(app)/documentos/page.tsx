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
import { getProfileCompleteness } from "@/lib/portal/portal-queries";
import { isModuleLocked } from "@/lib/portal/verify-gate";
import type { PortalDocView } from "@/lib/portal/documentos-filter";
import { EnviosHubTabs } from "../../_components/PortalHubTabs";
import { PortalVerifyGate } from "../_components/PortalVerifyGate";
import { DocumentsClient } from "./DocumentsClient";

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

  // Gate de verificación (SDD-0169): cerrado hasta completar el registro. Se
  // resuelve ANTES de leer documentos — un módulo cerrado no consulta ni firma
  // URLs de nada.
  const profile = await getProfileCompleteness(supabase).catch(() => null);
  if (profile && isModuleLocked("documentos", profile)) {
    return <PortalVerifyGate module="documentos" profile={profile} />;
  }

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

  // Se aplanan acá (etiquetas, meta y signed URL ya resueltas) para que el
  // componente cliente no arrastre tipos de `lib/studio` ni vuelva a derivar
  // nada: solo filtra y pinta.
  const rows: PortalDocView[] = docs.map((doc) => ({
    id: doc.id,
    docType: doc.docType,
    typeLabel: shipmentDocTypeLabel(doc.docType),
    typeShort: shipmentDocTypeShort(doc.docType),
    shipmentCode: doc.shipmentCode ?? null,
    meta: [formatDocSize(doc.sizeBytes), formatDate(doc.createdAt)]
      .filter(Boolean)
      .join(" · "),
    url: urls[doc.storagePath] ?? null,
  }));

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
        <DocumentsClient docs={rows} />
      )}
    </div>
  );
}
