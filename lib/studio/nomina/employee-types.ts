/**
 * Tipos + helpers PUROS del módulo Nómina · Empleados (SDD-0103 · Slice A).
 * Matchea el schema de supabase/migrations/0160_nomina_employees.sql.
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo). El sueldo `numeric` llega de Supabase
 * como string → se coerce a number con `num()`.
 *
 * Es PII + dinero: la seguridad real vive en la RLS (tenant + rol) y en el gate
 * de acción (`moduleEditDenial`). Estos helpers solo dan forma y validan input.
 */

// Tonos del set del sistema (los que acepta <Badge>).
export type NominaBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Coacciona un valor crudo a número finito (default 0). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Trim → null si queda vacío. */
export function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado laboral · activo / inactivo / egresado              ║
// ╚═══════════════════════════════════════════════════════════╝
export type EmployeeStatus = "activo" | "inactivo" | "egresado";

export const EMPLOYEE_STATUSES: EmployeeStatus[] = ["activo", "inactivo", "egresado"];

export const EMPLOYEE_STATUS_META: Record<
  EmployeeStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  activo: { label: "Activo", tone: "success" },
  inactivo: { label: "Inactivo", tone: "neutral" },
  egresado: { label: "Egresado", tone: "warning" },
};

export const EMPLOYEE_STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] =
  EMPLOYEE_STATUSES.map((s) => ({ value: s, label: EMPLOYEE_STATUS_META[s].label }));

export function employeeStatusLabel(s: string): string {
  return EMPLOYEE_STATUS_META[s as EmployeeStatus]?.label ?? s;
}
export function employeeStatusTone(s: string): NominaBadgeTone {
  return EMPLOYEE_STATUS_META[s as EmployeeStatus]?.tone ?? "neutral";
}
export function isEmployeeStatus(v: unknown): v is EmployeeStatus {
  return typeof v === "string" && (EMPLOYEE_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Cuenta bancaria · tipo + bancos VE                         ║
// ╚═══════════════════════════════════════════════════════════╝
export type BankAccountType = "corriente" | "ahorro";

export const BANK_ACCOUNT_TYPES: BankAccountType[] = ["corriente", "ahorro"];

export const BANK_ACCOUNT_TYPE_LABEL: Record<BankAccountType, string> = {
  corriente: "Corriente",
  ahorro: "Ahorro",
};

export function bankAccountTypeLabel(v: string | null): string {
  if (!v) return "—";
  return BANK_ACCOUNT_TYPE_LABEL[v as BankAccountType] ?? v;
}
export function isBankAccountType(v: unknown): v is BankAccountType {
  return typeof v === "string" && (BANK_ACCOUNT_TYPES as string[]).includes(v);
}

/** Bancos de Venezuela de uso más común (selector del drawer). */
export const VE_BANKS: string[] = [
  "Banesco",
  "Mercantil",
  "Banco de Venezuela",
  "BBVA Provincial",
  "Banco Nacional de Crédito · BNC",
  "Bancaribe",
  "Banco del Tesoro",
  "Banco Exterior",
  "Bancamiga",
  "Banplus",
  "100% Banco",
  "Venezolano de Crédito",
  "Banco Plaza",
  "Banco Activo",
];

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida + KPIs derivados                           ║
// ╚═══════════════════════════════════════════════════════════╝
export type Employee = {
  id: string;
  tenant_id: string;
  employee_code: string;
  full_name: string;
  national_id: string | null;
  position_label: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  salary_usd: number;
  hire_date: string | null;
  birth_date: string | null;
  bank_name: string | null;
  bank_account_type: BankAccountType | null;
  bank_account: string | null;
  status: EmployeeStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EmployeeKpis = {
  active_count: number;
  inactive_count: number;
  total_count: number;
  /** Σ sueldo mensual (USD) de los empleados ACTIVOS = nómina fija mensual. */
  monthly_payroll_usd: number;
};

/**
 * KPIs del módulo (PURO — testeable sin DB).
 *   - activos       = status 'activo'.
 *   - nómina mensual = Σ salary_usd de los activos.
 */
export function computeEmployeeKpis(
  employees: { status: EmployeeStatus; salary_usd: unknown }[],
): EmployeeKpis {
  let active = 0;
  let inactive = 0;
  let payroll = 0;
  for (const e of employees) {
    if (e.status === "activo") {
      active += 1;
      payroll += num(e.salary_usd);
    } else if (e.status === "inactivo") {
      inactive += 1;
    }
  }
  return {
    active_count: active,
    inactive_count: inactive,
    total_count: employees.length,
    monthly_payroll_usd: round2(payroll),
  };
}

// ── Filtros del listado (client-side) ─────────────────────────
export type EmployeeFilter = "todos" | "activo" | "inactivo" | "egresado";

export const EMPLOYEE_FILTERS: { value: EmployeeFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "inactivo", label: "Inactivos" },
  { value: "egresado", label: "Egresados" },
];

export function isEmployeeFilter(v: unknown): v is EmployeeFilter {
  return typeof v === "string" && EMPLOYEE_FILTERS.some((f) => f.value === v);
}

export function employeeMatchesFilter(
  employee: { status: EmployeeStatus },
  filter: EmployeeFilter,
): boolean {
  if (filter === "todos") return true;
  return employee.status === filter;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod) + estado de la action        ║
// ╚═══════════════════════════════════════════════════════════╝
export type EmployeeInput = {
  full_name: string;
  national_id: string | null;
  position_label: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  salary_usd: number;
  hire_date: string | null;
  birth_date: string | null;
  bank_name: string | null;
  bank_account_type: BankAccountType | null;
  bank_account: string | null;
  status: EmployeeStatus;
  notes: string | null;
};

export type NominaActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Code del empleado recién creado (para toast + highlight). */
  createdCode?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha ISO (YYYY-MM-DD) o null; NaN-marker si el formato es inválido. */
function dateOrNull(v: unknown): string | null | false {
  const s = strOrNull(v);
  if (s === null) return null;
  if (!ISO_DATE_RE.test(s) || Number.isNaN(Date.parse(s))) return false;
  return s;
}

export function validateEmployeeInput(
  raw: Partial<Record<string, unknown>>,
): { input: EmployeeInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const fullName = String(raw.full_name ?? "").trim();
  if (!fullName) errors.full_name = "Indica el nombre del empleado.";
  else if (fullName.length > 120) errors.full_name = "Nombre demasiado largo (máx 120).";

  const salary = Number(raw.salary_usd ?? 0);
  if (!Number.isFinite(salary) || salary < 0) {
    errors.salary_usd = "El sueldo no puede ser negativo.";
  }

  const email = strOrNull(raw.email);
  if (email !== null && !EMAIL_RE.test(email)) {
    errors.email = "Email inválido.";
  }

  const status = String(raw.status ?? "activo").trim();
  if (!isEmployeeStatus(status)) errors.status = "Estado inválido.";

  const bankType = strOrNull(raw.bank_account_type);
  let bankAccountType: BankAccountType | null = null;
  if (bankType !== null) {
    if (!isBankAccountType(bankType)) errors.bank_account_type = "Tipo de cuenta inválido.";
    else bankAccountType = bankType;
  }

  const hireDate = dateOrNull(raw.hire_date);
  if (hireDate === false) errors.hire_date = "Fecha de ingreso inválida.";
  const birthDate = dateOrNull(raw.birth_date);
  if (birthDate === false) errors.birth_date = "Fecha de nacimiento inválida.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      full_name: fullName,
      national_id: strOrNull(raw.national_id),
      position_label: strOrNull(raw.position_label),
      department: strOrNull(raw.department),
      phone: strOrNull(raw.phone),
      email,
      salary_usd: round2(salary),
      hire_date: hireDate === false ? null : hireDate,
      birth_date: birthDate === false ? null : birthDate,
      bank_name: strOrNull(raw.bank_name),
      bank_account_type: bankAccountType,
      bank_account: strOrNull(raw.bank_account),
      status: status as EmployeeStatus,
      notes: strOrNull(raw.notes),
    },
  };
}
