/**
 * SDD-0077 · Contabilidad estilo QuickBooks (3 slices).
 * Tests de la lógica pura: subtipos de cuenta (cascada Tipo→Subtipo),
 * mapeo categoría de gasto → cuenta del plan, y normalización de la cuenta
 * por defecto del proveedor.
 */

import { describe, it, expect } from "vitest";
import {
  ACCT_SUBTYPES,
  ACCT_TYPES,
  isValidSubtype,
  acctSubtypeLabel,
  validateAccountInput,
} from "../account-types";
import {
  EXPENSE_CATEGORY_ACCOUNT_CODE,
  SHIPMENT_CATEGORIES,
  EXTERNAL_CATEGORIES,
} from "../expense-types";
import { validateSupplierInput } from "../treasury/types";

describe("SDD-0077 · cuenta: cascada Tipo→Subtipo", () => {
  it("define subtipos para los 6 tipos de cuenta", () => {
    for (const t of ACCT_TYPES) {
      expect(ACCT_SUBTYPES[t].length).toBeGreaterThan(0);
    }
  });

  it("los values de subtipo son únicos dentro de cada tipo", () => {
    for (const t of ACCT_TYPES) {
      const values = ACCT_SUBTYPES[t].map((s) => s.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("isValidSubtype acepta null/'' y un subtipo del tipo; rechaza uno ajeno", () => {
    expect(isValidSubtype("G", null)).toBe(true);
    expect(isValidSubtype("G", "")).toBe(true);
    expect(isValidSubtype("G", "alquiler")).toBe(true);
    expect(isValidSubtype("G", "capital")).toBe(false); // 'capital' es de PT
    expect(isValidSubtype("A", "banco_caja")).toBe(true);
  });

  it("acctSubtypeLabel devuelve el label legible o null", () => {
    expect(acctSubtypeLabel("G", "alquiler")).toBe("Alquiler");
    expect(acctSubtypeLabel("G", null)).toBeNull();
  });

  it("validateAccountInput conserva un subtipo válido y descarta uno ajeno", () => {
    const ok = validateAccountInput({
      code: "6.50",
      name: "Test",
      type: "G",
      subtype: "alquiler",
    }, [{ code: "6" }]);
    expect(ok.input?.subtype).toBe("alquiler");

    const mismatched = validateAccountInput({
      code: "6.51",
      name: "Test",
      type: "G",
      subtype: "capital", // de PT → se descarta, no bloquea
    }, [{ code: "6" }]);
    expect(mismatched.input?.subtype).toBeNull();
  });
});

describe("SDD-0077 · gasto → cuenta del plan (mapeo)", () => {
  const allCategories = [
    ...new Set([...SHIPMENT_CATEGORIES, ...EXTERNAL_CATEGORIES]),
  ];

  it("cada categoría de gasto tiene una cuenta mapeada", () => {
    for (const cat of allCategories) {
      expect(EXPENSE_CATEGORY_ACCOUNT_CODE[cat]).toBeTruthy();
    }
  });

  it("los codes mapeados son de costo (5.x) o gasto (6.x)", () => {
    for (const code of Object.values(EXPENSE_CATEGORY_ACCOUNT_CODE)) {
      expect(code.startsWith("5.") || code.startsWith("6.")).toBe(true);
    }
  });

  it("coincide EXACTO con el backfill SQL de la migración 0131 (anti-drift)", () => {
    // Espejo del VALUES en supabase/migrations/0131_contabilidad_qbo.sql.
    // Si cambia uno, cambiá el otro: este test los amarra.
    const SQL_BACKFILL: Record<string, string> = {
      taxi: "6.14",
      comida: "6.14",
      hotel: "6.14",
      vuelo: "6.14",
      peaje: "6.14",
      combustible: "6.1",
      aduana: "5.5",
      cliente: "6.99",
      otro: "6.99",
      op_rent: "6.7",
      op_utilities: "6.8",
      op_salaries: "6.5.1",
      op_supplies: "6.13",
      op_equipment: "6.2",
      op_local_transport: "5.2",
      op_customs_local: "5.5",
    };
    expect(EXPENSE_CATEGORY_ACCOUNT_CODE).toEqual(SQL_BACKFILL);
  });
});

describe("SDD-0077 · proveedor → cuenta de gasto por defecto", () => {
  it("normaliza defaultExpenseAccountId vacío a null", () => {
    const r = validateSupplierInput({
      name: "Naviera X",
      defaultExpenseAccountId: "",
    });
    expect(r.input?.defaultExpenseAccountId).toBeNull();
  });

  it("conserva el id de cuenta cuando viene", () => {
    const r = validateSupplierInput({
      name: "Naviera X",
      defaultExpenseAccountId: "acct-123",
    });
    expect(r.input?.defaultExpenseAccountId).toBe("acct-123");
  });
});
