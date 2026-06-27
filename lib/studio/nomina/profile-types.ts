/**
 * Allowlist + validador del PERFIL self-service del empleado (SDD-0113 Slice C).
 *
 * El empleado ve su ficha completa pero solo puede editar un subconjunto. El gate
 * es server-side y EN LA DB (RPCs update_my_contact / request_my_bank_change que
 * solo tocan columnas seguras). Este módulo es la 2.ª capa (allowlist en la
 * action): descarta cualquier campo fuera de la lista ANTES de llamar a la RPC.
 *
 * Sin React, sin server-only. Validadores manuales (no Zod). Defensa en 3 capas:
 *   (1) la UI oculta los campos no editables;
 *   (2) este allowlist los descarta aunque vengan en el FormData;
 *   (3) las RPCs SECURITY DEFINER de la DB solo escriben columnas seguras.
 */

import { strOrNull, isBankAccountType, type BankAccountType } from "./employee-types";

export { strOrNull };
export type { BankAccountType };

// ── Allowlist server-side: lo ÚNICO que el empleado puede tocar ──
// phone/email van directo (vía update_my_contact); bank_* van a STAGING
// (request_my_bank_change → pendiente de verificación del admin).
export const EMPLOYEE_EDITABLE_FIELDS = [
  "phone",
  "email",
  "bank_name",
  "bank_account_type",
  "bank_account",
] as const;
export type EmployeeEditableField = (typeof EMPLOYEE_EDITABLE_FIELDS)[number];

// Campos que la empresa define — NUNCA editables por el empleado. Lista explícita
// para el test anti-regresión (si alguien agrega uno a EDITABLE por error, salta).
export const EMPLOYEE_READONLY_FIELDS = [
  "full_name",
  "national_id",
  "position_label",
  "department",
  "salary_usd",
  "status",
  "hire_date",
  "employee_code",
  "auth_user_id",
  "tenant_id",
] as const;

export function isEmployeeEditableField(v: unknown): v is EmployeeEditableField {
  return typeof v === "string" && (EMPLOYEE_EDITABLE_FIELDS as readonly string[]).includes(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmployeeProfileInput = {
  // Contacto (directo).
  phone: string | null;
  email: string | null;
  // Banco (a staging si cambia).
  bank_name: string | null;
  bank_account_type: BankAccountType | null;
  bank_account: string | null;
};

/**
 * Valida + FILTRA el FormData del perfil. Toma SOLO los campos del allowlist;
 * cualquier otro (salary_usd, cargo, status, …) se IGNORA aunque venga en el
 * request. Devuelve el subconjunto seguro listo para las RPCs.
 *
 * `raw` puede traer campos extra: este validador NO los copia (allowlist, no
 * blocklist). Ese es el invariante que prueba el test.
 */
export function validateEmployeeProfileInput(
  raw: Partial<Record<string, unknown>>,
): { input: EmployeeProfileInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const phone = strOrNull(raw.phone);
  if (phone && phone.length > 40) errors.phone = "Teléfono demasiado largo.";

  const email = strOrNull(raw.email);
  if (email && !EMAIL_RE.test(email)) errors.email = "Correo inválido.";

  const bankType = strOrNull(raw.bank_account_type);
  if (bankType && !isBankAccountType(bankType)) {
    errors.bank_account_type = "Tipo de cuenta inválido.";
  }

  const bankAccount = strOrNull(raw.bank_account);
  if (bankAccount && bankAccount.length > 40) errors.bank_account = "Cuenta inválida.";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  // SOLO el subconjunto del allowlist. Nada de raw.salary_usd / raw.cargo / etc.
  return {
    input: {
      phone,
      email: email ? email.toLowerCase() : null,
      bank_name: strOrNull(raw.bank_name),
      bank_account_type: (bankType as BankAccountType | null) ?? null,
      bank_account: bankAccount,
    },
  };
}

/**
 * ¿Cambió algún dato bancario respecto al actual? Decide si se abre una solicitud
 * de cambio bancario (staging) o no. Compara strings normalizados.
 */
export function bankDataChanged(
  next: Pick<EmployeeProfileInput, "bank_name" | "bank_account_type" | "bank_account">,
  current: { bank_name: string | null; bank_account_type: string | null; bank_account: string | null },
): boolean {
  const norm = (v: string | null) => (v ?? "").trim();
  return (
    norm(next.bank_name) !== norm(current.bank_name) ||
    norm(next.bank_account_type) !== norm(current.bank_account_type) ||
    norm(next.bank_account) !== norm(current.bank_account)
  );
}
