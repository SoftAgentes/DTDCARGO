// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validatePayrollRulesInput,
  PAYROLL_RULES_DEFAULTS,
  UTILIDADES_MIN_DAYS,
  isPayFrequency,
  isDayMethod,
  payFrequencyLabel,
  dayMethodLabel,
  payrollRulesStatusLabel,
  payrollRulesStatusTone,
  isPayrollRulesStatus,
} from "./payroll-rules-types";

describe("validatePayrollRulesInput", () => {
  // Input mínimo válido = los defaults (frecuencia/método explícitos).
  const base = { pay_frequency: "mensual", day_method: "30" };

  it("acepta un input válido completo y normaliza", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({
      ...base,
      min_salary: "130",
      cestaticket: "40",
      bono_guerra: "90",
      sso_pct: "4",
      rpe_pct: "0.5",
      faov_pct: "1",
      sso_cap_sm: "5",
      rpe_cap_sm: "10",
      overtime_pct: "50",
      night_pct: "30",
      holiday_pct: "50",
      utilidades_days: "30",
      bono_vacacional_days: "15",
      vacaciones_days: "15",
      notes: "  ok  ",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.pay_frequency).toBe("mensual");
    expect(input!.day_method).toBe("30");
    expect(input!.min_salary).toBe(130);
    expect(input!.rpe_pct).toBe(0.5);
    expect(input!.utilidades_days).toBe(30);
    expect(input!.notes).toBe("ok");
    expect(input!.salarial_bonuses).toEqual([]);
  });

  it("usa defaults razonables cuando faltan campos numéricos", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({ ...base });
    expect(fieldErrors).toBeUndefined();
    expect(input!.sso_pct).toBe(PAYROLL_RULES_DEFAULTS.sso_pct);
    expect(input!.utilidades_days).toBe(PAYROLL_RULES_DEFAULTS.utilidades_days);
    expect(input!.min_salary).toBe(0);
  });

  it("rechaza frecuencia y método inválidos", () => {
    expect(
      validatePayrollRulesInput({ ...base, pay_frequency: "anual" }).fieldErrors?.pay_frequency,
    ).toBeTruthy();
    expect(
      validatePayrollRulesInput({ ...base, day_method: "28" }).fieldErrors?.day_method,
    ).toBeTruthy();
  });

  it("rechaza porcentaje > 100", () => {
    const { fieldErrors } = validatePayrollRulesInput({ ...base, sso_pct: "150" });
    expect(fieldErrors?.sso_pct).toBeTruthy();
  });

  it("rechaza porcentaje negativo", () => {
    expect(
      validatePayrollRulesInput({ ...base, overtime_pct: "-1" }).fieldErrors?.overtime_pct,
    ).toBeTruthy();
  });

  it("rechaza tope negativo", () => {
    expect(
      validatePayrollRulesInput({ ...base, sso_cap_sm: "-2" }).fieldErrors?.sso_cap_sm,
    ).toBeTruthy();
  });

  it("rechaza monto base negativo", () => {
    expect(
      validatePayrollRulesInput({ ...base, min_salary: "-1" }).fieldErrors?.min_salary,
    ).toBeTruthy();
  });

  it("rechaza días negativos", () => {
    expect(
      validatePayrollRulesInput({ ...base, vacaciones_days: "-3" }).fieldErrors?.vacaciones_days,
    ).toBeTruthy();
  });

  it("rechaza utilidades por debajo del mínimo legal (30)", () => {
    const { fieldErrors } = validatePayrollRulesInput({ ...base, utilidades_days: "29" });
    expect(fieldErrors?.utilidades_days).toBeTruthy();
  });

  it("acepta utilidades exactamente en el mínimo legal", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({
      ...base,
      utilidades_days: String(UTILIDADES_MIN_DAYS),
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.utilidades_days).toBe(UTILIDADES_MIN_DAYS);
  });

  it("rechaza días no enteros", () => {
    expect(
      validatePayrollRulesInput({ ...base, vacaciones_days: "15.5" }).fieldErrors?.vacaciones_days,
    ).toBeTruthy();
  });

  it("parsea salarial_bonuses desde JSON string", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({
      ...base,
      salarial_bonuses: '[{"label":"Bono producción"}]',
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.salarial_bonuses).toEqual([{ label: "Bono producción" }]);
  });

  it("rechaza salarial_bonuses con JSON inválido", () => {
    expect(
      validatePayrollRulesInput({ ...base, salarial_bonuses: "{no-json" }).fieldErrors
        ?.salarial_bonuses,
    ).toBeTruthy();
  });

  it("normaliza notas vacías a null", () => {
    const { input } = validatePayrollRulesInput({ ...base, notes: "   " });
    expect(input!.notes).toBeNull();
  });
});

describe("enums + helpers", () => {
  it("isPayFrequency / payFrequencyLabel", () => {
    expect(isPayFrequency("quincenal")).toBe(true);
    expect(isPayFrequency("anual")).toBe(false);
    expect(payFrequencyLabel("semanal")).toBe("Semanal");
    expect(payFrequencyLabel("xxx")).toBe("xxx");
  });

  it("isDayMethod / dayMethodLabel", () => {
    expect(isDayMethod("30")).toBe(true);
    expect(isDayMethod("real")).toBe(true);
    expect(isDayMethod("28")).toBe(false);
    expect(dayMethodLabel("real")).toBe("Días reales del mes");
  });

  it("estado del ruleset · label / tone / guard", () => {
    expect(payrollRulesStatusLabel("vigente")).toBe("Vigente");
    expect(payrollRulesStatusLabel("xxx")).toBe("xxx");
    expect(payrollRulesStatusTone("vigente")).toBe("success");
    expect(payrollRulesStatusTone("archivada")).toBe("neutral");
    expect(payrollRulesStatusTone("xxx")).toBe("neutral");
    expect(isPayrollRulesStatus("archivada")).toBe(true);
    expect(isPayrollRulesStatus("nope")).toBe(false);
  });
});
