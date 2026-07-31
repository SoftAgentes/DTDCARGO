"use server";

/**
 * Server actions de "Numeración & legal" (SDD-0122, admin only).
 *
 * Solo cubre lo editable y seguro: las leyendas legales del pie de factura
 * (texto de pie + T&C), guardadas en `tenants`. Los FORMATOS de correlativo NO
 * se editan desde acá (son correlativos legales fijos por diseño).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { executeD1Operation } from "@/lib/studio/audit/d1-access-config-adapters";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateLegalLegendsInput,
  type NumberingActionState,
} from "@/lib/studio/numbering-types";

export async function updateLegalLegendsAction(
  _prev: NumberingActionState,
  formData: FormData,
): Promise<NumberingActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, error } = validateLegalLegendsInput(formData);
  if (error) return { error };

  try {
    await executeD1Operation(supabase, {
      operationType: "numbering.legal_legend_update",
      input: {
        footer: input!.footer,
        terms: input!.terms,
      },
    });
  } catch {
    return { error: "No se pudo guardar la configuración legal." };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
