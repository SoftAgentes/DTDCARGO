/**
 * SDD-0631 · Lecturas para ligar una CxP a un contenedor y a un embarque.
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 * Toleran la base sin la 0536: `available: false` en vez de romper Tesorería.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import type { BillCostLink } from "./types";
import type { CostCategoryKey } from "@/lib/studio/costing/types";

/** Un contenedor elegible y los embarques asignados a él. */
export type ContainerOption = {
  id: string;
  ref: string;
  status: string;
  containerType: string | null;
  shipments: { id: string; code: string | null }[];
};

export type CostLinkData = {
  /** false si la base todavía no tiene la 0536. */
  available: boolean;
  containers: ContainerOption[];
  /** Vínculo actual por id de CxP (solo las ligadas). */
  links: Record<string, BillCostLink>;
};

/** ¿El error dice que faltan las columnas de la 0536? */
export function isMissingCostLinkColumns(message: string | null | undefined): boolean {
  const msg = message ?? "";
  return /(consolidation_id|cost_category)/.test(msg) && /does not exist|no existe|schema cache/i.test(msg);
}

/** Tope de contenedores en el selector: los más recientes primero. */
const CONTAINER_LIMIT = 300;

export async function listCostLinkData(supabase: SupabaseClient): Promise<CostLinkData> {
  const [consRes, linksRes] = await Promise.all([
    supabase
      .from("consolidations")
      .select("id, ref, status, container_type, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(CONTAINER_LIMIT),
    // Paginado: una CxP ligada que no entra se vería «sin vínculo».
    fetchAllPaged<Record<string, unknown>>((d, h) =>
      supabase
        .from("supplier_bills")
        .select("id, consolidation_id, shipment_id, cost_category")
        .is("deleted_at", null)
        .or("consolidation_id.not.is.null,shipment_id.not.is.null")
        .order("id", { ascending: true })
        .range(d, h),
    ).then(
      (r) => ({ ...r, error: null as string | null }),
      (e: unknown) => ({ rows: [], complete: true, error: e instanceof Error ? e.message : String(e) }),
    ),
  ]);

  if (consRes.error) throw new Error(consRes.error.message);
  const available = !(linksRes.error && isMissingCostLinkColumns(linksRes.error));
  if (linksRes.error && available) throw new Error(linksRes.error);
  if (!linksRes.complete) throw new Error("Las CxP ligadas superan el tope de lectura.");

  const cons = (consRes.data ?? []) as {
    id: string;
    ref: string;
    status: string;
    container_type: string | null;
  }[];

  const shipmentsBy = new Map<string, { id: string; code: string | null }[]>();
  if (cons.length > 0) {
    // Paginado y filtrado en JS: 300 ids no caben bien en un `.in()` de URL.
    const wanted = new Set(cons.map((c) => c.id));
    const { rows: items, complete } = await fetchAllPaged<Record<string, unknown>>((d, h) =>
      supabase
        .from("consolidation_items")
        .select("id, consolidation_id, shipment_id, shipments(code)")
        .not("shipment_id", "is", null)
        .order("id", { ascending: true })
        .range(d, h),
    );
    if (!complete) throw new Error("Las piezas de contenedor superan el tope de lectura.");
    for (const it of (items.filter((r) => wanted.has(r.consolidation_id as string))) as unknown as {
      consolidation_id: string;
      shipment_id: string;
      shipments: { code: string | null } | { code: string | null }[] | null;
    }[]) {
      const ship = Array.isArray(it.shipments) ? it.shipments[0] : it.shipments;
      const list = shipmentsBy.get(it.consolidation_id) ?? [];
      if (!list.some((s) => s.id === it.shipment_id)) {
        list.push({ id: it.shipment_id, code: ship?.code ?? null });
      }
      shipmentsBy.set(it.consolidation_id, list);
    }
  }

  const links: Record<string, BillCostLink> = {};
  if (available) {
    for (const r of linksRes.rows as unknown as {
      id: string;
      consolidation_id: string | null;
      shipment_id: string | null;
      cost_category: string | null;
    }[]) {
      links[r.id] = {
        consolidationId: r.consolidation_id,
        shipmentId: r.shipment_id,
        costCategory: (r.cost_category as CostCategoryKey | null) ?? null,
      };
    }
  }

  return {
    available,
    containers: cons.map((c) => ({
      id: c.id,
      ref: c.ref,
      status: c.status,
      containerType: c.container_type,
      shipments: (shipmentsBy.get(c.id) ?? []).sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "")),
    })),
    links,
  };
}

/**
 * ¿El embarque está asignado al contenedor? (la misma regla que el trigger de
 * la 0536, para devolver un error claro antes de escribir).
 */
export async function shipmentInContainer(
  supabase: SupabaseClient,
  consolidationId: string,
  shipmentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consolidation_items")
    .select("id")
    .eq("consolidation_id", consolidationId)
    .eq("shipment_id", shipmentId)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
