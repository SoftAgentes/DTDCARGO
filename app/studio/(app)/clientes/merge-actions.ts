"use server";

/**
 * Fusión de dos fichas del mismo cliente (SDD-0246) y fusión manual (SDD-0712).
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
import { getStudioRole, moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import {
  confirmacionCoincide,
  errorDeMotivo,
  parsePreview,
  parseSearchRows,
  rolPuedeFusionar,
  type MergePreview,
  type MergeSearchHit,
} from "@/lib/studio/client-merge-manual";

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

export async function searchClientsForMergeAction(
  q: string,
): Promise<{ hits: MergeSearchHit[]; error?: string }> {
  const supabase = await createClient();
  // Solo lee: candado de VISTA al tope (rol, permisos por usuario y alcance).
  const denial = await moduleViewDenial(supabase, "clients");
  if (denial) return { hits: [], error: denial };
  const term = (q ?? "").trim();
  if (term.length < 2) return { hits: [] };

  const { data, error } = await supabase.rpc("client_search_for_merge", { p_q: term });
  if (error) {
    console.error("[searchClientsForMergeAction]", error.code ?? "sin código");
    return { hits: [], error: "No se pudo completar la búsqueda." };
  }
  return { hits: parseSearchRows(data) };
}

export async function previewMergeAction(
  survivorId: string,
  mergedId: string,
): Promise<{ preview?: MergePreview; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "clients");
  if (denial) return { error: denial };
  if (!survivorId || !mergedId) return { error: "Faltan las dos fichas." };
  if (survivorId === mergedId) return { error: "Elige dos fichas distintas." };

  const { data, error } = await supabase.rpc("client_merge_preview", {
    p_survivor_id: survivorId,
    p_merged_id: mergedId,
  });
  if (error) {
    console.error("[previewMergeAction]", error.code ?? "sin código");
    return { error: "No se pudo armar la vista previa. Revisa que las dos fichas sigan activas." };
  }
  const preview = parsePreview(data);
  if (!preview) return { error: "La vista previa llegó incompleta. Vuelve a intentar." };
  return { preview };
}

/**
 * Fusiona con motivo y confirmación escrita. Sirve para los pares detectados y
 * para los elegidos a mano: en los dos casos hay que escribir el Shipping Mark
 * que se anula y dejar el motivo (queda en auditoría).
 */
export async function mergeClientsManualAction(input: {
  survivorId: string;
  mergedId: string;
  reason: string;
  confirmMarkbox: string;
  /** Shipping Mark que la pantalla mostró como el que se anula (doble comprobación). */
  retiredMarkbox: string;
}): Promise<MergeResult> {
  const { survivorId, mergedId, reason, confirmMarkbox, retiredMarkbox } = input;
  if (!survivorId || !mergedId) return { error: "Faltan las dos fichas para fusionar." };
  if (survivorId === mergedId) return { error: "Elige dos fichas distintas." };
  const motivo = errorDeMotivo(reason);
  if (motivo) return { error: motivo };
  if (!confirmacionCoincide(confirmMarkbox, retiredMarkbox)) {
    return { error: "Escribe el Shipping Mark que se anula para confirmar." };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };
  // Sam, 2026-11-23: fusionan Admin, Operaciones y Comercial. La RPC lo exige igual.
  if (!rolPuedeFusionar(await getStudioRole(supabase))) {
    return { error: "Solo administración, operaciones y comercial pueden fusionar clientes." };
  }

  const { data, error } = await supabase.rpc("merge_clients_manual", {
    p_survivor_id: survivorId,
    p_merged_id: mergedId,
    p_reason: reason.trim(),
    p_confirm_markbox: confirmMarkbox.trim(),
  });

  if (error) {
    // Los mensajes de la RPC ya vienen en español y son informativos; el resto
    // (violaciones de índice, etc.) no se le muestran crudos al operador.
    const conocido =
      error.message.includes("fusionar") ||
      error.message.includes("fusionada") ||
      error.message.includes("eliminada") ||
      error.message.includes("eliminado") ||
      error.message.includes("No existe") ||
      error.message.includes("aliado") ||
      error.message.startsWith("audit: reason");
    // Solo el código: el mensaje de la RPC puede llevar el Shipping Mark.
    console.error("[mergeClientsManualAction]", error.code ?? "sin código");
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
