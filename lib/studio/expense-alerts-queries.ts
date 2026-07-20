/**
 * Queries + helpers de mutación del módulo Expense Alerts (SDD-0039 · B.8).
 *
 * Lecturas (count/list) → usar el cliente RLS (el equipo CN / accounting
 * tiene SELECT por la policy de 0075).
 *
 * Side-effects de sistema (crear shipment contenedor, crear/cerrar alerta
 * al consolidar/revertir) → usar el admin client con tenant_id explícito.
 * El warehouse+cn que consolida puede no tener INSERT en `shipments` por
 * RLS; estos son efectos del sistema, no filas autoradas por el user.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveAlertRow } from "./expense-alerts-types";

// ─────────────────────────────────────────────────────────────
// Lecturas (cliente RLS)
// ─────────────────────────────────────────────────────────────

/** Cantidad de alertas activas del tenant (badge sidebar). */
export async function countActiveAlerts(
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from("expense_alerts")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  return count ?? 0;
}

type ActiveAlertRaw = {
  id: string;
  shipment_id: string;
  created_at: string;
  shipments:
    | { code: string | null; destination: string | null }
    | { code: string | null; destination: string | null }[]
    | null;
};

/** Alertas activas + contenedor asociado (banner / filtro). */
export async function listActiveAlerts(
  supabase: SupabaseClient,
): Promise<ActiveAlertRow[]> {
  const { data, error } = await supabase
    .from("expense_alerts")
    .select("id, shipment_id, created_at, shipments(code, destination)")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as ActiveAlertRaw[]).map((r) => {
    const ship = Array.isArray(r.shipments) ? r.shipments[0] : r.shipments;
    return {
      id: r.id,
      shipment_id: r.shipment_id,
      shipment_code: ship?.code ?? null,
      destination: ship?.destination ?? null,
      created_at: r.created_at,
    };
  });
}

/** Set de shipment_ids con alerta activa (chip en filas de Almacén CN). */
export async function activeAlertShipmentIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("expense_alerts")
    .select("shipment_id")
    .is("resolved_at", null);
  if (error || !data) return new Set();
  return new Set((data as { shipment_id: string }[]).map((r) => r.shipment_id));
}

// ─────────────────────────────────────────────────────────────
// Side-effects de sistema (admin client + tenant_id explícito)
// ─────────────────────────────────────────────────────────────

/**
 * Busca un contenedor (shipment service=consolidado_lcl, status=consolidating)
 * abierto para ese destino, o crea uno nuevo. Devuelve el shipment_id.
 *
 * Grain: 1 contenedor por (tenant, destino) mientras siga en
 * 'consolidating'. Las recepciones del mismo destino se agrupan ahí hasta
 * que Logística lo avance (Part C). V1: low volume, reversible por admin.
 */
export async function findOrCreateConsolidationShipment(
  admin: SupabaseClient,
  opts: { tenantId: string; destination: string },
): Promise<
  | { shipmentId: string; code: string; created: boolean }
  | { error: string }
> {
  const dest = opts.destination.trim();

  const { data: open } = await admin
    .from("shipments")
    .select("id, code")
    .eq("tenant_id", opts.tenantId)
    .eq("shipment_service", "consolidado_lcl")
    .eq("status", "consolidating")
    .eq("destination", dest)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; code: string }>();
  if (open) return { shipmentId: open.id, code: open.code, created: false };

  const { data: codeRaw, error: codeErr } = await admin.rpc(
    "next_consolidation_code",
    { p_tenant_id: opts.tenantId },
  );
  if (codeErr || !codeRaw) {
    return { error: codeErr?.message ?? "No se pudo generar el código del contenedor." };
  }
  const code = String(codeRaw);

  const { data: created, error: insErr } = await admin
    .from("shipments")
    .insert({
      tenant_id: opts.tenantId,
      code,
      shipment_service: "consolidado_lcl",
      status: "consolidating",
      origin: "CN",
      destination: dest,
    })
    .select("id")
    .single<{ id: string }>();
  if (insErr || !created) {
    return { error: insErr?.message ?? "No se pudo crear el contenedor." };
  }
  return { shipmentId: created.id, code, created: true };
}

/** Asegura 1 alerta activa para el shipment (idempotente). */
export async function ensureActiveAlert(
  admin: SupabaseClient,
  opts: { tenantId: string; shipmentId: string },
): Promise<{ created: boolean }> {
  const { data: existing } = await admin
    .from("expense_alerts")
    .select("id")
    .eq("shipment_id", opts.shipmentId)
    .is("resolved_at", null)
    .maybeSingle<{ id: string }>();
  if (existing) return { created: false };

  const { error } = await admin.from("expense_alerts").insert({
    tenant_id: opts.tenantId,
    shipment_id: opts.shipmentId,
  });
  // Carrera contra el unique index parcial → no es error funcional.
  return { created: !error };
}

/** Cierra la alerta activa del shipment con razón 'auto' (gasto cargado). */
export async function autoResolveAlertForShipment(
  admin: SupabaseClient,
  shipmentId: string,
): Promise<void> {
  await admin
    .from("expense_alerts")
    .update({
      resolved_at: new Date().toISOString(),
      resolution_reason: "auto",
    })
    .eq("shipment_id", shipmentId)
    .is("resolved_at", null);
}

/**
 * Si el shipment ya no tiene recepciones consolidadas (reversión del
 * operario), cierra su alerta activa con razón 'reverted'.
 */
export async function revertAlertIfShipmentEmpty(
  admin: SupabaseClient,
  shipmentId: string,
): Promise<void> {
  const { count } = await admin
    .from("warehouse_receipts_cn")
    .select("id", { count: "exact", head: true })
    .eq("shipment_id", shipmentId)
    .eq("status", "consolidado")
    .is("deleted_at", null);
  if ((count ?? 0) > 0) return;

  await admin
    .from("expense_alerts")
    .update({
      resolved_at: new Date().toISOString(),
      resolution_reason: "reverted",
    })
    .eq("shipment_id", shipmentId)
    .is("resolved_at", null);
}

/** Cierre manual por la contadora/admin (cliente RLS · user-driven). */
export async function resolveAlertManual(
  supabase: SupabaseClient,
  alertId: string,
  userId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const { error } = await supabase
    .from("expense_alerts")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_reason: "manual",
    })
    .eq("id", alertId)
    .is("resolved_at", null);
  if (error) return { error: error.message };
  return { ok: true };
}
