// @vitest-environment node
/**
 * Tests de los helpers puros de Libros ASENTADOS (SDD-0104 · Slice A · books-types).
 *
 * Cubre Acceptance §4.3:
 *  - salesRowToEntry / purchaseRowToEntry mapean al payload EXACTO de la RPC
 *    (15 keys), preservando la clasificación de 0073 (exenta→iva 0; gravada sin
 *    IVA real→rate null; total=base+iva).
 *  - el recálculo de totales en TS (sumando las líneas mapeadas) coincide con
 *    salesTotals/purchaseTotals de 0073 (no diverge — el SQL recalcula igual).
 *  - validadores de period/book_type espejan los CHECK de 0165.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FISCAL_SETTINGS,
  type FiscalSettings,
  type InvoiceIvaMode,
} from "../config-types";
import {
  salesTotals,
  purchaseTotals,
  toSalesRow,
  toPurchaseRow,
  type RawBill,
  type RawInvoice,
} from "../types";
import {
  isValidBookPeriod,
  isValidBookType,
  purchaseRowToEntry,
  salesRowToEntry,
} from "../books-types";

function settingsWith(defaultMode: InvoiceIvaMode): FiscalSettings {
  return {
    ...DEFAULT_FISCAL_SETTINGS,
    fiscal_module_enabled: true,
    default_invoice_iva_mode: defaultMode,
    tenant_id: "t1",
    updated_at: null,
    updated_by: null,
  };
}

const INV: RawInvoice = {
  invoice_code: "F-2026-0001",
  client_name: "Cliente A",
  rif: "J-12345678-9",
  iva_mode: "con_iva",
  base_amount: 1000,
  iva_amount: 160,
  iva_rate: 16,
  total_amount: 1160,
  issued_at: "2026-06-10",
  created_at: "2026-06-10T12:00:00Z",
  currency: "USD",
};

const BILL: RawBill = {
  bill_code: "CXP-2026-0001",
  supplier_name: "Proveedor X",
  reference: "FAC-998",
  tax_id: "J-PRV-1",
  total_amount: 500,
  issue_date: "2026-02-10",
  created_at: "2026-02-10T00:00:00Z",
  currency: "USD",
};

/** Las 15 keys del contrato de la RPC fiscal_post_book (0165). */
const ENTRY_KEYS = [
  "line_no",
  "op_date",
  "document_number",
  "control_number",
  "rif",
  "party_name",
  "iva_class",
  "base",
  "rate",
  "iva",
  "total",
  "retention",
  "currency",
  "source_type",
  "source_ref",
].sort();

// ── Validadores ────────────────────────────────────────────────
describe("isValidBookPeriod / isValidBookType", () => {
  it("acepta YYYY-MM con mes 01–12", () => {
    expect(isValidBookPeriod("2026-06")).toBe(true);
    expect(isValidBookPeriod("2026-01")).toBe(true);
    expect(isValidBookPeriod("2026-12")).toBe(true);
  });
  it("rechaza meses fuera de rango / formato inválido", () => {
    expect(isValidBookPeriod("2026-13")).toBe(false);
    expect(isValidBookPeriod("2026-00")).toBe(false);
    expect(isValidBookPeriod("2026-6")).toBe(false);
    expect(isValidBookPeriod("junio")).toBe(false);
    expect(isValidBookPeriod(123)).toBe(false);
  });
  it("book_type solo ventas|compras", () => {
    expect(isValidBookType("ventas")).toBe(true);
    expect(isValidBookType("compras")).toBe(true);
    expect(isValidBookType("otros")).toBe(false);
    expect(isValidBookType(null)).toBe(false);
  });
});

// ── salesRowToEntry ────────────────────────────────────────────
describe("salesRowToEntry · mapeo al payload de la RPC", () => {
  it("tiene EXACTAMENTE las 15 keys del contrato (ni más ni menos)", () => {
    const row = toSalesRow(INV, settingsWith("con_iva"));
    const entry = salesRowToEntry(row, 1);
    expect(Object.keys(entry).sort()).toEqual(ENTRY_KEYS);
  });

  it("gravada con IVA → base+iva+rate+total directos, source invoice", () => {
    const row = toSalesRow(INV, settingsWith("con_iva"));
    const e = salesRowToEntry(row, 1);
    expect(e.line_no).toBe(1);
    expect(e.iva_class).toBe("gravada");
    expect(e.base).toBe(1000);
    expect(e.iva).toBe(160);
    expect(e.rate).toBe(16);
    expect(e.total).toBe(1160); // base + iva
    expect(e.source_type).toBe("invoice");
    // document_number y source_ref = invoiceCode.
    expect(e.document_number).toBe("F-2026-0001");
    expect(e.source_ref).toBe("F-2026-0001");
    expect(e.party_name).toBe("Cliente A");
    expect(e.op_date).toBe("2026-06-10");
    expect(e.currency).toBe("USD");
  });

  it("exenta → iva 0 y rate null (clasificación de 0073 preservada)", () => {
    // Factura SIN iva_mode propio (null) → hereda el default del tenant (sin_iva)
    // → exenta. (Una factura con iva_mode 'con_iva' sobreescribe el default, §8 #3.)
    const row = toSalesRow({ ...INV, iva_mode: null }, settingsWith("sin_iva"));
    const e = salesRowToEntry(row, 2);
    expect(e.iva_class).toBe("exenta");
    expect(e.iva).toBe(0);
    expect(e.rate).toBeNull();
    expect(e.total).toBe(1000); // base + 0
  });

  it("gravada SIN IVA real (iva_amount 0) → rate null, no la general", () => {
    const sinIvaReal: RawInvoice = {
      ...INV,
      iva_mode: "con_iva",
      iva_amount: 0,
      iva_rate: 0,
      total_amount: 1000,
    };
    const row = toSalesRow(sinIvaReal, settingsWith("con_iva"));
    const e = salesRowToEntry(row, 1);
    expect(e.iva_class).toBe("gravada");
    expect(e.iva).toBe(0);
    expect(e.rate).toBeNull(); // "—", no 16
    expect(e.total).toBe(1000);
  });
});

// ── purchaseRowToEntry ─────────────────────────────────────────
describe("purchaseRowToEntry · mapeo al payload de la RPC", () => {
  it("tiene EXACTAMENTE las 15 keys del contrato", () => {
    const row = toPurchaseRow(BILL, settingsWith("con_iva"));
    const entry = purchaseRowToEntry(row, 1);
    expect(Object.keys(entry).sort()).toEqual(ENTRY_KEYS);
  });

  it("compras V1 sin IVA discriminado → base/iva/rate null, total real, source bill", () => {
    const row = toPurchaseRow(BILL, settingsWith("con_iva"));
    const e = purchaseRowToEntry(row, 1);
    expect(e.line_no).toBe(1);
    expect(e.source_type).toBe("bill");
    expect(e.base).toBeNull();
    expect(e.iva).toBeNull();
    expect(e.rate).toBeNull();
    expect(e.iva_class).toBeNull(); // compras no clasifican en V1
    expect(e.total).toBe(500);
    // documentNumber usa reference del proveedor; source_ref idem.
    expect(e.document_number).toBe("FAC-998");
    expect(e.source_ref).toBe("FAC-998");
    expect(e.party_name).toBe("Proveedor X");
    expect(e.rif).toBe("J-PRV-1");
    expect(e.currency).toBe("USD");
  });
});

// ── El recálculo TS coincide con salesTotals/purchaseTotals (anti-divergencia) ──
describe("totales recalculados desde las líneas == totales de 0073", () => {
  it("ventas: Σ base/iva/total de las entries == salesTotals (la RPC recalcula igual)", () => {
    const settings = settingsWith("con_iva");
    const rows = [
      toSalesRow(INV, settings),
      toSalesRow(
        { ...INV, invoice_code: "F-2026-0002", base_amount: 500, iva_amount: 80, total_amount: 580 },
        settings,
      ),
      toSalesRow(
        { ...INV, invoice_code: "F-2026-0003", iva_mode: "exento", base_amount: 700, iva_amount: 0, total_amount: 700 },
        settings,
      ),
    ];
    const entries = rows.map((r, i) => salesRowToEntry(r, i + 1));
    const t = salesTotals(rows);

    // Σ desde las líneas mapeadas (lo que hace la RPC con agg).
    const sumBase = round2(entries.reduce((a, e) => a + (e.base ?? 0), 0));
    const sumIva = round2(entries.reduce((a, e) => a + (e.iva ?? 0), 0));
    const sumTotal = round2(entries.reduce((a, e) => a + (e.total ?? 0), 0));
    const baseExenta = round2(
      entries.filter((e) => e.iva_class === "exenta").reduce((a, e) => a + (e.base ?? 0), 0),
    );
    const baseGravada = round2(
      entries.filter((e) => e.iva_class === "gravada").reduce((a, e) => a + (e.base ?? 0), 0),
    );

    expect(sumBase).toBe(t.base);
    expect(sumIva).toBe(t.iva);
    expect(sumTotal).toBe(t.total);
    expect(baseExenta).toBe(t.baseExenta);
    expect(baseGravada).toBe(t.baseGravada);
    // line_no 1-based en orden.
    expect(entries.map((e) => e.line_no)).toEqual([1, 2, 3]);
  });

  it("compras: Σ total de las entries == purchaseTotals.total (base/iva null no suman)", () => {
    const settings = settingsWith("con_iva");
    const rows = [
      toPurchaseRow(BILL, settings),
      toPurchaseRow({ ...BILL, bill_code: "CXP-2", reference: null, total_amount: 300 }, settings),
    ];
    const entries = rows.map((r, i) => purchaseRowToEntry(r, i + 1));
    const t = purchaseTotals(rows);

    const sumTotal = round2(entries.reduce((a, e) => a + (e.total ?? 0), 0));
    expect(sumTotal).toBe(t.total);
    // base/iva null → no suman (cero fabricado).
    expect(t.base).toBe(0);
    expect(t.iva).toBe(0);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
