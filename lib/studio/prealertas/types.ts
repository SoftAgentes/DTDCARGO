/**
 * Tipos TypeScript del módulo Portal · Compras (prealertas) + Proveedores
 * (SDD-0057). Matchea el schema de supabase/migrations/0105_portal_compras.sql.
 *
 * Dos entidades:
 *  - `Supplier`  · proveedor chino del cliente (suppliers_cn). Cada proveedor
 *                  tiene un nº por cliente (`supplier_seq`: #1, #2, …).
 *  - `Prealerta` · compra = aviso pre-arribo (prealertas), con el código del
 *                  Norte `DTD-{clientNo}-{supplier_seq}-{order_seq}`. Por caja se
 *                  rotula el MISMO code + "Caja M/N" (shipping mark de SDD-0031).
 *
 * Helpers PUROS + validadores manuales (no Zod, patrón del repo).
 */

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la prealerta (enum de display)                  ║
// ╚═══════════════════════════════════════════════════════════╝

export type PrealertaStatus =
  | "anunciada"
  | "en_camino"
  | "recibida"
  | "consolidada"
  | "cancelada";

export const PREALERTA_STATUS: Record<
  PrealertaStatus,
  { label: string; tone: BadgeTone }
> = {
  anunciada: { label: "Anunciada", tone: "info" },
  en_camino: { label: "En camino", tone: "warning" },
  recibida: { label: "Recibida en CN", tone: "success" },
  consolidada: { label: "Consolidada", tone: "wine" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export const PREALERTA_STATUSES = Object.keys(
  PREALERTA_STATUS,
) as PrealertaStatus[];

export function prealertaStatusLabel(status: string): string {
  return PREALERTA_STATUS[status as PrealertaStatus]?.label ?? status;
}
export function prealertaStatusTone(status: string): BadgeTone {
  return PREALERTA_STATUS[status as PrealertaStatus]?.tone ?? "neutral";
}

export function isPrealertaStatus(v: unknown): v is PrealertaStatus {
  return typeof v === "string" && v in PREALERTA_STATUS;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Código de la compra (esquema del Norte)                   ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Número de cliente desde el MARKBOX (`DTD-5532` → `"5532"`). El code del Norte
 * usa este segmento como `clientNo`. Si el MARKBOX no tiene el patrón esperado,
 * cae al MARKBOX completo (normalizado) para no romper — la red es el
 * `unique(tenant, code)`.
 */
export function clientNoFromMarkbox(markbox: string): string {
  const norm = (markbox ?? "").trim().toUpperCase();
  const parts = norm.split("-");
  return parts.length >= 2 && parts[1] ? parts[1] : norm;
}

/**
 * Arma el código de la compra con el esquema del Norte
 * `DTD-{clientNo}-{supplier_seq}-{order_seq}`:
 *  - `clientNo`     = nº de cliente del MARKBOX.
 *  - `supplier_seq` = nº de proveedor por cliente (#1, #2, …).
 *  - `order_seq`    = nº de compra de ese (cliente, proveedor).
 * `buildPrealertaCode("DTD-5532", 3, 2)` → `"DTD-5532-3-2"`. Los seq se
 * normalizan a entero ≥ 1 (sin padding; soporta > 9).
 */
export function buildPrealertaCode(
  markbox: string,
  supplierSeq: number,
  orderSeq: number,
): string {
  const clientNo = clientNoFromMarkbox(markbox);
  const s = Math.max(1, Math.trunc(Number(supplierSeq) || 1));
  const o = Math.max(1, Math.trunc(Number(orderSeq) || 1));
  return `DTD-${clientNo}-${s}-${o}`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Etiquetas por caja (shipping mark · SDD-0031)             ║
// ╚═══════════════════════════════════════════════════════════╝

/** Una etiqueta imprimible: el MISMO code de la compra + "Caja boxN/totalBoxes". */
export type BoxLabel = {
  /** code de la compra (igual en todas las cajas; NO lleva la caja como segmento). */
  code: string;
  /** nº de esta caja (1..totalBoxes). */
  boxN: number;
  /** total de cajas de la compra. */
  totalBoxes: number;
  /**
   * SDD-0153: el código ÚNICO de la caja (`DTD-B-NNNNNN`), si ya fue pre-declarada.
   * Es lo que hace la etiqueta escaneable por caja (no solo por cliente): el QR lo
   * lleva en `&b=` y el operario lo lee al recibir y al estibar. `null` cuando la
   * compra no tiene cajas pre-declaradas todavía (fallback a la etiqueta vieja, que
   * identifica al cliente pero no a la caja).
   */
  boxCode?: string | null;
};

/**
 * Arma la lista de etiquetas de una compra: una por caja, todas con el MISMO
 * `code` + su `boxN/totalBoxes`. El nº de caja NO es un 5º segmento del código
 * (el Norte muestra el code + "Caja M/N" como texto). `boxes` se normaliza a
 * entero ≥ 1.
 *
 * FALLBACK: sin cajas pre-declaradas (`boxCode` queda `null`). Preferir
 * `buildLabelsFromBoxes` cuando existan filas en `warehouse_boxes`.
 */
export function buildLabels(code: string, boxes: number): BoxLabel[] {
  const total = Math.max(1, Math.trunc(Number(boxes) || 1));
  return Array.from({ length: total }, (_, i) => ({
    code,
    boxN: i + 1,
    totalBoxes: total,
    boxCode: null,
  }));
}

/** Una caja pre-declarada, tal como la devuelve `listPredeclaredBoxes`. */
export type PredeclaredBox = { code: string; seq: number };

/**
 * SDD-0153: arma las etiquetas desde las cajas REALES pre-declaradas
 * (`warehouse_boxes`), para que cada etiqueta lleve su `DTD-B-NNNNNN` escaneable.
 * El `code` de la compra sigue siendo el encabezado (lo que el cliente reconoce);
 * `boxCode` es la identidad única de la caja. `boxN/totalBoxes` se derivan del
 * ORDEN de la lista (1..N), no del `seq` de la DB, que puede tener huecos tras una
 * edición de conteo — para la etiqueta impresa importa "3 de 12", no el seq crudo.
 */
export function buildLabelsFromBoxes(
  prealertaCode: string,
  boxes: PredeclaredBox[],
): BoxLabel[] {
  const ordered = [...boxes].sort((a, b) => a.seq - b.seq);
  const total = ordered.length;
  return ordered.map((b, i) => ({
    code: prealertaCode,
    boxN: i + 1,
    totalBoxes: total,
    boxCode: b.code,
  }));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Vista de proveedor para el Portal ("Tus proveedores")     ║
// ╚═══════════════════════════════════════════════════════════╝

/** Proveedor + su nº de compras + el próximo código (lista del portal). */
export type SupplierView = {
  id: string;
  supplierSeq: number;
  name: string;
  /** WeChat / WhatsApp del proveedor (número o ID); null si no se cargó. */
  wechat: string | null;
  city: string | null;
  contact: string | null;
  notes: string | null;
  /** nº de compras vivas registradas a este proveedor. */
  orderCount: number;
  /** código que tendría la PRÓXIMA compra a este proveedor. */
  nextCode: string;
};

/**
 * Combina los proveedores del cliente con sus compras para la lista del portal:
 * para cada proveedor, cuenta cuántas compras (vivas) tiene y arma el código de
 * la próxima (`order_seq = orderCount + 1`). Helper PURO (testeable): recibe la
 * cuenta de compras por `supplier_id` ya resuelta por el caller.
 */
export function summarizeSuppliers(
  markbox: string,
  suppliers: {
    id: string;
    supplier_seq: number;
    name: string;
    wechat?: string | null;
    city?: string | null;
    contact?: string | null;
    notes?: string | null;
  }[],
  orderCountBySupplierId: Record<string, number>,
): SupplierView[] {
  return suppliers.map((s) => {
    const orderCount = orderCountBySupplierId[s.id] ?? 0;
    return {
      id: s.id,
      supplierSeq: s.supplier_seq,
      name: s.name,
      wechat: s.wechat ?? null,
      city: s.city ?? null,
      contact: s.contact ?? null,
      notes: s.notes ?? null,
      orderCount,
      nextCode: buildPrealertaCode(markbox, s.supplier_seq, orderCount + 1),
    };
  });
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Adjuntos de la compra (prealerta_documents · migr 0118)    ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Tipo de adjunto de una compra. El cliente puede subir (opcional) el packing
 * list, la factura del proveedor, fotos del producto y una captura del WhatsApp/
 * WeChat del proveedor (para que no tenga que copiar el número).
 */
// 'otro' (SDD-0096): cualquier otro documento que sube el proveedor por el link.
export type PrealertaDocType =
  | "packing"
  | "factura"
  | "foto"
  | "whatsapp"
  | "otro";

export const PREALERTA_DOC_TYPE_LABEL: Record<PrealertaDocType, string> = {
  packing: "Packing list",
  factura: "Factura del proveedor",
  foto: "Foto del producto",
  // El valor del enum sigue siendo 'whatsapp' (interno, sin migración), pero de
  // cara al cliente es la captura del contacto de WeChat del proveedor.
  whatsapp: "Captura de WeChat",
  otro: "Otro documento",
};

export function isPrealertaDocType(v: unknown): v is PrealertaDocType {
  return (
    v === "packing" ||
    v === "factura" ||
    v === "foto" ||
    v === "whatsapp" ||
    v === "otro"
  );
}

/** Origen del adjunto (migr 0147): quién lo subió. */
export type PrealertaDocSource = "client" | "supplier" | "team";

/** Bucket privado de los adjuntos de compra (migr 0118). */
export const PREALERTA_DOC_BUCKET = "prealerta-docs";
/** Límite por archivo: 15 MB (SDD-0096, matchea el file_size_limit del bucket;
 *  subido de 10 a 15 MB para fotos de móvil del proveedor). */
export const PREALERTA_DOC_MAX_BYTES = 15 * 1024 * 1024;

// MIME de Office (SDD-0096): el proveedor re-sube el Excel llenado y "cualquier
// otro documento". Matchea allowed_mime_types del bucket tras la migr 0147.
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";
const CSV_MIME = "text/csv";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

/** Mimes permitidos (matchea allowed_mime_types del bucket · imágenes + pdf + Office). */
export const PREALERTA_DOC_ALLOWED_MIME: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  XLSX_MIME,
  XLS_MIME,
  CSV_MIME,
  DOCX_MIME,
  DOC_MIME,
]);

export function isAllowedPrealertaDocMime(mime: string): boolean {
  return PREALERTA_DOC_ALLOWED_MIME.has(mime);
}

/** Extensión canónica desde el content-type confiable (para armar el path). */
export function prealertaDocExtFromMime(mime: string): string {
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
    case XLSX_MIME:
      return "xlsx";
    case XLS_MIME:
      return "xls";
    case CSV_MIME:
      return "csv";
    case DOCX_MIME:
      return "docx";
    case DOC_MIME:
      return "doc";
    default:
      return "bin";
  }
}

/** doc_type inferido del MIME para la subida del proveedor (SDD-0096):
 *  imagen → foto · hoja de cálculo → packing · resto → otro. */
export function inferPrealertaDocType(mime: string): PrealertaDocType {
  if (mime.startsWith("image/")) return "foto";
  if (mime === XLSX_MIME || mime === XLS_MIME || mime === CSV_MIME)
    return "packing";
  return "otro";
}

/**
 * Path del object en el bucket `prealerta-docs`. SIEMPRE server-side: el
 * `tenantId` viene de la sesión y el `uuid` lo genera el servidor — el cliente
 * NUNCA inyecta el path. Esquema: {tenant_id}/{prealerta_id}/{uuid}.{ext}.
 */
export function buildPrealertaDocPath(opts: {
  tenantId: string;
  prealertaId: string;
  uuid: string;
  ext: string;
}): string {
  return `${opts.tenantId}/${opts.prealertaId}/${opts.uuid}.${opts.ext}`;
}

export type PrealertaDocument = {
  id: string;
  tenant_id: string;
  prealerta_id: string;
  client_markbox: string;
  doc_type: PrealertaDocType;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  /** Origen del adjunto (migr 0147): client (portal) · supplier (link) · team. */
  source: PrealertaDocSource;
  created_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                         ║
// ╚═══════════════════════════════════════════════════════════╝

export type Supplier = {
  id: string;
  tenant_id: string;
  client_markbox: string;
  supplier_seq: number;
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Prealerta = {
  id: string;
  tenant_id: string;
  client_markbox: string;
  supplier_id: string | null;
  code: string;
  description: string;
  tracking_cn: string | null;
  boxes: number;
  est_value_usd: number | null;
  status: PrealertaStatus;
  received_at: string | null;
  shipment_id: string | null;
  /** SDD-0057 ext: token del link público del proveedor (/p/{share_token}). */
  share_token: string | null;
  /** SDD-0072: Orden de venta (OV-) que esta caja física cumple (FK suave, nullable). */
  sales_order_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Inputs + validadores manuales (no Zod, patrón del repo)   ║
// ╚═══════════════════════════════════════════════════════════╝

// ── Supplier ───────────────────────────────────────────────────

export type SupplierInput = {
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  notes: string | null;
};

export type SupplierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierInput, string>>;
  supplierId?: string;
};

export type DeleteSupplierActionState = {
  ok?: boolean;
  error?: string;
};

/**
 * Validación manual del input de proveedor (sin zod).
 *  - name requerido (no vacío).
 *  - el resto opcional (se normaliza a null cuando viene vacío).
 */
export function validateSupplierInput(input: Partial<SupplierInput>): {
  input?: SupplierInput;
  fieldErrors?: SupplierActionState["fieldErrors"];
} {
  const errors: SupplierActionState["fieldErrors"] = {};

  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Indica el nombre del proveedor.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      name,
      city: input.city?.trim() || null,
      wechat: input.wechat?.trim() || null,
      contact: input.contact?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Prealerta ──────────────────────────────────────────────────

export type PrealertaInput = {
  supplierId: string | null;
  description: string;
  trackingCn: string | null;
  boxes: number;
  estValueUsd: number | null;
  status: PrealertaStatus;
};

export type PrealertaActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PrealertaInput, string>>;
  prealertaCode?: string;
  /** Token del link público del proveedor (para "Compartir con mi proveedor"). */
  shareToken?: string;
};

/**
 * Validación manual del input de prealerta/compra (sin zod).
 *  - description requerida (no vacía).
 *  - boxes entero ≥ 1.
 *  - status normaliza a 'anunciada' si inválido.
 *  - estValueUsd opcional; si viene debe ser ≥ 0.
 *  - supplierId opcional (la cross-tenant la valida el trigger en DB).
 */
export function validatePrealertaInput(input: Partial<PrealertaInput>): {
  input?: PrealertaInput;
  fieldErrors?: PrealertaActionState["fieldErrors"];
} {
  const errors: PrealertaActionState["fieldErrors"] = {};

  const description = (input.description ?? "").trim();
  if (!description) errors.description = "Describe qué viene en la compra.";

  const boxesNum = Number(input.boxes);
  if (!Number.isFinite(boxesNum) || boxesNum < 1) {
    errors.boxes = "Indica la cantidad de cajas (mínimo 1).";
  } else if (!Number.isInteger(boxesNum)) {
    errors.boxes = "La cantidad de cajas debe ser un número entero.";
  }

  let estValueUsd: number | null = null;
  if (input.estValueUsd != null && `${input.estValueUsd}`.trim() !== "") {
    const n = Number(input.estValueUsd);
    if (!Number.isFinite(n) || n < 0) {
      errors.estValueUsd = "El valor estimado no puede ser negativo.";
    } else {
      estValueUsd = n;
    }
  }

  const status: PrealertaStatus = isPrealertaStatus(input.status)
    ? input.status
    : "anunciada";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      supplierId: (input.supplierId ?? "")?.toString().trim() || null,
      description,
      trackingCn: input.trackingCn?.trim() || null,
      boxes: Math.trunc(boxesNum),
      estValueUsd,
      status,
    },
  };
}
