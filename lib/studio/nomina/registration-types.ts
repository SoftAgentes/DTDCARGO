/**
 * Tipos + helpers PUROS del módulo Nómina · Solicitudes de registro de empleado
 * (SDD-0113 Slice A). Matchea supabase/migrations/0180_employee_invites_registrations.sql.
 *
 * La solicitud es STAGING: lo que el candidato envía por el link de invitación.
 * NO es todavía un nomina_employees — el admin la aprueba (materializa la ficha,
 * con el sueldo que define la EMPRESA) o la rechaza. Validador cédula-aware que
 * reusa normalizeCedula (SDD-0106), espejo del índice único de la DB.
 *
 * Sin React, sin server-only. Validadores manuales (no Zod, patrón del repo).
 */

import { strOrNull, type NominaBadgeTone } from "./employee-types";
import { isBankAccountType, type BankAccountType } from "./employee-types";
import { normalizeCedula } from "../person-types";

export { strOrNull, normalizeCedula };
export type { NominaBadgeTone, BankAccountType };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la solicitud                                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type RegistrationStatus = "pendiente" | "aprobada" | "rechazada";

export const REGISTRATION_STATUSES: RegistrationStatus[] = [
  "pendiente",
  "aprobada",
  "rechazada",
];

export const REGISTRATION_STATUS_META: Record<
  RegistrationStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  aprobada: { label: "Aprobada", tone: "success" },
  rechazada: { label: "Rechazada", tone: "danger" },
};

export function registrationStatusLabel(s: string): string {
  return REGISTRATION_STATUS_META[s as RegistrationStatus]?.label ?? s;
}
export function registrationStatusTone(s: string): NominaBadgeTone {
  return REGISTRATION_STATUS_META[s as RegistrationStatus]?.tone ?? "neutral";
}
export function isRegistrationStatus(v: unknown): v is RegistrationStatus {
  return typeof v === "string" && (REGISTRATION_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida                                            ║
// ╚═══════════════════════════════════════════════════════════╝
export type EmployeeRegistration = {
  id: string;
  tenant_id: string;
  invite_id: string;
  full_name: string;
  national_id: string;
  birth_date: string | null;
  phone: string | null;
  email: string;
  cargo: string | null;
  start_date: string | null;
  bank_name: string | null;
  bank_account_type: BankAccountType | null;
  bank_account: string | null;
  photo_path: string | null;
  status: RegistrationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  employee_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input · submit del candidato (sin Zod)       ║
// ╚═══════════════════════════════════════════════════════════╝
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Cédula/RIF venezolano normalizado: letra (V/E/J/G/P) + 6–10 dígitos.
const CEDULA_RE = /^[VEJGP]\d{6,10}$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

export type RegistrationInput = {
  full_name: string;
  national_id: string;
  birth_date: string | null;
  phone: string | null;
  email: string;
  cargo: string | null;
  start_date: string | null;
  bank_name: string | null;
  bank_account_type: BankAccountType | null;
  bank_account: string | null;
};

/**
 * Valida lo que el candidato envía. full_name / national_id / email son
 * obligatorios; la cédula se normaliza igual que el índice SQL (cédula-aware,
 * SDD-0106) y se valida el formato VE. El sueldo NO se acepta acá (lo fija la
 * empresa al aprobar). Devuelve el national_id NORMALIZADO listo para persistir.
 */
export function validateRegistrationInput(
  raw: Partial<Record<string, unknown>>,
): { input: RegistrationInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const fullName = strOrNull(raw.full_name);
  if (!fullName) errors.full_name = "Indica tu nombre completo.";
  else if (fullName.length > 120) errors.full_name = "Nombre demasiado largo.";

  const rawDoc = strOrNull(raw.national_id);
  let nationalId = "";
  if (!rawDoc) {
    errors.national_id = "Indica tu cédula.";
  } else {
    nationalId = normalizeCedula(rawDoc);
    if (!CEDULA_RE.test(nationalId)) {
      errors.national_id = "Cédula inválida (ej. V-12.345.678).";
    }
  }

  const email = strOrNull(raw.email);
  if (!email) errors.email = "Indica tu correo.";
  else if (!EMAIL_RE.test(email)) errors.email = "Correo inválido.";

  const birthDate = strOrNull(raw.birth_date);
  if (birthDate && !isIsoDate(birthDate)) errors.birth_date = "Fecha de nacimiento inválida.";

  const startDate = strOrNull(raw.start_date);
  if (startDate && !isIsoDate(startDate)) errors.start_date = "Fecha de inicio inválida.";

  const bankType = strOrNull(raw.bank_account_type);
  if (bankType && !isBankAccountType(bankType)) {
    errors.bank_account_type = "Tipo de cuenta inválido.";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      full_name: fullName!,
      national_id: nationalId,
      birth_date: birthDate,
      phone: strOrNull(raw.phone),
      email: email!.toLowerCase(),
      cargo: strOrNull(raw.cargo),
      start_date: startDate,
      bank_name: strOrNull(raw.bank_name),
      bank_account_type: (bankType as BankAccountType | null) ?? null,
      bank_account: strOrNull(raw.bank_account),
    },
  };
}

/**
 * Campos que el admin define al APROBAR (no el candidato): el sueldo es de la
 * empresa. Valida el sueldo (≥ 0). El resto de la ficha se toma de la solicitud.
 */
export type ApproveRegistrationInput = {
  salary_usd: number;
  hire_date: string | null;
};

export function validateApproveRegistrationInput(
  raw: Partial<Record<string, unknown>>,
): { input: ApproveRegistrationInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const salary = Number(raw.salary_usd ?? 0);
  if (!Number.isFinite(salary) || salary < 0) {
    errors.salary_usd = "El sueldo no puede ser negativo.";
  }

  const hireDate = strOrNull(raw.hire_date);
  if (hireDate && !isIsoDate(hireDate)) errors.hire_date = "Fecha de ingreso inválida.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      salary_usd: Math.round((salary + Number.EPSILON) * 100) / 100,
      hire_date: hireDate,
    },
  };
}
