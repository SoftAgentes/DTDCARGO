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
/**
 * Integración NO consultada a propósito. Distinto de `skipped()`, que significa
 * "no configurada": acá SÍ está configurada, pero cada ping cuesta cuota o
 * tokens y un vigía externo que sondea cada pocos minutos la agotaría.
 */
function notChecked(motivo: string): IntegrationHealth {
  return { status: "skipped", latencyMs: null, error: null, detail: motivo };
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

/**
 * `name` del cuerpo de error de Resend (`{ statusCode, message, name }`), sin
 * confiar en su forma. Sólo se compara: nunca se copia al resultado.
 */
function resendErrorName(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const name = (body as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

/**
 * 🔴 **Por qué se lee el cuerpo y no sólo el código (SDD-0527).**
 *
 * `GET /domains` responde 401 a dos llaves muy distintas:
 *   - «Sending access» (la del runbook): `name: "restricted_api_key"`. La llave
 *     existe y envía; sólo no puede leer otros recursos.
 *   - Borrada o inválida: «API key is invalid». No envía nada.
 * Antes cualquier 401/403 salía verde, y /studio/debug no podía decir si la
 * llave de un entorno había muerto (el 2026-10-15 se borraron dos por error).
 * Ahora sólo `restricted_api_key` cuenta como sana sin acceso completo.
 *
 * La llave va únicamente en el header: el resultado no copia texto del cuerpo
 * de Resend y aquí no se registra nada.
 */
async function checkResend(): Promise<IntegrationHealth> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return skipped();
  // GET /domains lista dominios verificados · 200 sólo con acceso completo
  const r = await timedFetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (r.ok) {
    const data = r.body as { data?: Array<{ name: string; status: string }> } | undefined;
    const domains = data?.data ?? [];
    const verified = domains.filter((d) => d.status === "verified").length;
    return ok(r.latencyMs, `acceso completo · ${verified} dominio(s) verificado(s)`);
  }
  // Se decide por el `name`, que prueba que la llave existe, y no por el código.
  // El correo entrante de Conversaciones baja el contenido con esta misma llave
  // (`GET /emails/receiving/:id`), y una llave de sólo envío no puede.
  if (resendErrorName(r.body) === "restricted_api_key") {
    return ok(
      r.latencyMs,
      "llave solo de envío · el correo entrante de Conversaciones no funcionará",
    );
  }
  if (r.status === 401 || r.status === 403) {
    return err(r.latencyMs, `llave inválida o borrada · HTTP ${r.status}`);
  }
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
  // Key Sending-scoped no puede listar /webhooks → 401/403, pero el webhook
  // puede estar configurado y activo (lo confirma el dashboard de Resend).
  if (r.status === 401 || r.status === 403) {
    return ok(r.latencyMs, "secret configurado · lista no legible con key Sending-scoped");
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

// ─── SeaRates (fletes marítimos · benchmark interno) ──────────

/**
 * Cuántas filas de `ocean_rates` tienen tarifa usable (`status='ok'`). `null` = no
 * se pudo mirar (sin service_role, DB caída) → el chequeo no degrada por eso.
 *
 * Import DINÁMICO a propósito: este módulo lo cargan tests y superficies que no
 * tienen service_role, y un import estático de `@/lib/db/admin` los rompería al
 * cargar. Lectura gratis: NO gasta cuota de SeaRates.
 */
async function countLiveOceanRates(): Promise<number | null> {
  try {
    const { createAdminClient } = await import("@/lib/db/admin");
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("ocean_rates")
      .select("id", { count: "exact", head: true })
      .eq("status", "ok");
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/** Firma del contador inyectable (para poder probar el falso verde sin DB). */
export type LiveOceanRateCounter = () => Promise<number | null>;

/**
 * 🔴 **Por qué esto NO es sólo un ping (SDD-0291).**
 *
 * El endpoint de auth de SeaRates emite el platform token con SÓLO mirar que la
 * cuenta exista — no consulta permisos. Medido en vivo el 24-ago-2026: devolvía
 * **HTTP 200 con token** mientras rates FCL, rates LCL y el tracking respondían
 * los tres `403 ACCESS_DENIED`. O sea que /studio/debug pintaba SeaRates en
 * **verde con todo muerto**: el panel que existe justo para enterarse de esto era
 * el último en enterarse.
 *
 * El arreglo no gasta cuota: se cruza el auth con la caché que el cron ya llena.
 * Auth OK + **cero** tarifas usables = no está sano, por muy 200 que dé el token.
 * Si la caché no se puede leer (`null`), se conserva el comportamiento viejo en
 * vez de inventar un rojo.
 */
async function checkSeaRates(
  countLive: LiveOceanRateCounter = countLiveOceanRates,
): Promise<IntegrationHealth> {
  const platformId = process.env.SEARATES_PLATFORM_ID;
  const apiKey = process.env.SEARATES_API_KEY;
  if (!platformId || !apiKey) return skipped();
  // Pinga el AUTH endpoint (lo único confirmado · vive en www.searates.com).
  // Es la llamada más barata para confirmar "viva" sin consultar tarifas. Cuota
  // 100/mes → cacheado 60s vía timedFetch para no bombardear en cada render.
  const url = `https://www.searates.com/auth/platform-token?id=${encodeURIComponent(
    platformId,
  )}&api_key=${encodeURIComponent(apiKey)}`;
  const r = await timedFetch(url);
  if (r.ok) {
    const live = await countLive();
    if (live === 0) {
      return err(
        r.latencyMs,
        "auth OK pero 0 tarifas vivas en caché — el acceso al producto puede estar revocado",
      );
    }
    return ok(
      r.latencyMs,
      live == null
        ? "auth OK · token emitido"
        : `auth OK · ${live} tarifas vivas en caché`,
    );
  }
  if (r.status === 401 || r.status === 403) return err(r.latencyMs, "credenciales inválidas");
  if (r.status === 429) return err(r.latencyMs, "rate limited (cuota 100/mes?)");
  return err(r.latencyMs, r.error ?? `HTTP ${r.status}`);
}

/** Sólo para tests: permite inyectar el contador de tarifas vivas. */
export const __checkSeaRatesForTests = checkSeaRates;

/**
 * Integraciones cuyo ping consume cuota o tokens facturables. SeaRates es el
 * caso duro: cuota de 100 llamadas/MES compartida con el cotizador FCL, contra
 * un vigía externo que sondearía ~96 veces por DÍA.
 */
export const METERED_INTEGRATIONS = ["anthropic", "openrouter", "searates"] as const;

export type CheckAllOptions = {
  /**
   * Salta las de `METERED_INTEGRATIONS` y las devuelve como `skipped` con el
   * motivo en `detail`. Default `false`: sin argumentos el comportamiento es
   * idéntico al de siempre — que es lo que usa /studio/debug.
   */
  skipMetered?: boolean;
};

// ─── Orquestador · corre las 9 en paralelo ────────────────────
export async function checkAllIntegrations(
  options: CheckAllOptions = {},
): Promise<Record<IntegrationKey, IntegrationHealth>> {
  const skipMetered = options.skipMetered === true;
  const saltada = (): IntegrationHealth =>
    notChecked("no consultada · modo barato (consume cuota)");

  const [
    supabase,
    resend,
    resendWebhook,
    telegram,
    telegramWebhook,
    anthropic,
    openrouter,
    hailuway,
    searates,
  ] = await Promise.all([
    checkSupabase(),
    checkResend(),
    checkResendWebhook(),
    checkTelegramBot(),
    checkTelegramWebhook(),
    skipMetered ? saltada() : checkAnthropic(),
    skipMetered ? saltada() : checkOpenRouter(),
    checkHailuway(),
    skipMetered ? saltada() : checkSeaRates(),
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
    searates,
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
    // El endpoint remoto está gateado por DEBUG_HEALTH_SECRET (fail-closed). Mandamos
    // el secreto por header; debe coincidir con el del deploy remoto (misma env var
    // en .env.local y en Vercel). Sin él, el remoto responde 401/503 y devolvemos
    // el error de forma elegante (EstadoTab ya lo maneja como "no alcanzable").
    const secret = process.env.DEBUG_HEALTH_SECRET;
    const res = await fetch(`${siteUrl}/api/debug/health`, {
      signal: ctrl.signal,
      headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
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
