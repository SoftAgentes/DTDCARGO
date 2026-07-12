/**
 * Server actions del módulo Proveedores · Prealertas (SDD-0098, PORT-1).
 *
 * Además de ATENDER solicitudes de servicio y gestionar el link público, el
 * módulo ahora permite al operador dar de alta / editar un proveedor CN a
 * nombre de un cliente (2026-07-12, revierte el "cero writes" de SDD-0057
 * Slice C — pedido explícito del founder).
 *
 * Patrón del Studio: parsing/validación manual (NO Zod) + guard de edición
 * (moduleEditDenial "suppliers") + revalidatePath. El UPDATE de solicitudes
 * de servicio pasa por la RLS "psr tenant update" (migr 0150); el alta/edición
 * de suppliers_cn pasa por las policies "suppliers_cn tenant insert/update"
 * (migr 0229, aplicada a prod 2026-07-12).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  PSR_STATUSES,
  type PrealertaServiceRequestStatus,
} from "@/lib/studio/prealertas/addons";
import {
  validateSupplierInput,
  type SupplierInput,
} from "@/lib/studio/prealertas/types";

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

// ╔═══════════════════════════════════════════════════════════╗
// ║ Alta / edición de proveedor CN por el operador (Studio)   ║
// ╚═══════════════════════════════════════════════════════════╝
// El operador registra/edita el proveedor A NOMBRE de un cliente (útil
// cuando atiende por teléfono o whatsapp) — el cliente lo revisa después
// desde su portal, es la MISMA fila (suppliers_cn), no una copia. Usa el
// cliente de SESIÓN (no admin): pasa por las RLS "suppliers_cn tenant
// insert/update" (migr 0229). Si esa migración no está aplicada, el insert/
// update devuelve el permission-denied de Postgres y acá lo traducimos a un
// mensaje legible (no rompe la UI mientras tanto).

export type StudioSupplierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierInput, string>>;
  supplierId?: string;
};

/** tenant_id del operador logueado (primer membership activo). */
async function resolveOperatorTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

/** Mensaje legible si el insert/update choca con una RLS sin la policy de escritura del operador (migr 0229 pendiente). */
function friendlySupplierWriteError(error: { code?: string; message?: string }): string {
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "El alta de proveedores desde el Studio necesita una migración de base de datos que todavía no se aplicó a producción. Avísale al equipo técnico.";
  }
  return "No se pudo guardar el proveedor. Prueba de nuevo.";
}

/**
 * Crea un proveedor CN a nombre de un cliente (elegido por su MARKBOX). Valida
 * que el cliente exista en el tenant del operador (defensa en profundidad,
 * más allá de la RLS) y arma el supplier_seq con la MISMA RPC que usa el
 * portal (next_supplier_seq ya resuelve el tenant también para el operador).
 */
export async function createStudioSupplierAction(input: {
  clientMarkbox: string;
  name: string;
  city: string | null;
  wechat: string | null;
  contact: string | null;
  notes: string | null;
}): Promise<StudioSupplierActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "suppliers");
  if (denial) return { error: denial };

  const clientMarkbox = input.clientMarkbox.trim();
  if (!clientMarkbox) {
    return { error: "Elige el cliente dueño de este proveedor." };
  }

  const { input: validated, fieldErrors } = validateSupplierInput(input);
  if (fieldErrors) return { fieldErrors };
  if (!validated) return { error: "Datos inválidos." };

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  // El cliente debe existir en ESTE tenant (evita crear proveedores colgados
  // de un MARKBOX inexistente o de otro tenant).
  const { data: clientRow } = await supabase
    .from("clients")
    .select("markbox")
    .eq("tenant_id", tenantId)
    .eq("markbox", clientMarkbox)
    .is("deleted_at", null)
    .maybeSingle<{ markbox: string }>();
  if (!clientRow) {
    return { error: "Ese cliente no existe en tu tenant." };
  }

  const { data: seqData, error: seqErr } = await supabase.rpc(
    "next_supplier_seq",
    { p_client_markbox: clientMarkbox },
  );
  if (seqErr || seqData == null) {
    return { error: "No pudimos generar el número del proveedor." };
  }

  const { data: row, error: insErr } = await supabase
    .from("suppliers_cn")
    .insert({
      tenant_id: tenantId,
      client_markbox: clientMarkbox,
      supplier_seq: Number(seqData),
      name: validated.name,
      city: validated.city,
      wechat: validated.wechat,
      contact: validated.contact,
      notes: validated.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (insErr || !row) {
    console.error("[createStudioSupplierAction] insert error:", insErr);
    return { error: friendlySupplierWriteError(insErr ?? {}) };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true, supplierId: row.id };
}

/**
 * Edita un proveedor CN existente (cualquier proveedor del tenant — el
 * operador puede corregir datos cargados por el cliente o por otro operador).
 * `tenant_id` defensivo en el UPDATE, además del scope de RLS.
 */
export async function updateStudioSupplierAction(
  supplierId: string,
  input: {
    name: string;
    city: string | null;
    wechat: string | null;
    contact: string | null;
    notes: string | null;
  },
): Promise<StudioSupplierActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, "suppliers");
  if (denial) return { error: denial };

  const id = supplierId.trim();
  if (!id) return { error: "Falta el proveedor a editar." };

  const { input: validated, fieldErrors } = validateSupplierInput(input);
  if (fieldErrors) return { fieldErrors };
  if (!validated) return { error: "Datos inválidos." };

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  const { error: updErr } = await supabase
    .from("suppliers_cn")
    .update({
      name: validated.name,
      city: validated.city,
      wechat: validated.wechat,
      contact: validated.contact,
      notes: validated.notes,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (updErr) {
    console.error("[updateStudioSupplierAction] update error:", updErr);
    return { error: friendlySupplierWriteError(updErr) };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true, supplierId: id };
}
