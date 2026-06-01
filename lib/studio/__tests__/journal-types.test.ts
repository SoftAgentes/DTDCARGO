/**
 * Tests de asientos (SDD-0040) — capa pura `journal-types`.
 *
 * Cubre criterios de aceptación §6 (Lib):
 *  - entryTotals([{debit:100},{credit:100}]) → {debit:100,credit:100,balanced:true}
 *  - validateEntryInput rechaza desbalanceado y cuentas no-postables
 *  - normalizeEntryLines (debe XOR haber, descarta vacías)
 */

import { describe, it, expect } from "vitest";
import {
  ENTRY_CODE_RE,
  entryStatusBadgeTone,
  entryStatusLabel,
  entryTotals,
  formatEntryCode,
  normalizeEntryLines,
  validateEntryInput,
} from "../journal-types";

describe("entryTotals", () => {
  it("suma debe/haber y marca balanceado (criterio de aceptación)", () => {
    expect(entryTotals([{ debit: 100 }, { credit: 100 }])).toEqual({
      debit: 100,
      credit: 100,
      balanced: true,
    });
  });

  it("desbalanceado cuando debe ≠ haber", () => {
    const r = entryTotals([{ debit: 100 }, { credit: 80 }]);
    expect(r.debit).toBe(100);
    expect(r.credit).toBe(80);
    expect(r.balanced).toBe(false);
  });

  it("un asiento de ceros NO balancea (debe > 0 requerido)", () => {
    expect(entryTotals([{ debit: 0 }, { credit: 0 }]).balanced).toBe(false);
  });

  it("tolera redondeo a 2 decimales", () => {
    const r = entryTotals([
      { debit: 33.33 },
      { debit: 33.33 },
      { debit: 33.34 },
      { credit: 100 },
    ]);
    expect(r.debit).toBe(100);
    expect(r.credit).toBe(100);
    expect(r.balanced).toBe(true);
  });

  it("suma varias líneas de cada lado", () => {
    const r = entryTotals([
      { debit: 600 },
      { debit: 400 },
      { credit: 1000 },
    ]);
    expect(r).toEqual({ debit: 1000, credit: 1000, balanced: true });
  });
});

describe("normalizeEntryLines", () => {
  it("descarta líneas sin cuenta o sin monto", () => {
    const r = normalizeEntryLines([
      { account_id: "a", debit: 100, credit: 0 },
      { account_id: "", debit: 50, credit: 0 },
      { account_id: "b", debit: 0, credit: 0 },
    ]);
    expect(r).toEqual([
      { account_id: "a", debit: 100, credit: 0, line_memo: null },
    ]);
  });

  it("debe XOR haber: conserva el lado mayor si vienen ambos", () => {
    const r = normalizeEntryLines([
      { account_id: "a", debit: 100, credit: 30 },
    ]);
    expect(r[0]).toMatchObject({ debit: 100, credit: 0 });
  });

  it("negativos → 0 (y se descartan si quedan en 0)", () => {
    const r = normalizeEntryLines([
      { account_id: "a", debit: -5, credit: -3 },
    ]);
    expect(r).toEqual([]);
  });

  it("no-array → []", () => {
    expect(normalizeEntryLines(null)).toEqual([]);
    expect(normalizeEntryLines("x")).toEqual([]);
  });
});

describe("validateEntryInput", () => {
  const baseDate = "2026-06-01";

  it("acepta un asiento balanceado de 2 líneas con cuentas postables", () => {
    const postable = new Set(["a", "b"]);
    const r = validateEntryInput(
      {
        entry_date: baseDate,
        memo: "Ajuste",
        lines: [
          { account_id: "a", debit: 100, credit: 0, line_memo: null },
          { account_id: "b", debit: 0, credit: 100, line_memo: null },
        ],
      },
      postable,
    );
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.lines).toHaveLength(2);
    expect(r.input?.entry_date).toBe(baseDate);
  });

  it("rechaza fecha inválida", () => {
    const r = validateEntryInput({
      entry_date: "01/06/2026",
      lines: [
        { account_id: "a", debit: 100, credit: 0, line_memo: null },
        { account_id: "b", debit: 0, credit: 100, line_memo: null },
      ],
    });
    expect(r.fieldErrors?.entry_date).toBeDefined();
  });

  it("rechaza menos de 2 líneas", () => {
    const r = validateEntryInput({
      entry_date: baseDate,
      lines: [{ account_id: "a", debit: 100, credit: 0, line_memo: null }],
    });
    expect(r.fieldErrors?.lines).toBeDefined();
  });

  it("rechaza asiento desbalanceado (criterio de aceptación)", () => {
    const r = validateEntryInput({
      entry_date: baseDate,
      lines: [
        { account_id: "a", debit: 100, credit: 0, line_memo: null },
        { account_id: "b", debit: 0, credit: 80, line_memo: null },
      ],
    });
    expect(r.fieldErrors?.lines).toBeDefined();
    expect(r.fieldErrors?.lines).toMatch(/no balancea/i);
  });

  it("rechaza cuentas no-postables (criterio de aceptación)", () => {
    const postable = new Set(["a"]); // 'b' NO es postable
    const r = validateEntryInput(
      {
        entry_date: baseDate,
        lines: [
          { account_id: "a", debit: 100, credit: 0, line_memo: null },
          { account_id: "b", debit: 0, credit: 100, line_memo: null },
        ],
      },
      postable,
    );
    expect(r.fieldErrors?.lines).toBeDefined();
    expect(r.fieldErrors?.lines).toMatch(/postable/i);
  });

  it("sin set de postables no valida postabilidad (acepta si balancea)", () => {
    const r = validateEntryInput({
      entry_date: baseDate,
      lines: [
        { account_id: "a", debit: 100, credit: 0, line_memo: null },
        { account_id: "b", debit: 0, credit: 100, line_memo: null },
      ],
    });
    expect(r.fieldErrors).toBeUndefined();
  });
});

describe("formatEntryCode (formato A-YYYY-NNNN · criterio de aceptación)", () => {
  it("el primero del año es A-2026-0001", () => {
    expect(formatEntryCode(2026, 1)).toBe("A-2026-0001");
  });
  it("padea a 4 dígitos", () => {
    expect(formatEntryCode(2026, 42)).toBe("A-2026-0042");
    expect(formatEntryCode(2026, 1234)).toBe("A-2026-1234");
  });
  it("extiende el padding si pasa de 9999", () => {
    expect(formatEntryCode(2026, 12345)).toBe("A-2026-12345");
  });
  it("matchea el patrón ENTRY_CODE_RE", () => {
    expect(ENTRY_CODE_RE.test(formatEntryCode(2026, 1))).toBe(true);
    expect(ENTRY_CODE_RE.test("F-2026-0001")).toBe(false);
    expect(ENTRY_CODE_RE.test("A-2026-1")).toBe(false);
  });
});

describe("labels / tones", () => {
  it("entryStatusLabel mapea los 3 estados", () => {
    expect(entryStatusLabel("borrador")).toBe("Borrador");
    expect(entryStatusLabel("asentado")).toBe("Asentado");
    expect(entryStatusLabel("anulado")).toBe("Anulado");
  });
  it("entryStatusBadgeTone", () => {
    expect(entryStatusBadgeTone("asentado")).toBe("success");
    expect(entryStatusBadgeTone("anulado")).toBe("danger");
    expect(entryStatusBadgeTone("borrador")).toBe("neutral");
  });
});
