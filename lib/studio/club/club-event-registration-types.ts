/**
 * Tipos + validadores de las Inscripciones a Eventos del Club (SDD-0116, Slice
 * C.2). DATA PURA (sin React, sin server-only). Enums = uniones de string-literal
 * (espejo de los CHECK de 0235). Sin Zod.
 *
 * C.2 (founder D9 + 0235): el inscrito ES un miembro del Club (club_members); el
 * evento vive en academy_cohorts con context='club'. Estados: inscrito | asistio
 * | no_asistio (crear evento → inscribir → marcar asistencia, criterio C).
 */

// ── Enums (espejo del CHECK de 0235) ─────────────────────────
export type EventRegistrationStatus = "inscrito" | "asistio" | "no_asistio";

export const EVENT_REGISTRATION_STATUSES: readonly EventRegistrationStatus[] = [
  "inscrito",
  "asistio",
  "no_asistio",
];

// ── Tipos ────────────────────────────────────────────────────
export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string;
  status: EventRegistrationStatus;
  note: string | null;
  /** Datos del miembro/persona, para la grilla. */
  memberName: string;
  memberNationalId: string | null;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function eventRegistrationStatusLabel(s: EventRegistrationStatus): string {
  return { inscrito: "Inscrito", asistio: "Asistió", no_asistio: "No asistió" }[s];
}

export function eventRegistrationStatusTone(
  s: EventRegistrationStatus,
): "info" | "success" | "danger" {
  return { inscrito: "info", asistio: "success", no_asistio: "danger" }[s] as
    "info" | "success" | "danger";
}

// ── Validación (sin Zod) ─────────────────────────────────────
export interface EventRegistrationInput {
  memberId: string;
  status: EventRegistrationStatus;
  note: string | null;
}

export interface EventRegistrationActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof EventRegistrationInput, string>>;
  registrationId?: string;
}

export function validateEventRegistrationInput(
  partial: Partial<EventRegistrationInput>,
): {
  input: EventRegistrationInput | null;
  fieldErrors: Partial<Record<keyof EventRegistrationInput, string>> | null;
} {
  const fieldErrors: Partial<Record<keyof EventRegistrationInput, string>> = {};

  const memberId = partial.memberId?.trim() ?? "";
  if (!memberId) fieldErrors.memberId = "Falta el miembro";

  const status = partial.status ?? "inscrito";
  if (!EVENT_REGISTRATION_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      memberId,
      status,
      note: partial.note?.trim() || null,
    },
    fieldErrors: null,
  };
}
