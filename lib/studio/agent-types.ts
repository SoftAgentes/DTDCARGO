/**
 * Types, enums, validators y helpers de label/badge para el módulo
 * Agentes y Skills (SDD-0020). Match con migración 0015_agents.sql.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validate*Input() propios.
 *   - LABELS en castellano-VE.
 *   - badgeTone helpers retornan los 6 tonos oficiales del sistema
 *     (success/warning/danger/info/wine/neutral).
 */

// ─── Enums ───────────────────────────────────────────────────

export type AgentStatus = "off" | "paused" | "active";
export const AGENT_STATUSES: AgentStatus[] = ["off", "paused", "active"];

export type AgentRunTrigger = "manual" | "cron" | "webhook" | "event";
export const AGENT_RUN_TRIGGERS: AgentRunTrigger[] = [
  "manual",
  "cron",
  "webhook",
  "event",
];

export type AgentRunStatus =
  | "running"
  | "ok"
  | "error"
  | "timeout"
  | "needs_approval";
export const AGENT_RUN_STATUSES: AgentRunStatus[] = [
  "running",
  "ok",
  "error",
  "timeout",
  "needs_approval",
];

export type AgentApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";
export const AGENT_APPROVAL_STATUSES: AgentApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
];

export type AgentModel =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";
export const AGENT_MODELS: AgentModel[] = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];

// ─── Entity types (match schema 0015) ────────────────────────

export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  default_model: AgentModel;
  default_trigger: AgentRunTrigger;
  tools_required: string[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  system_prompt: string;
  cost_estimate_usd: number;
  version: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  tenant_id: string;
  skill_id: string;
  slug: string;
  name: string;
  status: AgentStatus;
  config: Record<string, unknown>;
  model: AgentModel;
  trigger_config: Record<string, unknown>;
  budget_usd_monthly: number;
  spend_usd_mtd: number;
  last_run_at: string | null;
  last_spend_reset_at: string;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentWithSkill extends Agent {
  skill: Skill;
}

export interface AgentToolGrant {
  id: string;
  agent_id: string;
  tool_key: string;
  scope: Record<string, unknown>;
  granted_by: string | null;
  granted_at: string;
}

export interface AgentToolCall {
  tool_key: string;
  input: unknown;
  output?: unknown;
  error?: string;
  started_at: string;
  ended_at?: string;
  latency_ms?: number;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  tenant_id: string;
  trigger: AgentRunTrigger;
  trigger_source: string | null;
  idempotency_key: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: AgentRunStatus;
  tool_calls: AgentToolCall[];
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  error: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface AgentRunWithAgent extends AgentRun {
  agent: Pick<Agent, "id" | "name" | "slug"> & {
    skill: Pick<Skill, "slug" | "name" | "icon">;
  };
}

export interface AgentApproval {
  id: string;
  agent_run_id: string;
  tenant_id: string;
  requested_action: string;
  payload: Record<string, unknown>;
  status: AgentApprovalStatus;
  approver_id: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ─── KPIs (computed) ─────────────────────────────────────────

export interface AgentKpis {
  /** Agentes instalados (cualquier status, excluye soft-deleted). */
  installed: number;
  /** Agentes con status='active' (corriendo). */
  active: number;
  runsToday: number;
  spendMtd: number;
  errors24h: number;
  approvalsPending: number;
}

// ─── Inputs + Action states ──────────────────────────────────

export interface InstallSkillInput {
  skill_id: string;
  name: string;
  model: AgentModel;
  budget_usd_monthly: number;
  trigger_config?: Record<string, unknown>;
}

export interface AgentConfigInput {
  name: string;
  model: AgentModel;
  budget_usd_monthly: number;
  config?: Record<string, unknown>;
  trigger_config?: Record<string, unknown>;
  status?: AgentStatus;
}

export interface RunInput {
  agent_id: string;
  trigger: AgentRunTrigger;
  trigger_source?: string;
  input: Record<string, unknown>;
  idempotency_key?: string;
}

export type ActionFieldErrors = Partial<Record<string, string>>;

export interface AgentActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  agentId?: string;
}

export interface RunActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  runId?: string;
}

// ─── Validators (sin Zod) ────────────────────────────────────

export function validateInstallSkillInput(
  partial: Partial<InstallSkillInput>,
): { input?: InstallSkillInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.skill_id || typeof partial.skill_id !== "string") {
    fieldErrors.skill_id = "Skill requerida";
  }
  if (!partial.name || partial.name.trim().length < 2) {
    fieldErrors.name = "Nombre requerido (min 2 caracteres)";
  } else if (partial.name.length > 80) {
    fieldErrors.name = "Nombre demasiado largo (max 80)";
  }
  if (!partial.model || !AGENT_MODELS.includes(partial.model as AgentModel)) {
    fieldErrors.model = "Modelo inválido";
  }
  const budget = Number(partial.budget_usd_monthly);
  if (!Number.isFinite(budget) || budget <= 0) {
    fieldErrors.budget_usd_monthly = "Presupuesto debe ser > 0";
  } else if (budget > 10000) {
    fieldErrors.budget_usd_monthly = "Presupuesto demasiado alto (max $10,000)";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      skill_id: partial.skill_id!,
      name: partial.name!.trim(),
      model: partial.model as AgentModel,
      budget_usd_monthly: budget,
      trigger_config: partial.trigger_config ?? {},
    },
  };
}

export function validateAgentConfigInput(
  partial: Partial<AgentConfigInput>,
): { input?: AgentConfigInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.name || partial.name.trim().length < 2) {
    fieldErrors.name = "Nombre requerido";
  }
  if (!partial.model || !AGENT_MODELS.includes(partial.model as AgentModel)) {
    fieldErrors.model = "Modelo inválido";
  }
  const budget = Number(partial.budget_usd_monthly);
  if (!Number.isFinite(budget) || budget <= 0) {
    fieldErrors.budget_usd_monthly = "Presupuesto debe ser > 0";
  }
  if (
    partial.status &&
    !AGENT_STATUSES.includes(partial.status as AgentStatus)
  ) {
    fieldErrors.status = "Estado inválido";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      name: partial.name!.trim(),
      model: partial.model as AgentModel,
      budget_usd_monthly: budget,
      config: partial.config ?? {},
      trigger_config: partial.trigger_config ?? {},
      status: partial.status as AgentStatus | undefined,
    },
  };
}

export function validateRunInput(
  partial: Partial<RunInput>,
): { input?: RunInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.agent_id) fieldErrors.agent_id = "Agent requerido";
  if (!partial.trigger || !AGENT_RUN_TRIGGERS.includes(partial.trigger as AgentRunTrigger)) {
    fieldErrors.trigger = "Trigger inválido";
  }
  if (!partial.input || typeof partial.input !== "object") {
    fieldErrors.input = "Input requerido (objeto JSON)";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      agent_id: partial.agent_id!,
      trigger: partial.trigger as AgentRunTrigger,
      trigger_source: partial.trigger_source,
      input: partial.input as Record<string, unknown>,
      idempotency_key: partial.idempotency_key,
    },
  };
}

// ─── Label helpers (castellano-VE) ───────────────────────────

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  off: "Apagado",
  paused: "Pausado",
  active: "Activo",
};

export function agentStatusLabel(s: AgentStatus): string {
  return AGENT_STATUS_LABELS[s];
}

export const RUN_STATUS_LABELS: Record<AgentRunStatus, string> = {
  running: "Corriendo",
  ok: "OK",
  error: "Error",
  timeout: "Timeout",
  needs_approval: "Necesita aprobación",
};

export function runStatusLabel(s: AgentRunStatus): string {
  return RUN_STATUS_LABELS[s];
}

export const APPROVAL_STATUS_LABELS: Record<AgentApprovalStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
};

export function approvalStatusLabel(s: AgentApprovalStatus): string {
  return APPROVAL_STATUS_LABELS[s];
}

export const TRIGGER_LABELS: Record<AgentRunTrigger, string> = {
  manual: "Manual",
  cron: "Cron",
  webhook: "Webhook",
  event: "Evento",
};

export function triggerLabel(t: AgentRunTrigger): string {
  return TRIGGER_LABELS[t];
}

export const MODEL_LABELS: Record<AgentModel, string> = {
  "claude-opus-4-7": "Claude Opus 4.7",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
};

export function modelLabel(m: AgentModel): string {
  return MODEL_LABELS[m];
}

export const MODEL_SHORT_LABELS: Record<AgentModel, string> = {
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
};

export function modelShortLabel(m: AgentModel): string {
  return MODEL_SHORT_LABELS[m];
}

// ─── Badge tone helpers (6 tonos oficiales del sistema) ──────

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export function agentStatusBadgeTone(s: AgentStatus): BadgeTone {
  if (s === "active") return "success";
  if (s === "paused") return "warning";
  return "neutral";
}

export function runStatusBadgeTone(s: AgentRunStatus): BadgeTone {
  if (s === "ok") return "success";
  if (s === "running") return "info";
  if (s === "needs_approval") return "wine";
  if (s === "timeout") return "warning";
  if (s === "error") return "danger";
  return "neutral";
}

export function approvalStatusBadgeTone(s: AgentApprovalStatus): BadgeTone {
  if (s === "approved") return "success";
  if (s === "pending") return "wine";
  if (s === "rejected") return "danger";
  return "neutral";
}

export function modelBadgeTone(m: AgentModel): BadgeTone {
  // Opus = wine (premium), Sonnet = info, Haiku = neutral
  if (m === "claude-opus-4-7") return "wine";
  if (m === "claude-sonnet-4-6") return "info";
  return "neutral";
}

// ─── Formatters ──────────────────────────────────────────────

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatCostUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `<$0.01`;
  return USD_FMT.format(n);
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/** Porcentaje del budget consumido (0–100, redondeado entero). */
export function budgetUsagePct(
  spendMtd: number,
  budget: number,
): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((spendMtd / budget) * 100));
}

/**
 * Tono para el badge/bar del budget según consumo.
 * <60% success · 60-80 warning · >80 danger.
 */
export function budgetUsageBadgeTone(
  spendMtd: number,
  budget: number,
): BadgeTone {
  const pct = budgetUsagePct(spendMtd, budget);
  if (pct < 60) return "success";
  if (pct < 80) return "warning";
  return "danger";
}
