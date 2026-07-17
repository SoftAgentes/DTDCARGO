/**
 * Queries + validación de las reglas de notificación al cliente (SDD-0156·B).
 *
 * Funciones puras que reciben un SupabaseClient (patrón del Studio). La lectura
 * corre con el cliente authenticated (RLS por tenant); la escritura también,
 * gateada a rol admin en la Server Action. `seedDefaultRulesForTenant` usa el
 * admin client (onboarding / "restaurar defaults").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_JOURNEY_EVENT_KEYS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ANCHORS,
  TEMPLATE_KEYS,
  isNotificationChannel,
  isNotificationAnchor,
  type ClientNotificationRule,
} from "./client-notification-types";

/** Eventos que se siembran como default = comportamiento de HOY (SDD-0132). */
export const DEFAULT_SEED_EVENTS = [
  "status:in_warehouse",
  "status:shipped",
  "status:out_for_delivery",
  "status:delivered",
] as const;

/** Offset tope de seguridad: ±120 días en minutos. Evita fechas absurdas. */
const MAX_OFFSET_MINUTES = 120 * 24 * 60;

export interface UpsertRuleInput {
  id?: string | null;
  client_id?: string | null;
  trigger_event: string;
  channel: string;
  anchor: string;
  offset_minutes: number;
  template_key?: string | null;
  custom_title?: string | null;
  custom_body?: string | null;
  visible_in_portal: boolean;
  active: boolean;
}

export interface ValidatedRule {
  client_id: string | null;
  trigger_event: string;
  channel: string;
  anchor: string;
  offset_minutes: number;
  template_key: string | null;
  custom_title: string | null;
  custom_body: string | null;
  visible_in_portal: boolean;
  active: boolean;
}

/** Valida input de regla (sin Zod). Devuelve error legible o la fila saneada. */
export function validateRuleInput(
  input: UpsertRuleInput,
): { error: string } | { ok: true; value: ValidatedRule } {
  if (!CLIENT_JOURNEY_EVENT_KEYS.has(input.trigger_event)) {
    return { error: `Evento desconocido: "${input.trigger_event}".` };
  }
  if (!isNotificationChannel(input.channel)) {
    return {
      error: `Canal inválido. Usa uno de: ${NOTIFICATION_CHANNELS.join(", ")}.`,
    };
  }
  if (!isNotificationAnchor(input.anchor)) {
    return {
      error: `Ancla inválida. Usa una de: ${NOTIFICATION_ANCHORS.join(", ")}.`,
    };
  }
  if (!Number.isInteger(input.offset_minutes)) {
    return { error: "El corrimiento debe ser un número entero de minutos." };
  }
  if (Math.abs(input.offset_minutes) > MAX_OFFSET_MINUTES) {
    return { error: "El corrimiento supera el máximo permitido (120 días)." };
  }
  const templateKey = input.template_key?.trim() || null;
  if (templateKey && !TEMPLATE_KEYS.includes(templateKey)) {
    return { error: `Template desconocido: "${templateKey}".` };
  }
  const clientId = input.client_id?.trim() || null;

  return {
    ok: true,
    value: {
      client_id: clientId,
      trigger_event: input.trigger_event,
      channel: input.channel,
      anchor: input.anchor,
      offset_minutes: input.offset_minutes,
      template_key: templateKey,
      custom_title: input.custom_title?.trim() || null,
      custom_body: input.custom_body?.trim() || null,
      visible_in_portal: input.visible_in_portal,
      active: input.active,
    },
  };
}

/** Reglas del tenant. Si `clientId` se pasa, trae SOLO los overrides de ese
 *  cliente; si es undefined, trae los defaults del tenant (client_id null). */
export async function listRules(
  supabase: SupabaseClient,
  tenantId: string,
  clientId?: string | null,
): Promise<ClientNotificationRule[]> {
  let q = supabase
    .from("client_notification_rules")
    .select("*")
    .eq("tenant_id", tenantId);
  q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
  const { data, error } = await q.order("trigger_event", { ascending: true });
  if (error) {
    console.error("[client-notif-rules] listRules:", error.message);
    return [];
  }
  return (data ?? []) as ClientNotificationRule[];
}

/** Upsert por (tenant, client_id, trigger_event). Devuelve la fila o error. */
export async function upsertRule(
  supabase: SupabaseClient,
  tenantId: string,
  value: ValidatedRule,
): Promise<{ error: string } | { ok: true }> {
  // Buscar existente por la clave lógica (default vs override).
  let sel = supabase
    .from("client_notification_rules")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("trigger_event", value.trigger_event);
  sel = value.client_id
    ? sel.eq("client_id", value.client_id)
    : sel.is("client_id", null);
  const { data: existing } = await sel.maybeSingle<{ id: string }>();

  const payload = {
    tenant_id: tenantId,
    client_id: value.client_id,
    trigger_event: value.trigger_event,
    channel: value.channel,
    anchor: value.anchor,
    offset_minutes: value.offset_minutes,
    template_key: value.template_key,
    custom_title: value.custom_title,
    custom_body: value.custom_body,
    visible_in_portal: value.visible_in_portal,
    active: value.active,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase
        .from("client_notification_rules")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("client_notification_rules").insert(payload);

  if (error) {
    console.error("[client-notif-rules] upsertRule:", error.message);
    return { error: "No pudimos guardar la regla." };
  }
  return { ok: true };
}

/** Borra una regla. Si tiene agenda ya programada/enviada, la FK restrict lo
 *  bloquea → devolvemos un error legible sugiriendo desactivar en su lugar. */
export async function deleteRule(
  supabase: SupabaseClient,
  tenantId: string,
  ruleId: string,
): Promise<{ error: string } | { ok: true }> {
  const { error } = await supabase
    .from("client_notification_rules")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", ruleId);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "La regla ya tiene avisos programados o enviados. Desactívala en vez de borrarla.",
      };
    }
    console.error("[client-notif-rules] deleteRule:", error.message);
    return { error: "No pudimos borrar la regla." };
  }
  return { ok: true };
}

/**
 * Siembra las reglas default (comportamiento de HOY) para un tenant que no las
 * tenga. Idempotente. Para onboarding de tenants nuevos o "restaurar defaults".
 * Usa admin client (bypassa RLS).
 */
export async function seedDefaultRulesForTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const rows = DEFAULT_SEED_EVENTS.map((evt) => ({
    tenant_id: tenantId,
    client_id: null,
    trigger_event: evt,
    channel: "email",
    anchor: "event",
    offset_minutes: 0,
    visible_in_portal: true,
    active: true,
  }));
  // No pisar existentes: filtrar por lo que ya hay.
  const { data: have } = await admin
    .from("client_notification_rules")
    .select("trigger_event")
    .eq("tenant_id", tenantId)
    .is("client_id", null);
  const haveSet = new Set((have ?? []).map((r) => (r as { trigger_event: string }).trigger_event));
  const toInsert = rows.filter((r) => !haveSet.has(r.trigger_event));
  if (toInsert.length === 0) return 0;

  const { error } = await admin
    .from("client_notification_rules")
    .insert(toInsert);
  if (error) {
    console.error("[client-notif-rules] seed:", error.message);
    return 0;
  }
  return toInsert.length;
}
