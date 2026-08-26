import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { listMyDocuments, getPortalClient } from "@/lib/portal/portal-queries";
import { listarPackingListsComoDocumentos } from "@/lib/portal/packing-list-queries";
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

  const client = await getPortalClient(supabase);

  // SDD-0308 · dos fuentes, no una. `shipment_documents` son los archivos que
  // sube el equipo; los packing lists los llena el proveedor y no son archivos.
  // La bajada de esta pantalla prometía los dos desde el principio.
  const [docs, packingLists] = await Promise.all([
    listMyDocuments(supabase),
    client
      ? listarPackingListsComoDocumentos(createAdminClient(), client.markbox)
      : Promise.resolve([]),
  ]);

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
  const deEnvios = docs.map((doc) => ({
    orden: doc.createdAt,
    view: {
      id: doc.id,
      docType: doc.docType,
      typeLabel: shipmentDocTypeLabel(doc.docType),
      typeShort: shipmentDocTypeShort(doc.docType),
      shipmentCode: doc.shipmentCode ?? null,
      meta: [formatDocSize(doc.sizeBytes), formatDate(doc.createdAt)]
        .filter(Boolean)
        .join(" · "),
      url: urls[doc.storagePath] ?? null,
    } satisfies PortalDocView,
  }));

  // Los packing lists entran con `docType: "packing"` para caer bajo el chip de
  // tipo que ya existe. No traen tamaño —no son archivos—, así que su meta lleva
  // lo que el cliente sí reconoce: el folio y las cajas.
  const dePackingLists = packingLists.map((p) => ({
    orden: p.enviadoEl,
    view: {
      // Prefijo para no colisionar con un id de `shipment_documents`: son dos
      // tablas distintas y sus uuid no comparten espacio.
      id: `pl:${p.id}`,
      // Etiquetas propias, NO `shipmentDocTypeLabel`: el enum de documentos de
      // envío es `"bl" | "pod" | "otro"` y **no tiene `packing`** — pasarle ese
      // valor devolvería el genérico "Documento". Que la bajada prometiera
      // "Packing List" era, literalmente, prometer un tipo que el modelo de
      // datos de esa tabla no contempla. El packing list vive en otra tabla.
      docType: "packing",
      typeLabel: "Packing list",
      typeShort: "PL",
      shipmentCode: null,
      purchaseCode: p.purchaseCode,
      meta: [
        p.folio,
        p.cajas > 0 ? `${p.cajas} ${p.cajas === 1 ? "caja" : "cajas"}` : null,
        formatDate(p.enviadoEl),
      ]
        .filter(Boolean)
        .join(" · "),
      url: `/portal/compras/${encodeURIComponent(p.purchaseCode)}`,
      kind: "abrir" as const,
    } satisfies PortalDocView,
  }));

  // Una sola lista, más reciente primero. Cada fuente ya viene ordenada, pero
  // concatenarlas dejaría dos bloques: los documentos de envío y después los
  // packing lists, sin importar cuál llegó antes. Se ordena por el ISO crudo —
  // `meta` ya está formateado a "26 ago 2026" y no es comparable.
  const rows: PortalDocView[] = [...deEnvios, ...dePackingLists]
    .sort((a, b) => b.orden.localeCompare(a.orden))
    .map((r) => r.view);

  return (
    <div>
      <EnviosHubTabs />
      <span className="eyebrow">Tu cuenta</span>
      <h1 className="h-display mt-3" style={{ fontSize: "clamp(30px, 4.5vw, 48px)" }}>
        Documentos.
      </h1>
      {/* El copy anterior decía «BL · Packing List · Facturas comerciales ·
          POD. Los carga nuestro equipo» y las dos mitades fallaban: los tipos
          de `shipment_documents` son bl/pod/otro —nunca hubo "packing" ni
          "factura comercial" ahí— y el packing list no lo carga el equipo, lo
          llena el proveedor. Ahora la pantalla sí trae las dos fuentes y la
          frase dice cuál es cuál (SDD-0308). */}
      <p className="lead mt-3">
        El BL, el comprobante de entrega y lo demás que tu asesor sube a tus
        envíos, más los packing lists que llenan tus proveedores. Quedan
        disponibles 7 años en archivo.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-10 text-center">
          <div className="text-[16px] font-bold text-ink">
            Todavía no hay documentos.
          </div>
          <p className="mt-2 text-[14px] text-grey-700 max-w-[48ch] mx-auto leading-[1.55]">
            A medida que tus envíos avanzan, tu asesor sube acá el BL, el
            comprobante de entrega y otros documentos. Los packing lists
            aparecen solos, en cuanto tus proveedores los llenan.
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
