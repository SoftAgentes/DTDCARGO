/**
 * POST /api/webhooks/resend
 *
 * Handler de webhooks de Resend (delivery, bounce, complaint, opened, etc).
 * Verifica firma HMAC Svix-style + actualiza mail_logs según el event type.
 * Auto-INSERT en mail_blacklist si bounce / complaint.
 *
 * Setup en el dashboard de Resend:
 *   - Endpoint: https://dtdcargo.com/api/webhooks/resend
 *   - Events: email.sent, email.delivered, email.bounced, email.complained,
 *     email.opened, email.clicked, email.failed, email.delivery_delayed
 *   - Save secret en `RESEND_WEBHOOK_SECRET` env var (formato `whsec_xxx`)
 *
 * Si el secret no está set, el endpoint devuelve 503 (no procesa nada).
 *
 * SDD-0026 Fase 2.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  mailLogStatusFromEvent,
  verifyResendWebhookSignature,
  type ResendWebhookEvent,
} from "@/lib/studio/mail/resend-api";
import { refreshCampaignCounters } from "@/lib/studio/newsletter/sender";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret no configurado · ver runbooks/setup-resend.md" },
      { status: 503 },
    );
  }

  // 1. Leer raw body (necesario para HMAC)
  const rawBody = await request.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Body vacío" }, { status: 400 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Faltan headers svix-* requeridos" },
      { status: 400 },
    );
  }

  // 2. Verificar firma
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

  // 3. Parse event
  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    // No es un evento de email · skip (Resend manda otros tipos eventualmente)
    return NextResponse.json({ ok: true, skipped: "sin email_id" });
  }

  const { status, blacklistReason } = mailLogStatusFromEvent(event.type);

  // 4. Buscar mail_log por resend_message_id
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client no configurado" },
      { status: 500 },
    );
  }

  const { data: log } = await supabaseAdmin
    .from("mail_logs")
    .select("id, tenant_id, to_email, template_id, status, metadata")
    .eq("resend_message_id", emailId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      to_email: string;
      template_id: string | null;
      status: string;
      metadata: Record<string, unknown> | null;
    }>();

  if (!log) {
    // Webhook llegó pero no tenemos record (ej: email enviado fuera del
    // sistema). Aceptamos el webhook pero no actualizamos nada.
    return NextResponse.json({ ok: true, skipped: "log no encontrado" });
  }

  // 5. Update mail_log
  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (status === "sent") update.sent_at = event.created_at;
  if (status === "delivered") update.delivered_at = event.created_at;
  if (status === "bounced") update.bounced_at = event.created_at;
  if (status === "complained") update.complained_at = event.created_at;
  if (status === "opened") update.opened_at = event.created_at;
  if (status === "clicked") update.clicked_at = event.created_at;
  if (event.type === "email.failed") {
    update.error = (event.data?.error as string) ?? "failed (sin detalle)";
  }

  if (Object.keys(update).length > 0) {
    await supabaseAdmin.from("mail_logs").update(update).eq("id", log.id);
  }

  // 6. Increment template metrics si aplica
  if (log.template_id && status && ["opened", "clicked", "bounced"].includes(status)) {
    const field = status === "opened" ? "opened" : status === "clicked" ? "clicked" : "bounced";
    await supabaseAdmin.rpc("mail_increment_template_metrics", {
      p_template_id: log.template_id,
      p_field: field,
      p_amount: 1,
    });
  }

  // 7. Auto-blacklist si bounce / complaint
  if (blacklistReason) {
    await supabaseAdmin
      .from("mail_blacklist")
      .upsert(
        {
          tenant_id: log.tenant_id,
          email: log.to_email,
          reason: blacklistReason,
          notes: `Auto-blacklisted por webhook ${event.type} · ${event.created_at}`,
        },
        { onConflict: "tenant_id,email" },
      );
  }

  // 8. Sincronizar la trazabilidad de campañas de Actualidad. Los IDs viven en
  // metadata del mail_log; los emails enviados fuera del newsletter no entran.
  const campaignId = typeof log.metadata?.newsletter_campaign_id === "string"
    ? log.metadata.newsletter_campaign_id
    : null;
  const recipientId = typeof log.metadata?.newsletter_recipient_id === "string"
    ? log.metadata.newsletter_recipient_id
    : null;
  const subscriberId = typeof log.metadata?.newsletter_subscriber_id === "string"
    ? log.metadata.newsletter_subscriber_id
    : null;
  if (campaignId && recipientId && status) {
    const recipientUpdate: Record<string, unknown> = { status };
    if (status === "sent") recipientUpdate.sent_at = event.created_at;
    if (status === "delivered") recipientUpdate.delivered_at = event.created_at;
    if (status === "opened") recipientUpdate.opened_at = event.created_at;
    if (status === "clicked") recipientUpdate.clicked_at = event.created_at;
    if (status === "bounced") recipientUpdate.bounced_at = event.created_at;
    if (status === "complained") recipientUpdate.complained_at = event.created_at;
    if (status === "failed") recipientUpdate.error = update.error ?? "failed (sin detalle)";
    await supabaseAdmin.from("newsletter_campaign_recipients").update(recipientUpdate)
      .eq("id", recipientId).eq("campaign_id", campaignId).eq("tenant_id", log.tenant_id);
    if (status === "delivered" && subscriberId) {
      await supabaseAdmin.from("newsletter_subscribers").update({ last_delivered_at: event.created_at })
        .eq("id", subscriberId).eq("tenant_id", log.tenant_id);
    }
    await refreshCampaignCounters(supabaseAdmin, campaignId, log.tenant_id);
  }

  return NextResponse.json({
    ok: true,
    event: event.type,
    log_id: log.id,
    status_applied: status,
    blacklisted: !!blacklistReason,
  });
}
