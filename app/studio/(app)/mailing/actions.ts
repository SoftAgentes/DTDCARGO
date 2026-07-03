"use server";

/**
 * Server actions del módulo /studio/mailing (SDD-0026 Fase 3b + 3c).
 *
 * Cobertura:
 *   - updateMailTemplateAction (Fase 3b)
 *   - createMailRuleAction (Fase 3c)
 *   - updateMailRuleAction (Fase 3c)
 *   - toggleMailRuleActiveAction (Fase 3c)
 *   - deleteMailRuleAction (Fase 3c)
 *   - sendTestEmailAction (Fase 3b · helper · dispara sendEmail con sample data)
 *
 * Solo admin del tenant (RLS valida vía mail_config_by_tenant policies).
 * Inputs validados con validateUpdateTemplateInput / validateCreateRuleInput.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { buildSampleVars } from "@/lib/studio/mail-sample-vars";
import {
  extractVariables,
  validateCreateRuleInput,
  validateScheduleEmailInput,
  validateUpdateTemplateInput,
  validateUpsertSignatureInput,
  type ActionFieldErrors,
  type ScheduledStatus,
} from "@/lib/studio/mail-types";
import type { MailingActionState } from "./_components/mailing-types";

// NOTE: `MailingActionState` + `INITIAL_MAILING_STATE` ahora viven en
// `_components/mailing-types.ts`. Next 16 prohíbe exportar tipos / constantes
// desde un archivo con "use server" — solo funciones async permitidas.

// ─────────────────────────────────────────────────────────────
// Templates · update
// ─────────────────────────────────────────────────────────────

export async function updateMailTemplateAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const partial = {
    id: (formData.get("id") as string | null)?.trim() ?? undefined,
    name: (formData.get("name") as string | null)?.trim() ?? undefined,
    subject: (formData.get("subject") as string | null) ?? undefined,
    body_html: (formData.get("body_html") as string | null) ?? undefined,
    active: formData.get("active") === "on",
  };

  const { input, fieldErrors } = validateUpdateTemplateInput(partial);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.subject !== undefined) updateData.subject = input.subject;
  if (input.body_html !== undefined) updateData.body_html = input.body_html;
  if (input.active !== undefined) updateData.active = input.active;
  // Auto-recalcular variables si cambió subject o body
  if (input.subject !== undefined || input.body_html !== undefined) {
    // Re-fetch current si no vinieron ambos
    if (input.subject === undefined || input.body_html === undefined) {
      const { data: cur } = await supabase
        .from("mail_templates")
        .select("subject, body_html")
        .eq("id", input.id)
        .maybeSingle<{ subject: string; body_html: string }>();
      const subj = input.subject ?? cur?.subject ?? "";
      const body = input.body_html ?? cur?.body_html ?? "";
      updateData.variables = extractVariables(`${subj} ${body}`);
    } else {
      updateData.variables = extractVariables(
        `${input.subject} ${input.body_html}`,
      );
    }
  }

  const { error } = await supabase
    .from("mail_templates")
    .update(updateData)
    .eq("id", input.id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins pueden editar templates." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Template actualizado." };
}

// ─────────────────────────────────────────────────────────────
// Templates · send test
// ─────────────────────────────────────────────────────────────

export async function sendTestTemplateAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const templateId = (formData.get("template_id") as string | null)?.trim();
  if (!templateId) return { error: "Falta template_id." };

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  const { data: template } = await supabase
    .from("mail_templates")
    .select("slug, variables")
    .eq("id", templateId)
    .maybeSingle<{ slug: string; variables: string[] }>();
  if (!template) return { error: "Template no encontrado." };

  // Sample vars genéricas + slug-específicas para los 10 templates conocidos
  const sampleVars = buildSampleVars(template.slug, template.variables ?? []);

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return { error: "Admin client no configurado." };
  }

  const result = await sendEmail(supabaseAdmin, link.tenant_id, {
    templateSlug: template.slug,
    to: userResp.user.email ?? "test@dtdcargo.com",
    vars: sampleVars,
    metadata: { source: "sendTestTemplateAction", template_id: templateId },
  });

  if (!result.ok) return { error: `No se pudo enviar prueba: ${result.error}` };

  revalidatePath("/studio/mailing");
  return {
    ok: true,
    message: result.queued
      ? "Encolado · sin RESEND_API_KEY el envío real no ocurre, pero el log queda."
      : "Email de prueba enviado.",
  };
}

// ─────────────────────────────────────────────────────────────
// Signatures · upsert (Firmas · Norte)
// ─────────────────────────────────────────────────────────────

/**
 * Crea o actualiza la firma de CUALQUIER miembro del tenant (admin-only).
 * Upsert por `user_id`: si ya existe firma de ese usuario en el tenant →
 * UPDATE; si no → INSERT con is_default=true.
 *
 * Escritura tenant-wide (firmas de otros usuarios) → admin client, igual que
 * sendTestTemplateAction. El gating admin lo hace moduleEditDenial.
 */
export async function upsertMailSignatureAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const partial = {
    user_id: (formData.get("user_id") as string | null)?.trim() ?? undefined,
    layout: (formData.get("layout") as string | null) ?? undefined,
    full_name: (formData.get("full_name") as string | null)?.trim() ?? undefined,
    role_label: (formData.get("role_label") as string | null)?.trim() || undefined,
    email: (formData.get("email") as string | null)?.trim() || undefined,
    phone: (formData.get("phone") as string | null)?.trim() || undefined,
    whatsapp: (formData.get("whatsapp") as string | null)?.trim() || undefined,
    photo_url: (formData.get("photo_url") as string | null)?.trim() || undefined,
    company_name:
      (formData.get("company_name") as string | null)?.trim() || undefined,
    lang: (formData.get("lang") as string | null) ?? undefined,
  };

  const { input, fieldErrors } = validateUpsertSignatureInput(
    partial as Parameters<typeof validateUpsertSignatureInput>[0],
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return { error: "Admin client no configurado." };
  }

  const { data: existing } = await supabaseAdmin
    .from("mail_signatures")
    .select("id")
    .eq("tenant_id", link.tenant_id)
    .eq("user_id", input.user_id)
    .maybeSingle<{ id: string }>();

  const row = {
    layout: input.layout,
    full_name: input.full_name,
    role_label: input.role_label ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    photo_url: input.photo_url ?? null,
    company_name: input.company_name ?? "DTD Cargo",
    lang: input.lang,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("mail_signatures")
      .update(row)
      .eq("id", existing.id);
    if (error) return { error: `No se pudo guardar: ${error.message}` };
  } else {
    const { error } = await supabaseAdmin.from("mail_signatures").insert({
      tenant_id: link.tenant_id,
      user_id: input.user_id,
      is_default: true,
      ...row,
    });
    if (error) return { error: `No se pudo crear la firma: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Firma guardada." };
}

// ─────────────────────────────────────────────────────────────
// Rules · create / update / toggle / delete
// ─────────────────────────────────────────────────────────────

export async function createMailRuleAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const partial = {
    event: (formData.get("event") as string | null) ?? undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() ?? undefined,
    recipient_kind: (formData.get("recipient_kind") as string | null) ?? undefined,
    recipient_value:
      (formData.get("recipient_value") as string | null)?.trim() || undefined,
    active: formData.get("active") === "on",
  };

  const { input, fieldErrors } = validateCreateRuleInput(
    partial as Parameters<typeof validateCreateRuleInput>[0],
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  const { error } = await supabase.from("mail_rules").insert({
    tenant_id: link.tenant_id,
    event: input.event,
    template_id: input.template_id,
    recipient_kind: input.recipient_kind,
    recipient_value: input.recipient_value ?? null,
    active: input.active ?? true,
    created_by: userResp.user.id,
  });

  if (error) {
    if (error.code === "42501") return { error: "Solo admins pueden crear reglas." };
    return { error: `No se pudo crear: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Regla creada." };
}

export async function updateMailRuleAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Falta id." };

  const partial = {
    event: (formData.get("event") as string | null) ?? undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() ?? undefined,
    recipient_kind: (formData.get("recipient_kind") as string | null) ?? undefined,
    recipient_value:
      (formData.get("recipient_value") as string | null)?.trim() || undefined,
    active: formData.get("active") === "on",
  };

  const { input, fieldErrors } = validateCreateRuleInput(
    partial as Parameters<typeof validateCreateRuleInput>[0],
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("mail_rules")
    .update({
      event: input.event,
      template_id: input.template_id,
      recipient_kind: input.recipient_kind,
      recipient_value: input.recipient_value ?? null,
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins pueden editar reglas." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Regla actualizada." };
}

export async function toggleMailRuleActiveAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  const active = formData.get("active") === "true";
  if (!id) return { error: "Falta id." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("mail_rules")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true };
}

export async function deleteMailRuleAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Falta id." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { error } = await supabase.from("mail_rules").delete().eq("id", id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Regla eliminada." };
}

// ─────────────────────────────────────────────────────────────
// Config · update mail_config
// ─────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateMailConfigAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const fromEmail = ((formData.get("from_email") as string | null) ?? "").trim();
  const fromName = ((formData.get("from_name") as string | null) ?? "").trim();
  const replyTo = ((formData.get("reply_to") as string | null) ?? "").trim();
  const internalTestEmail = (
    (formData.get("internal_test_email") as string | null) ?? ""
  ).trim();
  const testMode = formData.get("test_mode") === "on";

  const fieldErrors: ActionFieldErrors = {};
  if (!fromEmail || !EMAIL_RE.test(fromEmail)) {
    fieldErrors.from_email = "Email inválido";
  }
  if (!fromName || fromName.length < 2) {
    fieldErrors.from_name = "Nombre requerido (min 2 chars)";
  }
  if (replyTo && !EMAIL_RE.test(replyTo)) {
    fieldErrors.reply_to = "Reply-to inválido";
  }
  if (testMode && (!internalTestEmail || !EMAIL_RE.test(internalTestEmail))) {
    fieldErrors.internal_test_email =
      "Si test_mode está activo, internal_test_email es requerido";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  const { error } = await supabase
    .from("mail_config")
    .update({
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo || null,
      internal_test_email: internalTestEmail || null,
      test_mode: testMode,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", link.tenant_id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins pueden editar config." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return {
    ok: true,
    message: testMode
      ? "Config guardada · test_mode ACTIVO (todos los emails van a internal_test_email)"
      : "Config guardada · test_mode OFF · los emails van a los destinatarios reales",
  };
}

// ─────────────────────────────────────────────────────────────
// Blacklist · add manual / remove
// ─────────────────────────────────────────────────────────────

export async function addMailBlacklistAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  const fieldErrors: ActionFieldErrors = {};
  if (!email || !EMAIL_RE.test(email)) {
    fieldErrors.email = "Email inválido";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  const { error } = await supabase.from("mail_blacklist").insert({
    tenant_id: link.tenant_id,
    email,
    reason: "manual",
    notes,
    added_by: userResp.user.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ese email ya está en la blacklist." };
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: `${email} agregado a la blacklist.` };
}

export async function removeMailBlacklistAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Falta id." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { error } = await supabase.from("mail_blacklist").delete().eq("id", id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Email removido de la blacklist." };
}

// ─────────────────────────────────────────────────────────────
// Scheduled · encolar / enviar ya / cancelar (SDD-0140 Slice D)
// ─────────────────────────────────────────────────────────────

/** Parte "a@x.com, b@y.com" (coma / punto-y-coma / espacios) en lista limpia. */
function parseEmailList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * Encola un correo programado (status='queued'). El cron mail-scheduled lo
 * envía cuando vence, o el admin lo adelanta con "Enviar ya".
 *
 * Firma estándar `(_prev, formData)` → reusable: el Compose (otro slice)
 * arma un FormData y la invoca igual que esta vista.
 */
export async function scheduleEmailAction(
  _prev: MailingActionState,
  formData: FormData,
): Promise<MailingActionState> {
  const attachmentsRaw = (formData.get("attachments_count") as string | null)?.trim();
  const partial = {
    to_email: (formData.get("to_email") as string | null)?.trim() ?? undefined,
    to_name: (formData.get("to_name") as string | null)?.trim() || undefined,
    cc: parseEmailList(formData.get("cc") as string | null),
    bcc: parseEmailList(formData.get("bcc") as string | null),
    subject: (formData.get("subject") as string | null) ?? undefined,
    body_html: (formData.get("body_html") as string | null) ?? undefined,
    scheduled_for: (formData.get("scheduled_for") as string | null)?.trim() ?? undefined,
    channel: (formData.get("channel") as string | null) || undefined,
    template_slug: (formData.get("template_slug") as string | null)?.trim() || undefined,
    signature_user_id:
      (formData.get("signature_user_id") as string | null)?.trim() || undefined,
    attachments_count: attachmentsRaw ? Number(attachmentsRaw) : undefined,
  };

  const { input, fieldErrors } = validateScheduleEmailInput(
    partial as Parameters<typeof validateScheduleEmailInput>[0],
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  const { error } = await supabase.from("mail_scheduled").insert({
    tenant_id: link.tenant_id,
    scheduled_for: input.scheduled_for,
    channel: input.channel ?? "email",
    to_email: input.to_email,
    to_name: input.to_name ?? null,
    cc: input.cc ?? [],
    bcc: input.bcc ?? [],
    subject: input.subject,
    body_html: input.body_html,
    template_slug: input.template_slug ?? null,
    signature_user_id: input.signature_user_id ?? null,
    attachments_count: input.attachments_count ?? 0,
    status: "queued",
    created_by: userResp.user.id,
  });

  if (error) {
    if (error.code === "42501") return { error: "Solo admins pueden programar correos." };
    return { error: `No se pudo programar: ${error.message}` };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Correo programado." };
}

/**
 * Adelanta un programado: lo envía YA vía sendEmail() y lo marca 'sent'.
 * Firma `(formData)` (sin _prev) para <ActionButton>: devuelve `{ error }`
 * si falla, o `{ ok }` si sale bien.
 */
export async function sendScheduledNowAction(
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Falta id." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };

  // Cargar la fila (RLS filtra tenant). Solo se puede enviar si sigue 'queued'.
  const { data: row } = await supabase
    .from("mail_scheduled")
    .select(
      "id, status, to_email, to_name, cc, bcc, subject, body_html, template_slug",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: ScheduledStatus;
      to_email: string;
      to_name: string | null;
      cc: string[];
      bcc: string[];
      subject: string;
      body_html: string;
      template_slug: string | null;
    }>();

  if (!row) return { error: "Programado no encontrado." };
  if (row.status !== "queued") {
    return { error: "Este correo ya no está en cola." };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return { error: "Admin client no configurado." };
  }

  const result = await sendEmail(supabaseAdmin, link.tenant_id, {
    to: row.to_email,
    to_name: row.to_name ?? undefined,
    cc: row.cc,
    bcc: row.bcc,
    subject: row.subject,
    html: row.body_html,
    metadata: { source: "sendScheduledNowAction", scheduled_id: row.id },
  });

  if (!result.ok) {
    await supabaseAdmin
      .from("mail_scheduled")
      .update({ status: "failed", error: result.error })
      .eq("id", row.id);
    revalidatePath("/studio/mailing");
    return { error: `No se pudo enviar: ${result.error}` };
  }

  await supabaseAdmin
    .from("mail_scheduled")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_log_id: result.logId,
      error: null,
    })
    .eq("id", row.id);

  revalidatePath("/studio/mailing");
  return {
    ok: true,
    message: result.queued
      ? "Encolado en el proveedor · sin RESEND_API_KEY el envío real no ocurre, pero el log queda."
      : "Correo enviado.",
  };
}

/**
 * Cancela un programado en cola (status → 'canceled'). Solo aplica a los
 * 'queued' (no se re-cancela un enviado). Firma `(formData)` para
 * <ActionButton> tras confirmar en el <ConfirmDialog>.
 */
export async function cancelScheduledAction(
  formData: FormData,
): Promise<MailingActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Falta id." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "mailing");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("mail_scheduled")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("status", "queued");

  if (error) {
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Programado cancelado." };
}

