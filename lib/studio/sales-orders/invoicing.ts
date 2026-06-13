/**
 * Motor de auto-facturación de la Orden de venta (SDD-0072 · Fase 2).
 *
 * La recepción CN con datos REALES (CBM/peso) dispara la Factura (0021) de la OV
 * que cumple la caja recibida — PARCIAL por defecto (1 OV : N facturas), GATED por
 * requisitos (§3.5) e IDEMPOTENTE (nunca doble-facturar la misma caja).
 *
 * Esta capa parte en DOS:
 *  - PURA (testeable sin DB · este archivo): `canAutoInvoice` (elegibilidad/
 *    gating §3.5) + `computeReceiptInvoiceAmount` (monto proporcional al universo
 *    CONGELADO de cajas). El cálculo del monto es el ESPEJO TS documentado de la
 *    RPC `sales_order_claim_and_invoice` (migr 0128) — los tests de Vitest pinean
 *    este espejo; si cambia uno, cambiar el otro. El IVA (total = base + iva) y el
 *    ligado transaccional viven SOLO en la RPC (SQL), no en esta capa pura.
 *  - CON DB (auto-invoice.ts → autoInvoiceForReceipt): valida el gate con los
 *    helpers puros y delega el NÚCLEO FINANCIERO (claim → cálculo → factura →
 *    ligado → status) a la RPC TRANSACCIONAL de 0128 (FOR UPDATE sobre OV +
 *    prealerta: o todo o nada). El asiento 0040 (postInvoiceJournalEntry) queda
 *    app-side best-effort + idempotente por invoice_id — mismo modo de fallo que
 *    la emisión manual de 0021 (NO se duplica el motor contable en SQL).
 *
 * ⚠️ Feature FINANCIERA. Ante la duda, NO factura: cada requisito faltante devuelve
 * un resultado claro y la recepción se confirma igual (best-effort en el hook).
 */

import {
  isAllowedTransition,
  type SalesOrder,
  type SalesOrderStatus,
} from "./types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Gating de elegibilidad (§3.5) — PURO                      ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Cómo se verificó la medida de la recepción (§3.5):
 *  - "packing": packing list del PROVEEDOR adjunto a la caja (prealerta_documents
 *    doc_type='packing' / 'factura').
 *  - "warehouse": medido en el almacén (la recepción trae CBM/peso reales propios).
 *  - "none": ni packing list ni medición → NO verificado → NO factura.
 */
export type VerificationSource = "packing" | "warehouse" | "none";

/**
 * Datos REALES de la recepción que el gate evalúa. Subconjunto acotado de
 * warehouse_receipts_cn para no acoplar este módulo a su tipo completo.
 */
export type ReceiptForInvoicing = {
  /** CBM total medido en el almacén (o copiado del packing list). */
  total_cbm: number | null;
  /** Peso total (kg) medido. */
  total_weight_kg: number | null;
  /** Cajas de esta recepción. */
  boxes: number;
  /** ¿Cómo se verificó la medida? (packing list del proveedor o medido). */
  verification: VerificationSource;
  /** ¿Tiene adjuntos? (packing list / factura / fotos de la caja). */
  hasAttachments: boolean;
  /** ¿Es caja huérfana? (sin cliente / sin compra previa → no factura). */
  isOrphan: boolean;
};

export type AutoInvoiceEligibility =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * ¿La recepción cumple los REQUISITOS para auto-facturar? PURA — testeable sin DB.
 *
 * Reglas (§3.5 · "GATED por requisitos"):
 *  - NO huérfana (una caja sin cliente/compra no se factura a nadie).
 *  - CBM ok: total_cbm presente y > 0 (la facturación marítima/consolidación
 *    cobra por volumen; sin CBM no hay monto real).
 *  - peso ok: total_weight_kg presente y > 0 (verificación cruzada de la medida).
 *  - verificado: packing list del proveedor O medido en warehouse (≠ "none").
 *  - adjuntos: al menos un adjunto (packing/factura/foto) que respalde la medida.
 *
 * Si falta cualquiera → { ok:false, reason:"faltan datos: <qué falta>" }. NUNCA
 * genera factura con datos incompletos. El caller (hook) muestra/registra el reason
 * y deja la recepción confirmada igual (no bloquea).
 */
export function canAutoInvoice(
  receipt: ReceiptForInvoicing,
): AutoInvoiceEligibility {
  if (receipt.isOrphan) {
    return {
      ok: false,
      reason: "faltan datos: caja huérfana (sin cliente asignado).",
    };
  }

  const missing: string[] = [];

  const cbm = Number(receipt.total_cbm);
  if (!Number.isFinite(cbm) || cbm <= 0) missing.push("CBM (volumen)");

  const weight = Number(receipt.total_weight_kg);
  if (!Number.isFinite(weight) || weight <= 0) missing.push("peso");

  if (receipt.verification === "none") {
    missing.push("verificación (packing list del proveedor o medido en almacén)");
  }

  if (!receipt.hasAttachments) missing.push("adjuntos");

  if (missing.length > 0) {
    return { ok: false, reason: `faltan datos: ${missing.join(", ")}.` };
  }

  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Monto real de la factura parcial (§3.5/§3.6) — PURO       ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Calcula el monto a facturar por las cajas recibidas en ESTA recepción. PURA.
 * ESPEJO 1:1 del paso 5 de la RPC `sales_order_claim_and_invoice` (migr 0128) —
 * si cambia esta fórmula, cambiar el SQL (y viceversa).
 *
 * DECISIÓN DE IMPLEMENTACIÓN (documentada para el review):
 * El snapshot de la OV (`total_usd`) cubre TODAS las cajas planeadas. No existe en
 * el repo un motor de tarifa por-recepción reutilizable de forma trivial que
 * recalcule el cobro a partir del CBM/peso reales de UNA caja (el costing 0053 es
 * de COSTOS internos, no de tarifa de venta; la calculadora 0055 cotiza un envío
 * completo, no una caja suelta). Por eso, y siguiendo "§3.5 montos reales · si
 * recalcular es inviable, factura proporcional al snapshot de la OV por las cajas
 * recibidas", el monto es PROPORCIONAL:
 *
 *   monto = total_usd × (cajas_recibidas / total_cajas_OV)
 *
 * Propiedades:
 *  - Al facturar todas las cajas (en N recepciones), la suma == total_usd de la OV
 *    (salvo centavos de redondeo, que se absorben en la ÚLTIMA factura — ver
 *    `isFinal`).
 *  - Si la OV no tiene cajas planeadas (total_boxes 0) cae a facturar las cajas
 *    recibidas / cajas recibidas = el total completo (no se puede prorratear sin
 *    denominador → se factura el snapshot íntegro una sola vez).
 *  - DENOMINADOR CONGELADO (fix C3 del review): `totalBoxes` NO se recalcula en
 *    cada recepción — es el snapshot `sales_orders.invoicing_total_boxes` que la
 *    RPC fija en la 1ª factura. Aunque el universo real de cajas cambie después
 *    (assign/unassign directo, cajas extra), el clamp al restante + el ajuste
 *    `isFinal` garantizan que la SUMA de facturas == total de la OV, nunca más.
 *
 * `isFinal` = esta recepción cubre las últimas cajas pendientes ⇒ el monto se
 * ajusta al RESTANTE (total_usd − ya_facturado) para que la suma cuadre exacto.
 * `alreadyInvoicedUsd` = suma de facturas REALES de la OV (excluye `borrador` y
 * `anulada` — fix 🟡 del review; el filtro vive en la RPC).
 */
export function computeReceiptInvoiceAmount(args: {
  /** total_usd del snapshot de la OV (todas las cajas planeadas). */
  salesOrderTotalUsd: number;
  /** denominador CONGELADO (sales_orders.invoicing_total_boxes; Σ boxes en la 1ª factura). */
  totalBoxes: number;
  /** cajas que cubre ESTA recepción (las prealertas no facturadas que se reclaman). */
  receivedBoxes: number;
  /** USD ya facturado en recepciones previas de esta OV (para el ajuste final). */
  alreadyInvoicedUsd: number;
  /** ¿esta recepción cubre las últimas cajas pendientes de la OV? */
  isFinal: boolean;
}): number {
  const total = Math.max(0, Number(args.salesOrderTotalUsd) || 0);
  const totalBoxes = Math.max(0, Math.trunc(Number(args.totalBoxes) || 0));
  const receivedBoxes = Math.max(0, Math.trunc(Number(args.receivedBoxes) || 0));
  const already = Math.max(0, Number(args.alreadyInvoicedUsd) || 0);

  if (total <= 0 || receivedBoxes <= 0) return 0;

  // La última recepción factura el RESTANTE exacto (absorbe redondeos).
  if (args.isFinal) {
    return round2(Math.max(0, total - already));
  }

  // Sin cajas planeadas (denominador 0): no se puede prorratear → factura el total
  // íntegro una sola vez (caso de OV sin prealertas atadas pero con recepción).
  if (totalBoxes <= 0) {
    return round2(Math.max(0, total - already));
  }

  const share = total * (receivedBoxes / totalBoxes);
  // Nunca facturar más que el restante (guarda contra prorrateos que excedan por
  // redondeo o por cajas recibidas > planeadas).
  return round2(Math.min(share, Math.max(0, total - already)));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Status de la OV tras facturar (§3.6) — PURO               ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Decide el próximo status de la OV tras emitir una factura. PURA.
 *  - todas las cajas facturadas (remaining == 0) ⇒ 'facturada'.
 *  - quedan cajas por facturar ⇒ 'parcial'.
 * Devuelve null si NO se debe cambiar (transición no válida desde el status actual,
 * p.ej. ya 'cerrada'/'cancelada', o no avanza). El caller valida con
 * isAllowedTransition antes de persistir.
 */
export function nextStatusAfterInvoice(args: {
  current: SalesOrderStatus;
  remainingBoxes: number;
}): SalesOrderStatus | null {
  const target: SalesOrderStatus =
    args.remainingBoxes <= 0 ? "facturada" : "parcial";
  if (args.current === target) return null; // ya está ahí, no-op
  if (!isAllowedTransition(args.current, target)) return null;
  return target;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Resultado del motor (lo devuelve la action)              ║
// ╚═══════════════════════════════════════════════════════════╝

export type AutoInvoiceResult =
  | {
      ok: true;
      /** code de la factura generada. */
      invoiceCode: string;
      /** monto facturado (USD). */
      amountUsd: number;
      /** nuevo status de la OV tras facturar (si cambió). */
      salesOrderStatus?: SalesOrderStatus;
    }
  | {
      ok: false;
      /** motivo legible ("faltan datos: …", "ya facturada", "sin OV", …). */
      reason: string;
      /** true si el motivo es "no aplica" (sin OV, sin caja) — no es un error. */
      notApplicable?: boolean;
    };

/** ¿La OV admite facturación? (no terminal, no cancelada). PURA. */
export function salesOrderAcceptsInvoicing(
  so: Pick<SalesOrder, "status">,
): boolean {
  return so.status !== "cerrada" && so.status !== "cancelada";
}
