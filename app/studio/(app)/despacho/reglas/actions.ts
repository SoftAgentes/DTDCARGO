/**
 * Server action de configuración de reglas (SDD-0029 §5).
 * Upsert idempotente via RPC upsert_dispatch_rules.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateUpdateDispatchRulesInput,
  type DispatchPaymentPolicy,
  type DispatchRulesActionState,
  type DispatchWeights,
  type UpdateDispatchRulesInput,
  WEIGHT_MAX,
} from "@/lib/studio/dispatch-rules-types";

function parseStringList(v: FormDataEntryValue | null): string[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  // CSV o JSON array
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      /* fallthrough to CSV */
    }
  }
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseWeights(formData: FormData): DispatchWeights {
  const num = (k: string) => {
    const v = formData.get(k);
    if (v == null) return 0;
    const n = Number(String(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(WEIGHT_MAX, n)) : 0;
  };
  return {
    valencia: num("weights.valencia"),
    full_pay: num("weights.full_pay"),
    partial_pay: num("weights.partial_pay"),
    fifo: num("weights.fifo"),
    vip: num("weights.vip"),
    route_proximity: num("weights.route_proximity"),
  };
}

export async function updateDispatchRulesAction(
  _prev: DispatchRulesActionState,
  formData: FormData,
): Promise<DispatchRulesActionState> {
  const supabase = await createClient();

  const partial: Partial<UpdateDispatchRulesInput> = {
    payment_policy: (formData.get("payment_policy") as DispatchPaymentPolicy) ?? "estricto",
    whitelist_markboxes: parseStringList(formData.get("whitelist_markboxes")),
    weights: parseWeights(formData),
    optional_rules: {
      tier: formData.get("optional_rules.tier") === "on",
      routes: formData.get("optional_rules.routes") === "on",
    },
    vip_markboxes: parseStringList(formData.get("vip_markboxes")),
    hold_until: (formData.get("hold_until") as string | null)?.trim() || null,
    hold_reason: (formData.get("hold_reason") as string | null)?.trim() || null,
  };

  const { input, fieldErrors } = validateUpdateDispatchRulesInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase.rpc("upsert_dispatch_rules", {
    p_tenant_id: link.tenant_id,
    p_payload: {
      payment_policy: input!.payment_policy,
      whitelist_markboxes: input!.whitelist_markboxes,
      weights: input!.weights,
      optional_rules: input!.optional_rules,
      vip_markboxes: input!.vip_markboxes,
      hold_until: input!.hold_until,
      hold_reason: input!.hold_reason,
    },
  });

  if (error) return { error: `No se pudieron guardar las reglas: ${error.message}` };

  revalidatePath("/studio/despacho");
  revalidatePath("/studio/despacho/reglas");
  return { ok: true };
}
