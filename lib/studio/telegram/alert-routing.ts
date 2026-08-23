/**
 * Ruteo de alertas de Telegram por CATEGORÍA · SDD-0271.
 *
 * ── El bug que cierra ────────────────────────────────────────────────────────
 * Hasta acá los avisos "al equipo" se mandaban con un bucle:
 *
 *     for (const admin of admins) await sendAdminTelegram(db, admin.user_id, text)
 *
 * Eso manda un Telegram por PERSONA. Y en producción dos cuentas admin
 * (`hailuway.com@gmail.com` y `vzla@dtdcargo.com`) tienen el MISMO
 * `telegram_chat_id` → el mismo chat recibía el mismo aviso dos veces. El correo
 * no se duplicaba porque los emails sí difieren; por eso el síntoma que se veía
 * era "me avisa dos veces en Telegram" y nada más.
 *
 * Acá el envío se resuelve por CHAT ÚNICO, no por persona. Mientras eso se
 * cumpla, dos cuentas apuntando al mismo Telegram dejan de ser un problema —
 * para los diez módulos de aviso a la vez, no sólo para el registro.
 *
 * ── El ruteo ─────────────────────────────────────────────────────────────────
 * Un chat es un DESTINO con nombre propio (`telegram_destinations`) y cada
 * categoría se dirige a uno o más destinos (`telegram_alert_routes`, migr 0386).
 * Se administra en Studio › Ajustes › Alertas de Telegram.
 *
 * ── La regla que evita perder un aviso ───────────────────────────────────────
 * Si la categoría no resuelve NINGÚN chat —sin rutas, o con el destino todavía
 * sin enlazar— el aviso cae al broadcast de admins, deduplicado: exactamente el
 * comportamiento de antes de esta spec. Una configuración a medias nunca
 * silencia una alerta.
 *
 * Best-effort de punta a punta: nunca tira. Un fallo de Telegram no puede
 * romper el alta de un cliente ni el mensaje de nadie.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

export const TELEGRAM_ALERT_CATEGORIES = [
  "registro",
  "conversaciones",
  "bugs",
  "reportes",
  "equipo",
] as const;

export type TelegramAlertCategory = (typeof TELEGRAM_ALERT_CATEGORIES)[number];

/** Cómo se lee cada categoría en pantalla (Ajustes › Alertas de Telegram). */
export const TELEGRAM_ALERT_CATEGORY_LABELS: Record<
  TelegramAlertCategory,
  string
> = {
  registro: "Registro de clientes",
  conversaciones: "Conversaciones del portal",
  bugs: "Bugs reportados",
  reportes: "Reporte diario de operaciones",
  equipo: "Otros avisos al equipo",
};

/** Qué entra en cada categoría, para que la pantalla no obligue a adivinar. */
export const TELEGRAM_ALERT_CATEGORY_HINTS: Record<
  TelegramAlertCategory,
  string
> = {
  registro:
    "Un cliente se dio de alta solo desde el sitio, o pidió entrar al portal y todavía no tiene acceso.",
  conversaciones: "Un cliente escribió por el chat del portal.",
  bugs: "Se reportó un bug de severidad alta o crítica.",
  reportes: "El brief diario de operaciones y movimientos.",
  equipo:
    "Cotizaciones, reportes de pago, packing lists, leads de contacto, estimados, consolidaciones y avisos de salud del correo.",
};

export interface DispatchOptions {
  /**
   * Usuarios que SIEMPRE reciben, además de las rutas de la categoría — el
   * destinatario per-usuario del módulo (ej.: el asesor asignado a una
   * conversación). El caller ya aplicó las preferencias de ese usuario.
   */
  alsoUserIds?: string[];
  /**
   * A quién le cae el aviso si NO se resolvió ningún chat.
   *   - `undefined` → los admins del tenant con Telegram enlazado (el
   *     comportamiento previo a SDD-0271).
   *   - `string[]`  → esos usuarios (el caller ya aplicó sus preferencias; así
   *     lo usa el aviso de bug, que respeta `channel_telegram`).
   *   - `"none"`    → nadie.
   */
  fallback?: string[] | "none";
  /** Para el log, cuando el mismo módulo dispara varias categorías. */
  logTag?: string;
}

export interface DispatchResult {
  /** Chats a los que se mandó (deduplicados). */
  chatIds: string[];
  sent: number;
  failed: number;
  /** true si no había rutas y se usó el broadcast de respaldo. */
  usedFallback: boolean;
}

// ── Puro (sin I/O) ──────────────────────────────────────────────────────────

/**
 * Junta varios grupos de chats en una lista sin repetidos, preservando el orden
 * de aparición y descartando vacíos. ESTA es la función que arregla el
 * duplicado; está separada del I/O justamente para poder probarla.
 */
export function dedupeChatIds(
  ...groups: Array<ReadonlyArray<string | null | undefined>>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const chatId = raw?.trim();
      if (!chatId || seen.has(chatId)) continue;
      seen.add(chatId);
      out.push(chatId);
    }
  }
  return out;
}

// ── Resolvedores (I/O, best-effort) ─────────────────────────────────────────

/**
 * Chats de los destinos ACTIVOS y YA ENLAZADOS ruteados a esta categoría.
 * Un destino pendiente de enlace (`chat_id is null`) no cuenta — por eso
 * configurar una ruta antes de enlazar el chat no silencia la categoría: el
 * conjunto sigue vacío y `dispatchTelegramAlert` cae al respaldo.
 */
export async function resolveCategoryChatIds(
  admin: SupabaseClient,
  tenantId: string,
  category: TelegramAlertCategory,
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from("telegram_alert_routes")
      .select("destination:telegram_destinations!destination_id ( chat_id, active )")
      .eq("tenant_id", tenantId)
      .eq("category", category);
    if (error || !data) return [];

    const chats: Array<string | null> = [];
    for (const row of data as Array<{
      destination:
        | { chat_id: string | null; active: boolean }
        | Array<{ chat_id: string | null; active: boolean }>
        | null;
    }>) {
      // PostgREST devuelve el embed como objeto o array según la cardinalidad
      // que infiera; normalizamos las dos formas.
      const dest = Array.isArray(row.destination)
        ? row.destination[0]
        : row.destination;
      if (dest?.active) chats.push(dest.chat_id);
    }
    return dedupeChatIds(chats);
  } catch (err) {
    console.error("[alert-routing] resolveCategoryChatIds falló:", err);
    return [];
  }
}

/** Chats de un conjunto de usuarios (los que tengan Telegram enlazado). */
export async function resolveUserChatIds(
  admin: SupabaseClient,
  userIds: ReadonlyArray<string>,
): Promise<string[]> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const { data, error } = await admin
      .from("user_profiles")
      .select("telegram_chat_id")
      .in("user_id", ids)
      .not("telegram_chat_id", "is", null);
    if (error || !data) return [];
    return dedupeChatIds(
      (data as Array<{ telegram_chat_id: string | null }>).map(
        (r) => r.telegram_chat_id,
      ),
    );
  } catch (err) {
    console.error("[alert-routing] resolveUserChatIds falló:", err);
    return [];
  }
}

/**
 * Chats de los admins activos del tenant. Es el respaldo: el comportamiento
 * exacto de antes de SDD-0271, menos el duplicado.
 */
export async function resolveAdminChatIds(
  admin: SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from("user_tenants")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "admin")
      .is("disabled_at", null);
    if (error || !data || data.length === 0) return [];
    return resolveUserChatIds(
      admin,
      (data as Array<{ user_id: string }>).map((r) => r.user_id),
    );
  } catch (err) {
    console.error("[alert-routing] resolveAdminChatIds falló:", err);
    return [];
  }
}

// ── El despachador ──────────────────────────────────────────────────────────

/**
 * Manda `text` a los chats de la categoría — UNA vez por chat.
 *
 * Best-effort: un fallo de un chat se loguea y sigue con los demás; nunca tira.
 */
export async function dispatchTelegramAlert(
  admin: SupabaseClient,
  tenantId: string,
  category: TelegramAlertCategory,
  text: string,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const tag = opts.logTag ?? category;
  const empty: DispatchResult = {
    chatIds: [],
    sent: 0,
    failed: 0,
    usedFallback: false,
  };

  try {
    const routed = await resolveCategoryChatIds(admin, tenantId, category);
    const perUser = opts.alsoUserIds?.length
      ? await resolveUserChatIds(admin, opts.alsoUserIds)
      : [];

    let chatIds = dedupeChatIds(routed, perUser);
    let usedFallback = false;

    // Sin ningún chat resuelto → respaldo. Nunca se pierde un aviso por una
    // configuración a medias.
    if (chatIds.length === 0 && opts.fallback !== "none") {
      const fallbackChats = Array.isArray(opts.fallback)
        ? await resolveUserChatIds(admin, opts.fallback)
        : await resolveAdminChatIds(admin, tenantId);
      chatIds = dedupeChatIds(fallbackChats);
      usedFallback = chatIds.length > 0;
      if (usedFallback) {
        console.warn(
          `[alert-routing] "${tag}" sin destino enlazado — cae al broadcast de admins (${chatIds.length} chats)`,
        );
      }
    }

    if (chatIds.length === 0) return empty;

    let sent = 0;
    let failed = 0;
    for (const chatId of chatIds) {
      const res = await sendTelegramMessage(chatId, text);
      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        console.error(`[alert-routing] "${tag}" falló a ${chatId}:`, res.error);
      }
    }

    return { chatIds, sent, failed, usedFallback };
  } catch (err) {
    console.error(`[alert-routing] dispatchTelegramAlert("${tag}") falló:`, err);
    return empty;
  }
}
