"use server";

/**
 * Server actions de la config de notificaciones al cliente (SDD-0156 · Slice B).
 * Admin-only (mismo check que feature-flags). RLS por tenant en la tabla como
 * defensa en profundidad.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getUserTenantId } from "@/lib/auth/session";
import {
  validateRuleInput,
  upsertRule,
  deleteRule,
  seedDefaultRulesForTenant,
} from "@/lib/studio/notifications/client-notification-rules-queries";

export interface RuleActionState {
  ok?: boolean;
  error?: string;
}

async function requireAdmin(): Promise<
  | { error: string }
  | { ok: true; tenantId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Inicia sesión primero." };
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "Sin tenant." };
  if (link.role !== "admin") {
    return { error: "Solo admins pueden configurar notificaciones." };
  }
  return { ok: true, tenantId: link.tenant_id, supabase };
}

export async function upsertRuleAction(
  _prev: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const offsetRaw = formData.get("offset_minutes");
  const offsetMinutes = Number.parseInt(String(offsetRaw ?? "0"), 10);

  const validated = validateRuleInput({
    id: str(formData.get("id")),
    client_id: str(formData.get("client_id")),
    trigger_event: String(formData.get("trigger_event") ?? ""),
    channel: String(formData.get("channel") ?? ""),
    anchor: String(formData.get("anchor") ?? "event"),
    offset_minutes: Number.isNaN(offsetMinutes) ? 0 : offsetMinutes,
    template_key: str(formData.get("template_key")),
    custom_title: str(formData.get("custom_title")),
    custom_body: str(formData.get("custom_body")),
    visible_in_portal: checkbox(formData.get("visible_in_portal")),
    active: checkbox(formData.get("active")),
  });
  if ("error" in validated) return { error: validated.error };

  const res = await upsertRule(guard.supabase, guard.tenantId, validated.value);
  if ("error" in res) return { error: res.error };

  revalidatePath("/studio/admin/notificaciones");
  return { ok: true };
}

export async function deleteRuleAction(
  _prev: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const ruleId = str(formData.get("id"));
  if (!ruleId) return { error: "Falta el id de la regla." };

  const res = await deleteRule(guard.supabase, guard.tenantId, ruleId);
  if ("error" in res) return { error: res.error };

  revalidatePath("/studio/admin/notificaciones");
  return { ok: true };
}

export async function restoreDefaultsAction(
  _prev: RuleActionState,
  _formData: FormData,
): Promise<RuleActionState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const tenantId = (await getUserTenantId()) ?? guard.tenantId;
  const admin = createAdminClient();
  await seedDefaultRulesForTenant(admin, tenantId);

  revalidatePath("/studio/admin/notificaciones");
  return { ok: true };
}

function str(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function checkbox(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}
