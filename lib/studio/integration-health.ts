/**
 * Healthchecks en vivo de las integraciones externas del Studio.
 *
 * Distinción importante vs env-status.ts:
 *   - env-status      = ¿la env var está seteada? (configuración)
 *   - integration-health = ¿el servicio responde de verdad? (funcional)
 *
 * Usado por /studio/debug para mostrar el badge "Web status" al lado del
 * "Configurado". Permite al founder enterarse si una integración configurada
 * está realmente viva o si el proveedor externo se cayó / rate-limiteó /
 * suspendió la cuenta sin tener que mandar un mail/disparar bot para
 * descubrirlo.
 *
 * Server-side, sin secrets al cliente. Todos los chequeos corren en
 * paralelo con timeout 5s. Cacheados 60s vía next.revalidate para no
 * bombardear las APIs en cada render.
 */

import type { IntegrationKey } from "./env-status";

export type HealthStatus = "ok" | "error" | "skipped";

export type IntegrationHealth = {
  status: HealthStatus;
  latencyMs: number | null;
  error: string | null;
  detail?: string | null;
};

const TIMEOUT_MS = 5000;
const CACHE_REVALIDATE_SEC = 60;

// ─── Helper: fetch con timeout + cache server-side ────────────
async function timedFetch(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; latencyMs: number; body?: unknown; error?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      next: {
        revalidate: CACHE_REVALIDATE_SEC,
        tags: ["integration-health"],
      },
    });
    clearTimeout(timer);
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      /* no JSON body */
    }
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - start,
      body,
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function skipped(): IntegrationHealth {
  return { status: "skipped", latencyMs: null, error: null };
}
function ok(latencyMs: number, detail?: string): IntegrationHealth {
  return { status: "ok", latencyMs, error: null, detail: detail ?? null };
}
function err(latencyMs: number, error: string): IntegrationHealth {
  return { status: "error", latencyMs, error, detail: null };
}

// ─── Supabase ─────────────────────────────────────────────────
async function checkSupabase(): Promise<IntegrationHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return skipped();
  // /auth/v1/health devuelve metadata del GoTrue. Las keys Q4 2025
  // requieren `apikey` header incluso en endpoints "públicos" (sin él,
  // 401 "No API key found in request").
  const r = await timedFetch(`${url}/auth/v1/health`, {
    headers: { apikey: anon },
  });
  if (r.ok) {
    const data = r.body as { version?: string } | undefined;
    return ok(r.latencyMs, data?.version ? `GoTrue ${data.version}` : undefined);
  }
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Resend (mail) ────────────────────────────────────────────
async function checkResend(): Promise<IntegrationHealth> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return skipped();
  // GET /domains lista dominios verificados · 200 con key válida
  const r = await timedFetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (r.ok) {
    const data = r.body as { data?: Array<{ name: string; status: string }> } | undefined;
    const domains = data?.data ?? [];
    const verified = domains.filter((d) => d.status === "verified").length;
    return ok(r.latencyMs, `${verified} dominio(s) verificado(s)`);
  }
  if (r.status === 401 || r.status === 403) return err(r.latencyMs, "API key inválida");
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Resend webhook ───────────────────────────────────────────
async function checkResendWebhook(): Promise<IntegrationHealth> {
  const key = process.env.RESEND_API_KEY;
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!key || !secret) return skipped();
  // Lista webhooks · si hay al menos uno configurado, OK
  const r = await timedFetch("https://api.resend.com/webhooks", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (r.ok) {
    const data = r.body as { data?: Array<{ id: string; status: string }> } | undefined;
    const hooks = data?.data ?? [];
    if (hooks.length === 0) {
      return err(r.latencyMs, "Secret seteado pero sin webhooks registrados");
    }
    return ok(r.latencyMs, `${hooks.length} webhook(s) activo(s)`);
  }
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Telegram bot ─────────────────────────────────────────────
async function checkTelegramBot(): Promise<IntegrationHealth> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return skipped();
  const r = await timedFetch(`https://api.telegram.org/bot${token}/getMe`);
  if (r.ok) {
    const data = r.body as { ok?: boolean; result?: { username?: string } } | undefined;
    if (data?.ok) {
      return ok(r.latencyMs, data.result?.username ? `@${data.result.username}` : undefined);
    }
    return err(r.latencyMs, "Bot no respondió OK");
  }
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Telegram webhook ─────────────────────────────────────────
async function checkTelegramWebhook(): Promise<IntegrationHealth> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return skipped();
  const r = await timedFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  if (r.ok) {
    const data = r.body as {
      ok?: boolean;
      result?: { url?: string; last_error_message?: string; pending_update_count?: number };
    } | undefined;
    if (data?.ok) {
      const info = data.result;
      if (!info?.url) return err(r.latencyMs, "Webhook no configurado en Telegram");
      if (info.last_error_message) {
        return err(r.latencyMs, `Último error: ${info.last_error_message.slice(0, 60)}`);
      }
      const pending = info.pending_update_count ?? 0;
      return ok(r.latencyMs, pending > 0 ? `${pending} pendientes` : "0 pendientes");
    }
    return err(r.latencyMs, "Telegram no respondió OK");
  }
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Anthropic (AI) ───────────────────────────────────────────
async function checkAnthropic(): Promise<IntegrationHealth> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return skipped();
  // GET /models lista modelos disponibles · sin gasto de tokens
  const r = await timedFetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
  });
  if (r.ok) {
    const data = r.body as { data?: Array<{ id: string }> } | undefined;
    const count = data?.data?.length ?? 0;
    return ok(r.latencyMs, `${count} model(s) disponibles`);
  }
  if (r.status === 401) return err(r.latencyMs, "API key inválida");
  if (r.status === 429) return err(r.latencyMs, "Rate limited");
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── OpenRouter (AI alternativo) ──────────────────────────────
async function checkOpenRouter(): Promise<IntegrationHealth> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return skipped();
  // GET /models lista modelos disponibles · sin gasto de tokens
  const r = await timedFetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (r.ok) {
    const data = r.body as { data?: Array<{ id: string }> } | undefined;
    const count = data?.data?.length ?? 0;
    return ok(r.latencyMs, `${count} model(s) disponibles`);
  }
  if (r.status === 401) return err(r.latencyMs, "API key inválida");
  if (r.status === 429) return err(r.latencyMs, "Rate limited");
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── ERP HailuWay ─────────────────────────────────────────────
async function checkHailuway(): Promise<IntegrationHealth> {
  const api = process.env.NEXT_PUBLIC_HAILUWAY_API;
  const key = process.env.DTD_API_KEY;
  if (!api || !key) return skipped();
  // Probamos /api/public/health · si no existe, devolverá 404
  const r = await timedFetch(`${api}/api/public/health`, {
    headers: { "x-api-key": key },
  });
  if (r.ok) return ok(r.latencyMs);
  if (r.status === 404) return err(r.latencyMs, "Endpoint /health no existe en el ERP");
  if (r.status === 401 || r.status === 403) return err(r.latencyMs, "API key inválida");
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

// ─── Orquestador · corre las 8 en paralelo ────────────────────
export async function checkAllIntegrations(): Promise<
  Record<IntegrationKey, IntegrationHealth>
> {
  const [
    supabase,
    resend,
    resendWebhook,
    telegram,
    telegramWebhook,
    anthropic,
    openrouter,
    hailuway,
  ] = await Promise.all([
    checkSupabase(),
    checkResend(),
    checkResendWebhook(),
    checkTelegramBot(),
    checkTelegramWebhook(),
    checkAnthropic(),
    checkOpenRouter(),
    checkHailuway(),
  ]);
  return {
    supabase,
    resend,
    resendWebhook,
    telegram,
    telegramWebhook,
    anthropic,
    openrouter,
    hailuway,
  };
}

// ─── UI helpers ───────────────────────────────────────────────
export function healthTone(s: HealthStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "ok") return "success";
  if (s === "error") return "danger";
  return "neutral";
}

export function healthLabel(h: IntegrationHealth): string {
  if (h.status === "skipped") return "Sin chequear";
  if (h.status === "ok") return h.latencyMs !== null ? `Web OK · ${h.latencyMs}ms` : "Web OK";
  return h.error ? `Web error: ${h.error}` : "Web error";
}

// ─── Fetch remoto (producción) ────────────────────────────────

import type { EnvName, IntegrationStatus } from "./env-status";

export type RemoteHealthResponse = {
  env: EnvName;
  vercelUrl: string | null;
  branch: string | null;
  commitShaShort: string | null;
  integrations: Record<IntegrationKey, IntegrationStatus>;
  health: Record<IntegrationKey, IntegrationHealth>;
  at: number;
};

export type FetchRemoteResult =
  | { ok: true; data: RemoteHealthResponse }
  | { ok: false; error: string };

/**
 * Hace fetch al endpoint /api/debug/health de la URL dada (típicamente
 * producción) para que estando en local podamos ver el estado de las
 * integraciones reales sin tener las keys.
 */
export async function fetchRemoteHealth(siteUrl: string): Promise<FetchRemoteResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${siteUrl}/api/debug/health`, {
      signal: ctrl.signal,
      next: { revalidate: CACHE_REVALIDATE_SEC, tags: ["integration-health"] },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as RemoteHealthResponse;
    return { ok: true, data };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}
