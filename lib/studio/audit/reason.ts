const MIN_AUDIT_REASON_LENGTH = 4;
const MAX_AUDIT_REASON_LENGTH = 1000;

export type AuditReasonResult =
  | { ok: true; reason: string }
  | { ok: false; error: string };

/**
 * Normaliza el motivo humano que viaja a una mutación R3.
 *
 * El límite coincide con AUD-01 y con el writer PostgreSQL. El motivo sólo se
 * usa como evidencia; nunca se concatena en SQL ni se copia al payload.
 */
export function validateAuditReason(value: unknown): AuditReasonResult {
  const reason = String(value ?? "").trim();

  if (reason.length < MIN_AUDIT_REASON_LENGTH) {
    return {
      ok: false,
      error: "Indica un motivo de al menos 4 caracteres.",
    };
  }

  if (reason.length > MAX_AUDIT_REASON_LENGTH) {
    return {
      ok: false,
      error: "El motivo no puede superar 1000 caracteres.",
    };
  }

  return { ok: true, reason };
}
