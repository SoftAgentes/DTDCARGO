/**
 * Detector de entorno + estado de integraciones externas.
 *
 * Resuelve el problema "no sé si estoy en local o prod, ni qué integraciones
 * están vivas". Usado por:
 *   - EnvBanner (app/studio/_components/EnvBanner.tsx) — barra arriba del Studio
 *   - /studio/debug (app/studio/(app)/debug/page.tsx) — detalle completo
 *
 * NUNCA expone valores de env vars, solo booleans (active/mock/missing).
 * Safe para pasar al cliente vía server component.
 */

export type IntegrationStatus = "active" | "mock" | "missing";

export type EnvName = "local" | "preview" | "production";

export type IntegrationKey =
  | "supabase"
  | "resend"
  | "resendWebhook"
  | "telegram"
  | "telegramWebhook"
  | "anthropic"
  | "openrouter"
  | "hailuway"
  | "searates";

export type EnvStatus = {
  env: EnvName;
  vercelUrl: string | null;
  branch: string | null;
  commitSha: string | null;
  commitShaShort: string | null;
  integrations: Record<IntegrationKey, IntegrationStatus>;
  envVarsPresent: string[];
};

/**
 * Mapeo integración → env var que la habilita.
 * Single source of truth para qué chequea EnvBanner y /studio/debug.
 */
const INTEGRATION_ENV_MAP: Record<IntegrationKey, string> = {
  supabase: "NEXT_PUBLIC_SUPABASE_URL",
  resend: "RESEND_API_KEY",
  resendWebhook: "RESEND_WEBHOOK_SECRET",
  telegram: "TELEGRAM_BOT_TOKEN",
  telegramWebhook: "TELEGRAM_WEBHOOK_SECRET",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  hailuway: "DTD_API_KEY",
  searates: "SEARATES_API_KEY",
};

/**
 * Lista canónica de env vars que el Studio mira.
 * Se muestra en /studio/debug para confirmar qué hay seteado (sin valores).
 */
const TRACKED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "PAYLOAD_SECRET",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HAILUWAY_API",
  "DTD_API_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "LLM_FORCE_MOCK",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
  "SEARATES_API_BASE",
  "SEARATES_PLATFORM_ID",
  "SEARATES_API_KEY",
  "NEXT_PUBLIC_BUILD_SHA",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_API_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
];

function statusOf(envKey: string, isRequired = false): IntegrationStatus {
  if (process.env[envKey]) return "active";
  return isRequired ? "missing" : "mock";
}

export function getEnvStatus(): EnvStatus {
  const vercelEnv = process.env.VERCEL_ENV;
  let env: EnvName = "local";
  if (vercelEnv === "production") env = "production";
  else if (vercelEnv === "preview") env = "preview";

  const commitSha =
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;

  return {
    env,
    vercelUrl: process.env.VERCEL_URL ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commitSha,
    commitShaShort: commitSha ? commitSha.slice(0, 7) : null,
    integrations: {
      supabase: statusOf(INTEGRATION_ENV_MAP.supabase, true),
      resend: statusOf(INTEGRATION_ENV_MAP.resend),
      resendWebhook: statusOf(INTEGRATION_ENV_MAP.resendWebhook),
      telegram: statusOf(INTEGRATION_ENV_MAP.telegram),
      telegramWebhook: statusOf(INTEGRATION_ENV_MAP.telegramWebhook),
      anthropic: statusOf(INTEGRATION_ENV_MAP.anthropic),
      openrouter: statusOf(INTEGRATION_ENV_MAP.openrouter),
      hailuway: statusOf(INTEGRATION_ENV_MAP.hailuway),
      searates: statusOf(INTEGRATION_ENV_MAP.searates),
    },
    envVarsPresent: TRACKED_ENV_VARS.filter((k) => Boolean(process.env[k])),
  };
}

export function countMocks(s: EnvStatus): number {
  return Object.values(s.integrations).filter(
    (v) => v === "mock" || v === "missing",
  ).length;
}

export function integrationLabel(k: IntegrationKey): string {
  const labels: Record<IntegrationKey, string> = {
    supabase: "Supabase",
    resend: "Resend (mail)",
    resendWebhook: "Resend webhook",
    telegram: "Telegram bot",
    telegramWebhook: "Telegram webhook",
    anthropic: "Anthropic (AI)",
    openrouter: "OpenRouter (AI)",
    hailuway: "ERP HailuWay",
    searates: "SeaRates (fletes)",
  };
  return labels[k];
}

export function integrationEnvVar(k: IntegrationKey): string {
  return INTEGRATION_ENV_MAP[k];
}

export function envLabel(e: EnvName): string {
  if (e === "local") return "Local";
  if (e === "preview") return "Preview";
  return "Producción";
}

export const TRACKED_ENV_VARS_LIST = TRACKED_ENV_VARS;
