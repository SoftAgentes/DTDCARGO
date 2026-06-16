/**
 * Server actions del editor del motor de flujo (SDD-0091 Slice 3).
 * Sin Zod (patrón del Studio). RLS filtra por tenant; igual resolvemos tenant_id para
 * el insert. La REGLA DURA la aplica `validateWorkflowStepInput()` (candado server-side).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateWorkflowStepInput,
  type WorkflowStepActionState,
  type WorkflowNodeKind,
  type AutomationLevel,
} from "./types";
import type { StudioUserRole } from "@/lib/studio/user-types";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function resolveTenant(
  supabase: SupabaseLike,
): Promise<
  { ok: true; tenantId: string; userId: string } | { ok: false; error: string }
> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "Sesión no válida." };
  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { ok: false, error: "No se pudo resolver el tenant del usuario." };
  }
  return { ok: true, tenantId: link.tenant_id, userId };
}

function str(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v).trim();
}

export async function upsertWorkflowStepAction(
  _prev: WorkflowStepActionState,
  formData: FormData,
): Promise<WorkflowStepActionState> {
  const supabase = await createClient();

  const id = str(formData.get("id"));
  const { input, fieldErrors } = validateWorkflowStepInput({
    service_key: str(formData.get("service_key")) || null,
    nombre: str(formData.get("nombre")),
    node_kind: str(formData.get("node_kind")) as WorkflowNodeKind,
    trigger_event: str(formData.get("trigger_event")) || null,
    automation_level:
      (str(formData.get("automation_level")) as AutomationLevel) || "manual",
    owner_role: (str(formData.get("owner_role")) || null) as StudioUserRole | null,
    orden: Number(str(formData.get("orden"))) || 0,
  });
  if (fieldErrors) return { fieldErrors };

  const who = await resolveTenant(supabase);
  if (!who.ok) return { error: who.error };

  const payload = {
    service_key: input!.service_key,
    momento: input!.momento,
    orden: input!.orden,
    nombre: input!.nombre,
    node_kind: input!.node_kind,
    owner_role: input!.owner_role,
    automation_level: input!.automation_level,
    trigger_event: input!.trigger_event,
    depends_on: input!.depends_on,
    updated_by: who.userId,
  };

  if (id) {
    const { error } = await supabase
      .from("service_workflow_steps")
      .update(payload)
      .eq("id", id);
    if (error) return { error: `No se pudo guardar el paso: ${error.message}` };
  } else {
    const { error } = await supabase
      .from("service_workflow_steps")
      .insert({ tenant_id: who.tenantId, ...payload });
    if (error) return { error: `No se pudo crear el paso: ${error.message}` };
  }

  revalidatePath("/studio/servicios");
  return { ok: true };
}

export async function softDeleteWorkflowStepAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_workflow_steps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar el paso: ${error.message}` };
  revalidatePath("/studio/servicios");
  return { ok: true };
}
