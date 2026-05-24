"use server";

/**
 * Server actions del módulo Agentes y Skills (SDD-0020 Fase 2C).
 *
 * V1 acá:
 *  - installSkillAction: instala una skill en el tenant del usuario.
 *    Crea agent (status='off') + auto-grant todas las tools_required.
 *
 * Siguientes fases:
 *  - toggleAgentStatusAction → Fase 2C/2D
 *  - updateAgentConfigAction → Fase 2C
 *  - softDeleteAgentAction → Fase 2C
 *  - runAgentManualAction → Fase 2D (necesita endpoint runtime)
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  AGENT_STATUSES,
  validateInstallSkillInput,
  type AgentActionState,
  type AgentStatus,
  type InstallSkillInput,
} from "@/lib/studio/agent-types";

function parseInstallFormData(formData: FormData): Partial<InstallSkillInput> {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : undefined;
  };
  const budget = get("budget_usd_monthly");
  return {
    skill_id: get("skill_id"),
    name: get("name"),
    model: get("model") as InstallSkillInput["model"] | undefined,
    budget_usd_monthly: budget !== undefined ? Number(budget) : undefined,
  };
}

export async function installSkillAction(
  _prev: AgentActionState,
  formData: FormData,
): Promise<AgentActionState> {
  const supabase = await createClient();

  const partial = parseInstallFormData(formData);
  const { input, fieldErrors } = validateInstallSkillInput(partial);
  if (fieldErrors || !input) return { fieldErrors };

  // Resolver tenant del usuario logueado
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Resolver el usuario (created_by)
  const { data: userResp } = await supabase.auth.getUser();
  const createdBy = userResp.user?.id ?? null;

  // Fetch skill para conocer tools_required (auto-grant) y default_trigger
  const { data: skill, error: skillErr } = await supabase
    .from("skills")
    .select("id, slug, name, tools_required, default_trigger")
    .eq("id", input.skill_id)
    .eq("active", true)
    .maybeSingle<{
      id: string;
      slug: string;
      name: string;
      tools_required: string[];
      default_trigger: string;
    }>();
  if (skillErr || !skill) {
    return { error: "La skill no existe o está desactivada." };
  }

  // Generar slug AGT-NNNN via RPC
  const { data: slugResp, error: slugErr } = await supabase.rpc(
    "next_agent_slug",
    { p_tenant_id: link.tenant_id },
  );
  if (slugErr || !slugResp) {
    return { error: `No se pudo generar el slug: ${slugErr?.message ?? "RPC vacío"}` };
  }
  const agentSlug = slugResp as string;

  // Insertar agent
  const { data: agentRow, error: insertErr } = await supabase
    .from("agents")
    .insert({
      tenant_id: link.tenant_id,
      skill_id: input.skill_id,
      slug: agentSlug,
      name: input.name,
      model: input.model,
      status: "off",
      budget_usd_monthly: input.budget_usd_monthly,
      trigger_config: input.trigger_config ?? {},
      created_by: createdBy,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !agentRow) {
    return { error: `No se pudo instalar la skill: ${insertErr?.message ?? "insert vacío"}` };
  }

  // Auto-grant de tools_required (cada una en su fila)
  if (skill.tools_required.length > 0) {
    const grants = skill.tools_required.map((toolKey) => ({
      agent_id: agentRow.id,
      tool_key: toolKey,
      scope: {},
      granted_by: createdBy,
    }));
    const { error: grantErr } = await supabase
      .from("agent_tool_grants")
      .insert(grants);
    if (grantErr) {
      // No revertimos el agent — V1 acepta agent sin grants y los re-otorga
      // desde el detalle. Reportamos para que el operador sepa.
      revalidatePath("/studio/admin/agentes");
      return {
        ok: true,
        agentId: agentRow.id,
        error: `Agent instalado pero falló el grant de tools: ${grantErr.message}. Reotorgalas desde el detalle.`,
      };
    }
  }

  revalidatePath("/studio/admin/agentes");
  revalidatePath("/studio/dashboard");
  return { ok: true, agentId: agentRow.id };
}

/**
 * Toggle status del agent (off ↔ paused ↔ active). RLS valida tenant
 * automáticamente via update — un user de otro tenant no puede afectar.
 */
export async function toggleAgentStatusAction(
  agentId: string,
  nextStatus: AgentStatus,
): Promise<AgentActionState> {
  if (!AGENT_STATUSES.includes(nextStatus)) {
    return { error: `Estado inválido: ${nextStatus}` };
  }
  if (!agentId) return { error: "Falta agentId." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ status: nextStatus })
    .eq("id", agentId)
    .is("deleted_at", null);
  if (error) {
    return { error: `No se pudo cambiar el estado: ${error.message}` };
  }

  revalidatePath("/studio/admin/agentes");
  revalidatePath("/studio/dashboard");
  return { ok: true, agentId };
}
