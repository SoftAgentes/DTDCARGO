/**
 * Server action del editor de "Servicios de recepción" (SDD-0098 · PORT-6).
 *
 * Permite al admin prender/apagar cada add-on y pegar su video de ayuda de
 * YouTube SIN SQL. UPDATE sobre `prealerta_addons` scopeado al tenant por la RLS
 * "prealerta_addons tenant write" (migr 0150) — las 7 filas ya están seeded por
 * tenant, así que un UPDATE por `code` alcanza (no hace falta el tenant_id).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { isPrealertaAddonCode } from "@/lib/studio/prealertas/addons";

export type AddonConfigState = { ok?: boolean; error?: string };

export async function updatePrealertaAddonConfigAction(
  _prev: AddonConfigState,
  formData: FormData,
): Promise<AddonConfigState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const code = String(formData.get("code") ?? "").trim();
  const isActive = String(formData.get("is_active") ?? "") === "true";
  const rawUrl = String(formData.get("video_url") ?? "").trim();

  if (!isPrealertaAddonCode(code)) return { error: "Servicio inválido." };

  // video_url: vacío = limpiar (null); si hay valor debe ser un enlace YouTube https.
  let videoUrl: string | null = null;
  if (rawUrl) {
    const isYouTube =
      /^https:\/\//i.test(rawUrl) && /(youtube\.com|youtu\.be)/i.test(rawUrl);
    if (!isYouTube) {
      return { error: "El video debe ser un enlace de YouTube (https://…)." };
    }
    videoUrl = rawUrl;
  }

  const { error } = await supabase
    .from("prealerta_addons")
    .update({ video_url: videoUrl, is_active: isActive })
    .eq("code", code);

  if (error) return { error: "No se pudo guardar el servicio." };

  revalidatePath("/studio/admin");
  return { ok: true };
}
