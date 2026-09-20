// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateEmployeeInput,
  computeEmployeeKpis,
  employeeStatusLabel,
  employeeStatusTone,
  isEmployeeStatus,
  employeeMatchesFilter,
  num,
  round2,
  type EmployeeStatus,
} from "./employee-types";

describe("validateEmployeeInput", () => {
  const base = { full_name: "María González", salary_usd: "500" };

  it("acepta un input válido y normaliza", () => {
    const { input, fieldErrors } = validateEmployeeInput({
      ...base,
      email: "maria@dtd.test",
      status: "activo",
      bank_account_type: "ahorro",
      hire_date: "2024-01-15",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.full_name).toBe("María González");
    expect(input!.salary_usd).toBe(500);
    expect(input!.bank_account_type).toBe("ahorro");
    expect(input!.status).toBe("activo");
  });

  it("exige el nombre", () => {
    const { input, fieldErrors } = validateEmployeeInput({ ...base, full_name: "  " });
    expect(input).toBeNull();
    expect(fieldErrors?.full_name).toBeTruthy();
  });

  it("rechaza sueldo negativo", () => {
    const { fieldErrors } = validateEmployeeInput({ ...base, salary_usd: "-1" });
    expect(fieldErrors?.salary_usd).toBeTruthy();
  });

  it("default de sueldo 0 es válido", () => {
    const { input, fieldErrors } = validateEmployeeInput({ full_name: "Sin Sueldo" });
    expect(fieldErrors).toBeUndefined();
    expect(input!.salary_usd).toBe(0);
  });

  it("rechaza email inválido pero acepta vacío", () => {
    expect(validateEmployeeInput({ ...base, email: "no-email" }).fieldErrors?.email).toBeTruthy();
    expect(validateEmployeeInput({ ...base, email: "" }).fieldErrors).toBeUndefined();
  });

  it("rechaza estado y tipo de cuenta inválidos", () => {
    expect(validateEmployeeInput({ ...base, status: "fantasma" }).fieldErrors?.status).toBeTruthy();
    expect(
      validateEmployeeInput({ ...base, bank_account_type: "cripto" }).fieldErrors?.bank_account_type,
    ).toBeTruthy();
  });

  it("rechaza fecha de ingreso con formato inválido", () => {
    expect(validateEmployeeInput({ ...base, hire_date: "15/01/2024" }).fieldErrors?.hire_date).toBeTruthy();
    expect(validateEmployeeInput({ ...base, hire_date: "" }).fieldErrors).toBeUndefined();
  });

  it("normaliza campos opcionales vacíos a null", () => {
    const { input } = validateEmployeeInput({ ...base, phone: "  ", department: "" });
    expect(input!.phone).toBeNull();
    expect(input!.department).toBeNull();
  });
});

describe("computeEmployeeKpis", () => {
  it("cuenta activos/inactivos y suma SOLO el sueldo de activos", () => {
    const rows: { status: EmployeeStatus; salary_usd: unknown }[] = [
      { status: "activo", salary_usd: "700" },
      { status: "activo", salary_usd: 300 },
      { status: "inactivo", salary_usd: "999" },
      { status: "egresado", salary_usd: "999" },
    ];
    const k = computeEmployeeKpis(rows);
    expect(k.active_count).toBe(2);
    expect(k.inactive_count).toBe(1);
    expect(k.total_count).toBe(4);
    expect(k.monthly_payroll_usd).toBe(1000);
  });

  it("lista vacía = ceros", () => {
    const k = computeEmployeeKpis([]);
    expect(k).toEqual({
      active_count: 0,
      inactive_count: 0,
      total_count: 0,
      monthly_payroll_usd: 0,
    });
  });
});

describe("helpers de estado", () => {
  it("label/tone/guard", () => {
    expect(employeeStatusLabel("activo")).toBe("Activo");
    expect(employeeStatusLabel("xxx")).toBe("xxx");
    expect(employeeStatusTone("egresado")).toBe("warning");
    expect(employeeStatusTone("xxx")).toBe("neutral");
    expect(isEmployeeStatus("activo")).toBe(true);
    expect(isEmployeeStatus("nope")).toBe(false);
  });

  it("employeeMatchesFilter", () => {
    expect(employeeMatchesFilter({ status: "activo" }, "todos")).toBe(true);
    expect(employeeMatchesFilter({ status: "activo" }, "activo")).toBe(true);
    expect(employeeMatchesFilter({ status: "inactivo" }, "activo")).toBe(false);
  });
});

describe("num / round2", () => {
  it("num coacciona a finito con default 0", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
  });
  it("round2 redondea a 2 decimales", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3); // 0.30000000000000004 → 0.3
    expect(round2(1.2345)).toBe(1.23);
    expect(round2(2.1)).toBe(2.1);
    expect(round2(5)).toBe(5);
  });
});
