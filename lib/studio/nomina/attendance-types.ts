/**
 * Tipos + helpers PUROS del módulo Nómina · Asistencia + Feriados
 * (SDD-0103 · Slice C). Matchea supabase/migrations/0163_nomina_attendance_holidays.sql.
 *
 * Insumo del motor (payroll_run, futuro): el calendario diario de asistencia por
 * empleado (trabajado / ausente / libre / feriado + horas extra/nocturnas) y los
 * feriados (nacionales VE + propios). Acá NO se calcula recibo: solo se da forma
 * y se valida el input. Los `numeric` (horas) llegan como string → `num()`.
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo).
 */

import { num, round2, strOrNull, type NominaBadgeTone } from "./employee-types";

export { num, round2, strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado del día · trabajado / ausente / libre / feriado     ║
// ╚═══════════════════════════════════════════════════════════╝
export type AttendanceStatus = "trabajado" | "ausente" | "libre" | "feriado";

export const ATTENDANCE_STATUS: AttendanceStatus[] = [
  "trabajado",
  "ausente",
  "libre",
  "feriado",
];

export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  trabajado: { label: "Trabajado", tone: "success" },
  ausente: { label: "Ausente", tone: "danger" },
  libre: { label: "Libre", tone: "neutral" },
  feriado: { label: "Feriado", tone: "info" },
};

export const ATTENDANCE_STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] =
  ATTENDANCE_STATUS.map((s) => ({ value: s, label: ATTENDANCE_STATUS_META[s].label }));

export function attendanceStatusLabel(s: string): string {
  return ATTENDANCE_STATUS_META[s as AttendanceStatus]?.label ?? s;
}
export function attendanceStatusTone(s: string): NominaBadgeTone {
  return ATTENDANCE_STATUS_META[s as AttendanceStatus]?.tone ?? "neutral";
}
export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ATTENDANCE_STATUS as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Alcance del feriado · nacional / empresa                   ║
// ╚═══════════════════════════════════════════════════════════╝
export type HolidayScope = "nacional" | "empresa";

export const HOLIDAY_SCOPE: HolidayScope[] = ["nacional", "empresa"];

export const HOLIDAY_SCOPE_META: Record<
  HolidayScope,
  { label: string; tone: NominaBadgeTone }
> = {
  nacional: { label: "Nacional", tone: "info" },
  empresa: { label: "Empresa", tone: "wine" },
};

export const HOLIDAY_SCOPE_OPTIONS: { value: HolidayScope; label: string }[] =
  HOLIDAY_SCOPE.map((s) => ({ value: s, label: HOLIDAY_SCOPE_META[s].label }));

export function holidayScopeLabel(s: string): string {
  return HOLIDAY_SCOPE_META[s as HolidayScope]?.label ?? s;
}
export function holidayScopeTone(s: string): NominaBadgeTone {
  return HOLIDAY_SCOPE_META[s as HolidayScope]?.tone ?? "neutral";
}
export function isHolidayScope(v: unknown): v is HolidayScope {
  return typeof v === "string" && (HOLIDAY_SCOPE as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Filas persistidas                                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type Attendance = {
  id: string;
  tenant_id: string;
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  night_hours: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Holiday = {
  id: string;
  tenant_id: string;
  holiday_date: string;
  label: string;
  scope: HolidayScope;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ KPIs del set (PURO — testeable sin DB)                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type AttendanceKpis = {
  total_count: number;
  worked_count: number;
  absent_count: number;
  /** Σ horas extra diurnas de todas las filas del set. */
  overtime_hours: number;
  /** Σ horas nocturnas de todas las filas del set. */
  night_hours: number;
};

/**
 * KPIs sobre el set de asistencia recibido (típicamente el mes filtrado).
 *   - trabajados / ausentes   = conteo por status.
 *   - horas extra / nocturnas = Σ de las columnas.
 */
export function computeAttendanceKpis(
  rows: { status: AttendanceStatus; overtime_hours: unknown; night_hours: unknown }[],
): AttendanceKpis {
  let worked = 0;
  let absent = 0;
  let overtime = 0;
  let night = 0;
  for (const r of rows) {
    if (r.status === "trabajado") worked += 1;
    else if (r.status === "ausente") absent += 1;
    overtime += num(r.overtime_hours);
    night += num(r.night_hours);
  }
  return {
    total_count: rows.length,
    worked_count: worked,
    absent_count: absent,
    overtime_hours: round2(overtime),
    night_hours: round2(night),
  };
}

/** `YYYY-MM` del registro (para agrupar por mes en la UI). */
export function attendanceMonthKey(workDate: string): string {
  return workDate.slice(0, 7);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod)                              ║
// ╚═══════════════════════════════════════════════════════════╝
export type AttendanceInput = {
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  night_hours: number;
  notes: string | null;
};

export type HolidayInput = {
  holiday_date: string;
  label: string;
  scope: HolidayScope;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export function validateAttendanceInput(
  raw: Partial<Record<string, unknown>>,
): { input: AttendanceInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const employeeId = String(raw.employee_id ?? "").trim();
  if (!employeeId) errors.employee_id = "Indica el empleado.";

  const workDate = String(raw.work_date ?? "").trim();
  if (!workDate) errors.work_date = "Indica la fecha.";
  else if (!isIsoDate(workDate)) errors.work_date = "Fecha inválida.";

  const status = String(raw.status ?? "trabajado").trim();
  if (!isAttendanceStatus(status)) errors.status = "Estado inválido.";

  const overtime = Number(raw.overtime_hours ?? 0);
  if (!Number.isFinite(overtime) || overtime < 0) {
    errors.overtime_hours = "Las horas extra no pueden ser negativas.";
  } else if (overtime > 24) {
    errors.overtime_hours = "Las horas extra de un día no pueden superar 24.";
  }

  const night = Number(raw.night_hours ?? 0);
  if (!Number.isFinite(night) || night < 0) {
    errors.night_hours = "Las horas nocturnas no pueden ser negativas.";
  } else if (night > 24) {
    errors.night_hours = "Las horas nocturnas de un día no pueden superar 24.";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      employee_id: employeeId,
      work_date: workDate,
      status: status as AttendanceStatus,
      overtime_hours: round2(overtime),
      night_hours: round2(night),
      notes: strOrNull(raw.notes),
    },
  };
}

export function validateHolidayInput(
  raw: Partial<Record<string, unknown>>,
): { input: HolidayInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const holidayDate = String(raw.holiday_date ?? "").trim();
  if (!holidayDate) errors.holiday_date = "Indica la fecha del feriado.";
  else if (!isIsoDate(holidayDate)) errors.holiday_date = "Fecha inválida.";

  const label = String(raw.label ?? "").trim();
  if (!label) errors.label = "Indica el nombre del feriado.";
  else if (label.length > 120) errors.label = "Nombre demasiado largo (máx 120).";

  const scope = String(raw.scope ?? "nacional").trim();
  if (!isHolidayScope(scope)) errors.scope = "Alcance inválido.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      holiday_date: holidayDate,
      label,
      scope: scope as HolidayScope,
    },
  };
}
