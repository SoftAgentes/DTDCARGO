// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calcReciboDraft,
  calcRulesFrom,
  computePayrollRunKpis,
  validateGeneratePayrollRunInput,
  canTransitionPayrollRun,
  periodDaysForFrequency,
  topesNecesitanTasa,
  FaltaTasaParaTopeError,
  daysBetweenInclusive,
  payrollRunStatusLabel,
  payrollRunStatusTone,
  isPayrollRunStatus,
  type CalcRules,
  type PayrollRunStatus,
} from "./payroll-run-types";

// Reglas mecánicas base (espejo de los defaults de payroll_rules).
// `ves_per_usd: 0.13` es una tasa ficticia: con el salario mínimo en 130 Bs deja el
// salario mínimo en USD 1.000 y el tope muy por encima de los sueldos de estas
// pruebas, que no son sobre el tope. Los topes se prueban abajo con tasas explícitas.
const RULES: CalcRules = {
  pay_frequency: "mensual",
  day_method: "30",
  min_salary: 130,
  ves_per_usd: 0.13,
  sso_pct: 4,
  rpe_pct: 0.5,
  faov_pct: 1,
  sso_cap_sm: 5,
  rpe_cap_sm: 10,
  overtime_pct: 50,
  night_pct: 30,
};

describe("periodDaysForFrequency", () => {
  it("mensual = 30 (método 30 fijos)", () => {
    expect(periodDaysForFrequency("mensual", "30", 31)).toBe(30);
  });
  it("quincenal = la mitad del mes", () => {
    expect(periodDaysForFrequency("quincenal", "30", 31)).toBe(15);
  });
  it("semanal = un cuarto del mes", () => {
    expect(periodDaysForFrequency("semanal", "30", 31)).toBe(7.5);
  });
  it("método real usa los días reales del rango", () => {
    expect(periodDaysForFrequency("mensual", "real", 28)).toBe(28);
  });
});

describe("daysBetweenInclusive", () => {
  it("cuenta inclusive ambos extremos", () => {
    expect(daysBetweenInclusive("2026-06-01", "2026-06-30")).toBe(30);
    expect(daysBetweenInclusive("2026-02-01", "2026-02-28")).toBe(28);
  });
  it("0 si el rango es inválido", () => {
    expect(daysBetweenInclusive("2026-06-30", "2026-06-01")).toBe(0);
    expect(daysBetweenInclusive("xx", "2026-06-01")).toBe(0);
  });
});

describe("calcReciboDraft — prorrateo mensual base", () => {
  it("sin asistencia ni horas: sueldo del período = base completo (mensual)", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    // Sueldo del período = 600. Deducciones SSO 4% + RPE 0.5% + FAOV 1% = 5.5% de 600 = 33.
    expect(r.gross_usd).toBe(600);
    expect(r.statutory_deductions_usd).toBe(33);
    expect(r.loan_deduction_usd).toBe(0);
    expect(r.net_usd).toBe(567);
    expect(r.worked_days).toBe(30);
  });

  it("quincenal prorratea el sueldo a la mitad", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: { ...RULES, pay_frequency: "quincenal" },
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    // 15 días × (600/30) = 300.
    expect(r.gross_usd).toBe(300);
  });

  it("worked_days menor al período prorratea por días reales trabajados", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 15, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    // 15 × 20 = 300.
    expect(r.gross_usd).toBe(300);
    expect(r.worked_days).toBe(15);
  });
});

describe("calcReciboDraft — horas extra y nocturnas (recargos)", () => {
  it("hora extra = horas × valor_hora × (1 + overtime_pct/100)", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 30, overtime_hours: 10, night_hours: 0 },
      loan: null,
    });
    // valor hora = 600/30/8 = 2.5; extra = 10 × 2.5 × 1.5 = 37.5
    expect(r.overtime_pay_usd).toBe(37.5);
    expect(r.gross_usd).toBe(637.5);
  });

  it("bono nocturno = horas × valor_hora × (night_pct/100)", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 30, overtime_hours: 0, night_hours: 8 },
      loan: null,
    });
    // 8 × 2.5 × 0.30 = 6
    expect(r.night_pay_usd).toBe(6);
    expect(r.gross_usd).toBe(606);
  });
});

describe("calcReciboDraft — deducciones con topes en SM (SDD-0653 D6)", () => {
  const sinAsistencia = { worked_days: 0, overtime_hours: 0, night_hours: 0 };
  // Salario mínimo 130 Bs y 13 Bs por USD → el salario mínimo vale USD 10.
  // Tope mensual: SSO 5 SM = USD 50 · RPE 10 SM = USD 100.
  const A_13: CalcRules = { ...RULES, ves_per_usd: 13 };

  it("el tope sale en Bs y se pasa a USD con la tasa: el sueldo en USD no se compara con los Bs", () => {
    const r = calcReciboDraft({ base_salary_usd: 800, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    // SSO 4 % de min(800, 50) = 2 · RPE 0,5 % de min(800, 100) = 0,5 · FAOV 1 % de 800 (sin tope) = 8
    expect(r.statutory_deductions_usd).toBe(10.5);
    expect(r.net_usd).toBe(789.5);
  });

  it("antes de la corrección, 650 contaba como USD: con 130 Bs el tope en USD es otro", () => {
    // El motor viejo cotizaba SSO sobre min(800, 650) = 650 → 26. Ahora sobre USD 50 → 2.
    const r = calcReciboDraft({ base_salary_usd: 800, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    const sso = r.breakdown.find((b) => b.label === "SSO / IVSS")!;
    expect(sso.amount_usd).toBe(-2);
    expect(sso.note).toContain("Bs 650");
    expect(sso.note).toContain("USD 50");
    expect(sso.note).toContain("Bs 13/USD");
  });

  it("con un sueldo por debajo del tope cotiza sobre el sueldo completo", () => {
    const r = calcReciboDraft({ base_salary_usd: 40, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    // 4 % de 40 = 1,6 · 0,5 % de 40 = 0,2 · 1 % de 40 = 0,4
    expect(r.statutory_deductions_usd).toBe(2.2);
  });

  it("el tope mensual se prorratea al período: quincenal topa a la mitad", () => {
    const r = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, pay_frequency: "quincenal" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    // Sueldo de la quincena 400. Tope SSO 50 × 15/30 = 25 → 1 · RPE 100 × 15/30 = 50 → 0,25 · FAOV 4
    expect(r.statutory_deductions_usd).toBe(5.25);
  });

  it("semanal topa a un cuarto del tope mensual", () => {
    const r = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, pay_frequency: "semanal" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    // 7,5 días: sueldo 200. Tope SSO 50 × 7,5/30 = 12,5 → 0,5 · RPE 25 → 0,125 · FAOV 2
    const sso = r.breakdown.find((b) => b.label === "SSO / IVSS")!;
    expect(sso.amount_usd).toBe(-0.5);
    const faov = r.breakdown.find((b) => b.label === "FAOV")!;
    expect(faov.amount_usd).toBe(-2); // FAOV no tiene tope
  });

  it("con la misma deducción mensual da lo mismo en un solo corte que en dos quincenas", () => {
    const mes = calcReciboDraft({ base_salary_usd: 800, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    const quincena = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, pay_frequency: "quincenal" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    expect(round(quincena.statutory_deductions_usd * 2)).toBe(mes.statutory_deductions_usd);
  });

  it("cambia con la tasa: a más Bs por USD, menor el tope en USD", () => {
    const barata = calcReciboDraft({ base_salary_usd: 800, rules: { ...A_13, ves_per_usd: 13 }, period_days: 30, attendance: sinAsistencia, loan: null });
    const cara = calcReciboDraft({ base_salary_usd: 800, rules: { ...A_13, ves_per_usd: 130 }, period_days: 30, attendance: sinAsistencia, loan: null });
    expect(cara.statutory_deductions_usd).toBeLessThan(barata.statutory_deductions_usd);
    // 130 Bs/USD → SM = USD 1: SSO 4 % de 5 = 0,2 · RPE 0,5 % de 10 = 0,05 · FAOV 8
    expect(cara.statutory_deductions_usd).toBe(8.25);
  });

  it("con topes activos y sin tasa se niega: no calcula Bs contra USD en silencio", () => {
    for (const ves_per_usd of [undefined, null, 0, -5]) {
      expect(() =>
        calcReciboDraft({ base_salary_usd: 800, rules: { ...RULES, ves_per_usd }, period_days: 30, attendance: sinAsistencia, loan: null }),
      ).toThrow(FaltaTasaParaTopeError);
    }
  });

  it("sin tope (cap=0 o min_salary=0) cotiza sobre el sueldo completo y no necesita tasa", () => {
    const sinSalarioMinimo = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...RULES, min_salary: 0, ves_per_usd: null },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    // 5.5% de 800 = 44
    expect(sinSalarioMinimo.statutory_deductions_usd).toBe(44);
    const sinTopes = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...RULES, sso_cap_sm: 0, rpe_cap_sm: 0, ves_per_usd: null },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    expect(sinTopes.statutory_deductions_usd).toBe(44);
  });

  it("topesNecesitanTasa: solo con salario mínimo y algún tope mayores que cero", () => {
    expect(topesNecesitanTasa({ min_salary: 130, sso_cap_sm: 5, rpe_cap_sm: 10 })).toBe(true);
    expect(topesNecesitanTasa({ min_salary: 130, sso_cap_sm: 0, rpe_cap_sm: 10 })).toBe(true);
    expect(topesNecesitanTasa({ min_salary: 130, sso_cap_sm: 0, rpe_cap_sm: 0 })).toBe(false);
    expect(topesNecesitanTasa({ min_salary: 0, sso_cap_sm: 5, rpe_cap_sm: 10 })).toBe(false);
  });

  it("calcRulesFrom pasa la tasa y descarta una inválida", () => {
    const base = { ...RULES };
    expect(calcRulesFrom(base, 130).ves_per_usd).toBe(130);
    expect(calcRulesFrom(base).ves_per_usd).toBeNull();
    expect(calcRulesFrom(base, 0).ves_per_usd).toBeNull();
  });

  it("período parcial con días trabajados: el tope se prorratea con los días trabajados", () => {
    const r = calcReciboDraft({
      base_salary_usd: 800,
      rules: A_13,
      period_days: 30,
      attendance: { worked_days: 10, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    // Sueldo de 10 días = 800/30×10 = 266,67. Tope SSO 50×10/30 = 16,67 → 0,67 · RPE 100×10/30 = 33,33 → 0,17 · FAOV 2,67
    expect(r.gross_usd).toBe(266.67);
    expect(r.breakdown.find((b) => b.label === "SSO / IVSS")!.amount_usd).toBe(-0.67);
    expect(r.breakdown.find((b) => b.label === "RPE")!.amount_usd).toBe(-0.17);
    expect(r.breakdown.find((b) => b.label === "FAOV")!.amount_usd).toBe(-2.67);
    expect(r.statutory_deductions_usd).toBe(3.51);
  });

  it("sueldo exactamente igual al tope: cotiza sobre el sueldo, que es el tope", () => {
    const r = calcReciboDraft({ base_salary_usd: 50, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    expect(r.breakdown.find((b) => b.label === "SSO / IVSS")!.amount_usd).toBe(-2);
    expect(r.breakdown.find((b) => b.label === "RPE")!.amount_usd).toBe(-0.25);
    expect(r.statutory_deductions_usd).toBe(2.75);
    // Un dólar por encima del tope, el SSO no sube.
    const encima = calcReciboDraft({ base_salary_usd: 51, rules: A_13, period_days: 30, attendance: sinAsistencia, loan: null });
    expect(encima.breakdown.find((b) => b.label === "SSO / IVSS")!.amount_usd).toBe(-2);
  });

  it("RPE semanal: 0,5 % de 25 es 0,125 y el recibo lo redondea a 0,13", () => {
    const r = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, pay_frequency: "semanal" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    expect(r.breakdown.find((b) => b.label === "RPE")!.amount_usd).toBe(-0.13);
    expect(r.statutory_deductions_usd).toBe(2.63);
  });

  it("el renglón del recibo dice qué tasa se usó, con su fecha, y marca la provisional", () => {
    const definitiva = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, ves_tasa_nota: "BCV del 2026-11-30" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    expect(definitiva.breakdown.find((b) => b.label === "SSO / IVSS")!.note).toContain("a Bs 13/USD, tasa BCV del 2026-11-30");
    const provisional = calcReciboDraft({
      base_salary_usd: 800,
      rules: { ...A_13, ves_tasa_nota: "PROVISIONAL BCV del 2026-11-17" },
      period_days: 30,
      attendance: sinAsistencia,
      loan: null,
    });
    expect(provisional.breakdown.find((b) => b.label === "RPE")!.note).toContain("tasa PROVISIONAL BCV del 2026-11-17");
  });

  it("calcRulesFrom pasa la nota de la tasa", () => {
    expect(calcRulesFrom({ ...RULES }, 130, "BCV del 2026-11-30").ves_tasa_nota).toBe("BCV del 2026-11-30");
    expect(calcRulesFrom({ ...RULES }, 130).ves_tasa_nota).toBeNull();
  });
});

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

describe("calcReciboDraft — cuota de préstamo capada al saldo", () => {
  it("descuenta la cuota completa si hay saldo suficiente", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: { installment_usd: 25, balance_usd: 250 },
    });
    expect(r.loan_deduction_usd).toBe(25);
  });

  it("capa el descuento al saldo cuando la cuota lo supera", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: { installment_usd: 25, balance_usd: 10 },
    });
    // min(25, 10) = 10
    expect(r.loan_deduction_usd).toBe(10);
    expect(r.total_deductions_usd).toBe(43); // 33 estatutarias + 10 cuota
    expect(r.net_usd).toBe(557);
  });

  it("sin préstamo no descuenta cuota", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    expect(r.loan_deduction_usd).toBe(0);
  });
});

describe("calcReciboDraft — frontera: salarial_bonuses IGNORADO", () => {
  it("calcRulesFrom NO incluye salarial_bonuses en el subconjunto mecánico", () => {
    const calcRules = calcRulesFrom({
      pay_frequency: "mensual",
      day_method: "30",
      min_salary: 130,
      sso_pct: 4,
      rpe_pct: 0.5,
      faov_pct: 1,
      sso_cap_sm: 5,
      rpe_cap_sm: 10,
      overtime_pct: 50,
      night_pct: 30,
    });
    expect(calcRules).not.toHaveProperty("salarial_bonuses");
  });

  it("el recibo NO cambia aunque las reglas traigan bonos salariales (no se consumen)", () => {
    // CalcRules ni siquiera tipa salarial_bonuses; aunque se cuele por casting,
    // calcReciboDraft no lo lee → la base de cotización es el sueldo base puro.
    const rulesConBonos = {
      ...RULES,
      salarial_bonuses: [{ label: "Bono de productividad", amount: 200 }],
    } as unknown as CalcRules;
    const conBonos = calcReciboDraft({
      base_salary_usd: 600,
      rules: rulesConBonos,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    const sinBonos = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 0, overtime_hours: 0, night_hours: 0 },
      loan: null,
    });
    expect(conBonos.gross_usd).toBe(sinBonos.gross_usd);
    expect(conBonos.statutory_deductions_usd).toBe(sinBonos.statutory_deductions_usd);
    expect(conBonos.net_usd).toBe(sinBonos.net_usd);
  });
});

describe("calcReciboDraft — breakdown transparente", () => {
  it("incluye un renglón por componente, deducciones en negativo", () => {
    const r = calcReciboDraft({
      base_salary_usd: 600,
      rules: RULES,
      period_days: 30,
      attendance: { worked_days: 30, overtime_hours: 10, night_hours: 8 },
      loan: { installment_usd: 25, balance_usd: 250 },
    });
    const labels = r.breakdown.map((b) => b.label);
    expect(labels).toContain("Sueldo del período");
    expect(labels).toContain("Horas extra");
    expect(labels).toContain("Bono nocturno");
    expect(labels).toContain("SSO / IVSS");
    expect(labels).toContain("Cuota de préstamo");
    // Las deducciones van en negativo.
    const sso = r.breakdown.find((b) => b.label === "SSO / IVSS")!;
    expect(sso.amount_usd).toBeLessThan(0);
  });
});

describe("canTransitionPayrollRun", () => {
  it("borrador → confirmado → pagado en cadena", () => {
    expect(canTransitionPayrollRun("borrador", "confirmado")).toBe(true);
    expect(canTransitionPayrollRun("confirmado", "pagado")).toBe(true);
  });
  it("→ anulado desde cualquier estado vivo", () => {
    expect(canTransitionPayrollRun("borrador", "anulado")).toBe(true);
    expect(canTransitionPayrollRun("confirmado", "anulado")).toBe(true);
    expect(canTransitionPayrollRun("pagado", "anulado")).toBe(true);
  });
  it("rechaza saltos inválidos", () => {
    expect(canTransitionPayrollRun("borrador", "pagado")).toBe(false);
    expect(canTransitionPayrollRun("pagado", "confirmado")).toBe(false);
    expect(canTransitionPayrollRun("anulado", "borrador")).toBe(false);
  });
});

describe("computePayrollRunKpis", () => {
  it("cuenta vivos/borradores y suma neto de los no anulados", () => {
    const runs: { status: PayrollRunStatus; total_net_usd: number }[] = [
      { status: "borrador", total_net_usd: 1000 },
      { status: "confirmado", total_net_usd: 2000 },
      { status: "pagado", total_net_usd: 3000 },
      { status: "anulado", total_net_usd: 9999 },
    ];
    const k = computePayrollRunKpis(runs);
    expect(k.total_count).toBe(4);
    expect(k.live_count).toBe(3);
    expect(k.draft_count).toBe(1);
    expect(k.net_usd).toBe(6000); // anulado excluido
  });
});

describe("validateGeneratePayrollRunInput", () => {
  const base = {
    period_label: "2026-06",
    period_start: "2026-06-01",
    period_end: "2026-06-30",
  };

  it("acepta input válido", () => {
    const { input, fieldErrors } = validateGeneratePayrollRunInput(base);
    expect(fieldErrors).toBeUndefined();
    expect(input!.period_label).toBe("2026-06");
    expect(input!.period_start).toBe("2026-06-01");
    expect(input!.period_end).toBe("2026-06-30");
  });

  it("exige period_label", () => {
    expect(
      validateGeneratePayrollRunInput({ ...base, period_label: "" }).fieldErrors?.period_label,
    ).toBeTruthy();
  });

  it("exige fechas válidas", () => {
    expect(
      validateGeneratePayrollRunInput({ ...base, period_start: "01-06-2026" }).fieldErrors
        ?.period_start,
    ).toBeTruthy();
    expect(
      validateGeneratePayrollRunInput({ ...base, period_end: "" }).fieldErrors?.period_end,
    ).toBeTruthy();
  });

  it("rechaza fin anterior al inicio", () => {
    expect(
      validateGeneratePayrollRunInput({
        ...base,
        period_start: "2026-06-30",
        period_end: "2026-06-01",
      }).fieldErrors?.period_end,
    ).toBeTruthy();
  });
});

describe("helpers de estado del corte", () => {
  it("label/tone/guard", () => {
    expect(payrollRunStatusLabel("borrador")).toBe("Borrador");
    expect(payrollRunStatusLabel("pagado")).toBe("Pagado");
    expect(payrollRunStatusTone("pagado")).toBe("success");
    expect(payrollRunStatusTone("anulado")).toBe("danger");
    expect(isPayrollRunStatus("confirmado")).toBe(true);
    expect(isPayrollRunStatus("liquidado")).toBe(false);
  });
});
