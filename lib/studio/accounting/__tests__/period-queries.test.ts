/**
 * SDD-0080 · Cierre de período contable — tests del helper puro isPeriodClosed.
 */

import { describe, it, expect } from "vitest";
import { isPeriodClosed } from "../period-queries";

describe("SDD-0080 · isPeriodClosed", () => {
  it("período abierto (closing_date null) → nada está cerrado", () => {
    expect(isPeriodClosed(null, "2026-06-14")).toBe(false);
    expect(isPeriodClosed(null, "2020-01-01")).toBe(false);
  });

  it("fecha igual o anterior al cierre → cerrado", () => {
    expect(isPeriodClosed("2026-05-31", "2026-05-31")).toBe(true); // igual
    expect(isPeriodClosed("2026-05-31", "2026-05-15")).toBe(true); // anterior
    expect(isPeriodClosed("2026-05-31", "2026-04-30")).toBe(true);
  });

  it("fecha posterior al cierre → abierto", () => {
    expect(isPeriodClosed("2026-05-31", "2026-06-01")).toBe(false);
    expect(isPeriodClosed("2026-05-31", "2026-12-31")).toBe(false);
  });

  it("tolera timestamps en entryDate (corta a YYYY-MM-DD)", () => {
    expect(isPeriodClosed("2026-05-31", "2026-05-30T23:59:59Z")).toBe(true);
    expect(isPeriodClosed("2026-05-31", "2026-06-01T00:00:00Z")).toBe(false);
  });

  it("cruza el cambio de año correctamente", () => {
    // Cierre al 31-dic-2025: un asiento del 1-ene-2026 está abierto.
    expect(isPeriodClosed("2025-12-31", "2026-01-01")).toBe(false);
    // Cierre al 1-ene-2026: un asiento del 31-dic-2025 está cerrado.
    expect(isPeriodClosed("2026-01-01", "2025-12-31")).toBe(true);
  });
});
