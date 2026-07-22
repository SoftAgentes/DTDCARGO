import type { SupabaseClient } from "@supabase/supabase-js";
import { resendBatchSend, type ResendSendInput } from "@/lib/studio/mail/resend-api";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  unsubscribeSecret,
  unsubscribeTokenFingerprint,
} from "@/lib/studio/mail/unsubscribe-token";
import { renderNewsletterEmail } from "./render-email";
import type { NewsletterCampaign, NewsletterCampaignInput } from "./types";

type ClaimedRecipient = {
  id: string;
  subscriber_id: string;
  email: string;
  dispatch_key: string;
  mail_log_id: string | null;
};

type MailConfig = {
  from_email: string;
  from_name: string;
  reply_to: string | null;
  test_mode: boolean;
  internal_test_email: string | null;
};

export type CampaignSendResult =
  | { ok: true; sent: number; remaining: number }
  | { ok: false; error: string };

function campaignInput(campaign: NewsletterCampaign): NewsletterCampaignInput {
  return {
    id: campaign.id,
    internalName: campaign.internal_name,
    subject: campaign.subject,
    previewText: campaign.preview_text,
    heading: campaign.heading,
    bodyText: campaign.body_text,
    ctaLabel: campaign.cta_label ?? "",
    ctaUrl: campaign.cta_url ?? "",
  };
}

type NewsletterSiteEnv = {
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export function resolveNewsletterSiteUrl(env?: NewsletterSiteEnv): string {
  const source = env ?? {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
  // En Preview, el correo debe regresar al deployment que lo generó. Usar el
  // canonical de producción aquí ocultaba errores y ejecutaba la baja en otro
  // entorno. Producción sí conserva NEXT_PUBLIC_SITE_URL como fuente canónica.
  if (source.VERCEL_ENV === "preview" && source.VERCEL_URL) {
    return `https://${source.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }
  return (source.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com").replace(/\/$/, "");
}

function unsubscribeLink(email: string, tenantId: string, secret: string): {
  url: string;
  fingerprint: string;
} {
  const token = signUnsubscribeToken({ email, tenantId, audience: "newsletter" }, secret);
  const siteUrl = resolveNewsletterSiteUrl();
  return {
    url: buildUnsubscribeUrl(siteUrl, token),
    fingerprint: unsubscribeTokenFingerprint(token),
  };
}

async function loadMailConfig(admin: SupabaseClient, tenantId: string): Promise<MailConfig | null> {
  const { data } = await admin
    .from("mail_config")
    .select("from_email, from_name, reply_to, test_mode, internal_test_email")
    .eq("tenant_id", tenantId)
    .maybeSingle<MailConfig>();
  return data;
}

export async function sendNewsletterTest(
  admin: SupabaseClient,
  tenantId: string,
  campaign: NewsletterCampaign,
): Promise<CampaignSendResult> {
  const config = await loadMailConfig(admin, tenantId);
  const secret = unsubscribeSecret();
  if (!config?.internal_test_email) return { ok: false, error: "Configura el correo interno de prueba en Mailing." };
  if (!secret) return { ok: false, error: "No está configurado el secreto de baja." };

  const target = config.internal_test_email.trim().toLowerCase();
  const link = unsubscribeLink(target, tenantId, secret);
  const rendered = renderNewsletterEmail(campaignInput(campaign), link.url);
  const result = await sendEmail(admin, tenantId, {
    to: target,
    subject: `[PRUEBA] ${campaign.subject}`,
    html: rendered.html,
    headers: {
      "List-Unsubscribe": `<${link.url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    metadata: {
      newsletter_campaign_id: campaign.id,
      newsletter_test: true,
      newsletter_unsubscribe_fingerprint: link.fingerprint,
    },
  });
  if (!result.ok) return { ok: false, error: result.error };
  if (result.queued) return { ok: false, error: "RESEND_API_KEY no está configurada; la prueba no salió." };
  return { ok: true, sent: 1, remaining: 0 };
}

export async function sendNewsletterCampaignBatch(
  admin: SupabaseClient,
  tenantId: string,
  campaign: NewsletterCampaign,
  sentBy: string,
): Promise<CampaignSendResult> {
  const config = await loadMailConfig(admin, tenantId);
  if (!config) return { ok: false, error: "No existe configuración de correo para este tenant." };
  if (config.test_mode) {
    return { ok: false, error: "Mailing está en modo prueba. Envía una prueba o desactiva ese modo antes de la campaña real." };
  }
  const secret = unsubscribeSecret();
  if (!secret) return { ok: false, error: "No está configurado el secreto de baja." };

  const { data: claimed, error: claimError } = await admin.rpc("newsletter_claim_campaign_batch", {
    p_campaign_id: campaign.id,
    p_tenant_id: tenantId,
    p_limit: 100,
  });
  if (claimError) return { ok: false, error: `No se pudo reclamar el lote: ${claimError.message}` };
  const claimedRecipients = (claimed ?? []) as ClaimedRecipient[];
  if (claimedRecipients.length === 0) {
    await refreshCampaignCounters(admin, campaign.id, tenantId);
    return { ok: true, sent: 0, remaining: 0 };
  }

  // Revalidación just-in-time: una baja o un rebote posterior a la aprobación
  // siempre gana. Solo se consultan los 100 miembros del lote reclamado.
  const [{ data: active }, { data: blacklisted }] = await Promise.all([
    admin.from("newsletter_subscribers").select("id").in("id", claimedRecipients.map((r) => r.subscriber_id)).eq("status", "subscribed"),
    admin.from("mail_blacklist").select("email").eq("tenant_id", tenantId).in("email", claimedRecipients.map((r) => r.email)),
  ]);
  const activeIds = new Set((active ?? []).map((row) => row.id as string));
  const blockedEmails = new Set((blacklisted ?? []).map((row) => String(row.email).toLowerCase()));
  const skippedIds = claimedRecipients
    .filter((row) => !activeIds.has(row.subscriber_id) || blockedEmails.has(row.email.toLowerCase()))
    .map((row) => row.id);
  if (skippedIds.length > 0) {
    await admin.from("newsletter_campaign_recipients")
      .update({ status: "skipped", error: "Baja o blacklist antes del envío" })
      .in("id", skippedIds).eq("tenant_id", tenantId);
  }
  const skippedSet = new Set(skippedIds);
  const recipients = claimedRecipients.filter((row) => !skippedSet.has(row.id));
  if (recipients.length === 0) {
    const counters = await refreshCampaignCounters(admin, campaign.id, tenantId);
    return { ok: true, sent: 0, remaining: counters.remaining };
  }

  const dispatchKey = claimedRecipients[0].dispatch_key;
  const content = campaignInput(campaign);
  const deliveries = recipients.map((recipient) => ({
    recipient,
    link: unsubscribeLink(recipient.email, tenantId, secret),
  }));
  const deliveryByRecipient = new Map(
    deliveries.map((delivery) => [delivery.recipient.id, delivery]),
  );
  const messages: ResendSendInput[] = deliveries.map(({ recipient, link }) => {
    const rendered = renderNewsletterEmail(content, link.url);
    return {
      from: `${config.from_name} <${config.from_email}>`,
      to: recipient.email,
      subject: campaign.subject,
      html: rendered.html,
      text: rendered.text,
      reply_to: config.reply_to ?? undefined,
      headers: {
        "List-Unsubscribe": `<${link.url}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "campaign", value: campaign.id },
        { name: "recipient", value: recipient.id },
      ],
    };
  });

  const logByRecipient = new Map(
    recipients
      .filter((recipient) => recipient.mail_log_id)
      .map((recipient) => [recipient.id, recipient.mail_log_id as string]),
  );
  const recipientsWithoutLog = recipients.filter((recipient) => !recipient.mail_log_id);
  const logRows = recipientsWithoutLog.map((recipient) => ({
    tenant_id: tenantId,
    sent_by: sentBy,
    template_slug: "newsletter-actualidad",
    to_email: recipient.email,
    subject: campaign.subject,
    status: "queued",
    metadata: {
      newsletter_campaign_id: campaign.id,
      newsletter_recipient_id: recipient.id,
      newsletter_subscriber_id: recipient.subscriber_id,
      dispatch_key: dispatchKey,
      newsletter_unsubscribe_fingerprint:
        deliveryByRecipient.get(recipient.id)?.link.fingerprint ?? null,
    },
  }));
  if (logRows.length > 0) {
    const { data: logs, error: logsError } = await admin
      .from("mail_logs")
      .insert(logRows)
      .select("id, metadata");
    if (logsError) {
      await failRecipients(admin, recipients.map((r) => r.id), `mail_logs: ${logsError.message}`);
      return { ok: false, error: `No se pudo crear la bitácora: ${logsError.message}` };
    }
    for (const row of logs ?? []) {
      const recipientId = String((row.metadata as Record<string, unknown>).newsletter_recipient_id);
      logByRecipient.set(recipientId, String(row.id));
    }
    await Promise.all(recipientsWithoutLog.map((recipient) => {
      const logId = logByRecipient.get(recipient.id) ?? null;
      return admin.from("newsletter_campaign_recipients").update({ mail_log_id: logId })
        .eq("id", recipient.id).eq("tenant_id", tenantId);
    }));
  }

  const result = await resendBatchSend(messages, `newsletter/${campaign.id}/${dispatchKey}`);
  if (!result.ok) {
    const logIds = Array.from(logByRecipient.values());
    const uncertainNetworkResult = result.error.startsWith("network:");
    if (logIds.length) {
      await admin.from("mail_logs").update({
        status: uncertainNetworkResult ? "queued" : "failed",
        error: result.error,
      }).in("id", logIds);
    }
    if (!uncertainNetworkResult) {
      await failRecipients(admin, recipients.map((r) => r.id), result.error);
      await refreshCampaignCounters(admin, campaign.id, tenantId);
    }
    return { ok: false, error: result.error === "mock_no_key" ? "RESEND_API_KEY no está configurada." : result.error };
  }

  const now = new Date().toISOString();
  await Promise.all(recipients.map(async (recipient, index) => {
    const logId = logByRecipient.get(recipient.id) ?? null;
    const resendId = result.ids[index];
    await Promise.all([
      admin.from("newsletter_campaign_recipients").update({
        status: "sent", mail_log_id: logId, resend_message_id: resendId, sent_at: now,
      }).eq("id", recipient.id).eq("tenant_id", tenantId),
      logId
        ? admin.from("mail_logs").update({ status: "sent", resend_message_id: resendId, sent_at: now }).eq("id", logId)
        : Promise.resolve(),
    ]);
  }));

  const counters = await refreshCampaignCounters(admin, campaign.id, tenantId);
  return { ok: true, sent: recipients.length, remaining: counters.remaining };
}

async function failRecipients(admin: SupabaseClient, ids: string[], error: string) {
  if (!ids.length) return;
  await admin.from("newsletter_campaign_recipients").update({ status: "failed", error }).in("id", ids);
}

export async function refreshCampaignCounters(
  admin: SupabaseClient,
  campaignId: string,
  tenantId: string,
): Promise<{ remaining: number }> {
  const { data } = await admin
    .from("newsletter_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);
  const statuses = (data ?? []).map((row) => String(row.status));
  const sent = statuses.filter((s) => ["sent", "delivered", "opened", "clicked"].includes(s)).length;
  const failed = statuses.filter((s) => ["failed", "bounced", "complained"].includes(s)).length;
  const skipped = statuses.filter((s) => s === "skipped").length;
  const remaining = statuses.filter((s) => ["pending", "processing"].includes(s)).length;
  const done = remaining === 0;
  const status = done ? (failed > 0 ? "partial" : "sent") : "sending";
  await admin.from("newsletter_campaigns").update({
    status,
    recipient_count: statuses.length,
    sent_count: sent,
    failed_count: failed,
    skipped_count: skipped,
    completed_at: done ? new Date().toISOString() : null,
  }).eq("id", campaignId).eq("tenant_id", tenantId);
  return { remaining };
}
