/**
 * Telegram Bot API · sendMessage · RETIRADO (SDD-0606).
 *
 * Decisión de Sam (2026-11-06): Telegram se elimina ahora. El Studio deja de
 * mandar cualquier mensaje a Telegram, con o sin `TELEGRAM_BOT_TOKEN` en el
 * servidor. Motivo: el texto que iba por acá llevaba datos de clientes (nombre,
 * teléfono, lo que escribieron en el portal) y la política pública de
 * privacidad (#399) dice que la mensajería interna no los recibe.
 *
 * Todos los envíos del Studio a Telegram pasan por esta función: apagarla acá
 * apaga los avisos por categoría, los avisos por persona, el reintento de bugs,
 * el reporte diario y las respuestas del bot de enlace. Los avisos siguen por
 * Discord (sólo el aviso mínimo), el correo y la campana del Studio.
 *
 * La firma se conserva para que nadie tenga que cambiar: devuelve
 * `{ ok: false }` sin hacer ningún pedido, como hacía antes sin token. Borrar
 * el código y los datos de Telegram es otra spec (SDD-0606, «El corte», paso 9).
 */

export const TELEGRAM_RETIRADO = "Telegram está retirado del Studio (SDD-0606)";

export async function sendTelegramMessage(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma conservada; no se manda nada
  _chatId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ídem
  _text: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ídem
  _opts?: { parseMode?: "MarkdownV2" | "HTML" },
): Promise<{ ok: boolean; error?: string; messageId?: number }> {
  return { ok: false, error: TELEGRAM_RETIRADO };
}
