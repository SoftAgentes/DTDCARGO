/**
 * Types compartidos entre server + client del módulo /studio/mailing.
 *
 * IMPORTANTE: `MailingActionState` + `INITIAL_MAILING_STATE` viven acá
 * (y NO en `../actions.ts`) porque Next 16 enforcing estricto: archivos
 * con "use server" solo pueden exportar funciones async. Las constantes
 * y types compartidos con clients tienen que vivir en un module separado.
 */

import type { ActionFieldErrors } from "@/lib/studio/mail-types";

export interface MailingActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ActionFieldErrors;
  message?: string;
}

export const INITIAL_MAILING_STATE: MailingActionState = {};

export type MailingAdminTab =
  | "templates"
  | "signatures"
  | "compose"
  | "scheduled"
  | "reglas"
  | "config"
  | "logs";

export interface MailConfigRow {
  tenant_id: string;
  from_email: string;
  from_name: string;
  reply_to: string | null;
  test_mode: boolean;
  internal_test_email: string | null;
  domain_verified: boolean;
  updated_at: string;
}

export interface MailBlacklistRow {
  id: string;
  email: string;
  reason: string; // "bounce" | "complaint" | "manual" (text en DB, no enum)
  notes: string | null;
  added_by: string | null;
  added_at: string;
}

export type MailLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked"
  | "failed";

export interface MailLogRow {
  id: string;
  template_slug: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: MailLogStatus;
  resend_message_id: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
}

export interface MailingFilters {
  status: MailLogStatus | "all";
  template: string;
  search: string;
}

export const MAIL_LOG_STATUS_LABEL: Record<MailLogStatus, string> = {
  queued: "En cola",
  sent: "Enviado",
  delivered: "Entregado",
  bounced: "Rebotado",
  complained: "Spam reportado",
  opened: "Abierto",
  clicked: "Clickeado",
  failed: "Falló",
};

export const MAIL_LOG_STATUS_TONE: Record<MailLogStatus, string> = {
  queued: "neutral",
  sent: "info",          // en tránsito, sin confirmación aún
  delivered: "success",  // confirmado en inbox
  opened: "success",     // engagement +1 (mismo verde que delivered, igual señal positiva)
  clicked: "wine",       // engagement máximo (acento de marca)
  bounced: "danger",
  complained: "danger",
  failed: "danger",
};
