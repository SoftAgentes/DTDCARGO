/**
 * SDD-0626 §3.4 y §3.5 (Paso 3a) · Configuración del despachador mínimo del cable.
 *
 * TODO NACE APAGADO. `OFICINA_DESPACHADOR_ACTIVO` solo vale con `1` o `true` (como los demás interruptores
 * del cable); cualquier otra cosa = apagado y el despachador no toca la base, ni Chatwoot, ni el runtime.
 * Se lee del entorno en cada tanda (sin caché). Ningún valor se registra.
 *
 * - `OFICINA_RUNTIME_URL` / `OFICINA_RUNTIME_TOKEN`: el cable hacia la oficina (Paso 0). Sin ellos no corre.
 * - `OFICINA_CHATWOOT_TOKEN_LECTURA`: token del usuario agente de Chatwoot que SOLO es miembro de la bandeja de
 *   prueba. El despachador solo hace GET con él (leer la conversación); nunca envía (D1: solo el ERP envía, y
 *   solo tras la aprobación de Sam, Paso 3b). `OFICINA_CHATWOOT_API_URL` (opcional) es la URL interna de la API
 *   de Chatwoot; sin ella se usa `CHATWOOT_URL`. La cuenta es `OFICINA_CHATWOOT_ACCOUNT_ID` (nunca la del ERP) y la bandeja,
 *   `OFICINA_CHATWOOT_INBOX_PRUEBA` (la misma regla que el webhook: no puede ser una bandeja del ERP).
 * - `OFICINA_TOPE_MENSUAL_USD`: el tope del mes (D5: 15 USD). Solo se puede BAJAR: más de 15 vale 15.
 *   Al 80 % la oficina se auto-pausa (`office_autopausar_por_tope`, que solo pausa).
 * - Tope por corrida: `OFICINA_TOPE_LLAMADAS_CORRIDA` (2: la llamada y un reintento) y
 *   `OFICINA_TOPE_TOKENS_CORRIDA` (24000). Pasos (20) y tiempo (200 s, bajo el máximo de 300 s de §3.4) son fijos.
 * - Tarifa para el costo (USD por millón de tokens): `OFICINA_PRECIO_ENTRADA_USD_MTOK` (1,00) y
 *   `OFICINA_PRECIO_SALIDA_USD_MTOK` (3,20). Es una estimación conservadora: la llave de GLM es de un plan de
 *   tarifa plana, así que el costo real no sale de la factura; el tope se mide con esta tarifa. 0, negativo o
 *   inválido vale el valor por defecto (con 0 la auto-pausa no saltaría nunca).
 * - `OFICINA_VACIADO_ACTIVO` (el del vaciado diario) es REQUISITO: sin él los borradores no se borran a los 90 días
 *   (D3), así que el despachador no arranca (`sin_vaciado`).
 */
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { firstConfiguredSecret } from "@/lib/runtime/server-secret";

import { configWebhookOficina, interruptorEncendido, vaciadoActivo } from "./config";

type Entorno = Readonly<Record<string, string | undefined>>;

export const AGENTE_SOPORTE = "soporte-chatwoot";
export const TOPE_MENSUAL_MAXIMO_USD = 15;
export const UMBRAL_AUTOPAUSA = 0.8;
export const PASOS_POR_CORRIDA = 20;
/**
 * El tope de la spec es 300 s por corrida (§3.4: «máximo»). Aquí es 200 s para que una tanda (50 s de ticks +
 * una corrida + el borrado de la sesión) quepa en los 290 s de `--max-time` que el cron da a cada ruta (spec 0505).
 */
export const SEGUNDOS_POR_CORRIDA = 200;
export const PAUSA_ENTRE_CORRIDAS_S = 10;
export const TICK_MS = 10_000;

export interface ConfigDespachador {
  activo: boolean;
  /** `OFICINA_VACIADO_ACTIVO`: sin él no se borran los borradores a los 90 días (D3), así que el despachador no arranca. */
  vaciadoActivo: boolean;
  agente: string;
  runtime: { url: string; token: string } | null;
  chatwoot: { url: string; token: string; cuenta: number; bandeja: number } | null;
  topeMensualUsd: number;
  umbralAutopausa: number;
  porCorrida: { llamadas: number; tokens: number; pasos: number; segundos: number };
  precios: { entradaPorMTok: number; salidaPorMTok: number };
  pausaEntreCorridasS: number;
  tickMs: number;
  /** Cada cuánto se mira `office_esta_pausada()` durante una corrida (AC-3: abortar en ≤ 10 s). */
  vigilarPausaMs: number;
}

function numero(valor: string | undefined, porDefecto: number, min: number, max: number): number {
  const n = Number((valor ?? "").trim().replace(",", "."));
  if (!(valor ?? "").trim() || !Number.isFinite(n)) return porDefecto;
  return Math.min(Math.max(n, min), max);
}

/** Un número > 0 (con tope). Vacío, inválido, 0 o negativo → el valor por defecto: con un precio 0 la auto-pausa no saltaría nunca. */
function positivo(valor: string | undefined, porDefecto: number, max: number): number {
  const n = Number((valor ?? "").trim().replace(",", "."));
  if (!(valor ?? "").trim() || !Number.isFinite(n) || n <= 0) return porDefecto;
  return Math.min(n, max);
}

function urlValida(valor: string | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function configDespachador(env: Entorno = process.env): ConfigDespachador {
  const runtimeUrl = urlValida(env.OFICINA_RUNTIME_URL);
  const runtimeToken = firstConfiguredSecret(env.OFICINA_RUNTIME_TOKEN);
  const webhook = configWebhookOficina(env);
  const chatwootToken = firstConfiguredSecret(env.OFICINA_CHATWOOT_TOKEN_LECTURA);
  const chatwootUrl = urlValida(env.OFICINA_CHATWOOT_API_URL) ?? chatwootOriginFromEnv(env.CHATWOOT_URL);
  return {
    activo: interruptorEncendido(env.OFICINA_DESPACHADOR_ACTIVO),
    vaciadoActivo: vaciadoActivo(env),
    agente: AGENTE_SOPORTE,
    runtime: runtimeUrl && runtimeToken ? { url: runtimeUrl, token: runtimeToken } : null,
    chatwoot:
      chatwootToken && webhook.cuenta !== null && webhook.bandejaPrueba !== null
        ? { url: chatwootUrl, token: chatwootToken, cuenta: webhook.cuenta, bandeja: webhook.bandejaPrueba }
        : null,
    topeMensualUsd: numero(env.OFICINA_TOPE_MENSUAL_USD, TOPE_MENSUAL_MAXIMO_USD, 0.000001, TOPE_MENSUAL_MAXIMO_USD),
    umbralAutopausa: UMBRAL_AUTOPAUSA,
    porCorrida: {
      llamadas: Math.trunc(numero(env.OFICINA_TOPE_LLAMADAS_CORRIDA, 2, 1, 2)),
      tokens: Math.trunc(numero(env.OFICINA_TOPE_TOKENS_CORRIDA, 24_000, 1, 200_000)),
      pasos: PASOS_POR_CORRIDA,
      segundos: SEGUNDOS_POR_CORRIDA,
    },
    precios: {
      entradaPorMTok: positivo(env.OFICINA_PRECIO_ENTRADA_USD_MTOK, 1, 1000),
      salidaPorMTok: positivo(env.OFICINA_PRECIO_SALIDA_USD_MTOK, 3.2, 1000),
    },
    pausaEntreCorridasS: PAUSA_ENTRE_CORRIDAS_S,
    tickMs: TICK_MS,
    vigilarPausaMs: 2_000,
  };
}

/** Costo en USD de una llamada, con la tarifa configurada (6 decimales, como task_events.costo_usd). */
export function costoDeLlamada(entrada: number, salida: number, precios: ConfigDespachador["precios"]): number {
  const usd = (entrada * precios.entradaPorMTok + salida * precios.salidaPorMTok) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
