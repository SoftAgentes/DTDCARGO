/**
 * Tipos + labels + validators del módulo Bug Reporter (SDD-0036).
 * Matchea supabase/migrations/0028_bug_reporter.sql.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type BugCategory = "error" | "improve" | "suggest" | "question";

export type BugSeverity = "baja" | "media" | "alta" | "critica";

export type BugState =
  | "nuevo"
  | "triaje"
  | "espera"
  | "progreso"
  | "resuelto"
  | "descartado";

export type BugAuthorType = "user" | "admin" | "system";

export type BugNotifType =
  | "new_reply"
  | "state_change"
  | "resolved"
  | "critical_alert"
  | "duplicate_detected";

// ─────────────────────────────────────────────────────────────
// Row types
// ─────────────────────────────────────────────────────────────

export type BugReport = {
  id: string;
  tenant_id: string;
  folio: string;
  reporter_id: string;
  category: BugCategory;
  severity: BugSeverity | null;
  state: BugState;
  progress_pct: number;
  title: string;
  description: string;
  module: string;
  url: string | null;
  build_sha: string | null;
  browser_info: Record<string, unknown>;
  duplicate_hash: string | null;
  duplicate_count: number;
  duplicate_of_id: string | null;
  eta_days: number | null;
  admin_thanks: string | null;
  commit_url: string | null;
  taken_by: string | null;
  taken_at: string | null;
  resolved_at: string | null;
  discarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BugAttachment = {
  id: string;
  bug_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  uploaded_by: string;
  uploaded_at: string;
};

export type BugTechData = {
  bug_id: string;
  console_logs: BugConsoleLogEntry[];
  network_requests: BugNetworkRequestEntry[];
  session_replay_url: string | null;
  environment: BugEnvironment;
  captured_at: string;
};

export type BugConsoleLogEntry = {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  stack?: string;
  ts: string;
};

export type BugNetworkRequestEntry = {
  url: string;
  method: string;
  status: number;
  ms: number;
  ts: string;
};

export type BugEnvironment = {
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  viewport?: { w: number; h: number };
  locale?: string;
  timezone?: string;
};

export type BugMessage = {
  id: string;
  bug_id: string;
  author_id: string | null;
  author_type: BugAuthorType;
  body: string;
  created_at: string;
};

export type BugTimelineEvent = {
  id: string;
  bug_id: string;
  event_type:
    | "created"
    | "state_change"
    | "message"
    | "attachment"
    | "taken"
    | "eta_set"
    | "commit"
    | "resolved"
    | "discarded"
    | "duplicate_detected";
  actor_id: string | null;
  actor_type: BugAuthorType;
  payload: Record<string, unknown>;
  created_at: string;
};

export type UserNotificationPrefs = {
  user_id: string;
  channel_inapp: boolean;
  channel_push: boolean;
  channel_email: boolean;
  channel_telegram: boolean;
  telegram_chat_id: string | null;
  push_subscription: Record<string, unknown> | null;
  notify_on_state_change: boolean;
  notify_on_admin_reply: boolean;
  notify_on_resolved: boolean;
  notify_on_critical: boolean;
  sound_enabled: boolean;
  updated_at: string;
};

export type BugNotification = {
  id: string;
  user_id: string;
  bug_id: string | null;
  type: BugNotifType;
  payload: Record<string, unknown>;
  read_at: string | null;
  delivered_inapp_at: string | null;
  delivered_push_at: string | null;
  delivered_email_at: string | null;
  delivered_telegram_at: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const BUG_CATEGORY_LABELS: Record<BugCategory, string> = {
  error: "Error",
  improve: "Mejora",
  suggest: "Sugerencia",
  question: "Pregunta",
};

export const BUG_CATEGORY_TONES: Record<BugCategory, BadgeTone> = {
  error: "danger",
  improve: "info",
  suggest: "wine",
  question: "neutral",
};

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const BUG_SEVERITY_TONES: Record<BugSeverity, BadgeTone> = {
  baja: "neutral",
  media: "info",
  alta: "warning",
  critica: "danger",
};

export const BUG_STATE_LABELS: Record<BugState, string> = {
  nuevo: "Nuevo",
  triaje: "Triaje",
  espera: "Esperando info",
  progreso: "En progreso",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

export const BUG_STATE_TONES: Record<BugState, BadgeTone> = {
  nuevo: "info",
  triaje: "wine",
  espera: "warning",
  progreso: "info",
  resuelto: "success",
  descartado: "neutral",
};

export const BUG_STATE_PROGRESS_PCT: Record<BugState, number> = {
  nuevo: 0,
  triaje: 25,
  espera: 40,
  progreso: 65,
  resuelto: 100,
  descartado: 0,
};

// Estados activos (no terminales)
export const BUG_ACTIVE_STATES: BugState[] = [
  "nuevo",
  "triaje",
  "espera",
  "progreso",
];

export const BUG_TERMINAL_STATES: BugState[] = ["resuelto", "descartado"];

// Kanban: orden de columnas (los 5 activos · descartado solo en tabla)
export const BUG_KANBAN_STATES: BugState[] = [
  "nuevo",
  "triaje",
  "espera",
  "progreso",
  "resuelto",
];

// ─────────────────────────────────────────────────────────────
// State transitions (whitelist · matchea bug_advance_state RPC)
// ─────────────────────────────────────────────────────────────

export const BUG_STATE_TRANSITIONS: Record<BugState, BugState[]> = {
  nuevo: ["triaje", "descartado"],
  triaje: ["espera", "progreso", "descartado"],
  espera: ["triaje", "descartado"],
  progreso: ["resuelto", "espera", "descartado"],
  resuelto: [],
  descartado: [],
};

export function canTransitionBugState(from: BugState, to: BugState): boolean {
  return BUG_STATE_TRANSITIONS[from].includes(to);
}

// ─────────────────────────────────────────────────────────────
// Action state + input shapes + validators
// ─────────────────────────────────────────────────────────────

export type BugActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  bugId?: string;
  folio?: string;
  duplicated?: boolean;
};

export type CreateBugInput = {
  category: BugCategory;
  severity?: BugSeverity | null;
  title: string;
  description: string;
  module: string;
  url?: string | null;
  build_sha?: string | null;
  browser_info?: Record<string, unknown>;
  // Tech data (auto-capture, sanitized client-side)
  console_logs?: BugConsoleLogEntry[];
  network_requests?: BugNetworkRequestEntry[];
  session_replay_url?: string | null;
  environment?: BugEnvironment;
  // Dedup hash precalculado client-side (sha256(module + url + stack_signature))
  duplicate_hash?: string | null;
};

export function validateCreateBugInput(
  input: Partial<CreateBugInput>,
): { input?: CreateBugInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const category = input.category;
  if (
    !category ||
    !["error", "improve", "suggest", "question"].includes(category)
  ) {
    errors.category = "Elegí una categoría válida.";
  }

  const severity = input.severity ?? null;
  if (
    severity !== null &&
    !["baja", "media", "alta", "critica"].includes(severity)
  ) {
    errors.severity = "Severidad inválida.";
  }
  if (category && category !== "error" && severity) {
    errors.severity = "La severidad solo aplica a errores.";
  }

  const title = input.title?.trim();
  if (!title) errors.title = "El título es obligatorio.";
  else if (title.length < 4) errors.title = "Título muy corto (mín. 4 chars).";
  else if (title.length > 200) errors.title = "Título muy largo (máx. 200 chars).";

  const description = input.description?.trim();
  if (!description) errors.description = "La descripción es obligatoria.";
  else if (description.length < 10) errors.description = "Descripción muy corta.";
  else if (description.length > 4000) errors.description = "Descripción muy larga.";

  const moduleName = input.module?.trim();
  if (!moduleName) errors.module = "El módulo es obligatorio.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      category: category!,
      severity: category === "error" ? severity : null,
      title: title!,
      description: description!,
      module: moduleName!,
      url: input.url ?? null,
      build_sha: input.build_sha ?? null,
      browser_info: input.browser_info ?? {},
      console_logs: input.console_logs ?? [],
      network_requests: input.network_requests ?? [],
      session_replay_url: input.session_replay_url ?? null,
      environment: input.environment ?? {},
      duplicate_hash: input.duplicate_hash ?? null,
    },
  };
}

export type PostBugMessageInput = {
  bug_id: string;
  body: string;
};

export function validatePostBugMessageInput(
  input: Partial<PostBugMessageInput>,
): { input?: PostBugMessageInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const bugId = input.bug_id?.trim();
  if (!bugId) errors.bug_id = "Falta el ID del bug.";
  const body = input.body?.trim();
  if (!body) errors.body = "El mensaje no puede estar vacío.";
  else if (body.length > 4000) errors.body = "Mensaje muy largo (máx. 4000 chars).";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return { input: { bug_id: bugId!, body: body! } };
}

export type AdvanceBugStateInput = {
  bug_id: string;
  new_state: BugState;
  note?: string | null;
};

export function validateAdvanceBugStateInput(
  input: Partial<AdvanceBugStateInput>,
): { input?: AdvanceBugStateInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const bugId = input.bug_id?.trim();
  if (!bugId) errors.bug_id = "Falta el ID del bug.";
  const newState = input.new_state;
  if (
    !newState ||
    !["nuevo", "triaje", "espera", "progreso", "resuelto", "descartado"].includes(
      newState,
    )
  ) {
    errors.new_state = "Estado inválido.";
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: { bug_id: bugId!, new_state: newState!, note: input.note ?? null },
  };
}

// ─────────────────────────────────────────────────────────────
// Filters (admin Kanban + tabla)
// ─────────────────────────────────────────────────────────────

export type BugAdminTab = "kanban" | "tabla" | "stats";

export type BugAdminFilters = {
  tab: BugAdminTab;
  state?: BugState | "all";
  category?: BugCategory | "all";
  module?: string;
  reporter?: string;
  search?: string;
};

export function parseBugAdminFilters(
  raw: Record<string, string | string[] | undefined>,
): BugAdminFilters {
  const single = (k: string): string | undefined => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const tabRaw = single("tab");
  const stateRaw = single("state");
  const catRaw = single("category");
  return {
    tab:
      tabRaw === "tabla" || tabRaw === "stats" ? (tabRaw as BugAdminTab) : "kanban",
    state: isBugState(stateRaw) ? stateRaw : "all",
    category: isBugCategory(catRaw) ? catRaw : "all",
    module: single("module"),
    reporter: single("reporter"),
    search: single("q"),
  };
}

function isBugState(v: string | undefined): v is BugState {
  return (
    v === "nuevo" ||
    v === "triaje" ||
    v === "espera" ||
    v === "progreso" ||
    v === "resuelto" ||
    v === "descartado"
  );
}

function isBugCategory(v: string | undefined): v is BugCategory {
  return (
    v === "error" || v === "improve" || v === "suggest" || v === "question"
  );
}

// ─────────────────────────────────────────────────────────────
// Dedup hash helper (client-side · matches schema duplicate_hash)
// ─────────────────────────────────────────────────────────────

/**
 * Computa sha256 hex de (module + '\n' + url + '\n' + stack_signature).
 * El stack_signature es la primera línea del stack del último error de consola
 * (si hay), normalizada (sin URLs con timestamps, sin números de línea).
 *
 * Llamar desde el endpoint POST /api/studio/bugs antes del insert.
 * Si match con bug vivo del mismo tenant → llamar bug_increment_duplicate.
 */
export async function computeBugDedupHash(
  module: string,
  url: string | null | undefined,
  stackSignature: string | null | undefined,
): Promise<string> {
  const payload = [
    module.trim().toLowerCase(),
    (url ?? "").trim().toLowerCase(),
    (stackSignature ?? "").trim(),
  ].join("\n");

  // Edge runtime + Node 18+ tienen crypto.subtle
  const enc = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extrae el "stack signature" del primer console_log de tipo error:
 * primera línea del stack, normalizando timestamps y query strings.
 * Devuelve null si no hay errores.
 */
export function extractStackSignature(
  consoleLogs: BugConsoleLogEntry[] | undefined | null,
): string | null {
  if (!consoleLogs || consoleLogs.length === 0) return null;
  const errorEntry = consoleLogs.find((e) => e.level === "error" && e.stack);
  if (!errorEntry?.stack) return null;
  const firstLine = errorEntry.stack.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  // Normaliza: quita query strings y line:col
  return firstLine
    .replace(/\?[^):]*/g, "")
    .replace(/:\d+:\d+/g, "")
    .trim();
}
