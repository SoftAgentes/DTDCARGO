/**
 * SDD-0631 · Las CxP ligadas a un contenedor o a un embarque, en el costeo.
 *
 * Puro (sin Supabase). Reglas:
 *  - Cuenta el monto CAUSADO de la CxP en USD (`usdOrNull`, SDD-0572), no lo
 *    pagado: la orden de pago no suma costo.
 *  - Fuera: anuladas y borradas. Sin contenedor ni embarque: no es costo de
 *    embarque.
 *  - Con embarque → todo al embarque (aunque también traiga contenedor: así
 *    cuenta una sola vez; el contenedor lo recibe por sus embarques).
 *  - Solo contenedor → se reparte por CBM entre sus embarques; si el
 *    contenedor no tiene CBM asignado, queda «sin repartir» en el contenedor.
 *  - Sin tasa → no suma; se cuenta para que el margen no se certifique.
 *  - Por categoría, la CxP REEMPLAZA a `shipment_costs` (`effectiveCosts`): un
 *    flete estimado a mano y la CxP real del mismo flete nunca se suman.
 */

import { usdOrNull } from "@/lib/shared/fx";
import {
  COST_CATEGORY_KEYS,
  emptyCosts,
  marginTone,
  type CostAmounts,
  type CostCategoryKey,
  type MarginTone,
} from "./types";

export type LinkedBillRow = {
  id: string;
  shipment_id: string | null;
  consolidation_id: string | null;
  cost_category: string | null;
  currency: string;
  total_amount: number | string;
  fx_rate: number | string | null;
  status: string;
  deleted_at: string | null;
};

export type ConsolidationItemRow = {
  consolidation_id: string;
  shipment_id: string | null;
  cbm: number | string | null;
};

export type ConsolidationRow = {
  id: string;
  ref: string;
  status: string;
  container_type: string | null;
  deleted_at: string | null;
};

/** Lo que las CxP le aportan a un embarque. */
export type ShipmentCxp = {
  /** USD por categoría. La presencia de la clave = esa categoría la cubre CxP. */
  amounts: Partial<CostAmounts>;
  /** USD total aportado (directo + prorrateado). */
  total: number;
  /** CxP que aportan (directas o por su contenedor). */
  bills: number;
  /** CxP sin tasa que le tocaban (no suman). */
  sinTasa: number;
};

export type BillAllocation = {
  byShipment: Map<string, ShipmentCxp>;
  /** USD de CxP de contenedor que no se pudo repartir (contenedor sin CBM). */
  unallocatedByContainer: Map<string, number>;
  /** USD de todas las CxP con ese contenedor (repartidas, directas o sin repartir). */
  cxpByContainer: Map<string, number>;
  sinTasaByContainer: Map<string, number>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Categoría válida de Costing; una CxP legada sin categoría va a «Otros». */
export function billCategory(raw: string | null | undefined): CostCategoryKey {
  return (COST_CATEGORY_KEYS as string[]).includes(raw ?? "")
    ? (raw as CostCategoryKey)
    : "other";
}

/** ¿La CxP cuenta como costo? Viva, no anulada y con algún vínculo. */
export function isCostBill(b: LinkedBillRow): boolean {
  return (
    b.deleted_at == null &&
    b.status !== "anulada" &&
    (b.shipment_id != null || b.consolidation_id != null)
  );
}

function addTo(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

function shipmentEntry(map: Map<string, ShipmentCxp>, id: string): ShipmentCxp {
  let e = map.get(id);
  if (!e) {
    e = { amounts: {}, total: 0, bills: 0, sinTasa: 0 };
    map.set(id, e);
  }
  return e;
}

function addAmount(e: ShipmentCxp, cat: CostCategoryKey, usd: number) {
  e.amounts[cat] = round2((e.amounts[cat] ?? 0) + usd);
  e.total = round2(e.total + usd);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reparte `usd` en centavos según los pesos. El resto de redondeo va al último:
 * la suma de las partes es exactamente el total.
 */
export function splitByWeight(usd: number, weights: number[]): number[] {
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const cents = Math.round(usd * 100);
  const parts = weights.map((w) => Math.floor((cents * w) / total));
  const used = parts.reduce((a, p) => a + p, 0);
  parts[parts.length - 1] += cents - used;
  return parts.map((p) => p / 100);
}

/** Embarques del contenedor con su CBM (los sin embarque no reciben costo). */
function containerShipments(
  items: ConsolidationItemRow[],
  consolidationId: string,
): { shipmentId: string; cbm: number }[] {
  const byShipment = new Map<string, number>();
  for (const it of items) {
    if (it.consolidation_id !== consolidationId || !it.shipment_id) continue;
    byShipment.set(it.shipment_id, (byShipment.get(it.shipment_id) ?? 0) + Math.max(0, num(it.cbm)));
  }
  return [...byShipment.entries()]
    .map(([shipmentId, cbm]) => ({ shipmentId, cbm }))
    .sort((a, b) => a.shipmentId.localeCompare(b.shipmentId));
}

export function allocateLinkedBills(
  bills: LinkedBillRow[],
  items: ConsolidationItemRow[],
): BillAllocation {
  const byShipment = new Map<string, ShipmentCxp>();
  const unallocatedByContainer = new Map<string, number>();
  const cxpByContainer = new Map<string, number>();
  const sinTasaByContainer = new Map<string, number>();

  for (const b of bills) {
    if (!isCostBill(b)) continue;
    const cat = billCategory(b.cost_category);
    const usd = usdOrNull(b.total_amount, b.currency, b.fx_rate);

    if (b.shipment_id) {
      const e = shipmentEntry(byShipment, b.shipment_id);
      e.bills += 1;
      if (usd === null) e.sinTasa += 1;
      else addAmount(e, cat, usd);
      if (b.consolidation_id) {
        if (usd === null) addTo(sinTasaByContainer, b.consolidation_id, 1);
        else addTo(cxpByContainer, b.consolidation_id, usd);
      }
      continue;
    }

    // Solo contenedor.
    const cid = b.consolidation_id as string;
    const targets = containerShipments(items, cid).filter((t) => t.cbm > 0);
    if (usd === null) {
      addTo(sinTasaByContainer, cid, 1);
      for (const t of targets) {
        const e = shipmentEntry(byShipment, t.shipmentId);
        e.bills += 1;
        e.sinTasa += 1;
      }
      continue;
    }
    addTo(cxpByContainer, cid, usd);
    if (targets.length === 0) {
      addTo(unallocatedByContainer, cid, usd);
      continue;
    }
    const parts = splitByWeight(usd, targets.map((t) => t.cbm));
    targets.forEach((t, i) => {
      const e = shipmentEntry(byShipment, t.shipmentId);
      e.bills += 1;
      addAmount(e, cat, parts[i]);
    });
  }

  for (const [k, v] of cxpByContainer) cxpByContainer.set(k, round2(v));
  for (const [k, v] of unallocatedByContainer) unallocatedByContainer.set(k, round2(v));
  return { byShipment, unallocatedByContainer, cxpByContainer, sinTasaByContainer };
}

/**
 * Costo efectivo por categoría: la CxP reemplaza a `shipment_costs` en las
 * categorías que cubre; las demás quedan como se cargaron a mano.
 */
export function effectiveCosts(
  manual: Partial<CostAmounts> | null | undefined,
  cxp: ShipmentCxp | undefined,
): CostAmounts {
  const out = emptyCosts();
  for (const k of COST_CATEGORY_KEYS) {
    const fromCxp = cxp?.amounts[k];
    out[k] = fromCxp !== undefined ? fromCxp : num(manual?.[k]);
  }
  return out;
}

// ── Margen por contenedor ─────────────────────────────────────

/** Lo que `marginByContainer` necesita de cada fila de costeo. */
export type ContainerShipmentInput = {
  shipmentId: string;
  revenue: number;
  totalCost: number;
  /** Facturas o CxP sin tasa del embarque: su margen no se certifica. */
  sinTasa: number;
};

export type ContainerMarginRow = {
  id: string;
  ref: string;
  status: string;
  containerType: string | null;
  shipments: number;
  cbm: number;
  revenue: number;
  /** Costo total: el de sus embarques (ponderado por CBM) más lo sin repartir. */
  cost: number;
  /** USD de las CxP ligadas a este contenedor. */
  cxpCost: number;
  /** USD de CxP del contenedor sin CBM donde repartirse. */
  unallocated: number;
  margin: number;
  marginPct: number;
  tone: MarginTone;
  /** Embarques o CxP sin tasa: revenue/costo son subtotal y el margen no se certifica. */
  sinTasa: number;
};

/**
 * Margen por contenedor (PURA). Un embarque repartido en varios contenedores
 * aporta a cada uno la fracción de su CBM que va ahí (1 si va en uno solo;
 * partes iguales si no tiene CBM medido). Solo consolidaciones vivas.
 */
export function marginByContainer(
  rows: ContainerShipmentInput[],
  consolidations: ConsolidationRow[],
  items: ConsolidationItemRow[],
  allocation: Pick<BillAllocation, "unallocatedByContainer" | "cxpByContainer" | "sinTasaByContainer">,
): ContainerMarginRow[] {
  const live = consolidations.filter((c) => c.deleted_at == null);
  const liveIds = new Set(live.map((c) => c.id));
  const byShipment = new Map(rows.map((r) => [r.shipmentId, r]));

  // CBM y apariciones por embarque, solo en contenedores vivos.
  const shipmentCbm = new Map<string, number>();
  const shipmentItems = new Map<string, number>();
  for (const it of items) {
    if (!it.shipment_id || !liveIds.has(it.consolidation_id)) continue;
    addTo(shipmentCbm, it.shipment_id, Math.max(0, num(it.cbm)));
    addTo(shipmentItems, it.shipment_id, 1);
  }

  return live
    .map((c) => {
      let revenue = 0;
      let cost = 0;
      let cbm = 0;
      let sinTasa = allocation.sinTasaByContainer.get(c.id) ?? 0;
      const seen = new Set<string>();
      for (const it of items) {
        if (it.consolidation_id !== c.id) continue;
        const itemCbm = Math.max(0, num(it.cbm));
        cbm += itemCbm; // ocupación: cuenta toda la pieza, tenga embarque o no
        if (!it.shipment_id) continue;
        const row = byShipment.get(it.shipment_id);
        if (!row) continue;
        const totalCbm = shipmentCbm.get(it.shipment_id) ?? 0;
        const fraction =
          totalCbm > 0 ? itemCbm / totalCbm : 1 / (shipmentItems.get(it.shipment_id) ?? 1);
        revenue += row.revenue * fraction;
        cost += row.totalCost * fraction;
        if (!seen.has(it.shipment_id)) {
          seen.add(it.shipment_id);
          if (row.sinTasa > 0) sinTasa += 1;
        }
      }
      const unallocated = allocation.unallocatedByContainer.get(c.id) ?? 0;
      cost += unallocated;
      revenue = round2(revenue);
      cost = round2(cost);
      const margin = round2(revenue - cost);
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      return {
        id: c.id,
        ref: c.ref,
        status: c.status,
        containerType: c.container_type,
        shipments: seen.size,
        cbm: Math.round(cbm * 1000) / 1000,
        revenue,
        cost,
        cxpCost: allocation.cxpByContainer.get(c.id) ?? 0,
        unallocated,
        margin,
        marginPct,
        tone: marginTone(marginPct),
        sinTasa,
      };
    })
    .sort((a, b) => {
      if (a.sinTasa > 0 || b.sinTasa > 0) return Number(a.sinTasa > 0) - Number(b.sinTasa > 0);
      return b.ref.localeCompare(a.ref);
    });
}
