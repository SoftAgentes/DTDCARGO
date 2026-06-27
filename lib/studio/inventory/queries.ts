/**
 * Queries del módulo Inventario / WMS (SDD-0081 · Slice A).
 *
 * Funciones PURAS que reciben un `SupabaseClient`. RLS filtra por `tenant_id`.
 * **100% read-only, sin migración** — todo se DERIVA de tablas que ya existen:
 *
 *   CN (consolidación) → warehouse_receipts_cn  (SDD-0016, migr 0008)
 *                        + consolidations / consolidation_items (SDD-0047, migr 0096)
 *                          para mapear shipment_id → estado del contenedor.
 *   VE (despacho)      → warehouse_receipts_ve + warehouse_receipt_ve_boxes (SDD-0067, migr 0067)
 *
 * El estado de cada partida NO está en una columna: se calcula con las reglas
 * de §6.3 (CN) / §6.4 (VE). Solo CBM/kg — nunca valor en USD (§6.2).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CONTAINER_CBM,
  READY_THRESHOLD_DAYS,
  kpisFromRows,
  occupancyFrom,
  type CnStockStatus,
  type ReadyQueue,
  type StockRow,
  type VeStockStatus,
  type Warehouse,
  type WarehouseStock,
} from "./types";

// ── coerción ────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intNum(v: unknown): number {
  return Math.trunc(num(v));
}

/** Días enteros transcurridos entre `dateStr` (YYYY-MM-DD o ISO) y `now`. */
export function daysBetween(dateStr: string | null | undefined, now: Date = new Date()): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  const ms = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ── derivación de estado CN ──────────────────────────────────────────────────

/**
 * Estado derivado de una recepción CN (decisión §6.3).
 *
 *   - shipment_id en un consolidation `consolidando`            → "consolidando"
 *   - shipment_id en un consolidation cerrado/zarpado/arribado  → "transito"
 *   - pendiente_consolidacion + sin shipment + ≥N días en bodega → "listo"
 *   - resto (recién recibido, aún sin antigüedad)               → "recibido"
 *
 * `consolidationStatusByShipment` mapea shipment_id → status del contenedor
 * (consolidations.status) que la query arma una sola vez.
 */
export function deriveCnStatus(
  receipt: {
    status: string;
    shipment_id: string | null;
    received_at: string | null;
  },
  consolidationStatusByShipment: Map<string, string>,
  thresholdDays: number = READY_THRESHOLD_DAYS,
  now: Date = new Date(),
): CnStockStatus {
  if (receipt.shipment_id) {
    const consStatus = consolidationStatusByShipment.get(receipt.shipment_id);
    if (consStatus === "consolidando") return "consolidando";
    if (consStatus) return "transito"; // cerrado / zarpado / arribado / transito
  }
  if (
    receipt.status === "pendiente_consolidacion" &&
    !receipt.shipment_id &&
    daysBetween(receipt.received_at, now) >= thresholdDays
  ) {
    return "listo";
  }
  return "recibido";
}

// ── derivación de estado VE ──────────────────────────────────────────────────

/**
 * Estado derivado de una recepción VE — modo despacho (decisión §6.4).
 *
 *   - en_muelle / recibiendo          → "transito"  (viajando / llegando al hub)
 *   - sellado / con_incidencia        → "aduana"    (en Valencia, nacionalizando)
 *
 * El avance a "entrega"/"entregado" se cose con Despacho (dispatch_orders) en
 * Slice B; Slice A deriva del ciclo de la recepción VE (read-only, sin join caro).
 */
export function deriveVeStatus(receiptStatus: string): VeStockStatus {
  switch (receiptStatus) {
    case "en_muelle":
    case "recibiendo":
      return "transito";
    case "sellado":
    case "con_incidencia":
      return "aduana";
    default:
      return "transito";
  }
}

// ── CN: stock por bodega ──────────────────────────────────────────────────────

const CN_COLUMNS =
  "id, client_markbox, client_name, supplier_name, supplier_name_translated, boxes, total_cbm, total_weight_kg, status, shipment_id, received_at, is_orphan, orphan_marks";

async function getStockCN(
  supabase: SupabaseClient,
  now: Date,
): Promise<WarehouseStock> {
  // 1. Recepciones CN vivas (RLS filtra por tenant; soft-delete por policy).
  const { data: receipts, error } = await supabase
    .from("warehouse_receipts_cn")
    .select(CN_COLUMNS)
    .is("deleted_at", null)
    .order("received_at", { ascending: false });
  if (error) throw error;

  // 2. Mapa shipment_id → status del contenedor que lo contiene.
  const consStatusByShipment = await consolidationStatusMap(supabase);

  const rows: StockRow[] = (receipts ?? []).map((r) => {
    const rec = r as Record<string, unknown>;
    const status = deriveCnStatus(
      {
        status: String(rec.status ?? ""),
        shipment_id: (rec.shipment_id as string | null) ?? null,
        received_at: (rec.received_at as string | null) ?? null,
      },
      consStatusByShipment,
      READY_THRESHOLD_DAYS,
      now,
    );
    const markbox =
      (rec.client_markbox as string | null) ||
      (rec.orphan_marks as string | null) ||
      "—";
    const contents =
      (rec.supplier_name_translated as string | null) ||
      (rec.supplier_name as string | null) ||
      "—";
    return {
      id: String(rec.id),
      warehouse: "CN" as const,
      markbox,
      clientName: (rec.client_name as string | null) || "Sin asignar",
      contents,
      boxes: intNum(rec.boxes),
      cbm: num(rec.total_cbm),
      weightKg: num(rec.total_weight_kg),
      daysInWarehouse: daysBetween(rec.received_at as string | null, now),
      status,
    };
  });

  const kpis = kpisFromRows(rows);

  // Ocupación = Σ CBM de partidas listas + consolidando (lo que va al próximo contenedor).
  const usedCbm = rows
    .filter((r) => r.status === "listo" || r.status === "consolidando")
    .reduce((a, r) => a + r.cbm, 0);
  const capacity = await containerCapacityCbm(supabase);
  const occupancy = occupancyFrom(usedCbm, capacity);

  // Cola "listo para consolidar" = partidas listas (informativo en Slice A).
  const readyRows = rows.filter((r) => r.status === "listo");
  const readyQueue: ReadyQueue = {
    marks: new Set(readyRows.map((r) => r.markbox)).size,
    rows: readyRows.length,
    cbm: Math.round(readyRows.reduce((a, r) => a + r.cbm, 0) * 100) / 100,
  };

  return { warehouse: "CN", rows, kpis, occupancy, readyQueue };
}

// ── VE: stock por bodega ──────────────────────────────────────────────────────

async function getStockVE(
  supabase: SupabaseClient,
  now: Date,
): Promise<WarehouseStock> {
  // Recepciones VE vivas + sus cajas (agrupamos por markbox a nivel caja).
  const { data: receipts, error } = await supabase
    .from("warehouse_receipts_ve")
    .select(
      "id, receipt_code, container_code, status, eta, started_at, sealed_at, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const receiptList = (receipts ?? []) as Array<Record<string, unknown>>;
  if (receiptList.length === 0) {
    return {
      warehouse: "VE",
      rows: [],
      kpis: kpisFromRows([]),
      occupancy: null,
      readyQueue: null,
    };
  }

  const receiptIds = receiptList.map((r) => String(r.id));
  const { data: boxes, error: boxErr } = await supabase
    .from("warehouse_receipt_ve_boxes")
    .select("id, receipt_id, markbox, client_name, cbm, weight_kg")
    .in("receipt_id", receiptIds);
  if (boxErr) throw boxErr;

  // Una fila = (receipt × markbox): agrega las cajas de ese cliente en ese contenedor.
  type Acc = {
    receiptId: string;
    markbox: string;
    clientName: string;
    boxes: number;
    cbm: number;
    weightKg: number;
  };
  const byKey = new Map<string, Acc>();
  for (const b of (boxes ?? []) as Array<Record<string, unknown>>) {
    const receiptId = String(b.receipt_id);
    const markbox = (b.markbox as string | null) || "—";
    const key = `${receiptId}::${markbox}`;
    const acc = byKey.get(key) ?? {
      receiptId,
      markbox,
      clientName: (b.client_name as string | null) || "Sin asignar",
      boxes: 0,
      cbm: 0,
      weightKg: 0,
    };
    acc.boxes += 1;
    acc.cbm += num(b.cbm);
    acc.weightKg += num(b.weight_kg);
    byKey.set(key, acc);
  }

  const receiptById = new Map(receiptList.map((r) => [String(r.id), r]));
  const rows: StockRow[] = [...byKey.values()].map((acc) => {
    const rec = receiptById.get(acc.receiptId)!;
    const refDate =
      (rec.started_at as string | null) ||
      (rec.created_at as string | null) ||
      (rec.eta as string | null);
    return {
      id: `${acc.receiptId}-${acc.markbox}`,
      warehouse: "VE" as const,
      markbox: acc.markbox,
      clientName: acc.clientName,
      contents: (rec.container_code as string | null) || "—",
      boxes: acc.boxes,
      cbm: Math.round(acc.cbm * 1000) / 1000,
      weightKg: Math.round(acc.weightKg * 100) / 100,
      daysInWarehouse: daysBetween(refDate, now),
      status: deriveVeStatus(String(rec.status ?? "")),
    };
  });

  return {
    warehouse: "VE",
    rows,
    kpis: kpisFromRows(rows),
    occupancy: null,
    readyQueue: null,
  };
}

// ── helpers de soporte (consolidations / capacidad) ───────────────────────────

/** Mapa shipment_id → status del contenedor que lo contiene (CN). */
async function consolidationStatusMap(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const { data: cons } = await supabase
    .from("consolidations")
    .select("id, status")
    .is("deleted_at", null);
  const statusById = new Map(
    ((cons ?? []) as Array<Record<string, unknown>>).map((c) => [
      String(c.id),
      String(c.status ?? ""),
    ]),
  );
  if (statusById.size === 0) return map;

  const { data: items } = await supabase
    .from("consolidation_items")
    .select("consolidation_id, shipment_id")
    .not("shipment_id", "is", null);
  for (const it of (items ?? []) as Array<Record<string, unknown>>) {
    const shipmentId = it.shipment_id as string | null;
    if (!shipmentId) continue;
    const consStatus = statusById.get(String(it.consolidation_id));
    if (consStatus) map.set(shipmentId, consStatus);
  }
  return map;
}

/** Capacidad CBM del 40'HC del tenant (fallback al default si no hay catálogo). */
async function containerCapacityCbm(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("container_types")
    .select("code, cbm_capacity")
    .eq("code", "40HC")
    .limit(1)
    .maybeSingle();
  const cap = data ? num((data as Record<string, unknown>).cbm_capacity) : 0;
  return cap > 0 ? cap : DEFAULT_CONTAINER_CBM;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Stock real de una bodega, agrupado por Shipping Mark, con estado derivado y
 * KPIs. CN = consolidación (con ocupación + cola); VE = despacho. Read-only.
 */
export async function getStockByWarehouse(
  supabase: SupabaseClient,
  warehouse: Warehouse,
  now: Date = new Date(),
): Promise<WarehouseStock> {
  return warehouse === "CN"
    ? getStockCN(supabase, now)
    : getStockVE(supabase, now);
}
