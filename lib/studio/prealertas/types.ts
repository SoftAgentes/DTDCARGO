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

import { parseMarkbox, printMarkbox } from "@/lib/shared/markbox-chain";

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
  en_camino: { label: "En camino", tone: "info" },
  recibida: { label: "Recibida en CN", tone: "success" },
  consolidada: { label: "Consolidada", tone: "success" },
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
 * Número de cliente desde el MARKBOX de la CASA (`DTD-5532` → `"5532"`).
 *
 * ⚠️ **Sólo vale para markbox de la casa.** Con una insignia de aliado devuelve
 * basura: `HR-0001` → `"0001"` (que choca con el `DTD-0001`) y `DC-FA-1232` →
 * `"FA"` (igual para TODOS los clientes de ese sub-aliado). Por eso el código de
 * compra ya **no** se arma con esta función, sino con
 * `prealertaBaseFromMarkbox()`. Se conserva porque su contrato —"el número"— es
 * legítimo y hay tests que lo fijan; no la uses para construir identificadores.
 */
export function clientNoFromMarkbox(markbox: string): string {
  const norm = (markbox ?? "").trim().toUpperCase();
  const parts = norm.split("-");
  return parts.length >= 2 && parts[1] ? parts[1] : norm;
}

/**
 * Base del código de compra: el Shipping Mark en su forma **IMPRESA**
 * (SDD-0255). Es lo que el cliente ve, así que el código de su compra hereda su
 * propia insignia y no la de arriba.
 *
 * `DTD-5532` → `"DTD-5532"` · `HR-0001` → `"HR-0001"` · `DC-FA-1232` → `"FA-1232"`
 *
 * **Por qué la forma impresa y no la guardada:** el cliente de un sub-aliado no
 * debe ver el segmento raíz. Y como `aliados_prefix_uq` hace el prefijo único
 * global (migr 0362), la forma impresa sigue siendo única — que es lo que el
 * `unique (tenant_id, code)` de `prealertas` necesita.
 *
 * ⚠️ **Compatibilidad medida (2026-08-13):** para los `DTD-NNNN` y para los
 * códigos de VENDEDOR del legado (`DTD-A101`, `DTD-J044`) devuelve exactamente
 * lo mismo que la fórmula vieja, así que **ningún código vivo se mueve**. Se
 * verificaron las 5 prealertas de producción: las 5 son de clientes `DTD-NNNN`.
 * Lo único que cambia es lo que antes estaba roto (`AD-001`, `ITS-01`,
 * `DTD-LEG-SN01`, y cualquier insignia de aliado), que no tiene ninguna compra.
 */
export function prealertaBaseFromMarkbox(markbox: string): string {
  const norm = (markbox ?? "").trim().toUpperCase();
  const parsed = parseMarkbox(norm);
  // Cadena reconocible (casa o aliado) → forma impresa.
  if (parsed) return printMarkbox(norm);
  // No parsea (código de vendedor del legado, basura): se conserva el
  // comportamiento histórico para no mover códigos existentes.
  const parts = norm.split("-");
  return parts.length >= 2 && parts[1] ? `DTD-${parts[1]}` : `DTD-${norm}`;
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
  const base = prealertaBaseFromMarkbox(markbox);
  const s = Math.max(1, Math.trunc(Number(supplierSeq) || 1));
  const o = Math.max(1, Math.trunc(Number(orderSeq) || 1));
  return `${base}-${s}-${o}`;
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
  /**
   * SDD-0173 (migr 0269): nota que el CLIENTE escribió sobre esta compra en el
   * paso 1 del asistente ("pedido urgente", "incluye una muestra"…). No
   * confundir con `suppliers_cn.notes` (describe al proveedor) ni con las notas
   * por servicio (instrucciones operativas).
   */
  client_note: string | null;
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

// ── Ficha extendida del proveedor (SDD-0173 · migr 0266) ───────
//
// Las 3 preguntas del Norte al dar de alta un proveedor. Son datos DEL CLIENTE
// para su propio control ("te ayudan a reconocerlo cuando tengas varios"), no
// de operación. Se guardan SLUGS —el vocabulario lo cierra un CHECK en la DB—
// y las etiquetas visibles viven acá al lado.

export const SUPPLIER_SOURCE_ORIGINS = [
  "alibaba",
  "1688",
  "feria_canton",
  "recomendado",
  "otro",
] as const;
export type SupplierSourceOrigin = (typeof SUPPLIER_SOURCE_ORIGINS)[number];

export const SUPPLIER_SOURCE_ORIGIN_LABEL: Record<SupplierSourceOrigin, string> =
  {
    alibaba: "Alibaba",
    "1688": "1688",
    feria_canton: "Feria (Cantón)",
    recomendado: "Me lo recomendaron",
    otro: "Otro",
  };

/** Los dos que piden explicar de dónde salió (Norte: `needNote`). */
export const SUPPLIER_ORIGINS_NEEDING_NOTE: readonly SupplierSourceOrigin[] = [
  "recomendado",
  "otro",
];

export const SUPPLIER_PURCHASE_HISTORIES = ["nuevo", "previo"] as const;
export type SupplierPurchaseHistory =
  (typeof SUPPLIER_PURCHASE_HISTORIES)[number];

export const SUPPLIER_PURCHASE_HISTORY_LABEL: Record<
  SupplierPurchaseHistory,
  string
> = { nuevo: "Primera vez", previo: "Ya le compraba" };

export const SUPPLIER_COMM_METHODS = [
  "whatsapp",
  "wechat",
  "alibaba",
  "otro",
] as const;
export type SupplierCommMethod = (typeof SUPPLIER_COMM_METHODS)[number];

export const SUPPLIER_COMM_METHOD_LABEL: Record<SupplierCommMethod, string> = {
  whatsapp: "WhatsApp",
  wechat: "WeChat",
  alibaba: "Alibaba",
  otro: "Otro",
};

export type SupplierProfileInput = {
  /** "¿Qué vende?" — columna `industry`, que YA existía en prod. */
  industry: string | null;
  /** Teléfono — columna `contact_phone`, que YA existía en prod. */
  contactPhone: string | null;
  sourceOrigin: SupplierSourceOrigin | null;
  sourceOriginNote: string | null;
  purchaseHistory: SupplierPurchaseHistory | null;
  commMethod: SupplierCommMethod | null;
};

function pickFrom<T extends string>(
  allowed: readonly T[],
  raw: unknown,
): T | null {
  const v = String(raw ?? "").trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * Normaliza la ficha extendida. Es TODA opcional: un valor que no esté en su
 * vocabulario se descarta en silencio (cae a `null`) en vez de romper el alta —
 * el CHECK de la DB es la última línea, no la primera. La nota sólo sobrevive
 * si el origen la pide; si no, sería un texto huérfano que nadie vuelve a leer.
 */
export function normalizeSupplierProfileInput(
  raw: Partial<Record<keyof SupplierProfileInput, unknown>>,
): SupplierProfileInput {
  const sourceOrigin = pickFrom(SUPPLIER_SOURCE_ORIGINS, raw.sourceOrigin);
  const needsNote =
    sourceOrigin !== null && SUPPLIER_ORIGINS_NEEDING_NOTE.includes(sourceOrigin);
  return {
    industry: String(raw.industry ?? "").trim() || null,
    contactPhone: String(raw.contactPhone ?? "").trim() || null,
    sourceOrigin,
    sourceOriginNote: needsNote
      ? String(raw.sourceOriginNote ?? "").trim() || null
      : null,
    purchaseHistory: pickFrom(SUPPLIER_PURCHASE_HISTORIES, raw.purchaseHistory),
    commMethod: pickFrom(SUPPLIER_COMM_METHODS, raw.commMethod),
  };
}

/** Fila lista para el insert (claves = columnas de la migr 0266). */
export function supplierProfileRow(
  p: SupplierProfileInput,
): Record<string, string | null> {
  return {
    industry: p.industry,
    contact_phone: p.contactPhone,
    source_origin: p.sourceOrigin,
    source_origin_note: p.sourceOriginNote,
    purchase_history: p.purchaseHistory,
    comm_method: p.commMethod,
  };
}

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
  /** La compra ya existía: un reintento del mismo envío (SDD-0599). */
  replayed?: boolean;
};

/**
 * Marcador que ocupa `description` cuando la compra se registra sin detalle
 * (asistente de 3 pasos · SDD-0173: el cliente lo completa en el paso 2).
 *
 * La columna `prealertas.description` es NOT NULL, así que el hueco necesita un
 * texto — pero uno que el operario del ERP pueda LEER como "todavía no llegó",
 * en vez de una celda en blanco que parece un bug.
 */
export const PREALERTA_DESCRIPCION_PENDIENTE = "Pendiente — el cliente la completa";

/** Tope de la nota del cliente (== CHECK de la migr 0269). */
export const PREALERTA_CLIENT_NOTE_MAX = 2000;

/**
 * Normaliza la nota del cliente sobre la compra (SDD-0173 · migr 0269).
 *
 * Recorta en vez de rechazar: una nota larguísima es un pegado accidental, no un
 * error que valga la pena mostrarle a alguien que sólo quería registrar su
 * compra. El CHECK de la DB es la red, no la puerta.
 */
export function normalizeClientNote(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return s.length > PREALERTA_CLIENT_NOTE_MAX
    ? s.slice(0, PREALERTA_CLIENT_NOTE_MAX)
    : s;
}

/**
 * Validación manual del input de prealerta/compra (sin zod).
 *  - description requerida (no vacía).
 *  - boxes entero ≥ 1.
 *  - status normaliza a 'anunciada' si inválido.
 *  - estValueUsd opcional; si viene debe ser ≥ 0.
 *  - supplierId opcional (la cross-tenant la valida el trigger en DB).
 *
 * `opts.requireDetalle` (default `true`) mantiene EXACTAMENTE el comportamiento
 * histórico para todos los callers de siempre (ERP y `/portal/proveedores`). En
 * `false` — sólo lo pide el asistente de 3 pasos (SDD-0173 §3.2), donde el Norte
 * pone esos campos en el paso 2 y marcados "· opcional" — la compra puede nacer
 * con proveedor y nada más:
 *  - description ausente/vacía → `PREALERTA_DESCRIPCION_PENDIENTE`.
 *  - boxes ausente (`null`/`undefined`) → `1`.
 *
 * Se afloja la OBLIGATORIEDAD, nunca el FORMATO: si el cliente escribe cajas,
 * `0` y `1.5` siguen siendo errores en los dos modos.
 */
export function validatePrealertaInput(
  input: Partial<PrealertaInput>,
  opts: { requireDetalle?: boolean } = {},
): {
  input?: PrealertaInput;
  fieldErrors?: PrealertaActionState["fieldErrors"];
} {
  const requireDetalle = opts.requireDetalle ?? true;
  const errors: PrealertaActionState["fieldErrors"] = {};

  const descriptionRaw = (input.description ?? "").trim();
  if (!descriptionRaw && requireDetalle) {
    errors.description = "Describe qué viene en la compra.";
  }
  const description = descriptionRaw || PREALERTA_DESCRIPCION_PENDIENTE;

  // Ausente ≠ inválido: sin detalle exigido, "no lo escribió" cae a 1 caja; pero
  // un valor escrito se valida igual de duro (0 y 1.5 fallan en ambos modos).
  const boxesOmitted = input.boxes == null || `${input.boxes}`.trim() === "";
  const boxesNum = boxesOmitted && !requireDetalle ? 1 : Number(input.boxes);
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
