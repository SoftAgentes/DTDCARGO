/**
 * lib/i18n/es-VE/errors.ts · Mensajes de error server-side en español.
 *
 * Las keys deben coincidir 1:1 con `ERROR_CODE_KEY` en `error-codes.ts`.
 * Si agregas un código nuevo, agrégalo en:
 *   1. `error-codes.ts` → tipo ErrorCode + entry en ERROR_CODE_KEY
 *   2. `es-VE/errors.ts` → mensaje en español
 *   3. `zh-CN/errors.ts` → mensaje en chino
 */

export const errors = {
  // ── Globales ─────────────────────────────────────────────
  "error.auth_required": "Inicia sesión primero.",
  "error.tenant_unresolved": "No se pudo resolver el tenant.",
  "error.permission_denied": "No tienes permiso para hacer esto.",
  "error.invalid_input": "Datos inválidos.",
  "error.field_errors_present": "Hay campos con errores. Revísalos y reintenta.",
  "error.not_found": "No se encontró el registro.",
  "error.internal_error": "Algo salió mal. Prueba de nuevo.",

  // ── Almacén CN ───────────────────────────────────────────
  "error.cn_code_generation_failed": "No se pudo generar el código de recepción.",
  "error.cn_create_failed": "No se pudo registrar la recepción.",
  "error.cn_receipt_not_found": "Recepción no encontrada.",
  "error.cn_invalid_payment_status": "Estado de pago inválido.",
  "error.cn_destination_required":
    "Ciudad destino es obligatoria para consolidar.",
  "error.cn_bulk_max_exceeded": "Máximo 100 recepciones por operación masiva.",

  // ── Usuarios ─────────────────────────────────────────────
  "error.user_email_invalid": "Email inválido.",
  "error.user_role_invalid": "Rol inválido.",
  "error.user_signin_required":
    "Necesitas iniciar sesión para invitar usuarios.",
  "error.user_already_admin":
    "Este usuario ya es admin del tenant.",
  "error.user_no_other_admins":
    "No puedes sacarte el rol admin: eres el único admin del tenant.",

  // ── Bug ──────────────────────────────────────────────────
  "error.bug_create_failed": "No se pudo crear el reporte. Reintenta.",
  "error.bug_invalid_input": "Faltan campos del reporte o tienen valores inválidos.",
} as const satisfies Record<string, string>;

export type ErrorsDict = Record<keyof typeof errors, string>;
