/**
 * SDD-0569 · La precarga de la tasa de un gasto muestra su día, no el anterior
 * (revisión de seguridad, hallazgo 8). La fecha de valor es un día (AAAA-MM-DD):
 * leída como instante UTC, en Caracas (UTC−4) salía un día antes.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDateShort } from "./ExpenseDrawer";

const zonaOriginal = process.env.TZ;
beforeEach(() => {
  process.env.TZ = "America/Caracas";
});
afterEach(() => {
  process.env.TZ = zonaOriginal;
});

describe("formatDateShort", () => {
  it("un día se muestra tal cual, aunque el navegador esté en Caracas", () => {
    expect(formatDateShort("2026-10-20", "es-VE")).toMatch(/^20/);
    expect(formatDateShort("2026-10-01", "es-VE")).toMatch(/^01/);
  });

  it("un instante sigue en la zona del navegador", () => {
    // 02:00 UTC del 20 son las 22:00 del 19 en Caracas.
    expect(formatDateShort("2026-10-20T02:00:00Z", "es-VE")).toMatch(/^19/);
  });
});
