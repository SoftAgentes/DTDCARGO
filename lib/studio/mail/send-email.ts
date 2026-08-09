/**
 * Helper genérico para enviar emails desde server actions (SDD-0026 Fase 2).
 *
 * Flujo:
 *   1. Lee mail_config del tenant (test_mode + from_email + blacklist check)
 *   2. Lee template por slug (si templateSlug se provee)
 *   3. Render variables {{var}} con renderTemplate (lib/studio/mail/render-template)
 *   4. Check blacklist (mail_blacklist por tenant + email)
 *   5. Insert mail_log con status='queued'
 *   6. Llama resendSend
 *      - Si OK → update mail_log status='sent' + resend_message_id
 *      - Si error mock_no_key → deja status='queued' + error='no_key' (V1 sin Resend)
 *      - Si error real → update mail_log status='failed' + error
 *   7. Increment metrics_sent del template via RPC
 *
 * NUNCA tira excepción · el caller decide qué hacer con el resultado.
 * El envío es best-effort: si falla, el bug/invitación principal NO se rompe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderTemplate } from "./render-template";
import { resendSend, type ResendSendInput } from "./resend-api";

export type SendEmailInput = {
  /** Slug del template en mail_templates (preferido). */
  templateSlug?: string;
  /** O subject + html crudos (override). */
  subject?: string;
  html?: string;
  /** Destinatario principal. */
  to: string;
  to_name?: string;
  cc?: string[];
  bcc?: string[];
  /** Variables para render {{var}}. */
  vars?: Record<string, string>;
  /** Metadata extra que va al mail_log (no al provider). */
  metadata?: Record<string, unknown>;
  /**
   * Headers extra para el provider (NO van al mail_log). Caso de uso: threading
   * de email entrante (SDD-0056 Fase 2) → `In-Reply-To` / `References` con el
   * Message-ID del email original, para que el cliente vea la respuesta en el
   * mismo hilo de su casilla.
   */
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; logId: string; resendId: string | null; queued: boolean }
  | { ok: false; logId?: string; error: string };

/**
 * @param supabaseAdmin · cliente con service_role (mail_logs INSERT está
 *   bloqueado para authenticated).
 */
export async function sendEmail(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!input.to || !input.to.trim()) {
    return { ok: false, error: "destinatario vacío" };
  }
  const toEmail = input.to.trim().toLowerCase();

  // 1. Read tenant mail_config
  const { data: config } = await supabaseAdmin
    .from("mail_config")
    .select("from_email, from_name, reply_to, test_mode, internal_test_email")
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      from_email: string;
      from_name: string;
      reply_to: string | null;
      test_mode: boolean;
      internal_test_email: string | null;
    }>();

  if (!config) {
    return { ok: false, error: "mail_config no encontrado para el tenant" };
  }

  // Test mode redirige TODO a internal_test_email (no spamear clientes reales)
  const realRecipient =
    config.test_mode && config.internal_test_email
      ? config.internal_test_email
      : toEmail;

  // 2. Read template (si templateSlug)
  let templateId: string | null = null;
  let subject = input.subject ?? "";
  let bodyHtml = input.html ?? "";

  if (input.templateSlug) {
    const { data: template } = await supabaseAdmin
      .from("mail_templates")
      .select("id, subject, body_html, active")
      .eq("tenant_id", tenantId)
      .eq("slug", input.templateSlug)
      .maybeSingle<{
        id: string;
        subject: string;
        body_html: string;
        active: boolean;
      }>();

    if (!template) {
      return {
        ok: false,
        error: `template '${input.templateSlug}' no encontrado · corre 'pnpm seed' para seedear`,
      };
    }
    if (!template.active) {
      return { ok: false, error: `template '${input.templateSlug}' desactivado` };
    }
    templateId = template.id;
    subject = template.subject;
    bodyHtml = template.body_html;
  }

  if (!subject || !bodyHtml) {
    return { ok: false, error: "subject + html requeridos (o templateSlug)" };
  }

  // 3. Render variables
  const vars = input.vars ?? {};
  const renderedSubject = renderTemplate(subject, vars);
  const renderedHtml = renderTemplate(bodyHtml, vars);

  // 4. Check blacklist (real recipient)
  const { data: bl } = await supabaseAdmin
    .from("mail_blacklist")
    .select("id, reason")
    .eq("tenant_id", tenantId)
    .eq("email", realRecipient)
    .maybeSingle<{ id: string; reason: string }>();

  if (bl) {
    return {
      ok: false,
      error: `destinatario en blacklist · razón: ${bl.reason}`,
    };
  }

  // 5. Insert mail_log queued
  const logMetadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    redirected_to_test: config.test_mode ? realRecipient : null,
    original_to: toEmail,
  };

  const { data: log, error: logErr } = await supabaseAdmin
    .from("mail_logs")
    .insert({
      tenant_id: tenantId,
      template_id: templateId,
      template_slug: input.templateSlug ?? null,
      to_email: realRecipient,
      to_name: input.to_name ?? null,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      subject: renderedSubject,
      rendered_variables: vars,
      status: "queued",
      metadata: logMetadata,
    })
    .select("id")
    .single<{ id: string }>();

  if (logErr || !log) {
    return { ok: false, error: `insert mail_log: ${logErr?.message}` };
  }

  // 6. Llamar Resend
  const resendInput: ResendSendInput = {
    from: `${config.from_name} <${config.from_email}>`,
    to: realRecipient,
    subject: renderedSubject,
    html: renderedHtml,
    cc: input.cc,
    bcc: input.bcc,
    reply_to: config.reply_to ?? undefined,
    headers: input.headers && Object.keys(input.headers).length > 0 ? input.headers : undefined,
    tags: [
      { name: "tenant_id", value: tenantId },
      ...(input.templateSlug
        ? [{ name: "template", value: input.templateSlug }]
        : []),
    ],
  };

  const result = await resendSend(resendInput);

  if (result.ok) {
    // 7a. Update log a sent
    await supabaseAdmin
      .from("mail_logs")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_message_id: result.id,
      })
      .eq("id", log.id);

    // 7b. Increment metrics_sent del template
    if (templateId) {
      await supabaseAdmin.rpc("mail_increment_template_metrics", {
        p_template_id: templateId,
        p_field: "sent",
        p_amount: 1,
      });
    }

    return { ok: true, logId: log.id, resendId: result.id, queued: false };
  }

  // 7c. No Resend key configurada (V1 sin envío real).
  //
  //     La fila queda en 'queued' y NADIE la reintenta: `/api/cron/mail-scheduled`
  //     drena `mail_scheduled`, que es otra tabla. Por eso se escribe el motivo:
  //     sin él la fila queda con error=null y es indistinguible de un correo en
  //     vuelo. Así fue como 8 correos —3 de ellos bienvenidas de clientes—
  //     estuvieron meses atascados sin que se pudiera diagnosticar por qué.
  //     `/api/cron/mail-health` los levanta y avisa al equipo.
  if (result.error === "mock_no_key") {
    await supabaseAdmin
      .from("mail_logs")
      .update({ error: "no_key" })
      .eq("id", log.id);
    return {
      ok: true,
      logId: log.id,
      resendId: null,
      // ⚠️ `ok:true` con `queued:true` significa "registrado, NO enviado". Un
      // caller que solo mire `.ok` le va a decir al usuario que su correo salió.
      queued: true,
    };
  }

  // 7d. Error real de Resend
  await supabaseAdmin
    .from("mail_logs")
    .update({
      status: "failed",
      error: result.error,
    })
    .eq("id", log.id);

  return { ok: false, logId: log.id, error: result.error };
}
