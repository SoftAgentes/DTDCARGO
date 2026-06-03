/**
 * Queries del módulo Naviera & Consolidación (SDD-0047, Slice A).
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id.
 *
 * `listLooseCargo` es DERIVADO (decisión §4.3): la carga suelta lista para
 * consolidar = embarques `shipment_service='consolidacion'` con recepción CN
 * cerrada (`warehouse_receipts_cn.status='consolidado'`) que aún NO tienen fila
 * en `consolidation_items`. No es una tabla nueva (evita drift con almacén CN).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  containerStats,
  type Booking,
  type Consolidation,
  type ConsolidationItem,
  type ContainerStats,
  type Sailing,
} from "./types";

// ── Coerción + columnas ────────────────────────────────────────

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const SAILING_COLUMNS =
  "id, tenant_id, carrier_id, vessel, voyage, pol, pod, etd, eta, cutoff, transit_days, status, space, notes, created_at, updated_at, deleted_at";

const BOOKING_COLUMNS =
  "id, tenant_id, code, carrier_id, sailing_id, bl_number, container_type, mode, shipper, commodity, status, notes, created_at, updated_at, deleted_at";

const CONSOLIDATION_COLUMNS =
  "id, tenant_id, ref, booking_id, sailing_id, container_type, status, notes, created_at, updated_at, deleted_at";

const ITEM_COLUMNS =
  "id, tenant_id, consolidation_id, shipment_id, client_markbox, client_name, supplier_name, cbm, weight_kg, pieces, created_at";

function coerceSailing(r: Record<string, unknown>): Sailing {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    carrier_id: (r.carrier_id as string | null) ?? null,
    vessel: String(r.vessel ?? ""),
    voyage: (r.voyage as string | null) ?? null,
    pol: String(r.pol ?? ""),
    pod: String(r.pod ?? ""),
    etd: (r.etd as string | null) ?? null,
    eta: (r.eta as string | null) ?? null,
    cutoff: (r.cutoff as string | null) ?? null,
    transit_days: numOrNull(r.transit_days),
    status: (r.status as Sailing["status"]) ?? "abierto",
    space: (r.space as Sailing["space"]) ?? "alta",
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function coerceBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    code: String(r.code),
    carrier_id: (r.carrier_id as string | null) ?? null,
    sailing_id: (r.sailing_id as string | null) ?? null,
    bl_number: (r.bl_number as string | null) ?? null,
    container_type: (r.container_type as string | null) ?? null,
    mode: (r.mode as Booking["mode"]) ?? "LCL",
    shipper: (r.shipper as string | null) ?? null,
    commodity: (r.commodity as string | null) ?? null,
    status: (r.status as Booking["status"]) ?? "abierto",
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function coerceConsolidation(r: Record<string, unknown>): Consolidation {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    ref: String(r.ref),
    booking_id: (r.booking_id as string | null) ?? null,
    sailing_id: (r.sailing_id as string | null) ?? null,
    container_type: (r.container_type as string | null) ?? null,
    status: (r.status as Consolidation["status"]) ?? "consolidando",
    notes: (r.notes as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function coerceItem(r: Record<string, unknown>): ConsolidationItem {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    consolidation_id: String(r.consolidation_id),
    shipment_id: (r.shipment_id as string | null) ?? null,
    client_markbox: (r.client_markbox as string | null) ?? null,
    client_name: (r.client_name as string | null) ?? null,
    supplier_name: (r.supplier_name as string | null) ?? null,
    cbm: num(r.cbm),
    weight_kg: num(r.weight_kg),
    pieces: Math.round(num(r.pieces)),
    created_at: String(r.created_at),
  };
}

// ── Sailings ───────────────────────────────────────────────────

/** Lista los itinerarios (vivos) del tenant; abiertos/cut-off primero, luego por ETD. */
export async function listSailings(
  supabase: SupabaseClient,
  opts: { status?: string } = {},
): Promise<Sailing[]> {
  let query = supabase
    .from("sailings")
    .select(SAILING_COLUMNS)
    .order("etd", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceSailing);
}

// ── Bookings ───────────────────────────────────────────────────

/** Lista las reservas (vivas) del tenant. */
export async function listBookings(
  supabase: SupabaseClient,
  opts: { status?: string; sailingId?: string } = {},
): Promise<Booking[]> {
  let query = supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.sailingId) query = query.eq("sailing_id", opts.sailingId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceBooking);
}

// ── Consolidations ─────────────────────────────────────────────

/** Lista los contenedores de consolidación (vivos) del tenant. */
export async function listConsolidations(
  supabase: SupabaseClient,
  opts: { status?: string } = {},
): Promise<Consolidation[]> {
  let query = supabase
    .from("consolidations")
    .select(CONSOLIDATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceConsolidation,
  );
}

/** Un contenedor con sus items + la utilización ya calculada. null si no existe. */
export type ConsolidationDetail = {
  consolidation: Consolidation;
  items: ConsolidationItem[];
  stats: ContainerStats;
};

/**
 * Lee un contenedor por id con sus items y la utilización (containerStats sobre
 * `container_type`). null si no existe (o RLS lo oculta).
 */
export async function getConsolidation(
  supabase: SupabaseClient,
  id: string,
): Promise<ConsolidationDetail | null> {
  const { data, error } = await supabase
    .from("consolidations")
    .select(CONSOLIDATION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const consolidation = coerceConsolidation(data as Record<string, unknown>);

  const { data: itemRows, error: itemErr } = await supabase
    .from("consolidation_items")
    .select(ITEM_COLUMNS)
    .eq("consolidation_id", id)
    .order("created_at", { ascending: true });
  if (itemErr) throw itemErr;

  const items = ((itemRows as Record<string, unknown>[] | null) ?? []).map(
    coerceItem,
  );

  const stats = containerStats(items, consolidation.container_type);

  return { consolidation, items, stats };
}

// ── Loose cargo (DERIVADO, §4.3) ───────────────────────────────

/** Una pieza de carga suelta candidata a consolidar (derivada de shipments). */
export type LooseCargo = {
  shipment_id: string;
  code: string;
  client_markbox: string | null;
  client_name: string | null;
  cbm: number | null;
  weight_kg: number | null;
};

/**
 * Carga suelta lista para consolidar (DERIVADA, no tabla — decisión §4.3):
 * embarques `shipment_service='consolidacion'` con recepción CN cerrada
 * (`warehouse_receipts_cn.status='consolidado'`) que NO tienen aún fila en
 * `consolidation_items`.
 *
 * Implementación:
 *  1. shipment_ids con recepción CN consolidada (closed).
 *  2. shipment_ids ya asignados a algún contenedor (consolidation_items).
 *  3. shipments consolidacion cuyo id está en (1) y no en (2).
 *
 * RLS filtra cada tabla por tenant. PURA respecto al cliente (sin estado).
 */
export async function listLooseCargo(
  supabase: SupabaseClient,
): Promise<LooseCargo[]> {
  // (1) embarques con recepción CN cerrada (consolidado).
  const { data: receiptRows, error: receiptErr } = await supabase
    .from("warehouse_receipts_cn")
    .select("shipment_id")
    .eq("status", "consolidado")
    .not("shipment_id", "is", null)
    .is("deleted_at", null)
    .limit(5000);
  if (receiptErr) throw receiptErr;

  const closedShipmentIds = Array.from(
    new Set(
      ((receiptRows as Record<string, unknown>[] | null) ?? [])
        .map((r) => (r.shipment_id as string | null) ?? null)
        .filter((v): v is string => !!v),
    ),
  );
  if (closedShipmentIds.length === 0) return [];

  // (2) embarques ya asignados a un contenedor.
  const { data: assignedRows, error: assignedErr } = await supabase
    .from("consolidation_items")
    .select("shipment_id")
    .not("shipment_id", "is", null)
    .limit(5000);
  if (assignedErr) throw assignedErr;

  const assignedIds = new Set(
    ((assignedRows as Record<string, unknown>[] | null) ?? [])
      .map((r) => (r.shipment_id as string | null) ?? null)
      .filter((v): v is string => !!v),
  );

  const candidateIds = closedShipmentIds.filter((id) => !assignedIds.has(id));
  if (candidateIds.length === 0) return [];

  // (3) shipments consolidacion entre los candidatos.
  const { data: shipmentRows, error: shipmentErr } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, client_markbox, weight_kg, volume_m3, shipment_service",
    )
    .eq("shipment_service", "consolidacion")
    .is("deleted_at", null)
    .in("id", candidateIds)
    .limit(5000);
  if (shipmentErr) throw shipmentErr;

  return ((shipmentRows as Record<string, unknown>[] | null) ?? []).map((r) => ({
    shipment_id: String(r.id),
    code: String(r.code ?? ""),
    client_markbox: (r.client_markbox as string | null) ?? null,
    client_name: (r.client_name as string | null) ?? null,
    cbm: numOrNull(r.volume_m3),
    weight_kg: numOrNull(r.weight_kg),
  }));
}
