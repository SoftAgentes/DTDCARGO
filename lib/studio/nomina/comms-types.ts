/**
 * Tipos + helpers PUROS del módulo Nómina · Comunicaciones al empleado
 * (SDD-0113 Slice B). Matchea supabase/migrations/0181_employee_comms.sql.
 *
 * Una comunicación de RRHH dirigida a UN empleado, con acuse de recibo in-app.
 * `type` espeja COMM_TYPES del Norte. ref_kind/ref_id = puntero polimórfico
 * opcional a la entidad origen (validado same-tenant en la DB por trigger).
 *
 * Sin React, sin server-only. Validadores manuales (no Zod, patrón del repo).
 */

import { strOrNull, type NominaBadgeTone } from "./employee-types";

export { strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Tipo de comunicación (espeja COMM_TYPES del Norte)        ║
// ╚═══════════════════════════════════════════════════════════╝
export type CommType = "recibo" | "aviso" | "llamado" | "amonestacion";

export const COMM_TYPES: CommType[] = ["recibo", "aviso", "llamado", "amonestacion"];

export const COMM_TYPE_META: Record<
  CommType,
  { label: string; tone: NominaBadgeTone; requiresAck: boolean }
> = {
  recibo: { label: "Recibo de pago", tone: "info", requiresAck: false },
  aviso: { label: "Aviso", tone: "neutral", requiresAck: false },
  llamado: { label: "Llamado de atención", tone: "warning", requiresAck: true },
  amonestacion: { label: "Amonestación", tone: "danger", requiresAck: true },
};

export function commTypeLabel(t: string): string {
  return COMM_TYPE_META[t as CommType]?.label ?? t;
}
export function commTypeTone(t: string): NominaBadgeTone {
  return COMM_TYPE_META[t as CommType]?.tone ?? "neutral";
}
export function isCommType(v: unknown): v is CommType {
  return typeof v === "string" && (COMM_TYPES as string[]).includes(v);
}
/** ¿Este tipo exige acuse (llamado/amonestación)? Default server-side. */
export function commTypeRequiresAck(t: string): boolean {
  return COMM_TYPE_META[t as CommType]?.requiresAck ?? false;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Puntero polimórfico (ref_kind acotado al check de la DB)  ║
// ╚═══════════════════════════════════════════════════════════╝
export type CommRefKind = "payroll_run_line" | "warning" | "loan" | "payroll_run";

export const COMM_REF_KINDS: CommRefKind[] = [
  "payroll_run_line",
  "warning",
  "loan",
  "payroll_run",
];

export function isCommRefKind(v: unknown): v is CommRefKind {
  return typeof v === "string" && (COMM_REF_KINDS as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida                                            ║
// ╚═══════════════════════════════════════════════════════════╝
export type EmployeeComm = {
  id: string;
  tenant_id: string;
  employee_id: string;
  type: CommType;
  title: string;
  body: string;
  ref_kind: CommRefKind | null;
  ref_id: string | null;
  requires_ack: boolean;
  read_at: string | null;
  acked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** ¿El empleado todavía debe confirmar este mensaje? requires_ack && !acked_at. */
export function commNeedsAck(c: Pick<EmployeeComm, "requires_ack" | "acked_at">): boolean {
  return c.requires_ack && !c.acked_at;
}

/** ¿No leído? (badge en el tab bar). */
export function commIsUnread(c: Pick<EmployeeComm, "read_at">): boolean {
  return !c.read_at;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input · enviar comm desde RRHH (sin Zod)    ║
// ╚═══════════════════════════════════════════════════════════╝
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SendCommInput = {
  employee_id: string;
  type: CommType;
  title: string;
  body: string;
  ref_kind: CommRefKind | null;
  ref_id: string | null;
  requires_ack: boolean;
};

/**
 * Valida lo que el admin envía. employee_id (uuid), type (enum), title/body
 * obligatorios. requires_ack: si no viene explícito, lo deriva del type
 * (llamado/amonestación → true). ref_kind/ref_id deben venir EN PAR (o ambos
 * null) — coherente con el check de la DB.
 */
export function validateSendCommInput(
  raw: Partial<Record<string, unknown>>,
): { input: SendCommInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const employeeId = strOrNull(raw.employee_id);
  if (!employeeId) errors.employee_id = "Selecciona el empleado.";
  else if (!UUID_RE.test(employeeId)) errors.employee_id = "Empleado inválido.";

  const type = strOrNull(raw.type);
  if (!type) errors.type = "Selecciona el tipo de comunicación.";
  else if (!isCommType(type)) errors.type = "Tipo de comunicación inválido.";

  const title = strOrNull(raw.title);
  if (!title) errors.title = "Indica un título.";
  else if (title.length > 160) errors.title = "Título demasiado largo (máx 160).";

  const body = strOrNull(raw.body);
  if (!body) errors.body = "Escribe el mensaje.";
  else if (body.length > 8000) errors.body = "Mensaje demasiado largo.";

  const refKind = strOrNull(raw.ref_kind);
  const refId = strOrNull(raw.ref_id);
  if (refKind && !isCommRefKind(refKind)) errors.ref_kind = "Referencia inválida.";
  if (refId && !UUID_RE.test(refId)) errors.ref_id = "Referencia inválida.";
  // Deben venir en par (o ambos ausentes), espejo del check nomina_employee_comms_ref_pair.
  if ((refKind && !refId) || (!refKind && refId)) {
    errors.ref_id = "La referencia requiere tipo Y id.";
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  // requires_ack: explícito ('1'/'true') o derivado del tipo.
  const rawAck = strOrNull(raw.requires_ack);
  const requiresAck =
    rawAck != null ? rawAck === "1" || rawAck === "true" : commTypeRequiresAck(type!);

  return {
    input: {
      employee_id: employeeId!,
      type: type as CommType,
      title: title!,
      body: body!,
      ref_kind: (refKind as CommRefKind | null) ?? null,
      ref_id: refId ?? null,
      requires_ack: requiresAck,
    },
  };
}
