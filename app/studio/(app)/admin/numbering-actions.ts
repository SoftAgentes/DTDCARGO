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

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const { error: dbError } = await supabase
    .from("tenants")
    .update({
      invoice_footer_text: input!.footer || null,
      invoice_terms_text: input!.terms || null,
    })
    .eq("id", link.tenant_id);

  if (dbError) {
    if (dbError.code === "42501") return { error: "RLS bloqueó el cambio (no eres admin)." };
    return { error: `No se pudo guardar: ${dbError.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
