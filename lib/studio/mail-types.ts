/**
 * Types, enums, validators y helpers de label/badge para Mailing &
 * Notificaciones (SDD-0026 Fase 1). Match con migración 0018_mailing.sql.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validate*Input() propios.
 *   - LABELS en castellano-VE.
 *   - badgeTone helpers retornan los 6 tonos oficiales del sistema.
 */

// ─── Enums ───────────────────────────────────────────────────

export type MailChannel = "email" | "whatsapp";
export const MAIL_CHANNELS: MailChannel[] = ["email", "whatsapp"];

export type MailCategory =
  | "operativo"
  | "comercial"
  | "cobranza"
  | "cliente"
  | "interno"
  | "sistema";

export const MAIL_CATEGORIES: MailCategory[] = [
  "operativo",
  "comercial",
  "cobranza",
  "cliente",
  "interno",
  "sistema",
];

export type MailLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked"
  | "failed";

export const MAIL_LOG_STATUSES: MailLogStatus[] = [
  "queued",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "failed",
];

export type MailRuleEvent =
  | "shipment_created"
  | "shipment_arrived"
  | "shipment_consolidated_cn"
  | "quote_sent"
  | "quote_accepted"
  | "invoice_emitted"
  | "invoice_overdue"
  | "no_olvidar_recovery_requested"
  | "agent_run_failed"
  | "lead_dormant_reengagement";

export const MAIL_RULE_EVENTS: MailRuleEvent[] = [
  "shipment_created",
  "shipment_arrived",
  "shipment_consolidated_cn",
  "quote_sent",
  "quote_accepted",
  "invoice_emitted",
  "invoice_overdue",
  "no_olvidar_recovery_requested",
  "agent_run_failed",
  "lead_dormant_reengagement",
];

export type MailSignatureLayout =
  | "minimal"
  | "card"
  | "corporate"
  | "inline"
  | "image_only";

export const MAIL_SIGNATURE_LAYOUTS: MailSignatureLayout[] = [
  "minimal",
  "card",
  "corporate",
  "inline",
  "image_only",
];

/** Idioma por defecto de la firma (columna `lang`, migr 0206). */
export type MailSignatureLang = "es" | "en" | "zh";

export const MAIL_SIGNATURE_LANGS: MailSignatureLang[] = ["es", "en", "zh"];

export type MailRecipientKind = "client" | "internal" | "custom";

// ─── Entity types (match schema 0018) ────────────────────────

export interface MailTemplate {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  category: MailCategory;
  channel: MailChannel;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  lang: string;
  active: boolean;
  metrics_sent: number;
  metrics_opened: number;
  metrics_clicked: number;
  metrics_bounced: number;
  test_recipient: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MailSignature {
  id: string;
  tenant_id: string;
  user_id: string;
  layout: MailSignatureLayout;
  full_name: string;
  role_label: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  photo_url: string | null;
  company_name: string;
  show_offices_link: boolean;
  custom_html: string | null;
  is_default: boolean;
  lang: MailSignatureLang;
  created_at: string;
  updated_at: string;
}

export interface MailLog {
  id: string;
  tenant_id: string;
  template_id: string | null;
  template_slug: string | null;
  sent_by: string | null;
  to_email: string;
  to_name: string | null;
  cc: string[];
  bcc: string[];
  subject: string;
  rendered_variables: Record<string, unknown>;
  status: MailLogStatus;
  resend_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MailRule {
  id: string;
  tenant_id: string;
  event: MailRuleEvent;
  template_id: string;
  recipient_kind: MailRecipientKind;
  recipient_value: string | null;
  active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailRuleWithTemplate extends MailRule {
  template: Pick<MailTemplate, "id" | "slug" | "name" | "channel" | "category">;
}

export interface MailConfig {
  tenant_id: string;
  provider: "resend";
  from_email: string;
  from_name: string;
  reply_to: string | null;
  daily_limit: number;
  rate_per_minute: number;
  domain_verified: boolean;
  domain_verification_token: string | null;
  test_mode: boolean;
  internal_test_email: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface MailBlacklistEntry {
  id: string;
  tenant_id: string;
  email: string;
  reason: "bounce" | "complaint" | "manual" | "unsubscribe";
  added_by: string | null;
  added_at: string;
  notes: string | null;
}

// ─── Scheduled (SDD-0143 Slice D · Programados) ──────────────

export type ScheduledStatus = "queued" | "sent" | "canceled" | "failed";

export const SCHEDULED_STATUSES: ScheduledStatus[] = [
  "queued",
  "sent",
  "canceled",
  "failed",
];

/** Fila de la cola de programados (match schema 0207_mail_scheduled.sql). */
export interface MailScheduled {
  id: string;
  tenant_id: string;
  scheduled_for: string;
  channel: MailChannel;
  to_email: string;
  to_name: string | null;
  cc: string[];
  bcc: string[];
  subject: string;
  body_html: string;
  template_slug: string | null;
  signature_user_id: string | null;
  status: ScheduledStatus;
  attachments_count: number;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  sent_log_id: string | null;
  error: string | null;
}

export const SCHEDULED_STATUS_LABELS: Record<ScheduledStatus, string> = {
  queued: "En cola",
  sent: "Enviado",
  canceled: "Cancelado",
  failed: "Falló",
};

export function scheduledStatusLabel(s: ScheduledStatus): string {
  return SCHEDULED_STATUS_LABELS[s];
}

export function scheduledStatusBadgeTone(s: ScheduledStatus): BadgeTone {
  if (s === "sent") return "success";
  if (s === "failed") return "danger";
  if (s === "canceled") return "neutral";
  return "wine"; // queued · acento de marca (match Norte mailing-scheduled.jsx)
}

// ─── KPIs (computed) ─────────────────────────────────────────

export interface MailKpis {
  sent30d: number;
  openRate: number;          // 0–100
  bounceRate: number;        // 0–100
  queuedNow: number;
}

// ─── Inputs + Action states ──────────────────────────────────

export interface CreateTemplateInput {
  slug?: string;             // derivable de name si no se provee
  name: string;
  category: MailCategory;
  channel: MailChannel;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: string[];      // auto-extraído si no se provee
  lang?: string;
  active?: boolean;
  test_recipient?: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

export interface SendEmailInput {
  templateSlug?: string;
  templateId?: string;
  to: string;
  to_name?: string;
  cc?: string[];
  bcc?: string[];
  vars?: Record<string, unknown>;
  /** Si templateSlug/Id no se provee, subject + html son obligatorios. */
  subject?: string;
  html?: string;
  text?: string;
  /** Adjuntar la firma default del user logueado al final del body. */
  attachSignature?: boolean;
  idempotencyKey?: string;
}

/**
 * Input para encolar un correo programado (SDD-0143 Slice D). Lo usa
 * scheduleEmailAction (y el Compose de otro slice, que la invoca). El body
 * ya viene renderizado (subject + body_html crudos, no templateSlug al vuelo).
 */
export interface ScheduleEmailInput {
  to_email: string;
  to_name?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html: string;
  /** ISO 8601. Debe ser futura. */
  scheduled_for: string;
  channel?: MailChannel;
  template_slug?: string;
  signature_user_id?: string;
  attachments_count?: number;
}

/**
 * Input del Envío manual (Compose · SDD-0143 Slice C). Lo usa
 * sendManualEmailAction. A diferencia de ScheduleEmailInput, el envío es
 * inmediato (no lleva `scheduled_for`). El body ya viene crudo desde el
 * textarea; la firma se adjunta en la action, no acá.
 */
export interface SendManualInput {
  to: string;
  to_name?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_html: string;
  channel: MailChannel;
  template_slug?: string;
  signature_user_id?: string;
}

export interface CreateSignatureInput {
  layout: MailSignatureLayout;
  full_name: string;
  role_label?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  avatar_url?: string;
  photo_url?: string;
  company_name?: string;
  show_offices_link?: boolean;
  custom_html?: string;
  is_default?: boolean;
}

/**
 * Input del editor de firmas del Norte (Mailing → Firmas). Admin edita la
 * firma de CUALQUIER miembro del tenant, por eso `user_id` es explícito
 * (no se resuelve del auth.uid como en CreateSignatureInput).
 */
export interface UpsertSignatureInput {
  user_id: string;
  layout: MailSignatureLayout;
  full_name: string;
  role_label?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  photo_url?: string;
  company_name?: string;
  lang: MailSignatureLang;
}

export interface CreateRuleInput {
  event: MailRuleEvent;
  template_id: string;
  recipient_kind: MailRecipientKind;
  recipient_value?: string;
  active?: boolean;
}

export interface UpdateConfigInput {
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  daily_limit?: number;
  rate_per_minute?: number;
  test_mode?: boolean;
  internal_test_email?: string;
}

export type ActionFieldErrors = Partial<Record<string, string>>;

export interface MailActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  templateId?: string;
  signatureId?: string;
  ruleId?: string;
  logId?: string;
}

// ─── Validators (sin Zod) ────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z][a-z0-9_]*$/;

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

/** Convierte "Estimado enviado" → "estimado_enviado". */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Extrae variables `{{var_name}}` de un string. */
export function extractVariables(text: string): string[] {
  const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1].toLowerCase());
  }
  return Array.from(set).sort();
}

export function validateCreateTemplateInput(
  partial: Partial<CreateTemplateInput>,
): { input?: CreateTemplateInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.name || partial.name.trim().length < 2) {
    fieldErrors.name = "Nombre requerido (min 2 caracteres)";
  }
  if (!partial.category || !MAIL_CATEGORIES.includes(partial.category as MailCategory)) {
    fieldErrors.category = "Categoría inválida";
  }
  if (!partial.channel || !MAIL_CHANNELS.includes(partial.channel as MailChannel)) {
    fieldErrors.channel = "Canal inválido";
  }
  if (!partial.subject || partial.subject.trim().length < 1) {
    fieldErrors.subject = "Subject requerido";
  }
  if (!partial.body_html || partial.body_html.trim().length < 10) {
    fieldErrors.body_html = "El cuerpo HTML está muy corto (min 10 chars)";
  }

  const slug = partial.slug?.trim() || (partial.name ? slugFromName(partial.name) : "");
  if (!SLUG_RE.test(slug)) {
    fieldErrors.slug = "Slug inválido (solo a-z, 0-9, _; debe empezar con letra)";
  }

  if (partial.test_recipient && !isValidEmail(partial.test_recipient)) {
    fieldErrors.test_recipient = "Email inválido";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const variables = partial.variables ?? extractVariables(
    `${partial.subject ?? ""} ${partial.body_html ?? ""}`,
  );

  return {
    input: {
      slug,
      name: partial.name!.trim(),
      category: partial.category as MailCategory,
      channel: partial.channel as MailChannel,
      subject: partial.subject!.trim(),
      body_html: partial.body_html!,
      body_text: partial.body_text,
      variables,
      lang: partial.lang ?? "es",
      active: partial.active ?? true,
      test_recipient: partial.test_recipient?.trim() || undefined,
    },
  };
}

export function validateUpdateTemplateInput(
  partial: Partial<UpdateTemplateInput>,
): { input?: UpdateTemplateInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.id) fieldErrors.id = "Falta id";

  if (partial.name !== undefined && partial.name.trim().length < 2) {
    fieldErrors.name = "Nombre min 2 caracteres";
  }
  if (
    partial.category !== undefined &&
    !MAIL_CATEGORIES.includes(partial.category as MailCategory)
  ) {
    fieldErrors.category = "Categoría inválida";
  }
  if (
    partial.channel !== undefined &&
    !MAIL_CHANNELS.includes(partial.channel as MailChannel)
  ) {
    fieldErrors.channel = "Canal inválido";
  }
  if (partial.subject !== undefined && partial.subject.trim().length < 1) {
    fieldErrors.subject = "Subject vacío";
  }
  if (partial.body_html !== undefined && partial.body_html.trim().length < 10) {
    fieldErrors.body_html = "Body HTML muy corto";
  }
  if (partial.test_recipient && !isValidEmail(partial.test_recipient)) {
    fieldErrors.test_recipient = "Email inválido";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Re-extract variables si hubo cambio de subject o body
  let variables = partial.variables;
  if (variables === undefined && (partial.subject !== undefined || partial.body_html !== undefined)) {
    variables = extractVariables(
      `${partial.subject ?? ""} ${partial.body_html ?? ""}`,
    );
  }

  return { input: { ...partial, variables } as UpdateTemplateInput };
}

export function validateSendEmailInput(
  partial: Partial<SendEmailInput>,
): { input?: SendEmailInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.to || !isValidEmail(partial.to)) {
    fieldErrors.to = "Destinatario inválido";
  }

  // Necesita o templateSlug/Id, o subject+html
  const hasTemplate = partial.templateSlug || partial.templateId;
  const hasManual = partial.subject && partial.html;
  if (!hasTemplate && !hasManual) {
    fieldErrors.template = "Especificá templateSlug/Id o subject+html";
  }

  if (partial.cc) {
    const bad = partial.cc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.cc = `Email inválido en CC: ${bad}`;
  }
  if (partial.bcc) {
    const bad = partial.bcc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.bcc = `Email inválido en BCC: ${bad}`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: partial as SendEmailInput };
}

export function validateScheduleEmailInput(
  partial: Partial<ScheduleEmailInput>,
): { input?: ScheduleEmailInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.to_email || !isValidEmail(partial.to_email)) {
    fieldErrors.to_email = "Destinatario inválido";
  }
  if (!partial.subject || partial.subject.trim().length < 1) {
    fieldErrors.subject = "Subject requerido";
  }
  if (!partial.body_html || partial.body_html.trim().length < 1) {
    fieldErrors.body_html = "El cuerpo no puede estar vacío";
  }

  // scheduled_for: fecha válida y futura
  let whenIso = "";
  if (!partial.scheduled_for) {
    fieldErrors.scheduled_for = "Fecha/hora requerida";
  } else {
    const when = new Date(partial.scheduled_for);
    if (Number.isNaN(when.getTime())) {
      fieldErrors.scheduled_for = "Fecha/hora inválida";
    } else if (when.getTime() <= Date.now()) {
      fieldErrors.scheduled_for = "La fecha/hora debe ser futura";
    } else {
      whenIso = when.toISOString();
    }
  }

  if (partial.channel && !MAIL_CHANNELS.includes(partial.channel)) {
    fieldErrors.channel = "Canal inválido";
  }
  if (partial.cc) {
    const bad = partial.cc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.cc = `Email inválido en CC: ${bad}`;
  }
  if (partial.bcc) {
    const bad = partial.bcc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.bcc = `Email inválido en BCC: ${bad}`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      to_email: partial.to_email!.trim().toLowerCase(),
      to_name: partial.to_name?.trim() || undefined,
      cc: partial.cc,
      bcc: partial.bcc,
      subject: partial.subject!.trim(),
      body_html: partial.body_html!,
      scheduled_for: whenIso,
      channel: partial.channel ?? "email",
      template_slug: partial.template_slug?.trim() || undefined,
      signature_user_id: partial.signature_user_id?.trim() || undefined,
      attachments_count:
        typeof partial.attachments_count === "number" &&
        Number.isFinite(partial.attachments_count) &&
        partial.attachments_count > 0
          ? Math.floor(partial.attachments_count)
          : 0,
    },
  };
}

export function validateSendManualInput(
  partial: Partial<SendManualInput>,
): { input?: SendManualInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};

  if (!partial.to || !isValidEmail(partial.to)) {
    fieldErrors.to = "Destinatario inválido";
  }
  if (!partial.subject || partial.subject.trim().length < 1) {
    fieldErrors.subject = "El asunto es requerido";
  }
  if (!partial.body_html || partial.body_html.trim().length < 1) {
    fieldErrors.body_html = "El cuerpo no puede estar vacío";
  }
  if (partial.channel && !MAIL_CHANNELS.includes(partial.channel)) {
    fieldErrors.channel = "Canal inválido";
  }
  if (partial.cc) {
    const bad = partial.cc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.cc = `Email inválido en CC: ${bad}`;
  }
  if (partial.bcc) {
    const bad = partial.bcc.find((e) => !isValidEmail(e));
    if (bad) fieldErrors.bcc = `Email inválido en BCC: ${bad}`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      to: partial.to!.trim().toLowerCase(),
      to_name: partial.to_name?.trim() || undefined,
      cc: partial.cc,
      bcc: partial.bcc,
      subject: partial.subject!.trim(),
      body_html: partial.body_html!,
      channel: partial.channel ?? "email",
      template_slug: partial.template_slug?.trim() || undefined,
      signature_user_id: partial.signature_user_id?.trim() || undefined,
    },
  };
}

export function validateCreateSignatureInput(
  partial: Partial<CreateSignatureInput>,
): { input?: CreateSignatureInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.layout || !MAIL_SIGNATURE_LAYOUTS.includes(partial.layout as MailSignatureLayout)) {
    fieldErrors.layout = "Layout inválido";
  }
  if (!partial.full_name || partial.full_name.trim().length < 2) {
    fieldErrors.full_name = "Nombre completo requerido";
  }
  if (partial.email && !isValidEmail(partial.email)) {
    fieldErrors.email = "Email inválido";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      layout: partial.layout as MailSignatureLayout,
      full_name: partial.full_name!.trim(),
      role_label: partial.role_label?.trim() || undefined,
      phone: partial.phone?.trim() || undefined,
      email: partial.email?.trim() || undefined,
      whatsapp: partial.whatsapp?.trim() || undefined,
      avatar_url: partial.avatar_url?.trim() || undefined,
      photo_url: partial.photo_url?.trim() || undefined,
      company_name: partial.company_name?.trim() || "DTD Cargo",
      show_offices_link: partial.show_offices_link ?? true,
      custom_html: partial.custom_html,
      is_default: partial.is_default ?? true,
    },
  };
}

export function validateUpsertSignatureInput(
  partial: Partial<UpsertSignatureInput>,
): { input?: UpsertSignatureInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.user_id || partial.user_id.trim().length < 1) {
    fieldErrors.user_id = "Falta el miembro del equipo";
  }
  if (
    !partial.layout ||
    !MAIL_SIGNATURE_LAYOUTS.includes(partial.layout as MailSignatureLayout)
  ) {
    fieldErrors.layout = "Layout inválido";
  }
  if (!partial.full_name || partial.full_name.trim().length < 2) {
    fieldErrors.full_name = "Nombre requerido (min 2 caracteres)";
  }
  if (partial.email && !isValidEmail(partial.email)) {
    fieldErrors.email = "Email inválido";
  }
  if (
    !partial.lang ||
    !MAIL_SIGNATURE_LANGS.includes(partial.lang as MailSignatureLang)
  ) {
    fieldErrors.lang = "Idioma inválido";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      user_id: partial.user_id!.trim(),
      layout: partial.layout as MailSignatureLayout,
      full_name: partial.full_name!.trim(),
      role_label: partial.role_label?.trim() || undefined,
      email: partial.email?.trim() || undefined,
      phone: partial.phone?.trim() || undefined,
      whatsapp: partial.whatsapp?.trim() || undefined,
      photo_url: partial.photo_url?.trim() || undefined,
      company_name: partial.company_name?.trim() || "DTD Cargo",
      lang: partial.lang as MailSignatureLang,
    },
  };
}

export function validateCreateRuleInput(
  partial: Partial<CreateRuleInput>,
): { input?: CreateRuleInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (!partial.event || !MAIL_RULE_EVENTS.includes(partial.event as MailRuleEvent)) {
    fieldErrors.event = "Evento inválido";
  }
  if (!partial.template_id) fieldErrors.template_id = "Template requerido";
  if (!partial.recipient_kind || !["client", "internal", "custom"].includes(partial.recipient_kind)) {
    fieldErrors.recipient_kind = "Destinatario inválido";
  }
  if (partial.recipient_kind === "custom") {
    if (!partial.recipient_value || !isValidEmail(partial.recipient_value)) {
      fieldErrors.recipient_value = "Email custom inválido";
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    input: {
      event: partial.event as MailRuleEvent,
      template_id: partial.template_id!,
      recipient_kind: partial.recipient_kind as MailRecipientKind,
      recipient_value:
        partial.recipient_kind === "custom" ? partial.recipient_value : undefined,
      active: partial.active ?? true,
    },
  };
}

export function validateUpdateConfigInput(
  partial: Partial<UpdateConfigInput>,
): { input?: UpdateConfigInput; fieldErrors?: ActionFieldErrors } {
  const fieldErrors: ActionFieldErrors = {};
  if (partial.from_email !== undefined && !isValidEmail(partial.from_email)) {
    fieldErrors.from_email = "Email inválido";
  }
  if (partial.reply_to && !isValidEmail(partial.reply_to)) {
    fieldErrors.reply_to = "Email inválido";
  }
  if (partial.internal_test_email && !isValidEmail(partial.internal_test_email)) {
    fieldErrors.internal_test_email = "Email inválido";
  }
  if (
    partial.daily_limit !== undefined &&
    (!Number.isFinite(partial.daily_limit) || partial.daily_limit < 1)
  ) {
    fieldErrors.daily_limit = "Límite diario debe ser ≥ 1";
  }
  if (
    partial.rate_per_minute !== undefined &&
    (!Number.isFinite(partial.rate_per_minute) || partial.rate_per_minute < 1)
  ) {
    fieldErrors.rate_per_minute = "Rate debe ser ≥ 1";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: partial as UpdateConfigInput };
}

// ─── Label helpers (castellano-VE) ───────────────────────────

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  operativo: "Operativo",
  comercial: "Comercial",
  cobranza: "Cobranza",
  cliente: "Cliente",
  interno: "Interno",
  sistema: "Sistema",
};

export function categoryLabel(c: MailCategory): string {
  return CATEGORY_LABELS[c];
}

export const CHANNEL_LABELS: Record<MailChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

export function channelLabel(c: MailChannel): string {
  return CHANNEL_LABELS[c];
}

export const LOG_STATUS_LABELS: Record<MailLogStatus, string> = {
  queued: "En cola",
  sent: "Enviado",
  delivered: "Entregado",
  bounced: "Rebotó",
  complained: "Reportado spam",
  opened: "Abierto",
  clicked: "Clic",
  failed: "Fallido",
};

export function logStatusLabel(s: MailLogStatus): string {
  return LOG_STATUS_LABELS[s];
}

export const RULE_EVENT_LABELS: Record<MailRuleEvent, string> = {
  shipment_created: "Embarque creado",
  shipment_arrived: "Embarque arribado",
  shipment_consolidated_cn: "Contenedor consolidado (CN)",
  quote_sent: "Estimado enviado",
  quote_accepted: "Estimado aceptado",
  invoice_emitted: "Factura emitida",
  invoice_overdue: "Factura vencida",
  no_olvidar_recovery_requested: "Recovery del No-Olvidar",
  agent_run_failed: "Run de agente falló",
  lead_dormant_reengagement: "Prospecto inactivo · reenganche",
};

export function ruleEventLabel(e: MailRuleEvent): string {
  return RULE_EVENT_LABELS[e];
}

export const SIGNATURE_LAYOUT_LABELS: Record<MailSignatureLayout, string> = {
  minimal: "Minimal — 1 línea texto",
  card: "Card — foto + datos básicos",
  corporate: "Corporate — logo + datos completos + oficinas",
  inline: "Inline — avatar + datos en línea",
  image_only: "Image only — banner sin texto",
};

export function signatureLayoutLabel(l: MailSignatureLayout): string {
  return SIGNATURE_LAYOUT_LABELS[l];
}

export const SIGNATURE_LANG_LABELS: Record<MailSignatureLang, string> = {
  es: "Español",
  en: "English",
  zh: "中文",
};

export function signatureLangLabel(l: MailSignatureLang): string {
  return SIGNATURE_LANG_LABELS[l];
}

// ─── Badge tone helpers (6 tonos oficiales) ──────────────────

export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export function categoryBadgeTone(c: MailCategory): BadgeTone {
  if (c === "cobranza") return "danger";
  if (c === "comercial") return "wine";
  if (c === "operativo") return "info";
  if (c === "cliente") return "success";
  if (c === "sistema") return "neutral";
  return "neutral";
}

export function channelBadgeTone(c: MailChannel): BadgeTone {
  return c === "whatsapp" ? "success" : "info";
}

export function logStatusBadgeTone(s: MailLogStatus): BadgeTone {
  if (s === "delivered" || s === "opened" || s === "clicked") return "success";
  if (s === "sent") return "info";
  if (s === "queued") return "neutral";
  if (s === "bounced" || s === "failed") return "danger";
  if (s === "complained") return "warning";
  return "neutral";
}

export function ruleEventBadgeTone(e: MailRuleEvent): BadgeTone {
  if (e === "invoice_overdue" || e === "agent_run_failed") return "danger";
  if (e === "invoice_emitted" || e === "no_olvidar_recovery_requested") return "warning";
  if (e === "quote_accepted" || e === "shipment_arrived") return "success";
  return "info";
}

// ─── Formatters / helpers ────────────────────────────────────

/** "Enviado hace 3m" / "hace 2h" / "12 may 14:30" si >24h. */
export function formatLogTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Subject por defecto para cada categoría (placeholder cuando user
 * crea template nuevo y no se le ocurre subject).
 */
export const CATEGORY_DEFAULT_SUBJECT: Record<MailCategory, string> = {
  operativo: "[DTD Cargo] {{shipment_code}} · Actualización",
  comercial: "Estimado DTD Cargo para {{customer_name}}",
  cobranza: "Recordatorio · Factura {{invoice_code}} pendiente",
  cliente: "DTD Cargo · {{topic}}",
  interno: "[Interno] {{topic}}",
  sistema: "[Sistema] {{topic}}",
};

export function categoryDefaultSubject(c: MailCategory): string {
  return CATEGORY_DEFAULT_SUBJECT[c];
}

/**
 * Calcula open rate y bounce rate de un template. Útil en KPIs y card.
 * Devuelve 0–100 (porcentaje, no fracción).
 */
export function templateOpenRate(t: Pick<MailTemplate, "metrics_sent" | "metrics_opened">): number {
  if (t.metrics_sent <= 0) return 0;
  return Math.round((t.metrics_opened / t.metrics_sent) * 100);
}

export function templateBounceRate(t: Pick<MailTemplate, "metrics_sent" | "metrics_bounced">): number {
  if (t.metrics_sent <= 0) return 0;
  return Math.round((t.metrics_bounced / t.metrics_sent) * 100);
}
