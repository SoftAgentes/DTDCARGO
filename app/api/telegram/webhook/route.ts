/**
 * Telegram Bot webhook · maneja /start {code} para linkear chat_id.
 *
 * Configurado con setWebhook sobre la URL limpia. Telegram envía el valor de
 * `secret_token` en `X-Telegram-Bot-Api-Secret-Token`; el secreto primario no
 * se acepta por query string. Durante el corte existe una compatibilidad
 * explícita y temporal mediante TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET.
 *
 * Updates esperados:
 *   - /start {linkCode}   → matchea `user_profiles.telegram_link_code` (una
 *                           CUENTA) y si no, `telegram_destinations.link_code`
 *                           (un DESTINO de alertas, SDD-0271). Setea chat_id.
 *
 * Otros mensajes se ignoran. No respondemos a comandos no esperados
 * para mantener el bot minimal.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { sendTelegramMessage } from "@/lib/studio/telegram/send-message";

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

const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";
const TELEGRAM_SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

type WebhookAuth = "header" | "legacy-query" | "forbidden" | "unavailable";

function safeSecretEqual(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

function authenticateWebhook(req: Request): WebhookAuth {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || !TELEGRAM_SECRET_PATTERN.test(expectedSecret)) {
    return "unavailable";
  }

  const headerSecret = req.headers.get(TELEGRAM_SECRET_HEADER);
  if (headerSecret !== null) {
    return safeSecretEqual(headerSecret, expectedSecret) ? "header" : "forbidden";
  }

  // Compatibilidad de despliegue únicamente. El secreto primario nunca cae a
  // query; el valor legacy tiene que estar configurado por separado y se borra
  // después de rotar el secreto y confirmar el header en producción.
  const legacySecret = process.env.TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET;
  if (!legacySecret) return "forbidden";

  const providedLegacySecret = new URL(req.url).searchParams.get("secret");
  return safeSecretEqual(providedLegacySecret, legacySecret)
    ? "legacy-query"
    : "forbidden";
}

export async function POST(req: Request) {
  const auth = authenticateWebhook(req);
  if (auth === "unavailable") {
    return NextResponse.json(
      { error: "Webhook unavailable" },
      { status: 503 },
    );
  }
  if (auth === "forbidden") {
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
