/**
 * Tipos + helpers PUROS del módulo Nómina · Amonestaciones (SDD-0103 · Slice C).
 * Matchea supabase/migrations/0170_nomina_warnings.sql.
 *
 * Acta disciplinaria (Art. 79 LOTTT): causal + relato + testigos + severidad.
 * El asistente del Norte la arma por pasos (causa → relato → testigos → acta).
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo). Reusa los helpers base (strOrNull) y los
 * tonos de `employee-types`.
 */

import { strOrNull, type NominaBadgeTone } from "./employee-types";

export { strOrNull };
export type { NominaBadgeTone };

// ╔═══════════════════════════════════════════════════════════╗
// ║ Severidad · leve / grave / muy_grave                       ║
// ╚═══════════════════════════════════════════════════════════╝
export type WarningSeverity = "leve" | "grave" | "muy_grave";

export const WARNING_SEVERITY: WarningSeverity[] = ["leve", "grave", "muy_grave"];

export const WARNING_SEVERITY_META: Record<
  WarningSeverity,
  { label: string; tone: NominaBadgeTone }
> = {
  leve: { label: "Leve", tone: "info" },
  grave: { label: "Grave", tone: "warning" },
  muy_grave: { label: "Muy grave", tone: "danger" },
};

export const WARNING_SEVERITY_OPTIONS: { value: WarningSeverity; label: string }[] =
  WARNING_SEVERITY.map((s) => ({ value: s, label: WARNING_SEVERITY_META[s].label }));

export function warningSeverityLabel(s: string): string {
  return WARNING_SEVERITY_META[s as WarningSeverity]?.label ?? s;
}
export function warningSeverityTone(s: string): NominaBadgeTone {
  return WARNING_SEVERITY_META[s as WarningSeverity]?.tone ?? "neutral";
}
export function isWarningSeverity(v: unknown): v is WarningSeverity {
  return typeof v === "string" && (WARNING_SEVERITY as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado · emitida / anulada                                 ║
// ╚═══════════════════════════════════════════════════════════╝
export type WarningStatus = "emitida" | "anulada";

export const WARNING_STATUSES: WarningStatus[] = ["emitida", "anulada"];

export const WARNING_STATUS_META: Record<
  WarningStatus,
  { label: string; tone: NominaBadgeTone }
> = {
  emitida: { label: "Emitida", tone: "success" },
  anulada: { label: "Anulada", tone: "neutral" },
};

export function warningStatusLabel(s: string): string {
  return WARNING_STATUS_META[s as WarningStatus]?.label ?? s;
}
export function warningStatusTone(s: string): NominaBadgeTone {
  return WARNING_STATUS_META[s as WarningStatus]?.tone ?? "neutral";
}
export function isWarningStatus(v: unknown): v is WarningStatus {
  return typeof v === "string" && (WARNING_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Catálogo de causales (Art. 79 LOTTT)                       ║
// ╚═══════════════════════════════════════════════════════════╝
// Causas justificadas de despido del Art. 79 LOTTT (literales a–i). La columna
// `cause` es texto libre (extensible: el operador puede tipear una falta de
// régimen interno), pero el asistente ofrece este catálogo como guía legal.
export const ART79_CAUSES: { value: string; label: string }[] = [
  { value: "Falta de probidad o conducta inmoral (Art. 79, lit. a)", label: "Falta de probidad o conducta inmoral (lit. a)" },
  { value: "Vías de hecho (Art. 79, lit. b)", label: "Vías de hecho (lit. b)" },
  { value: "Injuria o falta grave al respeto (Art. 79, lit. c)", label: "Injuria o falta grave al respeto (lit. c)" },
  { value: "Hecho intencional o negligencia grave sobre seguridad (Art. 79, lit. d)", label: "Hecho intencional / negligencia en seguridad (lit. d)" },
  { value: "Omisiones o imprudencias que afecten la seguridad (Art. 79, lit. e)", label: "Omisiones / imprudencias en seguridad (lit. e)" },
  { value: "Inasistencia injustificada (Art. 79, lit. f)", label: "Inasistencia injustificada (lit. f)" },
  { value: "Perjuicio material por dolo o negligencia grave (Art. 79, lit. g)", label: "Perjuicio material por dolo / negligencia (lit. g)" },
  { value: "Revelación de secretos de la entidad de trabajo (Art. 79, lit. h)", label: "Revelación de secretos (lit. h)" },
  { value: "Falta grave a las obligaciones del contrato (Art. 79, lit. i)", label: "Falta grave a las obligaciones del contrato (lit. i)" },
  { value: "Falta de régimen disciplinario interno", label: "Falta de régimen disciplinario interno (otra)" },
];

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida + KPIs                                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type Warning = {
  id: string;
  tenant_id: string;
  employee_id: string;
  warning_code: string;
  issued_on: string;
  cause: string;
  narrative: string;
  witnesses: string | null;
  severity: WarningSeverity;
  status: WarningStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WarningKpis = {
  total_count: number;
  /** Amonestaciones EMITIDAS (no anuladas). */
  active_count: number;
  /** Amonestaciones emitidas dentro del mes calendario actual. */
  this_month_count: number;
  /** Amonestaciones graves o muy graves, emitidas (no anuladas). */
  severe_count: number;
};

/** ¿La fecha ISO `issued_on` cae en el mismo mes calendario que `ref`? */
function inSameMonth(issuedOn: string, ref: Date): boolean {
  if (!issuedOn || issuedOn.length < 7) return false;
  const ym = issuedOn.slice(0, 7); // YYYY-MM
  const refYm = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  return ym === refYm;
}

/**
 * KPIs de la pestaña Amonestaciones (PURO — testeable sin DB).
 *   - active     = status 'emitida'.
 *   - this_month = emitidas con issued_on en el mes de `now`.
 *   - severe     = emitidas con severidad grave / muy_grave.
 * `now` inyectable para que el test sea determinista.
 */
export function computeWarningKpis(
  warnings: { status: WarningStatus; severity: WarningSeverity; issued_on: string }[],
  now: Date = new Date(),
): WarningKpis {
  let active = 0;
  let thisMonth = 0;
  let severe = 0;
  for (const w of warnings) {
    if (w.status !== "emitida") continue;
    active += 1;
    if (inSameMonth(w.issued_on, now)) thisMonth += 1;
    if (w.severity === "grave" || w.severity === "muy_grave") severe += 1;
  }
  return {
    total_count: warnings.length,
    active_count: active,
    this_month_count: thisMonth,
    severe_count: severe,
  };
}

// ── Filtros del listado (client-side) ─────────────────────────
export type WarningFilter = "todas" | "emitida" | "anulada";

export const WARNING_FILTERS: { value: WarningFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "emitida", label: "Emitidas" },
  { value: "anulada", label: "Anuladas" },
];

export function isWarningFilter(v: unknown): v is WarningFilter {
  return typeof v === "string" && WARNING_FILTERS.some((f) => f.value === v);
}

export function warningMatchesFilter(
  warning: { status: WarningStatus },
  filter: WarningFilter,
): boolean {
  if (filter === "todas") return true;
  return warning.status === filter;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod)                              ║
// ╚═══════════════════════════════════════════════════════════╝
export type WarningInput = {
  employee_id: string;
  issued_on: string;
  cause: string;
  narrative: string;
  witnesses: string | null;
  severity: WarningSeverity;
  notes: string | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateWarningInput(
  raw: Partial<Record<string, unknown>>,
): { input: WarningInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const employeeId = String(raw.employee_id ?? "").trim();
  if (!employeeId) errors.employee_id = "Indica el empleado amonestado.";

  const cause = String(raw.cause ?? "").trim();
  if (!cause) errors.cause = "Indica la causal de la amonestación.";
  else if (cause.length > 200) errors.cause = "Causal demasiado larga (máx 200).";

  const narrative = String(raw.narrative ?? "").trim();
  if (!narrative) errors.narrative = "Describe el hecho (relato del acta).";
  else if (narrative.length > 2000) errors.narrative = "Relato demasiado largo (máx 2000).";

  const severity = String(raw.severity ?? "leve").trim();
  if (!isWarningSeverity(severity)) errors.severity = "Severidad inválida.";

  const issuedOnRaw = strOrNull(raw.issued_on);
  let issuedOn = issuedOnRaw;
  if (issuedOnRaw !== null && (!ISO_DATE_RE.test(issuedOnRaw) || Number.isNaN(Date.parse(issuedOnRaw)))) {
    errors.issued_on = "Fecha de emisión inválida.";
    issuedOn = null;
  }

  if (Object.keys(errors).length > 0) return { input: null, fieldErrors: errors };

  return {
    input: {
      employee_id: employeeId,
      issued_on: issuedOn ?? new Date().toISOString().slice(0, 10),
      cause,
      narrative,
      witnesses: strOrNull(raw.witnesses),
      severity: severity as WarningSeverity,
      notes: strOrNull(raw.notes),
    },
  };
}

/** ¿`code` tiene el formato canónico AM-NNNN (4+ dígitos)? */
export function isWarningCode(v: unknown): v is string {
  return typeof v === "string" && /^AM-\d{4,}$/.test(v);
}
