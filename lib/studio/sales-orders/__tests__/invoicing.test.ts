/**
 * Tests del motor de auto-facturación de la OV (SDD-0072 · Fase 2 · capa pura).
 *
 * Cubre los criterios de aceptación de la sección 6 (Fase 2) del spec:
 *  - canAutoInvoice: GATING (§3.5) — cada requisito faltante NO factura.
 *  - computeReceiptInvoiceAmount: monto parcial proporcional al snapshot por cajas
 *    + ajuste final exacto + sin denominador.
 *  - nextStatusAfterInvoice: parcial (quedan cajas) / facturada (todas) vía grafo.
 *  - salesOrderAcceptsInvoicing: bloquea OV terminal/cancelada.
 *
 * Idempotencia y montos REALES se prueban acá sin DB (helpers puros). El guard
 * anti-race con la columna prealertas.invoice_id vive en la action (testeada por la
 * lógica de elegibilidad/monto + revisión).
 */

import { describe, it, expect } from "vitest";
import {
  canAutoInvoice,
  computeReceiptInvoiceAmount,
  nextStatusAfterInvoice,
  salesOrderAcceptsInvoicing,
  type ReceiptForInvoicing,
} from "../invoicing";

// ── canAutoInvoice (GATING §3.5) ───────────────────────────────

describe("canAutoInvoice", () => {
  const ok: ReceiptForInvoicing = {
    total_cbm: 2.4,
    total_weight_kg: 180,
    boxes: 6,
    verification: "warehouse",
    hasAttachments: true,
    isOrphan: false,
  };

  it("factura cuando CBM + peso + verificación + adjuntos están completos", () => {
    const r = canAutoInvoice(ok);
    expect(r.ok).toBe(true);
  });

  it("acepta verificación por packing list del proveedor", () => {
    const r = canAutoInvoice({ ...ok, verification: "packing" });
    expect(r.ok).toBe(true);
  });

  it("NO factura caja huérfana", () => {
    const r = canAutoInvoice({ ...ok, isOrphan: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/hu[eé]rfana/i);
  });

  it("NO factura sin CBM (null o 0)", () => {
    const r1 = canAutoInvoice({ ...ok, total_cbm: null });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/CBM/);
    const r2 = canAutoInvoice({ ...ok, total_cbm: 0 });
    expect(r2.ok).toBe(false);
  });

  it("NO factura sin peso (null o 0)", () => {
    const r = canAutoInvoice({ ...ok, total_weight_kg: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/peso/);
  });

  it("NO factura sin verificación (none)", () => {
    const r = canAutoInvoice({ ...ok, verification: "none" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/verificaci[oó]n/i);
  });

  it("NO factura sin adjuntos", () => {
    const r = canAutoInvoice({ ...ok, hasAttachments: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/adjuntos/);
  });

  it("acumula TODOS los requisitos faltantes en el reason", () => {
    const r = canAutoInvoice({
      total_cbm: null,
      total_weight_kg: null,
      boxes: 0,
      verification: "none",
      hasAttachments: false,
      isOrphan: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/CBM/);
      expect(r.reason).toMatch(/peso/);
      expect(r.reason).toMatch(/verificaci[oó]n/i);
      expect(r.reason).toMatch(/adjuntos/);
    }
  });

  it("el reason siempre empieza con 'faltan datos:'", () => {
    const r = canAutoInvoice({ ...ok, total_cbm: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.startsWith("faltan datos:")).toBe(true);
  });
});

// ── computeReceiptInvoiceAmount (monto real parcial §3.5/§3.6) ──

describe("computeReceiptInvoiceAmount", () => {
  it("prorratea por cajas recibidas / total cajas de la OV", () => {
    // 6 de 10 cajas de una OV de $1000 → $600.
    const amount = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: 1000,
      totalBoxes: 10,
      receivedBoxes: 6,
      alreadyInvoicedUsd: 0,
      isFinal: false,
    });
    expect(amount).toBe(600);
  });

  it("la recepción FINAL factura el restante exacto (absorbe redondeo)", () => {
    // OV de $1000, 3 cajas (prorrateo 1/3 = 333.33 c/u). Ya facturadas 2 cajas
    // ($666.66). La 3ra (final) factura 1000 - 666.66 = 333.34, no 333.33.
    const amount = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: 1000,
      totalBoxes: 3,
      receivedBoxes: 1,
      alreadyInvoicedUsd: 666.66,
      isFinal: true,
    });
    expect(amount).toBe(333.34);
  });

  it("la suma de parciales + final == total de la OV (cuadre exacto)", () => {
    const total = 1000;
    const totalBoxes = 3;
    // caja 1 (parcial)
    const a1 = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: total,
      totalBoxes,
      receivedBoxes: 1,
      alreadyInvoicedUsd: 0,
      isFinal: false,
    });
    // caja 2 (parcial)
    const a2 = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: total,
      totalBoxes,
      receivedBoxes: 1,
      alreadyInvoicedUsd: a1,
      isFinal: false,
    });
    // caja 3 (final)
    const a3 = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: total,
      totalBoxes,
      receivedBoxes: 1,
      alreadyInvoicedUsd: a1 + a2,
      isFinal: true,
    });
    expect(Math.round((a1 + a2 + a3) * 100) / 100).toBe(total);
  });

  it("sin cajas planeadas (denominador 0) factura el restante íntegro", () => {
    const amount = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: 800,
      totalBoxes: 0,
      receivedBoxes: 4,
      alreadyInvoicedUsd: 0,
      isFinal: false,
    });
    expect(amount).toBe(800);
  });

  it("nunca factura más que el restante (clamp por redondeo / sobre-recepción)", () => {
    // OV $1000, 10 cajas planeadas, pero llegan 12 (sobre-recepción) → clamp a 1000.
    const amount = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: 1000,
      totalBoxes: 10,
      receivedBoxes: 12,
      alreadyInvoicedUsd: 0,
      isFinal: false,
    });
    expect(amount).toBe(1000);
  });

  it("monto 0 si la OV no tiene total o no hay cajas recibidas", () => {
    expect(
      computeReceiptInvoiceAmount({
        salesOrderTotalUsd: 0,
        totalBoxes: 5,
        receivedBoxes: 2,
        alreadyInvoicedUsd: 0,
        isFinal: false,
      }),
    ).toBe(0);
    expect(
      computeReceiptInvoiceAmount({
        salesOrderTotalUsd: 1000,
        totalBoxes: 5,
        receivedBoxes: 0,
        alreadyInvoicedUsd: 0,
        isFinal: false,
      }),
    ).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    // 1/3 de $100 = 33.333… → 33.33
    const amount = computeReceiptInvoiceAmount({
      salesOrderTotalUsd: 100,
      totalBoxes: 3,
      receivedBoxes: 1,
      alreadyInvoicedUsd: 0,
      isFinal: false,
    });
    expect(amount).toBe(33.33);
  });
});

// ── nextStatusAfterInvoice (status §3.6) ───────────────────────

describe("nextStatusAfterInvoice", () => {
  it("quedan cajas → 'parcial'", () => {
    expect(
      nextStatusAfterInvoice({ current: "confirmada", remainingBoxes: 4 }),
    ).toBe("parcial");
  });

  it("todas las cajas facturadas → 'facturada'", () => {
    expect(
      nextStatusAfterInvoice({ current: "confirmada", remainingBoxes: 0 }),
    ).toBe("facturada");
    // desde parcial → facturada (segunda/última factura)
    expect(
      nextStatusAfterInvoice({ current: "parcial", remainingBoxes: 0 }),
    ).toBe("facturada");
  });

  it("no-op si ya está en el status destino", () => {
    expect(
      nextStatusAfterInvoice({ current: "parcial", remainingBoxes: 4 }),
    ).toBeNull();
    expect(
      nextStatusAfterInvoice({ current: "facturada", remainingBoxes: 0 }),
    ).toBeNull();
  });

  it("no cambia desde estados terminales (cerrada/cancelada)", () => {
    expect(
      nextStatusAfterInvoice({ current: "cerrada", remainingBoxes: 0 }),
    ).toBeNull();
    expect(
      nextStatusAfterInvoice({ current: "cancelada", remainingBoxes: 4 }),
    ).toBeNull();
  });
});

// ── salesOrderAcceptsInvoicing ─────────────────────────────────

describe("salesOrderAcceptsInvoicing", () => {
  it("acepta facturar OV confirmada/parcial/facturada", () => {
    expect(salesOrderAcceptsInvoicing({ status: "confirmada" })).toBe(true);
    expect(salesOrderAcceptsInvoicing({ status: "parcial" })).toBe(true);
    expect(salesOrderAcceptsInvoicing({ status: "facturada" })).toBe(true);
  });

  it("rechaza OV cerrada o cancelada", () => {
    expect(salesOrderAcceptsInvoicing({ status: "cerrada" })).toBe(false);
    expect(salesOrderAcceptsInvoicing({ status: "cancelada" })).toBe(false);
  });
});
