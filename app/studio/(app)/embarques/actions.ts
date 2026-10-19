/**
 * Server actions de Embarques (SDD-0522 · SDD-0560).
 *
 * - deleteShipmentsAction: elimina de 1 a 100 embarques con motivo, todo o nada,
 *   por la RPC `soft_delete_shipments_with_audit_reason` (migr 0476). Sólo
 *   admin: lo exige la capability y, por su cuenta, la base.
 * - leerPlanDeBorradoAction: el plan del asistente de borrado de UN embarque
 *   (SDD-0560): qué depende de él y en qué orden se resuelve.
 * - ejecutarPasoDeBorradoAction: ejecuta el paso SIGUIENTE del plan con la
 *   acción gobernada del módulo dueño (anular factura, gasto o CxP, eliminar un
 *   borrador o, al final, el embarque). Antes de actuar recalcula el plan en el
 *   servidor: si alguien cambió algo, no ejecuta y devuelve el plan nuevo.
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
  shipmentDeleteBlockReason,
  type ResultadoAccionEmbarques,
} from "@/lib/studio/borrado/reglas";
import { RUTAS_EMBARQUES, eliminarEmbarques } from "@/lib/studio/borrado/servidor";
import { MENSAJE_PLAN, type PasoAsistente, type PlanBorrado } from "@/lib/studio/borrado/asistente";
import { leerPlanDeBorrado } from "@/lib/studio/borrado/asistente-servidor";
import { softDeleteInvoice, voidInvoice } from "../facturacion/actions";
import { voidExpenseAction } from "../gastos/actions";
import { voidBill } from "../tesoreria/actions";

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

// ─── SDD-0560 · Asistente de borrado ─────────────────────────────────────────

export type ResultadoPlanDeBorrado = { ok: true; plan: PlanBorrado } | { ok: false; error: string };

export type ResultadoPasoDeBorrado =
  | {
      ok: true;
      /** Lo que se hizo: «Factura F-2026-0007 anulada.». */
      hecho: string;
      /** Algo que conviene saber aunque el paso salió bien (lo dice el módulo). */
      aviso?: string;
      /** `true` si el paso fue eliminar el embarque: ya no hay plan. */
      eliminado: boolean;
      plan: PlanBorrado | null;
    }
  | { ok: false; error: string; plan: PlanBorrado | null };

const EMBARQUE_INVALIDO = "Este embarque no es válido. Recarga la página.";
const PASO_FALLO = "No se pudo completar el paso. No cambió nada; intenta de nuevo.";

/** El id de un embarque, validado como uuid; `null` si no lo es. */
function idDeEmbarque(raw: unknown): string | null {
  const lote = normalizarLote([raw]);
  return lote.ok && lote.ids.length === 1 ? lote.ids[0] : null;
}

/** Por qué un plan sin pasos no deja seguir. */
function mensajeSinPasos(plan: PlanBorrado): string {
  return plan.estado === "en_curso" ? MENSAJE_PLAN.cambio : MENSAJE_PLAN[plan.estado];
}

function revalidarEmbarque(shipmentId: string) {
  for (const ruta of RUTAS_EMBARQUES) revalidatePath(ruta);
  revalidatePath(`/studio/tracking/${shipmentId}`);
}

/**
 * El plan del asistente para un embarque. Sólo admin (`delete_shipments`); la
 * RPC de la 0476 repite el candado por su cuenta.
 */
export async function leerPlanDeBorradoAction(shipmentId: string): Promise<ResultadoPlanDeBorrado> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "delete_shipments");
  if (denial) return { ok: false, error: denial };

  const id = idDeEmbarque(shipmentId);
  if (!id) return { ok: false, error: EMBARQUE_INVALIDO };
  return { ok: true, plan: await leerPlanDeBorrado(supabase, id) };
}

type Ejecucion = { ok: true; aviso?: string } | { ok: false; error: string };

/**
 * El paso, con la acción de SU módulo. Cada una repite su propio candado y su
 * propia validación de estado, y deja su evento de auditoría en la base:
 * `invoice_deleted`, `invoice_voided`, `expense_voided`, `bill_voided` o
 * `shipment_deleted`.
 */
async function ejecutarAccion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paso: PasoAsistente,
  motivo: string,
): Promise<Ejecucion> {
  switch (paso.accion) {
    case "eliminar_borrador_factura": {
      const r = await softDeleteInvoice(paso.objetivoId);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? PASO_FALLO };
    }
    case "anular_factura": {
      const r = await voidInvoice(paso.objetivoId, motivo);
      return r.ok ? { ok: true, aviso: r.warning } : { ok: false, error: r.error ?? PASO_FALLO };
    }
    case "anular_gasto": {
      // La referencia es estable por gasto: un gasto se anula una sola vez, y
      // la RPC (0340) reconoce el reintento de la misma anulación.
      const r = await voidExpenseAction(paso.objetivoId, motivo, `asistente-borrado:${paso.objetivoId}`);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? PASO_FALLO };
    }
    case "anular_cxp": {
      const r = await voidBill(paso.objetivoId, motivo);
      return r.ok ? { ok: true } : { ok: false, error: r.error ?? PASO_FALLO };
    }
    case "eliminar_embarque": {
      const r = await eliminarEmbarques(supabase, [paso.objetivoId], motivo);
      if (r.estado === "eliminado") return { ok: true };
      if (r.estado === "rechazado") {
        const fila = r.bloqueadas[0];
        return {
          ok: false,
          error: fila
            ? (shipmentDeleteBlockReason({ bloqueos: fila.bloqueos, avisos: {} }) ?? PASO_FALLO)
            : MENSAJE_PLAN.no_encontrado,
        };
      }
      const mensaje = mensajeResultadoEmbarques(r);
      return { ok: false, error: "error" in mensaje ? mensaje.error : PASO_FALLO };
    }
  }
}

/**
 * Ejecuta el paso `clave` del plan de `shipmentId`, SÓLO si es el siguiente del
 * plan recalculado ahora en el servidor. Si el plan cambió (otra persona
 * resolvió o agregó algo), no ejecuta nada y devuelve el plan nuevo.
 */
export async function ejecutarPasoDeBorradoAction(
  shipmentId: string,
  clave: string,
  motivo: string,
): Promise<ResultadoPasoDeBorrado> {
  const supabase = await createClient();
  const denial = await capabilityDenial(supabase, "delete_shipments");
  if (denial) return { ok: false, error: denial, plan: null };

  const id = idDeEmbarque(shipmentId);
  if (!id || typeof clave !== "string") return { ok: false, error: EMBARQUE_INVALIDO, plan: null };

  // El plan se recalcula ANTES de actuar: lo que vio la pantalla puede ser viejo.
  const plan = await leerPlanDeBorrado(supabase, id);
  if (plan.estado !== "en_curso") return { ok: false, error: mensajeSinPasos(plan), plan };
  const paso = plan.siguiente;
  if (paso.clave !== clave) return { ok: false, error: MENSAJE_PLAN.cambio, plan };
  if (paso.tipo !== "asistente") return { ok: false, error: MENSAJE_PLAN.en_modulo, plan };

  let motivoValido = "";
  if (paso.pideMotivo) {
    const m = validateAuditReason(motivo);
    if (!m.ok) return { ok: false, error: m.error, plan };
    motivoValido = m.reason;
  }

  const r = await ejecutarAccion(supabase, paso, motivoValido);
  if (!r.ok) {
    // Pudo cambiar algo (o nada): se devuelve el plan como quedó.
    return { ok: false, error: r.error, plan: await leerPlanDeBorrado(supabase, id) };
  }

  revalidarEmbarque(id);
  if (paso.accion === "eliminar_embarque") return { ok: true, hecho: paso.hecho, eliminado: true, plan: null };
  return {
    ok: true,
    hecho: paso.hecho,
    ...(r.aviso ? { aviso: r.aviso } : {}),
    eliminado: false,
    plan: await leerPlanDeBorrado(supabase, id),
  };
}
