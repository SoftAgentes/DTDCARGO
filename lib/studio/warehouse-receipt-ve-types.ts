/**
 * Tipos del módulo Recepción VE (Sprint E · plan v3).
 * Matchea supabase/migrations/0067_warehouse_receipts_ve.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums + tipos DB
// ─────────────────────────────────────────────────────────────

export type WarehouseReceiptVeStatus =
  | "en_muelle"
  | "recibiendo"
  | "sellado"
  | "con_incidencia";

export type WarehouseReceiptVe = {
  id: string;
  tenant_id: string;
  receipt_code: string;
  container_code: string | null;
  vessel: string | null;
  port: string | null;
  eta: string | null; // ISO date
  expected_cbm: number | null;
  expected_boxes: number;
  status: WarehouseReceiptVeStatus;
  received_by_operario_id: string | null;
  sealed_by_operario_id: string | null;
  started_at: string | null;
  sealed_at: string | null;
  notes: string | null;
  incident_note: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WarehouseReceiptVeBox = {
  id: string;
  tenant_id: string;
  receipt_id: string;
  code: string;
  markbox: string | null;
  client_name: string | null;
  cbm: number | null;
  weight_kg: number | null;
  source_receipt_cn_id: string | null;
  scanned_at: string | null;
  scanned_by_operario_id: string | null;
  scanned_manual: boolean;
  created_at: string;
};

/** Row + cajas para la pantalla de scan. */
export type WarehouseReceiptVeWithBoxes = WarehouseReceiptVe & {
  boxes: WarehouseReceiptVeBox[];
  scanned_count: number;
  expected_count: number;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const RECEIPT_VE_STATUS_LABELS: Record<WarehouseReceiptVeStatus, string> = {
  en_muelle: "En muelle",
  recibiendo: "Recibiendo",
  sellado: "Sellado",
  con_incidencia: "Con incidencia",
};

export const RECEIPT_VE_STATUS_TONES: Record<WarehouseReceiptVeStatus, BadgeTone> = {
  en_muelle: "info",
  recibiendo: "warning",
  sellado: "success",
  con_incidencia: "danger",
};

// ─────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────

/** Acepta DTDU-* o cualquier código alfanumérico de 4+ chars. */
export function isValidBoxCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 4) return false;
  // Whitelist: letras, números, dash, underscore, dot
  return /^[A-Za-z0-9\-_.]+$/.test(trimmed);
}

// ─────────────────────────────────────────────────────────────
// Action state shapes
// ─────────────────────────────────────────────────────────────

export type ScanBoxActionState = {
  ok?: boolean;
  error?: string;
  /** Eco del code para el toast / animation. */
  scannedCode?: string;
  scannedCount?: number;
  expectedCount?: number;
};

export type SealReceiptActionState = {
  ok?: boolean;
  error?: string;
  scannedCount?: number;
  expectedCount?: number;
  resultingStatus?: WarehouseReceiptVeStatus;
};

export type CreateReceiptVeActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  receiptId?: string;
  receiptCode?: string;
};

// ─────────────────────────────────────────────────────────────
// Progress helpers
// ─────────────────────────────────────────────────────────────

export function computeReceiptProgress(boxes: WarehouseReceiptVeBox[]): {
  scanned: number;
  expected: number;
  pct: number;
  scannedCbm: number;
} {
  const expected = boxes.length;
  let scanned = 0;
  let scannedCbm = 0;
  for (const b of boxes) {
    if (b.scanned_at) {
      scanned += 1;
      scannedCbm += Number(b.cbm ?? 0);
    }
  }
  return {
    scanned,
    expected,
    pct: expected === 0 ? 0 : Math.round((scanned / expected) * 100),
    scannedCbm,
  };
}

/** Agrupa cajas por markbox (cliente). Las que tienen markbox null caen a "Sin cliente". */
export type BoxesByClient = {
  markbox: string;
  client_name: string;
  boxes: WarehouseReceiptVeBox[];
  scannedCount: number;
};

export function groupBoxesByClient(boxes: WarehouseReceiptVeBox[]): BoxesByClient[] {
  const map = new Map<string, BoxesByClient>();
  for (const b of boxes) {
    const key = b.markbox ?? "__sin__";
    let entry = map.get(key);
    if (!entry) {
      entry = {
        markbox: b.markbox ?? "Sin cliente",
        client_name: b.client_name ?? "—",
        boxes: [],
        scannedCount: 0,
      };
      map.set(key, entry);
    }
    entry.boxes.push(b);
    if (b.scanned_at) entry.scannedCount += 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.markbox.localeCompare(b.markbox),
  );
}
