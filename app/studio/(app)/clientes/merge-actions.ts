"use server";

/**
 * Fusión de dos fichas del mismo cliente (SDD-0246).
 *
 * Toda la lógica vive en la RPC `merge_clients`, que es ATÓMICA: mueve el
 * acceso y el historial, rellena los huecos del superviviente con los datos
 * limpios del registro y retira la ficha duplicada. O pasa entera o no pasa.
 *
 * Acá arriba sólo queda el gate de permisos y la traducción del error a algo
 * que el operador entienda.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

export type MergeResult = {
  ok?: boolean;
  error?: string;
  /** Código que sobrevive — el que el cliente debe seguir usando. */
  survivorMarkbox?: string;
  /** Código que quedó anulado. */
  retiredMarkbox?: string;
  /** Qué campos vacíos del superviviente se rellenaron con los del registro. */
  filled?: string[];
  /** Qué pasó con el acceso al portal. */
  access?: string;
  /** Cabos sueltos que el operador tiene que mirar a mano. */
  needsReview?: { conversationsArchived: number; changeRequestsLeftBehind: number };
};

export async function mergeClientsAction(
  survivorId: string,
  mergedId: string,
): Promise<MergeResult> {
  if (!survivorId || !mergedId) {
    return { error: "Faltan las dos fichas para fusionar." };
  }

  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };

  const { data, error } = await supabase.rpc("merge_clients", {
    p_survivor_id: survivorId,
    p_merged_id: mergedId,
  });

  if (error) {
    // Los mensajes de la RPC ya vienen en español y son informativos; el resto
    // (violaciones de índice, etc.) no se le muestran crudos al operador.
    const conocido =
      error.message.includes("fusionar") ||
      error.message.includes("eliminada") ||
      error.message.includes("eliminado") ||
      error.message.includes("No existe");
    console.error("[mergeClientsAction]", error.message);
    return {
      error: conocido
        ? error.message
        : "No se pudo fusionar. Revisa que las dos fichas sigan activas y vuelve a intentar.",
    };
  }

  const res = (data ?? {}) as {
    survivor_markbox?: string;
    retired_markbox?: string;
    filled?: string[];
    access?: string;
    needs_review?: {
      conversations_archived?: number;
      change_requests_left_behind?: number;
    };
  };

  revalidatePath("/studio/clientes");
  revalidatePath("/studio/clientes/duplicados");

  return {
    ok: true,
    survivorMarkbox: res.survivor_markbox,
    retiredMarkbox: res.retired_markbox,
    filled: res.filled ?? [],
    access: res.access,
    needsReview: {
      conversationsArchived: res.needs_review?.conversations_archived ?? 0,
      changeRequestsLeftBehind: res.needs_review?.change_requests_left_behind ?? 0,
    },
  };
}
