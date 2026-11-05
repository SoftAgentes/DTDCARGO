/**
 * Discord · un canal por categoría de aviso · SDD-0606.
 *
 * Las cinco categorías del Studio (SDD-0271) calzan una a una con cinco canales
 * de Discord. Cada canal tiene su webhook, y la DIRECCIÓN de cada webhook vive
 * en una variable del servidor — nunca en la base ni en el repositorio: quien
 * tenga la dirección puede escribir en el canal.
 *
 * ── La regla que evita perder un aviso ───────────────────────────────────────
 * Una categoría sin dirección propia NO calla: cae al canal de respaldo, que es
 * el de `equipo` (`#avisos-equipo`). Sólo si tampoco hay respaldo se considera
 * que Discord no está configurado para esa categoría, y el despachador sigue
 * por el camino anterior (Telegram) mientras exista.
 *
 * ── Entorno de prueba ────────────────────────────────────────────────────────
 * Con `APP_ENV=staging` Discord está apagado aunque las variables existan: un
 * alta de prueba no puede sonar en el canal real. Es el mismo criterio que el
 * correo (SDD-0544).
 */

import { resolveAppEnv, type EnvSource } from "@/lib/runtime/app-env";
import type { TelegramAlertCategory } from "@/lib/studio/telegram/alert-routing";
import { isDiscordWebhookUrl } from "./send-webhook";

export interface DiscordChannelSpec {
  /** Nombre del canal, como se ve en Discord. */
  canal: string;
  /** Variable del servidor con la dirección del webhook. */
  envVar: string;
}

export const DISCORD_CHANNELS: Record<TelegramAlertCategory, DiscordChannelSpec> = {
  registro: { canal: "#registro-clientes", envVar: "DISCORD_WEBHOOK_REGISTRO" },
  conversaciones: {
    canal: "#conversaciones-portal",
    envVar: "DISCORD_WEBHOOK_CONVERSACIONES",
  },
  bugs: { canal: "#bugs", envVar: "DISCORD_WEBHOOK_BUGS" },
  reportes: { canal: "#reporte-diario", envVar: "DISCORD_WEBHOOK_REPORTES" },
  equipo: { canal: "#avisos-equipo", envVar: "DISCORD_WEBHOOK_EQUIPO" },
};

/** La categoría cuyo canal recibe lo que no tiene canal propio. */
export const DISCORD_FALLBACK_CATEGORY: TelegramAlertCategory = "equipo";

export const DISCORD_ENV_VARS: ReadonlyArray<string> = Object.values(DISCORD_CHANNELS).map(
  (c) => c.envVar,
);

export interface DiscordTarget {
  /** La dirección del webhook. Es una llave: no se loguea ni se muestra. */
  url: string;
  /** Canal al que se escribe. */
  canal: string;
  /** true si no es el canal propio de la categoría sino el de respaldo. */
  esRespaldo: boolean;
}

function webhookOf(category: TelegramAlertCategory, env: EnvSource): string | null {
  const raw = env[DISCORD_CHANNELS[category].envVar]?.trim();
  return raw && isDiscordWebhookUrl(raw) ? raw : null;
}

/** ¿Discord puede usarse en este entorno? En prueba, nunca. */
export function discordEnabled(env: EnvSource = process.env): boolean {
  return resolveAppEnv(env) !== "staging";
}

/** El canal de respaldo, o `null` si no tiene dirección. */
export function resolveDiscordFallbackTarget(
  env: EnvSource = process.env,
): DiscordTarget | null {
  if (!discordEnabled(env)) return null;
  const url = webhookOf(DISCORD_FALLBACK_CATEGORY, env);
  if (!url) return null;
  return {
    url,
    canal: DISCORD_CHANNELS[DISCORD_FALLBACK_CATEGORY].canal,
    esRespaldo: true,
  };
}

/**
 * A dónde va una categoría en Discord: su canal propio; si no tiene dirección,
 * el de respaldo; si tampoco, `null` (Discord no configurado para ella).
 */
export function resolveDiscordTarget(
  category: TelegramAlertCategory,
  env: EnvSource = process.env,
): DiscordTarget | null {
  if (!discordEnabled(env)) return null;
  const own = webhookOf(category, env);
  if (own) {
    return { url: own, canal: DISCORD_CHANNELS[category].canal, esRespaldo: false };
  }
  return resolveDiscordFallbackTarget(env);
}

/**
 * Estado de una categoría, para la pantalla de Ajustes. Lleva SÓLO el estado:
 * la dirección no sale de este módulo hacia la interfaz.
 *
 *   - `propio`     → tiene su canal.
 *   - `respaldo`   → sin dirección propia (o inválida); cae a `#avisos-equipo`.
 *   - `sin-discord`→ ni propia ni respaldo; sigue por el camino anterior.
 *   - `apagado`    → entorno de prueba.
 */
export type DiscordCategoryState = "propio" | "respaldo" | "sin-discord" | "apagado";

export interface DiscordCategoryStatus {
  category: TelegramAlertCategory;
  canal: string;
  envVar: string;
  state: DiscordCategoryState;
  /** La variable existe pero su valor no tiene forma de webhook de Discord. */
  invalida: boolean;
}

export function discordCategoryStatus(
  categories: ReadonlyArray<TelegramAlertCategory>,
  env: EnvSource = process.env,
): DiscordCategoryStatus[] {
  const enabled = discordEnabled(env);
  const hayRespaldo = webhookOf(DISCORD_FALLBACK_CATEGORY, env) !== null;

  return categories.map((category) => {
    const spec = DISCORD_CHANNELS[category];
    const raw = env[spec.envVar]?.trim() ?? "";
    const own = webhookOf(category, env) !== null;
    let state: DiscordCategoryState;
    if (!enabled) state = "apagado";
    else if (own) state = "propio";
    else if (hayRespaldo) state = "respaldo";
    else state = "sin-discord";
    return {
      category,
      canal: spec.canal,
      envVar: spec.envVar,
      state,
      invalida: raw !== "" && !own,
    };
  });
}
