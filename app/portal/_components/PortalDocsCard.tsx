import {
  shipmentDocTypeLabel,
  shipmentDocTypeShort,
  formatDocSize,
  type ShipmentDocument,
} from "@/lib/studio/shipment-document-types";
import { ArrowIcon } from "@/components/Icon";

/**
 * Card de "Documentos" del envío en el portal (SDD-0042 Fase 3b). Read-only:
 * lista los documentos (BL/POD/otros) que el equipo subió, cada uno con su
 * signed URL (abre en pestaña nueva). Si no hay documentos → no renderiza nada
 * (evita una card vacía en el detalle).
 *
 * El portal puede importar de `@/lib/studio` (está fuera de la frontera ESLint,
 * es superficie autenticada Supabase-backed).
 */
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

export function PortalDocsCard({
  documents,
  signedUrls,
}: {
  documents: ShipmentDocument[];
  signedUrls: Record<string, string>;
}) {
  if (documents.length === 0) return null;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
      <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500 mb-5">
        Documentos
      </h2>
      <ul className="flex flex-col gap-3">
        {documents.map((doc) => {
          const url = signedUrls[doc.storage_path];
          const meta = [
            shipmentDocTypeLabel(doc.doc_type),
            formatDocSize(doc.size_bytes),
            formatDate(doc.created_at),
          ]
            .filter(Boolean)
            .join(" · ");

          const inner = (
            <>
              <span
                className="text-[10px] font-bold tracking-wide text-wine-text bg-paper border border-grey-200 rounded-md px-2 py-1 flex-shrink-0"
                style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
              >
                {shipmentDocTypeShort(doc.doc_type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink truncate">
                  {doc.file_name}
                </div>
                <div className="text-[12px] text-grey-500">{meta}</div>
              </div>
            </>
          );

          return (
            <li key={doc.id}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-link group flex items-center gap-3 border border-grey-200 rounded-[14px] p-4 transition-colors hover:border-ink focus-visible:border-ink"
                  aria-label={`Ver documento ${doc.file_name}`}
                >
                  {inner}
                  <span className="text-[12.5px] font-semibold text-wine-text inline-flex items-center gap-1 flex-shrink-0">
                    Ver <ArrowIcon size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </a>
              ) : (
                <div className="flex items-center gap-3 border border-grey-200 rounded-[14px] p-4 opacity-70">
                  {inner}
                  <span className="text-[12px] text-grey-500 flex-shrink-0">
                    No se pudo abrir
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
