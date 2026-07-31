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
import { executeD1Operation } from "@/lib/studio/audit/d1-access-config-adapters";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
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

  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const partial = parseInstallFormData(formData);
  const { input, fieldErrors } = validateInstallSkillInput(partial);
  if (fieldErrors || !input) return { fieldErrors };

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

  let agentId: string;
  try {
    const result = await executeD1Operation(supabase, {
      operationType: "agent.install",
      input: {
        skill_id: input.skill_id,
        name: input.name,
        model: input.model,
        budget_usd_monthly: input.budget_usd_monthly,
        trigger_config: input.trigger_config ?? {},
        tools_required: skill.tools_required,
      },
    });
    agentId = result.entity_id;
  } catch {
    return { error: "No se pudo instalar la skill y sus grants." };
  }

  revalidatePath("/studio/admin/agentes");
  revalidatePath("/studio/dashboard");
  return { ok: true, agentId };
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

  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  try {
    await executeD1Operation(supabase, {
      operationType: "agent.status_change",
      targetId: agentId,
      input: { status: nextStatus },
    });
  } catch {
    return { error: "No se pudo cambiar el estado." };
  }

  revalidatePath("/studio/admin/agentes");
  revalidatePath("/studio/dashboard");
  return { ok: true, agentId };
}
