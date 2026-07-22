import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { POST as processResendWebhook } from "@/app/api/webhooks/resend/route";

export const runtime = "nodejs";

// Endpoint efímero de validación para SDD-0167. Solo reproduce el evento ya
// entregado; no llama a Resend ni genera un correo nuevo.
const EMAIL_ID = "9b12d206-9fde-4ee3-be30-a44eaeac240c";
const DELIVERED_AT = "2026-07-22T21:57:02.499Z";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) {
    return NextResponse.json(
      { error: "Webhook secret no configurado." },
      { status: 503 },
    );
  }

  const rawBody = JSON.stringify({
    type: "email.delivered",
    created_at: DELIVERED_AT,
    data: { email_id: EMAIL_ID },
  });
  const svixId = `msg_preview_replay_${randomUUID()}`;
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");

  const signedRequest = new NextRequest(
    new URL("/api/webhooks/resend", request.url),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": `v1,${signature}`,
      },
      body: rawBody,
    },
  );
  const response = await processResendWebhook(signedRequest);
  const result = await response.json();

  return NextResponse.json(
    {
      ok: response.ok,
      replayed_email_id: EMAIL_ID,
      delivered_at: DELIVERED_AT,
      result,
    },
    { status: response.status },
  );
}
