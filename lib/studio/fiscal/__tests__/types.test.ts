/**
 * Tests de los helpers puros de Libros de IVA (SDD-0073 · types).
 *
 * Cubre Acceptance §5:
 *  - fiscalRange: 1° a último día del mes, con bordes (30/31) y bisiesto (feb).
 *  - clasificación según settings: exento vs gravado vs tasa_cero vs mixto.
 *  - el mismo setting cambia el libro (exento → IVA 0; gravado → débito).
 *  - totales por alícuota + desglose exenta/gravada/tasa_cero.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FISCAL_SETTINGS,
  type FiscalSettings,
  type ServiceIvaTreatment,
} from "../config-types";
import {
  asPeriod,
  classifyVenta,
  currentPeriod,
  effectiveRate,
  fiscalRange,
  isValidPeriod,
  periodLabel,
  salesTotals,
  shiftPeriod,
  toSalesRow,
  type RawInvoice,
} from "../types";

function settingsWith(treatment: ServiceIvaTreatment): FiscalSettings {
  return {
    ...DEFAULT_FISCAL_SETTINGS,
    service_iva_treatment: treatment,
    tenant_id: "t1",
    updated_at: null,
    updated_by: null,
  };
}

// ── fiscalRange ────────────────────────────────────────────────
describe("fiscalRange · bordes y bisiesto", () => {
  it("junio 2026 → 01 a 30", () => {
    expect(fiscalRange("2026-06")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });
  it("enero 2026 → 01 a 31", () => {
    expect(fiscalRange("2026-01")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });
  it("febrero 2026 (no bisiesto) → 01 a 28", () => {
    expect(fiscalRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("febrero 2024 (bisiesto) → 01 a 29", () => {
    expect(fiscalRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
  it("diciembre 2026 → 01 a 31", () => {
    expect(fiscalRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("abril 2026 (mes de 30) → 01 a 30", () => {
    expect(fiscalRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });
});

// ── helpers de período ─────────────────────────────────────────
describe("período YYYY-MM", () => {
  it("currentPeriod usa UTC", () => {
    expect(currentPeriod(new Date("2026-03-09T23:30:00Z"))).toBe("2026-03");
  });
  it("isValidPeriod acepta válidos y rechaza inválidos", () => {
    expect(isValidPeriod("2026-06")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-00")).toBe(false);
    expect(isValidPeriod("2026-6")).toBe(false);
    expect(isValidPeriod("junio")).toBe(false);
    expect(isValidPeriod(202606)).toBe(false);
  });
  it("asPeriod cae al mes actual con basura", () => {
    const today = new Date("2026-05-15T00:00:00Z");
    expect(asPeriod("xxxx", today)).toBe("2026-05");
    expect(asPeriod("2026-07", today)).toBe("2026-07");
  });
  it("shiftPeriod cruza años", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
  });
  it("periodLabel formatea legible", () => {
    expect(periodLabel("2026-06")).toBe("Junio 2026");
  });
});

// ── clasificación según settings ───────────────────────────────
describe("classifyVenta · DERIVA de la config (nunca hardcodea)", () => {
  it("exento → siempre exenta", () => {
    expect(classifyVenta("exento", { ivaAmount: 0, ivaRate: 0 })).toBe("exenta");
    // Aun si la factura trajera IVA, el setting manda.
    expect(classifyVenta("exento", { ivaAmount: 50, ivaRate: 16 })).toBe("exenta");
  });
  it("gravado → siempre gravada", () => {
    expect(classifyVenta("gravado", { ivaAmount: 0, ivaRate: 0 })).toBe("gravada");
  });
  it("tasa_cero → tasa_cero", () => {
    expect(classifyVenta("tasa_cero", { ivaAmount: 0, ivaRate: 0 })).toBe("tasa_cero");
  });
  it("mixto → se decide por el IVA de la factura", () => {
    expect(classifyVenta("mixto", { ivaAmount: 0, ivaRate: 0 })).toBe("exenta");
    expect(classifyVenta("mixto", { ivaAmount: 16, ivaRate: 16 })).toBe("gravada");
    expect(classifyVenta("mixto", { ivaAmount: 0, ivaRate: 16 })).toBe("gravada");
  });
});

describe("effectiveRate", () => {
  it("exenta → null", () => {
    expect(effectiveRate("exenta", { invoiceRate: 16, generalRate: 16 })).toBeNull();
  });
  it("tasa_cero → 0", () => {
    expect(effectiveRate("tasa_cero", { invoiceRate: 0, generalRate: 16 })).toBe(0);
  });
  it("gravada → alícuota de la factura si existe, si no la general", () => {
    expect(effectiveRate("gravada", { invoiceRate: 8, generalRate: 16 })).toBe(8);
    expect(effectiveRate("gravada", { invoiceRate: 0, generalRate: 16 })).toBe(16);
  });
});

// ── el mismo setting cambia el libro ───────────────────────────
const SAMPLE: RawInvoice = {
  invoice_code: "F-2026-0001",
  client_name: "Cliente A",
  rif: "J-12345678-9",
  base_amount: 1000,
  iva_amount: 160,
  iva_rate: 16,
  total_amount: 1160,
  issued_at: "2026-06-10",
  created_at: "2026-06-10T12:00:00Z",
};

describe("toSalesRow · cambiar el setting cambia el libro (Acceptance)", () => {
  it("exento → IVA 0 aunque la factura traiga iva_amount", () => {
    const row = toSalesRow(SAMPLE, settingsWith("exento"));
    expect(row.ivaClass).toBe("exenta");
    expect(row.iva).toBe(0);
    expect(row.rate).toBeNull();
    expect(row.base).toBe(1000);
    expect(row.total).toBe(1000); // base + iva(0)
  });

  it("gravado → débito = iva_amount de la factura", () => {
    const row = toSalesRow(SAMPLE, settingsWith("gravado"));
    expect(row.ivaClass).toBe("gravada");
    expect(row.iva).toBe(160);
    expect(row.rate).toBe(16);
    expect(row.total).toBe(1160);
  });

  it("tasa_cero → IVA 0 pero alícuota 0 (no null)", () => {
    const row = toSalesRow(SAMPLE, settingsWith("tasa_cero"));
    expect(row.ivaClass).toBe("tasa_cero");
    expect(row.iva).toBe(0);
    expect(row.rate).toBe(0);
  });

  it("gravada SIN IVA real (iva_amount 0) → alícuota null ('—'), NO la general (#4)", () => {
    // Factura vieja (anterior a la capa fiscal): base sí, pero iva_amount = 0.
    // Forzar la alícuota general pintaría 'base 1000, 16%, IVA 0' — incoherente.
    const vieja: RawInvoice = {
      ...SAMPLE,
      iva_amount: 0,
      iva_rate: 0,
      total_amount: 1000,
    };
    const row = toSalesRow(vieja, settingsWith("gravado"));
    expect(row.ivaClass).toBe("gravada");
    expect(row.iva).toBe(0);
    expect(row.rate).toBeNull(); // "—", no 16
    expect(row.base).toBe(1000);
    expect(row.total).toBe(1000); // cuadra columna a columna
  });

  it("gravada CON IVA real → mantiene la alícuota de la factura (no se rompe el caso normal)", () => {
    const row = toSalesRow(SAMPLE, settingsWith("gravado"));
    expect(row.ivaClass).toBe("gravada");
    expect(row.iva).toBe(160);
    expect(row.rate).toBe(16);
  });

  it("nº de control sin fuente → null (UI muestra '—', §3.2)", () => {
    const row = toSalesRow(SAMPLE, settingsWith("gravado"));
    expect(row.controlNumber).toBeNull();
    expect(row.retention).toBeNull();
  });

  it("issued_at null → cae a created_at (YYYY-MM-DD)", () => {
    const row = toSalesRow({ ...SAMPLE, issued_at: null }, settingsWith("exento"));
    expect(row.date).toBe("2026-06-10");
  });
});

// ── totales por alícuota ───────────────────────────────────────
describe("salesTotals · Σ + desglose por alícuota", () => {
  const settingsGravado = settingsWith("gravado");

  it("suma base/IVA/total y agrupa por alícuota", () => {
    const rows = [
      toSalesRow(SAMPLE, settingsGravado), // base 1000, iva 160 @16
      toSalesRow(
        { ...SAMPLE, invoice_code: "F-2026-0002", base_amount: 500, iva_amount: 80 },
        settingsGravado,
      ), // base 500, iva 80 @16
    ];
    const t = salesTotals(rows);
    expect(t.base).toBe(1500);
    expect(t.iva).toBe(240);
    expect(t.total).toBe(1740);
    expect(t.baseGravada).toBe(1500);
    expect(t.byRate).toEqual([{ rate: 16, base: 1500, iva: 240 }]);
  });

  it("mezcla exenta + gravada (cartera mixta)", () => {
    const mixto = settingsWith("mixto");
    const exentaInv: RawInvoice = {
      ...SAMPLE,
      invoice_code: "F-2026-0003",
      base_amount: 700,
      iva_amount: 0,
      iva_rate: 0,
      total_amount: 700,
    };
    const rows = [
      toSalesRow(SAMPLE, mixto), // gravada: base 1000, iva 160
      toSalesRow(exentaInv, mixto), // exenta: base 700
    ];
    const t = salesTotals(rows);
    expect(t.baseGravada).toBe(1000);
    expect(t.baseExenta).toBe(700);
    expect(t.iva).toBe(160);
    expect(t.base).toBe(1700);
    expect(t.byRate).toEqual([{ rate: 16, base: 1000, iva: 160 }]);
  });

  it("libro vacío → todo en cero", () => {
    const t = salesTotals([]);
    expect(t.base).toBe(0);
    expect(t.iva).toBe(0);
    expect(t.total).toBe(0);
    expect(t.byRate).toEqual([]);
    expect(t.rows).toBe(0);
  });
});
