/**
 * Runtime engine de reglas de mailing (SDD-0026 · cierre del watcher).
 *
 * Punto de entrada único `fireMailEvent()` que llaman las server actions
 * después de cada operación que produce un evento del enum `mail_rule_event`
 * (shipment_created, quote_sent, etc).
 *
 * Flujo:
 *   1. SELECT mail_rules WHERE tenant=? AND event=? AND active=true
 *   2. SELECT templates por id (batch) — descarta inactivas
 *   3. Resolver recipients según rule.recipient_kind:
 *        - client   → query clients.email por markbox (o usar override)
 *        - internal → emails de los admins activos del tenant
 *        - custom   → rule.recipient_value
 *   4. Por cada (rule, recipient) → sendEmail() best-effort
 *   5. UPDATE mail_rules.last_triggered_at + trigger_count
 *
 * Best-effort: cualquier error se loggea pero NO se propaga. El caller
 * (server action de embarques/cotizador) NO se rompe si el mailing falla.
 *
 * Patrón gemelo de `lib/studio/bug-email-notify.ts` (SDD-0036 Fase 5).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send-email";
import type { MailRuleEvent } from "@/lib/studio/mail-types";

export interface FireMailEventInput {
  event: MailRuleEvent;
  /** Variables del template — claves matchean `{{snake_case}}` del body. */
  vars: Record<string, string>;
  /** Si recipient_kind='client' y no hay clientEmail override, lookup por markbox. */
  clientMarkbox?: string | null;
  /** Override directo. Saltea el lookup por markbox. */
  clientEmail?: string | null;
  /** to_name del mail_log (opcional). */
  clientName?: string | null;
  /** Trazabilidad: queda en mail_logs.metadata. */
  sourceRef?: { kind: string; id: string };
}

interface MailRuleRow {
  id: string;
  template_id: string;
  recipient_kind: "client" | "internal" | "custom";
  recipient_value: string | null;
  trigger_count: number;
}

interface MailTemplateRow {
  id: string;
  slug: string;
  active: boolean;
}

export async function fireMailEvent(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  input: FireMailEventInput,
): Promise<void> {
  try {
    // ── 1. Buscar reglas activas para el evento+tenant ──
    const { data: rulesRaw, error: rulesErr } = await supabaseAdmin
      .from("mail_rules")
      .select("id, template_id, recipient_kind, recipient_value, trigger_count")
      .eq("tenant_id", tenantId)
      .eq("event", input.event)
      .eq("active", true);

    if (rulesErr) {
      console.error(`[mail-rule-engine] read rules failed (${input.event}):`, rulesErr.message);
      return;
    }
    const rules = (rulesRaw ?? []) as MailRuleRow[];
    if (rules.length === 0) return;

    // ── 2. Batch lookup de templates activos ──
    const templateIds = Array.from(new Set(rules.map((r) => r.template_id)));
    const { data: tplRaw } = await supabaseAdmin
      .from("mail_templates")
      .select("id, slug, active")
      .eq("tenant_id", tenantId)
      .in("id", templateIds);

    const templates = (tplRaw ?? []) as MailTemplateRow[];
    const templateMap = new Map<string, MailTemplateRow>();
    for (const t of templates) templateMap.set(t.id, t);

    // ── 3. Resolución lazy de destinatarios compartida entre reglas ──
    const needsClient = rules.some((r) => r.recipient_kind === "client");
    const needsInternal = rules.some((r) => r.recipient_kind === "internal");

    let resolvedClientEmail: string | null = input.clientEmail ?? null;
    if (!resolvedClientEmail && needsClient && input.clientMarkbox) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("email")
        .eq("tenant_id", tenantId)
        .eq("markbox", input.clientMarkbox)
        .maybeSingle<{ email: string | null }>();
      resolvedClientEmail = client?.email ?? null;
    }

    let adminEmails: string[] = [];
    if (needsInternal) {
      adminEmails = await resolveAdminEmails(supabaseAdmin, tenantId);
    }

    // ── 4. Disparar cada regla ──
    for (const rule of rules) {
      const template = templateMap.get(rule.template_id);
      if (!template || !template.active) {
        console.warn(
          `[mail-rule-engine] rule ${rule.id} apunta a template inactivo o inexistente, skip.`,
        );
        continue;
      }

      const recipients = resolveRecipients(rule, {
        clientEmail: resolvedClientEmail,
        adminEmails,
      });

      if (recipients.length === 0) {
        console.warn(
          `[mail-rule-engine] rule ${rule.id} (${input.event}) sin destinatarios resueltos (kind=${rule.recipient_kind}), skip.`,
        );
        continue;
      }

      let sentAny = false;
      for (const to of recipients) {
        const result = await sendEmail(supabaseAdmin, tenantId, {
          templateSlug: template.slug,
          to,
          to_name: input.clientName ?? undefined,
          vars: input.vars,
          metadata: {
            source: "mail-rule-engine",
            event: input.event,
            rule_id: rule.id,
            recipient_kind: rule.recipient_kind,
            source_ref: input.sourceRef ?? null,
          },
        });
        if (result.ok) {
          sentAny = true;
        } else {
          console.error(
            `[mail-rule-engine] sendEmail failed (rule ${rule.id}, to=${to}):`,
            result.error,
          );
        }
      }

      // ── 5. Bump métricas SOLO si se logró iniciar algún envío ──
      if (sentAny) {
        const { error: bumpErr } = await supabaseAdmin
          .from("mail_rules")
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: rule.trigger_count + 1,
          })
          .eq("id", rule.id);

        if (bumpErr) {
          console.error(
            `[mail-rule-engine] bump trigger_count failed (rule ${rule.id}):`,
            bumpErr.message,
          );
        }
      }
    }
  } catch (err) {
    console.error(`[mail-rule-engine] fireMailEvent error (${input.event}):`, err);
  }
}

function resolveRecipients(
  rule: Pick<MailRuleRow, "recipient_kind" | "recipient_value">,
  ctx: { clientEmail: string | null; adminEmails: string[] },
): string[] {
  switch (rule.recipient_kind) {
    case "client":
      return ctx.clientEmail ? [ctx.clientEmail] : [];
    case "internal":
      return ctx.adminEmails;
    case "custom":
      return rule.recipient_value ? [rule.recipient_value] : [];
    default:
      return [];
  }
}

/**
 * Emails de admins activos del tenant. Mismo patrón que bug-email-notify
 * (notifyBugCreatedToAdmin). Si se admite >200 admins en V2, paginar.
 */
async function resolveAdminEmails(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const { data: links, error } = await supabaseAdmin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);

  if (error || !links || links.length === 0) return [];

  const ids = new Set((links as Array<{ user_id: string }>).map((r) => r.user_id));

  const { data: usersResp } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const users = usersResp?.users ?? [];
  return users
    .filter((u) => ids.has(u.id) && !!u.email)
    .map((u) => u.email as string);
}
