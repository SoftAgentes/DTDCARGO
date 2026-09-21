/**
 * Telegram Bot webhook · maneja /start {code} para linkear chat_id.
 *
 * Configurado al crear el bot: setWebhook con `secret_token`. Telegram manda ese
 * valor en el header `X-Telegram-Bot-Api-Secret-Token` de CADA update, y acá se
 * compara contra TELEGRAM_WEBHOOK_SECRET en tiempo constante.
 *
 * SDD-0499 · antes el secreto viajaba en el query string
 * (`…/api/telegram/webhook?secret=XXX`) con este docblock afirmando que
 * «Telegram no soporta headers custom». Es falso: `setWebhook` acepta
 * `secret_token` (String, 1-256 caracteres, sólo `A-Z a-z 0-9 _ -`) y la API
 * documenta que «the request will contain a header
 * "X-Telegram-Bot-Api-Secret-Token" with the secret token as content»
 * (core.telegram.org/bots/api#setwebhook, leído el 2026-09-21). Un secreto en la
 * URL queda en logs de acceso, en `Referer` y en el historial de cualquier proxy
 * —y `getWebhookInfo` lo devuelve entero a quien tenga el token del bot—, y
 * quien lo tuviera fabricaba updates arbitrarios: este webhook enlaza un chat a
 * cualquier `link_code` vivo y escribe en `user_profiles` y
 * `telegram_destinations` con `createAdminClient()`, que salta la RLS.
 *
 * Telegram no firma el cuerpo: el secreto compartido es toda la autenticación
 * que hay. Por eso importa dónde viaja.
 *
 * Updates esperados:
 *   - /start {linkCode}   → matchea `user_profiles.telegram_link_code` (una
 *                           CUENTA) y si no, `telegram_destinations.link_code`
 *                           (un DESTINO de alertas, SDD-0271). Setea chat_id.
 *
 * Otros mensajes se ignoran. No respondemos a comandos no esperados
 * para mantener el bot minimal.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { sameSecret } from "@/lib/http/secret-compare";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

/** El header en el que Telegram devuelve el `secret_token` de `setWebhook`. */
const SECRET_HEADER = "x-telegram-bot-api-secret-token";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from: { id: number; username?: string; first_name?: string };
  };
};

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Fail-closed: sin la variable definida no pasa nadie (503 antes de comparar).
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET no configurado" },
      { status: 503 },
    );
  }

  // Sólo por header. El query param `?secret=` ya NO se acepta: un update
  // firmado por Telegram siempre trae el header, así que aceptar los dos sería
  // conservar justo el canal que esta spec vino a cerrar.
  if (!sameSecret(req.headers.get(SECRET_HEADER), expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Solo procesamos mensajes /start {code}
  const msg = update.message;
  if (!msg?.text) return NextResponse.json({ ok: true, ignored: "no message" });

  const startMatch = msg.text.match(/^\/start\s+([A-Z0-9]{6,16})\s*$/i);
  if (!startMatch) {
    // Mensaje no comando · ack pero no procesar
    return NextResponse.json({ ok: true, ignored: "not /start" });
  }

  const linkCode = startMatch[1].toUpperCase();
  const chatId = String(msg.chat.id);
  const username = msg.from.username ?? null;

  const admin = createAdminClient();

  // Buscar user con ese link_code · única row (índice unique)
  const { data: profile, error: lookupErr } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("telegram_link_code", linkCode)
    .maybeSingle<{ user_id: string }>();

  if (lookupErr || !profile) {
    // SDD-0271 · el mismo `/start <código>` enlaza también un DESTINO de
    // alertas (Ajustes › Alertas de Telegram), que no cuelga de ningún usuario:
    // es un chat con nombre propio al que se rutean categorías de aviso. Un
    // chat_id no se puede derivar de un número de teléfono — el bot sólo lo
    // aprende cuando esa cuenta le escribe. Este es ese momento.
    const linked = await linkAlertDestination(admin, linkCode, chatId, username);
    if (linked.ok) {
      await sendTelegramMessage(
        chatId,
        `Listo · este chat quedó enlazado como destino de alertas "${linked.label}" de DTD Cargo.`,
      );
      return NextResponse.json({ ok: true, linkedDestination: linked.id });
    }
    if (linked.reason === "duplicate") {
      await sendTelegramMessage(
        chatId,
        "Este chat ya está enlazado como destino de alertas. No hace falta enlazarlo de nuevo.",
      );
      return NextResponse.json({ ok: true, ignored: "destination duplicate" });
    }

    await sendTelegramMessage(
      chatId,
      "Código inválido o expirado. Genera uno nuevo desde Preferencias en DTD Studio.",
    );
    return NextResponse.json({ ok: true, ignored: "code not found" });
  }

  // Setear chat_id + username + clear link_code
  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({
      telegram_chat_id: chatId,
      telegram_username: username,
      telegram_link_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.user_id);

  if (updateErr) {
    await sendTelegramMessage(
      chatId,
      "Hubo un problema al conectar tu cuenta. Reintenta desde DTD Studio.",
    );
    return NextResponse.json(
      { error: `update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  await sendTelegramMessage(
    chatId,
    `Listo · tu cuenta de DTD Studio está conectada a Telegram${
      username ? ` (@${username})` : ""
    }. Vas a recibir avisos de bugs críticos y respuestas a tus reportes.`,
  );

  return NextResponse.json({ ok: true, linked: profile.user_id });
}

/**
 * Enlaza un DESTINO de alertas (`telegram_destinations`, SDD-0271) con el chat
 * que mandó el `/start <código>`. Devuelve `{ok:false, reason}` en vez de tirar:
 * el webhook tiene que responder 200 a Telegram pase lo que pase, o Telegram
 * reintenta el update en bucle.
 *
 * `reason: "duplicate"` = el chat ya es otro destino del mismo tenant (lo frena
 * el índice único `telegram_destinations_chat_uq`). No es un error del usuario y
 * merece un mensaje propio: repetir "código inválido" ahí despistaría.
 */
async function linkAlertDestination(
  admin: ReturnType<typeof createAdminClient>,
  linkCode: string,
  chatId: string,
  username: string | null,
): Promise<
  | { ok: true; id: string; label: string }
  | { ok: false; reason: "not-found" | "duplicate" | "error" }
> {
  const { data: dest } = await admin
    .from("telegram_destinations")
    .select("id, label")
    .eq("link_code", linkCode)
    .maybeSingle<{ id: string; label: string }>();

  if (!dest) return { ok: false, reason: "not-found" };

  const { error } = await admin
    .from("telegram_destinations")
    .update({
      chat_id: chatId,
      telegram_username: username,
      linked_at: new Date().toISOString(),
      link_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dest.id);

  if (error) {
    // 23505 = unique_violation: ese chat ya es otro destino del tenant.
    if (error.code === "23505") return { ok: false, reason: "duplicate" };
    console.error("[telegram-webhook] enlace de destino falló:", error.message);
    return { ok: false, reason: "error" };
  }

  return { ok: true, id: dest.id, label: dest.label };
}

// GET para sanity check del endpoint (útil setWebhook + curl)
export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "Telegram webhook · POST esperado con update body",
  });
}
