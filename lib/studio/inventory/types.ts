/**
 * Tipos del módulo Inventario / WMS (SDD-0081 · Slice A).
 *
 * El WMS es una **capa de derivación read-only** sobre tablas que ya existen
 * (warehouse_receipts_cn · warehouse_receipts_ve · consolidations). Acá viven los
 * enums de estado DERIVADO (no hay columna `estado` en DB — se calcula), los
 * helpers de label/tone para los <Badge>, y las formas de fila/resultado que
 * consumen las queries y la UI.
 *
 * Dos modos (decisión founder §6):
 *   - CN = **consolidación** (entrada): recibido → listo → consolidando → en tránsito.
 *   - VE = **despacho** (salida):       en tránsito → en aduana → en entrega → entregado.
 *
 * Solo CBM/kg — NUNCA valor en USD (decisión §6.2).
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

/** Almacén/modo del módulo. */
export type Warehouse = "CN" | "VE";

/**
 * Días en bodega tras los cuales un receipt CN `pendiente_consolidacion` sin
 * embarque pasa de "Recibido" → "Listo p/ consolidar" (decisión §6.3, N
 * configurable, sugerido 3–5). Default del sistema en Slice A (sin override aún).
 */
export const READY_THRESHOLD_DAYS = 3;

/** Capacidad CBM del contenedor de referencia (40'HC) para la barra de ocupación. */
export const DEFAULT_CONTAINER_CBM = 68;

// ─── Estados derivados CN (consolidación) ────────────────────────────────────

export type CnStockStatus =
  | "recibido"
  | "listo"
  | "consolidando"
  | "transito";

// ─── Estados derivados VE (despacho) ─────────────────────────────────────────

export type VeStockStatus =
  | "transito"
  | "aduana"
  | "entrega"
  | "entregado";

export type StockStatus = CnStockStatus | VeStockStatus;

interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

const CN_STATUS_META: Record<CnStockStatus, StatusMeta> = {
  recibido: { label: "Recibido", tone: "info" },
  listo: { label: "Listo p/ consolidar", tone: "info" },
  consolidando: { label: "Consolidando", tone: "info" },
  transito: { label: "En tránsito", tone: "info" },
};

const VE_STATUS_META: Record<VeStockStatus, StatusMeta> = {
  transito: { label: "En tránsito", tone: "info" },
  aduana: { label: "En aduana", tone: "info" },
  entrega: { label: "En entrega", tone: "success" },
  entregado: { label: "Entregado", tone: "neutral" },
};

/** Label + tone para el <Badge> de un estado derivado, según el modo. */
export function statusMeta(warehouse: Warehouse, status: StockStatus): StatusMeta {
  if (warehouse === "CN") {
    return CN_STATUS_META[status as CnStockStatus] ?? { label: status, tone: "neutral" };
  }
  return VE_STATUS_META[status as VeStockStatus] ?? { label: status, tone: "neutral" };
}

// ─── Filas y resultados ──────────────────────────────────────────────────────

/**
 * Una fila de stock = una partida agrupada por Shipping Mark dentro de una
 * recepción concreta (mantiene el detalle por receipt para que el operador vea
 * "5 cajas de María recibidas hace 2 días" + "3 cajas listas hace 5"). El
 * `markbox` (interno) se muestra al usuario como **Shipping Mark**.
 */
export interface StockRow {
  /** id estable de la fila (receipt id) para keys de React. */
  id: string;
  warehouse: Warehouse;
  markbox: string;
  clientName: string;
  /** Descripción / contenido legible (supplier o nota), puede ser "—". */
  contents: string;
  boxes: number;
  cbm: number;
  weightKg: number;
  /** Días en bodega desde la recepción. */
  daysInWarehouse: number;
  status: StockStatus;
}

/** KPIs agregados por bodega (los 4 del mockup). Solo CBM/kg, sin USD. */
export interface WarehouseKpis {
  /** Shipping Marks distintos con carga. */
  marks: number;
  boxes: number;
  cbm: number;
  weightKg: number;
}

/**
 * Ocupación del próximo contenedor (CN). Σ CBM de las partidas listas +
 * consolidando, sobre la capacidad del contenedor de referencia.
 */
export interface ContainerOccupancy {
  usedCbm: number;
  capacityCbm: number;
  /** 0–100, redondeado. */
  pct: number;
  /** Tono semáforo: >85 danger · >60 warning · resto success. */
  tone: BadgeTone;
}

/** Resumen de la cola "Listo para consolidar" (CN, informativo en Slice A). */
export interface ReadyQueue {
  marks: number;
  rows: number;
  cbm: number;
}

/** Resultado completo de `getStockByWarehouse`. */
export interface WarehouseStock {
  warehouse: Warehouse;
  rows: StockRow[];
  kpis: WarehouseKpis;
  /** Solo CN — ocupación del próximo contenedor. null en VE. */
  occupancy: ContainerOccupancy | null;
  /** Solo CN — cola lista para consolidar. null en VE. */
  readyQueue: ReadyQueue | null;
}

// ─── Helpers puros de agregación (testeables sin DB) ─────────────────────────

/** KPIs a partir de las filas: marks distintos + sumas de cajas/CBM/kg. */
export function kpisFromRows(rows: StockRow[]): WarehouseKpis {
  const marks = new Set<string>();
  let boxes = 0;
  let cbm = 0;
  let weightKg = 0;
  for (const r of rows) {
    if (r.markbox) marks.add(r.markbox);
    boxes += r.boxes;
    cbm += r.cbm;
    weightKg += r.weightKg;
  }
  return { marks: marks.size, boxes, cbm: round2(cbm), weightKg: round2(weightKg) };
}

/** Ocupación del contenedor a partir del CBM usado y la capacidad. */
export function occupancyFrom(usedCbm: number, capacityCbm: number): ContainerOccupancy {
  const cap = capacityCbm > 0 ? capacityCbm : DEFAULT_CONTAINER_CBM;
  const pct = Math.min(100, Math.round((usedCbm / cap) * 100));
  const tone: BadgeTone = pct > 85 ? "danger" : pct > 60 ? "warning" : "success";
  return { usedCbm: round2(usedCbm), capacityCbm: cap, pct, tone };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
