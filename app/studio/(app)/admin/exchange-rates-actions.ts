"use server";

/**
 * Tasas de cambio (SDD-0126, SDD-0569) — server action (admin only).
 *
 * Registra la tasa manual de un día en `fx_rates` por la RPC
 * `registrar_tasa_de_cambio` (migración 0495). Una segunda del mismo día y
 * moneda la reemplaza; la auditoría D2 guarda la anterior.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  fxPairCurrency,
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

  const { error: dbError } = await supabase.rpc("registrar_tasa_de_cambio", {
    p_currency: fxPairCurrency(input!.pair),
    p_rate: input!.rate,
    p_valid_on: input!.validOn,
    p_note: input!.note,
  });

  if (dbError) {
    // Solo los mensajes propios de la 0495 (hint dtd-fx); nunca el texto de la base (ERR-01).
    if (dbError.hint === "dtd-fx" && dbError.message) return { error: dbError.message };
    console.error("[tasas] registrar:", dbError.code, dbError.message);
    return { error: "No se pudo guardar la tasa. Intenta de nuevo." };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
