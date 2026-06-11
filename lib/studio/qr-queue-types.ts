/**
 * Tipos + labels + validators del módulo Cola de QR (SDD-0033).
 * Matchea supabase/migrations/0027_qr_print_orders.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type QrOrderStatus =
  | "pendiente"
  | "imprimiendo"
  | "impreso"
  | "entregado"
  | "cancelado";

export type QrOrderPriority = "urgent" | "normal";

// ─────────────────────────────────────────────────────────────
// Row type
// ─────────────────────────────────────────────────────────────

export type QrOrder = {
  id: string;
  tenant_id: string;
  order_code: string;
  warehouse_id: string | null;
  markbox: string;
  client_name: string;
  supplier_name: string | null;
  bultos: number;
  sent_by_operario_id: string | null;
  sent_by_name: string;
  sent_by_phone: string | null;
  sent_at: string;
  priority: QrOrderPriority;
  status: QrOrderStatus;
  assigned_printer: string | null;
  printed_at: string | null;
  printed_by: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const QR_STATUS_LABELS: Record<QrOrderStatus, string> = {
  pendiente: "Pendiente",
  imprimiendo: "Imprimiendo",
  impreso: "Impreso",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const QR_STATUS_TONES: Record<QrOrderStatus, BadgeTone> = {
  pendiente: "warning",
  imprimiendo: "info",
  impreso: "success",
  entregado: "neutral",
  cancelado: "danger",
};

export const QR_PRIORITY_LABELS: Record<QrOrderPriority, string> = {
  urgent: "Urgente",
  normal: "Normal",
};

export const QR_PRIORITY_TONES: Record<QrOrderPriority, BadgeTone> = {
  urgent: "wine",
  normal: "neutral",
};

// ─────────────────────────────────────────────────────────────
// Catálogo mock de impresoras (V1 · sin tabla printers)
// ─────────────────────────────────────────────────────────────

export type PrinterOption = {
  id: string;
  label: string;
  online: boolean;
  type: "A4" | "Térmica";
};

export const MOCK_PRINTERS: PrinterOption[] = [
  { id: "hp-lj-2", label: "HP LaserJet · Oficina 2", online: true, type: "A4" },
  { id: "zebra-zt-1", label: "Zebra ZT411 · Oficina 1", online: true, type: "Térmica" },
  { id: "zebra-zt-2", label: "Zebra ZT411 · Almacén", online: false, type: "Térmica" },
];

// ─────────────────────────────────────────────────────────────
// Action state + validators
// ─────────────────────────────────────────────────────────────

export type QrQueueActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  updatedCount?: number;
};

export type BatchPrintInput = {
  ids: string[];
  printer_label: string;
};

export function validateBatchPrintInput(
  input: Partial<BatchPrintInput>,
): { input?: BatchPrintInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const ids = (input.ids ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (ids.length === 0) errors.ids = "Selecciona al menos 1 orden.";
  const printer = input.printer_label?.trim();
  if (!printer) errors.printer_label = "Indicá la impresora.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return { input: { ids, printer_label: printer! } };
}

export type CancelQrOrderInput = {
  id: string;
  reason: string;
};

export function validateCancelQrOrderInput(
  input: Partial<CancelQrOrderInput>,
): { input?: CancelQrOrderInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const id = input.id?.trim();
  if (!id) errors.id = "Falta el ID de la orden.";
  const reason = input.reason?.trim();
  if (!reason) errors.reason = "El motivo es obligatorio.";
  if (reason && reason.length < 4) errors.reason = "Motivo muy corto.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return { input: { id: id!, reason: reason! } };
}

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

export type QrQueueTab = "cola" | "historial";

export type QrQueueFilters = {
  tab: QrQueueTab;
  warehouse?: string;
  priority?: QrOrderPriority | "all";
  search?: string;
};

export function parseQrQueueFilters(
  raw: Record<string, string | string[] | undefined>,
): QrQueueFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const tabRaw = single("tab");
  const priRaw = single("priority");
  return {
    tab: tabRaw === "historial" ? "historial" : "cola",
    warehouse: single("warehouse"),
    priority:
      priRaw === "urgent" || priRaw === "normal" ? (priRaw as QrOrderPriority) : "all",
    search: single("q"),
  };
}
