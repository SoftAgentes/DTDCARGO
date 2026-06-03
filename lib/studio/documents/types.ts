/**
 * Tipos puros del Hub de Documentos (DMS · SDD-0049 Slice A).
 * Matchea supabase/migrations/0097_documentos_hub.sql y el modelo del Norte
 * (docs/design/studio/_norte/erp/modules/documentos-data.jsx).
 *
 * `documents` es polimórfico (entity_type + entity_id) y vive en el bucket
 * privado `documents` (path {tenant}/{type}/{id|none}/{uuid}.{ext}). Las
 * carpetas son un taxonomy FIJO en código (V1, §4.2). vencido/por-vencer se
 * DERIVAN de valid_until (deriveDocStatus) — NO se persisten como status.
 */

// ── Storage ────────────────────────────────────────────────────
export const DOCUMENTS_BUCKET = "documents";
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Mimes permitidos por el bucket (matchea allowed_mime_types de 0097). */
export const DOCUMENT_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/zip",
]);

export function isAllowedDocumentMime(mime: string): boolean {
  return DOCUMENT_ALLOWED_MIME.has(mime);
}

/**
 * Arma el path del object en el bucket `documents` (Slice B). SIEMPRE se llama
 * server-side: el `tenantId` viene de get_user_tenant_id() y el `uuid` lo genera
 * el servidor — el cliente NUNCA inyecta un path. Esquema:
 *   {tenant_id}/{entity_type}/{entity_id|none}/{uuid}.{ext}
 * El 1er segmento (tenant) lo re-verifica la Storage RLS por tenant.
 * `none` o entity_id null → segmento literal "none".
 */
export function buildDocumentStoragePath(opts: {
  tenantId: string;
  entityType: DocumentEntityType;
  entityId: string | null;
  uuid: string;
  ext: string;
}): string {
  const idSeg =
    opts.entityType === "none" || !opts.entityId ? "none" : opts.entityId;
  return `${opts.tenantId}/${opts.entityType}/${idSeg}/${opts.uuid}.${opts.ext}`;
}

/** Extensión canónica desde el content-type (para construir el path). */
export function extFromMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/zip":
      return "zip";
    default:
      return "bin";
  }
}

/**
 * Content-type CANÓNICO derivado de la extensión confiable (no del `raw.type`
 * del cliente). Se sirve este MIME al subir el object para que el
 * `Content-Type` de la signed URL sea el del tipo realmente esperado por la
 * extensión, no el que el browser/atacante eligió (hardening · SDD-0049 §9).
 * Si la extensión no está en el mapa confiable → octet-stream (no renderizable
 * inline). NO fuerza download: PDF/imagen siguen abriéndose inline en el "Ver".
 */
const EXT_CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
};

export function canonicalContentType(mime: string): string {
  return EXT_CONTENT_TYPE[extFromMime(mime)] ?? "application/octet-stream";
}

// ── Entidades adjuntables (enum document_entity_type) ───────────
export const DOCUMENT_ENTITY_TYPES = [
  "shipment",
  "invoice",
  "supplier_bill",
  "supplier_payment",
  "journal_entry",
  "client",
  "supplier",
  "consolidation",
  "booking",
  "none",
] as const;

export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

// ── Estados persistidos (enum document_status) ──────────────────
export const DOCUMENT_STATUSES = [
  "firmado",
  "vigente",
  "pendiente",
  "borrador",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Estado mostrado: persistido + los dos derivados de valid_until. */
export type DocumentDisplayStatus = DocumentStatus | "vencido" | "por-vencer";

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

/** Catálogo de estados (label + tono de badge). Espeja DOC_STATUS del Norte. */
export const DOC_STATUS: Record<
  DocumentDisplayStatus,
  { label: string; tone: BadgeTone }
> = {
  firmado: { label: "Firmado", tone: "success" },
  vigente: { label: "Vigente", tone: "success" },
  pendiente: { label: "Pendiente", tone: "warning" },
  borrador: { label: "Borrador", tone: "neutral" },
  vencido: { label: "Vencido", tone: "danger" },
  "por-vencer": { label: "Por vencer", tone: "warning" },
};

// ── Tipos de archivo (espeja EXT_META del Norte) ────────────────
export const EXT_META: Record<string, { tone: BadgeTone; label: string }> = {
  pdf: { tone: "danger", label: "PDF" },
  jpg: { tone: "info", label: "JPG" },
  png: { tone: "info", label: "PNG" },
  webp: { tone: "info", label: "IMG" },
  xlsx: { tone: "success", label: "XLS" },
  docx: { tone: "info", label: "DOC" },
  zip: { tone: "neutral", label: "ZIP" },
};

// ── Árbol de carpetas FIJO (taxonomy del Norte · §4.2) ──────────
export type FolderGroupId = "op" | "log" | "con" | "adu" | "otr";

export type FolderSub = { id: string; label: string };
export type FolderGroup = {
  id: FolderGroupId;
  label: string;
  tone: BadgeTone;
  children: FolderSub[];
};

export const FOLDERS: FolderGroup[] = [
  {
    id: "op",
    label: "Operacionales",
    tone: "info",
    children: [
      { id: "op-kyc", label: "Clientes · KYC & RIF" },
      { id: "op-contratos", label: "Contratos & poderes" },
      { id: "op-autoriz", label: "Autorizaciones" },
    ],
  },
  {
    id: "log",
    label: "Logísticas",
    tone: "wine",
    children: [
      { id: "log-bl", label: "BL & conocimiento" },
      { id: "log-packing", label: "Packing & factura comercial" },
      { id: "log-origen", label: "Certificados de origen" },
      { id: "log-fotos", label: "Fotos de carga & precinto" },
    ],
  },
  {
    id: "con",
    label: "Contables & financieras",
    tone: "success",
    children: [
      { id: "con-fact", label: "Facturas emitidas" },
      { id: "con-pagos", label: "Comprobantes de pago / cobro" },
      { id: "con-remesas", label: "Remesas a China" },
      { id: "con-retenc", label: "Retenciones IVA / ISLR" },
    ],
  },
  {
    id: "adu",
    label: "Aduaneras · SENIAT",
    tone: "warning",
    children: [
      { id: "adu-dua", label: "Declaración / DUA" },
      { id: "adu-aranceles", label: "Liquidación de aranceles" },
      { id: "adu-permisos", label: "Permisos & certificados" },
    ],
  },
  {
    id: "otr",
    label: "Otras",
    tone: "neutral",
    children: [
      { id: "otr-plantillas", label: "Plantillas" },
      { id: "otr-internos", label: "Internos" },
    ],
  },
];

/** Set de ids de subcarpeta válidos (para validar input). */
export const FOLDER_SUB_IDS: ReadonlySet<string> = new Set(
  FOLDERS.flatMap((g) => g.children.map((c) => c.id)),
);

/** Grupo top-level que contiene una carpeta (sea el id del grupo o de una sub). */
export function topOf(folderId: string): FolderGroup | undefined {
  return FOLDERS.find(
    (g) => g.id === folderId || g.children.some((c) => c.id === folderId),
  );
}

/** Ids de subcarpeta de un grupo top-level ([] si no es un grupo). */
export function subIds(topId: string): string[] {
  const g = FOLDERS.find((f) => f.id === topId);
  return g ? g.children.map((c) => c.id) : [];
}

/** Label legible de una carpeta (grupo o subcarpeta). "—" si no existe. */
export function folderLabel(folderId: string): string {
  for (const g of FOLDERS) {
    if (g.id === folderId) return g.label;
    const c = g.children.find((s) => s.id === folderId);
    if (c) return c.label;
  }
  return "—";
}

// ── Deep-link a la transacción (LINK_KIND del Norte, mapeado a rutas) ──
// entity_type → módulo + ruta base del Studio. La ruta de detalle la arma el
// consumidor (Slice B) con el code/id; acá fijamos el módulo destino.
export const LINK_KIND: Record<
  DocumentEntityType,
  { label: string; module: string | null; route: string | null }
> = {
  shipment: { label: "Embarque", module: "tracking", route: "/studio/tracking" },
  invoice: { label: "Factura", module: "facturacion", route: "/studio/facturacion" },
  supplier_bill: { label: "CxP", module: "tesoreria", route: "/studio/tesoreria" },
  supplier_payment: { label: "Pago", module: "tesoreria", route: "/studio/tesoreria" },
  journal_entry: { label: "Asiento", module: "contabilidad", route: "/studio/contabilidad" },
  client: { label: "Cliente", module: "clientes", route: "/studio/clientes" },
  supplier: { label: "Proveedor", module: "proveedores", route: "/studio/proveedores" },
  consolidation: { label: "Contenedor", module: "naviera", route: "/studio/naviera" },
  booking: { label: "Booking", module: "naviera", route: "/studio/naviera" },
  none: { label: "Sin transacción", module: null, route: null },
};

export function entityTypeLabel(t: DocumentEntityType): string {
  return LINK_KIND[t]?.label ?? "Documento";
}

// ── Fila de documento ───────────────────────────────────────────
export type DocumentRow = {
  id: string;
  tenant_id: string;
  entity_type: DocumentEntityType;
  entity_id: string | null;
  folder: string;
  doc_type: string | null;
  name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  status: DocumentStatus;
  valid_until: string | null; // ISO date (YYYY-MM-DD) o null
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/**
 * Estado MOSTRADO de un documento. vencido/por-vencer se derivan de valid_until
 * (§4.4): vencido si valid_until < today; por-vencer si cae dentro de los
 * próximos `windowDays` (default 30); si no, el status persistido.
 * `today` se inyecta (YYYY-MM-DD o Date) para testear sin reloj.
 */
export function deriveDocStatus(
  doc: Pick<DocumentRow, "status" | "valid_until">,
  today: string | Date = new Date(),
  windowDays = 30,
): DocumentDisplayStatus {
  if (!doc.valid_until) return doc.status;

  const todayMs = toDateMs(today);
  const validMs = toDateMs(doc.valid_until);
  if (Number.isNaN(todayMs) || Number.isNaN(validMs)) return doc.status;

  if (validMs < todayMs) return "vencido";

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  if (validMs < todayMs + windowMs) return "por-vencer";

  return doc.status;
}

/** Normaliza una fecha (ISO YYYY-MM-DD o Date) a ms de medianoche UTC. */
function toDateMs(d: string | Date): number {
  if (d instanceof Date) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  // ISO date — tomamos solo la parte YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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

// ── Validación de input (no Zod) ────────────────────────────────
export type DocumentInput = {
  entityType: DocumentEntityType;
  entityId: string | null;
  folder: string;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  status: DocumentStatus;
  validUntil: string | null;
  docType: string | null;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida y normaliza el input de un documento (la server action de Slice B la
 * usa antes de subir/insertar). No reemplaza la validación en DB (trigger): es
 * la primera línea, defensa en profundidad.
 */
export function validateDocumentInput(
  raw: Partial<DocumentInput>,
): ValidationResult<DocumentInput> {
  const errors: Record<string, string> = {};

  const entityType = raw.entityType;
  if (!entityType || !DOCUMENT_ENTITY_TYPES.includes(entityType)) {
    errors.entityType = "Tipo de entidad inválido.";
  }

  // entity_id ↔ entity_type (coherencia, espeja el CHECK de la migración)
  let entityId: string | null = raw.entityId ?? null;
  if (entityType === "none") {
    entityId = null;
  } else if (entityType) {
    if (!entityId) {
      errors.entityId = "Falta la entidad a la que se adjunta el documento.";
    } else if (!UUID_RE.test(entityId)) {
      errors.entityId = "Identificador de entidad inválido.";
    }
  }

  const folder = (raw.folder ?? "").trim();
  if (!folder) {
    errors.folder = "Elegí una carpeta.";
  } else if (!FOLDER_SUB_IDS.has(folder)) {
    errors.folder = "Carpeta inexistente.";
  }

  const name = (raw.name ?? "").trim();
  if (!name) {
    errors.name = "El documento necesita un nombre.";
  } else if (name.length > 200) {
    errors.name = "El nombre es demasiado largo (máx. 200).";
  }

  const contentType = raw.contentType ?? null;
  if (contentType && !isAllowedDocumentMime(contentType)) {
    errors.contentType = "Tipo de archivo no permitido.";
  }

  const sizeBytes = raw.sizeBytes ?? null;
  if (sizeBytes != null) {
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      errors.sizeBytes = "Tamaño inválido.";
    } else if (sizeBytes > DOCUMENT_MAX_BYTES) {
      errors.sizeBytes = "El archivo supera el límite de 10 MB.";
    }
  }

  const status = raw.status ?? "vigente";
  if (!DOCUMENT_STATUSES.includes(status)) {
    errors.status = "Estado inválido.";
  }

  let validUntil: string | null = raw.validUntil ?? null;
  if (validUntil) {
    validUntil = validUntil.trim();
    if (!ISO_DATE_RE.test(validUntil) || Number.isNaN(toDateMs(validUntil))) {
      errors.validUntil = "Fecha de vencimiento inválida (YYYY-MM-DD).";
    }
  }

  const docType = (raw.docType ?? "").trim() || null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      entityType: entityType as DocumentEntityType,
      entityId,
      folder,
      name,
      contentType,
      sizeBytes,
      status,
      validUntil,
      docType,
    },
  };
}
