/**
 * Tests del motor de liquidación / finiquito (SDD-0109). PUROS: cubren lo
 * MECÁNICO (mapa causa→renglones, fracciones, duplicación Art. 92, deducción
 * capada) y el ANTI-DRIFT del criterio salarial (el integral se mueve SOLO al
 * cambiar la config, no por una rama del código).
 */

import { describe, it, expect } from "vitest";
import {
  buildSalarioIntegral,
  calcLiquidacion,
  causeTriggersArt92,
  computePrestaciones,
  computeSeniority,
  salarialBonusesMonthlyUsd,
  settlementRulesFrom,
  computeSettlementKpis,
  canTransitionSettlement,
  validateGenerateSettlementInput,
  type SettlementRules,
} from "./settlement-types";

// Reglas base: salario mínimo de prestaciones, sin bonos salariales, método
// 'mejor', sin interés, Art. 78 no duplica (defaults del founder).
const baseRules: SettlementRules = {
  salarialBonuses: [],
  bonoVacacionalDays: 15,
  utilidadesDays: 30,
  vacacionesDays: 15,
  prestacionesMethod: "mejor",
  prestacionesInterestPct: 0,
  ajena78Incluye92: false,
};

describe("computeSeniority", () => {
  it("cuenta años + meses + días", () => {
    const s = computeSeniority("2022-01-15", "2026-06-27");
    expect(s.years).toBe(4);
    expect(s.totalMonths).toBe(53); // 4 años 5 meses
    expect(s.monthsInCurrentYear).toBe(5);
  });

  it("egreso anterior al ingreso → 0", () => {
    const s = computeSeniority("2026-06-27", "2022-01-15");
    expect(s.totalMonths).toBe(0);
    expect(s.years).toBe(0);
  });

  it("menos de un mes → 0 meses, días sueltos", () => {
    const s = computeSeniority("2026-06-01", "2026-06-20");
    expect(s.totalMonths).toBe(0);
    expect(s.years).toBe(0);
  });
});

describe("buildSalarioIntegral (PARAMETRIZADO)", () => {
  it("integral diario = normal + alícuotas (sin bonos)", () => {
    const i = buildSalarioIntegral(900, baseRules); // normal diario = 30
    expect(i.normalDaily).toBe(30);
    // alícuota bono vac = 30*15/360 = 1.25 ; utilidades = 30*30/360 = 2.5
    expect(i.alicuotaBonoVacacional).toBe(1.25);
    expect(i.alicuotaUtilidades).toBe(2.5);
    expect(i.salarialBonusesDaily).toBe(0);
    expect(i.integralDaily).toBe(33.75);
  });

  it("ANTI-DRIFT: el integral SOLO se mueve al cambiar la config, no el código", () => {
    const sinBono = buildSalarioIntegral(900, baseRules);
    const conBono = buildSalarioIntegral(900, {
      ...baseRules,
      salarialBonuses: [{ label: "Bono producción", monthly_usd: 300 }],
    });
    // 300/30 = 10 USD/día más en el integral.
    expect(conBono.integralDaily).toBe(sinBono.integralDaily + 10);
    // Mismo config → resultado estable (idempotente).
    expect(buildSalarioIntegral(900, baseRules).integralDaily).toBe(sinBono.integralDaily);
  });

  it("más días de utilidades en config → integral mayor", () => {
    const a = buildSalarioIntegral(900, baseRules);
    const b = buildSalarioIntegral(900, { ...baseRules, utilidadesDays: 60 });
    expect(b.integralDaily).toBeGreaterThan(a.integralDaily);
  });
});

describe("salarialBonusesMonthlyUsd", () => {
  it("suma montos de bonos con monthly_usd / amount_usd / amount", () => {
    expect(
      salarialBonusesMonthlyUsd([
        { label: "a", monthly_usd: 100 },
        { label: "b", amount_usd: 50 },
        { label: "c", amount: 25 },
      ]),
    ).toBe(175);
  });
  it("bonos sin monto numérico aportan 0 (advisory, no inventa)", () => {
    expect(salarialBonusesMonthlyUsd([{ label: "sin monto" }])).toBe(0);
  });
});

describe("causeTriggersArt92 (mapa causa→indemnización)", () => {
  it("despido injustificado SIEMPRE duplica", () => {
    expect(causeTriggersArt92("despido_injustificado_92", false)).toBe(true);
  });
  it("renuncia y despido justificado NUNCA duplican", () => {
    expect(causeTriggersArt92("renuncia_76", true)).toBe(false);
    expect(causeTriggersArt92("despido_justificado_79", true)).toBe(false);
  });
  it("causas ajenas (Art. 78) depende de la config", () => {
    expect(causeTriggersArt92("ajena_78", false)).toBe(false);
    expect(causeTriggersArt92("ajena_78", true)).toBe(true);
  });
});

describe("computePrestaciones (método)", () => {
  const seniority = computeSeniority("2022-01-01", "2026-01-01"); // 4 años justos
  it("'mejor' toma la mayor entre garantía y retroactivo", () => {
    const r = computePrestaciones(seniority, 33.75, "mejor");
    const g = computePrestaciones(seniority, 33.75, "garantia");
    const rt = computePrestaciones(seniority, 33.75, "retroactivo");
    expect(r.amount).toBe(Math.max(g.amount, rt.amount));
  });
  it("retroactivo = 30 días/año × integral", () => {
    const rt = computePrestaciones(seniority, 33.75, "retroactivo");
    expect(rt.days).toBe(120); // 30 × 4 años
    expect(rt.amount).toBe(4050); // 120 × 33.75
  });
});

describe("calcLiquidacion (integración)", () => {
  it("despido injustificado: incluye indemnización = prestaciones", () => {
    const r = calcLiquidacion({
      cause: "despido_injustificado_92",
      hireDate: "2022-01-01",
      terminationDate: "2026-01-01",
      baseSalaryUsd: 900,
      rules: baseRules,
      loanBalanceUsd: 0,
    });
    expect(r.totals.indemnizacion_usd).toBe(r.totals.prestaciones_usd);
    expect(r.totals.indemnizacion_usd).toBeGreaterThan(0);
    expect(r.advisory).toBe(true);
  });

  it("renuncia: SIN indemnización Art. 92", () => {
    const r = calcLiquidacion({
      cause: "renuncia_76",
      hireDate: "2022-01-01",
      terminationDate: "2026-01-01",
      baseSalaryUsd: 900,
      rules: baseRules,
      loanBalanceUsd: 0,
    });
    expect(r.totals.indemnizacion_usd).toBe(0);
    expect(r.lines.find((l) => l.kind === "indemnizacion_92")).toBeUndefined();
  });

  it("cambiar la CAUSA cambia el resultado (mismo empleado/config)", () => {
    const common = {
      hireDate: "2022-01-01",
      terminationDate: "2026-01-01",
      baseSalaryUsd: 900,
      rules: baseRules,
      loanBalanceUsd: 0,
    } as const;
    const renuncia = calcLiquidacion({ ...common, cause: "renuncia_76" });
    const despido = calcLiquidacion({ ...common, cause: "despido_injustificado_92" });
    expect(despido.totals.net_usd).toBeGreaterThan(renuncia.totals.net_usd);
  });

  it("fracciones proporcionales a los meses del año en curso", () => {
    // 6 meses en el año en curso → media fracción anual.
    const r = calcLiquidacion({
      cause: "renuncia_76",
      hireDate: "2025-07-01",
      terminationDate: "2026-01-01", // 6 meses justos
      baseSalaryUsd: 900,
      rules: baseRules,
      loanBalanceUsd: 0,
    });
    const vac = r.lines.find((l) => l.kind === "vacaciones_frac");
    // vacaciones_days 15 × 6/12 = 7.5 días.
    expect(vac?.days).toBe(7.5);
  });

  it("deducción de préstamo capada al bruto (nunca neto negativo)", () => {
    const r = calcLiquidacion({
      cause: "renuncia_76",
      hireDate: "2025-11-01",
      terminationDate: "2025-12-01", // antigüedad mínima → bruto chico
      baseSalaryUsd: 900,
      rules: baseRules,
      loanBalanceUsd: 999999,
    });
    expect(r.totals.net_usd).toBe(0);
    expect(r.totals.deductions_usd).toBeGreaterThanOrEqual(0);
  });

  it("Art. 78 con config ajena78Incluye92 duplica; sin ella no", () => {
    const common = {
      cause: "ajena_78" as const,
      hireDate: "2022-01-01",
      terminationDate: "2026-01-01",
      baseSalaryUsd: 900,
      loanBalanceUsd: 0,
    };
    const sin = calcLiquidacion({ ...common, rules: baseRules });
    const con = calcLiquidacion({ ...common, rules: { ...baseRules, ajena78Incluye92: true } });
    expect(sin.totals.indemnizacion_usd).toBe(0);
    expect(con.totals.indemnizacion_usd).toBeGreaterThan(0);
  });
});

describe("settlementRulesFrom", () => {
  it("mapea snapshot DB → SettlementRules con defaults seguros", () => {
    const r = settlementRulesFrom({
      salarial_bonuses: [{ label: "x", monthly_usd: 10 }],
      bono_vacacional_days: 15,
      utilidades_days: 30,
      vacaciones_days: 15,
      prestaciones_method: "retroactivo",
      prestaciones_interest_pct: 12,
      ajena_78_incluye_92: true,
    });
    expect(r.prestacionesMethod).toBe("retroactivo");
    expect(r.prestacionesInterestPct).toBe(12);
    expect(r.ajena78Incluye92).toBe(true);
    expect(r.salarialBonuses.length).toBe(1);
  });
  it("snapshot viejo (sin campos 0109) → defaults 'mejor' / false / 0", () => {
    const r = settlementRulesFrom({ bono_vacacional_days: 15, utilidades_days: 30 });
    expect(r.prestacionesMethod).toBe("mejor");
    expect(r.prestacionesInterestPct).toBe(0);
    expect(r.ajena78Incluye92).toBe(false);
  });
});

describe("computeSettlementKpis", () => {
  it("excluye anulados del neto y los conteos vivos", () => {
    const k = computeSettlementKpis([
      { status: "borrador", total_net_usd: 100 },
      { status: "confirmado", total_net_usd: 200 },
      { status: "anulado", total_net_usd: 999 },
    ]);
    expect(k.net_usd).toBe(300);
    expect(k.draft_count).toBe(1);
    expect(k.confirmed_count).toBe(1);
    expect(k.total_count).toBe(3);
  });
});

describe("canTransitionSettlement", () => {
  it("borrador→confirmado y →anulado; confirmado→anulado; nada desde anulado", () => {
    expect(canTransitionSettlement("borrador", "confirmado")).toBe(true);
    expect(canTransitionSettlement("borrador", "anulado")).toBe(true);
    expect(canTransitionSettlement("confirmado", "anulado")).toBe(true);
    expect(canTransitionSettlement("confirmado", "borrador")).toBe(false);
    expect(canTransitionSettlement("anulado", "confirmado")).toBe(false);
  });
});

describe("validateGenerateSettlementInput", () => {
  it("acepta input válido", () => {
    const { input, fieldErrors } = validateGenerateSettlementInput({
      employee_id: "uuid-1",
      termination_cause: "renuncia_76",
      termination_date: "2026-06-27",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.termination_cause).toBe("renuncia_76");
  });
  it("rechaza causa inválida y fecha faltante", () => {
    const { input, fieldErrors } = validateGenerateSettlementInput({
      employee_id: "uuid-1",
      termination_cause: "no-existe",
      termination_date: "",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.termination_cause).toBeTruthy();
    expect(fieldErrors?.termination_date).toBeTruthy();
  });
});
