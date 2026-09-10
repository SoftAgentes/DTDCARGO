"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { parseLabelPresentation } from "@/lib/shared/label-presentation";

export async function saveLabelPresentation(settings: unknown, version: number): Promise<{ version?: number; error?: string }> {
  const parsed = parseLabelPresentation(settings);
  if (!parsed || !Number.isInteger(version) || version < 0) return { error: "Revisa la configuración." };
  const db = await createClient();
  const denial = await moduleEditDenial(db, "admin");
  if (denial) return { error: denial };
  const { data, error } = await db.rpc("save_shipping_label_presentation", { p_settings: parsed, p_expected_version: version });
  if (error) return { error: error.code === "40001" ? "Otra sesión guardó cambios. Actualiza la página para revisarlos." : "No se pudo guardar. Revisa tus permisos y la disponibilidad de la configuración." };
  revalidatePath("/studio/admin/etiquetas");
  revalidatePath("/p/[token]", "page");
  revalidatePath("/portal/compras/[code]/etiquetas", "page");
  return { version: Number(data) };
}
