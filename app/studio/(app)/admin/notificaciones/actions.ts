"use server";

/**
 * Server actions de la config de notificaciones al cliente (SDD-0156 · Slice B).
 * Admin-only (mismo check que feature-flags). RLS por tenant en la tabla como
 * defensa en profundidad.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import {
  d1Reason,
  executeD1Operation,
} from "@/lib/studio/audit/d1-access-config-adapters";
import {
  validateRuleInput,
} from "@/lib/studio/notifications/client-notification-rules-queries";

export interface RuleActionState {
  ok?: boolean;
  error?: string;
}

const ADMIN_MSG = "Solo admins pueden configurar notificaciones.";

/**
 * Gate admin-only con el guard central (SDD-0498).
 *
 * La versión anterior leía `user_tenants` acá con DOS huecos: sin
 * `.eq("user_id", …)` —así que quien decidía era la primera fila que
 * devolviera PostgREST, justo de lo que avisa `rbac-guard.ts`— y sin
 * `.is("disabled_at", null)`, el fail-closed de la 0200: un admin suspendido
 * seguía configurando los avisos al cliente.
 */
async function requireAdmin(): Promise<
  | { error: string }
  | { ok: true; tenantId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase, { denied: ADMIN_MSG, noTenant: "Sin tenant." });
  if (!gate.ok) return { error: gate.denied };
  return { ok: true, tenantId: gate.tenantId, supabase };
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

  try {
    await executeD1Operation(guard.supabase, {
      operationType: "notification_rule.upsert",
      targetId: str(formData.get("id")),
      input: { ...validated.value },
    });
  } catch {
    return { error: "No pudimos guardar la regla." };
  }

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

  try {
    await executeD1Operation(guard.supabase, {
      operationType: "notification_rule.delete",
      targetId: ruleId,
      reason: d1Reason(
        formData.get("reason"),
        "Eliminación solicitada desde Notificaciones",
      ),
    });
  } catch {
    return {
      error:
        "No pudimos borrar la regla. Si tiene avisos asociados, desactívala.",
    };
  }

  revalidatePath("/studio/admin/notificaciones");
  return { ok: true };
}

export async function restoreDefaultsAction(
  prev: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  void prev;
  void formData;
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  try {
    await executeD1Operation(guard.supabase, {
      operationType: "notification_rule.restore_defaults",
    });
  } catch {
    return { error: "No pudimos restaurar las reglas predeterminadas." };
  }

  revalidatePath("/studio/admin/notificaciones");
  return { ok: true };
}

function str(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function checkbox(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}
