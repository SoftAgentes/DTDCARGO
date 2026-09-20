// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateWarningInput,
  computeWarningKpis,
  warningSeverityLabel,
  warningSeverityTone,
  warningStatusLabel,
  warningStatusTone,
  isWarningSeverity,
  isWarningStatus,
  isWarningCode,
  warningMatchesFilter,
  ART79_CAUSES,
  type WarningSeverity,
  type WarningStatus,
} from "./warning-types";

describe("validateWarningInput", () => {
  const base = {
    employee_id: "emp-uuid-1",
    cause: "Inasistencia injustificada (Art. 79, lit. f)",
    narrative: "No se presentó a su jornada el 15/05 sin avisar.",
  };

  it("acepta un input válido y normaliza", () => {
    const { input, fieldErrors } = validateWarningInput({
      ...base,
      severity: "grave",
      witnesses: "Supervisor de almacén",
      issued_on: "2026-05-18",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.employee_id).toBe("emp-uuid-1");
    expect(input!.severity).toBe("grave");
    expect(input!.witnesses).toBe("Supervisor de almacén");
    expect(input!.issued_on).toBe("2026-05-18");
  });

  it("default de severidad = leve y fecha por defecto = hoy", () => {
    const { input, fieldErrors } = validateWarningInput(base);
    expect(fieldErrors).toBeUndefined();
    expect(input!.severity).toBe("leve");
    expect(input!.issued_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("exige empleado, causa y relato", () => {
    expect(validateWarningInput({ ...base, employee_id: "  " }).fieldErrors?.employee_id).toBeTruthy();
    expect(validateWarningInput({ ...base, cause: "" }).fieldErrors?.cause).toBeTruthy();
    expect(validateWarningInput({ ...base, narrative: "   " }).fieldErrors?.narrative).toBeTruthy();
  });

  it("rechaza severidad inválida", () => {
    expect(validateWarningInput({ ...base, severity: "catastrofica" }).fieldErrors?.severity).toBeTruthy();
  });

  it("rechaza fecha con formato inválido pero acepta vacía", () => {
    expect(validateWarningInput({ ...base, issued_on: "18/05/2026" }).fieldErrors?.issued_on).toBeTruthy();
    expect(validateWarningInput({ ...base, issued_on: "" }).fieldErrors).toBeUndefined();
  });

  it("normaliza testigos vacíos a null", () => {
    const { input } = validateWarningInput({ ...base, witnesses: "  " });
    expect(input!.witnesses).toBeNull();
  });

  it("rechaza relato demasiado largo", () => {
    const { fieldErrors } = validateWarningInput({ ...base, narrative: "x".repeat(2001) });
    expect(fieldErrors?.narrative).toBeTruthy();
  });
});

describe("computeWarningKpis", () => {
  const now = new Date("2026-05-20T12:00:00Z");
  it("cuenta emitidas, del mes y graves (ignora anuladas)", () => {
    const rows: { status: WarningStatus; severity: WarningSeverity; issued_on: string }[] = [
      { status: "emitida", severity: "leve", issued_on: "2026-05-18" },
      { status: "emitida", severity: "grave", issued_on: "2026-05-01" },
      { status: "emitida", severity: "muy_grave", issued_on: "2026-04-30" },
      { status: "anulada", severity: "muy_grave", issued_on: "2026-05-10" },
    ];
    const k = computeWarningKpis(rows, now);
    expect(k.total_count).toBe(4);
    expect(k.active_count).toBe(3);
    expect(k.this_month_count).toBe(2); // las dos emitidas de mayo
    expect(k.severe_count).toBe(2); // grave + muy_grave emitidas
  });

  it("lista vacía = ceros", () => {
    const k = computeWarningKpis([], now);
    expect(k).toEqual({
      total_count: 0,
      active_count: 0,
      this_month_count: 0,
      severe_count: 0,
    });
  });
});

describe("helpers de severidad / estado", () => {
  it("label/tone/guard de severidad", () => {
    expect(warningSeverityLabel("muy_grave")).toBe("Muy grave");
    expect(warningSeverityLabel("xxx")).toBe("xxx");
    expect(warningSeverityTone("muy_grave")).toBe("danger");
    expect(warningSeverityTone("leve")).toBe("info");
    expect(warningSeverityTone("xxx")).toBe("neutral");
    expect(isWarningSeverity("grave")).toBe(true);
    expect(isWarningSeverity("nope")).toBe(false);
  });

  it("label/tone/guard de estado", () => {
    expect(warningStatusLabel("emitida")).toBe("Emitida");
    expect(warningStatusTone("anulada")).toBe("neutral");
    expect(isWarningStatus("emitida")).toBe(true);
    expect(isWarningStatus("borrador")).toBe(false);
  });

  it("warningMatchesFilter", () => {
    expect(warningMatchesFilter({ status: "emitida" }, "todas")).toBe(true);
    expect(warningMatchesFilter({ status: "emitida" }, "emitida")).toBe(true);
    expect(warningMatchesFilter({ status: "anulada" }, "emitida")).toBe(false);
  });
});

describe("formato del código AM-NNNN", () => {
  it("acepta AM-NNNN y rechaza el resto", () => {
    expect(isWarningCode("AM-0001")).toBe(true);
    expect(isWarningCode("AM-12345")).toBe(true);
    expect(isWarningCode("AM-12")).toBe(false);
    expect(isWarningCode("EMP-0001")).toBe(false);
    expect(isWarningCode("am-0001")).toBe(false);
    expect(isWarningCode(null)).toBe(false);
  });
});

describe("catálogo Art. 79", () => {
  it("incluye las causales del Art. 79 con value y label", () => {
    expect(ART79_CAUSES.length).toBeGreaterThanOrEqual(9);
    for (const c of ART79_CAUSES) {
      expect(typeof c.value).toBe("string");
      expect(c.value.length).toBeGreaterThan(0);
      expect(typeof c.label).toBe("string");
    }
    expect(ART79_CAUSES.some((c) => /lit\. f/.test(c.value))).toBe(true);
  });
});
