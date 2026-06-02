/**
 * Tipos del módulo Documentos del envío (SDD-0042 Fase 3b).
 * Matchea supabase/migrations/0086_shipment_documents.sql.
 *
 * Documentos (BL / POD / otros) que el equipo sube a un envío y el cliente ve
 * read-only en el portal. Los archivos viven en el bucket `shipment-docs`;
 * esta tabla los indexa.
 */

export type ShipmentDocType = "bl" | "pod" | "otro";

export const SHIPMENT_DOCS_BUCKET = "shipment-docs";
export const SHIPMENT_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const SHIPMENT_DOC_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const SHIPMENT_DOC_TYPE_OPTIONS: {
  value: ShipmentDocType;
  label: string;
}[] = [
  { value: "bl", label: "BL · Conocimiento de embarque" },
  { value: "pod", label: "POD · Comprobante de entrega" },
  { value: "otro", label: "Otro documento" },
];

/** Label completo (selector, detalle). */
export function shipmentDocTypeLabel(t: ShipmentDocType): string {
  return SHIPMENT_DOC_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? "Documento";
}

/** Label corto para badges (BL / POD / DOC). */
export function shipmentDocTypeShort(t: ShipmentDocType): string {
  switch (t) {
    case "bl":
      return "BL";
    case "pod":
      return "POD";
    case "otro":
      return "DOC";
  }
}

export function isAllowedDocMime(mime: string): boolean {
  return SHIPMENT_DOC_ALLOWED_MIME.has(mime);
}

export function extFromDocMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

/** ¿El doc es un PDF? (la UI muestra "Ver" para PDF/imagen, ícono distinto). */
export function isPdf(contentType: string | null): boolean {
  return contentType === "application/pdf";
}

/** Tamaño legible: "820 KB", "1.4 MB". null/0 → "". */
export function formatDocSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/** Una fila de documento del envío (read-only en queries). */
export type ShipmentDocument = {
  id: string;
  shipment_id: string;
  doc_type: ShipmentDocType;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const VALID_TYPES: ShipmentDocType[] = ["bl", "pod", "otro"];

export function parseDocType(raw: unknown): ShipmentDocType {
  return VALID_TYPES.includes(raw as ShipmentDocType)
    ? (raw as ShipmentDocType)
    : "otro";
}
