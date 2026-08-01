/**
 * Server actions del módulo Despacho (SDD-0029 · Fase 1).
 *
 * - createDispatchOrderAction: crea OD `creada` + snapshot capacity + inserta packages junction
 * - cancelDispatchOrderAction: status=cancelada con motivo obligatorio
 * - assignTruckDriverAction: re-asigna camión/chofer (solo creada/cargando)
 * - closeDispatchOrderAction: entregada → cerrada (terminal)
 *
 * Las transiciones cargando/lista/en_ruta/entregada llegan con SDD-0030
 * (apps móviles bodeguero + camionero).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  cancelDispatchOrderGoverned,
  getTruckCapacity,
} from "@/lib/studio/dispatch-queries";
import {
  validateAssignTruckDriverInput,
  validateCancelDispatchOrderInput,
  validateCreateDispatchOrderInput,
  type AssignTruckDriverInput,
  type CancelDispatchOrderInput,
  type CreateDispatchOrderInput,
  type DispatchActionState,
  type DispatchHub,
  type DispatchPackageKind,
  type DispatchSplitReason,
} from "@/lib/studio/dispatch-types";

// ─────────────────────────────────────────────────────────────
// FormData helpers
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parsePackagesPayload(v: FormDataEntryValue | null): CreateDispatchOrderInput["packages"] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p: unknown) => {
        const o = p as Record<string, unknown>;
        return {
          package_kind: (o.package_kind as DispatchPackageKind) ?? "warehouse_receipt_cn",
          package_id: String(o.package_id ?? ""),
          boxes_shipped: Number(o.boxes_shipped ?? 0),
          split_reason: (o.split_reason as DispatchSplitReason) ?? null,
          split_reason_text: o.split_reason_text ? String(o.split_reason_text) : null,
        };
      })
      .filter((p) => p.package_id);
  } catch {
    return [];
  }
}

async function resolveTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

// ─────────────────────────────────────────────────────────────
// createDispatchOrder
// ─────────────────────────────────────────────────────────────

export async function createDispatchOrderAction(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "despacho");
  if (denial) return { error: denial };


  const partial: Partial<CreateDispatchOrderInput> = {
    hub: (parseStringOrNull(formData.get("hub")) as DispatchHub) ?? undefined,
    route_id: parseStringOrNull(formData.get("route_id")) ?? undefined,
    truck_id: parseStringOrNull(formData.get("truck_id")) ?? undefined,
    driver_id: parseStringOrNull(formData.get("driver_id")) ?? undefined,
    packages: parsePackagesPayload(formData.get("packages")),
  };

  const { input, fieldErrors } = validateCreateDispatchOrderInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId();
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Capacity snapshot
  const capacity = await getTruckCapacity(supabase, input!.truck_id);
  if (!capacity) return { error: "Camión no encontrado o sin capacidad declarada." };

  // Generar order_code via RPC
  const { data: codeRaw, error: codeErr } = await supabase.rpc("next_dispatch_order_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeRaw) {
    return { error: `No se pudo generar order_code: ${codeErr?.message ?? "sin código"}` };
  }
  const orderCode = String(codeRaw);

  // Traer info de los packages desde warehouse_receipts_cn
  const cnIds = input!.packages
    .filter((p) => p.package_kind === "warehouse_receipt_cn")
    .map((p) => p.package_id);

  const { data: receipts, error: rcptErr } = await supabase
    .from("warehouse_receipts_cn")
    .select(
      "id, markbox, client_name, destination_city, payment_status, description, boxes, weight_kg, cbm, hs_code, aes_code",
    )
    .in("id", cnIds);

  if (rcptErr) return { error: `Error leyendo paquetes: ${rcptErr.message}` };

  type Receipt = {
    id: string;
    markbox: string;
    client_name: string | null;
    destination_city: string | null;
    payment_status: "pagado" | "parcial" | "pendiente" | null;
    description: string | null;
    boxes: number | null;
    weight_kg: number | null;
    cbm: number | null;
    hs_code: string | null;
    aes_code: string | null;
  };
  const rcptMap = new Map<string, Receipt>(((receipts as Receipt[] | null) ?? []).map((r) => [r.id, r]));

  // Computar totals + cities ordenadas
  let total_kg = 0;
  let total_cbm = 0;
  const citySet = new Set<string>();
  const junctionRows: Array<{
    od_id?: string; // se inyecta después
    package_kind: DispatchPackageKind;
    package_id: string;
    markbox: string;
    client_name: string;
    city: string;
    pay: "pagado" | "parcial" | "pendiente";
    description: string | null;
    boxes_total: number;
    boxes_shipped: number;
    weight_kg: number;
    cbm: number;
    hs_code: string | null;
    aes_code: string | null;
    split_reason: DispatchSplitReason | null;
    split_reason_text: string | null;
  }> = [];

  for (const p of input!.packages) {
    const r = rcptMap.get(p.package_id);
    if (!r) continue;
    const boxes_total = r.boxes ?? 1;
    const shipped = Math.min(p.boxes_shipped, boxes_total);
    const ratio = shipped / boxes_total;
    total_kg += Number(r.weight_kg ?? 0) * ratio;
    total_cbm += Number(r.cbm ?? 0) * ratio;
    if (r.destination_city) citySet.add(r.destination_city);

    junctionRows.push({
      package_kind: "warehouse_receipt_cn",
      package_id: p.package_id,
      markbox: r.markbox,
      client_name: r.client_name ?? "—",
      city: r.destination_city ?? "—",
      pay: r.payment_status ?? "pendiente",
      description: r.description,
      boxes_total,
      boxes_shipped: shipped,
      weight_kg: Number(r.weight_kg ?? 0),
      cbm: Number(r.cbm ?? 0),
      hs_code: r.hs_code,
      aes_code: r.aes_code,
      split_reason: p.split_reason,
      split_reason_text: p.split_reason_text,
    });
  }

  if (junctionRows.length === 0) {
    return { error: "No se encontró ningún paquete válido." };
  }

  // Capacity check final
  const kgPct = (total_kg / capacity.capacity_kg) * 100;
  const cbmPct = (total_cbm / capacity.capacity_cbm) * 100;
  if (kgPct > 100 || cbmPct > 100) {
    return {
      error: `Excede capacidad del camión: ${kgPct.toFixed(0)}% kg · ${cbmPct.toFixed(0)}% cbm.`,
    };
  }

  // Insert OD
  const { data: odCreated, error: odErr } = await supabase
    .from("dispatch_orders")
    .insert({
      tenant_id: tenantId,
      order_code: orderCode,
      status: "creada",
      hub: input!.hub,
      route_id: input!.route_id,
      truck_id: input!.truck_id,
      driver_id: input!.driver_id,
      capacity_kg_snapshot: capacity.capacity_kg,
      capacity_cbm_snapshot: capacity.capacity_cbm,
      total_kg: Math.round(total_kg * 100) / 100,
      total_cbm: Math.round(total_cbm * 100) / 100,
      package_count: junctionRows.length,
      cities_ordered: Array.from(citySet),
    })
    .select("id, order_code")
    .single<{ id: string; order_code: string }>();

  if (odErr || !odCreated) {
    return { error: `No se pudo crear la OD: ${odErr?.message}` };
  }

  // Insert junction rows
  const junctionPayload = junctionRows.map((r) => ({ ...r, od_id: odCreated.id }));
  const { error: jErr } = await supabase.from("dispatch_order_packages").insert(junctionPayload);
  if (jErr) {
    // Rollback: borrar la OD
    await supabase.from("dispatch_orders").delete().eq("id", odCreated.id);
    return { error: `No se pudieron insertar paquetes: ${jErr.message}` };
  }

  revalidatePath("/studio/despacho");
  revalidatePath("/studio/despacho/dashboard");
  return { ok: true, createdId: odCreated.id, createdCode: odCreated.order_code };
}

// ─────────────────────────────────────────────────────────────
// cancelDispatchOrder
// ─────────────────────────────────────────────────────────────

export async function cancelDispatchOrderAction(
  raw: {
    orderId?: string;
    from?: CancelDispatchOrderInput["from"];
    reason?: string;
    requestRef?: string;
  },
): Promise<DispatchActionState & { replayed?: boolean }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "despacho");
  if (denial) return { error: denial };

  const partial: Partial<CancelDispatchOrderInput> = {
    od_id: raw.orderId,
    from: raw.from,
    reason: raw.reason,
    request_ref: raw.requestRef,
  };

  const { input, fieldErrors } = validateCancelDispatchOrderInput(partial);
  if (fieldErrors) return { fieldErrors };

  try {
    const result = await cancelDispatchOrderGoverned(supabase, {
      orderId: input!.od_id,
      expectedStatus: input!.from,
      reason: input!.reason,
      requestRef: input!.request_ref,
    });
    revalidatePath("/studio/despacho");
    revalidatePath("/studio/despacho/dashboard");
    return { ok: true, replayed: result === "replayed" };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "42501") return { error: "No tienes permiso para cancelar esta OD." };
    if (code === "40001") {
      return { error: "La OD cambió de estado. Actualiza antes de reintentar." };
    }
    if (code === "P0002") return { error: "La OD ya no está disponible." };
    return {
      error: `No se pudo cancelar la OD. Referencia: ${input!.request_ref}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// assignTruckDriver
// ─────────────────────────────────────────────────────────────

export async function assignTruckDriverAction(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "despacho");
  if (denial) return { error: denial };


  const partial: Partial<AssignTruckDriverInput> = {
    od_id: parseStringOrNull(formData.get("od_id")) ?? undefined,
    truck_id: parseStringOrNull(formData.get("truck_id")),
    driver_id: parseStringOrNull(formData.get("driver_id")),
  };

  const { input, fieldErrors } = validateAssignTruckDriverInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Validar que la OD esté en estado editable
  const { data: od, error: getErr } = await supabase
    .from("dispatch_orders")
    .select("id, status")
    .eq("id", input!.od_id)
    .maybeSingle<{ id: string; status: string }>();

  if (getErr || !od) return { error: "OD no encontrada." };
  if (od.status !== "creada" && od.status !== "cargando") {
    return { error: `No se puede reasignar en estado "${od.status}".` };
  }

  const patch: Record<string, unknown> = {
    reassigned_at: new Date().toISOString(),
  };
  if (input!.truck_id) patch.truck_id = input!.truck_id;
  if (input!.driver_id) patch.driver_id = input!.driver_id;

  // Si cambió truck, actualizar capacity snapshot
  if (input!.truck_id) {
    const cap = await getTruckCapacity(supabase, input!.truck_id);
    if (cap) {
      patch.capacity_kg_snapshot = cap.capacity_kg;
      patch.capacity_cbm_snapshot = cap.capacity_cbm;
    }
  }

  const { error } = await supabase
    .from("dispatch_orders")
    .update(patch)
    .eq("id", input!.od_id);

  if (error) return { error: `No se pudo reasignar: ${error.message}` };

  revalidatePath("/studio/despacho");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// closeDispatchOrder (entregada → cerrada)
// ─────────────────────────────────────────────────────────────

export async function closeDispatchOrderAction(
  _prev: DispatchActionState,
  formData: FormData,
): Promise<DispatchActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "despacho");
  if (denial) return { error: denial };

  const od_id = parseStringOrNull(formData.get("od_id"));
  if (!od_id) return { fieldErrors: { od_id: "Falta el ID de la OD." } };

  const { error } = await supabase
    .from("dispatch_orders")
    .update({ status: "cerrada" })
    .eq("id", od_id);

  if (error) return { error: `No se pudo cerrar: ${error.message}` };

  revalidatePath("/studio/despacho");
  return { ok: true };
}
