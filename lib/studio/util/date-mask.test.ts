import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addMonthsToDate,
  caretAfterDigits,
  groupDigits,
  isoToDisplay,
  normalizePasted,
  normalizeTyped,
  parseDisplay,
  todayIso,
} from "./date-mask";

describe("date-mask · escritura (SDD-0660)", () => {
  it("los números seguidos reciben las barras solas", () => {
    expect(normalizeTyped("18112026", "date")).toBe("18/11/2026");
    expect(normalizeTyped("181", "date")).toBe("18/1");
    expect(normalizeTyped("18", "date")).toBe("18");
    expect(normalizeTyped("112026", "month")).toBe("11/2026");
  });

  it("no pasa de los dígitos del formato", () => {
    expect(normalizeTyped("1811202699", "date")).toBe("18/11/2026");
    expect(groupDigits("1120261", "month")).toBe("11/2026");
  });

  it("una barra escrita tras un solo dígito lo completa con cero", () => {
    expect(normalizeTyped("1/", "date")).toBe("01");
    expect(normalizeTyped("01/2/", "date")).toBe("01/02");
    expect(normalizeTyped("3/", "month")).toBe("03");
  });

  it("borrar en medio reagrupa sin inventar ceros", () => {
    expect(normalizeTyped("18/1/2026", "date")).toBe("18/12/026");
  });

  it("borrar la barra no la vuelve a poner sola", () => {
    expect(normalizeTyped("18/", "date")).toBe("18");
  });

  it("el cursor queda tras los mismos dígitos", () => {
    expect(caretAfterDigits("18/11/2026", 2)).toBe(2);
    expect(caretAfterDigits("18/11/2026", 3)).toBe(4);
    expect(caretAfterDigits("18/11/2026", 0)).toBe(0);
  });
});

describe("date-mask · pegar", () => {
  it("entiende barras, guiones, puntos y el ISO", () => {
    expect(normalizePasted("18/11/2026", "date")).toBe("18/11/2026");
    expect(normalizePasted("18-11-2026", "date")).toBe("18/11/2026");
    expect(normalizePasted("18.11.2026", "date")).toBe("18/11/2026");
    expect(normalizePasted("1/2/2026", "date")).toBe("01/02/2026");
    expect(normalizePasted("2026-11-18", "date")).toBe("18/11/2026");
    expect(normalizePasted("2026-11-18T10:30:00Z", "date")).toBe("18/11/2026");
    expect(normalizePasted(" 18112026 ", "date")).toBe("18/11/2026");
    expect(normalizePasted("2026-11", "month")).toBe("11/2026");
    expect(normalizePasted("11/2026", "month")).toBe("11/2026");
  });

  it("lo que no es fecha se deja al onChange normal", () => {
    expect(normalizePasted("mañana", "date")).toBeNull();
    expect(normalizePasted("", "date")).toBeNull();
  });
});

describe("date-mask · validación", () => {
  it("vacío, incompleto y válido", () => {
    expect(parseDisplay("", "date").status).toBe("empty");
    expect(parseDisplay("18/11", "date")).toMatchObject({
      status: "incomplete",
      error: "Completa la fecha: dd/mm/aaaa.",
    });
    expect(parseDisplay("18/11/2026", "date")).toEqual({ status: "valid", iso: "2026-11-18", error: null });
    expect(parseDisplay("11/2026", "month")).toEqual({ status: "valid", iso: "2026-11", error: null });
  });

  it("31/02 no existe y no se corrige solo", () => {
    expect(parseDisplay("31/02/2026", "date")).toEqual({
      status: "invalid",
      iso: null,
      error: "Ese día no existe: febrero de 2026 tiene 28 días.",
    });
  });

  it("29/02 solo en bisiesto", () => {
    expect(parseDisplay("29/02/2028", "date").status).toBe("valid");
    expect(parseDisplay("29/02/2027", "date").status).toBe("invalid");
  });

  it("mes 13, día 00 y año fuera de rango", () => {
    expect(parseDisplay("01/13/2026", "date").error).toBe("El mes va de 01 a 12.");
    expect(parseDisplay("00/11/2026", "date").status).toBe("invalid");
    expect(parseDisplay("13/2026", "month").error).toBe("El mes va de 01 a 12.");
    expect(parseDisplay("01/01/0026", "date").error).toBe("El año va de 1900 a 2100.");
  });

  it("respeta min y max", () => {
    const b = { min: "2026-11-01", max: "2026-11-30" };
    expect(parseDisplay("31/10/2026", "date", b).error).toBe("La fecha mínima es 01/11/2026.");
    expect(parseDisplay("01/12/2026", "date", b).error).toBe("La fecha máxima es 30/11/2026.");
    expect(parseDisplay("15/11/2026", "date", b).status).toBe("valid");
  });
});

describe("date-mask · aritmética", () => {
  it("días y meses cruzan fin de mes y de año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("hoy es el día de negocio en Caracas, no UTC ni el del navegador", () => {
    // 02:30 UTC del 19 = 22:30 del 18 en Caracas.
    const late = new Date("2026-11-19T02:30:00Z");
    expect(todayIso("date", late)).toBe("2026-11-18");
    // 23:30 UTC del 30 de noviembre = 19:30 en Caracas: sigue siendo noviembre.
    expect(todayIso("month", new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
  });

  it("ISO a lo que se ve", () => {
    expect(isoToDisplay("2026-11-18", "date")).toBe("18/11/2026");
    expect(isoToDisplay("2026-11-18T00:00:00", "date")).toBe("18/11/2026");
    expect(isoToDisplay("2026-11", "month")).toBe("11/2026");
    expect(isoToDisplay("", "date")).toBe("");
    expect(isoToDisplay(null, "date")).toBe("");
  });
});
