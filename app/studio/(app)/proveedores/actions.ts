/**
 * Server actions del módulo Proveedores · Prealertas (SDD-0098, PORT-1).
 *
 * El módulo era solo-lectura; acá se agrega la ÚNICA acción que el asesor
 * necesita para ATENDER una solicitud de servicio de recepción que el cliente
 * pidió desde su portal: cambiar su estado y cargar el monto cotizado (advisory).
 *
 * Patrón del Studio: "use server" + parsing/validación manual (NO Zod) + guard
 * de edición (moduleEditDenial "suppliers") + revalidatePath. La RLS
 * "psr tenant update" (migr 0150) scopea el UPDATE al tenant del operador —
 * el `.eq("id")` no puede tocar filas de otro tenant (sin IDOR).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  PSR_STATUSES,
  type PrealertaServiceRequestStatus,
} from "@/lib/studio/prealertas/addons";

export type ServiceRequestManageState = { ok?: boolean; error?: string };

/** Estados en los que la solicitud se considera resuelta (sella processed_*). */
const RESOLVED: ReadonlySet<PrealertaServiceRequestStatus> = new Set([
  "atendida",
  "descartada",
  "invalida",
]);

/**
 * Actualiza UNA solicitud de servicio: nuevo estado + monto cotizado opcional.
 * Sella `processed_by`/`processed_at` cuando pasa a un estado resuelto y los
 * limpia si vuelve a solicitada/en_proceso. Devuelve error legible (sin filtrar
 * detalles de la DB, patrón apiError del repo).
 */
export async function updateServiceRequestAction(
  _prev: ServiceRequestManageState,
  formData: FormData,
): Promise<ServiceRequestManageState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "suppliers");
  if (denial) return { error: denial };

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const quotedRaw = String(formData.get("quoted_amount_usd") ?? "").trim();

  if (!id) return { error: "Falta la solicitud a actualizar." };
  if (!(PSR_STATUSES as string[]).includes(status)) {
    return { error: "Estado inválido." };
  }
  const nextStatus = status as PrealertaServiceRequestStatus;

  // Monto cotizado (advisory): opcional, ≥ 0, coma o punto decimal.
  let quoted: number | null = null;
  if (quotedRaw) {
    const n = Number(quotedRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      return { error: "El monto cotizado debe ser un número válido (o vacío)." };
    }
    quoted = Math.round(n * 100) / 100;
  }

  const resolved = RESOLVED.has(nextStatus);
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;

  const { error } = await supabase
    .from("prealerta_service_requests")
    .update({
      status: nextStatus,
      quoted_amount_usd: quoted,
      processed_by: resolved ? uid : null,
      processed_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { error: "No se pudo actualizar la solicitud." };

  revalidatePath("/studio/proveedores");
  return { ok: true };
}

// ── Link público del proveedor · activar/desactivar (SDD-0096 · PORT-4) ─────

export type ShareLinkState = { ok?: boolean; error?: string; active?: boolean };

/**
 * Activa o desactiva el link público del proveedor de UNA prealerta (revocar /
 * reactivar). Va por la RPC estrecha `set_prealerta_share_active` (SECURITY
 * DEFINER, scoped al tenant) — el equipo no tiene UPDATE directo sobre prealertas.
 * Defensivo: si la migr 0225 no está aplicada, la RPC no existe → error legible.
 */
export async function setPrealertaShareActiveAction(
  _prev: ShareLinkState,
  formData: FormData,
): Promise<ShareLinkState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "suppliers");
  if (denial) return { error: denial };

  const prealertaId = String(formData.get("prealerta_id") ?? "").trim();
  const active = String(formData.get("active") ?? "").trim() === "true";
  if (!prealertaId) return { error: "Falta la compra." };

  const { data, error } = await supabase.rpc("set_prealerta_share_active", {
    p_prealerta_id: prealertaId,
    p_active: active,
  });

  if (error) {
    return {
      error: active
        ? "No se pudo reactivar el link."
        : "No se pudo desactivar el link.",
    };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true, active: Boolean(data) };
}
