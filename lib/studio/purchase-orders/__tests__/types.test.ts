/**
 * Tests del módulo Órdenes de compra (SDD-0071) — capa pura.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec:
 *  - validatePurchaseOrderInput: exige proveedor (ficha o libre) + ≥1 ítem válido;
 *    rechaza qty≤0 / costo<0; descarta filas vacías.
 *  - computeTotalCost / itemLineTotal: suma de ítems = total_cost_usd.
 *  - status lifecycle: canTransition (grafo), isTerminalStatus, canReceive.
 *  - buildBillPayloadFromPo: mapeo OC→Bill (reference=código OC, total, supplier).
 *  - formato del código OC-YYYY-NNNN.
 */

import { describe, it, expect } from "vitest";
import {
  buildBillPayloadFromPo,
  canReceive,
  canTransition,
  computeTotalCost,
  formatPurchaseOrderCode,
  isPurchaseOrderStatus,
  isTerminalStatus,
  itemLineTotal,
  PURCHASE_ORDER_CODE_RE,
  PURCHASE_ORDER_STATUSES,
  purchaseOrderStatusLabel,
  purchaseOrderStatusTone,
  validatePurchaseOrderInput,
} from "../types";

// ── validatePurchaseOrderInput ─────────────────────────────────

describe("validatePurchaseOrderInput", () => {
  const validItem = { description: "Cajas de zapatos", qty: 10, unitCostUsd: 5 };

  it("acepta una OC con proveedor de ficha + 1 ítem válido", () => {
    const { input, fieldErrors } = validatePurchaseOrderInput({
      supplierId: "sc-1",
      items: [validItem],
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.supplierId).toBe("sc-1");
    expect(input?.supplierName).toBeNull();
    expect(input?.items).toHaveLength(1);
  });

  it("acepta proveedor por nombre libre", () => {
    const { input, fieldErrors } = validatePurchaseOrderInput({
      supplierName: "  Yiwu Trading Co.  ",
      items: [validItem],
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.supplierName).toBe("Yiwu Trading Co.");
    expect(input?.supplierId).toBeNull();
  });

  it("rechaza si no hay proveedor (ni ficha ni nombre)", () => {
    const { input, fieldErrors } = validatePurchaseOrderInput({
      items: [validItem],
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.supplierName).toBeTruthy();
  });

  it("rechaza si no hay ningún ítem con descripción", () => {
    const { fieldErrors } = validatePurchaseOrderInput({
      supplierName: "X",
      items: [{ description: "", qty: 1, unitCostUsd: 0 }],
    });
    expect(fieldErrors?.items).toBeTruthy();
  });

  it("descarta filas vacías pero conserva las válidas", () => {
    const { input } = validatePurchaseOrderInput({
      supplierName: "X",
      items: [
        { description: "", qty: 1, unitCostUsd: 1 },
        validItem,
        { description: "  ", qty: 2, unitCostUsd: 2 },
      ],
    });
    expect(input?.items).toHaveLength(1);
    expect(input?.items[0].description).toBe("Cajas de zapatos");
  });

  it("rechaza qty ≤ 0 y costo < 0", () => {
    const r1 = validatePurchaseOrderInput({
      supplierName: "X",
      items: [{ description: "A", qty: 0, unitCostUsd: 1 }],
    });
    expect(r1.fieldErrors?.items).toBeTruthy();

    const r2 = validatePurchaseOrderInput({
      supplierName: "X",
      items: [{ description: "A", qty: 1, unitCostUsd: -5 }],
    });
    expect(r2.fieldErrors?.items).toBeTruthy();
  });

  it("acepta costo unitario 0 (mercancía sin precio aún)", () => {
    const { input, fieldErrors } = validatePurchaseOrderInput({
      supplierName: "X",
      items: [{ description: "A", qty: 3, unitCostUsd: 0 }],
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.items[0].unitCostUsd).toBe(0);
  });

  it("normaliza campos opcionales a null", () => {
    const { input } = validatePurchaseOrderInput({
      supplierName: "X",
      clientMarkbox: "  ",
      salesOrderId: "",
      notes: "   ",
      items: [validItem],
    });
    expect(input?.clientMarkbox).toBeNull();
    expect(input?.salesOrderId).toBeNull();
    expect(input?.notes).toBeNull();
  });
});

// ── cálculo de total ───────────────────────────────────────────

describe("itemLineTotal / computeTotalCost", () => {
  it("línea = qty * unit_cost_usd, no negativa, redondeada", () => {
    expect(itemLineTotal({ qty: 10, unit_cost_usd: 5 })).toBe(50);
    expect(itemLineTotal({ qty: 3, unit_cost_usd: 2.555 })).toBe(7.67);
    expect(itemLineTotal({ qty: -1, unit_cost_usd: 5 })).toBe(0);
  });

  it("total = suma de ítems redondeada a 2", () => {
    const total = computeTotalCost([
      { qty: 10, unit_cost_usd: 5 }, // 50
      { qty: 2, unit_cost_usd: 12.5 }, // 25
      { qty: 1, unit_cost_usd: 0 }, // 0
    ]);
    expect(total).toBe(75);
  });

  it("total de OC vacía = 0", () => {
    expect(computeTotalCost([])).toBe(0);
  });
});

// ── status lifecycle ───────────────────────────────────────────

describe("status lifecycle", () => {
  it("el enum tiene los 6 estados del spec", () => {
    expect(PURCHASE_ORDER_STATUSES).toEqual([
      "borrador",
      "confirmada",
      "recibida",
      "facturada",
      "cerrada",
      "cancelada",
    ]);
  });

  it("isPurchaseOrderStatus discrimina", () => {
    expect(isPurchaseOrderStatus("borrador")).toBe(true);
    expect(isPurchaseOrderStatus("inventado")).toBe(false);
    expect(isPurchaseOrderStatus(42)).toBe(false);
  });

  it("transiciones manuales permitidas", () => {
    expect(canTransition("borrador", "confirmada")).toBe(true);
    expect(canTransition("borrador", "cancelada")).toBe(true);
    expect(canTransition("confirmada", "recibida")).toBe(true);
    expect(canTransition("recibida", "cerrada")).toBe(true);
    expect(canTransition("facturada", "cerrada")).toBe(true);
  });

  it("transiciones prohibidas (saltos / hacia atrás / desde terminal)", () => {
    expect(canTransition("borrador", "recibida")).toBe(false); // salto
    expect(canTransition("borrador", "facturada")).toBe(false); // facturada la pone el motor
    expect(canTransition("recibida", "facturada")).toBe(false); // idem
    expect(canTransition("confirmada", "borrador")).toBe(false); // hacia atrás
    expect(canTransition("cerrada", "confirmada")).toBe(false); // desde terminal
    expect(canTransition("cancelada", "confirmada")).toBe(false);
  });

  it("estados terminales", () => {
    expect(isTerminalStatus("cerrada")).toBe(true);
    expect(isTerminalStatus("cancelada")).toBe(true);
    expect(isTerminalStatus("borrador")).toBe(false);
  });

  it("canReceive: confirmada/recibida sin Bill", () => {
    expect(canReceive({ status: "confirmada", bill_id: null })).toBe(true);
    expect(canReceive({ status: "recibida", bill_id: null })).toBe(true);
    expect(canReceive({ status: "borrador", bill_id: null })).toBe(false);
    expect(canReceive({ status: "confirmada", bill_id: "b-1" })).toBe(false); // ya tiene Bill
    expect(canReceive({ status: "facturada", bill_id: "b-1" })).toBe(false);
  });

  it("labels y tones existen para cada estado", () => {
    for (const s of PURCHASE_ORDER_STATUSES) {
      expect(purchaseOrderStatusLabel(s)).toBeTruthy();
      expect(purchaseOrderStatusTone(s)).toBeTruthy();
    }
  });
});

// ── mapeo OC → Bill ────────────────────────────────────────────

describe("buildBillPayloadFromPo", () => {
  it("arma el Bill con total de la compra, reference = código, proveedor de Tesorería", () => {
    const payload = buildBillPayloadFromPo({
      po: { purchase_order_code: "CA0007", total_cost_usd: 1234.5 },
      tesorerySupplierId: "prv-9",
      expenseAccountId: "acc-5.1",
      issueDate: "2026-06-07",
    });
    expect(payload.supplierId).toBe("prv-9");
    expect(payload.expenseAccountId).toBe("acc-5.1");
    expect(payload.totalAmount).toBe(1234.5);
    expect(payload.currency).toBe("USD");
    expect(payload.fxRate).toBeNull();
    expect(payload.reference).toBe("CA0007"); // trazabilidad Bill ← compra
    expect(payload.shipmentId).toBeNull();
    expect(payload.concept).toContain("CA0007");
  });

  it("dueDate por default = issueDate (recibido = exigible)", () => {
    const payload = buildBillPayloadFromPo({
      po: { purchase_order_code: "CA0001", total_cost_usd: 100 },
      tesorerySupplierId: "prv-1",
      expenseAccountId: "acc",
      issueDate: "2026-01-15",
    });
    expect(payload.issueDate).toBe("2026-01-15");
    expect(payload.dueDate).toBe("2026-01-15");
  });

  it("dueDate explícito se respeta", () => {
    const payload = buildBillPayloadFromPo({
      po: { purchase_order_code: "CA0001", total_cost_usd: 100 },
      tesorerySupplierId: "prv-1",
      expenseAccountId: "acc",
      issueDate: "2026-01-15",
      dueDate: "2026-02-15",
    });
    expect(payload.dueDate).toBe("2026-02-15");
  });

  it("redondea el total a 2 decimales", () => {
    const payload = buildBillPayloadFromPo({
      po: { purchase_order_code: "CA0001", total_cost_usd: 99.999 },
      tesorerySupplierId: "prv-1",
      expenseAccountId: "acc",
    });
    expect(payload.totalAmount).toBe(100);
  });
});

// ── código ─────────────────────────────────────────────────────

describe("formatPurchaseOrderCode", () => {
  it("formato CANNNN con padding 4, sin año ni guiones (migr 0208)", () => {
    expect(formatPurchaseOrderCode(1)).toBe("CA0001");
    expect(formatPurchaseOrderCode(42)).toBe("CA0042");
    expect(formatPurchaseOrderCode(12345)).toBe("CA12345");
  });

  it("matchea el patrón PURCHASE_ORDER_CODE_RE", () => {
    expect(PURCHASE_ORDER_CODE_RE.test("CA0001")).toBe(true);
    expect(PURCHASE_ORDER_CODE_RE.test("CA1")).toBe(false); // sin padding
    expect(PURCHASE_ORDER_CODE_RE.test("OC-2026-0001")).toBe(false); // formato legacy
    expect(PURCHASE_ORDER_CODE_RE.test("EST-2026-0001")).toBe(false);
  });
});
