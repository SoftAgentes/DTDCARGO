"use server";

/**
 * Server actions del bodeguero VE (SDD-0030).
 *
 * - advanceOdAction: creada→cargando o cargando→lista
 * - splitPackageP2Action: fracciona paquete y crea OD P2
 * - signOutAction: borra cookie
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import {
  getCurrentOperario,
  signOutOperario,
} from "@/lib/auth/operario-session";
import {
  validateBodegueroAdvanceInput,
  validateBodegueroSplitInput,
  type BodegueroAdvanceInput,
  type BodegueroSplitInput,
  type MobileActionState,
} from "@/lib/studio/dispatch-mobile-types";
import type {
  DispatchOrderStatus,
  DispatchSplitReason,
} from "@/lib/studio/dispatch-types";

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function requireBodegueroSession() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresá de nuevo." as const };
  if (session.region !== "ve") return { error: "Solo operarios VE." as const };
  if (
    session.role !== "bodeguero" &&
    session.role !== "supervisor" &&
    session.role !== "operario"
  ) {
    return { error: "Tu rol no permite operar la cola de despacho." as const };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// advanceOd
// ─────────────────────────────────────────────────────────────

export async function advanceOdAction(
  _prev: MobileActionState,
  formData: FormData,
): Promise<MobileActionState> {
  const auth = await requireBodegueroSession();
  if ("error" in auth) return { error: auth.error };

  const partial: Partial<BodegueroAdvanceInput> = {
    od_id: parseStringOrNull(formData.get("od_id")) ?? undefined,
    status:
      (parseStringOrNull(formData.get("status")) as
        | BodegueroAdvanceInput["status"]
        | undefined) ?? undefined,
  };
  const { input, fieldErrors } = validateBodegueroAdvanceInput(partial);
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();
  const { error } = await admin.rpc("bodeguero_advance_od", {
    p_operario_id: auth.session.operario_id,
    p_od_id: input!.od_id,
    p_status: input!.status as DispatchOrderStatus,
  });

  if (error) return { error: humanizeRpcError(error.message) };

  revalidatePath("/m/ve/bodeguero");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// splitPackageP2
// ─────────────────────────────────────────────────────────────

export async function splitPackageP2Action(
  _prev: MobileActionState,
  formData: FormData,
): Promise<MobileActionState> {
  const auth = await requireBodegueroSession();
  if ("error" in auth) return { error: auth.error };

  const partial: Partial<BodegueroSplitInput> = {
    od_id: parseStringOrNull(formData.get("od_id")) ?? undefined,
    package_id: parseStringOrNull(formData.get("package_id")) ?? undefined,
    boxes_shipped: Number(formData.get("boxes_shipped") ?? 0),
    split_reason:
      (parseStringOrNull(formData.get("split_reason")) as
        | DispatchSplitReason
        | undefined) ?? undefined,
    split_reason_text: parseStringOrNull(formData.get("split_reason_text")),
  };
  const { input, fieldErrors } = validateBodegueroSplitInput(partial);
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();
  const { data: newOdId, error } = await admin.rpc("bodeguero_split_p2", {
    p_operario_id: auth.session.operario_id,
    p_od_id: input!.od_id,
    p_package_id: input!.package_id,
    p_boxes_shipped: input!.boxes_shipped,
    p_split_reason: input!.split_reason,
    p_split_reason_text: input!.split_reason_text,
  });

  if (error) return { error: humanizeRpcError(error.message) };

  revalidatePath("/m/ve/bodeguero");
  return { ok: true, createdOdId: String(newOdId ?? "") };
}

// ─────────────────────────────────────────────────────────────
// reassignOd · Sprint 2 v3 · operario_action.reassign_od
// ─────────────────────────────────────────────────────────────

export async function reassignOdAction(input: {
  od_id: string;
  truck_id?: string | null;
  driver_id?: string | null;
  reason?: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireBodegueroSession();
  if ("error" in auth) return { error: auth.error };

  if (!input.od_id) return { error: "Falta od_id." };
  if (!input.truck_id && !input.driver_id) {
    return { error: "Indicá al menos truck o driver para reasignar." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("operario_action", {
    p_operario_id: auth.session.operario_id,
    p_action_type: "reassign_od",
    p_payload: {
      od_id: input.od_id,
      truck_id: input.truck_id ?? null,
      driver_id: input.driver_id ?? null,
      reason: input.reason ?? null,
    },
  });
  if (error) return { error: humanizeReassignError(error.message) };

  revalidatePath("/m/ve/bodeguero");
  return { ok: true };
}

function humanizeReassignError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios VE pueden reasignar.";
  if (msg.includes("P0004")) return "Tu rol no permite reasignar.";
  if (msg.includes("P0005")) return "OD no encontrada.";
  if (msg.includes("P0006")) return "OD de otro tenant.";
  if (msg.includes("P0110")) return "Falta od_id.";
  if (msg.includes("P0130")) return "Indicá al menos truck o driver.";
  if (msg.includes("P0131")) return "Esta OD ya está en ruta · no se puede reasignar.";
  if (msg.includes("P0132")) return "Truck no encontrado.";
  if (msg.includes("P0133")) return "Truck de otro tenant.";
  if (msg.includes("P0134")) return "Truck no está disponible.";
  if (msg.includes("P0135")) return "Driver no encontrado.";
  if (msg.includes("P0136")) return "Driver de otro tenant.";
  return msg;
}

// ─────────────────────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  await signOutOperario();
  redirect("/m/ve/login");
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function humanizeRpcError(msg: string): string {
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios VE pueden operar.";
  if (msg.includes("P0004")) return "Tu rol no tiene permiso para esta acción.";
  if (msg.includes("P0005")) return "OD no encontrada.";
  if (msg.includes("P0006")) return "Esta OD no pertenece a tu tenant.";
  if (msg.includes("P0007")) return "Transición de status no permitida.";
  if (msg.includes("P0008")) return "Paquete no encontrado en la OD.";
  if (msg.includes("P0009")) return "Cajas a despachar fuera de rango.";
  return msg;
}
