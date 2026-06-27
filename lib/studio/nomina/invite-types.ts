/**
 * Tipos + helpers PUROS del módulo Nómina · Invitaciones de empleado
 * (SDD-0113 Slice A). Matchea supabase/migrations/0180_employee_invites_registrations.sql.
 *
 * La invitación es el link con token que el admin comparte para que un candidato
 * se auto-registre. El token precarga el form y marca "invitación válida"; NO
 * autentica (el registro pasa por aprobación). Sin React, sin server-only.
 * Validadores manuales (no Zod, patrón del repo).
 */

import { strOrNull, type NominaBadgeTone } from "./employee-types";

export { strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de la invitación                                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type InviteStatus = "activa" | "usada" | "revocada" | "expirada";

export const INVITE_STATUSES: InviteStatus[] = ["activa", "usada", "revocada", "expirada"];

export const INVITE_STATUS_META: Record<
  InviteStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  activa: { label: "Activa", tone: "success" },
  usada: { label: "Usada", tone: "info" },
  revocada: { label: "Revocada", tone: "neutral" },
  expirada: { label: "Expirada", tone: "warning" },
};

export function inviteStatusLabel(s: string): string {
  return INVITE_STATUS_META[s as InviteStatus]?.label ?? s;
}
export function inviteStatusTone(s: string): NominaBadgeTone {
  return INVITE_STATUS_META[s as InviteStatus]?.tone ?? "neutral";
}
export function isInviteStatus(v: unknown): v is InviteStatus {
  return typeof v === "string" && (INVITE_STATUSES as string[]).includes(v);
}

/**
 * ¿La invitación está VIGENTE para auto-registrarse? activa Y no vencida. PURA —
 * la usa la action del candidato (server) y la UI. `now` se inyecta para testear.
 */
export function isInviteUsable(
  invite: { status: string; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (invite.status !== "activa") return false;
  if (invite.expires_at) {
    const exp = Date.parse(invite.expires_at);
    if (Number.isFinite(exp) && exp < now.getTime()) return false;
  }
  return true;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida                                            ║
// ╚═══════════════════════════════════════════════════════════╝
export type EmployeeInvite = {
  id: string;
  tenant_id: string;
  token: string;
  cargo: string | null;
  department: string | null;
  status: InviteStatus;
  expires_at: string | null;
  used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input · generar invitación (sin Zod)         ║
// ╚═══════════════════════════════════════════════════════════╝
export type InviteInput = {
  cargo: string | null;
  department: string | null;
};

/** El admin solo sugiere cargo/área (ambos opcionales); el token lo pone la DB. */
export function validateInviteInput(
  raw: Partial<Record<string, unknown>>,
): { input: InviteInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const cargo = strOrNull(raw.cargo);
  if (cargo && cargo.length > 80) errors.cargo = "Cargo demasiado largo (máx 80).";

  const department = strOrNull(raw.department);
  if (department && department.length > 80) errors.department = "Área demasiado larga (máx 80).";

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return { input: { cargo, department } };
}
