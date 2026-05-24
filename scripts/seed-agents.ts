/**
 * Seed UPSERT de skills built-in (SDD-0020 Fase 2E).
 *
 * Sincroniza `public.skills` (DB) con `SKILLS_BY_SLUG` (código en
 * lib/studio/agents/skills/). Fuente de verdad: el código. La DB es
 * una proyección sembrada al deploy.
 *
 * Idempotente: corre con `on conflict (slug) do update`. Re-deploys
 * actualizan descripción, system_prompt, schemas y cost_estimate
 * sin migración manual.
 *
 * El orchestrator igual lee el SkillDef desde código (getSkillDefBySlug
 * en runtime/orchestrator.ts), así que este seed es defensa en
 * profundidad: garantiza que el catálogo `/admin/agentes` muestre los
 * mismos datos que el runtime ejecuta.
 *
 * Uso:
 *   pnpm seed       (corre seed.ts entero, que invoca este)
 *   import { seedAgents } from "./seed-agents" → llamar manualmente
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILLS_BY_SLUG } from "@/lib/studio/agents/skills/tracking-concierge";
import type { SkillDef } from "@/lib/studio/agents/runtime/types";

function skillDefToRow(s: SkillDef) {
  return {
    slug: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    icon: s.icon,
    default_model: s.default_model,
    default_trigger: "manual" as const,
    tools_required: s.tools_required,
    input_schema: s.input_schema,
    output_schema: s.output_schema,
    system_prompt: s.system_prompt,
    cost_estimate_usd: s.cost_estimate_usd,
    version: s.version,
    active: true,
  };
}

export async function seedAgents(supabase: SupabaseClient): Promise<void> {
  const skills = Object.values(SKILLS_BY_SLUG);
  if (skills.length === 0) {
    console.log("[seed-agents] No hay skills en código — nada que sembrar.");
    return;
  }

  const rows = skills.map(skillDefToRow);

  const { error, data } = await supabase
    .from("skills")
    .upsert(rows, { onConflict: "slug" })
    .select("slug");

  if (error) {
    throw new Error(`[seed-agents] UPSERT failed: ${error.message}`);
  }

  const slugs = (data ?? []).map((r) => (r as { slug: string }).slug);
  console.log(
    `[seed-agents] Sincronizadas ${slugs.length} skill(s): ${slugs.join(", ")}`,
  );
}
