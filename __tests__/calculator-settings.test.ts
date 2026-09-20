// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CALCULATOR_SETTINGS,
  validateCalculatorSettingsInput,
  type CalculatorSettingsInput,
} from "@/lib/studio/calculator-settings-types";

/**
 * Tests del validador de los parámetros del calculador (Fase 3 Slice A).
 * Espeja los CHECKs de supabase/migrations/0103_calculator_settings.sql:
 *  - todos los campos numéricos finitos y dentro de su mínimo
 *  - multiplicador de baterías ≥ 1
 */
describe("validateCalculatorSettingsInput", () => {
  const base = (): CalculatorSettingsInput => ({ ...DEFAULT_CALCULATOR_SETTINGS });

  it("acepta los defaults", () => {
    const { input, fieldErrors } = validateCalculatorSettingsInput(base());
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual(DEFAULT_CALCULATOR_SETTINGS);
  });

  it("acepta un input válido con valores custom", () => {
    const { input, fieldErrors } = validateCalculatorSettingsInput({
      ...base(),
      pesoIncluidoKg: 450,
      recargoExcedenteKg: 1.5,
      recargoBateriaMult: 1.8,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.pesoIncluidoKg).toBe(450);
    expect(input?.recargoBateriaMult).toBe(1.8);
  });

  it("rechaza multiplicador de baterías menor a 1", () => {
    const { fieldErrors } = validateCalculatorSettingsInput({
      ...base(),
      recargoBateriaMult: 0.5,
    });
    expect(fieldErrors?.recargoBateriaMult).toBeTruthy();
  });

  it("rechaza valores negativos", () => {
    const { fieldErrors } = validateCalculatorSettingsInput({
      ...base(),
      recargoExcedenteKg: -1,
      tarifaKmFueraCasco: -2,
    });
    expect(fieldErrors?.recargoExcedenteKg).toBeTruthy();
    expect(fieldErrors?.tarifaKmFueraCasco).toBeTruthy();
  });

  it("rechaza peso incluido en cero (debe ser > 0)", () => {
    const { fieldErrors } = validateCalculatorSettingsInput({
      ...base(),
      pesoIncluidoKg: 0,
    });
    expect(fieldErrors?.pesoIncluidoKg).toBeTruthy();
  });

  it("rechaza campos ausentes o no numéricos", () => {
    const { fieldErrors } = validateCalculatorSettingsInput({
      ...base(),
      descuentoValencia: null as unknown as number,
      thresholdCascoKm: Number.NaN,
    });
    expect(fieldErrors?.descuentoValencia).toBeTruthy();
    expect(fieldErrors?.thresholdCascoKm).toBeTruthy();
  });
});
