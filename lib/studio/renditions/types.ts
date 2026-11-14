/**
 * Tipos + validación de la Rendición quincenal a la Operadora (SDD-0069).
 * Matchea schema de supabase/migrations/0123_rendiciones.sql.
 *
 * La rendición es un SNAPSHOT inmutable (decisión #5): se emite con los totales
 * CONGELADOS y los recibos incluidos pasan a `rendido`. Acá viven los types de
 * fila (`Rendition`, `RenditionReceipt`), el preview calculado en vivo
 * (`RenditionPreview`, NO persistido) y el validador del input de emisión.
 *
 * PURO (sin Zod, sin Supabase): testeable sin DB. La regla absoluta del mandato
 * (handoff §1) — "la Operadora" nunca "Canopy", cero "DoorTuDoor Trading" /
 * J-50220185 — se respeta en TODO label/leyenda de cara al usuario.
 */

import type { PaymentReceipt } from "../payment-types";

// ── Estado de la rendición ────────────────────────────────────

/** Estado de una rendición. `emitida` (vigente) | `anulada` (revertida). */
export type RenditionStatus = "emitida" | "anulada";

export const RENDITION_STATUSES: RenditionStatus[] = ["emitida", "anulada"];

export const RENDITION_STATUS_META: Record<
  RenditionStatus,
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  emitida: { label: "Emitida", tone: "success" },
  anulada: { label: "Anulada", tone: "danger" },
};

export function renditionStatusLabel(status: string): string {
  return RENDITION_STATUS_META[status as RenditionStatus]?.label ?? status;
}

export function renditionStatusTone(
  status: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return RENDITION_STATUS_META[status as RenditionStatus]?.tone ?? "neutral";
}

// ── Filas persistidas ─────────────────────────────────────────

/** Una rendición persistida (fila de `renditions`). */
export type Rendition = {
  id: string;
  tenant_id: string;
  rendition_code: string;
  period_from: string; // YYYY-MM-DD inclusive
  period_to: string; // YYYY-MM-DD inclusive
  /** Recaudado de terceros (flete internacional), USD — base CAJA. */
  third_party_usd: number;
  /** Servicios locales facturados por DTD Services, USD — base DEVENGADO. */
  local_revenue_usd: number;
  /** Saldo a favor de la Operadora = terceros − local, USD. */
  net_to_operadora_usd: number;
  receipt_count: number;
  status: RenditionStatus;
  void_reason: string | null;
  created_by: string | null;
  emitted_at: string;
  created_at: string;
};

/** Una fila del puente rendición↔recibo (`rendition_receipts`). */
export type RenditionReceipt = {
  id: string;
  tenant_id: string;
  rendition_id: string;
  receipt_id: string;
  amount_usd: number;
  rendition_voided: boolean;
  created_at: string;
};

// ── Preview (calculado en vivo, NO persistido) ────────────────

/**
 * Una línea de detalle del preview/rendición: un recibo elegible normalizado a
 * USD. "Por cliente y referencia" del handoff (Shipping Mark + ref. de envío).
 */
export type RenditionLine = {
  receiptId: string;
  receiptCode: string;
  clientName: string | null;
  /** Shipping Mark (markbox interno) del cliente. */
  clientMarkbox: string | null;
  /** Ref. del envío (invoice_code; el detalle "por referencia"). null si no hay. */
  reference: string | null;
  amount: number;
  currency: string;
  amountUsd: number;
  receivedAt: string; // YYYY-MM-DD
};

/**
 * SDD-0572: la línea de la PREVIA. Un cobro sin tasa lleva `amountUsd` null: no
 * suma y la rendición no se emite así, de modo que una rendición emitida (su
 * `RenditionLine`) siempre tiene el monto en USD.
 */
export type RenditionPreviewLine = Omit<RenditionLine, "amountUsd"> & {
  amountUsd: number | null;
};

/**
 * Preview de una rendición ANTES de emitir (decisión #5): los 3 totales con su
 * base + la lista de recibos elegibles. Calculado en vivo (no se guarda hasta
 * que María pulsa "Emitir"). Cada total declara SU base (el handoff mezcla
 * "recaudado" y "facturado" a propósito; acá es explícito).
 */
export type RenditionPreview = {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  /** Recaudado de terceros en el período (CAJA: third_party cobrado), USD. */
  thirdPartyUsd: number;
  /** Servicios locales facturados (DEVENGADO: local_revenue emitido), USD. */
  localRevenueInvoicedUsd: number;
  /** Saldo a favor de la Operadora = terceros − local facturado, USD. */
  netToOperadoraUsd: number;
  /** Cantidad de recibos elegibles. */
  receiptCount: number;
  /** SDD-0572: recibos sin tasa y facturas locales sin tasa del período. */
  recibosSinTasa?: number;
  facturasLocalesSinTasa?: number;
  /** Detalle: un row por recibo elegible (third_party + aplicado + en rango). */
  lines: RenditionPreviewLine[];
};

// ── Helpers de elegibilidad (PUROS) ───────────────────────────

const round2 = (n: number): number =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * ¿Un recibo entra en la rendición del período? (decisión #2). PURA —
 * testeable sin DB:
 *  - `fund_class === 'third_party'` (no se rinde el ingreso local).
 *  - `application_status === 'aplicado'` (identificado/aplicado; un sin-ref NO
 *    se rinde — no se rinde lo no identificado; un `rendido` ya salió → no
 *    reaparece).
 *  - `received_at` dentro de [from, to] inclusive.
 *
 * No filtra `deleted_at` (los anulados ya se excluyen en la query — RLS/where).
 */
export function isReceiptEligible(
  receipt: Pick<
    PaymentReceipt,
    "fund_class" | "application_status" | "received_at"
  >,
  range: { from: string; to: string },
): boolean {
  if (receipt.fund_class !== "third_party") return false;
  if (receipt.application_status !== "aplicado") return false;
  const d = String(receipt.received_at);
  return d >= range.from && d <= range.to;
}

/** Computa el neto a favor de la Operadora = terceros − local. PURA. */
export function netToOperadora(
  thirdPartyUsd: number,
  localRevenueUsd: number,
): number {
  return round2(Number(thirdPartyUsd) - Number(localRevenueUsd));
}

// ── Input + validación de la emisión ──────────────────────────

/** Lo que se envía al emitir una rendición: el rango quincenal. */
export type RenditionEmitInput = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
};

export type RenditionActionState = {
  ok?: boolean;
  error?: string;
  /** rendition_code generado, para trazabilidad/toast. */
  renditionCode?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validación manual del input de emisión (sin Zod):
 *  - from/to con formato YYYY-MM-DD.
 *  - from ≤ to (rango válido, no vacío/invertido).
 *
 * El re-check de elegibilidad (que HAYA recibos) lo hace la action server-side
 * (lee la DB); acá solo se valida la forma del rango. PURA.
 */
export function validateRenditionEmitInput(
  raw: Partial<RenditionEmitInput>,
): { input?: RenditionEmitInput; error?: string } {
  const from = String(raw.from ?? "").trim();
  const to = String(raw.to ?? "").trim();

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return { error: "Rango de fechas inválido (YYYY-MM-DD)." };
  }
  if (from > to) {
    return { error: "El inicio del período no puede ser posterior al fin." };
  }

  return { input: { from, to } };
}
