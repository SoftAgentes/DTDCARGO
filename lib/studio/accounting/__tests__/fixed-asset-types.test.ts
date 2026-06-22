/**
 * SDD-0105 · Activos fijos — tests de la cédula de depreciación PURA
 * (computeDepreciation, monthsBetween) + validador de input.
 *
 * Criterio de aceptación: cuota mensual, depreciación acumulada con TOPE
 * (= costo − residual), valor neto en libros, y as-of a una fecha.
 */

import { describe, it, expect } from "vitest";
import {
  computeDepreciation,
  monthsBetween,
  validateAssetInput,
} from "../fixed-asset-types";

describe("SDD-0105 · monthsBetween", () => {
  it("cuenta meses completos por calendario", () => {
    expect(monthsBetween("2026-01-15", "2026-04-15")).toBe(3);
    expect(monthsBetween("2026-01-15", "2026-01-15")).toBe(0);
    expect(monthsBetween("2026-01-15", "2027-01-15")).toBe(12);
  });

  it("ajusta cuando el día de destino aún no alcanzó el de origen", () => {
    // Adquirido el 15; al 14 del 4º mes todavía no se cumplió el 3er mes.
    expect(monthsBetween("2026-01-15", "2026-04-14")).toBe(2);
    expect(monthsBetween("2026-01-15", "2026-04-16")).toBe(3);
  });

  it("nunca es negativo (fecha asOf anterior a la adquisición)", () => {
    expect(monthsBetween("2026-06-01", "2026-01-01")).toBe(0);
  });

  it("tolera timestamps (corta a YYYY-MM-DD)", () => {
    expect(monthsBetween("2026-01-15T08:00:00Z", "2026-03-15T23:00:00Z")).toBe(2);
  });
});

describe("SDD-0105 · computeDepreciation", () => {
  // Activo base: costo 12000, residual 0, vida 12 meses → cuota 1000/mes.
  const base = {
    cost: 12000,
    salvage_value: 0,
    useful_life_months: 12,
    acquired_on: "2026-01-01",
  };

  it("cuota mensual lineal = (costo − residual) / vida", () => {
    const s = computeDepreciation(base, "2026-01-01");
    expect(s.depreciableBase).toBe(12000);
    expect(s.monthlyAmount).toBe(1000);
  });

  it("descuenta el valor residual de la base depreciable", () => {
    const s = computeDepreciation(
      { ...base, cost: 12000, salvage_value: 2400 },
      "2026-01-01",
    );
    expect(s.depreciableBase).toBe(9600);
    expect(s.monthlyAmount).toBe(800); // 9600 / 12
  });

  it("acumulada crece con los meses transcurridos (as-of)", () => {
    const s3 = computeDepreciation(base, "2026-04-01"); // 3 meses
    expect(s3.monthsElapsed).toBe(3);
    expect(s3.accumulated).toBe(3000);
    expect(s3.netBookValue).toBe(9000);
    expect(s3.fullyDepreciated).toBe(false);
  });

  it("topa la acumulada en la base depreciable (no sobre-deprecia)", () => {
    // Mucho después de la vida útil: acumulada = base, neto = residual.
    const s = computeDepreciation(
      { ...base, salvage_value: 2000 },
      "2030-01-01",
    );
    expect(s.monthsElapsed).toBe(12); // tope = vida útil
    expect(s.accumulated).toBe(10000); // 12000 − 2000
    expect(s.netBookValue).toBe(2000); // = residual, nunca por debajo
    expect(s.fullyDepreciated).toBe(true);
    expect(s.remainingThisMonth).toBe(0); // ya no hay nada que postear
  });

  it("valor neto = costo − acumulada", () => {
    const s = computeDepreciation(base, "2026-07-01"); // 6 meses
    expect(s.accumulated).toBe(6000);
    expect(s.netBookValue).toBe(12000 - 6000); // costo − acumulada
    expect(s.netBookValue).toBe(6000);
  });

  it("el último mes cierra exacto en la base (redondeo de cuota)", () => {
    // costo 1000, vida 3 → cuota 333.33; tras 3 meses acumulada debe ser 1000.
    const odd = {
      cost: 1000,
      salvage_value: 0,
      useful_life_months: 3,
      acquired_on: "2026-01-01",
    };
    expect(computeDepreciation(odd, "2026-01-01").monthlyAmount).toBe(333.33);
    const full = computeDepreciation(odd, "2026-04-01"); // 3 meses
    expect(full.accumulated).toBe(1000);
    expect(full.netBookValue).toBe(0);
    expect(full.fullyDepreciated).toBe(true);
  });

  it("la cuota a postear nunca excede la base restante", () => {
    const odd = {
      cost: 1000,
      salvage_value: 0,
      useful_life_months: 3,
      acquired_on: "2026-01-01",
    };
    // En el 3er mes ya hay 666.66 acumulado; el resto exacto es 333.34.
    const s3 = computeDepreciation(odd, "2026-03-01"); // 2 meses transcurridos
    expect(s3.accumulated).toBe(666.66);
    expect(s3.remainingThisMonth).toBe(333.33); // min(cuota, base-acum)
  });

  it("antes de cumplir el primer mes la acumulada es 0", () => {
    const s = computeDepreciation(base, "2026-01-20"); // <1 mes
    expect(s.monthsElapsed).toBe(0);
    expect(s.accumulated).toBe(0);
    expect(s.netBookValue).toBe(12000);
  });
});

describe("SDD-0105 · validateAssetInput", () => {
  const ok = {
    name: "Camión Hino 300",
    asset_account_id: "acct-flota",
    cost: 45000,
    salvage_value: 5000,
    acquired_on: "2026-01-10",
    useful_life_months: 60,
  };

  it("acepta un input válido y normaliza", () => {
    const { input, fieldErrors } = validateAssetInput(ok);
    expect(fieldErrors).toBeUndefined();
    expect(input?.cost).toBe(45000);
    expect(input?.salvage_value).toBe(5000);
    expect(input?.useful_life_months).toBe(60);
  });

  it("exige nombre y cuenta del activo", () => {
    const { fieldErrors } = validateAssetInput({ ...ok, name: "", asset_account_id: "" });
    expect(fieldErrors?.name).toBeTruthy();
    expect(fieldErrors?.asset_account_id).toBeTruthy();
  });

  it("rechaza costo <= 0", () => {
    expect(validateAssetInput({ ...ok, cost: 0 }).fieldErrors?.cost).toBeTruthy();
    expect(validateAssetInput({ ...ok, cost: -5 }).fieldErrors?.cost).toBeTruthy();
  });

  it("rechaza residual > costo", () => {
    const { fieldErrors } = validateAssetInput({ ...ok, cost: 1000, salvage_value: 1500 });
    expect(fieldErrors?.salvage_value).toBeTruthy();
  });

  it("rechaza vida útil <= 0", () => {
    expect(
      validateAssetInput({ ...ok, useful_life_months: 0 }).fieldErrors
        ?.useful_life_months,
    ).toBeTruthy();
  });

  it("rechaza fecha de adquisición mal formada", () => {
    expect(
      validateAssetInput({ ...ok, acquired_on: "10/01/2026" }).fieldErrors
        ?.acquired_on,
    ).toBeTruthy();
  });
});
