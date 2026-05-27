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
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  extractVariables,
  validateCreateRuleInput,
  validateUpdateTemplateInput,
  type ActionFieldErrors,
} from "@/lib/studio/mail-types";

export interface MailingActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  message?: string;
}

const INITIAL: MailingActionState = {};

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
  if (!userResp.user) return { error: "Iniciá sesión primero." };

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

function buildSampleVars(
  slug: string,
  variableNames: string[],
): Record<string, string> {
  // Defaults genéricos por nombre de variable
  const defaults: Record<string, string> = {
    customer_name: "María Pérez",
    inviter_name: "Sam Maan",
    tenant_name: "DTD·CARGO",
    role_label: "Admin",
    invitation_link: "https://dtdcargo.com/invitar/SAMPLE_TOKEN_XYZ",
    expires_in_days: "7",
    quote_code: "Q-2026-0042",
    invoice_code: "F-2026-0117",
    shipment_code: "S-2026-0089",
    markbox: "DTD-1234",
    origin: "Yiwu, CN",
    destination: "Caracas, VE",
    service: "Puerta a Puerta DDP",
    cbm: "12.5",
    total_usd: "4,250.00",
    total_ves: "152,000.00",
    bcv_rate: "35.76",
    validity_days: "15",
    issue_date: "2026-05-26",
    due_date: "2026-06-25",
    days_overdue: "5",
    eta: "2026-06-15",
    arrival_date: "2026-06-12",
    customs_eta_days: "3",
    whatsapp_number: "+58 412 166 8021",
    agent_name: "Sam",
    requester_name: "María Pérez",
    requester_email: "maria@example.com",
    reason: "Olvidé mi master password del No-Olvidar.",
    requested_at: "2026-05-26 18:30 UTC",
    expires_at: "2026-05-28 18:30 UTC",
    approvals_required: "2 de 3 admins",
    review_url: "https://dtdcargo.com/studio/no-olvidar/recovery/SAMPLE",
    bug_folio: "BUG-00042",
    bug_title: "Drawer no cierra con ESC",
    bug_state: "Triaje",
    bug_severity: "Crítica",
    notif_type_label: "Bug crítico reportado",
    reporter_name: "María Pérez",
    message_excerpt: "Mensaje de ejemplo del admin sobre tu reporte.",
    bug_url: "https://dtdcargo.com/studio/bugs?focus=sample",
    action_label: "Ver bug",
  };

  const result: Record<string, string> = {};
  for (const v of variableNames) {
    result[v] = defaults[v] ?? `[${v}]`;
  }
  // Slug-specific overrides
  if (slug === "team_invitation") {
    result.inviter_name = result.inviter_name || "Sam Maan";
  }
  return result;
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
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Iniciá sesión primero." };

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
  const { error } = await supabase.from("mail_rules").delete().eq("id", id);

  if (error) {
    if (error.code === "42501") return { error: "Solo admins." };
    return { error: error.message };
  }

  revalidatePath("/studio/mailing");
  return { ok: true, message: "Regla eliminada." };
}

export { INITIAL as INITIAL_MAILING_STATE };
