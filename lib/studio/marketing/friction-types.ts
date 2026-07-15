/**
 * Types, enums, validadores y helpers de "Reportar fricción" (SDD-0119
 * Slice 1 · módulo Marketing). Match con la migración
 * 0234_marketing_friction_reports.sql.
 *
 * Principio rector de la spec: lo que a Fiorella (o a quien tenga acceso al
 * módulo de marketing) le quita tiempo o no le gusta hacer, se reporta acá →
 * cola de automatización que Sam revisa y prioriza con IA en el ERP.
 *
 * Convenciones del proyecto: sin Zod — validateFrictionReportInput() propio.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─── Status (match CHECK de 0234) ─────────────────────────────

export type FrictionReportStatus = "open" | "triaged" | "resolved";

export const FRICTION_REPORT_STATUSES: FrictionReportStatus[] = [
  "open",
  "triaged",
  "resolved",
];

export const FRICTION_STATUS_LABELS: Record<FrictionReportStatus, string> = {
  open: "Abierto",
  triaged: "En revisión",
  resolved: "Resuelto",
};

export function frictionStatusTone(status: FrictionReportStatus): BadgeTone {
  switch (status) {
    case "open":
      return "warning";
    case "triaged":
      return "info";
    case "resolved":
      return "success";
    default:
      return "neutral";
  }
}

// ─── Entity row (match schema 0234) ───────────────────────────

export interface FrictionReport {
  id: string;
  tenant_id: string;
  reporter_user_id: string;
  title: string;
  description: string;
  status: FrictionReportStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Validación (sin Zod) ──────────────────────────────────────

export const FRICTION_TITLE_MAX = 140;
export const FRICTION_DESCRIPTION_MAX = 2000;

export type FrictionFieldErrors = Partial<Record<"title" | "description", string>>;

export interface FrictionReportActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: FrictionFieldErrors;
}

export interface FrictionReportInput {
  title: string;
  description: string;
}

/**
 * Valida título + descripción del reporte de fricción: no vacíos, no
 * solo-espacios, dentro del máximo. Devuelve el input trimmeado en `input`
 * si pasa, o `fieldErrors` si no (mismo patrón que validateCommentInput).
 */
export function validateFrictionReportInput(
  partial: Partial<FrictionReportInput>,
): { input?: FrictionReportInput; fieldErrors?: FrictionFieldErrors } {
  const fieldErrors: FrictionFieldErrors = {};

  const rawTitle = partial.title ?? "";
  const title = rawTitle.trim();
  if (title.length === 0) {
    fieldErrors.title = "El título no puede estar vacío";
  } else if (rawTitle.length > FRICTION_TITLE_MAX) {
    fieldErrors.title = `El título supera el máximo de ${FRICTION_TITLE_MAX} caracteres`;
  }

  const rawDescription = partial.description ?? "";
  const description = rawDescription.trim();
  if (description.length === 0) {
    fieldErrors.description = "Cuéntanos qué te quita tiempo (no puede estar vacío)";
  } else if (rawDescription.length > FRICTION_DESCRIPTION_MAX) {
    fieldErrors.description = `La descripción supera el máximo de ${FRICTION_DESCRIPTION_MAX} caracteres`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { title, description } };
}
