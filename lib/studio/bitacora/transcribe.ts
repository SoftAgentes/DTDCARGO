/**
 * lib/studio/bitacora/transcribe.ts · SDD-0146 Fase 3 — audio → texto (Whisper).
 *
 * Transcripción con **Cloudflare Workers AI** (Whisper large-v3-turbo). El founder
 * probó CF porque Groq geo-bloquea Venezuela. Server-only: las 2 env vars
 * (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`) NUNCA llevan `NEXT_PUBLIC_` —
 * el token no viaja al bundle del cliente.
 *
 * Fail-closed: sin las keys, `transcriptionConfigured()` es false y la route
 * responde `apiError` "transcripción no configurada" (pegar texto sigue vivo).
 * NO hay mock de transcripción — esto NO es la capa de IA (extract.ts); si no está
 * configurado, no se inventa un transcript.
 */

import "server-only";

/** Modelo por defecto (override por `CF_WHISPER_MODEL`). */
const DEFAULT_MODEL = "@cf/openai/whisper-large-v3-turbo";

/** Trunca un mensaje de error a `max` chars (no filtrar respuestas enormes de CF). */
function truncate(s: string, max = 200): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** ¿Están las dos env vars de Cloudflare? (fail-closed). */
export function transcriptionConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN,
  );
}

/**
 * Extrae `result.text` de la respuesta de CF Workers AI. Shape real:
 * `{ result: { text, word_count, words, vtt }, success, errors, messages }`.
 */
function extractText(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const result = (json as Record<string, unknown>).result;
  if (result && typeof result === "object") {
    const t = (result as Record<string, unknown>).text;
    if (typeof t === "string") return t;
  }
  return null;
}

/**
 * Transcribe audio (bytes crudos) a texto es-VE. Lanza (mensaje truncado ≤200)
 * si CF falla o no está configurado — la route lo mapea a apiError 502/503.
 *
 * CF recibe el audio como base64 en el body JSON: `{ audio, language, task }`.
 */
export async function transcribeAudio(bytes: ArrayBuffer): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Transcripción no configurada.");
  }

  const model = process.env.CF_WHISPER_MODEL || DEFAULT_MODEL;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const audioBase64 = Buffer.from(bytes).toString("base64");

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: audioBase64,
        language: "es",
        task: "transcribe",
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error de red";
    throw new Error(truncate(`No se pudo contactar Cloudflare: ${msg}`));
  }

  if (!resp.ok) {
    let detail = "";
    try {
      detail = await resp.text();
    } catch {
      /* cuerpo ilegible */
    }
    throw new Error(truncate(`Cloudflare respondió ${resp.status}: ${detail}`));
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    throw new Error("Cloudflare devolvió una respuesta ilegible.");
  }

  const text = extractText(json);
  if (text == null) {
    throw new Error("Cloudflare no devolvió texto de transcripción.");
  }
  return text.trim();
}
