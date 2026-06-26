import { describe, it, expect } from "vitest";
import {
  validateAttendanceInput,
  validateHolidayInput,
  computeAttendanceKpis,
  attendanceMonthKey,
  isAttendanceStatus,
  isHolidayScope,
  attendanceStatusLabel,
  attendanceStatusTone,
  holidayScopeLabel,
  holidayScopeTone,
  ATTENDANCE_STATUS,
  HOLIDAY_SCOPE,
} from "./attendance-types";

describe("validateAttendanceInput", () => {
  const base = { employee_id: "emp-1", work_date: "2026-06-15", status: "trabajado" };

  it("acepta un input válido y normaliza horas", () => {
    const { input, fieldErrors } = validateAttendanceInput({
      ...base,
      overtime_hours: "2.5",
      night_hours: "1",
      notes: "  turno largo  ",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.employee_id).toBe("emp-1");
    expect(input!.work_date).toBe("2026-06-15");
    expect(input!.status).toBe("trabajado");
    expect(input!.overtime_hours).toBe(2.5);
    expect(input!.night_hours).toBe(1);
    expect(input!.notes).toBe("turno largo");
  });

  it("default de horas = 0 y notes null cuando faltan", () => {
    const { input } = validateAttendanceInput(base);
    expect(input!.overtime_hours).toBe(0);
    expect(input!.night_hours).toBe(0);
    expect(input!.notes).toBeNull();
  });

  it("exige empleado", () => {
    const { input, fieldErrors } = validateAttendanceInput({ ...base, employee_id: "" });
    expect(input).toBeNull();
    expect(fieldErrors?.employee_id).toBeTruthy();
  });

  it("exige fecha y la valida en formato ISO", () => {
    expect(validateAttendanceInput({ ...base, work_date: "" }).fieldErrors?.work_date).toBeTruthy();
    expect(
      validateAttendanceInput({ ...base, work_date: "15/06/2026" }).fieldErrors?.work_date,
    ).toBeTruthy();
    expect(
      validateAttendanceInput({ ...base, work_date: "2026-13-40" }).fieldErrors?.work_date,
    ).toBeTruthy();
  });

  it("rechaza estado inválido", () => {
    const { fieldErrors } = validateAttendanceInput({ ...base, status: "vacaciones" });
    expect(fieldErrors?.status).toBeTruthy();
  });

  it("rechaza horas negativas y > 24", () => {
    expect(
      validateAttendanceInput({ ...base, overtime_hours: "-1" }).fieldErrors?.overtime_hours,
    ).toBeTruthy();
    expect(
      validateAttendanceInput({ ...base, overtime_hours: "25" }).fieldErrors?.overtime_hours,
    ).toBeTruthy();
    expect(
      validateAttendanceInput({ ...base, night_hours: "-0.5" }).fieldErrors?.night_hours,
    ).toBeTruthy();
    expect(
      validateAttendanceInput({ ...base, night_hours: "30" }).fieldErrors?.night_hours,
    ).toBeTruthy();
  });
});

describe("validateHolidayInput", () => {
  it("acepta un feriado válido", () => {
    const { input, fieldErrors } = validateHolidayInput({
      holiday_date: "2026-05-01",
      label: "  Día del Trabajador  ",
      scope: "nacional",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.holiday_date).toBe("2026-05-01");
    expect(input!.label).toBe("Día del Trabajador");
    expect(input!.scope).toBe("nacional");
  });

  it("scope default = nacional", () => {
    const { input } = validateHolidayInput({ holiday_date: "2026-05-01", label: "X" });
    expect(input!.scope).toBe("nacional");
  });

  it("exige fecha válida y label", () => {
    expect(
      validateHolidayInput({ holiday_date: "", label: "X" }).fieldErrors?.holiday_date,
    ).toBeTruthy();
    expect(
      validateHolidayInput({ holiday_date: "no-fecha", label: "X" }).fieldErrors?.holiday_date,
    ).toBeTruthy();
    expect(
      validateHolidayInput({ holiday_date: "2026-05-01", label: "" }).fieldErrors?.label,
    ).toBeTruthy();
  });

  it("rechaza scope inválido", () => {
    const { fieldErrors } = validateHolidayInput({
      holiday_date: "2026-05-01",
      label: "X",
      scope: "regional",
    });
    expect(fieldErrors?.scope).toBeTruthy();
  });
});

describe("computeAttendanceKpis", () => {
  it("cuenta trabajados/ausentes y suma horas", () => {
    const kpis = computeAttendanceKpis([
      { status: "trabajado", overtime_hours: "2", night_hours: "1" },
      { status: "trabajado", overtime_hours: 1.5, night_hours: 0 },
      { status: "ausente", overtime_hours: 0, night_hours: 0 },
      { status: "libre", overtime_hours: 0, night_hours: 0 },
      { status: "feriado", overtime_hours: "3", night_hours: "2" },
    ]);
    expect(kpis.total_count).toBe(5);
    expect(kpis.worked_count).toBe(2);
    expect(kpis.absent_count).toBe(1);
    expect(kpis.overtime_hours).toBe(6.5);
    expect(kpis.night_hours).toBe(3);
  });

  it("set vacío = ceros", () => {
    const kpis = computeAttendanceKpis([]);
    expect(kpis.total_count).toBe(0);
    expect(kpis.worked_count).toBe(0);
    expect(kpis.overtime_hours).toBe(0);
  });
});

describe("helpers de label/tono y guards", () => {
  it("month key = YYYY-MM", () => {
    expect(attendanceMonthKey("2026-06-15")).toBe("2026-06");
  });

  it("todos los status tienen label y tono", () => {
    for (const s of ATTENDANCE_STATUS) {
      expect(attendanceStatusLabel(s)).toBeTruthy();
      expect(attendanceStatusTone(s)).toBeTruthy();
    }
    expect(attendanceStatusLabel("desconocido")).toBe("desconocido");
    expect(attendanceStatusTone("desconocido")).toBe("neutral");
  });

  it("todos los scopes tienen label y tono", () => {
    for (const s of HOLIDAY_SCOPE) {
      expect(holidayScopeLabel(s)).toBeTruthy();
      expect(holidayScopeTone(s)).toBeTruthy();
    }
    expect(holidayScopeTone("otro")).toBe("neutral");
  });

  it("guards", () => {
    expect(isAttendanceStatus("trabajado")).toBe(true);
    expect(isAttendanceStatus("x")).toBe(false);
    expect(isHolidayScope("empresa")).toBe(true);
    expect(isHolidayScope("x")).toBe(false);
  });
});
