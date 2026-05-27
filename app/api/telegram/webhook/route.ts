/**
 * Telegram Bot webhook · maneja /start {code} para linkear chat_id.
 *
 * Configurado al crear el bot: setWebhook → https://dtdcargo.com/api/telegram/webhook?secret=XXX
 * El secret se pasa por query param (Telegram no soporta headers custom)
 * y se compara contra TELEGRAM_WEBHOOK_SECRET.
 *
 * Updates esperados (MVP):
 *   - /start {linkCode}   → matchea telegram_link_code, setea chat_id
 *
 * Otros mensajes se ignoran. No respondemos a comandos no esperados
 * para mantener el bot minimal.
 */

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

export async function POST(req: Request) {
  // Auth: secret en query string (Telegram setWebhook acepta URL custom)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET no configurado" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== expectedSecret) {
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
    await sendTelegramMessage(
      chatId,
      "Código inválido o expirado. Generá uno nuevo desde Preferencias en DTD Studio.",
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
      "Hubo un problema al conectar tu cuenta. Reintentá desde DTD Studio.",
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

// GET para sanity check del endpoint (útil setWebhook + curl)
export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "Telegram webhook · POST esperado con update body",
  });
}
