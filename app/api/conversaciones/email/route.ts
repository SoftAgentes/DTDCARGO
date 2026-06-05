/**
 * POST /api/conversaciones/email — webhook de Resend Inbound (SDD-0056 · Fase 2).
 *
 * Ingesta de email entrante: un cliente le escribe a la casilla receptora de DTD,
 * Resend nos manda el evento `email.received` (solo metadata) → bajamos el cuerpo
 * por la Received Emails API → lo threadeamos al hilo del cliente en la bandeja
 * Conversaciones. El email aparece solo en `/studio/conversaciones` (sin UI nueva).
 *
 * Handler FINO (sin lógica de negocio): verifica firma Svix → adapter Resend →
 * fetch cuerpo → `ingestInboundEmail`. La resolución cliente/hilo/idempotencia
 * vive en `lib/studio/conversaciones/inbound-email.ts` (provider-agnóstico).
 *
 * Responde 200 rápido en TODOS los casos válidos (ingested/duplicate/unmatched/
 * ambiguous) para que Resend no reintente en loop. Solo devuelve != 200 cuando el
 * webhook está mal configurado (sin secret) o la firma es inválida.
 *
 * Setup en el dashboard de Resend (ver docs/runbooks/setup-resend-inbound.md):
 *   - MX en un subdominio receptor (NO pisar el MX de envío).
 *   - Endpoint: {SITE_URL}/api/conversaciones/email · Event: email.received
 *   - Save secret en `RESEND_INBOUND_WEBHOOK_SECRET` (formato whsec_xxx).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import {
  resendGetReceivedEmail,
  verifyResendWebhookSignature,
} from "@/lib/studio/mail/resend-api";
import {
  inboundEmailIdOf,
  isInboundEmailEvent,
  mapResendInboundToCore,
  type ResendInboundWebhookEvent,
  type ResendReceivedEmail,
} from "@/lib/studio/conversaciones/resend-inbound-adapter";
import { ingestInboundEmail } from "@/lib/studio/conversaciones/inbound-email";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Secret dedicado del webhook inbound (separado del de delivery/bounce para no
  // acoplar los dos endpoints; pueden compartir valor en el dashboard si querés).
  const secret =
    process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook inbound no configurado · ver runbooks/setup-resend-inbound.md" },
      { status: 503 },
    );
  }

  // 1. Raw body (necesario para el HMAC) + headers Svix.
  const rawBody = await request.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Body vacío" }, { status: 400 });
  }
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Faltan headers svix-* requeridos" }, { status: 400 });
  }

  // 2. Verificar firma (mismo verificador que el webhook de delivery).
  const valid = await verifyResendWebhookSignature({
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    secret,
  });
  if (!valid) {
    return NextResponse.json(
      { error: "Firma inválida o timestamp fuera de tolerancia (±5min)" },
      { status: 401 },
    );
  }

  // 3. Parsear el evento.
  let event: ResendInboundWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendInboundWebhookEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // No es un email entrante (otro tipo de evento) → 200 y skip.
  if (!isInboundEmailEvent(event)) {
    return NextResponse.json({ ok: true, skipped: "no es email.received" });
  }
  const emailId = inboundEmailIdOf(event);
  if (!emailId) {
    return NextResponse.json({ ok: true, skipped: "sin email_id" });
  }

  // 4. Bajar el cuerpo por la Received Emails API (el webhook solo trae metadata).
  const fetched = await resendGetReceivedEmail<ResendReceivedEmail>(emailId);
  if (!fetched.ok) {
    if (fetched.error === "mock_no_key") {
      // Sin RESEND_API_KEY (local/CI): aceptamos el webhook pero no podemos bajar
      // el cuerpo. 200 para no reintentar; queda logueado.
      return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY no configurada" });
    }
    // Error real al traer el cuerpo: 502 (que Resend reintente).
    return apiError(
      "No se pudo bajar el cuerpo del email recibido",
      fetched.error,
      502,
      "conversaciones-inbound",
    );
  }

  // 5. Mapear (webhook + cuerpo) → input del core.
  const input = mapResendInboundToCore({ event, email: fetched.data });
  if (!input) {
    return NextResponse.json({ ok: true, skipped: "payload sin from/body utilizable" });
  }

  // 6. Ingestar. 200 en todos los desenlaces válidos (no reintentar).
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return apiError("Admin client no configurado", err, 500, "conversaciones-inbound");
  }

  const result = await ingestInboundEmail(admin, input);

  switch (result.status) {
    case "ingested":
      return NextResponse.json({
        ok: true,
        status: "ingested",
        conversation_id: result.conversationId,
      });
    case "duplicate":
      return NextResponse.json({ ok: true, status: "duplicate" });
    case "unmatched":
      // Remitente desconocido: no creamos hilo (decisión Fase 2). Dead-letter/log.
      console.warn(
        `[conversaciones-inbound] unmatched from=${input.fromEmail} email_id=${emailId}`,
      );
      return NextResponse.json({ ok: true, status: "unmatched" });
    case "ambiguous":
      console.warn(
        `[conversaciones-inbound] ambiguous from=${input.fromEmail} matches=${result.matches}`,
      );
      return NextResponse.json({ ok: true, status: "ambiguous" });
    case "error":
    default:
      return apiError(
        "No se pudo ingestar el email entrante",
        result.status === "error" ? result.error : "desconocido",
        500,
        "conversaciones-inbound",
      );
  }
}
