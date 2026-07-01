"use server";

/**
 * Tasas de cambio (SDD-0126) — server action (admin only).
 *
 * Registra una tasa nueva en `tenant_fx_history` (append-only). No borra ni
 * edita historial. Gastos/posting leen la última automáticamente.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateExchangeRateInput,
  type ExchangeRateActionState,
} from "@/lib/studio/exchange-rates-types";

export async function recordExchangeRateAction(
  _prev: ExchangeRateActionState,
  formData: FormData,
): Promise<ExchangeRateActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, error } = validateExchangeRateInput(formData);
  if (error) return { error };

  const { data: userResp } = await supabase.auth.getUser();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error: dbError } = await supabase.from("tenant_fx_history").insert({
    tenant_id: link.tenant_id,
    currency_pair: input!.pair,
    rate: input!.rate,
    set_by: userResp.user?.id ?? null,
  });

  if (dbError) {
    if (dbError.code === "42501") return { error: "RLS bloqueó el cambio." };
    return { error: `No se pudo guardar la tasa: ${dbError.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
