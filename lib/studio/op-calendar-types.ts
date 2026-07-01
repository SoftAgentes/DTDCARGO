/**
 * Feriados & ferias (SDD-0127) — types, enums, validators.
 *
 * Calendario operativo CN/VE: feriados (día no laborable) y ferias comerciales
 * (Cantón/Yiwu, con rango de fechas). Tabla `operational_calendar` (migr 0192).
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

export const CAL_COUNTRIES = ["VE", "CN"] as const;
export type CalCountry = (typeof CAL_COUNTRIES)[number];

export const CAL_KINDS = ["holiday", "fair"] as const;
export type CalKind = (typeof CAL_KINDS)[number];

export interface CalendarEvent {
  id: string;
  country: CalCountry;
  kind: CalKind;
  name: string;
  startDate: string; // ISO date
  endDate: string | null;
  note: string;
}

export interface CalendarActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function calCountryLabel(c: CalCountry): string {
  return c === "VE" ? "Venezuela" : "China";
}

export function calKindLabel(k: CalKind): string {
  return k === "holiday" ? "Feriado" : "Feria";
}

export function calKindTone(k: CalKind): BadgeTone {
  return k === "holiday" ? "info" : "wine";
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCalendarEventInput(fd: FormData): {
  input?: Omit<CalendarEvent, "id">;
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const country = typeof fd.get("country") === "string" ? (fd.get("country") as string) : "";
  const kind = typeof fd.get("kind") === "string" ? (fd.get("kind") as string) : "";
  const name = typeof fd.get("name") === "string" ? (fd.get("name") as string).trim() : "";
  const startDate = typeof fd.get("start_date") === "string" ? (fd.get("start_date") as string) : "";
  const endDateRaw = typeof fd.get("end_date") === "string" ? (fd.get("end_date") as string) : "";
  const note = typeof fd.get("note") === "string" ? (fd.get("note") as string).trim() : "";

  if (!(CAL_COUNTRIES as readonly string[]).includes(country)) fieldErrors.country = "Elige un país.";
  if (!(CAL_KINDS as readonly string[]).includes(kind)) fieldErrors.kind = "Elige el tipo.";
  if (!name) fieldErrors.name = "El nombre es obligatorio.";
  if (!ISO_DATE_RE.test(startDate)) fieldErrors.start_date = "Fecha de inicio inválida.";

  let endDate: string | null = null;
  if (endDateRaw) {
    if (!ISO_DATE_RE.test(endDateRaw)) {
      fieldErrors.end_date = "Fecha de fin inválida.";
    } else if (ISO_DATE_RE.test(startDate) && endDateRaw < startDate) {
      fieldErrors.end_date = "El fin no puede ser antes del inicio.";
    } else {
      endDate = endDateRaw;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      country: country as CalCountry,
      kind: kind as CalKind,
      name,
      startDate,
      endDate,
      note,
    },
  };
}
