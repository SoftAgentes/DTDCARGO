/**
 * Tipos del Expediente de defensa legal (SDD-0070 · SDD-E del handoff).
 *
 * El expediente CONSOLIDA en un solo documento la cadena de evidencia de UNA
 * operación (envío), que hoy vive dispersa en 5 módulos:
 *   1. Aceptación de T&C   (legal_acceptances · SDD-0067) — con hash verificado.
 *   2. Packing / compras    (prealertas + prealerta_documents · SDD-0057).
 *   3. Fotos de origen       (warehouse_receipts_cn + warehouse_receipt_photos · SDD-0016).
 *   4. Cronología            (shipment_events · SDD-0002).
 *   5. Prueba de entrega POD (dispatch_pods vía join indirecto · SDD-0029).
 *
 * SDD-E es ORQUESTACIÓN PURA, SIN migración: todo cuelga del código del envío
 * (`shipments.code`). Tipos puros (sin Supabase, sin Zod). El armado de cada
 * pieza + el firmado de URLs vive en `expediente-queries.ts`; el helper
 * `summarizeCompleteness` es PURO y testeable sin DB.
 *
 * `DefenseSection<T>` es el contrato común de las 5 piezas: `present` (¿hay
 * algo que mostrar?) + `items` (lo que hay). Una pieza vacía NO rompe el
 * expediente — se renderiza "Sin registros" (fail-soft, decisión #5 de la spec).
 */

import type { AcceptanceEvidenceExport } from "./queries";

// ── Contrato común de una sección del expediente ──────────────
/**
 * Una de las 5 piezas del expediente. `present === items.length > 0` por
 * construcción (lo garantiza la query), pero se expone explícito para que la UI
 * y `summarizeCompleteness` no tengan que re-derivarlo.
 */
export type DefenseSection<T> = {
  /** ¿Hay al menos un registro de esta pieza? (decide "presente"/"ausente"). */
  present: boolean;
  /** Los registros de la pieza (vacío ⇒ "Sin registros" en la UI). */
  items: T[];
};

// ── Cabecera del envío ────────────────────────────────────────
/** Datos identificatorios del envío que encabezan el expediente. */
export type DefenseShipment = {
  id: string;
  code: string;
  clientName: string | null;
  /** MARKBOX interno (de cara al usuario: "Shipping Mark"). */
  markbox: string | null;
  origin: string | null;
  destination: string | null;
  service: string;
  status: string;
  createdAt: string;
  /** Entrega final (POD a nivel envío · 0009). Puede ser null. */
  deliveredAt: string | null;
  /** Quien firmó el POD a nivel envío (texto). Puede ser null. */
  podSignedBy: string | null;
};

// ── Piezas (items de cada sección) ────────────────────────────

/** Una foto firmada (URL temporal) — usada por origen y POD. */
export type DefensePhoto = {
  /** storage_path (identificador estable, por si la URL expira). */
  path: string;
  /** signed URL (TTL 1h) lista para `<img src>`; "" si no se pudo firmar. */
  url: string;
  /** etiqueta corta (p. ej. "Foto 1", "Firma"). */
  label: string;
};

/**
 * Una recepción de almacén CN del envío + sus fotos firmadas. Es la "pieza" de
 * la sección Fotos de origen: una caja física recibida en el hub chino.
 */
export type DefenseOriginReceipt = {
  receiptId: string;
  receiptCode: string;
  supplierName: string | null;
  boxes: number | null;
  receivedAt: string | null;
  photos: DefensePhoto[];
};

/**
 * Una compra (prealerta) del envío + sus documentos subidos (packing, factura,
 * fotos del producto, captura de WeChat). Es la "pieza" de la sección Packing.
 */
export type DefensePrealerta = {
  id: string;
  code: string;
  description: string;
  boxes: number | null;
  trackingCn: string | null;
  documents: DefensePrealertaDoc[];
};

/** Un documento subido a una prealerta (firmado). */
export type DefensePrealertaDoc = {
  id: string;
  docType: string;
  fileName: string;
  path: string;
  /** signed URL (TTL 1h); "" si no se pudo firmar. */
  url: string;
};

/** Un evento de la cronología del envío (shipment_events). */
export type DefenseEvent = {
  id: string;
  status: string;
  note: string | null;
  occurredAt: string;
};

/**
 * Una prueba de entrega (POD) alcanzada por el join indirecto envío→…→dispatch_pods.
 * El receptor (nombre/cédula) es PII → el expediente es admin-only.
 */
export type DefensePod = {
  id: string;
  orderCode: string | null;
  receivedBy: string;
  receivedDoc: string | null;
  notes: string | null;
  createdAt: string;
  /** foto + firma firmadas (las que existan). */
  photos: DefensePhoto[];
};

// ── El expediente completo ────────────────────────────────────
/**
 * El expediente de defensa de UNA operación: la cabecera del envío + las 5
 * secciones (cada una `present` + `items`). Lo arma `getDefenseFile`.
 */
export type DefenseFile = {
  shipment: DefenseShipment;
  /** 1 · Aceptaciones de T&C (con hash verificado, heredado de 0067). */
  acceptances: DefenseSection<AcceptanceEvidenceExport>;
  /** 2 · Packing / compras (prealertas + sus documentos). */
  packing: DefenseSection<DefensePrealerta>;
  /** 3 · Fotos de origen (recepciones CN + fotos). */
  originPhotos: DefenseSection<DefenseOriginReceipt>;
  /** 4 · Cronología de eventos del envío. */
  timeline: DefenseSection<DefenseEvent>;
  /** 5 · Prueba de entrega (POD). */
  pod: DefenseSection<DefensePod>;
  /** Cuándo se generó el expediente (ISO). */
  generatedAt: string;
};

// ── Índice de completitud (helper PURO) ───────────────────────

/** Claves estables de las 5 piezas (orden de presentación). */
export const DEFENSE_PIECES = [
  "acceptances",
  "packing",
  "originPhotos",
  "timeline",
  "pod",
] as const;

export type DefensePieceKey = (typeof DEFENSE_PIECES)[number];

/** Etiqueta humana de cada pieza para el índice de completitud. */
export const DEFENSE_PIECE_LABEL: Record<DefensePieceKey, string> = {
  acceptances: "Aceptación de términos",
  packing: "Packing y compras",
  originPhotos: "Fotos de origen (almacén CN)",
  timeline: "Cronología de eventos",
  pod: "Prueba de entrega (POD)",
};

export type CompletenessSummary = {
  /** Labels de las piezas PRESENTES. */
  present: string[];
  /** Labels de las piezas AUSENTES. */
  missing: string[];
  /** Cuántas de las 5 piezas están presentes. */
  count: number;
};

/**
 * Resume qué piezas del expediente están presentes y cuáles ausentes — el
 * abogado ve de un vistazo qué prueba existe (decisión #5 de la spec). PURO:
 * no toca DB, solo lee `section.present` de cada pieza → testeable directo.
 *
 * El orden de `present`/`missing` sigue `DEFENSE_PIECES` (presentación estable).
 */
export function summarizeCompleteness(file: DefenseFile): CompletenessSummary {
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of DEFENSE_PIECES) {
    const section = file[key];
    const label = DEFENSE_PIECE_LABEL[key];
    if (section?.present) {
      present.push(label);
    } else {
      missing.push(label);
    }
  }

  return { present, missing, count: present.length };
}
