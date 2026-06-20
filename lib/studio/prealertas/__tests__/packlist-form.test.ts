/**
 * SDD-0096 · Tests de la lógica PURA del packing list online del proveedor.
 *
 *  - computeTotals: re-suma AUTORITATIVA (qty = ctns*perctn, amount = qty*unit,
 *    weight = ctns*wkg, vol = ctns*cbm), descarta filas vacías, NO confía en
 *    totales que mande el cliente.
 *  - validatePackingListInput: ≥1 fila con nombre, ≥1 contacto, cap de filas,
 *    currency default USD, happy path.
 */
import { describe, it, expect } from "vitest";
import {
  computeTotals,
  validatePackingListInput,
  PACKING_LIST_MAX_ROWS,
  type PackingListRowInput,
} from "../packlist-form";

describe("computeTotals · Caja Padre (SDD-0097)", () => {
  it("fila `same`: qty = qtyDirect; sin cajas/peso/vol (van en el líder)", () => {
    const { rows } = computeTotals([
      { es: "Líder", ctns: 5, perctn: 10, unit: 2, wkg: 3, cbm: 0.5 },
      { es: "Sub-ítem", same: true, qtyDirect: 8, unit: 4 },
    ]);
    expect(rows).toHaveLength(2);
    const child = rows[1];
    expect(child.same).toBe(true);
    expect(child.qty).toBe(8); // qtyDirect, NO cajas×uds
    expect(child.amount).toBe(32); // 8 × 4
    expect(child.weight).toBe(0); // el peso va en el líder
    expect(child.vol).toBe(0);
  });

  it("totales: el sub-ítem NO doble-cuenta cajas/peso/vol", () => {
    const { totals } = computeTotals([
      { es: "Líder", ctns: 5, perctn: 10, unit: 2, wkg: 3, cbm: 0.5 },
      { es: "Sub", same: true, qtyDirect: 8, unit: 4 },
    ]);
    expect(totals.ctns).toBe(5); // solo el líder
    expect(totals.qty).toBe(58); // 50 + 8
    expect(totals.amount).toBe(132); // 100 + 32
    expect(totals.weight).toBe(15); // 5×3, solo el líder
    expect(totals.cbm).toBe(2.5); // 5×0.5, solo el líder
  });

  it("una fila `same` vacía (sin qtyDirect ni nombre) se descarta", () => {
    const { rows } = computeTotals([
      { es: "Líder", ctns: 1, perctn: 1 },
      { same: true },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("computeTotals", () => {
  it("qty = cajas × uds/caja por fila", () => {
    const { rows } = computeTotals([
      { es: "Lámparas", ctns: 10, perctn: 24 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(240);
  });

  it("amount = qty × precio · weight = cajas × kg · vol = cajas × cbm", () => {
    const { rows } = computeTotals([
      { es: "X", ctns: 5, perctn: 10, unit: 2, wkg: 3, cbm: 0.5 },
    ]);
    const r = rows[0];
    expect(r.qty).toBe(50);
    expect(r.amount).toBe(100); // 50 × 2
    expect(r.weight).toBe(15); // 5 × 3
    expect(r.vol).toBe(2.5); // 5 × 0.5
  });

  it("suma los totales de varias filas", () => {
    const { totals } = computeTotals([
      { es: "A", ctns: 2, perctn: 3, unit: 1, wkg: 1, cbm: 0.1 },
      { es: "B", ctns: 4, perctn: 5, unit: 2, wkg: 2, cbm: 0.2 },
    ]);
    expect(totals.ctns).toBe(6); // 2 + 4
    expect(totals.qty).toBe(26); // 6 + 20
    expect(totals.amount).toBe(46); // 6 + 40
    expect(totals.weight).toBe(10); // 2 + 8
    expect(totals.cbm).toBeCloseTo(1.0, 4); // 0.2 + 0.8
  });

  it("descarta filas totalmente vacías", () => {
    const { rows } = computeTotals([
      { brand: "", code: "", zh: "", es: "", ctns: "", perctn: "" },
      { es: "Real", ctns: 1, perctn: 1 },
      {},
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].es).toBe("Real");
  });

  it("NO confía en totales que venga del cliente — recomputa desde los números", () => {
    // El payload no aporta totales; aunque el cliente mandara qty/amount falsos en
    // la fila, computeTotals los ignora (rowCalc solo lee ctns/perctn/unit/wkg/cbm).
    const malicious = {
      es: "Hack",
      ctns: 1,
      perctn: 1,
      unit: 1,
      // campos computados forjados (no existen en PackingListRowInput, se ignoran):
      qty: 999999,
      amount: 999999,
    } as unknown as PackingListRowInput;
    const { rows, totals } = computeTotals([malicious]);
    expect(rows[0].qty).toBe(1); // 1 × 1, no 999999
    expect(rows[0].amount).toBe(1);
    expect(totals.amount).toBe(1);
  });

  it("tolera coma decimal y números como string", () => {
    const { rows } = computeTotals([{ es: "X", ctns: "2", perctn: "1,5" }]);
    expect(rows[0].qty).toBe(3); // 2 × 1.5
  });

  it("rows undefined → vacío sin romper", () => {
    const { rows, totals } = computeTotals(undefined);
    expect(rows).toHaveLength(0);
    expect(totals.amount).toBe(0);
  });
});

describe("validatePackingListInput", () => {
  const okRow: PackingListRowInput = { es: "Producto", ctns: 1, perctn: 1 };

  it("happy path → input saneado con totales + currency default USD", () => {
    const { input, fieldErrors } = validatePackingListInput({
      supplierEmail: "prov@example.com",
      rows: [okRow],
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
    expect(input!.currency).toBe("USD");
    expect(input!.rows).toHaveLength(1);
    expect(input!.totals.qty).toBe(1);
    expect(input!.supplierEmail).toBe("prov@example.com");
  });

  it("dirección + ciudad del proveedor se sanean y viajan en el input (SDD-0097)", () => {
    const { input } = validatePackingListInput({
      supplierEmail: "p@e.com",
      supplierAddress: "  浙江省义乌市 XX路 123号  ",
      supplierCity: "  义乌市  ",
      rows: [okRow],
    });
    expect(input).toBeDefined();
    expect(input!.supplierAddress).toBe("浙江省义乌市 XX路 123号"); // trim
    expect(input!.supplierCity).toBe("义乌市");
  });

  it("sin dirección/ciudad → null (opcionales, no rompen)", () => {
    const { input } = validatePackingListInput({
      supplierEmail: "p@e.com",
      rows: [okRow],
    });
    expect(input!.supplierAddress).toBeNull();
    expect(input!.supplierCity).toBeNull();
  });

  it("sin ningún contacto → fieldErrors.contacto", () => {
    const { input, fieldErrors } = validatePackingListInput({ rows: [okRow] });
    expect(input).toBeUndefined();
    expect(fieldErrors?.contacto).toBeTruthy();
  });

  it("WeChat o teléfono también cuentan como contacto válido", () => {
    expect(
      validatePackingListInput({ supplierWechat: "wxid", rows: [okRow] }).input,
    ).toBeDefined();
    expect(
      validatePackingListInput({ supplierPhone: "186...", rows: [okRow] }).input,
    ).toBeDefined();
  });

  it("sin ninguna fila con nombre → fieldErrors.rows", () => {
    const { input, fieldErrors } = validatePackingListInput({
      supplierEmail: "p@e.com",
      rows: [{ ctns: 5, perctn: 2 }], // cantidades pero sin brand/zh/es
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.rows).toBeTruthy();
  });

  it("una fila con nombre en chino (zh) basta", () => {
    const { input } = validatePackingListInput({
      supplierEmail: "p@e.com",
      rows: [{ zh: "灯具", ctns: 1, perctn: 1 }],
    });
    expect(input).toBeDefined();
  });

  it("más de PACKING_LIST_MAX_ROWS → fieldErrors.tooMany (sin procesar)", () => {
    const many = Array.from({ length: PACKING_LIST_MAX_ROWS + 1 }, () => okRow);
    const { input, fieldErrors } = validatePackingListInput({
      supplierEmail: "p@e.com",
      rows: many,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.tooMany).toBeTruthy();
  });

  it("currency inválida → cae a USD", () => {
    const { input } = validatePackingListInput({
      supplierEmail: "p@e.com",
      currency: "ARS",
      rows: [okRow],
    });
    expect(input!.currency).toBe("USD");
  });

  it("currency RMB/EUR válidas se respetan", () => {
    expect(
      validatePackingListInput({
        supplierEmail: "p@e.com",
        currency: "RMB",
        rows: [okRow],
      }).input!.currency,
    ).toBe("RMB");
    expect(
      validatePackingListInput({
        supplierEmail: "p@e.com",
        currency: "EUR",
        rows: [okRow],
      }).input!.currency,
    ).toBe("EUR");
  });

  it("docDate válida (YYYY-MM-DD) se conserva; inválida → null", () => {
    expect(
      validatePackingListInput({
        supplierEmail: "p@e.com",
        docDate: "2026-06-19",
        rows: [okRow],
      }).input!.docDate,
    ).toBe("2026-06-19");
    expect(
      validatePackingListInput({
        supplierEmail: "p@e.com",
        docDate: "19/06/2026",
        rows: [okRow],
      }).input!.docDate,
    ).toBeNull();
  });
});
