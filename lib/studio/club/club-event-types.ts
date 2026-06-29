/**
 * Tipos + validadores de los Eventos del Club DTD (SDD-0116, Slice C V1).
 * DATA PURA (sin React, sin server-only). Enums = uniones de string-literal
 * (espejo de los CHECK de academy_cohorts). Sin Zod.
 *
 * D9 (founder 2026-06-29): los eventos REUSAN `academy_cohorts` con
 * `context='club'` y `course_id=null` (no hay tabla nueva). Reusan el status de
 * cohorte (proximamente | en_curso | completado) y la modalidad (presencial |
 * online). Las inscripciones de miembros quedan diferidas (Slice C.2).
 */

// ── Enums (espejo de los CHECK de academy_cohorts) ───────────
export type ClubEventStatus = "proximamente" | "en_curso" | "completado";
export type ClubEventModality = "presencial" | "online";

export const CLUB_EVENT_STATUSES: readonly ClubEventStatus[] = [
  "proximamente",
  "en_curso",
  "completado",
];
export const CLUB_EVENT_MODALITIES: readonly ClubEventModality[] = [
  "presencial",
  "online",
];

// ── Tipos ────────────────────────────────────────────────────
export interface ClubEvent {
  id: string;
  name: string;
  summary: string | null;
  modality: ClubEventModality;
  place: string | null;
  /** Fecha del evento (YYYY-MM-DD) o null. */
  startsAt: string | null;
  facilitatorName: string | null;
  status: ClubEventStatus;
}

export interface ClubEventStats {
  /** Eventos con status 'proximamente'. */
  proximos: number;
  /** Total de eventos vivos. */
  total: number;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function clubEventStatusLabel(s: ClubEventStatus): string {
  return { proximamente: "Próximamente", en_curso: "En curso", completado: "Completado" }[s];
}

export function clubEventStatusTone(
  s: ClubEventStatus,
): "info" | "success" | "neutral" {
  return { proximamente: "info", en_curso: "success", completado: "neutral" }[s] as
    "info" | "success" | "neutral";
}

export function clubEventModalityLabel(m: ClubEventModality): string {
  return { presencial: "Presencial", online: "Online" }[m];
}

/** KPIs derivados de la lista YA traída (función pura, sin DB). */
export function clubEventStatsFrom(events: ClubEvent[]): ClubEventStats {
  let proximos = 0;
  for (const e of events) if (e.status === "proximamente") proximos += 1;
  return { proximos, total: events.length };
}

// ── Validación (sin Zod) ─────────────────────────────────────
export interface ClubEventInput {
  name: string;
  summary: string | null;
  modality: ClubEventModality;
  place: string | null;
  startsAt: string | null; // YYYY-MM-DD o null
  facilitatorName: string | null;
  status: ClubEventStatus;
}

export interface ClubEventActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ClubEventInput, string>>;
  createdId?: string;
}

/** Normaliza una fecha (YYYY-MM-DD) o null. Rechaza formatos no-ISO. */
function normalizeDate(raw: string | null | undefined): { value: string | null; bad: boolean } {
  const s = (raw ?? "").trim();
  if (!s) return { value: null, bad: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: null, bad: true };
  return { value: s, bad: false };
}

export function validateClubEventInput(
  partial: Partial<ClubEventInput>,
): { input: ClubEventInput | null; fieldErrors: Partial<Record<keyof ClubEventInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof ClubEventInput, string>> = {};

  const name = partial.name?.trim() ?? "";
  if (!name) fieldErrors.name = "El nombre es requerido";

  const modality = partial.modality ?? "presencial";
  if (!CLUB_EVENT_MODALITIES.includes(modality)) fieldErrors.modality = "Modalidad inválida";

  const status = partial.status ?? "proximamente";
  if (!CLUB_EVENT_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  const starts = normalizeDate(partial.startsAt);
  if (starts.bad) fieldErrors.startsAt = "Fecha inválida (usa el selector)";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      name,
      summary: partial.summary?.trim() || null,
      modality,
      place: partial.place?.trim() || null,
      startsAt: starts.value,
      facilitatorName: partial.facilitatorName?.trim() || null,
      status,
    },
    fieldErrors: null,
  };
}
