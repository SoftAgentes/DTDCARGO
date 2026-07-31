/**
 * Server action del catálogo de tipos de contenedor (SDD-0184 · Fase 2).
 *
 * Deja al admin prender y apagar tipos SIN SQL. Hoy solo el 20' y el 40'HC están
 * activos (decisión del founder 2026-07-30); el resto queda en el catálogo pero
 * apagado — apagar NO es borrar, porque hay consolidaciones históricas que los
 * referencian.
 *
 * UPDATE scopeado al tenant por la RLS de `container_types` (migración 0096), así
 * que alcanza con filtrar por `code`.
 *
 * ⚠️ Esto solo mueve `active`. La CAPACIDAD no se edita desde acá a propósito:
 * `containerStats` la lee de la constante `CONTAINER_TYPES` en TypeScript, no de
 * la base. Si se pudiera cambiar por pantalla, la base y el código quedarían
 * diciendo cosas distintas en la misma sesión. Cambiar una capacidad es una
 * migración + el cambio de la constante, juntos.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

export type ContainerTypeToggleState = { ok?: boolean; error?: string };

export async function toggleContainerTypeActiveAction(
  _prev: ContainerTypeToggleState,
  formData: FormData,
): Promise<ContainerTypeToggleState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const code = String(formData.get("code") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";

  if (!code) return { error: "Falta el tipo de contenedor." };

  // Apagar el último activo dejaría al operario sin nada que elegir al abrir un
  // contenedor. Se cuenta ANTES de escribir.
  if (!active) {
    const { data, error } = await supabase
      .from("container_types")
      .select("code")
      .eq("active", true);

    if (error) return { error: "No se pudo leer el catálogo." };
    const activos = (data ?? []).map((r) => String(r.code));
    if (activos.length <= 1 && activos.includes(code)) {
      return {
        error:
          "Tiene que quedar al menos un tipo activo: si no, el operario no puede abrir ningún contenedor.",
      };
    }
  }

  const { error } = await supabase
    .from("container_types")
    .update({ active })
    .eq("code", code);

  if (error) return { error: "No se pudo cambiar el tipo de contenedor." };

  revalidatePath("/studio/admin");
  revalidatePath("/studio/naviera");
  return { ok: true };
}
