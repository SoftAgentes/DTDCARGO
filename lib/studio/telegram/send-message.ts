/**
 * Telegram Bot API · sendMessage helper.
 *
 * Requiere TELEGRAM_BOT_TOKEN env var (formato "1234567:ABC…").
 * Si no está seteado, los sends se loguean y devuelven { ok: false, error }
 * sin romper el flujo del caller (graceful degradation).
 *
 * Doc: https://core.telegram.org/bots/api#sendmessage
 */

const API_BASE = "https://api.telegram.org/bot";

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts: { parseMode?: "MarkdownV2" | "HTML" } = {},
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN no configurado en env",
    };
  }

  if (!chatId.trim()) {
    return { ok: false, error: "chat_id vacío" };
  }
  if (!text.trim()) {
    return { ok: false, error: "text vacío" };
  }
  // Telegram límite hard: 4096 chars
  const truncated = text.length > 4000 ? text.slice(0, 3997) + "…" : text;

  try {
    const res = await fetch(`${API_BASE}${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncated,
        parse_mode: opts.parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };

    if (!data.ok) {
      return {
        ok: false,
        error: data.description ?? `HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      messageId: data.result?.message_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
