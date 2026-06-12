/**
 * Queries del Expediente de defensa legal (SDD-0070 · SDD-E del handoff).
 *
 * `getDefenseFile(supabase, {tenantId, shipmentCode})` ORQUESTA las 5 piezas de
 * evidencia de UNA operación y devuelve un `DefenseFile` (o null si el envío no
 * existe en el tenant). Funciones PURAS que reciben un `SupabaseClient`:
 *
 *   1. Cabecera          → `shipments` por `code` + tenant.
 *   2. Aceptaciones      → REUSA `listAcceptanceEvidenceByQuote` (0067): trae el
 *                          hash verificado. quote_code === shipments.code (lo que
 *                          sella el Portal en la action de aceptación · 0068).
 *   3. Packing/compras   → `prealertas` (shipment_id) + `prealerta_documents`,
 *                          firmando el bucket `prealerta-docs`.
 *   4. Fotos de origen   → `warehouse_receipts_cn` (shipment_id) +
 *                          `warehouse_receipt_photos`, firmando `receipt-photos`.
 *   5. Cronología        → `shipment_events` (shipment_id), orden `occurred_at`.
 *   6. POD (indirecto)   → recepciones CN → `dispatch_order_packages`
 *                          (package_kind='warehouse_receipt_cn', package_id=receipt)
 *                          → `dispatch_orders` (od_id) → `dispatch_pods`, firmando
 *                          foto + firma del bucket `receipt-photos`.
 *
 * SEGURIDAD: tenant EXPLÍCITO en cada query (mismo criterio round-2 de los
 * gates · no se confía solo en RLS). Las URLs se firman ACÁ (batch por bucket,
 * TTL 1h) — el caller (page admin-only) ya garantizó el ownership a nivel tabla.
 *
 * FAIL-SOFT (decisión #5): cada pieza se arma en su propio `try`/catch; si una
 * tabla no existe en un env, falla la firma de un bucket, o la cadena del POD se
 * corta, esa sección queda vacía (`present:false`) en vez de romper el
 * expediente — es evidencia: se muestra lo que hay.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listAcceptanceEvidenceByQuote,
  type AcceptanceEvidenceExport,
} from "./queries";
import {
  type DefenseEvent,
  type DefenseFile,
  type DefenseOriginReceipt,
  type DefensePhoto,
  type DefensePod,
  type DefensePrealerta,
  type DefensePrealertaDoc,
  type DefenseSection,
  type DefenseShipment,
} from "./expediente-types";

// ── Buckets de Storage (matchean las migraciones) ─────────────
const RECEIPT_PHOTOS_BUCKET = "receipt-photos"; // fotos CN + foto/firma del POD
const PREALERTA_DOCS_BUCKET = "prealerta-docs"; // packing/factura/fotos de prealerta

/** TTL de las signed URLs: 1h (el expediente se imprime en segundos). */
const SIGN_TTL = 60 * 60;

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Construye una sección a partir de sus items (present = hay items). */
function section<T>(items: T[]): DefenseSection<T> {
  return { present: items.length > 0, items };
}

/**
 * Firma una lista de paths de un bucket en batch (patrón `signDocumentUrls`).
 * Devuelve { path: signedUrl }. Fail-soft: error de firma ⇒ {} (las fotos
 * quedan con url "" → la UI muestra el placeholder, no rompe).
 */
async function signPaths(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(unique, SIGN_TTL);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const item of data) {
      if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
    }
    return out;
  } catch {
    return {};
  }
}

// ════════════════════════════════════════════════════════════
// Cabecera del envío
// ════════════════════════════════════════════════════════════

const SHIPMENT_COLUMNS =
  "id, code, client_name, client_markbox, origin, destination, shipment_service, status, created_at, delivered_at, pod_signed_by";

/**
 * Cabecera del envío por `code` + tenant. null si no existe en el tenant (la
 * señal que usa `getDefenseFile` para devolver null = "404"). Tenant EXPLÍCITO.
 */
async function getDefenseShipment(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentCode: string,
): Promise<{ id: string; header: DefenseShipment } | null> {
  const { data, error } = await supabase
    .from("shipments")
    .select(SHIPMENT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("code", shipmentCode)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      code: string;
      client_name: string | null;
      client_markbox: string | null;
      origin: string | null;
      destination: string | null;
      shipment_service: string;
      status: string;
      created_at: string;
      delivered_at: string | null;
      pod_signed_by: string | null;
    }>();

  if (error || !data) return null;

  return {
    id: data.id,
    header: {
      id: data.id,
      code: data.code,
      clientName: data.client_name ?? null,
      markbox: data.client_markbox ?? null,
      origin: data.origin ?? null,
      destination: data.destination ?? null,
      service: data.shipment_service,
      status: data.status,
      createdAt: data.created_at,
      deliveredAt: data.delivered_at ?? null,
      podSignedBy: data.pod_signed_by ?? null,
    },
  };
}

// ════════════════════════════════════════════════════════════
// 1 · Aceptaciones (REUSA la query de 0067 — hash ya verificado)
// ════════════════════════════════════════════════════════════

async function getAcceptancesSection(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentCode: string,
): Promise<DefenseSection<AcceptanceEvidenceExport>> {
  try {
    // quote_code === shipments.code (lo que el Portal sella · 0068). Trae TODAS
    // las aceptaciones de la orden (re-aceptación incluida) con hash verificado.
    const items = await listAcceptanceEvidenceByQuote(supabase, {
      tenantId,
      quoteCode: shipmentCode,
    });
    return section(items);
  } catch {
    return section<AcceptanceEvidenceExport>([]);
  }
}

// ════════════════════════════════════════════════════════════
// 2 · Packing / compras (prealertas + prealerta_documents)
// ════════════════════════════════════════════════════════════

async function getPackingSection(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string,
): Promise<DefenseSection<DefensePrealerta>> {
  try {
    const { data: pre, error } = await supabase
      .from("prealertas")
      .select("id, code, description, boxes, tracking_cn")
      .eq("tenant_id", tenantId)
      .eq("shipment_id", shipmentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) return section<DefensePrealerta>([]);
    const rows = (pre as Record<string, unknown>[] | null) ?? [];
    if (rows.length === 0) return section<DefensePrealerta>([]);

    const prealertaIds = rows.map((r) => String(r.id));

    // Documentos de TODAS las prealertas en una sola query (fail-soft si la
    // tabla 0118 no está aplicada en un env).
    let docRows: Record<string, unknown>[] = [];
    try {
      const { data: docs } = await supabase
        .from("prealerta_documents")
        .select("id, prealerta_id, doc_type, storage_path, file_name")
        .eq("tenant_id", tenantId)
        .in("prealerta_id", prealertaIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(2000);
      docRows = (docs as Record<string, unknown>[] | null) ?? [];
    } catch {
      docRows = [];
    }

    const signed = await signPaths(
      supabase,
      PREALERTA_DOCS_BUCKET,
      docRows.map((d) => String(d.storage_path ?? "")),
    );

    const docsByPrealerta = new Map<string, DefensePrealertaDoc[]>();
    for (const d of docRows) {
      const pid = String(d.prealerta_id);
      const path = String(d.storage_path ?? "");
      const arr = docsByPrealerta.get(pid) ?? [];
      arr.push({
        id: String(d.id),
        docType: String(d.doc_type ?? ""),
        fileName: String(d.file_name ?? ""),
        path,
        url: signed[path] ?? "",
      });
      docsByPrealerta.set(pid, arr);
    }

    const items: DefensePrealerta[] = rows.map((r) => ({
      id: String(r.id),
      code: String(r.code ?? ""),
      description: String(r.description ?? ""),
      boxes: numOrNull(r.boxes),
      trackingCn: (r.tracking_cn as string | null) ?? null,
      documents: docsByPrealerta.get(String(r.id)) ?? [],
    }));

    return section(items);
  } catch {
    return section<DefensePrealerta>([]);
  }
}

// ════════════════════════════════════════════════════════════
// 3 · Fotos de origen (warehouse_receipts_cn + photos)
// ════════════════════════════════════════════════════════════

/**
 * Recepciones CN del envío. Devuelve también los receiptIds (los necesita el
 * POD para el join indirecto) para no re-consultar la tabla.
 */
async function getOriginReceipts(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string,
): Promise<{ receiptIds: string[]; receipts: Record<string, unknown>[] }> {
  try {
    const { data, error } = await supabase
      .from("warehouse_receipts_cn")
      .select(
        "id, receipt_code, supplier_name, supplier_name_translated, boxes, received_at",
      )
      .eq("tenant_id", tenantId)
      .eq("shipment_id", shipmentId)
      .is("deleted_at", null)
      .order("received_at", { ascending: true })
      .limit(1000);

    if (error) return { receiptIds: [], receipts: [] };
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    return { receiptIds: rows.map((r) => String(r.id)), receipts: rows };
  } catch {
    return { receiptIds: [], receipts: [] };
  }
}

async function buildOriginSection(
  supabase: SupabaseClient,
  tenantId: string,
  receipts: Record<string, unknown>[],
): Promise<DefenseSection<DefenseOriginReceipt>> {
  if (receipts.length === 0) return section<DefenseOriginReceipt>([]);

  try {
    const receiptIds = receipts.map((r) => String(r.id));

    // Fotos de TODAS las recepciones (fail-soft si la tabla no está).
    let photoRows: Record<string, unknown>[] = [];
    try {
      const { data } = await supabase
        .from("warehouse_receipt_photos")
        .select("id, receipt_id, storage_path, position")
        .eq("tenant_id", tenantId)
        .in("receipt_id", receiptIds)
        .order("position", { ascending: true })
        .limit(2000);
      photoRows = (data as Record<string, unknown>[] | null) ?? [];
    } catch {
      photoRows = [];
    }

    const signed = await signPaths(
      supabase,
      RECEIPT_PHOTOS_BUCKET,
      photoRows.map((p) => String(p.storage_path ?? "")),
    );

    const photosByReceipt = new Map<string, DefensePhoto[]>();
    for (const p of photoRows) {
      const rid = String(p.receipt_id);
      const path = String(p.storage_path ?? "");
      const arr = photosByReceipt.get(rid) ?? [];
      arr.push({
        path,
        url: signed[path] ?? "",
        label: `Foto ${arr.length + 1}`,
      });
      photosByReceipt.set(rid, arr);
    }

    const items: DefenseOriginReceipt[] = receipts.map((r) => {
      const supplier =
        (r.supplier_name_translated as string | null) ||
        (r.supplier_name as string | null) ||
        null;
      return {
        receiptId: String(r.id),
        receiptCode: String(r.receipt_code ?? ""),
        supplierName: supplier,
        boxes: numOrNull(r.boxes),
        receivedAt: (r.received_at as string | null) ?? null,
        photos: photosByReceipt.get(String(r.id)) ?? [],
      };
    });

    return section(items);
  } catch {
    return section<DefenseOriginReceipt>([]);
  }
}

// ════════════════════════════════════════════════════════════
// 4 · Cronología (shipment_events)
// ════════════════════════════════════════════════════════════

async function getTimelineSection(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string,
): Promise<DefenseSection<DefenseEvent>> {
  try {
    const { data, error } = await supabase
      .from("shipment_events")
      .select("id, status, note, occurred_at")
      .eq("tenant_id", tenantId)
      .eq("shipment_id", shipmentId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: true })
      .limit(2000);

    if (error) return section<DefenseEvent>([]);
    const items: DefenseEvent[] = (
      (data as Record<string, unknown>[] | null) ?? []
    ).map((e) => ({
      id: String(e.id),
      status: String(e.status ?? ""),
      note: (e.note as string | null) ?? null,
      occurredAt: String(e.occurred_at ?? ""),
    }));
    return section(items);
  } catch {
    return section<DefenseEvent>([]);
  }
}

// ════════════════════════════════════════════════════════════
// 5 · POD (join indirecto de 4 saltos · fail-soft si se corta)
// ════════════════════════════════════════════════════════════

/**
 * Prueba de entrega del envío por el join indirecto:
 *   recepciones CN del envío (receiptIds)
 *     → dispatch_order_packages (package_kind='warehouse_receipt_cn',
 *                                package_id ∈ receiptIds) → od_id
 *       → dispatch_orders (id ∈ od_ids) → order_code  (para etiquetar el POD)
 *       → dispatch_pods (od_id ∈ od_ids) → foto + firma + receptor
 *
 * Si la cadena se corta en cualquier salto (sin recepciones, sin paquetes en
 * ninguna OD, sin POD), la sección queda vacía (fail-soft, decisión #7).
 */
async function getPodSection(
  supabase: SupabaseClient,
  tenantId: string,
  receiptIds: string[],
): Promise<DefenseSection<DefensePod>> {
  if (receiptIds.length === 0) return section<DefensePod>([]);

  try {
    // Salto 1: paquetes de despacho que referencian estas recepciones CN.
    const { data: pkgs } = await supabase
      .from("dispatch_order_packages")
      .select("od_id, package_id")
      .eq("package_kind", "warehouse_receipt_cn")
      .in("package_id", receiptIds)
      .limit(2000);

    const odIds = [
      ...new Set(
        ((pkgs as Record<string, unknown>[] | null) ?? [])
          .map((p) => String(p.od_id ?? ""))
          .filter(Boolean),
      ),
    ];
    if (odIds.length === 0) return section<DefensePod>([]);

    // Salto 2: order_code de cada OD (para etiquetar el POD). Tenant explícito.
    let orderCodeById = new Map<string, string>();
    try {
      const { data: ods } = await supabase
        .from("dispatch_orders")
        .select("id, order_code")
        .eq("tenant_id", tenantId)
        .in("id", odIds)
        .limit(2000);
      orderCodeById = new Map(
        ((ods as Record<string, unknown>[] | null) ?? []).map((o) => [
          String(o.id),
          String(o.order_code ?? ""),
        ]),
      );
    } catch {
      orderCodeById = new Map();
    }

    // Salto 3: los PODs de esas ODs. Tenant explícito.
    const { data: pods } = await supabase
      .from("dispatch_pods")
      .select(
        "id, od_id, photo_path, signature_path, received_by, received_doc, notes, created_at",
      )
      .eq("tenant_id", tenantId)
      .in("od_id", odIds)
      .order("created_at", { ascending: true })
      .limit(1000);

    const podRows = (pods as Record<string, unknown>[] | null) ?? [];
    if (podRows.length === 0) return section<DefensePod>([]);

    // Firmar fotos + firmas de TODOS los PODs en batch (mismo bucket).
    const photoPaths: string[] = [];
    for (const p of podRows) {
      const photo = String(p.photo_path ?? "");
      const sig = String(p.signature_path ?? "");
      if (photo) photoPaths.push(photo);
      if (sig) photoPaths.push(sig);
    }
    const signed = await signPaths(
      supabase,
      RECEIPT_PHOTOS_BUCKET,
      photoPaths,
    );

    const items: DefensePod[] = podRows.map((p) => {
      const photos: DefensePhoto[] = [];
      const photoPath = String(p.photo_path ?? "");
      const sigPath = String(p.signature_path ?? "");
      if (photoPath) {
        photos.push({ path: photoPath, url: signed[photoPath] ?? "", label: "Foto de entrega" });
      }
      if (sigPath) {
        photos.push({ path: sigPath, url: signed[sigPath] ?? "", label: "Firma" });
      }
      return {
        id: String(p.id),
        orderCode: orderCodeById.get(String(p.od_id)) ?? null,
        receivedBy: String(p.received_by ?? ""),
        receivedDoc: (p.received_doc as string | null) ?? null,
        notes: (p.notes as string | null) ?? null,
        createdAt: String(p.created_at ?? ""),
        photos,
      };
    });

    return section(items);
  } catch {
    return section<DefensePod>([]);
  }
}

// ════════════════════════════════════════════════════════════
// Orquestador
// ════════════════════════════════════════════════════════════

/**
 * Arma el expediente de defensa de un envío por su `code`. Devuelve null si el
 * envío no existe en el tenant (la page lo trata como 404). Cada pieza es
 * fail-soft: una sección vacía no rompe el expediente.
 *
 * Tenant + code se trimean; sin alguno ⇒ null (fail-closed, sin tocar la DB).
 */
export async function getDefenseFile(
  supabase: SupabaseClient,
  args: { tenantId: string; shipmentCode: string },
): Promise<DefenseFile | null> {
  const tenantId = String(args.tenantId ?? "").trim();
  const shipmentCode = String(args.shipmentCode ?? "").trim();
  if (!tenantId || !shipmentCode) return null;

  // Cabecera primero: si el envío no existe en el tenant, no hay expediente.
  const found = await getDefenseShipment(supabase, tenantId, shipmentCode);
  if (!found) return null;

  const { id: shipmentId, header } = found;

  // Recepciones CN se resuelven una vez: las usan tanto las fotos de origen
  // como el join indirecto del POD.
  const origin = await getOriginReceipts(supabase, tenantId, shipmentId);

  const [acceptances, packing, originPhotos, timeline, pod] = await Promise.all([
    getAcceptancesSection(supabase, tenantId, shipmentCode),
    getPackingSection(supabase, tenantId, shipmentId),
    buildOriginSection(supabase, tenantId, origin.receipts),
    getTimelineSection(supabase, tenantId, shipmentId),
    getPodSection(supabase, tenantId, origin.receiptIds),
  ]);

  return {
    shipment: header,
    acceptances,
    packing,
    originPhotos,
    timeline,
    pod,
    generatedAt: new Date().toISOString(),
  };
}
