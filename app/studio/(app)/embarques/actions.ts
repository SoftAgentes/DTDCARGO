/**
 * Server actions de Embarques (SDD-0522).
 *
 * - deleteShipmentsAction: elimina de 1 a 100 embarques con motivo, todo o nada,
 *   por la RPC `soft_delete_shipments_with_audit_reason` (migr 0476). Sólo
 *   admin: lo exige la capability y, por su cuenta, la base.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { capabilityDenial } from "@/lib/studio/rbac-guard";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import {
  MENSAJE_LOTE_EMBARQUES,
  mensajeResultadoEmbarques,
  normalizarLote,
  type ResultadoAccionEmbarques,
} from "@/lib/studio/borrado/reglas";
import { RUTAS_EMBARQUES, eliminarEmbarques } from "@/lib/studio/borrado/servidor";

/**
 * Elimina los embarques elegidos. Antes de tocar la base: permiso, lote y
 * motivo. Después: si la RPC rechaza (bloqueos, ids que no existen) no se borra
 * ninguno y el error dice por qué, con el mismo texto que la casilla.
 */
export async function deleteShipmentsAction(
  ids: string[],
  reason: string,
): Promise<ResultadoAccionEmbarques> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "delete_shipments");
  if (denial) return { error: denial };

  const lote = normalizarLote(ids);
  if (!lote.ok) return { error: MENSAJE_LOTE_EMBARQUES[lote.motivo] };

  const motivo = validateAuditReason(reason);
  if (!motivo.ok) return { error: motivo.error };

  const resultado = await eliminarEmbarques(supabase, lote.ids, motivo.reason);
  // Si se borró o no se sabe cómo quedó, la lista se vuelve a leer: nunca se
  // queda mostrando algo que quizá ya no existe.
  if (resultado.estado === "eliminado" || (resultado.estado === "error" && resultado.tipo === "sin_confirmar")) {
    for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  }
  return mensajeResultadoEmbarques(resultado);
}
