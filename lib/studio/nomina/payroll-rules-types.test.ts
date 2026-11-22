// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validatePayrollRulesInput,
  PAYROLL_RULES_DEFAULTS,
  AJUSTES_LIQUIDACION_BASE,
  resolverAjustesLiquidacion,
  UTILIDADES_MIN_DAYS,
  isPayFrequency,
  isDayMethod,
  payFrequencyLabel,
  dayMethodLabel,
  payrollRulesStatusLabel,
  payrollRulesStatusTone,
  isPayrollRulesStatus,
  isFechaIso,
  isMonedaMonto,
  PENSION_CONTRIB_MAX_PCT,
  UTILIDADES_MAX_DAYS,
  MONTO_MAX,
  VIGENTE_DESDE_MIN,
  hoyCaracas,
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

describe("validatePayrollRulesInput · SDD-0653 A2b (migración 0556)", () => {
  const base = { pay_frequency: "mensual", day_method: "30" };
  const HOY = "2026-11-17";

  it("sin los campos nuevos NO inventa nada: lo configurable queda null y las monedas heredan", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({ ...base }, HOY);
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({
      vigente_desde: null,
      fuente_legal: null,
      ingreso_minimo_integral_usd: null,
      cestaticket_moneda: null,
      bono_guerra_moneda: null,
      sso_patronal_pct: null,
      rpe_patronal_pct: null,
      faov_patronal_pct: null,
      inces_patronal_pct: null,
      inces_utilidades_pct: null,
      pension_contrib_pct: null,
      vacaciones_extra_max: null,
      bono_vacacional_max_days: null,
    });
  });

  it("un campo vacío, en blanco o null cuenta como «sin configurar»", () => {
    const { input, fieldErrors } = validatePayrollRulesInput(
      { ...base, sso_patronal_pct: "", rpe_patronal_pct: "   ", pension_contrib_pct: null, vacaciones_extra_max: "", cestaticket_moneda: "" },
      HOY,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({
      sso_patronal_pct: null,
      rpe_patronal_pct: null,
      pension_contrib_pct: null,
      vacaciones_extra_max: null,
      cestaticket_moneda: null,
    });
  });

  it("el cero es un valor, no «sin configurar»", () => {
    const { input } = validatePayrollRulesInput({ ...base, sso_patronal_pct: "0", vacaciones_extra_max: "0", ingreso_minimo_integral_usd: "0" }, HOY);
    expect(input).toMatchObject({ sso_patronal_pct: 0, vacaciones_extra_max: 0, ingreso_minimo_integral_usd: 0 });
  });

  it("las propuestas de la norma del formulario no son un default del validador", () => {
    expect(PAYROLL_RULES_DEFAULTS).toMatchObject({
      sso_patronal_pct: 9,
      rpe_patronal_pct: 2,
      faov_patronal_pct: 2,
      inces_patronal_pct: 2,
      inces_utilidades_pct: 0.5,
      pension_contrib_pct: 9,
      vacaciones_extra_max: 15,
      bono_vacacional_max_days: 30,
      ingreso_minimo_integral_usd: null,
    });
    const { input } = validatePayrollRulesInput({ ...base }, HOY);
    expect(input!.sso_patronal_pct).toBeNull();
  });

  it("acepta y normaliza vigencia, fuente, monedas, ingreso mínimo, aportes y escalas", () => {
    const { input, fieldErrors } = validatePayrollRulesInput(
      {
        ...base,
        vigente_desde: "2026-11-01",
        fuente_legal: "  G.O. 6.691 Ext., Decreto 4.653  ",
        ingreso_minimo_integral_usd: "240",
        cestaticket_moneda: "VES",
        bono_guerra_moneda: "USD",
        sso_patronal_pct: "10",
        inces_utilidades_pct: "0.5",
        pension_contrib_pct: "15",
        vacaciones_extra_max: "10",
        bono_vacacional_max_days: "25",
      },
      HOY,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({
      vigente_desde: "2026-11-01",
      fuente_legal: "G.O. 6.691 Ext., Decreto 4.653",
      ingreso_minimo_integral_usd: 240,
      cestaticket_moneda: "VES",
      bono_guerra_moneda: "USD",
      sso_patronal_pct: 10,
      inces_utilidades_pct: 0.5,
      pension_contrib_pct: 15,
      vacaciones_extra_max: 10,
      bono_vacacional_max_days: 25,
    });
  });

  it("rechaza una fecha de vigencia que no existe", () => {
    for (const v of ["2026-02-31", "01/12/2026", "2026-13-01", "ayer"]) {
      expect(validatePayrollRulesInput({ ...base, vigente_desde: v }, HOY).fieldErrors?.vigente_desde, v).toBeTruthy();
    }
  });

  it("la vigencia no puede ser posterior a hoy en Caracas (es informativa)", () => {
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "2026-11-17" }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "2026-01-15" }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "2026-11-18" }, HOY).fieldErrors?.vigente_desde).toMatch(/posterior a hoy/);
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "2027-01-01" }, HOY).fieldErrors?.vigente_desde).toBeTruthy();
  });

  it("la vigencia tiene piso en 2000-01-01, igual que la función de la 0556: 1999 es error del campo", () => {
    expect(VIGENTE_DESDE_MIN).toBe("2000-01-01");
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "2000-01-01" }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, vigente_desde: "1999-12-31" }, HOY).fieldErrors?.vigente_desde).toMatch(
      /no puede ser anterior a 2000-01-01/,
    );
  });

  it("hoyCaracas usa la hora de Caracas (UTC-4), no la UTC", () => {
    expect(hoyCaracas(new Date("2026-11-18T02:00:00Z"))).toBe("2026-11-17");
    expect(hoyCaracas(new Date("2026-11-17T04:30:00Z"))).toBe("2026-11-17");
    expect(hoyCaracas(new Date("2026-11-17T03:59:00Z"))).toBe("2026-11-16");
  });

  it("la fuente legal admite hasta 200 caracteres", () => {
    expect(validatePayrollRulesInput({ ...base, fuente_legal: "x".repeat(200) }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, fuente_legal: "x".repeat(201) }, HOY).fieldErrors?.fuente_legal).toBeTruthy();
  });

  it("rechaza una moneda que no sea VES ni USD", () => {
    expect(validatePayrollRulesInput({ ...base, cestaticket_moneda: "EUR" }, HOY).fieldErrors?.cestaticket_moneda).toBeTruthy();
    expect(validatePayrollRulesInput({ ...base, bono_guerra_moneda: "usd" }, HOY).fieldErrors?.bono_guerra_moneda).toBeTruthy();
  });

  it("la contribución de pensiones tiene el tope legal de 15 % (Art. 7)", () => {
    expect(PENSION_CONTRIB_MAX_PCT).toBe(15);
    expect(validatePayrollRulesInput({ ...base, pension_contrib_pct: "15" }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, pension_contrib_pct: "15.01" }, HOY).fieldErrors?.pension_contrib_pct).toBeTruthy();
    expect(validatePayrollRulesInput({ ...base, pension_contrib_pct: "-1" }, HOY).fieldErrors?.pension_contrib_pct).toBeTruthy();
  });

  it("los aportes del patrono y la retención del INCES van de 0 a 100", () => {
    for (const campo of ["sso_patronal_pct", "rpe_patronal_pct", "faov_patronal_pct", "inces_patronal_pct", "inces_utilidades_pct"]) {
      expect(validatePayrollRulesInput({ ...base, [campo]: "100" }, HOY).fieldErrors, campo).toBeUndefined();
      expect(validatePayrollRulesInput({ ...base, [campo]: "100.5" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
      expect(validatePayrollRulesInput({ ...base, [campo]: "-1" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
      expect(validatePayrollRulesInput({ ...base, [campo]: "abc" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
    }
  });

  it("el INCES sobre utilidades es del trabajador: su etiqueta lo dice, no es del patrono", () => {
    const e = validatePayrollRulesInput({ ...base, inces_utilidades_pct: "200" }, HOY).fieldErrors?.inces_utilidades_pct;
    expect(e).toMatch(/retención al trabajador/);
    expect(e).not.toMatch(/patrono/);
  });

  it("utilidades: mínimo 30 y máximo 120 (LOTTT Art. 131)", () => {
    expect(UTILIDADES_MAX_DAYS).toBe(120);
    expect(validatePayrollRulesInput({ ...base, utilidades_days: "120" }, HOY).fieldErrors).toBeUndefined();
    expect(validatePayrollRulesInput({ ...base, utilidades_days: "121" }, HOY).fieldErrors?.utilidades_days).toMatch(/máximo legal 120/);
    expect(validatePayrollRulesInput({ ...base, utilidades_days: "29" }, HOY).fieldErrors?.utilidades_days).toMatch(/mínimo legal 30/);
  });

  it("las escalas por antigüedad son enteros de 0 a 365", () => {
    for (const campo of ["vacaciones_extra_max", "bono_vacacional_max_days"]) {
      expect(validatePayrollRulesInput({ ...base, [campo]: "365" }, HOY).fieldErrors, campo).toBeUndefined();
      expect(validatePayrollRulesInput({ ...base, [campo]: "366" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
      expect(validatePayrollRulesInput({ ...base, [campo]: "-1" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
      expect(validatePayrollRulesInput({ ...base, [campo]: "1.5" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
    }
  });

  it("el ingreso mínimo integral no puede ser negativo", () => {
    expect(validatePayrollRulesInput({ ...base, ingreso_minimo_integral_usd: "-1" }, HOY).fieldErrors?.ingreso_minimo_integral_usd).toBeTruthy();
  });

  it("un monto que desbordaría numeric(14,2) se rechaza antes de llegar a la base", () => {
    expect(MONTO_MAX).toBe(999_999_999_999.99);
    for (const campo of ["min_salary", "cestaticket", "bono_guerra", "ingreso_minimo_integral_usd"]) {
      expect(validatePayrollRulesInput({ ...base, [campo]: "999999999999.99" }, HOY).fieldErrors, campo).toBeUndefined();
      expect(validatePayrollRulesInput({ ...base, [campo]: "1000000000000" }, HOY).fieldErrors?.[campo], campo).toMatch(/no puede pasar de/);
      expect(validatePayrollRulesInput({ ...base, [campo]: "1e15" }, HOY).fieldErrors?.[campo], campo).toBeTruthy();
    }
  });

  it("isFechaIso e isMonedaMonto", () => {
    expect(isFechaIso("2026-11-17")).toBe(true);
    expect(isFechaIso("2024-02-29")).toBe(true);
    expect(isFechaIso("2026-02-29")).toBe(false);
    expect(isFechaIso(20261117)).toBe(false);
    expect(isMonedaMonto("VES")).toBe(true);
    expect(isMonedaMonto("USD")).toBe(true);
    expect(isMonedaMonto("EUR")).toBe(false);
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


describe("SDD-0658 · ajustes de la liquidación en el validador", () => {
  const base = { pay_frequency: "mensual", day_method: "30" };

  it("vacíos = null (se conservan los de la versión vigente), nunca un valor inventado", () => {
    const { input } = validatePayrollRulesInput({ ...base });
    expect(input).toMatchObject({ prestaciones_method: null, prestaciones_interest_pct: null, ajena_78_incluye_92: null });
  });

  it("acepta los tres métodos, el interés de 0 a 100 y sí/no", () => {
    const { input, fieldErrors } = validatePayrollRulesInput({
      ...base,
      prestaciones_method: "garantia",
      prestaciones_interest_pct: "15.255",
      ajena_78_incluye_92: "true",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toMatchObject({ prestaciones_method: "garantia", prestaciones_interest_pct: 15.26, ajena_78_incluye_92: true });
    expect(validatePayrollRulesInput({ ...base, ajena_78_incluye_92: "false" }).input?.ajena_78_incluye_92).toBe(false);
  });

  it("rechaza un método desconocido, un interés fuera de rango y una respuesta que no es sí/no", () => {
    expect(validatePayrollRulesInput({ ...base, prestaciones_method: "promedio" }).fieldErrors?.prestaciones_method).toBeTruthy();
    expect(validatePayrollRulesInput({ ...base, prestaciones_interest_pct: "100.5" }).fieldErrors?.prestaciones_interest_pct).toBeTruthy();
    expect(validatePayrollRulesInput({ ...base, prestaciones_interest_pct: "-1" }).fieldErrors?.prestaciones_interest_pct).toBeTruthy();
    expect(validatePayrollRulesInput({ ...base, ajena_78_incluye_92: "quizás" }).fieldErrors?.ajena_78_incluye_92).toBeTruthy();
  });

  it("resolverAjustesLiquidacion: formulario, después vigente, después los de fábrica", () => {
    const nada = { prestaciones_method: null, prestaciones_interest_pct: null, ajena_78_incluye_92: null } as const;
    expect(resolverAjustesLiquidacion(nada, null)).toEqual(AJUSTES_LIQUIDACION_BASE);
    expect(
      resolverAjustesLiquidacion(nada, { prestaciones_method: "retroactivo", prestaciones_interest_pct: 7, ajena_78_incluye_92: true }),
    ).toEqual({ prestaciones_method: "retroactivo", prestaciones_interest_pct: 7, ajena_78_incluye_92: true });
    expect(
      resolverAjustesLiquidacion(
        { prestaciones_method: "garantia", prestaciones_interest_pct: 0, ajena_78_incluye_92: false },
        { prestaciones_method: "retroactivo", prestaciones_interest_pct: 7, ajena_78_incluye_92: true },
      ),
    ).toEqual({ prestaciones_method: "garantia", prestaciones_interest_pct: 0, ajena_78_incluye_92: false });
  });
});
