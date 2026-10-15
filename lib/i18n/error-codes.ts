/**
 * lib/i18n/error-codes.ts · Catálogo de errorCodes server-side.
 *
 * Las server actions devuelven `errorCode` (machine-readable) en vez de
 * un string ES. El client mapea código → mensaje traducido vía
 * `t(locale, ERROR_CODE_KEY[code], errorParams)`.
 *
 * Beneficios:
 *   1. Mensajes traducidos sin tener que regenerar en cada locale en el
 *      servidor.
 *   2. Diff/logging/telemetría más limpio (los codes son estables).
 *   3. Los módulos no migrados siguen devolviendo `error: string` legacy
 *      y funcionan igual.
 *
 * Compat: el shape `ActionState` mantiene `error?: string` además de
 * `errorCode?: ErrorCode + errorParams?: Record<string, ...>`. Si el
 * cliente recibe errorCode lo usa; si solo recibe `error` lo renderiza
 * tal cual. Nunca rompe.
 */

import type { I18nKey } from "./dict";

/**
 * Todos los códigos de error que las server actions migradas pueden
 * devolver. Agregar nuevos siempre con su key i18n correspondiente.
 *
 * Convención del code: snake_case · `<scope>_<descripcion>`.
 *   - `auth_required`, `tenant_unresolved` → globales
 *   - `cn_*` → módulo Almacén CN
 *   - `bug_*` → Bug Reporter
 *   - `user_*` → Usuarios + invitaciones
 */
export type ErrorCode =
  // ── Globales ─────────────────────────────────────────────
  | "auth_required"
  | "tenant_unresolved"
  | "permission_denied"
  | "invalid_input"
  | "field_errors_present"
  | "not_found"
  | "internal_error"

  // ── Almacén CN ───────────────────────────────────────────
  | "cn_code_generation_failed"
  | "cn_create_failed"
  | "cn_receipt_not_found"
  | "cn_invalid_payment_status"
  | "cn_destination_required"
  | "cn_bulk_max_exceeded"
  // SDD-0522 · borrado auditado de recepciones
  | "cn_delete_reason_short"
  | "cn_delete_reason_long"
  | "cn_delete_blocked"
  | "cn_delete_not_found"
  | "cn_delete_failed"
  | "cn_delete_unconfirmed"

  // ── Usuarios + invitaciones ──────────────────────────────
  | "user_email_invalid"
  | "user_role_invalid"
  | "user_signin_required"
  | "user_already_admin"
  | "user_no_other_admins"

  // ── Bug Reporter ─────────────────────────────────────────
  | "bug_create_failed"
  | "bug_invalid_input";

/**
 * Mapping ErrorCode → I18nKey · usado por el helper `errorMessage()`.
 * Las keys viven en `lib/i18n/<locale>/errors.ts`.
 */
export const ERROR_CODE_KEY: Record<ErrorCode, I18nKey> = {
  // Globales
  auth_required: "error.auth_required",
  tenant_unresolved: "error.tenant_unresolved",
  permission_denied: "error.permission_denied",
  invalid_input: "error.invalid_input",
  field_errors_present: "error.field_errors_present",
  not_found: "error.not_found",
  internal_error: "error.internal_error",

  // Almacén CN
  cn_code_generation_failed: "error.cn_code_generation_failed",
  cn_create_failed: "error.cn_create_failed",
  cn_receipt_not_found: "error.cn_receipt_not_found",
  cn_invalid_payment_status: "error.cn_invalid_payment_status",
  cn_destination_required: "error.cn_destination_required",
  cn_bulk_max_exceeded: "error.cn_bulk_max_exceeded",
  cn_delete_reason_short: "error.cn_delete_reason_short",
  cn_delete_reason_long: "error.cn_delete_reason_long",
  cn_delete_blocked: "error.cn_delete_blocked",
  cn_delete_not_found: "error.cn_delete_not_found",
  cn_delete_failed: "error.cn_delete_failed",
  cn_delete_unconfirmed: "error.cn_delete_unconfirmed",

  // Usuarios
  user_email_invalid: "error.user_email_invalid",
  user_role_invalid: "error.user_role_invalid",
  user_signin_required: "error.user_signin_required",
  user_already_admin: "error.user_already_admin",
  user_no_other_admins: "error.user_no_other_admins",

  // Bug
  bug_create_failed: "error.bug_create_failed",
  bug_invalid_input: "error.bug_invalid_input",
};

/**
 * Type guard: filtra strings arbitrarios al set válido. Útil cuando el
 * cliente recibe state.errorCode tipado como string.
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === "string" && value in ERROR_CODE_KEY
  );
}
